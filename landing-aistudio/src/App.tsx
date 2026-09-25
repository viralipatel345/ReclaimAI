import React, { useEffect } from 'react';
import { Landing } from './landing/Landing';

// Quick exit: close this tab. Browsers only let a page close tabs it opened itself,
// so when close is blocked we swap the tab to a neutral page with replace(),
// which also removes Reclaim from the back button.
const NEUTRAL = 'https://www.google.com/search?q=weather';

function quickExit() {
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  window.close();
  window.location.replace(NEUTRAL);
}

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') quickExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return <Landing onQuickExit={quickExit} />;
}
