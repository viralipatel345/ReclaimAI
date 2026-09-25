import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import DATA from '@data/demo/reclaim-demo-data.json';
import {
  ArrowRight, Bell, Check, FileText, Lock, LogOut, Phone, RotateCcw, Scale, Search, Send,
  ShieldCheck, Timer, Eye, MailCheck, Link2, Sparkles,
} from 'lucide-react';

// Every claim on this page comes from data/demo/reclaim-demo-data.json, which mirrors the
// real app (README + lib/). Real law, stats, platforms and tools; fictional case.
const CASE = DATA.demoCase;
const FINDINGS = CASE.findings;
const REAL_PLATFORMS = DATA.platforms.filter((p) => !p.fictional && p.link);
const STAT = (v: string) => DATA.stats.find((x) => x.value === v)!;
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) || '#try';
const statusTone = (st: string) => st === 'Removed' ? 'bg-[#E7F6EC] text-[#166534]' : st === 'Overdue' ? 'bg-[#0E1116] text-white' : 'bg-[#FDECEA] text-[#B3130F]';

// Brand: white ground, ink #0E1116, one bright red #E1261C (deep #B3130F), heavy Plus Jakarta Sans.
const EASE = [0.2, 0.7, 0.2, 1] as const;
const display = 'font-[800] tracking-[-0.04em]';
const eyebrow = 'flex items-center gap-3 text-sm font-semibold text-[#6B7280]';
const Rule = () => <span className="h-px w-8 bg-[#E1261C]" />;

// Logo: return shield (protection + taking it back).
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

