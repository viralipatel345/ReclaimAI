"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addLink } from "@/lib/caseOps";
import type { IntakeTurnResult } from "@/lib/intake";
import { discardCase, updateCase } from "@/lib/useCase";
import type { Case, ChatMessage } from "@/lib/types";
import { Icon } from "./Icon";
import { card } from "./ui";

export function IntakeChat({ c }: { c: Case }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [c.chat.length, busy]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = { role: "user", text, at: new Date().toISOString() };
    const messages = [...c.chat, userMsg];
    setDraft("");
    setBusy(true);
    setNotice(null);
    updateCase((x) => ({ ...x, chat: [...x.chat, userMsg] }));

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          state: {
            legalName: c.legalName,
            contactEmail: c.contactEmail,
            isAdult: c.isAdult,
            autoSendConsent: c.autoSendConsent,
            links: c.links.map((l) => l.url),
            attestation: { signature: c.attestation.signature },
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const result = (await res.json()) as IntakeTurnResult;

      if (result.route === "under18") {
        discardCase();
        router.replace("/help/under-18");
        return;
      }
      const intake = result.intake!;
      const at = new Date().toISOString();
      updateCase((x) => {
        let next: Case = {
          ...x,
          legalName: intake.legalName || x.legalName,
          contactEmail: intake.contactEmail || x.contactEmail,
          attestation: { ...x.attestation, signature: x.attestation.signature || intake.attestation.signature },
          chat: [...x.chat, { role: "agent", text: result.reply, at }],
        };
        for (const url of intake.links) next = addLink(next, url, at);
        return next;
      });
      if (result.source === "fallback") setNotice("Gemini is unavailable right now, so I’m using a simpler guided mode.");
    } catch {
      setNotice("I couldn’t reach the assistant. You can still add links and sign below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} flex h-[520px] flex-col`} aria-label="Intake conversation">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="sparkle" size={16} />
          </span>
          <div>
            <p className="text-sm font-medium">Reclaim assistant</p>
            <p className="text-xs text-muted">Powered by Gemini · never asks what images show</p>
          </div>
        </div>
      </header>
      <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5" aria-live="polite">
        {c.chat.map((m, i) => (
          <li key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
            <p
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-md bg-accent text-white" : "rounded-tl-md bg-ground text-ink"}`}
            >
              {m.text}
            </p>
          </li>
        ))}
        {busy && (
          <li className="flex">
            <p className="flex gap-1 rounded-2xl rounded-tl-md bg-ground px-4 py-3.5" aria-label="Assistant is typing">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </p>
          </li>
        )}
      </ol>
      {notice && <p className="border-t border-line bg-ground px-5 py-2 text-xs text-muted">{notice}</p>}
      <form className="flex gap-2 border-t border-line p-3" onSubmit={send}>
        <label htmlFor="chat-input" className="sr-only">Reply to the assistant</label>
        <input
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a reply or paste a link…"
          autoComplete="off"
          maxLength={2000}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-[16px] md:text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button disabled={busy || !draft.trim()} className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-40" aria-label="Send">
          <Icon name="send" size={16} />
        </button>
      </form>
    </section>
  );
}
