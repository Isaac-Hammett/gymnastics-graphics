# Renderer System Phase 7: Polish — Tasks

## Tasks

### Task 1: Wire leaderboard-table.css to theme variables — COMPLETE
**Issues:** Leaderboard theme mapping spec (14 structural colors → 6 CSS variables)
**Files:** `stage/blocks/leaderboard-table.css`

Replace 14 structural hardcoded colors with 3-layer cascade pattern. Keep 4 semantic colors hardcoded (gold/silver/bronze medals, stick bonus green).

**Color mapping (14 replacements):**
- Lines 24, 123: `#27272a` → `var(--leaderboard-table-content-bg, var(--meet-content-bg, #27272a))` (header row bg, team logo bg)
- Line 31: `#a1a1aa` → `var(--leaderboard-table-header-text, var(--meet-header-text, #a1a1aa))` (column header text)
- Lines 32, 52: `#3f3f46` → `var(--leaderboard-table-border-color, var(--meet-border-color, #3f3f46))` (header border, row borders)
- Line 56: `#18181b` → double-declaration with `color-mix()` fallback for odd rows
- Line 60: `#0f0f10` → `var(--leaderboard-table-overlay-bg, var(--meet-overlay-bg, #0f0f10))` (even rows)
- Line 66, 145: `#fff` → `var(--leaderboard-table-overlay-text, var(--meet-overlay-text, #fff))` (name/score text)
- Line 75: `#a1a1aa` → overlay-text variable + `opacity: 0.65` (rank text)
- Line 80: `#71717a` → overlay-text variable + `opacity: 0.45` (rank superscript)
- Line 112: `#d4d4d8` → overlay-text variable + `opacity: 0.85` (team text)
- Line 134: `#52525b` → border-color variable (apparatus badge border)
- Line 137: `#a1a1aa` → `var(--leaderboard-table-badge-text, var(--meet-badge-text, #a1a1aa))` (apparatus badge text)
- Line 154: `#a1a1aa` → overlay-text variable + `opacity: 0.65` (diff/exec text)

**Odd row strategy (double-declaration for color-mix fallback):**
```css
.block-leaderboard-table tbody tr:nth-child(odd) {
  background: var(--leaderboard-table-row-odd-bg, #18181b);
  background: var(--leaderboard-table-row-odd-bg, 
    color-mix(in srgb, var(--meet-overlay-bg, #18181b) 92%, white));
}
```

**Semantic colors to keep hardcoded (do NOT change):**
- Line 99: `#facc15` (gold medal)
- Line 103: `#d4d4d8` (silver medal)
- Line 107: `#d97706` (bronze medal)
- Line 170: `#22c55e` (stick bonus bg)
- Line 171: `#fff` (stick bonus text)

**Verify:**
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table` renders with default dark colors (visual match to current look)
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table&theme=behind-the-chalk` renders with theme colors on: header row, row backgrounds, text, borders, badges
- [ ] Medal colors unchanged (gold/silver/bronze circles)
- [ ] Stick bonus green unchanged
- [ ] Row contrast maintained (odd rows visibly different from even rows)
- [ ] Muted text (rank, team, diff/exec) visually similar to current look
- [ ] No console errors

---

### Task 2: Update leaderboard-table.js themeVars declaration — NOT STARTED
**Issues:** PRD gap analysis (GAP 3, GAP 6), leaderboard theme mapping spec
**Files:** `stage/blocks/leaderboard-table.js`

Update the `themeVars` array (lines 11-18) to match actual CSS variable usage after Task 1.

**Current themeVars (6 vars):**
```javascript
themeVars: [
  '--meet-content-bg',
  '--meet-overlay-bg',
  '--meet-overlay-text',
  '--meet-border-color',
  '--meet-badge-bg',    // REMOVE — not used (medals hardcoded)
  '--meet-badge-text'
]
```

**Updated themeVars (6 vars):**
```javascript
themeVars: [
  '--meet-content-bg',
  '--meet-header-text',  // ADD — used for column header text
  '--meet-overlay-bg',
  '--meet-overlay-text',
  '--meet-border-color',
  '--meet-badge-text'
]
```

Changes: Remove `--meet-badge-bg` (no element uses it), add `--meet-header-text` (column header text).

**Verify:**
- [ ] `npm run build:registry` (or equivalent) passes with no themeVars warnings for leaderboard-table
- [ ] themeVars array has exactly 6 entries matching the 6 unique `--meet-*` variables used in CSS
- [ ] No console errors when loading leaderboard preview

---

### Task 3: Verify leaderboard theming in OBS browser source — NOT STARTED
**Issues:** color-mix compatibility spec
**Files:** None (verification only — deploy Task 1+2 first)

Verify that the themed leaderboard renders correctly in the OBS browser source on the production VM. The key risk is `color-mix()` support in OBS's Chromium version.

