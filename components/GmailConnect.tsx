"use client";
import { useState } from "react";
import { connectGmail, disconnectGmail, useGmail } from "@/lib/google";
import { Icon } from "./Icon";
import { useAppConfig } from "./Providers";
import { btnSecondary } from "./ui";

/** Sign in with Google so requests go out from her own Gmail and replies can be read. */
export function GmailConnect({ onConnected, compact = false }: { onConnected?: (email: string) => void; compact?: boolean }) {
  const { googleClientId } = useAppConfig();
  const session = useGmail();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!googleClientId) return null;

  if (session) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Icon name="check" size={15} className="text-removed" strokeWidth={2.25} />
        <span>
          Sending from <span className="font-medium">{session.email}</span>
        </span>
        {!compact && (
          <button onClick={disconnectGmail} className="text-xs text-muted underline decoration-line underline-offset-2 hover:text-ink">
            Disconnect
          </button>
        )}
      </p>
    );
  }
  return (
    <div>
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
        className={`${btnSecondary} border-accent text-accent`}
      >
        <Icon name="mail" size={15} /> {busy ? "Connecting…" : "Send from my Gmail"}
      </button>
      {!compact && <p className="mt-1.5 text-xs text-muted">Requests go out from your Gmail; Reclaim reads the platforms’ replies. Your sign-in stays in this tab.</p>}
      {error && <p className="mt-1.5 text-xs text-overdue">{error}</p>}
    </div>
  );
}
