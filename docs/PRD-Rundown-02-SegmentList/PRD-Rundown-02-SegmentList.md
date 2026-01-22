# PRD-Rundown-02: Segment List Component

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-01-EditorPrototype
**Blocks:** PRD-Rundown-05-ProducerPreview

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **User Stories:** US-04 (Reorder Segments), US-05 (Bulk Selection)

---

## Overview

The SegmentList component displays all segments in a table format with support for:
- Single-click selection (opens detail panel)
- Multi-select via checkboxes
- Reordering via arrow buttons
- Visual status indicators

This is **separate from** the existing `RunOfShow.jsx` component, which is used in Producer View for show execution. SegmentList is specifically for the **editing** workflow.

---

## Scope

### In Scope
- Table display of segments
- Checkbox column for multi-select
- Arrow buttons (↑/↓) for reordering
- Row click to select for editing
- Shift+Click range selection
- Selection count and total duration display
- Visual indicators for segment type

### Out of Scope
- Inline editing (handled by SegmentDetail)
- Drag-and-drop reordering (decided against per master PRD)
- Milestone markers (Phase 2)
- Real-time status during show execution (use RunOfShow.jsx for that)

---

## Component API

```jsx
<SegmentList
  segments={[...]}                    // Array of segment objects
  selectedSegmentId={string|null}     // Currently selected for editing
  selectedSegmentIds={[...]}          // Multi-selected segment IDs
  onSelectSegment={(id) => {}}        // Single select handler
  onMultiSelect={(ids) => {}}         // Multi-select handler
  onReorder={(fromIndex, toIndex) => {}} // Reorder handler
  onAddSegment={() => {}}             // Add new segment handler
/>
```

---

## UI Layout

```
┌─ SEGMENT LIST ─────────────────────────────────────────────────────────────┐
│                                                                             │
│  [☐ Select All]  │  Selected: 3  │  Total: 0:53                            │
│                                                                             │
│  ☐ │ ↑ ↓ │ # │ NAME                    │ TYPE   │ DUR  │ SCENE             │
│ ───┼─────┼───┼─────────────────────────┼────────┼──────┼───────────────────│
│  ☐ │ ░ ↓ │ 1 │ Show Intro              │ video  │ 0:45 │ Starting Soon     │
│  ☐ │ ↑ ↓ │ 2 │ Welcome & Host          │ live   │ 0:30 │ Talent Camera     │
│  ☑ │ ↑ ↓ │ 3 │ Event Intro             │ static │ 0:08 │ Graphics FS       │
│  ☑ │ ↑ ↓ │ 4 │ UCLA Introduction       │ live   │ 0:10 │ Single - Cam 2  ← │
│  ☑ │ ↑ ↓ │ 5 │ Oregon Introduction     │ live   │ 0:10 │ Single - Cam 3    │
│  ☐ │ ↑ ░ │ 6 │ Utah Introduction       │ live   │ 0:10 │ Single - Cam 4    │
│                                                                             │
│  [+ Add Segment]                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
- ☐/☑ = Checkbox (multi-select)
- ↑/↓ = Arrow buttons (reorder)
- ░ = Disabled arrow (first/last segment)
- ← = Currently selected for editing (highlighted row)
```

---

## Columns

| Column | Width | Content |
|--------|-------|---------|
| Checkbox | 40px | Multi-select checkbox |
| Arrows | 60px | ↑ and ↓ buttons |
| # | 40px | Segment order number (1-based) |
| Name | flex | Segment name |
| Type | 80px | Segment type badge |
| Duration | 60px | Formatted as M:SS or "var" for variable |
| Scene | 150px | OBS scene name (truncated if needed) |

---

## Row States

| State | Visual |
|-------|--------|
| Default | Normal background |
| Hover | Light highlight |
| Selected (editing) | Blue highlight, arrow indicator (←) |
| Multi-selected | Checkbox checked, light blue background |
| Selected + Multi-selected | Both indicators visible |

---

## Selection Behavior

### Single Select (Row Click)
```javascript
// Click on row (NOT checkbox)
const handleRowClick = (segmentId) => {
  onSelectSegment(segmentId);     // Open in detail panel
  onMultiSelect([]);              // Clear multi-select
};
```

