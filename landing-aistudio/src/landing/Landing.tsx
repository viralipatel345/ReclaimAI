import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import DATA from '@data/demo/reclaim-demo-data.json';
import {
  ArrowRight, Bell, Check, FileText, Globe, Lock, LogOut, MessageCircle, Phone,
  RotateCcw, Scale, Search, Send, Sparkles, Timer, Route, Fingerprint, ScanSearch, UserCheck, ImagePlus,
} from 'lucide-react';

// Demo content comes from data/demo/reclaim-demo-data.json: real law, stats, platforms; fictional case.
const CASE = DATA.demoCase;
const FINDINGS = CASE.findings;
const REAL_PLATFORMS = DATA.platforms.filter((p) => !p.fictional && p.link);
const STAT = (v: string) => DATA.stats.find((x) => x.value === v)!;
const statusTone = (st: string) => st === 'Removed' ? 'bg-[#E7F6EC] text-[#166534]' : st === 'Overdue' ? 'bg-[#0E1116] text-white' : 'bg-[#FDECEA] text-[#B3130F]';

// Brand: white ground, ink #0E1116, one bright red #E1261C (deep #B3130F), heavy Plus Jakarta Sans.
const EASE = [0.2, 0.7, 0.2, 1] as const;
const display = 'font-[800] tracking-[-0.04em]';

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
          <a href="#try" className="hover:text-[#0E1116]">Try it</a>
          <a href="#agents" className="hover:text-[#0E1116]">Agents</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onQuickExit} className="flex h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold hover:bg-black/[0.04]">
            <LogOut size={15} /> Quick exit <kbd className="rounded bg-black/[0.06] px-1.5 text-[11px] font-medium text-[#6B7280]">Esc</kbd>
          </button>
          <a href="#try" className="hidden h-10 items-center rounded-full bg-[#E1261C] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(225,38,28,0.7)] hover:bg-[#B3130F] sm:flex">Start a chat</a>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero phone: auto-playing AI chat ---------- */

type Bubble = { from: 'ai' | 'me'; text: string; card?: boolean };
const SCRIPT: Bubble[] = [
  { from: 'ai', text: "Hi, I'm Reclaim. Tell me what happened, in your own words." },
  { from: 'me', text: 'someone posted a fake nude of me' },
  { from: 'ai', text: "I'm so sorry. It's not your fault. I'm searching for every copy now." },
  { from: 'ai', text: `Found ${FINDINGS.length} places`, card: true },
  { from: 'me', text: 'take them all down' },
  { from: 'ai', text: 'Sent. Platforms have 48 hours by law. I’ll text you as each one comes down.' },
];

