# Rundown System - Consolidated Plan

**Version:** 2.0
**Date:** 2026-01-23
**Status:** ACTIVE - Single Source of Truth
**Last Audit:** 2026-01-23 (Reality check performed)

---

## Purpose

This document consolidates all rundown-related PRDs into a single source of truth. It defines naming conventions, documents what exists, and shows how the pieces connect.

**This document supersedes:**
- PRD-Rundown-00-Index.md
- PRD-Rundown-INDEX.md
- PRD-AdvancedRundownEditor-2026-01-22.md
- PRD-Rundown-Engine-Architecture-2026-01-23.md
- All individual PRD-Rundown-XX folders

---

## 1. Naming Conventions

> **IMPORTANT:** Names match the actual code files. Do not use different names.

### 1.1 Two Systems: Rundown (Planning) vs Timesheet (Execution)

```
RUNDOWN (planning)              TIMESHEET (execution)
──────────────────              ─────────────────────
Rundown = segment data          Timesheet Engine = server execution
Rundown Editor = planning UI    useTimesheet = client hook
                                Timesheet UI = Producer View display
```

### 1.2 Core Concepts

| Term | Definition | Code Location |
|------|------------|---------------|
| **Rundown** | The segment list data (planning) | Firebase: `competitions/{compId}/production/rundown/segments` |
| **Rundown Editor** | UI for creating/editing segments | `RundownEditorPage.jsx`, Route: `/{compId}/rundown` |
| **Timesheet Engine** | Server-side execution engine | `server/lib/timesheetEngine.js` |
| **useTimesheet** | Client hook for execution state | `hooks/useTimesheet.js` |
| **Timesheet UI** | Execution display in Producer View | `CurrentSegment.jsx`, `NextSegment.jsx`, `RunOfShow.jsx` |
| **Producer View** | Full production control page | Route: `/{compId}/producer` |
| **Talent View** | Simplified view for commentators (planned) | Route: `/{compId}/talent` |

### 1.3 Socket Events (all prefixed with `timesheet`)

| Event | Purpose |
|-------|---------|
| `timesheetState` | Full state update |
| `timesheetTick` | Real-time timing updates |
| `timesheetSegmentActivated` | Segment changed |
| `timesheetShowStarted` | Show started |
| `timesheetShowStopped` | Show stopped |

### 1.4 Timesheet UI Components (in Producer View)

| Component | What It Shows | File |
|-----------|---------------|------|
| **Now Playing** | Current segment with timer, progress bar | `CurrentSegment.jsx` |
| **Up Next** | Next segment preview | `NextSegment.jsx` |
| **Show Control** | Previous/Next/Pause buttons | Part of `ProducerView.jsx` |
| **Show Progress** | Segment list with completion status | `RunOfShow.jsx` |

### 1.5 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLANNING                                        │
│                                                                              │
│   Rundown Editor (/{compId}/rundown)                                        │
│   - Create/edit segments                                                     │
│   - Assign scenes, graphics, timing                                         │
│   - Save to Firebase                                                         │
│                                                                              │
│   Saves to: competitions/{compId}/production/rundown/segments               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ "Load Rundown" (NOT YET IMPLEMENTED)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXECUTION                                       │
│                                                                              │
│   Timesheet Engine (server/lib/timesheetEngine.js)                          │
│   - Runs segments with timing                                                │
│   - Fires OBS scene changes                                                  │
│   - Triggers graphics                                                        │
│   - Broadcasts state via Socket.io                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Socket.io events (timesheetState, etc.)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VIEWS                                           │
│                                                                              │
│   ┌─────────────────────────────┐    ┌─────────────────────────────┐       │
│   │  Producer View              │    │  Talent View (planned)      │       │
│   │  /{compId}/producer         │    │  /{compId}/talent           │       │
│   │                             │    │                             │       │
│   │  Timesheet UI:              │    │  - Time remaining           │       │
│   │  - Now Playing              │    │  - Current/Next segment     │       │
│   │  - Up Next                  │    │  - Scene switching          │       │
│   │  - Show Control             │    │  - AI context (planned)     │       │
│   │  - Show Progress            │    │                             │       │
│   │                             │    │                             │       │
│   │  + Load Rundown (planned)   │    │                             │       │
│   │  + Full show control        │    │                             │       │
│   └─────────────────────────────┘    └─────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. What Exists Today (Reality Check 2026-01-23)

