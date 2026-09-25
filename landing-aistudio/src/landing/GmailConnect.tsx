import { useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { connectGmail, disconnectGmail, useGmail } from '../lib/google';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';

/** Real "Sign in with Google" (lib/google.ts), branded. Hidden with no client ID configured,
 * same as the real app (components/GmailConnect.tsx). */
export function GmailConnect({ onConnected }: { onConnected?: (email: string) => void }) {
  const session = useGmail();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!GOOGLE_CLIENT_ID) return null;

  if (session) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Check size={15} className="text-[#166534]" strokeWidth={2.5} />
        Sending from <span className="font-semibold">{session.email}</span>
        <button onClick={disconnectGmail} className="text-xs text-[#6B7280] underline hover:text-[#0E1116]">Disconnect</button>
      </p>
    );
  }
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true); setError(null);
          try { const s = await connectGmail(GOOGLE_CLIENT_ID); onConnected?.(s.email); }
          catch (e) { setError(e instanceof Error ? e.message : "Couldn't connect to Gmail."); }
          finally { setBusy(false); }
        }}
        className="inline-flex items-center gap-2 rounded-full border border-[#E1261C] px-4 py-2 text-sm font-semibold text-[#E1261C] hover:bg-[#FDECEA]"
      >
        <Mail size={15} /> {busy ? 'Connecting…' : 'Sign in with Google'}
      </button>
      <p className="mt-1.5 text-xs text-[#6B7280]">Requests go out from your Gmail. Your sign-in stays in this tab.</p>
      {error && <p className="mt-1.5 text-xs text-[#B3130F]">{error}</p>}
    </div>
  );
}
