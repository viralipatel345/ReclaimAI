import { describe, expect, it, vi } from "vitest";
import { checkPostImage, findInstagramPosts, NoPublicFigureError, postsPrompt, searchInstagramForFigure, type Gen } from "@/lib/incident/instagramSearch";
import { combineAiLook } from "@/lib/provenance/aiLook";
import { extractOgImage } from "@/lib/provenance/fetchImage";

const AT = "2026-09-25T12:00:00.000Z";

describe("findInstagramPosts", () => {
  const groundedGen = (text: string, chunks: { uri: string; title: string }[]): Gen => async () => ({
    response: { text, candidates: [{ groundingMetadata: { groundingChunks: chunks.map((c) => ({ web: c })) } }] },
    model: "test",
  });

  it("asks a Google-Search-grounded model and keeps only instagram.com URLs that came from search", async () => {
    const gen = vi.fn(
      groundedGen('{"posts":[{"url":"https://www.instagram.com/p/AAA/","title":"fan page","why":"account says AI edits"},{"url":"https://www.instagram.com/p/HALLUCINATED/","title":"x"}]}', [
        { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "Star (@star.ai.edits) • Instagram" },
        { uri: "https://www.instagram.com/p/AAA/?igsh=1", title: "fan page" },
        { uri: "https://www.tiktok.com/@x", title: "not instagram" },
      ]),
    );
    const fetchImpl = vi.fn(async (url: unknown) => ({ url: String(url).includes("grounding-api-redirect") ? "https://www.instagram.com/star.ai.edits/" : String(url) })) as unknown as typeof fetch;
    const posts = await findInstagramPosts("Some Star", { gen, fetchImpl });
    expect(gen.mock.calls[0][0].contents).toBe(postsPrompt("Some Star"));
    expect((gen.mock.calls[0][0].config as { tools: unknown[] }).tools).toEqual([{ googleSearch: {} }]);
    expect(posts.map((p) => p.url).sort()).toEqual(["https://www.instagram.com/p/AAA/", "https://www.instagram.com/star.ai.edits/"]);
    expect(posts.find((p) => p.url.endsWith("/p/AAA/"))).toMatchObject({ why: "account says AI edits", unverified: false });
    expect(posts.some((p) => p.url.includes("HALLUCINATED"))).toBe(false);
  });

  it("falls back to model-written URLs, marked unverified, only when search returned nothing", async () => {
    const posts = await findInstagramPosts("Some Star", { gen: groundedGen('{"posts":[{"url":"https://instagram.com/p/BBB","title":"t"}]}', []), fetchImpl: fetch });
    expect(posts).toEqual([{ url: "https://www.instagram.com/p/BBB/", title: "t", why: undefined, unverified: true }]);
  });
});

describe("AI look", () => {
  it("provenance overrides the visual heuristic; otherwise thresholds decide", () => {
    expect(combineAiLook({ verdict: "ai_generated", summary: "C2PA says Firefly" }, { likelihood: 0.1, signs: [], summary: "", model: "m" })).toMatchObject({ verdict: "ai_generated", confidence: 1, source: "provenance+gemini" });
    expect(combineAiLook(null, { likelihood: 0.82, signs: ["six fingers"], summary: "", model: "m" })).toMatchObject({ verdict: "ai_generated", confidence: 0.82, signs: ["six fingers"], source: "gemini-vision" });
    expect(combineAiLook(null, { likelihood: 0.5, signs: [], summary: "some smoothing", model: "m" })).toMatchObject({ verdict: "likely_ai", signs: ["some smoothing"] });
    expect(combineAiLook(null, { likelihood: 0.1, signs: [], summary: "", model: "m" }).verdict).toBe("no_signal");
    expect(combineAiLook(null, null)).toMatchObject({ verdict: "unchecked", source: "none" });
  });

  it("extracts og:image in either attribute order and resolves relative URLs", () => {
    expect(extractOgImage('<meta property="og:image" content="https://cdn.example/a.jpg?x=1&amp;y=2">', "https://www.instagram.com/p/1/")).toBe("https://cdn.example/a.jpg?x=1&y=2");
    expect(extractOgImage('<meta content="/img/b.jpg" property="og:image">', "https://site.example/p")).toBe("https://site.example/img/b.jpg");
    expect(extractOgImage("<html></html>", "https://site.example/")).toBeNull();
  });

  it("checkPostImage reports unchecked when the image can't be fetched, and runs the look otherwise", async () => {
    const none = await checkPostImage("https://www.instagram.com/p/1/", { fetchImage: async () => ({ page: "unreachable", image: null }) });
    expect(none).toMatchObject({ reachable: false, ai: { verdict: "unchecked", source: "none", signs: ["page not reachable"] } });
    const walled = await checkPostImage("https://www.instagram.com/p/1/", { fetchImage: async () => ({ page: "ok", image: null }) });
    expect(walled).toMatchObject({ reachable: true, ai: { verdict: "unchecked", signs: ["post image not exposed without login"] } });

    const r = await checkPostImage("https://www.instagram.com/p/2/", {
      fetchImage: async () => ({ page: "ok", image: { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimeType: "image/jpeg", imageUrl: "https://cdn/2.jpg" } }),
      aiLook: async () => ({ likelihood: 0.9, signs: ["garbled text on jersey"], summary: "", model: "m" }),
    });
    expect(r).toMatchObject({ imageUrl: "https://cdn/2.jpg", reachable: true });
    expect(r.ai).toMatchObject({ verdict: "ai_generated", confidence: 0.9, signs: ["garbled text on jersey"], source: "gemini-vision" });
  });
});

