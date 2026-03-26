# Execution Knowledge

## How theme-loader.js Currently Works

**File:** `overlays/theme-loader.js` (341 lines after Task 1.1)
**Structure:** Top-level `window.themeReady` promise + IIFE with `'use strict'`, runs on DOM ready

### Initialization Flow (Updated Task 1.1)
1. **Lines 22-24:** Create `window.themeReady` synchronously at top level (BEFORE IIFE)
2. **Lines 32-34:** Parse `?meetTheme=` and `?comp=` from URL params via `URLSearchParams`
3. **Lines 46-50:** No-op if no meetTheme AND no comp → resolve immediately with `{ success: true, themeId: null }`
4. **Lines 52-61:** Hardcoded Firebase config object
5. **Lines 67-97:** `loadFirebaseSDK()` — 3-stage check:
   - Already initialized (`firebase.apps.length > 0`) → resolve immediately
   - Firebase object exists but not initialized → call `firebase.initializeApp()`
   - Not loaded → dynamically load from CDN
6. **Lines 105-113:** `getThemeIdFromCompetition(compId)` — NEW: reads `competitions/{compId}/config/meetTheme`
7. **Lines 121-129:** `fetchTheme(themeId)` — `firebase.database().ref('themes/{themeId}').once('value')`
8. **Lines 138-159:** `writeError(type, themeId, message)` — NEW: writes to `production/themeErrors/{timestamp}`
9. **Lines 167-244:** `applyTheme(theme, themeId)` — sets CSS vars, data attributes, logos, branding, textures
   - NEW: stores `window.__themeData = theme` for Phase 3 live-mode override lookups
10. **Lines 250-262:** `injectOverrideStyles()` — dynamically adds `<link>` for `theme-overrides.css`
    - Path detection: `/overlays/` → relative `'theme-overrides.css'`, else `'overlays/theme-overrides.css'`
11. **Lines 268-332:** `init()` — with 3-second timeout wrapper:
    - Sets timeout that resolves with `{ success: false, reason: 'timeout' }` and writes error
    - meetTheme param takes precedence over comp param
    - If comp param and no meetTheme, reads theme from competition config
    - Resolves `window.themeReady` in all code paths
12. **Lines 335-340:** DOM ready handler

### CSS Variables Set (Lines 110-166)
**Colors (v2.0 backward compat + v3.0 names, v3 overwrites v2):**
- `--meet-header-bg` (v2: headerBg/accentSecondary/footerBg, v3: headerBar)
- `--meet-content-bg` (v2: accentPrimary, v3: contentArea)
- `--meet-header-text` (v2: headerText, v3: textOnHeader)
- `--meet-overlay-bg` (v2: overlayBg, v3: bodyBackground)
- `--meet-overlay-text` (v2: overlayText, v3: textOnContent)
- `--meet-border-color` (v2: borderColor, v3: borderDivider)
- `--meet-badge-bg` (v2: badgeBg, v3: badge)
- `--meet-badge-text` (v3 only: badgeText)

**Logos:** `--meet-logo-url`, `data-meet-logo`, `--meet-cause-logo-url`, `data-meet-cause-logo`
**Branding:** `--meet-title`, `--meet-subtitle`
**Texture:** `--meet-texture`, `--meet-texture-opacity`
**Body attribute:** `data-meet-theme` = theme.id || meetThemeId

### Key Facts (Updated Task 1.1)
- **Exports `window.themeReady`** — Promise that resolves when theme is loaded or on timeout/failure
- **Exports `window.__themeData`** — Full theme object for Phase 3 live-mode override lookups
- **28 of 30** overlay HTML files load it (exceptions: `animated-background.html`, `clip-player.html`)
- **3-second timeout** — prevents hangs, resolves with fallback colors
- **Error reporting** — writes to Firebase `production/themeErrors/` when theme fails (only if comp param present)

---

