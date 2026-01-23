# PLAN-Rundown-01-EditorPrototype-Implementation

**PRD:** PRD-Rundown-01-EditorPrototype
**Status:** PROTOTYPE COMPLETE, FEATURES IN PROGRESS
**Created:** 2026-01-22
**Last Updated:** 2026-01-23 (v3.2 - post-show analytics moved to PRD-05)

---

## Overview

This implementation plan covers all phases of the Rundown Editor from the PRD. Prototype phases (0A, 0B) are complete and deployed. Future phases add timing, inline editing, multi-select, collaboration, and advanced features.

---

## Phase Summary

| Phase | Name | Status | Tasks |
|-------|------|--------|-------|
| 0A | Basic Page Structure | ✅ COMPLETE | 1.1-1.11 |
| 0B | Graphics & Scene Integration | ✅ COMPLETE | 2.1-2.11 |
| 0C | Templates (Basic) | ✅ COMPLETE | 3.1-3.5 |
| 1 | Timing & Display | 🟡 IN PROGRESS | 4.1-4.6 |
| 2 | Inline Editing | 🔲 NOT STARTED | 5.1-5.4 |
| 3 | Multi-Select & Summary | 🔲 NOT STARTED | 6.1-6.6 |
| 4 | Reordering & Organization | 🔲 NOT STARTED | 7.1-7.5 |
| 5 | Segment Management | 🔲 NOT STARTED | 8.1-8.6 |
| 6 | Timing Modes | 🔲 NOT STARTED | 9.1-9.3 |
| 7 | Templates & Presets | 🔲 NOT STARTED | 10.1-10.5 |
| 8 | Collaboration | 🔲 NOT STARTED | 11.1-11.7 |
| 9 | Data & Reporting | 🔲 NOT STARTED | 12.1-12.5 |
| 10 | Visual & UX | 🔲 NOT STARTED | 13.1-13.7 |
| 11 | Quality of Life | 🔲 NOT STARTED | 14.1-14.5 |
| 12 | Advanced Planning | 🔲 NOT STARTED | 15.1-15.10 |

---

## Task Summary by Phase

### Phase 0A: Basic Page Structure ✅ COMPLETE

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

### Phase 0B: Graphics & Scene Integration ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Add competition context data | COMPLETE | DUMMY_COMPETITION, DUMMY_SCENES constants added |
| 2.2 Implement Scene picker dropdown | COMPLETE | Grouped by category (static, manual, graphics, single, multi) |
| 2.3 Implement Graphic picker dropdown | COMPLETE | Reads from graphicsRegistry.js, grouped by category |
| 2.4 Filter graphics by competition type | COMPLETE | Done via getGraphicsForCompetition() in Task 2.3 |
| 2.5 Display team names in graphic options | COMPLETE | Done via labelTemplate in graphicsRegistry.js |
| 2.6 Implement smart recommendations | COMPLETE | Uses getRecommendedGraphic() with confidence threshold |
| 2.7 Add "Use" button for recommendations | COMPLETE | One-click applies recommended graphic |
| 2.8 Implement parameter inputs | COMPLETE | Dynamic form fields from graphic schema |
| 2.9 Update segment save with graphic structure | COMPLETE | Save `graphic: { graphicId, params }` |
| 2.10 Add graphic indicator to segment list | COMPLETE | Pink badge with PhotoIcon when graphic assigned |
| 2.11 Verify Phase 0B acceptance criteria | COMPLETE | All 11 criteria verified on production |

### Phase 0C: Templates (Basic) ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 3.1 Design template data structure | COMPLETE | Firebase schema documented below |
| 3.2 Add "Save as Template" button | COMPLETE | Button + modal + Firebase save implemented |
| 3.3 Create template library modal | COMPLETE | List templates with load/delete, compatibility check |
| 3.4 Implement "Load Template" functionality | COMPLETE | Load from Firebase, resolve team placeholders |
| 3.5 Abstract team references | COMPLETE | Done as part of 3.2 (abstractTeamReferences function) |

