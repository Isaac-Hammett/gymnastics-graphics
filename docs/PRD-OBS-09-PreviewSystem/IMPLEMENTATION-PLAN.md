# PRD-OBS-09: Preview System - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** BROKEN (TEST-41/42 Failed)

---

## Priority Order

### P0 - Fix Preview Screenshot (BROKEN)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create OBSCurrentOutput.jsx component | NOT STARTED | Currently shows placeholder |
| 2 | Add `obs:requestScreenshot` socket handler | NOT STARTED | In server/index.js |
| 3 | Add screenshot listener in OBSContext.jsx | NOT STARTED | `obs:screenshotData` event |
| 4 | Display screenshot in UI | NOT STARTED | Replace placeholder text |

### P1 - Auto-Refresh

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Create useAutoRefreshScreenshot hook | NOT STARTED | Socket-based polling |
| 6 | Implement pause when tab hidden | NOT STARTED | Save bandwidth |
| 7 | Add "Last updated" indicator | NOT STARTED | User feedback |
| 8 | Add manual refresh button | NOT STARTED | On-demand refresh |

### P2 - Studio Mode

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Add `obs:enableStudioMode` socket handler | NOT STARTED | Enable studio mode |
| 10 | Add `obs:disableStudioMode` socket handler | NOT STARTED | Disable studio mode |
| 11 | Add `obs:setPreviewScene` socket handler | NOT STARTED | Set preview scene |
| 12 | Add `obs:transitionToProgram` socket handler | NOT STARTED | Execute transition |
| 13 | Create StudioModePanel.jsx component | NOT STARTED | Dual preview/program layout |

### P3 - Scene Thumbnails

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14 | Add scene-specific screenshot | NOT STARTED | Preview before switching |
| 15 | Add thumbnails to scene list | NOT STARTED | Visual reference |
| 16 | Add hover preview | NOT STARTED | Larger view on hover |

### P4 - Health Indicators

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17 | Show OBS connection status | NOT STARTED | Green/red indicator |
| 18 | Show dropped frames warning | NOT STARTED | Yellow warning if > 0.1% |
| 19 | Show stream status | NOT STARTED | LIVE indicator, duration |

---

## Source Files to Create/Modify

### Frontend (Create)
- `show-controller/src/components/obs/OBSCurrentOutput.jsx` - **CREATE**
- `show-controller/src/components/obs/StudioModePanel.jsx` - **CREATE**
- `show-controller/src/hooks/useAutoRefreshScreenshot.js` - **CREATE**

### Frontend (Modify)
- `show-controller/src/pages/OBSManager.jsx` - Integrate new components
- `show-controller/src/context/OBSContext.jsx` - Add screenshot state, socket handlers

### Backend (Add)
- `server/index.js` - Add socket handlers for screenshot, studio mode

---

## Socket Events to Implement

### Client → Coordinator
- `obs:requestScreenshot` - Request screenshot
- `obs:enableStudioMode` - Enable studio mode
- `obs:disableStudioMode` - Disable studio mode
- `obs:setPreviewScene` - Set preview scene
- `obs:transitionToProgram` - Execute transition

### Coordinator → Client
- `obs:screenshotData` - Screenshot response
- `obs:screenshotError` - Screenshot failed
- `obs:studioModeChanged` - Studio mode state changed
- `obs:previewSceneChanged` - Preview scene changed

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-20
- Created implementation plan
- TEST-41 (preview system) is failing
- TEST-42 (studio mode) is skipped

---

## Related Files Changed

| File | Change Description | Commit |
|------|-------------------|--------|
| - | - | - |
