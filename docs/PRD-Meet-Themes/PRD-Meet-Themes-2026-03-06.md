# PRD: Custom Meet Theme System

**Version:** 1.0
**Date:** 2026-03-06
**Status:** In Progress (Phase 4 Complete - Theme Editor UI deployed)
**Last Updated:** 2026-03-06
**Depends On:** PRD-Graphics-Registry (foundation)
**Blocks:** Pink Meet production (March 2026)

### Current Blocker
Firebase security rules need to be updated to allow public read access to `themes/` path.
See implementation-plan.md for fix instructions.

---

## 1. Problem Statement

Special competitions need custom branding across all broadcast graphics. For example, a "Pink Meet" fundraiser for breast cancer awareness needs pink accents, the breast cancer ribbon logo, and the meet's custom logo displayed throughout the broadcast.

Currently there is **no way to theme graphics per-competition without code changes**:

1. **No theme configuration** -- Colors are hardcoded in `output.html` (TEAM_COLORS database) and each overlay HTML file
2. **No meet-level branding** -- Competition config stores team logos but has no field for meet logos, cause logos, or accent colors
3. **No theme editor** -- Creating a new look (e.g., ESPN theme, NBC theme) requires editing CSS in `output.html` directly
4. **24 overlay files with hardcoded colors** -- Each overlay in `overlays/` has inline CSS with fixed color values

This means every special event requires developer intervention to create themed graphics.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Reusable Theme System** | Create, save, and reuse themes for any special event without code changes |
| **Accent Blending** | Theme colors apply to chrome elements (headers, borders, badges) while team colors remain in team-specific areas |
| **Custom Logos** | Support meet logo and cause logo placement across all graphic types |
| **Theme Editor UI** | Visual editor with color pickers, logo inputs, and live preview |
| **Competition Assignment** | One dropdown to assign a theme to any competition |
| **Zero Regression** | No theme = identical behavior to today (CSS variable fallbacks) |

---

## 3. User Stories

### Validation Summary

| Story | Description | Status | Blocker |
|-------|-------------|--------|---------|
| 1 | Producer Creates a Meet Theme | Not Started | -- |
| 2 | Producer Assigns Theme to Competition | Not Started | -- |
| 3 | Theme Renders Across All Graphics | Not Started | -- |
| 4 | Producer Uses Built-in Presets | Not Started | -- |
| 5 | No-Theme Competitions Work Unchanged | Not Started | -- |

---

### Story 1: Producer Creates a Meet Theme

**As a** Producer preparing for the Pink Meet
**I want to** create a custom theme with pink accent colors, the breast cancer ribbon logo, and the Pink Meet logo
**So that** all broadcast graphics reflect the event's branding

**Flow:**
1. Navigate to Theme Editor (new page in show controller)
2. Click "New Theme" or select a preset ("Pink Meet")
3. Set accent colors using color pickers (accentPrimary, headerBg, borderColor, etc.)
4. Paste meet logo URL and cause logo URL (with preview thumbnails)
5. Enter meet title ("PINK MEET 2026") and subtitle ("Supporting Breast Cancer Research")
6. See live preview of a sample graphic with theme applied
7. Click "Save Theme" -- stored in Firebase at `themes/{themeId}`

**Acceptance Criteria:**
- [ ] Theme Editor page accessible from Hub
- [ ] Color pickers for all 10 theme color properties
- [ ] Logo URL inputs with preview thumbnails
- [ ] Meet title and subtitle text fields
- [ ] Live preview iframe showing themed sample graphic
- [ ] Save/load to Firebase `themes/{themeId}`
- [ ] Theme appears in theme list after saving

---

### Story 2: Producer Assigns Theme to Competition

**As a** Producer setting up the Pink Meet competition
**I want to** select the "Pink Meet 2026" theme from a dropdown
**So that** all graphics for this competition automatically use the theme

