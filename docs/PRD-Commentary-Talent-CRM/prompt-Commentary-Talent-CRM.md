# PRD-Commentary-Talent-CRM — Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- **Deploy batching** — code tasks (0.x, 2.x, 3.x, 4.x, 5.x) commit only; deploy tasks (0-D.x, 2-D.x, 3-D.x, 4-D.x, 5-D.x, F.x) build + deploy + verify
- Screenshots save to `docs/PRD-Commentary-Talent-CRM/screenshots/`

## TEST URLS
- **Talent Roster:** `https://commentarygraphic.com/talent`
- **Booking Page:** `https://commentarygraphic.com/book/test-invalid` (expect graceful error)
- **Survey:** `https://commentarygraphic.com/survey/2027`
- **Discovery:** `https://commentarygraphic.com/talent/discover`
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

- [ ] **2.2** Determine task type:
  - **Code task** (Task 0.x, 2.x, 3.x, 4.x, 5.x) → implement + commit only, no deploy
  - **Deploy task** (Task 0-D.x, 2-D.x, 3-D.x, 4-D.x, 5-D.x, F.x) → build + deploy + verify
  - **Script run task** (Task 0-D.1) → run node script, verify Firebase, no npm build

- [ ] **2.3** Output your selection:
  ```
  ✓ 2.3 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Task type: [CODE / DEPLOY / SCRIPT-RUN]
  - Files to modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

- [ ] **2.5.1** For each file you plan to modify, read it fully before making any changes
- [ ] **2.5.2** For new files, read a similar existing file for patterns:
  - New page (BookingPage, SurveyPage, TalentDiscoveryPage) → read an existing page like `show-controller/src/pages/TalentPage.jsx`
  - New server lib → read `server/index.js` for Firebase Admin + env var patterns
  - New hook → read `show-controller/src/hooks/useTalentRoster.js`

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

  **Task 0.1 (Migration script):**
  - Install `csv-parse` if not in `server/package.json`: `cd server && npm install csv-parse`
  - CSV file paths use spaces — handle via `path.join(__dirname, '..', '..', 'docs', 'PRD-Commentary-Talent-CRM', 'Master 2026_ ...')`
  - Test with `--dry-run` flag before writing to Firebase
  - Generate a unique talentId: use `crypto.randomUUID()` for new records, or derive from name (slug)

  **Tasks 2.x (Booking):**
  - Booking page is PUBLIC — no auth check, just read token from URL param
  - Token storage: Firebase `bookingTokens/{uuid}` (use firebase-admin on server to create, Firebase client SDK on page to read)
  - The BookingPage fetches from the coordinator server (api.commentarygraphic.com:3003 or via the nginx proxy)

  **Tasks 3.x (Gmail/GCal):**
  - Check if `googleapis` is already in `server/package.json` before installing
  - OAuth flow: use refresh token (stored in env) to get access token each request — no user-facing OAuth redirect needed
  - If env vars not set, endpoint should return `{ error: 'Gmail not configured' }` — do NOT crash the server

  **Tasks 4.x (AI Discovery):**
  - RTN alumni page URL: check https://www.rtnathletics.com — find the correct URL pattern for alumni/roster pages
  - Use `node-fetch` or the built-in `fetch` (Node 18+) to scrape
  - Claude model for scoring: `claude-haiku-4-5-20251001` (fast + cheap for batch processing)
  - Rate-limit scoring to avoid hitting Claude API limits: process candidates sequentially, not all at once

  **Tasks 5.x (Survey/Alerts):**
  - Survey matches to existing talent by email (case-insensitive)
  - useProductionAlerts: use `onValue` listener on `competitions/` path — same pattern as `useTalentRoster.js`
  - Alert panel on Dashboard: add ABOVE existing content, collapsible if user prefers

  **Output:**
  ```
  ✓ 3.1 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 4: Commit

- [ ] **4.1** Update the task status in the implementation plan: IN PROGRESS → COMPLETE
- [ ] **4.2** Stage and commit:
  ```bash
  git add -A && git commit -m "PRD-Commentary-Talent-CRM: [brief task description]" && git push origin main
  ```

  **Output:**
  ```
  ✓ 4.2 Committed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 6 (there is no verification needed until the deploy task).

**If this is Task 0-D.1 (Script Run):**

- [ ] **5.1** Run dry-run first:
  ```bash
  cd /Users/juliacosmiano/code/gymnastics-graphics
  node server/scripts/migrateCommentaryCSV.js --dry-run
  ```
- [ ] **5.2** Review output — confirm counts look reasonable (~428 contacts)
- [ ] **5.3** If dry-run looks correct, run live:
  ```bash
  node server/scripts/migrateCommentaryCSV.js
  ```
- [ ] **5.4** No `npm run build` needed — Firebase-only

**If this is a FRONTEND DEPLOY task (2-D.1, 3-D.1, 4-D.1, 5-D.1):**

- [ ] **5.5** Frontend changed? (show-controller files)
  ```bash
  cd show-controller && npm run build
  # then upload dist per CLAUDE.md Step 1
  ```

- [ ] **5.6** Server changed? (Phases 2, 3, 4 only — not Phase 5)
  ```bash
  # SSH to 44.193.31.120 via ssh_exec MCP tool
  # command: cd /opt/gymnastics-graphics && git pull origin main && npm install
  # then restart PM2 per CLAUDE.md coordinator restart instructions
  # IMPORTANT: restart with GOOGLE_APPLICATION_CREDENTIALS set
  ```

- [ ] **5.7** Graphics files changed? No — this PRD doesn't touch output.html or overlays/

**If this is Task F.1 (Final full deploy):**
- All of 5.5 + 5.6 apply

  **Output:**
  ```
  ✓ 5 Deploy Complete
  - Frontend deployed: [YES / NO / SKIPPED]
  - Server deployed: [YES / NO / SKIPPED]
  - Script run: [YES / NO / N/A]
  ```

---

## Phase 6: Verify (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 7.

**If this is a DEPLOY task:**

- [ ] **6.1** Run `browser_install`
- [ ] **6.2** Navigate to the appropriate test URL (see TEST URLS at top)
- [ ] **6.3** Take screenshot → `docs/PRD-Commentary-Talent-CRM/screenshots/verify-task-{N}-description.png`
- [ ] **6.4** Check console: `browser_console_messages`
- [ ] **6.5** Verify the specific checks listed in the deploy task in the implementation plan

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
  - Update PRD status to COMPLETE in `PRD-Commentary-Talent-CRM-2026-03-10.md`
  - Commit: `git add -A && git commit -m "PRD-Commentary-Talent-CRM: Mark complete" && git push origin main`

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
| Migration script (Phase 0) | `node server/scripts/migrateCommentaryCSV.js` — NO build |
| Frontend only (show-controller) | `npm run build` + upload dist per CLAUDE.md Step 1 |
| Server (coordinator) | `ssh_exec` → `git pull && npm install` → `pm2 restart coordinator` with Firebase credentials per CLAUDE.md |
| Both frontend + server | Deploy frontend first, then restart server |
| Firebase data only | No deploy needed |

## Important: Coordinator Server Restart

Always restart with Firebase credentials:
```bash
cd /opt/gymnastics-graphics/server
pm2 delete coordinator
GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 start index.js --name coordinator
pm2 save
```
