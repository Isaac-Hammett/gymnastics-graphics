# PRD: 7-Team Women's Competition — Audit & Bug Fix

**Status:** IN PROGRESS
**Date:** 2026-03-06
**Last Updated:** 2026-03-06
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
- **Status:** NOT STARTED

#### BUG-005: Missing `.teams-7` CSS in event summary layouts
- **File:** `output.html` (~21 layout versions)
- **Description:** Grid rules defined for `.teams-2` through `.teams-6` only. No `.teams-7` rule exists
- **Impact:** 7-team event summary grid has no column template — layout collapse or overflow
- **Status:** NOT STARTED

### Major (Incorrect Behavior)

#### BUG-002: `sendNowCompeting` loops to 6 instead of 7
- **File:** `show-controller/src/components/GraphicsControl.jsx` (line 439)
- **Description:** `for (let i = 1; i <= 6; i++)` — team 7 athletes get team1's logo
- **Impact:** Wrong team logo on Now Competing graphic for team 7
- **Status:** NOT STARTED

#### BUG-004: Rotation button grid assumes 4 or 6 only
- **File:** `show-controller/src/components/GraphicsControl.jsx` (line 613)
- **Description:** `rotationCount === 4 ? 'grid-cols-4' : 'grid-cols-6'` — no 7-column layout
- **Impact:** 7th rotation button wraps awkwardly
- **Status:** NOT STARTED

#### BUG-006: No womens-5/6/7 in `ROTATION_SCHEDULES`
- **File:** `output.html` (lines 6515-6643)
- **Description:** `getScheduleKey()` maps 7-team to nonexistent `womens-6` key
- **Impact:** Mitigated by API detection for 5+ teams, but fragile fallback
- **Status:** NOT STARTED

### Minor (Polish)

#### BUG-007: `getScheduleKey()` maps 7→6 semantically
- **File:** `output.html` (line 6663)
- **Description:** `>= 6` catchall should handle 7 explicitly
- **Status:** NOT STARTED

#### BUG-008: team7 missing stats fields in Firebase config
- **Path:** `competitions/sewj4d2b/config`
- **Description:** Missing `team7Ave`, `team7High`, `team7Con`, `team7Coaches` fields
- **Status:** NOT STARTED

#### BUG-009: No BYE visual indicator in team-bug overlay
- **File:** `overlays/team-bug.html`
- **Description:** Teams on bye look identical to competing teams — no visual distinction
- **Status:** NOT STARTED

### Discovered During Playwright Audit

*(Additional bugs will be added here as the audit progresses)*

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
