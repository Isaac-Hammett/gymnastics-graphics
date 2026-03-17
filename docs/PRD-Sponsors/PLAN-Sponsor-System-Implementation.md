# Plan: Sponsor System — Implementation Tracker

**Status:** IN PROGRESS (18/20 tasks complete)
**Last Updated:** 2026-03-12

---

## Quick Task Index

| Task | Phase | File | Change | Status |
|------|-------|------|--------|--------|
| T1 | A | `show-controller/src/hooks/useTeamsDatabase.js` | Rescope `saveSponsor`/`deleteSponsor`/`reorderSponsors` to per-team paths; add `tier` field; add `getTeamSponsors`/`getTeamSponsorCount` helpers; update exports | COMPLETE |
| T2 | B | `show-controller/src/lib/graphicsRegistry.js` | Add `sponsors-thanks`, `sponsors-cycle`, `sponsors-bug` in new `sponsors` category (before closing `};` at line 945) | COMPLETE |
| T3 | B | `show-controller/src/pages/GraphicsManagerPage.jsx` | Add `'sponsors': 'Sponsors'` to `CATEGORY_LABELS` (line 18); add dummy sponsors to `testOptions` for preview | COMPLETE |
| T4 | B | `show-controller/src/lib/graphicButtons.js` | Add `sponsors` key using `getGraphicsByCategory('sponsors')`, numbers starting at 30 | COMPLETE |
| T5 | B | `show-controller/src/lib/urlBuilder.js` | Add 3 builder functions (`buildSponsorsThanksURL`, `buildSponsorsCycleURL`, `buildSponsorsBugURL`) + 3 switch cases + destructure `sponsors` from `options` | COMPLETE |
| T6 | C | `show-controller/src/pages/UrlGeneratorPage.jsx` | Import `useTeamsDatabase`; add 3 entries to `baseGraphicTitles`; add Sponsors sidebar section; add `resolveHomeTeamKey` helper; thread `sponsorsJson` through `options.sponsors` | COMPLETE |
| T7 | D | `show-controller/src/pages/MediaManagerPage.jsx` | Create `SponsorsView` component (add/reorder/delete); inline under expanded team cards; add sponsor count badge to team card headers; destructure new hook functions | COMPLETE |
| T8 | E | `overlays/sponsors-thanks.html` | Create full-screen "Thank You to Our Sponsors" grid overlay (1920x1080, Inter font, gray header bar, auto-sizing grid, URL params) | COMPLETE |
| T9 | F | `overlays/sponsors-cycle.html` | Create full-screen cycling sponsor overlay (one at a time, 3s hold, 0.5s crossfade, continuous loop) | COMPLETE |
| T10 | G | `overlays/sponsors-bug.html` | Create transparent corner bug overlay (bottom-right 200x80, 10s cycling, 0.8s fade, semi-transparent pill) | COMPLETE |
| T11 | H | — | `cd show-controller && npm run build` — verify no errors | COMPLETE |
| T12 | H | — | Deploy SPA + 3 overlay files to production; verify overlay URLs serve overlays (not React SPA) | COMPLETE |
| T13 | I | `overlays/sponsors-cycle.html` | Enhanced content detection: trim white/near-white background pixels (not just transparent), so JPEG and white-bg PNG logos center correctly | COMPLETE |
| T14 | J | `show-controller/src/hooks/useTeamsDatabase.js` | Add adjustment fields (scale, offsetX, offsetY, cropX, cropY, cropW, cropH) to `saveSponsor()` write and `getTeamSponsors()` return | COMPLETE |
| T15 | K | `show-controller/src/pages/MediaManagerPage.jsx` | Add per-sponsor adjustment controls (crop, scale, offset) to SponsorsView with inline preview | COMPLETE |
| T16 | L | `show-controller/src/components/GraphicsControl.jsx` | Fix sponsor serialization to include all adjustment fields (scale, offset, crop) — currently only passes name and url | COMPLETE |
| T17 | M | `show-controller/src/pages/UrlGeneratorPage.jsx` | Persist sponsor overrides back to Firebase via saveSponsor (currently session-only local state) | COMPLETE |
| T18 | N | — | Build + deploy SPA + overlay files to production; verify sponsor logos center correctly and adjustments persist | COMPLETE |
| T19 | O | `overlays/sponsors-cycle.html` | SVG logo support: detect SVGs, skip canvas pipeline, render via `<img>` fallback with scale/offset | — | NOT STARTED |
| T20 | P | — | Build + deploy overlays with SVG support | T19 | NOT STARTED |

