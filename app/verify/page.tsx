"use client";
// Incident verification flow: report (manual or agent discovery) → provenance scan →
// Gemini suggestions → escalation → seal. The dark panel is the live Reports + Status tab.
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useDemoMode } from "@/components/Providers";
import { btnGhost, btnPrimary, btnSecondary, card, Eyebrow, Modal } from "@/components/ui";
import { incidentApi, type StatusRow } from "@/lib/incident/client";
import type { AgentAction, CaseReport, CaseStatus, ProvenanceVerdict, RiskLevel, StatusEvent, VerificationResult } from "@/lib/incident/types";
import { clockTime } from "@/lib/time";

const STEPS = ["Report", "Verify", "Act", "Seal"] as const;
const STEP_FOR: Record<CaseStatus, number> = { DRAFT: 1, SCANNING: 1, ANALYZED: 2, ESCALATED: 2, SEALED: 3, CLOSED: 3 };

export default function VerifyPage() {
  const demo = useDemoMode();
  const [c, setCase] = useState<CaseReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [live, setLive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshRows = useCallback(() => incidentApi.status().then((r) => setRows(r.cases)).catch(() => {}), []);

  useEffect(() => {
    refreshRows();
    const off = incidentApi.subscribe((evt) => {
      setEvents((prev) => [evt, ...prev].slice(0, 30));
      setLive(true);
      refreshRows();
    });
    return off;
  }, [refreshRows]);

  const run = async (label: string, fn: () => Promise<CaseReport>) => {
    setBusy(label);
    setError(null);
    try {
      setCase(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const step = c ? STEP_FOR[c.status] : 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 md:px-12 md:pt-10">
      <Eyebrow>Incident verification · SynthID + C2PA + Gemini</Eyebrow>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">Verify it. Then act on it.</h1>
      <p className="mt-3 max-w-[62ch] text-muted">
        Report it yourself or let the agent go looking. Reclaim checks the media for AI watermarks and Content Credentials, asks Gemini what to do next, and seals the verified record.
      </p>

      <ol className="mt-6 flex gap-2 overflow-x-auto" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${i === step ? "border-accent bg-accent-soft font-medium text-accent" : i < step ? "border-line bg-surface text-removed" : "border-line bg-surface text-muted"}`}
          >
            <span className="font-mono text-[11px]">{i < step ? <Icon name="check" size={12} strokeWidth={2.5} /> : `0${i + 1}`}</span>
            {s}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl bg-overdue-soft px-4 py-3 text-sm text-overdue">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ReportCard c={c} busy={busy} run={run} onReset={() => { setCase(null); setError(null); }} />
          <EvidenceCard c={c} busy={busy} run={run} fileRef={fileRef} />
          <ActionsCard c={c} busy={busy} run={run} onAddEvidence={() => fileRef.current?.click()} />
          <SealCard c={c} busy={busy} run={run} />
        </div>
        <StatusPanel rows={rows} events={events} live={live} demo={demo} activeId={c?.id} />
      </div>
    </div>
  );
}

type Run = (label: string, fn: () => Promise<CaseReport>) => Promise<void>;

function SectionHead({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <header className="flex items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <span className="font-mono text-xs text-accent">{n}</span> {title}
      </h2>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </header>
  );
}

const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-accent disabled:opacity-60";

function ReportCard({ c, busy, run, onReset }: { c: CaseReport | null; busy: string | null; run: Run; onReset: () => void }) {
  const [branch, setBranch] = useState<"MANUAL" | "DISCOVER">("MANUAL");
  const [title, setTitle] = useState("Someone posted my photos");
  const [notes, setNotes] = useState("My ex keeps posting them and says he wants money. I'm scared and can't sleep.");
  const [query, setQuery] = useState("");
  const [seed, setSeed] = useState("");

  if (c) {
    return (
      <section className={`${card} p-5 md:p-6`}>
        <SectionHead n="01" title={c.branch === "DISCOVER" ? "Agent discovery" : "Your report"} hint={c.id} />
        <p className="mt-3 font-medium">{c.title}</p>
        {c.notes && <p className="mt-1 text-sm leading-relaxed text-muted">{c.notes}</p>}
        {c.scrape && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Icon name="search" size={15} className="text-accent" />
            Decision <span className="font-mono text-xs uppercase text-accent">{c.scrape.decision}</span> · {c.scrape.sources.length} source{c.scrape.sources.length === 1 ? "" : "s"}, {c.scrape.mediaUrls.length} media reference{c.scrape.mediaUrls.length === 1 ? "" : "s"}
          </p>
        )}
        <button onClick={onReset} className={`${btnGhost} mt-4 -ml-2`}>
          <Icon name="plus" size={14} /> Start another
        </button>
      </section>
    );
  }

  const isManual = branch === "MANUAL";
  const canSubmit = isManual ? title.trim().length >= 3 : query.trim().length >= 3;
  return (
    <section className={`${card} p-5 md:p-6`}>
      <SectionHead n="01" title="Report" hint="Signed in · human check passed" />
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-ground p-1" role="tablist">
        {[
          { v: "MANUAL" as const, label: "I'll report it", icon: "pen" as IconName },
          { v: "DISCOVER" as const, label: "Let the agent search", icon: "search" as IconName },
        ].map((o) => (
          <button
            key={o.v}
            role="tab"
            aria-selected={branch === o.v}
            onClick={() => setBranch(o.v)}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${branch === o.v ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink"}`}
          >
            <Icon name={o.icon} size={15} /> {o.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {isManual ? (
          <>
            <label className="block text-sm font-medium">
              What happened, in a few words
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${input} mt-1.5`} />
            </label>
            <label className="block text-sm font-medium">
              Anything else you want the agent to know <span className="font-normal text-muted">(never what the images show)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${input} mt-1.5 resize-y`} />
            </label>
          </>
        ) : (
          <>
            <label className="block text-sm font-medium">
              What should the agent search for?
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. a username, a fake profile name, a site" className={`${input} mt-1.5`} />
            </label>
            <label className="block text-sm font-medium">
              A link you already know about <span className="font-normal text-muted">(optional)</span>
              <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="https://" className={`${input} mt-1.5 font-mono text-sm`} />
            </label>
          </>
        )}
      </div>

      <button
        disabled={!canSubmit || !!busy}
        onClick={() =>
          run(isManual ? "report" : "discover", async () =>
            isManual ? (await incidentApi.createReport(title, notes)).case : (await incidentApi.discover(query, seed.trim() ? [seed.trim()] : [])).case,
          )
        }
        className={`${btnPrimary} mt-5 w-full sm:w-auto`}
      >
        {busy === "report" || busy === "discover" ? (
          <>
            <Icon name="refresh" size={16} className="animate-spin" /> {isManual ? "Creating…" : "Searching…"}
          </>
        ) : (
          <>
            {isManual ? "Create report" : "Start discovery"} <Icon name="arrow" size={16} />
          </>
        )}
      </button>
    </section>
  );
}

const VERDICT: Record<ProvenanceVerdict, { label: string; cls: string; icon: IconName }> = {
  ai_generated: { label: "AI-generated", cls: "bg-overdue-soft text-overdue", icon: "sparkle" },
  likely_ai: { label: "Likely AI", cls: "bg-overdue-soft text-overdue", icon: "sparkle" },
  inconclusive: { label: "Inconclusive", cls: "bg-ground text-muted border border-line", icon: "info" },
  no_signal: { label: "No AI signal", cls: "bg-removed-soft text-removed", icon: "check" },
};

function VerdictPill({ v }: { v: ProvenanceVerdict }) {
  const s = VERDICT[v];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <Icon name={s.icon} size={13} strokeWidth={2.25} /> {s.label}
    </span>
  );
}

function EvidenceCard({ c, busy, run, fileRef }: { c: CaseReport | null; busy: string | null; run: Run; fileRef: React.RefObject<HTMLInputElement | null> }) {
  const [files, setFiles] = useState<File[]>([]);
  const disabled = !c || c.status === "SEALED";
  return (
    <section className={`${card} p-5 md:p-6 ${!c ? "opacity-60" : ""}`}>
      <SectionHead n="02" title="Evidence & provenance" hint="Google SynthID · C2PA Content Credentials" />
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Files are checked in memory and discarded. Reclaim keeps a SHA-256 fingerprint and the result — never the file.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className={`${btnSecondary} h-12 flex-1 cursor-pointer justify-start ${disabled ? "pointer-events-none opacity-40" : ""}`}>
          <Icon name="plus" size={16} />
          {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose images, video or audio"}
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*" disabled={disabled} className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 10))} />
        </label>
        <button
          disabled={disabled || files.length === 0 || !!busy}
          onClick={() =>
            run("scan", async () => {
              const r = await incidentApi.scan(c!.id, files);
              setFiles([]);
              if (fileRef.current) fileRef.current.value = "";
              return r.case;
            })
          }
          className={btnPrimary}
        >
          {busy === "scan" ? (
            <>
              <Icon name="refresh" size={16} className="animate-spin" /> Checking…
            </>
          ) : (
            <>
              <Icon name="shield-check" size={16} /> Check provenance
            </>
          )}
        </button>
      </div>

      {c && c.verifications.length > 0 && (
        <ul className="mt-5 divide-y divide-line">
          {c.verifications.map((v) => (
            <VerificationRow key={v.id} v={v} asset={c.assets.find((a) => a.id === v.assetId)} />
          ))}
        </ul>
      )}
      {c?.scrape && c.scrape.sources.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wider text-muted">Sources the agent found</p>
          <ul className="mt-2 space-y-1">
            {c.scrape.sources.slice(0, 6).map((s) => (
              <li key={s.url} className="truncate font-mono text-xs text-muted" title={s.url}>
                {s.title} · {s.url.replace(/^https?:\/\/(www\.)?/, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {c?.scrape && c.scrape.sources.length === 0 && (
        <p className="mt-4 text-sm text-muted">No search provider configured — the scraper ran but found nothing. Upload the media above instead.</p>
      )}
    </section>
  );
}

function VerificationRow({ v, asset }: { v: VerificationResult; asset?: CaseReport["assets"][number] }) {
  return (
    <li className="flex flex-col gap-2 py-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <p className="text-sm">{v.summary}</p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {asset?.kind ?? "media"} · {asset?.mimeType} · {asset ? `${(asset.bytes / 1024).toFixed(1)} KB` : ""} · sha256 {asset?.sha256.slice(0, 12)}…
        </p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <span className="font-medium text-ink">SynthID</span>{" "}
            {v.synthId.source === "stub" ? "detector not configured" : `${v.synthId.isGoogleAiGenerated ? "watermark found" : "no watermark"} · ${Math.round(v.synthId.synthIdConfidence * 100)}%`}
          </span>
          <span>
            <span className="font-medium text-ink">C2PA</span>{" "}
            {v.c2pa.present ? `${v.c2pa.c2paIssuer ?? "unknown issuer"}${v.c2pa.claimGenerator ? ` · ${v.c2pa.claimGenerator}` : ""}` : "no manifest"}
          </span>
        </p>
      </div>
      <span className="self-start">
        <VerdictPill v={v.verdict} />
      </span>
    </li>
  );
}

const RISK: Record<RiskLevel, string> = {
  low: "bg-removed-soft text-removed",
  medium: "bg-accent-soft text-accent",
  high: "bg-overdue-soft text-overdue",
  critical: "bg-overdue text-white",
};

const ACTION_ICON: Record<AgentAction["type"], IconName> = {
  add_evidence: "plus",
  call_helpline: "heart",
  notify_friends_family: "send",
  report_police: "flag",
  report_parasell: "external",
};

function ActionsCard({ c, busy, run, onAddEvidence }: { c: CaseReport | null; busy: string | null; run: Run; onAddEvidence: () => void }) {
  const [dispatch, setDispatch] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ready = !!c && (c.verifications.length > 0 || !!c.scrape);
  const s = c?.suggestions;
  const escalation = c?.escalations[0];

  return (
    <section className={`${card} p-5 md:p-6 ${!ready ? "opacity-60" : ""}`}>
      <SectionHead n="03" title="What to do next" hint={s ? `${s.source === "gemini" ? s.model : "rule-based"} · ${s.iterations} context round${s.iterations === 1 ? "" : "s"}` : "Gemini"} />
      {!s ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">Gemini reads your notes, the web context and the provenance results, then suggests grounded next steps.</p>
          <button disabled={!ready || !!busy} onClick={() => run("analyze", async () => (await incidentApi.analyze(c!.id)).case)} className={`${btnPrimary} mt-4`}>
            {busy === "analyze" ? (
              <>
                <Icon name="refresh" size={16} className="animate-spin" /> Thinking…
              </>
            ) : (
              <>
                <Icon name="sparkle" size={16} /> Ask Gemini
              </>
            )}
          </button>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${RISK[s.riskLevel]}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {s.riskLevel} risk
            </span>
            <span className="text-xs text-muted">{s.aiGenerationAssessment}</span>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed">{s.summary}</p>
          <ul className="mt-4 divide-y divide-line">
            {s.actions.map((a, i) => (
              <li key={i} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${a.priority === "now" ? "bg-overdue-soft text-overdue" : "bg-accent-soft text-accent"}`}>
                    <Icon name={ACTION_ICON[a.type]} size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {a.title}
                      <span className={`ml-2 font-mono text-[10px] uppercase tracking-wider ${a.priority === "now" ? "text-overdue" : "text-muted"}`}>{a.priority}</span>
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">{a.rationale}</p>
                  </div>
                </div>
                <ActionButton a={a} c={c!} busy={busy} run={run} escalation={escalation} onAddEvidence={onAddEvidence} onDispatch={setDispatch} />
              </li>
            ))}
            {!s.actions.some((a) => a.type === "report_parasell") && (
              <li className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
                    <Icon name="external" size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">
                      Official escalation <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted">optional</span>
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">File the verified case with Parasell — hashes and verdicts only, never the media.</p>
                  </div>
                </div>
                <ActionButton a={{ type: "report_parasell", priority: "optional", title: "", rationale: "" }} c={c!} busy={busy} run={run} escalation={escalation} onAddEvidence={onAddEvidence} onDispatch={setDispatch} />
              </li>
            )}
          </ul>
        </>
      )}
      {dispatch && (
        <Modal
          title="Report to police"
          onClose={() => setDispatch(null)}
          footer={
            <button
              onClick={() => navigator.clipboard.writeText(dispatch).then(() => setCopied(true))}
              className={btnSecondary}
            >
              <Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "Copied" : "Copy summary"}
            </button>
          }
        >
          <p className="text-sm text-muted">A dispatch-format summary you can read out or paste into an online report. It never describes the imagery.</p>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-ground p-4 font-mono text-xs leading-relaxed">{dispatch}</pre>
        </Modal>
      )}
    </section>
  );
}

function ActionButton({ a, c, busy, run, escalation, onAddEvidence, onDispatch }: { a: AgentAction; c: CaseReport; busy: string | null; run: Run; escalation?: CaseReport["escalations"][number]; onAddEvidence: () => void; onDispatch: (s: string) => void }) {
  const cls = `${btnSecondary} shrink-0`;
  switch (a.type) {
    case "add_evidence":
      return (
        <button onClick={onAddEvidence} className={cls}>
          <Icon name="plus" size={15} /> Add files
        </button>
      );
    case "call_helpline": {
      const n = a.payload?.helplineNumber ?? "844-878-2274";
      return (
        <a href={`tel:${n.replace(/[^\d+]/g, "")}`} className={cls}>
          <Icon name="heart" size={15} /> Call {n}
        </a>
      );
    }
    case "notify_friends_family":
      return (
        <a href={`sms:?&body=${encodeURIComponent(a.payload?.smsText ?? "I'm dealing with something hard online right now and could use some support.")}`} className={cls}>
          <Icon name="send" size={15} /> Send a text
        </a>
      );
    case "report_police":
      return (
        <button onClick={() => onDispatch(a.payload?.dispatchSummary ?? "WHAT / WHEN / WHERE / EVIDENCE")} className={cls}>
          <Icon name="flag" size={15} /> Prepare report
        </button>
      );
    case "report_parasell":
      if (escalation && (escalation.status === "accepted" || escalation.status === "submitted")) {
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-removed-soft px-3 py-1.5 text-xs font-semibold text-removed">
            <Icon name="check" size={13} strokeWidth={2.25} /> Sent · {escalation.externalId}
          </span>
        );
      }
      return (
        <button disabled={!!busy} onClick={() => run("parasell", async () => (await incidentApi.parasell(c.id)).case)} className={`${btnPrimary} h-10 shrink-0 px-4 text-sm`}>
          {busy === "parasell" ? <Icon name="refresh" size={15} className="animate-spin" /> : <Icon name="external" size={15} />} Send to Parasell
        </button>
      );
  }
}

function SealCard({ c, busy, run }: { c: CaseReport | null; busy: string | null; run: Run }) {
  const ready = !!c && (c.verifications.length > 0 || !!c.scrape);
  const sealed = c?.status === "SEALED";
  return (
    <section className={`${card} p-5 md:p-6 ${!ready ? "opacity-60" : ""} ${sealed ? "border-removed/40" : ""}`}>
      <SectionHead n="04" title="Seal the record" hint="Replace with original" />
      {sealed ? (
        <div className="mt-3">
          <p className="flex items-center gap-2 text-sm font-medium text-removed">
            <Icon name="lock" size={16} /> Verified record sealed {c!.sealedAt && `at ${clockTime(c!.sealedAt)}`}
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-muted">sha256 {c!.recordHash}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">Overwrites the working draft with the verified record and fingerprints it, so any later change is detectable.</p>
          <button disabled={!ready || !!busy} onClick={() => run("seal", async () => (await incidentApi.seal(c!.id)).case)} className={`${btnSecondary} mt-4 h-12 px-5 text-[15px]`}>
            {busy === "seal" ? <Icon name="refresh" size={16} className="animate-spin" /> : <Icon name="lock" size={16} />} Replace with original
          </button>
        </>
      )}
    </section>
  );
}

const STATUS_DOT: Record<CaseStatus, string> = {
  DRAFT: "bg-panel-muted",
  SCANNING: "bg-[#8E9BE0]",
  ANALYZED: "bg-[#8E9BE0]",
  ESCALATED: "bg-[#F3C77A]",
  SEALED: "bg-[#6FC39D]",
  CLOSED: "bg-[#6FC39D]",
};

function StatusPanel({ rows, events, live, demo, activeId }: { rows: StatusRow[]; events: StatusEvent[]; live: boolean; demo: boolean; activeId?: string }) {
  return (
    <aside className="h-fit space-y-6 rounded-2xl bg-panel p-6 text-white xl:sticky xl:top-24">
      <div>
        <p className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-panel-muted">
          <span className="flex items-center gap-2">
            <Icon name="eye" size={14} /> Reports + Status
          </span>
          <span className="flex items-center gap-1.5 normal-case tracking-normal">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[#6FC39D]" : "bg-panel-muted"}`} /> {live ? "live" : "connecting"}
          </span>
        </p>
        <p className="mt-3 font-display text-2xl font-semibold leading-snug">{rows.length ? `${rows.length} report${rows.length === 1 ? "" : "s"} on file.` : "Nothing filed yet."}</p>
        {demo && <p className="mt-1 text-sm text-panel-muted">Demo mode: sign-in and Parasell are simulated.</p>}
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-panel-line border-y border-panel-line">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id} className={`py-3 ${r.id === activeId ? "" : "opacity-70"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-panel-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[r.status]}`} /> {r.status}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-panel-muted">
                {r.branch}
                {r.riskLevel && ` · ${r.riskLevel} risk`}
                {r.escalation && ` · parasell ${r.escalation}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h2 className="border-b border-panel-line pb-3 text-sm font-medium">Activity</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-panel-muted">Events stream here the moment anything changes.</p>
        ) : (
          <ol className="mt-1">
            {events.slice(0, 8).map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-panel-line py-3 last:border-0">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[e.status]}`} />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{e.text}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-panel-muted">
                    {e.status} · {clockTime(e.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
