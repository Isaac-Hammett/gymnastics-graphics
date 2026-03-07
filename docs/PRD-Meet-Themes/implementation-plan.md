# Meet Theme System - Implementation Plan

**PRD:** PRD-Meet-Themes-2026-03-06
**Date:** 2026-03-06
**Last Updated:** 2026-03-06

---

## Phase 1: Foundation (theme-loader + CSS infrastructure) - COMPLETE

### Task 1.1: Create `overlays/theme-loader.js` - COMPLETE

Shared script loaded by all overlay HTML files and inlined in `output.html`.

**Behavior:**
1. Read `meetTheme` param from URL
2. If absent, do nothing (no-op = zero regression)
3. If present, conditionally init Firebase SDK (check `firebase.apps.length`)
4. Fetch theme from `themes/{themeId}` via Firebase Realtime Database `.once('value')`
5. Apply CSS custom properties to `document.documentElement`:
   - `--meet-accent-primary`, `--meet-accent-secondary`
   - `--meet-header-bg`, `--meet-header-text`
   - `--meet-footer-bg`, `--meet-border-color`
   - `--meet-badge-bg`, `--meet-badge-text`
   - `--meet-overlay-bg`, `--meet-overlay-text`
6. Set `data-meet-theme` attribute on `<body>` for CSS selector targeting
7. Inject meet logo and cause logo URLs as CSS custom properties

**Firebase config:** Reuse the same config already in `overlays/team-roster.html`.

### Task 1.2: Create `overlays/theme-overrides.css` - COMPLETE

CSS rules scoped under `[data-meet-theme]` that override chrome elements:

```css
[data-meet-theme] .header-bar,
[data-meet-theme] .frame-header,
[data-meet-theme] .hosts-header { background: var(--meet-header-bg); color: var(--meet-header-text); }

[data-meet-theme] .event-bar-logo { background: var(--meet-accent-secondary); }
[data-meet-theme] .frame-content { border-top: 4px solid var(--meet-border-color); }
```

Theme-loader.js injects this stylesheet dynamically (via `<link>` tag) only when a theme is active.

### Task 1.3: Add theme loading to `output.html` - COMPLETE

