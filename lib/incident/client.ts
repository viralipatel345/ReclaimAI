// Browser-side calls to /api/incident. In demo mode no session or human token is needed;
// in production attach `Authorization: Bearer <token>` and `x-human-token` via `headers`.
import type { AgentSuggestions, CaseReport, CaseStatus, ParasellEscalation, ReportAction, ReportChannel, Reporter, StatusEvent, VerificationResult } from "./types";

export interface StatusRow {
  id: string;
  title: string;
  branch: CaseReport["branch"];
  status: CaseStatus;
  isDraft: boolean;
  riskLevel: AgentSuggestions["riskLevel"] | null;
  escalation: ParasellEscalation["status"] | null;
  latest: StatusEvent | null;
  updatedAt: string;
}

let extraHeaders: Record<string, string> = {};
export function setIncidentHeaders(h: Record<string, string>) {
  extraHeaders = h;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(`/api/incident${path}`, {
    ...init,
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...extraHeaders, ...(init.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; case?: CaseReport };
  // Parasell returns 502 with the updated case when the upstream rejects; keep that state.
  if (!res.ok && !json.case) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export const incidentApi = {
  createReport: (title: string, notes: string, reporter: Reporter) => post<{ case: CaseReport }>("/report", { title, notes, reporter }),
  discover: (query: string, seedUrls: string[], reporter: Reporter) => post<{ case: CaseReport; decision: "DISCOVER" }>("/discover", { query, seedUrls, reporter }),
  file: (caseId: string, channel: ReportChannel, url?: string) => post<{ case: CaseReport; report: ReportAction }>("/file", { caseId, channel, url }),
  scan(caseId: string, files: File[]) {
    const fd = new FormData();
    fd.set("caseId", caseId);
    for (const f of files) fd.append("files", f);
    return call<{ case: CaseReport; results: VerificationResult[] }>("/scan", { method: "POST", body: fd });
  },
  analyze: (caseId: string) => post<{ case: CaseReport; suggestions: AgentSuggestions }>("/analyze", { caseId }),
  parasell: (caseId: string) => post<{ case: CaseReport; escalation: ParasellEscalation }>("/parasell", { caseId }),
  seal: (draftId: string) => post<{ case: CaseReport; recordHash: string }>("/seal", { draftId }),
  status: () => call<{ cases: StatusRow[] }>("/status"),
  subscribe(onEvent: (evt: StatusEvent) => void): () => void {
    const es = new EventSource("/api/incident/status?stream=1");
    es.addEventListener("status", (e) => onEvent(JSON.parse((e as MessageEvent).data) as StatusEvent));
    return () => es.close();
  },
};
