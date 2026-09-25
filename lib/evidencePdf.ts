// Evidence PDF: text only — URLs, timestamps, fingerprints, request history.
// Never image data: the document is built exclusively from text calls.
import type { jsPDF as JsPDF } from "jspdf";
import { displayStatus } from "./caseOps";
import type { Case } from "./types";

const STATUS_LABEL = {
  draft: "Not sent",
  ready: "Not sent",
  in_progress: "Awaiting removal",
  acknowledged: "Acknowledged",
  removed: "Removed",
  overdue: "OVERDUE — deadline missed",
  rejected: "Rejected",
  unclear: "Needs review",
} as const;

export function buildEvidencePdf(c: Case, JsPDFCtor: typeof JsPDF, now: number = Date.now()): JsPDF {
  const doc = new JsPDFCtor({ unit: "pt", format: "letter" });
  const left = 48;
  let y = 60;
  const line = (text: string, size = 10, style: "normal" | "bold" = "normal", font = "helvetica") => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    for (const w of doc.splitTextToSize(text, 516) as string[]) {
      if (y > 740) {
        doc.addPage();
        y = 60;
      }
      doc.text(w, left, y);
      y += size + 4;
    }
  };
  const gap = (n = 8) => (y += n);

  line("Reclaim — Evidence log", 18, "bold");
  if (c.isDemo) line("EXAMPLE CASE · FICTIONAL. All names, accounts and links are invented.", 9, "bold");
  line(`Case: ${c.id}    Name: ${c.legalName}    Contact: ${c.contactEmail}`, 9);
  line(`Generated: ${new Date(now).toISOString()}`, 9);
  line("This log contains no images. Each fingerprint is SHA-256(url + page title), recorded at the time of each event.", 9);
  gap(10);

  line("Removal requests", 13, "bold");
  for (const r of c.requests) {
    line(`${r.platformName} — ${STATUS_LABEL[displayStatus(r, now)]}`, 11, "bold");
    line(`Channel: ${r.channel ?? "unconfirmed"} ${r.target ?? ""}`, 9, "normal", "courier");
    line(`Sent: ${r.sentAt ?? "—"}    48h deadline: ${r.deadlineAt ?? "—"}`, 9, "normal", "courier");
    if (r.acknowledgedAt) line(`Acknowledged: ${r.acknowledgedAt}`, 9, "normal", "courier");
    if (r.removedAt) line(`Removed: ${r.removedAt}`, 9, "normal", "courier");
    if (r.remindersDrafted.length) line(`Reminders: ${r.remindersDrafted.map((h) => `${h}h`).join(", ")}`, 9, "normal", "courier");
    if (r.simulated) line("Demo: simulated, not actually sent.", 9);
    gap(4);
  }
  gap(8);

  line("Evidence entries", 13, "bold");
  for (const e of c.evidence) {
    line(`${e.platformName} — ${e.event.toUpperCase()}`, 11, "bold");
    line(`URL: ${e.url}`, 9, "normal", "courier");
    line(`Event at: ${e.at}    First seen: ${e.firstSeenAt}${e.sentAt ? `    Sent: ${e.sentAt}` : ""}`, 9, "normal", "courier");
    line(`Page title: ${e.pageTitle}`, 9, "normal", "courier");
    line(`Fingerprint: ${e.fingerprint}`, 9, "normal", "courier");
    if (e.note) line(`Note: ${e.note}`, 9);
    gap(4);
  }
  gap(6);
  line("Not legal advice — Reclaim prepares requests you send.", 8);
  return doc;
}

export async function downloadEvidencePdf(c: Case) {
  const { jsPDF } = await import("jspdf");
  buildEvidencePdf(c, jsPDF).save(`reclaim-evidence-${c.id}.pdf`);
}
