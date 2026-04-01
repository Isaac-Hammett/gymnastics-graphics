# Current Category Structure

## What

Analysis of the existing `categories.json` and how it needs to change for Phase 5.

---

## Current State

**File:** `stage/graphics/categories.json`

### Categories (6 total)

| Order | Key | Label | Subcategories |
|-------|-----|-------|---------------|
| 1 | `full-screen-cards` | Full-Screen Cards | leaderboards, team-info, sponsors |
| 2 | `lower-thirds` | Lower-Thirds | event-info, team-stats, spotlight |
| 3 | `full-bleed` | Full-Bleed | slates, stream, sponsors |
| 4 | `video-frames` | Video Frames | camera-layouts, apparatus |
| 5 | `standalone` | Standalone | (empty) |
| 6 | `event-summary` | Event Summary | rotations, apparatus |

### Subcategory Details

**full-screen-cards:**
- `leaderboards` → "Leaderboards"
- `team-info` → "Team Info"
- `sponsors` → "Sponsors"

**lower-thirds:**
- `event-info` → "Event Info"
- `team-stats` → "Team Stats"
- `spotlight` → "Spotlight"

**full-bleed:**
- `slates` → "Slates"
- `stream` → "Stream"
- `sponsors` → "Sponsors"

**video-frames:**
- `camera-layouts` → "Camera Layouts"
- `apparatus` → "Apparatus"

**standalone:**
- (no subcategories)

**event-summary:**
- `rotations` → "By Rotation"
- `apparatus` → "By Apparatus"

---

## Target State (per Phase 5 Doc)

### Required Subcategory Changes

| Category | Current | Phase 5 Requires | Changes Needed |
|----------|---------|------------------|----------------|
| full-screen-cards | leaderboards, team-info, sponsors | leaderboards, **aa-leaders**, **rosters**, sponsors | Add `aa-leaders`, add `rosters` (or map to team-info) |
| lower-thirds | event-info, team-stats, spotlight | event-info, team-stats, **coaches**, spotlight | Add `coaches` |
| full-bleed | slates, stream, sponsors | slates, stream, **spotlight**, sponsors | Add `spotlight` |
| video-frames | camera-layouts, apparatus | layouts, apparatus | Rename `camera-layouts` → `layouts` |
| standalone | (empty) | (empty) | No change |
| event-summary | rotations, apparatus | N/A (separate category) | No change |

### Graphics Mapped to New Subcategories

**full-screen-cards:**
```
leaderboards: leaderboard-vt, leaderboard-fx, leaderboard-ph, leaderboard-sr, leaderboard-pb, leaderboard-hb, leaderboard-ub, leaderboard-bb, leaderboard-aa, combined-aa-leaderboard
aa-leaders: aa-leaders (if separate from leaderboard-aa)
rosters: team-roster-1, team-roster-2, ... (perTeam expansion)
sponsors: sponsors-thanks
```

**lower-thirds:**
```
event-info: event-bar, warm-up, replay
team-stats: team1-stats, team2-stats, ... (perTeam expansion)
coaches: team1-coaches, team2-coaches, ... (perTeam expansion)
spotlight: athlete-spotlight, who-to-watch, hosts
```

**full-bleed:**
```
slates: rotation-slate, rotation-slate-auto, interview-card, who-to-watch-title
stream: stream-starting, stream-thanks (via stream.json with perTeam expansion)
spotlight: (overlap with lower-thirds spotlight?)
sponsors: sponsors-cycle
```

---

## Risks

### Risk 1: Duplicate "sponsors" Subcategory

`sponsors` appears in both `full-screen-cards` and `full-bleed`. This is intentional — different graphic types:
- full-screen-cards/sponsors: `sponsors-thanks` (full-screen thank you card)
- full-bleed/sponsors: `sponsors-cycle` (rotating sponsor display)

The build script allows duplicate subcategory names across different categories.

### Risk 2: Duplicate "spotlight" Subcategory

Phase 5 doc puts `spotlight` under both `lower-thirds` AND `full-bleed`. Current implementation only has it under `lower-thirds`.

**Resolution:** Add `spotlight` to `full-bleed` subcategories if `who-to-watch-title` and `interview-card` should appear there. Otherwise, keep them under `slates`.

### Risk 3: "aa-leaders" vs Leaderboard Subcategory

The Phase 5 doc lists `aa-leaders` as a separate subcategory from `leaderboards`. Looking at the manifest:
- `leaderboard-aa` exists (All-Around leaderboard)
- `aa-leaders` may be a different graphic or alias

**Clarification needed:** Is `aa-leaders` a distinct graphic ID, or should `leaderboard-aa` be placed under an `aa-leaders` subcategory?

### Risk 4: "rosters" vs "team-info"

Current structure uses `team-info` for team rosters. Phase 5 doc uses `rosters`.

**Options:**
1. Add `rosters` as new subcategory, move `team-roster` manifests there
2. Keep `team-info`, update Phase 5 doc to match

**Recommendation:** Keep `team-info` — it's more general and allows for future team-related graphics beyond rosters.

---

## categories.json Update Required

```json
{
  "full-screen-cards": {
    "label": "Full-Screen Cards",
    "order": 1,
    "subcategories": {
      "leaderboards": "Leaderboards",
      "team-info": "Team Info",
      "sponsors": "Sponsors"
    }
  },
  "lower-thirds": {
    "label": "Lower-Thirds",
    "order": 2,
    "subcategories": {
      "event-info": "Event Info",
      "team-stats": "Team Stats",
      "coaches": "Coaches",
      "spotlight": "Spotlight"
    }
  },
  "full-bleed": {
    "label": "Full-Bleed",
    "order": 3,
    "subcategories": {
      "slates": "Slates",
      "stream": "Stream",
      "sponsors": "Sponsors"
    }
  },
  "video-frames": {
    "label": "Video Frames",
    "order": 4,
    "subcategories": {
      "layouts": "Layouts",
      "apparatus": "Apparatus"
    }
  },
  "standalone": {
    "label": "Standalone",
    "order": 5,
    "subcategories": {}
  },
  "event-summary": {
    "label": "Event Summary",
    "order": 6,
    "subcategories": {
      "rotations": "By Rotation",
      "apparatus": "By Apparatus"
    }
  }
}
```

**Changes from current:**
1. Add `coaches` to lower-thirds subcategories
2. Rename `camera-layouts` → `layouts` in video-frames

**Kept unchanged:**
- `team-info` (not renamed to `rosters`)
- No `aa-leaders` subcategory (AA leaderboard stays under `leaderboards`)
- No `spotlight` under full-bleed (use `slates`)

---

## Open Questions

1. Should `aa-leaders` be a distinct graphic with its own subcategory, or is it `leaderboard-aa` under `leaderboards`?
2. Should `who-to-watch-title` and `interview-card` stay under `slates` or move to a new `spotlight` subcategory in full-bleed?
3. Is the `coaches` subcategory needed, or should coaches graphics remain under `team-stats`?
