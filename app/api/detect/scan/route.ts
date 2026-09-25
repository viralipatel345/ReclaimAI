import { withTimeout } from "@/lib/demoCache";
import { scanAccount } from "@/lib/feeds";
import { normalizeUrl } from "@/lib/platforms";

// Reads the reported account's public feed as text. The only input is a link she reported.
export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const normalized = normalizeUrl(String(url ?? ""));
  if (!normalized) return Response.json({ error: "Not a valid web link" }, { status: 400 });
  const result = await withTimeout(scanAccount(normalized), 20000).catch(() => null);
  if (!result) return Response.json({ error: "This site has no public feed Reclaim can read without logging in." }, { status: 422 });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
