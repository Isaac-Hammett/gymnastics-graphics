# PRD-OBS-04: Audio Management - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** Verification Needed

---

## Priority Order

### P0 - Verify Existing Functionality

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Verify volume slider works | NOT STARTED | `obs:setVolume` socket event |
| 2 | Verify mute toggle works | NOT STARTED | `obs:setMute` socket event |
| 3 | Verify monitor type dropdown works | NOT STARTED | `obs:setMonitorType` socket event |

### P1 - Verify Audio Presets

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4 | Verify save preset works | NOT STARTED | Stored in Firebase |
| 5 | Verify load preset applies all levels | NOT STARTED | All sources updated in OBS |
| 6 | Verify delete preset works | NOT STARTED | Removed from Firebase |
| 7 | Verify presets persist across refresh | NOT STARTED | Read from Firebase on load |

### P2 - Multi-client Sync

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8 | Verify volume changes sync to other clients | NOT STARTED | Via coordinator broadcast |
| 9 | Verify mute changes sync to other clients | NOT STARTED | Via coordinator broadcast |

### P3 - Nice to Have

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | Implement real-time VU meters | NOT STARTED | Requires OBS WebSocket subscriptions |

---

## Source Files to Review

### Frontend
- `show-controller/src/components/obs/AudioMixer.jsx` - Mixer UI
- `show-controller/src/components/obs/AudioPresetManager.jsx` - Presets
- `show-controller/src/context/OBSContext.jsx` - Socket event emission

### Backend (Coordinator)
- `server/index.js` - Socket.io handlers for `obs:setVolume`, `obs:setMute`
- `server/lib/obsConnectionManager.js` - OBS WebSocket connections
- `server/lib/obsAudioManager.js` - Audio logic (local dev only)

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-20
- Created implementation plan

---

## Related Files Changed

| File | Change Description | Commit |
|------|-------------------|--------|
| - | - | - |
