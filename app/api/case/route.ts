import { serverStore } from "@/lib/store";
import type { Case } from "@/lib/types";

// Server copy of the active case so the scheduled recheck agent can see it.
// PUT saves; POST {id, delete: true} removes (used by Quick exit via sendBeacon).
export async function PUT(req: Request) {
  const c = (await req.json().catch(() => null)) as Case | null;
  if (!c?.id || !Array.isArray(c.links)) return Response.json({ error: "Invalid case" }, { status: 400 });
  if (c.isAdult === false) return Response.json({ error: "Not stored" }, { status: 400 }); // under-18: store nothing
  await serverStore.save(c);
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; delete?: boolean } | null;
  if (body?.id && body.delete) await serverStore.delete(body.id);
  return new Response(null, { status: 204 });
}
