import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { TeamOfAgents } from './components/TeamOfAgents';
import { ActionCards } from './components/ActionCards';
import { LiveTracker } from './components/LiveTracker';
import { PillarsSection } from './components/PillarsSection';
import { Footer } from './components/Footer';
import { StealthCloak } from './components/StealthCloak';
import { Reveal } from './components/Reveal';
import {
  StatutoryNoticeModal,
  PoliceEvidenceModal,
  HelplineModal,
  DeepfakeRestoreModal,
  NoticeApprovalModal,
  AddLinkModal,
  GuideModal,
} from './components/Modals';
import { INITIAL_CHAT_MESSAGES, INITIAL_CASE_ITEMS } from './data/mockData';
import { ChatMessage, CaseItem } from './types';

export default function App() {
  const [stealthMode, setStealthMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [cases, setCases] = useState<CaseItem[]>(INITIAL_CASE_ITEMS);
  const [activeSection, setActiveSection] = useState('how-it-works');

  // Modal states
  const [isStatutoryModalOpen, setIsStatutoryModalOpen] = useState(false);
  const [isPoliceModalOpen, setIsPoliceModalOpen] = useState(false);
  const [isHelplineModalOpen, setIsHelplineModalOpen] = useState(false);
  const [isDeepfakeModalOpen, setIsDeepfakeModalOpen] = useState(false);
  const [selectedCaseForApproval, setSelectedCaseForApproval] = useState<CaseItem | null>(null);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);

  // Guide modal state
  const [guideModalConfig, setGuideModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    content: { heading: string; text: string }[];
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    content: [],
  });

  // Global Quick Escape listener (Esc key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStealthMode(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigation helper
  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Start chat handler (scrolls to hero chat console)
  const handleStartChat = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const input = document.querySelector('input[placeholder*="Type a link"]') as HTMLInputElement;
    if (input) {
      input.focus();
    }
  };

  // Chat interaction: Send message
  const handleSendMessage = (text: string) => {
    const newMsgId = `user-${Date.now()}`;
    const isUrl =
      text.includes('http') ||
      text.includes('.com') ||
      text.includes('.is') ||
      text.includes('.org') ||
      text.includes('.net') ||
      text.includes('/') ||
      text.includes('thread');

    const newMsg: ChatMessage = {
      id: newMsgId,
      sender: 'user',
      text,
      isLink: isUrl,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, newMsg]);

    // Simulated Agent Response
    setTimeout(() => {
      if (isUrl) {
        // Generate finding card and add to active case
        const agentFindingMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          findingCard: {
            headline: `I analyzed the host infrastructure for ${text}. Triage complete:`,
            items: [
              {
                url: text,
                recommendation: 'Recommended: Official TAKE IT DOWN Act 48-hour filing',
                icon: 'policy',
              },
              {
                url: 'Associated Global CDN Cache',
                recommendation: 'Recommended: Tier-1 upstream purge',
                icon: 'cloud_sync',
              },
            ],
          },
          timestamp: 'Just now',
        };

        setMessages((prev) => [...prev, agentFindingMsg]);

        // Also append to case tracker
        const newCaseItem: CaseItem = {
          id: `case-${Date.now()}`,
          url: text,
          type: 'User Submitted Link',
          platformName: 'Identified Target Platform',
          statusText: 'Statutory notice ready. Enforcing 48-hour compliance clock.',
          remainingHours: 48,
          remainingMinutes: 0,
          remainingSeconds: 0,
          status: 'monitoring',
          dispatchedAt: 'Just now',
          targetNotice: {
            statute: 'U.S. TAKE IT DOWN Act Mandatory Removal Notice',
            recipientHost: 'Host Compliance & Abuse Desk',
            noticeText: `STATUTORY DEMAND FOR IMMEDIATE REMOVAL\nTarget URL: ${text}\nStatute: U.S. TAKE IT DOWN Act\nCompliance Deadline: 48 hours from dispatch.\nNotice ID: REC-${Math.floor(
              1000 + Math.random() * 9000
            )}`,
          },
        };

        setCases((prev) => [newCaseItem, ...prev]);
      } else {
        // Empathetic, supportive guidance
        let reply =
          'You are doing the right thing, and you do not have to carry this alone. I can search links, draft statutory notices, or connect you with advocates whenever you are ready.';
        if (text.toLowerCase().includes('police') || text.toLowerCase().includes('report')) {
          reply =
            'We can generate a forensically timestamped evidence packet without storing any explicit media. You can take this directly to a precinct or let us handle statutory platform removal first.';
        } else if (text.toLowerCase().includes('who') || text.toLowerCase().includes('know')) {
          reply =
            'Platforms receive notices from Reclaim as designated legal representatives. Your real personal email, home address, and intimate files are never disclosed to the host or the uploader.';
        }

        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: reply,
          timestamp: 'Just now',
        };
        setMessages((prev) => [...prev, agentMsg]);
      }
    }, 800);
  };

  // Quick action: Report all
  const handleReportAll = () => {
    const reportMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: 'report all of them',
      timestamp: 'Just now',
    };

    setMessages((prev) => [
      ...prev,
      reportMsg,
      {
        id: `agent-${Date.now() + 1}`,
        sender: 'agent',
        text: 'All 3 platform demands dispatched under federal statute. The 48-hour statutory countdown clock is running across all targets.',
        confirmationBadge: {
          headline: 'Demands dispatched.',
          body: 'All hosts have been served with formal TAKE IT DOWN Act cease-and-desist notices. Watcher is tracking resolution.',
        },
        timestamp: 'Just now',
      },
    ]);
  };

  // Case Tracker: Approve notice
  const handleApproveNotice = (caseItem: CaseItem) => {
    setSelectedCaseForApproval(caseItem);
  };

  const handleConfirmApproval = (caseId: string) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              status: 'monitoring',
              statusText: 'Statutory 48-hour federal notice delivered. Monitoring compliance clock.',
              remainingHours: 47,
              remainingMinutes: 59,
              remainingSeconds: 59,
            }
          : c
      )
    );
  };

  // Add link from modal or chat
  const handleAddLinkToCase = (url: string, type: string) => {
    const newCase: CaseItem = {
      id: `case-${Date.now()}`,
      url,
      type,
      platformName: 'Registered Provider',
      statusText: 'Statutory notice filed under U.S. TAKE IT DOWN Act.',
      remainingHours: 48,
      remainingMinutes: 0,
      remainingSeconds: 0,
      status: 'monitoring',
      dispatchedAt: 'Just now',
      targetNotice: {
        statute: 'U.S. TAKE IT DOWN Act',
        recipientHost: 'Host Abuse & Legal Counsel',
        noticeText: `STATUTORY NOTICE OF CONTENT REMOVAL UNDER 48-HOUR MANDATE\nURL: ${url}`,
      },
    };

    setCases((prev) => [newCase, ...prev]);

    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        sender: 'agent',
        confirmationBadge: {
          headline: 'New incident target engaged.',
          body: `Added ${url} to Case #2904-B. Statutory notice generated and 48-hour compliance window initialized.`,
        },
        timestamp: 'Just now',
      },
    ]);
  };

  // Burn Session / Reset state
  const handleBurnSession = () => {
    if (
      window.confirm(
        'Burn this session? This will immediately clear all active chat messages and newly added targets for your safety.'
      )
    ) {
      setMessages(INITIAL_CHAT_MESSAGES);
      setCases(INITIAL_CASE_ITEMS);
    }
  };

  // Guides
  const openGuide = (type: 'safety' | 'evidence' | 'landscape' | 'pledge' | 'statute' | 'ally') => {
    if (type === 'safety') {
      setGuideModalConfig({
        isOpen: true,
        title: 'Safety & Privacy Protocols',
        subtitle: 'Architected from the ground up for maximum survivor protection',
        content: [
          {
            heading: 'Zero Media Ingestion Protocol',
            text: 'Reclaim never asks you to upload, transmit, or store private intimate media. Our agents rely strictly on URL hashing, host IP telemetry, and metadata fingerprints to identify and enforce takedowns.',
          },
          {
            heading: 'Cryptographic Memory-Only Processing',
            text: 'Conversations and links are processed in transient RAM memory. No unencrypted logs or persistent identifying tracking cookies are preserved on public endpoints.',
          },
          {
            heading: 'Survivor Pseudonym Shielding',
            text: 'When filing statutory cease-and-desist declarations, notices are delivered by Reclaim Legal Representation, shielding your real domestic address and full legal name from rogue webmasters.',
          },
        ],
      });
    } else if (type === 'evidence') {
      setGuideModalConfig({
        isOpen: true,
        title: 'Survivor Evidence Preservation Guide',
        subtitle: 'How to safely document digital harassment without re-victimization',
        content: [
          {
            heading: 'Preserving URL & Timestamp Integrity',
            text: 'Always capture the full web address (URL) including trailing thread numbers and timestamps. Avoid cropping browser address bars when taking records.',
          },
          {
            heading: 'Avoid Re-sharing or Forwarding to Friends',
            text: 'Under federal and state law, transmitting nonconsensual imagery (even for evidentiary advice) can create accidental legal complications. Let Reclaim’s cryptographic hashing record the evidence safely.',
          },
          {
            heading: 'Preserve Original EXIF & Message Headers',
            text: 'If the material was sent via email or direct message, export the raw message headers or Discord user IDs, which provide decisive origin evidence for law enforcement.',
          },
        ],
      });
    } else if (type === 'landscape') {
      setGuideModalConfig({
        isOpen: true,
        title: 'Federal Legal Landscape',
        subtitle: 'Your rights under the U.S. TAKE IT DOWN Act and federal statutes',
        content: [
          {
            heading: 'The Statutory 48-Hour Removal Mandate',
            text: 'The U.S. TAKE IT DOWN Act establishes a binding federal requirement: once an online platform or hosting provider receives an official notice of nonconsensual intimate imagery, they have exactly 48 hours to remove or disable access to the content.',
          },
          {
            heading: 'Loss of Section 230 Safe Harbor',
            text: 'Platforms that fail to act within the 48-hour compliance window forfeit statutory immunity and become directly exposed to civil liability, statutory damages, and federal injunctive orders.',
          },
          {
            heading: 'Criminalization of AI Deepfakes',
            text: 'The federal statute extends strict criminal penalties to synthetic media, AI likeness alterations, and manipulated imagery created or distributed without conscious consent.',
          },
        ],
      });
    } else if (type === 'pledge') {
      setGuideModalConfig({
        isOpen: true,
        title: 'Our Survivor Data Pledge',
        subtitle: 'Our non-negotiable ethical and architectural covenant',
        content: [
          {
            heading: '100% Survivor Controlled',
            text: 'No action is taken, no letter is sent, and no entity is contacted without your unambiguous authorization.',
          },
          {
            heading: 'No Retainers, No Paywalls',
            text: 'Access to crisis takedown tools and statutory notice generation is provided completely free of charge to survivors.',
          },
          {
            heading: 'Permanent Data Erasure',
            text: 'You may click "Burn session" or exit at any moment. When a case is closed, all temporary hash records are permanently overwritten.',
          },
        ],
      });
    } else if (type === 'statute') {
      setGuideModalConfig({
        isOpen: true,
        title: 'U.S. TAKE IT DOWN Act Overview',
        subtitle: 'Tools for immediate federal enforcement',
        content: [
          {
            heading: 'Statutory 48-Hour Deadline',
            text: 'Federal law establishes that hosting entities have 48 hours from verified notice receipt to purge nonconsensual intimate imagery.',
          },
          {
            heading: 'Search Engine De-indexing Mandate',
            text: 'Requires major search engines to de-list and suppress image query results and cached thumbnail snapshots.',
          },
          {
            heading: 'Civil Right of Action',
            text: 'Empowers survivors to seek statutory financial damages and legal fees from non-compliant host entities and distributors.',
          },
        ],
      });
    } else if (type === 'ally') {
      setGuideModalConfig({
        isOpen: true,
        title: 'How Allies Can Help Safely',
        subtitle: 'Guidance for friends, partners, and advocates',
        content: [
          {
            heading: 'Step 1: Do Not Confront the Uploader Directly',
            text: 'Direct confrontation frequently causes retaliatory posting to alternative fringe mirrors or peer-to-peer networks. Let quiet statutory takedowns take precedence.',
          },
          {
            heading: 'Step 2: Collect Links Quietly',
            text: 'Record the exact URL links without re-saving or downloading the imagery onto local machines.',
          },
          {
            heading: 'Step 3: Provide Constant Reassurance',
            text: 'Remind the target: This is not your fault. It is a federal statutory crime committed against you, and you have the power to dismantle it.',
          },
        ],
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Stealth Mode Overlay when activated */}
      {stealthMode && <StealthCloak onDeactivate={() => setStealthMode(false)} />}

      {/* Top Navigation */}
      <Header
        onQuickExit={() => setStealthMode(true)}
        onStartChat={handleStartChat}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      <main className="w-full pt-20 bg-surface">
        {/* Hero Section with Live Chat Console */}
        <Hero
          onStartChat={handleStartChat}
          onOpenStatuteModal={() => openGuide('statute')}
          messages={messages}
          onSendMessage={handleSendMessage}
          onReportAll={handleReportAll}
          onOpenHelpline={() => setIsHelplineModalOpen(true)}
          onOpenAllyGuide={() => openGuide('ally')}
          onViewCaseTracker={() => handleNavigate('track-reports')}
          cases={cases}
        />

        {/* Section 2: Team of Agents */}
        <Reveal>
          <TeamOfAgents />
        </Reveal>

        {/* Section 3: One Clear Next Step for Every Place */}
        <Reveal>
          <ActionCards
            onOpenStatutoryNoticeModal={() => setIsStatutoryModalOpen(true)}
            onOpenPoliceEvidenceModal={() => setIsPoliceModalOpen(true)}
            onOpenHelplineModal={() => setIsHelplineModalOpen(true)}
            onOpenDeepfakeRestoreModal={() => setIsDeepfakeModalOpen(true)}
          />
        </Reveal>

        {/* Section 4: Live Report Tracker */}
        <Reveal>
          <LiveTracker
            cases={cases}
            onApproveNotice={handleApproveNotice}
            onAddLink={() => setIsAddLinkModalOpen(true)}
            onInspectNotice={(caseItem) => setSelectedCaseForApproval(caseItem)}
          />
        </Reveal>

        {/* Section 5: Pillars & Closing Callout */}
        <Reveal>
          <PillarsSection
            onStartChat={handleStartChat}
            onSpeakToAdvocate={() => setIsHelplineModalOpen(true)}
            onQuickExit={() => setStealthMode(true)}
          />
        </Reveal>
      </main>

      {/* Footer */}
      <Footer
        onOpenSafetyProtocols={() => openGuide('safety')}
        onOpenEvidenceGuide={() => openGuide('evidence')}
        onOpenLegalLandscape={() => openGuide('landscape')}
        onOpenDataPledge={() => openGuide('pledge')}
        onBurnSession={handleBurnSession}
      />

      {/* Interactive Modals */}
      <StatutoryNoticeModal
        isOpen={isStatutoryModalOpen}
        onClose={() => setIsStatutoryModalOpen(false)}
        onDispatch={(url, type) => handleAddLinkToCase(url, type)}
      />

      <PoliceEvidenceModal
        isOpen={isPoliceModalOpen}
        onClose={() => setIsPoliceModalOpen(false)}
      />

      <HelplineModal
        isOpen={isHelplineModalOpen}
        onClose={() => setIsHelplineModalOpen(false)}
      />

      <DeepfakeRestoreModal
        isOpen={isDeepfakeModalOpen}
        onClose={() => setIsDeepfakeModalOpen(false)}
      />

      <NoticeApprovalModal
        isOpen={!!selectedCaseForApproval}
        onClose={() => setSelectedCaseForApproval(null)}
        caseItem={selectedCaseForApproval}
        onConfirmApprove={handleConfirmApproval}
      />

      <AddLinkModal
        isOpen={isAddLinkModalOpen}
        onClose={() => setIsAddLinkModalOpen(false)}
        onAdd={handleAddLinkToCase}
      />

      <GuideModal
        isOpen={guideModalConfig.isOpen}
        onClose={() => setGuideModalConfig((prev) => ({ ...prev, isOpen: false }))}
        title={guideModalConfig.title}
        subtitle={guideModalConfig.subtitle}
        content={guideModalConfig.content}
      />
    </div>
  );
}
