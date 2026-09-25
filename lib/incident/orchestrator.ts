// Gemini orchestration loop. Builds one structured prompt from user notes, scrape
// results and provenance, asks for JSON that matches SUGGESTION_SCHEMA, and loops
// when the model asks for more web context (bounded). Falls back to deterministic
// rules when Gemini is unavailable so the action engine always has something to show.
import { MODELS } from "../config";
import { generate, GeminiUnavailableError, hasGeminiKey } from "../gemini";
import { searchWeb, type WebSearch } from "./context";
import type { AgentAction, AgentActionType, AgentSuggestions, CaseReport, ProvenancePayload, RiskLevel, ScrapeSource } from "./types";
import { provenancePayload } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/orchestrator is server-only");

export const HELPLINES = {
  ccri: { name: "CCRI Image Abuse Helpline", number: "844-878-2274" },
  crisis: { name: "988 Suicide & Crisis Lifeline", number: "988" },
  emergency: { name: "Emergency", number: "911" },
} as const;

const ACTION_TYPES: AgentActionType[] = ["add_evidence", "call_helpline", "notify_friends_family", "report_police", "report_parasell"];
const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "critical"];

export const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Two plain sentences: what appears to have happened and how strong the evidence is." },
    riskLevel: { type: "string", enum: RISK_LEVELS },
    aiGenerationAssessment: { type: "string", description: "One sentence on whether the media is AI-generated, citing SynthID / C2PA facts only." },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ACTION_TYPES },
          priority: { type: "string", enum: ["now", "soon", "optional"] },
          title: { type: "string" },
          rationale: { type: "string", description: "Why this step, in one sentence, grounded in the case facts." },
          payload: {
            type: "object",
            properties: {
              helplineNumber: { type: "string" },
              smsText: { type: "string", description: "For notify_friends_family: a short message the user could send, no details of the imagery." },
              dispatchSummary: { type: "string", description: "For report_police: WHAT / WHEN / WHERE(URLs) / EVIDENCE in four short lines." },
            },
          },
        },
        required: ["type", "priority", "title", "rationale"],
      },
    },
    followUpQuery: { type: "string", description: "A web search that would materially change your advice. Empty string when none is needed." },
  },
  required: ["summary", "riskLevel", "aiGenerationAssessment", "actions", "followUpQuery"],
} as const;

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the case analyst for Reclaim, a platform that helps adults respond to non-consensual intimate imagery, impersonation and AI-generated abuse.

You receive a case as JSON: the user's own notes, web context gathered by an automated scraper (branch DISCOVER) or none (branch MANUAL), and a media provenance report from Google SynthID and C2PA Content Credentials.

Rules:
- Ground every statement in the supplied facts. Never invent URLs, names, dates or detector results.
- Treat provenance carefully: isGoogleAiGenerated=true with synthIdConfidence >= 0.8 is strong evidence of AI generation; a C2PA issuer with aiGenerated=true is strong evidence for that vendor; "inconclusive" means the detectors could not check, not that the media is real.
- Never ask what the imagery shows and never describe it.
- Choose only actions that fit: call_helpline when the person seems distressed or unsure; notify_friends_family when they mention isolation or ongoing harassment; report_police for threats, extortion, stalking, minors, or repeat offenders; report_parasell when there is at least one verifiable URL or asset; add_evidence when the case has no assets or the scrape found media that hasn't been scanned.
- Priority "now" is reserved for safety (police, helpline) and for time-sensitive removal.
- No legal advice beyond: covered platforms must remove reported intimate imagery within 48 hours under the US TAKE IT DOWN Act, and the FTC enforces this.
- Set followUpQuery only when a specific web search would change your recommendation. Otherwise return an empty string.

