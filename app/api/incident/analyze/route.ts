import { gate, gateResponse } from "@/lib/incident/auth";
import { loadOwned, NotFound, orchestrate } from "@/lib/incident/ops";

/** Gemini orchestration: case + web context + provenance → agent suggestions. Body: { caseId }. */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const body = (await req.json().catch(() => null)) as { caseId?: unknown } | null;
    if (typeof body?.caseId !== "string") return Response.json({ error: "caseId is required" }, { status: 400 });
    const c = await orchestrate(await loadOwned(body.caseId, user.id));
    return Response.json({ case: c, suggestions: c.suggestions }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotFound) return Response.json({ error: err.message }, { status: 404 });
    return gateResponse(err);
  }
}
