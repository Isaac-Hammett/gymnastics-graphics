# PRD-7-Team-Audit Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` (Playwright MCP tool) to ensure the browser is available before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- After each phase, output the checkpoint summary before continuing
- **ONE TASK PER ITERATION** — implement one task from the implementation plan, then deploy and verify

## TEST COMPETITION FOR VERIFICATION
- **Competition ID:** `sewj4d2b`
- **Producer URL:** `https://commentarygraphic.com/sewj4d2b/producer`
- **Output URL:** `https://commentarygraphic.com/output.html?comp=sewj4d2b`
- **Format:** Women's 7-Team (7 teams, 4 apparatus, 7 rotations)

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next file.

- [ ] **1.1** Read PRD: `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Number of bugs cataloged: [fill in]
  - Critical / Major / Minor: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-7-Team-Audit/implementation-plan.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Implementation Plan Read
  - Total phases: [fill in]
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

- [ ] **2.2** Output your selection:
  ```
  ✓ 2.2 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Phase: [fill in]
  - Files to create/modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

- [ ] **2.5.1** For each file you plan to modify, read it fully
- [ ] **2.5.2** For new files, read a similar existing file for patterns

  **Output:**
  ```
  ✓ 2.5 Files Read
  - Files read: [list]
  - Patterns to follow: [brief notes]
  ```

---

## Phase 3: Implement

- [ ] **3.1** Implement the selected task
- [ ] **3.2** Update Implementation Plan status

  **Output:**
  ```
  ✓ 3.2 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  - Bugs found: [none / list]
  ```

---

## Phase 4: Commit & Push

- [ ] **4.1** Stage and commit:
  ```bash
  git add -A && git commit -m "PRD-7-Team-Audit: [brief description]" && git push origin main
  ```

---

## Phase 5: Deploy (if needed)

- [ ] **5.1** Frontend changes (show-controller)? → Build and deploy per CLAUDE.md
- [ ] **5.2** Graphics files changed (output.html, overlays/)? → Deploy per CLAUDE.md Step 2
- [ ] **5.3** No deployment needed? → Mark as skipped

---

## Phase 6: Verify on Production

- [ ] **6.1** Navigate to producer URL using Playwright
- [ ] **6.2** Take screenshot
- [ ] **6.3** Check console for errors
- [ ] **6.4** Test the specific feature changed:

  **For Phase 1 tasks (critical fixes):**
  - Task 1.1: Verify all 7 team buttons visible in producer sidebar
  - Task 1.2: Verify R1-R7 rotation buttons present
  - Task 1.3: Verify event summary renders 7-column grid

  **For Phase 2 tasks (major fixes):**
  - Task 2.1: Click Now Competing for team7 athlete → correct logo
  - Task 2.2: Verify 7 rotation buttons fit grid cleanly
  - Task 2.3: Verify event summary works without console errors

  **For Phase 3 tasks (minor fixes):**
  - Task 3.1: Verify bye teams visually distinguishable in team-bug
  - Task 3.2: Verify team7-stats graphic renders data
  - Task 3.3: No console errors related to schedule key

**If verification FAILS:**
- Record bug in PRD with details
- STOP here — handle fix in next context window

---

## Phase 7: Update Status

- [ ] **7.1** If ALL tasks complete → Update PRD status to COMPLETE
- [ ] **7.2** If tasks remain → keep IN PROGRESS
- [ ] **7.3** Commit status update

---

## Quick Reference

| Change Type | Deploy Command |
|-------------|----------------|
| Frontend only | `npm run build` + upload per CLAUDE.md |
| Graphics files | Upload output.html + overlays/ per CLAUDE.md Step 2 |
| Both | Deploy frontend first, then graphics files |
| Firebase data | No deploy needed |
