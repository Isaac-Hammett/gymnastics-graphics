# Meet Theme System - Bug Tracker

## Bug Summary (2026-03-12)

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| BUG-T001 | High | FIXED | Logo washed out against matching theme background color |
| BUG-T002 | High | FIXED | Theme CSS changes not reflected in producer view / URL generator (dual CSS locations) |
| BUG-T003 | Medium | FIXED | Stream overlay text invisible on transparent background |
| BUG-T004 | Medium | FIXED | theme-loader.js and theme-overrides.css return 403 (file permissions) |
| BUG-T005 | Medium | FIXED | Frame overlay logos get yellow/theme background instead of transparent |
| BUG-T006 | High | FIXED | Virtius logo on start page uses text, not SVG |
| BUG-T007 | Medium | FIXED | "Loading Leaderboard" message looks like a website |
| BUG-T008 | High | FIXED | Event Summary Event Total text at bottom is TINY |
| BUG-T009 | High | FIXED | All number fonts need `font-variant-numeric: tabular-nums` for vertical alignment |

---

## BUG-T001: Logo Washed Out Against Theme Background

**Date Identified:** 2026-03-08
**Date Fixed:** 2026-03-08
**Severity:** High
**Status:** FIXED

**Problem:**
When theme colors are extracted from a meet logo, the logo becomes invisible/washed out against the matching theme background. For example, the ISLA HBCU logo (gold/black) disappears against the gold `--meet-header-bg` background in the event bar, warm-up, replay, and rotation slate graphics.

**Root Cause:**
Logo containers (`.logo-section`, `.event-bar-logo`, etc.) used `var(--meet-header-bg)` as their background, which is often the same color as the logo itself.

**Fix:**
When a theme is active (`[data-meet-theme]`), logo containers get a white background (`rgba(255, 255, 255, 0.92)`) so the logo pops. The logo image itself is set to `background: transparent` to avoid a "box-in-box" effect.

**Files Changed:**
- `overlays/theme-overrides.css` — Added LOGO CONTRAST section
- `output.html` — Updated `.event-bar-logo`, `.warm-up-logo-section`, `.replay-logo-section` inline styles

**Affected Graphics:** event-bar, warm-up, replay, rotation-slate, logos, sponsors, team-roster

---

## BUG-T002: Theme CSS Not Applied in Producer View / URL Generator

**Date Identified:** 2026-03-08
**Date Fixed:** 2026-03-08
**Severity:** High
**Status:** FIXED

**Problem:**
After fixing logo contrast in `theme-overrides.css`, the fix appeared in standalone overlay URLs but NOT in the producer view or URL generator preview. The logo containers still showed the old theme-colored background.

**Root Cause:**
Theme CSS exists in **two separate locations** that must stay in sync:

1. `overlays/theme-overrides.css` — Used by overlay HTML files (loaded by `theme-loader.js`)
2. `output.html` inline `<style>` — Used by the producer view and URL generator

Changes were only made to `theme-overrides.css` but not to `output.html`. The two files also use **different class names** for the same elements:

| Overlay class | output.html class | Used in |
|---------------|-------------------|---------|
| `.logo-section` | `.event-bar-logo` | Event bar logo container |
| `.logo-section` | `.warm-up-logo-section` | Warm-up logo container |
| `.logo-section` | `.replay-logo-section` | Replay logo container |

**Fix:**
Updated all three logo container rules in `output.html` inline styles to use `rgba(255, 255, 255, 0.92)` background + transparent image background.

**Prevention:**
Added "Meet Theme System - IMPORTANT" section to CLAUDE.md documenting the dual CSS locations and the requirement to update both when making theme changes.

---

## BUG-T003: Stream Overlay Text Invisible on Transparent Background

**Date Identified:** 2026-03-08
**Date Fixed:** 2026-03-08
**Severity:** Medium
**Status:** FIXED

**Problem:**
After making the stream overlay background transparent (for OBS layering), the text became invisible because it was using `--meet-overlay-text` (white, `#FFFFFF` for ISLA HBCU theme) on a transparent/white background.