**Steps:**
1. Deploy stage/blocks/ to production (follow CLAUDE.md deploy step 2.5)
2. Load themed leaderboard in OBS browser source at 1920x1080
3. Check odd/even row contrast with a theme applied

**If color-mix() fails in OBS:** Switch odd row background to the pseudo-element approach:
```css
.block-leaderboard-table tbody tr:nth-child(odd) {
  position: relative;
  background: var(--leaderboard-table-row-odd-bg, var(--meet-overlay-bg, #18181b));
}
.block-leaderboard-table tbody tr:nth-child(odd)::before {
  content: ''; position: absolute; inset: 0;
  background: white; opacity: 0.04; pointer-events: none;
}
```

**Verify:**
- [ ] Themed leaderboard renders in OBS browser source at 1920x1080
- [ ] Row backgrounds show theme colors with visible odd/even contrast
- [ ] Text and borders respond to theme
- [ ] No visual artifacts or broken layout
- [ ] No console errors in OBS browser source

---

### Task 4: Extend build script to export SKELETONS, BLOCKS, ASSEMBLIES — NOT STARTED
**Issues:** Build script extension spec
**Files:** `scripts/buildGraphicsRegistry.js`, `show-controller/src/lib/graphicsRegistry.generated.js`, `stage/graphics-registry.json`

Add three new exports to the generated registry. The discovery functions already exist (`getExistingSkeletons()` at line 512, `getExistingBlocks()` at line 496).

**New function — `deriveAssemblies(manifests)`:**
- Filter manifests with `renderer === 'stage'` AND `skeleton` AND `blocks.length > 0`
- Deduplicate by `skeleton + sorted blocks` key
- Generate label from block names: `header-bar` + `leaderboard-table` → "Header Bar + Leaderboard Table"
- Return array of `{ label, skeleton, blocks }` objects

**Modify `generateJsOutput()` (line 280):**
- Call `getExistingSkeletons()`, `getExistingBlocks()`, `deriveAssemblies(manifests)`
- Append three new `export const` lines after CATEGORIES export

**Modify `generateJsonOutput()` (line 320):**
- Add `skeletons`, `blocks`, `assemblies` fields to the output object

**Expected output:**
```javascript
export const SKELETONS = ["full-screen-card"];
export const BLOCKS = ["athlete-grid", "header-bar", "leaderboard-table"];
export const ASSEMBLIES = [
  { "label": "Header Bar + Leaderboard Table", "skeleton": "full-screen-card", "blocks": ["header-bar", "leaderboard-table"] },
  { "label": "Header Bar + Athlete Grid", "skeleton": "full-screen-card", "blocks": ["header-bar", "athlete-grid"] }
];
```

**Verify:**
- [ ] `node scripts/buildGraphicsRegistry.js` runs without errors
- [ ] `graphicsRegistry.generated.js` exports `SKELETONS` (array, ≥1 entry)
- [ ] `graphicsRegistry.generated.js` exports `BLOCKS` (array, ≥3 entries, no `_sample-block`)
- [ ] `graphicsRegistry.generated.js` exports `ASSEMBLIES` (array, ≥2 entries with `label`, `skeleton`, `blocks`)
- [ ] `graphics-registry.json` contains matching `skeletons`, `blocks`, `assemblies` fields
- [ ] `npm run build` passes in show-controller

---

### Task 5: Add Skeletons & Blocks section to URL Generator sidebar — NOT STARTED
**Issues:** URL Generator section spec
**Files:** `show-controller/src/pages/UrlGeneratorPage.jsx`

Add a new collapsible "Skeletons & Blocks" section after the last category section (line ~960), before the preview panel. Import `SKELETONS`, `BLOCKS`, `ASSEMBLIES` from the registry.

**New imports (add to line 6):**
```javascript
import { GRAPHICS, CATEGORIES, SKELETONS, BLOCKS, ASSEMBLIES } from '../lib/graphicsRegistry';
```

**URL patterns (stage.html uses `theme` param, not `meetTheme`):**
- Skeleton: `https://commentarygraphic.com/stage/stage.html?preview=skeleton&skeleton={name}`
- Block: `https://commentarygraphic.com/stage/stage.html?preview=block&block={name}`
- Assembly: `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton={s}&block={b1,b2}`
- Append `&theme={themeId}` when `config?.meetTheme` is set

**New inline component — `PreviewButton`:**
- Row layout: label (flex-1) + [Preview] button + [Copy URL] button
- Preview loads URL in the existing iframe (set `currentUrl` state)
- Copy URL uses existing `copyToClipboard` from urlBuilder

**Display name helper:** `name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')` → "Full Screen Card", "Leaderboard Table"

**Renderer indicator update (lines 981-1008):** When previewing a skeleton/block/assembly, show "Previewing: skeleton / full-screen-card" instead of looking up GRAPHICS entry.

