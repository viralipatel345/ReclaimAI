import { describe, expect, it, vi } from "vitest";
import { grantMandate, HarnessError, revokeMandate, runDueCases, runHarness, type Research } from "@/lib/incident/harness";
import { MANDATE_TEXT } from "@/lib/incident/mandate";
import { isDue, type IncidentStore } from "@/lib/incident/store";
import type { CaseReport, ImageMatch, ImageSearch } from "@/lib/incident/types";

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
    async listDue(now) {
      return [...map.values()].filter((c) => isDue(c, now));
    },
  };
}

const T0 = Date.UTC(2026, 8, 25, 12, 0, 0);
const AT = new Date(T0).toISOString();
const H = 3_600_000;

const ai = (pageUrl: string, title: string, confidence = 0.9): ImageMatch => ({
  url: pageUrl + "img.jpg",
  pageUrl,
  host: new URL(pageUrl).hostname.replace(/^www\./, ""),
  title,
  matchType: "full",
  risk: "shady",
  flagged: true,
  reasons: [`AI-generated (${Math.round(confidence * 100)}%): six fingers`],
  platformName: "Instagram",
  coveredByAct: true,
  ai: { verdict: "ai_generated", confidence, signs: ["six fingers"], source: "gemini-vision", synthId: "not_detected" },
  foundAt: AT,
});

const search = (matches: ImageMatch[]): ImageSearch => ({ assetId: "ast_1", scope: "web", provider: "gemini", subject: { name: "Some Star", confidence: 1, source: "user" }, labels: ["Some Star"], onlyAi: true, considered: 10, checked: 4, synthIdActive: false, matches, searchedAt: AT });

const base: CaseReport = {
  id: "case_h",
  userId: "usr_1",
  branch: "IMAGE_SEARCH",
  status: "ANALYZED",
  title: "Where is my image?",
  notes: "",
  reporter: { legalName: "Jane Doe", contactEmail: "jane@example.com", signature: "Jane Doe", signedAt: AT },
  isDraft: true,
  assets: [{ id: "ast_1", caseId: "case_h", kind: "image", mimeType: "image/jpeg", sha256: "ab".repeat(32), bytes: 10, createdAt: AT }],
  verifications: [],
  escalations: [],
  reports: [],
  harnessRuns: [],
  imageSearch: search([ai("https://www.instagram.com/p/OLD1/", "old.ai on Instagram")]),
  events: [],
  createdAt: AT,
  updatedAt: AT,
};

describe("mandate", () => {
  it("requires the reporter's exact signature and at least one allowed action", () => {
    expect(() => grantMandate(base, { signature: "Someone Else" }, AT)).toThrow(HarnessError);
    expect(() => grantMandate(base, { signature: "jane doe", allowedActions: [] }, AT)).toThrow(/at least one action/);
    const g = grantMandate(base, { signature: " jane   doe ", cadenceHours: 6 }, AT);
    expect(g.mandate).toMatchObject({ enabled: true, cadenceHours: 6, maxNoticesPerRun: 5, text: MANDATE_TEXT, grantedAt: AT });
    expect(g.mandate?.allowedActions).toEqual(["platform_notice", "stopncii", "ftc_after_deadline", "parasell"]);
    expect(g.nextCheckAt).toBe(AT);
    expect(isDue(g, T0)).toBe(true);
    const r = revokeMandate(g, AT);
    expect(r.mandate?.enabled).toBe(false);
    expect(isDue(r, T0 + H)).toBe(false);
  });

  it("refuses to run without a mandate", async () => {
    await expect(runHarness(base, { store: memStore(), demo: true })).rejects.toMatchObject({ status: 403 });
  });
});

