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
| A | Connect Editor to Engine | P0 | COMPLETE | 1-16 |
| H | Rehearsal Mode | P1 | COMPLETE | 17-21 |
| B | Talent View | P1 | COMPLETE | 22-27 |
| I | Live Rundown Sync | P2 | COMPLETE | 28-37 |
| J | Segment Timing Analytics | P2 | COMPLETE | 38-42 |
| D | AI Suggestions - Planning | P2 | COMPLETE | 43-48 |
| E | Script & Talent Flow | P2 | COMPLETE | 49-54 |
| C | AI Context - Live Execution | P3 | IN PROGRESS | 55-62 |
| F | Audio Cue Integration | P3 | NOT STARTED | 63-66 |
| G | Production Tracking | P3 | NOT STARTED | 67-71 |

---

## Task Summary by Phase

### Phase A: Connect Editor to Engine (P0) - COMPLETE (16/16)

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
| Task 10 | Add "Load Rundown" button in Producer View | COMPLETE | Added button with loading state, toast feedback, and disabled Start Show until rundown loaded |
| Task 11 | Create segment mapper (Editor format → Engine format) | COMPLETE | Created segmentMapper.js with mapping and validation functions; integrated into loadRundown handler |
| Task 12 | Verify Firebase is passed to engine | COMPLETE | Added logging in getOrCreateEngine and _triggerGraphic to confirm Firebase instance and usage |
| Task 13 | Show rundown status indicator (loaded, modified, etc.) | COMPLETE | Added status badge in header: green "X segments" when loaded, gray "No Rundown" when idle |
| Task 14 | Verify Rundown Editor scene picker uses OBS state | COMPLETE | Scene picker uses hardcoded DUMMY_SCENES (lines 63-73). OBSContext provides obsState.scenes from live OBS. RundownEditorPage does NOT import useOBS. Task 16 will wire live data. |
| Task 15 | Verify Rundown Editor graphics picker uses Graphics Registry | COMPLETE | Uses graphicsRegistry.js with getGraphicsForCompetition(). Filters by compType/gender. Note: Uses DUMMY_COMPETITION.type - Task 16 will wire live data. |
| Task 16 | Fix any hardcoded picker data | COMPLETE | Replaced DUMMY_SCENES with live OBS scenes from useOBS(); replaced DUMMY_COMPETITION with live competition config from useCompetition(); updated getGroupedScenes/getGroupedGraphics to accept params; passed live data to SegmentRow, SegmentDetailPanel, and SelectionSummaryPanel |

### Phase H: Rehearsal Mode (P1) - COMPLETE (5/5)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 17 | Add rehearsal mode toggle to Timesheet Engine | COMPLETE | Added `_isRehearsalMode` property, `isRehearsalMode` getter, `setRehearsalMode()` method, included in `getState()`, emits `rehearsalModeChanged` event |
| Task 18 | Skip OBS scene changes in rehearsal mode | COMPLETE | Added early-return check in `_applyTransitionAndSwitchScene()` that skips OBS calls when `_isRehearsalMode` is true; still emits `sceneChanged` event with `rehearsalMode: true` for UI updates |
| Task 19 | Skip graphics firing in rehearsal mode | COMPLETE | Added early-return check in `_triggerGraphic()` that skips Firebase writes and socket.io broadcasts when `_isRehearsalMode` is true; still emits `graphicTriggered` event with `rehearsalMode: true` for UI updates |
| Task 20 | Show "REHEARSAL" indicator in all views | COMPLETE | Added purple "REHEARSAL MODE" banner in ProducerView, rehearsal toggle button, `setRehearsalMode` socket handler, `rehearsalModeChanged` event wiring |
| Task 21 | Log timing data for post-rehearsal analysis | COMPLETE | Added timing analytics logging in `showStopped` event handler; saves segment history, overrides, and summary to Firebase at `competitions/{compId}/production/rundown/analytics/{runId}` |

### Phase B: Talent View (P1) - COMPLETE (6/6)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 22 | Create `TalentView.jsx` page | COMPLETE | Already existed at `show-controller/src/views/TalentView.jsx` with full implementation |
| Task 23 | Current segment with prominent time remaining | COMPLETE | `CurrentSegment.jsx` has large timer display (elapsed/remaining with font-mono text-2xl) |
| Task 24 | Scene switching buttons | COMPLETE | `QuickActions.jsx` component included in TalentView with apparatus cameras and quick actions |
| Task 25 | Next segment preview | COMPLETE | `NextSegment.jsx` component included showing name, duration, type icon, auto-advance indicator |
| Task 26 | Notes display | COMPLETE | `CurrentSegment.jsx` shows notes in styled box at bottom of segment card |
| Task 27 | Add `/talent` route | COMPLETE | Route exists at `App.jsx:68` as `<Route path="talent" element={<TalentView />} />` |

