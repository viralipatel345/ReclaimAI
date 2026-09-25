import React from 'react';

interface FooterProps {
  onOpenSafetyProtocols: () => void;
  onOpenEvidenceGuide: () => void;
  onOpenLegalLandscape: () => void;
  onOpenDataPledge: () => void;
  onBurnSession: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenSafetyProtocols,
  onOpenEvidenceGuide,
  onOpenLegalLandscape,
  onOpenDataPledge,
  onBurnSession,
}) => {
  return (
    <footer className="w-full bg-surface-container-low mt-space-xl border-t border-outline-variant/20">
      <div className="max-w-[1440px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop pt-space-xl pb-space-lg">
        {/* Top 3 Assurance Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg pb-space-lg border-b border-outline-variant/30">
          <div className="flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
              verified_user
            </span>
            <div>
              <h4 className="font-label-md text-label-md text-on-surface font-semibold">
                You approve everything
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Nothing posts, files, or sends without your explicit consent.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
              visibility_off
            </span>
            <div>
              <h4 className="font-label-md text-label-md text-on-surface font-semibold">
                Links only
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                We never request, store, or view your private media.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
              exit_to_app
            </span>
            <div>
              <h4 className="font-label-md text-label-md text-on-surface font-semibold">
                Leave in one tap
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Press Esc anywhere or click quick exit to mask this tab immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Central Helpline Callout */}
        <div className="py-space-xl text-center">
          <p className="font-headline-lg text-headline-lg md:text-display font-display text-on-surface italic max-w-2xl mx-auto font-serif">
            Your image. Your name. Your call.
          </p>

          <div className="mt-space-md inline-flex items-center gap-space-xs px-4 py-2 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md border border-outline-variant/20 shadow-e1">
            <span className="material-symbols-outlined text-primary text-[18px]">support_agent</span>
            <span>24/7 Cyber Civil Rights Crisis Helpline:</span>
            <a
              className="font-semibold text-primary hover:underline ml-1"
              href="tel:8448782274"
            >
              1-844-878-CCRI (2274)
            </a>
          </div>
        </div>

        {/* Bottom Legal, Nav & Session Clean Links */}
        <div className="pt-space-md flex flex-col md:flex-row items-center justify-between gap-space-sm border-t border-outline-variant/20 font-body-sm text-body-sm text-on-surface-variant">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface lowercase font-serif font-bold">
              reclaim
            </span>
            <span>© 2025. All dignity reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-space-md font-label-md text-label-md">
            <button
              onClick={onOpenSafetyProtocols}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              Safety protocols
            </button>
            <button
              onClick={onOpenEvidenceGuide}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              Evidence guide
            </button>
            <button
              onClick={onOpenLegalLandscape}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              Legal landscape
            </button>
            <button
              onClick={onOpenDataPledge}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              Data pledge
            </button>
            <button
              onClick={onBurnSession}
              title="Purge all active chat messages and session traces"
              className="text-primary hover:text-primary-container transition-colors cursor-pointer flex items-center gap-1 font-semibold ml-2"
            >
              <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
              <span>Burn session</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
