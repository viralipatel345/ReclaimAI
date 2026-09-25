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
    nextRecheckAt: isoAt(now + RECHECK_INTERVAL_DAYS * DAY_MS),
    demoPageState: { [DEMO_URLS.reddit]: "live", [DEMO_URLS.x]: "live", [DEMO_URLS.imgvault]: "live" },
  };
  return { ...base, requests: draftRequests(base, signedAt) };
}

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
    nextRecheckAt: isoAt(now + RECHECK_INTERVAL_DAYS * DAY_MS),
  };
}
