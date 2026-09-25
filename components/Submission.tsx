"use client";
import { useState } from "react";
import type { Submission } from "@/lib/submission";
import { Icon } from "./Icon";
import { btnSecondary } from "./ui";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-ink/40"
    >
      <Icon name={done ? "check" : "copy"} size={13} /> {done ? "Copied" : label}
    </button>
  );
}

/** How to send one message: email draft (mailto / Gmail-ready) or the platform's form with copy-paste fields. */
export function SubmissionPanel({ s }: { s: Submission }) {
  if (s.channel === null) {
    return <p className="rounded-xl bg-overdue-soft p-4 text-sm text-overdue">{s.message}</p>;
  }
  if (s.channel === "email") {
    return (
      <div className="space-y-3">
        {s.standInFor && (
          <p className="rounded-xl bg-accent-soft p-3 text-xs text-accent">
            Addressed to {s.to}, standing in for {s.standInFor}. A real email — send it, then tap “I’ve sent it”.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href={s.compose} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} border-accent bg-accent text-white hover:bg-accent-hover`}>
            <Icon name="mail" size={15} /> Open in Gmail
          </a>
          <a href={s.mailto} className={btnSecondary}>
            <Icon name="mail" size={15} /> Other email app
          </a>
          <CopyButton value={`To: ${s.to}\nSubject: ${s.subject}\n\n${s.body}`} label="Copy email" />
        </div>
        <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-y-1 text-sm">
          <dt className="text-muted">To</dt>
          <dd className="truncate font-mono text-caption">{s.to}</dd>
          <dt className="text-muted">Subject</dt>
          <dd>{s.subject}</dd>
        </dl>
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ground p-4 font-sans text-caption leading-relaxed">{s.body}</pre>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <a href={s.formUrl} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} border-accent text-accent`}>
        <Icon name="external" size={15} /> Open the platform’s form
      </a>
      <p className="text-sm text-muted">Paste these into the form. Reclaim never logs in or submits forms for you.</p>
      <ul className="space-y-2">
        {s.fields.map((f) => (
          <li key={f.label} className="rounded-xl border border-line p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted">{f.label}</span>
              <CopyButton value={f.value} />
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-line break-words font-mono text-caption">{f.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
