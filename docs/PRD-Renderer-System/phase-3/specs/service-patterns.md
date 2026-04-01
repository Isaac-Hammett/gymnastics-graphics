# Spec: Service Patterns

## What

Patterns from clipService, rtnStatsService, and playoutEngine that the scoringIngestionService should follow. Includes polling loops, lifecycle management, error handling, and Firebase write patterns.

## Current State

### PlayoutEngine Patterns (Most Relevant)

**File:** `server/lib/playoutEngine.js`

#### Singleton Pattern for Per-Competition Instances

```javascript
// Lines 1878-1913
const playoutEngines = new Map();

function getPlayoutEngine(compId, options) {
  if (playoutEngines.has(compId)) {
    return playoutEngines.get(compId);
  }
  const engine = new PlayoutEngine({
    compId,
    firebase: options.firebase,
    io: options.io,
    obsConnectionManager: options.obsConnectionManager
  });
  playoutEngines.set(compId, engine);
  return engine;
}

function removePlayoutEngine(compId) {
  const engine = playoutEngines.get(compId);
  if (engine) {
    engine.stop();
    engine.removeAllListeners();
    playoutEngines.delete(compId);
  }
}
```

**Pattern to follow:** Per-competition Map, getOrCreate function, cleanup on remove.

#### Polling Loop with setInterval

```javascript
// Lines 1376-1393
const CLIP_POLL_INTERVAL_MS = 15000;  // 15 seconds

_startClipPolling() {
  if (this._clipPollTimer) return;  // Guard against double-start

  this._clipPollTimer = setInterval(async () => {
    await this._fetchClips();  // Errors caught internally
  }, CLIP_POLL_INTERVAL_MS);

  this._log('system', 'Clip polling started');
}

_stopClipPolling() {
  if (this._clipPollTimer) {
    clearInterval(this._clipPollTimer);
    this._clipPollTimer = null;
    this._log('system', 'Clip polling stopped');
  }
}
```

