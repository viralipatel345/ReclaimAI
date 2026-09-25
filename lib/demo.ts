// Demo-mode scenario helpers. Fictional data only.
import { activity, evidenceFor, linksFor } from "./caseOps";
import { DEADLINE_HOURS, HOUR_MS } from "./config";
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
  const simulated = { ...c, requests, activity: all, evidence: [...c.evidence, ...sentEvidence, ...replyEvidence], outbox: [...(c.outbox ?? []), ...reminders] };
  // The FTC draft for the overdue request comes from the same chase() the tracker runs.
  return chase(simulated, now, true);
}

