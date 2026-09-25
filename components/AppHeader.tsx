"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { quickExit } from "@/lib/quickExit";
import { Icon } from "./Icon";
import { useDemoMode } from "./Providers";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Reclaim home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="8" fill="var(--color-accent)" />
        <path d="M8 18V8h5.2a3.3 3.3 0 010 6.6H8 M12.5 14.6L17.5 18" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-title font-semibold tracking-tight">Reclaim</span>
    </Link>
  );
}

export function AppHeader() {
  const demo = useDemoMode();
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-5 md:px-8">
        <div className="flex items-center gap-4">
          <Logo />
          {demo && (
            <span className="hidden rounded-full border border-black/10 bg-[#F5F6F8] px-3 py-1 text-xs text-[#6B7280] sm:inline">
              Example case · fictional
            </span>
          )}
        </div>
        <button
          onClick={quickExit}
          className="flex h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold text-[#0E1116] hover:bg-black/[0.04]"
        >
          <Icon name="exit" size={15} />
          Quick exit
          <kbd className="hidden rounded bg-black/[0.06] px-1.5 text-[11px] font-medium text-[#6B7280] md:inline">Esc</kbd>
        </button>
      </div>
      {demo && (
        <div className="border-t border-black/5 bg-[#F5F6F8] px-4 py-1.5 text-center text-xs text-[#6B7280] sm:hidden">Example case · fictional</div>
      )}
    </header>
  );
}

export function LegalNotice() {
  const demo = useDemoMode();
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 py-5 text-xs text-muted md:flex-row md:items-center md:justify-between md:px-12">
        <p className="flex items-center gap-2">
          <Icon name="info" size={14} />
          <span>
            <strong className="font-semibold text-ink">Not legal advice</strong> — Reclaim prepares requests you send.
          </span>
        </p>
        {demo && <p>Demo mode: all names, accounts and links are fictional. Nothing is actually sent.</p>}
      </div>
    </footer>
  );
}