## How output.html's Theme Loading Differs

**File:** `output.html` (~13,740 lines)

### Functions (will be removed in Task 1.9)
- **`applyMeetTheme(theme)`** at line 7327 — duplicates theme-loader.js's `applyTheme()`
- **`loadMeetTheme(themeId)`** at line 7398 — fetches theme, calls `applyMeetTheme()`, returns Promise
- **`themeReadyPromise`** at line 7415:
  - Default: `Promise.resolve()`
  - If `?meetTheme=X` → `loadMeetTheme(X)` (line 7416)
  - If `?comp=Y` → reads config → `loadMeetTheme()` (lines 7418-7430)

### Key Difference
theme-loader.js only supports `?meetTheme=`. output.html ALSO supports `?comp=` by reading Firebase config. **Task 1.1 closes this gap.**

### Two Render Paths
- **Preview mode** (line ~13175): `themeReadyPromise.then(() => { render })` — GATED
- **Live mode** (line ~13197): renders immediately — NOT GATED (Task 1.6 fixes this)

---

## Key Line Numbers in output.html

| What | Line |
|------|------|
| Firebase SDK script tags | 6498-6499 |
| MEET THEME OVERRIDES CSS start | 1070 |
| MEET THEME OVERRIDES CSS end | 1331 |
| `applyMeetTheme()` function | 7327 |
| `loadMeetTheme()` function | 7398 |
| `themeReadyPromise` initialization | 7415 |
| Renderers object start | ~12364 |
| Renderers object end | ~13166 |
| Preview mode render (theme-gated) | ~13175 |
| Live mode `currentGraphic` listener | ~13197 |

**theme-loader.js script tag goes between lines 6499 and 6500** (after Firebase SDK, before main script block).

---

## Key Line Numbers in theme-loader.js

| What | Line |
|------|------|
| URL param parsing | 22-24 |
| Early return if no meetTheme | 27-29 |
| Firebase config | 31-40 |
| `loadFirebaseSDK()` | 46-77 |
| `fetchTheme()` | 84-93 |
| `applyTheme()` | 99-174 |
| Color variable mapping (v2) | 113-121 |
| Color variable mapping (v3) | 123-130 |
| Color application loop | 133-137 |
| Logo application | 142-151 |
| Branding application | 154-161 |
| Texture application | 164-168 |
| `data-meet-theme` body attr | 171 |
| `injectOverrideStyles()` | 179-192 |
| `init()` | 197-219 |
| DOM-ready execution | 222-226 |

---

## Key Line Numbers in theme-overrides.css

| Section | Lines |
|---------|-------|
| Header bars | 26-38 |
| Event bar (`.event-bar-logo`, venue, details) | 45-61 |
| Event frame | 67-77 |
| Stream graphics | 83-103 |
| Rotation slate | 109-121 |
| Team roster | 127-129 |
| Sponsors | 135-142 |
| Coaches | 154-165 |
| Warm-up / Replay | 172-184 |
| Frame overlays | 190-207 |
| Athlete spotlight | 213-220 |
| Logo sizing | 229-255 |
| Logo contrast (white bg `rgba(255,255,255,0.92)`) | 265-278 |
| Generic accent elements | 285-299 |
| Texture overlay setup | 308-320 |
| Texture `::before` pseudo-elements | 322-341 |

**Total:** 342 lines

---

## PlayoutEngine (server/lib/playoutEngine.js)

### Config reads in start() method (lines 290-389)
| Line | Config Path | Variable |
|------|------------|----------|
| 308 | `config/sessionKey` | `this._sessionKey` |
| 320 | `config/virtiusSessionId` | `this._virtiusSessionId` |
| 332 | `config/obsScenes` | `this._obsScenes` |
| 344 | `config/meetTheme` | `this._meetTheme` |
| 364 | `config/clipApiUrl` | `this._clipApiUrl` |

