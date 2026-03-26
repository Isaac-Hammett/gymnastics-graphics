# WTW Video Playback + Lower Third — Tasks

## Tasks

### Task 1: Add overlayStyle and meetTheme to WTW sequencer clip step — COMPLETE
**Files:** `server/index.js`
**Why first:** The server writes data to Firebase that both OBS sources read. The new fields must be present before the client-side code can branch on them.

**Changes:**
- In the `whoToWatchStarted` handler (~line 819-840), add two fields to the clip step's `data` object:
  - `overlayStyle: 'who-to-watch'`
  - `meetTheme: meetTheme` (variable is already in scope from line ~759)
- The `meetTheme` variable is read from `competitions/{compId}/config/meetTheme` at handler initialization (line ~758-767) — no new Firebase reads needed.
- The `writeGraphic()` function (line ~870) spreads the entire graphic object, so the new fields flow to Firebase automatically.

**Verify:**
- [ ] Server starts without errors (`node server/index.js` or `pm2 restart`)
- [ ] No syntax errors in the modified block
- [ ] The clip step data object now contains `overlayStyle: 'who-to-watch'` and `meetTheme`
- [ ] Title card steps are unchanged (still have `meetTheme` via `baseData`, no `overlayStyle`)
- [ ] No console errors on coordinator startup

---

### Task 2: Render WTW lower-third iframe on graphics source during clip step — COMPLETE
**Files:** `output.html`
**Why second:** Depends on Task 1's `overlayStyle` field being in the Firebase data.

**Changes:**
- In the live mode clip-type handler (~line 13224-13230), replace the unconditional `output.innerHTML = ''` with a conditional branch:
  - If `data && data.overlayStyle === 'who-to-watch'`: render an iframe to `/overlays/who-to-watch.html` with query params mapped from the data fields (`athleteName`, `logo` ← `teamLogo`, `subtitle`, `statLabel`, `statValue`, `headshot`, `meetTheme`)
  - Else: existing behavior (`output.innerHTML = ''; hideAnimatedBackground();`)
- In the WTW branch, still call `hideAnimatedBackground()` to suppress any gradient behind the iframe
- iframe attributes: `style="width:1920px;height:1080px;border:none;"`, `sandbox="allow-scripts allow-same-origin"`

**Parameter mapping (data field → iframe param):**
| `data.athleteName` | `athleteName` |
| `data.teamLogo` | `logo` |
| `data.subtitle` (fallback `data.teamName`) | `subtitle` |
| `data.statLabel` | `statLabel` |
| `data.statValue` | `statValue` |
| `data.headshot` | `headshot` |
| `data.meetTheme` | `meetTheme` |

**Verify:**
- [ ] Open `output.html?comp={id}` (live mode) in browser
- [ ] When a `clip-playback` graphic with `overlayStyle: 'who-to-watch'` is written to Firebase, the graphics source shows a WTW lower-third bar (not a blank/transparent screen)
- [ ] The lower-third has transparent background (only the bar is visible, rest is transparent)
- [ ] When a regular `clip-playback` graphic (no `overlayStyle`) is written, the graphics source clears as before
- [ ] When `clear` is written, the iframe is destroyed and output is empty
- [ ] No console errors

---

### Task 3: Suppress built-in clip overlay for WTW clips on clip source — COMPLETE
**Files:** `output.html`
**Why third:** Depends on Task 1's `overlayStyle` field. Prevents the playout-style overlay from conflicting with the WTW lower-third.

**Changes:**
- In `handleClipPlayback()` (~line 13453-13500), before the `updateClipOverlay(data)` call, add a conditional:
  - If `data.overlayStyle === 'who-to-watch'`: call `clipOverlay.classList.remove('visible')` instead of `updateClipOverlay(data)`
  - Else: call `updateClipOverlay(data)` as before (standard playout overlay)
- Do NOT suppress clip status listeners (`setupClipStatusListeners`) — the WTW sequencer needs `clip_ended`/`clip_stalled` status write-backs to know when to advance
- Do NOT suppress `startClip()` — the video still needs to play

