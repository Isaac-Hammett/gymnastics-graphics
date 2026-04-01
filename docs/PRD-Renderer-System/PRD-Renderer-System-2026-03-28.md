# PRD: Renderer System — Component-Based Graphics Architecture

**Date:** 2026-03-28
**Status:** Draft (reviewed, decisions locked)
**Scope:** Full-screen card graphics (leaderboard, roster) + foundation for all graphic types
**Future:** Lower-thirds, full-bleed, video frames, AI-generated graphics, visual editor

---

## Problem

The graphics system has two separate rendering codebases that do the same thing:

1. **`output.html`** — a monolithic file containing leaderboards, event-summary, logos, team-stats, coaches, and more. Graphics switch by showing/hiding divs via Firebase.
2. **`overlays/*.html`** — standalone HTML files (roster, sponsors-thanks, event-frame, interview-card, who-to-watch, etc.) loaded as iframes or browser sources.

This causes:
- **Visual inconsistency** — the same type of graphic (e.g., full-screen card) looks different depending on which codebase built it. The roster has rounded corners, overflow hidden, and a card wrapper. The leaderboard has no card wrapper — just raw rectangles.
- **Duplicate maintenance** — theme CSS targets both systems separately. Skeleton changes require editing multiple files.
- **No shared structure** — every graphic reinvents its own container, header, and content area with different class names, different padding, different font stacks.
- **No path to dynamic graphics** — the AI can't compose a new graphic at runtime because structure, layout, and data are all baked into static HTML files.

---

## Solution

A new **component-based stage engine** (`stage.html`) that assembles graphics from two layers:

```
┌──────────────────────────────────────────┐
│  Skeleton  (full-screen-card)            │  ← The frame: shape, corners, shadow, positioning
│  ┌────────────────────────────────────┐  │
│  │  Block: header-bar                 │  │  ← Everything inside is a block
│  ├────────────────────────────────────┤  │
│  │  Block: leaderboard-table          │  │     Layout controls arrangement:
│  │                                    │  │     - default: vertical stack
│  │  ┌──────────────────────────────┐  │  │     - columns: side by side
│  │  │  Block (full width)          │  │  │     - rows + columns: mixed
│  │  ├──────────────┬───────────────┤  │  │     - nestable for any combo
│  │  │  Block (50%) │  Block (50%)  │  │  │
│  │  └──────────────┴───────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Two layers:**
1. **Skeleton** — the reusable frame for a graphic category (full-screen-card, lower-third, full-bleed). Defines **only** the outer container: card shape, rounded corners, overflow, shadow, positioning on the 1920x1080 canvas. The skeleton has no opinion about what goes inside it — that's all blocks.
2. **Blocks** — modular pieces that are placed inside the skeleton (header-bar, leaderboard-table, athlete-grid, stat-row, etc.). Each block is self-contained with its own rendering logic and styles. **Everything is a block** — including headers. A graphic with a header uses a header-bar block. A graphic without a header just doesn't include one. A graphic can use **one or many blocks** in any arrangement.

A **render spec** is the JSON instruction that tells the stage engine which skeleton to use, which blocks to place inside it, how to arrange them, and what data to display.

---

## Key Architecture Decisions

These decisions were made during PRD review and are locked.

### 1. Same `currentGraphic` Firebase Path

stage.html and output.html **share the same Firebase listener** at `competitions/{compId}/currentGraphic`. This avoids rewiring the rundown system, web graphics panel, and playout engine.

**Routing via `renderer` field:** When a graphic is triggered, the show controller writes a `renderer` field in the data:

```json
// Stage engine graphic (roster, leaderboard)
{ "graphic": "team-roster", "renderer": "stage", "data": { "teamSlot": 1 } }

// Output.html graphic (event-bar, event-summary)
{ "graphic": "event-bar", "renderer": "output", "data": { ... } }

// Clear all
null
```

**Firebase `renderer` field uses only two values: `"stage"` or `"output"`.** The graphicsRegistry.js has three values for its `renderer` field (`'overlay'`, `'output'`, `'stage'`), but the `'overlay'` value is metadata about where the source HTML file lives — it does not affect Firebase routing. When writing to `currentGraphic`, the show controller maps registry `'overlay'` → Firebase `"output"`:

```javascript
const entry = GRAPHICS[graphicId];
const firebaseRenderer = entry.renderer === 'stage' ? 'stage' : 'output';
```

**Both pages listen to the same path.** Each checks the `renderer` field:
- **stage.html** sees `renderer: "stage"` → renders the graphic
- **stage.html** sees `renderer: "output"` or `undefined` → clears its display
- **output.html** sees `renderer: "stage"` → clears its display (exits current graphic)
- **output.html** sees `renderer: "output"` or `undefined` → renders the graphic (backwards-compatible with existing specs that lack the field)
- Writing `null` clears both

This ensures **no two graphics are ever on screen at once**, even across different HTML files. The show controller already knows which renderer to use from the `renderer` field in graphicsRegistry.js.

### 2. Firebase-First Data (Single Source of Truth)

**All data flows through Firebase.** Graphics never call external APIs directly.

**Current flow (problematic):**
```
Virtius API ──fetch──→ output.html (renders directly)
Firebase ──listen──→ output.html (headshots, logos, config)
```

**New flow:**
```
Virtius API ──poll──→ Coordinator Server ──write──→ Firebase
Firebase ──listen──→ stage.html (ALL data from one place)
```

**Why:** Single source of truth for all graphic data. If a graphic looks wrong, the data issue is always in Firebase — never a question of "is the API returning bad data" vs "is the stage engine parsing it wrong." Simplifies debugging and makes blocks simpler (they just bind to Firebase paths).

**Scoring data path:** `competitions/{compId}/scoring/`

The coordinator server polls the Virtius API and writes processed, graphic-ready data:

| Firebase Path | Content |
|---------------|---------|
| `scoring/leaderboard/{apparatus}` | Sorted athlete scores for each apparatus (VT, FX, PH, SR, PB, HB, UB, BB) |
| `scoring/teamTotals` | Running team scores |
| `scoring/rotationState` | Current rotation number, which teams are on which apparatus |
| `scoring/allAround` | All-around rankings |

Blocks use `.on('value')` listeners on these paths and re-render when data changes. Live updates flow automatically.

**Write strategy:** The ingestion service uses `.update()` on individual subpaths (e.g., `scoring/leaderboard/VT`, `scoring/teamTotals`) rather than `.set()` on the entire `scoring/` tree. This prevents wiping sibling data if future features write to other subpaths under `scoring/`.

**Gender dependency:** The ingestion service reads competition gender from `competitions/{compId}/config/gender` (`"mens"` or `"womens"`). Gender determines: (1) which apparatus to process — 4 for women (VT, UB, BB, FX), 6 for men (FX, PH, SR, VT, PB, HB), and (2) which data fields to include — men's leaderboards include difficulty, execution, and stick bonus columns; women's do not. The leaderboard block also uses gender to control column rendering on the client side.

**Existing Firebase data (unchanged):**
- `teamsDatabase/headshots` — athlete headshot images
- `teamsDatabase/teams` — team logos, rosters, school info
- `teamsDatabase/stats` — RTN stats (season highs, averages, etc.)
- `competitions/{compId}/config` — competition configuration

### 3. Scoring Feed Controls

The Virtius polling service needs manual controls to prevent runaway API calls after a competition ends.

**Competition Card (Home Page):**
- Status badge next to existing buttons: "LIVE" (green, pulsing) when polling, "OFF" (gray) when stopped
- Click to toggle on/off
- Shows poll interval: "LIVE · 15s"

**Producer View (Inside a Show):**
- "Scoring Feed" panel in sidebar
- On/Off toggle — kill switch
- Interval selector — 5s, 10s, 15s, 30s, 60s
- Last poll timestamp — "Last updated: 2s ago"
- Status — "Connected," "Polling," "Error: 404," etc.
- Manual refresh button — force immediate poll

**Firebase Config:**
```
competitions/{compId}/config/scoringFeed/
  enabled: true|false
  pollInterval: 15              // seconds
  lastPollAt: "2026-03-28T..."  // ISO timestamp
  status: "ok"|"error"
  errorMessage: "..."           // if status is error
