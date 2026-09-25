"use client";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { btnPrimary, card } from "@/components/ui";
import { NCMEC_TAKE_IT_DOWN_URL } from "@/lib/config";
import { localMirror } from "@/lib/store";

export default function UnderEighteen() {
  // Hard rule: store nothing for under-18 users.
  useEffect(() => localMirror.clear(), []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">
      <div className={`${card} p-6 md:p-10`}>
        <Icon name="heart" size={26} className="text-accent" />
        <h1 className="mt-5 font-display text-display-m font-semibold leading-tight md:text-display-l">There’s a service built just for you.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          <strong className="text-ink">Take It Down</strong>, from the National Center for Missing &amp; Exploited Children (NCMEC), helps remove nude or sexual images taken of you before you were 18 — without you having to send the images to anyone.
        </p>
        <a href={NCMEC_TAKE_IT_DOWN_URL} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} mt-8 w-full sm:w-auto`}>
          Go to Take It Down <Icon name="external" size={16} />
        </a>
        <div className="mt-8 space-y-3 border-t border-line pt-6 text-sm leading-relaxed text-muted">
          <p>You haven’t done anything wrong, and you don’t have to handle this alone. A trusted adult, school counselor, or NCMEC (1-800-843-5678) can help.</p>
          <p>If you’re in danger right now, call 911.</p>
          <p className="flex items-center gap-2 text-ink">
            <Icon name="shield-check" size={16} className="text-removed" /> Reclaim hasn’t saved anything you entered.
          </p>
        </div>
      </div>
    </div>
  );
}
