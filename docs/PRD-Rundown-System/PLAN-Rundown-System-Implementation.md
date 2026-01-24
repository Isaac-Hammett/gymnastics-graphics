# PLAN-Rundown-System-Implementation

**PRD:** [PRD-Rundown-System-2026-01-23.md](./PRD-Rundown-System-2026-01-23.md)
**Status:** IN PROGRESS
**Created:** 2026-01-23
**Last Updated:** 2026-01-24

---

## Overview

This implementation plan covers all phases of the Rundown System from planning to live execution. Phase A connects the existing Rundown Editor to the Timesheet Engine for live show execution. Subsequent phases add rehearsal mode, talent view, live sync, analytics, and AI features.

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD-Rundown-System-2026-01-23.md](./PRD-Rundown-System-2026-01-23.md) | Product requirements |
| [PLAN-Rundown-System-2026-01-23.md](./PLAN-Rundown-System-2026-01-23.md) | Technical reference (architecture, state machine, socket events, error handling, testing) |

---

## IMPORTANT: Task Execution Rules

**ONE TASK = ONE ITERATION**

Each row in the task tables below is ONE task. Complete exactly ONE task per iteration:

1. Pick the first NOT STARTED or IN PROGRESS task
2. Implement that ONE task
3. Commit, deploy, verify
4. STOP - the next iteration will handle the next task

**Do NOT:**
- Complete multiple tasks in one iteration
- Batch "related" tasks together
- Complete an entire phase in one iteration

**Task Numbering:**
- Tasks are numbered sequentially: Task 1, Task 2, ... Task 71
- Each task number is unique and independent
- Example: "Task 8" is ONE task, not a subtask

---

## Phase Summary

| Phase | Name | Priority | Status | Tasks |
|-------|------|----------|--------|-------|
| A | Connect Editor to Engine | P0 | IN PROGRESS | 1-16 |
| H | Rehearsal Mode | P1 | NOT STARTED | 17-21 |
| B | Talent View | P1 | NOT STARTED | 22-27 |
| I | Live Rundown Sync | P2 | NOT STARTED | 28-37 |
| J | Segment Timing Analytics | P2 | NOT STARTED | 38-42 |
| D | AI Suggestions - Planning | P2 | NOT STARTED | 43-48 |
| E | Script & Talent Flow | P2 | NOT STARTED | 49-54 |
| C | AI Context - Live Execution | P3 | NOT STARTED | 55-62 |
| F | Audio Cue Integration | P3 | NOT STARTED | 63-66 |
| G | Production Tracking | P3 | NOT STARTED | 67-71 |

---

## Task Summary by Phase

### Phase A: Connect Editor to Engine (P0) - IN PROGRESS (9/16 complete)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 1 | Update TimesheetEngine constructor to accept `compId` and `obsConnectionManager` | COMPLETE | Commit 9d0267c |
| Task 2 | Create `timesheetEngines` Map in server/index.js | COMPLETE | Added Map, getOrCreateEngine, getEngine, removeEngine functions |
| Task 3 | Update `_applyTransitionAndSwitchScene()` to use `obsConnectionManager.getConnection(this.compId)` | COMPLETE | Updated to get OBS connection from obsConnectionManager using compId, with fallback to legacy this.obs |
| Task 4 | Update `_playVideo()` to use per-competition OBS connection | COMPLETE | Updated to use obsConnectionManager.getConnection(compId) with fallback to legacy this.obs |
| Task 5 | Update `_applyAudioOverrides()` to use per-competition OBS connection | COMPLETE | Updated to use obsConnectionManager.getConnection(compId) with fallback to legacy this.obs |
| Task 6 | Update all socket event broadcasts to target competition room | COMPLETE | Updated `_triggerGraphic()` to use `io.to('competition:${compId}').emit()` with fallback to legacy broadcast. All other socket events are already routed through EventEmitter handlers in server/index.js `getOrCreateEngine()` which already use room-based broadcasting. |
| Task 7 | Pass Firebase Admin instance to engine for `_triggerGraphic()` | COMPLETE | Updated `_triggerGraphic()` to handle both Firebase db and Admin app; added JSDoc example to `getOrCreateEngine()` |
| Task 8 | Add `loadRundown` socket handler on server | COMPLETE | Added handler that fetches segments from Firebase and loads into engine via updateConfig() |
| Task 9 | Add `loadRundown` action in ShowContext | COMPLETE | Added loadRundown function, loadRundownResult handler, rundownLoaded state |
| Task 10 | Add "Load Rundown" button in Producer View | NOT STARTED | |
| Task 11 | Create segment mapper (Editor format → Engine format) | NOT STARTED | |
| Task 12 | Verify Firebase is passed to engine | NOT STARTED | |
| Task 13 | Show rundown status indicator (loaded, modified, etc.) | NOT STARTED | |
| Task 14 | Verify Rundown Editor scene picker uses OBS state | NOT STARTED | |
| Task 15 | Verify Rundown Editor graphics picker uses Graphics Registry | NOT STARTED | |
| Task 16 | Fix any hardcoded picker data | NOT STARTED | |

