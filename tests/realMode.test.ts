import { describe, expect, it } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { markSent } from "@/lib/caseOps";
import { parseFeed, scanAccount, tumblrFeed } from "@/lib/feeds";
import { buildRawEmail, messageText, newInboundMessages, type GmailMessage } from "@/lib/gmail";
import { applyGmailReply, recipientFor, recordGmailSend, requestEmail, resolvePendingReply } from "@/lib/gmailOps";
import { searchOwnNameGrounded } from "@/lib/nameSearch";
import { createDemoCase } from "@/lib/seed";

const NOW = Date.parse("2026-09-25T18:00:00.000Z");
const at = new Date(NOW).toISOString();
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const decodeRaw = (raw: string) => Buffer.from(raw, "base64url").toString("utf8");

describe("Gmail message building", () => {
  it("builds a UTF-8 text/plain email with no attachments", () => {
    const raw = decodeRaw(buildRawEmail({ from: "me@gmail.com", to: "abuse@x.example", subject: "Removal request — Jordan", body: "Line one\nLine two ’quoted’" }));
    const [head, body] = raw.split("\r\n\r\n");
    expect(head).toMatch(/^From: me@gmail\.com\r\nTo: abuse@x\.example\r\nSubject: =\?UTF-8\?B\?/);
    expect(head).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(head).not.toMatch(/multipart|attachment/i);
    expect(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8")).toBe("Line one\r\nLine two ’quoted’");
  });

  it("can't be used to inject headers", () => {
    const raw = decodeRaw(buildRawEmail({ from: "me@gmail.com", to: "a@b.example\r\nBcc: victim@evil.example", subject: "Hi\r\nBcc: x@evil.example", body: "x" }));
    expect(raw.split("\r\n\r\n")[0]).not.toMatch(/^Bcc:/m);
  });
});

describe("reading replies never touches attachments", () => {
  const msg = (parts: GmailMessage["payload"], labels: string[] = ["INBOX"], id = "m1"): GmailMessage => ({ id, threadId: "t1", labelIds: labels, payload: parts });

  it("reads text parts and skips attachments and images by structure", () => {
    const m = msg({
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", body: { data: b64("We removed the post.\n\nOn Tue, Jordan wrote:\n> original request") } },
        { mimeType: "image/jpeg", filename: "screenshot.jpg", body: { attachmentId: "ATT1", size: 90000 } },
        { mimeType: "application/pdf", filename: "notice.pdf", body: { attachmentId: "ATT2" } },
      ],
    });
    expect(messageText(m)).toBe("We removed the post.");
  });

  it("falls back to HTML text with images stripped", () => {
    const m = msg({ mimeType: "text/html", body: { data: b64('<p>Under review.</p><img src="https://x/y.png">') } });
    expect(messageText(m)).toBe("Under review.");
  });

  it("only new, inbound messages", () => {
    const thread = { messages: [msg(undefined, ["SENT"], "a"), msg(undefined, ["INBOX"], "b"), msg(undefined, ["INBOX"], "c")] };
    expect(newInboundMessages(thread, ["b"]).map((m) => m.id)).toEqual(["c"]);
  });
});

describe("where requests go", () => {
  const c = createDemoCase(NOW);
  const reddit = c.requests.find((r) => r.platformId === "reddit")!;
  const imgvault = c.requests.find((r) => r.platformId === "imgvault")!;

  it("test inbox overrides every platform and is labeled as a stand-in", () => {
    const rcpt = recipientFor(reddit, "team@gmail.com")!;
    expect(rcpt).toEqual({ to: "team@gmail.com", standIn: true });
    const email = requestEmail(reddit, "me@gmail.com", rcpt);
    expect(email.subject).toMatch(/^\[Reclaim test → Reddit\]/);
    expect(email.body).toMatch(/^This test inbox stands in for Reddit/);
    expect(email.body).toContain(reddit.body);
  });

  it("without a test inbox: email channels go to the platform, web forms can't be emailed", () => {
    expect(recipientFor(imgvault, "")).toEqual({ to: "takedown@imgvault.example", standIn: false });
    expect(recipientFor(reddit, "")).toBeNull();
  });
});

