import { gate, gateResponse } from "@/lib/incident/auth";
import { subscribeStatus } from "@/lib/incident/events";
import { incidentStore } from "@/lib/incident/store";
import type { StatusEvent } from "@/lib/incident/types";

/**
 * Reports + Status tab feed.
 * - Default: JSON snapshot of the user's cases (status, latest event, escalation state).
 * - `Accept: text/event-stream` (or ?stream=1): live SSE of status events for the user's cases.
 */
export async function GET(req: Request) {
  try {
    const user = await gate(req);
    const url = new URL(req.url);
    const wantsStream = url.searchParams.get("stream") === "1" || (req.headers.get("accept") ?? "").includes("text/event-stream");
    const onlyCase = url.searchParams.get("caseId");

    if (!wantsStream) {
      const cases = (await incidentStore.listByUser(user.id)).filter((c) => !onlyCase || c.id === onlyCase);
      return Response.json(
        {
          cases: cases.map((c) => ({
            id: c.id,
            title: c.title,
            branch: c.branch,
            status: c.status,
            isDraft: c.isDraft,
            riskLevel: c.suggestions?.riskLevel ?? null,
            escalation: c.escalations[0]?.status ?? null,
            latest: c.events[0] ?? null,
            updatedAt: c.updatedAt,
          })),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const owned = new Set((await incidentStore.listByUser(user.id)).map((c) => c.id));
    const encoder = new TextEncoder();
    let unsubscribe = () => {};
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (evt: StatusEvent) => {
          if (!owned.has(evt.caseId) && !(onlyCase && evt.caseId === onlyCase)) {
            if (evt.status === "DRAFT") owned.add(evt.caseId);
            else return;
          }
          if (onlyCase && evt.caseId !== onlyCase) return;
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(evt)}\n\n`));
        };
        controller.enqueue(encoder.encode(`: connected\n\n`));
        unsubscribe = subscribeStatus(send);
        heartbeat = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 25_000);
        req.signal.addEventListener("abort", () => controller.close());
      },
      cancel() {
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
    });
  } catch (err) {
    return gateResponse(err);
  }
}
