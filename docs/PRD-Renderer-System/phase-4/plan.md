# Renderer System Phase 4: Tool Integration — Tasks

## Summary

**Total Tasks:** 22
**Files Touched:** 15 unique files
**Estimated Complexity:** Medium-High

Phase 4 connects the stage engine (built in Phases 1-3) to all producer tools. The key deliverables are:
1. Manifest-based graphics registry (auto-generated)
2. Renderer routing in all Firebase write paths
3. Theme resolution helper (shared between client and server)
4. URL Generator updates (sidebar from registry, renderer badges)
5. Migration status reporting

---

## Tasks

### Task 1: Create categories.json — COMPLETE
**Files:** `stage/graphics/categories.json` (new)
**Resolves:** PRD Architecture Decision 12 (lines 443-496)
**Verify:**
- [ ] File exists at `stage/graphics/categories.json`
- [ ] Contains 6 categories: `full-screen-cards`, `lower-thirds`, `full-bleed`, `video-frames`, `standalone`, `event-summary`
- [ ] Each category has `label`, `order`, and `subcategories` object
- [ ] Categories are ordered 1-6 (sidebar ordering)
- [ ] Subcategories match those listed in PRD line 449-489

**Notes:**
- Add `event-summary` category (from manifest-format.md spec, lines 278-329) — the PRD only lists 5 but event-summary is distinct
- `order` field controls sidebar display order
- Subcategories are optional (standalone has empty object)

---

### Task 2: Create stage engine manifest files — COMPLETE
**Files:** `stage/graphics/leaderboard-vt.json` through `leaderboard-bb.json`, `leaderboard-aa.json`, `team-roster.json` (12 files)
**Resolves:** PRD Architecture Decision 12 (lines 369-394)
**Verify:**
- [ ] 10 leaderboard manifests exist (fx, ph, sr, vt, pb, hb, ub, bb, aa, combined-aa)
- [ ] 1 team-roster manifest exists
- [ ] All have `renderer: "stage"`, `skeleton: "full-screen-card"`, `blocks: ["header-bar", "leaderboard-table"]` or `["header-bar", "athlete-grid"]`
- [ ] All have `category`, `subcategory`, `gender`, `transparent`, `keywords` fields
- [ ] Leaderboards have `params.apparatus` with correct default
- [ ] team-roster has `perTeam: true` and `labelTemplate: "{teamName} Roster"`

**Notes:**
- Use manifest-format.md spec (lines 179-227) as template
- Gender for leaderboards: UB/BB = `"womens"`, PH/SR/PB/HB = `"mens"`, VT/FX/AA = `"both"`
- combined-aa-leaderboard is special — needs `virtiusSessionId2` param

---

### Task 3: Create legacy overlay manifest files — COMPLETE
**Files:** `stage/graphics/legacy/*.json` (29 files)
**Resolves:** PRD Architecture Decision 12 (lines 399-423)
**Verify:**
- [x] Manifest exists for each overlay file in `overlays/` directory (except theme-loader.js, theme-overrides.css)
- [x] All have `renderer: "overlay"` and `file: "{filename}.html"`
- [x] All have `category`, `transparent`, `gender`, `keywords` fields
- [x] Params extracted from current graphicsRegistry.js entries
- [x] Total count: 29 manifests (team-roster has stage manifest from Task 2)

**Notes:**
- Reference legacy-overlays-inventory.md for complete list
- Extract params from graphicsRegistry.js entries (lines 52-1212)
- Included animated-background.html and clip-player.html (metadata-only, harmless)
- Include `meetTheme` param with `source: "theme"` for themed graphics

---

### Task 4: Create legacy output.html manifest files — COMPLETE
**Files:** `stage/graphics/legacy/summary-*.json`, `stage/graphics/legacy/now-competing.json` (15 files)
**Resolves:** PRD Architecture Decision 12 (lines 399-423)
**Verify:**
- [x] Manifests for summary-r1 through summary-r6 (6 files)
- [x] Manifests for summary-fx through summary-bb (8 files)
- [x] Manifest for now-competing
- [x] All have `renderer: "output"` and `file: "{graphic-name}"` (no .html)
- [x] Params match existing graphicsRegistry.js entries

**Notes:**
- Event summary has complex params: virtiusSessionId, summaryMode, summaryRotation/summaryApparatus, summaryNumTeams, summaryFormat, summaryTheme, summaryGender
- Reference current-registry-structure.md for param schemas
- leaderboards are NOT legacy output — they have stage manifests (Task 2)