describe("Gmail sends and replies update the case", () => {
  const base = createDemoCase(NOW);
  const r = base.requests.find((x) => x.platformId === "x")!;
  const sent = recordGmailSend(base, r.id, { id: "g1", threadId: "t1", messageIdHeader: "<a@mail.gmail.com>" }, { to: "team@gmail.com", standIn: true }, at);
  const req = () => sent.requests.find((x) => x.id === r.id)!;

  it("starts the real 48h clock and remembers the thread", () => {
    expect(req()).toMatchObject({ status: "sent", sentAt: at, simulated: false, gmail: { threadId: "t1", to: "team@gmail.com", standIn: true } });
    expect(sent.evidence.at(-1)?.note).toMatch(/Sent from Gmail \(message g1\)/);
    expect(sent.activity[0].text).toMatch(/from your Gmail to the test inbox for X/);
  });

  it("clear replies apply once; unclear or image requests wait for her", () => {
    const removed = applyGmailReply(sent, r.id, "m1", { status: "removed", summary: "Taken down.", asksForImages: false }, at);
    expect(removed.requests.find((x) => x.id === r.id)!.status).toBe("removed");
    expect(applyGmailReply(removed, r.id, "m1", { status: "rejected", summary: "", asksForImages: false }, at)).toBe(removed);

    const unclear = applyGmailReply(sent, r.id, "m2", { status: "acknowledged", summary: "Send us the photos.", asksForImages: true }, at);
    expect(unclear.requests.find((x) => x.id === r.id)!.status).toBe("sent");
    expect(unclear.pendingReplies).toHaveLength(1);
    const resolved = resolvePendingReply(unclear, "m2", "rejected", at);
    expect(resolved.pendingReplies).toEqual([]);
    expect(resolved.requests.find((x) => x.id === r.id)!.status).toBe("rejected");
  });

  it("markSent from a simulated path is untouched (demo only)", () => {
    expect(markSent(base, [r.id], at, true).requests.find((x) => x.id === r.id)!.simulated).toBe(true);
  });
});

describe("live detection feeds", () => {
  it("finds the Tumblr feed for post and blog URLs", () => {
    expect(tumblrFeed("https://reclaim-test.tumblr.com/post/123/slug")?.feedUrl).toBe("https://reclaim-test.tumblr.com/rss");
    expect(tumblrFeed("https://www.tumblr.com/reclaim-test/123/slug")?.feedUrl).toBe("https://reclaim-test.tumblr.com/rss");
    expect(tumblrFeed("https://www.tumblr.com/dashboard")).toBeNull();
    expect(tumblrFeed("https://reddit.com/r/x")).toBeNull();
  });

  it("parses RSS and Atom into text-only posts", () => {
    const rss = `<rss><channel><title>Test blog</title>
      <item><title>Post one</title><link>https://t.tumblr.com/post/1</link><description><![CDATA[<p>Hello &amp; welcome</p><img src="https://64.media.tumblr.com/a.jpg"><figure><img src="b.png"></figure>]]></description></item>
      <item><title>Two</title><link>https://t.tumblr.com/post/2</link><description>&lt;p&gt;Second&lt;/p&gt;&lt;img src="c.gif"&gt;</description></item>
    </channel></rss>`;
    const f = parseFeed(rss);
    expect(f.title).toBe("Test blog");
    expect(f.items.map((i) => i.url)).toEqual(["https://t.tumblr.com/post/1", "https://t.tumblr.com/post/2"]);
    expect(f.items[0].text).toBe("Post one — Hello & welcome");
    for (const i of f.items) expect(i.text).not.toMatch(/img|\.jpg|\.png|\.gif|media\.tumblr/);
    const atom = `<feed><title>A</title><entry><title>E1</title><link href="https://a.example/e1"/><summary>Sum</summary></entry></feed>`;
    expect(parseFeed(atom).items).toEqual([{ url: "https://a.example/e1", text: "E1 — Sum" }]);
  });

  it("scanAccount reads the feed only (one fetch, text)", async () => {
    const fetched: string[] = [];
    const out = await scanAccount("https://t.tumblr.com/post/9", async (u: string) => {
      fetched.push(u);
      return { status: 200, text: "<rss><channel><title>T</title><item><title>x</title><link>https://t.tumblr.com/post/1</link></item></channel></rss>", finalUrl: u };
    });
    expect(fetched).toEqual(["https://t.tumblr.com/rss"]);
    expect(out?.posts).toHaveLength(1);
  });
});

describe("own-name search trusts only grounded results", () => {
  const gen = (text: string, chunks: unknown[] = []) => async () => ({
    model: "t",
    response: { text, candidates: [{ groundingMetadata: { groundingChunks: chunks } }] } as unknown as GenerateContentResponse,
  });

  it("resolves Google grounding links to real URLs (reading only the redirect)", async () => {
    const hits = await searchOwnNameGrounded(
      "Alex Rivera",
      gen('[{"url":"https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc","title":"A page"}]'),
      async () => "https://site.example/alex",
    );
    expect(hits).toEqual([{ url: "https://site.example/alex", title: "A page" }]);
  });

  it("drops invented URLs that no search returned", async () => {
    expect(await searchOwnNameGrounded("Alex Rivera", gen('[{"url":"https://made-up.example/x","title":"x"}]'))).toEqual([]);
    const ok = await searchOwnNameGrounded("Alex Rivera", gen('[{"url":"https://news.site.example/a","title":"a"}]', [{ web: { domain: "site.example", uri: "" } }]));
    expect(ok.map((h) => h.url)).toEqual(["https://news.site.example/a"]);
  });
});