function hms(ms: number) {
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Live clock to a deadline; counts up with + once it has passed (same as the app's Countdown). */
function Clock({ deadline, className = '' }: { deadline: number; className?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = deadline - now;
  return <span className={`font-mono tabular-nums ${className}`}>{diff >= 0 ? hms(diff) : `+${hms(-diff)}`}</span>;
}

function Header({ onQuickExit }: { onQuickExit: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 md:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <Mark size={32} />
          <span className="leading-none">
            <span className="block text-[19px] font-[800] tracking-[-0.03em]">Reclaim</span>
            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#6B7280]">Deepfake takedown agent</span>
          </span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[#4B5563] md:flex">
          <a href="#how" className="hover:text-[#0E1116]">How it works</a>
          <a href="#never" className="hover:text-[#0E1116]">What it never does</a>
          <a href="#try" className="hover:text-[#0E1116]">Try it</a>
          <a href="#agents" className="hover:text-[#0E1116]">Agents</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onQuickExit} className="flex h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold hover:bg-black/[0.04]">
            <LogOut size={15} /> Quick exit <kbd className="rounded bg-black/[0.06] px-1.5 text-[11px] font-medium text-[#6B7280]">Esc</kbd>
          </button>
          <a href={APP_URL} className="hidden h-10 items-center rounded-full bg-[#E1261C] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(225,38,28,0.7)] hover:bg-[#B3130F] sm:flex">Start with a link</a>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero phone: the real flow, one link in ---------- */

type Bubble = { from: 'ai' | 'me'; text: string; card?: 'platform' | 'request' | 'clock' };
const REDDIT = FINDINGS[0];
const SCRIPT: Bubble[] = [
  { from: 'ai', text: 'Paste a link. That’s all I need.' },
  { from: 'me', text: REDDIT.url.replace('https://www.', '') },
  { from: 'ai', text: `That’s ${REDDIT.platform}. It’s covered by the TAKE IT DOWN Act, and I found their removal ${REDDIT.channel}.`, card: 'platform' },
  { from: 'ai', text: 'Your request is ready.', card: 'request' },
  { from: 'me', text: 'send it' },
  { from: 'ai', text: 'Sent. 48 hours on the clock. I’ll remind them at 24h and 44h, and re-check every 3 days.', card: 'clock' },
];

function PhoneChat() {
  const [n, setN] = useState(0);
  const [typing, setTyping] = useState(false);
  const sentAt = useRef(Date.now());
  useEffect(() => {
    if (n >= SCRIPT.length) {
      const t = setTimeout(() => { setN(0); sentAt.current = Date.now(); }, 6000);
      return () => clearTimeout(t);
    }
    const next = SCRIPT[n];
    setTyping(next.from === 'ai');
    if (next.card === 'clock') sentAt.current = Date.now() + 1900;
    const t = setTimeout(() => { setTyping(false); setN((x) => x + 1); }, next.from === 'ai' ? 1900 : 1300);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <div className="relative mx-auto w-[300px] rounded-[48px] bg-[#0E1116] p-[10px] shadow-[0_40px_80px_-30px_rgba(14,17,22,0.55)]">
      <div className="relative h-[600px] overflow-hidden rounded-[40px] bg-[#F7F7F8]">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[140%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.55),transparent)]" />
        <div className="relative flex items-center justify-between px-6 pt-4 text-[11px] font-semibold"><span>9:41</span><span className="h-5 w-20 rounded-full bg-[#0E1116]" /><span>100%</span></div>
        <div className="relative mt-5 flex flex-col items-center">
          <Mark size={44} />
          <p className="mt-2 text-sm font-[800]">Reclaim</p>
          <p className="text-[11px] text-[#6B7280]">Links only · never stored</p>
        </div>
        <div className="relative mt-4 flex flex-col gap-2 px-4 text-[12.5px] leading-snug">
          <AnimatePresence initial={false}>
            {SCRIPT.slice(0, n).map((b, i) => (
              <motion.div key={i} layout initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.35, ease: EASE }}
                className={b.from === 'me' ? 'self-end max-w-[82%] break-all rounded-2xl rounded-br-md bg-[#E1261C] px-3 py-2 text-white' : 'self-start max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]'}>
                {b.text}
                {b.card === 'platform' && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#FDECEA] px-2.5 py-1.5 text-[11px] font-semibold text-[#B3130F]"><Check size={12} /> {REDDIT.platform} · covered · {REDDIT.channel}</div>
                )}
                {b.card === 'request' && (
                  <div className="mt-2 rounded-xl border border-black/5 p-2 text-[10.5px] leading-tight">
                    {['1. Identification of the content', '2. Good-faith statement', '3. Obligation under the Act', '4. Contact', '5. Signature  /s/ Jordan Ellis'].map((l) => <div key={l} className="py-0.5">{l}</div>)}
                  </div>
                )}
                {b.card === 'clock' && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-[#0E1116] px-2.5 py-2 text-white"><span className="text-[10.5px] font-semibold">{REDDIT.platform}</span><Clock deadline={sentAt.current + 48 * 3600e3} className="text-[13px] font-semibold" /></div>
                )}
              </motion.div>
            ))}
            {typing && (
              <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="self-start flex gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {[0, 1, 2].map((d) => <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-[#9CA3AF]" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: d * 0.15 }} />)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <a href="#try" className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[12px] text-[#9CA3AF] shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:text-[#4B5563]">
          <Link2 size={14} /> Paste a link <span className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-[#E1261C] text-white"><ArrowRight size={14} /></span>
        </a>
      </div>
    </div>
  );
}

function FloatCard({ className, delay, icon, title, text }: { className: string; delay: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: [0, -8, 0], scale: 1 }}
      transition={{ opacity: { delay, duration: 0.5 }, scale: { delay, duration: 0.5 }, y: { delay: delay + 0.5, duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
      className={`absolute z-10 hidden w-[230px] items-start gap-3 rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_-16px_rgba(14,17,22,0.3)] lg:flex ${className}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FDECEA] text-[#E1261C]">{icon}</span>
      <span><span className="block text-[13px] font-bold">{title}</span><span className="block text-[11.5px] leading-snug text-[#6B7280]">{text}</span></span>
    </motion.div>
  );
}

function Hero() {
  const points = [
    { icon: <FileText size={16} />, title: 'Writes the legal request', text: 'Every element the TAKE IT DOWN Act requires, signed by you. Gemini only writes the greeting.' },
    { icon: <Timer size={16} />, title: 'Holds them to 48 hours', text: 'Reminders at 24h and 44h. Miss the deadline and an FTC complaint is drafted from the evidence log.' },
    { icon: <RotateCcw size={16} />, title: 'Keeps checking', text: 'Every 3 days, text only. If it comes back, it is re-filed automatically, citing the original request.' },
  ];
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.14),transparent)]" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-14 pt-10 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
          <h1 className={`${display} text-[56px] leading-[0.95] md:text-[88px]`}>Take it down.<br /><span className="text-[#E1261C]">Take it back.</span></h1>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#6B7280]"><span className="h-2 w-2 rounded-full bg-[#E1261C]" /> For adult survivors of deepfakes and leaked images</div>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[#4B5563]">
            99% of deepfake porn depicts women, and most never report it. Paste a link once. Reclaim writes the legal request, sends it with your signature, starts the 48-hour clock, and chases the platform until it&rsquo;s gone.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <motion.a href={APP_URL} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="group inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-7 py-3.5 font-semibold text-white shadow-[0_12px_28px_-10px_rgba(225,38,28,0.8)] hover:bg-[#B3130F]">
              Start with a link <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </motion.a>
            <a href="#how" className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 font-semibold text-[#0E1116] hover:bg-black/[0.04]">See how it works</a>
          </div>
          <ul className="mt-8 grid gap-3">
            {points.map((p, i) => (
              <motion.li key={p.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease: EASE }} className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 text-[#0E1116]">{p.icon}</span>
                <span><span className="block font-bold">{p.title}</span><span className="block text-sm text-[#6B7280]">{p.text}</span></span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease: EASE }} className="relative">
          <FloatCard className="-left-10 top-24" delay={4.2} icon={<Search size={15} />} title="Platform found" text={`${REDDIT.platform}, covered by the Act. Removal ${REDDIT.channel} located.`} />
          <FloatCard className="-right-8 top-[44%]" delay={9.5} icon={<Send size={15} />} title="Request sent" text="Signed. 48-hour legal clock started." />
          <FloatCard className="bottom-16 -left-8" delay={12.5} icon={<Check size={15} />} title={`${REDDIT.platform} removed it`} text={REDDIT.detail} />
          <PhoneChat />
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Process: the app's five steps ---------- */

const STEPS = DATA.flow;
const SECTIONS = ['1. Identification of the content', '2. Good-faith statement of non-consent', '3. Your obligation under the TAKE IT DOWN Act', '4. Contact information', '5. Signature'];

function StepPanel({ i, go }: { i: number; go: (n: number) => void }) {
  const row = 'flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]';
  const field = (label: string, value: string) => (
    <label key={label} className="block"><span className="text-xs font-semibold text-[#6B7280]">{label}</span><span className="mt-1 block rounded-xl bg-white px-3 py-2.5 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.05)]">{value}</span></label>
  );
  if (i === 0) return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field('Full name', CASE.survivor)}{field('Email for replies', 'jordan@example.com')}
      <div className="sm:col-span-2">{field('Paste a link', FINDINGS[0].url)}</div>
      <p className="text-xs text-[#6B7280] sm:col-span-2">Nothing asks what the images show. An unknown site is looked up with Google Search, hostname only.</p>
    </div>
  );
  if (i === 1) return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between"><p className="font-bold">Request · {FINDINGS[0].platform}</p><span className="rounded-full bg-[#FDECEA] px-2.5 py-1 text-[11px] font-semibold text-[#B3130F]">Covered by the Act</span></div>
      <p className="mt-3 text-sm italic text-[#4B5563]">Hello Reddit Trust &amp; Safety team, I&rsquo;m writing to ask you to remove content of me that was shared without my consent.</p>
      <ul className="mt-3 space-y-1.5">{SECTIONS.map((x) => <li key={x} className="flex items-center gap-2 text-sm"><Check size={14} className="shrink-0 text-[#E1261C]" />{x}</li>)}</ul>
      <p className="mt-3 text-xs text-[#6B7280]">The greeting is Gemini&rsquo;s. Sections 1 to 5 are fixed legal text. Signed /s/ {CASE.survivor}.</p>
    </div>
  );
  if (i === 2) return (
    <div className="space-y-3">
      {FINDINGS.map((f, n) => (
        <motion.div key={f.platform} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.1 }} className={row}>
          <span><span className="block font-semibold">{f.platform}</span><span className="block text-xs text-[#6B7280]">{f.channel === 'email' ? 'Email opens, ready to send' : 'Form opens, fields ready to paste'}</span></span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#FDECEA] px-3 py-1 text-xs font-semibold text-[#B3130F]">{f.channel === 'email' ? <MailCheck size={13} /> : <FileText size={13} />}{f.channel}</span>
        </motion.div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => go(3)} className="inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B3130F]"><Send size={14} /> Send all {FINDINGS.length}</button>
        <button onClick={() => go(1)} className="rounded-full px-4 py-2 text-sm font-semibold text-[#4B5563] hover:bg-black/[0.04]">Review each first</button>
      </div>
      <p className="text-xs text-[#6B7280]">Reclaim never logs in, never submits a form for you, never contacts the uploader.</p>
    </div>
  );
  if (i === 3) return <TrackPanel />;
  return (
    <ol className="space-y-2">
      {[...CASE.timeline.slice(3), ...CASE.fastForward].map((e, n) => (
        <motion.li key={n} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.08 }} className="flex gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <span className="w-14 shrink-0 font-mono text-xs font-semibold text-[#B3130F]">{e.t}</span><span className="text-sm">{e.event}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function TrackPanel() {
  const base = useRef(Date.now()).current;
  const dl: Record<string, number> = { Sent: base + 31.2 * 3600e3, Acknowledged: base + 40.6 * 3600e3, Overdue: base - 3.1 * 3600e3 };
  return (
    <div className="space-y-3">
      {FINDINGS.map((f) => (
        <div key={f.platform} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <span><span className="block font-semibold">{f.platform}</span><span className="block text-xs text-[#6B7280]">{f.detail}</span></span>
          <span className="flex shrink-0 items-center gap-3">
            {dl[f.status] !== undefined && <Clock deadline={dl[f.status]} className={`text-sm ${f.status === 'Overdue' ? 'text-[#B3130F]' : 'text-[#4B5563]'}`} />}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(f.status)}`}>{f.status}</span>
          </span>
        </div>
      ))}
      <p className="text-xs text-[#6B7280]">A + clock means the deadline passed. The FTC complaint is drafted and waiting for her review.</p>
    </div>
  );
}

