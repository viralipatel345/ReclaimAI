"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PrivacyCard } from "@/components/StepRail";
import { btnPrimary, btnSecondary, card, ChannelTag, Eyebrow, Loading, PlatformPill } from "@/components/ui";
import { addLink, draftRequests, removeLink } from "@/lib/caseOps";
import { nameSearchUrl, normalizeUrl } from "@/lib/platforms";
import { ATTESTATION_TEXT } from "@/lib/templates";
import { updateCase, useCase } from "@/lib/useCase";
import { useResolveLinks } from "@/lib/useResolve";
import type { OpeningsResult, OpeningTarget } from "@/lib/draft";
import type { Case } from "@/lib/types";

export default function TellUsWhere() {
  const c = useCase();
  if (c === undefined) return <Loading />;
  if (c === null)
    return (
      <p className="text-muted">
        No active case.{" "}
        <Link href="/" className="font-medium text-accent">Start here</Link>
      </p>
    );
  return <CaseForm c={c} />;
}

function CaseForm({ c }: { c: Case }) {
  const router = useRouter();
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const checking = useResolveLinks(c);
  const [attested, setAttested] = useState(!!c.attestation.signedAt);
  const signature = c.attestation.signature;
  const setSignature = (v: string) => updateCase((x) => ({ ...x, attestation: { ...x.attestation, signature: v } }));

  const hasNameSearch = c.links.some((l) => l.kind === "name_search");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contactEmail);
  const canDraft = attested && signature.trim().length >= 2 && c.legalName.trim().length >= 2 && emailOk && c.links.length > 0 && checking.size === 0 && !drafting;

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const url = normalizeUrl(linkInput);
    if (!url) {
      setLinkError("That doesn't look like a web link. Try copying it from the address bar.");
      return;
    }
    setLinkError(null);
    updateCase((x) => addLink(x, url, new Date().toISOString()));
    setLinkInput("");
  };

  const onDraft = async () => {
    const at = new Date().toISOString();
    const signed: Case = { ...c, attestation: { text: ATTESTATION_TEXT, signature: signature.trim(), signedAt: at } };
    const targets: OpeningTarget[] = draftRequests(signed, at).map((r) => ({
      platformId: r.platformId,
      platformName: r.platformName,
      kind: r.kind,
    }));
    setDrafting(true);
    let openings: Record<string, string> = {};
    try {
      const res = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targets }) });
      if (res.ok) openings = ((await res.json()) as OpeningsResult).openings;
    } catch {
      // Template openings are used if Gemini is unreachable.
    }
    updateCase((x) => {
      const next = { ...x, attestation: signed.attestation };
      const requests = draftRequests(next, at, openings).map((r) => ({ ...r, openingSource: openings[r.platformId] ? ("gemini" as const) : ("template" as const) }));
      return { ...next, requests };
    });
    router.push("/case/requests");
  };

  return (
    <div>
      <Eyebrow>Step 01</Eyebrow>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-tight md:text-[44px]">Tell us where</h1>
      <p className="mt-2 max-w-[60ch] text-muted">Your details and the links. That’s all — you never need to describe what they show.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className={`${card} p-5`} aria-labelledby="details-title">
          <h2 id="details-title" className="font-display text-xl font-semibold">Your details</h2>
          <p className="mt-1 text-sm text-muted">Requests go out under this name. Platforms reply to this email — a new address just for this is fine.</p>
          <label htmlFor="legal-name" className="mt-5 block text-sm font-medium">Full name</label>
          <input
            id="legal-name"
            value={c.legalName}
            onChange={(e) => updateCase((x) => ({ ...x, legalName: e.target.value }))}
            autoComplete="name"
            className="mt-2 h-11 w-full rounded-xl border border-line bg-surface px-4 text-[16px] focus:border-accent focus:outline-none md:text-[15px]"
          />
          <label htmlFor="contact-email" className="mt-4 block text-sm font-medium">Email for replies</label>
          <input
            id="contact-email"
            type="email"
            value={c.contactEmail}
            onChange={(e) => updateCase((x) => ({ ...x, contactEmail: e.target.value.trim() }))}
            autoComplete="email"
            inputMode="email"
            className="mt-2 h-11 w-full rounded-xl border border-line bg-surface px-4 text-[16px] focus:border-accent focus:outline-none md:text-[15px]"
          />
          {c.contactEmail && !emailOk && <p className="mt-2 text-sm text-overdue">That email doesn’t look complete.</p>}
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-ground p-3 text-xs leading-relaxed text-muted">
            <Icon name="lock" size={14} className="mt-0.5" />
            You’ll never be asked what the images show. Reclaim only needs the links.
          </p>
        </section>

        {/* Links */}
        <section className={`${card} p-5`} aria-labelledby="links-title">
          <div className="flex items-baseline justify-between">
            <h2 id="links-title" className="font-display text-xl font-semibold">Links</h2>
            <span className="font-mono text-xs text-muted">{c.links.length} added</span>
          </div>
          <form onSubmit={onAdd} className="mt-4 flex gap-2">
            <label htmlFor="link" className="sr-only">Paste a link</label>
            <input
              id="link"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Paste a link"
              inputMode="url"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 font-mono text-[16px] md:text-[13px] placeholder:font-sans placeholder:text-sm placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button className={`${btnSecondary} h-11`}>
              <Icon name="plus" size={16} /> Add
            </button>
          </form>
          {linkError && <p className="mt-2 text-sm text-overdue">{linkError}</p>}

          <ul className="mt-4 divide-y divide-line">
            {c.links.map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-3">
                <Icon name={l.kind === "name_search" ? "search" : "link"} size={16} className="mt-1 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]" title={l.url}>
                    {l.kind === "name_search" ? `Google results for “${c.legalName}”` : l.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <PlatformPill platform={l.platform} checking={checking.has(l.id)} />
                    {!checking.has(l.id) && <ChannelTag channel={l.platform.channel} />}
                  </div>
                  {l.platform.source === "search" && l.platform.sources?.[0] && (
                    <a href={l.platform.sources[0].uri} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-muted underline decoration-line underline-offset-2 hover:text-accent">
                      Source: {l.platform.sources[0].title || l.platform.sources[0].uri}
                    </a>
                  )}
                </div>
                <button onClick={() => updateCase((x) => removeLink(x, l.id))} className="rounded-lg p-1.5 text-muted hover:bg-ground hover:text-ink" aria-label={`Remove ${l.url}`}>
                  <Icon name="x" size={14} />
                </button>
              </li>
            ))}
          </ul>

          {!hasNameSearch && c.legalName && (
            <button
              onClick={() => updateCase((x) => addLink(x, nameSearchUrl(x.legalName), new Date().toISOString()))}
              className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-left text-sm text-muted hover:border-accent hover:text-accent"
            >
              <Icon name="search" size={16} /> Also ask Google to remove explicit results for my name
            </button>
          )}
        </section>
      </div>

      {/* Attestation + consent */}
      <section className={`${card} mt-6 grid grid-cols-1 gap-6 p-5 md:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`} aria-labelledby="sign-title">
        <div>
          <h2 id="sign-title" className="font-display text-xl font-semibold">Sign your requests</h2>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-ground p-4">
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#3446A8]" />
            <span className="text-[15px] leading-relaxed">{ATTESTATION_TEXT}</span>
          </label>
          <label htmlFor="sig" className="mt-5 block text-sm font-medium">Type your full name to sign</label>
          <input
            id="sig"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            autoComplete="off"
            className="mt-2 h-14 w-full border-0 border-b-2 border-ink/80 bg-transparent px-1 font-display text-2xl italic focus:border-accent focus:outline-none"
          />
          <p className="mt-2 font-mono text-xs text-muted">Electronic signature · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>

        <div className="flex flex-col">
          <Toggle
            checked={c.autoSendConsent}
            onChange={(v) => updateCase((x) => ({ ...x, autoSendConsent: v }))}
            title="Send for me"
            text="Reclaim sends each request once it’s drafted, then chases and re-checks. You consent once; turn it off anytime."
          />
          <Toggle
            checked={c.reviewEachBeforeSending}
            onChange={(v) => updateCase((x) => ({ ...x, reviewEachBeforeSending: v }))}
            title="Review each before sending"
            text="You’ll see every request and tap send yourself."
          />
          <div className="mt-auto pt-5">
            <button onClick={onDraft} disabled={!canDraft} className={`${btnPrimary} w-full`}>
              {drafting ? "Drafting with Gemini…" : "Draft my requests"} <Icon name={drafting ? "sparkle" : "arrow"} size={18} className={drafting ? "animate-pulse" : ""} />
            </button>
            {!canDraft && !drafting && (
              <p className="mt-2 text-center text-xs text-muted">
                {checking.size > 0 ? "Still finding removal channels…" : "Add your name, email and at least one link, then tick the statement and sign."}
              </p>
            )}
          </div>
        </div>
      </section>

      <PrivacyCard className="mt-6 xl:hidden" />
    </div>
  );
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-line py-4 first:pt-0">
      <span>
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted">{text}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