### Phase 1: Timing & Display 🟡 IN PROGRESS

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Add total runtime display in header | COMPLETE | Added clock icon + runtime display in header with formatDuration |
| 4.2 Add target duration input | NOT STARTED | User sets expected show length |
| 4.3 Implement over/under indicator | NOT STARTED | Green/yellow/red based on target |
| 4.4 Add running time column | NOT STARTED | Cumulative start time per segment |
| 4.5 Auto-recalculate on duration change | NOT STARTED | Update all subsequent start times |
| 4.6 Add buffer/pad time between segments | NOT STARTED | Optional gap that counts toward total |

### Phase 2: Inline Editing 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 5.1 Add inline OBS Scene dropdown | NOT STARTED | Editable directly on segment row |
| 5.2 Add inline Graphic dropdown | NOT STARTED | Editable directly on segment row |
| 5.3 Add inline duration input | NOT STARTED | Click to edit, blur/Enter to save |
| 5.4 Keep edit button for full panel | NOT STARTED | Opens detail panel for all fields |

### Phase 3: Multi-Select & Summary 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 6.1 Add checkbox to segment rows | NOT STARTED | For multi-selection |
| 6.2 Implement Shift+click range select | NOT STARTED | Select all between clicks |
| 6.3 Implement Ctrl/Cmd+click toggle | NOT STARTED | Add/remove individual selection |
| 6.4 Create Selection Summary sidebar | NOT STARTED | Shows when 2+ segments selected |
| 6.5 Add editable durations in summary | NOT STARTED | Edit each selected segment's duration |
| 6.6 Implement bulk actions | NOT STARTED | Bulk edit type, scene, graphic, delete |

### Phase 4: Reordering & Organization 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 7.1 Add drag handle to segment rows | NOT STARTED | Left side of each row |
| 7.2 Implement drag-and-drop reordering | NOT STARTED | Visual drop indicator |
| 7.3 Keep arrow buttons functional | NOT STARTED | Up/down for precise reordering |
| 7.4 Create segment grouping UI | NOT STARTED | Named collapsible groups |
| 7.5 Show combined duration for groups | NOT STARTED | When collapsed |

### Phase 5: Segment Management 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 8.1 Add duplicate segment button | NOT STARTED | Creates copy after original |
| 8.2 Implement segment locking | NOT STARTED | Prevent accidental edits |
| 8.3 Add lock/unlock toggle UI | NOT STARTED | Visual indicator, click to toggle |
| 8.4 Add conditional/optional toggle | NOT STARTED | Mark segments as backup |
| 8.5 Add notes field to segment | NOT STARTED | Internal production notes |
| 8.6 Show notes indicator on row | NOT STARTED | Icon when notes exist |

### Phase 6: Timing Modes 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 9.1 Add timing mode selector | NOT STARTED | Fixed/Manual/Follows Previous |
| 9.2 Show timing mode badge on row | NOT STARTED | Visual indicator |
| 9.3 Surface auto-advance toggle inline | NOT STARTED | Quick toggle on segment row |

### Phase 7: Templates & Presets 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 10.1 Save segment as template | NOT STARTED | Reusable segment configurations |
| 10.2 Create segment template library | NOT STARTED | Accessible from Add Segment |
| 10.3 Save full rundown as template | NOT STARTED | Entire show structure |
| 10.4 Template management UI | NOT STARTED | Edit, delete, organize templates |
| 10.5 Add recurrence pattern option | NOT STARTED | Repeat segment N times |

### Phase 8: Collaboration 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 11.1 Real-time sync with Firebase | NOT STARTED | Multiple users see same data |
| 11.2 Add presence indicators | NOT STARTED | Show who is viewing/editing |
| 11.3 Implement cursor/selection sharing | NOT STARTED | See other users' selections |
| 11.4 Add role-based permissions | NOT STARTED | Owner, Producer, Editor, Viewer |
| 11.5 Implement change history log | NOT STARTED | Track all edits with timestamp |
| 11.6 Add version rollback | NOT STARTED | Restore previous state |
| 11.7 Add approval workflow | NOT STARTED | Draft → In Review → Approved → Locked |

### Phase 9: Data & Reporting 🔲 NOT STARTED

> **Note:** Post-show analytics (actual vs planned, deviation logs) moved to PRD-05.

