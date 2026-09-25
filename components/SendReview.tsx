"use client";
import { useState } from "react";
import { markSent } from "@/lib/caseOps";
import { prepareSubmission } from "@/lib/submission";
import { updateCase } from "@/lib/useCase";
import { useGmail } from "@/lib/google";
import { sendViaGmail } from "@/lib/gmailAgent";
import { recipientFor } from "@/lib/gmailOps";
import { useAppConfig } from "./Providers";
import type { Case, TakedownRequest } from "@/lib/types";
import { Icon } from "./Icon";
import { SubmissionPanel } from "./Submission";
import { btnPrimary, btnSecondary, ChannelTag, Modal } from "./ui";

/** "Review each before sending": step through requests one at a time. */
export function SendReview({ c, queue, demo, onDone }: { c: Case; queue: TakedownRequest[]; demo: boolean; onDone: (sent: number) => void }) {
  const [i, setI] = useState(0);
  const [sent, setSent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gmail = useGmail();
  const { testPlatformInbox } = useAppConfig();
  const r = queue[i];
  const rcpt = r ? recipientFor(r, testPlatformInbox) : null;
  const next = (didSend: boolean) => {
    const total = sent + (didSend ? 1 : 0);
    setSent(total);
    if (i + 1 >= queue.length) onDone(total);
    else setI(i + 1);
  };
  if (!r) return null;

  return (
    <Modal
      title={`Send to ${r.platformName}`}
      onClose={() => onDone(sent)}
      footer={
        <>
          <button onClick={() => next(false)} className={btnSecondary}>Skip for now</button>
          {gmail && rcpt && !demo && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const out = await sendViaGmail([r], testPlatformInbox);
                setBusy(false);
                if (out.sent.length) next(true);
                else setError("Gmail couldn’t send this one. Try again, or send it yourself.");
              }}
              className={`${btnPrimary} h-10 px-5 text-sm`}
            >
              <Icon name="mail" size={15} /> {busy ? "Sending…" : rcpt.standIn ? "Send to test inbox" : "Send from Gmail"}
            </button>
          )}
          <button
            disabled={!r.channel}
            onClick={() => {
              updateCase((x) => markSent(x, [r.id], new Date().toISOString(), demo));
              next(true);
            }}
            className={`${btnPrimary} h-10 px-5 text-sm`}
          >
            <Icon name={demo ? "send" : "check"} size={15} /> {demo ? "Send (demo)" : "I’ve sent it — start the clock"}
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs text-muted">
          {i + 1} of {queue.length}
        </span>
        <ChannelTag channel={r.channel} />
      </div>
      {error && <p className="mb-3 text-sm text-overdue">{error}</p>}
      {gmail && rcpt?.standIn && (
        <p className="mb-3 rounded-xl bg-accent-soft p-3 text-xs text-accent">Sends from {gmail.email} to {rcpt.to}, the test inbox standing in for {r.platformName}.</p>
      )}
      <SubmissionPanel s={prepareSubmission(c, r)} />
      {!demo && <p className="mt-4 text-xs text-muted">The 48-hour clock starts when you confirm it’s sent.</p>}
    </Modal>
  );
}
