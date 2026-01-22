# PRD: Consolidate Timesheet Panel and Show Progress

**Version:** 1.0
**Date:** 2026-01-22
**Status:** 🟢 IN PROGRESS
**Depends On:** None
**Blocks:** Rundown Editor improvements

---

## Overview

The Producer View currently has **two separate systems** for show control that overlap in functionality, creating confusion and duplicate UI elements. This PRD consolidates the Timesheet Panel and original Show Progress system into a unified experience with a single source of truth.

---

## Problem Statement

### Current Issues

1. **Two "Start Show" buttons** - main area + TimesheetPanel sidebar
2. **Duplicate "Now Playing" displays** - CurrentSegment + TimesheetPanel
3. **Duplicate "Up Next" displays** - NextSegment + TimesheetPanel
4. **Two sets of show controls** - main area + TimesheetPanel
5. **Two segment lists** - RunOfShow + TimesheetPanel
6. **TimesheetPanel shows "Show not started"** even when show is running (broken REST API)
7. **Mixed data sources** - original system uses seconds, timesheet uses milliseconds

### Root Cause

**TimesheetPanel has a critical architectural flaw:** It maintains its OWN local state instead of using the ShowContext.

```javascript
// BROKEN: TimesheetPanel.jsx creates LOCAL state
const [timesheetState, setTimesheetState] = useState(null);

// REST API fetch that fails in production (serverUrl is empty)
useEffect(() => {
  const res = await fetch(`${serverUrl}/api/timesheet/state`);
  // ...
}, [serverUrl]);
```

Meanwhile, ShowContext already receives the same socket events and maintains `timesheetState` correctly.

---

## Architecture Decision

### Single Source of Truth

**Decision:** Use **Timesheet System as primary**, accessed via ShowContext and `useTimesheet()` hook.

| Aspect | Decision |
|--------|----------|
| Data source | `timesheetState` from ShowContext (socket events) |
| Time precision | Milliseconds (from timesheet engine) |
| UI location | Main content area (not sidebar) |
| Hook | `useTimesheet()` for all timesheet interactions |

### Why Timesheet System?

| Feature | Original System | Timesheet System |
|---------|-----------------|------------------|
| Time precision | Seconds | Milliseconds |
| Progress tracking | Manual calculation | Built-in (0-1) |
| Hold segments | Not supported | Full support |
| Auto-advance | Basic | Configurable |
| Override logging | Not tracked | Built-in |
| Segment types | Basic | video, live, static, break, hold, graphic |

---

## Requirements

### R1: Remove TimesheetPanel from Sidebar

**Priority:** P1

Remove `<TimesheetPanel />` from the right sidebar in ProducerView. Its functionality will be integrated into the main content area components.

**Acceptance Criteria:**
- [ ] TimesheetPanel removed from sidebar
- [ ] No duplicate "Now Playing" display
- [ ] No duplicate "Up Next" display
- [ ] No duplicate controls

### R2: Wire Main Components to Timesheet Data

**Priority:** P1

Update CurrentSegment, NextSegment, and Show Control to use `useTimesheet()` hook.

**CurrentSegment.jsx changes:**
```javascript
// BEFORE
const { state, elapsed } = useShow();
const { currentSegment } = state;

// AFTER
const { currentSegment, elapsed, remaining, progress, isHoldSegment, canAdvanceHold } = useTimesheet();
```

**NextSegment.jsx changes:**
```javascript
// AFTER
const { nextSegment } = useTimesheet();
```

**Show Control changes:**
```javascript
// AFTER
const { start, advance, previous, stop } = useTimesheet();
```

**Acceptance Criteria:**
- [ ] CurrentSegment displays millisecond-precision timing
- [ ] CurrentSegment shows progress bar (0-100%)
- [ ] CurrentSegment shows hold segment warnings
- [ ] NextSegment displays from timesheet data
- [ ] Show controls use timesheet actions

### R3: Single Start Show Button

**Priority:** P1

Only ONE "Start Show" button exists, using timesheet engine.

**Acceptance Criteria:**
- [ ] Single Start Show button in main content area
- [ ] Button calls `start()` from `useTimesheet()`
- [ ] Button hidden when show is running

### R4: Remove Redundant Show Progress Panel

**Priority:** P2

Remove the "Show Progress" stats panel from the right sidebar (segment count, status) - this information is now in the main content area.

**Acceptance Criteria:**
- [ ] Show Progress panel removed from sidebar
- [ ] Segment count visible in Run of Show header
- [ ] Status visible in Show Stats panel (simplified)

### R5: Keep Monitoring Panels in Sidebar

**Priority:** P2

The following panels remain in the right sidebar for monitoring:

