import React, { useState } from 'react';

interface ActionCardsProps {
  onOpenStatutoryNoticeModal: () => void;
  onOpenPoliceEvidenceModal: () => void;
  onOpenHelplineModal: () => void;
  onOpenDeepfakeRestoreModal: () => void;
}

export const ActionCards: React.FC<ActionCardsProps> = ({
  onOpenStatutoryNoticeModal,
  onOpenPoliceEvidenceModal,
  onOpenHelplineModal,
  onOpenDeepfakeRestoreModal,
}) => {
  return (
    <section id="actions" className="w-full py-space-xl">
      <div className="max-w-[1440px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <div className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-3">
              Clarity Over Chaos
            </div>
            <h2 className="font-headline-lg text-headline-lg md:text-display text-on-surface font-serif">
              One clear next step for every place
            </h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md leading-relaxed">
            No confusing legal menus. You receive one unambiguous recommendation for each link,
            engineered to stop the spread immediately.
          </p>
        </div>

        {/* 4 Prominent Tactile Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {/* Card 1 */}
          <div
            onClick={onOpenStatutoryNoticeModal}
            className="p-space-lg rounded-2xl bg-surface-container-low shadow-e1 border border-outline-variant/20 flex flex-col justify-between hover:bg-surface-container hover:shadow-e2 transition-all cursor-pointer group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary-container mb-6 shadow-e1 border border-outline-variant/15 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px]">
                  quick_reference_all
                </span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-serif group-hover:text-primary transition-colors">
                Report to platform
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-3 leading-relaxed">
                We dispatch an official statutory removal demand under the TAKE IT DOWN Act. Platforms
                face federal liability if content remains up past 48 hours.
              </p>
            </div>
            <div className="mt-8 font-label-md text-label-md text-primary font-semibold flex items-center gap-1">
              <span>Automated filing</span>
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">
                chevron_right
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div
            onClick={onOpenPoliceEvidenceModal}
            className="p-space-lg rounded-2xl bg-surface-container-low shadow-e1 border border-outline-variant/20 flex flex-col justify-between hover:bg-surface-container hover:shadow-e2 transition-all cursor-pointer group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary-container mb-6 shadow-e1 border border-outline-variant/15 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px]">local_police</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-serif group-hover:text-primary transition-colors">
                Report to police
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-3 leading-relaxed">
                We assemble a forensically structured evidence packet with verified cryptographic
                timestamps and origin metadata, ready for your local precinct.
              </p>
            </div>
            <div className="mt-8 font-label-md text-label-md text-primary font-semibold flex items-center gap-1">
              <span>Evidence ready</span>
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">
                chevron_right
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div
            onClick={onOpenHelplineModal}
            className="p-space-lg rounded-2xl bg-surface-container-low shadow-e1 border border-outline-variant/20 flex flex-col justify-between hover:bg-surface-container hover:shadow-e2 transition-all cursor-pointer group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary-container mb-6 shadow-e1 border border-outline-variant/15 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-serif group-hover:text-primary transition-colors">
                Call a helpline
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-3 leading-relaxed">
                Connect directly with empathetic, trained advocates at the Cyber Civil Rights
                Initiative. Always free, confidential, and available day or night.
              </p>
            </div>
            <div className="mt-8 font-label-md text-label-md text-primary font-semibold flex items-center gap-1">
              <span>Confidential link</span>
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">
                chevron_right
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div
            onClick={onOpenDeepfakeRestoreModal}
            className="p-space-lg rounded-2xl bg-surface-container-low shadow-e1 border border-outline-variant/20 flex flex-col justify-between hover:bg-surface-container hover:shadow-e2 transition-all cursor-pointer group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary-container mb-6 shadow-e1 border border-outline-variant/15 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px]">sync_saved_locally</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-serif group-hover:text-primary transition-colors">
                Put original back
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-3 leading-relaxed">
                For deepfakes or altered imagery, we petition platforms to completely expunge the
                synthetic copy and reinstate your authentic context.
              </p>
            </div>
            <div className="mt-8 font-label-md text-label-md text-primary font-semibold flex items-center gap-1">
              <span>Identity reset</span>
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">
                chevron_right
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
