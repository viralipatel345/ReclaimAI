// Every fictional URL the demo can touch, served from fixtures so demo mode never makes a
// network call for invented content: the seed links plus the sandbox Instagram posts.
import { PAGE_FIXTURES, type PageFixture } from "./fixtures";
import { SANDBOX_ACCOUNT } from "./sandbox";

const SANDBOX_PAGES: Record<string, { live: PageFixture; removed: PageFixture }> = Object.fromEntries(
  SANDBOX_ACCOUNT.posts.map((p) => [
    p.url,
    {
      live: { title: `@${SANDBOX_ACCOUNT.handle} on Instagram`, text: p.caption },
      removed: { title: "Instagram", text: "Sorry, this page isn't available. The link may be broken, or the page may have been removed." },
    },
  ]),
);

export function demoFixture(url: string): { live: PageFixture; removed: PageFixture } | undefined {
  return PAGE_FIXTURES[url] ?? SANDBOX_PAGES[url];
}
