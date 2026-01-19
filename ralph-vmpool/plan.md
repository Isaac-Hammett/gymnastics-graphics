# VM Pool Fix - Task Plan

## Phase Control

```json
{
  "currentPhase": "execute",
  "note": "Research complete. FIX-00 resolved API connectivity. Now testing workflows."
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
    "description": "Diagnose: Take screenshot of VM Pool page and check console errors",
    "action": "Navigate to https://commentarygraphic.com/vm-pool, take screenshot, get console messages",
    "status": "completed",
    "result": "Page shows 'Competition Not Found' - /vm-pool is being interpreted as a competition ID, not a dedicated admin page."
  },
  {
    "id": "DIAG-01B",
    "description": "Diagnose: Find where VM Pool admin page exists in the codebase",
    "action": "Search show-controller for VMPool, vm-pool, admin routes",
    "status": "completed",
    "result": "VM Pool page exists at /_admin/vm-pool. Root cause: VITE_API_URL not set in .env."
  },
  {
    "id": "DIAG-02",
    "description": "Diagnose: Check if production nginx has /api/* proxy rule",
    "action": "ssh_exec on 3.87.107.201: grep 'location /api' /etc/nginx/sites-enabled/commentarygraphic.com",
    "status": "skipped",
    "result": "Not needed - FIX-00 resolved the issue"
  },
  {
    "id": "DIAG-03",
    "description": "Diagnose: Test if coordinator API responds directly",
    "action": "ssh_exec on coordinator: curl -s http://localhost:3003/api/admin/vm-pool",
    "status": "skipped",
    "result": "Not needed - FIX-00 verified API responds with 200 status"
  }
]
```

---

## Execute Tasks (MUST serialize - 1 subagent, sequential)

These modify state and must run one at a time.

```json
[
  {
    "id": "FIX-00",
    "description": "Fix: Add VITE_API_URL to .env and rebuild/redeploy frontend",
    "action": "1. Add VITE_API_URL to .env, 2. npm run build, 3. Deploy to production",
    "status": "completed",
    "result": "VITE_API_URL added, rebuilt, deployed. Page loads without Connection Error."
  },
  {
    "id": "FIX-01",
    "description": "Fix: Add /api/* proxy rule to production nginx",
    "action": "Add location /api/ block to nginx config",
    "status": "skipped",
    "result": "Not needed - frontend now calls api.commentarygraphic.com directly"
  },
  {
    "id": "VERIFY-01",
    "description": "Verify: VM Pool page loads without Connection Error",
    "action": "Navigate to /_admin/vm-pool, take screenshot, check console",
    "status": "completed",
    "result": "Verified in FIX-00 - page loads, no errors"
  },
  {
    "id": "VERIFY-02",
    "description": "Verify: Pool Status shows correct data",
    "action": "On VM Pool page, verify Pool Status section displays correctly",
    "status": "completed",
    "result": "Verified in FIX-00 - Pool Status shows '0 total VMs'"
  },
  {
    "id": "WORKFLOW-01",
    "description": "Test Workflow 1: Launch New VM",
    "action": "Click 'Launch New VM' button, observe UI update, verify in AWS",
    "verification": "Screenshot shows VM in Starting state, aws_list_instances shows new instance",
    "expected": "New VM appears in UI and AWS",
    "status": "completed",
    "result": "VM launched successfully. Dialog showed Instance ID: i-0a20c68a1d940b11a. AWS confirms instance running with IP 44.203.192.255."
  },
  {
    "id": "WORKFLOW-02",
    "description": "Test Workflow 1: VM becomes Available",
    "action": "Wait for launched VM to reach Available status",
    "verification": "Screenshot shows VM as Available, aws_list_instances shows running",
    "expected": "VM transitions from Starting to Available",
    "status": "completed",
    "result": "VM pool manager was not initialized due to missing GOOGLE_APPLICATION_CREDENTIALS. Added env var, restarted coordinator. VM now shows as Available with IP 44.203.192.255."
  },
  {
    "id": "WORKFLOW-03",
    "description": "Test Workflow 3: Stop a VM",
    "action": "Click Stop on a running VM, observe status change",
    "verification": "Screenshot shows VM as Stopping then Stopped, AWS confirms",
    "expected": "VM stops successfully",
    "status": "completed",
    "result": "Clicked Stop on available VM. UI showed 'stopping' state, AWS confirmed 'stopped' after ~40 seconds. Pool now shows 2 Stopped, 0 Available."
  },
  {
    "id": "WORKFLOW-04",
    "description": "Test Workflow 3: Start a stopped VM",
    "action": "Click Start on stopped VM, observe status change",
    "verification": "Screenshot shows VM as Starting then Available, AWS confirms",
    "expected": "VM starts successfully",
    "status": "completed",
    "result": "Clicked Start on stopped VM. UI showed 'starting' state, AWS confirmed 'running' after ~30 seconds. VM became Available with new IP 3.89.92.162."
  },
  {
    "id": "WORKFLOW-05",
    "description": "Test Workflow 2: Navigate to homepage and view competitions",
    "action": "Navigate to https://commentarygraphic.com, take screenshot",
    "verification": "Screenshot shows competition list or create button",
    "expected": "Homepage loads with competition UI",
    "status": "completed",
    "result": "Homepage loads with Online status, + Create Competition button, search box, Past Competitions (8), and no console errors."
  },
  {
    "id": "WORKFLOW-06",
    "description": "Test Workflow 2: Assign VM to competition",
    "action": "Select/create competition, assign available VM",
    "verification": "Screenshot shows VM assigned, firebase_get shows vmAddress",
    "expected": "VM assigned to competition successfully",
    "status": "completed",
    "result": "VM assigned via API to competition 3602v1c8 (Simpson vs UW-Whitewater). Firebase confirms vmAddress=3.89.92.162:3003 and VM status=assigned. UI shows 1 Assigned, 50% utilization. Also fixed useVMPool hook to read from vmPool/vms/ instead of vmPool/."
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
  "id": "WORKFLOW-01",
  "status": "failed",
  "failureReason": "Button click returned 500 error - coordinator returned 'AMI not found'"
}
```
Then add new execute task:
```json
{
  "id": "FIX-02",
  "description": "Fix: Update coordinator to use correct AMI ID (WORKFLOW-01 failed)",
  "action": "Update AMI configuration in coordinator",
  "status": "pending"
}
```

---

## Completion

When ALL execute tasks have `"status": "completed"` or `"skipped"`, output:

```
<promise>COMPLETE</promise>
```
