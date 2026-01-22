# PRD-Rundown-07: Frontend Integration (Phase 2)

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-06-BackendServices
**Blocks:** PRD-Rundown-08-ProducerIntegration

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 14 - Phase 2

---

## Overview

This PRD covers connecting the Phase 0 prototype components to real data sources:
- Replace hardcoded segments with Firebase data via API
- Replace hardcoded scenes with OBS data via Socket.io
- Replace hardcoded graphics with Graphics Registry from Firebase
- Create `useRundown()` hook and `RundownContext`

---

## Scope

### In Scope
- `useRundown()` hook for CRUD operations
- `RundownContext` for shared state
- Connect pickers to real data sources
- Milestone timeline component
- Selection summary component

### Out of Scope
- Producer View integration (see PRD-Rundown-08)
- Template system (see PRD-Rundown-09)
- Import/Export (see PRD-Rundown-10)

---

## Hook: useRundown

### Location
`show-controller/src/hooks/useRundown.js`

### API

```javascript
const {
  // Data
  segments,                  // Array of segments (sorted by order)
  milestones,                // Array of milestones
  loading,                   // Boolean
  error,                     // Error object or null

  // CRUD Operations
  createSegment,             // (segmentData, insertAfterOrder?) => Promise
  updateSegment,             // (segmentId, updates) => Promise
  deleteSegment,             // (segmentId) => Promise
  reorderSegment,            // (segmentId, newOrder) => Promise

  // Selection (for multi-select features)
  selectedIds,               // Array of selected segment IDs
  setSelectedIds,            // (ids) => void
  selectAll,                 // () => void
  clearSelection,            // () => void
  getSelectedDuration,       // () => number (total seconds)

  // Helpers
  getSegmentById,            // (id) => segment or undefined
  getSegmentAtOrder,         // (order) => segment or undefined
  refresh,                   // () => Promise (force refresh from API)
} = useRundown();
```

### Implementation

