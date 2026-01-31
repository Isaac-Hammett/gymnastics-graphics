# Rundown System - Bug Tracker

## BUG-008: Timesheet Graphics Not Rendering in output.html (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** Critical
**Status:** FIXED

### Symptoms

1. Producer loads rundown with segments containing graphics (e.g., "Team 1 Coaches")
2. Show starts and segment activates, graphic triggers
3. WEB GRAPHICS panel shows correct badge (e.g., "team-coaches")
4. **BUG:** output.html page remains blank - graphic does not render
5. Manual button clicks in WEB GRAPHICS panel DO render graphics correctly

### Root Cause

**Two separate issues:**

1. **Server lacks Firebase credentials** - The coordinator VM doesn't have `GOOGLE_APPLICATION_CREDENTIALS` set, so `TimesheetEngine._triggerGraphic()` cannot write to Firebase directly.

2. **Renderer ID mismatch** - The graphics registry uses `team-coaches` with a `teamSlot` parameter, but `output.html` only had specific renderers like `team1-coaches`, `team2-coaches`, etc. When Firebase contained `graphic: "team-coaches"`, output.html couldn't find a matching renderer and cleared the display.

### Fix Applied

**Part 1: Client-side Firebase writes (ShowContext.jsx)**

Since the server can't write to Firebase, the server emits a `timesheetGraphicTriggered` socket event. The client receives this and writes to Firebase with merged competition config:

```javascript
// ShowContext.jsx - timesheetGraphicTriggered handler
newSocket.on('timesheetGraphicTriggered', ({ graphic, graphicId, data, segmentId }) => {
  if (compId && graphic) {
    // Use ref to get latest competition config (avoids stale closure)
    const config = competitionConfigRef.current;
    // Merge competition config with segment-specific data
    const mergedData = {
      eventName: config?.eventName || '',
      team1Name: config?.team1Name || '',
      team1Logo: config?.team1Logo || '',
      team1Coaches: config?.team1Coaches || '',
      // ... all team1-6 data
      ...data  // Segment-specific data (e.g., teamSlot) on top
    };
    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic,
      graphicId: graphicId || graphic,
      data: mergedData,
      segmentId,
      timestamp: Date.now()
    });
  }
});
```

**Part 2: Dynamic renderers in output.html**

Added `team-coaches` and `team-stats` renderers that use the `teamSlot` parameter:

```javascript
// output.html - Dynamic team-coaches renderer
'team-coaches': (data) => {
  const slot = data.teamSlot || 1;
  const name = data[`team${slot}Name`] || '';
  const logo = data[`team${slot}Logo`] || '';
  const coaches = data[`team${slot}Coaches`] || '';
  return `
    <div class="graphic-container graphic-coaches">
      <div class="coaches-header">
        <div class="coaches-title">COACHES</div>
        <img class="coaches-logo" src="${getTeamLogoUrl(name, logo)}" alt="Team">
      </div>
      <div class="coaches-content">
        ${coaches ? coaches.split('\n').map(c => `<div class="coach-name">${c}</div>`).join('') : ''}
      </div>
    </div>
  `;
},
```

### Files Changed

- `show-controller/src/context/ShowContext.jsx` - Added `useRef` for competitionConfig, updated `timesheetGraphicTriggered` handler to merge config and write to Firebase
- `output.html` - Added dynamic `team-coaches` and `team-stats` renderers that use `teamSlot` parameter

### Architecture Note

The graphics triggering flow is now:

```
TimesheetEngine._triggerGraphic()
    ↓ (socket event)
ShowContext.jsx (timesheetGraphicTriggered handler)
    ↓ (merges competition config)
Firebase: competitions/${compId}/currentGraphic
    ↓ (realtime listener)
output.html (renders graphic)
```

This bypasses the server's lack of Firebase credentials by having the client (which has Firebase web SDK access) do the Firebase write.

---

