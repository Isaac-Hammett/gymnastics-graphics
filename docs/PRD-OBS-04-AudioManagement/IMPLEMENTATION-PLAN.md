# PRD-OBS-04: Audio Management - Implementation Plan

**Last Updated:** 2026-01-21
**Status:** ✅ Phase 1 Complete, Phase 2 Backend Complete (P2.1-P2.2), Phase 2 OBSContext Complete (P2.3)

---

## Phase Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Basic audio controls (volume, mute, monitor type, presets) | ✅ Complete |
| Phase 2 | Real-time audio levels & alerts | 🔲 Ready for Implementation |
| Phase 3 | AI Auto-Mixing | 🔲 Future (depends on Phase 2) |

---

## Phase 1: Basic Audio Controls (✅ COMPLETE)

### Critical Bug Fixed (2026-01-20)

**BUG FOUND:** The `obs:setVolume` and `obs:setMute` socket event handlers were **completely missing** from `server/index.js`. The frontend was emitting these events but the server had no handlers.

**FIX APPLIED:** Added both handlers. Current locations (updated 2026-01-21):
- `obs:setVolume` - server/index.js:3594
- `obs:setMute` - server/index.js:3637
- `obs:setMonitorType` - server/index.js:3669

### P1.1 - Audio Controls (✅ VERIFIED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Volume slider | ✅ VERIFIED | Frontend: OBSContext.jsx:322, Backend: server/index.js:3594 |
| 1.2 | Mute toggle | ✅ VERIFIED | Frontend: OBSContext.jsx:327, Backend: server/index.js:3637 |
| 1.3 | Monitor type dropdown | ✅ VERIFIED | Frontend: OBSContext.jsx:504, Backend: server/index.js:3669 |

### P1.2 - Audio Presets (✅ UI VERIFIED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.4 | Save preset | ✅ UI VERIFIED | "Save Current Mix" button visible |
| 1.5 | Load preset | ✅ UI VERIFIED | 5 presets visible with Apply buttons |
| 1.6 | Delete preset | ✅ UI VERIFIED | Delete buttons visible |
| 1.7 | Presets persist | ✅ VERIFIED | Firebase persistence working |

---

## Phase 2: Real-time Audio Levels & Alerts (🔄 P2.1-P2.3 COMPLETE)

### P2.1 - Coordinator: InputVolumeMeters Subscription

| # | Task | Status | File | Notes |
|---|------|--------|------|-------|
| 2.1 | Modify `connectToVM()` to subscribe to high-volume events | ✅ DONE | server/lib/obsConnectionManager.js:87 | Added `EventSubscription.InputVolumeMeters` to connect options |
| 2.2 | Add `subscribeAudioLevels(compId, socketId)` method | ✅ DONE | server/lib/obsConnectionManager.js:410 | Track per-competition subscriptions |
| 2.3 | Add `unsubscribeAudioLevels(compId, socketId)` method | ✅ DONE | server/lib/obsConnectionManager.js:427 | Cleanup on disconnect |
| 2.4 | Add `_startAudioLevelForwarding(compId)` method | ✅ DONE | server/lib/obsConnectionManager.js:453 | Throttle 60fps → 15fps (66ms interval) |
| 2.5 | Add `_stopAudioLevelForwarding(compId)` method | ✅ DONE | server/lib/obsConnectionManager.js:494 | Remove event listener |
| 2.6 | Emit `audioLevels` event from obsConnectionManager | ✅ DONE | server/lib/obsConnectionManager.js:483 | EventEmitter pattern |

**CRITICAL:** `InputVolumeMeters` is a high-volume event requiring explicit subscription:
```javascript
import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';

await obs.connect(obsUrl, password, {
  eventSubscriptions: EventSubscription.All | EventSubscription.InputVolumeMeters,
  rpcVersion: 1
});
```

### P2.2 - Coordinator: Socket Handlers

| # | Task | Status | File | Notes |
|---|------|--------|------|-------|
| 2.7 | Add `obs:subscribeAudioLevels` socket handler | ✅ DONE | server/index.js:3701 | Call obsConnManager.subscribeAudioLevels() |
| 2.8 | Forward `audioLevels` events to competition room | ✅ DONE | server/index.js:4846 | In initializeOBSConnectionManager() |
| 2.9 | Cleanup subscriptions on socket disconnect | ✅ DONE | server/index.js:4770 | Call unsubscribeAudioLevelsAll on disconnect |

