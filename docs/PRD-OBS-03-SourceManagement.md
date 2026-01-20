# PRD-OBS-03: Source Management

**Version:** 1.1
**Date:** 2026-01-20
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01, PRD-OBS-02
**Blocks:** PRD-OBS-08 (Templates)

---

## Architecture Context

> **IMPORTANT:** See [README-OBS-Architecture.md](README-OBS-Architecture.md) for full architecture details.

**Key architectural constraints:**

1. **Frontend NEVER talks directly to OBS** - All commands go through the coordinator
2. **The Coordinator is the Hub** - Manages all OBS WebSocket connections
3. **OBS WebSocket (4455) is Internal Only** - Not exposed publicly, only accessible from within the VM
4. **Each Competition is Isolated** - Separate OBS instances on dedicated VMs

```
Frontend → Coordinator (api.commentarygraphic.com) → Competition VM (OBS)
Frontend ← Coordinator ← Competition VM (broadcasts state changes)
```

All source management operations flow through the coordinator via Socket.io. The coordinator maintains OBS WebSocket connections to each competition VM and proxies commands/state.

**Firebase Path for Source Settings:** `competitions/{compId}/obs/inputs/`

---

## Overview

Source/input management within scenes - add, remove, transform, edit settings. **This feature is BROKEN** (TEST-35/36 failed). Needs debugging and fixing.

---

## Current State

### What Exists
- `server/lib/obsSourceManager.js` (596 lines) - Source CRUD (used by local dev only)
- `show-controller/src/components/obs/SourceEditor.jsx` - Source settings UI
- `show-controller/src/components/obs/SceneEditor.jsx` - Scene item management
- Socket.io events for source operations (see Socket Events section below)

### Known Failures
- **TEST-35**: Browser source editing - FAILED
- **TEST-36**: SRT/Media source editing - FAILED

### Suspected Issues
1. SourceEditor component may not properly call socket/API on save
2. Socket handlers for source updates may be missing
3. Transform updates may not persist correctly

---

## Requirements

### 1. Fix Source Settings Editing

**Browser Source Settings:**
```json
{
  "url": "http://localhost:5173/graphics",
  "width": 1920,
  "height": 1080,
  "css": "",
  "shutdown": false,
  "restart_when_active": false
}
```

**SRT/Media Source Settings:**
```json
{
  "input": "srt://nimble.local:10001",
  "buffering_mb": 2,
  "reconnect_delay_sec": 5,
  "hw_decode": true,
  "is_local_file": false
}
```

**Test Cases:**
- [ ] Edit browser source URL → OBS updates
- [ ] Edit browser source dimensions → OBS updates
- [ ] Edit SRT source URL → OBS updates
- [ ] Edit SRT buffering settings → OBS updates

### 2. Fix Scene Item Transform

Transform properties:
- Position (X, Y)
- Scale (X, Y)
- Rotation
- Crop (Top, Bottom, Left, Right)
- Visibility
- Lock state

**Test Cases:**
- [ ] Move source position → OBS updates
- [ ] Scale source → OBS updates
- [ ] Crop source → OBS updates
- [ ] Toggle visibility → source shows/hides
- [ ] Toggle lock → transform locked/unlocked

### 3. Transform Presets

Quick-apply presets for common layouts:

| Preset | Position | Scale | Use Case |
|--------|----------|-------|----------|
| `fullscreen` | 0, 0 | 1.0, 1.0 | Full canvas |
| `dual16x9Left` | 0, 270 | 0.5, 0.5 | Left side-by-side |
| `dual16x9Right` | 960, 270 | 0.5, 0.5 | Right side-by-side |
| `quadTopLeft` | 0, 0 | 0.5, 0.5 | Quad view |
| `pip` | 1440, 810 | 0.25, 0.25 | Picture-in-picture |

**Test Cases:**
- [ ] Apply fullscreen preset → source fills canvas
- [ ] Apply dual preset → source positioned correctly
- [ ] Apply pip preset → source in corner

### 4. Add/Remove Sources from Scene

**Test Cases:**
- [ ] Add existing source to scene → appears in scene
- [ ] Create new source and add → source created and added
- [ ] Remove source from scene → source removed (input still exists)
- [ ] Delete source entirely → removed from all scenes

### 5. Source Layer Ordering (Z-Index)

**Test Cases:**
- [ ] Reorder source up → moves in front
- [ ] Reorder source down → moves behind
- [ ] Drag-to-reorder in UI → updates correctly

---

## Files to Debug/Fix

