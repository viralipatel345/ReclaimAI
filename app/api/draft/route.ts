import { isDemoMode } from "@/lib/config";
import { cachedOpening, SERVER_AI_TIMEOUT_MS, withTimeout } from "@/lib/demoCache";
import { draftOpenings, type OpeningsResult, type OpeningTarget } from "@/lib/draft";

// Receives platform names only — never the user's name, email or links.
export async function POST(req: Request) {
  const { targets, preferCache } = (await req.json().catch(() => ({}))) as { targets?: OpeningTarget[]; preferCache?: boolean };
  if (!Array.isArray(targets) || targets.length === 0 || targets.length > 20) {
    return Response.json({ error: "targets must be a non-empty array" }, { status: 400 });
  }
  const clean = targets.map((t) => ({
    platformId: String(t.platformId).slice(0, 80),
    platformName: String(t.platformName).slice(0, 60),
    kind: t.kind === "google_removal" || t.kind === "refile" ? t.kind : ("takedown" as const),
  }));
  const demo = isDemoMode();

  let result: OpeningsResult = { openings: {}, source: "template" };
  if (!(demo && preferCache)) {
    try {
      result = await withTimeout(draftOpenings(clean), SERVER_AI_TIMEOUT_MS);
    } catch {
      // timed out: fall through to cache/template
    }
  }
  // Demo: fill anything Gemini didn't answer from the recorded cache.
  if (demo) {
    let used = false;
    for (const t of clean) {
      if (!result.openings[t.platformId] && cachedOpening(t.platformId)) {
        result.openings[t.platformId] = cachedOpening(t.platformId)!;
        used = true;
      }
    }
    if (used && result.source !== "gemini") result = { ...result, source: "cached" };
  }
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
