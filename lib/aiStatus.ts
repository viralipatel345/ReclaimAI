"use client";
// Demo-only: remembers whether each Gemini step was answered live, from the recorded cache,
// or by the template, and whether the presenter chose cached responses. Shown in Shift+D.
import { useSyncExternalStore } from "react";
import type { AiSource } from "./demoCache";

export interface AiEvent {
  step: string;
  source: AiSource;
  at: number;
}

const KEY = "reclaim.demo.preferCache";
let events: AiEvent[] = [];
let prefer = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function preferCached(): boolean {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      prefer = window.localStorage.getItem(KEY) === "1";
    } catch {}
  }
  return prefer;
}

export function setPreferCached(v: boolean) {
  prefer = v;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  emit();
}

export function recordAi(step: string, source: AiSource) {
  events = [{ step, source, at: Date.now() }, ...events].slice(0, 6);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAiStatus() {
  const ev = useSyncExternalStore(subscribe, () => events, () => events);
  const pref = useSyncExternalStore(subscribe, preferCached, () => false);
  return { events: ev, preferCached: pref };
}
