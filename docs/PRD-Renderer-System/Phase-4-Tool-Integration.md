# Phase 4: Tool Integration

**Parent PRD:** PRD-Renderer-System-2026-03-28.md
**Depends on:** Phase 2 (Content Blocks), Phase 3 (Scoring Ingestion)
**Scope:** Registry updates, URL Generator, Web Graphics Panel, Rundown routing

---

## What This Phase Delivers

All existing producer tools (URL Generator, Web Graphics Panel, Rundown System) know how to work with renderer.html graphics. When a producer triggers a leaderboard or roster, the system:
- Writes the correct `renderer` field to `currentGraphic`
- Both output.html and renderer.html handle the routing correctly
- URL Generator produces renderer.html URLs for migrated graphics
- Copyable renderer.html URLs appear in the Web Graphics Panel

---

## Tasks

### Task 1: Build Script & Manifest System

Create `scripts/buildGraphicsRegistry.js` — a build-time script that scans `stage/graphics/**/*.json` and generates `show-controller/src/lib/graphicsRegistry.generated.js`.

**What the script does:**
1. Read `stage/graphics/categories.json` (valid categories + subcategories + display labels + sidebar order)
2. Glob `stage/graphics/**/*.json` (excluding `categories.json`)
3. Read and parse each manifest
4. Validate required fields (`id`, `label`, `category`), category/subcategory against `categories.json`, skeleton/block existence, no duplicate IDs
5. Fail the build with a clear error message if validation fails (e.g., `Unknown category 'full-scren-cards' in leaderboard-vt.json. Valid: full-screen-cards, lower-thirds, full-bleed, video-frames, standalone`)
6. For each stage engine block referenced by any manifest, read the block's `.css` file and check `themeVars` compliance:
   - If the block JS declares `themeVars: ['--meet-header-bg']` but the CSS never references `var(--meet-header-bg`, emit a warning
   - If the block CSS uses `var(--meet-badge-bg` but `--meet-badge-bg` is not in `themeVars`, emit a warning
   - These are warnings only — they do not fail the build
7. Write `graphicsRegistry.generated.js` exporting a `GRAPHICS` object keyed by `id`, plus a `CATEGORIES` object from `categories.json`

**Integration with build:**
- Add as a pre-build step in `show-controller/package.json`: `"prebuild": "node ../scripts/buildGraphicsRegistry.js"`
- Also add a watch mode for dev: `"predev": "node ../scripts/buildGraphicsRegistry.js"`

**Update `graphicsRegistry.js`:**
- Import from `graphicsRegistry.generated.js` instead of hand-maintaining the `GRAPHICS` object
- All helper functions (`getGraphicById`, `getGraphicsByCategory`, `getAllGraphics`, etc.) remain — they read from the generated data
- During migration, the script merges generated entries with any remaining hand-written entries (for graphics not yet converted to manifests)

### Task 1B: Create Manifest Files for Stage Engine Graphics

Create manifest JSON files in `stage/graphics/` for each migrated graphic.

**Leaderboard manifest example** (`stage/graphics/leaderboard-vt.json`):
```json
{
  "id": "leaderboard-vt",
  "label": "Vault",
  "category": "full-screen-cards",
  "subcategory": "leaderboards",
  "renderer": "stage",
  "skeleton": "full-screen-card",
  "blocks": ["header-bar", "leaderboard-table"],
  "gender": "both",
  "transparent": false,
  "keywords": ["vault", "vt", "leaderboard", "scores"],
  "params": {
    "apparatus": { "type": "string", "default": "VT" }
  },
  "defaultData": {
    "blocks": [
      { "type": "header-bar", "data": { "title": "VAULT" } },
      { "type": "leaderboard-table", "data": { "source": "scoring/leaderboard/VT", "gender": null } }
    ]
  }
}
```

Gender is set dynamically based on competition config — `null` in defaults, filled in at trigger time.

**Roster manifest example** (`stage/graphics/team-roster.json`):
```json
{
  "id": "team-roster",
  "label": "Team Roster",
  "category": "full-screen-cards",
  "subcategory": "rosters",
  "renderer": "stage",
  "skeleton": "full-screen-card",
  "blocks": ["header-bar", "athlete-grid"],
  "gender": "both",
  "transparent": false,
  "perTeam": true,
  "keywords": ["roster", "team", "athletes", "headshots"],
  "defaultData": {
    "blocks": [
      { "type": "header-bar", "data": { "title": null } },
      { "type": "athlete-grid", "data": { "teamKey": null } }
    ]
  }
}
```

### Task 1C: Create Legacy Manifest Files

