// Gemini function-calling agent. Tool declarations live here; each flow picks the
// subset it needs and supplies TypeScript handlers. A flow ends when the model
// calls its designated final tool, whose arguments are the flow's structured output.
import { FunctionCallingConfigMode, type Content, type FunctionDeclaration } from "@google/genai";
import { generate } from "./gemini";
import { normalizeUrl } from "./platforms";
import { resolvePlatform } from "./resolve";

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
  | "draft_ftc_complaint"
  | "flag_post";

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
  flag_post: {
    name: "flag_post",
    description: "Judge whether one post's TEXT (caption, comments) suggests it shares the person's intimate content. You never see images.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["likely", "possible", "unrelated"] },
        explanation: { ...str, description: "One short, plain sentence citing the text evidence. Don't describe or speculate about what any image shows." },
      },
      required: ["level", "explanation"],
    },
  },
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
    description: "Classify a platform's emailed reply to a removal request.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["acknowledged", "removed", "rejected", "unclear"] },
        summary: { ...str, description: "One plain sentence describing what the platform said. No names, emails or links." },
        asksForImages: { ...bool, description: "True if the reply asks the person to send, upload or attach images, videos or screenshots." },
      },
      required: ["status", "summary", "asksForImages"],
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
    description: "Write ONE short, firm, courteous sentence for a reminder to a platform at the 24h or 44h mark.",
    parametersJsonSchema: { type: "object", properties: { text: str }, required: ["text"] },
  },
  draft_ftc_complaint: {
    name: "draft_ftc_complaint",
    description: "Write a 2-3 sentence first-person factual summary for an FTC complaint, using only the facts given.",
    parametersJsonSchema: { type: "object", properties: { summary: str }, required: ["summary"] },
  },
};

export type ToolHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;

/** Default handlers usable by any flow. */
export const BASE_HANDLERS: Partial<Record<ToolName, ToolHandler>> = {
  resolve_platform: async ({ url }) => {
    const normalized = normalizeUrl(String(url ?? ""));
    if (!normalized) return { error: "Not a valid web link." };
    const p = await resolvePlatform(normalized);
    return { platform: p.name, channel: p.channel, target: p.target, confidence: p.confidence, message: p.message ?? null };
  },
};

export interface AgentRun<T> {
  output: T;
  /** Every final-tool call from the finishing turn (models may call in parallel). */
  outputs: { name: ToolName; args: T }[];
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
  finalTool: ToolName | ToolName[];
  handlers?: Partial<Record<ToolName, ToolHandler>>;
  maxSteps?: number;
  model?: string;
}): Promise<AgentRun<T>> {
  const handlers = { ...BASE_HANDLERS, ...opts.handlers };
  const contents = [...opts.contents];
  const toolCalls: string[] = [];
  let model = "";
  const finals = new Set<ToolName>(Array.isArray(opts.finalTool) ? opts.finalTool : [opts.finalTool]);

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

    const finalCalls = calls.filter((c) => finals.has(c.name as ToolName));
    if (finalCalls.length > 0) {
      const outputs = finalCalls.map((c) => ({ name: c.name as ToolName, args: (c.args ?? {}) as T }));
      toolCalls.push(...outputs.map((o) => o.name));
      return { output: outputs[0].args, outputs, model, toolCalls };
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
  throw new Error(`Agent did not call ${[...finals].join("/")} within the step limit`);
}
