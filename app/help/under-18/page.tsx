"use client";
import { useEffect } from "react";
import { ExternalLink, Heart, ShieldCheck } from "lucide-react";
import { display, panel, pillPrimary } from "@/components/brand";
import { NCMEC_TAKE_IT_DOWN_URL } from "@/lib/config";
import { localMirror } from "@/lib/store";

export default function UnderEighteen() {
  // Hard rule: store nothing for under-18 users.
  useEffect(() => localMirror.clear(), []);

  return (
    <div className="relative overflow-hidden text-[#0E1116]">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(225,38,28,0.12),transparent)]" />
      <div className="relative mx-auto max-w-[720px] px-5 py-12 md:px-8 md:py-20">
        <div className={`${panel} p-7 md:p-10`}>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FDECEA] text-[#E1261C]">
            <Heart size={22} />
          </span>
          <h1 className={`${display} mt-6 text-[40px] leading-[0.98] md:text-[56px]`}>There’s a service built just for you.</h1>
          <p className="mt-5 text-lg leading-relaxed text-[#4B5563]">
            <strong className="font-semibold text-[#0E1116]">Take It Down</strong>, from the National Center for Missing &amp; Exploited Children (NCMEC), helps remove nude or sexual images taken of you before you were 18, without you having to send the images to anyone.
          </p>
          <a href={NCMEC_TAKE_IT_DOWN_URL} target="_blank" rel="noopener noreferrer" className={`${pillPrimary} mt-8 w-full sm:w-auto`}>
            Go to Take It Down <ExternalLink size={16} />
          </a>
          <div className="mt-8 space-y-3 border-t border-[#E5E7EB] pt-6 text-sm leading-relaxed text-[#6B7280]">
            <p>You haven’t done anything wrong, and you don’t have to handle this alone. A trusted adult, school counselor, or NCMEC (1-800-843-5678) can help.</p>
            <p>If you’re in danger right now, call 911.</p>
            <p className="flex items-center gap-2 font-semibold text-[#0E1116]">
              <ShieldCheck size={16} className="shrink-0 text-[#166534]" /> Reclaim hasn’t saved anything you entered.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
