import { gate, gateResponse } from "@/lib/incident/auth";
import { CHANNELS } from "@/lib/incident/channels";
import { loadOwned, NotFound } from "@/lib/incident/ops";
import { fileReport, ReportError } from "@/lib/incident/reporting";
import type { ReportChannel } from "@/lib/incident/types";

/** Agent files the case through a channel. Body: { caseId, channel, url? }. Every step is logged on the case. */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const body = (await req.json().catch(() => null)) as { caseId?: unknown; channel?: unknown; url?: unknown } | null;
    if (typeof body?.caseId !== "string") return Response.json({ error: "caseId is required" }, { status: 400 });
    if (typeof body.channel !== "string" || !(body.channel in CHANNELS)) return Response.json({ error: "Unknown channel" }, { status: 400 });
    const c = await fileReport(await loadOwned(body.caseId, user.id), body.channel as ReportChannel, { url: typeof body.url === "string" ? body.url : undefined });
    const report = c.reports[0];
    return Response.json({ case: c, report }, { status: report.status === "failed" ? 422 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotFound) return Response.json({ error: err.message }, { status: 404 });
    if (err instanceof ReportError) return Response.json({ error: err.message }, { status: err.status });
    return gateResponse(err);
  }
}
