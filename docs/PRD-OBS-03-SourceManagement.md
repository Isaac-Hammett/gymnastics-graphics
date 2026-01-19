# PRD-OBS-03: Source Management

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01, PRD-OBS-02
**Blocks:** PRD-OBS-08 (Templates)

---

## Overview

Source/input management within scenes - add, remove, transform, edit settings. **This feature is BROKEN** (TEST-35/36 failed). Needs debugging and fixing.

---

## Current State

### What Exists
- `server/lib/obsSourceManager.js` (596 lines) - Source CRUD
- `show-controller/src/components/obs/SourceEditor.jsx` - Source settings UI
- `show-controller/src/components/obs/SceneEditor.jsx` - Scene item management
- Routes: GET/POST/PUT/DELETE `/api/obs/inputs/*` and `/api/obs/scenes/:name/items/*`

### Known Failures
- **TEST-35**: Browser source editing - FAILED
- **TEST-36**: SRT/Media source editing - FAILED

### Suspected Issues
1. SourceEditor component may not properly call socket/API on save
2. Socket handlers for source updates may be missing
3. Transform updates may not persist correctly

---

## Requirements

### 1. Fix Source Settings Editing

**Browser Source Settings:**
```json
{
  "url": "http://localhost:5173/graphics",
  "width": 1920,
  "height": 1080,
  "css": "",
  "shutdown": false,
  "restart_when_active": false
}
```

**SRT/Media Source Settings:**
```json
{
  "input": "srt://nimble.local:10001",
  "buffering_mb": 2,
  "reconnect_delay_sec": 5,
  "hw_decode": true,
  "is_local_file": false
}
```

**Test Cases:**
- [ ] Edit browser source URL → OBS updates
- [ ] Edit browser source dimensions → OBS updates
- [ ] Edit SRT source URL → OBS updates
- [ ] Edit SRT buffering settings → OBS updates

### 2. Fix Scene Item Transform

Transform properties:
- Position (X, Y)
- Scale (X, Y)
- Rotation
- Crop (Top, Bottom, Left, Right)
- Visibility
- Lock state

**Test Cases:**
- [ ] Move source position → OBS updates
- [ ] Scale source → OBS updates
- [ ] Crop source → OBS updates
- [ ] Toggle visibility → source shows/hides
- [ ] Toggle lock → transform locked/unlocked

### 3. Transform Presets

Quick-apply presets for common layouts:

| Preset | Position | Scale | Use Case |
|--------|----------|-------|----------|
| `fullscreen` | 0, 0 | 1.0, 1.0 | Full canvas |
| `dual16x9Left` | 0, 270 | 0.5, 0.5 | Left side-by-side |
| `dual16x9Right` | 960, 270 | 0.5, 0.5 | Right side-by-side |
| `quadTopLeft` | 0, 0 | 0.5, 0.5 | Quad view |
| `pip` | 1440, 810 | 0.25, 0.25 | Picture-in-picture |

**Test Cases:**
- [ ] Apply fullscreen preset → source fills canvas
- [ ] Apply dual preset → source positioned correctly
- [ ] Apply pip preset → source in corner

### 4. Add/Remove Sources from Scene

**Test Cases:**
- [ ] Add existing source to scene → appears in scene
- [ ] Create new source and add → source created and added
- [ ] Remove source from scene → source removed (input still exists)
- [ ] Delete source entirely → removed from all scenes

### 5. Source Layer Ordering (Z-Index)

**Test Cases:**
- [ ] Reorder source up → moves in front
- [ ] Reorder source down → moves behind
- [ ] Drag-to-reorder in UI → updates correctly

---

## Files to Debug/Fix

| File | Suspected Issue |
|------|-----------------|
| `show-controller/src/components/obs/SourceEditor.jsx` | Not calling API/socket on save |
| `server/routes/obs.js` | Check PUT `/api/obs/inputs/:inputName` |
| `server/lib/obsSourceManager.js` | Verify `updateInputSettings()` |
| `server/index.js` | Check socket handlers for source events |

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/inputs` | List all inputs |
| GET | `/api/obs/inputs/kinds` | List input types |
| POST | `/api/obs/inputs` | Create input |
| GET | `/api/obs/inputs/:inputName` | Get input settings |
| PUT | `/api/obs/inputs/:inputName` | **FIX: Update settings** |
| DELETE | `/api/obs/inputs/:inputName` | Delete input |
| POST | `/api/obs/scenes/:name/items` | Add source to scene |
| DELETE | `/api/obs/scenes/:name/items/:id` | Remove from scene |
| PUT | `/api/obs/scenes/:name/items/:id/transform` | **FIX: Update transform** |
| PUT | `/api/obs/scenes/:name/items/:id/enabled` | Toggle visibility |

---

## Debugging Steps

### Step 1: Check API Works
```bash
# Test updating a browser source
curl -X PUT http://localhost:3000/api/obs/inputs/GraphicsOverlay \
  -H "Content-Type: application/json" \
  -d '{"inputSettings": {"url": "http://localhost:5173/test"}}'
```

### Step 2: Check Socket Handler
Look for handler in `server/index.js`:
```javascript
socket.on('obs:updateInputSettings', ...)
```

### Step 3: Check Frontend Calls
In SourceEditor.jsx, verify `onSave` calls the API or socket.

---

## Acceptance Criteria

- [ ] Browser source URL can be edited
- [ ] SRT source URL can be edited
- [ ] Source position/scale can be changed
- [ ] Transform presets work
- [ ] Add/remove sources from scenes works
- [ ] Layer reordering works
- [ ] All changes sync to other clients

---

## Test Plan

### Playwright Tests to Fix
```javascript
// TEST-35: Browser source editing
test('can edit browser source URL', async () => {
  // Navigate to scene with browser source
  // Open source editor
  // Change URL
  // Save
  // Verify OBS received update
});

// TEST-36: SRT source editing
test('can edit SRT source URL', async () => {
  // Similar to above
});
```

### Manual Verification
1. Open OBS Manager → click scene → click source
2. Edit source URL → save
3. Check OBS directly to verify change applied

---

## Definition of Done

1. TEST-35 passes (browser source editing)
2. TEST-36 passes (SRT source editing)
3. Transform editing works
4. Add/remove sources works
5. Multi-client sync works
6. Code reviewed and merged
