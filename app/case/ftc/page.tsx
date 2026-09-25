"use client";
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { Icon } from "@/components/Icon";
import { CopyButton } from "@/components/Submission";
import { btnPrimary, btnSecondary, card, Eyebrow, Loading } from "@/components/ui";
import { linksFor } from "@/lib/caseOps";
import { FTC_REPORT_URL } from "@/lib/config";
import { ftcComplaintFor, ftcInput, markEscalated, needsEscalation, setOutboxAiText, timelineFacts } from "@/lib/escalation";
import { downloadEvidencePdf } from "@/lib/evidencePdf";
import { renderFtcComplaint } from "@/lib/templates";
import { shortDateTime } from "@/lib/time";
import { updateCase, useCase } from "@/lib/useCase";
import { useNow } from "@/lib/useNow";
import { useChase } from "@/lib/useChase";
import { Typewriter } from "@/components/Typewriter";
import { postJson } from "@/lib/api";
import { cachedFollowUp } from "@/lib/demoCache";
import { recordAi } from "@/lib/aiStatus";
import { useDemoMode } from "@/components/Providers";
import type { Case, TakedownRequest } from "@/lib/types";

export default function FtcPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Ftc />
    </Suspense>
  );
}

function Ftc() {
  const c = useCase();
  const now = useNow();
  const params = useSearchParams();
  useChase(c, now, useDemoMode());
  if (c === undefined || !now) return <Loading />;
  if (!c) return <p className="text-muted">No active case.</p>;
  const r =
    c.requests.find((x) => x.id === params.get("request")) ?? c.requests.find((x) => needsEscalation(x, now) || x.escalatedAt);
  if (!r?.sentAt) {
    return (
      <div className={`${card} p-6`}>
        <p className="text-muted">No platform has missed its deadline. Nothing to escalate yet.</p>
        <Link href="/case/tracker" className={`${btnSecondary} mt-4`}>Back to tracker</Link>
      </div>
    );
  }
  return <Complaint c={c} r={r} now={now} />;
}

/** Summaries that arrived while this page was open get typed out once. */
const justTyped = new Set<string>();