| File | Suspected Issue |
|------|-----------------|
| `show-controller/src/components/obs/SourceEditor.jsx` | Not calling API/socket on save |
| `server/routes/obs.js` | Check PUT `/api/obs/inputs/:inputName` |
| `server/lib/obsSourceManager.js` | Verify `updateInputSettings()` |
| `server/index.js` | Check socket handlers for source events |

---

## Socket Events (Production Architecture)

> **Note:** In production, the frontend communicates via Socket.io to the coordinator (`api.commentarygraphic.com`), which proxies to the competition VM's OBS. Direct REST API calls are only used in local development.

### Frontend → Coordinator Events

| Event | Payload | Purpose | Handler Location |
|-------|---------|---------|------------------|
| `obs:updateInputSettings` | `{inputName, inputSettings}` | **FIX: Update source settings** | server/index.js |
| `obs:createInput` | `{inputName, inputKind, sceneName, inputSettings}` | Create new input | server/index.js |
| `obs:removeInput` | `{inputName}` | Delete input entirely | server/index.js |
| `obs:setSceneItemTransform` | `{sceneName, sceneItemId, transform}` | **FIX: Update transform** | server/index.js |
| `obs:toggleItemVisibility` | `{sceneName, sceneItemId, enabled}` | Toggle visibility | server/index.js:2767 |
| `obs:addSourceToScene` | `{sceneName, sourceName}` | Add existing source to scene | server/index.js |
| `obs:removeSceneItem` | `{sceneName, sceneItemId}` | Remove source from scene | server/index.js |
| `obs:setSceneItemIndex` | `{sceneName, sceneItemId, sceneItemIndex}` | Reorder layers | server/index.js |

### Coordinator → Frontend Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `obs:stateUpdated` | Full OBS state | Complete state refresh (includes inputs) |
| `obs:inputSettingsChanged` | `{inputName, inputSettings}` | Source settings changed |
| `obs:sceneItemTransformChanged` | `{sceneName, sceneItemId, transform}` | Transform changed |
| `obs:sceneItemEnableStateChanged` | `{sceneName, sceneItemId, enabled}` | Visibility changed |

### Event Flow Example

```
USER: Edits browser source URL in SourceEditor.jsx
         │
         ▼
OBSContext.updateInputSettings('GraphicsOverlay', {url: '...'})
  socket.emit('obs:updateInputSettings', {inputName, inputSettings})
         │
         ▼ (Socket.io over HTTPS to coordinator)
Coordinator (server/index.js)
  const compObs = obsConnManager.getConnection(clientCompId)
  await compObs.call('SetInputSettings', {inputName, inputSettings})
         │
         ▼ (OBS WebSocket to VM)
VM OBS Instance updates input
  OBS fires: InputSettingsChanged event
         │
         ▼ (Back to coordinator)
obsConnectionManager event handler
  io.to('competition:compId').emit('obs:inputSettingsChanged', data)
         │
         ▼ (Socket.io back to all frontend clients)
OBSContext receives event, updates state
UI re-renders with new settings
```

---

## REST API Endpoints (Local Development Only)

> **Warning:** These REST endpoints are only used in local development when `compId === 'local'`. In production, all communication goes through Socket.io to the coordinator.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/inputs` | List all inputs |
| GET | `/api/obs/inputs/kinds` | List input types |
| POST | `/api/obs/inputs` | Create input |
| GET | `/api/obs/inputs/:inputName` | Get input settings |
| PUT | `/api/obs/inputs/:inputName` | Update settings |
| DELETE | `/api/obs/inputs/:inputName` | Delete input |
| POST | `/api/obs/scenes/:name/items` | Add source to scene |
| DELETE | `/api/obs/scenes/:name/items/:id` | Remove from scene |
| PUT | `/api/obs/scenes/:name/items/:id/transform` | Update transform |
| PUT | `/api/obs/scenes/:name/items/:id/enabled` | Toggle visibility |

---

## Debugging Steps

### Step 1: Check Coordinator Logs
```bash
# Via MCP tool
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 50"

