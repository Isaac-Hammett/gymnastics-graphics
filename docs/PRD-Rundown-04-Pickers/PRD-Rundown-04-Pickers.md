# PRD-Rundown-04: Picker Components

**Version:** 1.1
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-01-EditorPrototype, **PRD-Graphics-Registry**
**Blocks:** PRD-Rundown-03-SegmentDetail, PRD-Rundown-07-FrontendIntegration

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 6 - Pickers

---

## Overview

Picker components are reusable dropdown/selection components used in the SegmentDetail form.

**Key Dependencies:**
- **GraphicsPicker** depends on [PRD-Graphics-Registry](../PRD-Graphics-Registry/PRD-Graphics-Registry.md) - the schema-driven graphics system
- **ScenePicker** uses OBS scenes from competition setup (stored in Firebase, populated dynamically from OBS)

This PRD covers four picker components:
1. ScenePicker - OBS scene selection (from competition config)
2. TransitionPicker - OBS transition type and duration
3. GraphicsPicker - **Schema-driven** graphics selection from registry
4. AudioPicker - Audio preset selection

---

## 1. ScenePicker

### Purpose
Select an OBS scene from available scenes.

> **Note:** Scenes come dynamically from OBS during competition setup.
> They are stored in Firebase under the competition config and loaded at runtime.
> This picker does NOT control OBS - it just selects which scene should be used.
> The Producer View handles actual OBS scene switching during the live show.

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

## 3. GraphicsPicker (Schema-Driven)

> **Important:** This component depends on [PRD-Graphics-Registry](../PRD-Graphics-Registry/PRD-Graphics-Registry.md).
> The GraphicsPicker reads graphic definitions and parameter schemas from the registry,
> automatically rendering appropriate UI inputs for each graphic's parameters.

### Purpose
Select a graphic from the graphics registry with **automatic parameter UI generation**.

### Design Goals
1. **Scalability** - Adding new graphics requires no changes to this component
2. **Smart Recommendations** - Suggests graphics based on segment name keywords
3. **Schema-Driven UI** - Parameter inputs generated from graphic's param schema
4. **Competition-Aware** - Filters graphics and options based on competition type/gender

### Component API

```jsx
<GraphicsPicker
  // Competition context
  compType="womens-quad"              // Competition type for filtering
  teamNames={{ 1: 'UCLA', ... }}      // Team names for display and auto-fill
  competitionConfig={...}             // Full competition config for param auto-fill

  // Value (graphic + params)
  value={{
    graphicId: 'event-summary',       // Selected graphic ID (or null)
    params: {                         // Graphic-specific parameters
      summaryMode: 'rotation',
      summaryRotation: 1,
    },
  }}
  onChange={(value) => {}}            // Called with { graphicId, params }

  // Optional
  segmentName="Rotation 1 Summary"    // For smart recommendations
  disabled={boolean}                  // Disable picker
/>
```

### UI Layout

