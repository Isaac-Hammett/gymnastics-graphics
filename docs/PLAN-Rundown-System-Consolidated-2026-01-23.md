# Rundown System - Consolidated Plan

**Version:** 3.1
**Date:** 2026-01-23
**Status:** ACTIVE - Single Source of Truth
**Last Audit:** 2026-01-23 (Architecture clarified for multi-competition support)

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
| OBS scene switching | ✅ `_applyTransitionAndSwitchScene()` | ❌ **Uses single OBS, not per-competition** |
| Graphics triggering | ✅ `_triggerGraphic()` | ❌ **Only socket.io, no Firebase** |
| Video playback | ✅ `_playVideo()` | ❌ **Uses single OBS, not per-competition** |
| Audio overrides | ✅ `_applyAudioOverrides()` | ❌ **Uses single OBS, not per-competition** |
| History/override logging | ✅ | ✅ |

**Critical Gap #1 - Single Global Instance:** Server initialization (line 251-255 of `server/index.js`):
```javascript
timesheetEngine = new TimesheetEngine({
  showConfig,
  obs,           // ❌ Single OBS instance - doesn't work for multi-competition
  io
  // MISSING: firebase  <-- Graphics can't write to Firebase
  // MISSING: compId    <-- Engine doesn't know which competition it serves
  // MISSING: obsConnectionManager <-- Should use per-competition OBS connections
});
```

**Critical Gap #2 - Architecture Mismatch:** The current engine assumes a single OBS connection, but the production system uses `obsConnectionManager` which maintains **per-competition OBS connections** to each competition's VM.

### 2.3 What's Missing

#### Gap 1: TimesheetEngine Not Competition-Aware (CRITICAL)
The current TimesheetEngine is designed as a single global instance, but production requires **per-competition execution**:

```
CURRENT (Wrong):
┌─────────────────────────────────────────┐
│  Single TimesheetEngine                 │
│  └── Single OBS connection              │
│      (can only control one competition) │
└─────────────────────────────────────────┘

NEEDED (Correct):
┌─────────────────────────────────────────┐
│  Competition A (compId: abc123)         │
│  ├── VM: 50.19.137.152                  │
│  ├── OBS: obsConnectionManager.get('abc123') │
│  ├── Rundown: competitions/abc123/production/rundown/segments │
│  └── TimesheetEngine instance for abc123│
├─────────────────────────────────────────┤
│  Competition B (compId: xyz789)         │
│  ├── VM: 54.210.98.89                   │
│  ├── OBS: obsConnectionManager.get('xyz789') │
│  ├── Rundown: competitions/xyz789/production/rundown/segments │
│  └── TimesheetEngine instance for xyz789│
└─────────────────────────────────────────┘
```

**Required changes:**
- TimesheetEngine must accept `compId` and `obsConnectionManager` (not a single `obs`)
- Create a `Map<compId, TimesheetEngine>` to hold per-competition instances
- Engine methods must route OBS calls through `obsConnectionManager.getConnection(compId)`

#### Gap 2: No "Load Rundown" Bridge
- Rundown Editor saves to Firebase: `competitions/{compId}/production/rundown/segments`
- Timesheet Engine uses: `showConfig.segments` (hardcoded/empty)
- **No way to load from one to the other**

#### Gap 3: Firebase Not Passed to Engine
- `_triggerGraphic()` method checks for `this.firebase` but it's never provided
- Graphics only fire via socket.io, not direct Firebase writes
- This may cause issues with graphics rendering

#### Gap 4: Picker Data Sources Unverified
- Scene picker: Should pull from OBS state sync - **needs verification**
- Graphics picker: Should pull from Graphics Registry - **needs verification**

#### Gap 5: No Talent View
- Route doesn't exist
- No simplified commentator interface

#### Gap 6: No AI Context
- Not started at all

---

## 3. What Needs to Be Built

### Phase Overview

