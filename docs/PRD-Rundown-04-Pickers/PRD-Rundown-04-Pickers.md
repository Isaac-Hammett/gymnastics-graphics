# PRD-Rundown-04: Picker Components

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-01-EditorPrototype
**Blocks:** PRD-Rundown-03-SegmentDetail, PRD-Rundown-07-FrontendIntegration

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 6 - Pickers

---

## Overview

Picker components are reusable dropdown/selection components used in the SegmentDetail form. In the **prototype phase (Phase 0)**, these use hardcoded data. In **Phase 2**, they will be connected to real data sources (OBS via Socket.io, Graphics Registry from Firebase).

This PRD covers four picker components:
1. ScenePicker - OBS scene selection
2. TransitionPicker - OBS transition type and duration
3. GraphicsPicker - Graphics selection from registry
4. AudioPicker - Audio preset selection

---

## 1. ScenePicker

### Purpose
Select an OBS scene from available scenes.

### Component API

```jsx
<ScenePicker
  value={string|null}                 // Selected scene name
  onChange={(sceneId) => {}}          // Selection handler
  scenes={[...]}                      // Available scenes (hardcoded for Phase 0)
  error={string|null}                 // Validation error message
  disabled={boolean}                  // Disable picker
/>
```

### UI Layout

```
┌─ SELECT OBS SCENE ──────────────────────────────────────────────────────┐
│                                                                          │
│  Scene *        [Single - Camera 2 ▼]                                    │
│                 ┌────────────────────────────────────────────────────┐  │
│                 │ ─── Single Camera ─────────────────────────────── │  │
│                 │ Single - Camera 1                                  │  │
│                 │ Single - Camera 2                              ✓   │  │
│                 │ Single - Camera 3                                  │  │
│                 │ Single - Camera 4                                  │  │
│                 │ ─── Multi-Camera ──────────────────────────────── │  │
│                 │ Dual - Cam1 + Cam2                                 │  │
│                 │ Quad View                                          │  │
│                 │ ─── Static ────────────────────────────────────── │  │
│                 │ Starting Soon                                      │  │
│                 │ BRB                                                 │  │
│                 │ Thanks for Watching                                │  │
│                 │ ─── Manual ────────────────────────────────────── │  │
│                 │ Talent Camera                                      │  │
│                 │ Graphics Fullscreen                                │  │
│                 └────────────────────────────────────────────────────┘  │
│                                                                          │
│  ⚠️ OBS not connected (placeholder for Phase 2)                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Hardcoded Data (Phase 0)

```javascript
const DUMMY_SCENES = [
  { name: 'Single - Camera 1', category: 'single' },
  { name: 'Single - Camera 2', category: 'single' },
  { name: 'Single - Camera 3', category: 'single' },
  { name: 'Single - Camera 4', category: 'single' },
  { name: 'Dual - Cam1 + Cam2', category: 'multi' },
  { name: 'Quad View', category: 'multi' },
  { name: 'Starting Soon', category: 'static' },
  { name: 'BRB', category: 'static' },
  { name: 'Thanks for Watching', category: 'static' },
  { name: 'Talent Camera', category: 'manual' },
  { name: 'Graphics Fullscreen', category: 'graphics' },
];

const CATEGORY_LABELS = {
  single: 'Single Camera',
  multi: 'Multi-Camera',
  static: 'Static',
  manual: 'Manual',
  graphics: 'Graphics',
};
```

### Behavior
- Scenes grouped by category with section headers
- Selected scene shows checkmark (✓)
- Error state shows red border and error message
- Placeholder text: "Select scene..."

---

## 2. TransitionPicker

### Purpose
Select OBS transition type and duration.

### Component API

```jsx
<TransitionPicker
  type={string}                       // "Cut" | "Fade" | "Stinger"
  duration={number}                   // Duration in ms (ignored for Cut)
  onTypeChange={(type) => {}}         // Type change handler
  onDurationChange={(duration) => {}} // Duration change handler
  disabled={boolean}                  // Disable picker
/>
```

### UI Layout

```
┌─ SELECT TRANSITION ─────────────────────────────────────────────────────┐
│                                                                          │
│  Transition     [Fade ▼]            Duration: [300] ms                   │
│                 ┌──────────────┐              ↑                          │
│                 │ Cut      ✓   │    Disabled when type="Cut"             │
│                 │ Fade         │                                         │
│                 │ Stinger      │                                         │
│                 └──────────────┘                                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Hardcoded Data (Phase 0)

