// Google SynthID watermark detection through Vertex AI's image verification model
// (publishers/google/models/imageverification@001). Media bytes are sent to Google for the
// check and never persisted. Credentials: VERTEX_ACCESS_TOKEN, google-auth-library (ADC),
// or the local gcloud CLI. When nothing is configured the result is an explicit stub
// (source: "stub") so callers never mistake "not checked" for "clean".
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaKind, SynthIdAnalysis } from "../incident/types";

if (typeof window !== "undefined") throw new Error("lib/provenance/synthid is server-only");

const exec = promisify(execFile);

export interface SynthIdConfig {
  /** Full :predict URL of the verification endpoint on Vertex AI. */
  endpoint: string;
  accessToken: string;
}

let projectCache: { value: string | null; at: number } | null = null;
let tokenCache: { value: string; at: number } | null = null;
const CACHE_MS = 45 * 60 * 1000;

async function gcloud(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await exec("gcloud", args, { timeout: 15_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/** GOOGLE_CLOUD_PROJECT, else the active gcloud project. */
export async function vertexProject(): Promise<string | null> {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (projectCache && Date.now() - projectCache.at < CACHE_MS) return projectCache.value;
  const value = await gcloud(["config", "get-value", "project"]);
  projectCache = { value: value && value !== "(unset)" ? value : null, at: Date.now() };
  return projectCache.value;
}

export async function synthIdEndpoint(): Promise<string | null> {
  if (process.env.SYNTHID_ENDPOINT) return process.env.SYNTHID_ENDPOINT;
  if (process.env.SYNTHID_DISABLED === "true") return null;
  const project = await vertexProject();
  if (!project) return null;
  const loc = process.env.VERTEX_LOCATION ?? "us-central1";
  return `https://${loc}-aiplatform.googleapis.com/v1/projects/${project}/locations/${loc}/publishers/google/models/imageverification@001:predict`;
}

/** Resolve a Vertex bearer token: env → google-auth-library (ADC) → gcloud CLI. */
export async function getVertexAccessToken(): Promise<string | null> {
  if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN;
  if (tokenCache && Date.now() - tokenCache.at < CACHE_MS) return tokenCache.value;
  try {
    const mod = "google-auth-library";
    const { GoogleAuth } = (await import(/* webpackIgnore: true */ mod)) as {
      GoogleAuth: new (o: { scopes: string[] }) => { getAccessToken(): Promise<string | null | undefined> };
    };
    const token = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getAccessToken();
    if (token) return (tokenCache = { value: token, at: Date.now() }).value;
  } catch {}
  const token = await gcloud(["auth", "print-access-token"]);
  if (token) tokenCache = { value: token, at: Date.now() };
  return token;
}

export async function loadSynthIdConfig(): Promise<SynthIdConfig | null> {
  const endpoint = await synthIdEndpoint();
  if (!endpoint) return null;
  const accessToken = await getVertexAccessToken();
  return accessToken ? { endpoint, accessToken } : null;
}

export async function synthIdConfigured(): Promise<boolean> {
  return !!(await loadSynthIdConfig());
}

interface VertexPrediction {
  /** imageverification@001: ACCEPT = SynthID watermark present, REJECT = absent. */
  decision?: "ACCEPT" | "REJECT" | string;
  watermarkDetected?: boolean;
  watermark_detected?: boolean;
  confidence?: number;
  score?: number;
  model?: string;
}

/** Map a Vertex prediction row onto our analysis shape; tolerant of the verification model and camel/snake keys. */
export function parsePrediction(p: VertexPrediction | undefined, modality: MediaKind, checkedAt: string): SynthIdAnalysis {
  if (p?.decision) {
    const detected = p.decision === "ACCEPT";
    return { isGoogleAiGenerated: detected, synthIdConfidence: detected ? 1 : 0, modality, detectedModel: detected ? "Google (Imagen / Gemini)" : undefined, source: "vertex", checkedAt };
  }
  const detected = p?.watermarkDetected ?? p?.watermark_detected ?? false;
  const raw = p?.confidence ?? p?.score ?? (detected ? 1 : 0);
  const synthIdConfidence = Math.min(1, Math.max(0, Number(raw) || 0));
  return { isGoogleAiGenerated: detected, synthIdConfidence, modality, detectedModel: p?.model, source: "vertex", checkedAt };
}

export function stubAnalysis(modality: MediaKind, checkedAt = new Date().toISOString()): SynthIdAnalysis {
  return { isGoogleAiGenerated: false, synthIdConfidence: 0, modality, source: "stub", checkedAt };
}

export function requestBody(endpoint: string, buffer: Buffer, mimeType: string): string {
  const bytesBase64Encoded = buffer.toString("base64");
  return endpoint.includes("imageverification")
    ? JSON.stringify({ instances: [{ image: { bytesBase64Encoded } }] })
    : JSON.stringify({ instances: [{ content: { bytesBase64Encoded, mimeType } }] });
}

export async function detectSynthId(buffer: Buffer, mimeType: string, modality: MediaKind, config?: SynthIdConfig | null, fetchImpl: typeof fetch = fetch): Promise<SynthIdAnalysis> {
  const checkedAt = new Date().toISOString();
  const cfg = config === undefined ? await loadSynthIdConfig() : config;
  if (!cfg) return stubAnalysis(modality, checkedAt);
  // The verification model only takes still images.
  if (cfg.endpoint.includes("imageverification") && modality !== "image") return stubAnalysis(modality, checkedAt);

  const res = await fetchImpl(cfg.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: requestBody(cfg.endpoint, buffer, mimeType),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.warn(`[synthid] detector returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return stubAnalysis(modality, checkedAt);
  }
  const json = (await res.json()) as { predictions?: VertexPrediction[] };
  return parsePrediction(json.predictions?.[0], modality, checkedAt);
}
