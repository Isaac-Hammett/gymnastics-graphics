# PRD: Camera Management & Timesheet-Driven Show Control System

**Version:** 2.0
**Date:** January 13, 2026
**Project:** Gymnastics Graphics - Show Controller Extension
**Target:** AI-assisted development (Cursor/Windsurf)

---

## Executive Summary

This PRD extends the existing gymnastics-graphics show controller to add production-grade automation for collegiate gymnastics streaming. The system provides camera health monitoring, automatic OBS scene generation, timesheet-driven show flow, and producer override tracking.

### Core Value Proposition
- **Reduce producer cognitive load** during live events through automation
- **Graceful degradation** when cameras fail mid-show
- **Explicit camera references** prevent cascading errors from mismapped apparatus
- **Override tracking** captures producer decisions for future AI training

---

## System Context

### Existing Infrastructure (Do Not Rebuild)
| Component | Location | Purpose |
|-----------|----------|---------|
| OBS WebSocket integration | `server/index.js:1-200` | Scene switching, media control |
| Socket.IO server | `server/index.js:590-768` | Real-time client communication |
| Show state management | `server/index.js` | Segment timing, auto-advance |
| Firebase integration | `show-controller/src/lib/firebase.js` | Graphics triggers, competition data |
| React show controller | `show-controller/src/` | Producer/Talent UI |
| Show config system | `server/config/show-config.json` | Segment definitions |

### New Components (This PRD)
| Component | Purpose |
|-----------|---------|
| Camera Health Monitor | Poll Nimble stats, detect failures |
| Camera Runtime State | Track expected vs actual apparatus |
| Fallback Manager | Auto-switch on camera failure |
| OBS Scene Generator | Auto-create scenes from camera config |
| Timesheet Engine | Enhanced segment timing with graphics triggers |
| Producer Camera Panel | UI for verification, reassignment, health |
| Override Tracker | Log producer interventions |

---

## Phase 1: Enhanced Data Model

### 1.1 Show Configuration Schema Extension

**File:** `server/config/show-config.json` (extend existing)

**Acceptance Criteria:**
- [ ] Schema includes `cameras[]` array with SRT connection details
- [ ] Each camera has `id`, `name`, `srtPort`, `srtUrl`, `expectedApparatus[]`
- [ ] Each camera has optional `fallbackCameraId`, `healthThresholds`
- [ ] Schema includes `nimbleServer` config (host, statsPort, pollIntervalMs)
- [ ] Schema includes `audioConfig` for venue/commentary mixing
- [ ] Schema includes `graphicsOverlay` URL with query params
- [ ] Schema includes `transitions` config (cut, fade durations)
- [ ] Existing segment schema extended with `cameraId`, `cameraIds[]`, `intendedApparatus`
- [ ] JSON schema validation rejects invalid configs on server start

**New Segment Types:**
| Type | Duration | Camera | Use Case |
|------|----------|--------|----------|
| `static` | Fixed timer | None | Starting Soon, BRB, Thanks |
| `live` | Manual advance | Single | Main event coverage |
| `multi` | Manual advance | Multiple | Quad view with switchable focus |
| `hold` | Min/max bounds | Current | Wait for score reveal |
| `break` | Fixed timer | None | Rotation breaks |

**Files to Create/Modify:**
- `server/lib/showConfigSchema.js` - JSON schema validation
- `server/config/show-config.json` - Extended schema

### 1.2 Schema Validation Module

**File:** `server/lib/showConfigSchema.js` (new)

**Acceptance Criteria:**
- [ ] Validates camera array structure
- [ ] Validates segment references to cameras exist
- [ ] Validates fallback camera references exist
- [ ] Validates apparatus codes match known values (VT, UB, BB, FX for women; FX, PH, SR, VT, PB, HB for men)
- [ ] Returns descriptive error messages for validation failures
- [ ] Called on server startup and config hot-reload

---

## Phase 2: Camera Health System

### 2.1 Nimble Stats Integration

**File:** `server/lib/cameraHealth.js` (new)

**Acceptance Criteria:**
- [ ] Polls Nimble stats API at configured interval (default 2000ms)
- [ ] Parses SRT stream statistics per port
- [ ] Extracts bitrate, packet loss, connection status per camera
- [ ] Emits `cameraHealth` event with full status array
- [ ] Emits `cameraStatusChanged` event on status transitions
- [ ] Handles Nimble API failures gracefully (marks all cameras unknown)

