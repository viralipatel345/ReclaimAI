// AI-image search for a public figure, with a Gemini key (plus Vertex for SynthID):
//   1. identify the figure from the upload (or take the typed name),
//   2. Google-Search-grounded Gemini call → pages with images of them (whole web, or Instagram only),
//   3. fetch each page's image and check it: SynthID (Vertex) + C2PA, then a Gemini-vision look,
//   4. keep only the AI-flagged ones, ranked by strength of evidence.
// Grounding redirect links are resolved to their final URL; a URL the model wrote from
// memory is kept only if the page actually loads.
import { ThinkingLevel } from "@google/genai";
import { MODELS } from "../config";
import { generate, type GenerateParams } from "../gemini";
import { hostOf } from "../platforms";
import { parseC2pa } from "../provenance/c2pa";
import { aiLookCheck, combineAiLook, identifyPublicFigure, type AiLookResult, type PublicFigure } from "../provenance/aiLook";
import { fetchPageImage, type FetchedImage } from "../provenance/fetchImage";
import { detectSynthId, loadSynthIdConfig, type SynthIdConfig } from "../provenance/synthid";
import { verdictOf } from "../provenance";
import { classifyInstagram, classifyMatch, isInstagram } from "./imageSearch";
import type { AiLook, ImageMatch, ImageSearch, SearchScope } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/instagramSearch is server-only");

export class NoPublicFigureError extends Error {}

export interface FoundPost {
  url: string;
  title: string;
  why?: string;
  /** False when the URL came from search grounding; true when only the model wrote it. */
  unverified: boolean;
}

export function postsPrompt(name: string, scope: SearchScope = "web"): string {
  const where =
    scope === "instagram"
      ? `pages on instagram.com that feature images of the public figure "${name}": fan pages, edits, "AI art", "AI generated", "deepfake" or impersonation accounts, and ordinary posts. Prefer post (/p/), reel (/reel/) and profile URLs on instagram.com.`
      : `pages on any site (Instagram, X, Reddit, Pinterest, Facebook, TikTok, blogs, image boards, news) that show images of the public figure "${name}" — especially "AI generated", "AI art", "deepfake", "Midjourney", "Stable Diffusion" or "Imagen" images of them, fan edits, and impersonation accounts. Prefer direct post or profile URLs.`;
  return `Search Google for ${where} Use only search results, not memory.
Then give ONLY a JSON object on the last line:
{"posts":[{"url":"https://...","title":"<page title>","why":"<one short reason this page matters, e.g. 'account name says AI edits'>"}]}
Include up to 12 pages.`;
}

function parseJson<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

async function resolveRedirect(uri: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(uri, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8_000) });
    return res.url || null;
  } catch {
    return null;
  }
}

const isHttp = (u: string) => /^https?:\/\//i.test(u);
const inScope = (u: string, scope: SearchScope) => isHttp(u) && (scope === "web" || isInstagram(u));

export type Gen = (p: GenerateParams) => Promise<{ response: { text?: string; candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] }; model: string }>;

