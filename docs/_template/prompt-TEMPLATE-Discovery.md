# PRD-{FeatureName} — Discovery Prompt
# This is Variant A: New Feature — Plan Integrity Check
# For bug audits (existing broken system), use docs/_template/prompt-TEMPLATE-Discovery-B.md instead.

## RULES
- Complete ALL phases in a single iteration
- Mark checkboxes [x] as you complete each step
- After each phase, output the checkpoint summary before continuing

---

## Phase 1: Load Context

- [ ] **1.1** Read the PRD: `docs/PRD-{FeatureName}/PRD-{FeatureName}-{date}.md`
- [ ] **1.2** Read the implementation plan: `docs/PRD-{FeatureName}/implementation-plan.md`

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

Check for gaps in the logic that a file-by-file review misses — places where one task creates something and another consumes it, but the contract between them is wrong, incomplete, or never wired up.

### A. API Contract Audit

- [ ] **3.5.A** List every API endpoint a **frontend task** expects to call:
  Format: `METHOD /api/path` — request body shape — expected response shape

- [ ] **3.5.B** List every API endpoint a **server task** defines:
  Format: `METHOD /api/path` — accepted body — returned response shape

- [ ] **3.5.C** For each frontend call, confirm a matching server task exists with compatible shapes.

  **Output for each pair:**
  ```
  {METHOD /api/path}
  - Server task defines it: [Task N.N / MISSING]
  - Request shape match: [YES / MISMATCH — describe]
  - Response shape match: [YES / MISMATCH — describe]
  ```

### B. Route Registration Audit

- [ ] **3.5.D** For every new Express router or handler: is there a task that mounts it in `server/index.js`?
- [ ] **3.5.E** For every new React page: is there a task that adds the `<Route>` in `App.jsx`?
  If auth is involved: is the route placed correctly inside or outside the auth wrapper?

  **Output:**
  ```
  New Express routes:
    {router/handler} → mounted in index.js: [Task N.N / MISSING]

  New React pages:
    {PageName} → route in App.jsx: [Task N.N / MISSING]
    {PageName} → auth placement correct: [YES / NO / N/A]
  ```

### C. Firebase Schema Consistency

- [ ] **3.5.F** List every Firebase path **written** by a task (path + fields set)
- [ ] **3.5.G** List every Firebase path **read** by a task (path + fields expected)
- [ ] **3.5.H** For each path that is both written and read, verify the field names match.

  **Output:**
  ```
  {firebase/path}
  - Written by: [Task N.N] with fields: [list]
  - Read by: [Task N.N] expecting fields: [list]
  - Schema match: [YES / MISMATCH — describe]
  ```

### D. Import / Dependency Chain

- [ ] **3.5.I** For every new file that imports another **new** file (created in the same plan):
  confirm the dependency is created in an earlier task, not a later one.

  **Output:**
  ```
  {file A} imports {file B}
  - File B created in: [Task N.N]
  - File A created in: [Task N.N]
  - Order correct (B before A): [YES / NO — describe issue]
  ```

### E. Token / Flow Completeness (skip if not applicable)

- [ ] **3.5.J** If the feature uses tokens, signed links, or invite codes:
  - Is there a task that **generates** the token?
  - Is there a task that **validates** the token server-side?
  - Is there a task that **delivers** the token (email, SMS, etc.)?
  - Is there a task handling **expiry** or **revocation**?

  **Output:**
  ```
  Token flow:
  - Generation: [Task N.N / MISSING]
  - Server-side validation: [Task N.N / MISSING]
  - Delivery mechanism: [Task N.N / MISSING / N/A]
  - Expiry/revocation: [Task N.N / MISSING / N/A]
  ```

### F. Environment Variable Gaps

- [ ] **3.5.K** List every `process.env.X` reference introduced by the plan (scan task descriptions for env var names)
- [ ] **3.5.L** For each: is it already in the project, or does the plan document how to set it?

  **Output:**
  ```
  {process.env.VAR_NAME}
  - Already in project: [YES / NO]
  - Documented in plan: [YES / NO / needs task]
  ```

  **Phase 3.5 Summary:**
  ```
  ✓ Phase 3.5 Complete
  - API mismatches: [count / none]
  - Missing route registrations: [count / none]
  - Firebase schema mismatches: [count / none]
  - Import order issues: [count / none]
  - Token flow gaps: [count / none / N/A]
  - Undocumented env vars: [count / none]
  ```

---

## Phase 4: Deploy Coverage Check

- [ ] **4.1** Does every phase of code changes have a corresponding deploy phase?
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
  - Fix API contract mismatches (add the missing field, correct the route path, etc.)
  - Add missing route registration tasks
  - Fix Firebase schema mismatches
  - Reorder tasks where import/dependency chain is wrong
  - Add token flow tasks if generation or validation is missing
  - Add env var documentation tasks if needed
  - Fix auth guard placement for public routes
  - Add missing deploy phases

- [ ] **5.2** Commit the updated plan:
  ```bash
  git add docs/PRD-{FeatureName}/ && git commit -m "PRD-{FeatureName}: Discovery — fix plan holes" && git push origin main
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
  {FeatureName} — PLAN INTEGRITY CHECK
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
  - Token flow gaps: [count]
  - Undocumented env vars: [count]
Issues fixed: [count]
Plan status: READY / NEEDS REVIEW
═══════════════════════════════════════════════
```
