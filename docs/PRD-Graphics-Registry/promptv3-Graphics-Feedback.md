# Graphics Feedback Implementation Workflow

## RULES
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- Each task deploys immediately after implementation (no batching)
- If verification fails, record bug and STOP (handle in next context window)

**What counts as ONE task?**
- A single task row from the Graphics Registry plan (GFX-T1, GFX-T2, etc.) OR
- A single task row from the RTN Stats plan (Task 44, Task 45)
- NOT multiple tasks combined

**Task execution order:**
1. GFX-T1 — "AVE" → "AVG"
2. GFX-T2 — "ALL AROUND" → "ALL-AROUND"
3. GFX-T3 — Multi-team logos + VS on stream starting page
4. Task 44 — Capture NQS/four-count average from RTN API (server-side)
5. Task 45 — Stat type selector in URL Generator
6. GFX-T6 — Top-align coaches/stats cards
7. GFX-T7 — Header typography audit

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the checkpoint before reading the next.

- [ ] **1.1** Read Graphics Registry implementation plan: `docs/PRD-Graphics-Registry/PLAN-Graphics-Registry-Implementation.md`

  **Output before continuing:**
  ```
  ✓ 1.1 Graphics Registry Plan Read
  - GFX tasks NOT STARTED: [fill in]
  - GFX tasks COMPLETE: [fill in]
  ```

- [ ] **1.2** Read RTN Stats implementation plan: `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-Implementation.md`

  **Output before continuing:**
  ```
  ✓ 1.2 RTN Stats Plan Read
  - Phase 7 tasks NOT STARTED: [fill in]
  - Phase 7 tasks COMPLETE: [fill in]
  ```

---

## Phase 2: Select Next Task

- [ ] **2.1** Following the execution order above, identify the FIRST task that is NOT STARTED or IN PROGRESS.

  If ALL tasks in the execution order are COMPLETE, output:
  ```
  ✓ ALL TASKS COMPLETE — nothing to do
  ```
  Then update both implementation plans to COMPLETE status and STOP.

- [ ] **2.2** Read the detailed task description from the relevant implementation plan (Phase 5 section in Graphics Registry plan, or Phase 7 section in RTN Stats plan).

- [ ] **2.3** Read each file the task says to modify.

  **Output:**
  ```
  ✓ 2.3 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Source plan: [Graphics Registry / RTN Stats]
  - Files to modify: [list]
  ```

---

## Phase 3: Implement

- [ ] **3.1** Implement the selected task exactly as described in the implementation plan.
- [ ] **3.2** Update the task status in the relevant implementation plan: NOT STARTED → COMPLETE, add notes about what was done.

  **Output:**
  ```
  ✓ 3.1 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 4: Build

- [ ] **4.1** If any `show-controller/` files changed, run `cd show-controller && npm run build`
- [ ] **4.2** If build fails, fix and retry

  **Output:**
  ```
  ✓ 4.1 Build
  - Result: [PASS / SKIPPED (no frontend changes)]
  ```

---

## Phase 5: Commit & Push

- [ ] **5.1** Stage specific files (not `git add -A`) and commit:
  ```bash
  git add [each modified file by path]
  git commit -m "Graphics Feedback: [brief description] ([Task ID])"
  git push origin main
  ```

  **Output:**
  ```
  ✓ 5.1 Committed and pushed
  - Commit message: [fill in]
  ```

---

## Phase 6: Deploy

Determine what changed and deploy accordingly. Follow deployment steps in CLAUDE.md.

- [ ] **6.1** Server changes (`server/` files)?
  ```
  SSH to coordinator (44.193.31.120):
  cd /opt/gymnastics-graphics && git pull origin main
  GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 restart coordinator
  ```

- [ ] **6.2** Frontend changes (`show-controller/` files)?
  → Deploy React SPA per CLAUDE.md Step 1 (tar, upload, extract)

- [ ] **6.3** Overlay/graphics changes (`output.html`, `overlays/`)?
  → Deploy per CLAUDE.md Step 2 (upload output.html + overlays, chmod 644)

  **Output:**
  ```
  ✓ 6 Deploy
  - Server: [YES / SKIPPED]
  - Frontend: [YES / SKIPPED]
  - Overlays: [YES / SKIPPED]
  ```

---

## Phase 7: Verify on Production

- [ ] **7.1** Run `browser_install`
- [ ] **7.2** Navigate to `https://commentarygraphic.com` using Playwright
- [ ] **7.3** Take screenshot
- [ ] **7.4** Check console: `browser_console_messages`
- [ ] **7.5** Test the specific change made by this task (see acceptance criteria in implementation plan)

  **Output:**
  ```
  ✓ 7 Verification
  - Result: [PASS / FAIL]
  - Console errors: [none / list]
  - Feature verified: [description]
  ```

**If verification FAILS:**
- Record what failed in the implementation plan
- STOP — fix in next context window

---

## Phase 8: Status Update

- [ ] **8.1** Count remaining NOT STARTED tasks across both plans
- [ ] **8.2** If all 7 tasks are COMPLETE:
  - Update Graphics Registry plan status → COMPLETE
  - Update RTN Stats Phase 7 status → COMPLETE

  **Output:**
  ```
  ✓ 8 Status
  - Remaining tasks: [count]
  - PRD status: [IN PROGRESS / COMPLETE]
  ```

---

## Deploy Reference

| Change Type | Deploy Step |
|-------------|-------------|
| Server only (`server/`) | SSH → git pull → pm2 restart (with credentials) |
| Frontend only (`show-controller/`) | npm run build + upload dist per CLAUDE.md Step 1 |
| Overlays (`output.html`, `overlays/`) | Upload per CLAUDE.md Step 2 + chmod 644 |
| Both frontend + overlays | Deploy frontend first, then overlays |
| All three | Server → frontend → overlays |

## Key Files

| File | Tasks |
|------|-------|
| `output.html` | GFX-T1, T2, T3, T6, T7, Task 45 |
| `overlays/team-stats.html` | GFX-T1, T6, Task 45 |
| `overlays/coaches.html` | GFX-T6 |
| `overlays/stream.html` | GFX-T3 |
| `show-controller/src/lib/graphicsRegistry.js` | GFX-T2, T3, Task 45 |
| `show-controller/src/lib/urlBuilder.js` | GFX-T3, Task 45 |
| `show-controller/src/pages/UrlGeneratorPage.jsx` | Task 45 |
| `server/lib/rtnStatsService.js` | Task 44 |
