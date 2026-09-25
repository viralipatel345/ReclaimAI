"use client";
// Client → API calls with a hard timeout. Returns null on any failure so callers can fall
// back (demo cache or template) instead of hanging on a spinner.
import { CLIENT_TIMEOUT_MS, type AiSource } from "./demoCache";
import { preferCached } from "./aiStatus";

export async function postJson<T>(url: string, body: Record<string, unknown>, timeoutMs = CLIENT_TIMEOUT_MS): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, preferCache: preferCached() }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export type { AiSource };