**Root Cause:**
Stream text used `var(--meet-overlay-text)` which is designed for text on dark `--meet-overlay-bg` backgrounds. With transparent background, the text needs to be dark.

**Fix:**
Changed stream text to use `var(--meet-header-text)` instead, which is dark (`#1a1a1a` for ISLA HBCU).

**Files Changed:**
- `overlays/theme-overrides.css` — `.stream-title`, `.stream-event-name`, `.stream-date`, `.stream-branding`

---

## BUG-T004: Theme JS/CSS Files Return 403 Forbidden

**Date Identified:** 2026-03-08
**Date Fixed:** 2026-03-08
**Severity:** Medium
**Status:** FIXED

**Problem:**
After deploying overlays, `theme-loader.js` and `theme-overrides.css` returned 403 Forbidden from nginx. Theme was completely non-functional.

**Root Cause:**
macOS creates files with `600` permissions when uploaded via SCP. The deploy script only ran `chmod 644` on `*.html` files, missing `.js` and `.css` files. nginx (running as `www-data`) could not read them.

**Fix:**
Changed deploy command from `chmod 644 overlays/*.html` to `chmod 644 overlays/*` to cover all file types. Updated CLAUDE.md deploy instructions.

---

## BUG-T005: Frame Overlay Logos Get Yellow/Theme Background

**Date Identified:** 2026-03-08
**Date Fixed:** 2026-03-08
**Severity:** Medium
**Status:** FIXED

**Problem:**
In the frame overlays (Team Header Dual, Dual View), team logos displayed yellow/gold boxes behind them when a theme was active. The logos should always be transparent in frame overlays since they sit on top of the video feed in OBS.

**Root Cause:**
Frame overlay logos use the `.team-logo` class, which could inherit theme background styles from broader CSS rules. While the standalone overlay files rendered correctly (computed background was transparent), the `output.html` producer rendering and cached browser styles could apply unwanted backgrounds.

**Fix:**
Added explicit `background: transparent !important` rules for frame overlay logos in both CSS locations:

- `overlays/theme-overrides.css`:
  ```css
  [data-meet-theme] .header-row .team-logo,
  [data-meet-theme] .logo-header .team-logo { background: transparent !important; }
  [data-meet-theme] .graphic-frame-overlay .team-logo { background: transparent !important; }
  ```
- `output.html` inline styles:
  ```css
  [data-meet-theme] .graphic-frame-overlay .team-logo { background: transparent !important; }
  ```

**Key Lesson:**
Frame overlays are designed for OBS compositing — they must always have transparent backgrounds on all elements (logos, panels, body). When adding theme support, frame overlays should be explicitly excluded from logo contrast fixes that add white backgrounds.

---

## Open Bugs (BZL Feedback 2026-03-12)

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| BUG-T006 | High | FIXED | Virtius logo on start page uses text, not SVG |
| BUG-T007 | Medium | FIXED | "Loading Leaderboard" message looks like a website |
| BUG-T008 | High | FIXED | Event Summary Event Total text at bottom is TINY |
| BUG-T009 | High | FIXED | All number fonts need `font-variant-numeric: tabular-nums` for vertical alignment |

---

## BUG-T006: Virtius Logo on Start/Thanks Page Uses Text, Not SVG (FIXED)

**Date Identified:** 2026-03-12
**Date Fixed:** 2026-03-12
**Severity:** High
**Status:** FIXED

**Problem:**
The "Stream Starting Soon" / "Thanks for Watching" overlay rendered "Virtius" as styled HTML text (`<span>V</span>irtius`) instead of using the official SVG logo. The font didn't match the real Virtius branding.

**Fix:**
Replaced the `.stream-branding` text element with an `<img>` tag pointing to `/assets/virtius-logo.svg`. Updated CSS to size the SVG (height: 40px, auto width). Both the "Starting Soon" and "Thanks for Watching" graphics use the same `stream.html` overlay, so both are fixed.

**Files Changed:**
- `overlays/stream.html` — Line 87 (HTML), lines 66-74 (CSS)

