# PRD-Rundown-03: Segment Detail Component

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-01-EditorPrototype, PRD-Rundown-04-Pickers
**Blocks:** PRD-Rundown-05-ProducerPreview

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **User Stories:** US-01 (Create Segment), US-02 (Edit Segment), US-03 (Delete Segment)

---

## Overview

The SegmentDetail component is the right-panel form for creating and editing segments. It handles:
- All segment fields (name, type, duration, OBS, graphics, audio, notes)
- Form validation
- Save/Cancel/Delete actions
- Unsaved changes detection

---

## Scope

### In Scope
- Form layout with all segment fields
- Field validation (required fields, valid values)
- New segment vs. edit existing segment modes
- Unsaved changes warning
- Delete confirmation dialog
- Integration with Picker components

### Out of Scope
- Actual Firebase persistence (prototype uses local state)
- Real OBS/Graphics data (uses hardcoded pickers)

---

## Component API

```jsx
<SegmentDetail
  segment={object|null}               // Segment to edit, or null for new
  isNew={boolean}                     // True if creating new segment
  onSave={(segment) => {}}            // Save handler
  onDelete={(id) => {}}               // Delete handler
  onCancel={() => {}}                 // Cancel handler
  scenes={[...]}                      // Available OBS scenes (hardcoded for now)
  graphics={[...]}                    // Available graphics (hardcoded for now)
  audioPresets={[...]}                // Available audio presets (hardcoded for now)
/>
```

---

## UI Layout - Edit Mode

```
┌─ DETAIL PANEL ──────────────────────────────────────────────────────────────┐
│                                                                              │
│  Editing: UCLA Introduction                                    [×]          │
│                                                                              │
│  ─── Basic Info ───────────────────────────────────────────────────────────│
│                                                                              │
│  Name *         [UCLA Introduction________________________]                  │
│                                                                              │
│  Type *         [live ▼]                                                     │
│                                                                              │
│  Duration *     [10] seconds        ☑ Auto-advance                          │
│                 (disabled for hold type)                                     │
│                                                                              │
│  ─── OBS Configuration ────────────────────────────────────────────────────│
│                                                                              │
│  Scene *        [Single - Camera 2 ▼]                                        │
│                                                                              │
│  Transition     [Fade ▼]            Duration: [300] ms                       │
│                                                                              │
│  ─── Graphics ─────────────────────────────────────────────────────────────│
│                                                                              │
│  Graphic        [UCLA Stats ▼]                                               │
│                                                                              │
│  Trigger Mode   [cued ▼]            Duration: [8] seconds                    │
│                                                                              │
│  ─── Audio ────────────────────────────────────────────────────────────────│
│                                                                              │
│  Preset         [Commentary Focus ▼]                                         │
│                                                                              │
│  ─── Notes ────────────────────────────────────────────────────────────────│
│                                                                              │
│  [Wait for talent to finish host intro before advancing_______________]     │
│  [________________________________________________________________]         │
│                                                                              │
│                                                                              │
│  [Delete]                                        [Cancel]  [Save Changes]   │
│     ↑                                                           ↑            │
│     Red, destructive                                  Disabled until valid  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## UI Layout - New Segment Mode

```
┌─ DETAIL PANEL ──────────────────────────────────────────────────────────────┐
│                                                                              │
│  New Segment                                                   [×]          │
│                                                                              │
│  ─── Basic Info ───────────────────────────────────────────────────────────│
│                                                                              │
│  Name *         [________________________________] ← Required               │
│                                                                              │
│  Type *         [live ▼] ← Default                                           │
│                                                                              │
│  Duration *     [30] seconds ← Default        ☑ Auto-advance                │
│                                                                              │
│  ─── OBS Configuration ────────────────────────────────────────────────────│
│                                                                              │
│  Scene *        [Select scene... ▼] ← Required                               │
│                                                                              │
│  ... (other fields with defaults or empty)                                   │
│                                                                              │
│                                                                              │
│                                              [Cancel]  [Save Segment]       │
│                                                             ↑                │
│                                               Disabled until all required   │
│                                               fields are filled             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## UI Layout - Empty State

```
┌─ DETAIL PANEL ──────────────────────────────────────────────────────────────┐
│                                                                              │
│                                                                              │
│                                                                              │
│                          Select a segment to edit                            │
│                                                                              │
│                          or click "+ Add Segment"                            │
│                          to create a new one                                 │
│                                                                              │
│                                                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Form Fields

### Required Fields

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `name` | text | "" | Non-empty, max 100 chars |
| `type` | select | "live" | One of: video, live, static, break, hold, graphic |
| `duration` | number | 30 | Positive integer (disabled for hold type) |
| `obs.sceneId` | select | null | Must select from available scenes |

### Optional Fields

| Field | Type | Default |
|-------|------|---------|
| `timing.autoAdvance` | checkbox | true |
| `obs.transition.type` | select | "Cut" |
| `obs.transition.duration` | number | 300 (disabled for Cut) |
| `graphics.primary.graphicId` | select | null |
| `graphics.primary.triggerMode` | select | "cued" |
| `graphics.primary.duration` | number | 8 |
| `audio.preset` | select | null |
| `notes` | textarea | "" |

---

## Form State Management

```javascript
const [formData, setFormData] = useState(initialState);
const [errors, setErrors] = useState({});
const [isDirty, setIsDirty] = useState(false);

// Initialize form when segment changes
useEffect(() => {
  if (segment) {
    setFormData(segmentToForm(segment));
    setIsDirty(false);
  } else if (isNew) {
    setFormData(getDefaultFormData());
    setIsDirty(true); // New segment is always "dirty"
  }
}, [segment, isNew]);

