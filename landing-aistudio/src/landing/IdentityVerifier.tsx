import { useRef, useState } from 'react';
import { AlertCircle, Camera, ShieldCheck, Sparkles } from 'lucide-react';

type VerifyResult = { verdict: 'PASS' | 'FAIL'; reason: string; extractedName: string; matchScore: number; fraudFlags: string[] };

// Calls the real /api/verify-identity route (Document AI ID-proofing) on the deployed
// Next.js app. This is a separate static site, so it needs that app's URL configured.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || (import.meta.env.VITE_APP_URL as string | undefined) || '';

/** Real identity check (app/api/verify-identity), branded and reframed as protection.
 * The requirement never changes: a name and a government ID. The ID is read once for the
 * name, compared, and not kept, which is exactly what the route does. */
export function IdentityVerifier({ claimedName, onVerified }: { claimedName: string; onVerified: (passed: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!claimedName.trim()) { setError('Add your name first, so we know what to match.'); return; }
    if (!API_BASE) { setError('This preview isn’t connected to the app yet, so the check can’t run here. Your photo was not sent anywhere.'); e.target.value = ''; return; }
    setStatus('loading'); setResult(null); setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('name', claimedName.trim());
    try {
      const res = await fetch(`${API_BASE}/api/verify-identity`, { method: 'POST', body: form });
      const data = (await res.json()) as VerifyResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'That didn’t work. Try a clearer photo.');
      setResult(data); setStatus('done'); onVerified(data.verdict === 'PASS');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err)); setStatus('idle'); onVerified(false);
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={onFileChange} />
      {status === 'idle' && (
        <button onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E1261C] px-6 py-4 font-semibold text-white hover:bg-[#B3130F]">
          <Camera size={18} /> Take or upload a photo of your ID
        </button>
      )}
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#F5F6F8] py-4 text-sm text-[#4B5563]"><Sparkles size={16} className="animate-pulse text-[#E1261C]" /> Reading the name on it&hellip;</div>
      )}
      {status === 'done' && result && (
        <div className={`rounded-2xl p-4 text-sm ${result.verdict === 'PASS' ? 'bg-[#E7F6EC] text-[#166534]' : 'bg-[#FDECEA] text-[#B3130F]'}`}>
          <div className="flex items-center gap-2 font-semibold">{result.verdict === 'PASS' ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}{result.verdict === 'PASS' ? 'That’s you. Thank you.' : 'We couldn’t match that one.'}</div>
          <p className="mt-1 text-xs opacity-85">{result.verdict === 'PASS' ? 'The photo has already been discarded.' : result.reason}</p>
          {result.verdict === 'FAIL' && <button onClick={() => { setStatus('idle'); setResult(null); onVerified(false); }} className="mt-2 text-xs underline">Try another photo</button>}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-[#B3130F]">{error}</p>}
    </div>
  );
}
