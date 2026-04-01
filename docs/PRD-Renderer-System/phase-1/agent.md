# Execution Knowledge

{Discovered by iterations. Not specs — execution gotchas, timing, dependencies, patterns.}
{Each iteration appends here when it learns something non-obvious.}
{Never put task status here (that's plan.md) or specs (that's the PRD).}

## Initial Analysis Findings

### Firebase SDK & Config

- **Version: 9.22.0 compat mode** — use `-compat.js` CDN URLs, NOT modular imports
- CDN URLs:
  ```html
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>
  ```
- Firebase config object (copy exactly from output.html lines 7797-7804):
  ```javascript
  const firebaseConfig = {
    apiKey: "AIzaSyCh0aZUvKl6Qvqsva3hvOgJJlleP1OwcTY",
    authDomain: "gymnastics-graphics.firebaseapp.com",
    databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
    projectId: "gymnastics-graphics",
    storageBucket: "gymnastics-graphics.firebasestorage.app",
    messagingSenderId: "702072609550",
    appId: "1:702072609550:web:ac74a811186d3ff45b955f"
  };
  ```
- Compat API: `firebase.initializeApp(config)`, `firebase.database()`, `.ref().on('value', cb)`, `.ref().set()`, `.ref().once('value')`

### Google Fonts Link Tag

Copy exactly from output.html line 9:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

### Module Pattern

- output.html does NOT use an IIFE — code runs directly in global scope inside a `<script>` block
- stage.html should follow the same pattern: inline `<script>` in the HTML body, global scope variables
- Blocks use window globals: `window.BlockHeaderBar = { themeVars, render, destroy, ready, sampleData }`
- **`themeVars` is required on every block** — an array of `--meet-*` CSS variable names the block's CSS uses. Establishes which theme variables a block depends on. Phase 4 build script validates `themeVars` against actual CSS usage.
- Block lookup: `window['Block' + pascalCase(blockType)]`
- **pascalCase conversion must handle both hyphens and underscores:** `_sample-block` → strip leading underscore → `sample-block` → `SampleBlock`

### Block JS Loading

- Use `<script>` tag injection (not `fetch()` + `eval()`) for block JS files — this matches how theme-loader.js is loaded
- Each `<script>` tag loads from relative path `blocks/{type}.js`
- Wait for `onload` event before looking up `window['Block' + pascalCase(type)]`
- If the global doesn't exist after load → treat as load error
- Block CSS can use `<link>` tags or `<style>` with fetched content — `<link>` is simpler

### OBS Compatibility

- `body { background: transparent; }` is critical — OBS composites transparent areas
- `transform-origin: top left;` ensures OBS scaling aligns correctly
- `<meta name="viewport" content="width=1920, height=1080">` required
- `overflow: hidden` on body prevents scrollbars

### Skeleton Fetch Pattern