---

### Task 5: Create buildGraphicsRegistry.js script (scaffolding) — COMPLETE
**Files:** `scripts/buildGraphicsRegistry.js` (new)
**Resolves:** PRD Architecture Decision 12 (lines 426-437)
**Verify:**
- [ ] Script exists at `scripts/buildGraphicsRegistry.js`
- [ ] Runs without errors: `node scripts/buildGraphicsRegistry.js`
- [ ] Reads `stage/graphics/categories.json`
- [ ] Globs `stage/graphics/**/*.json` (excluding categories.json)
- [ ] Parses each manifest JSON
- [ ] Outputs count of manifests found

**Notes:**
- Use Node.js fs and path modules (no external deps)
- Glob pattern: `stage/graphics/**/*.json` + exclude `categories.json`
- This task just creates the scaffolding — validation comes in Task 6

---

### Task 6: Add manifest validation to build script — COMPLETE
**Files:** `scripts/buildGraphicsRegistry.js`
**Resolves:** PRD lines 516-526 (validation requirements)
**Verify:**
- [ ] Build fails with clear error if manifest missing required field (`id`, `label`, `category`)
- [ ] Build fails if `category` not in categories.json
- [ ] Build fails if `subcategory` not in categories.json (for that category)
- [ ] Build fails if duplicate `id` across manifests
- [ ] Build fails if stage engine manifest missing `skeleton` or `blocks`
- [ ] Error message includes filename and valid options