### Multi-Select (Checkbox)
```javascript
// Click checkbox
const handleCheckboxClick = (e, segmentId) => {
  e.stopPropagation(); // Don't trigger row click

  if (e.shiftKey && lastClickedId) {
    // Range select
    const range = getRange(lastClickedId, segmentId);
    onMultiSelect(range);
  } else {
    // Toggle single
    const newSelection = selectedSegmentIds.includes(segmentId)
      ? selectedSegmentIds.filter(id => id !== segmentId)
      : [...selectedSegmentIds, segmentId];
    onMultiSelect(newSelection);
  }
  setLastClickedId(segmentId);
};
```

### Select All
```javascript
const handleSelectAll = () => {
  if (selectedSegmentIds.length === segments.length) {
    onMultiSelect([]); // Deselect all
  } else {
    onMultiSelect(segments.map(s => s.id)); // Select all
  }
};
```

---

## Reorder Behavior

### Move Up (↑)
```javascript
const handleMoveUp = (e, index) => {
  e.stopPropagation();
  if (index > 0) {
    onReorder(index, index - 1);
  }
};
```

### Move Down (↓)
```javascript
const handleMoveDown = (e, index) => {
  e.stopPropagation();
  if (index < segments.length - 1) {
    onReorder(index, index + 1);
  }
};
```

### Button States
- ↑ disabled when `index === 0`
- ↓ disabled when `index === segments.length - 1`

---

## Selection Summary (Header)

When segments are multi-selected, show summary:

```
Selected: 3  │  Total: 0:53
```

**Total Duration Calculation:**
```javascript
const totalDuration = selectedSegmentIds
  .map(id => segments.find(s => s.id === id))
  .filter(s => s && s.duration)
  .reduce((sum, s) => sum + s.duration, 0);

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
```

---

## Type Badges

| Type | Color | Icon |
|------|-------|------|
| video | Purple | 🎬 |
| live | Green | 📹 |
| static | Blue | 📊 |
| break | Orange | ☕ |
| hold | Yellow | ⏸️ |
| graphic | Pink | 🎨 |

---

## Add Segment Button

Located at bottom of list:

```jsx
<button onClick={onAddSegment} className="add-segment-btn">
  + Add Segment
</button>
```

Behavior: Calls parent handler which creates a new segment after the currently selected one (or at end if none selected).

---

## File to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/components/rundown/SegmentList.jsx` | 200-250 | Segment list with selection |
| `show-controller/src/components/rundown/SegmentList.css` | 100-150 | Styling |

---

## Acceptance Criteria

### Display
- [ ] Table renders all segments from props
- [ ] Columns display: checkbox, arrows, #, name, type, duration, scene
- [ ] Type badges show with correct colors
- [ ] Duration shows as "M:SS" or "var" for null duration
- [ ] Scene names truncated with ellipsis if too long

### Single Selection
- [ ] Clicking row calls `onSelectSegment(id)`
- [ ] Selected row has blue highlight
- [ ] Arrow indicator (←) shows on selected row
- [ ] Clicking row clears multi-select

### Multi-Selection
- [ ] Checkbox toggles segment in/out of selection
- [ ] Shift+Click selects range from last clicked
- [ ] "Select All" checkbox in header
- [ ] Selection count shown: "Selected: N"
- [ ] Total duration of selected segments calculated and shown
- [ ] Multi-selected rows have light blue background

### Reordering
- [ ] ↑ button moves segment up one position
- [ ] ↓ button moves segment down one position
- [ ] ↑ disabled on first segment
- [ ] ↓ disabled on last segment
- [ ] Selection follows moved segment
- [ ] Segment numbers update after reorder

### Add Segment
- [ ] "+ Add Segment" button at bottom of list
- [ ] Clicking calls `onAddSegment()` prop

---

## Dependencies

- PRD-Rundown-01: Provides parent page and state management

---

## Next Steps

After this PRD is complete:
1. PRD-Rundown-03: SegmentDetail component (edit form)
