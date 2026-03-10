# Commentary Talent CRM — Implementation Plan

**PRD:** PRD-Commentary-Talent-CRM-2026-03-10.md

> **Phase 1 (Talent Roster UI) is already complete.** This plan covers Phases 0, 2, 3, 4, 5.

---

## Phases Overview

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| Phase 0 | Data Migration Script | 1 | NOT STARTED |
| Phase 0-Deploy | Run migration + verify Firebase | 1 | NOT STARTED |
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

### Task 0.1: Create CSV migration script — NOT STARTED

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

Use the Firebase Admin SDK (`firebase-admin`) already used in `server/index.js`. Use `csv-parse` for CSV parsing (install if not present). Use a simple Levenshtein function for duplicate detection.

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

### Task 0-D.1: Run migration and verify data in Firebase — NOT STARTED

**Steps:**
1. Dry-run first: `node server/scripts/migrateCommentaryCSV.js --dry-run`
2. Review output — confirm counts look correct (expect ~428 contacts)
3. Live run: `node server/scripts/migrateCommentaryCSV.js`
4. Navigate to `https://commentarygraphic.com/talent` with Playwright
5. Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-phase0-talent-list.png`
6. Verify talent count shown matches expected (~428)

**Checks:**
- [ ] No crash during dry-run
- [ ] Live run creates records in Firebase `talentRoster/`
- [ ] Talent page shows records (not empty)
- [ ] migration-log.json exists and lists flagged rows

---

## Phase 2: Booking Links + Smart Availability

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 2-Deploy.
> **Prerequisite:** `ANTHROPIC_API_KEY` must be set in server `.env` on `44.193.31.120` (used by Task 2.4 note parsing endpoint).

### Task 2.1: Add booking token server endpoints — NOT STARTED

**File:** `server/index.js`

**Change:** Add three new endpoints after existing talent routes:

```javascript
// POST /api/book/generate — creates a booking token
// Body: { talentId, compId, role }
// Writes: bookingTokens/{uuid} = { talentId, compId, role, createdAt, expiresAt (30 days), responded: false }
// Returns: { token, url: `https://commentarygraphic.com/book/${uuid}` }

// GET /api/book/:token — reads booking details for public page
// Reads bookingTokens/{token} + competitions/{compId} + talentRoster/{talentId}
// Returns: { talent: { name }, competition: { name, date, venue }, role, responded, response }

// POST /api/book/:token/respond — talent responds yes or no
// Body: { response: 'yes' | 'no', interestedIn: ['compId1', 'compId2'] }
// If yes: update competitions/{compId}/commentary/{talentId}.status = 'confirmed', confirmedAt = now
// If no: save interestedIn to talentRoster/{talentId}.interested = [...compIds]
// Update bookingTokens/{token}.responded = true, response = 'yes'|'no'
```

Also add an endpoint to fetch upcoming competitions for the "No" flow:
```javascript
// GET /api/competitions/upcoming — returns next 5 competitions sorted by date
// Filter: date > now, exclude compId already responded to
```

**Implements:** Booking token generation, Yes/No response flow

---

### Task 2.2: Create public BookingPage — NOT STARTED

**File:** `show-controller/src/pages/BookingPage.jsx` (new file)

**Change:** Create a public page (no auth required) that:
- Reads `GET /api/book/:token` from the coordinator server
- Shows: competition name, date, venue, talent's name, assigned role
- Has two primary buttons: "Yes, I'm available" and "No, not this one"
- On "Yes": calls `POST /api/book/:token/respond { response: 'yes' }`, shows confirmation screen
- On "No": shows next 5 upcoming competitions as checkboxes, submit saves `interestedIn` array
- Mobile-first layout (talent opens this on their phone)
- No navbar, no auth, standalone page with minimal styling

Reference [CommentaryPage.jsx](../show-controller/src/pages/CommentaryPage.jsx) for Firebase/server call patterns.

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
// - inviteEmail(talent, competition, role) → HTML invite with event details + booking link
// - briefingEmail(talent, competition, virtiusUrl, discordInfo, preProdTime) → HTML briefing
// - reminderEmail(talent, competition) → HTML reminder with booking link
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
//   Sends invite email, updates competitions/{compId}/commentary/{talentId}.invitedAt = now
//   Logs to talentRoster/{talentId}.communicationLog

// POST /api/commentary/:compId/:talentId/briefing
//   Sends briefing email with Virtius URL, Discord info, pre-prod time
//   Updates .briefedAt = now, logs to communicationLog

// POST /api/commentary/:compId/:talentId/calendar-invite
//   Creates GCal event, updates .calendarInviteSent = true, logs to communicationLog

// POST /api/commentary/:compId/:talentId/schedule-preproduction
//   Body: { meetingTime (ISO) }
//   Creates pre-prod GCal event, updates .preProductionMeetingScheduled = meetingTime

// Communication log entry shape:
// { type: 'invite'|'briefing'|'calendar'|'imessage', sentAt: ISO, note: '...' }
// Appended to talentRoster/{talentId}.communicationLog array
```

