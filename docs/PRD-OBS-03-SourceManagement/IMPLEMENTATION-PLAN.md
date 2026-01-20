# PRD-OBS-03: Source Management - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** In Progress

---

## Priority Order

### P0 - Critical (Fix Broken Features)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Debug TEST-35: Browser source URL editing not working | **COMPLETE** | Fixed: Added obs:updateInputSettings socket handler |
| 2 | Debug TEST-36: SRT/Media source editing not working | **COMPLETE** | Fixed: Same handler works for all input types |
| 3 | Fix `obs:updateInputSettings` socket handler in server/index.js | **COMPLETE** | Added handler at line 3166 |
| 4 | Fix SourceEditor.jsx save button to emit socket event | **COMPLETE** | Changed from REST API to socket events |

### P1 - High Priority (Core Functionality)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Fix scene item transform editing | **COMPLETE** | Added obs:setSceneItemTransform handler |
| 6 | Implement transform presets | **ALREADY EXISTS** | Transform presets already in SourceEditor.jsx (TRANSFORM_PRESETS) |
| 7 | Fix add source to scene | **ALREADY EXISTS** | obs:addSourceToScene handler exists at line 3092 |
| 8 | Fix remove source from scene | **ALREADY EXISTS** | obs:deleteSceneItem handler exists at line 2996 |

### P2 - Medium Priority (Enhanced Features)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Fix source layer reordering (z-index) | **ALREADY EXISTS** | obs:reorderSceneItems handler exists at line 3028 |
| 10 | Implement create new input | **ALREADY EXISTS** | obs:createInput handler exists at line 3124 |
| 11 | Implement delete input entirely | NOT STARTED | Need to add obs:removeInput handler |
| 12 | Multi-client sync verification | NEEDS TESTING | broadcastOBSState called after all operations |

### P3 - Polish

| # | Task | Status | Notes |
|---|------|--------|-------|
| 13 | Add loading states to SourceEditor | **ALREADY EXISTS** | saving state with spinner exists |
| 14 | Add error handling/toast on failure | PARTIAL | Error displayed in SourceEditor, no toast |
| 15 | Add Playwright tests for source management | NOT STARTED | Automated verification |

---

## Source Files Modified

### Frontend
- `show-controller/src/components/obs/SourceEditor.jsx` - Changed to use socket events instead of REST API
- `show-controller/src/context/OBSContext.jsx` - Added updateInputSettings and setSceneItemTransform methods

### Backend (Coordinator)
- `server/index.js` - Added obs:updateInputSettings and obs:setSceneItemTransform socket handlers

---

## Root Cause Analysis

**Problem:** TEST-35 and TEST-36 failed because SourceEditor.jsx was making REST API calls to update source settings. In production, all OBS commands must go through Socket.io to the coordinator.

**Solution:**
1. Added missing socket handlers in server/index.js:
   - `obs:updateInputSettings` - Updates input settings via OBS WebSocket SetInputSettings
   - `obs:setSceneItemTransform` - Updates scene item transform via OBS WebSocket SetSceneItemTransform

2. Updated SourceEditor.jsx to use OBSContext methods that emit socket events instead of making REST API calls.

3. Added the new methods to OBSContext.jsx to emit the socket events.

---

## Debugging Checklist

When debugging source management issues:

1. [x] Check browser console for errors when saving
2. [x] Check Network → WS tab for socket events being emitted
3. [x] Check coordinator logs: `ssh_exec target="coordinator" command="pm2 logs coordinator --lines 50"`
4. [x] Verify handler exists in `server/index.js` for the socket event
5. [x] Verify OBSContext has the method being called
6. [x] Verify coordinator is connected to competition VM's OBS

---

## Progress Log

### 2026-01-20
- Created implementation plan
- PRD-OBS-03 folder structure created
- **FIXED:** Added obs:updateInputSettings socket handler to server/index.js:3166
- **FIXED:** Added obs:setSceneItemTransform socket handler to server/index.js:3199
- **FIXED:** Added updateInputSettings method to OBSContext.jsx
- **FIXED:** Added setSceneItemTransform method to OBSContext.jsx
- **FIXED:** Updated SourceEditor.jsx to use socket events instead of REST API
- **DEPLOYED:** Backend deployed to coordinator (pm2 restart)
- **DEPLOYED:** Frontend built and deployed to commentarygraphic.com
- Commit: 1637a31

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Related Files Changed

Track files modified during implementation:

| File | Change Description | Commit |
|------|-------------------|--------|
| server/index.js | Added obs:updateInputSettings and obs:setSceneItemTransform handlers | 1637a31 |
| show-controller/src/context/OBSContext.jsx | Added updateInputSettings and setSceneItemTransform methods | 1637a31 |
| show-controller/src/components/obs/SourceEditor.jsx | Changed from REST API to socket events | 1637a31 |

---

## Remaining Work

1. **obs:removeInput handler** - Need to add handler to delete an input entirely from OBS
2. **Multi-client sync testing** - Verify changes broadcast to all connected clients
3. **Playwright tests** - Add automated tests for source management

---

## Notes

- The coordinator was already correctly broadcasting OBS state after scene changes via `broadcastOBSState()`
- Transform presets were already implemented in SourceEditor.jsx (TRANSFORM_PRESETS constant)
- Most P1 and P2 features were already implemented - they just needed the input settings update handler to work
