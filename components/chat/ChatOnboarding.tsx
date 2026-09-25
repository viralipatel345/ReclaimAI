"use client";
// iMessage-style onboarding. One thread collects the same things the form on /case does,
// through the same functions, into the same Case: age gate, links, name, email, optional
// Gmail, the ID check, and the signed attestation. Then it drafts and lands on /case/requests.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { GmailConnect } from "@/components/GmailConnect";
import { IdentityVerifier } from "@/components/IdentityVerifier";
import { useAppConfig, useDemoMode } from "@/components/Providers";
import { chooseAge, UNDER_18_ROUTE } from "@/lib/ageGate";
import { addLink, draftRequests } from "@/lib/caseOps";
import { NCMEC_TAKE_IT_DOWN_URL } from "@/lib/config";
import { gmailSession } from "@/lib/google";
import { nameSearchUrl, normalizeUrl } from "@/lib/platforms";
import { ATTESTATION_TEXT } from "@/lib/templates";
import { getCase, resetDemo, startBlankCase, updateCase, useCase } from "@/lib/useCase";
import { useResolveLinks } from "@/lib/useResolve";
import { AttestationCard } from "./AttestationCard";
import { Appear, Bubble, CardBubble, ChatHeader, Composer, DayDivider, QuickReplies, TypingBubble, type ComposerMode, type QuickReply, type Sender } from "./ChatUI";
import { LinkResult } from "./LinkResult";

type Step = "boot" | "age" | "link" | "linkMenu" | "name" | "email" | "gmail" | "identity" | "attest" | "drafting" | "leaving";

type MsgInput =
  | { from: Sender; kind: "text"; text: string; italic?: boolean }
  | { from: "ai"; kind: "link"; linkId: string }
  | { from: "ai"; kind: "gmail" }
  | { from: "ai"; kind: "identity" }
  | { from: "ai"; kind: "attest" }
  | { from: "ai"; kind: "minor" };
type Msg = MsgInput & { id: number };

