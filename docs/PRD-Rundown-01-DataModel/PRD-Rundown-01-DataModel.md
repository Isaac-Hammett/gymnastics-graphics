# PRD-Rundown-01: Data Model & Backend

**Version:** 1.0
**Date:** 2026-01-21
**Status:** Not Started
**Depends On:** None (Foundation)
**Blocks:** All other Rundown PRDs

---

## Overview

Establishes the foundation for the Rundown Editor:
1. **Segment Data Model** - Complete schema for rundown segments
2. **Firebase Structure** - Where rundown data is stored
3. **Backend Service** - Business logic for rundown operations
4. **API Routes** - REST endpoints for CRUD operations
5. **Socket Events** - Real-time sync events

---

## Requirements

### Requirement 1: Segment Data Model

**TypeScript Interface:**

```typescript
interface Segment {
  id: string;                          // Unique ID (e.g., "seg-001")
  name: string;                        // Display name
  type: 'video' | 'live' | 'static' | 'break' | 'hold' | 'graphic';

  timing: {
    duration: number | null;           // Duration in seconds
    durationUnit: 'seconds' | 'minutes';
    autoAdvance: boolean;              // Auto-advance to next segment
    countdown: boolean;                // Show countdown timer
    hold?: {
      enabled: boolean;
      minDuration: number | null;
      maxDuration: number | null;
    };
  };

  obs: {
    sceneId: string;                   // OBS scene name
    transition: {
      type: string;                    // "Cut", "Fade", "Stinger"
      duration: number;                // Duration in ms
    };
  };

  camera?: {
    cameraId: string;                  // Camera ID from config
    intendedApparatus: string[];       // ["VT", "UB", etc.]
  };

  audio: {
    preset: string;                    // Audio preset name
    levels?: Record<string, number>;   // Override levels (0-100)
  };

  graphics: {
    primary?: GraphicConfig;
    secondary?: GraphicConfig[];
    onScore?: GraphicConfig;           // Triggered on score event
  };

  milestone?: {
    type: string;                      // Milestone type
    label: string;                     // Display label
  };

  notes: string;                       // Producer notes
  order: number;                       // Sort order

  meta: {
    createdAt: string;                 // ISO timestamp
    modifiedAt: string;                // ISO timestamp
    modifiedBy: string;                // User email
  };
}

interface GraphicConfig {
  graphicId: string;                   // From graphics registry
  parameters?: Record<string, any>;    // Graphic parameters
  triggerMode: 'auto' | 'cued' | 'on-score' | 'timed';
  duration?: number;                   // Override duration
  autoTrigger: boolean;
  delay?: number;                      // Delay in seconds (for 'timed')
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

### Requirement 2: Firebase Structure

**Path:** `competitions/{compId}/production/rundown/`

```javascript
{
  "segments": [
    // Array of Segment objects
  ],
  "currentSegmentIndex": 0,        // Currently active segment
  "state": "idle",                 // "idle" | "running" | "paused"
  "startTime": null,               // When show started (ISO)
  "lastModified": "2026-01-21T...",
  "lastModifiedBy": "producer@example.com",
  "version": 1                     // Increments on each save
}
```

**Path:** `competitions/{compId}/production/editing/`

```javascript
{
  "activeEditors": {
    "user123": {
      "email": "producer@example.com",
      "segment": "seg-001",        // Currently editing
      "lastActive": 1705849200000
    }
  },
  "locks": {
    "seg-001": {
      "userId": "user123",
      "expires": 1705849500000     // 5 min lock
    }
  }
}
```

---

### Requirement 3: Backend Service

**File:** `server/lib/rundownService.js`

```javascript
class RundownService {
  constructor(firebaseAdmin) {
    this.db = firebaseAdmin.database();
  }

  // Get full rundown for a competition
  async getRundown(compId) { }

  // Get single segment
  async getSegment(compId, segmentId) { }

  // Create new segment
  async createSegment(compId, segment, insertAfter = null) { }

  // Update segment
  async updateSegment(compId, segmentId, updates) { }

  // Delete segment
  async deleteSegment(compId, segmentId) { }

  // Reorder segments
  async reorderSegments(compId, segmentIds) { }

  // Duplicate segment
  async duplicateSegment(compId, segmentId) { }

  // Bulk operations
  async deleteSegments(compId, segmentIds) { }
  async duplicateSegments(compId, segmentIds) { }

  // State management
  async startShow(compId) { }
  async advanceSegment(compId) { }
  async goToSegment(compId, segmentIndex) { }

  // Editing locks
  async acquireLock(compId, segmentId, userId) { }
  async releaseLock(compId, segmentId, userId) { }
  async getActiveLocks(compId) { }
}
```

---

### Requirement 4: API Routes

**File:** `server/routes/rundown.js`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/rundown` | Get full rundown |
| PUT | `/api/rundown` | Update full rundown |
| GET | `/api/rundown/segments/:id` | Get single segment |
| POST | `/api/rundown/segments` | Add segment |
| PUT | `/api/rundown/segments/:id` | Update segment |
| DELETE | `/api/rundown/segments/:id` | Delete segment |
| PUT | `/api/rundown/reorder` | Reorder segments |
| POST | `/api/rundown/segments/:id/duplicate` | Duplicate segment |
| DELETE | `/api/rundown/segments` | Bulk delete (body: {ids: []}) |
| POST | `/api/rundown/start` | Start show |
| POST | `/api/rundown/advance` | Advance to next segment |
| POST | `/api/rundown/goto/:index` | Go to specific segment |

All routes require `compId` from the request (via header or query param).

---

### Requirement 5: Socket Events

**Server → Client:**

| Event | Payload | Trigger |
|-------|---------|---------|
| `rundown:updated` | `{ segments, version }` | Any segment change |
| `rundown:segmentChanged` | `{ index, segment }` | Current segment changed |
| `rundown:stateChanged` | `{ state, startTime }` | Show started/paused |
| `rundown:lockAcquired` | `{ segmentId, userId }` | Lock acquired |
| `rundown:lockReleased` | `{ segmentId }` | Lock released |

**Client → Server:**

| Event | Payload | Purpose |
|-------|---------|---------|
| `rundown:subscribe` | `{ compId }` | Subscribe to rundown updates |
| `rundown:unsubscribe` | `{ compId }` | Unsubscribe |
| `rundown:requestLock` | `{ segmentId }` | Request edit lock |
| `rundown:releaseLock` | `{ segmentId }` | Release edit lock |

---

## File Manifest

### New Files

| File | Est. Lines | Purpose |
|------|------------|---------|
| `server/lib/rundownService.js` | 400 | Rundown business logic |
| `server/routes/rundown.js` | 300 | API routes |

### Modified Files

| File | Changes |
|------|---------|
| `server/index.js` | Add rundown routes, socket handlers |

---

## Acceptance Criteria

| Test | Criteria |
|------|----------|
| Create segment | POST returns 201, segment appears in Firebase |
| Update segment | PUT returns 200, Firebase updated |
| Delete segment | DELETE returns 200, segment removed from Firebase |
| Reorder segments | PUT /reorder updates order in Firebase |
| Socket sync | Changes broadcast to all subscribed clients |
| Lock acquisition | Lock appears in editing/locks, blocks other users |
| Lock timeout | Locks auto-expire after 5 minutes |

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| API response time | < 200ms |
| Firebase sync | < 500ms |
| Socket broadcast | < 100ms |
