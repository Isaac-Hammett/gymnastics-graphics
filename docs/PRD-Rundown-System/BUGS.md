# Rundown System - Bug Tracker

## BUG-004: SHOW PROGRESS Falls Back to Legacy showConfig.segments (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** High
**Status:** FIXED

### Symptoms

1. User loads rundown and starts show
2. "NOW PLAYING" panel shows correct segment (e.g., "Team 1 Introduction")
3. "SHOW PROGRESS" panel shows completely DIFFERENT segments (e.g., "Event Intro", "National Anthem")
4. The segments in SHOW PROGRESS don't match the loaded rundown at all

### Root Cause

The `TimesheetEngine.getState()` method did NOT include the `segments` array in its return value. This caused a chain of problems:

1. Client connects to server
2. Server sends `timesheetState` from `engine.getState()` - **missing `segments` array**
3. Client's `timesheetState.segments` is `undefined`
4. In `useTimesheet.js`, the segments fall back: `timesheetState?.segments || state?.showConfig?.segments`
5. **SHOW PROGRESS displays segments from the GLOBAL legacy `showConfig` (loaded from server/config/show-config.json)**
6. But **NOW PLAYING** correctly displays `timesheetState.currentSegment` from the competition's engine

### Code Location (Before Fix)

```javascript
// server/lib/timesheetEngine.js - getState() missing segments
getState() {
  return {
    state: this._state,
    currentSegmentIndex: this._currentSegmentIndex,
    currentSegment: this._currentSegment,
    // ... other properties ...
    segmentCount: this.segments.length,  // <-- Only includes count, NOT the array
    // segments: this.segments  // <-- MISSING!
  };
}

// show-controller/src/hooks/useTimesheet.js - fallback to legacy
const segments = useMemo(() => {
  return timesheetState?.segments || state?.showConfig?.segments || [];  // <-- Falls back!
}, [timesheetState?.segments, state?.showConfig?.segments]);
```

### Fix Applied

1. **Added `segments` array to `getState()` in TimesheetEngine:**

```javascript
// server/lib/timesheetEngine.js
getState() {
  return {
    // ... other properties ...
    segments: this.segments,  // <-- NOW INCLUDED
    segmentCount: this.segments.length,
  };
}
```

2. **Include segments when sending initial state on connection:**

```javascript
// server/index.js
const compTimesheetEngine = clientCompId ? getEngine(clientCompId) : timesheetEngine;
if (compTimesheetEngine) {
  const state = compTimesheetEngine.getState();
  const segments = compTimesheetEngine.segments || [];
  socket.emit('timesheetState', {
    ...state,
    segments,
    rundownLoaded: segments.length > 0
  });
}
```

### Files Changed

- `server/lib/timesheetEngine.js` - Added `segments` to `getState()` return value
- `server/index.js` - Include segments in initial timesheet state on connection

---

## BUG-003: NOW PLAYING and SHOW PROGRESS Desync Due to Dual Engine Broadcasting (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** High
**Status:** FIXED
**Commits:** `f5ec5fe`

### Symptoms

1. User loads rundown and starts show
2. "NOW PLAYING" panel shows one segment (e.g., "Welcome & Host Intro")
3. "SHOW PROGRESS" panel highlights a different segment (e.g., "March-in & team intros")
4. The two panels are completely out of sync despite using the same `useTimesheet` hook

### Root Cause

The server had **TWO timesheet engines broadcasting events simultaneously**:

1. **Global `timesheetEngine`** - Broadcasting to ALL clients via `io.emit()`
2. **Competition-specific engines** - Broadcasting to room via `io.to(roomName).emit()`

When a client was in a competition room (e.g., `competition:nlm081fu`), they received:
- `timesheetState` from the global engine (via `io.emit`)
- `timesheetState` from their competition-specific engine (via `io.to(room).emit`)

The client's `timesheetState` would receive conflicting updates from both sources:
- `currentSegment` would come from one engine
- `currentSegmentIndex` would come from the other engine

This caused NOW PLAYING (which uses `currentSegment`) and SHOW PROGRESS (which uses `currentSegmentIndex`) to show different segments.

### Code Location (Before Fix)

