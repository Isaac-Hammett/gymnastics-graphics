# URL Builder Patterns

## What

Analysis of `urlBuilder.js` — the URL generation system that Phase 4 will refactor to use manifest-based building.

## Current State

**File:** `show-controller/src/lib/urlBuilder.js`

### generateGraphicURL() Structure (lines 489-847)

The main function contains:

- **21 switch cases** for standard graphics
- **5 early regex pattern matches** before the switch
- **1 default fallback** to `buildGraphicUrlFromRegistry()`

**Total: 29+ distinct URL building paths**

### Switch Cases (21 graphics)

```
logos, event-bar, warm-up, replay, hosts, floor, pommel, rings, vault,
pbars, hbar, ubars, beam, allaround, final, order, lineups, summary,
starting, thanks, sponsors-thanks, sponsors-cycle, sponsors-bug,
rotation-slate, rotation-slate-auto, event-calendar
```

### Regex Pattern Matches (5 dynamic patterns)

| Pattern | Purpose | Lines |
|---------|---------|-------|
| `team(\d+)-stats$` | Dynamic team stats | 511-524 |
| `team(\d+)-coaches$` | Dynamic team coaches | 526-535 |
| `team(\d+)-roster$` | Dynamic team roster | 537-548 |
| `team(\d+)-who-to-watch$` | Who to Watch overlay | 551-564 |
| `team(\d+)-who-to-watch-title$` | Who to Watch title card | 567-590 |

Additional patterns:
- `frame-(quad|tri-center|tri-wide-top|tri-wide|team-header|single|dual)$` (lines 593-602)
- `leaderboard-(.+)$` (lines 619-634)
- `summary-r(\d+)$` (lines 637-654)
- `summary-(fx|ph|sr|vt|pb|hb|ub|bb)$` (lines 656-673)

### Per-Graphic Builder Functions (14 exported)

| Function | Lines | Purpose |
|----------|-------|---------|
| `buildLogosURL()` | 78-91 | Team logos grid (1-7 teams) |
| `buildEventBarURL()` | 104-115 | Lower-third with venue/location |
| `buildHostsURL()` | 125-132 | Hosts list (newline→pipe conversion) |
| `buildTeamStatsURL()` | 147-161 | Team stats display |
| `buildCoachesURL()` | 172-183 | Coaches list |
| `buildTeamRosterURL()` | 196-207 | Dynamic roster loader |
| `buildEventFrameURL()` | 218-228 | Event title frames |
| `buildStreamURL()` | 248-266 | Starting/Thanks screen |
| `buildSponsorsThanksURL()` | 277-286 | Sponsor grid |
| `buildSponsorsCycleURL()` | 297-311 | Cycling sponsor overlay |
| `buildFrameOverlayURL()` | 341-355 | Frame graphics |
| `buildLeaderboardURL()` | 369-390 | Event leaderboard |
| `buildCombinedAALeaderboardURL()` | 404-422 | Multi-session AA |
| `buildEventSummaryURL()` | 440-478 | Rotation/apparatus mode |

### buildGraphicUrlFromRegistry() Fallback (lines 911-959)

The generic fallback for graphics not in the switch statement:

1. Looks up graphic by ID in registry
2. Returns null if not found or renderer !== 'overlay'
3. Iterates over `graphic.params` schema
4. For each param: checks `formData` → `source: 'competition'` → `default`
5. Appends `meetTheme` if present
6. Builds URL: `{base}/overlays/{graphic.file}?{queryString}`

**Key insight:** This is already a schema-driven approach — the pattern Phase 4 should expand.

### URL Parameter Patterns (7 distinct approaches)

1. **Conditional URLSearchParams** — add param only if truthy
2. **Manual string concatenation** — for special cases
3. **Encode helper** — `encodeURIComponent(value || '')`
4. **Conditional on non-default** — only include if differs from default
5. **Placeholder logo fallback** — color cycling for missing logos
6. **Loop for multi-team** — iterates 1 to teamCount
7. **Numeric coercion** — `String(numericValue)`

## Target State

After Phase 4:

### Stage Engine Graphics
URLs are always:
```
{base}/stage/stage.html?comp={compId}&graphic={graphicId}
```
No per-graphic logic needed. No `meetTheme` param (theme baked into spec).

### Overlay Graphics
Build generically from manifest `params` schema — the existing `buildGraphicUrlFromRegistry()` pattern expanded to handle all overlays.

### Output.html Graphics
Keep existing URL patterns (event summary, etc.) until migrated.

## Risks

1. **Special transformations** (newline→pipe for hosts/coaches) need manifest representation
2. **Placeholder logo logic** is currently inline — needs extraction
3. **Combined AA Leaderboard** has unique multi-session handling
4. **Event Summary** has complex mode/format switching

## Open Questions

1. Should manifests include a `transform` field for special processing (newline→pipe)?
2. How to handle the placeholder logo color cycling in a manifest-based system?
3. Should per-graphic builder functions be deprecated gradually or removed at once?