**Health Status Values:**
| Status | Condition |
|--------|-----------|
| `healthy` | Bitrate > threshold, packet loss < 5% |
| `degraded` | Bitrate below threshold OR packet loss > 5% |
| `reconnecting` | Lost signal, within reconnect window |
| `offline` | No signal, exceeded reconnect window |
| `unknown` | No data received yet |

### 2.2 Fallback Manager

**File:** `server/lib/cameraFallback.js` (new)

**Acceptance Criteria:**
- [ ] Monitors camera health events
- [ ] Triggers fallback when camera in current segment goes offline
- [ ] Fallback priority: configured fallback > same apparatus > any healthy
- [ ] Switches OBS scene to fallback camera's single scene
- [ ] Emits `fallbackActivated` event with original/fallback cameras
- [ ] Emits `fallbackUnavailable` event when no fallback exists (switches to BRB)
- [ ] Tracks active fallbacks in Map for UI display
- [ ] Provides `clearFallback(cameraId)` to return to original

### 2.3 Camera Runtime State

**File:** `server/lib/cameraRuntimeState.js` (new)

**Acceptance Criteria:**
- [ ] Initializes from show config on startup
- [ ] Tracks `expectedApparatus` (static from config) vs `currentApparatus` (runtime editable)
- [ ] Tracks `verified` boolean and `verifiedAt` timestamp per camera
- [ ] Detects and flags mismatches between expected and current
- [ ] Provides `reassignApparatus(cameraId, apparatus[])` for producer corrections
- [ ] Provides `verifyCamera(cameraId)` for producer confirmation
- [ ] Provides `getCameraForApparatus(apparatus)` for quick-switch lookup
- [ ] Provides `getMismatches()` for alert panel
- [ ] Provides `getUnverified()` for pre-show checklist
- [ ] Emits events: `apparatusReassigned`, `cameraVerified`, `mismatchDetected`

### 2.4 Health API Endpoints

**File:** `server/index.js` (extend)

**Acceptance Criteria:**
- [ ] `GET /api/cameras/health` returns all camera health status
- [ ] `GET /api/cameras/:id/health` returns single camera health
- [ ] `GET /api/cameras/fallbacks` returns active fallback overrides
- [ ] `POST /api/cameras/:id/clear-fallback` clears fallback for camera
- [ ] `GET /api/cameras/runtime` returns full runtime state
- [ ] `POST /api/cameras/:id/reassign` reassigns apparatus
- [ ] `POST /api/cameras/:id/verify` marks camera verified

### 2.5 Socket Events

**Server Emits:**
- `cameraHealth` - Periodic health update (all cameras)
- `cameraStatusChanged` - Status transition event
- `cameraRuntimeState` - Full runtime state update
- `apparatusReassigned` - Producer changed apparatus mapping
- `cameraVerified` - Producer confirmed camera feed
- `mismatchDetected` - Expected != current apparatus
- `fallbackActivated` - Auto-switched to fallback camera
- `fallbackCleared` - Returned to original camera

**Server Listens:**
- `reassignApparatus` - `{ cameraId, apparatus: [] }`
- `verifyCamera` - `{ cameraId }`
- `clearFallback` - `{ cameraId }`
- `resetVerifications` - `{}`

---

## Phase 3: OBS Scene Generator

### 3.1 Scene Generation Module

**File:** `server/lib/obsSceneGenerator.js` (new)

**Acceptance Criteria:**
- [ ] Connects to OBS WebSocket using existing config pattern
- [ ] Generates single-camera scenes for each camera (`Single - Camera 1`)
- [ ] Generates dual-camera scenes for all 2-camera combinations
- [ ] Generates triple-camera scenes for all 3-camera combinations (if >= 3 cameras)
- [ ] Generates quad-camera scenes for all 4-camera combinations (if >= 4 cameras)
- [ ] Creates static scenes: Starting Soon, BRB, Thanks for Watching
- [ ] Creates Graphics Fullscreen scene (browser source only)
- [ ] Uses camera names in scene names, NOT apparatus (prevents stale references)
- [ ] Adds SRT sources via ffmpeg_source input type
- [ ] Applies transform presets for each layout position
- [ ] Adds graphics overlay browser source to all scenes
- [ ] Skips existing scenes (idempotent operation)
- [ ] Returns generation report: created, skipped, failed

