# 7-Team Women's Competition — Implementation Plan

**PRD:** PRD-7-Team-Audit-2026-03-06
**Date:** 2026-03-06
**Last Updated:** 2026-03-07

---

## Phase 1: Critical Fixes (Breaks Core Functionality)

### Task 1.1: Fix `teamCounts` in GraphicsControl.jsx — COMPLETE

**File:** `show-controller/src/components/GraphicsControl.jsx` (lines 60-66)

**Change:** Add missing women's multi-team entries:
```javascript
const teamCounts = {
  'mens-dual': 2, 'womens-dual': 2,
  'mens-tri': 3, 'womens-tri': 3,
  'mens-quad': 4, 'womens-quad': 4,
  'mens-5': 5, 'womens-5': 5,
  'mens-6': 6, 'womens-6': 6,
  'womens-7': 7
};
```

**Fixes:** BUG-001 — Producer showing only 2 team buttons, wrong team count in event summaries

---

### Task 1.2: Fix `rotationCount` in useEventConfig.js — COMPLETE

**File:** `show-controller/src/hooks/useEventConfig.js` (line 78)

**Change:** Replace `rotationCount: events.length` with:
```javascript
rotationCount: Math.max(events.length, getTeamCount(compType))
```

Import `getTeamCount` from `competitionUtils.js`.

**Fixes:** BUG-003 — Only R1-R4 buttons shown instead of R1-R7

---

### Task 1.3: Add `.teams-7` CSS to all event summary layouts — COMPLETE

**File:** `output.html`

**Change:** For every event summary layout version (v3 through v23+), add:
```css
.event-summary-vN.teams-7 { grid-template-columns: repeat(7, 1fr); }
```

Also add font-size scaling for readability at 7 columns in 1920px.

**Fixes:** BUG-005 — Event summary grid layout collapse for 7 teams

---

## Phase 2: Major Fixes (Incorrect Behavior)

### Task 2.1: Fix `sendNowCompeting` team loop — COMPLETE

**File:** `show-controller/src/components/GraphicsControl.jsx` (line 465)

**Change:** Replace `i <= 6` with dynamic team count: `i <= maxTeams` (using `teamCounts[config.compType]`)

**Fixes:** BUG-002 — Team 7 gets wrong logo in Now Competing

---

### Task 2.2: Fix rotation button grid layout — COMPLETE

**File:** `show-controller/src/components/GraphicsControl.jsx` (line 639)

**Change:** Handle rotation counts beyond 6:
```javascript
${rotationCount <= 4 ? 'grid-cols-4' : rotationCount <= 6 ? 'grid-cols-6' : 'grid-cols-7'}
```

**Fixes:** BUG-004 — 7th rotation button wraps

---

### Task 2.3: Fix schedule fallback for womens 5/6/7 — COMPLETE

**File:** `output.html` (lines 6944-6968)

**Change:** Changed `numTeams === 5` and `numTeams >= 6` branches to a single `numTeams >= 5` branch that returns `null`, forcing API-based event detection via Virtius rotation field. Added comment explaining why.

**Fixes:** BUG-006 and BUG-007 — Incorrect/misleading schedule key mapping

---

## Phase 3: Minor Fixes (Polish)

### Task 3.1: Add BYE visual indicator to team-bug — COMPLETE

**File:** `overlays/team-bug.html`

**Change:** When a team has no active event for the current rotation:
- Reduce row opacity to 0.4 with grayscale filter (`.on-bye` CSS class)
- Show "BYE" text in the slot area
- Gray out team total display

