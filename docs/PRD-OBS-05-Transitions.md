# PRD-OBS-05: Transition Management

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** None

---

## Overview

Transition management - list, select, configure duration, stinger setup. **UI is a placeholder** ("Transitions coming soon"). Backend routes exist but are untested.

---

## Current State

### What Exists
- `server/lib/obsTransitionManager.js` (172 lines) - Transition logic
- Routes in `server/routes/obs.js` - Transition endpoints
- **NO UI component** - Just placeholder text

### Test Results
- Tests: ⏭️ SKIPPED (placeholder tests only)

---

## Requirements

### 1. List Available Transitions

OBS default transitions:
- Cut (instant)
- Fade (configurable duration)
- Slide
- Swipe
- Stinger (custom video transition)

**Test Cases:**
- [ ] List transitions → shows all available
- [ ] Each transition shows configurable status

### 2. Set Current Transition

**Test Cases:**
- [ ] Select transition → OBS default changes
- [ ] Scene switch uses selected transition

### 3. Set Transition Duration

Duration in milliseconds (typically 300-1000ms).

**Test Cases:**
- [ ] Set duration to 500ms → OBS updates
- [ ] Duration persists across scene switches

### 4. Stinger Transition Configuration

Stinger transitions use a video file with a "transition point" - the frame where the new scene should appear.

**Settings:**
```json
{
  "path": "/var/www/assets/stingers/main.webm",
  "transition_point": 250,
  "monitoring_type": "OBS_MONITORING_TYPE_NONE",
  "audio_fade_style": "OBS_TRANSITION_AUDIO_FADE_OUT"
}
```

**Test Cases:**
- [ ] Set stinger path → OBS loads video
- [ ] Set transition point → scene appears at correct frame
- [ ] Stinger plays on scene switch

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `show-controller/src/components/obs/TransitionPicker.jsx` | **CREATE** |
| `server/lib/obsTransitionManager.js` | Verify/test |
| `server/routes/obs.js` | Verify transition endpoints |

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/transitions` | List transitions |
| GET | `/api/obs/transitions/current` | Get current |
| PUT | `/api/obs/transitions/current` | Set current |
| PUT | `/api/obs/transitions/duration` | Set duration |
| GET | `/api/obs/transitions/:name/settings` | Get settings |
| PUT | `/api/obs/transitions/:name/settings` | Update settings |
| POST | `/api/obs/transitions/stinger` | Configure stinger |

---

## UI Design

### TransitionPicker.jsx

```
┌─ TRANSITIONS ────────────────────────────────────────┐
│                                                       │
│  Current Transition: [Fade ▼]                        │
│  Duration: [500] ms                                   │
│                                                       │
│  ─── Available Transitions ─────────────────────────  │
│                                                       │
│  ○ Cut          (instant)                            │
│  ● Fade         (configurable)      [500ms]          │
│  ○ Slide        (configurable)      [500ms]          │
│  ○ Stinger      (custom video)      [Configure]      │
│                                                       │
│  ─── Stinger Configuration ─────────────────────────  │
│                                                       │
│  Video: /var/www/assets/stingers/main.webm           │
│  Transition Point: [250] ms                           │
│                                                       │
│  [Upload New Stinger]                                 │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] TransitionPicker component created
- [ ] List all available transitions
- [ ] Select transition updates OBS default
- [ ] Duration slider/input works
- [ ] Stinger configuration works
- [ ] Changes sync to other clients

---

## Test Plan

### Manual Tests
1. Open OBS Manager → Transitions tab
2. Select different transition → verify in OBS
3. Change duration → verify in OBS
4. Switch scenes → verify transition plays

### Automated Tests
```javascript
test('can set transition to Fade', async () => {
  // Select Fade transition
  // Verify OBS default changed
});

test('can set transition duration', async () => {
  // Set duration to 750ms
  // Verify OBS duration changed
});
```

---

## Definition of Done

1. TransitionPicker component implemented
2. All transition operations work
3. Stinger configuration works
4. Multi-client sync works
5. Tests pass
6. Code reviewed and merged
