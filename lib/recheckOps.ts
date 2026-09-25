// Pure re-check transitions, shared by the server recheck agent and the client UI.
import { activity, addLink, draftRequests, evidenceFor, markSent } from "./caseOps";
import { DAY_MS, RECHECK_INTERVAL_DAYS, WEEKLY_AFTER_CLEAN_DAYS } from "./config";
import { newId } from "./ids";
import { renderTakedownRequest } from "./templates";
import type { Case, CaseLink, NameResult, PageStatus, ResolvedPlatform, TakedownRequest } from "./types";

/** The most recent request covering a link. */
export function latestRequestFor(c: Case, linkId: string): TakedownRequest | undefined {
  return [...c.requests].reverse().find((r) => r.linkIds.includes(linkId));
}

const canAutoSend = (c: Case) => c.autoSendConsent && !c.reviewEachBeforeSending;

/**
 * Re-upload: the content is live again after removal. File a new request that cites the
 * original one. Sent immediately when the user gave one-time auto-send consent.
 */
export function refile(c: Case, original: TakedownRequest, link: CaseLink, at: string, simulated: boolean): Case {
  if (c.requests.some((r) => r.kind === "refile" && r.parentRequestId === original.id && r.status !== "removed")) return c;
  const rendered = renderTakedownRequest({
    platformName: original.platformName,
    coveredByAct: original.coveredByAct,
    urls: [link.url],
    legalName: c.legalName,
    contactEmail: c.contactEmail,
    signature: c.attestation.signature,
    signedAt: c.attestation.signedAt ?? at,
    opening: `Hello ${original.platformName} Trust & Safety team,\n\nContent I reported earlier has been uploaded again. Please remove it promptly.`,
    refileOf: { requestId: original.id, sentAt: original.sentAt ?? at },
  });
  const req: TakedownRequest = {
    id: newId("req"),
    kind: "refile",
    platformId: original.platformId,
    platformName: original.platformName,
    channel: original.channel,
    target: original.target,
    coveredByAct: original.coveredByAct,
    linkIds: [link.id],
    subject: rendered.subject,
    opening: rendered.opening,
    body: rendered.body,
    status: original.channel ? "ready" : "draft",
    createdAt: at,
    remindersDrafted: [],
    parentRequestId: original.id,
    openingSource: "template",
  };
  let next: Case = {
    ...c,
    requests: [...c.requests, req],
    evidence: [...c.evidence, evidenceFor(link, "refiled", at, { note: `Re-upload detected; new request ${req.id} cites ${original.id}.` })],
    activity: [
      activity(
        canAutoSend(c) && req.channel
          ? `Re-upload found on ${original.platformName}. New request filed automatically, citing your original request.`
          : `Re-upload found on ${original.platformName}. A new request citing your original is ready to send.`,
        "overdue",
        at,
      ),
      ...c.activity,
    ],
  };
  if (canAutoSend(c) && req.channel) next = markSent(next, [req.id], at, simulated);
  return next;
}

/** Apply one page check. Returns the case unchanged when nothing changed (evidence aside). */
export function applyPageStatus(c: Case, linkId: string, status: PageStatus, at: string, simulated: boolean, pageTitle?: string): { next: Case; changed: boolean } {
  const link = c.links.find((l) => l.id === linkId);
  if (!link) return { next: c, changed: false };
  const req = latestRequestFor(c, linkId);
  const wasUnclear = !!link.needsUserCheck;
  const links = c.links.map((l) =>
    l.id === linkId ? { ...l, pageTitle: pageTitle || l.pageTitle, lastCheck: { at, status }, needsUserCheck: status === "unclear" } : l,
  );
  let next: Case = {
    ...c,
    links,
    evidence: [...c.evidence, evidenceFor({ ...link, pageTitle: pageTitle || link.pageTitle }, "recheck", at, { sentAt: req?.sentAt, note: `Re-check: ${status}.` })],
  };
  if (!req?.sentAt) return { next, changed: false };

  if (status === "unclear") {
    if (!wasUnclear) {
      next = { ...next, activity: [activity(`Couldn't tell if the ${req.platformName} link is still up. Can you check it?`, "neutral", at), ...next.activity] };
      return { next, changed: true };
    }
    return { next, changed: false };
  }
  if (status === "removed" && req.status !== "removed") {
    next = {
      ...next,
      requests: next.requests.map((r) => (r.id === req.id ? { ...r, status: "removed" as const, removedAt: at } : r)),
      activity: [activity(`Re-check confirmed ${req.platformName} removed the content.`, "removed", at), ...next.activity],
    };
    return { next, changed: true };
  }
  if (status === "live" && req.status === "removed") {
    return { next: refile(next, req, link, at, simulated), changed: true };
  }
  return { next, changed: false };
}

