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

## Architecture Options

### Option A: Screenshot Polling (Recommended for MVP)
Simple polling approach - request screenshots at regular intervals.

**Pros:**
- Simple to implement
- Works with existing infrastructure
- No additional server-side changes needed

**Cons:**
- Latency (2+ seconds behind real-time)
- Bandwidth usage (50-100KB per screenshot at 640x360)
- CPU overhead on VM for each screenshot

**Implementation:**
```javascript
// Client-side polling
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch('/api/obs/preview/screenshot?imageWidth=640&imageHeight=360');
    const data = await response.json();
    setScreenshot(data.imageData);
  }, 2000);
  return () => clearInterval(interval);
}, []);
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

| File | Action | Description |
|------|--------|-------------|
| `show-controller/src/components/obs/OBSCurrentOutput.jsx` | **CREATE** | New component for program output display |
| `show-controller/src/components/obs/OBSPreviewPanel.jsx` | **CREATE** | Scene preview with hover thumbnails |
| `show-controller/src/components/obs/StudioModePanel.jsx` | **CREATE** | Dual preview/program layout for studio mode |
| `show-controller/src/pages/OBSManager.jsx` | **MODIFY** | Integrate new preview components |
| `show-controller/src/context/OBSContext.jsx` | **MODIFY** | Add screenshot state, auto-refresh logic |
| `show-controller/src/hooks/useAutoRefresh.js` | **CREATE** | Reusable auto-refresh hook with pause/resume |
| `server/routes/obs.js` | **VERIFY** | Screenshot endpoints exist (lines 2031-2103) |
| `server/lib/obsStateSync.js` | **VERIFY** | `takeScreenshot()` method implementation |

---

## API Endpoints

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/api/obs/preview/screenshot` | Current output screenshot | ✅ Exists |
| GET | `/api/obs/preview/screenshot/:sceneName` | Scene screenshot | ✅ Exists |
| GET | `/api/obs/studio-mode` | Get studio mode status | ✅ Exists |
| PUT | `/api/obs/studio-mode` | Enable/disable studio mode | ✅ Exists |
| PUT | `/api/obs/studio-mode/preview` | Set preview scene | ✅ Exists |
| POST | `/api/obs/studio-mode/transition` | Execute transition | ✅ Exists |
| GET | `/api/obs/stream/status` | Get stream stats (bitrate, dropped frames) | ✅ Exists |

### Query Parameters for Screenshot

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `imageFormat` | string | `png` | Format: `png` or `jpg` |
| `imageWidth` | number | 1920 | Output width in pixels |
| `imageHeight` | number | 1080 | Output height in pixels |

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

## Socket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `obs:takeScreenshot` | `{ sceneName? }` | Request screenshot (downloads as file) |
| `obs:enableStudioMode` | - | Enter studio mode |
| `obs:disableStudioMode` | - | Exit studio mode |
| `obs:setPreviewScene` | `{ sceneName }` | Set preview scene |
| `obs:transitionToProgram` | - | Execute transition |
| `obs:refreshState` | - | Request full state refresh |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `obs:screenshotCaptured` | `{ imageData, sceneName, timestamp }` | Screenshot data (triggers download) |
| `obs:studioModeChanged` | `{ enabled, previewScene, programScene }` | Studio mode state changed |
| `obs:previewSceneChanged` | `{ sceneName }` | Preview scene changed |
| `obs:error` | `{ message }` | Error occurred |

---

## Implementation Notes

### useAutoRefresh Hook
```javascript
// show-controller/src/hooks/useAutoRefresh.js
import { useState, useEffect, useCallback, useRef } from 'react';

export function useAutoRefresh(fetchFn, intervalMs = 2000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    if (isPaused) return;
    setLoading(true);
    try {
      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, isPaused]);

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
    refresh(); // Initial fetch
    intervalRef.current = setInterval(refresh, intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [refresh, intervalMs]);

  return { data, loading, error, lastUpdated, isPaused, setIsPaused, refresh };
}
```

### Screenshot Fetching
```javascript
// Fetch screenshot via REST API (not socket)
const fetchScreenshot = async (sceneName = null, size = 'preview') => {
  const sizes = {
    thumbnail: { w: 160, h: 90 },
    preview: { w: 640, h: 360 },
    full: { w: 1280, h: 720 }
  };
  const { w, h } = sizes[size];

  const url = sceneName
    ? `/api/obs/preview/screenshot/${encodeURIComponent(sceneName)}?imageWidth=${w}&imageHeight=${h}&imageFormat=jpg`
    : `/api/obs/preview/screenshot?imageWidth=${w}&imageHeight=${h}&imageFormat=jpg`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Screenshot failed');
  return response.json();
};
```

### OBS WebSocket Call (Server Side)
```javascript
// Already implemented in obsStateSync.js
const screenshot = await obs.call('GetSourceScreenshot', {
  sourceName: sceneName || currentScene,
  imageFormat: 'png',
  imageWidth: 640,
  imageHeight: 360
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

### Unit Tests

```javascript
// TEST-41: Preview system - Screenshot API
describe('Screenshot API', () => {
  test('GET /api/obs/preview/screenshot returns base64 image', async () => {
    const response = await fetch('/api/obs/preview/screenshot');
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.imageData).toMatch(/^data:image\/(png|jpeg);base64,/);
  });

  test('GET /api/obs/preview/screenshot/:sceneName returns scene screenshot', async () => {
    const response = await fetch('/api/obs/preview/screenshot/Main%20Camera');
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.sceneName).toBe('Main Camera');
  });

  test('Screenshot with custom dimensions', async () => {
    const response = await fetch('/api/obs/preview/screenshot?imageWidth=320&imageHeight=180');
    expect(response.ok).toBe(true);
  });

  test('Invalid scene returns 404', async () => {
    const response = await fetch('/api/obs/preview/screenshot/NonexistentScene');
    expect(response.status).toBe(404);
  });
});
```

```javascript
// TEST-42: Studio mode
describe('Studio Mode', () => {
  test('Enable studio mode', async () => {
    const response = await fetch('/api/obs/studio-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true })
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.studioModeEnabled).toBe(true);
  });

  test('Set preview scene', async () => {
    const response = await fetch('/api/obs/studio-mode/preview', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneName: 'Scene 2' })
    });
    expect(response.ok).toBe(true);
  });

  test('Execute transition', async () => {
    const response = await fetch('/api/obs/studio-mode/transition', {
      method: 'POST'
    });
    expect(response.ok).toBe(true);
  });

  test('Disable studio mode', async () => {
    const response = await fetch('/api/obs/studio-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false })
    });
    expect(response.ok).toBe(true);
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