**Notes:**
- Required fields: id, label, category (all), renderer (all), skeleton/blocks (stage), file (legacy)
- Fail with exit code 1 on validation error
- Print all errors before exiting (don't fail on first)

---

### Task 7: Add skeleton/block existence validation — NOT STARTED
**Files:** `scripts/buildGraphicsRegistry.js`
**Resolves:** PRD lines 517-518
**Verify:**
- [ ] Build fails if stage manifest references skeleton that doesn't exist in `stage/skeletons/`
- [ ] Build fails if stage manifest references block that doesn't exist in `stage/blocks/`
- [ ] Error message shows missing file path

**Notes:**
- Check for `stage/skeletons/{skeleton}.html` (or .css)
- Check for `stage/blocks/{block}.js`
- Only applies to manifests with `renderer: "stage"`

---

### Task 8: Add themeVars CSS validation (warnings) — NOT STARTED
**Files:** `scripts/buildGraphicsRegistry.js`
**Resolves:** PRD lines 521-526, 836-851
**Verify:**
- [ ] For each stage block, read block's `.js` file and extract `themeVars` array
- [ ] Read block's `.css` file and check for `var(--meet-*` patterns
- [ ] Emit warning if themeVars declares variable not in CSS
- [ ] Emit warning if CSS uses `--meet-*` variable not in themeVars
- [ ] Warnings do NOT fail build (exit 0)
- [ ] Warnings are clearly labeled as warnings

**Notes:**
- Block JS exports `themeVars: ['--meet-header-bg', ...]`
- Parse with regex, not eval — look for `themeVars:` followed by array literal
- CSS pattern: `/var\(--meet-([a-z-]+)/g`

---

### Task 9: Generate graphicsRegistry.generated.js — NOT STARTED
**Files:** `scripts/buildGraphicsRegistry.js`, `show-controller/src/lib/graphicsRegistry.generated.js` (new)
**Resolves:** PRD lines 427-428, 980-984
**Verify:**
- [ ] Running build script creates `graphicsRegistry.generated.js`
- [ ] File exports `GRAPHICS` object keyed by `id`
- [ ] File exports `CATEGORIES` object from categories.json
- [ ] Each GRAPHICS entry has all manifest fields
- [ ] perTeam graphics have `perTeam: true`
- [ ] File has header comment indicating it's auto-generated

**Notes:**
- Output format: ES module with named exports
- `export const GRAPHICS = { ... };`
- `export const CATEGORIES = { ... };`
- Add timestamp in header comment

---

### Task 10: Update graphicsRegistry.js to import generated file — NOT STARTED
**Files:** `show-controller/src/lib/graphicsRegistry.js`
**Resolves:** PRD lines 427-428
**Verify:**
- [ ] graphicsRegistry.js imports from `./graphicsRegistry.generated`
- [ ] Hand-written GRAPHICS object is removed
- [ ] All helper functions unchanged (getAllGraphics, getGraphicById, etc.)
- [ ] `npm run build` succeeds in show-controller
- [ ] Existing functionality still works

**Notes:**
- Keep all helper functions (lines 1215-1405 per current-registry-structure.md)
- Helper functions read from imported GRAPHICS
- During migration, can merge hand-written entries with generated if needed

---

### Task 11: Integrate build script into npm scripts — NOT STARTED
**Files:** `show-controller/package.json`, `package.json` (root)
**Resolves:** PRD lines 435-437
**Verify:**
- [ ] `show-controller/package.json` has `"prebuild": "node ../scripts/buildGraphicsRegistry.js"`
- [ ] `npm run build` in show-controller runs the script first
- [ ] `npm run dev` in show-controller runs the script first (optional but nice)
- [ ] Build fails if script fails

**Notes:**
- npm runs `prebuild` automatically before `build`
- Script must exit 0 on success, non-zero on failure

---

### Task 12: Create resolveTheme() helper (client-side) — NOT STARTED
**Files:** `show-controller/src/lib/themeResolver.js` (new)
**Resolves:** PRD Architecture Decision 10 (lines 271-330), Phase 4 spec gap A
**Verify:**
- [ ] File exports `resolveTheme(db, themeId, graphicId)` async function
- [ ] Returns null if no themeId
- [ ] Fetches theme from `themes/{themeId}`
- [ ] Returns null if theme not found
- [ ] Returns flat object with all 8 color fields
- [ ] Merges per-graphic overrides from `theme.overrides[graphicId]`
- [ ] Includes image fields (headerBgImage, bodyBgImage, etc.)
- [ ] Includes logo fields (meetLogo, causeLogo)
- [ ] Handles v2.0 field names with fallback (headerBg → headerBar)

**Notes:**
- See theme-resolution-patterns.md (lines 149-220) for complete mapping
- Color fields: headerBg, headerText, contentBg, overlayBg, overlayText, borderColor, badgeBg, badgeText
- Image fields: headerBgImage, headerBgImageFit, headerBgImagePosition, headerBgImageOpacity, bodyBgImage, bodyTexture, bodyTextureOpacity, bodyTextureBlend
- Layout fields passed through in `resolved.layout` object

---

### Task 13: Create resolveTheme() helper (server-side) — NOT STARTED
**Files:** `server/lib/themeResolver.js` (new)
**Resolves:** PRD Architecture Decision 10, Phase 4 spec gap A
**Verify:**
- [ ] File exports same function signature as client version
- [ ] Uses Firebase Admin SDK (`.once('value')` not `get()`)
- [ ] Same resolution logic as client
- [ ] Handles missing theme gracefully (returns null)

**Notes:**
- Server uses `db.ref().once('value')` not `get(ref(db, path))`
- Keep logic identical to client version
- Consider extracting shared logic to avoid duplication (but not blocking)

---

### Task 14: Update GraphicsControl.jsx for stage renderer routing — NOT STARTED
**Files:** `show-controller/src/components/GraphicsControl.jsx`
**Resolves:** PRD Architecture Decision 1 (lines 58-90), Phase 4 doc Task 2
**Verify:**
- [ ] Import `resolveTheme` from `../lib/themeResolver`
- [ ] Import `getGraphicById` if not already imported
- [ ] In sendGraphic(): look up registry entry, compute `firebaseRenderer`
- [ ] If `firebaseRenderer === 'stage'`: call `resolveTheme()` and build render spec
- [ ] Write `renderer: firebaseRenderer` in all set() calls
- [ ] Data includes `skeleton`, `blocks`, `theme` for stage graphics
- [ ] sendGraphic() made async if not already
- [ ] clearGraphic() unchanged (no renderer field — both engines clear)

**Notes:**
- See graphics-control-set-calls.md for all 7 set() locations
- Only sendGraphic() needs dynamic routing — others hardcode 'output'
- Renderer field already exists in most calls (line 494 etc.) — just verify/update
- Build spec from registry entry's `defaultData.blocks` + resolved theme

---

### Task 15: Update timesheetEngine.js for stage renderer routing — NOT STARTED
**Files:** `server/lib/timesheetEngine.js`
**Resolves:** PRD lines 1028-1033, Phase 4 doc Task 6
**Verify:**
- [ ] Import `resolveTheme` from `./themeResolver`
- [ ] Import registry data (see notes)
- [ ] In _triggerGraphic(): look up registry entry, compute `firebaseRenderer`
- [ ] If `firebaseRenderer === 'stage'`: call `resolveTheme()` and build render spec
- [ ] Write `renderer: firebaseRenderer` in graphicData object
- [ ] Server-side theme resolution works

**Notes:**
- Registry data needs to be accessible on server — either:
  a) Import graphicsRegistry.generated.js (requires bundling or copy)
  b) Duplicate registry data in server (simple but redundant)
  c) Load from a shared JSON file
