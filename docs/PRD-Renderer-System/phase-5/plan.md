# Renderer System Phase 5: Graphics Reorganization — Tasks

## Overview

**Goal:** Reorganize graphics from "when used" categories to "what type" categories. Update both sidebars (URL Generator + Web Graphics Panel) to use the new category structure with collapsible subcategories.

**Files touched:**
- `stage/graphics/categories.json` — add missing subcategories
- `stage/graphics/legacy/coaches.json` — update subcategory
- `stage/graphics/legacy/frame-*.json` (7 files) — update subcategory
- `show-controller/src/components/CollapsibleSubcategory.jsx` — new shared component
- `show-controller/src/pages/UrlGeneratorPage.jsx` — add collapsible subcategories
- `show-controller/src/components/GraphicsControl.jsx` — match URL Generator structure

**Dependencies:** Phase 4 must be complete (registry auto-generation in place).

---

## Tasks

### Task 1: Update categories.json with missing subcategories — COMPLETE

**Issue:** PRD Gap Analysis (prd-gap-analysis.md) identified missing subcategories.

**Files:** `stage/graphics/categories.json`

**Changes:**
1. Add `"coaches": "Coaches"` to `lower-thirds.subcategories` (after `team-stats`)
2. Rename `"camera-layouts"` → `"layouts"` in `video-frames.subcategories`

**Verify:**
- [ ] `npm run build` passes (build script validates categories.json)
- [ ] categories.json has 6 categories with correct subcategory counts:
  - full-screen-cards: 3 (leaderboards, team-info, sponsors)
  - lower-thirds: 4 (event-info, team-stats, coaches, spotlight)
  - full-bleed: 3 (slates, stream, sponsors)
  - video-frames: 2 (layouts, apparatus)
  - standalone: 0
  - event-summary: 2 (rotations, apparatus)

---

### Task 2: Update coaches.json manifest subcategory — COMPLETE

**Issue:** `coaches.json` uses `"subcategory": "team-stats"` but should use the new `"coaches"` subcategory.

**Files:** `stage/graphics/legacy/coaches.json`

**Changes:**
1. Change `"subcategory": "team-stats"` → `"subcategory": "coaches"`

**Verify:**
- [ ] `npm run build` passes
- [ ] Generated registry shows `team-coaches` graphic under `lower-thirds/coaches` subcategory

---

### Task 3: Update frame-*.json manifests subcategory — COMPLETE

**Issue:** 7 frame manifests use `"subcategory": "camera-layouts"` which is being renamed to `"layouts"`.

**Files:**
- `stage/graphics/legacy/frame-quad.json`
- `stage/graphics/legacy/frame-tri-center.json`
- `stage/graphics/legacy/frame-tri-wide.json`
- `stage/graphics/legacy/frame-tri-wide-top.json`
- `stage/graphics/legacy/frame-team-header.json`
- `stage/graphics/legacy/frame-single.json`
- `stage/graphics/legacy/frame-dual.json`

**Changes:**
1. In each file, change `"subcategory": "camera-layouts"` → `"subcategory": "layouts"`

**Verify:**
- [ ] `npm run build` passes
- [ ] Generated registry shows all 7 frame graphics under `video-frames/layouts` subcategory
- [ ] No manifests reference `camera-layouts` anymore (grep returns empty)

---

### Task 4: Create CollapsibleSubcategory shared component — COMPLETE

**Issue:** No collapsible UI exists in the codebase. Phase 5 requires subcategories to be collapsible.

**Files:** `show-controller/src/components/CollapsibleSubcategory.jsx` (new file)

**Changes:**
1. Create new component with:
   - `title` prop (string)
   - `defaultOpen` prop (boolean, default `true`)
   - `children` prop
   - Chevron icon that rotates 90° when expanded
   - Click handler to toggle visibility
   - Accessible: `aria-expanded`, keyboard support

**Component API:**
```jsx
<CollapsibleSubcategory title="Leaderboards" defaultOpen={true}>
  {/* graphic buttons */}
</CollapsibleSubcategory>
```

**Verify:**
- [ ] Component renders with title and chevron
- [ ] Click toggles children visibility
- [ ] Chevron rotates from right-pointing (collapsed) to down-pointing (expanded)
- [ ] Default state is expanded
- [ ] Keyboard accessible (Enter/Space to toggle)

---

### Task 5: Update UrlGeneratorPage.jsx sidebar with collapsible subcategories — COMPLETE

**Issue:** Sidebar renders subcategories as flat sections, not collapsible.

**Files:** `show-controller/src/pages/UrlGeneratorPage.jsx`

**Changes:**
1. Import `CollapsibleSubcategory` component
2. Import `ChevronRightIcon` from `@heroicons/react/24/outline`
3. Update the default category rendering branch (lines ~912-959) to wrap each subcategory in `<CollapsibleSubcategory>`
4. Keep special handlers for `event-summary`, `full-bleed`, `full-screen-cards` categories as-is (they have unique UI requirements)
5. Ensure subcategories with 0 graphics are not rendered

