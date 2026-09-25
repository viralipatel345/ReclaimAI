"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { simulatePlatformResponses } from "@/lib/demo";
import { getCase, resetDemo, startBlankCase, updateCase } from "@/lib/useCase";
import { fastForward } from "@/lib/demo";
import { recheckNow } from "@/lib/recheckClient";
import { setPreferCached, useAiStatus } from "@/lib/aiStatus";
import { Icon } from "./Icon";

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return !!node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable);
}

/** Hidden presenter controls. Shift+D toggles. */
export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d") && !isTyping(e.target)) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const btn = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div role="dialog" aria-label="Demo controls" className="fixed bottom-4 right-4 z-50 w-64 rounded-2xl bg-panel p-3 text-white shadow-2xl">
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-panel-muted">Demo controls</span>
        <button onClick={() => setOpen(false)} aria-label="Close demo controls" className="rounded p-1 hover:bg-white/10">
          <Icon name="x" size={14} />
        </button>
      </div>
      <button
        className={btn}
        onClick={() => {
          updateCase((c) => simulatePlatformResponses(c, Date.now()));
          router.push("/case/tracker");
        }}
      >
        <Icon name="sparkle" size={16} /> Simulate platform responses
      </button>
      <button
        className={btn}
        disabled={busy}
        onClick={async () => {
          const c = getCase();
          if (!c) return;
          setBusy(true);
          const now = Date.now();
          await recheckNow(fastForward(c, now), now);
          setBusy(false);
          router.push("/case/tracker");
        }}
      >
        <Icon name="refresh" size={16} className={busy ? "animate-spin" : ""} /> {busy ? "Re-checking…" : "Fast-forward 3 days"}
      </button>
      <button
        className={btn}
        onClick={() => {
          startBlankCase();
          router.push("/case");
        }}
      >
        <Icon name="plus" size={16} /> Start blank case (live intake)
      </button>
      <button
        className={btn}
        onClick={() => {
          resetDemo();
          router.push("/case");
        }}
      >
        <Icon name="trash" size={16} /> Reset demo
      </button>
      <AiIndicator />
      <p className="break-all px-2 pt-2 text-[11px] leading-relaxed text-panel-muted">
        Shift+D to hide · Recovery URLs: <span className="font-mono">/demo?preset=fresh|sent|simulated|escalation|fastforward</span>
      </p>
    </div>
  );
}

/** Live vs cached Gemini — visible only here, never to judges on the main screen. */
function AiIndicator() {
  const { events, preferCached } = useAiStatus();
  const tone = { live: "bg-[#6FC39D]", cached: "bg-[#E7C46F]", template: "bg-panel-muted" } as const;
  return (
    <div className="mt-2 border-t border-panel-line px-2 pt-2">
      <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
        <span>Use cached Gemini responses</span>
        <input type="checkbox" checked={preferCached} onChange={(e) => setPreferCached(e.target.checked)} className="accent-[#3446A8]" />
      </label>
      <ul className="mt-2 space-y-1">
        {events.length === 0 && <li className="text-[11px] text-panel-muted">No Gemini calls yet.</li>}
        {events.map((e) => (
          <li key={e.at + e.step} className="flex items-center gap-2 text-[11px]">
            <span className={`h-1.5 w-1.5 rounded-full ${tone[e.source]}`} />
            <span className="flex-1 truncate">{e.step}</span>
            <span className="font-mono uppercase text-panel-muted">{e.source}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
