# PRD-Rundown-01 Implementation Workflow

## RULES

⚠️ **MOST IMPORTANT RULE: Implement EXACTLY ONE TASK per iteration.**

- ONE task = one iteration. After completing ONE task, commit, deploy, verify, then STOP.
- The bash loop will restart you for the next task. Do NOT continue to additional tasks.
- Complete each workflow phase (1-7) FULLY before moving to the next phase
- Mark checkboxes [x] as you complete each step
- DO NOT parallelize file reads - read sequentially, one at a time
- After each phase, output the checkpoint summary before continuing
- If verification fails, record bug and STOP (handle in next context window)

**What counts as ONE task?**
- A single row in the Implementation Plan (e.g., "Task 53: Add notes field to segment")
- Each task has a unique whole number (Task 53, Task 54, etc.)
- NOT a phase (a phase contains multiple tasks)
- NOT multiple related tasks

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next file.

- [ ] **1.1** Read PRD: `docs/PRD-Rundown-01-EditorPrototype/PRD-Rundown-01-EditorPrototype.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Acceptance criteria count: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-Rundown-01-EditorPrototype/PLAN-Rundown-01-EditorPrototype-Implementation.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Implementation Plan Read
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

- [ ] **1.3** Read Infrastructure Reference: `docs/INFRASTRUCTURE.md`

  **Output before continuing:**
  ```
  ✓ 1.3 Infrastructure Reference Read
  - Relevant infrastructure noted: [fill in]
  ```

---

## Phase 2: Select ONE Task

- [ ] **2.1** From the Implementation Plan, identify the FIRST SINGLE task that is:
  - Status = "IN PROGRESS", OR
  - Status = "NOT STARTED" (if none are IN PROGRESS)

  **Select ONLY ONE task.** Example: "Task 53: Add notes field to segment" - not "Phase 5" or "Tasks 53 and 54".

- [ ] **2.2** Output your selection:
  ```
  ✓ 2.2 ONE Task Selected
  - Task ID: [e.g., Task 53]
  - Task name: [e.g., Add notes field to segment]
  - This is ONE task, not multiple: [yes]
  - Files to modify: [fill in]
  ```

---

## Phase 3: Implement ONE TASK ONLY

⚠️ **CRITICAL: You must implement EXACTLY ONE task, then STOP and proceed to Phase 4.**

Do NOT:
- Implement multiple tasks
- Start the "next" task after finishing one
- Batch related tasks together
- Continue to other tasks in the same phase

- [ ] **3.1** Implement ONLY the single task identified in step 2.2
- [ ] **3.2** STOP coding. Do not implement any other tasks.
- [ ] **3.3** Update Implementation Plan for THIS ONE TASK:
  - Mark task status (IN PROGRESS → COMPLETE)
  - Add notes about changes made
  - Add any bugs discovered

  **Output:**
  ```
  ✓ 3.3 ONE Task Implementation Complete
  - Task completed: [Task ID only]
  - Changes made: [brief summary]
  - Bugs found: [none / list]
  - Next task: [will be handled in NEXT iteration]
  ```

⚠️ **STOP HERE. Proceed to Phase 4 (Commit). Do NOT implement more tasks.**

---

## Phase 4: Commit & Push

- [ ] **4.1** Stage and commit:
  ```bash
  git add -A && git commit -m "PRD-Rundown-01: [brief description]" && git push origin main
  ```

  **Output:**
  ```
  ✓ 4.1 Committed and pushed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (if needed)

Determine what changed and deploy accordingly:

- [ ] **5.1** Backend changes? → `ssh_exec` to coordinator, restart PM2
- [ ] **5.2** Frontend changes? → Build and deploy per CLAUDE.md
- [ ] **5.3** No deployment needed? → Mark as skipped

  **Output:**
  ```
  ✓ 5.x Deploy
  - Deploy type: [backend / frontend / both / none]
  - Status: [success / skipped]
  ```

---

## Phase 6: Verify on Production

- [ ] **6.1** Navigate to https://commentarygraphic.com using Playwright
- [ ] **6.2** Take screenshot
- [ ] **6.3** Check console for errors
- [ ] **6.4** Test the specific feature changed

  **Output:**
  ```
  ✓ 6.4 Verification
  - Screenshot taken: [yes/no]
  - Console errors: [none / list]
  - Feature works: [yes / no]
  ```

**If verification FAILS:**
- Record bug in Implementation Plan with details
- STOP here - handle fix in next context window

---

## Phase 7: Update PRD Status

- [ ] **7.1** If ALL tasks complete → Update PRD status to COMPLETE
- [ ] **7.2** If tasks remain → Update PRD status to IN PROGRESS
- [ ] **7.3** Verify Implementation Plan matches PRD (fix any discrepancies)

  **Output:**
  ```
  ✓ 7.3 Status Updated
  - PRD status: [IN PROGRESS / COMPLETE]
  - Tasks remaining: [count]
  ```

---

## Quick Reference

| Change Type | Deploy Command |
|-------------|----------------|
| Backend only | `ssh_exec` to coordinator |
| Frontend only | `npm run build` + upload per CLAUDE.md |
| Both | Deploy backend first, then frontend |
| Docs only | No deploy needed |
