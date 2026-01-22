# PRD-Rundown-05: Rundown Prototype (Phase 0B)

**Version:** 1.0
**Date:** 2026-01-22
**Status:** NOT STARTED
**Depends On:** PRD-Rundown-01 through PRD-Rundown-04 (Phase 0A complete)
**Blocks:** PRD-Rundown-08-ProducerIntegration

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 14 - Phase 0B

---

## Overview

This PRD covers Phase 0B: a **workable prototype page** that composes existing Producer View components with the new rundown editing UI. This allows testing the combined UX before full integration.

**Important Note:** The core Producer View components (`CurrentSegment.jsx`, `NextSegment.jsx`, `RunOfShow.jsx`) already exist and use `useTimesheet()` from the completed Timesheet Consolidation (PRD-Rundown-00). This phase primarily tests how the new editing features integrate with existing components.

---

## Scope

### In Scope
- Prototype `RundownPrototypePage.jsx` at route `/{compId}/rundown-prototype`
- Compose existing components: CurrentSegment, NextSegment, RunOfShow
- Add inline segment editing capability
- Add quick-add segment button
- Test segment reordering in show context

### Out of Scope
- Modifying existing Producer View components
- Real Firebase persistence
- OBS integration
- Graphics triggering

### Cleanup
- This route is **removed** in Phase 3 (PRD-Rundown-08) after full Producer View integration

---

## Route

```
/{compId}/rundown-prototype
```

**Why a separate route:** Isolates the prototype from production ProducerPage, allowing focused UX testing without affecting live shows.

---

## Existing Components (No Changes Needed)

These components already exist and work with `useTimesheet()`:

| Component | File | What It Does |
|-----------|------|--------------|
| CurrentSegment | `components/CurrentSegment.jsx` | Shows current segment with progress bar, ms-precision timing, hold warnings |
| NextSegment | `components/NextSegment.jsx` | Shows next segment info |
| RunOfShow | `components/RunOfShow.jsx` | Shows segment list with status icons (✅ complete, ▶️ current, ⬜ pending) |

### What `useTimesheet()` Provides

```javascript
const {
  // Segment data
  currentSegment,
  nextSegment,
  segments,
  currentIndex,

  // Timing (milliseconds)
  elapsed,
  remaining,
  progress,           // 0-1 for progress bar

  // Hold segment support
  isHoldSegment,
  canAdvanceHold,

  // Actions
  start,
  stop,
  advance,
  previous,
  jumpTo,

  // Helpers
  formatTime,
  isFirstSegment,
  isLastSegment,
  isRunning,
} = useTimesheet();
```

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RUNDOWN PROTOTYPE (Workable Prototype)                              [← Back]      │
│  Workable prototype for rundown editing                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ NOW PLAYING ─────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  (CurrentSegment component - already exists)                       │  │
│  │                                                                    │  │
│  │  ▶️  UCLA Introduction                                             │  │
│  │      Live Segment                                                  │  │
│  │                                                                    │  │
│  │  [████████████████████████████░░░░░░░░░░░░░]  0:08 / 0:10         │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ UP NEXT ─────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  (NextSegment component - already exists)                          │  │
│  │                                                                    │  │
│  │  ⏭️  Oregon Introduction          0:10          Auto               │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ SHOW PROGRESS ───────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  [+ Add]  [Edit Mode: ☑]                     Segment 4 of 7       │  │
│  │                                                                    │  │
│  │  (RunOfShow component + inline edit overlay)                       │  │
│  │                                                                    │  │
│  │  ≡ ✅ Show Intro                             0:45                  │  │
│  │  ≡ ✅ Welcome & Host                         0:30                  │  │
│  │  ≡ ✅ Event Introduction                     0:08                  │  │
│  │  ≡ ▶️ UCLA Introduction                      0:10  [Edit] ←        │  │
│  │  ≡ ⬜ Oregon Introduction                    0:10  [Edit]          │  │
│  │  ≡ ⬜ Utah Introduction                      0:10  [Edit]          │  │
│  │  ≡ ⬜ Floor - Rotation 1                     var   [Edit]          │  │
│  │                                                                    │  │
│  │  [+ Add Segment]                                                   │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ INLINE EDITOR (shown when Edit clicked) ─────────────────────────┐  │
│  │                                                                    │  │
│  │  Editing: UCLA Introduction                                        │  │
│  │                                                                    │  │
│  │  Name: [UCLA Introduction_______]                                  │  │
│  │  Duration: [10] seconds                                            │  │
│  │  Scene: [Single - Camera 2 ▼]                                      │  │
│  │                                                                    │  │
│  │                                        [Cancel]  [Save]            │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ CONTROLS ────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  [⏮ Previous]    [⏹ Stop]    [▶ Start]    [⏭ Next]               │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## New Features to Test

### 1. Edit Mode Toggle

```jsx
const [editMode, setEditMode] = useState(false);

<label>
  <input
    type="checkbox"
    checked={editMode}
    onChange={(e) => setEditMode(e.target.checked)}
  />
  Edit Mode
</label>
```

When edit mode is ON:
- [Edit] buttons appear next to each segment in RunOfShow
- Reorder arrows (↑/↓) appear (optional for this prototype)
- "+ Add Segment" button visible

### 2. Inline Segment Editor

A simplified editor that appears below the segment list:

