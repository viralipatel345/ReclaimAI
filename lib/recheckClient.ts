"use client";
import { getCase, setCase } from "./useCase";
import type { Case } from "./types";

/** Ask the server recheck agent to check this case now. Returns the number of changes. */
export async function recheckNow(c: Case, now?: number): Promise<{ changes: number; checked: number } | null> {
  try {
    const res = await fetch("/api/recheck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case: c, now }) });
    if (!res.ok) return null;
    const out = (await res.json()) as { case: Case; changes: number; checked: number };
    if (getCase()?.id === out.case.id || getCase() === null) setCase(out.case);
    return { changes: out.changes, checked: out.checked };
  } catch {
    return null;
  }
}
