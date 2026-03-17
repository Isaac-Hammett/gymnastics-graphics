# Sponsor System - Bug Tracker

## Bug Summary (2026-03-12)

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| BUG-S01 | Critical | FIXED | Media Manager crash on team expand (logoUrl field mismatch) |
| BUG-S02 | Critical | FIXED | URL Generator crash on sponsor graphics (missing export) |
| BUG-S03 | Medium | FIXED (2x) | 403 Forbidden on sponsor overlay files (permissions) |
| BUG-S04 | High | FIXED (T13) | White-background logos not centered in sponsors-cycle overlay |
| BUG-S05 | High | FIXED (T14-T15) | No sponsor adjustment controls in Media Manager |
| BUG-S06 | Medium | FIXED (T16) | GraphicsControl drops crop/scale/offset fields when sending sponsor graphics |
| BUG-S07 | Medium | FIXED | URL Generator sponsor overrides are session-only (not persisted) — fixed for both theme and team sponsors |
| BUG-S08 | High | FIXED | URL Generator sponsor adjustment controls hidden for per-team sponsors |
| BUG-S09 | Medium | FIXED | Duplicate William & Mary team keys cause sponsor lookup mismatch |
| BUG-S10 | Low | FIXED | Media Manager sponsor preview iframe not scaled (1920x1080 content in tiny box) |
| BUG-S11 | Critical | FIXED | URL Generator page crash — resolveHomeTeamKey referenced before definition |
| BUG-S12 | High | FIXED | Wide logos overflow viewport in sponsors-cycle overlay |
| BUG-S13 | High | FIXED | Per-team sponsors not loading — stale useMemo missing resolveSchoolKey dependency |
| BUG-S14 | High | FIXED | Sponsor slides not centered — inline `position: relative` breaks absolute stacking |
| BUG-S15 | Critical | FIXED | "Reset to Auto" crop broken — race condition re-writes stale values, zero-crop causes blank slides |
| BUG-S16 | High | FIXED | Rundown sponsor graphics show "No sponsors configured" — team key mismatch with `&` character |
| BUG-S17 | Medium | FIXED | Rundown sponsor graphics ignore adjustment fields (scale, offset, crop) |

**See:** [PLAN-Sponsor-System-Implementation.md](./PLAN-Sponsor-System-Implementation.md) for task status.

---

## Fixed Bugs

### BUG-S01: Media Manager Crash on Team Expand (FIXED)

**Severity:** Critical
**Discovered:** 2026-02-13
**Fixed:** 2026-02-13

**Symptom:** Clicking to expand a team card with sponsors in Media Manager caused a black screen (React crash).

**Root Cause:** Firebase stores sponsor logo URL as `logoUrl` but the `getTeamSponsors()` hook function was mapping `data.url` (undefined).

**Error:** `TypeError: Cannot read properties of undefined (reading 'replace')` when trying to display the truncated URL.

**Fix:**
- `useTeamsDatabase.js` line 513: Changed `url: data.url` to `url: data.logoUrl || data.url`
- `MediaManagerPage.jsx`: Added null check for `sponsor.url` before calling `.replace()`

**Commit:** `3c8ed0f` - "Fix sponsor URL field name mismatch in Media Manager"

---

### BUG-S02: URL Generator Crash on Sponsor Graphics (FIXED)

**Severity:** Critical
**Discovered:** 2026-02-13
**Fixed:** 2026-02-13

**Symptom:** Clicking any sponsor graphic button in URL Generator caused a black screen (React crash).

**Root Cause:** `resolveSchoolKey` function was defined in `useTeamsDatabase.js` but not included in the return/export object. UrlGeneratorPage.jsx destructured it from the hook, getting `undefined`.

**Error:** `TypeError: m is not a function` (in minified code) when calling `resolveSchoolKey()`.

**Fix:** Added `resolveSchoolKey` to the exports in `useTeamsDatabase.js` return object (line 803).

**Commit:** `ca9bde4` - "Export resolveSchoolKey from useTeamsDatabase hook"

---

### BUG-S03: 403 Forbidden on Sponsor Overlay Files (FIXED - Recurred)

