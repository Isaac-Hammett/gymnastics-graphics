# Commentary talent CRM

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** People
**Purpose:** A 480-person contact database and season-long booking pipeline for gymnastics commentators — a producer can search the roster, assign PBP/analyst/producer to a competition, send an invite/booking link, track confirm→brief status on a list or kanban board, and see same-day double-booking conflicts.
**Status:** **Partial** — The roster and per-competition assignment core is **Proven**: live Firebase holds 482 `talentRoster` records with real people, real phones/emails and 2026 survey tech data, and `competitions/wcgnic-2026-{prelim1,prelim2,event-finals}/commentary` hold real confirmed WCGNIC 2026 assignments (`kevin-copp` pbp, `marcela-bonifasi` analyst, `tavia-smith`/`tiara-detommaso` analyst, `christina-chauvenet` pbp with note "Rate $250/session"). Everything downstream of "assign" is **Partial or unexercised**: no talent record anywhere carries a `communicationLog` or `parsedAvailability` child (checked `kevin-copp`, `christina-chauvenet`, `akash-modi`, `marcela-bonifasi`, `tiara-detommaso`), so no Gmail/GCal/Claude call ever wrote real data; the only two `bookingTokens` (created 2026-03-22 for `wcgnic-2026-team-finals`, a compId that no longer exists) are both `responded: false`; and `surveyResponses` does not exist as a root key at all, so the public `/survey/:year` page was never submitted. Talent **discovery is effectively Orphaned** — `parseRosterHTML()` in `server/lib/talentDiscoveryService.js:213` hardcodes `return []` and `fetchAlumniRoster` throws "Alumni roster not available", and `TalentDiscoveryPage.jsx:17` destructures `coordinatorUrl` from `useCoordinator()`, which never returns that key (`show-controller/src/hooks/useCoordinator.js:308-328`), so every discovery fetch targets the literal URL `undefined/api/talent/discover`. `POST /api/talent/:talentId/communication-log`, called by `CommentaryPage.jsx:324`, does not exist on the server at all.
**Sport coupling:** **Sport-parameterized** — the only sport-specific logic is the WAG/MAG gender filter (`CommentaryPage.jsx:71`) and gymnastics wording in the Claude scoring prompt; roles, statuses and the booking pipeline carry no apparatus/scoring assumptions.
**Key files:**
- `show-controller/src/pages/CommentaryPage.jsx` (909 lines) — per-competition assign/invite/brief tab, kebab actions, conflict detection
- `show-controller/src/pages/TalentPage.jsx` (854) — `/talent` roster, filters, saved views, bulk status/CSV export
- `show-controller/src/pages/TalentProfilePage.jsx` (992) — profile, onboarding checklist, screenshot upload, activity timeline
- `show-controller/src/pages/BookingPage.jsx` (344) — public `/book/:token` yes/no response, writes Firebase directly
- `show-controller/src/pages/SurveyPage.jsx` (353) — public `/survey/:year` form, writes Firebase directly
- `show-controller/src/pages/TalentDiscoveryPage.jsx` (276) — `/talent/discover`, broken `coordinatorUrl` wiring
- `show-controller/src/hooks/useCommentaryStaff.js` (106) — CRUD on `competitions/{compId}/commentary`
- `show-controller/src/hooks/useTalentAssignments.js` (350) — cross-competition aggregator, dual derived/fetch mode, 30s poll
- `show-controller/src/hooks/useTalentRoster.js` (105) — `talentRoster` live subscription + status helpers
- `show-controller/src/components/crm/{TalentTable(469),KanbanBoard(235),CommandPalette(398),KebabMenu(83)}.jsx` — table/kanban/Cmd+K/overflow menu
- `server/index.js` lines 3374–4090 — all 9 CRM HTTP routes incl. 2 direct Anthropic calls
- `server/lib/{gmailService(157),googleCalendarService(133),talentDiscoveryService(386)}.js` — env-gated externals

**Firebase paths written:**
- `talentRoster/{talentId}` (create/update/delete; also `POST /api/talent/discover/add` and SettingsPage CSV import)
- `talentRoster/{talentId}/notes`
- `talentRoster/{talentId}/parsedAvailability`
- `talentRoster/{talentId}/communicationLog/{pushKey}`
- `talentRoster/{talentId}/interested/{compId}` (BookingPage "No" flow)
- `competitions/{compId}/commentary/{talentId}`
- `bookingTokens/{token}`
- `surveyResponses/{year}/{pushKey}`

**Firebase paths read:**
- `talentRoster` and `talentRoster/{talentId}`
- `competitions` (full-tree read by BookingPage, SurveyPage, `useProductionAlerts`)
- `competitions/{compId}/config`
- `competitions/{compId}/commentary`
- `bookingTokens/{token}`

**Socket events:** `emits:` none · `listens:` none — the CRM is entirely HTTP + Firebase realtime listeners.