```javascript
// server/index.js lines 267-355
// Global engine broadcasting to ALL clients
timesheetEngine.on('segmentActivated', (data) => {
  io.emit('timesheetSegmentActivated', data);  // <-- Broadcasts to EVERYONE
  io.emit('timesheetState', timesheetEngine.getState());
});

// server/index.js lines 402-647
// Competition-specific engine broadcasting to room only
engine.on('segmentActivated', (data) => {
  socketIo.to(roomName).emit('timesheetSegmentActivated', data);  // <-- Room only
  socketIo.to(roomName).emit('timesheetState', engine.getState());
});
```

### Fix Applied

Changed global engine to broadcast only to `competition:local` room (for local development):

```javascript
// Before (incorrect - broadcasts to ALL clients)
timesheetEngine.on('segmentActivated', (data) => {
  io.emit('timesheetState', timesheetEngine.getState());
});

// After (correct - broadcasts only to local room)
const localRoom = 'competition:local';
timesheetEngine.on('segmentActivated', (data) => {
  io.to(localRoom).emit('timesheetState', timesheetEngine.getState());
});
```

### Files Changed

- `server/index.js` - Lines 266-360 (global engine event handlers)

### Architecture Insight

The system now properly isolates engine broadcasts:

| Client Context | Joins Room | Receives State From |
|----------------|------------|---------------------|
| Local dev (`/local/producer`) | `competition:local` | Global `timesheetEngine` |
| Competition (`/abc123/producer`) | `competition:abc123` | Competition-specific engine |

No cross-contamination between rooms.

---

## BUG-002: Producer View Timesheet Not Linked to Show Progress (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** High
**Status:** FIXED

### Symptoms

1. User imports rundown from Rundown Editor - works correctly
2. User starts the show via Show Control
3. "Now Playing" section shows segment info with elapsed/remaining time
4. "Show Progress" panel shows segment list
5. **BUG:** Now Playing and Show Progress are not synchronized - they track different segments

### Root Cause

The server had **two different engine systems** that weren't properly connected:

1. **Competition-specific engines** (`timesheetEngines` Map) - Created by `loadRundown` when importing a rundown
2. **Legacy single engine** (`timesheetEngine` variable) - Used by all show control socket handlers

When the user:
1. Loaded a rundown → Segments went into the **competition-specific** engine via `getOrCreateEngine(compId)`
2. Started the show → The **legacy** `timesheetEngine` was used (which had no segments!)

This caused the disconnect between "Now Playing" (using one data source) and "Show Progress" (using another).

### Affected Socket Handlers (Before Fix)

All these handlers incorrectly used `timesheetEngine` instead of `getEngine(clientCompId)`:

- `startTimesheetShow`
- `stopTimesheetShow`
- `advanceSegment`
- `previousSegment`
- `goToSegment`
- `timesheetOverrideScene`
- `overrideCamera`
- `getTimesheetState`
- `getTimesheetOverrides`
- `getTimesheetHistory`
- Initial state sent on client connection

### Fix Applied

Updated all timesheet socket handlers in `server/index.js` to use the competition-specific engine:

```javascript
// Before (incorrect)
socket.on('startTimesheetShow', async () => {
  if (!timesheetEngine) {  // <-- Using legacy engine
    socket.emit('error', { message: 'Timesheet engine not initialized' });
    return;
  }
  await timesheetEngine.start();
});

// After (correct)
socket.on('startTimesheetShow', async () => {
  const engine = getEngine(clientCompId);  // <-- Using competition-specific engine
  if (!engine) {
    socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}. Load a rundown first.` });
    return;
  }
  await engine.start();
});
```

### Files Changed

- `server/index.js` - Lines ~6057-6200 (all timesheet socket handlers)

### Testing

1. Restart the server
2. Open Producer View for a competition
3. Click "Load Rundown" to import segments
4. Click "Start Show"
5. Verify "Now Playing" and "Show Progress" are synchronized
6. Click "NEXT" and verify both advance together

---

## BUG-001: rundownLoaded Flag Overwritten by timesheetState (DOCUMENTED)

**Date Identified:** 2026-01-24
**Status:** Documented (see commit `a33ea51`)

### Description

The `rundownLoaded` flag in client-side state could potentially be overwritten when `timesheetState` broadcasts are received from the server.

### Mitigation

The current implementation uses state merging (`{...prev, ...state}`) which preserves client-side flags when the server doesn't include them. This is working as intended but was documented for awareness.

### Related Code

- `show-controller/src/context/ShowContext.jsx` - `timesheetState` socket handler
