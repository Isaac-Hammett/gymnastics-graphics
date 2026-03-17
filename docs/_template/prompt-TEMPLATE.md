# PRD-{FeatureName} — Implementation Workflow

## RULES
- **REJECTIONS FIRST**: Before doing ANY other work, you MUST run Phase 1 (Check for Rejections). If there are REJECTED entries in the verification log, you MUST fix them before working on new tasks. Do NOT skip this. Do NOT proceed to Phase 2 if rejections exist.
- **FIRST**: Run `browser_install` before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- **Deploy every task** — every task that modifies code must build, deploy, and verify on production before being marked COMPLETE
- Screenshots save to `docs/PRD-{FeatureName}/screenshots/`

## TEST URLS
- **Primary page:** `https://commentarygraphic.com/{page}`
- {Add more URLs relevant to the feature}

## COORDINATOR SERVER
- **IP:** `44.193.31.120`
- **Dir:** `/opt/gymnastics-graphics`
- **Restart:** `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 start index.js --name coordinator` (see CLAUDE.md)

---

## Phase 1: Check for Human Rejections — MANDATORY FIRST STEP

**This phase MUST be completed before ANY other work. Do NOT skip it.**

- [ ] **1.1** Use Grep to search `docs/PRD-{FeatureName}/verification-log.html` for `REJECTED` (without quotes — JSON double-quote patterns cause false negatives in Grep). Use `output_mode: "content"` so you can see the matching lines. If matches are found, they will contain `"result": "REJECTED"`.

- [ ] **1.2** **If REJECTED entries are found — STOP and fix them. Do NOT proceed to Phase 2.**
  - Find the FIRST entry with `"result": "REJECTED"`.
  - Read the `rejectionReason` — this is feedback from the human reviewer explaining what's wrong.
  - This rejected entry is your ONLY task for this iteration. Skip Phase 2 (task selection) entirely.
  - Treat it like a bug fix: diagnose the issue, implement a fix, deploy, and verify.
  - **When writing the verification log entry after fixing, set `"result": "NEEDS REVIEW"` — NOT `"PASS"`.** The human must approve before it becomes PASS.
  - If no code fix is needed (e.g., the rejection was about a bad screenshot but the feature works), retake the screenshot and still mark `"NEEDS REVIEW"`.
  - Then skip to Phase 3 (Read Required Files) and continue the normal flow from there.

- [ ] **1.3** If NO rejected entries, continue to Phase 2.

  **Output:**
  ```
  ✓ 1 Rejection Check
  - REJECTED entries found: [count]
  - Working on: [task ID and rejection reason, or "none — proceeding to Phase 2"]
  ```

---

## Phase 2: Load Context + Select Next Task

**Skip this phase entirely if Phase 1 found a REJECTED entry.**

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next.

- [ ] **2.1** Read PRD: `docs/PRD-{FeatureName}/PRD-{FeatureName}-{date}.md`

  **Output before continuing:**
  ```
  ✓ 2.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Acceptance criteria count: [fill in]
  ```

- [ ] **2.2** Read Implementation Plan: `docs/PRD-{FeatureName}/implementation-plan.md`

  **Output before continuing:**
  ```
  ✓ 2.2 Implementation Plan Read
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

- [ ] **2.3** From the Implementation Plan, identify the FIRST task that is:
  - Status = "IN PROGRESS", OR
  - Status = "NOT STARTED" (if none are IN PROGRESS)
  - **Skip tasks already marked COMPLETE**

- [ ] **2.4** Output your selection:
  ```
  ✓ 2.4 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Files to modify: [fill in]
  ```

---

## Phase 3: Read Required Files

- [ ] **3.1** For each file you plan to modify, read it fully before making any changes
- [ ] **3.2** For new files, read a similar existing file for patterns

  **Output:**
  ```
  ✓ 3 Files Read
  - Files read: [list]
  - Key patterns to follow: [brief notes]
  ```

---

## Phase 4: Implement

- [ ] **4.1** Implement the selected task exactly as described in the implementation plan
- [ ] **4.2** Update the task status in the implementation plan: NOT STARTED → IN PROGRESS

  **Output:**
  ```
  ✓ 4 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 5: Commit

- [ ] **5.1** Update the task status in the implementation plan: IN PROGRESS → COMPLETE
- [ ] **5.2** Stage and commit — use specific file paths, not `git add -A`:
  ```bash
  # Stage only the files you modified (from Phase 4) + the implementation plan + verification log
  git add docs/PRD-{FeatureName}/implementation-plan.md
  git add docs/PRD-{FeatureName}/verification-log.html
  git add [each file modified in Phase 4]
  git commit -m "PRD-{FeatureName}: [brief task description]"
  git push origin main
  ```

  **Output:**
  ```
  ✓ 5 Committed
  - Commit message: [fill in]
  ```

