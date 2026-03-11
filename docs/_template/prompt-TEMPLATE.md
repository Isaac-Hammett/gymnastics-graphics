# PRD-{FeatureName} — Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- **Deploy batching** — code tasks (1.x, 2.x) commit only; deploy tasks (1-D.x, F.x) build + upload + verify
- Screenshots save to `docs/PRD-{FeatureName}/screenshots/`

## TEST COMPETITION
- **Competition ID:** `{comp-id}`
- **Producer URL:** `https://commentarygraphic.com/{comp-id}/producer`
- **Output URL:** `https://commentarygraphic.com/output.html?comp={comp-id}`
- **Format:** {e.g., Women's 4-Team}

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next.

- [ ] **1.1** Read PRD: `docs/PRD-{FeatureName}/PRD-{FeatureName}-{date}.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Acceptance criteria count: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-{FeatureName}/implementation-plan.md`

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

- [ ] **2.2** Determine task type:
  - **Code task** (Task 1.x, 2.x, etc.) → implement + commit only, no deploy
  - **Deploy task** (Task x-D.x or Task F.x) → build + deploy + verify

- [ ] **2.3** Output your selection:
  ```
  ✓ 2.3 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Task type: [CODE / DEPLOY]
  - Files to modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

- [ ] **2.5.1** For each file you plan to modify, read it fully before making any changes
- [ ] **2.5.2** For new files, read a similar existing file for patterns

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

  **Output:**
  ```
  ✓ 3.1 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 4: Commit

- [ ] **4.1** Update the task status in the implementation plan: IN PROGRESS → COMPLETE
- [ ] **4.2** Stage and commit — use specific file paths, not `git add -A`:
  ```bash
  # Stage only the files you modified (from Phase 3.1) + the implementation plan
  git add docs/PRD-{FeatureName}/implementation-plan.md
  git add [each file modified in Phase 3.1]
  git commit -m "PRD-{FeatureName}: [brief task description]"
  git push origin main
  ```

  **Output:**
  ```
  ✓ 4.2 Committed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 6 (there is no verification needed until the deploy task).

**If this is a DEPLOY task:**

- [ ] **5.1** Frontend changed? (show-controller files)
  ```bash
  cd show-controller && npm run build
  # then upload dist per CLAUDE.md Step 1
  ```

- [ ] **5.2** Graphics files changed? (output.html, overlays/)
  ```bash
  # upload per CLAUDE.md Step 2
  # chmod 644 overlays/* after extract
  ```

- [ ] **5.3** Firebase only? → Mark deploy skipped.

  **Output:**
  ```
  ✓ 5 Deploy Complete
  - Frontend deployed: [YES / NO / SKIPPED]
  - Graphics deployed: [YES / NO / SKIPPED]
  ```

---

## Phase 6: Verify (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 7. Verification happens at the deploy task.

**If this is a DEPLOY task:**

- [ ] **6.1** Run `browser_install`
- [ ] **6.2** Navigate to the test URL
- [ ] **6.3** Take screenshot → `docs/PRD-{FeatureName}/screenshots/verify-task-{N}-description.png`
- [ ] **6.4** Check console: `browser_console_messages`
- [ ] **6.5** Verify the specific changes from this deploy phase:
  {Feature-specific verification steps go here — add from implementation plan}

**If verification FAILS:**
- Record what failed and why in the implementation plan
- STOP — fix in the next context window, do not continue

  **Output:**
  ```
  ✓ 6 Verification
  - Result: [PASS / FAIL]
  - Screenshot: [filename]
  - Console errors: [none / list]
  - Issues: [none / describe]
  ```

---

## Phase 7: Update Status

- [ ] **7.1** If ALL tasks in the implementation plan are COMPLETE:
  - Update PRD status to COMPLETE in `PRD-{FeatureName}-{date}.md`
  - Commit: `git add docs/PRD-{FeatureName}/ && git commit -m "PRD-{FeatureName}: Mark complete" && git push origin main`

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
