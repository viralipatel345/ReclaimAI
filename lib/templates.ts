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
export function sanitizeOpening(raw: string | undefined, platformName: string): string {
  if (!raw) return defaultOpening(platformName);
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
  return cleaned.length >= 12 ? cleaned : defaultOpening(platformName);
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
  const opening = sanitizeOpening(input.opening, "Google Search");
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
