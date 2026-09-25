import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { counts, displayStatus, markSent, simulatePlatformResponses } from "@/lib/caseOps";
import { DEADLINE_HOURS, HOUR_MS } from "@/lib/config";
import { buildEvidencePdf } from "@/lib/evidencePdf";
import { createDemoCase } from "@/lib/seed";
import { hms, hoursMinutes } from "@/lib/time";

const NOW = Date.parse("2026-09-25T18:00:00.000Z");

describe("48-hour clock", () => {
  it("starts at send time and ends 48h later", () => {
    const c = createDemoCase(NOW);
    const at = new Date(NOW).toISOString();
    const sent = markSent(c, c.requests.map((r) => r.id), at, true);
    for (const r of sent.requests) {
      expect(r.sentAt).toBe(at);
      expect(Date.parse(r.deadlineAt!) - NOW).toBe(DEADLINE_HOURS * HOUR_MS);
      expect(displayStatus(r, NOW + 47 * HOUR_MS)).toBe("in_progress");
      expect(displayStatus(r, NOW + 48 * HOUR_MS + 1000)).toBe("overdue");
    }
    expect(sent.evidence.filter((e) => e.event === "sent")).toHaveLength(4);
  });

  it("formats countdowns", () => {
    expect(hms(48 * HOUR_MS - 1000)).toBe("47:59:59");
    expect(hms(2 * HOUR_MS + 14 * 60000 + 9000)).toBe("02:14:09");
    expect(hoursMinutes(19 * HOUR_MS + 42 * 60000)).toBe("19h 42m");
  });
});

describe("Simulate platform responses", () => {
  const sim = simulatePlatformResponses(createDemoCase(NOW), NOW);
  const byId = Object.fromEntries(sim.requests.map((r) => [r.platformId, r]));

  it("Reddit removed in 19h 42m, Google acknowledged, X overdue, ImgVault in progress", () => {
    expect(displayStatus(byId.reddit, NOW)).toBe("removed");
    expect(Date.parse(byId.reddit.removedAt!) - Date.parse(byId.reddit.sentAt!)).toBe(19 * HOUR_MS + 42 * 60000);
    expect(displayStatus(byId["google-search"], NOW)).toBe("acknowledged");
    expect(displayStatus(byId.x, NOW)).toBe("overdue");
    expect(displayStatus(byId.imgvault, NOW)).toBe("in_progress");
    expect(counts(sim, NOW)).toEqual({ removed: 1, inProgress: 2, overdue: 1, ready: 0 });
  });

  it("logs replies as evidence and is idempotent", () => {
    expect(sim.evidence.filter((e) => e.event === "reply")).toHaveLength(2);
    expect(simulatePlatformResponses(sim, NOW + 1000)).toBe(sim);
  });
});

describe("evidence PDF", () => {
  const sim = simulatePlatformResponses(createDemoCase(NOW), NOW);
  const pdf = buildEvidencePdf(sim, jsPDF, NOW).output();

  it("contains every URL, fingerprint and request status", () => {
    const text = pdf.replace(/\\\(/g, "(").replace(/\\\)/g, ")");
    for (const e of sim.evidence) expect(text).toContain(e.fingerprint);
    expect(text).toContain("OVERDUE");
    expect(text).toContain("EXAMPLE CASE");
    expect(text).toContain("imgvault.example/v/a7Qx2Lm9");
  });

  it("contains no image data", () => {
    expect(pdf).not.toMatch(/\/Subtype\s*\/Image/);
    // jsPDF always writes an XObject resource dictionary; it must stay empty.
    for (const dict of pdf.match(/\/XObject\s*<<([\s\S]*?)>>/g) ?? []) expect(dict.replace(/\/XObject\s*<<|>>|\s/g, "")).toBe("");
    expect(pdf).not.toMatch(/\/DCTDecode|\/JPXDecode/);
  });
});
