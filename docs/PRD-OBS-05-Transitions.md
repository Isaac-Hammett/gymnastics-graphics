# PRD-OBS-05: Transition Management

**Version:** 1.1
**Date:** 2026-01-20
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** None

---

## Architecture Context

> **IMPORTANT:** See [README-OBS-Architecture.md](README-OBS-Architecture.md) for full architecture details.

**Key architectural constraint:** The frontend NEVER connects directly to OBS or competition VMs.

```
Frontend → Coordinator (api.commentarygraphic.com) → Competition VM (OBS)
```

All transition management operations flow through the coordinator via Socket.io. The coordinator maintains OBS WebSocket connections to each competition VM and proxies commands/state.

---

## Overview

Transition management - list, select, configure duration, stinger setup. **UI is a placeholder** ("Transitions coming soon"). Backend routes exist but are untested.

---

## Current State

### What Exists
- `server/lib/obsTransitionManager.js` (172 lines) - Transition logic
- Routes in `server/routes/obs.js` - Transition endpoints
- **NO UI component** - Just placeholder text

### Test Results
- Tests: ⏭️ SKIPPED (placeholder tests only)

---

## Requirements

### 1. List Available Transitions

OBS default transitions:
- Cut (instant)
- Fade (configurable duration)
- Slide
- Swipe
- Stinger (custom video transition)

**Test Cases:**
- [ ] List transitions → shows all available
- [ ] Each transition shows configurable status

### 2. Set Current Transition

**Test Cases:**
- [ ] Select transition → OBS default changes
- [ ] Scene switch uses selected transition

### 3. Set Transition Duration

Duration in milliseconds (typically 300-1000ms).

**Test Cases:**
- [ ] Set duration to 500ms → OBS updates
- [ ] Duration persists across scene switches

### 4. Stinger Transition Configuration

Stinger transitions use a video file with a "transition point" - the frame where the new scene should appear.

**Settings:**
```json
{
  "path": "/var/www/assets/stingers/main.webm",
  "transition_point": 250,
  "monitoring_type": "OBS_MONITORING_TYPE_NONE",
  "audio_fade_style": "OBS_TRANSITION_AUDIO_FADE_OUT"
}
```

**Test Cases:**
- [ ] Set stinger path → OBS loads video
- [ ] Set transition point → scene appears at correct frame
- [ ] Stinger plays on scene switch

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `show-controller/src/components/obs/TransitionPicker.jsx` | **CREATE** |
| `show-controller/src/context/OBSContext.jsx` | Add transition methods |
| `server/index.js` | Add socket handlers for transition events |
| `server/lib/obsTransitionManager.js` | Verify/test (local dev only) |
| `server/routes/obs.js` | Verify transition endpoints (local dev only) |

---

## Socket Events (Production Architecture)

> **Note:** In production, the frontend communicates via Socket.io to the coordinator (`api.commentarygraphic.com`), which proxies to the competition VM's OBS. Direct REST API calls are only used in local development.

### Frontend → Coordinator Events

| Event | Payload | Purpose | Handler Location |
|-------|---------|---------|------------------|
| `obs:getTransitions` | `{}` | List available transitions | server/index.js |
| `obs:setCurrentTransition` | `{transitionName}` | Set default transition | server/index.js |
| `obs:setTransitionDuration` | `{transitionDuration}` | Set duration in ms | server/index.js |
| `obs:setTransitionSettings` | `{transitionName, transitionSettings}` | Update transition config | server/index.js |
| `obs:configureStinger` | `{path, transitionPoint, audioFadeStyle}` | Configure stinger | server/index.js |

### Coordinator → Frontend Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `obs:stateUpdated` | Full OBS state | Complete state refresh (includes transitions) |
| `obs:currentTransitionChanged` | `{transitionName, transitionDuration}` | Default transition changed |
| `obs:transitionDurationChanged` | `{transitionDuration}` | Duration changed |

### Event Flow Example

```
USER: Selects "Fade" transition in TransitionPicker.jsx
         │
         ▼
OBSContext.setCurrentTransition('Fade')
  socket.emit('obs:setCurrentTransition', {transitionName: 'Fade'})
         │
         ▼ (Socket.io over HTTPS to coordinator)
Coordinator (server/index.js)
  const compObs = obsConnManager.getConnection(clientCompId)
  await compObs.call('SetCurrentSceneTransition', {transitionName: 'Fade'})
         │
         ▼ (OBS WebSocket to VM)
VM OBS Instance updates transition
  OBS fires: CurrentSceneTransitionChanged event
         │
         ▼ (Back to coordinator)
obsConnectionManager event handler
  io.to('competition:compId').emit('obs:currentTransitionChanged', data)
         │
         ▼ (Socket.io back to all frontend clients)
OBSContext receives event, updates state
UI re-renders with selected transition
```

