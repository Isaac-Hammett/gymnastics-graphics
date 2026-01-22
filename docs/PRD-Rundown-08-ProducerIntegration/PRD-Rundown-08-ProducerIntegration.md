# PRD-Rundown-08: Producer View Integration (Phase 3)

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-07-FrontendIntegration
**Blocks:** None (can be done in parallel with PRD-Rundown-09, PRD-Rundown-10)

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 14 - Phase 3, Section 8 - Producer View Integration

---

## Overview

This PRD covers integrating rundown editing capabilities into the **production** Producer View. This is the final step that brings the rundown editor features into the real show execution workflow.

**Note:** The core Producer View components (`CurrentSegment.jsx`, `NextSegment.jsx`, `RunOfShow.jsx`) already exist and use `useTimesheet()`. This phase adds:
- Segment CRUD operations from Producer View
- OBS scene switching on segment advance
- Graphics triggering based on segment config
- Enhanced UI for segment editing during show

---

## Scope

### In Scope
- Add segment editing UI to ProducerPage
- OBS scene switching on segment advance
- Graphics triggering (auto, cued, on-score)
- Inline segment editing
- Quick-add segment during show
- Graphics picker integration

### Out of Scope
- Creating new timing/control components (already exist)
- Template system (see PRD-Rundown-09)
- Import/Export (see PRD-Rundown-10)

### Cleanup
- Remove `/rundown-preview` route (no longer needed)
- Remove `RundownPreviewPage.jsx`

---

## Producer View Architecture

```
ProducerPage.jsx
├── Header (competition info, show status)
├── CurrentSegment.jsx (existing - uses useTimesheet)
│   └── Enhanced: Show segment's graphic with Fire button
├── NextSegment.jsx (existing - uses useTimesheet)
│   └── Enhanced: Show next segment's graphic
├── ShowControls (existing - Start/Stop/Next/Previous)
│   └── Enhanced: Trigger OBS scene switch on advance
├── RunOfShow.jsx (existing - uses useTimesheet)
│   └── Enhanced: Add [Edit] buttons, inline editing
├── GraphicsPanel (new or enhanced)
│   └── Current segment's graphics queue
└── InlineSegmentEditor (conditional)
```

---

## Feature 1: OBS Scene Switching on Segment Advance

### Implementation

When a segment is advanced (via `advance()` from useTimesheet), automatically switch to the segment's configured OBS scene.

```jsx
// In ProducerPage.jsx or a new hook

import { useOBS } from '../context/OBSContext';
import { useTimesheet } from '../hooks/useTimesheet';

function useSegmentOBSSync() {
  const { currentSegment } = useTimesheet();
  const { switchScene } = useOBS();
  const prevSegmentId = useRef(null);

  useEffect(() => {
    // Only switch when segment changes
    if (currentSegment && currentSegment.id !== prevSegmentId.current) {
      prevSegmentId.current = currentSegment.id;

      // Get OBS scene from segment config
      const sceneId = currentSegment.obs?.sceneId;
      const transition = currentSegment.obs?.transition;

      if (sceneId) {
        switchScene(sceneId, transition?.type, transition?.duration);
      }
    }
  }, [currentSegment, switchScene]);
}
```

### Transition Support

```javascript
// OBSContext already supports transitions
switchScene(sceneName, transitionType, transitionDuration);

// Called with segment config:
switchScene(
  currentSegment.obs.sceneId,        // "Single - Camera 2"
  currentSegment.obs.transition.type, // "Fade"
  currentSegment.obs.transition.duration // 300
);
```

---

## Feature 2: Graphics Triggering

### Trigger Modes

| Mode | When Triggered | Implementation |
|------|----------------|----------------|
| `auto` | Immediately when segment starts | useEffect on segment change |
| `cued` | Manual button press | Fire button in UI |
| `on-score` | When score received from Virtius | Socket event listener |
| `timed` | After specified delay | setTimeout from segment start |

### Implementation

