# Implementation Plan: Rundown System

**Version:** 1.0
**Date:** 2026-01-23
**Status:** Active
**PRD:** [PRD-Rundown-System-2026-01-23.md](./PRD-Rundown-System-2026-01-23.md)

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD-Rundown-System-2026-01-23.md](./PRD-Rundown-System-2026-01-23.md) | Product requirements |
| [PLAN-Rundown-System-Implementation.md](./PLAN-Rundown-System-Implementation.md) | Implementation task tracking (use this for day-to-day execution) |

**Note:** This document serves as the technical reference for architecture, state machine, socket events, error handling, and testing. For task execution and progress tracking, see the Implementation Plan.

---

## 1. Architecture Overview

### 1.1 System Components

```
RUNDOWN (planning)              TIMESHEET (execution)
──────────────────              ─────────────────────
Rundown Editor UI        →      Timesheet Engine (server)
Firebase storage         →      useTimesheet hook (client)
                                Timesheet UI (Producer View)
```

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLANNING                                                                    │
│                                                                              │
│  Rundown Editor (/{compId}/rundown)                                         │
│  └── Saves to: competitions/{compId}/production/rundown/segments            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ "Load Rundown" (Phase A)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXECUTION                                                                   │
│                                                                              │
│  Timesheet Engine (server/lib/timesheetEngine.js)                           │
│  ├── Runs segments with timing                                               │
│  ├── Fires OBS scene changes (via obsConnectionManager)                      │
│  ├── Triggers graphics                                                       │
│  └── Broadcasts state via Socket.io (to competition room)                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Socket.io events
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VIEWS                                                                       │
│                                                                              │
│  Producer View (/{compId}/producer)    Talent View (/{compId}/talent)       │
│  ├── Now Playing                        ├── Time remaining                   │
│  ├── Up Next                            ├── Current/Next segment             │
│  ├── Show Control                       ├── Scene switching                  │
│  └── Show Progress                      └── Notes                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Multi-Competition Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  COORDINATOR (api.commentarygraphic.com)                                     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  obsConnectionManager (per-competition OBS connections)                  │ │
│  │  ├── compId: abc123 → OBS WebSocket to VM 50.19.137.152:4455            │ │
│  │  └── compId: xyz789 → OBS WebSocket to VM 54.210.98.89:4455             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  timesheetEngines Map (per-competition execution)                        │ │
│  │  ├── compId: abc123 → TimesheetEngine instance                          │ │
│  │  └── compId: xyz789 → TimesheetEngine instance                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  Socket.io rooms: competition:abc123, competition:xyz789                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Show State Machine

```
                              ┌─────────────────────────────────────────┐
                              │                                         │
                              ▼                                         │
┌─────────┐  loadRundown  ┌────────┐  startShow  ┌─────────┐           │
│  IDLE   │──────────────▶│ LOADED │────────────▶│ RUNNING │           │
└─────────┘               └────────┘             └─────────┘           │
     ▲                         ▲                      │                │
     │                         │                      │ pauseShow      │
     │                         │                      ▼                │
     │                         │                 ┌─────────┐           │
     │                         │ resumeShow      │ PAUSED  │           │
     │                         │◀────────────────┴─────────┘           │
     │                         │                      │                │
     │                    reloadRundown               │                │
     │                         │                      │                │
     │                         │                      │ stopShow       │
     │   resetShow        ┌────────┐                  │                │
     │◀───────────────────│STOPPED │◀─────────────────┘                │
     │                    └────────┘                                   │
     │                         │                                       │
     │                         │ segment reaches end                   │
     │                         ▼                                       │
     │                    ┌──────────┐  (auto if last segment)         │
     └────────────────────│ COMPLETE │─────────────────────────────────┘
                          └──────────┘
```

### State Definitions

| State | Description | Valid Actions |
|-------|-------------|---------------|
| `IDLE` | No rundown loaded | `loadRundown` |
| `LOADED` | Rundown loaded, ready to start | `startShow`, `reloadRundown`, `resetShow` |
| `RUNNING` | Show in progress, timer active | `pauseShow`, `stopShow`, `nextSegment`, `prevSegment`, `jumpToSegment` |
| `PAUSED` | Show paused, timer frozen | `resumeShow`, `stopShow`, `reloadRundown` |
| `STOPPED` | Show stopped before completion | `resetShow`, `reloadRundown` |
| `COMPLETE` | All segments finished | `resetShow`, `reloadRundown` |