**meetTheme read added at line 344 (Task 1.1b COMPLETE).**

### All _writeCurrentGraphic() calls (all now include meetTheme: this._meetTheme)
| Line | Graphic Type |
|------|-------------|
| 494-498 | `live-camera` (forceCamera) |
| 780-795 | `clip-playback` |
| 811-815 | `fallback` |
| 838-854 | `moment-replay` |
| 887-891 | `live-camera` (priority stack) |
| 925-929 | `fallback` (priority stack) |
| 1462-1471 | `rotation-break` |
| 1628-1637 | content sequence (dynamic) |

### _writeCurrentGraphic() method (lines 992-1005)
Spreads entire graphic object into Firebase at `currentGraphic` path + adds timestamp.

---

## timesheetEngine → currentGraphic Pipeline

**File:** `server/lib/timesheetEngine.js`

- `_triggerGraphic(segment)` at line 863
- Reads config at line 903, extracts `meetTheme: config.meetTheme || ''` at line 916
- Writes to `competitions/${compId}/currentGraphic` at line 1041

---

## Renderers Summary (output.html)

**43 total graphic IDs** in the renderers object.

### Iframe Renderers (10 — load external overlay files)
| Graphic ID | Overlay File |
|---|---|
| `custom` | arbitrary URL |
| `sponsors-thanks` | sponsors-thanks.html |
| `sponsors-cycle` | sponsors-cycle.html |
| `sponsors-bug` | sponsors-bug.html |
| `who-to-watch-title` | who-to-watch-title.html |
| `who-to-watch-lower-third` | who-to-watch.html |
| `event-calendar` | event-calendar.html |
| `rotation-slate` | rotation-slate.html |
| `rotation-slate-auto` | rotation-slate-auto.html |
| `team-roster` | team-roster.html |

### Key Inline Renderers (affected by theme CSS)
`event-bar`, `hosts`, `team{1-7}-stats`, `team{1-7}-coaches`, `event-frame`, `stream-starting`, `stream-thanks`, `warm-up`, `replay`, `event-summary`, `virtius-leaderboard`, `live-camera`

---

## React Components (Theme-Related)

| Component | File | Purpose |
|-----------|------|---------|
| ThemeEditorPage | `show-controller/src/pages/ThemeEditorPage.jsx` | Create/edit themes |
| GraphicsControl | `show-controller/src/components/GraphicsControl.jsx` | Manual graphic triggers, includes meetTheme |
| StatsStatusBadge | `show-controller/src/components/StatsStatusBadge.jsx` | **Reference pattern** for status badge UI |
| AlertPanel | `show-controller/src/components/AlertPanel.jsx` | **Reference pattern** for error log panel |
| useProductionAlerts | `show-controller/src/hooks/useProductionAlerts.js` | **Reference pattern** for Firebase subscription |
| ProducerView | `show-controller/src/views/ProducerView.jsx` | Where ThemeErrorLog badge goes |

---

## Build & Verify Commands

```bash
# Build React SPA
cd show-controller && npm run build

# Local dev server
cd show-controller && npm run dev
# Opens at http://localhost:5173

# Preview a graphic with theme (production)
https://commentarygraphic.com/output.html?graphic=event-bar&meetTheme={themeId}

# Live mode with competition config
https://commentarygraphic.com/output.html?comp={compId}

# Debug panel
https://commentarygraphic.com/output.html?graphic=event-bar&meetTheme={themeId}&debug=theme
```

---

## Gotchas

1. **IIFE → window export:** theme-loader.js exports nothing. Task 1.1 must set `window.themeReady` at the IIFE's top level (synchronously, before any async work) so it's available when output.html's main script runs.

2. **Firebase SDK ordering:** In output.html, Firebase SDK at lines 6498-6499. theme-loader.js must be placed AFTER these tags.

3. **Stylesheet injection path:** theme-loader.js adjusts CSS link href based on pathname. When loaded from output.html (root), uses `'overlays/theme-overrides.css'`.