### Phase H: Rehearsal Mode (P1) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 17 | Add rehearsal mode toggle to Timesheet Engine | NOT STARTED | |
| Task 18 | Skip OBS scene changes in rehearsal mode | NOT STARTED | |
| Task 19 | Skip graphics firing in rehearsal mode | NOT STARTED | |
| Task 20 | Show "REHEARSAL" indicator in all views | NOT STARTED | |
| Task 21 | Log timing data for post-rehearsal analysis | NOT STARTED | |

### Phase B: Talent View (P1) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 22 | Create `TalentView.jsx` page | NOT STARTED | |
| Task 23 | Current segment with prominent time remaining | NOT STARTED | |
| Task 24 | Scene switching buttons | NOT STARTED | |
| Task 25 | Next segment preview | NOT STARTED | |
| Task 26 | Notes display | NOT STARTED | |
| Task 27 | Add `/talent` route | NOT STARTED | |

### Phase I: Live Rundown Sync (P2) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 28 | Subscribe to Firebase `rundown/segments` changes on server | NOT STARTED | |
| Task 29 | Compare incoming segments to loaded segments (deep diff) | NOT STARTED | |
| Task 30 | Emit `rundownModified` socket event with change summary | NOT STARTED | |
| Task 31 | Add `rundownModified` state to `useTimesheet` hook | NOT STARTED | |
| Task 32 | Show "Rundown Modified" warning badge in Producer View | NOT STARTED | |
| Task 33 | Add "Reload Rundown" button (appears when modified) | NOT STARTED | |
| Task 34 | Confirmation dialog with change summary | NOT STARTED | |
| Task 35 | Handle deleted current segment | NOT STARTED | |
| Task 36 | Handle reordered past segments | NOT STARTED | |
| Task 37 | Handle ID conflicts | NOT STARTED | |

### Phase J: Segment Timing Analytics (P2) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 38 | Log actual segment durations during show | NOT STARTED | |
| Task 39 | Store timing data in Firebase post-show | NOT STARTED | |
| Task 40 | Create timing analytics dashboard | NOT STARTED | |
| Task 41 | Show historical average in Rundown Editor | NOT STARTED | |
| Task 42 | AI-powered timing predictions based on history | NOT STARTED | |

### Phase D: AI Suggestions - Planning (P2) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 43 | Create AI suggestion service on server | NOT STARTED | |
| Task 44 | Analyze competition metadata (type, teams, date) | NOT STARTED | |
| Task 45 | Query roster data for seniors, All-Americans, milestones | NOT STARTED | |
| Task 46 | Generate segment suggestions with confidence scores | NOT STARTED | |
| Task 47 | Add `getAISuggestions` API endpoint | NOT STARTED | |
| Task 48 | Wire Rundown Editor to display suggestions | NOT STARTED | |

### Phase E: Script & Talent Flow (P2) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 49 | Add script field to segment data model | NOT STARTED | |
| Task 50 | Pipe script field through Timesheet Engine | NOT STARTED | |
| Task 51 | Display script in Talent View (teleprompter-style) | NOT STARTED | |
| Task 52 | Add talent assignment to segment data model | NOT STARTED | |
| Task 53 | Create talent schedule view | NOT STARTED | |
| Task 54 | Show "you're on camera" indicator in Talent View | NOT STARTED | |

