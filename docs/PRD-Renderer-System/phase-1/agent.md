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
