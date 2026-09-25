// Runs the exact demo path end to end on the seeded fictional case and screenshots every
// step at 1440x900 and 390x844. Also probes robustness (AI endpoints failing or slow,
// double-clicks) and the under-18 route. Localhost only: Quick exit is never pressed.
//
//   npx tsx scripts/demo-walkthrough.ts before      → audit/before/
//   BASE_URL=http://localhost:3200 npx tsx scripts/demo-walkthrough.ts after
import { chromium, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = `audit/${process.argv[2] ?? "before"}`;
const AI_ROUTES = ["**/api/draft", "**/api/detect", "**/api/followup", "**/api/resolve", "**/api/recheck", "**/api/parse-reply"];

type Viewport = { name: string; opts: BrowserContextOptions };
const VIEWPORTS: Viewport[] = [
  { name: "desktop", opts: { viewport: { width: 1440, height: 900 } } },
  { name: "mobile", opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];

interface RunLog {
  viewport: string;
  actions: string[];
  waits: { step: string; ms: number }[];
  consoleErrors: string[];
  shots: string[];
}

function recorder(page: Page, dir: string, log: RunLog) {
  let n = 0;
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) log.consoleErrors.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => log.consoleErrors.push(`[pageerror] ${e.message.slice(0, 300)}`));
  return {
    shot: async (label: string, fullPage = true) => {
      const file = `${dir}/${String(++n).padStart(2, "0")}-${label}.png`;
      await page.screenshot({ path: file, fullPage });
      log.shots.push(file);
    },
    act: async (label: string, fn: () => Promise<unknown>) => {
      log.actions.push(label);
      await fn();
    },
    wait: async (label: string, fn: () => Promise<unknown>) => {
      const t = Date.now();
      await fn();
      log.waits.push({ step: label, ms: Date.now() - t });
    },
  };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mainFlow(browser: Browser, vp: Viewport): Promise<RunLog> {
  const dir = `${OUT}/${vp.name}`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext(vp.opts);
  const page = await ctx.newPage();
  const log: RunLog = { viewport: vp.name, actions: [], waits: [], consoleErrors: [], shots: [] };
  const { shot, act, wait } = recorder(page, dir, log);

  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await pause(600);
  await shot("landing");

  await act("select 18 or older", () => page.getByText("18 or older").click());
  await act("click Start", () => page.getByRole("button", { name: /Start/ }).click());
  await wait("landing → case", () => page.waitForURL("**/case"));
  await pause(700);
  await shot("case");

  await act("click Draft my requests", () => page.getByRole("button", { name: /Draft my requests/ }).click());
  await pause(250);
  await shot("case-drafting", false);
  await wait("draft (Gemini greetings)", () => page.waitForURL("**/case/requests", { timeout: 60000 }));
  await pause(600);
  await shot("requests");

  await act("click Live detection", () => page.getByRole("link", { name: /Live detection/ }).click());
  await wait("open detection", () => page.waitForURL("**/case/detect"));
  await pause(300);
  await shot("detect-start", false);
  await pause(4000);
  await shot("detect-scanning", false);
  await wait("detection scan", () => page.getByText(/posts? to review/).waitFor({ timeout: 90000 }));
  await pause(400);
  await shot("detect-done");

  await act("click Yes to all likely", () => page.getByRole("button", { name: /Yes to all/ }).click());
  await shot("detect-confirmed", false);
  await act("click Add to my requests", () => page.getByRole("button", { name: /Add \d+ to my requests/ }).click());
  await pause(200);
  await shot("detect-adding", false);
  await wait("add detected → requests", () => page.waitForURL("**/case/requests", { timeout: 60000 }));
  await pause(800);
  await shot("requests-with-instagram");

  await act("click Send all", () => page.getByRole("button", { name: /Send all|Review & send/ }).click());
  await wait("send → tracker", () => page.waitForURL("**/case/tracker", { timeout: 30000 }));
  await pause(1500);
  await shot("tracker-sent");

  await act("Shift+D", () => page.keyboard.press("Shift+D"));
  await pause(200);
  await shot("demo-panel", false);
  await act("click Simulate platform responses", () => page.getByRole("button", { name: /Simulate platform responses/ }).click());
  await pause(1200);
  await shot("tracker-simulated");

  await act("click Review & file complaint", () => page.getByRole("link", { name: /Review & file complaint/ }).click());
  await wait("open FTC page", () => page.waitForURL(/\/case\/ftc/));
  await pause(300);
  await shot("ftc-loading", false);
  await wait("FTC summary (Gemini)", () => page.getByText(/Summary drafted by Gemini|Summary from the template/).waitFor({ timeout: 60000 }));
  await shot("ftc");

  await act("go back to tracker", () => page.goto(`${BASE}/case/tracker`));
  await pause(800);
  await act("Shift+D", () => page.keyboard.press("Shift+D"));
  await act("click Fast-forward 3 days", () => page.getByRole("button", { name: /Fast-forward 3 days/ }).click());
  await pause(300);
  await shot("fastforward-busy", false);
  await wait("fast-forward re-check", () => page.getByRole("heading", { name: "Needs you" }).waitFor({ timeout: 60000 }));
  await page.keyboard.press("Shift+D"); // close panel for a clean shot
  await pause(800);
  await shot("tracker-fastforward");

  await act("share a link (phone)", () => page.goto(`${BASE}/share?title=post&text=${encodeURIComponent("look at this https://x.com/someone/status/1850000000000000000")}`));
  await pause(1500);
  await shot("share");

  await ctx.close();
  return log;
}

async function underEighteen(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.getByText("Under 18").click();
  await page.getByRole("button", { name: /Start/ }).click();
  await page.waitForURL("**/help/under-18");
  await pause(500);
  await page.screenshot({ path: `${OUT}/probe-under-18.png`, fullPage: true });
  const stored = await page.evaluate(() => localStorage.length);
  await ctx.close();
  return { storedKeysAfterUnder18: stored };
}

/** Every AI endpoint fails (wifi drop / Gemini outage). What does the presenter see? */
async function offline(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const r of AI_ROUTES) await page.route(r, (route) => route.abort("internetdisconnected"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/demo?preset=fresh`);
  await page.waitForURL("**/case");
  await pause(500);
  const t = Date.now();
  await page.getByRole("button", { name: /Draft my requests/ }).click();
  await page.waitForURL("**/case/requests", { timeout: 30000 });
  const draftMs = Date.now() - t;
  await pause(500);
  await page.screenshot({ path: `${OUT}/probe-offline-requests.png`, fullPage: true });
  await page.getByRole("link", { name: /Live detection/ }).click();
  await pause(14000);
  await page.screenshot({ path: `${OUT}/probe-offline-detect.png`, fullPage: true });
  await ctx.close();
  return { offlineDraftMs: draftMs, offlinePageErrors: errors };
}

/** Gemini answers slowly (8s). How long is the screen static? */
async function slow(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route("**/api/draft", async (route) => {
    await pause(8000);
    await route.continue();
  });
  await page.goto(`${BASE}/demo?preset=fresh`);
  await page.waitForURL("**/case");
  await pause(500);
  const t = Date.now();
  await page.getByRole("button", { name: /Draft my requests/ }).click();
  await pause(2000);
  await page.screenshot({ path: `${OUT}/probe-slow-draft-2s.png` });
  await page.waitForURL("**/case/requests", { timeout: 60000 });
  const ms = Date.now() - t;
  await ctx.close();
  return { slowDraftStaticMs: ms };
}

/** Presenter double-clicks under pressure. */
async function doubleClicks(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo?preset=fresh`);
  await page.waitForURL("**/case");
  await pause(500);
  await page.getByRole("button", { name: /Draft my requests/ }).dblclick();
  await page.waitForURL("**/case/requests", { timeout: 60000 });
  await pause(800);
  const requestsAfterDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("reclaim.activeCase.v1") ?? "{}").requests?.length ?? -1);
  await page.getByRole("button", { name: /Send all|Review & send/ }).dblclick();
  await page.waitForURL("**/case/tracker", { timeout: 30000 });
  await pause(800);
  const sentActivities = await page.evaluate(
    () => (JSON.parse(localStorage.getItem("reclaim.activeCase.v1") ?? "{}").activity ?? []).filter((a: { text: string }) => a.text.startsWith("Request sent")).length,
  );
  await ctx.close();
  return { requestsAfterDoubleClickDraft: requestsAfterDraft, sentActivitiesAfterDoubleClickSend: sentActivities };
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const runs: RunLog[] = [];
  for (const vp of VIEWPORTS) runs.push(await mainFlow(browser, vp));
  const probes = { ...(await underEighteen(browser)), ...(await offline(browser)), ...(await slow(browser)), ...(await doubleClicks(browser)) };
  await browser.close();
  const summary = runs.map((r) => ({
    viewport: r.viewport,
    actionCount: r.actions.length,
    actions: r.actions,
    longestWait: r.waits.reduce((a, w) => (w.ms > a.ms ? w : a), { step: "", ms: 0 }),
    waits: r.waits,
    consoleErrors: r.consoleErrors,
    screenshots: r.shots.length,
  }));
  writeFileSync(`${OUT}/run.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), summary, probes }, null, 2));
  console.log(JSON.stringify({ summary: summary.map(({ viewport, actionCount, longestWait, consoleErrors, screenshots }) => ({ viewport, actionCount, longestWait, errors: consoleErrors.length, screenshots })), probes }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
