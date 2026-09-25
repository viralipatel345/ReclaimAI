// Fetch the primary image of a public web page (og:image) for provenance / AI checks.
// Provenance carve-out: bytes are held in memory for the check and dropped. Instagram
// serves og:image to link-preview crawlers, so the request identifies as one.
import { isFetchableUrl } from "../pageText";
import { mediaKindOf } from "./index";

if (typeof window !== "undefined") throw new Error("lib/provenance/fetchImage is server-only");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

export function extractOgImage(html: string, base: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i);
  if (!m) return null;
  try {
    const u = new URL(m[1].replace(/&amp;/g, "&"), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface FetchedImage {
  buffer: Buffer;
  mimeType: string;
  imageUrl: string;
}

/** `page` says whether the page itself loaded (proves the link is real) even when no image could be taken from it. */
export interface PageImageResult {
  page: "ok" | "unreachable";
  image: FetchedImage | null;
}

export async function fetchPageImage(pageUrl: string, fetchImpl: typeof fetch = fetch): Promise<PageImageResult> {
  const none: PageImageResult = { page: "unreachable", image: null };
  if (!isFetchableUrl(pageUrl)) return none;
  try {
    const page = await fetchImpl(pageUrl, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(10_000), redirect: "follow" });
    if (!page.ok || !(page.headers.get("content-type") ?? "").includes("text/html")) return none;
    const imageUrl = extractOgImage((await page.text()).slice(0, 400_000), page.url || pageUrl);
    if (!imageUrl || !isFetchableUrl(imageUrl)) return { page: "ok", image: null };

    const img = await fetchImpl(imageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
    const mimeType = (img.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!img.ok || mediaKindOf(mimeType) !== "image") return { page: "ok", image: null };
    const len = Number(img.headers.get("content-length") ?? 0);
    if (len > MAX_IMAGE_BYTES) return { page: "ok", image: null };
    const buffer = Buffer.from(await img.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) return { page: "ok", image: null };
    return { page: "ok", image: { buffer, mimeType, imageUrl } };
  } catch {
    return none;
  }
}
