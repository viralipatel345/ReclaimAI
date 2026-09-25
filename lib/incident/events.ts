// In-process status bus feeding the Reports + Status tab (SSE at /api/incident/status).
// Swap for Redis pub/sub or Firestore listeners when running more than one instance.
import type { StatusEvent } from "./types";

type Listener = (evt: StatusEvent) => void;

const g = globalThis as unknown as { __reclaimStatusBus?: Set<Listener> };
const listeners = (g.__reclaimStatusBus ??= new Set<Listener>());

export function publishStatus(evt: StatusEvent): void {
  for (const fn of listeners) {
    try {
      fn(evt);
    } catch (err) {
      console.warn("[status-bus] listener failed", err);
    }
  }
}

export function subscribeStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