```

**Auto-Stop Safety Nets:**
- Competition `status` set to "completed" or "archived" → stop polling
- Virtius session returns "completed" status → stop polling
- No producer connected for 30+ minutes (no active socket connections) → stop polling

**Multi-Competition:** The coordinator polls ALL active competitions simultaneously. Three live meets = three independent polling loops, each with their own interval and on/off state.

### 4. Single Persistent Browser Source (OBS Model)

stage.html works like output.html — **one browser source per competition** that swaps graphics via Firebase.

**OBS setup during migration (two browser sources):**
- `output.html?comp={compId}` — handles non-migrated graphics
- `stage.html?comp={compId}` — handles migrated graphics

**Standalone browser sources** (for specific graphics grabbed from URL Generator):
- `stage.html?comp={compId}&graphic=sponsors-thanks`

**Web Graphics Panel copyable URLs:**

| Button | URL |
|--------|-----|
| Copy Output URL (legacy) | `https://commentarygraphic.com/output.html?comp={compId}` |
| Copy Stage URL | `https://commentarygraphic.com/stage.html?comp={compId}` |

stage.html does **not** use `theme-loader.js` or `?meetTheme=` URL params. Theme data is fully baked into the render spec at trigger time (see Architecture Decision 10: Self-Contained Theme Data). Standalone browser sources receive theme data the same way — the show controller resolves the theme and includes it in the spec.

After full migration, output.html URLs go away and only stage.html URLs remain.

### 5. Pre-Load + Animate Pattern (1 Second Max)

Graphics render hidden first, then animate in when ready. No graphic should take longer than **1 second** to appear.

**Sequence:**
1. `t=0ms` — Spec arrives via Firebase. Stage engine loads skeleton + blocks, renders DOM with `opacity: 0`.
2. `t=0-1000ms` — Wait for images, fonts, layout to settle. If everything loads early (e.g., text-only leaderboard at 200ms), animate in immediately.
3. `t=1000ms` — **Hard cutoff.** Animate in with whatever's ready. Late-loading images will pop in after animation.

**Dismiss sequence:**
1. `null` or new spec written to Firebase → play exit animations on all blocks
2. Exit animations complete → clear DOM
3. If new spec arrived (not null), begin loading the new graphic

Uses `requestAnimationFrame` + image `onload` promises to detect render completion. Fallback placeholder styling for images that haven't loaded by the 1-second cutoff.

### 6. Block CSS Scoping

All blocks load into the same stage.html page. CSS class collisions are prevented by **prefixing all CSS classes with the block name.**

Each block's JavaScript wraps its content in `<div class="block-{blockName}">`. All block CSS is scoped under that wrapper:

```css
/* header-bar block */
.block-header-bar { ... }
.block-header-bar .title { ... }
.block-header-bar .logo { ... }

/* leaderboard-table block */
.block-leaderboard-table { ... }
.block-leaderboard-table .rank { ... }
.block-leaderboard-table .score { ... }
```

**Theme integration:** CSS variables are set on the **skeleton container** (not `:root`) from the render spec's `theme` object. Blocks reference theme variables in their scoped CSS:

```css
.block-header-bar {
  background: var(--header-bar-bg, var(--meet-header-bg, #d4d4d8));
  color: var(--header-bar-text, var(--meet-header-text, #000));
}
```

Because CSS variables cascade down, any block inside the skeleton container can read them. This is simple, requires no Shadow DOM or browser features, and keeps each graphic's theme scoped to its own container. See Architecture Decision 10 for full details.

### 7. Skeleton Sizing

**Full-screen-card:** Fixed inset positioning. Content fills the frame.
```
Position: absolute
Top: 50px, Left: 70px, Right: 70px, Bottom: 50px
```

**Lower-third (future):** Fixed anchor point, variable dimensions. The top-left corner of every lower-third is in the same spot, but width and height are determined by content/blocks.
```
Position: absolute
Bottom: 120px  (fixed anchor)
Left: 100px    (fixed anchor)
Width: auto    (determined by blocks)
Height: auto   (determined by blocks)
```

Per-graphic theme overrides (`--{graphicId}-bar-bottom`, `--{graphicId}-bar-left`, etc.) still work for positioning tweaks.

### 8. Backward-Compatible Block Schemas

No versioning system. Block data schemas are kept **backward-compatible**:
- New fields are added as optional (old specs still work)
- Fields are never renamed (support both old and new names with fallback if needed)
- If a breaking change is truly needed, a one-time migration script updates all saved specs in Firebase

This matches how the existing Firebase data structures evolve.

### 9. Migration Coexistence

During migration, both output.html and stage.html run simultaneously in OBS. The `renderer` field in `currentGraphic` data routes each graphic to the correct page.

**When switching between engines:**
- Producer triggers roster (stage engine graphic) → stage.html shows it, output.html clears
- Producer triggers event-bar (output graphic) → output.html shows it, stage.html clears
- Producer triggers clear → both clear

The show controller reads the `renderer` field from graphicsRegistry.js and includes it in every Firebase write. No manual routing needed.

### 10. Self-Contained Theme Data

**stage.html does NOT use `theme-loader.js`.** Instead, theme data is fully resolved at trigger time and baked into the render spec. When the producer triggers a graphic, the show controller:

1. Reads the competition's theme ID from `competitions/{compId}/config/meetTheme`
2. Fetches the full theme from `themes/{themeId}` (including per-graphic overrides)
3. Resolves all color values (theme defaults + per-graphic overrides for this specific graphic)
4. Writes the resolved colors into the spec's `theme` object

**The render spec is fully self-contained.** Look at the spec in Firebase and you see exactly what colors will render — no cross-referencing theme IDs, no override cascades to trace.

**How stage.html applies theme data:**

stage.html reads `spec.theme` and sets CSS variables on the **skeleton container element** (not on `:root`):

