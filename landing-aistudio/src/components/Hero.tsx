import React from 'react';
import { motion } from 'motion/react';
import { ChatConsole } from './ChatConsole';
import { ChatMessage, CaseItem } from '../types';

interface HeroProps {
  onStartChat: () => void;
  onOpenStatuteModal: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onReportAll: () => void;
  onOpenHelpline: () => void;
  onOpenAllyGuide: () => void;
  onViewCaseTracker: () => void;
  cases: CaseItem[];
}

export const Hero: React.FC<HeroProps> = ({
  onStartChat,
  onOpenStatuteModal,
  messages,
  onSendMessage,
  onReportAll,
  onOpenHelpline,
  onOpenAllyGuide,
  onViewCaseTracker,
  cases,
}) => {
  return (
    <div id="how-it-works" className="relative w-full overflow-hidden">
      {/* Top Ambient Glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[920px] h-[480px] bg-gradient-to-b from-primary/10 via-secondary-container/20 to-transparent blur-3xl pointer-events-none rounded-full"></div>

      {/* HERO SECTION */}
      <section className="relative w-full max-w-[1440px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop pt-8 md:pt-14 pb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg lg:gap-gutter-desktop items-start">
          {/* Left Column: Editorial Manifesto & Call to Action (7 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
            className="lg:col-span-7 flex flex-col justify-center"
          >
            {/* Legislative Tag Badge */}
            <button
              onClick={onOpenStatuteModal}
              className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-surface-container-low/90 shadow-e1 text-on-surface mb-6 border border-outline-variant/30 hover:border-primary/40 transition-colors cursor-pointer group text-left"
              title="Click to view legal protections under the U.S. TAKE IT DOWN Act"
            >
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary">
                Federal Enforcement
              </span>
              <span className="text-outline text-xs">/</span>
              <span className="font-label-md text-label-md text-on-surface font-medium group-hover:text-primary transition-colors flex items-center gap-1">
                U.S. TAKE IT DOWN Act
                <span className="material-symbols-outlined text-[14px] opacity-70">info</span>
              </span>
            </button>

            {/* Hero Headline */}
            <h1 className="font-display text-headline-lg md:text-display text-on-surface tracking-tight leading-[1.08] max-w-2xl font-serif">
              Tell us what happened. <br className="hidden sm:inline" />
              <span className="font-display italic text-primary-container font-serif">
                We’ll find it
              </span>{' '}
              and take it down.
            </h1>

            {/* Plainspoken Subtext */}
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-6 max-w-xl leading-relaxed">
              Text Reclaim like you’d text a trusted friend. Our agents search the web for your
              image, outline the single right step for each platform, and enforce the statutory
              48-hour deadline.
            </p>

            {/* Stat Cards Duo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm mt-8 max-w-xl">
              <div className="p-space-md rounded-xl bg-surface-container-lowest/80 backdrop-blur-md shadow-e1 border border-outline-variant/20 hover:border-outline-variant/50 lift">
                <div className="font-display text-headline-lg text-primary-container leading-none font-serif">
                  48 hours
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                  What online platforms now have by federal law to remove nonconsensual intimate
                  imagery.
                </p>
              </div>

              <div className="p-space-md rounded-xl bg-surface-container-lowest/80 backdrop-blur-md shadow-e1 border border-outline-variant/20 hover:border-outline-variant/50 lift">
                <div className="font-display text-headline-lg text-on-surface leading-none font-serif">
                  Only 4%
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                  Of people who called a helpline about image abuse also went to police. We make
                  reporting feel possible.
                </p>
              </div>
            </div>

            {/* Action Stack */}
            <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-space-md">
              <button
                onClick={onStartChat}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl bg-primary-container text-on-primary font-label-md text-body-md hover:bg-primary transition-all duration-200 shadow-e2 group cursor-pointer"
              >
                <span>Start a confidential chat</span>
                <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>

              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  enhanced_encryption
                </span>
                <span className="font-body-sm text-body-sm font-medium">
                  Links only. We never inspect your private files.
                </span>
              </div>
            </div>

            {/* Editorial Credibility Bar */}
            <div className="mt-12 pt-6 max-w-xl flex flex-wrap items-center justify-between gap-4 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider border-t border-outline-variant/20">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> 100% Survivor
                Controlled
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Zero Media Ingestion
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> No Retainer Fees
              </span>
            </div>
          </motion.div>

          {/* Right Column: Realistic Desktop iMessage-Style Interaction (5 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
            className="lg:col-span-5 relative mt-6 lg:mt-0"
          >
            <ChatConsole
              messages={messages}
              onSendMessage={onSendMessage}
              onReportAll={onReportAll}
              onOpenHelpline={onOpenHelpline}
              onOpenAllyGuide={onOpenAllyGuide}
              onViewCaseTracker={onViewCaseTracker}
              cases={cases}
            />
          </motion.div>
        </div>
      </section>
    </div>
  );
};
