// Server-side Gemini work for follow-ups: reminder lines, FTC complaint summaries and
// classifying pasted platform replies. Gemini sees only the timeline facts (platform
// name, dates, counts) — never the person's name, email or links.
import { runAgent } from "./agent";
import { MODELS } from "./config";
import type { ReplyStatus } from "./types";

export interface TimelineFacts {
  platformName: string;
  coveredByAct: boolean;
  sentAt: string;
  deadlineAt: string;
  now: string;
  hourMark?: number;
  remindersSent: number[];
  linkCount: number;
  rejected?: boolean;
}

type Drafter = (kind: "reminder" | "ftc", facts: TimelineFacts) => Promise<string>;

const FOLLOWUP_PROMPT = `You help a survivor of non-consensual intimate imagery follow up on removal requests they sent under the US TAKE IT DOWN Act.
Write in the first person ("I"). Be factual, calm and firm. Use only the facts provided; never invent dates, events, names or laws.
Never describe the content, never include names, emails or URLs, never threaten, no markdown.`;

const defaultDrafter: Drafter = async (kind, facts) => {
  const tool = kind === "reminder" ? "draft_reminder" : "draft_ftc_complaint";
  const ask =
    kind === "reminder"
      ? `Write one sentence for the ${facts.hourMark}-hour reminder. The deadline is ${facts.deadlineAt}.`
      : `Write the summary paragraph for my FTC complaint about ${facts.platformName}. Name the platform.`;
  const run = await runAgent<{ text?: string; summary?: string }>({
    model: kind === "reminder" ? MODELS.fast : MODELS.primary,
    systemInstruction: FOLLOWUP_PROMPT,
    contents: [{ role: "user", parts: [{ text: `Facts (JSON): ${JSON.stringify(facts)}\n\n${ask}` }] }],
    tools: [tool],
    finalTool: tool,
    maxSteps: 2,
  });
  return String(run.output.text ?? run.output.summary ?? "");
};

export async function draftFollowUpText(kind: "reminder" | "ftc", facts: TimelineFacts, drafter: Drafter = defaultDrafter): Promise<{ text: string; source: "gemini" | "template" }> {
  try {
    const text = (await drafter(kind, facts)).replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    if (text.length >= 12) return { text: text.slice(0, kind === "reminder" ? 240 : 700), source: "gemini" };
  } catch {
    // fall through to template
  }
  return { text: "", source: "template" };
}

// ---------- parse_reply ----------

export interface ParsedReply {
  status: ReplyStatus;
  summary: string;
  asksForImages: boolean;
  source: "gemini" | "rules";
}

const IMAGE_REQUEST = /\b(send|upload|attach|provide|share)\b[^.]{0,60}\b(image|images|photo|photos|picture|pictures|video|videos|screenshot|screenshots|copy of the (?:image|photo|video))\b/i;

/** Keyword fallback when Gemini is unavailable. Order matters: rejections often mention "removed". */
export function classifyReplyByRules(text: string): Omit<ParsedReply, "source"> {
  const t = text.toLowerCase();
  const asksForImages = IMAGE_REQUEST.test(text);
  if (/(does not|doesn't|did not|didn't) (violate|go against)|not (in )?violation|(unable|not able) to (take action|remove)|we (won't|will not|cannot|can't) remove|declin(e|ed) to|no action (will be|was) taken/.test(t))
    return { status: "rejected", summary: "The platform says it won't remove the content.", asksForImages };
  if (/(has|have) (been )?(removed|taken down|disabled)|was (removed|taken down|disabled)|we (removed|took down|disabled)|no longer (available|accessible)/.test(t))
    return { status: "removed", summary: "The platform says the content was removed.", asksForImages };
  if (/(received|we('re| are) (reviewing|looking)|under review|ticket|case (number|id|#)|thank you for (your )?report|will (review|get back))/.test(t))
    return { status: "acknowledged", summary: "The platform confirmed it received the request and is reviewing it.", asksForImages };
  return { status: "unclear", summary: "The reply doesn't clearly say what the platform decided.", asksForImages };
}

type Classifier = (text: string, platformName: string) => Promise<{ status?: string; summary?: string; asksForImages?: boolean }>;

const defaultClassifier: Classifier = async (text, platformName) => {
  const run = await runAgent<{ status?: string; summary?: string; asksForImages?: boolean }>({
    model: MODELS.fast,
    systemInstruction:
      "Classify a platform's reply to a non-consensual intimate imagery removal request. removed = they say it's taken down; acknowledged = received / under review; rejected = they won't remove it; unclear = anything else. If unsure, use unclear — never guess. The summary must not include names, emails or links.",
    contents: [{ role: "user", parts: [{ text: `Reply from ${platformName}:\n"""\n${text}\n"""` }] }],
    tools: ["parse_reply"],
    finalTool: "parse_reply",
    maxSteps: 2,
  });
  return run.output;
};

const STATUSES: ReplyStatus[] = ["acknowledged", "removed", "rejected", "unclear"];

export async function parseReply(text: string, platformName: string, classifier: Classifier = defaultClassifier): Promise<ParsedReply> {
  const clipped = text.slice(0, 6000);
  const rules = classifyReplyByRules(clipped);
  try {
    const out = await classifier(clipped, platformName);
    const status = STATUSES.includes(out.status as ReplyStatus) ? (out.status as ReplyStatus) : "unclear";
    const summary = String(out.summary ?? "").replace(/https?:\/\/\S+|[^\s@]+@[^\s@]+/g, "").trim().slice(0, 240) || rules.summary;
    // Either signal is enough to warn: the rule is a safety net, not a vote.
    return { status, summary, asksForImages: !!out.asksForImages || rules.asksForImages, source: "gemini" };
  } catch {
    return { ...rules, source: "rules" };
  }
}
