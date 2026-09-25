"use client";
import { getCase, setCase } from "./useCase";
import { postJson } from "./api";
import type { Case } from "./types";

/** Ask the server recheck agent to check this case now. Returns the number of changes. */
export async function recheckNow(c: Case, now?: number): Promise<{ changes: number; checked: number } | null> {
  const out = await postJson<{ case: Case; changes: number; checked: number }>("/api/recheck", { case: c, now }, 30000);
  if (!out) return null;
  if (getCase()?.id === out.case.id || getCase() === null) setCase(out.case);
  return { changes: out.changes, checked: out.checked };
}
