# Commentary Talent CRM — Implementation Plan

**PRD:** PRD-Commentary-Talent-CRM-2026-03-10.md

> **Phase 1 (Talent Roster UI) is already complete.** This plan covers Phases 0, 2, 3, 4, 5.

---

## Phases Overview

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| Phase 0 | Data Migration Script | 1 | COMPLETE |
| Phase 0-Deploy | Run migration + verify Firebase | 1 | COMPLETE |
| Phase 2 | Booking Links + Smart Availability | 6 | NOT STARTED |
| Phase 2-Deploy | Deploy Phase 2 changes | 1 | NOT STARTED |
| Phase 3 | Gmail + Google Calendar Outreach | 5 | NOT STARTED |
| Phase 3-Deploy | Deploy Phase 3 changes | 1 | NOT STARTED |
| Phase 4 | AI-Powered Talent Discovery | 5 | NOT STARTED |
| Phase 4-Deploy | Deploy Phase 4 changes | 1 | NOT STARTED |
| Phase 5 | Annual Survey + Pre-Production Alerts | 6 | NOT STARTED |
| Phase 5-Deploy | Deploy Phase 5 changes | 1 | NOT STARTED |
| Final-Deploy | Full acceptance criteria check | 2 | NOT STARTED |
| **Total** | | **30** | |

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

### Task 2.1: Add booking token server endpoints — COMPLETE

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

### Task 2.2: Create public BookingPage — NOT STARTED

**File:** `show-controller/src/pages/BookingPage.jsx` (new file)

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

### Task 2.3: Add public route for booking page — NOT STARTED

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

### Task 2.4: Add note parsing endpoint — NOT STARTED

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

### Task 2.5: Add "Interested" badge + note parsing trigger to TalentProfilePage — NOT STARTED

**File:** `show-controller/src/pages/TalentProfilePage.jsx`

**Change:**
1. When a note is saved (existing "Save Notes" button), also call `POST /api/talent/:talentId/notes/parse` with the note text
2. Show any parsed availability periods as small tags below the notes field: `Available: late February` (green), `Busy: January 15` (red)
3. These tags are read from `talent.parsedAvailability.availablePeriods` and `unavailableDates`

**Implements:** Visual feedback for AI-parsed availability

---

### Task 2.6: Add booking link generation + Interested badge to CommentaryPage — NOT STARTED

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

### Task 2-D.1: Build, deploy, and verify Phase 2 — NOT STARTED

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

**Verify:**
- [ ] Navigate to `/talent` — no console errors
- [ ] Open a competition's commentary page — "🔗 Copy Link" button appears next to assignments
- [ ] Navigate to `/book/test-token-invalid` — BookingPage loads (may show error for invalid token, but page renders)
- [ ] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase2-booking-link.png`

---

## Phase 3: Gmail + Google Calendar Outreach

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 3-Deploy.
> **Prerequisite:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` must be set in server `.env` on `44.193.31.120`.

### Task 3.1: Create Gmail service — NOT STARTED

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

### Task 3.2: Create Google Calendar service — NOT STARTED

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

### Task 3.3: Add outreach API endpoints — NOT STARTED

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

### Task 3.4: Add outreach buttons to CommentaryPage — NOT STARTED

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

### Task 3.5: Add screenshot upload + communications tab to TalentProfilePage — NOT STARTED

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

### Task 3-D.1: Build, deploy, and verify Phase 3 — NOT STARTED

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

### Task 4.1: Create talent discovery service — NOT STARTED

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

### Task 4.2: Add talent discovery server endpoint — NOT STARTED

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

### Task 4.3: Create TalentDiscoveryPage — NOT STARTED

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

### Task 4.4: Add discovery route to App.jsx — NOT STARTED

**File:** `show-controller/src/App.jsx`

**Change:** Add route for talent discovery (auth-protected, coordinators only):
```jsx
<Route path="/talent/discover" element={<TalentDiscoveryPage />} />
```

Place BEFORE the `/talent/:talentId` route to avoid the param catching `/talent/discover`.