```javascript
function applyTheme(skeletonElement, theme) {
  if (!theme) return;

  const mapping = {
    headerBg:    '--meet-header-bg',
    contentBg:   '--meet-content-bg',
    headerText:  '--meet-header-text',
    overlayBg:   '--meet-overlay-bg',
    overlayText: '--meet-overlay-text',
    borderColor: '--meet-border-color',
    badgeBg:     '--meet-badge-bg',
    badgeText:   '--meet-badge-text',
  };

  for (const [key, cssVar] of Object.entries(mapping)) {
    if (theme[key]) {
      skeletonElement.style.setProperty(cssVar, theme[key]);
    }
  }

  // Image overrides (headerBgImage, logo, bodyTexture, etc.)
  // applied the same way via their CSS variable mappings
}
```

Block CSS uses the same `var(--meet-header-bg, #fallback)` pattern as the existing system. The block doesn't know or care whether the variable was set by theme-loader.js on `:root` (old system) or by stage.html on the skeleton div (new system). This makes block CSS portable across both systems during migration.

**Why scoped to the skeleton container (not `:root`):**
- Isolates theme state per graphic — no global CSS variable pollution
- Future-proof for multiple simultaneous graphics (each with its own theme)
- Clean lifecycle — when the graphic is dismissed, its CSS variables are removed with the DOM element

**Why fully baked (not resolved at render time):**
- **Debuggable:** If colors look wrong, open Firebase and the answer is in the spec
- **No race conditions:** No theme fetch timeout, no theme-ready promise, no 3-second fallback
- **Simpler stage engine:** stage.html just reads and applies — no Firebase theme lookups
- **AI-ready:** When AI composes a spec, it includes colors directly — no dependency on external theme state

**Trade-off:** If you edit a theme mid-show in the Theme Editor, already-displayed graphics won't update. You need to re-trigger the graphic. This is acceptable because theme edits happen during setup, not during live shows.

**Theme Editor preview:** For stage engine graphics, the Theme Editor builds a spec with inline theme values and renders it in the preview iframe. No `?meetTheme=` URL param needed.

**`theme-loader.js` remains unchanged.** output.html and overlay files continue to use it. Only stage.html uses the self-contained approach.

### 11. Block Load Failure Handling

If any block fails to load (JS or CSS 404, JS parse error, etc.), the **entire graphic fails**. Partial rendering (showing some blocks but not others) would produce broken layouts.

**Error reporting:** On failure, stage.html writes an error to Firebase for producer visibility:

```
competitions/{compId}/production/stageErrors/{timestamp}
```

```json
{
  "type": "block_load_error",
  "graphic": "leaderboard-vt",
  "block": "leaderboard-table",
  "message": "Failed to load blocks/leaderboard-table.js: 404 Not Found",
  "url": "https://commentarygraphic.com/stage/stage.html?comp=...",
  "timestamp": "2026-03-28T14:30:00.000Z"
}
```

The Producer View shows these errors the same way it shows theme errors — a red badge with count, expandable panel with details per error, and a dismiss button. The existing `ThemeErrorLog` component pattern is reused for stage engine errors.

### 12. Graphic Manifests & Auto-Discovery (Single Source of Truth)

**Problem this solves:** Today, adding a new graphic requires updating up to 3 separate files that each maintain their own list of graphics: `graphicsRegistry.js` (definitions), `urlBuilder.js` (URL building switch statement), and `UrlGeneratorPage.jsx` (sidebar titles). Forgetting any one of these means the graphic exists but is invisible in parts of the UI.

**Solution:** Each graphic is defined by a **manifest file** that lives next to its code. The registry is **generated** from these manifests at build time — no hand-maintained graphic lists anywhere.

**Manifest files for stage engine graphics** live in `stage/graphics/`:

```
stage/graphics/
  leaderboard-vt.json
  leaderboard-fx.json
  team-roster.json
  ...
```

Each manifest is a JSON file:

```json
{
  "id": "leaderboard-vt",
  "label": "Vault",
  "category": "full-screen-cards",
  "subcategory": "leaderboards",
  "skeleton": "full-screen-card",
  "blocks": ["header-bar", "leaderboard-table"],
  "gender": "womens",
  "transparent": false,
  "keywords": ["vault", "vt", "leaderboard", "scores"],
  "params": {
    "apparatus": { "type": "string", "default": "VT" }
  },
  "defaultData": {
    "blocks": [
      { "type": "header-bar", "data": { "title": "VAULT" } },
      { "type": "leaderboard-table", "data": { "source": "scoring/leaderboard/VT" } }
    ]
  }
}
```

**Manifest files for legacy graphics** (output.html and overlays) live in `stage/graphics/legacy/`:

```
stage/graphics/legacy/
  event-bar.json
  warm-up.json
  sponsors-cycle.json
  ...
```

Legacy manifests use `renderer: "overlay"` or `renderer: "output"` and include the `file` field pointing to their HTML:

```json
{
  "id": "event-bar",
  "label": "Event Info",
  "category": "lower-thirds",
  "renderer": "overlay",
  "file": "event-bar.html",
  "transparent": true,
  "params": {
    "team1Logo": { "type": "string", "source": "competition", "required": true },
    "venue": { "type": "string", "source": "competition" },
    "eventName": { "type": "string", "source": "competition" },
    "location": { "type": "string", "source": "competition" }
  }
}
```

**Build-time registry generation:**

A build script (`scripts/buildGraphicsRegistry.js`) scans `stage/graphics/**/*.json`, validates each manifest, and generates `show-controller/src/lib/graphicsRegistry.generated.js`. The existing `graphicsRegistry.js` imports from the generated file instead of hand-maintaining the `GRAPHICS` object.

```javascript
// graphicsRegistry.js (after migration)
import { GRAPHICS } from './graphicsRegistry.generated';
// All helper functions (getGraphicById, getGraphicsByCategory, etc.) remain — they just read from the generated data
```

The build script runs as part of `npm run build` in show-controller. It also runs in watch mode during development.

**URL building from manifests:**

For overlay/output graphics, the manifest's `params` schema is sufficient to build URLs generically — the existing `buildGraphicUrlFromRegistry()` fallback pattern already does this. The per-graphic `buildXxxURL()` functions and the giant switch statement in `generateGraphicURL()` are eliminated over time as each graphic gets a complete manifest with params.

For stage engine graphics, the URL is always `stage/stage.html?comp={compId}&graphic={id}` — no per-graphic URL logic needed.

**Category definitions (`stage/graphics/categories.json`):**