4. **v2/v3 color field names:** Both supported. v2 applied first, v3 overwrites. Any new code must maintain this.

5. **Logo contrast mismatch:** `.event-bar-logo` in theme-overrides.css (line 45) uses `var(--meet-header-bg)` — WRONG. output.html uses `rgba(255,255,255,0.92)` — CORRECT. Task 0.2 fixes this.

6. **Inline specificity during migration:** Between Tasks 1.5 and 1.9, both inline and external CSS active. Task 1.5 converts inline to variables so both agree. **This ordering is load-bearing.**

7. **output.html is ~13,740 lines.** Always search for exact strings before editing. Line numbers shift after edits.

8. **30 overlay files but only 10 iframe renderers.** The other 20 are loaded directly in OBS browser sources.

9. **`data-meet-theme` is set on `document.body`** (not `documentElement`). All CSS selectors use `[data-meet-theme]` which matches on body.

10. **600ms setTimeout in WTW overlays:** `who-to-watch-title.html` and `who-to-watch.html` use `setTimeout(600ms)` to apply per-card color overrides after theme-loader runs. Task 1.9 replaces this with `window.themeReady.then()`.

11. **PlayoutEngine meetTheme caching:** Task 1.1b reads meetTheme once at `start()`. If theme changes mid-show, restart playout to pick up changes. This is acceptable — theme changes mid-show are rare.

12. **Coordinator deploy requires Firebase credentials:** Always restart with `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json`.

13. **Debug panel (Task 1.7):** Activated via `?debug=theme` URL param. Shows collapsible badge in bottom-right corner with theme status, rendering path (inline vs iframe), graphic ID, all 8 CSS variables with expected/actual comparison, logo attributes, and error messages. The panel is injected via `createDebugPanel()` after theme resolution, or `createEarlyDebugPanel()` for the early-return case when no theme is requested.

14. **Per-graphic override implementation (Task 3.1):** theme-loader.js has two new functions:
    - `detectGraphicId()` — extracts graphic ID from pathname (overlays) or `?graphic=`/`?mode=` params (output.html)
    - `applyOverrides(theme, graphicId)` — sets `--{graphicId}-*` CSS variables from `theme.overrides[graphicId]`
    Both output.html inline CSS and theme-overrides.css must use the 3-layer cascade for overrides to be visible.

---

## Phase 3: Per-Graphic Override Architecture (IMPLEMENTED)

### CSS Variable Cascade (3 layers)

```css
/* Layer 3 (highest): Per-graphic override — set by theme-loader.js from overrides data */
var(--event-bar-header-bg,
  /* Layer 2: Global theme — set by theme-loader.js from theme colors */
  var(--meet-header-bg,
    /* Layer 1 (lowest): Hardcoded fallback */
    #BFBFBF
  )
)
```

### Graphic ID Detection Rules (for theme-loader.js)

| Context | Detection Method | Example |
|---------|-----------------|---------|
| Overlay file | Extract from `window.location.pathname` | `/overlays/sponsors-thanks.html` → `sponsors-thanks` |
| output.html preview | Read `?graphic=` URL param | `?graphic=event-bar` → `event-bar` |
| output.html clip mode | Check `?mode=clip` or `?mode=clip-preview` | → `clip-overlay` |
| output.html live mode | Cannot detect at load time | Handle in `currentGraphic` listener |

### Live Mode Override Strategy

In live mode (`?comp=abc123`, no `?graphic=`), theme-loader.js cannot know the graphic ID at page load because graphics change dynamically via the Firebase `currentGraphic` listener. Strategy:

1. theme-loader.js stores the full theme data on `window.__themeData` (including `overrides` object)
2. In the `currentGraphic` listener (output.html), before rendering:
   - Read the graphic type from `state.graphic`
   - Check `window.__themeData?.overrides?.[graphic]`
   - If overrides exist, set graphic-specific CSS variables on `document.documentElement`
   - Then render