## BUG-009: Team-Stats Graphics Not Triggering from Rundown (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** High
**Status:** FIXED

### Symptoms

1. Producer loads rundown with segments containing team-stats or team-coaches graphics
2. Show starts and segment activates
3. **BUG:** team-stats and team-coaches graphics do NOT trigger from rundown
4. Other graphics (e.g., event-bar, logos) trigger correctly
5. Manual button clicks for team-stats DO work correctly

### Root Cause

**Data structure mismatch between Rundown Editor and TimesheetEngine:**

The **Rundown Editor** stores graphics as objects with `graphicId` and `params`:
```javascript
segment.graphic = { graphicId: 'team-stats', params: { teamSlot: 1 } }
```

But **TimesheetEngine._triggerGraphic()** expected the legacy string format:
```javascript
segment.graphic = 'team-stats'        // string
segment.graphicData = { teamSlot: 1 } // separate field
```

When TimesheetEngine received the object format, `typeof segment.graphic === 'object'` was true but the code was treating it as a string, causing the graphic trigger to fail silently.

### Fix Applied

Updated `_triggerGraphic()` in `server/lib/timesheetEngine.js` to handle both formats:

```javascript
async _triggerGraphic(segment) {
  if (!segment.graphic) return;

  // Handle both legacy format (string) and new format (object with graphicId/params)
  // Legacy: segment.graphic = 'team-coaches', segment.graphicData = { teamSlot: 1 }
  // New:    segment.graphic = { graphicId: 'team-coaches', params: { teamSlot: 1 } }
  let graphicId;
  let graphicParams;

  if (typeof segment.graphic === 'object' && segment.graphic.graphicId) {
    // New format from Rundown Editor
    graphicId = segment.graphic.graphicId;
    graphicParams = segment.graphic.params || {};
  } else {
    // Legacy format (string)
    graphicId = segment.graphic;
    graphicParams = segment.graphicData || {};
  }

  // Rest of method uses graphicId and graphicParams...
}
```

### Files Changed

- `server/lib/timesheetEngine.js` - Updated `_triggerGraphic()` to handle both object and string formats

### Deployment

Deployed to coordinator VM at `/opt/gymnastics-graphics/server/lib/timesheetEngine.js` and restarted PM2 process.

### Testing

1. Load rundown with team-stats segment (teamSlot=1 for Navy)
2. Advance show to that segment
3. Verify Navy stats appear in output.html (AVE: 311.100, HIGH: 320.700)
4. Test teamSlot=2 (Springfield) - verify Springfield stats appear (AVE: 304.861, HIGH: 309.350)

---

## BUG-007: WEB GRAPHICS Button Not Highlighted When Graphic Triggered from Timesheet (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** Medium
**Status:** FIXED

### Symptoms

1. Producer loads rundown with segments that have graphics configured (e.g., "Event Info")
2. Show starts and segment with graphic activates
3. The WEB GRAPHICS panel badge shows correct graphic (e.g., "event-bar")
4. **BUG:** The corresponding button in WEB GRAPHICS panel is NOT highlighted blue
5. Clicking the button manually DOES highlight it correctly

### Root Cause

The `TimesheetEngine._triggerGraphic()` method was missing the `graphicId` field when emitting to Firebase. `GraphicsControl.jsx` uses `graphicId` for button highlighting:

```javascript
// Reading from Firebase
setCurrentGraphicId(data?.graphicId || null);

// Button highlighting
currentGraphicId === btn.id ? 'bg-blue-600 text-white' : 'bg-zinc-700 ...'
```

Without `graphicId`, the button comparison always fails.

### Fix Applied

