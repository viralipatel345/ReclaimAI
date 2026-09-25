import { describe, expect, it, vi } from "vitest";
import { classifyInstagram, classifyMatch, FIXTURE_INSTAGRAM, FIXTURE_WEB, instagramHandle, looksLikeImpersonation, reverseImageSearch, toMatches } from "@/lib/incident/imageSearch";
import { runImageSearch } from "@/lib/incident/ops";
import type { IncidentStore } from "@/lib/incident/store";
import type { CaseReport } from "@/lib/incident/types";

const AT = "2026-09-25T12:00:00.000Z";

describe("Instagram scope", () => {
  it("extracts the account handle from titles and profile URLs", () => {
    expect(instagramHandle("https://www.instagram.com/p/C8x/", "jane.d.leaks on Instagram: “full set”")).toBe("jane.d.leaks");
    expect(instagramHandle("https://www.instagram.com/jane_doe_official_/", "Jane Doe (@jane_doe_official_) • Instagram photos and videos")).toBe("jane_doe_official_");
    expect(instagramHandle("https://www.instagram.com/some_account/")).toBe("some_account");
    expect(instagramHandle("https://www.instagram.com/reel/C9a/")).toBeUndefined();
  });

  it("detects impersonation when the handle reuses the reporter's name", () => {
    expect(looksLikeImpersonation("Jane Doe", "jane_doe_official_")).toBe(true);
    expect(looksLikeImpersonation("Jane Doe", "citymoments.photo", "golden hour portraits")).toBe(false);
    expect(looksLikeImpersonation(undefined, "jane_doe")).toBe(false);
  });

  it("flags every Instagram hit, marking leak and impersonation signals as shady", () => {
    const leak = classifyInstagram("https://www.instagram.com/p/C8x/", "jane.d.leaks on Instagram: “full set in bio 🔥”", "Jane Doe");
    expect(leak).toMatchObject({ risk: "shady", flagged: true, handle: "jane.d.leaks", platformName: "Instagram", coveredByAct: true });
    expect(leak.reasons[0]).toBe("account name or caption suggests leaked content");

    const fake = classifyInstagram("https://www.instagram.com/jane_doe_official_/", "Jane Doe (@jane_doe_official_) • Instagram photos and videos", "Jane Doe");
    expect(fake.risk).toBe("shady");
    expect(fake.reasons).toContain("profile uses your name — possible impersonation");

    const plain = classifyInstagram("https://www.instagram.com/p/C7m/", "citymoments.photo on Instagram: “golden hour portraits”", "Jane Doe");
    expect(plain).toMatchObject({ risk: "normal", flagged: true });
    expect(plain.reasons).toEqual(["your image is on this account — confirm it isn't yours", "Instagram is a covered platform with an official removal form"]);
  });

  it("keeps only Instagram pages, ignores similar images, and orders shady first", () => {
    const m = toMatches(FIXTURE_INSTAGRAM, AT, "instagram", "Jane Doe");
    expect(m.every((x) => x.host.endsWith("instagram.com") && x.flagged)).toBe(true);
    expect(m.map((x) => `${x.risk}/${x.matchType}/${x.handle}`)).toEqual([
      "shady/full/jane.d.leaks",
      "shady/full/jane_doe_official_",
      "shady/partial/exposed.archive",
      "normal/partial/citymoments.photo",
    ]);
  });
});

describe("web scope", () => {
  it("flags leak / explicit signals in the host or title as shady", () => {
    expect(classifyMatch("https://leakhub-mirror.example/g/1", "Jane leaked")).toMatchObject({ risk: "shady", flagged: true });
    expect(classifyMatch("https://fapboard.to/t/1").reasons).toEqual(["domain name suggests leaked or explicit content", "domain extension is common on low-accountability sites"]);
  });

  it("treats directory platforms as normal (not flagged) and names the removal channel", () => {
    const x = classifyMatch("https://x.com/a/status/1", "a on X");
    expect(x).toMatchObject({ risk: "normal", flagged: false, platformName: "X", coveredByAct: true });
  });

  it("keeps an adult platform shady but notes it has a removal channel", () => {
    const r = classifyMatch("https://www.pornhub.com/view_video.php?viewkey=1");
    expect(r.risk).toBe("shady");
    expect(r.reasons).toContain("Pornhub has a TAKE IT DOWN removal channel");
  });

  it("maps pages + similar images, dedupes, and orders shady → unknown → normal", () => {
    const m = toMatches(FIXTURE_WEB, AT, "web");
    expect(m.map((x) => `${x.risk}/${x.matchType}/${x.host}`)).toEqual([
      "shady/full/leakhub-mirror.example",
      "shady/full/instagram.com",
      "shady/partial/fapboard.to",
      "unknown/similar/pixelpin.example",
      "normal/full/imgvault.example",
      "normal/partial/x.com",
    ]);
  });
});

