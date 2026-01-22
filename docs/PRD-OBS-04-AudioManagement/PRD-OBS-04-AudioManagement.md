# PRD-OBS-04: Audio Management

**Version:** 2.0
**Date:** 2026-01-21
**Status:** Phase 1 Complete, Phase 2 Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** AI Auto-Mixing features

---

## Architecture Context

> **IMPORTANT:** See [README-OBS-Architecture.md](../README-OBS-Architecture.md) for full architecture details.

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

### 4. Real-time Audio Level Monitoring (Phase 2 - Required)

**Priority:** High - Required for AI-powered auto-mixing

Real-time audio level data enables:
- Live VU meters in the Audio Mixer UI
- AI-powered automatic audio mixing (duck music when talent speaks, balance levels)
- Audio level history for analysis and debugging
- Alerts when audio is clipping or silent

#### 4.1 OBS InputVolumeMeters Event

OBS WebSocket provides real-time audio levels via the `InputVolumeMeters` event when subscribed.

**Subscription:** Must call `SetInputAudioMonitorType` or subscribe to `InputVolumeMeters` high-volume event.

**Event Data Format:**
```json
{
  "inputs": [
    {
      "inputName": "Talent-1",
      "inputLevelsMul": [
        [0.15, 0.12, 0.08],  // Left channel: peak, avg, input peak
        [0.14, 0.11, 0.07]   // Right channel: peak, avg, input peak
      ]
    },
    {
      "inputName": "Music",
      "inputLevelsMul": [
        [0.25, 0.20, 0.15],
        [0.24, 0.19, 0.14]
      ]
    }
  ]
}
```

**Level Values:**
- Values are linear multipliers (0.0 to 1.0)
- Convert to dB: `dB = 20 * log10(mul)` (e.g., 0.5 = -6dB, 0.1 = -20dB)
- Three values per channel: instantaneous peak, RMS average, input peak (before gain)

