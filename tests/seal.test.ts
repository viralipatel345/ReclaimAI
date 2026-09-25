import { describe, expect, it, vi } from "vitest";
import { subscribeStatus } from "@/lib/incident/events";
import { canonicalRecord, draftFrom, replaceWithOriginal, SealError, sealRecord } from "@/lib/incident/seal";
import type { IncidentStore } from "@/lib/incident/store";
import type { CaseReport, StatusEvent } from "@/lib/incident/types";

function memStore(): IncidentStore & { map: Map<string, CaseReport> } {
  const map = new Map<string, CaseReport>();
  return {
    map,
    async get(id) {
      return map.get(id) ?? null;
    },
    async save(c) {
      map.set(c.id, structuredClone(c));
    },
    async delete(id) {
      map.delete(id);
    },
    async listByUser(u) {
      return [...map.values()].filter((c) => c.userId === u);
    },
  };
}

const at = "2026-09-25T12:00:00.000Z";
const draft: CaseReport = {
  id: "case_draft",
  userId: "usr_1",
  branch: "MANUAL",
  status: "ANALYZED",
  title: "Report",
  notes: "n",
  isDraft: true,
  assets: [{ id: "ast_1", caseId: "case_draft", kind: "image", mimeType: "image/png", sha256: "abc", bytes: 10, createdAt: at }],
  verifications: [
    {
      id: "ver_1",
      caseId: "case_draft",
      assetId: "ast_1",
      synthId: { isGoogleAiGenerated: true, synthIdConfidence: 0.9, modality: "image", source: "vertex", checkedAt: at },
      c2pa: { present: false, assertions: [], source: "jumbf-scan" },
      verdict: "ai_generated",
      summary: "s",
      createdAt: at,
    },
  ],
  escalations: [],
  events: [{ id: "evt_0", caseId: "case_draft", status: "DRAFT", text: "created", at }],
  createdAt: at,
  updatedAt: at,
};

describe("sealRecord", () => {
  it("seals, hashes the canonical fields, and refuses a second seal", () => {
    const sealed = sealRecord(draft, at);
    expect(sealed).toMatchObject({ id: "case_draft", isDraft: false, status: "SEALED", sealedAt: at });
    expect(sealed.recordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.events[0]).toMatchObject({ status: "SEALED" });
    expect(() => sealRecord(sealed, at)).toThrow(SealError);
  });

  it("hash ignores event churn but changes when verified facts change", () => {
    const sealed = sealRecord(draft, at);
    const withMoreEvents = { ...sealed, events: [...sealed.events, { id: "x", caseId: sealed.id, status: "SEALED" as const, text: "later", at }] };
    expect(canonicalRecord(withMoreEvents)).toBe(canonicalRecord(sealed));
    const tampered = { ...sealed, verifications: [{ ...sealed.verifications[0], verdict: "no_signal" as const }] };
    expect(canonicalRecord(tampered)).not.toBe(canonicalRecord(sealed));
  });

  it("refuses to seal a draft with nothing verified", () => {
    expect(() => sealRecord({ ...draft, verifications: [], scrape: undefined }, at)).toThrow(/Nothing verified/);
  });
});

describe("replaceWithOriginal", () => {
  it("overwrites the primary record with the draft, deletes the draft, and publishes SEALED", async () => {
    const store = memStore();
    const original = { ...sealRecord(draft, at), id: "case_orig", notes: "old" };
    await store.save(original);
    const working = draftFrom(original, "case_work", at);
    working.notes = "new verified notes";
    await store.save(working);

    const seen: StatusEvent[] = [];
    const off = subscribeStatus((e) => seen.push(e));
    const sealed = await replaceWithOriginal("case_work", "usr_1", store);
    off();

    expect(sealed.id).toBe("case_orig");
    expect(store.map.get("case_orig")?.notes).toBe("new verified notes");
    expect(store.map.has("case_work")).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ caseId: "case_orig", status: "SEALED" });
  });

  it("rejects drafts owned by someone else", async () => {
    const store = memStore();
    await store.save(draft);
    await expect(replaceWithOriginal("case_draft", "usr_other", store)).rejects.toMatchObject({ status: 404 });
    expect(vi.isMockFunction(store.get)).toBe(false);
  });
});
