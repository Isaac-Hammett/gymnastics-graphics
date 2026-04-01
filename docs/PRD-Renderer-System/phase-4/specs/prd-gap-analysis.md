# PRD Gap Analysis — Phase 4 vs Parent PRD

## What

Cross-reference of the parent PRD (`PRD-Renderer-System-2026-03-28.md`) against the Phase 4 doc (`Phase-4-Tool-Integration.md`) to identify gaps and contradictions.

## Summary

| Category | Gaps Found | Contradictions Found |
|----------|------------|---------------------|
| Architecture Decisions | 2 | 1 |
| Manifest System | 3 | 0 |
| Renderer Routing | 0 | 1 |
| Theme Resolution | 1 | 0 |
| Migration Status | 1 | 0 |

---

## Detailed Gap Analysis

### Architecture Decision 1: Same `currentGraphic` Firebase Path

**PRD Requirement (lines 58-90):**
- Firebase `renderer` field uses only two values: `"stage"` or `"output"`
- Registry has three values (`'overlay'`, `'output'`, `'stage'`), but `'overlay'` maps to `"output"` in Firebase
- Mapping logic: `entry.renderer === 'stage' ? 'stage' : 'output'`

**Phase 4 Coverage:** ✓ Task 2 (lines 179-244) correctly describes the mapping logic.

**Gap:** None

---

### Architecture Decision 10: Self-Contained Theme Data

**PRD Requirement (lines 271-330):**
- stage.html does NOT use `theme-loader.js`
- Theme data is fully resolved at trigger time and baked into the render spec
- Show controller resolves theme from Firebase, includes per-graphic overrides
- The render spec is fully self-contained

**Phase 4 Coverage:** Partial. Task 2 (lines 207-237) describes theme resolution, but:

**Gap 1:** PRD specifies a `resolveTheme()` helper that is "shared between GraphicsControl, the timesheet engine, and the Theme Editor" (line 237). Phase 4 describes it in Task 2 but does NOT include a dedicated task for creating this shared helper. The helper should be its own task (e.g., Task 2B: Create resolveTheme() Helper).

**Gap 2:** The PRD specifies that the `theme` object in the spec should include image overrides (`headerBgImage`, `logo`, `bodyTexture`, etc.) — Phase 4 Task 2 only mentions color resolution.

---

### Architecture Decision 12: Graphic Manifests & Auto-Discovery

**PRD Requirement (lines 355-528):**
- Manifests live in `stage/graphics/` (stage engine) and `stage/graphics/legacy/` (overlay/output)
- `categories.json` defines valid categories, display labels, and sidebar order
- Build script validates manifests and fails the build on errors
- Build script checks block `themeVars` against CSS — emits warnings
- Generated registry exports both `GRAPHICS` and `CATEGORIES`

**Phase 4 Coverage:** Task 1 (lines 21-44), Task 1B-1D (lines 46-175).

**Gap 3:** PRD says build script should emit **warnings** for themeVars mismatches (line 521-526). Phase 4 Task 1 says "These are warnings only — they do not fail the build" (line 34). ✓ Aligned.

**Gap 4:** PRD specifies manifests should include a `gender` field (line 381). Phase 4 examples include gender. ✓ Aligned.

**Gap 5:** PRD says subcategory validation should fail the build (line 517). Phase 4 Task 1 mentions category validation but does not explicitly mention subcategory. **Needs clarification.**

---

### PRD: Sidebar Auto-Population (lines 499-501)

**PRD Requirement:**
- URL Generator and Web Graphics Panel sidebars generated from `categories.json` ordering + registry's `category`/`subcategory` fields
- No separate `baseGraphicTitles` object

**Phase 4 Coverage:** Task 4 (lines 310-319) mentions sidebar populated from registry categories, but:

**Gap 6:** Phase 4 does NOT explicitly state that `baseGraphicTitles` should be removed. Current codebase has this object at `UrlGeneratorPage.jsx:54-118`. Needs explicit removal task.

---

### PRD: Renderer Badge in Sidebar (lines 997-1007)

**PRD Requirement:**
- Badge colors: `[stage]` = teal, `[overlay]` = gray, `[output]` = gray
- Tells producer at a glance which system each graphic uses

**Phase 4 Coverage:** Task 8 (lines 411-435). ✓ Matches PRD.

---

### PRD: Preview Iframe Renderer Indicator (lines 1009-1015)

**PRD Requirement:**
- Shows "Rendering via stage.html", "Rendering via overlays/{file}.html", or "Rendering via output.html"
- Full URL visible below the label

**Phase 4 Coverage:** Task 9 (lines 437-461). ✓ Matches PRD.

---

### PRD: Scoring Ingestion (Architecture Decision 3)

**PRD Requirement (lines 134-164):**
- Competition Card shows status badge: "LIVE" or "OFF"
- Producer View has "Scoring Feed" panel with on/off toggle, interval selector, status

**Phase 4 Coverage:** Not mentioned. **This is Phase 3 scope, correctly excluded from Phase 4.**

---

### PRD: Block themeVars Declaration (lines 826-851)

**PRD Requirement:**
- Each block's JS declares `themeVars` array
- Build script reads block CSS and validates against `themeVars`
- Warnings for: declared but not used, used but not declared

**Phase 4 Coverage:** Task 1 step 6 (lines 31-34). ✓ Matches PRD.

---

## Contradictions

### Contradiction 1: Renderer Naming

