import { describe, expect, it } from "vitest";
import { SANDBOX_ACCOUNT } from "@/data/sandbox";
import { addDetectedLinks, combineLevels, detectContext, ruleLevel, ruleSignals } from "@/lib/detect";
import { detectPost } from "@/lib/detectAgent";
import { createDemoCase } from "@/lib/seed";
import { SECTION } from "@/lib/templates";

const NOW = Date.parse("2026-09-25T18:00:00.000Z");
const c = createDemoCase(NOW);
const ctx = detectContext(c);
const TRUTH: Record<string, string> = { Cq7Lx2aPq1: "likely", Cq5Rz1cHy7: "likely", Cq3Jb9eQs5: "likely", Cq1Gw7gXr3: "possible", Cq0Fs2hZn6: "possible" };

describe("live detection: rules on the synthetic sandbox", () => {
  it.each(SANDBOX_ACCOUNT.posts.map((p) => [p.id, p] as const))("%s", (id, post) => {
    expect(ruleLevel(ruleSignals(post, ctx))).toBe(TRUTH[id] ?? "unrelated");
  });

  it("sandbox posts carry text only — there is no field that could hold an image", () => {
    for (const p of SANDBOX_ACCOUNT.posts) expect(Object.keys(p).sort()).toEqual(["caption", "comments", "id", "kind", "postedAt", "url"]);
  });
});

describe("the model can't escalate without evidence", () => {
  it("never turns an unrelated post into likely, never lowers evidence", () => {
    expect(combineLevels("unrelated", "likely")).toBe("possible");
    expect(combineLevels("unrelated", "unrelated")).toBe("unrelated");
    expect(combineLevels("likely", "unrelated")).toBe("likely");
    expect(combineLevels("possible", "likely")).toBe("possible");
  });

  it("falls back to rules when Gemini is unavailable", async () => {
    const d = await detectPost(SANDBOX_ACCOUNT.posts[0], ctx, async () => {
      throw new Error("503");
    });
    expect(d).toMatchObject({ level: "likely", source: "rules" });
  });
});

describe("confirmed matches", () => {
  it("become ONE drafted Instagram request with every URL and all required elements — not sent", () => {
    const picks = SANDBOX_ACCOUNT.posts.filter((p) => TRUTH[p.id] === "likely");
    const { next, requests } = addDetectedLinks(c, picks.map((p) => ({ url: p.url, caption: p.caption })), new Date(NOW).toISOString());
    expect(requests).toHaveLength(1);
    const r = requests[0];
    expect(r).toMatchObject({ platformName: "Instagram", status: "ready" });
    for (const p of picks) expect(r.body).toContain(p.url);
    for (const s of [SECTION.identification, SECTION.goodFaith, SECTION.obligation, SECTION.contact, SECTION.signature]) expect(r.body).toContain(s);
    expect(next.evidence.filter((e) => e.note?.includes("live detection"))).toHaveLength(3);
    for (const p of picks) expect(next.evidence.filter((e) => e.url === p.url), "one evidence entry per detected post").toHaveLength(1);
    expect(addDetectedLinks(next, picks.map((p) => ({ url: p.url, caption: p.caption })), new Date(NOW).toISOString()).requests).toHaveLength(0);
  });
});
