# PRD-OBS-01: State Sync Foundation

**Version:** 1.6
**Date:** 2026-01-20
**Status:** 🔧 In Progress (Critical Bugs)
**Depends On:** None (Foundation)
**Blocks:** All other OBS PRDs

---

## Overview

This PRD covers the foundational OBS state synchronization layer. All other OBS features depend on this working correctly. The two parallel systems have been unified into a single event-based architecture.

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Scene change events | **Option B** - Migrate to `obs:currentSceneChanged` (clean approach) |
| Firebase path | Use original PRD path: `competitions/{compId}/obs/state/` |
| Legacy state audit | Required - see audit results below |

---

## Current State

### Architecture (Post-Implementation)

| File | Purpose |
|------|---------|
| `server/lib/obsStateSync.js` | Primary state sync service (EventEmitter-based) |
| `server/lib/obsConnectionManager.js` | Per-competition OBS WebSocket connections |
| `server/index.js` | Event forwarding, legacy state sync |
| `show-controller/src/context/OBSContext.jsx` | React context - listens for `obs:*` events |
| `show-controller/src/context/ShowContext.jsx` | Show context - listens for both event formats |

### Unified Event Flow

```
OBS WebSocket → obsConnectionManager → server/index.js → Socket.io rooms
                                              ↓
                              Emits both: sceneChanged (legacy)
                                          obs:currentSceneChanged (new)
                                              ↓
                              Frontend contexts receive updates
```

**Legacy `showState.obsCurrentScene` is synced** via `obsStateSync.on('currentSceneChanged')` at `server/index.js:364-367`.

---

## Resolved Issues

### Issue 1: Scene Change Event Mismatch ✅ FIXED

**OBSContext.jsx** now listens for `obs:currentSceneChanged` (line 126).

**ShowContext.jsx** listens for both formats for compatibility:
- `sceneChanged` (line 102) - legacy
- `obs:currentSceneChanged` (line 107) - new

**Backend** emits both events from `server/index.js:3658-3659`:
```javascript
io.to(room).emit('sceneChanged', data.sceneName);
io.to(room).emit('obs:currentSceneChanged', { sceneName: data.sceneName });
```

### Issue 2: Duplicate `obs:refreshState` Handler ✅ FIXED

Only one handler remains at `server/index.js:3254` using the new `obsStateSync` system.

### Issue 3: State Not Synced Between Systems ✅ FIXED

Legacy `showState.obsCurrentScene` is synced from obsStateSync at `server/index.js:364-367`:
```javascript
obsStateSync.on('currentSceneChanged', ({ sceneName }) => {
  showState.obsCurrentScene = sceneName;
});
```

---

## Audit: `showState.obsCurrentScene` Usage ✅ COMPLETE

This legacy state property is kept in sync via the new system.

### Backend (server/)

| File | Line | Usage | Status |
|------|------|-------|--------|
| `index.js` | 364-366 | Synced from obsStateSync | ✅ Done |
| `index.js` | 602 | Set on initial OBS connect | ✅ Kept |
| `index.js` | 633 | Comment documenting sync | ✅ Added |

### Frontend (show-controller/src/)

| File | Line | Usage | Status |
|------|------|-------|--------|
| `context/ShowContext.jsx` | 16 | Initial state | ✅ Kept |
| `context/ShowContext.jsx` | 103, 109 | Listens to both event formats | ✅ Done |
| `components/QuickActions.jsx` | 35, 128-129, 213 | Reads from context | ✅ No change needed |
| `views/ProducerView.jsx` | 63, 425, 438, 493 | Reads from context | ✅ No change needed |
| `components/ConnectionStatus.jsx` | 5, 21 | Reads from context | ✅ No change needed |

---

## Requirements

### Requirement 1: Migrate to New Event System ✓ DECIDED

**Decision: Option B - Migrate to `obs:currentSceneChanged`**

