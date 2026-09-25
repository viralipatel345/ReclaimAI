// Pure case transitions shared by client and server. No I/O here.
import { DEADLINE_HOURS } from "./config";
import { fingerprint } from "./hash";
import { newId } from "./ids";
import { hostOf, matchDirectory, nameFromSearchUrl, unresolvedPlatform } from "./platforms";
import { renderGoogleRemoval, renderTakedownRequest } from "./templates";
import type { ActivityItem, ActivityTone, Case, CaseLink, EvidenceEntry, ResolvedPlatform, TakedownRequest } from "./types";
import { addHours } from "./time";

export type DisplayStatus = "draft" | "ready" | "in_progress" | "acknowledged" | "removed" | "overdue" | "rejected" | "unclear";

export function displayStatus(req: TakedownRequest, now: number): DisplayStatus {
  if (req.status === "removed") return "removed";
  if (req.status === "rejected") return "rejected";
  if (req.status === "unclear") return "unclear";
  if (req.status === "draft" || req.status === "ready") return req.status;
  if (req.deadlineAt && now > new Date(req.deadlineAt).getTime()) return "overdue";
  return req.status === "acknowledged" ? "acknowledged" : "in_progress";
}

export function activity(text: string, tone: ActivityTone, at: string): ActivityItem {
  return { id: newId("act"), at, text, tone };
}

export function evidenceFor(link: CaseLink, event: EvidenceEntry["event"], at: string, extra: Partial<EvidenceEntry> = {}): EvidenceEntry {
  const pageTitle = link.pageTitle ?? link.url;
  return {
    id: newId("ev"),
    url: link.url,
    host: link.host,
    platformName: link.platform.name,
    event,
    at,
    firstSeenAt: link.addedAt,
    pageTitle,
    fingerprint: fingerprint(link.url, pageTitle),
    ...extra,
  };
}

export function makeLink(url: string, at: string, platform?: ResolvedPlatform, pageTitle?: string): CaseLink {
  const resolved = platform ?? matchDirectory(url) ?? unresolvedPlatform(url);
  return {
    id: newId("lnk"),
    url,
    host: hostOf(url),
    kind: resolved.id === "google-search" ? "name_search" : "content",
    platform: resolved,
    addedAt: at,
    pageTitle,
  };
}

/** Group content links by platform into one request each; name searches become Google removals. */
export function draftRequests(c: Case, at: string, openings: Record<string, string> = {}): TakedownRequest[] {
  const byPlatform = new Map<string, CaseLink[]>();
  for (const link of c.links) {
    const list = byPlatform.get(link.platform.id) ?? [];
    list.push(link);
    byPlatform.set(link.platform.id, list);
  }
  const signedAt = c.attestation.signedAt ?? at;
  return [...byPlatform.values()].map((links) => {
    const p = links[0].platform;
    const common = {
      platformName: p.name,
      coveredByAct: p.coveredByAct,
      urls: links.map((l) => l.url),
      legalName: c.legalName,
      contactEmail: c.contactEmail,
      signature: c.attestation.signature,
      signedAt,
      opening: openings[p.id],
    };
    const isGoogle = links[0].kind === "name_search";
    const rendered = isGoogle
      ? renderGoogleRemoval({ ...common, searchedName: nameFromSearchUrl(links[0].url) ?? c.legalName })
      : renderTakedownRequest(common);
    return {
      id: newId("req"),
      kind: isGoogle ? "google_removal" : "takedown",
      platformId: p.id,
      platformName: p.name,
      channel: p.channel,
      target: p.target,
      coveredByAct: p.coveredByAct,
      linkIds: links.map((l) => l.id),
      subject: rendered.subject,
      opening: rendered.opening,
      body: rendered.body,
      status: p.channel ? "ready" : "draft",
      createdAt: at,
      remindersDrafted: [],
    } satisfies TakedownRequest;
  });
}

export function markSent(c: Case, requestIds: string[], at: string, simulated: boolean): Case {
  const ids = new Set(requestIds);
  const requests = c.requests.map((r) =>
    ids.has(r.id) && (r.status === "ready" || r.status === "draft")
      ? { ...r, status: "sent" as const, sentAt: at, deadlineAt: addHours(at, DEADLINE_HOURS), simulated }
      : r,
  );
  const sent = requests.filter((r) => ids.has(r.id) && r.sentAt === at);
  const evidence = sent.flatMap((r) =>
    c.links.filter((l) => r.linkIds.includes(l.id)).map((l) => evidenceFor(l, "sent", at, { sentAt: at })),
  );
  const acts = sent.map((r) =>
    activity(`Request sent to ${r.platformName}${simulated ? " (demo)" : ""}. 48-hour clock started.`, "accent", at),
  );
  return { ...c, requests, evidence: [...c.evidence, ...evidence], activity: [...acts, ...c.activity] };
}

export function counts(c: Case, now: number) {
  const tally = { removed: 0, inProgress: 0, overdue: 0, ready: 0 };
  for (const r of c.requests) {
    const s = displayStatus(r, now);
    if (s === "removed") tally.removed++;
    else if (s === "overdue") tally.overdue++;
    else if (s === "ready" || s === "draft") tally.ready++;
    else tally.inProgress++;
  }
  return tally;
}

export function linksFor(c: Case, r: TakedownRequest): CaseLink[] {
  return c.links.filter((l) => r.linkIds.includes(l.id));
}

export function addLink(c: Case, url: string, at: string, platform?: ResolvedPlatform, pageTitle?: string): Case {
  if (c.links.some((l) => l.url === url)) return c;
  const link = makeLink(url, at, platform, pageTitle);
  return {
    ...c,
    links: [...c.links, link],
    evidence: [...c.evidence, evidenceFor(link, "logged", at)],
  };
}

export function removeLink(c: Case, linkId: string): Case {
  return { ...c, links: c.links.filter((l) => l.id !== linkId) };
}

/** Re-render one request's body with a new opening. Legal sections come from the fixed template. */
export function withOpening(c: Case, req: TakedownRequest, opening: string): TakedownRequest {
  const fresh = draftRequests({ ...c, links: linksFor(c, req) }, req.createdAt, { [req.platformId]: opening })[0];
  return { ...req, opening: fresh.opening, body: fresh.body, subject: fresh.subject };
}
