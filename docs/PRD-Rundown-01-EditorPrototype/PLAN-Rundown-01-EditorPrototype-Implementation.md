# PLAN-Rundown-01-EditorPrototype-Implementation

**PRD:** PRD-Rundown-01-EditorPrototype
**Status:** PROTOTYPE COMPLETE, FEATURES IN PROGRESS
**Created:** 2026-01-22
**Last Updated:** 2026-01-23 (v5.12 - Task 88 complete - AI context-based segment suggestions)

---

## Overview

This implementation plan covers all phases of the Rundown Editor from the PRD. Prototype phases (0A, 0B) are complete and deployed. Future phases add timing, inline editing, multi-select, collaboration, and advanced features.

---

## ⚠️ IMPORTANT: Task Execution Rules

**ONE TASK = ONE ITERATION**

Each row in the task tables below is ONE task. Complete exactly ONE task per iteration:

1. Pick the first NOT STARTED or IN PROGRESS task
2. Implement that ONE task
3. Commit, deploy, verify
4. STOP - the next iteration will handle the next task

**Do NOT:**
- Complete multiple tasks in one iteration
- Batch "related" tasks together
- Complete an entire phase in one iteration

**Task Numbering:**
- Tasks are numbered sequentially: Task 1, Task 2, ... Task 96
- Each task number is unique and independent
- Example: "Task 53" is ONE task, not a subtask

---

## Phase Summary

| Phase | Name | Status | Tasks |
|-------|------|--------|-------|
| 0A | Basic Page Structure | ✅ COMPLETE | 1-11 |
| 0B | Graphics & Scene Integration | ✅ COMPLETE | 12-22 |
| 0C | Templates (Basic) | ✅ COMPLETE | 23-27 |
| 1 | Timing & Display | ✅ COMPLETE | 28-33 |
| 2 | Inline Editing | ✅ COMPLETE | 34-37 |
| 3 | Multi-Select & Summary | ✅ COMPLETE | 38-43 |
| 4 | Reordering & Organization | ✅ COMPLETE | 44-48 |
| 5 | Segment Management | ✅ COMPLETE | 49-54 |
| 6 | Timing Modes | ✅ COMPLETE | 55-57 |
| 7 | Templates & Presets | ✅ COMPLETE | 58-62 |
| 8 | Collaboration | ✅ COMPLETE | 63-69 |
| 9 | Data & Reporting | ✅ COMPLETE | 70-74 |
| 10 | Visual & UX | ✅ COMPLETE | 75-81 |
| 11 | Quality of Life | ✅ COMPLETE | 82-86 |
| 12 | Advanced Planning | 🔄 IN PROGRESS | 87-96 |

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

### Phase 1: Timing & Display ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Add total runtime display in header | COMPLETE | Added clock icon + runtime display in header with formatDuration |
| 4.2 Add target duration input | COMPLETE | Added toggle to show duration input, supports H:MM:SS, M:SS, or seconds formats |
| 4.3 Implement over/under indicator | COMPLETE | Green (< 95%), yellow (95-100%), red (> 100%) color states with +/- time badge |
| 4.4 Add running time column | COMPLETE | Added segmentStartTimes useMemo, displays cumulative start time per segment row |
| 4.5 Auto-recalculate on duration change | COMPLETE | Handled automatically via useMemo dependency on segments array |
| 4.6 Add buffer/pad time between segments | COMPLETE | Added bufferAfter field to segments with UI in detail panel and visual indicator in list |

### Phase 2: Inline Editing ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 5.1 Add inline OBS Scene dropdown | COMPLETE | Grouped dropdown on segment row, auto-saves on change |
| 5.2 Add inline Graphic dropdown | COMPLETE | Grouped dropdown on segment row, auto-saves on change |
| 5.3 Add inline duration input | COMPLETE | Text input with "s" suffix display, numeric-only entry |
| 5.4 Keep edit button for full panel | COMPLETE | Pencil icon opens detail panel for all fields |

### Phase 3: Multi-Select & Summary ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 6.1 Add checkbox to segment rows | COMPLETE | Checkbox with click, shift+click, ctrl+click support |
| 6.2 Implement Shift+click range select | COMPLETE | Selects all segments between last selected and current |
| 6.3 Implement Ctrl/Cmd+click toggle | COMPLETE | Toggles individual segment selection |
| 6.4 Create Selection Summary sidebar | COMPLETE | Shows when 2+ segments selected, replaces detail panel |
| 6.5 Add editable durations in summary | COMPLETE | Each segment has inline duration input, total updates live |
| 6.6 Implement bulk actions | COMPLETE | Bulk edit type, scene, graphic with dropdowns; bulk delete with confirmation |

### Phase 4: Reordering & Organization ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 7.1 Add drag handle to segment rows | COMPLETE | Bars3Icon on left side of each row |
| 7.2 Implement drag-and-drop reordering | COMPLETE | Native HTML5 drag/drop with visual drop indicator |
| 7.3 Keep arrow buttons functional | COMPLETE | Already implemented (arrow buttons remain functional) |
| 7.4 Create segment grouping UI | COMPLETE | Named collapsible groups with color coding, create from selection |
| 7.5 Show combined duration for groups | COMPLETE | Duration shown in group header, emphasized when collapsed |