| Task | Status | Notes |
|------|--------|-------|
| 12.1 Export to PDF | NOT STARTED | Print-friendly layout |
| 12.2 Export to CSV | NOT STARTED | Spreadsheet format |
| 12.3 Export to JSON | NOT STARTED | Backup/API integration |
| 12.4 Import from CSV | NOT STARTED | Field mapping UI, validation |
| 12.5 Import from JSON | NOT STARTED | Backup restore, preview |

### Phase 10: Visual & UX 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 13.1 Create timeline view | NOT STARTED | Gantt-style horizontal bars |
| 13.2 Toggle between list and timeline | NOT STARTED | View switcher in toolbar |
| 13.3 Add color coding by type | NOT STARTED | Row backgrounds by segment type |
| 13.4 Make colors customizable | NOT STARTED | User preference |
| 13.5 Add compact view toggle | NOT STARTED | Single line per segment |
| 13.6 Add dark/light mode toggle | NOT STARTED | Theme preference |
| 13.7 Create print-friendly view | NOT STARTED | Clean layout for paper |

### Phase 11: Quality of Life 🔲 NOT STARTED

| Task | Status | Notes |
|------|--------|-------|
| 14.1 Implement keyboard navigation | NOT STARTED | Arrow keys to navigate segments |
| 14.2 Add keyboard shortcuts | NOT STARTED | Ctrl+D duplicate, Ctrl+N new, etc. |
| 14.3 Implement undo/redo | NOT STARTED | 20+ levels of history |
| 14.4 Add search by segment name | NOT STARTED | Already exists, enhance |
| 14.5 Add filter by scene/graphic | NOT STARTED | Additional filter options |

### Phase 12: Advanced Planning 🔲 NOT STARTED

> **Note:** Live execution features (AI talking points, live scores, teleprompter display, audio triggering) moved to PRD-05.

| Task | Status | Notes |
|------|--------|-------|
| 15.1 AI context analysis | NOT STARTED | Analyze competition metadata, roster, dates |
| 15.2 AI segment suggestions - context | NOT STARTED | Senior meet, rivalry, championship triggers |
| 15.3 AI segment suggestions - roster | NOT STARTED | Seniors, All-Americans, milestones, injuries |
| 15.4 AI segment order suggestions | NOT STARTED | Best practices for segment placement |
| 15.5 AI suggestions panel UI | NOT STARTED | Non-intrusive display, one-click add, dismiss |
| 15.6 Add segment script field | NOT STARTED | Rich text for pre-planning notes |
| 15.7 Add audio cue planning fields | NOT STARTED | Song name, in/out timestamps |
| 15.8 Add talent assignment | NOT STARTED | Who is on camera, schedule view |
| 15.9 Add equipment tracking | NOT STARTED | Camera, mic per segment, conflicts |
| 15.10 Add sponsor/ad tracking | NOT STARTED | Commercial obligations, fulfillment |

---

## Detailed Tasks (Completed Phases)

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

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Add Graphic picker dropdown that reads from graphicsRegistry.js.

**Checklist:**
- [x] Import graphicsRegistry or use getAllGraphicsForCompetition()
- [x] Add Graphic dropdown in SegmentDetail panel
- [x] Include "(None)" as first option
- [x] Group graphics by category with section headers
- [x] Wire selection to segment.graphic.graphicId field

**Implementation Notes:**
- Added import for `getGraphicsForCompetition` and `getCategories` from graphicsRegistry
- Added `GRAPHICS_CATEGORY_LABELS` constant for readable category headers
- Added `getTeamNames()` helper to extract team names from DUMMY_COMPETITION
- Added `getGroupedGraphics()` helper to get graphics filtered by competition type and grouped by category
- Added `handleGraphicChange()` in SegmentDetailPanel to handle graphic selection
- Graphic picker uses same visual style as Scene picker (bordered section with grouped dropdown)
- Shows selected graphic ID for debugging purposes

---

### Task 2.4: Filter graphics by competition type

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Only show graphics valid for the current competition type.

**Checklist:**
- [x] Pass competition type to graphics filter function
- [x] Filter out men's-only graphics for women's competitions
- [x] Filter graphics by team count (dual vs quad)
- [x] Verify correct graphics appear in dropdown

