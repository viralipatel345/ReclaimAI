"use client";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Icon } from "@/components/Icon";
import { btnSecondary, card, ChannelTag, Eyebrow, Loading, PlatformMark, ProgressBar, StatusPill } from "@/components/ui";
import { counts, displayStatus, linksFor, type DisplayStatus } from "@/lib/caseOps";
import { DEADLINE_HOURS, HOUR_MS } from "@/lib/config";
import { clockTime, hoursMinutes, shortDateTime } from "@/lib/time";
import { useCase } from "@/lib/useCase";
import { useChase } from "@/lib/useChase";
import { needsEscalation } from "@/lib/escalation";
import { prepareSubmission } from "@/lib/submission";
import { useDemoMode } from "@/components/Providers";
import { ReplyModal } from "@/components/ReplyModal";
import { NeedsYou } from "@/components/NeedsYou";
import { recheckNow } from "@/lib/recheckClient";
import { recheckIntervalDays } from "@/lib/recheckOps";
import { SubmissionPanel } from "@/components/Submission";
import { Modal } from "@/components/ui";
import { useState } from "react";
import type { OutboundMessage } from "@/lib/types";
import { downloadEvidencePdf } from "@/lib/evidencePdf";
import { useNow } from "@/lib/useNow";
import type { Case, TakedownRequest } from "@/lib/types";

export default function Tracker() {
  const c = useCase();
  const now = useNow();
  useChase(c, now, useDemoMode());
  if (c === undefined || !now) return <Loading />;
  if (!c) return <p className="text-muted">No active case.</p>;
  return <TrackerView c={c} now={now} />;
}

