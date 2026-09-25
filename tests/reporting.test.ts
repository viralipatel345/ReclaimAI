import { describe, expect, it } from "vitest";
import { subscribeStatus } from "@/lib/incident/events";
import { fileReport, stepLog } from "@/lib/incident/reporting";
import { unresolvedPlatform } from "@/lib/platforms";
import type { IncidentStore } from "@/lib/incident/store";
import type { CaseReport, StatusEvent } from "@/lib/incident/types";

function memStore(): IncidentStore {
  const map = new Map<string, CaseReport>();
  return {
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
    async listDue() {
      return [];
    },
  };
}

/** Deterministic clock: each call advances one minute. */
function ticking(start = Date.UTC(2026, 8, 25, 12, 0, 0)) {
  let t = start;
  return () => new Date((t += 60_000)).toISOString();
}

const base: CaseReport = {
  id: "case_1",
  userId: "usr_1",
  branch: "MANUAL",
  status: "ANALYZED",
  title: "Someone posted my photos",
  notes: "He wants money.",
  reporter: { legalName: "Jane Doe", contactEmail: "jane@example.com", signature: "Jane Doe", signedAt: "2026-09-25T11:00:00.000Z" },
  isDraft: true,
  assets: [{ id: "ast_1", caseId: "case_1", kind: "image", mimeType: "image/jpeg", sha256: "ab".repeat(32), bytes: 100, createdAt: "2026-09-25T11:30:00.000Z" }],
  verifications: [
    {
      id: "ver_1",
      caseId: "case_1",
      assetId: "ast_1",
      synthId: { isGoogleAiGenerated: false, synthIdConfidence: 0, modality: "image", source: "stub", checkedAt: "2026-09-25T11:30:00.000Z" },
      c2pa: { present: true, c2paIssuer: "Adobe", claimGenerator: "Adobe Firefly 2.0", aiGenerated: true, assertions: ["c2pa.actions"], source: "jumbf-scan" },
      verdict: "ai_generated",
      summary: "Content Credentials declare AI generation.",
      createdAt: "2026-09-25T11:30:00.000Z",
    },
  ],
  escalations: [],
  reports: [],
  harnessRuns: [],
  events: [{ id: "evt_0", caseId: "case_1", status: "DRAFT", text: "Report created.", at: "2026-09-25T11:00:00.000Z" }],
  createdAt: "2026-09-25T11:00:00.000Z",
  updatedAt: "2026-09-25T11:30:00.000Z",
};

