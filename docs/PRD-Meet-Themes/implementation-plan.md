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

## Phase 2: Overlay Integration (24 files)

### Task 2.1: Add theme-loader to each overlay

For each file in `overlays/*.html`:
1. Add `<script src="theme-loader.js"></script>` before `</body>`
2. For overlays without Firebase SDK imports, theme-loader handles the conditional init

### Task 2.2: Replace hardcoded accent colors with CSS variable fallbacks

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

---

## Phase 3: URL Transport

### Task 3.1: Thread `meetTheme` through `urlBuilder.js`

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

### Task 3.2: Pass `meetTheme` from competition config in controllers

**`QuickActions.jsx`:**
- Read `competitionConfig.meetTheme`
- Include in URL builder options when generating graphic URLs

**`GraphicsControl.jsx`:**
- Same: include `meetTheme` from competition config in all URL builder calls

**`UrlGeneratorPage.jsx`:**
- Show active theme indicator (e.g., "Theme: Pink Meet 2026" badge)
- Include `meetTheme` in generated URLs

---

## Phase 4: Theme Editor UI

### Task 4.1: Create `show-controller/src/pages/ThemeEditorPage.jsx`

**Layout (3-column):**
- **Left panel**: Theme list from Firebase `themes/`, with "New Theme" button
- **Center panel**: Form fields
  - Theme name, description
  - 10 color pickers (accentPrimary, accentSecondary, headerBg, headerText, footerBg, borderColor, badgeBg, badgeText, overlayBg, overlayText)
  - Meet logo URL input + preview thumbnail
  - Cause logo URL input + preview thumbnail
  - Meet title text field
  - Subtitle text field
- **Right panel**: Live preview iframe
  - Loads `output.html?graphic=event-summary&meetTheme={tempId}` (or similar)
  - Updates in real-time as user changes colors

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

### Task 4.2: Add route and navigation

- Add route in `App.jsx` (or router config): `/themes` -> `ThemeEditorPage`
- Add "Theme Editor" link/card on `HubPage.jsx`

---

## Phase 5: Competition Assignment

### Task 5.1: Add "Meet Theme" dropdown to competition config UI

- Locate the competition config form (likely in a setup/config page)
- Add a dropdown populated from Firebase `themes/` path
- Options: "None" (default) + all saved themes
- On change: write `meetTheme` field to `competitions/{compId}/config`

---

## Phase 6: Deploy & Verify

### Task 6.1: Create Pink Meet preset theme in Firebase

Use `firebase_set` to write a complete Pink Meet theme to `themes/pink-meet-2026`.

### Task 6.2: Build and deploy

1. `cd show-controller && npm run build`
2. Deploy React SPA to production
3. Deploy `output.html` (with inline theme loading)
4. Deploy `overlays/` directory (with theme-loader.js, theme-overrides.css, updated HTML files)

### Task 6.3: End-to-end verification

| Test | Expected Result |
|------|-----------------|
| Load any graphic WITHOUT `meetTheme` param | Identical to current behavior |
| Load event summary WITH `meetTheme=pink-meet-2026` | Pink headers/borders/badges, team colors preserved |
| Load overlay (event-frame) WITH theme | Pink accents in header bar |
| Theme Editor: create, save, load theme | Theme persists in Firebase |
| Assign theme to competition, generate URLs | All URLs include `meetTheme` param |
| OBS browser source with themed URL | Renders correctly with transparent bg |

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

| Phase | New Files | Modified Files | Complexity |
|-------|-----------|---------------|------------|
| 1. Foundation | 2 | 1 | Medium |
| 2. Overlays | 0 | 24 | Low (repetitive) |
| 3. URL Transport | 0 | 4 | Low |
| 4. Theme Editor | 1 | 2 | High |
| 5. Competition Assignment | 0 | 1 | Low |
| 6. Deploy & Verify | 0 | 0 | Medium |
| **Total** | **3 new** | **32 modified** | |
