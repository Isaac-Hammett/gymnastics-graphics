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

### Task 7.2: Fix leaderboard theme colors in output.html - NOT STARTED

The leaderboard table in `output.html` uses hardcoded colors for headers, rows, and cells. These need CSS variable fallbacks.

**Affected classes in output.html:**
- `.leaderboard-table` header row — hardcoded `#27272a` → `var(--meet-header-bg, #27272a)`
- `.leaderboard-table` row backgrounds — hardcoded `#18181b` → `var(--meet-overlay-bg, #18181b)`
- `.leaderboard-table` text colors — hardcoded `#fff`, `#a1a1aa` → `var(--meet-overlay-text, ...)`

### Task 7.3: Fix event summary theme colors in output.html - NOT STARTED

The event summary in `output.html` has chrome elements (header bar, footer bar, rotation badges, center divider) that need CSS variable fallbacks.

**Check:** Some of these may already have been partially done in Phase 1. Audit what's covered and fill gaps.

### Task 7.4: Update theme-overrides.css with missing selectors - COMPLETE

**Completed 2026-03-06:** Added CSS rules for:
- `.details-row`, `.teams-text`, `.location-text` (event bar)
- `.coaches-header`, `.coaches-content`, `.coach-name` (coaches)
- `.status-row`, `.status-text` (warm-up/replay)
- `.stream-branding`, `.stream-branding span` (stream)

### Task 7.5: Deploy and verify all overlays with theme - NOT STARTED

Load each overlay with `?meetTheme=pink-meet-2026` and verify colors are correct:
- [ ] event-bar.html
- [ ] warm-up.html
- [ ] coaches.html
- [ ] team-roster.html
- [ ] replay.html
- [ ] stream.html
- [ ] logos.html
- [ ] sponsors-thanks.html
- [ ] sponsors-cycle.html
- [ ] sponsors-bug.html
- [ ] rotation-slate.html
- [ ] event-frame.html
- [ ] athlete-spotlight.html
- [ ] frame-dual.html, frame-quad.html, frame-single.html, frame-tri-center.html, frame-tri-wide.html

---

## Phase 8: Meet Logo Substitution - NOT STARTED

When a theme has a `meetLogo`, event-level graphics should show that logo instead of team1's logo. Team-specific graphics (stats, coaches, roster, spotlight) keep the team logo.

### Task 8.1: Extend theme-loader.js to expose meet logo URL as a data attribute - NOT STARTED

Currently theme-loader.js sets `--meet-logo-url` as a CSS custom property using `url()` format. This can't be used to set `<img src>` attributes.

**Fix:** In addition to the CSS property, also set a plain-text data attribute:
```javascript
// In applyTheme() function:
if (theme.logos.meetLogo) {
  root.style.setProperty('--meet-logo-url', `url(${theme.logos.meetLogo})`);
  document.body.setAttribute('data-meet-logo', theme.logos.meetLogo);  // NEW: plain URL for JS access
}
if (theme.logos.causeLogo) {
  root.style.setProperty('--meet-cause-logo-url', `url(${theme.logos.causeLogo})`);
  document.body.setAttribute('data-meet-cause-logo', theme.logos.causeLogo);  // NEW
}
```

### Task 8.2: Update overlay JS to use meet logo when available - NOT STARTED

Each event-level overlay that shows a logo needs a check after theme-loader runs:

**Overlays to update (event-level — should show meet logo):**
- `event-bar.html` — logo element reads `params.get('team1Logo')`, should check `data-meet-logo` first
- `warm-up.html` — same pattern
- `replay.html` — same pattern
- `stream.html` — logo reads `params.get('logo')`, should check `data-meet-logo` first

**Pattern for each overlay:**
```javascript
// After existing logo setup code, add:
// Override with meet logo if theme is active
const checkMeetLogo = () => {
  const meetLogo = document.body.getAttribute('data-meet-logo');
  if (meetLogo) {
    document.getElementById('logo').src = meetLogo;
  }
};
// theme-loader runs async, so check after a short delay and on mutation
setTimeout(checkMeetLogo, 1000);
new MutationObserver(checkMeetLogo).observe(document.body, { attributes: true, attributeFilter: ['data-meet-logo'] });
```

### Task 8.3: Update output.html leaderboard logo - NOT STARTED

The leaderboard `frame-logo` uses `data.team1Logo`. When a theme is active, substitute the meet logo.

**In the leaderboard rendering function:**
```javascript
// Check if meet theme has a logo
const meetLogoUrl = document.body.getAttribute('data-meet-logo');
const logoSrc = meetLogoUrl || getTeamLogoUrl(data.team1Name, data.team1Logo);
```

### Task 8.4: Update output.html to pass meet logo in sendGraphic data - NOT STARTED

In `GraphicsControl.jsx`, when building the data object for `sendGraphic()`, include the meet logo URL from the theme if available. This allows output.html to use it when rendering graphics.

**In GraphicsControl.jsx `sendGraphic()` function:**
```javascript
// After building data object, check for theme meet logo
if (config?.meetTheme) {
  // The meetLogo will be fetched by output.html's theme loader
  // No action needed here — output.html handles it via data-meet-logo attribute
}
```

