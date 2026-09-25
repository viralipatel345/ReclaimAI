export type Channel = "form" | "email";
export type PlatformSource = "directory" | "search" | "unresolved";

export interface PlatformDirectoryEntry {
  id: string;
  name: string;
  /** Hostnames matched exactly or as a parent domain (e.g. "reddit.com" matches "old.reddit.com"). */
  hosts: string[];
  /** Optional path prefix that must also match (used for Google Search). */
  pathPrefix?: string;
  channel: Channel;
  /** Form URL (channel "form") or email address (channel "email"). */
  target: string;
  policyUrl?: string;
  /** False for search engines: requests cite the platform's own policy, not the Act's 48-hour duty. */
  coveredByAct: boolean;
  fictional?: boolean;
}

export interface ResolvedPlatform {
  id: string;
  name: string;
  channel: Channel | null;
  target: string | null;
  confidence: number;
  source: PlatformSource;
  coveredByAct: boolean;
  fictional?: boolean;
  /** Shown to the user when we couldn't confirm a channel. */
  message?: string;
  /** Google Search sources that grounded a "search" resolution. */
  sources?: { title: string; uri: string }[];
}

/** "content" = a page hosting the imagery. "name_search" = Google results for the user's own name. */
export type LinkKind = "content" | "name_search";

export interface CaseLink {
  id: string;
  url: string;
  host: string;
  kind: LinkKind;
  platform: ResolvedPlatform;
  addedAt: string;
  pageTitle?: string;
  /** Set when a re-check couldn't tell whether the page is still up. The user decides. */
  needsUserCheck?: boolean;
  lastCheck?: { at: string; status: PageStatus };
}

export type PageStatus = "removed" | "live" | "unclear";

/** A new Google result for the user's own name. Never acted on until she confirms. */
export interface NameResult {
  url: string;
  title: string;
  foundAt: string;
}

export type RequestKind = "takedown" | "google_removal" | "refile";
export type RequestStatus = "draft" | "ready" | "sent" | "acknowledged" | "removed" | "rejected" | "unclear";

export interface TakedownRequest {
  id: string;
  kind: RequestKind;
  platformId: string;
  platformName: string;
  channel: Channel | null;
  target: string | null;
  coveredByAct: boolean;
  linkIds: string[];
  subject: string;
  /** Short courteous opening — the only model-written part. */
  opening: string;
  openingSource?: "gemini" | "template" | "user";
  /** Full rendered text: opening + fixed legal template. */
  body: string;
  status: RequestStatus;
  createdAt: string;
  sentAt?: string;
  deadlineAt?: string;
  acknowledgedAt?: string;
  removedAt?: string;
  rejectedAt?: string;
  /** For re-files: the request this one follows up on. */
  parentRequestId?: string;
  /** Reminder hour marks already drafted (24, 44). */
  remindersDrafted: number[];
  /** True when "sent" only in demo mode. */
  simulated?: boolean;
  /** When the user filed an FTC complaint about this request. */
  escalatedAt?: string;
  /** Latest platform reply, as classified by parse_reply. */
  reply?: { status: ReplyStatus; summary: string; at: string };
}

export type ReplyStatus = "acknowledged" | "removed" | "rejected" | "unclear";

export type OutboundKind = "reminder" | "ftc_complaint";

/** Messages the agent drafts after the first request: reminders and FTC complaints. */
export interface OutboundMessage {
  id: string;
  kind: OutboundKind;
  requestId: string;
  platformName: string;
  createdAt: string;
  /** 24 / 44 for reminders. */
  hourMark?: number;
  subject: string;
  /** Short model-written paragraph (reminder line or complaint summary); fixed facts live in `body`. */
  aiText: string;
  aiSource: "gemini" | "template";
  body: string;
  sentAt?: string;
  simulated?: boolean;
}

export type EvidenceEvent = "logged" | "sent" | "recheck" | "reply" | "refiled";

/** Evidence never contains image data — only URLs, timestamps and a text fingerprint. */
export interface EvidenceEntry {
  id: string;
  url: string;
  host: string;
  platformName: string;
  event: EvidenceEvent;
  at: string;
  firstSeenAt: string;
  sentAt?: string;
  pageTitle: string;
  /** sha256(url + pageTitle) */
  fingerprint: string;
  note?: string;
}

export type ActivityTone = "neutral" | "accent" | "removed" | "overdue";

export interface ActivityItem {
  id: string;
  at: string;
  text: string;
  tone: ActivityTone;
}

export interface Attestation {
  text: string;
  signature: string;
  signedAt?: string;
}

export interface Case {
  id: string;
  isDemo: boolean;
  createdAt: string;
  legalName: string;
  contactEmail: string;
  isAdult: boolean | null;
  authorizesPreparation: boolean;
  autoSendConsent: boolean;
  reviewEachBeforeSending: boolean;
  attestation: Attestation;
  links: CaseLink[];
  requests: TakedownRequest[];
  evidence: EvidenceEntry[];
  activity: ActivityItem[];
  /** Reminders and FTC complaint drafts. Optional for cases saved before step 5. */
  outbox?: OutboundMessage[];
  lastRecheckAt?: string;
  nextRecheckAt?: string;
  /** Start of the current streak of re-checks with every link removed. 30 days → weekly. */
  cleanSince?: string;
  pendingResults?: NameResult[];
  dismissedResults?: string[];
  /** Demo mode only: which fixture version each URL serves, and name-search fixture results. */
  demoPageState?: Record<string, PageStatus>;
  demoNameResults?: { url: string; title: string }[];
}
