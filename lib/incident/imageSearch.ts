// Reverse image search: where does an uploaded image appear, and should the user act on it?
// Scope "instagram" (the demo default) keeps only Instagram hits and flags every one with a
// reason; scope "web" classifies any host as shady / known platform / unfamiliar. Uses
// Google Cloud Vision Web Detection when GOOGLE_VISION_API_KEY is set (the image is sent to
// Google for matching, not stored by Reclaim); otherwise, in demo mode, a fictional fixture.
import { isDemoMode } from "../config";
import { hostOf, matchDirectory } from "../platforms";
import type { AiLook, ImageMatch, ImageSearch, MatchRisk, MatchType, SearchScope } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/imageSearch is server-only");

export function visionConfigured(): boolean {
  return !!process.env.GOOGLE_VISION_API_KEY;
}

interface WebImage {
  url: string;
}
interface WebPage {
  url: string;
  pageTitle?: string;
  fullMatchingImages?: WebImage[];
  partialMatchingImages?: WebImage[];
}
export interface WebDetection {
  pagesWithMatchingImages?: WebPage[];
  fullMatchingImages?: WebImage[];
  partialMatchingImages?: WebImage[];
  visuallySimilarImages?: WebImage[];
  bestGuessLabels?: { label: string }[];
}

export async function visionWebDetection(buffer: Buffer, fetchImpl: typeof fetch = fetch): Promise<WebDetection> {
  const res = await fetchImpl(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content: buffer.toString("base64") }, features: [{ type: "WEB_DETECTION", maxResults: 25 }] }] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Vision API responded ${res.status}`);
  const json = (await res.json()) as { responses?: { webDetection?: WebDetection; error?: { message?: string } }[] };
  const first = json.responses?.[0];
  if (first?.error) throw new Error(first.error.message ?? "Vision API error");
  return first?.webDetection ?? {};
}

// ---------- classification ----------

const SHADY_WORDS = /leak|nude|xxx|porn|revenge|expos|thot|fap|onlyfans|sextape|voyeur|creep|deepfake|fakes|anon-?ib|imageboard|mega\.nz/i;
const SHADY_TLDS = /\.(ru|su|to|cc|ws|top|xyz|club|onion)$/i;
const NORMAL_HINTS = /portrait|photography|wedding|profile|linkedin|news|wikipedia/i;

export function isInstagram(url: string): boolean {
  const h = hostOf(url);
  return h === "instagram.com" || h.endsWith(".instagram.com") || h === "instagr.am";
}

/** "@handle" from an Instagram title ("Name (@handle) • Instagram…", "handle on Instagram: …") or profile URL. */
export function instagramHandle(pageUrl: string, title?: string): string | undefined {
  const fromTitle = title?.match(/\(@([a-z0-9._]+)\)/i)?.[1] ?? title?.match(/^([a-z0-9._]+) on instagram/i)?.[1];
  if (fromTitle) return fromTitle;
  const seg = new URL(pageUrl).pathname.split("/").filter(Boolean);
  if (seg[0] && !["p", "reel", "reels", "stories", "explore", "tv"].includes(seg[0])) return seg[0];
  return undefined;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Does the handle or title reuse the reporter's name (e.g. "Jane Doe" → jane_doe_official_)? */
export function looksLikeImpersonation(reporterName: string | undefined, handle?: string, title?: string): boolean {
  if (!reporterName) return false;
  const tokens = reporterName.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  const hay = norm(`${handle ?? ""} ${title ?? ""}`);
  return tokens.every((t) => hay.includes(norm(t)));
}

export function classifyInstagram(pageUrl: string, title: string | undefined, reporterName?: string): Pick<ImageMatch, "risk" | "flagged" | "reasons" | "platformName" | "coveredByAct" | "handle"> {
  const handle = instagramHandle(pageUrl, title);
  const reasons: string[] = [];
  if ((handle && SHADY_WORDS.test(handle)) || (title && SHADY_WORDS.test(title))) reasons.push("account name or caption suggests leaked content");
  if (looksLikeImpersonation(reporterName, handle, title)) reasons.push("profile uses your name — possible impersonation");
  const risk: MatchRisk = reasons.length ? "shady" : "normal";
  if (!reasons.length) reasons.push("your image is on this account — confirm it isn't yours");
  reasons.push("Instagram is a covered platform with an official removal form");
  return { risk, flagged: true, reasons, platformName: "Instagram", coveredByAct: true, handle };
}

export function classifyMatch(pageUrl: string, title?: string): Pick<ImageMatch, "risk" | "flagged" | "reasons" | "platformName" | "coveredByAct"> {
  const host = hostOf(pageUrl);
  const p = matchDirectory(pageUrl);
  const reasons: string[] = [];
  if (SHADY_WORDS.test(host)) reasons.push("domain name suggests leaked or explicit content");
  if (title && SHADY_WORDS.test(title)) reasons.push("page title suggests leaked or explicit content");
  if (SHADY_TLDS.test(host)) reasons.push("domain extension is common on low-accountability sites");

  if (reasons.length > 0) {
    if (p?.channel) reasons.push(`${p.name} has a TAKE IT DOWN removal channel`);
    return { risk: "shady", flagged: true, reasons, platformName: p?.name, coveredByAct: p?.coveredByAct };
  }
  if (p) {
    return { risk: "normal", flagged: false, reasons: [p.channel ? `${p.name} is a known platform with an official removal channel` : `${p.name} is a known platform`], platformName: p.name, coveredByAct: p.coveredByAct };
  }
  if (title && NORMAL_HINTS.test(title)) return { risk: "unknown", flagged: false, reasons: ["unfamiliar site; page looks like ordinary content"] };
  return { risk: "unknown", flagged: false, reasons: ["unfamiliar site with no removal channel on file"] };
}

const RISK_RANK: Record<MatchRisk, number> = { shady: 0, unknown: 1, normal: 2 };
const TYPE_RANK: Record<MatchType, number> = { full: 0, partial: 1, similar: 2 };

export function toMatches(d: WebDetection, foundAt: string, scope: SearchScope, reporterName?: string): ImageMatch[] {
  const out: ImageMatch[] = [];
  const seen = new Set<string>();
  const classify = (pageUrl: string, title?: string) => (scope === "instagram" ? classifyInstagram(pageUrl, title, reporterName) : classifyMatch(pageUrl, title));

  for (const page of d.pagesWithMatchingImages ?? []) {
    if (!page.url || seen.has(page.url)) continue;
    if (scope === "instagram" && !isInstagram(page.url)) continue;
    seen.add(page.url);
    const img = page.fullMatchingImages?.[0] ?? page.partialMatchingImages?.[0];
    const matchType: MatchType = page.fullMatchingImages?.length ? "full" : "partial";
    out.push({ url: img?.url ?? page.url, pageUrl: page.url, host: hostOf(page.url), title: page.pageTitle?.trim() || undefined, matchType, foundAt, ...classify(page.url, page.pageTitle) });
  }
  if (scope === "web") {
    for (const img of (d.visuallySimilarImages ?? []).slice(0, 8)) {
      if (!img.url || seen.has(img.url)) continue;
      seen.add(img.url);
      out.push({ url: img.url, pageUrl: img.url, host: hostOf(img.url), matchType: "similar", foundAt, ...classifyMatch(img.url) });
    }
  }
  return out.sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk] || TYPE_RANK[a.matchType] - TYPE_RANK[b.matchType]);
}

// ---------- demo fixtures ----------

/** Demo world: fictional Instagram accounts reusing the uploaded image. */
export const FIXTURE_INSTAGRAM: WebDetection = {
  bestGuessLabels: [{ label: "portrait" }],
  pagesWithMatchingImages: [
    { url: "https://www.instagram.com/p/C8xKq2LtP1a/", pageTitle: "jane.d.leaks on Instagram: “full set in bio 🔥”", fullMatchingImages: [{ url: "https://scontent.cdninstagram.example/v/t51/1.jpg" }] },
    { url: "https://www.instagram.com/jane_doe_official_/", pageTitle: "Jane Doe (@jane_doe_official_) • Instagram photos and videos", fullMatchingImages: [{ url: "https://scontent.cdninstagram.example/v/t51/2.jpg" }] },
    { url: "https://www.instagram.com/reel/C9aB1cD2eF3/", pageTitle: "exposed.archive on Instagram: “she thought it was private”", partialMatchingImages: [{ url: "https://scontent.cdninstagram.example/v/t51/3.jpg" }] },
    { url: "https://www.instagram.com/p/C7mNoPqRsT4/", pageTitle: "citymoments.photo on Instagram: “golden hour portraits”", partialMatchingImages: [{ url: "https://scontent.cdninstagram.example/v/t51/4.jpg" }] },
    { url: "https://leakhub-mirror.example/gallery/jane-d-leaked", pageTitle: "Jane D leaked set (42 pics) — LeakHub Mirror", fullMatchingImages: [{ url: "https://cdn.leakhub-mirror.example/f/9f2a.jpg" }] },
  ],
};

/** Demo world for the whole-web scope: the same fictional hosts the rest of the app uses. */
export const FIXTURE_WEB: WebDetection = {
  bestGuessLabels: [{ label: "portrait" }],
  pagesWithMatchingImages: [
    { url: "https://leakhub-mirror.example/gallery/jane-d-leaked", pageTitle: "Jane D leaked set (42 pics) — LeakHub Mirror", fullMatchingImages: [{ url: "https://cdn.leakhub-mirror.example/f/9f2a.jpg" }] },
    { url: "https://www.instagram.com/p/C8xKq2LtP1a/", pageTitle: "jane.d.leaks on Instagram: “full set in bio 🔥”", fullMatchingImages: [{ url: "https://scontent.cdninstagram.example/v/t51/1.jpg" }] },
    { url: "https://imgvault.example/v/a7Qx2Lm9", pageTitle: "a7Qx2Lm9 — ImgVault", fullMatchingImages: [{ url: "https://imgvault.example/v/a7Qx2Lm9.jpg" }] },
    { url: "https://x.com/example_account/status/1839201934817729000", pageTitle: "example_account on X", partialMatchingImages: [{ url: "https://pbs.x.example/media/1839201934.jpg" }] },
    { url: "https://fapboard.to/t/8812", pageTitle: "thread 8812", partialMatchingImages: [{ url: "https://fapboard.to/i/8812-1.jpg" }] },
  ],
  visuallySimilarImages: [{ url: "https://pixelpin.example/pin/22a1" }],
};

/** Demo AI verdicts for the fixture pages (what SynthID / C2PA / Gemini vision would have said). */
export const FIXTURE_AI: Record<string, AiLook> = {
  "https://leakhub-mirror.example/gallery/jane-d-leaked": { verdict: "ai_generated", confidence: 0.93, signs: ["skin texture unnaturally smooth", "earrings don't match each other"], source: "gemini-vision", synthId: "not_detected" },
  "https://www.instagram.com/jane_doe_official_/": { verdict: "ai_generated", confidence: 1, signs: ["SynthID watermark detected — made with a Google AI model"], source: "provenance", synthId: "detected" },
  "https://www.instagram.com/p/C8xKq2LtP1a/": { verdict: "likely_ai", confidence: 0.61, signs: ["fingers partly merged with the railing"], source: "gemini-vision", synthId: "not_detected" },
  "https://fapboard.to/t/8812": { verdict: "likely_ai", confidence: 0.58, signs: ["text on the poster behind is garbled"], source: "gemini-vision", synthId: "not_detected" },
};
const FIXTURE_CLEAN: AiLook = { verdict: "no_signal", confidence: 0.12, signs: [], source: "gemini-vision", synthId: "not_detected" };
const FIXTURE_UNCHECKED: AiLook = { verdict: "unchecked", confidence: 0, signs: ["image not exposed without login"], source: "none", synthId: "unavailable" };

export interface SearchOptions {
  scope?: SearchScope;
  reporterName?: string;
  demo?: boolean;
  fetchImpl?: typeof fetch;
  clock?: () => string;
}

export async function reverseImageSearch(buffer: Buffer, assetId: string, opts: SearchOptions = {}): Promise<ImageSearch> {
  const scope = opts.scope ?? "instagram";
  const searchedAt = (opts.clock ?? (() => new Date().toISOString()))();
  let detection: WebDetection;
  let provider: ImageSearch["provider"];
  if (visionConfigured()) {
    detection = await visionWebDetection(buffer, opts.fetchImpl);
    provider = "vision";
  } else if (opts.demo ?? isDemoMode()) {
    detection = scope === "instagram" ? FIXTURE_INSTAGRAM : FIXTURE_WEB;
    provider = "fixture";
  } else {
    throw new Error("Reverse image search needs GOOGLE_VISION_API_KEY");
  }
  let matches = toMatches(detection, searchedAt, scope, opts.reporterName);
  if (provider === "fixture") matches = matches.map((m) => ({ ...m, ai: FIXTURE_AI[m.pageUrl] ?? (m.matchType === "similar" ? FIXTURE_UNCHECKED : FIXTURE_CLEAN) }));
  return {
    assetId,
    scope,
    provider,
    labels: (detection.bestGuessLabels ?? []).map((l) => l.label),
    onlyAi: false,
    considered: matches.length,
    checked: matches.filter((m) => m.ai && m.ai.verdict !== "unchecked").length,
    synthIdActive: false,
    matches,
    searchedAt,
  };
}
