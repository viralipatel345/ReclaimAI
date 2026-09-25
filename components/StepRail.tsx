"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";

const STEPS = [
  { n: "01", label: "Tell us where", short: "Where", href: "/case" },
  { n: "02", label: "Review requests", short: "Requests", href: "/case/requests" },
  { n: "03", label: "Track the 48 hours", short: "Track", href: "/case/tracker" },
];

export function StepRail() {
  const path = usePathname();
  // Sub-pages belong to a step: live detection → 02, FTC complaint → 03.
  const alias: Record<string, string> = { "/case/detect": "/case/requests", "/case/ftc": "/case/tracker" };
  const active = STEPS.findIndex((s) => s.href === (alias[path] ?? path));
  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-[232px] shrink-0 xl:block">
        <div className="sticky top-24 space-y-6">
          <nav aria-label="Steps">
            <ol className="space-y-1.5">
              {STEPS.map((s, i) => {
                const isActive = i === active;
                const done = i < active;
                return (
                  <li key={s.n}>
                    <Link
                      href={s.href}
                      aria-current={isActive ? "step" : undefined}
                      className={`flex items-center gap-3.5 rounded-2xl px-3 py-3 text-[15px] transition-colors ${isActive ? "bg-[#F5F6F8] font-[800] tracking-[-0.02em] text-[#0E1116]" : "font-medium text-[#6B7280] hover:bg-[#F5F6F8] hover:text-[#0E1116]"}`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-[800] ${isActive ? "bg-[#E1261C] text-white" : done ? "bg-[#0E1116] text-white" : "bg-white text-[#9CA3AF] ring-1 ring-black/10"}`}>
                        {done ? <Check size={14} strokeWidth={2.5} /> : s.n}
                      </span>
                      {s.label}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
          <PrivacyCard />
        </div>
      </aside>
      {/* Mobile / tablet stepper */}
      <nav aria-label="Steps" className="mb-6 xl:hidden">
        <ol className="flex gap-2 overflow-x-auto">
          {STEPS.map((s, i) => {
            const isActive = i === active;
            const done = i < active;
            return (
              <li key={s.n} className="shrink-0">
                <Link
                  href={s.href}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors ${isActive ? "border-[#E1261C] bg-[#FDECEA] text-[#B3130F]" : done ? "border-black/10 bg-white text-[#0E1116]" : "border-black/10 bg-white text-[#6B7280]"}`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-[800] ${isActive ? "bg-[#E1261C] text-white" : done ? "bg-[#0E1116] text-white" : "bg-[#F5F6F8] text-[#9CA3AF]"}`}>
                    {done ? <Check size={11} strokeWidth={3} /> : s.n}
                  </span>
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

export function PrivacyCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-3xl bg-[#F5F6F8] p-6 ${className}`}>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#E1261C]">
        <ShieldCheck size={18} />
      </span>
      <p className="mt-5 text-xl font-[800] tracking-[-0.02em] text-[#0E1116]">We never see your images.</p>
      <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">Reclaim only works with links. Nothing is uploaded, downloaded, or looked at.</p>
    </div>
  );
}