- Recommend option (c): build script also outputs `stage/graphics-registry.json` for server
- See timesheet-graphics-triggering.md for _triggerGraphic structure

---

### Task 16: Verify output.html renderer check (already implemented) — NOT STARTED
**Files:** `output.html`
**Resolves:** PRD lines 85-86
**Verify:**
- [ ] Lines 14246-14255 contain renderer check
- [ ] Check: `if (renderer === 'stage')` → clears output and returns
- [ ] Check handles `renderer: undefined` (backwards compat — renders normally)
- [ ] No changes needed (verification only)

**Notes:**
- Per output-html-renderer-check.md, this was implemented in Phase 1
- This task is verification only — confirm behavior matches spec

---

### Task 17: Update URL Generator sidebar to use registry categories — NOT STARTED
**Files:** `show-controller/src/pages/UrlGeneratorPage.jsx`
**Resolves:** PRD lines 499-501, Phase 4 doc Task 4
**Verify:**
- [ ] Import `CATEGORIES` from graphicsRegistry
- [ ] Remove `baseGraphicTitles` object (lines 54-118)
- [ ] Remove `getGraphicTitles()` function (lines 121-128)
- [ ] Sidebar sections generated from CATEGORIES ordering
- [ ] Graphics grouped by category/subcategory from registry
- [ ] Labels come from manifest `label` field
- [ ] Existing functionality preserved (preview, URL generation)

**Notes:**
- This is a large refactor — may need to keep some special handling
- Combined AA Leaderboard has special session ID inputs — preserve
- Event Summary has theme dropdown — preserve
- Rotation Slate has layout picker — preserve
- Test thoroughly after changes

---

### Task 18: Add renderer badges to URL Generator sidebar — NOT STARTED
**Files:** `show-controller/src/pages/UrlGeneratorPage.jsx`
**Resolves:** PRD lines 997-1007, Phase 4 doc Task 8
**Verify:**
- [ ] Each graphic button shows renderer badge: [stage], [overlay], or [output]
- [ ] Badge colors: stage = teal (`bg-teal-500/20 text-teal-400`), overlay/output = gray
- [ ] Badge is small: `text-[9px] px-1.5 py-0.5 rounded`
- [ ] Badge reads from registry `renderer` field
- [ ] GraphicSidebarButton component updated to accept `renderer` prop

**Notes:**
- See sidebar-badge-patterns.md for styling patterns
- Add to existing GraphicSidebarButton component (lines 1426-1440)
- Badge appears at right edge of button

---

### Task 19: Add renderer badges to Web Graphics Panel — NOT STARTED
**Files:** `show-controller/src/components/GraphicsControl.jsx`
**Resolves:** PRD lines 1024-1025
**Verify:**
- [ ] Same badge pattern as URL Generator
- [ ] Badges appear next to graphic names in panel
- [ ] Colors match URL Generator

**Notes:**
- Reuse badge component from Task 18 if extracted
- May need to create shared RendererBadge component

---

### Task 20: Add preview iframe renderer indicator — NOT STARTED
**Files:** `show-controller/src/pages/UrlGeneratorPage.jsx`
**Resolves:** PRD lines 1009-1015, Phase 4 doc Task 9
**Verify:**
- [ ] Above preview iframe: label showing "Rendering via stage.html" / "overlays/{file}.html" / "output.html"
- [ ] Label text color: teal for stage, gray for others
- [ ] Full URL displayed below label (truncated with tooltip if long)
- [ ] Updates when graphic selection changes

**Notes:**
- Insert above the preview container (around line 823)
- Use registry `renderer` and `file` fields to build label
- Tooltip shows full URL on hover

---

### Task 21: Add copyable stage.html URL to Web Graphics Panel — NOT STARTED
**Files:** `show-controller/src/components/GraphicsControl.jsx`
**Resolves:** PRD lines 178-183, Phase 4 doc Task 5
**Verify:**
- [ ] "Copy Stage URL" button appears in header
- [ ] Copies: `https://commentarygraphic.com/stage/stage.html?comp={compId}`
- [ ] Visual feedback on copy (checkmark or tooltip)
- [ ] Existing output.html copy buttons unchanged

**Notes:**
- Add alongside existing copy buttons
- Group visually with separator or label

