import React from 'react';

interface StealthCloakProps {
  onDeactivate: () => void;
}

export const StealthCloak: React.FC<StealthCloakProps> = ({ onDeactivate }) => {
  return (
    <div className="fixed inset-0 z-[99999] bg-[#f8f9fa] text-[#202124] overflow-y-auto font-sans">
      {/* Neutral disguised news banner */}
      <header className="border-b border-[#dadce0] bg-white sticky top-0 px-6 py-3 flex items-center justify-between shadow-e1">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#1a0dab]">
              The Morning Chronicle
            </span>
            <span className="text-xs uppercase tracking-wider text-[#70757a] bg-[#f1f3f4] px-2 py-0.5 rounded">
              Daily Digest
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-[#5f6368]">
            <span className="hover:text-[#202124] cursor-pointer">Top Stories</span>
            <span className="hover:text-[#202124] cursor-pointer">Local Weather</span>
            <span className="hover:text-[#202124] cursor-pointer">Technology &amp; Science</span>
            <span className="hover:text-[#202124] cursor-pointer">Market Indices</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#5f6368]">Friday, Sep 25 • 68°F Partly Cloudy</span>
          <a
            href="https://www.google.com"
            className="text-xs px-3 py-1.5 rounded bg-[#1a73e8] text-white hover:bg-[#1557b0] transition-colors"
          >
            Leave to Google
          </a>
        </div>
      </header>

      {/* Disguised content feed */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <article className="border-b border-[#e8eaed] pb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1a73e8]">
                Environment
              </span>
              <h2 className="text-2xl font-serif font-bold text-[#202124] mt-1 hover:underline cursor-pointer">
                Meteorologists Predict Mild Autumn Temperatures Across Northern Hemisphere
              </h2>
              <p className="text-sm text-[#4d5156] mt-2 leading-relaxed">
                Atmospheric data collected from international meteorological satellites indicates an
                extended period of moderate temperatures heading into mid-October. Seasonal trends
                remain within historic baseline averages.
              </p>
              <div className="text-xs text-[#70757a] mt-3">Associated Press • 18 min ago</div>
            </article>

            <article className="border-b border-[#e8eaed] pb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1a73e8]">
                Urban Transit
              </span>
              <h2 className="text-xl font-serif font-bold text-[#202124] mt-1 hover:underline cursor-pointer">
                Municipal Transit Board Approves Fleet Upgrades for Regional Rail Lines
              </h2>
              <p className="text-sm text-[#4d5156] mt-2 leading-relaxed">
                A multi-year infrastructure package received unanimous committee approval this
                morning. The upgrades focus on high-efficiency energy regenerative braking systems
                and expanded passenger capacity.
              </p>
              <div className="text-xs text-[#70757a] mt-3">Staff Reporter • 42 min ago</div>
            </article>

            <article className="border-b border-[#e8eaed] pb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1a73e8]">
                Consumer Tech
              </span>
              <h2 className="text-xl font-serif font-bold text-[#202124] mt-1 hover:underline cursor-pointer">
                Battery Longevity Reaches New Benchmark in Standard Mobile Computing
              </h2>
              <p className="text-sm text-[#4d5156] mt-2 leading-relaxed">
                Researchers demonstrate new solid-state electrolyte designs that withstand
                hundreds of fast-charge cycles with nominal capacity degradation.
              </p>
              <div className="text-xs text-[#70757a] mt-3">Tech Journal • 1 hr ago</div>
            </article>
          </div>

          <aside className="space-y-6">
            <div className="p-4 rounded-lg bg-white border border-[#dadce0]">
              <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider">
                Weekend Weather Outlook
              </h3>
              <div className="mt-3 space-y-2 text-xs text-[#3c4043]">
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span>Saturday</span>
                  <span className="font-semibold">71° / 54° Clear</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span>Sunday</span>
                  <span className="font-semibold">69° / 52° Sunny</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Monday</span>
                  <span className="font-semibold">66° / 50° Light Breeze</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#dadce0]">
              <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider">
                Market Summary
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between text-[#137333]">
                  <span className="text-[#3c4043]">S&amp;P 500</span>
                  <span>+0.42%</span>
                </div>
                <div className="flex justify-between text-[#137333]">
                  <span className="text-[#3c4043]">NASDAQ</span>
                  <span>+0.61%</span>
                </div>
                <div className="flex justify-between text-[#c5221f]">
                  <span className="text-[#3c4043]">DOW</span>
                  <span>-0.12%</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Discreet return button for the survivor */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={onDeactivate}
          className="px-3 py-1.5 bg-white/80 hover:bg-white text-[#5f6368] hover:text-[#202124] text-[11px] rounded-full border border-[#dadce0] shadow-e1 backdrop-blur transition-all cursor-pointer flex items-center gap-1.5 opacity-60 hover:opacity-100"
          title="Safe to return to Reclaim"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Safe now? Return to safe window</span>
        </button>
      </div>
    </div>
  );
};