**Flow:**
1. Open competition config (existing UI)
2. See new "Meet Theme" dropdown (populated from Firebase `themes/`)
3. Select "Pink Meet 2026" (or "None" for no theme)
4. Theme ID saved to `competitions/{compId}/config.meetTheme`
5. All graphics generated for this competition now include `&meetTheme=pink-meet-2026` in their URLs

**Acceptance Criteria:**
- [ ] "Meet Theme" dropdown in competition config UI
- [ ] Dropdown populated from Firebase `themes/` path
- [ ] "None" option as default (no theme)
- [ ] `meetTheme` field saved to competition config
- [ ] All URL builders include `meetTheme` param when set

---

### Story 3: Theme Renders Across All Graphics

**As a** Viewer watching the Pink Meet broadcast
**I want to** see pink accents on headers, borders, and badges across all graphics
**So that** the broadcast feels cohesive with the event's branding

**Flow:**
1. Event summary displays: pink header bar, pink borders, pink rotation badge -- but team columns still show team colors (Michigan blue/gold, etc.)
2. Overlay graphics (event frame, logos, team roster, etc.): pink accent areas, meet logo visible
3. Stream start/end: pink themed with meet logo and cause logo
4. Leaderboards: pink header/footer chrome

**Acceptance Criteria:**
- [ ] Event summary header/footer/badges use theme colors
- [ ] Team columns retain their team colors (blend, not replace)
- [ ] All 24 overlay files respond to theme CSS variables
- [ ] Meet logo appears in designated placement zones
- [ ] Cause logo appears in designated placement zones
- [ ] Transparent backgrounds still work for OBS compositing

---

### Story 4: Producer Uses Built-in Presets

**As a** Producer who needs to quickly theme a special event
**I want to** start from a preset template instead of building from scratch
**So that** I can get themed graphics running in minutes

**Presets:**
| Preset | Primary | Secondary | Use Case |
|--------|---------|-----------|----------|
| Pink Meet | #E91E8C | #FFB6D9 | Breast cancer fundraiser |
| Military Appreciation | #4A5C3E | #C5A55A | Military appreciation night |
| Senior Night | #FFD700 | #1a1a1a | Senior recognition |
| Blackout | #000000 | #00FF88 | Blackout theme events |

**Acceptance Criteria:**
- [ ] 4+ preset templates available in Theme Editor
- [ ] Clicking a preset populates all fields
- [ ] Preset can be customized before saving
- [ ] Presets are not stored in Firebase (hardcoded in UI)

---

### Story 5: No-Theme Competitions Work Unchanged

**As a** Producer running a regular dual meet
**I want** graphics to look exactly the same as before this feature was added
**So that** the theme system doesn't break existing competitions

**Acceptance Criteria:**
- [ ] No `meetTheme` URL param = identical rendering to current behavior
- [ ] All CSS variable overrides use fallback values matching current hardcoded colors
- [ ] Theme-loader.js is a no-op when no theme ID is present
- [ ] No additional Firebase reads when no theme is set

---

## 4. Architecture

### Data Flow

```
Firebase: themes/{themeId}           Theme definitions (colors, logos, branding)
Firebase: competitions/{compId}/config.meetTheme = "{themeId}"

Competition Config loads meetTheme
         |
         v
URL Builder appends &meetTheme=pink-meet-2026
         |
         v
theme-loader.js reads URL param, fetches theme from Firebase
         |
         v
CSS Variables set on document.documentElement
(--meet-accent-primary, --meet-header-bg, --meet-border-color, etc.)
         |
         v
CSS rules using [data-meet-theme] selector override chrome elements
Team-specific areas use existing team color CSS vars (unchanged)
```

### Firebase Data Structure

**Path: `themes/{themeId}`**