**Pattern to follow:**
- Guard checks for double-start/stop
- setInterval with async callback
- Errors caught inside callback (don't break the loop)
- Store timer reference for cleanup
- Log start/stop events

#### Heartbeat Pattern

```javascript
// Lines 1327-1366
const HEARTBEAT_INTERVAL_MS = 5000;  // 5 seconds

_startHeartbeat() {
  if (this._heartbeatTimer) return;

  // Write initial heartbeat
  this._writeHeartbeat();

  this._heartbeatTimer = setInterval(() => {
    this._writeHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

async _writeHeartbeat() {
  try {
    await this._firebase.ref(`competitions/${this.compId}/production/engineHeartbeat`)
      .update({
        timestamp: Date.now(),
        mode: this._mode
      });
    this.emit('heartbeat', { timestamp: Date.now(), mode: this._mode });
  } catch (error) {
    console.error('[PlayoutEngine] Heartbeat write error:', error);
    // Don't throw — heartbeat failure is not fatal
  }
}
```

**Pattern to follow:**
- Initial write before starting interval
- Catch and log errors (don't propagate)
- Emit events for state changes
- Update timestamp + mode/status in Firebase

#### Error Tracking in State

```javascript
// Lines 186-191
this._lastApiError = null;
this._lastClipFetchAt = null;
this._lastClipFetchResult = null;  // 'success' | 'error' | 'no-new'

// Lines 726-730 — included in getState()
clipApiFetch: {
  lastFetchAt: this._lastClipFetchAt,
  result: this._lastClipFetchResult,
  totalClips: this._clips.length
}
```

**Pattern to follow:** Track last error, last fetch time, fetch result enum.

#### Firebase Write Pattern

```javascript
// Lines 1185-1203
async _persistQueue() {
  try {
    // Minimal fields for Firebase storage
    const queueData = {
      clips: this._clips.map(c => ({
        draft_id: c.draft_id,
        status: c.status,
        shown_live: c.shown_live
      })),
      timestamp: Date.now()
    };

    await this._firebase.ref(`competitions/${this.compId}/production/clipQueue`)
      .set(queueData);
  } catch (error) {
    console.error('[PlayoutEngine] Failed to persist queue:', error);
  }
}
```

**Pattern to follow:**
- Use `.set()` for full overwrites, `.update()` for partial updates
- Catch and log errors (non-fatal)
- Include timestamp in persisted data

### RTN Stats Service Patterns

**File:** `server/lib/rtnStatsService.js`

#### Staleness Check

```javascript
// Lines 729-752
const STALENESS_TTL = 24 * 60 * 60 * 1000;  // 24 hours
const DEDUP_WINDOW_MS = 60 * 1000;  // 60 seconds

async function checkStaleness(teamKey, db) {
  const metaRef = db.ref(`teamsDatabase/stats/${teamKey}/meta`);
  const snapshot = await metaRef.once('value');
  const meta = snapshot.val();

  if (!meta?.fetchedAt) {
    return { isStale: true, fetchedAt: null, withinDedup: false };
  }

  const now = Date.now();
  const fetchedAt = new Date(meta.fetchedAt).getTime();
  const age = now - fetchedAt;

  return {
    isStale: age > STALENESS_TTL,
    fetchedAt: meta.fetchedAt,
    withinDedup: age < DEDUP_WINDOW_MS
  };
}
```

**Pattern to follow:**
- Check fetch timestamp before polling
- Deduplication window prevents thundering herd
- Return status object for caller to decide

#### Partial Update Pattern

```javascript
// Lines 843-853
// Use update() instead of set() to preserve sibling data
const filteredData = Object.fromEntries(
  Object.entries(normalized).filter(([_, v]) => v !== null)
);

await statsRef.update({
  ...filteredData,
  meta: {
    fetchedAt: new Date().toISOString(),
    status: hasErrors ? 'partial' : 'complete',
    errors: errorSummary
  }
});
```

**Pattern to follow:**
- Filter out null values (don't destroy previous good data)
- Use `.update()` not `.set()` for partial updates
- Include meta object with status, timestamp, errors

#### Firebase Read Pattern

```javascript
// Lines 1062-1100
const configSnapshot = await db.ref(`competitions/${compId}/config`).once('value');
const config = configSnapshot.val() || {};

// Extract multiple team keys
const teamKeys = [];
for (let i = 1; i <= 10; i++) {
  const key = config[`team${i}Key`];
  if (key) teamKeys.push(key);
}
```

**Pattern to follow:** Single read, extract multiple values.

### ClipService Patterns

**File:** `server/lib/clipService.js`

#### HTTP Fetch with Timeout

```javascript
// Lines 134-170
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;

async function fetchClips(baseUrl, sessionKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status >= 500) {
        // Retry once on server errors
        await sleep(RETRY_DELAY_MS);
        return fetchClips(baseUrl, sessionKey);  // Recursive retry
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
```

**Pattern to follow:**
- AbortController for timeout
- Single retry on 5xx errors
- Clear timeout in both success and error paths

#### Graceful Degradation

```javascript
// Lines 210-213
if (!data.clips || !Array.isArray(data.clips)) {
  console.warn('[ClipService] Unexpected response shape:', data);
  return { clips: [], error: 'Unexpected response shape' };
}
```

**Pattern to follow:** Return empty results with error indicator, don't throw on unexpected data.

### Server Initialization Pattern

**File:** `server/index.js`

#### Service Creation and Event Wiring

```javascript
// Lines 1016-1059
function getOrCreatePlayoutEngine(compId, options = {}) {
  if (playoutEngines.has(compId)) {
    return playoutEngines.get(compId);
  }

  const engine = new PlayoutEngine({
    compId,
    firebase: options.firebase || productionConfigService.getDb(),
    io: options.io || io,
    obsConnectionManager: options.obsConnectionManager
  });

  // Wire up events to socket.io room
  const roomName = `competition:${compId}`;
  engine.on('queueUpdated', (data) => {
    io.to(roomName).emit('playout:clipQueueUpdate', data);
  });
  engine.on('modeChanged', (data) => {
    io.to(roomName).emit('playout:modeChanged', data);
  });
  // ... more events

  playoutEngines.set(compId, engine);
  return engine;
}
```

**Pattern to follow:**
- Pass firebase, io, other deps via options
- Default to global instances if not provided
- Wire events to competition-specific socket.io room

#### Socket Event Trigger

```javascript
// Lines 4785-4792
socket.on('advance', async () => {
  try {
    const engine = getEngine(clientCompId);
    if (engine) await engine.advance();
  } catch (error) {
    socket.emit('error', { message: 'Cannot advance' });
  }
});
```

**Pattern to follow:** Socket event triggers engine method, errors emitted back to client.

## Target State

### scoringIngestionService Should Follow

1. **Singleton Map:** `const scoringEngines = new Map()`

2. **getOrCreate Function:**
   ```javascript
   function getOrCreateScoringEngine(compId, options = {}) {
     if (scoringEngines.has(compId)) return scoringEngines.get(compId);
     const engine = new ScoringIngestionEngine({ compId, firebase, io });
     // Wire events to socket.io room
     scoringEngines.set(compId, engine);
     return engine;
   }
   ```

3. **Polling Loop:**
   - setInterval with configurable interval (from Firebase config)
   - Fire-and-forget async (errors caught inside)
   - Guard checks for double-start

4. **Error Handling:**
   - Track `_lastApiError`, `_lastPollAt`, `_lastPollResult`
   - Write status to Firebase: `status: 'ok' | 'error'`
   - Include error message in Firebase when status is error
   - Don't throw from polling loop — log and continue

5. **Firebase Writes:**
   - Use `.update()` on `scoring/leaderboard/{apparatus}`, not `.set()` on `scoring/`
   - Include `updatedAt` timestamp in each subpath
   - Filter null values before writing

6. **Config Listening:**
   - Listen to `competitions/{compId}/config/scoringFeed` for enabled/interval changes
   - Restart polling loop when interval changes
   - Stop polling when enabled set to false

7. **Auto-Stop Triggers:**
   - Competition status = "completed" or "archived"
   - Virtius session status = "completed" or "finished"
   - 30-minute producer timeout (follow AutoShutdownService pattern)

## Risks

1. **Memory leaks:** If engines aren't cleaned up when competitions end, Map grows indefinitely.

2. **Firebase listener leaks:** Config listener must be `.off()`ed when engine is destroyed.

3. **Concurrent polling:** If interval is shorter than poll duration, requests can pile up. Need in-flight guard.

## Open Questions

1. **Should the service extend EventEmitter?** PlayoutEngine does. Useful for emitting state changes to socket.io.

2. **What events should be emitted?**
   - `'pollCompleted'` with new data
   - `'pollError'` with error details
   - `'configChanged'` when enabled/interval changes

3. **How is the service started?**
   - Option A: Proactively scans all competitions with `scoringFeed/enabled: true` on coordinator startup
   - Option B: Started by timesheet engine when show begins (like playoutEngine)
   - Option C: Started via socket event from producer (explicit action)

   Recommend Option A for always-on functionality + Option C for manual override.
