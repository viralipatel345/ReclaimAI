import { describe, expect, it } from "vitest";
import { DEMO_URLS } from "@/data/fixtures";
import { DAY_MS, HOUR_MS } from "@/lib/config";
import { fastForward, shiftCase, simulatePlatformResponses } from "@/lib/demo";
import { classifyPage, runRecheck } from "@/lib/recheck";
import { addNameResults, answerUnclear, applyPageStatus, confirmNameResult, dismissNameResult, latestRequestFor, recheckIntervalDays, scheduleNext } from "@/lib/recheckOps";
import { createDemoCase } from "@/lib/seed";
import { SECTION } from "@/lib/templates";

const NOW = Date.parse("2026-09-25T18:00:00.000Z");
const linkId = (c: ReturnType<typeof createDemoCase>, url: string) => c.links.find((l) => l.url === url)!.id;

describe("classifyPage", () => {
  const page = (httpStatus: number, text = "", title = "") => ({ httpStatus, title, text });
  it("uses HTTP status and removal wording before any model call", async () => {
    const never = async () => {
      throw new Error("model must not be called");
    };
    expect((await classifyPage(page(404), never)).status).toBe("removed");
    expect((await classifyPage(page(410), never)).status).toBe("removed");
    expect((await classifyPage(page(403), never)).status).toBe("unclear");
    expect((await classifyPage(page(200, "Sorry, this post was removed by Reddit's safety filters."), never)).status).toBe("removed");
  });
  it("never guesses: bad or failed model output is unclear", async () => {
    expect((await classifyPage(page(200, "Log in to continue"), async () => ({ status: "probably live" }))).status).toBe("unclear");
    expect((await classifyPage(page(200, "Log in to continue"), async () => { throw new Error("503"); })).status).toBe("unclear");
    expect((await classifyPage(page(200, "Posted by u/x · 12 comments"), async () => ({ status: "live" }))).status).toBe("live");
  });
});

describe("page status transitions", () => {
  const sim = simulatePlatformResponses(createDemoCase(NOW), NOW);
  const at = new Date(NOW).toISOString();

  it("live after removal → re-file citing the original request, auto-sent with consent", () => {
    const reddit = linkId(sim, DEMO_URLS.reddit);
    const original = latestRequestFor(sim, reddit)!;
    const { next, changed } = applyPageStatus(sim, reddit, "live", at, true);
    expect(changed).toBe(true);
    const refile = latestRequestFor(next, reddit)!;
    expect(refile).toMatchObject({ kind: "refile", parentRequestId: original.id, status: "sent", simulated: true });
    expect(refile.body).toContain(SECTION.reupload);
    expect(refile.body).toContain(original.id);
    expect(Date.parse(refile.deadlineAt!) - NOW).toBe(48 * HOUR_MS);
    // a second live check doesn't file again
    expect(applyPageStatus(next, reddit, "live", at, true).next.requests).toHaveLength(next.requests.length);
  });

  it("without auto-send consent the re-file waits for her", () => {
    const noConsent = { ...sim, autoSendConsent: false };
    const { next } = applyPageStatus(noConsent, linkId(sim, DEMO_URLS.reddit), "live", at, true);
    expect(latestRequestFor(next, linkId(sim, DEMO_URLS.reddit))).toMatchObject({ kind: "refile", status: "ready" });
  });

  it("removed page confirms removal; live page on an open request changes nothing", () => {
    const img = linkId(sim, DEMO_URLS.imgvault);
    expect(latestRequestFor(applyPageStatus(sim, img, "removed", at, true).next, img)!.status).toBe("removed");
    const live = applyPageStatus(sim, img, "live", at, true);
    expect(live.changed).toBe(false);
    expect(live.next.requests).toEqual(sim.requests);
    expect(live.next.evidence.at(-1)).toMatchObject({ event: "recheck" }); // every check is logged
  });

  it("unclear asks the user once and never guesses", () => {
    const img = linkId(sim, DEMO_URLS.imgvault);
    const first = applyPageStatus(sim, img, "unclear", at, true);
    expect(first.changed).toBe(true);
    expect(first.next.links.find((l) => l.id === img)!.needsUserCheck).toBe(true);
    expect(applyPageStatus(first.next, img, "unclear", at, true).changed).toBe(false);
    const gone = answerUnclear(first.next, img, false, at, true);
    expect(gone.links.find((l) => l.id === img)!.needsUserCheck).toBe(false);
    expect(latestRequestFor(gone, img)!.status).toBe("removed");
  });
});

describe("Google results for her own name", () => {
  const c = createDemoCase(NOW);
  const at = new Date(NOW).toISOString();
  const found = [{ url: "https://imgvault.example/v/new1", title: "New" }];

  it("new results wait for confirmation; nothing is filed", () => {
    const { next, added } = addNameResults(c, found, at);
    expect(added).toBe(1);
    expect(next.links).toHaveLength(c.links.length);
    expect(next.requests).toHaveLength(c.requests.length);
    expect(addNameResults(next, found, at).added).toBe(0);
  });
  it("confirm adds a link and request; dismiss is remembered", () => {
    const pending = addNameResults(c, found, at).next;
    const confirmed = confirmNameResult(pending, found[0].url, at, true);
    expect(confirmed.links.some((l) => l.url === found[0].url)).toBe(true);
    expect(confirmed.pendingResults).toEqual([]);
    const dismissed = dismissNameResult(pending, found[0].url);
    expect(addNameResults(dismissed, found, at).added).toBe(0);
  });
});

