# PLAN-Rundown-01-EditorPrototype-Implementation

**PRD:** PRD-Rundown-01-EditorPrototype
**Status:** IN PROGRESS
**Created:** 2026-01-22
**Last Updated:** 2026-01-23 (Task 2.2 complete)

---

## Task Summary

### Phase 0A: Basic Page Structure (COMPLETE)

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Create RundownEditorPage.jsx | COMPLETE | Created with all required structure |
| 1.2 Add route to App.jsx | COMPLETE | Route added inside /:compId group |
| 1.3 Implement page header | COMPLETE | Header with title, compId, Save/Export buttons |
| 1.4 Implement toolbar | COMPLETE | All 4 buttons + filter + search |
| 1.5 Implement split panel layout | COMPLETE | 60/40 split with flexbox |
| 1.6 Add hardcoded test data | COMPLETE | DUMMY_SEGMENTS with 7 items |
| 1.7 Implement filter & search | COMPLETE | Type filter + search query filtering |
| 1.8 Add placeholder components | COMPLETE | SegmentDetailPanel inline component |
| 1.9 Wire up event handlers | COMPLETE | All handlers implemented |
| 1.10 Add toast notifications | COMPLETE | Simple toast system with 3s timeout |
| 1.11 Verify Phase 0A acceptance criteria | COMPLETE | All 9 criteria verified on production |

### Phase 0B: Graphics & Scene Integration (CURRENT)

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Add competition context data | COMPLETE | DUMMY_COMPETITION, DUMMY_SCENES constants added |
| 2.2 Implement Scene picker dropdown | PENDING | Grouped by category (static, manual, graphics, single, multi) |
| 2.3 Implement Graphic picker dropdown | PENDING | Reads from graphicsRegistry.js |
| 2.4 Filter graphics by competition type | PENDING | Use getAllGraphicsForCompetition() |
| 2.5 Display team names in graphic options | PENDING | "UCLA Coaches" not "Team 1 Coaches" |
| 2.6 Implement smart recommendations | PENDING | Suggest graphics based on segment name keywords |
| 2.7 Add "Use" button for recommendations | PENDING | One-click apply recommended graphic |
| 2.8 Implement parameter inputs | PENDING | Dynamic form fields from graphic schema |
| 2.9 Update segment save with graphic structure | PENDING | Save `graphic: { graphicId, params }` |
| 2.10 Add graphic indicator to segment list | PENDING | Icon/badge when graphic assigned |
| 2.11 Verify Phase 0B acceptance criteria | PENDING | All 11 criteria from PRD |

---

## Detailed Tasks

### Task 1.1: Create RundownEditorPage.jsx

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Create the main RundownEditorPage component file with basic structure and imports.

**Checklist:**
- [x] Create file at `show-controller/src/pages/RundownEditorPage.jsx`
- [x] Add React imports
- [x] Add useParams hook for compId
- [x] Add useState hooks for all state variables
- [x] Export default component

---

### Task 1.2: Add route to App.jsx

**Status:** COMPLETE
**File:** `show-controller/src/App.jsx`

**Description:**
Add the route for the Rundown Editor page.

**Checklist:**
- [x] Import RundownEditorPage component
- [x] Add route: `<Route path="rundown" element={<RundownEditorPage />} />` (inside /:compId group)
- [x] Verify route is inside the Router

---

### Task 1.3: Implement page header

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add the header section with title, competition name, and action buttons.

**Checklist:**
- [x] Add header container with flex layout
- [x] Display "RUNDOWN EDITOR" title
- [x] Display competition name placeholder (use compId for now)
- [x] Add Save button (non-functional, shows toast)
- [x] Add Export CSV button (non-functional, shows toast)

---

### Task 1.4: Implement toolbar

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add the toolbar section with action buttons and filter controls.

**Checklist:**
- [x] Add toolbar container
- [x] Add "+ Add Segment" button
- [x] Add "Templates" dropdown button (placeholder)
- [x] Add "Import CSV" button (placeholder)
- [x] Add "Sync OBS" button (placeholder)
- [x] Add type filter dropdown with all 7 options
- [x] Add search input field

---

### Task 1.5: Implement split panel layout

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Create the main content area with split panel design.

**Checklist:**
- [x] Add main content container with flex layout
- [x] Create left panel (~60% width) for SegmentList
- [x] Create right panel (~40% width) for SegmentDetail
- [x] Ensure responsive behavior

---

### Task 1.6: Add hardcoded test data

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add the DUMMY_SEGMENTS constant with test data.

