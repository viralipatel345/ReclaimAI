// Conversational intake. Gemini drives the conversation via the collect_intake tool;
// deterministic code around it enforces the hard rules (under-18 stop, never ask
// about image content, links only) and fills in when Gemini is unavailable.
import type { Content } from "@google/genai";
import { runAgent } from "./agent";
import { extractUrl, normalizeUrl } from "./platforms";
import { ATTESTATION_TEXT } from "./templates";
import type { ChatMessage } from "./types";

export type IntakeField = "legalName" | "contactEmail" | "links" | "signature";
const FIELD_ORDER: IntakeField[] = ["legalName", "contactEmail", "links", "signature"];

export interface IntakeState {
  legalName: string;
  contactEmail: string;
  isAdult: boolean | null;
  authorizesPreparation: boolean;
  autoSendConsent: boolean;
  links: string[];
  attestation: { text: string; signature: string };
  missing: IntakeField[];
}

export interface IntakeTurnResult {
  route: "continue" | "under18";
  reply: string;
  /** Always null on the under-18 route: nothing is kept. */
  intake: IntakeState | null;
  source: "gemini" | "fallback" | "rule";
  model?: string;
}

interface ModelIntake {
  reply?: string;
  legalName?: string;
  contactEmail?: string;
  isAdult?: "adult" | "minor" | "unknown";
  authorizesPreparation?: boolean;
  autoSendConsent?: boolean;
  links?: string[];
  attestation?: { text?: string; signature?: string };
}

export type IntakeAgent = (contents: Content[], systemInstruction: string) => Promise<{ output: ModelIntake; model: string }>;

export const UNDER_18_REPLY =
  "Thank you for telling me. Reclaim is built for adults, but there's a free service made for you: Take It Down, from NCMEC. I haven't saved anything.";

export const INTAKE_SYSTEM_PROMPT = `You are the intake assistant for Reclaim, a tool that helps adult survivors of non-consensual intimate imagery (real or AI-generated) send legal removal requests under the US TAKE IT DOWN Act.

How you speak:
- Warm, calm, brief: one or two short sentences. Never blame, judge, or express shock. No exclamation marks.
- Ask exactly ONE question per turn, for the first item still missing, in this order: the full name requests should be sent under; an email platforms can reply to (a new address just for this is fine); the links to the content (they can paste them in chat or the link box); then ask them to tick the statement and type their name to sign below.
- When everything is collected, tell them they can press "Draft my requests".

Hard rules:
- NEVER ask what the images or videos show, how they were made, who made or posted them, or anything about their content. If the user volunteers details, don't follow up; say gently that you only need the links.
- Reclaim works with links only. Never ask for, or accept, uploads or screenshots.
- If the user says or implies they are under 18, set isAdult to "minor" and stop asking questions.
- No legal advice. The only legal point you may explain: covered platforms must remove reported content within 48 hours of a valid request, and the FTC enforces this. For anything else, say you can't give legal advice and suggest the CCRI Crisis Helpline (844-878-2274).
- Reclaim never contacts the person who posted the content, never logs in to platforms, and never posts anything. Don't offer to.
- Don't promise outcomes.
- If the user seems in immediate danger, share 911 and the 988 Suicide & Crisis Lifeline.

Every turn, call collect_intake exactly once with the complete updated state (carry forward everything already known) and your reply. Only fill attestation.signature if the user typed their full name as a signature.`;

// ---------- deterministic safety checks ----------