---

## Phase Summary

| Phase | Name | Tasks | Status |
|-------|------|-------|--------|
| **A** | Data & Hook | T1 | COMPLETE |
| **B** | Registry & Routing | T2, T3, T4, T5 | COMPLETE |
| **C** | URL Generator Plumbing | T6 | COMPLETE |
| **D** | Media Manager UI | T7 | COMPLETE |
| **E** | Overlay: Thank You | T8 | COMPLETE |
| **F** | Overlay: Cycle | T9 | COMPLETE |
| **G** | Overlay: Bug | T10 | COMPLETE |
| **H** | Build & Deploy | T11, T12 | COMPLETE |
| **I** | Overlay: Smart Content Detection | T13 | COMPLETE |
| **J** | Data Model: Adjustment Fields | T14 | COMPLETE |
| **K** | Media Manager: Adjust Controls | T15 | COMPLETE |
| **L** | GraphicsControl: Pass All Fields | T16 | COMPLETE |
| **M** | URL Generator: Persist Overrides | T17 | COMPLETE |
| **N** | Build & Deploy v2 | T18 | COMPLETE |
| **O** | SVG Logo Support | T19 | NOT STARTED |
| **P** | Build & Deploy v3 | T20 | NOT STARTED |

---

## Dependency Graph

```
T1 (hook) ─────────────┬──→ T6 (URL Generator)
                        └──→ T7 (Media Manager)

T2 (registry) ─────────┬──→ T3 (GraphicsManager)
                        ├──→ T4 (graphicButtons)
                        └──→ T5 (urlBuilder) ──→ T6 (URL Generator)

T8, T9, T10 (overlays) ── no dependencies, can run in parallel

T1-T10 all ──→ T11 (build) ──→ T12 (deploy)

--- Phase 2 (Sponsor Adjustments) ---

T13 (overlay fix) ── no dependencies (standalone overlay HTML)

T14 (data model) ──┬──→ T15 (Media Manager adjust controls)
                    ├──→ T16 (GraphicsControl fix)
                    └──→ T17 (URL Generator persist)

T13-T17 all ──→ T18 (build + deploy)
```

**Phase 2 parallelization:** T13 can run independently. T14 must complete first, then T15 + T16 + T17 can run in parallel. T18 last.

--- Phase 3 (SVG Support) ---

T19 (SVG overlay fix) ── no dependencies (standalone overlay HTML)

T19 ──→ T20 (build + deploy)

---

## Task Details

### T1: Hook — Per-Team Sponsor CRUD

