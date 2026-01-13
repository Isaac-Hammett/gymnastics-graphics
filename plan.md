# Show Control System - Implementation Plan

## Overview
Extend the gymnastics-graphics show controller with camera health monitoring, automatic OBS scene generation, timesheet-driven show flow, and producer override tracking.

**Reference:** `PRD-ShowControlSystem-2026-01-13.md`

---

## Agent Instructions

1. Read `activity.md` first to understand current state
2. Find next task with `"passes": false`
3. Complete all steps for that task
4. Verify with Playwright: `node ralph-wigg/test-helper.js <command>`
5. Update task to `"passes": true`
6. Log completion in `activity.md`
7. Repeat until all tasks pass

**Important:** Only modify the `passes` field. Do not remove or rewrite tasks.

---

## Verification Commands

```bash
# Take screenshot of a page
node ralph-wigg/test-helper.js screenshot http://localhost:5173 <name>

# Check if URL loads without errors
node ralph-wigg/test-helper.js check http://localhost:3001/api/status

# Get console logs from page
node ralph-wigg/test-helper.js console http://localhost:5173

# Check all server health endpoints
node ralph-wigg/test-helper.js health
```

Screenshots saved to: `ralph-wigg/screenshots/`

---

## Task List

```json
[
  {
    "id": "P1-01",
    "category": "phase1-data-model",
    "description": "Create show config schema validator",
    "steps": [
      "Create server/lib/showConfigSchema.js",
      "Define JSON schema for cameras array (id, name, srtPort, srtUrl, expectedApparatus)",
      "Define schema for nimbleServer config",
      "Define schema for audioConfig, graphicsOverlay, transitions",
      "Extend segment schema with cameraId, cameraIds[], intendedApparatus",
      "Export validateShowConfig() function that returns {valid, errors[]}"
    ],
    "verification": "node -e \"require('./server/lib/showConfigSchema.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P1-02",
    "category": "phase1-data-model",
    "description": "Extend show-config.json with camera schema",
    "steps": [
      "Add cameras[] array to server/config/show-config.json",
      "Add nimbleServer config block",
      "Add audioConfig block",
      "Add graphicsOverlay block with URL and queryParams",
      "Add transitions config block",
      "Update existing segments to use cameraId references"
    ],
    "verification": "node -e \"const s=require('./server/lib/showConfigSchema.js'); const c=require('./server/config/show-config.json'); console.log(s.validateShowConfig(c))\" shows valid:true",
    "passes": true
  },
  {
    "id": "P1-03",
    "category": "phase1-data-model",
    "description": "Integrate schema validation on server startup",
    "steps": [
      "Import showConfigSchema in server/index.js",
      "Validate config on server startup",
      "Log validation errors and exit if invalid",
      "Re-validate on config hot-reload",
      "Add /api/config/validate endpoint"
    ],
    "verification": "curl http://localhost:3001/api/config/validate returns {valid:true}",
    "passes": true
  },
  {
    "id": "P2-01",
    "category": "phase2-camera-health",
    "description": "Create Nimble stats polling module",
    "steps": [
      "Create server/lib/cameraHealth.js",
      "Implement CameraHealthMonitor class extending EventEmitter",
      "Add fetchNimbleStats() to poll stats API",
      "Add evaluateHealth() to determine status from stats",
      "Implement pollHealth() loop at configurable interval",
      "Emit 'cameraHealth' event with all camera statuses",
      "Emit 'cameraStatusChanged' on status transitions"
    ],
    "verification": "node -e \"require('./server/lib/cameraHealth.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P2-02",
    "category": "phase2-camera-health",
    "description": "Create camera runtime state manager",
    "steps": [
      "Create server/lib/cameraRuntimeState.js",
      "Initialize runtime state from config cameras",
      "Track expectedApparatus vs currentApparatus per camera",
      "Track verified boolean and timestamp per camera",
      "Implement reassignApparatus(cameraId, apparatus[])",
      "Implement verifyCamera(cameraId)",
      "Implement getCameraForApparatus(apparatus)",
      "Implement getMismatches() and getUnverified()",
      "Emit events: apparatusReassigned, cameraVerified, mismatchDetected"
    ],
    "verification": "node -e \"require('./server/lib/cameraRuntimeState.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P2-03",
    "category": "phase2-camera-health",
    "description": "Create camera fallback manager",
    "steps": [
      "Create server/lib/cameraFallback.js",
      "Implement CameraFallbackManager class",
      "Add handleCameraFailure(cameraId, currentSegment)",
      "Implement findBestFallback() with priority: configured > same apparatus > any healthy",
      "Add switchToFallback() to change OBS scene",
      "Track active fallbacks in Map",
      "Implement clearFallback(cameraId)",
      "Emit fallbackActivated, fallbackCleared, fallbackUnavailable events"
    ],
    "verification": "node -e \"require('./server/lib/cameraFallback.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P2-04",
    "category": "phase2-camera-health",
    "description": "Add camera health API endpoints",
    "steps": [
      "Add GET /api/cameras/health endpoint",
      "Add GET /api/cameras/:id/health endpoint",
      "Add GET /api/cameras/runtime endpoint",
      "Add POST /api/cameras/:id/reassign endpoint",
      "Add POST /api/cameras/:id/verify endpoint",
      "Add GET /api/cameras/fallbacks endpoint",
      "Add POST /api/cameras/:id/clear-fallback endpoint"
    ],
    "verification": "curl http://localhost:3001/api/cameras/health returns JSON array",
    "passes": true
  },
  {
    "id": "P2-05",
    "category": "phase2-camera-health",
    "description": "Add camera health socket events",
    "steps": [
      "Add socket listener for 'reassignApparatus'",
      "Add socket listener for 'verifyCamera'",
      "Add socket listener for 'clearFallback'",
      "Add socket listener for 'resetVerifications'",
      "Broadcast 'cameraHealth' on interval",
      "Broadcast 'cameraRuntimeState' on changes",
      "Broadcast 'cameraStatusChanged' on transitions"
    ],
    "verification": "Server logs show socket events registered",
    "passes": true
  },
  {
    "id": "P3-01",
    "category": "phase3-scene-generator",
    "description": "Create OBS scene generator module",
    "steps": [
      "Create server/lib/obsSceneGenerator.js",
      "Implement OBSSceneGenerator class",
      "Define transform presets (fullscreen, dual, quad, triple)",
      "Implement createSingleCameraScene(camera, graphicsUrl)",
      "Implement createDualCameraScene(cam1, cam2, graphicsUrl)",
      "Implement createTriCameraScene(cam1, cam2, cam3, graphicsUrl)",
      "Implement createQuadCameraScene(cameras, graphicsUrl)",
      "Implement createStaticScene(name, graphicsUrl)",
      "Implement addGraphicsOverlay(sceneName, graphicsUrl)"
    ],
    "verification": "node -e \"require('./server/lib/obsSceneGenerator.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P3-02",
    "category": "phase3-scene-generator",
    "description": "Implement generateAllScenes orchestration",
    "steps": [
      "Add generateAllScenes(showConfig) method",
      "Generate static scenes (Starting Soon, BRB, Thanks)",
      "Generate single camera scenes for each camera",
      "Generate dual combinations using getCombinations(cameras, 2)",
      "Generate triple combinations if >= 3 cameras",
      "Generate quad combinations if >= 4 cameras",
      "Create Graphics Fullscreen scene",
      "Return results: {created: [], skipped: [], failed: []}"
    ],
    "verification": "Unit test or manual test shows correct scene count for n cameras",
    "passes": true
  },
  {
    "id": "P3-03",
    "category": "phase3-scene-generator",
    "description": "Add scene generation API endpoints",
    "steps": [
      "Add POST /api/scenes/generate endpoint",
      "Accept types[] parameter to filter generation",
      "Return generation report with counts",
      "Add GET /api/scenes/preview endpoint",
      "Add DELETE /api/scenes/generated endpoint"
    ],
    "verification": "curl -X POST http://localhost:3001/api/scenes/generate returns report",
    "passes": true
  },
  {
    "id": "P4-01",
    "category": "phase4-timesheet-engine",
    "description": "Create timesheet engine core",
    "steps": [
      "Create server/lib/timesheetEngine.js",
      "Implement TimesheetEngine class extending EventEmitter",
      "Add state: isRunning, currentSegmentIndex, currentSegment, history, overrides",
      "Implement start() to begin from first segment",
      "Implement stop() to halt show",
      "Implement tick() for 1-second interval updates",
      "Emit tick event with elapsed/remaining time"
    ],
    "verification": "node -e \"require('./server/lib/timesheetEngine.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P4-02",
    "category": "phase4-timesheet-engine",
    "description": "Implement segment activation logic",
    "steps": [
      "Implement activateSegment(index)",
      "Handle all segment types: static, live, multi, hold, break",
      "Apply transition type (cut/fade) before scene switch",
      "Call OBS scene switch via obs.call()",
      "Trigger graphics via Firebase write",
      "Apply audio overrides if defined",
      "Record segment in history",
      "Emit 'segmentActivated' event"
    ],
    "verification": "Manual test: activating segment switches OBS scene",
    "passes": true
  },
  {
    "id": "P4-03",
    "category": "phase4-timesheet-engine",
    "description": "Implement auto-advance and hold logic",
    "steps": [
      "Check autoAdvance flag in tick()",
      "Auto-advance when elapsed >= duration",
      "For hold segments, respect minDuration before allowing advance",
      "Emit holdMaxReached when hold exceeds maxDuration",
      "Do NOT auto-advance hold segments (producer decision)"
    ],
    "verification": "Timed segment auto-advances after duration",
    "passes": true
  },
  {
    "id": "P4-04",
    "category": "phase4-timesheet-engine",
    "description": "Implement manual controls and overrides",
    "steps": [
      "Implement advance() for next segment",
      "Implement previous() for previous segment",
      "Implement goToSegment(segmentId) for jumping",
      "Implement overrideScene(sceneName) for manual scene switch",
      "Implement overrideCamera(cameraId) to switch to camera's scene",
      "Record all manual actions in overrides array",
      "Implement getOverrides() to retrieve history"
    ],
    "verification": "Manual test: advance/previous/jump all work",
    "passes": true
  },
  {
    "id": "P4-05",
    "category": "phase4-timesheet-engine",
    "description": "Add timesheet socket events",
    "steps": [
      "Add socket listener for 'startShow'",
      "Add socket listener for 'stopShow'",
      "Add socket listener for 'advanceSegment'",
      "Add socket listener for 'previousSegment'",
      "Add socket listener for 'goToSegment'",
      "Add socket listener for 'overrideScene'",
      "Add socket listener for 'overrideCamera'",
      "Broadcast timesheet events to all clients"
    ],
    "verification": "Socket events appear in server logs",
    "passes": true
  },
  {
    "id": "P4-06",
    "category": "phase4-timesheet-engine",
    "description": "Integrate timesheet engine with server",
    "steps": [
      "Import TimesheetEngine in server/index.js",
      "Initialize engine with showConfig and obs controller",
      "Wire socket events to engine methods",
      "Replace existing segment logic with engine",
      "Add /api/timesheet/state endpoint",
      "Add /api/timesheet/overrides endpoint"
    ],
    "verification": "curl http://localhost:3001/api/timesheet/state returns current state",
    "passes": true
  },
  {
    "id": "P5-01",
    "category": "phase5-camera-ui",
    "description": "Create CameraSetupPage component",
    "steps": [
      "Create show-controller/src/pages/CameraSetupPage.jsx",
      "Display cameras from config in editable form",
      "Allow editing name, srtPort, expectedApparatus",
      "Add/remove cameras dynamically",
      "Select fallback camera from dropdown",
      "Save button persists to show-config.json",
      "Show scene count preview"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/camera-setup camera-setup",
    "passes": true
  },
  {
    "id": "P5-02",
    "category": "phase5-camera-ui",
    "description": "Create CameraRuntimePanel component",
    "steps": [
      "Create show-controller/src/components/CameraRuntimePanel.jsx",
      "Grid of camera cards with real-time health status",
      "Health indicator colors: green/yellow/orange/red/gray",
      "Show verified vs unverified indicator",
      "Show apparatus mismatch warnings",
      "Verify button marks camera confirmed",
      "Apparatus reassignment dropdown",
      "Click card to quick-switch to camera scene"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/producer camera-panel",
    "passes": true
  },
  {
    "id": "P5-03",
    "category": "phase5-camera-ui",
    "description": "Integrate camera panel with ProducerView",
    "steps": [
      "Import CameraRuntimePanel in ProducerView.jsx",
      "Add panel to producer layout (collapsible)",
      "Wire quick camera buttons to runtime state",
      "Show mismatch alerts without expanding panel"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/producer producer-with-cameras",
    "passes": true
  },
  {
    "id": "P6-01",
    "category": "phase6-timesheet-ui",
    "description": "Create TimesheetPanel component",
    "steps": [
      "Create show-controller/src/components/TimesheetPanel.jsx",
      "Display current segment with elapsed/remaining time",
      "Display next segment preview",
      "Progress bar for timed segments",
      "Countdown display for countdown segments",
      "Advance and Previous buttons",
      "Segment list with jump-to functionality"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/producer timesheet-panel",
    "passes": true
  },
  {
    "id": "P6-02",
    "category": "phase6-timesheet-ui",
    "description": "Create OverrideLog component",
    "steps": [
      "Create show-controller/src/components/OverrideLog.jsx",
      "Real-time log of producer overrides",
      "Show timestamp, type, details for each",
      "Collapsible panel (show last 5 by default)",
      "Count badge showing total overrides",
      "Export button for post-show analysis"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/producer override-log",
    "passes": true
  },
  {
    "id": "P6-03",
    "category": "phase6-timesheet-ui",
    "description": "Update QuickActions for camera runtime",
    "steps": [
      "Update show-controller/src/components/QuickActions.jsx",
      "Quick camera buttons based on runtime apparatus",
      "VT button switches to camera with currentApparatus: ['VT']",
      "Disable buttons for offline cameras",
      "Visual indicator for current camera",
      "Tooltip shows camera name and health"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/producer quick-actions",
    "passes": true
  },
  {
    "id": "P7-01",
    "category": "phase7-context-hooks",
    "description": "Extend ShowContext with camera state",
    "steps": [
      "Update show-controller/src/context/ShowContext.jsx",
      "Subscribe to cameraHealth socket event",
      "Subscribe to cameraRuntimeState socket event",
      "Subscribe to cameraStatusChanged socket event",
      "Subscribe to fallback events",
      "Provide cameraHealth, cameraRuntimeState, activeFallbacks in context"
    ],
    "verification": "Console log shows camera state updates on connection",
    "passes": true
  },
  {
    "id": "P7-02",
    "category": "phase7-context-hooks",
    "description": "Extend ShowContext with timesheet state",
    "steps": [
      "Subscribe to timesheet socket events (segmentActivated, tick, etc)",
      "Subscribe to override events",
      "Provide timesheetState in context",
      "Provide overrideLog in context",
      "Add emit functions for timesheet control"
    ],
    "verification": "Console log shows timesheet state updates",
    "passes": true
  },
  {
    "id": "P7-03",
    "category": "phase7-context-hooks",
    "description": "Create useCameraHealth hook",
    "steps": [
      "Create show-controller/src/hooks/useCameraHealth.js",
      "Return camera health array from context",
      "Helper: isHealthy(cameraId)",
      "Helper: getCameraStatus(cameraId)"
    ],
    "verification": "node -e \"require('./show-controller/src/hooks/useCameraHealth.js')\" (build succeeds)",
    "passes": true
  },
  {
    "id": "P7-04",
    "category": "phase7-context-hooks",
    "description": "Create useCameraRuntime hook",
    "steps": [
      "Create show-controller/src/hooks/useCameraRuntime.js",
      "Return runtime state array from context",
      "Helper: getCameraForApparatus(apparatus)",
      "Helper: getMismatches()",
      "Helper: getUnverified()",
      "Actions: reassign(cameraId, apparatus[]), verify(cameraId)"
    ],
    "verification": "Hook imports without error",
    "passes": true
  },
  {
    "id": "P7-05",
    "category": "phase7-context-hooks",
    "description": "Create useTimesheet hook",
    "steps": [
      "Create show-controller/src/hooks/useTimesheet.js",
      "Return currentSegment, nextSegment, progress",
      "Return elapsed, remaining time",
      "Actions: advance(), previous(), jumpTo(segmentId)",
      "Actions: overrideScene(sceneName), overrideCamera(cameraId)"
    ],
    "verification": "Hook imports without error",
    "passes": true
  },
  {
    "id": "INT-01",
    "category": "integration",
    "description": "End-to-end server test",
    "steps": [
      "Start server with extended config",
      "Verify all new API endpoints respond",
      "Verify socket events fire correctly",
      "Check OBS connection (if available)",
      "Verify config validation on startup"
    ],
    "verification": "node ralph-wigg/test-helper.js health shows all endpoints OK",
    "passes": false
  },
  {
    "id": "INT-02",
    "category": "integration",
    "description": "End-to-end client test",
    "steps": [
      "Start client dev server",
      "Navigate to CameraSetupPage",
      "Navigate to ProducerView with camera panel",
      "Verify timesheet panel displays",
      "Check for console errors"
    ],
    "verification": "node ralph-wigg/test-helper.js check http://localhost:5173 exits 0",
    "passes": false
  },
  {
    "id": "INT-03",
    "category": "integration",
    "description": "Full show flow test",
    "steps": [
      "Load test show config with cameras",
      "Start show via socket event",
      "Verify segment advances",
      "Test camera quick-switch",
      "Test override logging",
      "Stop show and verify history"
    ],
    "verification": "Manual walkthrough completes without errors",
    "passes": false
  }
]
```

