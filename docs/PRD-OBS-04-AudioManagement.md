# PRD-OBS-04: Audio Management

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** None

---

## Overview

Audio source management - volume control, muting, monitor types, and audio presets. **This feature is working** but needs verification after state sync fixes.

---

## Current State

### What Exists
- `server/lib/obsAudioManager.js` (486 lines) - Audio management
- `show-controller/src/components/obs/AudioMixer.jsx` - Mixer UI
- `show-controller/src/components/obs/AudioPresetManager.jsx` - Preset management
- Routes: GET/PUT `/api/obs/audio/*`

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

| File | Purpose |
|------|---------|
| `server/lib/obsAudioManager.js` | Audio logic |
| `server/routes/obs.js` | Audio endpoints |
| `show-controller/src/components/obs/AudioMixer.jsx` | Mixer UI |
| `show-controller/src/components/obs/AudioPresetManager.jsx` | Presets |

---

## API Endpoints

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

## Definition of Done

1. All audio controls work
2. Presets save/load correctly
3. Firebase persistence works
4. Multi-client sync works
5. Tests pass
6. Code reviewed and merged
