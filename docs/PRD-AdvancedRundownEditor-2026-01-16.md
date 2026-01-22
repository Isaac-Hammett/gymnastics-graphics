# PRD: Advanced Rundown Editor

**Version:** 1.0
**Date:** 2026-01-16
**Project:** Gymnastics Graphics
**Status:** Draft
**Dependencies:** [PRD-OBSIntegrationTool-2026-01-16.md](./PRD-OBSIntegrationTool-2026-01-16.md)

---

## Executive Summary

This PRD defines the Advanced Rundown Editor, a comprehensive segment timing and show planning tool that integrates with the OBS Integration Tool. The Rundown Editor enables producers to plan show segments with precise timing, OBS scene assignments, graphics triggers, audio presets, and camera configurations. It includes milestone tracking, multi-select time calculation, templates, and real-time collaboration.

---

## Table of Contents

1. [System Integration Overview](#1-system-integration-overview)
2. [Dynamic Data Sources](#2-dynamic-data-sources)
3. [Segment Data Model](#3-segment-data-model)
4. [Time Milestones System](#4-time-milestones-system)
5. [Multi-Select Time Calculation](#5-multi-select-time-calculation)
6. [Pickers (OBS Scene, Transition, Audio, Graphics)](#6-pickers)
7. [Dedicated Rundown Editor Page](#7-dedicated-rundown-editor-page)
8. [Producer View Integration](#8-producer-view-integration)
9. [Template System](#9-template-system)
10. [Real-Time Collaboration](#10-real-time-collaboration)
11. [Import/Export](#11-importexport)
12. [User Stories - Segment CRUD](#12-user-stories---segment-crud)
13. [Resolved Design Questions](#13-resolved-design-questions)
14. [Implementation Phases](#14-implementation-phases)
15. [Data Models](#data-models)
16. [API Specification](#api-specification)
17. [File Manifest](#file-manifest)
18. [Success Criteria](#success-criteria)

---

## 1. System Integration Overview

The Rundown Editor integrates with three dynamic systems that can change at runtime.

**Important Architecture Note:** The frontend NEVER connects directly to OBS or competition VMs. All OBS data flows through the coordinator server via Socket.io. See [README-OBS-Architecture.md](README-OBS-Architecture.md) for the full connection architecture.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RUNDOWN EDITOR                                    │
│                        (Frontend React)                                  │
│                                                                          │
│  Segment Configuration:                                                  │
│  - OBS Scene (via Socket.io → Coordinator → VM's OBS)                   │
│  - Graphic (from Graphics Registry in Firebase)                         │
│  - Transition (via Socket.io → Coordinator → VM's OBS)                  │
│  - Audio Mix (via Socket.io → Coordinator → VM's OBS)                   │
│  - Camera (from Firebase Camera Config)                                 │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          │ Socket.io          │ Firebase           │ Firebase
          │ (all OBS cmds)     │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  COORDINATOR    │  │ Graphics        │  │ Firebase        │
│  (api.commen-   │  │ Registry        │  │ Camera Config   │
│  tarygraphic.   │  │                 │  │                 │
│  com)           │  │                 │  │                 │
│                 │  │ - All graphics  │  │ - Camera list   │
│ Routes to VM:   │  │ - Categories    │  │ - Apparatus     │
│ - Scenes        │  │ - Parameters    │  │ - Health        │
│ - Transitions   │  │                 │  │                 │
│ - Audio sources │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │
          │ OBS WebSocket (ws://VM:4455)
          ▼
┌─────────────────┐
│  COMPETITION VM │
│  (OBS Studio)   │
│  Per-comp OBS   │
└─────────────────┘
```

**Key Principle:** No hardcoded lists. Everything pulled dynamically from source systems. OBS data is accessed via Socket.io events (NOT REST APIs) through the coordinator.

---

## 2. Dynamic Data Sources

### 2.1 OBS Data (via Coordinator → obsConnectionManager)

**Important:** There are TWO OBS subsystems in the codebase:
- `obsConnectionManager` - For production (manages per-competition OBS WebSocket connections via coordinator)
- `obsStateSync` - For local development only (single local OBS connection)

The Rundown Editor receives OBS data via Socket.io events from the coordinator, which manages connections to each competition's VM:

**How to access OBS data (via OBSContext):**
```javascript
// RIGHT - Use Socket.io events via OBSContext
import { useOBS } from '../context/OBSContext';
const { obsState } = useOBS();
const scenes = obsState.scenes;  // From obs:stateUpdated event

// WRONG - REST APIs don't work in production
// const response = await fetch(`${socketUrl}/api/obs/scenes`);
```

**OBS state structure (from obs:stateUpdated event):**

```javascript
// From OBS State Sync
const obsData = {
  scenes: [
    { name: "Single - Camera 1", category: "generated-single", index: 0 },
    { name: "Single - Camera 2", category: "generated-single", index: 1 },
    { name: "Dual - Camera 1 + Camera 2", category: "generated-multi", index: 2 },
    { name: "BRB", category: "static", index: 3 },
    { name: "Graphics Fullscreen", category: "graphics", index: 4 },
    { name: "Interview Setup", category: "manual", index: 5 }
  ],

  transitions: [
    { name: "Cut", configurable: false },
    { name: "Fade", configurable: true, defaultDuration: 300 },
    { name: "Stinger", configurable: true, defaultDuration: 500 }
  ],

  audioSources: [
    { name: "Venue Audio", volumeDb: -6.0, muted: false },
    { name: "Commentary", volumeDb: 0.0, muted: false },
    { name: "Music", volumeDb: -96.0, muted: true },
    { name: "Discord Audio", volumeDb: 0.0, muted: false }
  ]
};
```

### 2.2 Graphics Registry

Firebase Path: `system/graphics/registry`

```json
{
  "metadata": {
    "version": "1.0",
    "lastUpdated": "2026-01-14T10:00:00Z"
  },

  "categories": {
    "pre-meet": { "name": "Pre-Meet", "order": 1 },
    "stream": { "name": "Stream", "order": 2 },
    "event-frame": { "name": "Event Frames", "order": 3 },
    "leaderboard": { "name": "Leaderboards", "order": 4 },
    "summary": { "name": "Summaries", "order": 5 },
    "live": { "name": "Live/Dynamic", "order": 7 }
  },

  "graphics": {
    "team-logos": {
      "id": "team-logos",
      "name": "Team Logos",
      "category": "pre-meet",
      "description": "Display team logos",
      "dataSource": "firebase-config",
      "defaultDuration": null,
      "persistent": true,
      "parameters": [],
      "genderFilter": null
    },

    "team-stats": {
      "id": "team-stats",
      "name": "Team Stats",
      "category": "pre-meet",
      "description": "Team average, high score, conference standing",
      "defaultDuration": 8,
      "persistent": false,
      "parameters": [
        {
          "name": "teamId",
          "type": "team-select",
          "label": "Team",
          "required": true
        }
      ]
    },

    "event-frame-vt": {
      "id": "event-frame-vt",
      "name": "Vault Frame",
      "category": "event-frame",
      "description": "Vault apparatus scoring frame",
      "defaultDuration": null,
      "persistent": true,
      "genderFilter": null
    },

    "event-frame-ub": {
      "id": "event-frame-ub",
      "name": "Uneven Bars Frame",
      "category": "event-frame",
      "genderFilter": "womens"
    },

    "event-frame-ph": {
      "id": "event-frame-ph",
      "name": "Pommel Horse Frame",
      "category": "event-frame",
      "genderFilter": "mens"
    },

    "score-reveal": {
      "id": "score-reveal",
      "name": "Score Reveal",
      "category": "live",
      "description": "Animated score reveal",
      "defaultDuration": 5,
      "triggerType": "on-score"
    }
  }
}
```

### 2.3 Camera Config

Firebase Path: `competitions/{compId}/production/cameras`

```json
{
  "cam1": {
    "id": "cam1",
    "name": "Camera 1 - Vault",
    "srtUrl": "srt://nimble.local:10001",
    "srtPort": 10001,
    "expectedApparatus": ["VT"],
    "fallbackCameraId": "cam2"
  },
  "cam2": {
    "id": "cam2",
    "name": "Camera 2 - Uneven Bars",
    "srtUrl": "srt://nimble.local:10002",
    "srtPort": 10002,
    "expectedApparatus": ["UB"],
    "fallbackCameraId": "cam1"
  }
}
```

---

## 3. Segment Data Model

### Complete Segment Schema

```json
{
  "id": "seg-team1-intro",
  "name": "UCLA Introduction",
  "type": "live",

  "timing": {
    "duration": 10,
    "durationUnit": "seconds",
    "autoAdvance": true,
    "countdown": false,
    "hold": {
      "enabled": false,
      "minDuration": null,
      "maxDuration": null
    }
  },

  "obs": {
    "sceneId": "Single - Camera 2",
    "transition": {
      "type": "Fade",
      "duration": 300
    }
  },

  "camera": {
    "cameraId": "cam2",
    "intendedApparatus": ["VT"]
  },

  "audio": {
    "preset": "commentary-focus",
    "levels": {
      "Venue Audio": 30,
      "Commentary": 100,
      "Music": 0
    }
  },

  "graphics": {
    "primary": {
      "graphicId": "team-stats",
      "parameters": {
        "teamId": "ucla"
      },
      "triggerMode": "cued",
      "duration": 8,
      "autoTrigger": false
    },
    "secondary": [],
    "onScore": {
      "graphicId": "score-reveal",
      "autoTrigger": true
    }
  },

  "milestone": {
    "type": "team-intro",
    "label": "UCLA Introduction"
  },

  "notes": "Wait for talent to finish host intro before advancing",
  "order": 4,

  "meta": {
    "createdAt": "2026-01-14T10:00:00Z",
    "modifiedAt": "2026-01-14T12:30:00Z",
    "modifiedBy": "producer@example.com"
  }
}
```

### Segment Types

| Type | Duration | Auto-Advance | Use Case |
|------|----------|--------------|----------|
| `video` | Fixed | Yes (on video end) | Pre-recorded content, intro videos |
| `live` | Fixed or Variable | Configurable | Camera feeds, interviews |
| `static` | Fixed | Yes | Graphics-only segments, intros |
| `break` | Fixed | Yes | BRB, halftime, rotation breaks |
| `hold` | Variable (min/max) | No (producer decision) | Score reveals, award ceremonies |
| `graphic` | Fixed | Yes | Full-screen graphics display |

### Graphic Trigger Modes

| Mode | Description |
|------|-------------|
| `auto` | Graphic fires immediately when segment starts |
| `cued` | Graphic is loaded but waits for manual trigger |
| `on-score` | Graphic fires when score is received from Virtius |
| `timed` | Graphic fires after specified delay |

---

## 4. Time Milestones System

### 4.1 Milestone Types

| Type | Description | System Behavior |
|------|-------------|-----------------|
| `show-start` | Beginning of broadcast | Timer starts |
| `welcome-host` | Talent cue to start talking | Visual cue on talent view |
| `event-intro` | Event introduction begins | Sets scene, triggers graphic |
| `first-routine` | First competitive routine | Critical timing marker |
| `rotation-start` | Beginning of rotation N | Apparatus frame triggered |
| `rotation-end` | End of rotation N | Summary graphic available |
| `halftime-start` | Halftime begins | Break mode, BRB scene |
| `halftime-end` | Halftime ends | Return from break |
| `final-rotation` | Last rotation begins | Final graphics prep |
| `meet-end` | Competition complete | Final scores, wrap-up |
| `custom` | Producer-defined | Custom label |

### 4.2 Automatic Milestone Detection

```javascript
function calculateMilestones(segments) {
  const milestones = [];
  let runningTime = 0;

  segments.forEach((segment, index) => {
    // Show start is always 0
    if (index === 0) {
      milestones.push({ type: 'show-start', time: 0, segmentIndex: 0 });
    }

    // Detect first routine (first segment with type 'live' and apparatus)
    if (segment.type === 'live' && segment.camera?.intendedApparatus?.length > 0) {
      if (!milestones.find(m => m.type === 'first-routine')) {
        milestones.push({
          type: 'first-routine',
          time: runningTime,
          segmentIndex: index,
          label: `First Routine (${segment.name})`
        });
      }
    }

    // Detect rotation starts (segments named "Rotation X")
    if (segment.name.match(/rotation\s*\d+/i) && segment.milestone?.type === 'rotation-start') {
      milestones.push({
        type: 'rotation-start',
        time: runningTime,
        segmentIndex: index,
        label: segment.name
      });
    }

    // Detect breaks
    if (segment.type === 'break' && segment.timing.duration >= 180) {
      milestones.push({
        type: 'halftime-start',
        time: runningTime,
        segmentIndex: index,
        label: 'Halftime'
      });
    }

    runningTime += segment.timing.duration || 0;
  });

  // Meet end is always last
  milestones.push({
    type: 'meet-end',
    time: runningTime,
    segmentIndex: segments.length - 1
  });

  return milestones;
}
```

### 4.3 Milestone Timeline UI

```
┌─ TIME MILESTONES ───────────────────────────────────────────────────────┐
│                                                                          │
│  ●─────────●─────────●─────────────────────●─────────●─────────────●    │
│  │         │         │                     │         │             │    │
│  0:00      2:30      6:00                  45:00     50:00         2:15:00
│  Show      Welcome   First                 Halftime  Rotation 3    Meet
│  Start     & Host    Routine               Start     Start         End
│                      ▲                                                   │
│                      │                                                   │
│              [Click to select all segments before this milestone]       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Multi-Select Time Calculation

### 5.1 Selection Mechanics

| Action | Result |
|--------|--------|
| Click checkbox | Toggle single segment |
| Shift+Click | Select range from last clicked |
| Ctrl/Cmd+Click | Add/remove from selection |
| Click milestone | Select all segments up to that milestone |
| Click "Select Pre-Show" | Select segments 1 through first routine |
| Click "Select Rotation X" | Select all segments in that rotation |

### 5.2 Selection Summary Component

```
┌─ SELECTION SUMMARY ─────────────────────────────────────────────────────┐
│                                                                          │
│  ✓ 5 segments selected              │  Target Milestone: [First Routine ▼]
│                                      │  Target Time: 6:00
│  Total Duration: 5:23               │
│                                      │  ┌──────────────────┐
│  ████████████████████░░░░░░░░░░░░░  │  │ 0:37 remaining   │  ✓ FITS
│                                      │  └──────────────────┘
│                                      │
│  [Clear Selection]  [Delete Selected]  [Duplicate Selected]             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Status Indicators

| Status | Condition | Color |
|--------|-----------|-------|
| `FITS` | Selection ≤ target - 30s | Green |
| `TIGHT` | Selection between target-30s and target | Yellow |
| `OVER` | Selection > target | Red |

---

## 6. Pickers

### 6.1 OBS Scene Picker

Dynamically populated from OBS state via OBSContext (received via Socket.io from coordinator):

```
┌─ SELECT OBS SCENE ──────────────────────────────────────────────────────┐
│                                                                          │
│  Search: [____________]                    [↻ Refresh from OBS]         │
│                                                                          │
│  ─── Single Camera ─────────────────────────────────────────────────   │
│  [Single - Camera 1 - Vault]     [Single - Camera 2 - UB]               │
│  [Single - Camera 3 - BB]        [Single - Camera 4 - FX]               │
│                                                                          │
│  ─── Multi-Camera ──────────────────────────────────────────────────   │
│  [Dual - Cam1 + Cam2]  [Quad View]                                      │
│                                                                          │
│  ─── Static ────────────────────────────────────────────────────────   │
│  [Starting Soon]       [BRB]                 [Thanks for Watching]      │
│                                                                          │
│  ─── Manual ────────────────────────────────────────────────────────   │
│  [Interview Setup]     [Scoreboard]                                      │
│                                                                          │
│  ⚠️ OBS not connected - showing cached scenes                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Transition Picker

```
┌─ SELECT TRANSITION ─────────────────────────────────────────────────────┐
│                                                                          │
│  ● Cut                                      Duration: N/A                │
│  ○ Fade                                     Duration: [300]ms            │
│  ○ Stinger                                  Duration: [500]ms            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Audio Preset Picker

```
┌─ AUDIO CONFIGURATION ───────────────────────────────────────────────────┐
│                                                                          │
│  Preset: [Commentary Focus ▼]                                           │
│                                                                          │
│  ─── Audio Sources ─────────────────────────────────────────────────   │
│                                                                          │
│  Venue Audio        [========●=] 80%        🔊                          │
│  Commentary         [=========●] 100%       🔊                          │
│  Music              [●=========] 0%         🔇                          │
│  Discord Audio      [=========●] 100%       🔊                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Graphics Picker

Shows actual team names and filters by gender:

```
┌─ SELECT GRAPHIC ────────────────────────────────────────────────────────┐
│                                                                          │
│  ─── Pre-Meet ──────────────────────────────────────────────────────   │
│  [Team Logos] [Event Info Bar]                                          │
│                                                                          │
│  [UCLA Stats]     [Oregon Stats]    [Utah Stats]    [Arizona Stats]     │
│  [UCLA Coaches]   [Oregon Coaches]  [Utah Coaches]  [Arizona Coaches]   │
│                                                                          │
│  ─── Event Frames (Women's) ────────────────────────────────────────   │
│  [Vault Frame]  [Uneven Bars Frame]  [Balance Beam Frame]  [Floor Frame]│
│                                                                          │
│  ─── Leaderboards ──────────────────────────────────────────────────   │
│  [VT Leaders]  [UB Leaders]  [BB Leaders]  [FX Leaders]                 │
│                                                                          │
│  ─── Live/Triggered ────────────────────────────────────────────────   │
│  [Score Reveal]  [Now Competing]                                        │
│                                                                          │
│  [No Graphic]                                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Dedicated Rundown Editor Page

### Route

`/{compId}/rundown`

### Layout

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
│  ┌─ SELECTION SUMMARY ─────────────────────────────────────────────────┐│
│  │ ✓ 5 segments │ Total: 5:23 │ Target: First Routine (6:00) │ ✓ FITS ││
│  │ [Clear] [Delete] [Duplicate]                                        ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─ MILESTONES ────────────────────────────────────────────────────────┐│
│  │ ●──────●──────●─────────────────●──────●──────────────●             ││
│  │ Start  Host   First             Half   R3             End            ││
│  │ 0:00   2:30   Routine           45:00  50:00          2:15           ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─ SEGMENT LIST ───────────────────────────┬─ DETAIL PANEL ───────────┐│
│  │                                           │                          ││
│  │☐│#│NAME              │TYPE │DUR │SCENE   │ Editing: UCLA Intro      ││
│  │──┼─┼──────────────────┼─────┼────┼───────│                          ││
│  │☑│1│Show Intro        │video│0:45│Start  │ Name: [UCLA Introduction] ││
│  │☑│2│Welcome & Host    │live │0:30│Talent │ Type: [live ▼]            ││
│  │☑│3│Event Intro       │stat │0:08│Gfx    │ Duration: [10]s           ││
│  │☑│4│UCLA Introduction │live │0:10│Cam2 ← │ ☑ Auto-advance            ││
│  │☑│5│Oregon Intro      │live │0:10│Cam3   │                          ││
│  │☐│6│Utah Introduction │live │0:10│Cam4   │ ─── OBS ───               ││
│  │──│─│─── FIRST ROUTINE ●──│────│───────│ Scene: [Single - Cam2 ▼]   ││
│  │☐│8│Floor - R1        │live │var │Cam4   │ Transition: [Fade ▼] 300ms││
│  │  │ │                  │     │    │       │                          ││
│  │  │ │[Drag to reorder] │     │    │       │ ─── Graphic ───          ││
│  │  │ │                  │     │    │       │ Graphic: [UCLA Stats ▼]  ││
│  │  │ │                  │     │    │       │ Trigger: [cued ▼]        ││
│  │  │ │                  │     │    │       │                          ││
│  │  │ │                  │     │    │       │ ─── Audio ───            ││
│  │  │ │                  │     │    │       │ Preset: [Commentary ▼]   ││
│  │  │ │                  │     │    │       │                          ││
│  │  │ │                  │     │    │       │ Notes: [_____________]   ││
│  └──┴─┴──────────────────┴─────┴────┴───────┴──────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Producer View Integration

### Enhanced SHOW PROGRESS Panel

```
┌─ NOW PLAYING ───────────────────────────────────────────────────────────┐
│                                                                          │
│  ▶️  UCLA Introduction                                                   │
│      Live Segment                                                        │
│                                                                          │
│  [████████████████████████████░░░░░░░░░░░░░]  0:08 / 0:10               │
│                                                                          │
│  OBS: Single - Camera 2          Transition: Fade                        │
│                                                                          │
│  🎨 GRAPHIC: UCLA Stats          [Preview] [🔥 FIRE]                    │
│     Status: Cued (waiting)        Duration: 8s                           │
│                                                                          │
│  NOTES: Wait for talent to finish host intro                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─ UP NEXT ───────────────────────────────────────────────────────────────┐
│                                                                          │
│  ⏭️  Oregon Introduction                                      Auto       │
│      0:10 duration                                                       │
│      🎨 Oregon Stats (cued)                                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─ SHOW PROGRESS ─────────────────────────────── Segment 4 of 21 ─────────┐
│                                                                          │
│  [+ Add] [Edit ✓] [Select ✓]              Selection: 1:43 / 6:00  ✓    │
│                                                                          │
│  ─── PRE-SHOW (First Routine @ 6:00) ─────────────── 5:45 ── ✓ ────   │
│                                                                          │
│  ≡ ☑ ✅ Show Intro                             0:45  A   Starting Soon  │
│  ≡ ☑ ✅ Welcome & Host Intro                   0:30  A   Hosts          │
│  ≡ ☐ ✅ Event Introduction                     0:08  A   Event Info     │
│  ≡ ☐ ▶️ UCLA Introduction                      0:10  A   UCLA Stats  ←  │
│        └─ 🎨 [UCLA Stats] cued                      [Preview] [🔥]      │
│  ≡ ☐ ⬜ Oregon Introduction                    0:10  A   Oregon Stats   │
│  ≡ ☐ ⬜ Utah Introduction                      0:10  A   Utah Stats     │
│                                                                          │
│  ─── ROTATION 1 ● ───────────────────────────────────────────────────   │
│                                                                          │
│  ≡ ☐ ⬜ Floor - Rotation 1                     var   M   FX Frame        │
│        └─ 🎨 [FX Frame] auto                                            │
│        └─ 🎨 [Score Reveal] on-score                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Overtime Counter

```
┌─ NOW PLAYING ───────────────────────────────────────────────────────────┐
│                                                                          │
│  ▶️  UCLA Introduction                                    ⚠️ OVERTIME    │
│      Live Segment                                                        │
│                                                                          │
│  [████████████████████████████████████████████████]  +0:05 OVER         │
│  ↑ Red, pulsing                                         0:15 elapsed    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Template System

### 9.1 Rundown Template Structure

Firebase Path: `templates/rundown/{meetType}/{templateId}`

```json
{
  "id": "womens-quad-default",
  "meetType": "womens-quad",
  "name": "Women's Quad - Standard",
  "description": "Standard format for 4-team women's meets",
  "version": "1.3",
  "createdAt": "2026-01-05T10:00:00Z",
  "modifiedAt": "2026-01-13T14:00:00Z",

  "metadata": {
    "estimatedDuration": 8100,
    "rotationCount": 4,
    "segmentCount": 45,
    "preShowDuration": 360
  },

  "segments": [
    {
      "name": "Show Intro",
      "type": "video",
      "timing": { "duration": 45, "autoAdvance": true },
      "obs": { "sceneId": "Starting Soon" }
    },
    {
      "name": "{{team1.name}} Introduction",
      "type": "live",
      "timing": { "duration": 10, "autoAdvance": true },
      "graphics": {
        "primary": {
          "graphicId": "team-stats",
          "parameters": { "teamId": "{{team1.id}}" }
        }
      }
    }
  ]
}
```

### 9.2 Variable Substitution

| Variable | Source | Example Value |
|----------|--------|---------------|
| `{{team1.name}}` | Competition config | "UCLA" |
| `{{team1.id}}` | Competition config | "ucla" |
| `{{team2.name}}` | Competition config | "Oregon" |
| `{{competition.name}}` | Competition config | "UCLA vs Oregon vs Utah vs Arizona" |
| `{{competition.venue}}` | Competition config | "Pauley Pavilion" |

### 9.3 Auto-Load on Competition Setup

```
Competition Created (womens-quad)
         │
         ▼
┌─────────────────────────────┐
│ Check templates/rundown/    │
│ womens-quad for 'default'   │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Copy template segments to   │
│ competitions/{id}/rundown   │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Replace placeholder team    │
│ references with actual teams│
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Rundown ready for editing   │
└─────────────────────────────┘
```

---

## 10. Real-Time Collaboration

### 10.1 Firebase Structure

```
competitions/{compId}/production/
├── rundown/
│   ├── segments: [...]
│   ├── lastModified: timestamp
│   ├── lastModifiedBy: "email"
│   └── version: 15
│
├── editing/
│   ├── activeEditors: {
│   │     "user123": {
│   │       "email": "producer@...",
│   │       "segment": "seg-001",
│   │       "lastActive": timestamp
│   │     }
│   │   }
│   └── locks: {
│         "seg-001": { "userId": "user123", "expires": timestamp }
│       }
│
└── graphicsQueue/
    ├── current: null
    └── queue: [...]
```

### 10.2 Conflict Resolution

1. Optimistic updates (local change shows immediately)
2. Firebase handles merge
3. If conflict detected, show "Segment was modified by [name]. [Reload] [Keep Mine]"

---

## 11. Import/Export

### 11.1 CSV Format

```csv
order,name,type,duration_seconds,auto_advance,obs_scene,transition_type,transition_duration,graphic_id,graphic_team,graphic_duration,graphic_trigger,audio_preset,note
1,Show Intro,video,45,true,Starting Soon,Cut,0,,,,auto,break-music,
2,Welcome & Host,live,30,true,Talent Camera,Fade,300,hosts,,8,auto,commentary-focus,
3,UCLA Introduction,live,10,true,Single - Camera 2,Fade,300,team-stats,ucla,8,cued,commentary-focus,Wait for host finish
```

### 11.2 JSON Export

Full rundown with all segment data in JSON format for backup/restore.

---

## 12. User Stories - Segment CRUD

### US-01: Create a New Segment

**As a producer**, I need to add a new segment to the rundown so I can plan additional show content.

#### Current State

No rundown editor exists. Producers manually edit Firebase or use spreadsheets.

#### Desired Behavior

**Trigger:** Click "+ Add Segment" button (in toolbar OR at bottom of list)

**Insert Position:** New segment inserted AFTER the currently selected segment. If no segment selected, insert at end.

**Required Fields (must fill before save):**
| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `name` | text | "" | Required, non-empty |
| `type` | select | "live" | Required, one of: video, live, static, break, hold, graphic |
| `duration` | number | 30 | Required for all types except `hold` |
| `obs.sceneId` | select | null | Required, must select from available OBS scenes |

**Optional Fields (can leave empty):**
| Field | Type | Default |
|-------|------|---------|
| `timing.autoAdvance` | boolean | true |
| `graphics.primary` | object | null |
| `audio.preset` | select | null |
| `notes` | text | "" |

#### UI Flow

```
1. User clicks "+ Add Segment" button
   │
   ▼
2. New segment row appears in list (highlighted, unsaved state)
   Detail panel opens on right with empty form
   │
   ▼
3. User fills required fields:
   ┌─ NEW SEGMENT ─────────────────────────────────────────┐
   │                                                        │
   │  Name:     [UCLA Introduction____________]  ← Required │
   │                                                        │
   │  Type:     [live ▼]                         ← Required │
   │            ┌──────────────┐                            │
   │            │ video        │                            │
   │            │ live     ◄───│ ← Default selected         │
   │            │ static       │                            │
   │            │ break        │                            │
   │            │ hold         │                            │
   │            │ graphic      │                            │
   │            └──────────────┘                            │
   │                                                        │
   │  Duration: [30] seconds                     ← Required │
   │            (disabled if type=hold)                     │
   │                                                        │
   │  OBS Scene: [Select scene... ▼]             ← Required │
   │             ┌────────────────────────┐                 │
   │             │ ─ Single Camera ─      │                 │
   │             │ Single - Camera 1      │                 │
   │             │ Single - Camera 2      │                 │
   │             │ ─ Static ─             │                 │
   │             │ Starting Soon          │                 │
   │             │ BRB                    │                 │
   │             │ Thanks for Watching    │                 │
   │             └────────────────────────┘                 │
   │                                                        │
   │  ─── Optional ─────────────────────────────────────── │
   │                                                        │
   │  Auto-advance: [✓]                                    │
   │                                                        │
   │  Graphic: [None ▼]                                    │
   │                                                        │
   │  Audio Preset: [None ▼]                               │
   │                                                        │
   │  Notes: [________________________________]            │
   │         [________________________________]            │
   │                                                        │
   │           [Cancel]  [Save Segment]                    │
   │                      ↑                                │
   │                      Disabled until all required      │
   │                      fields are filled                │
   └────────────────────────────────────────────────────────┘
   │
   ▼
4. User clicks "Save Segment"
   - Segment saved to Firebase: competitions/{compId}/production/rundown/segments/{id}
   - ID generated: seg-{timestamp}-{random4}
   - order field set to insertPosition
   - All segments after insertion point have order incremented
   │
   ▼
5. Detail panel shows saved segment (editable)
   Toast appears: "Segment saved"
```

#### Acceptance Criteria

- [ ] "+ Add Segment" button visible in toolbar
- [ ] "+ Add Segment" button visible at bottom of segment list
- [ ] Clicking either button creates new segment after selected segment
- [ ] If no segment selected, new segment added at end
- [ ] Detail panel opens with empty form
- [ ] Name field is required - Save disabled if empty
- [ ] Type dropdown shows all 6 types: video, live, static, break, hold, graphic
- [ ] Type defaults to "live"
- [ ] Duration field required for all types except "hold"
- [ ] Duration field disabled when type="hold"
- [ ] OBS Scene dropdown populated from OBS state (via OBSContext)
- [ ] OBS Scene is required - Save disabled if not selected
- [ ] Save button disabled until all required fields filled
- [ ] Cancel button discards unsaved segment
- [ ] Save writes to Firebase path: `competitions/{compId}/production/rundown/segments/{id}`
- [ ] Segment ID format: `seg-{timestamp}-{random4}`
- [ ] Toast shows "Segment saved" on success
- [ ] New segment appears in list at correct position

---

### US-02: Edit an Existing Segment

**As a producer**, I need to modify segment details so I can adjust timing, scenes, or graphics.

#### Trigger

Click on any segment row in the segment list.

#### UI Flow

```
1. User clicks segment row "UCLA Introduction"
   │
   ▼
2. Row highlights as selected
   Detail panel shows segment data (pre-filled)
   │
   ┌─ SEGMENT LIST ──────────────────┐  ┌─ DETAIL PANEL ──────────────────┐
   │                                  │  │                                  │
   │ ☐ 1  Show Intro         0:45    │  │  Editing: UCLA Introduction      │
   │ ☐ 2  Welcome & Host     0:30    │  │                                  │
   │ ☐ 3  Event Intro        0:08    │  │  Name: [UCLA Introduction____]   │
   │ ☑ 4  UCLA Introduction  0:10  ← │  │                                  │
   │ ☐ 5  Oregon Intro       0:10    │  │  Type: [live ▼]                  │
   │                                  │  │                                  │
   └──────────────────────────────────┘  │  Duration: [10] seconds          │
                                         │                                  │
                                         │  OBS Scene: [Single - Cam 2 ▼]   │
                                         │                                  │
                                         │  ... (other fields)              │
                                         │                                  │
                                         │        [Delete]  [Save Changes]  │
                                         └──────────────────────────────────┘
   │
   ▼
3. User modifies any field (e.g., changes duration from 10 to 15)
   - "Save Changes" button becomes enabled
   - Unsaved indicator appears (e.g., dot or asterisk)
   │
   ▼
4. User clicks "Save Changes"
   - Firebase updated at: competitions/{compId}/production/rundown/segments/{id}
   - meta.modifiedAt updated
   - Toast: "Changes saved"
   │
   ▼
5. If user clicks different segment WITHOUT saving:
   - Show confirmation: "You have unsaved changes. [Discard] [Save]"
```

#### Fields Editable

| Field | UI Element | Notes |
|-------|------------|-------|
| `name` | Text input | Required |
| `type` | Dropdown | Required, changing type may affect other fields |
| `timing.duration` | Number input | Disabled for hold type |
| `timing.autoAdvance` | Checkbox | |
| `obs.sceneId` | Dropdown | From OBS state |
| `obs.transition.type` | Dropdown | Cut, Fade, Stinger |
| `obs.transition.duration` | Number input | Disabled for Cut |
| `graphics.primary.graphicId` | Dropdown | From Graphics Registry |
| `graphics.primary.triggerMode` | Dropdown | auto, cued, on-score, timed |
| `audio.preset` | Dropdown | From audio presets |
| `notes` | Textarea | Optional |

#### Acceptance Criteria

- [ ] Clicking segment row selects it and opens detail panel
- [ ] Detail panel pre-fills all fields with segment data
- [ ] All editable fields can be modified
- [ ] "Save Changes" button disabled when no changes made
- [ ] "Save Changes" button enabled after any field change
- [ ] Unsaved changes indicator visible when changes pending
- [ ] Save updates Firebase at correct path
- [ ] `meta.modifiedAt` updated on save
- [ ] Toast shows "Changes saved" on success
- [ ] Switching segments with unsaved changes shows confirmation dialog
- [ ] "Discard" in confirmation discards changes and switches
- [ ] "Save" in confirmation saves then switches

---

### US-03: Delete a Segment

**As a producer**, I need to remove a segment from the rundown when it's no longer needed.

#### Trigger

Click "Delete" button in the detail panel (segment must be selected).

#### UI Flow

```
1. User selects segment "Event Intro" (row 3)
   │
   ▼
2. Detail panel shows segment with [Delete] button
   │
   ▼
3. User clicks [Delete]
   │
   ▼
4. Confirmation dialog appears:
   ┌─────────────────────────────────────────────┐
   │                                             │
   │  Delete Segment?                            │
   │                                             │
   │  Are you sure you want to delete            │
   │  "Event Intro"?                             │
   │                                             │
   │  This action cannot be undone.              │
   │                                             │
   │              [Cancel]  [Delete]             │
   │                         ↑                   │
   │                         Red/destructive     │
   └─────────────────────────────────────────────┘
   │
   ▼
5. User clicks [Delete]
   - Segment removed from Firebase
   - All segments after deleted one have order decremented
   - Detail panel clears (no selection)
   - Toast: "Segment deleted"
   │
   ▼
6. If user clicks [Cancel]
   - Dialog closes
   - No changes made
```

#### Acceptance Criteria

- [ ] Delete button visible in detail panel when segment selected
- [ ] Delete button shows confirmation dialog
- [ ] Dialog shows segment name being deleted
- [ ] Dialog has Cancel and Delete buttons
- [ ] Delete button styled as destructive (red)
- [ ] Cancel closes dialog with no changes
- [ ] Delete removes segment from Firebase
- [ ] Segments after deleted one have order updated
- [ ] Detail panel clears after deletion
- [ ] Toast shows "Segment deleted"
- [ ] Segment list updates to reflect deletion

---

### US-04: Reorder Segments

**As a producer**, I need to change segment order to adjust the show flow.

#### UI Approach

Arrow buttons (Up/Down) on each segment row - NO drag-and-drop.

#### UI Layout

```
┌─ SEGMENT LIST ─────────────────────────────────────────────────────────────┐
│                                                                             │
│  ☐ │ ↑ ↓ │ # │ NAME                    │ TYPE   │ DUR  │ SCENE             │
│ ───┼─────┼───┼─────────────────────────┼────────┼──────┼───────────────────│
│  ☐ │ ░ ↓ │ 1 │ Show Intro              │ video  │ 0:45 │ Starting Soon     │
│     │ ↑   │   │                         │        │      │                   │
│     │ disabled (first)                  │        │      │                   │
│ ───┼─────┼───┼─────────────────────────┼────────┼──────┼───────────────────│
│  ☐ │ ↑ ↓ │ 2 │ Welcome & Host          │ live   │ 0:30 │ Talent Camera     │
│ ───┼─────┼───┼─────────────────────────┼────────┼──────┼───────────────────│
│  ☐ │ ↑ ↓ │ 3 │ Event Intro             │ static │ 0:08 │ Graphics FS       │
│ ───┼─────┼───┼─────────────────────────┼────────┼──────┼───────────────────│
│  ☑ │ ↑ ↓ │ 4 │ UCLA Introduction       │ live   │ 0:10 │ Single - Cam 2    │
│     │     │   │ ← selected              │        │      │                   │
│ ───┼─────┼───┼─────────────────────────┼────────┼──────┼───────────────────│
│  ☐ │ ↑ ░ │ 5 │ Oregon Intro            │ live   │ 0:10 │ Single - Cam 3    │
│     │   ↓ │   │                         │        │      │                   │
│     │   disabled (last)                 │        │      │                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Behavior

**Move Up (↑ button):**
1. Swap selected segment with the one above it
2. Update `order` field for both segments
3. Save to Firebase
4. Selection follows the moved segment

**Move Down (↓ button):**
1. Swap selected segment with the one below it
2. Update `order` field for both segments
3. Save to Firebase
4. Selection follows the moved segment

**Button States:**
- ↑ disabled on first segment
- ↓ disabled on last segment
- Both disabled when no segment selected

#### Acceptance Criteria

- [ ] Each segment row has ↑ and ↓ arrow buttons
- [ ] ↑ button disabled on first segment (order=0)
- [ ] ↓ button disabled on last segment
- [ ] Clicking ↑ swaps segment with previous one
- [ ] Clicking ↓ swaps segment with next one
- [ ] Swap updates `order` field for both segments
- [ ] Changes saved to Firebase immediately
- [ ] Selection follows the moved segment
- [ ] Segment numbers (#) update to reflect new order
- [ ] No toast needed (immediate visual feedback)

---

### US-05: Bulk Selection (for future multi-select features)

**As a producer**, I need to select multiple segments to calculate total duration or perform bulk actions.

#### UI Layout

```
┌─ SEGMENT LIST ─────────────────────────────────────────────────────────────┐
│                                                                             │
│  [☐ Select All]  │  Selected: 3  │  Total: 0:53                            │
│                                                                             │
│  ☑ │ ↑ ↓ │ 1 │ Show Intro              │ video  │ 0:45 │ Starting Soon     │
│  ☐ │ ↑ ↓ │ 2 │ Welcome & Host          │ live   │ 0:30 │ Talent Camera     │
│  ☑ │ ↑ ↓ │ 3 │ Event Intro             │ static │ 0:08 │ Graphics FS       │
│  ☐ │ ↑ ↓ │ 4 │ UCLA Introduction       │ live   │ 0:10 │ Single - Cam 2    │
│  ☑ │ ↑ ↓ │ 5 │ Oregon Intro            │ live   │ 0:10 │ Single - Cam 3    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Selection: Segments 1, 3, 5 = 0:45 + 0:08 + 0:10 = 1:03 total
```

#### Selection Mechanics

| Action | Result |
|--------|--------|
| Click checkbox | Toggle single segment selection |
| Shift+Click checkbox | Select range from last clicked |
| Click "Select All" | Toggle all segments |
| Click segment row (not checkbox) | Single-select for editing (clears multi-select) |

#### Acceptance Criteria

- [ ] Each row has a checkbox for multi-select
- [ ] "Select All" checkbox in header
- [ ] Selected count shown: "Selected: N"
- [ ] Total duration of selected segments shown
- [ ] Shift+Click selects range
- [ ] Clicking row (not checkbox) clears multi-select and opens detail panel
- [ ] Multi-select does NOT open detail panel

---

## 13. Resolved Design Questions

| Question | Decision |
|----------|----------|
| OBS disconnected behavior | Show cached scenes with warning badge |
| Hold segment duration | Simple hold (no duration), manual advance only |
| Routing | Competition-bound: `/{compId}/rundown` |
| Segment order start | 0 (array index based) |
| Max segment name | 100 characters |
| Reorder UX | Arrow buttons (Up/Down), no drag-and-drop |
| Edit UX | Detail panel on right side |
| Delete UX | Confirmation dialog required |
| Add segment position | After selected segment (or at end if none selected) |
| Real-time collaboration | Skip for Phase 1 (single-user editing) |

---

## 14. Implementation Phases

### Phase 0: UI Prototype (Static/Dummy)

**Goal:** Validate UX by building clickable prototypes with hardcoded data before any backend work. This allows stakeholders to walk through all user stories and catch UX issues early.

#### Phase 0A: Rundown Editor Prototype

**Route:** `/{compId}/rundown`

**Components to build:**

| Component | File | Behavior |
|-----------|------|----------|
| RundownEditorPage | `pages/RundownEditorPage.jsx` | Main page layout with split panel |
| SegmentList | `components/rundown/SegmentList.jsx` | Hardcoded 6-8 segments, local React state |
| SegmentDetail | `components/rundown/SegmentDetail.jsx` | Form with all fields, pre-filled dummy data |
| ScenePicker | `components/rundown/pickers/ScenePicker.jsx` | Hardcoded scene names (simulating OBS) |
| TransitionPicker | `components/rundown/pickers/TransitionPicker.jsx` | Cut, Fade, Stinger options |
| GraphicsPicker | `components/rundown/pickers/GraphicsPicker.jsx` | Hardcoded graphics list by category |
| AudioPicker | `components/rundown/pickers/AudioPicker.jsx` | Hardcoded audio presets |

**Interactions (all local state, no persistence):**

| Action | Behavior |
|--------|----------|
| Click segment row | Select segment, show in detail panel |
| + Add Segment | Insert new segment after selected (or at end) |
| ↑/↓ arrows | Swap segment order in local state |
| Delete button | Show confirmation dialog, remove from local state |
| Save button | Show toast "Segment saved" (no actual persistence) |
| Checkbox click | Toggle multi-select |
| Shift+Click | Select range |

**Hardcoded Test Data:**

```javascript
const DUMMY_SEGMENTS = [
  { id: 'seg-001', name: 'Show Intro', type: 'video', duration: 45, scene: 'Starting Soon' },
  { id: 'seg-002', name: 'Welcome & Host', type: 'live', duration: 30, scene: 'Talent Camera' },
  { id: 'seg-003', name: 'Event Introduction', type: 'static', duration: 8, scene: 'Graphics Fullscreen' },
  { id: 'seg-004', name: 'UCLA Introduction', type: 'live', duration: 10, scene: 'Single - Camera 2' },
  { id: 'seg-005', name: 'Oregon Introduction', type: 'live', duration: 10, scene: 'Single - Camera 3' },
  { id: 'seg-006', name: 'Utah Introduction', type: 'live', duration: 10, scene: 'Single - Camera 4' },
  { id: 'seg-007', name: 'Floor - Rotation 1', type: 'live', duration: null, scene: 'Single - Camera 4' },
];

const DUMMY_SCENES = [
  { name: 'Starting Soon', category: 'static' },
  { name: 'BRB', category: 'static' },
  { name: 'Thanks for Watching', category: 'static' },
  { name: 'Single - Camera 1', category: 'single' },
  { name: 'Single - Camera 2', category: 'single' },
  { name: 'Single - Camera 3', category: 'single' },
  { name: 'Single - Camera 4', category: 'single' },
  { name: 'Dual - Cam1 + Cam2', category: 'multi' },
  { name: 'Quad View', category: 'multi' },
  { name: 'Talent Camera', category: 'manual' },
  { name: 'Graphics Fullscreen', category: 'graphics' },
];

const DUMMY_GRAPHICS = [
  { id: 'team-logos', name: 'Team Logos', category: 'pre-meet' },
  { id: 'team-stats', name: 'Team Stats', category: 'pre-meet' },
  { id: 'event-frame-vt', name: 'Vault Frame', category: 'event-frame' },
  { id: 'event-frame-ub', name: 'Uneven Bars Frame', category: 'event-frame' },
  { id: 'score-reveal', name: 'Score Reveal', category: 'live' },
];
```

**Validates User Stories:**
- US-01: Create a New Segment
- US-02: Edit an Existing Segment
- US-03: Delete a Segment
- US-04: Reorder Segments
- US-05: Bulk Selection

#### Phase 0B: Producer View Prototype

**Location:** New components embedded in existing ProducerPage, or temporary test route `/{compId}/rundown-preview`

**Components to build:**

| Component | File | Behavior |
|-----------|------|----------|
| NowPlaying | `components/rundown/NowPlaying.jsx` | Current segment with progress bar |
| UpNext | `components/rundown/UpNext.jsx` | Next segment preview |
| ShowProgress | `components/rundown/ShowProgress.jsx` | Scrollable segment list with status icons |

**Interactions (all local state):**

| Action | Behavior |
|--------|----------|
| Click "Next" / Advance | Move currentIndex to next segment |
| Progress bar fills | Based on elapsed time vs duration |
| Overtime triggers | When elapsed > duration, show red pulsing indicator |
| Segment status icons | ✅ completed, ▶️ current, ⬜ upcoming |

**Producer View Test Flow:**

```
1. Page loads with segment 0 as current
2. Timer starts counting up
3. Progress bar fills as time elapses
4. When duration exceeded → OVERTIME indicator appears (red, pulsing)
5. Click "Advance" → segment 0 marked complete, segment 1 becomes current
6. Repeat through all segments
```

#### Phase 0 Exit Criteria

- [ ] Rundown Editor: Can create a new segment with all required fields
- [ ] Rundown Editor: Can edit any field on an existing segment
- [ ] Rundown Editor: Can delete a segment with confirmation
- [ ] Rundown Editor: Can reorder segments with ↑/↓ arrows
- [ ] Rundown Editor: Can multi-select segments and see total duration
- [ ] Producer View: NowPlaying shows current segment with progress bar
- [ ] Producer View: UpNext shows next segment
- [ ] Producer View: Can advance through segments
- [ ] Producer View: Overtime indicator displays when segment runs long
- [ ] Stakeholder sign-off on UX before proceeding to Phase 1

---

### Phase 1: Backend Services

**Goal:** Build the server-side infrastructure for rundown persistence and milestone calculation.

| File | Purpose |
|------|---------|
| `server/lib/rundownService.js` | CRUD operations for segments in Firebase |
| `server/lib/milestoneCalculator.js` | Auto-detect milestones from segment list |
| `server/lib/graphicsRegistry.js` | Access graphics registry from Firebase |
| `server/routes/rundown.js` | REST API endpoints |

**Modified:** `server/index.js` - Add rundown routes

---

### Phase 2: Frontend Integration

**Goal:** Connect Phase 0 prototypes to real data sources.

| Task | Details |
|------|---------|
| Replace hardcoded segments | Use `useRundown()` hook with Firebase |
| Replace hardcoded scenes | Use `useOBS()` hook → `obsState.scenes` |
| Replace hardcoded graphics | Fetch from graphics registry |
| Wire save/delete | Call API endpoints, show real success/error |
| Add RundownContext | Share rundown state across components |

**New files:**
- `show-controller/src/hooks/useRundown.js`
- `show-controller/src/context/RundownContext.jsx`

**Modified:** `show-controller/src/App.jsx` - Add rundown route

---

### Phase 3: Producer View Integration

**Goal:** Connect Producer View components to live rundown and OBS.

| Task | Details |
|------|---------|
| Live segment tracking | Sync currentSegmentIndex to Firebase |
| OBS scene switching | On segment advance, call `switchScene()` |
| Graphics triggering | Fire graphics based on segment config |
| Real-time sync | Multiple producers see same state |

**Modified:** `show-controller/src/pages/ProducerPage.jsx` - Integrate rundown components

---

### Phase 4: Templates & Advanced Features

**Goal:** Add power-user features for reusability and collaboration.

| Feature | Details |
|---------|---------|
| Template system | Save/load rundown templates by meet type |
| Variable substitution | `{{team1.name}}` → actual team name |
| CSV import/export | Bidirectional CSV support |
| Real-time collaboration | Multi-user editing with conflict resolution |

**New files:**
- `server/lib/rundownTemplateService.js`

---

## Data Models

### Segment

```typescript
interface Segment {
  id: string;
  name: string;
  type: 'video' | 'live' | 'static' | 'break' | 'hold' | 'graphic';

  timing: {
    duration: number | null;
    durationUnit: 'seconds' | 'minutes';
    autoAdvance: boolean;
    countdown: boolean;
    hold?: {
      enabled: boolean;
      minDuration: number | null;
      maxDuration: number | null;
    };
  };

  obs: {
    sceneId: string;
    transition: {
      type: string;
      duration: number;
    };
  };

  camera?: {
    cameraId: string;
    intendedApparatus: string[];
  };

  audio: {
    preset: string;
    levels?: Record<string, number>;
  };

  graphics: {
    primary?: GraphicConfig;
    secondary?: GraphicConfig[];
    onScore?: GraphicConfig;
  };

  milestone?: {
    type: string;
    label: string;
  };

  notes: string;
  order: number;

  meta: {
    createdAt: string;
    modifiedAt: string;
    modifiedBy: string;
  };
}

interface GraphicConfig {
  graphicId: string;
  parameters?: Record<string, any>;
  triggerMode: 'auto' | 'cued' | 'on-score' | 'timed';
  duration?: number;
  autoTrigger: boolean;
  delay?: number;
}
```

### Milestone

```typescript
interface Milestone {
  type: string;
  time: number;
  segmentIndex: number;
  label: string;
}
```

### Graphics Registry Entry

```typescript
interface GraphicRegistryEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  dataSource: 'firebase-config' | 'virtius-api' | 'static';
  defaultDuration: number | null;
  persistent: boolean;
  parameters: GraphicParameter[];
  genderFilter: 'mens' | 'womens' | null;
  triggerType?: string;
}

interface GraphicParameter {
  name: string;
  type: 'team-select' | 'apparatus-select' | 'text' | 'number';
  label: string;
  required: boolean;
  options?: string[];
}
```

---

## API Specification

**Important Note on OBS Operations:** Do NOT create REST endpoints for OBS scene/transition/audio operations. OBS data must be accessed via Socket.io events through OBSContext, which routes through the coordinator to the competition VM's OBS. REST calls would fail in production with "Socket not identified" errors. See [README-OBS-Architecture.md](README-OBS-Architecture.md#mistake-5-use-rest-api-for-obs-operations) for details.

### Rundown Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/rundown` | Get full rundown |
| PUT | `/api/rundown` | Update full rundown |
| POST | `/api/rundown/segments` | Add segment |
| PUT | `/api/rundown/segments/:id` | Update segment |
| DELETE | `/api/rundown/segments/:id` | Delete segment |
| PUT | `/api/rundown/segments/reorder` | Reorder segments |
| GET | `/api/rundown/milestones` | Get calculated milestones |
| GET | `/api/rundown/export/csv` | Export as CSV |
| GET | `/api/rundown/export/json` | Export as JSON |
| POST | `/api/rundown/import/csv` | Import from CSV |

### Graphics Registry Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/graphics/registry` | Get full registry |
| GET | `/api/graphics/registry/:id` | Get graphic details |

### Template Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/rundown/templates` | List templates |
| GET | `/api/rundown/templates/:id` | Get template |
| POST | `/api/rundown/templates` | Save current as template |
| POST | `/api/rundown/templates/:id/apply` | Apply template |

---

## File Manifest

### New Files

| File | Phase | Est. Lines | Purpose |
|------|-------|------------|---------|
| `show-controller/src/pages/RundownEditorPage.jsx` | 0A | 300 | Main editor page (prototype) |
| `show-controller/src/components/rundown/SegmentList.jsx` | 0A | 250 | Segment list with selection |
| `show-controller/src/components/rundown/SegmentDetail.jsx` | 0A | 300 | Detail panel form |
| `show-controller/src/components/rundown/pickers/ScenePicker.jsx` | 0A | 100 | OBS scene dropdown (hardcoded) |
| `show-controller/src/components/rundown/pickers/TransitionPicker.jsx` | 0A | 80 | Transition dropdown |
| `show-controller/src/components/rundown/pickers/GraphicsPicker.jsx` | 0A | 120 | Graphics dropdown (hardcoded) |
| `show-controller/src/components/rundown/pickers/AudioPicker.jsx` | 0A | 80 | Audio preset dropdown |
| `show-controller/src/components/rundown/NowPlaying.jsx` | 0B | 150 | Current segment display |
| `show-controller/src/components/rundown/UpNext.jsx` | 0B | 80 | Next segment preview |
| `show-controller/src/components/rundown/ShowProgress.jsx` | 0B | 200 | Segment list with status |
| `server/lib/rundownService.js` | 1 | 400 | Rundown business logic |
| `server/lib/milestoneCalculator.js` | 1 | 150 | Milestone detection |
| `server/lib/graphicsRegistry.js` | 1 | 200 | Graphics registry access |
| `server/routes/rundown.js` | 1 | 300 | API routes |
| `show-controller/src/hooks/useRundown.js` | 2 | 150 | Rundown data hook |
| `show-controller/src/context/RundownContext.jsx` | 2 | 100 | Rundown state context |
| `show-controller/src/components/rundown/MilestoneTimeline.jsx` | 2 | 150 | Timeline component |
| `show-controller/src/components/rundown/SelectionSummary.jsx` | 2 | 100 | Selection summary |
| `server/lib/rundownTemplateService.js` | 4 | 250 | Template management |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `show-controller/src/App.jsx` | 0A | Add `/rundown` route for prototype |
| `server/index.js` | 1 | Add rundown API routes |
| `show-controller/src/components/rundown/pickers/*.jsx` | 2 | Replace hardcoded data with real sources |
| `show-controller/src/pages/ProducerPage.jsx` | 3 | Integrate NowPlaying, UpNext, ShowProgress |

---

## Success Criteria

### Feature Acceptance

| Feature | Criteria |
|---------|----------|
| Segment CRUD | Create, edit, delete, reorder segments |
| OBS Scene Picker | Lists scenes from OBS State Sync |
| Graphics Picker | Lists graphics from registry, filters by gender |
| Audio Picker | Lists presets from Firebase |
| Milestones | Auto-detects and displays milestones |
| Multi-select | Selection with time calculation works |
| Templates | Can save/load rundown templates |
| CSV Import/Export | Bidirectional CSV support |
| Real-time sync | Multi-user editing with Firebase |

### Performance

| Metric | Target |
|--------|--------|
| Segment list render | < 100ms for 100 segments |
| Picker opening | < 200ms |
| Firebase sync | < 500ms |
| Milestone calculation | < 50ms |

---

## Dependencies

This PRD depends on:

1. **OBS Integration Tool** (PRD-OBSIntegrationTool-2026-01-16.md)
   - OBS state via Socket.io events (obs:stateUpdated) for scene/transition/audio data
   - Audio presets for audio picker

2. **OBS Architecture** (README-OBS-Architecture.md)
   - Understanding that frontend connects to coordinator, NOT directly to VMs
   - OBS commands route: Frontend → Coordinator → Competition VM's OBS
   - Use Socket.io events (NOT REST APIs) for OBS operations

3. **Graphics Registry** (to be created)
   - System-wide graphics definitions
   - Parameter schemas

4. **Existing Infrastructure**
   - Firebase Realtime Database
   - Socket.io for real-time updates (including OBS state)
   - Competition context (determines which VM's OBS to connect to)
   - OBSContext for OBS state and commands
