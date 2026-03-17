# Commentary Talent CRM — Implementation Plan

**PRD:** PRD-Commentary-Talent-CRM-2026-03-10.md

> **Phase 1 (Talent Roster UI) is already complete.** Phases 0, 2, 3, 4, 5 are COMPLETE. Phases 6-10 (UI Overhaul) are NOT STARTED.

---

## Phases Overview

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| Phase 0 | Data Migration Script | 1 | COMPLETE |
| Phase 0-Deploy | Run migration + verify Firebase | 1 | COMPLETE |
| Phase 2 | Booking Links + Smart Availability | 6 | COMPLETE |
| Phase 2-Deploy | Deploy Phase 2 changes | 1 | COMPLETE |
| Phase 3 | Gmail + Google Calendar Outreach | 5 | COMPLETE |
| Phase 3-Deploy | Deploy Phase 3 changes | 1 | COMPLETE |
| Phase 4 | AI-Powered Talent Discovery | 5 | COMPLETE |
| Phase 4-Deploy | Deploy Phase 4 changes | 1 | COMPLETE |
| Phase 5 | Annual Survey + Pre-Production Alerts | 6 | COMPLETE |
| Phase 5-Deploy | Deploy Phase 5 changes | 1 | COMPLETE ✓ |
| Final-Deploy (Phases 0-5) | Full acceptance criteria check | 2 | COMPLETE |
| Phase 6 | UI Foundation: Competition index endpoint + cross-competition data hook + design tokens | 3 | COMPLETE |
| Phase 7 | TalentPage table view + assignment/availability columns | 4 | NOT STARTED |
| Phase 8 | CommentaryPage: kebab menu + conflict badges + kanban | 3 | NOT STARTED |
| Phase 9 | TalentProfilePage: collapsible sections + activity timeline | 2 | NOT STARTED |
| Phase 10 | Power features: Cmd+K, saved filters, bulk ops | 3 | NOT STARTED |
| **Total** | | **45** | |

---

## Phase 0: Data Migration Script

> **Deploy rule:** This is a server-side script, not a frontend build. The deploy task runs the script
> directly (no npm build needed). Firebase-only changes.

### Task 0.1: Create CSV migration script — COMPLETE

**File:** `server/scripts/migrateCommentaryCSV.js` (new file)

**Change:** Create a Node.js script with the following behavior:

```javascript
// Usage: node server/scripts/migrateCommentaryCSV.js [--dry-run]
//
// Reads 3 CSVs:
//   docs/PRD-Commentary-Talent-CRM/Master 2026_ Commentary Tracker - Commentators 2026.csv
//   docs/PRD-Commentary-Talent-CRM/Master 2026_ Commentary Tracker - 2026 Assignment.csv
//   docs/PRD-Commentary-Talent-CRM/Official Virtius Remote Commentary 2026 (Responses) - Form Responses 1 (6).csv
//
// Writes to Firebase: talentRoster/{talentId}
// Status mapping: "Ready" → "ready", "Did 2025" → "did-2025", "Need Info" → "need-info", "Has Contact" → "has-contact"
// Role mapping: "Play by Play / Lead" → "pbp", "Color / Analyst" → "analyst", "Does not matter" → "both"
// Dry-run: prints summary, no writes
// Flags: malformed phone/email, fuzzy duplicate names (>90% Levenshtein similarity)
// Outputs log: server/scripts/migration-log.json
// Summary line: "X created, Y enriched (survey), Z assignments added, N flagged"
```

**Firebase Admin initialization (required in script):**
```javascript
const path = require('path');
const admin = require('firebase-admin');
// Must run with GOOGLE_APPLICATION_CREDENTIALS set (same as coordinator server)
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.database();
```

**CSV path resolution:** Use `path.resolve(__dirname, '../../', 'docs/PRD-Commentary-Talent-CRM/...')` — paths are relative to the script file, not `process.cwd()`.

**talentId format:** Generate as sanitized lowercase-dashed name: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')`. If a collision is detected (same key, different email), append `-2`, `-3` etc. This format is consistent with how other roster entries reference talent across phases.

**Idempotency:** Before writing each record, check `talentRoster/{talentId}`. If it exists (match by email), UPDATE (merge) rather than overwrite. Log "enriched" for updates, "created" for new records.

**compId mapping for history:** The assignment CSV has meet names/dates, not Firebase push-key IDs. There is no lookup table. Write `competitionHistory` using the raw meet name as a placeholder compId (e.g., `"2025-01-18-stanford-vs-cal"`). This data is informational; the `compId` field is best-effort and will not link to live Firebase competition records.

Use `csv-parse` for CSV parsing (install if not present). Use a simple Levenshtein function for duplicate detection.