| Phase | Name | Priority | Description |
|-------|------|----------|-------------|
| **A** | Connect Editor to Engine | P0 | Load rundown from Firebase into Timesheet Engine |
| **A.5** | Verify Pickers | P0 | Ensure scene/graphics pickers use real data |
| **B** | Talent View | P1 | Simplified view for commentators |
| **C** | AI Context (Live) | P2/P3 | Real-time talking points, career high alerts |
| **D** | AI Suggestions (Planning) | P2 | Suggest segments based on competition context |
| **E** | Script & Talent Flow | P2 | Pipe scripts and talent data to execution views |
| **F** | Audio Cue Integration | P3 | Trigger audio playback from segment cues |
| **G** | Production Tracking | P3 | Equipment and sponsor tracking reports |
| **H** | Rehearsal Mode | P1 | Dry run without firing OBS/graphics |
| **I** | Live Rundown Sync | P2 | Hot-reload rundown changes during show |
| **J** | Segment Timing Analytics | P2 | Track actual vs planned timing |

> **Relationship to PRD-01:** PRD-Rundown-01-EditorPrototype builds the **UI** for many of these features (script fields, talent assignment, AI suggestions panel). This consolidated plan ensures the **data flows correctly** from Editor → Engine → Views.

### 3.1 Phase A: Connect Rundown to Timesheet Engine (P0)

**Goal:** Enable Producer to load a rundown from Firebase into the Timesheet Engine for execution.

#### A.0: Refactor TimesheetEngine for Multi-Competition (PREREQUISITE)

The engine must be updated to work with the production infrastructure before any other Phase A work.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| A.0.1 | Update TimesheetEngine constructor to accept `compId` and `obsConnectionManager` | P0 | Not Started |
| A.0.2 | Create `timesheetEngines` Map in server/index.js to hold per-competition instances | P0 | Not Started |
| A.0.3 | Update `_applyTransitionAndSwitchScene()` to use `obsConnectionManager.getConnection(this.compId)` | P0 | Not Started |
| A.0.4 | Update `_playVideo()` to use per-competition OBS connection | P0 | Not Started |
| A.0.5 | Update `_applyAudioOverrides()` to use per-competition OBS connection | P0 | Not Started |
| A.0.6 | Update all socket event broadcasts to target competition room: `io.to('competition:${compId}')` | P0 | Not Started |
| A.0.7 | Pass Firebase Admin instance to engine for `_triggerGraphic()` | P0 | Not Started |

**New Constructor Signature:**
```javascript
// OLD (single competition):
new TimesheetEngine({ showConfig, obs, io })

// NEW (multi-competition):
new TimesheetEngine({
  compId,                    // Which competition this engine serves
  obsConnectionManager,      // Get per-competition OBS via .getConnection(compId)
  firebase,                  // Firebase Admin for graphics triggering
  io                         // Socket.io server (broadcasts to competition room)
})
```

**OBS Call Pattern Change:**
```javascript
// OLD:
await this.obs.call('SetCurrentProgramScene', { sceneName });

// NEW:
const obs = this.obsConnectionManager.getConnection(this.compId);
if (obs && this.obsConnectionManager.isConnected(this.compId)) {
  await obs.call('SetCurrentProgramScene', { sceneName });
}
```

#### A.1-A.6: Build Load Rundown Feature

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| A.1 | Add `loadRundown` socket handler on server (creates/updates engine for compId) | P0 | Not Started |
| A.2 | Add `loadRundown` action in ShowContext | P0 | Not Started |
| A.3 | Add "Load Rundown" button in Producer View | P0 | Not Started |
| A.4 | Create segment mapper (Editor format → Engine format) | P0 | Not Started |
| A.5 | Verify Firebase is passed to engine (done in A.0.7) | P0 | Not Started |
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

### 3.4 Phase C: AI Context - Live Execution (P2/P3)

**Goal:** Enrich segments with live stats, talking points, and alerts **during show execution**.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| C.1 | Create AIContextService stub | P2 | Not Started |
| C.2 | Add `aiContextUpdated` socket event | P2 | Not Started |
| C.3 | Create `useAIContext` hook | P2 | Not Started |
| C.4 | Integrate with Virtius API for live stats | P3 | Not Started |
| C.5 | Generate talking points in real-time | P3 | Not Started |
| C.6 | Detect career highs, records during show | P3 | Not Started |
| C.7 | Display AI context in Talent View | P3 | Not Started |
| C.8 | Display AI context in Producer View | P3 | Not Started |

### 3.5 Phase D: AI Segment Suggestions - Planning (P2)

**Goal:** AI suggests segments to add **during rundown planning** based on competition context.