**HTTP routes:**
- `POST /api/book/generate` — mint booking token, mark invited
- `POST /api/talent/:talentId/notes/parse` — Claude extracts availability from note
- `POST /api/talent/:talentId/parse-screenshot` — Claude vision reads text-thread screenshot
- `POST /api/talent/discover` — score school alumni candidates
- `POST /api/talent/discover/add` — add candidate to roster
- `POST /api/commentary/:compId/:talentId/invite` — token + Gmail invite + log
- `POST /api/commentary/:compId/:talentId/briefing` — Gmail briefing with Virtius/Discord/pre-prod
- `POST /api/commentary/:compId/:talentId/calendar-invite` — GCal event 1h before meet
- `POST /api/commentary/:compId/:talentId/schedule-preproduction` — GCal 30-min Meet call
- `POST /api/talent/:talentId/communication-log` — **called by client, does not exist on server**

**External services:**
- Anthropic Claude (`claude-haiku-4-5-20251001`) — three call sites, all gated on `ANTHROPIC_API_KEY`: (1) `server/index.js:3455` extracts `availablePeriods`/`unavailableDates` JSON from a free-text note; (2) `server/index.js:3893` same extraction from a base64 screenshot of an iMessage thread (vision, 10 MB body limit); (3) `server/lib/talentDiscoveryService.js:279` one batched call scoring a whole alumni list 1–5 with a written rationale. All three return 503 with a clear message when the key is unset. No LLM is used for writing emails, matching talent to meets, or resolving conflicts — those are hand-written templates and plain JS.
- Gmail API (OAuth2, `googleapis`) — invite / briefing / reminder HTML emails from the coordinator's own account
- Google Calendar API (OAuth2) — competition-day event and pre-production call with an auto-created Google Meet link
- `rtnathletics.com` — attempted alumni-roster scrape; the URL pattern is a guess and parsing is a stub

**Depends on:**
- Coordinator server — direct import + HTTP — hosts all 9 routes, holds the Anthropic/Google clients
- Competition model — Firebase `competitions/{compId}/config` + `GET /api/competitions/index` — supplies eventName / meetDate / venue / gender to emails, booking pages, conflict checks and the survey checkbox list
- Auth — `RequireAuth` wrapper in `App.jsx:108-110` — protects `/talent*`; `/book/:token` and `/survey/:year` are deliberately unauthenticated
- RTN stats — HTTP scrape — nominal source for alumni discovery, never actually returns data

**Used by:**
- Home page (surface) — Firebase `competitions/{compId}/commentary` via `show-controller/src/hooks/useProductionAlerts.js` — drives the Pre-Production Alerts panel (`HomePage.jsx:643`)
- Competition workspace (surface) — route `/:compId/commentary` (`App.jsx:136`) — the per-competition Commentary tab
- Settings (surface) — Firebase `talentRoster` — `SettingsPage.jsx:22-165` CSV batch import of Google Form responses, matched by email

**UI surfaces:**
- Talent Roster page (`/talent`, table + card views) — `show-controller/src/pages/TalentPage.jsx`
- Talent profile (`/talent/:talentId`, Profile + Communications tabs) — `show-controller/src/pages/TalentProfilePage.jsx`
- Discover Talent (`/talent/discover`) — `show-controller/src/pages/TalentDiscoveryPage.jsx`
- Commentary tab (`/:compId/commentary`, list + kanban) — `show-controller/src/pages/CommentaryPage.jsx`
- Public booking response (`/book/:token`) — `show-controller/src/pages/BookingPage.jsx`
- Public annual survey (`/survey/:year`) — `show-controller/src/pages/SurveyPage.jsx`
- Global Cmd+K palette (mounted app-wide at `App.jsx:52`) — `show-controller/src/components/crm/CommandPalette.jsx`
- Pre-Production Alerts panel on Home — `show-controller/src/pages/HomePage.jsx:643`

