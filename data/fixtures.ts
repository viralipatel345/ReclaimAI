// Mock page fixtures for demo mode. Rechecks in demo mode read these instead of
// making network calls to the (fictional) seed URLs. Text only — no media.

export interface PageFixture {
  title: string;
  /** Plain-text page content as a server fetch would see it after stripping media. */
  text: string;
}

export const DEMO_URLS = {
  reddit: "https://www.reddit.com/r/exampleforum/comments/q7k2p9/example_post/",
  x: "https://x.com/example_account/status/1839201934817729000",
  imgvault: "https://imgvault.example/v/a7Qx2Lm9",
  google: 'https://www.google.com/search?q=%22Jordan%20Ellis%22',
  /** Appears after "Fast-forward 3 days": the same content re-uploaded on X. */
  xReupload: "https://x.com/example_account2/status/1841007265530118000",
  /** Appears after "Fast-forward 3 days" as a new Google result for her name (needs confirmation). */
  nameResult: "https://imgvault.example/v/k9Pw2Qz",
} as const;

export const PAGE_FIXTURES: Record<string, { live: PageFixture; removed: PageFixture }> = {
  [DEMO_URLS.reddit]: {
    live: { title: "example_post : r/exampleforum", text: "Posted by u/example_user · 14 comments" },
    removed: { title: "r/exampleforum", text: "Sorry, this post was removed by Reddit's safety filters." },
  },
  [DEMO_URLS.x]: {
    live: { title: "example_account on X", text: "Post · 2.1K views" },
    removed: { title: "X", text: "This post is unavailable. This post violated the X Rules." },
  },
  [DEMO_URLS.imgvault]: {
    live: { title: "ImgVault — a7Qx2Lm9", text: "Uploaded anonymously · 312 views" },
    removed: { title: "ImgVault — Not found", text: "This file has been removed." },
  },
  [DEMO_URLS.google]: {
    live: { title: "\"Jordan Ellis\" - Google Search", text: "About 3 results" },
    removed: { title: "\"Jordan Ellis\" - Google Search", text: "Some results may have been removed" },
  },
  [DEMO_URLS.nameResult]: {
    live: { title: "ImgVault — k9Pw2Qz", text: "Uploaded anonymously · 41 views" },
    removed: { title: "ImgVault — Not found", text: "This file has been removed." },
  },
  [DEMO_URLS.xReupload]: {
    live: { title: "example_account2 on X", text: "Post · 88 views" },
    removed: { title: "X", text: "This post is unavailable." },
  },
};

export function fixtureTitle(url: string): string {
  return PAGE_FIXTURES[url]?.live.title ?? url;
}