**Checklist:**
- [x] Add DUMMY_SEGMENTS array with 7 segments
- [x] Each segment has: id, name, type, duration, scene, autoAdvance
- [x] Initialize segments state with DUMMY_SEGMENTS

---

### Task 1.7: Implement filter & search

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Implement filtering logic for type and search.

**Checklist:**
- [x] Add filterType state (default: 'all')
- [x] Add searchQuery state (default: '')
- [x] Implement filteredSegments computation
- [x] Wire filter dropdown to filterType state
- [x] Wire search input to searchQuery state

---

### Task 1.8: Add placeholder components

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add placeholder UI for SegmentList and SegmentDetail panels.

**Checklist:**
- [x] Add placeholder SegmentList rendering (list of segment names)
- [x] Add placeholder SegmentDetail panel
- [x] Show "Select a segment to edit" when no selection
- [x] Show basic segment info when segment is selected

---

### Task 1.9: Wire up event handlers

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Implement all event handlers for prototype functionality.

**Checklist:**
- [x] handleSelectSegment(id) - sets selectedSegmentId
- [x] handleMultiSelect(ids) - sets selectedSegmentIds array
- [x] handleReorder(fromIndex, toIndex) - reorders segments in state
- [x] handleAddSegment() - inserts new segment
- [x] handleSaveSegment(segment) - updates segment in state
- [x] handleDeleteSegment(id) - removes segment after confirmation
- [x] handleCancelEdit() - clears selection

---

### Task 1.10: Add toast notifications

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add toast notifications for user feedback.

**Checklist:**
- [x] Check if toast utility exists in codebase (used local state pattern)
- [x] Add "Coming soon" toast for Templates button
- [x] Add "Coming soon" toast for Import CSV button
- [x] Add "Coming soon" toast for Sync OBS button
- [x] Add "Coming soon" toast for Export CSV button
- [x] Add "Rundown saved" toast for Save button
- [x] Add confirmation/success toast for segment operations

---

### Task 1.11: Verify Phase 0A acceptance criteria

**Status:** COMPLETE
**File:** N/A (verification task)

**Description:**
Verify all Phase 0A acceptance criteria from PRD are met.

**Checklist:**
- [x] Route `/{compId}/rundown` renders RundownEditorPage
- [x] Page header shows "RUNDOWN EDITOR" and competition name placeholder
- [x] Toolbar renders with all buttons
- [x] Type filter dropdown shows all 6 segment types + "All Types"
- [x] Search input filters segment list by name
- [x] Split panel layout: SegmentList on left (~60%), SegmentDetail on right (~40%)
- [x] Placeholder text shown in SegmentDetail when no segment selected
- [x] "Coming soon" toast shown for unimplemented features
- [x] Page uses hardcoded DUMMY_SEGMENTS data

**Verification Date:** 2026-01-22
**Production URL:** https://commentarygraphic.com/8kyf0rnl/rundown

---

## Phase 0B Detailed Tasks

### Task 2.1: Add competition context data

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add hardcoded competition and scene data for prototyping.

**Checklist:**
- [x] Add DUMMY_COMPETITION constant with id, name, type, teams object
- [x] Add DUMMY_SCENES array with name and category for each scene
- [x] Scene categories: static, manual, graphics, single, multi
- [x] Include 4 teams for women's quad meet scenario
- [x] Updated DUMMY_SEGMENTS to include graphic field structure
- [x] Updated header to display competition name from DUMMY_COMPETITION

---

### Task 2.2: Implement Scene picker dropdown

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add Scene picker dropdown to SegmentDetail panel.

**Checklist:**
- [x] Add Scene dropdown in SegmentDetail panel
- [x] Group scenes by category with section headers
- [x] Wire selection to segment.scene field
- [x] Show current selection when editing existing segment

**Implementation Notes:**
- Added `SCENE_CATEGORY_LABELS` constant for readable category headers
- Added `getGroupedScenes()` helper function to organize scenes by category
- Used HTML `<optgroup>` for grouped dropdown sections
- Added "(No scene selected)" as first option
- Scene picker has subtle visual distinction with border/background styling

---

### Task 2.3: Implement Graphic picker dropdown

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add Graphic picker dropdown that reads from graphicsRegistry.js.

**Checklist:**
- [ ] Import graphicsRegistry or use getAllGraphicsForCompetition()
- [ ] Add Graphic dropdown in SegmentDetail panel
- [ ] Include "(None)" as first option
- [ ] Group graphics by category with section headers
- [ ] Wire selection to segment.graphic.graphicId field

---

### Task 2.4: Filter graphics by competition type

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Only show graphics valid for the current competition type.

