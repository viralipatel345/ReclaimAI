"use client";
// Live detection (demo sandbox). An agent reads the TEXT of each post on the account that
// posted her content — caption and comments only. Image tiles are never opened.
// She confirms every match; confirmed posts become a drafted Instagram request.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SANDBOX_ACCOUNT, type SandboxPost } from "@/data/sandbox";
import { Icon } from "@/components/Icon";
import { useDemoMode } from "@/components/Providers";
import { btnPrimary, card, Eyebrow, Loading } from "@/components/ui";
import { addDetectedLinks, detectContext, ruleLevel, ruleSignals, type Detection, type MatchLevel } from "@/lib/detect";
import { postJson } from "@/lib/api";
import { cachedDetection } from "@/lib/demoCache";
import { recordAi } from "@/lib/aiStatus";
import { updateCase, useCase } from "@/lib/useCase";
import type { Case } from "@/lib/types";

type LogLine = { t: number; text: string; tone?: "likely" | "possible" | "muted" | "done" };
type Verdict = "yes" | "no";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DWELL_MS = 1100;

export default function DetectPage() {
  const c = useCase();
  const demo = useDemoMode();
  if (c === undefined) return <Loading />;
  if (!c) return <p className="text-muted">No active case.</p>;
  if (!demo)
    return (
      <div className={`${card} p-6`}>
        <p className="text-muted">Live detection runs in the demo sandbox only. Scanning real accounts would mean logging in to platforms, which Reclaim never does.</p>
      </div>
    );
  return <Detector c={c} />;
}

/** Live Gemini via /api/detect; if the server is unreachable, the recorded verdict, then the rules. */
async function detectOne(post: SandboxPost, c: Case): Promise<Detection> {
  const ctx = detectContext(c);
  const live = await postJson<Detection>("/api/detect", { post: { id: post.id, url: post.url, caption: post.caption, comments: post.comments }, context: ctx });
  const d: Detection =
    live ??
    (cachedDetection(post.id) ? { ...cachedDetection(post.id)!, source: "cached" } : null) ?? {
      postId: post.id,
      url: post.url,
      level: ruleLevel(ruleSignals(post, ctx)),
      signals: ruleSignals(post, ctx).map((s) => s.text),
      explanation: ruleSignals(post, ctx)[0]?.text ?? "Nothing in the text connects this post to you.",
      source: "rules",
    };
  return d;
}

