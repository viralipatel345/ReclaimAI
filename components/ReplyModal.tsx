"use client";
import { useState } from "react";
import { applyReply } from "@/lib/escalation";
import type { ParsedReply } from "@/lib/followups";
import { postJson } from "@/lib/api";
import { classifyReplyByRules } from "@/lib/replyRules";
import { updateCase } from "@/lib/useCase";
import type { ReplyStatus, TakedownRequest } from "@/lib/types";
import { Icon } from "./Icon";
import { btnPrimary, btnSecondary, Modal, StatusPill } from "./ui";

const LABEL: Record<ReplyStatus, string> = { acknowledged: "Acknowledged", removed: "Removed", rejected: "Rejected", unclear: "Not clear" };
const PILL = { acknowledged: "acknowledged", removed: "removed", rejected: "rejected", unclear: "unclear" } as const;

/** parse_reply: paste a platform's email, Gemini classifies it, the user confirms. */
export function ReplyModal({ r, onClose }: { r: TakedownRequest; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParsedReply | null>(null);
  const [choice, setChoice] = useState<ReplyStatus | null>(null);

  const classify = async () => {
    setBusy(true);
    // Server unreachable: the same keyword rules the server falls back to.
    const out = (await postJson<ParsedReply>("/api/parse-reply", { text, platformName: r.platformName })) ?? { ...classifyReplyByRules(text), source: "rules" as const };
    setResult(out);
    setChoice(out.status === "unclear" ? null : out.status);
    setBusy(false);
  };

  const save = () => {
    if (!result || !choice) return;
    updateCase((c) => applyReply(c, r.id, { status: choice, summary: result.summary }, new Date().toISOString()));
    onClose();
  };

  return (
    <Modal
      title={`Reply from ${r.platformName}`}
      onClose={onClose}
      footer={
        result ? (
          <>
            <button onClick={() => setResult(null)} className={btnSecondary}>Back</button>
            <button onClick={save} disabled={!choice} className={`${btnPrimary} h-10 px-5 text-sm`}>Save</button>
          </>
        ) : (
          <button onClick={classify} disabled={busy || text.trim().length < 10} className={`${btnPrimary} h-10 px-5 text-sm`}>
            {busy ? "Reading…" : "Read reply"}
          </button>
        )
      }
    >
      {!result ? (
        <>
          <label htmlFor="reply" className="text-sm font-medium">Paste the platform’s email</label>
          <textarea id="reply" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="mt-2 w-full rounded-xl border border-line p-3 text-[14px] leading-relaxed focus:border-accent focus:outline-none" placeholder="Thanks for your report…" />
          <p className="mt-2 text-xs text-muted">Gemini reads it to tell whether they removed it. The text isn’t stored — only the outcome.</p>
        </>
      ) : (
        <div className="space-y-4">
          {result.asksForImages && (
            <p className="flex gap-2 rounded-xl bg-overdue-soft p-4 text-sm text-overdue">
              <Icon name="alert" size={18} />
              <span><strong>Don’t send any images.</strong> A valid request only needs the links. If a platform insists, that’s worth noting in an FTC complaint.</span>
            </p>
          )}
          <div className="rounded-xl bg-ground p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">What they said</span>
              <StatusPill status={PILL[result.status]} />
            </div>
            <p className="mt-2 text-[15px] leading-relaxed">{result.summary}</p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{result.status === "unclear" ? "We couldn’t tell. What did they decide?" : "Is that right?"}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["acknowledged", "removed", "rejected"] as ReplyStatus[]).map((s) => (
                <button key={s} onClick={() => setChoice(s)} className={`rounded-full border px-3.5 py-1.5 text-sm ${choice === s ? "border-accent bg-accent-soft font-medium text-accent" : "border-line"}`}>
                  {LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>
          {choice === "removed" && <p className="text-xs text-muted">Reclaim will still re-check the link to confirm it’s really gone.</p>}
        </div>
      )}
    </Modal>
  );
}
