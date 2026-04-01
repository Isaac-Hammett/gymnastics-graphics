# Renderer System Phase 3: Scoring Ingestion — Tasks

## Summary

Phase 3 creates a server-side Virtius polling service that writes graphic-ready scoring data to Firebase. This replaces the browser-side API calls in output.html with a single-source-of-truth data flow.

**Files touched across all tasks:**
- `server/lib/scoringIngestionService.js` (new)
- `server/index.js` (integration)
- `show-controller/src/hooks/useScoringFeed.js` (new)
- `show-controller/src/components/ScoringFeedPanel.jsx` (new)
- `show-controller/src/components/ScoringFeedBadge.jsx` (new)
- `show-controller/src/views/ProducerView.jsx` (panel integration)
- `show-controller/src/pages/HomePage.jsx` (badge integration)

---

## Tasks

### Task 1: Create scoringIngestionService core module — COMPLETE

**Files:** `server/lib/scoringIngestionService.js` (new)

Create the core service module following the PlayoutEngine singleton pattern. This task creates the class structure, constructor, and exports without polling logic.

**Implementation:**
- Create `ScoringIngestionService` class extending `EventEmitter`
- Constructor accepts `{ compId, firebase, io }` options
- Initialize state: `_state`, `_pollTimer`, `_lastPollAt`, `_lastPollResult`, `_lastApiError`, `_eventLog`
- Create `getState()` method returning comprehensive state snapshot
- Create `_log(type, message)` method for circular event buffer (max 50 entries)
- Create singleton manager: `scoringServices = new Map()`
- Export `getScoringService(compId, options)`, `removeScoringService(compId)`, `getAllScoringServices()`

**Verify:**
- [ ] File exists at `server/lib/scoringIngestionService.js`
- [ ] Class exports are importable: `const { getScoringService } = require('./lib/scoringIngestionService');`
- [ ] No syntax errors when coordinator starts

---

### Task 2: Implement Virtius API fetch with processVirtiusData — COMPLETE

**Files:** `server/lib/scoringIngestionService.js`

Add the API fetching and data transformation logic. This is the core business logic of the service.

**Implementation:**
- Add `_fetchVirtiusData(sessionId)` method with AbortController timeout (15s)
- Add `processVirtiusData(raw, gender)` returning `{ leaderboards, teamTotals, rotationState, allAround }`
- Leaderboard processing:
  - Read all gymnast scores for apparatus across teams
  - Sort by score descending
  - Assign ranks using gap ranking (1, 2, 2, 4 — skip tied positions)
  - Compute `isTied` boolean for each row
  - Limit to top 10
  - Include `diff`, `exec`, `stickBonus` for men's events only
  - Score formula: `D + E - ND + Bonus` where E includes 10.0 base
- Team logo lookup: read from `teamsDatabase/teams/{teamKey}/logo`, fallback to Virtius API logo
- Cache team logos in memory (`_teamLogoCache = new Map()`) to avoid repeated Firebase reads
- Apparatus code normalization: "Floor Exercise" → "FX", "Pommel Horse" → "PH", etc.

**Verify:**
- [ ] `processVirtiusData()` correctly extracts scores from sample Virtius response (use fixture from `docs/PRD-Clip-Integration/fixtures/`)
- [ ] Gap ranking produces correct results: scores [9.9, 9.8, 9.8, 9.7] → ranks [1, 2, 2, 4]
- [ ] `isTied` is true for rank 2 gymnasts, false for ranks 1 and 4
- [ ] Men's events include `diff`, `exec`, `stickBonus`; women's events do not

---

### Task 3: Implement polling loop with Firebase writes — COMPLETE

**Files:** `server/lib/scoringIngestionService.js`

Add the polling loop that fetches data and writes to Firebase at the configured interval.

**Implementation:**
- Add `start()` method:
  - Read `config/virtiusSessionId` and `config/gender` from Firebase
  - Guard: if no sessionId, log warning and return
  - Call `_startPolling()`
  - Emit `'started'` event