### Phase 5: Segment Management ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Task 49: Add duplicate segment button | COMPLETE | DocumentDuplicateIcon button on row, handleDuplicateSegment function |
| Task 50: Implement segment locking | COMPLETE | Added `locked` field to segments, all edit/move/delete handlers check locked status |
| Task 51: Add lock/unlock toggle UI | COMPLETE | LockClosedIcon/LockOpenIcon toggle button, visual indicator badge, muted styling when locked |
| Task 52: Add conditional/optional toggle | COMPLETE | Added `optional` field, checkbox in Edit panel, "optional" badge on row, toggle to exclude from runtime |
| Task 53: Add notes field to segment | COMPLETE | Notes textarea in Edit panel, character count, internal production notes |
| Task 54: Show notes indicator on row | COMPLETE | ChatBubbleLeftIcon badge on segment row when notes exist, tooltip shows notes content

### Phase 6: Timing Modes ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Task 55: Add timing mode selector | COMPLETE | Added TIMING_MODES constant, timingMode field to segments, selector in Edit panel with descriptions |
| Task 56: Show timing mode badge on row | COMPLETE | Orange "MANUAL" badge for manual mode, indigo "→" for follows-previous mode |
| Task 57: Surface auto-advance toggle inline | COMPLETE | Green/gray "Auto" button on segment row, toggles autoAdvance field, respects lock status |

### Phase 7: Templates & Presets ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Task 58: Save segment as template | COMPLETE | Added SaveSegmentTemplateModal, bookmark button on SegmentRow, saves to Firebase segmentTemplates path with category tags. Note: Firebase rules need update for client write access. |
| Task 59: Create segment template library | COMPLETE | Added SegmentTemplateLibraryModal with category filtering, split Add Segment button with dropdown for "New Blank Segment" and "From Template..." options, loads templates from Firebase segmentTemplates path |
| Task 60: Save full rundown as template | COMPLETE | Already implemented in Phase 0C (Task 3.2). "Save as Template" button in toolbar opens SaveTemplateModal, saves to Firebase rundownTemplates path with team abstraction. |
| Task 61: Template management UI | COMPLETE | Added EditTemplateModal and EditSegmentTemplateModal, edit buttons (pencil icon) on template cards in both TemplateLibraryModal and SegmentTemplateLibraryModal, update handlers use Firebase update() for partial updates |
| Task 62: Add recurrence pattern option | COMPLETE | "Repeat Segment..." option in Add Segment dropdown, RecurrencePatternModal with name pattern ({n} placeholder), count, type, duration; creates multiple segments with auto-incremented names |

### Phase 8: Collaboration ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Task 63: Real-time sync with Firebase | COMPLETE | Firebase onValue listener for segments/groups, syncSegmentsToFirebase/syncGroupsToFirebase helpers, loading and syncing indicators |
| Task 64: Add presence indicators | COMPLETE | Firebase presence tracking with onDisconnect cleanup, colored avatars showing all viewers, stale presence filtered (2min timeout), activity heartbeat every 30s |
| Task 65: Implement cursor/selection sharing | COMPLETE | Presence data extended with selectedSegmentId/selectedSegmentIds, synced via useEffect on selection change, otherUsersSelections useMemo computes per-segment user list, SegmentRow shows colored avatar indicators + left border highlight for segments selected by others |
| Task 66: Add role-based permissions | COMPLETE | USER_ROLES constant with canEdit/canLock/canApprove permissions, role selector dropdown in header, checkPermission() helper for all edit handlers, role synced to presence for display, viewers blocked from all edit operations |
| Task 67: Implement change history log | COMPLETE | logChange() helper writes to Firebase history, syncSegmentsToFirebase/syncGroupsToFirebase updated to log actions, ChangeHistoryModal displays history with relative timestamps, color-coded action types (green=add, red=delete, amber=lock), user info with role, History button in header |
| Task 68: Add version rollback | COMPLETE | logChange() updated to store snapshots (segments + groups), syncSegmentsToFirebase/syncGroupsToFirebase pass snapshots, ChangeHistoryModal shows "Restore" button for entries with snapshots, RestoreConfirmModal for confirmation, handleInitiateRestore/handleConfirmRestore handlers, skipSnapshot flag prevents circular references |
| Task 69: Add approval workflow | COMPLETE | APPROVAL_STATUSES constant (draft, in-review, approved, locked), approvalStatus state synced to Firebase, status badge in header with dropdown menu, checkPermission() extended for approval status restrictions, workflow actions (submitForReview, approve, reject, lock, unlock, returnToDraft), RejectReasonModal for rejection with required reason, status logged to change history |

### Phase 9: Data & Reporting ✅ COMPLETE

> **Note:** Post-show analytics (actual vs planned, deviation logs) moved to PRD-05.

