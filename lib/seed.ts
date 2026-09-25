// Fictional demo case. Every name, account and URL here is invented.
import { DEMO_URLS, fixtureTitle } from "@/data/fixtures";
import { HOUR_MS, RECHECK_INTERVAL_DAYS, DAY_MS } from "./config";
import { activity, draftRequests, evidenceFor, makeLink } from "./caseOps";
import { ATTESTATION_TEXT } from "./templates";
import { newId } from "./ids";
import type { Case } from "./types";
import { isoAt } from "./time";

export const DEMO_CASE_ID = "case_demo_jordan";

export function createDemoCase(now: number = Date.now()): Case {
  const firstSeen = isoAt(now - 26 * HOUR_MS);
  const signedAt = isoAt(now - 4 * 60000);
  const links = [DEMO_URLS.reddit, DEMO_URLS.x, DEMO_URLS.imgvault, DEMO_URLS.google].map((url, i) =>
    makeLink(url, isoAt(now - (26 - i) * HOUR_MS), undefined, fixtureTitle(url)),
  );
  const base: Case = {
    id: DEMO_CASE_ID,
    isDemo: true,
    createdAt: firstSeen,
    legalName: "Jordan Ellis",
    contactEmail: "jordan.ellis@example.com",
    isAdult: true,
    authorizesPreparation: true,
    autoSendConsent: true,
    reviewEachBeforeSending: false,
    attestation: { text: ATTESTATION_TEXT, signature: "Jordan Ellis", signedAt },
    links,
    requests: [],
    evidence: links.map((l) => evidenceFor(l, "logged", l.addedAt)),
    activity: [activity("Case opened. Four links added.", "neutral", isoAt(now - 6 * 60000))],
    chat: [
      { role: "agent", at: isoAt(now - 9 * 60000), text: "Hi, I'm here to help you get this taken down. You won't need to describe anything — I only need the links. What name should the requests go out under?" },
      { role: "user", at: isoAt(now - 8 * 60000), text: "Jordan Ellis" },
      { role: "agent", at: isoAt(now - 8 * 60000), text: "Thanks, Jordan. What email should platforms reply to? It can be a new address just for this." },
      { role: "user", at: isoAt(now - 7 * 60000), text: "jordan.ellis@example.com" },
      { role: "agent", at: isoAt(now - 7 * 60000), text: "Got it. Paste each link below — I'll find the right removal channel for every one. You can also add a Google search for your name." },
    ],
    nextRecheckAt: isoAt(now + RECHECK_INTERVAL_DAYS * DAY_MS),
  };
  return { ...base, requests: draftRequests(base, signedAt) };
}

export const GREETING =
  "Hi. I'm here to help you get this taken down, and you won't need to describe anything — I only need links. What name should the requests go out under?";

/** A fresh, empty case for a real user (created after the adult age check). */
export function createBlankCase(now: number = Date.now()): Case {
  const at = isoAt(now);
  return {
    id: newId("case"),
    isDemo: false,
    createdAt: at,
    legalName: "",
    contactEmail: "",
    isAdult: true,
    authorizesPreparation: true,
    autoSendConsent: false,
    reviewEachBeforeSending: false,
    attestation: { text: ATTESTATION_TEXT, signature: "" },
    links: [],
    requests: [],
    evidence: [],
    activity: [],
    chat: [{ role: "agent", at, text: GREETING }],
    nextRecheckAt: isoAt(now + RECHECK_INTERVAL_DAYS * DAY_MS),
  };
}
