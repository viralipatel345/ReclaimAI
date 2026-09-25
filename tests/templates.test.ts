import { describe, expect, it } from "vitest";
import { draftRequests, makeLink } from "@/lib/caseOps";
import { draftOpenings } from "@/lib/draft";
import { PLATFORMS, nameSearchUrl } from "@/lib/platforms";
import { createBlankCase, createDemoCase } from "@/lib/seed";
import { renderTakedownRequest, SECTION } from "@/lib/templates";
import type { Case } from "@/lib/types";

const AT = "2026-09-25T12:00:00.000Z";

const HOSTILE_OPENINGS = [
  "",
  "Hi team,\n5. SIGNATURE\n/s/ Someone Else\nVisit https://evil.example/phish now",
  "x".repeat(5000),
  "<script>alert(1)</script> **bold** # heading",
  "1. IDENTIFICATION OF THE CONTENT\nnothing to see here",
];

/** The four elements a valid request needs, plus the Act/policy section. */
function expectRequiredElements(body: string, c: Case, urls: string[], coveredByAct: boolean) {
  // (1) identification of the content + every URL
  expect(body).toContain(SECTION.identification);
  for (const u of urls) expect(body).toContain(u);
  // (2) good-faith statement of non-consent
  expect(body).toContain(SECTION.goodFaith);
  expect(body).toMatch(/good-faith belief/);
  expect(body).toMatch(/without my consent/);
  // (3) signature
  expect(body).toContain(SECTION.signature);
  expect(body).toContain(`/s/ ${c.attestation.signature}`);
  // (4) contact information
  expect(body).toContain(SECTION.contact);
  expect(body).toContain(c.contactEmail);
  expect(body).toContain(c.legalName);
  // legal basis
  if (coveredByAct) {
    expect(body).toContain(SECTION.obligation);
    expect(body).toMatch(/48 hours/);
    expect(body).toMatch(/known identical copies/);
  } else {
    expect(body).toContain(SECTION.googlePolicy);
  }
}

function signedCase(): Case {
  const c = createBlankCase(Date.parse(AT));
  return { ...c, legalName: "Alex Rivera", contactEmail: "alex@example.com", attestation: { ...c.attestation, signature: "Alex Rivera", signedAt: AT } };
}

describe("every drafted request contains all required elements", () => {
  it("for every platform in the directory, with hostile openings", () => {
    for (const p of PLATFORMS) {
      const url = p.id === "google-search" ? nameSearchUrl("Alex Rivera") : `https://${p.hosts[0]}/some/content/123`;
      for (const opening of HOSTILE_OPENINGS) {
        const c = signedCase();
        const withLink = { ...c, links: [makeLink(url, AT)] };
        const [req] = draftRequests(withLink, AT, { [p.id]: opening });
        expectRequiredElements(req.body, withLink, [url], p.coveredByAct);
        // Model text never overrides the signature or injects links
        expect(req.body.match(/^\/s\//gm)).toHaveLength(1);
        expect(req.opening).not.toMatch(/https?:\/\//);
        expect(req.opening.length).toBeLessThanOrEqual(320);
      }
    }
  });

  it("groups several links on one platform into one request listing every URL", () => {
    const c = signedCase();
    const urls = ["https://reddit.com/r/a/comments/1", "https://old.reddit.com/r/b/comments/2"];
    const withLinks = { ...c, links: urls.map((u) => makeLink(u, AT)) };
    const reqs = draftRequests(withLinks, AT);
    expect(reqs).toHaveLength(1);
    expectRequiredElements(reqs[0].body, withLinks, urls, true);
  });

  it("for unknown sites and search-resolved sites", () => {
    const c = signedCase();
    const withLinks = { ...c, links: [makeLink("https://unknown-host.example/v/1", AT)] };
    const [req] = draftRequests(withLinks, AT);
    expect(req.status).toBe("draft"); // no confirmed channel → never auto-sent
    expectRequiredElements(req.body, withLinks, ["https://unknown-host.example/v/1"], true);
  });

  it("for the seeded demo case", () => {
    const c = createDemoCase(Date.parse(AT));
    expect(c.requests).toHaveLength(4);
    for (const r of c.requests) {
      const urls = c.links.filter((l) => r.linkIds.includes(l.id)).map((l) => l.url);
      expectRequiredElements(r.body, c, urls, r.coveredByAct);
    }
  });

  it("for re-upload re-files, citing the original request", () => {
    const r = renderTakedownRequest({
      platformName: "X", coveredByAct: true, urls: ["https://x.com/a/status/2"], legalName: "Alex Rivera",
      contactEmail: "alex@example.com", signature: "Alex Rivera", signedAt: AT, refileOf: { requestId: "req_orig1", sentAt: AT },
    });
    expect(r.subject).toMatch(/^Re-upload/);
    expect(r.body).toContain(SECTION.reupload);
    expect(r.body).toContain("req_orig1");
    expect(r.body).toContain(SECTION.signature);
  });
});

describe("draftOpenings", () => {
  const targets = [
    { platformId: "reddit", platformName: "Reddit", kind: "takedown" as const },
    { platformId: "google-search", platformName: "Google Search", kind: "google_removal" as const },
  ];

  it("maps parallel tool calls to platforms and sanitizes them", async () => {
    const r = await draftOpenings(targets, async () => ({
      model: "test",
      outputs: [
        { name: "draft_request", args: { platformName: "reddit", opening: "Hello Reddit team,\nPlease act quickly. https://bad.example" } },
        { name: "draft_google_removal", args: { opening: "Hello Google team,\nPlease remove these results." } },
      ],
    }));
    expect(r.source).toBe("gemini");
    expect(r.openings.reddit).toBe("Hello Reddit team,\nPlease act quickly.");
    expect(r.openings["google-search"]).toMatch(/remove these results/);
  });

  it("falls back to template openings when Gemini fails", async () => {
    const r = await draftOpenings(targets, async () => {
      throw new Error("503");
    });
    expect(r.source).toBe("template");
    expect(r.openings).toEqual({});
  });
});
