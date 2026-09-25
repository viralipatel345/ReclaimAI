import { gate, gateResponse } from "@/lib/incident/auth";
import { escalateToParasell, loadOwned, NotFound } from "@/lib/incident/ops";

/** Official escalation: POST the case payload to Parasell. Body: { caseId }. */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const body = (await req.json().catch(() => null)) as { caseId?: unknown } | null;
    if (typeof body?.caseId !== "string") return Response.json({ error: "caseId is required" }, { status: 400 });
    const c = await escalateToParasell(await loadOwned(body.caseId, user.id));
    const escalation = c.escalations[0];
    const ok = escalation.status === "accepted" || escalation.status === "submitted";
    return Response.json({ case: c, escalation }, { status: ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotFound) return Response.json({ error: err.message }, { status: 404 });
    return gateResponse(err);
  }
}
