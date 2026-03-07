# PRD: 7-Team Women's Competition — Audit & Bug Fix

**Status:** IN PROGRESS
**Date:** 2026-03-06
**Last Updated:** 2026-03-07
**Competition Type:** `womens-7` (7 teams, 4 apparatus, 7 rotations, 4 compete per rotation, 3 on bye)

---

## Overview

The `womens-7` competition format was recently added to support 7-team women's gymnastics meets. Initial testing reveals widespread bugs across the producer UI, overlay rendering, and event summary system. This PRD documents a systematic Playwright-based audit and all bugs discovered, then tracks their resolution.

## Test Competition

| Field | Value |
|-------|-------|
| Competition ID | `sewj4d2b` |
| Producer URL | `https://commentarygraphic.com/sewj4d2b/producer` |
| Output URL | `https://commentarygraphic.com/output.html?comp=sewj4d2b` |

## Format Rules

- 7 teams, 4 apparatus (VT, UB, BB, FX)
- 7 rotations (more teams than apparatus)
- Each rotation: 4 teams compete, 3 teams on bye
- Uses Virtius API `rotation` field for event detection (not hardcoded schedules)

---

## Bug Catalog

### Critical (Breaks Core Functionality)

#### BUG-001: `teamCounts` missing womens-5/6/7 in GraphicsControl.jsx
- **File:** `show-controller/src/components/GraphicsControl.jsx` (lines 60-66)
- **Description:** The local `teamCounts` object lacks `womens-5`, `womens-6`, `womens-7` entries, defaulting to 2 teams
- **Impact:** Producer treats womens-7 as a dual meet — only 2 team buttons shown, event summary sends `summaryNumTeams: 2`
- **Status:** COMPLETE

#### BUG-003: `useEventConfig` returns `rotationCount: 4` instead of 7
- **File:** `show-controller/src/hooks/useEventConfig.js` (line 78)
- **Description:** `rotationCount: events.length` always returns 4 for women's, ignoring that 7-team meets need 7 rotations
- **Impact:** Only R1-R4 rotation buttons visible in producer. R5-R7 inaccessible
- **Status:** COMPLETE

#### BUG-005: Missing `.teams-7` CSS in event summary layouts
- **File:** `output.html` (~21 layout versions)
- **Description:** Grid rules defined for `.teams-2` through `.teams-6` only. No `.teams-7` rule exists
- **Impact:** 7-team event summary grid has no column template — layout collapse or overflow
- **Status:** COMPLETE

### Major (Incorrect Behavior)

#### BUG-002: `sendNowCompeting` loops to 6 instead of 7
- **File:** `show-controller/src/components/GraphicsControl.jsx` (line 465)
- **Description:** `for (let i = 1; i <= 6; i++)` — team 7 athletes get team1's logo
- **Impact:** Wrong team logo on Now Competing graphic for team 7
- **Status:** COMPLETE

#### BUG-004: Rotation button grid assumes 4 or 6 only
- **File:** `show-controller/src/components/GraphicsControl.jsx` (line 639)
- **Description:** `rotationCount === 4 ? 'grid-cols-4' : 'grid-cols-6'` — no 7-column layout
- **Impact:** 7th rotation button wraps awkwardly
- **Status:** COMPLETE

#### BUG-006: No womens-5/6/7 in `ROTATION_SCHEDULES`
- **File:** `output.html` (lines 6944-6968)
- **Description:** `getScheduleKey()` maps 7-team to nonexistent `womens-6` key
- **Impact:** Mitigated by API detection for 5+ teams, but fragile fallback
- **Status:** COMPLETE

### Minor (Polish)

#### BUG-007: `getScheduleKey()` maps 7→6 semantically
- **File:** `output.html` (line 6961)
- **Description:** `>= 6` catchall should handle 7 explicitly
- **Status:** COMPLETE

#### BUG-008: team7 missing stats fields in Firebase config
- **Path:** `competitions/sewj4d2b/config`
- **Description:** Missing `team7Ave`, `team7High`, `team7Con`, `team7Coaches` fields
- **Status:** NOT STARTED

#### BUG-009: No BYE visual indicator in team-bug overlay
- **File:** `overlays/team-bug.html`
- **Description:** Teams on bye look identical to competing teams — no visual distinction
- **Status:** COMPLETE

### Discovered During Playwright Audit

#### BUG-010: BUG-001 fix not deployed — production still shows 2 teams
- **Severity:** Critical
- **Description:** BUG-001 was marked COMPLETE in code but the frontend has not been redeployed. Production still sends `summaryNumTeams: 2` for womens-7 competitions.
- **Steps to Reproduce:** Navigate to `https://commentarygraphic.com/sewj4d2b/producer` → observe Pre-Meet section shows only Brockport and Ithaca buttons (2 teams). Click any R1-R4 rotation → event summary shows only 2 team columns.
- **Expected:** 7 team buttons in producer, 4 or 7 team columns in event summary
- **Actual:** 2 team buttons, 2 team columns
- **Screenshot:** audit-A1-producer-page-load.png, audit-B1-event-summary-R1.png
- **Fix:** Deploy the updated frontend build to production (Task 4.1-4.2)

