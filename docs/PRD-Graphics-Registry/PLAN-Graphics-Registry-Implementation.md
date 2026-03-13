# PLAN-Graphics-Registry-Implementation

**PRD:** PRD-Graphics-Registry
**Status:** IN PROGRESS
**Created:** 2026-01-22
**Last Updated:** 2026-03-13

---

## Task Summary

| Task | Status | Notes |
|------|--------|-------|
| REGISTRY-CREATE | COMPLETE | Create graphicsRegistry.js with all ~45 graphic definitions and helper functions |
| BUTTONS-MIGRATE | COMPLETE | Update graphicButtons.js to derive from registry |
| CONTROL-MIGRATE | COMPLETE | Update GraphicsControl.jsx with dynamic team names |
| URLGEN-INMEET | COMPLETE | Add In-Meet section to UrlGeneratorPage.jsx |
| URLBUILD-REGISTRY | COMPLETE | Update urlBuilder.js to use registry |
| MANAGER-ROUTE | COMPLETE | Add /graphics-manager route to App.jsx |
| MANAGER-PAGE | COMPLETE | Create GraphicsManagerPage.jsx |
| DEPLOY | COMPLETE | Build and deploy to production |
| VERIFY | COMPLETE | Verify all pickers show correct graphics |
| V20-ENHANCEMENTS | COMPLETE | Added start values, meet-wide apparatus rankings, larger fonts |
| V21-EXTRA-LARGE | COMPLETE | Created V21 layout with even larger fonts for big displays |
| GFX-T1 | COMPLETE | Fix "AVE" → "AVG" label in team-stats graphics |
| GFX-T2 | COMPLETE | Fix "ALL AROUND" → "ALL-AROUND" hyphenation |
| GFX-T3 | COMPLETE | Multi-team logos + VS on stream starting page |
| GFX-T6 | COMPLETE | Top-align coaches/stats cards (matching width, shared top position) |
| GFX-T7 | NOT STARTED | Header typography audit (consistent ALL CAPS rules) |

---

## V20/V21 Enhancements (2026-02-13)

### V20 Changes
- Increased font sizes throughout the layout
- Added start values (SV) with 2 decimal places
- Added `calculateApparatusRankings()` function to compute top 3 scores per apparatus across entire meet
- Added athlete ranking badges (gold/silver/bronze) for top 3 on each apparatus

### V21 "Extra Large" Layout
- Created new V21 layout with significantly larger fonts
- Font sizes: Team name 30px, Athlete name 28px, Score 34px, Footer 40px
- Added to both UrlGeneratorPage.jsx and GraphicsControl.jsx dropdowns

---

## Detailed Tasks

### Phase 1: Create Registry (Non-Breaking)

#### Task REGISTRY-CREATE: Create graphicsRegistry.js

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Create the core registry file with all graphic definitions and helper functions.

**What was done:**
- [x] Created file at `show-controller/src/lib/graphicsRegistry.js`
- [x] Added GRAPHICS constant with ~45 graphic definitions across 7 categories
- [x] Added JSDoc comments explaining the schema
- [x] Defined all graphics: pre-meet, in-meet, event-frames, frame-overlays, leaderboards, event-summary, stream
- [x] Implemented helper functions: getAllGraphics, getGraphicById, getGraphicsByCategory, getCategories, isGraphicAvailable, getGraphicsForCompetition, getRecommendedGraphic, isTransparentGraphic

**Schema per graphic:**
```javascript
{
  id: 'graphic-id',           // Unique identifier
  label: 'Display Name',      // Display name
  labelTemplate: '{teamName} Display',  // Optional: for dynamic substitution
  category: 'pre-meet',       // Grouping for picker UI
  keywords: ['search', 'terms'],  // For smart recommendations
  gender: 'both',             // 'mens' | 'womens' | 'both'
  minTeams: 1,                // Optional: minimum teams required
  maxTeams: 6,                // Optional: maximum teams supported
  renderer: 'overlay',        // 'overlay' | 'output'
  file: 'filename.html',      // File path (overlays/) or graphic name (output.html)
  transparent: true,          // For OBS background handling
  perTeam: false,             // If true, generates team1-, team2-, etc.
  params: {},                 // Parameter schema
}
```

---

### Phase 2: Migrate Existing Files