function Detector({ c }: { c: Case }) {
  const router = useRouter();
  const posts = SANDBOX_ACCOUNT.posts;
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [cursor, setCursor] = useState(-1);
  const [results, setResults] = useState<Record<string, Detection>>({});
  const [log, setLog] = useState<LogLine[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [adding, setAdding] = useState(false);
  const started = useRef(false);
  const t0 = useRef(0);
  const logRef = useRef<HTMLOListElement>(null);

  const say = useCallback((text: string, tone?: LogLine["tone"]) => {
    setLog((l) => [...l, { t: (Date.now() - t0.current) / 1000, text, tone }]);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [log.length]);

  const run = useCallback(async () => {
    setPhase("scanning");
    setResults({});
    setVerdicts({});
    setLog([]);
    t0.current = Date.now();
    // Every post is classified in parallel; the scan reveals them in order.
    const pending = posts.map((p) => detectOne(p, c).catch(() => null));
    Promise.all(pending).then((all) => {
      const src = all.filter(Boolean).map((d) => d!.source);
      recordAi("Live detection", src.every((x) => x === "gemini") ? "live" : src.some((x) => x === "cached") ? "cached" : "template");
    });
    const found: Detection[] = [];
    say(`Opening @${SANDBOX_ACCOUNT.handle} on Instagram (sandbox) — same handle as the X account in your case.`);
    await sleep(700);
    say("Images are skipped. Reading text only: bio, captions, comments.", "muted");
    await sleep(700);
    const known = c.links.find((l) => SANDBOX_ACCOUNT.bio.includes(l.url.replace(/^https?:\/\//, "")));
    say(known ? `Bio links to ${known.host} — content already in your case.` : "Bio: no links to your case.", known ? "likely" : "muted");
    for (let i = 0; i < posts.length; i++) {
      setCursor(i);
      const p = posts[i];
      say(`Post ${i + 1}/${posts.length} · reading caption${p.comments.length ? ` + ${p.comments.length} comment${p.comments.length > 1 ? "s" : ""}` : ""}`);
      const [d] = await Promise.all([pending[i], sleep(DWELL_MS)]);
      if (d) {
        found.push(d);
        setResults((r) => ({ ...r, [p.id]: d }));
        say(d.level === "unrelated" ? "→ no match" : `→ ${d.level.toUpperCase()} — ${d.explanation}`, d.level === "unrelated" ? "muted" : d.level);
      } else say("→ couldn’t check this post", "muted");
    }
    setCursor(-1);
    setPhase("done");
    const n = (lvl: MatchLevel) => found.filter((d) => d.level === lvl).length;
    say(`Done in ${((Date.now() - t0.current) / 1000).toFixed(1)}s · ${n("likely")} likely · ${n("possible")} possible · ${n("unrelated")} unrelated.`, "done");
    say("Nothing is filed until you confirm.", "muted");
  }, [c, posts, say]);

  // Auto-start once. The flag is set when the scan actually starts, so React's dev-mode
  // double mount (which clears the first timer) still starts exactly one scan.
  useEffect(() => {
    if (started.current) return;
    const t = setTimeout(() => {
      started.current = true;
      run();
    }, 500);
    return () => clearTimeout(t);
  }, [run]);

  const flagged = posts
    .map((p) => ({ p, d: results[p.id] }))
    .filter((x) => x.d && x.d.level !== "unrelated")
    .sort((a, b) => (a.d!.level === b.d!.level ? 0 : a.d!.level === "likely" ? -1 : 1));
  const confirmed = flagged.filter((x) => verdicts[x.p.id] === "yes");

  /** Confirm `picks` (she chose them) and draft them as one request; Gemini's greeting streams in on Requests. */
  const addToRequests = (picks: SandboxPost[]) => {
    if (adding || !picks.length) return;
    setAdding(true);
    const at = new Date().toISOString();
    updateCase((x) => {
      const { next, requests } = addDetectedLinks(x, picks.map((p) => ({ url: p.url, caption: p.caption })), at);
      const ids = new Set(requests.map((r) => r.id));
      return { ...next, requests: next.requests.map((r) => (ids.has(r.id) ? { ...r, openingSource: "pending" as const } : r)) };
    });
    router.push("/case/requests");
  };
  const likelyPosts = flagged.filter((x) => x.d!.level === "likely").map((x) => x.p);
  const extraConfirmed = confirmed.filter((x) => x.d!.level !== "likely").map((x) => x.p);
  const counts = { likely: likelyPosts.length, possible: flagged.length - likelyPosts.length, none: Object.values(results).filter((d) => d.level === "unrelated").length };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>Step 02 · Live detection</Eyebrow>
        <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] text-muted">Sandbox · fictional account · synthetic data</span>
      </div>
      <h1 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-tight md:text-[44px]">Looking for more copies.</h1>
      <p className="mt-2 max-w-[68ch] text-muted">
        An agent checks the account that posted your X link for more posts of you. It reads captions and comments only — it never opens an image — and nothing is filed until you confirm.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <SandboxProfile cursor={cursor} results={results} verdicts={verdicts} />

        <div className="space-y-6">
          {phase === "done" && (
            <section className={`${card} anim-rise p-5`} aria-labelledby="result-title">
              <h2 id="result-title" className="sr-only">Scan results</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { n: counts.likely, label: "likely", cls: "text-overdue" },
                  { n: counts.possible, label: "possible", cls: "text-accent" },
                  { n: counts.none, label: "no match", cls: "text-muted" },
                ].map((x) => (
                  <div key={x.label}>
                    <p className={`font-display text-[44px] font-semibold leading-none ${x.cls}`}>{x.n}</p>
                    <p className="mt-1 text-sm text-muted">{x.label}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => addToRequests([...likelyPosts, ...extraConfirmed])} disabled={!likelyPosts.length || adding} className={`${btnPrimary} mt-5 w-full`}>
                <Icon name="plus" size={17} /> {adding ? "Adding…" : `Add ${likelyPosts.length + extraConfirmed.length} ${extraConfirmed.length ? "" : "likely "}matches to my requests`}
              </button>
              <p className="mt-2 text-center text-xs text-muted">Only posts you add are filed. Review the {counts.possible} possible below.</p>
            </section>
          )}
          <section className="rounded-2xl bg-panel p-5 text-white" aria-label="Agent log">
            <header className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-panel-muted">
                <span className={`h-2 w-2 rounded-full ${phase === "scanning" ? "animate-pulse bg-[#6FC39D]" : "bg-panel-muted"}`} />
                {phase === "scanning" ? "Agent running · Gemini" : phase === "done" ? "Scan complete" : "Starting"}
              </p>
              {phase === "done" && (
                <button onClick={run} className="flex items-center gap-1.5 text-xs text-panel-muted hover:text-white">
                  <Icon name="refresh" size={13} /> Run again
                </button>
              )}
            </header>
            <ol ref={logRef} className={`mt-4 space-y-1.5 ${phase === "done" ? "h-[180px]" : "h-[380px]"} overflow-y-auto font-mono text-[12.5px] leading-relaxed`} aria-live="polite">
              {log.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-12 shrink-0 text-right text-panel-muted tabular">{l.t.toFixed(1)}s</span>
                  <span
                    className={
                      l.tone === "likely" ? "text-[#F3A6A0]" : l.tone === "possible" ? "text-[#AEB8F0]" : l.tone === "muted" ? "text-panel-muted" : l.tone === "done" ? "text-[#6FC39D]" : ""
                    }
                  >
                    {l.text}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {phase === "done" && (
            <section className={`${card} p-5`} aria-labelledby="matches">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="matches" className="font-display text-xl font-semibold">
                  Review each post
                </h2>
              </div>
              <ul className="mt-4 divide-y divide-line">
                {flagged.map(({ p, d }) => (
                  <li key={p.id} className="py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <LevelPill level={d!.level} />
                          <span className="truncate font-mono text-xs text-muted">{p.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        </div>
                        <p className="mt-2 text-[15px]">“{p.caption}”</p>
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                          <Icon name="sparkle" size={13} className="mt-1" /> {d!.explanation}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2" role="group" aria-label="Is this you?">
                        <button
                          onClick={() => setVerdicts((v) => ({ ...v, [p.id]: "yes" }))}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${verdicts[p.id] === "yes" ? "border-accent bg-accent text-white" : "border-line hover:border-ink/40"}`}
                        >
                          Yes, it’s me
                        </button>
                        <button
                          onClick={() => setVerdicts((v) => ({ ...v, [p.id]: "no" }))}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${verdicts[p.id] === "no" ? "border-ink bg-ink text-white" : "border-line hover:border-ink/40"}`}
                        >
                          Not me
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted">Confirmed posts become one Instagram request. You’ll review it before anything is sent.</p>
                <button onClick={() => addToRequests(confirmed.map((x) => x.p))} disabled={!confirmed.length || adding} className={`${btnPrimary} shrink-0 whitespace-nowrap`}>
                  <Icon name="plus" size={17} /> {adding ? "Drafting…" : confirmed.length ? `Add ${confirmed.length} to my requests` : "Add to my requests"}
                </button>
              </div>
            </section>
          )}

          {phase === "done" && (
            <section className="rounded-2xl bg-accent-soft p-5">
              <p className="flex items-center gap-2 font-medium">
                <Icon name="shield-check" size={18} className="text-accent" /> Stop re-uploads before they happen
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Instagram and Facebook check <strong className="text-ink">StopNCII.org</strong> hashes. You create a hash of the image on your own device — the image never leaves it — and participating platforms can block matching uploads.
              </p>
              <a href="https://stopncii.org" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                Open StopNCII.org <Icon name="external" size={14} />
              </a>
            </section>
          )}
          <Link href="/case/requests" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <Icon name="arrow-left" size={14} /> Back to requests
          </Link>
        </div>
      </div>
    </div>
  );
}

function LevelPill({ level }: { level: MatchLevel }) {
  const cls = level === "likely" ? "bg-overdue-soft text-overdue" : level === "possible" ? "bg-accent-soft text-accent" : "bg-ground text-muted";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{level === "likely" ? "Likely" : level === "possible" ? "Possible" : "No match"}</span>;
}

function SandboxProfile({ cursor, results, verdicts }: { cursor: number; results: Record<string, Detection>; verdicts: Record<string, Verdict> }) {
  const a = SANDBOX_ACCOUNT;
  return (
    <section className="h-fit overflow-hidden rounded-[28px] border-[6px] border-ink bg-surface" aria-label={`Sandbox Instagram account @${a.handle}`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted">instagram.com/{a.handle}</span>
        <span className="rounded bg-ground px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">Sandbox</span>
      </div>
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-line bg-ground text-muted" aria-hidden="true">
          <Icon name="eye" size={20} />
        </div>
        <div className="flex flex-1 justify-around text-center text-sm">
          <div>
            <p className="font-semibold">{a.posts.length}</p>
            <p className="text-xs text-muted">posts</p>
          </div>
          <div>
            <p className="font-semibold">{a.followers.toLocaleString()}</p>
            <p className="text-xs text-muted">followers</p>
          </div>
          <div>
            <p className="font-semibold">{a.following}</p>
            <p className="text-xs text-muted">following</p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 text-sm">
        <p className="font-semibold">@{a.handle}</p>
        <p className="text-muted">{a.bio}</p>
      </div>
      <ul className="grid grid-cols-3 gap-0.5 bg-line">
        {a.posts.map((p, i) => {
          const d = results[p.id];
          const scanning = cursor === i;
          const v = verdicts[p.id];
          return (
            <li key={p.id} className={`relative aspect-square ${scanning ? "z-10 outline outline-[3px] -outline-offset-[3px] outline-accent" : ""}`}>
              <div className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-ground text-muted transition-opacity ${d?.level === "unrelated" ? "opacity-40" : ""}`}>
                <Icon name="lock" size={16} />
                <span className="text-[9px] uppercase tracking-wider">Not opened</span>
              </div>
              {p.kind !== "photo" && (
                <span className="absolute right-1.5 top-1.5 text-muted" aria-label={p.kind}>
                  <Icon name={p.kind === "reel" ? "sparkle" : "copy"} size={13} />
                </span>
              )}
              {scanning && (
                <span className="absolute inset-x-0 bottom-0 bg-accent py-1 text-center text-[10px] font-medium text-white">Reading text…</span>
              )}
              {d && d.level !== "unrelated" && !scanning && (
                <span
                  className={`absolute inset-x-1.5 bottom-1.5 rounded-md py-0.5 text-center text-[10px] font-semibold ${
                    v === "no" ? "bg-ink/70 text-white" : d.level === "likely" ? "bg-overdue-line text-white" : "bg-accent text-white"
                  }`}
                >
                  {v === "yes" ? "Confirmed" : v === "no" ? "Not me" : d.level === "likely" ? "Likely" : "Possible"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-4 py-3 text-center text-[11px] text-muted">Fictional account. Tiles are never opened — only text is read.</p>
    </section>
  );
}
