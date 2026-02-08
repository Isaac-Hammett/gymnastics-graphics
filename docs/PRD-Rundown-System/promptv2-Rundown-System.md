# PRD-Rundown-System Implementation Workflow

## RULES

**MOST IMPORTANT RULE: Implement EXACTLY ONE TASK per iteration.**

- ONE task = one iteration. After completing ONE task, commit, deploy, verify, then STOP.
- The bash loop will restart you for the next task. Do NOT continue to additional tasks.
- Complete each workflow phase (1-7) FULLY before moving to the next phase
- Mark checkboxes [x] as you complete each step
- DO NOT parallelize file reads - read sequentially, one at a time
- After each phase, output the checkpoint summary before continuing
- If verification fails, record bug and STOP (handle in next context window)

**CURRENT PRIORITY: Phase X Bug Fixes (Tasks 90-99)**

Phase X contains critical bug fixes that must be completed before any other work. These bugs block production use of the Rundown System.

**What counts as ONE task?**
- A single row in `docs/PRD-Rundown-System/PLAN-Rundown-System-Implementation.md` (e.g., "Task 90: Fix BUG-012")
- Each task has a unique whole number (Task 90, Task 91, etc.)
- NOT a phase (a phase contains multiple tasks)
- NOT multiple related tasks

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next file.

- [ ] **1.1** Read PRD: `docs/PRD-Rundown-System/PRD-Rundown-System-2026-01-23.md`

  **Output before continuing:**
  ```
  1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Acceptance criteria count: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-Rundown-System/PLAN-Rundown-System-Implementation.md`

  **Output before continuing:**
  ```
  1.2 Implementation Plan Read
  - Total tasks: [fill in]
  - Phase X tasks NOT STARTED: [fill in]
  - Phase X tasks COMPLETE: [fill in]
  - Current priority: Phase X Bug Fixes
  ```

- [ ] **1.3** Read Bug Tracker: `docs/PRD-Rundown-System/BUGS.md`

  **Output before continuing:**
  ```
  1.3 Bug Tracker Read
  - Open bugs: [count]
  - Next bug to fix: [BUG-XXX]
  - Corresponding task: [Task XX]
  ```

- [ ] **1.4** Read Detailed Plan (for context): `docs/PRD-Rundown-System/PLAN-Rundown-System-2026-01-23.md`

  **Output before continuing:**
  ```
  1.4 Detailed Plan Read
  - Current phase: Phase X (Bug Fixes)
  - Relevant details noted: [fill in]
  ```

- [ ] **1.5** Read Infrastructure Reference: `docs/INFRASTRUCTURE.md`

  **Output before continuing:**
  ```
  1.5 Infrastructure Reference Read
  - Relevant infrastructure noted: [fill in]
  ```

---

## Phase 2: Select ONE Task

**IMPORTANT: Phase X bug fix tasks (90-99) take priority over all other tasks.**

- [ ] **2.1** From `docs/PRD-Rundown-System/PLAN-Rundown-System-Implementation.md`, identify the FIRST SINGLE task that is:
  - In **Phase X** (Tasks 90-99) with Status = "NOT STARTED", OR
  - In **Phase X** with Status = "IN PROGRESS", OR
  - If Phase X is complete, then the next NOT STARTED task from other phases

  **Select ONLY ONE task.** Example: "Task 90: Fix BUG-012" - not "Phase X" or "Tasks 90 and 91".

- [ ] **2.2** Output your selection:
  ```
  2.2 ONE Task Selected
  - Task ID: [e.g., Task 90]
  - Task name: [e.g., Fix BUG-012 — Talent View Wrong Competition Name]
  - Bug being fixed: [e.g., BUG-012]
  - This is ONE task, not multiple: [yes]
  - Files to modify: [fill in]
  ```

---

## Phase 3: Implement ONE TASK ONLY

**CRITICAL: You must implement EXACTLY ONE task, then STOP and proceed to Phase 4.**

Do NOT:
- Implement multiple tasks
- Start the "next" task after finishing one
- Batch related tasks together
- Continue to other tasks in the same phase