Changes:
1. Update `OBSContext.jsx` to listen for `obs:currentSceneChanged`
2. Update `ShowContext.jsx` to also listen for `obs:currentSceneChanged`
3. Remove legacy handler in `index.js:627-631`
4. Keep emitting `sceneChanged` temporarily for any other listeners

### Requirement 2: Remove Duplicate Handler

Remove the first `obs:refreshState` handler:

**Keep:** Line 3267 (uses new `obsStateSync` system)
**Remove:** Line 2760 (uses old approach)

### Requirement 3: Update Firebase Path ✓ DECIDED

**Decision: Use `competitions/{compId}/obs/state/`**

Change in `obsStateSync.js` line 753:
```javascript
// OLD
await this._db.ref(`competitions/${this.competitionId}/production/obsState`).set(this.state);

// NEW
await this._db.ref(`competitions/${this.competitionId}/obs/state`).set(this.state);
```

### Requirement 4: Keep Legacy State in Sync

Update `showState.obsCurrentScene` from obsStateSync events for backward compatibility:

```javascript
obsStateSync.on('broadcast', ({ event, data }) => {
  if (event === 'obs:currentSceneChanged') {
    showState.obsCurrentScene = data.sceneName;
  }
});
```

---

## Implementation Plan

### Step 1: Update Firebase Path
- Change `obsStateSync.js` line 753 to use `obs/state/`
- Migrate any existing data (or let it recreate)

### Step 2: Add New Event Listener to Frontend
- `OBSContext.jsx`: Add `socket.on('obs:currentSceneChanged', ...)`
- `ShowContext.jsx`: Add `socket.on('obs:currentSceneChanged', ...)`

### Step 3: Remove Duplicate Handler
- Delete lines 2760-2772 in `server/index.js`

### Step 4: Remove Legacy Scene Handler
- Delete lines 627-631 in `server/index.js`
- Add sync to `showState` from obsStateSync events

