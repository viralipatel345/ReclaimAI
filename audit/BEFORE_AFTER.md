# Reclaim demo — before / after

Both runs use `scripts/demo-walkthrough.ts` against a production build with live Gemini (`DEMO_MODE=true`): `before` is the old path, `after` the new one. Screenshots: `audit/before/` and `audit/after/`, desktop 1440×900 and mobile 390×844. Raw numbers: `run.json` in each folder.

## Headline

| | Before | After |
|---|---|---|
| Presenter actions | **14** | **7** |
| Longest wait | 8.8 s desktop / 10.4 s mobile — FTC summary, text swapped under the reader | **7.8 s** — the live-detection scan, which is animated the whole time |
| Longest *blank / static* wait | 4–5 s disabled “Drafting with Gemini…” button (14 s with slow Gemini) | **none over ~1 s** — every wait shows a shimmer, typing text, a scan or a progress bar |
| Gemini unreachable | Live detection: 0 posts (demo dead) | Recorded verdicts: 3 likely · 2 possible · 4 no match |
| Slow Gemini (8 s) | Draft screen static 14 s | Requests page in ~1.3 s, cards shimmer, then type |
| Fast-forward ending | Instagram overdue, 3 “couldn’t tell” rows, real fetches of fictional URLs | 5 removed ✓ · X re-upload re-filed · 1 result to confirm; no network |
| Console errors | 0 (1 × 404 in an intermediate run) | 0 |
| Under-18 route | 0 keys stored | 0 keys stored |
| Double-click Draft / Send | no duplicates | no duplicates |

**The 7 actions:** Start demo · Live detection · Add 3 likely matches · Send all · `1` (simulate) · Review & file complaint · `2` (fast-forward). Drafting happens on its own after Start demo. Sharing a link on the phone is shown separately and isn't counted.

### Waits, desktop (ms)

| Step | Before | After | What’s on screen now |
|---|---|---|---|
| Start → drafted | 4,981 (static button) | 1,293 | Floating “Drafting 4 requests…” progress pill |
| Greetings written | — | 5,815 | Cards rise in, shimmer, then type out; Send waits until done |
| Detection scan | 7,828 | 7,827 | Tiles highlight one by one, agent log streams |
| Add detected posts | 3,337 (static “Drafting…”) | 32 | Instant; greeting types in on Requests |
| FTC summary | 8,834 (template text, then swapped) | 2,293 | Shimmer, then typed out |
| Fast-forward | 4,808 (only a panel label changed) | ~1,400 | “3 days later…” overlay, then a summary banner |

## Side by side

| Screen | Before | After | What changed |
|---|---|---|---|
| Landing | ![](before/desktop/01-landing.png) | ![](after/desktop/01-landing.png) | **Start demo** on top (fresh fictional adult case); age choice + under-18 hand-off kept below; shorter sub-head |
| Tell us where | ![](before/desktop/03-case-drafting.png) | ![](after/desktop/02-case-autodraft.png) | Drafting starts itself; a visible progress pill replaces a disabled button below the fold |
| Requests | ![](before/desktop/04-requests.png) | ![](after/desktop/03-requests-drafting.png) | Cards rise in one by one with a “Drafting” shimmer; the greeting types out when Gemini answers; sticky send bar |
| Requests (done) | ![](before/desktop/10-requests-with-instagram.png) | ![](after/desktop/10-requests-with-instagram.png) | Evidence log no longer duplicates the Instagram posts; odd last card spans both columns; excerpt no longer clips a half line |
| Live detection | ![](before/desktop/07-detect-done.png) | ![](after/desktop/07-detect-done.png) | Big 3 · 2 · 4 counts and one **Add 3 likely matches** button pinned above the fold (was 2 screens down, 2 clicks) |
| Tracker after send | ![](before/desktop/11-tracker-sent.png) | ![](after/desktop/11-tracker-sent.png) | 44–52 px numbers: removed · on the clock · overdue · **0 images seen**; status flips as clocks start |
| Tracker simulated | ![](before/desktop/13-tracker-simulated.png) | ![](after/desktop/12-tracker-simulated.png) | Hotkey `1` instead of Shift+D + click; no panel covering the page; overdue card pulses red; activity trimmed to 4 |
| FTC complaint | ![](before/desktop/14-ftc-loading.png) | ![](after/desktop/13-ftc-loading.png) | Shimmer while Gemini writes (no text swap), 2–3 s on Flash; template fallback no longer labeled as Gemini’s |
| Fast-forward | ![](before/desktop/17-tracker-fastforward.png) | ![](after/desktop/16-tracker-fastforward.png) | Hotkey `2` from any page; “3 days later” banner; Instagram removed in the story; no unclear rows |
| Offline detection | ![](before/probe-offline-detect.png) | ![](after/probe-offline-detect.png) | Falls back to recorded Gemini verdicts |
| Mobile tracker | ![](before/mobile/13-tracker-simulated.png) | ![](after/mobile/12-tracker-simulated.png) | Numbers and clocks first; compact red escalation card; dark panel moved below |

## Also changed
- **Cached Gemini for the demo case** (`data/demoCache.json`, recorded live): greetings, 9 detection verdicts, FTC summary, reminder lines. Used when Gemini is slow, fails, or the presenter ticks *Use cached Gemini responses* in Shift+D, which also shows live / cached / template per step.
- **Timeouts everywhere**: 8 s server-side per Gemini call, 10 s on every client call, 20–30 s for search grounding and re-checks.
- **Tokens**: panel status colors and a 10-step type scale in the Tailwind theme; no hard-coded hex or arbitrary text sizes left in `app/` or `components/`.
- **Teammate’s `landing-aistudio/` and `brand/`** are excluded from the app’s type check, lint and Docker context (they were breaking `next build`).

## Couldn’t fix / not done
- **`design/` reference screenshots** — the folder still doesn’t exist, so the pass matched the spec’s tokens, not your mockups.
- **Real phone share sheet** — needs the Cloud Run HTTPS URL.
- **Greetings take ~5–6 s live** — the screen is never blank (shimmer + typing), but if the room’s wifi is slow, tick *Use cached Gemini responses* for an instant draft.
- **Detection scan is ~11 s by design** (1.1 s per post so judges can follow it). Shorten `DWELL_MS` in `app/case/detect/page.tsx` if you need it faster.
