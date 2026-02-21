# Sponsor System - Bug Tracker

## Bug Summary (2026-02-14)

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| BUG-S01 | Critical | FIXED | Media Manager crash on team expand (logoUrl field mismatch) |
| BUG-S02 | Critical | FIXED | URL Generator crash on sponsor graphics (missing export) |
| BUG-S03 | Medium | FIXED (2x) | 403 Forbidden on sponsor overlay files (permissions) |

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
