"use client";
// Resolves links the directory doesn't know via /api/resolve (Gemini + Google Search,
// hostname only). Each link is attempted once per page session.
import { useEffect, useSyncExternalStore } from "react";
import { updateCase } from "./useCase";
import { postJson } from "./api";
import type { Case, ResolvedPlatform } from "./types";

const attempted = new Set<string>();
let inflight: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setInflight(next: Set<string>) {
  inflight = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const EMPTY: ReadonlySet<string> = new Set();

export async function fetchResolution(url: string): Promise<ResolvedPlatform | null> {
  return postJson<ResolvedPlatform>("/api/resolve", { url }, 22000);
}

/** Returns the ids of links currently being checked. */
export function useResolveLinks(c: Case | null | undefined): ReadonlySet<string> {
  const pending = useSyncExternalStore(subscribe, () => inflight, () => EMPTY);
  useEffect(() => {
    if (!c) return;
    for (const link of c.links) {
      if (link.platform.source !== "unresolved" || attempted.has(link.id)) continue;
      attempted.add(link.id);
      setInflight(new Set(inflight).add(link.id));
      fetchResolution(link.url).then((platform) => {
        const next = new Set(inflight);
        next.delete(link.id);
        setInflight(next);
        if (platform && platform.source !== "unresolved") {
          updateCase((x) => ({ ...x, links: x.links.map((l) => (l.id === link.id ? { ...l, platform } : l)) }));
        }
      });
    }
  }, [c]);
  return pending;
}
