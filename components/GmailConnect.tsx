"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { connectGmail, disconnectGmail, useGmail } from "@/lib/google";
import { useAppConfig } from "./Providers";

/** Google's standard colour "G", as required by the Sign in with Google branding guidelines. Never recoloured or stretched. */
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Sign in with Google so requests go out from her own Gmail and replies can be read. */
export function GmailConnect({ onConnected, compact = false }: { onConnected?: (email: string) => void; compact?: boolean }) {
  const { googleClientId } = useAppConfig();
  const session = useGmail();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!googleClientId) return null;

  if (session) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-[#0E1116]">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#E7F6EC] text-[#166534]">
          <Check size={13} strokeWidth={2.5} />
        </span>
        <span>
          Sending from <span className="font-semibold">{session.email}</span>
        </span>
        {!compact && (
          <button onClick={disconnectGmail} className="text-xs font-semibold text-[#6B7280] underline underline-offset-2 hover:text-[#0E1116]">
            Disconnect
          </button>
        )}
      </p>
    );
  }
  return (
    <div>
      {/* Light-theme Google button: white fill, 1px #747775 inside stroke, #1F1F1F 14px medium text,
          12px before the logo, 10px after it, 12px after the text, pill shape. */}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const s = await connectGmail(googleClientId);
            onConnected?.(s.email);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't connect to Gmail.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex h-10 items-center gap-[10px] rounded-full bg-white pl-3 pr-3 text-sm font-medium text-[#1F1F1F] ring-1 ring-inset ring-[#747775] transition hover:bg-[#F7F8F9] hover:shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        <GoogleG /> {busy ? "Connecting…" : "Send from my Gmail"}
      </button>
      {!compact && <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">Requests go out from your Gmail; Reclaim reads the platforms’ replies. Your sign-in stays in this tab.</p>}
      {error && <p className="mt-2 text-xs text-[#B3130F]">{error}</p>}
    </div>
  );
}
