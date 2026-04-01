# Spec: Server Integration

## What

How the scoringIngestionService integrates with the coordinator server, including initialization, socket event wiring, and route registration.

## Current State

### Server Initialization Flow (server/index.js)

**Startup sequence (lines 8447-8474):**

```
httpServer.listen()
├── loadShowConfig()
├── initializeCameraModules()
├── initializeSceneGenerator()
├── initializeTimesheetEngine()
├── initializeVMPoolManager()
├── initializeAutoShutdown()
├── initializeOBSConnectionManager()
└── connectToOBS()
```

### How Existing Services Are Initialized

#### TimesheetEngine (lines 274-378, 398-540)

**Global/legacy instance:**
```javascript
function initializeTimesheetEngine() {
  timesheetEngine = new TimesheetEngine({
    showConfig,
    obs,
    io
  });

  // Wire up event handlers to socket.io
  timesheetEngine.on('tick', (data) => {
    io.to('competition:local').emit('timesheetTick', data);
  });
  timesheetEngine.on('segmentActivated', (data) => {
    io.to('competition:local').emit('timesheetSegmentActivated', data);
    io.to('competition:local').emit('timesheetState', timesheetEngine.getState());
  });
  // ... more events
}
```

**Per-competition instance (lines 398-540):**
```javascript
function getOrCreateEngine(compId, obsConnectionManager, firebase, socketIo) {
  if (timesheetEngines.has(compId)) {
    return timesheetEngines.get(compId);
  }

  const engine = new TimesheetEngine({
    compId,
    obsConnectionManager,
    firebase,  // Passed in
    io: socketIo,
    showConfig: { segments: [] }
  });

  const roomName = `competition:${compId}`;
  engine.on('tick', (data) => {
    socketIo.to(roomName).emit('timesheetTick', data);
  });
  // ... more event wiring

  timesheetEngines.set(compId, engine);
  return engine;
}
```

#### PlayoutEngine (lines 1016-1059)

```javascript
function getOrCreatePlayoutEngine(compId, options = {}) {
  if (playoutEngines.has(compId)) {
    return playoutEngines.get(compId);
  }

  const engine = new PlayoutEngine({
    compId,
    firebase: options.firebase || productionConfigService.getDb(),
    io: options.io || io,
    obsConnectionManager: options.obsConnectionManager || getOBSConnectionManager()
  });

  // Event wiring
  engine.on('queueUpdated', (data) => {
    io.to(`competition:${compId}`).emit('playout:clipQueueUpdate', data);
  });
  engine.on('modeChanged', (data) => {
    io.to(`competition:${compId}`).emit('playout:modeChanged', data);
  });
  engine.on('started', () => {
    io.to(`competition:${compId}`).emit('playout:started', { compId });
  });
  // ... more events

  playoutEngines.set(compId, engine);
  return engine;
}
```

### Firebase Access Pattern

**Getting database reference:**
```javascript
const db = productionConfigService.getDb();
// Returns Firebase Admin SDK database reference
```

**productionConfigService.js (lines 30-71):**
- Singleton initialization
- Uses `GOOGLE_APPLICATION_CREDENTIALS` env var
- `getDb()` returns the initialized database

### Socket Event Handlers Pattern (lines 4774-8330)

```javascript
socket.on('eventName', async ({ param1, param2 }) => {
  try {
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: 'No engine' });
      return;
    }

    await engine.someMethod(param1, param2);
    // Engine emits its own events which are forwarded via wiring
  } catch (error) {
    socket.emit('error', { message: error.message });
  }
});
```

## Target State

### scoringIngestionService Integration

#### 1. Service File Location

```
server/
  lib/
    scoringIngestionService.js  ← New file
```

#### 2. Service Module Structure

