"use client";
// Incident verification flow: report (manual or agent discovery) → provenance scan →
// Gemini suggestions → agent files reports through each channel, logging every step →
// seal. The dark panel is the live Reports + Status tab.
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useDemoMode } from "@/components/Providers";
import { btnGhost, btnPrimary, btnSecondary, card, Eyebrow, Modal } from "@/components/ui";
import { CHANNEL_ORDER, CHANNELS, REPORT_STATUS_LABEL } from "@/lib/incident/channels";
import { incidentApi, type StatusRow } from "@/lib/incident/client";
import type { AgentAction, CaseReport, CaseStatus, ImageMatch, MatchRisk, ProvenanceVerdict, ReportAction, ReportArtifact, ReportChannel, ReportStatus, Reporter, RiskLevel, SearchScope, StatusEvent, VerificationResult } from "@/lib/incident/types";
import { clockTime, shortDateTime } from "@/lib/time";

const STEPS = ["Report", "Verify", "Act", "File", "Seal"] as const;
const STEP_FOR: Record<CaseStatus, number> = { DRAFT: 1, SCANNING: 1, ANALYZED: 2, ESCALATED: 3, SEALED: 4, CLOSED: 4 };

type Run = (label: string, fn: () => Promise<CaseReport>) => Promise<void>;

export default function VerifyPage() {
  const demo = useDemoMode();
  const [c, setCase] = useState<CaseReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [live, setLive] = useState(false);
  const [artifact, setArtifact] = useState<ReportArtifact | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshRows = useCallback(() => incidentApi.status().then((r) => setRows(r.cases)).catch(() => {}), []);

  useEffect(() => {
    refreshRows();
    const off = incidentApi.subscribe((evt) => {
      setEvents((prev) => [evt, ...prev].slice(0, 40));
      setLive(true);
      refreshRows();
    });
    return off;
  }, [refreshRows]);

  const run: Run = async (label, fn) => {
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

  const fileChannel = (channel: ReportChannel, url?: string, thenShow = false) =>
    run(`file:${channel}`, async () => {
      const r = await incidentApi.file(c!.id, channel, url);
      if (thenShow && r.report.artifact) setArtifact(r.report.artifact);
      return r.case;
    });

  const step = c ? STEP_FOR[c.status] : 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 md:px-12 md:pt-10">
      <Eyebrow>Incident verification · SynthID + C2PA + Gemini</Eyebrow>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">Verify it. Then act on it.</h1>
      <p className="mt-3 max-w-[62ch] text-muted">
        Report it yourself or let the agent go looking. Reclaim checks the media for AI watermarks and Content Credentials, asks Gemini what to do next, files the reports, and keeps a timestamped record of every step.
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
          <EvidenceCard c={c} busy={busy} run={run} fileRef={fileRef} onFile={fileChannel} />
          <ActionsCard c={c} busy={busy} run={run} onAddEvidence={() => fileRef.current?.click()} onFile={fileChannel} />
          <FileCard c={c} busy={busy} onFile={fileChannel} onShow={setArtifact} />
          <SealCard c={c} busy={busy} run={run} />
        </div>
        <StatusPanel rows={rows} events={events} live={live} demo={demo} activeId={c?.id} />
      </div>

      {artifact && <ArtifactModal a={artifact} onClose={() => setArtifact(null)} />}
    </div>
  );
}

function SectionHead({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <header className="flex items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <span className="font-mono text-xs text-accent">{n}</span> {title}
      </h2>
      {hint && <span className="text-right text-xs text-muted">{hint}</span>}
    </header>
  );
}

const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-accent disabled:opacity-60";
const spin = <Icon name="refresh" size={16} className="animate-spin" />;
const stamp = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

// ---------- 01 Report ----------