### 2.1 Component Status - CORRECTED

| Component | Claimed Status | **Actual Status** | Notes |
|-----------|----------------|-------------------|-------|
| **Timesheet Engine** | ✅ Complete | ⚠️ **CODE EXISTS, NOT FULLY WIRED** | ~1200 lines of code, but missing Firebase connection |
| **useTimesheet Hook** | ✅ Complete | ✅ **WORKS** | Client hook consumes socket events correctly |
| **Timesheet UI** | ✅ Complete | ✅ **WORKS** | CurrentSegment, NextSegment, RunOfShow use `useTimesheet()` |
| **Producer View** | ✅ Complete | ✅ **WORKS** | Full production control with Timesheet UI |
| **Rundown Editor** | ✅ Phases 0-8 Complete | ⚠️ **UI EXISTS, PICKERS NEED VERIFICATION** | Need to verify scene/graphics pickers connect to real data |
| **Graphics Registry** | Not mentioned | ✅ **EXISTS** | `graphicsRegistry.js`, `GraphicsManagerPage.jsx` |

### 2.2 Timesheet Engine - What's Actually Implemented

**File:** `server/lib/timesheetEngine.js` (~1187 lines)

| Feature | Code Exists | Actually Works |
|---------|-------------|----------------|
| Segment progression | ✅ | ⚠️ Needs segments loaded first |
| Auto-advance | ✅ | ⚠️ Needs segments loaded first |
| Hold segments | ✅ | ⚠️ Needs segments loaded first |
| OBS scene switching | ✅ `_applyTransitionAndSwitchScene()` | ⚠️ Needs OBS connected |
| Graphics triggering | ✅ `_triggerGraphic()` | ❌ **Only socket.io, no Firebase** |
| Video playback | ✅ `_playVideo()` | ⚠️ Needs OBS connected |
| Audio overrides | ✅ `_applyAudioOverrides()` | ⚠️ Needs OBS connected |
| History/override logging | ✅ | ✅ |

**Critical Gap:** Server initialization (line 251-255 of `server/index.js`):
```javascript
timesheetEngine = new TimesheetEngine({
  showConfig,
  obs,
  io
  // MISSING: firebase  <-- Graphics can't write to Firebase
});
```

### 2.3 What's Missing

#### Gap 1: No "Load Rundown" Bridge
- Rundown Editor saves to Firebase: `competitions/{compId}/production/rundown/segments`
- Timesheet Engine uses: `showConfig.segments` (hardcoded/empty)
- **No way to load from one to the other**

#### Gap 2: Firebase Not Passed to Engine
- `_triggerGraphic()` method checks for `this.firebase` but it's never provided
- Graphics only fire via socket.io, not direct Firebase writes
- This may cause issues with graphics rendering

#### Gap 3: Picker Data Sources Unverified
- Scene picker: Should pull from OBS state sync - **needs verification**
- Graphics picker: Should pull from Graphics Registry - **needs verification**

#### Gap 4: No Talent View
- Route doesn't exist
- No simplified commentator interface

#### Gap 5: No AI Context
- Not started at all

---

## 3. What Needs to Be Built

### 3.1 Phase A: Connect Rundown to Timesheet Engine (P0)