---

## Progress Summary

| Phase | Tasks | Passed | Status |
|-------|-------|--------|--------|
| Phase 1: Data Model | 3 | 3 | Complete |
| Phase 2: Camera Health | 5 | 5 | Complete |
| Phase 3: Scene Generator | 3 | 3 | Complete |
| Phase 4: Timesheet Engine | 6 | 6 | Complete |
| Phase 5: Camera UI | 3 | 3 | Complete |
| Phase 6: Timesheet UI | 3 | 3 | Complete |
| Phase 7: Context & Hooks | 5 | 5 | Complete |
| Integration | 3 | 0 | Not started |
| **Total** | **31** | **28** | **90%** |

---

## Development Order

```
Phase 1 (Data Model) ──────────┬──────────────────────────────────────┐
                               │                                       │
                               ▼                                       ▼
                    Phase 2 (Camera Health)             Phase 3 (OBS Generator)
                               │                                       │
                               ▼                                       │
                    Phase 4 (Timesheet Engine) ◄───────────────────────┘
                               │
                               ▼
                    Phase 7 (Context & Hooks)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
         Phase 5 (Camera UI)    Phase 6 (Timesheet UI)
                    │                     │
                    └──────────┬──────────┘
                               ▼
                    Integration Tests
```

---

## Key Design Decisions

### Camera References (Not Apparatus)
Segments reference `cameraId` directly, never apparatus. This prevents cascading errors when camera operators point at wrong events.

### Scene Naming Convention
Scenes use camera identity (`Single - Camera 1`) not apparatus (`Single - Vault`). Apparatus mappings are runtime-only for producer quick-switch UI.

### Fallback Strategy
- Priority: configured fallback → same apparatus → any healthy camera
- Maximum depth: 2 fallbacks
- If all fail: switch to BRB (never show dead feed)
