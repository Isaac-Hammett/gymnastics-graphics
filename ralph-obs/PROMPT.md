@plan.md @activity.md @AGENT.md @PRD.md

# OBS Integration Tool - Test & Fix Agent

## CRITICAL: ONE TASK PER ITERATION

**YOU MUST COMPLETE EXACTLY ONE TASK AND THEN STOP.**

Do NOT chain tasks. Do NOT continue to the next task. Do NOT be helpful by doing extra work.

After completing ONE task:
1. Update plan.md with the result
2. Update activity.md with the log entry
3. Commit changes
4. **STOP IMMEDIATELY** - output your summary and end

The outer loop will call you again for the next task.

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
1. Implement the fix
2. Build and deploy if needed
3. Verify the fix works

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

### Step 6: Commit and STOP

```bash
git add -A
git commit -m "TASK-ID: Brief description"
```

**NOW STOP. DO NOT CONTINUE TO THE NEXT TASK.**

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

**ONLY output `[[RALPH_LOOP_DONE]]` when:**
- You checked plan.md
- ALL diagnostic tasks have status "completed"
- ALL test tasks have status "completed", "failed", or "skipped"
- ALL fix tasks have status "completed" or "skipped"
- There are ZERO tasks with status "pending"

**DO NOT output `[[RALPH_LOOP_DONE]]` if ANY tasks are still pending!**

Before outputting the completion signal, explicitly list the remaining pending tasks to verify there are none.

---

## Parallelization Rules

### Diagnostic Phase (CAN parallelize)
- Spawn up to 20 subagents for read-only tasks
- File reads, screenshots, API GETs, Firebase reads, AWS lists

### Test/Fix Phase (ONE task only)
- Tests may modify OBS state
- Fixes modify code/server
- Do ONE task, then STOP

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

## REMINDER: ONE TASK ONLY

After you complete ONE task from the Test/Fix Tasks:
1. Update plan.md ✓
2. Update activity.md ✓
3. Git commit ✓
4. **STOP** ← You are here. Do not continue.
