"use client";
// The fixed attestation, a checkbox, and a typed signature. Signing is her reply.
import { useId } from "react";
import { Check } from "lucide-react";
import { ATTESTATION_TEXT } from "@/lib/templates";

export function AttestationCard({
  attested,
  onAttested,
  signature,
  onSignature,
  onSign,
  signed,
}: {
  attested: boolean;
  onAttested: (v: boolean) => void;
  signature: string;
  onSignature: (v: string) => void;
  onSign: () => void;
  signed: boolean;
}) {
  const id = useId();
  const canSign = attested && signature.trim().length >= 2 && !signed;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSign) onSign();
      }}
    >
      <p className="text-[13px] font-semibold text-[#6B7280]">Your statement</p>
      <label htmlFor={`${id}-attest`} className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl bg-[#F5F6F8] p-3">
        <input
          id={`${id}-attest`}
          type="checkbox"
          checked={attested}
          disabled={signed}
          onChange={(e) => onAttested(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#E1261C]"
        />
        <span className="text-[14px] leading-relaxed text-[#0E1116]">{ATTESTATION_TEXT}</span>
      </label>
      <label htmlFor={`${id}-sig`} className="mt-3 block text-[13px] font-semibold text-[#6B7280]">
        Type your name to sign
      </label>
      <input
        id={`${id}-sig`}
        value={signature}
        disabled={signed}
        onChange={(e) => onSignature(e.target.value)}
        autoComplete="off"
        autoCapitalize="words"
        placeholder="Full name"
        className="mt-1.5 h-12 w-full border-0 border-b-2 border-[#0E1116]/80 bg-transparent px-1 text-[22px] italic text-[#0E1116] placeholder:not-italic placeholder:text-[16px] placeholder:text-[#9CA3AF] focus:border-[#E1261C] focus:outline-none disabled:opacity-60"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-[#6B7280]">Electronic signature, {today}</p>
        <button
          type="submit"
          disabled={!canSign}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#E1261C] px-4 text-[14px] font-semibold text-white transition hover:bg-[#B3130F] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {signed ? (
            <>
              <Check size={15} strokeWidth={2.5} /> Signed
            </>
          ) : (
            "Sign"
          )}
        </button>
      </div>
    </form>
  );
}