function PhoneChat() {
  const [n, setN] = useState(0);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (n >= SCRIPT.length) {
      const t = setTimeout(() => setN(0), 5200);
      return () => clearTimeout(t);
    }
    const next = SCRIPT[n];
    setTyping(next.from === 'ai');
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
          <p className="text-[11px] text-[#6B7280]">Private · never stored</p>
        </div>
        <div className="relative mt-4 flex flex-col gap-2 px-4 text-[12.5px] leading-snug">
          <AnimatePresence initial={false}>
            {SCRIPT.slice(0, n).map((b, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={b.from === 'me' ? 'self-end max-w-[78%] rounded-2xl rounded-br-md bg-[#E1261C] px-3 py-2 text-white' : 'self-start max-w-[86%] rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]'}
              >
                {b.card ? (
                  <div className="w-[190px]">
                    <p className="mb-1.5 font-semibold">{b.text}</p>
                    {FINDINGS.map((f) => (
                      <div key={f.platform} className="flex justify-between gap-2 border-t border-black/5 py-1 text-[11px]"><span>{f.platform}</span><span className="font-semibold text-[#B3130F]">{f.platform === 'Google Search' ? 'Remove results' : 'Legal request'}</span></div>
                    ))}
                  </div>
                ) : b.text}
              </motion.div>
            ))}
            {typing && (
              <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="self-start flex gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-[#9CA3AF]" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: d * 0.15 }} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <a href="#try" className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[12px] text-[#9CA3AF] shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:text-[#4B5563]">
          Tell me what happened… <span className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-[#E1261C] text-white"><ArrowRight size={14} /></span>
        </a>
      </div>
    </div>
  );
}

function FloatCard({ className, delay, icon, title, text }: { className: string; delay: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: [0, -8, 0], scale: 1 }}
      transition={{ opacity: { delay, duration: 0.5 }, scale: { delay, duration: 0.5 }, y: { delay: delay + 0.5, duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
      className={`absolute z-10 hidden w-[230px] items-start gap-3 rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_-16px_rgba(14,17,22,0.3)] lg:flex ${className}`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FDECEA] text-[#E1261C]">{icon}</span>
      <span>
        <span className="block text-[13px] font-bold">{title}</span>
        <span className="block text-[11.5px] leading-snug text-[#6B7280]">{text}</span>
      </span>
    </motion.div>
  );
}

function Hero() {
  const points = [
    { icon: <Search size={16} />, title: 'Finds every copy', text: 'Forums, image hosts, and search, checked in one pass.' },
    { icon: <Route size={16} />, title: 'Picks the right step', text: 'Platform, police, helpline, or putting the original back.' },
    { icon: <Timer size={16} />, title: 'Holds them to 48 hours', text: 'Missed deadlines go to the FTC, up to $53,088 per violation.' },
  ];
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.14),transparent)]" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-14 pt-10 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
          <h1 className={`${display} text-[56px] leading-[0.95] md:text-[88px]`}>
            Take it down.<br /><span className="text-[#E1261C]">Take it back.</span>
          </h1>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#6B7280]"><span className="h-2 w-2 rounded-full bg-[#E1261C]" /> For survivors of deepfakes and leaked images</div>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[#4B5563]">
            99% of deepfake porn depicts women, and most never report it. Reclaim&rsquo;s agents find every copy and file the legal removal requests for you. By law, platforms then have 48 hours.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <motion.a href="#try" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="group inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-7 py-3.5 font-semibold text-white shadow-[0_12px_28px_-10px_rgba(225,38,28,0.8)] hover:bg-[#B3130F]">
              Start a chat <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </motion.a>
            <a href="#how" className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 font-semibold text-[#0E1116] hover:bg-black/[0.04]">See how it works</a>
          </div>
          <ul className="mt-8 grid gap-3">
            {points.map((p, i) => (
              <motion.li key={p.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease: EASE }} className="flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-black/10 text-[#0E1116]">{p.icon}</span>
                <span>
                  <span className="block font-bold">{p.title}</span>
                  <span className="block text-sm text-[#6B7280]">{p.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease: EASE }} className="relative">
          <FloatCard className="-left-10 top-24" delay={2.6} icon={<Bell size={15} />} title={`${FINDINGS.length} places found`} text={FINDINGS.map((f) => f.platform).join(', ')} />
          <FloatCard className="-right-8 top-[44%]" delay={5.2} icon={<Send size={15} />} title="Requests approved" text="48-hour legal clocks started." />
          <FloatCard className="bottom-16 -left-8" delay={8.4} icon={<Check size={15} />} title="Reddit removed it" text="19h 42m after the request." />
          <PhoneChat />
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Process: interactive stepper ---------- */

const STEPS = [
  { key: 'tell', title: 'Tell', text: 'Chat like you would with a friend. A link helps, but it isn’t required.' },
  { key: 'find', title: 'Find', text: 'The Finder agent searches the web for your image and deepfakes of you.' },
  { key: 'decide', title: 'Decide', text: 'The Triage agent picks one right action for each place it found.' },
  { key: 'act', title: 'Act', text: 'The Filing agent writes the legal requests. Nothing sends until you approve.' },
  { key: 'track', title: 'Track', text: 'The Watcher agent counts down every 48-hour deadline and escalates misses.' },
];

function StepPanel({ k, go }: { k: string; go: (n: number) => void }) {
  const row = 'flex items-center justify-between rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]';
  if (k === 'tell') return (
    <div className="space-y-3">
      <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[#E1261C] px-4 py-2.5 text-white">my ex made a deepfake of me and it&rsquo;s on a forum</div>
      <div className="w-fit max-w-[80%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">Thank you for telling me. Do you have a link? If not, I&rsquo;ll search for you.</div>
    </div>
  );
  if (k === 'find') return (
    <div className="space-y-3">
      {['Forums and discussion boards', 'Image and video hosts', 'Search engines'].map((s, i) => (
        <div key={s} className={row}>
          <span className="flex items-center gap-3 font-semibold"><Globe size={16} className="text-[#E1261C]" />{s}</span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-[#F3F4F6]">
            <motion.span className="block h-full bg-[#E1261C]" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.2, delay: i * 0.35, ease: EASE }} />
          </span>
        </div>
      ))}
    </div>
  );
  if (k === 'decide') return (
    <div className="space-y-3">
      {FINDINGS.map((f, i) => (
        <motion.div key={f.platform} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }} className={row}>
          <span><span className="block font-semibold">{f.platform}</span><span className="block text-xs text-[#6B7280]">{f.where} · found by {f.foundBy.toLowerCase()}</span></span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#FDECEA] px-3 py-1 text-xs font-semibold text-[#B3130F]"><Scale size={14} />{f.action}</span>
        </motion.div>
      ))}
    </div>
  );
  if (k === 'act') return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Ready for your okay</p>
      <p className="mt-2 font-bold">Removal request · {FINDINGS[0].platform}</p>
      <p className="mt-2 text-sm text-[#4B5563]">Every request includes what the TAKE IT DOWN Act requires:</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {DATA.law.validRequestMustInclude.map((x) => (
          <li key={x} className="flex items-start gap-2 text-sm"><Check size={15} className="mt-0.5 shrink-0 text-[#E1261C]" />{x}</li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <button onClick={() => go(4)} className="inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B3130F]"><Check size={15} /> Approve and send</button>
        <button onClick={() => go(2)} className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-[#4B5563] hover:bg-black/[0.04]">Back to the plan</button>
      </div>
    </div>
  );
  return <TrackPanel />;
}

function TrackPanel() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const base = useRef(Date.now()).current;
  const left = (hrs: number) => {
    const ms = Math.max(0, base + hrs * 3600e3 - now);
    const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };
  return (
    <div className="space-y-3">
      {FINDINGS.map((f) => (
        <div key={f.platform} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <span><span className="block font-semibold">{f.platform}</span><span className="block text-xs text-[#6B7280]">{f.detail}</span></span>
          <span className="flex shrink-0 items-center gap-3">
            {f.status === 'Sent' && <span className="font-mono text-sm tabular-nums text-[#4B5563]">{left(31.2)}</span>}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(f.status)}`}>{f.status}</span>
          </span>
        </div>
      ))}
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
    const t = setTimeout(() => setI((x) => (x + 1) % STEPS.length), 4200);
    return () => clearTimeout(t);
  }, [i, paused]);
  return (
    <section id="how" className="bg-[#F5F6F8] py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className="flex items-center gap-3 text-sm font-semibold text-[#6B7280]"><span className="h-px w-8 bg-[#E1261C]" />How it works</p>
        <h2 className={`${display} mt-3 max-w-[16ch] text-4xl leading-[1.02] md:text-6xl`}>Five steps. You make one decision.</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <ol className="space-y-2" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {STEPS.map((s, n) => (
              <li key={s.key}>
                <button onClick={() => setI(n)} className={`relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition ${n === i ? 'bg-white shadow-[0_12px_30px_-16px_rgba(14,17,22,0.35)]' : 'hover:bg-white/60'}`}>
                  <span className="flex items-center gap-4">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-[800] ${n === i ? 'bg-[#E1261C] text-white' : n < i ? 'bg-[#0E1116] text-white' : 'bg-white text-[#9CA3AF]'}`}>{n < i ? <Check size={15} /> : n + 1}</span>
                    <span>
                      <span className="block text-lg font-[800] tracking-[-0.02em]">{s.title}</span>
                      {n === i && <span className="mt-0.5 block text-sm text-[#4B5563]">{s.text}</span>}
                    </span>
                  </span>
                  {n === i && !paused && <motion.span key={i} className="absolute bottom-0 left-0 h-[3px] bg-[#E1261C]" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 4.2, ease: 'linear' }} />}
                </button>
              </li>
            ))}
          </ol>
          <div className="relative min-h-[360px] overflow-hidden rounded-[32px] bg-[#EDEEF1] p-6 md:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.18),transparent)]" />
            <AnimatePresence mode="wait">
              <motion.div key={STEPS[i].key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: EASE }} className="relative">
                <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#4B5563]"><Sparkles size={15} className="text-[#E1261C]" /> Step {i + 1} · {STEPS[i].title}</p>
                <StepPanel k={STEPS[i].key} go={(n) => { setI(n); setPaused(true); }} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- How it searches ---------- */

