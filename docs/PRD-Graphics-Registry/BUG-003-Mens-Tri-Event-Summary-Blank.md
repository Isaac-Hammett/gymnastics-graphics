# BUG-003: Men's Tri Event Summary Blank Body

**Status:** FIXED
**Discovered:** 2026-02-07
**Fixed:** 2026-02-07
**Severity:** High
**Component:** Event Summary / Rotation View

---

## Summary

The event summary graphic for men's tri meets shows team headers correctly (team name, logo, event) but the body is completely blank - no athlete names or scores are rendered.

## Screenshot Evidence

Event Summary for R2 showing:
- Header: Greenville (Pommel Horse), California (Still Rings), Simpson (Floor Exercise)
- Body: Completely empty - no athletes, no scores
- Footer: "Event Total" with dashes

## Root Cause Analysis

Two issues were identified:

### Issue 1: Incorrect Rotation Schedule (Fixed in commit cf3473d)

The `ROTATION_SCHEDULES['mens-tri']` had incorrect team assignments. In a men's tri meet, all 3 teams compete on the same group of 3 events simultaneously:

- Rotations 1-3: FX, PH, SR (first 3 apparatus)
- Rotations 4-6: VT, PB, HB (last 3 apparatus)

### Issue 2: Event Name Mismatch (This fix)

The code was searching for display names ("Floor Exercise", "Pommel Horse") when the Virtius API returns raw event codes ("FLOOR", "HORSE").

**Problematic code (line 5371-5373):**
```javascript
// Convert internal event code to API event name (e.g., 'FLOOR' -> 'Floor Exercise')
const apiEventName = EVENT_DISPLAY_NAMES[eventName] || eventName;
const teamEvent = team.events?.find(e => e.event_name === apiEventName);
```

The comment was misleading - the API does NOT use display names, it uses the raw codes.

## Fix Applied

Changed line 5373 to search for the raw event code instead of the display name:

**Before:**
```javascript
const apiEventName = EVENT_DISPLAY_NAMES[eventName] || eventName;
const teamEvent = team.events?.find(e => e.event_name === apiEventName);
```

**After:**
```javascript
// API returns event names as codes (FLOOR, HORSE, etc.), not display names
const teamEvent = team.events?.find(e => e.event_name === eventName);
```

## Technical Details

- **Competition:** Greenville / California / Simpson (h1r0s56g)
- **Virtius Session ID:** dniGIa5XEq
- **API Endpoint:** `https://api.virti.us/session/dniGIa5XEq/json`
- **File:** `output.html` - `fetchAndRenderEventSummary()` function (line ~5370)

### API Event Names

The Virtius API returns event names as:
- Men's: `FLOOR`, `HORSE`, `RINGS`, `VAULT`, `PBARS`, `BAR`
- Women's: `VAULT`, `BARS`, `BEAM`, `FLOOR`

NOT as display names like "Floor Exercise", "Pommel Horse", etc.

## Verification

After fix:
1. Navigate to the producer page for a mens-tri competition
2. Select any rotation (R1-R6) in the Event Summary section
3. The graphic should show athlete names and scores in each team column

## Related Issues

- BUG: Rotation schedule was also incorrect (fixed in commit cf3473d)
- BUG-004: 5-Team Men's Event Summary Missing Apparatus (similar issue, different fix)
- The correct mens-tri rotation schedule is:
  ```javascript
  'mens-tri': {
    rotationCount: 6,
    eventOrder: ['FLOOR', 'HORSE', 'RINGS', 'VAULT', 'PBARS', 'BAR'],
    schedule: {
      1: { FLOOR: 0, HORSE: 1, RINGS: 2, VAULT: null, PBARS: null, BAR: null },
      2: { FLOOR: 2, HORSE: 0, RINGS: 1, VAULT: null, PBARS: null, BAR: null },
      3: { FLOOR: 1, HORSE: 2, RINGS: 0, VAULT: null, PBARS: null, BAR: null },
      4: { FLOOR: null, HORSE: null, RINGS: null, VAULT: 0, PBARS: 1, BAR: 2 },
      5: { FLOOR: null, HORSE: null, RINGS: null, VAULT: 2, PBARS: 0, BAR: 1 },
      6: { FLOOR: null, HORSE: null, RINGS: null, VAULT: 1, PBARS: 2, BAR: 0 },
    },
  }
  ```

## Note on Multi-Team Rotation Handling

For **tri and quad meets (2-4 teams)**, hardcoded rotation schedules work because the rotation patterns are standardized.

For **5+ team meets**, hardcoded schedules don't work because each meet may have different starting positions. The fix for 5+ teams uses the Virtius API `rotation` field on each event to determine the correct team-apparatus assignments. See BUG-004 for details.
