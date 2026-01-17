# VM Pool Fix - Task Plan

## Instructions

1. Find the first task with `"status": "pending"`
2. Execute the task
3. Verify with Playwright screenshot
4. If PASS: Set `"status": "completed"`
5. If FAIL: Set `"status": "failed"`, create NEW task to fix the specific issue found
6. Log result in activity.md
7. Exit (one task per iteration)

---

## Tasks

```json
[
  {
    "id": "DIAG-01",
    "description": "Diagnose: Take screenshot of VM Pool page and check console errors",
    "action": "Navigate to https://commentarygraphic.com/vm-pool, take screenshot, get console messages",
    "verification": "Screenshot saved, console messages captured",
    "expected": "Document current state - this is diagnostic, always passes",
    "status": "completed",
    "result": "Page shows 'Competition Not Found' - /vm-pool is being interpreted as a competition ID, not a dedicated admin page. No JS errors in console. The frontend routing needs a dedicated /vm-pool route."
  },
  {
    "id": "DIAG-01B",
    "description": "Diagnose: Find where VM Pool admin page exists in the codebase",
    "action": "Search show-controller for VMPool, vm-pool, admin routes to understand current routing structure",
    "verification": "Identify what route/component handles VM Pool management",
    "expected": "Find the correct URL or determine if page needs to be created/routed",
    "status": "pending"
  },
  {
    "id": "DIAG-02",
    "description": "Diagnose: Check if production nginx has /api/* proxy rule",
    "action": "ssh_exec on 3.87.107.201: grep 'location /api' /etc/nginx/sites-enabled/commentarygraphic.com",
    "verification": "Command output shows proxy rule OR shows it's missing",
    "expected": "Document whether rule exists - this is diagnostic",
    "status": "pending"
  },
  {
    "id": "DIAG-03",
    "description": "Diagnose: Test if coordinator API responds directly",
    "action": "ssh_exec on coordinator: curl -s http://localhost:3003/api/admin/vm-pool",
    "verification": "Command returns JSON response",
    "expected": "Document API response - confirms coordinator is working",
    "status": "pending"
  },
  {
    "id": "FIX-01",
    "description": "Fix: Add /api/* proxy rule to production nginx",
    "action": "Add location /api/ block to /etc/nginx/sites-enabled/commentarygraphic.com on 3.87.107.201",
    "verification": "nginx -t passes, systemctl reload nginx succeeds",
    "expected": "nginx config updated and reloaded",
    "status": "pending"
  },
  {
    "id": "VERIFY-01",
    "description": "Verify: VM Pool page loads without Connection Error",
    "action": "Navigate to https://commentarygraphic.com/vm-pool, take screenshot, check console",
    "verification": "Screenshot shows no 'Connection Error', console has no fetch failures",
    "expected": "Page loads, Pool Status visible, no errors",
    "status": "pending"
  },
  {
    "id": "VERIFY-02",
    "description": "Verify: Pool Status shows correct data (VMs or empty message)",
    "action": "On VM Pool page, verify Pool Status section displays correctly",
    "verification": "Screenshot shows Pool Status with VM count or 'No VMs in Pool'",
    "expected": "Pool Status renders with real data from API",
    "status": "pending"
  },
  {
    "id": "WORKFLOW-01",
    "description": "Test Workflow 1: Launch New VM",
    "action": "Click 'Launch New VM' button, observe UI update, verify in AWS",
    "verification": "Screenshot shows VM in Starting state, aws_list_instances shows new instance",
    "expected": "New VM appears in UI and AWS",
    "status": "pending"
  },
  {
    "id": "WORKFLOW-02",
    "description": "Test Workflow 1: VM becomes Available",
    "action": "Wait for launched VM to reach Available status",
    "verification": "Screenshot shows VM as Available, aws_list_instances shows running",
    "expected": "VM transitions from Starting to Available",
    "status": "pending"
  },
  {
    "id": "WORKFLOW-03",
    "description": "Test Workflow 3: Stop a VM",
    "action": "Click Stop on a running VM, observe status change",
    "verification": "Screenshot shows VM as Stopping then Stopped, AWS confirms",
    "expected": "VM stops successfully",
    "status": "pending"
  },
  {
    "id": "WORKFLOW-04",
    "description": "Test Workflow 3: Start a stopped VM",
    "action": "Click Start on stopped VM, observe status change",
    "verification": "Screenshot shows VM as Starting then Available, AWS confirms",
    "expected": "VM starts successfully",
    "status": "pending"
  },
  {
    "id": "WORKFLOW-05",
    "description": "Test Workflow 2: Navigate to homepage and view competitions",
    "action": "Navigate to https://commentarygraphic.com, take screenshot of competition selector",
    "verification": "Screenshot shows competition list or create button",
    "expected": "Homepage loads with competition UI",
    "status": "pending"
  },
  {
    "id": "WORKFLOW-06",
    "description": "Test Workflow 2: Assign VM to competition",
    "action": "Select/create competition, assign available VM",
    "verification": "Screenshot shows VM assigned, firebase_get shows vmAddress in competition config",
    "expected": "VM assigned to competition successfully",
    "status": "pending"
  }
]
```

---

## Failure Protocol

When a task FAILS:
1. Set its status to `"failed"`
2. Add `"failureReason": "description of what screenshot/console showed"`
3. Create a NEW task with:
   - ID: `FIX-XX` (next number)
   - Description referencing the failed task
   - Action addressing the specific issue found
4. Log failure details in activity.md

Example:
```json
{
  "id": "VERIFY-01",
  "status": "failed",
  "failureReason": "Screenshot shows CORS error in console: 'Access-Control-Allow-Origin' missing"
}
```
Then add:
```json
{
  "id": "FIX-02",
  "description": "Fix: Add CORS headers to nginx /api/ proxy (VERIFY-01 failed due to CORS)",
  "action": "Add Access-Control-Allow-Origin header to /api/ location block",
  "status": "pending"
}
```
