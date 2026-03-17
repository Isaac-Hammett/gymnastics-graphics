# PRD: Commentary Talent CRM

**Status:** PHASES 0-5 COMPLETE · PHASES 6-10 IN PROGRESS
**Date:** 2026-03-10
**Last Updated:** 2026-03-12

---

## Overview
A full-stack CRM for coordinating 15–20+ gymnastics commentary talent across a season: migrating the
existing 428-contact Google Sheet into Firebase, adding self-service booking links, Gmail/GCal outreach,
AI-powered talent discovery from alumni rosters, and automated pre-production alerts. Phase 1
(Talent Roster UI) is already complete.

## Test Competition / URL
| Field | Value |
|-------|-------|
| Competition ID | (use most recent competition in Firebase) |
| Producer URL | `https://commentarygraphic.com/{compId}/producer` |
| Commentary URL | `https://commentarygraphic.com/{compId}/commentary` |
| Talent Roster | `https://commentarygraphic.com/talent` |

---

## Phase 1 — Talent Roster UI (COMPLETE — pre-dates this PRD)

Phase 1 built the foundational talent roster UI: the `/talent` page with card-based browsing, search/filter, status badges, and the `/talent/:talentId` profile page with editable fields. This phase was completed before the PRD was written and is the baseline all subsequent phases build on.

---

## Phase 0 — Data Migration

### User Stories
- As a coordinator, I run a script once and all 428 people from my Google Sheet appear in the app — names, phones, emails, statuses, affiliations, and prior season counts.
- As a coordinator, the 28 people who filled out the 2026 survey already have their tech info (internet speed, mic type, Discord status) populated.
- As a coordinator, when I open a talent profile for someone like Tiara DeTommaso, I can see the meets she called last season in her history tab — that data came from the assignment sheet automatically.
- As a coordinator, when the script encounters messy data (a phone field that says "Barb said no", or a duplicate with two slightly different spellings), it flags it in a log rather than crashing.

### Acceptance Criteria
- [ ] Running `node server/scripts/migrateCommentaryCSV.js --dry-run` prints a summary (X created, Y enriched, Z assignments added, N flagged) without writing to Firebase
- [ ] Running without `--dry-run` writes all 428 contacts to `talentRoster/` in Firebase
- [ ] Survey responses (28 records) are merged into matching contacts by email
- [ ] Competition assignments appear in each talent's `competitionHistory` array
- [ ] Rows with malformed phone/email are flagged in a log file, not skipped silently
- [ ] Duplicate names (fuzzy match > 90%) are flagged rather than creating two records

---

## Phase 2 — Booking Links + Smart Availability

### User Stories
- As a coordinator, I click "Generate Booking Link" next to an assignment on the Commentary page. The app creates a unique URL I can copy and send via text or email.
- As a talent invitee, I open the link on my phone (no login required) and see the event name, date, venue, and my assigned role. I click "Yes, I'm available" — that's it. The coordinator's app immediately shows me as Confirmed.
- As a talent invitee, I click "No, not this one" and the app shows me the next 5 upcoming competitions. I can check the ones I could do. That interest is saved and the coordinator sees it automatically.
- As a coordinator, I leave a note on a talent profile. The app parses that note and automatically flags her as interested in competitions mentioned in the note.
- As a coordinator, when I'm looking at who to assign to a meet, I can see an "Interested" badge next to people who already flagged that competition as available.

### Acceptance Criteria
- [ ] "Generate Booking Link" button appears next to each assignment in the Commentary page
- [ ] Booking page at `/book/:token` loads without login and shows competition name, date, venue, and role
- [ ] Clicking "Yes" updates assignment status to `confirmed` in Firebase immediately
- [ ] Clicking "No" shows next 5 competitions with checkboxes; checking saves to `talentRoster/{id}/interested`
- [ ] Adding a note with a date mention (e.g., "available late February") extracts and saves date hints to `interestedDates`
- [ ] "Interested" badge appears in the talent search panel on CommentaryPage for people who flagged that competition

