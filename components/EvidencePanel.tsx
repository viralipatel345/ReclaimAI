"use client";
import { downloadEvidencePdf } from "@/lib/evidencePdf";
import { shortDateTime } from "@/lib/time";
import type { Case } from "@/lib/types";
import { Icon } from "./Icon";

export function EvidencePanel({ c }: { c: Case }) {
  const rows = [...c.evidence].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  return (
    <section className="rounded-2xl bg-panel p-6 text-white" aria-labelledby="evidence-title">
      <div className="flex items-center justify-between">
        <h2 id="evidence-title" className="font-display text-xl font-semibold">Evidence log</h2>
        <span className="flex items-center gap-1.5 text-xs text-panel-muted">
          <Icon name="lock" size={13} /> No images stored
        </span>
      </div>
      <p className="mt-1.5 text-sm text-panel-muted">Every link, with a timestamp and fingerprint, ready if you need it later.</p>
      <ul className="mt-5 divide-y divide-panel-line border-y border-panel-line">
        {rows.map((e) => (
          <li key={e.id} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{e.platformName}</span>
              <span className="font-mono text-label text-panel-muted">{shortDateTime(e.at)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 font-mono text-label text-panel-muted">
              <span className="uppercase tracking-wider">{e.event}</span>
              <span title={e.fingerprint}>sha256 {e.fingerprint.slice(0, 8)}…{e.fingerprint.slice(-4)}</span>
            </div>
          </li>
        ))}
      </ul>
      <button
        onClick={() => downloadEvidencePdf(c)}
        className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/25 text-sm font-medium hover:bg-white/10"
      >
        <Icon name="download" size={16} /> Download evidence PDF
      </button>
    </section>
  );
}
