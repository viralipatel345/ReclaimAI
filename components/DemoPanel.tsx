"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { simulatePlatformResponses } from "@/lib/caseOps";
import { resetDemo, startBlankCase, updateCase } from "@/lib/useCase";
import { Icon } from "./Icon";

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return !!node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable);
}

/** Hidden presenter controls. Shift+D toggles. */
export function DemoPanel() {
  const [open, setOpen] = useState(false);
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
      <button className={btn} disabled title="Wired up in step 6">
        <Icon name="refresh" size={16} /> Fast-forward 3 days
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
      <p className="px-2 pt-2 text-[11px] text-panel-muted">Shift+D to hide</p>
    </div>
  );
}
