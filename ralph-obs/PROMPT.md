@plan.md @activity.md @AGENT.md @PRD.md

# OBS Integration Tool - Test & Fix Agent

## CRITICAL: UNDERSTAND THE LOOP

You are running inside a bash loop. Each iteration:
1. Opens a FRESH context window (you have no memory of previous iterations)
2. You read state from files (plan.md, activity.md, AGENT.md)
3. You do ONE unit of work
4. You update the state files
5. You commit and EXIT
6. The bash loop starts the next iteration with a NEW fresh context

**YOUR JOB THIS ITERATION: Do ONE thing, update files, commit, EXIT.**

The bash loop handles continuity. You handle ONE task per invocation.

## WHAT COUNTS AS "ONE THING"

- **Diagnostic phase:** Run all DIAG tasks in parallel (they're read-only), then EXIT
- **Test phase:** Run ONE test task, then EXIT
- **Fix phase:** Run ONE fix task, then EXIT

## AFTER YOUR ONE THING

1. Update plan.md with results
2. Update activity.md with log entry
3. Git commit
4. **OUTPUT YOUR SUMMARY AND STOP**

Do NOT look for more work. Do NOT continue to the next task. The bash loop will call you again.

---

## Execution Flow

### Step 1: Find the ONE task to execute

Read `plan.md` and find the **FIRST** task with `"status": "pending"`.

- If in Diagnostic Tasks section → you may spawn parallel subagents for ALL pending diagnostic tasks
- If in Test/Fix Tasks section → do ONLY the first pending task, then STOP

### Step 2: Execute that ONE task

Do the work specified in the task's `action` field.

For TEST tasks:
1. Navigate to the appropriate page
2. Take screenshot
3. Check console for errors
4. Verify the expected behavior

For FIX tasks:
1. Research (use subagents to understand the problem)
2. Implement the fix
3. Build and deploy
4. Verify with screenshot
5. Update plan.md and commit

### Step 3: Verify with screenshot

```
browser_navigate(url='https://commentarygraphic.com/RELEVANT_PAGE')
browser_take_screenshot(filename='screenshots/TASK-ID.png')
browser_console_messages(level='error')
```

### Step 4: Update status in plan.md

If PASSED:
```json
"status": "completed",
"result": "Brief description"
```

If FAILED:
```json
"status": "failed",
"failureReason": "What went wrong"
```

If failed, also add a NEW task to fix the issue (FIX-XX).

### Step 5: Log to activity.md

Append:
```markdown
### TASK-ID: Description - [PASS/FAIL]
**Action:** What was done
**Screenshot:** screenshots/TASK-ID.png
**Result:** What happened
```

### Step 6: Commit and EXIT

```bash
git add -A
git commit -m "TASK-ID: Brief description"
```

**NOW OUTPUT YOUR SUMMARY AND END YOUR RESPONSE.**

Example final output:
```
## Iteration Complete

**Task:** TEST-01 - OBS Manager page loads
**Result:** FAILED - Page crashes with import error for missing OBSContext
**Next:** FIX-01 created to build OBSContext

---
Committed: abc123 - TEST-01: OBS Manager page load test (failed)
```

Then STOP. Do not continue. The bash loop will start iteration N+1.

---

## Test Competition

Use the competition ID stored in `plan.md` under `testCompetition.compId`.

If no test competition exists:
1. First task should be PREREQ-01 to find/create one
2. Store the compId in plan.md for subsequent tasks

---

## OBS Connection Requirements

OBS tests require:
1. A competition with an assigned VM
2. The VM must be running
3. OBS Studio must be running on the VM
4. OBS WebSocket must be enabled (port 4455)
5. Server must be connected to OBS WebSocket

If OBS is not connected:
- Check VM status with `aws_list_instances`
- Check if OBS is running: `ssh_exec(target=VM_IP, command='pgrep -x obs')`
- Check OBS WebSocket: `ssh_exec(target=VM_IP, command='netstat -tlnp | grep 4455')`

---

## Completion Signal

**ONLY output `<RALPH_COMPLETE>ALL_DONE</RALPH_COMPLETE>` when:**
- You checked plan.md
- ALL diagnostic tasks have status "completed"
- ALL test tasks have status "completed", "failed", or "skipped"
- ALL fix tasks have status "completed" or "skipped"
- There are ZERO tasks with status "pending"

**DO NOT output the completion signal if ANY tasks are still pending!**

Before outputting the completion signal, explicitly list the remaining pending tasks to verify there are none.

---

## Subagent Strategy

### RESEARCH: Fan out up to 50 parallel subagents
Use subagents liberally for ANY read-only operation:
- Search codebase (Glob, Grep, Read)
- Take screenshots
- Check Firebase state
- List AWS instances
- Read documentation
- Understand existing code

**WHY:** Subagents burn their own context and get garbage collected.
Main context only sees the summary. This keeps main context CLEAN.

```
Main Context ──┬──► Subagent: "Search for OBS components"
               ├──► Subagent: "Read the PRD"
               ├──► Subagent: "Check Firebase config"
               ├──► Subagent: "Take screenshot"
               └──► ... up to 50 parallel
```

### EXECUTION: Single subagent for build/deploy/test
Only ONE subagent for operations that modify state:
- npm run build
- Deploy to server
- Restart PM2
- Run tests

**WHY:** These have file locks, port conflicts, and race conditions.

```
Main Context ──► ONE Subagent: "Build, deploy, verify"
                    │
                    ├── npm run build
                    ├── tar + upload
                    ├── ssh deploy
                    └── verify
```

---

## MCP Tools

### Playwright
- `browser_navigate(url)` - Load page
- `browser_take_screenshot(filename)` - Capture (REQUIRED)
- `browser_console_messages(level)` - JS errors (REQUIRED)
- `browser_snapshot()` - Get element refs
- `browser_click(element, ref)` - Click

### SSH
- `ssh_exec(target, command)` - Run command on VM
- `ssh_upload_file` / `ssh_download_file`

### AWS
- `aws_list_instances`, `aws_start_instance`, `aws_stop_instance`

### Firebase
- `firebase_get`, `firebase_set`, `firebase_list_paths`

---

## REMINDER: ONE TASK = ONE ITERATION

```
┌─────────────────────────────────────────┐
│  ITERATION N                            │
│                                         │
│  1. Read state files     ✓              │
│  2. Pick ONE task        ✓              │
│  3. Research (subagents) ✓              │
│  4. Implement fix        ✓              │
│  5. Build & deploy       ✓              │
│  6. Test & screenshot    ✓              │
│  7. Update plan.md       ✓              │
│  8. Update activity.md   ✓              │
│  9. Git commit           ✓              │
│  10. Output summary      ✓              │
│  11. ██████ EXIT ██████  ← STOP HERE    │
│                                         │
│  DO NOT START ANOTHER TASK              │
│  Bash loop handles iteration N+1        │
└─────────────────────────────────────────┘
```

## HARD STOP RULE

After you make your FIRST code edit, you are committed to THIS task.
Complete the cycle: implement → build → test → update plan → commit → EXIT.

Do NOT discover "oh I also need to fix X" and keep editing.
If the fix doesn't work, mark it FAILED and EXIT. Next iteration will handle it.
