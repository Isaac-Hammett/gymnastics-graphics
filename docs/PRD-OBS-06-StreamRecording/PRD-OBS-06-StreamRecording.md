# PRD-OBS-06: Stream & Recording Control

**Version:** 1.1
**Date:** 2026-01-20
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** None

---

## Overview

Stream configuration and control - set destination, stream key, start/stop streaming, recording control. **This feature is working** but needs verification.

> **Architecture Note:** See [README-OBS-Architecture.md](README-OBS-Architecture.md) for the full connection architecture. The frontend NEVER connects directly to OBS or competition VMs. All commands flow through the coordinator.

---

## Current State

### What Exists
- `server/lib/obsStreamManager.js` (313 lines) - Stream control
- `show-controller/src/components/obs/StreamConfig.jsx` - Stream UI
- Routes: GET/PUT/POST `/api/obs/stream/*` and `/api/obs/recording/*`

### Test Results
- Stream start/stop: ✅ Working
- Recording start/stop: ✅ Working
- Stream settings: ⚠️ Needs verification

---

## Requirements

### 1. Stream Configuration

**Stream destinations:**
- YouTube RTMP/RTMPS
- Twitch RTMP
- Custom RTMP URL

**Settings:**
```json
{
  "serviceType": "rtmp_common",
  "service": "YouTube - RTMPS",
  "server": "rtmps://a.rtmps.youtube.com/live2",
  "streamKey": "****-****-****-****"
}
```

**Test Cases:**
- [ ] View current stream settings
- [ ] Update stream server
- [ ] Update stream key (securely stored)
- [ ] Settings persist to Firebase (key encrypted)

### 2. Stream Control

**Test Cases:**
- [ ] Start streaming → OBS starts output
- [ ] Stop streaming → OBS stops output
- [ ] Stream status shows in UI (LIVE indicator)
- [ ] Stream stats visible (bitrate, dropped frames)

### 3. Stream Statistics

Real-time stats during streaming:
- Uptime (timecode)
- Bitrate (kbps)
- Dropped frames
- Congestion indicator

### 4. Recording Control

**Test Cases:**
- [ ] Start recording → OBS starts recording
- [ ] Stop recording → file saved
- [ ] Pause/resume recording
- [ ] Recording status shows in UI
- [ ] Output path visible

### 5. Security: Stream Key Handling

Stream keys are sensitive and must not be exposed:
- Store encrypted in Firebase
- Never return in API responses (show `****`)
- Only send to OBS on apply

**Firebase Path:** `competitions/{compId}/obs/stream/`

---

## Connection Architecture

```
Frontend (Browser)
    │
    │ Socket.io (WSS to api.commentarygraphic.com)
    │ Events: obs:startStream, obs:stopStream, obs:startRecording, etc.
    ▼
Coordinator (44.193.31.120)
    │
    │ OBS WebSocket (ws://VM-IP:4455)
    │ OBS calls: StartStream, StopStream, StartRecord, etc.
    ▼
Competition VM (OBS Studio)
```

**Important:** The frontend emits Socket.io events to the coordinator. The coordinator then calls OBS WebSocket methods on the appropriate competition VM. The frontend does NOT make direct REST API calls to competition VMs.

---

## Files Involved

| File | Purpose |
|------|---------|
| `server/lib/obsStreamManager.js` | Stream/recording logic (local dev only) |
| `server/lib/obsConnectionManager.js` | Per-competition OBS connections (production) |
| `server/index.js` | Socket.io event handlers for stream/recording |
| `show-controller/src/components/obs/StreamConfig.jsx` | Stream UI |
| `show-controller/src/context/OBSContext.jsx` | Frontend state & event emitters |

---

## Socket.io Events

### Frontend → Coordinator

| Event | Payload | Purpose |
|-------|---------|---------|
| `obs:getStreamSettings` | `{}` | Request stream settings (key masked) |
| `obs:setStreamSettings` | `{server, key, ...}` | Update stream settings |
| `obs:startStream` | `{}` | Start streaming |
| `obs:stopStream` | `{}` | Stop streaming |
| `obs:getStreamStatus` | `{}` | Request stream stats |
| `obs:startRecording` | `{}` | Start recording |
| `obs:stopRecording` | `{}` | Stop recording |
| `obs:pauseRecording` | `{}` | Pause recording |
| `obs:resumeRecording` | `{}` | Resume recording |
| `obs:getRecordingStatus` | `{}` | Request recording status |

### Coordinator → Frontend

| Event | Payload | Purpose |
|-------|---------|---------|
| `obs:streamSettings` | `{server, key: "****", ...}` | Stream settings response |
| `obs:streamStatus` | `{active, timecode, kbps, ...}` | Stream status update |
| `obs:streamStarted` | `{}` | Stream started confirmation |
| `obs:streamStopped` | `{}` | Stream stopped confirmation |
| `obs:recordingStatus` | `{active, paused, path, ...}` | Recording status update |
| `obs:recordingStarted` | `{}` | Recording started confirmation |
| `obs:recordingStopped` | `{path}` | Recording stopped, includes file path |