Convert existing `graphicsRegistry.js` entries to manifest JSON files in `stage/graphics/legacy/`. One file per graphic.

**Example** (`stage/graphics/legacy/event-bar.json`):
```json
{
  "id": "event-bar",
  "label": "Event Info",
  "category": "lower-thirds",
  "renderer": "overlay",
  "file": "event-bar.html",
  "transparent": true,
  "keywords": ["event", "info", "bar", "venue", "location"],
  "gender": "both",
  "params": {
    "team1Logo": { "type": "string", "source": "competition", "required": true },
    "venue": { "type": "string", "source": "competition" },
    "eventName": { "type": "string", "source": "competition" },
    "location": { "type": "string", "source": "competition" }
  }
}
```

Once all legacy graphics have manifests and the build script generates a registry that matches the hand-written one, the hand-written `GRAPHICS` object in `graphicsRegistry.js` is deleted.

### Task 1D: Create `categories.json`

Create `stage/graphics/categories.json` — the single source of truth for valid categories, display labels, and sidebar ordering.

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

The build script reads this file first, then validates every manifest's `category` and `subcategory` against it. The generated registry exports a `CATEGORIES` object alongside `GRAPHICS` so the URL Generator and Graphics Panel can build their sidebars from it.

---

### Task 2: Web Graphics Panel — Renderer Routing

Update `GraphicsControl.jsx` to include the `renderer` field when writing to `currentGraphic`.

**Current behavior:**
```javascript
// When producer clicks "show leaderboard"
db.ref(`competitions/${compId}/currentGraphic`).set({
  graphic: 'virtuis-leaderboard',
  data: { virtiusSessionId, eventName, shortCode, gender }
});
```

**New behavior:**
```javascript
// Look up renderer from registry
const entry = graphicsRegistry.find(g => g.id === graphicId);
// Registry has 'overlay', 'output', 'renderer' — Firebase only uses 'renderer' or 'output'
const firebaseRenderer = entry?.renderer === 'renderer' ? 'renderer' : 'output';

db.ref(`competitions/${compId}/currentGraphic`).set({
  graphic: graphicId,
  renderer: firebaseRenderer,
  data: { ... }
});
```

**For renderer graphics, `data` includes the full render spec with resolved theme:**
```javascript
// Step 1: Resolve theme from Firebase
const themeId = compConfig.meetTheme;
const themeSnap = themeId ? await db.ref(`themes/${themeId}`).once('value') : null;
const themeData = themeSnap?.val();

// Step 2: Resolve per-graphic overrides into theme object
const resolvedTheme = resolveTheme(themeData, 'leaderboard-vt');
// resolveTheme() merges theme defaults with per-graphic overrides for this graphic ID

// Step 3: Write spec with baked-in theme
db.ref(`competitions/${compId}/currentGraphic`).set({
  graphic: 'leaderboard-vt',
  renderer: 'renderer',
  data: {
    skeleton: 'full-screen-card',
    blocks: [
      { type: 'header-bar', data: { title: 'VAULT', logo: compConfig.meetLogo } },
      { type: 'leaderboard-table', data: { source: 'scoring/leaderboard/VT', gender: compConfig.gender } }
    ],
    theme: resolvedTheme  // Fully resolved — renderer just applies, no lookups
  }
});
```

**`resolveTheme(themeData, graphicId)` helper:**
1. Reads theme default colors (`themeData.headerBar`, `themeData.contentArea`, etc.)
2. Checks `themeData.overrides[graphicId]` for per-graphic overrides
3. Merges overrides on top of defaults
4. Returns a flat object: `{ id, headerBg, headerText, contentBg, overlayBg, ... }`

This helper is shared between GraphicsControl, the timesheet engine, and the Theme Editor.

**Clear behavior (unchanged):**
```javascript
db.ref(`competitions/${compId}/currentGraphic`).set(null);
```

Both output.html and renderer.html see `null` and clear.

---

### Task 3: output.html — Ignore Renderer Graphics

Update output.html's `currentGraphic` listener to check the `renderer` field.

**Current behavior:** output.html renders any graphic it receives.

**New behavior:**
```javascript
db.ref(`competitions/${compId}/currentGraphic`).on('value', async (snapshot) => {
  const val = snapshot.val();

  if (!val) {
    clearOutput();
    return;
  }

  const { graphic, renderer, data } = val;

  // If this is a renderer graphic, clear our display and do nothing
  if (renderer === 'renderer') {
    clearOutput();
    return;
  }

  // renderer is 'output', 'overlay', or undefined — all are ours
  renderers[graphic](data);
});
```

