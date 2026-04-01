# Current Registry Structure

## What

Analysis of `graphicsRegistry.js` — the hand-maintained registry that Phase 4 will replace with auto-generated manifests.

## Current State

**File:** `show-controller/src/lib/graphicsRegistry.js`

### GRAPHICS Object Structure

Every graphic entry contains these fields:

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier (e.g., 'logos', 'event-bar') |
| `label` | string | Yes | Display name shown in UI |
| `labelTemplate` | string | No | Dynamic label with `{teamName}` substitution |
| `category` | string | Yes | Category for grouping (9 categories) |
| `keywords` | string[] | Yes | Search/recommendation keywords (lowercase) |
| `gender` | string | Yes | Filter: 'mens', 'womens', or 'both' |
| `minTeams` | number | No | Minimum teams required for graphic |
| `maxTeams` | number | No | Maximum teams supported (typically 7) |
| `renderer` | string | Yes | Rendering path: 'overlay' or 'output' |
| `file` | string | Yes | File path or graphic name (without extension) |
| `transparent` | boolean | Yes | OBS background handling flag |
| `perTeam` | boolean | No | If true, expands to team1-*, team2-*, etc. |
| `params` | object | No | Parameter schema (type, source, required, etc.) |

**Example entry (lines 57-71):**
```javascript
{
  id: 'logos',
  label: 'Team Logos',
  category: 'pre-meet',
  keywords: ['logo', 'logos', 'team', 'teams', 'intro', 'introduction'],
  gender: 'both',
  minTeams: 1,
  maxTeams: 7,
  renderer: 'overlay',
  file: 'logos.html',
  transparent: false,
  params: { /* Dynamic based on teamCount */ }
}
```

### Categories (9 total)

| Category | Graphics Count | Purpose |
|----------|---------------|---------|
| pre-meet | 11 | Shown before competition starts |
| in-meet | 2 | Used during competition |
| event-frames | 13 | Event title frames (apparatus, finals, lineups) |
| frame-overlays | 7 | Camera layout frames (quad, tri, dual, single) |
| leaderboards | 10 | Score leaderboards per apparatus + AA |
| event-summary | 13 | Rotation/apparatus summaries |
| stream | 2 | Stream start/end screens |
| sponsors | 3 | Sponsor graphics |

**Note:** No explicit `subcategory` field exists. Subcategorization is implicit via naming conventions (e.g., `summary-r1` through `summary-r6` for rotation summaries).

### Renderer Field Values

Only 2 values are currently used:

| Value | Count | File Source |
|-------|-------|-------------|
| `'overlay'` | ~79 | `file: 'filename.html'` (from `/overlays/`) |
| `'output'` | ~25 | `file: 'graphic-name'` (no extension, rendered by output.html) |

**Note:** The PRD specifies `'stage'` as a third value for stage engine graphics, but this value does not yet exist in the registry.

### Helper Functions (lines 1215-1405)

| Function | Purpose |
|----------|---------|
| `getAllGraphics()` | Returns all graphics as flat array |
| `getGraphicById(id)` | Single graphic lookup by ID |
| `getGraphicsByCategory(category)` | Filter by category |
| `getCategories()` | All unique category names |
| `isGraphicAvailable(graphic, compType, teamCount)` | Check gender/team constraints |
| `getGraphicsForCompetition(compType, teamNames, category?)` | Competition-specific graphics with expanded labels |
| `getRecommendedGraphic(segmentName, compType, teamNames?)` | Smart recommendation by segment name + keywords |
| `isTransparentGraphic(graphicId)` | Check transparency flag |

### Per-Team Graphics Expansion (lines 1295-1309)

Graphics with `perTeam: true` are expanded dynamically:
- `team-stats` → `team1-stats`, `team2-stats`, etc.
- `team-coaches` → `team1-coaches`, `team2-coaches`, etc.
- `team-roster` → `team1-roster`, `team2-roster`, etc.
- `athlete-spotlight` → per-team expansion
- `who-to-watch` / `who-to-watch-title` → per-team expansion

The `labelTemplate` field provides dynamic labels: `"{teamName} Stats"` becomes `"Stanford Stats"`.

## Target State

After Phase 4:
- `graphicsRegistry.js` imports from `graphicsRegistry.generated.js`
- The generated file is produced by `scripts/buildGraphicsRegistry.js` at build time
- All helper functions remain unchanged (only the data source changes)
- Adding a new graphic = creating one manifest JSON file

## Risks

1. **Per-team expansion logic** must be preserved in the generated registry
2. **Category order** is currently implicit (based on definition order in the object) — `categories.json` will make it explicit
3. **Param schema** varies significantly between graphics — manifests must capture all variants

## Open Questions

1. Should `labelTemplate` be in the manifest or computed at runtime?
2. How are `minTeams`/`maxTeams` constraints validated in manifests?
3. Should the `keywords` array be auto-generated from labels, or manually curated?
