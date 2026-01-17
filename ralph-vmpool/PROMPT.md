@plan.md @activity.md @AGENT.md @PRD.md

# VM Pool Fix - Agent Instructions

You are fixing the VM Pool Management system using a **two-phase approach**:

**PHASE 1 - RESEARCH:** Spawn up to 30 parallel subagents for read-only operations
**PHASE 2 - EXECUTE:** Use exactly 1 subagent for build/test/deploy (sequential)

---

## Parallelization Rules (CRITICAL)

### ✅ CAN Parallelize (Research Phase - up to 30 subagents)
| Operation | Why Safe |
|-----------|----------|
| File reads (Read, Glob, Grep) | Read-only, no conflicts |
| Diagnostic screenshots | Read-only browser state |
| API status checks (curl GET) | Read-only |
| Firebase reads (firebase_get, firebase_list_paths) | Read-only |
| AWS list operations (aws_list_instances) | Read-only |
| Codebase exploration | Read-only |

### ❌ MUST Serialize (Execute Phase - 1 subagent only)
| Operation | Why Serial |
|-----------|------------|
| npm run build | File locks, shared dist/ |
| npm test | Port conflicts, shared state |
| tar/package | File locks |
| ssh_upload_file | Network resource |
| ssh_exec (mutations) | Server state |
| PM2 restart | Process conflicts |
| Deploy verification | Depends on deploy completion |
| File writes (Edit, Write) | Potential conflicts |

**Why:** Multiple subagents running build/test/deploy cause file lock conflicts, race conditions, and flaky results.

---

## Workflow

### Step 1: Read State
1. Read `activity.md` - understand what's been done
2. Read `plan.md` - find tasks in current phase
3. Read `AGENT.md` - know deployment patterns
4. Read `PRD.md` - understand success criteria

### Step 2: Identify Phase

Look at `plan.md` for the current phase:

```json
{
  "currentPhase": "research",  // or "execute"
  "researchTasks": [...],      // CAN run in parallel
  "executeTasks": [...]        // MUST run sequentially
}
```

### Step 3: Execute Based on Phase

#### If RESEARCH Phase:
**Spawn parallel subagents** using the Task tool:

```
Use Task tool to spawn up to 30 subagents simultaneously:
- subagent_type: "Explore" for codebase research
- subagent_type: "general-purpose" for diagnostics

Example: Fan out 5 diagnostic tasks in ONE message with 5 Task tool calls
```

**Research subagents can:**
- Read files (Read, Glob, Grep)
- Take screenshots (browser_navigate, browser_take_screenshot)
- Check API responses (curl GET only)
- Read Firebase data
- List AWS resources

**Research subagents CANNOT:**
- Write or edit files
- Run npm build/test
- Deploy anything
- Modify server state

#### If EXECUTE Phase:
**Run ONE task at a time, sequentially:**

1. Execute the action (build, deploy, etc.)
2. Verify with screenshot
3. Update status
4. Move to next task only after completion

### Step 4: Verify with Screenshot (REQUIRED)

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

### Step 5: Update Status

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

### Step 6: Log to activity.md

Append entry:
```markdown
### TASK-ID: Description - [PASS/FAIL]
**Action:** What was done
**Screenshot:** screenshots/TASK-ID.png
**Console:** [errors or "no errors"]
**Result:** What the verification showed
**Next:** [If failed, reference the new fix task created]
```

### Step 7: Transition Phases or Exit

**If research phase complete:** Update plan.md to set `"currentPhase": "execute"`

**If execute phase complete:** Commit and exit:
```bash
git add -A
git commit -m "TASK-ID: Brief description"
```

**STOP after completing one execute task. Do not continue.**

---

## Critical Rules

1. **RESEARCH = PARALLEL** - Spawn up to 30 subagents for read-only tasks
2. **EXECUTE = SERIAL** - Only 1 subagent for build/test/deploy
3. **ALWAYS SCREENSHOT** - No task is complete without a screenshot
4. **TRUST THE SCREENSHOT** - If it shows an error, the task failed
5. **FAILED = NEW TASK** - Don't retry same approach, create new task with different approach
6. **BE SPECIFIC** - Failure reasons must describe exactly what the screenshot showed

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
