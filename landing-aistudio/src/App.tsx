import React, { useEffect, useState } from 'react';
import { Landing } from './landing/Landing';
import { Onboard } from './landing/Onboard';

// Quick exit: close this tab. Browsers only let a page close tabs it opened itself,
// so when close is blocked we swap the tab to a neutral page with replace(),
// which also removes Reclaim from the back button.
const NEUTRAL = 'https://www.google.com/search?q=weather';

function quickExit() {
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  window.close();
  window.location.replace(NEUTRAL);
}

// No router needed for two routes: plain History API, matching how the real
// Next.js app treats "/" (age gate) as a distinct page from the marketing site.
function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export default function App() {
  const path = usePath();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') quickExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (path === '/start') return <Onboard onQuickExit={quickExit} />;
  return <Landing onQuickExit={quickExit} />;
}