**Checklist:**
- [ ] Pass competition type to graphics filter function
- [ ] Filter out men's-only graphics for women's competitions
- [ ] Filter graphics by team count (dual vs quad)
- [ ] Verify correct graphics appear in dropdown

---

### Task 2.5: Display team names in graphic options

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Show actual team names instead of generic "Team 1", "Team 2".

**Checklist:**
- [ ] Use competition.teams to resolve team names
- [ ] Display "UCLA Coaches" instead of "Team 1 Coaches"
- [ ] Apply to all team-specific graphics in dropdown
- [ ] Maintain teamSlot internally (1, 2, 3, 4) for template compatibility

---

### Task 2.6: Implement smart recommendations

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Suggest graphics based on segment name keywords.

**Checklist:**
- [ ] Create keyword-to-graphic mapping function
- [ ] Match team names + "coaches" → team coaches graphic
- [ ] Match team names + "stats" → team stats graphic
- [ ] Match "logos", "matchup" → logos graphic
- [ ] Match "rotation" + number → event-summary (rotation mode)
- [ ] Match apparatus names → event frame graphics
- [ ] Match "summary", "recap" → event-summary
- [ ] Match "leaderboard", "standings" → leaderboard graphic
- [ ] Display recommendation with lightbulb icon in detail panel

---

### Task 2.7: Add "Use" button for recommendations

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
One-click button to apply recommended graphic.

**Checklist:**
- [ ] Add "Use" button next to recommendation text
- [ ] Clicking sets graphic dropdown to recommended value
- [ ] Auto-populate default params for the graphic
- [ ] Hide recommendation after applying

---

### Task 2.8: Implement parameter inputs

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Show dynamic form fields based on graphic's schema.

**Checklist:**
- [ ] Read param definitions from graphic schema
- [ ] Generate appropriate input for each param type (dropdown, number, text)
- [ ] Show team selector for team-specific graphics (teamSlot param)
- [ ] Show rotation/apparatus selector for event-summary
- [ ] Show theme selector where applicable
- [ ] Hide params section for graphics with no user-editable params
- [ ] Wire inputs to segment.graphic.params object

---

### Task 2.9: Update segment save with graphic structure

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Save segments with proper graphic data structure.

**Checklist:**
- [ ] Update handleSaveSegment to include graphic field
- [ ] Structure: `graphic: { graphicId, params }` or `graphic: null`
- [ ] Preserve existing params when changing other segment fields
- [ ] Validate required params before save

---

### Task 2.10: Add graphic indicator to segment list

**Status:** PENDING
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Show visual indicator when segment has graphic assigned.

**Checklist:**
- [ ] Add icon or badge to segment row when graphic is set
- [ ] Show graphic name on hover (tooltip)
- [ ] Differentiate from segments without graphics
- [ ] Consider showing graphic category icon

---

### Task 2.11: Verify Phase 0B acceptance criteria

**Status:** PENDING
**File:** N/A (verification task)

**Description:**
Verify all Phase 0B acceptance criteria from PRD are met.

**Checklist:**
- [ ] Segment detail shows Scene picker dropdown
- [ ] Scene picker shows hardcoded scenes grouped by category
- [ ] Segment detail shows Graphic picker dropdown
- [ ] Graphic picker reads from graphicsRegistry.js
- [ ] Graphics filtered by competition type (women's quad)
- [ ] Team-specific graphics show actual team names (UCLA, Oregon, etc.)
- [ ] Smart recommendation shown when segment name matches keywords
- [ ] Clicking "Use" on recommendation selects that graphic
- [ ] Parameter inputs shown for graphics that have user-editable params
- [ ] Segments save with `graphic: { graphicId, params }` structure
- [ ] Segment list shows graphic indicator (icon or badge) when graphic assigned

---

## Bugs & Issues

| Bug ID | Description | Status | Task |
|--------|-------------|--------|------|
| (none) | | | |

---

## Notes

- This is a UI prototype phase - no backend/Firebase integration
- SegmentList and SegmentDetail will be proper components in PRD-02 and PRD-03
- For this phase, use inline placeholder components
- Used simple local state toast pattern (matching UrlGeneratorPage.jsx)
- Phase 0B depends on PRD-Graphics-Registry being complete (provides graphicsRegistry.js)
- Smart recommendations use keyword matching - can be refined based on user feedback
- Parameter inputs are dynamically generated from graphic schema definitions

---

## Completion Criteria

**Phase 0A:** All tasks 1.1-1.11 COMPLETE ✅
**Phase 0B:** All tasks 2.1-2.11 COMPLETE (required for PRD completion)

PRD Status → COMPLETE when both Phase 0A and Phase 0B are verified