> **Note:** PRD-01 Phase 12 builds the UI. This phase ensures the AI service is wired up.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| D.1 | Create AI suggestion service on server | P2 | Not Started |
| D.2 | Analyze competition metadata (type, teams, date) | P2 | Not Started |
| D.3 | Query roster data for seniors, All-Americans, milestones | P2 | Not Started |
| D.4 | Generate segment suggestions with confidence scores | P2 | Not Started |
| D.5 | Add `getAISuggestions` API endpoint | P2 | Not Started |
| D.6 | Wire Rundown Editor to display suggestions | P2 | Not Started |

**Context Triggers:**

| Context | AI Suggestion |
|---------|---------------|
| Senior meet | "Add Senior Recognition segment?" |
| Championship meet | "Add Trophy Presentation segment?" |
| Rivalry meet | "Add Rivalry History segment with stats?" |
| Seniors on roster | "UCLA has 3 seniors - add individual spotlights?" |
| All-American on roster | "Oregon's [athlete] is returning All-American - feature?" |
| Record approaching | "Arizona's [athlete] is 2 routines from school record" |

### 3.6 Phase E: Script & Talent Flow (P2)

**Goal:** Ensure segment scripts and talent assignments flow from Editor to execution views.

> **Note:** PRD-01 Phase 12 builds the UI fields. This phase ensures data reaches Talent View.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| E.1 | Add script field to segment data model | P2 | Not Started |
| E.2 | Pipe script field through Timesheet Engine | P2 | Not Started |
| E.3 | Display script in Talent View (teleprompter-style) | P2 | Not Started |
| E.4 | Add talent assignment to segment data model | P2 | Not Started |
| E.5 | Create talent schedule view | P3 | Not Started |
| E.6 | Show "you're on camera" indicator in Talent View | P3 | Not Started |

### 3.7 Phase F: Audio Cue Integration (P3)

**Goal:** Pipe audio cue data from Editor to execution for playback triggering.

> **Note:** PRD-01 Phase 12 builds the audio planning UI. This phase wires playback.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| F.1 | Add audio cue fields to segment data model | P3 | Not Started |
| F.2 | Pipe audio cues through Timesheet Engine | P3 | Not Started |
| F.3 | Trigger audio playback on segment start | P3 | Not Started |
| F.4 | Add audio control to Producer View | P3 | Not Started |

### 3.8 Phase G: Production Tracking (P3)

**Goal:** Ensure equipment and sponsor data flows for production management.

> **Note:** PRD-01 Phase 12 builds the tracking UI. This phase enables reports.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| G.1 | Add equipment fields to segment data model | P3 | Not Started |
| G.2 | Generate equipment schedule report | P3 | Not Started |
| G.3 | Detect equipment conflicts | P3 | Not Started |
| G.4 | Add sponsor fields to segment data model | P3 | Not Started |
| G.5 | Generate sponsor fulfillment report | P3 | Not Started |

### 3.9 Phase H: Rehearsal Mode (P1)

**Goal:** Run through the show without firing real graphics or OBS changes.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| H.1 | Add rehearsal mode toggle to Timesheet Engine | P1 | Not Started |
| H.2 | Skip OBS scene changes in rehearsal mode | P1 | Not Started |
| H.3 | Skip graphics firing in rehearsal mode | P1 | Not Started |
| H.4 | Show "REHEARSAL" indicator in all views | P1 | Not Started |
| H.5 | Log timing data for post-rehearsal analysis | P2 | Not Started |

### 3.10 Phase I: Live Rundown Sync (P2)

**Goal:** Allow rundown edits during live show with hot-reload capability.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| I.1 | Detect rundown changes in Firebase during show | P2 | Not Started |
| I.2 | Show "Rundown Modified" warning in Producer View | P2 | Not Started |
| I.3 | Add "Reload Rundown" action (with confirmation) | P2 | Not Started |
| I.4 | Preserve current segment position on reload | P2 | Not Started |
| I.5 | Option to block edits during live show | P2 | Not Started |

### 3.11 Phase J: Segment Timing Analytics (P2)

