"use client";
// Live detection. An agent reads the TEXT of each post on the account that posted her
// content — the reported account's public feed (real mode) or the demo sandbox — and
// Gemini judges each post. Images are never opened. She confirms every match.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SANDBOX_ACCOUNT, sandboxAccountFor } from "@/data/sandbox";
import { Icon } from "@/components/Icon";
import { useDemoMode } from "@/components/Providers";
import { btnPrimary, card, Eyebrow, Loading } from "@/components/ui";
import { addDetectedLinks, detectContext, ruleLevel, ruleSignals, type Detection, type MatchLevel } from "@/lib/detect";
import { postJson } from "@/lib/api";
import { cachedDetection, CLIENT_PRO_TIMEOUT_MS } from "@/lib/demoCache";
import type { PostText } from "@/lib/detect";
import type { ScanResult } from "@/lib/feeds";
import { recordAi } from "@/lib/aiStatus";
import { updateCase, useCase } from "@/lib/useCase";
import type { Case } from "@/lib/types";

type LogLine = { t: number; text: string; tone?: "likely" | "possible" | "muted" | "done" };
type Verdict = "yes" | "no";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DWELL_MS = 1100;

type ScanPost = PostText & { kind?: string };

interface Source {
  kind: "sandbox" | "feed";
  title: string;
  url: string;
  posts: ScanPost[];
}

const SANDBOX_SOURCE: Source = { kind: "sandbox", title: `@${SANDBOX_ACCOUNT.handle}`, url: `https://www.instagram.com/${SANDBOX_ACCOUNT.handle}/`, posts: SANDBOX_ACCOUNT.posts };

export default function DetectPage() {
  const c = useCase();
  const demo = useDemoMode();
  if (c === undefined) return <Loading />;
  if (!c) return <p className="text-muted">No active case.</p>;
  if (demo) return <Detector c={c} source={SANDBOX_SOURCE} />;
  return <RealDetect c={c} />;
}

