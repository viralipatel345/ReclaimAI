// Context engine: web search across whichever provider is configured
// (Tavily → SerpAPI → Google Programmable Search). Returns nothing rather than
// guessing when none is set, so the orchestrator falls back to rules honestly.
import type { ScrapeSource } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/context is server-only");

export type WebSearch = (query: string, limit?: number) => Promise<ScrapeSource[]>;

export function searchConfigured(): boolean {
  return !!(process.env.TAVILY_API_KEY || process.env.SERPAPI_API_KEY || (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID));
}

async function tavily(query: string, limit: number): Promise<ScrapeSource[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: limit, include_images: true }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: { url: string; title?: string; content?: string }[] };
  const fetchedAt = new Date().toISOString();
  return (json.results ?? []).map((r) => ({ url: r.url, title: r.title ?? r.url, snippet: (r.content ?? "").slice(0, 400), fetchedAt }));
}

async function serpapi(query: string, limit: number): Promise<ScrapeSource[]> {
  const params = new URLSearchParams({ engine: "google", q: query, num: String(limit), api_key: process.env.SERPAPI_API_KEY! });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { organic_results?: { link: string; title?: string; snippet?: string }[] };
  const fetchedAt = new Date().toISOString();
  return (json.organic_results ?? []).slice(0, limit).map((r) => ({ url: r.link, title: r.title ?? r.link, snippet: r.snippet ?? "", fetchedAt }));
}

async function googleCse(query: string, limit: number): Promise<ScrapeSource[]> {
  const params = new URLSearchParams({ key: process.env.GOOGLE_CSE_API_KEY!, cx: process.env.GOOGLE_CSE_ID!, q: query, num: String(Math.min(limit, 10)) });
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: { link: string; title?: string; snippet?: string }[] };
  const fetchedAt = new Date().toISOString();
  return (json.items ?? []).map((r) => ({ url: r.link, title: r.title ?? r.link, snippet: r.snippet ?? "", fetchedAt }));
}

export const searchWeb: WebSearch = async (query, limit = 6) => {
  if (!query.trim()) return [];
  try {
    if (process.env.TAVILY_API_KEY) return await tavily(query, limit);
    if (process.env.SERPAPI_API_KEY) return await serpapi(query, limit);
    if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID) return await googleCse(query, limit);
  } catch (err) {
    console.warn("[context] search failed", err instanceof Error ? err.message : err);
  }
  return [];
};

/** Media URLs referenced by a page (og:image, <img>, <video>/<source>). Absolute URLs only. */
export function extractMediaUrls(html: string, base: string): string[] {
  const out = new Set<string>();
  const add = (u: string | undefined) => {
    if (!u) return;
    try {
      const abs = new URL(u, base);
      if (abs.protocol === "http:" || abs.protocol === "https:") out.add(abs.toString());
    } catch {}
  };
  for (const m of html.matchAll(/<meta[^>]+property=["']og:(?:image|video)(?::url)?["'][^>]+content=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<(?:img|video|source)[^>]+src=["']([^"']+)["']/gi)) add(m[1]);
  return [...out].slice(0, 20);
}