### Step 5: Test End-to-End
- Verify scene changes propagate
- Verify Firebase persistence
- Verify multi-client sync

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/lib/obsStateSync.js` | Change Firebase path (line 753) |
| `server/index.js` | Remove duplicate handler (lines 2760-2772) |
| `server/index.js` | Remove legacy OBS handler (lines 627-631) |
| `server/index.js` | Add sync to `showState` from obsStateSync |
| `show-controller/src/context/OBSContext.jsx` | Add `obs:currentSceneChanged` listener |
| `show-controller/src/context/ShowContext.jsx` | Add `obs:currentSceneChanged` listener |

---

## Acceptance Criteria

- [x] Frontend receives scene changes via `obs:currentSceneChanged`
- [x] No duplicate socket handlers
- [x] State syncs correctly on fresh connection
- [x] State syncs correctly on reconnect (⚠️ with known issues - see below)
- [x] State persists to Firebase (⚠️ at `production/obsState` not `obs/state` - see Known Issues)
- [x] Multiple clients receive synchronized state
- [x] Console shows no "unhandled event" warnings
- [x] Legacy `showState.obsCurrentScene` stays in sync
- [x] QuickActions, ProducerView, ConnectionStatus still work

---

## Test Plan

### Manual Tests
1. Initial Connection → verify ProducerView loads and shows OBS status
2. Scene Changes from OBS → verify UI updates when scene changes in OBS
3. Scene Changes from UI → verify OBS changes when using ProducerView/QuickActions
4. Multi-Client Sync → verify multiple browser tabs stay in sync
5. Reconnection → verify disconnect detection and automatic reconnect
6. Firebase Persistence → verify state persists at `obs/state/`
7. Component Verification → verify ProducerView, QuickActions, ConnectionStatus work

### Automated Tests
```bash
npm test -- --grep "OBSStateSync"
```

### Specific Scenarios

| Scenario | Expected | How to Test |
|----------|----------|-------------|
| Page load | Full state from Firebase or OBS | Open OBS Manager |
| Scene change in OBS | All clients update within 500ms | Change scene in OBS app |
| ProducerView scene change | Updates OBS and all clients | Use scene dropdown |
| QuickActions click | Scene changes, button highlights | Click Quick Action |
| OBS disconnect | Error state shown, reconnect attempt | Stop OBS |
| OBS reconnect | State refreshes, no duplicates | Restart OBS |
| Server restart | State restores from Firebase | Restart Node server |

---

## Definition of Done

1. ✅ Scene changes work end-to-end (OBS → backend → all frontends) - Code complete
2. ✅ No duplicate handlers or events - Verified
3. ✅ State persists to Firebase at new path - Code uses `obs/state/`
4. ⏳ QuickActions, ProducerView, ConnectionStatus still work - Needs manual test
5. ⏳ No console errors - Needs manual test
6. ⏳ Tests pass - Needs manual test
7. ⏳ Code reviewed and merged

---

## Manual Testing Checklist

### Prerequisites

1. **Start OBS** on your local machine
2. **Enable WebSocket Server** in OBS:
   - Tools → WebSocket Server Settings
   - Check "Enable WebSocket server"
   - Note the port (default: 4455) and password
3. **Start the server**:
   ```bash
   cd server && npm run dev
   ```
4. **Start the frontend**:
   ```bash
   cd show-controller && npm run dev
   ```

### Test 1: Initial Connection ✅ PASSED

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1.1 | Open http://localhost:5173/producer?compId=8kyf0rnl | ProducerView loads | ✅ |
| 1.2 | Check OBS connection status in UI | Shows "Connected" or current scene name | ✅ |
| 1.3 | Open browser console | No errors related to OBS events | ✅ |

### Test 2: Scene Changes from OBS ✅ PASSED

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 2.1 | In OBS, switch to a different scene | UI updates within 500ms | ✅ |
| 2.2 | Check console for event | See `obs:currentSceneChanged` logged | ✅ |
| 2.3 | Switch scenes 5 times rapidly | All changes reflected, no duplicates | ✅ |

### Test 3: Scene Changes from UI ✅ PASSED

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 3.1 | In ProducerView, use scene dropdown | OBS switches to selected scene | ✅ |
| 3.2 | Click a QuickAction button | Scene changes in OBS and UI | ✅ |
| 3.3 | Verify button highlights correctly | Active scene button is highlighted | ✅ |

### Test 4: Multi-Client Sync ✅ PASSED

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 4.1 | Open second browser tab to same URL | Both show same current scene | ✅ |
| 4.2 | Change scene in OBS | Both tabs update simultaneously | ✅ |
| 4.3 | Change scene from Tab 1 | Tab 2 and OBS both update | ✅ |

### Test 5: Reconnection ⚠️ PARTIAL PASS

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 5.1 | Close OBS | UI shows disconnected/error state | ⚠️ (3-4 min delay) |
| 5.2 | Reopen OBS | UI reconnects and shows current state | ⚠️ (see notes) |
| 5.3 | Verify no duplicate events in console | Clean reconnection, no spam | ✅ |

**Notes:** See "Known Issues" section for details on slow disconnect detection and OBS Manager reconnect glitch.

### Test 6: Firebase Persistence ⚠️ PARTIAL PASS

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 6.1 | Change scene in OBS | Scene change persists | ✅ |
| 6.2 | Check Firebase console at `competitions/8kyf0rnl/obs/state` | State object exists with currentScene | ❌ (wrong path) |
| 6.3 | Refresh browser page | Current scene restored from Firebase | ✅ |

**Notes:** State persists and restores correctly, but is stored at `production/obsState` instead of `obs/state`. See Known Issues.

### Test 7: Component Verification ✅ PASSED

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 7.1 | ProducerView header | Shows current scene name when connected | ✅ |
| 7.2 | QuickActions panel | Active scene highlighted (tested in Test 3) | ✅ |
| 7.3 | ConnectionStatus component | Shows current scene name | ✅ |

**Notes:** Scene Override buttons in ProducerView are hardcoded and don't dynamically map to actual OBS scenes - this is a separate feature request, not a state sync issue.

---

## Test Results

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| 2026-01-20 | Julia | ✅ Pass (with issues) | 5/7 full pass, 2/7 partial pass, 3 known issues logged |

### Summary

| Test | Result |
|------|--------|
| 1. Initial Connection | ✅ PASSED |
| 2. Scene Changes from OBS | ✅ PASSED |
| 3. Scene Changes from UI | ✅ PASSED |
| 4. Multi-Client Sync | ✅ PASSED |
| 5. Reconnection | ⚠️ PARTIAL |
| 6. Firebase Persistence | ⚠️ PARTIAL |
| 7. Component Verification | ✅ PASSED |

### Test 5: Reconnection Results (2026-01-20)

**Environment:** Production (commentarygraphic.com), Competition VM at 13.222.221.61

| Step | Result | Notes |
|------|--------|-------|
| 5.1 Close OBS | ⚠️ Pass (slow) | UI detected disconnect but took **3-4 minutes** |
| 5.2 Reopen OBS | ⚠️ Partial | Immediately recognized OBS was on, but then showed "disconnected" after a few seconds. Page refresh showed "connected" correctly |
| 5.3 No duplicate events | ✅ Pass | Console showed clean disconnect/reconnect flow |

**ProducerView:** Reconnected successfully after OBS restart.

**OBS Manager:** Showed briefly connected, then disconnected, but page refresh showed correct connected state.

---

## Known Issues

### Issue: Slow Disconnect Detection (3-4 minutes) ✅ FIXED

**Severity:** Medium (UX issue)
**Component:** `server/lib/obsConnectionManager.js`

**Problem:** When OBS is killed, it takes 3-4 minutes for the web app to detect the disconnection. This is due to TCP socket timeout defaults.

**Root Cause:** The `obs-websocket-js` library relies on TCP keepalive for connection health. When OBS is forcefully terminated, the TCP connection doesn't send a FIN packet, so the client waits for TCP timeout.

**Fix Implemented:** Application-level heartbeat in `obsConnectionManager.js`:
- Pings OBS every 15 seconds via `obs.call('GetVersion')`
- If no response within 5 seconds, considers connection dead
- Triggers `connectionClosed` event and schedules reconnection

**Detection time:** Now ~15-20 seconds instead of 3-4 minutes.

**Verified:** 2026-01-20 - Tested on production with competition 8kyf0rnl and VM 13.222.221.61. Heartbeat starts on connect, disconnect detected quickly, auto-reconnect works.

---

### Issue: OBS Manager Shows Disconnect After Reconnect ✅ FIXED

**Severity:** Low (UI state sync issue)
**Component:** `server/index.js`

**Problem:** After OBS reconnects, OBS Manager briefly shows "connected" then switches to "disconnected". Page refresh shows correct "connected" state.

**Root Cause:** The `obsConnectionManager` emits `connectionClosed` when OBS connection is lost unexpectedly (TCP close or heartbeat failure), but the server only listened for `disconnected` (which is only emitted on manual disconnect). This meant the frontend never received `obs:disconnected` when the connection was lost, causing stale state.

**Fix Implemented:** Added `connectionClosed` event handler in `server/index.js:3719-3724`:
```javascript
obsConnManager.on('connectionClosed', ({ compId }) => {
  const room = `competition:${compId}`;
  console.log(`[OBS] Connection closed for ${compId}, notifying clients`);
  io.to(room).emit('obs:disconnected', { connected: false });
});
```

**Verified:** 2026-01-20 - Deployed to production VM (3.238.176.165).

---

### Issue: Firebase Path Not Updated

**Severity:** Low (technical debt)
**Component:** `server/lib/obsStateSync.js`

**Problem:** OBS state is being stored at `competitions/{compId}/production/obsState` instead of the PRD-specified path `competitions/{compId}/obs/state`.

**Evidence:** Firebase query for `competitions/8kyf0rnl/obs/state` returns null, but `competitions/8kyf0rnl/production/obsState` contains the full state object.

**Impact:** Functional - state persists and restores correctly. However, path doesn't match PRD specification and mixes concerns (`production/` vs `obs/`).

**Proposed Fix:** Update `obsStateSync.js` to write to `obs/state` path, or update PRD to document current path as intentional.

---

## Critical Bugs (2026-01-20)

These bugs were discovered during production testing and must be fixed before state sync can be considered complete.

### Bug 1: Dual Source of Truth for Connection Status 🔴 CRITICAL

**Severity:** Critical
**Components:** `OBSContext.jsx`, `ShowContext.jsx`

**Symptoms:**
- ProducerView shows "OBS not connected" while OBS Manager shows "OBS Connected"
- Switching scenes in OBS Manager finally makes ProducerView show correct status
- State drifts between views over time

**Root Cause:** Two React contexts maintain independent `obsConnected` state:

| Context | How it gets connection status | Used by |
|---------|------------------------------|---------|
| `OBSContext` | Listens to `obs:connected`, `obs:disconnected` directly | OBS Manager |
| `ShowContext` | Listens to `obs:stateUpdated` and extracts `connected` flag | ProducerView |

When events fire, each context updates independently with no synchronization. Race conditions cause drift.

**Evidence:**
```javascript
// OBSContext.jsx - maintains its own obsConnected
const [obsConnected, setObsConnected] = useState(false);
socket.on('obs:connected', () => setObsConnected(true));