```jsx
// hooks/useSegmentGraphics.js

import { useEffect, useRef, useCallback } from 'react';
import { useTimesheet } from './useTimesheet';
import { useShow } from '../context/ShowContext';

export function useSegmentGraphics() {
  const { currentSegment, elapsed } = useTimesheet();
  const { triggerGraphic } = useShow(); // Existing function to fire graphics
  const prevSegmentId = useRef(null);
  const timedGraphicTimeout = useRef(null);

  // Get primary graphic config
  const graphicConfig = currentSegment?.graphics?.primary;

  // Handle auto-trigger on segment change
  useEffect(() => {
    if (!currentSegment || currentSegment.id === prevSegmentId.current) return;
    prevSegmentId.current = currentSegment.id;

    // Clear any pending timed trigger
    if (timedGraphicTimeout.current) {
      clearTimeout(timedGraphicTimeout.current);
    }

    if (!graphicConfig) return;

    const { graphicId, triggerMode, delay, parameters, duration } = graphicConfig;

    if (triggerMode === 'auto') {
      // Fire immediately
      triggerGraphic(graphicId, parameters, duration);
    } else if (triggerMode === 'timed' && delay) {
      // Fire after delay
      timedGraphicTimeout.current = setTimeout(() => {
        triggerGraphic(graphicId, parameters, duration);
      }, delay * 1000);
    }
    // 'cued' and 'on-score' handled elsewhere

    return () => {
      if (timedGraphicTimeout.current) {
        clearTimeout(timedGraphicTimeout.current);
      }
    };
  }, [currentSegment, graphicConfig, triggerGraphic]);

  // Manual fire for cued graphics
  const fireGraphic = useCallback(() => {
    if (graphicConfig) {
      const { graphicId, parameters, duration } = graphicConfig;
      triggerGraphic(graphicId, parameters, duration);
    }
  }, [graphicConfig, triggerGraphic]);

  return {
    currentGraphic: graphicConfig,
    fireGraphic,
    canFire: graphicConfig?.triggerMode === 'cued',
  };
}
```

### On-Score Trigger

```jsx
// Listen for score events from Virtius
useEffect(() => {
  const handleScoreReceived = (scoreData) => {
    const onScoreGraphic = currentSegment?.graphics?.onScore;
    if (onScoreGraphic?.autoTrigger) {
      triggerGraphic(
        onScoreGraphic.graphicId,
        { ...onScoreGraphic.parameters, score: scoreData },
        onScoreGraphic.duration
      );
    }
  };

  socket.on('virtius:scoreReceived', handleScoreReceived);
  return () => socket.off('virtius:scoreReceived', handleScoreReceived);
}, [currentSegment, triggerGraphic]);
```

---

## Feature 3: Enhanced CurrentSegment UI

### UI Layout

```
┌─ NOW PLAYING ───────────────────────────────────────────────────────────┐
│                                                                          │
│  ▶️  UCLA Introduction                                                   │
│      Live Segment                                                        │
│                                                                          │
│  [████████████████████████████░░░░░░░░░░░░░]  0:08 / 0:10               │
│                                                                          │
│  OBS: Single - Camera 2          Transition: Fade 300ms                  │
│                                                                          │
│  ┌─ GRAPHIC ────────────────────────────────────────────────────────┐   │
│  │  🎨 UCLA Stats                    Trigger: Cued                   │   │
│  │     Duration: 8s                  Status: Ready                   │   │
│  │                                                                    │   │
│  │  [Preview]                                              [🔥 FIRE] │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  NOTES: Wait for talent to finish host intro                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```jsx
// components/CurrentSegmentEnhanced.jsx

import { useSegmentGraphics } from '../hooks/useSegmentGraphics';

export function CurrentSegmentEnhanced() {
  const { currentSegment, elapsed, remaining, progress, formatTime } = useTimesheet();
  const { currentGraphic, fireGraphic, canFire } = useSegmentGraphics();

  if (!currentSegment) return null;

  return (
    <div className="now-playing">
      <div className="segment-header">
        <span className="status-icon">▶️</span>
        <span className="segment-name">{currentSegment.name}</span>
        <span className="segment-type">{currentSegment.type} Segment</span>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="timing">
        {formatTime(elapsed)} / {formatTime(currentSegment.timing?.duration * 1000)}
      </div>

      <div className="obs-info">
        <span>OBS: {currentSegment.obs?.sceneId}</span>
        <span>
          Transition: {currentSegment.obs?.transition?.type}
          {currentSegment.obs?.transition?.duration && ` ${currentSegment.obs.transition.duration}ms`}
        </span>
      </div>

      {currentGraphic && (
        <div className="graphic-panel">
          <div className="graphic-info">
            <span className="graphic-icon">🎨</span>
            <span className="graphic-name">{currentGraphic.graphicId}</span>
            <span className="trigger-mode">Trigger: {currentGraphic.triggerMode}</span>
          </div>
          <div className="graphic-details">
            <span>Duration: {currentGraphic.duration}s</span>
            <span>Status: Ready</span>
          </div>
          <div className="graphic-actions">
            <button className="btn-preview">Preview</button>
            {canFire && (
              <button className="btn-fire" onClick={fireGraphic}>
                🔥 FIRE
              </button>
            )}
          </div>
        </div>
      )}

      {currentSegment.notes && (
        <div className="notes">
          NOTES: {currentSegment.notes}
        </div>
      )}
    </div>
  );
}
```

---

## Feature 4: Inline Segment Editing in RunOfShow

### Enhanced RunOfShow with Edit Buttons

```jsx
// components/RunOfShowEnhanced.jsx

