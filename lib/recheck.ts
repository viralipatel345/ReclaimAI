// The recheck agent (server). For every content link in an open case:
//   fetch the page as TEXT ONLY (or a demo fixture) → classify removed | live | unclear
//   → log evidence → apply transitions (confirm removal, re-file re-uploads, ask when unclear).
// Then: check Google for the user's own name (results wait for her confirmation),
// chase pending requests, and schedule the next run (3 days; weekly after 30 clean days).
//
// Gemini's urlContext tool is deliberately NOT used: it would let Google fetch the page for
// the model, and we couldn't guarantee images are stripped first. We fetch text ourselves.
import { demoFixture } from "@/data/demoPages";
import { runAgent } from "./agent";
import { MODELS } from "./config";
import { chase } from "./escalation";
import { withTimeout } from "./demoCache";
import { searchOwnNameGrounded } from "./nameSearch";
import { fetchPageText, NotTextError, type PageText } from "./pageText";
import { addNameResults, applyPageStatus, latestRequestFor, scheduleNext } from "./recheckOps";
import type { Case, PageStatus } from "./types";

export interface PageCheck {
  status: PageStatus;
  title: string;
  reason: string;
  source: "fixture" | "http" | "rules" | "gemini";
}

const REMOVED_TEXT =
  /(this (post|page|content|video|file|tweet|account) (has been|was|is) (removed|deleted|unavailable|no longer available)|(post|page|content|file) (not found|unavailable|doesn'?t exist)|removed (by|for violating)|violated the .* rules|account (suspended|terminated)|sorry, (this|that) (page|post) (isn'?t|is not) available|404 not found|no longer available)/i;

export type PageClassifier = (page: PageText) => Promise<{ status?: string; reason?: string }>;

const defaultClassifier: PageClassifier = async (page) => {
  const run = await runAgent<{ status?: string; reason?: string }>({
    model: MODELS.primary, // Gemini 3.1 Pro: judgment call
    systemInstruction:
      "You check whether content reported for removal is still up. You get a page's title and visible TEXT only (all images and media were stripped before you saw it). removed = the page says the content is gone/unavailable/removed or the account is suspended. live = the page clearly still shows the original post or file. unclear = login walls, age gates, errors, captchas, or anything else. Never guess: prefer unclear.",
    contents: [{ role: "user", parts: [{ text: `Title: ${page.title}\nHTTP status: ${page.httpStatus}\nText: ${page.text.slice(0, 3000)}` }] }],
    tools: ["recheck"],
    finalTool: "recheck",
    maxSteps: 2,
  });
  return run.output;
};

export async function classifyPage(page: PageText, classifier: PageClassifier = defaultClassifier): Promise<PageCheck> {
  if (page.httpStatus === 404 || page.httpStatus === 410) return { status: "removed", title: page.title, reason: `HTTP ${page.httpStatus}`, source: "http" };
  if (page.httpStatus >= 400) return { status: "unclear", title: page.title, reason: `HTTP ${page.httpStatus}`, source: "http" };
  if (REMOVED_TEXT.test(`${page.title} ${page.text}`)) return { status: "removed", title: page.title, reason: "Page says the content was removed.", source: "rules" };
  try {
    const out = await classifier(page);
    const status: PageStatus = out.status === "removed" || out.status === "live" ? out.status : "unclear";
    return { status, title: page.title, reason: String(out.reason ?? "").slice(0, 200), source: "gemini" };
  } catch {
    return { status: "unclear", title: page.title, reason: "Couldn't classify the page.", source: "rules" };
  }
}

export interface RecheckDeps {
  demo: boolean;
  fetchText?: (url: string) => Promise<PageText>;
  classifier?: PageClassifier;
  searchName?: (name: string) => Promise<{ url: string; title: string }[]>;
}

async function checkLink(c: Case, url: string, deps: RecheckDeps): Promise<PageCheck> {
  const fixture = deps.demo ? demoFixture(url) : undefined;
  if (fixture) {
    // Demo: fictional URLs (seed links, sandbox posts) are served from fixtures — never fetched.
    // Any other link (e.g. a team-owned test post for a live demo) is re-checked for real below.
    const state = c.demoPageState?.[url] ?? "live";
    if (state === "unclear") return { status: "unclear", title: fixture.live.title, reason: "Fixture marked unclear.", source: "fixture" };
    const page = fixture[state];
    return { status: state, title: page.title, reason: page.text, source: "fixture" };
  }
  try {
    const page = await (deps.fetchText ?? fetchPageText)(url);
    return classifyPage(page, deps.classifier);
  } catch (e) {
    const reason = e instanceof NotTextError ? "Not a web page (media is never downloaded)." : "Couldn't load the page.";
    return { status: "unclear", title: "", reason, source: "http" };
  }
}

/**
 * Google results for the user's OWN name (the only person-related search Reclaim does).
 * Uses the Programmable Search JSON API when configured; results are titles + links only
 * and are never fetched or acted on until she confirms each one.
 */
export async function searchOwnName(name: string): Promise<{ url: string; title: string }[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx || !name) return []; // stub until configured
  const q = new URLSearchParams({ key, cx, q: `"${name}"`, num: "10", safe: "off" });
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${q}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: { link?: string; title?: string }[] };
  return (data.items ?? []).filter((i) => i.link).map((i) => ({ url: i.link!, title: String(i.title ?? i.link) }));
}

export interface RecheckResult {
  case: Case;
  changes: number;
  checked: number;
}

export async function runRecheck(c: Case, now: number, deps: RecheckDeps): Promise<RecheckResult> {
  const at = new Date(now).toISOString();
  let next = c;
  let changes = 0;
  let checked = 0;

  for (const link of c.links) {
    if (link.kind !== "content" || !latestRequestFor(next, link.id)?.sentAt) continue;
    const check = await checkLink(next, link.url, deps);
    checked++;
    const applied = applyPageStatus(next, link.id, check.status, at, deps.demo, check.title || undefined);
    next = applied.next;
    if (applied.changed) changes++;
  }

  // Own-name check: Programmable Search if configured, else Gemini with Google Search grounding.
  const nameSearch = deps.searchName ?? (process.env.GOOGLE_CSE_API_KEY ? searchOwnName : (n: string) => searchOwnNameGrounded(n));
  const results = deps.demo ? (next.demoNameResults ?? []) : await withTimeout(nameSearch(next.legalName), 30000).catch(() => []);
  const named = addNameResults(next, results, at);
  next = named.next;
  changes += named.added;

  const chased = chase(next, now, deps.demo);
  if (chased !== next) changes++;
  next = scheduleNext(chased, now);
  return { case: next, changes, checked };
}
