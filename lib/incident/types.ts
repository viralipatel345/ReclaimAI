// TypeScript mirror of prisma/schema.prisma for the incident-verification platform.
// Shared by client and server; nothing here performs I/O.

export type AuthProvider = "auth0" | "firebase" | "supabase";
export type ReportBranch = "MANUAL" | "DISCOVER";
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

export interface CaseReport {
  id: string;
  userId: string;
  branch: ReportBranch;
  status: CaseStatus;
  title: string;
  notes: string;
  isDraft: boolean;
  originalId?: string;
  recordHash?: string;
  sealedAt?: string;
  assets: MediaAsset[];
  verifications: VerificationResult[];
  scrape?: ScrapeData;
  suggestions?: AgentSuggestions;
  escalations: ParasellEscalation[];
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