```javascript
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useShow } from '../context/ShowContext';

const API_BASE = process.env.REACT_APP_API_URL || '';

export function useRundown() {
  const { compId } = useShow();

  const [segments, setSegments] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // Fetch rundown
  const fetchRundown = useCallback(async () => {
    if (!compId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/rundown`, {
        headers: { 'X-Competition-Id': compId },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rundown: ${response.statusText}`);
      }

      const data = await response.json();
      setSegments(data.segments || []);
      setMilestones(data.milestones || []);
    } catch (err) {
      setError(err);
      console.error('Error fetching rundown:', err);
    } finally {
      setLoading(false);
    }
  }, [compId]);

  // Initial fetch
  useEffect(() => {
    fetchRundown();
  }, [fetchRundown]);

  // Create segment
  const createSegment = useCallback(async (segmentData, insertAfterOrder = -1) => {
    try {
      const response = await fetch(`${API_BASE}/api/rundown/segments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Competition-Id': compId,
        },
        body: JSON.stringify({ segment: segmentData, insertAfterOrder }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create segment: ${response.statusText}`);
      }

      const created = await response.json();

      // Refresh to get updated order values
      await fetchRundown();

      return created;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [compId, fetchRundown]);

  // Update segment
  const updateSegment = useCallback(async (segmentId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/api/rundown/segments/${segmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Competition-Id': compId,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update segment: ${response.statusText}`);
      }

      const updated = await response.json();

      // Update local state
      setSegments(prev => prev.map(s => s.id === segmentId ? updated : s));

      // Refresh milestones if timing changed
      if ('timing' in updates || 'type' in updates) {
        await fetchRundown();
      }

      return updated;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [compId, fetchRundown]);

  // Delete segment
  const deleteSegment = useCallback(async (segmentId) => {
    try {
      const response = await fetch(`${API_BASE}/api/rundown/segments/${segmentId}`, {
        method: 'DELETE',
        headers: { 'X-Competition-Id': compId },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete segment: ${response.statusText}`);
      }

      // Refresh to get updated order values
      await fetchRundown();

      // Clear from selection if selected
      setSelectedIds(prev => prev.filter(id => id !== segmentId));
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [compId, fetchRundown]);

  // Reorder segment
  const reorderSegment = useCallback(async (segmentId, newOrder) => {
    try {
      const response = await fetch(`${API_BASE}/api/rundown/segments/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Competition-Id': compId,
        },
        body: JSON.stringify({ segmentId, newOrder }),
      });

      if (!response.ok) {
        throw new Error(`Failed to reorder segment: ${response.statusText}`);
      }

      const { segments: updatedSegments } = await response.json();
      setSegments(updatedSegments);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [compId]);

  // Selection helpers
  const selectAll = useCallback(() => {
    setSelectedIds(segments.map(s => s.id));
  }, [segments]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const getSelectedDuration = useCallback(() => {
    return selectedIds
      .map(id => segments.find(s => s.id === id))
      .filter(s => s && s.timing?.duration)
      .reduce((sum, s) => sum + s.timing.duration, 0);
  }, [selectedIds, segments]);

  // Getters
  const getSegmentById = useCallback((id) => {
    return segments.find(s => s.id === id);
  }, [segments]);

  const getSegmentAtOrder = useCallback((order) => {
    return segments.find(s => s.order === order);
  }, [segments]);

  return {
    segments,
    milestones,
    loading,
    error,
    createSegment,
    updateSegment,
    deleteSegment,
    reorderSegment,
    selectedIds,
    setSelectedIds,
    selectAll,
    clearSelection,
    getSelectedDuration,
    getSegmentById,
    getSegmentAtOrder,
    refresh: fetchRundown,
  };
}
```

---

## Context: RundownContext

### Location
`show-controller/src/context/RundownContext.jsx`

### Purpose
Share rundown state across components without prop drilling.

### Implementation

```jsx
import React, { createContext, useContext } from 'react';
import { useRundown } from '../hooks/useRundown';

const RundownContext = createContext(null);

export function RundownProvider({ children }) {
  const rundown = useRundown();

  return (
    <RundownContext.Provider value={rundown}>
      {children}
    </RundownContext.Provider>
  );
}

export function useRundownContext() {
  const context = useContext(RundownContext);
  if (!context) {
    throw new Error('useRundownContext must be used within RundownProvider');
  }
  return context;
}
```

### Usage in App.jsx

```jsx
import { RundownProvider } from './context/RundownContext';

// Wrap rundown routes
<Route path="/:compId/rundown" element={
  <RundownProvider>
    <RundownEditorPage />
  </RundownProvider>
} />
```

---

## Picker Integration

### ScenePicker - Connect to OBS

```jsx
// Before (hardcoded)
<ScenePicker scenes={DUMMY_SCENES} ... />

// After (real OBS data)
import { useOBS } from '../context/OBSContext';

function ScenePickerConnected(props) {
  const { obsState, isConnected } = useOBS();

  const scenes = obsState?.scenes || [];
  const warning = !isConnected ? 'OBS not connected' : null;

  return (
    <ScenePicker
      {...props}
      scenes={scenes}
      warning={warning}
    />
  );
}
```

### TransitionPicker - Connect to OBS

```jsx
import { useOBS } from '../context/OBSContext';

function TransitionPickerConnected(props) {
  const { obsState } = useOBS();

  const transitions = obsState?.transitions || [
    { name: 'Cut', configurable: false },
    { name: 'Fade', configurable: true, defaultDuration: 300 },
  ];

  return <TransitionPicker {...props} transitions={transitions} />;
}
```

### GraphicsPicker - Connect to Graphics Registry

```jsx
import { useState, useEffect } from 'react';
import { useShow } from '../context/ShowContext';

function GraphicsPickerConnected(props) {
  const { competition } = useShow();
  const [graphics, setGraphics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRegistry() {
      try {
        const response = await fetch('/api/graphics/registry');
        const registry = await response.json();

        // Filter by gender if competition has gender
        const gender = competition?.gender; // "mens" or "womens"
        const filtered = Object.values(registry.graphics || {})
          .filter(g => !g.genderFilter || g.genderFilter === gender);

        setGraphics(filtered);
      } catch (err) {
        console.error('Failed to fetch graphics registry:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRegistry();
  }, [competition]);

  return (
    <GraphicsPicker
      {...props}
      graphics={graphics}
      loading={loading}
    />
  );
}
```

### AudioPicker - Connect to Firebase (if audio presets exist)

```jsx
// For now, audio presets may still be hardcoded or loaded from Firebase
// This can be expanded when audio preset management is implemented
```

---

## Component: MilestoneTimeline

### Location
`show-controller/src/components/rundown/MilestoneTimeline.jsx`

### Purpose
Visual timeline showing milestones with click-to-select functionality.

### UI Layout

```
┌─ TIME MILESTONES ───────────────────────────────────────────────────────┐
│                                                                          │
│  ●─────────●─────────●─────────────────────●─────────●─────────────●    │
│  │         │         │                     │         │             │    │
│  0:00      2:30      6:00                  45:00     50:00         2:15:00
│  Show      Welcome   First                 Halftime  Rotation 3    Meet
│  Start     & Host    Routine               Start     Start         End
│                                                                          │
│  [Click milestone to select all segments up to that point]              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```jsx
import React from 'react';
import { useRundownContext } from '../../context/RundownContext';
import './MilestoneTimeline.css';

export function MilestoneTimeline({ onMilestoneClick }) {
  const { milestones, segments } = useRundownContext();

  if (!milestones.length) return null;

  const totalDuration = milestones.find(m => m.type === 'meet-end')?.time || 0;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleClick = (milestone) => {
    // Select all segments up to this milestone
    const segmentIds = segments
      .filter(s => s.order <= milestone.segmentIndex)
      .map(s => s.id);

    onMilestoneClick?.(segmentIds, milestone);
  };

  return (
    <div className="milestone-timeline">
      <div className="timeline-track">
        {milestones.map((milestone, index) => {
          const position = totalDuration > 0
            ? (milestone.time / totalDuration) * 100
            : 0;

          return (
            <div
              key={index}
              className={`milestone-marker milestone-${milestone.type}`}
              style={{ left: `${position}%` }}
              onClick={() => handleClick(milestone)}
              title={`${milestone.label} at ${formatTime(milestone.time)}`}
            >
              <div className="milestone-dot" />
              <div className="milestone-label">
                <span className="milestone-time">{formatTime(milestone.time)}</span>
                <span className="milestone-name">{milestone.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Component: SelectionSummary

### Location
`show-controller/src/components/rundown/SelectionSummary.jsx`

### Purpose
Shows count, total duration, and comparison to target milestone.

### UI Layout

```
┌─ SELECTION SUMMARY ─────────────────────────────────────────────────────┐
│                                                                          │
│  ✓ 5 segments selected              │  Target Milestone: [First Routine ▼]
│                                      │  Target Time: 6:00
│  Total Duration: 5:23               │
│                                      │  ┌──────────────────┐
│  ████████████████████░░░░░░░░░░░░░  │  │ 0:37 remaining   │  ✓ FITS
│                                      │  └──────────────────┘
│                                      │
│  [Clear Selection]  [Delete Selected]  [Duplicate Selected]             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```jsx
import React, { useState, useMemo } from 'react';
import { useRundownContext } from '../../context/RundownContext';
import './SelectionSummary.css';

export function SelectionSummary({ onDeleteSelected }) {
  const {
    selectedIds,
    milestones,
    getSelectedDuration,
    clearSelection,
  } = useRundownContext();

  const [targetMilestoneType, setTargetMilestoneType] = useState('first-routine');

  const selectedCount = selectedIds.length;
  const totalDuration = getSelectedDuration();

  const targetMilestone = useMemo(() => {
    return milestones.find(m => m.type === targetMilestoneType);
  }, [milestones, targetMilestoneType]);

  const targetTime = targetMilestone?.time || 0;
  const remaining = targetTime - totalDuration;

  const status = useMemo(() => {
    if (remaining < 0) return 'over';
    if (remaining < 30) return 'tight';
    return 'fits';
  }, [remaining]);

  const formatTime = (seconds) => {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.abs(seconds) % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (selectedCount === 0) return null;

  return (
    <div className="selection-summary">
      <div className="summary-left">
        <div className="summary-count">✓ {selectedCount} segments selected</div>
        <div className="summary-duration">Total Duration: {formatTime(totalDuration)}</div>
        <div className="summary-progress">
          <div
            className="progress-fill"
            style={{ width: `${Math.min((totalDuration / targetTime) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="summary-right">
        <div className="target-selector">
          <label>Target Milestone:</label>
          <select
            value={targetMilestoneType}
            onChange={(e) => setTargetMilestoneType(e.target.value)}
          >
            {milestones.map(m => (
              <option key={m.type} value={m.type}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="target-time">Target Time: {formatTime(targetTime)}</div>
        <div className={`status status-${status}`}>
          {remaining >= 0
            ? `${formatTime(remaining)} remaining`
            : `${formatTime(remaining)} OVER`
          }
          {status === 'fits' && ' ✓ FITS'}
          {status === 'tight' && ' ⚠️ TIGHT'}
          {status === 'over' && ' ❌ OVER'}
        </div>
      </div>

      <div className="summary-actions">
        <button onClick={clearSelection}>Clear Selection</button>
        <button
          onClick={onDeleteSelected}
          className="btn-danger"
          disabled={selectedCount === 0}
        >
          Delete Selected
        </button>
      </div>
    </div>
  );
}
```

---

## Update RundownEditorPage

### Changes

```jsx
// Before (hardcoded)
const [segments, setSegments] = useState(DUMMY_SEGMENTS);

// After (from context)
import { useRundownContext, RundownProvider } from '../context/RundownContext';

function RundownEditorPageContent() {
  const {
    segments,
    milestones,
    loading,
    error,
    createSegment,
    updateSegment,
    deleteSegment,
    reorderSegment,
    selectedIds,
    setSelectedIds,
  } = useRundownContext();

  // ... rest of component uses context
}

// Wrap with provider
export function RundownEditorPage() {
  return (
    <RundownProvider>
      <RundownEditorPageContent />
    </RundownProvider>
  );
}
```

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/hooks/useRundown.js` | 150-180 | Rundown CRUD operations |
| `show-controller/src/context/RundownContext.jsx` | 30-40 | Shared rundown state |
| `show-controller/src/components/rundown/MilestoneTimeline.jsx` | 80-100 | Visual milestone timeline |
| `show-controller/src/components/rundown/MilestoneTimeline.css` | 80 | Timeline styling |
| `show-controller/src/components/rundown/SelectionSummary.jsx` | 100-120 | Selection summary panel |
| `show-controller/src/components/rundown/SelectionSummary.css` | 60 | Summary styling |

---

## Files to Modify

| File | Changes |
|------|---------|
| `show-controller/src/pages/RundownEditorPage.jsx` | Use `useRundownContext()` instead of local state |
| `show-controller/src/components/rundown/SegmentList.jsx` | Use context for data |
| `show-controller/src/components/rundown/SegmentDetail.jsx` | Call context CRUD methods |
| `show-controller/src/components/rundown/pickers/ScenePicker.jsx` | Accept real OBS scenes |
| `show-controller/src/components/rundown/pickers/GraphicsPicker.jsx` | Fetch from registry |
| `show-controller/src/App.jsx` | Wrap rundown route with RundownProvider |

---

## Acceptance Criteria

### useRundown Hook
- [ ] `segments` is fetched from API on mount
- [ ] `milestones` is fetched alongside segments
- [ ] `loading` is true during fetch
- [ ] `error` is set on fetch failure
- [ ] `createSegment()` calls API and refreshes
- [ ] `updateSegment()` calls API and updates local state
- [ ] `deleteSegment()` calls API and refreshes
- [ ] `reorderSegment()` calls API and updates order
- [ ] Selection state tracks selected IDs
- [ ] `getSelectedDuration()` calculates total

### RundownContext
- [ ] Provides all useRundown values to children
- [ ] Error thrown if used outside provider

### Picker Integration
- [ ] ScenePicker shows real OBS scenes from obsState
- [ ] ScenePicker shows warning when OBS disconnected
- [ ] GraphicsPicker fetches from `/api/graphics/registry`
- [ ] GraphicsPicker filters by competition gender

### MilestoneTimeline
- [ ] Shows all milestones on timeline
- [ ] Milestone positions proportional to time
- [ ] Click milestone selects segments up to that point
- [ ] Time labels formatted correctly

### SelectionSummary
- [ ] Shows selected count
- [ ] Shows total duration of selected segments
- [ ] Target milestone dropdown works
- [ ] Progress bar shows fill relative to target
- [ ] Status indicator (FITS/TIGHT/OVER) correct
- [ ] Clear Selection clears selectedIds
- [ ] Delete Selected calls delete API

---

## Dependencies

- PRD-Rundown-06: Backend services must be complete
- OBSContext: Already exists, provides obsState
- ShowContext: Already exists, provides compId

---

## Next Steps

After this PRD is complete:
1. PRD-Rundown-08: Full Producer View integration
