"use client";
import { createContext, useContext, useEffect } from "react";
import { configureClient } from "@/lib/useCase";
import { quickExit } from "@/lib/quickExit";
import { DemoPanel } from "./DemoPanel";

const DemoContext = createContext(false);
export const useDemoMode = () => useContext(DemoContext);

export function Providers({ demoMode, children }: { demoMode: boolean; children: React.ReactNode }) {
  configureClient({ demoMode });

  // Quick exit: Esc from anywhere, including inside inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        quickExit();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    // Service worker makes the app installable (needed for Share → Reclaim). It caches nothing.
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  return (
    <DemoContext.Provider value={demoMode}>
      {children}
      {demoMode && <DemoPanel />}
    </DemoContext.Provider>
  );
}
