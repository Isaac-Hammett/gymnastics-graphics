# PLAN-Rundown-05-Prototype-Implementation

**PRD:** PRD-Rundown-05-Prototype
**Status:** NOT STARTED
**Created:** 2026-01-22
**Last Updated:** 2026-01-22

---

## Task Summary

| Task | Status | Notes |
|------|--------|-------|
| 5.1 Create RundownPrototypePage.jsx | NOT STARTED | Main prototype page |
| 5.2 Add route to App.jsx | NOT STARTED | Route: /{compId}/rundown-prototype |
| 5.3 Implement page header | NOT STARTED | Title, back button |
| 5.4 Compose existing components | NOT STARTED | CurrentSegment, NextSegment, RunOfShow |
| 5.5 Add edit mode toggle | NOT STARTED | Checkbox to enable/disable edit mode |
| 5.6 Create InlineSegmentEditor component | NOT STARTED | Quick edit form |
| 5.7 Implement inline editing | NOT STARTED | Edit buttons on segments when edit mode on |
| 5.8 Implement quick add segment | NOT STARTED | Add segment after current |
| 5.9 Add show controls | NOT STARTED | Start/Stop/Next/Previous buttons |
| 5.10 Add hardcoded test data | NOT STARTED | DUMMY_SEGMENTS for testing |
| 5.11 Add toast notifications | NOT STARTED | User feedback |
| 5.12 Verify all acceptance criteria | NOT STARTED | Test on production |

---

## Detailed Tasks

### Task 5.1: Create RundownPrototypePage.jsx

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Create the main RundownPrototypePage component file with basic structure and imports.

**Checklist:**
- [ ] Create file at `show-controller/src/pages/RundownPrototypePage.jsx`
- [ ] Add React imports (useState)
- [ ] Add useParams hook for compId
- [ ] Add useNavigate for back button
- [ ] Import useTimesheet hook
- [ ] Import existing components (CurrentSegment, NextSegment, RunOfShow)
- [ ] Export default component

---

### Task 5.2: Add route to App.jsx

**Status:** NOT STARTED
**File:** `show-controller/src/App.jsx`

**Description:**
Add the route for the Rundown Prototype page.

**Checklist:**
- [ ] Import RundownPrototypePage component
- [ ] Add route: `<Route path="rundown-prototype" element={<RundownPrototypePage />} />` (inside /:compId group)
- [ ] Verify route is inside the Router and CompetitionLayout

---

### Task 5.3: Implement page header

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Add the header section with title and back button.

**Checklist:**
- [ ] Add header container with flex layout
- [ ] Display "RUNDOWN PROTOTYPE" title
- [ ] Display subtitle "Workable prototype for rundown editing"
- [ ] Add back button that navigates to `/${compId}/producer`

---

### Task 5.4: Compose existing components

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Import and render the existing Producer View components.

**Checklist:**
- [ ] Import CurrentSegment from '../components/CurrentSegment'
- [ ] Import NextSegment from '../components/NextSegment'
- [ ] Import RunOfShow from '../components/RunOfShow'
- [ ] Render CurrentSegment in "Now Playing" section
- [ ] Render NextSegment in "Up Next" section
- [ ] Render RunOfShow in "Show Progress" section

---

### Task 5.5: Add edit mode toggle

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Add a checkbox to toggle edit mode on/off.

**Checklist:**
- [ ] Add editMode state (default: false)
- [ ] Add checkbox input with label "Edit Mode"
- [ ] Wire checkbox to editMode state
- [ ] Position toggle in toolbar above RunOfShow

---

### Task 5.6: Create InlineSegmentEditor component

**Status:** NOT STARTED
**File:** `show-controller/src/components/rundown/InlineSegmentEditor.jsx`

**Description:**
Create a simplified editor for quick inline edits.

**Checklist:**
- [ ] Create directory: `show-controller/src/components/rundown/`
- [ ] Create InlineSegmentEditor.jsx
- [ ] Add props: segment, onSave, onCancel
- [ ] Add local state for: name, duration, scene
- [ ] Add form fields for editing
- [ ] Add Cancel and Save buttons
- [ ] Style with Tailwind (matching existing dark theme)

---

