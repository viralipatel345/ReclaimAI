"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { btnPrimary, card, Eyebrow } from "@/components/ui";
import { chooseAge } from "@/lib/ageGate";

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: "link", title: "Links only", text: "We never see, upload or download images." },
  { icon: "pen", title: "You approve it", text: "Every request carries your signature — nothing goes out without your say." },
  { icon: "exit", title: "Leave in one tap", text: "Press Esc or Quick exit on any screen." },
];

export default function Landing() {
  const router = useRouter();
  const [age, setAge] = useState<"adult" | "minor" | null>(null);

  const start = () => {
    if (age) router.push(chooseAge(age));
  };

  return (
    <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-16 pt-10 md:px-12 md:pt-20 lg:grid-cols-[1fr_440px] lg:gap-20">
      <section>
        <Eyebrow>TAKE IT DOWN Act · enforceable since May 19, 2026</Eyebrow>
        <h1 className="mt-5 max-w-[14ch] font-display text-[44px] font-semibold leading-[1.02] tracking-tight md:text-[72px]">
          Platforms have 48 hours to take it down.
        </h1>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted md:text-xl">
          Share a link once. Reclaim sends the legal request, watches the clock, re-checks every three days, and escalates to the FTC if a platform misses its deadline.
        </p>
        <Promises className="mt-10 hidden lg:grid" />
      </section>

      <section className={`${card} h-fit p-6 md:p-8`} aria-labelledby="gate-title">
        <h2 id="gate-title" className="font-display text-2xl font-semibold">Before we start</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Reclaim is for adults. We ask so we can point you to the right help.</p>
        <fieldset className="mt-6 space-y-3">
          <legend className="mb-3 text-sm font-medium">How old are you?</legend>
          {[
            { v: "adult" as const, label: "18 or older" },
            { v: "minor" as const, label: "Under 18" },
          ].map((o) => (
            <label
              key={o.v}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${age === o.v ? "border-accent bg-accent-soft" : "border-line hover:border-ink/30"}`}
            >
              <input type="radio" name="age" value={o.v} checked={age === o.v} onChange={() => setAge(o.v)} className="h-4 w-4 accent-[#3446A8]" />
              <span className="text-[15px]">{o.label}</span>
            </label>
          ))}
        </fieldset>
        <button onClick={start} disabled={!age} className={`${btnPrimary} mt-6 w-full`}>
          Start <Icon name="arrow" size={18} />
        </button>
        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Icon name="shield" size={14} className="mt-0.5" />
          Nothing is saved until you add a link. Press Esc at any time to leave this page instantly.
        </p>
      </section>

      <Promises className="grid lg:hidden" />
    </div>
  );
}

function Promises({ className }: { className: string }) {
  return (
    <ul className={`gap-5 sm:grid-cols-3 ${className}`}>
      {PROMISES.map((p) => (
        <li key={p.title} className="border-t border-line pt-4">
          <Icon name={p.icon} className="text-accent" />
          <p className="mt-3 font-medium">{p.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{p.text}</p>
        </li>
      ))}
    </ul>
  );
}
