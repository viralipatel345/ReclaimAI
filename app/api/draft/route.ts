import { draftOpenings, type OpeningTarget } from "@/lib/draft";

// Receives platform names only — never the user's name, email or links.
export async function POST(req: Request) {
  const { targets } = (await req.json().catch(() => ({}))) as { targets?: OpeningTarget[] };
  if (!Array.isArray(targets) || targets.length === 0 || targets.length > 20) {
    return Response.json({ error: "targets must be a non-empty array" }, { status: 400 });
  }
  const clean = targets.map((t) => ({
    platformId: String(t.platformId).slice(0, 80),
    platformName: String(t.platformName).slice(0, 60),
    kind: t.kind === "google_removal" || t.kind === "refile" ? t.kind : ("takedown" as const),
  }));
  return Response.json(await draftOpenings(clean), { headers: { "Cache-Control": "no-store" } });
}