**PRD (line 14):** Phase 4 doc uses "renderer.html" in several places (lines 11, 197, 245, 324-338, 460), but the PRD calls it "stage.html" throughout.

**Resolution:** The Phase 4 doc appears to have drafting inconsistency. The file is `stage.html`, not `renderer.html`. All Phase 4 references to "renderer.html" should be "stage.html".

Examples:
- Line 11: "renderer.html graphics" → "stage.html graphics"
- Line 197: "firebaseRenderer === 'renderer'" → "firebaseRenderer === 'stage'"
- Line 245: "If this is a renderer graphic" → "If this is a stage graphic"
- Lines 324-338: "renderer.html URLs" → "stage.html URLs"
- Line 460: "'renderer'", "'renderer'" → "'stage'", "'stage'"

### Contradiction 2: Firebase Renderer Value

**PRD (line 75):** Firebase `renderer` field uses only `"stage"` or `"output"`.
**Phase 4 (line 197):** Shows `firebaseRenderer === 'renderer'`.

**Resolution:** Phase 4 should use `'stage'`, not `'renderer'`. This is a typo/draft inconsistency.

---

## Missing Tasks (Gaps Requiring New Tasks)

### Gap A: Create resolveTheme() Shared Helper

**PRD requires** a `resolveTheme()` helper shared between GraphicsControl, timesheet engine, and Theme Editor. Phase 4 describes the logic but doesn't create a dedicated task.

**Suggested task:**
```
Task 2B: Create resolveTheme() Helper

Create `show-controller/src/lib/themeResolver.js` with:
- resolveTheme(db, themeId, graphicId) function
- Reads theme from Firebase
- Applies per-graphic overrides
- Returns flat theme object with all 8 colors + images

Also create server version:
- `server/lib/themeResolver.js` (same logic, Admin SDK)
```

### Gap B: Remove baseGraphicTitles

**PRD requires** sidebar auto-population from registry — no separate titles object.

**Suggested task addition to Task 4:**
```
- Remove `baseGraphicTitles` object from UrlGeneratorPage.jsx
- Remove `getGraphicTitles()` function
- Sidebar titles derived from manifest `label` field via registry
```

### Gap C: Image Overrides in Theme Resolution

**PRD specifies** theme object includes image overrides. Phase 4 Task 2 only shows color resolution.

**Suggested task addition to Task 2:**
```
- resolveTheme() must include image fields:
  - headerBgImage, headerBgImageFit, headerBgImagePosition, headerBgImageOpacity
  - bodyBgImage, bodyBgImageFit, bodyBgImagePosition, bodyBgImageOpacity
  - bodyTexture, bodyTextureOpacity, bodyTextureBlend
  - logo, logoSize
- Per-graphic image overrides merged into resolved theme
```

---

## Cross-Phase Dependencies

### Phase 5 (Reorganization) References Phase 4 Outputs

Phase 5 doc (`Phase-5-Reorganization.md`) expects:
- `categories.json` exists and defines new category structure
- Build script generates registry from manifests
- `CATEGORIES` object exported from generated registry

**Implication:** Phase 4 must complete all of Task 1/1B/1C/1D before Phase 5 can begin.

### Phase 6 (Verification & Cutover) References Phase 4 Outputs

Phase 6 expects:
- All graphics have manifests
- Renderer routing works correctly
- Theme resolution is baked into specs

**Implication:** Phase 4's manifest coverage and renderer routing must be complete and verified.

---

## Summary of Required Actions

1. **Fix Phase 4 doc terminology:** Replace "renderer.html" with "stage.html", replace `'renderer'` with `'stage'` in all code examples
2. **Add Task 2B:** Create `resolveTheme()` shared helper
3. **Expand Task 2:** Include image overrides in theme resolution
4. **Expand Task 4:** Explicitly remove `baseGraphicTitles` and `getGraphicTitles()`
5. **Clarify Task 1:** Confirm subcategory validation fails the build

---

## PRD Requirements Checklist

| # | PRD Requirement | Phase 4 Task | Status |
|---|----------------|--------------|--------|
| 1 | Firebase renderer field: "stage" or "output" | Task 2, Task 3 | ✓ Covered |
| 2 | Self-contained theme data | Task 2 | ⚠️ Missing image overrides |
| 3 | resolveTheme() shared helper | Task 2 | ⚠️ No dedicated task |
| 4 | Manifest files in stage/graphics/ | Task 1B | ✓ Covered |
| 5 | Legacy manifests in stage/graphics/legacy/ | Task 1C | ✓ Covered |
| 6 | categories.json | Task 1D | ✓ Covered |
| 7 | Build script validates manifests | Task 1 | ✓ Covered |
| 8 | Build script checks themeVars | Task 1 step 6 | ✓ Covered |
| 9 | Generated registry exports GRAPHICS + CATEGORIES | Task 1 step 7 | ✓ Covered |
| 10 | Sidebar auto-populated from registry | Task 4 | ⚠️ baseGraphicTitles not removed |
| 11 | Renderer badge in sidebar | Task 8 | ✓ Covered |
| 12 | Preview iframe indicator | Task 9 | ✓ Covered |
| 13 | output.html ignores stage graphics | Task 3 | ✓ Already implemented |
| 14 | Copyable stage.html URL in Graphics Panel | Task 5 | ✓ Covered |
| 15 | Rundown system includes renderer | Task 6 | ✓ Covered |
| 16 | Skeletons & Blocks preview section | Task 7 | ✓ Covered |
| 17 | Migration status report | Task 10 | ✓ Covered |