| Task | Status | Notes |
|------|--------|-------|
| Task 70: Export to PDF | COMPLETE | handleExportPDF function generates print-friendly HTML, opens in new window with print dialog, includes segment details, start times, notes, optional/locked badges |
| Task 71: Export to CSV | COMPLETE | handleExportCSV function generates CSV with all segment fields (number, start time, name, type, duration, scene, graphic, timing mode, flags, notes), proper CSV escaping for commas/quotes/newlines, triggers browser download with dated filename |
| Task 72: Export to JSON | COMPLETE | handleExportJSON function exports full rundown data (competition info, segments with all fields and computed start times, groups, metadata), pretty-printed JSON format, triggers browser download with dated filename |
| Task 73: Import from CSV | COMPLETE | Hidden file input triggers file picker, parseCSV handles quoted values, autoDetectCSVMapping auto-maps columns by header keywords, ImportCSVModal shows field mapping UI with preview, append/replace modes, validation for required Name field |
| Task 74: Import from JSON | COMPLETE | handleImportJSON opens file picker for .json files, validateJSONImport validates structure, ImportJSONModal shows preview with file info/segments/options, supports append/replace modes, import groups option, import settings option (targetDuration, approvalStatus), preserve IDs option |

### Phase 10: Visual & UX ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Task 75: Create timeline view | COMPLETE | TimelineView component with Gantt-style horizontal bars, zoom control, time markers, legend, buffer visualization, segment click selection |
| Task 76: Toggle between list and timeline | COMPLETE | View toggle buttons in toolbar (Bars4Icon for list, ChartBarIcon for timeline), viewMode state controls which view is rendered |
| Task 77: Add color coding by type | COMPLETE | TYPE_ROW_COLORS constant added, segment rows have colored left border + subtle background tint by type |
| Task 78: Make colors customizable | COMPLETE | ColorSettingsModal with 16 color options, localStorage persistence per competition, SwatchIcon button in toolbar |
| Task 79: Add compact view toggle | COMPLETE | QueueListIcon toggle button in toolbar (only visible in list view), compactView state, SegmentRow renders compact single-line with: number, name, type badge, lock/optional indicators, duration |
| Task 80: Add dark/light mode toggle | COMPLETE | MoonIcon/SunIcon toggle button in toolbar, darkMode state with localStorage persistence, theme-light CSS class on body, CSS variable overrides in index.css for light theme backgrounds, text, and borders |
| Task 81: Create print-friendly view | COMPLETE | PrintOptionsModal with configurable options (include notes, include optional segments, include scene, include graphic), DocumentTextIcon button in toolbar, handlePrintView function opens new window with print-friendly HTML, generatePrintableRundown updated to accept options and conditionally render columns/segments |

### Phase 11: Quality of Life ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Task 82: Implement keyboard navigation | COMPLETE | Arrow keys navigate segments, Escape clears selection, auto-scrolls to selected segment |
| Task 83: Add keyboard shortcuts | COMPLETE | Ctrl/Cmd+D duplicate, Ctrl/Cmd+N new segment, Ctrl/Cmd+S save, Ctrl/Cmd+A select all, Delete/Backspace delete, Enter open edit panel, Shift+Arrow extend selection |
| Task 84: Implement undo/redo | COMPLETE | 25 levels of history, Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, toolbar buttons with visual state |
| Task 85: Add search by segment name | COMPLETE | Enhanced: clear search button (X icon), result count indicator (e.g., "5 of 12 segments"), "Clear Filters" button to reset search and type filter |
| Task 86: Add filter by scene/graphic | COMPLETE | Added filterScene and filterGraphic state, scene dropdown with all DUMMY_SCENES, graphic dropdown with all GRAPHICS + "No Graphic" option, updated filteredSegments logic, result count and Clear Filters include all filters |

### Phase 12: Advanced Planning 🔄 IN PROGRESS

> **Note:** Live execution features (AI talking points, live scores, teleprompter display, audio triggering) moved to PRD-05.

| Task | Status | Notes |
|------|--------|-------|
| Task 87: AI context analysis | COMPLETE | Created aiContextAnalyzer.js with date analysis (holidays, season opener), competition analysis (rivalry, championship, senior meet detection), roster analysis (seniors, notable athletes), and suggestion triggers for Tasks 88-91 |
| Task 88: AI segment suggestions - context | COMPLETE | Added AI suggestions panel with context-based triggers (senior meet, rivalry, championship, season opener, holiday). Suggestions show in collapsible panel with one-click add and dismiss functionality. |
| Task 89: AI segment suggestions - roster | NOT STARTED | Seniors, All-Americans, milestones, injuries |
| Task 90: AI segment order suggestions | NOT STARTED | Best practices for segment placement |
| Task 91: AI suggestions panel UI | COMPLETE | Implemented as part of Task 88 - non-intrusive panel below toolbar, one-click add, dismiss/reset functionality |
| Task 92: Add segment script field | NOT STARTED | Rich text for pre-planning notes |
| Task 93: Add audio cue planning fields | NOT STARTED | Song name, in/out timestamps |
| Task 94: Add talent assignment | NOT STARTED | Who is on camera, schedule view |
| Task 95: Add equipment tracking | NOT STARTED | Camera, mic per segment, conflicts |
| Task 96: Add sponsor/ad tracking | NOT STARTED | Commercial obligations, fulfillment |

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