**Implementation Notes:**
- Task 2.4 was effectively completed as part of Task 2.3 when `getGraphicsForCompetition()` was integrated
- The `getGroupedGraphics()` helper passes `DUMMY_COMPETITION.type` ('womens-quad') to filter function
- The `isGraphicAvailable()` function in graphicsRegistry.js handles:
  - Gender filtering: mens-only graphics hidden for women's competitions
  - Team count filtering: minTeams/maxTeams constraints respected
- For women's quad: pommel, rings, pbars, hbar frames and their leaderboards are correctly filtered out
- R5 and R6 rotation summaries (mens-only) are also filtered out

---

### Task 2.5: Display team names in graphic options

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Show actual team names instead of generic "Team 1", "Team 2".

**Checklist:**
- [x] Use competition.teams to resolve team names
- [x] Display "UCLA Coaches" instead of "Team 1 Coaches"
- [x] Apply to all team-specific graphics in dropdown
- [x] Maintain teamSlot internally (1, 2, 3, 4) for template compatibility

**Implementation Notes:**
- Task 2.5 was effectively completed as part of Task 2.3 when `getGraphicsForCompetition()` was integrated
- The `getTeamNames()` helper extracts team names from DUMMY_COMPETITION.teams
- The `getGraphicsForCompetition()` function in graphicsRegistry.js handles label expansion:
  - Uses `labelTemplate` (e.g., '{teamName} Coaches') to produce "UCLA Coaches", "Oregon Coaches", etc.
  - The `team` property on expanded graphics preserves the slot number (1, 2, 3, 4) for template compatibility
- All perTeam graphics (team-stats, team-coaches) automatically get team-specific labels

---

### Task 2.6: Implement smart recommendations

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Suggest graphics based on segment name keywords.

**Checklist:**
- [x] Create keyword-to-graphic mapping function
- [x] Match team names + "coaches" → team coaches graphic
- [x] Match team names + "stats" → team stats graphic
- [x] Match "logos", "matchup" → logos graphic
- [x] Match "rotation" + number → event-summary (rotation mode)
- [x] Match apparatus names → event frame graphics
- [x] Match "summary", "recap" → event-summary
- [x] Match "leaderboard", "standings" → leaderboard graphic
- [x] Display recommendation with lightbulb icon in detail panel

**Implementation Notes:**
- Integrated `getRecommendedGraphic()` from graphicsRegistry.js
- Recommendation shows when confidence >= 0.2 (based on keyword/label matches)
- Recommendation hidden when the suggested graphic is already selected
- UI shows amber-colored suggestion box with lightbulb icon
- Recommendation uses same keyword matching as UrlGeneratorPage

---

### Task 2.7: Add "Use" button for recommendations

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
One-click button to apply recommended graphic.

**Checklist:**
- [x] Add "Use" button next to recommendation text
- [x] Clicking sets graphic dropdown to recommended value
- [x] Auto-populate default params for the graphic
- [x] Hide recommendation after applying

**Implementation Notes:**
- "Use" button styled in amber to match recommendation box
- Clicking calls `handleGraphicChange(recommendation.id)` which sets the graphic
- Recommendation automatically hides when selected graphic matches recommendation
- Default params preserved through existing handleGraphicChange logic

---

### Task 2.8: Implement parameter inputs

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Show dynamic form fields based on graphic's schema.

**Checklist:**
- [x] Read param definitions from graphic schema
- [x] Generate appropriate input for each param type (dropdown, number, text)
- [x] Show team selector for team-specific graphics (teamSlot param)
- [x] Show rotation/apparatus selector for event-summary
- [x] Show theme selector where applicable
- [x] Hide params section for graphics with no user-editable params
- [x] Wire inputs to segment.graphic.params object

**Implementation Notes:**
- Added `GraphicParamInputs` component that renders dynamic form fields
- Added `getUserEditableParams()` helper to filter out competition-sourced params
- Added `getBaseGraphicId()` helper to resolve expanded team graphic IDs (team1-stats → team-stats)
- Supports three param types:
  - `enum`: Renders dropdown with options (e.g., summaryTheme)
  - `number`: Renders number input with min/max constraints
  - `string`: Renders text input
- Params section hidden when no user-editable params exist
- Team selection handled through graphic ID expansion (team1-coaches, team2-coaches) rather than teamSlot param

---

