// Brand system for the onboarding screens, lifted from the landing page (app/page.tsx).
// Kept local to these screens so the rest of the app keeps its own styles.
// Palette: ink #0E1116, red #E1261C (hover #B3130F, soft #FDECEA), muted #6B7280 / #4B5563, line #E5E7EB, ground #F5F6F8.

export const display = "font-[800] tracking-[-0.04em] text-[#0E1116]";
export const eyebrow = "flex items-center gap-3 text-sm font-semibold text-[#6B7280]";
export const Rule = () => <span className="h-px w-8 shrink-0 bg-[#E1261C]" aria-hidden="true" />;

export const pillPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#E1261C] px-7 font-semibold text-white shadow-[0_12px_28px_-10px_rgba(225,38,28,0.8)] transition hover:bg-[#B3130F] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-[#E1261C]";
export const pillSecondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-[#0E1116] transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40";

/** Large soft card, as on /start. */
export const panel = "rounded-[28px] bg-white shadow-[0_24px_60px_-28px_rgba(14,17,22,0.18)] ring-1 ring-black/[0.06]";
/** Quiet inset block inside a panel. */
export const inset = "rounded-2xl bg-[#F5F6F8]";

export const field =
  "h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0E1116] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#E1261C] focus:ring-4 focus:ring-[#E1261C]/15";
export const fieldLabel = "block text-sm font-semibold text-[#0E1116]";
export const cardTitle = "text-xl font-[800] tracking-[-0.02em] text-[#0E1116]";
export const helpText = "text-sm leading-relaxed text-[#6B7280]";
export const errorText = "text-sm text-[#B3130F]";

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Reclaim" className="shrink-0">
      <rect width="96" height="96" rx="24" fill="#E1261C" />
      <path d="M48 18 L72 27 V47 C72 63 61 73 48 78 C35 73 24 63 24 47 V27 Z" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
      <path d="M58 50 A11 11 0 1 1 49 39 L55 39" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 32 L57 39 L50 46" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
