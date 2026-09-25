// Gemini-vision checks on image bytes (provenance carve-out: bytes are sent to Gemini for
// analysis and never stored). Two questions only: is this a widely known public figure,
// and does the image show signs of generative-AI synthesis. Never used to identify
// private individuals — the prompt refuses and the caller falls back to a typed name.
import { MODELS } from "../config";
import { generate, GeminiUnavailableError, hasGeminiKey, type GenerateParams } from "../gemini";
import type { AiLook } from "../incident/types";

if (typeof window !== "undefined") throw new Error("lib/provenance/aiLook is server-only");

export type VisionGen = (p: GenerateParams) => Promise<{ response: { text?: string }; model: string }>;

const imagePart = (buffer: Buffer, mimeType: string) => ({ inlineData: { mimeType, data: buffer.toString("base64") } });

function parseJson<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

export interface PublicFigure {
  name: string | null;
  confidence: number;
  description: string;
}

const IDENTIFY_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Full name of the widely known public figure shown, or empty string if not a public figure / unsure." },
    confidence: { type: "number", description: "0..1" },
    description: { type: "string", description: "One neutral sentence about who this is publicly known as. Empty if not a public figure." },
  },
  required: ["name", "confidence", "description"],
} as const;

/** Identify a widely known public figure. Returns name null for private people or low confidence. */
export async function identifyPublicFigure(buffer: Buffer, mimeType: string, gen: VisionGen = generate): Promise<PublicFigure> {
  if (gen === generate && !hasGeminiKey()) throw new GeminiUnavailableError("GEMINI_API_KEY is not set");
  const { response } = await gen({
    model: MODELS.primary,
    contents: [
      {
        role: "user",
        parts: [
          imagePart(buffer, mimeType),
          {
            text: "Is the person in this image a widely known public figure (a celebrity, politician, athlete, musician, or similar) whose identity is public knowledge? If yes, give their full name. If they are a private individual, unclear, or you are not confident, return an empty name. Never guess the identity of a private person.",
          },
        ],
      },
    ],
    config: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: IDENTIFY_SCHEMA },
  });
  const out = parseJson<{ name?: string; confidence?: number; description?: string }>(response.text ?? "");
  const name = (out?.name ?? "").trim();
  const confidence = Math.min(1, Math.max(0, Number(out?.confidence) || 0));
  if (!name || confidence < 0.6) return { name: null, confidence, description: "" };
  return { name, confidence, description: (out?.description ?? "").trim() };
}

const AI_LOOK_SCHEMA = {
  type: "object",
  properties: {
    likelihood: { type: "number", description: "0..1 probability the image is AI-generated or AI-manipulated." },
    signs: { type: "array", items: { type: "string" }, description: "Up to 4 short, concrete visual observations supporting the likelihood (e.g. 'six fingers on left hand', 'text on sign is garbled', 'skin has plastic-smooth texture'). Empty if none." },
    summary: { type: "string", description: "One sentence verdict." },
  },
  required: ["likelihood", "signs", "summary"],
} as const;

export interface AiLookResult {
  likelihood: number;
  signs: string[];
  summary: string;
  model: string;
}

/** Visual-only assessment of AI synthesis. A heuristic, reported as such; provenance signals override it. */
export async function aiLookCheck(buffer: Buffer, mimeType: string, gen: VisionGen = generate): Promise<AiLookResult> {
  if (gen === generate && !hasGeminiKey()) throw new GeminiUnavailableError("GEMINI_API_KEY is not set");
  const { response, model } = await gen({
    model: MODELS.fast,
    contents: [
      {
        role: "user",
        parts: [
          imagePart(buffer, mimeType),
          {
            text: "You are a forensic image analyst. Assess whether this image was generated or manipulated by generative AI. Look for: anatomical errors (hands, teeth, ears), garbled or nonsensical text, inconsistent lighting or shadows, unnatural skin or hair texture, background objects that merge or repeat, asymmetric accessories, over-smooth or over-sharp regions, and telltale diffusion-model patterns. Do not describe the person's body or identity. Be calibrated: ordinary photos should score low.",
          },
        ],
      },
    ],
    config: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: AI_LOOK_SCHEMA },
  });
  const out = parseJson<{ likelihood?: number; signs?: string[]; summary?: string }>(response.text ?? "");
  return {
    likelihood: Math.min(1, Math.max(0, Number(out?.likelihood) || 0)),
    signs: Array.isArray(out?.signs) ? out!.signs.filter((s): s is string => typeof s === "string").slice(0, 4) : [],
    summary: (out?.summary ?? "").trim(),
    model,
  };
}

/** Fold provenance (authoritative) and the visual check (heuristic) into one AiLook. */
export function combineAiLook(provenance: { verdict: string; summary: string } | null, look: AiLookResult | null, synthId: AiLook["synthId"] = "unavailable"): AiLook {
  if (synthId === "detected") {
    return { verdict: "ai_generated", confidence: 1, signs: ["SynthID watermark detected — made with a Google AI model", ...(look?.signs ?? [])].slice(0, 4), source: look ? "provenance+gemini" : "provenance", synthId };
  }
  if (provenance?.verdict === "ai_generated") {
    return { verdict: "ai_generated", confidence: 1, signs: [provenance.summary, ...(look?.signs ?? [])].slice(0, 4), source: look ? "provenance+gemini" : "provenance", synthId };
  }
  if (!look) {
    if (provenance?.verdict === "likely_ai") return { verdict: "likely_ai", confidence: 0.6, signs: [provenance.summary], source: "provenance", synthId };
    return { verdict: "unchecked", confidence: 0, signs: [], source: "none", synthId };
  }
  const confidence = provenance?.verdict === "likely_ai" ? Math.max(look.likelihood, 0.6) : look.likelihood;
  const verdict = confidence >= 0.75 ? "ai_generated" : confidence >= 0.45 ? "likely_ai" : "no_signal";
  return { verdict, confidence, signs: look.signs.length ? look.signs : look.summary ? [look.summary] : [], source: provenance ? "provenance+gemini" : "gemini-vision", synthId };
}