describe("platform notice", () => {
  it("resolves a directory platform, drafts the notice, simulates the send and starts the 48h clock, logging each step with a timestamp", async () => {
    const seen: StatusEvent[] = [];
    const off = subscribeStatus((e) => seen.push(e));
    const c = await fileReport(base, "platform", { url: "https://imgvault.example/u/jane/3021", demo: true, store: memStore(), clock: ticking() });
    off();

    const r = c.reports[0];
    expect(r.status).toBe("simulated");
    expect(r.reference).toBe("ImgVault");
    expect(r.destination).toBe("takedown@imgvault.example");
    expect(r.deadlineAt).toBe(new Date(new Date(r.startedAt).getTime() + 48 * 3_600_000).toISOString());
    expect(r.artifact?.title).toContain("TAKE IT DOWN Act removal request — Jane Doe");
    expect(r.artifact?.mailto).toMatch(/^mailto:takedown%40imgvault\.example/);
    expect(r.steps.map((s) => s.text)).toEqual([
      "Located the content at imgvault.example.",
      "Resolved ImgVault — official removal channel is email (takedown@imgvault.example).",
      "Drafted the notice: identification of the content, good-faith statement, the 48-hour obligation, your contact details and signature.",
      "Sent to takedown@imgvault.example (demo — nothing actually left the app).",
      expect.stringMatching(/^48-hour clock started — ImgVault must remove it by /),
    ]);
    const stamps = r.steps.map((s) => s.at);
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(stamps.length);
    expect(c.status).toBe("ESCALATED");
    expect(c.events[0].text).toBe("Platform takedown notice sent (demo) — ImgVault.");
    expect(seen.filter((e) => e.text.startsWith("Platform takedown notice:"))).toHaveLength(5);
  });

  it("prepares (does not send) outside demo mode, and fails cleanly without reporter details", async () => {
    const real = await fileReport(base, "platform", { url: "https://imgvault.example/x", demo: false, store: memStore(), clock: ticking() });
    expect(real.reports[0].status).toBe("prepared");
    expect(real.reports[0].deadlineAt).toBeUndefined();

    const noReporter = await fileReport({ ...base, reporter: undefined }, "platform", { url: "https://imgvault.example/x", demo: true, store: memStore(), clock: ticking() });
    expect(noReporter.reports[0].status).toBe("failed");
    expect(noReporter.reports[0].error).toMatch(/name, a contact email and your typed signature/);
    expect(noReporter.status).toBe("ANALYZED");
  });

  it("falls back to an unresolved platform when the host is unknown and no resolver is configured", async () => {
    const c = await fileReport(base, "platform", { url: "https://unknown-site.test/p/1", demo: true, store: memStore(), clock: ticking(), resolve: async (u) => unresolvedPlatform(u) });
    expect(c.reports[0].status).toBe("prepared");
    expect(c.reports[0].steps[1].text).toMatch(/Couldn't confirm/);
    expect(c.reports[0].artifact?.fields?.some((f) => f.label === "Full request")).toBe(true);
  });
});

describe("other channels", () => {
  it("stopncii fingerprints assets and simulates a case; refuses with nothing scanned", async () => {
    const c = await fileReport(base, "stopncii", { demo: true, store: memStore(), clock: ticking() });
    expect(c.reports[0].status).toBe("simulated");
    expect(c.reports[0].reference).toMatch(/^SNCII-/);
    expect(c.reports[0].artifact?.body).toContain("ab".repeat(32));
    const none = await fileReport({ ...base, assets: [], verifications: [] }, "stopncii", { demo: true, store: memStore(), clock: ticking() });
    expect(none.reports[0].status).toBe("failed");
  });

  it("ftc compiles a timeline from prior report steps and hands off outside demo", async () => {
    const store = memStore();
    const clock = ticking();
    const withNotice = await fileReport(base, "platform", { url: "https://imgvault.example/u/1", demo: true, store, clock });
    const c = await fileReport(withNotice, "ftc", { demo: false, store, clock });
    const r = c.reports[0];
    expect(r.status).toBe("handed_off");
    expect(r.destination).toBe("https://reportfraud.ftc.gov/");
    expect(r.artifact?.body).toContain("ImgVault (takedown@imgvault.example)");
    expect(r.artifact?.body).toContain("Platform takedown notice: Located the content at imgvault.example.");
    expect(r.steps.some((s) => s.text.includes("deadline") && s.text.includes("hasn't passed"))).toBe(true);
  });

  it("police prepares a dispatch summary the user files themselves", async () => {
    const c = await fileReport(base, "police", { demo: true, store: memStore(), clock: ticking() });
    expect(c.reports[0].status).toBe("prepared");
    expect(c.reports[0].artifact?.body).toMatch(/^WHAT:.*\nWHEN:.*\nWHERE:.*\nEVIDENCE:.*\nREPORTER: Jane Doe/);
  });

  it("parasell records the escalation on the case", async () => {
    const c = await fileReport(base, "parasell", { demo: true, store: memStore(), clock: ticking() });
    expect(c.reports[0].status).toBe("simulated");
    expect(c.reports[0].reference).toBe("demo_case_1");
    expect(c.escalations[0].status).toBe("accepted");
  });

  it("refuses to file on a sealed record", async () => {
    await expect(fileReport({ ...base, status: "SEALED", isDraft: false }, "police", { demo: true, store: memStore() })).rejects.toMatchObject({ status: 409 });
  });
});

describe("stepLog", () => {
  it("merges report steps and case events oldest-first", async () => {
    const store = memStore();
    const clock = ticking();
    let c = await fileReport(base, "police", { demo: true, store, clock });
    c = await fileReport(c, "stopncii", { demo: true, store, clock });
    const log = stepLog(c);
    expect(log[0]).toMatchObject({ channel: null, text: "Report created." });
    expect(log.map((l) => l.at)).toEqual([...log.map((l) => l.at)].sort());
    expect(log.filter((l) => l.channel === "police")).toHaveLength(3);
    expect(log.filter((l) => l.channel === "stopncii")).toHaveLength(3);
  });
});
