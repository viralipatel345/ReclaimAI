// Parasell direct integration. Formats the sealed/verified case into Parasell's report
// payload and POSTs it with an OAuth 2.0 client-credentials token (or a static API key).
// Demo mode simulates the submission so the UI flow works without credentials.
import { isDemoMode } from "../config";
import { newId } from "../ids";
import type { CaseReport, ParasellEscalation, ReportBranch } from "../incident/types";
import { provenancePayload } from "../incident/types";

if (typeof window !== "undefined") throw new Error("lib/parasell/client is server-only");

export const PARASELL_REPORTS_URL = process.env.PARASELL_API_URL ?? "https://api.parasell.com/v1/reports";
const TOKEN_URL = process.env.PARASELL_TOKEN_URL ?? "https://api.parasell.com/oauth/token";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export function parasellConfigured(): boolean {
  return !!(process.env.PARASELL_API_KEY || (process.env.PARASELL_CLIENT_ID && process.env.PARASELL_CLIENT_SECRET));
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getParasellToken(): Promise<string> {
  if (process.env.PARASELL_API_KEY) return process.env.PARASELL_API_KEY;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.PARASELL_CLIENT_ID ?? "",
      client_secret: process.env.PARASELL_CLIENT_SECRET ?? "",
      scope: process.env.PARASELL_SCOPE ?? "reports:write",
    }),
  });
  if (!res.ok) throw new Error(`Parasell token request failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

export interface ParasellReportPayload {
  externalReference: string;
  reportedAt: string;
  branch: ReportBranch;
  title: string;
  description: string;
  urls: string[];
  evidence: { sha256: string; mimeType: string; bytes: number; sourceUrl?: string; storageRef?: string }[];
  provenance: {
    isGoogleAiGenerated: boolean;
    synthIdConfidence: number;
    c2paIssuer: string | null;
    verdict: string;
    perAsset: { sha256: string; verdict: string; summary: string }[];
  };
  riskLevel?: string;
  analystSummary?: string;
  recordHash?: string;
}

/** Only hashes, URLs and analysis leave Reclaim — never media bytes. */
export function buildParasellPayload(c: CaseReport): ParasellReportPayload {
  const byAsset = new Map(c.assets.map((a) => [a.id, a]));
  return {
    externalReference: c.id,
    reportedAt: c.sealedAt ?? c.updatedAt,
    branch: c.branch,
    title: c.title,
    description: c.notes,
    urls: [...new Set([...(c.scrape?.sources.map((s) => s.url) ?? []), ...c.assets.map((a) => a.sourceUrl).filter((u): u is string => !!u)])],
    evidence: c.assets.map((a) => ({ sha256: a.sha256, mimeType: a.mimeType, bytes: a.bytes, sourceUrl: a.sourceUrl, storageRef: a.storageRef })),
    provenance: {
      ...provenancePayload(c.verifications),
      perAsset: c.verifications.map((v) => ({ sha256: byAsset.get(v.assetId)?.sha256 ?? "", verdict: v.verdict, summary: v.summary })),
    },
    riskLevel: c.suggestions?.riskLevel,
    analystSummary: c.suggestions?.summary,
    recordHash: c.recordHash,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function submitToParasell(c: CaseReport, opts: { demo?: boolean; fetchImpl?: typeof fetch } = {}): Promise<ParasellEscalation> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const createdAt = new Date().toISOString();
  const requestPayload = buildParasellPayload(c) as unknown as Record<string, unknown>;
  const base: ParasellEscalation = { id: newId("esc"), caseId: c.id, status: "pending", requestPayload, createdAt };

  if ((opts.demo ?? isDemoMode()) && !parasellConfigured()) {
    return { ...base, status: "accepted", externalId: `demo_${c.id}`, responseBody: { simulated: true }, submittedAt: createdAt };
  }
  if (!parasellConfigured()) return { ...base, status: "failed", error: "Parasell credentials not configured" };

  let token: string;
  try {
    token = await getParasellToken();
  } catch (err) {
    return { ...base, status: "failed", error: err instanceof Error ? err.message : "token error" };
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(PARASELL_REPORTS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": c.id },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      if (attempt === 3) return { ...base, status: "failed", error: err instanceof Error ? err.message : "network error" };
      await sleep(500 * 2 ** (attempt - 1));
      continue;
    }
    const submittedAt = new Date().toISOString();
    const responseBody: unknown = await res.json().catch(() => null);
    if (res.ok) {
      const id = (responseBody as { id?: string; reportId?: string } | null)?.id ?? (responseBody as { reportId?: string } | null)?.reportId;
      return { ...base, status: res.status === 202 ? "submitted" : "accepted", externalId: id, responseBody, submittedAt };
    }
    if (!RETRYABLE.has(res.status) || attempt === 3) {
      return { ...base, status: res.status === 422 || res.status === 400 ? "rejected" : "failed", responseBody, error: `Parasell responded ${res.status}`, submittedAt };
    }
    await sleep(500 * 2 ** (attempt - 1));
  }
  return { ...base, status: "failed", error: "unreachable" };
}
