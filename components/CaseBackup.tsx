"use client";
// Case backup / restore. Quick exit wipes the browser copy by design, so a case prepared days
// ahead (a real request already past its deadline) can be restored. Restore is paste-only:
// there are no file inputs anywhere in Reclaim.
import { useState } from "react";
import { setCase } from "@/lib/useCase";
import type { Case } from "@/lib/types";
import { Icon } from "./Icon";
import { btnPrimary, btnSecondary, Modal } from "./ui";

export function isCase(v: unknown): v is Case {
  const c = v as Case;
  return !!c && typeof c === "object" && typeof c.id === "string" && Array.isArray(c.links) && Array.isArray(c.requests) && Array.isArray(c.evidence) && c.isAdult !== false;
}

export function CaseBackup({ c }: { c: Case }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reclaim-case-${c.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-panel-muted">
      <button onClick={download} className="flex items-center gap-1 hover:text-white">
        <Icon name="download" size={12} /> Back up case
      </button>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 hover:text-white">
        <Icon name="refresh" size={12} /> Restore from backup
      </button>
      {open && (
        <Modal
          title="Restore a case"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(text);
                    if (!isCase(parsed)) throw new Error();
                    setCase(parsed);
                    setOpen(false);
                  } catch {
                    setError("That doesn’t look like a Reclaim case backup.");
                  }
                }}
                className={`${btnPrimary} h-10 px-5 text-sm`}
              >
                Restore
              </button>
            </>
          }
        >
          <label htmlFor="backup" className="text-sm font-medium">Paste the contents of your backup file</label>
          <textarea id="backup" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="mt-2 w-full rounded-xl border border-line p-3 font-mono text-caption focus:border-accent focus:outline-none" />
          {error && <p className="mt-2 text-sm text-overdue">{error}</p>}
          <p className="mt-2 text-xs text-muted">This replaces the case in this browser. The backup holds your name, email and links — keep it private.</p>
        </Modal>
      )}
    </div>
  );
}