### Phase C: AI Context - Live Execution (P3) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 55 | Create AIContextService stub | NOT STARTED | |
| Task 56 | Add `aiContextUpdated` socket event | NOT STARTED | |
| Task 57 | Create `useAIContext` hook | NOT STARTED | |
| Task 58 | Integrate with Virtius API for live stats | NOT STARTED | |
| Task 59 | Generate talking points in real-time | NOT STARTED | |
| Task 60 | Detect career highs, records during show | NOT STARTED | |
| Task 61 | Display AI context in Talent View | NOT STARTED | |
| Task 62 | Display AI context in Producer View | NOT STARTED | |

### Phase F: Audio Cue Integration (P3) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 63 | Add audio cue fields to segment data model | NOT STARTED | |
| Task 64 | Pipe audio cues through Timesheet Engine | NOT STARTED | |
| Task 65 | Trigger audio playback on segment start | NOT STARTED | |
| Task 66 | Add audio control to Producer View | NOT STARTED | |

### Phase G: Production Tracking (P3) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 67 | Add equipment fields to segment data model | NOT STARTED | |
| Task 68 | Generate equipment schedule report | NOT STARTED | |
| Task 69 | Detect equipment conflicts | NOT STARTED | |
| Task 70 | Add sponsor fields to segment data model | NOT STARTED | |
| Task 71 | Generate sponsor fulfillment report | NOT STARTED | |

---

## Detailed Tasks - Phase A (P0)

### Task 1: Update TimesheetEngine constructor

**Status:** COMPLETE (Commit 9d0267c)
**File:** `server/lib/timesheetEngine.js`

**Description:**
Update the TimesheetEngine constructor to accept `compId` and `obsConnectionManager` parameters for multi-competition support.

**Checklist:**
- [ ] Add `compId` parameter to constructor
- [ ] Add `obsConnectionManager` parameter to constructor
- [ ] Store both as instance properties
- [ ] Remove dependency on global `obs` singleton

---

### Task 2: Create timesheetEngines Map

**Status:** COMPLETE
**File:** `server/index.js`

**Description:**
Create a Map to store per-competition TimesheetEngine instances, replacing the single global instance.

**Checklist:**
- [x] Replace `let timesheetEngine` with `const timesheetEngines = new Map()`
- [x] Create `getOrCreateEngine(compId, obsConnectionManager, firebase, io)` function
- [x] Update existing engine initialization logic

**Implementation Notes:**
- Added `const timesheetEngines = new Map()` to store per-competition engines
- Kept legacy `let timesheetEngine = null` for backward compatibility during transition
- Created `getOrCreateEngine(compId, obsConnectionManager, firebase, io)` function that:
  - Creates new engine with compId, obsConnectionManager, firebase, and io
  - Wires up all events to broadcast to competition-specific room (`competition:${compId}`)
  - Stores engine in the Map for reuse
- Created `getEngine(compId)` helper to retrieve existing engines
- Created `removeEngine(compId)` helper to clean up engines when competitions end

---

### Task 3: Update _applyTransitionAndSwitchScene()

**Status:** COMPLETE
**File:** `server/lib/timesheetEngine.js`

**Description:**
Update the scene switching method to use per-competition OBS connection via obsConnectionManager.

**Checklist:**
- [x] Replace `this.obs.call(...)` with `this.obsConnectionManager.getConnection(this.compId).call(...)`
- [x] Handle case when connection doesn't exist
- [x] Add error handling for disconnected state

**Implementation Notes:**
- Updated method to first check for `obsConnectionManager` + `compId` (preferred)
- Added fallback to legacy `this.obs` for backward compatibility
- Emits error event with `type: 'obs_scene_switch'` when no connection found for competition

---

### Task 4: Update _playVideo()

**Status:** COMPLETE
**File:** `server/lib/timesheetEngine.js`

**Description:**
Update the video playback method to use per-competition OBS connection.

**Checklist:**
- [x] Replace `this.obs.call(...)` with `this.obsConnectionManager.getConnection(this.compId).call(...)`
- [x] Handle case when connection doesn't exist

**Implementation Notes:**
- Updated `_playVideo()` to first check for `obsConnectionManager` + `compId` (preferred)
- Added fallback to legacy `this.obs` for backward compatibility
- Emits error event with `type: 'obs_video'` when no connection found for competition
- Also updated `_handleSegmentTypeActions()` to remove redundant `this.obs` check since `_playVideo()` now handles its own connection checking

