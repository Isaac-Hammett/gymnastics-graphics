# Execution Knowledge

## How theme-loader.js Currently Works

**File:** `overlays/theme-loader.js` (~1027 lines after Phase 5/6)
**Structure:** Top-level `window.themeReady` promise + IIFE with `'use strict'`, runs on DOM ready

### Initialization Flow
1. **Lines 22-24:** Create `window.themeReady` synchronously at top level (BEFORE IIFE)
2. **Lines 32-34:** Parse `?meetTheme=` and `?comp=` from URL params via `URLSearchParams`
3. **Lines 46-50:** No-op if no meetTheme AND no comp -> resolve immediately
4. **Lines 52-61:** Hardcoded Firebase config object
5. **Lines 67-97:** `loadFirebaseSDK()` — 3-stage check (already init'd / exists / CDN load)
6. **Lines 105-113:** `getThemeIdFromCompetition(compId)` — reads `competitions/{compId}/config/meetTheme`
7. **Lines 121-129:** `fetchTheme(themeId)` — `firebase.database().ref('themes/{themeId}').once('value')`
8. **Lines 138-159:** `writeError(type, themeId, message)` — writes to `production/themeErrors/{timestamp}`
9. **Lines 167-244:** `applyTheme(theme, themeId)` — sets CSS vars, data attributes, logos, branding, textures
   - Stores `window.__themeData = theme` (line 398)
10. **Lines 250-262:** `injectOverrideStyles()` — dynamically adds `<link>` for `theme-overrides.css`
11. **Lines 268-332:** `init()` — with 3-second timeout wrapper
12. **Lines 335-340:** DOM ready handler

### applyOverrides() — CRITICAL FOR PHASE 8A

**Location:** Lines 438-571 (inside IIFE, NOT exported)
**Signature:** `function applyOverrides(theme, graphicId)`

Called internally at line 997 during initial theme load for overlay files.

**Mapping Objects (all function-local to applyOverrides, lines 459-548):**

`overrideMapping` (lines 459-468) — 8 color suffixes:
- headerBar -> header-bg, contentArea -> content-bg, bodyBackground -> overlay-bg
- borderDivider -> border-color, badge -> badge-bg, badgeText -> badge-text
- textOnHeader -> header-text, textOnContent -> overlay-text

`imageOverrideMapping` (lines 481-499) — 13 image suffixes:
- headerBgImage -> header-bg-image, headerBgImageFit/Position/Opacity
- bodyBgImage -> body-bg-image, bodyBgImageFit/Position/Opacity
- bodyTexture -> body-texture, bodyTextureOpacity, bodyTextureBlend
- logo -> logo-url, logoSize -> logo-size

`layoutOverrideMapping` (lines 524-548) — 19 layout suffixes:
- barBottom, barLeft, logoImgSize, logoContainerWidth/Height, logoBg, logoPadding, logoRadius
- showLogo, venueFontSize, venueHeight, venuePaddingV/H, barMinWidth
- nameFontSize, locationFontSize, detailsHeight, detailsPaddingV/H

**Phase 8A must:**
1. Move all 3 mapping objects to IIFE module scope (above `applyOverrides()`)
2. Export `applyOverrides()` as `window.themeApplyOverrides`
3. Create and export `clearOverrides(graphicId)` as `window.themeClearOverrides`
4. `clearOverrides` iterates all 40 suffixes and calls `removeProperty('--' + graphicId + '-' + suffix)`

### Window Exports (current)
- `window.themeReady` (line 24) — Promise
- `window.__themeData` (line 398) — Full theme object

### CSS Variables Set
**Colors (8):** `--meet-header-bg`, `--meet-content-bg`, `--meet-header-text`, `--meet-overlay-bg`, `--meet-overlay-text`, `--meet-border-color`, `--meet-badge-bg`, `--meet-badge-text`
**Logos:** `--meet-logo-url`, `data-meet-logo`, `--meet-cause-logo-url`, `data-meet-cause-logo`
**Branding:** `--meet-title`, `--meet-subtitle`
**Texture:** `--meet-texture`, `--meet-texture-opacity`
**Body attr:** `data-meet-theme`

---

## output.html — currentGraphic Listener

**File:** `output.html` (~13,740 lines)

### currentGraphic Firebase Listener (lines 13298-13389)

```
db.ref(`competitions/${competitionId}/currentGraphic`).on('value', (snapshot) => {
```

**Flow:**
1. Lines 13302-13310: If state is null, clear output. In clip mode, stop clip playback.
2. Lines 13313-13316: Extract `graphic` and `data`. Increment render counter for "last one wins".
3. Lines 13318-13325: Gate on `themeReadyPromise` to prevent FOUC. Skip stale renders.
4. Lines 13327-13387: Three rendering branches:
   - **Clip mode** (13331-13344): Clip types -> `handleClipPlayback()`; others clear
   - **Live mode + WTW clips** (13347-13371): WTW renders as iframe; others clear
   - **Live mode + regular** (13372-13386): `output.innerHTML = renderers[graphic](data)`

**NO `lastLiveGraphicId` variable exists yet** — Phase 8A Task 8.2 adds it.
**NO `applyOverrides()` calls in the listener** — Phase 8A Task 8.2 adds them.

### Google Fonts (line 7)
Currently: `Inter:wght@400;500;600;700;800;900` only.
Phase 7.FONT.1 extends to: Inter, Inter Tight, Roboto Mono, JetBrains Mono, Poppins.

### Key Line Numbers

| What | Line |
|------|------|
| Google Fonts import | 7 |
| MEET THEME OVERRIDES CSS start | 1070 |
| MEET THEME OVERRIDES CSS end | 1331 |
| Event-summary base CSS | 496-839 |
| Event-summary layout variants | 1348-5808 |
| Now-competing CSS | 6014-6093 |
| Event-frame overlay CSS | 6096-6195 |
| Clip overlay CSS | 6243-6424 |
| Clip overlay HTML | 6509-6523 |
| Live-camera CSS | 6430-6493 |
| Firebase SDK script tags | 6498-6499 |
| `applyMeetTheme()` function | 7327 |
| `loadMeetTheme()` function | 7398 |
| `themeReadyPromise` initialization | 7415 |
| Renderers object start | ~12364 |
| Logos renderer | 12424-12444 |
| Team-coaches renderers | 12491-12687 |
| Stream renderers | 12751-12769 |
| Leaderboard renderer | 13057-13145 |
| currentGraphic listener | 13298-13389 |

### Clip Mode Detection (lines 6539-6541)
```javascript
const outputMode = urlParams.get('mode') || 'live';
const isClipMode = outputMode === 'clip' || outputMode === 'preview';
const isClipPreviewMode = outputMode === 'clip-preview';
```

### Inline vs Iframe Graphics

**Iframe renderers (10):** custom, sponsors-thanks, sponsors-cycle, sponsors-bug, who-to-watch-title, who-to-watch-lower-third, event-calendar, rotation-slate, rotation-slate-auto, team-roster
- All pass `meetTheme` as URL param from `data.meetTheme`
- Theme overrides applied by theme-loader.js inside the iframe

**Inline renderers (33+):** event-bar, hosts, team{1-7}-stats, team{1-7}-coaches, event-frame, stream-starting, stream-thanks, warm-up, replay, event-summary, virtuis-leaderboard, live-camera, logos, now-competing, etc.
- Depend on CSS variables set on `document.documentElement`
- Phase 8A makes per-graphic overrides work here

---

## ThemeEditorPage.jsx Structure

**File:** `show-controller/src/pages/ThemeEditorPage.jsx` (2,937 lines)

### Constants & Definitions (lines 1-430)

| Constant | Lines | Purpose |
|----------|-------|---------|
| `LOWER_THIRD_GRAPHICS` | 9 | `['event-bar', 'warm-up', 'replay']` |
| `LOWER_THIRD_DEFAULTS` | 11-30 | Default position, logo, venue, details sizing |
| `getEffectiveVenueHeight()` etc. | 34-55 | Height calculators |
| `OVERRIDE_GRAPHIC_GROUPS` | 57-86 | 7 categories for override panels |
| `OVERRIDE_COLOR_FIELDS` | 89-98 | 8 color override properties |
| `IMAGE_FIT_OPTIONS` etc. | 100-121 | Dropdown options |
| `OverrideStepper` | 127-175 | Reusable `- [input] +` stepper component |
| `GRAPHIC_GROUPS` | 177-235 | 7 categories for preview selector |
| `PRESET_THEMES` | 245-305 | Hardcoded theme templates |
| `DEFAULT_THEME` | 306-328 | Default theme structure |
| Utility functions | 330-428 | Color extraction, contrast, darken |

### Template System (lines 470-502)

`applyLowerThirdTemplate()` (lines 471-487):
- Reads all fields from `editingTheme.lowerThirdTemplate`
- Filters out undefined/null/empty values
- Applies to all 3 `LOWER_THIRD_GRAPHICS`
- Updates `editingTheme.overrides[graphicId]` for each

Helper functions:
- `updateTemplateField(key, value)` — line 489
- `clearTemplateField(key)` — line 496

**New category templates follow this exact pattern** — create constant for graphics list, create defaults, create apply function, create UI panel.

### Measurement System (lines 508-553)

- `previewIframeRef` (line 508)
- `measuredHeights` state (line 509)
- `MEASUREMENT_SELECTORS` (lines 512-516) — currently event-bar, warm-up, replay only
- Message handler (lines 519-530): listens for `heightMeasurements` postMessage
- `requestMeasurements()` (lines 533-548): sends `measureHeights` to iframe, 1500ms delay
- `getMeasuredHeight(graphicId, element)` (lines 551-553)

**Phase 7 extends `MEASUREMENT_SELECTORS`** with entries for each new graphic category.

### Override Panels UI (lines 1790-2717)

- Lines 1791-2716: `.map()` over `OVERRIDE_GRAPHIC_GROUPS`
- Lines 1798-1923: Lower-Third Template panel (teal border, special section)
- Lines 1925-2715: Per-graphic collapsible panels
  - Lines 1932-1954: Header with graphic name + override count badge
  - Lines 1957-2392: Rich controls for lower-thirds (position, logo, venue, text, images)
  - Lines 2394-2707: Generic controls for other graphics (colors, logo, images, textures)

**Key handlers:**
- `updateOverrideField(graphicId, fieldKey, value)` — line 672
- `clearOverrideField(graphicId, fieldKey)` — line 685
- `resetGraphicOverrides(graphicId)` — line 704
- `toggleOverridePanel(graphicId)` — line 721
- `countGraphicOverrides(graphicId)` — line 714

### Preview Selectors (lines 2777-2820)

- Graphic type: `<select>` with optgroups by category (7 groups)
- Competition: `<select>` with recent competitions sorted by date

### Where to Add New Category Panels

1. Add graphics constant (e.g., `FULL_SCREEN_GRAPHICS`) near line 9
2. Add defaults constant near line 11
3. Add apply function near line 471
4. Add template fields near line 489
5. Add measurement selectors near line 512
6. Rich panel UI: extend the conditional inside the `.map()` at ~line 1957 to handle new graphics with category-specific sections

### Font Metadata Location

Phase 7.FONT.3 adds `FONT_FAMILIES`, `FONT_WEIGHTS`, `TEXT_TRANSFORMS` constants near line 121 (after image/fit option constants).

---

## CSS Conversion Targets by Graphic

### Phase 7A: Full-Screen Graphics

| Graphic | File | CSS Lines | Values | Notes |
|---------|------|-----------|--------|-------|
| event-summary | output.html | 496-839, 1348-5808 | ~22 base + per-layout | 28 layout variants, tabular-nums required |
| virtuis-leaderboard | output.html | 281-467 | ~60 | Medal gradients, color-mix rows |
| event-frame | output.html + overlays/frame-*.html | 249-278, 6096-6195 | 42 across 5 variants | Currently uses Arial |
| sponsors-thanks | overlays/sponsors-thanks.html | ~200 lines | ~40 | Grid by count (1-8), preview bug |
| team-roster | overlays/team-roster.html | ~250 lines | 60+ | 6 responsive tiers by athlete count |

### Phase 7B: Team Cards

| Graphic | File | CSS Lines | Values |
|---------|------|-----------|--------|
| team-stats | output.html | ~170-210, 12416+ | 24 |
| team-coaches | output.html | ~215-245, 12491-12687 | 17 |

### Phase 7C: Sponsors

| Graphic | File | Values | Notes |
|---------|------|--------|-------|
| sponsors-cycle | overlays/sponsors-cycle.html | 55+ | Canvas-based, timing via Firebase NOT theme |
| sponsors-bug | overlays/sponsors-bug.html | 9 | Small overlay, 10s cycle |

### Phase 7D: Stream

| Graphic | File | Values | Notes |
|---------|------|--------|-------|
| stream-starting | output.html ~12751 | 44 shared | "undefined" preview bug |
| stream-thanks | output.html ~12769 | shared | Same CSS as stream-starting |

### Phase 7E: Overlays + OBS-Direct

| Graphic | File | Values | Notes |
|---------|------|--------|-------|
| rotation-slate | overlays/rotation-slate.html | many | 12+ layout variants |
| rotation-slate-auto | overlays/rotation-slate-auto.html | same | Same layouts, auto-update |
| logos | output.html ~12424 | 22 | Per-count sizing |
| now-competing | output.html 6014-6093 | 36 | Animated, status badge |
| live-camera | output.html 6430-6493 | 23 | Partially themed already |
| interview-card | overlays/interview-card.html | 32 | Poppins font, 7 animations |
| athlete-spotlight | overlays/athlete-spotlight.html | 31 | Lower-third pattern |
| event-calendar | overlays/event-calendar.html | 30+ | 4 responsive tiers |
| team-bug | overlays/team-bug.html | 100+ | Colors/typography only, preserve state logic |
| hosts | overlays/hosts.html | 14 | Missing --meet-content-bg |
| coaches | overlays/coaches.html | 14 | Already has 4 theme vars |

### Phase 7F: Playout / WTW

| Graphic | File | Values | Notes |
|---------|------|--------|-------|
| who-to-watch-title | overlays/who-to-watch-title.html | many | 4 image modes, URL param controls |
| who-to-watch (lower-third) | overlays/who-to-watch.html | many | Iframe with data params |
| clip-overlay | output.html 6243-6424 | 62 | Inline, graphic ID = clip-overlay |

---

## Font Loading Current State

| File | Font | Weights |
|------|------|---------|
| output.html (line 7) | Inter | 400-900 |
| 18 overlay files | Inter | Various subsets (700-900 most common) |
| interview-card.html | Poppins | 400-900 |
| sponsors-cycle.html | System fonts | N/A |
| sponsors-bug.html | None imported | N/A |
| frame-*.html (7 files) | Arial (hardcoded) | N/A |

**Phase 7.FONT target:** Inter + Inter Tight + Roboto Mono + JetBrains Mono + Poppins everywhere.

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

# Clip preview mode (Theme Editor)
https://commentarygraphic.com/output.html?mode=clip-preview&meetTheme={themeId}

# Overlay previews
https://commentarygraphic.com/overlays/interview-card.html?meetTheme={themeId}&title=Coaches+Corner&name=Test+Coach
https://commentarygraphic.com/overlays/who-to-watch-title.html?meetTheme={themeId}&athleteName=Sample+Athlete
https://commentarygraphic.com/overlays/sponsors-thanks.html?meetTheme={themeId}
```

---

## Gotchas

1. **IIFE -> window export:** theme-loader.js exports only `window.themeReady` and `window.__themeData`. Phase 8A adds `window.themeApplyOverrides` and `window.themeClearOverrides`.

2. **Firebase SDK ordering:** In output.html, Firebase SDK at lines 6498-6499. theme-loader.js must be placed AFTER these tags.

3. **Stylesheet injection path:** theme-loader.js adjusts CSS link href based on pathname. When loaded from output.html (root), uses `'overlays/theme-overrides.css'`.

4. **v2/v3 color field names:** Both supported. v2 applied first, v3 overwrites. Any new code must maintain this.

5. **output.html is ~13,740 lines.** Always search for exact strings before editing. Line numbers shift after edits.

6. **30 overlay files but only 10 iframe renderers.** The other 20 are loaded directly in OBS browser sources.

7. **`data-meet-theme` is set on `document.body`** (not `documentElement`). All CSS selectors use `[data-meet-theme]`.

8. **600ms setTimeout in WTW overlays:** `who-to-watch-title.html` and `who-to-watch.html` use `setTimeout(600ms)` to apply per-card color overrides after theme-loader runs.

9. **PlayoutEngine meetTheme caching:** Reads meetTheme once at `start()`. Theme changes mid-show require playout restart.

10. **Coordinator deploy requires Firebase credentials:** Always restart with `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json`.

11. **Debug panel:** Activated via `?debug=theme` URL param. Shows theme status, CSS variables, override layers.

12. **applyOverrides() exported as window.themeApplyOverrides:** Task 8.1 moved the 3 mapping objects to IIFE module scope and exported the function. Call `window.themeApplyOverrides(window.__themeData, graphicId)` to apply overrides.

13. **clearOverrides() exported as window.themeClearOverrides:** Task 8.1 created this function. Call `window.themeClearOverrides(graphicId)` to remove all per-graphic CSS variables for that graphic.

14. **lastLiveGraphicId tracking in output.html:** Task 8.2 added this. The `currentGraphic` listener clears previous graphic's overrides before applying new ones.

15. **team-bug state colors are NOT overridable.** Green (#22c55e stick), amber (#f59e0b correction), cyan (#22d3ee pulse) are functional status indicators — leave them hardcoded.

16. **showLogo accepts three falsy forms:** `false` (boolean), `"false"` (string), or `"none"` (string) — all map to CSS display: none. Fixed in Task 8.5.

17. **sponsors-cycle timing is NOT a theme control.** Cycle timing (3000ms) is controlled via Firebase config + URL Generator, not per-graphic overrides.

17. **event-summary uses color-mix().** `color-mix(in srgb, var(--meet-overlay-bg) 80%, white)` for alternating rows. Must preserve this when converting to CSS variables.

18. **tabular-nums required on ALL score elements.** Currently only 7 instances. Phase 7 must add `font-variant-numeric: tabular-nums` to all score displays across all graphics.

19. **ThemeEditorPage is 2,937 lines.** Use exact search strings when editing. The `.map()` over `OVERRIDE_GRAPHIC_GROUPS` at line 1791 is the main extension point for new category panels.

20. **3-layer CSS cascade required for ALL per-graphic overrides.** BUG-8.4.1 revealed that just setting CSS variables via JS is not enough — the CSS selectors must use `var(--{graphicId}-{suffix}, var(--meet-{suffix}, fallback))`. As of Task 8.4 fix, warm-up, replay, event-bar details, and team-stats all have this pattern. New graphics need the same.

21. **team-stats CSS cascade chains 7 variants.** Because team1-stats through team7-stats share the same `.stats-header` selector, the CSS uses a deeply nested var() chain: `var(--team1-stats-header-bg, var(--team2-stats-header-bg, ... var(--meet-header-bg, fallback)))`.

22. **FULL_SCREEN_GRAPHICS constant.** Task 7A.8 added this at line ~12 with 5 graphics: event-summary, virtuis-leaderboard, event-frame, sponsors-thanks, team-roster. The constant is used in the 3-way conditional in the panel rendering.

23. **FULL_SCREEN_DEFAULTS constant.** Task 7A.8 added this at line ~34 with defaults for all 5 full-screen graphics. Each graphic has its own section with property defaults matching theme-loader.js layoutOverrideMapping.

24. **3-way conditional for override panels.** Task 7A.8 changed the panel rendering from 2-way (`LOWER_THIRD ? rich : generic`) to 3-way (`LOWER_THIRD ? rich : FULL_SCREEN ? rich : generic`). The structure is at line ~2150 in ThemeEditorPage.jsx.

25. **ThemeEditorPage now ~3,450 lines.** Task 7A.8 added ~500 lines for full-screen controls. Exact line numbers shift with each edit — use exact search strings.

---

## Learnings from Phases 0-6

1. **Firebase subscriptions must be cleaned up** in useEffect return functions to prevent memory leaks.
2. **Theme testing requires a real theme in Firebase** — create test themes with distinct colors.
3. **Override implementation follows 3-layer CSS cascade** — never bypass.
4. **Save-then-preview flow:** Save writes to Firebase, 500ms delay, iframe reloads. No live-as-you-type.
5. **OverrideStepper component** (lines 127-175) is the standard numeric input pattern.
6. **Template key filtering** prevents inapplicable keys from being set on graphics that don't support them.
7. **Pixel-perfect measurements** use postMessage to iframe, not computed estimates.
8. **Height display convention:** Show computed effective height when no explicit override set (fontSize * 1.2 + paddingV * 2).
9. **Deploy every task:** Never batch deploys separately from code tasks (feedback memory).
10. **Screenshot verification required:** Always take Playwright screenshots to verify, no code-review-only verification (feedback memory).
11. **Category template pattern:** To add a new template (Full-Screen, Team Cards, etc.), add state (`showXxxTemplatePanel`, `showApplyXxxTemplateConfirm`), create `applyXxxTemplate()` with key filtering for graphic-specific properties, add `updateXxxTemplateField()` and `clearXxxTemplateField()` helpers, add UI panel with teal border inside the OVERRIDE_GRAPHIC_GROUPS `.map()` conditional on `group.label`.
12. **Stat display override pattern (Task 7B.3):** To add behavioral overrides (not just CSS), create a helper function in output.html that reads from `window.__themeData.overrides[graphicId]`, then call it from renderers. The helper should check both the specific graphic ID (team1-stats) AND the generic graphic ID (team-stats) for fallback.
13. **team{N}Nqs field:** NQS (National Qualifying Score) data is available at `data.team{N}Nqs`. This is populated by the RTN stats system from the RQS field. Only ranked teams have NQS values.
14. **isTeamStatsGraphic helper:** Use regex `/^team[1-7]-stats$/` to match team1-stats through team7-stats, plus exact match for `team-stats`.

15. **isTeamCardGraphic helper (Task 7B.4):** Matches both team-stats and team-coaches variants. Use `/^team[1-7]-stats$/` OR `/^team[1-7]-coaches$/` OR exact match for `team-stats` or `team-coaches`.

16. **4-way conditional for override panels:** The panel rendering is now 4-way: LOWER_THIRD_GRAPHICS -> FULL_SCREEN_GRAPHICS -> isTeamCardGraphic -> GENERIC. Each branch has its own rich controls tailored to that graphic category.

17. **TEAM_CARD_DEFAULTS constant:** Contains defaults for team-stats (17 props) and team-coaches (15 props). Properties use prefixes `stats*` and `coaches*` to match the theme-loader.js layoutOverrideMapping keys.

18. **ThemeEditorPage now ~4,200 lines:** Task 7B.4 added ~450 lines for team card rich controls. Line numbers shift with each edit — always use exact search strings.
