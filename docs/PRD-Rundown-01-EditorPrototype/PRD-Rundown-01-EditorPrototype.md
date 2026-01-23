# PRD-Rundown-01: Editor Prototype

**Version:** 2.0
**Date:** 2026-01-22
**Status:** COMPLETE
**Depends On:** PRD-Graphics-Registry
**Blocks:** PRD-Rundown-02, PRD-Rundown-03, PRD-Rundown-04

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)

---

## Overview

This PRD covers the Rundown Editor prototype - a **UI prototype phase** to validate UX before full implementation.

### Purpose of This Page

The Rundown Editor is a **show planning/setup tool** used BEFORE the live broadcast:

1. **Map out the show structure** - Define segments in order (intro, team intros, rotations, etc.)
2. **Associate each segment with an OBS scene** - Which camera/view to use
3. **Associate each segment with a graphic** - Which graphic to display from the graphics system
4. **Save as templates** - Reusable rundown structures for dual meets, quad meets, etc.

The **Producer View** (separate page) uses this rundown as the "script" to control OBS and trigger graphics during the live show. This page does NOT control OBS directly.

### Key Design Goals

1. **Scalability** - Adding new graphics should NOT require changes to this page
2. **Smart Recommendations** - Suggest graphics based on segment names
3. **Abstract Templates** - Rundowns should work across different competitions (team1, team2 adapt to actual teams)
4. **Competition-Aware** - Filter graphics/options based on competition type (men's vs women's, team count)

---

## Phases

### Phase 0A: Basic Page Structure ✅ COMPLETE
- Main `RundownEditorPage.jsx` component
- Route setup at `/{compId}/rundown`
- Page layout with split panel design
- Toolbar with action buttons (placeholders)
- Basic segment CRUD with hardcoded data

### Phase 0B: Graphics & Scene Integration (COMPLETE)
- Graphics picker using schema-driven registry
- OBS scene picker (hardcoded scenes for prototype)
- Smart recommendations based on segment names
- Segment data structure includes graphic + params

### Phase 0C: Templates (Future)
- Save rundown as template
- Load template for new competition
- Abstract format (team1, team2 adapt to actual teams)

---

## Scope (Phase 0B)

### In Scope
- Graphics picker integration (reads from `graphicsRegistry.js`)
- Scene picker integration (hardcoded scenes for now)
- Smart graphic recommendations based on segment name
- Updated segment data structure with `graphic` field
- Competition context (type, team names) passed to pickers

### Out of Scope
- Firebase persistence (future phase)
- Real OBS scene sync (scenes will come from OBS during competition setup)
- Template save/load (Phase 0C)

---

## Route

```
/{compId}/rundown
```

Example: `/pac12-2025/rundown`

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RUNDOWN EDITOR                        Women's Quad Meet                 │
│  UCLA vs Oregon vs Utah vs Arizona                [Save] [Export CSV]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ TOOLBAR ───────────────────────────────────────────────────────────┐│
│  │[+ Add Segment] [Templates ▼] [Import CSV] [↻ Sync OBS]              ││
│  │                                                                      ││
│  │ Filter: [All Types ▼]  Search: [____________]                       ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─ SEGMENT LIST ───────────────────────┬─ DETAIL PANEL ───────────────┐│
│  │                                       │                              ││
│  │  (SegmentList component)              │  (SegmentDetail component)   ││
│  │                                       │                              ││
│  │                                       │                              ││
│  └───────────────────────────────────────┴──────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```
RundownEditorPage.jsx
├── Header (title, competition name, save/export buttons)
├── Toolbar
│   ├── + Add Segment button
│   ├── Templates dropdown (placeholder)
│   ├── Import CSV button (placeholder)
│   ├── Sync OBS button (placeholder)
│   ├── Type filter dropdown
│   └── Search input
├── Main Content (split panel)
│   ├── SegmentList (left, ~60% width)
│   └── SegmentDetail (right, ~40% width)
└── SelectionSummary (conditional, shown when multi-select active)
```

---

## State Management

The page manages the following local state (prototype phase - no persistence):

```javascript
const [segments, setSegments] = useState(DUMMY_SEGMENTS);
const [selectedSegmentId, setSelectedSegmentId] = useState(null);
const [selectedSegmentIds, setSelectedSegmentIds] = useState([]); // multi-select
const [filterType, setFilterType] = useState('all');
const [searchQuery, setSearchQuery] = useState('');
```

---

## Hardcoded Test Data

### Competition Context (Prototype)

```javascript
const DUMMY_COMPETITION = {
  id: 'pac12-2025',
  name: "Women's Quad Meet",
  type: 'womens-quad',
  teams: {
    1: { name: 'UCLA', logo: 'https://...' },
    2: { name: 'Oregon', logo: 'https://...' },
    3: { name: 'Utah', logo: 'https://...' },
    4: { name: 'Arizona', logo: 'https://...' },
  },
};

const DUMMY_SCENES = [
  { name: 'Starting Soon', category: 'static' },
  { name: 'Talent Camera', category: 'manual' },
  { name: 'Graphics Fullscreen', category: 'graphics' },
  { name: 'Single - Camera 1', category: 'single' },
  { name: 'Single - Camera 2', category: 'single' },
  { name: 'Single - Camera 3', category: 'single' },
  { name: 'Single - Camera 4', category: 'single' },
  { name: 'Dual View', category: 'multi' },
  { name: 'Quad View', category: 'multi' },
];
```

