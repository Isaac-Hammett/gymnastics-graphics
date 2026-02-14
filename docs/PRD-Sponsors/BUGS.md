# Sponsor System - Bug Tracker

## Bug Summary (2026-02-13)

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| BUG-S01 | Critical | FIXED | Media Manager crash on team expand (logoUrl field mismatch) |
| BUG-S02 | Critical | FIXED | URL Generator crash on sponsor graphics (missing export) |
| BUG-S03 | Medium | FIXED | 403 Forbidden on sponsor overlay files (permissions) |

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

### BUG-S03: 403 Forbidden on Sponsor Overlay Files (FIXED)

**Severity:** Medium
**Discovered:** 2026-02-13
**Fixed:** 2026-02-13

**Symptom:** Sponsor overlay URLs returned "403 Forbidden" nginx error when accessed in browser/OBS.

**Root Cause:** Overlay files were deployed with permissions `600` (owner read/write only) instead of `644` (world readable).

**Fix:** `sudo chmod 644 /var/www/commentarygraphic/overlays/*.html`

**Note:** This was a deployment issue, not a code bug. Future deployments should ensure proper permissions.

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

**Updated Design:**
- Card container with margins (50px top/bottom, 70px left/right) - matches leaderboard style
- Grey header bar inside card
- Dark background (#18181b) with dark grey sponsor cards (#27272a)
- Logos fill their card boxes (width/height 100%)
- No sponsor name labels
- Rounded corners and box shadow

**Rationale:** User requested it look like the leaderboards page - not full screen, with logos filling their boxes.

**Commit:** `e62a111` - "Redesign sponsors-thanks to match leaderboard card style"
