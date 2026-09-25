import { isDemoMode } from "@/lib/config";
import type { DetectContext, PostText } from "@/lib/detect";
import { detectPost } from "@/lib/detectAgent";
import { cachedDetection, SERVER_AI_TIMEOUT_MS, withTimeout } from "@/lib/demoCache";

// Live detection runs only against the SANDBOX account in demo mode. Scanning real
// accounts would mean logging in to platforms, which Reclaim never does.
// Input is post TEXT only — the payload has no field that could carry an image.
export async function POST(req: Request) {
  if (!isDemoMode()) return Response.json({ error: "Live detection runs in the demo sandbox only." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { post?: PostText; context?: DetectContext; preferCache?: boolean } | null;
  const p = body?.post;
  const ctx = body?.context;
  if (!p?.id || typeof p.caption !== "string" || !ctx?.legalName) return Response.json({ error: "Bad request" }, { status: 400 });
  const post: PostText = {
    id: String(p.id).slice(0, 40),
    url: String(p.url).slice(0, 300),
    caption: p.caption.slice(0, 2200),
    comments: (Array.isArray(p.comments) ? p.comments : []).slice(0, 20).map((c) => ({ user: String(c.user).slice(0, 40), text: String(c.text).slice(0, 500) })),
  };
  const context: DetectContext = {
    legalName: String(ctx.legalName).slice(0, 80),
    knownUrls: (ctx.knownUrls ?? []).slice(0, 50).map(String),
    platformNames: (ctx.platformNames ?? []).slice(0, 20).map(String),
  };
  const cached = cachedDetection(post.id);
  if (body?.preferCache && cached) return Response.json({ ...cached, source: "cached" }, { headers: { "Cache-Control": "no-store" } });
  let result = null;
  try {
    result = await withTimeout(detectPost(post, context), SERVER_AI_TIMEOUT_MS);
  } catch {}
  // Gemini slow or down: the recorded verdict for this sandbox post, else the rules.
  if ((!result || result.source === "rules") && cached) result = { ...cached, source: "cached" as const };
  result ??= await detectPost(post, context, async () => {
    throw new Error("skip model");
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
