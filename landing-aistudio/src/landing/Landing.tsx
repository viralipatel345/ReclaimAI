import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Bell, Check, FileText, Globe, Lock, LogOut, MessageCircle, Phone,
  RotateCcw, Scale, Search, Send, ShieldCheck, Sparkles, Timer, Route,
} from 'lucide-react';

// Brand: white ground, ink #0E1116, one bright red #E1261C (deep #B3130F), heavy Plus Jakarta Sans.
const EASE = [0.2, 0.7, 0.2, 1] as const;
const display = 'font-[800] tracking-[-0.04em]';

function Mark({ size = 36 }: { size?: number }) {
  return (
    <span className="grid place-items-center rounded-[10px] bg-[#E1261C] text-white" style={{ width: size, height: size }}>
      <ShieldCheck size={size * 0.58} strokeWidth={2.4} />
    </span>
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
  { from: 'ai', text: 'Found 3 copies', card: true },
  { from: 'me', text: 'take them all down' },
  { from: 'ai', text: 'Sent. Platforms have 48 hours by law. I’ll text you as each one comes down.' },
];

function PhoneChat() {
  const [n, setN] = useState(1);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (n >= SCRIPT.length) {
      const t = setTimeout(() => setN(1), 4200);
      return () => clearTimeout(t);
    }
    const next = SCRIPT[n];
    setTyping(next.from === 'ai');
    const t = setTimeout(() => { setTyping(false); setN((x) => x + 1); }, next.from === 'ai' ? 1500 : 1100);
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
          <p className="text-[11px] text-[#6B7280]">Private · links only</p>
        </div>
        <div className="relative mt-4 flex flex-col gap-2 px-4 text-[12.5px] leading-snug">
          <AnimatePresence initial={false}>
            {SCRIPT.slice(0, n).map((b, i) => (
              <motion.div
                key={i + '-' + n}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={b.from === 'me' ? 'self-end max-w-[78%] rounded-2xl rounded-br-md bg-[#E1261C] px-3 py-2 text-white' : 'self-start max-w-[86%] rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]'}
              >
                {b.card ? (
                  <div className="w-[190px]">
                    <p className="mb-1.5 font-semibold">{b.text}</p>
                    {[['forum thread', 'Platform'], ['image host', 'Platform'], ['search result', 'De-list']].map(([s, a]) => (
                      <div key={s} className="flex justify-between border-t border-black/5 py-1 text-[11px]"><span>{s}</span><span className="font-semibold text-[#B3130F]">{a}</span></div>
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
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[12px] text-[#9CA3AF] shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          Tell me what happened… <span className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-[#E1261C] text-white"><ArrowRight size={14} /></span>
        </div>
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
    { icon: <Search size={16} />, title: 'Finds every copy', text: 'Searches the web for your image and deepfakes of you.' },
    { icon: <Route size={16} />, title: 'Picks the right step', text: 'Platform, police, helpline, or putting the original back.' },
    { icon: <Timer size={16} />, title: 'Holds them to 48 hours', text: 'Tracks every legal deadline so you don’t have to.' },
  ];
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.14),transparent)]" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-5 pb-20 pt-14 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FDECEA] px-3.5 py-1.5 text-xs font-semibold text-[#B3130F]">
            <Sparkles size={13} /> AI agents · U.S. TAKE IT DOWN Act
          </span>
          <h1 className={`${display} mt-6 text-[56px] leading-[0.95] md:text-[88px]`}>
            Take it down.<br /><span className="text-[#E1261C]">Take it back.</span>
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[#4B5563]">
            Reclaim is a team of AI agents for survivors of deepfakes and leaked images. Tell it what happened once. It finds every copy and gets them removed.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#try" className="inline-flex h-13 items-center gap-2 rounded-full bg-[#E1261C] px-7 py-3.5 font-semibold text-white shadow-[0_12px_28px_-10px_rgba(225,38,28,0.8)] transition hover:-translate-y-0.5 hover:bg-[#B3130F]">
              Start a chat <ArrowRight size={18} />
            </a>
            <a href="#how" className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 font-semibold text-[#0E1116] hover:bg-black/[0.04]">See how it works</a>
          </div>
          <ul className="mt-10 grid gap-4">
            {points.map((p, i) => (
              <motion.li key={p.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease: EASE }} className="flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FDECEA] text-[#E1261C]">{p.icon}</span>
                <span>
                  <span className="block font-bold">{p.title}</span>
                  <span className="block text-sm text-[#6B7280]">{p.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease: EASE }} className="relative">
          <FloatCard className="-left-6 top-16" delay={1.2} icon={<Bell size={15} />} title="3 copies found" text="On a forum, an image host, and search." />
          <FloatCard className="-right-4 top-[46%]" delay={1.8} icon={<Send size={15} />} title="Requests sent" text="48-hour legal clock started." />
          <FloatCard className="bottom-10 -left-2" delay={2.4} icon={<Check size={15} />} title="Removed from search" text="1 of 3 done in 19 hours." />
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

function StepPanel({ k }: { k: string }) {
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
      {[['forum thread', 'Legal request to platform', <Scale key="a" size={14} />], ['image host', 'Legal request to platform', <Scale key="b" size={14} />], ['threats in DMs', 'Report to police', <FileText key="c" size={14} />], ['profile photo swapped', 'Put the original back', <RotateCcw key="d" size={14} />]].map(([s, a, ic], i) => (
        <motion.div key={s as string} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }} className={row}>
          <span className="font-semibold">{s}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#FDECEA] px-3 py-1 text-xs font-semibold text-[#B3130F]">{ic}{a}</span>
        </motion.div>
      ))}
    </div>
  );
  if (k === 'act') return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Ready for your okay</p>
      <p className="mt-2 font-bold">Removal request · forum thread</p>
      <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">Under the TAKE IT DOWN Act, I request removal of the non-consensual intimate image at the link below within 48 hours&hellip;</p>
      <div className="mt-4 flex gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E1261C] px-4 py-2 text-sm font-semibold text-white"><Check size={15} /> Approve and send</span>
        <span className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-[#4B5563]">Edit first</span>
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
      {[['forum thread', 31.2, 'Sent'], ['image host', 40.6, 'Acknowledged'], ['search result', 0, 'Removed']].map(([s, h, st]) => (
        <div key={s as string} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <span className="font-semibold">{s}</span>
          <span className="flex items-center gap-3">
            {st !== 'Removed' && <span className="font-mono text-sm tabular-nums text-[#4B5563]">{left(h as number)}</span>}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st === 'Removed' ? 'bg-[#E7F6EC] text-[#166534]' : 'bg-[#FDECEA] text-[#B3130F]'}`}>{st as string}</span>
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
    if (paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % STEPS.length), 4200);
    return () => clearTimeout(t);
  }, [i, paused]);
  return (
    <section id="how" className="bg-[#F5F6F8] py-24">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className="text-sm font-semibold text-[#E1261C]">How it works</p>
        <h2 className={`${display} mt-3 max-w-[16ch] text-4xl leading-[1.02] md:text-6xl`}>Five steps. You make one decision.</h2>
        <div className="mt-12 grid gap-8 lg:grid-cols-[380px_1fr]">
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
                <StepPanel k={STEPS[i].key} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
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
  const run = (q?: string) => {
    const v = (q ?? text).trim();
    if (!v) { setErr('Tell us a little first, or tap an example.'); return; }
    setText(v); setErr(''); setPhase('scan');
    setTimeout(() => setPhase('done'), 2600);
  };
  return (
    <section id="try" className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.16),transparent)]" />
      <div className="relative mx-auto max-w-[760px] px-5 text-center">
        <Mark size={52} />
        <h2 className={`${display} mt-6 text-4xl leading-[1.02] md:text-6xl`}>What happened?</h2>
        <p className="mt-4 text-[#4B5563]">Try the agent. This is a demo, nothing is searched or sent.</p>
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mt-8 rounded-[28px] bg-white p-3 text-left shadow-[0_24px_60px_-28px_rgba(14,17,22,0.35)]">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} className="ml-2 shrink-0 text-[#9CA3AF]" />
            <input value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="Paste a link, or tell us in your own words" className="h-12 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9CA3AF]" aria-label="What happened" />
            <button type="submit" className="grid h-12 w-12 place-items-center rounded-full bg-[#E1261C] text-white hover:bg-[#B3130F]" aria-label="Start"><ArrowRight size={20} /></button>
          </div>
        </form>
        {err && <p className="mt-2 text-left text-sm text-[#B3130F]">{err}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGEST.map((s) => (
            <button key={s} onClick={() => run(s)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:border-[#E1261C] hover:text-[#B3130F]">{s}</button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {phase === 'scan' && (
            <motion.div key="scan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10 rounded-3xl bg-[#F5F6F8] p-6 text-left">
              <p className="flex items-center gap-2 font-semibold"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}><Search size={16} className="text-[#E1261C]" /></motion.span> Finder is searching…</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><motion.div className="h-full bg-[#E1261C]" initial={{ width: '5%' }} animate={{ width: '100%' }} transition={{ duration: 2.4, ease: EASE }} /></div>
            </motion.div>
          )}
          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-3xl bg-[#F5F6F8] p-6 text-left">
              <p className="font-[800] text-lg">3 places found. Here&rsquo;s what I&rsquo;d do.</p>
              <div className="mt-4 space-y-2">
                {[['discussion forum', 'Legal request to platform'], ['image host', 'Legal request to platform'], ['search result', 'Ask search to de-list it']].map(([s, a], n) => (
                  <motion.div key={s} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.15 }} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                    <span className="font-semibold">{s}</span><span className="text-sm font-semibold text-[#B3130F]">{a}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#E1261C] px-4 py-2 text-sm font-semibold text-white">Review all 3</span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold">Call a helpline</span>
                <button onClick={() => { setPhase('idle'); setText(''); }} className="rounded-full px-4 py-2 text-sm font-semibold text-[#4B5563]">Start over</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
  useEffect(() => { const t = setInterval(() => setK((x) => (x + 1) % a.live.length), 2200 + i * 300); return () => clearInterval(t); }, [a.live.length, i]);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.08, duration: 0.6, ease: EASE }} whileHover={{ y: -4 }} className="rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_20px_40px_-20px_rgba(14,17,22,0.3)]">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FDECEA] text-[#E1261C]">{a.icon}</span>
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
    <section id="agents" className="bg-[#F5F6F8] py-24">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <p className="text-sm font-semibold text-[#E1261C]">Your team</p>
        <h2 className={`${display} mt-3 max-w-[18ch] text-4xl leading-[1.02] md:text-6xl`}>Five agents working while you rest.</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {AGENTS.map((a, i) => <AgentCard key={a.name} a={a} i={i} />)}
        </div>
      </div>
    </section>
  );
}

/* ---------- Stats + closing ---------- */

function Stats() {
  return (
    <section className="bg-[#0E1116] py-20 text-white">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 md:grid-cols-3 md:px-8">
        {[['48h', 'What platforms now have by federal law to remove a reported image.'], ['4%', 'Of people who called a helpline about image abuse also went to police.'], ['0', 'Images Reclaim ever sees. It works with links only.']].map(([n, t]) => (
          <motion.div key={n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }}>
            <p className={`${display} text-7xl text-[#E1261C] md:text-8xl`}>{n}</p>
            <p className="mt-3 max-w-[32ch] text-white/70">{t}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="relative overflow-hidden bg-[#E1261C] py-24 text-white">
      <div className="pointer-events-none absolute -right-24 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,120,110,0.55),transparent)]" />
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-start gap-8 px-5 md:flex-row md:items-end md:justify-between md:px-8">
        <h2 className={`${display} max-w-[14ch] text-5xl leading-[0.98] md:text-7xl`}>One chat to start. You stay in control.</h2>
        <div className="flex flex-col gap-4">
          <a href="#try" className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#E1261C] transition hover:-translate-y-0.5">Start a chat <ArrowRight size={18} /></a>
          <p className="flex items-center gap-2 text-sm text-white/85"><Lock size={14} /> Nothing sends without your okay · Esc to leave</p>
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
        <p className="flex items-center gap-2"><Phone size={14} /> CCRI image abuse helpline, 24/7: <a className="font-semibold text-[#0E1116]" href="tel:18448782274">1-844-878-2274</a></p>
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
        <TryIt />
        <Agents />
        <Stats />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
