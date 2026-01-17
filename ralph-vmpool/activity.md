# VM Pool Fix - Activity Log

## Current Status
**Started:** 2026-01-17
**Goal:** Fix VM Pool Management workflows on production

---

## Activity Log

### 2026-01-17 - Initial Setup

Created Ralph loop for VM Pool fix:
- PRD.md: Defined 3 workflows and success criteria
- AGENT.md: Production environment details
- plan.md: 12 initial tasks (diagnostics, fixes, verifications)
- activity.md: This file
- ralph.sh: Loop runner

**Known starting issues:**
- VM Pool page shows "Connection Error - Failed to fetch"
- Production nginx missing /api/* proxy rule

**Next:** Run DIAG-01 to capture current state with screenshot

---

### DIAG-01: Diagnose VM Pool page screenshot - COMPLETED
**Action:** Navigated to https://commentarygraphic.com/vm-pool, took screenshot, captured console messages
**Screenshot:** screenshots/DIAG-01.png
**Console:** No JS errors. Log message: "CompetitionContext: Competition vm-pool not found"
**Result:**
- Page shows "Competition Not Found" error with sad face icon
- The URL `/vm-pool` is being interpreted as a competition ID by the router
- The frontend uses a `/:competitionId` catch-all route pattern
- No dedicated `/vm-pool` admin route exists (or it's not taking precedence)
- This is a ROUTING ISSUE, not an API/nginx issue

**Key Finding:** The original assumption that this was an nginx /api/ proxy issue is incorrect. The real issue is that there's no dedicated route for `/vm-pool` in the frontend - it falls through to the competition viewer.

**Next:** Run DIAG-01B to search codebase for VM Pool routing/components

---

### DIAG-01B: Find VM Pool admin page in codebase - COMPLETED
**Action:** Searched show-controller for VMPool, vm-pool, and routing patterns
**Screenshot:** screenshots/DIAG-01B.png
**Console:** Multiple errors: `Failed to load resource: net::ERR_CONNECTION_REFUSED @ http://localhost:3003/api/admin/vm-pool`

**Findings:**
1. **VM Pool page exists** at `/_admin/vm-pool` (not `/vm-pool`)
   - Defined in `App.jsx:44-48` with `CoordinatorGate` wrapper
   - Uses `_admin` prefix to avoid `/:compId` catch-all route
2. **Page loads** but shows "Connection Error - Failed to fetch"
3. **Root cause identified**: Frontend is making API calls to `localhost:3003` instead of production API
   - `src/lib/serverUrl.js` uses `VITE_API_URL` env var
   - `.env` file does NOT have `VITE_API_URL` set
   - Falls back to `localhost:3003` for local development
4. **Fix needed**: Add `VITE_API_URL=https://api.commentarygraphic.com` to `.env` and rebuild/redeploy

**Key Insight:** This is NOT an nginx issue - it's a build-time environment variable issue. The frontend was built without the production API URL configured.

**Next:** Run FIX-00 to add VITE_API_URL and rebuild/redeploy frontend

---

### FIX-00: Add VITE_API_URL and rebuild/redeploy - COMPLETED ✅
**Action:**
1. Added `VITE_API_URL=https://api.commentarygraphic.com` to `show-controller/.env`
2. Ran `npm run build` (initial build didn't pick up env var due to Vite caching)
3. Added debug log to `serverUrl.js` to force rebuild with new hash
4. Deployed to production server at 3.87.107.201

**Screenshot:** screenshots/FIX-00-pass.png
**Console:**
- `[serverUrl] Resolved SERVER_URL: https://api.commentarygraphic.com`
- `[VMPoolPage] Fetching pool status from: https://api.commentarygraphic.com/api/admin/vm-pool`
- `[VMPoolPage] Response status: 200`
- No errors!

**Result:**
- ✅ Page loads at `/_admin/vm-pool` without "Connection Error"
- ✅ API calls go to `api.commentarygraphic.com` (not localhost:3003)
- ✅ Pool Status displays correctly (0 VMs, "No VMs in Pool")
- ✅ "Online" status indicator shows green

**Tasks Skipped:** DIAG-02, DIAG-03, FIX-01 no longer needed - frontend now calls API directly
**Tasks Completed:** VERIFY-01, VERIFY-02 verified during FIX-00

**Next:** Run WORKFLOW-01 to test launching a new VM

---

### WORKFLOW-01: Launch New VM - COMPLETED ✅
**Action:** Clicked "Launch New VM" button on VM Pool page
**Screenshot:** screenshots/WORKFLOW-01-before.png (captured before launch)
**Console:** No errors

**Result:**
- ✅ Clicked "Launch New VM" button (ref=e88)
- ✅ Dialog appeared: "VM launched successfully! Instance ID: i-0a20c68a1d940b11a, Type: t3.large"
- ✅ AWS verification via `aws_list_instances`:
  - Instance ID: `i-0a20c68a1d940b11a`
  - Name: `gymnastics-vm-1768672589234`
  - State: `running`
  - Public IP: `44.203.192.255`
  - Type: t3.large

**Note:** Browser dialog blocked UI screenshot after launch. AWS confirmed VM exists and is running.

**Next:** Run WORKFLOW-02 to verify VM appears as Available in pool

---

### WORKFLOW-02: VM becomes Available - COMPLETED ✅
**Action:** Waited for VM to show as Available in pool

**Issue Found:** VM Pool page showed "0 total VMs" and "VM pool manager not initialized" despite AWS showing the VM running.

**Root Cause:** `GOOGLE_APPLICATION_CREDENTIALS` environment variable was not set on the coordinator server, causing Firebase Admin SDK to fail authentication.

**Fix Applied:**
1. Added `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json` to `/opt/gymnastics-graphics/server/.env`
2. Restarted coordinator: `pm2 restart coordinator`

**Screenshot:** screenshots/WORKFLOW-02-pass.png
**Console:** No errors
- `[VMPoolManager] Pool initialized successfully`
- `[VMPoolManager] Found 2 AWS instances`
- `[VMPoolManager] Synced 2 updates to Firebase`

**Result:**
- ✅ VM Pool Manager now initializes on coordinator startup
- ✅ Pool shows 2 total VMs (1 Available, 1 Stopped)
- ✅ VM `gymnastics-vm-1768672589234` shows as Available with IP 44.203.192.255

**Next:** Run WORKFLOW-03 to test stopping a VM

---

### WORKFLOW-03: Stop a VM - COMPLETED ✅
**Action:** Clicked "Stop" button on available VM `gymnastics-vm-1768672589234`

**Screenshot:** screenshots/WORKFLOW-03-stopping.png (during transition), screenshots/WORKFLOW-03-pass.png (final)
**Console:** No errors

**Result:**
- ✅ Clicked Stop button, UI showed "stopping" status (orange badge)
- ✅ AWS confirmed state changed from "running" to "stopping" to "stopped" (~40 seconds)
- ✅ UI updated to show VM as "stopped" with 2 Stopped, 0 Available
- ✅ "No warm VMs" warning appeared as expected

**Next:** Run WORKFLOW-04 to test starting a stopped VM

---

### WORKFLOW-04: Start a stopped VM - COMPLETED ✅
**Action:** Clicked "Start" button on stopped VM `gymnastics-vm-1768672589234`

**Screenshot:** screenshots/WORKFLOW-04-starting.png (during transition), screenshots/WORKFLOW-04-pass.png (final)
**Console:** No errors

**Result:**
- ✅ Clicked Start button, UI showed "starting" status (yellow badge)
- ✅ AWS confirmed state changed from "stopped" to "running" (~30 seconds)
- ✅ VM received new public IP: 3.89.92.162
- ✅ UI updated to show VM as "available" with 1 Available, 1 Stopped

**Workflows Completed:**
- ✅ WORKFLOW-01: Launch New VM
- ✅ WORKFLOW-02: VM becomes Available
- ✅ WORKFLOW-03: Stop a VM
- ✅ WORKFLOW-04: Start a stopped VM

**Remaining:** WORKFLOW-05, WORKFLOW-06 (homepage and competition assignment)

---