### Segments (Updated Structure)

```javascript
const DUMMY_SEGMENTS = [
  {
    id: 'seg-001',
    name: 'Show Intro',
    type: 'video',
    duration: 45,
    scene: 'Starting Soon',
    graphic: null,  // No graphic for this segment
    autoAdvance: true,
  },
  {
    id: 'seg-002',
    name: 'Team Logos',
    type: 'static',
    duration: 10,
    scene: 'Graphics Fullscreen',
    graphic: {
      graphicId: 'logos',
      params: {},  // Params auto-filled from competition
    },
    autoAdvance: true,
  },
  {
    id: 'seg-003',
    name: 'UCLA Coaches',
    type: 'live',
    duration: 15,
    scene: 'Single - Camera 2',
    graphic: {
      graphicId: 'team-coaches',
      params: { teamSlot: 1 },  // Abstract - team 1 = UCLA in this competition
    },
    autoAdvance: true,
  },
  {
    id: 'seg-004',
    name: 'Rotation 1 Summary',
    type: 'static',
    duration: 20,
    scene: 'Graphics Fullscreen',
    graphic: {
      graphicId: 'event-summary',
      params: {
        summaryMode: 'rotation',
        summaryRotation: 1,
        summaryTheme: 'espn',
      },
    },
    autoAdvance: true,
  },
  {
    id: 'seg-005',
    name: 'Floor - Rotation 1',
    type: 'live',
    duration: null,
    scene: 'Quad View',
    graphic: {
      graphicId: 'floor',
      params: {},  // Event frame, no extra params
    },
    autoAdvance: false,
  },
];
```

### Key Points About Segment Structure

1. **`graphic` field** - Contains `graphicId` and `params` (or `null` if no graphic)
2. **Abstract params** - `teamSlot: 1` means "team 1" which adapts to whatever team is in slot 1
3. **Auto-filled params** - Params like `team1Logo` are filled from competition config at runtime
4. **Template-friendly** - This structure works when saved as a template and loaded for a different competition

---

## Props Passed to Child Components

### To SegmentList
```javascript
<SegmentList
  segments={filteredSegments}
  selectedSegmentId={selectedSegmentId}
  selectedSegmentIds={selectedSegmentIds}
  onSelectSegment={handleSelectSegment}
  onMultiSelect={handleMultiSelect}
  onReorder={handleReorder}
  onAddSegment={handleAddSegment}
/>
```

### To SegmentDetail
```javascript
<SegmentDetail
  segment={selectedSegment}
  competition={DUMMY_COMPETITION}      // For graphics picker context
  scenes={DUMMY_SCENES}                // For scene picker
  onSave={handleSaveSegment}
  onDelete={handleDeleteSegment}
  onCancel={handleCancelEdit}
/>
```

---

## Segment Detail Panel (Phase 0B)

The detail panel includes pickers for scene and graphic selection.

### Layout

