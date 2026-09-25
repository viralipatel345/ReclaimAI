// prepare_submission: turn a drafted request into something the user (or the agent,
// with consent) can send. Reclaim never logs in to platforms or submits forms itself.
import { linksFor } from "./caseOps";
import type { Case, TakedownRequest } from "./types";

export interface CopyField {
  label: string;
  value: string;
}

export type Submission =
  | { channel: "email"; to: string; subject: string; body: string; mailto: string; gmailDraft: { to: string; subject: string; body: string } }
  | { channel: "form"; formUrl: string; fields: CopyField[] }
  | { channel: null; message: string };

export function prepareSubmission(c: Case, r: { channel: TakedownRequest["channel"]; target: string | null; subject: string; body: string; linkIds: string[] }): Submission {
  if (!r.channel || !r.target) return { channel: null, message: "Couldn't confirm — use the site's contact page" };
  if (r.channel === "email") {
    const mailto = `mailto:${encodeURIComponent(r.target)}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`;
    return { channel: "email", to: r.target, subject: r.subject, body: r.body, mailto, gmailDraft: { to: r.target, subject: r.subject, body: r.body } };
  }
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
