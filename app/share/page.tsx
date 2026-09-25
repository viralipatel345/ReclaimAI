"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { Icon } from "@/components/Icon";
import { useDemoMode } from "@/components/Providers";
import { btnPrimary, btnSecondary, card, ChannelTag, Eyebrow, Loading, PlatformPill } from "@/components/ui";
import { addLink, draftRequests, markSent } from "@/lib/caseOps";
import { extractUrl, normalizeUrl } from "@/lib/platforms";
import { setCase, useCase } from "@/lib/useCase";
import type { Case, TakedownRequest } from "@/lib/types";

export default function SharePage() {
  return (
    <Suspense fallback={<Shell><Loading /></Shell>}>
      <ShareTarget />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-8">{children}</div>;
}

/** Add one link to the active case, draft its request and — if consented — send it. Idempotent per URL. */
function ingest(c: Case, url: string, demo: boolean): { next: Case; request: TakedownRequest | undefined } {
  const existing = c.links.find((l) => l.url === url);
  if (existing) return { next: c, request: c.requests.find((r) => r.linkIds.includes(existing.id)) };

  const at = new Date().toISOString();
  let next = addLink(c, url, at);
  const link = next.links[next.links.length - 1];
  const [req] = draftRequests({ ...next, links: [link] }, at);
  next = { ...next, requests: [...next.requests, req] };
  const canAutoSend = next.autoSendConsent && !next.reviewEachBeforeSending && !!next.attestation.signedAt && !!req.channel;
  if (canAutoSend) next = markSent(next, [req.id], at, demo);
  return { next, request: next.requests.find((r) => r.id === req.id) };
}

function ShareTarget() {
  const params = useSearchParams();
  const c = useCase();
  const demo = useDemoMode();
  const handled = useRef<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const sharedUrl = extractUrl(params.get("url")) ?? extractUrl(params.get("text")) ?? extractUrl(params.get("title"));

  const handle = (url: string) => {
    if (!c) return;
    const { next, request } = ingest(c, url, demo);
    if (next !== c) setCase(next);
    setRequestId(request?.id ?? null);
  };

  useEffect(() => {
    if (!c || !sharedUrl || handled.current === sharedUrl) return;
    handled.current = sharedUrl;
    handle(sharedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, sharedUrl]);

  if (c === undefined) return <Shell><Loading /></Shell>;
  if (!c) {
    return (
      <Shell>
        <p className="text-muted">Start a case first, then share links to it.</p>
        <Link href="/" className={`${btnPrimary} mt-4 w-full`}>Start</Link>
      </Shell>
    );
  }

  const request = c.requests.find((r) => r.id === requestId);
  const link = request && c.links.find((l) => request.linkIds.includes(l.id));

  return (
    <Shell>
      <Eyebrow>Shared to Reclaim</Eyebrow>
      <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight">{request?.sentAt ? "Done. We’ve got it from here." : "Add a link"}</h1>

      {request && link && (
        <section className={`${card} mt-6 overflow-hidden`} aria-live="polite">
          <div className="p-5">
            <p className="truncate font-mono text-[13px]" title={link.url}>{link.url.replace(/^https?:\/\/(www\.)?/, "")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PlatformPill platform={link.platform} />
              <ChannelTag channel={link.platform.channel} />
            </div>
          </div>
          {request.sentAt && request.deadlineAt ? (
            <div className="border-t border-line bg-accent-soft px-5 py-5">
              <p className="flex items-center gap-2 text-sm font-medium text-accent">
                <Icon name="check" size={16} strokeWidth={2.25} /> Request sent{request.simulated ? " (demo)" : ""}
              </p>
              <Countdown deadlineAt={request.deadlineAt} className="mt-2 block text-[44px] font-medium leading-none text-ink" />
              <p className="mt-2 text-sm text-muted">until {request.platformName}’s legal deadline. You don’t need to do anything else.</p>
            </div>
          ) : (
            <div className="border-t border-line px-5 py-4">
              <p className="text-sm text-muted">
                {request.channel ? "Drafted and waiting for your review." : link.platform.message}
              </p>
              <Link href="/case/requests" className={`${btnSecondary} mt-3 w-full`}>Review request</Link>
            </div>
          )}
        </section>
      )}

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          const url = normalizeUrl(paste);
          if (!url) return setPasteError("That doesn't look like a web link.");
          setPasteError(null);
          setPaste("");
          handle(url);
        }}
      >
        <label htmlFor="paste" className="text-sm font-medium">{request ? "Add another link" : "Paste a link"}</label>
        <div className="mt-2 flex gap-2">
          <input
            id="paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 font-mono text-[13px] focus:border-accent focus:outline-none"
          />
          <button className={`${btnPrimary} h-12 px-4`} aria-label="Add link">
            <Icon name="arrow" size={18} />
          </button>
        </div>
        {pasteError && <p className="mt-2 text-sm text-overdue">{pasteError}</p>}
        <p className="mt-3 text-xs leading-relaxed text-muted">On Android, use Share → Reclaim from any app. On iPhone or desktop, paste the link here.</p>
      </form>

      <Link href="/case/tracker" className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-accent">
        See all clocks <Icon name="arrow" size={15} />
      </Link>
    </Shell>
  );
}
