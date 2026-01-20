# PRD-OBS-04: Audio Management

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

All audio management operations flow through the coordinator via Socket.io. The coordinator maintains OBS WebSocket connections to each competition VM and proxies commands/state.

---

## Overview

Audio source management - volume control, muting, monitor types, and audio presets. **This feature is working** but needs verification after state sync fixes.

---

## Current State

### What Exists
- `server/lib/obsAudioManager.js` (486 lines) - Audio management (used by local dev only)
- `show-controller/src/components/obs/AudioMixer.jsx` - Mixer UI
- `show-controller/src/components/obs/AudioPresetManager.jsx` - Preset management
- Socket.io events for audio operations (see Socket Events section below)

### Test Results
- Volume control: ✅ Working
- Mute toggle: ✅ Working
- Audio presets: ✅ Working

---

## Requirements

### 1. Audio Source Controls

Each audio source has:
- Volume (dB or linear 0-1)
- Mute state (boolean)
- Monitor type (None, Monitor Only, Monitor and Output)

**Test Cases:**
- [ ] Set volume via slider → OBS updates
- [ ] Set volume via dB input → OBS updates
- [ ] Mute/unmute → OBS updates
- [ ] Change monitor type → OBS updates

### 2. Audio Monitor Types

| Type | Description | Use Case |
|------|-------------|----------|
| `OBS_MONITORING_TYPE_NONE` | No monitoring | Default |
| `OBS_MONITORING_TYPE_MONITOR_ONLY` | Headphones only | Producer monitoring |
| `OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT` | Both | Test with output |

### 3. Audio Presets

Saved configurations for quick recall:

| Preset | Venue | Commentary | Music | Discord |
|--------|-------|------------|-------|---------|
| Commentary Focus | 25% | 100% | 0% | 100% |
| Venue Focus | 100% | 60% | 0% | 60% |
| Music Bed | 20% | 100% | 40% | 80% |
| All Muted | 0% | 0% | 0% | 0% |
| Break Music | 0% | 0% | 80% | 0% |

**Firebase Path:** `competitions/{compId}/obs/presets/`

**Test Cases:**
- [ ] Save current mix as preset → stored in Firebase
- [ ] Load preset → all levels applied to OBS
- [ ] Delete preset → removed from Firebase
- [ ] Presets persist across page refresh

### 4. Real-time Level Meters (Nice to Have)

Audio level visualization in mixer UI:
- VU meter for each audio source
- Updates in real-time via OBS WebSocket

**Note:** This may require additional OBS WebSocket subscriptions.

---

## Files Involved

### Coordinator (server/)

| File | Purpose |
|------|---------|
| `server/index.js` | Socket.io handlers for audio events |
| `server/lib/obsConnectionManager.js` | Per-competition OBS connections, event forwarding |
| `server/lib/obsAudioManager.js` | Audio logic (local dev only) |

### Frontend (show-controller/src/)

| File | Purpose |
|------|---------|
| `context/OBSContext.jsx` | Audio methods, emits socket events |
| `components/obs/AudioMixer.jsx` | Mixer UI |
| `components/obs/AudioPresetManager.jsx` | Presets |

---

## Socket Events (Production Architecture)

> **Note:** In production, the frontend communicates via Socket.io to the coordinator (`api.commentarygraphic.com`), which proxies to the competition VM's OBS. Direct REST API calls are only used in local development.

### Frontend → Coordinator Events

| Event | Payload | Purpose | Handler Location |
|-------|---------|---------|------------------|
| `obs:setVolume` | `{inputName, volumeDb}` or `{inputName, volumeMul}` | Set volume | server/index.js:2863 |
| `obs:setMute` | `{inputName, muted}` | Mute/unmute source | server/index.js:2893 |
| `obs:setMonitorType` | `{inputName, monitorType}` | Set monitor type | server/index.js |
| `obs:refreshState` | - | Request full state (includes audio) | server/index.js:3259 |

### Coordinator → Frontend Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `obs:stateUpdated` | Full OBS state | Complete state refresh (includes `audioSources`) |
| `obs:inputVolumeChanged` | `{inputName, volumeDb, volumeMul}` | Volume changed |
| `obs:inputMuteStateChanged` | `{inputName, muted}` | Mute state changed |

### Event Flow Example