function Process() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const open = (e: Event) => { setI((e as CustomEvent<number>).detail); setPaused(true); };
    window.addEventListener('reclaim:step', open);
    return () => window.removeEventListener('reclaim:step', open);
  }, []);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % STEPS.length), 5000);
    return () => clearTimeout(t);
  }, [i, paused]);
  return (
    <section id="how" className="bg-[#F5F6F8] py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className={eyebrow}><Rule />How it works</p>
        <h2 className={`${display} mt-3 max-w-[16ch] text-4xl leading-[1.02] md:text-6xl`}>{DATA.tagline}</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <ol className="space-y-2" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {STEPS.map((s, n) => (
              <li key={s.n}>
                <button onClick={() => setI(n)} className={`relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition ${n === i ? 'bg-white shadow-[0_12px_30px_-16px_rgba(14,17,22,0.35)]' : 'hover:bg-white/60'}`}>
                  <span className="flex items-center gap-4">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-[800] ${n === i ? 'bg-[#E1261C] text-white' : n < i ? 'bg-[#0E1116] text-white' : 'bg-white text-[#9CA3AF]'}`}>{n < i ? <Check size={15} /> : n + 1}</span>
                    <span><span className="block text-lg font-[800] tracking-[-0.02em]">{s.title}</span>{n === i && <span className="mt-0.5 block text-sm text-[#4B5563]">{s.text}</span>}</span>
                  </span>
                  {n === i && !paused && <motion.span key={i} className="absolute bottom-0 left-0 h-[3px] bg-[#E1261C]" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 5, ease: 'linear' }} />}
                </button>
              </li>
            ))}
          </ol>
          <div className="relative min-h-[360px] overflow-hidden rounded-[32px] bg-[#EDEEF1] p-6 md:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.18),transparent)]" />
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: EASE }} className="relative">
                <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#4B5563]"><Sparkles size={15} className="text-[#E1261C]" /> Step {STEPS[i].n} · {STEPS[i].title}</p>
                <StepPanel i={i} go={(n) => { setI(n); setPaused(true); }} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- What it never does (enforced by tests) ---------- */

const SAFETY_ICONS = [<Link2 key="a" size={18} />, <Eye key="b" size={18} />, <Lock key="c" size={18} />, <ShieldCheck key="d" size={18} />, <FileText key="e" size={18} />, <LogOut key="f" size={18} />];

function Never() {
  return (
    <section id="never" className="py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className={eyebrow}><Rule />What it never does</p>
        <h2 className={`${display} mt-3 max-w-[20ch] text-4xl leading-[1.02] md:text-6xl`}>It never sees an image. That is the whole design.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DATA.safety.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.07, duration: 0.6, ease: EASE }} className="rounded-3xl bg-[#F5F6F8] p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#E1261C]">{SAFETY_ICONS[i]}</span>
              <p className="mt-5 text-xl font-[800] tracking-[-0.02em]">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">{s.text}</p>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-[#4B5563]"><Check size={14} className="text-[#E1261C]" /> {DATA.tests} tests. The ones that matter prove no code path can store image bytes.</p>
      </div>
    </section>
  );
}

/* ---------- Try it: paste a link, see the request and the clock ---------- */

function TryIt() {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [phase, setPhase] = useState<'idle' | 'resolve' | 'ready' | 'sent'>('idle');
  const [sentAt, setSentAt] = useState(0);
  const match = FINDINGS.find((f) => text.includes(f.url.replace('https://www.', '').split('/')[0])) ?? FINDINGS[0];
  const run = (q?: string) => {
    const v = (q ?? text).trim();
    if (!v) { setErr('Paste a link first, or tap an example.'); return; }
    setText(v); setErr(''); setPhase('resolve');
    setTimeout(() => setPhase('ready'), 2200);
  };
  return (
    <section id="try" className="relative overflow-hidden bg-[#F5F6F8] py-16">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.14),transparent)]" />
      <div className="relative mx-auto max-w-[760px] px-5 text-center">
        <div className="flex justify-center"><Mark size={52} /></div>
        <h2 className={`${display} mt-6 text-4xl leading-[1.02] md:text-6xl`}>Paste a link.</h2>
        <p className="mt-4 text-[#4B5563]">This is a demo. Nothing is looked up or sent. Example links only.</p>
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mt-8 rounded-[28px] bg-white p-3 text-left shadow-[0_24px_60px_-28px_rgba(14,17,22,0.35)]">
          <div className="flex items-center gap-2">
            <Link2 size={20} className="ml-3 shrink-0 text-[#9CA3AF]" />
            <input value={text} onChange={(e) => { setText(e.target.value); setErr(''); if (phase !== 'idle') setPhase('idle'); }} placeholder="Paste a link" className="h-12 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9CA3AF]" aria-label="Paste a link" inputMode="url" />
            <button type="submit" className="grid h-12 w-12 place-items-center rounded-full bg-[#E1261C] text-white hover:bg-[#B3130F]" aria-label="Look up"><ArrowRight size={20} /></button>
          </div>
        </form>
        {err && <p className="mt-2 text-left text-sm text-[#B3130F]">{err}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {FINDINGS.map((f) => (
            <button key={f.platform} onClick={() => run(f.url)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:border-[#E1261C] hover:text-[#B3130F]">{f.platform} example</button>
          ))}
        </div>
        <>
          {phase === 'resolve' && (
            <motion.div key="resolve" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-3xl bg-white p-6 text-left">
              <p className="flex items-center gap-2 font-semibold"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}><Search size={16} className="text-[#E1261C]" /></motion.span> Looking up the platform, hostname only</p>
              <div className="mt-4 space-y-3">
                {['Which platform is this', 'Is it covered by the Act', 'Where do removal requests go'].map((m, n) => (
                  <div key={m} className="flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{m}</span><span className="h-1.5 w-32 overflow-hidden rounded-full bg-[#F5F6F8]"><motion.span className="block h-full bg-[#E1261C]" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.7, delay: n * 0.6, ease: EASE }} /></span></div>
                ))}
              </div>
            </motion.div>
          )}
          {(phase === 'ready' || phase === 'sent') && (
            <motion.div key="ready" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-3xl bg-white p-6 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-[800]">{match.platform} <span className="ml-2 rounded-full bg-[#FDECEA] px-2.5 py-1 align-middle text-[11px] font-semibold text-[#B3130F]">{match.platform === 'Google Search' ? 'Google policy' : 'Covered by the Act'} · {match.channel}</span></p>
                <span className="rounded-full bg-[#F5F6F8] px-3 py-1 text-xs font-semibold text-[#6B7280]">Example case · {CASE.survivor} is fictional</span>
              </div>
              <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">{SECTIONS.map((x) => <li key={x} className="flex items-center gap-2 text-sm"><Check size={14} className="shrink-0 text-[#E1261C]" />{x}</li>)}</ul>
              {phase === 'ready' ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => { setSentAt(Date.now()); setPhase('sent'); }} className="inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B3130F]"><Send size={14} /> Send and start the clock</button>
                  <a href="#how" onClick={() => window.dispatchEvent(new CustomEvent('reclaim:step', { detail: 1 }))} className="rounded-full px-4 py-2 text-sm font-semibold text-[#4B5563] hover:bg-black/[0.04]">See the full request</a>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0E1116] px-5 py-4 text-white">
                  <span><span className="block text-xs font-semibold text-white/60">Request sent · demo, nothing left this page</span><span className="block text-sm font-semibold">{match.platform} has 48 hours by law</span></span>
                  <Clock deadline={sentAt + 48 * 3600e3} className="text-2xl font-[800] text-[#FF6B62]" />
                </motion.div>
              )}
              {phase === 'sent' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href="#how" onClick={() => window.dispatchEvent(new CustomEvent('reclaim:step', { detail: 3 }))} className="rounded-full bg-[#F5F6F8] px-4 py-2 text-sm font-semibold hover:text-[#B3130F]">What happens next</a>
                  <a href="tel:18448782274" className="rounded-full bg-[#F5F6F8] px-4 py-2 text-sm font-semibold hover:text-[#B3130F]">Call a helpline</a>
                  <button onClick={() => { setPhase('idle'); setText(''); }} className="rounded-full px-4 py-2 text-sm font-semibold text-[#4B5563]">Start over</button>
                </div>
              )}
            </motion.div>
          )}
        </>
      </div>
    </section>
  );
}

/* ---------- Agents: the real Gemini tools ---------- */

const TOOL_ICONS = [<Search key="a" size={18} />, <FileText key="b" size={18} />, <Timer key="c" size={18} />, <RotateCcw key="d" size={18} />, <MailCheck key="e" size={18} />, <Eye key="f" size={18} />];

function AgentCard({ a, i }: { a: (typeof DATA.tools)[number]; i: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const cycle = () => { setOn(true); setTimeout(() => setOn(false), 1400); };
    const first = setTimeout(cycle, 600 + i * 1500);
    const loop = setInterval(cycle, DATA.tools.length * 1500);
    return () => { clearTimeout(first); clearInterval(loop); };
  }, [i]);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.08, duration: 0.6, ease: EASE }} whileHover={{ y: -4 }}
      className={`rounded-3xl bg-white p-6 transition-all duration-500 ${on ? 'shadow-[0_20px_40px_-20px_rgba(225,38,28,0.45)] ring-2 ring-[#E1261C]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-2 ring-transparent'}`}>
      <div className="flex items-center justify-between">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl transition-colors duration-500 ${on ? 'bg-[#E1261C] text-white' : 'bg-[#FDECEA] text-[#E1261C]'}`}>{TOOL_ICONS[i]}</span>
        {'sandbox' in a && a.sandbox && <span className="rounded-full bg-[#0E1116] px-2.5 py-1 text-[11px] font-semibold text-white">Demo sandbox</span>}
      </div>
      <p className="mt-5 text-xl font-[800] tracking-[-0.02em]">{a.name}</p>
      <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF]">{a.tool}</p>
      <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">{a.does}</p>
      <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-[#B3130F]"><Lock size={12} className="mt-0.5 shrink-0" />{a.never}</p>
    </motion.div>
  );
}

function Agents() {
  return (
    <section id="agents" className="py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className={eyebrow}><Rule />Your team</p>
        <h2 className={`${display} mt-3 max-w-[18ch] text-4xl leading-[1.02] md:text-6xl`}>Six agents. Each one sees as little as possible.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{DATA.tools.map((a, i) => <AgentCard key={a.name} a={a} i={i} />)}</div>
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-semibold text-[#6B7280]">Built on</span>
          {DATA.stack.map((s) => <span key={s} className="rounded-full border border-black/10 px-3.5 py-1.5 text-sm font-semibold">{s}</span>)}
        </div>
      </div>
    </section>
  );
}

/* ---------- Where requests go ---------- */

function WhereItGoes() {
  return (
    <section className="bg-[#F5F6F8] py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className={eyebrow}><Rule />Where requests go</p>
        <h2 className={`${display} mt-3 max-w-[20ch] text-4xl leading-[1.02] md:text-6xl`}>Straight to each platform&rsquo;s own removal channel.</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {REAL_PLATFORMS.map((p, i) => (
            <motion.a key={p.id} href={p.link!} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 font-semibold hover:border-[#E1261C] hover:text-[#B3130F]">
              {p.name}<span className="text-xs font-medium text-[#6B7280]">{p.linkType}</span>
            </motion.a>
          ))}
        </div>
        <p className="mt-5 text-sm text-[#6B7280]">Every link above was checked on 25 Sep 2026. Some platforms send you to a help page first, then the form.</p>
      </div>
    </section>
  );
}

/* ---------- Stats + closing ---------- */

function CountUp({ value }: { value: string }) {
  const m = value.match(/^([^\d]*)(\d[\d,]*)(.*)$/);
  const [shown, setShown] = useState<number | string>(m ? 0 : value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!m || !ref.current) return;
    const target = parseInt(m[2].replace(/,/g, ''), 10);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => { const k = Math.min(1, (t - start) / 1200); setShown(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [value]);
  if (!m) return <span>{value}</span>;
  return <span ref={ref}>{m[1]}{typeof shown === 'number' ? shown.toLocaleString() : shown}{m[3]}</span>;
}

function Stats() {
  return (
    <section className="bg-[#0E1116] py-20 text-white">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        {['98%', '99%', '4%', '48h'].map((v) => [v, STAT(v).text + '.']).map(([n, t]) => (
          <motion.div key={n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }}>
            <p className={`${display} text-6xl text-[#E1261C] md:text-7xl`}><CountUp value={n} /></p>
            <p className="mt-3 max-w-[30ch] text-white/70">{t}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="relative overflow-hidden bg-[#E1261C] py-16 text-white">
      <motion.div aria-hidden animate={{ x: [0, -40, 0], y: [0, 20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} className="pointer-events-none absolute -right-24 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,120,110,0.55),transparent)]" />
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-start gap-8 px-5 md:flex-row md:items-end md:justify-between md:px-8">
        <h2 className={`${display} max-w-[14ch] text-5xl leading-[0.98] md:text-7xl`}>One link to start. You stay in control.</h2>
        <div className="flex flex-col gap-4">
          <a href={APP_URL} className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#E1261C] transition hover:-translate-y-0.5">Start with a link <ArrowRight size={18} /></a>
          <p className="flex items-center gap-2 text-sm text-white/85"><Lock size={14} /> Nothing sends without your signature · Links only · Esc to leave</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-5 py-8 text-sm text-[#6B7280] md:flex-row md:items-center md:justify-between md:px-8">
        <p className="flex items-center gap-2"><Mark size={22} /> Not legal advice. Reclaim prepares requests you send.</p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-2"><Phone size={14} /> CCRI helpline, 24/7: <a className="font-semibold text-[#0E1116]" href="tel:18448782274">1-844-878-2274</a></span>
          <a className="font-semibold text-[#0E1116] hover:text-[#B3130F]" href="https://stopncii.org/" target="_blank" rel="noopener noreferrer">StopNCII</a>
          <a className="font-semibold text-[#0E1116] hover:text-[#B3130F]" href="https://takeitdown.ncmec.org/" target="_blank" rel="noopener noreferrer">Under 18? NCMEC Take It Down</a>
        </p>
      </div>
    </footer>
  );
}

export function Landing({ onQuickExit }: { onQuickExit: () => void }) {
  return (
    <div className="bg-white font-['Plus_Jakarta_Sans',sans-serif] text-[#0E1116] antialiased">
      <Header onQuickExit={onQuickExit} />
      <main><Hero /><Process /><Never /><TryIt /><Agents /><WhereItGoes /><Stats /><Closing /></main>
      <Footer />
    </div>
  );
}
