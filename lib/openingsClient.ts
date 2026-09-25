"use client";
// Greetings for drafted requests: live Gemini via /api/draft with a timeout; in demo mode
// the recorded cache fills anything missing, so drafting never stalls on stage.
import { postJson } from "./api";
import { recordAi } from "./aiStatus";
import { cachedOpening } from "./demoCache";
import type { OpeningsResult, OpeningTarget } from "./draft";

export async function fetchOpenings(targets: OpeningTarget[], demo: boolean): Promise<OpeningsResult> {
  const res = await postJson<OpeningsResult>("/api/draft", { targets });
  const openings = { ...(res?.openings ?? {}) };
  let source: OpeningsResult["source"] = res?.source ?? "template";
  if (demo) {
    for (const t of targets) {
      if (!openings[t.platformId] && cachedOpening(t.platformId)) {
        openings[t.platformId] = cachedOpening(t.platformId)!;
        if (source !== "gemini") source = "cached";
      }
    }
  }
  recordAi("Request greetings", source === "gemini" ? "live" : source === "cached" ? "cached" : "template");
  return { openings, source };
}
