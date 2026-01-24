# PRD-Rundown-06: Backend Services (Phase 1)

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-01 through PRD-Rundown-05 (Phase 0 complete)
**Blocks:** PRD-Rundown-07-FrontendIntegration

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 14 - Phase 1, API Specification

---

## Overview

This PRD covers the backend infrastructure for rundown persistence:
- Firebase CRUD operations for segments
- Milestone auto-calculation
- REST API endpoints
- Graphics registry access

---

## Scope

### In Scope
- `rundownService.js` - Segment CRUD operations
- `milestoneCalculator.js` - Auto-detect milestones from segments
- `graphicsRegistry.js` - Access graphics registry
- REST API routes for rundown operations

### Out of Scope
- Template system (see PRD-Rundown-09)
- Import/Export (see PRD-Rundown-10)
- Real-time collaboration features (Phase 4)

---

## Firebase Data Structure

### Rundown Path

```
competitions/{compId}/production/rundown/
├── segments/
│   ├── {segmentId}/
│   │   ├── id: "seg-001"
│   │   ├── name: "Show Intro"
│   │   ├── type: "video"
│   │   ├── order: 0
│   │   ├── timing/
│   │   │   ├── duration: 45
│   │   │   ├── autoAdvance: true
│   │   │   └── ...
│   │   ├── obs/
│   │   │   ├── sceneId: "Starting Soon"
│   │   │   └── transition/
│   │   ├── graphics/
│   │   │   └── primary/
│   │   ├── audio/
│   │   │   └── preset: "music-only"
│   │   ├── notes: ""
│   │   └── meta/
│   │       ├── createdAt: "2026-01-22T..."
│   │       ├── modifiedAt: "2026-01-22T..."
│   │       └── modifiedBy: "user@example.com"
│   └── {segmentId}/...
├── metadata/
│   ├── version: 1
│   ├── lastModified: "2026-01-22T..."
│   └── lastModifiedBy: "user@example.com"
└── milestones/
    ├── {index}/
    │   ├── type: "show-start"
    │   ├── time: 0
    │   ├── segmentIndex: 0
    │   └── label: "Show Start"
    └── ...
```

### Graphics Registry Path

```
system/graphics/registry/
├── metadata/
│   ├── version: "1.0"
│   └── lastUpdated: "2026-01-14T..."
├── categories/
│   ├── pre-meet/
│   │   ├── name: "Pre-Meet"
│   │   └── order: 1
│   └── ...
└── graphics/
    ├── team-logos/
    │   ├── id: "team-logos"
    │   ├── name: "Team Logos"
    │   ├── category: "pre-meet"
    │   └── ...
    └── ...
```

---

## Service: rundownService.js

### Location
`server/lib/rundownService.js`

### Dependencies
```javascript
const admin = require('firebase-admin');
const { calculateMilestones } = require('./milestoneCalculator');
```

### Methods

#### getRundown(compId)
```javascript
/**
 * Get full rundown for a competition
 * @param {string} compId - Competition ID
 * @returns {Promise<{segments: Array, metadata: Object, milestones: Array}>}
 */
async function getRundown(compId) {
  const db = admin.database();
  const rundownRef = db.ref(`competitions/${compId}/production/rundown`);

  const snapshot = await rundownRef.once('value');
  const data = snapshot.val() || {};

  // Convert segments object to sorted array
  const segments = data.segments
    ? Object.values(data.segments).sort((a, b) => a.order - b.order)
    : [];

  return {
    segments,
    metadata: data.metadata || { version: 0 },
    milestones: data.milestones || [],
  };
}
```

