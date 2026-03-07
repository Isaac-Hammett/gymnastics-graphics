# 7-Team Women's Competition — Implementation Plan

**PRD:** PRD-7-Team-Audit-2026-03-06
**Date:** 2026-03-06
**Last Updated:** 2026-03-06

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

### Task 1.2: Fix `rotationCount` in useEventConfig.js — NOT STARTED

**File:** `show-controller/src/hooks/useEventConfig.js` (line 78)

**Change:** Replace `rotationCount: events.length` with:
```javascript
rotationCount: Math.max(events.length, getTeamCount(compType))
```

Import `getTeamCount` from `competitionUtils.js`.

**Fixes:** BUG-003 — Only R1-R4 buttons shown instead of R1-R7

---

### Task 1.3: Add `.teams-7` CSS to all event summary layouts — NOT STARTED

**File:** `output.html`

**Change:** For every event summary layout version (v3 through v23+), add:
```css
.event-summary-vN.teams-7 { grid-template-columns: repeat(7, 1fr); }
```

Also add font-size scaling for readability at 7 columns in 1920px.

**Fixes:** BUG-005 — Event summary grid layout collapse for 7 teams

---

## Phase 2: Major Fixes (Incorrect Behavior)

### Task 2.1: Fix `sendNowCompeting` team loop — NOT STARTED

**File:** `show-controller/src/components/GraphicsControl.jsx` (line 439)

**Change:** Replace `i <= 6` with dynamic team count: `i <= numTeams` (using the corrected `teamCounts` from Task 1.1)

**Fixes:** BUG-002 — Team 7 gets wrong logo in Now Competing

---

### Task 2.2: Fix rotation button grid layout — NOT STARTED

**File:** `show-controller/src/components/GraphicsControl.jsx` (line 613)

**Change:** Handle rotation counts beyond 6:
```javascript
${rotationCount <= 4 ? 'grid-cols-4' : rotationCount <= 6 ? 'grid-cols-6' : 'grid-cols-7'}
```

**Fixes:** BUG-004 — 7th rotation button wraps

---

### Task 2.3: Fix schedule fallback for womens 5/6/7 — NOT STARTED

**File:** `output.html` (lines 6660-6665)

**Change:** Improve `getScheduleKey()` to handle all team counts explicitly, or return `null` for 5+ teams to make the API detection path explicit.

**Fixes:** BUG-006 and BUG-007 — Incorrect/misleading schedule key mapping

---

## Phase 3: Minor Fixes (Polish)

### Task 3.1: Add BYE visual indicator to team-bug — NOT STARTED

**File:** `overlays/team-bug.html`

**Change:** When a team has no active event for the current rotation:
- Reduce row opacity to 0.4
- Show "BYE" text in the slot area
- Gray out score display

**Fixes:** BUG-009 — No visual distinction for bye teams

---

### Task 3.2: Populate team7 Firebase config fields — NOT STARTED

**Path:** `competitions/sewj4d2b/config`

**Change:** Add `team7Ave`, `team7High`, `team7Con`, `team7Coaches` fields via `firebase_update`

**Fixes:** BUG-008 — team7-stats and team7-coaches graphics render empty

---

### Task 3.3: Fix `getScheduleKey` semantic mapping — NOT STARTED

**File:** `output.html` (line 6663)

**Change:** Add explicit case for 7 teams instead of `>= 6` catchall. Combined with Task 2.3.

**Fixes:** BUG-007

---

## Phase 4: Deploy & Verify

### Task 4.1: Build frontend — NOT STARTED
```bash
cd show-controller && npm run build
```

### Task 4.2: Deploy to production — NOT STARTED
- Upload SPA (dist.tar.gz)
- Upload output.html
- Upload overlays/
- Set permissions (chmod 644)

### Task 4.3: Playwright verification — NOT STARTED
- Re-run full audit test matrix
- Verify all 9+ bugs are resolved
- Take final screenshots
- Check console for errors

---

## Estimated Scope

| Phase | Tasks | Complexity | Status |
|-------|-------|------------|--------|
| Phase 1: Critical | 3 | Medium | NOT STARTED |
| Phase 2: Major | 3 | Low-Medium | NOT STARTED |
| Phase 3: Minor | 3 | Low | NOT STARTED |
| Phase 4: Deploy | 3 | Low | NOT STARTED |
| **Total** | **12** | | |
