// resolve_platform: directory first; otherwise a separate Gemini call grounded with
// Google Search. Only the HOSTNAME is ever sent — never the path, which could identify
// the content or the person. Low confidence or ungrounded answers are never used.
import { ThinkingLevel, type GenerateContentResponse } from "@google/genai";
import { MIN_PLATFORM_CONFIDENCE, MODELS } from "./config";
import { generate, type GenerateParams } from "./gemini";
import { hostOf, matchDirectory, UNRESOLVED_MESSAGE, unresolvedPlatform } from "./platforms";
import type { ResolvedPlatform } from "./types";

export type Generator = (p: GenerateParams) => Promise<{ response: GenerateContentResponse; model: string }>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Neutral wording on purpose: the model reliably runs Google Search for an "abuse report /
// content removal" question, but tends to skip search (answering from memory) when the
// topic is described as intimate imagery. Only the hostname is included.
export function groundingPrompt(host: string): string {
  return `Search the web: what is the official abuse report or content removal request page (or abuse email address) published by the website ${host}? Base your answer only on search results, not memory.
Then give ONLY a JSON object on the last line:
{"platform": "<site name>", "channel": "form" | "email", "target": "<form URL or email address>", "confidence": <0..1>}
If the results don't show an official channel published by the site or its operator, use "confidence": 0. Never guess.`;
}

interface GroundedAnswer {
  platform?: unknown;
  channel?: unknown;
  target?: unknown;
  confidence?: unknown;
}

/** The model writes prose first; take the last flat JSON object in the reply. */
function parseJson(text: string): GroundedAnswer | null {
  const objects = text.match(/\{[^{}]*\}/g);
  if (!objects) return null;
  try {
    return JSON.parse(objects[objects.length - 1]) as GroundedAnswer;
  } catch {
    return null;
  }
}

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);

/** "old.reddit.co.uk" -> "reddit" (approximate registrable-name label). */
export function siteLabel(host: string): string {
  const parts = host.replace(/^www\./, "").split(".");
  if (parts.length >= 3 && SECOND_LEVEL.has(parts[parts.length - 2])) return parts[parts.length - 3];
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

/** A channel is only trusted on the site's own domain or on a domain Google Search returned. */
function targetIsPlausible(host: string, targetHost: string, sources: { title: string; uri: string }[]): boolean {
  const t = targetHost.toLowerCase();
  if (siteLabel(t) === siteLabel(host)) return true;
  // Grounding chunk titles are the source domains (uris are redirect links).
  return sources.some((s) => s.title && (t === s.title.toLowerCase() || t.endsWith(`.${s.title.toLowerCase()}`)));
}

/** Validate a grounded answer; anything doubtful becomes "Couldn't confirm". */
export function validateAnswer(host: string, a: GroundedAnswer | null, sources: { title: string; uri: string }[]): ResolvedPlatform {
  const fail = { ...unresolvedPlatform(`https://${host}/`), message: UNRESOLVED_MESSAGE, sources };
  if (!a || sources.length === 0) return fail; // ungrounded → never trusted
  const confidence = typeof a.confidence === "number" ? Math.max(0, Math.min(1, a.confidence)) : 0;
  const channel = a.channel === "form" || a.channel === "email" ? a.channel : null;
  const target = typeof a.target === "string" ? a.target.trim() : "";
  if (confidence < MIN_PLATFORM_CONFIDENCE || !channel || !target) return { ...fail, confidence };

  let targetHost = "";
  if (channel === "email") {
    if (!EMAIL_RE.test(target)) return { ...fail, confidence };
    targetHost = target.split("@")[1];
  } else {
    try {
      const u = new URL(target);
      if (u.protocol !== "https:") return { ...fail, confidence };
      targetHost = u.hostname;
    } catch {
      return { ...fail, confidence };
    }
  }
  if (!targetIsPlausible(host, targetHost, sources)) return { ...fail, confidence };
  const name = typeof a.platform === "string" && a.platform.trim() ? a.platform.trim().slice(0, 60) : host;
  return { id: `search:${host}`, name, channel, target, confidence, source: "search", coveredByAct: true, sources };
}

const cache = new Map<string, ResolvedPlatform>();

export async function resolvePlatform(url: string, gen: Generator = generate): Promise<ResolvedPlatform> {
  const direct = matchDirectory(url);
  if (direct) return direct;
  const host = hostOf(url);
  if (!host) return unresolvedPlatform(url);
  const cached = cache.get(host);
  if (cached) return cached;

  try {
    const { response } = await gen({
      model: MODELS.grounding,
      contents: groundingPrompt(host),
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((c) => ({ title: c.web?.title ?? c.web?.domain ?? "", uri: c.web?.uri ?? "" }))
      .filter((s) => s.uri)
      .slice(0, 3);
    const result = validateAnswer(host, parseJson(response.text ?? ""), sources);
    cache.set(host, result);
    return result;
  } catch {
    // Don't cache failures: a later attempt may succeed.
    return unresolvedPlatform(url);
  }
}
