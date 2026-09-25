import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { HOUR_MS } from "@/lib/config";
import { extractUrl } from "@/lib/platforms";
import { addLinkWithRequest } from "@/lib/recheckOps";
import { createBlankCase, createDemoCase } from "@/lib/seed";

const NOW = Date.parse("2026-09-25T18:00:00.000Z");
const at = new Date(NOW).toISOString();

describe("PWA share target", () => {
  const m = manifest() as ReturnType<typeof manifest> & { share_target: { action: string; method: string; params: Record<string, unknown> } };

  it("accepts url/text/title via GET — and no files, so images can't be shared in", () => {
    expect(m.share_target).toEqual({ action: "/share", method: "GET", params: { url: "url", text: "text", title: "title" } });
    expect(JSON.stringify(m.share_target)).not.toMatch(/files|enctype|multipart/);
  });

  it("is installable: standalone with 192/512 PNG icons and a maskable icon", () => {
    expect(m.display).toBe("standalone");
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192" && i.type === "image/png")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.type === "image/png")).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("the service worker caches nothing", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).not.toMatch(/caches\.open|cache\.put|cache\.add|addEventListener\(["']fetch/);
  });

  it.each([
    ["Check this out https://x.com/a/status/123?s=20", "https://x.com/a/status/123?s=20"],
    ["https://www.reddit.com/r/x/comments/abc/", "https://www.reddit.com/r/x/comments/abc/"],
    ["imgvault.example/v/zz91", "https://imgvault.example/v/zz91"],
  ])("extracts the link from shared text: %s", (text, url) => {
    expect(extractUrl(text)).toBe(url);
  });

  it("ignores shared text without a link", () => {
    expect(extractUrl("this is so upsetting")).toBeNull();
  });
});

describe("one tap per link", () => {
  it("with consent: adds the link, drafts and sends, starting a 48h clock", () => {
    const c = createDemoCase(NOW);
    const { next, request } = addLinkWithRequest(c, "https://t.me/examplechan/42", at, true);
    expect(next.links).toHaveLength(c.links.length + 1);
    expect(request).toMatchObject({ platformName: "Telegram", channel: "email", status: "sent", simulated: true });
    expect(Date.parse(request!.deadlineAt!) - NOW).toBe(48 * HOUR_MS);
  });

  it("without a signature or consent it drafts but never sends", () => {
    const unsigned = createBlankCase(NOW);
    expect(addLinkWithRequest({ ...unsigned, autoSendConsent: true }, "https://t.me/c/1", at, false).request?.status).toBe("ready");
    const noConsent = { ...createDemoCase(NOW), autoSendConsent: false };
    expect(addLinkWithRequest(noConsent, "https://t.me/c/1", at, false).request?.status).toBe("ready");
    const review = { ...createDemoCase(NOW), reviewEachBeforeSending: true };
    expect(addLinkWithRequest(review, "https://t.me/c/1", at, false).request?.status).toBe("ready");
  });

  it("sharing the same link twice changes nothing", () => {
    const first = addLinkWithRequest(createDemoCase(NOW), "https://t.me/examplechan/42", at, true).next;
    const again = addLinkWithRequest(first, "https://t.me/examplechan/42", at, true);
    expect(again.next).toBe(first);
    expect(again.request?.status).toBe("sent");
  });
});