- Add `_startPolling()` / `_stopPolling()` pair (guard against double-start)
- Polling work function `_poll()`:
  - Fetch Virtius data
  - Process into graphic-ready structures
  - Write to Firebase using `.update()` on individual subpaths (NOT `.set()` on root):
    - `scoring/leaderboard/{apparatus}` for each apparatus
    - `scoring/teamTotals`
    - `scoring/rotationState`
    - `scoring/leaderboard/AA`
    - `scoring/updatedAt`
  - Update `config/scoringFeed/lastPollAt`, `status: 'ok'`
  - Clear `errorMessage` on success
  - Log event and broadcast state
- Error handling in `_poll()`:
  - Catch errors, update `status: 'error'`, `errorMessage`
  - Track `_lastApiError`
  - Don't break the loop — continue polling
- Add `stop()` method that clears timer, emits `'stopped'`
- Add `forcePoll()` method for manual refresh

**Verify:**
- [ ] Service starts polling when `start()` is called with valid sessionId
- [ ] Firebase path `competitions/{compId}/scoring/leaderboard/VT` contains data after poll
- [ ] `scoring/updatedAt` timestamp updates each poll cycle
- [ ] Error in API response writes `status: 'error'` to Firebase
- [ ] Polling continues after an error (doesn't crash the loop)

---

### Task 4: Implement config listener for dynamic interval changes — COMPLETE

**Files:** `server/lib/scoringIngestionService.js`

Add Firebase listener for `scoringFeed` config changes to restart polling with new interval.

**Implementation:**
- Add `_setupConfigListener()` method called in `start()`
- Listen to `competitions/{compId}/config/scoringFeed` using `.on('value', ...)`
- When `pollInterval` changes: restart polling loop with new interval
- When `enabled` changes to `false`: call `stop()`
- Store listener reference for cleanup in `stop()`
- Add `_configListener` cleanup in `stop()` (call `.off()`)
- Listen for `forceRefresh` timestamp change → trigger immediate `_poll()`

**Verify:**
- [ ] Changing `pollInterval` from 15 to 30 in Firebase restarts loop at 30s
- [ ] Setting `enabled: false` stops polling
- [ ] Setting `enabled: true` resumes polling
- [ ] Writing new `forceRefresh` timestamp triggers immediate poll

---

### Task 5: Implement auto-stop triggers — COMPLETE

**Files:** `server/lib/scoringIngestionService.js`

Add automatic stopping when competitions end or producers disconnect.

**Implementation:**
- Add `_setupAutoStop()` called in `start()`:
  - **Trigger 1:** Listen to `competitions/{compId}/status` — stop on "completed" or "archived"
  - **Trigger 2:** Check `data.meet.status` in each poll response — stop on "completed" or "finished"
  - **Trigger 3:** 30-minute producer timeout using activity timestamp
- Add `_lastProducerActivity` timestamp, updated by `resetProducerActivity()`
- Add `_producerTimeoutTimer` (60s check interval)
- Add `_autoStop(reason)` method that:
  - Logs the reason
  - Calls `stop()`
  - Writes `enabled: false`, `status: 'stopped'`, `errorMessage: 'Auto-stopped: {reason}'` to Firebase
  - Emits `'autoStopped'` event with reason
- Clean up all listeners in `stop()`:
  - `_competitionStatusListener`
  - `_producerTimeoutTimer`
  - `_configListener`

**Verify:**
- [ ] Setting competition status to "completed" stops polling within 60 seconds
- [ ] Virtius session returning "finished" status stops polling
- [ ] No producer activity for 30+ minutes stops polling (test with shorter timeout for dev)
- [ ] Auto-stop writes correct `errorMessage` to Firebase

---

### Task 6: Integrate service into server/index.js — COMPLETE

**Files:** `server/index.js`

Wire the scoring service into the coordinator server startup and socket handlers.

**Implementation:**
- Add import at top: `const { getScoringService, removeScoringService, getAllScoringServices } = require('./lib/scoringIngestionService');`
- Add `initializeScoringIngestion()` function:
  - Scan all competitions for `scoringFeed.enabled: true` and `virtiusSessionId`
  - Start services for any matching competitions
  - Listen to `competitions/` for `child_changed` to start/stop services dynamically
- Add `wireScoringServiceEvents(service, compId)` function:
  - Forward `pollCompleted` → `io.to(room).emit('scoring:pollCompleted')`
  - Forward `pollError` → `io.to(room).emit('scoring:pollError')`
  - Forward `started` → `io.to(room).emit('scoring:started')`
  - Forward `stopped` → `io.to(room).emit('scoring:stopped')`
  - Forward `autoStopped` → `io.to(room).emit('scoring:autoStopped')` + cleanup
- Add socket handlers inside `io.on('connection', ...)`:
  - `scoring:start` → getScoringService + start
  - `scoring:stop` → removeScoringService
  - `scoring:forceRefresh` → service.forcePoll()
  - `scoring:getState` → emit service.getState()
- Add socket middleware to reset producer activity on any event
- Call `initializeScoringIngestion()` in startup sequence (after Firebase ready)

**Verify:**
- [ ] Coordinator starts without errors with new integration
- [ ] Competition with `scoringFeed.enabled: true` starts polling on coordinator startup
- [ ] Socket event `scoring:start` creates and starts the service
- [ ] Socket event `scoring:stop` stops and removes the service
- [ ] Socket event `scoring:getState` returns current state

---

### Task 7: Create useScoringFeed hook — COMPLETE

**Files:** `show-controller/src/hooks/useScoringFeed.js` (new)

Create React hook for Firebase listener and control functions.

**Implementation:**
- `useScoringFeed(compId)` hook returning `{ feedState, loading, setEnabled, setPollInterval, forceRefresh }`
- Firebase listener on `competitions/{compId}/config/scoringFeed`
- `setEnabled(boolean)` → direct Firebase write
- `setPollInterval(seconds)` → direct Firebase write
- `forceRefresh()` → write `forceRefresh: Date.now()` to Firebase
- Default state when path doesn't exist: `{ enabled: false, pollInterval: 15, lastPollAt: null, status: null, errorMessage: null }`
- Cleanup listener on unmount

**Verify:**
- [ ] Hook returns current feedState from Firebase
- [ ] Calling `setEnabled(true)` writes to Firebase
- [ ] Calling `setPollInterval(30)` writes to Firebase
- [ ] Calling `forceRefresh()` writes timestamp to Firebase
- [ ] Component unmount cleans up listener (no memory leak)

---

### Task 8: Create ScoringFeedPanel component — COMPLETE

**Files:** `show-controller/src/components/ScoringFeedPanel.jsx` (new)

Create the Producer View sidebar panel for scoring feed control.

**Implementation:**
- Follow ScoreBugPanel collapsible pattern (bg-zinc-800, rounded-xl, overflow-hidden)
- Header: Signal icon + "Scoring Feed" + status badge (LIVE·15s / OFF / ERROR)
- Controls when expanded:
  - Enable/Disable toggle switch
  - Poll interval dropdown (5s, 10s, 15s, 30s, 60s)
  - Last updated indicator ("3s ago" with live-updating interval)
  - Status badge (OK / Error with message)
  - Manual refresh button with ArrowPathIcon
- Props: `{ compId, collapsed }`
- Use `useScoringFeed` hook for state and actions
- Hide panel if no `virtiusSessionId` configured (check via separate Firebase read)
- Color scheme: blue (border-blue-500/30, bg-blue-500/10, text-blue-400)

**Verify:**
- [ ] Panel renders in collapsed state showing status badge
- [ ] Panel expands to show all controls
- [ ] Toggle switch enables/disables feed (Firebase updates)
- [ ] Dropdown changes poll interval (Firebase updates)
- [ ] Last updated shows time ago and updates live
- [ ] Error state shows red error message
- [ ] Refresh button triggers immediate poll
- [ ] Panel hidden when no virtiusSessionId configured

---

### Task 9: Integrate ScoringFeedPanel into ProducerView — NOT STARTED

**Files:** `show-controller/src/views/ProducerView.jsx`

Add the scoring feed panel to the producer sidebar.

**Implementation:**
- Import ScoringFeedPanel at top (near line 19)
- Add panel render after ScoreBugPanel (around line 1287):
  ```jsx
  <ScoringFeedPanel compId={compId} collapsed={true} />
  ```
- Pass `compId` from existing props

**Verify:**
- [ ] ScoringFeedPanel appears in sidebar after ScoreBugPanel
- [ ] Panel shows correct state for the competition
- [ ] Panel controls work (toggle, dropdown, refresh)
- [ ] No console errors when panel renders

---

### Task 10: Create ScoringFeedBadge component — NOT STARTED

**Files:** `show-controller/src/components/ScoringFeedBadge.jsx` (new)

Create the competition card badge for scoring feed status.

**Implementation:**
- Follow StatsStatusBadge inline badge pattern
- Firebase listener on `competitions/{compId}/config/scoringFeed` AND `config/virtiusSessionId`
- Return `null` if no virtiusSessionId configured
- States:
  - LIVE·{interval}s: Green pulsing dot + green background
  - FEED OFF: Gray background
  - FEED ERROR: Red background with ExclamationTriangleIcon
- Click behavior:
  - LIVE → confirm dialog → set enabled: false
  - OFF → set enabled: true
  - ERROR → show error tooltip
- CSS classes match existing badge patterns

**Verify:**
- [ ] Badge shows LIVE with pulsing dot when enabled
- [ ] Badge shows OFF when disabled
- [ ] Badge shows ERROR with icon when status is error
- [ ] Badge hidden when no virtiusSessionId configured
- [ ] Clicking LIVE shows confirm dialog before disabling
- [ ] Clicking OFF enables the feed

---

### Task 11: Integrate ScoringFeedBadge into HomePage — NOT STARTED

**Files:** `show-controller/src/pages/HomePage.jsx`

Add the scoring feed badge to competition cards.

**Implementation:**
- Import ScoringFeedBadge at top
- Add to dynamic badge area (around line 1045):
  ```jsx
  <ScoringFeedBadge compId={compId} />
  ```
- Position after CommentaryStatusBadge

**Verify:**
- [ ] Badge appears on competition cards
- [ ] Badge shows correct state for each competition
- [ ] Click toggles feed on/off
- [ ] Multiple competition cards show independent states

---

### Task 12: End-to-end verification — NOT STARTED

**Files:** None (verification only)

Test the complete data flow from Virtius API to Firebase to renderer blocks.

**Verification Steps:**
1. Start coordinator server
2. Create competition with virtiusSessionId configured
3. Enable scoring feed via HomePage badge
4. Verify polling starts (check server logs)
5. Verify Firebase paths populated:
   - `scoring/leaderboard/VT` (or appropriate apparatus)
   - `scoring/teamTotals`
   - `scoring/rotationState`
   - `scoring/updatedAt`
6. Open Producer View, verify ScoringFeedPanel shows correct state
7. Change poll interval, verify it takes effect
8. Trigger force refresh, verify immediate poll
9. Disable feed, verify polling stops
10. Test auto-stop by setting competition status to "completed"
11. Open stage.html with leaderboard-table block, verify it reads from Firebase
12. Update Virtius data, verify block re-renders with new scores

**Verify:**
- [ ] Complete data flow works: Virtius → Server → Firebase → Block
- [ ] Live updates propagate within one poll cycle
- [ ] Multiple competitions poll independently
- [ ] Error recovery works (temporary API failure doesn't break service)
- [ ] Auto-stop triggers work correctly

---

## Discovered Bugs

(populated by iterations as they find problems)

---

## Learnings

- Task 1 verified via `node --input-type=module -e "import { getScoringService }..."` — ES module syntax works
- ScoringIngestionService class structure follows PlayoutEngine exactly — EventEmitter extension, constructor with options, getState() method, singleton manager exports
- The service uses ES module syntax (`import`/`export`) matching playoutEngine.js pattern
- Task 2 adds `_fetchVirtiusData()` with AbortController timeout (15s) and `processVirtiusData()` that returns `{ leaderboards, teamTotals, rotationState, allAround }`
- Gap ranking: scores [14.2, 14.1, 14.1, 13.8] → ranks [1, 2, 2, 4] — verified working
- `isTied` correctly identifies tied positions (rank 2) while marking non-tied positions as false
- Men's events include `diff`, `exec`, `stickBonus`; women's events have these as `null`
- `stickBonus` is derived from `bonus > 0` in the API response
- Team logo caching via `_teamLogoCache` Map reduces Firebase reads for repeated lookups
- Task 3 adds `start()`, `stop()`, `forcePoll()`, `_startPolling()`, `_stopPolling()`, `_poll()`, `_writeToFirebase()`, `_updateFeedStatus()`, `_broadcastState()` methods
- Polling loop uses `setInterval` with guard pattern (`_stopPolling()` called inside `_startPolling()` to prevent double-start)
- Firebase writes use `.set()` on child paths (e.g., `scoringRef.child('leaderboard/VT').set(...)`) — avoids `.update()` on root to prevent partial overwrites
- `_poll()` catches all errors internally so the interval loop never crashes
- `_broadcastState()` emits to socket room `competition:{compId}` with event name `scoring:stateChanged`
- Task 4 adds `_setupConfigListener()`, `_cleanupConfigListener()` methods for dynamic config changes
- Config listener tracks `lastForceRefresh` to detect new force refresh triggers (avoids triggering on initial read)
- Config listener handles: `pollInterval` changes (restarts loop), `enabled: false` (stops service), `forceRefresh` timestamp (immediate poll)
- `_configListenerRef` and `_configListenerCallback` stored for proper cleanup in `stop()`
- "Setting `enabled: true` resumes polling" requires Task 6 integration — the coordinator needs to detect the config change and call `start()` on a stopped service
- Task 5 adds auto-stop with 3 triggers: (1) competition status listener for "completed"/"archived", (2) meet status check in `_poll()` for "completed"/"finished", (3) producer timeout (30 min) with 60s check interval
- `_autoStop(reason)` calls `stop()` first, then writes `enabled: false`, `status: 'stopped'`, `errorMessage: 'Auto-stopped: {reason}'` to Firebase, then emits `'autoStopped'` event
- `_cleanupAutoStop()` removes the competition status listener and clears the producer timeout timer — called from `stop()` to prevent leaks
- Constants: `PRODUCER_TIMEOUT_MS = 30 * 60 * 1000`, `PRODUCER_TIMEOUT_CHECK_INTERVAL_MS = 60 * 1000`
- Task 6 adds server/index.js integration with: import, `initializeScoringIngestion()`, `wireScoringServiceEvents()`, socket handlers for `scoring:start/stop/forceRefresh/getState/resetActivity`, initial state emission on connect, and producer activity reset in socket middleware
- `initializeScoringIngestion()` scans all competitions for `scoringFeed.enabled: true` AND `virtiusSessionId` on startup, starts services for matches
- `initializeScoringIngestion()` also listens for `child_changed` on `competitions/` to start services dynamically when producers enable feeds after startup
- Socket handlers check `service.listenerCount('started')` to avoid duplicate event wiring
- Initial scoring state sent on client connect (similar to playout state pattern)
- Producer activity reset added to existing `socket.use()` middleware for automatic reset on any socket event
- Task 7: useScoringFeed hook follows useThemeErrors pattern — Firebase `onValue` listener with `update()` for writes, cleanup on unmount
- useScoringFeed uses DEFAULT_STATE object for consistent defaults when Firebase path doesn't exist
- Task 8: ScoringFeedPanel follows ScoreBugPanel collapsible pattern exactly — same bg-zinc-800 rounded-xl structure
- ScoringFeedPanel uses separate Firebase listener for virtiusSessionId to hide panel when not configured
- TimeAgo component reuses the HeartbeatIndicator pattern from ScoreBugPanel but simplified for scoring feed
- Blue color scheme (text-blue-400, bg-blue-500/*, border-blue-500/*) distinguishes scoring feed from green score bug