---

### Task 22: Add migration status report to build script — NOT STARTED
**Files:** `scripts/buildGraphicsRegistry.js`
**Resolves:** PRD Block Catalog note (line 1184), Phase 4 doc Task 10
**Verify:**
- [ ] `node scripts/buildGraphicsRegistry.js --status` prints detailed report
- [ ] Report shows blocks: X/Y built (lists each with checkmark or X)
- [ ] Report shows skeletons: X/Y built
- [ ] Report shows graphics: X/Y migrated (per category with progress bars)
- [ ] Report shows blocked graphics (manifest ready, blocks missing)
- [ ] Normal build prints one-line summary: "Migration: X/Y graphics, X/Y blocks, X/Y skeletons"

**Notes:**
- "Built" = file exists in stage/blocks/ or stage/skeletons/
- "Migrated" = manifest in stage/graphics/ (not legacy/) with renderer: "stage"
- "Blocked" = stage manifest but referenced blocks don't exist
- Use ASCII progress bars for visual

---

## Discovered Bugs

(Populated by iterations as they find problems)

---

## Learnings

(Breadcrumbs for future iterations — the next iteration has ZERO memory)

### Key Dependencies

1. **Task 1 (categories.json)** must complete before Tasks 2-4 (manifests) and Task 6 (validation)
2. **Tasks 2-4 (manifests)** must complete before Task 9 (generated registry)
3. **Task 9 (generated registry)** must complete before Task 10 (update graphicsRegistry.js)
4. **Task 10** must complete before Tasks 17-21 (UI updates that read from registry)
5. **Tasks 12-13 (resolveTheme)** must complete before Tasks 14-15 (renderer routing)

### Critical Order

Execute in this sequence to avoid blocking:
1. Tasks 1, 5 (can run in parallel — foundation)
2. Tasks 2-4, 6-8 (manifests + validation — builds on 1, 5)
3. Task 9 (generation — needs 2-4 complete)
4. Tasks 10-11 (integration — needs 9)
5. Tasks 12-13 (theme resolver — independent)
6. Tasks 14-16 (renderer routing — needs 12-13)
7. Tasks 17-21 (UI updates — needs 10)
8. Task 22 (status report — needs everything)

### File Paths Reference

| Purpose | Path |
|---------|------|
| Categories definition | `stage/graphics/categories.json` |
| Stage engine manifests | `stage/graphics/{graphic-id}.json` |
| Legacy manifests | `stage/graphics/legacy/{graphic-id}.json` |
| Build script | `scripts/buildGraphicsRegistry.js` |
| Generated registry | `show-controller/src/lib/graphicsRegistry.generated.js` |
| Theme resolver (client) | `show-controller/src/lib/themeResolver.js` |
| Theme resolver (server) | `server/lib/themeResolver.js` |
| Server registry JSON | `stage/graphics-registry.json` (for server import) |

### Registry Renderer Field Mapping

- Manifest `renderer: "stage"` → Firebase `renderer: "stage"`
- Manifest `renderer: "overlay"` → Firebase `renderer: "output"` (overlay is metadata, Firebase only uses stage/output)
- Manifest `renderer: "output"` → Firebase `renderer: "output"`

### Phase 4 PRD Terminology Note

The Phase 4 doc uses "renderer.html" in several places but the actual file is `stage.html`. Replace all references:
- "renderer.html" → "stage.html"
- `'renderer'` → `'stage'` (in code examples)

### graphicsRegistry.js Helper Functions to Preserve

Keep these functions unchanged — only the data source changes:
- `getAllGraphics()` (line 1223)
- `getGraphicById(id)` (line 1232)
- `getGraphicsByCategory(category)` (line 1241)
- `getCategories()` (line 1249)
- `isGraphicAvailable(graphic, compType, teamCount)` (line 1261)
- `getGraphicsForCompetition(compType, teamNames, category?)` (line 1281)
- `getRecommendedGraphic(segmentName, compType, teamNames?)` (line 1333)
- `isTransparentGraphic(graphicId)` (line 1385)

### perTeam Expansion

The `perTeam: true` field causes expansion in `getGraphicsForCompetition()`:
- `team-roster` → `team1-roster`, `team2-roster`, etc.
- Uses `labelTemplate: "{teamName} Roster"` for dynamic labels
- Expansion happens at runtime, not in manifest generation

### URL Builder Simplification

