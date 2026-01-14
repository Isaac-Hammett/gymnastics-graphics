# Show Control System - Implementation Plan

## Overview
Extend the gymnastics-graphics show controller with camera health monitoring, automatic OBS scene generation, timesheet-driven show flow, producer override tracking, **and competition-bound architecture with dynamic VM routing**.

**Reference:**
- `PRD-ShowControlSystem-2026-01-13.md` (Phases 1-7, Integration)
- `docs/PRD-CompetitionBoundArchitecture-2026-01-13.md` (Phases 8-12)
- `docs/PRD-VMArchitecture-2026-01-14.md` (Phases 14-17, VM Pool Management)

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
    "passes": true
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
    "passes": true
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
    "passes": true
  },

  {
    "id": "P8-01",
    "category": "phase8-apparatus-config",
    "description": "Create server-side apparatus config module",
    "steps": [
      "Create server/lib/apparatusConfig.js",
      "Import MENS_APPARATUS and WOMENS_APPARATUS from showConfigSchema.js",
      "Define APPARATUS_DETAILS with names and order by gender",
      "Implement getApparatusForGender(gender) returning sorted array",
      "Implement getApparatusCodes(gender) returning code array",
      "Implement getApparatusName(code) returning full name",
      "Implement isValidApparatus(gender, code) for validation",
      "Implement validateApparatusCodes(gender, codes[]) returning {valid, invalidCodes}",
      "Export all functions and re-export MENS_APPARATUS, WOMENS_APPARATUS"
    ],
    "verification": "node -e \"const a=require('./server/lib/apparatusConfig.js'); console.log(a.getApparatusForGender('womens'))\" shows 4 apparatus",
    "passes": true
  },
  {
    "id": "P8-02",
    "category": "phase8-apparatus-config",
    "description": "Create client-side useApparatus hook",
    "steps": [
      "Create show-controller/src/hooks/useApparatus.js",
      "Import useMemo from react",
      "Import EVENTS and EVENT_ORDER from lib/eventConfig",
      "Implement useApparatus(gender) hook",
      "Return apparatus array with code, name, eventId, order",
      "Return apparatusCodes array",
      "Return getApparatusName(code) helper",
      "Return isValid(code) helper",
      "Memoize all returns based on gender",
      "Default to 'womens' if gender is null/undefined"
    ],
    "verification": "Build succeeds and hook can be imported",
    "passes": true
  },
  {
    "id": "P8-03",
    "category": "phase8-apparatus-config",
    "description": "Add apparatus API endpoint",
    "steps": [
      "Import apparatusConfig in server/index.js",
      "Add GET /api/apparatus/:gender endpoint",
      "Return { gender, apparatus: [...] } with full apparatus data",
      "Handle invalid gender gracefully (default to womens)"
    ],
    "verification": "curl http://localhost:3001/api/apparatus/womens returns 4 apparatus",
    "passes": true
  },

  {
    "id": "P9-01",
    "category": "phase9-firebase-production",
    "description": "Create production config service",
    "steps": [
      "Create server/lib/productionConfigService.js",
      "Initialize Firebase Admin SDK connection",
      "Implement getProductionConfig(competitionId)",
      "Implement getCameras(competitionId) - convert object to array",
      "Implement saveCameras(competitionId, cameras) - convert array to object",
      "Implement getRundown(competitionId)",
      "Implement saveRundown(competitionId, rundown) with lastModified timestamp",
      "Implement getSettings(competitionId)",
      "Implement saveSettings(competitionId, settings)",
      "Implement appendOverride(competitionId, override) with timestamp",
      "Implement getHistory(competitionId)",
      "Export productionConfigService singleton"
    ],
    "verification": "node -e \"require('./server/lib/productionConfigService.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P9-02",
    "category": "phase9-firebase-production",
    "description": "Create config loader with fallback",
    "steps": [
      "Create server/lib/configLoader.js",
      "Track activeCompetitionId module variable",
      "Implement loadShowConfig() async function",
      "If activeCompetitionId set: load from Firebase via productionConfigService",
      "If no production config: fall back to show-config.json",
      "If no activeCompetitionId: load from show-config.json directly",
      "Implement setActiveCompetition(competitionId)",
      "Implement getActiveCompetition()",
      "Implement clearActiveCompetition()"
    ],
    "verification": "node -e \"require('./server/lib/configLoader.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P9-03",
    "category": "phase9-firebase-production",
    "description": "Add production config API endpoints",
    "steps": [
      "Add GET /api/competitions/:id/production endpoint",
      "Add PUT /api/competitions/:id/production/cameras endpoint",
      "Add PUT /api/competitions/:id/production/rundown endpoint",
      "Add PUT /api/competitions/:id/production/settings endpoint",
      "Add GET /api/competitions/:id/production/history endpoint",
      "Add POST /api/competitions/:id/activate to set active competition",
      "Add POST /api/competitions/deactivate to clear active competition",
      "Add GET /api/competitions/active to get current active competition"
    ],
    "verification": "curl http://localhost:3001/api/competitions/active returns JSON",
    "passes": true
  },

  {
    "id": "P10-01",
    "category": "phase10-url-routing",
    "description": "Create CompetitionContext provider",
    "steps": [
      "Create show-controller/src/context/CompetitionContext.jsx",
      "Create CompetitionContext with createContext(null)",
      "Implement CompetitionProvider component",
      "Extract compId from URL using useParams()",
      "Handle special compId='local' for local development",
      "Subscribe to competitions/{compId}/config in Firebase (onValue)",
      "Extract vmAddress and gender from config",
      "Derive socketUrl and websocketUrl from vmAddress",
      "Track isLoading and error states",
      "Implement useCompetition() hook with error if outside provider",
      "Provide: compId, competitionConfig, vmAddress, gender, socketUrl, isLoading, error, isLocalMode"
    ],
    "verification": "Build succeeds and context can be imported",
    "passes": true
  },
  {
    "id": "P10-02",
    "category": "phase10-url-routing",
    "description": "Create CompetitionSelector page",
    "steps": [
      "Create show-controller/src/pages/CompetitionSelector.jsx",
      "Fetch all competitions from Firebase competitions/ collection",
      "Group competitions by: Today, Tomorrow, Upcoming, Past",
      "Show event name, gender badge (MAG/WAG), date, venue, teams",
      "Check VM status with fetch to /api/status (5s timeout)",
      "Show VM status indicator: green=online, red=offline, gray=no VM",
      "Add quick-connect buttons: Producer, Talent, Graphics",
      "Add search/filter by name",
      "Add Local Development option at top",
      "Handle ?redirect= query param for auto-navigation",
      "Add 'Create Competition' button linking to /hub"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/select competition-selector",
    "passes": true
  },
  {
    "id": "P10-03",
    "category": "phase10-url-routing",
    "description": "Create CompetitionLayout and error components",
    "steps": [
      "Create show-controller/src/components/CompetitionLayout.jsx",
      "Wrap children with CompetitionProvider",
      "Show loading spinner while fetching config",
      "Show CompetitionError component on errors",
      "Wrap with ShowProvider when ready",
      "Render Outlet for nested routes",
      "Create show-controller/src/components/CompetitionError.jsx",
      "Handle NOT_FOUND: show 'Competition not found' with link to /select",
      "Handle NO_VM_ADDRESS: show 'Not configured' with link to configure",
      "Handle VM_UNREACHABLE: show 'Cannot connect' with retry button",
      "Create show-controller/src/components/CompetitionHeader.jsx",
      "Show event name, gender badge, venue",
      "Show connection status indicator",
      "Add 'Change' link to /select"
    ],
    "verification": "Build succeeds and components can be imported",
    "passes": true
  },
  {
    "id": "P10-04",
    "category": "phase10-url-routing",
    "description": "Update App.jsx with new route structure",
    "steps": [
      "Import CompetitionLayout, CompetitionSelector",
      "Add /select route for CompetitionSelector",
      "Add / redirect to /select",
      "Add /:compId route with CompetitionLayout element",
      "Add nested routes: producer, talent, camera-setup, graphics",
      "Add index redirect to producer",
      "Add legacy route redirects: /producer → /select?redirect=/producer",
      "Add legacy route redirects: /talent, /camera-setup, /show-producer",
      "Keep standalone routes: /hub, /dashboard, /url-generator, /media-manager, /import"
    ],
    "verification": "node ralph-wigg/test-helper.js check http://localhost:5173/select exits 0",
    "passes": true
  },
  {
    "id": "P10-05",
    "category": "phase10-url-routing",
    "description": "Update ShowContext for dynamic socket URL",
    "steps": [
      "Import useCompetition from CompetitionContext",
      "Remove hardcoded VITE_SOCKET_SERVER usage",
      "Get socketUrl and compId from useCompetition()",
      "Only connect socket when socketUrl is available",
      "Add socketUrl and compId to useEffect dependencies",
      "Disconnect and clear state when connection changes",
      "Clear: cameraHealth, cameraRuntimeState, activeFallbacks, timesheetState, overrideLog",
      "Log connection changes: 'Connected to {socketUrl} for {compId}'"
    ],
    "verification": "Console shows correct socket URL based on competition",
    "passes": true
  },
  {
    "id": "P10-06",
    "category": "phase10-url-routing",
    "description": "Update useCompetitions hook with vmAddress support",
    "steps": [
      "Add isValidVmAddress(address) function - validates host:port format",
      "Add updateVmAddress(compId, vmAddress) function",
      "Validate vmAddress format before saving",
      "Add checkVmStatus(vmAddress) function with 5s timeout",
      "Return { online, obsConnected } on success, { online: false } on failure",
      "Export new functions from hook"
    ],
    "verification": "Hook imports without error, validation works",
    "passes": true
  },

  {
    "id": "P11-01",
    "category": "phase11-dynamic-apparatus-ui",
    "description": "Update CameraSetupPage for dynamic apparatus",
    "steps": [
      "Import useCompetition from CompetitionContext",
      "Import useApparatus from hooks/useApparatus",
      "Remove hardcoded APPARATUS_OPTIONS constant",
      "Get gender from useCompetition()",
      "Get apparatus from useApparatus(gender)",
      "Build APPARATUS_OPTIONS from apparatus array",
      "Add competition name and gender badge to page header",
      "Update all apparatus references to use dynamic options"
    ],
    "verification": "WAG competition shows 4 apparatus, MAG shows 6",
    "passes": true
  },
  {
    "id": "P11-02",
    "category": "phase11-dynamic-apparatus-ui",
    "description": "Update CameraRuntimePanel for dynamic apparatus",
    "steps": [
      "Import useCompetition from CompetitionContext",
      "Import useApparatus from hooks/useApparatus",
      "Get gender from useCompetition()",
      "Use useApparatus(gender) for apparatus display",
      "Update reassign dropdown to show correct apparatus",
      "Validate apparatus codes against gender when reassigning"
    ],
    "verification": "Runtime panel shows correct apparatus for competition gender",
    "passes": true
  },
  {
    "id": "P11-03",
    "category": "phase11-dynamic-apparatus-ui",
    "description": "Update QuickActions for dynamic apparatus",
    "steps": [
      "Import useCompetition from CompetitionContext",
      "Import useApparatus from hooks/useApparatus",
      "Get gender from useCompetition()",
      "Use useApparatus(gender) for quick-switch buttons",
      "Render 4 buttons for WAG, 6 buttons for MAG",
      "Adjust grid layout: grid-cols-4 for WAG, grid-cols-6 for MAG",
      "Ensure button order matches Olympic order"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/local/producer quick-actions-dynamic",
    "passes": true
  },

  {
    "id": "P12-01",
    "category": "phase12-migration",
    "description": "Create migration script for show-config.json",
    "steps": [
      "Create server/scripts/migrateToFirebase.js",
      "Parse command line args for competitionId and gender",
      "Initialize Firebase Admin SDK",
      "Read show-config.json",
      "Import getApparatusCodes from apparatusConfig",
      "Validate camera apparatus codes against gender",
      "Warn on invalid apparatus codes for gender",
      "Build production config object: cameras, rundown, settings, history",
      "Write to competitions/{id}/production/ in Firebase",
      "Print migration summary"
    ],
    "verification": "node server/scripts/migrateToFirebase.js --help shows usage",
    "passes": true
  },
  {
    "id": "P12-02",
    "category": "phase12-migration",
    "description": "Update environment variables",
    "steps": [
      "Update show-controller/.env.example",
      "Remove VITE_SOCKET_SERVER (no longer needed)",
      "Add VITE_LOCAL_SERVER=http://localhost:3003",
      "Update server/.env.example if exists",
      "Add FIREBASE_DATABASE_URL",
      "Add note about GOOGLE_APPLICATION_CREDENTIALS",
      "Update any documentation references"
    ],
    "verification": "Environment files updated correctly",
    "passes": true
  },

  {
    "id": "INT-04",
    "category": "integration",
    "description": "Competition selector and routing test",
    "steps": [
      "Start client dev server",
      "Navigate to /select",
      "Verify competitions load from Firebase",
      "Click on a competition with vmAddress",
      "Verify navigation to /{compId}/producer",
      "Verify socket connects to correct VM",
      "Verify CompetitionHeader shows correct info"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/select select-with-competitions",
    "passes": true
  },
  {
    "id": "INT-05",
    "category": "integration",
    "description": "Dynamic apparatus test",
    "steps": [
      "Navigate to a WAG competition",
      "Verify CameraSetupPage shows 4 apparatus (VT, UB, BB, FX)",
      "Verify QuickActions shows 4 buttons",
      "Navigate to a MAG competition (or /local with mens config)",
      "Verify CameraSetupPage shows 6 apparatus",
      "Verify QuickActions shows 6 buttons"
    ],
    "verification": "Screenshots show correct apparatus count for each gender",
    "passes": true
  },
  {
    "id": "INT-06",
    "category": "integration",
    "description": "Local development mode test",
    "steps": [
      "Navigate to /local/producer",
      "Verify connects to VITE_LOCAL_SERVER (localhost:3003)",
      "Verify CompetitionHeader shows 'Local Development'",
      "Verify all producer features work",
      "Navigate to /local/camera-setup",
      "Verify camera setup page loads"
    ],
    "verification": "node ralph-wigg/test-helper.js check http://localhost:5173/local/producer exits 0",
    "passes": true
  },
  {
    "id": "INT-07",
    "category": "integration",
    "description": "Legacy route redirect test",
    "steps": [
      "Navigate to /producer (legacy route)",
      "Verify redirect to /select?redirect=/producer",
      "Select a competition",
      "Verify navigation to /{compId}/producer",
      "Navigate to /talent (legacy route)",
      "Verify same redirect behavior"
    ],
    "verification": "Legacy routes redirect correctly",
    "passes": true
  },
  {
    "id": "INT-08",
    "category": "integration",
    "description": "Error handling test",
    "steps": [
      "Navigate to /invalid-competition-id/producer",
      "Verify CompetitionError shows 'Competition not found'",
      "Verify link to /select works",
      "Create competition without vmAddress",
      "Navigate to that competition",
      "Verify 'Not configured' error shows"
    ],
    "verification": "Error states display correctly",
    "passes": true
  },

  {
    "id": "P14-01",
    "category": "phase14-vm-infrastructure",
    "description": "Create AWS SDK service module",
    "steps": [
      "Create server/lib/awsService.js",
      "Install @aws-sdk/client-ec2 package",
      "Initialize EC2Client with region from env",
      "Implement describeInstances with tag filters",
      "Implement startInstance with instanceId",
      "Implement stopInstance with instanceId",
      "Implement getInstanceStatus for health",
      "Implement launchInstance from AMI config",
      "Implement terminateInstance with instanceId",
      "Add retry logic for transient failures",
      "Add logging for all AWS operations"
    ],
    "verification": "node -e \"require('./server/lib/awsService.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P14-02",
    "category": "phase14-vm-infrastructure",
    "description": "Create VM pool state manager",
    "steps": [
      "Create server/lib/vmPoolManager.js",
      "Import Firebase Admin and awsService",
      "Implement initializePool to sync AWS with Firebase",
      "Implement getAvailableVM to find unassigned VM",
      "Implement assignVM to reserve VM for competition",
      "Implement releaseVM to return VM to pool",
      "Implement getPoolStatus for full state",
      "Implement ensureMinWarmVMs for pool maintenance",
      "Define VM status enum: available, assigned, in_use, stopped, starting, error",
      "Emit events for state changes",
      "Write pool config schema to Firebase on init"
    ],
    "verification": "node -e \"require('./server/lib/vmPoolManager.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P14-03",
    "category": "phase14-vm-infrastructure",
    "description": "Create VM health monitor",
    "steps": [
      "Create server/lib/vmHealthMonitor.js",
      "Implement health check polling loop",
      "Check VM /api/status endpoint",
      "Check OBS WebSocket via VM API",
      "Update Firebase vmPool/{vmId}/services",
      "Detect unreachable VMs and set error status",
      "Implement checkVMHealth for on-demand check",
      "Emit vmHealthChanged event on transitions",
      "Track lastHealthCheck timestamp"
    ],
    "verification": "node -e \"require('./server/lib/vmHealthMonitor.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P15-01",
    "category": "phase15-vm-api",
    "description": "Add VM pool management API endpoints",
    "steps": [
      "Import vmPoolManager in server/index.js",
      "Add GET /api/admin/vm-pool endpoint",
      "Add GET /api/admin/vm-pool/:vmId endpoint",
      "Add POST /api/admin/vm-pool/:vmId/start endpoint",
      "Add POST /api/admin/vm-pool/:vmId/stop endpoint",
      "Add POST /api/admin/vm-pool/launch endpoint",
      "Add DELETE /api/admin/vm-pool/:vmId endpoint",
      "Add GET /api/admin/vm-pool/config endpoint",
      "Add PUT /api/admin/vm-pool/config endpoint"
    ],
    "verification": "curl http://localhost:3001/api/admin/vm-pool returns JSON",
    "passes": true
  },
  {
    "id": "P15-02",
    "category": "phase15-vm-api",
    "description": "Add competition VM assignment endpoints",
    "steps": [
      "Add POST /api/competitions/:compId/vm/assign endpoint",
      "Add POST /api/competitions/:compId/vm/release endpoint",
      "Add GET /api/competitions/:compId/vm endpoint",
      "Update competitions/{compId}/config/vmAddress on assign",
      "Update vmPool/{vmId}/assignedTo on assign",
      "Handle no VMs available error",
      "Support preferredVmId parameter"
    ],
    "verification": "curl -X POST http://localhost:3001/api/competitions/test/vm/assign returns result",
    "passes": true
  },
  {
    "id": "P15-03",
    "category": "phase15-vm-api",
    "description": "Add VM pool socket events",
    "steps": [
      "Add socket listener for assignVM",
      "Add socket listener for releaseVM",
      "Add socket listener for startVM",
      "Add socket listener for stopVM",
      "Broadcast vmPoolStatus on changes",
      "Broadcast vmAssigned event",
      "Broadcast vmReleased event",
      "Broadcast vmStarting and vmReady events",
      "Broadcast vmError event"
    ],
    "verification": "Server logs show VM socket events registered",
    "passes": true
  },
  {
    "id": "P16-01",
    "category": "phase16-vm-ui",
    "description": "Create VMPoolPage component",
    "steps": [
      "Create show-controller/src/pages/VMPoolPage.jsx",
      "Import useVMPool hook",
      "Display VM cards in grid layout",
      "Add PoolStatusBar at top",
      "Add pool configuration panel (collapsible)",
      "Add refresh button",
      "Add route /admin/vm-pool to App.jsx"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/admin/vm-pool vm-pool-page",
    "passes": true
  },
  {
    "id": "P16-02",
    "category": "phase16-vm-ui",
    "description": "Create VMCard component",
    "steps": [
      "Create show-controller/src/components/VMCard.jsx",
      "Display VM name, status badge, public IP",
      "Add service health dots",
      "Show assigned competition if any",
      "Add Start/Stop/Assign/Release buttons",
      "Add loading state during actions",
      "Add SSH command copy button"
    ],
    "verification": "VMCard renders correctly in VMPoolPage",
    "passes": true
  },
  {
    "id": "P16-03",
    "category": "phase16-vm-ui",
    "description": "Create PoolStatusBar component",
    "steps": [
      "Create show-controller/src/components/PoolStatusBar.jsx",
      "Display Available/Assigned/In Use/Stopped/Error counts",
      "Add visual utilization bar",
      "Add warning when pool is low",
      "Add 'Start Cold VM' quick action"
    ],
    "verification": "PoolStatusBar shows correct counts",
    "passes": true
  },
  {
    "id": "P16-04",
    "category": "phase16-vm-ui",
    "description": "Create useVMPool hook",
    "steps": [
      "Create show-controller/src/hooks/useVMPool.js",
      "Subscribe to vmPool/ in Firebase",
      "Return vms array and poolConfig",
      "Implement assignVM action",
      "Implement releaseVM action",
      "Implement startVM action",
      "Implement stopVM action",
      "Return computed: availableVMs, assignedVMs, stoppedVMs",
      "Return helper: getVMForCompetition"
    ],
    "verification": "Hook imports without error",
    "passes": true
  },
  {
    "id": "P16-05",
    "category": "phase16-vm-ui",
    "description": "Update CompetitionSelector with VM status",
    "steps": [
      "Import useVMPool in CompetitionSelector",
      "Add VM status badge to competition cards",
      "Add quick Assign VM button",
      "Add quick Release VM button",
      "Disable Producer/Talent links when no VM",
      "Show VM IP on hover",
      "Add link to /admin/vm-pool"
    ],
    "verification": "Competition cards show VM status",
    "passes": true
  },
  {
    "id": "P17-01",
    "category": "phase17-monitoring",
    "description": "Create alert service",
    "steps": [
      "Create server/lib/alertService.js",
      "Define alert levels: critical, warning, info",
      "Define alert categories: vm, service, camera, obs, talent",
      "Implement createAlert with auto-ID",
      "Implement resolveAlert",
      "Implement acknowledgeAlert",
      "Implement getActiveAlerts",
      "Emit socket event on new alerts",
      "Support auto-resolve configuration"
    ],
    "verification": "node -e \"require('./server/lib/alertService.js')\" exits 0",
    "passes": true
  },
  {
    "id": "P17-02",
    "category": "phase17-monitoring",
    "description": "Add VM alert triggers",
    "steps": [
      "Import alertService in vmHealthMonitor",
      "Trigger critical alert when VM unreachable",
      "Trigger critical alert when OBS disconnects",
      "Trigger warning alert when Node server down",
      "Trigger warning alert when NoMachine unavailable",
      "Trigger info alert on idle timeout stop",
      "Auto-resolve alerts on recovery"
    ],
    "verification": "VM going offline triggers alert in Firebase",
    "passes": true
  },
  {
    "id": "P17-03",
    "category": "phase17-monitoring",
    "description": "Add alerts to Producer view",
    "steps": [
      "Import useAlerts hook in ProducerView",
      "Add critical alert banner at top",
      "Add warning alert panel (collapsible)",
      "Add alert count badge in header",
      "Add acknowledge buttons",
      "Auto-dismiss info alerts after 10s"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/local/producer producer-with-alerts",
    "passes": true
  },
  {
    "id": "P17-04",
    "category": "phase17-monitoring",
    "description": "Create AlertPanel component",
    "steps": [
      "Create show-controller/src/components/AlertPanel.jsx",
      "Collapsible panel design",
      "Group alerts by level",
      "Show timestamp, title, message",
      "Add acknowledge button per alert",
      "Add acknowledge all button",
      "Empty state when no alerts"
    ],
    "verification": "AlertPanel renders correctly",
    "passes": false
  },
  {
    "id": "P17-05",
    "category": "phase17-monitoring",
    "description": "Create useAlerts hook",
    "steps": [
      "Create show-controller/src/hooks/useAlerts.js",
      "Subscribe to alerts/{competitionId}/ in Firebase",
      "Filter to unresolved alerts",
      "Sort by level then timestamp",
      "Return criticalCount, warningCount, infoCount",
      "Implement acknowledgeAlert action",
      "Implement acknowledgeAll action",
      "Return hasUnacknowledgedCritical boolean"
    ],
    "verification": "Hook imports without error",
    "passes": false
  },
  {
    "id": "INT-09",
    "category": "integration",
    "description": "VM pool end-to-end test",
    "steps": [
      "Start server with AWS credentials",
      "Verify /api/admin/vm-pool returns pool status",
      "Test VM start/stop via API",
      "Test VM assignment to competition",
      "Verify Firebase updated correctly",
      "Test release and re-assignment"
    ],
    "verification": "Full VM lifecycle works via API",
    "passes": false
  },
  {
    "id": "INT-10",
    "category": "integration",
    "description": "VM pool UI test",
    "steps": [
      "Navigate to /admin/vm-pool",
      "Verify VMs display from Firebase",
      "Test start/stop buttons",
      "Test assignment dropdown",
      "Navigate to /select",
      "Verify VM status badges on competitions"
    ],
    "verification": "node ralph-wigg/test-helper.js screenshot http://localhost:5173/admin/vm-pool vm-pool-complete",
    "passes": false
  },
  {
    "id": "INT-11",
    "category": "integration",
    "description": "Alert system test",
    "steps": [
      "Simulate VM going offline",
      "Verify alert created in Firebase",
      "Verify alert displays in Producer view",
      "Test acknowledge button",
      "Simulate VM recovery",
      "Verify alert auto-resolves"
    ],
    "verification": "Alerts flow from detection to resolution",
    "passes": false
  }
]
```

---

## Progress Summary

| Phase | Tasks | Passed | Status |
|-------|-------|--------|--------|
| Phase 1: Data Model | 3 | 3 | ✅ Complete |
| Phase 2: Camera Health | 5 | 5 | ✅ Complete |
| Phase 3: Scene Generator | 3 | 3 | ✅ Complete |
| Phase 4: Timesheet Engine | 6 | 6 | ✅ Complete |
| Phase 5: Camera UI | 3 | 3 | ✅ Complete |
| Phase 6: Timesheet UI | 3 | 3 | ✅ Complete |
| Phase 7: Context & Hooks | 5 | 5 | ✅ Complete |
| Phase 8: Apparatus Config | 3 | 3 | ✅ Complete |
| Phase 9: Firebase Production | 3 | 3 | ✅ Complete |
| Phase 10: URL Routing | 6 | 6 | ✅ Complete |
| Phase 11: Dynamic Apparatus UI | 3 | 3 | ✅ Complete |
| Phase 12: Migration | 2 | 2 | ✅ Complete |
| Integration (Original) | 3 | 3 | ✅ Complete |
| Integration (Phases 8-12) | 5 | 5 | ✅ Complete |
| **Phase 14: VM Infrastructure** | 3 | 3 | ✅ Complete |
| **Phase 15: VM Pool API** | 3 | 3 | ✅ Complete |
| **Phase 16: VM Pool UI** | 5 | 5 | ✅ Complete |
| **Phase 17: Monitoring & Alerts** | 5 | 2 | 🔄 In progress |
| **Integration (VM Pool)** | 3 | 0 | ⬜ Not started |
| **Total** | **67** | **61** | **91%** |

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
                    Integration Tests (INT-01 to INT-03) ✅ COMPLETE
                               │
═══════════════════════════════╪═══════════════════════════════════════
   COMPETITION-BOUND ARCHITECTURE (Phases 8-12)
═══════════════════════════════╪═══════════════════════════════════════
                               │
                               ▼
                    Phase 8 (Apparatus Config)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
         Phase 9 (Firebase      Phase 10 (URL Routing)
         Production Config)              │
                    │                    │
                    └──────────┬─────────┘
                               ▼
                    Phase 11 (Dynamic Apparatus UI)
                               │
                               ▼
                    Phase 12 (Migration)
                               │
                               ▼
                    Integration Tests (INT-04 to INT-08) ✅ COMPLETE
                               │
═══════════════════════════════╪═══════════════════════════════════════
   VM POOL MANAGEMENT (Phases 14-17)
═══════════════════════════════╪═══════════════════════════════════════
                               │
                               ▼
                    Phase 14 (VM Infrastructure)
                    ├── P14-01: AWS SDK Service
                    ├── P14-02: VM Pool Manager
                    └── P14-03: Health Monitor
                               │
                               ▼
                    Phase 15 (VM Pool API)
                    ├── P15-01: Management Endpoints
                    ├── P15-02: Assignment Endpoints
                    └── P15-03: Socket Events
                               │
                               ▼
                    Phase 16 (VM Pool UI)
                    ├── P16-01: VMPoolPage
                    ├── P16-02: VMCard
                    ├── P16-03: PoolStatusBar
                    ├── P16-04: useVMPool Hook
                    └── P16-05: CompetitionSelector Integration
                               │
                               ▼
                    Phase 17 (Monitoring & Alerts)
                    ├── P17-01: Alert Service
                    ├── P17-02: VM Alert Triggers
                    ├── P17-03: Producer View Alerts
                    ├── P17-04: AlertPanel Component
                    └── P17-05: useAlerts Hook
                               │
                               ▼
                    Integration Tests (INT-09 to INT-11)
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

---

## Competition-Bound Architecture Design Decisions

### URL-Based Competition Routing
- Competition ID in URL: `/{compId}/producer` not `/producer`
- Special `local` compId for development: `/local/producer`
- Legacy routes redirect to selector: `/producer` → `/select?redirect=/producer`

### VM Address from Firebase
- Stored in `competitions/{compId}/config/vmAddress`
- Format: `host:port` (no protocol) e.g., `3.81.127.185:3003`
- Real-time Firebase subscription enables live IP updates

### Dynamic Apparatus from Gender
- Leverage existing `eventConfig.js` for apparatus definitions
- WAG: VT, UB, BB, FX (4 apparatus)
- MAG: FX, PH, SR, VT, PB, HB (6 apparatus)
- No new Firebase collection needed - derive from `config.gender`

### Context Provider Hierarchy
```
CompetitionProvider (resolves compId → vmAddress, gender)
  └── ShowProvider (connects socket to vmAddress)
        └── ProducerView/TalentView/etc.
```

### Local Development Mode
- `compId="local"` uses `VITE_LOCAL_SERVER` env var
- Defaults to `http://localhost:3003`
- No Firebase lookup required

---

## VM Pool Management Design Decisions

**Reference:** `docs/PRD-VMArchitecture-2026-01-14.md` (Phases 14-17)

### AWS Resources (Production)

| Resource | Value |
|----------|-------|
| Region | us-east-1 |
| VPC ID | vpc-09ba9c02e2c976cf5 |
| Security Group ID | sg-025f1ac53cccb756b |
| Key Pair Name | gymnastics-graphics-key-pair |
| AMI ID | ami-0c398cb65a93047f2 |

### VM Pool Strategy
- **Warm pool**: 2 VMs always running, ready for immediate assignment
- **Cold pool**: 3 VMs stopped, started on demand (2-3 min startup)
- **Total capacity**: 5 VMs supporting 4 concurrent competitions + 1 spare

### VM Status States
- `available` - Ready for assignment, services running
- `assigned` - Linked to a competition
- `in_use` - Competition actively streaming
- `stopped` - Cold standby, not running
- `starting` - EC2 instance starting up
- `error` - Health check failed, needs attention

### Instance Type Selection
- **t3.large** for testing ($0.08/hr) - CPU-only encoding
- **g4dn.xlarge** for production ($0.53/hr) - GPU NVENC encoding

### Assignment Flow
1. Competition created in Firebase without VM
2. Producer clicks "Assign VM" in CompetitionSelector
3. System finds available VM from warm pool
4. Updates `vmAddress` in competition config
5. Producer can now connect to VM

### Alert Priority
| Level | Visual | Sound | Examples |
|-------|--------|-------|----------|
| Critical | Red banner | Alarm | VM unreachable, OBS crashed |
| Warning | Yellow panel | Chime | High CPU, service degraded |
| Info | Toast | None | VM assigned, config updated |

### Socket Events (VM Pool)

**Server → Client:**
- `vmPoolStatus` - Full pool status update
- `vmAssigned` - `{ vmId, competitionId, publicIp }`
- `vmReleased` - `{ vmId, competitionId }`
- `vmStarting` - `{ vmId, estimatedReadyTime }`
- `vmReady` - `{ vmId, publicIp, services }`
- `vmError` - `{ vmId, error, details }`
- `alertCreated` - `{ competitionId, alert }`
- `alertResolved` - `{ competitionId, alertId }`

**Client → Server:**
- `assignVM` - `{ competitionId, preferredVmId? }`
- `releaseVM` - `{ competitionId }`
- `startVM` - `{ vmId }`
- `stopVM` - `{ vmId }`
- `acknowledgeAlert` - `{ competitionId, alertId }`

### REST API (VM Pool)

**Admin VM Pool Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/vm-pool` | Full pool status |
| GET | `/api/admin/vm-pool/:vmId` | Single VM details |
| POST | `/api/admin/vm-pool/:vmId/start` | Start VM |
| POST | `/api/admin/vm-pool/:vmId/stop` | Stop VM |
| POST | `/api/admin/vm-pool/launch` | Launch new VM |
| DELETE | `/api/admin/vm-pool/:vmId` | Terminate VM |
| GET | `/api/admin/vm-pool/config` | Pool configuration |
| PUT | `/api/admin/vm-pool/config` | Update configuration |

**Competition VM Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/competitions/:compId/vm/assign` | Assign VM |
| POST | `/api/competitions/:compId/vm/release` | Release VM |
| GET | `/api/competitions/:compId/vm` | Get assigned VM |
