# PRD-OBS-09: Preview System - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** P0 COMPLETED - Screenshot Preview Working

---

## Priority Order

### P0 - Fix Preview Screenshot (COMPLETED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create OBSCurrentOutput.jsx component | DONE | Displays screenshot with auto-refresh |
| 2 | Add `obs:requestScreenshot` socket handler | DONE | In server/index.js with configurable options |
| 3 | Create useAutoRefreshScreenshot hook | DONE | Socket-based polling with pause/resume |
| 4 | Display screenshot in UI | DONE | Replaced placeholder with actual preview |

### P1 - Auto-Refresh (COMPLETED with P0)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Create useAutoRefreshScreenshot hook | DONE | Implemented with P0 |
| 6 | Implement pause when tab hidden | DONE | Uses document.visibilitychange |
| 7 | Add "Last updated" indicator | DONE | Shows "Just now", "Xs ago", etc. |
| 8 | Add manual refresh button | DONE | Refresh icon button |

### P2 - Studio Mode (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Add `obs:enableStudioMode` socket handler | NOT STARTED | Enable studio mode |
| 10 | Add `obs:disableStudioMode` socket handler | NOT STARTED | Disable studio mode |
| 11 | Add `obs:setPreviewScene` socket handler | NOT STARTED | Set preview scene |
| 12 | Add `obs:transitionToProgram` socket handler | NOT STARTED | Execute transition |
| 13 | Create StudioModePanel.jsx component | NOT STARTED | Dual preview/program layout |

### P3 - Scene Thumbnails (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14 | Add scene-specific screenshot | NOT STARTED | Preview before switching |
| 15 | Add thumbnails to scene list | NOT STARTED | Visual reference |
| 16 | Add hover preview | NOT STARTED | Larger view on hover |

### P4 - Health Indicators (PARTIAL)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17 | Show OBS connection status | DONE | Green/red banner at top |
| 18 | Show dropped frames warning | DONE | Yellow warning if > 0.1% |
| 19 | Show stream status | DONE | LIVE indicator, Offline badge |

---

## Completed Items

### 2026-01-20: P0 Screenshot Preview

**Files Created:**
- `show-controller/src/components/obs/OBSCurrentOutput.jsx` - Main preview component
- `show-controller/src/hooks/useAutoRefreshScreenshot.js` - Auto-refresh hook

**Files Modified:**
- `server/index.js` - Added `obs:requestScreenshot` socket handler (lines 3710-3762)
- `show-controller/src/pages/OBSManager.jsx` - Import and use new OBSCurrentOutput component

**Features Implemented:**
- [x] Screenshot of program output via Socket.io
- [x] Configurable image size (640x360 default for fast transfer)
- [x] JPEG format for smaller file size
- [x] Auto-refresh with configurable interval (1s, 2s, 5s, 10s)
- [x] Pause auto-refresh when browser tab hidden
- [x] Manual refresh button
- [x] "Updated: X ago" timestamp display
- [x] Loading state while fetching
- [x] Error state with retry button
- [x] Current scene name display
- [x] Stream/Recording status badges (LIVE, RECORDING, Offline)

---

## Verification Results

**Production URL:** https://commentarygraphic.com/8kyf0rnl/obs-manager

### Playwright MCP Verification (2026-01-20)

| Test | Result |
|------|--------|
| OBSCurrentOutput component renders | PASS |
| Screenshot image displays (not placeholder) | PASS |
| "Updated: Just now" shows | PASS |
| Auto-refresh controls visible | PASS |
| Pause/Play button works | PASS |
| Refresh interval selector shows (1s, 2s, 5s, 10s) | PASS |
| Current scene name displayed | PASS |
| Offline badge shows when not streaming | PASS |
| No console errors | PASS |

Screenshot: `screenshots/PRD-OBS-09-preview-system-verification.png`

---

## Socket Events Implemented

### Client → Coordinator
| Event | Payload | Status |
|-------|---------|--------|
| `obs:requestScreenshot` | `{ sceneName?, imageWidth?, imageHeight?, imageFormat? }` | DONE |

### Coordinator → Client
| Event | Payload | Status |
|-------|---------|--------|
| `obs:screenshotData` | `{ success, imageData, sceneName, timestamp }` | DONE |
| `obs:screenshotError` | `{ error, sceneName? }` | DONE |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/index.js:3710-3762` | Socket.io obs:requestScreenshot handler |
| `show-controller/src/components/obs/OBSCurrentOutput.jsx` | Preview display component |
| `show-controller/src/hooks/useAutoRefreshScreenshot.js` | Auto-refresh hook |
| `show-controller/src/pages/OBSManager.jsx` | Integration point |

---

## Commits

- `9c56302` - PRD-OBS-09: Implement Preview System screenshot functionality
- `1122ef5` - PRD-OBS-09: Fix screenshot handler to use socket.handshake.query.compId

---

## Deferred Items

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Studio Mode toggle | DEFERRED | P2 priority |
| 2 | Scene-specific screenshots | DEFERRED | P3 priority |
| 3 | Scene thumbnails in list | DEFERRED | P3 priority |
| 4 | Full-screen preview mode | DEFERRED | P4 priority |
