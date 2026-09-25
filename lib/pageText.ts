// Safe, text-only page fetch for re-checks (hard rule 1).
// - http(s) only, public hosts only (no localhost / private ranges)
// - Accept: text/html; any non-text response is rejected WITHOUT reading its body
// - hard size cap and timeout
// - every media element, attribute and data: URI is stripped; only title + text remain
// Nothing fetched here is stored: callers keep the title and a status, never the body.

export interface PageText {
  httpStatus: number;
  title: string;
  text: string;
}

export class NotTextError extends Error {}

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8000;

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:|metadata\.google\.internal)/i;

export function isFetchableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && !PRIVATE_HOST.test(u.hostname) && u.hostname.includes(".");
  } catch {
    return false;
  }
}

const MEDIA_BLOCKS = /<(script|style|noscript|svg|video|audio|picture|canvas|iframe|object|embed|template|figure)\b[\s\S]*?<\/\1\s*>/gi;
const MEDIA_TAGS = /<(img|source|track|image|input|link|meta|video|audio|embed|object|iframe)\b[^>]*>/gi;

/** Reduce HTML to title + visible text. No URLs, no media references survive. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const text = html
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(MEDIA_BLOCKS, " ")
    .replace(MEDIA_TAGS, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, (m) => decodeEntities(m))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
  return { title: decodeEntities(title), text };
}

const NAMED: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", mdash: "—", ndash: "–", middot: "·" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

export async function fetchPageText(url: string, fetchImpl: typeof fetch = fetch): Promise<PageText> {
  if (!isFetchableUrl(url)) throw new Error("URL not allowed");
  const res = await fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5", "User-Agent": "ReclaimRecheck/1.0 (+removal verification; text only)" },
  });
  const type = res.headers.get("content-type") ?? "";
  if (!/^(text\/html|application\/xhtml\+xml|text\/plain)/i.test(type)) {
    // Never read a non-text body (images, video, octet-stream).
    await res.body?.cancel().catch(() => {});
    throw new NotTextError(`Refused non-text response (${type || "unknown type"})`);
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return { httpStatus: res.status, title: "", text: "" };
  }
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  const html = new TextDecoder().decode(Buffer.concat(chunks));
  return { httpStatus: res.status, ...htmlToText(html) };
}

/**
 * Raw text of a page or feed (HTML/XML), same safety rules as fetchPageText: public hosts
 * only, text types only (non-text bodies are never read), size cap, timeout.
 */
export async function fetchRawText(url: string, fetchImpl: typeof fetch = fetch): Promise<{ status: number; text: string; finalUrl: string }> {
  if (!isFetchableUrl(url)) throw new Error("URL not allowed");
  const res = await fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8", "User-Agent": "ReclaimRecheck/1.0 (+removal verification; text only)" },
  });
  const type = res.headers.get("content-type") ?? "";
  if (!/^(text\/|application\/(rss\+xml|atom\+xml|xml|xhtml\+xml))/i.test(type)) {
    await res.body?.cancel().catch(() => {});
    throw new NotTextError(`Refused non-text response (${type || "unknown type"})`);
  }
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  return { status: res.status, text: new TextDecoder().decode(Buffer.concat(chunks)), finalUrl: res.url || url };
}
