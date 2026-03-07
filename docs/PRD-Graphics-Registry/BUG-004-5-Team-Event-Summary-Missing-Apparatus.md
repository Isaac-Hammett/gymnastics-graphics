# BUG-004: 5-Team Men's Event Summary Missing Apparatus

**Status:** FIXED
**Fixed:** 2026-02-28
**Discovered:** 2026-02-28
**Severity:** High
**Component:** Event Summary / Rotation View

---

## Summary

For 5-team (and 6-team) men's competitions, the event summary shows "NULL" for the apparatus of the 5th team because the `ROTATION_SCHEDULES` object in `output.html` only has schedules defined for up to 4 teams (`mens-quad`).

## Screenshot Evidence

**Graphics Output (incorrect):**
| Team | Apparatus |
|------|-----------|
| Stanford | Floor Exercise |
| California | Pommel Horse |
| USA | Still Rings |
| Mexico | Vault |
| All Stars | **NULL** |

**Virtius R1 (correct):**
| Apparatus | Team |
|-----------|------|
| Floor Exercise | Mexico |
| Pommel Horse | California |
| Still Rings | All Stars |
| Vault | Stanford |
| Parallel Bars | USA |

## Root Cause Analysis

### Issue 1: Missing Rotation Schedules

The `getScheduleKey()` function at line 5897 falls back to `mens-quad` for all competitions with 4+ teams:

```javascript
} else if (numTeams >= 4) {
  return `${genderPrefix}-quad`;
}
```

The `mens-quad` schedule only defines team indices 0-3:

```javascript
'mens-quad': {
  rotationCount: 6,
  eventOrder: ['FLOOR', 'HORSE', 'RINGS', 'VAULT', 'PBARS', 'BAR'],
  schedule: {
    1: { FLOOR: 0, HORSE: 1, RINGS: 2, VAULT: 3, PBARS: null, BAR: null },
    // ...
  },
}
```

Team index 4 (All Stars) is not present in any schedule slot, so `getTeamEventForRotation()` returns `null`.

### Issue 2: Team Order Mismatch

The Firebase config defines teams in order (team1=Stanford, team2=Cal, etc.), but the Virtius API has its own `team_order` field which may differ. The rotation schedule assumes teams are indexed 0-5 based on sorted `team_order`, but this may not match the actual event assignments.

## Technical Details

- **Competition ID:** `p04h3m2o`
- **Competition Type:** `mens-5`
- **Virtius Session ID:** `zXgUOkJuM_`
- **File:** `output.html` - `getScheduleKey()` (line 5884), `getTeamEventForRotation()` (line 5939)

### Code Flow

1. `fetchAndRenderEventSummary()` calls `getTeamEventForRotation(idx, rotation, actualNumTeams, ...)` for each team
2. `getTeamEventForRotation()` calls `getScheduleKey(5, format, 'mens')` which returns `'mens-quad'`
3. Looking up team index 4 in `mens-quad.schedule[1]` finds no matching entry
4. Function returns `null`, displayed as "NULL" in the graphic

## Fix Applied

### Fix 1: Added rotation schedules (partial fix - superseded)
Added `mens-5` and `mens-6` rotation schedules to handle 5 and 6 team meets. This fixed the "NULL" apparatus issue but didn't fix incorrect assignments because hardcoded schedules don't match how each meet actually assigns teams to apparatus.

### Fix 2: Score-based detection (broken - superseded)
Added `detectEventFromApiData()` function that sorted events with scores by olympic order and returned the Nth event for rotation N. This was flawed because:
- Teams don't compete in olympic order in 5-team meets
- Looking at rotation N when only N-1 rotations are complete showed wrong data
- The function returned the last event with scores for future rotations

### Fix 3: Virtius API rotation field (final fix)
The Virtius API includes a `rotation` field on each event indicating which rotation it was scored in. The fix reads this field directly:

```javascript
function detectEventFromApiData(team, rotation, gender) {
  // Virtius API includes a 'rotation' field on each event indicating which rotation it was scored in
  // This is the most reliable way to determine team-event assignments
  const eventForRotation = (team.events || []).find(e => e.rotation === rotation);
  if (eventForRotation) {
    return eventForRotation.event_name;
  }
  // Fallback: If no event has the requested rotation, the team may have a bye
  // or the rotation hasn't happened yet - return null to indicate no data
  return null;
}
```

### Virtius API Rotation Data Example

For Stanford International (session `zXgUOkJuM_`), the API returns rotation assignments for all 6 rotations:

| Team | FLOOR | HORSE | RINGS | VAULT | PBARS | BAR |
|------|-------|-------|-------|-------|-------|-----|
| Stanford | 4 | 5 | 6 | 1 | 2 | 3 |
| California | 6 | 1 | 2 | 3 | 4 | 5 |
| USA | 3 | 4 | 5 | 6 | 1 | 2 |
| Mexico | 1 | 2 | 3 | 4 | 5 | 6 |
| All Stars | 5 | 6 | 1 | 2 | 3 | 4 |

### Complete Rotation Matrix

| Rotation | Stanford | California | USA | Mexico | All Stars |
|----------|----------|------------|-----|--------|-----------|
| R1 | Vault | Pommel Horse | Parallel Bars | Floor | Still Rings |
| R2 | Parallel Bars | Still Rings | High Bar | Pommel Horse | Vault |
| R3 | High Bar | Vault | Floor | Still Rings | Parallel Bars |
| R4 | Floor | Parallel Bars | Pommel Horse | Vault | High Bar |
| R5 | Pommel Horse | High Bar | Still Rings | Parallel Bars | Floor |
| R6 | Still Rings | Floor | Vault | High Bar | Pommel Horse |

The `rotation` field is assigned when the meet is set up in Virtius, so the fix works for all rotations (R1-R6) regardless of whether scores have been entered yet.

## Verification

After fix:
1. Navigate to producer page for a `mens-5` competition
2. Select R1 in Event Summary section
3. All 5 teams should show valid apparatus names (not NULL)
4. Team-apparatus assignments should match Virtius

## Related Issues

- BUG-003: Men's Tri Event Summary Blank (similar rotation schedule issue)
- PRD-Graphics-Registry: Should document supported competition types

## Notes

The Virtius API `rotation` field on each event is the authoritative source for team-apparatus assignments. This eliminates the need for hardcoded rotation schedules for 5+ team meets, as the API directly tells us which rotation each event was competed in.
