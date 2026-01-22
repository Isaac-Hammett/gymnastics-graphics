# PLAN-Graphics-Registry-Implementation

**PRD:** PRD-Graphics-Registry
**Status:** IN PROGRESS
**Created:** 2026-01-22
**Last Updated:** 2026-01-22

---

## Task Summary

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Create graphicsRegistry.js | COMPLETE | Core registry file with all graphic definitions |
| 1.2 Define pre-meet graphics | COMPLETE | logos, event-bar, warm-up, hosts, team-stats, team-coaches (perTeam) |
| 1.3 Define in-meet graphics | COMPLETE | replay |
| 1.4 Define event-frame graphics | COMPLETE | floor, pommel, rings, vault, pbars, hbar, ubars, beam, allaround, final, order, lineups, summary |
| 1.5 Define frame-overlay graphics | COMPLETE | frame-quad, frame-tri-center, frame-tri-wide, frame-team-header, frame-single, frame-dual |
| 1.6 Define leaderboard graphics | COMPLETE | leaderboard-{fx,ph,sr,vt,pb,hb,ub,bb,aa} |
| 1.7 Define event-summary graphics | COMPLETE | summary-r{1-6}, summary-{fx,ph,sr,vt,pb,hb,ub,bb} |
| 1.8 Define stream graphics | COMPLETE | stream-starting, stream-thanks |
| 1.9 Implement helper functions | COMPLETE | getAllGraphics, getGraphicById, getGraphicsForCompetition, getRecommendedGraphic, isTransparentGraphic |
| 2.1 Update graphicButtons.js | NOT STARTED | Derive from registry for backwards compatibility |
| 2.2 Update GraphicsControl.jsx | NOT STARTED | Use registry with dynamic team names |
| 2.3 Update UrlGeneratorPage.jsx | NOT STARTED | Add In-Meet section |
| 2.4 Update urlBuilder.js | NOT STARTED | Use registry for URL generation |
| 3.1 Add route for Graphics Manager | NOT STARTED | Add /graphics-manager route to App.jsx |
| 3.2 Create GraphicsManagerPage.jsx | NOT STARTED | Admin UI for viewing/configuring all graphics |
| 4.1 Build and deploy | NOT STARTED | Deploy to production |
| 4.2 Verify on production | NOT STARTED | Test all pickers show correct graphics |

---

## Detailed Tasks

### Phase 1: Create Registry (Non-Breaking)

#### Task 1.1: Create graphicsRegistry.js

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Create the core registry file with the GRAPHICS constant and basic structure.

**Checklist:**
- [x] Create file at `show-controller/src/lib/graphicsRegistry.js`
- [x] Add GRAPHICS constant with all ~45 graphic definitions
- [x] Add JSDoc comments explaining the schema
- [x] Export GRAPHICS constant

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

#### Task 1.2: Define pre-meet graphics

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Add all pre-meet graphic definitions to the registry.

**Graphics to define:**
- [x] `logos` - Team Logos (1-6 teams)
- [x] `event-bar` - Event Info bar
- [x] `warm-up` - Warm Up graphic
- [x] `hosts` - Hosts/commentators
- [x] `team-stats` (perTeam: true) - Team statistics
- [x] `team-coaches` (perTeam: true) - Team coaches

---

#### Task 1.3: Define in-meet graphics

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Add in-meet graphic definitions to the registry.

**Graphics to define:**
- [x] `replay` - Instant replay indicator

---

#### Task 1.4: Define event-frame graphics

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Add event frame graphic definitions to the registry.

**Graphics to define:**
- [x] `floor` - Floor Exercise frame
- [x] `pommel` - Pommel Horse frame (mens only)
- [x] `rings` - Still Rings frame (mens only)
- [x] `vault` - Vault frame
- [x] `pbars` - Parallel Bars frame (mens only)
- [x] `hbar` - High Bar frame (mens only)
- [x] `ubars` - Uneven Bars frame (womens only)
- [x] `beam` - Balance Beam frame (womens only)
- [x] `allaround` - All Around frame
- [x] `final` - Final Scores frame
- [x] `order` - Competition Order frame
- [x] `lineups` - Next Event Lineups frame
- [x] `summary` - Event Summary frame

---

#### Task 1.5: Define frame-overlay graphics

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Add frame overlay graphic definitions to the registry.

**Graphics to define:**
- [x] `frame-quad` - Quad view frame
- [x] `frame-tri-center` - Tri center frame
- [x] `frame-tri-wide` - Tri wide frame
- [x] `frame-team-header` - Team header dual frame
- [x] `frame-single` - Single frame
- [x] `frame-dual` - Dual view frame

---

#### Task 1.6: Define leaderboard graphics

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Add leaderboard graphic definitions to the registry.

**Graphics to define (perEvent: true pattern):**
- [x] `leaderboard-fx` - Floor leaderboard
- [x] `leaderboard-ph` - Pommel Horse leaderboard (mens only)
- [x] `leaderboard-sr` - Still Rings leaderboard (mens only)
- [x] `leaderboard-vt` - Vault leaderboard
- [x] `leaderboard-pb` - Parallel Bars leaderboard (mens only)
- [x] `leaderboard-hb` - High Bar leaderboard (mens only)
- [x] `leaderboard-ub` - Uneven Bars leaderboard (womens only)
- [x] `leaderboard-bb` - Balance Beam leaderboard (womens only)
- [x] `leaderboard-aa` - All Around leaderboard

