// Google SynthID watermark detection through Vertex AI. Media bytes are sent to the
// detector and never persisted here. When the detector isn't configured the result is
// an explicit stub (source: "stub") so callers never mistake "not checked" for "clean".
import type { MediaKind, SynthIdAnalysis } from "../incident/types";

if (typeof window !== "undefined") throw new Error("lib/provenance/synthid is server-only");

export interface SynthIdConfig {
  /** Full predict URL of the SynthID detector endpoint on Vertex AI. */
  endpoint: string;
  accessToken: string;
}

export function synthIdConfigured(): boolean {
  return !!process.env.SYNTHID_ENDPOINT;
}

/**
 * Resolve a Vertex bearer token. Prefers google-auth-library (ADC / service account
 * via GOOGLE_APPLICATION_CREDENTIALS) when installed, otherwise VERTEX_ACCESS_TOKEN.
 */
export async function getVertexAccessToken(): Promise<string | null> {
  if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN;
  try {
    const mod = "google-auth-library";
    const { GoogleAuth } = (await import(/* webpackIgnore: true */ mod)) as {
      GoogleAuth: new (o: { scopes: string[] }) => { getAccessToken(): Promise<string | null | undefined> };
    };
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    return (await auth.getAccessToken()) ?? null;
  } catch {
    return null;
  }
}

async function loadConfig(): Promise<SynthIdConfig | null> {
  const endpoint = process.env.SYNTHID_ENDPOINT;
  if (!endpoint) return null;
  const accessToken = await getVertexAccessToken();
  return accessToken ? { endpoint, accessToken } : null;
}

interface VertexPrediction {
  watermarkDetected?: boolean;
  watermark_detected?: boolean;
  confidence?: number;
  score?: number;
  model?: string;
}

/** Map a Vertex prediction row onto our analysis shape; tolerant of camel/snake keys. */
export function parsePrediction(p: VertexPrediction | undefined, modality: MediaKind, checkedAt: string): SynthIdAnalysis {
  const detected = p?.watermarkDetected ?? p?.watermark_detected ?? false;
  const raw = p?.confidence ?? p?.score ?? (detected ? 1 : 0);
  const synthIdConfidence = Math.min(1, Math.max(0, Number(raw) || 0));
  return { isGoogleAiGenerated: detected, synthIdConfidence, modality, detectedModel: p?.model, source: "vertex", checkedAt };
}

export function stubAnalysis(modality: MediaKind, checkedAt = new Date().toISOString()): SynthIdAnalysis {
  return { isGoogleAiGenerated: false, synthIdConfidence: 0, modality, source: "stub", checkedAt };
}

export async function detectSynthId(buffer: Buffer, mimeType: string, modality: MediaKind, config?: SynthIdConfig | null): Promise<SynthIdAnalysis> {
  const checkedAt = new Date().toISOString();
  const cfg = config === undefined ? await loadConfig() : config;
  if (!cfg) return stubAnalysis(modality, checkedAt);

  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [{ content: { bytesBase64Encoded: buffer.toString("base64"), mimeType } }] }),
  });
  if (!res.ok) {
    console.warn(`[synthid] detector returned ${res.status}`);
    return stubAnalysis(modality, checkedAt);
  }
  const json = (await res.json()) as { predictions?: VertexPrediction[] };
  return parsePrediction(json.predictions?.[0], modality, checkedAt);
}
