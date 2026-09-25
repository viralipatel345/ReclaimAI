import { CaseItem, AgentInfo, ChatMessage } from '../types';

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'agent',
    text: 'Tell me what happened. You’re completely safe here, and you are in full control of every step.',
    timestamp: 'Just now',
  },
  {
    id: 'msg-2',
    sender: 'user',
    text: 'someone posted a fake nude of me on a forum and in a discord server',
    timestamp: 'Just now',
  },
  {
    id: 'msg-3',
    sender: 'agent',
    text: 'I’m so sorry this happened. It is not your fault, and you do not have to confront anyone directly. Do you have a link to where you saw it?',
    timestamp: 'Just now',
  },
  {
    id: 'msg-4',
    sender: 'user',
    text: 'forum-archive.is/thread/4920',
    isLink: true,
    timestamp: 'Just now',
  },
  {
    id: 'msg-5',
    sender: 'agent',
    findingCard: {
      headline: 'I scanned the immediate network. Found 3 active host locations:',
      items: [
        {
          url: 'forum-archive.is/thread/4920',
          recommendation: 'Recommended: Official platform takedown',
          icon: 'policy',
        },
        {
          url: 'cloud-storage-cdn.net/p/992',
          recommendation: 'Recommended: Direct host legal removal',
          icon: 'gavel',
        },
        {
          url: 'Image Search Indexing',
          recommendation: 'Recommended: Google & Bing de-listing',
          icon: 'link_off',
        },
      ],
    },
    timestamp: 'Just now',
  },
  {
    id: 'msg-6',
    sender: 'user',
    text: 'report all of them',
    timestamp: 'Just now',
  },
  {
    id: 'msg-7',
    sender: 'agent',
    text: 'Platforms have 48 hours under federal statute. I have initiated the countdown tracker and will text you as each link falls.',
    confirmationBadge: {
      headline: 'Demands sent.',
      body: 'Platforms have 48 hours under federal statute. I have initiated the countdown tracker and will text you as each link falls.',
    },
    timestamp: 'Just now',
  },
];

export const INITIAL_CASE_ITEMS: CaseItem[] = [
  {
    id: 'case-1',
    url: 'file-vault.to/view/8812',
    type: 'Cloud Host',
    platformName: 'FileVault Cloud Storage',
    statusText: 'Host acknowledged legal notice. Monitoring compliance countdown.',
    remainingHours: 31,
    remainingMinutes: 24,
    remainingSeconds: 18,
    status: 'monitoring',
    dispatchedAt: '16 hours ago',
    targetNotice: {
      statute: 'U.S. TAKE IT DOWN Act (47 U.S.C. § 223 / 18 U.S.C. § 2255)',
      recipientHost: 'abuse@file-vault.to (Registered Agent)',
      noticeText:
        'FORMAL STATUTORY NOTICE OF NONCONSENSUAL INTIMATE IMAGERY UNDER THE U.S. TAKE IT DOWN ACT.\n\nYou are hereby notified pursuant to federal statute that nonconsensual intimate or synthetic visual depiction of the protected individual is hosted at file-vault.to/view/8812. Under statutory provisions, online platforms and hosting services must remove or disable access to the designated content within 48 hours of receipt. Failure to comply exposes the hosting entity to civil damages and loss of statutory safe harbor.',
    },
  },
  {
    id: 'case-2',
    url: 'discussion-board.net/thread/01',
    type: 'Public Forum',
    platformName: 'Discussion Board Net',
    statusText: 'Match confirmed via link analysis. Tap to approve 48-hour federal notice.',
    remainingHours: 48,
    remainingMinutes: 0,
    remainingSeconds: 0,
    status: 'action_required',
    dispatchedAt: 'Pending user confirmation',
    targetNotice: {
      statute: 'U.S. TAKE IT DOWN Act & DMCA 17 U.S.C. § 512(c)',
      recipientHost: 'legal@discussion-board.net',
      noticeText:
        'URGENT STATUTORY CEASE-AND-DESIST DEMAND.\n\nTarget URL: discussion-board.net/thread/01\nDesignation: Nonconsensual intimate depiction / AI-generated likeness.\nStatutory Requirement: Immediate de-indexing and content removal within 48 hours.\nDesignated Officer: Reclaim Autonomous Legal Dispatch on behalf of verified individual.',
    },
  },
  {
    id: 'case-3',
    url: 'Google Image Index',
    type: 'Search Result',
    platformName: 'Google Search & Cache Services',
    statusText: 'Removed from search results.',
    remainingHours: 0,
    remainingMinutes: 0,
    remainingSeconds: 0,
    status: 'removed',
    dispatchedAt: 'Completed 2 hours ago',
    targetNotice: {
      statute: 'Search Engine Explicit Content Removal Policy & Federal Compliance',
      recipientHost: 'Google Legal Removal Team',
      noticeText: 'Search index entry purged. Cache mirrors wiped across global data centers.',
    },
  },
  {
    id: 'case-4',
    url: 'social-feed.co/post/339',
    type: 'Microblog',
    platformName: 'Social Feed Co',
    statusText: 'Escalation advocate on standby if host misses midnight deadline.',
    remainingHours: 14,
    remainingMinutes: 12,
    remainingSeconds: 45,
    status: 'monitoring',
    dispatchedAt: '34 hours ago',
    targetNotice: {
      statute: 'U.S. TAKE IT DOWN Act Mandatory Escalation',
      recipientHost: 'dmca@social-feed.co',
      noticeText:
        'SECOND STATUTORY WARNING: 14 hours remaining in statutory compliance window. Unresolved status will trigger direct civil enforcement filing and tier-1 ISP upstream transit null-routing.',
    },
  },
];

