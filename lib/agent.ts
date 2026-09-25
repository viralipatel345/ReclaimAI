// Gemini function-calling agent. Tool declarations live here; each flow picks the
// subset it needs and supplies TypeScript handlers. A flow ends when the model
// calls its designated final tool, whose arguments are the flow's structured output.
import { FunctionCallingConfigMode, type Content, type FunctionDeclaration } from "@google/genai";
import { generate } from "./gemini";
import { matchDirectory, normalizeUrl, unresolvedPlatform } from "./platforms";

export type ToolName =
  | "collect_intake"
  | "resolve_platform"
  | "draft_request"
  | "draft_google_removal"
  | "log_evidence"
  | "prepare_submission"
  | "start_clock"
  | "parse_reply"
  | "recheck"
  | "draft_reminder"
  | "draft_ftc_complaint";

const str = { type: "string" };
const bool = { type: "boolean" };

export const INTAKE_SCHEMA = {
  type: "object",
  properties: {
    reply: { ...str, description: "Your next message to the user: warm, brief, at most one question." },
    legalName: { ...str, description: "Name the requests should be sent under. Empty string if unknown." },
    contactEmail: { ...str, description: "Email platforms should reply to. Empty string if unknown." },
    isAdult: {
      type: "string",
      enum: ["adult", "minor", "unknown"],
      description: "\"minor\" if the user says or implies they are under 18 (then stop). \"adult\" if confirmed 18+. Otherwise \"unknown\".",
    },
    authorizesPreparation: { ...bool, description: "User wants Reclaim to prepare removal requests." },
    autoSendConsent: { ...bool, description: "User explicitly agreed that Reclaim may send requests for them." },
    links: { type: "array", items: str, description: "Every URL the user has shared so far." },
    attestation: {
      type: "object",
      properties: { text: str, signature: { ...str, description: "Typed full-name signature, only if the user typed it." } },
      required: ["text", "signature"],
    },
    missing: { type: "array", items: str, description: "Fields still needed: legalName, contactEmail, links, signature." },
  },
  required: ["reply", "legalName", "contactEmail", "isAdult", "authorizesPreparation", "autoSendConsent", "links", "attestation", "missing"],
} as const;

export const TOOL_DECLARATIONS: Record<ToolName, FunctionDeclaration> = {
  collect_intake: {
    name: "collect_intake",
    description: "Record the full, updated intake state and your reply to the user. Call exactly once per turn.",
    parametersJsonSchema: INTAKE_SCHEMA,
  },
  resolve_platform: {
    name: "resolve_platform",
    description: "Find the platform and official removal channel (web form or email) for a URL the user shared.",
    parametersJsonSchema: { type: "object", properties: { url: str }, required: ["url"] },
  },
  draft_request: {
    name: "draft_request",
    description: "Write a short courteous opening for a removal request. Legal sections are filled from a fixed template.",
    parametersJsonSchema: { type: "object", properties: { platformName: str, opening: str }, required: ["platformName", "opening"] },
  },
  draft_google_removal: {
    name: "draft_google_removal",
    description: "Write a short opening for a request to remove explicit results for the user's own name from Google Search.",
    parametersJsonSchema: { type: "object", properties: { opening: str }, required: ["opening"] },
  },
  log_evidence: {
    name: "log_evidence",
    description: "Record url, host, timestamps and sha256(url + page title). Never image data.",
    parametersJsonSchema: { type: "object", properties: { url: str }, required: ["url"] },
  },
  prepare_submission: {
    name: "prepare_submission",
    description: "Build a mailto link / Gmail draft (email channel) or the form URL plus copy-paste fields (form channel).",
    parametersJsonSchema: { type: "object", properties: { requestId: str }, required: ["requestId"] },
  },
  start_clock: {
    name: "start_clock",
    description: "Set deadlineAt = sentAt + 48 hours for a sent request.",
    parametersJsonSchema: { type: "object", properties: { requestId: str }, required: ["requestId"] },
  },
  parse_reply: {
    name: "parse_reply",
    description: "Classify a platform's emailed reply.",
    parametersJsonSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ["acknowledged", "removed", "rejected", "unclear"] }, summary: str },
      required: ["status", "summary"],
    },
  },
  recheck: {
    name: "recheck",
    description: "Classify a page's text as removed, live or unclear. Never guess: use unclear when unsure.",
    parametersJsonSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ["removed", "live", "unclear"] }, reason: str },
      required: ["status", "reason"],
    },
  },
  draft_reminder: {
    name: "draft_reminder",
    description: "Write a short, firm reminder to a platform at the 24h or 44h mark.",
    parametersJsonSchema: { type: "object", properties: { requestId: str, text: str }, required: ["requestId", "text"] },
  },
  draft_ftc_complaint: {
    name: "draft_ftc_complaint",
    description: "Write a factual summary for an FTC complaint about a platform that missed its 48-hour deadline.",
    parametersJsonSchema: { type: "object", properties: { requestId: str, summary: str }, required: ["requestId", "summary"] },
  },
};

export type ToolHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;

/** Default handlers usable by any flow. resolve_platform is directory-only here; Search grounding is added in step 3. */
export const BASE_HANDLERS: Partial<Record<ToolName, ToolHandler>> = {
  resolve_platform: ({ url }) => {
    const normalized = normalizeUrl(String(url ?? ""));
    if (!normalized) return { error: "Not a valid web link." };
    const p = matchDirectory(normalized) ?? unresolvedPlatform(normalized);
    return { platform: p.name, channel: p.channel, target: p.target, confidence: p.confidence, message: p.message ?? null };
  },
};

export interface AgentRun<T> {
  output: T;
  model: string;
  toolCalls: string[];
}

/**
 * Run a function-calling loop until the model calls `finalTool`.
 * Mode ANY forces a tool call every step, so the output is always schema-shaped.
 */
export async function runAgent<T>(opts: {
  systemInstruction: string;
  contents: Content[];
  tools: ToolName[];
  finalTool: ToolName;
  handlers?: Partial<Record<ToolName, ToolHandler>>;
  maxSteps?: number;
  model?: string;
}): Promise<AgentRun<T>> {
  const handlers = { ...BASE_HANDLERS, ...opts.handlers };
  const contents = [...opts.contents];
  const toolCalls: string[] = [];
  let model = "";

  for (let step = 0; step < (opts.maxSteps ?? 4); step++) {
    const res = await generate({
      model: opts.model,
      contents,
      config: {
        systemInstruction: opts.systemInstruction,
        temperature: 0.4,
        tools: [{ functionDeclarations: opts.tools.map((t) => TOOL_DECLARATIONS[t]) }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: opts.tools } },
      },
    });
    model = res.model;
    const calls = res.response.functionCalls ?? [];
    if (calls.length === 0) throw new Error("Model returned no tool call");

    const final = calls.find((c) => c.name === opts.finalTool);
    if (final) {
      toolCalls.push(opts.finalTool);
      return { output: (final.args ?? {}) as T, model, toolCalls };
    }

    const modelTurn = res.response.candidates?.[0]?.content;
    if (modelTurn) contents.push(modelTurn);
    const responses = await Promise.all(
      calls.map(async (c) => {
        const name = c.name as ToolName;
        toolCalls.push(name);
        const handler = handlers[name];
        const response = handler ? await handler(c.args ?? {}) : { error: `Tool ${name} is not available in this flow.` };
        return { functionResponse: { id: c.id, name, response } };
      }),
    );
    contents.push({ role: "user", parts: responses });
  }
  throw new Error(`Agent did not call ${opts.finalTool} within the step limit`);
}