type AiItem = string | { kind: "link"; linkId: string } | { kind: "gmail" } | { kind: "identity" } | { kind: "attest" } | { kind: "minor" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Landing "How it works" links pass ?next=<step>. Only /case screens, only after the 18+ check.
const NEXT_RE = /^\/case(\/[a-z]+)?(#[a-z]+)?$/;
const CCRI_HELPLINE = "1-844-878-2274";

const CHIP = {
  adult: { id: "adult", label: "18 or older" },
  minor: { id: "minor", label: "Under 18" },
  demo: { id: "demo", label: "Try the demo" },
  nolink: { id: "nolink", label: "I don't have a link" },
  another: { id: "another", label: "Add another link" },
  done: { id: "done", label: "That's all" },
  search: { id: "search", label: "Also search my name" },
  skip: { id: "skip", label: "Skip" },
} satisfies Record<string, QuickReply>;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// False during SSR and hydration, true once the client has taken over (no setState needed).
const noop = () => () => {};
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function ChatOnboarding() {
  const router = useRouter();
  const demo = useDemoMode();
  const { googleClientId } = useAppConfig();
  const c = useCase();
  const checking = useResolveLinks(c);
  const reduced = useReducedMotion();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStepState] = useState<Step>("boot");
  const [quick, setQuick] = useState<QuickReply[]>([]);
  const [draft, setDraft] = useState("");
  const [openedAt] = useState(() => new Date());
  const hydrated = useHydrated();
  const [attested, setAttested] = useState(false);
  const [signed, setSigned] = useState(false);

  // Refs for values read inside async work and callbacks handed to embedded cards.
  const stepRef = useRef<Step>("boot");
  const idVerified = useRef(false);
  const attestedRef = useRef(false);
  const wantsNameSearch = useRef(false);
  const awaitingResolve = useRef(false);
  const reducedRef = useRef(false);
  const checkingRef = useRef(checking);
  const alive = useRef(true);
  const started = useRef(false);
  const nextId = useRef(1);
  const pending = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const draftNow = useRef<() => void>(() => {});

  const setStep = (s: Step) => {
    stepRef.current = s;
    setStepState(s);
  };

  const push = useCallback((m: MsgInput) => {
    setMsgs((xs) => [...xs, { ...m, id: nextId.current++ }]);
  }, []);

  /** Her reply. Clears the chips so nothing can be tapped twice. */
  const me = (text: string, italic = false) => {
    setQuick([]);
    push({ from: "me", kind: "text", text, italic });
  };

  /**
   * Reclaim speaks: typing dots for a beat, then the bubble. Batches queue up, so a card
   * finishing while Reclaim is mid-sentence never interleaves.
   */
  const say = useCallback(
    (items: AiItem[], after?: { step?: Step; quick?: QuickReply[]; then?: () => void }) => {
      pending.current++;
      setBusy(true);
      const run = async () => {
        for (const it of items) {
          setTyping(true);
          const len = typeof it === "string" ? it.length : 80;
          await sleep(reducedRef.current ? 120 : Math.min(900, 600 + len * 2));
          if (!alive.current) return;
          setTyping(false);
          if (typeof it === "string") push({ from: "ai", kind: "text", text: it });
          else push({ from: "ai", ...it });
          await sleep(reducedRef.current ? 0 : 260);
          if (!alive.current) return;
        }
        if (after?.step) setStep(after.step);
        setQuick(after?.quick ?? []);
        pending.current -= 1;
        if (pending.current === 0) setBusy(false);
        after?.then?.();
      };
      chain.current = chain.current.then(run, run);
      return chain.current;
    },
    [push],
  );

  // Flow

  const nextParam = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && NEXT_RE.test(n) ? n : null;
  };
  const hasNameSearch = () => !!getCase()?.links.some((l) => l.kind === "name_search");
  const ageChips = (): QuickReply[] => [CHIP.adult, CHIP.minor, ...(demo ? [CHIP.demo] : [])];
  const chipsFor = (s: Step): QuickReply[] => {
    const links = getCase()?.links.length ?? 0;
    if (s === "age") return ageChips();
    if (s === "link") return links ? [CHIP.done] : [CHIP.nolink];
    if (s === "linkMenu") return [CHIP.another, CHIP.done, ...(hasNameSearch() ? [] : [CHIP.search])];
    if (s === "gmail") return [CHIP.skip];
    return [];
  };

  const greet = () =>
    say(
      [
        "Hi, I'm Reclaim. I help adults get intimate images and deepfakes of them taken down.",
        "By law, platforms have 48 hours to act on a valid request. I draft the request, track the clock, and escalate to the FTC if they miss it.",
        "I only ever work with links. I never see, store, or ask about the images themselves.",
        "First, are you 18 or older?",
      ],
      { step: "age", quick: ageChips() },
    );

  const onAge = (id: string) => {
    if (id === "minor") {
      me(CHIP.minor.label);
      chooseAge("minor"); // discards everything, in memory and on disk
      say(["Thank you for telling me. Reclaim is only for adults, but there is a free service made just for you.", { kind: "minor" }], {
        step: "leaving",
        then: () => setTimeout(() => router.push(UNDER_18_ROUTE), reducedRef.current ? 1200 : 5000),
      });
      return;
    }
    if (id === "demo") {
      me(CHIP.demo.label);
      resetDemo();
      say(["Opening the example case. Every name, account and link in it is fictional."], {
        step: "leaving",
        then: () => router.push(nextParam() ?? "/case?auto=1"),
      });
      return;
    }
    me(CHIP.adult.label);
    chooseAge("adult");
    const next = nextParam();
    if (next) {
      say(["Thank you. Taking you there."], { step: "leaving", then: () => router.push(next) });
      return;
    }
    let cur = getCase();
    // In demo mode the example case is what exists; a real walk-through starts clean.
    if (!cur || cur.isDemo) {
      startBlankCase();
      cur = getCase();
    }
    if (cur && (cur.links.length > 0 || cur.legalName.trim() || cur.contactEmail.trim())) {
      const items: AiItem[] = ["Welcome back. I kept what you entered last time."];
      if (cur.links.length) {
        items.push(cur.links.length === 1 ? "Your link:" : "Your links:");
        for (const l of cur.links) items.push({ kind: "link", linkId: l.id });
        items.push("Anything to add?");
        say(items, { step: "linkMenu", then: () => setQuick(chipsFor("linkMenu")) });
      } else {
        say(items, { then: askFirstLink });
      }
      return;
    }
    askFirstLink();
  };

  const askFirstLink = () =>
    say(["Paste the first link. Copy it from the address bar, or use the share button on the post."], { step: "link", quick: [CHIP.nolink] });

  const onLinkSent = (raw: string) => {
    const url = normalizeUrl(raw);
    const s = stepRef.current === "linkMenu" ? "linkMenu" : "link";
    if (!url) {
      me(raw.trim());
      say(["That doesn't look like a web link. Try copying it from the address bar and sending it again."], { step: s, quick: chipsFor(s) });
      return;
    }
    me(url.replace(/^https?:\/\/(www\.)?/, ""));
    updateCase((x) => addLink(x, url, new Date().toISOString()));
    const link = getCase()?.links.find((l) => l.url === url);
    if (!link) {
      say(["I couldn't save that link. Try sending it again."], { step: s, quick: chipsFor(s) });
      return;
    }
    say([{ kind: "link", linkId: link.id }], { step: "linkMenu", then: () => setQuick(chipsFor("linkMenu")) });
  };

  const onLinkMenu = (id: string) => {
    if (id === "another") {
      me(CHIP.another.label);
      say(["Paste the next link."], { step: "link", quick: chipsFor("link") });
      return;
    }
    if (id === "search") {
      me(CHIP.search.label);
      wantsNameSearch.current = true;
      say(["Good idea. Once I have your name, I'll add a request to Google to remove explicit results for it."], { then: afterLinks });
      return;
    }
    if (id === "nolink") {
      me(CHIP.nolink.label);
      wantsNameSearch.current = true;
      say(["That's okay. I can ask Google to remove explicit results for your name instead. I'll set that up once I have it."], { then: afterLinks });
      return;
    }
    me(CHIP.done.label);
    afterLinks();
  };

  const afterLinks = () => {
    const cur = getCase();
    if (cur && cur.legalName.trim().length >= 2) afterName();
    else askName();
  };

  const askName = () => say(["What's your full name, as it appears on your ID?"], { step: "name" });

  const onName = (raw: string) => {
    const name = raw.trim().replace(/\s+/g, " ");
    me(name);
    if (name.length < 2) {
      say(["I need your full name, first and last, as it appears on your ID."], { step: "name" });
      return;
    }
    updateCase((x) => ({ ...x, legalName: name }));
    afterName();
  };

  const afterName = () => {
    const cur = getCase();
    if (!cur) return;
    if (wantsNameSearch.current && !cur.links.some((l) => l.kind === "name_search")) {
      updateCase((x) => addLink(x, nameSearchUrl(x.legalName), new Date().toISOString()));
      const l = getCase()?.links.find((x) => x.kind === "name_search");
      if (l) {
        say([{ kind: "link", linkId: l.id }], { then: askEmail });
        return;
      }
    }
    if (cur.links.length === 0) {
      say(["I still need at least one link. Or I can search your name on Google instead."], { step: "link", quick: [CHIP.nolink] });
      return;
    }
    askEmail();
  };

  const askEmail = () => {
    const cur = getCase();
    if (cur && EMAIL_RE.test(cur.contactEmail)) {
      afterEmail();
      return;
    }
    say(["Where should platforms reply? Type an email. A new address just for this is fine."], { step: "email" });
  };

  const onEmail = (raw: string) => {
    const email = raw.trim();
    me(email);
    if (!EMAIL_RE.test(email)) {
      say(["That email doesn't look complete. Check it and send it again."], { step: "email" });
      return;
    }
    updateCase((x) => ({ ...x, contactEmail: email }));
    afterEmail();
  };

  const afterEmail = () => {
    if (googleClientId && !gmailSession()) askGmail();
    else askIdentity();
  };

  const askGmail = () =>
    say(
      [
        "Optional: sign in with Google and your requests go out from your own Gmail, so replies land in your inbox. Reclaim reads only those replies, and the sign-in stays in this tab.",
        { kind: "gmail" },
      ],
      { step: "gmail", quick: [CHIP.skip] },
    );

  const onGmailConnected = (email: string) => {
    updateCase((x) => ({ ...x, contactEmail: email }));
    if (stepRef.current !== "gmail") return;
    setQuick([]);
    say([`Connected. Replies will go to ${email}.`], { then: askIdentity });
  };

  const onGmailSkip = () => {
    me(CHIP.skip.label);
    askIdentity();
  };

  const askIdentity = () =>
    say(
      [
        "One more thing, and it protects you. Upload a government ID so no one can ever use Reclaim against you. I check that the name matches yours and keep nothing else.",
        { kind: "identity" },
      ],
      { step: "identity" },
    );

  const onVerified = (ok: boolean) => {
    idVerified.current = ok;
    if (!ok || stepRef.current !== "identity") return;
    const first = getCase()?.legalName.trim().split(/\s+/)[0];
    const sig = getCase()?.attestation.signature.trim() ?? "";
    say([`Verified. Thank you${first ? `, ${first}` : ""}.`], {
      // Coming back here after a failed draft: the statement is already signed, so draft.
      then: () => (attestedRef.current && sig.length >= 2 ? tryDraft() : askAttest()),
    });
  };

  const askAttest = () =>
    say(["Last step. Read this and sign it. It goes on every request, and nothing is sent without it.", { kind: "attest" }], { step: "attest" });

  const onSign = () => {
    const sig = getCase()?.attestation.signature.trim() ?? "";
    if (!attestedRef.current || sig.length < 2) return;
    setSigned(true);
    me(`/s/ ${sig}`, true);
    tryDraft();
  };

  /** The same gate as "Draft my requests" on /case. Anything missing sends her back to that step. */
  const tryDraft = () => {
    const cur = getCase();
    if (!cur) return;
    const sig = cur.attestation.signature.trim();
    const back = (s: Step, text: string, quickReplies: QuickReply[] = []) => {
      setSigned(false);
      say([text], { step: s, quick: quickReplies });
    };
    if (cur.links.length === 0) return back("link", "I need at least one link before I can draft anything.", chipsFor("link"));
    if (cur.legalName.trim().length < 2) return back("name", "I still need your full name, as it appears on your ID.");
    if (!EMAIL_RE.test(cur.contactEmail)) return back("email", "I still need an email platforms can reply to.");
    if (!idVerified.current) return back("identity", "I still need your ID check before I can draft. Upload it above and I'll carry on from here.");
    if (!attestedRef.current || sig.length < 2) return back("attest", "Tick the statement and type your name to sign, then I'll draft.");
    if (checkingRef.current.size > 0) {
      say(["Still finding the removal channel for one link. One moment."], {
        step: "drafting",
        then: () => {
          awaitingResolve.current = true;
        },
      });
      return;
    }
    doDraft();
  };

  // Drafting is instant: requests render from the fixed template, and the Requests page
  // streams Gemini's greetings into them as they arrive (same as /case).
  const doDraft = () =>
    say(["Drafting your requests…"], {
      step: "drafting",
      then: () => {
        const at = new Date().toISOString();
        updateCase((x) => {
          const next = { ...x, attestation: { text: ATTESTATION_TEXT, signature: x.attestation.signature.trim(), signedAt: at } };
          return { ...next, requests: draftRequests(next, at).map((r) => ({ ...r, openingSource: "pending" as const })) };
        });
        // A beat so the signature and "Drafting" bubbles register before the screen changes.
        setTimeout(() => router.push("/case/requests"), reducedRef.current ? 0 : 1100);
      },
    });

  // Effects

  // Mirror render-time values into refs for the async work and the cards' callbacks.
  useEffect(() => {
    reducedRef.current = !!reduced;
    checkingRef.current = checking;
    attestedRef.current = attested;
    draftNow.current = doDraft;
  });

  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      greet();
    }
    return () => {
      alive.current = false;
    };
    // greet only runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // She signed while a link was still being looked up: draft as soon as the resolver is done.
  useEffect(() => {
    if (awaitingResolve.current && checking.size === 0) {
      awaitingResolve.current = false;
      draftNow.current();
    }
  }, [checking]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [msgs, typing, quick, reduced]);

  useEffect(() => {
    if (!busy && (step === "link" || step === "linkMenu" || step === "name" || step === "email")) inputRef.current?.focus();
  }, [busy, step]);

  // Input

  const composer: { mode: ComposerMode; placeholder: string } = (() => {
    switch (step) {
      case "link":
        return { mode: "url", placeholder: "Paste a link" };
      case "linkMenu":
        return { mode: "url", placeholder: "Paste another link" };
      case "name":
        return { mode: "text", placeholder: "Your full name" };
      case "email":
        return { mode: "email", placeholder: "Email for replies" };
      case "gmail":
        return { mode: "off", placeholder: "Sign in above, or skip" };
      case "identity":
        return { mode: "off", placeholder: "Upload your ID above" };
      case "attest":
        return { mode: "off", placeholder: "Sign above" };
      case "age":
        return { mode: "off", placeholder: "Choose a reply above" };
      default:
        return { mode: "off", placeholder: "" };
    }
  })();

  const onSend = () => {
    if (busy) return;
    const v = draft;
    setDraft("");
    if (step === "link" || step === "linkMenu") onLinkSent(v);
    else if (step === "name") onName(v);
    else if (step === "email") onEmail(v);
  };

  const onPick = (id: string) => {
    if (busy) return;
    if (step === "age") onAge(id);
    else if (step === "link" || step === "linkMenu") onLinkMenu(id);
    else if (step === "gmail" && id === "skip") onGmailSkip();
  };

  // Thread

  // Cards break a group; text, link and hand-off bubbles from the same sender group together.
  const sameGroup = (a: Msg | undefined, b: Msg) => a !== undefined && a.from === b.from && (a.kind === "text" || a.kind === "link" || a.kind === "minor");
  const lastMeIndex = msgs.reduce((acc, m, i) => (m.from === "me" ? i : acc), -1);

  const rows = msgs.map((m, i) => {
    const first = !sameGroup(msgs[i - 1], m);
    const typingFollows = typing && m.from === "ai" && i === msgs.length - 1;
    const last = !sameGroup(msgs[i + 1], m) && !typingFollows;
    const gap = first ? "mt-2.5" : "mt-[3px]";

    let body: ReactNode = null;
    if (m.kind === "text") {
      body = (
        <Bubble from={m.from} first={first} last={last} italic={m.italic}>
          {m.text}
        </Bubble>
      );
    } else if (m.kind === "link") {
      const link = c?.links.find((l) => l.id === m.linkId);
      if (!link) return null;
      body = <LinkResult link={link} checking={checking.has(link.id)} first={first} last={last} />;
    } else if (m.kind === "minor") {
      body = (
        <Bubble from="ai" first={first} last={last}>
          <span className="block">
            Take It Down, run by NCMEC, removes images taken before you were 18 without you sending them to anyone. If you would rather talk to a person, the CCRI helpline is {CCRI_HELPLINE}.
          </span>
          <span className="mt-2 block">Nothing you entered here has been kept. Taking you there now.</span>
          <span className="mt-2.5 flex flex-wrap gap-2">
            <a href={NCMEC_TAKE_IT_DOWN_URL} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-[#E1261C] hover:bg-[#FDECEA]">
              Open Take It Down
            </a>
            <a href={`tel:${CCRI_HELPLINE.replace(/-/g, "")}`} className="rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-[#0E1116] hover:bg-[#FDECEA]">
              Call the helpline
            </a>
          </span>
        </Bubble>
      );
    } else if (m.kind === "gmail") {
      body = (
        <CardBubble label="Sign in with Google">
          <GmailConnect onConnected={onGmailConnected} />
        </CardBubble>
      );
    } else if (m.kind === "identity") {
      body = (
        <CardBubble label="Identity check">
          <div className="[&>div]:mt-0 [&>div]:border-0 [&>div]:p-0">
            <IdentityVerifier claimedName={c?.legalName ?? ""} onVerified={onVerified} />
          </div>
        </CardBubble>
      );
    } else if (m.kind === "attest") {
      body = (
        <CardBubble label="Sign your requests">
          <AttestationCard
            attested={attested}
            onAttested={setAttested}
            signature={c?.attestation.signature ?? ""}
            onSignature={(v) => updateCase((x) => ({ ...x, attestation: { ...x.attestation, signature: v } }))}
            onSign={onSign}
            signed={signed}
          />
        </CardBubble>
      );
    }

    return (
      <Appear key={m.id} from={m.from} className={gap}>
        {body}
        {i === lastMeIndex && <p className="mt-1 pr-1 text-[11px] font-medium text-[#6B7280]">Delivered</p>}
      </Appear>
    );
  });

  return (
    <div className="flex h-[100dvh] flex-col bg-[#F5F6F8] font-[var(--font-plus-jakarta),sans-serif] text-[#0E1116] md:py-5" style={{ "--chat-bg": "#fff" } as CSSProperties}>
      <div className="mx-auto flex h-full w-full max-w-[640px] min-h-0 flex-col overflow-hidden bg-white md:rounded-[36px] md:border md:border-black/[0.08] md:shadow-[0_30px_80px_-40px_rgba(14,17,22,0.35)]">
        <ChatHeader />
        <div ref={threadRef} role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">
          <DayDivider date={hydrated ? openedAt : null} />
          <div className="flex flex-col">
            {rows}
            <AnimatePresence initial={false}>
              {typing && (
                <Appear key="typing" from="ai" className="mt-2.5">
                  <TypingBubble />
                </Appear>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="shrink-0 border-t border-black/[0.06] bg-white pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
          <QuickReplies items={quick} onPick={onPick} disabled={busy} />
          <Composer ref={inputRef} mode={composer.mode} placeholder={composer.placeholder} value={draft} onChange={setDraft} onSend={onSend} disabled={busy || step === "leaving" || step === "drafting"} />
          <p className="mt-2 px-4 text-center text-[11px] text-[#9CA3AF]">Reclaim prepares requests you send. Not legal advice. Press Esc to leave instantly.</p>
        </div>
      </div>
    </div>
  );
}