```jsx
const [editingSegmentId, setEditingSegmentId] = useState(null);

// When Edit clicked
const handleEditClick = (segmentId) => {
  setEditingSegmentId(segmentId);
};

// Inline editor component
{editingSegmentId && (
  <InlineSegmentEditor
    segment={segments.find(s => s.id === editingSegmentId)}
    onSave={handleSaveSegment}
    onCancel={() => setEditingSegmentId(null)}
  />
)}
```

### 3. Quick Add Segment

```jsx
const handleQuickAdd = () => {
  const newSegment = {
    id: `seg-${Date.now()}`,
    name: 'New Segment',
    type: 'live',
    duration: 30,
    scene: 'Single - Camera 1',
    autoAdvance: true,
  };

  // Insert after current segment
  const insertIndex = currentIndex + 1;
  // ... add to local state
};
```

---

## Component Structure

```
RundownPrototypePage.jsx
├── Header ("RUNDOWN PROTOTYPE", back button)
├── CurrentSegment (existing component)
├── NextSegment (existing component)
├── ShowProgress section
│   ├── Toolbar (+ Add, Edit Mode toggle)
│   ├── RunOfShow (existing component, with edit buttons overlay)
│   └── + Add Segment button
├── InlineSegmentEditor (conditional)
└── Controls (Previous, Stop, Start, Next buttons)
```

---

## State Management

```javascript
// Local state for prototype testing
const [segments, setSegments] = useState(DUMMY_SEGMENTS);
const [editMode, setEditMode] = useState(false);
const [editingSegmentId, setEditingSegmentId] = useState(null);

// From useTimesheet (existing)
const {
  currentSegment,
  nextSegment,
  currentIndex,
  advance,
  previous,
  start,
  stop,
  isRunning,
} = useTimesheet();
```

---

## InlineSegmentEditor Component

A simplified version of SegmentDetail for quick edits:

```jsx
const InlineSegmentEditor = ({ segment, onSave, onCancel }) => {
  const [name, setName] = useState(segment.name);
  const [duration, setDuration] = useState(segment.duration);
  const [scene, setScene] = useState(segment.scene);

  const handleSave = () => {
    onSave({
      ...segment,
      name,
      duration,
      scene,
    });
  };

  return (
    <div className="inline-editor">
      <h4>Editing: {segment.name}</h4>

      <label>
        Name:
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label>
        Duration:
        <input
          type="number"
          value={duration || ''}
          onChange={(e) => setDuration(parseInt(e.target.value) || null)}
        />
        seconds
      </label>

      <label>
        Scene:
        <select value={scene} onChange={(e) => setScene(e.target.value)}>
          {DUMMY_SCENES.map(s => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
      </label>

      <div className="inline-editor-actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={handleSave}>Save</button>
      </div>
    </div>
  );
};
```

---

## Test Flow

```
1. Page loads with hardcoded segments
   - CurrentSegment shows segment 0
   - NextSegment shows segment 1
   - RunOfShow shows all segments

2. Click "Start" → Timer starts
   - Progress bar fills in CurrentSegment
   - Elapsed time updates

3. Segment runs over duration → OVERTIME indicator
   - Already implemented in CurrentSegment

4. Click "Next" → Advance to segment 1
   - CurrentSegment updates
   - RunOfShow shows segment 0 as ✅, segment 1 as ▶️

5. Toggle "Edit Mode" ON
   - [Edit] buttons appear next to each segment

6. Click [Edit] on a segment
   - InlineSegmentEditor appears
   - Form pre-filled with segment data

7. Modify segment name, click Save
   - Segment updates in list
   - Toast: "Segment saved"
   - Editor closes

8. Click "+ Add Segment"
   - New segment added after current
   - Editor opens for new segment
```

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/pages/RundownPrototypePage.jsx` | 150-200 | Test page |
| `show-controller/src/components/rundown/InlineSegmentEditor.jsx` | 80-100 | Quick edit form |
| `show-controller/src/components/rundown/InlineSegmentEditor.css` | 50 | Styling |

---

## Files to Modify

| File | Changes |
|------|---------|
| `show-controller/src/App.jsx` | Add route: `<Route path="/:compId/rundown-prototype" element={<RundownPrototypePage />} />` |

---

## Acceptance Criteria

### Existing Functionality (Verify Works)
- [ ] CurrentSegment displays with progress bar
- [ ] NextSegment displays correctly
- [ ] RunOfShow shows all segments with status icons
- [ ] Controls (Start/Stop/Next/Previous) work
- [ ] Advance updates segment statuses
- [ ] Overtime indicator appears when segment runs long

### New Editing Features
- [ ] "Edit Mode" toggle shows/hides edit buttons
- [ ] [Edit] button on each segment row (when edit mode on)
- [ ] Clicking Edit opens InlineSegmentEditor
- [ ] InlineSegmentEditor pre-fills with segment data
- [ ] Save updates segment in local state
- [ ] Cancel closes editor without changes
- [ ] "+ Add Segment" creates new segment after current
- [ ] Toast shows on save

### Page Navigation
- [ ] Route `/{compId}/rundown-prototype` renders page
- [ ] Back button returns to previous page

---

## Cleanup (Phase 3)

After PRD-Rundown-08 (Producer Integration) is complete:
- Remove `RundownPrototypePage.jsx`
- Remove route from `App.jsx`
- The inline editing features will be integrated into the real ProducerPage

---

## Dependencies

- PRD-Rundown-00 (Timesheet Consolidation): ✅ Complete
- PRD-Rundown-01 through 04: Phase 0A components

---

## Next Steps

After this PRD is complete:
1. Stakeholder review of full Phase 0 prototype
2. PRD-Rundown-06: Backend services
