# PRD-Commentary-Talent-CRM — Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- **Deploy every task** — every task that modifies code must build, deploy, and verify on production before being marked COMPLETE
- Screenshots save to `docs/PRD-Commentary-Talent-CRM/screenshots/`

## TEST URLS
- **Talent Roster:** `https://commentarygraphic.com/talent`
- **Talent Profile:** `https://commentarygraphic.com/talent/{talentId}` (pick any talent with assignments)
- **Commentary Page:** Pick any competition from `https://commentarygraphic.com/` and navigate to its commentary page
- **Dashboard:** `https://commentarygraphic.com/` (after login)

## COORDINATOR SERVER
- **IP:** `44.193.31.120`
- **Dir:** `/opt/gymnastics-graphics`
- **Restart:** `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 start index.js --name coordinator` (see CLAUDE.md)

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next.

- [ ] **1.1** Read PRD: `docs/PRD-Commentary-Talent-CRM/PRD-Commentary-Talent-CRM-2026-03-10.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Core problems (Phase 6): [list 3]
  - Acceptance criteria count: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-Commentary-Talent-CRM/implementation-plan.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Implementation Plan Read
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

---

## Phase 2: Select Next Task

- [ ] **2.1** From the Implementation Plan, identify the FIRST task that is:
  - Status = "IN PROGRESS", OR
  - Status = "NOT STARTED" (if none are IN PROGRESS)
  - **Skip tasks already marked COMPLETE** (Phases 0-5 and F.1/F.2 are done)

- [ ] **2.2** Output your selection:
  ```
  ✓ 2.2 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Files to modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

- [ ] **2.5.1** For each file you plan to modify, read it fully before making any changes
- [ ] **2.5.2** For new files, read the most similar existing file for patterns:
  - New hook (`useTalentAssignments.js`) → read `show-controller/src/hooks/useCommentaryStaff.js` and `show-controller/src/hooks/useTalentRoster.js`
  - New component (`TalentTable.jsx`, `KanbanBoard.jsx`, `CommandPalette.jsx`, `KebabMenu.jsx`) → read the page that will use it
  - Modifying `TalentPage.jsx` → read it fully first
  - Modifying `CommentaryPage.jsx` → read it fully first
  - Modifying `TalentProfilePage.jsx` → read it fully first
  - Modifying `App.jsx` → read it fully — understand ALL existing routes before touching anything

  **Output:**
  ```
  ✓ 2.5 Files Read
  - Files read: [list]
  - Key patterns to follow: [brief notes]
  ```

---

## Phase 3: Implement