import { useState } from 'react';
import { useRundownContext } from '../context/RundownContext';
import { InlineSegmentEditor } from './rundown/InlineSegmentEditor';

export function RunOfShowEnhanced() {
  const { segments } = useTimesheet();
  const { updateSegment } = useRundownContext();
  const [editingId, setEditingId] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const handleEdit = (segmentId) => {
    setEditingId(segmentId);
  };

  const handleSave = async (segment) => {
    await updateSegment(segment.id, segment);
    setEditingId(null);
  };

  return (
    <div className="run-of-show enhanced">
      <div className="ros-header">
        <h3>Show Progress</h3>
        <label>
          <input
            type="checkbox"
            checked={editMode}
            onChange={(e) => setEditMode(e.target.checked)}
          />
          Edit Mode
        </label>
      </div>

      <div className="segment-list">
        {segments.map((segment, index) => (
          <div key={segment.id} className="segment-row">
            <span className="segment-status">
              {segment.status === 'complete' ? '✅' :
               segment.status === 'current' ? '▶️' : '⬜'}
            </span>
            <span className="segment-name">{segment.name}</span>
            <span className="segment-duration">
              {segment.timing?.duration
                ? `${Math.floor(segment.timing.duration / 60)}:${(segment.timing.duration % 60).toString().padStart(2, '0')}`
                : 'var'}
            </span>
            {editMode && (
              <button
                className="btn-edit"
                onClick={() => handleEdit(segment.id)}
              >
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      {editingId && (
        <InlineSegmentEditor
          segment={segments.find(s => s.id === editingId)}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
```

---

## Feature 5: Quick-Add Segment During Show

### UI

Add a "+ Quick Add" button in the RunOfShow that creates a minimal segment after the current one.

```jsx
const handleQuickAdd = async () => {
  const { currentIndex } = useTimesheet();
  const currentSegment = segments[currentIndex];

  await createSegment({
    name: 'New Segment',
    type: 'live',
    timing: { duration: 30, autoAdvance: true },
    obs: { sceneId: currentSegment?.obs?.sceneId || 'Single - Camera 1' },
  }, currentSegment?.order ?? -1);
};
```

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/hooks/useSegmentOBSSync.js` | 40-50 | Auto scene switch on advance |
| `show-controller/src/hooks/useSegmentGraphics.js` | 80-100 | Graphics trigger logic |
| `show-controller/src/components/CurrentSegmentEnhanced.jsx` | 120-150 | Enhanced now playing panel |
| `show-controller/src/components/CurrentSegmentEnhanced.css` | 80 | Styling |

---

## Files to Modify

| File | Changes |
|------|---------|
| `show-controller/src/pages/ProducerPage.jsx` | Use enhanced components, add edit mode |
| `show-controller/src/components/RunOfShow.jsx` | Add edit buttons, inline editor integration |
| `show-controller/src/App.jsx` | Remove `/rundown-preview` route |

---

## Files to Delete

| File | Reason |
|------|--------|
| `show-controller/src/pages/RundownPreviewPage.jsx` | Prototype no longer needed |

---

## Acceptance Criteria

### OBS Scene Switching
- [ ] Scene changes automatically when segment advances
- [ ] Transition type respected (Cut, Fade, Stinger)
- [ ] Transition duration respected
- [ ] No switch if segment has no sceneId configured

### Graphics Triggering
- [ ] Auto graphics fire when segment starts
- [ ] Cued graphics show Fire button
- [ ] Fire button triggers graphic
- [ ] Timed graphics fire after delay
- [ ] On-score graphics fire when score received

### Enhanced CurrentSegment
- [ ] Shows OBS scene and transition info
- [ ] Shows current graphic config
- [ ] Fire button visible for cued graphics
- [ ] Notes displayed if present

### Inline Editing
- [ ] Edit Mode toggle in RunOfShow
- [ ] Edit buttons appear when edit mode on
- [ ] Clicking Edit opens inline editor
- [ ] Save updates segment via API
- [ ] Cancel closes editor

### Quick Add
- [ ] Quick Add button in RunOfShow
- [ ] Creates segment after current
- [ ] Uses reasonable defaults
- [ ] Segment appears in list

### Cleanup
- [ ] `/rundown-preview` route removed
- [ ] `RundownPreviewPage.jsx` deleted

---

## Dependencies

- PRD-Rundown-07: Frontend integration complete
- OBSContext: `switchScene()` function
- ShowContext: `triggerGraphic()` function
- useTimesheet: Segment timing and control

---

## Next Steps

After this PRD is complete:
- PRD-Rundown-09: Template system (can start in parallel)
- PRD-Rundown-10: Import/Export (can start in parallel)
