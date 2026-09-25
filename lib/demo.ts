// Demo-mode scenario helpers. Fictional data only.
import { activity, evidenceFor, linksFor } from "./caseOps";
import { DEMO_URLS } from "@/data/fixtures";
import { DAY_MS, DEADLINE_HOURS, HOUR_MS } from "./config";
import { chase, reminderMessage } from "./escalation";
import type { ActivityItem, Case, OutboundMessage, TakedownRequest } from "./types";
import { addHours, hoursMinutes, isoAt } from "./time";

/**
 * Demo: jump to a realistic mid-case state.
 * Reddit → removed 19h 42m after sending. Google → acknowledged. X → overdue (reminders at 24h/44h, FTC complaint drafted).
 */
export function simulatePlatformResponses(c: Case, now: number): Case {
  if (c.requests.some((r) => r.removedAt || r.acknowledgedAt)) return c; // already simulated
  const shift = (r: TakedownRequest, sentMsAgo: number): TakedownRequest => {
    const sentAt = isoAt(now - sentMsAgo);
    return { ...r, status: r.status === "ready" || r.status === "draft" ? "sent" : r.status, sentAt, deadlineAt: addHours(sentAt, DEADLINE_HOURS), simulated: true };
  };
  const newActs: ActivityItem[] = [];
  const reminders: OutboundMessage[] = [];
  const requests = c.requests.map((r) => {
    if (r.platformId === "reddit") {
      const s = shift(r, 21 * HOUR_MS + 5 * 60000);
      const removedAt = isoAt(new Date(s.sentAt!).getTime() + 19 * HOUR_MS + 42 * 60000);
      newActs.push(activity(`Reddit removed the post — ${hoursMinutes(19 * HOUR_MS + 42 * 60000)} after your request.`, "removed", removedAt));
      return { ...s, status: "removed" as const, removedAt };
    }
    if (r.platformId === "google-search") {
      const s = shift(r, 30 * HOUR_MS + 18 * 60000);
      const acknowledgedAt = isoAt(new Date(s.sentAt!).getTime() + 6 * HOUR_MS + 11 * 60000);
      newActs.push(activity("Google acknowledged your removal request.", "accent", acknowledgedAt));
      const at24 = addHours(s.sentAt!, 24);
      reminders.push(reminderMessage(c, s, 24, at24, true));
      newActs.push(activity("Reminder sent to Google Search at the 24-hour mark (demo).", "neutral", at24));
      return { ...s, status: "acknowledged" as const, acknowledgedAt, remindersDrafted: [24] };
    }
    if (r.platformId === "x") {
      const s = shift(r, 50 * HOUR_MS + 14 * 60000 + 9000);
      for (const h of [24, 44]) {
        const at = addHours(s.sentAt!, h);
        reminders.push(reminderMessage(c, s, h, at, true));
        newActs.push(activity(`Reminder sent to X at the ${h}-hour mark (demo).`, "neutral", at));
      }
      return { ...s, remindersDrafted: [24, 44] };
    }
    if (r.platformId === "imgvault") return shift(r, 9 * HOUR_MS + 31 * 60000);
    return r;
  });
  const sentEvidence = requests.flatMap((r) => (r.sentAt ? linksFor(c, r).map((l) => evidenceFor(l, "sent", r.sentAt!, { sentAt: r.sentAt })) : []));
  const replyEvidence = requests.flatMap((r) => {
    const at = r.removedAt ?? r.acknowledgedAt;
    if (!at) return [];
    const note = r.removedAt ? "Platform reported the content removed." : "Platform acknowledged the request.";
    return linksFor(c, r).map((l) => evidenceFor(l, "reply", at, { sentAt: r.sentAt, note }));
  });
  const sentActs = requests
    .filter((r) => r.sentAt)
    .map((r) => activity(`Request sent to ${r.platformName}. 48-hour clock started.`, "accent", r.sentAt!));
  const all = [...newActs, ...sentActs].sort((a, b) => b.at.localeCompare(a.at));
  const demoPageState = { ...c.demoPageState, [DEMO_URLS.reddit]: "removed" as const };
  const simulated = { ...c, requests, activity: all, evidence: [...c.evidence, ...sentEvidence, ...replyEvidence], outbox: [...(c.outbox ?? []), ...reminders], demoPageState };
  // The FTC draft for the overdue request comes from the same chase() the tracker runs.
  return chase(simulated, now, true);
}


