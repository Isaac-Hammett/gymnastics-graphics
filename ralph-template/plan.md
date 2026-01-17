# {{PROJECT_NAME}} - Task Plan

## Phase Control

```json
{
  "currentPhase": "research",
  "note": "Starting with research phase to understand current state"
}
```

---

## Instructions

### Research Phase (currentPhase = "research")
1. Find ALL tasks in `researchTasks` with `"status": "pending"`
2. Spawn up to 30 parallel subagents to execute them simultaneously
3. Wait for all to complete
4. Update statuses based on results
5. When all research tasks complete, set `"currentPhase": "execute"`

### Execute Phase (currentPhase = "execute")
1. Find FIRST task in `executeTasks` with `"status": "pending"`
2. Execute it (ONE at a time, sequentially)
3. Verify with Playwright screenshot
4. Update status
5. Log to activity.md
6. Commit and exit (one execute task per iteration)

---

## Research Tasks (CAN parallelize - up to 30 subagents)

These are read-only diagnostic and exploration tasks.

```json
[
  {
    "id": "DIAG-01",
    "description": "Diagnose: Take screenshot of current state",
    "action": "Navigate to target page, take screenshot, get console messages",
    "status": "pending"
  },
  {
    "id": "DIAG-02",
    "description": "Diagnose: Search codebase for relevant components",
    "action": "Use Glob/Grep to find files related to the feature",
    "status": "pending"
  },
  {
    "id": "DIAG-03",
    "description": "Diagnose: Check API endpoints",
    "action": "Test relevant API endpoints with curl",
    "status": "pending"
  }
]
```

---

## Execute Tasks (MUST serialize - 1 subagent, sequential)

These modify state and must run one at a time.

```json
[
  {
    "id": "FIX-01",
    "description": "Fix: {{FIRST_FIX_DESCRIPTION}}",
    "action": "{{ACTION_STEPS}}",
    "verification": "{{HOW_TO_VERIFY}}",
    "expected": "{{EXPECTED_RESULT}}",
    "status": "pending"
  },
  {
    "id": "VERIFY-01",
    "description": "Verify: Feature works end-to-end",
    "action": "Navigate to page, test workflow, take screenshot",
    "verification": "Screenshot shows expected behavior",
    "expected": "Feature works as specified in PRD",
    "status": "pending"
  }
]
```

---

## Failure Protocol

When a task FAILS:
1. Set its status to `"failed"`
2. Add `"failureReason": "description of what screenshot/console showed"`
3. Create a NEW task in the appropriate section (research or execute)
4. Log failure details in activity.md

Example:
```json
{
  "id": "FIX-01",
  "status": "failed",
  "failureReason": "Screenshot shows error message: 'API returned 500'"
}
```
Then add new execute task:
```json
{
  "id": "FIX-02",
  "description": "Fix: Handle API error (FIX-01 failed due to 500)",
  "action": "Debug API endpoint and fix server-side issue",
  "status": "pending"
}
```

---

## Completion

When ALL execute tasks have `"status": "completed"` or `"skipped"`, output:

```
<promise>COMPLETE</promise>
```
