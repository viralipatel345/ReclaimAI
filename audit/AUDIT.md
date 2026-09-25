# Reclaim demo audit — before

Run: `npx tsx scripts/demo-walkthrough.ts before` against a production build (`localhost:3200`, `DEMO_MODE=true`, live Gemini). Screenshots are in `audit/before/desktop/` (1440×900), `audit/before/mobile/` (390×844), and `audit/before/probe-*.png`. Raw numbers are in `audit/before/run.json`.

> **No `design/` folder exists in the repo**, so this audit judges against the design system in the spec (tokens, fonts, radius) rather than the reference screenshots. Add them to `design/` and the fix pass will match their layout.

## Headline numbers

| | Now | Target |
|---|---|---|
| Presenter actions, full demo | **14** | < 8 |
| Longest wait on Gemini | **8.8 s** desktop / **10.4 s** mobile (FTC summary) | nothing blank > 1 s |
| Other waits > 1 s | draft greetings 4.0–5.0 s · detection scan 7.8 s (animated) · add detected posts 2.5–3.3 s · fast-forward 4.3–4.8 s | |
| Console errors / hydration warnings | 0 / 0 | 0 |
| Under-18 route | 0 keys stored | 0 ✓ |
| Double-click Draft / Send | 4 requests, 4 sends (no duplicates) | ✓ |
| AI endpoints unreachable | drafting falls back to template greetings in 85 ms ✓; **live detection returns 0 posts** ✗ | demo still works |
| Gemini 8 s slow | Draft button sits static for **14 s** | streaming / cached |

The 14 actions today: select 18+ · Start · Draft my requests · Live detection · Yes to all likely · Add to my requests · Send all · Shift+D · Simulate · Review & file complaint · back to tracker · Shift+D · Fast-forward · share (phone).

## Screen scores (1–5)

| Screen | Flow | Visual | Story | Trust | Robust | Notes |
|---|---|---|---|---|---|---|
| Landing `01` | 3 | 4 | 4 | 5 | 5 | Two actions to get in; good headline |
| Tell us where `02–03` | 2 | 3 | 2 | 4 | 4 | A pre-filled form with nothing to watch; 5 s static wait |
| Requests `04, 10` | 3 | 3 | 3 | 4 | 4 | Four look-alike cards; primary action below the fold |
| Live detection `05–09` | 3 | 4 | 5 | 5 | **1** | The best “wow”, but result actions are 2 screens down and it collapses offline |
| Tracker after send `11` | 3 | 3 | 2 | 3 | 4 | Five identical 47:59:58 clocks, small stat chips |
| Tracker simulated `13` | 3 | 4 | 5 | 3 | 4 | Strongest visual; demo panel covers it |
| FTC `14–15` | 3 | 4 | 4 | 4 | 3 | 9–10 s before the Gemini summary swaps in under the reader |
| Tracker fast-forward `17` | 2 | 3 | **1** | 3 | **1** | Story breaks: Instagram goes overdue and steals the escalation; 3 “couldn’t tell” rows |
| Share `18` | 4 | 4 | 5 | 4 | 4 | Clean; slightly wordy |
| Under-18 `probe-under-18` | 5 | 4 | 5 | 5 | 5 | Correct and calm |

## Issues by category

### 1. Demo flow
- **14 actions, 4 of them presenter plumbing** (Shift+D twice, back-navigation, a two-step confirm). `run.json`
- **Tell us where has nothing to watch.** Everything is pre-filled; the judge sees a form, then a disabled “Drafting with Gemini…” button for 4–5 s. `02-case.png`, `03-case-drafting.png`, `probe-slow-draft-2s.png`
- **Adding detected posts blocks on a Gemini greeting** (2.5–3.3 s of “Drafting…”) for text that isn’t essential. `09-detect-adding.png`
- **FTC summary**: the template text shows, then 9–10 s later is replaced by Gemini’s. A reader is mid-sentence when it changes. `14-ftc-loading.png` → `15-ftc.png`
- **Fast-forward**: 4–5 s with no visible change except the panel label “Re-checking…”. `16-fastforward-busy.png`
- **Presenter must explain** what “Simulate” and “Fast-forward” mean; nothing on screen says “3 days later”.

### 2. Visual quality
- **Primary action below the fold** on Requests (Send all at y≈1,000–1,340 on a 900 px screen, `04`, `10`) and Detection (Add to my requests at y≈1,550, `07`).
- **Request excerpts show a clipped half-line** under the ellipsis (Google card, both viewports). `04-requests.png`, `mobile/04-requests.png`
- **“Greeting by Gemini” wraps onto two lines** and crowds the card footer. `04-requests.png`
- **Five cards leave an orphan** in a 2-column grid. `10`, `11`, `13`
- **Demo panel overflows** its own box (recovery-URL line runs off the edge) and stays open over the page across navigations, covering the FTC buttons. `12`, `14`, `15`, `mobile/15-ftc.png`
- **Token drift:** 7 hard-coded hexes outside the theme (`#F3A6A0`, `#6FC39D`, `#8E9BE0`, `#F08A82`, `#AEB8F0` in tracker/detect/ftc) and **19 different arbitrary text sizes** (`text-[9px]` to `text-[72px]`).
- **Mobile tracker**: the dark panel with 8–9 activity rows comes first, pushing the clocks 1,500–3,000 px down. `mobile/13`, `mobile/17`
- **Mobile detection page is 6,500 px tall**; the confirm buttons are far below the grid. `mobile/07`

