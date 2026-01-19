# PRD-OBS-06: Stream & Recording Control

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** None

---

## Overview

Stream configuration and control - set destination, stream key, start/stop streaming, recording control. **This feature is working** but needs verification.

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

## Files Involved

| File | Purpose |
|------|---------|
| `server/lib/obsStreamManager.js` | Stream/recording logic |
| `server/routes/obs.js` | Stream endpoints |
| `show-controller/src/components/obs/StreamConfig.jsx` | Stream UI |

---

## API Endpoints

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

## Test Plan

### Manual Tests
1. Open OBS Manager → Stream tab
2. View current settings
3. Start stream → verify OBS streaming
4. Verify stats update in real-time
5. Stop stream → verify stopped
6. Start recording → verify file created

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