- [ ] **3.1** Implement ONLY the single task identified in step 2.2
  - Follow the **Fix** instructions in the task description
  - Use the **Validation** steps to verify your fix works
- [ ] **3.2** STOP coding. Do not implement any other tasks.
- [ ] **3.3** Update `docs/PRD-Rundown-System/PLAN-Rundown-System-Implementation.md` for THIS ONE TASK:
  - Mark task status (NOT STARTED -> COMPLETE)
  - Add notes about changes made
  - Add any bugs discovered

  **Output:**
  ```
  3.3 ONE Task Implementation Complete
  - Task completed: [Task ID only]
  - Bug fixed: [BUG-XXX]
  - Changes made: [brief summary]
  - Validation passed: [yes/no]
  - Next task: [will be handled in NEXT iteration]
  ```

**STOP HERE. Proceed to Phase 4 (Commit). Do NOT implement more tasks.**

---

## Phase 4: Commit & Push

- [ ] **4.1** Stage and commit:
  ```bash
  git add -A && git commit -m "Fix BUG-XXX: [brief description]" && git push origin main
  ```

  **Output:**
  ```
  4.1 Committed and pushed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (if needed)

Determine what changed and deploy accordingly:

- [ ] **5.1** Backend changes (server/*)? -> `ssh_exec` to coordinator, restart PM2
- [ ] **5.2** Frontend changes (show-controller/*)? -> Build and deploy per CLAUDE.md
- [ ] **5.3** No deployment needed (docs only)? -> Mark as skipped

  **Output:**
  ```
  5.x Deploy
  - Deploy type: [backend / frontend / both / none]
  - Status: [success / skipped]
  ```

---

## Phase 6: Verify on Production

- [ ] **6.1** Navigate to https://commentarygraphic.com using Playwright
- [ ] **6.2** Take screenshot
- [ ] **6.3** Check console for errors
- [ ] **6.4** Test the specific bug fix using the **Validation** steps from the task

  **Output:**
  ```
  6.4 Verification
  - Screenshot taken: [yes/no]
  - Console errors: [none / list]
  - Bug fix verified: [yes / no]
  - Validation steps passed: [list which ones]
  ```

**If verification FAILS:**
- Record failure in `docs/PRD-Rundown-System/PLAN-Rundown-System-Implementation.md` with details
- STOP here - handle fix in next context window

---

## Phase 7: Update Status

- [ ] **7.1** Update `docs/PRD-Rundown-System/BUGS.md`:
  - Change bug status from "Task XX" to "FIXED"
  - Add date fixed
- [ ] **7.2** Check if Phase X is complete:
  - If ALL Phase X tasks (90-99) are COMPLETE -> Update Phase X status in implementation plan
  - If tasks remain -> Keep Phase X status as "IN PROGRESS"
- [ ] **7.3** Update Phase X progress count in implementation plan header

  **Output:**
  ```
  7.3 Status Updated
  - Bug marked fixed: [BUG-XXX]
  - Phase X progress: [X/10 complete]
  - Tasks remaining in Phase X: [count]
  ```

---

## Quick Reference

| Change Type | Deploy Command |
|-------------|----------------|
| Backend only | `ssh_exec` to coordinator, `pm2 restart all` |
| Frontend only | `npm run build` + upload per CLAUDE.md |
| Both | Deploy backend first, then frontend |
| Docs only | No deploy needed |
| Firebase schema | Use MCP firebase_set tool |

## Bug Fix Quick Reference

| Task | Bug | File(s) | Complexity |
|------|-----|---------|------------|
| 90 | BUG-012 | TalentView.jsx | Very Low |
| 91 | BUG-013a | RundownEditorPage.jsx | Low |
| 92 | BUG-013b | RundownEditorPage.jsx | Low |
| 93 | BUG-013c | server/index.js | Low |
| 94 | BUG-015a | Firebase | Low |
| 95 | BUG-015b | RundownEditorPage.jsx | Medium |
| 96 | BUG-015c | TalentView.jsx | Medium |
| 97 | BUG-014 | RundownEditorPage.jsx | Medium |
| 98 | BUG-017 | RundownEditorPage.jsx, Firebase | Medium |
| 99 | BUG-016 | RundownEditorPage.jsx | Low |