function Complaint({ c, r, now }: { c: Case; r: TakedownRequest; now: number }) {
  const demo = useDemoMode();
  const draft = ftcComplaintFor(c, r.id);
  const aiSummary = draft?.aiText;
  const complaint = renderFtcComplaint(ftcInput(c, r, now, aiSummary));
  const requested = useRef(false);
  const polishing = !!draft && draft.aiSource !== "gemini" && !draft.aiTried;

  // Gemini writes the summary paragraph from timeline facts only.
  useEffect(() => {
    if (!draft || draft.aiSource === "gemini" || draft.aiTried || requested.current) return;
    requested.current = true;
    postJson<{ text: string; source: "gemini" | "cached" | "template" }>("/api/followup", { kind: "ftc", facts: timelineFacts(c, r, now) }, 14000).then((out) => {
      // Server unreachable in demo: the recorded summary; otherwise keep the template text.
      const cached = demo ? cachedFollowUp("ftc", r.platformName) : undefined;
      const text = out?.text || cached || draft.aiText;
      const fromGemini = !!(out?.text || cached);
      recordAi("FTC summary", out?.source === "gemini" ? "live" : fromGemini ? "cached" : "template");
      justTyped.add(draft.id);
      updateCase((x) => {
        const next = setOutboxAiText(x, draft.id, text, undefined, fromGemini ? "gemini" : "template");
        return { ...next, outbox: next.outbox?.map((m) => (m.id === draft.id ? { ...m, aiTried: true } : m)) };
      });
    });
  }, [c, r, draft, now, demo]);

  const all = complaint.sections.map((s) => `${s.title}\n${s.text}`).join("\n\n");
  const filed = !!r.escalatedAt;

  return (
    <div>
      <Eyebrow>Escalation</Eyebrow>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-tight md:text-[44px]">File a complaint with the FTC.</h1>
      <p className="mt-2 max-w-[64ch] text-muted">
        {r.status === "rejected" ? `${r.platformName} refused a valid removal request.` : `${r.platformName} missed its 48-hour legal deadline.`} The Federal Trade Commission enforces the TAKE IT DOWN Act. Filing takes about ten minutes on the FTC’s website — everything you need is below. Filing is your choice; Reclaim never files for you.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {complaint.sections.map((s, i) => (
            <section key={s.title} className={`${card} p-5`}>
              <header className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 font-medium">
                  <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <CopyButton value={s.text} />
              </header>
              {i === 1 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <Icon name="sparkle" size={12} className={polishing ? "animate-pulse" : ""} />
                  {polishing ? "Gemini is drafting a summary from your evidence log…" : draft?.aiSource === "gemini" ? "Summary drafted by Gemini from your evidence log. Edit anything before filing." : "Summary from the template."}
                </p>
              )}
              {i === 1 ? (
                <div className="mt-3 space-y-4 text-[15px] leading-relaxed">
                  {polishing ? (
                    <div className="space-y-2 py-1" aria-label="Gemini is writing the summary">
                      <div className="anim-shimmer h-3.5 w-full rounded bg-line" />
                      <div className="anim-shimmer h-3.5 w-11/12 rounded bg-line" />
                      <div className="anim-shimmer h-3.5 w-3/5 rounded bg-line" />
                    </div>
                  ) : (
                    <p className="break-words">
                      <Typewriter text={complaint.summary} animate={!!draft && justTyped.has(draft.id)} />
                    </p>
                  )}
                  <p className="break-words text-muted">{s.text.slice(s.text.indexOf("This appears"))}</p>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed">{s.text}</p>
              )}
            </section>
          ))}
          <div className="flex flex-wrap gap-3">
            <CopyButton value={all} label="Copy everything" />
          </div>
        </div>

        <aside className="order-first h-fit space-y-5 rounded-2xl bg-panel p-6 text-white xl:order-none">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F3A6A0]">{r.status === "rejected" ? "Rejected" : "Past deadline"}</p>
            {r.status === "rejected" ? (
              <p className="mt-2 font-display text-2xl font-semibold">{shortDateTime(r.rejectedAt)}</p>
            ) : (
              <Countdown deadlineAt={r.deadlineAt!} className="mt-2 block text-[40px] font-medium leading-none text-[#F3A6A0]" />
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-panel-muted">Request sent</dt>
                <dd>{shortDateTime(r.sentAt)}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">Reminders</dt>
                <dd>{r.remindersDrafted.length || "None"}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">Links</dt>
                <dd>{linksFor(c, r).length}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">Evidence entries</dt>
                <dd>{c.evidence.filter((e) => r.linkIds.some((id) => c.links.find((l) => l.id === id)?.url === e.url)).length}</dd>
              </div>
            </dl>
          </div>
          <ol className="space-y-3 border-t border-panel-line pt-5 text-sm">
            <li className="flex gap-3"><span className="font-mono text-panel-muted">1</span>Open the FTC’s reporting site.</li>
            <li className="flex gap-3"><span className="font-mono text-panel-muted">2</span>Copy each section into the matching field.</li>
            <li className="flex gap-3"><span className="font-mono text-panel-muted">3</span>Attach your evidence PDF if asked.</li>
          </ol>
          <a href={FTC_REPORT_URL} target="_blank" rel="noopener noreferrer" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-medium text-ink hover:bg-white/90">
            Open FTC reporting site <Icon name="external" size={15} />
          </a>
          <button onClick={() => downloadEvidencePdf(c)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/25 text-sm font-medium hover:bg-white/10">
            <Icon name="download" size={16} /> Download evidence PDF
          </button>
          {filed ? (
            <p className="flex items-center gap-2 text-sm text-[#6FC39D]">
              <Icon name="check" size={16} /> Marked as filed {shortDateTime(r.escalatedAt)}
            </p>
          ) : (
            <button onClick={() => updateCase((x) => markEscalated(x, r.id, new Date().toISOString()))} className={`${btnPrimary} w-full`}>
              I’ve filed it
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