---

### Task 5: Update _applyAudioOverrides()

**Status:** COMPLETE
**File:** `server/lib/timesheetEngine.js`

**Description:**
Update the audio override method to use per-competition OBS connection.

**Checklist:**
- [x] Replace `this.obs.call(...)` with `this.obsConnectionManager.getConnection(this.compId).call(...)`
- [x] Handle case when connection doesn't exist

**Implementation Notes:**
- Updated `_applyAudioOverrides()` to first check for `obsConnectionManager` + `compId` (preferred)
- Added fallback to legacy `this.obs` for backward compatibility
- Emits error event with `type: 'obs_audio'` when no connection found for competition
- Follows same pattern as `_applyTransitionAndSwitchScene()` and `_playVideo()`

---

### Task 6: Update socket event broadcasts

**Status:** COMPLETE
**File:** `server/lib/timesheetEngine.js`

**Description:**
Update all socket.io event emissions to target the competition-specific room.

**Checklist:**
- [x] Replace `this.io.emit(...)` with `this.io.to('competition:${this.compId}').emit(...)`
- [x] Update all event emissions: `timesheetState`, `timesheetTick`, `timesheetSegmentActivated`, etc.
- [x] Verify room naming matches existing convention

**Implementation Notes:**
- The only direct `this.io.emit()` call in `timesheetEngine.js` was in `_triggerGraphic()` (line 722)
- Updated to use `this.io.to('competition:${this.compId}').emit()` when `compId` is available
- Added fallback to legacy `this.io.emit()` for backward compatibility with single-engine mode
- All other socket events (`timesheetTick`, `timesheetState`, etc.) are emitted via EventEmitter (`this.emit()`) and handled in `server/index.js` by `getOrCreateEngine()` which already broadcasts to the correct room using `socketIo.to(roomName).emit()`

---

### Task 7: Pass Firebase Admin to engine

**Status:** COMPLETE
**File:** `server/lib/timesheetEngine.js`, `server/index.js`

**Description:**
Pass Firebase Admin instance to engine constructor for `_triggerGraphic()` functionality.

**Checklist:**
- [x] Add `firebase` parameter to constructor (already existed)
- [x] Export `db` from productionConfigService.js (already exported as `getDb`)
- [x] Pass Firebase instance when creating engine (added JSDoc example to `getOrCreateEngine()`)
- [x] Update `_triggerGraphic()` to use `this.firebase` (updated to handle both db and Admin app)

**Implementation Notes:**
- `_triggerGraphic()` now auto-detects whether `this.firebase` is the database directly (has `.ref()` method) or the Firebase Admin app (has `.database()` method)
- Added JSDoc example showing `productionConfigService.getDb()` should be passed when calling `getOrCreateEngine()`
- The actual passing of firebase will happen in Task 8 when `loadRundown` socket handler is implemented

---

### Task 8: Add loadRundown socket handler

**Status:** COMPLETE
**File:** `server/index.js`

**Description:**
Add socket handler for `loadRundown` event that creates/retrieves engine and loads segments from Firebase.

**Checklist:**
- [x] Add `socket.on('loadRundown', ...)` handler
- [x] Extract `compId` from payload
- [x] Call `getOrCreateEngine()` to get engine instance
- [x] Fetch segments from Firebase path: `competitions/{compId}/production/rundown/segments`
- [x] Call engine's load method with segments
- [x] Emit `timesheetState` with loaded segments

**Implementation Notes:**
- Handler accepts `compId` from payload or falls back to socket's `clientCompId`
- Fetches segments from Firebase, handles both array and object formats
- Uses `engine.updateConfig({ segments })` to load segments into the engine
- Emits `loadRundownResult` to requesting client with success/error
- Broadcasts `timesheetState` with full segments array to competition room

---

### Task 9: Add loadRundown action in ShowContext

**Status:** COMPLETE
**File:** `show-controller/src/context/ShowContext.jsx`

**Description:**
Add `loadRundown` action to emit the socket event from client.

**Checklist:**
- [x] Add `loadRundown` function that emits `loadRundown` event
- [x] Pass `compId` from context
- [x] Export function from context

