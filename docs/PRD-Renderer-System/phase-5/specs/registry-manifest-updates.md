# Registry & Manifest Updates

## What

What manifest changes are needed for Phase 5, which graphics need `category`/`subcategory` added or updated.

---

## Current State

### Manifest Inventory

| Location | Count | Categories Set | Subcategories Set |
|----------|-------|----------------|-------------------|
| `stage/graphics/*.json` | 12 | 12 (100%) | 12 (100%) |
| `stage/graphics/legacy/*.json` | 43 | 43 (100%) | 38 (88%) |
| **Total** | 55 | 55 (100%) | 50 (91%) |

### Manifests Missing Subcategory

| Manifest | Current Category | Needs Subcategory |
|----------|------------------|-------------------|
| `logos.json` | standalone | No (standalone has no subcategories) |
| `event-calendar.json` | standalone | No |
| `team-bug.json` | standalone | No |
| `animated-background.json` | standalone | No |
| `clip-player.json` | standalone | No |
| `now-competing.json` | standalone | No |

**Note:** All manifests missing subcategory are in the `standalone` category, which has no subcategories defined. This is correct behavior.

### Renderer Distribution

| Renderer | Count | Notes |
|----------|-------|-------|
| `stage` | 12 | All in `stage/graphics/` (non-legacy) |
| `overlay` | 36 | All in `stage/graphics/legacy/` |
| `output` | 7 | All in `stage/graphics/legacy/` (event summaries + now-competing) |

---

## Target State

### Categories.json Updates Required

Per gap analysis, `categories.json` needs these changes:

**Add to lower-thirds subcategories:**
```json
"coaches": "Coaches"
```

**Rename in video-frames subcategories:**
```json
"layouts": "Layouts"  // was "camera-layouts"
```

### Manifest Subcategory Mapping

All existing manifests already have correct category/subcategory assignments. No individual manifest updates required.

**Verification of current assignments:**

| Category | Subcategory | Graphics |
|----------|-------------|----------|
| full-screen-cards | leaderboards | leaderboard-vt, leaderboard-fx, leaderboard-ph, leaderboard-sr, leaderboard-pb, leaderboard-hb, leaderboard-ub, leaderboard-bb, leaderboard-aa, combined-aa-leaderboard |
| full-screen-cards | team-info | team-roster |
| lower-thirds | event-info | event-bar, warm-up, replay |
| lower-thirds | team-stats | team-stats, team-coaches |
| lower-thirds | spotlight | hosts, athlete-spotlight, who-to-watch |
| full-bleed | slates | rotation-slate, rotation-slate-auto, interview-card, who-to-watch-title |
| full-bleed | stream | stream |
| full-bleed | sponsors | sponsors-thanks, sponsors-cycle, sponsors-bug |
| video-frames | camera-layouts | frame-quad, frame-tri-center, frame-tri-wide, frame-tri-wide-top, frame-team-header, frame-single, frame-dual |
| video-frames | apparatus | event-frame |
| standalone | (none) | logos, event-calendar, team-bug, animated-background, clip-player, now-competing |
| event-summary | rotations | summary-r1 through summary-r6 |
| event-summary | apparatus | summary-fx, summary-ph, summary-sr, summary-vt, summary-pb, summary-hb, summary-ub, summary-bb |

### Issue: coaches.json Uses team-stats

**Current:** `coaches.json` has `subcategory: "team-stats"`

**Per Phase 5 Doc:** Coaches should be under `coaches` subcategory

**Options:**
1. Update manifest: Change `coaches.json` to `subcategory: "coaches"`
2. Update Phase 5 doc: Keep coaches under `team-stats`

**Recommendation:** Add `coaches` subcategory to categories.json AND update coaches.json manifest.

---

## Required Changes

### 1. Update categories.json

**File:** `stage/graphics/categories.json`

**Changes:**

```diff
  "lower-thirds": {
    "label": "Lower-Thirds",
    "order": 2,
    "subcategories": {
      "event-info": "Event Info",
      "team-stats": "Team Stats",
+     "coaches": "Coaches",
      "spotlight": "Spotlight"
    }
  },
  ...
  "video-frames": {
    "label": "Video Frames",
    "order": 4,
    "subcategories": {
-     "camera-layouts": "Camera Layouts",
+     "layouts": "Layouts",
      "apparatus": "Apparatus"
    }
  },
```

### 2. Update coaches.json

**File:** `stage/graphics/legacy/coaches.json`

**Change:**
```diff
- "subcategory": "team-stats",
+ "subcategory": "coaches",
```

### 3. Update frame-*.json manifests

**Files:** All 7 frame manifests in `stage/graphics/legacy/`

**Change:**
```diff
- "subcategory": "camera-layouts",
+ "subcategory": "layouts",
```

---

## Build Script Validation

The build script (`scripts/buildGraphicsRegistry.js`) already validates:
1. `category` exists in `categories.json` (error if missing)
2. `subcategory` exists in `categories[category].subcategories` (error if missing)

After making the above changes:
- `coaches` subcategory will be valid for lower-thirds
- `layouts` subcategory will be valid for video-frames
- Old subcategory names (`team-stats` for coaches, `camera-layouts` for frames) will be invalid

**Run build to verify:** `npm run build:registry`

---

## Risks

### Risk 1: Breaking Change for camera-layouts

Renaming `camera-layouts` → `layouts` may break:
- URL query parameters that reference subcategory
- Any hardcoded references in the codebase

**Search for `camera-layouts`:** Should only appear in categories.json and frame manifests.

### Risk 2: Per-Team Expansion

Graphics with `perTeam: true` expand at runtime:
- `team-roster` → `team1-roster`, `team2-roster`, etc.
- `team-stats` → `team1-stats`, `team2-stats`, etc.
- `team-coaches` → `team1-coaches`, `team2-coaches`, etc.

The expanded variants inherit `category` and `subcategory` from the base manifest.

**Verification:** Ensure expanded variants appear in correct subcategories in sidebar.

---

## No Changes Required

The following are already correct:
- All 12 stage engine manifests have category + subcategory
- All 43 legacy manifests have category (and subcategory where applicable)
- Standalone category correctly has no subcategories
- Event summary category correctly has rotations/apparatus subcategories

---

## Open Questions

1. Should `team-coaches` be under `coaches` subcategory or stay under `team-stats`?
2. Should `camera-layouts` be renamed to `layouts` or kept as-is?
3. Are there any external systems that reference subcategory names (analytics, monitoring)?