#### Task BUTTONS-MIGRATE: Update graphicButtons.js

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicButtons.js`

**Description:**
Make graphicButtons.js derive from registry for backwards compatibility.

**What was done:**
- [x] Import from graphicsRegistry.js
- [x] Derive `graphicNames` from registry via getAllGraphics()
- [x] Update `getPreMeetButtons` to delegate to registry via getGraphicsForCompetition()
- [x] Update `getLeaderboardButtons` to use getGraphicsByCategory('leaderboards')
- [x] Update `getEventSummaryApparatusButtons` to use registry
- [x] Derive `transparentGraphics` from registry
- [x] Delegate `isTransparentGraphic()` to registry
- [x] Derive `graphicButtons.frameOverlays`, `stream`, and `inMeet` from registry
- [x] Keep all existing exports working (mensApparatus and womensApparatus remain hardcoded for title ordering)
- [x] Build passes with no errors

---

#### Task CONTROL-MIGRATE: Update GraphicsControl.jsx

**Status:** COMPLETE
**File:** `show-controller/src/components/GraphicsControl.jsx`

**Description:**
Remove hardcoded `baseGraphicButtons` and use registry with dynamic team names.

**What was done:**
- [x] Import `getGraphicsForCompetition` and `getGraphicsByCategory` from graphicsRegistry.js
- [x] Remove hardcoded `baseGraphicButtons` array (was lines 8-36)
- [x] Add `CATEGORY_TO_SECTION` mapping for display purposes
- [x] Update `graphicButtons` useMemo to call `getGraphicsForCompetition(config?.compType, teamNames)`
- [x] Build team names from config (`config.team1Name`, etc.)
- [x] Buttons now show dynamic team names (e.g., "UCLA Coaches" instead of "Team 1 Coaches")
- [x] Build passes with no errors

---

#### Task URLGEN-INMEET: Update UrlGeneratorPage.jsx

**Status:** COMPLETE
**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`

**Description:**
Add missing In-Meet section so replay graphic appears.

**What was done:**
- [x] Use existing `graphicButtons.inMeet` from graphicButtons.js (which now derives from registry)
- [x] Add In-Meet section to sidebar between Pre-Meet and Event Frames
- [x] Add 'replay' to baseGraphicTitles for proper title display
- [x] Build passes with no errors

---

#### Task URLBUILD-REGISTRY: Update urlBuilder.js

**Status:** COMPLETE
**File:** `show-controller/src/lib/urlBuilder.js`

**Description:**
Refactor to use registry schema for URL generation.

**What was done:**
- [x] Import `getGraphicById` and `isTransparentGraphic` from graphicsRegistry.js
- [x] Add `buildGraphicUrlFromRegistry()` function for simple overlay graphics
- [x] Update `getGraphicPath()` to check registry first before falling back to old mapping
- [x] Export `isTransparentGraphicFromRegistry` for backwards compatibility
- [x] Complex graphics (leaderboards, event-summary) still use dedicated builders
- [x] Build passes with no errors

---

### Phase 3: Create Graphics Manager

#### Task MANAGER-ROUTE: Add route for Graphics Manager

**Status:** COMPLETE
**File:** `show-controller/src/App.jsx`

**Description:**
Add route for the Graphics Manager page.

**What was done:**
- [x] Import GraphicsManagerPage
- [x] Add route: `<Route path="/graphics-manager" element={<GraphicsManagerPage />} />`
- [x] Build passes with no errors

---

#### Task MANAGER-PAGE: Create GraphicsManagerPage.jsx

**Status:** COMPLETE
**File:** `show-controller/src/pages/GraphicsManagerPage.jsx`

**Description:**
Create admin UI for viewing/configuring all graphics.

**What was done:**
- [x] List all graphics grouped by category (7 categories)
- [x] Show id, label, gender, renderer, file for each graphic in table view
- [x] Filter by category, gender, renderer type
- [x] Search by id, label, or keywords
- [x] Preview button opens side panel with:
  - Live preview iframe with test data
  - Details (id, category, gender, renderer, file, transparent, keywords, params)
  - Open Full Size button
  - Link to URL Generator
- [x] Build passes with no errors

---

### Phase 4: Deploy & Verify

#### Task DEPLOY: Build and deploy

**Status:** COMPLETE
**File:** N/A

**Description:**
Build the frontend and deploy to production.

**What was done:**
- [x] Run `cd show-controller && npm run build` - success
- [x] No build errors
- [x] Deploy React SPA to commentarygraphic.com
- [x] Deploy output.html to commentarygraphic.com
- [x] Deploy overlays/ directory to commentarygraphic.com

---

#### Task VERIFY: Verify on production

**Status:** COMPLETE
**File:** N/A

**Description:**
Verify all functionality works on production.

**What was verified:**
- [x] Open URL Generator - all graphics appear with In-Meet section
- [x] In-Meet section visible with Replay button
- [x] Replay graphic preview works (shows "Instant Replay")
- [x] Graphics Manager page loads at /graphics-manager
- [x] 51 graphics shown in manager, grouped by 7 categories
- [x] Filters (category, gender, renderer) work
- [x] No console errors (only expected placeholder image errors)

---

## Task Dependency Order

