import { motion } from 'motion/react';
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, CaseItem } from '../types';

interface ChatConsoleProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onReportAll: () => void;
  onOpenHelpline: () => void;
  onOpenAllyGuide: () => void;
  onViewCaseTracker: () => void;
  cases: CaseItem[];
}

export const ChatConsole: React.FC<ChatConsoleProps> = ({
  messages,
  onSendMessage,
  onReportAll,
  onOpenHelpline,
  onOpenAllyGuide,
  onViewCaseTracker,
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    onSendMessage(text);
  };

  return (
    <div className="relative w-full">
      {/* Soft Paper Backdrop Shadow Layer */}
      <div className="rounded-2xl bg-surface-container-lowest/95 backdrop-blur-xl shadow-e3 overflow-hidden border border-outline-variant/30 transition-all duration-300">
        {/* Window Bar / Header */}
        <div className="px-5 py-4 bg-surface-container/70 backdrop-blur flex items-center justify-between border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-600 rounded-full ring-2 ring-surface-container"></span>
            </div>
            <div>
              <div className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
                <span>Reclaim Agent</span>
                <span className="material-symbols-outlined text-primary-container text-[14px]">
                  verified
                </span>
              </div>
              <div className="font-label-sm text-label-sm text-secondary">
                Active • Enforcing 48h Clock
              </div>
            </div>
          </div>

          {/* Quick safety indicator */}
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-[11px] text-on-surface-variant/80 px-2 py-1 rounded bg-surface-container-high/60 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-secondary">lock</span>
              <span>Encrypted Session</span>
            </span>
          </div>
        </div>

        {/* Dialogue Stream */}
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label="Encrypted dialogue stream"
          className="p-5 space-y-4 max-h-[580px] overflow-y-auto focus:outline-none focus:ring-1 focus:ring-primary/20"
        >
          {/* Timestamp Separator */}
          <div className="text-center my-1">
            <span className="font-label-sm text-[11px] text-on-surface-variant/70 uppercase tracking-wider">
              Today • Safe Line Opened
            </span>
          </div>

          {messages.map((msg) => {
            if (msg.sender === 'user') {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }} className="flex flex-col items-end ml-auto max-w-[88%]">
                  <div
                    className={`p-3.5 rounded-2xl rounded-tr-sm bg-primary-container text-on-primary font-body-sm text-body-sm shadow-e1 leading-relaxed ${
                      msg.isLink ? 'font-mono text-[13px] tracking-tight bg-primary-container/95' : ''
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="font-label-sm text-[10px] text-on-surface-variant/80 mt-1 mr-1">
                    Delivered
                  </span>
                </motion.div>
              );
            }

            // Agent Message
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }} className="flex flex-col gap-2 max-w-[92%]">
                {msg.text && !msg.confirmationBadge && (
                  <div className="flex items-start gap-2.5">
                    <div className="p-3.5 rounded-2xl rounded-tl-sm bg-surface-container text-on-surface font-body-sm text-body-sm shadow-e1 leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                )}

                {/* Finding Card Insertion */}
                {msg.findingCard && (
                  <div className="flex flex-col items-start gap-2 w-full mt-1">
                    <div className="p-3.5 rounded-2xl rounded-tl-sm bg-surface-container text-on-surface font-body-sm text-body-sm shadow-e1 w-full border border-outline-variant/30">
                      <p className="font-medium text-on-surface text-body-sm">
                        {msg.findingCard.headline}
                      </p>

                      <div className="mt-3 space-y-2">
                        {msg.findingCard.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-surface-container-lowest shadow-e1 flex items-start justify-between gap-2 border border-outline-variant/20 hover:border-primary/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-semibold text-on-surface truncate">
                                {item.url}
                              </div>
                              <div className="font-label-sm text-[11px] text-primary-container mt-0.5 font-medium">
                                {item.recommendation}
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                              {item.icon}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Final Confirmation with Check */}
                {msg.confirmationBadge && (
                  <div className="flex items-start gap-2.5">
                    <div className="p-3.5 rounded-2xl rounded-tl-sm bg-surface-container text-on-surface font-body-sm text-body-sm shadow-e1 leading-relaxed border border-emerald-900/10">
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold mr-1.5">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        {msg.confirmationBadge.headline}
                      </span>
                      <span>{msg.confirmationBadge.body}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Quick Reply Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={onReportAll}
              className="px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-e1 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[15px]">send</span>
              <span>Report all (3)</span>
            </button>
            <button
              onClick={onOpenHelpline}
              className="px-3.5 py-1.5 rounded-full bg-surface-container-high/80 text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors cursor-pointer border border-outline-variant/30"
            >
              Call a helpline
            </button>
            <button
              onClick={onOpenAllyGuide}
              className="px-3.5 py-1.5 rounded-full bg-surface-container-high/80 text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors cursor-pointer border border-outline-variant/30"
            >
              Add an ally
            </button>
            <button
              onClick={onViewCaseTracker}
              className="px-3.5 py-1.5 rounded-full bg-secondary-container/50 text-secondary font-label-md text-label-md hover:bg-secondary-container transition-colors cursor-pointer border border-secondary-container/50 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              <span>View live tracker</span>
            </button>
          </div>
        </div>

        {/* Chat Footer Input */}
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-surface-container-lowest flex items-center gap-3 border-t border-outline-variant/20"
        >
          <div className="flex-1 bg-surface-container-low px-4 py-2.5 rounded-xl font-body-sm text-body-sm text-on-surface flex items-center justify-between border border-outline-variant/20 focus-within:border-primary-container focus-within:ring-1 focus-within:ring-primary-container">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a link or ask what to do next..."
              className="w-full bg-transparent text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none text-body-sm"
            />
            <button
              type="button"
              onClick={() => setInputText('https://cdn-upload.forum-leaks.org/img/8492')}
              title="Insert sample leak link to analyze"
              className="material-symbols-outlined text-[18px] text-outline hover:text-primary transition-colors cursor-pointer ml-2"
            >
              alternate_email
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-e1 hover:bg-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send message or link"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      </div>

      {/* Floating Micro Credential Card */}
      <div className="hidden sm:flex absolute -bottom-5 -left-6 p-4 rounded-xl bg-surface-container-lowest/95 backdrop-blur-md shadow-e3 max-w-xs items-center gap-3.5 border border-outline-variant/30">
        <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
          <span className="material-symbols-outlined text-[20px]">shield_with_heart</span>
        </div>
        <div>
          <div className="font-label-md text-label-md font-semibold text-on-surface">
            Non-confrontational
          </div>
          <p className="font-body-sm text-xs text-on-surface-variant">
            We issue statutory legal notices. You remain unexposed.
          </p>
        </div>
      </div>
    </div>
  );
};