| Panel | Purpose |
|-------|---------|
| Override Log | Scene/camera override history |
| Alert Panel | Warnings and alerts |
| Camera Status | Camera health monitoring |
| Web Graphics | Graphics triggers |
| OBS Status | Connection status |
| Connected Clients | Who's connected |
| Show Stats | Simplified: Status, Talent Lock, OBS only |

**Acceptance Criteria:**
- [ ] All monitoring panels retained in sidebar
- [ ] Show Stats simplified (no segment count)

### R6: Enhanced Now Playing Display

**Priority:** P1

The Now Playing (CurrentSegment) component includes all timesheet features:

```
┌─ NOW PLAYING ──────────────────────────────────────────┐
│  🎤 Welcome & Host Intro                               │
│     Live segment                                       │
│                                                        │
│  ┌────────────┐  ┌────────────┐                       │
│  │  ELAPSED   │  │ REMAINING  │                       │
│  │   0:18     │  │   0:12     │  ← Red when < 10s     │
│  └────────────┘  └────────────┘                       │
│                                                        │
│  [████████████████░░░░░░░░░░░░] 60%                   │
│                                                        │
│  OBS Scene: Talent Camera                              │
│                                                        │
│  ⚠️ HOLD: Wait 0:05 before advancing                  │
│     (only shown for hold segments)                     │
│                                                        │
│  NOTES: Wait for talent to finish intro                │
└────────────────────────────────────────────────────────┘
```

**Data from `useTimesheet()`:**
- `currentSegment` - segment object
- `elapsed` - milliseconds elapsed
- `remaining` - milliseconds remaining
- `progress` - 0-1 value for progress bar
- `isHoldSegment` - boolean
- `canAdvanceHold` - boolean
- `holdRemainingMs` - ms until hold can advance

**Acceptance Criteria:**
- [ ] Elapsed/Remaining displayed with proper formatting
- [ ] Progress bar with color coding (blue → yellow → red)
- [ ] Hold segment warning displayed when applicable
- [ ] NEXT button disabled when hold min not met
- [ ] Notes displayed from segment

### R7: Enhanced Show Control

**Priority:** P1

Show Control buttons wire to timesheet actions with proper state handling:

```
┌─ SHOW CONTROL ─────────────────────────────────────────┐
│                                                         │
│  [Previous] [════════ NEXT ════════] [Pause/Resume]    │
│                                                         │
│  [🔒 Lock Talent]  [↻ Reset Show]  [⏹ Stop]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Button Actions:**
| Button | Action | Notes |
|--------|--------|-------|
| Previous | `previous()` | Disabled at segment 0 |
| NEXT | `advance()` | Disabled when hold min not met |
| Pause/Resume | `togglePause()` | Yellow=Pause, Green=Resume |
| Lock Talent | `lockTalent()` | Red when locked |
| Reset Show | `resetShow()` | Reset to segment 0 |
| Stop | `stop()` | NEW: Stop show from timesheet |

**Acceptance Criteria:**
- [ ] Previous button works via timesheet
- [ ] NEXT button disabled during hold min period
- [ ] Stop button added and functional
- [ ] All buttons use correct timesheet actions

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `CurrentSegment.jsx` | Use `useTimesheet()` hook, add progress bar, hold warnings | **P1** |
| `NextSegment.jsx` | Use `useTimesheet()` hook | **P1** |
| `ProducerView.jsx` | Remove TimesheetPanel, remove Show Progress stats, wire Show Control to timesheet | **P1** |
| `RunOfShow.jsx` | Use `useTimesheet()` for segment index/status | **P2** |
| `TimesheetPanel.jsx` | **DELETE** or archive - functionality moved to main components | **P2** |

### Files NOT Modified

| File | Reason |
|------|--------|
| `ShowContext.jsx` | Already has `timesheetState` from socket events |
| `useTimesheet.js` | Already exists and works correctly |
| `server/index.js` | Already emits timesheet events correctly |
| `server/timesheetEngine.js` | Already works correctly |

---

## UI Layout Comparison

### Before (Current - Problems)

```
┌─ MAIN CONTENT ─────────────────────┐  ┌─ SIDEBAR ─────────┐
│  ┌─ NOW PLAYING ─────────────────┐ │  │ ┌─ Timesheet ────┐│
│  │  (seconds precision)          │ │  │ │ [Start Show]  ││ ← DUPLICATE!
│  └───────────────────────────────┘ │  │ │ Now Playing   ││ ← DUPLICATE!
│  ┌─ UP NEXT ─────────────────────┐ │  │ │ Up Next       ││ ← DUPLICATE!
│  │  ...                          │ │  │ │ [Prev][Next]  ││ ← DUPLICATE!
│  └───────────────────────────────┘ │  │ │ Segment List  ││ ← DUPLICATE!
│  ┌─ SHOW CONTROL ────────────────┐ │  │ └───────────────┘│
│  │  [Start Show] [Prev] [Next]   │ │  │ ┌─ Show Progress┐│
│  └───────────────────────────────┘ │  │ │ 2/21 segments ││ ← DUPLICATE!
│  ┌─ RUN OF SHOW ─────────────────┐ │  │ └───────────────┘│
│  │  Segment list (seconds)       │ │  └──────────────────┘
│  └───────────────────────────────┘ │
└────────────────────────────────────┘
```

### After (Consolidated)

```
┌─ MAIN CONTENT ─────────────────────┐  ┌─ SIDEBAR ─────────┐
│  ┌─ NOW PLAYING ─────────────────┐ │  │ ┌─ Override Log ─┐│
│  │  (ms precision, progress bar) │ │  │ │ ...            ││
│  │  Hold warnings                │ │  │ └────────────────┘│
│  └───────────────────────────────┘ │  │ ┌─ Alert Panel ──┐│
│  ┌─ UP NEXT ─────────────────────┐ │  │ │ ...            ││
│  │  (from timesheet)             │ │  │ └────────────────┘│
│  └───────────────────────────────┘ │  │ ┌─ Camera Status ┐│
│  ┌─ SHOW CONTROL ────────────────┐ │  │ │ ...            ││
│  │  [Prev] [NEXT] [Pause] [Stop] │ │  │ └────────────────┘│
│  │  (uses timesheet actions)     │ │  │ ┌─ Graphics ─────┐│
│  └───────────────────────────────┘ │  │ │ ...            ││
│  ┌─ SHOW PROGRESS ───── 2/21 ────┐ │  │ └────────────────┘│
│  │  (ms timing, from timesheet)  │ │  │ ┌─ OBS Status ───┐│
│  └───────────────────────────────┘ │  │ │ Connected      ││
└────────────────────────────────────┘  │ └────────────────┘│
                                        │ ┌─ Show Stats ───┐│
                                        │ │ Status: Live   ││
                                        │ │ Talent: Locked ││
                                        │ └────────────────┘│
                                        └──────────────────┘
