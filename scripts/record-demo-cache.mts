// Records live Gemini answers for the fictional demo case into data/demoCache.json, so the
// demo runs even if Gemini is slow or unreachable. Re-run after changing prompts:
//   npx tsx scripts/record-demo-cache.mts
import { readFileSync, writeFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
process.env.GEMINI_API_KEY = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();

const { SANDBOX_ACCOUNT } = await import("../data/sandbox.ts");
const { draftOpenings } = await import("../lib/draft.ts");
const { detectPost } = await import("../lib/detectAgent.ts");
const { detectContext } = await import("../lib/detect.ts");
const { draftFollowUpText } = await import("../lib/followups.ts");
const { createDemoCase } = await import("../lib/seed.ts");
const { simulatePlatformResponses } = await import("../lib/demo.ts");
const { timelineFacts } = await import("../lib/escalation.ts");

const now = Date.now();
const c = createDemoCase(now);

const targets = [
  ...c.requests.map((r) => ({ platformId: r.platformId, platformName: r.platformName, kind: r.kind })),
  { platformId: "instagram", platformName: "Instagram", kind: "takedown" as const },
];
const openings = await draftOpenings(targets);
if (openings.source !== "gemini" || Object.keys(openings.openings).length !== targets.length) throw new Error("Greetings incomplete — is Gemini reachable?");

const ctx = detectContext(c);
const detections = Object.fromEntries(
  (await Promise.all(SANDBOX_ACCOUNT.posts.map((p) => detectPost(p, ctx)))).map((d) => {
    if (d.source !== "gemini") throw new Error(`Detection fell back to rules for ${d.postId}`);
    return [d.postId, d];
  }),
);

const sim = simulatePlatformResponses(c, now);
const byId = (id: string) => sim.requests.find((r) => r.platformId === id)!;
const ftc = await draftFollowUpText("ftc", timelineFacts(sim, byId("x"), now));
const reminders: Record<string, string> = {};
for (const [id, h] of [["x", 24], ["x", 44], ["google-search", 24], ["imgvault", 24], ["instagram", 24]] as const) {
  const r = byId(id) ?? { ...byId("x"), platformName: "Instagram", platformId: "instagram" };
  const out = await draftFollowUpText("reminder", timelineFacts(sim, r, now, h));
  if (out.source === "gemini") reminders[`${r.platformName}:${h}`] = out.text;
}
if (ftc.source !== "gemini") throw new Error("FTC summary fell back to template");

const cache = {
  note: "Recorded live Gemini output for the fictional demo case. Used only in DEMO_MODE, when Gemini is slow or unreachable, or when the presenter picks cached responses.",
  recordedAt: new Date().toISOString(),
  openings: openings.openings,
  detections,
  ftcSummary: { X: ftc.text },
  reminders,
};
writeFileSync("data/demoCache.json", JSON.stringify(cache, null, 2) + "\n");
console.log(`Recorded ${Object.keys(cache.openings).length} greetings, ${Object.keys(detections).length} detections, FTC summary, ${Object.keys(reminders).length} reminder lines.`);
console.log("FTC:", ftc.text);
