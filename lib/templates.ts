// FIXED legal templates. The model only ever supplies the short courteous `opening`;
// every legal element below is static text with slots filled from the case record.

export const ATTESTATION_TEXT =
  "I am the person shown in the content at these links. I have a good-faith belief it was published without my consent, and the information I'm providing is accurate.";

/** Section headings double as markers the tests use to prove every element is present. */
export const SECTION = {
  identification: "1. IDENTIFICATION OF THE CONTENT",
  goodFaith: "2. GOOD-FAITH STATEMENT OF NON-CONSENT",
  obligation: "3. YOUR OBLIGATION UNDER THE TAKE IT DOWN ACT",
  googlePolicy: "3. REQUEST UNDER GOOGLE'S PERSONAL CONTENT POLICY",
  reupload: "RE-UPLOAD NOTICE",
  contact: "4. CONTACT INFORMATION",
  signature: "5. SIGNATURE",
} as const;

export interface TemplateInput {
  platformName: string;
  coveredByAct: boolean;
  urls: string[];
  legalName: string;
  contactEmail: string;
  signature: string;
  signedAt: string;
  opening?: string;
  /** Set when re-filing after content reappeared. */
  refileOf?: { requestId: string; sentAt: string };
}

export interface RenderedRequest {
  subject: string;
  opening: string;
  body: string;
}

const MAX_OPENING_CHARS = 320;

export function defaultOpening(platformName: string): string {
  return `Hello ${platformName} Trust & Safety team,\n\nI'm writing to ask you to remove content of me that was shared without my consent. Thank you for handling this promptly.`;
}

/**
 * Model output is untrusted: keep it short, plain text, and free of anything that
 * could masquerade as a legal section, a link, or a changed signature.
 */
export function defaultGoogleOpening(): string {
  return "Hello Google Search team,\n\nI'm writing to ask you to remove search results that link to intimate images of me shared without my consent. Thank you for handling this promptly.";
}