#### createSegment(compId, segmentData)
```javascript
/**
 * Create a new segment
 * @param {string} compId - Competition ID
 * @param {Object} segmentData - Segment data (without id)
 * @param {number} insertAfterOrder - Order value to insert after (-1 for end)
 * @returns {Promise<Object>} Created segment with id
 */
async function createSegment(compId, segmentData, insertAfterOrder = -1) {
  const db = admin.database();
  const segmentsRef = db.ref(`competitions/${compId}/production/rundown/segments`);

  // Generate ID
  const id = `seg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  // Calculate order
  const snapshot = await segmentsRef.once('value');
  const existingSegments = snapshot.val() ? Object.values(snapshot.val()) : [];

  let newOrder;
  if (insertAfterOrder === -1) {
    // Insert at end
    newOrder = existingSegments.length;
  } else {
    // Insert after specified order
    newOrder = insertAfterOrder + 1;

    // Increment order for all segments after insertion point
    const updates = {};
    existingSegments
      .filter(s => s.order >= newOrder)
      .forEach(s => {
        updates[`${s.id}/order`] = s.order + 1;
      });

    if (Object.keys(updates).length > 0) {
      await segmentsRef.update(updates);
    }
  }

  // Create segment
  const segment = {
    ...segmentData,
    id,
    order: newOrder,
    meta: {
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      modifiedBy: segmentData.meta?.modifiedBy || 'system',
    },
  };

  await segmentsRef.child(id).set(segment);

  // Recalculate milestones
  await recalculateMilestones(compId);

  // Update metadata
  await updateRundownMetadata(compId, segment.meta.modifiedBy);

  return segment;
}
```

#### updateSegment(compId, segmentId, updates)
```javascript
/**
 * Update an existing segment
 * @param {string} compId - Competition ID
 * @param {string} segmentId - Segment ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated segment
 */
async function updateSegment(compId, segmentId, updates) {
  const db = admin.database();
  const segmentRef = db.ref(`competitions/${compId}/production/rundown/segments/${segmentId}`);

  // Get current segment
  const snapshot = await segmentRef.once('value');
  if (!snapshot.exists()) {
    throw new Error(`Segment ${segmentId} not found`);
  }

  // Prepare updates with meta
  const updatedFields = {
    ...updates,
    'meta/modifiedAt': new Date().toISOString(),
    'meta/modifiedBy': updates.modifiedBy || 'system',
  };
  delete updatedFields.modifiedBy;

  await segmentRef.update(updatedFields);

  // Recalculate milestones if duration or type changed
  if ('timing' in updates || 'type' in updates || 'milestone' in updates) {
    await recalculateMilestones(compId);
  }

  // Update metadata
  await updateRundownMetadata(compId, updatedFields['meta/modifiedBy']);

  // Return updated segment
  const updatedSnapshot = await segmentRef.once('value');
  return updatedSnapshot.val();
}
```

#### deleteSegment(compId, segmentId)
```javascript
/**
 * Delete a segment
 * @param {string} compId - Competition ID
 * @param {string} segmentId - Segment ID
 * @returns {Promise<void>}
 */
async function deleteSegment(compId, segmentId) {
  const db = admin.database();
  const segmentsRef = db.ref(`competitions/${compId}/production/rundown/segments`);
  const segmentRef = segmentsRef.child(segmentId);

  // Get segment to delete
  const snapshot = await segmentRef.once('value');
  if (!snapshot.exists()) {
    throw new Error(`Segment ${segmentId} not found`);
  }
  const deletedSegment = snapshot.val();

  // Delete segment
  await segmentRef.remove();

  // Decrement order for segments after deleted one
  const allSnapshot = await segmentsRef.once('value');
  const remainingSegments = allSnapshot.val() ? Object.values(allSnapshot.val()) : [];

  const updates = {};
  remainingSegments
    .filter(s => s.order > deletedSegment.order)
    .forEach(s => {
      updates[`${s.id}/order`] = s.order - 1;
    });

  if (Object.keys(updates).length > 0) {
    await segmentsRef.update(updates);
  }

  // Recalculate milestones
  await recalculateMilestones(compId);

  // Update metadata
  await updateRundownMetadata(compId, 'system');
}
```

#### reorderSegments(compId, segmentId, newOrder)
```javascript
/**
 * Move a segment to a new position
 * @param {string} compId - Competition ID
 * @param {string} segmentId - Segment to move
 * @param {number} newOrder - New order position
 * @returns {Promise<Array>} Updated segments array
 */
