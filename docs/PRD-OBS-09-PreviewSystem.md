# PRD-OBS-09: Preview System

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync), PRD-OBS-02 (Scenes)
**Blocks:** None

---

## Overview

Remote preview for headless OBS - screenshots and studio mode control. **This feature is BROKEN** (TEST-41/42 failed/skipped). UI shows hardcoded placeholder.

---

## Current State

### What Exists
- Screenshot endpoint in `server/routes/obs.js`
- Studio mode socket events in `server/index.js`
- OBSContext has `takeScreenshot`, `setPreviewScene` methods
- OBSManager.jsx has placeholder: "Preview placeholder"

### Test Results
- Preview system: ❌ TEST-41 FAILED
- Studio mode: ⏭️ TEST-42 SKIPPED

### Known Issues
1. OBSCurrentOutput component shows hardcoded placeholder
2. Screenshot may not be wiring to display correctly
3. Studio mode preview/program toggle not implemented in UI

---

## Requirements

### 1. Program Output Screenshot

Capture current program output as image.

**Test Cases:**
- [ ] Take screenshot → returns base64 image
- [ ] Screenshot displays in UI
- [ ] Auto-refresh screenshot periodically (optional)

### 2. Scene-Specific Screenshot

Capture preview of any scene (not just program).

**Test Cases:**
- [ ] Screenshot specific scene → returns image
- [ ] Preview before switching scenes

### 3. Studio Mode Control

OBS Studio Mode = separate Preview and Program outputs.

**States:**
- Studio Mode OFF: Direct scene switching
- Studio Mode ON: Preview scene, then transition to program

**Test Cases:**
- [ ] Enable studio mode → OBS enters studio mode
- [ ] Disable studio mode → OBS exits studio mode
- [ ] Set preview scene → updates in OBS
- [ ] Execute transition → preview becomes program

### 4. Fix OBSCurrentOutput Component

Currently shows placeholder. Needs to:
- Display current program screenshot
- Show current scene name
- Show stream status
- Show recording status

---

## Files to Fix

| File | Issue |
|------|-------|
| `show-controller/src/components/obs/OBSCurrentOutput.jsx` | **CREATE or FIX** - placeholder only |
| `show-controller/src/pages/OBSManager.jsx` | Wire up preview component |
| `server/routes/obs.js` | Verify screenshot endpoint |
| `show-controller/src/context/OBSContext.jsx` | Verify screenshot handling |

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/preview/screenshot` | Current output screenshot |
| GET | `/api/obs/preview/screenshot/:sceneName` | Scene screenshot |
| PUT | `/api/obs/studio-mode` | Enable/disable studio mode |
| PUT | `/api/obs/studio-mode/preview` | Set preview scene |
| POST | `/api/obs/studio-mode/transition` | Execute transition |

---

## Screenshot Response

```json
{
  "imageData": "data:image/png;base64,iVBORw0KGgo...",
  "imageWidth": 1920,
  "imageHeight": 1080,
  "capturedAt": "2026-01-16T10:30:00Z"
}
```

---

## UI Design

### OBSCurrentOutput.jsx

```
┌─ CURRENT OUTPUT ─────────────────────────────────────┐
│                                                       │
│  ┌─────────────────────────┐   Scene: Single - Cam1  │
│  │                         │   Transition: Fade      │
│  │    [Program Screenshot] │                         │
│  │                         │   Stream: ● LIVE        │
│  │                         │   Uptime: 01:23:45      │
│  │                         │   Bitrate: 6.2 Mbps     │
│  └─────────────────────────┘                         │
│                                                       │
│  [Refresh] [Take Screenshot] [Toggle Studio Mode]    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### With Studio Mode Enabled

```
┌─ STUDIO MODE ────────────────────────────────────────┐
│                                                       │
│  ┌─────────────────┐    ┌─────────────────┐         │
│  │    PREVIEW      │    │    PROGRAM      │         │
│  │                 │ => │                 │         │
│  │  [Scene Image]  │    │  [Scene Image]  │         │
│  │                 │    │                 │         │
│  │  Dual - Cam1+2  │    │  Single - Cam1  │         │
│  └─────────────────┘    └─────────────────┘         │
│                                                       │
│  [Transition] [Cut] [Fade]                           │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Socket Events

### Client → Server
- `obs:takeScreenshot` - Request screenshot
- `obs:enableStudioMode` - Enter studio mode
- `obs:disableStudioMode` - Exit studio mode
- `obs:setPreviewScene` - Set preview scene
- `obs:transitionToProgram` - Execute transition

### Server → Client
- `obs:screenshotCaptured` - Screenshot data

---

## Implementation Notes

### Screenshot Polling (Optional)
For near-real-time preview without studio mode:
```javascript
// Poll every 2 seconds
setInterval(() => {
  socket.emit('obs:takeScreenshot');
}, 2000);
```

### OBS WebSocket Call
```javascript
const screenshot = await obs.call('GetSourceScreenshot', {
  sourceName: sceneName || currentScene,
  imageFormat: 'png',
  imageWidth: 640,  // Smaller for faster transfer
  imageHeight: 360
});
```

---

## Acceptance Criteria

- [ ] Screenshot of program output works
- [ ] Screenshot of specific scene works
- [ ] Screenshot displays in UI (not placeholder)
- [ ] Enable/disable studio mode works
- [ ] Preview scene can be set
- [ ] Transition to program works
- [ ] Stream/recording status displays

---

## Test Plan

### Failing Tests to Fix
```javascript
// TEST-41: Preview system
test('can take program screenshot', async () => {
  // Take screenshot
  // Verify base64 image returned
  // Verify displayed in UI
});

// TEST-42: Studio mode
test('can use studio mode', async () => {
  // Enable studio mode
  // Set preview scene
  // Execute transition
  // Verify program changed
});
```

### Manual Verification
1. Open OBS Manager
2. Verify program screenshot displays (not placeholder)
3. Enable studio mode → verify UI shows preview/program
4. Click scene in list → verify goes to preview
5. Click transition → verify moves to program

---

## Definition of Done

1. TEST-41 passes (preview screenshot)
2. TEST-42 passes (studio mode)
3. OBSCurrentOutput shows real screenshot
4. Studio mode UI works
5. Code reviewed and merged
