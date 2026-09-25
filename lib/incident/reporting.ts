// Reporting agent. For each channel it does everything that can be done programmatically
// (resolve the platform, draft the notice, fingerprint files, compile the timeline, call
// the partner API), hands off where no API exists for individuals, and writes every step
// with a timestamp onto the case record. Demo mode simulates the send.
import { DEADLINE_HOURS, isDemoMode } from "../config";
import { hasGeminiKey } from "../gemini";
import { newId } from "../ids";
import { submitToParasell } from "../parasell/client";
import { hostOf, matchDirectory, normalizeUrl, unresolvedPlatform } from "../platforms";
import { resolvePlatform } from "../resolve";
import { renderTakedownRequest } from "../templates";
import { addHours, shortDateTime } from "../time";
import type { ResolvedPlatform } from "../types";
import { CHANNELS, STOPNCII_URL } from "./channels";
import { publishStatus } from "./events";
import { buildDispatchSummary, inputFromCase } from "./orchestrator";
import { incidentStore, statusEvent, transition, type IncidentStore } from "./store";
import type { CaseReport, ParasellEscalation, ReportAction, ReportChannel, ReportStatus } from "./types";
import { provenancePayload } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/reporting is server-only");

export class ReportError extends Error {
  constructor(message: string, public status: 400 | 409 = 400) {
    super(message);
  }
}

export interface FileOptions {
  url?: string;
  demo?: boolean;
  store?: IncidentStore;
  resolve?: (url: string) => Promise<ResolvedPlatform>;
  clock?: () => string;
}

class Recorder {
  readonly action: ReportAction;
  escalation?: ParasellEscalation;
  constructor(private c: CaseReport, channel: ReportChannel, private clock: () => string) {
    this.action = { id: newId("rpt"), caseId: c.id, channel, status: "running", steps: [], destination: CHANNELS[channel].destination, startedAt: clock() };
  }
  step(text: string) {
    const at = this.clock();
    this.action.steps.push({ at, text });
    publishStatus(statusEvent(this.c.id, this.c.status, `${CHANNELS[this.action.channel].label}: ${text}`, at));
  }
  finish(status: Exclude<ReportStatus, "running" | "failed">, extra: Partial<ReportAction> = {}) {
    Object.assign(this.action, extra, { status, completedAt: this.clock() });
  }
  fail(message: string) {
    this.action.steps.push({ at: this.clock(), text: `Stopped: ${message}` });
    Object.assign(this.action, { status: "failed" as const, error: message, completedAt: this.clock() });
  }
}

type Runner = (c: CaseReport, rec: Recorder, ctx: { demo: boolean; url?: string; resolve: (url: string) => Promise<ResolvedPlatform> }) => Promise<void>;

const urlsOf = (c: CaseReport) => [...new Set([...(c.scrape?.sources.map((s) => s.url) ?? []), ...c.assets.map((a) => a.sourceUrl).filter((u): u is string => !!u)])];

const platform: Runner = async (c, rec, ctx) => {
  const raw = ctx.url ?? urlsOf(c)[0];
  if (!raw) throw new ReportError("Add the link to the content first — a notice has to say where it is.");
  const url = normalizeUrl(raw);
  if (!url) throw new ReportError("That doesn't look like a valid link.");
  const r = c.reporter;
  if (!r?.legalName || !r.contactEmail || !r.signature) throw new ReportError("A valid notice needs your name, a contact email and your typed signature.");

  const host = hostOf(url);
  rec.step(`Located the content at ${host}.`);
  const p = matchDirectory(url) ?? (await ctx.resolve(url));
  if (p.channel && p.target) {
    rec.step(`Resolved ${p.name} — official removal channel is ${p.channel === "email" ? `email (${p.target})` : "a web form"}${p.source === "search" ? ", found via Google Search" : ""}.`);
  } else {
    rec.step(`Couldn't confirm ${p.name}'s removal channel — the notice will be prepared for its contact page.`);
  }
  if (!p.coveredByAct) rec.step(`${p.name} is a search engine, not a covered platform: the notice cites its own policy rather than the 48-hour duty.`);

  const signedAt = r.signedAt ?? rec.action.startedAt;
  const rendered = renderTakedownRequest({ platformName: p.name, coveredByAct: p.coveredByAct, urls: [url], legalName: r.legalName, contactEmail: r.contactEmail, signature: r.signature, signedAt });
  rec.step("Drafted the notice: identification of the content, good-faith statement, the 48-hour obligation, your contact details and signature.");

  const artifact =
    p.channel === "email" && p.target
      ? { title: rendered.subject, body: rendered.body, mailto: `mailto:${encodeURIComponent(p.target)}?subject=${encodeURIComponent(rendered.subject)}&body=${encodeURIComponent(rendered.body)}` }
      : {
          title: rendered.subject,
          body: rendered.body,
          fields: [
            { label: "Your name", value: r.legalName },
            { label: "Your email", value: r.contactEmail },
            { label: "Link to the content", value: url },
            { label: "Signature", value: r.signature },
            { label: "Full request", value: rendered.body },
          ],
        };

  if (!p.channel || !p.target) {
    rec.step("Use the site's contact page and paste the notice. The 48-hour clock starts when they receive it.");
    rec.finish("prepared", { artifact, destination: `https://${host}`, reference: p.name });
    return;
  }
  if (ctx.demo) {
    const sentAt = rec.action.startedAt;
    const deadlineAt = addHours(sentAt, DEADLINE_HOURS);
    rec.step(`Sent to ${p.target} (demo — nothing actually left the app).`);
    rec.step(`48-hour clock started — ${p.name} must remove it by ${shortDateTime(deadlineAt)}.`);
    rec.finish("simulated", { artifact, destination: p.target, reference: p.name, deadlineAt });
    return;
  }
  rec.step(p.channel === "email" ? "Ready to send — opens in your mail app with everything filled in. The clock starts when you send it." : "Ready to submit — the form fields are filled in for you to paste. The clock starts when you submit.");
  rec.finish("prepared", { artifact, destination: p.target, reference: p.name });
};

