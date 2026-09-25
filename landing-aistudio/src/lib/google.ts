// Copied verbatim from lib/google.ts in the real Next.js app (root of this repo). Same
// Google Identity Services token model: never stored, never sent to a server, revoked on exit.
// Google sign-in for Gmail (Google Identity Services token model). The access token lives
// only in this tab's memory: never stored, never sent to Reclaim's server, revoked on Quick exit.
import { useSyncExternalStore } from "react";
import { gmailProfile } from "./gmail";

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"].join(" ");

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
interface GoogleOAuth {
  initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

export interface GmailSession {
  token: string;
  email: string;
  expiresAt: number;
}

let session: GmailSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Google sign-in"));
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Opens Google's consent popup; resolves with the signed-in Gmail address. */
export async function connectGmail(clientId: string): Promise<GmailSession> {
  if (!clientId) throw new Error("Google sign-in isn't configured (GOOGLE_CLIENT_ID).");
  await loadGis();
  const oauth = window.google!.accounts!.oauth2!;
  const token = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth.initTokenClient({ client_id: clientId, scope: GMAIL_SCOPES, callback: resolve, error_callback: reject });
    client.requestAccessToken({ prompt: "consent" });
  });
  if (!token.access_token) throw new Error(token.error ?? "Google sign-in was cancelled.");
  const profile = await gmailProfile(token.access_token);
  session = { token: token.access_token, email: profile.emailAddress, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
  emit();
  return session;
}

export function gmailSession(): GmailSession | null {
  if (session && Date.now() > session.expiresAt - 60_000) {
    session = null;
    emit();
  }
  return session;
}

export function disconnectGmail() {
  if (session) window.google?.accounts?.oauth2?.revoke(session.token);
  session = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useGmail(): GmailSession | null {
  return useSyncExternalStore(subscribe, () => session, () => null);
}
