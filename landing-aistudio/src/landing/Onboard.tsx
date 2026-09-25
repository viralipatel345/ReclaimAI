import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Link2, LogOut, Phone, Search, ShieldCheck, X } from 'lucide-react';
import PLATFORMS from '@data/platforms.json';
import { GmailConnect } from './GmailConnect';
import { IdentityVerifier } from './IdentityVerifier';

// Branded onboarding for the real app's intake (app/case/page.tsx), one question per
// screen, link first. Same gate: adults only, a name, a valid email, at least one link,
// and identity verified before anything is drafted. Minors are routed to NCMEC and
// nothing is kept, matching lib/ageGate.ts.

const EASE = [0.2, 0.7, 0.2, 1] as const;
const display = 'font-[800] tracking-[-0.04em]';
const KEY = 'reclaim.start.draft';

type Platform = { id: string; name: string; hosts: string[]; channel: string; coveredByAct?: boolean; fictional?: boolean };
const DIRECTORY = PLATFORMS as Platform[];

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

/** Directory lookup, same hosts the app uses. Unknown hosts are looked up with Google Search in the app. */
function resolve(raw: string): { name: string; covered: boolean; channel: string; nameSearch?: boolean } | 'unknown' | null {
  if (/\s/.test(raw.trim())) return null;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (!host.includes('.')) return null;
  if (host === 'google.com' && u.pathname.startsWith('/search')) return { name: 'Google Search', covered: false, channel: 'form', nameSearch: true };
  const p = DIRECTORY.find((x) => !x.fictional && x.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return p ? { name: p.name, covered: !!p.coveredByAct, channel: p.channel } : 'unknown';
}

type Draft = { age: 'adult' | null; links: string[]; wantNameSearch: boolean; name: string; email: string };
const EMPTY: Draft = { age: null, links: [], wantNameSearch: false, name: '', email: '' };

function load(): Draft {
  try { const s = localStorage.getItem(KEY); return s ? { ...EMPTY, ...JSON.parse(s) } : EMPTY; } catch { return EMPTY; }
}

function Header({ onQuickExit, step }: { onQuickExit: () => void; step: number }) {
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
        <div className="flex items-center gap-3">
          {step > 0 && <span className="text-sm text-[#6B7280]">{step} of 4</span>}
          <button onClick={onQuickExit} className="flex h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold hover:bg-black/[0.04]">
            <LogOut size={15} /> Quick exit <kbd className="rounded bg-black/[0.06] px-1.5 text-[11px] font-medium text-[#6B7280]">Esc</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}

const Screen = ({ children, k }: { children: React.ReactNode; k: string }) => (
  <motion.section key={k} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: EASE }} className="mx-auto w-full max-w-[640px] px-5 py-14 md:px-8 md:py-20">
    {children}
  </motion.section>
);

const Back = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#0E1116]"><ArrowLeft size={15} /> Back</button>
);

const Next = ({ onClick, disabled, children = 'Next' }: { onClick: () => void; disabled?: boolean; children?: React.ReactNode }) => (
  <button onClick={onClick} disabled={disabled} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0E1116] px-7 py-3.5 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-30">
    {children} <ArrowRight size={18} />
  </button>
);