const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Move every timestamp in the case by deltaMs (negative = into the past). */
export function shiftCase(c: Case, deltaMs: number): Case {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return ISO.test(v) ? new Date(new Date(v).getTime() + deltaMs).toISOString() : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(c) as Case;
}

export const FAST_FORWARD_MS = 3 * DAY_MS;

/**
 * Demo "Fast-forward 3 days": everything recorded so far moves 3 days into the past, and
 * the platforms act during that window. The recheck agent (POST /api/recheck) then runs
 * at "now" against fixture pages and finds:
 *   Reddit still removed ✓ · X removed the post, but it's back up → re-upload, auto re-filed
 *   ImgVault removed ✓ · Google removed the results · one new Google result for her name.
 */
export function fastForward(c: Case, now: number): Case {
  const base = c.requests.some((r) => r.sentAt) ? c : simulatePlatformResponses(c, now);
  const shifted = shiftCase(base, -FAST_FORWARD_MS);
  const newActs: ActivityItem[] = [];
  const replyEvidence: ReturnType<typeof evidenceFor>[] = [];
  const removeAt = (r: TakedownRequest, at: number, text: string): TakedownRequest => {
    const iso = isoAt(Math.min(at, now - HOUR_MS));
    newActs.push(activity(text, "removed", iso));
    replyEvidence.push(...linksFor(shifted, r).map((l) => evidenceFor(l, "reply", iso, { sentAt: r.sentAt, note: "Platform reported the content removed." })));
    return { ...r, status: "removed", removedAt: iso };
  };

  const requests = shifted.requests.map((r) => {
    if (!r.sentAt || r.status === "removed" || r.status === "rejected" || r.kind === "refile") return r;
    const sent = new Date(r.sentAt).getTime();
    if (r.platformId === "x") {
      const at = new Date(r.deadlineAt!).getTime() + 26 * HOUR_MS;
      return removeAt(r, at, `X removed the post — ${hoursMinutes(at - new Date(r.deadlineAt!).getTime())} after its deadline.`);
    }
    if (r.platformId === "imgvault") {
      const at = sent + 31 * HOUR_MS + 12 * 60000;
      return removeAt(r, at, `ImgVault removed the file — ${hoursMinutes(at - sent)} after your request.`);
    }
    if (r.platformId === "google-search") return removeAt(r, now - DAY_MS, "Google removed the explicit results for your name.");
    if (r.platformId === "instagram") {
      const at = sent + 14 * HOUR_MS + 6 * 60000;
      return removeAt(r, at, `Instagram removed ${r.linkIds.length === 1 ? "the post" : `all ${r.linkIds.length} posts`} — ${hoursMinutes(at - sent)} after your request.`);
    }
    return r;
  });

  // Anything Instagram removed must also read as removed on re-check.
  const instagramUrls = requests
    .filter((r) => r.platformId === "instagram" && r.status === "removed")
    .flatMap((r) => linksFor(shifted, r).map((l) => l.url));
  return {
    ...shifted,
    requests,
    evidence: [...shifted.evidence, ...replyEvidence],
    activity: [...newActs, ...shifted.activity].sort((a, b) => b.at.localeCompare(a.at)),
    demoPageState: {
      ...shifted.demoPageState,
      ...Object.fromEntries(instagramUrls.map((u) => [u, "removed" as const])),
      [DEMO_URLS.reddit]: "removed",
      [DEMO_URLS.imgvault]: "removed",
      [DEMO_URLS.x]: "live", // re-uploaded after X removed it
    },
    demoNameResults: [{ url: DEMO_URLS.nameResult, title: "ImgVault — k9Pw2Qz" }],
  };
}
