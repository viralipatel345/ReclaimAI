// Reporting channels the agent can file through. Pure data, shared by client and server.
import { FTC_REPORT_URL } from "../config";
import type { ReportChannel, ReportStatus } from "./types";

export interface ChannelMeta {
  label: string;
  description: string;
  destination: string;
  /** True when a link to the content is required (platform notices). */
  needsUrl?: boolean;
  /** True when no API exists for individuals: the agent prepares everything and hands off. */
  handOff?: boolean;
}

export const STOPNCII_URL = "https://stopncii.org/";
export const PARASELL_URL = "https://api.parasell.com/v1/reports";

export const CHANNELS: Record<ReportChannel, ChannelMeta> = {
  platform: {
    label: "Platform takedown notice",
    description: "Formal TAKE IT DOWN Act request to the site hosting the content. Covered platforms must remove it within 48 hours.",
    destination: "The platform's official removal channel",
    needsUrl: true,
  },
  stopncii: {
    label: "StopNCII.org",
    description: "Fingerprints the images so partner platforms — Meta, Google, TikTok, X, Bing — block re-uploads before they appear.",
    destination: STOPNCII_URL,
    handOff: true,
  },
  ftc: {
    label: "FTC complaint",
    description: "Reports a platform that ignored or rejected a valid notice. The FTC enforces the Act.",
    destination: FTC_REPORT_URL,
    handOff: true,
  },
  police: {
    label: "Police report",
    description: "Dispatch-format summary for extortion, threats or stalking. Filed by you; the agent prepares it.",
    destination: "Local police non-emergency line · 911 if you are in danger",
    handOff: true,
  },
  parasell: {
    label: "Parasell partner escalation",
    description: "Sends the verified record — hashes and verdicts only, never media — to the partner API.",
    destination: PARASELL_URL,
  },
};

export const CHANNEL_ORDER: ReportChannel[] = ["platform", "stopncii", "ftc", "police", "parasell"];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  running: "Working…",
  sent: "Sent",
  simulated: "Sent (demo)",
  handed_off: "Ready — finish at destination",
  prepared: "Ready to send",
  failed: "Failed",
};