describe("reverseImageSearch", () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  it("defaults to the Instagram scope with the Instagram fixture in demo mode, and refuses outside demo", async () => {
    const s = await reverseImageSearch(buf, "ast_1", { demo: true, reporterName: "Jane Doe" });
    expect(s.scope).toBe("instagram");
    expect(s.provider).toBe("fixture");
    expect(s.matches).toHaveLength(4);
    expect((await reverseImageSearch(buf, "ast_1", { demo: true, scope: "web" })).matches).toHaveLength(6);
    await expect(reverseImageSearch(buf, "ast_1", { demo: false })).rejects.toThrow(/GOOGLE_VISION_API_KEY/);
  });

  it("calls Vision Web Detection with the image when a key is set and filters to Instagram", async () => {
    vi.stubEnv("GOOGLE_VISION_API_KEY", "k");
    try {
      const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { requests: { image: { content: string }; features: { type: string }[] }[] };
        expect(body.requests[0].features[0].type).toBe("WEB_DETECTION");
        expect(Buffer.from(body.requests[0].image.content, "base64")).toEqual(Buffer.from("img"));
        return new Response(
          JSON.stringify({
            responses: [
              {
                webDetection: {
                  pagesWithMatchingImages: [
                    { url: "https://x.com/u/status/9", pageTitle: "u on X", fullMatchingImages: [{ url: "https://pbs/9.jpg" }] },
                    { url: "https://www.instagram.com/p/AbC/", pageTitle: "someone on Instagram: “hi”", fullMatchingImages: [{ url: "https://ig/1.jpg" }] },
                  ],
                },
              },
            ],
          }),
        );
      }) as unknown as typeof fetch;
      const s = await reverseImageSearch(Buffer.from("img"), "ast_1", { fetchImpl });
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(String((fetchImpl as unknown as { mock: { calls: [unknown][] } }).mock.calls[0][0])).toContain("key=k");
      expect(s.provider).toBe("vision");
      expect(s.matches).toHaveLength(1);
      expect(s.matches[0]).toMatchObject({ pageUrl: "https://www.instagram.com/p/AbC/", handle: "someone", flagged: true });
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
  const draft: CaseReport = {
    id: "case_s",
    userId: "u",
    branch: "IMAGE_SEARCH",
    status: "DRAFT",
    title: "Where is my image?",
    notes: "",
    reporter: { legalName: "Jane Doe", contactEmail: "jane@example.com", signature: "Jane Doe" },
    isDraft: true,
    assets: [],
    verifications: [],
    escalations: [],
    reports: [],
    events: [],
    createdAt: AT,
    updatedAt: AT,
  };

  it("scans provenance, records the Instagram search with the reporter's name for impersonation checks, and mirrors matches into scrape", async () => {
    const c = await runImageSearch(draft, { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimeType: "image/jpeg" }, memStore(), { demo: true });
    expect(c.assets).toHaveLength(1);
    expect(c.imageSearch).toMatchObject({ scope: "instagram", assetId: c.assets[0].id });
    expect(c.imageSearch?.matches.map((m) => m.handle)).toEqual(["jane.d.leaks", "jane_doe_official_", "exposed.archive", "citymoments.photo"]);
    expect(c.scrape?.query).toBe("reverse image search · Instagram");
    expect(c.scrape?.sources[0].snippet).toMatch(/^flagged · full match/);
    expect(c.events[0].text).toBe("Found your image on 4 Instagram posts — all flagged for you, 3 with leak or impersonation signals (demo fixture).");
  });
});
