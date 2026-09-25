// prepare_submission: turn a drafted request into something the user (or the agent,
// with consent) can send. Reclaim never logs in to platforms or submits forms itself.
import { linksFor } from "./caseOps";
import type { Case, TakedownRequest } from "./types";
import { requestEmail, type Recipient } from "./gmailOps";

export interface CopyField {
  label: string;
  value: string;
}

export type Submission =
  | {
      channel: "email";
      to: string;
      subject: string;
      body: string;
      mailto: string;
      /** Opens Gmail's compose window pre-filled — a real send, no sign-in setup. */
      compose: string;
      gmailDraft: { to: string; subject: string; body: string };
      /** Set when addressed to a stand-in inbox rather than the platform. */
      standInFor?: string;
    }
  | { channel: "form"; formUrl: string; fields: CopyField[] }
  | { channel: null; message: string };

export function prepareSubmission(c: Case, r: { channel: TakedownRequest["channel"]; target: string | null; subject: string; body: string; linkIds: string[] }): Submission {
  if (!r.channel || !r.target) return { channel: null, message: "Couldn't confirm — use the site's contact page" };
  if (r.channel === "email") return emailSubmission(r.target, r.subject, r.body);
  const urls = linksFor(c, r as TakedownRequest).map((l) => l.url);
  return {
    channel: "form",
    formUrl: r.target,
    fields: [
      { label: "Your name", value: c.legalName },
      { label: "Your email", value: c.contactEmail },
      { label: urls.length > 1 ? "Links to the content" : "Link to the content", value: urls.join("\n") },
      { label: "Signature", value: c.attestation.signature },
      { label: "Full request (paste into the description box)", value: r.body },
    ],
  };
}

export function gmailComposeUrl(to: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function emailSubmission(to: string, subject: string, body: string, standInFor?: string): Submission {
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { channel: "email", to, subject, body, mailto, compose: gmailComposeUrl(to, subject, body), gmailDraft: { to, subject, body }, standInFor };
}

/** The same request, addressed to a stand-in inbox and labeled so. */
export function standInSubmission(r: TakedownRequest, rcpt: Recipient, from: string): Submission {
  const e = requestEmail(r, from, rcpt);
  return emailSubmission(e.to, e.subject, e.body, r.platformName);
}