**Goal:** Track actual vs planned duration across shows for future planning.

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| J.1 | Log actual segment durations during show | P2 | Not Started |
| J.2 | Store timing data in Firebase post-show | P2 | Not Started |
| J.3 | Create timing analytics dashboard | P3 | Not Started |
| J.4 | Show historical average in Rundown Editor | P3 | Not Started |
| J.5 | AI-powered timing predictions based on history | P3 | Not Started |

---

## 4. Architecture

### 4.1 Infrastructure Overview

The system uses a **Coordinator** pattern where the central server manages multiple simultaneous competitions, each with its own VM and OBS instance.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  COORDINATOR (api.commentarygraphic.com - 44.193.31.120)                     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  obsConnectionManager (per-competition OBS connections)                  │ │
│  │  ├── compId: abc123 → OBS WebSocket to VM 50.19.137.152:4455           │ │
│  │  ├── compId: xyz789 → OBS WebSocket to VM 54.210.98.89:4455            │ │
│  │  └── compId: def456 → OBS WebSocket to VM 52.91.123.45:4455            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  timesheetEngines Map (per-competition show execution)                   │ │
│  │  ├── compId: abc123 → TimesheetEngine instance                          │ │
│  │  ├── compId: xyz789 → TimesheetEngine instance                          │ │
│  │  └── compId: def456 → TimesheetEngine instance                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  Socket.io rooms: competition:abc123, competition:xyz789, etc.               │
└──────────────────────────────────────────────────────────────────────────────┘
                    │                                    │
                    │ OBS WebSocket (ws://)              │ Socket.io (wss://)
                    ▼                                    ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│  Competition VM         │                 │  Frontend Clients       │
│  (e.g., 50.19.137.152)  │                 │  (commentarygraphic.com)│
│  ├── OBS :4455          │                 │                         │
│  └── Show Server :3003  │                 │  Connects with compId   │
└─────────────────────────┘                 │  in socket query        │
                                            └─────────────────────────┘
```

### 4.2 Per-Competition Data Flow

Each competition has isolated resources:

```
Competition abc123:
├── Firebase: competitions/abc123/production/rundown/segments
├── VM: 50.19.137.152 (assigned via vmPoolManager)
├── OBS: obsConnectionManager.getConnection('abc123')
├── Engine: timesheetEngines.get('abc123')
└── Socket Room: competition:abc123

When Producer loads rundown for abc123:
1. Client emits: loadRundown({ compId: 'abc123' })
2. Server fetches: Firebase competitions/abc123/production/rundown/segments
3. Server creates/updates: timesheetEngines.set('abc123', new TimesheetEngine({...}))
4. Engine uses: obsConnectionManager.getConnection('abc123') for OBS calls
5. Engine broadcasts to: io.to('competition:abc123').emit('timesheetState', ...)
```

### 4.3 Client Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT (React SPA at commentarygraphic.com)                                 │
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
│           │            │  - timesheetState (from server)        │            │
│           │            │  - socket connection (with compId)     │            │
│           │            │  - loadRundown() action                │            │
│           │            └────────────────┬───────────────────────┘            │
│           │                             │                                    │
│           │ Firebase (direct)           │ Socket.io (with compId query)      │
│           │                             │                                    │
└───────────┼─────────────────────────────┼────────────────────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐    ┌────────────────────────────────────────────────┐
│  Firebase             │    │  COORDINATOR (api.commentarygraphic.com)       │
│                       │    │                                                │
│  competitions/        │    │  On socket connection with compId:             │
│    {compId}/          │    │  1. Join room: competition:{compId}            │
│      production/      │◄───┼──│  2. Connect OBS: obsConnManager.connectToVM()│
│        rundown/       │    │  3. Get/create engine: timesheetEngines.get()  │
│          segments/    │    │                                                │
│                       │    │  loadRundown handler:                          │
│                       │    │  1. Fetch segments from Firebase               │
│                       │    │  2. Map to engine format                       │
│                       │    │  3. Load into per-competition engine           │
│                       │    │  4. Broadcast to competition room              │
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

### 5.1 Phase Priority Overview

| Phase | Name | Priority | Depends On |
|-------|------|----------|------------|
| A | Connect Editor to Engine | P0 | - |
| H | Rehearsal Mode | P1 | A |
| B | Talent View | P1 | A |
| I | Live Rundown Sync | P2 | A |
| J | Segment Timing Analytics | P2 | A |
| D | AI Segment Suggestions (Planning) | P2 | - |
| E | Script & Talent Flow | P2 | A, B |
| C | AI Context (Live Execution) | P2/P3 | A, B |
| F | Audio Cue Integration | P3 | A |
| G | Production Tracking | P3 | A |

### 5.2 Immediate Priority: Phase A (Connect Editor to Engine)

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

### 5.3 Next: Phase H (Rehearsal Mode) + Phase B (Talent View)

```
Phase H (Rehearsal):
├── H.1: Add rehearsal mode toggle
├── H.2-H.3: Skip OBS/graphics in rehearsal
└── H.4: Show REHEARSAL indicator

Phase B (Talent View):
├── B.1: Create TalentView.jsx page
├── B.2-B.5: Build UI components
└── B.6: Add route
```

### 5.4 Then: Phases I, J, D, E (Live Sync, Analytics, AI, Scripts)

```
Phase I (Live Sync):
└── Hot-reload rundown changes during show

Phase J (Analytics):
└── Track actual vs planned timing

Phase D (AI Planning):
└── Suggest segments based on competition context

Phase E (Scripts):
└── Pipe script/talent data to Talent View
```

### 5.5 Future: Phases C, F, G (AI Live, Audio, Production)

Deferred until earlier phases are complete and in use.

---

## 6. Related & Deprecated Documents

### Active Documents

| Document | Status | Purpose |
|----------|--------|---------|
| `docs/PRD-Rundown-01-EditorPrototype/` | **ACTIVE** | UI implementation for Rundown Editor (Phases 0-12) |
| This document | **ACTIVE** | System integration (Phases A-J) |

> **How they relate:** PRD-01 builds the UI. This plan ensures data flows to execution.

### Deprecated Documents

| Document | Status |
|----------|--------|
| `docs/PRD-Rundown-00-Index.md` | DEPRECATED |
| `docs/PRD-Rundown-INDEX.md` | DEPRECATED |
| `docs/PRD-AdvancedRundownEditor-2026-01-22.md` | DEPRECATED (historical reference only) |
| `docs/PRD-Rundown-Engine-Architecture-2026-01-23.md` | MERGED into this document |
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
- [ ] AI context populated for each segment during live show
- [ ] Talking points display in both Producer and Talent views
- [ ] Career high alerts appear in real-time

### Phase D Complete When:
- [ ] AI suggestions appear in Rundown Editor based on competition context
- [ ] One-click to add suggested segment
- [ ] Suggestions update when competition metadata changes

### Phase E Complete When:
- [ ] Script field data flows from Editor to Talent View
- [ ] Talent assignments visible in Talent View
- [ ] "You're on camera" indicator works

### Phase F Complete When:
- [ ] Audio cues trigger on segment start
- [ ] Audio control available in Producer View

### Phase G Complete When:
- [ ] Equipment schedule report generates correctly
- [ ] Sponsor fulfillment report generates correctly

### Phase H Complete When:
- [ ] Rehearsal mode runs full show without firing OBS/graphics
- [ ] REHEARSAL indicator visible in all views
- [ ] Timing data logged for analysis

### Phase I Complete When:
- [ ] Producer sees warning when rundown modified during show
- [ ] "Reload Rundown" updates segments without losing position
- [ ] Option to block edits during live show works

### Phase J Complete When:
- [ ] Actual segment durations logged during show
- [ ] Historical timing data available in Rundown Editor
- [ ] Timing predictions suggest realistic durations

---

## 9. Open Questions

| Question | Status | Decision |
|----------|--------|----------|
| Should Talent View have its own route or be a mode in Producer View? | Decided | Separate route (`/{compId}/talent`) |
| How to handle rundown changes during live show? | Addressed | Phase I covers this - warning + reload option |
| Quick scenes configuration - per-competition or global? | Open | Likely per-competition in Firebase |
| Should graphics fire via Firebase or socket.io? | Open | Currently socket.io only - may need both |
| AI service provider for suggestions/context? | Open | Claude API, OpenAI, or custom rules engine? |
| Audio playback mechanism? | Open | OBS media source, separate audio player, or browser audio? |
| Talent View mobile optimization? | Open | Responsive design or separate mobile app? |
| Rehearsal mode - same view or separate route? | Open | Likely same views with "REHEARSAL" badge |

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
