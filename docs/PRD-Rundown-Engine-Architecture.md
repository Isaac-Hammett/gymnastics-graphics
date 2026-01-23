# PRD: Rundown Engine Architecture

**Version:** 1.0
**Date:** 2026-01-23
**Project:** Gymnastics Graphics
**Status:** DRAFT
**Parent PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](./PRD-AdvancedRundownEditor-2026-01-22.md)
**Dependencies:** PRD-Rundown-01 (Editor Prototype), PRD-OBSIntegrationTool

---

## Executive Summary

This PRD defines the **Rundown Engine** — a centralized state machine that transforms the gymnastics graphics system from a collection of disconnected views into a unified execution platform. The Engine serves as the single source of truth for segment state, timing, AI-generated context, and automation triggers, consumed by multiple views (Producer, Talent, future Graphics Op).

### Key Innovations

1. **Centralized State Machine**: Single engine managing segment progression, timing, and automation
2. **AI Context Layer**: Server-computed intelligence (career highs, records, talking points) pushed to clients
3. **Extended Segment Model**: Talent-specific content (notes, talking points) directly in segment data
4. **Multi-View Architecture**: Same engine powering Producer (full control), Talent (info + fallback), and future views

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture Vision](#2-architecture-vision)
3. [System Layers](#3-system-layers)
4. [Current State Analysis](#4-current-state-analysis)
5. [Rundown Engine Design](#5-rundown-engine-design)
6. [Extended Segment Model](#6-extended-segment-model)
7. [useRundownEngine Hook](#7-userundownengine-hook)
8. [AI Context Service](#8-ai-context-service)
9. [View Integrations](#9-view-integrations)
10. [Firebase Structure](#10-firebase-structure)
11. [Socket Event Flow](#11-socket-event-flow)
12. [Implementation Phases](#12-implementation-phases)
13. [File Manifest](#13-file-manifest)
14. [Success Criteria](#14-success-criteria)
15. [Open Questions](#15-open-questions)

---

## 1. Problem Statement

### Current Gaps

| Gap | Impact |
|-----|--------|
| **God Context Problem** | `ShowContext` handles too much (shows, timesheet, OBS, cameras, graphics) making it difficult to extend |
| **No AI Context Layer** | No career highs, records, talking points, or real-time alerts for talent |
| **No Talent-Specific Content** | Segment model lacks notes, talking points that talent needs during live shows |
| **Tight Coupling** | All hooks depend directly on ShowContext socket, no abstraction layer |
| **Disconnected Editor** | `RundownEditorPage` uses local state, not connected to live execution system |
| **No Unified State** | Producer View, Talent View, and future views have no shared state machine |

### Why This Matters

During a live gymnastics broadcast:
- **Talent** needs to know what stats are on screen, career context, and what to talk about
- **Producers** need full control plus visibility into what talent sees
- **Graphics operators** need cued graphics and timing information
- **Everyone** needs to see the same state, in real-time

---

## 2. Architecture Vision

### From Views to Engine

**Before:** Disconnected views with duplicated state logic
```
ProducerView ←→ useTimesheet ←→ ShowContext ←→ Socket.io
TalentView   ←→ useTimesheet ←→ ShowContext ←→ Socket.io
(No shared engine, no AI context, no talent content)
```

**After:** Centralized engine powering all views
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RUNDOWN ENGINE                                     │
│                    (Central State Machine)                                   │
│                                                                              │
│  Segment State ──→ Timing State ──→ Graphics State ──→ Automation State     │
│        │                                                                     │
│        └──────────────→ AI Context Layer                                    │
│                         • Live scoring API data                              │
│                         • Historical comparisons                             │
│                         • Real-time alerts (career high, records)           │
│                                                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────────────┐
         │                             │                                     │
         ▼                             ▼                                     ▼
   Producer View                 Talent View                        Graphics Op View
   (full control)                (info + fallback)                  (future)
```

---

## 3. System Layers

The system operates in two distinct layers:

### Planning Layer (Rundown Editor)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              PLANNING LAYER                                   │
│                                                                               │
│  ┌─────────────────────────────┐                                             │
│  │  RundownEditorPage          │  ← Standalone planning tool (PRD-01)        │
│  │  (/{compId}/rundown)        │  ← Builds segment config, saves templates   │
│  │                             │  ← NOT connected to live execution          │
│  │  Features:                  │                                             │
│  │  • Segment CRUD             │                                             │
│  │  • Multi-select & reorder   │                                             │
│  │  • Graphics/OBS pickers     │                                             │
│  │  • Template save/load       │                                             │
│  │  • Talent content editing   │  ← NEW: Edit talking points, notes         │
│  └──────────────┬──────────────┘                                             │
│                 │                                                             │
│                 │ Saves segments to Firebase:                                │
│                 │ competitions/{compId}/production/rundown                   │
│                 ▼                                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Execution Layer (Rundown Engine)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              EXECUTION LAYER                                  │
│                                                                               │
│  ┌─────────────────────────────┐                                             │
│  │  RUNDOWN ENGINE             │  ← Central state machine                    │
│  │  (Server: TimesheetEngine)  │  ← Reads segments from Firebase             │
│  │                             │  ← Computes timing, AI context              │
│  │  Components:                │  ← Triggers OBS scenes, graphics            │
│  │  • Segment state manager    │  ← Broadcasts state via Socket.io           │
│  │  • Timing engine            │                                             │
│  │  • AI context service       │                                             │
│  │  • Automation controller    │                                             │
│  └──────────────┬──────────────┘                                             │
│                 │                                                             │
│                 │ Socket.io: timesheetState, aiContextUpdated               │
│                 ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         useRundownEngine()                               │ │
│  │  (Client hook - wraps useTimesheet + adds AI context + talent content)   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                 │                                                             │
│       ┌─────────┼─────────┬─────────────┐                                    │
│       │         │         │             │                                    │
│       ▼         ▼         ▼             ▼                                    │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌─────────┐                          │
│  │Producer │ │ Talent  │ │Graphics Op│ │ Future  │                          │
│  │  View   │ │  View   │ │  (future) │ │  Views  │                          │
│  └─────────┘ └─────────┘ └───────────┘ └─────────┘                          │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Current State Analysis

### Existing Architecture

```
CompetitionContext (config bootstrap)
    ↓
ShowContext (GOD CONTEXT - handles everything)
    ├── useTimesheet (wraps timesheet state)
    ├── useOBS (wraps OBS state via OBSContext)
    ├── useCameraHealth
    └── useCameraRuntime

+ Standalone:
    ├── useAlerts (Firebase alerts)
    ├── useCoordinator (EC2 lifecycle)
    └── RundownEditorPage (local state only, not connected to live system)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| ShowContext.jsx | `/show-controller/src/context/ShowContext.jsx` | GOD CONTEXT - manages show, timesheet, OBS, cameras |
| useTimesheet.js | `/show-controller/src/hooks/useTimesheet.js` | Thin wrapper around ShowContext for segment timing |
| ProducerView.jsx | `/show-controller/src/views/ProducerView.jsx` | Full control center |
| TalentView.jsx | `/show-controller/src/views/TalentView.jsx` | Minimal talent interface |
| RundownEditorPage.jsx | `/show-controller/src/pages/RundownEditorPage.jsx` | Standalone planning tool |
| TimesheetEngine | `/server/lib/timesheetEngine.js` | Server-side timing engine |

### What Works (Keep)

- `useTimesheet()` provides millisecond-precision timing
- `ShowContext` socket connection is stable
- `TimesheetEngine` handles segment progression server-side
- `RundownEditorPage` has complete CRUD functionality
- Segment model is well-defined

### What's Missing (Add)

| Missing | Solution |
|---------|----------|
| AI context (stats, facts, alerts) | New `AIContextService` on server |
| Talent-specific content | Extend segment model with `talent` field |
| Unified engine abstraction | New `useRundownEngine()` hook |
| Multi-view consistency | All views consume same engine hook |

---

## 5. Rundown Engine Design

### Design Principles

1. **Single Source of Truth**: Engine state is authoritative for all views
2. **Server-Computed Intelligence**: AI context generated server-side, pushed to clients
3. **Extend, Don't Replace**: Build on existing `useTimesheet()`, don't break it
4. **View Agnostic**: Engine doesn't know about views, views consume engine state
5. **Graceful Degradation**: Views work without AI context (just less rich)

### Engine State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENGINE STATE MACHINE                                 │
│                                                                              │
│  States:                                                                     │
│  ┌──────────┐    start()    ┌──────────┐    stop()    ┌──────────┐         │
│  │ STOPPED  │ ────────────→ │ RUNNING  │ ───────────→ │ STOPPED  │         │
│  └──────────┘               └──────────┘               └──────────┘         │
│                                  │                                           │
│                                  │ advance()                                │
│                                  ▼                                           │
│                             ┌──────────┐                                     │
│                             │  HOLD    │ (if segment.type === 'hold')       │
│                             │ WAITING  │                                     │
│                             └──────────┘                                     │
│                                  │                                           │
│                                  │ advance() (when canAdvanceHold)          │
│                                  ▼                                           │
│                             ┌──────────┐                                     │
│                             │ RUNNING  │ (next segment)                      │
│                             └──────────┘                                     │
│                                                                              │
│  On Each Segment Advance:                                                    │
│  1. Update currentIndex, currentSegment                                      │
│  2. Reset timing (elapsed = 0)                                              │
│  3. Generate AI context for new segment                                      │
│  4. Trigger OBS scene (if automation enabled)                               │
│  5. Queue graphics (based on triggerMode)                                   │
│  6. Broadcast state to all clients                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Engine Responsibilities

| Responsibility | Implementation |
|----------------|----------------|
| Segment Progression | Existing `TimesheetEngine` |
| Timing (ms precision) | Existing `useTimesheet()` |
| AI Context Generation | New `AIContextService` |
| OBS Automation | Existing `obsConnectionManager` |
| Graphics Automation | Existing graphics trigger system |
| State Broadcast | Existing Socket.io + new `aiContextUpdated` event |

---

## 6. Extended Segment Model

### Complete Schema

The segment model extends the existing PRD-AdvancedRundownEditor schema with new `talent` and `aiContext` fields:

```javascript
const segment = {
  // ═══════════════════════════════════════════════════════════════════════════
  // EXISTING FIELDS (from PRD-AdvancedRundownEditor)
  // ═══════════════════════════════════════════════════════════════════════════

  id: "seg-ucla-intro",
  name: "UCLA Introduction",
  type: "live", // video | live | static | break | hold | graphic

  timing: {
    duration: 10,                    // Duration in seconds (null for hold)
    durationUnit: "seconds",         // seconds | minutes
    autoAdvance: true,               // Auto-advance when duration expires
    countdown: false,                // Show countdown timer
    hold: {
      enabled: false,                // Is this a hold segment
      minDuration: null,             // Min time before can advance
      maxDuration: null,             // Max suggested duration
    },
  },

  obs: {
    sceneId: "Single - Camera 2",    // OBS scene to switch to
    transition: {
      type: "Fade",                  // Cut | Fade | Stinger
      duration: 300,                 // Transition duration in ms
    },
  },

  camera: {
    cameraId: "cam2",                // Camera to use
    intendedApparatus: ["VT"],       // Expected apparatus
  },

  audio: {
    preset: "commentary-focus",      // Audio preset name
    levels: {                        // Optional level overrides
      "Venue Audio": 80,
      "Commentary": 100,
      "Music": 0,
    },
  },

  graphics: {
    primary: {
      graphicId: "team-stats",       // Graphic ID from registry
      parameters: {                  // Graphic-specific parameters
        teamId: "ucla",
      },
      triggerMode: "cued",           // auto | cued | on-score | timed
      duration: 8,                   // Display duration in seconds
      autoTrigger: false,            // Fire automatically on segment start
    },
    secondary: [],                   // Additional graphics
    onScore: {                       // Triggered when score received
      graphicId: "score-reveal",
      autoTrigger: true,
    },
  },

  milestone: {
    type: "team-intro",              // Milestone type for timeline
    label: "UCLA Introduction",      // Display label
  },

  notes: "Wait for talent to finish host intro before advancing",
  order: 4,                          // Segment order (0-indexed)

  meta: {
    createdAt: "2026-01-14T10:00:00Z",
    modifiedAt: "2026-01-14T12:30:00Z",
    modifiedBy: "producer@example.com",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: TALENT CONTENT
  // Authored in RundownEditorPage, consumed by Talent View
  // ═══════════════════════════════════════════════════════════════════════════

  talent: {
    // Producer-written talking points for this segment
    talkingPoints: [
      "UCLA looking to extend their home winning streak",
      "Key matchup: Jordan Chiles vs Oregon's Jade Carey on floor",
    ],

    // Producer notes specifically for talent (brief guidance)
    notes: "Mention Jordan Chiles' floor routine - crowd was electric",

    // Per-talent personal notes (keyed by talentId)
    // Allows each talent to add their own notes per segment
    personalNotes: {
      // "talent-user-123": "My personal note about this segment"
    },

    // Pronunciation guide for names/terms
    pronunciations: {
      // "Yul Moldauer": "yool mole-DOW-er"
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: AI CONTEXT (populated at runtime by server)
  // Generated by AIContextService, pushed via Socket.io
  // NOT persisted in Firebase (ephemeral, regenerated on demand)
  // ═══════════════════════════════════════════════════════════════════════════

  aiContext: {
    // Stats currently displayed on graphic (so talent knows what's on screen)
    statsOnGraphic: {
      teamScore: 197.425,
      vt: 49.350,
      ub: 49.275,
      bb: 49.400,
      fx: 49.400,
    },

    // AI-generated key facts relevant to this segment
    keyFacts: [
      "UCLA's highest team score of the season",
      "2nd highest in program history (record: 198.075, 2024)",
      "Jordan Chiles leads all-around with 39.750",
    ],

    // Real-time alerts (career highs, records broken, etc.)
    alerts: [
      {
        type: "career-high",
        athlete: "Jordan Chiles",
        event: "FX",
        score: 9.950,
        previousBest: 9.925,
        timestamp: "2026-01-23T12:34:56Z",
      },
      {
        type: "season-best",
        team: "UCLA",
        event: "Team Total",
        score: 197.425,
        previousBest: 197.200,
        timestamp: "2026-01-23T12:35:10Z",
      },
    ],

    // When this context was generated
    generatedAt: "2026-01-23T12:34:56Z",
  },
};
```

### Field Categories

| Category | Fields | Authored By | When |
|----------|--------|-------------|------|
| **Core** | id, name, type, order | Producer | Planning |
| **Timing** | timing.* | Producer | Planning |
| **OBS** | obs.* | Producer | Planning |
| **Graphics** | graphics.* | Producer | Planning |
| **Audio** | audio.* | Producer | Planning |
| **Talent Content** | talent.* | Producer | Planning |
| **Talent Personal** | talent.personalNotes | Talent | Pre-show/Live |
| **AI Context** | aiContext.* | Server | Runtime |

---

## 7. useRundownEngine Hook

### Hook Specification

The core hook that all views consume, built on top of existing `useTimesheet()`:

```javascript
// show-controller/src/hooks/useRundownEngine.js

import { useMemo } from 'react';
import { useTimesheet } from './useTimesheet';
import { useShow } from '../context/ShowContext';

/**
 * useRundownEngine - Central hook for Rundown Engine state
 *
 * Wraps useTimesheet() and enriches it with:
 * - AI context (stats, facts, alerts)
 * - Talent content (talking points, notes)
 * - Unified state interface for all views
 *
 * @returns {RundownEngineState}
 */
export function useRundownEngine() {
  // ═══════════════════════════════════════════════════════════════════════════
  // BASE: Existing timesheet functionality
  // ═══════════════════════════════════════════════════════════════════════════
  const timesheet = useTimesheet();

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: AI context from ShowContext (received via socket events)
  // ═══════════════════════════════════════════════════════════════════════════
  const { aiContext } = useShow();

  // ═══════════════════════════════════════════════════════════════════════════
  // ENRICHED: Merge segment data with AI context
  // ═══════════════════════════════════════════════════════════════════════════
  const currentSegmentEnriched = useMemo(() => {
    if (!timesheet.currentSegment) return null;
    return {
      ...timesheet.currentSegment,
      aiContext: aiContext?.segments?.[timesheet.currentSegment.id] || {
        statsOnGraphic: {},
        keyFacts: [],
        alerts: [],
        generatedAt: null,
      },
    };
  }, [timesheet.currentSegment, aiContext]);

  const nextSegmentEnriched = useMemo(() => {
    if (!timesheet.nextSegment) return null;
    return {
      ...timesheet.nextSegment,
      aiContext: aiContext?.segments?.[timesheet.nextSegment.id] || {
        statsOnGraphic: {},
        keyFacts: [],
        alerts: [],
        generatedAt: null,
      },
    };
  }, [timesheet.nextSegment, aiContext]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN: Unified engine state
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    // === Segment State ===
    currentSegment: currentSegmentEnriched,
    nextSegment: nextSegmentEnriched,
    segments: timesheet.segments,
    currentIndex: timesheet.currentIndex,
    totalSegments: timesheet.totalSegments,

    // === Timing State ===
    elapsed: timesheet.elapsed,
    remaining: timesheet.remaining,
    progress: timesheet.progress,
    elapsedFormatted: timesheet.elapsedFormatted,
    remainingFormatted: timesheet.remainingFormatted,
    showElapsed: timesheet.showElapsed || 0,
    isOvertime: timesheet.remaining < 0,

    // === Engine State ===
    engineState: timesheet.isRunning ? 'running' : 'stopped',
    isRunning: timesheet.isRunning,
    isPaused: timesheet.isPaused,
    isHoldSegment: timesheet.isHoldSegment,
    canAdvanceHold: timesheet.canAdvanceHold,
    holdRemainingMs: timesheet.holdRemainingMs,

    // === AI Context (NEW) ===
    aiContext: currentSegmentEnriched?.aiContext || {
      statsOnGraphic: {},
      keyFacts: [],
      alerts: [],
      generatedAt: null,
    },

    // === Talent Content (NEW) ===
    talentContent: {
      talkingPoints: currentSegmentEnriched?.talent?.talkingPoints || [],
      notes: currentSegmentEnriched?.talent?.notes || '',
      personalNotes: currentSegmentEnriched?.talent?.personalNotes || {},
      pronunciations: currentSegmentEnriched?.talent?.pronunciations || {},
    },

    // === Actions (passthrough from useTimesheet) ===
    start: timesheet.start,
    stop: timesheet.stop,
    advance: timesheet.advance,
    previous: timesheet.previous,
    jumpTo: timesheet.jumpTo,

    // === Helpers ===
    formatTime: timesheet.formatTime,
    isFirstSegment: timesheet.isFirstSegment,
    isLastSegment: timesheet.isLastSegment,
  };
}
```

### Hook Usage Examples

**Producer View:**
```javascript
function ProducerView() {
  const {
    currentSegment,
    nextSegment,
    elapsed,
    remaining,
    progress,
    isOvertime,
    aiContext,
    talentContent,
    advance,
    previous,
  } = useRundownEngine();

  return (
    <div>
      <NowPlaying
        segment={currentSegment}
        elapsed={elapsed}
        remaining={remaining}
        progress={progress}
        isOvertime={isOvertime}
      />
      <UpNext segment={nextSegment} />
      <AIAlerts alerts={aiContext.alerts} />
      <TalkingPoints points={talentContent.talkingPoints} />
      <Controls onAdvance={advance} onPrevious={previous} />
    </div>
  );
}
```

**Talent View:**
```javascript
function TalentView() {
  const {
    currentSegment,
    nextSegment,
    aiContext,
    talentContent,
    remaining,
    isOvertime,
    advance, // Fallback control if Producer unavailable
  } = useRundownEngine();

  return (
    <div>
      <CurrentInfo
        segment={currentSegment}
        remaining={remaining}
        isOvertime={isOvertime}
      />
      <TalkingPoints points={talentContent.talkingPoints} />
      <ProducerNotes notes={talentContent.notes} />
      <OnScreenStats stats={aiContext.statsOnGraphic} />
      <KeyFacts facts={aiContext.keyFacts} />
      <LiveAlerts alerts={aiContext.alerts} />
      <UpNext segment={nextSegment} />
      <FallbackAdvance onAdvance={advance} />
    </div>
  );
}
```

---

## 8. AI Context Service

### Server-Side Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI CONTEXT SERVICE                                   │
│                     (server/lib/aiContextService.js)                         │
│                                                                              │
│  Inputs:                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ Current      │  │ Competition  │  │ Virtius API  │                       │
│  │ Segment      │  │ Config       │  │ Live Data    │                       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
│         │                 │                 │                                │
│         └─────────────────┼─────────────────┘                                │
│                           │                                                  │
│                           ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    generateContextForSegment()                          ││
│  │                                                                          ││
│  │  1. Determine graphic type (team-stats, athlete-bio, etc.)              ││
│  │  2. Fetch relevant data from Virtius API                                ││
│  │  3. Compare against historical data (career bests, records)             ││
│  │  4. Generate keyFacts based on segment context                          ││
│  │  5. Check for alerts (career highs, season bests, records)              ││
│  │  6. Return enriched aiContext object                                    ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                           │                                                  │
│                           ▼                                                  │
│  Output:                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                     │   │
│  │   statsOnGraphic: { teamScore, vt, ub, bb, fx },                     │   │
│  │   keyFacts: ["UCLA's highest score...", "2nd in history..."],        │   │
│  │   alerts: [{ type: "career-high", athlete: "...", ... }],            │   │
│  │   generatedAt: "2026-01-23T12:34:56Z"                                │   │
│  │ }                                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Implementation

```javascript
// server/lib/aiContextService.js

export class AIContextService {
  constructor(virtiusClient, firebaseAdmin) {
    this.virtius = virtiusClient;
    this.firebase = firebaseAdmin;
    this.cache = new Map(); // Cache recent queries
  }

  /**
   * Generate AI context for a segment
   * Called by TimesheetEngine on segment advance
   */
  async generateContextForSegment(segment, competitionConfig) {
    const context = {
      statsOnGraphic: {},
      keyFacts: [],
      alerts: [],
      generatedAt: new Date().toISOString(),
    };

    // Skip if segment has no graphic
    if (!segment.graphics?.primary?.graphicId) {
      return context;
    }

    const graphicId = segment.graphics.primary.graphicId;
    const params = segment.graphics.primary.parameters || {};

    try {
      // Generate context based on graphic type
      switch (graphicId) {
        case 'team-stats':
          context.statsOnGraphic = await this.getTeamStats(
            params.teamId,
            competitionConfig.competitionId
          );
          context.keyFacts = await this.generateTeamFacts(
            params.teamId,
            context.statsOnGraphic
          );
          break;

        case 'athlete-bio':
        case 'athlete-stats':
          context.statsOnGraphic = await this.getAthleteStats(
            params.athleteId,
            competitionConfig.competitionId
          );
          context.keyFacts = await this.generateAthleteFacts(
            params.athleteId,
            context.statsOnGraphic
          );
          break;

        case 'leaderboard':
          context.statsOnGraphic = await this.getLeaderboard(
            params.event,
            competitionConfig.competitionId
          );
          break;

        // Add more graphic types as needed
      }

      // Always check for recent alerts
      context.alerts = await this.getRecentAlerts(
        competitionConfig.competitionId
      );
    } catch (error) {
      console.error('[AIContextService] Error generating context:', error);
      // Return empty context on error, don't break the show
    }

    return context;
  }

  /**
   * Get team statistics for display
   */
  async getTeamStats(teamId, competitionId) {
    const cacheKey = `team-${teamId}-${competitionId}`;

    // Check cache (valid for 30 seconds)
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) {
        return cached.data;
      }
    }

    // Fetch from Virtius
    const stats = await this.virtius.getTeamScores(competitionId, teamId);

    // Cache result
    this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });

    return stats;
  }

  /**
   * Generate talking-point facts about a team
   */
  async generateTeamFacts(teamId, currentStats) {
    const facts = [];

    // Get historical data for comparison
    const seasonData = await this.virtius.getTeamSeasonData(teamId);

    // Compare current score to season
    if (currentStats.teamScore > seasonData.seasonHigh) {
      facts.push(`Season-high team score of ${currentStats.teamScore}`);
    } else if (currentStats.teamScore > seasonData.seasonAvg) {
      facts.push(`Above season average (${seasonData.seasonAvg})`);
    }

    // Check for program records
    const programRecords = await this.getTeamRecords(teamId);
    if (currentStats.teamScore >= programRecords.allTimeHigh - 0.5) {
      facts.push(
        `Within striking distance of program record (${programRecords.allTimeHigh})`
      );
    }

    // Add standings context
    const standings = await this.virtius.getConferenceStandings(teamId);
    facts.push(`Currently ${standings.rank}${ordinal(standings.rank)} in ${standings.conference}`);

    return facts.slice(0, 5); // Limit to 5 facts
  }

  /**
   * Check for recent career highs, records, etc.
   */
  async getRecentAlerts(competitionId) {
    const alerts = [];

    // Get recent scores from Virtius
    const recentScores = await this.virtius.getRecentScores(competitionId, {
      since: Date.now() - 300000, // Last 5 minutes
    });

    for (const score of recentScores) {
      // Check for career high
      const careerData = await this.getAthleteCareerData(score.athleteId);
      if (score.score > careerData.careerHigh[score.event]) {
        alerts.push({
          type: 'career-high',
          athlete: score.athleteName,
          event: score.event,
          score: score.score,
          previousBest: careerData.careerHigh[score.event],
          timestamp: score.timestamp,
        });
      }

      // Check for season best
      if (score.score > careerData.seasonBest[score.event]) {
        alerts.push({
          type: 'season-best',
          athlete: score.athleteName,
          event: score.event,
          score: score.score,
          previousBest: careerData.seasonBest[score.event],
          timestamp: score.timestamp,
        });
      }
    }

    return alerts;
  }
}
```

### Integration with TimesheetEngine

```javascript
// server/lib/timesheetEngine.js (modified)

class TimesheetEngine {
  constructor(io, aiContextService) {
    this.io = io;
    this.aiContext = aiContextService; // NEW
  }

  async advance(competitionId) {
    // ... existing advance logic ...

    const nextSegment = this.getNextSegment();

    // NEW: Generate AI context for the next segment
    if (this.aiContext) {
      const context = await this.aiContext.generateContextForSegment(
        nextSegment,
        this.competitionConfig
      );

      // Emit AI context update to all clients
      this.io.to(competitionId).emit('aiContextUpdated', {
        segmentId: nextSegment.id,
        aiContext: context,
      });
    }

    // ... rest of advance logic ...
  }
}
```

---

## 9. View Integrations

### Producer View Enhancement

The Producer View gains visibility into AI context and talent content:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PRODUCER VIEW (Enhanced)                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ NOW PLAYING ─────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │  ▶️  UCLA Introduction                           0:08 / 0:10          │  │
│  │  [████████████████████████████░░░░░░░░░░░░░]                          │  │
│  │                                                                        │  │
│  │  OBS: Single - Camera 2          Graphic: UCLA Stats (cued)           │  │
│  │                                                                        │  │
│  │  ─── AI CONTEXT ──────────────────────────────────────────────────   │  │
│  │  📊 On Screen: UCLA 197.425 | VT 49.35 | UB 49.28 | BB 49.40 | FX 49.40│
│  │                                                                        │  │
│  │  💡 Key Facts:                                                        │  │
│  │     • UCLA's highest team score of the season                         │  │
│  │     • 2nd highest in program history (record: 198.075)               │  │
│  │                                                                        │  │
│  │  🔔 ALERT: Career High! Jordan Chiles 9.95 FX (prev: 9.925)          │  │
│  │                                                                        │  │
│  │  ─── TALENT NOTES ────────────────────────────────────────────────   │  │
│  │  📝 Mention Jordan Chiles' floor routine - crowd was electric         │  │
│  │                                                                        │  │
│  │  🎤 Talking Points:                                                   │  │
│  │     • UCLA looking to extend their home winning streak                │  │
│  │     • Key matchup: Jordan Chiles vs Oregon's Jade Carey on floor     │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ UP NEXT ──────────────────────────────────────────────────────────────┐  │
│  │  ⏭️  Oregon Introduction (0:10)  │  🎨 Oregon Stats (cued)            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  [◀ Previous]  [Stop]  [▶ Advance]                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Talent View Enhancement

The Talent View focuses on what talent needs during the show:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TALENT VIEW (Enhanced)                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ CURRENT SEGMENT ──────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  UCLA Introduction                                      0:08 remaining  │ │
│  │  [████████████████████████████░░░░░░░░░░░░░]                           │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ WHAT'S ON SCREEN ─────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  📊 UCLA Stats Graphic                                                 │ │
│  │                                                                         │ │
│  │  Team Score: 197.425                                                   │ │
│  │  VT: 49.350  |  UB: 49.275  |  BB: 49.400  |  FX: 49.400              │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ TALKING POINTS ───────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  • UCLA looking to extend their home winning streak                    │ │
│  │  • Key matchup: Jordan Chiles vs Oregon's Jade Carey on floor         │ │
│  │                                                                         │ │
│  │  📝 Producer Note: Mention Jordan Chiles' floor routine                │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ KEY FACTS ────────────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  💡 UCLA's highest team score of the season                           │ │
│  │  💡 2nd highest in program history (record: 198.075, 2024)            │ │
│  │  💡 Jordan Chiles leads all-around with 39.750                        │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ LIVE ALERTS ──────────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  🔔 CAREER HIGH! Jordan Chiles scored 9.95 on Floor (prev: 9.925)     │ │
│  │     Just now                                                           │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ UP NEXT ──────────────────────────────────────────────────────────────┐ │
│  │  Oregon Introduction (0:10)                                            │ │
│  │  Talking Points: Oregon's first road meet of the season...            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [Fallback: Advance to Next ▶]                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Future: Graphics Operator View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GRAPHICS OP VIEW (Future)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ CUED GRAPHIC ─────────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  UCLA Stats                                         [🔥 FIRE GRAPHIC]  │ │
│  │  Duration: 8s | Mode: Cued | Ready to fire                            │ │
│  │                                                                         │ │
│  │  Preview: [================UCLA STATS PREVIEW================]        │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ SEGMENT GRAPHICS ─────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  Current: UCLA Introduction                                            │ │
│  │  • Primary: UCLA Stats (cued) [Ready]                                 │ │
│  │  • On-Score: Score Reveal (auto)                                      │ │
│  │                                                                         │ │
│  │  Next: Oregon Introduction                                             │ │
│  │  • Primary: Oregon Stats (cued)                                       │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ QUICK GRAPHICS ───────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  [Score Reveal] [Leaderboard] [Team Logos] [Lower Third]              │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Firebase Structure

### Updated Structure

```
competitions/{compId}/
├── config/                         # Existing competition config
│   ├── teams
│   ├── gender
│   └── ...
│
├── currentGraphic/                 # Existing live graphic state
│
├── production/
│   ├── cameras/                    # Existing camera config
│   │
│   ├── rundown/
│   │   ├── metadata/
│   │   │   ├── lastModified
│   │   │   ├── lastModifiedBy
│   │   │   └── version
│   │   │
│   │   └── segments/
│   │       └── {segmentId}/
│   │           ├── id
│   │           ├── name
│   │           ├── type
│   │           ├── timing/
│   │           ├── obs/
│   │           ├── graphics/
│   │           ├── audio/
│   │           ├── milestone/
│   │           ├── notes
│   │           ├── order
│   │           ├── meta/
│   │           │
│   │           └── talent/                 # NEW
│   │               ├── talkingPoints       # Array of strings
│   │               ├── notes               # String
│   │               ├── pronunciations/     # Object
│   │               └── personalNotes/      # Object keyed by talentId
│   │                   └── {talentId}
│   │
│   ├── aiContext/                          # NEW - Ephemeral, server-managed
│   │   └── segments/
│   │       └── {segmentId}/
│   │           ├── statsOnGraphic
│   │           ├── keyFacts
│   │           ├── alerts
│   │           └── generatedAt
│   │
│   └── settings/                   # Existing production settings
│
└── timesheet/                      # Existing timesheet state
    ├── currentIndex
    ├── isRunning
    ├── startedAt
    └── ...
```

### Data Ownership

| Path | Written By | Read By |
|------|------------|---------|
| `rundown/segments/{id}/talent/*` | RundownEditorPage | All views via Engine |
| `rundown/segments/{id}/talent/personalNotes/{talentId}` | TalentView | TalentView |
| `aiContext/segments/{id}/*` | Server (AIContextService) | All views via Engine |

---

## 11. Socket Event Flow

### Event Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOCKET EVENT FLOW                                    │
│                                                                              │
│  SERVER (TimesheetEngine + AIContextService)                                │
│  ───────────────────────────────────────────                                │
│                                                                              │
│  On advance():                                                               │
│  ┌──────────────────┐                                                       │
│  │ 1. Update state  │                                                       │
│  │ 2. Generate AI   │                                                       │
│  │ 3. Emit events   │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           ├──→ emit('timesheetState', { ... })      ← Existing             │
│           │                                                                  │
│           └──→ emit('aiContextUpdated', {           ← NEW                   │
│                  segmentId: 'seg-xxx',                                      │
│                  aiContext: {                                               │
│                    statsOnGraphic: {...},                                   │
│                    keyFacts: [...],                                         │
│                    alerts: [...],                                           │
│                    generatedAt: '...'                                       │
│                  }                                                          │
│                })                                                           │
│                                                                              │
│  CLIENT (ShowContext)                                                        │
│  ────────────────────                                                        │
│                                                                              │
│  socket.on('timesheetState', ...)     ← Existing, updates timesheetState    │
│  socket.on('aiContextUpdated', ...)   ← NEW, updates aiContext              │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  ShowContext State                                                       ││
│  │  ─────────────────                                                       ││
│  │  timesheetState: { currentIndex, segments, elapsed, ... }  ← Existing   ││
│  │  aiContext: { segments: { [segmentId]: { ... } } }         ← NEW        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  useRundownEngine()                                                      ││
│  │  ──────────────────                                                      ││
│  │  Merges timesheetState + aiContext                                       ││
│  │  Returns enriched currentSegment with aiContext attached                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│           │                                                                  │
│     ┌─────┴─────┬─────────────┐                                             │
│     ▼           ▼             ▼                                             │
│  ProducerView  TalentView  GraphicsOpView                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ShowContext Modifications

```javascript
// show-controller/src/context/ShowContext.jsx (modified)

export function ShowProvider({ children }) {
  // Existing state
  const [timesheetState, setTimesheetState] = useState(null);

  // NEW: AI context state
  const [aiContext, setAiContext] = useState({
    segments: {},
  });

  useEffect(() => {
    if (!socket) return;

    // Existing handler
    socket.on('timesheetState', (state) => {
      setTimesheetState(state);
    });

    // NEW: AI context handler
    socket.on('aiContextUpdated', ({ segmentId, aiContext: newContext }) => {
      setAiContext((prev) => ({
        ...prev,
        segments: {
          ...prev.segments,
          [segmentId]: newContext,
        },
      }));
    });

    return () => {
      socket.off('timesheetState');
      socket.off('aiContextUpdated');
    };
  }, [socket]);

  const value = {
    timesheetState,
    aiContext, // NEW
    // ... other existing values
  };

  return <ShowContext.Provider value={value}>{children}</ShowContext.Provider>;
}
```

---

## 12. Implementation Phases

### Phase 1: Core Engine + Producer View (MVP)

**Goal:** Create `useRundownEngine` hook, extend segment model, enhance Producer View

| Task | File | Description | Priority |
|------|------|-------------|----------|
| 1.1 | `useRundownEngine.js` | New hook wrapping useTimesheet + AI context | P0 |
| 1.2 | `ShowContext.jsx` | Add aiContext state, listen for `aiContextUpdated` events | P0 |
| 1.3 | Firebase schema | Add `talent` field to segment model | P0 |
| 1.4 | `SegmentDetail.jsx` | Add talent notes/talking points editor in Rundown Editor | P0 |
| 1.5 | `ProducerView.jsx` | Migrate from useTimesheet to useRundownEngine | P1 |
| 1.6 | `ProducerView.jsx` | Add AI context display (key facts, alerts) | P1 |
| 1.7 | `ProducerView.jsx` | Add talent content display (talking points, notes) | P1 |

**Exit Criteria:**
- [ ] `useRundownEngine()` hook created and tested
- [ ] Producer View uses `useRundownEngine()` instead of `useTimesheet()`
- [ ] Talent content (talkingPoints, notes) editable in Rundown Editor
- [ ] AI context placeholders visible in Producer View (data populated in Phase 2)

### Phase 2: Server-Side AI Context

**Goal:** Compute AI context on server, push via Socket.io

| Task | File | Description | Priority |
|------|------|-------------|----------|
| 2.1 | `aiContextService.js` | New service for AI context generation | P0 |
| 2.2 | `timesheetEngine.js` | Integrate AI context on segment advance | P0 |
| 2.3 | `index.js` | Add `aiContextUpdated` Socket.io emission | P0 |
| 2.4 | Virtius integration | Extend to fetch historical data for comparisons | P1 |
| 2.5 | Career data | Implement career high/season best detection | P1 |

**Exit Criteria:**
- [ ] AIContextService generates context for team-stats graphic
- [ ] Context pushed to clients via `aiContextUpdated` event
- [ ] Producer View displays real AI-generated facts
- [ ] Career high alerts trigger correctly

### Phase 3: Talent View Enhancement

**Goal:** Talent View consumes engine with rich context

| Task | File | Description | Priority |
|------|------|-------------|----------|
| 3.1 | `TalentView.jsx` | Migrate to useRundownEngine | P0 |
| 3.2 | `TalentView.jsx` | Show segment talking points prominently | P0 |
| 3.3 | `TalentView.jsx` | Show "What's On Screen" stats section | P0 |
| 3.4 | `TalentView.jsx` | Show AI key facts | P1 |
| 3.5 | `TalentView.jsx` | Show live alerts (career highs, records) | P1 |
| 3.6 | `TalentView.jsx` | Allow talent to add personal notes per segment | P2 |

**Exit Criteria:**
- [ ] Talent View uses `useRundownEngine()`
- [ ] Talking points displayed prominently
- [ ] On-screen stats visible to talent
- [ ] Live alerts appear in real-time
- [ ] Personal notes can be added (stored in Firebase)

### Phase 4: Automation & Advanced Features

**Goal:** Full automation triggers, Graphics Op view

| Task | File | Description | Priority |
|------|------|-------------|----------|
| 4.1 | `timesheetEngine.js` | Auto-switch OBS scenes on segment advance | P1 |
| 4.2 | `timesheetEngine.js` | Auto-fire graphics based on triggerMode | P1 |
| 4.3 | `GraphicsOpView.jsx` | New view for graphics operator | P2 |
| 4.4 | Audio automation | Auto-switch audio presets on segment advance | P2 |

**Exit Criteria:**
- [ ] OBS scenes auto-switch when automation enabled
- [ ] Graphics auto-fire based on segment triggerMode
- [ ] Graphics Op View prototype functional

---

## 13. File Manifest

### Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `docs/PRD-Rundown-Engine-Architecture.md` | 1 | This document |
| `show-controller/src/hooks/useRundownEngine.js` | 1 | Core engine hook |
| `server/lib/aiContextService.js` | 2 | AI context generation |
| `show-controller/src/views/GraphicsOpView.jsx` | 4 | Graphics operator view |

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `show-controller/src/context/ShowContext.jsx` | 1 | Add aiContext state, socket listener |
| `show-controller/src/components/rundown/SegmentDetail.jsx` | 1 | Add talent content editor |
| `show-controller/src/views/ProducerView.jsx` | 1 | Use useRundownEngine, add AI/talent displays |
| `show-controller/src/views/TalentView.jsx` | 3 | Use useRundownEngine, enhanced displays |
| `server/lib/timesheetEngine.js` | 2 | Integrate AI context service |
| `server/index.js` | 2 | Add aiContextUpdated socket event |

### Existing Files (No Changes)

| File | Purpose |
|------|---------|
| `show-controller/src/hooks/useTimesheet.js` | Base timing hook (wrapped by useRundownEngine) |
| `show-controller/src/pages/RundownEditorPage.jsx` | Planning tool (uses segment model, not live engine) |

---

## 14. Success Criteria

### Functional Criteria

| Criterion | Measurement |
|-----------|-------------|
| **Engine State Consistency** | All views show identical currentSegment at any moment |
| **AI Context Delivery** | Context delivered to clients within 500ms of segment advance |
| **Talent Content Authoring** | Talking points editable in Rundown Editor, visible in Talent View |
| **Alert Accuracy** | Career high alerts trigger when score exceeds stored career best |
| **Backward Compatibility** | Existing useTimesheet consumers continue working |

### Performance Criteria

| Metric | Target |
|--------|--------|
| AI context generation | < 500ms |
| Socket event delivery | < 100ms |
| View render after state change | < 50ms |
| Firebase talent content save | < 300ms |

### User Experience Criteria

| Role | Criteria |
|------|----------|
| **Producer** | Can see what talent sees (talking points, stats on screen) |
| **Talent** | Can see what's on screen, talking points, and live alerts |
| **Both** | See same segment state, timing, and alerts in real-time |

---

## 15. Open Questions

### For Future Phases

| Question | Notes |
|----------|-------|
| **Personal notes authentication** | How are per-talent notes authenticated? Need talentId from auth system |
| **AI context caching** | How long to cache Virtius data before refreshing? Currently 30s |
| **Offline fallback** | What happens if Virtius API is unavailable during show? |
| **Historical data source** | Where do career bests come from? Need historical database |
| **Graphics Op permissions** | What actions can Graphics Op take vs Producer? |

### Deferred Decisions

| Decision | Reason for Deferral |
|----------|---------------------|
| Multi-user editing | Complex collaboration requires Phase 4+ |
| Offline mode | Requires significant architecture changes |
| Mobile views | Need to validate core engine first |

---

## Appendix A: Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Where does AI context live? | **Server-side** | Server has Virtius API access, can compute and push |
| Talent notes storage? | **Extend segment model** | Simpler than separate collection, travels with segment |
| MVP scope? | **Engine + Producer View** | Validate core architecture before extending |
| Automation trigger point? | **Server-side** | TimesheetEngine already has segment advance logic |
| Hook strategy? | **Extend useTimesheet** | Backward compatible, incremental migration |

---

## Appendix B: Relationship to Other PRDs

```
PRD-AdvancedRundownEditor (Parent)
├── PRD-Rundown-00 (Timesheet Consolidation) ✅ COMPLETE
├── PRD-Rundown-01 (Editor Prototype) ✅ PHASES 0-3 COMPLETE
├── PRD-Rundown-05 (Rundown Prototype) 🔲 NOT STARTED
└── PRD-Rundown-Engine-Architecture (THIS DOCUMENT)
    ├── Phase 1: Core Engine + Producer View
    ├── Phase 2: Server-Side AI Context
    ├── Phase 3: Talent View Enhancement
    └── Phase 4: Automation & Advanced Features
```

This PRD focuses on the **Execution Layer** — making the rundown "live" with real-time state, AI context, and multi-view support. It builds on the planning capabilities from PRD-Rundown-01 and the timing infrastructure from PRD-Rundown-00.
