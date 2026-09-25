"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { localMirror } from "@/lib/store";
import { ensureCase } from "@/lib/useCase";

// Stitch "Sanctuary" direction, landing-page size. Copy follows the team workflow:
// verify → discover → recommend (platform · police · helpline · original) → act → track.

const RED = "#C4302B";

const STEPS = [
  { title: "Verify it's you", text: "A quick check that you are you. It keeps Reclaim from ever being used against someone else." },
  { title: "Discover", text: "Our agent searches the web for your image and any deepfakes of you. Add links you've found, and bring in a friend or family member if you want company." },
  { title: "Recommend", text: "For every place it finds, you get one clear next step, chosen for that case." },
  { title: "Act", text: "Nothing sends without you. See exactly what goes where, then approve it with one tap." },
  { title: "Track", text: "Every report in one place, with the 48 hours a platform has to remove it counted for you." },
];

const ACTIONS = [
  { title: "Report to the platform", text: "A legal removal request under the TAKE IT DOWN Act, written for you." },
  { title: "Report to police", text: "A clear, dated record you can bring with you, if you choose to." },
  { title: "Call a helpline", text: "A real person, any hour. The CCRI helpline is free and confidential." },
  { title: "Put the original back", text: "Where a fake replaced your real photo, ask for the original to be restored." },
];

const FOUND = [
  { host: "file-vault.to", kind: "Image host", status: "Platform notified", tone: "soft" },
  { host: "Public forum thread", kind: "Discussion board", status: "Needs your okay", tone: "ask" },
  { host: "Image search result", kind: "Search index", status: "Removed", tone: "done" },
];

function Mark({ size = 28, color = RED }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <ellipse key={i} cx="20" cy="7" rx="2.6" ry="5.4" fill={color} transform={`rotate(${i * 36} 20 20)`} />
      ))}
    </svg>
  );
}

