# Plan: Consolidate Timesheet Panel and Show Progress

**Date:** 2026-01-22
**Status:** Planning

---

## Problem Statement

The Producer View currently has **two separate systems** for show control that overlap in functionality:

1. **Timesheet System** (new, feature-rich, partially working)
2. **Original Show System** (legacy, simpler, fully integrated)

This creates confusion about which "Start Show" button to use and duplicates UI elements.

---

## Current Architecture Analysis

### System 1: Original Show System

**Data Flow:**
```
Server: showEngine.js (or similar)
    ↓ socket events
ShowContext.jsx
    ├── state.isPlaying
    ├── state.isPaused
    ├── state.currentSegment
    ├── state.currentSegmentIndex
    ├── state.showConfig.segments
    └── state.showProgress { completed, total }
    ↓
Used by:
├── ProducerView.jsx (Start Show button, Show Controls, Show Progress stats)
├── CurrentSegment.jsx (displays state.currentSegment + elapsed)
├── NextSegment.jsx (displays state.nextSegment)
└── RunOfShow.jsx (displays segment list from state.showConfig.segments)
```

**Socket Events (Original):**
- `stateUpdate` → full state refresh
- `timeUpdate` → `{ elapsed }` in seconds
- Emits: `startShow`, `resetShow`, `advance`, `previous`, `jumpTo`, `togglePause`

**UI Components:**
- "Start Show" button in main area (line 284-290 in ProducerView)
- "Show Control" panel with Previous/NEXT/Pause buttons (lines 299-371)
- "Show Progress" stats panel in right sidebar (lines 531-572)

---

### System 2: Timesheet System

**Data Flow:**
```
Server: timesheetEngine.js
    ↓ socket events
ShowContext.jsx
    └── timesheetState {
          state: 'stopped'|'running'|'paused',
          isRunning, isPaused,
          currentSegment, nextSegment,
          currentSegmentIndex,
          segmentElapsedMs, segmentRemainingMs, segmentProgress,
          showElapsedMs,
          isHoldSegment, canAdvanceHold, holdRemainingMs
        }
    ↓
Used by:
├── TimesheetPanel.jsx (standalone, fetches own state + subscribes to events)
└── useTimesheet.js hook (wraps context for convenience)
```

**Socket Events (Timesheet):**
- `timesheetState` → full state refresh
- `timesheetTick` → real-time timing updates (ms precision)
- `timesheetSegmentActivated` → segment changes
- `timesheetShowStarted`, `timesheetShowStopped`, `timesheetStateChanged`
- `timesheetHoldStarted`, `timesheetHoldMaxReached`
- Emits: `startTimesheetShow`, `stopTimesheetShow`, `advanceSegment`, `previousSegment`, `goToSegment`

**UI Components:**
- `TimesheetPanel.jsx` - collapsible panel with:
  - Start Show button
  - Current segment display with elapsed/remaining time
  - Progress bar
  - Previous/Next/Stop controls
  - Expandable segment list

---

## Key Differences

| Feature | Original System | Timesheet System |
|---------|-----------------|------------------|
| Time precision | Seconds (`elapsed`) | Milliseconds (`segmentElapsedMs`) |
| Progress tracking | Manual calculation | Built-in `segmentProgress` (0-1) |
| Hold segments | Not supported | Full support with min/max duration |
| Auto-advance | Basic | Configurable per-segment |
| Override logging | Not tracked | `overrideLog` array |
| Segment types | Basic | video, live, static, break, hold, graphic |
| Next segment preview | Yes | Yes |

---

## Why Timesheet Panel Shows "Show not started"

### Root Cause Analysis

**TimesheetPanel has a critical architectural flaw:** It maintains its OWN local state instead of using the context.

Looking at `TimesheetPanel.jsx`:

