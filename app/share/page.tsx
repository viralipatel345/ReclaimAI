"use client";
// Share target. Android "Share → Reclaim" opens /share?url=…&text=…&title=…; iOS and
// desktop use the paste box. One link in → resolved → drafted → sent (if consented).
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { Icon } from "@/components/Icon";
import { useDemoMode } from "@/components/Providers";
import { btnPrimary, btnSecondary, card, ChannelTag, Eyebrow, Loading, PlatformPill } from "@/components/ui";
import { addLinkWithRequest } from "@/lib/recheckOps";
import { extractUrl, matchDirectory, normalizeUrl } from "@/lib/platforms";
import { getCase, setCase, useCase } from "@/lib/useCase";
import type { Case, ResolvedPlatform, TakedownRequest } from "@/lib/types";
import { fetchResolution } from "@/lib/useResolve";

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <Loading />
        </Shell>
      }
    >
      <ShareTarget />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 pb-10 pt-6">{children}</div>;
}

/** Why a drafted request wasn't sent automatically, and what one tap fixes it. */
function notSentReason(c: Case, r: TakedownRequest): { text: string; href: string; cta: string } {
  if (!r.channel) return { text: "Couldn't confirm where to send this — use the site's contact page.", href: "/case/requests", cta: "See the request" };
  if (!c.attestation.signedAt) return { text: "Sign once, and Reclaim can send requests like this for you.", href: "/case", cta: "Sign and send" };
  if (c.reviewEachBeforeSending) return { text: "You asked to review each request before it’s sent.", href: "/case/requests", cta: "Review & send" };
  return { text: "Auto-send is off, so this is waiting for you.", href: "/case/requests", cta: "Review & send" };
}

function ShareTarget() {
  const params = useSearchParams();
  const c = useCase();
  const demo = useDemoMode();
  const handled = useRef<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const sharedSomething = ["url", "text", "title"].some((k) => params.get(k));
  const sharedUrl = extractUrl(params.get("url")) ?? extractUrl(params.get("text")) ?? extractUrl(params.get("title"));

  const handle = async (url: string) => {
    if (!getCase()) return;
    let platform: ResolvedPlatform | undefined;
    if (!matchDirectory(url)) {
      setResolving(true);
      platform = (await fetchResolution(url)) ?? undefined;
      setResolving(false);
    }
    const current = getCase();
    if (!current) return;
    const { next, request } = addLinkWithRequest(current, url, new Date().toISOString(), demo, platform);
    setDuplicate(next === current);
    if (next !== current) setCase(next);
    setRequestId(request?.id ?? null);
  };

  useEffect(() => {
    if (!c || !sharedUrl || handled.current === sharedUrl) return;
    handled.current = sharedUrl;
    handle(sharedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, sharedUrl]);

  if (c === undefined)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (!c) {
    return (
      <Shell>
        <Eyebrow>Shared to Reclaim</Eyebrow>
        <h1 className="mt-2 font-display text-display-s font-semibold leading-tight">Start your case first.</h1>
        <p className="mt-2 text-muted">It takes a minute. After that, sharing a link is all it takes.</p>
        <Link href="/" className={`${btnPrimary} mt-6 w-full`}>
          Start
        </Link>
      </Shell>
    );
  }

  const request = c.requests.find((r) => r.id === requestId);
  const link = request && c.links.find((l) => request.linkIds.includes(l.id));
  const sent = !!request?.sentAt && !!request.deadlineAt;
  const heading = resolving ? "Finding where to send it…" : sent ? "Done. We’ve got it from here." : request ? "Drafted. One tap to send." : "Add a link";

  return (
    <Shell>
      <Eyebrow>Shared to Reclaim</Eyebrow>
      <h1 className="mt-2 font-display text-display-s font-semibold leading-tight">{heading}</h1>

      {sharedSomething && !sharedUrl && (
        <p className="mt-4 flex gap-2 rounded-xl bg-overdue-soft p-4 text-sm text-overdue" role="status">
          <Icon name="alert" size={18} />
          <span>We couldn’t find a link in what you shared. In the app, use “Copy link”, then paste it below. Reclaim only works with links.</span>
        </p>
      )}

      {resolving && (
        <p className={`${card} mt-6 flex items-center gap-2 p-5 text-sm text-muted`} aria-live="polite">
          <Icon name="search" size={16} className="animate-pulse" /> Looking up this site’s removal channel with Google Search…
        </p>
      )}

      {request && link && !resolving && (
        <section className={`${card} mt-6 overflow-hidden`} aria-live="polite">
          <div className="p-5">
            <p className="truncate font-mono text-caption" title={link.url}>
              {link.url.replace(/^https?:\/\/(www\.)?/, "")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PlatformPill platform={link.platform} />
              <ChannelTag channel={link.platform.channel} />
            </div>
            {duplicate && <p className="mt-3 text-xs text-muted">You’d already shared this link — here’s where it stands.</p>}
          </div>
          {sent && request.status !== "removed" ? (
            <div className="border-t border-line bg-accent-soft px-5 py-5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-ink">
                <span className="flex items-center gap-2 text-lg font-medium">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
                    <Icon name="check" size={14} strokeWidth={2.5} />
                  </span>
                  Request sent
                </span>
                <span className="text-lg text-muted">·</span>
                <Countdown deadlineAt={request.deadlineAt!} className="text-display-s font-medium" />
              </p>
              <p className="mt-2 text-sm text-muted">
                until {request.platformName}’s legal deadline{request.simulated ? " (demo — nothing actually sent)" : ""}. You don’t need to do anything else. We’ll re-check every 3 days.
              </p>
            </div>
          ) : request.status === "removed" ? (
            <div className="border-t border-line bg-removed-soft px-5 py-4 text-sm font-medium text-removed">
              <Icon name="check" size={15} className="mr-1 inline" /> Already removed. We’re still watching for re-uploads.
            </div>
          ) : (
            <div className="border-t border-line px-5 py-4">
              {(() => {
                const why = notSentReason(c, request);
                return (
                  <>
                    <p className="text-sm text-muted">{why.text}</p>
                    <Link href={why.href} className={`${btnSecondary} mt-3 w-full`}>
                      {why.cta}
                    </Link>
                  </>
                );
              })()}
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
        <label htmlFor="paste" className="text-sm font-medium">
          {request ? "Add another link" : "Paste a link"}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 font-mono text-base focus:border-accent focus:outline-none md:text-caption"
          />
          <button className={`${btnPrimary} h-12 px-4`} aria-label="Add link">
            <Icon name="arrow" size={18} />
          </button>
        </div>
        {pasteError && <p className="mt-2 text-sm text-overdue">{pasteError}</p>}
        <p className="mt-3 text-xs leading-relaxed text-muted">On Android, use Share → Reclaim from any app. On iPhone or a computer, paste the link here.</p>
      </form>

      <Link href="/case/tracker" className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-accent">
        See all clocks <Icon name="arrow" size={15} />
      </Link>
    </Shell>
  );
}
