# BUG-005: Rotation Slate Auto Stuck — Exhibition Gymnasts Break Rotation Detection

**Status:** FIXED
**Fixed:** 2026-03-14
**Discovered:** 2026-03-14
**Severity:** High
**Component:** Rotation Slate Auto Overlay (`overlays/rotation-slate-auto.html`)
**Competition:** Stanford Senior Night Quad (`1iw2zv1s`, 5-team men's)

---

## Summary

The rotation slate auto overlay worked correctly for rotations 1-4 but froze and stopped advancing at rotation 5. The overlay continued polling the Virtius API but the detected rotation number never updated.

## Root Cause

`detectRotation()` used two detection strategies:
- **Standard:** Count completed events per team (requires ALL listed gymnasts to have `final_score`)
- **Rotation-field-based:** Read the `rotation` field from the Virtius API (authoritative)

The rotation-field approach was gated behind `hasByes` (`teamCount > eventCount`). For a 5-team men's meet: `5 > 6 = false`, so the standard path was used.

The standard path counts an event as "completed" only when `scored.length === gymnasts.length`. But **France had 6 gymnasts listed per event while only 4 competed** (exhibition athletes). Since `4 !== 6`, none of France's events counted as complete, dragging `minCompleted` to 0 and freezing the rotation display.

Similarly, Stanford's Pommel Horse had 6 gymnasts (4 scored) and California's Horse had 5 gymnasts (4 scored).

## Why Exhibition Gymnasts Break It

Exhibition/alternate gymnasts appear in the Virtius API's `gymnasts` array but never receive a `final_score`. The standard detection assumes every listed gymnast will eventually score, which is false for exhibition athletes.

## Fix

Changed `detectRotation()` to prefer the rotation-field-based detection whenever the API data includes `rotation` fields on events, regardless of the `hasByes` condition. The rotation-field approach reads the authoritative `event.rotation` value from Virtius and finds the highest rotation with any scores — immune to exhibition gymnast inflation.

The old counting-based approach is kept as a fallback only for APIs that don't provide rotation fields.

### Before (broken)
```javascript
const hasByes = state.teamCount > eventCount;
if (hasByes) {
  return detectRotationFromApiFields(apiTeams, totalRotations);
}
// Falls through to standard detection for 5-team mens (5 < 6)
```

### After (fixed)
```javascript
const hasRotationFields = apiTeams.some(team =>
  (team.events || []).some(event => event.rotation != null)
);
if (hasRotationFields) {
  return detectRotationFromApiFields(apiTeams, totalRotations);
}
// Standard detection only used when API lacks rotation fields
```

## Related Bugs

- BUG-003: Men's Tri Event Summary Blank (also rotation detection)
- BUG-004: 5-Team Men's Event Summary Missing Apparatus (also multi-team Virtius API)
