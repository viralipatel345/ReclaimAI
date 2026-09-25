import { gate, gateResponse } from "@/lib/incident/auth";
import { grantMandate, HarnessError, revokeMandate, runHarness } from "@/lib/incident/harness";
import { loadOwned, NotFound } from "@/lib/incident/ops";
import { incidentStore } from "@/lib/incident/store";
import type { MandateAction } from "@/lib/incident/types";

/**
 * Grant or revoke the agent's mandate. Body: { caseId, enabled, signature?, allowedActions?, cadenceHours?, maxNoticesPerRun? }.
 * Granting runs the first check immediately so the user sees the agent act before leaving.
 */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const body = (await req.json().catch(() => null)) as { caseId?: unknown; enabled?: unknown; signature?: unknown; allowedActions?: unknown; cadenceHours?: unknown; maxNoticesPerRun?: unknown } | null;
    if (typeof body?.caseId !== "string") return Response.json({ error: "caseId is required" }, { status: 400 });
    const c = await loadOwned(body.caseId, user.id);
    const at = new Date().toISOString();

    if (body.enabled === false) {
      const revoked = revokeMandate(c, at);
      await incidentStore.save(revoked);
      return Response.json({ case: revoked }, { headers: { "Cache-Control": "no-store" } });
    }
    if (typeof body.signature !== "string") return Response.json({ error: "signature is required" }, { status: 400 });
    const granted = grantMandate(
      c,
      {
        signature: body.signature,
        allowedActions: Array.isArray(body.allowedActions) ? (body.allowedActions.filter((a): a is MandateAction => typeof a === "string") as MandateAction[]) : undefined,
        cadenceHours: typeof body.cadenceHours === "number" ? body.cadenceHours : undefined,
        maxNoticesPerRun: typeof body.maxNoticesPerRun === "number" ? body.maxNoticesPerRun : undefined,
      },
      at,
    );
    await incidentStore.save(granted);
    const ran = await runHarness(granted, { trigger: "manual" });
    return Response.json({ case: ran }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotFound) return Response.json({ error: err.message }, { status: 404 });
    if (err instanceof HarnessError) return Response.json({ error: err.message }, { status: err.status });
    return gateResponse(err);
  }
}
