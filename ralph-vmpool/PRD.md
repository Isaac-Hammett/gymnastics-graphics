# VM Pool Management - Product Requirements

## Goal

Fix the VM Pool Management system so all workflows function correctly on production (`https://commentarygraphic.com`).

---

## Success Criteria

All three workflows must pass with Playwright screenshot verification:

### Workflow 1: Homepage → VM Pool → Launch VM
1. Homepage loads and shows "Online" status (green indicator)
2. Click "VM Pool" navigates to `/vm-pool` page
3. VM Pool page loads WITHOUT "Connection Error" or "Failed to fetch"
4. Pool Status displays correctly (shows VMs or "No VMs in Pool")
5. Click "Launch New VM" triggers launch
6. UI shows new VM in "Starting" state
7. AWS confirms new instance via `aws_list_instances`
8. VM becomes "Available" in Pool Status

### Workflow 2: Assign VM to Competition
1. Homepage shows competition selector
2. Can create or select a competition
3. Can assign an available VM to the competition
4. Firebase shows `vmAddress` in competition config
5. UI shows VM as "Assigned"

### Workflow 3: Stop/Start Existing VM
1. VM Pool page shows at least one running VM
2. Click "Stop" changes VM to "Stopping" then "Stopped"
3. AWS confirms instance state is "stopped"
4. Click "Start" changes VM to "Starting" then "Available"
5. AWS confirms instance state is "running"

---

## Environment

| Resource | Value |
|----------|-------|
| Production Frontend | https://commentarygraphic.com |
| Production Frontend Server | 3.87.107.201 |
| Frontend Directory | /var/www/commentarygraphic |
| Coordinator API | https://api.commentarygraphic.com |
| Coordinator VM | 44.193.31.120 |
| Coordinator Port | 3003 |
| Firebase | production |

---

## Known Issues (Starting Point)

1. **nginx missing /api/* proxy** - Production nginx only proxies `/.netlify/functions/*`, not `/api/*` endpoints
2. **VM Pool page shows "Connection Error"** - API calls fail because of missing proxy

---

## Verification Method

Every task MUST be verified with:
1. `browser_navigate` to the relevant page
2. `browser_take_screenshot` to capture current state
3. `browser_console_messages` to check for JS errors
4. Screenshot saved to `screenshots/` with descriptive filename

If verification fails, the task fails and a NEW task must be created to address the specific issue found.