```javascript
// server/lib/scoringIngestionService.js

const EventEmitter = require('events');

const POLL_INTERVALS = {
  5: 5000,
  10: 10000,
  15: 15000,
  30: 30000,
  60: 60000
};

const PRODUCER_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes

class ScoringIngestionService extends EventEmitter {
  constructor(options) {
    super();
    this.compId = options.compId;
    this._firebase = options.firebase;
    this._io = options.io;
    this._state = 'stopped';
    // ... more init
  }

  async start() { /* ... */ }
  async stop() { /* ... */ }
  resetProducerActivity() { /* ... */ }
  getState() { /* ... */ }
}

// Singleton manager
const scoringServices = new Map();

function getScoringService(compId, options = {}) {
  if (scoringServices.has(compId)) {
    return scoringServices.get(compId);
  }

  const service = new ScoringIngestionService({
    compId,
    firebase: options.firebase,
    io: options.io
  });

  scoringServices.set(compId, service);
  return service;
}

function removeScoringService(compId) {
  const service = scoringServices.get(compId);
  if (service) {
    service.stop();
    service.removeAllListeners();
    scoringServices.delete(compId);
  }
}

function getAllScoringServices() {
  return scoringServices;
}

module.exports = {
  ScoringIngestionService,
  getScoringService,
  removeScoringService,
  getAllScoringServices
};
```

#### 3. Server Import and Initialization

**Add to server/index.js imports (top of file):**
```javascript
const {
  getScoringService,
  removeScoringService,
  getAllScoringServices
} = require('./lib/scoringIngestionService');
```

**Add initialization function:**
```javascript
// Around line 550 (after other service initializations)
async function initializeScoringIngestion() {
  const db = productionConfigService.getDb();
  if (!db) {
    console.warn('[ScoringIngestion] Firebase not available, skipping initialization');
    return;
  }

  // Scan all competitions for enabled scoring feeds
  const competitionsSnap = await db.ref('competitions').once('value');
  const competitions = competitionsSnap.val() || {};

  for (const [compId, comp] of Object.entries(competitions)) {
    const feedConfig = comp.config?.scoringFeed;
    if (feedConfig?.enabled && comp.config?.virtiusSessionId) {
      console.log(`[ScoringIngestion] Starting feed for ${compId}`);
      const service = getScoringService(compId, {
        firebase: db,
        io: io
      });
      wireScoringSeviceEvents(service, compId);
      await service.start();
    }
  }

  // Listen for new competitions with enabled feeds
  db.ref('competitions').on('child_changed', async (snapshot) => {
    const compId = snapshot.key;
    const comp = snapshot.val();
    const feedConfig = comp.config?.scoringFeed;

    const existingService = scoringServices.get(compId);

    if (feedConfig?.enabled && comp.config?.virtiusSessionId) {
      if (!existingService) {
        console.log(`[ScoringIngestion] Starting feed for ${compId} (config changed)`);
        const service = getScoringService(compId, {
          firebase: db,
          io: io
        });
        wireScoringSeviceEvents(service, compId);
        await service.start();
      }
    } else if (existingService) {
      console.log(`[ScoringIngestion] Stopping feed for ${compId} (config changed)`);
      removeScoringService(compId);
    }
  });
}
```

**Add event wiring function:**
```javascript
function wireScoringSeviceEvents(service, compId) {
  const roomName = `competition:${compId}`;

  service.on('pollCompleted', (data) => {
    io.to(roomName).emit('scoring:pollCompleted', data);
  });

  service.on('pollError', (error) => {
    io.to(roomName).emit('scoring:pollError', error);
  });

  service.on('configChanged', (config) => {
    io.to(roomName).emit('scoring:configChanged', config);
  });

  service.on('autoStopped', (data) => {
    io.to(roomName).emit('scoring:autoStopped', data);
    removeScoringService(compId);
  });

  service.on('started', () => {
    io.to(roomName).emit('scoring:started', { compId });
  });

  service.on('stopped', () => {
    io.to(roomName).emit('scoring:stopped', { compId });
  });
}
```

**Add to startup sequence (around line 8465):**
```javascript
// In httpServer.listen callback:
await initializeScoringIngestion();
console.log('[ScoringIngestion] Initialization complete');
```

#### 4. Socket Event Handlers

