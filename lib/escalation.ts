// Chasing and escalation: pure functions shared by the tracker (client) and the
// recheck agent (server). chase() is idempotent — calling it twice changes nothing.
import { activity, evidenceFor, linksFor } from "./caseOps";
import { HOUR_MS, REMINDER_HOURS } from "./config";
import { newId } from "./ids";
import { PLATFORMS } from "./platforms";
import { renderFtcComplaint, renderReminder, type FtcInput, type FollowUpInput } from "./templates";
import type { TimelineFacts } from "./followups";
import type { ActivityItem, Case, OutboundMessage, ReplyStatus, TakedownRequest } from "./types";

export function followUpInput(c: Case, r: TakedownRequest): FollowUpInput {
  return {
    requestId: r.id,
    platformName: r.platformName,
    coveredByAct: r.coveredByAct,
    urls: linksFor(c, r).map((l) => l.url),
    legalName: c.legalName,
    contactEmail: c.contactEmail,
    signature: c.attestation.signature,
    sentAt: r.sentAt!,
    deadlineAt: r.deadlineAt!,
  };
}

export function platformWebsite(c: Case, r: TakedownRequest): string {
  const entry = PLATFORMS.find((p) => p.id === r.platformId);
  return entry?.hosts[0] ?? linksFor(c, r)[0]?.host ?? r.platformName;
}

export function ftcInput(c: Case, r: TakedownRequest, now: number, summary?: string): FtcInput {
  const reminders = (c.outbox ?? [])
    .filter((m) => m.kind === "reminder" && m.requestId === r.id)
    .map((m) => ({ hourMark: m.hourMark ?? 24, at: m.sentAt ?? m.createdAt }))
    .sort((a, b) => a.at.localeCompare(b.at));
  return { ...followUpInput(c, r), reminders, now: new Date(now).toISOString(), platformWebsite: platformWebsite(c, r), summary };
}

export function ftcComplaintFor(c: Case, requestId: string): OutboundMessage | undefined {
  return (c.outbox ?? []).find((m) => m.kind === "ftc_complaint" && m.requestId === requestId);
}

/** Requests eligible for an FTC complaint: covered platform, overdue or rejected. */
export function needsEscalation(r: TakedownRequest, now: number): boolean {
  if (!r.coveredByAct || !r.deadlineAt || r.status === "removed" || r.escalatedAt) return false;
  return r.status === "rejected" || now > new Date(r.deadlineAt).getTime();
}

export function reminderMessage(c: Case, r: TakedownRequest, hourMark: number, at: string, simulated: boolean, aiLine?: string): OutboundMessage {
  const rendered = renderReminder({ ...followUpInput(c, r), hourMark, aiLine });
  return {
    id: newId("msg"),
    kind: "reminder",
    requestId: r.id,
    platformName: r.platformName,
    createdAt: at,
    hourMark,
    subject: rendered.subject,
    aiText: rendered.aiLine,
    aiSource: aiLine ? "gemini" : "template",
    body: rendered.body,
    sentAt: simulated ? at : undefined,
    simulated,
  };
}

function ftcMessage(c: Case, r: TakedownRequest, now: number): OutboundMessage {
  const at = new Date(now).toISOString();
  const complaint = renderFtcComplaint(ftcInput(c, r, now));
  return {
    id: newId("msg"),
    kind: "ftc_complaint",
    requestId: r.id,
    platformName: r.platformName,
    createdAt: at,
    subject: `FTC complaint — ${r.platformName}`,
    aiText: complaint.summary,
    aiSource: "template",
    body: complaint.sections.map((s) => `${s.title}\n${s.text}`).join("\n\n"),
  };
}

/**
 * Draft due reminders (24h, 44h) and FTC complaints (overdue or rejected).
 * In demo mode reminders are marked sent (simulated); otherwise they wait in the outbox.
 */