**Verify:**
- [ ] Open `output.html?comp={id}&mode=clip` (clip mode) in browser
- [ ] When a WTW `clip-playback` is received, the video plays but the built-in athlete panel overlay (`#clipOverlay`) is NOT visible
- [ ] When a regular `clip-playback` is received, the built-in overlay shows as before (athlete name, team logo, apparatus, score badge)
- [ ] Clip status write-back to Firebase still works for WTW clips (clip_ended fires when video finishes)
- [ ] No console errors

---

### Task 4: Hide graphic dropdown for dedicated-editor segment types — COMPLETE
**Files:** `show-controller/src/pages/RundownEditorPage.jsx`
**Why last:** Pure UI cleanup, no dependency on other tasks. Independent of the video playback fix.

**Changes:**
- In the `SegmentDetailPanel` component (~line 8113), wrap the graphic dropdown container `<div>` in a conditional:
  - `{!['playout', 'who-to-watch', 'content-sequence'].includes(formData.type) && ( <div className="border border-zinc-700 ..."> ... </div> )}`
- This hides the entire graphic picker block (smart recommendation + select + param inputs) for types that have dedicated editors
- The graphic registry entries remain unchanged — still used by URL Generator page
- The `formData.graphic` value is NOT cleared — stale values are harmless since sequencers ignore the graphic field for these types

**Verify:**
- [ ] Build succeeds: `cd show-controller && npm run build`
- [ ] Open Rundown Editor, select a segment with type "Who to Watch" — graphic dropdown is NOT visible
- [ ] Select a segment with type "Playout" — graphic dropdown is NOT visible
- [ ] Select a segment with type "Content Sequence" — graphic dropdown is NOT visible
- [ ] Select a segment with type "Live" or "Video" — graphic dropdown IS visible (unchanged)
- [ ] WhoToWatchEditor, PlayoutRulesEditor, ContentSequenceEditor still render below the common fields
- [ ] No console errors

---

### Task 5: Add adjustment query params to who-to-watch.html — COMPLETE
**Files:** `overlays/who-to-watch.html`
**Why first (of new tasks):** The overlay must accept params before the editor or sequencer can send them.

**Changes:**
Add query param parsing for these adjustment properties (following the same pattern as `who-to-watch-title.html`):

**Badge ("WHO TO WATCH" label):**
- `badgeText` (default: "Who to Watch") — custom label text. Empty string hides badge.
- `badgeFontSize` (default: 36px) — `.wtw-label` font size

**Text:**
- `nameFontSize` (default: 32px) — `.wtw-name` font size
- `subtitleFontSize` (default: 18px) — `.wtw-subtitle` font size
- `statFontSize` (default: 18px) — `.wtw-stat` font size

**Headshot:**
- `headshotSize` (default: 110px) — `.wtw-headshot` width & height
- `showHeadshot` (default: true) — set to `false` to hide headshot entirely

**Logo:**
- `logoSize` (default: 50px) — `.wtw-logo` width & height

**Card positioning:**
- `cardBottom` (default: 120px) — `.wtw-card` bottom offset
- `cardLeft` (default: 100px) — `.wtw-card` left offset
- `cardMinWidth` (default: 600px) — `.wtw-card` min-width
- `cardMaxWidth` (default: 900px) — `.wtw-card` max-width

**Theme overrides:**
- `bgColor` — override `--meet-header-bg` (applied after theme-loader via setTimeout 600ms)
- `accentColor` — override stat text color AND apply `--meet-content-bg` (applied after theme-loader via setTimeout 600ms)

Apply params by reading from URLSearchParams and setting inline styles on the DOM elements (same approach as `who-to-watch-title.html`). For `bgColor`/`accentColor`, use the same `setTimeout(600ms)` pattern to override after theme-loader.

**IMPORTANT — `accentColor` CSS gap:** The lower-third currently uses `--meet-header-bg` for BOTH the header bar background AND the stat text color (line 108 of CSS). It does NOT use `--meet-content-bg` at all. When adding `accentColor` support:
1. Add a CSS rule for `.wtw-stat` to use `--meet-content-bg` with fallback to `--meet-header-bg` (so accent color controls stat text independently)
2. In the setTimeout override, set BOTH `--meet-header-bg` (bgColor) and `--meet-content-bg` (accentColor)