- [ ] **3.1** Implement the selected task exactly as described in the implementation plan
- [ ] **3.2** Update the task status in the implementation plan: NOT STARTED → IN PROGRESS

  **Task-specific notes:**

  **Task 6.0 (Competition index endpoint):**
  - Add `GET /api/competitions/index` to `server/index.js`
  - Read competitions from Firebase Admin SDK, return only `{ [compId]: { eventName, meetDate, gender } }`
  - Cache in memory for 60 seconds (simple `lastFetched` timestamp check)
  - This is a server-side task — no frontend changes

  **Task 6.1 (useTalentAssignments hook):**
  - **CRITICAL — data fetching:** Do NOT use `onValue` on `competitions/` or `get(ref(db, 'competitions'))` — both download the entire multi-MB tree. Instead: (1) fetch comp IDs from `GET /api/competitions/index` (Task 6.0), (2) targeted `get()` on `competitions/{compId}/commentary` only per competition. Refresh commentary every 30s via `setInterval`. Re-fetch index every 5 minutes.
  - **Dual mode:** Accept optional `competitions` param. When provided (e.g., from CommentaryPage which already has `useCompetitions()`), derive data via `useMemo` — no fetching. When NOT provided (e.g., TalentPage), use the server endpoint + targeted `get()` approach above.
  - Build `assignmentsByTalent` map: `{ [talentId]: { assignments: [...], lastOutreach, pendingCount, confirmedCount, availableFor, availabilityDot } }`
  - Accept `talentList` as first parameter to cross-reference `interested` and `surveyAvailability` on talent records
  - Return cleanup function in `useEffect` (clear the `setInterval`)
  - Do NOT store full competition objects in state — only extracted fields
  - Return `loading` boolean — `true` until first fetch completes. Consumers should show loading indicator.

  **Task 6.2 (Design token normalization):**
  - Grep ALL 8 CRM page files for `gray-` usage (see implementation plan for full list: TalentPage, TalentProfilePage, CommentaryPage, BookingPage, SurveyPage, TalentDiscoveryPage, SettingsPage, HomePage)
  - Find-and-replace `gray-` to `zinc-` equivalents per the mapping table in implementation plan
  - Skip files that already use only `zinc-*`
  - Do NOT change status badge colors (green, blue, amber, red, pink, purple, teal)
  - Do NOT change functional code — only Tailwind class names
  - Run `npm run build` after to confirm no errors

  **Task 7.1 (TalentTable component):**
  - **First:** Create `show-controller/src/components/crm/` directory — it does not exist yet. Run `mkdir -p show-controller/src/components/crm`
  - No external table library — just `<table>` with `useState` for sort
  - Accept `talents`, `assignmentsByTalent`, and `loading` as props
  - Assignment pills: competition name truncated ~20 chars + role abbreviation (PBP/ANA/PRD) + status-colored dot
  - Last Outreach column: show "—" when no outreach exists
  - When `loading` is true, show a subtle loading bar above the table (talent data renders immediately, assignment columns populate when ready)
  - Wrap table in `overflow-x-auto` for horizontal scroll at narrow widths
  - Sticky header: `position: sticky; top: 0;`
  - Row click: `navigate(`/talent/${talent.id}`)`

  **Task 7.2 (View toggle in TalentPage):**
  - Import `TableCellsIcon` and `Squares2X2Icon` from `@heroicons/react/24/solid`
  - `TableCellsIcon` = table view, `Squares2X2Icon` = card view. Active icon: `text-white`, inactive: `text-zinc-500`
  - Import `useTalentAssignments` (NOT `useCompetitions` — the hook creates its own lightweight listener)
  - Call `const { assignmentsByTalent, loading } = useTalentAssignments(talents)` without a `competitions` arg
  - Pass `loading` to `TalentTable` so it can show a loading indicator
  - Default to table view, persist in `localStorage`
  - Do NOT delete card view code — keep both conditional on `viewMode`

  **Task 7.3 (Card view enhancements):**
  - Pass `assignmentsByTalent` down to `TalentCard` as prop
  - Replace the `totalCompetitions` / `competitionHistory?.length` count (lines ~426-432) with actual competition names from `assignmentsByTalent`
  - Keep compact

  **Task 7.4 (Availability dots):**
  - Green: has `interested` or `surveyAvailability` for any competition
  - Yellow: status starts with `did-`
  - Gray: neither
  - Hover tooltip with competition names

  **Task 8.1 (Kebab menu):**
  - Close on click outside: `useEffect` + `document.addEventListener('mousedown', handler)` + `useRef` for container
  - Close on Escape key: add `document.addEventListener('keydown', handler)` when menu is open
  - Position: `absolute right-0 top-full mt-1` (parent needs `relative`)
  - Group headers: `text-xs text-zinc-500 uppercase tracking-wide`
  - Menu items: `px-3 py-2 hover:bg-zinc-700 cursor-pointer flex items-center gap-2 text-sm`
  - Delete existing button rows (lines ~559-651) after implementing kebab

  **Task 8.2 (Conflict badges):**
  - Extend `sameDayConflicts` (lines 71-85) to store details in a Map, not just IDs in a Set
  - Include `invited`, `confirmed`, and `briefed` statuses only — skip `assigned` (speculative, pre-outreach) and `declined`
  - Hover popover: CSS `group` / `group-hover:block` — no JS state needed
  - Import `ExclamationTriangleIcon` from Heroicons

  **Task 8.3 (Kanban board):**
  - HTML5 drag-and-drop: `draggable="true"`, `onDragStart`, `onDragOver` (preventDefault), `onDrop`
  - **Visual drop-target feedback:** Track `dragOverColumn` state. On `onDragEnter` highlight the target column (`bg-zinc-800/50 border-blue-500/50`). On `onDragLeave` remove highlight. This is critical UX — without it users can't see where they're dropping.
  - **Empty columns:** Show "No talent in this status" placeholder with `border-dashed border-zinc-700` (also acts as visible drop target).
  - **On valid drop:** Write new status to Firebase via `update(ref(db, \`competitions/${compId}/commentary/${talentId}\`), { status: newStatus })` — do NOT mutate local state; Firebase `onValue` listener handles re-render. **Wrap in try/catch** — on failure show red toast "Failed to update status"
  - Forward skipping IS allowed (e.g., assigned → confirmed). Only block backward moves and moves out of declined.
  - Right sidebar stays visible in both views
  - Persist view in `localStorage`

  **Task 9.1 (Collapsible sections):**
  - Read TalentProfilePage fully to understand field groupings
  - `CollapsibleSection` inline at bottom of file (like existing `Field` component)
  - Import `useTalentAssignments` for "Availability & Assignments" section
  - Each assignment row should be a clickable `<Link to={/${compId}/commentary}>` so the coordinator can navigate to that competition
  - "History" collapsed by default (`defaultOpen={false}`)

  **Task 9.2 (Activity timeline):**
  - Communication log at `talentRoster/{id}/communicationLog/{pushKey}`
  - Entries have: `type`, `sentAt`, `note`
  - Vertical line on left (`border-l`), dots at each entry
  - Inline `timeAgo` helper — no library. Reference `ScoreBugPanel.jsx` lines 30-48 for format. Extend to hours/days: `Xh ago`, `Xd ago`.
  - Filter chips: `['all', 'imessage', 'invite', 'briefing', 'calendar', 'preproduction', 'note']` — include ALL communication types (screenshot uploads write `type: 'note'`)
  - Filter: `activeFilter` state, default `'all'`

  **Task 10.1 (Command palette):**
  - `createPortal` from `react-dom`
  - `e.metaKey && e.key === 'k'` (Mac) or `e.ctrlKey && e.key === 'k'` (Windows)
  - `e.preventDefault()` to suppress browser default
  - Max 5 talent + 5 competitions in results
  - Recent items from `localStorage`
  - **Competition data:** Use `GET /api/competitions/index` (Task 6.0) — NOT `get(ref(db, 'competitions'))`. Cache result in `useRef` with 60s TTL.
  - **Debounce search input by 300ms** — filtering 428 talent on every keystroke will lag

  **Task 10.2 (URL filters):**
  - `useSearchParams` from react-router-dom replaces `useState` filter variables
  - **IMPORTANT:** Always pass `{ replace: true }` to `setSearchParams` — otherwise every keystroke adds a browser history entry
  - **Debounce search input:** Keep local `useState` for instant UI, debounce `setSearchParams` by 300ms via `useEffect` + `setTimeout`/`clearTimeout`
  - Omit empty values from URL params
  - Saved views in `localStorage` as JSON array — cap at 10 max

  **Task 10.3 (Bulk operations):**
  - Store `selectedIds` as array (not Set) for React compatibility
  - "Select all" selects filtered/visible rows only
  - Bulk status change MUST show confirmation dialog before writing ("Update status to [X] for [N] people?")
  - Track `lastClickedIndex` in `useRef` for shift+click range select
  - Clear selection when switching to card view
  - CSV export: `Blob` with `text/csv`, `URL.createObjectURL`, hidden `<a>` element. Columns: Name, Status, WAG/MAG, Role, Phone, Email, Assignments (comma-separated), Last Outreach Date.

  **Output:**
  ```
  ✓ 3.1 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 4: Build Check + Commit

- [ ] **4.0** Run `cd show-controller && npm run build` to verify no compile errors.
  - If the build FAILS: fix the error, then continue to 4.1.
  - If the build succeeds: continue to 4.1.
  - **Why:** Without this, multiple code tasks can stack up broken code that isn't caught until the deploy task, making it harder to diagnose which task introduced the error.

- [ ] **4.1** Update the task status in the implementation plan: NOT STARTED → IN PROGRESS (do NOT mark COMPLETE yet — that happens AFTER deploy+verify)
- [ ] **4.2** Stage and commit — use specific file paths, not `git add -A`:
  ```bash
  # Stage only the files you modified (from Phase 3.1) + the implementation plan
  git add docs/PRD-Commentary-Talent-CRM/implementation-plan.md
  git add [each file modified in Phase 3.1]
  git commit -m "PRD-Commentary-Talent-CRM: [brief task description]"
  git push origin main
  ```

  **Output:**
  ```
  ✓ 4.2 Committed
  - Build: PASS / FAIL (fixed)
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy — MANDATORY (do NOT skip)

