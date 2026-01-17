# Show Control System - Implementation Plan

## Overview
Implement OBS Integration Tool for the gymnastics-graphics show controller. This tool provides comprehensive control over OBS via WebSocket, including scene management, source configuration, audio mixing, and streaming controls.

**Reference:**
- `docs/PRD-OBSIntegrationTool-2026-01-16.md` (OBS Integration Tool)

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

### OBS Module Tests (Primary - use these!)
```bash
# Run ALL OBS-related tests (comprehensive verification)
cd server && npm run test:obs

# Run specific test file
cd server && node --test __tests__/obsStateSync.test.js

# Run scene generator tests
cd server && npm run test:lib
```

### UI/Integration Tests (for frontend tasks)
Use MCP Playwright tools to test on the remote test server:

```bash
# Navigate to test page
browser_navigate(url='http://44.193.31.120:8080/ROUTE')

# Get accessibility snapshot (for element refs)
browser_snapshot()

# Take screenshot
browser_take_screenshot(filename='screenshots/TASK-ID.png')

# Check for console errors
browser_console_messages()
```

### API Tests (run ON the coordinator via SSH)
```bash
# Check coordinator API status
ssh_exec(target='coordinator', command='curl -s http://localhost:3001/api/status')

# Check specific endpoint
ssh_exec(target='coordinator', command='curl -s http://localhost:3001/api/scenes')
```

**Note:** Show Server API (port 3003) runs on individual show VMs, not the coordinator.

### Test Infrastructure
- **Mock OBS WebSocket:** `server/__tests__/helpers/mockOBS.js` - Use for testing OBS interactions
- **Test Files:** `server/__tests__/*.test.js` - Follow this pattern for new test files
- **Test Framework:** Node.js built-in `node:test` module with `describe/it` pattern
- **Test Server:** http://44.193.31.120:8080 (use `browser_navigate`)
- **Screenshots:** Save to `screenshots/` directory locally

---

## Task List

