// Server-only Gemini access. Every call goes through generate(), which retries
// 429/503 with backoff and then falls back to the flash model. The API key is
// read from the environment and is never logged or returned to the client.
import { ApiError, GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { GEMINI_RETRY, MODELS } from "./config";

if (typeof window !== "undefined") throw new Error("lib/gemini is server-only");

let client: GoogleGenAI | null = null;

export class GeminiUnavailableError extends Error {}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function getClient(): GoogleGenAI {
  if (!hasGeminiKey()) throw new GeminiUnavailableError("GEMINI_API_KEY is not set");
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
}

function statusOf(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.status;
  const s = (err as { status?: unknown })?.status;
  return typeof s === "number" ? s : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GenerateParams = Omit<GenerateContentParameters, "model"> & { model?: string };

export async function generate(params: GenerateParams): Promise<{ response: GenerateContentResponse; model: string }> {
  const ai = getClient();
  const { model: requested, ...rest } = params;
  const models = [...new Set([requested ?? MODELS.primary, MODELS.fallback])];
  let lastErr: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= GEMINI_RETRY.maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({ ...rest, model });
        return { response, model };
      } catch (err) {
        lastErr = err;
        const status = statusOf(err);
        console.warn(`[gemini] ${model} failed (status ${status ?? "?"}, attempt ${attempt})`);
        const retryable = status !== undefined && (GEMINI_RETRY.retryableStatus as readonly number[]).includes(status);
        // 404 = wrong model string: skip straight to the fallback model.
        if (status === 404) break;
        if (!retryable) throw err;
        if (attempt < GEMINI_RETRY.maxAttempts) await sleep(GEMINI_RETRY.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastErr;
}
