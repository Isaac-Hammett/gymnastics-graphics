# Advanced Rundown Editor - PRD Index

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](./PRD-AdvancedRundownEditor-2026-01-22.md)

This index lists all sub-PRDs that break down the Advanced Rundown Editor into implementable pieces.

---

## Implementation Phases Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 0A: UI Prototype (Hardcoded)                                          │
│ ├─ PRD-01: Editor Page Structure                                            │
│ ├─ PRD-02: Segment List Component                                           │
│ ├─ PRD-03: Segment Detail Component                                         │
│ └─ PRD-04: Picker Components                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 0B: Producer Preview                                                  │
│ └─ PRD-05: Producer Preview Test Page                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Backend Services                                                   │
│ └─ PRD-06: Backend Services (CRUD, Milestones, Graphics Registry)           │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Frontend Integration                                               │
│ └─ PRD-07: Connect to Real Data Sources                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Producer View Integration                                          │
│ └─ PRD-08: Full Producer View Integration                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Advanced Features (Parallel)                                       │
│ ├─ PRD-09: Template System                                                  │
│ └─ PRD-10: Import/Export                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PRD List

### Phase 0A: UI Prototype

| PRD | Folder | Description | Depends On |
|-----|--------|-------------|------------|
| [PRD-Rundown-01](./PRD-Rundown-01-EditorPrototype/PRD-Rundown-01-EditorPrototype.md) | PRD-Rundown-01-EditorPrototype | Main editor page layout, route setup, toolbar | None |
| [PRD-Rundown-02](./PRD-Rundown-02-SegmentList/PRD-Rundown-02-SegmentList.md) | PRD-Rundown-02-SegmentList | Segment list table with selection, reordering | PRD-01 |
| [PRD-Rundown-03](./PRD-Rundown-03-SegmentDetail/PRD-Rundown-03-SegmentDetail.md) | PRD-Rundown-03-SegmentDetail | Detail panel form for create/edit | PRD-01, PRD-04 |
| [PRD-Rundown-04](./PRD-Rundown-04-Pickers/PRD-Rundown-04-Pickers.md) | PRD-Rundown-04-Pickers | Scene, Transition, Graphics, Audio pickers | PRD-01 |

### Phase 0B: Producer Preview

| PRD | Folder | Description | Depends On |
|-----|--------|-------------|------------|
| [PRD-Rundown-05](./PRD-Rundown-05-ProducerPreview/PRD-Rundown-05-ProducerPreview.md) | PRD-Rundown-05-ProducerPreview | Temporary test page for combined UX | PRD-01 through 04 |

### Phase 1: Backend Services

| PRD | Folder | Description | Depends On |
|-----|--------|-------------|------------|
| [PRD-Rundown-06](./PRD-Rundown-06-BackendServices/PRD-Rundown-06-BackendServices.md) | PRD-Rundown-06-BackendServices | Firebase CRUD, milestone calculator, API routes | Phase 0 complete |

### Phase 2: Frontend Integration

| PRD | Folder | Description | Depends On |
|-----|--------|-------------|------------|
| [PRD-Rundown-07](./PRD-Rundown-07-FrontendIntegration/PRD-Rundown-07-FrontendIntegration.md) | PRD-Rundown-07-FrontendIntegration | useRundown hook, context, connect pickers | PRD-06 |

### Phase 3: Producer Integration

| PRD | Folder | Description | Depends On |
|-----|--------|-------------|------------|
| [PRD-Rundown-08](./PRD-Rundown-08-ProducerIntegration/PRD-Rundown-08-ProducerIntegration.md) | PRD-Rundown-08-ProducerIntegration | OBS sync, graphics triggers, inline editing | PRD-07 |

### Phase 4: Advanced Features

| PRD | Folder | Description | Depends On |
|-----|--------|-------------|------------|
| [PRD-Rundown-09](./PRD-Rundown-09-Templates/PRD-Rundown-09-Templates.md) | PRD-Rundown-09-Templates | Save/load templates, variable substitution | PRD-06, PRD-07 |
| [PRD-Rundown-10](./PRD-Rundown-10-ImportExport/PRD-Rundown-10-ImportExport.md) | PRD-Rundown-10-ImportExport | CSV/JSON import and export | PRD-06, PRD-07 |

---

## Dependency Graph

```
PRD-01 (Editor Prototype)
    │
    ├── PRD-02 (Segment List)
    │       │
    ├── PRD-04 (Pickers)
    │       │
    └── PRD-03 (Segment Detail) ←── depends on PRD-04
            │
            └── PRD-05 (Producer Preview) ←── depends on all Phase 0A

PRD-06 (Backend Services) ←── can start after Phase 0
    │
    └── PRD-07 (Frontend Integration)
            │
            ├── PRD-08 (Producer Integration)
            │
            ├── PRD-09 (Templates) ──┐
            │                        ├── can run in parallel
            └── PRD-10 (Import/Export) ─┘
```

---

## Estimated File Count by Phase

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| Phase 0A | ~12 | 1 (App.jsx) |
| Phase 0B | ~3 | 1 (App.jsx) |
| Phase 1 | 4 | 1 (server/index.js) |
| Phase 2 | 6 | 5 |
| Phase 3 | 4 | 3 (+ delete 1) |
| Phase 4 | 7 | 2 |
| **Total** | **~36** | **~13** |

---

## Quick Reference: Key Files

### Frontend Components
- `show-controller/src/pages/RundownEditorPage.jsx` - Main editor page
- `show-controller/src/components/rundown/SegmentList.jsx` - Segment table
- `show-controller/src/components/rundown/SegmentDetail.jsx` - Edit form
- `show-controller/src/components/rundown/pickers/*.jsx` - Picker components

### Backend Services
- `server/lib/rundownService.js` - CRUD operations
- `server/lib/milestoneCalculator.js` - Milestone detection
- `server/lib/graphicsRegistry.js` - Graphics registry access
- `server/lib/rundownTemplateService.js` - Template management
- `server/routes/rundown.js` - API routes

### Hooks & Context
- `show-controller/src/hooks/useRundown.js` - Rundown data operations
- `show-controller/src/context/RundownContext.jsx` - Shared state

---

## Implementation Order Recommendation

1. **Start with PRD-01** - Get the page structure up
2. **PRD-04 next** - Build pickers (needed by PRD-03)
3. **PRD-02 and PRD-03** - Core list and detail components
4. **PRD-05** - Quick test of combined UX
5. **PRD-06** - Build backend (can parallelize with frontend polish)
6. **PRD-07** - Wire it all together
7. **PRD-08** - Full production integration
8. **PRD-09 and PRD-10** - Advanced features (parallel)

---

## Related Documents

- [PRD-Rundown-00-Timesheet](./PRD-Rundown-00-Timesheet/) - Completed prerequisite (Timesheet Consolidation)
- [README-OBS-Architecture.md](./README-OBS-Architecture.md) - OBS connection architecture
- [PRD-OBS-*](.) - OBS Integration Tool PRDs
