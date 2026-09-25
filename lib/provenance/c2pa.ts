// C2PA (Content Credentials) manifest analysis. Uses the official c2pa-node SDK when it
// is installed; otherwise falls back to a dependency-free JUMBF scan that finds the
// embedded manifest store and pulls the claim generator / issuer / AI-generation
// assertions out of its CBOR text fields. The fallback is a heuristic and says so.
import type { C2paAnalysis } from "../incident/types";

const AI_SOURCE_TYPES = ["trainedAlgorithmicMedia", "trainedAlgorithmicData", "algorithmicMedia"];
const AI_GENERATORS = /openai|chatgpt|dall[- ]?e|sora|midjourney|stable ?diffusion|firefly|imagen|gemini|copilot|designer|bing image creator|ideogram|runway|leonardo/i;

/** Known Content Credentials signers, matched against the signing certificate's printable strings. */
const KNOWN_ISSUERS: [RegExp, string][] = [
  [/adobe/i, "Adobe"],
  [/openai/i, "OpenAI"],
  [/microsoft/i, "Microsoft"],
  [/google/i, "Google"],
  [/truepic/i, "Truepic"],
  [/leica/i, "Leica"],
  [/nikon/i, "Nikon"],
  [/sony/i, "Sony"],
  [/qualcomm/i, "Qualcomm"],
  [/meta platforms|facebook/i, "Meta"],
];

function ascii(buffer: Buffer): string {
  return buffer.toString("latin1");
}

/** JUMBF manifest store lives inside a "jumb" box whose description ("jumd") is typed "c2pa". */
export function hasC2paManifest(buffer: Buffer): boolean {
  const s = ascii(buffer);
  const jumd = s.indexOf("jumd");
  if (jumd === -1) return false;
  return s.indexOf("c2pa", jumd) !== -1;
}

/**
 * Read the CBOR text string (major type 3) that follows `key` in the manifest bytes.
 * Falls back to the next printable run when the value isn't a plain text header.
 */
function textAfter(s: string, key: string, max = 120): string | undefined {
  const i = s.indexOf(key);
  if (i === -1) return undefined;
  let p = i + key.length;
  const head = s.charCodeAt(p);
  let len = -1;
  if (head >= 0x60 && head <= 0x77) {
    len = head - 0x60;
    p += 1;
  } else if (head === 0x78) {
    len = s.charCodeAt(p + 1);
    p += 2;
  } else if (head === 0x79) {
    len = (s.charCodeAt(p + 1) << 8) | s.charCodeAt(p + 2);
    p += 3;
  }
  if (len > 0) return s.slice(p, p + Math.min(len, max)).trim() || undefined;
  const m = s.slice(p, p + max + 4).match(/[\x20-\x7e]{3,}/);
  return m ? m[0].trim() : undefined;
}

export function scanJumbf(buffer: Buffer): C2paAnalysis {
  if (!hasC2paManifest(buffer)) return { present: false, assertions: [], source: "jumbf-scan" };
  const s = ascii(buffer);

  const claimGenerator = textAfter(s, "claim_generator");
  const assertions = [...new Set([...s.matchAll(/c2pa\.[a-z_.]+/g)].map((m) => m[0]))].filter((a) => a !== "c2pa.claim");
  const declaresAiSource = AI_SOURCE_TYPES.some((t) => s.includes(t));
  const aiGenerated = declaresAiSource || (claimGenerator ? AI_GENERATORS.test(claimGenerator) : undefined);

  let c2paIssuer: string | undefined;
  for (const [re, name] of KNOWN_ISSUERS) {
    if (re.test(s)) {
      c2paIssuer = name;
      break;
    }
  }

  return { present: true, c2paIssuer, claimGenerator, aiGenerated, assertions, source: "jumbf-scan" };
}

interface C2paNodeManifest {
  claimGenerator?: string;
  signatureInfo?: { issuer?: string };
  assertions?: { label: string; data?: unknown }[];
}

async function withSdk(buffer: Buffer, mimeType: string): Promise<C2paAnalysis | null> {
  try {
    const mod = "c2pa-node";
    const { createC2pa } = (await import(/* webpackIgnore: true */ mod)) as {
      createC2pa: () => { read(o: { buffer: Buffer; mimeType: string }): Promise<{ active_manifest?: C2paNodeManifest; activeManifest?: C2paNodeManifest } | null> };
    };
    const result = await createC2pa().read({ buffer, mimeType });
    const m = result?.activeManifest ?? result?.active_manifest;
    if (!m) return { present: false, assertions: [], source: "c2pa-node" };
    const assertions = (m.assertions ?? []).map((a) => a.label);
    const serialized = JSON.stringify(m.assertions ?? []);
    const aiGenerated = AI_SOURCE_TYPES.some((t) => serialized.includes(t)) || (m.claimGenerator ? AI_GENERATORS.test(m.claimGenerator) : undefined);
    return { present: true, c2paIssuer: m.signatureInfo?.issuer, claimGenerator: m.claimGenerator, aiGenerated, assertions, source: "c2pa-node" };
  } catch {
    return null;
  }
}

export async function parseC2pa(buffer: Buffer, mimeType: string): Promise<C2paAnalysis> {
  return (await withSdk(buffer, mimeType)) ?? scanJumbf(buffer);
}