const stopncii: Runner = async (c, rec, ctx) => {
  const media = c.assets.filter((a) => a.kind === "image" || a.kind === "video");
  if (media.length === 0) throw new ReportError("Check at least one image or video first so it can be fingerprinted.");
  rec.step(`Fingerprinted ${media.length} file${media.length === 1 ? "" : "s"} (SHA-256). StopNCII computes its own PDQ hash on your device — the image itself never leaves it.`);
  const prov = provenancePayload(c.verifications);
  const body = [
    "StopNCII case summary",
    `Files: ${media.length}`,
    ...media.map((a) => `- ${a.kind} ${a.mimeType} · sha256 ${a.sha256}`),
    `Provenance: ${prov.verdict}${prov.c2paIssuer ? ` (Content Credentials: ${prov.c2paIssuer})` : ""}${prov.isGoogleAiGenerated ? " (SynthID watermark)" : ""}`,
    `Known locations: ${urlsOf(c).join(", ") || "none yet"}`,
  ].join("\n");
  rec.step("Prepared the case summary and the list of files to hash.");
  if (ctx.demo) {
    rec.step("Case created (demo). Partner platforms — Meta, Google, TikTok, X, Bing — would now block matching uploads.");
    rec.finish("simulated", { artifact: { title: "StopNCII case", body }, reference: `SNCII-${rec.action.id.slice(-6).toUpperCase()}` });
    return;
  }
  rec.step("StopNCII has no API for individuals: finish the three-step wizard at stopncii.org with the same files. Hashes are generated in your browser.");
  rec.finish("handed_off", { artifact: { title: "StopNCII case", body }, destination: STOPNCII_URL });
};

const ftc: Runner = async (c, rec, ctx) => {
  const notice = c.reports.find((r) => r.channel === "platform" && r.status !== "failed" && r.status !== "running");
  const timeline = [...c.reports.flatMap((r) => r.steps.map((s) => ({ at: s.at, text: `${CHANNELS[r.channel].label}: ${s.text}` }))), ...c.events.map((e) => ({ at: e.at, text: e.text }))]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => `${shortDateTime(e.at)} — ${e.text}`);
  rec.step(`Compiled the timeline from the case record (${timeline.length} entries).`);
  if (!notice) rec.step("No platform notice on file yet — the FTC expects a missed 48-hour deadline or a rejection. The complaint still records what happened.");
  else if (notice.deadlineAt && new Date(notice.deadlineAt).getTime() > new Date(rec.action.startedAt).getTime()) rec.step(`Note: ${notice.reference}'s 48-hour deadline (${shortDateTime(notice.deadlineAt)}) hasn't passed yet.`);

  const r = c.reporter;
  const body = [
    "Company",
    notice ? `${notice.reference} (${notice.destination})` : "Platform not yet notified",
    "",
    "What happened",
    c.suggestions?.summary ?? c.title,
    "This appears to violate the platform's obligation under Section 3 of the TAKE IT DOWN Act to remove the depiction within 48 hours of a valid request.",
    "",
    "Timeline",
    ...timeline,
    "",
    "Links",
    ...(urlsOf(c).length ? urlsOf(c) : ["(none on file)"]),
    "",
    "Contact",
    r ? `${r.legalName}\n${r.contactEmail}` : "(add your details in the report)",
  ].join("\n");
  rec.step("Drafted the complaint: company, what happened, timeline, links, contact.");
  if (ctx.demo) {
    rec.step("Filed with the FTC (demo).");
    rec.finish("simulated", { artifact: { title: "FTC complaint", body }, reference: `FTC-${rec.action.id.slice(-6).toUpperCase()}` });
    return;
  }
  rec.step("The FTC takes complaints through its web form only: open it and paste each section.");
  rec.finish("handed_off", { artifact: { title: "FTC complaint", body } });
};

