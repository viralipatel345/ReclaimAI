import { normalizeUrl } from "@/lib/platforms";
import { resolvePlatform } from "@/lib/resolve";

export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const normalized = normalizeUrl(String(url ?? ""));
  if (!normalized) return Response.json({ error: "Not a valid web link" }, { status: 400 });
  return Response.json(await resolvePlatform(normalized), { headers: { "Cache-Control": "no-store" } });
}