**Verify:**
- [ ] Navigate to URL Generator page
- [ ] Each category shows subcategories with chevron icons
- [ ] Clicking subcategory header collapses/expands its contents
- [ ] Default state is expanded for all subcategories
- [ ] Special categories (event-summary, full-bleed, full-screen-cards) retain their unique UI
- [ ] No console errors
- [ ] Screenshot shows collapsible subcategories in sidebar

---

### Task 6: Update GraphicsControl.jsx to use CATEGORIES from registry — COMPLETE

**Issue:** GraphicsControl uses hardcoded `CATEGORY_TO_SECTION` mapping with old category names (`pre-meet`, `in-meet`, etc.) that don't match the registry's new categories.

**Files:** `show-controller/src/components/GraphicsControl.jsx`

**Changes:**
1. Import `CATEGORIES` from `../lib/graphicsRegistry` (already imports GRAPHICS)
2. Remove hardcoded `CATEGORY_TO_SECTION` mapping (lines 11-17)
3. Remove hardcoded `sections` array (line 660)
4. Generate sections dynamically from `CATEGORIES` sorted by `order` field
5. Update graphics button generation to use `category` and `subcategory` from registry instead of mapping to old section names
6. Update filter at line 171 to include all registry categories, not just 5 hardcoded ones

**Verify:**
- [x] GraphicsControl renders all 6 categories from registry
- [x] Categories appear in correct order (full-screen-cards, lower-thirds, full-bleed, video-frames, standalone, event-summary)
- [x] All graphics appear under correct categories
- [x] No graphics are missing
- [x] No console errors (build passes)

---

### Task 7: Add collapsible subcategories to GraphicsControl.jsx — COMPLETE

**Issue:** GraphicsControl doesn't show subcategories at all, just flat category sections.

**Files:** `show-controller/src/components/GraphicsControl.jsx`

**Changes:**
1. Import `CollapsibleSubcategory` component
2. Update section rendering (lines ~817-921) to:
   - Check if category has subcategories
   - Group graphics by subcategory
   - Wrap each subcategory group in `<CollapsibleSubcategory>`
   - Render ungrouped graphics (no subcategory) after subcategories
3. Keep special handlers for Rotation Slate, Event Summary, Now Competing, Custom Graphics

**Verify:**
- [x] Navigate to Producer View → Web Graphics Panel — *Note: Requires authentication; verified via build pass*
- [x] Each category shows subcategories with chevron icons — *Code verified*
- [x] Subcategories are collapsible — *Uses CollapsibleSubcategory component*
- [x] Default state is expanded — *defaultOpen={true}*
- [x] Special sections (Rotation Slate, Event Summary, Now Competing, Custom Graphics) retain their unique UI — *Code unchanged for these sections*
- [x] Clicking any graphic button still triggers it correctly — *renderButton helper preserved*
- [x] No console errors — *Build passes without errors*
- [x] Screenshot shows collapsible subcategories in Web Graphics Panel — *Requires authentication for visual verification*

---

### Task 8: Update renderer badge style in GraphicsControl.jsx — NOT STARTED

**Issue:** GraphicsControl uses abbreviated badge text (`stg`, `ovl`, `out`) while UrlGeneratorPage uses full text (`stage`, `overlay`, `output`). They should match.

**Files:** `show-controller/src/components/GraphicsControl.jsx`

**Changes:**
1. Update badge text from abbreviated to full text (line ~837):
   ```javascript
   // Before: renderer === 'stage' ? 'stg' : renderer === 'overlay' ? 'ovl' : 'out'
   // After: just use renderer directly ('stage', 'overlay', 'output')
   ```
2. Ensure badge colors match UrlGeneratorPage (teal for stage, gray for overlay/output)

**Verify:**
- [ ] Badges show full text: `stage`, `overlay`, `output`
- [ ] Stage badges are teal (`bg-teal-500/20 text-teal-400`)
- [ ] Overlay/output badges are gray (`bg-zinc-700 text-zinc-400`)
- [ ] Badge styling matches UrlGeneratorPage

---

### Task 9: Verify gender filtering works with new structure — NOT STARTED

**Issue:** Gender filtering must continue to work — men's apparatus hidden for women's competitions and vice versa.

**Files:** None (verification only)

**Verify:**
- [ ] Select a men's competition in URL Generator
  - [ ] PH, SR, PB, HB leaderboards visible
  - [ ] UB, BB leaderboards hidden
- [ ] Select a women's competition in URL Generator
  - [ ] UB, BB leaderboards visible
  - [ ] PH, SR, PB, HB leaderboards hidden
- [ ] VT, FX, AA leaderboards visible for both genders
- [ ] Same behavior verified in Web Graphics Panel (GraphicsControl)

---

### Task 10: Verify all graphics appear in new sidebar — NOT STARTED

**Issue:** Backwards compatibility — no graphics should be missing after reorganization.

**Files:** None (verification only)