```json
[
  {
    "id": "OBS-01",
    "category": "obs-phase1-state-sync",
    "description": "Create OBS State Sync service module",
    "steps": [
      "Create server/lib/obsStateSync.js",
      "Implement OBSStateSync class extending EventEmitter",
      "Define getInitialState() returning full state structure",
      "Implement initialize(compId) to load cached state from Firebase",
      "Implement registerEventHandlers() for all OBS WebSocket events",
      "Handle scene events: SceneListChanged, CurrentProgramSceneChanged, etc.",
      "Handle input events: InputCreated, InputRemoved, InputSettingsChanged, etc.",
      "Handle audio events: InputVolumeChanged, InputMuteStateChanged, etc.",
      "Handle transition events: SceneTransitionStarted, CurrentSceneTransitionChanged, etc.",
      "Handle stream/recording events: StreamStateChanged, RecordStateChanged",
      "Create server/__tests__/obsStateSync.test.js with comprehensive tests",
      "Create server/__tests__/helpers/mockOBS.js for test mocking"
    ],
    "verification": "cd server && npm run test:obs (must pass all 49 tests)",
    "passes": true
  },
  {
    "id": "OBS-02",
    "category": "obs-phase1-state-sync",
    "description": "Implement OBS state refresh and caching",
    "steps": [
      "Implement refreshFullState() to fetch all OBS state via Promise.all",
      "Implement fetchScenes() with GetSceneList and GetSceneItemList per scene",
      "Implement fetchInputs() with GetInputList and GetInputSettings per input",
      "Implement fetchTransitions() with GetSceneTransitionList",
      "Implement categorizeScene(sceneName) returning category string",
      "Implement extractAudioSources(inputs) to filter audio-capable inputs",
      "Implement mapStreamStatus() and mapRecordStatus() helpers",
      "Implement startPeriodicSync() for regular state updates",
      "Add tests to server/__tests__/obsStateSync.test.js for refresh methods"
    ],
    "verification": "cd server && npm run test:obs (new State Refresh tests must pass)",
    "passes": true
  },
  {
    "id": "OBS-03",
    "category": "obs-phase1-state-sync",
    "description": "Implement Firebase persistence for OBS state",
    "steps": [
      "Implement loadStateFromFirebase() reading from competitions/{compId}/obs/state/",
      "Implement saveStateToFirebase() persisting state with lastSync timestamp",
      "Implement broadcast(event, data) to emit via Socket.io",
      "Handle connection lost: update state.connected and state.connectionError",
      "Handle reconnection: call refreshFullState() and broadcast",
      "Export OBSStateSync class",
      "Add tests for Firebase persistence to server/__tests__/obsStateSync.test.js"
    ],
    "verification": "cd server && npm run test:obs (Firebase Persistence tests must pass)",
    "passes": true
  },
  {
    "id": "OBS-04",
    "category": "obs-phase1-state-sync",
    "description": "Integrate OBS State Sync with server",
    "steps": [
      "Import OBSStateSync in server/index.js",
      "Instantiate with obs, io, and productionConfigService",
      "Call initialize() when competition is activated",
      "Add obs:refreshState socket listener",
      "Include obsState in stateUpdate broadcast",
      "Test state sync on OBS connect/disconnect"
    ],
    "verification": "Server broadcasts OBS state changes in real-time",
    "passes": true
  },

  {
    "id": "OBS-05",
    "category": "obs-phase2-scene-crud",
    "description": "Create OBS Scene Manager module",
    "steps": [
      "Create server/lib/obsSceneManager.js",
      "Implement getScenes() returning cached scenes from stateSync",
      "Implement getScene(sceneName) with scene item details",
      "Implement createScene(sceneName) using obs.call('CreateScene')",
      "Implement duplicateScene(sceneName, newName) copying all scene items",
      "Implement renameScene(sceneName, newName) using obs.call('SetSceneName')",
      "Implement deleteScene(sceneName) using obs.call('RemoveScene')",
      "Implement reorderScenes(sceneOrder) using multiple scene operations",
      "Export OBSSceneManager class",
      "Create server/__tests__/obsSceneManager.test.js with tests using mockOBS.js"
    ],
    "verification": "cd server && node --test __tests__/obsSceneManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-06",
    "category": "obs-phase2-scene-crud",
    "description": "Add Scene CRUD API endpoints",
    "steps": [
      "Create server/routes/obs.js for all OBS routes",
      "Add GET /api/obs/scenes listing all scenes with items",
      "Add GET /api/obs/scenes/:sceneName for single scene details",
      "Add POST /api/obs/scenes to create new scene",
      "Add POST /api/obs/scenes/:sceneName/duplicate to copy scene",
      "Add PUT /api/obs/scenes/:sceneName to rename scene",
      "Add PUT /api/obs/scenes/reorder to reorder scene list",
      "Add DELETE /api/obs/scenes/:sceneName to delete scene",
      "Mount routes in server/index.js"
    ],
    "verification": "server/routes/obs.js exists and is mounted in server/index.js; all tests pass",
    "passes": true
  },

  {
    "id": "OBS-07",
    "category": "obs-phase3-source-mgmt",
    "description": "Create OBS Source Manager module",
    "steps": [
      "Create server/lib/obsSourceManager.js",
      "Implement getInputKinds() using obs.call('GetInputKindList')",
      "Implement getInputs() returning all inputs with settings",
      "Implement createInput(inputName, inputKind, inputSettings, sceneName)",
      "Implement getInputSettings(inputName)",
      "Implement updateInputSettings(inputName, inputSettings)",
      "Implement deleteInput(inputName)",
      "Export OBSSourceManager class",
      "Create server/__tests__/obsSourceManager.test.js with tests"
    ],
    "verification": "cd server && node --test __tests__/obsSourceManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-08",
    "category": "obs-phase3-source-mgmt",
    "description": "Implement scene item management",
    "steps": [
      "Implement getSceneItems(sceneName) returning items with transforms",
      "Implement addSourceToScene(sceneName, sourceName, transform)",
      "Implement removeSourceFromScene(sceneName, sceneItemId)",
      "Implement updateSceneItemTransform(sceneName, sceneItemId, transform)",
      "Implement setSceneItemEnabled(sceneName, sceneItemId, enabled)",
      "Implement setSceneItemLocked(sceneName, sceneItemId, locked)",
      "Implement reorderSceneItems(sceneName, itemOrder)",
      "Define TRANSFORM_PRESETS constant with all layout presets"
    ],
    "verification": "Scene item operations work correctly via OBS WebSocket",
    "passes": true
  },
  {
    "id": "OBS-09",
    "category": "obs-phase3-source-mgmt",
    "description": "Add Source Management API endpoints",
    "steps": [
      "Add GET /api/obs/inputs listing all inputs",
      "Add GET /api/obs/inputs/kinds listing available input types",
      "Add POST /api/obs/inputs to create new input",
      "Add GET /api/obs/inputs/:inputName for input settings",
      "Add PUT /api/obs/inputs/:inputName to update settings",
      "Add DELETE /api/obs/inputs/:inputName to delete input",
      "Add GET /api/obs/scenes/:sceneName/items for scene items",
      "Add POST /api/obs/scenes/:sceneName/items to add source",
      "Add DELETE /api/obs/scenes/:sceneName/items/:itemId to remove",
      "Add PUT /api/obs/scenes/:sceneName/items/:itemId/transform",
      "Add PUT /api/obs/scenes/:sceneName/items/:itemId/enabled",
      "Add PUT /api/obs/scenes/:sceneName/items/:itemId/locked",
      "Add PUT /api/obs/scenes/:sceneName/items/reorder"
    ],
    "verification": "Routes added to server/routes/obs.js; on show VM: curl http://localhost:3003/api/obs/inputs returns 503 or input list",
    "passes": true
  },

  {
    "id": "OBS-10",
    "category": "obs-phase4-audio",
    "description": "Create OBS Audio Manager module",
    "steps": [
      "Create server/lib/obsAudioManager.js",
      "Implement getAudioSources() returning audio inputs with levels",
      "Implement getVolume(inputName) in dB and linear",
      "Implement setVolume(inputName, volumeDb) or setVolumeMul",
      "Implement getMute(inputName)",
      "Implement setMute(inputName, muted)",
      "Implement getMonitorType(inputName)",
      "Implement setMonitorType(inputName, monitorType)",
      "Export OBSAudioManager class",
      "Create server/__tests__/obsAudioManager.test.js with tests"
    ],
    "verification": "cd server && node --test __tests__/obsAudioManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-11",
    "category": "obs-phase4-audio",
    "description": "Implement audio presets system",
    "steps": [
      "Implement savePreset(compId, preset) to Firebase competitions/{compId}/obs/presets/",
      "Implement loadPreset(compId, presetId) reading from Firebase",
      "Implement applyPreset(preset) setting all audio levels",
      "Implement deletePreset(compId, presetId)",
      "Implement listPresets(compId) returning all presets",
      "Define DEFAULT_PRESETS constant (commentary-focus, venue-focus, music-bed, all-muted, break-music)"
    ],
    "verification": "Audio presets save to Firebase and apply correctly",
    "passes": true
  },
  {
    "id": "OBS-12",
    "category": "obs-phase4-audio",
    "description": "Add Audio Management API endpoints",
    "steps": [
      "Add GET /api/obs/audio listing all audio sources",
      "Add GET /api/obs/audio/:inputName for single source",
      "Add PUT /api/obs/audio/:inputName/volume to set volume",
      "Add PUT /api/obs/audio/:inputName/mute to set mute state",
      "Add PUT /api/obs/audio/:inputName/monitor to set monitor type",
      "Add GET /api/obs/audio/presets listing presets",
      "Add POST /api/obs/audio/presets to save current mix",
      "Add PUT /api/obs/audio/presets/:presetId to load preset",
      "Add DELETE /api/obs/audio/presets/:presetId"
    ],
    "verification": "Routes added to server/routes/obs.js; on show VM: curl http://localhost:3003/api/obs/audio returns 503 or audio sources",
    "passes": true
  },

  {
    "id": "OBS-13",
    "category": "obs-phase5-transitions",
    "description": "Create OBS Transition Manager module",
    "steps": [
      "Create server/lib/obsTransitionManager.js",
      "Implement getTransitions() using GetSceneTransitionList",
      "Implement getCurrentTransition() with name and duration",
      "Implement setCurrentTransition(transitionName)",
      "Implement setTransitionDuration(duration)",
      "Implement getTransitionSettings(transitionName)",
      "Implement setTransitionSettings(transitionName, settings)",
      "Export OBSTransitionManager class",
      "Create server/__tests__/obsTransitionManager.test.js with tests"
    ],
    "verification": "cd server && node --test __tests__/obsTransitionManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-14",
    "category": "obs-phase5-transitions",
    "description": "Add Transition Management API endpoints",
    "steps": [
      "Add GET /api/obs/transitions listing all transitions",
      "Add GET /api/obs/transitions/current for current transition",
      "Add PUT /api/obs/transitions/current to set default transition",
      "Add PUT /api/obs/transitions/duration to set duration",
      "Add GET /api/obs/transitions/:name/settings",
      "Add PUT /api/obs/transitions/:name/settings",
      "Add POST /api/obs/transitions/stinger for stinger upload"
    ],
    "verification": "Routes added to server/routes/obs.js; on show VM: curl http://localhost:3003/api/obs/transitions returns 503 or transition list",
    "passes": true
  },

  {
    "id": "OBS-15",
    "category": "obs-phase6-stream",
    "description": "Create OBS Stream Manager module",
    "steps": [
      "Create server/lib/obsStreamManager.js",
      "Implement getStreamSettings() using GetStreamServiceSettings",
      "Implement setStreamSettings(settings) with encrypted key storage",
      "Implement startStream() using StartStream",
      "Implement stopStream() using StopStream",
      "Implement getStreamStatus() returning full stats",
      "Handle stream key encryption for Firebase storage",
      "Export OBSStreamManager class",
      "Create server/__tests__/obsStreamManager.test.js with tests"
    ],
    "verification": "cd server && node --test __tests__/obsStreamManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-16",
    "category": "obs-phase6-stream",
    "description": "Add Stream Configuration API endpoints",
    "steps": [
      "Add GET /api/obs/stream/settings returning settings (key masked)",
      "Add PUT /api/obs/stream/settings to update stream config",
      "Add POST /api/obs/stream/start to begin streaming",
      "Add POST /api/obs/stream/stop to end streaming",
      "Add GET /api/obs/stream/status for stream stats",
      "Ensure stream key never exposed in responses"
    ],
    "verification": "Routes added to server/routes/obs.js; on show VM: curl http://localhost:3003/api/obs/stream/status returns 503 or stream status",
    "passes": true
  },

  {
    "id": "OBS-17",
    "category": "obs-phase7-assets",
    "description": "Create OBS Asset Manager module",
    "steps": [
      "Create server/lib/obsAssetManager.js",
      "Define ASSET_TYPES: music, stingers, backgrounds, logos",
      "Define ASSET_BASE_PATH: /var/www/assets/",
      "Implement listAssets(vmAddress) reading manifest from VM",
      "Implement listAssetsByType(vmAddress, type)",
      "Implement uploadAsset(vmAddress, type, localPath, filename)",
      "Implement deleteAsset(vmAddress, type, filename)",
      "Implement downloadAsset(vmAddress, type, filename, localPath)",
      "Implement updateManifest(compId, type, entry) in Firebase",
      "Export OBSAssetManager class",
      "Create server/__tests__/obsAssetManager.test.js with tests"
    ],
    "verification": "cd server && node --test __tests__/obsAssetManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-18",
    "category": "obs-phase7-assets",
    "description": "Add Asset Management API endpoints",
    "steps": [
      "Add GET /api/obs/assets listing all assets",
      "Add GET /api/obs/assets/:type listing by type",
      "Add POST /api/obs/assets/upload with multipart/form-data",
      "Add DELETE /api/obs/assets/:type/:filename",
      "Add GET /api/obs/assets/:type/:filename/download",
      "Add POST /api/obs/assets/pack/install for asset packs",
      "Implement file size limits and type validation"
    ],
    "verification": "Routes added to server/routes/obs.js; on show VM: curl http://localhost:3003/api/obs/assets returns 503 or asset list",
    "passes": true
  },

  {
    "id": "OBS-19",
    "category": "obs-phase8-templates",
    "description": "Create OBS Template Manager module",
    "steps": [
      "Create server/lib/obsTemplateManager.js",
      "Implement listTemplates() reading from Firebase templates/obs/",
      "Implement getTemplate(templateId)",
      "Implement createTemplate(name, description, meetTypes) from current OBS state",
      "Implement applyTemplate(templateId) with variable substitution",
      "Implement deleteTemplate(templateId)",
      "Implement resolveVariables(template, context) for {{...}} placeholders",
      "Implement validateRequirements(template) checking assets and cameras",
      "Export OBSTemplateManager class",
      "Create server/__tests__/obsTemplateManager.test.js with tests"
    ],
    "verification": "cd server && node --test __tests__/obsTemplateManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-20",
    "category": "obs-phase8-templates",
    "description": "Add Template Management API endpoints",
    "steps": [
      "Add GET /api/obs/templates listing available templates",
      "Add GET /api/obs/templates/:id for template details",
      "Add POST /api/obs/templates to create from current OBS",
      "Add POST /api/obs/templates/:id/apply to apply template",
      "Add PUT /api/obs/templates/:id to update metadata",
      "Add DELETE /api/obs/templates/:id to delete template"
    ],
    "verification": "Routes added to server/routes/obs.js; on show VM: curl http://localhost:3003/api/obs/templates returns 503 or template list",
    "passes": true
  },

  {
    "id": "OBS-21",
    "category": "obs-phase9-talent-comms",
    "description": "Implement VDO.Ninja integration",
    "steps": [
      "Create server/lib/talentCommsManager.js",
      "Implement generateRoomId() creating unique room ID",
      "Implement generateVdoNinjaUrls(roomId) returning director, obsScene, talent URLs",
      "Implement setupTalentComms(compId) generating and saving to Firebase",
      "Implement regenerateUrls(compId) creating new room and URLs",
      "Store in competitions/{compId}/config/talentComms",
      "Export TalentCommsManager class",
      "Create server/__tests__/talentCommsManager.test.js with tests"
    ],
    "verification": "cd server && node --test __tests__/talentCommsManager.test.js (all tests pass)",
    "passes": true
  },
  {
    "id": "OBS-22",
    "category": "obs-phase9-talent-comms",
    "description": "Add Talent Communication API endpoints",
    "steps": [
      "Add GET /api/talent-comms returning current config",
      "Add POST /api/talent-comms/setup to generate VDO.Ninja URLs",
      "Add POST /api/talent-comms/regenerate for new URLs",
      "Add PUT /api/talent-comms/method to switch vdo-ninja/discord",
      "Add GET /api/talent-comms/status for connection status",
      "Document Discord fallback with SSH tunnel instructions"
    ],
    "verification": "Routes added; on show VM: curl http://localhost:3003/api/talent-comms returns 503 or comms config",
    "passes": true
  },

  {
    "id": "OBS-23",
    "category": "obs-phase10-preview",
    "description": "Implement OBS Preview and Studio Mode",
    "steps": [
      "Add takeScreenshot(sceneName?) to obsStateSync using GetSourceScreenshot",
      "Implement getStudioModeStatus()",
      "Implement setStudioMode(enabled)",
      "Implement setPreviewScene(sceneName)",
      "Implement executeTransition() to go preview to program"
    ],
    "verification": "Screenshot capture works via OBS WebSocket",
    "passes": true
  },
  {
    "id": "OBS-24",
    "category": "obs-phase10-preview",
    "description": "Add Preview System API endpoints",
    "steps": [
      "Add GET /api/obs/preview/screenshot for current output",
      "Add GET /api/obs/preview/screenshot/:sceneName for specific scene",
      "Add PUT /api/obs/studio-mode to enable/disable",
      "Add PUT /api/obs/studio-mode/preview to set preview scene",
      "Add POST /api/obs/studio-mode/transition to execute transition"
    ],
    "verification": "Routes added to server/routes/obs.js; on show VM: curl http://localhost:3003/api/obs/preview/screenshot returns 503 or base64 image",
    "passes": false
  },

  {
    "id": "OBS-25",
    "category": "obs-phase11-ui",
    "description": "Create OBS Context and hook",
    "steps": [
      "Create show-controller/src/context/OBSContext.jsx",
      "Create OBSProvider component subscribing to obs:* socket events",
      "Track obsState, obsConnected, connectionError",
      "Implement useOBS() hook returning state and actions",
      "Actions: switchScene, setTransition, setVolume, setMute, loadPreset, startStream, stopStream",
      "Export OBSContext, OBSProvider, useOBS"
    ],
    "verification": "Build succeeds and OBS context can be imported",
    "passes": false
  },
  {
    "id": "OBS-26",
    "category": "obs-phase11-ui",
    "description": "Create OBS Manager main page",
    "steps": [
      "Create show-controller/src/pages/OBSManager.jsx",
      "Add tabbed navigation: Scenes, Sources, Audio, Transitions, Stream, Assets, Templates",
      "Implement OBSConnectionStatus component showing connection state",
      "Implement OBSCurrentOutput component with preview image and stream status",
      "Add stream control buttons: Start/Stop Stream, Start/Stop Recording, Screenshot",
      "Add route /:compId/obs-manager to App.jsx"
    ],
    "verification": "OBS Manager page renders at /:compId/obs-manager",
    "passes": false
  },
  {
    "id": "OBS-27",
    "category": "obs-phase11-ui",
    "description": "Create Scene List and Editor components",
    "steps": [
      "Create show-controller/src/components/obs/SceneList.jsx",
      "Group scenes by category (generated-single, generated-multi, static, manual, template)",
      "Add scene actions: Preview, Edit, Duplicate, Delete",
      "Show source count per scene",
      "Create show-controller/src/components/obs/SceneEditor.jsx",
      "Display scene items with drag-to-reorder",
      "Add/remove sources from scene",
      "Implement transform editor with preset buttons"
    ],
    "verification": "Scene list shows categorized scenes with edit capabilities",
    "passes": false
  },
  {
    "id": "OBS-28",
    "category": "obs-phase11-ui",
    "description": "Create Source Editor component",
    "steps": [
      "Create show-controller/src/components/obs/SourceEditor.jsx",
      "Edit source settings based on inputKind",
      "SRT source: URL, buffering, reconnect settings",
      "Browser source: URL, width, height, FPS",
      "Media source: file path, loop, restart",
      "Transform controls: position, scale, crop",
      "Preset layout buttons for quick positioning"
    ],
    "verification": "Source editor allows editing source properties",
    "passes": false
  },
  {
    "id": "OBS-29",
    "category": "obs-phase11-ui",
    "description": "Create Audio Mixer component",
    "steps": [
      "Create show-controller/src/components/obs/AudioMixer.jsx",
      "Display all audio sources with volume sliders",
      "Show real-time audio levels (if available)",
      "Mute toggles per source",
      "Monitor type dropdown per source",
      "Create show-controller/src/components/obs/AudioPresetManager.jsx",
      "List saved presets with one-click load",
      "Save current mix as new preset button",
      "Delete preset functionality"
    ],
    "verification": "Audio mixer shows volume controls and presets",
    "passes": false
  },
  {
    "id": "OBS-30",
    "category": "obs-phase11-ui",
    "description": "Create Stream Config and Asset Manager components",
    "steps": [
      "Create show-controller/src/components/obs/StreamConfig.jsx",
      "Service selector: YouTube, Twitch, Custom RTMP",
      "Stream key input (masked)",
      "Output settings display",
      "Create show-controller/src/components/obs/AssetManager.jsx",
      "Asset list grouped by type",
      "Drag-and-drop file upload",
      "Preview for images/videos",
      "Delete confirmation"
    ],
    "verification": "Stream config and asset manager UI components render correctly",
    "passes": false
  },
  {
    "id": "OBS-31",
    "category": "obs-phase11-ui",
    "description": "Create Template Manager and Talent Comms UI",
    "steps": [
      "Create show-controller/src/components/obs/TemplateManager.jsx",
      "List available templates with metadata",
      "Apply template button with confirmation modal",
      "Save current as template button",
      "Create show-controller/src/components/obs/TalentCommsPanel.jsx",
      "Show VDO.Ninja URLs with copy buttons",
      "Show talent connection status",
      "Regenerate URLs button",
      "Method switcher: VDO.Ninja vs Discord"
    ],
    "verification": "Template manager and talent comms UI components work",
    "passes": false
  },

  {
    "id": "OBS-INT-01",
    "category": "obs-integration",
    "description": "OBS state sync end-to-end test",
    "steps": [
      "Connect to test environment with OBS running",
      "Verify obsState populated with scenes, inputs, audio",
      "Change scene in OBS, verify UI updates",
      "Change volume in OBS, verify UI updates",
      "Disconnect OBS, verify error state shown",
      "Reconnect OBS, verify state refreshes"
    ],
    "verification": "OBS state syncs bidirectionally in real-time",
    "passes": false
  },
  {
    "id": "OBS-INT-02",
    "category": "obs-integration",
    "description": "Scene CRUD end-to-end test",
    "steps": [
      "Create new scene via OBS Manager UI",
      "Verify scene appears in OBS",
      "Duplicate scene via UI",
      "Rename duplicated scene",
      "Delete the duplicate",
      "Reorder scenes via drag-and-drop",
      "Verify order persists in OBS"
    ],
    "verification": "Scene operations sync correctly with OBS",
    "passes": false
  },
  {
    "id": "OBS-INT-03",
    "category": "obs-integration",
    "description": "Audio preset end-to-end test",
    "steps": [
      "Adjust multiple volume levels via Audio Mixer",
      "Save current mix as preset",
      "Verify preset saved to Firebase",
      "Reset volumes to default",
      "Load saved preset",
      "Verify all volumes restored correctly"
    ],
    "verification": "Audio presets save and load correctly",
    "passes": false
  },
  {
    "id": "OBS-INT-04",
    "category": "obs-integration",
    "description": "Template apply end-to-end test",
    "steps": [
      "Start with minimal OBS scene collection",
      "Apply template via Template Manager",
      "Verify confirmation modal shows requirements",
      "Confirm and apply template",
      "Verify scenes created in OBS",
      "Verify sources configured correctly",
      "Verify variable substitution worked"
    ],
    "verification": "Templates apply correctly with variable substitution",
    "passes": false
  },
  {
    "id": "OBS-INT-05",
    "category": "obs-integration",
    "description": "Stream control end-to-end test",
    "steps": [
      "Configure stream settings via UI",
      "Verify settings saved (key masked)",
      "Start stream via UI button",
      "Verify stream status shows LIVE",
      "Monitor stream stats display",
      "Stop stream via UI button",
      "Verify stream stopped cleanly"
    ],
    "verification": "Stream start/stop works from UI",
    "passes": false,
    "note": "Requires valid stream key and destination"
  },
  {
    "id": "OBS-INT-06",
    "category": "obs-integration",
    "description": "Asset upload end-to-end test",
    "steps": [
      "Upload music file via Asset Manager",
      "Verify file appears on VM in /var/www/assets/music/",
      "Verify manifest updated in Firebase",
      "Upload stinger video",
      "Verify stinger available for transition config",
      "Delete uploaded asset",
      "Verify removed from VM and manifest"
    ],
    "verification": "Asset upload/delete works correctly",
    "passes": false
  },
  {
    "id": "OBS-INT-07",
    "category": "obs-integration",
    "description": "Multi-client sync test",
    "steps": [
      "Open OBS Manager in two browser tabs",
      "Change scene in tab 1",
      "Verify tab 2 shows update",
      "Adjust volume in tab 2",
      "Verify tab 1 shows update",
      "Load preset in tab 1",
      "Verify tab 2 shows all volume changes"
    ],
    "verification": "Changes sync across multiple clients",
    "passes": false
  }
]
```

