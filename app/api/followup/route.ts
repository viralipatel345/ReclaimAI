import { draftFollowUpText, type TimelineFacts } from "@/lib/followups";

// Timeline facts only — no names, emails or links reach this route or the model.
export async function POST(req: Request) {
  const { kind, facts } = (await req.json().catch(() => ({}))) as { kind?: string; facts?: TimelineFacts };
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
  return Response.json(await draftFollowUpText(kind, clean), { headers: { "Cache-Control": "no-store" } });
}
