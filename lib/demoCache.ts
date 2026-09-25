// Recorded Gemini output for the fictional demo case (data/demoCache.json). Used only in
// demo mode: when the presenter prefers cached responses, or live Gemini is slow/unreachable.
import cache from "@/data/demoCache.json";
import type { Detection } from "./detect";

export type AiSource = "live" | "cached" | "template";

export const DEMO_CACHE = cache as {
  recordedAt: string;
  openings: Record<string, string>;
  detections: Record<string, Detection>;
  ftcSummary: Record<string, string>;
  reminders: Record<string, string>;
};

export function cachedOpening(platformId: string): string | undefined {
  return DEMO_CACHE.openings[platformId];
}

export function cachedDetection(postId: string): Detection | undefined {
  const d = DEMO_CACHE.detections[postId];
  return d ? { ...d } : undefined;
}

export function cachedFollowUp(kind: "reminder" | "ftc", platformName: string, hourMark?: number): string | undefined {
  return kind === "ftc" ? DEMO_CACHE.ftcSummary[platformName] : DEMO_CACHE.reminders[`${platformName}:${hourMark}`];
}

/** Reject if a promise takes longer than `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export const SERVER_AI_TIMEOUT_MS = 8000;
export const CLIENT_TIMEOUT_MS = 10000;