**Every task MUST deploy before being marked COMPLETE. No exceptions.**

- [ ] **5.1** Frontend deploy (ALL tasks except 6.0 which is server-only):
  ```bash
  # Step 1: Build
  cd show-controller && npm run build

  # Step 2: Create tarball
  tar -czf /tmp/claude/dist.tar.gz -C dist .

  # Step 3: Upload tarball (use ssh_upload_file MCP tool)
  # localPath: /tmp/claude/dist.tar.gz
  # remotePath: /tmp/dist.tar.gz
  # target: 3.87.107.201

  # Step 4: Extract on server (use ssh_exec MCP tool)
  # target: 3.87.107.201
  # command: rm -rf /var/www/commentarygraphic/* && tar -xzf /tmp/dist.tar.gz -C /var/www/commentarygraphic/ && find /var/www/commentarygraphic -name '._*' -delete

  # Step 5: Re-deploy output.html and overlays (use ssh_upload_file + ssh_exec)
  # Upload output.html: localPath=/Users/juliacosmiano/code/gymnastics-graphics/output.html remotePath=/tmp/output.html target=3.87.107.201
  # Copy: ssh_exec target=3.87.107.201 command="cp /tmp/output.html /var/www/commentarygraphic/output.html"
  # Upload overlays: tar -czf /tmp/claude/overlays.tar.gz overlays/ then ssh_upload_file localPath=/tmp/claude/overlays.tar.gz remotePath=/tmp/overlays.tar.gz target=3.87.107.201
  # Extract overlays: ssh_exec target=3.87.107.201 command="cd /var/www/commentarygraphic && tar -xzf /tmp/overlays.tar.gz && find /var/www/commentarygraphic -name '._*' -delete && chmod 644 /var/www/commentarygraphic/overlays/*"
  ```

