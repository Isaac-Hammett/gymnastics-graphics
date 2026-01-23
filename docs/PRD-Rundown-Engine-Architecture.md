# PRD: Rundown Engine Architecture

**Version:** 2.0
**Date:** 2026-01-23
**Project:** Gymnastics Graphics
**Status:** DRAFT

---

## Executive Summary

This PRD defines how to connect the **Rundown Editor** (planning tool) to the **TimesheetEngine** (execution engine) and create a **Talent View** for commentators. The core engine already exists - this PRD is about wiring the pieces together and adding the AI context foundation.

### What This PRD Covers

1. **Connecting Editor to Engine** - Load segments from Editor into live execution
2. **Talent View** - Simplified Producer View for commentators
3. **AI Context Foundation** - Server-side context generation for enriched segment data

### What Already Exists (Do Not Rebuild)

| Component | Location | Status |
|-----------|----------|--------|
| TimesheetEngine (server) | [server/lib/timesheetEngine.js](../server/lib/timesheetEngine.js) | ✅ Complete |
| useTimesheet hook (client) | [show-controller/src/hooks/useTimesheet.js](../show-controller/src/hooks/useTimesheet.js) | ✅ Complete |
| ProducerView | [show-controller/src/views/ProducerView.jsx](../show-controller/src/views/ProducerView.jsx) | ✅ Complete |
| Rundown Editor UI | [show-controller/src/pages/RundownEditorPage.jsx](../show-controller/src/pages/RundownEditorPage.jsx) | ✅ Prototype Complete |

---

## Related Documents

### PRD-Rundown-00-Timesheet (COMPLETE)

**Location:** [docs/PRD-Rundown-00-Timesheet/](PRD-Rundown-00-Timesheet/)

This PRD consolidated the timesheet system and is **fully implemented**. Key outcomes:

- `TimesheetEngine` on server handles segment progression, OBS switching, graphics firing
- `useTimesheet()` hook provides all state and actions to client views
- ProducerView uses `useTimesheet()` for show control
- Single source of truth via socket events

**Key Files from PRD-00:**
- [PRD-ConsolidateTimesheetShowProgress.md](PRD-Rundown-00-Timesheet/PRD-ConsolidateTimesheetShowProgress.md) - Requirements
- [PLAN-ConsolidateTimesheetShowProgress-Implementation.md](PRD-Rundown-00-Timesheet/PLAN-ConsolidateTimesheetShowProgress-Implementation.md) - Implementation details

### PRD-Rundown-01-EditorPrototype (IN PROGRESS)

**Location:** [docs/PRD-Rundown-01-EditorPrototype/](PRD-Rundown-01-EditorPrototype/)

This PRD was an **experiment to understand UI and features** for the rundown editor. It is a standalone planning tool with no live execution connection (yet).

**Purpose:** Prototype the editor UI to determine MVP features before connecting to the engine.

**Key Files from PRD-01:**
- [PLAN-Rundown-01-EditorPrototype-Implementation.md](PRD-Rundown-01-EditorPrototype/PLAN-Rundown-01-EditorPrototype-Implementation.md) - Task tracking

**Completed Features (Phases 0-5):**
- Segment CRUD with all fields (name, type, duration, scene, graphic, notes)
- Graphics and scene picker integration
- Template save/load
- Timing display with runtime calculations
- Inline editing
- Multi-select and bulk actions
- Drag-and-drop reordering
- Segment grouping
- Duplicate, lock, optional toggles
- Timing modes (fixed, manual, follows-previous)

