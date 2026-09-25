# Reclaim

**One tap per link, and she never has to touch it again.**

Reclaim helps adult survivors of non-consensual intimate imagery (real or AI deepfake) enforce the federal **TAKE IT DOWN Act**. Covered platforms must remove reported content within **48 hours** of a valid request (enforceable since May 19, 2026; the FTC enforces it).

The flow: share a link → the legal request is sent → a 48-hour clock starts → the agent chases the platform, re-checks every 3 days, re-files re-uploads, and drafts an FTC complaint if the deadline is missed.

> **Not legal advice.** Reclaim prepares requests you send. The demo case ("Jordan Ellis") and all of its accounts and links are fictional.

---

## Quick start

```bash
npm install
cp env.example .env.local     # add GEMINI_API_KEY; DEMO_MODE=true seeds the fictional case
npm run dev                   # http://localhost:3000
npm test                      # 101 tests
```

Requires Node 20.9+ (built and tested on Node 24).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes (for live AI) | Gemini API key from [AI Studio](https://aistudio.google.com/apikey). Server-side only; never logged or sent to the browser. Without it, every AI step falls back to fixed templates and rules. |
| `DEMO_MODE` | no | `true` seeds the fictional case, uses page fixtures for re-checks (no network calls to the demo URLs), and never actually sends anything. |
| `GEMINI_MODEL` | no | Primary model. Default `gemini-3.1-pro-preview`. |
| `GEMINI_FALLBACK_MODEL` | no | Used automatically on 429 / 503 / 404. Default `gemini-flash-latest`. |
| `GEMINI_FAST_MODEL`, `GEMINI_GROUNDING_MODEL` | no | Latency-sensitive calls and the Google Search–grounded call. Default `gemini-flash-latest`. |
| `RECHECK_CRON_SECRET` | for scheduled re-checks | Shared secret Cloud Scheduler sends as `x-reclaim-cron`. Without it, the scheduler endpoint returns 401. |
| `GOOGLE_CLIENT_ID` | for Gmail | OAuth 2.0 **Web** client ID. Enables “Send from my Gmail”: requests go out from her Gmail (Gmail API, `gmail.send`), and platform replies are read (`gmail.readonly`) and classified by Gemini. The token stays in the browser tab. |
| `TEST_PLATFORM_INBOX` | no | When set, every request email goes to this team inbox, labeled `[Reclaim test → Platform]`, instead of the real platform. Use for rehearsals and judging. |
| `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID` | no | Programmable Search for the own-name check. When unset, Reclaim uses **Gemini with Google Search grounding**. |

All model names live in `lib/config.ts`.

---

## Demo script (≈3 minutes)

The demo runs in `DEMO_MODE=true`. Press **Shift+D** on any screen to open the presenter panel. Press **Esc** or click **Quick exit** on any screen to leave instantly.

1. **`/`**: one line about the 48-hour right, then the age check. Choosing *Under 18* routes to NCMEC's Take It Down and stores nothing.
2. **`/case` Tell us where**: name, email and links. Nothing asks what the images show. Paste a link and it resolves to a platform pill plus a channel. An unknown site is looked up with Google Search. Tick the statement, type a signature, then **Draft my requests** (Gemini writes each greeting).
3. **`/case/requests`**: four request cards, the evidence log, and a PDF.
4. **Live detection** (the button on the requests page): an agent scans a **sandbox, fictional Instagram account**, the same handle as the X uploader.
   - It reads captions, comments and the bio as **text only**. Image tiles show "Not opened".
   - Gemini flags each post (3 likely, 2 possible, 4 unrelated), with a reason for each.
   - She confirms matches; confirmed posts become one Instagram request (nothing is sent), and a StopNCII.org pointer is shown.
   - Rules decide the match level, and Gemini can never mark a post "likely" without text evidence, so the result is the same every run.
   - Then **Send all**.
5. **`/case/tracker`**: live 48-hour countdowns. Shift+D → **Simulate platform responses**:
   - Reddit removed in 19h 42m
   - Google acknowledged
   - X overdue, with the count-up and **Escalation ready**
6. **Review & file complaint**: the FTC complaint, with Gemini's summary drafted from the evidence log and every fact taken from the record.
7. Shift+D → **Fast-forward 3 days**:
   - the recheck agent runs;
   - Reddit is **still removed ✓**;
   - X's post is **back up**, so it's re-filed automatically, citing the original request, with a new 48h card;
   - a new Google result for her name waits in **Needs you** for her confirmation.
8. **Phone**: install the PWA, then Share → Reclaim from any app. You get *Request sent · 47:59:59*.

Recovery / rehearsal URLs (demo mode only): `/demo?preset=fresh`, `sent`, `simulated`, `escalation`, `fastforward`.

---

## Real mode (no simulations)

With `DEMO_MODE` unset, nothing is simulated:

- **Sending** — “Send from my Gmail” signs in with Google; requests go out from her Gmail via the Gmail API. With `TEST_PLATFORM_INBOX` set they go to that team inbox, clearly labeled as a stand-in for each platform. Web-form platforms without a test inbox open the form with copy-paste fields.
- **Replies** — every minute while the tracker is open, Reclaim reads new replies in each request’s Gmail thread (text only; attachments are never downloaded) and **Gemini** classifies them. Unclear replies, or replies asking for images, wait in *Needs you*.
- **Reminders** — 24h/44h reminders are sent as replies in the same Gmail thread (only with her auto-send consent).
- **Live detection** — reads the reported account’s **public RSS/Atom feed** (Tumblr blogs and most blogs have one; Instagram and X don’t) as text, and **Gemini 3.1 Pro** judges each post.
- **Re-checks** — fetch each real link as text; **Gemini 3.1 Pro** decides removed / live / unclear.
- **Own-name search** — **Gemini with Google Search grounding**; results are resolved to real URLs and wait for her confirmation.
- **Deadlines** are real 48-hour clocks. To show an overdue platform, send a real request 2+ days before; *Back up case* on the tracker protects it (Quick exit wipes the browser copy by design).

### Google OAuth setup (for Gmail)

1. In a Google Cloud project: enable the **Gmail API**.
2. **OAuth consent screen** → External → add the Gmail addresses that will sign in as **test users**.
3. **Credentials → Create OAuth client ID → Web application**, authorized JavaScript origins: your Cloud Run URL and `http://localhost:3000`.
4. Set `GOOGLE_CLIENT_ID` (runtime env var; no rebuild needed on Cloud Run).

## Hard safety rules and where they're enforced

| Rule | Enforcement |
|---|---|
| **Links only.** No image upload, download or vision model. | No file inputs anywhere; the share target accepts `url`/`text`/`title` only. Re-checks use `lib/pageText.ts`, which sends `Accept: text/html`, refuses any non-text response **without reading its body**, and strips every media tag, attribute and `data:` URI. Only a page title and a status are stored. Gemini's `urlContext` is deliberately not used, because it would let the model fetch pages with images. Tests: `tests/noImages.test.ts`, which is mutation-checked. |
| **No searching for a person's images.** | Only two searches exist: (1) `resolve_platform`, which sends Google Search the **hostname only**, never the path; (2) the user's **own name**, where every result waits for her confirmation. |
| **Under-18 → stop.** | The age gate routes to NCMEC's Take It Down, clears local and session storage, deletes any server copy, and never creates a case; `PUT /api/case` also refuses `isAdult: false`. Test: `tests/ageGate.test.ts`. |
| **Never create accounts, log in, post, or contact the uploader.** | No such code exists. Form channels only open the platform's form, with copy-paste fields. |
| **Signed attestation; explicit consent.** | Every request contains the fixed good-faith statement and `/s/` signature. Auto-send requires the one-time consent toggle; the model can never set consent. **Review each before sending** is always available. |
| **Quick exit everywhere.** | Button + Esc → `window.location.replace("https://weather.com")`. Clears localStorage and sessionStorage and deletes the server copy via `sendBeacon`. |
| **Not legal advice; fictional demo data labeled.** | Footer on every screen; "Example case · fictional" badge; PDFs are labeled too. |

Other privacy defaults: `Referrer-Policy: no-referrer`, the app can't be framed (`frame-ancestors 'none'`), the service worker caches nothing, and case contents and request bodies are never logged.

---

## How Gemini is used

`lib/agent.ts` is a function-calling agent loop. It uses mode `ANY`, and each flow ends when the model calls its designated final tool, so the output is always schema-shaped. `lib/gemini.ts` wraps every call with retry and backoff on 429/503, then falls back to the Flash model (also on 404, i.e. a wrong model string).

| Tool | What Gemini does | What it never sees or controls |
|---|---|---|
| `resolve_platform` | Separate call **grounded with Google Search**; must return sources, ≥ 0.7 confidence, and a channel on the site's own domain | Never sees the URL path. Otherwise: "Couldn't confirm — use the site's contact page" |
| `draft_request` / `draft_google_removal` | Short first-person greeting (parallel tool calls) | Gets platform names only. Legal sections come from fixed templates (`lib/templates.ts`) |
| `draft_reminder` / `draft_ftc_complaint` | One reminder line / the complaint summary | Gets timeline facts only (platform, dates, counts), never name, email or links |
| `parse_reply` | Classifies a pasted platform email; flags requests for images | The text isn't stored; the user confirms the outcome |
| `flag_post` | Live detection (sandbox): judges one post's caption and comments as likely / possible / unrelated, with a reason | Never sees images; can't make a post "likely" without rule evidence; she confirms every match |
| `recheck` | Judges ambiguous page **text** (media stripped) | Only after HTTP status and removal-wording rules; unsure → `unclear` → ask the user |
| `log_evidence`, `prepare_submission`, `start_clock` | Deterministic tools (no model) | SHA-256 of `url + page title`; mailto / Gmail-ready draft / form fields; `deadline = sent + 48h` |

---

## Architecture

```
app/                     Next.js App Router (TypeScript, Tailwind)
  page.tsx               Landing + age gate
  case/                  Tell us where · Review requests · Tracker · FTC complaint
  share/                 PWA share target + paste fallback
  help/under-18/         NCMEC hand-off
  api/                   resolve, draft, detect, followup, parse-reply, recheck, case, send (stub)
lib/
  agent.ts gemini.ts     Agent loop, tool declarations, retry/fallback
  resolve.ts draft.ts detectAgent.ts followups.ts recheck.ts   Gemini-backed flows (server)
  caseOps.ts escalation.ts recheckOps.ts demo.ts          Pure case transitions (client + server)
  templates.ts           Fixed legal text (request, Google removal, reminder, FTC complaint)
  pageText.ts            Text-only, SSRF-safe page fetch
  store.ts               CaseStore interface: in-memory server store + localStorage mirror
data/platforms.json      Removal channel directory (10 platforms + fictional ImgVault)
data/fixtures.ts         Demo page fixtures (no network in demo mode)
tests/                   Vitest (101 tests)
```

State lives in the browser (localStorage) and is mirrored to the server through `PUT /api/case`, so the scheduled recheck agent can see it. Both sit behind the `CaseStore` interface in `lib/store.ts`, so Firestore can replace the in-memory store without touching callers.

---

## Deploy to Cloud Run

```bash
PROJECT=your-project-id
REGION=us-central1
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com

# Secrets live in Secret Manager, never in the image
printf '%s' "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create recheck-cron-secret --data-file=-

# Build from the Dockerfile and deploy
gcloud run deploy reclaim --source . --region $REGION --allow-unauthenticated \
  --set-env-vars DEMO_MODE=true \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,RECHECK_CRON_SECRET=recheck-cron-secret:latest \
  --min-instances 1 --max-instances 1
```

The Cloud Run service account needs `roles/secretmanager.secretAccessor` on both secrets.

**If `--source` fails with `PERMISSION_DENIED … default service account`** (common on hackathon/lab projects where you can't edit project IAM), build locally and deploy the image instead. This is how the demo is currently deployed:

```bash
IMG=us-central1-docker.pkg.dev/$PROJECT/cloud-run-source-deploy/reclaim:$(git rev-parse --short HEAD)
gcloud auth configure-docker us-central1-docker.pkg.dev
docker buildx build --platform linux/amd64 -t "$IMG" --push .   # Cloud Run is x86; build for amd64 on Apple silicon
gcloud run deploy reclaim --image "$IMG" --region $REGION --allow-unauthenticated \
  --set-env-vars DEMO_MODE=true \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,RECHECK_CRON_SECRET=recheck-cron-secret:latest \
  --min-instances 1 --max-instances 1
```

`--max-instances 1` is required while the server store is in memory, so every request and the scheduler hit the same instance. `--min-instances 1` avoids a cold start mid-demo. Switch the store to Firestore before scaling out.

Cloud Run gives you HTTPS, which Android requires to install the PWA. On the phone: open the URL in Chrome → **Install app** → Share any link → **Reclaim**.

To test the image locally:

```bash
docker build -t reclaim .
docker run -p 8080:8080 --env-file .env.local reclaim    # secrets passed at runtime, not baked in
```

## Scheduled re-checks (Cloud Scheduler)

`POST /api/recheck` with header `x-reclaim-cron: <secret>` re-checks every stored case that is **due**. Each case carries its own `nextRecheckAt`: every 3 days, slowing to weekly after 30 consecutive clean days. So the scheduler can fire often, and each case is still checked on its own cadence:

```bash
URL=$(gcloud run services describe reclaim --region $REGION --format 'value(status.url)')
gcloud scheduler jobs create http reclaim-recheck --location $REGION \
  --schedule "0 * * * *" --time-zone "Etc/UTC" \
  --uri "$URL/api/recheck" --http-method POST \
  --headers "x-reclaim-cron=$(gcloud secrets versions access latest --secret recheck-cron-secret)"
```

Prefer a strict 72-hour trigger? Use `--schedule "0 9 */3 * *"` instead. It restarts at each month boundary, so hourly plus per-case due times is more precise.

Each run, per case:
- re-checks every content link (text only);
- logs every check to the evidence log;
- confirms removals and **re-files re-uploads**, citing the original request;
- asks the user when a page is unclear;
- surfaces new own-name results for her confirmation;
- drafts 24h/44h reminders and FTC complaints;
- only adds to the activity feed when something changed.

---

## Before real-world use

- **Verify `data/platforms.json`.** Form URLs are best-effort and must be checked against each platform's current NCII / TAKE IT DOWN process.
- **Set the FTC link.** `FTC_REPORT_URL` in `lib/config.ts` points to reportfraud.ftc.gov; switch it to the FTC's dedicated TAKE IT DOWN Act page if one exists.
- **Real email sending.** Gmail sending is a stub (`/api/send`, simulated in demo mode). Real sending needs the Gmail API with the user's OAuth grant, limited to her one-time auto-send consent.
- **Persistent storage.** Replace the in-memory server store with Firestore (`CaseStore`), with encryption at rest and retention limits.
- **Legal review.** Have a lawyer review `lib/templates.ts`.
- **Search engines.** Google Search isn't a covered platform under the Act, so its request cites Google's own policy instead of the 48-hour duty.

## Tests

```bash
npm test
```

Highlights:
- no request or re-check path downloads or stores image bytes;
- every drafted request contains all required elements (content identification, URLs, good-faith statement, signature, contact), including against hostile model output;
- `isAdult=false` stores nothing and routes to NCMEC;
- Gemini receives no PII for follow-ups;
- platform lookup never guesses;
- the 48h clock, reminders, escalation, re-upload re-filing and schedule behave correctly.