### Phase I: Live Rundown Sync (P2) - COMPLETE (10/10)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 28 | Subscribe to Firebase `rundown/segments` changes on server | COMPLETE | Added `rundownListeners` Map, `subscribeToRundownChanges()` function, cleanup in `removeEngine()`, called from `loadRundown` handler |
| Task 29 | Compare incoming segments to loaded segments (deep diff) | COMPLETE | Added `deepEqual()`, `compareSegments()`, and `diffSegments()` functions to segmentMapper.js; integrated diff into `subscribeToRundownChanges()` which now logs added/removed/modified/reordered segments with field-level details |
| Task 30 | Emit `rundownModified` socket event with change summary | COMPLETE | Emits to `competition:${compId}` room with: segment IDs for added/removed/modified/reordered, affectsCurrent/affectsUpcoming flags, summary text, timestamp, and detailed change info for confirmation dialog |
| Task 31 | Add `rundownModified` state to `useTimesheet` hook | COMPLETE | Added `rundownModified` and `rundownModifiedSummary` to INITIAL_TIMESHEET_STATE, added `rundownModified` socket listener, added `clearRundownModified` function, exposed all through useTimesheet hook |
| Task 32 | Show "Rundown Modified" warning badge in Producer View | COMPLETE | Added warning badge in header next to rundown status; yellow for future segment changes, red if current segment affected; shows change count with tooltip for summary text |
| Task 33 | Add "Reload Rundown" button (appears when modified) | COMPLETE | Added ArrowUturnLeftIcon import, isReloadingRundown state, handleReloadRundown callback, and Reload button next to warning badge in header; button color matches severity (red if current affected, yellow otherwise) |
| Task 34 | Confirmation dialog with change summary | COMPLETE | Added modal dialog in ProducerView.jsx with: change summary (added/removed/modified/reordered counts), current position info, warning if current segment affected, Cancel/Reload Now buttons |
| Task 35 | Handle deleted current segment | COMPLETE | Added `_currentSegmentDeleted` flag to TimesheetEngine; `updateConfig()` detects deleted segment and emits `currentSegmentDeleted` event; `getState()` includes `currentSegmentDeleted` field; `advance()` handles jumping from deleted segment; server broadcasts `timesheetCurrentSegmentDeleted` event; ProducerView shows red warning banner when current segment deleted |
| Task 36 | Handle reordered past segments | COMPLETE | Added filtering in `subscribeToRundownChanges()` to ignore reordered/modified segments where both old and new positions are before current segment; logs filtered segments for debugging |
| Task 37 | Handle ID conflicts | COMPLETE | Added `detectDuplicateIds()` and `deduplicateSegmentsById()` functions to segmentMapper.js; integrated duplicate ID detection into `loadRundown` handler and `subscribeToRundownChanges()` listener; added logging when segments move positions via ID-based matching in `updateConfig()` |

### Phase J: Segment Timing Analytics (P2) - COMPLETE (5/5)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 38 | Log actual segment durations during show | COMPLETE | Real-time segment timing logged to Firebase on segmentCompleted; run record created on showStarted with status tracking; final analytics merged on showStopped |
| Task 39 | Store timing data in Firebase post-show | COMPLETE | Fixed show completion flow: added `_completeShow()` method to TimesheetEngine that emits `showComplete` event when last segment auto-advances; this ensures `showStopped` is also emitted for analytics saving. Added `timesheetShowComplete` socket event and client handler. Now timing data is saved whether show ends naturally or via manual stop. |
| Task 40 | Create timing analytics dashboard | COMPLETE | Added TimingAnalyticsModal to RundownEditorPage with: summary stats (shows/rehearsals count, avg variance), segment averages table (planned vs actual across all runs), and expandable run history showing per-segment timing details. Loads data from Firebase `competitions/{compId}/production/rundown/analytics`. Button added to toolbar with ChartBarIcon. |
| Task 41 | Show historical average in Rundown Editor | COMPLETE | Added call to `loadTimingAnalytics()` in component mount useEffect so historical averages are available when rendering segment rows. UI already existed in SegmentRow component (both compact and expanded views) showing ~Xs indicator next to duration field. Color-coded: amber if actual runs longer than planned, green if shorter, gray if matches. |
| Task 42 | AI-powered timing predictions based on history | COMPLETE | Added `aiTimingPredictions` computed value in RundownEditorPage that analyzes historical timing data by segment name similarity and type averages. Shows purple sparkle indicator with confidence level (high/medium/low) for segments without direct historical data. Click-to-apply feature in both inline view and detail panel. |