**Schema written to Firebase:**
```json
{
  "name": "First Last",
  "phone": "+1...",
  "email": "...",
  "wagMag": "WAG | MAG | Both",
  "commentaryRole": "pbp | analyst | both",
  "status": "ready | has-contact | did-2025 | need-info",
  "affiliation": "...",
  "conference": "...",
  "canProduce": true,
  "notes": "...",
  "competitionHistory": [{ "compId": "...", "role": "pbp", "date": "..." }],
  "surveyCompleted": true,
  "textSent": true,
  "discordAdded": false,
  "internetUploadMbps": 50,
  "internetDownloadMbps": 100,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

**Implements:** Phase 0 acceptance criteria (dry-run, 428 contacts, survey enrichment, assignments, flagging)

---

## Phase 0-Deploy: Run Migration + Verify

> **This is a deploy/run task.** No build needed — just run the script and verify Firebase.

### Task 0-D.1: Run migration and verify data in Firebase — COMPLETE

**Steps:**
1. Create screenshots directory: `mkdir -p docs/PRD-Commentary-Talent-CRM/screenshots`
2. Dry-run first: `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json node server/scripts/migrateCommentaryCSV.js --dry-run`
3. Review output — confirm counts look correct (expect ~428 contacts)
4. Live run: `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json node server/scripts/migrateCommentaryCSV.js`
5. Navigate to `https://commentarygraphic.com/talent` with Playwright
6. Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase0-talent-list.png`
7. Verify talent count shown matches expected (~428)

**Checks:**
- [ ] No crash during dry-run
- [ ] Live run creates records in Firebase `talentRoster/`
- [ ] Talent page shows records (not empty)
- [ ] migration-log.json exists and lists flagged rows

---

## Phase 2: Booking Links + Smart Availability

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 2-Deploy.
> **Prerequisite:** `ANTHROPIC_API_KEY` must be set in server `.env` on `44.193.31.120` (used by Task 2.4 note parsing endpoint).

### Task 2.1: Add booking token server endpoints — COMPLETE ✓

**Status:** Already implemented at server/index.js:2855-2904

**File:** `server/index.js`

**Architecture note:** `BookingPage` is a public page accessed by talent (no login, no session). The coordinator server (`44.193.31.120:3003`) has an auto-shutdown feature and may be offline when a talent clicks a link 2 weeks later. The frontend has no established pattern for calling the coordinator directly from the browser.

**Solution: BookingPage reads/writes Firebase directly, not via coordinator.** Only the token generation endpoint (called by the authenticated coordinator UI) goes through the coordinator server. All public-facing operations use Firebase with appropriate security rules.

```javascript
// POST /api/book/generate — creates a booking token (coordinator-side, auth required)
// Body: { talentId, compId, role }
// Writes: bookingTokens/{uuid} = { talentId, compId, role, createdAt, expiresAt (30 days from now, ISO), responded: false }
// Also updates: competitions/{compId}/commentary/{talentId}.status = 'invited', invitedAt = now
// Returns: { token, url: `https://commentarygraphic.com/book/${uuid}` }
```

**Public-facing (BookingPage reads Firebase directly, no coordinator):**
```javascript
// BookingPage reads these Firebase paths directly:
//   bookingTokens/{token}          → token metadata (talentId, compId, role, expiresAt, responded)
//   competitions/{compId}/config   → { eventName, meetDate, venue }
//   talentRoster/{talentId}        → { name }
//
// BookingPage writes these Firebase paths directly:
//   On "Yes":
//     competitions/{compId}/commentary/{talentId}: { status: 'confirmed', confirmedAt: now }
//     bookingTokens/{token}: { responded: true, response: 'yes' }
//
//   On "No" (save interested comps):
//     For each selected compId: talentRoster/{talentId}/interested/{compId} = true
//     (keyed object, not array — avoids overwriting previous interests)
//     bookingTokens/{token}: { responded: true, response: 'no' }
//
// BookingPage fetches upcoming competitions from Firebase:
//   competitions/ — filter by config.meetDate > now, exclude original compId
//   Show next 5 sorted by meetDate asc
//
// Expiry + double-response guards (client-side):
//   If token.expiresAt < now → show "This link has expired"
//   If token.responded === true → show "You've already responded"
```

**Firebase security rules update required** (in `database.rules.json`):
```json
"bookingTokens": {
  "$token": {
    ".read": true,
    ".write": "auth == null || auth != null"
  }
}
```
(public read of token; public write to `responded` and `response` fields — scope carefully)

**Implements:** Booking token generation, Yes/No response flow

---

### Task 2.2: Create public BookingPage — COMPLETE ✓

**Status:** Already implemented at show-controller/src/pages/BookingPage.jsx

**File:** `show-controller/src/pages/BookingPage.jsx` (exists)

**Change:** Create a public page (no auth required) that reads/writes Firebase directly (NOT the coordinator server — see Task 2.1 architecture note):
- Imports `{ db, ref, get, update, set }` from `../lib/firebase`
- Reads `bookingTokens/{token}`, `competitions/{compId}/config`, `talentRoster/{talentId}` on load
- Guards: if token expired → "This link has expired"; if already responded → "You've already responded"
- Shows: competition eventName, meetDate, venue, talent's name, assigned role
- Has two primary buttons: "Yes, I'm available" and "No, not this one"
- On "Yes": writes to Firebase directly (see Task 2.1), shows confirmation screen
- On "No": queries `competitions/` from Firebase, filters meetDate > now, shows next 5 as checkboxes; submit writes `talentRoster/{talentId}/interested/{compId} = true` for each checked
- Mobile-first layout (talent opens this on their phone)
- No navbar, no auth, standalone page with minimal styling

Reference `../lib/firebase` import pattern from `useCommentaryStaff.js`.

**Implements:** Public booking response flow

---

### Task 2.3: Add public route for booking page — COMPLETE

**File:** `show-controller/src/App.jsx`

**Change:** Add `/book/:token` route that renders BookingPage without auth guard:

```jsx
// CRITICAL: Place BEFORE the <Route path="/:compId"> wildcard (App.jsx line ~101)
// or the router will treat "book" as a competition ID.
// App.jsx has no global auth wrapper — just insert before the /:compId route.
<Route path="/book/:token" element={<BookingPage />} />
```

There is no global auth wrapper in App.jsx (only `<CoordinatorGate>` wraps `/_admin/vm-pool`).
The route must be placed before `<Route path="/:compId" element={<CompetitionLayout />}>`.
Read App.jsx first to confirm placement.

**Implements:** Public access to booking page

---

### Task 2.4: Add note parsing endpoint — COMPLETE

**File:** `server/index.js`

**Change:** Add a new endpoint that calls Claude API to extract date hints from talent notes:

```javascript
// POST /api/talent/:talentId/notes/parse
// Body: { noteText: "She's available late February but busy Jan 15" }
// Calls Claude API (claude-haiku-4-5-20251001) with prompt:
//   "Extract any date mentions or availability hints from this note.
//    Return JSON: { availablePeriods: ['late February'], unavailableDates: ['January 15'] }"
// Writes parsed hints to talentRoster/{talentId}.parsedAvailability = { ... }
// Returns: { availablePeriods, unavailableDates }
```

Requires `ANTHROPIC_API_KEY` in server `.env`. Use the `@anthropic-ai/sdk` package.

**Implements:** AI note parsing for availability tracking

---

### Task 2.5: Add "Interested" badge + note parsing trigger to TalentProfilePage — COMPLETE

**File:** `show-controller/src/pages/TalentProfilePage.jsx`

**Change:**
1. When a note is saved (existing "Save Notes" button), also call `POST /api/talent/:talentId/notes/parse` with the note text
2. Show any parsed availability periods as small tags below the notes field: `Available: late February` (green), `Busy: January 15` (red)
3. These tags are read from `talent.parsedAvailability.availablePeriods` and `unavailableDates`

**Implements:** Visual feedback for AI-parsed availability

---

### Task 2.6: Add booking link generation + Interested badge to CommentaryPage — COMPLETE

**File:** `show-controller/src/pages/CommentaryPage.jsx`

**Change:**
1. Next to each assigned talent in the assignments list, add a small "🔗 Copy Link" button
2. Clicking "🔗 Copy Link" calls `POST /api/book/generate` with `{ talentId, compId, role }`, then copies the returned URL to clipboard
3. Show a small "Copied!" toast for 2 seconds
4. In the talent search panel (right side), show an "Interested" badge (green pill: "Interested ✓") next to any talent whose `talentRoster/{id}.interested` array contains the current `compId`

**Implements:** Booking link generation, interested badge in assignment panel

---

## Phase 2-Deploy: Deploy Phase 2 Changes

> **This is a deploy task.** Build frontend + deploy coordinator server changes.

### Task 2-D.1: Build, deploy, and verify Phase 2 — COMPLETE

**Frontend changed?** Yes (`BookingPage.jsx`, `App.jsx`, `CommentaryPage.jsx`, `TalentProfilePage.jsx`)
```bash
cd show-controller && npm run build
# then upload dist per CLAUDE.md Step 1
```

**Server changed?** Yes (`server/index.js` — new endpoints)
```bash
# SSH to coordinator (44.193.31.120)
# cd /opt/gymnastics-graphics
# git pull origin main
# pm2 restart coordinator (with GOOGLE_APPLICATION_CREDENTIALS per CLAUDE.md)
```

**Deployment Status:** ✅ COMPLETE (frontend deployed, server restarted)

**Firebase rules:** ✅ Updated manually in Firebase Console (2026-03-11)

**Verify:**
- [ ] Navigate to `/talent` — no console errors
- [ ] Open a competition's commentary page — "🔗 Copy Link" button appears next to assignments
- [ ] Navigate to `/book/test-token-invalid` — BookingPage loads with graceful error (not permission denied)
- [x] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase2-booking-link.png`

---

## Phase 3: Gmail + Google Calendar Outreach

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 3-Deploy.
> **Prerequisite:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` must be set in server `.env` on `44.193.31.120`.

### Task 3.1: Create Gmail service — COMPLETE

**File:** `server/lib/gmailService.js` (new file)

**Change:** Create a Gmail OAuth service using `googleapis` npm package:

```javascript
// gmailService.js exports:
// sendEmail({ to, subject, html }) — sends via coordinator's Gmail account
// Uses OAuth2 with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN from process.env
// Returns message ID on success, throws on failure

