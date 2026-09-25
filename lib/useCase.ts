"use client";
// Client-side reactive access to the active case (localStorage mirror).
import { useSyncExternalStore } from "react";
import { createDemoCase } from "./seed";
import { localMirror } from "./store";
import type { Case } from "./types";

let current: Case | null | undefined;
let demoMode = false;
const listeners = new Set<() => void>();

export function configureClient(opts: { demoMode: boolean }) {
  demoMode = opts.demoMode;
}

function read(): Case | null {
  if (current === undefined) {
    current = localMirror.load();
    if (!current && demoMode) {
      current = createDemoCase();
      localMirror.save(current);
    }
  }
  return current;
}

export function setCase(next: Case | null) {
  current = next;
  localMirror.save(next);
  listeners.forEach((l) => l());
}

export function updateCase(fn: (c: Case) => Case) {
  const c = read();
  if (c) setCase(fn(c));
}

export function resetDemo() {
  setCase(createDemoCase());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Returns undefined during SSR/hydration, then the case (or null if none). */
export function useCase(): Case | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
