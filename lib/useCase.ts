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

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced copy to the server store so the scheduled recheck agent can see the case. */
function syncToServer(c: Case) {
  if (typeof window === "undefined" || c.isAdult === false) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch("/api/case", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c), keepalive: true }).catch(() => {});
  }, 1500);
}

/** Remove the server copy (Quick exit, under-18). Uses sendBeacon so it survives navigation. */
export function deleteServerCopy(id: string) {
  if (typeof navigator === "undefined") return;
  if (syncTimer) clearTimeout(syncTimer);
  const payload = JSON.stringify({ id, delete: true });
  if (!navigator.sendBeacon?.("/api/case", new Blob([payload], { type: "application/json" }))) {
    fetch("/api/case", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  }
}

export function setCase(next: Case | null) {
  current = next;
  localMirror.save(next);
  if (next) syncToServer(next);
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
  const id = current?.id ?? localMirror.load()?.id;
  if (id) deleteServerCopy(id);
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
