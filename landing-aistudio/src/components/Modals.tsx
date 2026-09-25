import React, { useState } from 'react';
import { CaseItem } from '../types';

/* 1. Statutory Notice Modal */
export const StatutoryNoticeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onDispatch: (url: string, type: string) => void;
}> = ({ isOpen, onClose, onDispatch }) => {
  const [platform, setPlatform] = useState('Public Forum');
  const [targetUrl, setTargetUrl] = useState('https://forum-archive.is/thread/4920');
  const [copied, setCopied] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  if (!isOpen) return null;

  const noticeText = `FORMAL LEGAL CEASE-AND-DESIST NOTICE UNDER THE U.S. TAKE IT DOWN ACT
Statutory Reference: 47 U.S.C. § 223 / 18 U.S.C. § 2255
Mandatory Removal Window: 48 Hours from Receipt

TO: Designated Abuse & Legal Counsel (${platform})
RE: Immediate Removal of Nonconsensual Intimate Imagery / Synthetic Media

You are hereby provided official statutory notice that the material located at:
${targetUrl}

Depicts nonconsensual intimate imagery or altered synthetic visual media of the protected individual without consent. Under federal law, online platforms and hosting providers must remove or disable access to the designated depiction within 48 hours of receipt of this notice.

Failure to act within the statutory 48-hour deadline constitutes willful non-compliance, revokes statutory safe harbors, and subjects the host entity to civil damages, injunctive relief, and referral to federal authorities.

Issued via: Reclaim Autonomous Survivor Advocacy System
Verification Hash: 8f9b2c31e479a02d8471...
Timestamp: ${new Date().toUTCString()}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(noticeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDispatch = () => {
    setDispatched(true);
    setTimeout(() => {
      onDispatch(targetUrl, platform);
      setDispatched(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-e3 border border-outline-variant/30 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-xl font-serif text-on-surface">
              Statutory 48-Hour Notice Generator
            </h3>
            <p className="text-xs text-on-surface-variant">
              Enforcing the U.S. TAKE IT DOWN Act (48-hour federal removal mandate)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Target Platform Type
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2 rounded-lg text-xs border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="Public Forum">Public Forum / Imageboard</option>
              <option value="Cloud Host">Cloud Host / Direct File Locker</option>
              <option value="Discord Server">Discord / Messaging Community</option>
              <option value="Microblog / Social">Social Network / Microblog</option>
              <option value="Search Index">Search Engine Preview Cache</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Incident Link / URL
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2 rounded-lg text-xs font-mono border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs font-semibold text-on-surface mb-1">
            Generated Statutory Cease-and-Desist
          </label>
          <pre className="p-4 rounded-xl bg-surface-container-low text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-on-surface border border-outline-variant/20 max-h-56 overflow-y-auto">
            {noticeText}
          </pre>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-container text-on-surface text-xs font-medium hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Copied to clipboard' : 'Copy statutory text'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-medium hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDispatch}
              disabled={dispatched}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-e2"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{dispatched ? 'Dispatching...' : 'Dispatch statutory notice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 2. Police Evidence Packet Modal */
export const PoliceEvidenceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-e3 border border-outline-variant/30 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-[22px]">local_police</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-xl font-serif text-on-surface">
              Forensic Law Enforcement Evidence Dossier
            </h3>
            <p className="text-xs text-on-surface-variant">
              Cryptographically timestamped packet for local detectives &amp; federal investigators
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-on-surface-variant">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20 font-medium text-on-surface">
              <span>Incident Case: #2904-B (Non-Consensual Imagery)</span>
              <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                Chain of Custody Verified
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-outline block">First Detected UTC:</span>
                <span className="font-mono text-on-surface">2026-09-25T11:42:09.102Z</span>
              </div>
              <div>
                <span className="text-outline block">Cryptographic SHA-256:</span>
                <span className="font-mono text-on-surface truncate block">
                  e3b0c44298fc1c149afbf4c8996fb924...
                </span>
              </div>
              <div>
                <span className="text-outline block">Target Host Origin:</span>
                <span className="font-mono text-on-surface">AS49201 Cloudflare Proxy Tier</span>
              </div>
              <div>
                <span className="text-outline block">Federal Penal Statute:</span>
                <span className="font-mono text-on-surface">18 U.S.C. § 2255 (Civil &amp; Criminal)</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-900 text-xs">
            <strong>Privacy Guarantee:</strong> This packet documents forensic metadata, headers,
            timestamps, and server IPs. In adherence with survivor protection standards, no explicit
            imagery is reproduced or stored in this document.
          </div>

          <div className="border border-outline-variant/20 rounded-xl p-4 space-y-2 bg-surface-container-lowest">
            <h5 className="font-semibold text-on-surface">What to do with this packet:</h5>
            <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
              <li>Take this printed packet or digital hash to your local precinct special victims unit.</li>
              <li>Ask the officer to cite <strong>18 U.S.C. § 2255</strong> and request an emergency preservation order under <strong>18 U.S.C. § 2703(f)</strong> to freeze server logs.</li>
              <li>Reclaim’s filing agent remains linked to cross-verify subpoena inquiries.</li>
            </ol>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-medium hover:bg-surface-container transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="px-6 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors flex items-center gap-1.5 cursor-pointer shadow-e2"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>{downloaded ? 'Dossier downloaded!' : 'Download forensic evidence packet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* 3. Helpline Modal */
export const HelplineModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-e3 border border-outline-variant/30 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-xl font-serif text-on-surface">
              24/7 Confidential Crisis Helplines
            </h3>
            <p className="text-xs text-on-surface-variant">
              Free, anonymous, and staffed by empathetic, trained specialists
            </p>
          </div>
        </div>

        <div className="space-y-3 my-4">
          {/* CCRI */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-on-surface text-sm">
                Cyber Civil Rights Initiative (CCRI)
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Specialized support for targets of nonconsensual intimate imagery and online abuse.
              </p>
            </div>
            <a
              href="tel:8448782274"
              className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors shrink-0 flex items-center gap-1 shadow-e1"
            >
              <span className="material-symbols-outlined text-[14px]">call</span>
              <span>1-844-878-2274</span>
            </a>
          </div>

          {/* Crisis Text Line */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-on-surface text-sm">Crisis Text Line</div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                24/7 free, confidential crisis counseling via text message.
              </p>
            </div>
            <a
              href="sms:741741?body=HOME"
              className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors shrink-0 flex items-center gap-1 border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[14px]">sms</span>
              <span>Text HOME to 741741</span>
            </a>
          </div>

          {/* RAINN */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-on-surface text-sm">
                RAINN National Sexual Assault Hotline
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Nationwide crisis and trauma support for survivors.
              </p>
            </div>
            <a
              href="tel:8006564673"
              className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors shrink-0 flex items-center gap-1 border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[14px]">call</span>
              <span>1-800-656-4673</span>
            </a>
          </div>
        </div>

        <div className="p-3 bg-secondary-container/30 rounded-xl text-xs text-secondary border border-secondary-container/50">
          <strong>Digital Safety Note:</strong> Phone calls to toll-free numbers may appear on
          itemized phone carrier bills. If this poses a domestic safety risk, use an encrypted web
          chat or borrow a trusted friend’s device.
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-medium hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* 4. Deepfake / Synthetic Media Restoration Modal */
export const DeepfakeRestoreModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [initiated, setInitiated] = useState(false);

  if (!isOpen) return null;

  const handleInitiate = () => {
    setInitiated(true);
    setTimeout(() => {
      setInitiated(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-e3 border border-outline-variant/30 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-[22px]">sync_saved_locally</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-xl font-serif text-on-surface">
              Put Original Back (Restore Engine)
            </h3>
            <p className="text-xs text-on-surface-variant">
              Deepfake purge, search de-listing, and authentic identity reinstatement
            </p>
          </div>
        </div>

        <div className="space-y-3 my-4 text-xs text-on-surface-variant">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <h5 className="font-semibold text-on-surface text-sm mb-1">
              Phase 1: Search Cache Nullification
            </h5>
            <p className="leading-relaxed">
              Dispatches automated removal petitions to Google Removals and Bing IndexNow to
              expunge thumbnail previews and snippet snippets immediately.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <h5 className="font-semibold text-on-surface text-sm mb-1">
              Phase 2: Archive Suppression
            </h5>
            <p className="leading-relaxed">
              Applies robots.txt exclusion requests and archival purge requests across historical
              web mirrors (Internet Archive Wayback Machine, archive.today).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <h5 className="font-semibold text-on-surface text-sm mb-1">
              Phase 3: Synthetic Media Invalidation
            </h5>
            <p className="leading-relaxed">
              Registers cryptographic perceptual hashes with major social media safety consortiums
              to prevent re-upload across automated upload filters.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-medium hover:bg-surface-container transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleInitiate}
            disabled={initiated}
            className="px-6 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors flex items-center gap-1.5 cursor-pointer shadow-e2"
          >
            <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
            <span>{initiated ? 'Sending restore request...' : 'Initiate Restore Sequence'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* 5. Notice Approval Modal for Case Tracker */
export const NoticeApprovalModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  caseItem: CaseItem | null;
  onConfirmApprove: (caseId: string) => void;
}> = ({ isOpen, onClose, caseItem, onConfirmApprove }) => {
  const [approving, setApproving] = useState(false);

  if (!isOpen || !caseItem) return null;

  const handleApprove = () => {
    setApproving(true);
    setTimeout(() => {
      onConfirmApprove(caseItem.id);
      setApproving(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-e3 border border-outline-variant/30 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-[22px]">verified_user</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-xl font-serif text-on-surface">
              Survivor Approval Required
            </h3>
            <p className="text-xs text-on-surface-variant">
              Confirm before Filing Agent delivers this statutory demand
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Target URL:</span>
            <span className="font-mono font-semibold text-on-surface">{caseItem.url}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Host Service:</span>
            <span className="text-on-surface font-medium">{caseItem.platformName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Statutory Authority:</span>
            <span className="text-primary font-medium">U.S. TAKE IT DOWN Act (48h Mandate)</span>
          </div>

          <div className="mt-3 pt-3 border-t border-outline-variant/20">
            <span className="font-semibold text-on-surface block mb-1">
              Notice Text to Dispatch:
            </span>
            <p className="p-2.5 rounded bg-surface-container-lowest font-mono text-[11px] leading-relaxed text-on-surface border border-outline-variant/20 whitespace-pre-wrap">
              {caseItem.targetNotice?.noticeText ||
                `Formal demand for immediate takedown under statutory 48-hour compliance mandate.`}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-medium hover:bg-surface-container transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="px-6 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors flex items-center gap-1.5 cursor-pointer shadow-e2"
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>{approving ? 'Delivering...' : 'Approve & Dispatch 48-Hour Notice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* 6. Add URL to Active Case Modal */
export const AddLinkModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, type: string) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [url, setUrl] = useState('');
  const [type, setType] = useState('Public Forum');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onAdd(url.trim(), type);
    setUrl('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-e3 border border-outline-variant/30 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h3 className="font-headline-sm text-lg font-serif text-on-surface mb-1">
          Add Incident Link to Case #2904-B
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Our agents will analyze host infrastructure and prepare a statutory removal notice.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Link or Forum Thread URL
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. forum-upload.is/post/9012"
              className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl text-xs font-mono border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Platform Category
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2 rounded-xl text-xs border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="Public Forum">Public Forum</option>
              <option value="Cloud Host">Cloud Host</option>
              <option value="Microblog">Microblog</option>
              <option value="Discord Server">Discord / Messaging</option>
              <option value="Search Index">Search Engine Preview</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-outline-variant/30 text-xs font-medium hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors cursor-pointer shadow-e1"
            >
              Add to Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 7. Comprehensive Legal & Guide Modal */
export const GuideModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  content: {
    heading: string;
    text: string;
  }[];
}> = ({ isOpen, onClose, title, subtitle, content }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-e3 border border-outline-variant/30 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h3 className="font-headline-sm text-2xl font-serif text-on-surface mb-1">
          {title}
        </h3>
        <p className="text-xs text-on-surface-variant mb-6">{subtitle}</p>

        <div className="space-y-5 text-sm text-on-surface-variant leading-relaxed">
          {content.map((sec, i) => (
            <div key={i} className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
              <h5 className="font-semibold text-on-surface mb-2 font-serif text-base">
                {sec.heading}
              </h5>
              <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed">
                {sec.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-colors cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