function Wave({ bars = 28, className = "" }: { bars?: number; className?: string }) {
  return (
    <div className={`flex h-10 items-center gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="rc-bar w-[3px] rounded-full" style={{ background: RED, animationDelay: `${(i % 7) * 0.18}s`, opacity: 0.35 + ((i * 37) % 60) / 100 }} />
      ))}
    </div>
  );
}

function Figure() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="rc-drift absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, #E8A39E, transparent)" }} />
      <svg className="rc-breathe absolute bottom-[-60px] right-[30%] h-[105%] w-auto opacity-90" viewBox="0 0 400 520">
        <defs>
          <filter id="rc-blur"><feGaussianBlur stdDeviation="10" /></filter>
          <radialGradient id="rc-body" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#D8423B" />
            <stop offset="55%" stopColor="#A82622" />
            <stop offset="100%" stopColor="#2A1B1B" />
          </radialGradient>
        </defs>
        <g filter="url(#rc-blur)" fill="url(#rc-body)">
          <circle cx="200" cy="120" r="52" />
          <path d="M120 250c0-60 36-86 80-86s80 26 80 86l6 110c0 20-40 30-86 30s-86-10-86-30z" />
          <path d="M40 470c20-70 90-100 160-100s140 30 160 100c-60 28-100 34-160 34s-100-6-160-34z" fill="#2A1B1B" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}

export default function LandingStitch() {
  const router = useRouter();
  const [age, setAge] = useState<"adult" | "minor" | null>(null);

  const start = () => {
    if (age === "minor") {
      localMirror.clear();
      router.push("/help/under-18");
      return;
    }
    ensureCase();
    router.push("/case");
  };

  const glass = "rounded-[28px] border border-white/70 bg-white/55 shadow-[0_20px_60px_-30px_rgba(122,31,31,0.35)] backdrop-blur-xl";

  return (
    <div className="bg-[#F4F1EE] text-[#231F20]">
      <style>{`
        @keyframes rc-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
        @keyframes rc-drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px,20px); } }
        @keyframes rc-bar { 0%,100% { height: 20%; } 50% { height: 95%; } }
        .rc-breathe { animation: rc-breathe 8s ease-in-out infinite; transform-origin: 50% 80%; }
        .rc-drift { animation: rc-drift 14s ease-in-out infinite; }
        .rc-bar { height: 40%; animation: rc-bar 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .rc-breathe, .rc-drift, .rc-bar { animation: none; } }
      `}</style>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <Figure />
        <div className="relative mx-auto grid max-w-[1280px] gap-12 px-5 pb-20 pt-14 md:px-12 lg:grid-cols-[1.1fr_420px] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-xs font-medium backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
              For survivors of deepfakes and leaked images
            </span>
            <div className="mt-8 flex items-center gap-4">
              <Mark size={44} />
              <h1 className="text-[64px] font-normal leading-none tracking-[-0.03em] md:text-[104px]">Reclaim</h1>
            </div>
            <p className="mt-6 max-w-[34ch] text-xl leading-relaxed text-[#4A4244] md:text-2xl">
              A quiet place to find where your image went, and take it back.
            </p>
            <div className="mt-10 grid max-w-[520px] grid-cols-2 gap-4">
              <div className={`${glass} p-5`}>
                <p className="text-4xl font-medium tracking-tight">90%</p>
                <p className="mt-1 text-sm text-[#5E5658]">of reported images come down</p>
              </div>
              <div className={`${glass} p-5`}>
                <p className="text-4xl font-medium tracking-tight" style={{ color: RED }}>4%</p>
                <p className="mt-1 text-sm text-[#5E5658]">of survivors ever report. We report with you.</p>
              </div>
            </div>
          </div>

          <div className={`${glass} h-fit p-7`} aria-labelledby="rc-gate">
            <h2 id="rc-gate" className="text-2xl font-medium tracking-tight">Before we start</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5E5658]">Reclaim is for adults. We ask so we can point you to the right help.</p>
            <fieldset className="mt-6 space-y-3">
              <legend className="mb-3 text-sm font-medium">How old are you?</legend>
              {[
                { v: "adult" as const, label: "18 or older" },
                { v: "minor" as const, label: "Under 18" },
              ].map((o) => (
                <label key={o.v} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${age === o.v ? "border-[#C4302B] bg-[#F6E3E1]" : "border-white/80 bg-white/60 hover:border-[#231F20]/30"}`}>
                  <input type="radio" name="age" value={o.v} checked={age === o.v} onChange={() => setAge(o.v)} className="h-4 w-4 accent-[#C4302B]" />
                  <span className="text-[15px]">{o.label}</span>
                </label>
              ))}
            </fieldset>
            <button onClick={start} disabled={!age} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#231F20] text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35">
              Begin, gently
            </button>
            <p className="mt-5 text-xs leading-relaxed text-[#5E5658]">Nothing is saved until you add a link. Press Esc at any time to leave instantly.</p>
          </div>
        </div>
      </section>

      {/* Breath + discover preview */}
      <section className="mx-auto grid max-w-[1280px] gap-6 px-5 md:px-12 lg:grid-cols-2">
        <div className={`${glass} flex flex-col justify-between p-7`}>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: RED }}>While we look</p>
            <h3 className="mt-3 text-3xl font-normal tracking-tight">Take a breath.</h3>
            <p className="mt-2 text-[#5E5658]">In for four. Hold. Out for six. The searching is our job.</p>
          </div>
          <Wave className="mt-8" bars={40} />
        </div>

        <div className={`${glass} p-7`}>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-normal tracking-tight">3 places found</h3>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-[#5E5658]">Example</span>
          </div>
          <p className="mt-2 text-sm text-[#5E5658]">Review each one. Nothing is sent until you say so.</p>
          <ul className="mt-5 space-y-3">
            {FOUND.map((f) => (
              <li key={f.host} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.host}</p>
                  <p className="text-xs text-[#5E5658]">{f.kind}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${f.tone === "done" ? "bg-[#E4EFE8] text-[#2F6B4F]" : f.tone === "ask" ? "bg-[#231F20] text-white" : "bg-[#F6E3E1] text-[#9A2A25]"}`}>
                  {f.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1280px] px-5 py-24 md:px-12">
        <h2 className="max-w-[18ch] text-4xl font-normal tracking-tight md:text-5xl">You tell us once. We carry the rest.</h2>
        <ol className="mt-12 grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`${glass} p-6`}>
              <span className="text-sm font-medium" style={{ color: RED }}>{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-4 text-lg font-medium">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#5E5658]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Recommend */}
      <section className="relative overflow-hidden bg-[#EFE8E5]">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-24 md:px-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Mark size={36} />
            <h2 className="mt-6 max-w-[16ch] text-4xl font-normal tracking-tight md:text-5xl">One clear next step for every place it&rsquo;s found.</h2>
            <p className="mt-5 max-w-[42ch] text-[#5E5658]">Not every case needs the same thing. Reclaim reads each one and suggests what will actually help.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ACTIONS.map((a) => (
              <div key={a.title} className={`${glass} p-6`}>
                <p className="text-lg font-medium">{a.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5E5658]">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promises + close */}
      <section className="mx-auto max-w-[1280px] px-5 py-24 text-center md:px-12">
        <div className="mx-auto flex max-w-[860px] flex-wrap justify-center gap-3">
          {["Links only. We never see your images.", "You approve everything.", "Leave in one tap. Press Esc."].map((t) => (
            <span key={t} className="rounded-full border border-white/80 bg-white/60 px-4 py-2 text-sm backdrop-blur">{t}</span>
          ))}
        </div>
        <p className="mx-auto mt-16 max-w-[20ch] text-4xl font-normal tracking-tight md:text-6xl">Your image. Your name. Your call.</p>
        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-[#5E5658]">Breathe. Reclaim.</p>
      </section>
    </div>
  );
}
