"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { card } from "@/components/ui";

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

  return (
    <div className={`${card} mt-4 p-4`}>
      <div className="flex items-center gap-2">
        <Icon name="shield" size={16} />
        <h3 className="text-sm font-semibold">Verify your identity</h3>
        <span className="ml-auto rounded-full bg-ground px-2 py-0.5 font-mono text-xs text-muted">
          prevents fraud
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
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
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="share" size={16} className="-rotate-180" /> Upload ID document
        </button>
      )}

      {status === "loading" && (
        <div className="mt-3 flex items-center justify-center gap-2 py-3 text-sm text-muted">
          <Icon name="sparkle" size={16} className="animate-pulse" />
          Verifying with Document AI…
        </div>
      )}

      {status === "done" && result && (
        <div
          className={`mt-3 rounded-xl p-3 text-sm ${
            result.verdict === "PASS"
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Icon name={result.verdict === "PASS" ? "shield-check" : "alert"} size={16} />
            {result.verdict === "PASS" ? "Identity verified" : "Verification failed"}
          </div>
          <p className="mt-1 text-xs opacity-80">{result.reason}</p>
          {result.verdict === "FAIL" && (
            <button
              onClick={reset}
              className="mt-2 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            >
              Try again with a different photo
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-overdue">{error}</p>}
    </div>
  );
}
