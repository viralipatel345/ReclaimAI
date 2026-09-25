"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Lock, Plus, Search, X } from "lucide-react";
import { GmailConnect } from "@/components/GmailConnect";
import { PrivacyCard } from "@/components/StepRail";
import { ChannelTag, Loading, PlatformPill } from "@/components/ui";
import { cardTitle, display, errorText, eyebrow, field, fieldLabel, helpText, inset, panel, pillPrimary, pillSecondary, Rule } from "@/components/brand";
import { IdentityVerifier } from "@/components/IdentityVerifier";
import { addLink, draftRequests, removeLink } from "@/lib/caseOps";
import { nameSearchUrl, normalizeUrl } from "@/lib/platforms";
import { ATTESTATION_TEXT } from "@/lib/templates";
import { updateCase, useCase } from "@/lib/useCase";
import { useResolveLinks } from "@/lib/useResolve";
import { useDemoMode } from "@/components/Providers";
import type { Case } from "@/lib/types";

export default function TellUsWhere() {
  const c = useCase();
  if (c === undefined) return <Loading />;
  if (c === null)
    return (
      <p className="text-[#6B7280]">
        No active case.{" "}
        <Link href="/" className="font-semibold text-[#E1261C] hover:text-[#B3130F]">Start here</Link>
      </p>
    );
  return <CaseForm c={c} />;
}