// Email templates (inline):
// - inviteEmail(talent, competition, role, bookingUrl) → HTML invite with event details + booking link
//   NOTE: bookingUrl is required — the invite endpoint (Task 3.3) must generate the token FIRST
// - briefingEmail(talent, competition, virtiusUrl, discordInfo, preProdTime) → HTML briefing
// - reminderEmail(talent, competition, bookingUrl) → HTML reminder with booking link
```

Install `googleapis` if not already in `server/package.json`.

**Implements:** Gmail outreach capability

---

### Task 3.2: Create Google Calendar service — COMPLETE

**File:** `server/lib/googleCalendarService.js` (new file)

**Change:** Create a GCal service using `googleapis`:

```javascript
// googleCalendarService.js exports:
// createCompetitionEvent({ talentEmail, competitionName, startTime, discordInfo })
//   → Creates GCal event 1 hour before startTime, adds talent as attendee
//   → Returns eventId
//
// createPreProdMeeting({ talentEmail, meetingTime, competitionName })
//   → Creates GCal event at meetingTime
//   → Returns eventId
```

**Implements:** Calendar invite capability

---

### Task 3.3: Add outreach API endpoints — COMPLETE

**File:** `server/index.js`

**Change:** Add outreach endpoints (import gmailService and googleCalendarService at top):

```javascript
// POST /api/commentary/:compId/:talentId/invite
//   Step 1: Generate a booking token (reuse Task 2.1 token generation logic)
//           bookingTokens/{uuid} = { talentId, compId, role, ... }
//           bookingUrl = `https://commentarygraphic.com/book/${uuid}`
//   Step 2: Send invite email via gmailService.sendEmail(inviteEmail(talent, competition, role, bookingUrl))
//   Step 3: Update competitions/{compId}/commentary/{talentId}: { status: 'invited', invitedAt: now }
//   Step 4: Append to communicationLog (see log shape below)

// POST /api/commentary/:compId/:talentId/briefing
//   Body: { virtiusUrl: string, discordInfo: string, preProdTime: ISO string }
//   All three fields are required — return 400 if any are missing
//   Sends briefing email, updates .briefedAt = now, status = 'briefed'
//   Appends to communicationLog

// POST /api/commentary/:compId/:talentId/calendar-invite
//   Creates GCal event 1 hour before competition start (read meetDate from competitions/{compId}/config)
//   Updates .calendarInviteSent = true
//   Appends to communicationLog

// POST /api/commentary/:compId/:talentId/schedule-preproduction
//   Body: { meetingTime: ISO string }
//   Creates pre-prod GCal event, adds talent as attendee
//   Updates .preProductionMeetingScheduled = meetingTime
//   Appends to communicationLog

// communicationLog — use Firebase push keys, NOT an array:
//   talentRoster/{talentId}/communicationLog/{pushKey} = { type, sentAt, note }
//   Firebase RTDB has no arrayUnion — push keys avoid read-then-write race conditions
// Log entry shape: { type: 'invite'|'briefing'|'calendar'|'preproduction'|'imessage', sentAt: ISO, note: '...' }
```

**Implements:** All outreach server actions

---

### Task 3.4: Add outreach buttons to CommentaryPage — COMPLETE

**File:** `show-controller/src/pages/CommentaryPage.jsx`

**Change:** In the assignment detail view (when a talent card is expanded/selected):
1. Add outreach action buttons: "Send Invite", "Send Briefing", "Calendar Invite", "Schedule Pre-Prod"
2. "Send Invite" calls endpoint directly (endpoint generates token internally — no extra input needed)
3. "Send Briefing" must open a small modal first to collect 3 required fields:
   - Virtius session URL (text input)
   - Discord info (text input, e.g. room name/link)
   - Pre-production meeting time (datetime-local input)
   Only after the coordinator fills these and clicks "Send" does the modal call the briefing endpoint.
   Without this modal, the briefing endpoint has no data to put in the email.
4. "Schedule Pre-Prod" opens a datetime picker modal; submits `{ meetingTime }` to endpoint
5. Each button has a sibling "📋 Copy for iMessage" button that:
   - Formats the same message as the email (plain text)
   - Copies to clipboard
   - Shows: "Sent via iMessage?" → [Yes] → logs `{ type: 'imessage', sentAt: now }` to server
6. Show a "Sent ✓" indicator when the server confirms the email was sent

**Implements:** Coordinator-facing outreach UI

---

### Task 3.5: Add screenshot upload + communications tab to TalentProfilePage — COMPLETE

**File:** `show-controller/src/pages/TalentProfilePage.jsx`

**Change:**
1. Add a "Communications" tab alongside the existing profile sections
2. Communications tab shows `talent.communicationLog` entries sorted by `sentAt` desc, showing type + timestamp + note
3. Add a "Upload Screenshot" button — accepts image file, converts to base64, sends to a new endpoint `POST /api/talent/:talentId/parse-screenshot` which calls Claude API vision to extract availability text from the screenshot
4. Extracted text appears as a new note with prefix `[From screenshot] ` and triggers note parsing

Add new server endpoint:
```javascript
// POST /api/talent/:talentId/parse-screenshot
// Body: { imageBase64, mimeType }
// Calls Claude API with image, extracts availability mentions
// Returns: { extractedText, availablePeriods, unavailableDates }
// Writes extracted note to talent's notes field (prepended)
//
// IMPORTANT: Add body size limit for this endpoint — screenshots base64-encoded are 2–7MB.
// Express default JSON limit is 100KB. Add before this route:
//   app.use('/api/talent/:talentId/parse-screenshot', express.json({ limit: '10mb' }));
```

**Implements:** Communication log UI, screenshot-to-availability parsing

---

## Phase 3-Deploy: Deploy Phase 3 Changes

> **This is a deploy task.**

### Task 3-D.1: Build, deploy, and verify Phase 3 — COMPLETE

**Frontend changed?** Yes
```bash
cd show-controller && npm run build
# upload dist per CLAUDE.md Step 1
```

**Server changed?** Yes (new lib files + endpoints)
```bash
# SSH to 44.193.31.120
# git pull && npm install (for googleapis)
# pm2 restart coordinator with credentials
```

**Verify:**
- [ ] Open commentary page for a competition that has assigned talent
- [ ] "Send Invite" button appears — clicking shows "Sent ✓" or a clear error message
- [ ] "📋 Copy for iMessage" button copies text to clipboard (verify text is non-empty)
- [ ] TalentProfilePage has "Communications" tab that renders without errors
- [ ] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase3-outreach.png`

---

## Phase 4: AI-Powered Talent Discovery

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 4-Deploy.
> **Prerequisite:** `ANTHROPIC_API_KEY` must be set in server `.env` on `44.193.31.120`.

### Task 4.1: Create talent discovery service — COMPLETE

**File:** `server/lib/talentDiscoveryService.js` (new file)

**Change:** Create a service that:

```javascript
// discoverAlumni(schoolName) → Promise<CandidateCard[]>
//
// Step 1: Fetch RTN alumni roster page for the school
//   URL pattern: https://www.rtnathletics.com/teams/{slug}/roster (research correct URL)
//   Parse HTML for athlete names, graduation years
//
// Step 2: Score ALL athletes in ONE Claude API call (NOT one call per athlete)
//   CRITICAL: N+1 calls (one per athlete) = 50-300 seconds for a typical roster → HTTP timeout.
//   Instead, batch all athletes into a single prompt:
//   "Here is a list of former collegiate gymnasts from {school}. For each person,
//    rate their suitability as a remote gymnastics commentator (1-5). Consider:
//    years competed, graduation year (more recent = more relevant).
//    Do NOT guess social media URLs — return null for linkedIn and instagram.
//    Return a JSON array: [{ name, score, explanation, linkedIn: null, instagram: null }, ...]"
//
//   Include all names + graduation years in the prompt.
//   Parse the returned JSON array.
//
//   NOTE on social links: Claude does not have real-time web access and cannot reliably find
//   specific athletes' social accounts. Always instruct Claude to return null for social links.
//   The UI should label any non-null links as "Unverified — may not be correct."
//   If social link discovery is desired later, use a separate web-search step.
//
// Step 3: Return array of CandidateCards:
//   { name, school, graduationYear, score, explanation, linkedIn: null, instagram: null, rtnAthleteId }
//
// Dedup check: compare against talentRoster in Firebase by name fuzzy match
// Mark alreadyInRoster: true if found

// CandidateCard shape returned to API caller
```

**Implements:** RTN scraping + Claude scoring

---

### Task 4.2: Add talent discovery server endpoint — COMPLETE

**File:** `server/index.js`

