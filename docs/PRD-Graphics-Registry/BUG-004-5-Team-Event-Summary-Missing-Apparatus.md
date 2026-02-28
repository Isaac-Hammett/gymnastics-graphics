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

Added `mens-5` and `mens-6` rotation schedules to handle 5 and 6 team meets.

### Men's 5-Team Schedule

For 5-team meets, teams rotate through all 6 apparatus over 6 rotations with one apparatus having a "bye" each rotation:

```javascript
'mens-5': {
  rotationCount: 6,
  eventOrder: ['FLOOR', 'HORSE', 'RINGS', 'VAULT', 'PBARS', 'BAR'],
  schedule: {
    1: { FLOOR: 0, HORSE: 1, RINGS: 2, VAULT: 3, PBARS: 4, BAR: null },
    2: { FLOOR: 4, HORSE: 0, RINGS: 1, VAULT: 2, PBARS: 3, BAR: null },
    // ... rotates with HB joining and other apparatus cycling out
  },
}
```

### Men's 6-Team Schedule

For 6-team meets, all teams compete on all apparatus simultaneously:

```javascript
'mens-6': {
  rotationCount: 6,
  eventOrder: ['FLOOR', 'HORSE', 'RINGS', 'VAULT', 'PBARS', 'BAR'],
  schedule: {
    1: { FLOOR: 0, HORSE: 1, RINGS: 2, VAULT: 3, PBARS: 4, BAR: 5 },
    // ... standard rotation
  },
}
```

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

For future consideration: Rather than hardcoding all possible rotation schedules, consider reading the event assignment directly from the Virtius API data. Each team's `events` array contains which events they competed in, which could be used to infer the current rotation's apparatus.