**Implements:** All outreach server actions

---

### Task 3.4: Add outreach buttons to CommentaryPage — NOT STARTED

**File:** `show-controller/src/pages/CommentaryPage.jsx`

**Change:** In the assignment detail view (when a talent card is expanded/selected):
1. Add outreach action buttons: "Send Invite", "Send Briefing", "Calendar Invite", "Schedule Pre-Prod"
2. Each button calls its corresponding server endpoint
3. Each button has a sibling "📋 Copy for iMessage" button that:
   - Formats the same message as the email (plain text)
   - Copies to clipboard
   - Shows: "Sent via iMessage?" → [Yes] → logs `{ type: 'imessage', sentAt: now }` to server
4. Show a "Sent ✓" indicator when the server confirms the email was sent

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
// Step 2: For each athlete, call Claude API (claude-haiku-4-5-20251001) with:
//   "Given this person competed in gymnastics at {school}, rate their suitability
//    as a remote gymnastics commentator (1-5). Return JSON:
//    { score: N, explanation: '...', linkedIn: '...'|null, instagram: '...'|null }"
//   (Include name, school, graduation year in the prompt)
//
// Step 3: Return array of CandidateCards:
//   { name, school, graduationYear, score, explanation, linkedIn, instagram, rtnAthleteId }
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
//   status: candidate.email ? 'has-contact' : 'need-info'
//   discoveredFrom: 'rtn-alumni'
//   name, school (→ affiliation), linkedIn, instagram
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
- Fields: name, email, WAG/MAG selection, competition availability checkboxes (list upcoming competitions from Firebase), internet upload/download Mbps, mic type (text), has headphones (checkbox), Discord username, role preference (PBP / Analyst / Either)
- Submit: matches to existing `talentRoster` by email (update) or creates new entry with status `need-info`
- Writes to `talentRoster/{id}.surveyCompleted = true` and all survey field values
- Confirmation screen: "Thanks! We'll be in touch."

Reference [BookingPage.jsx](../show-controller/src/pages/BookingPage.jsx) for public (no-auth) page patterns.

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
   - `talent.interested` array contains current `compId` (flagged via booking link), OR
   - `talent.surveyCompleted = true` AND survey competition availability includes this date
   - AND status is `ready` or `has-contact`
   - AND no same-day booking conflict (check `competitions/*/commentary/` for same date)
2. Add "📋 Copy talent list" button above the list — copies `Name — Phone\n` lines for each available talent to clipboard

**Implements:** Smart available talent filtering + copy list

---

### Task 5.4: Create useProductionAlerts hook — NOT STARTED

**File:** `show-controller/src/hooks/useProductionAlerts.js` (new file)

**Change:** Create a React hook that scans Firebase for upcoming competitions and generates alert objects:

```javascript
// useProductionAlerts() → { alerts: Alert[], loading }
//
// Alert types generated by scanning competitions + commentary/:talentId:
// - 'start-outreach': competition.date is 6 weeks away AND no commentary assigned
// - 'no-confirmed': competition.date is 3 weeks away AND no confirmed commentary
// - 'send-calendar': talent is confirmed AND calendarInviteSent !== true
// - 'schedule-preproduction': competition.date is 1 week away AND preProductionMeetingScheduled is falsy
// - 'follow-up': talent was invited > 5 days ago AND status is still 'invited'
//
// Alert shape: { id, type, message, compId, talentId (optional), compName, talentName (optional) }
// Refreshes in real-time via Firebase onValue listener on competitions/
```

**Implements:** Alert engine for pre-production reminders

---

### Task 5.5: Add pre-production alert panel to DashboardPage — NOT STARTED

**File:** `show-controller/src/pages/DashboardPage.jsx`

**Change:** Import `useProductionAlerts` and add an alert panel section:
1. Alert panel appears at the top of the dashboard, above existing content
2. Each alert is a card with: icon (⚠ or 🔔), message, and an action button
3. Action buttons:
   - "Go to Commentary" → navigates to `/compId/commentary`
   - "Send Invite" → calls invite endpoint inline
   - "Send Calendar" → calls calendar endpoint inline
4. When an action is taken, the alert disappears (Firebase real-time will clear it)
5. If no alerts: show "✓ All caught up" with green background

Read `show-controller/src/pages/DashboardPage.jsx` first to understand existing layout before inserting.

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
- [ ] Dashboard shows alert panel (or "✓ All caught up" if no alerts)
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
- [ ] Dashboard shows alert panel
- [ ] CommentaryPage has Available tab with "📋 Copy talent list"

### Task F.2: Mark PRD complete — NOT STARTED

Update `PRD-Commentary-Talent-CRM-2026-03-10.md` status to `COMPLETE`. Commit.