After manifest migration:
- Stage graphics: always `stage/stage.html?comp={compId}&graphic={id}` — no per-graphic logic
- Overlay graphics: generic params-to-URL from manifest schema
- Output graphics: keep existing patterns until migrated
- The 21 switch cases + 14 builder functions in urlBuilder.js can be removed incrementally

### Theme Data Structure

v3.0 field names (preferred) with v2.0 fallbacks:
```
colors.headerBar     || colors.headerBg      → --meet-header-bg
colors.contentArea   || colors.accentPrimary → --meet-content-bg
colors.bodyBackground|| colors.overlayBg     → --meet-overlay-bg
colors.textOnHeader  || colors.headerText    → --meet-header-text
colors.textOnContent || colors.overlayText   → --meet-overlay-text
colors.borderDivider || colors.borderColor   → --meet-border-color
colors.badge         || colors.badgeBg       → --meet-badge-bg
colors.badgeText                             → --meet-badge-text
```

### Server Registry Access

Server needs registry data for `_triggerGraphic()` renderer detection. Options:
1. Build script outputs `stage/graphics-registry.json` alongside generated JS
2. Server loads this JSON at startup
3. Import in timesheetEngine: `const GRAPHICS = require('../../../stage/graphics-registry.json')`

This avoids bundler complexity while keeping single source of truth.

### Task 3 Learnings

- **29 legacy overlay manifests created** in `stage/graphics/legacy/` — team-roster is NOT duplicated because it has a stage engine manifest from Task 2
- **Category mapping:** Use categories.json subcategories exactly — lower-thirds has event-info/team-stats/spotlight, video-frames has camera-layouts/apparatus, full-bleed has slates/stream/sponsors
- **perTeam graphics:** 5 overlays use perTeam: team-stats, coaches, athlete-spotlight, who-to-watch, who-to-watch-title
- **All overlays have meetTheme param:** Added `"meetTheme": { "type": "string", "source": "theme" }` to all themed graphics
- **Validation script:** Created `/tmp/validate-manifests.js` for quick validation — can be incorporated into build script later

### Task 4 Learnings

- **15 legacy output.html manifests created** in `stage/graphics/legacy/` — 6 rotation summaries (r1-r6) + 8 apparatus summaries (fx, ph, sr, vt, pb, hb, ub, bb) + 1 now-competing
- **Event summary uses `file: "event-summary"`** (no .html extension) — all 14 summary variants share the same file reference
- **Gender filtering:** summary-r5, summary-r6, summary-ph, summary-sr, summary-pb, summary-hb use `"gender": "mens"` (R5/R6 are men's-only rotations, PH/SR/PB/HB are men's-only apparatus)
- **Gender filtering:** summary-ub, summary-bb use `"gender": "womens"` (women's-only apparatus)
- **Rotation params vs apparatus params:** Rotation summaries use `summaryMode: "rotation"` + `summaryRotation: N`; apparatus summaries use `summaryMode: "apparatus"` + `summaryApparatus: "xx"` + `summaryFormat: "head-to-head"`
- **now-competing is NOT in graphicsRegistry.js** — it's dynamically triggered by GraphicsControl.jsx's sendNowCompeting() function, but still needs a manifest for the build script to recognize it
- **Total manifest count after Task 4: 44 files** in `stage/graphics/legacy/` (29 overlays from Task 3 + 15 output.html graphics from Task 4)

### Task 5 Learnings

- **Build script location:** `scripts/buildGraphicsRegistry.js` — uses only Node.js built-in modules (fs, path), no external deps
- **Recursive file finding:** Use `fs.readdirSync` with `withFileTypes: true` to distinguish files from directories
- **Manifest counts verified:** 11 stage + 29 overlay + 15 output = 55 total manifests
- **Script structure:** Separate functions for `findManifestFiles()`, `loadJSON()`, and `build()` — makes adding validation straightforward in Task 6

### Task 6 Learnings

- **Validation collects ALL errors before failing** — displays every error, then exits with code 1. This avoids fix-one-rerun-fix-another cycles.
- **Six validation checks implemented:**
  1. Required fields: `id`, `label`, `category`, `renderer` (all manifests)
  2. Category must exist in categories.json
  3. Subcategory must exist in categories.json for that category (if subcategory is present)
  4. Stage renderer requires `skeleton` field
  5. Stage renderer requires non-empty `blocks` array
  6. No duplicate IDs across all manifests
- **Error messages include relative file paths** and list valid options (e.g., "Valid categories: full-screen-cards, lower-thirds, ...")
- **Validation runs before summary output** — if validation fails, no summary is printed