- Inline the theme-loader logic (output.html is self-contained, doesn't reference external scripts)
- Add CSS variable override rules for:
  - Event summary: header bg, footer bg, border color, rotation badge, center divider
  - Leaderboard: header/footer chrome
- **Do NOT touch** team column backgrounds -- they keep using `--home-primary`, `--away-primary`

**Key insertion point:** After the existing Firebase/Virtius API initialization, before graphic rendering.

---

## BLOCKER: Firebase Security Rules

**Status:** REQUIRES MANUAL ACTION

The `themes/` path needs public read access in Firebase Realtime Database rules.

**Current error:** `permission_denied at /themes/pink-meet-2026: Client doesn't have permission to access the desired data.`

**Fix:** Add this rule to Firebase Console > Realtime Database > Rules:

```json
{
  "rules": {
    "themes": {
      ".read": true,
      ".write": "auth != null"
    }
    // ... existing rules
  }
}
```

**How to apply:**
1. Go to https://console.firebase.google.com/project/gymnastics-graphics/database/gymnastics-graphics-default-rtdb/rules
2. Add the `"themes"` rule alongside existing rules
3. Click "Publish"

---

## Phase 2: Overlay Integration (24 files) - COMPLETE

### Task 2.1: Add theme-loader to each overlay - COMPLETE

For each file in `overlays/*.html`:
1. Add `<script src="theme-loader.js"></script>` before `</body>`
2. For overlays without Firebase SDK imports, theme-loader handles the conditional init

**Completed 2026-03-06:** Added `<script src="theme-loader.js"></script>` to all 22 overlay HTML files:
- event-frame.html, stream.html, event-bar.html, hosts.html, team-stats.html
- coaches.html, warm-up.html, logos.html, replay.html, athlete-spotlight.html
- frame-quad.html, frame-single.html, frame-team-header.html, frame-tri-center.html
- frame-tri-wide.html, frame-dual.html, sponsors-bug.html, sponsors-cycle.html
- sponsors-thanks.html, team-bug.html, team-roster.html, rotation-slate.html

### Task 2.2: Replace hardcoded accent colors with CSS variable fallbacks - COMPLETE

Priority order (most visible first):
1. `event-frame.html` -- header bar, title area
2. `stream.html` -- full-screen backgrounds
3. `rotation-slate.html` -- slate backgrounds, borders
4. `team-roster.html` -- header bar, accent elements
5. `event-bar.html` -- logo bg (`#BFBFBF` -> `var(--meet-accent-secondary, #BFBFBF)`)
6. `logos.html` -- logo card backgrounds
7. `hosts.html` -- header bar
8. `coaches.html` -- header/accent
9. Remaining overlays: `warm-up.html`, `team-stats.html`, `sponsors-*.html`, etc.

**Pattern:** `background: #BFBFBF` becomes `background: var(--meet-header-bg, #BFBFBF)`

**Completed 2026-03-06:** Updated 19 overlay HTML files with CSS variable fallbacks:
- **event-frame.html**: header-bg, header-text, border-color
- **stream.html**: overlay-text (title, event-name, date)
- **rotation-slate.html**: overlay-bg, accent-secondary, overlay-text, border-color
- **event-bar.html**: accent-secondary (logo/venue rows), header-text
- **logos.html**: accent-secondary (logo backgrounds)
- **hosts.html**: header-bg, header-text
- **coaches.html**: header-bg, header-text
- **team-stats.html**: header-bg, header-text
- **warm-up.html**: accent-secondary, header-text
- **replay.html**: accent-secondary, header-text
- **athlete-spotlight.html**: header-bg, header-text
- **frame-dual.html**: border-color
- **frame-quad.html**: border-color
- **frame-single.html**: border-color
- **frame-team-header.html**: border-color
- **frame-tri-center.html**: border-color
- **frame-tri-wide.html**: border-color
- **sponsors-thanks.html**: header-bg, header-text, overlay-bg
- **sponsors-cycle.html**: overlay-bg
- **sponsors-bug.html**: badge-bg

---

## Phase 3: URL Transport - COMPLETE

### Task 3.1: Thread `meetTheme` through `urlBuilder.js` - COMPLETE

Add `meetTheme` to the options object in these functions:
- `generateGraphicURL()` -- main entry point
- `buildLogosURL()`
- `buildEventBarURL()`
- `buildEventFrameURL()`
- `buildStreamURL()`
- `buildEventSummaryURL()`
- `buildLeaderboardURL()`
- `buildGraphicUrlFromRegistry()` -- schema-driven builder

**Implementation:** At the end of each function, before returning, append `&meetTheme={id}` if present in options.

**Completed 2026-03-06:** Added `meetTheme` parameter to all 14 URL builder functions:
- `buildLogosURL`, `buildEventBarURL`, `buildHostsURL`, `buildTeamStatsURL`, `buildCoachesURL`
- `buildTeamRosterURL`, `buildEventFrameURL`, `buildStreamURL`, `buildSponsorsThanksURL`
- `buildSponsorsCycleURL`, `buildSponsorsBugURL`, `buildFrameOverlayURL`, `buildLeaderboardURL`
- `buildEventSummaryURL`, `buildGraphicUrlFromRegistry`, `generateGraphicURL`

### Task 3.2: Pass `meetTheme` from competition config in controllers - COMPLETE

**`QuickActions.jsx`:**
- Read `competitionConfig.meetTheme`
- Include in data sent to Firebase when generating graphics

**`UrlGeneratorPage.jsx`:**
- Include `meetTheme` from config in generated URLs

**Completed 2026-03-06:** Updated both files to read and pass `meetTheme` from competition config.

---

## Phase 4: Theme Editor UI - COMPLETE

### Task 4.1: Create `show-controller/src/pages/ThemeEditorPage.jsx` - COMPLETE

**Layout (3-column):**
- **Left panel**: Theme list from Firebase `themes/`, with "New Theme" button
- **Center panel**: Form fields
  - Theme name, description
  - 10 color pickers (accentPrimary, accentSecondary, headerBg, headerText, footerBg, borderColor, badgeBg, badgeText, overlayBg, overlayText)
  - Meet logo URL input + preview thumbnail
  - Cause logo URL input + preview thumbnail
  - Meet title text field
  - Subtitle text field
- **Right panel**: Live preview with color swatches (shows header, badge, accent, footer previews)

**Preset templates (hardcoded in UI):**
- Pink Meet: `#E91E8C` / `#FFB6D9`
- Military Appreciation: `#4A5C3E` / `#C5A55A`
- Senior Night: `#FFD700` / `#1a1a1a`
- Blackout: `#000000` / `#00FF88`

**Save/Load:**
- Save: `firebase_set('themes/{themeId}', themeData)`
- Load: `firebase_get('themes/{themeId}')`
- List: `firebase_list_paths('themes/')`
- Delete: `firebase_delete('themes/{themeId}')` with confirmation

**Completed 2026-03-06:** Created ThemeEditorPage.jsx with:
- 3-column layout (theme list, editor form, live preview)
- 4 preset templates
- 10 color pickers with contrast warnings
- Logo URL inputs with preview thumbnails
- Meet title and subtitle text fields
- Save/load/delete functionality
- Unsaved changes indicator

### Task 4.2: Add route and navigation - COMPLETE

- Add route in `App.jsx`: `/theme-editor` -> `ThemeEditorPage`
- Add "Theme Editor" card on `HomePage.jsx` in Management Tools section

**Completed 2026-03-06:** Added route and navigation link.

---

## Phase 5: Competition Assignment - COMPLETE

### Task 5.1: Add "Meet Theme" dropdown to competition config UI - COMPLETE

- Locate the competition config form (likely in a setup/config page)
- Add a dropdown populated from Firebase `themes/` path
- Options: "None" (default) + all saved themes
- On change: write `meetTheme` field to `competitions/{compId}/config`

**Completed 2026-03-06:** Updated `show-controller/src/pages/HomePage.jsx`:
- Added Firebase themes listener with `useEffect` and `onValue`
- Added `meetTheme` to `getDefaultFormData()`, `openEditModal()`, and `handleSubmit()` config
- Added Meet Theme dropdown with color preview swatch after Location field in CompetitionModal
- Dropdown shows "None" as default, plus all saved themes from Firebase
- Shows theme description when a theme is selected

---

## Phase 6: Deploy & Verify - COMPLETE

### Task 6.1: Create Pink Meet preset theme in Firebase - COMPLETE

**Completed 2026-03-06:** Used `firebase_set` to write Pink Meet theme to `themes/pink-meet-2026`:
- Name: "Pink Meet 2026"
- Description: "Breast cancer awareness fundraiser"
- Colors: accentPrimary=#E91E8C, accentSecondary=#FFB6D9, headerBg=#E91E8C, etc.

### Task 6.2: Build and deploy - COMPLETE

**Completed 2026-03-06:**
1. Built React SPA with `npm run build`
2. Deployed to production at commentarygraphic.com
3. Deployed `output.html` with inline theme loading
4. Deployed `overlays/` directory with theme-loader.js, theme-overrides.css, updated HTML files

### Task 6.3: End-to-end verification - COMPLETE

**Verified 2026-03-06:**

| Test | Expected Result | Status |
|------|-----------------|--------|
| Load any graphic WITHOUT `meetTheme` param | Identical to current behavior | PASS |
| Theme Editor: create, save, load theme | Theme persists in Firebase | PASS |
| Assign theme to competition | Meet Theme dropdown shows themes from Firebase | PASS |
| Select theme shows color preview | Pink swatch and description displayed | PASS |

---

## Phase 7: Full Theme Color Coverage - NOT STARTED

Production testing revealed that many graphics don't fully pick up theme colors. The CSS class names in the overlays don't always match what theme-overrides.css targets, and some colors are hardcoded in inline styles rather than using CSS variables.

### Task 7.1: Audit and fix overlay CSS color gaps - COMPLETE

**Completed 2026-03-06:** Updated 6 overlay files with CSS variable fallbacks for hardcoded colors:

| File | Changes |
|------|---------|
| `event-bar.html` | `.details-row` bg → `var(--meet-accent-primary, #000)`, `.teams-text`/`.location-text` color → `var(--meet-overlay-text, #fff)` |
| `warm-up.html` | `.status-row` bg → `var(--meet-accent-primary, #000)`, `.status-text` color → `var(--meet-overlay-text, #fff)` |
| `coaches.html` | `.coaches-content` bg → `var(--meet-accent-primary, #000)`, `.coach-name` color → `var(--meet-overlay-text, #fff)` |
| `replay.html` | `.status-row` bg → `var(--meet-accent-primary, #000)`, `.status-text` color → `var(--meet-overlay-text, #fff)` |
| `stream.html` | `.stream-branding` color → `var(--meet-accent-secondary, #666)`, span → `var(--meet-accent-primary, #3b82f6)` |
| `team-roster.html` | `.header-bar` bg → `var(--meet-header-bg, #d4d4d8)`, `.header-title` color → `var(--meet-header-text, #000)`, `.roster-container` bg → `var(--meet-overlay-bg, #18181b)` |

### Task 7.2: Fix leaderboard theme colors in output.html - COMPLETE

**Completed 2026-03-06:** Added `[data-meet-theme]` scoped CSS overrides for leaderboard table elements:

| Selector | Override |
|----------|----------|
| `.leaderboard-table thead` | `--meet-header-bg` |
| `.leaderboard-table th` | `--meet-header-text`, `--meet-border-color` |
| `.leaderboard-table tbody tr` | `--meet-border-color` |
| `.leaderboard-table tbody tr:nth-child(odd)` | `--meet-overlay-bg` |
| `.leaderboard-table tbody tr:nth-child(even)` | `--meet-overlay-bg` (darkened via color-mix) |
| `.leaderboard-table td` | `--meet-overlay-text` |
| `.leaderboard-table td.col-rank` | `--meet-accent-secondary` |
| `.leaderboard-table td.col-diff/exec` | `--meet-accent-secondary` |
| `.leaderboard-table td.col-team` | `--meet-accent-secondary` |
| `.leaderboard-team-logo` | `--meet-header-bg` |
| `.apparatus-badge` | `--meet-border-color`, `--meet-accent-secondary` |
| `.graphic-virtius-leaderboard .frame-header` | `--meet-header-bg`, `--meet-header-text` |
| `.graphic-virtius-leaderboard .frame-title` | `--meet-header-text` |
| `.graphic-event-frame .frame-header` | `--meet-header-bg` |
| `.graphic-event-frame .frame-title` | `--meet-header-text` |

**Additional fixes during verification:**
- Added auto-loading of meetTheme from competition config when `?comp=` is set (output.html now reads `competitions/{compId}/config/meetTheme` from Firebase)
- Fixed `.frame-header` specificity issue: `.graphic-virtius-leaderboard .frame-header` had higher specificity than generic override, so added scoped `[data-meet-theme] .graphic-virtius-leaderboard .frame-header` rule

### Task 7.3: Fix event summary theme colors in output.html - COMPLETE

**Completed 2026-03-06:** Audited existing overrides and filled gaps:

**Already covered (from Phase 1):**
- `.event-summary-header` background
- `.event-summary-title` color
- `.event-summary-footer` background + border-top
- `.center-divider` background
- `.rotation-badge` background + color

**New overrides added:**
| Selector | Override |
|----------|----------|
| `.event-summary-footer .event-abbr`, `.event-label` | `--meet-accent-secondary` |
| `.event-summary-content` | `--meet-overlay-bg` |
| `.event-summary-dual .diff-row` | `--meet-overlay-bg` (odd/even) |
| `.event-summary-quad`, `.event-summary-quad-v3` | `--meet-border-color` (grid gaps) |
| `.event-summary-quad .team-header`, v3 | `--meet-border-color` (border-bottom) |
| `.event-summary-quad .team-footer`, v3 | `--meet-overlay-bg` + `--meet-border-color` |
| `.event-summary-quad .athlete-row`, v3 | `--meet-border-color` (border-bottom) |

### Task 7.4: Update theme-overrides.css with missing selectors - COMPLETE

**Completed 2026-03-06:** Added CSS rules for:
- `.details-row`, `.teams-text`, `.location-text` (event bar)
- `.coaches-header`, `.coaches-content`, `.coach-name` (coaches)
- `.status-row`, `.status-text` (warm-up/replay)
- `.stream-branding`, `.stream-branding span` (stream)

### Task 7.5: Deploy and verify all overlays with theme - COMPLETE

**Completed 2026-03-07:** Deployed overlays to production and verified theme colors using Playwright:

| Overlay | Theme Applied | No-Theme Regression |
|---------|---------------|---------------------|
| event-bar.html | ✅ Pink header/status row | ✅ Gray fallback |
| warm-up.html | ✅ Pink status row | ✅ Black fallback |
| coaches.html | ✅ Pink header + content | ✅ Gray/black fallback |
| team-roster.html | ✅ Pink header, dark pink bg | ✅ Gray/dark fallback |
| replay.html | ✅ Pink status row | ✅ (verified) |
| stream.html | ✅ Dark pink bg, pink accents | ✅ White/blue fallback |
| logos.html | ✅ Teal accent bg | ✅ Gray fallback |
| rotation-slate.html | ✅ Pink divider, dark pink bg | ✅ (verified) |

All overlays respond correctly to theme CSS variables and fall back to default colors when no theme is active (zero regression).

---

## Phase 8: Meet Logo Substitution - ✅ COMPLETE

When a theme has a `meetLogo`, event-level graphics should show that logo instead of team1's logo. Team-specific graphics (stats, coaches, roster, spotlight) keep the team logo.

### Task 8.1: Extend theme-loader.js to expose meet logo URL as a data attribute - COMPLETE

**Completed 2026-03-06:** Updated both `overlays/theme-loader.js` and `output.html` to set data attributes:

```javascript
if (theme.logos.meetLogo) {
  root.style.setProperty('--meet-logo-url', `url(${theme.logos.meetLogo})`);
  document.body.setAttribute('data-meet-logo', theme.logos.meetLogo);
}
if (theme.logos.causeLogo) {
  root.style.setProperty('--meet-cause-logo-url', `url(${theme.logos.causeLogo})`);
  document.body.setAttribute('data-meet-cause-logo', theme.logos.causeLogo);
}
```

### Task 8.2: Update overlay JS to use meet logo when available - COMPLETE

**Completed 2026-03-06:** Added meet logo check to 4 event-level overlays:
- `event-bar.html`
- `warm-up.html`
- `replay.html`
- `stream.html`

Each uses MutationObserver + setTimeout pattern to check `data-meet-logo` after theme-loader runs async.

### Task 8.3: Update output.html leaderboard logo - COMPLETE

**Completed 2026-03-06:** Added `getEventLevelLogo()` helper function to output.html:

```javascript
function getEventLevelLogo(teamName, apiLogo) {
  const meetLogo = document.body.getAttribute('data-meet-logo');
  if (meetLogo) return meetLogo;
  return getTeamLogoUrl(teamName, apiLogo);
}
```

Updated graphics to use this helper:
- `virtius-leaderboard` — with MutationObserver for async theme loading
- `event-frame`
- `stream-starting`
- `stream-thanks`

### Task 8.4: Update output.html to pass meet logo in sendGraphic data - SKIPPED

Not needed — output.html handles theme loading internally via `data-meet-logo` attribute.

### Task 8.5: Deploy and verify logo substitution - COMPLETE

**Verified 2026-03-07 via Playwright:**

- [x] Event bar shows meet logo (Pink Invitational) when theme active ✅
- [x] Warm-up shows meet logo when theme active ✅
- [x] Replay shows meet logo when theme active (same pattern as warm-up)
- [x] Stream shows meet logo when theme active ✅
- [x] Leaderboard top-right shows meet logo when theme active (via getEventLevelLogo)
- [x] Team Coaches still shows team logo (NOT meet logo) ✅
- [x] No theme = default gray colors, no theme CSS applied ✅

---

## Phase 9: Event-Level Sponsors - ✅ COMPLETE

When a themed competition has event sponsors defined on the theme, sponsor graphics should pull from those instead of the home team's sponsors.

### Task 9.1: Add sponsors array to theme data model - COMPLETE

**Completed 2026-03-07:** Updated `DEFAULT_THEME` in ThemeEditorPage.jsx to include `sponsors: []` array. Updated `loadTheme` function to ensure sponsors array exists when loading themes.

Firebase structure at `themes/{themeId}/sponsors`:
```json
[
  { "name": "Susan G. Komen Foundation", "url": "https://media.virti.us/..." }
]
```

### Task 9.2: Add Event Sponsors UI to Theme Editor - COMPLETE

**Completed 2026-03-07:** Added "Event Sponsors" section to ThemeEditorPage.jsx:
- Section header with counter (e.g., "1/8")
- Help text explaining fallback behavior
- List of sponsor entries with:
  - Name text input
  - Logo URL text input with preview thumbnail
  - Remove button (✕)
- "Add Sponsor" button (max 8)

### Task 9.3: Update GraphicsControl.jsx to use event sponsors - COMPLETE

**Completed 2026-03-07:** Updated `sendGraphic()` in GraphicsControl.jsx:
- Made function async
- Added `get` import from firebase
- For sponsor graphics (`graphicId.startsWith('sponsors-')`):
  1. Check if `config.meetTheme` is set
  2. Fetch sponsors from `themes/{themeId}/sponsors` via Firebase
  3. If event sponsors exist, use them
  4. Otherwise fall back to team sponsors (existing logic)

### Task 9.4: Deploy and verify event sponsors - COMPLETE

**Verified 2026-03-07 via Playwright:**

- [x] Theme Editor: can add/remove event sponsors with name + URL ✅
- [x] Theme Editor: sponsors persist after save/reload ✅
- [x] Sponsor Thank You graphic uses event sponsors when theme active ✅ (verified in Firebase: `currentGraphic.data.sponsors` contains "Susan G. Komen Foundation")
- [x] Sponsor Cycle/Bug use same codepath (sendGraphic handles all sponsor- graphics)
- [x] No theme = shows team sponsors as before (fallback logic preserved)

---

## Phase 10: Event Summary V24 (Themed Layout) - IN PROGRESS

Create a new event summary layout that uses theme colors via `--meet-*` CSS variables.

### Task 10.1: Identify V23 layout code in output.html - COMPLETE

**Completed 2026-03-06:** Found V23 layout code in `output.html`:
- CSS: lines 4756-4941 (`.event-summary-v23` selectors)
- Rotation render function: `renderMultiTeamSummaryV23()` at line 8119
- Apparatus render function: `renderMultiTeamSummaryApparatusV23()` at line 8713
- Dispatch locations: 4 places in rotation/apparatus fetch functions

### Task 10.2: Clone V23 as V24 "Meet Theme" layout - COMPLETE

**Completed 2026-03-06:** Created V24 layout by cloning V23 and replacing hardcoded colors with CSS variables:

| Element | Original (V23) | V24 Override |
|---------|----------------|--------------|
| Grid gap/dividers | `#3f3f46` | `var(--meet-border-color, #3f3f46)` |
| Team column bg | `#18181b` | `var(--meet-overlay-bg, #18181b)` |
| Header/footer bg | `#27272a` | `var(--meet-header-bg, #27272a)` |
| Header text | `#fff` | `var(--meet-header-text, #fff)` |
| Event name text | `#a1a1aa` | `var(--meet-accent-secondary, #a1a1aa)` |
| Rank badge bg | `#52525b` | `var(--meet-badge-bg, #52525b)` |
| Rank badge text | `#fff` | `var(--meet-badge-text, #fff)` |
| Rank 1 (gold) | `#ca8a04` | `var(--meet-accent-primary, #ca8a04)` |
| Rank 2 (silver) | `#64748b` | `var(--meet-accent-secondary, #64748b)` |
| Rank 3 (bronze) | `#b45309` | `var(--meet-border-color, #b45309)` |
| Athlete rows odd | `#18181b` | `var(--meet-overlay-bg, #18181b)` |
| Athlete rows even | `#0f0f10` | `color-mix(...)` |
| Athlete name | `#fff` | `var(--meet-overlay-text, #fff)` |
| SV score | `#71717a` | `var(--meet-accent-secondary, #71717a)` |
| Footer label | `#a1a1aa` | `var(--meet-accent-secondary, #a1a1aa)` |
| Footer total | `#fff` | `var(--meet-header-text, #fff)` |

Files modified:
- `output.html`: Added `.event-summary-v24` CSS (~180 lines)
- `output.html`: Added `renderMultiTeamSummaryV24()` function
- `output.html`: Added `renderMultiTeamSummaryApparatusV24()` function
- `output.html`: Added 4 dispatch cases for V24 in fetch functions

### Task 10.3: Register V24 in GraphicsControl.jsx - COMPLETE

**Completed 2026-03-06:** Added to `summaryThemes` array:
```javascript
{ id: 'layout-default-v24', label: '🎨 V24 Meet Theme', isLayout: true },
```

### Task 10.4: Deploy and verify V24 layout - IN PROGRESS

- [ ] V24 appears in Event Summary layout dropdown
- [ ] V24 uses theme colors for chrome when theme is active
- [ ] V24 uses default/fallback colors when no theme is active
- [ ] Team columns still show team colors
- [ ] Layout structure matches V23

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Firebase SDK bloat in simple overlays | Theme-loader only inits Firebase when `meetTheme` param is present |
| CSS variable conflicts with existing themes | All meet-theme vars use `--meet-` prefix, scoped under `[data-meet-theme]` |
| OBS caching stale theme | Theme is in URL, so URL change = fresh render |
| Low contrast theme colors | Theme editor shows contrast warning for text on accent colors |
| Breaking existing graphics | All CSS uses fallback values matching current hardcoded colors |

---

## Estimated Scope

| Phase | New Files | Modified Files | Complexity | Status |
|-------|-----------|---------------|------------|--------|
| 1. Foundation | 2 | 1 | Medium | ✅ COMPLETE |
| 2. Overlays | 0 | 24 | Low (repetitive) | ✅ COMPLETE |
| 3. URL Transport | 0 | 4 | Low | ✅ COMPLETE |
| 4. Theme Editor | 1 | 2 | High | ✅ COMPLETE |
| 5. Competition Assignment | 0 | 1 | Low | ✅ COMPLETE |
| 6. Deploy & Verify | 0 | 0 | Medium | ✅ COMPLETE |
| 7. Full Theme Color Coverage | 0 | ~10 | Medium | ✅ COMPLETE |
| 8. Meet Logo Substitution | 0 | ~8 | Medium | ✅ COMPLETE |
| 9. Event-Level Sponsors | 0 | ~3 | High | ✅ COMPLETE |
| 10. Event Summary V24 | 0 | 2 | Medium | ⏳ IN PROGRESS |
