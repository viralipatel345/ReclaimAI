// SANDBOX · FICTIONAL. A synthetic Instagram-style account used by the Live detection demo.
// There are no images anywhere in this file — posts carry only the text a page would show
// (caption, hashtags, comments). Every handle, name and URL is invented.

import { DEMO_URLS } from "./fixtures";

export type PostKind = "photo" | "reel" | "carousel";

export interface SandboxComment {
  user: string;
  text: string;
}

export interface SandboxPost {
  id: string;
  url: string;
  kind: PostKind;
  postedAt: string;
  caption: string;
  comments: SandboxComment[];
}

export interface SandboxAccount {
  platformId: "instagram";
  handle: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  posts: SandboxPost[];
}

const post = (id: string, kind: PostKind, postedAt: string, caption: string, comments: SandboxComment[] = []): SandboxPost => ({
  id,
  url: `https://www.instagram.com/p/${id}/`,
  kind,
  postedAt,
  caption,
  comments,
});

/** Same handle as the uploader of the X post in the demo case. */
export const SANDBOX_ACCOUNT: SandboxAccount = {
  platformId: "instagram",
  handle: "example_account",
  displayName: "archive",
  bio: `new stuff every week · full archive → ${DEMO_URLS.imgvault.replace("https://", "")}`,
  followers: 1284,
  following: 37,
  posts: [
    post("Cq7Lx2aPq1", "photo", "2026-09-24T21:10:00.000Z", "remember her? full set in bio @jordan.ellis", [
      { user: "vx_91", text: "no way this is jordan ellis" },
      { user: "m.kade", text: "link??" },
    ]),
    post("Cq6Tn8bWe4", "photo", "2026-09-23T18:02:00.000Z", "golden hour at the pier", [{ user: "sunny.d", text: "gorgeous light" }]),
    post("Cq5Rz1cHy7", "carousel", "2026-09-22T23:45:00.000Z", "reposting the one reddit took down. they can't stop all of it", [
      { user: "throwaway_882", text: "wasn't this on r/exampleforum last week" },
    ]),
    post("Cq4Kp6dMm2", "photo", "2026-09-21T14:30:00.000Z", "leg day. no excuses #gym #progress", [{ user: "coach.ri", text: "strong!" }]),
    post("Cq3Jb9eQs5", "reel", "2026-09-20T22:15:00.000Z", "new drop, link in bio", [
      { user: "k_lo", text: `mirror: ${DEMO_URLS.imgvault}` },
    ]),
    post("Cq2Hd4fVt8", "photo", "2026-09-19T12:00:00.000Z", "ramen night #foodie"),
    post("Cq1Gw7gXr3", "carousel", "2026-09-18T20:40:00.000Z", "J.E. part 2", [{ user: "r.vale", text: "part 1 was better" }]),
    post("Cq0Fs2hZn6", "photo", "2026-09-17T16:20:00.000Z", "throwback to 2021", [{ user: "lincoln_alum", text: "wait is that jordan from lincoln high??" }]),
    post("Cp9Eq5iLk9", "photo", "2026-09-16T10:05:00.000Z", "monday mood #memes", [{ user: "dee", text: "literally me" }]),
  ],
};