### State Transitions

| From | Event | To | Side Effects |
|------|-------|----|--------------|
| IDLE | `loadRundown` | LOADED | Fetch segments from Firebase, initialize engine |
| LOADED | `startShow` | RUNNING | Activate first segment, start timer, fire OBS/graphics |
| RUNNING | `pauseShow` | PAUSED | Freeze timer, keep current segment |
| PAUSED | `resumeShow` | RUNNING | Resume timer |
| RUNNING | `stopShow` | STOPPED | Stop timer, log analytics |
| PAUSED | `stopShow` | STOPPED | Log analytics |
| RUNNING | segment ends (last) | COMPLETE | Log analytics, show complete indicator |
| STOPPED | `resetShow` | IDLE | Clear segments, reset state |
| COMPLETE | `resetShow` | IDLE | Clear segments, reset state |
| LOADED/PAUSED/STOPPED | `reloadRundown` | LOADED | Re-fetch segments, preserve position if possible |

---

## 3. Task Dependency Graph

```
PHASE A (P0): Connect Editor to Engine
═══════════════════════════════════════

A.0.1 ──┬──▶ A.0.3 ──┐
        │            │
A.0.2 ──┼──▶ A.0.4 ──┼──▶ A.0.6 ──┐
        │            │            │
        └──▶ A.0.5 ──┘            │
                                  │
A.0.7 ────────────────────────────┼──▶ A.1 ──▶ A.2 ──▶ A.3
                                  │            │
                                  │            ▼
                                  │           A.4 ──▶ A.5 ──▶ A.6
                                  │
                                  └──▶ A.5.1 ──┬──▶ A.5.3
                                       A.5.2 ──┘

PHASE H (P1): Rehearsal Mode          PHASE B (P1): Talent View
══════════════════════════════        ════════════════════════════

     ┌──▶ H.2 ──┐                          B.1 ──▶ B.2 ──┐
     │          │                                        │
H.1 ─┼──▶ H.3 ──┼──▶ H.4 ──▶ H.5               B.3 ──────┤
     │          │                                        │
     └──────────┘                          B.4 ──▶ B.5 ──┼──▶ B.6
                                                         │
                                                         ▼
PHASE I (P2): Live Rundown Sync       ◄───── DEPENDS ON PHASE A
══════════════════════════════════

I.1 ──▶ I.2 ──▶ I.3 ──┬──▶ I.5 ──▶ I.6 ──▶ I.7
                      │
                      └──▶ I.4
```

### Critical Path (Minimum for MVP)

```
A.0.1 → A.0.2 → A.0.3 → A.0.6 → A.1 → A.2 → A.3 → A.4 → A.6
  │
  └──▶ "Producer can load rundown and start show"
```

### Parallel Work Opportunities

| Can Run In Parallel | Reason |
|---------------------|--------|
| A.0.3, A.0.4, A.0.5 | Independent OBS method updates |
| A.5.1, A.5.2 | Independent picker verification |
| Phase H, Phase B | No dependencies on each other (both depend on A) |
| H.2, H.3 | Independent skip logic |

---

## 4. Key Files

### Server
| File | Purpose | Changes Required |
|------|---------|------------------|
| `server/index.js` | Coordinator entry point, socket handlers | Add `timesheetEngines` Map, `loadRundown` handler |
| `server/lib/timesheetEngine.js` | Show execution engine (~1187 lines) | Accept `compId`, `obsConnectionManager`; update OBS calls |
| `server/lib/obsConnectionManager.js` | Per-competition OBS WebSocket connections | Already supports multi-competition ✅ |
| `server/lib/vmPoolManager.js` | EC2 VM assignment and lifecycle | No changes needed |
| `server/lib/productionConfigService.js` | Firebase Admin initialization | Export `db` for engine use |

