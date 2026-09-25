"use client";
// Presentational pieces for the iMessage-style onboarding thread. No case logic lives here.
import { forwardRef, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUp, ChevronLeft, LogOut } from "lucide-react";
import { quickExit } from "@/lib/quickExit";
import styles from "./chat.module.css";

export type Sender = "ai" | "me";

/** The Reclaim mark, used as the conversation avatar. Same drawing as the landing page. */
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

export function ChatHeader() {
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
      <div className="grid h-[76px] grid-cols-[1fr_auto_1fr] items-center px-2">
        <Link href="/" aria-label="Back to the front page" className="flex h-10 w-10 items-center justify-center rounded-full text-[#E1261C] hover:bg-black/[0.04]">
          <ChevronLeft size={26} strokeWidth={2.25} />
        </Link>
        <div className="flex flex-col items-center">
          <Mark size={34} />
          <p className="mt-1 text-[13px] font-[700] leading-tight tracking-[-0.01em]">Reclaim</p>
          <p className="text-[11px] leading-tight text-[#6B7280]">Deepfake takedown agent</p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={quickExit}
            className="flex h-9 items-center gap-1.5 rounded-full border border-black/10 px-3 text-[13px] font-semibold text-[#0E1116] hover:bg-black/[0.04]"
          >
            <LogOut size={14} />
            <span>Quick exit</span>
            <kbd className="hidden rounded bg-black/[0.06] px-1 text-[10px] font-medium text-[#6B7280] sm:inline">Esc</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}

export function DayDivider({ date }: { date: Date | null }) {
  if (!date) return <div className="h-5" aria-hidden="true" />;
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <p className="py-1 text-center text-[11px] font-medium text-[#6B7280]">
      <span className="font-semibold">Today</span> {time}
    </p>
  );
}

/** Entrance for a new bubble: a small slide plus scale from the sender's side. */
export function Appear({ from, children, className = "" }: { from: Sender; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ transformOrigin: from === "me" ? "bottom right" : "bottom left" }}
      className={`flex w-full flex-col ${from === "me" ? "items-end" : "items-start"} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Bubble({
  from,
  first,
  last,
  children,
  italic = false,
}: {
  from: Sender;
  first: boolean;
  last: boolean;
  children: ReactNode;
  italic?: boolean;
}) {
  const side = from === "me" ? styles.out : styles.in;
  const corners =
    from === "me"
      ? `${first ? "" : styles.outNotFirst} ${last ? styles.tailOut : styles.outNotLast}`
      : `${first ? "" : styles.inNotFirst} ${last ? styles.tailIn : styles.inNotLast}`;
  return (
    <div className={`${styles.bubble} ${side} ${corners} ${italic ? "italic" : ""}`}>
      {children}
    </div>
  );
}

/** A white card on Reclaim's side, for embedded tools (Gmail, ID check, signature). */
export function CardBubble({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="w-full max-w-[92%] rounded-[18px] border border-[#E5E7EB] bg-white p-3.5 shadow-[0_1px_2px_rgba(14,17,22,0.04)] sm:max-w-[86%]">
      {children}
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className={`${styles.bubble} ${styles.in} ${styles.tailIn}`} aria-label="Reclaim is typing" role="status">
      <span className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
    </div>
  );
}

export interface QuickReply {
  id: string;
  label: string;
}

export function QuickReplies({ items, onPick, disabled }: { items: QuickReply[]; onPick: (id: string) => void; disabled: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2 px-4 pb-2" aria-label="Quick replies">
      {items.map((q) => (
        <button
          key={q.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q.id)}
          className="rounded-full border-[1.5px] border-[#E1261C] bg-white px-4 py-2 text-[15px] font-semibold text-[#E1261C] transition hover:bg-[#FDECEA] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

export type ComposerMode = "url" | "email" | "text" | "off";

const MODE_ATTRS: Record<Exclude<ComposerMode, "off">, { type: string; inputMode: "url" | "email" | "text"; autoComplete: string; autoCapitalize: string }> = {
  url: { type: "url", inputMode: "url", autoComplete: "off", autoCapitalize: "off" },
  email: { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "off" },
  text: { type: "text", inputMode: "text", autoComplete: "name", autoCapitalize: "words" },
};

export const Composer = forwardRef<
  HTMLInputElement,
  {
    mode: ComposerMode;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    disabled: boolean;
  }
>(function Composer({ mode, placeholder, value, onChange, onSend, disabled }, ref) {
  const off = mode === "off" || disabled;
  const attrs = mode === "off" ? MODE_ATTRS.text : MODE_ATTRS[mode];
  const canSend = !off && value.trim().length > 0;
  return (
    <form
      noValidate // normalizeUrl adds https:// and Reclaim replies to bad input; the browser's own bubble would block that.
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="flex items-center gap-2 px-4 pt-1"
    >
      <label htmlFor="chat-composer" className="sr-only">
        {placeholder}
      </label>
      <input
        ref={ref}
        id="chat-composer"
        type={attrs.type}
        inputMode={attrs.inputMode}
        autoComplete={attrs.autoComplete}
        autoCapitalize={attrs.autoCapitalize}
        autoCorrect={mode === "text" ? "on" : "off"}
        spellCheck={mode === "text"}
        enterKeyHint="send"
        placeholder={placeholder}
        value={value}
        disabled={off}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 min-w-0 flex-1 rounded-full border border-[#E5E7EB] bg-white px-4 text-[16px] text-[#0E1116] placeholder:text-[#9CA3AF] focus:border-[#E1261C] focus:outline-none disabled:bg-[#F5F6F8] disabled:text-[#9CA3AF]"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!canSend}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E1261C] text-white transition hover:bg-[#B3130F] disabled:bg-[#D1D5DB] disabled:hover:bg-[#D1D5DB]"
      >
        <ArrowUp size={20} strokeWidth={2.5} />
      </button>
    </form>
  );
});