**Note:** The SVG file (`assets/virtius-logo.svg`) was also deployed to `/var/www/commentarygraphic/assets/` with 644 permissions.

---

## BUG-T007: "Loading Leaderboard" Text Looks Like a Website (FIXED)

**Date Identified:** 2026-03-12
**Date Fixed:** 2026-03-12
**Severity:** Medium
**Status:** FIXED

**Problem:**
When a leaderboard graphic loaded, it showed "Loading leaderboard..." in large white text on black background. This looked like a website loading state, not broadcast graphics.

**Fix:**
Removed the "Loading leaderboard..." text from the HTML template. The loading div is now empty — shows a black screen while data loads.

**Files Changed:**
- `output.html` — Line 11247 (HTML template)

---

## BUG-T008: Event Summary Event Total Text at Bottom is TINY (FIXED)

**Date Identified:** 2026-03-12
**Date Fixed:** 2026-03-12
**Severity:** High
**Status:** FIXED

**Problem:**
The Event Total score at the bottom of the Event Summary graphic was too small (32-36px depending on layout).

**Fix:**
Increased all `.event-total` font-sizes to 48px across all layout variants:

| Selector | Before | After |
|----------|--------|-------|
| `.event-summary-footer .event-total` | 32px | 48px |
| `.layout-classic-broadcast .event-total` | 32px | 48px |
| `.layout-default-v2-footer .event-total` | 36px | 48px |
| `.layout-dual-dynamic-v1-footer .event-total` | 36px | 48px |

**Files Changed:**
- `output.html` — Lines 765, ~1693, ~1996, ~2273

---

## BUG-T009: Numbers Need `font-variant-numeric: tabular-nums` for Vertical Alignment (FIXED)

**Date Identified:** 2026-03-12
**Date Fixed:** 2026-03-12
**Severity:** High
**Status:** FIXED

**Problem:**
All score/number displays used proportional digit widths, causing numbers to not align vertically in columns.

**Fix:**
Added `font-variant-numeric: tabular-nums` at the container level where possible, and on specific selectors in overlays:

| File | Selector Updated |
|------|-----------------|
| `output.html` | `.graphic-event-summary` (inherits to all scores) |
| `output.html` | `.graphic-virtius-leaderboard` (inherits to all scores) |
| `overlays/team-bug.html` | `.team-total` |
| `overlays/team-stats.html` | `.stat-value` |
| `overlays/rotation-slate.html` | `.layout-classic .rotation-number` |
| `overlays/rotation-slate-auto.html` | `.rotation-number` |

**Note:** Adding at the container level (`.graphic-event-summary`, `.graphic-virtius-leaderboard`) is more efficient than updating 40+ individual `.athlete-score` and `.team-total` rules.

---

## Known Pitfalls & Watch List

### 1. Dual CSS Location Sync
**Any theme CSS change must be applied to BOTH:**
- `overlays/theme-overrides.css`
- `output.html` inline styles (search "MEET THEME OVERRIDES")

Failure to update both causes the producer view to show stale styles while standalone overlays look correct.

### 2. File Permissions on Deploy
Always `chmod 644 overlays/*` (not just `*.html`) after deploying overlays. JS and CSS files need to be world-readable for nginx.

### 3. CSS Specificity
Overlay HTML files have inline `<style>` blocks with their own rules. `theme-overrides.css` uses `[data-meet-theme]` prefix for higher specificity, which wins over the inline styles. If you add new inline styles to overlays, ensure theme-overrides can still override them.

### 4. Logo Contrast
When adding new graphics with logo containers, ensure the container gets `background: rgba(255, 255, 255, 0.92)` under `[data-meet-theme]` so logos aren't washed out by matching theme colors.

### 5. Frame Overlays Must Stay Transparent
Frame overlays (quad, tri, dual, team-header, single) are OBS compositing layers — every element must remain transparent. Never apply theme backgrounds (white or colored) to logos or panels in frame overlays. If adding new frame overlays, include them in the `background: transparent !important` rules in both `theme-overrides.css` and `output.html`.
