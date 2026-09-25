"use client";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Icon } from "@/components/Icon";
import { btnSecondary, card, ChannelTag, Eyebrow, Loading, PlatformMark, ProgressBar, StatusPill } from "@/components/ui";
import { counts, displayStatus, linksFor, type DisplayStatus } from "@/lib/caseOps";
import { DEADLINE_HOURS, HOUR_MS } from "@/lib/config";
import { clockTime, hoursMinutes, shortDateTime } from "@/lib/time";
import { useCase } from "@/lib/useCase";
import { useNow } from "@/lib/useNow";
import type { Case, TakedownRequest } from "@/lib/types";

export default function Tracker() {
  const c = useCase();
  const now = useNow();
  if (c === undefined || !now) return <Loading />;
  if (!c) return <p className="text-muted">No active case.</p>;
  return <TrackerView c={c} now={now} />;
}

function TrackerView({ c, now }: { c: Case; now: number }) {
  const t = counts(c, now);
  const overdue = c.requests.filter((r) => displayStatus(r, now) === "overdue");
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

      {nothingSent && (
        <div className={`${card} mt-6 flex flex-col items-start gap-3 p-5 md:flex-row md:items-center md:justify-between`}>
          <p className="text-muted">Nothing has been sent yet — clocks start when requests go out.</p>
          <Link href="/case/requests" className={btnSecondary}>
            Review requests <Icon name="arrow" size={15} />
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-5 md:grid-cols-2">
          {c.requests.map((r) => (
            <ClockCard key={r.id} r={r} c={c} now={now} />
          ))}
        </div>
        <SidePanel c={c} overdue={overdue} />
      </div>
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

function ClockCard({ r, c, now }: { r: TakedownRequest; c: Case; now: number }) {
  const status: DisplayStatus = displayStatus(r, now);
  const sent = r.sentAt ? new Date(r.sentAt).getTime() : 0;
  const elapsed = sent ? (now - sent) / (DEADLINE_HOURS * HOUR_MS) : 0;
  const links = linksFor(c, r);
  const isOverdue = status === "overdue";
  const isRemoved = status === "removed";

  const frame = isOverdue ? "border-2 border-overdue-line" : isRemoved ? "border border-removed/30" : "border border-line";
  return (
    <article className={`flex flex-col rounded-2xl bg-surface p-5 ${frame}`} aria-label={`${r.platformName}: ${status}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformMark name={r.platformName} />
          <div className="min-w-0">
            <h2 className="font-medium">
              {r.platformName}
              {r.kind === "refile" && <span className="ml-2 text-xs font-normal text-muted">Re-upload</span>}
            </h2>
            <p className="truncate font-mono text-[11px] text-muted">{links.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, "")).join(", ")}</p>
          </div>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="mt-6">
        {isRemoved ? (
          <>
            <p className="text-xs uppercase tracking-wider text-removed">Taken down</p>
            <p className="mt-1 font-display text-[32px] font-semibold leading-tight text-removed">
              Removed in {hoursMinutes(new Date(r.removedAt!).getTime() - sent)}
            </p>
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
        <ProgressBar value={isRemoved || isOverdue ? 1 : elapsed} tone={isRemoved ? "removed" : isOverdue ? "overdue" : "accent"} />
      </div>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {isRemoved
            ? `Removed ${shortDateTime(r.removedAt)} · re-checked every 3 days`
            : isOverdue
              ? `Deadline passed ${shortDateTime(r.deadlineAt)}`
              : r.sentAt
                ? `Sent ${shortDateTime(r.sentAt)} · due ${shortDateTime(r.deadlineAt)}`
                : "Clock starts when sent"}
        </span>
        <ChannelTag channel={r.channel} />
      </footer>
    </article>
  );
}

const DOT = { neutral: "bg-panel-muted", accent: "bg-[#8E9BE0]", removed: "bg-[#6FC39D]", overdue: "bg-[#F08A82]" } as const;

function SidePanel({ c, overdue }: { c: Case; overdue: TakedownRequest[] }) {
  const names = overdue.map((r) => r.platformName).join(" and ");
  return (
    <aside className="h-fit space-y-6 rounded-2xl bg-panel p-6 text-white">
      {overdue.length > 0 ? (
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F3A6A0]">
            <Icon name="flag" size={14} /> Escalation ready
          </p>
          <p className="mt-3 font-display text-2xl font-semibold leading-snug">
            {names} missed {overdue.length === 1 ? "its" : "their"} deadline. Your FTC complaint is drafted.
          </p>
          <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-medium text-ink hover:bg-white/90" title="Wired up in step 5">
            Review &amp; file complaint <Icon name="arrow" size={16} />
          </button>
        </div>
      ) : (
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-panel-muted">
            <Icon name="eye" size={14} /> Agent watching
          </p>
          <p className="mt-3 font-display text-2xl font-semibold leading-snug">You don’t have to check on this. We will.</p>
          <p className="mt-2 text-sm text-panel-muted">Next re-check {shortDateTime(c.nextRecheckAt)}. You’ll only hear from us when something changes.</p>
        </div>
      )}
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
    </aside>
  );
}
