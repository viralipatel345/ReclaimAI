// Incident storage behind one interface (same pattern as lib/store.ts) so the
// Prisma adapter for prisma/schema.prisma can replace the in-memory store later.
// Every write publishes to the status bus so the Reports + Status tab stays in sync.
import { newId } from "../ids";
import { publishStatus } from "./events";
import type { CaseReport, CaseStatus, StatusEvent } from "./types";

export interface IncidentStore {
  get(id: string): Promise<CaseReport | null>;
  save(c: CaseReport): Promise<void>;
  delete(id: string): Promise<void>;
  listByUser(userId: string): Promise<CaseReport[]>;
  /** Cases under an active mandate whose next scheduled check is due. */
  listDue(now: number): Promise<CaseReport[]>;
}

export function isDue(c: CaseReport, now: number): boolean {
  return !!c.mandate?.enabled && c.status !== "SEALED" && !!c.nextCheckAt && new Date(c.nextCheckAt).getTime() <= now;
}

class MemoryIncidentStore implements IncidentStore {
  private cases = new Map<string, CaseReport>();
  async get(id: string) {
    return this.cases.get(id) ?? null;
  }
  async save(c: CaseReport) {
    this.cases.set(c.id, structuredClone(c));
  }
  async delete(id: string) {
    this.cases.delete(id);
  }
  async listByUser(userId: string) {
    return [...this.cases.values()].filter((c) => c.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async listDue(now: number) {
    return [...this.cases.values()].filter((c) => isDue(c, now));
  }
}

const g = globalThis as unknown as { __reclaimIncidentStore?: IncidentStore };
export const incidentStore: IncidentStore = (g.__reclaimIncidentStore ??= new MemoryIncidentStore());

export function statusEvent(caseId: string, status: CaseStatus, text: string, at = new Date().toISOString()): StatusEvent {
  return { id: newId("evt"), caseId, status, text, at };
}

/** Apply a status transition, append the event, persist, and publish it to subscribers. */
export async function transition(c: CaseReport, status: CaseStatus, text: string, store: IncidentStore = incidentStore): Promise<CaseReport> {
  const at = new Date().toISOString();
  const evt = statusEvent(c.id, status, text, at);
  const next: CaseReport = { ...c, status, updatedAt: at, events: [evt, ...c.events] };
  await store.save(next);
  publishStatus(evt);
  return next;
}