---

## Progress Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| **OBS Phase 1: State Sync** | 4 | 4 | Complete |
| **OBS Phase 2: Scene CRUD** | 2 | 2 | Complete |
| **OBS Phase 3: Source Mgmt** | 3 | 3 | Complete |
| **OBS Phase 4: Audio** | 3 | 3 | Complete |
| **OBS Phase 5: Transitions** | 2 | 2 | Complete |
| **OBS Phase 6: Stream** | 2 | 2 | Complete |
| **OBS Phase 7: Assets** | 2 | 2 | Complete |
| **OBS Phase 8: Templates** | 2 | 2 | Complete |
| **OBS Phase 9: Talent Comms** | 2 | 2 | Complete |
| **OBS Phase 10: Preview** | 2 | 1 | In Progress |
| **OBS Phase 11: UI** | 7 | 0 | Not Started |
| **OBS Integration Tests** | 7 | 0 | Not Started |
| **Total** | **38** | **23** | **61%** |

---

## Development Order

```
OBS Phase 1 (State Sync) ──────────────────────────────────────────┐
├── OBS-01: OBSStateSync class                                      │
├── OBS-02: State refresh and caching                               │
├── OBS-03: Firebase persistence                                    │
└── OBS-04: Server integration                                      │
                                                                    │
OBS Phase 2 (Scene CRUD) ◄──────────────────────────────────────────┤
├── OBS-05: Scene Manager module                                    │
└── OBS-06: Scene API endpoints                                     │
                                                                    │
OBS Phase 3 (Source Management) ◄───────────────────────────────────┤
├── OBS-07: Source Manager module                                   │
├── OBS-08: Scene item management                                   │
└── OBS-09: Source API endpoints                                    │
                                                                    │
OBS Phase 4 (Audio) ◄───────────────────────────────────────────────┤
├── OBS-10: Audio Manager module                                    │
├── OBS-11: Audio presets system                                    │
└── OBS-12: Audio API endpoints                                     │
                                                                    │
OBS Phase 5 (Transitions) ◄─────────────────────────────────────────┤
├── OBS-13: Transition Manager module                               │
└── OBS-14: Transition API endpoints                                │
                                                                    │
OBS Phase 6 (Stream) ◄──────────────────────────────────────────────┤
├── OBS-15: Stream Manager module                                   │
└── OBS-16: Stream API endpoints                                    │
                                                                    │
OBS Phase 7 (Assets) ◄──────────────────────────────────────────────┤
├── OBS-17: Asset Manager module                                    │
└── OBS-18: Asset API endpoints                                     │
                                                                    │
OBS Phase 8 (Templates) ◄───────────────────────────────────────────┤
├── OBS-19: Template Manager module                                 │
└── OBS-20: Template API endpoints                                  │
                                                                    │
OBS Phase 9 (Talent Comms) ◄────────────────────────────────────────┤
├── OBS-21: VDO.Ninja integration                                   │
└── OBS-22: Talent Comms API endpoints                              │
                                                                    │
OBS Phase 10 (Preview) ◄────────────────────────────────────────────┤
├── OBS-23: Preview and Studio Mode                                 │
└── OBS-24: Preview API endpoints                                   │
                                                                    │
OBS Phase 11 (UI) ◄─────────────────────────────────────────────────┤
├── OBS-25: OBS Context and hook                                    │
├── OBS-26: OBS Manager page                                        │
├── OBS-27: Scene List and Editor                                   │
├── OBS-28: Source Editor                                           │
├── OBS-29: Audio Mixer                                             │
├── OBS-30: Stream Config and Asset Manager                         │
└── OBS-31: Template Manager and Talent Comms UI                    │
                                                                    │
OBS Integration Tests ◄─────────────────────────────────────────────┘
├── OBS-INT-01: State sync E2E
├── OBS-INT-02: Scene CRUD E2E
├── OBS-INT-03: Audio preset E2E
├── OBS-INT-04: Template apply E2E
├── OBS-INT-05: Stream control E2E
├── OBS-INT-06: Asset upload E2E
└── OBS-INT-07: Multi-client sync E2E
```

---

## Key Design Decisions

### OBS WebSocket Integration
- Use obs-websocket-js library for WebSocket communication
- All OBS operations go through dedicated manager modules
- State synced to Firebase for persistence and multi-client access

### Scene Categorization
Scenes are automatically categorized by naming convention:
- `Single - Camera X` → generated-single
- `Multi - FX/PH` → generated-multi
- `BRB`, `Intro`, `Outro` → static
- User-created scenes → manual
- Template-applied scenes → template

### Audio Presets
Pre-defined presets for common scenarios:
- **commentary-focus**: -6dB commentary, -18dB venue
- **venue-focus**: -18dB commentary, -6dB venue
- **music-bed**: -12dB music, muted others
- **all-muted**: All sources muted
- **break-music**: Music only, full volume

### Stream Key Security
- Stream keys encrypted before Firebase storage
- Never exposed in API responses (masked with `****`)
- Only decrypted server-side when needed for OBS

### Asset Management
- Assets stored on VM at `/var/www/assets/{type}/`
- Manifest tracked in Firebase for multi-VM consistency
- Types: music, stingers, backgrounds, logos