/** The user answers an "is it still up?" question. Reclaim never guesses. */
export function answerUnclear(c: Case, linkId: string, stillUp: boolean, at: string, simulated: boolean): Case {
  const cleared = { ...c, links: c.links.map((l) => (l.id === linkId ? { ...l, needsUserCheck: false } : l)) };
  return applyPageStatus(cleared, linkId, stillUp ? "live" : "removed", at, simulated).next;
}

/** Add a link and its own request; auto-send when consented. Used by share and by confirmed name results. */
export function addLinkWithRequest(c: Case, url: string, at: string, simulated: boolean, platform?: ResolvedPlatform): { next: Case; request?: TakedownRequest } {
  const existing = c.links.find((l) => l.url === url);
  if (existing) return { next: c, request: latestRequestFor(c, existing.id) };
  let next = addLink(c, url, at, platform);
  const link = next.links[next.links.length - 1];
  const [req] = draftRequests({ ...next, links: [link] }, at);
  next = { ...next, requests: [...next.requests, req] };
  if (canAutoSend(next) && next.attestation.signedAt && req.channel) next = markSent(next, [req.id], at, simulated);
  return { next, request: next.requests.find((r) => r.id === req.id) };
}

export function addNameResults(c: Case, results: { url: string; title: string }[], at: string): { next: Case; added: number } {
  const known = new Set([...c.links.map((l) => l.url), ...(c.pendingResults ?? []).map((r) => r.url), ...(c.dismissedResults ?? [])]);
  const fresh: NameResult[] = results.filter((r) => !known.has(r.url)).map((r) => ({ ...r, foundAt: at }));
  if (!fresh.length) return { next: c, added: 0 };
  return {
    added: fresh.length,
    next: {
      ...c,
      pendingResults: [...(c.pendingResults ?? []), ...fresh],
      activity: [
        activity(`${fresh.length} new Google result${fresh.length > 1 ? "s" : ""} for your name. Nothing happens until you confirm.`, "accent", at),
        ...c.activity,
      ],
    },
  };
}

export function confirmNameResult(c: Case, url: string, at: string, simulated: boolean): Case {
  const without = { ...c, pendingResults: (c.pendingResults ?? []).filter((r) => r.url !== url) };
  return addLinkWithRequest(without, url, at, simulated).next;
}

export function dismissNameResult(c: Case, url: string): Case {
  return {
    ...c,
    pendingResults: (c.pendingResults ?? []).filter((r) => r.url !== url),
    dismissedResults: [...(c.dismissedResults ?? []), url],
  };
}

/** Every 3 days; weekly after 30 consecutive days with every link removed. */
export function scheduleNext(c: Case, now: number): Case {
  const contentLinks = c.links.filter((l) => l.kind === "content");
  const allRemoved = contentLinks.length > 0 && contentLinks.every((l) => latestRequestFor(c, l.id)?.status === "removed" && l.lastCheck?.status === "removed");
  const cleanSince = allRemoved ? (c.cleanSince ?? new Date(now).toISOString()) : undefined;
  const clean30 = !!cleanSince && now - new Date(cleanSince).getTime() >= WEEKLY_AFTER_CLEAN_DAYS * DAY_MS;
  const interval = clean30 ? 7 * DAY_MS : RECHECK_INTERVAL_DAYS * DAY_MS;
  return { ...c, cleanSince, lastRecheckAt: new Date(now).toISOString(), nextRecheckAt: new Date(now + interval).toISOString() };
}

export function recheckIntervalDays(c: Case): number {
  if (!c.lastRecheckAt || !c.nextRecheckAt) return RECHECK_INTERVAL_DAYS;
  return Math.round((new Date(c.nextRecheckAt).getTime() - new Date(c.lastRecheckAt).getTime()) / DAY_MS);
}