async function reorderSegments(compId, segmentId, newOrder) {
  const db = admin.database();
  const segmentsRef = db.ref(`competitions/${compId}/production/rundown/segments`);

  // Get all segments
  const snapshot = await segmentsRef.once('value');
  const segments = snapshot.val() ? Object.values(snapshot.val()) : [];

  // Find segment to move
  const segmentToMove = segments.find(s => s.id === segmentId);
  if (!segmentToMove) {
    throw new Error(`Segment ${segmentId} not found`);
  }

  const oldOrder = segmentToMove.order;
  if (oldOrder === newOrder) return segments;

  // Calculate updates
  const updates = {};

  if (newOrder > oldOrder) {
    // Moving down: decrement orders between old and new
    segments
      .filter(s => s.order > oldOrder && s.order <= newOrder)
      .forEach(s => {
        updates[`${s.id}/order`] = s.order - 1;
      });
  } else {
    // Moving up: increment orders between new and old
    segments
      .filter(s => s.order >= newOrder && s.order < oldOrder)
      .forEach(s => {
        updates[`${s.id}/order`] = s.order + 1;
      });
  }

  // Set new order for moved segment
  updates[`${segmentId}/order`] = newOrder;

  await segmentsRef.update(updates);

  // Recalculate milestones
  await recalculateMilestones(compId);

  // Return updated segments
  const { segments: updatedSegments } = await getRundown(compId);
  return updatedSegments;
}
```

---

## Service: milestoneCalculator.js

### Location
`server/lib/milestoneCalculator.js`

### Implementation

```javascript
/**
 * Calculate milestones from segment list
 * @param {Array} segments - Sorted array of segments
 * @returns {Array} Calculated milestones
 */
function calculateMilestones(segments) {
  const milestones = [];
  let runningTime = 0;

  segments.forEach((segment, index) => {
    // Show start is always first
    if (index === 0) {
      milestones.push({
        type: 'show-start',
        time: 0,
        segmentIndex: 0,
        label: 'Show Start',
      });
    }

    // Check for explicit milestone marker
    if (segment.milestone?.type) {
      milestones.push({
        type: segment.milestone.type,
        time: runningTime,
        segmentIndex: index,
        label: segment.milestone.label || segment.name,
      });
    }

    // Auto-detect first routine
    if (segment.type === 'live' && segment.camera?.intendedApparatus?.length > 0) {
      if (!milestones.find(m => m.type === 'first-routine')) {
        milestones.push({
          type: 'first-routine',
          time: runningTime,
          segmentIndex: index,
          label: `First Routine (${segment.name})`,
        });
      }
    }

    // Auto-detect rotation starts
    const rotationMatch = segment.name.match(/rotation\s*(\d+)/i);
    if (rotationMatch && segment.type === 'live') {
      milestones.push({
        type: 'rotation-start',
        time: runningTime,
        segmentIndex: index,
        label: `Rotation ${rotationMatch[1]}`,
        rotationNumber: parseInt(rotationMatch[1]),
      });
    }

    // Auto-detect halftime (breaks >= 3 minutes)
    if (segment.type === 'break' && segment.timing?.duration >= 180) {
      milestones.push({
        type: 'halftime-start',
        time: runningTime,
        segmentIndex: index,
        label: segment.name || 'Halftime',
      });
    }

    // Accumulate time
    runningTime += segment.timing?.duration || 0;
  });

  // Meet end is always last
  milestones.push({
    type: 'meet-end',
    time: runningTime,
    segmentIndex: segments.length - 1,
    label: 'Meet End',
  });

  // Sort by time
  milestones.sort((a, b) => a.time - b.time);

  return milestones;
}