- Use `fetch()` for skeleton HTML and CSS (they're text content, not scripts)
- Relative paths: `fetch('skeletons/full-screen-card.html')`
- CSS: inject as `<style data-skeleton="name">` (not `<link>`) so cleanup is easy — just remove the element
- HTML: inject via `.innerHTML` into `#skeleton-mount`

### theme-overrides.css Image URL Convention

- Image URLs stored **raw** in CSS variables (no `url()` wrapping)
- Block CSS wraps them: `background-image: url(var(--meet-header-bg-image));`
- This matches the existing pattern in theme-overrides.css

### GraphicsControl.jsx — 7 Set Call Sites

When adding the `renderer` field (Task 11), there are 7 distinct `set()` calls to `currentGraphic`:
1. Line 308: `sendCustomGraphic` — hardcode `renderer: 'output'`
2. Line 467: `sendGraphic` — compute from registry
3. Line 487: `sendRotationSlate` — hardcode `renderer: 'output'`
4. Line 499: `sendAutoRotationSlate` — hardcode `renderer: 'output'`
5. Line 558: `sendEventSummary` — hardcode `renderer: 'output'`
6. Line 569: `clearGraphic` — NO renderer field (both engines clear on `graphic: 'clear'`)
7. Line 591: `sendNowCompeting` — hardcode `renderer: 'output'`

### output.html Renderer Check Location

The currentGraphic listener starts at line 14016. The renderer check should go right after `const state = snapshot.val();` and the null check, before the existing `themeReadyPromise` logic. The exact insertion point is after the null-check block (around line 14052) and before the `const { graphic, data } = state;` destructuring.

### Error Reporting Path

Stage engine errors go to `competitions/{compId}/production/stageErrors/{timestamp}` (NOT `rendererErrors` — the PRD uses `stageErrors`). Format:
```json
{
  "type": "block_load_error",
  "graphic": "graphic-id",
  "block": "block-name",
  "message": "error description",
  "url": "current page URL",
  "timestamp": "ISO string"
}
```

### Preview Mode — No Firebase Required

Preview mode (`?preview=`) must work without `?comp=` and without Firebase. The only exception: `&theme={themeId}` fetches theme data from Firebase `themes/{themeId}`. All other preview features use local sample data only.

### Deploy — Permission Fix

macOS SCP creates files with 600 permissions. nginx gets 403 Forbidden. Always run:
```bash
find stage -type f -exec chmod 644 {} +
```
after extracting the tarball on the server.

### Deploy — Nginx Config Location

Must inspect the production server to find the nginx config file. Likely at `/etc/nginx/sites-available/commentarygraphic` or `/etc/nginx/conf.d/`. The location block for `/stage/` must be added alongside existing rules for output.html and overlays/.

## Phase 2 Findings

### Block Registration Pattern

Blocks register on `window` using PascalCase: `window.BlockHeaderBar`, `window.BlockLeaderboardTable`, `window.BlockAthleteGrid`.

The `pascalCase()` function in stage.html strips leading `_`, splits on `-`, capitalizes each part:
- `header-bar` → `HeaderBar` → `window.BlockHeaderBar`
- `leaderboard-table` → `LeaderboardTable` → `window.BlockLeaderboardTable`
- `athlete-grid` → `AthleteGrid` → `window.BlockAthleteGrid`

### Block CSS Wrapper Convention

Each block's CSS is scoped under `.block-{type}`:
- `.block-header-bar`
- `.block-leaderboard-table`
- `.block-athlete-grid`

The wrapper div is created by `loadSingleBlock()` with `wrapper.className = 'block-' + type`.

### Block Data Flow

`render(container, data, context)` receives:
- `container`: the wrapper div (`.block-{type}`)
- `data`: block-specific data resolved by precedence: `dataMap[entry.id]` → `dataMap[entry.type]` → `entry.block.sampleData` → `{}`
- `context`: `{ comp, theme, db, compConfig }` where `db` is `firebase.database()` instance

### Firebase Paths for Phase 2 Blocks

- **header-bar**: No Firebase reads. Data comes from spec.
- **leaderboard-table**: Listens to `competitions/{comp}/{data.source}` if `data.source` is set. The intended path `scoring/leaderboard/{apparatus}` does NOT exist yet — Phase 3 creates it. The listener is harmless when path is empty.
- **athlete-grid**: One-shot reads from `teamsDatabase/teams/{teamKey}/roster` and `teamsDatabase/headshots` via `context.db.ref().once('value')`.

### Headshot Lookup — Use Full 5-Step Chain

The roster-headshot-lookup spec documents a 5-step fallback chain that must be replicated exactly. The simplified 2-key lookup in the Phase 2 doc (`headshots[normalized] || headshots[name]`) will cause visible regressions because Firebase headshot keys are inconsistently normalized.

Full chain:
1. Direct lowercase: `name.toLowerCase().replace(/\s+/g, ' ').trim()`
2. Fully normalized: accent stripping (ö→oe, é→e), suffix removal (Jr., Sr., I-V)
3. Stripped special chars: `[^a-z\s]` removed
4. First + Last name only (3+ parts)
5. First + Middle initial + Last (3+ parts)

### Leaderboard Column Variants

Column visibility is controlled by `data.apparatus` and `data.gender`:
- `isWomens = gender === 'womens'`
- `isAA = apparatus === 'AA' || apparatus === 'COMBINED_AA'`
- `showDiffExec = !isWomens && !isAA`
- `showApparatus = !isAA`

Men's events: 8 columns (#, Name, Team, Apparatus, Score, Diff, Exec, SB)
Women's events: 5 columns (#, Name, Team, Apparatus, Score)
All-Around: 4 columns (#, Name, Team, Score)

### Leaderboard Score Formatting

- `score.toFixed(3)` — always 3 decimal places
- `diff.toFixed(2)` — 2 decimal places
- `exec.toFixed(3)` — 3 decimal places
- `font-variant-numeric: tabular-nums` on container for aligned columns

### Athlete Grid Count Classes

`_getCountClass(count)` mapping:
- 1-6: `ag-count-{N}` (individual)
- 7-8: `ag-count-8`
- 9-10: `ag-count-10`
- 11-12: `ag-count-12`
- 13-15: `ag-count-15`
- 16-20: `ag-count-20`
- 21-25: `ag-count-25`
- 26+: `ag-count-large`

### Preview URL for Phase 2 Blocks

Local: `http://localhost:8765/stage/stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table`
Production: `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table`

For roster: replace `leaderboard-table` with `athlete-grid`.

### Deploy — No Nginx Changes Needed

Phase 1 already configured the `/stage/` nginx location block. Phase 2 only adds files inside `stage/blocks/` — same deploy pattern (tarball + extract + chmod 644).

### Key CSS Values to Match

**Leaderboard (from output.html):**
- Frame header: #d4d4d8 bg, 18px 40px padding, 42px/800wt title
- Table header: #27272a bg, 16px 20px padding, #a1a1aa text, 600 weight
- Rows: odd #18181b, even #0f0f10, 14px 20px padding
- Score: 32px, 700 weight, right-aligned
- Medals: 20px circles — gold #facc15, silver #d4d4d8, bronze #d97706
- Stick bonus: 28px circle, #22c55e bg
- Team logo: 36px, border-radius 4px, #27272a bg

**Roster (from team-roster.html):**
- Container: #18181b bg, 40px padding
- Headshot: 120px default, circular, 3px border #52525b, object-position center 20%
- Initials: gradient bg (#3f3f46 → #27272a), 36px font, 700 weight, #a1a1aa color
- Name: 18px, 600 weight, uppercase, Inter font, ellipsis overflow

### Block `ready()` Lifecycle

`ready()` is called by `waitForReady()` inside `loadBlocks()` — this happens BEFORE `render()` is called. It also receives NO arguments (not even `container`). So `ready()` cannot inspect DOM elements created by `render()`. For blocks with no async setup (no Firebase listeners), just `return Promise.resolve()`. If a block needs to signal when async rendering is done (e.g., images loaded), it must manage that internally after `render()` is called — `ready()` is not the right place.

## Phase 3 Findings

### Service Architecture Pattern

Follow PlayoutEngine's singleton pattern exactly:
- `const scoringServices = new Map()` — per-competition instances
- `getScoringService(compId, options)` — get or create
- `removeScoringService(compId)` — stop + cleanup + delete
- `getAllScoringServices()` — for health checks

### Service Class Structure

Extend `EventEmitter`:
```javascript
class ScoringIngestionService extends EventEmitter {
  constructor(options) {
    super();
    this.compId = options.compId;
    this._firebase = options.firebase;
    this._io = options.io;
    // ... state init
  }
}
```

### Polling Loop Pattern

Always use the start/stop guard pattern:
```javascript
_startPolling() {
  this._stopPolling();  // Guard against double-start
  this._pollTimer = setInterval(async () => {
    await this._poll();  // Errors caught inside
  }, this._pollInterval * 1000);
}

_stopPolling() {
  if (this._pollTimer) {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
  }
}
```

### Firebase Write Strategy — CRITICAL

Use `.update()` on individual subpaths, NOT `.set()` on the root:
```javascript
// CORRECT
await scoringRef.child('leaderboard/VT').update(vtData);
await scoringRef.child('teamTotals').update(totalsData);

// WRONG — destroys sibling data on partial failure
await scoringRef.set({ leaderboard: {...}, teamTotals: {...} });
```

### Gap Ranking Algorithm

Matches output.html behavior:
```javascript
let currentPlace = 1;
sortedGymnasts.forEach((g, i) => {
  if (i > 0 && g.score < sortedGymnasts[i-1].score) {
    currentPlace = i + 1;  // Skip tied positions
  }
  g.rank = currentPlace;
});
// Result: [9.9, 9.8, 9.8, 9.7] → ranks [1, 2, 2, 4]
```

### Virtius Score Formula

```javascript
const diff = parseFloat(g.scores?.[0]?.start) || 0;
const exec = parseFloat(g.e_score) || 0;  // Already includes 10.0 base
const nd = parseFloat(g.neutral) || 0;
const bonus = parseFloat(g.bonus) || 0;

const score = diff + exec - nd + bonus;
const stickBonus = bonus > 0;
```

**Critical:** `e_score` already includes the 10.0 base — do NOT add 10.0 again.

### Apparatus Code Normalization

```javascript
const APPARATUS_MAP = {
  'Floor Exercise': 'FX', 'FLOOR': 'FX', 'FX': 'FX',
  'Pommel Horse': 'PH', 'HORSE': 'PH', 'PH': 'PH',
  'Still Rings': 'SR', 'RINGS': 'SR', 'SR': 'SR',
  'Vault': 'VT', 'VAULT': 'VT', 'VT': 'VT',
  'Parallel Bars': 'PB', 'PBARS': 'PB', 'PB': 'PB',
  'High Bar': 'HB', 'BAR': 'HB', 'HB': 'HB',
  'Uneven Bars': 'UB', 'UBARS': 'UB', 'UB': 'UB',
  'Balance Beam': 'BB', 'BEAM': 'BB', 'BB': 'BB',
  'All Around': 'AA', 'AA': 'AA'
};
```

### Gender-Based Column Variants

```javascript
const isWomens = gender === 'womens';
const isAA = apparatus === 'AA';
const showDiffExec = !isWomens && !isAA;  // Men's non-AA only
```

### Server Integration Points

**Import location:** Top of `server/index.js` (after other service imports)

**Initialization:** Call `initializeScoringIngestion()` in the startup sequence AFTER Firebase is ready:
```javascript
httpServer.listen(PORT, async () => {
  // ... existing init
  await initializeScoringIngestion();
});
```

**Socket room:** `competition:{compId}` — same as playoutEngine

**Event prefix:** `scoring:` (e.g., `scoring:pollCompleted`, `scoring:started`, `scoring:stopped`)

### Producer Activity Reset Pattern

Reset activity timestamp on ANY socket event from the competition room:
```javascript
socket.use((packet, next) => {
  const service = scoringServices.get(clientCompId);
  if (service) service.resetProducerActivity();
  next();
});
```

### ProducerView Panel Insertion Point

Insert ScoringFeedPanel at line ~1287 (after ScoreBugPanel, before VMConnectionPanel):
```jsx
<ScoreBugPanel compId={compId} collapsed={true} />
<ScoringFeedPanel compId={compId} collapsed={true} />  {/* NEW */}
{competitionConfig?.vmCredentials && (
  <VMConnectionPanel ... />
)}
```

### HomePage Badge Insertion Point

Insert ScoringFeedBadge at line ~1045 (in the dynamic badge area):
```jsx
<CommentaryStatusBadge compId={compId} />
<ScoringFeedBadge compId={compId} />  {/* NEW */}
```

### Hook Pattern (useScoringFeed)

Follow the same pattern as useThemeErrors:
```javascript
useEffect(() => {
  if (!compId) {
    setFeedState(null);
    setLoading(false);
    return;
  }
  const feedRef = ref(db, `competitions/${compId}/config/scoringFeed`);
  const unsubscribe = onValue(feedRef, (snapshot) => {
    setFeedState(snapshot.val() || defaultState);
    setLoading(false);
  });
  return () => unsubscribe();
}, [compId]);
```

### Panel Color Scheme

Use blue for scoring feed (distinct from green scoreBug):
- Border: `border-blue-500/30`
- Background: `bg-blue-500/10`
- Text: `text-blue-400`

### Badge Color States

| State | Color |
|-------|-------|
| LIVE | `bg-green-500/20 text-green-400 border-green-500/30` |
| OFF | `bg-zinc-700 text-zinc-400` |
| ERROR | `bg-red-500/20 text-red-400 border-red-500/30` |

### Auto-Stop Priority

1. Competition status listener (highest priority — admin action)
2. Virtius session completion (in poll response)
3. Producer timeout (30 minutes of no activity)

### Auto-Stop Implementation Details

**Three triggers:**
1. **Competition status listener** (`_setupCompetitionStatusListener`): Listens to `competitions/{compId}/status`, calls `_autoStop()` on "completed" or "archived"
2. **Meet status check** (`_checkMeetStatus`): Called in `_poll()` after fetch, returns `true` for "completed" or "finished"
3. **Producer timeout** (`_setupProducerTimeoutTimer`): `setInterval` every 60s, checks if `elapsed > PRODUCER_TIMEOUT_MS` (30 min)

**`_autoStop(reason)` flow:**
1. Guard: return if already stopped
2. Log the reason
3. Call `stop()` (which calls `_cleanupAutoStop()`)
4. Write to Firebase: `enabled: false`, `status: 'stopped'`, `errorMessage: 'Auto-stopped: {reason}'`
5. Emit `'autoStopped'` event with `{ compId, reason }`

**Cleanup in `stop()`:**
- `_stopPolling()` — clears poll interval
- `_cleanupConfigListener()` — removes config listener
- `_cleanupAutoStop()` — removes competition status listener + producer timeout timer

### Server Integration Pattern (Task 6)

**Import location:** Line 43 in server/index.js, after playoutEngine import

**Initialization function:** `initializeScoringIngestion()` — scans competitions on startup, listens for config changes

**Socket handlers location:** After playout socket handlers (around line 8330), before disconnect handler

**Socket event naming:** `scoring:start`, `scoring:stop`, `scoring:forceRefresh`, `scoring:getState`, `scoring:resetActivity`

**Event wiring:** `wireScoringServiceEvents(service, compId)` — forwards service events to socket room

**Producer activity reset:** Added to existing `socket.use()` middleware at line 4619

**Initial state emission:** Added after playout state emission (around line 4757)

**Key check for duplicate wiring:** `service.listenerCount('started')` to avoid wiring events twice

## Phase 4 Findings

### Manifest Format — Three Renderer Types

| Manifest `renderer` | Firebase `renderer` | Routed To |
|---------------------|---------------------|-----------|
| `"stage"` | `"stage"` | stage.html |
| `"overlay"` | `"output"` | output.html (iframe to overlays/) |
| `"output"` | `"output"` | output.html (internal render) |

**Critical:** Manifest `"overlay"` maps to Firebase `"output"` — both legacy paths use the same Firebase value. The distinction is maintained by the `file` field in the manifest (present for overlay, absent for output.html graphics).

### graphicsRegistry.js Current State

- **66 graphics** across 8 categories
- Only `"overlay"` and `"output"` renderer values exist today (no `"stage"` yet)
- Helper functions: `getAllGraphics()`, `getGraphicById()`, `getCategories()`, `getCategoryGraphics()`
- `perTeam` expansion at lines 1294-1309 — loop generates team1-*, team2-*, etc.
- `filterGraphicsByCompetition(compId, graphics)` filters by `minTeams`/`maxTeams`

### urlBuilder.js Current State

- **21 switch cases** in `getGraphicUrl()` for URL generation
- **14 builder functions** (e.g., `buildEventBarUrl()`, `buildSponsorsUrl()`)
- Hardcoded URL patterns — will be replaced by manifest-driven `buildUrlFromManifest()`
- Some graphics have special URL params (e.g., `sponsors-cycle` needs `cycleSpeed`, `lockedIndex`)

### UrlGeneratorPage.jsx Sidebar

- **Hardcoded `baseGraphicTitles`** object at lines 54-118
- Sidebar renders from `Object.entries(baseGraphicTitles)`
- Phase 4 replaces with dynamic sidebar from generated registry
- Badge colors: teal for `"stage"`, gray for `"overlay"`/`"output"`

### GraphicsControl.jsx — 7 Set Call Sites (Verified)

| Line | Function | Renderer |
|------|----------|----------|
| 308 | `sendCustomGraphic` | `'output'` |
| 467 | `sendGraphic` | Compute from registry |
| 487 | `sendRotationSlate` | `'output'` |
| 499 | `sendAutoRotationSlate` | `'output'` |
| 558 | `sendEventSummary` | `'output'` |
| 569 | `clearGraphic` | None (both engines clear on `graphic: 'clear'`) |
| 591 | `sendNowCompeting` | `'output'` |

6 already have `renderer` field. The registry-based computation in `sendGraphic()` will use `getGraphicById(graphicId).renderer`.

### timesheetEngine.js — No Renderer Field Yet

`_triggerGraphic()` and `_writeCurrentGraphic()` do NOT include `renderer` field. Phase 4 adds:
```javascript
const firebaseRenderer = manifest?.renderer === 'overlay' ? 'output' : (manifest?.renderer || 'output');
graphicData.renderer = firebaseRenderer;
```

### stage/ Directory Structure

```
stage/
├── skeletons/
│   └── full-screen-card.html
├── blocks/
│   ├── header-bar.js
│   ├── leaderboard-table.js
│   └── athlete-grid.js
├── graphics/           # NEW (manifests go here)
│   ├── stage-engine/   # Stage engine graphics
│   └── legacy/         # Legacy overlay/output manifests
└── stage.html
```

### categories.json Structure

```json
{
  "full-screen-cards": { "label": "Full-Screen Cards", "order": 1, "subcategories": {...} },
  "lower-thirds": { "label": "Lower-Thirds", "order": 2, "subcategories": {...} },
  "full-bleed": { "label": "Full-Bleed", "order": 3, "subcategories": {...} },
  "video-frames": { "label": "Video Frames", "order": 4, "subcategories": {...} },
  "standalone": { "label": "Standalone", "order": 5, "subcategories": {} },
  "event-summary": { "label": "Event Summary", "order": 6, "subcategories": {...} }
}
```

### Build Script Output

Generated registry JSON at `stage/graphics-registry.json`:
- Imported by show-controller build
- Imported by server for timesheet
- Contains all manifest data + computed fields (e.g., expanded perTeam variants)

### resolveTheme() Helper Locations

| Location | API |
|----------|-----|
| `show-controller/src/lib/themeResolver.js` | `import { get, ref } from 'firebase/database'` |
| `server/lib/themeResolver.js` | `db.ref().once('value')` (Admin SDK) |

Both implementations share the same v3.0→v2.0 field mapping and per-graphic override application logic.

### Sidebar Badge Colors

| Renderer | Color | Rationale |
|----------|-------|-----------|
| `stage` | Teal (`bg-teal-500/20 text-teal-400 border-teal-500/30`) | New, modern — stands out |
| `overlay` | Gray (`bg-zinc-700 text-zinc-400`) | Legacy, neutral |
| `output` | Gray (`bg-zinc-700 text-zinc-400`) | Legacy, neutral |

As graphics migrate stage→overlay/output, sidebar becomes progressively more teal.

### Preview Indicator Pattern

Below iframe preview:
```
Rendering via stage.html       [teal text]
https://commentarygraphic.com/stage/stage.html?...
```
or
```
Rendering via overlays/event-bar.html   [gray text]
https://commentarygraphic.com/overlays/event-bar.html?...
```

### themeVars Validation (Build Script)

Each block declares `themeVars: ['--meet-header-bg', '--meet-content-bg', ...]`. The build script:
1. Reads block CSS file
2. Extracts all `--meet-*` variable references
3. Compares against declared `themeVars`
4. Emits WARNING (not error) for undeclared variables

This is a warning-only check because:
- Some variables come from theme-overrides.css cascade
- Missing declaration isn't fatal, just a documentation gap

### Legacy Overlay Count

**30 overlay HTML files** need manifests in `stage/graphics/legacy/`:
- lower-thirds: 9 (event-bar, warm-up, replay, hosts, coaches, team-stats, etc.)
- video-frames: 8 (event-frame, frame-quad, frame-tri-*, etc.)
- full-bleed: 5 (rotation-slate, stream, interview-card, etc.)
- sponsors: 3 (sponsors-thanks, sponsors-cycle, sponsors-bug)
- standalone: 4 (logos, event-calendar, team-bug, clip-player)
- full-screen-cards: 1 (team-roster)

### Legacy Output Count

**~25 output.html graphics** need manifests (including variants):
- leaderboards: 9 (VT, FX, PH, SR, PB, HB, UB, BB, AA)
- combined-aa-leaderboard: 1
- event-summary: ~12 (R1-R6 + per-apparatus variants)
- now-competing: 1
- Additional variants based on gender/format

### npm Script Integration

```json
{
  "scripts": {
    "build:registry": "node scripts/buildGraphicsRegistry.js",
    "prebuild": "npm run build:registry"
  }
}
```

Ensures registry is always regenerated before main build.

### Server Import Pattern

```javascript
// server/index.js or server/lib/timesheetEngine.js
const graphicsRegistry = require('../../stage/graphics-registry.json');

function getManifestById(graphicId) {
  return graphicsRegistry.graphics.find(g => g.id === graphicId);
}
```

### Dependency Order (Critical)

1. **categories.json** — must exist before build script runs
2. **Manifests** — must exist before build script runs
3. **Build script** — generates registry from manifests
4. **Generated registry** — must exist before show-controller build
5. **UI updates** — depend on generated registry being importable

Never skip steps. Build failures cascade.

## Phase 5 Findings

### GraphicsControl.jsx — MISALIGNED CATEGORIES

GraphicsControl uses hardcoded category mapping that does NOT match the registry:

**Current hardcoded mapping (lines 11-17):**
```javascript
const CATEGORY_TO_SECTION = {
  'pre-meet': 'Pre-Meet',
  'in-meet': 'In-Meet',
  'frame-overlays': 'Frame Overlays',
  'stream': 'Stream',
  'sponsors': 'Sponsors',
};
```

**Registry categories:**
- `full-screen-cards`, `lower-thirds`, `full-bleed`, `video-frames`, `standalone`, `event-summary`

This mapping is completely out of sync. Graphics from registry have categories like `full-screen-cards` but GraphicsControl expects `pre-meet`. The entire category system needs replacement.

### GraphicsControl Filter Excludes Most Graphics (line 171)

```javascript
.filter(g => ['pre-meet', 'in-meet', 'frame-overlays', 'stream', 'sponsors'].includes(g.category))
```

This filter **excludes** all registry graphics because they have new category names. Either remove the filter entirely or update it to include all 6 registry categories.

### UrlGeneratorPage Special Category Handlers

Three categories have custom rendering that must NOT be wrapped in CollapsibleSubcategory:

| Category | Lines | Special UI |
|----------|-------|------------|
| `event-summary` | 603-660 | Theme dropdown + grid subcategories |
| `full-bleed` | 664-800 | Rotation slate with layout picker |
| `full-screen-cards` | 803-908 | Combined AA with session ID inputs |

The default category branch (lines 911-959) is where CollapsibleSubcategory should be applied.

### categories.json Subcategory Changes

Two changes needed:
1. **Add** `"coaches": "Coaches"` to `lower-thirds.subcategories`
2. **Rename** `"camera-layouts"` → `"layouts"` in `video-frames.subcategories`

After renaming, update 7 frame manifests that reference `camera-layouts`.

### coaches.json Manifest ID vs Filename

Filename is `coaches.json` but the `id` field is `team-coaches`. Always use the `id` field for lookups, not the filename.

### CollapsibleSubcategory — Icon Import

Use `ChevronRightIcon` from `@heroicons/react/24/outline`. Rotate 90° when expanded:
```css
className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
```

### GraphicsControl Badge Text

GraphicsControl uses abbreviated badge text: `'stg'`, `'ovl'`, `'out'`
UrlGeneratorPage uses full text: `'stage'`, `'overlay'`, `'output'`

They should match. Update GraphicsControl to use full text.

### Gender Filtering Already Works

Gender filtering via `isGraphicAvailable()` in graphicsRegistry.js already works correctly. No changes needed. Just verify it still works after reorganization.

### Subcategory Count for UI

Empty subcategories should not render. Always check:
```javascript
if (subData.graphics.length === 0) return null;
```

### GraphicsControl Special Handlers Location

| Handler | Lines | Condition |
|---------|-------|-----------|
| Rotation Slate | 861-918 | `section === 'In-Meet'` |
| Event Summary | 924-979 | `config.virtiusSessionId` exists |
| Now Competing | 982-1030 | `config.virtiusSessionId` exists |
| Custom Graphics | 1033-1111 | Always renders |

These must be preserved during the reorganization. They don't use the category/subcategory system.

### Build + Verify Cycle

After each manifest or categories.json change:
1. Run `npm run build:registry` (or `npm run build` which runs it via prebuild)
2. Check for errors in console
3. Check generated registry has expected structure

### Skeletons & Blocks Section

Phase 4 added this section. It appears at the bottom of the URL Generator sidebar. Don't break it during reorganization.

## Phase 6 Findings

### File Naming Clarification

**CRITICAL:** The Phase 6 doc incorrectly references `renderer.html` and `renderer/` directory throughout. The actual files are:
- `stage/stage.html` (NOT `renderer/renderer.html`)
- `stage/` directory (NOT `renderer/`)

All URLs should use `stage/stage.html?comp={compId}` pattern.

### output.html Leaderboard CSS Line Numbers (as of 2026-04-01)

Three CSS sections to remove:

1. **Main leaderboard CSS (lines 330-497):**
   - `.leaderboard-table` and all variants
   - `.place-indicator`, `.stick-bonus`, `.apparatus-badge`
   - `.leaderboard-team-logo`, `.leaderboard-medal`
   - Loading/error states

2. **Theme overrides (lines 1207-1326):**
   - `[data-meet-theme] .leaderboard-*` selectors
   - `[data-meet-theme] .graphic-virtuis-leaderboard`
   - Uses `--virtuis-leaderboard-*` CSS variable prefixes

3. **Texture overlay (lines 1624-1641):**
   - `[data-meet-theme] .leaderboard-header::before` pseudo-element

### output.html Leaderboard JS Line Numbers

**REMOVE:**
- `fetchAndRenderLeaderboard()`: lines 8414-8759 (~346 lines)
- `fetchAndRenderCombinedAALeaderboard()`: lines 8762-8922 (~161 lines)
- `'virtius-leaderboard'` renderer: lines 13911-14011 (~101 lines)
- `'combined-aa-leaderboard'` renderer: lines 14013-14065 (~53 lines)

**KEEP (shared helpers):**
- Line 8125: `APPARATUS_FLIGHT_REGEX` — used by apparatus finals
- Lines 8104-8122: `waitForHeadshots()` — used by event-summary, team-stats
- Lines 8129-8159: `getSchoolInfoFromName()` — used by event finals
- Lines 8183-8226: `loadFirebaseTeamLogos()` — used by 15+ graphics
- Lines 8230-8267: `getTeamLogoUrl()` — used by 20+ graphics
- Lines 8276-8284: `getEventLevelLogo()` — used by event graphics

### Routing Logic Summary

**stage.html (lines 596-610):**
```javascript
if (!val || val.renderer !== 'stage') {
  await dismissCurrentGraphic();  // 200ms fade-out
  return;
}
```

**output.html (lines 14246-14255):**
```javascript
if (renderer === 'stage') {
  output.innerHTML = '';
  hideAnimatedBackground();
  if (lastLiveGraphicId && window.themeClearOverrides) {
    window.themeClearOverrides(lastLiveGraphicId);
    lastLiveGraphicId = null;
  }
  return;
}
```

### Exit Animation Timing

- **stage.html:** 200ms fade-out, cubic-bezier(0.16, 1, 0.3, 1)
- **output.html:** Immediate clear (no animation)

This asymmetry is intentional — legacy graphics never had exit animations.

### Error Reporting Path

Stage engine errors go to `competitions/{compId}/production/stageErrors/{timestamp}`:
```json
{
  "type": "block_load_error",
  "graphic": "leaderboard-vt",
  "block": "leaderboard-table",
  "message": "Failed to load block",
  "url": "current page URL",
  "timestamp": "ISO string"
}
```

### overlays/team-roster.html Structure

Total: ~580 lines
- CSS: lines 13-269 (38 CSS variables)
- HTML: lines 271-282 (minimal DOM)
- JS: lines 284-576 (Firebase reads, headshot lookup, rendering)

**Firebase paths read:**
- `teamsDatabase/headshots/` — all headshots
- `competitions/{compId}/config` — team slot info
- `teamsDatabase/teams/{teamKey}/roster` — athlete names

**URL parameters:**
- `compId` — competition ID
- `teamSlot` — which team (1-7)
- `logo` — direct logo URL (preview mode)
- `teamName` — direct name (preview mode)

### URL Migration Table

| Old URL | New URL |
|---------|---------|
| `overlays/team-roster.html?compId={id}&teamSlot=1` | `stage/stage.html?comp={id}&graphic=team-roster-1` |
| `overlays/team-roster.html?compId={id}&teamSlot=2` | `stage/stage.html?comp={id}&graphic=team-roster-2` |
| etc. | etc. |

### Deploy Checklist Addition

Add to CLAUDE.md:
```bash
# Stage engine deploy
tar -czf /tmp/claude/stage.tar.gz stage/
ssh_upload_file localPath=/tmp/claude/stage.tar.gz remotePath=/tmp/stage.tar.gz target=3.87.107.201
ssh_exec command="cd /var/www/commentarygraphic && tar -xzf /tmp/stage.tar.gz && find stage -name '._*' -delete && find stage -type f -exec chmod 644 {} +"
```

### Theme Support Status

**Known limitation:** The new leaderboard-table.css and athlete-grid.css declare `themeVars` but have mostly hardcoded colors. Theme variables are not fully wired yet. Phase 6 verification should document this if colors don't match themed legacy graphics.

### Verification Order

1. Side-by-side visual comparisons FIRST (Tasks 1-10)
2. Routing verification (Tasks 11-15)
3. Production test (Task 16)
4. Code removal ONLY AFTER production passes (Tasks 17-19)
5. Deploy documentation update LAST (Tasks 20-21)
