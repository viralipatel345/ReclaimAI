import { GoogleAuth } from "google-auth-library";
import { NextRequest } from "next/server";

// Document AI ID-proofing processor. Override with DOCAI_PROCESSOR_ENDPOINT to use another
// project's processor (e.g. for local testing).
const PROCESSOR_ENDPOINT =
  process.env.DOCAI_PROCESSOR_ENDPOINT ??
  "https://us-documentai.googleapis.com/v1/projects/277532942612/locations/us/processors/858c3f1bb62a3e1f:process";
const PROCESSOR_PROJECT = PROCESSOR_ENDPOINT.match(/projects\/([^/]+)/)?.[1] ?? "";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(jpeg|png|webp|heic|heif|tiff|gif|bmp)|application\/pdf)$/;

// Application Default Credentials: the Cloud Run service account in production,
// `gcloud auth application-default login` on a laptop. No CLI calls, no paths.
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

async function getAccessToken(): Promise<string> {
  const token = await auth.getAccessToken();
  if (!token) throw new Error("No Google credentials available for Document AI");
  return token;
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
    if (file.size > MAX_BYTES) return Response.json({ error: "That file is too large (10 MB max)." }, { status: 413 });
    if (!ALLOWED_TYPES.test(file.type || "")) return Response.json({ error: "Upload a photo (JPG, PNG) or PDF of your ID." }, { status: 415 });

    const buffer   = Buffer.from(await file.arrayBuffer());
    const base64   = buffer.toString("base64");
    const mimeType = file.type;

    const token = await getAccessToken();
    const docAiRes = await fetch(PROCESSOR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Bills/quotas the processor's project (needed for user credentials locally).
        ...(PROCESSOR_PROJECT ? { "x-goog-user-project": PROCESSOR_PROJECT } : {}),
      },
      signal: AbortSignal.timeout(30000),
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
