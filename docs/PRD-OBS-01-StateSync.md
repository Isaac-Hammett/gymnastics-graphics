# PRD-OBS-01: State Sync Foundation

**Version:** 1.2
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** None (Foundation)
**Blocks:** All other OBS PRDs

---

## Overview

This PRD covers the foundational OBS state synchronization layer. All other OBS features depend on this working correctly. The code largely exists but has integration issues from having **two parallel systems** that need to be unified.

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Scene change events | **Option B** - Migrate to `obs:currentSceneChanged` (clean approach) |
| Firebase path | Use original PRD path: `competitions/{compId}/obs/state/` |
| Legacy state audit | Required - see audit results below |

---

## Current State

### What Exists

| File | Lines | Purpose |
|------|-------|---------|
| `server/lib/obsStateSync.js` | 1,239 | New state sync service (EventEmitter-based) |
| `server/lib/obsConnectionManager.js` | 311 | Per-competition OBS WebSocket connections |
| `server/index.js` | - | Legacy OBS handlers (lines 627-631, etc.) |
| `show-controller/src/context/OBSContext.jsx` | - | React context with socket listeners |

### Root Problem: Two Parallel Systems

The codebase has **two OBS event systems** running simultaneously:

**1. Legacy System** (`server/index.js`)
- Direct OBS WebSocket connection
- Emits `sceneChanged`, `stateUpdate`
- Lines 627-631: `obs.on('CurrentProgramSceneChanged', ...)`

**2. New System** (`server/lib/obsStateSync.js`)
- Uses `OBSStateSync` class with EventEmitter
- Emits `obs:currentSceneChanged`, `obs:stateUpdated`
- More comprehensive state management

**The frontend mixes events from both systems, causing inconsistency.**

---

## Known Issues

### Issue 1: Scene Change Event Mismatch

**Frontend listens for:** (OBSContext.jsx:125)
```javascript
socket.on('sceneChanged', handleSceneChanged);  // Legacy event name
```

**Backend emits:**

| Location | Event | When |
|----------|-------|------|
| `index.js:629` | `sceneChanged` | Legacy OBS handler |
| `index.js:3671` | `sceneChanged` + `obs:currentSceneChanged` | Room-based |
| `obsStateSync.js:339` | `obs:currentSceneChanged` | New system |

**Result:** Scene changes from new system are missed by frontend.

### Issue 2: Duplicate `obs:refreshState` Handler

Two different handlers for the same event:

| Line | Implementation | Behavior |
|------|----------------|----------|
| 2760 | Uses `broadcastOBSState()` | Fetches from obsConnectionManager |
| 3267 | Uses `obsStateSync.refreshFullState()` | Uses new state sync |

**Result:** Unpredictable behavior depending on which handler runs.

### Issue 3: State Not Synced Between Systems

- Legacy `showState.obsCurrentScene` vs `obsStateSync.state.currentScene`
- Both track the same thing but may diverge

---

## Audit: `showState.obsCurrentScene` Usage

This legacy state property is used in **6 files**. All must be updated or kept in sync.

### Backend (server/)

| File | Line | Usage | Action |
|------|------|-------|--------|
| `index.js` | 92 | Initial state declaration | Keep for backward compat |
| `index.js` | 597 | Set on OBS connect | Update from obsStateSync |
| `index.js` | 628 | Set on scene change | Remove (use obsStateSync) |

### Frontend (show-controller/src/)

| File | Line | Usage | Action |
|------|------|-------|--------|
| `context/ShowContext.jsx` | 16 | Initial state | Keep |
| `context/ShowContext.jsx` | 103 | Update handler | Listen to `obs:currentSceneChanged` |
| `components/QuickActions.jsx` | 35, 128-129, 213 | Check active scene | No change needed (reads from context) |
| `views/ProducerView.jsx` | 61, 423, 436, 491 | Display current scene | No change needed (reads from context) |
| `components/ConnectionStatus.jsx` | 5, 21 | Display current scene | No change needed (reads from context) |

### Strategy
- Keep `obsCurrentScene` in `ShowContext` for backward compatibility
- Update it from `obs:currentSceneChanged` events (new system)
- Remove legacy setter in `index.js:628`

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

- [ ] Frontend receives scene changes via `obs:currentSceneChanged`
- [ ] No duplicate socket handlers
- [ ] State syncs correctly on fresh connection
- [ ] State syncs correctly on reconnect
- [ ] State persists to Firebase at `competitions/{compId}/obs/state/`
- [ ] Multiple clients receive synchronized state
- [ ] Console shows no "unhandled event" warnings
- [ ] Legacy `showState.obsCurrentScene` stays in sync
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

1. Scene changes work end-to-end (OBS → backend → all frontends)
2. No duplicate handlers or events
3. State persists to Firebase at new path
4. QuickActions, ProducerView, ConnectionStatus still work
5. No console errors
6. Tests pass
7. Code reviewed and merged
