@plan.md @activity.md @AGENT.md @PRD.md

# VM Pool Fix - Agent Instructions

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

- If in Research Tasks section → you may spawn parallel subagents for ALL pending research tasks
- If in Execute Tasks section → do ONLY the first pending task, then STOP

### Step 2: Execute that ONE task

Do the work specified in the task's `action` field.

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

If failed, also add a NEW task to fix the issue.

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

## Completion Signal

**ONLY output `[[RALPH_LOOP_DONE]]` when:**
- You checked plan.md
- EVERY task in Execute Tasks has status "completed" or "skipped"
- There are ZERO tasks with status "pending"

**DO NOT output `[[RALPH_LOOP_DONE]]` if ANY tasks are still pending!**

Before outputting the completion signal, explicitly list the remaining pending tasks to verify there are none.

---

## Parallelization Rules

### Research Phase (CAN parallelize)
- Spawn up to 30 subagents for read-only tasks
- File reads, screenshots, API GETs, Firebase reads, AWS lists

### Execute Phase (ONE task only)
- npm build, deploys, file writes, server mutations
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
- `ssh_exec(target, command)` - Run command
- `ssh_upload_file` / `ssh_download_file`

### AWS
- `aws_list_instances`, `aws_start_instance`, `aws_stop_instance`

### Firebase
- `firebase_get`, `firebase_set`, `firebase_list_paths`

---

## REMINDER: ONE TASK ONLY

After you complete ONE task from the Execute Tasks:
1. Update plan.md ✓
2. Update activity.md ✓
3. Git commit ✓
4. **STOP** ← You are here. Do not continue.