const police: Runner = async (c, rec) => {
  const r = c.reporter;
  const body = [buildDispatchSummary(inputFromCase(c)), r ? `REPORTER: ${r.legalName} · ${r.contactEmail}` : "REPORTER: (add your details in the report)"].join("\n");
  rec.step("Prepared a dispatch-format summary — WHAT / WHEN / WHERE / EVIDENCE. It never describes the imagery.");
  rec.step(`Attached ${c.assets.length} evidence fingerprint${c.assets.length === 1 ? "" : "s"} and the provenance verdict.`);
  rec.step("Police reports are filed by you: read this out on the non-emergency line or paste it into your department's online report.");
  rec.finish("prepared", { artifact: { title: "Police report summary", body } });
};

const parasell: Runner = async (c, rec, ctx) => {
  rec.step("Built the payload: file hashes, provenance verdicts, known URLs and risk level — no media.");
  const esc = await submitToParasell(c, { demo: ctx.demo });
  rec.escalation = esc;
  const ok = esc.status === "accepted" || esc.status === "submitted";
  if (!ok) throw new ReportError(esc.error ?? "Parasell rejected the report");
  rec.step(`${esc.status === "submitted" ? "Queued by" : "Accepted by"} Parasell${esc.externalId ? ` — reference ${esc.externalId}` : ""}${ctx.demo ? " (demo)" : ""}.`);
  rec.finish(ctx.demo ? "simulated" : "sent", { reference: esc.externalId, artifact: { title: "Parasell payload", body: JSON.stringify(esc.requestPayload, null, 2) } });
};

const RUNNERS: Record<ReportChannel, Runner> = { platform, stopncii, ftc, police, parasell };

const DONE_LINE: Record<Exclude<ReportStatus, "running">, (label: string, ref?: string) => string> = {
  sent: (l, ref) => `${l} sent${ref ? ` (${ref})` : ""}.`,
  simulated: (l, ref) => `${l} sent (demo)${ref ? ` — ${ref}` : ""}.`,
  handed_off: (l) => `${l} prepared — finish it at the destination.`,
  prepared: (l) => `${l} ready for you to send.`,
  failed: (l) => `${l} could not be filed.`,
};

/** File the case through one channel, appending the step log to the record. */
export async function fileReport(c: CaseReport, channel: ReportChannel, opts: FileOptions = {}): Promise<CaseReport> {
  if (c.status === "SEALED") throw new ReportError("This record is sealed. Start a new draft to file more reports.", 409);
  if (!RUNNERS[channel]) throw new ReportError("Unknown channel");
  const demo = opts.demo ?? isDemoMode();
  const store = opts.store ?? incidentStore;
  const clock = opts.clock ?? (() => new Date().toISOString());
  const resolve = opts.resolve ?? (hasGeminiKey() ? resolvePlatform : async (u: string) => unresolvedPlatform(u));

  const rec = new Recorder(c, channel, clock);
  try {
    await RUNNERS[channel](c, rec, { demo, url: opts.url, resolve });
  } catch (err) {
    if (err instanceof ReportError && err.status === 409) throw err;
    rec.fail(err instanceof Error ? err.message : "unknown error");
  }

  const a = rec.action;
  const next: CaseReport = { ...c, reports: [a, ...c.reports], escalations: rec.escalation ? [rec.escalation, ...c.escalations] : c.escalations };
  const status = a.status as Exclude<ReportStatus, "running">;
  const line = DONE_LINE[status](CHANNELS[channel].label, a.reference);
  return transition(next, status === "failed" ? c.status : "ESCALATED", line, store);
}

/** Every step across every report, oldest first — the audit record. */
export function stepLog(c: CaseReport): { at: string; channel: ReportChannel | null; text: string }[] {
  return [
    ...c.reports.flatMap((r) => r.steps.map((s) => ({ at: s.at, channel: r.channel, text: s.text }))),
    ...c.events.map((e) => ({ at: e.at, channel: null, text: e.text })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}