### Security Notes (Phase 2)
- **Booking tokens are world-readable/writable** in Firebase (`bookingTokens.$token: { .read: true, .write: true }`). Tokens are unguessable UUIDs so the risk is low, but there is no expiration or revocation mechanism. Future improvement: add a `createdAt` field and reject tokens older than 30 days.

---

## Phase 3 — Gmail + Google Calendar

### User Stories
- As a coordinator, I complete a one-time Gmail OAuth setup. After that, I can send invite emails directly from the CommentaryPage — they come from my own Gmail address.
- As a coordinator, every outreach button has a companion "Copy for iMessage" button that formats the message, copies it to clipboard, and logs it as sent when I confirm.
- As a coordinator, I upload a screenshot of a text thread. The app reads it and extracts availability mentions, updating that talent's profile automatically.
- As a coordinator, I click "Send Briefing" and the talent gets an email with: competition details, Virtius session URL, commentary talent view link, Discord room info, and pre-production meeting time.
- As a coordinator, I click "Send Calendar Invite" and the talent gets a GCal event for competition day, 1 hour before start, with Discord info in the description.
- As a coordinator, I pick a date for the pre-production call and click "Schedule" — a GCal invite goes to the talent's email and the meeting is logged in the app.
- As a coordinator, every email I send appears in the talent's communication log on their profile page.

### Acceptance Criteria
- [ ] "Send Invite" button on CommentaryPage sends email from coordinator's Gmail account
- [ ] Every outreach button has a sibling "Copy for iMessage" button; confirming send logs the action
- [ ] Screenshot upload on TalentProfilePage extracts availability text via Claude API and surfaces it as a note with extracted dates
- [ ] "Send Briefing" sends a formatted email with all 5 required fields (competition, Virtius URL, commentary link, Discord, pre-prod time)
- [ ] "Send Calendar Invite" creates a GCal event 1 hour before competition start with Discord info
- [ ] "Schedule Pre-Production" creates a GCal event for the specified date/time
- [ ] All sent communications appear in a "Communications" tab on TalentProfilePage with timestamp and type

### Environment Variables Required (Phase 3 prerequisite)
The coordinator server (`server/.env` on `44.193.31.120`) needs:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

---

## Phase 4 — AI-Powered Discovery

### User Stories
- As a coordinator, I go to `/talent/discover`, select a school, and click "Find Candidates." The app pulls the RTN alumni roster for that school.
- As a coordinator, I see a list of candidate cards with suitability scores (1–5) and a brief explanation: "Strong candidate — competed for 4 years, has a gymnastics podcast, active on Instagram."
- As a coordinator, each card shows any social links Claude found (LinkedIn, Instagram) so I can quickly verify the person.
- As a coordinator, I click "Add to Roster" on a promising candidate. They're added with status `need-info` (or `has-contact` if Claude found an email).
- As a coordinator, if I run discovery on a school I've already run, the app recognizes existing records and shows "already in roster" on those cards.

### Acceptance Criteria
- [ ] `/talent/discover` page loads with a school name picker
- [ ] Clicking "Find Candidates" fetches alumni data for the selected school and returns candidate cards
- [ ] Each card shows: name, score (1–5), explanation, social links (if found)
- [ ] "Add to Roster" creates a `talentRoster/` entry with status `need-info` or `has-contact`
- [ ] Re-running discovery for the same school shows "already in roster" badge on existing records (no duplicates)

### Environment Variables Required (Phase 4 prerequisite)
```
ANTHROPIC_API_KEY=...  (on coordinator server)
```

---

## Phase 5 — Annual Survey + Pre-Production Alerts