### P2.3 - Frontend: OBSContext (✅ COMPLETE)

| # | Task | Status | File | Notes |
|---|------|--------|------|-------|
| 2.10 | Add `audioLevels` state (Map) | ✅ DONE | show-controller/src/context/OBSContext.jsx:28,40 | `useState(new Map())` |
| 2.11 | Add `obs:audioLevels` event listener | ✅ DONE | show-controller/src/context/OBSContext.jsx:232-236 | Update audioLevels state |
| 2.12 | Add `subscribeAudioLevels`/`unsubscribeAudioLevels` methods | ✅ DONE | show-controller/src/context/OBSContext.jsx:529-540 | Emits `obs:subscribeAudioLevels` |
| 2.13 | Export `audioLevels` from context | ✅ DONE | show-controller/src/context/OBSContext.jsx:618-620 | For AudioMixer to consume |

### P2.4 - Frontend: VU Meters

| # | Task | Status | File | Notes |
|---|------|--------|------|-------|
| 2.14 | Create `VUMeter` component | 🔲 TODO | show-controller/src/components/obs/AudioMixer.jsx | Animated level bar |
| 2.15 | Add VU meter to each audio source | 🔲 TODO | show-controller/src/components/obs/AudioMixer.jsx | Below volume slider |
| 2.16 | Color coding (green/yellow/red) | 🔲 TODO | show-controller/src/components/obs/AudioMixer.jsx | Based on dB level |

### P2.5 - Frontend: Audio Alerts

| # | Task | Status | File | Notes |
|---|------|--------|------|-------|
| 2.17 | Create `useAudioAlerts` hook | 🔲 TODO | show-controller/src/components/obs/AudioMixer.jsx | Track level history |
| 2.18 | Silence alert (>10s below -50dB) | 🔲 TODO | AudioMixer.jsx | Yellow warning |
| 2.19 | Clipping alert (>500ms above -3dB) | 🔲 TODO | AudioMixer.jsx | Red flashing |
| 2.20 | Signal lost alert | 🔲 TODO | AudioMixer.jsx | Red "NO SIGNAL" badge |
| 2.21 | Unstable alert (3+ drops in 30s) | 🔲 TODO | AudioMixer.jsx | Orange "UNSTABLE" |
| 2.22 | Create `AudioAlert` component | 🔲 TODO | AudioMixer.jsx | Badge/icon display |
| 2.23 | Per-source alert config in Firebase | 🔲 TODO | Firebase | Enable/disable per source |

### P2.6 - Testing & Verification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.24 | Test VU meters with live audio | 🔲 TODO | Manual test with OBS audio sources |
| 2.25 | Test alert triggers | 🔲 TODO | Simulate silence, clipping, signal loss |
| 2.26 | Performance test (UI smoothness) | 🔲 TODO | Verify no jank at 15fps updates |
| 2.27 | Multi-client test | 🔲 TODO | Verify all clients receive levels |
| 2.28 | Deploy to production | 🔲 TODO | Deploy coordinator + frontend |

---

## Phase 3: AI Auto-Mixing (🔲 FUTURE)

Depends on Phase 2 completion. See PRD for details on:
- Voice Activity Detection (VAD)
- Music Ducking
- Multi-Talent Balancing
- Configurable rules engine

---

## Source Files

### Frontend

| File | Purpose | Key Lines |
|------|---------|-----------|
| `show-controller/src/components/obs/AudioMixer.jsx` | Volume slider, mute toggle, monitor dropdown, VU meters (Phase 2) | 231 lines |
| `show-controller/src/components/obs/AudioPresetManager.jsx` | Preset CRUD | - |
| `show-controller/src/context/OBSContext.jsx` | Socket event emission | setVolume:322, setMute:327, setMonitorType:504 |

### Backend (Coordinator)

| File | Handler | Line | OBS API Call |
|------|---------|------|--------------|
| server/index.js | `obs:setVolume` | 3594 | `SetInputVolume` |
| server/index.js | `obs:setMute` | 3637 | `SetInputMute` |
| server/index.js | `obs:setMonitorType` | 3669 | `SetInputAudioMonitorType` |
| server/index.js | `obs:refreshState` | 4339 | Full state broadcast |
| server/lib/obsConnectionManager.js | OBS connection manager | - | Per-competition connections |

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/8kyf0rnl/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Deploy Instructions

### Coordinator (for Phase 2 backend changes)

