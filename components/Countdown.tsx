"use client";
import { useNow } from "@/lib/useNow";
import { hms } from "@/lib/time";

/** Live HH:MM:SS to a deadline; counts up with "+" once it has passed. */
export function Countdown({ deadlineAt, className = "" }: { deadlineAt: string; className?: string }) {
  const now = useNow();
  if (!now) return <span className={`font-mono tabular ${className}`}>--:--:--</span>;
  const diff = new Date(deadlineAt).getTime() - now;
  const text = diff >= 0 ? hms(diff) : `+${hms(-diff)}`;
  return (
    <span className={`font-mono tabular ${className}`} aria-live="off">
      {text}
    </span>
  );
}