#### BUG-011: Rotation slate renders blank on output page
- **Severity:** Minor
- **Description:** Clicking "Rotation Slate" from producer results in blank output. The `#output` container remains empty.
- **Steps to Reproduce:** Open output tab → click Rotation Slate from producer → output page shows blank
- **Expected:** Rotation slate graphic with team assignments
- **Actual:** Blank page
- **Screenshot:** audit-E5-rotation-slate.png
- **Affected File:** `output.html` (rotation-slate graphic handler)

#### BUG-012: Mixed Content errors from VM IP on producer page
- **Severity:** Minor (infrastructure, not 7-team specific)
- **Description:** Producer page makes HTTP requests to VM IP `3.81.127.185:3003` which are blocked by Mixed Content policy on HTTPS page. Causes 5+ console errors per page load.
- **Steps to Reproduce:** Open producer page → check console → see Mixed Content errors for `/api/timesheet/overrides`, `/api/cameras/health`, `/api/cameras/runtime`
- **Expected:** No Mixed Content errors
- **Actual:** 5+ blocked requests, causing Failed to fetch errors
- **Screenshot:** audit-A1-producer-page-load.png

#### BUG-013: Firebase permission_denied for /alerts path
- **Severity:** Minor (infrastructure, not 7-team specific)
- **Description:** Producer console shows `[useAlerts] Firebase error: permission_denied at /alerts/sewj4d2b`
- **Steps to Reproduce:** Open producer page → check console
- **Expected:** Alerts load without error
- **Actual:** Permission denied error

---

## Acceptance Criteria

- [ ] Producer view shows all 7 team buttons (stats, coaches, roster for teams 1-7)
- [ ] R1-R7 rotation buttons visible and functional
- [ ] Event summary renders correctly with 7 team columns
- [ ] Now Competing shows correct logo for all 7 teams
- [ ] Team bug overlay renders all 7 teams with appropriate bye indicators
- [ ] Leaderboard displays all 7 teams
- [ ] No console errors on producer or output pages
- [ ] All graphics deploy and render correctly on production

---

## Playwright Audit Results (2026-03-07)

```
═══════════════════════════════════════
  7-TEAM WOMEN'S COMPETITION AUDIT
  Competition: sewj4d2b
═══════════════════════════════════════

PRODUCER VIEW
  A1 Page Load:           PASS (with 11 console errors - infrastructure)
  A2 Team Buttons:        FAIL (only 2 of 7 teams — BUG-001/BUG-010)
  A3 Rotation Buttons:    FAIL (R1-R4 only, need R1-R7 — BUG-003)
  A4 Rotation Layout:     FAIL (deferred, blocked by BUG-003 — BUG-004)
  A5 Apparatus Buttons:   PASS (VT, UB, BB, FX all visible)

TEAM BUG OVERLAY
  D1 Team Rows:           PASS (7 rows rendered)
  D2 Team Logos:           PASS (all 7 logos visible)
  D3 Score Display:       PASS (placeholder "--" shown, no NaN/undefined)
  D4 Bye Indicator:       FAIL (no visual distinction — BUG-009)

EVENT SUMMARY (by rotation)
  B1 R1:                  FAIL (2 teams shown, expected 4 — BUG-001/BUG-010)
  B2 R2:                  FAIL (2 teams shown — BUG-001/BUG-010)
  B3 R3:                  FAIL (2 teams shown — BUG-001/BUG-010)
  B4 R4:                  FAIL (2 teams shown — BUG-001/BUG-010)
  B5 R5:                  BLOCKED (button missing — BUG-003)
  B6 R6:                  BLOCKED (button missing — BUG-003)
  B7 R7:                  BLOCKED (button missing — BUG-003)

EVENT SUMMARY (by apparatus)
  C1 Vault:               FAIL (2 teams shown, expected 7 — BUG-001/BUG-010)
  C2 Bars:                FAIL (2 teams shown — BUG-001/BUG-010)
  C3 Beam:                FAIL (2 teams shown — BUG-001/BUG-010)
  C4 Floor:               FAIL (2 teams shown — BUG-001/BUG-010)

OTHER GRAPHICS
  E1 Leaderboard:         PASS (VT leaderboard renders correctly)
  E2 Logos:               PASS (all 7 logos displayed in grid)
  E3 Now Competing:       NOT TESTED (requires polling; BUG-002 confirmed by code)
  E4 Team Stats (1-7):    PARTIAL (team1-2 render; teams 3-7 no buttons — BUG-001)
  E5 Rotation Slate:      FAIL (blank output — BUG-011)

TOTAL: 7 PASS / 13 FAIL / 3 BLOCKED / 2 NOT TESTED
BUGS: 13 total (3 critical, 3 major, 7 minor)
  - Pre-existing (code analysis): BUG-001 through BUG-009
  - New (Playwright audit): BUG-010 through BUG-013
═══════════════════════════════════════
```
