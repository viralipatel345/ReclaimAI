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
Never describe the content, never include names, emails or URLs, never threaten, no markdown.
Don't state specific dates or times — the complaint's timeline lists them. Say "within 48 hours" or "the deadline has passed" instead.`;

const defaultDrafter: Drafter = async (kind, facts) => {
  const tool = kind === "reminder" ? "draft_reminder" : "draft_ftc_complaint";
  const ask =
    kind === "reminder"
      ? `Write one sentence for the ${facts.hourMark}-hour reminder (${(facts.hourMark ?? 24) >= 44 ? "the deadline is only hours away" : "about a day remains"}).`
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

export async function draftFollowUpText(kind: "reminder" | "ftc", facts: TimelineFacts, drafter: Drafter = defaultDrafter): Promise<{ text: string; source: "gemini" | "cached" | "template" }> {
  try {
    const text = (await drafter(kind, facts)).replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    if (text.length >= 12) return { text: text.slice(0, kind === "reminder" ? 240 : 700), source: "gemini" };
  } catch {
    // fall through to template
  }
  return { text: "", source: "template" };
}

// ---------- parse_reply ----------
import { classifyReplyByRules } from "./replyRules";
export { classifyReplyByRules };

export interface ParsedReply {
  status: ReplyStatus;
  summary: string;
  asksForImages: boolean;
  source: "gemini" | "rules";
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
