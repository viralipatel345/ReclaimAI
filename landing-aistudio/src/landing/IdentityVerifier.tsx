import { useRef, useState } from 'react';
import { AlertCircle, ShieldCheck, Sparkles, Upload } from 'lucide-react';

type VerifyResult = { verdict: 'PASS' | 'FAIL'; reason: string; extractedName: string; matchScore: number; fraudFlags: string[] };

// Calls the real /api/verify-identity route (Document AI ID-proofing) on the deployed
// Next.js app. This is a separate static site, so it needs that app's URL configured.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || (import.meta.env.VITE_APP_URL as string | undefined) || '';

/** Real identity check (app/api/verify-identity), branded. Requires the deployed app's
 * URL in VITE_API_BASE; the real requirement (a name and a government ID) never changes. */
export function IdentityVerifier({ claimedName, onVerified }: { claimedName: string; onVerified: (passed: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!claimedName.trim()) { setError('Enter your full name above before uploading your ID.'); return; }
    if (!API_BASE) { setError('This preview isn’t connected to the deployed app yet, so verification can’t run here. Set VITE_API_BASE once it’s live.'); return; }
    setStatus('loading'); setResult(null); setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('name', claimedName.trim());
    try {
      const res = await fetch(`${API_BASE}/api/verify-identity`, { method: 'POST', body: form });
      const data = (await res.json()) as VerifyResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Verification failed');
      setResult(data); setStatus('done'); onVerified(data.verdict === 'PASS');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err)); setStatus('idle'); onVerified(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-[#F5F6F8] p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-[#E1261C]" />
        <h3 className="text-sm font-semibold">Verify your identity</h3>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-[#6B7280]">prevents fraud</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[#4B5563]">Upload a government-issued ID to confirm you are the person in the content. Checked with Google Document AI, matched against the name above, and screened for tampering.</p>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={onFileChange} />
      {status === 'idle' && (
        <button onClick={() => inputRef.current?.click()} disabled={!claimedName.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 bg-white py-3 text-sm text-[#4B5563] hover:border-[#E1261C] hover:text-[#E1261C] disabled:cursor-not-allowed disabled:opacity-40">
          <Upload size={15} /> Upload ID document
        </button>
      )}
      {status === 'loading' && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm text-[#4B5563]"><Sparkles size={15} className="animate-pulse text-[#E1261C]" /> Verifying with Document AI…</div>
      )}
      {status === 'done' && result && (
        <div className={`mt-3 rounded-xl p-3 text-sm ${result.verdict === 'PASS' ? 'bg-[#E7F6EC] text-[#166534]' : 'bg-[#FDECEA] text-[#B3130F]'}`}>
          <div className="flex items-center gap-2 font-semibold">{result.verdict === 'PASS' ? <ShieldCheck size={15} /> : <AlertCircle size={15} />}{result.verdict === 'PASS' ? 'Identity verified' : 'Verification failed'}</div>
          <p className="mt-1 text-xs opacity-85">{result.reason}</p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-[#B3130F]">{error}</p>}
    </div>
  );
}