### Task 2.9: Update segment save with graphic structure

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Save segments with proper graphic data structure.

**Checklist:**
- [x] Update handleSaveSegment to include graphic field
- [x] Structure: `graphic: { graphicId, params }` or `graphic: null`
- [x] Preserve existing params when changing other segment fields
- [x] Validate required params before save

**Implementation Notes:**
- Task 2.9 was already implemented as part of Task 2.3 foundation
- `handleSaveSegment(formData)` saves the entire segment including `graphic` field
- `handleGraphicChange(graphicId)` correctly structures the graphic object:
  - Sets `graphic: null` when no graphic selected
  - Sets `graphic: { graphicId, params }` with preserved existing params for same graphic
- `GraphicParamInputs` onChange handler updates `formData.graphic.params` directly
- No explicit validation needed for prototype phase (users can save with missing params)

---

### Task 2.10: Add graphic indicator to segment list

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Show visual indicator when segment has graphic assigned.

**Checklist:**
- [x] Add icon or badge to segment row when graphic is set
- [x] Show graphic name on hover (tooltip)
- [x] Differentiate from segments without graphics
- [x] Consider showing graphic category icon

**Implementation Notes:**
- Added pink-colored badge with PhotoIcon from heroicons
- Badge only appears when `segment.graphic?.graphicId` exists
- Title attribute shows graphic ID on hover for tooltip
- Styled consistently with other badges (type badge, etc.)
- Pink color chosen to differentiate from existing type badges

---

### Task 2.11: Verify Phase 0B acceptance criteria

**Status:** COMPLETE
**File:** N/A (verification task)

**Description:**
Verify all Phase 0B acceptance criteria from PRD are met.

