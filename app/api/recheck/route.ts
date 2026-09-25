import { isDemoMode } from "@/lib/config";
import { runRecheck } from "@/lib/recheck";
import { serverStore } from "@/lib/store";
import type { Case } from "@/lib/types";

/**
 * POST /api/recheck
 * - From the app: body { case } → re-checks that case, stores it, returns the updated case.
 * - From Cloud Scheduler: no body, header `x-reclaim-cron: $RECHECK_CRON_SECRET` →
 *   re-checks every open case in the store.
 * Case contents are never logged.
 */
export async function POST(req: Request) {
  const demo = isDemoMode();
  const body = (await req.json().catch(() => null)) as { case?: Case; now?: number } | null;

  if (body?.case) {
    const c = body.case;
    if (!c.id || !Array.isArray(c.links) || !Array.isArray(c.requests)) return Response.json({ error: "Invalid case" }, { status: 400 });
    // Demo "Fast-forward" passes its own clock; real runs always use server time.
    const now = demo && typeof body.now === "number" ? body.now : Date.now();
    const result = await runRecheck(c, now, { demo });
    await serverStore.save(result.case);
    return Response.json({ case: result.case, changes: result.changes, checked: result.checked }, { headers: { "Cache-Control": "no-store" } });
  }

  const secret = process.env.RECHECK_CRON_SECRET;
  if (!secret || req.headers.get("x-reclaim-cron") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = Date.now();
  const due = (await serverStore.listOpen()).filter((c) => !c.nextRecheckAt || new Date(c.nextRecheckAt).getTime() <= now);
  let changes = 0;
  for (const c of due) {
    const result = await runRecheck(c, now, { demo });
    await serverStore.save(result.case);
    changes += result.changes;
  }
  return Response.json({ checkedCases: due.length, changes });
}