```javascript
const TRANSITIONS = [
  { name: 'Cut', configurable: false },
  { name: 'Fade', configurable: true, defaultDuration: 300 },
  { name: 'Stinger', configurable: true, defaultDuration: 500 },
];
```

### Behavior
- Duration input disabled when type is "Cut"
- Duration defaults to transition's defaultDuration when type changes
- Duration input validates: min 0, max 5000ms

---

## 3. GraphicsPicker

### Purpose
Select a graphic from the graphics registry.

### Component API

```jsx
<GraphicsPicker
  value={string|null}                 // Selected graphic ID
  onChange={(graphicId) => {}}        // Selection handler
  graphics={[...]}                    // Available graphics (hardcoded for Phase 0)
  triggerMode={string}                // "auto" | "cued" | "on-score" | "timed"
  onTriggerModeChange={(mode) => {}}  // Trigger mode handler
  duration={number|null}              // Graphic duration
  onDurationChange={(duration) => {}} // Duration handler
  disabled={boolean}                  // Disable picker
/>
```

### UI Layout

```
┌─ SELECT GRAPHIC ────────────────────────────────────────────────────────┐
│                                                                          │
│  Graphic        [UCLA Stats ▼]                                           │
│                 ┌────────────────────────────────────────────────────┐  │
│                 │ (None)                                              │  │
│                 │ ─── Pre-Meet ──────────────────────────────────── │  │
│                 │ Team Logos                                          │  │
│                 │ Team Stats                                     ✓   │  │
│                 │ ─── Event Frames ──────────────────────────────── │  │
│                 │ Vault Frame                                         │  │
│                 │ Uneven Bars Frame                                   │  │
│                 │ Balance Beam Frame                                  │  │
│                 │ Floor Frame                                         │  │
│                 │ ─── Live/Triggered ────────────────────────────── │  │
│                 │ Score Reveal                                        │  │
│                 │ Now Competing                                       │  │
│                 └────────────────────────────────────────────────────┘  │
│                                                                          │
│  Trigger Mode   [cued ▼]            Duration: [8] seconds                │
│                 ┌──────────────┐                                         │
│                 │ auto         │  Fires when segment starts              │
│                 │ cued     ✓   │  Waits for manual trigger               │
│                 │ on-score     │  Fires when score received              │
│                 │ timed        │  Fires after delay                      │
│                 └──────────────┘                                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Hardcoded Data (Phase 0)

```javascript
const DUMMY_GRAPHICS = [
  { id: 'team-logos', name: 'Team Logos', category: 'pre-meet' },
  { id: 'team-stats', name: 'Team Stats', category: 'pre-meet' },
  { id: 'event-frame-vt', name: 'Vault Frame', category: 'event-frame' },
  { id: 'event-frame-ub', name: 'Uneven Bars Frame', category: 'event-frame' },
  { id: 'event-frame-bb', name: 'Balance Beam Frame', category: 'event-frame' },
  { id: 'event-frame-fx', name: 'Floor Frame', category: 'event-frame' },
  { id: 'score-reveal', name: 'Score Reveal', category: 'live' },
  { id: 'now-competing', name: 'Now Competing', category: 'live' },
];

const CATEGORY_LABELS = {
  'pre-meet': 'Pre-Meet',
  'event-frame': 'Event Frames',
  'live': 'Live/Triggered',
};

const TRIGGER_MODES = [
  { value: 'auto', label: 'Auto', description: 'Fires when segment starts' },
  { value: 'cued', label: 'Cued', description: 'Waits for manual trigger' },
  { value: 'on-score', label: 'On Score', description: 'Fires when score received' },
  { value: 'timed', label: 'Timed', description: 'Fires after delay' },
];
```

### Behavior
- "(None)" option to clear selection
- Graphics grouped by category
- Trigger mode dropdown with descriptions
- Duration input for graphic display time
- Duration in seconds (not ms like transitions)

---

## 4. AudioPicker

### Purpose
Select an audio preset for the segment.

### Component API

```jsx
<AudioPicker
  value={string|null}                 // Selected preset ID
  onChange={(preset) => {}}           // Selection handler
  presets={[...]}                     // Available presets (hardcoded for Phase 0)
  disabled={boolean}                  // Disable picker
/>
```

### UI Layout

```
┌─ AUDIO CONFIGURATION ───────────────────────────────────────────────────┐
│                                                                          │
│  Preset         [Commentary Focus ▼]                                     │
│                 ┌────────────────────────────────────────────────────┐  │
│                 │ (None)                                              │  │
│                 │ Commentary Focus    Commentary 100%, Venue 30%      │  │
│                 │ Venue Focus         Venue 100%, Commentary 50%  ✓   │  │
│                 │ Music Only          Music 100%, others muted        │  │
│                 │ Full Mix            All sources balanced            │  │
│                 │ Muted               All sources muted               │  │
│                 └────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Hardcoded Data (Phase 0)