function TrackerView({ c, now }: { c: Case; now: number }) {
  const t = counts(c, now);
  const overdue = c.requests.filter((r) => needsEscalation(r, now));
  const [replyFor, setReplyFor] = useState<TakedownRequest | null>(null);
  const [openMsg, setOpenMsg] = useState<OutboundMessage | null>(null);
  const nothingSent = c.requests.every((r) => !r.sentAt);
  return (
    <div>
      <Eyebrow>Step 03</Eyebrow>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">Every platform is on the clock.</h1>
      <p className="mt-3 max-w-[62ch] text-muted">
        Reclaim chases each platform, re-checks every link every 3 days, and drafts your FTC complaint the moment anyone misses a deadline.
      </p>

      <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="Summary">
        <Chip tone="removed" n={t.removed} label="removed" />
        <Chip tone="accent" n={t.inProgress} label="in progress" />
        <Chip tone="overdue" n={t.overdue} label="overdue" />
      </ul>

      <NeedsYou c={c} demo={useDemoMode()} />

      {nothingSent && (
        <div className={`${card} mt-6 flex flex-col items-start gap-3 p-5 md:flex-row md:items-center md:justify-between`}>
          <p className="text-muted">Nothing has been sent yet — clocks start when requests go out.</p>
          <Link href="/case/requests" className={btnSecondary}>
            Review requests <Icon name="arrow" size={15} />
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 content-start gap-5 md:grid-cols-2">
          {c.requests.map((r) => (
            <ClockCard key={r.id} r={r} c={c} now={now} onReply={() => setReplyFor(r)} onOpenMessage={setOpenMsg} />
          ))}
        </div>
        <SidePanel c={c} overdue={overdue} />
      </div>
      {replyFor && <ReplyModal r={replyFor} onClose={() => setReplyFor(null)} />}
      {openMsg && (
        <Modal title={openMsg.subject} onClose={() => setOpenMsg(null)}>
          {(() => {
            const r = c.requests.find((x) => x.id === openMsg.requestId)!;
            return <SubmissionPanel s={prepareSubmission(c, { ...r, subject: openMsg.subject, body: openMsg.body })} />;
          })()}
        </Modal>
      )}
    </div>
  );
}

function Chip({ tone, n, label }: { tone: "removed" | "accent" | "overdue"; n: number; label: string }) {
  const cls = { removed: "bg-removed-soft text-removed", accent: "bg-accent-soft text-accent", overdue: "bg-overdue-soft text-overdue" }[tone];
  return (
    <li className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${cls}`}>
      <span className="tabular font-mono text-base font-semibold">{n}</span> {label}
    </li>
  );
}

function ClockCard({ r, c, now, onReply, onOpenMessage }: { r: TakedownRequest; c: Case; now: number; onReply: () => void; onOpenMessage: (m: OutboundMessage) => void }) {
  const pendingReminder = (c.outbox ?? []).find((m) => m.kind === "reminder" && m.requestId === r.id && !m.sentAt);
  const status: DisplayStatus = displayStatus(r, now);
  const sent = r.sentAt ? new Date(r.sentAt).getTime() : 0;
  const elapsed = sent ? (now - sent) / (DEADLINE_HOURS * HOUR_MS) : 0;
  const links = linksFor(c, r);
  const isOverdue = status === "overdue";
  const isRemoved = status === "removed";

  const frame = isOverdue || status === "rejected" ? "border-2 border-overdue-line" : isRemoved ? "border border-removed/30" : "border border-line";
  return (
    <article className={`flex flex-col rounded-2xl bg-surface p-5 ${frame}`} aria-label={`${r.platformName}: ${status}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformMark name={r.platformName} />
          <div className="min-w-0">
            <h2 className="font-medium">
              {r.platformName}
              {r.kind === "refile" && <span className="ml-2 rounded-md bg-overdue-soft px-1.5 py-0.5 text-[11px] font-medium text-overdue">Re-upload</span>}
            </h2>
            <p className="truncate font-mono text-[11px] text-muted">{links.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, "")).join(", ")}</p>
          </div>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="mt-6">
        {isRemoved ? (
          <>
            <p className="text-xs uppercase tracking-wider text-removed">Removed in</p>
            <p className="mt-1 font-display text-[44px] font-semibold leading-none tracking-tight text-removed">
              {hoursMinutes(new Date(r.removedAt!).getTime() - sent)}
            </p>
            {r.deadlineAt && new Date(r.removedAt!).getTime() > new Date(r.deadlineAt).getTime() && (
              <p className="mt-2 text-xs text-overdue">
                {hoursMinutes(new Date(r.removedAt!).getTime() - new Date(r.deadlineAt).getTime())} past the legal deadline
              </p>
            )}
          </>
        ) : status === "rejected" ? (
          <>
            <p className="text-xs uppercase tracking-wider text-overdue">Rejected</p>
            <p className="mt-1 font-display text-[32px] font-semibold leading-tight text-overdue">Escalate to the FTC</p>
          </>
        ) : r.deadlineAt ? (
          <>
            <p className={`text-xs uppercase tracking-wider ${isOverdue ? "text-overdue" : "text-muted"}`}>{isOverdue ? "Past deadline" : "Time left"}</p>
            <Countdown
              deadlineAt={r.deadlineAt}
              className={`mt-1 block text-[44px] font-medium leading-none tracking-tight ${isOverdue ? "text-overdue" : "text-ink"}`}
            />
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-muted">Not sent yet</p>
            <p className="mt-1 font-mono text-[44px] font-medium leading-none text-line">48:00:00</p>
          </>
        )}
      </div>

      <div className="mt-5">
        <ProgressBar value={isRemoved || isOverdue || status === "rejected" ? 1 : elapsed} tone={isRemoved ? "removed" : isOverdue || status === "rejected" ? "overdue" : "accent"} />
      </div>
      {r.remindersDrafted.length > 0 && !isRemoved && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="mail" size={13} /> Reminders sent at {r.remindersDrafted.map((h) => `${h}h`).join(" and ")}
        </p>
      )}
      {!r.parentRequestId && links[0]?.lastCheck && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="refresh" size={13} />
          Re-checked {shortDateTime(links[0].lastCheck.at)}:{" "}
          {links[0].lastCheck.status === "removed" ? (
            <span className="font-medium text-removed">still removed ✓</span>
          ) : links[0].lastCheck.status === "live" ? (
            <span className="font-medium text-overdue">{isRemoved ? "back up — re-filed" : "still up"}</span>
          ) : (
            <span className="font-medium">needs you</span>
          )}
        </p>
      )}
      {r.parentRequestId && (
        <p className="mt-3 text-xs text-muted">
          Cites your original request of {shortDateTime(c.requests.find((x) => x.id === r.parentRequestId)?.sentAt)}.
        </p>
      )}
      {r.reply && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          <span className="font-medium text-ink">Their reply:</span> {r.reply.summary}
        </p>
      )}
      {pendingReminder && (
        <button onClick={() => onOpenMessage(pendingReminder)} className="mt-3 flex items-center gap-1.5 text-left text-xs font-medium text-accent hover:underline">
          <Icon name="send" size={13} /> {pendingReminder.hourMark}-hour reminder ready — send it
        </button>
      )}
      {r.acknowledgedAt && !isRemoved && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="check" size={13} /> Acknowledged {shortDateTime(r.acknowledgedAt)}
        </p>
      )}
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted">
        <span>
          {isRemoved
            ? `Removed ${shortDateTime(r.removedAt)}`
            : isOverdue
              ? `Deadline passed ${shortDateTime(r.deadlineAt)}`
              : r.sentAt
                ? `Sent ${shortDateTime(r.sentAt)} · due ${shortDateTime(r.deadlineAt)}`
                : "Clock starts when sent"}
        </span>
        <span className="flex items-center gap-3">
          {r.sentAt && !isRemoved && r.status !== "rejected" && (
            <button onClick={onReply} className="font-medium text-accent hover:underline">
              Paste a reply
            </button>
          )}
          <ChannelTag channel={r.channel} />
        </span>
      </footer>
    </article>
  );
}

