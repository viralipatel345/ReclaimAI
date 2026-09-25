import { describe, expect, it, vi } from "vitest";
import { checkPostImage, findPosts, NoPublicFigureError, postsPrompt, searchForFigure, type Gen } from "@/lib/incident/instagramSearch";
import type { AiLook } from "@/lib/incident/types";
import { combineAiLook } from "@/lib/provenance/aiLook";
import { extractOgImage } from "@/lib/provenance/fetchImage";
import { parsePrediction, requestBody } from "@/lib/provenance/synthid";

const AT = "2026-09-25T12:00:00.000Z";
const noSynth = async () => null;

describe("findPosts", () => {
  const groundedGen = (text: string, chunks: { uri: string; title: string }[]): Gen => async () => ({
    response: { text, candidates: [{ groundingMetadata: { groundingChunks: chunks.map((c) => ({ web: c })) } }] },
    model: "test",
  });

  it("asks a Google-Search-grounded model; web scope keeps any http page that came from search", async () => {
    const gen = vi.fn(
      groundedGen('{"posts":[{"url":"https://www.instagram.com/p/AAA/","title":"fan page","why":"account says AI edits"},{"url":"https://www.reddit.com/r/x/HALLUCINATED","title":"x"}]}', [
        { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "Star (@star.ai.edits) • Instagram" },
        { uri: "https://www.instagram.com/p/AAA/?igsh=1", title: "fan page" },
        { uri: "https://www.reddit.com/r/deepfakes/comments/1/", title: "reddit thread" },
      ]),
    );
    const fetchImpl = vi.fn(async (url: unknown) => ({ url: String(url).includes("grounding-api-redirect") ? "https://www.instagram.com/star.ai.edits/" : String(url) })) as unknown as typeof fetch;
    const posts = await findPosts("Some Star", "web", { gen, fetchImpl });
    expect(gen.mock.calls[0][0].contents).toBe(postsPrompt("Some Star", "web"));
    expect((gen.mock.calls[0][0].config as { tools: unknown[] }).tools).toEqual([{ googleSearch: {} }]);
    expect(posts.map((p) => p.url).sort()).toEqual(["https://www.instagram.com/p/AAA/", "https://www.instagram.com/star.ai.edits/", "https://www.reddit.com/r/deepfakes/comments/1/"]);
    expect(posts.find((p) => p.url.endsWith("/p/AAA/"))).toMatchObject({ why: "account says AI edits", unverified: false });
    expect(posts.some((p) => p.url.includes("HALLUCINATED"))).toBe(false);
  });

  it("instagram scope drops other hosts; model-written URLs are kept (unverified) only when search returned nothing", async () => {
    const ig = await findPosts("Some Star", "instagram", { gen: groundedGen("{}", [{ uri: "https://www.reddit.com/r/x/", title: "r" }, { uri: "https://instagram.com/p/CCC", title: "c" }]), fetchImpl: fetch });
    expect(ig.map((p) => p.url)).toEqual(["https://www.instagram.com/p/CCC/"]);
    const posts = await findPosts("Some Star", "web", { gen: groundedGen('{"posts":[{"url":"https://instagram.com/p/BBB","title":"t"}]}', []), fetchImpl: fetch });
    expect(posts).toEqual([{ url: "https://www.instagram.com/p/BBB/", title: "t", why: undefined, unverified: true }]);
  });
});

describe("SynthID via Vertex", () => {
  it("uses the image-verification request shape and reads ACCEPT/REJECT decisions", () => {
    const ep = "https://us-central1-aiplatform.googleapis.com/v1/projects/p/locations/us-central1/publishers/google/models/imageverification@001:predict";
    expect(JSON.parse(requestBody(ep, Buffer.from("img"), "image/png"))).toEqual({ instances: [{ image: { bytesBase64Encoded: Buffer.from("img").toString("base64") } }] });
    expect(JSON.parse(requestBody("https://custom/predict", Buffer.from("img"), "image/png"))).toEqual({ instances: [{ content: { bytesBase64Encoded: Buffer.from("img").toString("base64"), mimeType: "image/png" } }] });
    expect(parsePrediction({ decision: "ACCEPT" }, "image", AT)).toMatchObject({ isGoogleAiGenerated: true, synthIdConfidence: 1, source: "vertex" });
    expect(parsePrediction({ decision: "REJECT" }, "image", AT)).toMatchObject({ isGoogleAiGenerated: false, synthIdConfidence: 0, source: "vertex" });
  });
});

