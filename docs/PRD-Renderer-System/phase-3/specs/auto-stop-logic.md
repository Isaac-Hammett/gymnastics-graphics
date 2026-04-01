# Spec: Auto-Stop Logic

## What

Patterns for automatically stopping the scoring ingestion service when appropriate conditions are met. Includes existing auto-stop patterns in the codebase and how they should apply to Phase 3.

## Current State

### Existing Auto-Stop Patterns

#### 1. PlayoutEngine — No Explicit Auto-Stop

**File:** `server/lib/playoutEngine.js`

PlayoutEngine does NOT auto-stop. It runs until explicitly stopped by:
- Timesheet engine emits `playoutStopped` event (when rundown advances past PLAYOUT segment)
- Producer manually stops playout

**Lifecycle (lines 459-488):**
```javascript
async stop() {
  if (this._state === ENGINE_STATE.STOPPED) return;

  this._stopHeartbeat();
  this._stopClipPolling();
  this._stopVirtiusPolling();
  this._removeClipStatusListener();

  this._state = ENGINE_STATE.STOPPED;
  this._mode = PLAYOUT_MODE.FALLBACK;
  await this._persistState();

  this.emit('stopped');
  this._broadcastState();
}
```

**No auto-stop triggers:**
- No competition status listener
- No session completion detection
- No producer disconnect timeout

#### 2. AutoShutdownService — Server-Level Idle Timeout

**File:** `server/lib/autoShutdown.js`

Shuts down the entire coordinator server after idle period.

**Config (lines 21-26):**
```javascript
const DEFAULT_CONFIG = {
  idleTimeoutMinutes: 120,  // 2 hours
  checkIntervalSeconds: 60,
  shutdownDelaySeconds: 30,
  enabled: process.env.COORDINATOR_MODE === 'true'
};
```

**Activity tracking (lines 131-140):**
```javascript
resetActivity() {
  this._lastActivityTimestamp = Date.now();
  if (this._wasIdle && this._shutdownTimeout) {
    this._cancelShutdown('Activity detected');
  }
}
```

**Activity sources:**
- HTTP requests (middleware resets activity on every request)
- Socket connections
- Any service calling `resetActivity()`

**Key difference from Phase 3 need:** This is server-wide shutdown, not per-competition service stop.

#### 3. VMHealthMonitor — Polling with Status Awareness

**File:** `server/lib/vmHealthMonitor.js`

Polls VM status at 30-second intervals but doesn't auto-stop based on status.

**Pattern (lines 103-128):**
```javascript
_startPolling() {
  if (this._pollTimer) return;

  this._pollTimer = setInterval(async () => {
    await this._pollAllVMs();
  }, this._config.pollIntervalMs);
}

_stopPolling() {
  if (this._pollTimer) {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
  }
}
```

**Dynamic interval updates (lines 687-691):**
```javascript
updateConfig(newConfig) {
  this._config = { ...this._config, ...newConfig };
  if (this._pollTimer) {
    this._stopPolling();
    this._startPolling();
  }
}
```

**No auto-stop based on VM status** — continues polling regardless of results.

#### 4. RTN Stats Service — No Continuous Polling

**File:** `server/lib/rtnStatsService.js`

Does NOT have a polling loop. Ingestion is triggered on-demand via socket events.

**Deduplication window (line 679):**
```javascript
const DEDUP_WINDOW_MS = 60 * 1000;  // 60 seconds
```

Prevents repeated ingestion within 60 seconds, but no auto-stop concept exists.

### What Auto-Stop Means for Phase 3

The PRD specifies three auto-stop triggers:

#### Trigger 1: Competition Status

**PRD requirement:** `competitions/{compId}/status` set to "completed" or "archived" → stop polling

**Implementation approach:**
```javascript
// Listen to competition status
db.ref(`competitions/${compId}/status`).on('value', (snapshot) => {
  const status = snapshot.val();
  if (status === 'completed' || status === 'archived') {
    this._log('system', `Competition ${status}, stopping scoring feed`);
    this.stop();
    // Also disable the feed config
    db.ref(`competitions/${compId}/config/scoringFeed/enabled`).set(false);
  }
});
```

**Question:** What are the valid `status` values? Search shows:
- `active` — competition in progress
- `completed` — competition finished
- `archived` — competition hidden from active views

#### Trigger 2: Virtius Session Completed

**PRD requirement:** Virtius API returns session completed status → stop polling

**Virtius API response includes:**
```json
{
  "meet": {
    "status": "completed" | "in_progress" | "finished"
  }
}
```

**Implementation approach:**
```javascript
async _pollVirtius() {
  const response = await fetch(this._apiUrl);
  const data = await response.json();

  const meetStatus = data.meet?.status;
  if (meetStatus === 'completed' || meetStatus === 'finished') {
    this._log('system', `Virtius session ${meetStatus}, stopping scoring feed`);
    this.stop();
    await db.ref(`competitions/${compId}/config/scoringFeed`).update({
      enabled: false,
      status: 'completed',
      errorMessage: `Virtius session ${meetStatus}`
    });
    return;
  }

  // Continue with data processing...
}
```

#### Trigger 3: No Active Producers (30-Minute Timeout)

**PRD requirement:** No producer connected for 30+ minutes → stop polling

**Challenge:** How to track "producer connected" per competition?

**Approach 1: Socket room membership**