export const AGENTS_DATA: AgentInfo[] = [
  {
    id: 'finder',
    name: 'Finder',
    tag: 'Autonomous & quiet',
    icon: 'manage_search',
    description:
      'Searches the public web, image repositories, forums, and indexing engines for matches without requiring you to look at or upload explicit media.',
    footerIcon: 'filter_center_focus',
    footerText: 'Metadata & hash matching only',
    details: {
      protocol: 'Perceptual hashing (pHash) and cryptographic URL indexing across 14,000+ known host networks.',
      legalBasis: 'Automated digital evidence discovery without storage or reproduction of sensitive imagery.',
      privacyMeasure: 'Zero media ingestion: your images never touch Reclaim servers. Searches use link structures and hash fingerprints.',
      stats: 'Averages 4.2 minutes per full multi-tier network scan.',
    },
  },
  {
    id: 'triage',
    name: 'Triage',
    tag: 'Contextual',
    icon: 'alt_route',
    description:
      'Evaluates platform architecture in seconds. Instantly prescribes the exact recourse—whether it is a statutory notice, host de-indexing, or law enforcement filing.',
    footerIcon: 'fact_check',
    footerText: 'Zero conflicting choices',
    details: {
      protocol: 'Host WHOIS mapping, hosting provider jurisdiction analysis, and Safe Harbor eligibility check.',
      legalBasis: 'Identifies whether platform is bound by TAKE IT DOWN Act, DMCA, or international mutual legal treaties.',
      privacyMeasure: 'No human operator views the triage logs. Decisions are programmatically verified.',
      stats: 'Finds where your image appears across major platforms, forums, image hosts, and search.',
    },
  },
  {
    id: 'filing',
    name: 'Filing',
    tag: 'Survivor Approval',
    icon: 'gavel',
    description:
      'Drafts and delivers legally binding cease-and-desist declarations under the U.S. TAKE IT DOWN Act. Never fires a notice without your explicit confirmation.',
    footerIcon: 'verified_user',
    footerText: 'Federal statutory leverage',
    details: {
      protocol: 'Formal legal demand generation citing statutory penalties, 48-hour deadline, and personal liability caveats.',
      legalBasis: 'U.S. TAKE IT DOWN Act; 18 U.S.C. § 2255 civil remedy and 47 U.S.C. § 223 enforcement.',
      privacyMeasure: 'Survivor legal name remains shielded under pseudonym or designated agent representation.',
      stats: 'Over 89% of hosts take content down within 24 hours of first Filing delivery.',
    },
  },
  {
    id: 'watcher',
    name: 'Watcher',
    tag: '24/7 Precision',
    icon: 'timer',
    description:
      'Maintains an active millisecond countdown on the 48-hour compliance window. When a host is non-compliant, Watcher automatically escalates to search tier de-listing.',
    footerIcon: 'schedule',
    footerText: '48h clock strictly tracked',
    details: {
      protocol: 'Continuous automated ping checks to verify HTTP 404, 410 (Gone), or DNS sinkhole status.',
      legalBasis: 'Statutory 48-hour expiration trigger for federal non-compliance filings.',
      privacyMeasure: 'Passive verification queries without scraping or downloading host payloads.',
      stats: 'Checks compliance status every 90 seconds until permanent removal is confirmed.',
    },
  },
  {
    id: 'restore',
    name: 'Restore',
    tag: 'Authenticity Protection',
    tagStyle: 'bg-primary-container/10 text-primary-container font-medium',
    icon: 'history_toggle_off',
    description:
      'For deepfakes or altered imagery generated by AI, Restore demands that platforms delete the manipulated asset and purge historical cache snapshots from major search engine results.',
    footerIcon: 'done_all',
    footerText: 'Deepfake eradication · Cache wipe verification',
    colSpan: 'md:col-span-2 lg:col-span-2',
    details: {
      protocol: 'Cache purge requests dispatched to Google Webmaster tools, Bing IndexNow, Wayback Machine, and public proxies.',
      legalBasis: 'Synthetic media impersonation protections and federal right of authentic likeness.',
      privacyMeasure: 'Replaces cached synthetic previews with digital null records, protecting your authentic presence.',
      stats: 'Over 12,000+ cached thumbnail fragments successfully purged.',
    },
  },
];
