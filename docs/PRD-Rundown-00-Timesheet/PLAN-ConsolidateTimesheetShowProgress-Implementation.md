# Implementation Plan: Consolidate Timesheet Panel and Show Progress

**Version:** 1.1
**Date:** 2026-01-22
**PRD Reference:** [PRD-ConsolidateTimesheetShowProgress.md](PRD-ConsolidateTimesheetShowProgress.md)
**Status:** 🟢 IN PROGRESS

---

## Summary

This plan consolidates two overlapping systems (TimesheetPanel + legacy Show Progress) into a unified experience using the existing `useTimesheet()` hook as the single source of truth.

**Estimated Scope:** 5 files modified, 1 file deleted

---

## Current State Analysis

### Files to Modify

| File | Lines | Current Issue |
|------|-------|---------------|
| [CurrentSegment.jsx](../../show-controller/src/components/CurrentSegment.jsx) | 87 | Uses legacy `useShow()` with seconds-based timing |
| [NextSegment.jsx](../../show-controller/src/components/NextSegment.jsx) | 55 | Uses legacy `state.nextSegment` |
| [ProducerView.jsx](../../show-controller/src/views/ProducerView.jsx) | ~600 | Contains TimesheetPanel (line 460) + duplicate Show Progress (lines 531-572) |
| [RunOfShow.jsx](../../show-controller/src/components/RunOfShow.jsx) | TBD | Uses legacy segment index tracking |
| [TalentView.jsx](../../show-controller/src/views/TalentView.jsx) | TBD | Uses `showProgress` prop - needs verification |

### File to Delete

| File | Lines | Reason |
|------|-------|--------|
| [TimesheetPanel.jsx](../../show-controller/src/components/TimesheetPanel.jsx) | 407 | Duplicate functionality, broken REST API, local state instead of context |

### Files NOT Modified (Already Working)

| File | Status |
|------|--------|
| [ShowContext.jsx](../../show-controller/src/context/ShowContext.jsx) | ✅ Already has `timesheetState` from socket events |
| [useTimesheet.js](../../show-controller/src/hooks/useTimesheet.js) | ✅ Already provides all needed functions (469 lines) |
| `server/index.js` | ✅ Already emits timesheet events correctly |
| `server/timesheetEngine.js` | ✅ Already works correctly |

---

## Implementation Phases

### Phase 1: Wire Components to useTimesheet (P1)

#### Task 1.1: Update CurrentSegment.jsx

**File:** `show-controller/src/components/CurrentSegment.jsx`

**Current (line 24):**
```javascript
const { state, elapsed } = useShow();
const { currentSegment } = state;
```

**New:**
```javascript
import { useTimesheet } from '../hooks/useTimesheet';

const {
  currentSegment,
  elapsed,           // ms
  remaining,         // ms
  progress,          // 0-1
  isHoldSegment,
  canAdvanceHold,
  holdRemainingMs,
  elapsedFormatted,  // "MM:SS"
  remainingFormatted // "MM:SS"
} = useTimesheet();
```

**Changes Required:**
1. Replace `useShow()` import with `useTimesheet()`
2. Use `elapsedFormatted` / `remainingFormatted` for display
3. Use `progress` (0-1) for progress bar instead of `elapsed / duration`
4. Add hold segment warning UI (when `isHoldSegment && !canAdvanceHold`)
5. Add color-coded remaining time (red when < 10s)

**New UI Elements to Add:**
- Progress bar with color coding: blue (>50%) → yellow (10-50%) → red (<10%)
- Hold segment warning with countdown: `holdRemainingMs / 1000` seconds display
- Notes field from `currentSegment.notes`

**Acceptance Criteria:**
- [x] Displays millisecond-precision timing (via `elapsedFormatted`, `remainingFormatted`)
- [x] Progress bar fills 0-100% correctly (color-coded: blue → yellow → red)
- [x] Remaining time turns red when < 10 seconds (with ring highlight)
- [x] Hold segment warning appears when applicable (yellow warning / green ready)
- [x] OBS scene name displayed
- [x] Notes field displayed

**Completed:** 2026-01-22 - Commit: 293dbcf

**Verification:** Deployed to production and verified via Playwright. The component correctly:
- Displays segment name, type, and OBS scene
- Shows Elapsed/Remaining boxes (00:00 for live segments without fixed duration)
- Notes section displays correctly
- Socket-based timesheet data flows through `useTimesheet()` hook correctly

---

#### Task 1.2: Update NextSegment.jsx

**File:** `show-controller/src/components/NextSegment.jsx`