export function sanitizeOpening(raw: string | undefined, platformName: string, fallback = defaultOpening(platformName)): string {
  if (!raw) return fallback;
  const cleaned = raw
    .replace(/\r/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[<>`*_#]/g, "")
    .split("\n")
    .filter((line) => !/^\s*(\d+\.|\/s\/|signature|re-upload)/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_OPENING_CHARS)
    .trim();
  return cleaned.length >= 12 ? cleaned : fallback;
}

function signedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function contactAndSignature(input: TemplateInput): string {
  return [
    SECTION.contact,
    `Name: ${input.legalName}`,
    `Email: ${input.contactEmail}`,
    "",
    SECTION.signature,
    `/s/ ${input.signature}`,
    `Electronically signed by ${input.legalName} on ${signedDate(input.signedAt)}.`,
  ].join("\n");
}

function urlList(urls: string[]): string {
  return urls.map((u) => `  - ${u}`).join("\n");
}

function reuploadBlock(input: TemplateInput): string[] {
  if (!input.refileOf) return [];
  return [
    SECTION.reupload,
    `I previously reported this content on ${signedDate(input.refileOf.sentAt)} (reference ${input.refileOf.requestId}). It has been uploaded again at the location(s) above. The Act requires reasonable efforts to remove known identical copies; please remove this copy and prevent further re-uploads.`,
    "",
  ];
}

/** Removal request for a covered platform under the TAKE IT DOWN Act. */
export function renderTakedownRequest(input: TemplateInput): RenderedRequest {
  const opening = sanitizeOpening(input.opening, input.platformName);
  const prefix = input.refileOf ? "Re-upload: " : "";
  const subject = `${prefix}TAKE IT DOWN Act removal request — ${input.legalName}`;
  const body = [
    opening,
    "",
    SECTION.identification,
    `I am requesting removal of intimate visual depictions of me published on ${input.platformName} at the following location(s):`,
    urlList(input.urls),
    "Each URL above identifies the content and is sufficient for you to locate it.",
    "",
    SECTION.goodFaith,
    `I, ${input.legalName}, am the identifiable individual depicted. I have a good-faith belief that this intimate visual depiction was not consensual and was published without my consent.`,
    "",
    SECTION.obligation,
    "This is a valid removal request under Section 3 of the TAKE IT DOWN Act. As a covered platform, you must remove the depiction as soon as possible and no later than 48 hours after receiving this request, and make reasonable efforts to identify and remove any known identical copies. The Federal Trade Commission enforces this obligation.",
    "",
    ...reuploadBlock(input),
    contactAndSignature(input),
  ].join("\n");
  return { subject, opening, body };
}

/** Request to remove explicit results for the user's own name from Google Search. */
export function renderGoogleRemoval(input: TemplateInput & { searchedName: string }): RenderedRequest {
  const opening = sanitizeOpening(input.opening, "Google Search", defaultGoogleOpening());
  const subject = `Request to remove non-consensual explicit results — ${input.legalName}`;
  const body = [
    opening,
    "",
    SECTION.identification,
    `Search results for my name ("${input.searchedName}") link to intimate images of me that were shared without my consent. The search is:`,
    urlList(input.urls),
    "I will list each specific result URL in Google's removal form.",
    "",
    SECTION.goodFaith,
    `I, ${input.legalName}, am the identifiable individual depicted. I have a good-faith belief that these intimate images, including any AI-generated or altered images, were published without my consent.`,
    "",
    SECTION.googlePolicy,
    "Google's policy allows removal of non-consensual explicit or intimate personal images, including synthetic ones, from Search results. Please remove these results and demote similar explicit results for queries that include my name.",
    "",
    contactAndSignature(input),
  ].join("\n");
  return { subject, opening, body };
}

// ---------- Follow-ups ----------

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

export interface FollowUpInput {
  requestId: string;
  platformName: string;
  coveredByAct: boolean;
  urls: string[];
  legalName: string;
  contactEmail: string;
  signature: string;
  sentAt: string;
  deadlineAt: string;
}

export function defaultReminderLine(hourMark: number): string {
  return hourMark >= 44
    ? "This is a final reminder: the content is still available and your removal deadline is only hours away."
    : "I'm following up on my removal request below. The content is still available.";
}

/** 24h / 44h reminder. The model supplies only `aiLine`; every fact is fixed. */
export function renderReminder(input: FollowUpInput & { hourMark: number; aiLine?: string }): { subject: string; body: string; aiLine: string } {
  const aiLine = sanitizeOpening(input.aiLine, input.platformName, defaultReminderLine(input.hourMark)).replace(/\n+/g, " ");
  const subject = `${input.hourMark >= 44 ? "Final reminder" : "Reminder"}: removal request ${input.requestId} — ${input.legalName}`;
  const duty = input.coveredByAct
    ? `Under Section 3 of the TAKE IT DOWN Act, the content must be removed within 48 hours of my request — by ${stamp(input.deadlineAt)}. If it is not, I intend to report this to the Federal Trade Commission.`
    : "Please act on my request under your personal content removal policy.";
  const body = [
    `Hello ${input.platformName} Trust & Safety team,`,
    "",
    aiLine,
    "",
    `On ${stamp(input.sentAt)} I sent a removal request (reference ${input.requestId}) for:`,
    urlList(input.urls),
    "",
    duty,
    "",
    `${input.legalName}`,
    `${input.contactEmail}`,
    `/s/ ${input.signature}`,
  ].join("\n");
  return { subject, body, aiLine };
}

export const FTC_SECTION = {
  company: "Company",
  what: "What happened",
  timeline: "Timeline",
  links: "Content locations",
  contact: "Your contact information",
} as const;

export interface FtcInput extends FollowUpInput {
  reminders: { hourMark: number; at: string }[];
  now: string;
  platformWebsite: string;
  summary?: string;
}

export function defaultFtcSummary(i: Pick<FtcInput, "platformName" | "sentAt" | "deadlineAt">): string {
  return `On ${stamp(i.sentAt)} I sent ${i.platformName} a valid removal request under the TAKE IT DOWN Act for intimate images of me published without my consent. The 48-hour removal deadline passed on ${stamp(i.deadlineAt)} and the content was not removed.`;
}

/** Complaint text the user files herself on the FTC's site. Facts are never model-generated. */
export function renderFtcComplaint(i: FtcInput): { sections: { title: string; text: string }[]; summary: string } {
  const summary = sanitizeOpening(i.summary, i.platformName, defaultFtcSummary(i)).replace(/\n+/g, " ");
  const overdueHours = Math.max(0, Math.floor((new Date(i.now).getTime() - new Date(i.deadlineAt).getTime()) / 3_600_000));
  const timeline = [
    `${stamp(i.sentAt)} — Removal request sent to ${i.platformName} (reference ${i.requestId}), with signature and good-faith statement.`,
    ...i.reminders.map((r) => `${stamp(r.at)} — ${r.hourMark >= 44 ? "Final reminder" : "Reminder"} sent (${r.hourMark}-hour mark).`),
    `${stamp(i.deadlineAt)} — 48-hour removal deadline passed.`,
    `${stamp(i.now)} — Content still not confirmed removed (${overdueHours} hours past the deadline).`,
  ].join("\n");
  return {
    summary,
    sections: [
      { title: FTC_SECTION.company, text: `${i.platformName} (${i.platformWebsite})` },
      { title: FTC_SECTION.what, text: `${summary}\n\nThis appears to violate the platform's obligation under Section 3 of the TAKE IT DOWN Act to remove the depiction within 48 hours of a valid request and to make reasonable efforts to remove known identical copies.` },
      { title: FTC_SECTION.timeline, text: timeline },
      { title: FTC_SECTION.links, text: i.urls.join("\n") },
      { title: FTC_SECTION.contact, text: `${i.legalName}\n${i.contactEmail}` },
    ],
  };
}
