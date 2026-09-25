"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EvidencePanel } from "@/components/EvidencePanel";
import { SendReview } from "@/components/SendReview";
import { Icon } from "@/components/Icon";
import { useAppConfig, useDemoMode } from "@/components/Providers";
import { btnGhost, btnPrimary, btnSecondary, card, ChannelTag, Eyebrow, Loading, Modal, PlatformMark, StatusPill } from "@/components/ui";
import { displayStatus, markSent, withOpening } from "@/lib/caseOps";
import { updateCase, useCase } from "@/lib/useCase";
import { useNow } from "@/lib/useNow";
import { SECTION } from "@/lib/templates";
import { fetchOpenings } from "@/lib/openingsClient";
import { useGmail } from "@/lib/google";
import { sendViaGmail } from "@/lib/gmailAgent";
import { GmailConnect } from "@/components/GmailConnect";
import { Typewriter } from "@/components/Typewriter";
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
  const [reviewQueue, setReviewQueue] = useState<TakedownRequest[] | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const gmail = useGmail();
  const { testPlatformInbox } = useAppConfig();
  const pending = c.requests.filter((r) => r.status === "ready");
  const n = pending.length;
  const writing = c.requests.filter((r) => r.openingSource === "pending");
  useDraftGreetings(c, demo);

  const sendAll = async () => {
    if (c.reviewEachBeforeSending || !c.autoSendConsent) return setReviewQueue(pending);
    // One-time consent given. Signed in with Google: send for real from her Gmail.
    if (gmail) {
      setSending(true);
      setSendError(null);
      const out = await sendViaGmail(pending, testPlatformInbox);
      setSending(false);
      if (out.failed.length) setSendError(`${out.failed.length} couldn’t be sent from Gmail. Try again, or send them yourself.`);
      const manual = pending.filter((r) => out.notEmailable.includes(r.id) || out.failed.includes(r.id));
      if (manual.length) return setReviewQueue(manual); // web forms: open + copy fields
      return router.push("/case/tracker");
    }
    if (demo) {
      updateCase((x) => markSent(x, pending.map((r) => r.id), new Date().toISOString(), true));
      return router.push("/case/tracker");
    }
    setReviewQueue(pending);
  };

  return (
    <div>
      <Eyebrow>Step 02</Eyebrow>
      <h1 className="mt-3 font-display text-display-m font-semibold leading-tight tracking-tight md:text-display-l">
        {writing.length > 0 ? `Drafting ${c.requests.length} requests…` : n > 0 ? `${n} request${n === 1 ? "" : "s"} ready to send` : "All requests sent"}
      </h1>
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <p className="max-w-[62ch] text-muted">Fixed legal template, your signature. Gemini writes only the greeting.</p>
        {demo && (
          <Link href="/case/detect" className={`${btnSecondary} shrink-0 border-accent text-accent`}>
            <Icon name="search" size={15} /> Live detection
          </Link>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 content-start gap-5 md:grid-cols-2">
          {c.requests.map((r, i) => (
            <div key={r.id} className="anim-rise flex md:[&:last-child:nth-child(odd)]:col-span-2" style={{ animationDelay: `${i * 90}ms` }}>
              <RequestCard r={r} onRead={() => setReading(r)} onEdit={() => setEditing(r)} />
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <EvidencePanel c={c} />
        </div>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-line bg-ground/95 px-4 py-4 backdrop-blur md:mx-0 md:rounded-t-2xl md:px-5">
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Icon name={c.reviewEachBeforeSending ? "eye" : "send"} size={16} />
            {writing.length > 0
              ? "Gemini is writing the greetings…"
              : c.reviewEachBeforeSending
                ? "Review mode: you’ll confirm each one."
                : c.autoSendConsent
                  ? "Auto-send is on."
                  : "You’ll send each one yourself."}
            {demo ? (
              <span className="font-medium text-ink">Demo: nothing is actually sent.</span>
            ) : gmail && testPlatformInbox ? (
              <span className="font-medium text-ink">Real Gmail, sent to the test inbox standing in for each platform.</span>
            ) : null}
          </p>
          {!gmail && !demo && <GmailConnect compact />}
          {sendError && <p className="text-sm text-overdue">{sendError}</p>}
          <button onClick={sendAll} disabled={n === 0 || sending || writing.length > 0} className={`${btnPrimary} md:min-w-[260px]`}>
            <Icon name="send" size={17} /> {sending ? "Sending from Gmail…" : `${c.reviewEachBeforeSending || !c.autoSendConsent ? "Review & send" : "Send all"} ${n} request${n === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {reading && (
        <Modal title={`Request to ${reading.platformName}`} onClose={() => setReading(null)}>
          <dl className="mb-4 grid grid-cols-[72px_minmax(0,1fr)] gap-y-1.5 text-sm">
            <dt className="text-muted">To</dt>
            <dd className="font-mono text-caption">{reading.target ?? "Site contact page"}</dd>
            <dt className="text-muted">Subject</dt>
            <dd>{reading.subject}</dd>
          </dl>
          <pre className="whitespace-pre-wrap rounded-xl bg-ground p-4 font-sans text-sm leading-relaxed">{reading.body}</pre>
        </Modal>
      )}
      {editing && <EditOpening c={c} r={editing} onClose={() => setEditing(null)} />}
      {reviewQueue && (
        <SendReview
          c={c}
          queue={reviewQueue}
          demo={demo}
          onDone={(sent) => {
            setReviewQueue(null);
            if (sent > 0) router.push("/case/tracker");
          }}
        />
      )}
    </div>
  );
}

/** Requests whose greeting was pending when this page first saw them get typed out. */
const typedThisSession = new Set<string>();

/** Fetch Gemini greetings for requests still marked pending (cache fallback in demo). */
function useDraftGreetings(c: Case, demo: boolean) {
  const inflight = useRef(false);
  useEffect(() => {
    const pending = c.requests.filter((r) => r.openingSource === "pending");
    if (!pending.length || inflight.current) return;
    inflight.current = true;
    pending.forEach((r) => typedThisSession.add(r.id));
    fetchOpenings(
      pending.map((r) => ({ platformId: r.platformId, platformName: r.platformName, kind: r.kind })),
      demo,
    ).then(({ openings, source }) => {
      inflight.current = false;
      updateCase((x) => ({
        ...x,
        requests: x.requests.map((r) => {
          if (r.openingSource !== "pending") return r;
          const text = openings[r.platformId];
          return text ? { ...withOpening(x, r, text), openingSource: source === "template" ? ("template" as const) : ("gemini" as const) } : { ...r, openingSource: "template" as const };
        }),
      }));
    });
  }, [c.requests, demo]);
}

function RequestCard({ r, onRead, onEdit }: { r: TakedownRequest; onRead: () => void; onEdit: () => void }) {
  const status = displayStatus(r, useNow());
  const lines = r.body.split("\n");
  const firstLine = lines[lines.indexOf(SECTION.identification) + 1] ?? "";
  const pending = r.openingSource === "pending";
  return (
    <article className={`${card} flex w-full flex-col p-5`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlatformMark name={r.platformName} />
          <div>
            <h2 className="font-medium">{r.platformName}</h2>
            <ChannelTag channel={r.channel} />
          </div>
        </div>
        {pending ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <Icon name="sparkle" size={12} className="anim-shimmer" /> Drafting
          </span>
        ) : (
          <span key={status} className="anim-flip">
            <StatusPill status={status} />
          </span>
        )}
      </header>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-xs text-muted">{r.target ?? "Couldn't confirm — use the site's contact page"}</p>
        <span className="shrink-0 rounded-md border border-line px-2 py-0.5 text-label text-muted">{r.coveredByAct ? "TAKE IT DOWN Act · 48h" : "Google policy"}</span>
      </div>
      <div className="mt-3 flex-1 rounded-xl bg-ground px-4 py-3">
        {pending ? (
          <div className="space-y-2 py-1" aria-label="Gemini is writing the greeting">
            <div className="anim-shimmer h-3 w-2/5 rounded bg-line" />
            <div className="anim-shimmer h-3 w-full rounded bg-line" />
            <div className="anim-shimmer h-3 w-4/5 rounded bg-line" />
          </div>
        ) : (
          <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-ink/85">
            <Typewriter text={r.opening} animate={typedThisSession.has(r.id) && r.openingSource === "gemini"} />
          </p>
        )}
        <p className="mt-2 line-clamp-1 text-xs text-muted">{firstLine}</p>
      </div>
      <footer className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 whitespace-nowrap text-label text-muted">
          {r.openingSource === "gemini" && (
            <>
              <Icon name="sparkle" size={12} /> Greeting by Gemini
            </>
          )}
        </span>
        <div className="flex gap-1 whitespace-nowrap">
          <button onClick={onRead} className={btnGhost}>
            <Icon name="eye" size={15} /> Read
          </button>
          <button onClick={onEdit} className={btnGhost} disabled={pending || (status !== "ready" && status !== "draft")}>
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
    updateCase((x) => ({ ...x, requests: x.requests.map((q) => (q.id === r.id ? { ...withOpening(x, q, opening), openingSource: "user" as const } : q)) }));
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
      <textarea id="opening" value={opening} onChange={(e) => setOpening(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-line p-3 text-sm leading-relaxed focus:border-accent focus:outline-none" />
      <p className="mt-5 flex items-center gap-2 text-sm font-medium">
        <Icon name="lock" size={14} /> Legal sections are fixed
      </p>
      <p className="mt-1 text-xs text-muted">These contain every element the law requires, so they can’t be edited.</p>
      <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ground p-4 font-sans text-caption leading-relaxed text-muted">{legal}</pre>
      {c.isDemo && <p className="mt-3 text-xs text-muted">Example case · fictional</p>}
    </Modal>
  );
}