### 3. Story (3 seconds from the back of the room)
- **Key numbers are small.** Removed / in progress / overdue are 15 px chips; “0 images seen” isn’t on screen at all. `11`, `13`
- **After Send, nothing tells a story**: five identical clocks at 47:59:58. `11-tracker-sent.png`
- **Too much copy** on every screen (sub-heads of 2–3 lines, a 5-line activity feed per event). The activity feed repeats “Request sent to … 48-hour clock started.” five times. `11`
- **Fast-forward muddies the ending** (see Robustness). `17`

### 4. Trust & responsible design on screen
- ✓ Quick exit in the header on every screen; ✓ “Example case · fictional”; ✓ not-legal-advice footer; ✓ under-18 → NCMEC with nothing stored.
- ✗ **“We never see your images” is only in the left rail** (hidden on mobile except on Tell us where) and missing from the tracker — the screen judges look at longest.
- ✗ Not-legal-advice is 12 px in the footer; fine legally, invisible from the back of a room (acceptable).

### 5. Robustness
- **Live detection has no offline fallback.** With `/api/detect` unreachable, all 9 posts say “couldn’t check” and the result is “0 posts to review”. `probe-offline-detect.png`
- **Fast-forward makes real network calls to fictional URLs.** The Instagram posts added by detection aren’t in the fixtures, so demo mode fetches `instagram.com/p/…` live (blocked → “unclear”). Three “Couldn’t tell if this is still up” rows appear. `17-tracker-fastforward.png`
- **Fast-forward turns the Instagram request overdue** (+24:00:18) and the escalation panel switches to “Instagram missed its deadline”, contradicting the X storyline. `17`
- **No client timeouts** on any `fetch` to our API, and no timeout on Gemini calls beyond retries; a hung request leaves a spinner forever.
- **No cached responses** for the seeded case: every demo run depends on live Gemini latency (4–10 s per step).
- Double-clicks are safe (idempotent state ops). ✓

### 6. Code / UX bugs
- **Evidence log duplicates**: each detected Instagram post is logged twice (`addLink` + `addDetectedLinks` both add a “logged” entry). `10-requests-with-instagram.png`
- **Activity label drift**: after Simulate, “Request sent to Instagram” loses its “(demo)” suffix while others keep it. `13`
- Demo panel stays mounted across routes (by design) but should close after an action.
- 0 console errors, 0 hydration warnings, no layout shift except the FTC summary swap.

## Ranked fix list (demo impact ÷ effort)

| # | Fix | Impact | Effort | Addresses |
|---|---|---|---|---|
| 1 | **Fix the fast-forward story**: serve sandbox Instagram URLs from fixtures (no live fetch of fictional URLs), have Instagram remove the posts during the 3 days, keep X as the escalation | 5 | 1 | `17`, network calls to fictional URLs |
| 2 | **Cache every Gemini response for the seeded case** (greetings, detection verdicts, FTC summary, reminder lines) + client timeouts (8 s) with automatic fallback to the cache; Shift+D panel shows **Live / Cached** | 5 | 2 | waits, offline detection, hung spinners |
| 3 | **Collapse the flow to 7 actions**: “Start demo” (1 click, 18+ confirmed) → Tell us where auto-drafts with visible progress → Live detection → one “Add 3 matches” button → Send all → press **1** (simulate) → Review & file → press **2** (fast-forward, returns to tracker). Hotkeys replace Shift+D clicks; panel auto-closes | 5 | 2 | 14 → 7 actions |
| 4 | **Big-number header on the tracker**: removed / on the clock / overdue / **0 images seen** at 44–56 px, plus a “3 days later” banner after fast-forward | 4 | 1 | story, trust |
| 5 | **Motion that tells the story** (150–300 ms): request cards drafting in one by one with streamed greeting text; cards flip to Sent and clocks start; Removed state settles green; Overdue border pulses red | 4 | 2 | dead time, wow |
| 6 | **Primary action always visible**: sticky action bar on Requests and Detection (desktop too); detection summary + “Add 3 matches” pinned above the post list | 4 | 1 | below-the-fold CTAs |
| 7 | **Evidence duplicate bug**, activity “(demo)” drift, excerpt clipping, “Greeting by Gemini” wrap, demo-panel overflow | 3 | 1 | bugs |
| 8 | **Cut copy**: one-line sub-heads, activity feed collapsed to the latest 4 with “Show all”, fewer labels on cards | 3 | 1 | story |
| 9 | **Mobile tracker order**: clocks + big numbers first, escalation card compact, activity collapsed | 3 | 1 | `mobile/13`, `mobile/17` |
| 10 | **Tokens**: move the 7 stray hexes into the theme (panel-accent tones), define a type scale (display-xl/l/m, body, label, mono-timer) and replace the 19 arbitrary sizes | 2 | 2 | consistency |
| 11 | Orphan 5th card: 3-column grid at ≥1280 px for 5–6 cards, or span the last card | 2 | 1 | layout |

## Can’t do without you
- **Match `design/` reference screenshots** — the folder doesn’t exist yet.
- **Real phone share-sheet test** — needs the Cloud Run URL (HTTPS).