function CaseForm({ c }: { c: Case }) {
  const router = useRouter();
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const demo = useDemoMode();
  const [idVerified, setIdVerified] = useState(false);
  const checking = useResolveLinks(c);
  const [attested, setAttested] = useState(!!c.attestation.signedAt);
  const signature = c.attestation.signature;
  const setSignature = (v: string) => updateCase((x) => ({ ...x, attestation: { ...x.attestation, signature: v } }));

  const hasNameSearch = c.links.some((l) => l.kind === "name_search");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contactEmail);
  const canDraft = attested && signature.trim().length >= 2 && c.legalName.trim().length >= 2 && emailOk && c.links.length > 0 && checking.size === 0 && !drafting && idVerified;

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

  // Drafting is instant: requests are rendered from the fixed template now, and the
  // Requests page streams Gemini's greetings into them as they arrive.
  const onDraft = () => {
    if (drafting) return;
    setDrafting(true);
    const at = new Date().toISOString();
    updateCase((x) => {
      const next = { ...x, attestation: { text: ATTESTATION_TEXT, signature: signature.trim(), signedAt: at } };
      return { ...next, requests: draftRequests(next, at).map((r) => ({ ...r, openingSource: "pending" as const })) };
    });
    router.push("/case/requests");
  };

  // Demo: arriving from "Start demo" drafts automatically after a short, visible beat.
  const [autoDraft, setAutoDraft] = useState(false);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!demo || autoStarted.current || new URLSearchParams(window.location.search).get("auto") !== "1") return;
    autoStarted.current = true;
    window.history.replaceState(null, "", "/case");
    const show = setTimeout(() => setAutoDraft(true), 0);
    return () => clearTimeout(show);
  }, [demo]);

  return (
    <div className="text-[#0E1116]">
      <p className={eyebrow}><Rule />Step 01</p>
      <h1 className={`${display} mt-3 text-[40px] leading-[0.98] md:text-[56px]`}>Tell us where</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-[#4B5563]">Your details and the links. That’s all. You never need to describe what they show.</p>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className={`${panel} p-6 md:p-8`} aria-labelledby="details-title">
          <h2 id="details-title" className={cardTitle}>Your details</h2>
          <p className={`mt-1.5 ${helpText}`}>Requests go out under this name. Platforms reply to this email. A new address just for this is fine.</p>
          <label htmlFor="legal-name" className={`mt-6 ${fieldLabel}`}>Full name</label>
          <input
            id="legal-name"
            value={c.legalName}
            onChange={(e) => updateCase((x) => ({ ...x, legalName: e.target.value }))}
            autoComplete="name"
            className={`mt-2 ${field}`}
          />
          <label htmlFor="contact-email" className={`mt-4 ${fieldLabel}`}>Email for replies</label>
          <input
            id="contact-email"
            type="email"
            value={c.contactEmail}
            onChange={(e) => updateCase((x) => ({ ...x, contactEmail: e.target.value.trim() }))}
            autoComplete="email"
            inputMode="email"
            className={`mt-2 ${field}`}
          />
          {c.contactEmail && !emailOk && <p className={`mt-2 ${errorText}`}>That email doesn’t look complete.</p>}
          <div className="mt-4">
            <GmailConnect onConnected={(email) => updateCase((x) => ({ ...x, contactEmail: email }))} />
          </div>
          <IdentityVerifier claimedName={c.legalName} onVerified={setIdVerified} />
          <p className={`mt-5 flex items-start gap-2.5 ${inset} p-4 text-xs leading-relaxed text-[#6B7280]`}>
            <Lock size={14} className="mt-0.5 shrink-0 text-[#E1261C]" />
            You’ll never be asked what the images show. Reclaim only needs the links.
          </p>
        </section>

        {/* Links */}
        <section className={`${panel} p-6 md:p-8`} aria-labelledby="links-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="links-title" className={cardTitle}>Links</h2>
            <span className="rounded-full bg-[#F5F6F8] px-3 py-1 text-xs font-semibold text-[#6B7280]">{c.links.length} added</span>
          </div>
          <form onSubmit={onAdd} className="mt-5 flex gap-2">
            <label htmlFor="link" className="sr-only">Paste a link</label>
            <div className="relative min-w-0 flex-1">
              <Link2 size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                id="link"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Paste a link"
                inputMode="url"
                autoComplete="off"
                className={`${field} pl-11 font-mono text-[13px] placeholder:font-sans placeholder:text-sm`}
              />
            </div>
            <button className={pillSecondary}>
              <Plus size={16} /> Add
            </button>
          </form>
          {linkError && <p className={`mt-2 ${errorText}`}>{linkError}</p>}

          <ul className="mt-4 divide-y divide-[#E5E7EB]">
            {c.links.map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F5F6F8] text-[#6B7280]">
                  {l.kind === "name_search" ? <Search size={15} /> : <Link2 size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]" title={l.url}>
                    {l.kind === "name_search" ? `Google results for “${c.legalName}”` : l.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <PlatformPill platform={l.platform} checking={checking.has(l.id)} />
                    {!checking.has(l.id) && <ChannelTag channel={l.platform.channel} />}
                  </div>
                  {l.platform.source === "search" && l.platform.sources?.[0] && (
                    <a href={l.platform.sources[0].uri} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-[#6B7280] underline decoration-[#E5E7EB] underline-offset-2 hover:text-[#B3130F]">
                      Source: {l.platform.sources[0].title || l.platform.sources[0].uri}
                    </a>
                  )}
                </div>
                <button onClick={() => updateCase((x) => removeLink(x, l.id))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#F5F6F8] hover:text-[#0E1116]" aria-label={`Remove ${l.url}`}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>

          {!hasNameSearch && c.legalName && (
            <button
              onClick={() => updateCase((x) => addLink(x, nameSearchUrl(x.legalName), new Date().toISOString()))}
              className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-black/15 px-4 py-3.5 text-left text-sm font-medium text-[#6B7280] transition hover:border-[#E1261C] hover:text-[#B3130F]"
            >
              <Search size={16} className="shrink-0" /> Also ask Google to remove explicit results for my name
            </button>
          )}
        </section>
      </div>

      {/* Attestation + consent */}
      <section className={`${panel} mt-5 grid grid-cols-1 gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`} aria-labelledby="sign-title">
        <div>
          <h2 id="sign-title" className={cardTitle}>Sign your requests</h2>
          <label className={`mt-5 flex cursor-pointer items-start gap-3 ${inset} p-4`}>
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#E1261C]" />
            <span className="text-[15px] leading-relaxed">{ATTESTATION_TEXT}</span>
          </label>
          <label htmlFor="sig" className={`mt-6 ${fieldLabel}`}>Type your full name to sign</label>
          <input
            id="sig"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            autoComplete="off"
            className="mt-2 h-14 w-full border-0 border-b-2 border-[#0E1116] bg-transparent px-1 text-2xl font-[800] tracking-[-0.03em] text-[#0E1116] outline-none transition focus:border-[#E1261C]"
          />
          <p className="mt-2 text-xs font-medium text-[#6B7280]">Electronic signature · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
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
          <div className="mt-auto pt-6">
            <button onClick={onDraft} disabled={!canDraft} className={`${pillPrimary} w-full`}>
              Draft my requests <ArrowRight size={18} />
            </button>
            {autoDraft && canDraft && (
              // Demo: always on screen, wherever the form is scrolled. Click to go now.
              <button
                onClick={onDraft}
                className="anim-rise fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden rounded-2xl bg-[#0E1116] px-5 py-4 text-left text-white shadow-[0_24px_60px_-20px_rgba(14,17,22,0.6)]"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-lg font-[800] tracking-[-0.02em]">Drafting {c.links.length} requests…</span>
                  <span className="text-xs font-medium text-white/60">Click to go now</span>
                </span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                  <span
                    className="anim-fill block h-full bg-[#FF6B62]"
                    style={{ ["--fill-ms" as string]: "2200ms" }}
                    onAnimationEnd={onDraft}
                  />
                </span>
              </button>
            )}
            {!canDraft && !drafting && (
              <p className="mt-3 text-center text-xs leading-relaxed text-[#6B7280]">
                {checking.size > 0 ? "Still finding removal channels…" : !idVerified ? "Verify your identity in the details section before drafting." : "Add your name, email and at least one link, then tick the statement and sign."}
              </p>
            )}
          </div>
        </div>
      </section>

      <PrivacyCard className="mt-5 xl:hidden" />
    </div>
  );
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-[#E5E7EB] py-4 first:pt-0">
      <span>
        <span className="block text-[15px] font-bold text-[#0E1116]">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-[#6B7280]">{text}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-[#E5E7EB] transition-colors peer-checked:bg-[#E1261C] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#E1261C]" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