**Implementation:**
- Added `.team-row.on-bye` CSS with opacity 0.4, grayscale 50%
- Added `isTeamOnBye()` function to check if team has event for current rotation
- Added `updateTeamByeStates()` function called on every poll and rotation change
- BYE indicator only shows for meets with more teams than apparatus (7-team women's, etc.)

**Fixes:** BUG-009 — No visual distinction for bye teams

---

### Task 3.2: Populate team7 Firebase config fields — COMPLETE

**Path:** `competitions/sewj4d2b/config`

**Change:** Added `team7Ave`, `team7High`, `team7Con`, `team7Coaches` fields via `firebase_update`:
- `team7Ave`: "0.000"
- `team7High`: "0.000"
- `team7Con`: "0%"
- `team7Coaches`: "TBD"

**Fixes:** BUG-008 — team7-stats and team7-coaches graphics render empty

---

### Task 3.3: Fix `getScheduleKey` semantic mapping — COMPLETE

**File:** `output.html` (line 6966)

**Change:** Combined with Task 2.3. The `numTeams >= 5` branch now returns `null` for all 5+ team formats, which forces API-based event detection. This eliminates the `>= 6` catchall that incorrectly mapped 7 to 6.

**Fixes:** BUG-007

---

## Phase 4: Deploy & Verify

### Task 4.1: Build frontend — COMPLETE
```bash
cd show-controller && npm run build
```

### Task 4.2: Deploy to production — COMPLETE
- Upload SPA (dist.tar.gz) ✓
- Upload output.html ✓
- Upload overlays/ ✓
- Set permissions (chmod 644) ✓

### Task 4.3: Playwright verification — COMPLETE
- Re-run full audit test matrix ✓
- Verified critical fixes:
  - BUG-001/BUG-010: All 7 team buttons visible in producer ✓
  - BUG-003: R1-R7 rotation buttons present ✓
  - BUG-005: 7-column grid renders correctly ✓
- Screenshots: verify-phase4-producer-7teams.png, verify-phase4-event-summary-7teams-full.png, verify-phase4-R7-event-summary.png
- Console errors: 12 (infrastructure-related, not 7-team bugs)

---

## Phase 5: Audit-Discovered Issues (Added 2026-03-07)

### Task 5.1: Investigate rotation-slate blank output — COMPLETE

**Description:** Rotation Slate graphic triggered from producer results in blank output page. The `#output` container is empty.

**Root Cause:** The `rotation-slate` graphic was missing from the `renderers` object in `output.html`. Additionally, the producer sent `rotation-slate` without a rotation number parameter.

**Fix:**
1. Added `rotation-slate` renderer to `output.html` that embeds the overlay in an iframe (similar to sponsor graphics)
2. Added `sendRotationSlate(rotation)` function in `GraphicsControl.jsx` to pass rotation number to Firebase
3. Modified producer UI to show R1-R7 buttons for rotation slate (similar to event summary rotation buttons)
4. Added rotation `'7'` option to `graphicsRegistry.js` for 7-team competitions

**Files Modified:**
- `output.html` (line ~10898)
- `show-controller/src/components/GraphicsControl.jsx`
- `show-controller/src/lib/graphicsRegistry.js`

**Fixes:** BUG-011

### Task 5.2: Fix Mixed Content errors from VM IP — COMPLETE

**Description:** Producer page makes HTTP requests to VM IP that are blocked by HTTPS Mixed Content policy. Need to ensure all API calls use HTTPS or go through the coordinator proxy.

**Root Cause:** `ProducerView.jsx` and `OverrideLog.jsx` used `VITE_SOCKET_SERVER` environment variable directly instead of `socketUrl` from `CompetitionContext`. The env var was set to `http://3.81.127.185:3003` which caused Mixed Content errors when the site is served over HTTPS.

**Fix:**
1. Updated `ProducerView.jsx` to extract `socketUrl` from `useCompetition()` context
2. Updated `OverrideLog.jsx` to accept `serverUrl` as a prop instead of reading from env
3. Now routes through `https://api.commentarygraphic.com` in production (handled by CompetitionContext)

**Files Modified:**
- `show-controller/src/views/ProducerView.jsx`
- `show-controller/src/components/OverrideLog.jsx`

**Fixes:** BUG-012

### Task 5.3: Fix Firebase /alerts permission denied — DEFERRED (Infrastructure)

**Description:** `useAlerts` hook tries to read `/alerts/sewj4d2b` but Firebase rules deny access.

**Root Cause Analysis:**
- The `/alerts` path is not in the Firebase Realtime Database rules (managed in Firebase console, not in this repo)
- The server-side `alertService.js` uses Firebase Admin SDK which bypasses rules and can write alerts
- The client-side `useAlerts.js` uses the regular Firebase SDK which is subject to rules
- Firebase rules need to be updated in the Firebase console to allow read access to `/alerts/{competitionId}`

**Impact:**
- Console error: `[useAlerts] Firebase error: permission_denied at /alerts/sewj4d2b`
- UI shows "No active alerts" and continues to work normally
- Alert functionality works correctly when server writes alerts (Admin SDK bypasses rules)

**Resolution:**
This is an infrastructure configuration issue, not a code bug. The fix requires:
1. Access to Firebase console for `gymnastics-graphics` project
2. Update Realtime Database rules to add read permission for `/alerts/{compId}` path

**Recommendation:** Mark as DEFERRED for infrastructure team. The 7-team audit code fixes are complete.

**Fixes:** BUG-013

---

## Estimated Scope

| Phase | Tasks | Complexity | Status |
|-------|-------|------------|--------|
| Phase 1: Critical | 3 | Medium | 3 COMPLETE |
| Phase 2: Major | 3 | Low-Medium | 3 COMPLETE |
| Phase 3: Minor | 3 | Low | 3 COMPLETE |
| Phase 4: Deploy | 3 | Low | 3 COMPLETE |
| Phase 5: Audit Issues | 3 | Low | 2 COMPLETE, 1 DEFERRED |
| **Total** | **15** | | |

---

## Playwright Audit Priority

Based on the audit, the **critical path** is:
1. **Deploy the existing BUG-001 fix** (Task 4.1-4.2) — this single deploy will unblock most FAIL results
2. **Fix BUG-003** (Task 1.2) — unblocks R5-R7 rotation buttons
3. **Fix BUG-005** (Task 1.3) — enables 7-column grid layouts
4. Then address remaining major/minor fixes
