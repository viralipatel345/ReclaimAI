// Live detection on a REAL account: read the reported account's public RSS/Atom feed as
// text (captions, titles). Images in feed HTML are stripped; nothing is ever downloaded
// except text. No logins, no scraping behind walls — if there's no public feed, we say so.
import type { PostText } from "./detect";
import { fetchRawText, htmlToText, isFetchableUrl } from "./pageText";

export interface FeedAccount {
  title: string;
  url: string;
  feedUrl: string;
}

export interface ScanResult {
  account: FeedAccount;
  posts: PostText[];
}

/** Tumblr account + feed for a post or blog URL (both blog.tumblr.com and www.tumblr.com/blog forms). */
export function tumblrFeed(url: string): FeedAccount | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let blog = "";
  if (host.endsWith(".tumblr.com") && host !== "www.tumblr.com") blog = host.slice(0, -".tumblr.com".length);
  else if (host === "www.tumblr.com" || host === "tumblr.com") blog = u.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!/^[a-z0-9-]+$/i.test(blog) || ["blog", "dashboard", "explore", "tagged", "search"].includes(blog)) return null;
  return { title: blog, url: `https://${blog}.tumblr.com/`, feedUrl: `https://${blog}.tumblr.com/rss` };
}

const decode = (s: string) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1].trim()) : "";
}

/** RSS <item> or Atom <entry> → text-only posts. HTML inside is reduced to text (no media survives). */
export function parseFeed(xml: string, limit = 20): { title: string; items: { url: string; text: string }[] } {
  const channelTitle = decode((xml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items = blocks.slice(0, limit).map((b) => {
    const link = tag(b, "link") || b.match(/<link\b[^>]*href="([^"]+)"/i)?.[1] || tag(b, "guid");
    const title = htmlToText(`<p>${tag(b, "title")}</p>`).text;
    const body = htmlToText(`<body>${tag(b, "description") || tag(b, "content") || tag(b, "summary")}</body>`).text;
    const text = [title, body].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" — ");
    return { url: decode(link).trim(), text: text.slice(0, 1200) };
  });
  return { title: htmlToText(`<p>${channelTitle}</p>`).text, items: items.filter((i) => i.url && isFetchableUrl(i.url)) };
}

/** Find the public feed behind a reported link. */
export async function discoverFeed(url: string, fetchText = fetchRawText): Promise<FeedAccount | null> {
  const t = tumblrFeed(url);
  if (t) return t;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return null;
  }
  try {
    const page = await fetchText(origin + "/");
    const link = page.text.match(/<link\b[^>]*rel=["']alternate["'][^>]*type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[0];
    const href = link?.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) return { title: new URL(origin).hostname, url: origin + "/", feedUrl: new URL(href, origin).toString() };
  } catch {}
  return null;
}

export async function scanAccount(url: string, fetchText = fetchRawText): Promise<ScanResult | null> {
  const account = await discoverFeed(url, fetchText);
  if (!account) return null;
  const feed = await fetchText(account.feedUrl);
  if (feed.status >= 400) return null;
  const parsed = parseFeed(feed.text);
  return {
    account: { ...account, title: parsed.title || account.title },
    posts: parsed.items.map((i, n) => ({ id: `post-${n}-${i.url.slice(-24)}`, url: i.url, caption: i.text || "(no text)", comments: [] })),
  };
}