**Remaining Phases (6-12):** Templates, collaboration, import/export, visual enhancements

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANNING LAYER                                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Rundown Editor (PRD-01)                                             │    │
│  │  /{compId}/rundown                                                   │    │
│  │                                                                       │    │
│  │  - Segment CRUD                    - Templates                       │    │
│  │  - Graphics/Scene pickers          - Timing modes                    │    │
│  │  - Drag-and-drop reordering        - Notes/locking                   │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                                  │ Saves to Firebase:                       │
│                                  │ competitions/{compId}/production/rundown │
│                                  ▼                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ "Load Rundown" action
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXECUTION LAYER                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TimesheetEngine (PRD-00)                                            │    │
│  │  server/lib/timesheetEngine.js                                       │    │
│  │                                                                       │    │
│  │  - Segment progression (start, stop, advance, previous, jumpTo)     │    │
│  │  - Auto-advance with timing                                          │    │
│  │  - OBS scene switching                                               │    │
│  │  - Graphics firing                                                   │    │
│  │  - Hold segments with min/max duration                               │    │
│  │  - Override logging                                                  │    │
│  │                                                                       │    │
│  │  NEW: AI Context Service                                             │    │
│  │  - Enriches segments with live stats                                 │    │
│  │  - Generates talking points                                          │    │
│  │  - Detects career highs, records                                     │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                                  │ Socket.io events:                        │
│                                  │ timesheetState, aiContextUpdated         │
│                                  ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  useTimesheet() + useAIContext() hooks                               │    │
│  │  show-controller/src/hooks/                                          │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                    ┌─────────────┴─────────────┐                            │
│                    ▼                           ▼                            │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │  Producer View              │  │  Talent View (NEW)          │          │
│  │  /{compId}/producer         │  │  /{compId}/talent           │          │
│  │                             │  │                             │          │
│  │  - Full show control        │  │  - Read-only show progress  │          │
│  │  - Load rundown             │  │  - Scene switching          │          │
│  │  - All segments visible     │  │  - Time remaining           │          │
│  │  - Override controls        │  │  - Current/Next segment     │          │
│  │  - AI context display       │  │  - AI context (notes, stats)│          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Connect Editor to Engine + AI Foundation

### Goal

Enable Producer to load a rundown from the Editor and execute it via TimesheetEngine. Lay foundation for AI context.

### 1.1 Load Rundown from Firebase

**Current State:** Editor saves segments to `competitions/{compId}/production/rundown/segments`

**Required:** ProducerView needs a "Load Rundown" button that:
1. Fetches segments from Firebase
2. Passes them to TimesheetEngine via socket
3. Engine updates its `showConfig.segments`

**Server Changes:**

```javascript
// server/index.js - Add socket handler
socket.on('loadRundown', async ({ competitionId }) => {
  const segments = await firebase
    .database()
    .ref(`competitions/${competitionId}/production/rundown/segments`)
    .once('value');

  timesheetEngine.updateConfig({
    ...timesheetEngine.showConfig,
    segments: Object.values(segments.val() || {})
      .sort((a, b) => a.order - b.order)
  });

  // Broadcast updated state
  io.to(competitionId).emit('timesheetState', timesheetEngine.getState());
});
```

**Client Changes:**

```javascript
// ShowContext.jsx - Add loadRundown action
const loadRundown = useCallback(() => {
  socket.emit('loadRundown', { competitionId });
}, [socket, competitionId]);
```

**ProducerView Changes:**
- Add "Load Rundown" button in toolbar
- Show segment count after loading
- Enable "Start Show" only when rundown is loaded

### 1.2 AI Context Foundation

**Purpose:** Establish the data structure and socket events for AI context, even if the actual AI generation is Phase 2.

**New File: `server/lib/aiContextService.js`**

```javascript
/**
 * AI Context Service - Generates enriched context for segments
 *
 * Phase 1: Basic structure and socket events
 * Phase 2: Virtius API integration, career data, real-time alerts
 */
export class AIContextService {
  constructor(firebase) {
    this.firebase = firebase;
    this.cache = new Map();
  }

  /**
   * Generate context for a segment (stub for Phase 1)
   * @param {Object} segment - Current segment
   * @param {Object} competitionConfig - Competition configuration
   * @returns {Object} AI context object
   */
  async generateContextForSegment(segment, competitionConfig) {
    return {
      // What's currently on screen (for talent to reference)
      statsOnGraphic: {},

      // AI-generated talking points (Phase 2)
      keyFacts: [],

      // Real-time alerts - career highs, records (Phase 2)
      alerts: [],

      // Timestamp for freshness
      generatedAt: new Date().toISOString(),
    };
  }
}
```

