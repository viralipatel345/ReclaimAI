import React from 'react';

interface HeaderProps {
  onQuickExit: () => void;
  onStartChat: () => void;
  activeSection?: string;
  onNavigate: (sectionId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onQuickExit,
  onStartChat,
  activeSection,
  onNavigate,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-outline-variant/20">
      <div className="h-20 max-w-[1440px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex items-center justify-between gap-space-md">
        {/* Brand */}
        <div className="flex items-center gap-space-sm">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-space-xs text-on-surface group cursor-pointer focus:outline-none"
          >
            <svg
              className="w-6 h-6 text-primary transition-transform duration-300 group-hover:rotate-45"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="3.5"></circle>
              <path d="M12 2.5v2.5M12 19v2.5M2.5 12h2.5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"></path>
            </svg>
            <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface lowercase pt-0.5 font-display">
              reclaim
            </span>
          </button>
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-label-sm text-label-sm border border-secondary-container">
            Support for survivors
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-space-md xl:gap-space-lg">
          <button
            onClick={() => onNavigate('how-it-works')}
            className={`font-label-md text-label-md transition-colors cursor-pointer ${
              activeSection === 'how-it-works'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            How it works
          </button>
          <button
            onClick={() => onNavigate('our-agents')}
            className={`font-label-md text-label-md transition-colors cursor-pointer ${
              activeSection === 'our-agents'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Our agents
          </button>
          <button
            onClick={() => onNavigate('actions')}
            className={`font-label-md text-label-md transition-colors cursor-pointer ${
              activeSection === 'actions'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Actions
          </button>
          <button
            onClick={() => onNavigate('track-reports')}
            className={`font-label-md text-label-md transition-colors cursor-pointer ${
              activeSection === 'track-reports'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Track reports
          </button>
          <button
            onClick={() => onNavigate('safety-privacy')}
            className={`font-label-md text-label-md transition-colors cursor-pointer ${
              activeSection === 'safety-privacy'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Safety &amp; privacy
          </button>
        </nav>

        {/* Right CTA cluster */}
        <div className="flex items-center gap-space-sm">
          <button
            onClick={onQuickExit}
            title="Press Esc or click to immediately disguise screen"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shadow-[0_1px_4px_rgba(0,0,0,0.03)] transition-all cursor-pointer border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">close</span>
            <span>Quick exit</span>
            <kbd className="hidden sm:inline text-[10px] font-sans opacity-70 bg-surface-container px-1 py-0.5 rounded">
              Esc
            </kbd>
          </button>

          <button
            onClick={onStartChat}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-colors shadow-[0_2px_12px_rgba(110,16,16,0.15)] cursor-pointer"
          >
            Start a chat
          </button>

          <div
            title="Encrypted Anonymous Session"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 cursor-default"
          >
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