export async function findPosts(name: string, scope: SearchScope = "web", deps: { gen?: Gen; fetchImpl?: typeof fetch } = {}): Promise<FoundPost[]> {
  const gen = deps.gen ?? (generate as unknown as Gen);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const { response } = await gen({
    model: MODELS.grounding,
    contents: postsPrompt(name, scope),
    config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const grounded = new Map<string, string>();
  await Promise.all(
    chunks.map(async (ch) => {
      const uri = ch.web?.uri;
      if (!uri) return;
      const final = /grounding-api-redirect|vertexaisearch/.test(uri) ? await resolveRedirect(uri, fetchImpl) : uri;
      if (final && inScope(final, scope)) grounded.set(canon(final), ch.web?.title ?? "");
    }),
  );

  const modelPosts = (parseJson<{ posts?: { url?: string; title?: string; why?: string }[] }>(response.text ?? "")?.posts ?? []).filter((p) => typeof p.url === "string" && inScope(p.url!, scope));
  const out = new Map<string, FoundPost>();
  for (const [url, title] of grounded) out.set(url, { url, title, unverified: false });
  for (const p of modelPosts) {
    const url = canon(p.url!);
    const existing = out.get(url);
    if (existing) {
      existing.title = existing.title || p.title || "";
      existing.why = p.why;
    } else if (grounded.size === 0) {
      out.set(url, { url, title: p.title ?? "", why: p.why, unverified: true });
    }
  }
  return [...out.values()].slice(0, 12);
}

/** Backwards-compatible alias. */
export const findInstagramPosts = (name: string, deps: { gen?: Gen; fetchImpl?: typeof fetch } = {}) => findPosts(name, "instagram", deps);

export function canon(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    if (isInstagram(url)) {
      if (!u.pathname.endsWith("/")) u.pathname += "/";
      return `https://www.instagram.com${u.pathname}`;
    }
    return u.toString();
  } catch {
    return url;
  }
}

export interface PostCheck {
  ai: AiLook;
  imageUrl?: string;
  /** The page loaded, so the link is real even if its image couldn't be checked. */
  reachable: boolean;
}

export async function checkPostImage(
  pageUrl: string,
  deps: { fetchImage?: typeof fetchPageImage; aiLook?: typeof aiLookCheck; synthId?: SynthIdConfig | null; detect?: typeof detectSynthId } = {},
): Promise<PostCheck> {
  const { page, image: img }: { page: "ok" | "unreachable"; image: FetchedImage | null } = await (deps.fetchImage ?? fetchPageImage)(pageUrl);
  if (!img) {
    return { ai: { verdict: "unchecked", confidence: 0, signs: [page === "ok" ? "image not exposed without login" : "page not reachable"], source: "none", synthId: "unavailable" }, reachable: page === "ok" };
  }
  const [synth, c2pa] = await Promise.all([(deps.detect ?? detectSynthId)(img.buffer, img.mimeType, "image", deps.synthId), parseC2pa(img.buffer, img.mimeType)]);
  const provenance = verdictOf(synth, c2pa);
  const synthId: AiLook["synthId"] = synth.source === "stub" ? "unavailable" : synth.isGoogleAiGenerated ? "detected" : "not_detected";
  let look: AiLookResult | null = null;
  try {
    look = await (deps.aiLook ?? aiLookCheck)(img.buffer, img.mimeType);
  } catch (err) {
    console.warn("[figure-search] ai look failed", err instanceof Error ? err.message : err);
  }
  return { ai: combineAiLook(provenance.verdict === "inconclusive" ? null : provenance, look, synthId), imageUrl: img.imageUrl, reachable: true };
}

export interface FigureSearchOptions {
  scope?: SearchScope;
  /** Keep only AI-flagged matches (default true). */
  onlyAi?: boolean;
  subjectName?: string;
  reporterName?: string;
  clock?: () => string;
  deps?: {
    identify?: typeof identifyPublicFigure;
    findPosts?: typeof findPosts;
    checkImage?: typeof checkPostImage;
    synthIdConfig?: () => Promise<SynthIdConfig | null>;
  };
}

const MAX_CHECKS = 8;
const AI_RANK: Record<AiLook["verdict"], number> = { ai_generated: 0, likely_ai: 1, no_signal: 2, unchecked: 3 };

export async function searchForFigure(buffer: Buffer, mimeType: string, assetId: string, opts: FigureSearchOptions = {}): Promise<ImageSearch> {
  const scope = opts.scope ?? "web";
  const onlyAi = opts.onlyAi ?? true;
  const searchedAt = (opts.clock ?? (() => new Date().toISOString()))();

  let subject: ImageSearch["subject"];
  if (opts.subjectName?.trim()) {
    subject = { name: opts.subjectName.trim(), confidence: 1, source: "user" };
  } else {
    let who: PublicFigure;
    try {
      who = await (opts.deps?.identify ?? identifyPublicFigure)(buffer, mimeType);
    } catch (err) {
      throw new NoPublicFigureError(`Couldn't analyse the image (${err instanceof Error ? err.message.slice(0, 80) : "error"}). Type the person's name to search.`);
    }
    if (!who.name) throw new NoPublicFigureError("Couldn't identify a widely known public figure in this image. Type their name to search.");
    subject = { name: who.name, confidence: who.confidence, source: "gemini" };
  }

  const synthCfg = await (opts.deps?.synthIdConfig ?? loadSynthIdConfig)();
  const posts = await (opts.deps?.findPosts ?? findPosts)(subject.name, scope);
  const checks = await Promise.all(posts.slice(0, MAX_CHECKS).map((p) => (opts.deps?.checkImage ?? checkPostImage)(p.url, { synthId: synthCfg })));

  const all: ImageMatch[] = posts.map((p, i) => {
    const check: PostCheck = checks[i] ?? { ai: { verdict: "unchecked", confidence: 0, signs: ["not checked (limit reached)"], source: "none", synthId: "unavailable" }, reachable: false };
    const ig = isInstagram(p.url);
    const base = ig ? classifyInstagram(p.url, p.title, opts.reporterName) : classifyMatch(p.url, p.title);
    const reasons: string[] = [];
    if (check.ai.verdict === "ai_generated") reasons.push(`AI-generated (${Math.round(check.ai.confidence * 100)}%): ${check.ai.signs.slice(0, 2).join("; ") || "provenance signal"}`);
    else if (check.ai.verdict === "likely_ai") reasons.push(`possibly AI-generated (${Math.round(check.ai.confidence * 100)}%): ${check.ai.signs.slice(0, 2).join("; ")}`);
    if (check.ai.synthId === "not_detected" && check.ai.verdict !== "no_signal") reasons.push("no SynthID watermark — not made with a Google model");
    if (p.why) reasons.push(p.why);
    if (p.unverified && !check.reachable) reasons.push("link suggested by search, page not reachable to confirm");
    const signal = base.reasons.filter((r) => /^(account name|profile uses|domain name|page title|domain extension)/.test(r));
    reasons.push(...signal);
    if (reasons.length === 0) reasons.push(`page uses ${subject!.name}'s likeness`);
    if (base.platformName && base.coveredByAct) reasons.push(`${base.platformName} is a covered platform with an official removal channel`);
    const shady = check.ai.verdict === "ai_generated" || check.ai.verdict === "likely_ai" || signal.length > 0;
    return {
      url: check.imageUrl ?? p.url,
      pageUrl: p.url,
      host: hostOf(p.url),
      title: p.title || undefined,
      matchType: check.ai.verdict === "unchecked" ? "similar" : "full",
      risk: shady ? "shady" : base.risk,
      flagged: check.ai.verdict === "ai_generated" || check.ai.verdict === "likely_ai" || base.flagged,
      reasons,
      platformName: base.platformName,
      coveredByAct: base.coveredByAct,
      handle: (base as { handle?: string }).handle,
      ai: check.ai,
      foundAt: searchedAt,
    };
  });

  const kept = (onlyAi ? all.filter((m) => m.ai?.verdict === "ai_generated" || m.ai?.verdict === "likely_ai") : all).sort(
    (a, b) => AI_RANK[a.ai!.verdict] - AI_RANK[b.ai!.verdict] || (b.ai!.confidence - a.ai!.confidence),
  );
  return {
    assetId,
    scope,
    provider: "gemini",
    subject,
    labels: [subject.name],
    onlyAi,
    considered: posts.length,
    checked: checks.filter((c) => c.ai.verdict !== "unchecked").length,
    // "Active" only if the detector actually answered for at least one image (auth may be fine while the API is disabled).
    synthIdActive: checks.some((c) => c.ai.synthId !== "unavailable"),
    matches: kept,
    searchedAt,
  };
}

/** Backwards-compatible alias: Instagram-only figure search. */
export const searchInstagramForFigure = (buffer: Buffer, mimeType: string, assetId: string, opts: Omit<FigureSearchOptions, "scope"> = {}) => searchForFigure(buffer, mimeType, assetId, { ...opts, scope: "instagram" });
