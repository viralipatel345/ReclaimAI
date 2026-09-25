// Reverse image search: where on the web does an uploaded image appear, and how shady is
// each host? Uses Google Cloud Vision Web Detection when GOOGLE_VISION_API_KEY is set
// (the image is sent to Google for matching and not stored by Reclaim); otherwise, in
// demo mode, a fictional fixture. Every hit is classified shady / normal / unknown.
import { isDemoMode } from "../config";
import { hostOf, matchDirectory } from "../platforms";
import type { ImageMatch, ImageSearch, MatchRisk, MatchType } from "./types";

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

const SHADY_WORDS = /leak|nude|xxx|porn|revenge|expos|thot|fap|onlyfans|sextape|voyeur|creep|deepfake|fakes|anon-?ib|imageboard|mega\.nz/i;
const SHADY_TLDS = /\.(ru|su|to|cc|ws|top|xyz|club|onion)$/i;
const NORMAL_HINTS = /portrait|photography|wedding|profile|linkedin|news|wikipedia/i;

export function classifyMatch(pageUrl: string, title?: string): Pick<ImageMatch, "risk" | "reasons" | "platformName" | "coveredByAct"> {
  const host = hostOf(pageUrl);
  const p = matchDirectory(pageUrl);
  const reasons: string[] = [];
  if (SHADY_WORDS.test(host)) reasons.push("domain name suggests leaked or explicit content");
  if (title && SHADY_WORDS.test(title)) reasons.push("page title suggests leaked or explicit content");
  if (SHADY_TLDS.test(host)) reasons.push("domain extension is common on low-accountability sites");

  if (reasons.length > 0) {
    if (p?.channel) reasons.push(`${p.name} has a TAKE IT DOWN removal channel`);
    return { risk: "shady", reasons, platformName: p?.name, coveredByAct: p?.coveredByAct };
  }
  if (p) {
    return { risk: "normal", reasons: [p.channel ? `${p.name} is a known platform with an official removal channel` : `${p.name} is a known platform`], platformName: p.name, coveredByAct: p.coveredByAct };
  }
  if (title && NORMAL_HINTS.test(title)) return { risk: "unknown", reasons: ["unfamiliar site; page looks like ordinary content"] };
  return { risk: "unknown", reasons: ["unfamiliar site with no removal channel on file"] };
}

const RISK_RANK: Record<MatchRisk, number> = { shady: 0, unknown: 1, normal: 2 };
const TYPE_RANK: Record<MatchType, number> = { full: 0, partial: 1, similar: 2 };

export function toMatches(d: WebDetection, foundAt: string): ImageMatch[] {
  const out: ImageMatch[] = [];
  const seen = new Set<string>();
  for (const page of d.pagesWithMatchingImages ?? []) {
    if (!page.url || seen.has(page.url)) continue;
    seen.add(page.url);
    const img = page.fullMatchingImages?.[0] ?? page.partialMatchingImages?.[0];
    const matchType: MatchType = page.fullMatchingImages?.length ? "full" : "partial";
    out.push({ url: img?.url ?? page.url, pageUrl: page.url, host: hostOf(page.url), title: page.pageTitle?.trim() || undefined, matchType, foundAt, ...classifyMatch(page.url, page.pageTitle) });
  }
  for (const img of (d.visuallySimilarImages ?? []).slice(0, 8)) {
    if (!img.url || seen.has(img.url)) continue;
    seen.add(img.url);
    out.push({ url: img.url, pageUrl: img.url, host: hostOf(img.url), matchType: "similar", foundAt, ...classifyMatch(img.url) });
  }
  return out.sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk] || TYPE_RANK[a.matchType] - TYPE_RANK[b.matchType]);
}

/** Demo world: the same fictional hosts the rest of the app uses, plus one shady mirror. */
export const FIXTURE_DETECTION: WebDetection = {
  bestGuessLabels: [{ label: "portrait" }],
  pagesWithMatchingImages: [
    { url: "https://leakhub-mirror.example/gallery/jane-d-leaked", pageTitle: "Jane D leaked set (42 pics) — LeakHub Mirror", fullMatchingImages: [{ url: "https://cdn.leakhub-mirror.example/f/9f2a.jpg" }] },
    { url: "https://imgvault.example/v/a7Qx2Lm9", pageTitle: "a7Qx2Lm9 — ImgVault", fullMatchingImages: [{ url: "https://imgvault.example/v/a7Qx2Lm9.jpg" }] },
    { url: "https://x.com/example_account/status/1839201934817729000", pageTitle: "example_account on X", partialMatchingImages: [{ url: "https://pbs.x.example/media/1839201934.jpg" }] },
    { url: "https://fapboard.to/t/8812", pageTitle: "thread 8812", partialMatchingImages: [{ url: "https://fapboard.to/i/8812-1.jpg" }] },
  ],
  visuallySimilarImages: [{ url: "https://pixelpin.example/pin/22a1" }],
};

export async function reverseImageSearch(buffer: Buffer, assetId: string, opts: { demo?: boolean; fetchImpl?: typeof fetch; clock?: () => string } = {}): Promise<ImageSearch> {
  const searchedAt = (opts.clock ?? (() => new Date().toISOString()))();
  let detection: WebDetection;
  let provider: ImageSearch["provider"];
  if (visionConfigured()) {
    detection = await visionWebDetection(buffer, opts.fetchImpl);
    provider = "vision";
  } else if (opts.demo ?? isDemoMode()) {
    detection = FIXTURE_DETECTION;
    provider = "fixture";
  } else {
    throw new Error("Reverse image search needs GOOGLE_VISION_API_KEY");
  }
  return { assetId, provider, labels: (detection.bestGuessLabels ?? []).map((l) => l.label), matches: toMatches(detection, searchedAt), searchedAt };
}
