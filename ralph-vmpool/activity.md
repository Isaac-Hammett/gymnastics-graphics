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
