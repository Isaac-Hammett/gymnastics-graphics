# PRD-OBS-04: Audio Management - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** Coordinator Deploy Required

---

## Critical Bug Fixed

**BUG FOUND:** The `obs:setVolume` and `obs:setMute` socket event handlers were **completely missing** from `server/index.js`. The frontend was emitting these events but the server had no handlers - audio controls could never have worked in production!

**FIX APPLIED:** Added both handlers to `server/index.js:3391-3464`:
- `obs:setVolume` - Calls OBS WebSocket `SetInputVolume` with volumeDb or volumeMul
- `obs:setMute` - Calls OBS WebSocket `SetInputMute` with inputMuted boolean

**NEXT STEP:** Deploy coordinator to production (`ssh_exec` to restart pm2 on coordinator server)

---

## Priority Order

### P0 - Critical Bug Fix (DONE)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Add missing `obs:setVolume` handler | ✅ DONE | server/index.js:3391 |
| 0.2 | Add missing `obs:setMute` handler | ✅ DONE | server/index.js:3434 |
| 0.3 | Deploy coordinator to production | NOT STARTED | MCP tools unavailable - do in next context |

### P1 - Verify Existing Functionality (BLOCKED on deploy)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Verify volume slider works | BLOCKED | Requires coordinator deploy |
| 2 | Verify mute toggle works | BLOCKED | Requires coordinator deploy |
| 3 | Verify monitor type dropdown works | BLOCKED | `obs:setMonitorType` exists at server/index.js:3467 |

### P2 - Verify Audio Presets (BLOCKED on P1)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4 | Verify save preset works | NOT STARTED | Stored in Firebase |
| 5 | Verify load preset applies all levels | NOT STARTED | All sources updated in OBS |
| 6 | Verify delete preset works | NOT STARTED | Removed from Firebase |
| 7 | Verify presets persist across refresh | NOT STARTED | Read from Firebase on load |

### P3 - Multi-client Sync (BLOCKED on P1)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8 | Verify volume changes sync to other clients | NOT STARTED | Via coordinator broadcast |
| 9 | Verify mute changes sync to other clients | NOT STARTED | Via coordinator broadcast |

### P4 - Nice to Have

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | Implement real-time VU meters | NOT STARTED | Requires OBS WebSocket subscriptions |

---

## Source Files

### Frontend (all verified working)
- `show-controller/src/components/obs/AudioMixer.jsx` - Volume slider, mute toggle, monitor dropdown
- `show-controller/src/components/obs/AudioPresetManager.jsx` - Preset CRUD
- `show-controller/src/context/OBSContext.jsx` - Socket event emission for `obs:setVolume`, `obs:setMute`, `obs:setMonitorType`

### Backend (Coordinator)
- `server/index.js:3391` - `obs:setVolume` handler (NEW)
- `server/index.js:3434` - `obs:setMute` handler (NEW)
- `server/index.js:3467` - `obs:setMonitorType` handler (existed)

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/8kyf0rnl/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Deploy Instructions (for next context)

```bash
# 1. SSH to coordinator and pull latest code
ssh_exec target="3.87.107.201" command="cd /path/to/server && git pull origin main"

# 2. Restart coordinator with pm2
ssh_exec target="3.87.107.201" command="pm2 restart coordinator"

# 3. Verify coordinator is running
ssh_exec target="3.87.107.201" command="pm2 status"

# 4. Verify via Playwright
browser_navigate url="https://commentarygraphic.com/8kyf0rnl/obs-manager"
browser_take_screenshot
# Navigate to Audio tab and test volume slider
```

---

## Progress Log

### 2026-01-20 - Context 2
- **DISCOVERED:** `obs:setVolume` and `obs:setMute` handlers were missing from server
- **FIXED:** Added both handlers to server/index.js
- **BLOCKED:** MCP tools (ssh_exec, browser_*) unavailable - cannot deploy or verify
- Committed changes to main branch

### 2026-01-20 - Context 1
- Created implementation plan

---

## Related Files Changed

| File | Change Description | Commit |
|------|-------------------|--------|
| server/index.js | Added `obs:setVolume` and `obs:setMute` socket handlers | PRD-OBS-04: Add missing audio control handlers |
