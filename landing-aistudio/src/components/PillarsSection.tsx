import React from 'react';

interface PillarsSectionProps {
  onStartChat: () => void;
  onSpeakToAdvocate: () => void;
  onQuickExit: () => void;
}

export const PillarsSection: React.FC<PillarsSectionProps> = ({
  onStartChat,
  onSpeakToAdvocate,
  onQuickExit,
}) => {
  return (
    <section id="safety-privacy" className="w-full py-space-xl">
      <div className="max-w-[1440px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        {/* 3 Core Reassurance Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-16">
          <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-e1 border border-outline-variant/20 lift flex items-start gap-4 hover:shadow-e2 transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">thumb_up</span>
            </div>
            <div>
              <h4 className="font-label-md text-body-md font-semibold text-on-surface">
                You approve everything
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Nothing posts, files, or contacts any entity without your conscious, explicit okay.
                You are in command.
              </p>
            </div>
          </div>

          <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-e1 border border-outline-variant/20 lift flex items-start gap-4 hover:shadow-e2 transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">lock_reset</span>
            </div>
            <div>
              <h4 className="font-label-md text-body-md font-semibold text-on-surface">
                Links only
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                We never ask for, view, or retain your intimate media. We enforce removal through URL
                hashes and host data.
              </p>
            </div>
          </div>

          <div
            onClick={onQuickExit}
            className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-e1 border border-outline-variant/20 lift flex items-start gap-4 hover:shadow-e2 transition-shadow cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">door_front</span>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-label-md text-body-md font-semibold text-on-surface group-hover:text-primary transition-colors">
                  Leave in one tap
                </h4>
                <kbd className="text-[10px] font-sans opacity-70 bg-surface-container px-1 py-0.5 rounded border border-outline-variant/30">
                  Esc
                </kbd>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Tap Esc anytime or press Quick Exit to instantly mask this browser tab with a
                neutral news overview.
              </p>
            </div>
          </div>
        </div>

        {/* Closing Callout Box */}
        <div className="relative rounded-3xl bg-surface-container-low p-8 md:p-14 overflow-hidden text-center max-w-4xl mx-auto shadow-e1 border border-outline-variant/20">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[24px]">fingerprint</span>
            </div>

            <h3 className="font-headline-lg text-headline-lg md:text-display text-on-surface font-display italic font-serif">
              Your image. Your name. Your call.
            </h3>

            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mt-4 leading-relaxed">
              Take back control quietly and securely under federal statute. You don’t have to carry
              this by yourself another hour.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-space-sm">
              <button
                onClick={onStartChat}
                className="px-8 py-4 rounded-xl bg-primary-container text-on-primary font-label-md text-body-md hover:bg-primary transition-all duration-200 shadow-e2 cursor-pointer"
              >
                Start a confidential chat
              </button>

              <button
                onClick={onSpeakToAdvocate}
                className="px-6 py-4 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-body-md hover:bg-surface transition-colors shadow-e1 flex items-center gap-2 cursor-pointer border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">
                  phone_in_talk
                </span>
                <span>Speak to an advocate</span>
              </button>
            </div>

            <div className="mt-6 font-label-sm text-label-sm text-on-surface-variant">
              Completely anonymous. No sign-up required to speak.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