**Verify:**
- [ ] Open `who-to-watch.html?athleteName=Test&nameFontSize=48&headshotSize=80&badgeText=SPOTLIGHT&cardBottom=200` — verify name is larger, headshot is smaller, badge says "SPOTLIGHT", card is higher
- [ ] Open with `bgColor=%23ff0000` — header bar is red (after brief flash of default)
- [ ] Open with no params — looks identical to current default behavior
- [ ] No console errors

---

### Task 6: Replace lower-third React mockup with real iframe preview — COMPLETE
**Files:** `show-controller/src/components/playout/WhoToWatchEditor.jsx`
**Why second:** Depends on Task 5's query params being available in `who-to-watch.html`.

**Changes:**
- Create `LowerThirdIframePreview` component following the `TitleCardIframePreview` pattern (line ~366):
  - Renders a 1920x1080 iframe to `/overlays/who-to-watch.html` scaled down to container width
  - Uses `ResizeObserver` for responsive scaling
  - Debounces URL changes at 300ms to avoid iframe reload on every keystroke
  - Passes all content params (`athleteName`, `logo`, `subtitle`, `statLabel`, `statValue`, `headshot`, `meetTheme`) plus adjustment params
- Replace the React mockup section (lines ~997-1063) with `<LowerThirdIframePreview>`
- The iframe preview should show a dark background behind it (to simulate video) since the overlay is transparent

**Verify:**
- [ ] Build succeeds: `cd show-controller && npm run build`
- [ ] Open Rundown Editor, select a WTW segment — Lower-Third Preview shows the REAL `who-to-watch.html` overlay (not the old Tailwind mockup)
- [ ] Changing athlete name in the editor updates the preview (after 300ms debounce)
- [ ] Preview matches what renders in the live show
- [ ] No console errors

---

### Task 7: Add lower-third adjustment controls to WhoToWatchEditor — NOT STARTED
**Files:** `show-controller/src/components/playout/WhoToWatchEditor.jsx`
**Why third:** Depends on Task 5 (params) and Task 6 (preview). Controls need both to be useful.

**Changes:**
- Add a collapsible "Lower-Third Adjustments" panel below the lower-third iframe preview (same UI pattern as the title card "Card Adjustments" panel)
- Store adjustments in `config.lowerThirdAdjustments` object (inside `whoToWatch`)
- Groups: **BADGE**, **TEXT**, **HEADSHOT**, **LOGO**, **POSITION**, **THEME**
- Use the existing `ValueStepper` component for all numeric controls
- Add theme dropdown (fetches from Firebase `themes/`) and bgColor/accentColor color pickers (same as title card)
- Pass all adjustments as URL params to the `LowerThirdIframePreview` iframe

**Controls:**
| Group | Control | Field | Default | Step |
|-------|---------|-------|---------|------|
| BADGE | Badge text | `badgeText` | "Who to Watch" | text input |
| BADGE | Badge font size | `badgeFontSize` | 36 | 1px |
| TEXT | Name font size | `nameFontSize` | 32 | 1px |
| TEXT | Subtitle font size | `subtitleFontSize` | 18 | 1px |
| TEXT | Stat font size | `statFontSize` | 18 | 1px |
| HEADSHOT | Headshot size | `headshotSize` | 110 | 5px |
| HEADSHOT | Show headshot | `showHeadshot` | true | toggle |
| LOGO | Logo size | `logoSize` | 50 | 5px |
| POSITION | Bottom offset | `cardBottom` | 120 | 10px |
| POSITION | Left offset | `cardLeft` | 100 | 10px |
| POSITION | Min width | `cardMinWidth` | 600 | 50px |
| POSITION | Max width | `cardMaxWidth` | 900 | 50px |
| THEME | Theme | (dropdown) | (from competition) | select |
| THEME | Background color | `bgColor` | (from theme) | color picker |
| THEME | Accent color | `accentColor` | (from theme) | color picker |

