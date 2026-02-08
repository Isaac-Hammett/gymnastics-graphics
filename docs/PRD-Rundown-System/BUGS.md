# Rundown System - Bug Tracker

## Open Bug Summary (2026-02-08)

| Bug | Severity | Phase | Status | Fix Task | Description |
|-----|----------|-------|--------|----------|-------------|
| BUG-012 | High | B | FIXED | — | Talent View shows wrong competition name |
| BUG-013 | Critical | J | **Task 91 ✓, 92-93 pending** | [Tasks 91-93](#task-91) | Timing analytics broken — data structure mismatch + status filter |
| BUG-014 | High | G | **Task 97** | [Task 97](#task-97) | No sponsor assignment UI in segment detail panel |
| BUG-015 | High | E | **Tasks 94-96** | [Tasks 94-96](#task-94) | Talent roster hardcoded (5 fake people), not from Firebase |
| BUG-016 | Medium | F | **Task 99** | [Task 99](#task-99) | Audio cue in/out points accepted by UI but ignored by playback |
| BUG-017 | Medium | G | **Task 98** | [Task 98](#task-98) | Equipment list hardcoded, not configurable per competition |
| BUG-019 | Critical | A | FIXED | — | Resume button doesn't work after pause — isPaused missing from getState() |
| BUG-018 | Critical | A | FIXED | — | Producer View Pause/Stop/Reset buttons use legacy handlers, not timesheet engine |
| BUG-011 | Critical | A | FIXED | — | Start Show button hidden by stale isPlaying |

**See:** [PLAN-Rundown-System-Implementation.md](./PLAN-Rundown-System-Implementation.md#phase-x-bug-fixes-p0---not-started-010) for detailed fix tasks.

---

## BUG-019: Resume Button Doesn't Work After Pause — isPaused Missing from getState() (FIXED)

**Date Identified:** 2026-02-07
**Date Fixed:** 2026-02-07
**Severity:** Critical
**Status:** FIXED
**Phase:** A (Connect Editor to Engine)

### Symptoms

1. Producer starts show and clicks Pause — show pauses correctly
2. **BUG:** The Pause button does NOT change to Resume — it stays as "Pause"
3. Clicking Pause again does nothing — show remains paused with no way to resume
4. Same issue in Talent View — no Resume button appears

### Root Cause

The `TimesheetEngine.getState()` method did NOT include `isPaused` in its return object. It only included `state: 'paused'` (the engine state string).

The client code in `useTimesheet.js` was looking for:
```javascript
const isPaused = useMemo(() => {
  return timesheetState.isPaused || false;
}, [timesheetState.isPaused]);
```

Since `timesheetState.isPaused` was always `undefined`, the UI never showed the Resume button.

### Fix Applied

Added `isPaused` boolean field to `getState()` in `server/lib/timesheetEngine.js`:

```javascript
getState() {
  return {
    state: this._state,
    isRunning: this._isRunning,
    isPaused: this._state === ENGINE_STATE.PAUSED,  // <-- ADDED
    isRehearsalMode: this._isRehearsalMode,
    // ... rest of state
  };
}
```

### Files Changed

- `server/lib/timesheetEngine.js` — Added `isPaused` to `getState()` return value

### Deployment

- Server deployed to coordinator VM (`44.193.31.120`) and PM2 restarted
- Verified API response now includes `isPaused: false` field

---

## BUG-018: Producer View Pause/Stop/Reset Buttons Use Legacy Handlers (FIXED)

**Date Identified:** 2026-02-01
**Date Fixed:** 2026-02-01
**Severity:** Critical
**Status:** FIXED
**Phase:** A (Connect Editor to Engine)

### Symptoms

1. Producer loads rundown and starts show — segments advance correctly via NEXT button
2. **BUG:** Pause button does nothing — show keeps running, timer keeps counting
3. **BUG:** Stop button does nothing — show continues
4. **BUG:** Reset Show button does nothing — show continues
5. **BUG:** Lock Talent button has no visible effect
6. Only the NEXT button works

### Root Cause

The Producer View buttons were wired to **legacy** socket events that modify the old `showState` object but never interact with the timesheet engine:

| Button | Socket Event | Server Handler | Problem |
|--------|-------------|----------------|---------|
| Pause | `togglePause` | `showState.isPaused` toggle | Doesn't call `engine.pause()` |
| Stop | `stopTimesheetShow` | `engine.stop()` | Correctly wired but `broadcastState()` not reaching client |
| Reset Show | `resetShow` | Legacy `showState` reset | Doesn't call `engine.stop()` |
| Lock Talent | `lockTalent` | `showState.talentLocked` | Legacy broadcast, role check dependency |

Since the BUG-011 fix changed `showIsPaused = timesheetIsPaused` (line 109), the UI now only reflects timesheet engine state. But the Pause button still toggled legacy `showState.isPaused` which the UI no longer reads.

### Fix Applied

**Server** (`server/index.js`):
- Added `pauseTimesheetShow` socket handler → calls `engine.pause()`
- Added `resumeTimesheetShow` socket handler → calls `engine.resume()`

**Client** (`ShowContext.jsx`, `useTimesheet.js`):
- Added `pauseTimesheetShow()` and `resumeTimesheetShow()` functions
- Exposed `pause` and `resume` actions through useTimesheet hook

**ProducerView** (`ProducerView.jsx`):
- Pause button: `togglePause` → `showIsPaused ? timesheetResume : timesheetPause`
- Reset Show button: `resetShow` → `timesheetStop`

### Files Changed

- `server/index.js` — Added `pauseTimesheetShow` and `resumeTimesheetShow` socket handlers
- `show-controller/src/context/ShowContext.jsx` — Added `pauseTimesheetShow`, `resumeTimesheetShow` functions and exports
- `show-controller/src/hooks/useTimesheet.js` — Added `pause`, `resume` actions
- `show-controller/src/views/ProducerView.jsx` — Rewired Pause and Reset Show buttons to timesheet engine

### Deployment

- Server deployed to coordinator VM (`44.193.31.120`) and PM2 restarted
- Frontend built and deployed to `commentarygraphic.com` (`3.87.107.201`)

---

## BUG-017: Equipment List Hardcoded, Not Configurable (OPEN)

**Date Identified:** 2026-02-01
**Severity:** Medium
**Status:** OPEN
**Phase:** G (Production Tracking)

### Symptoms

Equipment assignment UI shows 9 fixed items (Camera 1-4, Lav 1-2, Handheld, Jib Arm, Teleprompter). Cannot add, remove, or rename equipment for different venues or competitions.

### Root Cause

`DUMMY_EQUIPMENT` constant hardcoded in `RundownEditorPage.jsx` (lines 91-103). Not stored in Firebase. Not configurable.

### Impact

Equipment assignment works for the 9 predefined items, but producers at different venues with different gear cannot customize the list.

### Proposed Fix

Move equipment definitions to Firebase at `competitions/{compId}/production/equipment` or a shared `productionConfig/equipment` path. Add a configuration UI or import/export mechanism.

### Files Affected

- `show-controller/src/pages/RundownEditorPage.jsx` — Replace `DUMMY_EQUIPMENT` with Firebase-fetched data

---

## BUG-016: Audio Cue In/Out Points Ignored by Playback (OPEN)

**Date Identified:** 2026-02-01
**Severity:** Medium
**Status:** OPEN
**Phase:** F (Audio Cue Integration)

### Symptoms

1. Producer sets `inPoint: "0:30"` and `outPoint: "1:45"` on a segment's audio cue
2. Values are stored in Firebase correctly
3. During show, `_playAudioCue()` plays audio from the beginning of the file
4. In/out points are completely ignored

### Root Cause

`_playAudioCue()` in `timesheetEngine.js` (lines 984-1064) sends `TriggerMediaInputAction` with `OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART` which always starts from the beginning. No seeking or stop-at-outpoint logic exists.

### Impact

The in/out point fields in the UI are misleading — they accept values that have no effect.

### Proposed Fix

Either implement OBS media seeking via `SetMediaInputCursorOffset` and a timer-based stop at `outPoint`, or remove the in/out point fields from the UI to avoid confusion.

### Files Affected

- `server/lib/timesheetEngine.js` — `_playAudioCue()` method
- `show-controller/src/pages/RundownEditorPage.jsx` — in/out point UI (optional: remove or disable)

---

## BUG-015: Talent Roster Hardcoded with Dummy Data (OPEN)

**Date Identified:** 2026-02-01
**Severity:** High
**Status:** OPEN
**Phase:** E (Script & Talent Flow)

### Symptoms

1. Talent assignment UI shows 5 fake people: "John Smith", "Sarah Johnson", "Mike Davis", "Emily Chen", "Alex Rodriguez"
2. These names appear in RundownEditorPage and TalentView
3. Cannot add real commentators or remove dummy ones
4. Talent identity lost on page refresh (query param only, no session persistence)

### Root Cause

Two separate hardcoded constants:
- `DUMMY_TALENT` in `RundownEditorPage.jsx` (line 83) — 5 entries
- `TALENT_ROSTER` in `TalentView.jsx` (line 14) — same 5 entries, duplicated

Neither is fetched from Firebase. The `talentId` query param (`?talentId=talent-1`) is the only way to identify a commentator, and it's not persisted in localStorage or sessionStorage.

### Impact

- Cannot use with real production talent without code changes
- Two copies of the roster can drift out of sync
- Commentator loses identity on page refresh

### Proposed Fix

1. Move talent roster to Firebase at `competitions/{compId}/production/talent`
2. Fetch dynamically in both RundownEditorPage and TalentView
3. Add `localStorage` persistence for `talentId` so page refresh doesn't lose identity
4. Add talent management UI (or at minimum, a competition config field)

### Files Affected

- `show-controller/src/pages/RundownEditorPage.jsx` — Replace `DUMMY_TALENT`
- `show-controller/src/views/TalentView.jsx` — Replace `TALENT_ROSTER`, add localStorage

---

## BUG-014: No Sponsor Assignment UI in Segment Detail Panel (OPEN)

**Date Identified:** 2026-02-01
**Severity:** High
**Status:** OPEN
**Phase:** G (Production Tracking)

### Symptoms

1. The segment detail panel has sections for Script, Talent, Audio Cue, and Equipment
2. No section exists for Sponsor assignment
3. The SponsorFulfillmentModal report exists (270 lines of code) but always shows empty results
4. The only sponsor data in the system comes from hardcoded test segments in `DUMMY_SEGMENTS`

### Root Cause

Task 70 added the sponsor data model (`{ name, logo, tier }`) but no UI was built to assign sponsors to segments in the SegmentDetailPanel. The form jumps from Equipment Assignment directly to Save/Cancel buttons.

### Impact

- Sponsor Fulfillment Report is useless (no sponsors to report on)
- The data model exists but is inaccessible to producers
- 270 lines of report code have no practical function

### Proposed Fix

1. Add a Sponsor assignment section to SegmentDetailPanel (dropdown or searchable select)
2. Create a sponsor configuration panel where producers define sponsors for a competition
3. Store sponsor list in Firebase at `competitions/{compId}/production/sponsors`

### Files Affected

- `show-controller/src/pages/RundownEditorPage.jsx` — Add sponsor section to SegmentDetailPanel (after Equipment section)

---

## BUG-013: Timing Analytics Broken — Data Structure Mismatch and Status Filter (OPEN)

**Date Identified:** 2026-02-01
**Severity:** Critical
**Status:** OPEN
**Phase:** J (Segment Timing Analytics)

### Symptoms

1. TimingAnalyticsModal always shows "No Analytics Data"
2. Historical average indicators on segment rows are blank
3. AI timing predictions generate nothing
4. Timing data IS being written to Firebase (verified: 3+ competitions have run records with segment data)

### Root Cause

**Two separate bugs:**

**Bug A: Data structure mismatch**

Server writes timing data as an object with Firebase push keys:
```
competitions/{compId}/production/rundown/analytics/{runId}/segmentTimings/{pushKey}
```

Frontend expects an array called `segments`:
```javascript
// RundownEditorPage.jsx lines 645, 684, 10367
run.segments.forEach(seg => { ... })  // run.segments is undefined!
```

The loaded data has `run.segmentTimings` (object), not `run.segments` (array). Every `.forEach()` silently does nothing.

**Bug B: Status filter excludes all data**

`loadTimingAnalytics()` at line 2067:
```javascript
.filter(run => run.status === 'completed')
```

All runs in Firebase have `status: "running"` because the server's `showStopped` handler either doesn't update the status field, or the show is stopped before the update completes. This filter excludes every run.

### Impact

The entire Phase J feature chain is broken:
- Task 40 (TimingAnalyticsModal) — shows empty
- Task 41 (Historical averages on segment rows) — shows nothing
- Task 42 (AI timing predictions) — no data to analyze

### Proposed Fix

**Fix A:** In `loadTimingAnalytics()`, transform `segmentTimings` object to array:
```javascript
const runs = Object.entries(data).map(([runId, runData]) => ({
  runId,
  ...runData,
  segments: runData.segmentTimings
    ? Object.values(runData.segmentTimings)
    : runData.segments || []
}));
```

**Fix B:** Either:
- Change filter to `.filter(run => run.segmentTimings || run.segments)` (accept any run with timing data)
- Or fix the server to set `status: "completed"` on show stop at `server/index.js` line 558

### Files Affected

- `show-controller/src/pages/RundownEditorPage.jsx` — `loadTimingAnalytics()` (line 2057-2079), `segmentHistoricalAverages` (line 645), `aiTimingPredictions` (line 684), `TimingAnalyticsModal` (line 10367)
- `server/index.js` — `showStopped` handler (line 500-566) — status update

---

## BUG-012: Talent View Shows Legacy showName Instead of Competition Name (FIXED)

**Date Identified:** 2026-01-31
**Date Fixed:** 2026-02-08
**Severity:** High
**Status:** FIXED

### Symptoms

1. Producer opens Talent View for competition "West Chester vs Cortland"
2. **BUG:** Header shows "CGA All Stars 2025" instead of "West Chester vs Cortland"
3. The competition banner bar at the top correctly shows "West Chester vs Cortland @ Sturzebecker Hall" (from CompetitionContext), but the view's own header is wrong

### Root Cause

`TalentView.jsx` line 80 displays:
```javascript
{showConfig?.showName || 'Show Controller'}
```

`showConfig.showName` comes from the **legacy global config file** `server/config/show-config.json`, which is hardcoded to `"CGA All Stars 2025"`. The server sends this to ALL clients at `server/index.js` line 1151 regardless of which competition they're in.

This is a global, non-competition-scoped value — every competition's Talent View shows the same stale name from the last show config import.

### Proposed Fix

Replace the legacy `showConfig.showName` with the competition-specific `eventName` from `competitionConfig`:

```javascript
// TalentView.jsx - use competition context instead of legacy showConfig
const { competitionConfig } = useCompetition();

// In the header:
{competitionConfig?.eventName || showConfig?.showName || 'Show Controller'}
```

The `useCompetition()` hook is already available in the component tree (CompetitionLayout wraps all `/:compId/*` routes). The Talent View just needs to import and use it.

### Fix Applied

1. Imported `useCompetition` from `'../context/CompetitionContext'`
2. Called `useCompetition()` hook to get `competitionConfig`
3. Updated header to use `competitionConfig?.eventName || showConfig?.showName || 'Show Controller'`

### Files Changed

- `show-controller/src/views/TalentView.jsx` - Added import, hook call, updated header

### Related Bugs

- **BUG-010**: Same class of issue — Rundown Editor uses hardcoded `DUMMY_COMPETITION` instead of real competition config
- Both bugs stem from views not adopting the competition-scoped config pattern

### Files Affected

- `show-controller/src/views/TalentView.jsx` - Line 80, replace `showConfig.showName` with `competitionConfig.eventName`

---

## BUG-011: Load Rundown Button Hidden / Start Show Inaccessible Due to Stale Legacy isPlaying (FIXED)

**Date Identified:** 2026-01-31
**Date Fixed:** 2026-02-01
**Severity:** Critical
**Status:** FIXED

### Symptoms

1. Producer navigates to Producer View for a competition
2. No rundown is loaded (header shows "No Rundown")
3. **BUG:** The "Load Rundown" button is NOT visible — the UI shows the active-show controls (Previous, NEXT, Pause, Stop) instead
4. Bottom of page says "No show loaded" but there is no way to load one
5. Producer is completely blocked from loading a rundown
6. **After first partial fix:** Rundown loads successfully (34 segments visible in SHOW PROGRESS), but the "Start Show" button is still hidden — the UI jumps straight to active-show controls
7. Clicking NEXT produces "Cannot advance segment" error because the timesheet engine was never started (`engine.advance()` returns false when `!this._isRunning` at `timesheetEngine.js` line 1350)

### Root Cause

The Producer View conditionally renders either a "Ready to Start" panel (with Load Rundown + Start Show buttons) or the active-show controls, based on:

```javascript
// ProducerView.jsx line 108
const showIsActive = timesheetIsRunning || isPlaying;
```

The legacy `isPlaying` flag (from `ShowContext.state`) can be `true` from a previous session that was never properly stopped. When this happens, `showIsActive` is `true` even though no show is actually running. The "Ready to Start" panel (line 622) — which contains BOTH the Load Rundown button AND the Start Show button — becomes completely inaccessible.

### First Fix (Insufficient)

The first attempt guarded `isPlaying` with `rundownLoaded`:
```javascript
const showIsActive = timesheetIsRunning || (isPlaying && timesheetState?.rundownLoaded);
```

This allowed the rundown to load (when `rundownLoaded` was false), but once the rundown loaded, `isPlaying && rundownLoaded` became `true` again — hiding the Start Show button. The user could see segments in SHOW PROGRESS but had no way to start the show.

### Required Fix

Remove `isPlaying` from `showIsActive` entirely. Only `timesheetIsRunning` should control whether the active-show UI is displayed:

```javascript
const showIsActive = timesheetIsRunning;
const showIsPaused = timesheetIsPaused;
```

This is safe because:
- The timesheet engine is the only show execution system (legacy show controls are deprecated)
- `timesheetIsRunning` is true only after `engine.start()` is called
- This completely eliminates the stale `isPlaying` problem regardless of rundown load state

### Files Changed (First Fix)

- `show-controller/src/views/ProducerView.jsx` (line 108)
- `show-controller/src/context/ShowContext.jsx` (timesheetShowStopped handler)

### Files To Change (Complete Fix)

- `show-controller/src/views/ProducerView.jsx` (line 108-109: change to `timesheetIsRunning` / `timesheetIsPaused` only)

---

## BUG-010: Rundown Editor Uses Hardcoded DUMMY_COMPETITION Instead of Real Competition Config (FIXED)

**Date Identified:** 2026-01-31
**Date Fixed:** 2026-01-31
**Severity:** High
**Status:** FIXED

### Symptoms

1. Producer opens Rundown Editor for competition "West Chester vs Cortland" (a `womens-dual` meet)
2. **BUG:** Header shows "10a21t4b - Women's Quad Meet" instead of "10a21t4b - West Chester vs Cortland"
3. Competition type is treated as `womens-quad` instead of `womens-dual`
4. Team name references in templates, AI suggestions, and exports use dummy team names instead of real ones
5. CSV/JSON exports label the competition as "Women's Quad Meet"

### Root Cause

`RundownEditorPage.jsx` defines a hardcoded dummy object at line 56-66:

```javascript
const DUMMY_COMPETITION = {
  id: 'pac12-2025',
  name: "Women's Quad Meet",
  type: 'womens-quad',
  teams: {
    1: { name: 'Navy', tricode: 'NVY' },
    2: { name: 'Springfield', tricode: 'SPR' },
    3: { name: 'Greenville', tricode: 'GRN' },
    4: { name: 'Westmont', tricode: 'WMT' },
  }
};
```

This object is referenced **~20 times** throughout the file for:
- Header subtitle (line 4611)
- AI segment analysis (lines 838-847)
- Template compatibility checks (lines 3507-3508)
- CSV/JSON export metadata (lines 2986, 3006-3008, 3036)
- Print view (lines 3168, 3331)
- Graphic picker team names (lines 5870, 6888-6889)
- Template import/export (lines 3449, 3456, 3539)
- New segment creation (line 4036)

The actual competition config IS loaded via `useCompetition()` (line 487) which reads from `competitions/{compId}/config` in Firebase. However, it is **never used** — all references go to `DUMMY_COMPETITION` instead.

### Impact

- **Incorrect labeling**: All competitions appear as "Women's Quad Meet" regardless of actual type
- **Wrong template matching**: Templates filtered by `womens-quad` compatibility won't match `womens-dual` meets
- **Wrong team references**: Graphic pickers show dummy team names (Navy, Springfield, etc.) instead of actual teams (West Chester, Cortland)
- **Bad exports**: CSV/JSON exports have wrong competition metadata
- **AI confusion**: AI suggestion service receives wrong competition context

### Proposed Fix

Replace all `DUMMY_COMPETITION` references with a derived object from `competitionConfig`:

```javascript
const competition = useMemo(() => {
  if (!competitionConfig) return DUMMY_COMPETITION; // fallback during loading
  return {
    id: compId,
    name: competitionConfig.eventName || 'Unknown Competition',
    type: competitionConfig.compType || 'womens-dual',
    teams: buildTeamsFromConfig(competitionConfig), // extract team1-6 fields
  };
}, [compId, competitionConfig]);
```

Then replace all `DUMMY_COMPETITION` references with `competition`.

### Fix Applied

Added a `competition` memo inside `RundownEditorPage` that derives the competition object from `competitionConfig` (loaded via `useCompetition()` from Firebase at `competitions/{compId}/config`). Falls back to `DUMMY_COMPETITION` while config is loading.

Replaced 18 `DUMMY_COMPETITION` references inside the component with `competition`:
- Header subtitle display
- AI segment analysis context
- CSV/JSON export metadata and filenames
- Print view title and header
- Template save/load/compatibility checks
- Segment creation from templates
- Team name resolution for graphic pickers

Kept `DUMMY_COMPETITION` const as fallback default. Two standalone helper functions outside the component (`getGroupedGraphics`, `SegmentDetailPanel`) retain `DUMMY_COMPETITION` as safety fallback since they already receive correct values via parameters.

### Files Affected

- `show-controller/src/pages/RundownEditorPage.jsx` - Added `competition` memo, replaced 18 references

---

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