```javascript
const AUDIO_PRESETS = [
  {
    id: 'commentary-focus',
    name: 'Commentary Focus',
    description: 'Commentary 100%, Venue 30%',
    levels: { 'Commentary': 100, 'Venue Audio': 30, 'Music': 0 }
  },
  {
    id: 'venue-focus',
    name: 'Venue Focus',
    description: 'Venue 100%, Commentary 50%',
    levels: { 'Commentary': 50, 'Venue Audio': 100, 'Music': 0 }
  },
  {
    id: 'music-only',
    name: 'Music Only',
    description: 'Music 100%, others muted',
    levels: { 'Commentary': 0, 'Venue Audio': 0, 'Music': 100 }
  },
  {
    id: 'full-mix',
    name: 'Full Mix',
    description: 'All sources balanced',
    levels: { 'Commentary': 80, 'Venue Audio': 70, 'Music': 30 }
  },
  {
    id: 'muted',
    name: 'Muted',
    description: 'All sources muted',
    levels: { 'Commentary': 0, 'Venue Audio': 0, 'Music': 0 }
  },
];
```

### Behavior
- "(None)" option to clear selection
- Each preset shows name and description
- Levels shown as tooltip or secondary text (for Phase 0, just description)

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/components/rundown/pickers/ScenePicker.jsx` | 80-100 | OBS scene dropdown |
| `show-controller/src/components/rundown/pickers/TransitionPicker.jsx` | 60-80 | Transition type/duration |
| `show-controller/src/components/rundown/pickers/GraphicsPicker.jsx` | 100-120 | Graphics selection |
| `show-controller/src/components/rundown/pickers/AudioPicker.jsx` | 60-80 | Audio preset selection |
| `show-controller/src/components/rundown/pickers/Pickers.css` | 100 | Shared picker styles |
| `show-controller/src/components/rundown/pickers/index.js` | 10 | Barrel export |

---

## Shared Styling

All pickers share common styling:

```css
.picker-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picker-label {
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.picker-label.required::after {
  content: ' *';
  color: #e74c3c;
}

.picker-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.picker-select:focus {
  border-color: #3498db;
  outline: none;
}

.picker-select.error {
  border-color: #e74c3c;
}

.picker-error {
  font-size: 12px;
  color: #e74c3c;
}

.picker-group-header {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  background: #f5f5f5;
}
```

---

## Acceptance Criteria

### ScenePicker
- [ ] Dropdown shows all scenes grouped by category
- [ ] Category headers displayed as non-selectable
- [ ] Selected scene shows checkmark
- [ ] "Select scene..." placeholder when no selection
- [ ] Error state shows red border and message
- [ ] Calls `onChange(sceneName)` when selection changes

### TransitionPicker
- [ ] Dropdown shows Cut, Fade, Stinger options
- [ ] Duration input next to dropdown
- [ ] Duration disabled when type="Cut"
- [ ] Duration defaults to transition's defaultDuration
- [ ] Calls `onTypeChange` and `onDurationChange` appropriately

### GraphicsPicker
- [ ] Dropdown shows graphics grouped by category
- [ ] "(None)" option at top to clear selection
- [ ] Trigger mode dropdown below graphic selection
- [ ] Duration input for graphic display time
- [ ] Calls appropriate change handlers

### AudioPicker
- [ ] Dropdown shows all presets
- [ ] "(None)" option to clear selection
- [ ] Preset description shown in dropdown
- [ ] Calls `onChange(presetId)` when selection changes

---

## Phase 2 Changes

When integrating with real data (PRD-Rundown-07):

| Picker | Data Source |
|--------|-------------|
| ScenePicker | `useOBS().obsState.scenes` via Socket.io |
| TransitionPicker | `useOBS().obsState.transitions` via Socket.io |
| GraphicsPicker | Firebase `system/graphics/registry` |
| AudioPicker | Firebase audio presets |

The component APIs will remain the same; only the data passed as props will change.

---

## Dependencies

- PRD-Rundown-01: Parent page provides data to pass as props

---

## Next Steps

After this PRD is complete:
1. PRD-Rundown-03: SegmentDetail can integrate these pickers
2. PRD-Rundown-07: Connect to real data sources
