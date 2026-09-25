import { describe, expect, it } from "vitest";
import { hasC2paManifest, scanJumbf } from "@/lib/provenance/c2pa";
import { scanMedia, sha256, verdictOf } from "@/lib/provenance";
import { parsePrediction, stubAnalysis } from "@/lib/provenance/synthid";

/** Minimal JPEG-ish buffer carrying a JUMBF box typed c2pa with CBOR-like text fields. */
function fakeC2paJpeg(extra: string): Buffer {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xeb]);
  const body = Buffer.from(`JP\x00\x01jumbjumdc2pa\x00\x00${extra}`, "latin1");
  return Buffer.concat([head, body, Buffer.from([0xff, 0xd9])]);
}

describe("C2PA JUMBF scan", () => {
  it("reports absence when there is no manifest store", () => {
    const plain = Buffer.from([0xff, 0xd8, 0x00, 0x11, 0xff, 0xd9]);
    expect(hasC2paManifest(plain)).toBe(false);
    expect(scanJumbf(plain)).toMatchObject({ present: false, assertions: [] });
  });

  it("extracts claim generator, issuer and AI-generation assertion", () => {
    // 0x71 = CBOR text string of length 17 ("Adobe Firefly 2.0")
    const buf = fakeC2paJpeg("claim_generator\x71Adobe Firefly 2.0 c2pa.actions c2pa.created digitalSourceType trainedAlgorithmicMedia CN=Adobe Inc");
    const r = scanJumbf(buf);
    expect(r.present).toBe(true);
    expect(r.claimGenerator).toBe("Adobe Firefly 2.0");
    expect(r.c2paIssuer).toBe("Adobe");
    expect(r.aiGenerated).toBe(true);
    expect(r.assertions).toContain("c2pa.actions");
    expect(r.source).toBe("jumbf-scan");
  });

  it("recognises a non-AI camera manifest", () => {
    const r = scanJumbf(fakeC2paJpeg("claim_generator\x6bLeica M11-P c2pa.hash.data O=Leica Camera AG"));
    expect(r.present).toBe(true);
    expect(r.claimGenerator).toBe("Leica M11-P");
    expect(r.c2paIssuer).toBe("Leica");
    expect(r.aiGenerated).toBe(false);
  });
});

describe("SynthID prediction parsing", () => {
  it("clamps confidence and accepts snake_case keys", () => {
    const at = "2026-09-25T00:00:00.000Z";
    expect(parsePrediction({ watermark_detected: true, score: 1.4 }, "image", at)).toMatchObject({ isGoogleAiGenerated: true, synthIdConfidence: 1, source: "vertex" });
    expect(parsePrediction(undefined, "video", at)).toMatchObject({ isGoogleAiGenerated: false, synthIdConfidence: 0 });
  });
});

describe("unified verdict", () => {
  const at = "2026-09-25T00:00:00.000Z";
  it("SynthID high confidence → ai_generated", () => {
    expect(verdictOf({ ...stubAnalysis("image", at), isGoogleAiGenerated: true, synthIdConfidence: 0.93, source: "vertex" }, { present: false }).verdict).toBe("ai_generated");
  });
  it("C2PA AI assertion → ai_generated even when SynthID is silent", () => {
    expect(verdictOf({ ...stubAnalysis("image", at), source: "vertex" }, { present: true, aiGenerated: true }).verdict).toBe("ai_generated");
  });
  it("detector unavailable and no manifest → inconclusive, never no_signal", () => {
    expect(verdictOf(stubAnalysis("image", at), { present: false }).verdict).toBe("inconclusive");
  });
  it("clean camera manifest with real detector → no_signal", () => {
    expect(verdictOf({ ...stubAnalysis("image", at), source: "vertex" }, { present: true, aiGenerated: false }).verdict).toBe("no_signal");
  });
});

describe("scanMedia", () => {
  it("keeps only the hash and analysis, and rejects non-media", async () => {
    const buffer = fakeC2paJpeg("claim_generator\x6dOpenAI DALL-E trainedAlgorithmicMedia");
    const out = await scanMedia({ buffer, mimeType: "image/jpeg", caseId: "case_1" }, null);
    expect(out.asset.sha256).toBe(sha256(buffer));
    expect(out.asset.bytes).toBe(buffer.byteLength);
    expect(out.verification.verdict).toBe("ai_generated");
    expect(out.verification.c2pa.c2paIssuer).toBe("OpenAI");
    expect(JSON.stringify(out)).not.toContain("base64");
    await expect(scanMedia({ buffer, mimeType: "application/pdf", caseId: "case_1" }, null)).rejects.toThrow(/Unsupported/);
  });
});
