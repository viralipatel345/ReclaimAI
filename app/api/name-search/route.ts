import { withTimeout } from "@/lib/demoCache";
import { searchOwnNameGrounded } from "@/lib/nameSearch";

// Her own name only. Results go to her for confirmation; nothing is fetched or filed here.
export async function POST(req: Request) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const clean = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (clean.length < 3) return Response.json({ error: "Name required" }, { status: 400 });
  const results = await withTimeout(searchOwnNameGrounded(clean), 30000).catch(() => []);
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