// Track changes
const handleFieldChange = (field, value) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  setIsDirty(true);
  validateField(field, value);
};
```

---

## Validation

```javascript
const validateForm = () => {
  const newErrors = {};

  if (!formData.name.trim()) {
    newErrors.name = 'Name is required';
  } else if (formData.name.length > 100) {
    newErrors.name = 'Name must be 100 characters or less';
  }

  if (!formData.type) {
    newErrors.type = 'Type is required';
  }

  if (formData.type !== 'hold' && (!formData.duration || formData.duration <= 0)) {
    newErrors.duration = 'Duration must be a positive number';
  }

  if (!formData.sceneId) {
    newErrors.sceneId = 'OBS Scene is required';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const isValid = useMemo(() => {
  return formData.name.trim() &&
         formData.type &&
         (formData.type === 'hold' || formData.duration > 0) &&
         formData.sceneId;
}, [formData]);
```

---

## Save Handler

```javascript
const handleSave = () => {
  if (!validateForm()) return;

  const segment = formToSegment(formData);

  if (isNew) {
    segment.id = `seg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    segment.meta = {
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      modifiedBy: 'local-user'
    };
  } else {
    segment.meta = {
      ...segment.meta,
      modifiedAt: new Date().toISOString(),
      modifiedBy: 'local-user'
    };
  }

  onSave(segment);
  setIsDirty(false);
};
```

---

## Delete Handler

```javascript
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

const handleDeleteClick = () => {
  setShowDeleteConfirm(true);
};

const handleConfirmDelete = () => {
  onDelete(segment.id);
  setShowDeleteConfirm(false);
};
```

---

## Delete Confirmation Dialog

```
┌─────────────────────────────────────────────┐
│                                             │
│  Delete Segment?                            │
│                                             │
│  Are you sure you want to delete            │
│  "UCLA Introduction"?                       │
│                                             │
│  This action cannot be undone.              │
│                                             │
│              [Cancel]  [Delete]             │
│                         ↑                   │
│                         Red/destructive     │
└─────────────────────────────────────────────┘
```

---

## Unsaved Changes Warning

When user clicks Cancel or tries to switch segments with unsaved changes:

```
┌─────────────────────────────────────────────┐
│                                             │
│  Unsaved Changes                            │
│                                             │
│  You have unsaved changes to                │
│  "UCLA Introduction".                       │
│                                             │
│  What would you like to do?                 │
│                                             │
│         [Discard]  [Save]  [Cancel]         │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Picker Integration

The detail panel includes these picker components (defined in PRD-Rundown-04):

```jsx
{/* OBS Scene */}
<ScenePicker
  value={formData.sceneId}
  onChange={(sceneId) => handleFieldChange('sceneId', sceneId)}
  scenes={scenes}
  error={errors.sceneId}
/>

{/* Transition */}
<TransitionPicker
  type={formData.transitionType}
  duration={formData.transitionDuration}
  onTypeChange={(type) => handleFieldChange('transitionType', type)}
  onDurationChange={(duration) => handleFieldChange('transitionDuration', duration)}
/>

{/* Graphics */}
<GraphicsPicker
  value={formData.graphicId}
  onChange={(graphicId) => handleFieldChange('graphicId', graphicId)}
  graphics={graphics}
/>

{/* Audio */}
<AudioPicker
  value={formData.audioPreset}
  onChange={(preset) => handleFieldChange('audioPreset', preset)}
  presets={audioPresets}
/>
```

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/components/rundown/SegmentDetail.jsx` | 300-350 | Detail panel form |
| `show-controller/src/components/rundown/SegmentDetail.css` | 150 | Styling |
| `show-controller/src/components/rundown/DeleteConfirmDialog.jsx` | 50 | Delete confirmation |
| `show-controller/src/components/rundown/UnsavedChangesDialog.jsx` | 60 | Unsaved changes warning |

---

## Acceptance Criteria

### Form Display
- [ ] Empty state shown when no segment selected
- [ ] Edit mode shows segment data pre-filled
- [ ] New mode shows default values
- [ ] All form fields render correctly
- [ ] Required fields marked with asterisk (*)

### Validation
- [ ] Name field required - shows error if empty
- [ ] Name max 100 characters
- [ ] Type field required
- [ ] Duration field required (except for hold type)
- [ ] Duration disabled when type is "hold"
- [ ] OBS Scene field required
- [ ] Save button disabled until all required fields valid
- [ ] Error messages display below invalid fields

### Save Flow
- [ ] Save button enabled when form is valid
- [ ] Save calls `onSave(segment)` with form data
- [ ] New segments get generated ID and timestamps
- [ ] Edit saves update modifiedAt timestamp
- [ ] Toast shows "Segment saved" (from parent)

### Delete Flow
- [ ] Delete button visible in edit mode only (not new)
- [ ] Delete button styled as destructive (red)
- [ ] Clicking Delete shows confirmation dialog
- [ ] Dialog shows segment name
- [ ] Cancel closes dialog without action
- [ ] Confirm calls `onDelete(id)`

### Unsaved Changes
- [ ] Dirty state tracked when form changes
- [ ] Cancel with unsaved changes shows warning
- [ ] Discard discards changes
- [ ] Save saves and continues
- [ ] Cancel returns to editing

### Type-specific Behavior
- [ ] Duration disabled when type="hold"
- [ ] Transition duration disabled when transition="Cut"

---

## Dependencies

- PRD-Rundown-01: Parent page passes props
- PRD-Rundown-04: Picker components

---

## Next Steps

After this PRD is complete:
1. PRD-Rundown-04: Picker components must be implemented to complete the form
