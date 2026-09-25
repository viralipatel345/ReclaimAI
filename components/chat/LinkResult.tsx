"use client";
// Reclaim's reply to a pasted link. Reads the live link from the case so it updates as the
// resolver finishes (directory match is instant; unknown hosts go to /api/resolve).
import { ChannelTag, PlatformPill } from "@/components/ui";
import type { CaseLink } from "@/lib/types";
import styles from "./chat.module.css";

function channelWord(channel: CaseLink["platform"]["channel"]): string {
  return channel === "email" ? "email" : "a web form";
}

export function linkResultText(link: CaseLink, checking: boolean): string {
  const p = link.platform;
  if (link.kind === "name_search") {
    return "Added a request to Google for results about your name. Google handles this under its own policy, through a web form, so the 48-hour rule does not apply to it.";
  }
  if (checking) {
    return `Looking up ${link.host}. Only the site name goes to Google Search, never your link.`;
  }
  if (p.source === "unresolved") {
    return `I couldn't confirm a removal channel for ${link.host}. I'll still draft the request, and you can send it through the site's contact page. The 48-hour rule applies to them too.`;
  }
  if (p.source === "search") {
    return `That's ${p.name}. I found their removal channel with Google Search, using only the site name. They take requests by ${channelWord(p.channel)}, and the law gives them 48 hours.`;
  }
  const covered = p.coveredByAct ? "It's covered by the TAKE IT DOWN Act, so they have 48 hours from your request." : "It handles removals under its own policy.";
  return `That's ${p.name}. ${covered} They take requests by ${channelWord(p.channel)}.`;
}

export function LinkResult({ link, checking, first, last }: { link: CaseLink; checking: boolean; first: boolean; last: boolean }) {
  const corners = `${first ? "" : styles.inNotFirst} ${last ? styles.tailIn : styles.inNotLast}`;
  return (
    <div className={`${styles.bubble} ${styles.in} ${corners}`}>
      <p>{linkResultText(link, checking)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PlatformPill platform={link.platform} checking={checking} />
        {!checking && <ChannelTag channel={link.platform.channel} />}
      </div>
      {checking && (
        <span className={`${styles.dots} mt-1`} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </span>
      )}
    </div>
  );
}
