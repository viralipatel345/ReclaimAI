import { isDemoMode } from "@/lib/config";
import type { DetectContext, PostText } from "@/lib/detect";
import { detectPost } from "@/lib/detectAgent";

// Live detection runs only against the SANDBOX account in demo mode. Scanning real
// accounts would mean logging in to platforms, which Reclaim never does.
// Input is post TEXT only — the payload has no field that could carry an image.
export async function POST(req: Request) {
  if (!isDemoMode()) return Response.json({ error: "Live detection runs in the demo sandbox only." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { post?: PostText; context?: DetectContext } | null;
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
  return Response.json(await detectPost(post, context), { headers: { "Cache-Control": "no-store" } });
}
