// Access layer: authenticated session (Auth0 / Firebase / Supabase, chosen by AUTH_PROVIDER)
// plus a human-verification token (Cloudflare Turnstile or reCAPTCHA Enterprise).
// Anonymous requests are rejected before any report logic runs. Tokens are never logged.
import { isDemoMode } from "../config";
import type { AuthProvider, User } from "./types";

if (typeof window !== "undefined") throw new Error("lib/incident/auth is server-only");

export class AuthError extends Error {
  constructor(message: string, public status: 401 | 403 = 401) {
    super(message);
  }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (h?.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)(?:session|sb-access-token|__session)=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

type ProviderVerifier = (token: string) => Promise<User | null>;

const PROVIDERS: Record<AuthProvider, ProviderVerifier> = {
  async supabase(token) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = (await res.json()) as { id: string; email?: string; phone?: string; created_at?: string; user_metadata?: { full_name?: string } };
    return { id: u.id, email: u.email ?? "", authProvider: "supabase", authSubject: u.id, displayName: u.user_metadata?.full_name, phone: u.phone, createdAt: u.created_at ?? new Date().toISOString() };
  },
  async firebase(token) {
    const key = process.env.FIREBASE_WEB_API_KEY;
    if (!key) return null;
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    if (!res.ok) return null;
    const { users } = (await res.json()) as { users?: { localId: string; email?: string; displayName?: string; phoneNumber?: string; createdAt?: string }[] };
    const u = users?.[0];
    if (!u) return null;
    return { id: u.localId, email: u.email ?? "", authProvider: "firebase", authSubject: u.localId, displayName: u.displayName, phone: u.phoneNumber, createdAt: u.createdAt ? new Date(Number(u.createdAt)).toISOString() : new Date().toISOString() };
  },
  async auth0(token) {
    const domain = process.env.AUTH0_DOMAIN;
    if (!domain) return null;
    const res = await fetch(`https://${domain}/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = (await res.json()) as { sub: string; email?: string; name?: string; phone_number?: string };
    return { id: u.sub, email: u.email ?? "", authProvider: "auth0", authSubject: u.sub, displayName: u.name, phone: u.phone_number, createdAt: new Date().toISOString() };
  },
};

export const DEMO_USER: User = { id: "usr_demo", email: "demo@reclaim.local", authProvider: "supabase", authSubject: "demo", displayName: "Demo user", createdAt: "2026-01-01T00:00:00.000Z" };

export async function requireSession(req: Request): Promise<User> {
  const token = bearerToken(req);
  if (isDemoMode() && !token) return DEMO_USER;
  if (!token) throw new AuthError("Sign in required");
  const provider = (process.env.AUTH_PROVIDER ?? "supabase") as AuthProvider;
  const verify = PROVIDERS[provider];
  if (!verify) throw new AuthError(`Unknown AUTH_PROVIDER ${provider}`, 403);
  const user = await verify(token);
  if (!user) throw new AuthError("Session invalid or expired");
  return user;
}

/** Human-verification gate. Header `x-human-token` carries the Turnstile / reCAPTCHA token. */
export async function verifyHuman(token: string | null, ip?: string | null): Promise<boolean> {
  if (isDemoMode() && !token) return true;
  if (!token) return false;

  if (process.env.TURNSTILE_SECRET_KEY) {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  }

  if (process.env.RECAPTCHA_PROJECT_ID && process.env.RECAPTCHA_API_KEY && process.env.RECAPTCHA_SITE_KEY) {
    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${process.env.RECAPTCHA_PROJECT_ID}/assessments?key=${process.env.RECAPTCHA_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: { token, siteKey: process.env.RECAPTCHA_SITE_KEY, userIpAddress: ip ?? undefined } }),
    });
    const json = (await res.json()) as { tokenProperties?: { valid?: boolean }; riskAnalysis?: { score?: number } };
    return json.tokenProperties?.valid === true && (json.riskAnalysis?.score ?? 0) >= Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
  }

  console.warn("[auth] no human-verification provider configured; rejecting");
  return false;
}

/** Session + human gate for route handlers. Throws AuthError; use `gateResponse` to map it. */
export async function gate(req: Request): Promise<User> {
  const user = await requireSession(req);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const human = await verifyHuman(req.headers.get("x-human-token"), ip);
  if (!human) throw new AuthError("Human verification failed", 403);
  return user;
}

export function gateResponse(err: unknown): Response {
  if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
  console.error("[incident]", err);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
