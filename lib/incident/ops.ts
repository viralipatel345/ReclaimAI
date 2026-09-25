// Workflow steps behind the /api/incident routes. Each step persists and publishes a
// status event so the Reports + Status tab follows along in real time.
import { isDemoMode } from "../config";
import { hasGeminiKey } from "../gemini";
import { newId } from "../ids";
import { submitToParasell } from "../parasell/client";
import { scanMedia, scanUrl, type ScanOutput } from "../provenance";
import { reverseImageSearch } from "./imageSearch";
import { NoPublicFigureError, searchForFigure } from "./instagramSearch";
import { analyzeCase, inputFromCase } from "./orchestrator";
import { runDiscoverScrape } from "./scrape";
import { incidentStore, statusEvent, transition, type IncidentStore } from "./store";
import { publishStatus } from "./events";
import type { CaseReport, ImageSearch, ReportBranch, Reporter, SearchScope, User } from "./types";

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
    harnessRuns: [],
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
export async function runImageSearch(
  c: CaseReport,
  input: { buffer: Buffer; mimeType: string; scope?: SearchScope; subjectName?: string },
  store: IncidentStore = incidentStore,
  opts: { demo?: boolean; fetchImpl?: typeof fetch; figureSearch?: typeof searchForFigure } = {},
): Promise<CaseReport> {
  const scope = input.scope ?? "web";
  const where = scope === "instagram" ? "on Instagram" : "across the web";
  const scan = await scanMedia({ buffer: input.buffer, mimeType: input.mimeType, caseId: c.id });
  let next = attachScans(c, [scan]);
  const aiFlag = scan.verification.verdict === "ai_generated" || scan.verification.verdict === "likely_ai";
  next = await transition(next, "SCANNING", `Image fingerprinted and checked for AI provenance${aiFlag ? " — flagged" : ""}. Searching ${where} for AI-generated copies.`, store);

  let search: ImageSearch | null = null;
  let note = "";
  if (input.subjectName?.trim() || hasGeminiKey()) {
    try {
      search = await (opts.figureSearch ?? searchForFigure)(input.buffer, input.mimeType, scan.asset.id, { scope, subjectName: input.subjectName, reporterName: c.reporter?.legalName });
      next = await transition(next, "SCANNING", `Identified ${search.subject?.name}${search.subject?.source === "gemini" ? ` (${Math.round((search.subject.confidence ?? 0) * 100)}% confident)` : ""} — found ${search.considered} page${search.considered === 1 ? "" : "s"} ${where}, checked ${search.checked} image${search.checked === 1 ? "" : "s"} with SynthID${search.synthIdActive ? "" : " (detector off)"}, C2PA and Gemini vision.`, store);
    } catch (err) {
      const demo = opts.demo ?? isDemoMode();
      if (!(err instanceof NoPublicFigureError) || !demo) throw err;
      note = " — no public figure recognised, so this is the demo fixture";
    }
  }
  search ??= keepOnlyAi(await reverseImageSearch(input.buffer, scan.asset.id, { ...opts, scope, reporterName: c.reporter?.legalName }));
  const scrape = {
    id: newId("scr"),
    caseId: c.id,
    decision: "DISCOVER" as const,
    query: scope === "instagram" ? "reverse image search · Instagram" : "reverse image search",
    sources: search.matches.map((m) => ({ url: m.pageUrl, title: m.title ?? m.host, snippet: `${m.flagged ? "flagged" : m.risk} · ${m.matchType} match · ${m.reasons.join("; ")}`, fetchedAt: search.searchedAt })),
    mediaUrls: search.matches.map((m) => m.url),
    startedAt: search.searchedAt,
    completedAt: search.searchedAt,
  };
  next = { ...next, imageSearch: search, scrape };

  const n = search.matches.length;
  const suffix = (search.provider === "fixture" ? " (demo fixture)" : "") + note;
  const who = search.subject ? ` of ${search.subject.name}` : " of your image";
  const line =
    search.considered === 0
      ? `No copies${who} found ${where} right now. Reclaim can re-check later${suffix}.`
      : n === 0
        ? `Checked ${search.checked} of ${search.considered} images${who} ${where} — none showed AI signs${suffix}.`
        : `Checked ${search.checked} of ${search.considered} images${who} ${where} — ${n} AI-generated, flagged for you${suffix}.`;
  return transition(next, "SCANNING", line, store);
}

/** Non-Gemini providers (fixture, Vision) don't check images themselves: keep only AI-flagged matches and fill the counts. */
export function keepOnlyAi(s: ImageSearch): ImageSearch {
  const rank = { ai_generated: 0, likely_ai: 1, no_signal: 2, unchecked: 3 } as const;
  const matches = s.matches.filter((m) => m.ai?.verdict === "ai_generated" || m.ai?.verdict === "likely_ai").sort((a, b) => rank[a.ai!.verdict] - rank[b.ai!.verdict] || b.ai!.confidence - a.ai!.confidence);
  return { ...s, onlyAi: true, considered: s.matches.length, checked: s.matches.filter((m) => m.ai && m.ai.verdict !== "unchecked").length, matches };
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