---

## Phase 6: Deploy — MANDATORY (do NOT skip)

**Every task MUST deploy before being marked COMPLETE. No exceptions.**

- [ ] **6.1** Frontend changed? (show-controller files)
  ```bash
  cd show-controller && npm run build
  # then upload dist per CLAUDE.md Step 1
  ```

- [ ] **6.2** Graphics files changed? (output.html, overlays/)
  ```bash
  # upload per CLAUDE.md Step 2
  # chmod 644 overlays/* after extract
  ```

- [ ] **6.3** Server changed? (server/ files)
  ```bash
  # git pull on coordinator + pm2 restart per CLAUDE.md
  ```

- [ ] **6.4** Firebase only? → Mark deploy skipped.

  **Output:**
  ```
  ✓ 6 Deploy Complete
  - Frontend deployed: [YES / NO / SKIPPED]
  - Server deployed: [YES / NO / SKIPPED]
  - Graphics deployed: [YES / NO / SKIPPED]
  ```

---

## Phase 7: Verify

**Credentials:** Read test account email/password from `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`

### Step 7A: Capture Evidence

- [ ] **7.1** Run `browser_install`
- [ ] **7.2** Navigate to the relevant page (log in if needed)
- [ ] **7.3** Take screenshot → `docs/PRD-{FeatureName}/screenshots/verify-task-{id}.png`
- [ ] **7.4** Check console: `browser_console_messages`

### Step 7B: Compare Screenshot Against Expected Outcome

- [ ] **7.5** Before writing PASS or FAIL, you MUST read the screenshot back using the Read tool and compare what you see against the `expectedInScreenshot` criteria you are about to write. Ask yourself:
  - Does the screenshot show the UI elements described?
  - Is the data populated (not empty/zero when it should have content)?
  - Are there error messages visible that shouldn't be there?
  - Does the layout match what was implemented?

  **Be honest. If the screenshot doesn't match expectations, it's a FAIL — even if the code change itself was correct.** Common false passes to watch for: permission errors, empty states that should have data, login redirects, blank pages.

### Step 7C: If PASS — Write Verification Log

If Step 7B determined PASS (first attempt succeeded):

- [ ] **7.6** Write verification log entry to `docs/PRD-{FeatureName}/verification-log.html`.

  **Entry for a clean PASS (no fix needed):**
  ```json
  {
    "taskId": "[task ID]",
    "taskName": "[task name]",
    "description": "[1-2 sentences: what this task built or changed, for a human reviewer who hasn't read the plan]",
    "expectedInScreenshot": "[Specific UI elements, text, and layout the reviewer should look for]",
    "timestamp": "[ISO timestamp]",
    "result": "PASS",
    "screenshot": "screenshots/verify-task-{id}.png",
    "commitHash": "[short hash from Phase 5]",
    "filesModified": ["[list of files from Phase 4]"],
    "consoleErrors": "[none or description]",
    "notes": "[any relevant context]"
  }
  ```

  No `attempts` array needed for a clean first-try PASS.

  **How to update the HTML:** Read `docs/PRD-{FeatureName}/verification-log.html`, extract the JSON array from between `<!-- VERIFICATION_DATA_START -->` and `<!-- VERIFICATION_DATA_END -->`, parse it, append the new entry, then replace that block with the updated array:
  ```html
  <!-- VERIFICATION_DATA_START -->
  <script id="verification-data" type="application/json">
  [... full updated JSON array ...]
  </script>
  <!-- VERIFICATION_DATA_END -->
  ```

  **Output:**
  ```
  ✓ 7 Verification: PASS
  - Screenshot: [filename]
  - Console errors: [none / list]
  ```

### Step 7D: If FAIL — One Fix Attempt

If Step 7B determined FAIL:

- [ ] **7.7** Diagnose: What does the screenshot show vs. what was expected? Check console errors for clues.
- [ ] **7.8** Implement a fix in the same context window.
- [ ] **7.9** Redeploy (build + upload as needed).
- [ ] **7.10** Take a NEW screenshot → `docs/PRD-{FeatureName}/screenshots/verify-task-{id}-fix.png`
- [ ] **7.11** Read the new screenshot and compare again against `expectedInScreenshot`.

