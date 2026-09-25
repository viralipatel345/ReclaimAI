// Real Instagram search for a public figure, with only a Gemini key:
//   1. identify the figure from the upload (or take the typed name),
//   2. Google-Search-grounded Gemini call → instagram.com posts/profiles about them,
//   3. fetch each post's image and check it for AI generation (C2PA/SynthID + Gemini vision),
//   4. flag every hit, shady when AI-generated or leak signals are present.
// Grounding redirect links are resolved to their final instagram.com URL; only URLs that
// came back from search are trusted, never ones the model wrote from memory.
import { ThinkingLevel } from "@google/genai";
import { MODELS } from "../config";
import { generate, type GenerateParams } from "../gemini";
import { hostOf } from "../platforms";
import { parseC2pa } from "../provenance/c2pa";
import { aiLookCheck, combineAiLook, identifyPublicFigure, type AiLookResult, type PublicFigure } from "../provenance/aiLook";
import { fetchPageImage, type FetchedImage } from "../provenance/fetchImage";
import { detectSynthId } from "../provenance/synthid";
import { verdictOf } from "../provenance";
import { classifyInstagram, isInstagram } from "./imageSearch";
import type { AiLook, ImageMatch, ImageSearch } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/instagramSearch is server-only");

export class NoPublicFigureError extends Error {}

export interface FoundPost {
  url: string;
  title: string;
  why?: string;
  /** False when the URL came from search grounding; true when only the model wrote it. */
  unverified: boolean;
}

export function postsPrompt(name: string): string {
  return `Search Google for pages on instagram.com that feature images of the public figure "${name}": fan pages, edits, "AI art", "AI generated", "deepfake" or impersonation accounts, and ordinary posts. Use only search results, not memory. Prefer post (/p/), reel (/reel/) and profile URLs on instagram.com.
Then give ONLY a JSON object on the last line:
{"posts":[{"url":"https://www.instagram.com/...","title":"<page title>","why":"<one short reason this post matters, e.g. 'account name says AI edits'>"}]}
Include up to 10 posts.`;
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

export type Gen = (p: GenerateParams) => Promise<{ response: { text?: string; candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] }; model: string }>;