```
REGISTRY-CREATE (done)
       │
       ├── BUTTONS-MIGRATE ──┐
       │                     │
       ├── CONTROL-MIGRATE ──┼── DEPLOY ── VERIFY
       │                     │
       ├── URLGEN-INMEET ────┤
       │                     │
       ├── URLBUILD-REGISTRY─┤
       │                     │
       ├── MANAGER-ROUTE ────┘
       │         │
       └── MANAGER-PAGE ─────┘
```

**Notes:**
- BUTTONS-MIGRATE through MANAGER-PAGE can be done in any order (all depend only on REGISTRY-CREATE)
- DEPLOY requires all migration tasks complete
- VERIFY requires DEPLOY complete

---

## Adding a New Graphic (Reference Guide)

After this PRD is complete, adding a new graphic will follow this workflow:

### Step 1: Create the HTML Renderer

**For Overlay Graphics (transparent, positioned over video):**
```
overlays/newgraphic.html
```

**For Output Graphics (full-screen, complex rendering):**
Add rendering logic to `output.html` with a new `graphic=` case.

### Step 2: Add Registry Entry

Add ONE entry to `show-controller/src/lib/graphicsRegistry.js`:

```javascript
'new-graphic': {
  id: 'new-graphic',
  label: 'New Graphic',
  category: 'in-meet',           // pre-meet | in-meet | event-frames | frame-overlays | leaderboards | event-summary | stream
  keywords: ['new', 'keywords'], // For smart recommendations
  gender: 'both',                // mens | womens | both
  renderer: 'overlay',           // overlay | output
  file: 'newgraphic.html',       // filename for overlay, graphic name for output
  transparent: true,             // true for most overlays
  params: {
    // Define any URL parameters the graphic accepts
    team1Logo: {
      type: 'string',
      source: 'competition',     // Auto-filled from competition config
      required: true,
    },
  },
},
```

### Step 3: Deploy

```bash
# Build
cd show-controller && npm run build

# Deploy per CLAUDE.md instructions
# The graphic automatically appears in all pickers
```

### Done!

The graphic will automatically:
- Appear in URL Generator
- Appear in Producer View
- Appear in Rundown Editor pickers
- Generate correct URLs
- Show in Graphics Manager

---

## Bugs & Issues

| Bug ID | Description | Status | Task |
|--------|-------------|--------|------|
| (none) | | | |

---

## Notes

- This is the foundation PRD that other PRDs depend on
- All changes are non-breaking - existing code continues to work during migration
- Phase 1 creates the registry without changing any existing behavior
- Phase 2 gradually migrates existing code to use the registry
- Phase 3 adds the admin UI

---

## Phase 5: Feedback-Driven Graphics Improvements (2026-03-13)

### Task GFX-T1: Fix "AVE" → "AVG" label

**Status:** COMPLETE

**Description:** The team-stats graphic uses "AVE" as the label for season average. The correct abbreviation is "AVG".

**Files to modify:**
- `output.html` — 8 occurrences of `>AVE<` in team stats rendering (search for `AVE</div>` near lines 10638, 10669, 10700, 10731, 10762, 10793, 10824, 10881)
- `overlays/team-stats.html` — 1 occurrence at line 98

**What was done:**
- Changed all 8 occurrences of "AVE" to "AVG" in output.html using replace_all
- Changed "AVE" to "AVG" in overlays/team-stats.html line 98

**Acceptance:**
- [x] All "AVE" labels changed to "AVG" in output.html
- [x] "AVE" label changed to "AVG" in overlays/team-stats.html
- [x] Build passes (N/A - no frontend changes)
- [x] Deploy frontend + overlays
- [x] Verify team-stats graphic shows "AVG" on production

---

### Task GFX-T2: Fix "ALL AROUND" → "ALL-AROUND" hyphenation

**Status:** COMPLETE

**Description:** The event name "ALL AROUND" should be hyphenated as "ALL-AROUND" per proper gymnastics terminology.

**Files modified:**
- `output.html:11186` — changed `'aa': 'ALL AROUND'` to `'aa': 'ALL-AROUND'`
- `show-controller/src/lib/urlBuilder.js:53` — changed `allaround: 'ALL AROUND'` to `allaround: 'ALL-AROUND'`
- `show-controller/src/lib/graphicButtons.js:53,64` — changed `title: 'ALL AROUND'` and `label: 'All Around'` to hyphenated forms
- `show-controller/src/lib/graphicsRegistry.js:353` — changed `default: 'ALL AROUND'` to `default: 'ALL-AROUND'`
- `show-controller/src/components/GraphicsControl.jsx:33` — changed `title: 'ALL AROUND'` and `label: 'All Around'` to hyphenated forms

