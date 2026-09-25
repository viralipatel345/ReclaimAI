// draft_request / draft_google_removal: Gemini writes ONLY a short opening per request.
// It is given platform names and nothing else — no names, emails or URLs — and its
// output is sanitized before being slotted into the fixed legal template.
import { runAgent } from "./agent";
import { MODELS } from "./config";
import { sanitizeOpening } from "./templates";

export interface OpeningTarget {
  platformId: string;
  platformName: string;
  kind: "takedown" | "google_removal" | "refile";
}

export interface OpeningsResult {
  openings: Record<string, string>;
  source: "gemini" | "cached" | "template";
  model?: string;
}

export const OPENING_SYSTEM_PROMPT = `You write the first lines of removal requests that a survivor of non-consensual intimate imagery sends in their own name.
Write in the FIRST PERSON, as the person themselves ("I") — never "on behalf of" anyone.
For each platform: a greeting line addressed to that platform's Trust & Safety (or Legal/Removals) team, then ONE short, courteous, firm sentence asking them to act promptly. Plain, human, not bureaucratic.
Never: describe the content; mention names, URLs, dates or laws; make threats; add a sign-off or signature; use markdown. The legal sections are added separately.
For a re-upload, say the content has reappeared after an earlier report. For Google Search, ask them to remove results rather than content.
Call draft_request once for every non-Google platform, and draft_google_removal for Google Search.`;

export type OpeningsAgent = (targets: OpeningTarget[]) => Promise<{ outputs: { name: string; args: Record<string, unknown> }[]; model: string }>;

const defaultAgent: OpeningsAgent = async (targets) => {
  const list = targets.map((t) => `- ${t.platformName}${t.kind === "refile" ? " (re-upload)" : ""}`).join("\n");
  const run = await runAgent<Record<string, unknown>>({
    model: MODELS.fast,
    systemInstruction: OPENING_SYSTEM_PROMPT,
    contents: [{ role: "user", parts: [{ text: `Write openings for:\n${list}` }] }],
    tools: ["draft_request", "draft_google_removal"],
    finalTool: ["draft_request", "draft_google_removal"],
    maxSteps: 2,
  });
  return { outputs: run.outputs, model: run.model };
};

export async function draftOpenings(targets: OpeningTarget[], agent: OpeningsAgent = defaultAgent): Promise<OpeningsResult> {
  const openings: Record<string, string> = {};
  let model: string | undefined;
  try {
    const run = await agent(targets);
    model = run.model;
    const byName = new Map(targets.map((t) => [t.platformName.toLowerCase(), t]));
    for (const o of run.outputs) {
      const target =
        o.name === "draft_google_removal"
          ? targets.find((t) => t.kind === "google_removal")
          : byName.get(String(o.args.platformName ?? "").toLowerCase());
      if (target && typeof o.args.opening === "string") openings[target.platformId] = sanitizeOpening(o.args.opening, target.platformName);
    }
  } catch {
    // Fall through: the template's default opening is used for every platform.
  }
  const any = Object.keys(openings).length > 0;
  return { openings, source: any ? "gemini" : "template", model: any ? model : undefined };
}
