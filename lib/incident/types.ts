// TypeScript mirror of prisma/schema.prisma for the incident-verification platform.
// Shared by client and server; nothing here performs I/O.

export type AuthProvider = "auth0" | "firebase" | "supabase";
export type ReportBranch = "MANUAL" | "DISCOVER" | "IMAGE_SEARCH";
export type CaseStatus = "DRAFT" | "SCANNING" | "ANALYZED" | "ESCALATED" | "SEALED" | "CLOSED";
export type MediaKind = "image" | "video" | "audio";
export type ProvenanceVerdict = "ai_generated" | "likely_ai" | "no_signal" | "inconclusive";
export type EscalationStatus = "pending" | "submitted" | "accepted" | "rejected" | "failed";

export interface User {
  id: string;
  email: string;
  authProvider: AuthProvider;
  authSubject: string;
  displayName?: string;
  phone?: string;
  humanVerifiedAt?: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  caseId: string;
  kind: MediaKind;
  mimeType: string;
  sha256: string;
  bytes: number;
  storageRef?: string;
  sourceUrl?: string;
  createdAt: string;
}

export interface SynthIdAnalysis {
  isGoogleAiGenerated: boolean;
  /** 0..1 */
  synthIdConfidence: number;
  modality: MediaKind;
  detectedModel?: string;
  source: "vertex" | "stub";
  checkedAt: string;
}

export interface C2paAnalysis {
  present: boolean;
  c2paIssuer?: string;
  claimGenerator?: string;
  /** True when the manifest declares trainedAlgorithmicMedia / an AI generation action. */
  aiGenerated?: boolean;
  assertions: string[];
  source: "c2pa-node" | "jumbf-scan";
}

export interface VerificationResult {
  id: string;
  caseId: string;
  assetId: string;
  synthId: SynthIdAnalysis;
  c2pa: C2paAnalysis;
  verdict: ProvenanceVerdict;
  summary: string;
  createdAt: string;
}

/** The provenance payload merged into the case for Gemini. */
export interface ProvenancePayload {
  isGoogleAiGenerated: boolean;
  synthIdConfidence: number;
  c2paIssuer: string | null;
  verdict: ProvenanceVerdict;
}

export interface ScrapeSource {
  url: string;
  title: string;
  snippet: string;
  fetchedAt: string;
}

export interface ScrapeData {
  id: string;
  caseId: string;
  decision: "DISCOVER";
  query: string;
  sources: ScrapeSource[];
  mediaUrls: string[];
  startedAt: string;
  completedAt?: string;
}

export type MatchType = "full" | "partial" | "similar";
/** shady: leak/explicit signals · normal: known platform with a removal channel · unknown: no signals either way. */
export type MatchRisk = "shady" | "normal" | "unknown";

export interface ImageMatch {
  /** The matching image file. */
  url: string;
  /** The page it appears on (what a takedown notice cites). */
  pageUrl: string;
  host: string;
  title?: string;
  matchType: MatchType;
  risk: MatchRisk;
  reasons: string[];
  /** Directory platform name when the host is known. */
  platformName?: string;
  coveredByAct?: boolean;
  foundAt: string;
}

export interface ImageSearch {
  assetId: string;
  provider: "vision" | "fixture";
  labels: string[];
  matches: ImageMatch[];
  searchedAt: string;
}

export type AgentActionType = "add_evidence" | "call_helpline" | "notify_friends_family" | "report_police" | "report_parasell";
export type ActionPriority = "now" | "soon" | "optional";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AgentAction {
  type: AgentActionType;
  priority: ActionPriority;
  title: string;
  rationale: string;
  /** Action-specific data the UI needs (helpline number, SMS text, dispatch summary). */
  payload?: Record<string, string>;
}

export interface AgentSuggestions {
  summary: string;
  riskLevel: RiskLevel;
  aiGenerationAssessment: string;
  actions: AgentAction[];
  source: "gemini" | "rules";
  model?: string;
  /** Web-context rounds the orchestrator ran before settling. */
  iterations: number;
  generatedAt: string;
}

export interface ParasellEscalation {
  id: string;
  caseId: string;
  externalId?: string;
  status: EscalationStatus;
  requestPayload: Record<string, unknown>;
  responseBody?: unknown;
  error?: string;
  submittedAt?: string;
  createdAt: string;
}

export interface StatusEvent {
  id: string;
  caseId: string;
  status: CaseStatus;
  text: string;
  at: string;
}

/** Details a valid TAKE IT DOWN Act notice must carry. */
export interface Reporter {
  legalName: string;
  contactEmail: string;
  signature: string;
  signedAt?: string;
}

export type ReportChannel = "platform" | "stopncii" | "ftc" | "police" | "parasell";

/**
 * sent: delivered by API/email · simulated: demo-mode send · handed_off: everything prepared,
 * user completes it at the destination (no API exists) · prepared: ready for the user to send.
 */
export type ReportStatus = "running" | "sent" | "simulated" | "handed_off" | "prepared" | "failed";

export interface ReportStep {
  at: string;
  text: string;
}

/** What the agent produced for a channel: a notice, complaint, dispatch summary or hash list. */
export interface ReportArtifact {
  title: string;
  body: string;
  mailto?: string;
  fields?: { label: string; value: string }[];
}

export interface ReportAction {
  id: string;
  caseId: string;
  channel: ReportChannel;
  status: ReportStatus;
  steps: ReportStep[];
  destination: string;
  reference?: string;
  artifact?: ReportArtifact;
  /** Platform notices only: the content URL the notice cites. */
  url?: string;
  /** Platform notices only: sentAt + 48h. */
  deadlineAt?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface CaseReport {
  id: string;
  userId: string;
  branch: ReportBranch;
  status: CaseStatus;
  title: string;
  notes: string;
  reporter?: Reporter;
  isDraft: boolean;
  originalId?: string;
  recordHash?: string;
  sealedAt?: string;
  assets: MediaAsset[];
  verifications: VerificationResult[];
  scrape?: ScrapeData;
  imageSearch?: ImageSearch;
  suggestions?: AgentSuggestions;
  escalations: ParasellEscalation[];
  reports: ReportAction[];
  events: StatusEvent[];
  createdAt: string;
  updatedAt: string;
}

/** Aggregate provenance across every scanned asset: the strongest signal wins. */
export function provenancePayload(verifications: VerificationResult[]): ProvenancePayload {
  const rank: Record<ProvenanceVerdict, number> = { ai_generated: 3, likely_ai: 2, inconclusive: 1, no_signal: 0 };
  let best: VerificationResult | undefined;
  for (const v of verifications) if (!best || rank[v.verdict] > rank[best.verdict]) best = v;
  return {
    isGoogleAiGenerated: verifications.some((v) => v.synthId.isGoogleAiGenerated),
    synthIdConfidence: Math.max(0, ...verifications.map((v) => v.synthId.synthIdConfidence)),
    c2paIssuer: verifications.find((v) => v.c2pa.c2paIssuer)?.c2pa.c2paIssuer ?? null,
    verdict: best?.verdict ?? "no_signal",
  };
}