function ReportCard({ c, busy, run, onReset }: { c: CaseReport | null; busy: string | null; run: Run; onReset: () => void }) {
  const [branch, setBranch] = useState<CaseReport["branch"]>("MANUAL");
  const [title, setTitle] = useState("Someone posted my photos");
  const [notes, setNotes] = useState("My ex keeps posting them and says he wants money. I'm scared and can't sleep.");
  const [query, setQuery] = useState("");
  const [seed, setSeed] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [scope, setScope] = useState<SearchScope>("instagram");
  const [reporter, setReporter] = useState<Reporter>({ legalName: "Jane Doe", contactEmail: "jane.doe@example.com", signature: "Jane Doe" });

  if (c) {
    const shady = c.imageSearch?.matches.filter((m) => m.risk === "shady").length ?? 0;
    return (
      <section className={`${card} p-5 md:p-6`}>
        <SectionHead n="01" title={c.branch === "DISCOVER" ? "Agent discovery" : c.branch === "IMAGE_SEARCH" ? "Image search" : "Your report"} hint={c.id} />
        <p className="mt-3 font-medium">{c.title}</p>
        {c.notes && <p className="mt-1 text-sm leading-relaxed text-muted">{c.notes}</p>}
        {c.reporter && (
          <p className="mt-2 font-mono text-[11px] text-muted">
            Notices go out under {c.reporter.legalName} · {c.reporter.contactEmail} · signed “{c.reporter.signature}”
          </p>
        )}
        {c.imageSearch && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Icon name="eye" size={15} className="text-accent" />
            Found on {c.imageSearch.matches.length} {c.imageSearch.scope === "instagram" ? "Instagram post" : "page"}{c.imageSearch.matches.length === 1 ? "" : "s"}
            {c.imageSearch.scope === "instagram" ? <span className="font-medium text-overdue">· all flagged for you</span> : shady > 0 && <span className="font-medium text-overdue">· {shady} shady</span>}
          </p>
        )}
        {c.scrape && !c.imageSearch && (
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
  const primaryOk = branch === "MANUAL" ? title.trim().length >= 3 : branch === "DISCOVER" ? query.trim().length >= 3 : !!image;
  const canSubmit = primaryOk && reporter.legalName.trim().length >= 2 && /\S+@\S+\.\S+/.test(reporter.contactEmail) && reporter.signature.trim().length >= 2;
  const field = (k: keyof Reporter) => ({ value: reporter[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReporter({ ...reporter, [k]: e.target.value }) });
  const submitLabel = branch === "MANUAL" ? "Create report" : branch === "DISCOVER" ? "Start discovery" : "Search the web";
  const busyLabel = branch === "MANUAL" ? "Creating…" : branch === "DISCOVER" ? "Searching…" : "Searching the web…";

  return (
    <section className={`${card} p-5 md:p-6`}>
      <SectionHead n="01" title="Report" hint="Signed in · human check passed" />
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-ground p-1" role="tablist">
        {[
          { v: "MANUAL" as const, label: "I'll report it", icon: "pen" as IconName },
          { v: "DISCOVER" as const, label: "Agent searches", icon: "search" as IconName },
          { v: "IMAGE_SEARCH" as const, label: "Find my image", icon: "eye" as IconName },
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
        ) : branch === "IMAGE_SEARCH" ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              Upload the image once. Reclaim checks it for AI provenance, then finds every {scope === "instagram" ? "Instagram post" : "page on the web"} using it and flags them for you. The file is sent to the search provider for matching and never stored by Reclaim.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-ground p-1" role="tablist" aria-label="Where to search">
              {[
                { v: "instagram" as const, label: "Instagram" },
                { v: "web" as const, label: "Whole web" },
              ].map((o) => (
                <button key={o.v} role="tab" aria-selected={scope === o.v} onClick={() => setScope(o.v)} className={`h-9 rounded-lg text-sm font-medium transition-colors ${scope === o.v ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <label className={`${btnSecondary} h-12 w-full cursor-pointer justify-start`}>
              <Icon name="plus" size={16} />
              {image ? image.name : "Choose the image"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
            </label>
            <label className="block text-sm font-medium">
              Anything the agent should know <span className="font-normal text-muted">(optional — never what the image shows)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${input} mt-1.5 resize-y`} />
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

      <div className="mt-5 rounded-xl border border-line bg-ground/60 p-4">
        <p className="text-sm font-medium">For the notices the agent sends</p>
        <p className="mt-0.5 text-xs text-muted">A valid TAKE IT DOWN request must carry your name, a contact email and your signature.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-muted">
            Name
            <input {...field("legalName")} className={`${input} mt-1 text-sm`} />
          </label>
          <label className="block text-xs font-medium text-muted">
            Contact email
            <input {...field("contactEmail")} type="email" className={`${input} mt-1 text-sm`} />
          </label>
          <label className="block text-xs font-medium text-muted">
            Type your name to sign
            <input {...field("signature")} className={`${input} mt-1 font-display text-sm italic`} />
          </label>
        </div>
      </div>

      <button
        disabled={!canSubmit || !!busy}
        onClick={() =>
          run("report", async () => {
            if (branch === "MANUAL") return (await incidentApi.createReport(title, notes, reporter)).case;
            if (branch === "DISCOVER") return (await incidentApi.discover(query, seed.trim() ? [seed.trim()] : [], reporter)).case;
            return (await incidentApi.search({ file: image!, scope, title: scope === "instagram" ? "Where is my image on Instagram?" : "Where is my image?", notes, reporter })).case;
          })
        }
        className={`${btnPrimary} mt-5 w-full sm:w-auto`}
      >
        {busy === "report" ? (
          <>
            {spin} {busyLabel}
          </>
        ) : (
          <>
            {submitLabel} <Icon name="arrow" size={16} />
          </>
        )}
      </button>
    </section>
  );
}

// ---------- 02 Evidence ----------

const VERDICT: Record<ProvenanceVerdict, { label: string; cls: string; icon: IconName }> = {
  ai_generated: { label: "AI-generated", cls: "bg-overdue-soft text-overdue", icon: "sparkle" },
  likely_ai: { label: "Likely AI", cls: "bg-overdue-soft text-overdue", icon: "sparkle" },
  inconclusive: { label: "Inconclusive", cls: "bg-ground text-muted border border-line", icon: "info" },
  no_signal: { label: "No AI signal", cls: "bg-removed-soft text-removed", icon: "check" },
};

function Pill({ label, cls, icon }: { label: string; cls: string; icon?: IconName }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {icon ? <Icon name={icon} size={13} strokeWidth={2.25} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />} {label}
    </span>
  );
}

function EvidenceCard({ c, busy, run, fileRef, onFile }: { c: CaseReport | null; busy: string | null; run: Run; fileRef: React.RefObject<HTMLInputElement | null>; onFile: (ch: ReportChannel, url?: string) => Promise<void> }) {
  const [files, setFiles] = useState<File[]>([]);
  const disabled = !c || c.status === "SEALED";
  return (
    <section className={`${card} p-5 md:p-6 ${!c ? "opacity-60" : ""}`}>
      <SectionHead n="02" title="Evidence & provenance" hint="Google SynthID · C2PA Content Credentials" />
      <p className="mt-2 text-sm leading-relaxed text-muted">Files are checked in memory and discarded. Reclaim keeps a SHA-256 fingerprint and the result — never the file.</p>
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
          {busy === "scan" ? <>{spin} Checking…</> : <><Icon name="shield-check" size={16} /> Check provenance</>}
        </button>
      </div>

      {c && c.verifications.length > 0 && (
        <ul className="mt-5 divide-y divide-line">
          {c.verifications.map((v) => (
            <VerificationRow key={v.id} v={v} asset={c.assets.find((a) => a.id === v.assetId)} />
          ))}
        </ul>
      )}
      {c?.imageSearch && <MatchesList c={c} busy={busy} onFile={onFile} />}
      {c?.scrape && !c.imageSearch && c.scrape.sources.length > 0 && (
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
      {c?.scrape && !c.imageSearch && c.scrape.sources.length === 0 && <p className="mt-4 text-sm text-muted">No search provider configured — the scraper ran but found nothing. Upload the media above instead.</p>}
    </section>
  );
}

const RISK_PILL: Record<MatchRisk, { label: string; cls: string; icon: IconName }> = {
  shady: { label: "Shady site", cls: "bg-overdue-soft text-overdue", icon: "alert" },
  normal: { label: "Known platform", cls: "bg-removed-soft text-removed", icon: "check" },
  unknown: { label: "Unfamiliar", cls: "bg-ground text-muted border border-line", icon: "info" },
};

function matchPill(m: ImageMatch): { label: string; cls: string; icon: IconName } {
  if (!m.flagged) return RISK_PILL[m.risk];
  if (m.risk === "shady") return { label: m.platformName === "Instagram" ? "Flagged · leak or impersonation" : "Flagged · shady site", cls: "bg-overdue text-white", icon: "flag" };
  return { label: "Flagged", cls: "bg-overdue-soft text-overdue", icon: "flag" };
}

function MatchesList({ c, busy, onFile }: { c: CaseReport; busy: string | null; onFile: (ch: ReportChannel, url?: string) => Promise<void> }) {
  const s = c.imageSearch!;
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-muted">{s.scope === "instagram" ? "Instagram posts using your image" : "Where your image appears"}</p>
        <span className="text-xs text-muted">
          {s.provider === "vision" ? "Google Vision web detection" : "demo fixture"}
          {s.labels.length > 0 && ` · looks like: ${s.labels.join(", ")}`}
        </span>
      </div>
      {s.matches.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No copies found on {s.scope === "instagram" ? "Instagram" : "the web"} right now.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {s.matches.map((m) => {
            const filed = c.reports.find((r) => r.channel === "platform" && r.url === m.pageUrl && r.status !== "failed" && r.status !== "running");
            const p = matchPill(m);
            return (
              <li key={m.pageUrl} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <Pill label={p.label} cls={p.cls} icon={p.icon} />
                    {m.handle ? `@${m.handle}` : m.host}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{m.matchType} match</span>
                  </p>
                  {m.title && <p className="mt-0.5 truncate text-sm text-muted">{m.title}</p>}
                  <p className="mt-0.5 text-xs text-muted">{m.reasons.join(" · ")}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={m.pageUrl} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
                    <Icon name="external" size={15} /> Open
                  </a>
                  {filed ? (
                    <DonePill r={filed} />
                  ) : (
                    <button disabled={!!busy || c.status === "SEALED"} onClick={() => onFile("platform", m.pageUrl)} className={`${btnPrimary} h-10 px-4 text-sm`}>
                      {busy === "file:platform" ? spin : <Icon name="send" size={15} />} File takedown
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VerificationRow({ v, asset }: { v: VerificationResult; asset?: CaseReport["assets"][number] }) {
  const s = VERDICT[v.verdict];
  return (
    <li className="flex flex-col gap-2 py-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <p className="text-sm">{v.summary}</p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {asset?.kind ?? "media"} · {asset?.mimeType} · {asset ? `${(asset.bytes / 1024).toFixed(1)} KB` : ""} · sha256 {asset?.sha256.slice(0, 12)}…
        </p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <span className="font-medium text-ink">SynthID</span> {v.synthId.source === "stub" ? "detector not configured" : `${v.synthId.isGoogleAiGenerated ? "watermark found" : "no watermark"} · ${Math.round(v.synthId.synthIdConfidence * 100)}%`}
          </span>
          <span>
            <span className="font-medium text-ink">C2PA</span> {v.c2pa.present ? `${v.c2pa.c2paIssuer ?? "unknown issuer"}${v.c2pa.claimGenerator ? ` · ${v.c2pa.claimGenerator}` : ""}` : "no manifest"}
          </span>
        </p>
      </div>
      <span className="self-start">
        <Pill label={s.label} cls={s.cls} icon={s.icon} />
      </span>
    </li>
  );
}

// ---------- 03 Gemini actions ----------

const RISK: Record<RiskLevel, string> = { low: "bg-removed-soft text-removed", medium: "bg-accent-soft text-accent", high: "bg-overdue-soft text-overdue", critical: "bg-overdue text-white" };
const ACTION_ICON: Record<AgentAction["type"], IconName> = { add_evidence: "plus", call_helpline: "heart", notify_friends_family: "send", report_police: "flag", report_parasell: "external" };

function ActionsCard({ c, busy, run, onAddEvidence, onFile }: { c: CaseReport | null; busy: string | null; run: Run; onAddEvidence: () => void; onFile: (ch: ReportChannel, url?: string, show?: boolean) => Promise<void> }) {
  const ready = !!c && (c.verifications.length > 0 || !!c.scrape);
  const s = c?.suggestions;
  return (
    <section className={`${card} p-5 md:p-6 ${!ready ? "opacity-60" : ""}`}>
      <SectionHead n="03" title="What to do next" hint={s ? `${s.source === "gemini" ? s.model : "rule-based"} · ${s.iterations} context round${s.iterations === 1 ? "" : "s"}` : "Gemini"} />
      {!s ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">Gemini reads your notes, the web context and the provenance results, then suggests grounded next steps.</p>
          <button disabled={!ready || !!busy} onClick={() => run("analyze", async () => (await incidentApi.analyze(c!.id)).case)} className={`${btnPrimary} mt-4`}>
            {busy === "analyze" ? <>{spin} Thinking…</> : <><Icon name="sparkle" size={16} /> Ask Gemini</>}
          </button>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill label={`${s.riskLevel} risk`} cls={RISK[s.riskLevel]} />
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
                <ActionButton a={a} c={c!} busy={busy} onAddEvidence={onAddEvidence} onFile={onFile} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ActionButton({ a, c, busy, onAddEvidence, onFile }: { a: AgentAction; c: CaseReport; busy: string | null; onAddEvidence: () => void; onFile: (ch: ReportChannel, url?: string, show?: boolean) => Promise<void> }) {
  const cls = `${btnSecondary} shrink-0`;
  const done = (ch: ReportChannel) => c.reports.find((r) => r.channel === ch && r.status !== "failed" && r.status !== "running");
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
      return done("police") ? <DonePill r={done("police")!} /> : (
        <button disabled={!!busy} onClick={() => onFile("police", undefined, true)} className={cls}>
          {busy === "file:police" ? spin : <Icon name="flag" size={15} />} Prepare report
        </button>
      );
    case "report_parasell":
      return done("parasell") ? <DonePill r={done("parasell")!} /> : (
        <button disabled={!!busy} onClick={() => onFile("parasell")} className={`${btnPrimary} h-10 shrink-0 px-4 text-sm`}>
          {busy === "file:parasell" ? spin : <Icon name="external" size={15} />} Send to Parasell
        </button>
      );
  }
}

function DonePill({ r }: { r: ReportAction }) {
  return <Pill label={`${REPORT_STATUS_LABEL[r.status]}${r.reference ? ` · ${r.reference}` : ""}`} cls="bg-removed-soft text-removed" icon="check" />;
}

// ---------- 04 File reports ----------

const REPORT_PILL: Record<ReportStatus, string> = {
  running: "bg-accent-soft text-accent",
  sent: "bg-removed-soft text-removed",
  simulated: "bg-removed-soft text-removed",
  handed_off: "bg-accent-soft text-accent",
  prepared: "bg-accent-soft text-accent",
  failed: "bg-overdue-soft text-overdue",
};
const CHANNEL_ICON: Record<ReportChannel, IconName> = { platform: "clock", stopncii: "shield-check", ftc: "flag", police: "alert", parasell: "external" };

function FileCard({ c, busy, onFile, onShow }: { c: CaseReport | null; busy: string | null; onFile: (ch: ReportChannel, url?: string) => Promise<void>; onShow: (a: ReportArtifact) => void }) {
  const ready = !!c && c.status !== "SEALED" && (c.verifications.length > 0 || !!c.scrape);
  const [edited, setEdited] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const url = edited ?? c?.imageSearch?.matches[0]?.pageUrl ?? "https://imgvault.example/u/jane/3021";
  const filed = c?.reports.filter((r) => r.status !== "failed").length ?? 0;
  return (
    <section className={`${card} p-5 md:p-6 ${!ready && c?.status !== "SEALED" ? "opacity-60" : ""}`}>
      <SectionHead n="04" title="File the reports" hint={filed ? `${filed} filed` : "The agent does the filing"} />
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Pick any channel. The agent resolves the destination, drafts what’s needed, sends it where an API or email exists, and hands off with everything filled in where it doesn’t. Every step is logged with a timestamp.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {CHANNEL_ORDER.map((ch) => {
          const meta = CHANNELS[ch];
          const reports = c?.reports.filter((r) => r.channel === ch) ?? [];
          const latest = reports[0];
          const isBusy = busy === `file:${ch}`;
          const isOpen = open === ch;
          return (
            <li key={ch} className="py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
                    <Icon name={CHANNEL_ICON[ch]} size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {meta.label}
                      {latest && <Pill label={REPORT_STATUS_LABEL[latest.status]} cls={REPORT_PILL[latest.status]} />}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">{meta.description}</p>
                    {meta.needsUrl && !latest && (
                      <input value={url} onChange={(e) => setEdited(e.target.value)} placeholder="https://… link to the content" disabled={!ready} className={`${input} mt-2 max-w-md font-mono text-xs`} />
                    )}
                    {latest?.deadlineAt && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-overdue">
                        <Icon name="clock" size={13} /> 48-hour deadline {shortDateTime(latest.deadlineAt)}
                      </p>
                    )}
                    {latest && latest.steps.length > 0 && (
                      <button onClick={() => setOpen(isOpen ? null : ch)} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                        <Icon name={isOpen ? "x" : "eye"} size={13} /> {isOpen ? "Hide steps" : `${latest.steps.length} steps · last ${stamp(latest.steps[latest.steps.length - 1].at)}`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                  {latest?.artifact && (
                    <button onClick={() => onShow(latest.artifact!)} className={btnSecondary}>
                      <Icon name="form" size={15} /> View
                    </button>
                  )}
                  {latest && (latest.status === "handed_off" || latest.status === "prepared") && /^https?:/.test(latest.destination) && (
                    <a href={latest.destination} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
                      <Icon name="external" size={15} /> Open
                    </a>
                  )}
                  {latest?.artifact?.mailto && (
                    <a href={latest.artifact.mailto} className={btnSecondary}>
                      <Icon name="mail" size={15} /> Email
                    </a>
                  )}
                  <button
                    disabled={!ready || !!busy || (meta.needsUrl && !latest && !url.trim())}
                    onClick={() => onFile(ch, meta.needsUrl ? url.trim() : undefined)}
                    className={latest ? btnSecondary : `${btnPrimary} h-10 px-4 text-sm`}
                  >
                    {isBusy ? spin : <Icon name={latest ? "refresh" : "send"} size={15} />} {isBusy ? "Filing…" : latest ? "File again" : "File"}
                  </button>
                </div>
              </div>
              {isOpen && latest && (
                <ol className="mt-3 ml-12 border-l border-line pl-4">
                  {latest.steps.map((s, i) => (
                    <li key={i} className="relative py-1.5 text-sm leading-snug">
                      <span className="absolute -left-[21px] top-2.5 h-2 w-2 rounded-full bg-accent" />
                      <span className="mr-2 font-mono text-[11px] text-muted">{stamp(s.at)}</span>
                      {s.text}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ArtifactModal({ a, onClose }: { a: ReportArtifact; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = a.fields ? a.fields.map((f) => `${f.label}:\n${f.value}`).join("\n\n") : a.body;
  return (
    <Modal
      title={a.title}
      onClose={onClose}
      footer={
        <>
          {a.mailto && (
            <a href={a.mailto} className={btnSecondary}>
              <Icon name="mail" size={15} /> Open in mail
            </a>
          )}
          <button onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))} className={btnSecondary}>
            <Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "Copied" : "Copy"}
          </button>
        </>
      }
    >
      {a.fields ? (
        <dl className="space-y-3">
          {a.fields.map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">{f.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-ground p-3 font-mono text-xs leading-relaxed">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="whitespace-pre-wrap rounded-xl bg-ground p-4 font-mono text-xs leading-relaxed">{a.body}</pre>
      )}
    </Modal>
  );
}

// ---------- 05 Seal + record ----------

function SealCard({ c, busy, run }: { c: CaseReport | null; busy: string | null; run: Run }) {
  const ready = !!c && (c.verifications.length > 0 || !!c.scrape || c.reports.length > 0);
  const sealed = c?.status === "SEALED";
  const log = c
    ? [...c.reports.flatMap((r) => r.steps.map((s) => ({ at: s.at, who: CHANNELS[r.channel].label, text: s.text }))), ...c.events.map((e) => ({ at: e.at, who: "Case", text: e.text }))].sort((a, b) => a.at.localeCompare(b.at))
    : [];
  const [copied, setCopied] = useState(false);
  return (
    <section className={`${card} p-5 md:p-6 ${!ready ? "opacity-60" : ""} ${sealed ? "border-removed/40" : ""}`}>
      <SectionHead n="05" title="Record & seal" hint={log.length ? `${log.length} entries` : "Replace with original"} />
      {log.length > 0 && (
        <>
          <ol className="mt-4 max-h-72 overflow-y-auto border-l border-line pl-4">
            {log.map((e, i) => (
              <li key={i} className="relative py-1.5 text-sm leading-snug">
                <span className={`absolute -left-[21px] top-2.5 h-2 w-2 rounded-full ${e.who === "Case" ? "bg-line" : "bg-accent"}`} />
                <span className="mr-2 font-mono text-[11px] text-muted">{stamp(e.at)}</span>
                <span className="mr-1.5 text-xs font-medium text-muted">{e.who}</span>
                {e.text}
              </li>
            ))}
          </ol>
          <button
            onClick={() => navigator.clipboard.writeText(log.map((e) => `${e.at}\t${e.who}\t${e.text}`).join("\n")).then(() => setCopied(true))}
            className={`${btnGhost} mt-2 -ml-2`}
          >
            <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copied" : "Copy the record"}
          </button>
        </>
      )}
      {sealed ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="flex items-center gap-2 text-sm font-medium text-removed">
            <Icon name="lock" size={16} /> Verified record sealed {c!.sealedAt && `at ${clockTime(c!.sealedAt)}`}
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-muted">sha256 {c!.recordHash}</p>
        </div>
      ) : (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm leading-relaxed text-muted">Overwrites the working draft with the verified record — evidence, verdicts and every step above — and fingerprints it, so any later change is detectable.</p>
          <button disabled={!ready || !!busy} onClick={() => run("seal", async () => (await incidentApi.seal(c!.id)).case)} className={`${btnSecondary} mt-4 h-12 px-5 text-[15px]`}>
            {busy === "seal" ? spin : <Icon name="lock" size={16} />} Replace with original
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Status panel ----------

const STATUS_DOT: Record<CaseStatus, string> = { DRAFT: "bg-panel-muted", SCANNING: "bg-[#8E9BE0]", ANALYZED: "bg-[#8E9BE0]", ESCALATED: "bg-[#F3C77A]", SEALED: "bg-[#6FC39D]", CLOSED: "bg-[#6FC39D]" };

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
        {demo && <p className="mt-1 text-sm text-panel-muted">Demo mode: sign-in and sends are simulated.</p>}
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
            {events.slice(0, 10).map((e) => (
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