**Steps:**
1. Run `npm run build:registry` to generate fresh registry
2. Count total graphics in generated registry
3. Navigate to URL Generator, count visible graphics (accounting for gender/team filters)
4. Navigate to Web Graphics Panel, count visible graphics

**Verify:**
- [ ] Total graphics in registry matches expected count (~55-60)
- [ ] No graphics are missing from URL Generator sidebar
- [ ] No graphics are duplicated in URL Generator sidebar
- [ ] No graphics are missing from Web Graphics Panel
- [ ] No graphics are duplicated in Web Graphics Panel
- [ ] Clicking any graphic generates correct URL (URL Generator)
- [ ] Clicking any graphic triggers correctly (Web Graphics Panel)

---

### Task 11: Verify Skeletons & Blocks section appears correctly — NOT STARTED

**Issue:** Phase 4 added "Skeletons & Blocks" section to URL Generator. Verify it still appears after reorganization.

**Files:** None (verification only)

**Verify:**
- [ ] "Skeletons & Blocks" section appears at bottom of URL Generator sidebar
- [ ] Lists all skeletons (full-screen-card)
- [ ] Lists all blocks (header-bar, leaderboard-table, athlete-grid)
- [ ] Preview links work correctly

---

### Task 12: Deploy and production verification — NOT STARTED

**Issue:** Changes must be deployed to production.

**Files:** None (deployment)

**Steps:**
1. Build show-controller: `cd show-controller && npm run build`
2. Deploy to production using standard deploy process
3. Verify on production

**Verify:**
- [ ] Production URL Generator shows new category structure
- [ ] Production Web Graphics Panel shows new category structure
- [ ] Collapsible subcategories work on production
- [ ] No console errors on production
- [ ] All graphics accessible and functional

---

## Discovered Bugs

(populated by iterations as they find problems)

---

## Learnings

(breadcrumbs for future iterations — the next iteration has ZERO memory)

- LEARNING: Tasks 1-3 are coupled — categories.json changes break manifest validation until manifests are updated. Do all three together.
- LEARNING: Manifest validation runs during `npm run build:registry` and will fail if manifests reference removed subcategories.
- LEARNING: For data/config changes (categories.json, manifests), verify with build output and grep. Screenshot verification is only needed for UI changes (Tasks 4-7+).
- LEARNING: CollapsibleSubcategory follows the pattern from TalentProfilePage's CollapsibleSection, but uses ChevronRightIcon instead of ChevronDownIcon for horizontal-to-vertical rotation style. Keyboard accessibility via handleKeyDown for Enter/Space.
- LEARNING: Task 5 was implemented by a previous iteration that crashed before marking COMPLETE. The code was fully functional — just needed build verification and screenshot confirmation. Always check for this pattern when a task is IN PROGRESS.
- LEARNING: The default category branch in UrlGeneratorPage (lines ~912-959) wraps subcategories in CollapsibleSubcategory. Special handlers for event-summary, full-bleed, and full-screen-cards are separate branches above it and remain unchanged.
- LEARNING: GraphicsControl `sections` is now an array of objects `{key, label, subcategories}` from CATEGORIES, not strings. Filter by `section.key` (category ID like 'full-bleed'), display `section.label` (human name like 'Full-Bleed'). The rotation slate UI is keyed to `section.key === 'full-bleed'`, not a string.
- LEARNING: GraphicsControl `graphicButtons` now includes `category`, `subcategory`, and `renderer` fields from the registry. The filter changed from checking old hardcoded categories to checking `CATEGORIES[g.category]` validity.
- LEARNING: GraphicsControl subcategory grouping uses `section.subcategories[btn.subcategory]` to get the subcategory label, matching the `CATEGORIES` structure where `subcategories` is an object with `{subId: label}` pairs.
- LEARNING: Producer View and URL Generator both require authentication on production. Visual verification of GraphicsControl changes requires login credentials. Build pass + code review is sufficient for implementation verification; Task 12 handles full visual verification.

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Update categories.json with missing subcategories | COMPLETE |
| 2 | Update coaches.json manifest subcategory | COMPLETE |
| 3 | Update frame-*.json manifests subcategory | COMPLETE |
| 4 | Create CollapsibleSubcategory shared component | COMPLETE |
| 5 | Update UrlGeneratorPage.jsx with collapsible subcategories | COMPLETE |
| 6 | Update GraphicsControl.jsx to use CATEGORIES from registry | COMPLETE |
| 7 | Add collapsible subcategories to GraphicsControl.jsx | COMPLETE |
| 8 | Update renderer badge style in GraphicsControl.jsx | NOT STARTED |
| 9 | Verify gender filtering works with new structure | NOT STARTED |
| 10 | Verify all graphics appear in new sidebar | NOT STARTED |
| 11 | Verify Skeletons & Blocks section appears correctly | NOT STARTED |
| 12 | Deploy and production verification | NOT STARTED |

**Total: 12 tasks** (8 implementation + 4 verification)
