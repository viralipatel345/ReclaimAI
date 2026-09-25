import directory from "@/data/platforms.json";
import type { PlatformDirectoryEntry, ResolvedPlatform } from "./types";

export const PLATFORMS = directory as PlatformDirectoryEntry[];

export const UNRESOLVED_MESSAGE = "Couldn't confirm — use the site's contact page";

/** Accepts user input, adds https:// if missing, and only allows http(s) URLs. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Pull the first http(s) URL out of shared text (Android often puts the link in `text`). */
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? normalizeUrl(m[0]) : normalizeUrl(text);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host: string, entryHost: string): boolean {
  return host === entryHost || host.endsWith(`.${entryHost}`);
}

export function toResolved(entry: PlatformDirectoryEntry): ResolvedPlatform {
  return {
    id: entry.id,
    name: entry.name,
    channel: entry.channel,
    target: entry.target,
    confidence: 1,
    source: "directory",
    coveredByAct: entry.coveredByAct,
    fictional: entry.fictional,
  };
}

/** Directory lookup only — no network. Returns null when the host isn't in platforms.json. */
export function matchDirectory(url: string): ResolvedPlatform | null {
  const host = hostOf(url);
  if (!host) return null;
  let path = "/";
  try {
    path = new URL(url).pathname;
  } catch {}
  const entry = PLATFORMS.find(
    (p) => p.hosts.some((h) => hostMatches(host, h)) && (!p.pathPrefix || path.startsWith(p.pathPrefix)),
  );
  return entry ? toResolved(entry) : null;
}

export function unresolvedPlatform(url: string): ResolvedPlatform {
  const host = hostOf(url);
  return {
    id: `unresolved:${host}`,
    name: host || "Unknown site",
    channel: null,
    target: null,
    confidence: 0,
    source: "unresolved",
    coveredByAct: true,
    message: UNRESOLVED_MESSAGE,
  };
}

/** True for a Google Search results URL (the user's own-name search). */
export function isNameSearch(url: string): boolean {
  return matchDirectory(url)?.id === "google-search";
}

export function nameSearchUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${name}"`)}`;
}

export function nameFromSearchUrl(url: string): string | null {
  try {
    const q = new URL(url).searchParams.get("q");
    return q ? q.replace(/^"|"$/g, "") : null;
  } catch {
    return null;
  }
}