**ShowContext Changes:**

```javascript
// Add aiContext state
const [aiContext, setAiContext] = useState({
  segments: {},
});

// Listen for AI context updates
useEffect(() => {
  socket.on('aiContextUpdated', ({ segmentId, aiContext: newContext }) => {
    setAiContext(prev => ({
      ...prev,
      segments: {
        ...prev.segments,
        [segmentId]: newContext,
      },
    }));
  });

  return () => socket.off('aiContextUpdated');
}, [socket]);
```

**New Hook: `useAIContext.js`**

```javascript
import { useMemo } from 'react';
import { useShow } from '../context/ShowContext';
import { useTimesheet } from './useTimesheet';

export function useAIContext() {
  const { aiContext } = useShow();
  const { currentSegment } = useTimesheet();

  const currentContext = useMemo(() => {
    if (!currentSegment) return null;
    return aiContext.segments[currentSegment.id] || {
      statsOnGraphic: {},
      keyFacts: [],
      alerts: [],
      generatedAt: null,
    };
  }, [currentSegment, aiContext]);

  return {
    currentContext,
    allContexts: aiContext.segments,
  };
}
```

### 1.3 Segment Model Alignment

The Editor (PRD-01) and Engine (PRD-00) need aligned segment models.

**Editor Segment (PRD-01):**
```javascript
{
  id: "seg-001",
  name: "UCLA Introduction",
  type: "live",           // video | live | static | break | hold | graphic
  duration: 30,           // seconds
  scene: "Single - Camera 2",
  graphic: {
    graphicId: "team-stats",
    params: { teamSlot: 1 }
  },
  autoAdvance: true,
  timingMode: "fixed",    // fixed | manual | follows-previous
  notes: "Wait for applause to die down",
  locked: false,
  optional: false,
  order: 0,
}
```

**Engine Segment (PRD-00):**
```javascript
{
  id: "seg-001",
  name: "UCLA Introduction",
  type: "live",
  duration: 30,
  obsScene: "Single - Camera 2",  // Note: 'obsScene' not 'scene'
  graphic: "team-stats",          // Note: string not object
  graphicData: { teamSlot: 1 },   // Note: 'graphicData' not 'params'
  autoAdvance: true,
  minDuration: null,              // For hold segments
  maxDuration: null,              // For hold segments
  notes: "Wait for applause to die down",
}
```

**Mapping Function:**

```javascript
// server/lib/segmentMapper.js
export function mapEditorSegmentToEngine(editorSegment) {
  return {
    id: editorSegment.id,
    name: editorSegment.name,
    type: editorSegment.type,
    duration: editorSegment.duration,
    obsScene: editorSegment.scene,
    graphic: editorSegment.graphic?.graphicId || null,
    graphicData: editorSegment.graphic?.params || {},
    autoAdvance: editorSegment.timingMode !== 'manual' && editorSegment.autoAdvance !== false,
    minDuration: editorSegment.type === 'hold' ? editorSegment.minDuration : null,
    maxDuration: editorSegment.type === 'hold' ? editorSegment.maxDuration : null,
    notes: editorSegment.notes,
    // Preserve for reference
    _editorFields: {
      timingMode: editorSegment.timingMode,
      locked: editorSegment.locked,
      optional: editorSegment.optional,
    }
  };
}
```

### Phase 1 Deliverables

| Task | File | Description |
|------|------|-------------|
| 1.1.1 | `server/index.js` | Add `loadRundown` socket handler |
| 1.1.2 | `ShowContext.jsx` | Add `loadRundown` action |
| 1.1.3 | `ProducerView.jsx` | Add "Load Rundown" button |
| 1.2.1 | `server/lib/aiContextService.js` | Create stub AI context service |
| 1.2.2 | `server/index.js` | Integrate AI context on segment advance |
| 1.2.3 | `ShowContext.jsx` | Add `aiContext` state and socket listener |
| 1.2.4 | `hooks/useAIContext.js` | Create AI context hook |
| 1.3.1 | `server/lib/segmentMapper.js` | Create segment mapping function |

