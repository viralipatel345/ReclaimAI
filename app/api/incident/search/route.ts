import { gate, gateResponse } from "@/lib/incident/auth";
import { cleanReporter, createReport, runImageSearch } from "@/lib/incident/ops";
import { MAX_MEDIA_BYTES, mediaKindOf } from "@/lib/provenance";

/**
 * Branch C — upload an image, find where it appears on the web, classify each host.
 * multipart/form-data: file (image), title?, notes?, reporter? (JSON). The image is
 * provenance-scanned and sent to the search provider; Reclaim keeps only its hash.
 */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
    if (mediaKindOf(file.type) !== "image") return Response.json({ error: "Upload an image (JPEG, PNG, WebP…)" }, { status: 415 });
    if (file.size > MAX_MEDIA_BYTES) return Response.json({ error: "Image exceeds 25 MB" }, { status: 413 });

    const title = String(form.get("title") ?? "").trim() || "Where is my image?";
    const notes = String(form.get("notes") ?? "");
    let reporter: unknown;
    try {
      reporter = JSON.parse(String(form.get("reporter") ?? "null"));
    } catch {
      reporter = null;
    }
    const draft = await createReport(user, { branch: "IMAGE_SEARCH", title, notes, reporter: cleanReporter(reporter, new Date().toISOString()) });
    const c = await runImageSearch(draft, { buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type });
    return Response.json({ case: c, search: c.imageSearch }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return gateResponse(err);
  }
}