/**
 * Recalculate and save milestones for a competition
 * @param {string} compId - Competition ID
 */
async function recalculateMilestones(compId) {
  const admin = require('firebase-admin');
  const db = admin.database();

  // Get segments
  const segmentsRef = db.ref(`competitions/${compId}/production/rundown/segments`);
  const snapshot = await segmentsRef.once('value');
  const segments = snapshot.val()
    ? Object.values(snapshot.val()).sort((a, b) => a.order - b.order)
    : [];

  // Calculate milestones
  const milestones = calculateMilestones(segments);

  // Save milestones
  const milestonesRef = db.ref(`competitions/${compId}/production/rundown/milestones`);
  await milestonesRef.set(milestones);

  return milestones;
}

module.exports = { calculateMilestones, recalculateMilestones };
```

---

## Service: graphicsRegistry.js

### Location
`server/lib/graphicsRegistry.js`

### Implementation

```javascript
const admin = require('firebase-admin');

/**
 * Get full graphics registry
 * @returns {Promise<Object>} Graphics registry with categories and graphics
 */
async function getGraphicsRegistry() {
  const db = admin.database();
  const registryRef = db.ref('system/graphics/registry');

  const snapshot = await registryRef.once('value');
  const data = snapshot.val() || {};

  return {
    metadata: data.metadata || {},
    categories: data.categories || {},
    graphics: data.graphics || {},
  };
}

/**
 * Get graphics filtered by category
 * @param {string} category - Category key
 * @returns {Promise<Array>} Graphics in category
 */