```
┌─ EDIT SEGMENT ──────────────────────────────────────────────────────────────┐
│                                                                              │
│  Segment Name    [UCLA Coaches________________]                              │
│                                                                              │
│  Type            [live ▼]         Duration    [15] seconds                   │
│                                                                              │
│  ┌─ OBS SCENE ─────────────────────────────────────────────────────────────┐│
│  │  Scene         [Single - Camera 2 ▼]                                     ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ GRAPHIC ───────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  💡 Suggested: UCLA Coaches (based on segment name)          [Use]       ││
│  │                                                                          ││
│  │  Graphic       [UCLA Coaches ▼]                                          ││
│  │                ┌──────────────────────────────────────┐                  ││
│  │                │ (None)                                │                  ││
│  │                │ ─── Pre-Meet ─────────────────────── │                  ││
│  │                │ Team Logos                            │                  ││
│  │                │ UCLA Coaches                      ✓   │                  ││
│  │                │ Oregon Coaches                        │                  ││
│  │                │ Utah Coaches                          │                  ││
│  │                │ Arizona Coaches                       │                  ││
│  │                │ ─── Event Frames ────────────────── │                  ││
│  │                │ Vault Frame                           │                  ││
│  │                │ Uneven Bars Frame                     │                  ││
│  │                │ ...                                   │                  ││
│  │                └──────────────────────────────────────┘                  ││
│  │                                                                          ││
│  │  ─── Parameters ───────────────────────────────────────────────────────  ││
│  │  (Shown only if graphic has user-editable params)                        ││
│  │                                                                          ││
│  │  Team          [UCLA (Team 1) ▼]                                         ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  [ ] Auto-advance when duration ends                                         │
│                                                                              │
│  [Cancel]                                              [Save Changes]        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Smart Recommendations

When the segment name contains keywords, suggest a matching graphic:

| Segment Name Contains | Suggested Graphic |
|----------------------|-------------------|
| Team name + "coaches" | That team's coaches graphic |
| Team name + "stats" | That team's stats graphic |
| "logos", "matchup" | Team Logos |
| "rotation" + number | Event Summary (rotation mode) |
| "floor", "vault", etc. | Event frame for that apparatus |
| "summary", "recap" | Event Summary |
| "leaderboard", "standings" | Leaderboard graphic |

### Graphics Dropdown Behavior

1. **Reads from registry** - Uses `getAllGraphicsForCompetition(compType, teamNames)`
2. **Filtered by competition** - Only shows graphics valid for this competition type
3. **Team names displayed** - Shows "UCLA Coaches" not "Team 1 Coaches"
4. **Grouped by category** - Pre-Meet, Event Frames, Leaderboards, etc.
5. **(None) option** - First option to clear graphic selection

### Parameter Inputs

When a graphic is selected, check if it has user-editable params:

- **Simple graphics** (logos, replay) - No params shown, auto-filled from competition
- **Team-specific graphics** (coaches, stats) - Show team selector dropdown
- **Complex graphics** (event-summary) - Show mode, rotation/apparatus, theme dropdowns

Parameter inputs are generated from the graphic's schema in `graphicsRegistry.js`.

---

## Event Handlers (Prototype Behavior)

| Handler | Behavior |
|---------|----------|
| `handleSelectSegment(id)` | Sets `selectedSegmentId`, clears multi-select |
| `handleMultiSelect(ids)` | Sets `selectedSegmentIds` array |
| `handleReorder(fromIndex, toIndex)` | Reorders segments in local state |
| `handleAddSegment()` | Inserts new segment after selected (or at end) |
| `handleSaveSegment(segment)` | Updates segment in local state, shows toast |
| `handleDeleteSegment(id)` | Removes from local state after confirmation |
| `handleCancelEdit()` | Clears selection |

---

## Toolbar Buttons

| Button | Prototype Behavior |
|--------|-------------------|
| + Add Segment | Calls `handleAddSegment()` |
| Templates | Shows "Coming soon" toast |
| Import CSV | Shows "Coming soon" toast |
| Sync OBS | Shows "Coming soon" toast |
| Save | Shows "Rundown saved" toast (no actual persistence) |
| Export CSV | Shows "Coming soon" toast |

---

## Filter & Search

**Type Filter Options:**
- All Types
- video
- live
- static
- break
- hold
- graphic

**Search:** Filters by segment name (case-insensitive substring match)

```javascript
const filteredSegments = segments.filter(seg => {
  const matchesType = filterType === 'all' || seg.type === filterType;
  const matchesSearch = seg.name.toLowerCase().includes(searchQuery.toLowerCase());
  return matchesType && matchesSearch;
});
```

---

## File to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/pages/RundownEditorPage.jsx` | 250-300 | Main editor page |

---

## File to Modify

| File | Changes |
|------|---------|
| `show-controller/src/App.jsx` | Add route: `<Route path="/:compId/rundown" element={<RundownEditorPage />} />` |

---

## Acceptance Criteria

### Phase 0A (COMPLETE)
- [x] Route `/{compId}/rundown` renders RundownEditorPage
- [x] Page header shows "RUNDOWN EDITOR" and competition name placeholder
- [x] Toolbar renders with all buttons (+ Add Segment, Templates, Import CSV, Sync OBS)
- [x] Type filter dropdown shows all 6 segment types + "All Types"
- [x] Search input filters segment list by name
- [x] Split panel layout: SegmentList on left (~60%), SegmentDetail on right (~40%)
- [x] Placeholder text shown in SegmentDetail when no segment selected
- [x] "Coming soon" toast shown for unimplemented features
- [x] Page uses hardcoded DUMMY_SEGMENTS data

### Phase 0B (COMPLETE)
- [x] Segment detail shows Scene picker dropdown
- [x] Scene picker shows hardcoded scenes grouped by category
- [x] Segment detail shows Graphic picker dropdown
- [x] Graphic picker reads from `graphicsRegistry.js`
- [x] Graphics filtered by competition type (women's quad)
- [x] Team-specific graphics show actual team names (UCLA, Oregon, etc.)
- [x] Smart recommendation shown when segment name matches keywords
- [x] Clicking "Use" on recommendation selects that graphic
- [x] Parameter inputs shown for graphics that have user-editable params
- [x] Segments save with `graphic: { graphicId, params }` structure
- [x] Segment list shows graphic indicator (icon or badge) when graphic assigned

---

## Dependencies

- **PRD-Graphics-Registry** - Required for GraphicsPicker to read graphic definitions and schemas

---

## Next Steps

After Phase 0B is complete:
1. Continue prototyping to refine UX
2. Phase 0C: Templates (save/load rundowns)
3. PRD-Rundown-02, 03, 04: Extract components for reuse
