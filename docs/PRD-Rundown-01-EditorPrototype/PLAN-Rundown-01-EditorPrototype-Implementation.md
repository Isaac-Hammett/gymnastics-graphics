# PLAN-Rundown-01-EditorPrototype-Implementation

**PRD:** PRD-Rundown-01-EditorPrototype
**Status:** IN PROGRESS
**Created:** 2026-01-22
**Last Updated:** 2026-01-22

---

## Task Summary

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
| 1.11 Verify all acceptance criteria | NOT STARTED | Pending deployment verification |

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

### Task 1.11: Verify all acceptance criteria

**Status:** NOT STARTED
**File:** N/A (verification task)

**Description:**
Verify all acceptance criteria from PRD are met.

**Checklist:**
- [ ] Route `/{compId}/rundown` renders RundownEditorPage
- [ ] Page header shows "RUNDOWN EDITOR" and competition name placeholder
- [ ] Toolbar renders with all buttons
- [ ] Type filter dropdown shows all 6 segment types + "All Types"
- [ ] Search input filters segment list by name
- [ ] Split panel layout: SegmentList on left (~60%), SegmentDetail on right (~40%)
- [ ] Placeholder text shown in SegmentDetail when no segment selected
- [ ] "Coming soon" toast shown for unimplemented features
- [ ] Page uses hardcoded DUMMY_SEGMENTS data

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

---

## Completion Criteria

All tasks marked COMPLETE and all acceptance criteria verified = PRD Status → COMPLETE
