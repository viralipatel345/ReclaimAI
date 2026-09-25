import { parseReply } from "@/lib/followups";

// The pasted reply is classified and discarded; it is never stored or logged server-side.
export async function POST(req: Request) {
  const { text, platformName } = (await req.json().catch(() => ({}))) as { text?: string; platformName?: string };
  if (!text?.trim()) return Response.json({ error: "Paste the reply text" }, { status: 400 });
  return Response.json(await parseReply(text, String(platformName ?? "the platform").slice(0, 60)), { headers: { "Cache-Control": "no-store" } });
}
