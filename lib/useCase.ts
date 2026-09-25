"use client";
// Client-side reactive access to the active case (localStorage mirror).
import { useSyncExternalStore } from "react";
import { createBlankCase, createDemoCase } from "./seed";
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

export function getCase(): Case | null {
  return read();
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

/** Called after the adult age check. Keeps an existing case; otherwise starts a blank one. */
export function ensureCase() {
  if (!read()) setCase(createBlankCase());
}

export function startBlankCase() {
  setCase(createBlankCase());
}

/** Under-18 route: drop everything, in memory and on disk. */
export function discardCase() {
  current = null;
  localMirror.clear();
  listeners.forEach((l) => l());
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
