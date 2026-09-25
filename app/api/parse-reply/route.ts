import { classifyReplyByRules, parseReply } from "@/lib/followups";
import { SERVER_AI_TIMEOUT_MS, withTimeout } from "@/lib/demoCache";

// The pasted reply is classified and discarded; it is never stored or logged server-side.
export async function POST(req: Request) {
  const { text, platformName } = (await req.json().catch(() => ({}))) as { text?: string; platformName?: string };
  if (!text?.trim()) return Response.json({ error: "Paste the reply text" }, { status: 400 });
  const out = await withTimeout(parseReply(text, String(platformName ?? "the platform").slice(0, 60)), SERVER_AI_TIMEOUT_MS).catch(() => ({
    ...classifyReplyByRules(text),
    source: "rules" as const,
  }));
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