### Client
| File | Purpose | Changes Required |
|------|---------|------------------|
| `show-controller/src/hooks/useTimesheet.js` | Client hook for timesheet state | Add `loadRundown`, `reloadRundown` actions |
| `show-controller/src/context/ShowContext.jsx` | Shared state, socket connection | Emit `loadRundown` event |
| `show-controller/src/pages/RundownEditorPage.jsx` | Rundown planning UI | Verify pickers use live data |
| `show-controller/src/views/ProducerView.jsx` | Production control + Timesheet UI | Add Load/Reload buttons, status indicator |
| `show-controller/src/components/CurrentSegment.jsx` | Now Playing display | No changes needed |
| `show-controller/src/components/NextSegment.jsx` | Up Next display | No changes needed |
| `show-controller/src/components/RunOfShow.jsx` | Show Progress list | Add "modified" badge |

---

## 5. Code Audit (2026-01-23)

### 5.1 Current State

| Component | Code Exists | Actually Works |
|-----------|-------------|----------------|
| Timesheet Engine | ✅ ~1200 lines | ⚠️ Not wired to Firebase/OBS properly |
| useTimesheet Hook | ✅ | ✅ Works |
| Timesheet UI | ✅ | ✅ Works |
| Rundown Editor | ✅ | ⚠️ Pickers need verification |

### 5.2 Critical Gap: Single Global Instance

**Current (Wrong):** `server/index.js` lines 250-255
```javascript
// Single global instance - can only control one competition
let timesheetEngine;

function initializeTimesheetEngine() {
  timesheetEngine = new TimesheetEngine({
    showConfig,
    obs,        // ❌ Single OBS connection
    io
    // MISSING: firebase, compId, obsConnectionManager
  });
}
```

**Required (Correct):**
```javascript
// Map of per-competition instances
const timesheetEngines = new Map();

function getOrCreateEngine(compId, obsConnectionManager, firebase, io) {
  if (!timesheetEngines.has(compId)) {
    const engine = new TimesheetEngine({
      compId,
      obsConnectionManager,
      firebase,
      io
    });
    timesheetEngines.set(compId, engine);
  }
  return timesheetEngines.get(compId);
}
```

### 5.3 Methods Requiring Updates

| Method | Current | Required Change |
|--------|---------|-----------------|
| `_applyTransitionAndSwitchScene()` | `this.obs.call(...)` | Use `obsConnectionManager.getConnection(compId)` |
| `_triggerGraphic()` | `this.firebase` (never provided) | Pass Firebase Admin in constructor |
| `_playVideo()` | `this.obs.call(...)` | Use per-competition OBS |
| `_applyAudioOverrides()` | `this.obs.call(...)` | Use per-competition OBS |
| Event broadcasts | `this.io.emit(...)` | `this.io.to('competition:${compId}').emit(...)` |

---

## 6. Socket Events

### 6.1 Client → Server (Commands)

#### `loadRundown`
Load segments from Firebase into the engine.

```javascript
// Request
socket.emit('loadRundown', { compId: 'abc123' });

// Response (via timesheetState)
// Engine state with segments loaded
```

#### `startShow`
Begin show execution.

```javascript
socket.emit('startShow', { compId: 'abc123' });
```

#### `stopShow`
Stop show execution.

```javascript
socket.emit('stopShow', { compId: 'abc123' });
```

#### `pauseShow` / `resumeShow`
Pause or resume the current show.

```javascript
socket.emit('pauseShow', { compId: 'abc123' });
socket.emit('resumeShow', { compId: 'abc123' });
```

#### `nextSegment` / `prevSegment`
Advance to next or previous segment.

```javascript
socket.emit('nextSegment', { compId: 'abc123' });
socket.emit('prevSegment', { compId: 'abc123' });
```

#### `jumpToSegment`
Jump to a specific segment by ID.

```javascript
socket.emit('jumpToSegment', { compId: 'abc123', segmentId: 'segment-5' });
```

#### `reloadRundown`
Hot-reload rundown from Firebase (Phase I).

```javascript
socket.emit('reloadRundown', { compId: 'abc123' });
```

### 6.2 Server → Client (State Updates)

#### `timesheetState`
Full state update (sent on load, major changes).

```javascript
{
  showState: 'RUNNING',           // IDLE | LOADED | RUNNING | PAUSED | STOPPED | COMPLETE
  isRehearsalMode: false,
  segments: [
    {
      id: 'segment-1',
      name: 'Pre-Show Graphics',
      type: 'graphics',
      duration: 30,
      obsScene: 'Pre-Show',
      graphic: 'logos',
      graphicData: { teamIds: ['ucla', 'oregon'] },
      autoAdvance: true,
      notes: 'Wait for countdown'
    },
    // ... more segments
  ],
  currentSegmentIndex: 3,
  currentSegmentId: 'segment-4',
  elapsedTime: 45,                // seconds into current segment
  totalElapsed: 320,              // seconds since show start
  rundownModified: false,         // true if Firebase changed since load
  rundownModifiedSummary: null    // { added: [], removed: [], modified: [] }
}
```

