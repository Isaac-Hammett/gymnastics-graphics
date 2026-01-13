# Show Control System - Activity Log

## Current Status
**Phase:** Phase 4 - Timesheet Engine (In Progress)
**Last Task:** P4-01 - Create timesheet engine core
**Next Task:** P4-02 - Implement segment activation logic

---

## 2026-01-13

### Project Setup
- Created `PRD-ShowControlSystem-2026-01-13.md` with full requirements
- Created `plan.md` with 31 tasks organized by phase
- Created `test-helper.js` for Playwright-based browser verification
- Created `screenshots/` directory for visual verification
- Installed Playwright with Chromium browser

### Verification Commands Ready
```bash
# Take screenshot
node ralph-wigg/test-helper.js screenshot <url> <name>

# Check URL loads without errors
node ralph-wigg/test-helper.js check <url>

# Get console logs
node ralph-wigg/test-helper.js console <url>

# Check server health
node ralph-wigg/test-helper.js health
```

**Next task:** P1-01 - Create JSON schema validation module (`server/lib/showConfigSchema.js`)

### P1-02: Extend show-config.json with camera schema
Extended `server/config/show-config.json` with full camera management configuration:
- Added 4 cameras (cam-1, cam-2, cam-3, cam-talent) with SRT ports, URLs, and apparatus assignments
- Added `nimbleServer` config (host, statsPort, pollIntervalMs)
- Added `audioConfig` (venue and commentary audio sources)
- Added `graphicsOverlay` with URL and queryParams
- Added `transitions` config (default, toBreak, fromBreak)
- Updated live segments with `cameraId` and `intendedApparatus` references
- Changed halftime segment type from "live" to "break"
- Schema validation passes: `{ valid: true, errors: [] }`

### P1-03: Integrate schema validation on server startup
Integrated schema validation into `server/index.js`:
- Imported `validateShowConfig` from `./lib/showConfigSchema.js`
- Updated `loadShowConfig()` to validate config and log errors
- Added `exitOnInvalid` parameter - server exits on invalid config at startup
- Hot-reload re-validates on config file changes (does not exit, logs warnings)
- Added `GET /api/config/validate` endpoint returning `{valid: boolean, errors: []}`
- Verification: endpoint returns `{valid:true,errors:[]}`, server logs "(validated)"

### P2-01: Create Nimble stats polling module
Created `server/lib/cameraHealth.js` with CameraHealthMonitor class:
- Extends EventEmitter for real-time event broadcasting
- `fetchNimbleStats()` polls Nimble Streamer stats API at `/manage/srt_receiver_stats`
- `evaluateHealth()` determines status based on bitrate and packet loss thresholds
- `pollHealth()` runs at configurable interval (default 2000ms)
- Health statuses: `healthy`, `degraded`, `reconnecting`, `offline`, `unknown`
- Emits `cameraHealth` event with all camera statuses on each poll
- Emits `cameraStatusChanged` event when a camera's status transitions
- Helper methods: `getAllHealth()`, `getCameraHealth(id)`, `isHealthy(id)`
- `getHealthyCameras()` and `getUnhealthyCameras()` for filtering
- `updateConfig()` for hot-reload support
- Verification: `node -e "import('./server/lib/cameraHealth.js')"` exits 0

### P2-02: Create camera runtime state manager
Created `server/lib/cameraRuntimeState.js` with CameraRuntimeState class:
- Extends EventEmitter for real-time event broadcasting
- Initializes runtime state from config cameras at construction
- Tracks `expectedApparatus` (from config) vs `currentApparatus` (runtime) per camera
- Tracks `verified` boolean with timestamp and verifiedBy fields
- `reassignApparatus(cameraId, apparatus[], assignedBy)` - updates currentApparatus, resets verification
- `verifyCamera(cameraId, verifiedBy)` - marks camera as producer-verified
- `unverifyCamera(cameraId)` - removes verification status
- `resetAllVerifications()` - clears all verifications (e.g., after break)
- `getCameraForApparatus(apparatus)` - returns camera currently covering an apparatus
- `getAllCamerasForApparatus(apparatus)` - returns all cameras covering an apparatus
- `getMismatches()` - returns cameras where currentApparatus != expectedApparatus
- `getUnverified()` and `getVerified()` - filter cameras by verification status
- `hasMismatch(cameraId)` and `isVerified(cameraId)` - check individual camera status
- `setNote(cameraId, note)` - allows producer to add notes
- `updateConfig()` - hot-reload support preserving runtime state
- `resetToConfig()` - reset all runtime state to match config
- Emits events: `apparatusReassigned`, `cameraVerified`, `mismatchDetected`, `stateChanged`
- Verification: `node -e "import('./server/lib/cameraRuntimeState.js')"` exits 0