- [ ] **5.2** Server deploy (Task 6.0 ONLY — skip for all other tasks):
  ```bash
  # ssh_exec target=44.193.31.120 command="cd /opt/gymnastics-graphics && git pull origin main"
  # ssh_exec target=44.193.31.120 command="cd /opt/gymnastics-graphics/server && pm2 delete coordinator; GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 start index.js --name coordinator && pm2 save"
  ```

  **Output:**
  ```
  ✓ 5 Deploy Complete
  - Frontend deployed: [YES / NO]
  - Server deployed: [YES / NO]
  ```

---

## Phase 6: Verify

- [ ] **6.1** Run `browser_install`
- [ ] **6.2** Run the task-specific verification steps listed below
- [ ] **6.3** Take screenshots → `docs/PRD-Commentary-Talent-CRM/screenshots/`
- [ ] **6.4** Check console: `browser_console_messages`

**Credentials:** Read test account email/password from `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`

**Login procedure (all deploy verifications that say "Log in"):**
1. `browser_navigate` to `https://commentarygraphic.com/login`
2. `browser_snapshot` to find the email and password input refs
3. `browser_fill_form` with email and password from credentials file
4. `browser_click` the sign-in button
5. Wait for redirect to `/` — `browser_wait_for` the homepage content

**Task-specific verification:**

**Task 6.0 (server endpoint):**
- Verify: `curl https://api.commentarygraphic.com/api/competitions/index` — should return JSON with competition IDs + metadata

**Task 6.1 (useTalentAssignments hook):**
- Log in, navigate to `https://commentarygraphic.com/talent` — no console errors
- Screenshot → `verify-task6.1.png`

**Task 6.2 (design tokens):**
- Log in, navigate to `https://commentarygraphic.com/talent` — consistent zinc colors
- Navigate to any competition's commentary page — consistent zinc colors
- Screenshot → `verify-task6.2-talent.png`, `verify-task6.2-commentary.png`

