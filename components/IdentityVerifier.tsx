"use client";
import { useRef, useState } from "react";
import { AlertTriangle, ShieldCheck, Sparkles, Upload } from "lucide-react";

type VerifyResult = {
  verdict: "PASS" | "FAIL";
  reason: string;
  extractedName: string;
  matchScore: number;
  fraudFlags: string[];
};

export function IdentityVerifier({
  claimedName,
  onVerified,
}: {
  claimedName: string;
  onVerified: (passed: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus]   = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult]   = useState<VerifyResult | null>(null);
  const [error,  setError]    = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onVerified(false);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!claimedName.trim()) {
      setError("Enter your full name above before uploading your ID.");
      return;
    }

    setStatus("loading");
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("name", claimedName.trim());

    try {
      const res  = await fetch("/api/verify-identity", { method: "POST", body: form });
      const data = await res.json() as VerifyResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setResult(data);
      setStatus("done");
      onVerified(data.verdict === "PASS");
    } catch (err) {
      setError(String(err));
      setStatus("idle");
      onVerified(false);
    }
  };

  const passed = result?.verdict === "PASS";

  return (
    <div className="mt-5 rounded-3xl bg-[#F5F6F8] p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#E1261C]">
          <ShieldCheck size={17} />
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-[15px] font-bold text-[#0E1116]">Verify your identity</h3>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">prevents fraud</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">
        Upload a government-issued ID to confirm you are the person in the content.
        Passports, driver&apos;s licenses, and residency cards accepted.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="sr-only"
        onChange={onFileChange}
      />

      {status === "idle" && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={!claimedName.trim()}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-white text-sm font-semibold text-[#4B5563] transition hover:border-[#E1261C] hover:text-[#B3130F] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Upload size={16} /> Upload ID document
        </button>
      )}

      {status === "loading" && (
        <div className="mt-4 flex h-12 items-center justify-center gap-2 text-sm font-medium text-[#6B7280]">
          <Sparkles size={16} className="animate-pulse text-[#E1261C]" />
          Verifying with Document AI…
        </div>
      )}

      {status === "done" && result && (
        <div className={`mt-4 rounded-2xl p-4 text-sm ${passed ? "bg-[#E7F6EC] text-[#166534]" : "bg-[#FDECEA] text-[#B3130F]"}`}>
          <div className="flex items-center gap-2 font-bold">
            {passed ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
            {passed ? "Identity verified" : "Verification failed"}
          </div>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{result.reason}</p>
          {!passed && (
            <button
              onClick={reset}
              className="mt-2 text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              Try again with a different photo
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[#B3130F]">{error}</p>}
    </div>
  );
}