### Step 7E: Write Verification Log After Fix Attempt

Whether the fix worked or not, write the entry with the full `attempts` array:

- [ ] **7.12** Write the verification log entry with the `attempts` array documenting both screenshots:

  **Entry when fix attempt PASSED:**
  ```json
  {
    "taskId": "[task ID]",
    "taskName": "[task name]",
    "description": "[what was built]",
    "expectedInScreenshot": "[what to look for]",
    "timestamp": "[ISO timestamp]",
    "result": "PASS",
    "screenshot": "screenshots/verify-task-{id}-fix.png",
    "commitHash": "[short hash]",
    "filesModified": ["[files]"],
    "consoleErrors": "[none or description]",
    "notes": "[context]",
    "attempts": [
      {
        "screenshot": "screenshots/verify-task-{id}.png",
        "result": "FAIL",
        "diagnosis": "[What the screenshot showed vs. expected — be specific]",
        "fix": "[What code/config change was made to fix it]"
      },
      {
        "screenshot": "screenshots/verify-task-{id}-fix.png",
        "result": "PASS",
        "diagnosis": null,
        "fix": null
      }
    ]
  }
  ```

  **Entry when fix attempt also FAILED:**
  ```json
  {
    "taskId": "[task ID]",
    "taskName": "[task name]",
    "description": "[what was built]",
    "expectedInScreenshot": "[what to look for]",
    "timestamp": "[ISO timestamp]",
    "result": "FAIL",
    "screenshot": "screenshots/verify-task-{id}-fix.png",
    "commitHash": "[short hash]",
    "filesModified": ["[files]"],
    "consoleErrors": "[description]",
    "notes": "[context]",
    "bugTask": "{id}-BUG",
    "attempts": [
      {
        "screenshot": "screenshots/verify-task-{id}.png",
        "result": "FAIL",
        "diagnosis": "[What the screenshot showed vs. expected]",
        "fix": "[What was tried]"
      },
      {
        "screenshot": "screenshots/verify-task-{id}-fix.png",
        "result": "FAIL",
        "diagnosis": "[What the screenshot still shows wrong after the fix]",
        "fix": null
      }
    ]
  }
  ```

- [ ] **7.13** Update `verification-log.html` (same process as Step 7C).

### Step 7F: If Fix Also Failed — Create Bug Task

- [ ] **7.14** Add a **new bug task** to the implementation plan — insert it as the NEXT task to be picked up:
  ```markdown
  ### Task {id}-BUG: Fix verification failure from Task {id} — NOT STARTED

  **Problem:** [What the screenshot showed vs. what was expected]
  **Attempted fix:** [What was tried in the previous iteration]
  **Screenshots:** verify-task-{id}.png (original), verify-task-{id}-fix.png (after fix attempt)
  **Console errors:** [relevant errors]

  **To investigate:** [Suggested next steps for diagnosis]
  ```
- [ ] **7.15** Mark the original task as COMPLETE in the implementation plan (the code change itself was made — the bug task handles the verification failure separately).
- [ ] **7.16** Commit all changes (implementation plan + verification log + screenshots) and push.

  **Output:**
  ```
  ✓ 7 Verification: FAIL — bug task created
  - Original screenshot: [filename]
  - Fix attempt screenshot: [filename]
  - Bug task: Task {id}-BUG added to implementation plan
  - Issue: [brief description]
  ```

**STOP after Step 7F. Do not continue to Phase 8. The next loop iteration will pick up the bug task.**

---

## Phase 8: Update Status

- [ ] **8.1** If ALL tasks in the implementation plan are COMPLETE:
  - Update PRD status to COMPLETE in `PRD-{FeatureName}-{date}.md`
  - Commit: `git add docs/PRD-{FeatureName}/ && git commit -m "PRD-{FeatureName}: Mark complete" && git push origin main`

- [ ] **8.2** If tasks remain: leave PRD status as IN PROGRESS (the loop will continue)

  **Output:**
  ```
  ✓ 8 Status Update
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

---

## Verification Log Setup

Each PRD needs one file created at the start:

**`docs/PRD-{FeatureName}/verification-log.html`** — Copy from an existing PRD's `verification-log.html`, clear the data block to `[]`, and update the `<h1>` title to match this PRD.

The HTML is the single source of truth — both the system and the human reviewer read/write to it. Data is inlined between `<!-- VERIFICATION_DATA_START -->` and `<!-- VERIFICATION_DATA_END -->` markers. No separate JSON file needed. Open directly in a browser via `file://` path.
