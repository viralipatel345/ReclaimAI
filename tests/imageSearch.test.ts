import { describe, expect, it, vi } from "vitest";
import { classifyMatch, FIXTURE_DETECTION, reverseImageSearch, toMatches } from "@/lib/incident/imageSearch";
import { runImageSearch } from "@/lib/incident/ops";
import type { IncidentStore } from "@/lib/incident/store";
import type { CaseReport } from "@/lib/incident/types";

describe("classifyMatch", () => {
  it("flags leak / explicit signals in the host or title as shady", () => {
    expect(classifyMatch("https://leakhub-mirror.example/g/1", "Jane leaked").risk).toBe("shady");
    expect(classifyMatch("https://fapboard.to/t/1").reasons).toEqual(["domain name suggests leaked or explicit content", "domain extension is common on low-accountability sites"]);
    expect(classifyMatch("https://ordinary.example/p/1", "Nudes — free download").risk).toBe("shady");
  });

  it("treats directory platforms as normal and names the removal channel", () => {
    const x = classifyMatch("https://x.com/a/status/1", "a on X");
    expect(x).toMatchObject({ risk: "normal", platformName: "X", coveredByAct: true });
    expect(x.reasons[0]).toMatch(/official removal channel/);
  });

  it("keeps an adult platform shady but notes it has a removal channel", () => {
    const r = classifyMatch("https://www.pornhub.com/view_video.php?viewkey=1");
    expect(r.risk).toBe("shady");
    expect(r.reasons).toContain("Pornhub has a TAKE IT DOWN removal channel");
  });

  it("is unknown for unfamiliar hosts with no signals", () => {
    expect(classifyMatch("https://pixelpin.example/pin/1", "Summer portrait ideas")).toMatchObject({ risk: "unknown", reasons: ["unfamiliar site; page looks like ordinary content"] });
  });
});

describe("toMatches", () => {
  it("maps Vision pages + similar images, dedupes, and orders shady → unknown → normal, full → partial → similar", () => {
    const m = toMatches(FIXTURE_DETECTION, "2026-09-25T12:00:00.000Z");
    expect(m.map((x) => `${x.risk}/${x.matchType}/${x.host}`)).toEqual([
      "shady/full/leakhub-mirror.example",
      "shady/partial/fapboard.to",
      "unknown/similar/pixelpin.example",
      "normal/full/imgvault.example",
      "normal/partial/x.com",
    ]);
    expect(m[0].url).toBe("https://cdn.leakhub-mirror.example/f/9f2a.jpg");
    expect(m[3].platformName).toBe("ImgVault");
  });
});

describe("reverseImageSearch", () => {
  it("uses the fixture in demo mode without a Vision key, and refuses outside demo", async () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const s = await reverseImageSearch(buf, "ast_1", { demo: true });
    expect(s.provider).toBe("fixture");
    expect(s.labels).toEqual(["portrait"]);
    expect(s.matches).toHaveLength(5);
    await expect(reverseImageSearch(buf, "ast_1", { demo: false })).rejects.toThrow(/GOOGLE_VISION_API_KEY/);
  });

  it("calls Vision Web Detection with the image when a key is set", async () => {
    vi.stubEnv("GOOGLE_VISION_API_KEY", "k");
    try {
      const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { requests: { image: { content: string }; features: { type: string }[] }[] };
        expect(body.requests[0].features[0].type).toBe("WEB_DETECTION");
        expect(Buffer.from(body.requests[0].image.content, "base64")).toEqual(Buffer.from("img"));
        return new Response(JSON.stringify({ responses: [{ webDetection: { pagesWithMatchingImages: [{ url: "https://x.com/u/status/9", pageTitle: "u on X", fullMatchingImages: [{ url: "https://pbs/9.jpg" }] }] } }] }));
      }) as unknown as typeof fetch;
      const s = await reverseImageSearch(Buffer.from("img"), "ast_1", { fetchImpl });
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(String((fetchImpl as unknown as { mock: { calls: [unknown][] } }).mock.calls[0][0])).toContain("key=k");
      expect(s.provider).toBe("vision");
      expect(s.matches[0]).toMatchObject({ pageUrl: "https://x.com/u/status/9", matchType: "full", risk: "normal" });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("runImageSearch", () => {
  function memStore(): IncidentStore {
    const map = new Map<string, CaseReport>();
    return {
      async get(id) {
        return map.get(id) ?? null;
      },
      async save(c) {
        map.set(c.id, structuredClone(c));
      },
      async delete(id) {
        map.delete(id);
      },
      async listByUser(u) {
        return [...map.values()].filter((c) => c.userId === u);
      },
    };
  }
  const at = "2026-09-25T12:00:00.000Z";
  const draft: CaseReport = { id: "case_s", userId: "u", branch: "IMAGE_SEARCH", status: "DRAFT", title: "Where is my image?", notes: "", isDraft: true, assets: [], verifications: [], escalations: [], reports: [], events: [], createdAt: at, updatedAt: at };

  it("scans provenance, records the search, and mirrors matches into scrape so Gemini and notices see them", async () => {
    const c = await runImageSearch(draft, { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimeType: "image/jpeg" }, memStore(), { demo: true });
    expect(c.assets).toHaveLength(1);
    expect(c.verifications[0].verdict).toBe("inconclusive");
    expect(c.imageSearch?.assetId).toBe(c.assets[0].id);
    expect(c.imageSearch?.matches).toHaveLength(5);
    expect(c.scrape?.sources.map((s) => s.url)).toEqual(c.imageSearch?.matches.map((m) => m.pageUrl));
    expect(c.scrape?.sources[0].snippet).toMatch(/^shady · full match/);
    expect(c.status).toBe("SCANNING");
    expect(c.events[0].text).toBe("Found your image on 5 pages: 2 shady, 2 known platforms, 1 unfamiliar (demo fixture).");
  });
});