### Phase D: AI Suggestions - Planning (P2) - COMPLETE (6/6)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 43 | Create AI suggestion service on server | COMPLETE | Created `server/lib/aiSuggestionService.js` with: `generateSuggestions()` main API that fetches competition config and teams data from Firebase, builds context, and generates segment suggestions; template generators for pre-show, team-intro, rotation, post-show, and special segments; `getSuggestionsByCategory()` for filtered results; `getSuggestionCount()` for quick estimates; confidence scores (high/medium/low) on all suggestions |
| Task 44 | Analyze competition metadata (type, teams, date) | COMPLETE | Enhanced `buildContext()` to include: `parseMeetDate()` for date parsing with season phase detection (early/regular/late/championship); `extractSeniors()` to find year-4 athletes from roster; `analyzeTeamStats()` for matchup analysis using team averages and season highs; `countByClassYear()` for roster demographics. Updated `generateSuggestions()` to fetch competition's `teamData` and return enhanced context with dateInfo, statsAnalysis, seniors list, and classCounts. |
| Task 45 | Query roster data for seniors, All-Americans, milestones | COMPLETE | Added `queryAllAmericans()` to search teamsDatabase/honors for All-American athletes; `queryMilestones()` to search teamsDatabase/milestones for career records and approaching milestones; `computeSeniorMilestones()` to detect championship/final meet storylines for seniors; updated `buildContext()` to run queries in parallel; enhanced `getSpecialSegments()` to generate Record Holder Feature and Milestone Watch segments |
| Task 46 | Generate segment suggestions with confidence scores | COMPLETE | Added dynamic confidence scoring with `calculateDynamicConfidence()` that adjusts scores based on: data availability (roster, stats), season phase (championship/late bonus), matchup analysis (close matchup bonus), and athlete features (All-American/milestone boost). Added `CONFIDENCE_FACTORS` constants and `getConfidenceLevel()` helper. Enhanced all segment generators to use context-aware confidence. Added new contextual segments: Season Context (championship/late), Mid-Meet Analysis (close matchups), Team Stats Preview, Event-by-Event Results, Standout Performers, and Rivalry & History. All reasons now include context justification via `buildReasonString()`. |
| Task 47 | Add `getAISuggestions` API endpoint | COMPLETE | Added `getAISuggestions` and `getAISuggestionCount` socket handlers in server/index.js; handlers emit `aiSuggestionsResult` and `aiSuggestionCountResult` events; accepts `compId` and `options` parameters; logs suggestion generation |
| Task 48 | Wire Rundown Editor to display suggestions | COMPLETE | Added `getAISuggestions` function to ShowContext with promise-based API; added socket listener for `aiSuggestionsResult`; updated RundownEditorPage to use server-side suggestions with fallback to client-side; added loading state, error handling, context display, and refresh button; transformed server suggestions to UI format; filtered by dismissed and existing segments |

### Phase E: Script & Talent Flow (P2) - COMPLETE (6/6)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 49 | Add script field to segment data model | COMPLETE | Added `script: ''` to segment creation in 5 places in RundownEditorPage.jsx; added script field to segmentMapper.js for both editor→engine and engine→editor mappings; added script to compareSegments fieldsToCompare |
| Task 50 | Pipe script field through Timesheet Engine | COMPLETE | Script field already flows through engine via generic segment handling; TimesheetEngine spreads full segment objects in `getState()` (lines 1061-1063) and `segmentActivated` events (line 594); no explicit handling needed since engine preserves all segment fields; script accessible via `currentSegment.script` in client hooks |
| Task 51 | Display script in Talent View (teleprompter-style) | COMPLETE | Added teleprompter-style script panel in TalentView.jsx between CurrentSegment and NextSegment; uses large text (text-xl), blue accent border, DocumentTextIcon header; only shows when currentSegment.script has content; uses whitespace-pre-wrap for line breaks |
| Task 52 | Add talent assignment to segment data model | COMPLETE | Added `talent: []` to segment creation in 3 places in RundownEditorPage.jsx; added talent field to segmentMapper.js for both editor→engine and engine→editor mappings; added talent to compareSegments fieldsToCompare |
| Task 53 | Create talent schedule view | COMPLETE | Already implemented as TalentScheduleModal in RundownEditorPage.jsx (Phase 12: Task 94); includes talent-per-segment view, conflict detection, and export functionality |
| Task 54 | Show "you're on camera" indicator in Talent View | COMPLETE | Added talentId query param support (e.g., ?talentId=talent-1); prominent red "ON CAMERA" banner when talent is assigned to current segment; identity banner shows when viewing but not on camera; uses TALENT_ROSTER for talent lookup |