# Look for:
# - [Socket] Received obs:updateInputSettings from {socketId}
# - [OBSConnectionManager] Calling SetInputSettings for {compId}
```

### Step 2: Verify Socket Events in Browser
1. Open Browser DevTools → Network → WS tab
2. Filter for Socket.io frames
3. Edit source in UI, verify `obs:updateInputSettings` is emitted
4. Verify `obs:inputSettingsChanged` or `obs:stateUpdated` is received

### Step 3: Check OBS Connection State
```bash
# Check if coordinator is connected to competition VM's OBS
curl https://api.commentarygraphic.com/api/coordinator/status
```

### Step 4: Check Handler Exists
Look for handler in `server/index.js`:
```javascript
socket.on('obs:updateInputSettings', async (data) => {
  // Should call obsConnManager.getConnection(compId)
  // Then call compObs.call('SetInputSettings', ...)
})
```

### Step 5: Check Frontend Calls
In SourceEditor.jsx, verify `onSave` emits the socket event:
```javascript
// Should call something like:
obsContext.updateInputSettings(inputName, newSettings)
// Which should emit: socket.emit('obs:updateInputSettings', {...})
```

### Local Development Testing (compId='local')
```bash
# Only works in local dev, not production
curl -X PUT http://localhost:3000/api/obs/inputs/GraphicsOverlay \
  -H "Content-Type: application/json" \
  -d '{"inputSettings": {"url": "http://localhost:5173/test"}}'
```

---

## Acceptance Criteria

- [ ] Browser source URL can be edited
- [ ] SRT source URL can be edited
- [ ] Source position/scale can be changed
- [ ] Transform presets work
- [ ] Add/remove sources from scenes works
- [ ] Layer reordering works
- [ ] All changes sync to other clients

---

## Test Plan

### Playwright Tests to Fix
```javascript
// TEST-35: Browser source editing
test('can edit browser source URL', async () => {
  // Navigate to scene with browser source
  // Open source editor
  // Change URL
  // Save
  // Verify OBS received update
});

// TEST-36: SRT source editing
test('can edit SRT source URL', async () => {
  // Similar to above
});
```

### Manual Verification
1. Open OBS Manager → click scene → click source
2. Edit source URL → save
3. Check OBS directly to verify change applied

---

## Definition of Done

1. TEST-35 passes (browser source editing)
2. TEST-36 passes (SRT source editing)
3. Transform editing works
4. Add/remove sources works
5. Multi-client sync works (via coordinator broadcast)
6. Code reviewed and merged
7. Coordinator deployed and verified

---

## Deploying Changes

When source management code is fixed, deploy to the coordinator:

```bash
# Via MCP tool (ssh_exec)
ssh_exec target="coordinator" command="cd /opt/gymnastics-graphics && sudo git pull --rebase origin dev && pm2 restart coordinator"
```

**Files that require coordinator deployment:**
- `server/index.js` (Socket.io handlers for source events)
- `server/lib/obsConnectionManager.js` (OBS connection management)
- `server/lib/obsSourceManager.js` (source CRUD - local dev)

**Verify deployment:**
```bash
# Check coordinator is running
ssh_exec target="coordinator" command="pm2 list"

# Check recent logs for source events
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 30 | grep -i 'source\|input'"
```

---

## Key Files Reference

### Coordinator (server/)

| File | Purpose |
|------|---------|
| `server/index.js` | Socket.io handlers for source events |
| `server/lib/obsConnectionManager.js` | Per-competition OBS connections, event forwarding |
| `server/lib/obsSourceManager.js` | Source CRUD (local dev only) |

### Frontend (show-controller/src/)

| File | Purpose |
|------|---------|
| `context/OBSContext.jsx` | Source management methods, emits socket events |
| `components/obs/SourceEditor.jsx` | Source settings UI |
| `components/obs/SceneEditor.jsx` | Scene item management UI |

---

## Common Mistakes to Avoid

1. **Don't call REST APIs directly from frontend in production** - Use Socket.io events through OBSContext
2. **Don't assume OBS runs on the coordinator** - Each competition VM has its own OBS instance
3. **Don't write OBS state to Firebase from frontend** - Only the coordinator writes OBS state
4. **Don't connect directly to VM IP addresses** - In production, always go through `api.commentarygraphic.com`
5. **Don't forget the compId query parameter** - The coordinator uses this to route to the correct VM

---

## Related Documents

- [README-OBS-Architecture.md](README-OBS-Architecture.md) - Full architecture reference
- [PRD-OBS-01-StateSync.md](PRD-OBS-01-StateSync.md) - State synchronization (dependency)
- [PRD-OBS-02-SceneManagement.md](PRD-OBS-02-SceneManagement.md) - Scene management (dependency)
- [PRD-OBS-06-StreamRecording.md](PRD-OBS-06-StreamRecording.md) - Similar control pattern for streaming
- [PRD-OBS-08-Templates.md](PRD-OBS-08-Templates.md) - Scene templates (blocked by this)