**Goal:** Enable Producer to load a rundown from Firebase into the Timesheet Engine for execution.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| A.1 | Add `loadRundown` socket handler on server | P0 | Not Started |
| A.2 | Add `loadRundown` action in ShowContext | P0 | Not Started |
| A.3 | Add "Load Rundown" button in Producer View | P0 | Not Started |
| A.4 | Create segment mapper (Editor format → Engine format) | P0 | Not Started |
| A.5 | Pass Firebase to TimesheetEngine constructor | P0 | Not Started |
| A.6 | Show rundown status indicator (loaded, modified, etc.) | P1 | Not Started |

**Segment Mapping Required:**

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

### 3.2 Phase A.5: Verify Pickers Connect to Real Data (P0)

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| A.5.1 | Verify Rundown Editor scene picker uses OBS state | P0 | Not Verified |
| A.5.2 | Verify Rundown Editor graphics picker uses Graphics Registry | P0 | Not Verified |
| A.5.3 | Fix any hardcoded picker data | P0 | Unknown |

### 3.3 Phase B: Talent View (P1)

**Goal:** Create a simplified view for commentators.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| B.1 | Create `TalentView.jsx` page | P1 | Not Started |
| B.2 | Current segment with prominent time remaining | P1 | Not Started |
| B.3 | Scene switching buttons | P1 | Not Started |
| B.4 | Next segment preview | P1 | Not Started |
| B.5 | Notes display | P1 | Not Started |
| B.6 | Add `/talent` route | P1 | Not Started |

**Talent View Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  TALENT VIEW                                   [Scene Buttons]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ CURRENT SEGMENT ──────────────────────────────────────────┐│
│  │  UCLA Introduction                                          ││
│  │  Live segment                                               ││
│  │                                                             ││
│  │              0:22 REMAINING                                 ││
│  │              (of 0:30)                                      ││
│  │                                                             ││
│  │  [████████████████████████░░░░░░░░░░░░] 73%                ││
│  │                                                             ││
│  │  NOTES: Wait for applause to die down                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ UP NEXT ──────────────────────────────────────────────────┐│
│  │  Oregon Introduction (0:30)                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ QUICK SCENES ─────────────────────────────────────────────┐│
│  │  [Cam 1] [Cam 2] [Cam 3] [Wide] [Graphics]                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Phase C: AI Context (P2/P3 - Future)

**Goal:** Enrich segments with live stats, talking points, and alerts.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| C.1 | Create AIContextService stub | P2 | Not Started |
| C.2 | Add `aiContextUpdated` socket event | P2 | Not Started |
| C.3 | Create `useAIContext` hook | P2 | Not Started |
| C.4 | Integrate with Virtius API for live stats | P3 | Not Started |
| C.5 | Generate talking points | P3 | Not Started |
| C.6 | Detect career highs, records | P3 | Not Started |

---

## 4. Architecture

