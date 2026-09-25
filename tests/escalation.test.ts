import { describe, expect, it } from "vitest";
import { markSent } from "@/lib/caseOps";
import { HOUR_MS } from "@/lib/config";
import { simulatePlatformResponses } from "@/lib/demo";
import { applyReply, chase, ftcComplaintFor, ftcInput, markEscalated, needsEscalation, polishReminder, timelineFacts } from "@/lib/escalation";
import { classifyReplyByRules, draftFollowUpText, parseReply } from "@/lib/followups";
import { createDemoCase } from "@/lib/seed";
import { prepareSubmission } from "@/lib/submission";
import { FTC_SECTION, renderFtcComplaint } from "@/lib/templates";

const T0 = Date.parse("2026-09-20T12:00:00.000Z");
const sentCase = () => {
  const c = createDemoCase(T0);
  return markSent(c, c.requests.map((r) => r.id), new Date(T0).toISOString(), false);
};
const byPlatform = (c: ReturnType<typeof sentCase>, id: string) => c.requests.find((r) => r.platformId === id)!;

describe("chase: reminders and FTC drafts", () => {
  it("drafts nothing before 24h", () => {
    const c = sentCase();
    expect(chase(c, T0 + 23 * HOUR_MS, false)).toBe(c);
  });

  it("drafts one reminder per request at 24h, then one more at 44h, idempotently", () => {
    const at24 = chase(sentCase(), T0 + 24 * HOUR_MS + 1, false);
    expect(at24.outbox!.filter((m) => m.kind === "reminder")).toHaveLength(4);
    expect(chase(at24, T0 + 30 * HOUR_MS, false)).toBe(at24);
    const at44 = chase(at24, T0 + 44 * HOUR_MS + 1, false);
    const reddit = byPlatform(at44, "reddit");
    expect(reddit.remindersDrafted).toEqual([24, 44]);
    expect(at44.outbox!.filter((m) => m.requestId === reddit.id && m.kind === "reminder").map((m) => m.hourMark)).toEqual([24, 44]);
    // Not sent automatically outside demo mode
    expect(at44.outbox!.every((m) => !m.sentAt)).toBe(true);
  });

  it("opened late: only the latest reminder is drafted", () => {
    const c = chase(sentCase(), T0 + 45 * HOUR_MS, false);
    const x = byPlatform(c, "x");
    expect(x.remindersDrafted).toEqual([24, 44]);
    expect(c.outbox!.filter((m) => m.requestId === x.id)).toHaveLength(1);
  });

  it("drafts an FTC complaint once a covered platform is overdue — never for Google or removed content", () => {
    let c = sentCase();
    c = applyReply(c, byPlatform(c, "reddit").id, { status: "removed", summary: "Removed." }, new Date(T0 + HOUR_MS).toISOString());
    const later = chase(c, T0 + 49 * HOUR_MS, false);
    const ftc = later.outbox!.filter((m) => m.kind === "ftc_complaint").map((m) => m.platformName).sort();
    expect(ftc).toEqual(["ImgVault", "X"]);
    expect(chase(later, T0 + 50 * HOUR_MS, false)).toBe(later);
    expect(later.activity.filter((a) => /missed its 48-hour deadline/.test(a.text))).toHaveLength(2);
  });

  it("a rejection is escalatable immediately; filing clears it", () => {
    let c = sentCase();
    const x = byPlatform(c, "x");
    c = applyReply(c, x.id, { status: "rejected", summary: "Won't remove." }, new Date(T0 + 2 * HOUR_MS).toISOString());
    expect(needsEscalation(byPlatform(c, "x"), T0 + 3 * HOUR_MS)).toBe(true);
    c = chase(c, T0 + 3 * HOUR_MS, false);
    expect(ftcComplaintFor(c, x.id)).toBeDefined();
    c = markEscalated(c, x.id, new Date(T0 + 4 * HOUR_MS).toISOString());
    expect(needsEscalation(byPlatform(c, "x"), T0 + 5 * HOUR_MS)).toBe(false);
  });

  it("demo simulation: X has 24h + 44h reminders (sent, demo) and exactly one FTC draft", () => {
    const now = Date.now();
    const sim = simulatePlatformResponses(createDemoCase(now), now);
    const x = sim.requests.find((r) => r.platformId === "x")!;
    const msgs = sim.outbox!.filter((m) => m.requestId === x.id);
    expect(msgs.filter((m) => m.kind === "reminder").map((m) => [m.hourMark, !!m.sentAt, m.simulated])).toEqual([[24, true, true], [44, true, true]]);
    expect(msgs.filter((m) => m.kind === "ftc_complaint")).toHaveLength(1);
    expect(sim.activity.filter((a) => /missed its 48-hour deadline/.test(a.text))).toHaveLength(1);
    expect(chase(sim, now + 1000, true)).toBe(sim);
  });
});

