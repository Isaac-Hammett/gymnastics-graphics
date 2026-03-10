# PRD-Commentary-Talent-CRM — Discovery Prompt

## RULES
- Complete ALL phases in a single iteration
- Mark checkboxes [x] as you complete each step
- After each phase, output the checkpoint summary before continuing
- This is Variant A: New Feature — Plan Integrity Check

---

## Phase 1: Load Context

- [ ] **1.1** Read the PRD: `docs/PRD-Commentary-Talent-CRM/PRD-Commentary-Talent-CRM-2026-03-10.md`
- [ ] **1.2** Read the implementation plan: `docs/PRD-Commentary-Talent-CRM/implementation-plan.md`

  **Output:**
  ```
  ✓ Phase 1 Complete
  - Total phases: [count]
  - Total tasks: [count]
  - Deploy tasks: [count]
  - Code tasks: [count]
  ```

---

## Phase 2: File Path Verification

For every file referenced in the implementation plan, verify it exists on disk (or confirm it's a new file to be created with a valid parent directory).

- [ ] **2.1** List every unique file path mentioned across all tasks
- [ ] **2.2** For each path, confirm the file exists (use Read or Glob) or the parent directory exists for new files

  **Output for each file:**
  ```
  {path/to/file.js} → EXISTS / NEW FILE (parent dir exists) / MISSING
  ```

- [ ] **2.3** For any MISSING file: flag it — either the path is wrong or the plan needs a "create directory" step

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
- `show-controller/src/pages/DashboardPage.jsx` (existing — must exist)
- `show-controller/src/pages/CommentaryPage.jsx` (existing — must exist)
- `show-controller/src/pages/TalentPage.jsx` (existing — must exist)
- `show-controller/src/pages/TalentProfilePage.jsx` (existing — must exist)
- `show-controller/src/App.jsx` (existing — must exist)
- `show-controller/src/hooks/useProductionAlerts.js` (new)
- CSV files in `docs/PRD-Commentary-Talent-CRM/` (3 files — must exist for Phase 0)

---

## Phase 3: Task Completeness Check

For each task in the implementation plan, check:

- [ ] **3.1** Does it have a specific file path (not just "update the frontend")?
- [ ] **3.2** Does it have a concrete code change (before/after diff, exact API shape, or function signature)?
- [ ] **3.3** Does the deploy task for this phase have specific verification steps?
- [ ] **3.4** Is the task correctly sequenced (no task depends on a later task)?

  **Output for each task:**
  ```
  Task {N.N}: {Task Name}
  - File path: [PRESENT / MISSING]
  - Concrete change: [PRESENT / VAGUE — describe issue]
  - Correctly sequenced: [YES / NO — describe issue]
  - Issues: [none / list]
  ```

Key sequencing checks:
- Task 2.2 (BookingPage.jsx) must come AFTER Task 2.1 (server endpoints) — client calls server
- Task 2.3 (App.jsx route) must come AFTER Task 2.2 (BookingPage.jsx)
- Task 3.3 (server endpoints) must come AFTER Tasks 3.1 + 3.2 (service files)
- Task 3.4 (CommentaryPage buttons) must come AFTER Task 3.3 (endpoints)
- Task 4.2 (server endpoint) must come AFTER Task 4.1 (discovery service)
- Task 4.3 (TalentDiscoveryPage) must come AFTER Task 4.2 (endpoint)
- Task 4.4 (App.jsx route) must come AFTER Task 4.3 (page)
- Task 5.4 (useProductionAlerts) must come BEFORE Task 5.5 (DashboardPage uses the hook)
- Task 5.1 (SurveyPage) must come BEFORE Task 5.2 (App.jsx route)

---

## Phase 3.5: Auth Guard Check

The React app may wrap routes in an auth component. Verify that public routes won't break:

- [ ] **3.5.1** Read `show-controller/src/App.jsx` — identify how auth is enforced (is there an `<AuthGuard>`, `<PrivateRoute>`, or similar wrapper?)
- [ ] **3.5.2** Confirm that public routes (`/book/:token`, `/survey/:year`) are placed OUTSIDE any auth wrapper
- [ ] **3.5.3** If the current plan's Task 2.3 and Task 5.2 are ambiguous about auth placement, update those tasks with the exact placement needed

  **Output:**
  ```
  ✓ Phase 3.5 Complete
  - Auth wrapper found: [YES/NO — name it if yes]
  - Public routes correctly placed outside auth: [YES/NO/NEEDS UPDATE]
  ```

---

## Phase 4: Deploy Coverage Check

- [ ] **4.1** Does every phase of code changes have a corresponding deploy phase?
- [ ] **4.2** Are Phase 0-Deploy steps sufficient? (It's a script run, not a build — verify the plan doesn't accidentally call `npm run build` for Phase 0)
- [ ] **4.3** Phases 2 and 3 both have server changes on the coordinator (44.193.31.120). Confirm both deploy tasks include server restart steps.
- [ ] **4.4** Does Phase 5-Deploy correctly note that no server deploy is needed (Firebase-only)?
- [ ] **4.5** Does the Final-Deploy task cover all acceptance criteria from the PRD?

  **Output:**
  ```
  ✓ Phase 4 Complete
  - Phases with deploy coverage: [count / total]
  - Missing deploy coverage: [none / list phases]
  - Phase 0-Deploy correct (no build): [YES/NO]
  - Phase 5-Deploy correct (no server): [YES/NO]
  - Final verification covers all AC: [YES/NO]
  ```

---

## Phase 5: Fix the Plan

- [ ] **5.1** For every issue found in Phases 2–4, update the implementation plan with corrections:
  - Fix wrong file paths
  - Add missing concrete change descriptions
  - Add missing auth guard placement details (from Phase 3.5)
  - Reorder tasks if sequencing was wrong
  - Fix deploy task scope (add server restart steps where missing, remove build where not needed)
  - Add `server/scripts/` directory creation step to Task 0.1 if `server/scripts/` doesn't exist
  - If `SettingsPage.jsx` doesn't exist: update Task 5.6 to create the file + add route to App.jsx

- [ ] **5.2** Commit the updated plan:
  ```bash
  git add docs/PRD-Commentary-Talent-CRM/ && git commit -m "PRD-Commentary-Talent-CRM: Discovery — fix plan holes" && git push origin main
  ```

  **Output:**
  ```
  ✓ Phase 5 Complete
  - Issues fixed: [count]
  - Plan is ready for execution: [YES / NO — if NO, list remaining concerns]
  ```

---

## Discovery Summary

```
═══════════════════════════════════════════════
  COMMENTARY TALENT CRM — PLAN INTEGRITY CHECK
═══════════════════════════════════════════════
Files verified: [X] exist / [Y] new (parent ok) / [Z] missing
Tasks checked: [N]
  - Missing file paths: [count]
  - Vague changes: [count]
  - Sequencing issues: [count]
  - Missing verification steps: [count]
  - Auth guard issues: [count]
Issues fixed: [count]
Plan status: READY / NEEDS REVIEW
═══════════════════════════════════════════════
```