### Phase 1 Acceptance Criteria

- [ ] "Load Rundown" button in ProducerView loads segments from Firebase
- [ ] Loaded segments appear in RunOfShow list
- [ ] "Start Show" works with loaded rundown
- [ ] Segment progression, OBS switching, graphics firing all work
- [ ] `aiContextUpdated` socket event fires on segment advance (empty context for now)
- [ ] `useAIContext()` hook available for views

---

## Phase 2: Talent View

### Goal

Create a simplified Producer View for commentators/talent that shows show progress and allows scene switching.

### 2.1 Talent View Requirements

| Feature | Producer View | Talent View |
|---------|--------------|-------------|
| Current Segment | ✅ Full details | ✅ Name, type, time remaining |
| Next Segment | ✅ Full details | ✅ Name, duration |
| Segment List | ✅ Full RunOfShow | ❌ Hidden (simplified) |
| Time Remaining | ✅ Elapsed + Remaining | ✅ **Remaining prominently** |
| Progress Bar | ✅ | ✅ |
| Scene Switching | ✅ Override controls | ✅ **Scene buttons** |
| Advance/Previous | ✅ | ❌ (Producer controls show) |
| Start/Stop Show | ✅ | ❌ (Producer controls show) |
| Notes | ✅ Producer notes | ✅ Segment notes visible |
| AI Context | ✅ All context | ✅ Talking points, what's on screen |
| Alerts | ✅ | ✅ Career highs, records |

### 2.2 Talent View Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TALENT VIEW                                           [Scene Buttons ▼]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ CURRENT SEGMENT ────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  UCLA Introduction                                                   │   │
│  │  Live segment                                                        │   │
│  │                                                                       │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                    0:22 REMAINING                             │   │   │
│  │  │                    (of 0:30)                                  │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │  [████████████████████████████░░░░░░░░░░░░░] 73%                    │   │
│  │                                                                       │   │
│  │  📝 NOTES: Wait for applause to die down                            │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ WHAT'S ON SCREEN ───────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  📊 UCLA Team Stats                                                  │   │
│  │  Team Score: 197.425                                                 │   │
│  │  VT: 49.350 | UB: 49.275 | BB: 49.400 | FX: 49.400                  │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ TALKING POINTS ─────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  • UCLA's highest team score of the season                          │   │
│  │  • Jordan Chiles leads all-around with 39.750                       │   │
│  │  • 2nd highest in program history (record: 198.075)                 │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ ALERTS ─────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  🔔 CAREER HIGH! Jordan Chiles 9.95 FX (prev: 9.925)         2m ago │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ UP NEXT ────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Oregon Introduction (0:30)                                          │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ QUICK SCENES ───────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  [Cam 1] [Cam 2] [Cam 3] [Cam 4] [Wide] [Graphics]                  │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Talent View Implementation

**New File: `show-controller/src/views/TalentView.jsx`**

```javascript
import { useTimesheet } from '../hooks/useTimesheet';
import { useAIContext } from '../hooks/useAIContext';
import { useShow } from '../context/ShowContext';

export default function TalentView() {
  const {
    currentSegment,
    nextSegment,
    remaining,
    remainingFormatted,
    progress,
    overrideScene,
  } = useTimesheet();

  const { currentContext } = useAIContext();
  const { state } = useShow();

  // Quick scene buttons - configurable per competition
  const quickScenes = state.showConfig?.talentQuickScenes || [
    { name: 'Cam 1', scene: 'Single - Camera 1' },
    { name: 'Cam 2', scene: 'Single - Camera 2' },
    { name: 'Wide', scene: 'Multi - All Cameras' },
    { name: 'Graphics', scene: 'Graphics Fullscreen' },
  ];

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      {/* Current Segment with prominent time remaining */}
      <CurrentSegmentTalent
        segment={currentSegment}
        remaining={remaining}
        remainingFormatted={remainingFormatted}
        progress={progress}
      />

      {/* What's on screen - from AI context */}
      {currentContext?.statsOnGraphic && (
        <WhatsOnScreen stats={currentContext.statsOnGraphic} />
      )}

      {/* Talking points - from AI context */}
      {currentContext?.keyFacts?.length > 0 && (
        <TalkingPoints facts={currentContext.keyFacts} />
      )}

      {/* Alerts - career highs, records */}
      {currentContext?.alerts?.length > 0 && (
        <AlertsPanel alerts={currentContext.alerts} />
      )}

      {/* Up next */}
      <UpNextTalent segment={nextSegment} />

      {/* Quick scene buttons */}
      <QuickScenes
        scenes={quickScenes}
        onSelectScene={(scene) => overrideScene(scene, 'talent')}
      />
    </div>
  );
}
```

