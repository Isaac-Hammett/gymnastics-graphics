# PRD-OBS-01: State Sync Foundation

**Version:** 1.3
**Date:** 2026-01-20
**Status:** Implemented - Pending Manual Testing
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
- [ ] State syncs correctly on fresh connection
- [ ] State syncs correctly on reconnect
- [ ] State persists to Firebase at `competitions/{compId}/obs/state/`
- [ ] Multiple clients receive synchronized state
- [ ] Console shows no "unhandled event" warnings
- [x] Legacy `showState.obsCurrentScene` stays in sync
- [ ] QuickActions, ProducerView, ConnectionStatus still work

---

## Test Plan

### Manual Tests
1. Open OBS Manager → verify state loads
2. Change scene in OBS directly → verify UI updates
3. Open ProducerView → verify scene dropdown shows current scene
4. Open QuickActions → verify active scene highlighted
5. Disconnect OBS WebSocket → verify error state shown
6. Reconnect OBS → verify state restores
7. Open second browser tab → verify both show same state
8. Check Firebase console → verify state at `obs/state/`

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

### Test 1: Initial Connection

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1.1 | Open http://localhost:5173/producer?compId=8kyf0rnl | ProducerView loads | ☐ |
| 1.2 | Check OBS connection status in UI | Shows "Connected" or current scene name | ☐ |
| 1.3 | Open browser console | No errors related to OBS events | ☐ |

### Test 2: Scene Changes from OBS

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 2.1 | In OBS, switch to a different scene | UI updates within 500ms | ☐ |
| 2.2 | Check console for event | See `obs:currentSceneChanged` logged | ☐ |
| 2.3 | Switch scenes 5 times rapidly | All changes reflected, no duplicates | ☐ |

### Test 3: Scene Changes from UI

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 3.1 | In ProducerView, use scene dropdown | OBS switches to selected scene | ☐ |
| 3.2 | Click a QuickAction button | Scene changes in OBS and UI | ☐ |
| 3.3 | Verify button highlights correctly | Active scene button is highlighted | ☐ |

### Test 4: Multi-Client Sync

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 4.1 | Open second browser tab to same URL | Both show same current scene | ☐ |
| 4.2 | Change scene in OBS | Both tabs update simultaneously | ☐ |
| 4.3 | Change scene from Tab 1 | Tab 2 and OBS both update | ☐ |

### Test 5: Reconnection

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 5.1 | Close OBS | UI shows disconnected/error state | ☐ |
| 5.2 | Reopen OBS | UI reconnects and shows current state | ☐ |
| 5.3 | Verify no duplicate events in console | Clean reconnection, no spam | ☐ |

### Test 6: Firebase Persistence

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 6.1 | Change scene in OBS | Scene change persists | ☐ |
| 6.2 | Check Firebase console at `competitions/8kyf0rnl/obs/state` | State object exists with currentScene | ☐ |
| 6.3 | Refresh browser page | Current scene restored from Firebase | ☐ |

### Test 7: Component Verification

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 7.1 | ProducerView scene dropdown | Shows current scene, can change | ☐ |
| 7.2 | QuickActions panel | Active scene highlighted | ☐ |
| 7.3 | ConnectionStatus component | Shows current scene name | ☐ |

---

## Test Results

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| | | | |

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
