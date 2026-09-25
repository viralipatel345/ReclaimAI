"use client";
import { useEffect, useRef } from "react";
import type { DisplayStatus } from "@/lib/caseOps";
import type { Channel, ResolvedPlatform } from "@/lib/types";
import { Icon } from "./Icon";

export const btnPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent";
export const btnSecondary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-40";
export const btnGhost = "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft";
export const card = "rounded-2xl border border-line bg-surface";

export function PlatformMark({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
      className="grid shrink-0 place-items-center rounded-[10px] border border-line bg-ground font-display font-semibold text-ink"
    >
      {name.replace(/^the\s+/i, "").charAt(0).toUpperCase()}
    </span>
  );
}

export function ChannelTag({ channel }: { channel: Channel | null }) {
  if (!channel) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <Icon name={channel === "email" ? "mail" : "form"} size={14} />
      {channel === "email" ? "Email" : "Web form"}
    </span>
  );
}

export function PlatformPill({ platform, checking = false }: { platform: ResolvedPlatform; checking?: boolean }) {
  if (checking) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted">
        <Icon name="search" size={13} className="animate-pulse" />
        Finding the removal channel…
      </span>
    );
  }
  if (platform.source === "unresolved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-overdue-soft px-2.5 py-1 text-xs font-medium text-overdue">
        <Icon name="alert" size={13} />
        {platform.message}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
      <Icon name="check" size={13} strokeWidth={2.25} />
      {platform.name}
      {platform.fictional && <span className="font-normal opacity-70">· fictional</span>}
      {platform.source === "search" && <span className="font-normal opacity-70">· found via Google Search</span>}
    </span>
  );
}

const STATUS: Record<DisplayStatus, { label: string; cls: string }> = {
  draft: { label: "Needs you", cls: "bg-ground text-muted border border-line" },
  ready: { label: "Ready", cls: "bg-accent-soft text-accent" },
  in_progress: { label: "In progress", cls: "bg-accent-soft text-accent" },
  acknowledged: { label: "Acknowledged", cls: "bg-accent-soft text-accent" },
  removed: { label: "Removed", cls: "bg-removed-soft text-removed" },
  overdue: { label: "Overdue", cls: "bg-overdue-soft text-overdue" },
  rejected: { label: "Rejected", cls: "bg-overdue-soft text-overdue" },
  unclear: { label: "Needs you", cls: "bg-ground text-muted border border-line" },
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "removed" | "overdue" }) {
  const fill = { accent: "bg-accent", removed: "bg-removed", overdue: "bg-overdue-line" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${fill} transition-[width] duration-1000 ease-linear`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

/** Modal closes via its button or backdrop; Esc is reserved for Quick exit. */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-surface shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-muted hover:bg-ground">
            <Icon name="x" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{children}</p>;
}

export function Loading() {
  return <div className="h-64 animate-pulse rounded-2xl bg-line/40" aria-label="Loading" />;
}
