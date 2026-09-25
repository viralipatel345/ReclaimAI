import React, { useState } from 'react';
import { AgentInfo } from '../types';
import { AGENTS_DATA } from '../data/mockData';

interface TeamOfAgentsProps {
  onSelectAgent?: (agent: AgentInfo) => void;
}

export const TeamOfAgents: React.FC<TeamOfAgentsProps> = ({ onSelectAgent }) => {
  const [activeModalAgent, setActiveModalAgent] = useState<AgentInfo | null>(null);

  const handleCardClick = (agent: AgentInfo) => {
    setActiveModalAgent(agent);
    if (onSelectAgent) {
      onSelectAgent(agent);
    }
  };

  return (
    <section id="our-agents" className="w-full bg-surface-container-low/60 py-space-xl border-y border-outline-variant/20">
      <div className="max-w-[1440px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-3">
            Quiet Autonomous Advocacy
          </div>
          <h2 className="font-headline-lg text-headline-lg md:text-display text-on-surface font-serif">
            Your team of agents
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-4 leading-relaxed">
            Five specialized AI agents work quietly in the background so you never have to
            confront hosts, view traumatic material, or navigate legal paperwork alone.
          </p>
        </div>

        {/* Agent Grid: 5 Bespoke Frosted Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {AGENTS_DATA.map((agent) => (
            <div
              key={agent.id}
              onClick={() => handleCardClick(agent)}
              className={`${
                agent.colSpan || ''
              } p-space-lg rounded-2xl bg-surface-container-lowest/85 backdrop-blur-md shadow-e1 border border-outline-variant/20 flex flex-col justify-between group hover:shadow-e2 hover:border-primary/30 transition-all cursor-pointer`}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">{agent.icon}</span>
                  </div>
                  <span
                    className={`font-label-sm text-label-sm px-2.5 py-1 rounded-full ${
                      agent.tagStyle || 'bg-surface-container-high text-on-surface-variant'
                    } font-medium`}
                  >
                    {agent.tag}
                  </span>
                </div>

                <h3 className="font-headline-sm text-headline-sm text-on-surface font-serif group-hover:text-primary transition-colors">
                  {agent.name}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-3 leading-relaxed">
                  {agent.description}
                </p>
              </div>

              <div className="mt-8 pt-4 flex items-center justify-between border-t border-outline-variant/15 text-on-surface-variant font-label-sm text-label-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    {agent.footerIcon}
                  </span>
                  <span>{agent.footerText}</span>
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary font-medium flex items-center text-xs">
                  Inspect
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Deep-Dive Modal */}
      {activeModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-e3 border border-outline-variant/30 relative">
            <button
              onClick={() => setActiveModalAgent(null)}
              className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[26px]">
                  {activeModalAgent.icon}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-xl font-serif text-on-surface">
                    Agent: {activeModalAgent.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-secondary-container/50 text-secondary">
                    {activeModalAgent.tag}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Operating in autonomous survivor-shielded container
                </p>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
              {activeModalAgent.description}
            </p>

            <div className="space-y-3.5 bg-surface-container-low/60 rounded-xl p-4 border border-outline-variant/20 text-xs">
              <div>
                <span className="font-semibold text-on-surface block mb-0.5">
                  Execution Protocol:
                </span>
                <span className="text-on-surface-variant">
                  {activeModalAgent.details.protocol}
                </span>
              </div>
              <div>
                <span className="font-semibold text-on-surface block mb-0.5">Legal Leverage:</span>
                <span className="text-on-surface-variant">
                  {activeModalAgent.details.legalBasis}
                </span>
              </div>
              <div>
                <span className="font-semibold text-on-surface block mb-0.5">
                  Privacy Safeguards:
                </span>
                <span className="text-on-surface-variant">
                  {activeModalAgent.details.privacyMeasure}
                </span>
              </div>
              <div>
                <span className="font-semibold text-on-surface block mb-0.5">Performance:</span>
                <span className="text-emerald-800 font-medium">
                  {activeModalAgent.details.stats}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setActiveModalAgent(null)}
                className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors cursor-pointer"
              >
                Close Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