**File:** `show-controller/src/hooks/useTeamsDatabase.js`
**Dependencies:** None
**Plan Reference:** [PLAN Section 2](./PLAN-Sponsor-System-2026-02-13.md#2-hook-changes--useteamsdatabasejs)

**Changes:**
1. Modify `saveSponsor` (line 259): Add `teamKey` as first param; path → `teamsDatabase/sponsors/${teamKey}/${sponsorKey}`; write `tier` field (default `'official'`)
2. Modify `deleteSponsor` (line 277): Add `teamKey` as first param; update path
3. Modify `reorderSponsors` (line 290): Add `teamKey` as first param; update paths
4. Add `getTeamSponsors(teamKey)` helper: returns sorted `[{key, name, url, tier, order}]`
5. Add `getTeamSponsorCount(teamKey)` helper: returns number
6. Update return object (lines 783-786): export new helpers

**No changes needed to:** `sponsors` state declaration (line 40), Firebase listener (lines 81-87), `checkLoaded` threshold (line 54)

**Status:** COMPLETE

---

### T2: Registry — Three Sponsor Graphics

**File:** `show-controller/src/lib/graphicsRegistry.js`
**Dependencies:** None
**Plan Reference:** [PLAN Section 7](./PLAN-Sponsor-System-2026-02-13.md#7-graphics-registry)

**Changes:**
1. Add `sponsors-thanks` entry: category `'sponsors'`, renderer `'overlay'`, file `'sponsors-thanks.html'`, transparent `false`, params: `logo` (string/competition) + `sponsors` (string/computed)
2. Add `sponsors-cycle` entry: same pattern, file `'sponsors-cycle.html'`
3. Add `sponsors-bug` entry: transparent `true`, no `logo` param, file `'sponsors-bug.html'`

**Insert location:** Before closing `};` at line 945. Use `'sponsors'` category (NOT `'stream'`) to avoid keyword collision with `stream-thanks`.

**Status:** COMPLETE

---

### T3: Graphics Manager — Category Label + Preview

**File:** `show-controller/src/pages/GraphicsManagerPage.jsx`
**Dependencies:** T2
**Plan Reference:** [PLAN Section 7](./PLAN-Sponsor-System-2026-02-13.md#7-graphics-registry)

**Changes:**
1. Add `'sponsors': 'Sponsors'` to `CATEGORY_LABELS` (line 18)
2. Add dummy sponsors data to `testOptions` when previewing sponsor graphics (so preview isn't empty/broken)

**Status:** COMPLETE

---

### T4: Graphic Buttons — Sponsors Section

**File:** `show-controller/src/lib/graphicButtons.js`
**Dependencies:** T2
**Plan Reference:** [PLAN Section 7](./PLAN-Sponsor-System-2026-02-13.md#7-graphics-registry)

**Changes:**
1. Add `sponsors` key to exported `graphicButtons` object
2. Use `getGraphicsByCategory('sponsors').map(...)` pattern
3. Number sequence starting at 30 (stream uses 19+, inMeet uses 27+)

**Status:** COMPLETE

---

### T5: URL Builder — Three Builder Functions

**File:** `show-controller/src/lib/urlBuilder.js`
**Dependencies:** T2
**Plan Reference:** [PLAN Section 8](./PLAN-Sponsor-System-2026-02-13.md#8-url-builder--data-plumbing)

**Changes:**
1. Destructure `sponsors` from `options` (line 333)
2. Add `buildSponsorsThanksURL({ logo, sponsorsJson, baseUrl })` after `buildStreamURL` (line 209)
3. Add `buildSponsorsCycleURL({ logo, sponsorsJson, baseUrl })`
4. Add `buildSponsorsBugURL({ sponsorsJson, baseUrl })` — no `logo` param
5. Add 3 switch cases before `default:` (line 524)

All use `URLSearchParams` for proper encoding.

**Status:** COMPLETE

---

### T6: URL Generator — Sponsor Plumbing

**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`
**Dependencies:** T1, T4, T5
**Plan Reference:** [PLAN Section 8](./PLAN-Sponsor-System-2026-02-13.md#8-url-builder--data-plumbing)

**Changes:**
1. Import `useTeamsDatabase` hook
2. Destructure `getTeamSponsors`, `resolveSchoolKey`
3. Add 3 entries to `baseGraphicTitles` (lines 47-101)
4. Add "Sponsors" sidebar section after "Stream" section (line 457) using `GraphicSection` + `GraphicSidebarButton` pattern
5. Add `resolveHomeTeamKey(formData, config)` helper using `resolveSchoolKey`
6. In `generateURLWithOptions`: resolve home team sponsors, cap at 8, serialize as JSON, thread through `options.sponsors`

**Status:** COMPLETE

---

### T7: Media Manager — SponsorsView Component

**File:** `show-controller/src/pages/MediaManagerPage.jsx`
**Dependencies:** T1
**Plan Reference:** [PLAN Section 3](./PLAN-Sponsor-System-2026-02-13.md#3-media-manager-ui--inline-sponsorsview)

**Changes:**
1. Destructure from hook (lines 22-32): `sponsors`, `saveSponsor`, `deleteSponsor`, `reorderSponsors`, `getTeamSponsors`, `getTeamSponsorCount`
2. Team card header (lines 344-394): Add sponsor count badge ("3 Spons" amber / "No Spons" zinc)
3. Expanded card (lines 398-404): Wrap `RosterView` + `SponsorsView` in fragment
4. Create `SponsorsView` component (after RosterView definition at line 648):
   - Props: `{ teamKey, getTeamSponsors, saveSponsor, deleteSponsor, reorderSponsors }`
   - Section header with SparklesIcon
   - Sponsor list rows: [48x48 logo] [Name] [Tier badge] [URL] [Up] [Down] [Delete]
   - Add form: [Name input] [URL input + preview] [Tier dropdown] [Add button]
   - Duplicate key guard with inline error
   - Empty state: "No sponsors for this team"

**Status:** COMPLETE

---

### T8: Overlay — sponsors-thanks.html

**File:** `overlays/sponsors-thanks.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 4](./PLAN-Sponsor-System-2026-02-13.md#4-overlay-sponsors-thankshtml)

**Create new file:**
- 1920x1080 viewport, Inter font, transparent body
- Gray header bar (#BFBFBF) with "THANK YOU TO OUR SPONSORS" + team logo (80x80)
- URL params: `?logo={teamLogoUrl}&sponsors={encodedJSON}`
- CSS grid: 1-2 sponsors = 1 row; 3-4 = 2x2; 5-8 = 2 rows
- Each sponsor: logo (200x200 contain) + name (24px) below
- Error handling: missing logo, missing/invalid sponsors, empty array, broken logos, long names

**Status:** COMPLETE

---

### T9: Overlay — sponsors-cycle.html

**File:** `overlays/sponsors-cycle.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 5](./PLAN-Sponsor-System-2026-02-13.md#5-overlay-sponsors-cyclehtml)

**Create new file:**
- Same gray header bar as sponsors-thanks
- One sponsor at a time, centered, large (~600px), name below (36px bold)
- 3s hold, 0.5s crossfade, continuous loop via setInterval
- 1 sponsor = static, no transitions
- Broken logo → skip to next; ALL broken → text-only mode

**Status:** COMPLETE

---

### T10: Overlay — sponsors-bug.html

**File:** `overlays/sponsors-bug.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 6](./PLAN-Sponsor-System-2026-02-13.md#6-overlay-sponsors-bughtml-new)

**Create new file:**
- 1920x1080 viewport, fully transparent body
- No header bar
- Container: `position: fixed; bottom: 40px; right: 40px; width: 200px; height: 80px;`
- Semi-transparent dark pill: `rgba(0,0,0,0.4); border-radius: 12px; padding: 10px;`
- 10s hold, 0.8s fade, continuous loop
- URL params: `?sponsors={encodedJSON}` only (no `?logo=`)
- Missing/empty → fully transparent page; 1 sponsor → static; all broken → hide container

**Status:** COMPLETE

---

### T11: Build — Local Verification

**Dependencies:** T1-T10
**Plan Reference:** [PLAN Section 9](./PLAN-Sponsor-System-2026-02-13.md#9-task-order)

**Steps:**
1. `cd show-controller && npm run build`
2. Verify no errors, no warnings about missing imports
3. Check `dist/` output exists

**Status:** COMPLETE

---

### T12: Deploy — Production

**Dependencies:** T11
**Plan Reference:** [PLAN Deployment](./PLAN-Sponsor-System-2026-02-13.md#deployment)

**Steps:**
1. Deploy React SPA (tarball → upload → extract)
2. Deploy 3 overlay files (rebuild overlays tarball → upload → extract)
3. Verify overlay URLs serve correct content:
   - `https://commentarygraphic.com/overlays/sponsors-thanks.html`
   - `https://commentarygraphic.com/overlays/sponsors-cycle.html`
   - `https://commentarygraphic.com/overlays/sponsors-bug.html`
4. Verify main site has no console errors
5. Verify URL Generator shows Sponsors sidebar section

**Status:** COMPLETE

---

---

### T13: Overlay — Smart Content Detection for White Backgrounds

**File:** `overlays/sponsors-cycle.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 10](#10-smart-content-detection)

**Problem:** `getContentBounds()` (line 196) only detects transparent pixels (`alpha > 20`) as content. JPEG images and PNGs with white/opaque backgrounds have alpha=255 for ALL pixels, so the entire image (including asymmetric whitespace) is treated as content. The canvas is centered by flexbox, but the visual content within it is off-center if the source image has uneven padding.

**Changes:**
1. Enhance `getContentBounds()` to also detect near-white/near-background pixels as "background" — not just transparent ones
2. Add a two-pass detection strategy:
   - **Pass 1 (existing):** Scan for non-transparent pixels (alpha threshold). If the detected content is significantly smaller than the full image, use it (logo has transparency).
   - **Pass 2 (new):** If Pass 1 returns the full image (opaque image detected), scan for non-white/non-near-white pixels using a luminance or RGB threshold. Treat pixels where R>240, G>240, B>240 as background.
3. The threshold should be configurable but default to RGB > 240 for "near-white" detection
4. Keep the existing crop override system — manual crop always wins over auto-detection

**Test cases:**
- Transparent PNG: Should trim to content bounds (existing behavior, unchanged)
- JPEG with white background: Should now trim white borders and center the actual logo content
- JPEG with colored background: Should fall back to full image (no trimming)
- Logo with light gray background (#E5E5E5): Should NOT trim since background matches page background

**Status:** COMPLETE

---

### T14: Data Model — Add Adjustment Fields to Sponsor CRUD

**File:** `show-controller/src/hooks/useTeamsDatabase.js`
**Dependencies:** None (extends existing T1 work)

**Changes:**

1. **`saveSponsor()` (line 260):** Add optional adjustment fields to the Firebase write. These fields should only be written when they have non-default values (to keep Firebase clean):
   ```js
   await set(ref(db, `teamsDatabase/sponsors/${teamKey}/${sponsorKey}`), {
     name: sponsorData.name,
     url: sponsorData.url,
     tier: sponsorData.tier || 'official',
     order: sponsorData.order ?? 0,
     // Adjustment fields (only write if non-default)
     ...(sponsorData.scale != null && sponsorData.scale !== 100 ? { scale: sponsorData.scale } : {}),
     ...(sponsorData.offsetX ? { offsetX: sponsorData.offsetX } : {}),
     ...(sponsorData.offsetY ? { offsetY: sponsorData.offsetY } : {}),
     ...(sponsorData.cropX != null ? { cropX: sponsorData.cropX } : {}),
     ...(sponsorData.cropY != null ? { cropY: sponsorData.cropY } : {}),
     ...(sponsorData.cropW != null ? { cropW: sponsorData.cropW } : {}),
     ...(sponsorData.cropH != null ? { cropH: sponsorData.cropH } : {}),
     updatedAt: new Date().toISOString(),
   });
   ```

2. **`getTeamSponsors()` (line 507):** Include adjustment fields in the returned objects:
   ```js
   .map(([key, data]) => ({
     key,
     name: data.name,
     url: data.logoUrl || data.url,
     tier: data.tier || 'official',
     order: data.order ?? 0,
     // Adjustment fields
     scale: data.scale ?? null,
     offsetX: data.offsetX ?? null,
     offsetY: data.offsetY ?? null,
     cropX: data.cropX ?? null,
     cropY: data.cropY ?? null,
     cropW: data.cropW ?? null,
     cropH: data.cropH ?? null,
   }))
   ```

**Status:** COMPLETE

---

### T15: Media Manager — Sponsor Adjustment Controls

**File:** `show-controller/src/pages/MediaManagerPage.jsx`
**Dependencies:** T14

**Changes:**

Add per-sponsor adjustment controls to the `SponsorsView` component (line 684). Each sponsor row should have an "Adjust" expand/collapse button that reveals:

1. **Inline preview:** A small (320x180) preview container showing the sponsor logo rendered the same way `sponsors-cycle.html` does — with content detection, crop, scale, and offset applied. This lets the user see the effect of their adjustments.

2. **Crop controls:** X, Y, W, H stepper inputs (same pattern as `SponsorAdjustControls.jsx`). Values are in source image pixels.

3. **Scale control:** 10-300% stepper with slider.

4. **Offset controls:** X and Y pixel offsets (-500 to +500).

5. **Reset button:** Clears all adjustment fields back to null/defaults.

6. **Save on change:** Each adjustment change immediately calls `saveSponsor(teamKey, sponsorKey, { ...existingSponsorData, [field]: value })` to persist to Firebase. No separate "Save" button needed.

**Implementation approach:**
- Import `SponsorAdjustControls` or create a simpler inline version that works per-sponsor (the existing component is designed for a list with locking — the Media Manager needs a single-sponsor version)
- The preview should use a `<canvas>` element that replicates the `renderTrimmedLogo` logic from `sponsors-cycle.html`, or use a small iframe pointing to `sponsors-cycle.html?sponsors=[{...}]&lockedIndex=0` for pixel-perfect preview
- Using an iframe preview is simpler and guarantees visual parity with the actual overlay

**UI layout for expanded sponsor row:**
```
[48x48 logo] [Name] [Tier badge] [URL] [Adjust ▸] [Up] [Down] [Delete]
  └─ [Expanded adjustment panel - only visible when Adjust is clicked]
     ┌────────────────────────────────────────────────┐
     │ [320x180 live preview iframe]                  │
     │                                                │
     │ Crop: [X ±] [Y ±] [W ±] [H ±]  [Reset Auto]  │
     │ Scale: [±100%]  X Offset: [±0px]  Y: [±0px]   │
     │                                    [Reset All] │
     └────────────────────────────────────────────────┘
```

**Status:** COMPLETE

---

### T16: GraphicsControl — Pass All Sponsor Adjustment Fields

**File:** `show-controller/src/components/GraphicsControl.jsx`
**Dependencies:** T14

**Problem:** Lines 406-409 and 426-429 map sponsors to `{ name, url }` only, dropping `scale`, `offsetX`, `offsetY`, `cropX`, `cropY`, `cropW`, `cropH`. This means adjustments made in the Media Manager or Theme Editor are lost when sending sponsor graphics from the producer view.

**Changes:**

1. **Theme sponsors path (line 406):** Include all fields:
   ```js
   data.sponsors = JSON.stringify(eventSponsors.slice(0, 8).map(s => ({
     name: s.name || '',
     url: s.url || '',
     ...(s.scale != null && s.scale !== 100 ? { scale: s.scale } : {}),
     ...(s.offsetX ? { offsetX: s.offsetX } : {}),
     ...(s.offsetY ? { offsetY: s.offsetY } : {}),
     ...(s.cropX != null ? { cropX: s.cropX } : {}),
     ...(s.cropY != null ? { cropY: s.cropY } : {}),
     ...(s.cropW != null ? { cropW: s.cropW } : {}),
     ...(s.cropH != null ? { cropH: s.cropH } : {}),
   })));
   ```

2. **Team sponsors fallback path (line 426):** Same pattern — include all adjustment fields from `getTeamSponsors()` return values.

**Status:** COMPLETE

---

### T17: URL Generator — Persist Sponsor Overrides to Firebase

**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`
**Dependencies:** T14

**Problem:** The `SponsorAdjustControls` in the URL Generator modify local React state (`sponsorOverrides`) but never persist changes back to Firebase. Adjustments are lost when the page reloads.

**Changes:**

1. **Load persisted values:** When sponsors are loaded (from theme or team), pre-populate `sponsorOverrides` with existing adjustment fields from the sponsor data, so the controls show current saved values.

2. **Save on change:** When the user modifies a crop/scale/offset value via the `SponsorAdjustControls` `onUpdate` callback, also persist the change to Firebase:
   - **For theme sponsors:** Call `firebase.update()` on `themes/{themeId}/sponsors/{index}/` with the changed field
   - **For team sponsors:** Call `saveSponsor(teamKey, sponsorKey, updatedData)` to persist the adjustment

3. **Determine source:** Track whether current sponsors came from a theme or from the team database, so the save targets the correct Firebase path.

**Note:** The existing `meetThemeSponsors` state in UrlGeneratorPage already contains theme-sourced sponsors. For team-sourced sponsors, the `resolveHomeTeamKey` helper resolves the team key. The save path depends on which source was used.

**Implementation:**
- Added `update` import from firebase
- Added `saveSponsor` to `useTeamsDatabase` destructure
- Added `sponsorSource` state to track 'theme' | 'team' | null
- Updated `onUpdate` callback to persist adjustments to Firebase via `update(ref(db, 'themes/{themeId}/sponsors/{index}'), { [field]: value })`
- Clears default values (scale=100, offset=0) to null to keep Firebase clean

**Status:** COMPLETE

---

### T18: Build & Deploy v2

**Dependencies:** T13-T17

**Steps:**
1. `cd show-controller && npm run build` — verify no errors
2. Deploy React SPA (tarball → upload → extract)
3. Deploy overlay files (rebuild overlays tarball including updated `sponsors-cycle.html`)
4. Set permissions: `chmod 644 /var/www/commentarygraphic/overlays/*`
5. Verify:
   - Open URL Generator, select sponsors-cycle, check that white-bg logos now center correctly
   - Open Media Manager, expand a team with sponsors, verify adjust controls appear
   - Send a sponsor graphic from producer view, verify adjustments are applied in output
   - Reload URL Generator, verify previously-saved adjustments persist

**Status:** NOT STARTED

---

### T19: Overlay — SVG Logo Support in sponsors-cycle.html

**File:** `overlays/sponsors-cycle.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 12](./PLAN-Sponsor-System-2026-02-13.md#12-svg-sponsor-logo-support)

**Problem:** The `renderTrimmedLogo()` function draws images to an offscreen canvas for pixel-level content detection. SVGs break this pipeline:
1. SVGs without explicit `width`/`height` report `naturalWidth === 0`, creating a 0×0 canvas → blank output
2. Cross-origin SVGs taint the canvas → `getImageData()` throws (existing fallback catches this, but still uses 0×0 dims)
3. Canvas `drawImage()` with SVGs can produce inconsistent results across browsers

**Changes:**

1. **Add SVG detection helpers** (before `getContentBounds()`):
   ```javascript
   function isSvgUrl(url) {
     try { return new URL(url).pathname.toLowerCase().endsWith('.svg'); }
     catch (e) { return false; }
   }
   ```

2. **Add SVG rendering function** (after `applyOverrides()`):
   ```javascript
   function renderSvgLogo(imgSrc, sponsor) {
     const el = document.createElement('img');
     el.src = imgSrc;
     el.style.maxHeight = TARGET_HEIGHT + 'px';
     el.style.maxWidth = MAX_WIDTH + 'px';
     el.style.objectFit = 'contain';
     // Apply scale/offset (same logic as applyOverrides but for <img>)
     const scale = (sponsor.scale || 100) / 100;
     const ox = sponsor.offsetX || 0;
     const oy = sponsor.offsetY || 0;
     const transforms = [];
     if (scale !== 1) transforms.push(`scale(${scale})`);
     if (ox || oy) transforms.push(`translate(${ox}px, ${oy}px)`);
     if (transforms.length) el.style.transform = transforms.join(' ');
     return el;
   }
   ```

3. **Add SVG detection in BOTH load handlers** (lines 416 and 427). The `img.onload` handler AND the `fallback.onload` handler both call `renderTrimmedLogo()` — SVG detection must be in both:

   ```javascript
   // In img.onload (line 416):
   img.onload = () => {
     const isSvg = isSvgUrl(sponsor.url) || (img.naturalWidth === 0 && img.naturalHeight === 0);
     if (isSvg) {
       slide.appendChild(renderSvgLogo(img.src, sponsor));
     } else {
       const { canvas, autoBounds, usedBounds } = renderTrimmedLogo(img, sponsor);
       applyOverrides(canvas, sponsor);
       slide.appendChild(canvas);
       if (showBounds) drawBoundsOverlay(slide, canvas, autoBounds, usedBounds, sponsor);
     }
   };

   // In fallback.onload (line 427) — SAME pattern:
   fallback.onload = () => {
     const isSvg = isSvgUrl(sponsor.url) || (fallback.naturalWidth === 0 && fallback.naturalHeight === 0);
     if (isSvg) {
       slide.appendChild(renderSvgLogo(fallback.src, sponsor));
     } else {
       const { canvas, autoBounds, usedBounds } = renderTrimmedLogo(fallback, sponsor);
       applyOverrides(canvas, sponsor);
       slide.appendChild(canvas);
       if (showBounds) drawBoundsOverlay(slide, canvas, autoBounds, usedBounds, sponsor);
     }
   };
   ```

   **IMPORTANT:** The onerror fallback path (line 424-439) retries without `crossOrigin` attribute. If an SVG fails CORS on first try but loads without CORS on fallback, it would still hit the broken canvas pipeline without this fix.

**What NOT to change:**
- `sponsors-thanks.html` — Canvas color analysis failure is graceful (null → default dark bg). No fix needed.
- `sponsors-bug.html` — Already uses `<img>` tags. SVGs work perfectly.
- Media Manager — Already uses `<img>` thumbnails. SVGs work perfectly.
- Crop controls UI — Crop fields remain in the data model and UI but have no effect on SVGs in the overlay (this is acceptable; scale/offset still work)

**Test cases:**
- SVG with explicit width/height: Should render correctly, centered, at TARGET_HEIGHT
- SVG without width/height (viewBox only): Should render correctly via `<img>` fallback
- SVG from cross-origin CDN: Should render (no canvas taint issue since we skip canvas)
- Raster images (PNG, JPEG): Unchanged behavior via canvas pipeline
- SVG with scale/offset adjustments: Transform should apply correctly

**Status:** NOT STARTED

---

### T20: Build & Deploy v3 (SVG Support)

**Dependencies:** T19

**Steps:**
1. Deploy overlay files (rebuild overlays tarball including updated `sponsors-cycle.html`)
2. Set permissions: `chmod 644 /var/www/commentarygraphic/overlays/*`
3. Verify:
   - Open sponsors-cycle overlay with an SVG sponsor URL → logo renders correctly
   - Open sponsors-cycle overlay with a PNG sponsor URL → existing behavior unchanged
   - Verify scale/offset adjustments work on SVG sponsors

**Status:** NOT STARTED

---

## Verification Checklist

### Phase 1 (T1-T12) — COMPLETE

- [x] **Hook** — `saveSponsor('test-mens', 'test-sponsor', {...})` → Firebase path exists with all fields
- [x] **Media Manager** — Expand team → SponsorsView appears → add/reorder/delete works → badge updates
- [x] **Overlays** — Open each HTML locally with test `?sponsors=` param → renders correctly
- [x] **URL Generator** — Select competition with sponsors → sponsor graphics show in sidebar → URLs generate correctly
- [x] **Build** — `npm run build` no errors
- [x] **Deploy** — Production URLs serve overlays (not React SPA)
- [x] **OBS test** — `sponsors-bug.html` as Browser Source → transparency works

### Phase 2 (T13-T18) — COMPLETE

- [ ] **Content detection** — JPEG logos with white backgrounds now auto-center correctly in sponsors-cycle
- [ ] **Data model** — `saveSponsor` persists adjustment fields; `getTeamSponsors` returns them
- [ ] **Media Manager adjustments** — Expand team → click Adjust on a sponsor → crop/scale/offset controls appear with live preview → changes persist to Firebase
- [ ] **GraphicsControl** — Send sponsor graphic from producer view → adjustment fields are included in the overlay URL
- [ ] **URL Generator persist** — Adjust a sponsor in URL Generator → reload page → adjustments are still there
- [ ] **End-to-end** — Add a JPEG white-bg sponsor logo → it auto-centers → fine-tune with crop/offset → send from producer → output shows centered, adjusted logo

### Phase 3 (T19-T20) — NOT STARTED

- [ ] **SVG in sponsors-cycle** — SVG sponsor URL renders correctly (not blank) in sponsors-cycle overlay
- [ ] **SVG with viewBox only** — SVG without explicit width/height renders correctly
- [ ] **Raster unchanged** — PNG/JPEG sponsors still use canvas pipeline with content detection
- [ ] **Scale/offset on SVG** — Adjustment controls (scale, offsetX, offsetY) work on SVG sponsors
- [ ] **Deploy** — Updated overlay file accessible on production

---

## Post-Deployment Fixes (2026-02-13)

### Bug Fixes

| Bug | Fix | Commit |
|-----|-----|--------|
| BUG-S01: Media Manager crash (logoUrl mismatch) | Map `data.logoUrl \|\| data.url` in hook | `3c8ed0f` |
| BUG-S02: URL Generator crash (missing export) | Export `resolveSchoolKey` from hook | `ca9bde4` |
| BUG-S03: 403 Forbidden on overlays | `chmod 644` on overlay files | (server fix) |

### Design Updates

| Overlay | Change | Commit |
|---------|--------|--------|
| sponsors-cycle.html | Full screen logo on grey, no header/text | `1cfb3cc` |
| sponsors-thanks.html | Card-style layout like leaderboards | `e62a111` |
| sponsors-thanks.html | Dynamic background color, larger logos, no card boxes | (2026-02-14) |

### Integration Updates

| Component | Change | Date |
|-----------|--------|------|
| GraphicsControl.jsx | Added Sponsors section, sponsor data fetching, gender-aware team key resolution | 2026-02-14 |
| output.html | Added iframe-based renderers for sponsors-thanks, sponsors-cycle, sponsors-bug | 2026-02-14 |

**See:** [BUGS.md](./BUGS.md) for detailed bug descriptions and design change rationale.
