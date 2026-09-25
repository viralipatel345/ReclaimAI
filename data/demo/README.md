# Reclaim demo data

`reclaim-demo-data.json` is the single source for demo content: the landing page reads it, and the app's demo can too.

## What is real, what is not

| Section | Status | How it was checked (25 Sep 2026) |
|---|---|---|
| `law` | Real | FTC enforcement post and business guidance, Congress.gov bill text |
| `stats` | Real | Each entry has the source URL and the exact quote it rests on |
| `resources` | Real | CCRI helpline number confirmed on CCRI's site and third-party directories |
| `platforms` | Real, except ImgVault | Every report link opened. Reddit, X and Discord block automated checks and were confirmed in a browser. Discord's form needs a Discord sign-in. Telegram is an email address and was not link-checked |
| `demoCase` | Fictional | Jordan Ellis, the posts and the URLs are invented. URLs use example paths or the reserved `.example` domain. Timings follow `lib/demo.ts` and are illustrative, not measured platform performance |

## Rules for anyone adding content

- Never use a real person, a real post URL, or any intimate image.
- Every statistic needs a source URL and the exact sentence it comes from. If you can't quote it, don't ship it.
- Numbers removed after checking are listed in `meta.removedAfterCheck` so they don't creep back in.
