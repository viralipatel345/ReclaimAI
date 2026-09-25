import { describe, expect, it, vi } from "vitest";
import { analyzeCase, buildCasePrompt, HELPLINES, MAX_CONTEXT_ROUNDS, redact, ruleBasedSuggestions, type OrchestratorInput, type SuggestionModel } from "@/lib/incident/orchestrator";

const base: OrchestratorInput = {
  branch: "MANUAL",
  title: "Someone posted my photos",
  notes: "My ex keeps posting them and says he wants money. I'm scared and can't sleep. Reach me at jane@example.com or 415-555-0100.",
  provenance: { isGoogleAiGenerated: true, synthIdConfidence: 0.91, c2paIssuer: null, verdict: "ai_generated" },
  assetCount: 1,
  unscannedMediaUrls: 0,
};

describe("prompt construction", () => {
  it("redacts emails and phone numbers before they reach the model", () => {
    const prompt = buildCasePrompt(base);
    expect(prompt).not.toContain("jane@example.com");
    expect(prompt).not.toContain("415-555-0100");
    expect(prompt).toContain("[email]");
    expect(prompt).toContain('"verdict": "ai_generated"');
    expect(redact("call 020 7946 0958")).toBe("call [phone]");
  });
});

describe("rule-based fallback", () => {
  it("escalates threats + distress to critical with helpline and police first", () => {
    const s = ruleBasedSuggestions(base);
    expect(s.source).toBe("rules");
    expect(s.riskLevel).toBe("critical");
    expect(s.actions.map((a) => a.type)).toEqual(["call_helpline", "report_police", "report_parasell", "notify_friends_family"]);
    expect(s.actions[0].payload?.helplineNumber).toBe(HELPLINES.ccri.number);
    expect(s.actions[1].payload?.dispatchSummary).toMatch(/^WHAT:.*\nWHEN:.*\nWHERE:.*\nEVIDENCE:/);
    expect(s.aiGenerationAssessment).toContain("SynthID, 91%");
  });

  it("asks for evidence when nothing has been scanned", () => {
    const s = ruleBasedSuggestions({ ...base, notes: "Not sure what to do.", assetCount: 0, provenance: { ...base.provenance, verdict: "inconclusive", isGoogleAiGenerated: false, synthIdConfidence: 0 } });
    expect(s.riskLevel).toBe("low");
    expect(s.actions.map((a) => a.type)).toEqual(["add_evidence"]);
  });
});

describe("Gemini loop", () => {
  const good = { summary: "Two sentences.", riskLevel: "high", aiGenerationAssessment: "SynthID 91%.", actions: [{ type: "report_parasell", priority: "now", title: "Send", rationale: "Because." }], followUpQuery: "" };

  it("returns validated model output and defaults the helpline number", async () => {
    const model: SuggestionModel = async () => ({ text: JSON.stringify({ ...good, actions: [...good.actions, { type: "call_helpline", priority: "bogus", title: "Call", rationale: "R" }] }), model: "test" });
    const s = await analyzeCase(base, { model });
    expect(s.source).toBe("gemini");
    expect(s.model).toBe("test");
    expect(s.actions[1]).toMatchObject({ priority: "soon", payload: { helplineNumber: HELPLINES.ccri.number } });
  });

  it("runs another round when the model asks for context, bounded by MAX_CONTEXT_ROUNDS", async () => {
    const model = vi.fn<SuggestionModel>(async (prompt) => ({
      text: JSON.stringify({ ...good, followUpQuery: prompt.includes("extra-source") ? "" : "who is behind site x" }),
      model: "test",
    }));
    const search = vi.fn(async () => [{ url: "https://extra-source.example", title: "Extra", snippet: "s", fetchedAt: "now" }]);
    const s = await analyzeCase(base, { model, search });
    expect(search).toHaveBeenCalledWith("who is behind site x", 5);
    expect(model).toHaveBeenCalledTimes(2);
    expect(s.iterations).toBe(1);

    const loop = vi.fn<SuggestionModel>(async () => ({ text: JSON.stringify({ ...good, followUpQuery: "again" }), model: "t" }));
    const s2 = await analyzeCase(base, { model: loop, search });
    expect(loop).toHaveBeenCalledTimes(2);
    expect(s2.iterations).toBeLessThanOrEqual(MAX_CONTEXT_ROUNDS);
    expect(s2.source).toBe("gemini");
  });

  it("falls back to rules on malformed JSON or empty actions", async () => {
    const bad: SuggestionModel = async () => ({ text: "{not json", model: "t" });
    expect((await analyzeCase(base, { model: bad })).source).toBe("rules");
    const empty: SuggestionModel = async () => ({ text: JSON.stringify({ ...good, actions: [] }), model: "t" });
    expect((await analyzeCase(base, { model: empty })).source).toBe("rules");
  });
});
