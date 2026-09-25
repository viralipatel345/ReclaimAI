import { normalizeUrl } from "@/lib/platforms";
import { resolvePlatform } from "@/lib/resolve";
import { withTimeout } from "@/lib/demoCache";
import { unresolvedPlatform } from "@/lib/platforms";

export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const normalized = normalizeUrl(String(url ?? ""));
  if (!normalized) return Response.json({ error: "Not a valid web link" }, { status: 400 });
  // Grounded search can take ~10s and retries once; never hang the UI longer than 20s.
  const platform = await withTimeout(resolvePlatform(normalized), 20000).catch(() => unresolvedPlatform(normalized));
  return Response.json(platform, { headers: { "Cache-Control": "no-store" } });
}
