"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Hidden presenter controls. Shift+D toggles the panel. Hotkeys work on any page:
 *   1 = simulate platform responses · 2 = fast-forward 3 days · 0 = restart the demo
 */
export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const router = useRouter();

  const simulate = useCallback(() => {
    setOpen(false);
    updateCase((c) => simulatePlatformResponses(c, Date.now()));
    router.push("/case/tracker");
  }, [router]);

  const forward = useCallback(async () => {
    const c = getCase();
    if (!c || busyRef.current) return;
    busyRef.current = true;
    setOpen(false);
    setBusy(true);
    router.push("/case/tracker");
    const now = Date.now();
    await Promise.all([recheckNow(fastForward(c, now), now), new Promise((r) => setTimeout(r, 1400))]);
    busyRef.current = false;
    setBusy(false);
  }, [router]);

  const restart = useCallback(() => {
    setOpen(false);
    resetDemo();
    router.push("/case?auto=1");
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && (e.key === "D" || e.key === "d")) return setOpen((o) => !o);
      if (e.shiftKey) return;
      if (e.key === "1") simulate();
      else if (e.key === "2") forward();
      else if (e.key === "0") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [simulate, forward, restart]);

  const btn = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent";
  const kbd = "ml-auto rounded border border-white/20 px-1.5 font-mono text-micro text-panel-muted";
  return (
    <>
      {busy && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4" role="status" aria-live="polite">
          <div className="anim-rise flex items-center gap-3 rounded-full bg-panel px-5 py-3 text-white shadow-2xl">
            <Icon name="refresh" size={16} className="animate-spin" />
            <span className="font-display text-lg font-semibold">3 days later…</span>
            <span className="text-sm text-panel-muted">Reclaim is re-checking every link on its own</span>
          </div>
        </div>
      )}
      {open && (
    <div role="dialog" aria-label="Demo controls" className="fixed bottom-4 right-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-panel p-3 text-white shadow-2xl">
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="font-mono text-label uppercase tracking-widest text-panel-muted">Demo controls</span>
        <button onClick={() => setOpen(false)} aria-label="Close demo controls" className="rounded p-1 hover:bg-white/10">
          <Icon name="x" size={14} />
        </button>
      </div>
      <button className={btn} onClick={simulate}>
        <Icon name="sparkle" size={16} /> Simulate platform responses <kbd className={kbd}>1</kbd>
      </button>
      <button className={btn} disabled={busy} onClick={forward}>
        <Icon name="refresh" size={16} /> Fast-forward 3 days <kbd className={kbd}>2</kbd>
      </button>
      <button className={btn} onClick={restart}>
        <Icon name="trash" size={16} /> Restart demo <kbd className={kbd}>0</kbd>
      </button>
      <button
        className={btn}
        onClick={() => {
          setOpen(false);
          startBlankCase();
          router.push("/case");
        }}
      >
        <Icon name="plus" size={16} /> Start blank case
      </button>
      <AiIndicator />
      <p className="break-all px-2 pt-2 text-label leading-relaxed text-panel-muted">
        Shift+D to hide · Recovery URLs: <span className="font-mono">/demo?preset=fresh|sent|simulated|escalation|fastforward</span>
      </p>
    </div>
      )}
    </>
  );
}

/** Live vs cached Gemini — visible only here, never to judges on the main screen. */
function AiIndicator() {
  const { events, preferCached } = useAiStatus();
  const tone = { live: "bg-panel-removed", cached: "bg-panel-cached", template: "bg-panel-muted" } as const;
  return (
    <div className="mt-2 border-t border-panel-line px-2 pt-2">
      <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
        <span>Use cached Gemini responses</span>
        <input type="checkbox" checked={preferCached} onChange={(e) => setPreferCached(e.target.checked)} className="accent-accent" />
      </label>
      <ul className="mt-2 space-y-1">
        {events.length === 0 && <li className="text-label text-panel-muted">No Gemini calls yet.</li>}
        {events.map((e) => (
          <li key={e.at + e.step} className="flex items-center gap-2 text-label">
            <span className={`h-1.5 w-1.5 rounded-full ${tone[e.source]}`} />
            <span className="flex-1 truncate">{e.step}</span>
            <span className="font-mono uppercase text-panel-muted">{e.source}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
