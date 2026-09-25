"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EvidencePanel } from "@/components/EvidencePanel";
import { Icon } from "@/components/Icon";
import { useDemoMode } from "@/components/Providers";
import { btnGhost, btnPrimary, btnSecondary, card, ChannelTag, Eyebrow, Loading, Modal, PlatformMark, StatusPill } from "@/components/ui";
import { displayStatus, markSent, withOpening } from "@/lib/caseOps";
import { updateCase, useCase } from "@/lib/useCase";
import { useNow } from "@/lib/useNow";
import { SECTION } from "@/lib/templates";
import type { Case, TakedownRequest } from "@/lib/types";

export default function Requests() {
  const c = useCase();
  if (c === undefined) return <Loading />;
  if (!c) return <p className="text-muted">No active case.</p>;
  return <RequestsView c={c} />;
}

function RequestsView({ c }: { c: Case }) {
  const router = useRouter();
  const demo = useDemoMode();
  const [reading, setReading] = useState<TakedownRequest | null>(null);
  const [editing, setEditing] = useState<TakedownRequest | null>(null);
  const pending = c.requests.filter((r) => r.status === "ready");
  const n = pending.length;

  const sendAll = () => {
    updateCase((x) => markSent(x, pending.map((r) => r.id), new Date().toISOString(), demo));
    router.push("/case/tracker");
  };

  return (
    <div>
      <Eyebrow>Step 02</Eyebrow>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-tight md:text-[44px]">
        {n > 0 ? `${n} request${n === 1 ? "" : "s"} ready to send` : "All requests sent"}
      </h1>
      <p className="mt-2 max-w-[62ch] text-muted">Each request uses a fixed legal template with your signature. Only the greeting is written by AI.</p>

      <div className="mt-8 grid gap-6 2xl:grid-cols-[1fr_340px] xl:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-5 md:grid-cols-2">
          {c.requests.map((r) => (
            <RequestCard key={r.id} r={r} onRead={() => setReading(r)} onEdit={() => setEditing(r)} />
          ))}
        </div>
        <div className="space-y-5">
          <EvidencePanel c={c} />
        </div>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-line bg-ground/95 px-4 py-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Icon name={c.reviewEachBeforeSending ? "eye" : "send"} size={16} />
            {c.reviewEachBeforeSending ? "Review mode is on — you’ll confirm each one." : c.autoSendConsent ? "Auto-send is on. Reclaim will chase every platform for you." : "You’ll send each one yourself."}
            {demo && <span className="font-medium text-ink">Demo: nothing is actually sent.</span>}
          </p>
          <button onClick={sendAll} disabled={n === 0} className={`${btnPrimary} md:min-w-[260px]`}>
            <Icon name="send" size={17} /> Send all {n} request{n === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {reading && (
        <Modal title={`Request to ${reading.platformName}`} onClose={() => setReading(null)}>
          <dl className="mb-4 grid grid-cols-[72px_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted">To</dt>
            <dd className="font-mono text-[13px]">{reading.target ?? "Site contact page"}</dd>
            <dt className="text-muted">Subject</dt>
            <dd>{reading.subject}</dd>
          </dl>
          <pre className="whitespace-pre-wrap rounded-xl bg-ground p-4 font-sans text-[14px] leading-relaxed">{reading.body}</pre>
        </Modal>
      )}
      {editing && <EditOpening c={c} r={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RequestCard({ r, onRead, onEdit }: { r: TakedownRequest; onRead: () => void; onEdit: () => void }) {
  const status = displayStatus(r, useNow());
  const lines = r.body.split("\n");
  const excerpt = `${r.opening}\n\n${lines[lines.indexOf(SECTION.identification) + 1] ?? ""}`;
  return (
    <article className={`${card} flex flex-col p-5`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlatformMark name={r.platformName} />
          <div>
            <h2 className="font-medium">{r.platformName}</h2>
            <ChannelTag channel={r.channel} />
          </div>
        </div>
        <StatusPill status={status} />
      </header>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-xs text-muted">{r.target ?? "Couldn't confirm — use the site's contact page"}</p>
        <span className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[11px] text-muted">{r.coveredByAct ? "TAKE IT DOWN Act · 48h" : "Google policy"}</span>
      </div>
      <blockquote className="mt-3 line-clamp-5 flex-1 whitespace-pre-line rounded-xl bg-ground px-4 py-3 text-sm leading-relaxed text-ink/85">{excerpt}</blockquote>
      <footer className="mt-3 flex items-center justify-end">
        <div className="flex gap-1 whitespace-nowrap">
          <button onClick={onRead} className={btnGhost}>
            <Icon name="eye" size={15} /> Read full request
          </button>
          <button onClick={onEdit} className={btnGhost} disabled={status !== "ready" && status !== "draft"}>
            <Icon name="pen" size={15} /> Edit
          </button>
        </div>
      </footer>
    </article>
  );
}

function EditOpening({ c, r, onClose }: { c: Case; r: TakedownRequest; onClose: () => void }) {
  const [opening, setOpening] = useState(r.opening);
  const legal = r.body.slice(r.body.indexOf(SECTION.identification));
  const save = () => {
    updateCase((x) => ({ ...x, requests: x.requests.map((q) => (q.id === r.id ? withOpening(x, q, opening) : q)) }));
    onClose();
  };
  return (
    <Modal
      title={`Edit request to ${r.platformName}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={save} className={`${btnPrimary} h-10 px-5 text-sm`}>Save</button>
        </>
      }
    >
      <label htmlFor="opening" className="text-sm font-medium">Greeting</label>
      <textarea id="opening" value={opening} onChange={(e) => setOpening(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-line p-3 text-[14px] leading-relaxed focus:border-accent focus:outline-none" />
      <p className="mt-5 flex items-center gap-2 text-sm font-medium">
        <Icon name="lock" size={14} /> Legal sections are fixed
      </p>
      <p className="mt-1 text-xs text-muted">These contain every element the law requires, so they can’t be edited.</p>
      <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ground p-4 font-sans text-[13px] leading-relaxed text-muted">{legal}</pre>
      {c.isDemo && <p className="mt-3 text-xs text-muted">Example case · fictional</p>}
    </Modal>
  );
}