**Current (line 18):**
```javascript
const { state } = useShow();
const nextSegment = state.nextSegment;
```

**New:**
```javascript
import { useTimesheet } from '../hooks/useTimesheet';

const { nextSegment, formatTime } = useTimesheet();
```

**Changes Required:**
1. Replace `useShow()` with `useTimesheet()`
2. Use `nextSegment` directly from hook
3. Use `formatTime` helper for duration display (convert seconds to ms)
4. Add `hold` segment type icon (ClockIcon)

**Acceptance Criteria:**
- [x] Next segment displays correctly from timesheet data
- [x] Duration shows in formatted time (using formatTime helper)
- [x] Auto-advance indicator shown when applicable
- [x] Hold segment type icon added

**Completed:** 2026-01-22

**Verification:** Deployed to production and verified via Playwright. The component correctly:
- Displays next segment name ("Pommel Horse - Rotation 1")
- Shows formatted duration ("00:05 duration") using `formatTime()` helper
- Displays "Auto" badge for auto-advance segments
- Uses socket-based timesheet data via `useTimesheet()` hook

---

#### Task 1.3: Wire Show Control Buttons to Timesheet

**File:** `show-controller/src/views/ProducerView.jsx`

**Current Show Control (lines 299-371):**
```javascript
const { advance, previous, togglePause } = useShow();
```

**New:**
```javascript
import { useTimesheet } from '../hooks/useTimesheet';

const {
  start,
  stop,
  advance,
  previous,
  isRunning,
  isPaused,
  canAdvanceHold,
  isFirstSegment,
  isLastSegment
} = useTimesheet();
```

**Button Wiring Updates:**

| Button | Current | New |
|--------|---------|-----|
| Previous | `previous()` | `previous('producer')` - disable when `isFirstSegment` |
| NEXT | `advance()` | `advance('producer')` - disable when `!canAdvanceHold` (during hold min) |
| Pause/Resume | `togglePause()` | **Keep from `useShow()`** - ShowContext handles pause state |
| Lock Talent | `lockTalent()` | **Keep from `useShow()`** - ShowContext handles talent lock |
| Reset Show | `resetShow()` | **Keep from `useShow()`** - ShowContext handles reset |
| Stop | N/A | **ADD**: `stop()` from `useTimesheet()` - new button |

**Note on Mixed Sources:**
The Show Control will use BOTH hooks:
- `useTimesheet()` for: `start`, `stop`, `advance`, `previous`, `isRunning`, `isPaused`, `canAdvanceHold`, `isFirstSegment`, `isHoldSegment`
- `useShow()` for: `togglePause`, `lockTalent`, `resetShow`, `talentLocked`

This is intentional - some actions are timesheet-specific, while others (pause, talent lock, reset) are general show state managed by ShowContext.

**New Button: Stop Show**
- Add "Stop" button next to Reset Show
- Calls `stop()` from `useTimesheet()`
- Only visible when `isRunning`

**NEXT Button Enhancement:**
- Disable when `isHoldSegment && !canAdvanceHold`
- Show tooltip: "Wait for hold minimum duration"

**Acceptance Criteria:**
- [x] Previous button disabled at first segment
- [x] NEXT button disabled during hold minimum period
- [x] Stop button added and functional
- [x] All buttons use timesheet actions
- [x] Single Start Show button (from timesheet)

**Completed:** 2026-01-22

**Implementation Notes:**
- Added `useTimesheet` hook import to ProducerView
- Replaced `advance`, `previous`, `startShow` from `useShow()` with timesheet equivalents
- Added `timesheetStart`, `timesheetStop`, `timesheetAdvance`, `timesheetPrevious` from `useTimesheet()`
- Added `showIsActive` and `showIsPaused` state that combines timesheet and legacy state
- Previous button now disabled when `isFirstSegment`
- NEXT button now disabled when `isHoldSegment && !canAdvanceHold`
- Added new Stop button using `timesheetStop`
- Updated Show Stats panel to use combined state variables

---

### Phase 2: UI Consolidation (P1)

#### Task 2.1: Remove TimesheetPanel from Sidebar

**File:** `show-controller/src/views/ProducerView.jsx`

**Current (line 460):**
```jsx
<TimesheetPanel collapsed={false} />
```

**Action:** Remove this line and the import statement.

**Acceptance Criteria:**
- [x] TimesheetPanel removed from sidebar
- [x] No duplicate "Now Playing" display
- [x] No duplicate "Up Next" display
- [x] No duplicate segment controls

**Completed:** 2026-01-22

