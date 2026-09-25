import { gate, gateResponse } from "@/lib/incident/auth";
import { createReport, runDiscovery } from "@/lib/incident/ops";

/** Branch B — automated agent scrape. Body: { query, title?, seedUrls? }. Decision is always DISCOVER. */
export async function POST(req: Request) {
  try {
    const user = await gate(req);
    const body = (await req.json().catch(() => null)) as { query?: unknown; title?: unknown; seedUrls?: unknown } | null;
    if (typeof body?.query !== "string" || body.query.trim().length < 3) return Response.json({ error: "query is required" }, { status: 400 });
    const seedUrls = Array.isArray(body.seedUrls) ? body.seedUrls.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 10) : [];
    const draft = await createReport(user, { branch: "DISCOVER", title: typeof body.title === "string" && body.title.trim() ? body.title : `Discovery: ${body.query.trim()}` });
    const c = await runDiscovery(draft, body.query.trim(), seedUrls);
    return Response.json({ case: c, decision: "DISCOVER" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return gateResponse(err);
  }
}
