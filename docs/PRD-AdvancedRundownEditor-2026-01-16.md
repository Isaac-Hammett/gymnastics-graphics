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
12. [Data Models](#data-models)
13. [API Specification](#api-specification)
14. [File Manifest](#file-manifest)
15. [Success Criteria](#success-criteria)

---

## 1. System Integration Overview

The Rundown Editor integrates with three dynamic systems that can change at runtime:

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
│   State Sync)   │  │                 │  │                 │
│                 │  │                 │  │                 │
│ - Scenes        │  │ - All graphics  │  │ - Camera list   │
│ - Transitions   │  │ - Categories    │  │ - Apparatus     │
│ - Audio sources │  │ - Parameters    │  │ - Health        │
│ - Inputs        │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Key Principle:** No hardcoded lists. Everything pulled dynamically from source systems.

---

## 2. Dynamic Data Sources

### 2.1 OBS Data (via OBS State Sync Service)

The Rundown Editor receives OBS data from the OBS State Sync Service (Phase 1 of OBS Integration Tool):

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

Dynamically populated from OBS State Sync:

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
| `server/lib/rundownService.js` | 1 | 400 | Rundown business logic |
| `server/lib/milestoneCalculator.js` | 1 | 150 | Milestone detection |
| `server/lib/graphicsRegistry.js` | 1 | 200 | Graphics registry access |
| `server/lib/rundownTemplateService.js` | 2 | 250 | Template management |
| `server/routes/rundown.js` | 1 | 300 | API routes |
| `show-controller/src/pages/RundownEditor.jsx` | 3 | 400 | Main editor page |
| `show-controller/src/components/rundown/SegmentList.jsx` | 3 | 300 | Segment list |
| `show-controller/src/components/rundown/SegmentDetail.jsx` | 3 | 350 | Detail panel |
| `show-controller/src/components/rundown/MilestoneTimeline.jsx` | 3 | 150 | Timeline component |
| `show-controller/src/components/rundown/SelectionSummary.jsx` | 3 | 100 | Selection summary |
| `show-controller/src/components/rundown/pickers/ScenePicker.jsx` | 3 | 150 | OBS scene picker |
| `show-controller/src/components/rundown/pickers/TransitionPicker.jsx` | 3 | 100 | Transition picker |
| `show-controller/src/components/rundown/pickers/AudioPicker.jsx` | 3 | 120 | Audio preset picker |
| `show-controller/src/components/rundown/pickers/GraphicsPicker.jsx` | 3 | 200 | Graphics picker |
| `show-controller/src/components/rundown/NowPlaying.jsx` | 4 | 200 | Now playing component |
| `show-controller/src/components/rundown/UpNext.jsx` | 4 | 100 | Up next component |
| `show-controller/src/components/rundown/ShowProgress.jsx` | 4 | 250 | Progress list |
| `show-controller/src/hooks/useRundown.js` | 3 | 150 | Rundown hook |
| `show-controller/src/context/RundownContext.jsx` | 3 | 100 | Rundown context |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `server/index.js` | 1 | Add rundown routes |
| `show-controller/src/App.jsx` | 3 | Add rundown route |
| `show-controller/src/pages/ProducerPage.jsx` | 4 | Integrate rundown components |

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
   - OBS State Sync Service for scene/transition/audio data
   - Audio presets for audio picker

2. **Graphics Registry** (to be created)
   - System-wide graphics definitions
   - Parameter schemas

3. **Existing Infrastructure**
   - Firebase Realtime Database
   - Socket.io for real-time updates
   - Competition context