const METHODS = [
  { icon: <Fingerprint size={20} />, name: 'Fingerprint', where: 'On your phone', finds: 'Exact and near-exact copies', how: 'Your image is turned into a digital fingerprint on your own device. Only the fingerprint is shared with platforms, the same method StopNCII uses. It has created over 434,000 fingerprints for 182,000 people.' },
  { icon: <ScanSearch size={20} />, name: 'Reverse image search', where: 'Google Cloud Vision', finds: 'Copies and edits anywhere public', how: 'Searches the open web for pages showing your image or a close variation. Checked, then deleted. Never stored.' },
  { icon: <UserCheck size={20} />, name: 'Face match', where: 'Verified users only', finds: 'Deepfakes of you', how: 'A deepfake is a new image, so only your face can find it. Face match only runs after you verify it\u2019s you, so no one can search for someone else.' },
];

function HowItSearches() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className="flex items-center gap-3 text-sm font-semibold text-[#6B7280]"><span className="h-px w-8 bg-[#E1261C]" />How it searches</p>
        <h2 className={`${display} mt-3 max-w-[20ch] text-4xl leading-[1.02] md:text-6xl`}>A link finds one copy. Your image finds the rest.</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {METHODS.map((m, i) => (
            <motion.div key={m.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.1, duration: 0.6, ease: EASE }} whileHover={{ y: -4 }} className="rounded-3xl bg-[#F5F6F8] p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#E1261C]">{m.icon}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#4B5563]">{m.where}</span>
              </div>
              <p className="mt-5 text-xl font-[800] tracking-[-0.02em]">{m.name}</p>
              <p className="mt-1 text-sm font-semibold text-[#B3130F]">Finds: {m.finds}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">{m.how}</p>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-[#4B5563]"><Lock size={14} className="text-[#E1261C]" /> Every image is deleted once the search is done. Nothing is stored, and nothing is sent without your okay.</p>
      </div>
    </section>
  );
}