```
┌─ GRAPHIC ──────────────────────────────────────────────────────────────────┐
│                                                                             │
│  💡 Suggested: Event Summary (based on segment name)            [Use]       │
│                                                                             │
│  Graphic         [Event Summary ▼]                                          │
│                  ┌────────────────────────────────────────────────────┐    │
│                  │ (None)                                              │    │
│                  │ ─── Pre-Meet ──────────────────────────────────── │    │
│                  │ Team Logos                                          │    │
│                  │ UCLA Coaches                                        │    │
│                  │ Oregon Coaches                                      │    │
│                  │ ─── Event Frames ──────────────────────────────── │    │
│                  │ Vault Frame                                         │    │
│                  │ Uneven Bars Frame                                   │    │
│                  │ Balance Beam Frame                                  │    │
│                  │ Floor Frame                                         │    │
│                  │ ─── Event Summary ────────────────────────────── │    │
│                  │ Event Summary                                   ✓   │    │
│                  │ ─── Leaderboards ─────────────────────────────── │    │
│                  │ VT Leaders                                          │    │
│                  │ UB Leaders                                          │    │
│                  └────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ Parameters (from schema) ─────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  Mode           [By Rotation ▼]     ← enum param                        ││
│  │                                                                         ││
│  │  Rotation       [R1 ▼]              ← number param (dependsOn: mode)    ││
│  │                                                                         ││
│  │  Theme          [ESPN ▼]            ← enum param                        ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  Note: Parameters with source: 'competition' are auto-filled and hidden    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Get Available Graphics**
   ```javascript
   import { getAllGraphicsForCompetition } from '@/lib/graphicsRegistry';
   const graphics = getAllGraphicsForCompetition(compType, teamNames);
   // Returns filtered list based on gender, team count
   ```

2. **Get Recommendation**
   ```javascript
   import { getRecommendedGraphic } from '@/lib/graphicsRegistry';
   const suggestion = getRecommendedGraphic(segmentName, compType, teamNames);
   // Returns { id: 'event-summary', label: 'Event Summary', confidence: 0.8 }
   ```

3. **Get Parameter Schema**
   ```javascript
   import { getGraphicSchema } from '@/lib/graphicsRegistry';
   const schema = getGraphicSchema(selectedGraphicId);
   // Returns full graphic definition with params schema
   ```

4. **Render Parameter Inputs**
   - For each param in `schema.params`:
     - Skip if `source: 'competition'` (auto-filled)
     - Skip if `dependsOn` condition not met
     - Render input based on `type`:
       - `enum` → dropdown
       - `number` → number input
       - `string` → text input
       - `boolean` → checkbox

### Behavior
- "(None)" option to clear graphic selection
- Graphics grouped by category with headers
- Smart recommendation shown when segment name matches keywords
- Parameter inputs appear/disappear based on `dependsOn` conditions
- Params with `source: 'competition'` are auto-filled and hidden
- Dropdown options filtered by gender (e.g., no pommel horse for women's)
- Team-specific graphics show actual team names (e.g., "UCLA Coaches" not "Team 1 Coaches")

### Segment Data Structure

When saved, a segment stores:

```javascript
{
  graphic: {
    graphicId: 'event-summary',
    params: {
      summaryMode: 'rotation',
      summaryRotation: 1,
      summaryTheme: 'espn',
    },
  },
}
```

This is **abstract** - works in templates across different competitions.

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

### GraphicsPicker (Schema-Driven)
- [ ] Reads graphics from `graphicsRegistry.js`
- [ ] Dropdown shows graphics filtered by competition type/gender
- [ ] Graphics grouped by category
- [ ] Team-specific graphics show actual team names (e.g., "UCLA Coaches")
- [ ] "(None)" option at top to clear selection
- [ ] Smart recommendation shown based on segment name keywords
- [ ] Parameter inputs rendered automatically from schema
- [ ] `enum` params → dropdown
- [ ] `number` params → number input with min/max
- [ ] Params with `dependsOn` show/hide based on other param values
- [ ] Params with `source: 'competition'` are auto-filled and hidden
- [ ] Returns `{ graphicId, params }` on change

### AudioPicker
- [ ] Dropdown shows all presets
- [ ] "(None)" option to clear selection
- [ ] Preset description shown in dropdown
- [ ] Calls `onChange(presetId)` when selection changes

---

## Data Sources

| Picker | Data Source |
|--------|-------------|
| ScenePicker | Competition config in Firebase (populated from OBS during setup) |
| TransitionPicker | Hardcoded options (Cut, Fade, Stinger) |
| GraphicsPicker | `graphicsRegistry.js` (schema-driven) |
| AudioPicker | Hardcoded presets (future: Firebase) |

---

## Dependencies

- **PRD-Rundown-01**: Parent page provides competition context
- **PRD-Graphics-Registry**: GraphicsPicker depends on the schema-driven registry

---

## Next Steps

After this PRD is complete:
1. PRD-Rundown-03: SegmentDetail can integrate these pickers
2. PRD-Rundown-07: Connect to Firebase for persistence
