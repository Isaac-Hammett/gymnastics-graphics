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
| BUTTONS-MIGRATE | NOT STARTED | Update graphicButtons.js to derive from registry |
| CONTROL-MIGRATE | NOT STARTED | Update GraphicsControl.jsx with dynamic team names |
| URLGEN-INMEET | NOT STARTED | Add In-Meet section to UrlGeneratorPage.jsx |
| URLBUILD-REGISTRY | NOT STARTED | Update urlBuilder.js to use registry |
| MANAGER-ROUTE | NOT STARTED | Add /graphics-manager route to App.jsx |
| MANAGER-PAGE | NOT STARTED | Create GraphicsManagerPage.jsx |
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

#### Task CONTROL-MIGRATE: Update GraphicsControl.jsx

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

#### Task URLGEN-INMEET: Update UrlGeneratorPage.jsx

**Status:** NOT STARTED
**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`

**Description:**
Add missing In-Meet section so replay graphic appears.

**Checklist:**
- [ ] Import `inMeet` or use `getGraphicsByCategory('in-meet')`
- [ ] Add In-Meet section to sidebar
- [ ] Verify replay graphic appears in URL Generator

---

#### Task URLBUILD-REGISTRY: Update urlBuilder.js

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

#### Task MANAGER-ROUTE: Add route for Graphics Manager

**Status:** NOT STARTED
**File:** `show-controller/src/App.jsx`

**Description:**
Add route for the Graphics Manager page.

**Checklist:**
- [ ] Import GraphicsManagerPage
- [ ] Add route: `<Route path="/graphics-manager" element={<GraphicsManagerPage />} />`

---

#### Task MANAGER-PAGE: Create GraphicsManagerPage.jsx

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