async function getGraphicsByCategory(category) {
  const registry = await getGraphicsRegistry();

  return Object.values(registry.graphics)
    .filter(g => g.category === category)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Get graphics filtered by gender
 * @param {string} gender - "mens" or "womens"
 * @returns {Promise<Array>} Graphics matching gender filter
 */
async function getGraphicsForGender(gender) {
  const registry = await getGraphicsRegistry();

  return Object.values(registry.graphics)
    .filter(g => !g.genderFilter || g.genderFilter === gender)
    .sort((a, b) => (a.category || '').localeCompare(b.category || ''));
}

/**
 * Get single graphic by ID
 * @param {string} graphicId - Graphic ID
 * @returns {Promise<Object|null>} Graphic or null
 */
async function getGraphic(graphicId) {
  const db = admin.database();
  const graphicRef = db.ref(`system/graphics/registry/graphics/${graphicId}`);

  const snapshot = await graphicRef.once('value');
  return snapshot.val();
}

module.exports = {
  getGraphicsRegistry,
  getGraphicsByCategory,
  getGraphicsForGender,
  getGraphic,
};
```

---

## API Routes

### Location
`server/routes/rundown.js`

### Route Definitions

```javascript
const express = require('express');
const router = express.Router();
const rundownService = require('../lib/rundownService');
const graphicsRegistry = require('../lib/graphicsRegistry');

// Middleware to extract compId
router.use((req, res, next) => {
  req.compId = req.headers['x-competition-id'] || req.query.compId;
  if (!req.compId) {
    return res.status(400).json({ error: 'Competition ID required' });
  }
  next();
});

// GET /api/rundown - Get full rundown
router.get('/', async (req, res) => {
  try {
    const rundown = await rundownService.getRundown(req.compId);
    res.json(rundown);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rundown/segments - Create segment
router.post('/segments', async (req, res) => {
  try {
    const { segment, insertAfterOrder } = req.body;
    const created = await rundownService.createSegment(
      req.compId,
      segment,
      insertAfterOrder ?? -1
    );
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/rundown/segments/:id - Update segment
router.put('/segments/:id', async (req, res) => {
  try {
    const updated = await rundownService.updateSegment(
      req.compId,
      req.params.id,
      req.body
    );
    res.json(updated);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// DELETE /api/rundown/segments/:id - Delete segment
router.delete('/segments/:id', async (req, res) => {
  try {
    await rundownService.deleteSegment(req.compId, req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// PUT /api/rundown/segments/reorder - Reorder segments
router.put('/segments/reorder', async (req, res) => {
  try {
    const { segmentId, newOrder } = req.body;
    const segments = await rundownService.reorderSegments(
      req.compId,
      segmentId,
      newOrder
    );
    res.json({ segments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rundown/milestones - Get milestones
router.get('/milestones', async (req, res) => {
  try {
    const rundown = await rundownService.getRundown(req.compId);
    res.json({ milestones: rundown.milestones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/graphics/registry - Get graphics registry
router.get('/graphics/registry', async (req, res) => {
  try {
    const registry = await graphicsRegistry.getGraphicsRegistry();
    res.json(registry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/graphics/registry/:id - Get single graphic
router.get('/graphics/registry/:id', async (req, res) => {
  try {
    const graphic = await graphicsRegistry.getGraphic(req.params.id);
    if (!graphic) {
      return res.status(404).json({ error: 'Graphic not found' });
    }
    res.json(graphic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Mount Routes in server/index.js

```javascript
const rundownRoutes = require('./routes/rundown');
app.use('/api/rundown', rundownRoutes);
```

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `server/lib/rundownService.js` | 300-350 | Segment CRUD operations |
| `server/lib/milestoneCalculator.js` | 100-120 | Milestone detection |
| `server/lib/graphicsRegistry.js` | 80-100 | Graphics registry access |
| `server/routes/rundown.js` | 120-150 | REST API routes |

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/index.js` | Mount rundown routes: `app.use('/api/rundown', rundownRoutes)` |

---

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/rundown` | Get full rundown |
| POST | `/api/rundown/segments` | Create segment |
| PUT | `/api/rundown/segments/:id` | Update segment |
| DELETE | `/api/rundown/segments/:id` | Delete segment |
| PUT | `/api/rundown/segments/reorder` | Reorder segments |
| GET | `/api/rundown/milestones` | Get milestones |
| GET | `/api/graphics/registry` | Get graphics registry |
| GET | `/api/graphics/registry/:id` | Get single graphic |

---

## Acceptance Criteria

### rundownService
- [ ] `getRundown()` returns segments sorted by order
- [ ] `createSegment()` generates unique ID
- [ ] `createSegment()` with insertAfterOrder updates subsequent orders
- [ ] `updateSegment()` updates modifiedAt timestamp
- [ ] `deleteSegment()` decrements subsequent orders
- [ ] `reorderSegments()` correctly moves segment
- [ ] All mutations trigger milestone recalculation

### milestoneCalculator
- [ ] Detects show-start at time 0
- [ ] Detects first-routine from live segments with apparatus
- [ ] Detects rotation-start from segment names
- [ ] Detects halftime from breaks >= 3 minutes
- [ ] Adds meet-end at total duration
- [ ] Respects explicit milestone markers

### graphicsRegistry
- [ ] `getGraphicsRegistry()` returns full registry
- [ ] `getGraphicsByCategory()` filters correctly
- [ ] `getGraphicsForGender()` excludes wrong gender
- [ ] `getGraphic()` returns single graphic by ID

### API Routes
- [ ] All endpoints require competition ID
- [ ] GET /api/rundown returns rundown data
- [ ] POST /api/rundown/segments creates segment
- [ ] PUT /api/rundown/segments/:id updates segment
- [ ] DELETE /api/rundown/segments/:id removes segment
- [ ] PUT /api/rundown/segments/reorder moves segment
- [ ] 404 returned for non-existent segments
- [ ] 400 returned for missing competition ID

---

## Dependencies

- Firebase Admin SDK (already configured)
- Phase 0 complete (for validation of data model)

---

## Next Steps

After this PRD is complete:
1. PRD-Rundown-07: Connect frontend to these backend services