const DOT = { neutral: "bg-panel-muted", accent: "bg-[#8E9BE0]", removed: "bg-[#6FC39D]", overdue: "bg-[#F08A82]" } as const;

function RecheckStatus({ c }: { c: Case }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const anySent = c.requests.some((r) => r.sentAt);
  if (!anySent) return null;
  return (
    <div className="rounded-xl border border-panel-line p-4">
      <p className="text-sm">
        {c.lastRecheckAt ? `Last re-check ${shortDateTime(c.lastRecheckAt)}` : "Not re-checked yet"}
        <span className="text-panel-muted"> · next {shortDateTime(c.nextRecheckAt)}</span>
      </p>
      <p className="mt-1 text-xs text-panel-muted">Every {recheckIntervalDays(c)} days{recheckIntervalDays(c) === 7 ? " (30 clean days — slowed to weekly)" : ""}. Text only — images are never downloaded.</p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const out = await recheckNow(c);
          setBusy(false);
          setNote(out ? (out.changes ? `${out.changes} change${out.changes > 1 ? "s" : ""} found.` : `Checked ${out.checked} link${out.checked === 1 ? "" : "s"} — nothing changed.`) : "Couldn’t re-check right now.");
        }}
        className="mt-3 flex items-center gap-2 text-sm font-medium text-white hover:underline disabled:opacity-50"
      >
        <Icon name="refresh" size={14} className={busy ? "animate-spin" : ""} /> {busy ? "Re-checking…" : "Run re-check now"}
      </button>
      {note && <p className="mt-1 text-xs text-panel-muted">{note}</p>}
    </div>
  );
}

function SidePanel({ c, overdue }: { c: Case; overdue: TakedownRequest[] }) {
  const names = overdue.map((r) => r.platformName).join(" and ");
  const filed = c.requests.filter((r) => r.escalatedAt);
  return (
    <aside className="h-fit space-y-6 rounded-2xl bg-panel p-6 text-white">
      {overdue.length > 0 ? (
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F3A6A0]">
            <Icon name="flag" size={14} /> Escalation ready
          </p>
          <p className="mt-3 font-display text-2xl font-semibold leading-snug">
            {overdue.every((r) => r.status === "rejected")
              ? `${names} rejected your request. Your FTC complaint is drafted.`
              : `${names} missed ${overdue.length === 1 ? "its" : "their"} deadline. Your FTC complaint is drafted.`}
          </p>
          <Link
            href={`/case/ftc?request=${overdue[0].id}`}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-medium text-ink hover:bg-white/90"
          >
            Review &amp; file complaint <Icon name="arrow" size={16} />
          </Link>
        </div>
      ) : (
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-panel-muted">
            <Icon name="eye" size={14} /> Agent watching
          </p>
          <p className="mt-3 font-display text-2xl font-semibold leading-snug">
            {filed.length ? `FTC complaint filed about ${filed.map((r) => r.platformName).join(" and ")}.` : "You don’t have to check on this. We will."}
          </p>
          <p className="mt-2 text-sm text-panel-muted">You’ll only hear from us when something changes.</p>
        </div>
      )}
      <RecheckStatus c={c} />
      <div>
        <h2 className="border-b border-panel-line pb-3 text-sm font-medium">Activity</h2>
        <ol className="mt-1">
          {c.activity.slice(0, 7).map((a) => (
            <li key={a.id} className="flex gap-3 border-b border-panel-line py-3 last:border-0">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[a.tone]}`} />
              <div className="min-w-0">
                <p className="text-sm leading-snug">{a.text}</p>
                <p className="mt-0.5 font-mono text-[11px] text-panel-muted">
                  {clockTime(a.at)} · {new Date(a.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <button
        onClick={() => downloadEvidencePdf(c)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/25 text-sm font-medium hover:bg-white/10"
      >
        <Icon name="download" size={16} /> Download evidence PDF
      </button>
    </aside>
  );
}
