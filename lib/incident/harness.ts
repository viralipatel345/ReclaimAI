// Agent harness: a supervised loop that keeps a case alive after the user walks away.
//
//   mandate → watch → decide → act → record
//
// - Mandate: the user signs a standing authorization listing exactly which actions the agent
//   may take on its own (notices, StopNCII, FTC after a missed deadline, Parasell), how often
//   to check, and a per-run cap. Revoking it stops the loop; nothing runs without it.
// - Watch: on schedule (Cloud Scheduler → POST /api/incident/harness) or on demand, re-run
//   the AI-image search by the stored subject name — the original upload is never kept.
// - Decide: a deterministic policy, not the model, maps findings to actions. Anything outside
//   the mandate becomes a "needs you" decision instead of an action.
// - Act: actions go through the same reporting agent as manual filings, so every step is
//   logged with a timestamp, and demo mode simulates sends.
// - Record: each run is appended to the case as a HarnessRun and covered by the sealed hash.
import { isDemoMode } from "../config";
import { newId } from "../ids";
import { fetchPageImage } from "../provenance/fetchImage";
import { addHours, shortDateTime } from "../time";
import { reverseImageSearch } from "./imageSearch";
import { searchForFigure } from "./instagramSearch";
import { CADENCE_OPTIONS, DEFAULT_MANDATE, MANDATE_ACTIONS, MANDATE_TEXT } from "./mandate";
import { keepOnlyAi } from "./ops";
import { fileReport } from "./reporting";
import { incidentStore, transition, type IncidentStore } from "./store";
import type { CaseReport, HarnessDecision, HarnessRun, ImageMatch, ImageSearch, Mandate, MandateAction } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/harness is server-only");