**Implements:** Route for discovery page

---

### Task 4.5: Wire "Discover Talent" button in TalentPage — NOT STARTED

**File:** `show-controller/src/pages/TalentPage.jsx`

**Change:** The TalentPage already has a "Discover Talent" button (purple, mentioned in Phase 1). Update its `onClick` to navigate to `/talent/discover` using `useNavigate`:

```jsx
// Before: button may link to placeholder or have no action
// After:
const navigate = useNavigate();
// ...
<button onClick={() => navigate('/talent/discover')}>Discover Talent</button>
```

Read the existing button implementation first to see what change is actually needed.

**Implements:** Navigation entry point to discovery

---

## Phase 4-Deploy: Deploy Phase 4 Changes

> **This is a deploy task.**

### Task 4-D.1: Build, deploy, and verify Phase 4 — NOT STARTED

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
- [ ] Navigate to `/talent` → "Discover Talent" button → navigates to `/talent/discover`
- [ ] TalentDiscoveryPage renders with school input and button
- [ ] Searching for a school returns candidate cards (or a clear error if ANTHROPIC_API_KEY not set)
- [ ] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase4-discovery.png`

---

## Phase 5: Annual Survey + Pre-Production Alerts

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 5-Deploy.

### Task 5.1: Create public SurveyPage — NOT STARTED

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

### Task 5.2: Add survey route to App.jsx — NOT STARTED

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

### Task 5.3: Add smart "Available Talent" filter to CommentaryPage — NOT STARTED

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

### Task 5.4: Create useProductionAlerts hook — NOT STARTED

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

### Task 5.5: Add pre-production alert panel to HomePage — NOT STARTED

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

### Task 5.6: Add CSV batch import to SettingsPage — NOT STARTED

**File:** `show-controller/src/pages/SettingsPage.jsx` (new file — confirmed does not exist)

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

### Task 5-D.1: Build, deploy, and verify Phase 5 — NOT STARTED

**Frontend changed?** Yes
```bash
cd show-controller && npm run build
# upload dist per CLAUDE.md Step 1
```

**Server changed?** No (Phase 5 is Firebase-only from the client side)

**Verify:**
- [ ] Navigate to `/survey/2027` — survey form renders without auth prompt
- [ ] HomePage (`/`) shows alert panel (or "✓ All caught up" if no alerts)
- [ ] CommentaryPage has an "Available" talent tab
- [ ] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase5-survey.png`
- [ ] Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase5-alerts.png`

---

## Final-Deploy: Full Verification

### Task F.1: Full acceptance criteria check — NOT STARTED

Run through all acceptance criteria from the PRD using Playwright.
Screenshots: `docs/PRD-Commentary-Talent-CRM/screenshots/final-verify-*.png`

**Phase 0 checks:**
- [ ] `/talent` shows ~428 contacts (confirm talent count)
- [ ] Open any talent profile — competitionHistory is populated
- [ ] `server/scripts/migration-log.json` exists and contains flagged rows (malformed phone/email, duplicate names)
- [ ] At least one flagged entry exists in the log (confirms flagging logic ran)

**Phase 2 checks:**
- [ ] Commentary page for a competition with assignments shows "🔗 Copy Link" button
- [ ] BookingPage loads at `/book/` (invalid token shows graceful error, not blank)

**Phase 3 checks:**
- [ ] "Send Invite" button appears in commentary page
- [ ] "📋 Copy for iMessage" copies non-empty text to clipboard
- [ ] TalentProfilePage has Communications tab

**Phase 4 checks:**
- [ ] `/talent/discover` loads with school input
- [ ] "Discover Talent" button on TalentPage navigates correctly

**Phase 5 checks:**
- [ ] `/survey/2027` loads without login
- [ ] HomePage (`/`) shows alert panel
- [ ] CommentaryPage has Available tab with "📋 Copy talent list"

### Task F.2: Mark PRD complete — NOT STARTED

Update `PRD-Commentary-Talent-CRM-2026-03-10.md` status to `COMPLETE`. Commit.