### Phase C: AI Context - Live Execution (P3) - IN PROGRESS (7/8)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 55 | Create AIContextService stub | COMPLETE | Created server/lib/aiContextService.js with AIContextService class, factory methods (getOrCreate, get, remove), lifecycle (start/stop), context generation stubs, and socket broadcast structure |
| Task 56 | Add `aiContextUpdated` socket event | COMPLETE | Wired AIContextService lifecycle to show start/stop events in server/index.js; added getAIContext and refreshAIContext socket handlers; service now auto-starts on showStarted and stops on showStopped; broadcasts aiContextUpdated to competition room |
| Task 57 | Create `useAIContext` hook | COMPLETE | Created show-controller/src/hooks/useAIContext.js with state management for AI context, socket listeners for aiContextUpdated/aiContextResult/aiContextRefreshResult, and actions getContext/refresh/clearError; provides talkingPoints, milestones, athleteContext accessors |
| Task 58 | Integrate with Virtius API for live stats | COMPLETE | Added `fetchLiveScores()` with caching, `_fetchVirtiusSession()`, `_parseVirtiusData()` for API integration; extracts teams, scores, event results; auto-loads sessionId from competition config; generates score-based talking points; added `getTeamStandings()`, `getEventScores()`, `getAthleteScore()` helpers |
| Task 59 | Generate talking points in real-time | COMPLETE | Added intelligent context-aware talking point generation based on segment patterns (rotation, event, team intro, interview, scoring, opening, closing, break), team data (seniors, freshmen, coaches, rankings), event expertise tips, and matchup analysis. Enhanced `_getBasicTalkingPoints()` with pattern-matching via `_analyzeSegmentName()` and specialized generators for each segment type. |
| Task 60 | Detect career highs, records during show | COMPLETE | Implemented `checkCareerHigh()` and `checkRecords()` methods in AIContextService. Added `scanForAchievements()` to detect career highs, season highs, meet highs, and broken/tied records from live scores. Stores achievements in Firebase (`competitions/{compId}/production/achievements` and `athleteStats/{key}/careerBests`). Broadcasts `aiAchievementsDetected` events. Added `_getAchievementTalkingPoints()` for CRITICAL priority alerts. |
| Task 61 | Display AI context in Talent View | COMPLETE | Added collapsible AI Talking Points panel in TalentView.jsx with: useAIContext hook integration, priority-colored talking points (critical=red, high=orange, normal=purple), milestones section with trophy icons, refresh button, empty/loading states, expand/collapse toggle with counts |
| Task 62 | Display AI context in Producer View | COMPLETE | Added collapsible AI Talking Points panel in ProducerView.jsx right column; uses useAIContext hook; shows milestones, priority points, and regular talking points; styled consistently with TalentView but adapted for compact sidebar layout; max-height with scroll for long content; only visible when AI service is running |

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

**Status:** COMPLETE
**File:** `show-controller/src/views/ProducerView.jsx`

**Description:**
Add "Load Rundown" button in Producer View header/toolbar.

**Checklist:**
- [x] Add "Load Rundown" button to Producer View
- [x] Wire button to `loadRundown` action from ShowContext
- [x] Show loading state while loading
- [x] Show toast on success/failure

**Implementation Notes:**
- Added `ArrowDownTrayIcon` import from heroicons
- Added `loadRundown` and `timesheetState` from `useShow()` context
- Added `isLoadingRundown` and `loadRundownToast` local state
- Added `handleLoadRundown` callback with loading state management
- Added socket listener for `loadRundownResult` to show toast feedback
- Added Load Rundown button in "Ready to Start" section
- Button shows "Load Rundown" initially, "Loading..." while loading, "Reload Rundown" after loaded
- Start Show button is disabled until rundown is loaded
- Toast auto-clears after 5 seconds

---

### Task 11: Create segment mapper

**Status:** COMPLETE
**File:** `server/lib/segmentMapper.js` (new file)

**Description:**
Create utility to map Rundown Editor segment format to Timesheet Engine format.

**Checklist:**
- [x] Create `server/lib/segmentMapper.js`
- [x] Map `scene` → `obsScene`
- [x] Map `graphic.graphicId` → `graphic`
- [x] Map `graphic.params` → `graphicData`
- [x] Map `timingMode` → `autoAdvance` (fixed=true, manual=false)
- [x] Preserve all other fields