**Known gaps:**
- **Hardcoded dead host:** all 8 outreach/parse fetches in `CommentaryPage.jsx` (lines 199, 219, 243, 264, 287, 324) and `TalentProfilePage.jsx` (197, 257) point at `https://api.commentarygraphic.com` instead of `SERVER_URL`; that EC2 was torn down, so every outreach button, "Copy Booking Link", note-parse and screenshot-parse fails in the current local-dev environment.
- **Missing endpoint:** `POST /api/talent/:talentId/communication-log` (`CommentaryPage.jsx:324`) has no server implementation — the "Yes, I sent it via iMessage" confirmation always errors, so the iMessage half of every outreach action is never logged.
- **Discovery is non-functional twice over:** `parseRosterHTML` returns `[]` unconditionally (`talentDiscoveryService.js:213-220`) and `fetchAlumniRoster` throws for every school; separately `useCoordinator()` never exports `coordinatorUrl`, so the request URL is literally `undefined/api/talent/discover`. `verify-phase4-discovery.png` only shows the empty form — no candidate was ever returned.
- **Data-shape mismatches from the migration:** `server/scripts/migrateCommentaryCSV.js:249,254,242` writes `surveyAvailability` and `otherInterests` as **strings** and `commentaryRole` as `'pbp'|'analyst'|'both'`. Consequences confirmed against live data — (a) `CommentaryPage.jsx:130` tests `t.surveyAvailability?.[compId] === true`, which can never be true, so the "Available" tab shows nothing from survey data; (b) `TalentProfilePage.jsx:653` calls `.map()` on `talent.otherInterests`, a TypeError for every migrated record with a non-empty string (e.g. `tiara-detommaso` = `"Producer, Commentator"`); (c) `TalentPage.jsx:38-43` role filter options (`'Play by Play / Lead'` etc.) never match the stored `'pbp'`/`'both'`.
- **Alert path bug:** `useProductionAlerts.js:86` checks `competition.preProductionMeetingScheduled` at the competition root, but the server writes that field to `competitions/{compId}/commentary/{talentId}` (`server/index.js:3831`) — the "schedule pre-production" alert can never clear.
- **Env-gated with no evidence the env was ever set:** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN` and `ANTHROPIC_API_KEY` are required by the PRD (lines 92-96, 117-119) but appear in no `.env.example`, `coordinator.env.example`, or `env-coordinator-example.txt`; zero `communicationLog` or `parsedAvailability` nodes exist in Firebase, which is what a successful send/parse would have created.
- **Survey has no consumer:** `SurveyPage` writes `surveyResponses/{year}/{pushKey}` and nothing in the codebase ever reads that path — the PRD's "coordinator manually triggers the merge" step was never built; the working path is the Google-Form-CSV importer on SettingsPage. The root key does not exist in Firebase.
- **Booking tokens:** world-writable per the PRD's own security note, no revocation; server checks nothing at generation time (the two live tokens point at `wcgnic-2026-team-finals`, a competition that isn't in Firebase). Duplicate tokens for the same talent+comp are freely minted.
- **No sync to on-air talent:** the rundown/Talent View read `competitions/{compId}/production/talent` (`views/TalentView.jsx:98`, `RundownEditorPage.jsx:663`) and fall back to hardcoded dummy names; nothing copies a confirmed CRM assignment there — `competitions/wcgnic-2026-prelim1/production/talent` does not exist even though `commentary` does.
- No tests anywhere: no `server/__tests__` file touches `talentRoster`, `gmailService` or `talentDiscoveryService`; no client tests exist.
- No rate limit on the two Claude endpoints (PRD flags the cost exposure); no CAPTCHA on the public survey.
- `reminderEmail()` in `gmailService.js:140` is exported and imported by `server/index.js:38` but never called — no follow-up path is wired.

**Evidence of live use:**
- Firebase `competitions/wcgnic-2026-prelim1/commentary` — `kevin-copp` (pbp, confirmed, "Available Fri + Sat, not Sunday"), `marcela-bonifasi` (analyst, confirmed)
- Firebase `competitions/wcgnic-2026-prelim2/commentary` — `tavia-smith`, `tiara-detommaso` both confirmed analysts with per-session availability notes
- Firebase `competitions/wcgnic-2026-event-finals/commentary` — `andrea-maldonado`, `christina-chauvenet` (pbp, "Rate $250/session. Doing 2-3 b-roll interviews.")
- Firebase `talentRoster` — 482 records with real contact data, `surveyCompleted: true` and 2026 tech-survey fields
- Firebase `bookingTokens` — 2 real tokens generated 2026-03-22 for WCGNIC team finals, never responded to
- `docs/PRD-Commentary-Talent-CRM/availability-notes.md` — hand-kept availability for William & Mary vs Alaska (Mar 12 / Mar 14 2026) naming confirmed and conflicted talent
- `docs/PRD-Commentary-Talent-CRM/Master 2026_ Commentary Tracker - 2026 Assignment.csv` (82 rows) and `- Commentators 2026.csv` (453 rows, header "Total: 428 | 2026 Survey: 28") — the source-of-truth sheet this replaced
- `docs/PRD-Commentary-Talent-CRM/screenshots/verify-task-F3-crm-complete.png` — authenticated `/talent` showing 448 contacts (28 Ready / 124 Has Contact / 16 Did Prior / 280 Need Info)
- `docs/WCGNIC-2026/` contains only graphics showcase screenshots — no CRM usage artifacts there
- Counter-evidence: `verification-log.html` records every Phase 3/4/5 check as a UI-render screenshot only; the owner's own rejection notes read "I don't see any of that" and "How do I even know if I've sent her contact information or if I haven't"

**PRDs / docs:**
- `docs/PRD-Commentary-Talent-CRM/PRD-Commentary-Talent-CRM-2026-03-10.md` (Phases 0–10, incl. security notes)
- `docs/PRD-Commentary-Talent-CRM/implementation-plan.md` (48 tasks, all marked COMPLETE 2026-03-17)
- `docs/PRD-Commentary-Talent-CRM/verification-log.html` (per-task screenshots + rejection reasons)
- `docs/PRD-Commentary-Talent-CRM/availability-notes.md`
- `docs/PRD-Commentary-Talent-CRM/logs/summary.log` (loop iterations 31→48 tasks)
- `server/scripts/migrateCommentaryCSV.js` (521 lines — Phase 0 migration)