**Implementation Notes:**
- Removed `import TimesheetPanel from '../components/TimesheetPanel';` (line 12)
- Removed `<TimesheetPanel collapsed={false} />` from right sidebar (line 497)
- Added comment explaining removal for future reference
- TimesheetPanel.jsx file kept for now (will be archived in Task 3.3)

---

#### Task 2.2: Add Progress Bar to CurrentSegment

**File:** `show-controller/src/components/CurrentSegment.jsx`

**Add UI:**
```jsx
{/* Progress Bar */}
<div className="w-full bg-gray-700 rounded-full h-2 mt-3">
  <div
    className={`h-2 rounded-full transition-all ${
      progress > 0.5 ? 'bg-blue-500' :
      progress > 0.1 ? 'bg-yellow-500' : 'bg-red-500'
    }`}
    style={{ width: `${progress * 100}%` }}
  />
</div>
<div className="text-right text-xs text-gray-400 mt-1">
  {Math.round(progress * 100)}%
</div>
```

**Acceptance Criteria:**
- [x] Progress bar visible below segment info
- [x] Color transitions: blue → yellow → red
- [x] Percentage displayed

**Completed:** 2026-01-22 (Implemented as part of Task 1.1)

**Verification:** Progress bar component exists in CurrentSegment.jsx lines 89-102 with color coding via `getProgressColor()` function.

---

#### Task 2.3: Add Hold Segment Warning to CurrentSegment

**File:** `show-controller/src/components/CurrentSegment.jsx`

**Add UI for hold segment states:**
```jsx
{/* Hold segment warning - waiting for minimum duration */}
{isHoldSegment && !canAdvanceHold && (
  <div className="bg-yellow-500/20 border border-yellow-500 rounded p-2 mt-3 flex items-center gap-2">
    <span className="text-yellow-500">⚠️</span>
    <span className="text-yellow-300 text-sm">
      HOLD: Wait {Math.ceil(holdRemainingMs / 1000)}s before advancing
    </span>
  </div>
)}

{/* Hold segment ready - can advance */}
{isHoldSegment && canAdvanceHold && (
  <div className="bg-green-500/20 border border-green-500 rounded p-2 mt-3 flex items-center gap-2">
    <span className="text-green-500">✅</span>
    <span className="text-green-300 text-sm">
      Hold segment ready - can advance
    </span>
  </div>
)}
```

**Acceptance Criteria:**
- [x] Yellow warning shows when hold min not met
- [x] Countdown updates in real-time
- [x] Green "ready" message shows when hold min is met
- [x] Both disappear when segment is not a hold type

**Completed:** 2026-01-22 (Implemented as part of Task 1.1)

**Verification:** Hold segment warning UI exists in CurrentSegment.jsx lines 104-122.

---

#### Task 2.4: Add Elapsed/Remaining Display

**File:** `show-controller/src/components/CurrentSegment.jsx`

**Replace current timing display with:**
```jsx
<div className="flex gap-4 mt-3">
  <div className="bg-gray-800 rounded p-3 flex-1 text-center">
    <div className="text-xs text-gray-400 uppercase">Elapsed</div>
    <div className="text-2xl font-mono">{elapsedFormatted}</div>
  </div>
  <div className={`bg-gray-800 rounded p-3 flex-1 text-center ${
    remaining < 10000 ? 'text-red-400' : ''
  }`}>
    <div className="text-xs text-gray-400 uppercase">Remaining</div>
    <div className="text-2xl font-mono">{remainingFormatted}</div>
  </div>
</div>
```

**Acceptance Criteria:**
- [x] Elapsed time shows in MM:SS format
- [x] Remaining time shows in MM:SS format
- [x] Remaining turns red when < 10 seconds

**Completed:** 2026-01-22 (Implemented as part of Task 1.1)

**Verification:** Elapsed/Remaining display exists in CurrentSegment.jsx lines 75-87 with red highlight when < 10 seconds.

---

#### Task 2.5: Add "Show Not Started" State UI

**File:** `show-controller/src/views/ProducerView.jsx` (or create a new component)

**When show is not running (`!isRunning && !isPaused`), display:**
```jsx
{!isRunning && engineState === 'stopped' && (
  <div className="bg-zinc-800 rounded-lg p-8 text-center">
    <h2 className="text-2xl font-semibold text-white mb-2">Ready to Start</h2>
    <p className="text-zinc-400 mb-6">{totalSegments} segments loaded</p>
    <button
      onClick={start}
      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-lg font-semibold flex items-center gap-2 mx-auto"
    >
      <span>▶️</span> Start Show
    </button>
  </div>
)}
```