export async function findInstagramPosts(name: string, deps: { gen?: Gen; fetchImpl?: typeof fetch } = {}): Promise<FoundPost[]> {
  const gen = deps.gen ?? (generate as unknown as Gen);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const { response } = await gen({
    model: MODELS.grounding,
    contents: postsPrompt(name),
    config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const grounded = new Map<string, string>();
  await Promise.all(
    chunks.map(async (ch) => {
      const uri = ch.web?.uri;
      if (!uri) return;
      const final = /instagram\.com/.test(uri) ? uri : await resolveRedirect(uri, fetchImpl);
      if (final && isInstagram(final)) grounded.set(canon(final), ch.web?.title ?? "");
    }),
  );

  const modelPosts = (parseJson<{ posts?: { url?: string; title?: string; why?: string }[] }>(response.text ?? "")?.posts ?? []).filter((p) => typeof p.url === "string" && isInstagram(p.url));
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
  return [...out.values()].slice(0, 10);
}

function canon(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    return `https://www.instagram.com${u.pathname}`;
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

export async function checkPostImage(pageUrl: string, deps: { fetchImage?: typeof fetchPageImage; aiLook?: typeof aiLookCheck } = {}): Promise<PostCheck> {
  const { page, image: img }: { page: "ok" | "unreachable"; image: FetchedImage | null } = await (deps.fetchImage ?? fetchPageImage)(pageUrl);
  if (!img) {
    return { ai: { verdict: "unchecked", confidence: 0, signs: [page === "ok" ? "post image not exposed without login" : "page not reachable"], source: "none" }, reachable: page === "ok" };
  }
  const [synthId, c2pa] = await Promise.all([detectSynthId(img.buffer, img.mimeType, "image"), parseC2pa(img.buffer, img.mimeType)]);
  const provenance = verdictOf(synthId, c2pa);
  let look: AiLookResult | null = null;
  try {
    look = await (deps.aiLook ?? aiLookCheck)(img.buffer, img.mimeType);
  } catch (err) {
    console.warn("[instagram-search] ai look failed", err instanceof Error ? err.message : err);
  }
  return { ai: combineAiLook(provenance.verdict === "inconclusive" ? null : provenance, look), imageUrl: img.imageUrl, reachable: true };
}

export interface FigureSearchOptions {
  subjectName?: string;
  reporterName?: string;
  clock?: () => string;
  deps?: {
    identify?: typeof identifyPublicFigure;
    findPosts?: typeof findInstagramPosts;
    checkImage?: typeof checkPostImage;
  };
}

const MAX_CHECKS = 6;

export async function searchInstagramForFigure(buffer: Buffer, mimeType: string, assetId: string, opts: FigureSearchOptions = {}): Promise<ImageSearch> {
  const searchedAt = (opts.clock ?? (() => new Date().toISOString()))();
  let subject: ImageSearch["subject"];
  if (opts.subjectName?.trim()) {
    subject = { name: opts.subjectName.trim(), confidence: 1, source: "user" };
  } else {
    const who: PublicFigure = await (opts.deps?.identify ?? identifyPublicFigure)(buffer, mimeType);
    if (!who.name) throw new NoPublicFigureError("Couldn't identify a widely known public figure in this image. Type their name to search.");
    subject = { name: who.name, confidence: who.confidence, source: "gemini" };
  }

  const posts = await (opts.deps?.findPosts ?? findInstagramPosts)(subject.name);
  const checks = await Promise.all(posts.slice(0, MAX_CHECKS).map((p) => (opts.deps?.checkImage ?? checkPostImage)(p.url)));

  const matches: ImageMatch[] = posts.map((p, i) => {
    const check: PostCheck = checks[i] ?? { ai: { verdict: "unchecked", confidence: 0, signs: ["not checked (limit reached)"], source: "none" }, reachable: false };
    const base = classifyInstagram(p.url, p.title, opts.reporterName);
    const reasons: string[] = [];
    if (check.ai.verdict === "ai_generated") reasons.push(`looks AI-generated (${Math.round(check.ai.confidence * 100)}%): ${check.ai.signs.slice(0, 2).join("; ") || "provenance signal"}`);
    else if (check.ai.verdict === "likely_ai") reasons.push(`possibly AI-generated (${Math.round(check.ai.confidence * 100)}%): ${check.ai.signs.slice(0, 2).join("; ")}`);
    if (p.why) reasons.push(p.why);
    if (p.unverified && !check.reachable) reasons.push("link suggested by search, page not reachable to confirm");
    const leak = base.reasons.filter((r) => r.startsWith("account name") || r.startsWith("profile uses"));
    reasons.push(...leak);
    if (reasons.length === 0) reasons.push(`post uses ${subject!.name}'s likeness`);
    reasons.push("Instagram is a covered platform with an official removal form");
    const shady = check.ai.verdict === "ai_generated" || check.ai.verdict === "likely_ai" || leak.length > 0;
    return {
      url: check.imageUrl ?? p.url,
      pageUrl: p.url,
      host: hostOf(p.url),
      title: p.title || undefined,
      matchType: check.ai.verdict === "unchecked" ? "similar" : "full",
      risk: shady ? "shady" : "normal",
      flagged: true,
      reasons,
      platformName: "Instagram",
      coveredByAct: true,
      handle: base.handle,
      ai: check.ai,
      foundAt: searchedAt,
    };
  });

  const rank = (m: ImageMatch) => (m.ai?.verdict === "ai_generated" ? 0 : m.ai?.verdict === "likely_ai" ? 1 : m.risk === "shady" ? 2 : m.ai?.verdict === "no_signal" ? 3 : 4);
  matches.sort((a, b) => rank(a) - rank(b));
  return { assetId, scope: "instagram", provider: "gemini", subject, labels: [subject.name], matches, searchedAt };
}
