// Hard rule 1: LINKS ONLY. No request or re-check code path downloads or stores image bytes.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { markSent } from "@/lib/caseOps";
import { fetchPageText, htmlToText, isFetchableUrl, NotTextError } from "@/lib/pageText";
import { runRecheck } from "@/lib/recheck";
import { createBlankCase } from "@/lib/seed";
import { addLink, draftRequests } from "@/lib/caseOps";

/** A response whose body records whether anyone read it. */
function trackedResponse(contentType: string, bytes: Uint8Array, status = 200) {
  const state = { read: false };
  // highWaterMark 0: the stream only pulls when a consumer actually reads.
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        state.read = true;
        controller.enqueue(bytes);
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  return { res: new Response(body, { status, headers: { "content-type": contentType } }), state };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("page fetches never download media", () => {
  it.each(["image/jpeg", "image/png", "video/mp4", "application/octet-stream", ""])("refuses %s without reading the body", async (type) => {
    const { res, state } = trackedResponse(type, JPEG);
    const fetchImpl = vi.fn(async () => res) as unknown as typeof fetch;
    await expect(fetchPageText("https://imgvault.example/v/a7Qx2Lm9.jpg", fetchImpl)).rejects.toBeInstanceOf(NotTextError);
    expect(state.read).toBe(false);
  });

  it("asks only for text/html", async () => {
    const { res } = trackedResponse("text/html", new TextEncoder().encode("<title>t</title>"));
    const fetchImpl = vi.fn<(url: unknown, init?: RequestInit) => Promise<Response>>(async () => res);
    await fetchPageText("https://example.com/p", fetchImpl as unknown as typeof fetch);
    const accept = new Headers(fetchImpl.mock.calls[0][1]?.headers).get("accept") ?? "";
    expect(accept).toMatch(/^text\/html/);
    expect(accept).not.toMatch(/image|video|\*\/\*/);
  });

  it("strips every media element, attribute and data URI from HTML", () => {
    const html = `<html><head><title>Post</title><meta property="og:image" content="https://cdn.example/a.jpg"></head><body>
      <p>Hello</p><img src="https://cdn.example/a.jpg" srcset="a.jpg 1x, b.jpg 2x"><picture><source srcset="c.webp"></picture>
      <video src="v.mp4"><track src="t.vtt"></video><svg><image href="d.png"/></svg>
      <div style="background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==)">bg</div>
      <a href="https://cdn.example/e.gif">link text</a><iframe src="x"></iframe><canvas></canvas></body></html>`;
    const { title, text } = htmlToText(html);
    expect(title).toBe("Post");
    expect(text).toContain("Hello");
    for (const bad of ["<img", "srcset", ".jpg", ".webp", ".mp4", ".png", ".gif", "base64", "data:", "cdn.example"]) expect(text).not.toContain(bad);
  });

  it("refuses private and local hosts (no SSRF into metadata servers)", () => {
    for (const u of ["http://localhost:3000/x", "http://127.0.0.1/x", "http://169.254.169.254/latest", "http://10.0.0.5/", "http://192.168.1.1/", "http://metadata.google.internal/", "file:///etc/passwd"]) {
      expect(isFetchableUrl(u)).toBe(false);
    }
    expect(isFetchableUrl("https://www.reddit.com/r/x")).toBe(true);
  });
});

describe("re-checks store only a title and a status", () => {
  it("never keeps page bodies in the case or evidence", async () => {
    const at = "2026-09-20T12:00:00.000Z";
    let c = createBlankCase(Date.parse(at));
    c = { ...c, legalName: "Alex Rivera", contactEmail: "a@example.com", attestation: { ...c.attestation, signature: "Alex Rivera", signedAt: at } };
    c = addLink(c, "https://www.reddit.com/r/x/comments/1", at);
    c = { ...c, requests: draftRequests(c, at) };
    c = markSent(c, c.requests.map((r) => r.id), at, false);
    const result = await runRecheck(c, Date.parse(at) + 3 * 86400000, {
      demo: false,
      fetchText: async () => ({ httpStatus: 200, title: "Post title", text: "SECRET_BODY_TEXT still here" }),
      classifier: async () => ({ status: "live", reason: "Post visible." }),
      searchName: async () => [],
    });
    const stored = JSON.stringify(result.case);
    expect(stored).not.toContain("SECRET_BODY_TEXT");
    expect(result.case.evidence.at(-1)).toMatchObject({ event: "recheck", pageTitle: "Post title" });
  });
});

describe("no image handling anywhere in the code", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  ["lib", "app", "components"].forEach(walk);

  it.each([
    ["Gemini inline image parts", /inlineData/],
    ["Gemini file parts", /fileData/],
    ["Gemini Files API uploads", /\.files\.upload|ai\.files/],
    ["urlContext (would let the model fetch pages with images)", /urlContext\s*:/],
    ["file inputs", /type=["']file["']/],
    ["FileReader", /new FileReader/],
    ["image downloads", /\.blob\(\)|arrayBuffer\(\)\s*;?\s*\/\/\s*image/],
  ])("does not use %s", (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
