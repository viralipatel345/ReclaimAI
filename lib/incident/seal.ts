// "Replace with original": the verified draft overwrites the primary record. The
// sealed record gets a content hash over its canonical fields so later edits are
// detectable, the draft copy is removed, and a SEALED event is published.
import { sha256Hex } from "../hash";
import { incidentStore, statusEvent, type IncidentStore } from "./store";
import { publishStatus } from "./events";
import type { CaseReport } from "./types";

export class SealError extends Error {
  constructor(message: string, public status: 400 | 404 | 409 = 400) {
    super(message);
  }
}

/** Fields that define the record. Events and timestamps that change after sealing are excluded. */
export function canonicalRecord(c: CaseReport): string {
  const canonical = {
    id: c.originalId ?? c.id,
    userId: c.userId,
    branch: c.branch,
    title: c.title,
    notes: c.notes,
    assets: c.assets.map((a) => ({ sha256: a.sha256, mimeType: a.mimeType, bytes: a.bytes, sourceUrl: a.sourceUrl ?? null })).sort((a, b) => a.sha256.localeCompare(b.sha256)),
    verifications: c.verifications
      .map((v) => ({ assetId: v.assetId, verdict: v.verdict, synthId: v.synthId.isGoogleAiGenerated, confidence: v.synthId.synthIdConfidence, c2paIssuer: v.c2pa.c2paIssuer ?? null }))
      .sort((a, b) => a.assetId.localeCompare(b.assetId)),
    scrape: c.scrape ? { query: c.scrape.query, sources: c.scrape.sources.map((s) => s.url).sort() } : null,
    suggestions: c.suggestions ? { riskLevel: c.suggestions.riskLevel, actions: c.suggestions.actions.map((a) => a.type) } : null,
  };
  return JSON.stringify(canonical);
}

/** Pure transition: returns the sealed primary record built from the draft. */
export function sealRecord(draft: CaseReport, at: string): CaseReport {
  if (!draft.isDraft) throw new SealError("Record is already sealed", 409);
  if (draft.verifications.length === 0 && !draft.scrape) throw new SealError("Nothing verified yet: scan media or run discovery first", 400);
  const id = draft.originalId ?? draft.id;
  const sealed: CaseReport = {
    ...draft,
    id,
    originalId: undefined,
    isDraft: false,
    status: "SEALED",
    sealedAt: at,
    updatedAt: at,
    events: [statusEvent(id, "SEALED", "Verified record sealed and replaced the working draft.", at), ...draft.events.map((e) => ({ ...e, caseId: id }))],
  };
  return { ...sealed, recordHash: sha256Hex(canonicalRecord(sealed)) };
}

/**
 * Handler for the "replace with original" operation. Overwrites the primary record with
 * the draft's verified state, deletes the draft copy, and publishes the status update.
 */
export async function replaceWithOriginal(draftId: string, userId: string, store: IncidentStore = incidentStore): Promise<CaseReport> {
  const draft = await store.get(draftId);
  if (!draft || draft.userId !== userId) throw new SealError("Draft not found", 404);
  const sealed = sealRecord(draft, new Date().toISOString());
  await store.save(sealed);
  if (sealed.id !== draft.id) await store.delete(draft.id);
  publishStatus(sealed.events[0]);
  return sealed;
}

/** Start a new working draft from a sealed record (e.g. to add evidence after sealing). */
export function draftFrom(original: CaseReport, draftId: string, at: string): CaseReport {
  return { ...original, id: draftId, originalId: original.id, isDraft: true, status: "DRAFT", sealedAt: undefined, recordHash: undefined, updatedAt: at, events: [] };
}
