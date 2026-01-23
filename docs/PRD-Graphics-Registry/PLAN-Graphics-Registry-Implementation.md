# PLAN-Graphics-Registry-Implementation

**PRD:** PRD-Graphics-Registry
**Status:** IN PROGRESS
**Created:** 2026-01-22
**Last Updated:** 2026-01-22

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
| DEPLOY | NOT STARTED | Build and deploy to production |
| VERIFY | NOT STARTED | Verify all pickers show correct graphics |

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

**Status:** NOT STARTED
**File:** N/A

**Description:**
Build the frontend and deploy to production.

**Checklist:**
- [ ] Run `cd show-controller && npm run build`
- [ ] No build errors
- [ ] Deploy to commentarygraphic.com per CLAUDE.md

---

#### Task VERIFY: Verify on production

**Status:** NOT STARTED
**File:** N/A

**Description:**
Verify all functionality works on production.

**Checklist:**
- [ ] Open URL Generator - all graphics appear
- [ ] In-Meet section visible with Replay
- [ ] Producer View shows dynamic team names (e.g., "UCLA Coaches")
- [ ] Graphics Manager page loads at /graphics-manager
- [ ] All graphics in manager, grouped by category
- [ ] No console errors

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

## Completion Criteria

All tasks marked COMPLETE and all acceptance criteria verified = PRD Status → COMPLETE
