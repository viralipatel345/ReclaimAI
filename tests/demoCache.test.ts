import { afterEach, describe, expect, it, vi } from "vitest";
import { SANDBOX_ACCOUNT } from "@/data/sandbox";
import { cachedDetection, cachedFollowUp, cachedOpening, DEMO_CACHE, withTimeout } from "@/lib/demoCache";
import { createDemoCase } from "@/lib/seed";
import { sanitizeOpening } from "@/lib/templates";

const TRUTH: Record<string, string> = { Cq7Lx2aPq1: "likely", Cq5Rz1cHy7: "likely", Cq3Jb9eQs5: "likely", Cq1Gw7gXr3: "possible", Cq0Fs2hZn6: "possible" };

describe("recorded demo cache", () => {
  it("covers every greeting the demo drafts", () => {
    const platforms = [...createDemoCase().requests.map((r) => r.platformId), "instagram"];
    for (const id of platforms) expect(cachedOpening(id), id).toBeTruthy();
  });

  it("greetings are already clean (sanitizing changes nothing)", () => {
    for (const [id, text] of Object.entries(DEMO_CACHE.openings)) expect(sanitizeOpening(text, id)).toBe(text);
  });

  it("has a verdict for every sandbox post, matching ground truth", () => {
    for (const p of SANDBOX_ACCOUNT.posts) expect(cachedDetection(p.id)?.level, p.id).toBe(TRUTH[p.id] ?? "unrelated");
  });

  it("has the FTC summary and reminder lines, with no stale dates, names or links", () => {
    const texts = [cachedFollowUp("ftc", "X")!, cachedFollowUp("reminder", "X", 24)!, cachedFollowUp("reminder", "X", 44)!];
    for (const t of texts) {
      expect(t).toBeTruthy();
      expect(t).not.toMatch(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b|\b20\d\d\b/);
      expect(t).not.toMatch(/Jordan|Ellis|https?:|@/);
    }
  });
});

describe("timeouts", () => {
  it("withTimeout rejects a hung promise", async () => {
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow(/Timed out/);
    await expect(withTimeout(Promise.resolve(1), 20)).resolves.toBe(1);
  });
});

describe("routes in demo mode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("draft serves the cache when the presenter prefers it (no Gemini call)", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    const { POST } = await import("@/app/api/draft/route");
    const res = await POST(new Request("http://x/api/draft", { method: "POST", body: JSON.stringify({ preferCache: true, targets: [{ platformId: "reddit", platformName: "Reddit", kind: "takedown" }] }) }));
    const out = await res.json();
    expect(out).toMatchObject({ source: "cached", openings: { reddit: cachedOpening("reddit") } });
  });

  it("detect falls back to the recorded verdict when Gemini is unavailable", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    const { POST } = await import("@/app/api/detect/route");
    const p = SANDBOX_ACCOUNT.posts[2];
    const res = await POST(
      new Request("http://x/api/detect", {
        method: "POST",
        body: JSON.stringify({ post: p, context: { legalName: "Jordan Ellis", knownUrls: [], platformNames: ["Reddit"] } }),
      }),
    );
    expect(await res.json()).toMatchObject({ postId: p.id, level: "likely", source: "cached" });
  });
});