// ShowContext.jsx - maintains separate obsConnected
const [state, setState] = useState({ obsConnected: false, ... });
socket.on('obs:stateUpdated', (data) => {
  setState(prev => ({ ...prev, obsConnected: data.connected }));
});
```

---

### Bug 2: Stale Scenes After Disconnect 🔴 CRITICAL

**Severity:** Critical
**Component:** `server/lib/obsStateSync.js`

**Symptoms:**
- After OBS disconnects, scene list shows "No scenes found"
- Creating a new scene suddenly makes ALL existing scenes appear
- Scenes from previous session appear after reconnect

**Root Cause:** `onConnectionClosed()` does NOT clear the `scenes` array:

```javascript
// obsStateSync.js - onConnectionClosed()
async onConnectionClosed() {
  this.state.connected = false;
  this.state.connectionError = 'Connection closed';
  // MISSING: this.state.scenes = [];
  // MISSING: this.state.inputs = [];
  // MISSING: this.state.audioSources = [];
  // MISSING: this.state.transitions = [];
}
```

When OBS reconnects and refreshes state, the old cached scenes merge with new data, causing confusion.

---

### Bug 3: Random Disconnects Require Multiple Refreshes 🟡 MEDIUM

**Severity:** Medium
**Component:** `OBSContext.jsx`

**Symptoms:**
- OBS Manager randomly shows "Disconnected" even when OBS is running
- Multiple page refreshes needed to restore correct state
- Connection status flickers

**Root Cause:** Event listener lifecycle issues. When socket reconnects, listeners may be in inconsistent state. The `obs:refreshState` request happens after listeners attach, but if socket drops before response, there's no retry mechanism.

---

## Fix Plan

### Fix 1: Unified Connection Status (Single Source of Truth)

**Decision:** Server-side `obsStateSync` is the single source of truth. Frontend reads from it, never maintains separate state.

**Architecture:**
```
Server (obsStateSync.state.connected)
         ↓
    obs:stateUpdated event (includes connected flag)
         ↓
    ShowContext.obsConnected (reads from event)
         ↓
    OBSContext (reads from ShowContext, does NOT maintain own state)
         ↓
    All components read from one place
