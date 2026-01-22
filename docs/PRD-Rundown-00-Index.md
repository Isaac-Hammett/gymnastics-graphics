# Advanced Rundown Editor - PRD Index

**Last Updated:** 2026-01-21
**Original PRD:** `PRD-AdvancedRundownEditor-2026-01-16.md`

---

## Overview

The Advanced Rundown Editor PRD has been broken down into 7 smaller, focused PRDs. Each PRD is designed to be implemented and tested independently, with clear dependencies.

Each PRD has its own folder with:
- `PRD-Rundown-XX-FeatureName.md` - Requirements and acceptance criteria
- `IMPLEMENTATION-PLAN.md` - Task breakdown (Claude updates this)
- `prompt-Rundown-XX-feature-name.md` - The prompt for the Ralph loop
- `Rundown-XX-feature-name-run.sh` - The loop script
- `logs/` - Output log directory

---

## PRD Breakdown

| PRD | Title | Status | Priority | Effort |
|-----|-------|--------|----------|--------|
| [01](PRD-Rundown-01-DataModel/) | Data Model & Backend | Not Started | P0 | Medium |
| [02](PRD-Rundown-02-Milestones/) | Milestones System | Not Started | P1 | Small |
| [03](PRD-Rundown-03-SegmentEditor/) | Segment Editor UI | Not Started | P0 | Large |
| [04](PRD-Rundown-04-Pickers/) | Pickers (Scene, Audio, Graphics) | Not Started | P1 | Medium |
| [05](PRD-Rundown-05-ProducerIntegration/) | Producer View Integration | Not Started | P1 | Medium |
| [06](PRD-Rundown-06-Templates/) | Template System | Not Started | P2 | Medium |
| [07](PRD-Rundown-07-ImportExport/) | Import/Export | Not Started | P3 | Small |

---

## Dependency Graph

```
PRD-01: Data Model (FOUNDATION)
    │
    ├── PRD-02: Milestones ────────────┐
    │                                   │
    ├── PRD-03: Segment Editor ─────────┼── PRD-06: Templates
    │       │                           │
    │       └── PRD-04: Pickers ────────┘
    │               │
    │               └── PRD-05: Producer Integration
    │
    └── PRD-07: Import/Export
```

---

## Recommended Implementation Order

### Phase A: Foundation
1. **PRD-01: Data Model & Backend** - Segment schema, Firebase structure, API routes
2. **PRD-02: Milestones System** - Milestone types, auto-detection, timeline

### Phase B: Core Editor
3. **PRD-03: Segment Editor UI** - Main editor page, segment list, detail panel
4. **PRD-04: Pickers** - OBS scene, transition, audio, graphics pickers

### Phase C: Integration
5. **PRD-05: Producer View Integration** - Now Playing, Up Next, Show Progress

### Phase D: Advanced Features
6. **PRD-06: Templates** - Rundown templates, variable substitution, auto-load
7. **PRD-07: Import/Export** - CSV and JSON import/export

---

## System Integration

The Rundown Editor integrates with multiple existing systems:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RUNDOWN EDITOR                                    │
│                                                                          │
│  Segment Configuration:                                                  │
│  - OBS Scene (from OBS State Sync)                                      │
│  - Graphic (from Graphics Registry)                                     │
│  - Transition (from OBS State Sync)                                     │
│  - Audio Mix (from OBS Audio Sources)                                   │
│  - Camera (from Camera Config)                                          │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   OBS Studio    │  │ Graphics        │  │ Firebase        │
│   (via OBS      │  │ Registry        │  │ Camera Config   │
│   Connection    │  │                 │  │                 │
│   Manager)      │  │                 │  │                 │
│                 │  │                 │  │                 │
│ - Scenes        │  │ - All graphics  │  │ - Camera list   │
│ - Transitions   │  │ - Categories    │  │ - Apparatus     │
│ - Audio sources │  │ - Parameters    │  │ - Health        │
│ - Inputs        │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Key Principle:** No hardcoded lists. Everything pulled dynamically from source systems.

