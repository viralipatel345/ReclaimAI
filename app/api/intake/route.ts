import { handleIntakeTurn } from "@/lib/intake";
import type { ChatMessage } from "@/lib/types";

// Stateless: nothing from intake is stored server-side. Request bodies are never logged.
export async function POST(req: Request) {
  let body: { messages?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) return Response.json({ error: "messages must be an array" }, { status: 400 });
  const messages = (body.messages as ChatMessage[]).filter((m) => m && (m.role === "user" || m.role === "agent") && typeof m.text === "string");
  const result = await handleIntakeTurn({ messages, state: (body.state ?? {}) as never });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