Added `graphicId` field to the data written to Firebase (via ShowContext.jsx):

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic,
  graphicId: graphicId || graphic,  // For button highlighting
  data: mergedData,
  segmentId,
  timestamp: Date.now()
});
```

### Files Changed

- `show-controller/src/context/ShowContext.jsx` - Added `graphicId` field to Firebase write

### Testing

1. Load rundown with segments containing graphics
2. Start show and advance to a segment with a graphic (e.g., "Event Info")
3. Verify the "Event Info" button in WEB GRAPHICS panel is highlighted blue
4. Verify the badge shows "event-bar"

---

## BUG-006: No Graphic Indicator in SHOW PROGRESS Panel (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** Medium
**Status:** FIXED

### Symptoms

1. Producer loads rundown and starts show
2. SHOW PROGRESS panel shows list of segments
3. **BUG:** No indication of which graphic is tied to each segment
4. Producer cannot see at a glance what graphics will fire for upcoming segments

### Root Cause

The `RunOfShow.jsx` component only displayed:
- Segment name
- Duration
- Auto-advance indicator ("A")

It did **not** display the `segment.graphic` field, which contains the graphic identifier for each segment.

### Fix Applied

Added a pink badge with PhotoIcon showing the graphic identifier for each segment:

```jsx
{/* Graphic indicator - show which graphic is tied to this segment */}
{segment.graphic && (
  <div
    className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-pink-500/20 text-pink-400 border border-pink-500/30 shrink-0"
    title={`Graphic: ${segment.graphic}`}
  >
    <PhotoIcon className="w-3 h-3" />
    <span className="max-w-16 truncate">{segment.graphic}</span>
  </div>
)}
```

### Files Changed

- `show-controller/src/components/RunOfShow.jsx` - Added PhotoIcon import and graphic indicator badge

---

## BUG-005: TimesheetEngine Writes Graphics to Wrong Firebase Path (FIXED)

**Date Identified:** 2026-01-24
**Date Fixed:** 2026-01-24
**Severity:** Critical
**Status:** FIXED

### Symptoms

1. Producer loads rundown with segments that have graphics configured
2. Show starts and segments progress via timesheet
3. **BUG:** Graphics do NOT appear in output.html (OBS browser source)
4. The Web Graphics panel shows a different graphic than what the timesheet segment specifies
5. Console logs show "Graphic triggered successfully" but nothing happens

### Root Cause

**Firebase path mismatch:**

| Component | Firebase Path |
|-----------|---------------|
| `TimesheetEngine._triggerGraphic()` | `graphics/current` (global path) |
| `output.html` listener | `competitions/${competitionId}/currentGraphic` (competition-specific) |

The TimesheetEngine had `this.compId` available but was writing to the wrong path. The output.html renderer was listening on the correct competition-specific path but never received the data.

### Code Location (Before Fix)

```javascript
// server/lib/timesheetEngine.js - _triggerGraphic() line 820
async _triggerGraphic(segment) {
  // ...
  await db.ref('graphics/current').set(graphicData);  // <-- WRONG PATH
  // ...
}
```

### Fix Applied

Changed `_triggerGraphic()` to use competition-specific path:

```javascript
// server/lib/timesheetEngine.js - _triggerGraphic()
async _triggerGraphic(segment) {
  // ...
  // Use competition-specific path if compId is available, otherwise fallback to global path
  // output.html listens to: competitions/${competitionId}/currentGraphic
  const firebasePath = this.compId
    ? `competitions/${this.compId}/currentGraphic`
    : 'graphics/current';

  await db.ref(firebasePath).set(graphicData);  // <-- NOW CORRECT
  // ...
}
```

### Files Changed

- `server/lib/timesheetEngine.js` - Updated `_triggerGraphic()` to use competition-specific Firebase path

### Architecture Insight

The graphics system now properly routes data:

| Action | Firebase Path |
|--------|---------------|
| Manual graphic trigger (web buttons) | `competitions/${compId}/currentGraphic` |
| Timesheet segment graphic trigger | `competitions/${compId}/currentGraphic` |
| output.html listener | `competitions/${compId}/currentGraphic` |

All components now use the same competition-specific path.

---

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