### 4.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT (React SPA)                                                          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Rundown Editor   │  │ Producer View    │  │ Talent View      │          │
│  │ /{compId}/rundown│  │ /{compId}/producer│ │ /{compId}/talent │          │
│  │                  │  │                  │  │                  │          │
│  │ - Edit segments  │  │ - Timesheet UI   │  │ - Time remaining │          │
│  │ - Save to FB     │  │ - Load Rundown   │  │ - Scene switch   │          │
│  │                  │  │ - Show control   │  │ - Notes          │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           │                     │ useTimesheet()      │ useTimesheet()      │
│           │                     │                     │                     │
│           │            ┌────────┴─────────────────────┴────────┐            │
│           │            │           ShowContext                  │            │
│           │            │  - timesheetState                      │            │
│           │            │  - socket connection                   │            │
│           │            │  - loadRundown() action               │            │
│           │            └────────────────┬───────────────────────┘            │
│           │                             │                                    │
│           │ Firebase                    │ Socket.io                          │
│           │ (direct)                    │                                    │
└───────────┼─────────────────────────────┼────────────────────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐    ┌────────────────────────────────────────────────┐
│  Firebase             │    │  SERVER (Coordinator)                          │
│                       │    │                                                │
│  competitions/        │    │  ┌──────────────────────────────────────────┐ │
│    {compId}/          │    │  │  Timesheet Engine (timesheetEngine.js)   │ │
│      production/      │◄───┼──│                                          │ │
│        rundown/       │    │  │  - segments[]                            │ │
│          segments/    │    │  │  - currentIndex                          │ │
│                       │    │  │  - start/stop/advance/previous           │ │
│                       │    │  │  - OBS scene switching                   │ │
│                       │    │  │  - Graphics firing (socket.io only!)     │ │
│                       │    │  │                                          │ │
│                       │    │  │  loadRundown(compId):                    │ │
│                       │    │  │    1. Fetch from Firebase                │ │
│                       │    │  │    2. Map to engine format               │ │
│                       │    │  │    3. Update showConfig.segments         │ │
│                       │    │  └──────────────────────────────────────────┘ │
│                       │    │                                                │
└───────────────────────┘    └────────────────────────────────────────────────┘
```

### 4.2 Socket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `loadRundown` | Client → Server | Request to load rundown from Firebase |
| `timesheetState` | Server → Client | Full state update |
| `timesheetTick` | Server → Client | Real-time timing updates |
| `timesheetSegmentActivated` | Server → Client | Segment changed |

### 4.3 Key Files

| File | Purpose |
|------|---------|
| `server/lib/timesheetEngine.js` | Show execution engine |
| `server/index.js` | Socket handlers, API routes |
| `show-controller/src/hooks/useTimesheet.js` | Client hook for timesheet state |
| `show-controller/src/context/ShowContext.jsx` | Shared state, socket connection |
| `show-controller/src/pages/RundownEditorPage.jsx` | Rundown planning UI |
| `show-controller/src/views/ProducerView.jsx` | Production control + Timesheet UI |
| `show-controller/src/components/CurrentSegment.jsx` | Now Playing display |
| `show-controller/src/components/NextSegment.jsx` | Up Next display |
| `show-controller/src/components/RunOfShow.jsx` | Show Progress list |
| `show-controller/src/lib/graphicsRegistry.js` | Graphics definitions |
| `show-controller/src/pages/GraphicsManagerPage.jsx` | Graphics admin UI |

---

## 5. Implementation Plan

### 5.1 Immediate Priority: Phase A (Connect Editor to Engine)

```
Step 1: Verify Current State
├── A.5.1: Check if scene picker uses OBS state
├── A.5.2: Check if graphics picker uses registry
└── A.5.3: Document any hardcoded data

Step 2: Wire Firebase to Engine
└── A.5: Pass Firebase to TimesheetEngine constructor

Step 3: Build Load Rundown
├── A.1: Add loadRundown socket handler on server
├── A.2: Add loadRundown action in ShowContext
├── A.3: Add "Load Rundown" button in Producer View
└── A.4: Create segment mapper

