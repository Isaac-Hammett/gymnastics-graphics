# PRD-Production-Checklist Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` (Playwright MCP tool) to ensure the browser is available before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- DO NOT parallelize file reads - read sequentially, one at a time
- After each phase, output the checkpoint summary before continuing
- If verification fails, record bug and STOP (handle in next context window)
- **ONE TASK PER ITERATION** — implement one task from the implementation plan, then deploy and verify

## TEST COMPETITION FOR VERIFICATION
- **Competition ID:** `fr0ts7fj`
- **Producer URL:** `https://commentarygraphic.com/fr0ts7fj/producer`
- **Checklist URL:** `https://commentarygraphic.com/fr0ts7fj/checklist`
- **Name:** Pink Invitational 2026 (WAG, 4 teams: West Chester, Rutgers, Penn, Yale)
- Use this competition for all checklist verification — it has teams, rosters, and config data populated

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next file.

- [ ] **1.1** Read PRD: `docs/PRD-Production-Checklist/PRD-Production-Checklist-2026-01-24.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Number of user stories: [fill in]
  - Phases planned: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-Production-Checklist/PLAN-Production-Checklist-Implementation.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Implementation Plan Read
  - Total phases: [fill in]
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

- [ ] **1.3** Read Technical Plan: `docs/PRD-Production-Checklist/PLAN-Production-Checklist-2026-01-24.md`

  **Output before continuing:**
  ```
  ✓ 1.3 Technical Plan Read
  - Firebase paths defined: [list]
  - Components planned: [list]
  - Hooks planned: [list]
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
  - Reason: First incomplete task in priority order
  - Files to create/modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

**Before implementing, read ALL files you will modify.**

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
- [ ] **3.2** Update Implementation Plan:
  - Mark task status (NOT STARTED → IN PROGRESS → COMPLETE)
  - Add any notes about changes made
  - Add any bugs discovered

  **Output:**
  ```
  ✓ 3.2 Implementation Complete
  - Changes made: [brief summary]
  - Files created: [list]
  - Files modified: [list]
  - Bugs found: [none / list]
  ```

---

## Phase 4: Commit & Push

- [ ] **4.1** Stage specific changed files and commit (do NOT use `git add -A`):
  ```bash
  git add <specific-files> && git commit -m "PRD-Production-Checklist: [brief description]" && git push origin main
  ```

  **Output:**
  ```
  ✓ 4.1 Committed and pushed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (if needed)

Determine what changed and deploy accordingly:

- [ ] **5.1** Frontend changes (show-controller)? → Build and deploy per CLAUDE.md
- [ ] **5.2** Graphics files changed (output.html, overlays/)? → Deploy per CLAUDE.md Step 2
- [ ] **5.3** No deployment needed? → Mark as skipped

  **Output:**
  ```
  ✓ 5.x Deploy
  - Deploy type: [frontend / graphics / both / none]
  - Status: [success / skipped]
  ```

---

## Phase 6: Verify on Production

- [ ] **6.1** Navigate to the checklist URL using Playwright
- [ ] **6.2** Take screenshot
- [ ] **6.3** Check console for errors
- [ ] **6.4** Test the specific feature changed:

  **For Phase 1A tasks (core UI):**
  - Verify checklist page loads at `/{compId}/checklist`
  - Verify phase tabs render (Setup, Pre-Production, Day Of 2hr, Day Of 1hr)
  - Verify categories are collapsible
  - Verify manual checkboxes toggle and persist

  **For Phase 1B tasks (auto-validation):**
  - Verify auto-validated items show correct status (green/amber/red)
  - Verify "Fix" links navigate to correct pages
  - Verify status updates without page refresh
  - Verify notes can be added and persist

  **For Phase 1C tasks (contacts):**
  - Verify contacts panel shows for competition teams
  - Verify contacts can be added/edited
  - Verify contacts persist across page reloads
  - Verify click-to-call and click-to-email links work

  **For Phase 1D tasks (polish):**
  - Verify checklist link appears on competition cards
  - Verify skeleton loading states display during load
  - Verify keyboard navigation works (Tab, Space, Enter)
  - Verify responsive layout on different screen widths

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
- [ ] **7.3** Commit status update:
  ```bash
  git add docs/PRD-Production-Checklist/ && git commit -m "PRD-Production-Checklist: update status" && git push origin main
  ```

  **Output:**
  ```
  ✓ 7.3 Status Updated
  - PRD status: [IN PROGRESS / COMPLETE]
  - Tasks remaining: [count]
  - Next task: [task name]
  ```

---

## Quick Reference

| Change Type | Deploy Command |
|-------------|----------------|
| Frontend only | `npm run build` + upload per CLAUDE.md |
| Graphics files | Upload output.html + overlays/ per CLAUDE.md Step 2 |
| Both | Deploy frontend first, then graphics files |
| Docs only | No deploy needed |

---

## Key Firebase Paths

| Path | Description |
|------|-------------|
| `competitions/{compId}/checklist/items/` | Manual checkbox states |
| `competitions/{compId}/checklist/notes/` | Per-item notes |
| `competitions/{compId}/checklist/lastUpdated` | Timestamp of last modification |
| `competitions/{compId}/rundown/segments` | Rundown segments (for validators — NOT `production/rundown/segments/`) |
| `teamsDatabase/contacts/{team-key}/` | Team contacts (persists across competitions) |

## Key Files

| Component | File |
|-----------|------|
| Checklist items definition | `show-controller/src/lib/checklistItems.js` |
| Main hook | `show-controller/src/hooks/useProductionChecklist.js` |
| Checklist page | `show-controller/src/pages/ChecklistPage.jsx` |
| Progress bar | `show-controller/src/components/checklist/ChecklistProgress.jsx` |
| Category section | `show-controller/src/components/checklist/ChecklistCategory.jsx` |
| Checklist item | `show-controller/src/components/checklist/ChecklistItem.jsx` |
| Contacts panel | `show-controller/src/components/TeamContactsPanel.jsx` |