**Task 7.1 (TalentTable):**
- Log in, navigate to `https://commentarygraphic.com/talent` — no console errors (table component exists but may not be wired in yet)
- Screenshot → `verify-task7.1.png`

**Task 7.2 (view toggle):**
- Log in, navigate to `https://commentarygraphic.com/talent`
- Table view renders by default with sortable columns
- Toggle to card view works
- Screenshot → `verify-task7.2-table.png`, `verify-task7.2-cards.png`

**Task 7.3 (card view enhancements):**
- Log in, navigate to `https://commentarygraphic.com/talent` — toggle to card view
- Cards show assignment details
- Screenshot → `verify-task7.3.png`

**Task 7.4 (availability dots):**
- Log in, navigate to `https://commentarygraphic.com/talent`
- Available For column shows green/yellow/gray dots
- Screenshot → `verify-task7.4.png`

**Task 8.1 (kebab menu):**
- Log in, navigate to a competition's commentary page
- Assignment cards show primary action + kebab menu only
- Click kebab — dropdown with grouped sections
- Screenshot → `verify-task8.1.png`

**Task 8.2 (conflict badges):**
- Log in, navigate to a competition's commentary page
- If conflicts exist, orange badge visible with hover popover
- Screenshot → `verify-task8.2.png`

**Task 8.3 (kanban board):**
- Log in, navigate to a competition's commentary page
- Toggle to kanban — columns render by status
- Screenshot → `verify-task8.3.png`

**Task 9.1 (collapsible sections):**
- Log in, navigate to `https://commentarygraphic.com/talent/{talentId}` (pick talent with assignments)
- Collapsible sections visible with chevron toggles
- Availability & Assignments section shows cross-competition data
- Screenshot → `verify-task9.1.png`

**Task 9.2 (activity timeline):**
- Log in, navigate to `https://commentarygraphic.com/talent/{talentId}`
- Communications tab shows timeline with type icons
- Filter chips work
- Screenshot → `verify-task9.2.png`

**Task 10.1 (command palette):**
- Test Cmd+K palette on any page
- Screenshot → `verify-task10.1.png`

**Task 10.2 (URL filters):**
- Test URL filter persistence on talent page
- Screenshot → `verify-task10.2.png`

**Task 10.3 (bulk operations):**
- Test bulk select + export CSV
- Screenshot → `verify-task10.3.png`

**If verification FAILS:**
- Record what failed and why in the implementation plan
- STOP — fix in the next context window, do not continue

  **Output:**
  ```
  ✓ 6 Verification
  - Result: [PASS / FAIL]
  - Screenshots: [list filenames]
  - Console errors: [none / list]
  - Issues: [none / describe]
  ```

---

## Phase 7: Mark Task COMPLETE

- [ ] **7.0** NOW mark the task COMPLETE in the implementation plan: IN PROGRESS → COMPLETE
  - Stage, commit, and push this change:
  ```bash
  git add docs/PRD-Commentary-Talent-CRM/implementation-plan.md
  git commit -m "PRD-Commentary-Talent-CRM: Mark task COMPLETE after deploy+verify"
  git push origin main
  ```

- [ ] **7.1** If ALL tasks in the implementation plan are COMPLETE:
  - Update PRD status to COMPLETE in `PRD-Commentary-Talent-CRM-2026-03-10.md`
  - Commit: `git add docs/PRD-Commentary-Talent-CRM/ && git commit -m "PRD-Commentary-Talent-CRM: Mark complete — UI overhaul done" && git push origin main`

- [ ] **7.2** If tasks remain: leave PRD status as IN PROGRESS (the loop will continue)

  **Output:**
  ```
  ✓ 7 Status Update
  - PRD status: [IN PROGRESS / COMPLETE]
  - Remaining tasks: [count]
  ```

---

## Deploy Reference

| Change Type | Deploy Step |
|-------------|-------------|
| Frontend only (show-controller) | `npm run build` + upload dist per CLAUDE.md Step 1 |
| Graphics files (output.html, overlays/) | Upload per CLAUDE.md Step 2 + `chmod 644 overlays/*` |
| Both | Deploy frontend first, then graphics files |
| Firebase data only | No deploy needed |
| Server (coordinator) | `ssh_exec` → `pm2 restart coordinator` with credentials per CLAUDE.md |