### Task 5.7: Implement inline editing

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Add edit buttons to segments and wire up the inline editor.

**Checklist:**
- [ ] Add editingSegmentId state (default: null)
- [ ] When editMode is ON, show [Edit] button on each segment row
- [ ] Clicking [Edit] sets editingSegmentId
- [ ] Render InlineSegmentEditor when editingSegmentId is set
- [ ] handleSaveSegment updates segment in local state
- [ ] handleCancelEdit clears editingSegmentId

---

### Task 5.8: Implement quick add segment

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Add ability to quickly add a new segment.

**Checklist:**
- [ ] Add "+ Add Segment" button (visible when editMode is ON)
- [ ] handleQuickAdd creates new segment with defaults
- [ ] New segment inserted after current segment
- [ ] Open editor for the new segment

---

### Task 5.9: Add show controls

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Add control buttons for the show (using useTimesheet).

**Checklist:**
- [ ] Add Controls section at bottom of page
- [ ] Use useTimesheet() for: start, stop, advance, previous, isRunning
- [ ] Add "Previous" button → calls previous()
- [ ] Add "Stop" button → calls stop()
- [ ] Add "Start" button → calls start()
- [ ] Add "Next" button → calls advance()
- [ ] Disable Start when isRunning, disable Stop when not running

---

### Task 5.10: Add hardcoded test data

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Add DUMMY_SEGMENTS for local prototype testing.

**Checklist:**
- [ ] Add DUMMY_SEGMENTS constant (copy from PRD-Rundown-01)
- [ ] Add DUMMY_SCENES array for scene picker
- [ ] Initialize segments state with DUMMY_SEGMENTS

---

### Task 5.11: Add toast notifications

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownPrototypePage.jsx`

**Description:**
Add toast notifications for user feedback.

**Checklist:**
- [ ] Add toast state and showToast function
- [ ] Add toast on segment save: "Segment saved"
- [ ] Add toast on segment add: "Segment added"
- [ ] Add toast container for rendering

---

### Task 5.12: Verify all acceptance criteria

**Status:** NOT STARTED
**File:** N/A (verification task)

**Description:**
Verify all acceptance criteria from PRD are met.

**Existing Functionality (Verify Works):**
- [ ] CurrentSegment displays with progress bar
- [ ] NextSegment displays correctly
- [ ] RunOfShow shows all segments with status icons
- [ ] Controls (Start/Stop/Next/Previous) work
- [ ] Advance updates segment statuses
- [ ] Overtime indicator appears when segment runs long

**New Editing Features:**
- [ ] "Edit Mode" toggle shows/hides edit buttons
- [ ] [Edit] button on each segment row (when edit mode on)
- [ ] Clicking Edit opens InlineSegmentEditor
- [ ] InlineSegmentEditor pre-fills with segment data
- [ ] Save updates segment in local state
- [ ] Cancel closes editor without changes
- [ ] "+ Add Segment" creates new segment after current
- [ ] Toast shows on save

**Page Navigation:**
- [ ] Route `/{compId}/rundown-prototype` renders page
- [ ] Back button returns to producer view

**Verification Date:** [pending]
**Production URL:** https://commentarygraphic.com/{compId}/rundown-prototype

---

## Bugs & Issues

| Bug ID | Description | Status | Task |
|--------|-------------|--------|------|
| (none) | | | |

---

## Notes

- This is a workable prototype page - will be removed after PRD-Rundown-08
- Uses existing Producer View components (CurrentSegment, NextSegment, RunOfShow)
- useTimesheet() already provides all needed segment state and actions
- No backend/Firebase integration for this phase - local state only
- Components from PRD-Rundown-02/03/04 can be used if available, otherwise use inline implementations

---

## Dependencies

- PRD-Rundown-00 (Timesheet Consolidation): COMPLETE
- PRD-Rundown-01 (Editor Prototype): COMPLETE
- PRD-Rundown-02 (SegmentList): Optional enhancement
- PRD-Rundown-03 (SegmentDetail): Optional enhancement
- PRD-Rundown-04 (Pickers): Optional enhancement

---

## Completion Criteria

All tasks marked COMPLETE and all acceptance criteria verified = PRD Status → COMPLETE
