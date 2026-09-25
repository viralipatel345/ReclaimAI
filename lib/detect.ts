// Live detection: find more posts on an account the user already reported, using TEXT
// ONLY — caption, hashtags, comments. Images are never opened, downloaded or analyzed.
// Nothing is filed until the user confirms each match.
import { activity, addLink, draftRequests, evidenceFor } from "./caseOps";
import type { Case, TakedownRequest } from "./types";

export type MatchLevel = "likely" | "possible" | "unrelated";

export interface PostText {
  id: string;
  url: string;
  caption: string;
  comments: { user: string; text: string }[];
}

export interface DetectContext {
  legalName: string;
  /** URLs already in the case (reported content). */
  knownUrls: string[];
  /** Platforms in the case, e.g. "Reddit", "X". */
  platformNames: string[];
}

export interface Signal {
  level: Exclude<MatchLevel, "unrelated">;
  text: string;
}

const RANK: Record<MatchLevel, number> = { unrelated: 0, possible: 1, likely: 2 };

export function detectContext(c: Case): DetectContext {
  return {
    legalName: c.legalName,
    knownUrls: c.links.filter((l) => l.kind === "content").map((l) => l.url),
    platformNames: [...new Set(c.requests.map((r) => r.platformName))],
  };
}

const norm = (s: string) => s.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");

/** Deterministic evidence. These decide the match level; the model can't invent one. */
export function ruleSignals(p: PostText, ctx: DetectContext): Signal[] {
  const out: Signal[] = [];
  const all = [p.caption, ...p.comments.map((c) => c.text)].join("\n");
  const text = norm(all);
  const [first = "", last = ""] = ctx.legalName.toLowerCase().split(/\s+/);

  if (first && last && (text.includes(`${first} ${last}`) || text.includes(`@${first}.${last}`) || text.includes(`@${first}${last}`) || text.includes(`@${first}_${last}`)))
    out.push({ level: "likely", text: `Names or tags you (“${ctx.legalName}”).` });
  for (const u of ctx.knownUrls) {
    if (text.includes(norm(u).replace(/\/$/, ""))) out.push({ level: "likely", text: "Links to content you already reported." });
  }
  const mentionsRemoval = /(took (it )?down|taken down|got removed|was removed|reposting|re-?upload)/.test(text);
  const mentionsPlatform = ctx.platformNames.some((n) => n.length > 1 && text.includes(n.toLowerCase())) || /r\/[a-z0-9_]+/.test(text);
  if (mentionsRemoval && mentionsPlatform) out.push({ level: "likely", text: "Says it’s re-posting content another platform removed." });

  if (!out.length) {
    if (first && new RegExp(`\\b${first}\\b`).test(text)) out.push({ level: "possible", text: `Mentions “${ctx.legalName.split(" ")[0]}”.` });
    const initials = ctx.legalName.split(/\s+/).map((w) => w[0]?.toLowerCase()).join("");
    if (initials.length === 2 && new RegExp(`\\b${initials[0]}\\.?\\s?${initials[1]}\\.?(?![a-z])`).test(text))
      out.push({ level: "possible", text: `Uses your initials (${initials.toUpperCase().split("").join(".")}.).` });
  }
  return out;
}

export function ruleLevel(signals: Signal[]): MatchLevel {
  return signals.reduce<MatchLevel>((lvl, s) => (RANK[s.level] > RANK[lvl] ? s.level : lvl), "unrelated");
}

/**
 * Combine rules with the model's opinion. The model may raise an unrelated post to
 * "possible" (so she can look), but never to "likely", and never lowers evidence.
 */
export function combineLevels(rule: MatchLevel, model: MatchLevel | undefined): MatchLevel {
  if (!model) return rule;
  if (rule === "unrelated") return model === "unrelated" ? "unrelated" : "possible";
  return rule;
}

export interface Detection {
  postId: string;
  url: string;
  level: MatchLevel;
  signals: string[];
  /** One sentence from Gemini explaining the call (or the rule text when unavailable). */
  explanation: string;
  source: "gemini" | "rules";
}

/** Add confirmed posts as links and draft one request per platform. Nothing is sent. */
export function addDetectedLinks(c: Case, confirmed: { url: string; caption: string }[], at: string): { next: Case; requests: TakedownRequest[] } {
  const fresh = confirmed.filter((d) => !c.links.some((l) => l.url === d.url));
  if (!fresh.length) return { next: c, requests: [] };
  let next = c;
  for (const d of fresh) next = addLink(next, d.url, at, undefined, `Instagram post · ${d.caption.slice(0, 60)}`);
  const newLinks = next.links.slice(-fresh.length);
  const requests = draftRequests({ ...next, links: newLinks }, at);
  next = {
    ...next,
    requests: [...next.requests, ...requests],
    evidence: [...next.evidence, ...newLinks.map((l) => evidenceFor(l, "logged", at, { note: "Found by live detection; confirmed by you." }))],
    activity: [
      activity(`Live detection: you confirmed ${fresh.length} post${fresh.length > 1 ? "s" : ""}. ${requests.map((r) => `${r.platformName} request drafted`).join(", ")}.`, "accent", at),
      ...next.activity,
    ],
  };
  return { next, requests };
}
