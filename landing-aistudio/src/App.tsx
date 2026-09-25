import React, { useEffect, useState } from 'react';
import { Landing } from './landing/Landing';
import { StealthCloak } from './components/StealthCloak';

// Quick exit: Esc (or the header button) swaps the page for a neutral news page instantly.
export default function App() {
  const [stealth, setStealth] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStealth(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      {stealth && <StealthCloak onDeactivate={() => setStealth(false)} />}
      <Landing onQuickExit={() => setStealth(true)} />
    </>
  );
}
