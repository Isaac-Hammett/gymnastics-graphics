# Rundown System - Consolidated Plan

**Version:** 1.0
**Date:** 2026-01-23
**Status:** ACTIVE - Single Source of Truth

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

### 1.1 Core Concepts

| Term | Definition | Location |
|------|------------|----------|
| **Rundown** | The planned show structure - a list of segments with timing, scenes, graphics | Firebase: `competitions/{compId}/production/rundown/segments` |
| **Rundown Editor** | UI for creating and editing the Rundown (planning tool) | Route: `/{compId}/rundown` |
| **Show Engine** | Server-side execution engine that runs the show | `server/lib/timesheetEngine.js` |
| **Timesheet** | The execution UI in Producer View showing live show progress | Components in Producer View |
| **Producer View** | Full production control page | Route: `/{compId}/producer` |
| **Talent View** | Simplified view for commentators (planned) | Route: `/{compId}/talent` |

### 1.2 Timesheet UI Components (in Producer View)

| Component | What It Shows | File |
|-----------|---------------|------|
| **Now Playing** | Current segment with timer, progress bar | `CurrentSegment.jsx` |
| **Up Next** | Next segment preview | `NextSegment.jsx` |
| **Show Control** | Previous/Next/Pause buttons | Part of `ProducerView.jsx` |
| **Show Progress** | Segment list with completion status | `RunOfShow.jsx` |

### 1.3 Data Flow

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
                                    │ "Load Rundown" (not yet implemented)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXECUTION                                       │
│                                                                              │
│   Show Engine (server/lib/timesheetEngine.js)                               │
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

## 2. What Exists Today

### 2.1 Completed Components

| Component | Status | Description |
|-----------|--------|-------------|
| **Show Engine** | ✅ Complete | `server/lib/timesheetEngine.js` - full execution engine with segment progression, OBS switching, graphics firing, hold segments |
| **useTimesheet Hook** | ✅ Complete | `hooks/useTimesheet.js` - client hook providing all timing state and actions |
| **Producer View** | ✅ Complete | Full production control with Timesheet UI |
| **Timesheet UI** | ✅ Complete | Now Playing, Up Next, Show Control, Show Progress - all using `useTimesheet()` |
| **Rundown Editor** | ✅ Phases 0-8 Complete | UI for creating/editing segments with graphics picker, templates, collaboration features |

### 2.2 Rundown Editor Features (Completed)

From `RundownEditorPage.jsx`:

| Phase | Features | Status |
|-------|----------|--------|
| 0A | Page structure, segment CRUD | ✅ Done |
| 0B | Graphics picker, scene picker | ✅ Done |
| 0C | Template save/load | ✅ Done |
| 1 | Timing display, runtime totals | ✅ Done |
| 2 | Inline editing | ✅ Done |
| 3 | Multi-select, bulk actions | ✅ Done |
| 4 | Drag-drop reordering, grouping | ✅ Done |
| 5 | Duplicate, lock, optional toggles | ✅ Done |
| 6 | Timing modes (fixed/manual/follows-previous) | ✅ Done |
| 7 | Segment templates, recurrence | ✅ Done |
| 8 | Collaboration (presence, roles, approval workflow) | ✅ Done |

### 2.3 Missing: The Bridge

**The gap:** There is no connection between the Rundown Editor and the Show Engine.

- Rundown Editor saves segments to Firebase
- Show Engine has its own `showConfig.segments`
- No "Load Rundown" action exists to bridge them

---

## 3. What Needs to Be Built

### 3.1 Phase A: Connect Rundown Editor to Show Engine

**Goal:** Enable Producer to load a rundown from the Editor and execute it.

| Task | Description | Priority |
|------|-------------|----------|
| A.1 | Add `loadRundown` socket handler on server | P0 |
| A.2 | Add `loadRundown` action in ShowContext | P0 |
| A.3 | Add "Load Rundown" button in Producer View | P0 |
| A.4 | Create segment mapper (Editor format → Engine format) | P0 |
| A.5 | Show rundown status indicator (loaded, modified, etc.) | P1 |

**Segment Mapping Required:**

| Editor Field | Engine Field |
|--------------|--------------|
| `scene` | `obsScene` |
| `graphic.graphicId` | `graphic` |
| `graphic.params` | `graphicData` |
| `timingMode` | Affects `autoAdvance` |

### 3.2 Phase B: Talent View

**Goal:** Create a simplified view for commentators.

| Task | Description | Priority |
|------|-------------|----------|
| B.1 | Create `TalentView.jsx` page | P1 |
| B.2 | Current segment with prominent time remaining | P1 |
| B.3 | Scene switching buttons | P1 |
| B.4 | Next segment preview | P1 |
| B.5 | Notes display | P1 |
| B.6 | Add `/talent` route | P1 |

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

### 3.3 Phase C: AI Context (Future)

**Goal:** Enrich segments with live stats, talking points, and alerts.

| Task | Description | Priority |
|------|-------------|----------|
| C.1 | Create AIContextService stub | P2 |
| C.2 | Add `aiContextUpdated` socket event | P2 |
| C.3 | Create `useAIContext` hook | P2 |
| C.4 | Integrate with Virtius API for live stats | P3 |
| C.5 | Generate talking points | P3 |
| C.6 | Detect career highs, records | P3 |

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
│    {compId}/          │    │  │  Show Engine (timesheetEngine.js)        │ │
│      production/      │◄───┼──│                                          │ │
│        rundown/       │    │  │  - segments[]                            │ │
│          segments/    │    │  │  - currentIndex                          │ │
│                       │    │  │  - start/stop/advance/previous           │ │
│                       │    │  │  - OBS scene switching                   │ │
│                       │    │  │  - Graphics firing                       │ │
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

---

## 5. Implementation Plan

### 5.1 Immediate Priority: Phase A (Connect Editor to Engine)

```
Week 1: Core Connection
├── A.1: Add loadRundown socket handler
├── A.2: Add loadRundown action in ShowContext
├── A.3: Add "Load Rundown" button in Producer View
└── A.4: Create segment mapper

Week 2: Polish
├── A.5: Rundown status indicator
├── Testing: Verify segments load correctly
└── Testing: Verify show execution works with loaded rundown
```

### 5.2 Next: Phase B (Talent View)

```
Week 3: Talent View
├── B.1: Create TalentView.jsx page
├── B.2-B.5: Build UI components
└── B.6: Add route

Week 4: Testing & Polish
├── Test with real show
└── Gather feedback
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
| **Show Engine** | Server-side code that executes the show (formerly called "TimesheetEngine") |
| **Timesheet** | The execution UI in Producer View |
| **Load Rundown** | Action to fetch segments from Firebase and load into Show Engine |
| **Hold Segment** | A segment that waits for manual advance (no auto-advance) |

---

## 8. Success Criteria

### Phase A Complete When:
- [ ] Producer can click "Load Rundown" and segments appear in Timesheet
- [ ] "Start Show" begins execution with loaded segments
- [ ] Segment progression, OBS switching, graphics firing all work
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

---

## Appendix: Historical Context

This system evolved through multiple PRD iterations:

1. **PRD-Rundown-00-Timesheet** (Jan 2026) - Consolidated timesheet UI, created `useTimesheet()` hook
2. **PRD-Rundown-01-EditorPrototype** (Jan 2026) - Built Rundown Editor UI as standalone planning tool
3. **PRD-Rundown-Engine-Architecture** (Jan 2026) - Proposed connecting Editor to Engine

The original plan had 10+ sub-PRDs with overlapping scope. This consolidated document simplifies to 3 clear phases (A, B, C) with the Rundown Editor prototype already complete.
