# PRD-Auth-Login — Discovery Prompt
# Variant A: New Feature — Plan Integrity Check

## RULES
- Complete ALL phases in a single iteration
- Mark checkboxes [x] as you complete each step
- After each phase, output the checkpoint summary before continuing

---

## Phase 1: Load Context

- [ ] **1.1** Read the PRD: `docs/PRD-Auth-Login/PRD-Auth-Login-2026-03-11.md`
- [ ] **1.2** Read the implementation plan: `docs/PRD-Auth-Login/implementation-plan.md`

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

---

## Phase 3: Task Completeness Check

For each task in the implementation plan, check:

- [ ] **3.1** Does it have a specific file path (not just "update the frontend")?
- [ ] **3.2** Does it have a concrete code change (before/after diff, exact API shape, or function signature)?
- [ ] **3.3** Does the deploy task for this phase have specific Playwright verification steps?
- [ ] **3.4** Is the task correctly sequenced (no task depends on a later task)?

  **Output for each task:**
  ```
  Task {N.N}: {Task Name}
  - File path: [PRESENT / MISSING]
  - Concrete change: [PRESENT / VAGUE — describe issue]
  - Correctly sequenced: [YES / NO — describe issue]
  - Issues: [none / list]
  ```

---

## Phase 3.5: Logic Gap Analysis

Check for gaps in the logic that a file-by-file review misses.

### A. API Contract Audit

- [ ] **3.5.A** This feature uses NO custom API endpoints — all auth is handled client-side via Firebase Auth SDK.
  Confirm: no tasks reference `server/index.js` or new Express routes.

  **Output:**
  ```
  API endpoints: NONE (client-side Firebase Auth only)
  Server changes required: NO
  ```

### B. Route Registration Audit

- [ ] **3.5.D** No new Express routers — confirm.
- [ ] **3.5.E** New React pages:
  - `LoginPage.jsx` → is there a task that adds the `<Route path="/login">` in `App.jsx`?
  - Is `/login` placed OUTSIDE the auth wrapper (it must be public)?

  **Output:**
  ```
  New Express routes: NONE

  New React pages:
    LoginPage → route in App.jsx: [Task N.N / MISSING]
    LoginPage → auth placement correct: [YES / NO]
  ```

### C. Firebase Schema Consistency

- [ ] **3.5.F** This feature reads/writes NO custom Firebase paths — Firebase Auth is a separate service, not RTDB.
  Confirm: no tasks reference `firebase_set`, `firebase_update`, or custom database paths.

  **Output:**
  ```
  Firebase RTDB changes: NONE (uses Firebase Auth service only)
  ```

### D. Import / Dependency Chain

- [ ] **3.5.I** For every new file that imports another new file created in the same plan:

  Expected chain:
  - `AuthContext.jsx` imports from `firebase.js` (Task 1.1 creates auth exports → Task 1.2 creates AuthContext) ✓
  - `LoginPage.jsx` imports `useAuth` from `AuthContext.jsx` (Task 1.2 → Task 1.3) ✓
  - `RequireAuth.jsx` imports `useAuth` from `AuthContext.jsx` (Task 1.2 → Task 2.1) ✓
  - `main.jsx` imports `AuthProvider` from `AuthContext.jsx` (Task 1.2 creates both) ✓
  - `App.jsx` imports `RequireAuth` (Task 2.1 → Task 2.2) ✓
  - `App.jsx` imports `LoginPage` (Task 1.3 → Task 2.2... but route is added in Task 1.3) — verify this

  **Output:**
  ```
  {file A} imports {file B}
  - File B created in: [Task N.N]
  - File A created in: [Task N.N]
  - Order correct (B before A): [YES / NO — describe issue]
  ```

### E. Token / Flow Completeness

- [ ] **3.5.J** Firebase Auth handles token management internally — no custom tokens, signed links, or invite codes in this feature.

  **Output:**
  ```
  Token flow: N/A — Firebase Auth manages sessions internally
  ```

### F. Environment Variable Gaps

- [ ] **3.5.K** Scan all task descriptions for `process.env.X` references.
  Expected: NONE — Firebase config is already in `firebase.js`, no new env vars needed.

  **Output:**
  ```
  New environment variables: NONE
  ```

  **Phase 3.5 Summary:**
  ```
  ✓ Phase 3.5 Complete
  - API mismatches: [count / none]
  - Missing route registrations: [count / none]
  - Firebase schema mismatches: [count / none]
  - Import order issues: [count / none]
  - Token flow gaps: N/A
  - Undocumented env vars: [count / none]
  ```

---

## Phase 4: Deploy Coverage Check

- [ ] **4.1** Does every phase of code changes have a corresponding deploy phase?
  - Phase 1 (3 code tasks) → Phase 1-Deploy (Tasks 1-D.1, 1-D.2)
  - Phase 2 (2 code tasks) → Phase 2-Deploy (Tasks 2-D.1, 2-D.2)
  - Phase 3 (1 code task) → Phase 3-Deploy (Task 3-D.1)
  - Final-Deploy (Tasks F.1, F.2)

- [ ] **4.2** Are the deploy task verification steps specific enough to catch regressions?
- [ ] **4.3** Does the Final-Deploy task cover all acceptance criteria from the PRD?

  **Output:**
  ```
  ✓ Phase 4 Complete
  - Phases with deploy coverage: [count / total]
  - Missing deploy coverage: [none / list phases]
  - Final verification covers all AC: [YES / NO]
  ```

---

## Phase 5: Fix the Plan

- [ ] **5.1** For every issue found in Phases 2–4, update the implementation plan with corrections:
  - Fix wrong file paths
  - Add missing concrete change descriptions
  - Fix import/dependency ordering
  - Add missing route registration tasks
  - Add missing deploy phases
  - Fix auth guard placement for public routes

- [ ] **5.2** Commit the updated plan:
  ```bash
  git add docs/PRD-Auth-Login/ && git commit -m "PRD-Auth-Login: Discovery — fix plan holes" && git push origin main
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
  Auth-Login — PLAN INTEGRITY CHECK
═══════════════════════════════════════════════
Files verified: [X] exist / [Y] new (parent ok) / [Z] missing
Tasks checked: [N]
  - Missing file paths: [count]
  - Vague changes: [count]
  - Sequencing issues: [count]
  - Missing verification steps: [count]
Logic gaps:
  - API mismatches: [count]
  - Missing route registrations: [count]
  - Firebase schema mismatches: [count]
  - Import order issues: [count]
  - Token flow gaps: N/A
  - Undocumented env vars: [count]
Issues fixed: [count]
Plan status: READY / NEEDS REVIEW
═══════════════════════════════════════════════
```
