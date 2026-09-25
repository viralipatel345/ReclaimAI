// What the user can authorize the agent to do on its own. Pure data, shared by client and server.
import type { MandateAction } from "./types";

export const MANDATE_ACTIONS: { id: MandateAction; label: string; description: string }[] = [
  { id: "platform_notice", label: "Send takedown notices", description: "A TAKE IT DOWN Act notice, in your name, to each platform hosting a new AI-generated image of you." },
  { id: "stopncii", label: "Register with StopNCII", description: "Fingerprint the images once so partner platforms block re-uploads." },
  { id: "ftc_after_deadline", label: "File FTC complaints", description: "Only when a platform misses its 48-hour deadline and the content is still up." },
  { id: "parasell", label: "Escalate to Parasell", description: "Send the verified record — hashes and verdicts, never media — to the partner API." },
];

export const MANDATE_TEXT =
  "I authorize Reclaim to keep checking for AI-generated images of me, to send removal notices in my name to platforms that host them, and to escalate to StopNCII, the FTC and partner services as I have allowed below. Every action is recorded and I can pause this at any time.";

export const DEFAULT_MANDATE = { allowedActions: MANDATE_ACTIONS.map((a) => a.id), cadenceHours: 24, maxNoticesPerRun: 5 } as const;
export const CADENCE_OPTIONS: { hours: number; label: string }[] = [
  { hours: 6, label: "Every 6 hours" },
  { hours: 24, label: "Daily" },
  { hours: 72, label: "Every 3 days" },
];

export const HOW_IT_WORKS: { step: string; text: string }[] = [
  { step: "Watch", text: "On schedule, the agent re-runs the AI-image search by name. Your upload was never kept." },
  { step: "Decide", text: "A fixed policy — not the model — maps each finding to an action inside your mandate. Anything outside it waits for you." },
  { step: "Act", text: "Notices, StopNCII, FTC and Parasell go through the same reporting agent, so every step is timestamped." },
  { step: "Record", text: "Each run is written to the case and covered by the sealed hash. Pause revokes the mandate instantly." },
];