Valid categories and subcategories are defined in a single file. The build script validates every manifest's `category` and `subcategory` against this file — typos fail the build.

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
      "camera-layouts": "Camera Layouts",
      "apparatus": "Apparatus"
    }
  },
  "standalone": {
    "label": "Standalone",
    "order": 5,
    "subcategories": {}
  }
}
```

This file controls three things:
1. **Validation** — build fails if a manifest uses `"category": "full-scren-cards"` (typo). Error message: `Unknown category 'full-scren-cards' in leaderboard-vt.json. Valid: full-screen-cards, lower-thirds, full-bleed, video-frames, standalone`
2. **Display labels** — the sidebar shows "Full-Screen Cards" not "full-screen-cards"
3. **Sidebar ordering** — categories appear in `order` sequence, not alphabetically. Within a category, subcategories appear in their declared order.

To add a new category or subcategory, edit this one file. All manifests that reference it will immediately group correctly.

**Sidebar auto-population:**

The URL Generator and Web Graphics Panel sidebars are generated from `categories.json` ordering + the registry's `category` and `subcategory` fields. No separate `baseGraphicTitles` object. If a graphic has a manifest, it appears in the sidebar under the correct category — guaranteed.

**What this means for the workflow:**

| Step | Before (today) | After (manifests) |
|------|----------------|-------------------|
| Create graphic code | Write HTML/CSS/JS | Write HTML/CSS/JS (or skeleton + blocks) |
| Register in system | Update `graphicsRegistry.js` | Create `stage/graphics/{id}.json` |
| URL generator sidebar | Update `UrlGeneratorPage.jsx` baseGraphicTitles | Automatic (reads from registry) |
| URL builder | Add case to `urlBuilder.js` switch statement | Automatic (params in manifest) |
| Web graphics panel | Already reads registry | Already reads registry |
| **Total files to update** | **4 files** | **1 file** (the manifest) |

**Validation:** The build script validates manifests and **fails the build** if:
- Required fields are missing (`id`, `label`, `category`)
- `category` or `subcategory` not found in `categories.json`
- `skeleton` references a skeleton that doesn't exist in `stage/skeletons/`
- `blocks` references a block that doesn't exist in `stage/blocks/`
- Duplicate `id` values across manifests
- Stage engine graphic missing `skeleton` or `blocks`

The build script also emits **warnings** (does not fail) for:
- A block declares a `themeVars` entry that its CSS doesn't reference
- A block's CSS uses a `--meet-*` variable that isn't declared in its `themeVars`

This catches structural mistakes at build time and surfaces theme wiring issues before they reach production.

**Migration path:** Existing `graphicsRegistry.js` entries are converted to manifest files one category at a time. During migration, the build script merges hand-written entries (for graphics not yet converted) with generated entries (from manifests). Once all graphics have manifests, the hand-written `GRAPHICS` object is deleted.

---

## Render Spec Format

The `blocks` field is always an array, even for single-block graphics.

**Leaderboard example (header-bar + leaderboard-table):**

```json
{
  "skeleton": "full-screen-card",
  "blocks": [
    {
      "type": "header-bar",
      "data": { "title": "VAULT", "logo": "https://media.virti.us/upload/images/team/..." }
    },
    {
      "type": "leaderboard-table",
      "data": {
        "source": "scoring/leaderboard/VT",
        "comp": "wcgnic-2026-prelim1",
        "gender": "womens"
      }
    }
  ],
  "theme": {
    "id": "behind-the-chalk",
    "headerBg": "#8B1A4A",
    "headerText": "#FFFFFF",
    "contentBg": "#1a1a2e",
    "overlayBg": "#0f0f23",
    "overlayText": "#FFFFFF",
    "borderColor": "#2d2d4e",
    "badgeBg": "#c4467e",
    "badgeText": "#FFFFFF"
  },
  "comp": "wcgnic-2026-prelim1"
}
```

The `theme` object contains **resolved values** — not a theme ID. The show controller looks up the theme from Firebase and bakes the colors into the spec at trigger time. If the theme has per-graphic overrides for this graphic, those are already resolved into these values.

**No-header example (just content, full height):**

```json
{
  "skeleton": "full-screen-card",
  "blocks": [
    {
      "type": "leaderboard-table",
      "data": {
        "source": "scoring/leaderboard/AA",
        "comp": "wcgnic-2026-prelim1",
        "gender": "womens"
      }
    }
  ],
  "theme": {
    "id": "behind-the-chalk",
    "headerBg": "#8B1A4A",
    "headerText": "#FFFFFF",
    "contentBg": "#1a1a2e",
    "overlayBg": "#0f0f23",
    "overlayText": "#FFFFFF",
    "borderColor": "#2d2d4e",
    "badgeBg": "#c4467e",
    "badgeText": "#FFFFFF"
  },
  "comp": "wcgnic-2026-prelim1"
}
```

**Multi-block example (future: athlete spotlight lower-third):**

```json
{
  "skeleton": "lower-third",
  "blocks": [
    {
      "type": "header-bar",
      "data": { "title": "ATHLETE SPOTLIGHT", "logo": "https://..." }
    },
    {
      "type": "athlete-headshot",
      "data": { "name": "Taylor Ingle", "headshot": "https://..." }
    },
    {
      "type": "title-bar",
      "data": { "text": "Season High on Vault" }
    },
    {
      "type": "stat-row",
      "data": { "label": "Season High", "value": "9.950", "previousHigh": "9.875" }
    }
  ],
  "theme": {
    "id": "behind-the-chalk",
    "headerBg": "#8B1A4A",
    "headerText": "#FFFFFF",
    "contentBg": "#1a1a2e",
    "overlayBg": "#0f0f23",
    "overlayText": "#FFFFFF",
    "borderColor": "#2d2d4e",
    "badgeBg": "#c4467e",
    "badgeText": "#FFFFFF"
  },
  "comp": "wcgnic-2026-prelim1"
}
```

### Content Slot Layout

By default, blocks stack vertically in the content slot. The spec supports a `layout` field for complex arrangements.

**When no `layout` is specified:** Blocks stack top to bottom in order. This covers simple graphics like leaderboards and rosters.

**Column layout example (header + two blocks side by side):**

```json
{
  "skeleton": "full-screen-card",
  "layout": {
    "type": "rows",
    "rows": [
      { "blocks": ["header"] },
      {
        "type": "columns",
        "columns": [
          { "width": "50%", "blocks": ["left"] },
          { "width": "50%", "blocks": ["right"] }
        ]
      }
    ]
  },
  "blocks": [
    { "id": "header", "type": "header-bar", "data": { "title": "TEAM COMPARISON" } },
    { "id": "left", "type": "leaderboard-table", "data": { "source": "scoring/leaderboard/VT" } },
    { "id": "right", "type": "leaderboard-table", "data": { "source": "scoring/leaderboard/FX" } }
  ]
}
```

```
┌──────────────────────────────────────────┐
│  header-bar: TEAM COMPARISON             │
├────────────────────┬─────────────────────┤
│                    │                     │
│  leaderboard-table │  leaderboard-table  │
│  (left, 50%)       │  (right, 50%)       │
│                    │                     │
└────────────────────┴─────────────────────┘
```

Layout is **nestable** — rows can contain columns, columns can contain rows. Blocks are referenced by `id` so they can be placed anywhere in the layout tree.

### Animations

**Enter/exit animations (in scope for this PRD):**

```json
{
  "skeleton": "full-screen-card",
  "blocks": [
    {
      "id": "header",
      "type": "header-bar",
      "data": { "title": "VAULT", "logo": "..." },
      "animation": {
        "enter": { "type": "slide-down", "duration": 300, "delay": 0 },
        "exit": { "type": "fade-out", "duration": 200 }
      }
    },
    {
      "id": "scores",
      "type": "leaderboard-table",
      "data": { "source": "scoring/leaderboard/VT" },
      "animation": {
        "enter": { "type": "slide-up", "duration": 400, "delay": 200 },
        "exit": { "type": "fade-out", "duration": 300 }
      }
    }
  ]
}
```

Animation properties:
- `type` — slide-up, slide-down, slide-left, slide-right, fade-in, fade-out, scale-in, scale-out
- `duration` — milliseconds
- `delay` — milliseconds after the graphic is triggered
- `easing` — (optional) ease, ease-in, ease-out, ease-in-out, linear

**Animation trigger flow:**
1. Spec arrives → render all blocks hidden (`opacity: 0`)
2. All assets loaded (or 1-second timeout) → play enter animations per block config
3. Dismiss signal (null or new spec) → play exit animations → clear DOM

**Future animation capabilities (not in this PRD):**
- In-graphic animations (score count-up, staggered row reveal, highlight pulse)
- Timeline sequences (choreographed multi-step shows)
- Transition animations (crossfade, wipe between graphics)
- Data-driven animations (score update flash, rank change slide)

**Who writes the spec:**
- **Manual/prepped:** Producer builds the spec via URL Generator, Rundown Editor, or Graphics Editor (future). Saved to Firebase, ready to play.
- **AI-generated:** At runtime, AI composes a spec for a storyline ("Best R1 in program history") with headline + stat blocks. Producer approves, plays it.

Same system, same blocks, same stage engine. The only difference is who writes the spec.

---

## Architecture

### stage.html

A single HTML file that is the new stage engine for migrated graphics. It:

1. Listens to `competitions/{compId}/currentGraphic` via Firebase
2. Checks the `renderer` field — only handles graphics with `renderer: "stage"`
3. Loads the skeleton CSS/HTML for the specified type
4. Loads the CSS/JS for each block in the `blocks` array
5. Renders blocks hidden into the skeleton's content slot
6. Waits for assets (max 1 second) then plays enter animations
7. On dismiss: plays exit animations, clears DOM

Also supports standalone mode via URL params (for URL Generator copy URLs):
- `stage.html?comp={compId}` — persistent listener mode (OBS browser source)
- `stage.html?comp={compId}&graphic={id}` — standalone single graphic (theme resolved from competition config)

### File Structure

```
stage/
  stage.html                 ← The stage engine
  skeletons/
    full-screen-card.css     ← Skeleton styles
    full-screen-card.html    ← Skeleton markup template
  blocks/
    header-bar.css           ← Header block styles
    header-bar.js            ← Header block render logic
    leaderboard-table.css    ← Block styles
    leaderboard-table.js     ← Block render logic (Firebase listeners)
    athlete-grid.css
    athlete-grid.js
  graphics/                  ← Graphic manifests (single source of truth)
    categories.json          ← Valid categories, display labels, sidebar order
    leaderboard-vt.json      ← Stage engine graphic manifest
    leaderboard-fx.json
    team-roster.json
    legacy/                  ← Manifests for output.html + overlay graphics
      event-bar.json
      warm-up.json
      sponsors-cycle.json

