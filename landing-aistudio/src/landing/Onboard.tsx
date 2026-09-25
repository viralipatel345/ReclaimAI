import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Link2, LogOut, Phone, ShieldCheck } from 'lucide-react';

// Branded onboarding: the app's real age-gate (app/page.tsx) in the red/white system.
// Adult -> shows the link intake (what /case does next). Minor -> stops, points to NCMEC,
// stores nothing, matching lib/ageGate.ts exactly.

const EASE = [0.2, 0.7, 0.2, 1] as const;
const display = 'font-[800] tracking-[-0.04em]';

function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Reclaim" className="shrink-0">
      <rect width="96" height="96" rx="24" fill="#E1261C" />
      <path d="M48 18 L72 27 V47 C72 63 61 73 48 78 C35 73 24 63 24 47 V27 Z" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
      <path d="M58 50 A11 11 0 1 1 49 39 L55 39" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 32 L57 39 L50 46" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PROMISES = [
  { title: 'Links only', text: 'We never see, upload or download images.' },
  { title: 'You approve it', text: 'Every request carries your signature. Nothing goes out without your say.' },
  { title: 'Leave in one tap', text: 'Press Esc or Quick exit on any screen.' },
];

function Header({ onQuickExit }: { onQuickExit: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 md:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <Mark size={32} />
          <span className="leading-none">
            <span className="block text-[19px] font-[800] tracking-[-0.03em]">Reclaim</span>
            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#6B7280]">Deepfake takedown agent</span>
          </span>
        </a>
        <button onClick={onQuickExit} className="flex h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold hover:bg-black/[0.04]">
          <LogOut size={15} /> Quick exit <kbd className="rounded bg-black/[0.06] px-1.5 text-[11px] font-medium text-[#6B7280]">Esc</kbd>
        </button>
      </div>
    </header>
  );
}

function UnderEighteen() {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mx-auto max-w-[640px] px-5 py-20 text-center md:px-8">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#FDECEA] text-[#E1261C]"><ShieldCheck size={28} /></div>
      <h1 className={`${display} mt-6 text-4xl leading-tight`}>This one is for adults. There is still a place for you.</h1>
      <p className="mt-4 text-[#4B5563]">Reclaim is built for adult survivors. Nothing about this visit is saved. NCMEC&rsquo;s Take It Down service exists specifically for people under 18, free and confidential.</p>
      <a href="https://takeitdown.ncmec.org/" target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-7 py-3.5 font-semibold text-white hover:bg-[#B3130F]">
        Go to NCMEC Take It Down <ArrowRight size={18} />
      </a>
      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6B7280]"><Phone size={14} /> CCRI helpline, 24/7: <a className="font-semibold text-[#0E1116]" href="tel:18448782274">1-844-878-2274</a></p>
    </motion.section>
  );
}

function LinkIntake() {
  const [link, setLink] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mx-auto max-w-[640px] px-5 py-14 md:px-8">
      <p className="flex items-center gap-3 text-sm font-semibold text-[#6B7280]"><span className="h-px w-8 bg-[#E1261C]" />Step 01</p>
      <h1 className={`${display} mt-3 text-4xl leading-[1.02] md:text-5xl`}>Tell us where.</h1>
      <p className="mt-3 text-[#4B5563]">Paste every link you have. Nothing asks what the images show.</p>
      <div className="mt-8 rounded-3xl bg-[#F5F6F8] p-6">
        <label htmlFor="link" className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6B7280]">Paste a link</label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white px-4 py-1 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <Link2 size={18} className="shrink-0 text-[#9CA3AF]" />
          <input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#9CA3AF]" inputMode="url" />
          <button
            onClick={() => { const v = link.trim(); if (!v) return; setAdded((a) => [...a, v]); setLink(''); }}
            className="shrink-0 rounded-full bg-[#E1261C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B3130F]"
          >
            Add
          </button>
        </div>
        {added.length > 0 && (
          <ul className="mt-3 space-y-2">
            {added.map((u, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <Check size={14} className="shrink-0 text-[#E1261C]" /><span className="truncate">{u}</span>
              </motion.li>
            ))}
          </ul>
        )}
        <button disabled={added.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0E1116] px-6 py-3.5 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-30">
          Continue to your details <ArrowRight size={18} />
        </button>
        <p className="mt-3 text-center text-xs text-[#6B7280]">This is a preview build. The full flow, drafting and sending, runs in the deployed app.</p>
      </div>
    </motion.section>
  );
}

export function Onboard({ onQuickExit }: { onQuickExit: () => void }) {
  const [age, setAge] = useState<'adult' | 'minor' | null>(null);

  return (
    <div className="min-h-screen bg-white font-['Plus_Jakarta_Sans',sans-serif] text-[#0E1116] antialiased">
      <Header onQuickExit={onQuickExit} />
      {age === 'minor' ? (
        <UnderEighteen />
      ) : age === 'adult' ? (
        <LinkIntake />
      ) : (
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.12),transparent)]" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-14 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:py-20">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
              <p className="flex items-center gap-3 text-sm font-semibold text-[#6B7280]"><span className="h-px w-8 bg-[#E1261C]" />TAKE IT DOWN Act · enforceable since May 19, 2026</p>
              <h1 className={`${display} mt-4 text-[44px] leading-[1.0] md:text-[64px]`}>Platforms have <span className="text-[#E1261C]">48 hours</span> to take it down.</h1>
              <p className="mt-5 max-w-[48ch] text-lg text-[#4B5563]">Share a link once. Reclaim sends the legal request, runs the clock, and escalates to the FTC if they miss it.</p>
              <ul className="mt-9 hidden gap-5 sm:grid sm:grid-cols-3 lg:grid">
                {PROMISES.map((p) => (
                  <li key={p.title} className="border-t border-black/10 pt-4">
                    <p className="font-bold">{p.title}</p>
                    <p className="mt-1 text-sm text-[#6B7280]">{p.text}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: EASE }} className="rounded-3xl bg-[#F5F6F8] p-7 md:p-8">
              <h2 className={`${display} text-2xl`}>Before we start</h2>
              <p className="mt-2 text-sm text-[#4B5563]">Reclaim is for adults. We ask so we can point you to the right help.</p>
              <fieldset className="mt-6 space-y-3">
                <legend className="mb-3 text-sm font-semibold">How old are you?</legend>
                {[{ v: 'adult' as const, label: '18 or older' }, { v: 'minor' as const, label: 'Under 18' }].map((o) => (
                  <label key={o.v} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3.5 transition-colors hover:border-[#E1261C]/40">
                    <input type="radio" name="age" value={o.v} onChange={() => setAge(o.v)} className="h-4 w-4 accent-[#E1261C]" />
                    <span className="text-[15px]">{o.label}</span>
                  </label>
                ))}
              </fieldset>
              <p className="mt-5 text-xs leading-relaxed text-[#6B7280]">Nothing is saved until you add a link. Press Esc at any time to leave this page instantly.</p>
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
}