Actually, output.html already fetches the theme via the `?meetTheme=` URL param and sets `data-meet-logo` on the body. So graphics rendered via output.html can check `document.body.getAttribute('data-meet-logo')` directly. No changes needed in GraphicsControl.jsx for this.

### Task 8.5: Deploy and verify logo substitution - NOT STARTED

- [ ] Event bar shows meet logo (not team1 logo) when theme active
- [ ] Warm-up shows meet logo when theme active
- [ ] Replay shows meet logo when theme active
- [ ] Stream shows meet logo when theme active
- [ ] Leaderboard top-right shows meet logo when theme active
- [ ] Team Stats still shows team logo (NOT meet logo)
- [ ] Team Coaches still shows team logo
- [ ] No theme = all logos show team logo as before

---

## Phase 9: Event-Level Sponsors - NOT STARTED

When a themed competition has event sponsors defined on the theme, sponsor graphics should pull from those instead of the home team's sponsors.

### Task 9.1: Add sponsors array to theme data model - NOT STARTED

Update the theme Firebase structure to include an optional `sponsors` array:

```json
{
  "id": "pink-meet-2026",
  "sponsors": [
    { "name": "Susan G. Komen Foundation", "url": "https://media.virti.us/..." },
    { "name": "Local Hospital", "url": "https://media.virti.us/..." }
  ]
}
```

No schema migration needed — new field is optional and additive.

### Task 9.2: Add Event Sponsors UI to Theme Editor - NOT STARTED

Add a new "Event Sponsors" section to `ThemeEditorPage.jsx`:

**UI:**
- Section header: "Event Sponsors"
- List of sponsor entries, each with:
  - Name text input
  - Logo URL text input with preview thumbnail
  - Remove button (red X)
- "Add Sponsor" button (max 8)
- Drag to reorder (optional, can be v2)

**State:**
- `editingTheme.sponsors` array: `[{ name: '', url: '' }, ...]`
- Saved to `themes/{themeId}/sponsors` on save

### Task 9.3: Update GraphicsControl.jsx to use event sponsors - NOT STARTED

In `sendGraphic()`, when the graphic is a sponsor type (`graphicId.startsWith('sponsors-')`):

```javascript
if (graphicId.startsWith('sponsors-')) {
  // Check if competition has a theme with event sponsors
  if (config?.meetTheme) {
    // Fetch theme sponsors from Firebase
    const themeRef = ref(db, `themes/${config.meetTheme}/sponsors`);
    const snapshot = await get(themeRef);
    const eventSponsors = snapshot.val();
    if (eventSponsors && eventSponsors.length > 0) {
      data.sponsors = JSON.stringify(eventSponsors.slice(0, 8));
      // Skip team sponsor lookup
    }
  }

  // Fallback to team sponsors (existing code)
  if (!data.sponsors) {
    const schoolKey = resolveSchoolKey(config.team1Name);
    // ... existing team sponsor logic
  }
}
```

**Note:** `sendGraphic` is currently synchronous. This will need to become async, or we can pre-fetch theme sponsors when config loads.

### Task 9.4: Deploy and verify event sponsors - NOT STARTED

- [ ] Theme Editor: can add/remove event sponsors with name + URL
- [ ] Theme Editor: sponsors persist after save/reload
- [ ] Sponsor Thank You graphic shows event sponsors when theme active
- [ ] Sponsor Cycle graphic shows event sponsors when theme active
- [ ] Sponsor Bug graphic shows event sponsors when theme active
- [ ] No theme = shows team sponsors as before

---

## Phase 10: Event Summary V24 (Themed Layout) - NOT STARTED

Create a new event summary layout that uses theme colors via `--meet-*` CSS variables.

### Task 10.1: Identify V23 layout code in output.html - NOT STARTED

Find the V23 ("No Rankings") layout code in `output.html`. It's referenced in the `summaryThemes` array in GraphicsControl.jsx as `layout-default-v23`.

### Task 10.2: Clone V23 as V24 "Meet Theme" layout - NOT STARTED

Duplicate the V23 rendering function and CSS, creating `layout-default-v24`:
- Replace hardcoded header/footer/badge colors with `--meet-*` CSS variables
- Keep team column colors using team variables (`--home-primary`, etc.)
- Use `--meet-header-bg` for header bars
- Use `--meet-badge-bg` / `--meet-badge-text` for rotation badges
- Use `--meet-border-color` for dividers
- Use `--meet-accent-secondary` for subtle accent areas

### Task 10.3: Register V24 in GraphicsControl.jsx - NOT STARTED

Add to the `summaryThemes` array:
```javascript
{ id: 'layout-default-v24', label: '🎨 V24 Meet Theme', isLayout: true },
```

### Task 10.4: Deploy and verify V24 layout - NOT STARTED

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
| 7. Full Theme Color Coverage | 0 | ~10 | Medium | 🔲 NOT STARTED |
| 8. Meet Logo Substitution | 0 | ~8 | Medium | 🔲 NOT STARTED |
| 9. Event-Level Sponsors | 0 | ~3 | High | 🔲 NOT STARTED |
| 10. Event Summary V24 | 0 | 2 | Medium | 🔲 NOT STARTED |