### User Stories
- As a coordinator, at the start of each season I send talent a link to `/survey/2027`. They fill it out and their answers go directly into Firebase.
- As a coordinator, I can export the Google Form CSV and upload it in the app. It matches responses to existing talent by email and enriches their profiles in bulk.
- As a coordinator, when I open the Commentary panel for a competition, I see a smart "Available Talent" list — people who selected this competition in their survey, have Ready or Has Contact status, and aren't already booked on the same day.
- As a coordinator, I click "Copy talent list" and get a formatted list of names + phone numbers to paste into a group chat.
- As a coordinator, my homepage shows a pre-production alert panel with actionable items:
  - "Start outreach for [Event] — no commentary assigned and it's 6 weeks away"
  - "⚠ No confirmed commentary for [Event] — it's 3 weeks away"
  - "Send calendar invite to [Name] for [Event] — they're confirmed but haven't received it"
  - "Schedule pre-production call for [Event] — it's 1 week away"
  - "Follow up with [Name] — invited 5 days ago, no booking response"
- As a coordinator, completing an action (confirm talent, send invite, schedule meeting) clears the alert automatically.

### Acceptance Criteria
- [ ] Public survey page at `/survey/:year` collects: WAG/MAG, event availability checkboxes, tech setup (upload/download Mbps, mic type, headphones), role preference, Discord status
- [ ] Submitting the survey writes to `talentRoster/{talentId}` (matched by email) or creates a pending entry
- [ ] CSV batch upload on settings page matches by email and updates profiles in bulk
- [ ] CommentaryPage shows "Available Talent" tab filtered by: survey availability + status (ready/has-contact) + no same-day conflict
- [ ] "Copy talent list" copies formatted `Name — Phone` lines to clipboard
- [ ] Homepage shows pre-production alert panel with all 5 alert types
- [ ] Completing each action causes its alert to disappear within 5 seconds (real-time Firebase sync)

### Security Notes (Phase 5)
- **Survey is public** (`/survey/:year`). Writes go to `surveyResponses/{year}/` (append-only), NOT directly to `talentRoster/`. A coordinator must manually trigger the merge from settings. This limits abuse to junk survey entries, not talent data corruption.
- **No CAPTCHA or rate limiting** on survey submission. Acceptable for now (low-traffic, invite-only URL). If spam becomes an issue, add a simple honeypot field or Firebase App Check.

### Security Notes (Phase 3 — Screenshot Upload)
- **Claude API cost exposure:** Each screenshot-to-text call costs ~$0.01-0.05. No rate limit on the endpoint. Future improvement: add a per-hour cap (e.g., 20 calls/hour) in the server endpoint.

---

## Phase 6 — CRM UI Overhaul: Cross-Competition Visibility

### Core Problems
1. **"Who is attached to what competition?"** — TalentPage only shows a competition count. No way to see which competitions, what role, or what status without visiting each CommentaryPage individually.
2. **"Who have I asked to do what?"** — Outreach status (invited/confirmed/briefed) is siloed per-competition. No cross-competition outreach view, no "last contacted" column, no "awaiting response" filter.
3. **"Who has acknowledged availability?"** — `interested` and `surveyAvailability` data only surfaces in CommentaryPage's sidebar for one competition. TalentPage has no availability column at all.

### User Stories
- As a coordinator, I want to see all of a person's competition assignments in one row so that I don't have to click into each competition to find out who is doing what.
- As a coordinator, I want to see who I've invited and who hasn't responded yet across all competitions so that I can follow up efficiently.
- As a coordinator, I want to see who has flagged availability (via booking links or surveys) directly in the roster so that I can prioritize outreach.

### Acceptance Criteria
- [ ] A `useTalentAssignments` hook loads all commentary assignments across all competitions and merges them into talent records
- [ ] Competition ID discovery uses a server endpoint (`GET /api/competitions/index`) that returns only `{ [compId]: { eventName, meetDate } }` — NOT a client-side `get()` on the full `competitions/` tree
- [ ] All CRM pages use consistent color tokens (no more `gray-*` vs `zinc-*` mix)

---

## Phase 7 — TalentPage Table View + Assignment/Availability Columns

### User Stories
- As a coordinator, I want a table view of 428 contacts with sortable columns so that I can scan the roster quickly instead of scrolling through cards.
- As a coordinator, I want to see assignments, availability, and last outreach date in the roster so that I have full context without clicking into profiles.