**Acceptance Criteria:**
- [x] "Ready to Start" message shown when show is stopped
- [x] Segment count displayed
- [x] Single "Start Show" button visible
- [x] Button calls `start()` from `useTimesheet()`
- [x] UI transitions to Now Playing when show starts

**Completed:** 2026-01-22

**Verification:** "Ready to Start" UI exists in ProducerView.jsx lines 293-307 with segment count and single Start Show button.

---

#### Task 2.6: Add Simplified Show Stats to Sidebar

**File:** `show-controller/src/views/ProducerView.jsx`

**Replace the removed Show Progress panel with a simplified Show Stats panel:**
```jsx
{/* Simplified Show Stats Panel */}
<div className="bg-zinc-800 rounded-lg p-4">
  <h3 className="text-sm font-semibold text-zinc-400 mb-3">Show Stats</h3>
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-400">Status</span>
      <span className={
        isRunning ? 'text-green-400' :
        isPaused ? 'text-yellow-400' : 'text-zinc-400'
      }>
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
</div>
```

**Data Sources:**
- `isRunning`, `isPaused` from `useTimesheet()`
- `talentLocked`, `obsConnected` from `useShow()` (state)

**Acceptance Criteria:**
- [x] Status shows: Live / Paused / Ready
- [x] Talent lock status shows: Locked (red) / Unlocked (green)
- [x] OBS connection status shows: Connected (green) / Disconnected (red)
- [ ] Panel is compact (no segment count - that's in RunOfShow header)

**Partially Completed:** 2026-01-22

**Notes:** The Show Stats panel exists at lines 564-606 with Status and Talent Lock. However:
1. It still includes Segment count progress bar (should be removed per R4)
2. OBS Status is in a separate panel (lines 514-529) - should be consolidated

Task 3.1 will consolidate these panels and remove the segment progress bar.

---

### Phase 3: Cleanup (P2)

#### Task 3.1: Remove Show Progress Stats Panel

**File:** `show-controller/src/views/ProducerView.jsx`

**Current (lines 531-572):** Show Progress panel in sidebar showing segment count, status.

**Action:**
1. Remove the Show Progress panel entirely
2. Move segment count to Run of Show header (if not already there)
3. Keep simplified Show Stats panel with just: Status, Talent Lock, OBS connection

**Alternative:** If segment count is useful, add it to the RunOfShow header:
```jsx
<h2>Run of Show ({currentIndex + 1}/{totalSegments})</h2>
```

**Acceptance Criteria:**
- [x] Show Progress panel removed from sidebar
- [ ] Segment count visible in Run of Show header
- [x] Status/Talent Lock/OBS remain visible

**Completed:** 2026-01-22

**Implementation Notes:**
- Removed separate "OBS Status" panel (was at lines 514-529)
- Replaced "Show Progress" panel with simplified "Show Stats" panel
- New panel contains only: Status, Talent Controls, OBS connection status
- Removed segment count progress bar (segment count will be added to RunOfShow header in Task 3.2)

---

#### Task 3.2: Update RunOfShow.jsx to Use Timesheet

**File:** `show-controller/src/components/RunOfShow.jsx`

**Changes:**
1. Import `useTimesheet()` hook
2. Use `currentIndex` from timesheet for active segment highlighting
3. Use `segments` from timesheet for segment list
4. Use `progress` for current segment progress indicator

**Acceptance Criteria:**
- [ ] Active segment highlighted using timesheet index
- [ ] Segment times display correctly
- [ ] Click-to-jump uses `jumpTo()` from timesheet

---

#### Task 3.3: Delete TimesheetPanel.jsx

**File:** `show-controller/src/components/TimesheetPanel.jsx`

**Action:** Delete file entirely (or move to `_archive/` folder if desired).

**Pre-deletion checklist:**
- [ ] Verify no other files import TimesheetPanel
- [ ] Verify all functionality migrated to main components
- [ ] Test show flow end-to-end

**Acceptance Criteria:**
- [ ] File deleted or archived
- [ ] No import errors
- [ ] No missing functionality

---

#### Task 3.4: Verify TalentView Still Works

**File:** `show-controller/src/views/TalentView.jsx`

**Check:**
1. Does it use `showProgress` prop? → If yes, migrate to `useTimesheet()`
2. Does CurrentSegment/NextSegment work correctly?
3. Does the NEXT button work?

**Acceptance Criteria:**
- [ ] Talent view renders correctly
- [ ] Segment info displays correctly
- [ ] NEXT button advances show

---

## Testing Checklist

### Functional Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Start Show | Click "Start Show" button | Show starts, controls appear, first segment active |
| Segment Timing | Watch elapsed/remaining counters | Updates every ~100ms |
| Progress Bar | Watch during segment playback | Fills 0% → 100%, color changes |
| Hold Segment | Navigate to a hold segment | Warning shows, NEXT disabled until min met |
| Advance | Click NEXT | Moves to next segment |
| Previous | Click Previous | Moves to previous segment |
| Pause | Click Pause | Show pauses, button shows Resume |
| Resume | Click Resume | Show resumes playback |
| Stop | Click Stop | Show stops, resets to start |
| Multi-Client | Open 2 browser tabs | Both show identical state |

### Regression Tests

| Feature | Verification |
|---------|--------------|
| Talent View | Receives segment changes, displays correctly |
| OBS Switching | Scenes change when segment changes |
| Camera Runtime | Tracking still updates |
| Graphics Triggers | Still fire from segments |
| Override Log | Records all overrides correctly |

### Browser Console Check

- [ ] No React warnings
- [ ] No socket connection errors
- [ ] No undefined errors from removed components

---

## File Change Summary

| File | Action | Priority | Est. Changes |
|------|--------|----------|--------------|
| `CurrentSegment.jsx` | Modify | P1 | +60 lines (UI), ~30 lines refactored |
| `NextSegment.jsx` | Modify | P1 | ~10 lines refactored |
| `ProducerView.jsx` | Modify | P1 | Remove ~80 lines, add ~60 lines (net -20) |
| `RunOfShow.jsx` | Modify | P2 | ~20 lines refactored |
| `TalentView.jsx` | Verify | P2 | Possibly ~10 lines |
| `TimesheetPanel.jsx` | Delete | P2 | -407 lines |

**Net Change:** Approximately -350 lines (removing duplication)

**New UI Elements:**
- "Show Not Started" state with Start button
- Simplified Show Stats panel in sidebar
- Enhanced CurrentSegment with progress bar, hold warnings, timing display

---

## Implementation Order

```
1. Task 1.1: Update CurrentSegment.jsx ──────────────┐
2. Task 1.2: Update NextSegment.jsx ─────────────────┼─► Phase 1 (P1)
3. Task 1.3: Wire Show Control buttons ──────────────┘
   │
   ▼
4. Task 2.1: Remove TimesheetPanel from sidebar ─────┐
5. Task 2.2: Add Progress Bar to CurrentSegment ─────┤
6. Task 2.3: Add Hold Segment Warning ───────────────┼─► Phase 2 (P1)
7. Task 2.4: Add Elapsed/Remaining Display ──────────┤
8. Task 2.5: Add "Show Not Started" state UI ────────┤
9. Task 2.6: Add Simplified Show Stats to sidebar ───┘
   │
   ▼
10. Task 3.1: Remove Show Progress stats panel ──────┐
11. Task 3.2: Update RunOfShow.jsx ──────────────────┼─► Phase 3 (P2)
12. Task 3.3: Delete TimesheetPanel.jsx ─────────────┤
13. Task 3.4: Verify TalentView ─────────────────────┘
   │
   ▼
14. Full Testing ────────────────────────────────────► Done
```

---

## Rollback Plan

If issues arise:

1. **Revert git commits** to restore TimesheetPanel
2. **Re-add import** in ProducerView.jsx
3. **Restore Show Progress panel** in sidebar

Keep `TimesheetPanel.jsx` in `_archive/` folder for 2 weeks before permanent deletion.

---

## Success Criteria

- [ ] Single "Start Show" button that works
- [ ] Current segment displays with ms-precision timing
- [ ] Progress bar shows segment progress (0-100%)
- [ ] Hold segment warnings displayed with countdown
- [ ] NEXT button disabled during hold minimum period
- [ ] Next segment preview works
- [ ] Segment list shows progress from timesheet
- [ ] Stats (Status, Talent Lock, OBS) visible in sidebar
- [ ] **No duplicate panels showing same information**
- [ ] No REST API calls to broken endpoints
- [ ] All data flows through socket events via ShowContext
- [ ] No console errors

---

## Related Documents

- [PRD-ConsolidateTimesheetShowProgress.md](PRD-ConsolidateTimesheetShowProgress.md) - Requirements document
- [PLAN-ConsolidateTimesheetShowProgress.md](PLAN-ConsolidateTimesheetShowProgress.md) - Original analysis & planning document
- [useTimesheet.js](../../show-controller/src/hooks/useTimesheet.js) - Hook documentation
- [ShowContext.jsx](../../show-controller/src/context/ShowContext.jsx) - Context implementation
