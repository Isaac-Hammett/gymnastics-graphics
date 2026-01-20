# PRD-OBS-09: Preview System

**Version:** 2.0
**Date:** 2026-01-20
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync), PRD-OBS-02 (Scenes)
**Blocks:** None

---

## Overview

Remote preview for headless OBS running on cloud VMs. Since there's no physical monitor attached, we need alternative methods to see what OBS is outputting. **This feature is BROKEN** (TEST-41/42 failed/skipped). UI shows hardcoded placeholder.

---

## Problem Statement

When OBS runs headlessly on AWS EC2 instances, operators cannot see:
1. What scene is currently live (program output)
2. What a scene looks like before switching to it (preview)
3. Real-time video feed quality (dropped frames, encoding issues)
4. Whether sources are rendering correctly (black screens, frozen frames)

This makes remote production nearly impossible without visual feedback.

---

## Current State

### What Exists
- Screenshot endpoint in `server/routes/obs.js` (lines 2031-2103)
- Studio mode API endpoints (lines 2109-2223)
- OBSContext has `takeScreenshot`, `setPreviewScene` methods
- OBSManager.jsx has placeholder: "Preview placeholder"
- `obsStateSync.takeScreenshot()` method exists but untested

### Test Results
- Preview system: ❌ TEST-41 FAILED
- Studio mode: ⏭️ TEST-42 SKIPPED

### Known Issues
1. OBSCurrentOutput component shows hardcoded placeholder
2. Screenshot may not be wiring to display correctly
3. Studio mode preview/program toggle not implemented in UI
4. No auto-refresh mechanism for near-real-time preview
5. No error handling for screenshot failures (OBS source not ready, scene empty)

---

## Requirements

### 1. Program Output Screenshot (Priority: HIGH)

Capture current program output as image for visual verification.

**Functional Requirements:**
- Take screenshot of current program output on demand
- Support configurable image size (default 640x360 for fast transfer, up to 1920x1080)
- Support PNG and JPEG formats (JPEG for smaller file size)
- Return base64-encoded image data with metadata