**Implementation Notes:**
- Added `loadRundown` function at line 423-426 using useCallback
- Function emits `loadRundown` event with `{ compId }` payload
- Added `loadRundownResult` socket handler at line 332-345 to handle server response
- Added `rundownLoaded` and `segments` fields to INITIAL_TIMESHEET_STATE
- Exported `loadRundown` in context value object at line 499

---

### Task 10: Add "Load Rundown" button

**Status:** NOT STARTED
**File:** `show-controller/src/views/ProducerView.jsx`

**Description:**
Add "Load Rundown" button in Producer View header/toolbar.

**Checklist:**
- [ ] Add "Load Rundown" button to Producer View
- [ ] Wire button to `loadRundown` action from ShowContext
- [ ] Show loading state while loading
- [ ] Show toast on success/failure

---

### Task 11: Create segment mapper

**Status:** NOT STARTED
**File:** `server/lib/segmentMapper.js` (new file)

**Description:**
Create utility to map Rundown Editor segment format to Timesheet Engine format.

**Checklist:**
- [ ] Create `server/lib/segmentMapper.js`
- [ ] Map `scene` → `obsScene`
- [ ] Map `graphic.graphicId` → `graphic`
- [ ] Map `graphic.params` → `graphicData`
- [ ] Map `timingMode` → `autoAdvance` (fixed=true, manual=false)
- [ ] Preserve all other fields

---

### Task 12: Verify Firebase passed to engine

**Status:** NOT STARTED
**File:** `server/index.js`

**Description:**
Verify Firebase Admin is correctly passed and usable in engine.

**Checklist:**
- [ ] Add logging to confirm Firebase instance received
- [ ] Test that `_triggerGraphic()` can write to Firebase
- [ ] Handle missing Firebase gracefully

---

### Task 13: Show rundown status indicator

**Status:** NOT STARTED
**File:** `show-controller/src/views/ProducerView.jsx`

**Description:**
Add status indicator showing rundown state (idle, loaded, modified).

**Checklist:**
- [ ] Add status badge component
- [ ] Show "No Rundown" when state is IDLE
- [ ] Show "Rundown Loaded" when state is LOADED
- [ ] Show segment count in badge

---

### Task 14: Verify scene picker uses OBS state

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Verify that the scene picker dropdown loads scenes from OBS connection state rather than hardcoded data.

**Checklist:**
- [ ] Check current implementation of scene picker
- [ ] If hardcoded, plan integration with OBS scene list
- [ ] Document current state

---

### Task 15: Verify graphics picker uses Registry

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Verify that the graphics picker dropdown uses graphicsRegistry.js.

**Checklist:**
- [ ] Check current implementation of graphics picker
- [ ] Verify graphicsRegistry.js is imported and used
- [ ] Confirm graphics filtered by competition type

---

### Task 16: Fix hardcoded picker data

**Status:** NOT STARTED
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Replace any hardcoded picker data with live data sources.

**Checklist:**
- [ ] Replace DUMMY_SCENES with OBS scene list (if hardcoded)
- [ ] Verify graphics come from registry
- [ ] Test with actual competition data

---

## Bugs & Issues

| Bug ID | Description | Status | Task |
|--------|-------------|--------|------|

---

## Notes

### Dependencies
- **Phase A** is the prerequisite for all other phases
- **Phase H** and **Phase B** can run in parallel after Phase A
- **Phase I-G** depend on Phase A completion

### Architecture Considerations
- Multi-competition support requires Map-based engine instances
- Socket.io rooms isolate competition events
- Firebase Admin must be passed to engine (not just client SDK)
- OBS connections managed by existing obsConnectionManager

### Critical Gap Identified
Current `server/index.js` uses single global `timesheetEngine` instance. Must refactor to per-competition Map before any Phase A work can proceed. See [Technical Reference](./PLAN-Rundown-System-2026-01-23.md) Section 5.2 for details.

### Key Files Reference
See [Technical Reference](./PLAN-Rundown-System-2026-01-23.md) Section 4 for complete file listing.

---

## Completion Criteria

**Phase A Complete:** Producer can load rundown from Firebase, start show, and see segments execute with OBS scene changes.

**MVP Complete:** Phases A + H + B (producer can run rehearsals, talent has dedicated view).

**Full System:** All phases complete.