**Transform Presets (1920x1080):**
| Layout | Position | Coordinates |
|--------|----------|-------------|
| Fullscreen | - | 0,0 1920x1080 |
| Dual Left | Left | 0,0 960x1080 |
| Dual Right | Right | 960,0 960x1080 |
| Quad TL | Top-left | 0,0 960x540 |
| Quad TR | Top-right | 960,0 960x540 |
| Quad BL | Bottom-left | 0,540 960x540 |
| Quad BR | Bottom-right | 960,540 960x540 |
| Triple Main | Large left | 0,0 1280x1080 |
| Triple Top-right | Small top | 1280,0 640x540 |
| Triple Bottom-right | Small bottom | 1280,540 640x540 |

### 3.2 Scene Generation API

**File:** `server/index.js` (extend)

**Acceptance Criteria:**
- [ ] `POST /api/scenes/generate` triggers scene generation
- [ ] Accepts `types[]` parameter to limit generation (single, dual, tri, quad, static)
- [ ] Returns generation report with created/skipped/failed counts
- [ ] `GET /api/scenes/preview` returns what scenes would be created
- [ ] `DELETE /api/scenes/generated` removes all generated scenes

### 3.3 Scene Count Formula

For `n` cameras:
- Single: `n`
- Dual: `C(n,2) = n*(n-1)/2`
- Triple: `C(n,3)` (if n >= 3)
- Quad: `C(n,4)` (if n >= 4)
- Static: 3
- Graphics: 1

| Cameras | Single | Dual | Tri | Quad | Static | Graphics | Total |
|---------|--------|------|-----|------|--------|----------|-------|
| 2 | 2 | 1 | 0 | 0 | 3 | 1 | 7 |
| 3 | 3 | 3 | 1 | 0 | 3 | 1 | 11 |
| 4 | 4 | 6 | 4 | 1 | 3 | 1 | 19 |
| 5 | 5 | 10 | 10 | 5 | 3 | 1 | 34 |
| 6 | 6 | 15 | 20 | 15 | 3 | 1 | 60 |

---

## Phase 4: Timesheet Engine

### 4.1 Enhanced Segment Management

**File:** `server/lib/timesheetEngine.js` (new, replaces segment logic in index.js)