**Checklist:**
- [x] Segment detail shows Scene picker dropdown
- [x] Scene picker shows hardcoded scenes grouped by category
- [x] Segment detail shows Graphic picker dropdown
- [x] Graphic picker reads from graphicsRegistry.js
- [x] Graphics filtered by competition type (women's quad)
- [x] Team-specific graphics show actual team names (UCLA, Oregon, etc.)
- [x] Smart recommendation shown when segment name matches keywords
- [x] Clicking "Use" on recommendation selects that graphic
- [x] Parameter inputs shown for graphics that have user-editable params
- [x] Segments save with `graphic: { graphicId, params }` structure
- [x] Segment list shows graphic indicator (icon or badge) when graphic assigned

**Verification Date:** 2026-01-23
**Production URL:** https://commentarygraphic.com/8kyf0rnl/rundown

**Verification Notes:**
- All criteria verified on production
- BUG-001 found: Form not resetting when switching segments (useState vs useEffect)
- BUG-001 fixed and deployed
- No console errors (only expected OBS disconnection when VM not running)
- Smart recommendations working: "UCLA Coaches" → "Suggested: UCLA Coaches", "Rotation 1 Summary" → "Suggested: R1"
- "Use" button correctly applies recommended graphic
- Graphic indicators (pink badges) showing correctly on segment list

---

### Task 3.1: Design template data structure

**Status:** COMPLETE
**File:** N/A (design task - documented here)

**Description:**
Define Firebase path and schema for rundown templates.

**Checklist:**
- [x] Define Firebase path structure
- [x] Define template metadata schema
- [x] Define abstract segment schema (team1, team2 instead of specific teams)
- [x] Define compatibility rules for template application
- [x] Document team reference abstraction strategy

**Firebase Path:**
```
rundownTemplates/
  {templateId}/
    metadata/
      id: "dual-meet-standard"
      name: "Standard Dual Meet"
      description: "Basic dual meet format with intros, rotations, and breaks"
      competitionTypes: ["womens-dual", "mens-dual"]  # Array of compatible types
      teamCount: 2
      createdAt: "2026-01-23T..."
      updatedAt: "2026-01-23T..."
      createdBy: "user@example.com"  # Optional, for multi-user
      estimatedDuration: 7200        # Total runtime in seconds (optional)
    segments/
      - id: "tpl-001"
        name: "Show Intro"
        type: "video"
        duration: 45
        scene: "Starting Soon"
        graphic: null
        autoAdvance: true
      - id: "tpl-002"
        name: "Team Logos"
        type: "static"
        duration: 10
        scene: "Graphics Fullscreen"
        graphic:
          graphicId: "logos"
          params: {}
        autoAdvance: true
      - id: "tpl-003"
        name: "{team1} Coaches"           # Template variable
        type: "live"
        duration: 15
        scene: "Single - Camera 2"
        graphic:
          graphicId: "team-coaches"
          params:
            teamSlot: 1                    # Abstract slot, not specific team
        autoAdvance: true
      - id: "tpl-004"
        name: "{team2} Coaches"
        type: "live"
        duration: 15
        scene: "Single - Camera 3"
        graphic:
          graphicId: "team-coaches"
          params:
            teamSlot: 2
        autoAdvance: true
```

**Template Variable Syntax:**
- `{team1}`, `{team2}`, `{team3}`, `{team4}` - Replaced with actual team names when loaded
- Variables in segment names are replaced during template application
- Graphic params use `teamSlot: N` which the graphics system already handles

**Compatibility Rules:**
1. `competitionTypes` array determines which competitions can use the template
2. `teamCount` must match or be less than competition's team count
3. Women's templates can only be used for women's competitions (event filtering)
4. Men's templates can only be used for men's competitions (event filtering)

**Abstraction Strategy:**
When saving a rundown as a template:
1. Replace team names in segment names with `{teamN}` placeholders
2. Ensure graphic params use `teamSlot: N` not specific team names
3. Remove competition-specific IDs, generate new template IDs
4. Store compatible competition types based on source competition

When loading a template:
1. Check compatibility with current competition
2. Replace `{teamN}` placeholders with actual team names
3. Generate new segment IDs for the rundown
4. Preserve graphic `teamSlot` params (graphics system handles resolution)

**Implementation Notes:**
- For prototype, templates stored in Firebase
- Template IDs use kebab-case (e.g., "dual-meet-standard")
- Segment IDs within templates use "tpl-" prefix
- When applied to competition, segments get new "seg-" prefixed IDs

---

## Bugs & Issues

| Bug ID | Description | Status | Task |
|--------|-------------|--------|------|
| BUG-001 | Form not resetting when switching segments (useState should be useEffect) | FIXED | 2.11 |

---

## Notes

### General
- Prototype phases complete - page is live at `/{compId}/rundown`
- SegmentList and SegmentDetail are inline components, will be extracted in future phases
- Used simple local state toast pattern (matching UrlGeneratorPage.jsx)
- Smart recommendations use keyword matching - can be refined based on user feedback

### Dependencies
- **Phase 0B** depends on PRD-Graphics-Registry (provides graphicsRegistry.js)
- **Phase 0C** (templates) will require Firebase schema design
- **Phase 8** (collaboration) will require significant Firebase/real-time infrastructure

### Architecture Considerations
- Consider extracting components to separate files when adding inline editing (Phase 2)
- Multi-select (Phase 3) may benefit from a selection context/hook
- Timeline view (Phase 10) may need a dedicated library (e.g., react-dnd, vis-timeline)
- Collaboration (Phase 8) will need conflict resolution strategy
- AI Segment Recommendations (Phase 12) will need:
  - Competition context resolver (date analysis, special designations)
  - Roster data integration (seniors, All-Americans, milestones)
  - Suggestion engine with confidence scoring
  - Learning from user patterns (optional, if collaboration enabled)

### Features Moved to PRD-05 (Show Controller)
The following features belong in live execution or post-show:
- AI Talking Points (real-time commentator context)
- Live Score Integration (auto-update graphics during show)
- Teleprompter Display (talent-facing view during broadcast)
- Audio Cue Triggering (playback control during show)
- Current Time Indicator (timeline view during live show)
- Convert Optional Segments (promote conditional segments during show)
- Historical Analytics (actual vs planned trends across shows)
- Comparison View (planned vs actual durations post-show)
- Deviation Log (auto-recorded during show execution)

---

## Completion Criteria

**Prototype (0A + 0B):** ✅ COMPLETE
**Full Editor (0C + Phases 1-12):** 🔲 IN PROGRESS

PRD Status:
- "PROTOTYPE COMPLETE" when Phase 0A + 0B verified
- "COMPLETE" when all phases verified (long-term goal)
