# PRD: Who to Watch — Highlight Reel Segment

**Status:** NEEDS FIX — editor control gaps + remaining integration bugs (see Known Issues, 28 items; 3 fixed 2026-03-25)
**Date:** 2026-03-24
**Last Updated:** 2026-03-25 (v5: 2 human rejection issues added from triage)

---

## Overview

A new rundown segment type ("Who to Watch") that lets producers create highlight reel cards for featured athletes. The producer selects a team and athlete from searchable dropdowns (auto-populated from the competition and teams database), configures up to 3 full-screen title cards, provides a video clip URL, and sees a live preview of the lower-third graphic — all within the rundown editor.

## Problem

Championship broadcasts need marquee between-rotation content that spotlights individual athletes. Previously, producers had to manually coordinate separate graphics and video clips with no unified workflow. There was no way to plan a "Who to Watch" segment in the rundown, preview what it would look like, or hand it off to the playout engine as a single unit.

## Solution

A dedicated segment type in the rundown editor that combines:
1. Searchable team and athlete dropdowns populated from the competition config and teams database
2. Auto-filled headshot and team logo URLs from the database
3. **Athlete media gallery** — upload and manage multiple images per athlete (portrait, action, full-body) beyond just headshots, accessible from both the Media Manager and the segment editor
4. **Image picker** — select from headshot, gallery images, or custom URL; choose display mode (portrait cutout, headshot circle, or full rectangular)
5. Up to 3 full-screen title cards (headline + body text) shown before the video clip, rendered in **broadcast-quality ESPN style** with team-colored backgrounds, accent bars, stat callouts, and athlete portrait cutouts
6. A video clip URL for the highlight reel
7. A broadcast-ready lower-third overlay graphic
8. A live preview showing the graphic composited on the video thumbnail
9. A playback order summary showing the sequence: title cards → video clip → lower third

---

## User Stories

- As a **producer**, I want to select a team from a dropdown and then pick an athlete from that team's roster so that I don't have to type names or look up URLs manually.
- As a **producer**, I want headshot and logo URLs to auto-fill when I select a team and athlete so that I can set up a segment in seconds.
- As a **producer**, I want to add up to 3 full-screen title cards (like "SENIOR / JORDAN CHILES" or "17 CAREER 10.000s") that play before the video clip so that the segment feels like a produced TV package.
- As a **producer**, I want to paste a video URL and see a thumbnail preview with the lower-third graphic overlaid so that I know exactly what the output will look like before going live.
- As a **commentator**, I want to see the "Who to Watch" card in the rundown so that I know which athlete is being featured and can prepare talking points.

---

## Architecture

### Segment Type: `who-to-watch`

Lives alongside existing segment types (`live`, `video`, `playout`, `content-sequence`, etc.) in the rundown editor. When a segment's type is set to "Who to Watch", a dedicated editor panel appears with all configuration fields.

### Data Model

Stored on the segment object as `whoToWatch`:

```json
{
  "id": "seg-xyz",
  "name": "Who to Watch — Jordan Chiles",
  "type": "who-to-watch",
  "duration": 45,
  "whoToWatch": {
    "teamSlot": 2,
    "athleteName": "Jordan Chiles",
    "teamName": "UCLA",
    "logoUrl": "https://media.virti.us/upload/images/team/...",
    "subtitle": "Sr • Spring, TX • All-Around",
    "statLabel": "Career 10s",
    "statValue": "17",
    "clipUrl": "https://7f611de901ab5b1fb66ea466991895a9.r2.cloudflarestorage.com/...",
    "headshot": "https://media.virti.us/upload/images/athlete/...",
    "imageUrl": "https://image2url.com/...",
    "imageMode": "portrait",
    "titleCards": [
      { "headline": "SENIOR", "body": "" },
      { "headline": "", "body": "17 Career 10.000s\nVault - 1 | Bars - 6 | Beam - 0 | Floor - 10" },
      { "headline": "", "body": "Big Ten Gymnast of the Week\n9 Consecutive Weeks\n(New Big Ten Record)" }
    ]
  }
}
```

**New fields (v2):**

| Field | Type | Description |
|-------|------|-------------|
| `imageUrl` | string | Selected image for title cards (portrait/action shot, distinct from `headshot` which is used for the lower-third) |
| `imageMode` | string | How to render the image: `portrait` (tall cutout, default), `headshot` (circle), `full` (rectangular) |

### Files

| File | Purpose |
|------|---------|
| `show-controller/src/components/playout/WhoToWatchEditor.jsx` | Editor panel (team/athlete dropdowns, image picker, title cards, clip URL, graphic preview) |
| `overlays/who-to-watch.html` | Lower-third broadcast overlay (1920x1080, transparent, theme-aware) |
| `overlays/who-to-watch-title.html` | Full-screen title card overlay (1920x1080, ESPN-style broadcast quality, team-colored background) |
| `show-controller/src/lib/graphicsRegistry.js` | Graphic registration (`who-to-watch` entry) |
| `show-controller/src/pages/RundownEditorPage.jsx` | Segment type wiring (type list, colors, Firebase save, validation, data plumbing) |
| `show-controller/src/hooks/useTeamsDatabase.js` | Athlete media gallery operations (`getAthleteMedia`, `saveAthleteMedia`, `deleteAthleteMedia`) |
| `show-controller/src/pages/MediaManagerPage.jsx` | Media Manager UI — expandable athlete rows with image gallery and add form |