scripts/
  buildGraphicsRegistry.js   ← Scans stage/graphics/**/*.json → generates registry
```

**Naming convention:** Skeleton and block names match exactly what appears in the UI. Grep for `full-screen-card` and find the skeleton files, the CSS, and every graphic that uses it.

### Skeletons

Skeletons are **just the frame** — no headers, no content logic, no data fetching. A skeleton defines only:

- Container shape (rounded corners, overflow, shadow, border)
- Positioning within the 1920x1080 canvas
- Flex column layout for blocks to fill
- Theme CSS variable bindings for the container itself

**Full-screen-card skeleton** (based on roster's `.card-container`):

```
Position: absolute, inset with margins (top: 50px, left: 70px, right: 70px, bottom: 50px)
Layout: flex column
Border-radius: 12px
Overflow: hidden
Box-shadow: yes

└── (blocks render here)
```

**Skeleton theme variables:**
- `--full-screen-card-bg` → background color of the frame
- `--full-screen-card-radius` → border radius
- `--full-screen-card-shadow` → box shadow

### Content Blocks

Each block is a self-contained module that:
- Listens to Firebase paths for its data (live updates)
- Renders its own DOM into the skeleton's content slot
- Manages its own internal layout (table, grid, flex, etc.)
- Has CSS scoped via `.block-{blockName}` wrapper class
- Declares which theme CSS variables it uses via `themeVars` (see below)

**Block `themeVars` declaration:**

Each block's JS file declares a `themeVars` array listing which `--meet-*` CSS variables it uses:

```javascript
window.BlockHeaderBar = {
  themeVars: ['--meet-header-bg', '--meet-header-text', '--meet-logo-url', '--meet-logo-size'],
  render(container, data, theme) { ... },
  destroy(container) { ... },
  ready() { ... },
};
```

The build script reads each block's `.css` file and checks that every variable listed in `themeVars` actually appears in the CSS (e.g., `var(--meet-header-bg`). If a block declares `--meet-header-bg` but its CSS never references it, the build emits a **warning** (not a failure):

```
WARNING: Block 'header-bar' declares themeVar '--meet-header-bg' but its CSS does not reference it
```

Conversely, if a block's CSS uses a `--meet-*` variable that isn't in `themeVars`, the build also warns:

```
WARNING: Block 'header-bar' CSS uses '--meet-badge-bg' but it is not declared in themeVars
```

These are warnings, not errors — they don't break the build. But they surface theme wiring issues at build time instead of discovering them live during a show when a graphic doesn't pick up the theme colors.

**Why this matters:** The most common bug with the current system is creating a new graphic that doesn't respond to theme colors because the CSS hardcodes values instead of using `var(--meet-*)`. `themeVars` makes this visible immediately.

**Blocks for this PRD:**

#### header-bar
Reusable header with title on the left and optional logo on the right. Themed via CSS variables.

`themeVars`: `--meet-header-bg`, `--meet-header-text`, `--meet-logo-url`, `--meet-logo-size`

| Element | Content |
|---------|---------|
| Title | Left-aligned, uppercase, themed font |
| Logo | Right-aligned, sized via CSS variable, optional |

#### leaderboard-table
Ranked score table. Listens to `competitions/{compId}/scoring/leaderboard/{apparatus}` in Firebase for live updates. Sorted by score descending with tie handling.

`themeVars`: `--meet-content-bg`, `--meet-overlay-text`, `--meet-border-color`, `--meet-badge-bg`, `--meet-badge-text`

| Column | Content |
|--------|---------|
| Rank | Numeric, handles ties |
| Medal indicator | Gold/silver/bronze dot for top 3 |
| Name | Athlete name |
| Team | Team name |
| Apparatus | Badge (e.g., "VT") |
| Score | Right-aligned, tabular-nums |

#### athlete-grid
Responsive grid of athlete cards. Reads roster from `teamsDatabase/teams/{teamKey}/roster` and headshots from `teamsDatabase/headshots`. Adapts layout based on athlete count.

`themeVars`: `--meet-content-bg`, `--meet-overlay-text`, `--meet-border-color`

| Element | Content |
|---------|---------|
| Headshot | Circular crop, fallback to initials |
| Name | Centered below headshot |
| Grid sizing | Auto-adapts columns based on count |

---

## Skeleton & Block Preview Mode

The stage engine supports a **preview mode** for development and debugging. Hit a URL with `?preview=` params and see skeletons/blocks with sample data — no Firebase, no competition required.

### Preview URLs

| URL | Shows |
|-----|-------|
| `stage.html?preview=skeleton&skeleton=full-screen-card` | Empty card frame with placeholder content |
| `stage.html?preview=block&block=leaderboard-table` | Block with sample data, no skeleton |
| `stage.html?preview=full&skeleton=full-screen-card&block=leaderboard-table` | Full assembly with sample data |
| `stage.html?preview=full&skeleton=full-screen-card&block=leaderboard-table&theme=behind-the-chalk` | Full assembly with theme |

### In the URL Generator & Web Graphics Panel

A new **"Skeletons & Blocks"** section in the sidebar lists all registered skeletons and blocks with expandable preview links. Lets producers and developers inspect skeletons, test theme variables, and verify rendering without competition data.

---

## Graphics Reorganization

### Current Categories (by show timing)
```
Pre-Meet → In-Meet → Event Frames → Frame Overlays → Leaderboards → Event Summary → Stream → Sponsors
```

### New Categories (by graphic type)

**Full-Screen Cards**
- Leaderboards (VT, FX, PH, SR, PB, HB, UB, BB, AA, Combined AA)
- AA Leaders
- Team Roster
- Sponsors Thank You

**Lower-Thirds**
- Event Info (event-bar)
- Warm Up
- Replay
- Team Stats
- Coaches
- Athlete Spotlight
- Who to Watch

**Full-Bleed**
- Rotation Slate
- Stream Starting
- Stream Thanks
- Who to Watch — Title Card
- Interview Card
- Sponsors Cycle

**Video Frames**
- Quad View, Tri Center, Tri Wide, Tri Wide Top
- Team Header Dual, Single, Dual View
- Floor, Pommel, Rings, Vault, PBars, HBar, UBars, Beam
- All-Around, Final Scores, Competition Order, Lineups

**Standalone (no skeleton)**
- Team Logos
- Sponsors Bug
- Event Summary (unique structure — excluded from skeleton system)
- Event Calendar

### Registry Changes

`graphicsRegistry.js` gets new fields per graphic:

```javascript
{
  id: 'leaderboard-vt',
  label: 'Vault',
  category: 'full-screen-cards',       // by graphic type
  subcategory: 'leaderboards',          // sub-group within category
  renderer: 'stage',                     // 'stage' | 'output' | 'overlay'
  skeleton: 'full-screen-card',         // which skeleton
  blocks: ['header-bar', 'leaderboard-table'],  // which blocks (array)
  // ... existing fields unchanged
}
```

Non-migrated graphics keep `renderer: 'output'` or `renderer: 'overlay'` and continue working as-is. Migrated graphics use `renderer: 'stage'`.

---

## Integration with Existing Tools

### Graphics Registry (Auto-Generated)

- `graphicsRegistry.js` is no longer hand-maintained — it imports from `graphicsRegistry.generated.js`
- `graphicsRegistry.generated.js` is produced by `scripts/buildGraphicsRegistry.js` at build time
- The build script scans `stage/graphics/**/*.json` manifest files
- All existing helper functions (`getGraphicById`, `getGraphicsByCategory`, etc.) work unchanged — only the data source changes
- Adding a new graphic = creating one manifest JSON file. The registry, URL generator sidebar, and graphics panel all pick it up automatically.

### URL Generator

- Reads `renderer` field from graphicsRegistry (now auto-generated from manifests)
- For `renderer: 'stage'` → builds `stage.html?comp=...&graphic=...` URLs (generic, no per-graphic function needed)
- For `renderer: 'output'` or `'overlay'` → builds URLs from the manifest's `params` schema (replaces the per-graphic `buildXxxURL()` functions and switch statement in `generateGraphicURL()`)
- Sidebar populated automatically from `categories.json` ordering + manifest `category`/`subcategory` fields — no separate `baseGraphicTitles` list
- New "Skeletons & Blocks" section for preview mode

**Renderer badge in sidebar:** Each graphic in the sidebar shows a small colored badge indicating its renderer:

```
Full-Screen Cards
  ├── Vault Leaderboard        [stage]
  ├── Team Roster              [stage]
Lower-Thirds
  ├── Event Info               [overlay]
  ├── Warm Up                  [overlay]
Standalone
  ├── Event Summary            [output]
```

Badge colors: `[stage]` = teal, `[overlay]` = gray, `[output]` = gray. This tells the producer at a glance which rendering system each graphic uses. As graphics migrate from overlay/output → stage, their badges update automatically (because the manifest's `renderer` field changes).

**Preview iframe renderer indicator:** When a graphic is selected, the preview panel shows a small label above the iframe indicating the rendering path:

- Stage engine graphics: `Rendering via stage.html` with the full preview URL visible
- Overlay graphics: `Rendering via overlays/{file}.html` with the full preview URL visible
- Output.html graphics: `Rendering via output.html` with the full preview URL visible

This makes it immediately obvious which system is rendering the preview, and the visible URL lets you verify the correct file is being loaded.

### Web Graphics Panel (GraphicsControl)

- Checks `renderer` field when triggering a graphic
- For stage engine graphics: resolves theme from Firebase (competition's `meetTheme` → `themes/{id}` → per-graphic overrides), bakes into spec's `theme` object
- Writes `{ graphic: "...", renderer: "stage"|"output", data: { ... } }` to `currentGraphic`
- Both output.html and stage.html listen; each handles its own graphics, clears for the other's
- Copyable URLs for stage.html
- Sidebar populated from the same auto-generated registry categories (matches URL Generator automatically)
- Same renderer badge (`[stage]` / `[overlay]` / `[output]`) next to each graphic name, matching the URL Generator

### Rundown System

- Rundown segments reference graphics by ID (unchanged)
- Timesheet engine includes `renderer` field when writing to `currentGraphic`
- For stage engine graphics, timesheet engine resolves theme and bakes into spec (same as Graphics Panel)
- stage.html picks up stage engine graphics; output.html picks up output graphics

### Theme System

- **stage.html does NOT use `theme-loader.js`.** Theme data is baked into the render spec (see Architecture Decision 10).
- output.html and overlay files continue to use `theme-loader.js` unchanged.
- Theme Editor preview for stage engine graphics builds specs with inline theme values.
- Block CSS uses the same `var(--meet-header-bg, #fallback)` pattern — portable across both systems.

**No breaking changes.** Old and new systems coexist.

---

## Scoring Ingestion Service

A new service on the coordinator server that polls the Virtius API and writes graphic-ready data to Firebase.

### How It Works

1. Coordinator reads `competitions/{compId}/config/scoringFeed` for each active competition
2. If `enabled: true`, starts a polling loop at the configured `pollInterval`
3. Each poll: fetch `https://api.virti.us/session/{sessionId}/json`
4. Process raw Virtius data into graphic-ready structures
5. Write to `competitions/{compId}/scoring/` in Firebase using `.update()` on individual subpaths (not `.set()` on the root — see Architecture Decision 2)
6. Update `lastPollAt` and `status` in scoringFeed config

### Processed Data Structures

**`scoring/leaderboard/{apparatus}`** (one per apparatus):
```json
{
  "apparatus": "VT",
  "apparatusLabel": "Vault",
  "rows": [
    { "rank": 1, "name": "Taylor Ingle", "team": "SEMO", "teamLogo": "https://...", "score": 9.850 },
    { "rank": 1, "name": "Maribelle Albert", "team": "Alaska", "teamLogo": "https://...", "score": 9.850 }
  ],
  "updatedAt": "2026-03-28T..."
}
```

**`scoring/teamTotals`**:
```json
{
  "teams": [
    { "name": "SEMO", "logo": "https://...", "total": 196.425, "events": { "VT": 49.125, "UB": 48.950, ... } }
  ],
  "updatedAt": "2026-03-28T..."
}
```

**`scoring/rotationState`**:
```json
{
  "currentRotation": 3,
  "rotationStatus": "in_progress",
  "teamPositions": [
    { "team": "SEMO", "apparatus": "BB", "rotation": 3 },
    { "team": "Alaska", "apparatus": "FX", "rotation": 3 }
  ],
  "updatedAt": "2026-03-28T..."
}
```

**`scoring/allAround`**:
```json
{
  "rows": [
    { "rank": 1, "name": "Taylor Ingle", "team": "SEMO", "total": 39.525, "events": { "VT": 9.850, "UB": 9.875, ... } }
  ],
  "updatedAt": "2026-03-28T..."
}
```

### Auto-Stop

Polling stops automatically when:
- `scoringFeed/enabled` set to `false` by producer
- Competition `status` is "completed" or "archived"
- Virtius session returns completed status
- No producer connected for 30+ minutes

### Key File

| Component | File |
|-----------|------|
| Scoring ingestion service | `server/lib/scoringIngestionService.js` (new) |

---

## Block Catalog

Every unique block needed to migrate all graphics from output.html/overlays to stage.html. This is the master checklist — when every block shows `done`, the renderer migration is code-complete.

### How to verify a block

Each block exports `sampleData` so it renders standalone without Firebase:

```
stage.html?preview=block&block={block-name}
```

Load the URL, take a screenshot, compare against the equivalent output.html/overlay graphic. The block is correct when they match visually.

### Full-Screen Card Blocks

| # | Block | Phase | Used By | Status | Verify URL |
|---|-------|-------|---------|--------|------------|
| 1 | `header-bar` | 2 | leaderboards (10), team-roster, sponsors-thanks, coaches, team-stats | ~~`not started`~~ — **FIXED 2026-03-31.** Created header-bar block with CSS variable cascade, background image support, optional logo. | `?preview=block&block=header-bar` |
| 2 | `leaderboard-table` | 2 | leaderboard-vt/fx/ph/sr/pb/hb/ub/bb/aa, combined-aa | ~~`not started`~~ — **FIXED 2026-03-31.** Created leaderboard-table block with tie indicators, medal circles, column variants for gender/apparatus. | `?preview=block&block=leaderboard-table` |
| 3 | `athlete-grid` | 2 | team-roster | ~~`not started`~~ — **FIXED 2026-03-31.** Created athlete-grid block with 5-step headshot lookup fallback chain, responsive grid layouts for 1-26+ athletes, initials fallback with gradient background. | `?preview=block&block=athlete-grid` |
| 4 | `sponsor-grid` | future | sponsors-thanks | `not started` | `?preview=block&block=sponsor-grid` |
| 5 | `stat-card` | future | team-stats (per-team) | `not started` | `?preview=block&block=stat-card` |
| 6 | `coach-list` | future | team-coaches (per-team) | `not started` | `?preview=block&block=coach-list` |

### Lower-Third Blocks

| # | Block | Phase | Used By | Status | Verify URL |
|---|-------|-------|---------|--------|------------|
| 7 | `lower-third-bar` | future | event-bar, warm-up, replay | `not started` | `?preview=block&block=lower-third-bar` |
| 8 | `athlete-spotlight-card` | future | athlete-spotlight, who-to-watch | `not started` | `?preview=block&block=athlete-spotlight-card` |

### Full-Bleed Blocks

| # | Block | Phase | Used By | Status | Verify URL |
|---|-------|-------|---------|--------|------------|
| 9 | `rotation-slate-layout` | future | rotation-slate, rotation-slate-auto | `not started` | `?preview=block&block=rotation-slate-layout` |
| 10 | `stream-card` | future | stream-starting, stream-thanks | `not started` | `?preview=block&block=stream-card` |
| 11 | `title-card` | future | who-to-watch-title, interview-card | `not started` | `?preview=block&block=title-card` |
| 12 | `sponsor-cycle` | future | sponsors-cycle | `not started` | `?preview=block&block=sponsor-cycle` |

### Video Frame Blocks

| # | Block | Phase | Used By | Status | Verify URL |
|---|-------|-------|---------|--------|------------|
| 13 | `frame-layout` | future | frame-quad, frame-tri-*, frame-dual, frame-single, frame-team-header | `not started` | `?preview=block&block=frame-layout` |
| 14 | `event-frame-title` | future | floor, pommel, rings, vault, pbars, hbar, ubars, beam, allaround, final, order, lineups, summary | `not started` | `?preview=block&block=event-frame-title` |

### Standalone / Special Blocks

| # | Block | Phase | Used By | Status | Verify URL |
|---|-------|-------|---------|--------|------------|
| 15 | `dual-logo` | future | logos | `not started` | `?preview=block&block=dual-logo` |
| 16 | `event-summary-table` | future | summary-r1 through r6, summary-fx/ph/sr/vt/pb/hb/ub/bb | `not started` | `?preview=block&block=event-summary-table` |
| 17 | `event-calendar-grid` | future | event-calendar | `not started` | `?preview=block&block=event-calendar-grid` |
| 18 | `sponsor-bug` | future | sponsors-bug | `not started` | `?preview=block&block=sponsor-bug` |
| 19 | `hosts-card` | future | hosts | `not started` | `?preview=block&block=hosts-card` |

**Total: 19 blocks to cover all ~90 graphics.**

> **How to read this table:** `Phase` = when the block is planned to be built. `Status` = `not started` → `in progress` → `done`. `Used By` = which graphics depend on this block. A block is "done" when its preview URL renders correctly and matches the legacy graphic visually.

> **Maintenance:** These tables are manually updated during Phases 2-3. Starting in Phase 4, the build script (`buildGraphicsRegistry.js`) auto-generates migration status by scanning `stage/blocks/` and `stage/graphics/` — see Phase 4, Task 5.

---

## Migration Tracker

Maps every graphic in the system to its target skeleton, required blocks, and migration status. This is how you check overall progress at a glance.

**Status key:** `legacy` = still on output.html/overlays | `in progress` = block(s) being built | `stage` = fully on stage.html | `standalone` = excluded from skeleton system

### Summary

| Category | Total Graphics | Migrated | Remaining |
|----------|---------------|----------|-----------|
| Full-Screen Cards | 14 | 0 | 14 |
| Lower-Thirds | 7 + per-team | 0 | 7+ |
| Full-Bleed | 6 | 0 | 6 |
| Video Frames | 7 + 13 event frames | 0 | 20 |
| Standalone | 5 + 14 event summaries | 0 | 19 |
| Playout / Clip | 4 | 0 | 4 |
| **Total** | **~70 unique + per-team** | **0** | **all** |

### Full-Screen Cards → `full-screen-card` skeleton

| Graphic | Blocks Needed | Blocks Ready | Status |
|---------|--------------|--------------|--------|
| `leaderboard-vt` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-fx` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-ph` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-sr` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-pb` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-hb` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-ub` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-bb` | header-bar, leaderboard-table | 0/2 | legacy |
| `leaderboard-aa` | header-bar, leaderboard-table | 0/2 | legacy |
| `combined-aa-leaderboard` | header-bar, leaderboard-table | 0/2 | legacy |
| `team-roster` (per-team) | header-bar, athlete-grid | 0/2 | legacy |
| `sponsors-thanks` | header-bar, sponsor-grid | 0/2 | legacy |
| `team-stats` (per-team) | header-bar, stat-card | 0/2 | legacy |
| `team-coaches` (per-team) | header-bar, coach-list | 0/2 | legacy |

### Lower-Thirds → `lower-third` skeleton (future)

| Graphic | Blocks Needed | Blocks Ready | Status |
|---------|--------------|--------------|--------|
| `event-bar` | lower-third-bar | 0/1 | legacy |
| `warm-up` | lower-third-bar | 0/1 | legacy |
| `replay` | lower-third-bar | 0/1 | legacy |
| `athlete-spotlight` (per-team) | athlete-spotlight-card | 0/1 | legacy |
| `who-to-watch` (per-team) | athlete-spotlight-card | 0/1 | legacy |
| `hosts` | hosts-card | 0/1 | legacy |

### Full-Bleed → `full-bleed` skeleton (future)

| Graphic | Blocks Needed | Blocks Ready | Status |
|---------|--------------|--------------|--------|
| `rotation-slate` | rotation-slate-layout | 0/1 | legacy |
| `rotation-slate-auto` | rotation-slate-layout | 0/1 | legacy |
| `stream-starting` | stream-card | 0/1 | legacy |
| `stream-thanks` | stream-card | 0/1 | legacy |
| `who-to-watch-title` (per-team) | title-card | 0/1 | legacy |
| `sponsors-cycle` | sponsor-cycle | 0/1 | legacy |

### Video Frames → `video-frame` skeleton (future)

| Graphic | Blocks Needed | Blocks Ready | Status |
|---------|--------------|--------------|--------|
| `frame-quad` | frame-layout | 0/1 | legacy |
| `frame-tri-center` | frame-layout | 0/1 | legacy |
| `frame-tri-wide` | frame-layout | 0/1 | legacy |
| `frame-tri-wide-top` | frame-layout | 0/1 | legacy |
| `frame-team-header` | frame-layout | 0/1 | legacy |
| `frame-single` | frame-layout | 0/1 | legacy |
| `frame-dual` | frame-layout | 0/1 | legacy |
| `floor` through `summary` (13) | event-frame-title | 0/1 each | legacy |

### Standalone (no skeleton)

| Graphic | Blocks Needed | Blocks Ready | Status |
|---------|--------------|--------------|--------|
| `logos` | dual-logo | 0/1 | legacy |
| `event-calendar` | event-calendar-grid | 0/1 | legacy |
| `sponsors-bug` | sponsor-bug | 0/1 | legacy |
| `summary-r1` through `summary-r6` | event-summary-table | 0/1 each | legacy |
| `summary-fx` through `summary-bb` (8) | event-summary-table | 0/1 each | legacy |

### Playout / Clip (excluded from migration)

These graphics are controlled by the playout engine and rendered inline in output.html. They will be migrated separately if/when the playout engine is refactored.

| Graphic | Status |
|---------|--------|
| `clip-playback` | excluded |
| `moment-replay` | excluded |
| `live-camera` | excluded |
| `now-competing` | excluded |

---

## Phase Overview

Implementation is split into phases, each with its own detailed document.

| Phase | Name | Scope | Doc | Status |
|-------|------|-------|-----|--------|
| 1 | Foundation | stage.html, full-screen-card skeleton, layout system, preview mode, animation engine | `Phase-1-Foundation.md` | **COMPLETE** — deployed 2026-03-31 |
| 2 | Content Blocks | header-bar, leaderboard-table, athlete-grid blocks | `Phase-2-Content-Blocks.md` | **COMPLETE** — deployed 2026-03-31 |
| 3 | Scoring Ingestion | Coordinator polling service, Firebase scoring paths, producer controls | `Phase-3-Scoring-Ingestion.md` | **COMPLETE** — deployed 2026-03-31 |
| 4 | Tool Integration | Registry updates, URL Generator, Web Graphics Panel, Rundown routing | `Phase-4-Tool-Integration.md` | **COMPLETE** — deployed 2026-04-01 |
| 5 | Reorganization | New category structure in registry, URL Generator sidebar, Graphics Panel sidebar | `Phase-5-Reorganization.md` | NOT STARTED |
| 6 | Verification & Cutover | Side-by-side comparisons, production test, old code removal | `Phase-6-Verification-Cutover.md` | NOT STARTED |

---

## Future Scope (Not in This PRD)

### Additional Skeletons
- **lower-third** — for event-bar, warm-up, replay, team-stats, coaches, athlete-spotlight, who-to-watch. Fixed anchor point (bottom-left), variable width/height.
- **full-bleed** — for rotation-slate, stream-starting, stream-thanks, who-to-watch-title, interview-card, sponsors-cycle
- **video-frame** — for apparatus frames, camera layouts

### Additional Content Blocks
- headline-stat (text headline + stat comparison)
- coach-list (names + titles)
- stat-row (team stats bar)
- sponsor-grid (logo grid)
- athlete-comparison (side-by-side athlete stats)
- storyline-card (AI-generated narrative + supporting data)

### AI-Generated Graphics
Once the render spec system is in place, the AI can compose specs at runtime:
- Rundown system detects storylines from live scoring data
- AI generates a render spec with appropriate skeleton + blocks + data
- Producer previews, approves, and plays the graphic
- No new HTML files needed — just a new spec

### Visual Graphics Editor
A dedicated page in the show-controller for visually building and editing graphics:
- Drag blocks into skeletons, arrange layout visually
- Apply themes in real time, override per-block
- Set enter/exit animations with visual controls
- Save as templates (reusable) or complete graphics (ready to play)
- Output is always a render spec — works in OBS, URL Generator, Graphics Panel, Rundown

### Advanced Animations
- In-graphic animations (score count-up, staggered row reveal, highlight pulse)
- Timeline sequences (choreographed multi-step shows)
- Transition animations (crossfade, wipe between graphics)
- Data-driven animations (score update flash, rank change slide)

### Combined All-Around Leaderboard
Requires data from multiple Virtius sessions (e.g., prelims + finals). The single-session polling loop in Phase 3 cannot produce this. Needs a separate data pipeline that aggregates across sessions.

### Event Summary
Excluded from the skeleton system due to its unique structure and many layout versions. May get specialized treatment in a future PRD.

### Full Migration
Eventually all graphics migrate to stage.html. output.html + overlays/ are retired. The stage engine becomes the only rendering engine.