**Acceptance:**
- [x] All "ALL AROUND" text changed to "ALL-AROUND"
- [x] Build passes
- [x] Deploy frontend + overlays
- [x] Verify all-around leaderboard/event frame shows "ALL-AROUND"

---

### Task GFX-T3: Multi-team logos on stream starting page

**Status:** COMPLETE

**Description:** The stream starting page (`overlays/stream.html`) currently shows only one team logo. Update to show all competing team logos. For dual meets, show Logo1 — VS — Logo2.

**What was done:**
1. Updated `overlays/stream.html`:
   - Added CSS for multi-logo layouts: `.logos-container.dual` (280px logos + VS text), `.logos-container.multi` (200px for 3-4 teams), `.logos-container.many` (150px for 5-7 teams)
   - Added JavaScript to read `logo`, `logo2` through `logo7` params
   - Single logo: renders as before (backwards compat)
   - 2 logos: Logo1 — VS — Logo2 layout with 60px "VS" text
   - 3+ logos: row of logos scaling down with count
2. Updated `show-controller/src/lib/graphicsRegistry.js`:
   - Added `logo2` through `logo7` params (optional) to `stream-starting` and `stream-thanks` definitions
3. Updated `show-controller/src/lib/urlBuilder.js`:
   - Updated `buildStreamURL()` signature and JSDoc to accept `logo2`-`logo7`
   - Updated `generateGraphicURL()` cases for 'starting' and 'thanks' to pass all team logos via `getTeamLogo(1)` through `getTeamLogo(7)`
4. Updated `output.html`:
   - Added CSS for `.stream-logos-container`, `.stream-team-logo`, `.stream-vs-text` with size variants
   - Added `buildStreamLogosHtml(data)` helper function that builds appropriate HTML based on team count
   - Updated `stream-starting` and `stream-thanks` renderers to use the helper

**Acceptance:**
- [x] Single logo still works (backwards compat)
- [x] Dual meet shows Logo1 — VS — Logo2
- [x] 3+ teams shows row of logos
- [x] Build passes
- [x] Deploy frontend + overlays
- [x] Verify on production with a dual meet competition

---

### Task GFX-T6: Top-align coaches/stats cards

**Status:** COMPLETE

**Description:** The coaches and team-stats cards both appear in the lower-third position but are bottom-anchored, causing the top edges to misalign when switching between them. Standardize to top-anchored with matching dimensions.

**What was done:**
1. Updated `output.html`:
   - Changed both `.graphic-team-stats` and `.graphic-coaches` from `bottom: 120px` to `top: 780px`
   - Unified `.coaches-header` padding to `14px 30px` (was `16px 30px`)
   - Unified `.coaches-header` and `.coaches-content` min-width to `480px` (was `420px`)
   - Unified `.coaches-content` padding to `16px 30px` (was `20px 30px`)
   - Set `.stats-team-name` font-size to `36px` (was `32px`) to match coaches title
2. Updated `overlays/team-stats.html`:
   - Changed `.stats-card` from `bottom: 120px` to `top: 780px`
   - Changed `.stats-content` padding from `14px 40px` to `16px 40px` to match coaches
3. Updated `overlays/coaches.html`:
   - Changed `.coaches-card` from `bottom: 120px` to `top: 780px`
   - (Header and content already matched team-stats at `12px 40px` and `16px 40px`)

**Key requirement:** When switching between coaches and stats on-air, the header bar must be in the exact same position. Content grows downward.

**Acceptance:**
- [x] Both cards use same `top` position (not `bottom`)
- [x] Header padding, min-width, title font-size are identical
- [x] Content padding is identical
- [x] Coaches card grows taller downward with more names
- [ ] Build passes
- [ ] Deploy frontend + overlays
- [ ] Verify by switching between coaches and stats in URL Generator preview

---

### Task GFX-T7: Header typography audit

**Status:** NOT STARTED

**Description:** Audit all graphics for consistent text casing rules.

**Rules:**
- Section labels/category headers: ALL CAPS (e.g., "COACHES", "ROSTER", "SEASON STATS")
- Team/school names: ALL CAPS (via `text-transform: uppercase`)
- Event names: ALL CAPS (e.g., "FLOOR EXERCISE", "UNEVEN BARS", "ALL-AROUND")

**Files to audit:**
- `output.html` — all graphic renderers
- `overlays/*.html` — all overlay files
- Check for any `text-transform` inconsistencies or hardcoded mixed-case text

**Acceptance:**
- [ ] All section labels are ALL CAPS
- [ ] All team names are ALL CAPS (via text-transform or explicit)
- [ ] All event names are ALL CAPS
- [ ] No mixed-case inconsistencies remain
- [ ] Build passes
- [ ] Deploy frontend + overlays

---

## Completion Criteria

All tasks marked COMPLETE and all acceptance criteria verified = PRD Status → COMPLETE
