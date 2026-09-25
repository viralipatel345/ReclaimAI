// Pure case updates for Gmail sending and reading. No I/O.
import { activity, evidenceFor, linksFor, markSent } from "./caseOps";
import { applyReply } from "./escalation";
import type { OutgoingEmail } from "./gmail";
import type { Case, GmailLink, ReplyStatus, TakedownRequest } from "./types";

export interface Recipient {
  to: string;
  /** Sent to the team test inbox standing in for the platform. */
  standIn: boolean;
}

/** Where a request's email goes: the test inbox when configured, else the platform's email channel. Forms can't be emailed. */
export function recipientFor(r: TakedownRequest, testInbox: string): Recipient | null {
  if (testInbox) return { to: testInbox, standIn: true };
  if (r.channel === "email" && r.target) return { to: r.target, standIn: false };
  return null;
}

export function requestEmail(r: TakedownRequest, from: string, rcpt: Recipient): OutgoingEmail {
  if (!rcpt.standIn) return { from, to: rcpt.to, subject: r.subject, body: r.body };
  return {
    from,
    to: rcpt.to,
    subject: `[Reclaim test → ${r.platformName}] ${r.subject}`,
    body: `This test inbox stands in for ${r.platformName} (${r.target ?? "web form"}). Reply here the way the platform would.\n\n${r.body}`,
  };
}

/** Record a real Gmail send: clock starts, thread saved for reading replies, evidence logged. */
export function recordGmailSend(c: Case, requestId: string, sent: { id: string; threadId: string; messageIdHeader: string }, rcpt: Recipient, at: string): Case {
  let next = markSent(c, [requestId], at, false);
  const gmail: GmailLink = { threadId: sent.threadId, messageId: sent.id, messageIdHeader: sent.messageIdHeader, to: rcpt.to, standIn: rcpt.standIn, seen: [] };
  const r = next.requests.find((x) => x.id === requestId)!;
  next = {
    ...next,
    requests: next.requests.map((x) => (x.id === requestId ? { ...x, gmail } : x)),
    evidence: [
      ...next.evidence,
      ...linksFor(next, r).map((l) =>
        evidenceFor(l, "sent", at, { sentAt: at, note: `Sent from Gmail (message ${sent.id}) to ${rcpt.to}${rcpt.standIn ? `, test inbox standing in for ${r.platformName}` : ""}.` }),
      ),
    ],
  };
  // markSent's activity line said "Request sent to X"; make it say how.
  return {
    ...next,
    activity: next.activity.map((a, i) => (i === 0 && a.text.startsWith(`Request sent to ${r.platformName}`) ? { ...a, text: `Request sent from your Gmail${rcpt.standIn ? " to the test inbox" : ""} for ${r.platformName}. 48-hour clock started.` } : a)),
  };
}

export function markReplySeen(c: Case, requestId: string, gmailMessageId: string): Case {
  return {
    ...c,
    requests: c.requests.map((r) => (r.id === requestId && r.gmail && !r.gmail.seen.includes(gmailMessageId) ? { ...r, gmail: { ...r.gmail, seen: [...r.gmail.seen, gmailMessageId] } } : r)),
  };
}

/** Apply a reply Gemini read from Gmail: clear verdicts apply; unclear or image requests wait for her. */
export function applyGmailReply(
  c: Case,
  requestId: string,
  gmailMessageId: string,
  parsed: { status: ReplyStatus; summary: string; asksForImages: boolean },
  at: string,
): Case {
  const r = c.requests.find((x) => x.id === requestId);
  if (!r || r.gmail?.seen.includes(gmailMessageId)) return c;
  let next = markReplySeen(c, requestId, gmailMessageId);
  if (parsed.status === "unclear" || parsed.asksForImages) {
    return {
      ...next,
      pendingReplies: [...(next.pendingReplies ?? []), { requestId, gmailMessageId, summary: parsed.summary, asksForImages: parsed.asksForImages, at }],
      activity: [activity(`Gemini read a reply from ${r.platformName} and needs you to check it.`, "accent", at), ...next.activity],
    };
  }
  next = applyReply(next, requestId, { status: parsed.status, summary: parsed.summary }, at);
  return { ...next, activity: next.activity.map((a, i) => (i === 0 ? { ...a, text: `Gemini read ${r.platformName}'s reply: ${a.text.replace(`${r.platformName} `, "")}` } : a)) };
}

/** She resolves a pending reply. */
export function resolvePendingReply(c: Case, gmailMessageId: string, status: Exclude<ReplyStatus, "unclear"> | null, at: string): Case {
  const p = (c.pendingReplies ?? []).find((x) => x.gmailMessageId === gmailMessageId);
  if (!p) return c;
  const without = { ...c, pendingReplies: (c.pendingReplies ?? []).filter((x) => x.gmailMessageId !== gmailMessageId) };
  return status ? applyReply(without, p.requestId, { status, summary: p.summary }, at) : without;
}

export function markReminderSent(c: Case, messageId: string, gmailId: string, at: string): Case {
  return { ...c, outbox: (c.outbox ?? []).map((m) => (m.id === messageId ? { ...m, sentAt: at, gmailId } : m)) };
}