### Data Plumbing

The editor receives competition and database data through props:

```
CompetitionContext → RundownEditorPage → SegmentDetailPanel → WhoToWatchEditor
                                          ↑
useTeamsDatabase() ─────────────────────────┘
```

| Prop | Source | Purpose |
|------|--------|---------|
| `competitionTeams` | `competition.teams` (from CompetitionContext) | Populates team dropdown with names/logos |
| `competitionGender` | `competitionConfig.gender` | Constructs team key for roster lookup (e.g., `bridgeport-womens`) |
| `teamsDbFunctions` | `useTeamsDatabase()` hook | Provides `getTeamRosterWithHeadshots()`, `getHeadshot()`, `resolveSchoolKey()`, `getAthleteMedia()`, `saveAthleteMedia()` |

---

## Component: WhoToWatchEditor

The editor panel renders inside the segment detail panel when `type === 'who-to-watch'`. Six sections with progressive disclosure:

### 1. Team & Athlete Selection

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Team / School | Searchable dropdown | Yes | Populated from competition teams. Selecting a team auto-fills `teamName` and `logoUrl`, clears athlete. |
| Athlete | Searchable dropdown | Yes | Populated from selected team's roster via `useTeamsDatabase`. Selecting auto-fills `headshot`. Falls back to manual text input if no roster found. |

**After athlete is selected, these fields appear:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Subtitle | Text input | No | Freeform line — year, hometown, apparatus (e.g., "Sr • Spring, TX • All-Around") |
| Stat Label | Text input | No | Label for the stat line (default: "Season High") |
| Stat Value | Text input | No | The stat value (e.g., "9.925") |
| Headshot URL | Collapsible override | No | Auto-filled from database; expandable for manual override |
| Team Logo URL | Collapsible override | No | Auto-filled from competition config; expandable for manual override |

### 2. Athlete Image (for title cards)

Appears after athlete is selected. Shows a thumbnail grid of all available images for the athlete:

| Source | Border Color | Description |
|--------|-------------|-------------|
| Headshot | — | Auto-filled from teams database (same as lower-third) |
| Gallery images | Rose | Additional images from `teamsDatabase/media/{key}` (portrait, action, full-body) |
| "None" option | — | No image on title cards |
| Custom URL | — | Click "+" to paste a new URL and save it to the gallery |

**Image mode selector** (when an image is selected):
- **Portrait** (default) — tall cutout anchored to bottom, like ESPN media day photos
- **Headshot** — circular crop with border
- **Full** — large rectangular with rounded corners

### 3. Title Cards (0–3)

Up to 3 full-screen cards shown before the video clip. Each card has:

| Field | Description |
|-------|-------------|
| Headline | Large accent-colored text above the athlete name (e.g., "SENIOR") |
| Body | Multi-line text below the athlete name (e.g., "17 Career 10.000s\nVault - 1 \| Bars - 6") |

Card controls:
- **Add Card** button (disabled at 3)
- **Reorder** with up/down arrows
- **Delete** with trash icon
- **Mini 16:9 preview** for each card showing headline, athlete name, and body text

### 4. Highlight Clip

| Field | Description |
|-------|-------------|
| Video URL | URL for the highlight clip. YouTube URLs auto-extract a thumbnail for preview. |

### 5. Lower-Third Preview

A live 16:9 preview showing:
- Video thumbnail as background (if YouTube URL, auto-extracted; otherwise dark gradient)
- Lower-third graphic overlay: header bar ("WHO TO WATCH" + team logo) and content bar (headshot, name, subtitle, stat line)
- Updates in real-time as fields are edited

### 6. Playback Order Summary

A visual flow showing the full segment sequence:
```
Card 1: SENIOR → Card 2 → Card 3 → Video Clip → Lower Third
```

---

## Overlay: who-to-watch.html (Lower Third)

Broadcast-ready transparent overlay at 1920x1080. Follows the same pattern as `athlete-spotlight.html`.

### Layout
- **Position:** Bottom-left, 100px from left edge, 120px from bottom
- **Min width:** 600px, **Max width:** 900px
- **Animation:** Slide-in from left (0.6s cubic-bezier)

### Structure
| Element | Style |
|---------|-------|
| Header bar | Theme-aware background (`--meet-header-bg`), "WHO TO WATCH" label (36px, 900 weight), team logo (50x50) |
| Content bar | Black background, athlete headshot (110px circle with white border), name (32px, 900 weight, white), subtitle (18px, gray), stat line (18px, theme accent color) |

### Theme Support
Uses `theme-loader.js` for CSS variable injection. Responds to:
- `--meet-header-bg` — header bar background
- `--meet-header-text` — header bar text color

### URL Parameters
| Param | Description |
|-------|-------------|
| `athleteName` | Athlete display name |
| `logo` or `logoUrl` | Team logo URL |
| `subtitle` or `teamName` | Subtitle text (falls back to team name) |
| `statLabel` | Stat label (e.g., "Season High") |
| `statValue` | Stat value (e.g., "9.925") |
| `headshot` | Athlete headshot URL |
| `meetTheme` | Theme ID for theme-loader.js |

---

## Overlay: who-to-watch-title.html (Full-Screen Title Card)

Broadcast-quality full-screen title card at 1920x1080, inspired by ESPN/Big Ten Network "Who to Watch" packages. Uses the team's primary color as a full-screen background wash with the athlete's portrait cutout on the right side.