```javascript
// Line 77: Creates LOCAL state
const [timesheetState, setTimesheetState] = useState(null);

// Lines 86-98: Tries to fetch initial state via REST API
useEffect(() => {
  async function fetchTimesheetState() {
    try {
      const res = await fetch(`${serverUrl}/api/timesheet/state`);
      if (res.ok) {
        setTimesheetState(await res.json());  // Sets LOCAL state
      }
    } catch (err) {
      console.error('Failed to fetch timesheet state:', err);
    }
  }
  fetchTimesheetState();
}, [serverUrl]);

// Lines 100-143: Sets up socket listeners that ALSO update LOCAL state
socket.on('timesheetState', handleTimesheetState);  // Updates LOCAL state
```

**Meanwhile, ShowContext.jsx ALSO listens to the same socket events:**
```javascript
// Line 214-217 in ShowContext.jsx
newSocket.on('timesheetState', (state) => {
  console.log('Timesheet state:', state);
  setTimesheetState(state);  // Updates CONTEXT state
});
```

**The Server DOES send initial state via socket (server/index.js:2684-2686):**
```javascript
// Send initial timesheet state if available
if (timesheetEngine) {
  socket.emit('timesheetState', timesheetEngine.getState());
}
```

### The Problem Chain

1. **REST API fails in production** because `serverUrl` is wrong:
   ```javascript
   const serverUrl = import.meta.env.PROD
     ? (import.meta.env.VITE_SOCKET_SERVER || '')  // Empty in production!
     : 'http://localhost:3003';
   ```

2. **Local state starts as `null`** because REST fetch fails silently

3. **Socket event arrives** but there's a race condition:
   - ShowContext receives `timesheetState` → updates context
   - TimesheetPanel MAY receive it → updates local state
   - But if the socket wasn't attached yet, it misses the initial emit

4. **Component uses local state** instead of context:
   ```javascript
   const isRunning = timesheetState?.isRunning;  // Uses LOCAL state
   // Should be:
   // const { timesheetState } = useShow();  // Use CONTEXT state
   ```

### Why the Original System Works

The original system ONLY uses socket events through context:
1. Server emits `stateUpdate`
2. ShowContext receives it, updates `state`
3. ProducerView uses `const { state } = useShow()` - gets CONTEXT state
4. UI updates correctly

**Key difference:** Original system has a single source of truth (context). Timesheet panel has TWO sources (local state + failed REST API).

---

## Why Original "Start Show" Works

The original system uses socket events that flow through the coordinator:
1. User clicks "Start Show"
2. `socket.emit('startShow')` via `ShowContext.startShow()`
3. Server processes, emits `stateUpdate`
4. `ShowContext` receives update, sets `state.isPlaying = true`
5. UI updates to show controls

The Timesheet system's REST API calls bypass the coordinator and fail.

---

## Consolidation Plan

### Phase 1: Fix TimesheetPanel Data Source

**Goal:** Make TimesheetPanel use socket events instead of REST API

**Changes to `TimesheetPanel.jsx`:**
1. Remove REST API fetch (lines 86-98)
2. Get initial state from `useShow()` context (`timesheetState`)
3. The socket event listeners (lines 100-143) are already correct

**OR** use the existing `useTimesheet()` hook which already wraps everything.

### Phase 2: Unify the Two Systems

**Decision needed:** Which system should be the "source of truth"?

**Option A: Keep Original System as Primary**
- Pros: Already working, simpler
- Cons: Loses timesheet features (hold segments, ms timing, override logging)

**Option B: Keep Timesheet System as Primary** ← RECOMMENDED
- Pros: More features, better timing, designed for production use
- Cons: Need to ensure server-side `timesheetEngine.js` is running

**Option C: Merge Both**
- Have timesheet engine emit both `timesheetState` AND `stateUpdate` events
- Frontend components can use either
- Most backwards compatible

### Phase 3: Consolidate UI Components