**Severity:** Medium
**Discovered:** 2026-02-13
**Fixed:** 2026-02-13, 2026-02-14 (recurred)

**Symptom:** Sponsor overlay URLs returned "403 Forbidden" nginx error OR blank preview in URL Generator when accessed in browser/OBS.

**Root Cause:** Overlay files were deployed with permissions `600` (owner read/write only) instead of `644` (world readable). This happens when files are uploaded via SCP from macOS.

**Fix:**
```bash
sudo chmod 644 /var/www/commentarygraphic/overlays/sponsors*.html
```

**Prevention:** After deploying overlays, ALWAYS run:
```bash
# SSH to server and fix permissions
ssh_exec target=3.87.107.201 command="sudo chmod 644 /var/www/commentarygraphic/overlays/*.html"
```

Or add to deployment script:
```bash
# After extracting overlays tarball
find /var/www/commentarygraphic/overlays -name '*.html' -exec chmod 644 {} \;
```

**Note:** This is a recurring deployment issue. The CLAUDE.md deploy instructions should include permission fix.

---

## Design Changes (Post-Implementation)

### sponsors-cycle.html - Simplified Design

**Date:** 2026-02-13

**Original Design:**
- Grey header bar with "OUR SPONSORS" title and team logo
- Centered logo (~600px) with sponsor name below
- 3-second cycling with 0.5s crossfade

