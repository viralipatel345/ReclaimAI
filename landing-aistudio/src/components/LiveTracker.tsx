import React, { useState, useEffect } from 'react';
import { CaseItem } from '../types';

interface LiveTrackerProps {
  cases: CaseItem[];
  onApproveNotice: (caseItem: CaseItem) => void;
  onAddLink: () => void;
  onInspectNotice: (caseItem: CaseItem) => void;
}

export const LiveTracker: React.FC<LiveTrackerProps> = ({
  cases,
  onApproveNotice,
  onAddLink,
  onInspectNotice,
}) => {
  // Live ticking state for countdown
  const [activeCases, setActiveCases] = useState<CaseItem[]>(cases);

  useEffect(() => {
    setActiveCases(cases);
  }, [cases]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCases((prevCases) =>
        prevCases.map((c) => {
          if (c.status !== 'monitoring' || (c.remainingHours === 0 && c.remainingMinutes === 0 && c.remainingSeconds === 0)) {
            return c;
          }
          let secs = c.remainingSeconds - 1;
          let mins = c.remainingMinutes;
          let hrs = c.remainingHours;

          if (secs < 0) {
            secs = 59;
            mins -= 1;
            if (mins < 0) {
              mins = 59;
              hrs -= 1;
            }
          }
          return {
            ...c,
            remainingHours: Math.max(0, hrs),
            remainingMinutes: Math.max(0, mins),
            remainingSeconds: Math.max(0, secs),
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const removedCount = activeCases.filter((c) => c.status === 'removed').length;
  const totalCount = activeCases.length;
  const progressPercent = Math.round((removedCount / totalCount) * 100) || 75;

  return (
    <section id="track-reports" className="w-full bg-surface-container-low/40 py-space-xl border-b border-outline-variant/20">
      <div className="max-w-[1440px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center">
          {/* Left Side: Editorial Context & Metric Overview (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-3">
              Continuous Visibility
            </div>
            <h2 className="font-headline-lg text-headline-lg md:text-display text-on-surface font-serif">
              Always know where things stand
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-4 leading-relaxed">
              Track every report quietly in real-time. No panic, no alarm bells—just calm,
              continuous progress with exact statutory countdown clocks.
            </p>

            {/* Metric Summary Display */}
            <div className="mt-8 p-space-md rounded-2xl bg-surface-container-lowest shadow-e1 border border-outline-variant/20 space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  Statutory Compliance Velocity
                </span>
                <span className="font-headline-sm text-headline-sm text-primary-container font-semibold font-serif">
                  18 hrs avg.
                </span>
              </div>

              {/* Progress Line Graphic */}
              <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden flex">
                <div
                  className="bg-primary-container h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              <p className="font-body-sm text-xs text-on-surface-variant">
                3 of 4 platforms responded and removed files well within their statutory 48-hour
                allotment.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-secondary font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  verified
                </span>
                <span>Zero personal image data stored on our servers.</span>
              </div>

              <button
                onClick={onAddLink}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-container transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>Add URL to case</span>
              </button>
            </div>
          </div>

          {/* Right Side: Live Interactive-Style Status Card (7 Cols) */}
          <div className="lg:col-span-7">
            <div className="p-6 md:p-8 rounded-3xl bg-surface-container-lowest shadow-e3 border border-outline-variant/25 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15">
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface font-serif">
                    Active Case #2904-B
                  </h4>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    {activeCases.length} incident targets under statutory enforcement
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-container/30 text-secondary font-label-sm text-label-sm border border-secondary-container/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  <span className="font-medium">Watcher active</span>
                </div>
              </div>

              {/* Case Items List */}
              <div className="space-y-3">
                {activeCases.map((item) => {
                  if (item.status === 'action_required') {
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-primary-fixed/30 border border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-primary-fixed/40 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-on-primary-fixed truncate">
                              {item.url}
                            </span>
                            <span className="text-[11px] text-primary font-label-sm font-medium">
                              {item.type}
                            </span>
                          </div>
                          <div className="font-body-sm text-xs text-on-surface-variant">
                            {item.statusText}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onApproveNotice(item)}
                            className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold hover:bg-primary transition-colors shadow-e1 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Approve notice</span>
                            <span className="material-symbols-outlined text-[14px]">
                              arrow_forward
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (item.status === 'removed') {
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-on-surface truncate">
                              {item.url}
                            </span>
                            <span className="text-[11px] text-on-surface-variant font-label-sm">
                              {item.type}
                            </span>
                          </div>
                          <div className="font-body-sm text-xs text-on-surface-variant">
                            {item.statusText}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-label-sm text-label-sm flex items-center gap-1 font-medium border border-emerald-200">
                            <span className="material-symbols-outlined text-[14px]">done_all</span>
                            <span>Removed</span>
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Monitoring / Counting Down
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col md:flex-row md:items-center justify-between gap-3 group hover:border-outline-variant/40 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-on-surface truncate">
                            {item.url}
                          </span>
                          <span className="text-[11px] text-on-surface-variant font-label-sm">
                            {item.type}
                          </span>
                        </div>
                        <div className="font-body-sm text-xs text-on-surface-variant">
                          {item.statusText}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onInspectNotice(item)}
                          title="Click to view statutory notice filed"
                          className="px-3 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 cursor-pointer hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px] text-primary">
                            schedule
                          </span>
                          <span className="font-mono tabular-nums font-medium">
                            Sent, {item.remainingHours}h {String(item.remainingMinutes).padStart(2, '0')}m {String(item.remainingSeconds).padStart(2, '0')}s left
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
