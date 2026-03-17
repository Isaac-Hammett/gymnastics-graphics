# PRD-RTN-Stats-Integration — Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- **Deploy batching** — code tasks commit only; deploy after every 3 code tasks or when a task requires server/frontend changes to verify
- Screenshots save to `docs/PRD-RTN-Stats-Integration/screenshots/`

**What counts as ONE task?**
- A single row in the Phase 6 or Phase 7 task table of `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-Implementation.md`
- Each task has a unique number (Task 27, Task 28, ... Task 44, Task 45)
- NOT multiple related tasks

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next.

- [ ] **1.1** Read Implementation Plan: `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-Implementation.md`

  **Output before continuing:**
  ```
  ✓ 1.1 Implementation Plan Read
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

- [ ] **1.2** Read Bug Tracker: `docs/PRD-RTN-Stats-Integration/BUGS.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Bugs Read
  - Total open bugs: [fill in]
  - High severity: [fill in]
  - Medium severity: [fill in]
  - Low severity: [fill in]
  ```

---

## Phase 2: Select Next Task

- [ ] **2.1** From the Implementation Plan (Phase 6 or Phase 7 tables), identify the FIRST task that is:
  - Status = "IN PROGRESS", OR
  - Status = "NOT STARTED" (if none are IN PROGRESS)

- [ ] **2.2** Determine task type:
  - **Code task** — changes to server or client code → implement + commit, no deploy
  - **Deploy task** — after accumulating code tasks, or task needs live verification → build + deploy + verify
  - **Docs-only task** (e.g., Task 37, 43) — update docs + commit, no deploy

  **Guideline:** Tasks that change `server/` files need a coordinator deploy. Tasks that change `show-controller/` files need a frontend deploy. Tasks that only change docs need no deploy.

- [ ] **2.3** Output your selection:
  ```
  ✓ 2.3 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Task type: [CODE / DEPLOY / DOCS]
  - Files to modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

- [ ] **2.5.1** Read the specific BUGS.md section for this task's bug (search for the BUG-0XX heading)
- [ ] **2.5.2** Read each file you plan to modify

  **Output:**
  ```
  ✓ 2.5 Files Read
  - Files read: [list]
  - Key patterns to follow: [brief notes]
  ```

---

## Phase 3: Implement

- [ ] **3.1** Implement the selected task exactly as described in the implementation plan
- [ ] **3.2** Update the task status in the implementation plan: NOT STARTED → COMPLETE, add notes

  **Output:**
  ```
  ✓ 3.1 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 4: Commit

- [ ] **4.1** Stage and commit — use specific file paths, not `git add -A`:
  ```bash
  git add docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-Implementation.md
  git add [each file modified in Phase 3.1]
  git commit -m "PRD-RTN-Stats: [brief task description] (Task NN)"
  git push origin main
  ```

  **Output:**
  ```
  ✓ 4.1 Committed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (skip for code-only and docs-only tasks)

**If this is a CODE or DOCS task:** Skip to Phase 7.

**If this task requires deploy:**

- [ ] **5.1** Server changes? (`server/` files)
  ```bash
  # ssh_exec to coordinator (44.193.31.120)
  # cd /opt/gymnastics-graphics && git pull origin main
  # GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 restart coordinator
  ```

- [ ] **5.2** Frontend changes? (`show-controller/` files)
  ```bash
  cd show-controller && npm run build
  # then upload dist per CLAUDE.md Step 1
  ```

  **Output:**
  ```
  ✓ 5 Deploy Complete
  - Server deployed: [YES / NO / SKIPPED]
  - Frontend deployed: [YES / NO / SKIPPED]
  ```

---

## Phase 6: Verify (deploy tasks only — skip for code/docs tasks)

**If this is a CODE or DOCS task:** Skip to Phase 7.

- [ ] **6.1** Run `browser_install`
- [ ] **6.2** Navigate to `https://commentarygraphic.com`
- [ ] **6.3** Take screenshot → `docs/PRD-RTN-Stats-Integration/screenshots/verify-task-NN.png`
- [ ] **6.4** Check console: `browser_console_messages`
- [ ] **6.5** Verify the specific bug fix works

**If verification FAILS:**
- Record what failed in the implementation plan
- STOP — fix in next context window

  **Output:**
  ```
  ✓ 6 Verification
  - Result: [PASS / FAIL]
  - Console errors: [none / list]
  ```

---

## Phase 7: Update Status

- [ ] **7.1** If ALL Phase 6 tasks are COMPLETE:
  - Update PRD status to COMPLETE
  - Commit: `git add docs/PRD-RTN-Stats-Integration/ && git commit -m "PRD-RTN-Stats: Mark Phase 6 complete" && git push origin main`

- [ ] **7.2** If tasks remain: leave as IN PROGRESS (the loop continues)

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
| Server only (`server/`) | SSH → git pull → `pm2 restart coordinator` (with credentials) |
| Frontend only (`show-controller/`) | `npm run build` + upload dist per CLAUDE.md Step 1 |
| Both | Deploy server first, then frontend |
| Docs only | No deploy needed |

## Key Files

| File | Purpose |
|------|---------|
| `docs/PRD-RTN-Stats-Integration/BUGS.md` | Bug tracker — 17 bugs with full root cause analysis |
| `server/lib/rtnStatsService.js` | Core stats service (Tasks 27-28, 36-37, 40-41) |
| `server/index.js` | Socket events, show-start snapshot (Tasks 31, 42) |
| `show-controller/src/hooks/useRtnStats.js` | Stats hook (Tasks 27-28, 32, 39) |
| `show-controller/src/hooks/useRoadToNationals.js` | Coach hooks (Tasks 29, 35) |
| `show-controller/src/lib/roadToNationals.js` | Client-side RTN API (Tasks 29, 35) |
| `show-controller/src/components/StatsStatusBadge.jsx` | Stats badge (Tasks 30, 33) |
| `show-controller/src/components/StatsDetailPanel.jsx` | Stats detail panel (Tasks 33, 34) |
| PRD + tech plan docs | Documentation fixes (Tasks 37, 43) |
| `show-controller/src/lib/graphicsRegistry.js` | Graphics registry (Task 45) |
| `show-controller/src/lib/urlBuilder.js` | URL builder (Task 45) |
| `show-controller/src/pages/UrlGeneratorPage.jsx` | URL Generator UI (Task 45) |
| `overlays/team-stats.html` | Team stats overlay (Task 45) |
| `output.html` | Main graphics renderer (Task 45) |
