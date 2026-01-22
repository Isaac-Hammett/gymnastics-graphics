# PRD-Rundown-01: Editor Prototype (Phase 0A)

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** None (Foundation)
**Blocks:** PRD-Rundown-02, PRD-Rundown-03, PRD-Rundown-04

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)

---

## Overview

This PRD covers the foundational Rundown Editor page structure. This is a **UI prototype phase** using hardcoded data to validate UX before any backend work.

---

## Scope

### In Scope
- Main `RundownEditorPage.jsx` component
- Route setup at `/{compId}/rundown`
- Page layout with split panel design
- Toolbar with action buttons (non-functional placeholders)
- Integration points for child components (SegmentList, SegmentDetail)

### Out of Scope
- Actual segment CRUD operations (see PRD-Rundown-02, PRD-Rundown-03)
- Picker components (see PRD-Rundown-04)
- Firebase integration (see PRD-Rundown-06, PRD-Rundown-07)
- Real OBS/Graphics data (see PRD-Rundown-07)

---

## Route

```
/{compId}/rundown
```

Example: `/pac12-2025/rundown`

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RUNDOWN EDITOR                        Women's Quad Meet                 │
│  UCLA vs Oregon vs Utah vs Arizona                [Save] [Export CSV]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ TOOLBAR ───────────────────────────────────────────────────────────┐│
│  │[+ Add Segment] [Templates ▼] [Import CSV] [↻ Sync OBS]              ││
│  │                                                                      ││
│  │ Filter: [All Types ▼]  Search: [____________]                       ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─ SEGMENT LIST ───────────────────────┬─ DETAIL PANEL ───────────────┐│
│  │                                       │                              ││
│  │  (SegmentList component)              │  (SegmentDetail component)   ││
│  │                                       │                              ││
│  │                                       │                              ││
│  └───────────────────────────────────────┴──────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```
RundownEditorPage.jsx
├── Header (title, competition name, save/export buttons)
├── Toolbar
│   ├── + Add Segment button
│   ├── Templates dropdown (placeholder)
│   ├── Import CSV button (placeholder)
│   ├── Sync OBS button (placeholder)
│   ├── Type filter dropdown
│   └── Search input
├── Main Content (split panel)
│   ├── SegmentList (left, ~60% width)
│   └── SegmentDetail (right, ~40% width)
└── SelectionSummary (conditional, shown when multi-select active)
```

---

## State Management

The page manages the following local state (prototype phase - no persistence):

```javascript
const [segments, setSegments] = useState(DUMMY_SEGMENTS);
const [selectedSegmentId, setSelectedSegmentId] = useState(null);
const [selectedSegmentIds, setSelectedSegmentIds] = useState([]); // multi-select
const [filterType, setFilterType] = useState('all');
const [searchQuery, setSearchQuery] = useState('');
```

---

## Hardcoded Test Data

```javascript
const DUMMY_SEGMENTS = [
  { id: 'seg-001', name: 'Show Intro', type: 'video', duration: 45, scene: 'Starting Soon', autoAdvance: true },
  { id: 'seg-002', name: 'Welcome & Host', type: 'live', duration: 30, scene: 'Talent Camera', autoAdvance: true },
  { id: 'seg-003', name: 'Event Introduction', type: 'static', duration: 8, scene: 'Graphics Fullscreen', autoAdvance: true },
  { id: 'seg-004', name: 'UCLA Introduction', type: 'live', duration: 10, scene: 'Single - Camera 2', autoAdvance: true },
  { id: 'seg-005', name: 'Oregon Introduction', type: 'live', duration: 10, scene: 'Single - Camera 3', autoAdvance: true },
  { id: 'seg-006', name: 'Utah Introduction', type: 'live', duration: 10, scene: 'Single - Camera 4', autoAdvance: true },
  { id: 'seg-007', name: 'Floor - Rotation 1', type: 'live', duration: null, scene: 'Single - Camera 4', autoAdvance: false },
];
```

---

## Props Passed to Child Components

### To SegmentList
```javascript
<SegmentList
  segments={filteredSegments}
  selectedSegmentId={selectedSegmentId}
  selectedSegmentIds={selectedSegmentIds}
  onSelectSegment={handleSelectSegment}
  onMultiSelect={handleMultiSelect}
  onReorder={handleReorder}
  onAddSegment={handleAddSegment}
/>
```

### To SegmentDetail
```javascript
<SegmentDetail
  segment={selectedSegment}
  onSave={handleSaveSegment}
  onDelete={handleDeleteSegment}
  onCancel={handleCancelEdit}
/>
```

---

## Event Handlers (Prototype Behavior)

| Handler | Behavior |
|---------|----------|
| `handleSelectSegment(id)` | Sets `selectedSegmentId`, clears multi-select |
| `handleMultiSelect(ids)` | Sets `selectedSegmentIds` array |
| `handleReorder(fromIndex, toIndex)` | Reorders segments in local state |
| `handleAddSegment()` | Inserts new segment after selected (or at end) |
| `handleSaveSegment(segment)` | Updates segment in local state, shows toast |
| `handleDeleteSegment(id)` | Removes from local state after confirmation |
| `handleCancelEdit()` | Clears selection |

---

## Toolbar Buttons

| Button | Prototype Behavior |
|--------|-------------------|
| + Add Segment | Calls `handleAddSegment()` |
| Templates | Shows "Coming soon" toast |
| Import CSV | Shows "Coming soon" toast |
| Sync OBS | Shows "Coming soon" toast |
| Save | Shows "Rundown saved" toast (no actual persistence) |
| Export CSV | Shows "Coming soon" toast |

---

## Filter & Search

**Type Filter Options:**
- All Types
- video
- live
- static
- break
- hold
- graphic

**Search:** Filters by segment name (case-insensitive substring match)

```javascript
const filteredSegments = segments.filter(seg => {
  const matchesType = filterType === 'all' || seg.type === filterType;
  const matchesSearch = seg.name.toLowerCase().includes(searchQuery.toLowerCase());
  return matchesType && matchesSearch;
});
```

---

## File to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/pages/RundownEditorPage.jsx` | 250-300 | Main editor page |

---

## File to Modify

| File | Changes |
|------|---------|
| `show-controller/src/App.jsx` | Add route: `<Route path="/:compId/rundown" element={<RundownEditorPage />} />` |

---

## Acceptance Criteria

- [ ] Route `/{compId}/rundown` renders RundownEditorPage
- [ ] Page header shows "RUNDOWN EDITOR" and competition name placeholder
- [ ] Toolbar renders with all buttons (+ Add Segment, Templates, Import CSV, Sync OBS)
- [ ] Type filter dropdown shows all 6 segment types + "All Types"
- [ ] Search input filters segment list by name
- [ ] Split panel layout: SegmentList on left (~60%), SegmentDetail on right (~40%)
- [ ] Placeholder text shown in SegmentDetail when no segment selected
- [ ] "Coming soon" toast shown for unimplemented features
- [ ] Page uses hardcoded DUMMY_SEGMENTS data

---

## Dependencies

None - this is a foundation component.

---

## Next Steps

After this PRD is complete:
1. PRD-Rundown-02: SegmentList component
2. PRD-Rundown-03: SegmentDetail component
3. PRD-Rundown-04: Picker components