---

## REST API Endpoints (Local Development Only)

> **Warning:** These REST endpoints are only used in local development when `compId === 'local'`. In production, all communication goes through Socket.io to the coordinator.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/transitions` | List transitions |
| GET | `/api/obs/transitions/current` | Get current |
| PUT | `/api/obs/transitions/current` | Set current |
| PUT | `/api/obs/transitions/duration` | Set duration |
| GET | `/api/obs/transitions/:name/settings` | Get settings |
| PUT | `/api/obs/transitions/:name/settings` | Update settings |
| POST | `/api/obs/transitions/stinger` | Configure stinger |

---

## UI Design

### TransitionPicker.jsx

```
┌─ TRANSITIONS ────────────────────────────────────────┐
│                                                       │
│  Current Transition: [Fade ▼]                        │
│  Duration: [500] ms                                   │
│                                                       │
│  ─── Available Transitions ─────────────────────────  │
│                                                       │
│  ○ Cut          (instant)                            │
│  ● Fade         (configurable)      [500ms]          │
│  ○ Slide        (configurable)      [500ms]          │
│  ○ Stinger      (custom video)      [Configure]      │
│                                                       │
│  ─── Stinger Configuration ─────────────────────────  │
│                                                       │
│  Video: /var/www/assets/stingers/main.webm           │
│  Transition Point: [250] ms                           │
│                                                       │
│  [Upload New Stinger]                                 │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] TransitionPicker component created
- [ ] List all available transitions
- [ ] Select transition updates OBS default
- [ ] Duration slider/input works
- [ ] Stinger configuration works
- [ ] Changes sync to other clients

---

## Test Plan

### Manual Tests
1. Open OBS Manager → Transitions tab
2. Select different transition → verify in OBS
3. Change duration → verify in OBS
4. Switch scenes → verify transition plays

### Automated Tests
```javascript
test('can set transition to Fade', async () => {
  // Select Fade transition
  // Verify OBS default changed
});

test('can set transition duration', async () => {
  // Set duration to 750ms
  // Verify OBS duration changed
});
```

---

## Definition of Done

1. TransitionPicker component implemented
2. All transition operations work
3. Stinger configuration works
4. Multi-client sync works (via coordinator broadcast)
5. Tests pass
6. Code reviewed and merged
7. Coordinator deployed and verified

---

## Key Files Reference

### Coordinator (server/)

| File | Purpose |
|------|---------|
| `server/index.js` | Socket.io handlers for transition events |
| `server/lib/obsConnectionManager.js` | Per-competition OBS connections, event forwarding |
| `server/lib/obsTransitionManager.js` | Transition logic (local dev only) |

### Frontend (show-controller/src/)

| File | Purpose |
|------|---------|
| `context/OBSContext.jsx` | Transition management methods, emits socket events |
| `components/obs/TransitionPicker.jsx` | Transition selection UI (TO CREATE) |

---

## Debugging Steps

### Step 1: Check Coordinator Logs
```bash
# Via MCP tool
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 50"

# Look for:
# - [Socket] Received obs:setCurrentTransition from {socketId}
# - [OBSConnectionManager] Calling SetCurrentSceneTransition for {compId}
```

### Step 2: Verify Socket Events in Browser
1. Open Browser DevTools → Network → WS tab
2. Filter for Socket.io frames
3. Select transition in UI, verify `obs:setCurrentTransition` is emitted
4. Verify `obs:currentTransitionChanged` or `obs:stateUpdated` is received

### Step 3: Check OBS Connection State
```bash
# Check if coordinator is connected to competition VM's OBS
curl https://api.commentarygraphic.com/api/coordinator/status
```

---

## Common Mistakes to Avoid

1. **Don't call REST APIs directly from frontend in production** - Use Socket.io events through OBSContext
2. **Don't assume OBS runs on the coordinator** - Each competition VM has its own OBS instance
3. **Don't write OBS state to Firebase from frontend** - Only the coordinator writes OBS state