### OBS WebSocket Calls (Coordinator → VM)

The coordinator translates Socket.io events to OBS WebSocket calls:

| Socket Event | OBS WebSocket Call |
|--------------|-------------------|
| `obs:startStream` | `StartStream` |
| `obs:stopStream` | `StopStream` |
| `obs:getStreamStatus` | `GetStreamStatus` |
| `obs:setStreamSettings` | `SetStreamServiceSettings` |
| `obs:startRecording` | `StartRecord` |
| `obs:stopRecording` | `StopRecord` |
| `obs:pauseRecording` | `PauseRecord` |
| `obs:resumeRecording` | `ResumeRecord` |
| `obs:getRecordingStatus` | `GetRecordStatus` |

---

## Legacy REST API Endpoints (Local Development Only)

These endpoints are used for local development when connecting directly to a local OBS instance. In production, use Socket.io events instead.

### Stream
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/stream/settings` | Get settings (key masked) |
| PUT | `/api/obs/stream/settings` | Update settings |
| POST | `/api/obs/stream/start` | Start streaming |
| POST | `/api/obs/stream/stop` | Stop streaming |
| GET | `/api/obs/stream/status` | Get stream stats |

### Recording
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/obs/recording/start` | Start recording |
| POST | `/api/obs/recording/stop` | Stop recording |
| POST | `/api/obs/recording/pause` | Pause recording |
| POST | `/api/obs/recording/resume` | Resume recording |
| GET | `/api/obs/recording/status` | Get recording status |

---

## UI Design

### StreamConfig.jsx

```
┌─ STREAM CONFIGURATION ───────────────────────────────┐
│                                                       │
│  Status: ● LIVE to YouTube                           │
│  Uptime: 01:23:45                                    │
│  Bitrate: 6.2 Mbps                                   │
│  Dropped: 0 frames                                   │
│                                                       │
│  ─── Destination ───────────────────────────────────  │
│                                                       │
│  Service: [YouTube - RTMPS ▼]                        │
│  Server: rtmps://a.rtmps.youtube.com/live2           │
│  Stream Key: [****-****-****-****] [Show] [Edit]     │
│                                                       │
│  [Apply Settings]                                     │
│                                                       │
│  ─── Controls ──────────────────────────────────────  │
│                                                       │
│  [Stop Stream]  [Start Recording]                    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Stream Status Response

```json
{
  "active": true,
  "reconnecting": false,
  "timecode": "01:23:45",
  "kbitsPerSec": 6200,
  "numTotalFrames": 267840,
  "numDroppedFrames": 0,
  "outputCongestion": 0.0
}
```

---

## Acceptance Criteria

- [ ] View stream settings (key masked)
- [ ] Update stream destination
- [ ] Update stream key (securely)
- [ ] Start streaming works
- [ ] Stop streaming works
- [ ] Stream stats display correctly
- [ ] Recording start/stop/pause works
- [ ] Stream key never exposed in API
- [ ] Settings persist to Firebase

---

## Multi-Competition Routing

The coordinator maintains separate OBS connections for each competition. When the frontend emits a stream/recording event:

1. **Frontend connects with compId:** `io('wss://api.commentarygraphic.com', { query: { compId: '8kyf0rnl' } })`
2. **Coordinator extracts compId** from the socket connection
3. **Coordinator looks up VM** for that competition via `obsConnectionManager.getConnection(compId)`
4. **Coordinator calls OBS** on the correct VM: `compObs.call('StartStream')`
5. **Response routed back** to only clients in that competition's room

This ensures:
- Competition A's stream controls don't affect Competition B
- Each competition can stream to different destinations
- Multiple operators can manage different competitions simultaneously

---

## Test Plan

### Manual Tests
1. Open OBS Manager → Stream tab
2. View current settings
3. Start stream → verify OBS streaming
4. Verify stats update in real-time
5. Stop stream → verify stopped
6. Start recording → verify file created

### Architecture Verification
1. Open browser DevTools → Network → WS tab
2. Verify Socket.io events go to `api.commentarygraphic.com` (NOT the VM IP)
3. Verify events include compId in the connection
4. Check coordinator logs: `pm2 logs coordinator` - should show stream commands being forwarded

### Security Test
1. Inspect network requests
2. Verify stream key not in any response
3. Verify Firebase stores encrypted key

---

## Definition of Done

1. Stream configuration works
2. Start/stop streaming works
3. Stream stats display correctly
4. Recording controls work
5. Stream key secured
6. Tests pass
7. Code reviewed and merged
