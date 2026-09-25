import { isDemoMode } from "@/lib/config";
import { gate, gateResponse } from "@/lib/incident/auth";
import { HarnessError, runDueCases, runHarness } from "@/lib/incident/harness";
import { loadOwned, NotFound } from "@/lib/incident/ops";

/**
 * POST /api/incident/harness
 * - From the app: body { caseId, now? } → one supervised pass on that case (demo may pass a fast-forwarded clock).
 * - From Cloud Scheduler: no body, header `x-reclaim-cron: $RECHECK_CRON_SECRET` → every due case.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { caseId?: unknown; now?: unknown } | null;

  if (typeof body?.caseId === "string") {
    try {
      const user = await gate(req);
      const c = await loadOwned(body.caseId, user.id);
      const now = isDemoMode() && typeof body.now === "number" ? body.now : Date.now();
      const ran = await runHarness(c, { trigger: "manual", now });
      return Response.json({ case: ran, run: ran.harnessRuns[0] }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (err instanceof NotFound) return Response.json({ error: err.message }, { status: 404 });
      if (err instanceof HarnessError) return Response.json({ error: err.message }, { status: err.status });
      return gateResponse(err);
    }
  }

  const secret = process.env.RECHECK_CRON_SECRET;
  if (!secret || req.headers.get("x-reclaim-cron") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runDueCases(Date.now()));
}
