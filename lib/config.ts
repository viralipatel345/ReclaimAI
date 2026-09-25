// Central configuration. Every model name lives here so it can be corrected in one place.
// Server-only values (API key, DEMO_MODE) are read from process.env at request time.

export const MODELS = {
  /** Main agent model (intake, drafting openings, classification). */
  primary: process.env.GEMINI_MODEL ?? "gemini-3.1-pro-preview",
  /** Used automatically when the primary model returns 429 / 503. */
  fallback: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-flash-latest",
  /** Low-stakes, latency-sensitive text (request openings, reminders). */
  fast: process.env.GEMINI_FAST_MODEL ?? "gemini-flash-latest",
  /** Separate call with the googleSearch grounding tool, used by resolve_platform. */
  grounding: process.env.GEMINI_GROUNDING_MODEL ?? "gemini-flash-latest",
} as const;

export const GEMINI_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 600,
  retryableStatus: [429, 503],
} as const;

export const DEADLINE_HOURS = 48;
export const REMINDER_HOURS = [24, 44] as const;
export const RECHECK_INTERVAL_DAYS = 3;
/** After this many consecutive clean days, rechecks slow to weekly. */
export const WEEKLY_AFTER_CLEAN_DAYS = 30;
/** resolve_platform: below this confidence we never guess a channel. */
export const MIN_PLATFORM_CONFIDENCE = 0.7;

export const QUICK_EXIT_URL = "https://weather.com";
export const NCMEC_TAKE_IT_DOWN_URL = "https://takeitdown.ncmec.org";
// TODO(verify): swap for the FTC's dedicated TAKE IT DOWN Act reporting page once confirmed.
export const FTC_REPORT_URL = "https://reportfraud.ftc.gov/";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Real-mode integrations. Read at request time on the server and handed to the browser.
 * GOOGLE_CLIENT_ID: OAuth web client for Google sign-in (Gmail send + read), public by design.
 * TEST_PLATFORM_INBOX: when set, every request email goes here instead of the platform,
 * clearly labeled as a stand-in — for rehearsals and judging without filing real notices.
 */
export function publicAppConfig() {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    testPlatformInbox: process.env.TEST_PLATFORM_INBOX ?? "",
    /** No test inbox needed: each request is addressed to the user's own email, labeled as a stand-in. */
    sendToSelf: process.env.SEND_TO_SELF === "true",
  };
}
export type PublicAppConfig = ReturnType<typeof publicAppConfig>;