/* ---------- Try it: ask-anything demo ---------- */

const SUGGEST = ['A fake of me is on a forum', 'My photo was leaked', 'Someone is threatening to post'];

function TryIt() {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [phase, setPhase] = useState<'idle' | 'scan' | 'done'>('idle');
  const [file, setFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const run = (q?: string) => {
    const v = (q ?? text).trim();
    if (!v && !file) { setErr('Tell us a little, add a screenshot, or tap an example.'); return; }
    setText(v); setErr(''); setPhase('scan');
    setTimeout(() => setPhase('done'), 3600);
  };
  return (
    <section id="try" className="relative overflow-hidden py-16">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.16),transparent)]" />
      <div className="relative mx-auto max-w-[760px] px-5 text-center">
        <div className="flex justify-center"><Mark size={52} /></div>
        <h2 className={`${display} mt-6 text-4xl leading-[1.02] md:text-6xl`}>What happened?</h2>
        <p className="mt-4 text-[#4B5563]">Try the agent. This is a demo, nothing is searched or sent.</p>
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mt-8 rounded-[28px] bg-white p-3 text-left shadow-[0_24px_60px_-28px_rgba(14,17,22,0.35)]">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#4B5563] hover:bg-[#F5F6F8]" aria-label="Add a screenshot or video"><ImagePlus size={20} /></button>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f.name); setErr(''); } e.target.value = ''; }} />
            <input value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="Paste a link, add a screenshot, or tell us what happened" className="h-12 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9CA3AF]" aria-label="What happened" />
            <button type="submit" className="grid h-12 w-12 place-items-center rounded-full bg-[#E1261C] text-white hover:bg-[#B3130F]" aria-label="Start"><ArrowRight size={20} /></button>
          </div>
        </form>
        {file && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F5F6F8] px-4 py-2.5 text-left text-sm">
            <span className="flex items-center gap-2 font-semibold"><ImagePlus size={15} className="text-[#E1261C]" />{file}<span className="font-normal text-[#6B7280]">· stays on this device in the demo, never stored</span></span>
            <button onClick={() => setFile(null)} className="text-[#6B7280] hover:text-[#0E1116]" aria-label="Remove file">Remove</button>
          </div>
        )}
        {err && <p className="mt-2 text-left text-sm text-[#B3130F]">{err}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGEST.map((s) => (
            <button key={s} onClick={() => run(s)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:border-[#E1261C] hover:text-[#B3130F]">{s}</button>
          ))}
        </div>
        <>
          {phase === 'scan' && (
            <motion.div key="scan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-3xl bg-[#F5F6F8] p-6 text-left">
              <p className="flex items-center gap-2 font-semibold"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}><Search size={16} className="text-[#E1261C]" /></motion.span> Finder is searching…</p>
              <div className="mt-4 space-y-3">
                {['Fingerprint, on your device', 'Reverse image search', 'Face match, verified users only'].map((m, n) => (
                  <div key={m} className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold">{m}</span>
                    <span className="h-1.5 w-32 overflow-hidden rounded-full bg-white"><motion.span className="block h-full bg-[#E1261C]" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1, delay: n * 0.9, ease: EASE }} /></span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-3xl bg-[#F5F6F8] p-6 text-left">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-[800] text-lg">{FINDINGS.length} places found. Here&rsquo;s what I&rsquo;d do.</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#6B7280]">Example case · {CASE.survivor} is fictional</span>
              </div>
              <div className="mt-4 space-y-2">
                {FINDINGS.map((f, n) => (
                  <motion.div key={f.platform} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.15 }} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                    <span><span className="block font-semibold">{f.platform} · {f.where}</span><span className="block text-xs text-[#6B7280]">Found by {f.foundBy.toLowerCase()}</span></span><span className="shrink-0 text-sm font-semibold text-[#B3130F]">{f.action}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="#how" onClick={() => window.dispatchEvent(new CustomEvent('reclaim:step', { detail: 3 }))} className="rounded-full bg-[#E1261C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B3130F]">Review all {FINDINGS.length}</a>
                <a href="tel:18448782274" className="rounded-full bg-white px-4 py-2 text-sm font-semibold hover:text-[#B3130F]">Call a helpline</a>
                <button onClick={() => { setPhase('idle'); setText(''); }} className="rounded-full px-4 py-2 text-sm font-semibold text-[#4B5563]">Start over</button>
              </div>
            </motion.div>
          )}
        </>
      </div>
    </section>
  );
}

/* ---------- Agents ---------- */

const AGENTS = [
  { name: 'Finder', icon: <Search size={18} />, job: 'Searches the web for every copy', live: ['Checking forums', 'Checking image hosts', 'Checking search'] },
  { name: 'Triage', icon: <Route size={18} />, job: 'Picks the right action per place', live: ['Platform or police?', 'Covered by the Act?', 'Needs the original?'] },
  { name: 'Filing', icon: <FileText size={18} />, job: 'Writes the legal requests for you', live: ['Drafting request', 'Waiting for your okay', 'Sent'] },
  { name: 'Watcher', icon: <Timer size={18} />, job: 'Tracks every 48-hour deadline', live: ['31h left', 'Re-checking link', 'Removed'] },
  { name: 'Restore', icon: <RotateCcw size={18} />, job: 'Asks for your real photo back', live: ['Found a swap', 'Request ready', 'Original restored'] },
];

function AgentCard({ a, i }: { a: (typeof AGENTS)[number]; i: number }) {
  const [k, setK] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setInterval(() => setK((x) => (x + 1) % a.live.length), 2200 + i * 300); return () => clearInterval(t); }, [a.live.length, i]);
  useEffect(() => {
    const cycle = () => { setOn(true); setTimeout(() => setOn(false), 1400); };
    const first = setTimeout(cycle, 600 + i * 1500);
    const loop = setInterval(cycle, 5 * 1500);
    const loopStart = setTimeout(() => {}, 0);
    return () => { clearTimeout(first); clearInterval(loop); clearTimeout(loopStart); };
  }, [i]);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.08, duration: 0.6, ease: EASE }} whileHover={{ y: -4 }} className={`rounded-3xl bg-white p-6 transition-all duration-500 ${on ? 'shadow-[0_20px_40px_-20px_rgba(225,38,28,0.45)] ring-2 ring-[#E1261C]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-2 ring-transparent'} hover:shadow-[0_20px_40px_-20px_rgba(14,17,22,0.3)]`}>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl transition-colors duration-500 ${on ? 'bg-[#E1261C] text-white' : 'bg-[#FDECEA] text-[#E1261C]'}`}>{a.icon}</span>
      <p className="mt-5 text-xl font-[800] tracking-[-0.02em]">{a.name}</p>
      <p className="mt-1 text-sm text-[#4B5563]">{a.job}</p>
      <div className="mt-5 flex h-8 items-center gap-2 overflow-hidden rounded-full bg-[#F5F6F8] px-3 text-xs font-semibold text-[#4B5563]">
        <motion.span className="h-2 w-2 shrink-0 rounded-full bg-[#E1261C]" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
        <AnimatePresence mode="wait"><motion.span key={k} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.25 }}>{a.live[k]}</motion.span></AnimatePresence>
      </div>
    </motion.div>
  );
}

function Agents() {
  return (
    <section id="agents" className="bg-[#F5F6F8] py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className="flex items-center gap-3 text-sm font-semibold text-[#6B7280]"><span className="h-px w-8 bg-[#E1261C]" />Your team</p>
        <h2 className={`${display} mt-3 max-w-[18ch] text-4xl leading-[1.02] md:text-6xl`}>Five agents working while you rest.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {AGENTS.map((a, i) => <AgentCard key={a.name} a={a} i={i} />)}
        </div>
      </div>
    </section>
  );
}

/* ---------- Where requests go ---------- */

function WhereItGoes() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className="flex items-center gap-3 text-sm font-semibold text-[#6B7280]"><span className="h-px w-8 bg-[#E1261C]" />Where requests go</p>
        <h2 className={`${display} mt-3 max-w-[20ch] text-4xl leading-[1.02] md:text-6xl`}>Straight to each platform&rsquo;s own removal channel.</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {REAL_PLATFORMS.map((p, i) => (
            <motion.a key={p.id} href={p.link!} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="flex items-center gap-2 rounded-full border border-black/10 px-5 py-3 font-semibold hover:border-[#E1261C] hover:text-[#B3130F]">
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
  const [shown, setShown] = useState(m ? 0 : value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!m || !ref.current) return;
    const target = parseInt(m[2].replace(/,/g, ''), 10);
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - start) / 1200);
        const eased = 1 - Math.pow(1 - k, 3);
        setShown(Math.round(target * eased));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
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
        <h2 className={`${display} max-w-[14ch] text-5xl leading-[0.98] md:text-7xl`}>One chat to start. You stay in control.</h2>
        <div className="flex flex-col gap-4">
          <a href="#try" className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#E1261C] transition hover:-translate-y-0.5">Start a chat <ArrowRight size={18} /></a>
          <p className="flex items-center gap-2 text-sm text-white/85"><Lock size={14} /> Nothing sends without your okay · Never stored · Esc to leave</p>
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
      <main>
        <Hero />
        <Process />
        <HowItSearches />
        <TryIt />
        <Agents />
        <WhereItGoes />
        <Stats />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