**Route Addition:**

```javascript
// App.jsx
<Route path="talent" element={<TalentView />} />
```

### Phase 2 Deliverables

| Task | File | Description |
|------|------|-------------|
| 2.1.1 | `views/TalentView.jsx` | Create Talent View page |
| 2.1.2 | `components/talent/CurrentSegmentTalent.jsx` | Current segment with prominent remaining time |
| 2.1.3 | `components/talent/WhatsOnScreen.jsx` | Display stats currently on graphic |
| 2.1.4 | `components/talent/TalkingPoints.jsx` | Display AI-generated talking points |
| 2.1.5 | `components/talent/AlertsPanel.jsx` | Display career high/record alerts |
| 2.1.6 | `components/talent/QuickScenes.jsx` | Scene switching buttons |
| 2.1.7 | `App.jsx` | Add `/talent` route |

### Phase 2 Acceptance Criteria

- [ ] Talent View accessible at `/{compId}/talent`
- [ ] Current segment displays with prominent time remaining
- [ ] Progress bar shows segment progress
- [ ] Notes from segment are visible
- [ ] Scene switching buttons work (calls `overrideScene`)
- [ ] Next segment preview displays
- [ ] AI context sections render (empty until Phase 3)

---

## Phase 3: AI Context Implementation

### Goal

Implement the actual AI context generation using live data from Virtius API and historical comparisons.

### 3.1 AI Context Service Full Implementation

```javascript
// server/lib/aiContextService.js

export class AIContextService {
  constructor(virtiusClient, firebase) {
    this.virtius = virtiusClient;
    this.firebase = firebase;
    this.cache = new Map();
  }

  async generateContextForSegment(segment, competitionConfig) {
    const context = {
      statsOnGraphic: {},
      keyFacts: [],
      alerts: [],
      generatedAt: new Date().toISOString(),
    };

    // Skip if no graphic
    if (!segment.graphic) return context;

    try {
      // Generate context based on graphic type
      switch (segment.graphic) {
        case 'team-stats':
          context.statsOnGraphic = await this.getTeamStats(
            segment.graphicData?.teamSlot,
            competitionConfig
          );
          context.keyFacts = await this.generateTeamFacts(
            segment.graphicData?.teamSlot,
            context.statsOnGraphic,
            competitionConfig
          );
          break;

        case 'athlete-stats':
        case 'athlete-bio':
          context.statsOnGraphic = await this.getAthleteStats(
            segment.graphicData?.athleteId,
            competitionConfig
          );
          context.keyFacts = await this.generateAthleteFacts(
            segment.graphicData?.athleteId,
            context.statsOnGraphic
          );
          break;

        case 'leaderboard':
          context.statsOnGraphic = await this.getLeaderboard(
            segment.graphicData?.event,
            competitionConfig
          );
          break;
      }

      // Always check for recent alerts
      context.alerts = await this.getRecentAlerts(competitionConfig.competitionId);

    } catch (error) {
      console.error('[AIContextService] Error:', error);
      // Return empty context on error - don't break the show
    }

    return context;
  }

  async getTeamStats(teamSlot, config) {
    const teamId = config.teams?.[`team${teamSlot}`]?.id;
    if (!teamId) return {};

    // Fetch from Virtius with caching
    const cacheKey = `team-${teamId}-${config.competitionId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) {
        return cached.data;
      }
    }

    const stats = await this.virtius.getTeamScores(config.competitionId, teamId);
    this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });
    return stats;
  }

  async generateTeamFacts(teamSlot, currentStats, config) {
    const facts = [];
    const teamId = config.teams?.[`team${teamSlot}`]?.id;
    if (!teamId || !currentStats.teamScore) return facts;

    // Get historical data
    const seasonData = await this.virtius.getTeamSeasonData(teamId);

    // Compare to season high
    if (currentStats.teamScore > seasonData.seasonHigh) {
      facts.push(`Season-high team score of ${currentStats.teamScore}`);
    }

    // Check program records
    const programRecords = await this.firebase
      .database()
      .ref(`teamsDatabase/records/${teamId}`)
      .once('value');

    const records = programRecords.val() || {};
    if (records.teamTotal && currentStats.teamScore >= records.teamTotal - 0.5) {
      facts.push(`Within ${(records.teamTotal - currentStats.teamScore).toFixed(3)} of program record`);
    }

    return facts.slice(0, 5);
  }

  async getRecentAlerts(competitionId) {
    const alerts = [];

    // Get scores from last 5 minutes
    const recentScores = await this.virtius.getRecentScores(competitionId, {
      since: Date.now() - 300000,
    });

    for (const score of recentScores) {
      // Check career high
      const careerData = await this.getAthleteCareerData(score.athleteId);
      if (score.score > (careerData.careerHigh?.[score.event] || 0)) {
        alerts.push({
          type: 'career-high',
          athlete: score.athleteName,
          event: score.event,
          score: score.score,
          previousBest: careerData.careerHigh?.[score.event],
          timestamp: score.timestamp,
        });
      }
    }

    return alerts;
  }
}
```

### 3.2 Integration with TimesheetEngine

```javascript
// server/lib/timesheetEngine.js - Add to _activateSegment method