### P2-03: Create camera fallback manager
Created `server/lib/cameraFallback.js` with CameraFallbackManager class:
- Extends EventEmitter for real-time event broadcasting
- `handleCameraFailure(cameraId, currentSegment)` - main entry point for handling camera failures
- `findBestFallback()` implements priority-based fallback selection:
  - Priority 1: Configured fallback (camera.fallbackCameraId)
  - Priority 2: Camera covering same apparatus
  - Priority 3: Any verified healthy camera
  - Priority 4: Any healthy camera
- `switchToFallback(originalCameraId, fallbackCameraId, reason)` - activates fallback and switches OBS scene
- `clearFallback(cameraId)` - clears fallback when camera recovers
- `clearAllFallbacks()` - clears all active fallbacks
- Tracks active fallbacks in Map with depth tracking (max 2 levels)
- Cooldown mechanism (5 seconds) to prevent rapid fallback switching
- Falls back to BRB scene if no fallback available (never shows dead feed)
- Helper methods: `getActiveFallbacks()`, `getFallbackFor()`, `hasFallback()`, `isUsedAsFallback()`
- Emits events: `fallbackActivated`, `fallbackCleared`, `fallbackUnavailable`, `fallbackChainExhausted`
- Verification: `node -e "import('./server/lib/cameraFallback.js')"` exits 0

### P2-04: Add camera health API endpoints
Added camera management API endpoints to `server/index.js`:
- Imported and initialized camera modules (CameraHealthMonitor, CameraRuntimeState, CameraFallbackManager)
- Added `initializeCameraModules()` function called at server startup
- Added error handler for CameraHealthMonitor to prevent crashes when Nimble server is unavailable
- Hot-reload support: camera modules update when show-config.json changes

New API endpoints:
- `GET /api/cameras/health` - Returns health status for all cameras
- `GET /api/cameras/:id/health` - Returns health status for a specific camera
- `GET /api/cameras/runtime` - Returns runtime state for all cameras
- `POST /api/cameras/:id/reassign` - Reassign apparatus to a camera (body: `{apparatus: string[], assignedBy?: string}`)
- `POST /api/cameras/:id/verify` - Mark a camera as verified (body: `{verifiedBy?: string}`)
- `GET /api/cameras/fallbacks` - Returns array of active fallbacks
- `POST /api/cameras/:id/clear-fallback` - Clear fallback for a specific camera

Verification: All endpoints tested with node fetch and return correct JSON responses

### P2-05: Add camera health socket events
Added socket events to `server/index.js` for real-time camera management:

**Socket Listeners (client → server):**
- `reassignApparatus` - Reassign apparatus to a camera (`{cameraId, apparatus[], assignedBy?}`)
- `verifyCamera` - Mark a camera as verified (`{cameraId, verifiedBy?}`)
- `clearFallback` - Clear fallback for a camera (`{cameraId}`)
- `resetVerifications` - Reset all camera verifications

**Socket Broadcasts (server → clients):**
- `cameraHealth` - Broadcast on each health poll interval with all camera statuses
- `cameraRuntimeState` - Broadcast when runtime state changes
- `cameraStatusChanged` - Broadcast when a camera's status transitions
- `apparatusReassigned` - Broadcast when apparatus is reassigned
- `cameraVerified` - Broadcast when a camera is verified
- `mismatchDetected` - Broadcast when apparatus mismatch detected
- `fallbackActivated` - Broadcast when fallback is activated
- `fallbackCleared` - Broadcast when fallback is cleared
- `fallbackUnavailable` - Broadcast when no fallback is available
- `fallbackChainExhausted` - Broadcast when fallback chain is exhausted
- `activeFallbacks` - Sent on client connection with current fallbacks

**On Client Connection:**
- Initial `cameraHealth` state sent immediately
- Initial `cameraRuntimeState` sent immediately
- Initial `activeFallbacks` sent immediately

Verification: Server starts and logs show socket events registered and camera status changes broadcast