**Acceptance Criteria:**
- [ ] Extends EventEmitter for event-based architecture
- [ ] Loads segments from show config
- [ ] Tracks current segment index, start time, elapsed time
- [ ] Handles all segment types: static, live, multi, hold, break
- [ ] Auto-advances segments with `autoAdvance: true` when duration reached
- [ ] Respects `minDuration` and `maxDuration` for hold segments
- [ ] Emits `holdMaxReached` when hold exceeds max (doesn't auto-advance)
- [ ] Triggers graphics via Firebase on segment activation
- [ ] Applies transition type (cut/fade) between segments
- [ ] Applies audio overrides per segment
- [ ] Tracks override history for all manual interventions

### 4.2 Transition Handling

**Acceptance Criteria:**
- [ ] Default transition is cut (0ms)
- [ ] `toBreak` transition is fade (500ms default)
- [ ] `fromBreak` transition is fade (500ms default)
- [ ] Segment-specific transition overrides supported
- [ ] Sets OBS transition type before scene switch
- [ ] Sets OBS transition duration before scene switch

### 4.3 Graphics Integration

**Acceptance Criteria:**
- [ ] Reads `graphic` field from segment
- [ ] Reads `graphicData` object from segment
- [ ] Writes to Firebase path: `competitions/{compId}/currentGraphic`
- [ ] Payload includes: `{ type, data, timestamp }`
- [ ] Emits `graphicTriggered` event for UI feedback

### 4.4 Manual Controls

**Acceptance Criteria:**
- [ ] `start()` - Begin show from first segment
- [ ] `stop()` - Stop show, preserve history
- [ ] `advance()` - Go to next segment
- [ ] `previous()` - Go to previous segment
- [ ] `goToSegment(segmentId)` - Jump to specific segment
- [ ] `overrideScene(sceneName)` - Force scene switch
- [ ] `overrideCamera(cameraId)` - Switch to camera's single scene
- [ ] All manual actions recorded in override history

### 4.5 Socket Events

**Server Emits:**
- `showStarted` - `{ timestamp, totalSegments }`
- `showStopped` - `{ timestamp, segmentsCompleted, history }`
- `showEnded` - `{ timestamp, history, overrides }`
- `segmentActivated` - `{ segment, index, transition, timestamp }`
- `graphicTriggered` - `{ segmentId, graphic, data }`
- `tick` - `{ segmentId, elapsedSeconds, duration, remaining }`
- `holdMaxReached` - `{ segmentId }`
- `sceneOverridden` - `{ original, override }`
- `cameraOverridden` - `{ original, override }`

**Server Listens:**
- `startShow` - Start from first segment
- `stopShow` - Stop show
- `advanceSegment` - Go to next
- `previousSegment` - Go to previous
- `goToSegment` - `{ segmentId }`
- `overrideScene` - `{ sceneName }`
- `overrideCamera` - `{ cameraId }`
- `triggerGraphic` - `{ type, data }`

---

## Phase 5: Producer UI - Camera Panel

### 5.1 Camera Setup Page

**File:** `show-controller/src/pages/CameraSetupPage.jsx` (new)

**Acceptance Criteria:**
- [ ] Displays all cameras from config
- [ ] Edit camera name, SRT port, expected apparatus
- [ ] Select fallback camera from dropdown
- [ ] Toggle primary camera and audio enabled flags
- [ ] Add/remove cameras dynamically
- [ ] Show real-time health status from Nimble
- [ ] Preview scene count before generation
- [ ] "Generate Scenes" button with progress feedback
- [ ] "Save Configuration" persists to show-config.json
- [ ] Note explaining expected vs runtime apparatus

### 5.2 Camera Runtime Panel

**File:** `show-controller/src/components/CameraRuntimePanel.jsx` (new)

**Acceptance Criteria:**
- [ ] Grid of camera cards showing real-time status
- [ ] Each card shows: name, health indicator, bitrate, current apparatus
- [ ] Visual indicator for verified vs unverified cameras
- [ ] Visual indicator for apparatus mismatches (expected != current)
- [ ] "Verify" button marks camera confirmed
- [ ] Apparatus reassignment dropdown for corrections
- [ ] Click card to quick-switch to that camera's scene
- [ ] Active fallback indicator with "Clear Fallback" button
- [ ] Collapsible mismatch alert panel at top
- [ ] Pre-show checklist showing unverified cameras

**Health Indicator Colors:**
| Status | Color |
|--------|-------|
| healthy | Green |
| degraded | Yellow |
| reconnecting | Orange pulse |
| offline | Red |
| unknown | Gray |

### 5.3 Integration with ProducerView

**File:** `show-controller/src/pages/ProducerView.jsx` (extend)

**Acceptance Criteria:**
- [ ] CameraRuntimePanel added to producer layout
- [ ] Panel collapsible to save space during show
- [ ] Quick camera buttons update based on runtime state
- [ ] Mismatch alerts visible without expanding panel

---

## Phase 6: Producer UI - Timesheet Controls

### 6.1 Timesheet Panel

**File:** `show-controller/src/components/TimesheetPanel.jsx` (new)

**Acceptance Criteria:**
- [ ] Shows current segment with elapsed/remaining time
- [ ] Shows next segment preview
- [ ] Progress bar for timed segments
- [ ] Countdown display for segments with `countdown: true`
- [ ] Visual indicator for auto-advance vs manual segments
- [ ] "Advance" button (always visible)
- [ ] "Previous" button (with confirmation for live segments)
- [ ] Segment list with jump-to functionality
- [ ] Current segment highlighted in list
- [ ] Override indicator when scene differs from segment config

### 6.2 Override Tracking Display

**File:** `show-controller/src/components/OverrideLog.jsx` (new)

**Acceptance Criteria:**
- [ ] Real-time log of producer overrides
- [ ] Shows timestamp, type, details for each override
- [ ] Override types: scene_override, camera_override, jump, previous
- [ ] Collapsible panel (defaults to showing last 5)
- [ ] Export button for post-show analysis
- [ ] Count badge showing total overrides

### 6.3 Quick Actions Update

**File:** `show-controller/src/components/QuickActions.jsx` (extend)

**Acceptance Criteria:**
- [ ] Quick camera buttons based on runtime apparatus mappings
- [ ] "VT" button switches to camera with `currentApparatus: ["VT"]`
- [ ] Buttons disabled for cameras that are offline
- [ ] Visual indicator for current camera
- [ ] Tooltip shows camera name and health

---

## Phase 7: Show Context Extension

### 7.1 ShowContext Updates

**File:** `show-controller/src/context/ShowContext.jsx` (extend)

**Acceptance Criteria:**
- [ ] Subscribes to all new socket events
- [ ] Provides `cameraHealth` state
- [ ] Provides `cameraRuntimeState` state
- [ ] Provides `activeFallbacks` state
- [ ] Provides `timesheetState` state
- [ ] Provides `overrideLog` state
- [ ] Provides emit functions for all new client events
- [ ] Reconnection preserves subscriptions

### 7.2 Custom Hooks

**Files:** `show-controller/src/hooks/` (new hooks)

**useCameraHealth.js:**
- [ ] Returns camera health array
- [ ] Returns helper: `isHealthy(cameraId)`
- [ ] Returns helper: `getCameraStatus(cameraId)`

**useCameraRuntime.js:**
- [ ] Returns runtime state array
- [ ] Returns helper: `getCameraForApparatus(apparatus)`
- [ ] Returns helper: `getMismatches()`
- [ ] Returns helper: `getUnverified()`
- [ ] Provides `reassign(cameraId, apparatus[])`
- [ ] Provides `verify(cameraId)`

**useTimesheet.js:**
- [ ] Returns current segment, next segment, progress
- [ ] Returns elapsed time, remaining time
- [ ] Provides `advance()`, `previous()`, `jumpTo(segmentId)`
- [ ] Provides `overrideScene(sceneName)`, `overrideCamera(cameraId)`

---

## Technical Challenges & Mitigations

### Challenge 1: Nimble API Reliability
**Risk:** Nimble stats endpoint may be slow or fail during high load.

**Mitigation:**
- Implement request timeout (2000ms)
- Cache last known good state
- Mark cameras "unknown" on API failure (don't trigger fallbacks on API issues)
- Log API failures for post-show analysis

### Challenge 2: OBS Scene Creation Race Conditions
**Risk:** Creating many scenes simultaneously may overwhelm OBS WebSocket.

**Mitigation:**
- Sequential scene creation with 100ms delays
- Batch source creation within scenes
- Validate scene exists before adding sources
- Retry failed creations with exponential backoff

### Challenge 3: Fallback Cascade
**Risk:** Primary camera fails, fallback fails, second fallback fails.

**Mitigation:**
- Maximum fallback depth of 2
- If all fallbacks exhausted, switch to BRB (never show dead feed)
- Alert producer immediately on any fallback
- Log cascade events for investigation

### Challenge 4: Firebase Graphics Timing
**Risk:** Graphics trigger arrives before overlay is ready.

**Mitigation:**
- Graphics overlay should be persistent (always loaded)
- Send `timestamp` with graphic payload for ordering
- Overlay ignores stale payloads (older than current)

### Challenge 5: Producer Override Training Data
**Risk:** Override logs are too noisy to be useful for AI training.

**Mitigation:**
- Categorize overrides by type (error_correction, preference, emergency)
- Include segment context (what was supposed to happen)
- Include camera health context (was this a failure response?)
- Export in structured format (JSON with schema)

---

## Development Phases

### Phase 1: Data Model & Validation
**Dependencies:** None

**Deliverables:**
- Extended show-config.json schema
- showConfigSchema.js validation module
- Server loads and validates new schema on startup

**Verification:**
- Server rejects invalid configs with clear error messages
- Hot-reload works with new schema fields

---

### Phase 2: Camera Health System
**Dependencies:** Phase 1

**Deliverables:**
- cameraHealth.js - Nimble polling
- cameraFallback.js - Auto-switch logic
- cameraRuntimeState.js - Expected vs actual tracking
- Socket events for health updates
- REST endpoints for health queries

**Verification:**
- Cameras show correct health status in API
- Status changes emit events
- Fallback triggers when simulating camera failure
- Runtime state tracks apparatus reassignments

---

### Phase 3: OBS Scene Generator
**Dependencies:** Phase 1

**Deliverables:**
- obsSceneGenerator.js - Scene creation module
- REST endpoint for generation
- Transform presets for all layouts

**Verification:**
- Scenes created match camera count
- Sources have correct transforms
- Graphics overlay added to all scenes
- Idempotent (re-running doesn't duplicate)

---

### Phase 4: Timesheet Engine
**Dependencies:** Phases 1, 2

**Deliverables:**
- timesheetEngine.js - Segment management
- Refactor index.js to use new engine
- Socket events for timesheet control
- Firebase graphics integration

**Verification:**
- Show starts and advances through segments
- Auto-advance works for timed segments
- Hold segments respect min/max duration
- Graphics trigger on segment activation
- Transitions apply correctly

---

### Phase 5: Camera Panel UI
**Dependencies:** Phases 2, 7

**Deliverables:**
- CameraSetupPage.jsx
- CameraRuntimePanel.jsx
- Integration with ProducerView

**Verification:**
- Real-time health display updates
- Verification buttons work
- Apparatus reassignment persists
- Quick-switch buttons work
- Fallback indicators display

---

### Phase 6: Timesheet Panel UI
**Dependencies:** Phases 4, 7

**Deliverables:**
- TimesheetPanel.jsx
- OverrideLog.jsx
- Updated QuickActions.jsx

**Verification:**
- Current/next segment display updates
- Countdown timers work
- Advance/previous buttons work
- Override log captures all interventions
- Quick actions reflect runtime state

---

### Phase 7: Context & Hooks
**Dependencies:** Phases 2, 4

**Deliverables:**
- Extended ShowContext.jsx
- useCameraHealth.js
- useCameraRuntime.js
- useTimesheet.js

**Verification:**
- All new events subscribed
- State updates propagate to components
- Hooks return correct data
- Reconnection preserves state

---

## File Manifest

### New Files
| File | Phase | Lines (est) |
|------|-------|-------------|
| `server/lib/showConfigSchema.js` | 1 | 150 |
| `server/lib/cameraHealth.js` | 2 | 200 |
| `server/lib/cameraFallback.js` | 2 | 180 |
| `server/lib/cameraRuntimeState.js` | 2 | 250 |
| `server/lib/obsSceneGenerator.js` | 3 | 350 |
| `server/lib/timesheetEngine.js` | 4 | 400 |
| `show-controller/src/pages/CameraSetupPage.jsx` | 5 | 300 |
| `show-controller/src/components/CameraRuntimePanel.jsx` | 5 | 250 |
| `show-controller/src/components/TimesheetPanel.jsx` | 6 | 200 |
| `show-controller/src/components/OverrideLog.jsx` | 6 | 100 |
| `show-controller/src/hooks/useCameraHealth.js` | 7 | 50 |
| `show-controller/src/hooks/useCameraRuntime.js` | 7 | 80 |
| `show-controller/src/hooks/useTimesheet.js` | 7 | 80 |

### Modified Files
| File | Phase | Changes |
|------|-------|---------|
| `server/config/show-config.json` | 1 | Extended schema |
| `server/index.js` | 2,3,4 | New endpoints, engine integration |
| `show-controller/src/context/ShowContext.jsx` | 7 | New events, state |
| `show-controller/src/pages/ProducerView.jsx` | 5,6 | New panels |
| `show-controller/src/components/QuickActions.jsx` | 6 | Camera buttons |

---

## Appendix A: Socket Event Reference

### Server → Client Events
| Event | Payload | Phase |
|-------|---------|-------|
| `cameraHealth` | `{ cameras: [{id, status, bitrate, packetLoss, lastSeen}] }` | 2 |
| `cameraStatusChanged` | `{ cameraId, previous, current, details }` | 2 |
| `cameraRuntimeState` | `{ cameras: [...full runtime state] }` | 2 |
| `apparatusReassigned` | `{ cameraId, previous, current, expected, hasMismatch }` | 2 |
| `cameraVerified` | `{ cameraId, currentApparatus, timestamp }` | 2 |
| `mismatchDetected` | `{ cameraId, expected, current }` | 2 |
| `fallbackActivated` | `{ originalCamera, fallbackCamera, segment }` | 2 |
| `fallbackCleared` | `{ cameraId }` | 2 |
| `showStarted` | `{ timestamp, totalSegments }` | 4 |
| `showStopped` | `{ timestamp, segmentsCompleted, history }` | 4 |
| `showEnded` | `{ timestamp, history, overrides }` | 4 |
| `segmentActivated` | `{ segment, index, transition, timestamp }` | 4 |
| `graphicTriggered` | `{ segmentId, graphic, data }` | 4 |
| `tick` | `{ segmentId, elapsedSeconds, duration, remaining }` | 4 |
| `holdMaxReached` | `{ segmentId }` | 4 |
| `sceneOverridden` | `{ original, override }` | 4 |
| `cameraOverridden` | `{ original, override }` | 4 |

### Client → Server Events
| Event | Payload | Phase |
|-------|---------|-------|
| `reassignApparatus` | `{ cameraId, apparatus: [] }` | 2 |
| `verifyCamera` | `{ cameraId }` | 2 |
| `clearFallback` | `{ cameraId }` | 2 |
| `resetVerifications` | `{}` | 2 |
| `startShow` | `{}` | 4 |
| `stopShow` | `{}` | 4 |
| `advanceSegment` | `{}` | 4 |
| `previousSegment` | `{}` | 4 |
| `goToSegment` | `{ segmentId }` | 4 |
| `overrideScene` | `{ sceneName }` | 4 |
| `overrideCamera` | `{ cameraId }` | 4 |
| `triggerGraphic` | `{ type, data }` | 4 |

---

## Appendix B: REST API Reference

### Camera Endpoints
| Method | Path | Description | Phase |
|--------|------|-------------|-------|
| GET | `/api/cameras/health` | All camera health status | 2 |
| GET | `/api/cameras/:id/health` | Single camera health | 2 |
| GET | `/api/cameras/fallbacks` | Active fallback overrides | 2 |
| POST | `/api/cameras/:id/clear-fallback` | Clear fallback | 2 |
| GET | `/api/cameras/runtime` | Full runtime state | 2 |
| POST | `/api/cameras/:id/reassign` | Reassign apparatus | 2 |
| POST | `/api/cameras/:id/verify` | Mark verified | 2 |

### Scene Endpoints
| Method | Path | Description | Phase |
|--------|------|-------------|-------|
| POST | `/api/scenes/generate` | Generate OBS scenes | 3 |
| GET | `/api/scenes/preview` | Preview generation | 3 |
| DELETE | `/api/scenes/generated` | Remove generated scenes | 3 |

### Timesheet Endpoints
| Method | Path | Description | Phase |
|--------|------|-------------|-------|
| GET | `/api/timesheet/state` | Current timesheet state | 4 |
| GET | `/api/timesheet/overrides` | Override history | 4 |
| POST | `/api/timesheet/overrides/export` | Export for analysis | 4 |

---

## Appendix C: Key Design Decisions

### Why Explicit Camera References (Not Apparatus)

Segments reference `cameraId` directly, never apparatus:

```json
// CORRECT
{ "cameraId": "cam1", "obsScene": "Single - Camera 1" }

// WRONG
{ "apparatus": "VT", "obsScene": "Single - Vault" }
```

**Rationale:**
1. Camera operators sometimes point at wrong event
2. Apparatus-based lookup would switch to wrong camera
3. With explicit reference, wrong feed is visible (producer can correct)
4. No cascading errors from stale apparatus mappings

**Apparatus mappings used only for:**
- Producer quick-switch UI ("show me Vault" → looks up camera)
- Mismatch alerts ("Camera 1 expected Vault but showing Floor")
- Pre-show verification checklist

### Why Scene Names Use Camera Identity

```
"Single - Camera 1"  // NOT "Single - Vault"
"Dual - Camera 1-Camera 2"  // NOT "Dual - Vault-Bars"
```

**Rationale:**
1. Apparatus can change during meet (camera operator error)
2. Scene names are immutable once created
3. Using camera identity ensures scene always exists
4. Runtime state tracks what apparatus camera is actually showing

---

*Generated with Claude Code*
