import { HOUR_MS } from "./config";

const pad = (n: number) => String(n).padStart(2, "0");

/** HH:MM:SS for a non-negative duration. */
export function hms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "19h 42m" */
export function hoursMinutes(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function shortDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * HOUR_MS).toISOString();
}