```
USER: Moves volume slider in AudioMixer.jsx
         │
         ▼
OBSContext.setVolume('Commentary', -6.0)
  socket.emit('obs:setVolume', {inputName: 'Commentary', volumeDb: -6.0})
         │
         ▼ (Socket.io over HTTPS to coordinator)
Coordinator (server/index.js:2863)
  const compObs = obsConnManager.getConnection(clientCompId)
  await compObs.call('SetInputVolume', {inputName, inputVolumeDb})
         │
         ▼ (OBS WebSocket to VM)
VM OBS Instance updates volume
  OBS fires: InputVolumeChanged event
         │
         ▼ (Back to coordinator)
obsConnectionManager event handler
  io.to('competition:compId').emit('obs:inputVolumeChanged', data)
         │
         ▼ (Socket.io back to all frontend clients)
OBSContext receives event, updates state
UI re-renders with new volume level
```

---

## REST API Endpoints (Local Development Only)

> **Warning:** These REST endpoints are only used in local development when `compId === 'local'`. In production, all communication goes through Socket.io to the coordinator.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/audio` | List audio sources |
| GET | `/api/obs/audio/:inputName` | Get audio source |
| PUT | `/api/obs/audio/:inputName/volume` | Set volume |
| PUT | `/api/obs/audio/:inputName/mute` | Set mute |
| PUT | `/api/obs/audio/:inputName/monitor` | Set monitor type |
| GET | `/api/obs/audio/presets` | List presets |
| POST | `/api/obs/audio/presets` | Create preset |
| PUT | `/api/obs/audio/presets/:presetId` | Load preset |
| DELETE | `/api/obs/audio/presets/:presetId` | Delete preset |

---

## Audio Preset Schema

```json
{
  "id": "commentary-focus",
  "name": "Commentary Focus",
  "description": "Commentary at full, venue reduced",
  "levels": {
    "Venue Audio": {
      "volumeDb": -12.0,
      "volumeMul": 0.25,
      "muted": false
    },
    "Commentary": {
      "volumeDb": 0.0,
      "volumeMul": 1.0,
      "muted": false
    }
  },
  "createdAt": "2026-01-16T10:00:00Z",
  "createdBy": "producer@example.com"
}
```

---

## UI Requirements

### AudioMixer.jsx

```
┌─ AUDIO MIXER ────────────────────────────────────────┐
│                                                       │
│  Preset: [Commentary Focus ▼]  [Save] [Load]         │
│                                                       │
│  Venue Audio                                          │
│  ├─ Volume: [========●===============] -6.0 dB       │
│  ├─ Mute: [ ]  Monitor: [Monitor and Output ▼]       │
│  └─ Level: ████████░░░░░░░░░░░░░                     │
│                                                       │
│  Commentary                                           │
│  ├─ Volume: [========================●] 0.0 dB       │
│  ├─ Mute: [ ]  Monitor: [Monitor and Output ▼]       │
│  └─ Level: ██████████████░░░░░░░                     │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] Volume slider works (0-100% / -96dB to 0dB)
- [ ] Mute button works
- [ ] Monitor type dropdown works
- [ ] Save preset works
- [ ] Load preset applies all levels
- [ ] Delete preset works
- [ ] Presets persist in Firebase
- [ ] Changes sync to other clients

---

## Test Plan

### Manual Tests
1. Open OBS Manager → Audio tab
2. Move volume slider → verify OBS audio changes
3. Click mute → verify source muted in OBS
4. Change monitor type → verify in OBS
5. Save preset → verify in Firebase console
6. Load preset → verify levels change

### Automated Tests
```bash
npm test -- --grep "Audio"
```

---

## Debugging Steps

### Step 1: Check Coordinator Logs
```bash
# Via MCP tool
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 50"

# Look for:
# - [Socket] Received obs:setVolume from {socketId}
# - [OBSConnectionManager] Calling SetInputVolume for {compId}
```

### Step 2: Verify Socket Events in Browser
1. Open Browser DevTools → Network → WS tab
2. Filter for Socket.io frames
3. Move volume slider in UI, verify `obs:setVolume` is emitted
4. Verify `obs:inputVolumeChanged` or `obs:stateUpdated` is received

### Step 3: Check OBS Connection State
```bash
# Check if coordinator is connected to competition VM's OBS
curl https://api.commentarygraphic.com/api/coordinator/status
```

### Step 4: Check Audio Sources in State
Audio sources are included in the `obs:stateUpdated` payload under `audioSources`. Verify this array is populated.

---

## Definition of Done

1. All audio controls work
2. Presets save/load correctly
3. Firebase persistence works
4. Multi-client sync works (via coordinator broadcast)
5. Tests pass
6. Code reviewed and merged
7. Coordinator deployed and verified

---

## Common Mistakes to Avoid

1. **Don't call REST APIs directly from frontend in production** - Use Socket.io events through OBSContext
2. **Don't assume OBS runs on the coordinator** - Each competition VM has its own OBS instance
3. **Don't write OBS state to Firebase from frontend** - Only the coordinator writes OBS state
