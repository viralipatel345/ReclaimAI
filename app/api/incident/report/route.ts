import { gate, gateResponse } from "@/lib/incident/auth";
import { createReport } from "@/lib/incident/ops";
import { incidentStore } from "@/lib/incident/store";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/** Branch A — manual self-report. Body: { title, notes? }. */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const body = (await req.json().catch(() => null)) as { title?: unknown; notes?: unknown } | null;
    if (typeof body?.title !== "string" || body.title.trim().length < 3) return Response.json({ error: "title is required" }, { status: 400 });
    const c = await createReport(user, { branch: "MANUAL", title: body.title, notes: typeof body.notes === "string" ? body.notes : "" });
    return Response.json({ case: c }, { status: 201, ...NO_STORE });
  } catch (err) {
    return gateResponse(err);
  }
}

/** Reports tab: every case for the signed-in user. */
export async function GET(req: Request) {
  try {
    const user = await gate(req);
    return Response.json({ cases: await incidentStore.listByUser(user.id) }, NO_STORE);
  } catch (err) {
    return gateResponse(err);
  }
}