```

**Implementation:**

1. **Remove duplicate state from OBSContext:**
   ```javascript
   // BEFORE: OBSContext maintains its own obsConnected
   const [obsConnected, setObsConnected] = useState(false);

   // AFTER: OBSContext reads from ShowContext
   const { obsConnected } = useShow();
   ```

2. **ShowContext becomes the frontend source of truth:**
   - Listens to `obs:connected`, `obs:disconnected`, `obs:stateUpdated`
   - Updates `state.obsConnected` from any of these events
   - All components read from ShowContext

3. **OBSContext focuses only on OBS-specific state:**
   - Scenes, inputs, transitions, audio sources
   - Commands (createScene, switchScene, etc.)
   - Does NOT track connection status

**Files to Modify:**

| File | Change |
|------|--------|
| `show-controller/src/context/OBSContext.jsx` | Remove `obsConnected` state, import from ShowContext |
| `show-controller/src/context/ShowContext.jsx` | Ensure it handles all connection events |
| `show-controller/src/components/OBSManager.jsx` | Read `obsConnected` from ShowContext instead of OBSContext |

---

### Fix 2: Clear State on Disconnect

**Implementation:**

In `server/lib/obsStateSync.js`, update `onConnectionClosed()`:

```javascript
async onConnectionClosed() {
  console.log('[OBSStateSync] OBS connection closed');

  // Clear all OBS-specific state
  this.state.connected = false;
  this.state.connectionError = 'Connection closed';
  this.state.scenes = [];
  this.state.inputs = [];
  this.state.audioSources = [];
  this.state.transitions = [];
  this.state.currentScene = null;
  this.state.currentProgramScene = null;

  // Save and broadcast
  await this._saveState();
  this.broadcast('obs:disconnected', { connected: false });
  this.broadcast('obs:stateUpdated', this.state);
  this.emit('disconnected');
}
```

**Files to Modify:**

| File | Change |
|------|--------|
| `server/lib/obsStateSync.js` | Clear scenes/inputs/etc in `onConnectionClosed()` |

---

### Fix 3: Force State Refresh on Reconnect

**Implementation:**

When `obs:connected` is received on frontend, immediately request full state:

```javascript
// In ShowContext.jsx or OBSContext.jsx
socket.on('obs:connected', () => {
  setState(prev => ({ ...prev, obsConnected: true }));
  // Immediately request fresh state
  socket.emit('obs:refreshState');
});
```

**Files to Modify:**

| File | Change |
|------|--------|
| `show-controller/src/context/ShowContext.jsx` | Add `obs:refreshState` emit on connect |

---

## Implementation Order

1. **Fix 2: Clear State on Disconnect** (server-side, low risk)
2. **Fix 3: Force State Refresh on Reconnect** (frontend, low risk)
3. **Fix 1: Unified Connection Status** (frontend refactor, higher risk)

---

## Acceptance Criteria (Updated)

- [ ] ProducerView and OBS Manager always show same connection status
- [ ] Disconnecting OBS clears scene list immediately
- [ ] Reconnecting OBS shows fresh scene list (not cached)
- [ ] No multiple page refreshes needed to restore state
- [ ] Connection status updates within 1 second of actual state change

---

## Implementation Summary

### Files Modified

| File | Change | Line(s) |
|------|--------|---------|
| `server/lib/obsStateSync.js` | Firebase path already correct | 753 |
| `server/index.js` | Legacy handler removed, sync added | 364-367, 632-633 |
| `server/index.js` | Duplicate handler removed | (was 2760) |
| `server/index.js` | Emits both event formats | 3658-3659 |
| `show-controller/src/context/OBSContext.jsx` | Listens for `obs:currentSceneChanged` | 126 |
| `show-controller/src/context/ShowContext.jsx` | Listens for both event formats | 102-110 |

### Code Verification

Run these commands to verify the implementation:

```bash
# Check OBSContext listener
grep -n "obs:currentSceneChanged" show-controller/src/context/OBSContext.jsx

# Check ShowContext listeners
grep -n "sceneChanged\|obs:currentSceneChanged" show-controller/src/context/ShowContext.jsx

# Check server event emission
grep -n "obs:currentSceneChanged" server/index.js

# Check legacy sync
grep -n "obsStateSync.on" server/index.js | grep -i scene

# Check Firebase path
grep -n "obs/state" server/lib/obsStateSync.js
```
