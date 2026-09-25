// Case storage behind one interface so Firestore can replace it later.
// Server: in-memory (survives dev hot reloads via globalThis).
// Client: localStorage mirror of the active case, cleared by Quick exit.
import type { Case } from "./types";

export interface CaseStore {
  get(id: string): Promise<Case | null>;
  save(c: Case): Promise<void>;
  delete(id: string): Promise<void>;
  listOpen(): Promise<Case[]>;
}

class MemoryCaseStore implements CaseStore {
  private cases = new Map<string, Case>();
  async get(id: string) {
    return this.cases.get(id) ?? null;
  }
  async save(c: Case) {
    this.cases.set(c.id, structuredClone(c));
  }
  async delete(id: string) {
    this.cases.delete(id);
  }
  async listOpen() {
    return [...this.cases.values()].filter((c) => c.requests.some((r) => r.status !== "removed" && r.status !== "rejected"));
  }
}

const g = globalThis as unknown as { __reclaimStore?: CaseStore };
export const serverStore: CaseStore = (g.__reclaimStore ??= new MemoryCaseStore());

export const LOCAL_KEY = "reclaim.activeCase.v1";

export const localMirror = {
  load(): Case | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      return raw ? (JSON.parse(raw) as Case) : null;
    } catch {
      return null;
    }
  },
  save(c: Case | null) {
    if (typeof window === "undefined") return;
    try {
      if (c) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(c));
      else window.localStorage.removeItem(LOCAL_KEY);
    } catch {}
  },
  clear() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {}
  },
};