async _activateSegment(index, reason = 'manual') {
  // ... existing code ...

  // Generate AI context for new segment
  if (this.aiContextService) {
    const context = await this.aiContextService.generateContextForSegment(
      segment,
      this.showConfig
    );

    // Emit to all clients
    if (this.io) {
      this.io.to(this.competitionId).emit('aiContextUpdated', {
        segmentId: segment.id,
        aiContext: context,
      });
    }
  }

  // ... rest of existing code ...
}
```

### Phase 3 Deliverables

| Task | File | Description |
|------|------|-------------|
| 3.1.1 | `server/lib/aiContextService.js` | Full implementation with Virtius integration |
| 3.1.2 | `server/lib/timesheetEngine.js` | Integrate AI context on segment advance |
| 3.1.3 | `server/index.js` | Initialize AIContextService with dependencies |
| 3.2.1 | Firebase schema | Add `teamsDatabase/records` for historical data |
| 3.2.2 | Virtius client | Extend with `getTeamSeasonData`, `getRecentScores` |

### Phase 3 Acceptance Criteria

- [ ] `statsOnGraphic` populated with live scores when team/athlete graphic is active
- [ ] `keyFacts` generated comparing to season/career data
- [ ] `alerts` populated with career highs and records within 5 minutes
- [ ] Talent View displays all AI context sections with real data
- [ ] Producer View also displays AI context
- [ ] Context updates in real-time as scores come in

---

## Firebase Structure

```
competitions/{compId}/
├── config/                         # Competition configuration
│   ├── teams/
│   │   ├── team1: { id, name, ... }
│   │   ├── team2: { id, name, ... }
│   │   └── ...
│   └── ...
│
├── production/
│   ├── rundown/
│   │   ├── metadata/
│   │   │   ├── lastModified
│   │   │   ├── lastModifiedBy
│   │   │   └── version
│   │   │
│   │   └── segments/               # From Rundown Editor (PRD-01)
│   │       └── {segmentId}/
│   │           ├── id
│   │           ├── name
│   │           ├── type
│   │           ├── duration
│   │           ├── scene
│   │           ├── graphic: { graphicId, params }
│   │           ├── autoAdvance
│   │           ├── timingMode
│   │           ├── notes
│   │           ├── locked
│   │           ├── optional
│   │           └── order
│   │
│   └── settings/
│       └── talentQuickScenes/      # Configurable per competition
│           └── [{ name, scene }, ...]
│
└── timesheet/                      # Runtime state (from Engine)
    ├── currentIndex
    ├── isRunning
    ├── startedAt
    └── ...