Respond with JSON matching the schema exactly.`;

export interface OrchestratorInput {
  branch: CaseReport["branch"];
  title: string;
  notes: string;
  provenance: ProvenancePayload;
  assetCount: number;
  unscannedMediaUrls: number;
  scrape?: { query: string; sources: ScrapeSource[] };
  extraContext?: ScrapeSource[];
}

/** Strip e-mail addresses and phone numbers from free text before it reaches the model. */
export function redact(text: string): string {
  return text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]").replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
}

export function buildCasePrompt(input: OrchestratorInput): string {
  const facts = {
    branch: input.branch,
    title: redact(input.title),
    userNotes: redact(input.notes),
    provenance: input.provenance,
    assetsScanned: input.assetCount,
    scrapedMediaNotYetScanned: input.unscannedMediaUrls,
    webContext: {
      scrapeQuery: input.scrape?.query ?? null,
      sources: [...(input.scrape?.sources ?? []), ...(input.extraContext ?? [])].slice(0, 12).map((s) => ({ url: s.url, title: s.title, snippet: redact(s.snippet) })),
    },
  };
  return `Case facts:\n${JSON.stringify(facts, null, 2)}`;
}

export function inputFromCase(c: CaseReport, extraContext?: ScrapeSource[]): OrchestratorInput {
  const scanned = new Set(c.assets.map((a) => a.sourceUrl).filter(Boolean));
  const unscanned = (c.scrape?.mediaUrls ?? []).filter((u) => !scanned.has(u)).length;
  return {
    branch: c.branch,
    title: c.title,
    notes: c.notes,
    provenance: provenancePayload(c.verifications),
    assetCount: c.assets.length,
    unscannedMediaUrls: unscanned,
    scrape: c.scrape ? { query: c.scrape.query, sources: c.scrape.sources } : undefined,
    extraContext,
  };
}

// ---------- deterministic fallback ----------

const DISTRESS = /\b(scared|afraid|terrified|can'?t (?:sleep|cope)|hopeless|alone|no one|nobody|suicid|kill myself|end it)\b/i;
const THREAT = /\b(threat|extort|blackmail|sextort|money|pay|stalk|following me|showed up|knows where i live|ex[- ]?(?:boyfriend|girlfriend|partner)|again|keeps? posting)\b/i;

export function ruleBasedSuggestions(input: OrchestratorInput, at = new Date().toISOString()): AgentSuggestions {
  const text = `${input.title} ${input.notes}`;
  const distress = DISTRESS.test(text);
  const threat = THREAT.test(text);
  const p = input.provenance;
  const hasEvidence = input.assetCount > 0 || (input.scrape?.sources.length ?? 0) > 0;

  const actions: AgentAction[] = [];
  if (distress || threat) {
    actions.push({
      type: "call_helpline",
      priority: "now",
      title: `Call the ${HELPLINES.ccri.name}`,
      rationale: "Trained advocates can talk through immediate safety and next steps.",
      payload: { helplineNumber: HELPLINES.ccri.number },
    });
  }
  if (threat) {
    actions.push({
      type: "report_police",
      priority: "now",
      title: "Report to police",
      rationale: "Threats, extortion or stalking are crimes on their own and strengthen platform removals.",
      payload: { dispatchSummary: buildDispatchSummary(input) },
    });
  }
  if (!hasEvidence || input.unscannedMediaUrls > 0) {
    actions.push({ type: "add_evidence", priority: "soon", title: "Add links or media", rationale: "Provenance checks and escalation need at least one URL or file." });
  }
  if (hasEvidence) {
    actions.push({ type: "report_parasell", priority: distress || threat ? "soon" : "now", title: "Send the case to Parasell", rationale: "Files a verified report with the provenance results attached." });
  }
  if (distress) {
    actions.push({
      type: "notify_friends_family",
      priority: "optional",
      title: "Let someone you trust know",
      rationale: "You don't have to explain details; one message can make the next days easier.",
      payload: { smsText: "I'm dealing with something hard online right now and could use some support. Can we talk soon?" },
    });
  }

  const riskLevel: RiskLevel = threat && distress ? "critical" : threat ? "high" : distress || p.verdict === "ai_generated" ? "medium" : "low";
  const aiLine =
    p.verdict === "ai_generated"
      ? `Detectors indicate AI generation${p.isGoogleAiGenerated ? ` (SynthID, ${Math.round(p.synthIdConfidence * 100)}%)` : p.c2paIssuer ? ` (Content Credentials from ${p.c2paIssuer})` : ""}.`
      : p.verdict === "likely_ai"
        ? "A partial AI-generation signal was found but not confirmed."
        : p.verdict === "inconclusive"
          ? "The detectors could not check this media."
          : "No AI-generation signal was detected.";

  return {
    summary: `${input.branch === "DISCOVER" ? "Automated discovery" : "Manual report"} with ${input.assetCount} scanned asset(s) and ${input.scrape?.sources.length ?? 0} web source(s). ${aiLine}`,
    riskLevel,
    aiGenerationAssessment: aiLine,
    actions,
    source: "rules",
    iterations: 0,
    generatedAt: at,
  };
}

/** Guided dispatch format for a police report: facts only, never a description of the imagery. */
export function buildDispatchSummary(input: OrchestratorInput): string {
  const urls = (input.scrape?.sources ?? []).map((s) => s.url).slice(0, 5);
  return [
    `WHAT: Non-consensual intimate imagery / impersonation reported via Reclaim (${input.branch === "DISCOVER" ? "found by automated search" : "reported by the victim"}).`,
    `WHEN: Reported ${new Date().toISOString().slice(0, 10)}.`,
    `WHERE: ${urls.length ? urls.join(", ") : "URLs to be supplied by the reporter."}`,
    `EVIDENCE: ${input.assetCount} file(s) hashed and checked for AI generation — verdict ${input.provenance.verdict}${input.provenance.c2paIssuer ? `, Content Credentials issuer ${input.provenance.c2paIssuer}` : ""}.`,
  ].join("\n");
}

// ---------- Gemini ----------

interface ModelOutput {
  summary: string;
  riskLevel: RiskLevel;
  aiGenerationAssessment: string;
  actions: AgentAction[];
  followUpQuery: string;
}

function validate(raw: unknown): ModelOutput | null {
  const o = raw as Partial<ModelOutput> | null;
  if (!o || typeof o.summary !== "string" || !RISK_LEVELS.includes(o.riskLevel as RiskLevel) || !Array.isArray(o.actions)) return null;
  const actions = o.actions
    .filter((a): a is AgentAction => !!a && ACTION_TYPES.includes(a.type) && typeof a.title === "string" && typeof a.rationale === "string")
    .map((a) => ({ ...a, priority: (["now", "soon", "optional"] as const).includes(a.priority) ? a.priority : "soon" }))
    .slice(0, 5);
  if (actions.length === 0) return null;
  return {
    summary: o.summary,
    riskLevel: o.riskLevel as RiskLevel,
    aiGenerationAssessment: typeof o.aiGenerationAssessment === "string" ? o.aiGenerationAssessment : "",
    actions,
    followUpQuery: typeof o.followUpQuery === "string" ? o.followUpQuery.trim() : "",
  };
}

export type SuggestionModel = (prompt: string) => Promise<{ text: string; model: string }>;

const geminiModel: SuggestionModel = async (prompt) => {
  const res = await generate({
    model: MODELS.primary,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction: ORCHESTRATOR_SYSTEM_PROMPT, temperature: 0.2, responseMimeType: "application/json", responseJsonSchema: SUGGESTION_SCHEMA },
  });
  return { text: res.response.text ?? "", model: res.model };
};

export const MAX_CONTEXT_ROUNDS = 2;

/**
 * Analyze a case. Loops while the model asks for more web context (max MAX_CONTEXT_ROUNDS),
 * then returns structured suggestions. Any model failure degrades to rule-based output.
 */
export async function analyzeCase(
  input: OrchestratorInput,
  deps: { model?: SuggestionModel; search?: WebSearch } = {},
): Promise<AgentSuggestions> {
  const model = deps.model ?? (hasGeminiKey() ? geminiModel : null);
  if (!model) return ruleBasedSuggestions(input);
  const search = deps.search ?? searchWeb;

  let extra: ScrapeSource[] = [...(input.extraContext ?? [])];
  const asked = new Set<string>();
  let lastModel = "";

  for (let round = 0; round <= MAX_CONTEXT_ROUNDS; round++) {
    let out: ModelOutput | null;
    try {
      const res = await model(buildCasePrompt({ ...input, extraContext: extra }));
      lastModel = res.model;
      out = validate(JSON.parse(res.text));
    } catch (err) {
      if (!(err instanceof GeminiUnavailableError)) console.warn("[orchestrator] model round failed", err instanceof Error ? err.message : err);
      out = null;
    }
    if (!out) return { ...ruleBasedSuggestions(input), iterations: round };

    const q = out.followUpQuery;
    if (q && round < MAX_CONTEXT_ROUNDS && !asked.has(q.toLowerCase())) {
      asked.add(q.toLowerCase());
      const more = await search(q, 5);
      if (more.length > 0) {
        extra = [...extra, ...more];
        continue;
      }
    }
    return {
      summary: out.summary,
      riskLevel: out.riskLevel,
      aiGenerationAssessment: out.aiGenerationAssessment,
      actions: out.actions.map((a) => (a.type === "call_helpline" && !a.payload?.helplineNumber ? { ...a, payload: { ...a.payload, helplineNumber: HELPLINES.ccri.number } } : a)),
      source: "gemini",
      model: lastModel,
      iterations: round,
      generatedAt: new Date().toISOString(),
    };
  }
  return ruleBasedSuggestions(input);
}