See [UI Layout Specification](#ui-layout-specification) below for detailed before/after layouts.

**Components to modify:**
| Current Component | Action |
|-------------------|--------|
| `TimesheetPanel.jsx` | **REMOVE from sidebar** - functionality moves to main area |
| `CurrentSegment.jsx` | **ENHANCE** - use timesheet data (ms timing, progress) |
| `NextSegment.jsx` | **ENHANCE** - use timesheet data |
| `RunOfShow.jsx` | **ENHANCE** - use timesheet data for segment status |
| Show Control (in ProducerView) | **KEEP** - already in main area, wire to timesheet |
| Show Progress stats (sidebar) | **REMOVE** - redundant with RunOfShow |
| `OverrideLog.jsx` | Keep in sidebar (monitoring) |
| `AlertPanel.jsx` | Keep in sidebar (monitoring) |
| `CameraRuntimePanel.jsx` | Keep in sidebar (monitoring) |
| `GraphicsControl.jsx` | Keep in sidebar (actions) |

---

## Implementation Steps

### Step 1: Fix TimesheetPanel Data Source (HIGH PRIORITY)

**Problem:** TimesheetPanel uses local state + broken REST API instead of context.

**Solution:** Use `timesheetState` from ShowContext (which already receives socket events).

**Changes to `TimesheetPanel.jsx`:**

```javascript
// BEFORE (broken):
const [timesheetState, setTimesheetState] = useState(null);

// REST API fetch that fails in production
useEffect(() => {
  async function fetchTimesheetState() {
    const res = await fetch(`${serverUrl}/api/timesheet/state`);
    // ...
  }
  fetchTimesheetState();
}, [serverUrl]);

// Socket listeners that update local state
socket.on('timesheetState', (newState) => setTimesheetState(newState));
```

```javascript
// AFTER (fixed):
import { useShow } from '../context/ShowContext';

export default function TimesheetPanel({ collapsed: initialCollapsed = false }) {
  const { socket, state, timesheetState } = useShow();  // Get from context!

  // REMOVE: const [timesheetState, setTimesheetState] = useState(null);
  // REMOVE: const serverUrl = ...
  // REMOVE: useEffect for REST API fetch
  // REMOVE: useEffect for socket listeners (context already handles this)

  // Rest of component uses timesheetState from context
  const currentSegment = timesheetState?.currentSegment;
  const isRunning = timesheetState?.isRunning;
  // etc.
}
```

**Alternative:** Use the existing `useTimesheet()` hook which wraps everything:
```javascript
import { useTimesheet } from '../hooks/useTimesheet';

export default function TimesheetPanel({ collapsed: initialCollapsed = false }) {
  const {
    currentSegment,
    nextSegment,
    isRunning,
    isPaused,
    progress,
    elapsed,
    remaining,
    start,
    stop,
    advance,
    previous,
    jumpTo,
    segments,
    currentIndex
  } = useTimesheet();

  // Much cleaner!
}
```

### Step 2: Add Missing Stats to TimesheetPanel

Add these stats from the "Show Progress" panel that will be removed:

```javascript
// Get from useShow() context
const { state } = useShow();
const { talentLocked, obsConnected, obsCurrentScene, connectedClients } = state;

// Add to UI:
<div className="space-y-2 mt-4 pt-4 border-t border-zinc-700">
  <div className="flex items-center justify-between text-sm">
    <span className="text-zinc-400">Status</span>
    <span className={isRunning ? 'text-green-400' : isPaused ? 'text-yellow-400' : 'text-zinc-400'}>
      {isRunning ? 'Live' : isPaused ? 'Paused' : 'Ready'}
    </span>
  </div>
  <div className="flex items-center justify-between text-sm">
    <span className="text-zinc-400">Talent Controls</span>
    <span className={talentLocked ? 'text-red-400' : 'text-green-400'}>
      {talentLocked ? 'Locked' : 'Unlocked'}
    </span>
  </div>
  <div className="flex items-center justify-between text-sm">
    <span className="text-zinc-400">OBS</span>
    <span className={obsConnected ? 'text-green-400' : 'text-red-400'}>
      {obsConnected ? 'Connected' : 'Disconnected'}
    </span>
  </div>
</div>
```

### Step 3: Update ProducerView Layout (MAIN CONTENT AREA)

**Goal:** All show control in main content area, sidebar for monitoring only.

**Changes to ProducerView.jsx:**

1. **Remove from RIGHT SIDEBAR:**
   - `<TimesheetPanel />` (line ~460) - functionality moves to main area
   - "Show Progress" stats panel (lines 531-572) - redundant

2. **Enhance MAIN CONTENT components to use timesheet data:**

   **CurrentSegment.jsx** - Replace original system data with timesheet:
   ```javascript
   // BEFORE: Uses state.currentSegment + elapsed (seconds)
   const { state, elapsed } = useShow();
   const { currentSegment } = state;

   // AFTER: Use timesheet data (milliseconds, progress)
   const { timesheetState } = useShow();
   // OR use the hook:
   const { currentSegment, elapsed, remaining, progress } = useTimesheet();
   ```

   **NextSegment.jsx** - Same change:
   ```javascript
   // AFTER:
   const { nextSegment } = useTimesheet();
   ```

   **RunOfShow.jsx** - Use timesheet for segment status:
   ```javascript
   // AFTER:
   const { currentIndex, segments } = useTimesheet();
   ```

   **Show Control buttons** - Wire to timesheet actions:
   ```javascript
   // BEFORE: Uses startShow, advance, previous from original system
   const { startShow, advance, previous } = useShow();

   // AFTER: Use timesheet actions
   const { start, advance, previous, stop } = useTimesheet();
   ```

3. **Keep in RIGHT SIDEBAR (monitoring only):**
   - `<CameraRuntimePanel />` - camera status
   - `<GraphicsControl />` - graphics triggers
   - `<OverrideLog />` - override history
   - `<AlertPanel />` - alerts
   - OBS Status panel
   - Connected Clients panel

### Step 4: Verify Server Events (Already Working)

Server-side is already correct (server/index.js):
- ✅ Line 2684-2686: Sends `timesheetState` on socket connection
- ✅ Line 258-337: All timesheet engine events are wired up
- ✅ Line 5213-5342: Socket event handlers for timesheet commands

No server changes needed.

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `CurrentSegment.jsx` | Use `useTimesheet()` hook instead of original state | **P1** |
| `NextSegment.jsx` | Use `useTimesheet()` hook instead of original state | **P1** |
| `ProducerView.jsx` | Remove `<TimesheetPanel />` from sidebar, remove redundant stats panel, wire Show Control to timesheet | **P1** |
| `RunOfShow.jsx` | Use `useTimesheet()` for segment index/status | **P2** |
| `TimesheetPanel.jsx` | **DELETE** or keep as backup - functionality moved to main components | **P2** |
| `ShowContext.jsx` | No changes needed - already has timesheet state | - |
| `server/index.js` | No changes needed - already emits timesheet events | - |

---

## Decisions Made

1. **Should we keep both "Start Show" buttons or just one?**
   - ✅ **Decision:** One button, uses timesheet system

2. **Should the Timesheet Panel replace CurrentSegment/NextSegment?**
   - ✅ **Decision:** Yes, consolidate into one unified component

3. **Where should the consolidated panel live?**
   - ✅ **Decision:** **MAIN CONTENT AREA** (not sidebar)
   - Remove TimesheetPanel from right sidebar
   - Integrate timesheet functionality into the main left column where CurrentSegment/NextSegment/ShowControl currently live

4. **Should we deprecate the original show system?**
   - ✅ **Decision:** Keep backend working for compatibility, but UI uses timesheet as primary

---

## Success Criteria

- [ ] Single "Start Show" button that works
- [ ] Current segment displays with timing
- [ ] Next segment preview works
- [ ] Segment list shows progress
- [ ] Stats (Status, Talent Lock, OBS) visible
- [ ] No duplicate panels showing same information
- [ ] No REST API calls to broken endpoints

---

## UI Layout Specification

### CURRENT UI (Before Consolidation)

The current Producer View has **duplicate UI elements** spread across the main content area and the sidebar:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Competition Name | Producer View           [Alerts] [Connection Status]│
├─────────────────────────────────────────────────────────────────────────────────┤
│  [Critical Alert Banner - if any]                                               │
│  [Camera Mismatch Alert Banner - if any]                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ MAIN CONTENT (lg:col-span-2) ────────────────────┐  ┌─ RIGHT SIDEBAR ─────┐│
│  │                                                    │  │                     ││
│  │  ┌─ NOW PLAYING ────────────────────────────────┐ │  │ ┌─ Timesheet ──────┐││
│  │  │  🎤 Welcome & Host Intro                      │ │  │ │ [Clock icon] ▼   │││
│  │  │     Live segment                              │ │  │ │                  │││
│  │  │  [████████████░░░░░░░░░░░░░░] 0:18 / 0:30    │ │  │ │ ┌─ Now Playing ─┐│││
│  │  │  OBS Scene: Talent Camera                     │ │  │ │ │ 🎤 Welcome    ││││  ← DUPLICATE!
│  │  │  NOTES: Wait for talent to finish intro       │ │  │ │ │ Live segment  ││││
│  │  └───────────────────────────────────────────────┘ │  │ │ └───────────────┘│││
│  │                                                    │  │ │                  │││
│  │  ┌─ UP NEXT ────────────────────────────────────┐ │  │ │ Elapsed  Remain  │││
│  │  │  ⏭️  Event Introduction           Auto        │ │  │ │ 0:18     0:12   │││  ← DUPLICATE!
│  │  │     0:08 duration                             │ │  │ │                  │││
│  │  └───────────────────────────────────────────────┘ │  │ │ [████████░░░░░] │││
│  │                                                    │  │ │                  │││
│  │  ┌─ SHOW CONTROL ───────────────────────────────┐ │  │ │ ┌─ Up Next ────┐ │││
│  │  │  [Previous] [══════ NEXT ══════] [Pause]     │ │  │ │ │ Event Intro  │ │││  ← DUPLICATE!
│  │  │  [🔒 Lock Talent]  [↻ Reset Show]            │ │  │ │ └──────────────┘ │││
│  │  └───────────────────────────────────────────────┘ │  │ │                  │││
│  │                                                    │  │ │ [Prev][NEXT][⏹] │││  ← DUPLICATE!
│  │  ┌─ QUICK CAMERA SWITCH ────────────────────────┐ │  │ │                  │││
│  │  │  [Cam1-VT ●] [Cam2-UB ●] [Cam3 ●] [Cam4 ●]  │ │  │ │ ▼ Segment List   │││
│  │  └───────────────────────────────────────────────┘ │  │ │  1. Show Intro  │││
│  │                                                    │  │ │  2. Welcome ←   │││  ← DUPLICATE!
│  │  ┌─ SCENE OVERRIDE ─────────────────────────────┐ │  │ │  3. Event Intro │││
│  │  │  [Intro] [Talent] [Competition] [Scoreboard] │ │  │ └─────────────────┘││
│  │  │  [Interview] [Sponsor] [BRB] [End Card]      │ │  │                     ││
│  │  │  [▼ Select scene...]                         │ │  │ ┌─ Override Log ──┐││
│  │  └───────────────────────────────────────────────┘ │  │ │ ...             │││
│  │                                                    │  │ └─────────────────┘││
│  │  ┌─ RUN OF SHOW ────────────────────────────────┐ │  │                     ││
│  │  │  1. ✅ Show Intro                     0:45   │ │  │ ┌─ Alert Panel ───┐││
│  │  │  2. ▶️ Welcome & Host Intro           0:30   │ │  │ │ ...             │││
│  │  │  3. ○ Event Introduction              0:08   │ │  │ └─────────────────┘││
│  │  │  4. ○ UCLA Introduction               0:10   │ │  │                     ││
│  │  │  ...                                         │ │  │ ┌─ Camera Status ─┐││
│  │  └───────────────────────────────────────────────┘ │  │ │ 4 online        │││
│  │                                                    │  │ └─────────────────┘││
│  └────────────────────────────────────────────────────┘  │                     ││
│                                                          │ ┌─ Graphics ──────┐││
│                                                          │ │ [Copy URL]      │││
│                                                          │ │ [Logos] [Stats] │││
│                                                          │ └─────────────────┘││
│                                                          │                     ││
│                                                          │ ┌─ OBS Status ────┐││
│                                                          │ │ Connected       │││
│                                                          │ │ Scene: Talent   │││
│                                                          │ └─────────────────┘││
│                                                          │                     ││
│                                                          │ ┌─ Clients ───────┐││
│                                                          │ │ Producer, Talent│││
│                                                          │ └─────────────────┘││
│                                                          │                     ││
│                                                          │ ┌─ Show Progress ─┐││
│                                                          │ │ Segments: 2/21  │││  ← DUPLICATE!
│                                                          │ │ [████░░░░░░░░]  │││
│                                                          │ │ Status: Live    │││
│                                                          │ │ Talent: Unlocked│││
│                                                          │ └─────────────────┘││
│                                                          └─────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Current Problems:**
1. `TimesheetPanel` duplicates: Now Playing, Up Next, Controls, Segment List
2. "Show Progress" stats panel duplicates: segment count, status
3. TWO "Start Show" buttons (main area + TimesheetPanel)
4. TimesheetPanel has broken REST API (shows "Show not started" even when running)
5. Main components use old system (seconds), TimesheetPanel uses new system (ms)

---

### CONSOLIDATED UI (After)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Competition Name | Producer View           [Alerts] [Connection Status]│
├─────────────────────────────────────────────────────────────────────────────────┤
│  [Critical Alert Banner - if any]                                               │
│  [Camera Mismatch Alert Banner - if any]                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ MAIN CONTENT (lg:col-span-2) ────────────────────┐  ┌─ RIGHT SIDEBAR ─────┐│
│  │                                                    │  │                     ││
│  │  ┌─ NOW PLAYING ────────────────────────────────┐ │  │ ┌─ Override Log ──┐││
│  │  │  🎤 Welcome & Host Intro                      │ │  │ │ Scene overrides │││
│  │  │     Live segment                              │ │  │ │ Camera switches │││
│  │  │                                               │ │  │ └─────────────────┘││
│  │  │  ┌─────────────┐  ┌─────────────┐            │ │  │                     ││
│  │  │  │  ELAPSED    │  │  REMAINING  │            │ │  │ ┌─ Alert Panel ───┐││
│  │  │  │   0:18      │  │    0:12     │  ← ms      │ │  │ │ Warnings, etc   │││
│  │  │  └─────────────┘  └─────────────┘  precision │ │  │ └─────────────────┘││
│  │  │                                               │ │  │                     ││
│  │  │  [████████████████████░░░░░░░░░░] 60%        │ │  │ ┌─ Camera Status ─┐││
│  │  │                                               │ │  │ │ 4 online / 4    │││
│  │  │  OBS Scene: Talent Camera                     │ │  │ │ [Camera details]│││
│  │  │                                               │ │  │ └─────────────────┘││
│  │  │  ⚠️ HOLD: Wait 0:05 before advancing         │ │  │                     ││
│  │  │     (only shown for hold segments)            │ │  │ ┌─ Web Graphics ──┐││
│  │  │                                               │ │  │ │ [Copy Output]   │││
│  │  │  NOTES: Wait for talent to finish intro       │ │  │ │ [Local] [URL]   │││
│  │  └───────────────────────────────────────────────┘ │  │ │ [Logos] [Stats] │││
│  │                                                    │  │ └─────────────────┘││
│  │  ┌─ UP NEXT ────────────────────────────────────┐ │  │                     ││
│  │  │  ⏭️  Event Introduction                       │ │  │ ┌─ OBS Status ────┐││
│  │  │     0:08 duration                      Auto   │ │  │ │ Connected       │││
│  │  └───────────────────────────────────────────────┘ │  │ │ Scene: Talent   │││
│  │                                                    │  │ └─────────────────┘││
│  │  ┌─ SHOW CONTROL ───────────────────────────────┐ │  │                     ││
│  │  │                                               │ │  │ ┌─ Clients ───────┐││
│  │  │  [Previous] [══════ NEXT ══════] [Pause]     │ │  │ │ Producer (you)  │││
│  │  │                                               │ │  │ │ Talent          │││
│  │  │  [🔒 Lock Talent]  [↻ Reset Show]  [⏹ Stop] │ │  │ └─────────────────┘││
│  │  │                                               │ │  │                     ││
│  │  │  ← Uses timesheet: advance(), previous()      │ │  │ ┌─ Show Stats ────┐││
│  │  │    Disables NEXT when hold min not met        │ │  │ │ Status: Live    │││
│  │  └───────────────────────────────────────────────┘ │  │ │ Talent: Unlocked│││
│  │                                                    │  │ │ OBS: Connected  │││
│  │  ┌─ QUICK CAMERA SWITCH ────────────────────────┐ │  │ └─────────────────┘││
│  │  │  [Cam1-VT ●] [Cam2-UB ●] [Cam3 ●] [Cam4 ●]  │ │  └─────────────────────┘│
│  │  └───────────────────────────────────────────────┘ │                         │
│  │                                                    │                         │
│  │  ┌─ SCENE OVERRIDE ─────────────────────────────┐ │                         │
│  │  │  [Intro] [Talent] [Competition] [Scoreboard] │ │                         │
│  │  │  [Interview] [Sponsor] [BRB] [End Card]      │ │                         │
│  │  │  [▼ Select scene...]                         │ │                         │
│  │  └───────────────────────────────────────────────┘ │                         │
│  │                                                    │                         │
│  │  ┌─ SHOW PROGRESS ──────────────── Segment 2/21 ┐ │                         │
│  │  │                                               │ │                         │
│  │  │  1. ✅ Show Intro                      0:45  │ │                         │
│  │  │  2. ▶️ Welcome & Host Intro            0:30  │ │ ← Current highlighted  │
│  │  │  3. ○ Event Introduction               0:08  │ │                         │
│  │  │  4. ○ UCLA Introduction                0:10  │ │                         │
│  │  │  5. ○ Oregon Introduction              0:10  │ │                         │
│  │  │  ...                                         │ │ ← Click to jump        │
│  │  └───────────────────────────────────────────────┘ │                         │
│  │                                                    │                         │
│  └────────────────────────────────────────────────────┘                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**When Show Not Started:**
```
┌─ MAIN CONTENT ───────────────────────────────────────┐
│                                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │                                                  ││
│  │              Ready to Start                      ││
│  │              21 segments loaded                  ││
│  │                                                  ││
│  │           [▶️  Start Show]  ← ONE button        ││
│  │              (uses timesheet engine)             ││
│  │                                                  ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ SHOW PROGRESS (preview) ───────────────────────┐│
│  │  1. ○ Show Intro                          0:45  ││
│  │  2. ○ Welcome & Host Intro                0:30  ││
│  │  3. ○ Event Introduction                  0:08  ││
│  │  ...                                            ││
│  └─────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

### Key UI Changes Summary

| Element | Before | After |
|---------|--------|-------|
| **Start Show** | 2 buttons (main + TimesheetPanel) | 1 button (main area, uses timesheet) |
| **Now Playing** | 2 displays (CurrentSegment + TimesheetPanel) | 1 display (enhanced CurrentSegment) |
| **Up Next** | 2 displays (NextSegment + TimesheetPanel) | 1 display (enhanced NextSegment) |
| **Show Controls** | 2 sets (main + TimesheetPanel) | 1 set (main area, uses timesheet) |
| **Segment List** | 2 lists (RunOfShow + TimesheetPanel) | 1 list (RunOfShow, enhanced) |
| **Show Stats** | 2 panels (sidebar Show Progress + TimesheetPanel) | 1 compact panel (sidebar) |
| **TimesheetPanel** | In sidebar, broken | **REMOVED** |
| **Time precision** | Seconds (original) | Milliseconds (timesheet) |
| **Hold segments** | Not shown | Warning displayed, NEXT disabled until min met |
| **Data source** | Mixed (broken REST + socket) | Socket only via `useTimesheet()` |

---

### Enhanced NOW PLAYING Component

The enhanced `CurrentSegment.jsx` will include timesheet features:

```
┌─ NOW PLAYING ──────────────────────────────────────────────────────────┐
│                                                                         │
│  🎤 Welcome & Host Intro                                                │
│     Live segment                                                        │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐                            │
│  │     ELAPSED      │  │    REMAINING     │                            │
│  │      0:18        │  │      0:12        │  ← Red when < 10s          │
│  └──────────────────┘  └──────────────────┘                            │
│                                                                         │
│  [██████████████████████████░░░░░░░░░░░░░░░░]  60%                     │
│   └─ Blue normally, Yellow >75%, Red >90%                               │
│                                                                         │
│  OBS Scene: Talent Camera                                               │
│                                                                         │
│  ┌─ HOLD WARNING (only for hold segments) ────────────────────────────┐│
│  │  ⚠️ Hold segment - wait 0:05 before advancing                       ││
│  │  OR                                                                  ││
│  │  ✅ Hold segment ready - can advance                                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─ NOTES ─────────────────────────────────────────────────────────────┐│
│  │  Wait for talent to finish host intro before advancing              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Source:** `useTimesheet()` hook providing:
- `currentSegment` - segment object with name, type, duration, notes, obsScene
- `elapsed` - milliseconds elapsed (formatted to MM:SS)
- `remaining` - milliseconds remaining (formatted to MM:SS)
- `progress` - 0-1 value for progress bar
- `isHoldSegment` - boolean
- `canAdvanceHold` - boolean (true when min duration met)
- `holdRemainingMs` - ms until hold can advance

---

### Enhanced SHOW CONTROL Component

The Show Control buttons will wire to timesheet actions:

```
┌─ SHOW CONTROL ─────────────────────────────────────────────────────────┐
│                                                                         │
│  [Previous] [════════════════ NEXT ════════════════] [Pause/Resume]    │
│      ↑              ↑                                      ↑            │
│      │              │                                      │            │
│      │              └─ Disabled when hold min not met      │            │
│      │                 Blue normally, grey when disabled   │            │
│      │                                                     │            │
│      └─ Disabled at segment 0                              │            │
│                                                            │            │
│                                            Yellow=Pause, Green=Resume   │
│                                                                         │
│  [🔒 Lock Talent]  [↻ Reset Show]  [⏹ Stop]                           │
│       ↑                  ↑              ↑                               │
│       │                  │              └─ NEW: Stop button from        │
│       │                  │                 timesheet (stopTimesheetShow)│
│       │                  │                                              │
│       │                  └─ Reset to segment 0                          │
│       │                                                                 │
│       └─ Red when locked, grey when unlocked                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Button Actions (via `useTimesheet()`):**
- Previous → `previous()`
- NEXT → `advance()` (disabled when `isHoldSegment && !canAdvanceHold`)
- Pause/Resume → existing `togglePause()` from ShowContext
- Lock Talent → existing `lockTalent()` from ShowContext
- Reset Show → existing `resetShow()` from ShowContext
- Stop → `stop()` from useTimesheet

---

### Sidebar Components (Unchanged or Simplified)

**Right sidebar retains monitoring panels only:**

| Panel | Status | Notes |
|-------|--------|-------|
| Override Log | Keep | Monitoring - shows scene/camera overrides |
| Alert Panel | Keep | Monitoring - warnings and alerts |
| Camera Status | Keep | Monitoring - camera health |
| Web Graphics | Keep | Actions - graphics triggers |
| OBS Status | Keep | Monitoring - connection status |
| Connected Clients | Keep | Monitoring - who's connected |
| Show Stats | **Simplified** | Status, Talent Lock, OBS only (no segment count - that's in main) |
| TimesheetPanel | **REMOVE** | Functionality moved to main content |
| Show Progress (old) | **REMOVE** | Redundant with main content |