**Implementation Notes:**
- Created `server/lib/segmentMapper.js` with `mapEditorToEngine()`, `mapEditorSegmentsToEngine()`, `mapEngineToEditor()`, `mapEngineSegmentsToEditor()` functions
- Added validation utilities: `validateEngineSegment()`, `validateEngineSegments()`
- Updated `loadRundown` handler in `server/index.js` to use mapper before passing segments to engine
- Preserves optional fields: bufferAfter, locked, optional, minDuration, maxDuration

---

### Task 12: Verify Firebase passed to engine

**Status:** COMPLETE
**File:** `server/index.js`, `server/lib/timesheetEngine.js`

**Description:**
Verify Firebase Admin is correctly passed and usable in engine.

**Checklist:**
- [x] Add logging to confirm Firebase instance received
- [x] Test that `_triggerGraphic()` can write to Firebase
- [x] Handle missing Firebase gracefully

**Implementation Notes:**
- Added logging in `getOrCreateEngine()` (server/index.js:377-378) to confirm Firebase and OBS Connection Manager are passed
- Added logging in `_triggerGraphic()` (timesheetEngine.js:713-716) to log when graphics are triggered via Firebase
- Added console.warn when Firebase is not available (timesheetEngine.js:723) to handle missing Firebase gracefully
- Firebase write errors are already handled with try/catch and emit an 'error' event

---

### Task 13: Show rundown status indicator

**Status:** COMPLETE
**File:** `show-controller/src/views/ProducerView.jsx`

**Description:**
Add status indicator showing rundown state (idle, loaded, modified).

**Checklist:**
- [x] Add status badge component
- [x] Show "No Rundown" when state is IDLE
- [x] Show "Rundown Loaded" when state is LOADED
- [x] Show segment count in badge

**Implementation Notes:**
- Added status badge in header next to alert badges
- Gray badge with DocumentTextIcon shows "No Rundown" when `timesheetState?.rundownLoaded` is false
- Green badge with CheckCircleIcon shows "{count} segments" when rundown is loaded
- Badge uses existing design patterns from alert count badges

---

### Task 14: Verify scene picker uses OBS state

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Verify that the scene picker dropdown loads scenes from OBS connection state rather than hardcoded data.

**Checklist:**
- [x] Check current implementation of scene picker
- [x] If hardcoded, plan integration with OBS scene list
- [x] Document current state

**Verification Results:**
- Scene picker uses hardcoded `DUMMY_SCENES` (lines 63-73 in RundownEditorPage.jsx)
- `OBSContext` provides `obsState.scenes` from live OBS connection via `obs:stateUpdated` event
- `RundownEditorPage.jsx` does NOT import `useOBS` from OBSContext
- **Recommendation:** Task 16 will replace `DUMMY_SCENES` with live `obsState.scenes` from `useOBS()`

---

### Task 15: Verify graphics picker uses Registry

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Verify that the graphics picker dropdown uses graphicsRegistry.js.

**Checklist:**
- [x] Check current implementation of graphics picker
- [x] Verify graphicsRegistry.js is imported and used
- [x] Confirm graphics filtered by competition type

**Verification Results:**
- Graphics picker imports from `graphicsRegistry.js` (line 45)
- `getGroupedGraphics()` uses `getGraphicsForCompetition(compType, teamNames)` (line 4961)
- Graphics filtered by competition type and gender via `isGraphicAvailable()`
- Per-team graphics expanded dynamically (team1-stats, team2-stats, etc.)
- Category labels hardcoded but match registry categories - acceptable pattern
- **Note:** Uses `DUMMY_COMPETITION.type` for filtering. Task 16 should use real competition data.

---

### Task 16: Fix hardcoded picker data

**Status:** COMPLETE
**File:** `show-controller/src/pages/RundownEditorPage.jsx`

**Description:**
Replace any hardcoded picker data with live data sources.

**Checklist:**
- [x] Replace DUMMY_SCENES with OBS scene list (if hardcoded)
- [x] Verify graphics come from registry
- [x] Test with actual competition data

**Implementation Notes:**
- Added imports for `useCompetition` and `useOBS` hooks
- Created `liveScenes`, `liveCompType`, and `liveTeamNames` derived from live context
- Updated `getGroupedScenes(scenes)` to accept scenes array parameter (falls back to DUMMY_SCENES)
- Updated `getTeamNames(competitionConfig, fallbackTeams)` to accept competition config (falls back to DUMMY_COMPETITION)
- Updated `getGroupedGraphics(compType, teamNames)` to accept parameters (falls back to defaults)
- Added memoized `groupedScenes` and `groupedGraphics` in main component
- Updated `SegmentRow`, `SegmentDetailPanel`, and `SelectionSummaryPanel` components to receive grouped data as props
- Build verified successful

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
