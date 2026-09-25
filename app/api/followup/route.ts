import { isDemoMode } from "@/lib/config";
import { cachedFollowUp, SERVER_AI_TIMEOUT_MS, withTimeout } from "@/lib/demoCache";
import { draftFollowUpText, type TimelineFacts } from "@/lib/followups";

// Timeline facts only — no names, emails or links reach this route or the model.
export async function POST(req: Request) {
  const { kind, facts, preferCache } = (await req.json().catch(() => ({}))) as { kind?: string; facts?: TimelineFacts; preferCache?: boolean };
  if ((kind !== "reminder" && kind !== "ftc") || !facts?.platformName) return Response.json({ error: "Bad request" }, { status: 400 });
  const clean: TimelineFacts = {
    platformName: String(facts.platformName).slice(0, 60),
    coveredByAct: !!facts.coveredByAct,
    sentAt: String(facts.sentAt),
    deadlineAt: String(facts.deadlineAt),
    now: String(facts.now),
    hourMark: typeof facts.hourMark === "number" ? facts.hourMark : undefined,
    remindersSent: Array.isArray(facts.remindersSent) ? facts.remindersSent.filter((h) => typeof h === "number") : [],
    linkCount: Number(facts.linkCount) || 1,
    rejected: !!facts.rejected,
  };
  const cached = isDemoMode() ? cachedFollowUp(kind, clean.platformName, clean.hourMark) : undefined;
  const headers = { "Cache-Control": "no-store" };
  if (preferCache && cached) return Response.json({ text: cached, source: "cached" }, { headers });
  let out: { text: string; source: "gemini" | "cached" | "template" } = { text: "", source: "template" };
  try {
    out = await withTimeout(draftFollowUpText(kind, clean), kind === "ftc" ? SERVER_AI_TIMEOUT_MS + 4000 : SERVER_AI_TIMEOUT_MS);
  } catch {}
  if (out.source !== "gemini" && cached) out = { text: cached, source: "cached" };
  return Response.json(out, { headers });
}
