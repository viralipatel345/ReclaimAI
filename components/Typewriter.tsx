"use client";
import { useEffect, useState } from "react";

/** Types `text` out once (≈14ms/char). Renders it whole when `animate` is false or motion is reduced. */
export function Typewriter({ text, animate }: { text: string; animate: boolean }) {
  const [n, setN] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setN(text.length), 0);
      return () => clearTimeout(t);
    }
    const id = setInterval(() => setN((k) => (k >= text.length ? (clearInterval(id), k) : k + 2)), 14);
    return () => clearInterval(id);
  }, [text, animate]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] bg-accent" aria-hidden="true" />}
    </>
  );
}