#### `timesheetTick`
Lightweight timing update (sent every second during RUNNING state).

```javascript
{
  currentSegmentIndex: 3,
  elapsedTime: 46,                // seconds into current segment
  remainingTime: 14,              // seconds remaining in segment
  totalElapsed: 321,
  progress: 0.77                  // 0-1 progress through segment
}
```

#### `timesheetSegmentActivated`
Sent when a new segment becomes active.

```javascript
{
  previousSegmentId: 'segment-3',
  previousSegmentIndex: 2,
  currentSegmentId: 'segment-4',
  currentSegmentIndex: 3,
  segment: {
    id: 'segment-4',
    name: 'UCLA Introduction',
    duration: 30,
    obsScene: 'Team-Intro',
    // ... full segment data
  },
  nextSegment: {
    id: 'segment-5',
    name: 'Oregon Introduction',
    // ... preview of next
  }
}
```

#### `timesheetShowStarted`
Show has started.

```javascript
{
  startedAt: '2026-01-23T19:00:00.000Z',
  totalSegments: 24,
  firstSegment: { id: 'segment-1', name: 'Pre-Show Graphics' }
}
```

#### `timesheetShowStopped`
Show was stopped (not complete).

```javascript
{
  stoppedAt: '2026-01-23T19:45:00.000Z',
  lastSegmentIndex: 12,
  reason: 'manual'                // manual | error
}
```

#### `timesheetShowComplete`
All segments finished.

```javascript
{
  completedAt: '2026-01-23T20:30:00.000Z',
  totalDuration: 5400,            // seconds
  segmentCount: 24
}
```

#### `rundownModified` (Phase I)
Firebase rundown changed while show is loaded/running.

```javascript
{
  added: ['segment-25'],
  removed: [],
  modified: ['segment-12'],
  affectsCurrent: false,
  affectsUpcoming: true,
  timestamp: '2026-01-23T19:32:00.000Z'
}
```

#### `obsError`
OBS operation failed (non-fatal).

```javascript
{
  operation: 'sceneChange',
  scene: 'Team-Intro',
  error: 'Scene not found',
  segmentId: 'segment-4'
}
```

---

## 7. Segment Data Mapping

| Editor Field | Engine Field | Notes |
|--------------|--------------|-------|
| `id` | `id` | Direct copy |
| `name` | `name` | Direct copy |
| `type` | `type` | Direct copy |
| `duration` | `duration` | In seconds |
| `scene` | `obsScene` | OBS scene name |
| `graphic.graphicId` | `graphic` | Graphic identifier |
| `graphic.params` | `graphicData` | Graphic parameters |
| `timingMode` | `autoAdvance` | 'fixed' → true, 'manual' → false |
| `notes` | `notes` | Direct copy |

---

## 8. Task Breakdown

### Phase A: Connect Editor to Engine (P0)

#### A.0: Refactor TimesheetEngine for Multi-Competition (PREREQUISITE)

- [ ] **A.0.1** Update TimesheetEngine constructor to accept `compId` and `obsConnectionManager`
- [ ] **A.0.2** Create `timesheetEngines` Map in server/index.js
- [ ] **A.0.3** Update `_applyTransitionAndSwitchScene()` to use `obsConnectionManager.getConnection(this.compId)`
- [ ] **A.0.4** Update `_playVideo()` to use per-competition OBS connection
- [ ] **A.0.5** Update `_applyAudioOverrides()` to use per-competition OBS connection
- [ ] **A.0.6** Update all socket event broadcasts to target competition room: `io.to('competition:${compId}')`
- [ ] **A.0.7** Pass Firebase Admin instance to engine for `_triggerGraphic()`

#### A.1-A.6: Build Load Rundown Feature

- [ ] **A.1** Add `loadRundown` socket handler on server (creates/updates engine for compId)
- [ ] **A.2** Add `loadRundown` action in ShowContext
- [ ] **A.3** Add "Load Rundown" button in Producer View
- [ ] **A.4** Create segment mapper (Editor format → Engine format)
- [ ] **A.5** Verify Firebase is passed to engine
- [ ] **A.6** Show rundown status indicator (loaded, modified, etc.)

