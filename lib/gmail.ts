// Gmail API helpers. Pure functions (message building, reply extraction) plus thin fetch
// wrappers that take the user's OAuth access token. Tokens never reach Reclaim's server.
//
// Links-only rule: replies are read as TEXT. Attachment parts are skipped by structure and
// attachments are never fetched, so no image bytes are ever downloaded.

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  /** Message-ID header of the message this replies to (keeps reminders in the same thread). */
  inReplyTo?: string;
}

function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64url(s: string): string {
  return b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** RFC 2822 message, UTF-8 text/plain only (no attachments), base64url for the Gmail API. */
export function buildRawEmail(m: OutgoingEmail): string {
  const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim(); // no header injection
  const headers = [
    `From: ${clean(m.from)}`,
    `To: ${clean(m.to)}`,
    `Subject: =?UTF-8?B?${b64(clean(m.subject))}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`, `References: ${clean(m.inReplyTo)}`] : []),
  ];
  const body = b64(m.body.replace(/\r?\n/g, "\r\n")).replace(/.{76}/g, "$&\r\n");
  return b64url(`${headers.join("\r\n")}\r\n\r\n${body}`);
}

// ---------- reading replies ----------

export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
}

export function header(m: GmailMessage, name: string): string {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Plain text of a message. Attachments (anything with a filename/attachmentId, any image/*) are ignored. */
export function messageText(m: GmailMessage): string {
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p?: GmailPart) => {
    if (!p) return;
    const isAttachment = !!p.filename || !!p.body?.attachmentId || /^(image|video|audio|application)\//i.test(p.mimeType ?? "");
    if (!isAttachment && p.body?.data) {
      if (p.mimeType === "text/plain") plain.push(fromB64url(p.body.data));
      else if (p.mimeType === "text/html") html.push(fromB64url(p.body.data));
    }
    p.parts?.forEach(walk);
  };
  walk(m.payload);
  const text = plain.length
    ? plain.join("\n")
    : html
        .join("\n")
        .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<img\b[^>]*>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
  // Drop the quoted original ("On … wrote:" and "> " lines) so Gemini reads only the reply.
  const cut = text.split(/\r?\n/).findIndex((l) => /^On .+wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()));
  return (cut > 0 ? text.split(/\r?\n/).slice(0, cut) : text.split(/\r?\n/))
    .filter((l) => !l.trim().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
}

/** Replies in a thread that we haven't processed and that we didn't send ourselves. */
export function newInboundMessages(thread: { messages?: GmailMessage[] }, seen: string[]): GmailMessage[] {
  return (thread.messages ?? []).filter((m) => !seen.includes(m.id) && !(m.labelIds ?? []).includes("SENT"));
}

// ---------- API calls (client, user's token) ----------

async function gfetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}`);
  return (await res.json()) as T;
}

export function gmailProfile(token: string) {
  return gfetch<{ emailAddress: string }>(token, "/profile");
}

export async function gmailSend(token: string, email: OutgoingEmail, threadId?: string): Promise<{ id: string; threadId: string; messageIdHeader: string }> {
  const sent = await gfetch<{ id: string; threadId: string }>(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: buildRawEmail(email), ...(threadId ? { threadId } : {}) }),
  });
  // Read back the Message-ID header so reminders can thread under it.
  const meta = await gfetch<GmailMessage>(token, `/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`);
  return { ...sent, messageIdHeader: header(meta, "Message-ID") };
}

/** format=full returns inline text bodies; attachment bodies are only referenced, never included. */
export function gmailThread(token: string, threadId: string) {
  return gfetch<{ id: string; messages?: GmailMessage[] }>(token, `/threads/${threadId}?format=full`);
}