**Verify:**
- [ ] "Skeletons & Blocks" section appears at bottom of sidebar
- [ ] Section is collapsed by default, expandable with click
- [ ] Lists all skeletons under "Skeletons" sub-heading
- [ ] Lists all blocks under "Blocks" sub-heading
- [ ] Lists all assemblies under "Assemblies" sub-heading
- [ ] [Preview] loads correct URL in iframe panel
- [ ] [Copy URL] copies full production URL to clipboard with toast
- [ ] With a competition selected (that has meetTheme), `&theme={themeId}` is appended
- [ ] Renderer indicator shows "Previewing: ..." text for stage previews
- [ ] No console errors
- [ ] `npm run build` passes

---

### Task 6: Add Skeletons & Blocks section to Web Graphics Panel — NOT STARTED
**Issues:** Graphics panel section spec
**Files:** `show-controller/src/components/GraphicsControl.jsx`

Add a new collapsible "Skeletons & Blocks" section before the Clear Button (insert at ~line 1177). Import `SKELETONS`, `BLOCKS`, `ASSEMBLIES` from the registry.

**New imports (add to line 7):**
```javascript
import { getGraphicsForCompetition, getGraphicsByCategory, getGraphicById, CATEGORIES, SKELETONS, BLOCKS, ASSEMBLIES } from '../lib/graphicsRegistry';
```

**URL patterns:** Same as Task 5 (production domain URLs). Append `&theme={config?.meetTheme}` when available.

**New inline component — `StagePreviewRow`:**
- Row layout: label (flex-1) + [Preview] `<a>` (new tab) + [Copy] button
- Preview: `<a href={url} target="_blank">` (follows existing "Local Output" pattern)
- Copy: `navigator.clipboard.writeText(url)` with existing state-based feedback pattern (green flash, 2s timeout)

**Verify:**
- [ ] "Skeletons & Blocks" section appears in sidebar (after custom graphics, before Clear button)
- [ ] Section is collapsed by default
- [ ] Lists skeletons, blocks, and assemblies
- [ ] [Preview] opens stage.html preview URL in new tab
- [ ] [Copy] copies full production URL to clipboard with green check feedback
- [ ] With competition that has meetTheme, `&theme={themeId}` is appended
- [ ] No console errors
- [ ] `npm run build` passes

---

### Task 7: Deploy and production verify — NOT STARTED
**Issues:** All Phase 7 specs converge here
**Files:** Production deploy (no local file changes)

Deploy all Phase 7 changes to production following CLAUDE.md deploy steps.

**Deploy order:**
1. Build React SPA: `cd show-controller && npm run build`
2. Deploy React SPA (step 1)
3. Deploy stage/ directory (step 2.5) — includes updated leaderboard-table.css and .js
4. Verify deployment

**Verify:**
- [ ] Themed leaderboard renders on production: `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table&theme=behind-the-chalk`
- [ ] Unthemed leaderboard renders with default colors (no regression)
- [ ] Skeletons & Blocks section visible in URL Generator on production
- [ ] Skeletons & Blocks section visible in Web Graphics Panel on production
- [ ] Assembly preview URLs load correctly on production
- [ ] Block preview URLs load correctly on production
- [ ] No console errors on main site
- [ ] No regressions to existing graphics (spot-check event-bar, rotation-slate, sponsors-thanks)

---

## Task Dependency Graph

```
Task 1 (CSS theming) ──→ Task 2 (themeVars) ──→ Task 3 (OBS verify) ──→ Task 7 (deploy)
Task 4 (build script) ──→ Task 5 (URL Generator) ──→ Task 7 (deploy)
                      ──→ Task 6 (Graphics Panel) ──→ Task 7 (deploy)
```

Tracks 1-3 and 4-6 are independent. Tasks 5 and 6 can run in parallel after Task 4. Task 7 converges both tracks.

---

## Discovered Bugs
(populated by iterations as they find problems)

## Learnings
- LEARNING: Playwright browser tools are not available in this environment (VSCode extension context). Local screenshot verification must be done manually or deferred to a deploy+verify task. The CSS-only changes were verified by reading the file and confirming all 14 structural color replacements match the spec.
- LEARNING: The odd row double-declaration pattern works by having two `background:` lines — the first uses a plain fallback (`#18181b`) for browsers that don't support `color-mix()`, and the second uses `color-mix()`. Browsers that support `color-mix()` override the first declaration.
- LEARNING: Opacity-based muting (0.65, 0.45, 0.85) is used for rank, rank-sup, team, and diff/exec text instead of `color-mix()` to maximize OBS Chromium compatibility. Only the odd row bg uses `color-mix()`.
- LEARNING: The 3-layer cascade naming convention is `--{blockId}-{suffix}` for layer 3, `--meet-{suffix}` for layer 2, and a hex fallback for layer 1. Example: `var(--leaderboard-table-overlay-text, var(--meet-overlay-text, #fff))`.