describe("AI look", () => {
  it("SynthID and provenance override the visual heuristic; otherwise thresholds decide", () => {
    expect(combineAiLook(null, { likelihood: 0.1, signs: [], summary: "", model: "m" }, "detected")).toMatchObject({ verdict: "ai_generated", confidence: 1, synthId: "detected", source: "provenance+gemini" });
    expect(combineAiLook(null, { likelihood: 0.1, signs: [], summary: "", model: "m" }, "detected").signs[0]).toMatch(/SynthID watermark detected/);
    expect(combineAiLook({ verdict: "ai_generated", summary: "C2PA says Firefly" }, { likelihood: 0.1, signs: [], summary: "", model: "m" }, "not_detected")).toMatchObject({ verdict: "ai_generated", confidence: 1, source: "provenance+gemini" });
    expect(combineAiLook(null, { likelihood: 0.82, signs: ["six fingers"], summary: "", model: "m" })).toMatchObject({ verdict: "ai_generated", confidence: 0.82, signs: ["six fingers"], source: "gemini-vision", synthId: "unavailable" });
    expect(combineAiLook(null, { likelihood: 0.5, signs: [], summary: "some smoothing", model: "m" })).toMatchObject({ verdict: "likely_ai", signs: ["some smoothing"] });
    expect(combineAiLook(null, { likelihood: 0.1, signs: [], summary: "", model: "m" }).verdict).toBe("no_signal");
    expect(combineAiLook(null, null)).toMatchObject({ verdict: "unchecked", source: "none" });
  });

  it("extracts og:image in either attribute order and resolves relative URLs", () => {
    expect(extractOgImage('<meta property="og:image" content="https://cdn.example/a.jpg?x=1&amp;y=2">', "https://www.instagram.com/p/1/")).toBe("https://cdn.example/a.jpg?x=1&y=2");
    expect(extractOgImage('<meta content="/img/b.jpg" property="og:image">', "https://site.example/p")).toBe("https://site.example/img/b.jpg");
    expect(extractOgImage("<html></html>", "https://site.example/")).toBeNull();
  });

  it("checkPostImage reports unchecked when the image can't be fetched, and runs SynthID + the look otherwise", async () => {
    const none = await checkPostImage("https://www.instagram.com/p/1/", { fetchImage: async () => ({ page: "unreachable", image: null }), synthId: null });
    expect(none).toMatchObject({ reachable: false, ai: { verdict: "unchecked", source: "none", signs: ["page not reachable"] } });

    const detect = vi.fn(async () => ({ isGoogleAiGenerated: true, synthIdConfidence: 1, modality: "image" as const, source: "vertex" as const, checkedAt: AT }));
    const r = await checkPostImage("https://www.instagram.com/p/2/", {
      fetchImage: async () => ({ page: "ok", image: { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimeType: "image/jpeg", imageUrl: "https://cdn/2.jpg" } }),
      aiLook: async () => ({ likelihood: 0.2, signs: [], summary: "", model: "m" }),
      synthId: { endpoint: "https://x/imageverification@001:predict", accessToken: "t" },
      detect,
    });
    expect(detect).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ imageUrl: "https://cdn/2.jpg", reachable: true, ai: { verdict: "ai_generated", synthId: "detected", confidence: 1 } });
  });
});

describe("searchForFigure", () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const look = (verdict: AiLook["verdict"], confidence: number, signs: string[] = [], synthId: AiLook["synthId"] = "not_detected"): AiLook => ({ verdict, confidence, signs, source: "gemini-vision", synthId });

  it("refuses when no public figure is recognised and no name is typed", async () => {
    await expect(searchForFigure(buf, "image/jpeg", "ast", { deps: { identify: async () => ({ name: null, confidence: 0.2, description: "" }), synthIdConfig: noSynth } })).rejects.toBeInstanceOf(NoPublicFigureError);
  });

  it("uses the typed name, searches the whole web, keeps only AI-flagged images, ranks strongest first, and reports counts", async () => {
    const identify = vi.fn();
    const s = await searchForFigure(buf, "image/jpeg", "ast", {
      subjectName: "Some Star",
      clock: () => AT,
      deps: {
        identify,
        synthIdConfig: async () => ({ endpoint: "https://x/imageverification@001:predict", accessToken: "t" }),
        findPosts: async (name, scope) => {
          expect(name).toBe("Some Star");
          expect(scope).toBe("web");
          return [
            { url: "https://www.instagram.com/somestar/", title: "Some Star (@somestar) • Instagram", unverified: false },
            { url: "https://www.instagram.com/p/AI1/", title: "star.ai.edits on Instagram: “made with midjourney”", why: "account says AI edits", unverified: false },
            { url: "https://www.reddit.com/r/deepfakes/comments/9/", title: "AI Some Star set", unverified: false },
            { url: "https://www.instagram.com/p/UNK/", title: "fanpage on Instagram: “love her”", unverified: false },
          ];
        },
        checkImage: async (url) =>
          url.includes("AI1")
            ? { ai: look("likely_ai", 0.62, ["extra finger"]), imageUrl: "https://cdn/ai1.jpg", reachable: true }
            : url.includes("reddit")
              ? { ai: look("ai_generated", 1, ["SynthID watermark detected — made with a Google AI model"], "detected"), imageUrl: "https://cdn/r9.jpg", reachable: true }
              : url.includes("UNK")
                ? { ai: { verdict: "unchecked", confidence: 0, signs: ["page not reachable"], source: "none", synthId: "unavailable" }, reachable: false }
                : { ai: look("no_signal", 0.05), imageUrl: "https://cdn/star.jpg", reachable: true },
      },
    });
    expect(identify).not.toHaveBeenCalled();
    expect(s).toMatchObject({ provider: "gemini", scope: "web", onlyAi: true, considered: 4, checked: 3, synthIdActive: true, subject: { name: "Some Star", source: "user" } });
    // synthIdActive is true because one check reported a SynthID answer ("detected")
    expect(s.matches.map((m) => m.host)).toEqual(["reddit.com", "instagram.com"]);
    expect(s.matches[0]).toMatchObject({ risk: "shady", flagged: true, url: "https://cdn/r9.jpg", ai: { synthId: "detected" } });
    expect(s.matches[0].reasons[0]).toBe("AI-generated (100%): SynthID watermark detected — made with a Google AI model");
    expect(s.matches[1].reasons).toEqual(expect.arrayContaining(["possibly AI-generated (62%): extra finger", "no SynthID watermark — not made with a Google model", "account says AI edits"]));
    expect(s.matches[1].handle).toBe("star.ai.edits");
  });
});
