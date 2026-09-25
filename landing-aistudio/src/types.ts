export interface ChatMessage {
  id: string;
  sender: 'agent' | 'user';
  text?: string;
  timestamp: string;
  isLink?: boolean;
  findingCard?: {
    headline: string;
    items: {
      url: string;
      recommendation: string;
      icon: string;
      status?: string;
    }[];
  };
  confirmationBadge?: {
    headline: string;
    body: string;
  };
}

export interface CaseItem {
  id: string;
  url: string;
  type: string;
  statusText: string;
  remainingHours: number;
  remainingMinutes: number;
  remainingSeconds: number;
  status: 'monitoring' | 'action_required' | 'removed' | 'escalated';
  platformName: string;
  dispatchedAt: string;
  targetNotice?: {
    statute: string;
    recipientHost: string;
    noticeText: string;
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  tag: string;
  tagStyle?: string;
  icon: string;
  description: string;
  footerIcon: string;
  footerText: string;
  colSpan?: string;
  details: {
    protocol: string;
    legalBasis: string;
    privacyMeasure: string;
    stats: string;
  };
}