describe("schedule", () => {
  it("every 3 days; weekly after 30 clean days", () => {
    let c = simulatePlatformResponses(createDemoCase(NOW), NOW);
    c = scheduleNext(c, NOW);
    expect(recheckIntervalDays(c)).toBe(3);
    const at = new Date(NOW).toISOString();
    for (const l of c.links.filter((x) => x.kind === "content")) c = applyPageStatus(c, l.id, "removed", at, true).next;
    c = scheduleNext(c, NOW);
    expect(c.cleanSince).toBe(at);
    expect(recheckIntervalDays(scheduleNext(c, NOW + 29 * DAY_MS))).toBe(3);
    expect(recheckIntervalDays(scheduleNext(c, NOW + 30 * DAY_MS))).toBe(7);
  });
});

describe("demo: Fast-forward 3 days", () => {
  it("shifts every timestamp", () => {
    const c = createDemoCase(NOW);
    const s = shiftCase(c, -3 * DAY_MS);
    expect(Date.parse(s.createdAt)).toBe(Date.parse(c.createdAt) - 3 * DAY_MS);
    expect(Date.parse(s.evidence[0].at)).toBe(Date.parse(c.evidence[0].at) - 3 * DAY_MS);
    expect(s.links[0].url).toBe(c.links[0].url);
  });

  it("Reddit still removed ✓, X re-upload auto re-filed with a new 48h clock, a name result to confirm", async () => {
    const sim = simulatePlatformResponses(createDemoCase(NOW), NOW);
    const later = NOW + 5 * 60000;
    const { case: c, changes } = await runRecheck(fastForward(sim, later), later, { demo: true });
    const x = linkId(c, DEMO_URLS.x);
    const reddit = linkId(c, DEMO_URLS.reddit);
    const refile = latestRequestFor(c, x)!;
    expect(refile.kind).toBe("refile");
    expect(refile.sentAt).toBe(new Date(later).toISOString());
    expect(c.requests.find((r) => r.id === refile.parentRequestId)!.status).toBe("removed");
    expect(latestRequestFor(c, reddit)!.status).toBe("removed");
    expect(c.links.find((l) => l.id === reddit)!.lastCheck?.status).toBe("removed");
    expect(c.requests.filter((r) => r.kind === "refile")).toHaveLength(1);
    expect(c.pendingResults?.map((r) => r.url)).toEqual([DEMO_URLS.nameResult]);
    expect(changes).toBeGreaterThan(0);
    expect(c.evidence.filter((e) => e.event === "recheck")).toHaveLength(3);
  });
});

describe("demo mode with a live link", () => {
  it("uses fixtures for the fictional seed URLs but re-checks any other link for real", async () => {
    const { addLinkWithRequest } = await import("@/lib/recheckOps");
    const sim = simulatePlatformResponses(createDemoCase(NOW), NOW);
    const live = "https://reclaim-demo-test.tumblr.com/post/123";
    // As resolved live by Gemini + Google Search in the demo
    const tumblr = { id: "search:tumblr.com", name: "Tumblr", channel: "form" as const, target: "https://www.tumblr.com/abuse", confidence: 0.9, source: "search" as const, coveredByAct: true };
    const withLive = addLinkWithRequest(sim, live, new Date(NOW).toISOString(), true, tumblr).next;
    const fetched: string[] = [];
    const fetchText = async (url: string) => {
      fetched.push(url);
      return { httpStatus: 404, title: "", text: "" };
    };
    const { case: c } = await runRecheck(withLive, NOW + 60000, { demo: true, fetchText });
    expect(fetched).toEqual([live]); // seed URLs never hit the network
    expect(latestRequestFor(c, c.links.find((l) => l.url === live)!.id)!.status).toBe("removed");
    expect(c.activity[0].text).toMatch(/confirmed .* removed/);
  });
});

describe("fast-forward after live detection", () => {
  it("keeps the story: Instagram removed, no network, no 'unclear', X re-upload is the only open thread", async () => {
    const { SANDBOX_ACCOUNT } = await import("@/data/sandbox");
    const { addDetectedLinks } = await import("@/lib/detect");
    const { markSent } = await import("@/lib/caseOps");
    const { displayStatus } = await import("@/lib/caseOps");
    const likely = SANDBOX_ACCOUNT.posts.slice(0, 5).filter((p) => ["Cq7Lx2aPq1", "Cq5Rz1cHy7", "Cq3Jb9eQs5"].includes(p.id));
    let c = createDemoCase(NOW);
    const at = new Date(NOW).toISOString();
    const added = addDetectedLinks(c, likely.map((p) => ({ url: p.url, caption: p.caption })), at);
    c = markSent(added.next, added.next.requests.filter((r) => r.status === "ready").map((r) => r.id), at, true);
    c = simulatePlatformResponses(c, NOW);
    const later = NOW + 5 * 60000;
    const fetched: string[] = [];
    const { case: out } = await runRecheck(fastForward(c, later), later, {
      demo: true,
      fetchText: async (u) => {
        fetched.push(u);
        return { httpStatus: 200, title: "", text: "" };
      },
    });
    expect(fetched).toEqual([]);
    expect(out.links.some((l) => l.needsUserCheck)).toBe(false);
    const ig = out.requests.find((r) => r.platformId === "instagram")!;
    expect(ig.status).toBe("removed");
    const open = out.requests.filter((r) => !["removed"].includes(displayStatus(r, later)));
    expect(open.map((r) => `${r.platformId}:${r.kind}`)).toEqual(["x:refile"]);
  });
});
