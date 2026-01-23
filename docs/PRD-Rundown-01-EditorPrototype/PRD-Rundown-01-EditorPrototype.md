# PRD-Rundown-01: Editor Prototype

**Version:** 3.2
**Date:** 2026-01-23
**Status:** PROTOTYPE COMPLETE, FEATURES IN PROGRESS
**Depends On:** PRD-Graphics-Registry
**Blocks:** PRD-Rundown-02, PRD-Rundown-03, PRD-Rundown-04
**Related:** PRD-05 (Show Controller Prototype)

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)

---

## Overview

The Rundown Editor is a tool for building and managing timesheets for live broadcast shows. This document outlines the complete feature set for the editor's functionality, user experience, and workflow efficiency.

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

## Table of Contents

1. [Phases Overview](#phases-overview)
2. [Prototype Phases (Complete)](#prototype-phases-complete)
3. [Phase 1: Timing & Display](#phase-1-timing--display)
4. [Phase 2: Inline Editing](#phase-2-inline-editing)
5. [Phase 3: Multi-Select & Selection Summary](#phase-3-multi-select--selection-summary)
6. [Phase 4: Reordering & Organization](#phase-4-reordering--organization)
7. [Phase 5: Segment Management](#phase-5-segment-management)
8. [Phase 6: Timing Modes & Automation](#phase-6-timing-modes--automation)
9. [Phase 7: Templates & Presets](#phase-7-templates--presets)
10. [Phase 8: Collaboration](#phase-8-collaboration)
11. [Phase 9: Data & Reporting](#phase-9-data--reporting)
12. [Phase 10: Visual & UX](#phase-10-visual--ux)
13. [Phase 11: Quality of Life](#phase-11-quality-of-life)
14. [Phase 12: Advanced Planning Features](#phase-12-advanced-planning-features)
15. [Technical Specifications](#technical-specifications)
16. [Acceptance Criteria](#acceptance-criteria)

---

## Phases Overview

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 0A | Basic Page Structure | ✅ COMPLETE | Core page layout, routing, segment CRUD |
| 0B | Graphics & Scene Integration | ✅ COMPLETE | Pickers, smart recommendations, params |
| 0C | Templates (Basic) | ✅ COMPLETE | Save/load rundowns as templates |
| 1 | Timing & Display | ✅ COMPLETE | Runtime totals, running time, buffers |
| 2 | Inline Editing | 🔲 PLANNED | Edit fields directly on segment rows |
| 3 | Multi-Select & Summary | 🔲 PLANNED | Bulk selection with summary sidebar |
| 4 | Reordering & Organization | 🔲 PLANNED | Drag-drop, grouping, nesting |
| 5 | Segment Management | 🔲 PLANNED | Duplicate, lock, conditional, notes |
| 6 | Timing Modes | 🔲 PLANNED | Fixed/manual/follows-previous modes |
| 7 | Templates & Presets | 🔲 PLANNED | Segment templates, recurrence |
| 8 | Collaboration | 🔲 PLANNED | Multi-user, permissions, versioning |
| 9 | Data & Reporting | 🔲 PLANNED | Export, import rundowns |
| 10 | Visual & UX | 🔲 PLANNED | Timeline view, theming, print |
| 11 | Quality of Life | 🔲 PLANNED | Keyboard shortcuts, undo/redo |
| 12 | Advanced Planning | 🔲 PLANNED | AI suggestions, talent, equipment, sponsors |

> **Note:** Show Controller features (live execution, hard time markers, hotkeys, etc.) are documented in **PRD-05 (Show Controller Prototype)**.

---

## Prototype Phases (Complete)

### Phase 0A: Basic Page Structure ✅ COMPLETE

- Main `RundownEditorPage.jsx` component
- Route setup at `/{compId}/rundown`
- Page layout with split panel design
- Toolbar with action buttons (placeholders)
- Basic segment CRUD with hardcoded data

### Phase 0B: Graphics & Scene Integration ✅ COMPLETE

- Graphics picker using schema-driven registry
- OBS scene picker (hardcoded scenes for prototype)
- Smart recommendations based on segment names
- Segment data structure includes graphic + params

### Phase 0C: Templates (Basic) 🔲 PLANNED

- Save rundown as template
- Load template for new competition
- Abstract format (team1, team2 adapt to actual teams)

---

## Phase 1: Timing & Display

### 1.1 Total Runtime Display

**Description:** Always-visible sum of all segments in the rundown.

**Requirements:**
- Display total runtime prominently in the editor header
- Allow user to input a target duration for the show
- Show over/under indicator comparing actual total to target
- Visual warning states:
  - Green: Within acceptable range
  - Yellow: Approaching target limit
  - Red: Over target duration

**Location:** Editor header, next to "SEGMENTS (n)" count

---

### 1.2 Running Time Column

**Description:** Show cumulative start time for each segment.

**Requirements:**
- Display calculated start time based on all preceding segments
- Format as `H:MM:SS` or `M:SS` depending on total duration
- Auto-update when any segment duration changes
- Optional toggle to show/hide this column

**Example:**
| # | Segment | Start Time | Duration |
|---|---------|------------|----------|
| 01 | Show Intro | 0:00 | 45s |
| 02 | Team Logos | 0:45 | 10s |
| 03 | UCLA Coaches | 0:55 | 15s |

---

### 1.3 Auto-Calculate Impact

**Description:** When a segment's duration changes, show the impact on the rest of the show.

**Requirements:**
- Recalculate all subsequent start times immediately
- Update total runtime in real-time
- Optionally show a brief indicator of time added/removed

---

### 1.4 Buffer/Pad Time

**Description:** Optional gap between segments that counts toward total runtime but isn't a formal segment.

**Requirements:**
- Allow adding buffer time after any segment
- Buffer time contributes to total runtime and running time calculations
- Visual indicator for buffer (e.g., dashed line or subtle row)
- Editable inline or via segment settings

---

## Phase 2: Inline Editing

### 2.1 Inline Editable Fields

**Description:** Edit common segment properties directly on the segment row without opening the Edit Segment panel.

**Requirements:**

Each segment row displays the following editable fields inline:

| Field | UI Element | Interaction |
|-------|------------|-------------|
| OBS Scene | Dropdown | Click to open, select to change, auto-saves |
| Graphic | Dropdown | Click to open, select to change, auto-saves |
| Duration | Text input | Click to edit, Enter or blur to save |

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ≡  01  Show Intro                                                               │
│      [type]   [OBS Scene ▼]   [Graphic ▼]   [Duration]   ✎   ▲ ▼               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Field Descriptions:**
- `≡` — Drag handle for reordering
- `01` — Segment number
- `Show Intro` — Segment name (not inline editable)
- `[type]` — Type badge (graphic, live, static, break) — display only
- `[OBS Scene ▼]` — Dropdown for OBS scene selection
- `[Graphic ▼]` — Dropdown for graphic selection
- `[Duration]` — Editable duration field
- `✎` — Edit button to open full Edit Segment panel
- `▲ ▼` — Reorder arrows

---

### 2.2 Edit Button Behavior

**Description:** Opens the full Edit Segment side panel for detailed editing.

**Fields available in Edit Segment panel:**
- Segment Name
- Type
- Duration
- OBS Scene
- Graphic
- Auto-advance toggle
- Segment notes
- Conditional/optional flag
- Lock status

---

## Phase 3: Multi-Select & Selection Summary

### 3.1 Multi-Select Functionality

**Description:** Allow users to select multiple segments to view combined duration and perform bulk actions.

**Requirements:**
- Add checkbox to each segment row
- Support Shift+click for range selection
- Support Ctrl/Cmd+click for individual toggle
- "Select All" / "Deselect All" option in header

---

### 3.2 Selection Summary Sidebar

**Description:** When 2+ segments are selected, the sidebar displays a summary with editable durations for each selected segment.

**Layout:**
```
┌──────────────────────────────────────┐
│  Selection Summary              ✕    │
├──────────────────────────────────────┤
│                                      │
│  3 segments selected                 │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  01  Show Intro                │  │
│  │      graphic • Single - Cam 1  │  │
│  │      Duration         [45s]   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  02  Team Logos                │  │
│  │      static • Graphics Full    │  │
│  │      Duration         [10s]   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  03  UCLA Coaches              │  │
│  │      live • Single - Cam 2     │  │
│  │      Duration         [15s]   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ────────────────────────────────    │
│                                      │
│  Total                     1:10      │
│                                      │
├──────────────────────────────────────┤
│  [Bulk Edit Type]      [Delete All]  │
└──────────────────────────────────────┘
```

**Requirements:**
- Display count of selected segments
- List each selected segment with:
  - Segment number and name
  - Type badge and OBS scene (display only)
  - Editable duration field
- Show total duration of all selected segments
- Total updates in real-time as durations are edited
- Click segment name to scroll to that segment in the list

---

### 3.3 Sidebar State Behavior

| Selection State | Sidebar Display |
|-----------------|-----------------|
| No segments selected | Empty state or closed |
| 1 segment selected | Edit Segment panel (existing behavior) |
| 2+ segments selected | Selection Summary panel |

---

### 3.4 Bulk Actions

**Description:** Actions that can be performed on all selected segments simultaneously.

| Action | Description |
|--------|-------------|
| Bulk Edit Type | Change all selected segments to the same type |
| Bulk Edit OBS Scene | Set the same OBS scene for all selected segments |
| Bulk Edit Graphic | Set the same graphic for all selected segments |
| Bulk Duration Set | Set all selected segments to the same duration |
| Bulk Duration Adjust | Add or subtract time from all selected segments |
| Delete All | Remove all selected segments (with confirmation modal) |
| Duplicate All | Create copies of all selected segments |
| Group Selected | Create a new group containing selected segments |

---

## Phase 4: Reordering & Organization

### 4.1 Drag-and-Drop Reordering

**Description:** Allow segments to be reordered by dragging.

**Requirements:**
- Drag handle on the left side of each segment row
- Visual indicator showing drop position
- Smooth animation during drag
- Works alongside existing arrow buttons

---

### 4.2 Arrow Button Reordering

**Description:** Keep existing up/down arrow buttons for precise reordering.

**Requirements:**
- Up arrow moves segment one position higher
- Down arrow moves segment one position lower
- Disabled state when at top/bottom of list
- Keyboard accessible

---

### 4.3 Segment Grouping/Nesting

**Description:** Group related segments into collapsible blocks.

**Requirements:**
- Create named groups (e.g., "Rotation 1", "Opening Sequence")
- Collapse/expand groups
- Drag entire groups to reorder
- Group shows combined duration when collapsed
- Nested segments indent visually
- Groups can be color-coded

---

## Phase 5: Segment Management

### 5.1 Duplicate Segment

**Description:** Quick copy of an existing segment.

**Requirements:**
- Duplicate button on segment row or in context menu
- Duplicated segment appears immediately after original
- Duplicated segment name appends "(copy)" or increments number
- All properties copied including notes

---

### 5.2 Segment Locking

**Description:** Prevent accidental edits to finalized segments.

**Requirements:**
- Lock toggle on each segment
- Locked segments display lock icon
- Locked segments cannot be edited, moved, or deleted
- Unlock requires intentional action (click lock icon)
- Visual distinction for locked segments (e.g., muted colors, lock overlay)

---

### 5.3 Conditional/Optional Segments

**Description:** Mark segments as backup or "if time permits."

**Requirements:**
- Toggle to mark segment as conditional
- Visual indicator (e.g., dashed border, "optional" badge)
- Optional segments can be excluded from total runtime calculation (toggle)

> **Note:** Converting optional segments to regular segments during the live show is a Show Controller feature (PRD-05).

---

### 5.4 Segment Notes/Comments

**Description:** Internal production notes attached to segments.

**Requirements:**
- Notes field in Edit Segment panel
- Indicator icon on segment row when notes exist
- Hover or click to preview notes
- Notes do not appear on-air or in exported rundowns (configurable)

---

## Phase 6: Timing Modes & Automation

### 6.1 Flexible Timing Modes

**Description:** Different timing behaviors for segments.

| Mode | Description |
|------|-------------|
| Fixed Duration | Segment has set duration, auto-advances when complete |
| Manual | Segment waits for manual trigger to advance |
| Follows Previous | Segment starts immediately when previous ends (no gap) |

**Requirements:**
- Timing mode selector in Edit Segment panel
- Visual indicator of timing mode on segment row
- Manual segments show "MANUAL" badge

---

### 6.2 Auto-Advance Toggle

**Description:** Existing feature — segment automatically advances when duration ends.

**Requirements:**
- Checkbox in Edit Segment panel (existing)
- Consider surfacing this inline for quick toggling

---

## Phase 7: Templates & Presets

### 7.1 Segment Templates

**Description:** Save frequently used segment configurations for reuse.

**Requirements:**
- Save current segment as template
- Template library accessible from "Add Segment" flow
- Templates include: name pattern, type, duration, OBS scene, graphic, notes
- Edit and delete templates
- Organize templates into categories

---

### 7.2 Full Show Templates

**Description:** Save entire rundown structures as templates.

**Requirements:**
- Save current rundown as template
- Template library in "New Rundown" flow
- Templates include all segments and groups
- Duplicate and modify templates
- Share templates across team (if collaboration enabled)

---

### 7.3 Recurrence Patterns

**Description:** Repeat a segment or group a specified number of times.

**Requirements:**
- "Repeat" option when adding segment or group
- Specify number of repetitions
- Auto-increment names (e.g., "Rotation 1", "Rotation 2")
- Option to customize each instance after creation

---

## Phase 8: Collaboration

### 8.1 Multi-User Editing

**Description:** Real-time collaboration with multiple users.

**Requirements:**
- Multiple users can view and edit simultaneously
- Presence indicators showing who is viewing/editing
- Cursor/selection indicators for other users
- Conflict resolution for simultaneous edits
- User avatars or names displayed

---

### 8.2 Role-Based Permissions

**Description:** Different access levels for team members.

| Role | Permissions |
|------|-------------|
| Owner | Full access, can delete rundown, manage permissions |
| Producer | Edit all segments, lock/unlock, approve |
| Editor | Edit segments, cannot lock or approve |
| Viewer | View only, no edits |

---

### 8.3 Change History/Versioning

**Description:** Track all changes with ability to rollback.

**Requirements:**
- Log all edits with timestamp and user
- View change history in sidebar or modal
- Rollback to previous state
- Compare versions side-by-side
- Named version snapshots (e.g., "Pre-show final")

---

### 8.4 Comments/Chat

**Description:** Discuss specific segments with team.

**Requirements:**
- Comment thread on each segment
- @mention team members
- Resolve/unresolve comments
- Notification for new comments
- General rundown chat/notes area

---

### 8.5 Approval Workflow

**Description:** Formal approval process for rundowns.

| Status | Description |
|--------|-------------|
| Draft | Work in progress, fully editable |
| In Review | Submitted for approval, limited edits |
| Approved | Reviewed and approved, locked for edits |
| Locked | Final version, no edits allowed |

**Requirements:**
- Status indicator in header
- Submit for review action
- Approve/reject actions for reviewers
- Comments required for rejection
- Unlock requires owner permission

---

## Phase 9: Data & Reporting

### 9.1 Export Formats

**Description:** Export rundown in various formats.

| Format | Use Case |
|--------|----------|
| PDF | Print-friendly layout for paper rundowns |
| CSV | Spreadsheet editing, data analysis |
| JSON | Backup, API integration, import to other tools |
| XML | Broadcast industry standard integrations |

**Requirements:**
- Export button in header
- Format selection modal
- Customizable export options (include notes, include optional segments, etc.)

---

### 9.2 Import Rundown

**Description:** Import rundowns from external sources.

**Requirements:**
- Import from CSV (spreadsheet)
- Import from JSON (backup restore)
- Field mapping UI for CSV imports
- Validation and error reporting
- Preview before import

---

> **Note:** Post-show analytics features (actual vs planned comparison, deviation logs, historical trends) are documented in **PRD-05 (Show Controller Prototype)** since they require data collected during live execution.

---

## Phase 10: Visual & UX

### 10.1 Visual Timeline View

**Description:** Gantt-style horizontal view showing segment durations proportionally.

**Requirements:**
- Toggle between list view and timeline view
- Segments represented as horizontal bars
- Bar length proportional to duration
- Color-coded by type
- Clickable to select/edit
- Zoomable for long shows

> **Note:** Current time indicator during live show is a Show Controller feature (PRD-05).

---

### 10.2 Color Coding by Type

**Description:** Stronger visual differentiation by segment type.

**Requirements:**
- Row background colors by type (not just badges)
- Customizable color scheme
- Consistent colors in timeline view
- Accessible color choices (colorblind-friendly options)

**Default Colors:**
| Type | Color |
|------|-------|
| Graphic | Purple |
| Live | Green |
| Static | Blue |
| Break | Yellow/Orange |

---

### 10.3 Compact/Expanded View Toggle

**Description:** Show more segments with less detail when needed.

**Compact View:**
- Single line per segment
- Show only: number, name, type badge, duration
- Hide: OBS scene, graphic, notes indicator

**Expanded View:**
- Full segment row with all inline fields
- Current default view

---

### 10.4 Dark/Light Mode Toggle

**Description:** Theme options for different preferences.

**Requirements:**
- Toggle in settings or header
- Persist preference per user
- Smooth transition between modes
- Ensure readability in both modes

---

### 10.5 Print-Friendly View

**Description:** Clean layout optimized for printing.

**Requirements:**
- Accessible via export or print command
- Removes interactive elements
- Optimizes for paper (margins, page breaks)
- Includes header with show name, date, total runtime
- Optional: include notes, exclude optional segments

---

## Phase 11: Quality of Life

### 11.1 Keyboard Shortcuts

**Description:** Efficient navigation and editing via keyboard.

| Shortcut | Action |
|----------|--------|
| ↑ / ↓ | Navigate between segments |
| Enter | Open Edit Segment panel |
| Escape | Close panel, deselect |
| Ctrl/Cmd + D | Duplicate selected segment |
| Ctrl/Cmd + N | Add new segment |
| Ctrl/Cmd + S | Save rundown |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z | Redo |
| Delete / Backspace | Delete selected segment (with confirmation) |
| Shift + ↑ / ↓ | Extend selection |
| Ctrl/Cmd + A | Select all segments |

---

### 11.2 Undo/Redo

**Description:** Reverse and restore actions.

**Requirements:**
- Undo last action (Ctrl/Cmd + Z)
- Redo undone action (Ctrl/Cmd + Shift + Z)
- Undo/redo buttons in toolbar
- Support multiple levels of undo (minimum 20)
- Undo stack clears on save (optional)

---

### 11.3 Search and Filter

**Description:** Find and filter segments quickly.

**Requirements:**
- Search by segment name
- Filter by type
- Filter by OBS scene
- Filter by graphic
- Clear filters button
- Result count indicator

---

## Phase 12: Advanced Planning Features

> **Note:** Live execution features (AI talking points generation, live score integration, teleprompter display, audio cue triggering) are documented in **PRD-05 (Show Controller Prototype)**.

### 12.1 AI Segment Recommendations

**Description:** AI suggests segments to add based on competition context, making it easier to build complete rundowns.

**Context Triggers:**

| Context | AI Suggestion |
|---------|---------------|
| Senior meet | "Add Senior Recognition segment to honor graduating athletes?" |
| Championship meet | "Add Trophy Presentation segment?" |
| Rivalry meet (e.g., UCLA vs USC) | "Add Rivalry History segment with historical matchup stats?" |
| Team's first home meet of season | "Add Welcome Back / Season Opener segment?" |
| Holiday weekend (e.g., Valentine's) | "Add holiday-themed intro graphic?" |
| Seniors on roster | "UCLA has 3 seniors - add individual senior spotlights?" |
| All-American on roster | "Oregon's [athlete] is a returning All-American - feature segment?" |
| Injured athlete returning | "Utah's [athlete] returning from injury - comeback storyline?" |
| Record approaching | "Arizona's [athlete] is 2 routines from school record - milestone segment?" |

**Segment Order Suggestions:**

| Current State | AI Suggestion |
|---------------|---------------|
| Team intros after rotation 1 | "Team intros typically come before competition starts - move up?" |
| No break segments in 2-hour show | "Consider adding halftime/break segment around the midpoint?" |
| Missing rotation summary | "Add Rotation 1 Summary after all teams complete rotation 1?" |
| No leaderboard segments | "Add leaderboard check-in after rotation 2?" |

**Requirements:**
- Analyze competition metadata (type, teams, date, special designations)
- Query roster data for seniors, All-Americans, milestones
- Display suggestions in a non-intrusive "AI Suggestions" panel
- One-click to add suggested segment with pre-filled values
- Dismiss/snooze suggestions
- Learn from user patterns (if collaboration enabled)

---

### 12.2 Segment Script Field

**Description:** Basic script/notes field for pre-show planning of commentator talking points.

**Requirements:**
- Rich text field per segment for planning notes
- Supports bullet points, bold, italics
- Character/word count indicator
- Export scripts to PDF/document
- Visible in compact view as indicator icon

> **Note:** AI-generated talking points and teleprompter display are live execution features in PRD-05.

---

### 12.3 Audio Cue Planning

**Description:** Plan music/audio cues for segments during show planning.

**Requirements:**
- Audio cue field per segment (song name, file reference)
- In point and out point timestamps
- Visual indicator on segment row when audio cue planned
- Export audio cue sheet

> **Note:** Audio playback/triggering is a live execution feature in PRD-05.

---

### 12.4 Talent/Personnel Assignment

**Description:** Assign on-camera talent to segments for scheduling.

**Requirements:**
- Talent selector per segment
- Talent database/roster
- Multiple talent per segment
- Talent schedule view (who is on when)
- Warnings for talent conflicts
- Export talent schedule

---

### 12.5 Equipment Tracking

**Description:** Track which equipment is planned for each segment.

**Requirements:**
- Equipment fields: Camera, Microphone, Other
- Equipment database
- Equipment schedule view
- Warnings for equipment conflicts
- Export equipment schedule

---

### 12.6 Sponsor/Ad Inventory

**Description:** Track commercial obligations within rundown.

**Requirements:**
- Mark segments as sponsored
- Sponsor/advertiser field
- Ad duration requirements
- Fulfillment tracking
- Report on sponsor exposure

---

## Technical Specifications

### Route

```
/{compId}/rundown
```

Example: `/pac12-2025/rundown`

---

### Page Layout

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

### Component Structure

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

### State Management

The page manages the following local state (prototype phase - no persistence):

```javascript
const [segments, setSegments] = useState(DUMMY_SEGMENTS);
const [selectedSegmentId, setSelectedSegmentId] = useState(null);
const [selectedSegmentIds, setSelectedSegmentIds] = useState([]); // multi-select
const [filterType, setFilterType] = useState('all');
const [searchQuery, setSearchQuery] = useState('');
```

---

### Hardcoded Test Data (Prototype)

#### Competition Context

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

#### Segment Data Structure

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
  // ...more segments
];
```

#### Key Points About Segment Structure

1. **`graphic` field** - Contains `graphicId` and `params` (or `null` if no graphic)
2. **Abstract params** - `teamSlot: 1` means "team 1" which adapts to whatever team is in slot 1
3. **Auto-filled params** - Params like `team1Logo` are filled from competition config at runtime
4. **Template-friendly** - This structure works when saved as a template and loaded for a different competition

---

### Event Handlers (Prototype Behavior)

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

### Toolbar Buttons

| Button | Prototype Behavior |
|--------|-------------------|
| + Add Segment | Calls `handleAddSegment()` |
| Templates | Shows "Coming soon" toast |
| Import CSV | Shows "Coming soon" toast |
| Sync OBS | Shows "Coming soon" toast |
| Save | Shows "Rundown saved" toast (no actual persistence) |
| Export CSV | Shows "Coming soon" toast |

---

### Filter & Search

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

## Acceptance Criteria

### Phase 0A ✅ COMPLETE

- [x] Route `/{compId}/rundown` renders RundownEditorPage
- [x] Page header shows "RUNDOWN EDITOR" and competition name placeholder
- [x] Toolbar renders with all buttons (+ Add Segment, Templates, Import CSV, Sync OBS)
- [x] Type filter dropdown shows all 6 segment types + "All Types"
- [x] Search input filters segment list by name
- [x] Split panel layout: SegmentList on left (~60%), SegmentDetail on right (~40%)
- [x] Placeholder text shown in SegmentDetail when no segment selected
- [x] "Coming soon" toast shown for unimplemented features
- [x] Page uses hardcoded DUMMY_SEGMENTS data

### Phase 0B ✅ COMPLETE

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

### Phase 1: Timing & Display ✅ COMPLETE

- [x] Total runtime displayed in header
- [x] Target duration input available
- [x] Over/under indicator with color states
- [x] Running time column shows cumulative start times
- [x] Start times auto-update on duration changes
- [x] Buffer time can be added between segments
- [x] Buffer contributes to total runtime

### Phase 2: Inline Editing

- [ ] OBS Scene dropdown editable inline on segment row
- [ ] Graphic dropdown editable inline on segment row
- [ ] Duration editable inline on segment row
- [ ] Changes auto-save on selection
- [ ] Edit button opens full detail panel

### Phase 3: Multi-Select & Summary

- [ ] Checkbox on each segment row
- [ ] Shift+click for range selection
- [ ] Ctrl/Cmd+click for toggle selection
- [ ] Selection Summary sidebar appears for 2+ selections
- [ ] Summary shows editable durations per segment
- [ ] Total duration updates in real-time
- [ ] Bulk actions available (edit type, scene, graphic, delete)

### Phase 4: Reordering & Organization

- [ ] Drag handle on segment rows
- [ ] Drag-and-drop reordering works
- [ ] Drop indicator shows during drag
- [ ] Arrow buttons still functional
- [ ] Segment groups can be created
- [ ] Groups collapsible
- [ ] Groups show combined duration

### Phase 5: Segment Management

- [ ] Duplicate segment button available
- [ ] Duplicated segments appear after original
- [ ] Lock toggle on segments
- [ ] Locked segments cannot be edited
- [ ] Conditional/optional toggle available
- [ ] Optional segments visually distinct
- [ ] Notes field in Edit panel
- [ ] Notes indicator on segment row

### Phase 6: Timing Modes

- [ ] Timing mode selector (Fixed/Manual/Follows Previous)
- [ ] Visual indicator of timing mode
- [ ] Manual segments show "MANUAL" badge

### Phase 7: Templates & Presets

- [ ] Save segment as template
- [ ] Template library accessible
- [ ] Save full rundown as template
- [ ] Load template for new rundown
- [ ] Recurrence pattern option

### Phase 8: Collaboration

- [ ] Multiple users can edit simultaneously
- [ ] Presence indicators shown
- [ ] Change history logged
- [ ] Version rollback available
- [ ] Comment threads on segments
- [ ] Approval workflow statuses

### Phase 9: Data & Reporting

- [ ] Export to PDF
- [ ] Export to CSV
- [ ] Export to JSON
- [ ] Import from CSV with field mapping
- [ ] Import from JSON (backup restore)
- [ ] Import preview and validation

### Phase 10: Visual & UX

- [ ] Timeline view toggle
- [ ] Color coding by segment type
- [ ] Compact view toggle
- [ ] Dark/light mode toggle
- [ ] Print-friendly view

### Phase 11: Quality of Life

- [ ] Keyboard shortcuts functional
- [ ] Undo/redo working (20+ levels)
- [ ] Search by segment name
- [ ] Filter by type, scene, graphic

### Phase 12: Advanced Planning

- [ ] AI suggests segments based on competition context (senior meet, rivalry, etc.)
- [ ] AI suggests segment order improvements
- [ ] One-click to add AI-suggested segment
- [ ] Segment script field with rich text
- [ ] Audio cue planning fields
- [ ] Talent assignment per segment
- [ ] Equipment tracking per segment
- [ ] Sponsor/ad inventory tracking

---

## Files

### Files Created (Prototype)

| File | Est. Lines | Purpose |
|------|------------|---------|
| `show-controller/src/pages/RundownEditorPage.jsx` | 250-300 | Main editor page |

### Files to Modify (Prototype)

| File | Changes |
|------|---------|
| `show-controller/src/App.jsx` | Add route: `<Route path="/:compId/rundown" element={<RundownEditorPage />} />` |

---

## Dependencies

- **PRD-Graphics-Registry** - Required for GraphicsPicker to read graphic definitions and schemas

---

## Related PRDs

- **PRD-05 (Show Controller Prototype)** - Contains live execution and post-show features:
  - Hard Time Markers
  - Overtime Warnings
  - Scene Validation
  - Hotkey Mapping
  - Preview Thumbnails
  - Live Execution View
  - Current/Next/On-Deck Display
  - One-Click Advance
  - Segment Status Tracking
  - Real-Time Duration Tracking
  - **AI Talking Points** (live generation of commentator context)
  - **Live Score Integration** (real-time data updates during show)
  - **Teleprompter Display** (talent-facing view during broadcast)
  - **Audio Cue Triggering** (playback control during show)
  - **Current Time Indicator** (timeline view during live show)
  - **Convert Optional Segments** (promote conditional segments during show)
  - **Post-Show Analytics:**
    - Historical analytics (actual vs planned trends)
    - Comparison view (planned vs actual durations)
    - Deviation log (auto-recorded during show)

---

## Appendix

### A. Excluded Features

The following features were considered but excluded from scope:

- Auto-populate from roster (import team/athlete data)
- Google Sheets live sync
- Offline mode
- Mobile companion app

### B. Glossary

| Term | Definition |
|------|------------|
| Segment | A single item in the rundown with defined duration and properties |
| Rundown | The complete timeline of segments for a show |
| OBS Scene | A scene configuration in OBS Studio |
| Graphic | A visual overlay element displayed during a segment |
| Hard Time | An absolute clock time when a segment must start |
| Buffer | Padding time between segments |

---

## Version History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-01-20 | — | Initial PRD (Phase 0A) |
| 2.0 | 2026-01-22 | — | Added Phase 0B, marked complete |
| 3.0 | 2026-01-23 | — | Added comprehensive feature roadmap (Phases 1-12) |
| 3.1 | 2026-01-23 | — | Refocused Phase 12 on planning features; moved live execution features to PRD-05; added AI Segment Recommendations |
| 3.2 | 2026-01-23 | — | Moved post-show analytics (9.2-9.4) to PRD-05; replaced with Import feature; removed live show references from 5.3 and 10.1 |