This is a small, safe change. All existing graphics continue to work because:
- New writes have `renderer: 'output'` → renders as before
- Old writes have no `renderer` field (`undefined`) → renders as before (backwards-compatible)
- Only `renderer: 'renderer'` causes output.html to clear

---

### Task 4: URL Generator — Generic URL Building from Manifests

Replace the per-graphic URL building functions and switch statement in `urlBuilder.js` with a generic approach that reads from the manifest-generated registry.

**Current problem:** `generateGraphicURL()` is a 170-line switch statement where every graphic needs its own case. The `buildGraphicUrlFromRegistry()` fallback already handles simple overlay graphics generically — but complex graphics (leaderboards, sponsors, event summary) each have a dedicated function.

**New approach:**

For **stage engine graphics** (`renderer: 'stage'`), URLs are always the same pattern:
```javascript
`${base}/stage/stage.html?comp=${compId}&graphic=${graphicId}`
```
No per-graphic logic needed. No `meetTheme` param (theme is baked into spec at trigger time).

For **overlay graphics** (`renderer: 'overlay'`), build URLs generically from the manifest's `params` schema. The existing `buildGraphicUrlFromRegistry()` function already does this — expand it to handle all overlay graphics (including the "complex" ones that currently have dedicated builders). The manifest's `params` field defines exactly which URL params are needed.

