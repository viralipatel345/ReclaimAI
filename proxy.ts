// Optimistic auth gate for the incident API: anonymous requests never reach a route
// handler. Full session + human verification happens in lib/incident/auth (gate()).
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  if (process.env.DEMO_MODE === "true") return NextResponse.next();
  const hasBearer = (req.headers.get("authorization") ?? "").toLowerCase().startsWith("bearer ");
  const hasCookie = ["session", "sb-access-token", "__session"].some((n) => req.cookies.has(n));
  if (!hasBearer && !hasCookie) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.next();
}

export const config = { matcher: "/api/incident/:path*" };
