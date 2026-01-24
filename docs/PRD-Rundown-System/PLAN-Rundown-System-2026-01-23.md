# Implementation Plan: Rundown System

**Version:** 1.0
**Date:** 2026-01-23
**Status:** Active
**PRD:** [PRD-Rundown-System-2026-01-23.md](./PRD-Rundown-System-2026-01-23.md)

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

## 2. Key Files

### Server
| File | Purpose |
|------|---------|
| `server/index.js` | Coordinator entry point, socket handlers |
| `server/lib/timesheetEngine.js` | Show execution engine (~1187 lines) |
| `server/lib/obsConnectionManager.js` | Per-competition OBS WebSocket connections |
| `server/lib/vmPoolManager.js` | EC2 VM assignment and lifecycle |
| `server/lib/productionConfigService.js` | Firebase Admin initialization |

### Client
| File | Purpose |
|------|---------|
| `show-controller/src/hooks/useTimesheet.js` | Client hook for timesheet state |
| `show-controller/src/context/ShowContext.jsx` | Shared state, socket connection |
| `show-controller/src/pages/RundownEditorPage.jsx` | Rundown planning UI |
| `show-controller/src/views/ProducerView.jsx` | Production control + Timesheet UI |
| `show-controller/src/components/CurrentSegment.jsx` | Now Playing display |
| `show-controller/src/components/NextSegment.jsx` | Up Next display |
| `show-controller/src/components/RunOfShow.jsx` | Show Progress list |

---

## 3. Code Audit (2026-01-23)

### 3.1 Current State

| Component | Code Exists | Actually Works |
|-----------|-------------|----------------|
| Timesheet Engine | ✅ ~1200 lines | ⚠️ Not wired to Firebase/OBS properly |
| useTimesheet Hook | ✅ | ✅ Works |
| Timesheet UI | ✅ | ✅ Works |
| Rundown Editor | ✅ | ⚠️ Pickers need verification |

### 3.2 Critical Gap: Single Global Instance

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

### 3.3 Methods Requiring Updates

| Method | Current | Required Change |
|--------|---------|-----------------|
| `_applyTransitionAndSwitchScene()` | `this.obs.call(...)` | Use `obsConnectionManager.getConnection(compId)` |
| `_triggerGraphic()` | `this.firebase` (never provided) | Pass Firebase Admin in constructor |
| `_playVideo()` | `this.obs.call(...)` | Use per-competition OBS |
| `_applyAudioOverrides()` | `this.obs.call(...)` | Use per-competition OBS |
| Event broadcasts | `this.io.emit(...)` | `this.io.to('competition:${compId}').emit(...)` |

---

## 4. Socket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `loadRundown` | Client → Server | Request to load rundown from Firebase |
| `timesheetState` | Server → Client | Full state update |
| `timesheetTick` | Server → Client | Real-time timing updates |
| `timesheetSegmentActivated` | Server → Client | Segment changed |
| `timesheetShowStarted` | Server → Client | Show started |
| `timesheetShowStopped` | Server → Client | Show stopped |

---

## 5. Segment Data Mapping

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

## 6. Task Breakdown

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

- [ ] **I.1** Detect rundown changes in Firebase during show
- [ ] **I.2** Show "Rundown Modified" warning in Producer View
- [ ] **I.3** Add "Reload Rundown" action (with confirmation)
- [ ] **I.4** Preserve current segment position on reload
- [ ] **I.5** Option to block edits during live show

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

## 7. Open Questions

| Question | Status | Decision |
|----------|--------|----------|
| Quick scenes configuration - per-competition or global? | Open | Likely per-competition in Firebase |
| Should graphics fire via Firebase or socket.io? | Open | Currently socket.io only - may need both |
| AI service provider for suggestions/context? | Open | Claude API, OpenAI, or custom rules engine? |
| Audio playback mechanism? | Open | OBS media source, separate player, or browser? |
| Talent View mobile optimization? | Open | Responsive design or separate mobile app? |
| Rehearsal mode - same view or separate route? | Open | Likely same views with "REHEARSAL" badge |

---

## 8. Reference APIs

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
