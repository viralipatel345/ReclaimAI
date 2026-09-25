"use client";
// Runs the chase loop while the tracker is open: drafts due reminders / FTC complaints,
// then asks Gemini (timeline facts only) to write each new reminder's line.
import { useEffect } from "react";
import { chase, polishReminder, timelineFacts } from "./escalation";
import { getCase, setCase, updateCase } from "./useCase";
import { postJson } from "./api";
import type { Case } from "./types";

const polished = new Set<string>();

export function useChase(c: Case | null | undefined, now: number, demo: boolean) {
  const minute = Math.floor(now / 60000);

  useEffect(() => {
    const current = getCase();
    if (!current || !minute) return;
    const next = chase(current, Date.now(), demo);
    if (next !== current) setCase(next);
  }, [minute, demo, c?.requests]);

  useEffect(() => {
    if (!c) return;
    for (const m of c.outbox ?? []) {
      if (m.kind !== "reminder" || m.aiSource === "gemini" || polished.has(m.id)) continue;
      const r = c.requests.find((x) => x.id === m.requestId);
      if (!r?.sentAt) continue;
      polished.add(m.id);
      postJson<{ text: string; source: string }>("/api/followup", { kind: "reminder", facts: timelineFacts(c, r, Date.now(), m.hourMark) }).then((out) => {
        if (out?.text && out.source !== "template") updateCase((x) => polishReminder(x, m.id, out.text));
      });
    }
  }, [c]);
}
