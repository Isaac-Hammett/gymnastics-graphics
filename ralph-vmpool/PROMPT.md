@plan.md @activity.md @AGENT.md @PRD.md

# VM Pool Fix - Agent Instructions

You are fixing the VM Pool Management system. Your job is to:
1. Execute ONE task from plan.md
2. Verify with Playwright screenshot
3. Update status based on verification result
4. Log to activity.md
5. Exit

---

## Workflow

### Step 1: Read State
1. Read `activity.md` - understand what's been done
2. Read `plan.md` - find FIRST task with `"status": "pending"`
3. Read `AGENT.md` - know deployment patterns
4. Read `PRD.md` - understand success criteria

### Step 2: Execute Task
Run the action specified in the task. Use MCP tools directly.

### Step 3: Verify with Screenshot (REQUIRED)

**Every task must end with Playwright verification:**

```
1. browser_navigate(url='https://commentarygraphic.com/RELEVANT_PAGE')
2. browser_take_screenshot(filename='screenshots/TASK-ID.png')
3. browser_console_messages(level='error')
```

**Analyze the screenshot and console:**
- Does it show what we expected?
- Are there any error messages visible?
- Are there console errors?

### Step 4: Update Status

**If verification PASSED:**
```json
{
  "id": "TASK-ID",
  "status": "completed",
  "result": "Brief description of what screenshot showed"
}
```

**If verification FAILED:**
```json
{
  "id": "TASK-ID",
  "status": "failed",
  "failureReason": "What the screenshot/console actually showed"
}
```

Then CREATE A NEW TASK to fix the specific issue:
```json
{
  "id": "FIX-XX",
  "description": "Fix: [specific issue] (TASK-ID failed because [reason])",
  "action": "[different approach to solve the problem]",
  "verification": "[how to verify this fix]",
  "expected": "[what success looks like]",
  "status": "pending"
}
```

### Step 5: Log to activity.md

Append entry:
```markdown
### TASK-ID: Description - [PASS/FAIL]
**Action:** What was done
**Screenshot:** screenshots/TASK-ID.png
**Console:** [errors or "no errors"]
**Result:** What the verification showed
**Next:** [If failed, reference the new fix task created]
```

### Step 6: Commit and Exit

```bash
git add -A
git commit -m "TASK-ID: Brief description"
```

**STOP. Do not continue to the next task.**

---

## Critical Rules

1. **ONE TASK PER ITERATION** - Complete one task, then exit
2. **ALWAYS SCREENSHOT** - No task is complete without a screenshot
3. **TRUST THE SCREENSHOT** - If it shows an error, the task failed
4. **FAILED = NEW TASK** - Don't retry same approach, create new task with different approach
5. **BE SPECIFIC** - Failure reasons must describe exactly what the screenshot showed

---

## MCP Tools Available

### Playwright (Verification)
- `browser_navigate(url)` - Load page
- `browser_take_screenshot(filename)` - Capture state (REQUIRED)
- `browser_console_messages(level)` - Get JS errors (REQUIRED)
- `browser_snapshot()` - Get element refs for clicking
- `browser_click(element, ref)` - Click button/link
- `browser_network_requests()` - See failed API calls

### SSH (Server Changes)
- `ssh_exec(target, command, sudo)` - Run command
- `ssh_upload_file(target, localPath, remotePath)` - Upload
- `ssh_download_file(target, remotePath, localPath)` - Download

### AWS (VM Operations)
- `aws_list_instances(stateFilter)` - List VMs
- `aws_start_instance(instanceId)` - Start VM
- `aws_stop_instance(instanceId)` - Stop VM

### Firebase (Data)
- `firebase_get(path)` - Read data
- `firebase_set(path, data)` - Write data
- `firebase_list_paths(path)` - List children

---

## Completion

When ALL tasks in plan.md have `"status": "completed"`, output:

```
<promise>COMPLETE</promise>
```

This signals the loop to exit successfully.
