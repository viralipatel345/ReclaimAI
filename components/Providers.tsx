"use client";
import { createContext, useContext, useEffect } from "react";
import { configureClient } from "@/lib/useCase";
import { quickExit } from "@/lib/quickExit";
import { DemoPanel } from "./DemoPanel";
import type { PublicAppConfig } from "@/lib/config";

const DemoContext = createContext(false);
export const useDemoMode = () => useContext(DemoContext);
const ConfigContext = createContext<PublicAppConfig>({ googleClientId: "", testPlatformInbox: "" });
export const useAppConfig = () => useContext(ConfigContext);

export function Providers({ demoMode, config, children }: { demoMode: boolean; config: PublicAppConfig; children: React.ReactNode }) {
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
      <ConfigContext.Provider value={config}>
        {children}
        {demoMode && <DemoPanel />}
      </ConfigContext.Provider>
    </DemoContext.Provider>
  );
}
