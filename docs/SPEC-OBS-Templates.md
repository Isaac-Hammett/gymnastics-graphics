# OBS Template Specification

**Version:** 1.0
**Date:** 2026-01-19
**Source:** Analyzed from `20260119-obs-template-ai-dual.json` and `20260119-obs-template-ai-quad.json`

---

## Overview

This document defines the OBS scene templates for gymnastics broadcasts. Templates are competition-type aware and define:
- Scene names and categories
- Source/input requirements
- Layer ordering (z-index)
- Transform presets for camera positioning
- Variable sources that change per competition

---

## Template Types

| Template | Cameras | Scenes | Use Case |
|----------|---------|--------|----------|
| Dual Meet | 2 | 9 | mens-dual, womens-dual |
| Quad Meet | 4 | 22 | mens-quad, womens-quad, mens-tri, womens-tri |

**Note:** Quad template covers tri meets (just don't use Camera D scenes).

---

## Camera Naming Convention

Templates use `Camera A`, `Camera B`, `Camera C`, `Camera D` which map to:

| Template Name | System ID | Description |
|---------------|-----------|-------------|
| Camera A | cam-1 | Primary camera (also used for venue audio) |
| Camera B | cam-2 | Secondary camera |
| Camera C | cam-3 | Third camera (quad/tri only) |
| Camera D | cam-4 | Fourth camera (quad only) |

**Apparatus assignment** is done at runtime by the producer, not in templates.

---

## Source/Input Definitions

### Camera Sources (SRT)

| Source Name | Type | Settings | Notes |
|-------------|------|----------|-------|
| Camera A | `ffmpeg_source` | SRT URL from config | Primary + audio source |
| Camera B | `ffmpeg_source` | SRT URL from config | |
| Camera C | `ffmpeg_source` | SRT URL from config | Quad/tri only |
| Camera D | `ffmpeg_source` | SRT URL from config | Quad only |

```json
{
  "inputKind": "ffmpeg_source",
  "inputSettings": {
    "input": "{{cameras.cam-1.srtUrl}}",
    "is_local_file": false,
    "buffering_mb": 2,
    "reconnect_delay_sec": 5,
    "hw_decode": true
  }
}
```

### Talent Sources (VDO.Ninja) - VARIABLE PER COMPETITION

| Source Name | Type | Purpose |
|-------------|------|---------|
| Talent-1 | `browser_source` | Primary commentator video feed |
| Talent-2 | `browser_source` | Secondary commentator video feed |

```json
{
  "inputKind": "browser_source",
  "inputSettings": {
    "url": "{{talentComms.vdoNinja.obsSceneUrl}}&view=talent1",
    "width": 1920,
    "height": 1080,
    "fps": 30
  }
}
```

**URL Generation:** System generates VDO.Ninja room per competition. Producer copies talent invite links to share.

### Graphics Sources (Browser)

| Source Name | Type | Purpose |
|-------------|------|---------|
| Web Graphics Overlay | `browser_source` | Main graphics overlay (lower thirds, scores) |
| stream-starting-soon-locked-url | `browser_source` | Starting soon graphic |
| thanks for watching | `browser_source` | End stream graphic |

```json
{
  "inputKind": "browser_source",
  "inputSettings": {
    "url": "{{config.graphicsOverlay.url}}",
    "width": 1920,
    "height": 1080,
    "fps": 30
  }
}
```

### Media Sources

| Source Name | Type | Purpose |
|-------------|------|---------|
| Background Loop | `ffmpeg_source` | Looping background video |
| Music | `ffmpeg_source` | Background music for breaks |

### Overlay Images

| Source Name | Type | Purpose |
|-------------|------|---------|
| dual view overlay | `image_source` | Frame/border for dual camera layout |
| tri-view-overlay | `image_source` | Frame/border for triple camera layout |
| quad-view-overlay | `image_source` | Frame/border for quad camera layout |

### Replay Sources

| Source Name | Type | Purpose |
|-------------|------|---------|
| replay - cam 1 | `ffmpeg_source` | Replay video for Camera A |
| replay - cam 2 | `ffmpeg_source` | Replay video for Camera B |
| replay - cam 3 | `ffmpeg_source` | Replay video for Camera C (quad) |
| replay - cam 4 | `ffmpeg_source` | Replay video for Camera D (quad) |

---

## Transform Presets (1920x1080 Canvas)

### Existing Presets (Keep)

| Preset | Position | Scale | Size | Use |
|--------|----------|-------|------|-----|
| `fullscreen` | (0, 0) | 1.0 | 1920x1080 | Single camera, backgrounds |
| `dualLeft` | (0, 0) | 0.5 | 960x1080 | Dual view left camera |
| `dualRight` | (960, 0) | 0.5 | 960x1080 | Dual view right camera |
| `quadTopLeft` | (0, 0) | 0.5 | 960x540 | Quad view top-left |
| `quadTopRight` | (960, 0) | 0.5 | 960x540 | Quad view top-right |
| `quadBottomLeft` | (0, 540) | 0.5 | 960x540 | Quad view bottom-left |
| `quadBottomRight` | (960, 540) | 0.5 | 960x540 | Quad view bottom-right |

### New Presets (Add)

| Preset | Position | Scale | Size | Use |
|--------|----------|-------|------|-----|
| `triTopLeft` | (41, 12) | 0.479 | ~919x517 | Triple view top-left |
| `triTopRight` | (960, 12) | 0.479 | ~919x517 | Triple view top-right |
| `triBottomCenter` | (501, 521.5) | 0.479 | ~919x517 | Triple view bottom-center |

### Deprecated Presets (Remove)

| Preset | Reason |
|--------|--------|
| `tripleMain` | Replaced by 2-over-1 layout |
| `tripleTopRight` | Replaced by 2-over-1 layout |
| `tripleBottomRight` | Replaced by 2-over-1 layout |

---

## Layout Diagrams

### Single Camera (Fullscreen)
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       Camera A/B/C/D                        │
│                       (fullscreen)                          │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
  + Web Graphics Overlay (on top)
```

### Dual View (Side by Side)
```
┌──────────────────────────┬──────────────────────────┐
│                          │                          │
│        Camera A          │        Camera B          │
│       (dualLeft)         │       (dualRight)        │
│                          │                          │
│                          │                          │
└──────────────────────────┴──────────────────────────┘
  + dual view overlay (frame)
  + Web Graphics Overlay (on top)
```

### Triple View (2 Over 1)
```
┌────────────────────────┬────────────────────────┐
│                        │                        │
│      Camera A          │      Camera B          │
│    (triTopLeft)        │    (triTopRight)       │
│                        │                        │
├────────────────────────┴────────────────────────┤
│                                                  │
│                   Camera C                       │
│              (triBottomCenter)                   │
│                                                  │
└─────────────────────────────────────────────────┘
  + tri-view-overlay (frame)
  + Web Graphics Overlay (on top)
```

### Quad View (2x2 Grid)
```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│     Camera A         │     Camera B         │
│   (quadTopLeft)      │   (quadTopRight)     │
│                      │                      │
├──────────────────────┼──────────────────────┤
│                      │                      │
│     Camera C         │     Camera D         │
│  (quadBottomLeft)    │  (quadBottomRight)   │
│                      │                      │
└──────────────────────┴──────────────────────┘
  + quad-view-overlay (frame)
  + Web Graphics Overlay (on top)
```

---

## Scene Definitions

### DUAL MEET Template (9 Scenes)

#### Static Scenes

| Scene | Category | Sources (bottom → top) |
|-------|----------|------------------------|
| Stream Starting Soon | `static` | Background Loop, Music, stream-starting-soon-locked-url |
| End Stream | `static` | Background Loop, Music, thanks for watching |

#### Single Camera Scenes

| Scene | Category | Sources (bottom → top) |
|-------|----------|------------------------|
| Full Screen - Camera A | `single` | Background Loop, Camera A (fullscreen), Talent-1, Talent-2, Web Graphics Overlay |
| Full Screen - Camera B | `single` | Background Loop, Camera A (audio, hidden), Camera B (fullscreen), Talent-1, Talent-2, Web Graphics Overlay |

#### Dual Camera Scenes

| Scene | Category | Sources (bottom → top) |
|-------|----------|------------------------|
| Dual View - Camera A - Left | `dual` | Background Loop, Camera A (dualLeft), Camera B (dualRight), dual view overlay, Talent-1, Talent-2, Web Graphics Overlay |
| Dual View - Camera A - Right | `dual` | Background Loop, Camera B (dualLeft), Camera A (dualRight), dual view overlay, Talent-1, Talent-2, Web Graphics Overlay |

#### Replay Scenes

| Scene | Category | Sources (bottom → top) |
|-------|----------|------------------------|
| Replay - Camera A | `replay` | Background Loop, Camera A (audio, hidden), replay - cam 1 (fullscreen), Talent-1, Talent-2 |
| Replay - Camera B | `replay` | Background Loop, Camera A (audio, hidden), replay - cam 2 (fullscreen), Talent-1, Talent-2 |

#### Graphics Only

| Scene | Category | Sources (bottom → top) |
|-------|----------|------------------------|
| Web-graphics-only-no-video | `graphics` | Background Loop, Music, Talent-1, Talent-2, Web Graphics Overlay |

---

### QUAD MEET Template (22 Scenes)

#### Static Scenes (2)

| Scene | Category |
|-------|----------|
| Stream Starting Soon | `static` |
| End Stream | `static` |

#### Single Camera Scenes (4)

| Scene | Category | Primary Camera |
|-------|----------|----------------|
| Full Screen - Camera A | `single` | Camera A |
| Full Screen - Camera B | `single` | Camera B |
| Full Screen - Camera C | `single` | Camera C |
| Full Screen - Camera D | `single` | Camera D |

#### Dual Camera Scenes (6)

| Scene | Category | Cameras |
|-------|----------|---------|
| Dual View - Camera A & Camera B | `dual` | A (left), B (right) |
| Dual View - Camera A & Camera C | `dual` | A (left), C (right) |
| Dual View - Camera A & Camera D | `dual` | A (left), D (right) |
| Dual View - Camera B & Camera C | `dual` | B (left), C (right) |
| Dual View - Camera B & Camera D | `dual` | B (left), D (right) |
| Dual View - Camera C & Camera D | `dual` | C (left), D (right) |

#### Triple Camera Scenes (4)

| Scene | Category | Cameras |
|-------|----------|---------|
| Triple View - Camera A B C | `triple` | A (TL), B (TR), C (BC) |
| Triple View - Camera A B D | `triple` | A (TL), B (TR), D (BC) |
| Triple View - Camera A C D | `triple` | A (TL), C (TR), D (BC) |
| Triple View - Camera B C D | `triple` | B (TL), C (TR), D (BC) |

#### Quad Camera Scene (1)

| Scene | Category | Cameras |
|-------|----------|---------|
| Quad View | `quad` | A (TL), B (TR), C (BL), D (BR) |

#### Replay Scenes (4)

| Scene | Category | Replay Source |
|-------|----------|---------------|
| Replay - Camera A | `replay` | replay - cam 1 |
| Replay - Camera B | `replay` | replay - cam 2 |
| Replay - Camera C | `replay` | replay - cam 3 |
| Replay - Camera D | `replay` | replay - cam 4 |

#### Graphics Only (1)

| Scene | Category |
|-------|----------|
| Web-graphics-only-no-video | `graphics` |

---

## Layer Ordering (Z-Index)

Every scene follows this layer order (bottom to top):

1. **Background Loop** - Always at bottom
2. **Audio Camera** - Camera A (may be hidden, provides venue audio)
3. **Visible Cameras** - Primary video content
4. **Layout Overlay** - Frame/border image (dual/tri/quad-view-overlay)
5. **Talent Feeds** - VDO.Ninja browser sources (Talent-1, Talent-2)
6. **Graphics Overlay** - Web Graphics Overlay (always on top)

---

## Variable Sources (Per Competition)

These sources have URLs that change per competition:

| Source | Variable | Generated By |
|--------|----------|--------------|
| Talent-1 | `{{talentComms.vdoNinja.obsSceneUrl}}&view=talent1` | System |
| Talent-2 | `{{talentComms.vdoNinja.obsSceneUrl}}&view=talent2` | System |
| Camera A/B/C/D | `{{cameras.cam-X.srtUrl}}` | Camera config |
| Web Graphics Overlay | `{{config.graphicsOverlay.url}}` | Show config |

### VDO.Ninja URL Management

**System generates:**
- Room ID: `gym-{compId}` (unique per competition)
- OBS Scene URL: `https://vdo.ninja/?scene&room=gym-{compId}`
- Talent 1 Invite: `https://vdo.ninja/?room=gym-{compId}&push=talent1&view=director`
- Talent 2 Invite: `https://vdo.ninja/?room=gym-{compId}&push=talent2&view=director`

**UI Features Needed:**
- [ ] Generate URLs button (creates new room)
- [ ] Copy link buttons for each talent invite
- [ ] Display connection status (talent connected/disconnected)
- [ ] Regenerate URLs button (if links compromised)

---

## Scene Categories

| Category | ID | Description |
|----------|-----|-------------|
| Static | `static` | Non-camera scenes (starting, ending, BRB) |
| Single | `single` | One camera fullscreen |
| Dual | `dual` | Two cameras side-by-side |
| Triple | `triple` | Three cameras (2-over-1) |
| Quad | `quad` | Four cameras (2x2 grid) |
| Replay | `replay` | Replay video fullscreen |
| Graphics | `graphics` | Graphics only, no cameras |

---

## Audio Handling

**Current approach (simple):**
- Camera A is always present in every scene (visible or hidden)
- Camera A provides venue audio
- Other cameras have audio disabled

**Future consideration:**
- May change to separate audio routing
- Would require audio mixer integration

---

## Required Assets (Per Template)

### Dual Meet Template

| Asset | Type | Required |
|-------|------|----------|
| Background Loop | video | Yes |
| Music | audio | Yes |
| dual view overlay | image | Yes |
| stream-starting-soon graphic | image/video | Yes |
| thanks for watching graphic | image/video | Yes |
| Stinger transition | video | Optional |

### Quad Meet Template

| Asset | Type | Required |
|-------|------|----------|
| Background Loop | video | Yes |
| Music | audio | Yes |
| dual view overlay | image | Yes |
| tri-view-overlay | image | Yes |
| quad-view-overlay | image | Yes |
| stream-starting-soon graphic | image/video | Yes |
| thanks for watching graphic | image/video | Yes |
| Stinger transition | video | Optional |

---

## Implementation Notes

### Template Application Flow

1. User selects template (Dual or Quad)
2. System validates required assets exist
3. System creates all inputs with variable substitution
4. System creates all scenes with correct layer ordering
5. System applies transform presets to each source
6. System saves template scene names to Firebase (`obs/templateScenes/`)

### Camera ID Mapping

When applying template:
- `Camera A` → Look up `cam-1` SRT URL from camera config
- `Camera B` → Look up `cam-2` SRT URL from camera config
- `Camera C` → Look up `cam-3` SRT URL from camera config
- `Camera D` → Look up `cam-4` SRT URL from camera config

### Talent URL Injection

When applying template or starting competition:
1. Generate VDO.Ninja room ID
2. Update Talent-1 and Talent-2 browser source URLs
3. Store invite URLs in Firebase for UI display
4. Producer copies/shares invite URLs with talent

---

## Transitions (From Templates)

| Transition | Type | Settings |
|------------|------|----------|
| Cut | instant | duration: 0 |
| Fade | fade | duration: 300ms |
| Swipe | swipe | direction: left |
| Swipe (2) | swipe | direction: up |
| final stinger | stinger | transition_point: 14 frames |

**Default:** `final stinger` with 950ms duration