export function Onboard({ onQuickExit }: { onQuickExit: () => void }) {
  const [d, setD] = useState<Draft>(load);
  const [minor, setMinor] = useState(false);
  const [step, setStep] = useState(() => (load().age ? 1 : 0));
  const [idVerified, setIdVerified] = useState(false); // never persisted: verify each session
  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const up = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} }, [d]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email);
  const hasLinks = d.links.length > 0 || d.wantNameSearch;
  const canDraft = d.name.trim().length >= 2 && emailOk && hasLinks && idVerified;
  const resolved = useMemo(() => d.links.map((u) => ({ url: u, r: resolve(u) })), [d.links]);

  const addLink = () => {
    const v = link.trim();
    if (!v) return;
    if (resolve(v) === null) { setLinkErr('That doesn’t look like a web link. Try copying it from the address bar.'); return; }
    setLinkErr(''); up({ links: [...d.links, v] }); setLink('');
  };

  if (minor) {
    return (
      <div className="min-h-screen bg-white font-['Plus_Jakarta_Sans',sans-serif] text-[#0E1116] antialiased">
        <Header onQuickExit={onQuickExit} step={0} />
        <Screen k="minor">
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#FDECEA] text-[#E1261C]"><ShieldCheck size={28} /></div>
            <h1 className={`${display} mt-6 text-4xl leading-tight`}>There&rsquo;s a place built just for you.</h1>
            <p className="mt-4 text-[#4B5563]">Reclaim is for adults. NCMEC&rsquo;s Take It Down does this for people under 18, free and confidential. Nothing from this visit is kept.</p>
            <a href="https://takeitdown.ncmec.org/" target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-7 py-3.5 font-semibold text-white hover:bg-[#B3130F]">Go to Take It Down <ArrowRight size={18} /></a>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6B7280]"><Phone size={14} /> Someone to talk to, any hour: <a className="font-semibold text-[#0E1116]" href="tel:18448782274">1-844-878-2274</a></p>
          </div>
        </Screen>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-['Plus_Jakarta_Sans',sans-serif] text-[#0E1116] antialiased">
      <Header onQuickExit={onQuickExit} step={step} />
      <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.10),transparent)]" />
      <AnimatePresence mode="wait">
        {step === 0 && (
          <Screen k="age">
            <h1 className={`${display} text-4xl leading-[1.02] md:text-5xl`}>Are you 18 or older?</h1>
            <p className="mt-3 text-[#4B5563]">One question, so we send you to the right place.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button onClick={() => { up({ age: 'adult' }); setStep(1); }} className="rounded-2xl bg-[#0E1116] px-6 py-5 text-left text-lg font-bold text-white hover:bg-black">Yes, I&rsquo;m 18 or older</button>
              <button onClick={() => { try { localStorage.removeItem(KEY); } catch {} setMinor(true); }} className="rounded-2xl border border-black/10 px-6 py-5 text-left text-lg font-bold hover:border-[#E1261C]">No, I&rsquo;m under 18</button>
            </div>
          </Screen>
        )}

        {step === 1 && (
          <Screen k="links">
            <Back onClick={() => setStep(0)} />
            <h1 className={`${display} text-4xl leading-[1.02] md:text-5xl`}>Paste the link.</h1>
            <p className="mt-3 text-[#4B5563]">Only the link. We never ask what it shows.</p>
            <form onSubmit={(e) => { e.preventDefault(); addLink(); }} className="mt-8 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-[0_18px_40px_-20px_rgba(14,17,22,0.35)] ring-1 ring-black/5">
              <Link2 size={20} className="ml-3 shrink-0 text-[#9CA3AF]" />
              <input value={link} onChange={(e) => { setLink(e.target.value); setLinkErr(''); }} placeholder="https://" aria-label="Paste a link" inputMode="url" autoComplete="off" className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9CA3AF]" />
              <button type="submit" className="shrink-0 rounded-full bg-[#E1261C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B3130F]">Add</button>
            </form>
            {linkErr && <p className="mt-2 text-sm text-[#B3130F]">{linkErr}</p>}

            {resolved.length > 0 && (
              <ul className="mt-5 space-y-2">
                {resolved.map(({ url, r }, i) => (
                  <motion.li key={url + i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl bg-[#F5F6F8] px-4 py-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-[#E1261C]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <span className="block text-xs text-[#4B5563]">
                        {r === 'unknown' || r === null ? 'Not in our directory yet. The app looks this one up with Google Search.' : r.nameSearch ? 'Google Search. Handled under Google’s own policy.' : r.covered ? `That’s ${r.name}. It’s covered by the law: 48 hours to take it down.` : `That’s ${r.name}.`}
                      </span>
                    </span>
                    <button onClick={() => up({ links: d.links.filter((_, j) => j !== i) })} className="rounded-lg p-1 text-[#9CA3AF] hover:text-[#0E1116]" aria-label="Remove"><X size={14} /></button>
                  </motion.li>
                ))}
              </ul>
            )}

            <button onClick={() => up({ wantNameSearch: !d.wantNameSearch })} className={`mt-4 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition ${d.wantNameSearch ? 'border-[#E1261C] bg-[#FDECEA]' : 'border-dashed border-black/15 hover:border-[#E1261C]'}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${d.wantNameSearch ? 'bg-[#E1261C] text-white' : 'bg-[#F5F6F8] text-[#6B7280]'}`}>{d.wantNameSearch ? <Check size={13} /> : <Search size={13} />}</span>
              <span><span className="block font-semibold">I don&rsquo;t have a link, but I know it&rsquo;s out there</span><span className="block text-xs text-[#6B7280]">We&rsquo;ll ask Google to remove explicit results for your name. Every result waits for your OK.</span></span>
            </button>

            <Next onClick={() => setStep(2)} disabled={!hasLinks} />
            <p className="mt-6 text-xs text-[#6B7280]">You can close this and come back. Nothing is lost, and nothing is sent until you say so.</p>
          </Screen>
        )}

        {step === 2 && (
          <Screen k="who">
            <Back onClick={() => setStep(1)} />
            <h1 className={`${display} text-4xl leading-[1.02] md:text-5xl`}>Who should the request come from?</h1>
            <p className="mt-3 text-[#4B5563]">The name it&rsquo;s sent under, and where the platform&rsquo;s reply should go.</p>
            <label htmlFor="name" className="mt-8 block text-sm font-semibold">Your name, as it appears on your ID</label>
            <input id="name" value={d.name} onChange={(e) => up({ name: e.target.value })} autoComplete="name" className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[16px] outline-none focus:border-[#E1261C]" />
            <label htmlFor="email" className="mt-5 block text-sm font-semibold">Where replies should go</label>
            <input id="email" type="email" value={d.email} onChange={(e) => up({ email: e.target.value.trim() })} autoComplete="email" inputMode="email" placeholder="A new address just for this is fine" className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[16px] outline-none placeholder:text-[#9CA3AF] focus:border-[#E1261C]" />
            {d.email && !emailOk && <p className="mt-1.5 text-xs text-[#B3130F]">That email doesn&rsquo;t look complete.</p>}
            <div className="mt-5"><GmailConnect onConnected={(email) => up({ email })} /></div>
            <Next onClick={() => setStep(3)} disabled={d.name.trim().length < 2 || !emailOk} />
          </Screen>
        )}

        {step === 3 && (
          <Screen k="you">
            <Back onClick={() => setStep(2)} />
            <p className="flex items-center gap-2 text-sm font-semibold text-[#E1261C]"><ShieldCheck size={16} /> One last thing, and it&rsquo;s for you</p>
            <h1 className={`${display} mt-3 text-4xl leading-[1.02] md:text-5xl`}>Confirm it&rsquo;s you.</h1>
            <p className="mt-4 text-[#4B5563]">So no one can ever use Reclaim against you, we confirm you&rsquo;re the person in the content. A photo of your ID: we read the name, check it matches <span className="font-semibold text-[#0E1116]">{d.name.trim()}</span>, and it&rsquo;s gone. Never kept, never shared.</p>
            <div className="mt-8"><IdentityVerifier claimedName={d.name} onVerified={setIdVerified} /></div>
            {idVerified && <Next onClick={() => setStep(4)}>Almost there</Next>}
          </Screen>
        )}

        {step === 4 && (
          <Screen k="ready">
            <Back onClick={() => setStep(3)} />
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#E7F6EC] text-[#166534]"><Check size={26} strokeWidth={2.5} /></div>
            <h1 className={`${display} mt-6 text-4xl leading-[1.02] md:text-5xl`}>Ready when you are.</h1>
            <p className="mt-4 text-[#4B5563]">{d.links.length + (d.wantNameSearch ? 1 : 0)} request{d.links.length + (d.wantNameSearch ? 1 : 0) === 1 ? '' : 's'}, sent under {d.name.trim()}, replies to {d.email}. You&rsquo;ll read every one before it goes.</p>
            <ul className="mt-6 space-y-2 text-sm">
              {resolved.map(({ url, r }, i) => <li key={i} className="flex items-center gap-2 rounded-2xl bg-[#F5F6F8] px-4 py-3"><Check size={14} className="shrink-0 text-[#E1261C]" /><span className="truncate">{r && r !== 'unknown' ? r.name : url}</span></li>)}
              {d.wantNameSearch && <li className="flex items-center gap-2 rounded-2xl bg-[#F5F6F8] px-4 py-3"><Check size={14} className="shrink-0 text-[#E1261C]" />Google results for your name</li>}
            </ul>
            <button disabled={!canDraft} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-7 py-3.5 font-semibold text-white shadow-[0_12px_28px_-10px_rgba(225,38,28,0.8)] hover:bg-[#B3130F] disabled:opacity-30">Draft my requests <ArrowRight size={18} /></button>
            <p className="mt-4 text-xs text-[#6B7280]">Drafting and sending run in the app. Nothing is sent until you approve each request.</p>
          </Screen>
        )}
      </AnimatePresence>
    </div>
  );
}