```json
{
  "id": "pink-meet-2026",
  "name": "Pink Meet 2026",
  "description": "Breast cancer awareness fundraiser",
  "colors": {
    "accentPrimary": "#E91E8C",
    "accentSecondary": "#FFB6D9",
    "headerBg": "#E91E8C",
    "headerText": "#FFFFFF",
    "footerBg": "#E91E8C",
    "borderColor": "#E91E8C",
    "badgeBg": "#E91E8C",
    "badgeText": "#FFFFFF",
    "overlayBg": "#1a0a12",
    "overlayText": "#FFFFFF"
  },
  "logos": {
    "meetLogo": "https://...",
    "causeLogo": "https://..."
  },
  "branding": {
    "meetTitle": "PINK MEET 2026",
    "subtitle": "Supporting Breast Cancer Research"
  },
  "createdAt": "2026-03-06T00:00:00Z",
  "updatedAt": "2026-03-06T00:00:00Z"
}
```

**Competition config addition:**
```json
{ "meetTheme": "pink-meet-2026" }
```

### CSS Variable Strategy

Theme colors are applied via CSS custom properties with fallbacks:

```css
/* Only active when [data-meet-theme] is set */
[data-meet-theme] .event-summary-header {
  background: var(--meet-header-bg, #27272a);       /* falls back to current dark */
  border-bottom: 3px solid var(--meet-border-color, transparent);
}
[data-meet-theme] .rotation-badge {
  background: var(--meet-badge-bg);
  color: var(--meet-badge-text);
}
```

Team columns are NOT affected -- they continue using `--home-primary`, `--away-primary` etc.

---

## 5. Design Considerations

### Blending Strategy
- **Theme overrides**: Headers, footers, borders, badges, dividers, background accents
- **Team colors preserved**: Team name backgrounds, team column backgrounds, team-specific elements
- **Result**: Pink chrome around a Michigan blue/gold vs Ohio State scarlet/white matchup

### Logo Placement Zones
Different graphic types have different available zones:
| Zone | Used In |
|------|---------|
| Header right | Event summaries, leaderboards |
| Footer left | Event summaries |
| Corner overlay | Frame graphics, overlays |
| Title bar | Event frame, stream start/end |

### OBS Browser Source Refresh
- Theme is encoded in the URL (`&meetTheme=...`), so changing the theme changes the URL
- OBS browser sources refresh when the URL changes (standard behavior)
- No special cache-busting needed

### Contrast Safety
- Theme editor should warn when accent colors have low contrast with white text
- Pink (#E91E8C) on white is WCAG AA compliant for large text

### Firebase SDK in Overlays
- Some simple overlays don't currently import Firebase
- `theme-loader.js` conditionally initializes Firebase only when `meetTheme` param is present
- Adds ~50KB to page weight only when theming is active

---

## 6. Files Changed Summary

| File | Type | Description |
|------|------|-------------|
| `overlays/theme-loader.js` | NEW | Shared Firebase theme fetcher + CSS var setter |
| `overlays/theme-overrides.css` | NEW | CSS rules for themed chrome elements |
| `show-controller/src/pages/ThemeEditorPage.jsx` | NEW | Theme editor with color pickers + preview |
| `output.html` | MODIFY | Inline theme loading, CSS var fallbacks for event summary/leaderboard chrome |
| `show-controller/src/lib/urlBuilder.js` | MODIFY | Thread `meetTheme` param through all builders |
| `show-controller/src/components/QuickActions.jsx` | MODIFY | Pass `meetTheme` from competition config |
| `show-controller/src/components/GraphicsControl.jsx` | MODIFY | Pass `meetTheme` when building URLs |
| `show-controller/src/pages/UrlGeneratorPage.jsx` | MODIFY | Show active theme, pass meetTheme |
| `overlays/*.html` (all 24) | MODIFY | Add theme-loader script + CSS var fallbacks |
| Router + HubPage | MODIFY | Add theme editor route/link |

---

## 7. Out of Scope (v1.0)

- **Mid-show theme toggle** -- Turning theme on/off during a broadcast (e.g., only for one rotation)
- **Per-graphic theme overrides** -- Different theme settings per graphic type
- **Font overrides** -- Custom fonts per theme (would require font hosting)
- **Animation overrides** -- Custom transitions per theme
- **Theme marketplace** -- Sharing themes between installations
