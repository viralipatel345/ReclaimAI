"use client";
import { useState } from "react";
import { markSent } from "@/lib/caseOps";
import { prepareSubmission } from "@/lib/submission";
import { updateCase } from "@/lib/useCase";
import type { Case, TakedownRequest } from "@/lib/types";
import { Icon } from "./Icon";
import { SubmissionPanel } from "./Submission";
import { btnPrimary, btnSecondary, ChannelTag, Modal } from "./ui";

/** "Review each before sending": step through requests one at a time. */
export function SendReview({ c, queue, demo, onDone }: { c: Case; queue: TakedownRequest[]; demo: boolean; onDone: (sent: number) => void }) {
  const [i, setI] = useState(0);
  const [sent, setSent] = useState(0);
  const r = queue[i];
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
      <SubmissionPanel s={prepareSubmission(c, r)} />
      {!demo && <p className="mt-4 text-xs text-muted">The 48-hour clock starts when you confirm it’s sent.</p>}
    </Modal>
  );
}
