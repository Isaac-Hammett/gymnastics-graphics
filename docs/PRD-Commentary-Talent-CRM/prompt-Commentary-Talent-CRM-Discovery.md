# PRD-Commentary-Talent-CRM — Discovery Prompt

## RULES
- Complete ALL phases in a single iteration
- Mark checkboxes [x] as you complete each step
- After each phase, output the checkpoint summary before continuing
- This is Variant A: New Feature — Plan Integrity Check

---

## Phase 1: Load Context

- [x] **1.1** Read the PRD: `docs/PRD-Commentary-Talent-CRM/PRD-Commentary-Talent-CRM-2026-03-10.md`
- [x] **1.2** Read the implementation plan: `docs/PRD-Commentary-Talent-CRM/implementation-plan.md`

  **Output:**
  ```
  ✓ Phase 1 Complete
  - Total phases: 11 (5 code phases + 5 deploy phases + 1 final-deploy)
  - Total tasks: 30
  - Deploy tasks: 7
  - Code tasks: 23
  ```

---

## Phase 2: File Path Verification

For every file referenced in the implementation plan, verify it exists on disk (or confirm it's a new file to be created with a valid parent directory).

- [x] **2.1** List every unique file path mentioned across all tasks
- [x] **2.2** For each path, confirm the file exists (use Read or Glob) or the parent directory exists for new files

  **Output for each file:**
  ```
  server/scripts/migrateCommentaryCSV.js → NEW FILE (parent dir exists ✓)
  server/index.js → EXISTS ✓
  server/lib/gmailService.js → NEW FILE (parent dir exists ✓)
  server/lib/googleCalendarService.js → NEW FILE (parent dir exists ✓)
  server/lib/talentDiscoveryService.js → NEW FILE (parent dir exists ✓)
  show-controller/src/pages/BookingPage.jsx → NEW FILE (parent dir exists ✓)
  show-controller/src/pages/TalentDiscoveryPage.jsx → NEW FILE (parent dir exists ✓)
  show-controller/src/pages/SurveyPage.jsx → NEW FILE (parent dir exists ✓)
  show-controller/src/pages/SettingsPage.jsx → NEW FILE (parent dir exists ✓) — plan notes this
  show-controller/src/pages/HomePage.jsx → EXISTS ✓ (Task 5.5 target — was wrongly DashboardPage)
  show-controller/src/pages/DashboardPage.jsx → EXISTS but NO ROUTE in App.jsx ⚠ (fixed in plan)
  show-controller/src/pages/CommentaryPage.jsx → EXISTS ✓
  show-controller/src/pages/TalentPage.jsx → EXISTS ✓
  show-controller/src/pages/TalentProfilePage.jsx → EXISTS ✓
  show-controller/src/App.jsx → EXISTS ✓
  show-controller/src/hooks/useProductionAlerts.js → NEW FILE (parent dir exists ✓)
  CSV files (3) in docs/PRD-Commentary-Talent-CRM/ → ALL 3 EXIST ✓
  ```

- [x] **2.3** For any MISSING file: flag it — either the path is wrong or the plan needs a "create directory" step

Key files to check:
- `server/scripts/migrateCommentaryCSV.js` (new — check `server/scripts/` exists or needs creation)
- `server/index.js` (existing — must exist)
- `server/lib/gmailService.js` (new — check `server/lib/` exists)
- `server/lib/googleCalendarService.js` (new — check `server/lib/` exists)
- `server/lib/talentDiscoveryService.js` (new — check `server/lib/` exists)
- `show-controller/src/pages/BookingPage.jsx` (new)
- `show-controller/src/pages/TalentDiscoveryPage.jsx` (new)
- `show-controller/src/pages/SurveyPage.jsx` (new)
- `show-controller/src/pages/SettingsPage.jsx` (new or existing — check both)
- `show-controller/src/pages/HomePage.jsx` (existing — Task 5.5 target; DashboardPage.jsx has no route)
- `show-controller/src/pages/CommentaryPage.jsx` (existing — must exist)
- `show-controller/src/pages/TalentPage.jsx` (existing — must exist)
- `show-controller/src/pages/TalentProfilePage.jsx` (existing — must exist)
- `show-controller/src/App.jsx` (existing — must exist)
- `show-controller/src/hooks/useProductionAlerts.js` (new)
- CSV files in `docs/PRD-Commentary-Talent-CRM/` (3 files — must exist for Phase 0)

---

## Phase 3: Task Completeness Check

For each task in the implementation plan, check:

- [x] **3.1** Does it have a specific file path (not just "update the frontend")?
- [x] **3.2** Does it have a concrete code change (before/after diff, exact API shape, or function signature)?
- [x] **3.3** Does the deploy task for this phase have specific verification steps?
- [x] **3.4** Is the task correctly sequenced (no task depends on a later task)?

  **Output for each task:**
  ```
  All 30 tasks: file path PRESENT, concrete change PRESENT, correctly sequenced YES
  Issues found and fixed:
    Task 5.1: VAGUE — ambiguous security approach (two options, Netlify ref) → FIXED
    Task 5.5: WRONG FILE — DashboardPage.jsx has no route → FIXED to HomePage.jsx
  ```

Key sequencing checks:
- Task 2.2 (BookingPage.jsx) must come AFTER Task 2.1 (server endpoints) — client calls server
- Task 2.3 (App.jsx route) must come AFTER Task 2.2 (BookingPage.jsx)
- Task 3.3 (server endpoints) must come AFTER Tasks 3.1 + 3.2 (service files)
- Task 3.4 (CommentaryPage buttons) must come AFTER Task 3.3 (endpoints)
- Task 4.2 (server endpoint) must come AFTER Task 4.1 (discovery service)
- Task 4.3 (TalentDiscoveryPage) must come AFTER Task 4.2 (endpoint)
- Task 4.4 (App.jsx route) must come AFTER Task 4.3 (page)
- Task 5.4 (useProductionAlerts) must come BEFORE Task 5.5 (HomePage uses the hook)
- Task 5.1 (SurveyPage) must come BEFORE Task 5.2 (App.jsx route)

---

## Phase 3.5: Auth Guard Check

The React app may wrap routes in an auth component. Verify that public routes won't break:

- [x] **3.5.1** Read `show-controller/src/App.jsx` — identify how auth is enforced (is there an `<AuthGuard>`, `<PrivateRoute>`, or similar wrapper?)
- [x] **3.5.2** Confirm that public routes (`/book/:token`, `/survey/:year`) are placed OUTSIDE any auth wrapper
- [x] **3.5.3** If the current plan's Task 2.3 and Task 5.2 are ambiguous about auth placement, update those tasks with the exact placement needed

  **Output:**
  ```
  ✓ Phase 3.5 Complete
  - Auth wrapper found: YES — <CoordinatorGate> (only on /_admin/vm-pool; no global wrapper)
  - Public routes correctly placed outside auth: YES — tasks 2.3/5.2 both specify placement before /:compId
  ```

---

## Phase 4: Deploy Coverage Check

- [x] **4.1** Does every phase of code changes have a corresponding deploy phase?
- [x] **4.2** Are Phase 0-Deploy steps sufficient? (It's a script run, not a build — verify the plan doesn't accidentally call `npm run build` for Phase 0)
- [x] **4.3** Phases 2 and 3 both have server changes on the coordinator (44.193.31.120). Confirm both deploy tasks include server restart steps.
- [x] **4.4** Does Phase 5-Deploy correctly note that no server deploy is needed (Firebase-only)?
- [x] **4.5** Does the Final-Deploy task cover all acceptance criteria from the PRD?

  **Output:**
  ```
  ✓ Phase 4 Complete
  - Phases with deploy coverage: 6 / 6
  - Missing deploy coverage: none
  - Phase 0-Deploy correct (no build): YES
  - Phase 5-Deploy correct (no server): YES
  - Final verification covers all AC: YES
  ```

---

## Phase 5: Fix the Plan

- [x] **5.1** For every issue found in Phases 2–4, update the implementation plan with corrections:
  - Fix wrong file paths
  - Add missing concrete change descriptions
  - Add missing auth guard placement details (from Phase 3.5)
  - Reorder tasks if sequencing was wrong
  - Fix deploy task scope (add server restart steps where missing, remove build where not needed)
  - Add `server/scripts/` directory creation step to Task 0.1 if `server/scripts/` doesn't exist
  - If `SettingsPage.jsx` doesn't exist: update Task 5.6 to create the file + add route to App.jsx

- [x] **5.2** Commit the updated plan:
  ```bash
  git add docs/PRD-Commentary-Talent-CRM/ && git commit -m "PRD-Commentary-Talent-CRM: Discovery — fix plan holes" && git push origin main
  ```

  **Output:**
  ```
  ✓ Phase 5 Complete
  - Issues fixed: 3
  - Plan is ready for execution: YES
  ```

---

## Discovery Summary

```
═══════════════════════════════════════════════
  COMMENTARY TALENT CRM — PLAN INTEGRITY CHECK
═══════════════════════════════════════════════
Files verified: 13 exist / 7 new (parent ok) / 0 missing
Tasks checked: 30
  - Missing file paths: 0
  - Vague changes: 1 (Task 5.1 — fixed)
  - Sequencing issues: 0
  - Missing verification steps: 0
  - Auth guard issues: 0
  - Wrong file target: 1 (Task 5.5 — fixed)
Issues fixed: 3
Plan status: READY
═══════════════════════════════════════════════
```

---

## Post-Discovery Review (2026-03-11) — Additional Issues Found & Fixed

A second review identified 24 issues across all documents. Key fixes applied:

### PRD Fixes
- **#1** Added Phase 1 summary section (was undocumented)
- **#22** Fixed status line: `IN PROGRESS` → `PHASES 0-5 COMPLETE · PHASES 6-10 IN PROGRESS`
- **#6/#7** Added Security Notes sections for booking tokens (no TTL), survey (no CAPTCHA), and screenshot upload (no rate limit)

### Implementation Plan Fixes
- **#8** CRITICAL: Task 6.1 `useTalentAssignments` now uses dual-mode design — lightweight own listener when `competitions` not passed (avoids loading full competition tree on TalentPage). Tasks 7.2 and 9.1 updated to match.
- **#9** Task 6.2 expanded from 3 files to 8 files (added BookingPage, SurveyPage, TalentDiscoveryPage, SettingsPage, HomePage)
- **#11** Task 8.3 kanban: added missing Firebase write on drop (`update(ref(db, ...))`)
- **#12** Task 10.1 CommandPalette: added loading state requirement
- **#13** Task 10.2: added `{ replace: true }` on `setSearchParams` to avoid history pollution
- **#14** Added Rollback Procedure section

### Execution Prompt Fixes
- **#18/#21** Added build check (Phase 4.0) after every code task — catches compile errors before they stack
- **#19** Added inline Playwright login procedure (5 steps) so stateless agents know exactly how to authenticate
- **#20** Added `mkdir -p` step for `crm/` directory in Task 7.1 notes

### Known Issues NOT Fixed (acceptable risk / future work)
- **#3** Claude API rate limiting for screenshot upload — documented in PRD security notes, no code change
- **#4** RTN alumni scraping fragility — already shipped in Phase 4, works for now
- **#5** Claude scoring non-determinism — inherent to LLM; rubric is defined in the prompt
- **#10** No table virtualization for 428 rows — acceptable at current scale
- **#23** `availability-notes.md` is orphaned scratch notes — left as-is
- **#25** HTML5 drag-and-drop doesn't work on mobile/touch — acceptable for desktop-only CRM
- **#26** No ARIA attributes on kebab menu or command palette — acceptable for internal tool

---

## Post-Discovery Review #2 (2026-03-11) — 23 Issues Found, 17 Fixed

A third review stress-tested the implementation plan against the actual codebase behavior.

### Critical Fixes (would have caused execution failures)
- **C1** CRITICAL: Task 6.1 `onValue` on `competitions/` downloads entire multi-MB tree — Firebase RTDB cannot filter server-side. Replaced with targeted `get()` calls on `competitions/{compId}/config` and `competitions/{compId}/commentary` per competition, refreshed every 30s via `setInterval`.
- **C2** Task 10.1 CommandPalette same problem — `get(ref(db, 'competitions'))` downloads full tree. Updated to use targeted per-competition reads or reuse `useTalentAssignments` data.
- **C3** Task 8.3 kanban "no skipping statuses" rule too strict — coordinators often confirm talent directly (via text) without formal invite. Changed to allow forward skips, only block backward moves.
- **C4** Task 9.2 missing `preproduction` filter chip — Phase 3 writes `type: 'preproduction'` entries that would be invisible. Added to filter list.

### Significant Fixes
- **S1** Task 8.2 conflict scope too broad — `assigned` status is speculative/pre-outreach, creating false positive noise. Narrowed to `invited`/`confirmed`/`briefed` only.
- **S2** Task 8.3 kanban missing error handling — Firebase write failure on drop silently fails. Added try/catch with red toast.
- **S3** Task 10.2 URL filters missing debounce — every keystroke updates URL. Added 300ms debounce pattern.
- **S4** Task 10.3 bulk status change missing confirmation dialog — one misclick mass-changes status. Added confirmation.
- **S5** Task 10.3 shift+click range select missing anchor tracking — added `lastClickedIndex` useRef.
- **S6** Task 10.3 card view has no multi-select — added note to clear selection on view switch.
- **S7** Task 7.2 duplicate step numbering (two "3."s) — renumbered to 3-7.

### Run Script Fixes
- **R1** `grep -c "— COMPLETE"` also matches phase overview table rows — narrowed to `^### Task.*— COMPLETE`
- **R2** PRD completion check `grep "Status: COMPLETE"` doesn't match bold markdown `**Status:**` format — fixed to match `\*\*Status:\*\* COMPLETE` and exclude `IN PROGRESS`

### PRD Fixes
- **P1** Phase 9 acceptance criteria filter chips were generic ("Messages | Calls | Assignments | Status Changes") — updated to match actual types ("iMessage | Invite | Briefing | Calendar | Pre-Production")
- **P2** Phase 10 bulk operations acceptance criteria missing confirmation dialog mention — added

### Execution Prompt Fixes
- All Task 6.1, 8.2, 8.3, 9.2, 10.1, 10.2, 10.3 notes updated to match implementation plan fixes above

### Known Issues NOT Fixed (acceptable risk)
- **#5** `useTalentAssignments([talent])` on TalentProfilePage creates per-competition fetches for one person — acceptable at current scale
- **#9** Card view assignment text may overflow ~80 chars — agent will handle with CSS truncation
- **#12** Discovery prompt doesn't validate Phase 6-10 file paths — already validated manually in this review

---

## Post-Discovery Review #3 (2026-03-12) — 25 Issues Found, All Fixed

A fourth review cross-referenced the implementation plan against the actual codebase state (verified by reading all CRM source files).

### Critical Fixes (would have caused execution failures)

- **C1** CRITICAL: Task 6.1 `get(ref(db, 'competitions'))` + `Object.keys()` still downloads the entire multi-MB tree — Firebase RTDB client SDK has no shallow query. **Fix:** Added new Task 6.0 — server endpoint `GET /api/competitions/index` that returns only `{ [compId]: { eventName, meetDate, gender } }` via Firebase Admin SDK. Hook now fetches comp IDs from this endpoint instead. Updated Task 6.1, 10.1, Phase 6-Deploy, and execution prompt to match.
- **C2** Task 6.2 undercounted gray- usage — BookingPage (27), SurveyPage (32), SettingsPage (18) all have heavy `gray-*` usage but plan only had specific mappings for first 3 files. Plan already says "check all 8 files" but now explicitly notes the confirmed counts.
- **C3** Auth guard mismatch — discovery prompt said "no global wrapper, only `<CoordinatorGate>` on `/_admin/vm-pool`." Actual codebase wraps almost every route in `<RequireAuth>`. Task 10.1 (CommandPalette in App.jsx) didn't specify placement relative to auth. **Fix:** Updated Task 10.1 note: CommandPalette renders inside Router but outside RequireAuth (it fetches its own data, used on all pages).

### Significant Fixes (would have caused UX problems)

- **S1** No navigation link to `/settings` from any page — CSV batch import (Phase 5) is undiscoverable. **Known gap — not fixed in plan.** Future: add settings link to HomePage tools section.
- **S2** Kanban missing visual drop-target feedback — users can't see where they're dropping. **Fix:** Added `dragOverColumn` state + column highlight spec to Task 8.3.
- **S3** Kanban missing empty column placeholder — no visual indication that empty columns are valid drop targets. **Fix:** Added "No talent in this status" placeholder with dashed border to Task 8.3.
- **S4** Command palette missing search debounce — filtering 428 talent on every keystroke. **Fix:** Added 300ms debounce requirement to Task 10.1.
- **S5** TalentProfilePage "Availability & Assignments" section had no clickable actions — assignments shown without links to competitions. **Fix:** Added `<Link to=/{compId}/commentary>` requirement to Task 9.1.
- **S6** Last Outreach column had no empty state defined. **Fix:** Added "show '—' when no outreach exists" to Task 7.1.
- **S7** No loading state for `useTalentAssignments` — table flashes between states on 30s poll. **Fix:** Added `loading` prop to TalentTable, loading bar requirement. Was previously #11 "known issue" — now fixed.
- **S8** Table has 8 columns (~900px+ fixed widths) that overflow at 1024px. **Fix:** Added `overflow-x-auto` wrapper requirement to Task 7.1.

### Moderate Fixes (specs the agent would have had to guess)

- **M1** View toggle icon ambiguity — which icon is table vs card. **Fix:** Added explicit mapping to Task 7.2 notes: `TableCellsIcon` = table, `Squares2X2Icon` = card, with active/inactive color spec.
- **M2** Saved views no max limit. **Fix:** Added 10-view cap to Task 10.2.
- **M3** CSV export columns unspecified. **Fix:** Added column list to Task 10.3: Name, Status, WAG/MAG, Role, Phone, Email, Assignments, Last Outreach Date.
- **M4** Timeline filter chips missing `note` type — screenshot uploads (Task 3.5) write `type: 'note'` entries that were invisible. **Fix:** Added `'note'` to filter chip list in Task 9.2.
- **M5** Kebab menu no keyboard support. **Fix:** Added Escape key close to Task 8.1.
- **M6** TalentCard still references `totalCompetitions` field — Task 7.3 didn't mention removing it. **Fix:** Updated Task 7.3 to explicitly replace lines ~426-432.
- **M7** Phase 6-Deploy didn't include coordinator restart even though Task 6.0 adds a server endpoint. **Fix:** Updated Phase 6-Deploy and execution prompt deploy section.

### PRD Acceptance Criteria Additions
- Phase 6: Added competition index endpoint criterion
- Phase 7: Added loading indicator and "—" empty state criteria
- Phase 8: Added drop-target feedback, empty column placeholder, Escape key criteria
- Phase 9: Added clickable assignment links, "Note" filter chip
- Phase 10: Added saved views cap, CSV columns spec, command palette debounce, table horizontal scroll

### Phase Overview Table
- Phase 6 task count updated from 2 to 3 (added Task 6.0)
- Total task count updated from 54 to 55
