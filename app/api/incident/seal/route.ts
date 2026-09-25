import { gate, gateResponse } from "@/lib/incident/auth";
import { replaceWithOriginal, SealError } from "@/lib/incident/seal";

/** "Replace with original": seal the verified draft as the primary record. Body: { draftId }. */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const body = (await req.json().catch(() => null)) as { draftId?: unknown } | null;
    if (typeof body?.draftId !== "string") return Response.json({ error: "draftId is required" }, { status: 400 });
    const sealed = await replaceWithOriginal(body.draftId, user.id);
    return Response.json({ case: sealed, recordHash: sealed.recordHash }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof SealError) return Response.json({ error: err.message }, { status: err.status });
    return gateResponse(err);
  }
}
