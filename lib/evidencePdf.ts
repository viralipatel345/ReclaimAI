"use client";
// Evidence PDF: text only — URLs, timestamps, fingerprints. Never image data.
import type { Case } from "./types";

export async function downloadEvidencePdf(c: Case) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 48;
  let y = 60;
  const line = (text: string, size = 10, style: "normal" | "bold" = "normal", font = "helvetica") => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, 516) as string[];
    for (const w of wrapped) {
      if (y > 740) {
        doc.addPage();
        y = 60;
      }
      doc.text(w, left, y);
      y += size + 4;
    }
  };

  line("Reclaim — Evidence log", 18, "bold");
  if (c.isDemo) line("EXAMPLE CASE · FICTIONAL. All names, accounts and links are invented.", 9, "bold");
  line(`Case: ${c.id}    Name: ${c.legalName}    Generated: ${new Date().toISOString()}`, 9);
  line("This log contains no images. Each fingerprint is SHA-256(url + page title), recorded at the time of each event.", 9);
  y += 10;

  for (const e of c.evidence) {
    line(`${e.platformName} — ${e.event.toUpperCase()}`, 11, "bold");
    line(`URL: ${e.url}`, 9, "normal", "courier");
    line(`Event at: ${e.at}    First seen: ${e.firstSeenAt}${e.sentAt ? `    Sent: ${e.sentAt}` : ""}`, 9, "normal", "courier");
    line(`Page title: ${e.pageTitle}`, 9, "normal", "courier");
    line(`Fingerprint: ${e.fingerprint}`, 9, "normal", "courier");
    if (e.note) line(`Note: ${e.note}`, 9);
    y += 8;
  }
  y += 6;
  line("Not legal advice — Reclaim prepares requests you send.", 8);
  doc.save(`reclaim-evidence-${c.id}.pdf`);
}
