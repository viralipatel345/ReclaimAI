"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Pen, LogOut, ShieldCheck } from "lucide-react";
import { chooseAge } from "@/lib/ageGate";
import { resetDemo } from "@/lib/useCase";
import { useDemoMode } from "@/components/Providers";
import { quickExit } from "@/lib/quickExit";

const PROMISES = [
  { icon: <Link2 size={18} />, title: "Links only", text: "We never see, upload or download images." },
  { icon: <Pen size={18} />, title: "You approve it", text: "Every request carries your signature — nothing goes out without your say." },
  { icon: <LogOut size={18} />, title: "Leave in one tap", text: "Press Esc or Quick exit on any screen." },
];

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

export default function StartPage() {
  const router = useRouter();
  const [age, setAge] = useState<"adult" | "minor" | null>(null);
  const demo = useDemoMode();

  // Landing "How it works" links pass ?next=<step>. Only /case screens are allowed, and only after the 18+ check.
  const nextStep = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && /^\/case(\/[a-z]+)?(#[a-z]+)?$/.test(next) ? next : null;
  };
  const start = () => {
    if (!age) return;
    const route = chooseAge(age);
    router.push(age === "adult" ? nextStep() ?? route : route);
  };
  const startDemo = () => { resetDemo(); router.push(nextStep() ?? "/case?auto=1"); };

  return (
    <div className="min-h-screen bg-white font-[var(--font-plus-jakarta),sans-serif] text-[#0E1116]">
      <div className="mx-auto grid max-w-[1240px] items-start gap-10 px-5 pb-20 pt-14 md:px-8 lg:grid-cols-[1fr_420px] lg:gap-20 lg:pt-20">

        {/* Left: context */}
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#6B7280]">
            <span className="h-px w-8 bg-[#E1261C]" />
            TAKE IT DOWN Act · enforceable since May 19, 2026
          </div>
          <h1 className="mt-5 max-w-[14ch] text-[52px] font-[800] leading-[0.97] tracking-[-0.04em] md:text-[72px]">
            Platforms have<br /><span className="text-[#E1261C]">48 hours.</span>
          </h1>
          <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-[#4B5563]">
            Share a link once. Reclaim sends the legal request, runs the clock, and escalates to the FTC if they miss it.
          </p>

          <ul className="mt-10 hidden grid-cols-3 gap-6 lg:grid">
            {PROMISES.map((p) => (
              <li key={p.title} className="border-t-2 border-[#E5E7EB] pt-5">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-[#E1261C]">{p.icon}</span>
                <p className="mt-4 font-bold">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Right: age gate */}
        <section className="rounded-[28px] bg-white p-7 shadow-[0_24px_60px_-20px_rgba(14,17,22,0.18)] ring-1 ring-black/[0.06] md:p-9" aria-labelledby="gate-title">
          <div className="flex justify-center">
            <Mark size={48} />
          </div>

          {demo && (
            <div className="mt-6 border-b border-[#E5E7EB] pb-6">
              <button
                onClick={startDemo}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E1261C] px-6 py-3.5 font-semibold text-white shadow-[0_8px_20px_-8px_rgba(225,38,28,0.6)] hover:bg-[#B3130F]"
              >
                Start demo <ArrowRight size={18} />
              </button>
              <p className="mt-2 text-center text-xs text-[#6B7280]">Fictional adult case · Jordan Ellis</p>
            </div>
          )}

          <h2 id="gate-title" className="mt-6 text-2xl font-[800] tracking-[-0.02em]">Before we start</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">Reclaim is for adults. We ask so we can point you to the right help.</p>

          <fieldset className="mt-6 space-y-3">
            <legend className="mb-3 text-sm font-semibold text-[#4B5563]">How old are you?</legend>
            {[
              { v: "adult" as const, label: "18 or older" },
              { v: "minor" as const, label: "Under 18" },
            ].map((o) => (
              <label
                key={o.v}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3.5 transition-colors ${
                  age === o.v
                    ? "border-[#E1261C] bg-[#FDECEA]"
                    : "border-[#E5E7EB] hover:border-black/20"
                }`}
              >
                <input
                  type="radio"
                  name="age"
                  value={o.v}
                  checked={age === o.v}
                  onChange={() => setAge(o.v)}
                  className="h-4 w-4 accent-[#E1261C]"
                />
                <span className="font-medium">{o.label}</span>
              </label>
            ))}
          </fieldset>

          <button
            onClick={start}
            disabled={!age}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#E1261C] px-6 py-3.5 font-semibold text-white shadow-[0_8px_20px_-8px_rgba(225,38,28,0.6)] transition hover:bg-[#B3130F] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue <ArrowRight size={18} />
          </button>
          {age === "adult" && (
            <button
              onClick={() => router.push("/verify")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#E5E7EB] px-6 py-3 text-sm font-semibold text-[#0E1116] transition hover:border-black/20"
            >
              Have the image itself? Verify it and file a report <ArrowRight size={16} />
            </button>
          )}

          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-[#6B7280]">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#E1261C]" />
            Nothing is saved until you add a link. Press Esc at any time to leave instantly.
          </p>
        </section>

        {/* Promises — mobile */}
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:hidden">
          {PROMISES.map((p) => (
            <li key={p.title} className="border-t-2 border-[#E5E7EB] pt-5">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-[#E1261C]">{p.icon}</span>
              <p className="mt-4 font-bold">{p.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