### Acceptance Criteria
- [ ] TalentPage has a table view with sortable columns: Name, Status, WAG/MAG, Role, Assignments, Available For, Last Outreach, Phone
- [ ] Toggle between card view and table view (user preference persisted)
- [ ] Assignments column shows competition names with role and status as colored pills
- [ ] Availability column shows green/yellow/gray dots derived from `interested` + `surveyAvailability` data
- [ ] "Last Outreach" column shows most recent contact date and type across all competitions
- [ ] Table rows are clickable (navigate to talent profile)
- [ ] Card view also shows assignment details instead of generic count
- [ ] "Last Outreach" column shows "—" when no outreach exists
- [ ] Loading indicator visible while `useTalentAssignments` fetches cross-competition data

---

## Phase 8 — CommentaryPage: Kebab Menu + Conflict Badges + Kanban

### User Stories
- As a coordinator, I want assignment card actions collapsed into a menu so that I can focus on the next workflow step instead of 8+ buttons.
- As a coordinator, I want to see same-day conflicts prominently so that I don't double-book talent.
- As a coordinator, I want a kanban view of assignments by status so that I can see broadcast readiness at a glance.

### Acceptance Criteria
- [ ] Assignment cards show only the primary workflow action inline; all other actions are in a kebab (three-dot) menu
- [ ] Kebab menu groups actions into sections: Workflow, Outreach, Links, Danger
- [ ] Same-day conflict talent show an orange warning badge with hover popover explaining the conflict (competition name + status)
- [ ] Optional kanban toggle shows assignments as draggable columns: Assigned | Invited | Confirmed | Briefed | Declined
- [ ] Kanban columns show visual drop-target feedback (highlight on drag-over) and empty-column placeholder text
- [ ] Kebab menu closes on Escape key press

---

## Phase 9 — TalentProfilePage: Collapsible Sections + Activity Timeline

### User Stories
- As a coordinator, I want the profile page organized into collapsible sections so that I can control information density.
- As a coordinator, I want a visual timeline of all communications with type-based icons so that I can quickly see outreach history.

### Acceptance Criteria
- [ ] Profile organized into collapsible sections: Contact Info, Role & Expertise, Availability & Assignments, Notes, History
- [ ] "Availability & Assignments" section shows all current assignments (competition + role + status) with clickable links to `/{compId}/commentary`, plus interest flags
- [ ] Communications tab shows a vertical timeline with type-based icons and color coding
- [ ] Timeline has filter chips: All | iMessage | Invite | Briefing | Calendar | Pre-Production | Note

---

## Phase 10 — Power Features: Command Palette, Saved Filters, Bulk Operations

### User Stories
- As a coordinator, I want a command palette (Cmd+K) to find any talent or competition instantly during a live broadcast.
- As a coordinator, I want to save filter combinations so that I can one-click to "Available WAG Analysts" or "Awaiting Response" views.
- As a coordinator, I want to select multiple talent and perform bulk actions (status change, export) so that I'm not doing one-at-a-time operations.

### Acceptance Criteria
- [ ] Cmd+K command palette searches talent by name/phone/affiliation and competitions by name
- [ ] Command palette shows recent items and allows direct navigation
- [ ] TalentPage filter state persists in URL query params (bookmarkable)
- [ ] Multi-select on TalentPage table with floating action bar: Set Status, Set WAG/MAG, Export CSV (with confirmation dialog for destructive bulk actions)
- [ ] Saved views capped at 10 maximum
- [ ] CSV export includes: Name, Status, WAG/MAG, Role, Phone, Email, Assignments (comma-separated), Last Outreach
- [ ] Command palette debounces search input (300ms)
- [ ] No console errors on any CRM page
- [ ] All CRM pages render correctly at 1024px width (table has horizontal scroll if needed)

---

## Bug Catalog

No bugs cataloged yet. This PRD covers new feature development.

---

## Playwright Audit Results

Not applicable — this is a new feature PRD. Discovery will verify plan integrity only.