**Change:**
```javascript
// POST /api/talent/discover
// Body: { schoolName }
// Calls talentDiscoveryService.discoverAlumni(schoolName)
// Returns: { candidates: CandidateCard[], school: schoolName }

// POST /api/talent/discover/add
// Body: { candidate: CandidateCard }
// Creates talentRoster entry:
//   status: 'need-info'  ← always; CandidateCard has no email field (RTN doesn't expose emails)
//   discoveredFrom: 'rtn-alumni'
//   name, school (→ affiliation), linkedIn (null per Task 4.1), instagram (null per Task 4.1)
// Returns: { talentId }
```

**Implements:** Discovery API endpoints

---

### Task 4.3: Create TalentDiscoveryPage — COMPLETE

**File:** `show-controller/src/pages/TalentDiscoveryPage.jsx` (new file)

**Change:** Create a discovery UI page:
1. Header: "Discover Talent" with back link to `/talent`
2. School picker: text input + "Find Candidates" button
3. Loading state while server fetches/scores candidates
4. Candidate cards grid: name, school, graduation year, score (★★★★☆), explanation, social links
5. Each card: "Add to Roster" button (calls `/api/talent/discover/add`) and "Already in Roster" badge if `alreadyInRoster`
6. After adding, the card shows "Added ✓" and disables the button

Reference existing card-based UI patterns from TalentPage.jsx.

**Implements:** Discovery page UI

---

### Task 4.4: Add discovery route to App.jsx — COMPLETE

**File:** `show-controller/src/App.jsx`

**Change:** Add route for talent discovery (auth-protected, coordinators only):
```jsx
<Route path="/talent/discover" element={<TalentDiscoveryPage />} />
```

Place BEFORE the `/talent/:talentId` route to avoid the param catching `/talent/discover`.

**Implements:** Route for discovery page

---

### Task 4.5: Wire "Discover Talent" button in TalentPage — COMPLETE

**File:** `show-controller/src/pages/TalentPage.jsx`

**Status:** Already implemented at lines 124-130. The "Discover Talent" button uses a `<Link to="/talent/discover">` component from react-router-dom, which correctly navigates to the discovery page. No changes needed.

**Implements:** Navigation entry point to discovery

---

## Phase 4-Deploy: Deploy Phase 4 Changes

> **This is a deploy task.**

### Task 4-D.1: Build, deploy, and verify Phase 4 — COMPLETE

**Frontend changed?** Yes
```bash
cd show-controller && npm run build
# upload dist per CLAUDE.md Step 1
```

**Server changed?** Yes
```bash
# SSH to 44.193.31.120
# git pull && npm install
# pm2 restart coordinator with credentials
```