### P3-01: Create OBS scene generator module
Created `server/lib/obsSceneGenerator.js` with OBSSceneGenerator class:
- Extends EventEmitter for event-based architecture
- Defines transform presets for all layouts (1920x1080 canvas):
  - `fullscreen` - Full canvas (0,0 1920x1080)
  - `dualLeft/dualRight` - Side by side (960x1080 each)
  - `quadTopLeft/TopRight/BottomLeft/BottomRight` - 4-up grid (960x540 each)
  - `tripleMain` - Large left (1280x1080)
  - `tripleTopRight/BottomRight` - Small right column (640x540 each)
- `createSingleCameraScene(camera, graphicsUrl)` - Creates single camera fullscreen scene
- `createDualCameraScene(cam1, cam2, graphicsUrl)` - Creates side-by-side dual view
- `createTriCameraScene(cam1, cam2, cam3, graphicsUrl)` - Creates triple layout (1 large + 2 small)
- `createQuadCameraScene(cameras, graphicsUrl)` - Creates 4-up quad view
- `createStaticScene(name, graphicsUrl)` - Creates static scenes (Starting Soon, BRB, Thanks)
- `createGraphicsFullscreenScene(graphicsUrl)` - Creates browser-only graphics scene
- `addGraphicsOverlay(sceneName, graphicsUrl)` - Adds graphics overlay browser source to any scene
- `buildGraphicsUrl()` - Builds full URL with query params from config
- `sceneExists(sceneName)` - Checks if scene already exists (idempotent)
- `createCameraInput(camera)` - Creates ffmpeg_source SRT input for camera
- `addSourceToScene(sceneName, sourceName, transform)` - Adds source with transform
- `previewScenes(options)` - Returns what scenes would be created without creating them
- `getCombinations(arr, size)` - Helper to generate all n-choose-k combinations
- `updateConfig(config)` - Hot-reload support
- `getGeneratedScenes()` - Returns list of scenes created by this module
- Emits events: `sceneCreated`, `generationComplete`, `scenesDeleted`
- Verification: `node -e "import('./server/lib/obsSceneGenerator.js')"` exits 0

### P3-02: Implement generateAllScenes orchestration
Verified `generateAllScenes()` implementation in `server/lib/obsSceneGenerator.js`:
- `generateAllScenes(showConfig)` method accepts optional showConfig parameter (updates internal config if provided)
- Generates static scenes: Starting Soon, BRB, Thanks for Watching
- Generates single camera scenes for each camera
- Generates dual camera combinations using `getCombinations(cameras, 2)`
- Generates triple camera combinations if >= 3 cameras
- Generates quad camera combinations if >= 4 cameras
- Creates Graphics Fullscreen scene
- Returns results object: `{created: [], skipped: [], failed: [], summary: {created, skipped, failed, total}}`

Created unit test `server/lib/obsSceneGenerator.test.js` to verify correct scene count:
- Tests camera counts from 1 to 6
- Validates combinatorial formula: static(3) + single(n) + dual(C(n,2)) + triple(C(n,3)) + quad(C(n,4)) + graphics(1)
- Scene count examples:
  - 1 camera: 5 scenes
  - 2 cameras: 7 scenes
  - 3 cameras: 11 scenes
  - 4 cameras: 19 scenes (typical for gymnastics production)
  - 5 cameras: 34 scenes
  - 6 cameras: 60 scenes
- All tests pass: `node server/lib/obsSceneGenerator.test.js` exits 0

### P3-03: Add scene generation API endpoints
Added OBS scene generation API endpoints to `server/index.js`:
- Imported `OBSSceneGenerator` from `./lib/obsSceneGenerator.js`
- Added `obsSceneGenerator` module variable and `initializeSceneGenerator()` function
- Updated config hot-reload to also update scene generator

New API endpoints:
- `POST /api/scenes/generate` - Generate OBS scenes from camera config
  - Accepts optional `types[]` in body to filter scene types (single, dual, triple, quad, static, graphics)
  - Returns generation report: `{created: [], skipped: [], failed: [], summary: {}}`
  - Requires OBS connection (returns 503 if not connected)
- `GET /api/scenes/preview` - Preview what scenes would be generated
  - Accepts optional `types` query param (comma-separated) to filter
  - Returns scene names grouped by type with totals
  - Works without OBS connection
