// Workflow steps behind the /api/incident routes. Each step persists and publishes a
// status event so the Reports + Status tab follows along in real time.
import { newId } from "../ids";
import { submitToParasell } from "../parasell/client";
import { scanMedia, scanUrl, type ScanOutput } from "../provenance";
import { reverseImageSearch } from "./imageSearch";
import { analyzeCase, inputFromCase } from "./orchestrator";
import { runDiscoverScrape } from "./scrape";
import { incidentStore, statusEvent, transition, type IncidentStore } from "./store";
import { publishStatus } from "./events";
import type { CaseReport, ReportBranch, Reporter, User } from "./types";

const MAX_DISCOVER_SCANS = 5;

export class NotFound extends Error {}

export async function loadOwned(caseId: string, userId: string, store: IncidentStore = incidentStore): Promise<CaseReport> {
  const c = await store.get(caseId);
  if (!c || c.userId !== userId) throw new NotFound("Case not found");
  return c;
}

export function cleanReporter(raw: unknown, at: string): Reporter | undefined {
  const r = raw as Partial<Reporter> | null;
  if (!r || typeof r !== "object") return undefined;
  const s = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const reporter = { legalName: s(r.legalName), contactEmail: s(r.contactEmail), signature: s(r.signature) };
  if (!reporter.legalName && !reporter.contactEmail && !reporter.signature) return undefined;
  return { ...reporter, signedAt: reporter.signature ? at : undefined };
}

export async function createReport(user: User, input: { branch: ReportBranch; title: string; notes?: string; reporter?: Reporter }, store: IncidentStore = incidentStore): Promise<CaseReport> {
  const at = new Date().toISOString();
  const id = newId("case");
  const evt = statusEvent(id, "DRAFT", input.branch === "DISCOVER" ? "Automated discovery started." : input.branch === "IMAGE_SEARCH" ? "Image received for web search." : "Report created.", at);
  const c: CaseReport = {
    id,
    userId: user.id,
    branch: input.branch,
    status: "DRAFT",
    title: input.title.trim().slice(0, 200),
    notes: (input.notes ?? "").trim().slice(0, 5000),
    reporter: input.reporter,
    isDraft: true,
    assets: [],
    verifications: [],
    escalations: [],
    reports: [],
    events: [evt],
    createdAt: at,
    updatedAt: at,
  };
  await store.save(c);
  publishStatus(evt);
  return c;
}

export function attachScans(c: CaseReport, outputs: ScanOutput[]): CaseReport {
  const known = new Set(c.assets.map((a) => a.sha256));
  const fresh = outputs.filter((o) => !known.has(o.asset.sha256));
  return {
    ...c,
    assets: [...c.assets, ...fresh.map((o) => o.asset)],
    verifications: [...c.verifications, ...fresh.map((o) => o.verification)],
  };
}

/** Branch B: search, collect media references, scan what we can, and record the DISCOVER decision. */
export async function runDiscovery(c: CaseReport, query: string, seedUrls: string[] = [], store: IncidentStore = incidentStore): Promise<CaseReport> {
  let next = await transition(c, "SCANNING", `Scraper running for "${query.slice(0, 80)}".`, store);
  const scrape = await runDiscoverScrape({ caseId: c.id, query, seedUrls });
  next = { ...next, scrape };

  const scanned = new Set(next.assets.map((a) => a.sourceUrl));
  const targets = scrape.mediaUrls.filter((u) => !scanned.has(u)).slice(0, MAX_DISCOVER_SCANS);
  const results = await Promise.all(targets.map((u) => scanUrl(u, c.id).catch(() => null)));
  next = attachScans(next, results.filter((r): r is ScanOutput => !!r));

  return transition(next, "SCANNING", `Discovery found ${scrape.sources.length} source(s) and checked ${results.filter(Boolean).length} media file(s).`, store);
}

/** Branch C: provenance-scan the uploaded image, find where it appears online, classify each host. */
export async function runImageSearch(c: CaseReport, input: { buffer: Buffer; mimeType: string }, store: IncidentStore = incidentStore, opts: { demo?: boolean; fetchImpl?: typeof fetch } = {}): Promise<CaseReport> {
  const scan = await scanMedia({ buffer: input.buffer, mimeType: input.mimeType, caseId: c.id });
  let next = attachScans(c, [scan]);
  const flagged = scan.verification.verdict === "ai_generated" || scan.verification.verdict === "likely_ai";
  next = await transition(next, "SCANNING", `Image fingerprinted and checked for AI provenance${flagged ? " — flagged" : ""}. Searching the web for it.`, store);

  const search = await reverseImageSearch(input.buffer, scan.asset.id, opts);
  const scrape = {
    id: newId("scr"),
    caseId: c.id,
    decision: "DISCOVER" as const,
    query: "reverse image search",
    sources: search.matches.map((m) => ({ url: m.pageUrl, title: m.title ?? m.host, snippet: `${m.risk} · ${m.matchType} match · ${m.reasons.join("; ")}`, fetchedAt: search.searchedAt })),
    mediaUrls: search.matches.map((m) => m.url),
    startedAt: search.searchedAt,
    completedAt: search.searchedAt,
  };
  next = { ...next, imageSearch: search, scrape };

  const shady = search.matches.filter((m) => m.risk === "shady").length;
  const normal = search.matches.filter((m) => m.risk === "normal").length;
  const line = search.matches.length
    ? `Found your image on ${search.matches.length} page${search.matches.length === 1 ? "" : "s"}: ${shady} shady, ${normal} known platform${normal === 1 ? "" : "s"}, ${search.matches.length - shady - normal} unfamiliar${search.provider === "fixture" ? " (demo fixture)" : ""}.`
    : "No copies of your image found on the web right now. Reclaim can re-check later.";
  return transition(next, "SCANNING", line, store);
}

export async function recordScans(c: CaseReport, outputs: ScanOutput[], store: IncidentStore = incidentStore): Promise<CaseReport> {
  const next = attachScans(c, outputs);
  const flagged = outputs.filter((o) => o.verification.verdict === "ai_generated" || o.verification.verdict === "likely_ai").length;
  return transition(next, "SCANNING", `${outputs.length} file(s) checked for AI provenance${flagged ? `, ${flagged} flagged` : ""}.`, store);
}

export async function orchestrate(c: CaseReport, store: IncidentStore = incidentStore): Promise<CaseReport> {
  const suggestions = await analyzeCase(inputFromCase(c));
  const next = { ...c, suggestions };
  const label = suggestions.source === "gemini" ? `Gemini analysis complete (${suggestions.riskLevel} risk).` : `Analysis complete without Gemini (${suggestions.riskLevel} risk).`;
  return transition(next, "ANALYZED", label, store);
}

export async function escalateToParasell(c: CaseReport, store: IncidentStore = incidentStore): Promise<CaseReport> {
  const escalation = await submitToParasell(c);
  const next = { ...c, escalations: [escalation, ...c.escalations] };
  const ok = escalation.status === "accepted" || escalation.status === "submitted";
  return transition(next, ok ? "ESCALATED" : c.status, ok ? `Report sent to Parasell${escalation.externalId ? ` (ref ${escalation.externalId})` : ""}.` : `Parasell submission failed: ${escalation.error ?? "unknown error"}.`, store);
}