### Design Reference
Modeled after UCLA/ESPN broadcast packages (e.g., Jordan Chiles "Who to Watch" segment):
- Full team-colored background (not dark/black)
- Large team logo watermark behind content (8% opacity)
- Headline in an accent-colored bar (e.g., "SENIOR")
- Massive athlete name dominates the left side (110px, 900 weight)
- Athlete portrait cutout on the right, anchored to bottom
- Stat callout mode: auto-detects "NUMBER LABEL" pattern (e.g., "17 Career 10.000s") and renders with a giant number + label layout

### Layout
- **Background:** Full-screen `--meet-header-bg` wash (85% opacity) with gradient overlay and texture support
- **Left side:** Text content (badge, team row, headline bar, athlete name, stat/body)
- **Right side:** Athlete image (550px wide, anchored to bottom for portrait mode)
- **Bottom stripe:** Thin accent line using `--meet-content-bg`
- **Logo watermark:** 600px team logo at 8% opacity behind content
- **Animation:** Staggered slide-in (stripe → badge → team → headline → name → body; image slides from right)

### Structure
| Element | Style |
|---------|-------|
| Background | `--meet-header-bg` full wash + gradient + texture overlay |
| Logo watermark | 600px, 8% opacity, centered-right behind content |
| Badge | "WHO TO WATCH" pill (13px, 800 weight, `--meet-badge-bg`) |
| Team row | Logo in white container (48px) + team name (20px, 700 weight, 4px letter-spacing) |
| Headline bar | Accent-colored bar (`--meet-content-bg`) containing headline text (34px, 900 weight) |
| Athlete Name | Giant white text (110px, 900 weight, -4px letter-spacing, text-shadow) |
| Stat callout | Big number (120px) + label (42px) — auto-detected from body text pattern |
| Accent line | 80px × 4px divider using `--meet-content-bg` |
| Body Text | Multi-line white text (32px, 800 weight, pre-line whitespace) |
| Bottom stripe | Full-width 6px bar using `--meet-content-bg` |

### Image Modes
| Mode | CSS Class | Description |
|------|-----------|-------------|
| `portrait` | `.image-portrait` | Tall cutout anchored to bottom center, drop-shadow. Default for `imageUrl`. |
| `headshot` | `.image-headshot` | 400px circle with border, vertically centered. Default for `headshot` param. |
| `full` | `.image-full` | Large rectangular with rounded corners and border. |

### Theme Support
Uses `theme-loader.js`. Responds to:
- `--meet-overlay-bg` — body fallback background color
- `--meet-overlay-text` — text color
- `--meet-header-bg` — full-screen background wash, headline bar text color
- `--meet-header-text` — headline bar text color
- `--meet-content-bg` — headline bar background, accent line, bottom stripe
- `--meet-badge-bg` / `--meet-badge-text` — badge pill colors
- `--meet-texture` / `--meet-texture-opacity` — background texture overlay

### URL Parameters
| Param | Description |
|-------|-------------|
| `athleteName` | Athlete display name (displayed large) |
| `teamName` | Team/school name (displayed in team row) |
| `headline` | Accent text in colored bar above athlete name (e.g., "SENIOR") |
| `body` | Multi-line body text below (use `%0A` for newlines). If first line matches `NUMBER LABEL` pattern, renders as stat callout. |
| `logo` or `logoUrl` | Team logo URL (shown inline + as large watermark) |
| `imageUrl` | Athlete image URL — portrait/action shot (preferred, defaults to portrait mode) |
| `headshot` | Athlete headshot URL (fallback if no `imageUrl`, defaults to circle mode) |
| `imageMode` | Override display mode: `portrait`, `headshot`, or `full` |
| `badge` | Override badge text (empty string hides badge) |
| `meetTheme` | Theme ID for theme-loader.js |

---

## Graphics Registry Entry

Registered in `graphicsRegistry.js` as `who-to-watch`:

| Property | Value |
|----------|-------|
| Category | `pre-meet` |
| Renderer | `overlay` |
| File | `who-to-watch.html` |
| Transparent | `true` |
| Per-team | `true` |
| Gender | `both` |

---

## Rundown Editor Integration

### Type Configuration
| Property | Value |
|----------|-------|
| Type value | `who-to-watch` |
| Badge color | Rose (`bg-rose-500/20 text-rose-400`) |
| Row border | `border-l-rose-500` |
| Print preview | Star icon + "WHO TO WATCH" + athlete name + team name |
| Filter button | "Who to Watch" in print view filter bar |

### Validation
- Save button disabled until a team is selected AND an athlete name is provided
- Tooltip: "Athlete name is required"

### Firebase Persistence
The `whoToWatch` object (including `titleCards` array) is saved alongside the segment via `sanitizeSegmentForFirebase()` at path:
```
competitions/{compId}/rundown/segments/{index}/whoToWatch
```

---

## Acceptance Criteria

