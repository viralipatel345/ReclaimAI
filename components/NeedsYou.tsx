"use client";
import { answerUnclear, confirmNameResult, dismissNameResult } from "@/lib/recheckOps";
import { updateCase } from "@/lib/useCase";
import type { Case } from "@/lib/types";
import { Icon } from "./Icon";
import { card } from "./ui";

/** Decisions only the user can make: new name results and pages we couldn't read. */
export function NeedsYou({ c, demo }: { c: Case; demo: boolean }) {
  const results = c.pendingResults ?? [];
  const unclear = c.links.filter((l) => l.needsUserCheck);
  if (!results.length && !unclear.length) return null;
  const now = () => new Date().toISOString();
  const btn = "rounded-lg border px-3 py-1.5 text-sm font-medium";

  return (
    <section className={`${card} mt-6 border-accent/40 p-5`} aria-labelledby="needs-you">
      <h2 id="needs-you" className="flex items-center gap-2 font-medium">
        <Icon name="info" size={16} className="text-accent" /> Needs you
      </h2>
      <ul className="mt-3 divide-y divide-line">
        {results.map((r) => (
          <li key={r.url} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm">New Google result for your name. Is this content of you?</p>
              <p className="truncate font-mono text-xs text-muted" title={r.url}>{r.url.replace(/^https?:\/\/(www\.)?/, "")}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => updateCase((x) => confirmNameResult(x, r.url, now(), demo))} className={`${btn} border-accent bg-accent text-white hover:bg-accent-hover`}>
                Yes — request removal
              </button>
              <button onClick={() => updateCase((x) => dismissNameResult(x, r.url))} className={`${btn} border-line hover:border-ink/40`}>
                Not me
              </button>
            </div>
          </li>
        ))}
        {unclear.map((l) => (
          <li key={l.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm">We couldn’t tell if this is still up. Could you check?</p>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate font-mono text-xs text-muted underline decoration-line">
                {l.url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => updateCase((x) => answerUnclear(x, l.id, true, now(), demo))} className={`${btn} border-line hover:border-ink/40`}>
                Still up
              </button>
              <button onClick={() => updateCase((x) => answerUnclear(x, l.id, false, now(), demo))} className={`${btn} border-line hover:border-ink/40`}>
                It’s gone
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Reclaim never guesses. Nothing is filed for a new result until you confirm it.</p>
    </section>
  );
}