3. This is a small addition to the existing render path (~10 lines)

### Firebase Override Structure

```
themes/{themeId}/overrides/{graphicId}/
  headerBar: "#FF0000"          → --{graphicId}-header-bg
  contentArea: "#FFFFFF"        → --{graphicId}-content-bg
  bodyBackground: "#000"        → --{graphicId}-overlay-bg
  borderDivider: "#333"         → --{graphicId}-border-color
  badge: "#16a34a"              → --{graphicId}-badge-bg
  badgeText: "#fff"             → --{graphicId}-badge-text
  textOnHeader: "#fff"          → --{graphicId}-header-text
  textOnContent: "#000"         → --{graphicId}-overlay-text
  headerBgImage: "https://..."  → --{graphicId}-header-bg-image
  headerBgImageFit: "cover"     → --{graphicId}-header-bg-image-fit
  ...
```

### Image/Texture Implementation

- `background-image` properties added to theme-overrides.css alongside `background-color`
- Default to `none` — no visual change without override
- Texture `::before` pseudo-elements extended to check graphic-specific variables first
- No new pseudo-elements needed — reuse the 11 existing surfaces (lines 322-341)

---

## Phase 4: Theme Editor Extension Points

### ThemeEditorPage Structure (1041 lines)

| Section | Lines | Extension |
|---------|-------|-----------|
| Left column (theme list) | 523-579 | No changes |
| Center column (editor form) | 582-959 | Add "Per-Graphic Overrides" section after sponsors (~line 928) |
| Right column (preview) | 962-1028 | Add competition dropdown + graphic selector in header |

### Key State to Add

```javascript
// Competition preview
const [selectedCompetition, setSelectedCompetition] = useState(null);
const [selectedGraphicType, setSelectedGraphicType] = useState('event-summary');
const [competitions, setCompetitions] = useState([]);

// Per-graphic overrides (nested in editingTheme)
// editingTheme.overrides = { 'event-bar': { headerBar: '#FF0000' }, ... }
```

### Preview URL Generation

Current (line ~435): `output.html?graphic=event-summary&meetTheme={id}`
After Phase 4: `output.html?graphic={selectedGraphic}&comp={selectedCompId}&meetTheme={id}`

### Save Flow

Uses existing `PUT /api/admin/themes/{themeId}` endpoint. The `overrides` field is just another top-level key in the theme object — no backend changes needed.

### Existing Patterns to Follow

- **ValueStepper component** — from WhoToWatchEditor, used for all numeric inputs (stepper with editable field)
- **StatsStatusBadge** — color-coded inline badge pattern
- **AlertPanel** — collapsible panel with grouped items
- **SponsorAdjustControls** — multi-field adjustment panel with live preview

### Clip Preview Mode

`?mode=clip-preview` in output.html renders the clip overlay with sample data. Implementation:
- Reuse existing HTML structure (`#clipOverlay`, `.clip-athlete-panel`, `.clip-score-badge`)
- Set sample data directly in JS (no Firebase fetch)
- Make overlay visible (override display:none)
- Dark background applied to body
- Responds to `--meet-*` CSS variables from theme-loader.js

### Orchestration Sub-Graphic Preview URLs

| Sub-Graphic | Preview URL |
|---|---|
| WTW Title Card | `/overlays/who-to-watch-title.html?meetTheme={id}&athleteName=Sample+Athlete&teamName=Sample+Team&headline=2x+All-American&body=Record+holder&badgeText=WHO+TO+WATCH` |
| WTW Lower Third | `/overlays/who-to-watch.html?meetTheme={id}&athleteName=Sample+Athlete&subtitle=Floor+Exercise&statLabel=Season+High&statValue=9.950` |
| Clip Overlay | `output.html?mode=clip-preview&meetTheme={id}` |