**Architecture Note:** Frontend NEVER connects directly to OBS. All OBS commands flow through the coordinator via Socket.io (see [README-OBS-Architecture.md](README-OBS-Architecture.md)).

---

## Firebase Structure

```
competitions/{compId}/production/
├── rundown/
│   ├── segments: [...]              # Ordered segment array
│   ├── lastModified: timestamp
│   ├── lastModifiedBy: "email"
│   └── version: number
│
├── editing/                         # Real-time collaboration
│   ├── activeEditors: {...}
│   └── locks: {...}
│
└── graphicsQueue/
    ├── current: null
    └── queue: [...]

templates/rundown/{meetType}/{templateId}
├── id: string
├── meetType: string
├── name: string
├── segments: [...]
└── metadata: {...}

system/graphics/registry                 # Graphics definitions
├── metadata: {...}
├── categories: {...}
└── graphics: {...}
```

---

## Code Inventory (Planned)

### Backend (server/)
| File | PRD | Purpose |
|------|-----|---------|
| `lib/rundownService.js` | 01 | Rundown business logic |
| `lib/milestoneCalculator.js` | 02 | Milestone detection |
| `lib/graphicsRegistry.js` | 04 | Graphics registry access |
| `lib/rundownTemplateService.js` | 06 | Template management |
| `routes/rundown.js` | 01 | API routes |

### Frontend (show-controller/src/)
| File | PRD | Purpose |
|------|-----|---------|
| `pages/RundownEditor.jsx` | 03 | Main editor page |
| `components/rundown/SegmentList.jsx` | 03 | Segment list |
| `components/rundown/SegmentDetail.jsx` | 03 | Detail panel |
| `components/rundown/MilestoneTimeline.jsx` | 02 | Timeline component |
| `components/rundown/SelectionSummary.jsx` | 03 | Selection summary |
| `components/rundown/pickers/ScenePicker.jsx` | 04 | OBS scene picker |
| `components/rundown/pickers/TransitionPicker.jsx` | 04 | Transition picker |
| `components/rundown/pickers/AudioPicker.jsx` | 04 | Audio preset picker |
| `components/rundown/pickers/GraphicsPicker.jsx` | 04 | Graphics picker |
| `components/rundown/NowPlaying.jsx` | 05 | Now playing component |
| `components/rundown/UpNext.jsx` | 05 | Up next component |
| `components/rundown/ShowProgress.jsx` | 05 | Progress list |
| `hooks/useRundown.js` | 03 | Rundown hook |
| `context/RundownContext.jsx` | 03 | Rundown context |

---

## Dependencies on Existing Systems

This PRD suite depends on:

1. **OBS Integration Tool** (PRD-OBS-*)
   - OBS State Sync for scene/transition/audio data
   - Socket.io events for real-time OBS state
   - Audio presets from Firebase

2. **Graphics System** (existing)
   - Graphics registry at `system/graphics/registry`
   - Graphic rendering via `output.html`

3. **Competition Context** (existing)
   - Competition ID from URL
   - Team information
   - Gender configuration

4. **Firebase Realtime Database** (existing)
   - Real-time sync for collaboration
   - Persistent storage for rundowns

---

## Success Criteria

When all PRDs are complete:
- [ ] Segment CRUD operations work
- [ ] OBS Scene picker lists scenes from OBS State Sync
- [ ] Graphics picker lists graphics from registry, filters by gender
- [ ] Audio picker lists presets from Firebase
- [ ] Milestones auto-detect and display on timeline
- [ ] Multi-select with time calculation works
- [ ] Templates can be saved and loaded
- [ ] CSV import/export works
- [ ] Real-time sync between multiple users
- [ ] Producer view shows Now Playing and Up Next

---

## Related Documents

- [Original PRD](PRD-AdvancedRundownEditor-2026-01-16.md) - Full specification
- [README-OBS-Architecture.md](README-OBS-Architecture.md) - OBS connection architecture
- [PRD-OBS-00-Index.md](PRD-OBS-00-Index.md) - OBS Integration PRDs
- [CLAUDE.md](../CLAUDE.md) - MCP tools and deploy instructions
