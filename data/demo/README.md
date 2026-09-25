# Reclaim demo data

`reclaim-demo-data.json` is the single source for demo content: the landing page reads it, and the app's demo can too.

## What is real, what is not

| Section | Status | How it was checked (25 Sep 2026) |
|---|---|---|
| `law` | Real | FTC enforcement post and business guidance, Congress.gov bill text |
| `stats` | Real | Each entry has the source URL and the exact quote it rests on |
| `resources` | Real | CCRI helpline number confirmed on CCRI's site and third-party directories |
| `platforms` | Real, except ImgVault | `link` is what the landing shows, checked 25 Sep 2026: opened in a browser where possible, Reddit and Pornhub by server response (the test browser can't open them), Telegram's email confirmed on its FAQ. Each entry's `check` says how. `target` is the app's original value, kept unchanged |
| `demoCase` | Fictional | Jordan Ellis, the posts and the URLs are invented. URLs use example paths or the reserved `.example` domain. Timings follow `lib/demo.ts` and are illustrative, not measured platform performance |

## Rules for anyone adding content

- Never use a real person, a real post URL, or any intimate image.
- Every statistic needs a source URL and the exact sentence it comes from. If you can't quote it, don't ship it.
- Numbers removed after checking are listed in `meta.removedAfterCheck` so they don't creep back in.

## Broken links in the app's data

`data/platforms.json` still has three targets that fail (listed in `meta.appTargetsNeedingFix`):
Instagram and Facebook contact pages no longer exist, and Tumblr's abuse link redirects to its general guidelines.
The working replacements are in this file's `link` field. Update `platforms.json` once the team agrees.