const MINOR_PATTERNS = [
  /\b(?:i'?m|i am|im)\s+(?:only\s+|just\s+)?(1[0-7]|[5-9])\b(?!\s*(?:minutes?|mins?|hours?|hrs?|links?|times?|days?|%|am|pm|of)\b)/i,
  /\b(1[0-7]|[5-9])\s*(?:years?\s*old|yrs?\s*old|y\/?o)\b/i,
  /\b(?:i'?m|i am|im)\s+(?:a\s+)?minor\b/i,
  /\b(?:i'?m|i am|im)\s+under\s*(?:18|eighteen)\b/i,
  /\bi'?m in (?:middle|high) school\b/i,
];

export function detectMinor(text: string): boolean {
  if (/\bnot\s+(?:a\s+)?(?:minor|under\s*18)\b/i.test(text)) return false;
  return MINOR_PATTERNS.some((re) => re.test(text));
}

const CONTENT_QUESTION = /\b(describe|what (?:do|does|did) (?:the |these |those )?(?:image|images|photo|photos|picture|pictures|video|videos|content)\b|what(?:'s| is) in (?:the |these )?(?:image|photo|video|picture)|who (?:took|posted|uploaded|made|shared)|how (?:were|was) (?:it|they) (?:made|taken))/i;

export function asksAboutContent(reply: string): boolean {
  return CONTENT_QUESTION.test(reply);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(s: unknown, max = 120): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function computeMissing(s: Omit<IntakeState, "missing">): IntakeField[] {
  const missing: IntakeField[] = [];
  if (s.legalName.length < 2) missing.push("legalName");
  if (!EMAIL_RE.test(s.contactEmail)) missing.push("contactEmail");
  if (s.links.length === 0) missing.push("links");
  if (s.attestation.signature.length < 2) missing.push("signature");
  return FIELD_ORDER.filter((f) => missing.includes(f));
}

const QUESTIONS: Record<IntakeField | "done", string> = {
  legalName: "What name should the requests go out under?",
  contactEmail: "What email should platforms reply to? A new address just for this is fine.",
  links: "Paste the links whenever you're ready — here or in the link box. I only need the links.",
  signature: "Last step: tick the statement below and type your full name to sign.",
  done: "That's everything. Press “Draft my requests” when you're ready.",
};

export function nextQuestion(missing: IntakeField[]): string {
  return QUESTIONS[missing[0] ?? "done"];
}

// ---------- scripted fallback (Gemini unavailable) ----------

function fallbackExtract(prev: IntakeState, text: string): Partial<IntakeState> {
  const out: Partial<IntakeState> = {};
  const urls = [...text.matchAll(/https?:\/\/[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[^\s<>"']*/gi)].map((m) => m[0]);
  if (urls.length) out.links = urls;
  const email = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
  if (email) out.contactEmail = email;
  if (prev.missing[0] === "legalName" && !email && !urls.length) {
    const name = text.replace(/^(my name is|i'?m|it'?s|name:)\s*/i, "").trim();
    if (/^[\p{L}][\p{L}'.\- ]{1,59}$/u.test(name)) out.legalName = name;
  }
  return out;
}

// ---------- the turn ----------

function toContents(messages: ChatMessage[], state: IntakeState): Content[] {
  const history: Content[] = messages.map((m) => ({ role: m.role === "agent" ? "model" : "user", parts: [{ text: m.text }] }));
  const known = { ...state, attestation: { signature: state.attestation.signature } };
  history.push({ role: "user", parts: [{ text: `[Reclaim system note — current intake state, not from the user]\n${JSON.stringify(known)}` }] });
  return history;
}

export function emptyIntake(isAdult: boolean | null = null): IntakeState {
  const base = { legalName: "", contactEmail: "", isAdult, authorizesPreparation: true, autoSendConsent: false, links: [], attestation: { text: ATTESTATION_TEXT, signature: "" } };
  return { ...base, missing: computeMissing(base) };
}

const defaultAgent: IntakeAgent = async (contents, systemInstruction) => {
  const run = await runAgent<ModelIntake>({ systemInstruction, contents, tools: ["resolve_platform", "collect_intake"], finalTool: "collect_intake" });
  return { output: run.output, model: run.model };
};

const MAX_MESSAGES = 30;
const MAX_CHARS = 2000;

export async function handleIntakeTurn(
  input: { messages: ChatMessage[]; state?: Partial<IntakeState> },
  agent: IntakeAgent = defaultAgent,
): Promise<IntakeTurnResult> {
  const messages = input.messages.slice(-MAX_MESSAGES).map((m) => ({ ...m, text: String(m.text ?? "").slice(0, MAX_CHARS) }));
  const prev: IntakeState = { ...emptyIntake(), ...input.state, attestation: { text: ATTESTATION_TEXT, signature: clean(input.state?.attestation?.signature) } };
  prev.missing = computeMissing(prev);
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";

  // Rule 3: under-18 stops immediately — no model call, nothing kept.
  if (prev.isAdult === false || detectMinor(lastUser)) {
    return { route: "under18", reply: UNDER_18_REPLY, intake: null, source: "rule" };
  }

  let model: ModelIntake;
  let source: IntakeTurnResult["source"] = "gemini";
  let modelName: string | undefined;
  try {
    const run = await agent(toContents(messages, prev), INTAKE_SYSTEM_PROMPT);
    model = run.output;
    modelName = run.model;
  } catch {
    source = "fallback";
    model = fallbackExtract(prev, lastUser) as ModelIntake;
  }

  if (model.isAdult === "minor") return { route: "under18", reply: UNDER_18_REPLY, intake: null, source, model: modelName };

  const links = [...new Set([...prev.links, ...(model.links ?? []).map((u) => normalizeUrl(u) ?? extractUrl(u)).filter((u): u is string => !!u)])];
  const email = clean(model.contactEmail);
  const merged = {
    legalName: clean(model.legalName, 80) || prev.legalName,
    contactEmail: EMAIL_RE.test(email) ? email : prev.contactEmail,
    isAdult: model.isAdult === "adult" ? true : prev.isAdult,
    authorizesPreparation: model.authorizesPreparation ?? prev.authorizesPreparation,
    // Consent is only ever granted by the explicit UI toggle, never inferred by the model.
    autoSendConsent: prev.autoSendConsent,
    links,
    attestation: { text: ATTESTATION_TEXT, signature: clean(model.attestation?.signature, 80) || prev.attestation.signature },
  };
  const intake: IntakeState = { ...merged, missing: computeMissing(merged) };

  let reply = clean(model.reply, 600);
  if (source === "fallback" || !reply || asksAboutContent(reply)) reply = nextQuestion(intake.missing);
  return { route: "continue", reply, intake, source, model: modelName };
}