**Verify:**
- [x] Navigate to `/talent` → "Discover Talent" button → navigates to `/talent/discover`
- [x] TalentDiscoveryPage renders with school input and button
- [x] Searching for a school returns candidate cards (or a clear error if ANTHROPIC_API_KEY not set)
- [x] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase4-discovery.png`

---

## Phase 5: Annual Survey + Pre-Production Alerts

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 5-Deploy.

### Task 5.1: Create public SurveyPage — COMPLETE

**File:** `show-controller/src/pages/SurveyPage.jsx` (new file)

**Change:** Create a public survey page at `/survey/:year`:
- No auth required
- Reads `competitions/` from Firebase directly to populate availability checkboxes (filter by config.meetDate > now, show eventName + meetDate)
- Fields: name, email, WAG/MAG selection, competition availability checkboxes, internet upload/download Mbps, mic type (text), has headphones (checkbox), Discord username, role preference (PBP / Analyst / Either)
- Submit writes to `surveyResponses/{year}/{pushKey}` in Firebase (see approach below)
- Confirmation screen: "Thanks! We'll be in touch."

**Write approach (definitive):** Write to `surveyResponses/{year}/{pushKey}`, NOT directly to `talentRoster/`. Opening `talentRoster/` to unauthenticated writes would allow anyone to corrupt talent profiles. The `surveyResponses/` path is append-only by unauthenticated users.

**Firebase security rules update required** — add to `database.rules.json`:
```json
"surveyResponses": {
  "$year": {
    ".write": true,
    ".read": "auth != null"
  }
}
```

**Survey record written to `surveyResponses/{year}/{pushKey}`:**
```json
{
  "name": "First Last",
  "email": "...",
  "wagMag": "WAG | MAG | Both",
  "surveyAvailability": { "compId1": true, "compId2": true },
  "internetUploadMbps": 50,
  "internetDownloadMbps": 100,
  "micType": "...",
  "hasHeadphones": true,
  "discordUsername": "...",
  "commentaryRole": "pbp | analyst | both",
  "submittedAt": "ISO timestamp",
  "surveyYear": 2027
}
```

NOTE: `surveyAvailability` is a keyed object — Task 5.3's filter reads from `talentRoster` (after merge), not directly from `surveyResponses`. The Settings page CSV import (Task 5.6) is also used to merge survey responses into `talentRoster` by email after the season.

Reference [BookingPage.jsx](../show-controller/src/pages/BookingPage.jsx) for public (no-auth) Firebase write patterns.

**Implements:** Annual talent survey

---

### Task 5.2: Add survey route to App.jsx — COMPLETE

**File:** `show-controller/src/App.jsx`

**Change:** Add public survey route (no auth guard):
```jsx
// CRITICAL: Place BEFORE the <Route path="/:compId"> wildcard (App.jsx line ~101)
// or the router will treat "survey" as a competition ID.
// Also place /book/:token here at the same time if not already done.
<Route path="/survey/:year" element={<SurveyPage />} />
```

There is no global auth wrapper — just insert before `<Route path="/:compId" element={<CompetitionLayout />}>`.

**Implements:** Public survey access at `/survey/2027`

---

### Task 5.3: Add smart "Available Talent" filter to CommentaryPage — COMPLETE

**File:** `show-controller/src/pages/CommentaryPage.jsx`

**Change:** In the talent search panel (right side), add an "Available" tab alongside existing search:
1. "Available" tab filters talent by:
   - `talent.interested?.[compId] === true` (flagged via booking link "No" flow), OR
   - `talent.surveyAvailability?.[compId] === true` (checked this competition in survey)
   - AND status is `ready` or `has-contact`
   - AND no same-day booking conflict: check other competitions with same `config.meetDate`, exclude talent who have `confirmed` status there
   NOTE: Same-day conflict check requires reading all competitions from Firebase — load them via the existing `useCompetitions` hook data already available on this page.
2. Add "📋 Copy talent list" button above the list — copies `Name — Phone\n` lines for each available talent to clipboard

**Implements:** Smart available talent filtering + copy list

---

### Task 5.4: Create useProductionAlerts hook — COMPLETE

**File:** `show-controller/src/hooks/useProductionAlerts.js` (new file)

**Change:** Create a React hook that scans Firebase for upcoming competitions and generates alert objects:

```javascript
// useProductionAlerts() → { alerts: Alert[], loading }
//
// Competition date field: competitions/{compId}/config.meetDate (ISO date string "YYYY-MM-DD")
// Parse with: new Date(competition.config?.meetDate)
// Only process competitions with a valid meetDate > now (skip past competitions)
//
// Alert types generated by scanning competitions + commentary/:talentId:
// - 'start-outreach': daysUntil(meetDate) <= 42 (6 weeks) AND no commentary assigned at all
// - 'no-confirmed': daysUntil(meetDate) <= 21 (3 weeks) AND no talent has status 'confirmed'
// - 'send-calendar': talent.status === 'confirmed'
//                    AND talent.calendarInviteSent !== true
//                    AND daysUntil(meetDate) <= 28 (4 weeks)  ← time fence required
//                    (Without the 4-week fence, every confirmed talent for future meets floods the dashboard)
// - 'schedule-preproduction': daysUntil(meetDate) <= 7 (1 week)
//                              AND preProductionMeetingScheduled is falsy
// - 'follow-up': talent.status === 'invited'
//                AND talent.invitedAt is defined
//                AND daysSince(invitedAt) > 5
//                (status becomes 'invited' when Task 3.3 invite endpoint is called —
//                 the endpoint sets status='invited' AND invitedAt=now)
//
// Alert shape: { id, type, message, compId, talentId (optional), compName, talentName (optional) }
// Refreshes in real-time via Firebase onValue listener on competitions/
```

**Implements:** Alert engine for pre-production reminders

---

### Task 5.5: Add pre-production alert panel to HomePage — COMPLETE

**File:** `show-controller/src/pages/HomePage.jsx`

**IMPORTANT:** The plan originally referenced `DashboardPage.jsx`, but that file has no route in App.jsx (the `/dashboard` path redirects to `/`). DashboardPage.jsx is not rendered anywhere. The PRD says "my homepage shows a pre-production alert panel" — the homepage is `HomePage.jsx` at route `/`.

**Change:** Import `useProductionAlerts` and add an alert panel section to `HomePage.jsx`:
1. Alert panel appears at the top of the page, above the competition list
2. Each alert is a card with: icon (⚠ or 🔔), message, and an action button
3. Action buttons:
   - "Go to Commentary" → navigates to `/${compId}/commentary`
   - "Send Invite" → calls invite endpoint inline
   - "Send Calendar" → calls calendar endpoint inline
4. When an action is taken, the alert disappears (Firebase real-time will clear it)
5. If no alerts: show "✓ All caught up" with green background

Read `show-controller/src/pages/HomePage.jsx` first to understand existing layout before inserting.

**Implements:** Pre-production alert UI

---

### Task 5.6: Add CSV batch import to SettingsPage — COMPLETE

**File:** `show-controller/src/pages/SettingsPage.jsx` (new file)

**Note:** SettingsPage.jsx does not exist (verified during discovery). Create this file as a new page and add a route to App.jsx:
```jsx
// In App.jsx, add alongside other standalone tool pages (before /:compId wildcard):
import SettingsPage from './pages/SettingsPage';
// ...
<Route path="/settings" element={<SettingsPage />} />
```

**Change:** Add a "Batch Import" section to the settings page:
1. File input: accepts `.csv` files
2. "Preview Import" button: parses CSV client-side, shows a table of matches (matched by email) vs. new records
3. "Confirm Import" button: writes all matched records to Firebase (update existing) and new records (status: `need-info`)
4. Progress indicator + final summary: "X updated, Y created"

CSV format accepted: same columns as the Google Form export (match by email field).

**Implements:** CSV batch import for survey responses

---

## Phase 5-Deploy: Deploy Phase 5 Changes

> **This is a deploy task.**

### Task 5-D.1: Build, deploy, and verify Phase 5 — COMPLETE

**Frontend changed?** Yes
```bash
cd show-controller && npm run build
# upload dist per CLAUDE.md Step 1
```

**Server changed?** No (Phase 5 is Firebase-only from the client side)

**Verify:**
- [x] Navigate to `/survey/2027` — survey form renders without auth prompt
- [x] HomePage (`/`) shows alert panel (or "✓ All caught up" if no alerts)
- [x] CommentaryPage has an "Available" talent tab
- [x] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase5-survey.png`
- [x] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase5-alerts.png`

---

## Final-Deploy (Phases 0-5): Full Verification

### Task F.1: Full acceptance criteria check (Phases 0-5) — COMPLETE

Run through all acceptance criteria from the PRD using Playwright.
Screenshots: `docs/PRD-Commentary-Talent-CRM/screenshots/`

**Firebase Security Rules:** ✅ Updated manually in Firebase Console (2026-03-11)
```json
{
  "talentRoster": { ".read": "auth != null", "$talentId": { "interested": { ".write": true } } },
  "bookingTokens": { "$token": { ".read": true, ".write": true } },
  "surveyResponses": { "$year": { ".write": true, ".read": "auth != null" } }
}
```

**Phase 0 checks:**
- [x] Migration script ran successfully — Firebase contains 428+ contacts (verified via `firebase_get`)
- [x] `/talent` page deployed and renders correctly
- [x] Screenshot taken: `verify-phase0-talent-list.png`

**Phase 2 checks:**
- [x] BookingPage loads at `/book/test-invalid` — shows graceful error "This booking link is invalid or has expired"
- [x] Screenshot taken: `verify-phase2-booking-error.png`

**Phase 4 checks:**
- [x] `/talent/discover` loads with school input and "Find Candidates" button
- [x] Screenshot taken: `verify-phase4-discovery.png`

**Phase 5 checks:**
- [x] `/survey/2027` loads without login, shows full survey form
- [x] Screenshot taken: `verify-phase5-survey.png`
- [x] HomePage (`/`) shows alert panel with "All Caught Up" message
- [x] Screenshot taken: `verify-phase5-alerts.png`

**Summary:**
- All code deployed and Firebase rules updated
- All public pages (survey, booking, discovery) work without auth
- All authenticated pages (talent roster, commentary) properly gated

### Task F.2: Mark Phases 0-5 complete — COMPLETE

Update `PRD-Commentary-Talent-CRM-2026-03-10.md` status to `COMPLETE`. Commit.

---

## Phase 6: UI Foundation — Cross-Competition Data + Design Tokens

> **Every task must deploy + verify on production before being marked COMPLETE.**
> **Server change:** Task 6.0 adds a new server endpoint — deploy must include coordinator restart.

### Task 6.0: Add competition index server endpoint — COMPLETE

**File:** `server/index.js`

**Why this is needed:** Firebase RTDB client SDK has no shallow query — `get(ref(db, 'competitions'))` downloads the ENTIRE multi-MB competitions tree (scores, lineups, configs, rosters for 50+ competitions). The previous plan said "use `Object.keys()` to discover comp IDs" but that still downloads everything first. A server endpoint solves this by reading Firebase with the Admin SDK and returning only the minimal data needed.

**Change:** Add a lightweight endpoint that returns competition IDs + minimal metadata:

```javascript
// GET /api/competitions/index
// Returns: { [compId]: { eventName, meetDate, gender } }
// Implementation: reads competitions/ from Firebase Admin SDK,
//   extracts only config.eventName, config.meetDate, config.gender per competition
//   (Firebase Admin SDK can read efficiently from the server)
// Cache: Keep result in memory for 60 seconds (simple timestamp check)
//   to avoid repeated full reads on concurrent requests
```

This endpoint is called once by `useTalentAssignments` to discover competition IDs, then the hook does targeted `get()` calls on `competitions/{compId}/commentary` only.

**Implements:** Lightweight competition index for CRM queries

---

### Task 6.1: Create `useTalentAssignments` hook — COMPLETE

**File:** `show-controller/src/hooks/useTalentAssignments.js` (NEW)

**Why this is needed:** TalentPage currently only reads `talentRoster/`. Commentary assignments live at `competitions/{compId}/commentary/{talentId}` — completely siloed per competition. Without joining these, you can't see who is assigned to what, who was invited, or who has responded.

**PERFORMANCE WARNING:** `useCompetitions()` loads the ENTIRE `competitions/` tree (scores, lineups, configs, rosters — megabytes for 50+ competitions). TalentPage does NOT currently call `useCompetitions()`. Adding it would massively increase page load bandwidth.

**DATA FETCHING STRATEGY — IMPORTANT:** Firebase RTDB `onValue` always downloads the entire node — you CANNOT filter server-side. Attaching `onValue` to `competitions/` would download the full multi-MB tree regardless of what you discard in the callback.

Instead, use a **two-step approach**:

```javascript
// Step 1: Fetch competition index from coordinator server (lightweight):
//   GET /api/competitions/index → { [compId]: { eventName, meetDate, gender } }
//   This returns ONLY IDs + minimal metadata — NOT the full competition tree.
//   The server endpoint (Task 6.0) reads Firebase server-side and caches for 60s.
//
// Step 2: For each compId, do targeted get() on ONLY:
//   competitions/{compId}/commentary  (for assignment data)
//   The eventName + meetDate already came from the index — no need to read config.
//
// Refresh: setInterval every 30 seconds re-fetches commentary data.
//   Re-fetch the competition index every 5 minutes (it rarely changes).
//
// This avoids downloading scores, lineups, rosters, teamData etc.
```

**What it does:**
- Fetches competition IDs + metadata from `GET /api/competitions/index` (Task 6.0), then does targeted `get()` calls on `competitions/{compId}/commentary` only. Refreshes commentary every 30 seconds via `setInterval`. Pages that already have `useCompetitions()` loaded (like CommentaryPage) should pass their `competitions` object instead — the hook should accept an optional `competitions` parameter and skip creating its own fetcher when provided.
- For each competition, extracts `commentary` assignments
- Builds a map: `{ [talentId]: [ { compId, compName, meetDate, role, status, invitedAt, confirmedAt, ... } ] }`
- Derives per-talent summary fields:
  - `assignments` — array of current assignments with competition details
  - `lastOutreach` — most recent `invitedAt` or `briefedAt` timestamp across all competitions
  - `lastOutreachType` — "invite" | "briefing" | "calendar" based on which timestamp is newest
  - `pendingCount` — number of assignments where status is `invited` (awaiting response)
  - `confirmedCount` — number of assignments where status is `confirmed` or `briefed`
- Also computes availability data per talent:
  - `availableFor` — array of `{ compId, compName, source }` where source is "interested" or "survey"
  - `availabilityDot` — "green" (available for 1+ upcoming), "yellow" (did prior season but hasn't responded), "gray" (no availability data)
- Exports: `useTalentAssignments(talentList, competitions?)` returning `{ assignmentsByTalent, loading }`
  - `competitions` is optional — if omitted, the hook creates its own targeted fetcher via the server endpoint
  - `loading` is `true` until first fetch completes — consumers should show a loading indicator

**Pattern to follow:** `show-controller/src/hooks/useCommentaryStaff.js` for Firebase `onValue` listener pattern.

**Important — dual mode:**
- When `competitions` is passed (from a page that already calls `useCompetitions()`): use `useMemo` to derive data from the passed object — no new fetching.
- When `competitions` is NOT passed (e.g., TalentPage): fetch competition index from `GET /api/competitions/index`, then do targeted `get()` calls on `competitions/{compId}/commentary` per competition, refreshed every 30 seconds via `setInterval`. Clean up the interval in the `useEffect` return function.

```javascript
// Return shape per talent:
{
  assignments: [
    { compId: 'comp-abc', compName: 'Stanford vs Cal', meetDate: '2026-03-15', role: 'pbp', status: 'confirmed' },
    { compId: 'comp-def', compName: 'Big Ten Quad', meetDate: '2026-03-22', role: 'analyst', status: 'invited' },
  ],
  lastOutreach: '2026-03-10T14:30:00Z',
  lastOutreachType: 'invite',
  pendingCount: 1,
  confirmedCount: 1,
  availableFor: [
    { compId: 'comp-ghi', compName: 'SEC Quad', source: 'survey' },
  ],
  availabilityDot: 'green',
}
```

---

### Task 6.2: Normalize design tokens across CRM pages — COMPLETE

**Files:**
- `show-controller/src/pages/TalentPage.jsx`
- `show-controller/src/pages/TalentProfilePage.jsx`
- `show-controller/src/pages/CommentaryPage.jsx`
- `show-controller/src/pages/BookingPage.jsx`
- `show-controller/src/pages/SurveyPage.jsx`
- `show-controller/src/pages/TalentDiscoveryPage.jsx`
- `show-controller/src/pages/SettingsPage.jsx`
- `show-controller/src/pages/HomePage.jsx`

**Note:** Check ALL 8 files for `gray-*` usage. The first 3 are the primary targets (known mixed usage). The remaining 5 were built in Phases 2-5 and may have inherited `gray-*` tokens. Grep each file; skip any that already use only `zinc-*`.

**Problem:** TalentPage uses `bg-gray-900/800/700` while CommentaryPage uses `bg-zinc-950/900/800`. Border colors vary between `border-gray-700`, `border-zinc-800`, `border-zinc-700`. Modals use either `bg-black/60` or `bg-black bg-opacity-75`.

**Change:** Standardize ALL CRM pages to the `zinc` scale (matching `index.css` CSS variables which use zinc-based hex values):

| Element | Before (mixed) | After (standardized) |
|---------|----------------|---------------------|
| Page background | `bg-gray-900` / `bg-zinc-950` | `bg-zinc-950` |
| Card/section background | `bg-gray-800` / `bg-zinc-800` | `bg-zinc-900` |
| Card hover | `bg-gray-750` / `bg-zinc-750` | `bg-zinc-800` |
| Input background | `bg-gray-700` / `bg-zinc-800` | `bg-zinc-800` |
| Borders | `border-gray-700` / `border-zinc-700` | `border-zinc-800` |
| Border hover | `border-gray-600` / `border-zinc-600` | `border-zinc-700` |
| Secondary text | `text-gray-400` / `text-zinc-400` | `text-zinc-400` |
| Muted text | `text-gray-500` / `text-zinc-500` | `text-zinc-500` |
| Modal overlay | `bg-black/60` / `bg-black bg-opacity-75` | `bg-black/60` |
| Header bar | `bg-gray-800` / `bg-zinc-900` | `bg-zinc-900` |
| Header border | `border-gray-700` / `border-zinc-800` | `border-zinc-800` |

**How:** Find-and-replace in each file. Do NOT change any functional code — only Tailwind class names.

**Important:** Do NOT touch status badge colors (green, blue, amber, red, pink, purple, teal) — only normalize the gray/zinc background/border/text tokens.

---

## Phase 7: TalentPage Table View + Cross-Competition Visibility

### Task 7.1: Create TalentTable component with sortable columns — NOT STARTED

**File:** `show-controller/src/components/crm/TalentTable.jsx` (NEW)

**Prerequisite:** Create `show-controller/src/components/crm/` directory (does not exist yet). All Phase 7, 8, and 10 component files live here.

**What it does:** A table component that renders the talent roster with sortable columns, replacing the card list as the default view.

**Columns:**
| Column | Source | Sortable | Width |
|--------|--------|----------|-------|
| Name | `talent.name` | Yes (alpha) | flex |
| Status | `talent.status` | Yes (tier order) | 100px |
| WAG/MAG | `talent.wagMag` | Yes | 80px |
| Role | `talent.commentaryRole` | Yes | 140px |
| Assignments | from `useTalentAssignments` | Yes (count) | 200px |
| Available For | from `interested` + `surveyAvailability` | Yes (count) | 140px |
| Last Outreach | from `useTalentAssignments` | Yes (date) | 120px |
| Phone | `talent.phone` | No | 130px |

**Behavior:**
- Click column header to sort (toggle asc/desc, show arrow indicator)
- Click row to navigate to `/talent/{id}` (entire row is a link)
- Status and WAG/MAG render as colored badges (reuse existing `getStatusColor`, `wagMagLabel`)
- Assignments column shows up to 2 competition name pills with role abbreviation and status color, then "+N more" if >2
- Available For column shows green dot + count of competitions where `interested[compId]` or `surveyAvailability[compId]` is true
- Last Outreach shows relative time ("2d ago") with full date on hover via `title` attribute. Show "—" when no outreach exists.
- Fixed table header (sticky top) so it stays visible while scrolling
- Accept `talents` array, `assignmentsByTalent` map, and `loading` boolean as props
- When `loading` is true, show a subtle loading bar or spinner above the table (not a full-page spinner — the talent data is already available, only assignment data is loading)
- **Horizontal scroll:** Wrap table in `overflow-x-auto` container. At 1024px width the 8 columns (~900px+ fixed widths) may overflow — horizontal scroll is acceptable.

**Pattern to follow:** Standard React table with `useState` for sort column/direction. No external table library needed.

---

### Task 7.2: Add view toggle and integrate TalentTable into TalentPage — NOT STARTED

**File:** `show-controller/src/pages/TalentPage.jsx`

**Changes:**
1. Import `TalentTable` and `useTalentAssignments`
2. Call `const { assignmentsByTalent } = useTalentAssignments(talents)` — do NOT import `useCompetitions()` here. The hook will create its own lightweight listener when no `competitions` arg is passed (see Task 6.1 dual-mode design).
3. Add `viewMode` state: `'table'` (default) or `'cards'`
4. Persist view preference in `localStorage` key `crm-talent-view`
5. Add toggle buttons in the filter row (right side, before the count): `TableCellsIcon` / `Squares2X2Icon` from Heroicons
6. Conditionally render `<TalentTable>` or the existing card list based on `viewMode`
7. Pass `filtered` (already-filtered talent list) and `assignmentsByTalent` to `TalentTable`

**Do NOT delete the card view code.** Keep both views.

---

### Task 7.3: Add assignment details to card view — NOT STARTED

**File:** `show-controller/src/pages/TalentPage.jsx` (TalentCard component, line ~362)

**Changes:**
1. Pass `assignmentsByTalent` down to `TalentCard` as a prop
2. Replace the generic "3 events" count with actual competition names (up to 2, then "+N"):
   ```
   Before: "3 events"
   After:  "Stanford vs Cal (PBP, Confirmed) · Big Ten Quad (Analyst, Invited) · +1"
   ```
3. Add a small "last outreach" line if the talent has been contacted:
   ```
   Last contacted: 2d ago (invite)
   ```
4. Show green dot before name if `availabilityDot === 'green'`

**Keep the card layout compact.** These additions go into the existing structure.

---

### Task 7.4: Add availability indicator dots — NOT STARTED

**File:** `show-controller/src/components/crm/TalentTable.jsx` (modify — created in Task 7.1)

**Changes:** In the "Available For" column, consume the pre-computed fields from `useTalentAssignments` output (do NOT re-implement the dot logic — it's already computed in Task 6.1's hook):
- Read `assignmentsByTalent[talentId].availabilityDot` for the dot color (green/yellow/gray)
- Read `assignmentsByTalent[talentId].availableFor` for the count and competition names
- Green dot (●) + count: `availabilityDot === 'green'`
- Yellow dot (●): `availabilityDot === 'yellow'`
- Gray dot (●): `availabilityDot === 'gray'`
- On hover, show tooltip listing `availableFor` competition names + source ("survey" / "interested")

---

## Phase 8: CommentaryPage Cleanup — Kebab Menu + Conflicts + Kanban

### Task 8.1: Replace button overload with kebab overflow menu — NOT STARTED

**File:** `show-controller/src/pages/CommentaryPage.jsx`

**Problem:** Each assignment card (lines 559-651) shows 8+ visible buttons: Mark as X, Copy Link, Mark Declined, Send Invite, Copy for iMessage, Send Briefing, Copy for iMessage (again), Calendar Invite, Schedule Pre-Prod.

**Change:** Keep only the primary workflow action visible. Move everything else into a kebab (three-dot) menu.

**Visible on card (always):**
- Status badge (existing)
- Primary action button: the `flowEntry?.next` "Mark as X" button
- Kebab menu button (`EllipsisVerticalIcon` from Heroicons)

**Kebab menu structure (dropdown positioned relative to button):**
```
── Workflow ──
Mark Declined             (only if status === 'invited')
(NOTE: "Mark as [next status]" is NOT in the kebab — it's already the visible primary action button)

── Outreach ──
Send Invite
Copy Invite for iMessage
Send Briefing
Copy Briefing for iMessage
Calendar Invite
Schedule Pre-Prod

── Links ──
Copy Booking Link

── Danger ──
Remove from Competition   (red text)
```

**Implementation:**
1. Create a `KebabMenu` component at `show-controller/src/components/crm/KebabMenu.jsx` (extracted — reused by KanbanBoard in Task 8.3)
2. `useState` for open/closed, close on click outside (`useEffect` + `document.addEventListener('mousedown', ...)`), close on Escape key (`document.addEventListener('keydown', ...)` when open)
3. Position: absolute, right-aligned, `z-50`
4. Section headers as small gray uppercase text, items as clickable rows with icon + label
5. Delete the existing inline button rows (lines 559-651) and replace with: primary action + kebab

**All existing handler functions stay unchanged.** Only the rendering changes.

---

### Task 8.2: Add conflict detection badges with hover popovers — NOT STARTED

**File:** `show-controller/src/pages/CommentaryPage.jsx`

**Problem:** `sameDayConflicts` is computed (lines 71-85) but only used to filter the "Available" tab sidebar. No visual warning on assigned talent who have conflicts.

**Changes:**

1. **Extend conflict data:** Build a map with conflict details instead of just a Set. Widen the scope from `CONFIRMED` only to include `invited`, `confirmed`, and `briefed` statuses (skip `assigned` — speculative assignments before outreach are not real conflicts and would create noisy false positives):
   ```javascript
   // Before: sameDayConflicts = Set of talentIds (CONFIRMED only)
   // After: sameDayConflictDetails = Map<talentId, [{ compId, compName, role, status }]>
   // Include invited, confirmed, and briefed — these represent active commitments.
   // Skip 'assigned' (pre-outreach, speculative) and 'declined' (not competing).
   ```

2. **Assignment card badge:** Orange warning badge next to name with hover popover:
   ```jsx
   {sameDayConflictDetails.has(assignment.talentId) && (
     <span className="relative group">
       <span className="px-1.5 py-0.5 bg-orange-700 text-orange-100 text-xs rounded flex items-center gap-1">
         <ExclamationTriangleIcon className="w-3 h-3" /> Conflict
       </span>
       <div className="absolute left-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs z-50 w-64 hidden group-hover:block shadow-lg">
         <div className="font-semibold text-orange-300 mb-1">Same-day conflict</div>
         {sameDayConflictDetails.get(assignment.talentId).map(c => (
           <div key={c.compId}>Also {c.status} for {c.compName} as {getRoleLabel(c.role)}</div>
         ))}
       </div>
     </span>
   )}
   ```

3. **Sidebar badge:** Show orange badge on conflicted talent in search results, sort to bottom.

---

### Task 8.3: Add kanban pipeline board toggle — NOT STARTED

**File:** `show-controller/src/components/crm/KanbanBoard.jsx` (NEW) + modify `CommentaryPage.jsx`

**Columns:** Assigned | Invited | Confirmed | Briefed | Declined

**Each column:**
- Header: status label + count badge
- Cards: talent name, role badge, phone link, primary action button, kebab menu (reuse from Task 8.1)

**Empty columns:** Show placeholder text "No talent in this status" with a subtle dashed border (`border-dashed border-zinc-700`) to indicate it's a valid drop target.

**Drag and drop:** HTML5 drag-and-drop API (no external library). `draggable="true"`, `onDragStart`, `onDragOver` (prevent default), `onDrop`.

**Visual drop-target feedback:** On `onDragEnter`, add `bg-zinc-800/50 border-blue-500/50` to the target column. On `onDragLeave`, remove it. Use a `dragOverColumn` state variable to track which column is highlighted. This gives the user clear visual feedback about where they're dropping.

**Firebase write on drop:** When a valid drop occurs, update the status in Firebase:
```javascript
// On valid drop:
import { db, ref, update } from '../../lib/firebase';
update(ref(db, `competitions/${compId}/commentary/${talentId}`), { status: newStatus });
// Firebase onValue listener will auto-update the UI — no local state mutation needed.
```

**Valid drag transitions (must enforce):**
- Forward movement matching `STATUS_FLOW`: assigned → invited → confirmed → briefed
- Forward skipping IS allowed (e.g., assigned → confirmed is valid — coordinator confirmed talent via text without formal invite)
- Any status → declined (always allowed)
- No backward drags (e.g., confirmed → invited is rejected)
- Declined is terminal — cannot drag OUT of declined column
- On invalid drop: show brief toast "Cannot move from X to Y" and snap card back

**Error handling on drop:** Wrap the Firebase `update()` call in a try/catch. On failure, show a red toast "Failed to update status — check your connection" so the coordinator knows the drag didn't persist.

**Integration with CommentaryPage:**
1. Add `viewMode` state: `'list'` (default) or `'kanban'`
2. Toggle buttons in header
3. Persist in `localStorage` key `crm-commentary-view`
4. Right sidebar (talent search) stays visible in both views

---

## Phase 9: TalentProfilePage — Collapsible Sections + Activity Timeline

### Task 9.1: Refactor profile into collapsible sections — NOT STARTED

**File:** `show-controller/src/pages/TalentProfilePage.jsx`

**Changes:**

1. Create a `CollapsibleSection` component (inline, like the existing `Field` component):
   ```jsx
   function CollapsibleSection({ title, defaultOpen = true, children }) {
     const [open, setOpen] = useState(defaultOpen);
     return (
       <div className="border border-zinc-800 rounded-lg overflow-hidden">
         <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800">
           <span className="text-sm font-semibold text-zinc-300">{title}</span>
           <ChevronDownIcon className={`w-4 h-4 text-zinc-500 transition-transform ${open ? '' : '-rotate-90'}`} />
         </button>
         {open && <div className="p-4">{children}</div>}
       </div>
     );
   }
   ```

2. Organize existing fields into sections:
   - **Contact Info** (always open): name, phone, email, discord
   - **Role & Expertise** (open): wagMag, commentaryRole, canProduce, affiliation, conference
   - **Availability & Assignments** (open): current assignments, interested/survey availability, parsed availability notes. Call `useTalentAssignments([talent])` with a single-element array (no `competitions` arg — the hook will use its targeted fetcher), then read `assignmentsByTalent[talentId]`. Each assignment row should be a clickable `<Link to={/${compId}/commentary}>` so the coordinator can navigate directly to that competition's commentary page.
   - **Notes & Interests** (open): notes, otherInterests, linkedIn, instagram
   - **History** (collapsed by default): competitionHistory, discoveredFrom, createdAt

---

### Task 9.2: Replace communications log with activity timeline — NOT STARTED

**File:** `show-controller/src/pages/TalentProfilePage.jsx`

**Changes:**

1. Timeline with type-based styling:

   | Type | Icon | Color |
   |------|------|-------|
   | `imessage` | `ChatBubbleLeftIcon` | `text-blue-400` |
   | `invite` | `PaperAirplaneIcon` | `text-green-400` |
   | `briefing` | `DocumentTextIcon` | `text-purple-400` |
   | `calendar` | `CalendarIcon` | `text-blue-400` |
   | `note` | `PencilIcon` | `text-zinc-400` |
   | `preproduction` | `VideoCameraIcon` | `text-amber-400` |

2. Timeline layout: vertical line on left, dots at each entry, content to right

3. Filter chips at top: `['all', 'imessage', 'invite', 'briefing', 'calendar', 'preproduction', 'note']` — must include `preproduction` type since Phase 3's Schedule Pre-Prod action writes entries with `type: 'preproduction'`, and `note` type since screenshot upload (Task 3.5) writes entries with `type: 'note'`

4. Relative timestamps via inline `timeAgo` helper (no library). Reference existing pattern in `show-controller/src/components/ScoreBugPanel.jsx` lines 30-48 for the format (`Xs ago`, `Xm ago`). Extend it to handle hours and days: `Xh ago`, `Xd ago`.

---

## Phase 10: Power Features — Cmd+K, Saved Filters, Bulk Ops

### Task 10.1: Add Cmd+K command palette — NOT STARTED

**File:** `show-controller/src/components/crm/CommandPalette.jsx` (NEW) + modify `show-controller/src/App.jsx`

**What it does:** Global search overlay activated by Cmd+K (Ctrl+K on non-Mac). Searches talent and competitions.

**Implementation:**
1. Global `keydown` listener (`e.metaKey && e.key === 'k'` or `e.ctrlKey && e.key === 'k'`)
2. Modal overlay with auto-focused search input
3. Results grouped: "Talent" and "Competitions"
4. Arrow keys to navigate, Enter to select, Escape to close
5. "Recent" section (last 5 items from `localStorage` key `crm-recent-items`)
6. Use `createPortal` to render at document root
7. Add `<CommandPalette />` inside `App.jsx` — place inside the `<Router>` (needs `useNavigate`) but OUTSIDE `<RequireAuth>` wrappers. It renders via `createPortal` so placement in the JSX tree only matters for hook access. Add it as a sibling alongside the `<Routes>` block. It will only show data to authenticated users since `get()` calls to `talentRoster/` require auth per Firebase rules.

**Data source:** Use one-shot Firebase `get()` reads (not `onValue` listeners) when the palette opens. Cache results in a `useRef` with a 60-second TTL so repeated opens don't re-fetch. Import `{ db, ref, get }` from `../lib/firebase`.

**Competition data source:** Use the same `GET /api/competitions/index` server endpoint from Task 6.0. This returns only `{ [compId]: { eventName, meetDate } }` — no multi-MB download. Cache the result in a `useRef` with a 60-second TTL so repeated opens don't re-fetch.

For `talentRoster/`, a one-shot `get()` is fine — talent records are small (no nested score data).

**UX requirements:**
- Show a spinner/loading state while data is loading (first open or after TTL expiry)
- **Debounce search input by 300ms** — filtering 428 talent + N competitions on every keystroke will lag. Keep a local `searchValue` state for instant display, debounce the filter computation.

---

### Task 10.2: Add URL-persisted filters and saved views — NOT STARTED

**File:** `show-controller/src/pages/TalentPage.jsx`

**Changes:**
1. Replace `useState` for filters with `useSearchParams` from react-router-dom
2. URL params: `q`, `status`, `wagMag`, `role`
   - **IMPORTANT:** Always use `{ replace: true }` when calling `setSearchParams` — otherwise every keystroke in the search box creates a browser history entry, polluting the back button.
   - **Debounce the search input:** Keep a local `useState` for the text input value (for instant UI feedback), but debounce the `setSearchParams` call by 300ms so the URL doesn't update on every keystroke. Use a `useEffect` with `setTimeout`/`clearTimeout` pattern — no external library.
3. "Save View" button stores filter combos in `localStorage` key `crm-saved-views` — cap at 10 maximum. If at limit, show "Remove a saved view first" instead of saving.
4. Saved views dropdown next to filter row with delete option

---

### Task 10.3: Add bulk operations with multi-select — NOT STARTED

**Files:**
- `show-controller/src/pages/TalentPage.jsx`
- `show-controller/src/components/crm/TalentTable.jsx`

**Changes:**
1. Checkbox column in table (select all / individual). "Select all" selects only currently filtered/visible rows.
2. Floating action bar when selection > 0: Set Status, Set WAG/MAG, Export CSV, Clear
3. Bulk status change via dropdown — **MUST show confirmation dialog** before writing: "Update status to [X] for [N] people?" with Cancel/Confirm buttons. This prevents accidental mass status changes.
4. CSV export via `Blob` + `URL.createObjectURL`. Columns: Name, Status, WAG/MAG, Role, Phone, Email, Assignments (comma-separated competition names), Last Outreach Date. Include all selected rows.
5. Shift+click range select — track `lastClickedIndex` in a `useRef` to know the range anchor. On shift+click, select all rows between `lastClickedIndex` and the clicked row index.
6. **Note:** Multi-select is only available in table view. Card view does not support selection (no checkboxes). If the user switches to card view while rows are selected, clear the selection.

---

## Final: Mark PRD Complete

### Task F.3: Mark PRD complete — NOT STARTED

Update `PRD-Commentary-Talent-CRM-2026-03-10.md` status to COMPLETE. Commit.

---

## Rollback Procedure

If a deploy breaks production:

1. **Identify the last working commit:** `git log --oneline -10`
2. **Rebuild from that commit:**
   ```bash
   git stash  # if needed
   git checkout <last-good-commit> -- show-controller/
   cd show-controller && npm run build
   # Upload dist per CLAUDE.md Step 1
   git checkout main -- show-controller/  # restore working tree
   git stash pop  # if needed
   ```
3. **Record the failure** in the implementation plan under the deploy task that broke
4. **Fix in the next iteration** — do not attempt to fix + redeploy in the same context window