---

#### Task 1.7: Define event-summary graphics

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Add event summary graphic definitions to the registry.

**Graphics to define:**
- [x] `summary-r1` through `summary-r6` - Rotation summaries (r5, r6 are mens only)
- [x] `summary-fx`, `summary-ph`, `summary-sr`, `summary-vt`, `summary-pb`, `summary-hb`, `summary-ub`, `summary-bb` - Apparatus summaries (with gender filtering)

---

#### Task 1.8: Define stream graphics

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Add stream graphic definitions to the registry.

**Graphics to define:**
- [x] `stream-starting` - Stream Starting Soon
- [x] `stream-thanks` - Thanks for Watching

---

#### Task 1.9: Implement helper functions

**Status:** COMPLETE
**File:** `show-controller/src/lib/graphicsRegistry.js`

**Description:**
Implement all helper functions for working with the registry.

**Functions to implement:**
- [x] `getAllGraphics()` - Returns flat array of all graphics
- [x] `getGraphicById(id)` - Returns single graphic definition
- [x] `getGraphicsByCategory(category)` - Returns graphics for a category
- [x] `getCategories()` - Returns all unique categories
- [x] `isGraphicAvailable(graphic, compType, teamCount)` - Check if graphic is available
- [x] `getGraphicsForCompetition(compType, teamNames)` - Returns filtered/expanded list with dynamic labels
- [x] `getRecommendedGraphic(segmentName, compType, teamNames)` - Smart recommendation with confidence score
- [x] `isTransparentGraphic(graphicId)` - Check if graphic should be transparent

Note: `buildGraphicUrl` deferred to urlBuilder.js integration (Task 2.4)

---

### Phase 2: Migrate Existing Files

#### Task 2.1: Update graphicButtons.js

**Status:** NOT STARTED
**File:** `show-controller/src/lib/graphicButtons.js`

**Description:**
Make graphicButtons.js derive from registry for backwards compatibility.

**Checklist:**
- [ ] Import from graphicsRegistry.js
- [ ] Derive `graphicNames` from registry
- [ ] Update `getPreMeetButtons` to delegate to registry
- [ ] Update `getApparatusButtons` to delegate to registry
- [ ] Keep all existing exports working

---

#### Task 2.2: Update GraphicsControl.jsx

**Status:** NOT STARTED
**File:** `show-controller/src/components/GraphicsControl.jsx`

**Description:**
Remove hardcoded `baseGraphicButtons` and use registry with dynamic team names.

**Checklist:**
- [ ] Import from graphicsRegistry.js
- [ ] Remove hardcoded `baseGraphicButtons` array
- [ ] Use `getGraphicsForCompetition()` with team names from config
- [ ] Verify "UCLA Coaches" shows instead of "Team 1 Coaches"

---

#### Task 2.3: Update UrlGeneratorPage.jsx

**Status:** NOT STARTED
**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`

**Description:**
Add missing In-Meet section so replay graphic appears.

**Checklist:**
- [ ] Import `inMeet` or use `getGraphicsByCategory('in-meet')`
- [ ] Add In-Meet section to sidebar
- [ ] Verify replay graphic appears in URL Generator

---

#### Task 2.4: Update urlBuilder.js

**Status:** NOT STARTED
**File:** `show-controller/src/lib/urlBuilder.js`

**Description:**
Refactor to use registry schema for URL generation.

**Checklist:**
- [ ] Import from graphicsRegistry.js
- [ ] Add `buildGraphicUrlFromRegistry()` function
- [ ] Gradually migrate switch/case to registry-based

---

### Phase 3: Create Graphics Manager

#### Task 3.1: Add route for Graphics Manager

**Status:** NOT STARTED
**File:** `show-controller/src/App.jsx`

**Description:**
Add route for the Graphics Manager page.

**Checklist:**
- [ ] Import GraphicsManagerPage
- [ ] Add route: `<Route path="/graphics-manager" element={<GraphicsManagerPage />} />`

---

#### Task 3.2: Create GraphicsManagerPage.jsx

**Status:** NOT STARTED
**File:** `show-controller/src/pages/GraphicsManagerPage.jsx`

**Description:**
Create admin UI for viewing/configuring all graphics.

**Features:**
- [ ] List all graphics grouped by category
- [ ] Show id, label, gender, renderer for each graphic
- [ ] Filter by category, gender, renderer type
- [ ] Search by id or label
- [ ] Preview button to test graphic

---

### Phase 4: Deploy & Verify

#### Task 4.1: Build and deploy

**Status:** NOT STARTED
**File:** N/A

**Description:**
Build the frontend and deploy to production.

**Checklist:**
- [ ] Run `cd show-controller && npm run build`
- [ ] No build errors
- [ ] Deploy to commentarygraphic.com per CLAUDE.md

---

#### Task 4.2: Verify on production

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