describe("runHarness", () => {
  it("re-checks, sends notices only for NEW AI images within the mandate, registers StopNCII and Parasell once, and records every decision", async () => {
    const store = memStore();
    const research: Research = async () => search([ai("https://www.instagram.com/p/OLD1/", "old.ai on Instagram"), ai("https://www.instagram.com/p/NEW1/", "new.ai on Instagram: “#aiart”"), ai("https://imgvault.example/v/NEW2", "NEW2 — ImgVault", 0.8)]);
    const granted = grantMandate(base, { signature: "Jane Doe" }, AT);
    const c = await runHarness(granted, { store, demo: true, now: T0, research });

    const run = c.harnessRuns[0];
    expect(run).toMatchObject({ trigger: "manual", considered: 10, newAiMatches: 2 });
    expect(run.decisions.map((d) => `${d.kind}:${d.action}`)).toEqual(["auto:recheck", "auto:platform_notice", "auto:platform_notice", "auto:stopncii", "auto:parasell"]);
    expect(run.decisions[1]).toMatchObject({ target: "https://www.instagram.com/p/NEW1/", reason: expect.stringMatching(/^sent to Instagram, due /) });
    expect(run.decisions[2].reason).toMatch(/^sent to ImgVault/);
    expect(c.reports.filter((r) => r.channel === "platform").map((r) => r.url).sort()).toEqual(["https://imgvault.example/v/NEW2", "https://www.instagram.com/p/NEW1/"]);
    expect(c.reports.some((r) => r.channel === "stopncii" && r.status === "simulated")).toBe(true);
    expect(c.reports.some((r) => r.channel === "parasell" && r.status === "simulated")).toBe(true);
    expect(c.imageSearch?.matches.map((m) => m.pageUrl)).toEqual(["https://www.instagram.com/p/NEW1/", "https://imgvault.example/v/NEW2", "https://www.instagram.com/p/OLD1/"]);
    expect(c.nextCheckAt).toBe(new Date(T0 + 24 * H).toISOString());
    expect(c.status).toBe("ESCALATED");
    expect(c.events[0].text).toMatch(/^Agent check #1: 2 new AI images, 4 actions taken\. Next check /);

    // Second run: nothing new → no new notices, escalations not repeated.
    const c2 = await runHarness(c, { store, demo: true, now: T0 + 2 * H, research });
    expect(c2.harnessRuns[0].decisions.map((d) => `${d.kind}:${d.action}`)).toEqual(["auto:recheck"]);
    expect(c2.reports).toHaveLength(c.reports.length);
  });

  it("outside the mandate, new findings become 'needs you' decisions; the per-run cap holds", async () => {
    const store = memStore();
    const research: Research = async () => search([ai("https://www.instagram.com/p/A/", "a"), ai("https://www.instagram.com/p/B/", "b"), ai("https://www.instagram.com/p/C/", "c")]);
    const noNotices = grantMandate({ ...base, imageSearch: search([]) }, { signature: "Jane Doe", allowedActions: ["stopncii"] }, AT);
    const c = await runHarness(noNotices, { store, demo: true, now: T0, research });
    expect(c.harnessRuns[0].decisions.filter((d) => d.kind === "needs_you")).toHaveLength(3);
    expect(c.reports.filter((r) => r.channel === "platform")).toHaveLength(0);

    const capped = grantMandate({ ...base, imageSearch: search([]) }, { signature: "Jane Doe", allowedActions: ["platform_notice"], maxNoticesPerRun: 2 }, AT);
    const c2 = await runHarness(capped, { store, demo: true, now: T0, research });
    expect(c2.reports.filter((r) => r.channel === "platform")).toHaveLength(2);
    expect(c2.harnessRuns[0].decisions.at(-1)).toMatchObject({ kind: "needs_you", reason: "per-run cap of 2 notices reached" });
  });

  it("files an FTC complaint only after a missed 48h deadline, only when the content is still up, and only once", async () => {
    const store = memStore();
    const research: Research = async () => search([ai("https://www.instagram.com/p/X/", "x")]);
    const granted = grantMandate({ ...base, imageSearch: search([]) }, { signature: "Jane Doe" }, AT);
    const c1 = await runHarness(granted, { store, demo: true, now: T0, research });
    expect(c1.reports.some((r) => r.channel === "ftc")).toBe(false);

    const stillUp = vi.fn(async () => true);
    const c2 = await runHarness(c1, { store, demo: true, now: T0 + 49 * H, research, stillUp });
    expect(stillUp).toHaveBeenCalledWith("https://www.instagram.com/p/X/");
    const ftc = c2.harnessRuns[0].decisions.find((d) => d.action === "ftc_after_deadline");
    expect(ftc).toMatchObject({ kind: "auto", reason: expect.stringMatching(/missed its deadline and the page is still up/) });
    expect(c2.reports.filter((r) => r.channel === "ftc")).toHaveLength(1);

    const c3 = await runHarness(c2, { store, demo: true, now: T0 + 60 * H, research, stillUp });
    expect(c3.reports.filter((r) => r.channel === "ftc")).toHaveLength(1);

    const gone = await runHarness(grantMandate({ ...c1, reports: c1.reports, harnessRuns: [] }, { signature: "Jane Doe" }, AT), { store, demo: true, now: T0 + 49 * H, research, stillUp: async () => false });
    expect(gone.harnessRuns[0].decisions.find((d) => d.action === "ftc_after_deadline")).toMatchObject({ kind: "skipped", reason: expect.stringMatching(/treated as removed/) });
  });

  it("runDueCases runs only due, mandated, unsealed cases", async () => {
    const store = memStore();
    const research: Research = async () => search([]);
    await store.save(grantMandate(base, { signature: "Jane Doe" }, AT));
    await store.save({ ...base, id: "case_nomandate" });
    await store.save({ ...grantMandate(base, { signature: "Jane Doe" }, AT), id: "case_future", nextCheckAt: new Date(T0 + 5 * H).toISOString() });
    await store.save({ ...grantMandate(base, { signature: "Jane Doe" }, AT), id: "case_sealed", status: "SEALED", isDraft: false });
    const out = await runDueCases(T0 + H, store, { research, demo: true });
    expect(out).toEqual({ ran: 1, actions: 2 }); // StopNCII + Parasell registered once for the existing AI match
    expect(store.map.get("case_h")?.harnessRuns[0]).toMatchObject({ trigger: "schedule" });
    expect(store.map.get("case_future")?.harnessRuns).toHaveLength(0);
  });
});