Step 4: Polish
├── A.6: Rundown status indicator
├── Testing: Verify segments load correctly
└── Testing: Verify show execution works with loaded rundown
```

### 5.2 Next: Phase B (Talent View)

```
├── B.1: Create TalentView.jsx page
├── B.2-B.5: Build UI components
└── B.6: Add route
```

### 5.3 Future: Phase C (AI Context)

Deferred until Phases A & B are complete and in use.

---

## 6. Deprecated Documents

The following documents are now superseded by this plan:

| Document | Status |
|----------|--------|
| `docs/PRD-Rundown-00-Index.md` | DEPRECATED |
| `docs/PRD-Rundown-INDEX.md` | DEPRECATED |
| `docs/PRD-AdvancedRundownEditor-2026-01-22.md` | DEPRECATED (use for historical reference only) |
| `docs/PRD-Rundown-Engine-Architecture-2026-01-23.md` | MERGED into this document |
| `docs/PRD-Rundown-01-EditorPrototype/` | COMPLETED - keep for reference |
| `docs/PRD-Rundown-05-Prototype/` | DEPRECATED - approach changed |
| `docs/PRD-Rundown-00-Timesheet/` | COMPLETED - keep for reference |

---

## 7. Glossary

| Term | Meaning |
|------|---------|
| **Segment** | A unit of show content (e.g., "UCLA Introduction", "Rotation 1 Start") |
| **Rundown** | The complete list of segments for a show |
| **Timesheet Engine** | Server-side code that executes the show (`timesheetEngine.js`) |
| **Timesheet** | The execution UI in Producer View |
| **Load Rundown** | Action to fetch segments from Firebase and load into Timesheet Engine |
| **Hold Segment** | A segment that waits for manual advance (no auto-advance) |

---

## 8. Success Criteria

### Phase A Complete When:
- [ ] Producer can click "Load Rundown" and segments appear in Timesheet
- [ ] "Start Show" begins execution with loaded segments
- [ ] Segment progression works (auto-advance and manual)
- [ ] OBS scene switching works when segment changes
- [ ] Graphics firing works when segment has a graphic
- [ ] Changes made in Rundown Editor can be re-loaded

### Phase B Complete When:
- [ ] Talent View accessible at `/{compId}/talent`
- [ ] Shows current segment with prominent time remaining
- [ ] Scene switching buttons work
- [ ] Notes visible to talent

### Phase C Complete When:
- [ ] AI context populated for each segment
- [ ] Talking points display in both Producer and Talent views
- [ ] Career high alerts appear in real-time

---

## 9. Open Questions

| Question | Status | Decision |
|----------|--------|----------|
| Should Talent View have its own route or be a mode in Producer View? | Decided | Separate route (`/{compId}/talent`) |
| How to handle rundown changes during live show? | Open | Need to decide: block changes, allow with warning, or hot-reload? |
| Quick scenes configuration - per-competition or global? | Open | Likely per-competition in Firebase |
| Should graphics fire via Firebase or socket.io? | Open | Currently socket.io only - may need both |

---

## Appendix A: Historical Context

This system evolved through multiple PRD iterations:

1. **PRD-Rundown-00-Timesheet** (Jan 2026) - Consolidated timesheet UI, created `useTimesheet()` hook
2. **PRD-Rundown-01-EditorPrototype** (Jan 2026) - Built Rundown Editor UI as standalone planning tool
3. **PRD-Rundown-Engine-Architecture** (Jan 2026) - Proposed connecting Editor to Engine

The original plan had 10+ sub-PRDs with overlapping scope. This consolidated document simplifies to 3 clear phases (A, B, C) with the Rundown Editor prototype already complete.

---

## Appendix B: Code Audit Results (2026-01-23)

### TimesheetEngine Initialization
**File:** `server/index.js` lines 250-255
```javascript
function initializeTimesheetEngine() {
  timesheetEngine = new TimesheetEngine({
    showConfig,
    obs,
    io
    // MISSING: firebase - needed for _triggerGraphic()
  });
  // ... event handlers
}
```

### TimesheetEngine Methods That Need OBS/Firebase

| Method | Dependency | Status |
|--------|------------|--------|
| `_applyTransitionAndSwitchScene()` | `this.obs` | ⚠️ OBS must be connected |
| `_triggerGraphic()` | `this.firebase`, `this.io` | ❌ Firebase not provided |
| `_playVideo()` | `this.obs` | ⚠️ OBS must be connected |
| `_applyAudioOverrides()` | `this.obs` | ⚠️ OBS must be connected |

### Graphics Registry
**File:** `show-controller/src/lib/graphicsRegistry.js`
- ✅ Exists with full graphics definitions
- ✅ Helper functions: `getAllGraphics()`, `getGraphicById()`, etc.
- ⚠️ Need to verify Rundown Editor uses this

### Graphics Manager
**File:** `show-controller/src/pages/GraphicsManagerPage.jsx`
- ✅ Exists as admin UI
- ✅ Route should be `/graphics-manager`
