# Gender Filtering

## What

How gender filtering currently works for graphics and which graphics need filtering.

---

## Current State

### Core Filter Function

**File:** `show-controller/src/lib/graphicsRegistry.js` (lines 105-116)

```javascript
export function isGraphicAvailable(graphic, compType, teamCount) {
  // Check gender filter
  const isMens = compType?.startsWith('mens');
  if (graphic.gender === 'mens' && !isMens) return false;
  if (graphic.gender === 'womens' && isMens) return false;

  // Check team count constraints
  if (graphic.minTeams && teamCount < graphic.minTeams) return false;
  if (graphic.maxTeams && teamCount > graphic.maxTeams) return false;

  return true;
}
```

### Detection Method

Competition type strings encode gender:
- `mens-dual`, `mens-tri`, `mens-quad`, etc. → Men's
- `womens-dual`, `womens-tri`, `womens-quad`, etc. → Women's

```javascript
const isMens = compType?.startsWith('mens');
```

### Implementation in URL Generator

**File:** `show-controller/src/pages/UrlGeneratorPage.jsx` (lines 116-121)

```javascript
// Filter by gender
if (graphic.gender === 'mens' && !isMens) continue;
if (graphic.gender === 'womens' && isMens) continue;
```

### Implementation in Graphics Control

**File:** `show-controller/src/components/GraphicsControl.jsx` (lines 167-177)

Uses `getGraphicsForCompetition()` which internally calls `isGraphicAvailable()`.

---

## Graphics with Gender Restrictions

**Based on manifest scan and registry analysis:**

### Women's Only (3 graphics)

| ID | Label | Category | Subcategory |
|----|-------|----------|-------------|
| `leaderboard-ub` | Uneven Bars | full-screen-cards | leaderboards |
| `leaderboard-bb` | Balance Beam | full-screen-cards | leaderboards |
| `summary-ub` | Uneven Bars Summary | event-summary | apparatus |
| `summary-bb` | Balance Beam Summary | event-summary | apparatus |

### Men's Only (8 graphics)

| ID | Label | Category | Subcategory |
|----|-------|----------|-------------|
| `leaderboard-ph` | Pommel Horse | full-screen-cards | leaderboards |
| `leaderboard-sr` | Still Rings | full-screen-cards | leaderboards |
| `leaderboard-pb` | Parallel Bars | full-screen-cards | leaderboards |
| `leaderboard-hb` | High Bar | full-screen-cards | leaderboards |
| `summary-ph` | Pommel Horse Summary | event-summary | apparatus |
| `summary-sr` | Still Rings Summary | event-summary | apparatus |
| `summary-pb` | Parallel Bars Summary | event-summary | apparatus |
| `summary-hb` | High Bar Summary | event-summary | apparatus |

### Gender-Neutral ("both") — All Other Graphics

- Vault and Floor leaderboards/summaries (both genders compete)
- All-Around leaderboards
- Team rosters, coaches, stats (per-team)
- Sponsors, logos, stream graphics
- Video frames, rotation slates
- Event bar, warm-up, replay

---

## Target State

### No Changes Required

Gender filtering already works correctly. Phase 5 reorganization does not change this behavior.

### Verification Checklist

- [ ] Men's competition: PH, SR, PB, HB leaderboards visible; UB, BB hidden
- [ ] Women's competition: UB, BB leaderboards visible; PH, SR, PB, HB hidden
- [ ] Both: VT, FX, AA leaderboards visible
- [ ] Both: All non-apparatus graphics visible (logos, sponsors, etc.)

---

## Risk

### Event Frame Graphics

Event frames for apparatus (`frame-pommel`, `frame-rings`, etc.) may need gender filtering if they exist as separate manifests. Currently these are variants of `event-frame` which is gender-neutral.

**Verification needed:** Check if apparatus-specific event frames exist and whether they have gender restrictions.

---

## Open Questions

1. Should video frames for men's apparatus (rings, pommel, pbars, hbar) be hidden for women's competitions?
2. Should video frames for women's apparatus (bars, beam) be hidden for men's competitions?
3. Are there any graphics that should show for ONLY mixed-gender events?