```

---

## Implementation Plan

### Phase 1: Fix Data Source (P1)

1. **Update CurrentSegment.jsx** to use `useTimesheet()` hook
2. **Update NextSegment.jsx** to use `useTimesheet()` hook
3. **Wire Show Control buttons** to timesheet actions in ProducerView

### Phase 2: UI Consolidation (P1)

4. **Remove TimesheetPanel** from ProducerView sidebar
5. **Add progress bar and hold warnings** to CurrentSegment
6. **Add Stop button** to Show Control

### Phase 3: Cleanup (P2)

7. **Remove Show Progress stats panel** from sidebar
8. **Update RunOfShow.jsx** to use timesheet data
9. **Delete or archive TimesheetPanel.jsx**

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
- [ ] No duplicate panels showing same information
- [ ] No REST API calls to broken endpoints
- [ ] All data flows through socket events via ShowContext

---

## Test Plan

### Manual Tests

| Test | Steps | Expected |
|------|-------|----------|
| Start Show | Click Start Show button | Show starts, controls appear |
| Segment Timing | Watch elapsed/remaining | Updates every 100ms |
| Progress Bar | Watch during segment | Fills from 0% to 100% |
| Hold Segment | Enter hold segment | Warning shows, NEXT disabled until min met |
| Advance | Click NEXT | Moves to next segment |
| Previous | Click Previous | Moves to previous segment |
| Pause | Click Pause | Show pauses, button changes to Resume |
| Stop | Click Stop | Show stops, Start button reappears |
| Multi-Client | Open two browser tabs | Both show same state |

### Regression Tests

Verify these still work after changes:
- [ ] Talent View receives segment changes
- [ ] OBS scene switching still works
- [ ] Camera runtime tracking still works
- [ ] Graphics triggers still work

---

## Definition of Done

1. [ ] Single Start Show button works
2. [ ] CurrentSegment uses timesheet data (ms precision)
3. [ ] Progress bar and hold warnings implemented
4. [ ] Show Control uses timesheet actions
5. [ ] TimesheetPanel removed from sidebar
6. [ ] Show Progress stats panel removed from sidebar
7. [ ] No duplicate UI elements
8. [ ] All tests pass
9. [ ] No console errors
10. [ ] Code reviewed and merged

---

## Related Documents

- [PLAN-ConsolidateTimesheetShowProgress.md](PLAN-ConsolidateTimesheetShowProgress.md) - Original analysis document
- [useTimesheet.js](../../show-controller/src/hooks/useTimesheet.js) - Existing timesheet hook
- [ShowContext.jsx](../../show-controller/src/context/ShowContext.jsx) - Show context with timesheetState
