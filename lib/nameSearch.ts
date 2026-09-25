// Google results for the user's OWN name, via Gemini with Google Search grounding.
// The only person-related search Reclaim does (spec rule 2): results are titles + links,
// result pages are never opened, and nothing is filed until she confirms each one.
import { MODELS } from "./config";
import { generate } from "./gemini";
import type { Generator } from "./resolve";
import { baseDomain } from "./resolve";

export interface NameHit {
  url: string;
  title: string;
}

export function nameSearchPrompt(name: string): string {
  return `Search Google for the exact name "${name}". List the web pages that appear in the results (up to 10).
Reply with ONLY a JSON array on the last line: [{"url": "<page URL>", "title": "<page title>"}]. Include only pages that actually appeared in the search results.`;
}

function parseHits(text: string): NameHit[] {
  const arrays = text.match(/\[[\s\S]*\]/g);
  if (!arrays) return [];
  try {
    const raw = JSON.parse(arrays[arrays.length - 1]) as { url?: unknown; title?: unknown }[];
    return raw.filter((h) => typeof h.url === "string" && /^https?:\/\//.test(h.url)).map((h) => ({ url: String(h.url), title: String(h.title ?? h.url).slice(0, 200) }));
  } catch {
    return [];
  }
}

/** Grounding sources come as Google redirect links; read the Location header (never the page). */
async function resolveRedirect(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    await res.body?.cancel().catch(() => {});
    return res.headers.get("location");
  } catch {
    return null;
  }
}

const GROUNDING_REDIRECT = /^https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\//;

export async function searchOwnNameGrounded(name: string, gen: Generator = generate, resolve = resolveRedirect): Promise<NameHit[]> {
  if (!name.trim()) return [];
  const { response } = await gen({ model: MODELS.grounding, contents: nameSearchPrompt(name.trim()), config: { tools: [{ googleSearch: {} }] } });
  const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []).map((c) => ({ uri: c.web?.uri ?? "", domain: (c.web?.domain ?? c.web?.title ?? "").toLowerCase() }));
  const listed = parseHits(response.text ?? "");
  const grounded = new Set(chunks.map((c) => baseDomain(c.domain)).filter(Boolean));
  const hits: NameHit[] = [];
  const add = (h: NameHit) => {
    if (!hits.some((x) => x.url === h.url)) hits.push(h);
  };
  for (const h of listed.slice(0, 12)) {
    if (GROUNDING_REDIRECT.test(h.url)) {
      // Only Google Search grounding produces these links: resolve to the real page URL.
      const url = await resolve(h.url);
      if (url && /^https?:\/\//.test(url)) add({ url, title: h.title });
      continue;
    }
    try {
      if (grounded.has(baseDomain(new URL(h.url).hostname.toLowerCase()))) add(h);
    } catch {}
  }
  // The grounding sources themselves.
  for (const c of chunks.slice(0, 10)) {
    const url = GROUNDING_REDIRECT.test(c.uri) ? await resolve(c.uri) : null;
    if (url && /^https?:\/\//.test(url)) add({ url, title: c.domain || url });
  }
  // No grounding evidence at all (no sources, no grounding links) → nothing is trusted.
  return hits.slice(0, 10);
}