```javascript
// In server/index.js — track producer count per competition
const producerCounts = new Map();  // compId → count

socket.on('identify', ({ role }) => {
  if (role === 'producer' && clientCompId) {
    const count = (producerCounts.get(clientCompId) || 0) + 1;
    producerCounts.set(clientCompId, count);

    // Notify scoring service
    const engine = scoringEngines.get(clientCompId);
    if (engine) engine.resetProducerTimeout();
  }
});

socket.on('disconnect', () => {
  if (socketRole === 'producer' && clientCompId) {
    const count = producerCounts.get(clientCompId) || 1;
    producerCounts.set(clientCompId, Math.max(0, count - 1));
  }
});
```

**Approach 2: Firebase presence**

```javascript
// Producer writes presence to Firebase
db.ref(`competitions/${compId}/production/producerPresence/${socketId}`)
  .onDisconnect()
  .remove();

// Scoring service listens to presence count
db.ref(`competitions/${compId}/production/producerPresence`).on('value', (snapshot) => {
  const producers = snapshot.val() || {};
  const count = Object.keys(producers).length;
  if (count > 0) {
    this._resetProducerTimeout();
  }
});
```

**Approach 3: Activity timestamp (simpler)**

```javascript
// In scoring service
const PRODUCER_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes

_startProducerTimeout() {
  this._producerTimeoutTimer = setInterval(() => {
    const elapsed = Date.now() - this._lastProducerActivity;
    if (elapsed > PRODUCER_TIMEOUT_MS) {
      this._log('system', 'No producer activity for 30 minutes, stopping');
      this.stop();
      db.ref(`competitions/${compId}/config/scoringFeed`).update({
        enabled: false,
        status: 'timeout',
        errorMessage: 'No producer activity for 30 minutes'
      });
    }
  }, 60000);  // Check every minute
}

resetProducerActivity() {
  this._lastProducerActivity = Date.now();
}
```

**Recommendation:** Approach 3 is simplest. The server resets activity timestamp whenever a producer emits any socket event for this competition.

## Target State

### ScoringIngestionService Auto-Stop Implementation

```javascript
class ScoringIngestionService extends EventEmitter {
  constructor(options) {
    super();
    this.compId = options.compId;
    this._firebase = options.firebase;
    this._io = options.io;

    // Auto-stop state
    this._competitionStatusListener = null;
    this._lastProducerActivity = Date.now();
    this._producerTimeoutTimer = null;
  }

  async start() {
    // ... existing start logic ...

    // Set up auto-stop listeners
    this._setupAutoStop();
  }

  _setupAutoStop() {
    // Trigger 1: Competition status listener
    this._competitionStatusListener = this._firebase
      .ref(`competitions/${this.compId}/status`)
      .on('value', (snapshot) => {
        const status = snapshot.val();
        if (status === 'completed' || status === 'archived') {
          this._autoStop('competition_' + status);
        }
      });

    // Trigger 3: Producer timeout
    this._producerTimeoutTimer = setInterval(() => {
      const elapsed = Date.now() - this._lastProducerActivity;
      if (elapsed > PRODUCER_TIMEOUT_MS) {
        this._autoStop('producer_timeout');
      }
    }, 60000);
  }

  async _pollVirtius() {
    const data = await this._fetchVirtiusData();

    // Trigger 2: Session completed
    const meetStatus = data.meet?.status;
    if (meetStatus === 'completed' || meetStatus === 'finished') {
      this._autoStop('session_' + meetStatus);
      return;
    }

    // Continue processing...
  }

  _autoStop(reason) {
    this._log('system', `Auto-stopping: ${reason}`);
    this.stop();
    this._firebase.ref(`competitions/${this.compId}/config/scoringFeed`).update({
      enabled: false,
      status: 'stopped',
      errorMessage: `Auto-stopped: ${reason}`
    });
    this.emit('autoStopped', { reason });
  }

  resetProducerActivity() {
    this._lastProducerActivity = Date.now();
  }

  async stop() {
    // Remove listeners
    if (this._competitionStatusListener) {
      this._firebase.ref(`competitions/${this.compId}/status`)
        .off('value', this._competitionStatusListener);
      this._competitionStatusListener = null;
    }

    if (this._producerTimeoutTimer) {
      clearInterval(this._producerTimeoutTimer);
      this._producerTimeoutTimer = null;
    }

    // ... existing stop logic ...
  }
}
```

### Server Integration for Producer Activity

```javascript
// In server/index.js
socket.use((packet, next) => {
  // Reset scoring service activity for this competition
  const engine = scoringEngines.get(clientCompId);
  if (engine) {
    engine.resetProducerActivity();
  }
  next();
});
```

## Risks

1. **Missed activity:** If producer activity doesn't flow through socket (e.g., direct Firebase writes), timeout may trigger incorrectly.

2. **Competition status race:** If competition is marked completed before final scores are polled, data may be incomplete.

3. **False timeout:** If producer loses connection briefly, 30-minute timer resets. But if producer closes tab without disconnecting cleanly, timer keeps running.

## Open Questions

1. **What competition status values exist?** Need to verify valid values besides "active", "completed", "archived".

2. **Should auto-stop be reversible?** If competition is unmarked from "completed", should polling resume automatically?

3. **Should there be a warning before auto-stop?** Emit event at 25 minutes allowing producer to extend?

4. **What's the Virtius API field for session completion?** Need to verify `meet.status` values from actual API response.