For **output.html graphics** (`renderer: 'output'`), keep existing URL patterns (these are the event summary and other output.html-rendered graphics that haven't migrated yet).

**What `?graphic=` does in stage.html standalone mode:**
1. Look up the graphic ID in the local registry
2. Build the render spec from `defaultData` + competition config
3. Render immediately (no Firebase listener needed)
4. Still applies theme if spec includes a `theme` object

**URL Generator sidebar:**

Replace the hand-maintained `baseGraphicTitles` object and hardcoded sidebar sections in `UrlGeneratorPage.jsx` with auto-generated sections from the registry:

```javascript
// Instead of a hardcoded titles object, derive sidebar from registry categories
const categories = getGraphicsByCategory(); // returns grouped by category + subcategory
// Sidebar renders each category as a collapsible section
```

This ensures that any graphic with a manifest automatically appears in the sidebar under the correct category.

---

### Task 5: Web Graphics Panel — Copyable URLs

Add renderer.html URLs to the Web Graphics Panel header.

**Current buttons:**
- "Copy Output URL" → `output.html?comp={compId}`
- "Copy Theme Output URL" → `output.html?comp={compId}&meetTheme={themeId}`

**New button (add, don't replace — both needed during migration):**
- "Copy Renderer URL" → `renderer/renderer.html?comp={compId}`

No theme URL variant needed — renderer.html gets theme data from the render spec, not from URL params.

**Button styling:** Same as existing copy buttons. Group the renderer URL visually below the output URLs with a subtle separator.

**After full migration:** Remove the output.html URL buttons.

---

### Task 6: Rundown System — Renderer Routing

Update the timesheet engine to include the `renderer` field when triggering graphics from rundown segments.

**Current behavior in timesheetEngine.js:**
```javascript
// When rundown triggers a graphic
db.ref(`competitions/${compId}/currentGraphic`).set({
  graphic: segmentGraphicId,
  data: { ... }
});
```

**New behavior:**
```javascript
const entry = graphicsRegistry.find(g => g.id === segmentGraphicId);
const firebaseRenderer = entry?.renderer === 'renderer' ? 'renderer' : 'output';

if (firebaseRenderer === 'renderer') {
  // Resolve theme (same resolveTheme helper used by GraphicsControl)
  const resolvedTheme = await resolveTheme(db, compConfig.meetTheme, segmentGraphicId);
  const spec = buildRenderSpec(entry, compConfig, resolvedTheme);

  db.ref(`competitions/${compId}/currentGraphic`).set({
    graphic: segmentGraphicId,
    renderer: 'renderer',
    data: spec
  });
} else {
  db.ref(`competitions/${compId}/currentGraphic`).set({
    graphic: segmentGraphicId,
    renderer: 'output',
    data: existingData
  });
}
```

**`buildRenderSpec(entry, compConfig, resolvedTheme)` constructs the spec from:**
- `entry.defaultData.blocks` (block types and default data)
- `compConfig` (team keys, logos, gender, session ID)
- `resolvedTheme` (fully resolved theme object with per-graphic overrides baked in)

---

### Task 7: Skeletons & Blocks Preview Section

Add a new section to the URL Generator and Web Graphics Panel sidebars.

**Section title:** "Skeletons & Blocks" (at the bottom of the sidebar, below all graphic categories)

**Contents:**
```
Skeletons & Blocks
  ├── Skeletons
  │   └── Full-Screen Card    [Preview] [Copy URL]
  ├── Blocks
  │   ├── Header Bar           [Preview] [Copy URL]
  │   ├── Leaderboard Table    [Preview] [Copy URL]
  │   └── Athlete Grid         [Preview] [Copy URL]
  └── Assemblies
      ├── Leaderboard (Full)   [Preview] [Copy URL]
      └── Roster (Full)        [Preview] [Copy URL]
```

**Preview links open in the iframe preview panel** (same as clicking any graphic).
**Copy URL copies the preview URL** to clipboard.

---

### Task 8: Renderer Badges in Sidebar

Add a small colored badge next to each graphic name in both the URL Generator and Web Graphics Panel sidebars, showing which renderer handles it.

**Badge values and colors:**
- `[stage]` — teal background — graphic uses the new stage engine
- `[overlay]` — gray background — graphic is a standalone overlay HTML file
- `[output]` — gray background — graphic is rendered by output.html

**Example sidebar:**
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

**Implementation:** Read the `renderer` field from the auto-generated registry for each graphic. The badge component is a small `<span>` with rounded corners and the renderer label.

**Why this matters:** During the migration period, some graphics will be on stage.html and others will still be on overlay/output. The badge tells the producer at a glance which system each graphic uses. As manifests are updated from `"renderer": "overlay"` → `"renderer": "stage"`, the badges update automatically on the next build.

---

### Task 9: Preview Iframe Renderer Indicator

When a graphic is selected in the URL Generator, show a label above the preview iframe indicating which rendering system is active and the full URL being loaded.

**Display format:**
```
┌─────────────────────────────────────────────────────┐
│  Rendering via stage.html                           │
│  stage/stage.html?comp=wcgnic-2026&graphic=lead...  │
├─────────────────────────────────────────────────────┤
│                                                     │
│              (preview iframe)                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Three variants:**
- Stage engine: `Rendering via stage.html` (teal text)
- Overlay: `Rendering via overlays/{filename}.html` (gray text)
- Output.html: `Rendering via output.html` (gray text)

**The full URL is shown below the label** (truncated with ellipsis if too long, full URL on hover tooltip). This lets the producer verify which file is being loaded without inspecting the iframe source.

**Implementation:** When the URL Generator builds the preview URL, it already knows the renderer (from the registry). Display the renderer label and URL in a small bar above the iframe.

---

### Task 10: Migration Status Report (Auto-Generated)

Add a `--status` flag to `buildGraphicsRegistry.js` that scans the filesystem and prints a migration progress report. This replaces the manually-maintained Block Catalog and Migration Tracker tables in the main PRD.

**Usage:**
```bash
node scripts/buildGraphicsRegistry.js --status
```

**What it scans:**

| Source | What It Tells Us |
|--------|-----------------|
| `stage/blocks/*.js` | Which blocks exist (built vs not) |
| `stage/graphics/*.json` (non-legacy) | Which graphics have been migrated to stage engine |
| `stage/graphics/legacy/*.json` | Which graphics are still on output.html/overlays |
| `stage/skeletons/*.html` | Which skeletons exist |

**Output format (printed to console):**

```
=== Renderer Migration Status ===

Blocks: 3/19 built
  ✓ header-bar          (used by 14 graphics)
  ✓ leaderboard-table   (used by 10 graphics)
  ✓ athlete-grid        (used by 1 graphic)
  ✗ sponsor-grid        (used by 1 graphic)
  ✗ stat-card           (used by 1 graphic)
  ...

Skeletons: 1/4 built
  ✓ full-screen-card
  ✗ lower-third
  ✗ full-bleed
  ✗ video-frame

Graphics: 11/70 migrated
  Full-Screen Cards:  11/14  ███████████░░░  79%
  Lower-Thirds:        0/7   ░░░░░░░░░░░░░   0%
  Full-Bleed:          0/6   ░░░░░░░░░░░░░   0%
  Video Frames:        0/20  ░░░░░░░░░░░░░   0%
  Standalone:          0/19  ░░░░░░░░░░░░░   0%

Blocked Graphics (blocks not yet built):
  sponsors-thanks — needs: sponsor-grid
  team-stats — needs: stat-card
  team-coaches — needs: coach-list
  ...
```

**How it determines "migrated":**
- A graphic manifest in `stage/graphics/` (not `legacy/`) with `"renderer": "stage"` = migrated
- A graphic manifest in `stage/graphics/legacy/` = still legacy
- A graphic in `stage/graphics/` whose required blocks don't all exist in `stage/blocks/` = blocked (manifest ready, blocks not yet built)

**How it determines block usage count:**
- For each block, count how many manifests reference it in their `blocks` array

**Integration:**
- Also runs automatically as part of `npm run build` (prints summary, does not fail)
- The `--status` flag shows the full detailed report; during build, only the one-line summary prints:
  `Migration: 11/70 graphics (16%), 3/19 blocks, 1/4 skeletons`

**Why this replaces manual tracking:** Once this exists, the Block Catalog and Migration Tracker in the main PRD become redundant. They can be replaced with a note: "Run `node scripts/buildGraphicsRegistry.js --status` for current migration progress."

---

## Verification Criteria

Phase 4 is complete when:

**Manifest & Registry:**
- [ ] `stage/graphics/categories.json` exists with all 5 categories, display labels, and sidebar order
- [ ] `scripts/buildGraphicsRegistry.js` exists and runs as part of `npm run build`
- [ ] Build script reads `categories.json` and validates every manifest's `category`/`subcategory` against it
- [ ] Build fails with clear error message if a manifest uses an unknown category (e.g., typo)
- [ ] Build script validates manifests (required fields, skeleton/block existence, no duplicate IDs)
- [ ] Build fails with clear error message if a manifest is invalid
- [ ] Build script checks block `themeVars` against block CSS — emits warnings for mismatches (does not fail build)
- [ ] `graphicsRegistry.generated.js` is produced from `stage/graphics/**/*.json`, exports both `GRAPHICS` and `CATEGORIES`
- [ ] `graphicsRegistry.js` imports from generated file — hand-written `GRAPHICS` object removed
- [ ] All existing graphics have manifest files (stage engine in `stage/graphics/`, legacy in `stage/graphics/legacy/`)
- [ ] Adding a new manifest file + running build → graphic appears in registry, URL Generator sidebar, and Web Graphics Panel automatically

**Renderer Routing:**
- [ ] Web Graphics Panel resolves theme from Firebase and bakes into spec for stage engine graphics
- [ ] Web Graphics Panel writes `renderer: "stage"` for leaderboard/roster graphics
- [ ] Web Graphics Panel writes `renderer: "output"` for all other graphics (including registry `'overlay'` entries)
- [ ] output.html ignores graphics with `renderer: "stage"` (clears display)
- [ ] output.html handles `renderer: undefined` (backwards compat — renders as before)
- [ ] stage.html ignores graphics with `renderer: "output"` or `undefined` (clears display)
- [ ] Switching from stage graphic → output graphic works cleanly (no overlap)
- [ ] Switching from output graphic → stage graphic works cleanly (no overlap)

**URL Generator:**
- [ ] URL Generator builds stage.html URLs for stage engine graphics (no `meetTheme` param)
- [ ] URL Generator builds overlay/output.html URLs from manifest `params` schema (no per-graphic switch cases)
- [ ] URL Generator sidebar populated from `categories.json` ordering + manifest `category`/`subcategory` — no hand-maintained titles list
- [ ] Sidebar categories appear in the order defined by `categories.json` `order` field
- [ ] Copyable stage.html URL appears in Web Graphics Panel

**Rundown & Theme:**
- [ ] Rundown system includes `renderer` field and resolved theme when triggering stage engine graphics
- [ ] `resolveTheme()` helper is shared between GraphicsControl, timesheet engine, and Theme Editor

**Preview:**
- [ ] Skeletons & Blocks preview section appears in URL Generator sidebar

**Renderer Indicators:**
- [x] Each graphic in URL Generator sidebar shows a `[stage]`, `[overlay]`, or `[output]` badge — **DONE 2026-04-01** (Task 18)
- [x] Each graphic in Web Graphics Panel sidebar shows the same badge — **DONE 2026-04-01** (Task 19)
- [x] `[stage]` badge is teal; `[overlay]` and `[output]` badges are gray — **DONE 2026-04-01** (Tasks 18, 19)
- [ ] Preview iframe shows "Rendering via {renderer}" label above the iframe
- [ ] Preview iframe shows the full URL being loaded (truncated with tooltip for long URLs)
- [ ] Badges update automatically when a manifest's `renderer` field changes

**Migration Status Report:**
- [ ] `node scripts/buildGraphicsRegistry.js --status` prints block, skeleton, and graphic migration counts
- [ ] Report shows which blocks exist vs missing, with usage counts
- [ ] Report shows per-category progress bars
- [ ] Report lists blocked graphics (manifest exists but required blocks missing)
- [ ] Summary line prints during normal builds: `Migration: X/Y graphics, X/Y blocks, X/Y skeletons`

**Backwards Compatibility:**
- [ ] All non-migrated graphics continue to work exactly as before
