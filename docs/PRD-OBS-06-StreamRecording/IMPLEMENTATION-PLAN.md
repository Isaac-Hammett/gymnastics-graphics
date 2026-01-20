# PRD-OBS-06: Stream & Recording - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** Verification Needed

---

## Priority Order

### P0 - Verify Streaming

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Verify view stream settings works | NOT STARTED | Key should be masked |
| 2 | Verify start streaming works | NOT STARTED | `obs:startStream` socket event |
| 3 | Verify stop streaming works | NOT STARTED | `obs:stopStream` socket event |
| 4 | Verify stream stats display | NOT STARTED | Bitrate, uptime, dropped frames |

### P1 - Verify Recording

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Verify start recording works | NOT STARTED | `obs:startRecording` socket event |
| 6 | Verify stop recording works | NOT STARTED | `obs:stopRecording` socket event |
| 7 | Verify pause/resume recording works | NOT STARTED | `obs:pauseRecording`, `obs:resumeRecording` |
| 8 | Verify recording status displays | NOT STARTED | Duration, file path |

### P2 - Stream Configuration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Verify update stream server works | NOT STARTED | RTMP destination |
| 10 | Verify update stream key works | NOT STARTED | Key should be encrypted in Firebase |
| 11 | Verify settings persist | NOT STARTED | Stored in Firebase |

### P3 - Security

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | Verify stream key not exposed in API responses | NOT STARTED | Should show `****` |
| 13 | Verify stream key encrypted in Firebase | NOT STARTED | Security requirement |

---

## Source Files to Review

### Frontend
- `show-controller/src/components/obs/StreamConfig.jsx` - Stream UI
- `show-controller/src/context/OBSContext.jsx` - Socket event emission

### Backend (Coordinator)
- `server/index.js` - Socket.io handlers for stream/recording events
- `server/lib/obsConnectionManager.js` - OBS WebSocket connections
- `server/lib/obsStreamManager.js` - Stream logic (local dev only)

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
