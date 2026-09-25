import { execSync } from "child_process";
import { NextRequest } from "next/server";

const PROCESSOR_ENDPOINT =
  "https://us-documentai.googleapis.com/v1/projects/376592949990/locations/us/processors/67f11544406fec10:process";

const GCLOUD = "/Users/viralipatel/Downloads/vertex-ai-demo/google-cloud-sdk/bin/gcloud";

function getAccessToken(): string {
  return execSync(`${GCLOUD} auth print-access-token`).toString().trim();
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")   // replace everything non-alphanum with space
    .replace(/\s+/g, " ")
    .trim();
}

function extractNameFromText(text: string): string {
  // US driver's license: FN <given names>  LN <family>  — [A-Z ]+ stays on one line
  const fn = text.match(/\bFN\s+([A-Z][A-Z ]+)/);
  const ln = text.match(/\bLN\s+([A-Z][A-Z ]+)/);
  if (fn && ln) return `${fn[1].trim()} ${ln[1].trim()}`;

  // Passport: SURNAME / GIVEN NAMES labels
  const surname = text.match(/SURNAME[: ]+([A-Z]+)/);
  const given   = text.match(/GIVEN\s+NAMES?[: ]+([A-Z ]+)/);
  if (surname && given) return `${given[1].trim()} ${surname[1].trim()}`;

  return "";
}

function checkFraudSignals(entities: { type: string; mentionText: string }[]): string[] {
  return entities
    .filter((e) => e.type?.startsWith("fraud_signals_") && e.mentionText === "FAIL")
    .map((e) => e.type.replace("fraud_signals_", "").replace(/_/g, " "));
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const claimedName = ((form.get("name") as string | null) ?? "").trim();

    if (!file)        return Response.json({ error: "No file provided" }, { status: 400 });
    if (!claimedName) return Response.json({ error: "No name provided" }, { status: 400 });

    const buffer   = Buffer.from(await file.arrayBuffer());
    const base64   = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const token = getAccessToken();
    const docAiRes = await fetch(PROCESSOR_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rawDocument: { content: base64, mimeType } }),
    });

    if (!docAiRes.ok) {
      const err = await docAiRes.text();
      return Response.json({ error: `Document AI error: ${err}` }, { status: 502 });
    }

    const data      = await docAiRes.json();
    const doc       = data.document ?? {};
    const entities  = (doc.entities ?? []) as { type: string; mentionText: string }[];
    const text      = (doc.text ?? "") as string;

    const fraudFlags    = checkFraudSignals(entities);
    const extractedName = extractNameFromText(text);

    const claimedSet   = new Set(normalize(claimedName).split(" ").filter(Boolean));
    const extractedSet = new Set(normalize(extractedName).split(" ").filter(Boolean));
    const overlap      = [...claimedSet].filter((t) => extractedSet.has(t));
    const matchScore   = overlap.length / Math.max(claimedSet.size, 1);
    const nameMatch    = matchScore >= 0.75;

    let verdict: "PASS" | "FAIL";
    let reason: string;

    if (fraudFlags.length > 0) {
      verdict = "FAIL";
      reason  = `Document fraud signals detected: ${fraudFlags.join(", ")}`;
    } else if (!extractedName) {
      verdict = "FAIL";
      reason  = "Could not read a name from the document. Try a clearer, well-lit photo.";
    } else if (!nameMatch) {
      verdict = "FAIL";
      reason  = `Name on ID ("${extractedName}") doesn't match "${claimedName}" — ${Math.round(matchScore * 100)}% overlap.`;
    } else {
      verdict = "PASS";
      reason  = `Identity verified — "${extractedName}" matches "${claimedName}".`;
    }

    return Response.json({ verdict, reason, extractedName, matchScore: Math.round(matchScore * 100) / 100, fraudFlags });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