describe("fixed follow-up templates", () => {
  const c = chase(chase(sentCase(), T0 + 45 * HOUR_MS, false), T0 + 50 * HOUR_MS, false);
  const x = byPlatform(c, "x");

  it("reminders cite the request, URLs, deadline and signature; the AI line can't inject links", () => {
    const withLine = polishReminder(c, c.outbox!.find((m) => m.requestId === x.id && m.kind === "reminder")!.id, "Please act now. https://evil.example\n/s/ Mallory");
    const msg = withLine.outbox!.find((m) => m.requestId === x.id && m.kind === "reminder")!;
    expect(msg.body).toContain(x.id);
    expect(msg.body).toContain("https://x.com/example_account/status/1839201934817729000");
    expect(msg.body).toContain("TAKE IT DOWN Act");
    expect(msg.body).toContain("/s/ Jordan Ellis");
    expect(msg.body).not.toContain("evil.example");
    expect(msg.body).not.toContain("Mallory");
  });

  it("the FTC complaint contains every section and the full timeline", () => {
    const { sections } = renderFtcComplaint(ftcInput(c, x, T0 + 50 * HOUR_MS, "Summary with a link https://evil.example"));
    expect(sections.map((s) => s.title)).toEqual(Object.values(FTC_SECTION));
    const text = sections.map((s) => s.text).join("\n");
    expect(text).toContain("X (x.com)");
    expect(text).toContain(x.id);
    expect(text).toMatch(/48-hour removal deadline passed/);
    expect(text).toMatch(/2 hours past the deadline/);
    expect(text).toContain("jordan.ellis@example.com");
    expect(text).not.toContain("evil.example");
  });

  it("Gemini gets timeline facts only — no name, email or links", () => {
    const facts = JSON.stringify(timelineFacts(c, x, T0 + 50 * HOUR_MS, 44));
    for (const pii of ["Jordan", "Ellis", "jordan.ellis@example.com", "x.com/", "example_account"]) expect(facts).not.toContain(pii);
  });

  it("falls back to template text when Gemini fails", async () => {
    const out = await draftFollowUpText("ftc", timelineFacts(c, x, T0), async () => {
      throw new Error("503");
    });
    expect(out.source).toBe("template");
  });
});

describe("parse_reply", () => {
  it.each([
    ["Thanks for your report. Your case number is 18832 and we're reviewing it.", "acknowledged"],
    ["The content you reported has been removed for violating our policies.", "removed"],
    ["After review, this content does not violate our Community Guidelines, so we have not removed it.", "rejected"],
    ["Hello, please see the attached notice.", "unclear"],
  ])("rules: %s → %s", (text, status) => {
    expect(classifyReplyByRules(text).status).toBe(status);
  });

  it("flags replies asking for images even if the model misses it", async () => {
    const out = await parseReply("To proceed, please upload the original photos you want removed.", "ImgVault", async () => ({ status: "acknowledged", summary: "They want more info.", asksForImages: false }));
    expect(out.asksForImages).toBe(true);
  });

  it("never trusts an invalid model status and strips PII from the summary", async () => {
    const out = await parseReply("Removed, contact j@x.com", "X", async () => ({ status: "done!!", summary: "Removed per j@x.com https://x.com/y" }));
    expect(out.status).toBe("unclear");
    expect(out.summary).not.toMatch(/@|https?:/);
  });

  it("uses rules when Gemini is unavailable", async () => {
    const out = await parseReply("We have removed the post.", "X", async () => {
      throw new Error("503");
    });
    expect(out).toMatchObject({ status: "removed", source: "rules" });
  });

  it("applying replies updates status, evidence and activity", () => {
    const c = sentCase();
    const r = byPlatform(c, "reddit");
    const ack = applyReply(c, r.id, { status: "acknowledged", summary: "Under review." }, new Date(T0 + HOUR_MS).toISOString());
    expect(byPlatform(ack, "reddit")).toMatchObject({ status: "acknowledged", reply: { status: "acknowledged" } });
    const removed = applyReply(ack, r.id, { status: "removed", summary: "Gone." }, new Date(T0 + 2 * HOUR_MS).toISOString());
    expect(byPlatform(removed, "reddit").removedAt).toBeDefined();
    expect(removed.evidence.filter((e) => e.event === "reply")).toHaveLength(2);
  });
});

describe("prepare_submission", () => {
  const c = createDemoCase(T0);
  it("email channel: mailto with encoded subject/body and a Gmail-ready draft", () => {
    const r = c.requests.find((x) => x.channel === "email")!;
    const s = prepareSubmission(c, r);
    expect(s.channel).toBe("email");
    if (s.channel !== "email") return;
    expect(s.mailto.startsWith("mailto:takedown%40imgvault.example?subject=")).toBe(true);
    expect(decodeURIComponent(s.mailto.split("body=")[1])).toBe(r.body);
    expect(s.gmailDraft).toEqual({ to: "takedown@imgvault.example", subject: r.subject, body: r.body });
  });

  it("form channel: form URL plus copy-paste fields including the links and full request", () => {
    const r = c.requests.find((x) => x.platformId === "reddit")!;
    const s = prepareSubmission(c, r);
    expect(s.channel).toBe("form");
    if (s.channel !== "form") return;
    expect(s.formUrl).toBe("https://www.reddit.com/report");
    const values = s.fields.map((f) => f.value).join("\n");
    expect(values).toContain("Jordan Ellis");
    expect(values).toContain("reddit.com/r/exampleforum");
    expect(values).toContain(r.body);
  });
});