- `DELETE /api/scenes/generated` - Delete all generated scenes
  - Returns deletion report: `{deleted: [], failed: []}`
  - Requires OBS connection

Verification: `GET /api/scenes/preview` returns 19 scenes for 4-camera config (matching expected count)

### P4-01: Create timesheet engine core
Created `server/lib/timesheetEngine.js` with TimesheetEngine class:
- Extends EventEmitter for real-time event broadcasting
- Defines segment types: static, live, multi, hold, break, video, graphic
- Defines engine states: stopped, running, paused
- Core state tracking:
  - `_state` - Current engine state (stopped/running/paused)
  - `_isRunning` - Boolean flag for running status
  - `_currentSegmentIndex` - Current segment index (-1 if not started)
  - `_currentSegment` - Current segment object
  - `_segmentStartTime` - When current segment started
  - `_history` - Array of completed segment records
  - `_overrides` - Array of producer override actions
- `start()` - Begins show from first segment, starts tick timer
- `stop()` - Halts show, records final segment to history
- `pause()` / `resume()` - Pause/resume show without losing state
- `_tick()` - 1-second interval handler, emits tick event with elapsed/remaining time
- `_activateSegment(index)` - Internal method to switch to a segment
- `_recordHistory(endReason)` - Records segment completion in history
- `_recordOverride(type, details)` - Records producer actions
- Getters for: `segmentElapsedMs`, `segmentRemainingMs`, `segmentProgress`, `showElapsedMs`
- `getState()` - Returns full timesheet state for clients
- `getOverrides()` / `getHistory()` - Return override and history logs
- `updateConfig()` - Hot-reload support preserving position by segment ID
- Events emitted: tick, segmentActivated, segmentCompleted, showStarted, showStopped, holdMaxReached, overrideRecorded, stateChanged
- Verification: `node -e "import('./server/lib/timesheetEngine.js')"` exits 0

---

## Task Completion Log

| Task ID | Description | Status | Date |
|---------|-------------|--------|------|
| P1-01 | Create show config schema validator | ✅ done | 2026-01-13 |
| P1-02 | Extend show-config.json with camera schema | ✅ done | 2026-01-13 |
| P1-03 | Integrate schema validation on server startup | ✅ done | 2026-01-13 |
| P2-01 | Create Nimble stats polling module | ✅ done | 2026-01-13 |
| P2-02 | Create camera runtime state manager | ✅ done | 2026-01-13 |
| P2-03 | Create camera fallback manager | ✅ done | 2026-01-13 |
| P2-04 | Add camera health API endpoints | ✅ done | 2026-01-13 |
| P2-05 | Add camera health socket events | ✅ done | 2026-01-13 |
| P3-01 | Create OBS scene generator module | ✅ done | 2026-01-13 |
| P3-02 | Implement generateAllScenes orchestration | ✅ done | 2026-01-13 |
| P3-03 | Add scene generation API endpoints | ✅ done | 2026-01-13 |
| P4-01 | Create timesheet engine core | ✅ done | 2026-01-13 |
| P4-02 | Implement segment activation logic | pending | |
| P4-03 | Implement auto-advance and hold logic | pending | |
| P4-04 | Implement manual controls and overrides | pending | |
| P4-05 | Add timesheet socket events | pending | |
| P4-06 | Integrate timesheet engine with server | pending | |
| P5-01 | Create CameraSetupPage component | pending | |
| P5-02 | Create CameraRuntimePanel component | pending | |
| P5-03 | Integrate camera panel with ProducerView | pending | |
| P6-01 | Create TimesheetPanel component | pending | |
| P6-02 | Create OverrideLog component | pending | |
| P6-03 | Update QuickActions for camera runtime | pending | |
| P7-01 | Extend ShowContext with camera state | pending | |
| P7-02 | Extend ShowContext with timesheet state | pending | |
| P7-03 | Create useCameraHealth hook | pending | |
| P7-04 | Create useCameraRuntime hook | pending | |
| P7-05 | Create useTimesheet hook | pending | |
| INT-01 | End-to-end server test | pending | |
| INT-02 | End-to-end client test | pending | |
| INT-03 | Full show flow test | pending | |

---

## Screenshots

| Screenshot | Task | URL | Notes |
|------------|------|-----|-------|
| | | | |

---

## Issues & Blockers

| Issue | Task | Status | Resolution |
|-------|------|--------|------------|
| | | | |