teamsDatabase/
├── teams/{teamKey}/
│   └── ...
├── records/{teamKey}/              # NEW: Historical records
│   ├── teamTotal: 198.075
│   ├── vt: 49.625
│   └── ...
└── ...
```

---

## Implementation Order

```
Phase 1: Connect Editor to Engine + AI Foundation
├── Task 1.1.1: Add loadRundown socket handler
├── Task 1.1.2: Add loadRundown to ShowContext
├── Task 1.1.3: Add "Load Rundown" button to ProducerView
├── Task 1.2.1: Create stub AIContextService
├── Task 1.2.2: Integrate AI context on segment advance
├── Task 1.2.3: Add aiContext state to ShowContext
├── Task 1.2.4: Create useAIContext hook
└── Task 1.3.1: Create segment mapping function
    │
    ▼
Phase 2: Talent View
├── Task 2.1.1: Create TalentView page
├── Task 2.1.2-2.1.5: Create Talent View components
├── Task 2.1.6: Create QuickScenes component
└── Task 2.1.7: Add /talent route
    │
    ▼
Phase 3: AI Context Implementation
├── Task 3.1.1: Full AIContextService implementation
├── Task 3.1.2: TimesheetEngine integration
├── Task 3.1.3: Server initialization
├── Task 3.2.1: Firebase records schema
└── Task 3.2.2: Extend Virtius client
```

---

## Success Criteria

### Phase 1
- [ ] Producer can load rundown from Editor via button
- [ ] Show execution works with loaded segments
- [ ] AI context foundation in place (empty data, but structure works)

### Phase 2
- [ ] Talent View accessible and shows current segment
- [ ] Time remaining prominently displayed
- [ ] Scene switching works from Talent View
- [ ] Notes visible to talent

### Phase 3
- [ ] AI context populated with live data
- [ ] Talking points generated from comparisons
- [ ] Career high alerts appear in real-time
- [ ] Both Producer and Talent views display AI context

---

## Open Questions

| Question | Notes |
|----------|-------|
| Quick scenes configuration | Per-competition or global default? |
| Historical data source | Build from Virtius season data or manual entry? |
| Alert dismissal | Should alerts auto-dismiss or require acknowledgment? |
| Talent personal notes | Allow talent to add their own notes per segment? (Phase 4?) |

---

## Appendix: Existing Code References

### TimesheetEngine Key Methods

| Method | Purpose | Location |
|--------|---------|----------|
| `start()` | Start show from first segment | Line 213 |
| `stop()` | Stop show | Line 249 |
| `advance()` | Manual advance to next segment | Line 957 |
| `previous()` | Go to previous segment | Line 1000 |
| `goToSegment()` | Jump to specific segment | Line 1034 |
| `_activateSegment()` | Internal - activates segment, triggers OBS/graphics | Line 476 |
| `_applyTransitionAndSwitchScene()` | OBS scene switching | Line 560 |
| `_triggerGraphic()` | Fire graphic via Firebase | Line 669 |
| `getState()` | Get full state for clients | Line 869 |

### useTimesheet Hook Returns

| Property | Type | Description |
|----------|------|-------------|
| `currentSegment` | Object | Current segment data |
| `nextSegment` | Object | Next segment preview |
| `elapsed` | number | Milliseconds elapsed |
| `remaining` | number | Milliseconds remaining |
| `progress` | number | 0-1 progress value |
| `isRunning` | boolean | Show is running |
| `isHoldSegment` | boolean | Current is hold type |
| `canAdvanceHold` | boolean | Hold min duration met |
| `start()` | function | Start show |
| `stop()` | function | Stop show |
| `advance()` | function | Advance to next |
| `previous()` | function | Go to previous |
| `jumpTo()` | function | Jump to segment ID |
| `overrideScene()` | function | Override OBS scene |