export class HarnessError extends Error {
  constructor(message: string, public status: 400 | 403 | 409 = 400) {
    super(message);
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function grantMandate(c: CaseReport, input: { allowedActions?: MandateAction[]; cadenceHours?: number; maxNoticesPerRun?: number; signature: string }, at: string): CaseReport {
  if (c.status === "SEALED") throw new HarnessError("This record is sealed. Start a new draft to authorize the agent.", 409);
  if (!c.reporter?.signature) throw new HarnessError("Add your name, contact email and signature to the report first.");
  const typed = norm(input.signature);
  if (typed !== norm(c.reporter.signature) && typed !== norm(c.reporter.legalName)) {
    throw new HarnessError(`To authorize the agent, type your name as it appears on the report: “${c.reporter.signature}”.`, 403);
  }
  const allowed = (input.allowedActions ?? [...DEFAULT_MANDATE.allowedActions]).filter((a) => MANDATE_ACTIONS.some((m) => m.id === a));
  if (allowed.length === 0) throw new HarnessError("Allow at least one action, or the agent has nothing to do.");
  const cadenceHours = CADENCE_OPTIONS.some((o) => o.hours === input.cadenceHours) ? input.cadenceHours! : 24;
  const mandate: Mandate = {
    enabled: true,
    allowedActions: allowed,
    cadenceHours,
    maxNoticesPerRun: Math.min(20, Math.max(1, input.maxNoticesPerRun ?? DEFAULT_MANDATE.maxNoticesPerRun)),
    text: MANDATE_TEXT,
    signature: input.signature.trim(),
    grantedAt: at,
  };
  return { ...c, mandate, nextCheckAt: at };
}

export function revokeMandate(c: CaseReport, at: string): CaseReport {
  if (!c.mandate) return c;
  return { ...c, mandate: { ...c.mandate, enabled: false, revokedAt: at }, nextCheckAt: undefined };
}

export type Research = (c: CaseReport, round: number) => Promise<ImageSearch | null>;

/** Re-run the AI-image search from what the case remembers (subject name / scope). The upload is gone by design. */
export const defaultResearch: Research = async (c, round) => {
  const s = c.imageSearch;
  if (!s) return null;
  const reporterName = c.reporter?.legalName;
  if (s.provider === "gemini" && s.subject) {
    return searchForFigure(Buffer.alloc(0), "image/jpeg", s.assetId, { scope: s.scope, subjectName: s.subject.name, reporterName });
  }
  return keepOnlyAi(await reverseImageSearch(Buffer.alloc(0), s.assetId, { scope: s.scope, reporterName, round }));
};

export interface RunOptions {
  trigger?: HarnessRun["trigger"];
  /** Epoch ms. Demo "fast-forward" passes a future clock; real runs use server time. */
  now?: number;
  demo?: boolean;
  store?: IncidentStore;
  research?: Research;
  file?: typeof fileReport;
  /** Is the page still up? Used before escalating to the FTC. */
  stillUp?: (url: string) => Promise<boolean | null>;
}

const defaultStillUp = async (url: string): Promise<boolean | null> => {
  const r = await fetchPageImage(url);
  return r.page === "ok" ? true : null;
};

/** One supervised pass over a case. Throws when there is no active mandate. */
export async function runHarness(c: CaseReport, opts: RunOptions = {}): Promise<CaseReport> {
  if (!c.mandate?.enabled) throw new HarnessError("The agent has no active mandate for this case.", 403);
  if (c.status === "SEALED") throw new HarnessError("This record is sealed; the agent can't act on it.", 409);
  const now = opts.now ?? Date.now();
  const demo = opts.demo ?? isDemoMode();
  const store = opts.store ?? incidentStore;
  const file = opts.file ?? fileReport;
  const clock = () => new Date(now).toISOString();
  const startedAt = clock();
  const round = c.harnessRuns.length + 1;
  const allowed = new Set(c.mandate.allowedActions);
  const decisions: HarnessDecision[] = [];
  const note = (d: Omit<HarnessDecision, "at">) => decisions.push({ at: clock(), ...d });

  let next = await transition(c, c.status, `Agent check #${round} started${opts.trigger === "schedule" ? " (scheduled)" : ""}.`, store);

  // ---- watch ----
  let newAi: ImageMatch[] = [];
  let considered = 0;
  const fresh = await (opts.research ?? defaultResearch)(next, round);
  if (!fresh) {
    note({ kind: "skipped", action: "recheck", reason: "no image search on this case to repeat" });
  } else {
    considered = fresh.considered;
    const known = new Set(next.imageSearch?.matches.map((m) => m.pageUrl) ?? []);
    newAi = fresh.matches.filter((m) => !known.has(m.pageUrl));
    const merged = { ...fresh, matches: [...newAi, ...(next.imageSearch?.matches ?? [])], searchedAt: startedAt };
    const sources = merged.matches.map((m) => ({ url: m.pageUrl, title: m.title ?? m.host, snippet: `${m.flagged ? "flagged" : m.risk} · ${m.matchType} match · ${m.reasons.join("; ")}`, fetchedAt: startedAt }));
    next = { ...next, imageSearch: merged, scrape: next.scrape ? { ...next.scrape, sources, mediaUrls: merged.matches.map((m) => m.url), completedAt: startedAt } : next.scrape };
    note({ kind: "auto", action: "recheck", reason: `re-checked ${fresh.checked} of ${fresh.considered} images${fresh.subject ? ` of ${fresh.subject.name}` : ""}: ${newAi.length} new AI-generated` });
  }

  // ---- decide + act: notices for new AI images ----
  const noticed = new Set(next.reports.filter((r) => r.channel === "platform" && r.status !== "failed").map((r) => r.url));
  let sent = 0;
  for (const m of newAi) {
    if (noticed.has(m.pageUrl)) continue;
    if (!allowed.has("platform_notice")) {
      note({ kind: "needs_you", action: "platform_notice", target: m.pageUrl, reason: "notices are not in the mandate — waiting for you" });
      continue;
    }
    if (sent >= c.mandate.maxNoticesPerRun) {
      note({ kind: "needs_you", action: "platform_notice", target: m.pageUrl, reason: `per-run cap of ${c.mandate.maxNoticesPerRun} notices reached` });
      continue;
    }
    next = await file(next, "platform", { url: m.pageUrl, demo, store, clock });
    const r = next.reports[0];
    if (r.status === "failed") note({ kind: "skipped", action: "platform_notice", target: m.pageUrl, reason: r.error ?? "notice failed", reportId: r.id });
    else {
      sent++;
      note({ kind: "auto", action: "platform_notice", target: m.pageUrl, reason: `${r.status === "simulated" || r.status === "sent" ? "sent" : "prepared"} to ${r.reference ?? m.host}${r.deadlineAt ? `, due ${shortDateTime(r.deadlineAt)}` : ""}`, reportId: r.id });
    }
  }

  // ---- once-per-case escalations ----
  const filed = (ch: string) => next.reports.some((r) => r.channel === ch && r.status !== "failed" && r.status !== "running");
  const aiCount = next.imageSearch?.matches.length ?? 0;
  if (allowed.has("stopncii") && !filed("stopncii") && next.assets.length > 0 && aiCount > 0) {
    next = await file(next, "stopncii", { demo, store, clock });
    const r = next.reports[0];
    note({ kind: r.status === "failed" ? "skipped" : "auto", action: "stopncii", reason: r.status === "failed" ? (r.error ?? "failed") : `registered${r.reference ? ` (${r.reference})` : ""}`, reportId: r.id });
  }
  if (allowed.has("parasell") && !filed("parasell") && aiCount > 0) {
    next = await file(next, "parasell", { demo, store, clock });
    const r = next.reports[0];
    note({ kind: r.status === "failed" ? "skipped" : "auto", action: "parasell", reason: r.status === "failed" ? (r.error ?? "failed") : `escalated${r.reference ? ` (${r.reference})` : ""}`, reportId: r.id });
  }

  // ---- FTC only after a missed deadline, and only if the content is still up ----
  const overdue = next.reports.filter((r) => r.channel === "platform" && r.deadlineAt && new Date(r.deadlineAt).getTime() < now && (r.status === "simulated" || r.status === "sent"));
  if (overdue.length > 0 && !filed("ftc")) {
    if (!allowed.has("ftc_after_deadline")) {
      note({ kind: "needs_you", action: "ftc_after_deadline", target: overdue[0].url, reason: `${overdue[0].reference} missed its 48-hour deadline — FTC complaints are not in the mandate` });
    } else {
      const up = await (opts.stillUp ?? defaultStillUp)(overdue[0].url ?? "");
      if (up === true || (up === null && demo)) {
        next = await file(next, "ftc", { demo, store, clock });
        const r = next.reports[0];
        note({ kind: r.status === "failed" ? "skipped" : "auto", action: "ftc_after_deadline", target: overdue[0].url, reason: r.status === "failed" ? (r.error ?? "failed") : `${overdue[0].reference} missed its deadline and the page is ${up === true ? "still up" : "assumed up (demo)"} — complaint ${r.status === "simulated" ? "filed (demo)" : "prepared"}`, reportId: r.id });
      } else if (up === null) {
        note({ kind: "needs_you", action: "ftc_after_deadline", target: overdue[0].url, reason: `${overdue[0].reference} missed its deadline but the page couldn't be reached — check whether it's gone before filing` });
      } else {
        note({ kind: "skipped", action: "ftc_after_deadline", target: overdue[0].url, reason: "page no longer reachable — treated as removed" });
      }
    }
  }

  // ---- record + schedule ----
  const nextCheckAt = addHours(clock(), c.mandate.cadenceHours);
  const run: HarnessRun = { id: newId("run"), caseId: c.id, trigger: opts.trigger ?? "manual", startedAt, finishedAt: clock(), considered, newAiMatches: newAi.length, decisions, nextCheckAt };
  next = { ...next, harnessRuns: [run, ...next.harnessRuns], nextCheckAt };
  const auto = decisions.filter((d) => d.kind === "auto" && d.action !== "recheck").length;
  const needs = decisions.filter((d) => d.kind === "needs_you").length;
  const line = `Agent check #${round}: ${newAi.length} new AI image${newAi.length === 1 ? "" : "s"}, ${auto} action${auto === 1 ? "" : "s"} taken${needs ? `, ${needs} need${needs === 1 ? "s" : ""} you` : ""}. Next check ${new Date(nextCheckAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`;
  return transition(next, auto > 0 ? "ESCALATED" : next.status, line, store);
}

/** Cron entry point: run every due case. */
export async function runDueCases(now: number, store: IncidentStore = incidentStore, opts: Omit<RunOptions, "store" | "now" | "trigger"> = {}): Promise<{ ran: number; actions: number }> {
  const due = await store.listDue(now);
  let actions = 0;
  for (const c of due) {
    try {
      const r = await runHarness(c, { ...opts, store, now, trigger: "schedule" });
      actions += r.harnessRuns[0].decisions.filter((d) => d.kind === "auto" && d.action !== "recheck").length;
    } catch (err) {
      console.warn(`[harness] case ${c.id} failed`, err instanceof Error ? err.message : err);
    }
  }
  return { ran: due.length, actions };
}
