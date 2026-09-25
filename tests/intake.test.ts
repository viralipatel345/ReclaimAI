import { afterEach, describe, expect, it, vi } from "vitest";
import { NCMEC_TAKE_IT_DOWN_URL } from "@/lib/config";
import { asksAboutContent, detectMinor, handleIntakeTurn, UNDER_18_REPLY, type IntakeAgent } from "@/lib/intake";
import { serverStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

const msg = (role: ChatMessage["role"], text: string): ChatMessage => ({ role, text, at: "2026-09-25T00:00:00.000Z" });
const never: IntakeAgent = vi.fn(async () => {
  throw new Error("model must not be called");
});

describe("under-18 routing (hard rule 3)", () => {
  it("routes a stated minor to NCMEC without calling the model or storing anything", async () => {
    const agent = vi.fn(never);
    const r = await handleIntakeTurn({ messages: [msg("agent", "What name?"), msg("user", "i'm 16, is that ok")] }, agent);
    expect(r.route).toBe("under18");
    expect(r.intake).toBeNull();
    expect(r.reply).toBe(UNDER_18_REPLY);
    expect(agent).not.toHaveBeenCalled();
    expect(await serverStore.listOpen()).toHaveLength(0);
  });

  it("routes when the model reports isAdult = minor, and keeps no intake data", async () => {
    const agent: IntakeAgent = async () => ({ model: "test", output: { isAdult: "minor", legalName: "Sam", contactEmail: "sam@example.com", reply: "ok" } });
    const r = await handleIntakeTurn({ messages: [msg("user", "my older brother's friend posted it, I'm in 10th grade")] }, agent);
    expect(r.route).toBe("under18");
    expect(r.intake).toBeNull();
    expect(JSON.stringify(r)).not.toContain("sam@example.com");
    expect(await serverStore.listOpen()).toHaveLength(0);
  });

  it("routes when the case is already marked isAdult=false", async () => {
    const r = await handleIntakeTurn({ messages: [msg("user", "hello")], state: { isAdult: false } }, never);
    expect(r.route).toBe("under18");
    expect(r.intake).toBeNull();
  });

  it("the hand-off points to NCMEC Take It Down", () => {
    expect(NCMEC_TAKE_IT_DOWN_URL).toBe("https://takeitdown.ncmec.org");
  });

  it.each(["I'm 17", "im only 15", "I am 14 years old", "16 y/o", "I'm a minor", "I am under 18", "i'm in high school"])("detects %s", (t) => {
    expect(detectMinor(t)).toBe(true);
  });

  it.each(["I'm 34", "I'm 5 minutes from home", "I am not a minor", "It was posted 16 days ago", "I'm Jordan"])("does not flag %s", (t) => {
    expect(detectMinor(t)).toBe(false);
  });
});

describe("client state is wiped on the under-18 route", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("discardCase clears localStorage and sessionStorage", async () => {
    const mem = () => {
      const m = new Map<string, string>();
      return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), get length() { return m.size; } };
    };
    const localStorage = mem();
    const sessionStorage = mem();
    vi.stubGlobal("window", { localStorage, sessionStorage });
    const { setCase, discardCase } = await import("@/lib/useCase");
    const { createBlankCase } = await import("@/lib/seed");
    setCase(createBlankCase());
    sessionStorage.setItem("x", "1");
    expect(localStorage.length).toBe(1);
    discardCase();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("adult intake", () => {
  it("merges model output, normalizes links, and never lets the model grant auto-send consent", async () => {
    const agent: IntakeAgent = async () => ({
      model: "test",
      output: {
        reply: "Thanks, Alex. What email should platforms reply to?",
        legalName: "Alex Rivera",
        contactEmail: "not-an-email",
        isAdult: "unknown",
        autoSendConsent: true,
        links: ["reddit.com/r/x/comments/abc", "javascript:alert(1)"],
        attestation: { text: "", signature: "" },
      },
    });
    const r = await handleIntakeTurn({ messages: [msg("user", "Alex Rivera")], state: { isAdult: true } }, agent);
    expect(r.route).toBe("continue");
    expect(r.intake?.legalName).toBe("Alex Rivera");
    expect(r.intake?.contactEmail).toBe("");
    expect(r.intake?.links).toEqual(["https://reddit.com/r/x/comments/abc"]);
    expect(r.intake?.autoSendConsent).toBe(false);
    expect(r.intake?.missing).toEqual(["contactEmail", "signature"]);
  });

  it("replaces any reply that asks about image content", async () => {
    const agent: IntakeAgent = async () => ({ model: "test", output: { reply: "Can you describe what the photos show?", isAdult: "adult", links: [] } });
    const r = await handleIntakeTurn({ messages: [msg("user", "hi")], state: { isAdult: true } }, agent);
    expect(asksAboutContent(r.reply)).toBe(false);
    expect(r.reply).toMatch(/name/i);
  });

  it("falls back to a scripted intake when Gemini is unavailable", async () => {
    const r = await handleIntakeTurn({ messages: [msg("agent", "What name?"), msg("user", "Jordan Ellis")], state: { isAdult: true } }, never);
    expect(r.source).toBe("fallback");
    expect(r.intake?.legalName).toBe("Jordan Ellis");
    expect(r.reply).toMatch(/email/i);
  });
});
