"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

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
            <ol className="space-y-1">
              {STEPS.map((s, i) => {
                const isActive = i === active;
                const done = i < active;
                return (
                  <li key={s.n}>
                    <Link
                      href={s.href}
                      aria-current={isActive ? "step" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition-colors ${isActive ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink"}`}
                    >
                      <span className={`font-mono text-xs ${isActive ? "text-accent" : ""}`}>{done ? <Icon name="check" size={14} className="text-removed" strokeWidth={2.25} /> : s.n}</span>
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
          {STEPS.map((s, i) => (
            <li key={s.n} className="shrink-0">
              <Link
                href={s.href}
                aria-current={i === active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${i === active ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted"}`}
              >
                <span className="font-mono text-[11px]">{s.n}</span>
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

export function PrivacyCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-accent-soft p-5 ${className}`}>
      <Icon name="shield-check" size={22} className="text-accent" />
      <p className="mt-3 font-display text-lg font-semibold leading-snug text-ink">We never see your images.</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">Reclaim only works with links. Nothing is uploaded, downloaded, or looked at.</p>
    </div>
  );
}