**Verify:**
- [ ] Build succeeds: `cd show-controller && npm run build`
- [ ] Open Rundown Editor, select WTW segment — "Lower-Third Adjustments" panel is visible (collapsed by default)
- [ ] Expand adjustments — stepper controls visible for all groups
- [ ] Change name font size to 48px — iframe preview updates to show larger name
- [ ] Change headshot size to 80px — iframe preview shows smaller headshot
- [ ] Select a theme from dropdown — iframe preview shows themed colors
- [ ] Set bgColor to red — iframe preview header bar turns red
- [ ] No console errors

---

### Task 8: Pass lower-third adjustments through sequencer to live output — NOT STARTED
**Files:** `server/index.js`, `output.html`
**Why last:** Depends on Tasks 5-7. Connects the editor adjustments to the live show.

**Changes:**
- In `server/index.js` WTW sequencer clip step (~line 819-840), spread `whoToWatch.lowerThirdAdjustments` into the clip step data:
  ```javascript
  data: {
    ...existing fields,
    ...(whoToWatch.lowerThirdAdjustments || {})
  }
  ```
- In `output.html` live mode WTW iframe builder (~line 13232-13245), pass adjustment params to the iframe URL (same pattern as existing content params — iterate over known adjustment keys and add to URLSearchParams)
- **IMPORTANT: TWO URL builder locations in output.html.** Both must be updated:
  1. Live mode clip-playback handler (~line 13232) — uses `URLSearchParams`
  2. Renderer dictionary `'who-to-watch-lower-third'` (~line 12760) — uses `encodeURIComponent`
  Both build iframe URLs for `who-to-watch.html`. Define a shared `LOWER_THIRD_ADJUST_KEYS` array and use it in both locations to keep them in sync.

**Verify:**
- [ ] Set lower-third adjustments in editor (e.g., nameFontSize=48, bgColor=#ff0000)
- [ ] Run the show, reach the WTW clip step
- [ ] The live lower-third should reflect the adjustments (larger name, red header)
- [ ] Default values (no adjustments set) should render identically to current behavior
- [ ] No console errors

---

## Discovered Bugs
(populated by iterations as they find problems)

## Learnings
- LEARNING: Task 1 confirmed `meetTheme` is a shorthand property in the data object (ES6 shorthand for `meetTheme: meetTheme`). The variable is in scope from line 759. No new Firebase reads needed.
- LEARNING: Title card steps use `...baseData` which already includes `meetTheme` but NOT `overlayStyle`. This is correct — only clip steps need `overlayStyle` to differentiate from regular playout clips.
- LEARNING: The iframe URL is built using `URLSearchParams` with conditional param setting. The mapping is: `teamLogo` → `logo`, `subtitle || teamName` → `subtitle`. All other params pass through directly.
- LEARNING: Task 3 modifies THREE locations in output.html: (1) line ~13478 for clip-playback, (2) line ~13539 for moment-replay, (3) line ~6880 for optimistic advance. All three need the same conditional: `if (data.overlayStyle === 'who-to-watch') { clipOverlay.classList.remove('visible'); } else { updateClipOverlay(data); }`
- LEARNING: Task 4 wraps the graphic picker block (lines 8113-8165) in a conditional. The type-specific editors (PlayoutRulesEditor, ContentSequenceEditor, WhoToWatchEditor) are at lines 8516-8555, well outside the wrapped block, so they render normally.
- LEARNING: Task 5 follows the title card pattern for adjustment params. Key change: `.wtw-stat` now uses `--meet-content-bg` with fallback to `--meet-header-bg` so `accentColor` can control stat text independently from the header bar background.
- LEARNING: Task 6 adds `LowerThirdIframePreview` component (line ~366) following `TitleCardIframePreview` pattern. Key differences: (1) dark background div behind iframe since overlay is transparent, (2) accepts `adjustments` prop object for future Task 7, (3) maps subtitle/teamName fallback in URL params. The iframe uses `/overlays/who-to-watch.html` with query params.