- [x] "Who to Watch" appears as a segment type in the rundown editor dropdown
- [x] Selecting the type shows the WhoToWatchEditor panel
- [x] Team dropdown is populated from the competition's teams
- [x] Selecting a team auto-fills team name and logo URL
- [x] Athlete dropdown is populated from the selected team's roster (searchable)
- [x] Selecting an athlete auto-fills headshot URL from the teams database
- [x] Falls back to manual text input if no roster is found for the team
- [x] Headshot/logo URL overrides are available in a collapsible section
- [x] Up to 3 title cards can be added with headline and body text
- [x] Title cards have reorder (up/down), delete, and mini preview
- [x] Video URL field accepts a clip URL
- [x] YouTube URLs auto-extract a thumbnail for preview
- [x] Live 16:9 lower-third preview shows the graphic composited on the video thumbnail
- [x] Preview updates in real-time as fields change
- [x] Playback order summary shows the full sequence (cards → clip → lower third)
- [x] Save is disabled without a team and athlete selected
- [x] Segment data (including titleCards) persists to Firebase correctly
- [x] `who-to-watch.html` lower-third overlay renders at 1920x1080 with transparent background
- [x] `who-to-watch-title.html` full-screen title card renders at 1920x1080 with ESPN-style broadcast quality
- [x] Title card uses team-colored background wash with logo watermark
- [x] Title card supports portrait cutout, headshot circle, and full rectangular image modes
- [x] Title card auto-detects stat callout pattern ("17 Career 10.000s") and renders big number + label
- [x] Both overlays support meet themes via theme-loader.js
- [x] Headshot falls back to initials when no image URL is provided
- [x] Image picker shows headshot + gallery images as thumbnail grid
- [x] Image picker supports adding custom URLs and saving to athlete media gallery
- [x] Image mode selector (portrait/headshot/full) controls title card rendering
- [x] Athlete media gallery persists to Firebase at `teamsDatabase/media/{key}`
- [x] Media Manager shows expandable athlete rows with image gallery and add form
- [x] Media Manager gallery images show with rose border, headshot with green border
- [x] Media Manager gallery supports delete (hover to reveal) and type/label metadata
- [x] Print view shows rose-colored "Who to Watch" badge and filter button
- [x] Build passes with no errors
- [x] Deployed and verified on commentarygraphic.com

---

## Athlete Media Gallery

### Firebase Structure
```
teamsDatabase/media/{safeKey}/
  [
    { "url": "https://...", "type": "portrait", "label": "Media Day 2026", "updatedAt": "..." },
    { "url": "https://...", "type": "action", "label": "Floor routine", "updatedAt": "..." }
  ]
```

Keys use `normalizeName()` + `getSafeFirebaseKey()` — same as headshots (spaces preserved, only Firebase-unsafe chars replaced).

### Image Types
| Type | Description | Title Card Rendering |
|------|-------------|---------------------|
| `portrait` | Standing/posed media day photo | Tall cutout anchored to bottom-right |
| `action` | Competition action shot | Same as portrait |
| `full-body` | Full body with background | Same as portrait |
| `custom` | Any other image | Same as portrait |

### Hook Functions (`useTeamsDatabase`)
| Function | Description |
|----------|-------------|
| `getAthleteMedia(athleteName)` | Returns array of `{ url, type, label }` for the athlete |
| `saveAthleteMedia(athleteName, url, type, label)` | Appends a new image to the athlete's gallery |
| `deleteAthleteMedia(athleteName, index)` | Removes an image by array index |

### Media Manager Integration
- Click any athlete in the roster grid to expand their media panel
- Shows headshot (green border) + gallery images (rose border) as thumbnails
- Add form: URL, type dropdown, optional label
- Hover to reveal delete button on gallery images
- Rose photo badge with count appears on athletes with gallery images

---

## Known Issues (2026-03-24 Verification)

Screenshots in `docs/PRD-Who-To-Watch/screenshots/` show the following issues when the title card overlay (`who-to-watch-title.html`) is rendered at 1920×1080:

### Overlay Visual Issues

1. **No athlete image/headshot visible** — The entire right ~60% of the screen is empty blue gradient. No headshot, portrait cutout, or any athlete image renders. The PRD specifies a 550px-wide athlete portrait on the right side, anchored to the bottom — this is completely missing.

2. **No team-colored background** — The PRD specifies a full-screen team-colored wash using `--meet-header-bg` at 85% opacity. Instead, the overlay shows a generic dark blue gradient regardless of team. There is no team branding visible.

3. **No team logo watermark** — The PRD specifies a 600px team logo at 8% opacity behind content. This is not visible in any screenshot.

4. **No team logo inline** — The PRD specifies a team row with logo (48px in white container) + team name. The logo is missing; only the team name text shows.

5. **Athlete name is too small** — The PRD specifies 110px at 900 weight. The rendered name appears to be around 64px — significantly smaller than broadcast-quality. At the reduced test size (52px), it's barely readable.

6. **Body text and stats too small** — The stat line and body text are tiny and would be unreadable on a TV at normal viewing distance. PRD specifies 32px body and 42px stat labels, but they appear much smaller.

7. **"WHO TO WATCH" badge is minuscule** — The header badge is barely visible. Not prominent enough as a segment identifier for broadcast.

8. **Team name is faint and small** — Rendered in light gray that barely stands out against the blue gradient background. PRD specifies 20px with 700 weight and 4px letter-spacing.

9. **All content crammed into left ~35%** — The layout is completely unbalanced. Text is pushed to the lower-left corner with vast empty space on the right (where the athlete image should be). Does not fill the screen like an ESPN-style broadcast title card.

10. **No stat callout rendering** — The PRD specifies auto-detection of "NUMBER LABEL" pattern (e.g., "17 Career 10.000s") rendering as a giant number (120px) + label (42px). Instead, it renders as small inline text.