#### 4.2 Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Competition VM (OBS)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  OBS Studio                                               │   │
│  │  - InputVolumeMeters event (~60fps)                       │   │
│  │  - Streams levels for all audio-capable sources           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ OBS WebSocket (ws://localhost:4455)
                              │ High-frequency events (~60fps)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Coordinator Server                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  obsConnectionManager.js                                  │   │
│  │  - Subscribe to InputVolumeMeters per competition         │   │
│  │  - Throttle to ~10-15fps to reduce bandwidth              │   │
│  │  - Forward to competition room via Socket.io              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Socket.io (WSS)
                              │ Throttled audio levels (~10-15fps)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  OBSContext.jsx                                           │   │
│  │  - Receive obs:audioLevels event                          │   │
│  │  - Update audioLevels state (Map<inputName, levels>)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AudioMixer.jsx                                           │   │
│  │  - Render animated VU meters using requestAnimationFrame  │   │
│  │  - Smooth meter decay for visual appeal                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  (Future) AI Audio Mixer                                  │   │
│  │  - Analyze levels in real-time                            │   │
│  │  - Auto-duck music when talent speaks                     │   │
│  │  - Balance multiple talent mics                           │   │
│  │  - Alert on clipping/silence                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3 Socket Events for Audio Levels

**New Events:**

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `obs:subscribeAudioLevels` | Frontend → Coordinator | `{enabled: boolean}` | Start/stop level streaming |
| `obs:audioLevels` | Coordinator → Frontend | `{inputs: [...]}` | Real-time level data |

**obs:audioLevels Payload:**
```json
{
  "timestamp": 1706000000000,
  "inputs": [
    {
      "inputName": "Talent-1",
      "levelDb": -12.5,        // Peak level in dB (for display)
      "levelMul": 0.237,       // Peak level as multiplier
      "channels": [
        {"peak": 0.24, "rms": 0.18},  // Left
        {"peak": 0.23, "rms": 0.17}   // Right (or mono)
      ]
    }
  ]
}
```

#### 4.4 Coordinator Implementation

**IMPORTANT:** `InputVolumeMeters` is a high-volume event that requires explicit subscription during OBS connection. The default `EventSubscription.All` does NOT include it.

```javascript
// In obsConnectionManager.js - MODIFY connectToVM() method

import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';

// When connecting, request InputVolumeMeters high-volume event:
await obs.connect(obsUrl, this.OBS_PASSWORD || undefined, {
  eventSubscriptions: EventSubscription.All | EventSubscription.InputVolumeMeters,
  rpcVersion: 1
});
```

```javascript
// In obsConnectionManager.js - ADD new method

// Track which competitions have audio level subscriptions
this.audioLevelSubscriptions = new Map(); // compId -> Set<socketId>

// Subscribe to audio levels for a competition
subscribeAudioLevels(compId, socketId) {
  if (!this.audioLevelSubscriptions.has(compId)) {
    this.audioLevelSubscriptions.set(compId, new Set());
  }
  this.audioLevelSubscriptions.get(compId).add(socketId);

  // Start forwarding if this is the first subscriber
  if (this.audioLevelSubscriptions.get(compId).size === 1) {
    this._startAudioLevelForwarding(compId);
  }
}

unsubscribeAudioLevels(compId, socketId) {
  const subs = this.audioLevelSubscriptions.get(compId);
  if (subs) {
    subs.delete(socketId);
    if (subs.size === 0) {
      this._stopAudioLevelForwarding(compId);
    }
  }
}

_startAudioLevelForwarding(compId) {
  const connection = this.connections.get(compId);
  if (!connection) return;

  // OBS sends InputVolumeMeters at ~60fps - throttle to reduce bandwidth
  let lastEmit = 0;
  const THROTTLE_MS = 66; // ~15fps

  const handler = (data) => {
    const now = Date.now();
    if (now - lastEmit < THROTTLE_MS) return;
    lastEmit = now;

    // Transform and emit to competition room
    const levels = {
      timestamp: now,
      inputs: data.inputs.map(input => ({
        inputName: input.inputName,
        levelMul: Math.max(...input.inputLevelsMul.flat()),
        levelDb: 20 * Math.log10(Math.max(...input.inputLevelsMul.flat()) || 0.0001),
        channels: input.inputLevelsMul.map(ch => ({
          peak: ch[0],
          rms: ch[1]
        }))
      }))
    };

    // Emit via callback (io passed during init)
    this.emit('audioLevels', { compId, levels });
  };

  connection.on('InputVolumeMeters', handler);
  this.audioLevelHandlers = this.audioLevelHandlers || new Map();
  this.audioLevelHandlers.set(compId, handler);
}

_stopAudioLevelForwarding(compId) {
  const connection = this.connections.get(compId);
  const handler = this.audioLevelHandlers?.get(compId);
  if (connection && handler) {
    connection.off('InputVolumeMeters', handler);
    this.audioLevelHandlers.delete(compId);
  }
}
```

```javascript
// In server/index.js - Socket handler for subscription

socket.on('obs:subscribeAudioLevels', ({ enabled }) => {
  const client = showState.connectedClients.find(c => c.id === socket.id);
  const compId = client?.compId;
  if (!compId) return;

  const obsConnManager = getOBSConnectionManager();
  if (enabled) {
    obsConnManager.subscribeAudioLevels(compId, socket.id);
  } else {
    obsConnManager.unsubscribeAudioLevels(compId, socket.id);
  }
});

// In initializeOBSConnectionManager() - forward audio levels
obsConnManager.on('audioLevels', ({ compId, levels }) => {
  io.to(`competition:${compId}`).emit('obs:audioLevels', levels);
});
```

#### 4.5 Frontend Implementation

```javascript
// In OBSContext.jsx

const [audioLevels, setAudioLevels] = useState(new Map());

useEffect(() => {
  socket.on('obs:audioLevels', (data) => {
    setAudioLevels(new Map(
      data.inputs.map(input => [input.inputName, input])
    ));
  });

  // Subscribe to audio levels when component mounts
  socket.emit('obs:subscribeAudioLevels', { enabled: true });

  return () => {
    socket.emit('obs:subscribeAudioLevels', { enabled: false });
  };
}, [socket]);
```

```javascript
// In AudioMixer.jsx - VU Meter component

function VUMeter({ levelDb, peak }) {
  // Convert dB to percentage (0dB = 100%, -60dB = 0%)
  const percent = Math.max(0, Math.min(100, ((levelDb + 60) / 60) * 100));

  // Color based on level
  const getColor = () => {
    if (levelDb >= -6) return 'bg-red-500';      // Clipping danger
    if (levelDb >= -12) return 'bg-yellow-500';  // Hot
    return 'bg-green-500';                        // Normal
  };

  return (
    <div className="h-2 bg-gray-700 rounded overflow-hidden">
      <div
        className={`h-full ${getColor()} transition-all duration-75`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
```

#### 4.6 Built-in Audio Alerts (No AI Required)

Simple threshold-based alerts that run in the frontend using real-time level data:

**Alert Types:**

| Alert | Trigger | Visual | Purpose |
|-------|---------|--------|---------|
| **Silence** | Source below -50dB for 10+ seconds | Yellow warning icon | Talent mic off, feed dropped |
| **Clipping** | Source above -3dB for 500ms+ | Red flashing indicator | Audio distortion risk |
| **Signal Lost** | Source was active, now silent for 5+ sec | Red "NO SIGNAL" badge | VDO.Ninja disconnect, camera feed lost |
| **Low Level** | Source averaging below -40dB when expected active | Orange indicator | Talent too quiet, gain needed |
| **Unstable/Cutting Out** | Audio drops below -50dB then returns 3+ times in 30 sec | Orange flashing "UNSTABLE" | Bad connection, packet loss, VDO.Ninja issues |

**Implementation:**

```javascript
// In AudioMixer.jsx or dedicated AudioAlerts.jsx

function useAudioAlerts(audioLevels) {
  const [alerts, setAlerts] = useState(new Map());
  const levelHistory = useRef(new Map()); // Track recent levels per source

  useEffect(() => {
    const newAlerts = new Map();

    audioLevels.forEach((level, inputName) => {
      const history = levelHistory.current.get(inputName) || [];
      history.push({ levelDb: level.levelDb, timestamp: Date.now() });

      // Keep last 15 seconds of history
      const cutoff = Date.now() - 15000;
      const recentHistory = history.filter(h => h.timestamp > cutoff);
      levelHistory.current.set(inputName, recentHistory);

      // Check for silence (below -50dB for 10+ seconds)
      const silentDuration = recentHistory.every(h => h.levelDb < -50)
        ? (Date.now() - recentHistory[0]?.timestamp || 0)
        : 0;
      if (silentDuration > 10000) {
        newAlerts.set(inputName, { type: 'silence', duration: silentDuration });
      }

      // Check for clipping (above -3dB)
      const clippingCount = recentHistory.filter(h => h.levelDb > -3).length;
      if (clippingCount > 7) { // ~500ms at 15fps
        newAlerts.set(inputName, { type: 'clipping' });
      }

      // Check for signal lost (was active, now silent)
      const wasActive = recentHistory.slice(0, -75).some(h => h.levelDb > -30); // Was active 5+ sec ago
      const nowSilent = recentHistory.slice(-75).every(h => h.levelDb < -50);   // Silent last 5 sec
      if (wasActive && nowSilent) {
        newAlerts.set(inputName, { type: 'signal_lost' });
      }

      // Check for unstable/cutting out (audio drops and returns repeatedly)
      // Count transitions from active (>-30dB) to silent (<-50dB) in last 30 seconds
      let dropCount = 0;
      let wasAboveThreshold = false;
      for (const h of recentHistory) {
        const isAbove = h.levelDb > -30;
        const isBelow = h.levelDb < -50;
        if (wasAboveThreshold && isBelow) {
          dropCount++;
        }
        if (isAbove) wasAboveThreshold = true;
        if (isBelow) wasAboveThreshold = false;
      }
      if (dropCount >= 3) {
        newAlerts.set(inputName, { type: 'unstable', dropCount });
      }
    });

    setAlerts(newAlerts);
  }, [audioLevels]);

  return alerts;
}
```

**Alert UI Component:**

```jsx
function AudioAlert({ alert, inputName }) {
  if (!alert) return null;

  const alertStyles = {
    silence: { bg: 'bg-yellow-500', icon: '⚠️', text: 'Silent' },
    clipping: { bg: 'bg-red-500 animate-pulse', icon: '🔴', text: 'CLIPPING' },
    signal_lost: { bg: 'bg-red-600', icon: '❌', text: 'NO SIGNAL' },
    low_level: { bg: 'bg-orange-500', icon: '🔉', text: 'Low' },
    unstable: { bg: 'bg-orange-500 animate-pulse', icon: '📶', text: 'UNSTABLE' }
  };

  const style = alertStyles[alert.type];

  return (
    <span className={`${style.bg} text-white text-xs px-2 py-1 rounded font-bold`}>
      {style.icon} {style.text}
    </span>
  );
}
```

**Alert Configuration (per source, stored in Firebase):**

```json
{
  "alertConfig": {
    "Talent-1": {
      "silenceThresholdDb": -50,
      "silenceTimeoutMs": 10000,
      "enabled": true
    },
    "Music": {
      "enabled": false  // Don't alert on music silence
    }
  }
}
```

**Test Cases for Alerts:**
- [ ] Silence alert appears when talent stops talking for 10+ seconds
- [ ] Silence alert clears when audio resumes
- [ ] Clipping alert flashes when audio peaks above -3dB
- [ ] Signal lost alert appears when active source goes completely silent
- [ ] **Unstable alert** appears when audio cuts in/out 3+ times in 30 seconds
- [ ] Unstable alert clears when connection stabilizes
- [ ] Alerts can be disabled per-source
- [ ] Alert thresholds are configurable

---

#### 4.8 AI Auto-Mixing (Phase 3 - Future Enhancement)

With real-time audio levels, an AI auto-mixer can:

1. **Voice Activity Detection (VAD)**
   - Detect when talent is speaking vs silence
   - Trigger automatic level adjustments

2. **Music Ducking**
   - When talent speaks, automatically reduce music level
   - Configurable duck amount and attack/release times

3. **Multi-Talent Balancing**
   - Balance levels between multiple talent mics
   - Ensure one talent doesn't overpower another

4. **Silence/Clipping Alerts**
   - Alert when a source is silent for too long
   - Alert when levels are clipping (>-3dB sustained)

**Example AI Rules:**
```json
{
  "rules": [
    {
      "name": "Duck music for talent",
      "trigger": {
        "source": "Talent-1",
        "condition": "level > -30dB for 200ms"
      },
      "action": {
        "target": "Music",
        "setVolume": "-18dB",
        "fadeTime": "300ms"
      },
      "release": {
        "condition": "level < -40dB for 1000ms",
        "restoreVolume": true,
        "fadeTime": "500ms"
      }
    }
  ]
}
```

#### 4.9 Test Cases

- [ ] Subscribe to audio levels → coordinator starts streaming
- [ ] Unsubscribe → coordinator stops streaming
- [ ] VU meters animate in real-time when audio plays
- [ ] Meter colors change based on level (green/yellow/red)
- [ ] Multiple clients receive same level data
- [ ] Performance: UI stays smooth at 15fps updates
- [ ] Bandwidth: Level data doesn't overwhelm connection

#### 4.10 Performance Considerations

| Concern | Mitigation |
|---------|------------|
| High event frequency (60fps from OBS) | Throttle to 10-15fps on coordinator |
| Bandwidth per client | Only send peak/RMS, not full waveform |
| Frontend rendering | Use requestAnimationFrame, CSS transitions |
| Multiple competitions | Only stream levels when clients subscribed |
| Memory | Don't store level history (unless needed for AI) |

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
| `obs:setVolume` | `{inputName, volumeDb}` or `{inputName, volumeMul}` | Set volume | server/index.js:3594 |
| `obs:setMute` | `{inputName, muted}` | Mute/unmute source | server/index.js:3637 |
| `obs:setMonitorType` | `{inputName, monitorType}` | Set monitor type | server/index.js:3669 |
| `obs:refreshState` | - | Request full state (includes audio) | server/index.js:4339 |

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
Coordinator (server/index.js:3594)
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

### Phase 1 (Current - Complete)
- [x] Volume slider works (0-100% / -96dB to 0dB)
- [x] Mute button works
- [x] Monitor type dropdown works
- [x] Save preset works
- [x] Load preset applies all levels
- [x] Delete preset works
- [x] Presets persist in Firebase
- [x] Changes sync to other clients
- [x] Audio sources include ffmpeg_source and browser_source types

### Phase 2 (Real-time Audio Levels & Alerts)
- [ ] **Modify obsConnectionManager.connectToVM()** to include `EventSubscription.InputVolumeMeters` in connection options
- [ ] Coordinator subscribes to OBS InputVolumeMeters event
- [ ] Levels throttled to 10-15fps before forwarding to clients
- [ ] Frontend receives obs:audioLevels events
- [ ] VU meters animate in real-time in AudioMixer UI
- [ ] Meter colors indicate level (green < -12dB, yellow < -6dB, red >= -6dB)
- [ ] Subscribe/unsubscribe mechanism to control bandwidth
- [ ] Performance: UI renders smoothly without jank
- [ ] **Silence alert** when source below -50dB for 10+ seconds
- [ ] **Clipping alert** when source above -3dB sustained
- [ ] **Signal lost alert** when active source goes silent
- [ ] **Unstable alert** when audio cuts in/out 3+ times in 30 seconds
- [ ] Alerts display as badges/icons next to source name
- [ ] Alerts can be enabled/disabled per source

### Phase 3 (AI Auto-Mixing - Future)
- [ ] Voice activity detection for talent sources
- [ ] Automatic music ducking when talent speaks
- [ ] Configurable ducking rules (amount, attack, release)
- [ ] Multi-talent level balancing

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