/** Real mode: the Instagram analyzer (sandbox account built around this case) or a real public feed. */
function RealDetect({ c }: { c: Case }) {
  const [mode, setMode] = useState<"instagram" | "feed">("instagram");
  const known = c.links.find((l) => l.kind === "content")?.url ?? "";
  const sandbox: Source = { ...SANDBOX_SOURCE, posts: sandboxAccountFor(c.legalName || "Jordan Ellis", known).posts };
  const tab = (m: typeof mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`rounded-full border px-3.5 py-1.5 text-sm ${mode === m ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="What to scan">
        {tab("instagram", "Instagram analyzer (sandbox)")}
        {tab("feed", "Real account's public feed")}
      </div>
      {mode === "instagram" ? <Detector key="ig" c={c} source={sandbox} /> : <FeedLoader key="feed" c={c} />}
    </div>
  );
}

/** Real mode: find a reported link whose account has a public feed, and read it. */
function FeedLoader({ c }: { c: Case }) {
  const [source, setSource] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const candidates = c.links.filter((l) => l.kind === "content");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      for (const l of candidates) {
        const res = await postJson<ScanResult>("/api/detect/scan", { url: l.url }, 25000);
        if (res?.posts.length) {
          const known = new Set(c.links.map((x) => x.url.replace(/\/$/, "")));
          const posts = res.posts.filter((p) => !known.has(p.url.replace(/\/$/, "")));
          setSource({ kind: "feed", title: res.account.title, url: res.account.url, posts });
          return;
        }
      }
      setFailed(true);
    })();
  }, [c.links, candidates]);
  if (failed)
    return (
      <div className={`${card} p-6`}>
        <h1 className="font-display text-2xl font-semibold">No public feed to scan</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          None of the accounts behind your links publish a feed Reclaim can read without logging in (Instagram and X don’t). Tumblr blogs and most blogs do.
        </p>
        <Link href="/case/requests" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <Icon name="arrow-left" size={14} /> Back to requests
        </Link>
      </div>
    );
  if (!source)
    return (
      <div className={`${card} flex items-center gap-3 p-6 text-muted`} role="status">
        <Icon name="search" size={18} className="anim-shimmer" /> Finding the public feed of the account that posted your link…
      </div>
    );
  return <Detector c={c} source={source} />;
}

/** Gemini via /api/detect; in demo only, the recorded verdict if the server is unreachable; then the rules. */
async function detectOne(post: ScanPost, c: Case, demo: boolean): Promise<Detection> {
  const ctx = detectContext(c);
  const live = await postJson<Detection>("/api/detect", { post: { id: post.id, url: post.url, caption: post.caption, comments: post.comments }, context: ctx }, CLIENT_PRO_TIMEOUT_MS);
  const cached = demo ? cachedDetection(post.id) : undefined;
  const d: Detection =
    live ??
    (cached ? { ...cached, source: "cached" } : null) ?? {
      postId: post.id,
      url: post.url,
      level: ruleLevel(ruleSignals(post, ctx)),
      signals: ruleSignals(post, ctx).map((s) => s.text),
      explanation: ruleSignals(post, ctx)[0]?.text ?? "Nothing in the text connects this post to you.",
      source: "rules",
    };
  return d;
}

function Detector({ c, source }: { c: Case; source: Source }) {
  const router = useRouter();
  const demo = useDemoMode();
  const posts = source.posts;
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
    const pending = posts.map((p) => detectOne(p, c, demo).catch(() => null));
    Promise.all(pending).then((all) => {
      const src = all.filter(Boolean).map((d) => d!.source);
      recordAi("Live detection", src.every((x) => x === "gemini") ? "live" : src.some((x) => x === "cached") ? "cached" : "template");
    });
    const found: Detection[] = [];
    if (source.kind === "sandbox") {
      say(`Opening @${SANDBOX_ACCOUNT.handle} on Instagram (sandbox)${demo ? " — same handle as the X account in your case" : ""}.`);
      await sleep(700);
      say("Images are skipped. Reading text only: bio, captions, comments.", "muted");
      await sleep(700);
      const known = demo ? c.links.find((l) => SANDBOX_ACCOUNT.bio.includes(l.url.replace(/^https?:\/\//, ""))) : c.links.find((l) => l.kind === "content");
      say(known ? `Bio links to ${known.host} — content already in your case.` : "Bio: no links to your case.", known ? "likely" : "muted");
    } else {
      say(`Reading the public feed of ${source.title} (${source.url.replace(/^https?:\/\//, "")}) — the account that posted your link.`);
      await sleep(600);
      say(`${posts.length} post${posts.length === 1 ? "" : "s"} found. Images are skipped; Gemini 3.1 Pro reads the text of each one.`, "muted");
      await sleep(600);
    }
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
  }, [c, posts, say, demo, source.kind, source.title, source.url]);

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
  const addToRequests = (picks: ScanPost[]) => {
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
        <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-label text-muted">
          {source.kind === "sandbox" ? "Sandbox · fictional account · synthetic data" : "Real account · public feed · text only"}
        </span>
      </div>
      <h1 className="mt-3 font-display text-display-m font-semibold leading-tight tracking-tight md:text-display-l">Looking for more copies.</h1>
      <p className="mt-2 max-w-[68ch] text-muted">
        Gemini reads every post on the account that posted your link — text only, never an image. Nothing is filed until you confirm.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        {source.kind === "sandbox" ? (
          <SandboxProfile cursor={cursor} results={results} verdicts={verdicts} />
        ) : (
          <FeedPanel source={source} cursor={cursor} results={results} verdicts={verdicts} />
        )}

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
                    <p className={`font-display text-display-l font-semibold leading-none ${x.cls}`}>{x.n}</p>
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
              <p className="flex items-center gap-2 font-mono text-label uppercase tracking-[0.14em] text-panel-muted">
                <span className={`h-2 w-2 rounded-full ${phase === "scanning" ? "animate-pulse bg-panel-removed" : "bg-panel-muted"}`} />
                {phase === "scanning" ? "Agent running · Gemini" : phase === "done" ? "Scan complete" : "Starting"}
              </p>
              {phase === "done" && (
                <button onClick={run} className="flex items-center gap-1.5 text-xs text-panel-muted hover:text-white">
                  <Icon name="refresh" size={13} /> Run again
                </button>
              )}
            </header>
            <ol ref={logRef} className={`mt-4 space-y-1.5 ${phase === "done" ? "h-[180px]" : "h-[380px]"} overflow-y-auto font-mono text-caption leading-relaxed`} aria-live="polite">
              {log.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-12 shrink-0 text-right text-panel-muted tabular">{l.t.toFixed(1)}s</span>
                  <span
                    className={
                      l.tone === "likely" ? "text-panel-overdue" : l.tone === "possible" ? "text-panel-accent" : l.tone === "muted" ? "text-panel-muted" : l.tone === "done" ? "text-panel-removed" : ""
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
                        <p className="mt-2 text-body">“{p.caption}”</p>
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
        <span className="font-mono text-label text-muted">instagram.com/{a.handle}</span>
        <span className="rounded bg-ground px-1.5 py-0.5 font-mono text-micro uppercase tracking-wider text-muted">Sandbox</span>
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
                <span className="text-micro uppercase tracking-wider">Not opened</span>
              </div>
              {p.kind !== "photo" && (
                <span className="absolute right-1.5 top-1.5 text-muted" aria-label={p.kind}>
                  <Icon name={p.kind === "reel" ? "sparkle" : "copy"} size={13} />
                </span>
              )}
              {scanning && (
                <span className="absolute inset-x-0 bottom-0 bg-accent py-1 text-center text-micro font-medium text-white">Reading text…</span>
              )}
              {d && d.level !== "unrelated" && !scanning && (
                <span
                  className={`absolute inset-x-1.5 bottom-1.5 rounded-md py-0.5 text-center text-micro font-semibold ${
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
      <p className="px-4 py-3 text-center text-label text-muted">Fictional account. Tiles are never opened — only text is read.</p>
    </section>
  );
}

/** Real account: its public feed as text rows. There are no images to show — none are ever fetched. */
function FeedPanel({ source, cursor, results, verdicts }: { source: Source; cursor: number; results: Record<string, Detection>; verdicts: Record<string, Verdict> }) {
  return (
    <section className={`${card} h-fit overflow-hidden`} aria-label={`Account ${source.title}`}>
      <header className="border-b border-line px-5 py-4">
        <p className="font-medium">{source.title}</p>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-muted underline decoration-line underline-offset-2">
          {source.url.replace(/^https?:\/\//, "")}
        </a>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="lock" size={12} /> Public feed, read as text. Images are never opened.
        </p>
      </header>
      <ol className="max-h-[560px] divide-y divide-line overflow-y-auto">
        {source.posts.map((p, i) => {
          const d = results[p.id];
          const v = verdicts[p.id];
          const scanning = cursor === i;
          return (
            <li key={p.id} className={`flex items-start gap-3 px-5 py-3 transition-colors ${scanning ? "bg-accent-soft" : ""} ${d?.level === "unrelated" ? "opacity-50" : ""}`}>
              <span className="mt-0.5 font-mono text-label text-muted">{String(i + 1).padStart(2, "0")}</span>
              <p className="line-clamp-2 min-w-0 flex-1 text-sm">{p.caption}</p>
              {scanning ? (
                <span className="shrink-0 text-label font-medium text-accent">Reading…</span>
              ) : d && d.level !== "unrelated" ? (
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-label font-semibold text-white ${v === "no" ? "bg-ink/70" : d.level === "likely" ? "bg-overdue-line" : "bg-accent"}`}>
                  {v === "yes" ? "Confirmed" : v === "no" ? "Not me" : d.level === "likely" ? "Likely" : "Possible"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