**Test Cases:**
- [ ] Take screenshot → returns base64 image
- [ ] Screenshot displays in UI within 2 seconds
- [ ] Handles empty scene gracefully (returns placeholder or error)
- [ ] Works when stream is live (doesn't interrupt output)

### 2. Auto-Refresh Preview (Priority: HIGH)

Near-real-time preview updates without manual refresh.

**Functional Requirements:**
- Configurable refresh interval (default 2 seconds, range 0.5-10 seconds)
- Pause auto-refresh when tab not visible (save bandwidth)
- Visual indicator showing refresh status (last updated timestamp)
- Ability to pause/resume auto-refresh
- Bandwidth-conscious: smaller images (320x180) for rapid refresh

**Test Cases:**
- [ ] Preview updates automatically every N seconds
- [ ] Refresh pauses when browser tab hidden
- [ ] Manual refresh button works alongside auto-refresh
- [ ] Shows "Last updated: X seconds ago" indicator

### 3. Scene-Specific Screenshot (Priority: MEDIUM)

Preview any scene before switching to it live.

**Functional Requirements:**
- Screenshot any scene by name (not just current program)
- Thumbnail preview in scene list for quick visual reference
- Hover preview for larger view
- Cache scene thumbnails (invalidate on scene change)

**Test Cases:**
- [ ] Screenshot specific scene → returns image
- [ ] Preview shown in scene list as thumbnail
- [ ] Hover shows larger preview
- [ ] Invalid scene name returns appropriate error

### 4. Studio Mode Control (Priority: MEDIUM)

OBS Studio Mode = separate Preview and Program outputs for safer switching.

**States:**
- Studio Mode OFF: Direct scene switching (current behavior)
- Studio Mode ON: Preview scene first, then transition to program

**Functional Requirements:**
- Toggle studio mode on/off from UI
- Show both preview and program when studio mode enabled
- Set preview scene independently of program
- Execute transition (Cut, Fade, or current default) to move preview → program
- Visual indicator showing studio mode state

**Test Cases:**
- [ ] Enable studio mode → OBS enters studio mode
- [ ] Disable studio mode → OBS exits studio mode
- [ ] Set preview scene → updates preview in OBS (not program)
- [ ] Execute transition → preview becomes program
- [ ] UI updates to show dual preview/program layout

### 5. Fix OBSCurrentOutput Component (Priority: HIGH)

Currently shows placeholder. Needs complete implementation.

**Functional Requirements:**
- Display current program screenshot (not placeholder)
- Show current scene name
- Show stream status (live/offline, duration, bitrate)
- Show recording status (recording/stopped, duration, file size)
- Show dropped frames warning if > 0.1%
- Loading state while fetching screenshot
- Error state if screenshot fails

### 6. Connection Health Indicators (Priority: MEDIUM)

Visual feedback on OBS connection quality.

**Functional Requirements:**
- Show OBS WebSocket connection status (connected/disconnected/reconnecting)
- Show rendering stats (FPS, dropped frames percentage)
- Show encoding stats (CPU usage, encoding lag)
- Warning indicators for degraded performance
- Alert if OBS disconnects unexpectedly

**Test Cases:**
- [ ] Shows green indicator when OBS connected
- [ ] Shows red indicator when disconnected
- [ ] Shows yellow warning when dropped frames > 0.1%
- [ ] Shows encoding lag warning when > 100ms

### 7. Full-Screen Preview Mode (Priority: LOW)

Dedicated full-screen view for monitoring.

**Functional Requirements:**
- Click to expand preview to full-screen overlay
- Higher resolution in full-screen (1280x720 or native)
- ESC or click to exit full-screen
- Optional: Multi-monitor support (open in new window)

---

## Architecture Constraints (CRITICAL)

**See:** [README-OBS-Architecture.md](README-OBS-Architecture.md) for full details.

### Frontend NEVER Talks Directly to OBS

The frontend connects to the coordinator via Socket.io. The coordinator proxies all OBS commands to the appropriate competition VM. This solves the Mixed Content security issue (HTTPS page cannot connect to HTTP/WS endpoints).

```
Frontend → Socket.io → Coordinator → OBS WebSocket → Competition VM
Frontend ← Socket.io ← Coordinator ← OBS WebSocket ← Competition VM
```

### Two OBS Subsystems

| System | Used When | Purpose |
|--------|-----------|---------|
| `obsConnectionManager` | `compId !== 'local'` (production) | Per-competition OBS connections |
| `obsStateSync` | `compId === 'local'` (local dev) | Single local OBS connection |

Preview features MUST work with both systems.

### Routing via compId

All socket events are routed by the `compId` in the socket connection query. The coordinator uses this to determine which VM's OBS to communicate with.

---

## Architecture Options

### Option A: Socket-Based Screenshot (Recommended for MVP)
Screenshots requested via Socket.io, routed through coordinator to correct VM.

**Pros:**
- Uses existing coordinator proxy infrastructure
- Works in production (HTTPS → WSS → coordinator → VM)
- Consistent with all other OBS commands
- compId routing handled automatically

**Cons:**
- Latency (2+ seconds behind real-time)
- Bandwidth usage (50-100KB per screenshot at 640x360)
- CPU overhead on VM for each screenshot

**Implementation:**
```javascript
// Client-side polling via Socket.io (NOT REST)
useEffect(() => {
  const interval = setInterval(() => {
    // Socket already connected to coordinator with compId
    socket.emit('obs:requestScreenshot', {
      imageWidth: 640,
      imageHeight: 360,
      imageFormat: 'jpg'
    });
  }, 2000);

  // Receive screenshot data
  socket.on('obs:screenshotData', (data) => {
    setScreenshot(data.imageData);
  });

  return () => {
    clearInterval(interval);
    socket.off('obs:screenshotData');
  };
}, [socket]);
```

### Option B: WebRTC/NDI Streaming (Future Enhancement)
Real-time video stream from OBS to browser.

**Pros:**
- True real-time preview (< 500ms latency)
- Smooth video, not static images
- Lower bandwidth once stream established

**Cons:**
- Requires additional infrastructure (TURN server, media server)
- More complex to implement
- OBS NDI plugin or virtual output needed
- Network configuration for cloud VMs

**Not recommended for MVP** - too much infrastructure overhead.

### Option C: OBS Virtual Camera + Video Relay (Future)
Route OBS virtual camera output through a relay service.

**Pros:**
- Native OBS feature
- Real-time video

**Cons:**
- Requires virtual display driver on headless VM
- Complex setup

---

## Files to Modify

### Frontend (show-controller/src/)

| File | Action | Description |
|------|--------|-------------|
| `components/obs/OBSCurrentOutput.jsx` | **CREATE** | New component for program output display |
| `components/obs/OBSPreviewPanel.jsx` | **CREATE** | Scene preview with hover thumbnails |
| `components/obs/StudioModePanel.jsx` | **CREATE** | Dual preview/program layout for studio mode |
| `pages/OBSManager.jsx` | **MODIFY** | Integrate new preview components |
| `context/OBSContext.jsx` | **MODIFY** | Add screenshot state, studio mode methods, socket event handlers |
| `hooks/useAutoRefreshScreenshot.js` | **CREATE** | Socket-based auto-refresh hook with pause/resume |

### Coordinator (server/)

| File | Action | Description |
|------|--------|-------------|
| `server/index.js` | **MODIFY** | Add socket handlers for `obs:requestScreenshot`, studio mode events |
| `server/lib/obsConnectionManager.js` | **VERIFY** | Can call `GetSourceScreenshot` on per-competition connections |
| `server/lib/obsStateSync.js` | **VERIFY** | `takeScreenshot()` for local development |
| `server/routes/obs.js` | **KEEP** | REST endpoints kept for local development fallback |

### Key Implementation Requirement

**The coordinator must route screenshot requests to the correct VM.** The flow is:

1. Frontend emits `obs:requestScreenshot` via Socket.io
2. Coordinator extracts `compId` from socket handshake query
3. Coordinator gets OBS connection via `obsConnManager.getConnection(compId)`
4. Coordinator calls `GetSourceScreenshot` on that connection
5. Coordinator emits `obs:screenshotData` back to requesting client

---

## API Design

### Socket Events (Production - Recommended)

**All OBS operations in production MUST use Socket.io**, not REST APIs. The coordinator routes events to the correct VM based on the `compId` in the socket connection.

#### Client → Coordinator (via Socket.io)

| Event | Payload | Description |
|-------|---------|-------------|
| `obs:requestScreenshot` | `{ sceneName?, imageWidth?, imageHeight?, imageFormat? }` | Request screenshot of program output or specific scene |
| `obs:enableStudioMode` | - | Enter studio mode |
| `obs:disableStudioMode` | - | Exit studio mode |
| `obs:setPreviewScene` | `{ sceneName }` | Set preview scene (studio mode) |
| `obs:transitionToProgram` | `{ transitionName? }` | Execute transition (studio mode) |

#### Coordinator → Client (via Socket.io)

| Event | Payload | Description |
|-------|---------|-------------|
| `obs:screenshotData` | `{ success, imageData, sceneName?, timestamp }` | Screenshot response |
| `obs:screenshotError` | `{ error, sceneName? }` | Screenshot failed |
| `obs:studioModeChanged` | `{ enabled, previewScene, programScene }` | Studio mode state changed |
| `obs:previewSceneChanged` | `{ sceneName }` | Preview scene changed |

### REST Endpoints (Local Development Only)

**⚠️ These endpoints only work for local development** (`compId === 'local'`). They talk to `obsStateSync`, not `obsConnectionManager`.

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/api/obs/preview/screenshot` | Current output screenshot | ✅ Exists (local only) |
| GET | `/api/obs/preview/screenshot/:sceneName` | Scene screenshot | ✅ Exists (local only) |
| GET | `/api/obs/studio-mode` | Get studio mode status | ✅ Exists (local only) |
| PUT | `/api/obs/studio-mode` | Enable/disable studio mode | ✅ Exists (local only) |
| PUT | `/api/obs/studio-mode/preview` | Set preview scene | ✅ Exists (local only) |
| POST | `/api/obs/studio-mode/transition` | Execute transition | ✅ Exists (local only) |
| GET | `/api/obs/stream/status` | Get stream stats | ✅ Exists (local only) |

### Screenshot Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `imageFormat` | string | `png` | Format: `png` or `jpg` |
| `imageWidth` | number | 1920 | Output width in pixels |
| `imageHeight` | number | 1080 | Output height in pixels |
| `sceneName` | string | null | Specific scene to capture (null = program output) |

**Recommended sizes:**
- Thumbnail: 160x90 (fast, ~5KB)
- Preview: 640x360 (balanced, ~50KB)
- Full: 1280x720 (detailed, ~150KB)

---

## Response Schemas

### Screenshot Response
```json
{
  "success": true,
  "imageData": "data:image/png;base64,iVBORw0KGgo...",
  "format": "png",
  "sceneName": "Main Camera"  // Only for scene-specific screenshots
}
```

### Screenshot Error Response
```json
{
  "error": "Scene not found: Invalid Scene Name"
}
```

### Studio Mode Status Response
```json
{
  "success": true,
  "studioModeEnabled": true,
  "previewScene": "Scene 2",
  "programScene": "Scene 1"
}
```

### Stream Status Response (for health indicators)
```json
{
  "outputActive": true,
  "outputReconnecting": false,
  "outputTimecode": "01:23:45",
  "outputDuration": 5025000,
  "outputCongestion": 0.0,
  "outputBytes": 1234567890,
  "outputSkippedFrames": 0,
  "outputTotalFrames": 150750
}
```

---

## UI Design

### OBSCurrentOutput.jsx (Normal Mode)

```
┌─ PROGRAM OUTPUT ─────────────────────────────────────┐
│                                                       │
│  ┌─────────────────────────────┐  Scene: Main Camera │
│  │                             │  Transition: Fade   │
│  │                             │                     │
│  │    [Program Screenshot]     │  ● LIVE  01:23:45   │
│  │         640x360             │  6.2 Mbps           │
│  │                             │                     │
│  │                             │  Frames: 0 dropped  │
│  │  Click for full-screen      │  CPU: 12%           │
│  └─────────────────────────────┘                     │
│                                                       │
│  Auto-refresh: [●] 2s   Last update: 1s ago          │
│                                                       │
│  [📷 Save] [🔲 Full Screen] [🎬 Studio Mode]         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### With Studio Mode Enabled

```
┌─ STUDIO MODE ────────────────────────────────────────┐
│                                                       │
│  ┌─────────────────┐    ┌─────────────────┐         │
│  │    PREVIEW      │    │    PROGRAM      │         │
│  │    (Next)       │ ▶  │    (Live)       │         │
│  │                 │    │                 │         │
│  │  [Scene Image]  │    │  [Scene Image]  │         │
│  │                 │    │                 │         │
│  │  Replay Cam     │    │  Main Camera    │         │
│  │                 │    │                 │  ● LIVE │
│  └─────────────────┘    └─────────────────┘         │
│                                                       │
│  Transition: [Cut ▼] [▶ TAKE]  or  [Fade 500ms]     │
│                                                       │
│  [Exit Studio Mode]                                   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Scene List with Thumbnails

```
┌─ SCENES ─────────────────────────────────────────────┐
│                                                       │
│  ┌─────┐  Main Camera          ● LIVE                │
│  │thumb│  4 sources                                  │
│  └─────┘                                             │
│                                                       │
│  ┌─────┐  Replay Cam                                 │
│  │thumb│  2 sources            [Preview] [Edit]      │
│  └─────┘                                             │
│                                                       │
│  ┌─────┐  Graphics Only                              │
│  │thumb│  1 source             [Preview] [Edit]      │
│  └─────┘                                             │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Loading & Error States

```
┌─ PROGRAM OUTPUT ─────────────────────────────────────┐
│                                                       │
│  ┌─────────────────────────────┐                     │
│  │                             │                     │
│  │      ⟳ Loading...           │  Fetching preview   │
│  │                             │                     │
│  └─────────────────────────────┘                     │
│                                                       │
└───────────────────────────────────────────────────────┘

┌─ PROGRAM OUTPUT ─────────────────────────────────────┐
│                                                       │
│  ┌─────────────────────────────┐                     │
│  │                             │                     │
│  │   ⚠️ Screenshot Failed      │  OBS not connected  │
│  │      [Retry]                │                     │
│  │                             │                     │
│  └─────────────────────────────┘                     │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Socket Events Flow

### Screenshot Request Flow (Production)

```
Frontend                    Coordinator                      Competition VM
   │                            │                                 │
   │ emit('obs:requestScreenshot', {   │                         │
   │   imageWidth: 640,         │                                 │
   │   imageHeight: 360         │                                 │
   │ })                         │                                 │
   │ ─────────────────────────► │                                 │
   │                            │  // Get connection for compId   │
   │                            │  const compObs = obsConnManager │
   │                            │    .getConnection(compId)       │
   │                            │                                 │
   │                            │  compObs.call('GetSourceScreenshot', { │
   │                            │    sourceName: currentScene,    │
   │                            │    imageWidth: 640,             │
   │                            │    imageHeight: 360             │
   │                            │  })                             │
   │                            │ ──────────────────────────────► │
   │                            │                                 │
   │                            │ ◄────── { imageData: base64 } ─ │
   │                            │                                 │
   │ ◄── emit('obs:screenshotData', {  │                         │
   │       imageData: base64,   │                                 │
   │       timestamp: Date.now()│                                 │
   │     })                     │                                 │
   │                            │                                 │
```

### Studio Mode Flow (Production)

```
Frontend                    Coordinator                      Competition VM
   │                            │                                 │
   │ emit('obs:enableStudioMode')      │                         │
   │ ─────────────────────────► │                                 │
   │                            │  compObs.call('SetStudioModeEnabled', │
   │                            │    { studioModeEnabled: true }) │
   │                            │ ──────────────────────────────► │
   │                            │                                 │
   │                            │ ◄── OBS Event: StudioModeStateChanged ─ │
   │                            │                                 │
   │ ◄── emit('obs:studioModeChanged', │                         │
   │       { enabled: true,     │                                 │
   │         previewScene,      │                                 │
   │         programScene })    │                                 │
   │                            │                                 │
```

See [README-OBS-Architecture.md](README-OBS-Architecture.md#socket-event-flow) for complete event flow documentation.

---

## Implementation Notes

### useAutoRefreshScreenshot Hook (Socket-Based)
```javascript
// show-controller/src/hooks/useAutoRefreshScreenshot.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * Auto-refresh screenshot via Socket.io
 * @param {Object} options - Screenshot options
 * @param {number} options.intervalMs - Refresh interval (default 2000)
 * @param {string} options.sceneName - Optional scene name (null = current program)
 * @param {number} options.imageWidth - Image width (default 640)
 * @param {number} options.imageHeight - Image height (default 360)
 */
export function useAutoRefreshScreenshot(options = {}) {
  const { socket } = useShow();
  const {
    intervalMs = 2000,
    sceneName = null,
    imageWidth = 640,
    imageHeight = 360,
    imageFormat = 'jpg'
  } = options;

  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  // Request screenshot via socket
  const requestScreenshot = useCallback(() => {
    if (!socket || isPaused) return;
    setLoading(true);
    socket.emit('obs:requestScreenshot', {
      sceneName,
      imageWidth,
      imageHeight,
      imageFormat
    });
  }, [socket, isPaused, sceneName, imageWidth, imageHeight, imageFormat]);

  // Listen for screenshot responses
  useEffect(() => {
    if (!socket) return;

    const handleData = (data) => {
      if (data.success) {
        setImageData(data.imageData);
        setLastUpdated(new Date(data.timestamp));
        setError(null);
      }
      setLoading(false);
    };

    const handleError = (data) => {
      setError(data.error);
      setLoading(false);
    };

    socket.on('obs:screenshotData', handleData);
    socket.on('obs:screenshotError', handleError);

    return () => {
      socket.off('obs:screenshotData', handleData);
      socket.off('obs:screenshotError', handleError);
    };
  }, [socket]);

  // Pause when tab not visible
  useEffect(() => {
    const handleVisibility = () => {
      setIsPaused(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    requestScreenshot(); // Initial request
    intervalRef.current = setInterval(requestScreenshot, intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [requestScreenshot, intervalMs]);

  return {
    imageData,
    loading,
    error,
    lastUpdated,
    isPaused,
    setIsPaused,
    refresh: requestScreenshot
  };
}
```

### Screenshot Fetching (via Socket.io)
```javascript
// Request screenshot via Socket.io (production)
// The socket is already connected to coordinator with compId in query
const requestScreenshot = (socket, sceneName = null, size = 'preview') => {
  const sizes = {
    thumbnail: { w: 160, h: 90 },
    preview: { w: 640, h: 360 },
    full: { w: 1280, h: 720 }
  };
  const { w, h } = sizes[size];

  socket.emit('obs:requestScreenshot', {
    sceneName,  // null = current program output
    imageWidth: w,
    imageHeight: h,
    imageFormat: 'jpg'
  });
};

// In OBSContext or component:
useEffect(() => {
  socket.on('obs:screenshotData', (data) => {
    if (data.success) {
      setScreenshot(data.imageData);
      setLastUpdated(data.timestamp);
    }
  });

  socket.on('obs:screenshotError', (data) => {
    setError(data.error);
  });

  return () => {
    socket.off('obs:screenshotData');
    socket.off('obs:screenshotError');
  };
}, [socket]);
```

### OBS WebSocket Call (Server Side - Coordinator)
```javascript
// In server/index.js - socket handler for obs:requestScreenshot
socket.on('obs:requestScreenshot', async (options = {}) => {
  const { sceneName, imageWidth = 640, imageHeight = 360, imageFormat = 'jpg' } = options;
  const clientCompId = socket.handshake?.query?.compId;

  try {
    // PRODUCTION: Use obsConnectionManager for competition-based connections
    if (clientCompId && clientCompId !== 'local') {
      const compObs = obsConnManager.getConnection(clientCompId);
      if (!compObs) {
        socket.emit('obs:screenshotError', { error: 'OBS not connected for this competition' });
        return;
      }

      // Get current scene if no sceneName provided
      const targetScene = sceneName || (await compObs.call('GetCurrentProgramScene')).currentProgramSceneName;

      const result = await compObs.call('GetSourceScreenshot', {
        sourceName: targetScene,
        imageFormat,
        imageWidth,
        imageHeight
      });

      socket.emit('obs:screenshotData', {
        success: true,
        imageData: result.imageData,
        sceneName: targetScene,
        timestamp: Date.now()
      });
    }
    // LOCAL DEV: Use obsStateSync
    else if (obsStateSync && obsStateSync.isInitialized()) {
      const result = await obsStateSync.takeScreenshot(sceneName, { imageWidth, imageHeight, imageFormat });
      socket.emit('obs:screenshotData', {
        success: true,
        imageData: result.imageData,
        sceneName: result.sceneName,
        timestamp: Date.now()
      });
    } else {
      socket.emit('obs:screenshotError', { error: 'OBS not connected' });
    }
  } catch (error) {
    socket.emit('obs:screenshotError', { error: error.message, sceneName });
  }
});
```

### Performance Considerations
1. **Use JPEG for auto-refresh** - ~60% smaller than PNG, faster transfer
2. **Use smaller dimensions** - 640x360 is sufficient for preview
3. **Pause when hidden** - Don't waste bandwidth on hidden tabs
4. **Debounce rapid requests** - Prevent overwhelming the VM
5. **Cache scene thumbnails** - Only refresh on scene change events

---

## Acceptance Criteria

### Must Have (MVP)
- [ ] Screenshot of program output works via API
- [ ] Screenshot displays in OBSCurrentOutput component (not placeholder)
- [ ] Auto-refresh with configurable interval (default 2s)
- [ ] Loading and error states displayed appropriately
- [ ] Stream status (live/offline, duration) shown
- [ ] Manual refresh button works

### Should Have
- [ ] Screenshot of specific scene works
- [ ] Enable/disable studio mode works
- [ ] Studio mode UI shows preview + program side by side
- [ ] Preview scene can be set
- [ ] Transition to program works
- [ ] Scene thumbnails in scene list
- [ ] Dropped frames warning indicator

### Nice to Have
- [ ] Full-screen preview mode
- [ ] Scene hover preview
- [ ] Thumbnail caching
- [ ] Recording status display
- [ ] CPU/encoding stats

---

## Test Plan

### Unit Tests (Socket.io Based)

```javascript
// TEST-41: Preview system - Screenshot via Socket.io
describe('Screenshot Socket Events', () => {
  let socket;

  beforeEach(() => {
    // Connect to coordinator with compId
    socket = io('https://api.commentarygraphic.com', {
      query: { compId: 'test-competition' }
    });
  });

  afterEach(() => {
    socket.disconnect();
  });

  test('obs:requestScreenshot returns base64 image via obs:screenshotData', (done) => {
    socket.on('obs:screenshotData', (data) => {
      expect(data.success).toBe(true);
      expect(data.imageData).toMatch(/^data:image\/(png|jpeg);base64,/);
      expect(data.timestamp).toBeDefined();
      done();
    });

    socket.emit('obs:requestScreenshot', {
      imageWidth: 640,
      imageHeight: 360,
      imageFormat: 'jpg'
    });
  });

  test('obs:requestScreenshot with sceneName returns specific scene', (done) => {
    socket.on('obs:screenshotData', (data) => {
      expect(data.success).toBe(true);
      expect(data.sceneName).toBe('Main Camera');
      done();
    });

    socket.emit('obs:requestScreenshot', {
      sceneName: 'Main Camera',
      imageWidth: 640,
      imageHeight: 360
    });
  });

  test('Invalid scene emits obs:screenshotError', (done) => {
    socket.on('obs:screenshotError', (data) => {
      expect(data.error).toContain('not found');
      done();
    });

    socket.emit('obs:requestScreenshot', {
      sceneName: 'NonexistentScene'
    });
  });
});
```

```javascript
// TEST-42: Studio mode via Socket.io
describe('Studio Mode Socket Events', () => {
  let socket;

  beforeEach(() => {
    socket = io('https://api.commentarygraphic.com', {
      query: { compId: 'test-competition' }
    });
  });

  afterEach(() => {
    socket.disconnect();
  });

  test('obs:enableStudioMode triggers obs:studioModeChanged', (done) => {
    socket.on('obs:studioModeChanged', (data) => {
      expect(data.enabled).toBe(true);
      expect(data.previewScene).toBeDefined();
      expect(data.programScene).toBeDefined();
      done();
    });

    socket.emit('obs:enableStudioMode');
  });

  test('obs:setPreviewScene updates preview', (done) => {
    socket.on('obs:previewSceneChanged', (data) => {
      expect(data.sceneName).toBe('Scene 2');
      done();
    });

    socket.emit('obs:setPreviewScene', { sceneName: 'Scene 2' });
  });

  test('obs:transitionToProgram executes transition', (done) => {
    socket.on('obs:studioModeChanged', (data) => {
      // After transition, the preview should become program
      done();
    });

    socket.emit('obs:transitionToProgram');
  });

  test('obs:disableStudioMode exits studio mode', (done) => {
    socket.on('obs:studioModeChanged', (data) => {
      expect(data.enabled).toBe(false);
      done();
    });

    socket.emit('obs:disableStudioMode');
  });
});
```

### Integration Tests (Playwright)

```javascript
// TEST-43: Preview UI
describe('Preview UI', () => {
  test('OBSCurrentOutput displays screenshot', async ({ page }) => {
    await page.goto('/obs');

    // Wait for component to load
    await page.waitForSelector('[data-testid="obs-current-output"]');

    // Should NOT show placeholder text
    const placeholder = await page.locator('text=Preview placeholder');
    await expect(placeholder).not.toBeVisible();

    // Should show an image
    const screenshot = await page.locator('[data-testid="program-screenshot"] img');
    await expect(screenshot).toBeVisible();
  });

  test('Auto-refresh updates screenshot', async ({ page }) => {
    await page.goto('/obs');

    // Get initial timestamp
    const initialTimestamp = await page.locator('[data-testid="last-updated"]').textContent();

    // Wait for auto-refresh
    await page.waitForTimeout(3000);

    // Timestamp should have changed
    const newTimestamp = await page.locator('[data-testid="last-updated"]').textContent();
    expect(newTimestamp).not.toBe(initialTimestamp);
  });

  test('Studio mode toggle works', async ({ page }) => {
    await page.goto('/obs');

    // Click studio mode button
    await page.click('[data-testid="studio-mode-toggle"]');

    // Should show dual preview/program layout
    await expect(page.locator('[data-testid="preview-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="program-panel"]')).toBeVisible();
  });
});
```

### Manual Verification Checklist
1. [ ] Open OBS Manager page
2. [ ] Verify program screenshot displays (not placeholder)
3. [ ] Wait 5 seconds - verify screenshot refreshes automatically
4. [ ] Click "Pause" - verify auto-refresh stops
5. [ ] Click "Refresh" - verify manual refresh works
6. [ ] Enable studio mode → verify UI shows preview/program split
7. [ ] Click scene in list → verify goes to preview (not live)
8. [ ] Click "Take" transition → verify preview becomes program
9. [ ] Check stream status shows when streaming
10. [ ] Verify error state when OBS disconnected

---

## Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| OBS not connected | Show "OBS Not Connected" with retry button |
| Screenshot fails | Show error message, retry on next interval |
| Scene not found | Return 404, show scene name in error |
| Studio mode not enabled (for preview ops) | Return 400 with clear error message |
| Network timeout | Show timeout error, retry automatically |
| Invalid image data | Show fallback placeholder, log error |

---

## Definition of Done

### Code Complete
- [ ] OBSCurrentOutput component created and functional
- [ ] Auto-refresh hook implemented
- [ ] Studio mode UI implemented
- [ ] All loading/error states handled
- [ ] Stream status displayed

### Testing Complete
- [ ] TEST-41 passes (preview screenshot API)
- [ ] TEST-42 passes (studio mode API)
- [ ] TEST-43 passes (UI integration tests)
- [ ] Manual verification checklist passed

### Quality
- [ ] No console errors in browser
- [ ] Performance: screenshot fetch < 2 seconds
- [ ] Responsive design (works on tablet/mobile)
- [ ] Accessibility: keyboard navigation, screen reader support
- [ ] Code reviewed and merged to dev

---

## Future Enhancements (Out of Scope)

1. **WebRTC Live Preview** - True real-time video stream instead of screenshots
2. **Multi-VM Preview** - Show outputs from multiple OBS instances simultaneously
3. **Recording Playback** - Preview recordings from within the app
4. **Scene Comparison** - Side-by-side before/after for template changes
5. **Mobile App Preview** - Dedicated mobile view for monitoring on the go