**Updated Design:**
- Full screen logo on grey (#E5E5E5) background
- No header bar
- No sponsor name text
- Logo as large as possible (max 1800x960px)
- 3-second cycling with 0.5s crossfade

**Rationale:** User requested simpler design - just the PNG on grey background, full screen, logo as big as possible.

**Commit:** `1cfb3cc` - "Simplify sponsors-cycle overlay - full screen logo on grey background"

---

### sponsors-thanks.html - Card-Style Design

**Date:** 2026-02-13

**Original Design:**
- Full-screen grey header bar across top
- White/transparent background
- Small sponsor logos (200x200) with names below
- CSS grid layout

**Updated Design (v1):**
- Card container with margins (50px top/bottom, 70px left/right) - matches leaderboard style
- Grey header bar inside card
- Dark background (#18181b) with dark grey sponsor cards (#27272a)
- Logos fill their card boxes (width/height 100%)
- No sponsor name labels
- Rounded corners and box shadow

**Commit:** `e62a111` - "Redesign sponsors-thanks to match leaderboard card style"

---

### sponsors-thanks.html - Dynamic Background & Larger Logos

**Date:** 2026-02-14

**Previous Design (v1):**
- Dark grey sponsor card boxes behind each logo
- Small logos (300-400px grid cells)
- 30px gap between logos
- Static dark background (#18181b)

**Updated Design (v2):**
- No card boxes - logos float on background directly
- Larger logos (450-700px grid cells depending on count)
- 60px gap between logos for better spacing
- **Dynamic background color** based on logo analysis:
  - Light logos → Dark background with subtle color tint
  - Dark logos → Light background (#e5e5e5) with subtle tint
  - Mid-range → Neutral medium grey (#52525b)
- Canvas-based color analysis samples each logo to determine optimal contrast

**Technical Details:**
- Uses `crossOrigin = 'anonymous'` for CORS-enabled canvas analysis
- Samples 50x50 downscaled version of each logo
- Skips transparent pixels when calculating average color
- Calculates luminance using standard formula: `0.299*R + 0.587*G + 0.114*B`
- Applies subtle color tint to background based on average logo hue

**Rationale:** User requested removal of ugly grey boxes, larger logos, more spacing, and automatic background color selection for tasteful contrast.

---

### Graphics Controller - Sponsor Graphics Integration

**Date:** 2026-02-14

**Issue:** Sponsor graphics were not appearing in the Graphics Controller (Producer view) and clicking them did nothing.

**Root Causes:**
1. `sponsors` category was not included in `CATEGORY_TO_SECTION` mapping
2. `sponsors` was not in the category filter for building graphic buttons
3. `'Sponsors'` section was not in the sections array
4. `output.html` had no renderers for sponsor graphics
5. `resolveSchoolKey()` returns school name without gender suffix, but sponsors are stored under full team key with gender

**Fixes Applied:**

1. **GraphicsControl.jsx** - Added sponsor category support:
   - Added `'sponsors': 'Sponsors'` to `CATEGORY_TO_SECTION`
   - Added `'sponsors'` to category filter
   - Added `'Sponsors'` to sections array
   - Import `useTeamsDatabase` hook
   - Fetch sponsor data when sending sponsor graphics
   - Append gender suffix to school key for correct sponsor lookup

2. **output.html** - Added sponsor renderers:
   - `sponsors-thanks`: Loads overlay in iframe with sponsor data
   - `sponsors-cycle`: Loads overlay in iframe with sponsor data
   - `sponsors-bug`: Loads overlay in iframe with sponsor data

**Technical Details:**
```js
// GraphicsControl.jsx - Sponsor data fetching
const schoolKey = resolveSchoolKey(config.team1Name);
const homeTeamKey = schoolKey ? `${schoolKey}-${gender}` : null;
const teamSponsors = getTeamSponsors(homeTeamKey);
data.sponsors = JSON.stringify(teamSponsors.slice(0, 8).map(s => ({
  name: s.name,
  url: s.url
})));
```

```js
// output.html - Sponsor renderer example
'sponsors-thanks': (data) => {
  const logo = encodeURIComponent(getTeamLogoUrl(data.team1Name, data.team1Logo) || '');
  const sponsors = encodeURIComponent(data.sponsors || '[]');
  const overlayUrl = `/overlays/sponsors-thanks.html?logo=${logo}&sponsors=${sponsors}`;
  return `<iframe src="${overlayUrl}" style="width: 1920px; height: 1080px; border: none;"></iframe>`;
}
```

---

## Recently Fixed Bugs (T13-T17, 2026-03-11)

### BUG-S04: White-Background Logos Not Centered in Sponsor Cycle (FIXED - T13)

**Severity:** High
**Discovered:** 2026-03-11
**Fixed:** 2026-03-11 (T13)

**Symptom:** Sponsor logos with white/opaque backgrounds appear off-center in sponsors-cycle overlay.

**Root Cause:** `getContentBounds()` only detected transparent pixels as background. Opaque images with asymmetric whitespace were not trimmed.

**Fix:** T13 added two-pass content detection: alpha trimming first, then white/near-white pixel trimming for opaque images.

**Commit:** `8257352` - "Sponsor System T13: Add smart white background detection for sponsor logos"

---

### BUG-S05: No Sponsor Adjustment Controls in Media Manager (FIXED - T14-T15)

**Severity:** High
**Discovered:** 2026-03-11
**Fixed:** 2026-03-11 (T14, T15)

**Fix:** T14 extended the data model to include crop/scale/offset fields. T15 added adjustment UI to Media Manager SponsorsView.

**Commits:** `9ec2d21` (T14), `bd3bf31` (T15)

---

### BUG-S06: GraphicsControl Drops Adjustment Fields (FIXED - T16)

**Severity:** Medium
**Discovered:** 2026-03-11
**Fixed:** 2026-03-11 (T16)

**Fix:** T16 included all adjustment fields (scale, offsetX, offsetY, cropX, cropY, cropW, cropH) in sponsor JSON serialization in GraphicsControl.jsx.

**Commit:** `fd662ff` - "Sponsor System T16: Pass all adjustment fields in sponsor serialization"

---

### BUG-S07: URL Generator Sponsor Overrides Not Persisted (PARTIAL - T17)

**Severity:** Medium
**Discovered:** 2026-03-11
**Partially Fixed:** 2026-03-11 (T17)

**What T17 fixed:** Sponsor adjustments made in the URL Generator are now persisted to Firebase for **theme sponsors** (writes to `themes/{themeId}/sponsors/{index}`).

**What's still broken:** The persist logic only handles theme sponsors. For per-team sponsors, the `SponsorAdjustControls` component is never rendered (see BUG-S08), so this code path is never reached.

**Commit:** `585ff5c` - "Sponsor System T17: Persist sponsor adjustments to Firebase in URL Generator"

---

## Recently Fixed Bugs (2026-03-12)

### BUG-S08: URL Generator Sponsor Adjustment Controls Hidden for Per-Team Sponsors (FIXED)

**Severity:** High
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** When a competition uses per-team sponsors (no meet theme), the URL Generator showed no sponsor adjustment controls.

**Root Cause:** `SponsorAdjustControls` was gated by `meetThemeSponsors.length > 0` — per-team sponsors were never considered.

**Fix:** Added `activeSponsorList` in `UrlGeneratorPage.jsx` that falls back to per-team sponsors via `getTeamSponsors()` when no theme sponsors exist. Controls now render for both sources. Persistence uses `saveSponsor()` for team sponsors, `update()` for theme sponsors. This also completes BUG-S07 (persist for team sponsors).

---

### BUG-S09: Duplicate William & Mary Team Keys (FIXED)

**Severity:** Medium
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** Sponsors stored at `william-mary-womens` but competition referenced `william-&-mary-womens`.

**Fix (Firebase data):**
1. Merged `rtnId: "75"` into canonical `william-mary-womens` entry
2. Deleted orphan `william-&-mary-womens` entry
3. Updated competition `0l8juzfq` config to use `william-mary-womens`

**Broader concern:** RTN stats ingestion may create keys with special characters. Should audit key normalization for consistency.

---

### BUG-S10: Media Manager Sponsor Preview Not Scaled (FIXED)

**Severity:** Low
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** The sponsor preview iframe in Media Manager's adjustment panel showed the 1920x1080 overlay content at native resolution crammed into a 320x176 box, making logos appear as tiny slivers.

**Fix:** Set iframe to 1920x1080 with `transform: scale(0.1667)` and `transform-origin: top left` to properly scale the full overlay into the preview container.

---

### BUG-S11: URL Generator Page Crash After BUG-S08 Fix (FIXED)

**Severity:** Critical
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** URL Generator page would not load (blank white screen) after the BUG-S08 fix was deployed.

**Root Cause:** The BUG-S08 fix added `const teamHomeKey = useMemo(() => resolveHomeTeamKey(...))` on line 181, but `resolveHomeTeamKey` was defined on line 375. `const` declarations are not hoisted in JavaScript, so the function was `undefined` when the `useMemo` ran, causing a crash.

**Fix:** Moved the `teamHomeKey`, `teamSponsorsRaw`, `activeSponsorList`, and `activeSponsorSource` declarations to right after the `resolveHomeTeamKey` function definition (line 370+).

---

### BUG-S12: Wide Logos Overflow Viewport in Sponsors-Cycle Overlay (FIXED)

**Severity:** High
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** Sponsor logos with wide aspect ratios (e.g., 1303×679 content bounds) were rendered at 1727px wide after scaling to TARGET_HEIGHT=900, overflowing the 1920px viewport and appearing cut off on the right.

**Root Cause:** `renderTrimmedLogo()` in `sponsors-cycle.html` only constrained height (`TARGET_HEIGHT = 900`) with no width limit. Wide logos scaled to fill 900px height would exceed viewport width.

**Fix:** Added `MAX_WIDTH = 1400` constraint. Rendering now uses `Math.min(scaleH, scaleW)` so logos fit both height and width limits. Also updated bounds overlay to use `canvas.height / usedBounds.h` instead of hardcoded `TARGET_HEIGHT`.

---

### BUG-S13: Per-Team Sponsors Not Loading in URL Generator (FIXED)

**Severity:** High
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** Sponsor graphics in the URL Generator showed "No sponsors configured" even though per-team sponsors existed in Firebase. The sponsor adjustment controls also didn't appear.

**Root Cause:** `teamHomeKey` was computed with `useMemo` depending on `[formData.team1Name, config?.compType]`, but `resolveSchoolKey` (called inside) is a `useCallback` that depends on `[teams, aliases]`. When Firebase data loaded and `resolveSchoolKey` got a new reference, the `useMemo` didn't recompute because `resolveSchoolKey` wasn't in its dependency array.

**Fix:** Added `resolveSchoolKey` to the `useMemo` dependency array for `teamHomeKey`.

---

### BUG-S14: Sponsor Slides Not Centered — Inline `position: relative` Breaks Absolute Stacking (FIXED)

**Severity:** High
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** Sponsor logos in `sponsors-cycle.html` appeared shifted to the right and cut off when a competition had 2+ sponsors. Single-sponsor competitions looked fine.

**Root Cause:** In `sponsors-cycle.html` line 407, each slide div had `slide.style.position = 'relative'` set inline (added for bounds overlay positioning), which overrode the CSS class's `position: absolute`. This turned the slides from stacked absolute layers into flex items inside `#container` (which uses `display: flex`). With 2+ slides each wanting 1920px width, they competed for space inside the 1920px container — flex shrink kicked in, minimum content width (canvas at 1400px) prevented full shrinking, and `justify-content: center` pushed the overflowing items off-screen.

**Why single sponsors worked:** With only one flex item of 1920px in a 1920px container, there was no shrink competition, so the slide filled correctly.

**Fix:** Removed the inline `slide.style.position = 'relative'` override. The CSS `position: absolute` on `.sponsor-slide` already establishes a positioning context for bounds overlay children (absolutely-positioned elements create a containing block for their descendants).

**Key Lesson:** Never override `position: absolute` with inline styles on overlay slides that are designed to stack. The absolute positioning is critical for the cycling/stacking behavior — it removes slides from the flex flow so they overlap at the same coordinates. If you need a positioning context for child elements, `position: absolute` already provides one.

---

### BUG-S15: "Reset to Auto" Crop Broken — Race Condition + Zero-Crop Blank Slides (FIXED)

**Severity:** Critical
**Discovered:** 2026-03-12
**Fixed:** 2026-03-12

**Symptom:** Clicking "Reset to Auto" on crop controls did not clear the crop values. Additionally, partial crop values (e.g., `cropW: 10, cropH: 0`) caused the sponsor slide to render a zero-height canvas (blank).

**Root Causes (two issues):**

1. **Race condition in Reset to Auto:** The button fired 4 separate `onUpdate(index, field, null)` calls — one for each crop field. Each call read stale `sponsor` data from `teamSponsorsRaw` and called `saveSponsor()` (which uses Firebase `set()` — full overwrite). Each call spread the OLD crop values from the stale sponsor, only nulling its one field. The last call to complete determined the final Firebase state, often re-writing values that earlier calls had tried to delete.

2. **Zero-crop canvas:** If `cropH` was 0, `renderTrimmedLogo()` computed `TARGET_HEIGHT / 0 = Infinity` for the scale, producing a canvas with height 0. Nothing rendered.

**Fixes (three layers):**

1. **Batch reset** (`SponsorAdjustControls.jsx`): Changed "Reset to Auto" to call `onUpdate(index, { cropX: null, cropY: null, cropW: null, cropH: null })` — a single batch call instead of 4 individual calls.

2. **Batch-aware handler** (`UrlGeneratorPage.jsx`): Updated `onUpdate` to accept either `(index, field, value)` or `(index, fieldsObject)` for batch updates. A single `saveSponsor()` call with all null crop fields prevents the race condition.

3. **Zero-crop guard** (`sponsors-cycle.html`): Added validation in `getEffectiveBounds()` — if crop width or height is ≤ 0, falls back to auto-detected bounds instead of producing a zero-size canvas.

**Key Lesson:** When resetting multiple related fields, always use a single batch operation. Never fire N separate save calls that each read stale data and do full overwrites — the last one wins and can undo earlier resets. Also, overlay renderers must validate all numeric inputs (especially dimensions) to prevent zero/negative values from producing invisible output.

---

### BUG-S16: Rundown Sponsor Graphics Show "No Sponsors Configured" (FIXED)

**Severity:** High
**Discovered:** 2026-03-14
**Fixed:** 2026-03-14

**Symptom:** When the "Thank you to sponsors" graphic is triggered via the rundown system, the overlay displays "No sponsors configured." The same graphic works correctly when triggered manually from the producer view or URL Generator.

**Root Cause:** Key mismatch between `config.team1Key` and the sponsors database key. The competition config stored `team1Key` as `william-&-mary-mens` (with ampersand), but sponsors were stored under `teamsDatabase/sponsors/william-mary-mens` (without ampersand). The timesheetEngine used `config.team1Key` directly for the Firebase lookup, finding nothing.

The manual trigger (GraphicsControl) worked because it uses `resolveSchoolKey()` which normalizes the team name — stripping special characters and resolving via aliases — before looking up sponsors. The rundown path (timesheetEngine) bypassed this normalization.

**Two code paths:**
| Path | Sponsor lookup | Result |
|------|---------------|--------|
| Manual (GraphicsControl) | `resolveSchoolKey(config.team1Name)` + gender suffix → `william-mary-mens` | Found sponsors |
| Rundown (timesheetEngine) | `config.team1Key` directly → `william-&-mary-mens` | No sponsors found |

**Fix:** Added a fallback in `timesheetEngine.js` `_triggerGraphic()` — when the exact `team1Key` lookup returns no sponsors, try a normalized version with `&` and other special characters stripped. If the normalized key finds sponsors, use those.

```javascript
// Fallback: try normalized key (strip special chars like &)
if (!sponsorsData) {
  const normalizedKey = teamKey.replace(/[&]+/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  if (normalizedKey !== teamKey) {
    const fallbackSnapshot = await db.ref(`teamsDatabase/sponsors/${normalizedKey}`).once('value');
    sponsorsData = fallbackSnapshot.val();
  }
}
```

**Related:** BUG-S09 fixed the same key mismatch for women's (`william-&-mary-womens` → `william-mary-womens`) but only cleaned up the Firebase data for that competition. The men's team still had the duplicate key issue, and no code-level fix was applied to handle mismatches generically.

**Key Lesson:** When looking up Firebase data by team key on the server side, always handle key normalization. Special characters (`&`, `'`, etc.) in team names can produce different keys depending on how the key was generated (Virtius import vs manual entry vs `resolveSchoolKey`). Server-side lookups should try normalized fallbacks when exact matches fail.

---

### BUG-S17: Rundown Sponsor Graphics Ignore Adjustment Fields (FIXED)

**Severity:** Medium
**Discovered:** 2026-03-14
**Fixed:** 2026-03-14

**Symptom:** Sponsor logo adjustments (scale, offset, crop) made in the URL Generator are persisted to Firebase but not applied when the sponsor graphic is triggered via the rundown. Logos appear at default size/position instead of the adjusted values.

**Root Cause:** The timesheetEngine's `_triggerGraphic()` only extracted `name` and `url` from each sponsor record, discarding all adjustment fields (`scale`, `offsetX`, `offsetY`, `cropX`, `cropY`, `cropW`, `cropH`). The GraphicsControl (manual trigger) already included these fields.

**Fix:** Updated the sponsor array mapping in `timesheetEngine.js` to include all adjustment fields, matching the GraphicsControl behavior:

```javascript
.map(([key, sponsor]) => ({
  name: sponsor.name,
  url: sponsor.logoUrl || sponsor.url,
  order: sponsor.order ?? 0,
  ...(sponsor.scale != null && sponsor.scale !== 100 ? { scale: sponsor.scale } : {}),
  ...(sponsor.offsetX ? { offsetX: sponsor.offsetX } : {}),
  ...(sponsor.offsetY ? { offsetY: sponsor.offsetY } : {}),
  ...(sponsor.cropX != null ? { cropX: sponsor.cropX } : {}),
  ...(sponsor.cropY != null ? { cropY: sponsor.cropY } : {}),
  ...(sponsor.cropW != null ? { cropW: sponsor.cropW } : {}),
  ...(sponsor.cropH != null ? { cropH: sponsor.cropH } : {}),
}))
```

**Related:** BUG-S06 was the same issue but in GraphicsControl — adjustment fields were added there in T16 but the timesheetEngine was never updated to match.