describe("searchInstagramForFigure", () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  it("refuses when no public figure is recognised and no name is typed", async () => {
    await expect(searchInstagramForFigure(buf, "image/jpeg", "ast", { deps: { identify: async () => ({ name: null, confidence: 0.2, description: "" }) } })).rejects.toBeInstanceOf(NoPublicFigureError);
  });

  it("uses the typed name, finds posts, checks each image, and ranks AI-generated first", async () => {
    const identify = vi.fn();
    const s = await searchInstagramForFigure(buf, "image/jpeg", "ast", {
      subjectName: "Some Star",
      clock: () => AT,
      deps: {
        identify,
        findPosts: async (name) => {
          expect(name).toBe("Some Star");
          return [
            { url: "https://www.instagram.com/somestar/", title: "Some Star (@somestar) • Instagram", unverified: false },
            { url: "https://www.instagram.com/p/AI1/", title: "star.ai.edits on Instagram: “made with midjourney”", why: "account says AI edits", unverified: false },
            { url: "https://www.instagram.com/p/UNK/", title: "fanpage on Instagram: “love her”", unverified: false },
          ];
        },
        checkImage: async (url) =>
          url.includes("AI1")
            ? { ai: { verdict: "ai_generated", confidence: 0.88, signs: ["extra finger", "garbled logo"], source: "gemini-vision" }, imageUrl: "https://cdn/ai1.jpg", reachable: true }
            : url.includes("UNK")
              ? { ai: { verdict: "unchecked", confidence: 0, signs: ["page not reachable"], source: "none" }, reachable: false }
              : { ai: { verdict: "no_signal", confidence: 0.05, signs: [], source: "gemini-vision" }, imageUrl: "https://cdn/star.jpg", reachable: true },
      },
    });
    expect(identify).not.toHaveBeenCalled();
    expect(s).toMatchObject({ provider: "gemini", scope: "instagram", subject: { name: "Some Star", source: "user", confidence: 1 } });
    expect(s.matches.map((m) => m.handle)).toEqual(["star.ai.edits", "somestar", "fanpage"]);
    const ai = s.matches[0];
    expect(ai).toMatchObject({ risk: "shady", flagged: true, url: "https://cdn/ai1.jpg", matchType: "full" });
    expect(ai.reasons[0]).toBe("looks AI-generated (88%): extra finger; garbled logo");
    expect(ai.reasons).toContain("account says AI edits");
    expect(s.matches[1]).toMatchObject({ risk: "normal", flagged: true });
    expect(s.matches[1].reasons[0]).toBe("post uses Some Star's likeness");
    expect(s.matches[2]).toMatchObject({ matchType: "similar" });
    expect(s.matches[2].ai?.verdict).toBe("unchecked");
  });
});
