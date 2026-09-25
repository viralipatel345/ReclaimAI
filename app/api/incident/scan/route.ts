import { gate, gateResponse } from "@/lib/incident/auth";
import { loadOwned, NotFound, recordScans } from "@/lib/incident/ops";
import { MAX_MEDIA_BYTES, mediaKindOf, scanMedia } from "@/lib/provenance";

/**
 * Provenance scan for uploaded evidence. multipart/form-data: caseId + one or more `files`.
 * Bytes are scanned in memory and discarded; only hashes and results are stored.
 */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const form = await req.formData().catch(() => null);
    const caseId = form?.get("caseId");
    if (!form || typeof caseId !== "string") return Response.json({ error: "caseId and files are required" }, { status: 400 });
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0 || files.length > 10) return Response.json({ error: "Provide 1–10 files" }, { status: 400 });
    for (const f of files) {
      if (!mediaKindOf(f.type)) return Response.json({ error: `Unsupported type: ${f.type || "unknown"}` }, { status: 415 });
      if (f.size > MAX_MEDIA_BYTES) return Response.json({ error: `${f.name} exceeds 25 MB` }, { status: 413 });
    }

    const c = await loadOwned(caseId, user.id);
    const outputs = await Promise.all(files.map(async (f) => scanMedia({ buffer: Buffer.from(await f.arrayBuffer()), mimeType: f.type, caseId })));
    const next = await recordScans(c, outputs);
    return Response.json({ case: next, results: outputs.map((o) => o.verification) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotFound) return Response.json({ error: err.message }, { status: 404 });
    return gateResponse(err);
  }
}