#### A.5x: Verify Pickers

- [ ] **A.5.1** Verify Rundown Editor scene picker uses OBS state
- [ ] **A.5.2** Verify Rundown Editor graphics picker uses Graphics Registry
- [ ] **A.5.3** Fix any hardcoded picker data

---

### Phase H: Rehearsal Mode (P1)

- [ ] **H.1** Add rehearsal mode toggle to Timesheet Engine
- [ ] **H.2** Skip OBS scene changes in rehearsal mode
- [ ] **H.3** Skip graphics firing in rehearsal mode
- [ ] **H.4** Show "REHEARSAL" indicator in all views
- [ ] **H.5** Log timing data for post-rehearsal analysis

---

### Phase B: Talent View (P1)

- [ ] **B.1** Create `TalentView.jsx` page
- [ ] **B.2** Current segment with prominent time remaining
- [ ] **B.3** Scene switching buttons
- [ ] **B.4** Next segment preview
- [ ] **B.5** Notes display
- [ ] **B.6** Add `/talent` route

**Layout Reference:**
```
┌─────────────────────────────────────────────────────────────────┐
│  TALENT VIEW                                   [Scene Buttons]  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─ CURRENT SEGMENT ──────────────────────────────────────────┐ │
│  │  UCLA Introduction                                          │ │
│  │                                                             │ │
│  │              0:22 REMAINING                                 │ │
│  │              (of 0:30)                                      │ │
│  │                                                             │ │
│  │  [████████████████████████░░░░░░░░░░░░] 73%                │ │
│  │                                                             │ │
│  │  NOTES: Wait for applause to die down                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ UP NEXT ──────────────────────────────────────────────────┐ │
│  │  Oregon Introduction (0:30)                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase I: Live Rundown Sync (P2)

#### I.1-I.3: Change Detection

- [ ] **I.1** Subscribe to Firebase `rundown/segments` changes on server (use `onValue` listener)
- [ ] **I.2** Compare incoming segments to loaded segments (deep diff)
- [ ] **I.3** Emit `rundownModified` socket event with change summary:
  ```javascript
  {
    added: ['segment-id-1'],
    removed: ['segment-id-2'],
    modified: ['segment-id-3'],
    affectsCurrent: false,  // true if current segment was modified/deleted
    affectsUpcoming: true   // true if any future segment changed
  }
  ```

#### I.4-I.5: UI Indicators

- [ ] **I.4** Add `rundownModified` state to `useTimesheet` hook
- [ ] **I.5** Show "Rundown Modified" warning badge in Producer View header
  - Yellow badge if only future segments changed
  - Red badge if current segment affected
  - Show count: "3 segments changed"

#### I.6-I.7: Reload Flow

- [ ] **I.6** Add "Reload Rundown" button (appears when modified)
- [ ] **I.7** Confirmation dialog with change summary:
  ```
  ┌─────────────────────────────────────────────┐
  │  Reload Rundown?                            │
  ├─────────────────────────────────────────────┤
  │  Changes detected:                          │
  │  • 1 segment added                          │
  │  • 2 segments modified                      │
  │                                             │
  │  Current position will be preserved.        │
  │  You are on segment 12 of 24.               │
  │                                             │
  │  [Cancel]                    [Reload Now]   │
  └─────────────────────────────────────────────┘
  ```

#### I.8-I.10: Edge Case Handling

- [ ] **I.8** Handle deleted current segment:
  - Keep segment active until manual advance
  - Show warning: "Current segment was deleted from rundown"
  - On advance, skip to next valid segment
- [ ] **I.9** Handle reordered past segments:
  - Ignore changes to segments before current index
  - Only apply changes to current and future segments
- [ ] **I.10** Handle ID conflicts:
  - Match segments by ID, not index
  - If current segment ID still exists, stay on it regardless of new position

---

### Phase J: Segment Timing Analytics (P2)

- [ ] **J.1** Log actual segment durations during show
- [ ] **J.2** Store timing data in Firebase post-show
- [ ] **J.3** Create timing analytics dashboard
- [ ] **J.4** Show historical average in Rundown Editor
- [ ] **J.5** AI-powered timing predictions based on history

---

### Phase D: AI Suggestions - Planning (P2)

- [ ] **D.1** Create AI suggestion service on server
- [ ] **D.2** Analyze competition metadata (type, teams, date)
- [ ] **D.3** Query roster data for seniors, All-Americans, milestones
- [ ] **D.4** Generate segment suggestions with confidence scores
- [ ] **D.5** Add `getAISuggestions` API endpoint
- [ ] **D.6** Wire Rundown Editor to display suggestions

---

### Phase E: Script & Talent Flow (P2)

- [ ] **E.1** Add script field to segment data model
- [ ] **E.2** Pipe script field through Timesheet Engine
- [ ] **E.3** Display script in Talent View (teleprompter-style)
- [ ] **E.4** Add talent assignment to segment data model
- [ ] **E.5** Create talent schedule view
- [ ] **E.6** Show "you're on camera" indicator in Talent View

---

### Phase C: AI Context - Live Execution (P3)

- [ ] **C.1** Create AIContextService stub
- [ ] **C.2** Add `aiContextUpdated` socket event
- [ ] **C.3** Create `useAIContext` hook
- [ ] **C.4** Integrate with Virtius API for live stats
- [ ] **C.5** Generate talking points in real-time
- [ ] **C.6** Detect career highs, records during show
- [ ] **C.7** Display AI context in Talent View
- [ ] **C.8** Display AI context in Producer View

---

### Phase F: Audio Cue Integration (P3)

- [ ] **F.1** Add audio cue fields to segment data model
- [ ] **F.2** Pipe audio cues through Timesheet Engine
- [ ] **F.3** Trigger audio playback on segment start
- [ ] **F.4** Add audio control to Producer View

---

### Phase G: Production Tracking (P3)

- [ ] **G.1** Add equipment fields to segment data model
- [ ] **G.2** Generate equipment schedule report
- [ ] **G.3** Detect equipment conflicts
- [ ] **G.4** Add sponsor fields to segment data model
- [ ] **G.5** Generate sponsor fulfillment report

---

## 9. Error Handling

### 9.1 OBS Connection Failures

| Scenario | Detection | Response | User Feedback |
|----------|-----------|----------|---------------|
| OBS disconnects mid-show | `obsConnectionManager` emits `disconnected` | Continue show, queue scene changes | "OBS Disconnected" badge, retry button |
| OBS reconnects | `obsConnectionManager` emits `connected` | Replay last scene change | "OBS Connected" toast |
| Scene change fails | OBS WebSocket error | Log error, continue show | "Scene change failed" toast |
| Scene doesn't exist | OBS returns error | Skip scene change, log | "Scene 'X' not found" warning |

### 9.2 Firebase Failures

| Scenario | Detection | Response | User Feedback |
|----------|-----------|----------|---------------|
| Firebase read fails | Promise rejection in `loadRundown` | Retry 3x with backoff | "Failed to load rundown" error |
| Firebase write fails | Promise rejection in analytics | Queue for retry | Silent (non-critical) |
| Firebase listener disconnects | `onValue` error callback | Reconnect automatically | "Sync paused" indicator |

### 9.3 Show Execution Errors

| Scenario | Detection | Response | User Feedback |
|----------|-----------|----------|---------------|
| Segment has no duration | Validation on load | Default to 30s, warn | "Segment X has no duration" warning |
| Segment has invalid scene | Validation on load | Skip scene change | "Invalid scene in segment X" warning |
| Timer drift > 1s | Periodic sync check | Correct timer | Silent correction |
| Engine crashes | Uncaught exception | Restart engine, preserve state | "Show engine restarted" warning |

### 9.4 Recovery Strategies

```javascript
// Graceful degradation for OBS failures
async function executeSegmentWithFallback(segment) {
  try {
    await this._applyTransitionAndSwitchScene(segment.obsScene);
  } catch (error) {
    this._log('warn', `Scene change failed: ${error.message}`);
    this._emit('obsError', { segment: segment.id, error: error.message });
    // Continue show - don't block on OBS failures
  }

  // Graphics are optional - don't block on failure
  if (segment.graphic) {
    try {
      await this._triggerGraphic(segment.graphic, segment.graphicData);
    } catch (error) {
      this._log('warn', `Graphic failed: ${error.message}`);
    }
  }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Component | Test File | Key Tests |
|-----------|-----------|-----------|
| TimesheetEngine | `server/lib/__tests__/timesheetEngine.test.js` | State transitions, timing accuracy, segment progression |
| Segment Mapper | `server/lib/__tests__/segmentMapper.test.js` | Editor → Engine format conversion |
| useTimesheet Hook | `show-controller/src/hooks/__tests__/useTimesheet.test.js` | State updates, action dispatching |

### 10.2 Integration Tests

| Scenario | Setup | Assertions |
|----------|-------|------------|
| Load rundown | Create test segments in Firebase | Segments appear in engine, state = LOADED |
| Start show | Load rundown, call startShow | First segment active, timer running |
| OBS integration | Mock OBS WebSocket | Scene change called with correct name |
| Multi-competition | Create 2 engines | Actions on one don't affect other |
| Live reload | Modify Firebase during show | Change detected, reload preserves position |

### 10.3 End-to-End Tests (Playwright)

```javascript
// E2E: Producer loads and runs show
test('producer can load and start show', async ({ page }) => {
  await page.goto('/comp123/producer');

  // Load rundown
  await page.click('button:has-text("Load Rundown")');
  await expect(page.locator('.segment-list')).toContainText('24 segments');

  // Start show
  await page.click('button:has-text("Start Show")');
  await expect(page.locator('.current-segment')).toContainText('Pre-Show');
  await expect(page.locator('.timer')).toBeVisible();
});

// E2E: Live reload during show
test('producer can reload modified rundown', async ({ page }) => {
  await page.goto('/comp123/producer');
  await page.click('button:has-text("Load Rundown")');
  await page.click('button:has-text("Start Show")');

  // Simulate Firebase change (via API)
  await addSegmentViaAPI('comp123', { name: 'Breaking News', duration: 60 });

  // Verify warning appears
  await expect(page.locator('.rundown-modified-badge')).toBeVisible();

  // Reload
  await page.click('button:has-text("Reload Rundown")');
  await page.click('button:has-text("Reload Now")');

  // Verify new segment appears
  await expect(page.locator('.segment-list')).toContainText('Breaking News');
});
```

### 10.4 Manual Test Checklist

#### Phase A: Basic Flow
- [ ] Create rundown in Editor with 5 segments
- [ ] Navigate to Producer View
- [ ] Click "Load Rundown" - segments appear
- [ ] Click "Start Show" - timer starts, first segment active
- [ ] Wait for auto-advance - second segment activates
- [ ] Click "Next" on manual segment - advances
- [ ] Verify OBS scene changes (check OBS)
- [ ] Stop show - timer stops

#### Phase H: Rehearsal
- [ ] Enable rehearsal mode
- [ ] Start show - timer runs
- [ ] Verify OBS does NOT change scenes
- [ ] Verify graphics do NOT fire
- [ ] "REHEARSAL" visible in all views

#### Phase I: Live Sync
- [ ] Start show (not rehearsal)
- [ ] In new tab, edit rundown - add segment
- [ ] Return to Producer View - "Modified" badge visible
- [ ] Click "Reload" - new segment appears
- [ ] Position preserved (still on same segment)

---

## 11. Open Questions

| Question | Status | Decision |
|----------|--------|----------|
| Quick scenes configuration - per-competition or global? | Open | Likely per-competition in Firebase |
| Should graphics fire via Firebase or socket.io? | Open | Currently socket.io only - may need both |
| AI service provider for suggestions/context? | Open | Claude API, OpenAI, or custom rules engine? |
| Audio playback mechanism? | Open | OBS media source, separate player, or browser? |
| Talent View mobile optimization? | Open | Responsive design or separate mobile app? |
| Rehearsal mode - same view or separate route? | Open | Likely same views with "REHEARSAL" badge |

---

## 12. Reference APIs

### obsConnectionManager

```javascript
obsConnectionManager.connectToVM(compId, vmAddress)  // Connect to competition's VM
obsConnectionManager.getConnection(compId)            // Get OBS WebSocket
obsConnectionManager.isConnected(compId)              // Check connection status
obsConnectionManager.getConnectionState(compId)       // Get full state
```

### Firebase Paths

```
competitions/{compId}/production/rundown/segments    # Rundown data
competitions/{compId}/production/rundown/metadata    # Rundown metadata
```