11. **No headline accent bar** — The PRD specifies a colored bar using `--meet-content-bg` behind the headline text. The headline ("SOPHOMORE") renders as a plain gray box, not a team-branded accent bar.

12. **No bottom accent stripe** — The PRD specifies a full-width 6px bar at the bottom using `--meet-content-bg`. Not visible in screenshots.

13. **No staggered animation** — PRD specifies staggered slide-in animations. Cannot verify from static screenshots but the layout should at minimum look correct at rest.

### Theme / Triggering Issues

14. **meetTheme not passed during show execution** — When the timesheet engine triggers a Who to Watch graphic during a live show (`server/lib/timesheetEngine.js` `_triggerGraphic()`), it builds the data object with team names, logos, event info, but does NOT include `meetTheme` from the competition config. The overlay URL is built without `meetTheme`, so `theme-loader.js` never fires and no team colors load. Manual triggers from `GraphicsControl.jsx` DO pass `meetTheme: config.meetTheme || ''` — the automated path is missing this. This is the root cause of the "no team colors" issue (#2 above).

### Editor Issues

15. **Card Adjustments sliders are hard to see** — The 7 sliders are tiny red lines at the bottom of a very busy panel. Not visually prominent or easy to use.

16. **Card preview is too small** — The live preview iframe in the editor is thumbnail-sized. Producers cannot see the effect of slider adjustments at a usable size.

### Screenshot Capture Issues

17. **Test 8 screenshot (`verify-validation-hint-full.png`) shows wrong content** — Shows the segment list instead of the edit panel with the "Full (rectangular)" dropdown and amber warning. The warning was confirmed present via DOM inspection but not visually captured.

### Editor / Integration Issues (2026-03-25 Audit)

18. ~~**Slider adjustments don't update the preview in real-time**~~ — **FIXED 2026-03-25.** Root cause: the browser was not reliably re-navigating the iframe when React updated `src` to the same page with different query params. Fix: added `key={debouncedOverlayUrl}` to the iframe element to force React to remount it when the debounced URL changes. Debounce (300ms) and `allow-same-origin` sandbox were already in place from a prior partial fix. Commit: `7341013`.

19. **`who-to-watch-title` graphic not registered in graphics registry** — `graphicsRegistry.js` only registers `who-to-watch` (pointing to `who-to-watch.html`, the lower-third overlay). There is no registry entry for `who-to-watch-title` (the full-screen title card). This means the URL Generator page cannot generate title card preview URLs, and the title card variant does not appear in the graphics picker. **Fix:** Add a `who-to-watch-title` entry to `graphicsRegistry.js` with `file: 'who-to-watch-title.html'` and params for all title card fields including adjustment params.

20. **No URL builder support for who-to-watch graphics** — The `generateGraphicURL()` function in `urlBuilder.js` has no case for either `who-to-watch` or `who-to-watch-title`. The URL Generator page returns empty URLs for these graphics. **Fix:** Add URL builder cases for both `who-to-watch` (lower-third) and `who-to-watch-title` (title card) that construct the correct overlay URLs with all params.

21. ~~**useEffect sync loop causes double-renders on every slider change**~~ — **ALREADY FIXED.** The `useEffect` at `WhoToWatchEditor.jsx:419-425` already guards with `JSON.stringify(merged) !== JSON.stringify(config)` so it only resets when prop values actually differ. The double-render issue described here does not occur in the current code.

22. **imageMode default mismatch between editor and output.html** — `DEFAULT_WHO_TO_WATCH.imageMode` is `'headshot'` (`WhoToWatchEditor.jsx:64`), but `output.html:12692` defaults `imageMode` to `'portrait'`. If `imageMode` is not explicitly saved to Firebase, the editor preview renders a headshot circle while the live broadcast output renders a portrait cutout. **Fix:** Align both defaults to the same value (`'portrait'` is the better default for title cards, since headshot images are circular crops that don't fill the 550px image column well).

23. **Slider effects invisible when card content is empty** — When headline and body text fields are both empty, adjusting `headlineFontSize` and `bodyFontSize` has zero visible effect in the preview because there is no text to resize. The only visible adjustments are name size, text offset Y, and image scale/position. This is technically correct behavior but confusing for producers who see sliders but no visual feedback. **Fix:** Add a subtle hint below the Card Adjustments section when headline and body are both empty, e.g., "Add headline or body text to see font size adjustments."

### Human-Reported Issues (2026-03-25 Review)

24. **URL Generator has no editable text controls for who-to-watch-title** — Human review found that the who-to-watch-title graphic appears in the URL Generator, but there are no input fields to modify the text content (athleteName, teamName, headline, body). The user sees a static preview with no way to customize it. The registry entry exists but params may be missing the correct flags for editability. **Fix:** Ensure the `who-to-watch-title` registry params have proper structure for URL Generator controls (editable flags, placeholders, input types). Compare with working graphics that show editable inputs.

25. ~~**Verification screenshots don't prove slider functionality**~~ — **FIXED 2026-03-25.** Additionally found and fixed a second bug: CSS animation `fill-mode: both` on the image slide-in animation was overriding the inline `style.transform` set by JavaScript for image scale/offset. Per the CSS cascade, animation values take priority over normal inline styles. Fix: clear `animation: none` on the image element before applying custom transform. Before/after screenshots now confirm: name size 40px vs 100px shows dramatically different text, image scale 50% vs 150% shows dramatically different headshot sizes. Commit: `7341013`.

### Editor Control Gaps (2026-03-25 Human Review)

26. **No slider control for "WHO TO WATCH" badge text** — **FIXED 2026-03-25.** Added badge text input (default "WHO TO WATCH", empty hides badge) and badge font size stepper to Card Adjustments. Overlay already supported `badge` param; added `badgeFontSize` param. Commits: `405c7ce`, `322d30b`, `924afcc`.

27. **No slider control for team name row** — **FIXED 2026-03-25.** Added team name font size stepper (default 20px), team logo size stepper (default 48px, `logoSize` param), and show/hide toggle (`showTeamRow` param). No upper limits on any value. Commits: `405c7ce`, `70b1902`.

28. **No control over logo watermark** — **FIXED 2026-03-25.** Added watermark controls: opacity stepper (default 8%), scale stepper (default 100%), offset X/Y steppers (default 0, step 10px), and show/hide toggle. Params: `watermarkOpacity`, `watermarkScale`, `watermarkOffsetX`, `watermarkOffsetY`, `showWatermark`. Also fixed `.image-side` overflow from `hidden` to `visible` so offset images aren't clipped. Commits: `405c7ce`, `88355cd`, `23699b6`.

29. **No theme/background color controls in editor** — **FIXED 2026-03-25.** Added theme picker dropdown (fetches from Firebase `themes/`), background color override (`bgColor` → `--meet-header-bg`), and accent color override (`accentColor` → `--meet-content-bg`). Color overrides applied via `setTimeout(600ms)` after theme-loader completes. Commit: `405c7ce`.

30. ~~**Video clip does not play during Who to Watch segment in live show**~~ — **FIXED 2026-03-26.** Graphics source renders WTW lower-third iframe when `overlayStyle === 'who-to-watch'` (`output.html:13232`). Clip source suppresses built-in `#clipOverlay` for WTW clips (`output.html:13482,13543,6880`). Sequencer passes `overlayStyle` and `meetTheme` in clip step (`server/index.js:835-836`). Commits: `ce8beb9`, `03505fe`, `aa840f6`, `029a5bc`.

32. ~~**Graphic dropdown is redundant and confusing for WTW/playout/content-sequence types**~~ — **FIXED 2026-03-26.** Graphic dropdown hidden for `who-to-watch`, `playout`, and `content-sequence` types via conditional at `RundownEditorPage.jsx:8114`. Registry entries preserved for URL Generator. Commit: `ce8beb9`.

33. ~~**Lower-third preview in editor is a React mockup, not the real overlay**~~ — **FIXED 2026-03-26.** Replaced React mockup with `LowerThirdIframePreview` component following `TitleCardIframePreview` pattern. Renders scaled 1920x1080 iframe to `/overlays/who-to-watch.html` with 300ms debounce, dark background behind transparent overlay. Editor preview now matches production exactly. Commit: (pending).

34. **No adjustment controls for the WTW lower-third overlay** — The title card overlay (`who-to-watch-title.html`) has 19+ adjustment params with stepper controls in the editor (font sizes, offsets, colors, watermark, badge, etc.). The lower-third overlay (`who-to-watch.html`) has ZERO adjustment params — everything is hardcoded CSS. Producers cannot tune font sizes, headshot size, card positioning, or colors. **Fix:** Add query param support to `who-to-watch.html` for all adjustable properties (matching the title card pattern), add stepper controls in the WhoToWatchEditor, pass adjustments through the sequencer to the live iframe, and store adjustments in the segment's `whoToWatch` object.

35. **Lower-third overlay has no theme override controls** — The title card editor has a theme dropdown + bgColor/accentColor color pickers that override theme-loader colors. The lower-third has no equivalent — it only receives `meetTheme` from the sequencer with no per-segment override. **Fix:** Add theme dropdown and color override pickers to the lower-third adjustments panel, same as the title card. Pass `bgColor`/`accentColor` as query params to `who-to-watch.html`, apply them via `setTimeout(600ms)` after theme-loader (same pattern as `who-to-watch-title.html`).

36. **Theme system documentation: where WTW graphics render** — The WTW segment renders graphics in TWO places during the sequence: (a) title cards render on the **graphics source** (`output.html` live mode) as full-screen iframes to `who-to-watch-title.html`, (b) the lower-third renders on the **graphics source** as an iframe to `who-to-watch.html` overlaying the video playing on the **clip source** (`output.html?mode=clip`). Both overlays load `theme-loader.js` which reads `meetTheme` from their iframe URL params and fetches theme CSS variables from Firebase. Theme overrides (`bgColor`, `accentColor`) are applied via `setTimeout(600ms)` after theme-loader completes. The sequencer passes `meetTheme` and override colors through Firebase `currentGraphic` → both OBS sources read them. **This means theme changes to the WTW lower-third require updating `overlays/who-to-watch.html` only — the graphics source iframe loads it dynamically.**

31. **Title card adjustments not passed through sequencer to rendered output** — The WhoToWatch sequencer in `server/index.js` (line ~792) only passed 7 of 19 card adjustment fields (`nameFontSize`, `bodyFontSize`, `headlineFontSize`, `textOffsetY`, `imageScale`, `imageOffsetX`, `imageOffsetY`) to Firebase `currentGraphic`. Missing: `badgeText`, `badgeFontSize`, `teamNameFontSize`, `logoSize`, `showTeamRow`, `watermarkOpacity`, `watermarkScale`, `watermarkOffsetX`, `watermarkOffsetY`, `showWatermark`, `bgColor`, `accentColor`. Additionally, `output.html` had a hardcoded `adjustKeys` array with only the same 7 fields. The editor preview worked correctly (builds iframe URL directly with all params) but live show playback used defaults for all missing fields. **FIXED 2026-03-25.** Both `server/index.js` and `output.html` now pass all 19 card adjustment fields.

---

## Implementation Plan: WTW Video Playback + Lower Third

**Status:** IN PROGRESS (Issues #30, #32, #33 fixed 2026-03-26; Issues #34-35 remain)
**Date:** 2026-03-26
**Priority:** Issues #34-35 remain — adjustment controls, theme overrides

### Problem Statement

The Who to Watch segment is a multi-part sequence: Title Cards → Video Clip (with lower third overlay) → Clear. Currently, title cards render correctly on the graphics source (`output.html`), but the video clip step is broken:

1. The WTW sequencer writes `clip-playback` to `currentGraphic`
2. The **graphics source** (live mode) sees `clip-playback` and **clears its output** (goes transparent)
3. The **clip source** (`output.html?mode=clip`) sees `clip-playback` and **plays the video** with its built-in overlay
4. But the clip source's built-in overlay (`#clipOverlay`) is a simple top-left athlete panel designed for the Playout engine — it is NOT the WTW lower-third design
5. Additionally, the lower third needs to show the WTW-specific fields (headshot circle, "WHO TO WATCH" header, subtitle, stat line) which the standard clip overlay does not support

### OBS Source Layout (Important Context)

The producer's OBS scene has **two browser sources stacked** (both always visible, no scene switching needed):

| Layer | URL | Purpose |
|-------|-----|---------|
| Top | `output.html?comp={id}&meetTheme={theme}` | Graphics source (title cards, lower thirds, logos, overlays) |
| Bottom | `output.html?comp={id}&mode=clip&meetTheme={theme}` | Clip source (video playback + built-in overlay) |

Both sources listen to the same Firebase `currentGraphic` path. They filter by mode:
- **Graphics source** (live mode): Renders regular graphics. When it sees `clip-playback`, it clears itself (goes transparent so the clip source underneath is visible).
- **Clip source** (clip mode): Only responds to `clip-playback` and `moment-replay`. Ignores all other graphics.

Because both sources are always layered (no OBS scene switching), the graphics source going transparent during `clip-playback` is correct — it lets the video show through from the clip source below. The WTW lower third needs to render on the graphics source ON TOP of the video playing on the clip source.

### How the Playout Engine Solves This (Reference)

The Playout engine's "lower third" during clips is NOT a separate graphic write. It is a **built-in DOM overlay** (`#clipOverlay`) inside `output.html?mode=clip` — athlete name, team logo, apparatus, and score badge, all populated from the `clip-playback` data payload. The overlay is always in the same DOM as the video elements. One Firebase write, one source, video + overlay together.

This works for Playout because the overlay is simple and generic. It does NOT work for WTW because the WTW lower third is a completely different design (`who-to-watch.html`).

### Solution: WTW Overlay Mode in Clip Source + Graphics Source Lower Third

**Approach:** Use BOTH OBS sources working together during the WTW video step:
- **Clip source** plays the video (it already does this correctly when it receives `clip-playback`)
- **Graphics source** shows the WTW lower third as a transparent overlay on top

The key insight: the graphics source currently **clears** when it sees `clip-playback`. Instead, when the `clip-playback` data includes `overlayStyle: 'who-to-watch'`, the graphics source should render the WTW lower third (via iframe to `who-to-watch.html`) instead of clearing.

### Sequencer Steps (Updated)

The WTW sequencer in `server/index.js` writes these steps to `currentGraphic`:

**Step 1–3: Title Cards** (5s each, unchanged)
```javascript
{
  graphic: 'who-to-watch-title',
  data: { athleteName, teamName, logoUrl, imageUrl, imageMode, headline, body, meetTheme, ...adjustments }
}
```
- Graphics source: renders full-screen title card
- Clip source: ignores (not a clip-type graphic)

**Step 4: Video Clip + Lower Third** (duration-based, waits for clip completion)
```javascript
{
  graphic: 'clip-playback',
  data: {
    draftId: 'wtw-{segmentId}-{timestamp}',
    clipUrl: '...',
    // Standard clip fields (so clip source plays the video)
    athleteName, teamName, teamLogo: logoUrl,
    // WTW-specific fields (so graphics source shows lower third)
    overlayStyle: 'who-to-watch',
    headshot, subtitle, statLabel, statValue, meetTheme
  }
}
```
- Clip source: sees `clip-playback` → plays the video. Hides its built-in `#clipOverlay` because `overlayStyle === 'who-to-watch'` (the WTW lower third on the graphics source replaces it).
- Graphics source: sees `clip-playback` with `overlayStyle === 'who-to-watch'` → instead of clearing, renders an iframe to `who-to-watch.html` with the WTW params (headshot, athlete name, subtitle, stat line). The iframe has a transparent background, so only the lower-third bar is visible on top of the video.

**Step 5: Clear** (unchanged)
```javascript
{ graphic: 'clear', data: {} }
```
- Both sources clear.

### Code Changes Required

#### 1. `output.html` — Graphics source (live mode) clip-playback handler

**Current behavior** (line ~13226):
```javascript
if (isClipTypeGraphic) {
  output.innerHTML = '';  // Always clears
}
```

**New behavior:**
```javascript
if (isClipTypeGraphic) {
  if (data && data.overlayStyle === 'who-to-watch') {
    // Render WTW lower third as transparent overlay on top of clip video
    const params = new URLSearchParams({
      athleteName: data.athleteName || '',
      logo: data.teamLogo || '',
      subtitle: data.subtitle || data.teamName || '',
      statLabel: data.statLabel || '',
      statValue: data.statValue || '',
      headshot: data.headshot || '',
      meetTheme: data.meetTheme || ''
    });
    output.innerHTML = `<iframe src="/overlays/who-to-watch.html?${params}"
      style="width:1920px;height:1080px;border:none;"
      sandbox="allow-scripts allow-same-origin"></iframe>`;
  } else {
    output.innerHTML = '';  // Standard behavior: clear for playout clips
  }
}
```

#### 2. `output.html` — Clip source (clip mode) overlay suppression

**Current behavior:** Always shows `#clipOverlay` (athlete panel + score badge) on every `clip-playback`.

**New behavior:** When `data.overlayStyle === 'who-to-watch'`, hide `#clipOverlay` (the WTW lower third renders on the graphics source instead):
```javascript
if (data.overlayStyle === 'who-to-watch') {
  clipOverlay.classList.remove('visible');  // Hide built-in overlay
} else {
  updateClipOverlay(data);  // Standard playout overlay
}
```

#### 3. `server/index.js` — WTW sequencer clip step

Update the clip step in the WTW sequencer to include the new fields:
```javascript
{
  graphic: 'clip-playback',
  data: {
    draftId: `wtw-${segmentId}-${Date.now()}`,
    clipUrl: whoToWatch.clipUrl,
    athleteName: whoToWatch.athleteName,
    teamName: whoToWatch.teamName,
    teamLogo: whoToWatch.logoUrl,
    // WTW overlay fields
    overlayStyle: 'who-to-watch',
    headshot: whoToWatch.headshot,
    subtitle: whoToWatch.subtitle,
    statLabel: whoToWatch.statLabel,
    statValue: whoToWatch.statValue,
    meetTheme: meetTheme
  }
}
```

#### 4. `show-controller/src/pages/RundownEditorPage.jsx` — UI cleanup (Option B)

When segment type is `who-to-watch`, `playout`, or `content-sequence`, hide the generic graphic dropdown from the edit panel. These types have dedicated editors that manage their own graphics.

The graphic registry entries (`who-to-watch`, `who-to-watch-title`) remain — they are still used by the URL Generator page for building standalone preview URLs.

### Files to Modify

| File | Change |
|------|--------|
| `output.html` | Live mode: render WTW lower third iframe when `overlayStyle === 'who-to-watch'` instead of clearing |
| `output.html` | Clip mode: hide `#clipOverlay` when `overlayStyle === 'who-to-watch'` |
| `server/index.js` | WTW sequencer: add `overlayStyle`, `headshot`, `subtitle`, `statLabel`, `statValue`, `meetTheme` to clip step data |
| `show-controller/src/pages/RundownEditorPage.jsx` | Hide graphic dropdown for `who-to-watch`, `playout`, `content-sequence` types |

### Clip Proxy Reference

Clip videos are hosted on Cloudflare R2 as presigned URLs (7-day TTL). Direct `<video>` playback fails because unsigned/expired URLs return 400/403. The fix (deployed 2026-03-25) is a server-side proxy at `/api/clip-proxy?url={encodedPresignedUrl}` on the coordinator (44.193.31.120). In `output.html`, `proxyClipUrl()` (line ~6588) rewrites R2 URLs to proxy URLs before setting `video.src`. The clip source already uses this proxy — no additional proxy work needed for WTW.

### Verification Plan

1. Create a WTW segment with title cards + video clip URL
2. Run the show, observe the sequence:
   - Title card 1 renders full-screen on graphics source ✓
   - Title card auto-advances after 5s ✓
   - Video plays on clip source (visible through transparent graphics source) ✓
   - WTW lower third renders on graphics source as transparent overlay on top of video ✓
   - Built-in `#clipOverlay` is hidden during WTW clips ✓
   - After clip ends, both sources clear ✓
3. Verify Playout clips still work normally (no `overlayStyle` field = standard behavior)
4. Verify graphic dropdown is hidden for WTW/playout/content-sequence types in rundown editor

---

## Future Enhancements

- **Clip Engine integration:** Auto-populate athlete clips from the Clip Engine API by athlete ID, instead of manually pasting a URL
- **Multi-clip sequences:** Support multiple clip URLs per segment, played back in sequence with crossfade transitions
- **Auto-select by score:** Let the system pick the top N clips by score for an athlete
- **Apparatus overlays:** Show apparatus name and score on each clip during playback
- **One-click playback:** Trigger the full segment (title cards + video clip + lower third) from a single button in the producer view
- **Title card duration:** Configurable hold time per card (default 3-4 seconds)
- **Bulk media import:** Upload multiple athlete images at once from a media day folder
- **Image cropping/positioning:** Adjust crop and position per image without editing the source file
