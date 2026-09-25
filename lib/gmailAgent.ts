"use client";
// The browser half of the agent: sends through her Gmail, reads platform replies from her
// Gmail and asks Gemini (/api/parse-reply) to classify them. Runs only while she's signed in.
import { useEffect, useRef, useState } from "react";
import { postJson } from "./api";
import { CLIENT_PRO_TIMEOUT_MS } from "./demoCache";
import type { ParsedReply } from "./followups";
import { gmailSend, gmailThread, messageText, newInboundMessages } from "./gmail";
import { applyGmailReply, markReminderSent, recipientFor, recordGmailSend, requestEmail } from "./gmailOps";
import { gmailSession, useGmail } from "./google";
import { getCase, updateCase } from "./useCase";
import type { TakedownRequest } from "./types";

/** Send requests from her Gmail. Returns the ids that couldn't be emailed (web-form platforms). */
export async function sendViaGmail(requests: TakedownRequest[], testInbox: string): Promise<{ sent: string[]; notEmailable: string[]; failed: string[] }> {
  const s = gmailSession();
  const out = { sent: [] as string[], notEmailable: [] as string[], failed: [] as string[] };
  if (!s) return { ...out, failed: requests.map((r) => r.id) };
  for (const r of requests) {
    const rcpt = recipientFor(r, testInbox);
    if (!rcpt) {
      out.notEmailable.push(r.id);
      continue;
    }
    try {
      const sent = await gmailSend(s.token, requestEmail(r, s.email, rcpt));
      updateCase((c) => recordGmailSend(c, r.id, sent, rcpt, new Date().toISOString()));
      out.sent.push(r.id);
    } catch {
      out.failed.push(r.id);
    }
  }
  return out;
}

/** Read new replies in every open request's thread; Gemini classifies each one. */
export async function checkInbox(): Promise<number> {
  const s = gmailSession();
  const c = getCase();
  if (!s || !c) return 0;
  let found = 0;
  for (const r of c.requests) {
    if (!r.gmail || r.status === "removed" || r.status === "rejected") continue;
    let thread;
    try {
      thread = await gmailThread(s.token, r.gmail.threadId);
    } catch {
      continue;
    }
    for (const m of newInboundMessages(thread, r.gmail.seen)) {
      const text = messageText(m);
      if (!text) continue;
      const parsed = await postJson<ParsedReply>("/api/parse-reply", { text, platformName: r.platformName }, CLIENT_PRO_TIMEOUT_MS);
      if (!parsed) continue; // try again next check
      updateCase((x) => applyGmailReply(x, r.id, m.id, parsed, new Date().toISOString()));
      found++;
    }
  }
  return found;
}

/** Send reminders the chase loop drafted, as replies in the original thread (only with her auto-send consent). */
export async function sendDueReminders(): Promise<void> {
  const s = gmailSession();
  const c = getCase();
  if (!s || !c || !c.autoSendConsent || c.reviewEachBeforeSending) return;
  for (const m of c.outbox ?? []) {
    if (m.kind !== "reminder" || m.sentAt) continue;
    const r = c.requests.find((x) => x.id === m.requestId);
    if (!r?.gmail) continue;
    try {
      const sent = await gmailSend(
        s.token,
        { from: s.email, to: r.gmail.to, subject: `Re: ${r.gmail.standIn ? `[Reclaim test → ${r.platformName}] ` : ""}${m.subject}`, body: m.body, inReplyTo: r.gmail.messageIdHeader },
        r.gmail.threadId,
      );
      updateCase((x) => markReminderSent(x, m.id, sent.id, new Date().toISOString()));
    } catch {
      // retried on the next pass
    }
  }
}

/** While mounted and signed in: check replies and send due reminders every minute. */
export function useGmailAgent() {
  const session = useGmail();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const running = useRef(false);

  const run = async () => {
    if (running.current || !gmailSession()) return 0;
    running.current = true;
    setChecking(true);
    try {
      await sendDueReminders();
      return await checkInbox();
    } finally {
      running.current = false;
      setChecking(false);
      setLastChecked(Date.now());
    }
  };

  useEffect(() => {
    if (!session) return;
    const first = setTimeout(run, 1500);
    const id = setInterval(run, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [session]);

  return { session, checking, lastChecked, checkNow: run };
}