**Add socket handlers for manual control:**
```javascript
// Around line 5000 (in socket.on('connection') callback)

socket.on('scoring:start', async () => {
  try {
    const db = productionConfigService.getDb();
    const service = getScoringService(clientCompId, {
      firebase: db,
      io: io
    });
    wireScoringSeviceEvents(service, clientCompId);
    await service.start();
    socket.emit('scoring:started', { compId: clientCompId });
  } catch (error) {
    socket.emit('error', { message: `Cannot start scoring feed: ${error.message}` });
  }
});

socket.on('scoring:stop', async () => {
  try {
    removeScoringService(clientCompId);
    socket.emit('scoring:stopped', { compId: clientCompId });
  } catch (error) {
    socket.emit('error', { message: `Cannot stop scoring feed: ${error.message}` });
  }
});

socket.on('scoring:forceRefresh', async () => {
  try {
    const service = scoringServices.get(clientCompId);
    if (service) {
      await service.forcePoll();
      socket.emit('scoring:pollCompleted', { forced: true });
    }
  } catch (error) {
    socket.emit('error', { message: `Cannot refresh: ${error.message}` });
  }
});

socket.on('scoring:getState', () => {
  const service = scoringServices.get(clientCompId);
  if (service) {
    socket.emit('scoring:state', service.getState());
  } else {
    socket.emit('scoring:state', { running: false });
  }
});
```

**Add producer activity reset to socket middleware:**
```javascript
// In socket.on('connection') callback, after room join
socket.use((packet, next) => {
  // Reset scoring service activity for this competition
  const service = scoringServices.get(clientCompId);
  if (service) {
    service.resetProducerActivity();
  }
  next();
});
```

#### 5. REST API Routes (Optional)

**Add routes for status checking:**
```javascript
// Around line 4300 (admin routes section)

app.get('/api/scoring/:compId/status', async (req, res) => {
  try {
    const { compId } = req.params;
    const service = scoringServices.get(compId);

    if (!service) {
      return res.json({ running: false });
    }

    res.json(service.getState());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scoring/:compId/start', async (req, res) => {
  try {
    const { compId } = req.params;
    const db = productionConfigService.getDb();

    const service = getScoringService(compId, {
      firebase: db,
      io: io
    });
    wireScoringSeviceEvents(service, compId);
    await service.start();

    res.json({ success: true, compId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scoring/:compId/stop', async (req, res) => {
  try {
    const { compId } = req.params;
    removeScoringService(compId);
    res.json({ success: true, compId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Socket Events Summary

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `scoring:start` | Client → Server | — | Start scoring feed |
| `scoring:stop` | Client → Server | — | Stop scoring feed |
| `scoring:forceRefresh` | Client → Server | — | Trigger immediate poll |
| `scoring:getState` | Client → Server | — | Request current state |
| `scoring:started` | Server → Client | `{ compId }` | Feed started |
| `scoring:stopped` | Server → Client | `{ compId }` | Feed stopped |
| `scoring:pollCompleted` | Server → Client | `{ updatedAt, ... }` | Poll finished |
| `scoring:pollError` | Server → Client | `{ message }` | Poll failed |
| `scoring:configChanged` | Server → Client | `{ enabled, pollInterval }` | Config updated |
| `scoring:autoStopped` | Server → Client | `{ reason }` | Auto-stop triggered |
| `scoring:state` | Server → Client | `{ running, lastPoll, ... }` | Full state |

## Risks

1. **Initialization order:** If Firebase isn't ready when scoring initialization runs, service creation fails. Add proper guards.

2. **Memory leaks:** Services must be properly removed from Map when stopped. Ensure `removeAllListeners()` is called.

3. **Socket room mismatch:** Service broadcasts to `competition:{compId}` room. Ensure clients join the correct room.

## Open Questions

1. **Should REST API be included?** Or is socket-only sufficient? REST is useful for debugging and external integrations.

2. **Should initialization be proactive or lazy?**
   - Proactive: Scan all competitions on startup (current proposal)
   - Lazy: Only start when producer connects and requests it

3. **How should service handle coordinator restart?** Should it resume all previously-enabled feeds, or wait for explicit start?