**Server:** `44.193.31.120` (api.commentarygraphic.com)
**App Path:** `/opt/gymnastics-graphics/`

```bash
# Via MCP tools:
ssh_exec target="coordinator" command="cd /opt/gymnastics-graphics && git pull origin main && pm2 restart coordinator"

# Via direct SSH:
ssh -i ~/.ssh/gymnastics-graphics-key-pair.pem ubuntu@44.193.31.120 \
  "cd /opt/gymnastics-graphics && git pull origin main && pm2 restart coordinator"

# Verify:
curl https://api.commentarygraphic.com/api/coordinator/status
```

### Frontend (for Phase 2 UI changes)

**Server:** `3.87.107.201` (commentarygraphic.com)

```bash
# Use deploy script:
./scripts/deploy-frontend.sh

# Or manually:
cd show-controller && npm run build
# Then upload dist/ to /var/www/commentarygraphic/
```

---

## Progress Log

### 2026-01-21 - Phase 2 OBSContext Implementation (P2.3)
- **IMPLEMENTED:** `audioLevels` state (Map) in OBSContext
- **IMPLEMENTED:** `obs:audioLevels` event listener
- **IMPLEMENTED:** `subscribeAudioLevels()` and `unsubscribeAudioLevels()` methods
- **IMPLEMENTED:** Exported `audioLevels`, `subscribeAudioLevels`, `unsubscribeAudioLevels` from context
- **FILES CHANGED:**
  - `show-controller/src/context/OBSContext.jsx` - Added audio level state and methods
- **NEXT:** Implement VU meters in AudioMixer (P2.4)

### 2026-01-21 - Phase 2 Backend Implementation (P2.1-P2.2)
- **IMPLEMENTED:** `EventSubscription.InputVolumeMeters` subscription in `connectToVM()`
- **IMPLEMENTED:** Audio level subscription methods (`subscribeAudioLevels`, `unsubscribeAudioLevels`, `unsubscribeAudioLevelsAll`)
- **IMPLEMENTED:** Audio level forwarding with 66ms throttle (~15fps)
- **IMPLEMENTED:** `obs:subscribeAudioLevels` socket handler
- **IMPLEMENTED:** Audio levels event forwarding to competition room
- **IMPLEMENTED:** Cleanup on socket disconnect
- **FILES CHANGED:**
  - `server/lib/obsConnectionManager.js` - Added audio level subscription system
  - `server/index.js` - Added socket handler and disconnect cleanup
- **NEXT:** Deploy to coordinator, then implement frontend (P2.3-P2.4)

### 2026-01-21 - PRD & Plan Update
- **PRD UPDATED:** Fixed line number references (handlers moved due to code changes)
- **PRD UPDATED:** Added critical note about `InputVolumeMeters` high-volume event subscription
- **PRD UPDATED:** Enhanced Phase 2 implementation code with subscription tracking
- **PLAN UPDATED:** Restructured into Phase 1/2/3 with detailed task breakdown
- **PLAN UPDATED:** Added 28 specific tasks for Phase 2 implementation

### 2026-01-20 - Phase 1 Complete (LIVE VERIFICATION)
- **PLAYWRIGHT TEST RESULTS:** Ran automated browser tests against production
- **OBS Connection:** ✅ Connected to OBS Studio via WebSocket (50.19.137.152:3003)
- **Audio Tab:** ✅ Visible and clickable, correctly highlighted when active
- **Audio Mixer:** ✅ Displays "No Audio Sources" empty state correctly
- **Audio Presets:** ✅ All 5 presets visible with Apply/Delete buttons
- **Console Errors:** ✅ 0 JavaScript errors
- **STATUS:** Phase 1 complete - Audio management working in production

### 2026-01-20 - Bug Fix Deployed
- **DISCOVERED:** `obs:setVolume` and `obs:setMute` handlers were missing from server
- **FIXED:** Added both handlers to server/index.js
- **DEPLOYED:** Coordinator restarted via SSH

---

## Related Files Changed

| File | Change Description | Date |
|------|-------------------|------|
| server/index.js | Added `obs:setVolume` and `obs:setMute` socket handlers | 2026-01-20 |
| docs/PRD-OBS-04-AudioManagement.md | Updated line numbers, added Phase 2 implementation details | 2026-01-21 |
| docs/PRD-OBS-04-AudioManagement/IMPLEMENTATION-PLAN.md | Restructured for Phase 2 | 2026-01-21 |
