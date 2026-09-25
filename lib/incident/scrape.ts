// Branch B: automated discovery scrape. Searches the web for the case, pulls media
// references from the top hits, and records everything as ScrapeData flagged DISCOVER.
// Media found here is scanned by the provenance engine in the orchestrator.
import { newId } from "../ids";
import { extractMediaUrls, searchWeb, type WebSearch } from "./context";
import type { ScrapeData, ScrapeSource } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/scrape is server-only");

const PAGE_TIMEOUT_MS = 10_000;
const MAX_PAGES = 5;

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Reclaim-Discover/1.0" }, signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    return (await res.text()).slice(0, 500_000);
  } catch {
    return null;
  }
}

export interface DiscoverInput {
  caseId: string;
  query: string;
  /** URLs the user already knows about; always crawled first. */
  seedUrls?: string[];
}

export async function runDiscoverScrape(input: DiscoverInput, search: WebSearch = searchWeb): Promise<ScrapeData> {
  const startedAt = new Date().toISOString();
  const seeds: ScrapeSource[] = (input.seedUrls ?? []).map((url) => ({ url, title: url, snippet: "", fetchedAt: startedAt }));
  const found = await search(input.query);
  const seen = new Set<string>();
  const sources = [...seeds, ...found].filter((s) => !seen.has(s.url) && seen.add(s.url));

  const mediaUrls = new Set<string>();
  await Promise.all(
    sources.slice(0, MAX_PAGES).map(async (s) => {
      const html = await fetchPage(s.url);
      if (!html) return;
      if (!s.title || s.title === s.url) s.title = html.match(/<title[^>]*>([^<]{1,200})/i)?.[1].trim() ?? s.url;
      for (const u of extractMediaUrls(html, s.url)) mediaUrls.add(u);
    }),
  );

  return {
    id: newId("scr"),
    caseId: input.caseId,
    decision: "DISCOVER",
    query: input.query,
    sources,
    mediaUrls: [...mediaUrls],
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