export function chase(c: Case, now: number, simulated: boolean): Case {
  const outbox = [...(c.outbox ?? [])];
  const acts: ActivityItem[] = [];
  const at = new Date(now).toISOString();
  let changed = false;

  const requests = c.requests.map((r) => {
    if (!r.sentAt || !r.deadlineAt || r.status === "removed") return r;
    let next = r;
    const elapsedH = (now - new Date(r.sentAt).getTime()) / HOUR_MS;
    const beforeDeadline = now <= new Date(r.deadlineAt).getTime();

    const due = REMINDER_HOURS.filter((h) => elapsedH >= h && !r.remindersDrafted.includes(h));
    if (beforeDeadline && r.status !== "rejected" && due.length) {
      const hourMark = Math.max(...due);
      outbox.push(reminderMessage(c, r, hourMark, at, simulated));
      next = { ...next, remindersDrafted: [...r.remindersDrafted, ...due] };
      acts.push(
        activity(
          simulated ? `Reminder sent to ${r.platformName} at the ${hourMark}-hour mark (demo).` : `Reminder to ${r.platformName} drafted at the ${hourMark}-hour mark.`,
          "neutral",
          at,
        ),
      );
      changed = true;
    }

    if (needsEscalation(next, now) && !outbox.some((m) => m.kind === "ftc_complaint" && m.requestId === r.id)) {
      outbox.push(ftcMessage(c, next, now));
      acts.push(
        activity(
          r.status === "rejected"
            ? `${r.platformName} rejected your request. FTC complaint drafted.`
            : `${r.platformName} missed its 48-hour deadline. FTC complaint drafted.`,
          "overdue",
          at,
        ),
      );
      changed = true;
    }
    return next;
  });

  if (!changed) return c;
  return { ...c, requests, outbox, activity: [...acts.reverse(), ...c.activity] };
}

export function setOutboxAiText(c: Case, messageId: string, aiText: string, body?: string): Case {
  return {
    ...c,
    outbox: (c.outbox ?? []).map((m) => (m.id === messageId ? { ...m, aiText, aiSource: "gemini" as const, body: body ?? m.body } : m)),
  };
}

export function markEscalated(c: Case, requestId: string, at: string): Case {
  const r = c.requests.find((x) => x.id === requestId);
  if (!r) return c;
  return {
    ...c,
    requests: c.requests.map((x) => (x.id === requestId ? { ...x, escalatedAt: at } : x)),
    activity: [activity(`You filed an FTC complaint about ${r.platformName}.`, "accent", at), ...c.activity],
  };
}

const REPLY_TEXT: Record<ReplyStatus, (p: string) => string> = {
  acknowledged: (p) => `${p} acknowledged your request.`,
  removed: (p) => `${p} says the content was removed. Reclaim will verify on the next re-check.`,
  rejected: (p) => `${p} rejected your request.`,
  unclear: (p) => `Reply from ${p} logged — it wasn't clear what they decided.`,
};

/** Apply a classified platform reply to its request. */
export function applyReply(c: Case, requestId: string, reply: { status: ReplyStatus; summary: string }, at: string): Case {
  const r = c.requests.find((x) => x.id === requestId);
  if (!r) return c;
  const updated: TakedownRequest = {
    ...r,
    reply: { ...reply, at },
    ...(reply.status === "acknowledged" && r.status !== "removed" ? { status: "acknowledged" as const, acknowledgedAt: r.acknowledgedAt ?? at } : {}),
    ...(reply.status === "removed" ? { status: "removed" as const, removedAt: at } : {}),
    ...(reply.status === "rejected" ? { status: "rejected" as const, rejectedAt: at } : {}),
  };
  const tone = reply.status === "removed" ? "removed" : reply.status === "rejected" ? "overdue" : "accent";
  return {
    ...c,
    requests: c.requests.map((x) => (x.id === requestId ? updated : x)),
    evidence: [...c.evidence, ...linksFor(c, r).map((l) => evidenceFor(l, "reply", at, { sentAt: r.sentAt, note: `Platform reply: ${reply.status}. ${reply.summary}` }))],
    activity: [activity(REPLY_TEXT[reply.status](r.platformName), tone, at), ...c.activity],
  };
}

/** Timeline facts for Gemini: platform + dates only. No names, emails or URLs. */
export function timelineFacts(c: Case, r: TakedownRequest, now: number, hourMark?: number): TimelineFacts {
  return {
    platformName: r.platformName,
    coveredByAct: r.coveredByAct,
    sentAt: r.sentAt!,
    deadlineAt: r.deadlineAt!,
    now: new Date(now).toISOString(),
    hourMark,
    remindersSent: r.remindersDrafted,
    linkCount: r.linkIds.length,
    rejected: r.status === "rejected",
  };
}

/** Swap in a Gemini-written reminder line; the rest of the reminder is re-rendered from the template. */
export function polishReminder(c: Case, messageId: string, aiLine: string): Case {
  const m = (c.outbox ?? []).find((x) => x.id === messageId);
  const r = m && c.requests.find((x) => x.id === m.requestId);
  if (!m || !r || m.kind !== "reminder") return c;
  const rendered = renderReminder({ ...followUpInput(c, r), hourMark: m.hourMark ?? 24, aiLine });
  return setOutboxAiText(c, messageId, rendered.aiLine, rendered.body);
}
