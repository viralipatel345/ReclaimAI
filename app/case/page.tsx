"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PrivacyCard } from "@/components/StepRail";
import { btnPrimary, btnSecondary, card, ChannelTag, Eyebrow, Loading, PlatformPill } from "@/components/ui";
import { addLink, draftRequests, removeLink } from "@/lib/caseOps";
import { nameSearchUrl, normalizeUrl } from "@/lib/platforms";
import { ATTESTATION_TEXT } from "@/lib/templates";
import { updateCase, useCase } from "@/lib/useCase";
import type { Case } from "@/lib/types";

export default function TellUsWhere() {
  const c = useCase();
  if (c === undefined) return <Loading />;
  if (c === null) return <p className="text-muted">No active case. Intake connects in step 2.</p>;
  return <CaseForm c={c} />;
}

function CaseForm({ c }: { c: Case }) {
  const router = useRouter();
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [attested, setAttested] = useState(!!c.attestation.signedAt);
  const [signature, setSignature] = useState(c.attestation.signature);

  const hasNameSearch = c.links.some((l) => l.kind === "name_search");
  const canDraft = attested && signature.trim().length >= 2 && c.links.length > 0;

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

  const onDraft = () => {
    const at = new Date().toISOString();
    updateCase((x) => {
      const signed = { ...x, attestation: { text: ATTESTATION_TEXT, signature: signature.trim(), signedAt: at } };
      return { ...signed, requests: draftRequests(signed, at) };
    });
    router.push("/case/requests");
  };

  return (
    <div>
      <Eyebrow>Step 01</Eyebrow>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-tight md:text-[44px]">Tell us where</h1>
      <p className="mt-2 max-w-[60ch] text-muted">Share the links. You never need to describe what they show.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Intake chat */}
        <section className={`${card} flex min-h-[460px] flex-col`} aria-label="Intake conversation">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon name="sparkle" size={16} />
              </span>
              <div>
                <p className="text-sm font-medium">Reclaim assistant</p>
                <p className="text-xs text-muted">Powered by Gemini · never asks what images show</p>
              </div>
            </div>
          </header>
          <ol className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
            {c.chat.map((m, i) => (
              <li key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-md bg-accent text-white" : "rounded-tl-md bg-ground text-ink"}`}
                >
                  {m.text}
                </p>
              </li>
            ))}
          </ol>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => e.preventDefault()}>
            <input disabled placeholder="Reply… (live Gemini intake arrives in step 2)" className="h-11 flex-1 rounded-xl border border-line bg-ground px-4 text-sm placeholder:text-muted disabled:opacity-70" />
            <button disabled className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white disabled:opacity-40" aria-label="Send">
              <Icon name="send" size={16} />
            </button>
          </form>
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
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 font-mono text-[13px] placeholder:font-sans placeholder:text-sm placeholder:text-muted focus:border-accent focus:outline-none"
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
                    <PlatformPill platform={l.platform} />
                    <ChannelTag channel={l.platform.channel} />
                  </div>
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
      <section className={`${card} mt-6 grid gap-6 p-5 md:p-6 lg:grid-cols-[1.15fr_1fr]`} aria-labelledby="sign-title">
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
              Draft my requests <Icon name="arrow" size={18} />
            </button>
            {!canDraft && <p className="mt-2 text-center text-xs text-muted">Add at least one link, tick the statement and sign.</p>}
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
