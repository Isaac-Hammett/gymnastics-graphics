# Implementation Plan: OBS Integration Tool

**Version:** 1.0
**Date:** 2026-01-16
**PRD Reference:** [PRD-OBSIntegrationTool-2026-01-16.md](./PRD-OBSIntegrationTool-2026-01-16.md)
**Status:** Ready for Implementation

---

## Overview

This implementation plan breaks down the OBS Integration Tool into discrete, verifiable tasks. Each task includes steps, verification commands, and pass/fail tracking.

---

## Prerequisites

Before starting implementation:

1. **OBS WebSocket Plugin** - OBS must have WebSocket server enabled (built-in for OBS 28+)
2. **Test Environment** - Use the Ralph Wiggum Loop test environment
3. **Firebase Access** - Dev Firebase project accessible
4. **VM Access** - SSH access to coordinator/test VMs

### Environment Setup Verification

```bash
# Verify OBS WebSocket connection (from VM)
ssh ubuntu@44.193.31.120 'curl -s http://localhost:4455 || echo "OBS not running"'

# Verify Firebase dev access
firebase database:get /competitions --project gymnastics-graphics-dev --limit 1

# Verify test server
curl -I http://44.193.31.120:8080
```

---

## Task Categories

| Category | Description | Task IDs |
|----------|-------------|----------|
| `obs-state` | OBS State Sync Service | OBS-01 to OBS-10 |
| `obs-scene` | Scene CRUD Operations | OBS-11 to OBS-20 |
| `obs-source` | Source Management | OBS-21 to OBS-30 |
| `obs-audio` | Audio Management | OBS-31 to OBS-40 |
| `obs-transition` | Transition Management | OBS-41 to OBS-45 |
| `obs-stream` | Stream Configuration | OBS-46 to OBS-52 |
| `obs-asset` | Asset Management | OBS-53 to OBS-60 |
| `obs-template` | Template System | OBS-61 to OBS-68 |
| `obs-talent-comms` | Talent Communication (VDO.Ninja + Discord) | OBS-69 to OBS-75 |
| `obs-preview` | Preview System | OBS-76 to OBS-79 |
| `obs-ui` | OBS Manager UI | OBS-80 to OBS-98 |

---

## Phase 1: OBS State Sync Service

### Task List

```json
[
  {
    "id": "OBS-01",
    "category": "obs-state",
    "description": "Create OBSStateSync class skeleton",
    "steps": [
      "Create server/lib/obsStateSync.js",
      "Implement constructor with OBS, Socket.io, ConfigService parameters",
      "Implement getInitialState() returning empty state structure",
      "Export class"
    ],
    "verification": "File exists and exports OBSStateSync class",
    "passes": false
  },
  {
    "id": "OBS-02",
    "category": "obs-state",
    "description": "Implement OBS event handlers registration",
    "steps": [
      "Add registerEventHandlers() method",
      "Register handlers for: SceneListChanged, CurrentProgramSceneChanged",
      "Register handlers for: InputCreated, InputRemoved, InputVolumeChanged",
      "Register handlers for: StreamStateChanged, RecordStateChanged",
      "Register handlers for: ConnectionClosed, ConnectionError"
    ],
    "verification": "Event handlers registered without errors when OBS connected",
    "passes": false
  },
  {
    "id": "OBS-03",
    "category": "obs-state",
    "description": "Implement fetchScenes() method",
    "steps": [
      "Call GetSceneList OBS API",
      "For each scene, call GetSceneItemList to get sources",
      "Map scene data to OBSScene schema",
      "Implement categorizeScene() helper"
    ],
    "verification": "fetchScenes() returns array of scenes with items",
    "passes": false
  },
  {
    "id": "OBS-04",
    "category": "obs-state",
    "description": "Implement fetchInputs() method",
    "steps": [
      "Call GetInputList OBS API",
      "For each input, call GetInputSettings",
      "Map input data to OBSInput schema"
    ],
    "verification": "fetchInputs() returns array of inputs with settings",
    "passes": false
  },
  {
    "id": "OBS-05",
    "category": "obs-state",
    "description": "Implement extractAudioSources() method",
    "steps": [
      "Filter inputs that have audio capabilities",
      "For each audio input, call GetInputVolume",
      "For each audio input, call GetInputMute",
      "Map to OBSAudioSource schema"
    ],
    "verification": "extractAudioSources() returns audio sources with volumes",
    "passes": false
  },
  {
    "id": "OBS-06",
    "category": "obs-state",
    "description": "Implement fetchTransitions() method",
    "steps": [
      "Call GetSceneTransitionList OBS API",
      "Map transitions to OBSTransition schema",
      "Include transition settings where available"
    ],
    "verification": "fetchTransitions() returns array of transitions",
    "passes": false
  },
  {
    "id": "OBS-07",
    "category": "obs-state",
    "description": "Implement refreshFullState() method",
    "steps": [
      "Call all fetch methods in parallel",
      "Call GetCurrentProgramScene, GetCurrentSceneTransition",
      "Call GetStreamStatus, GetRecordStatus (with error handling)",
      "Call GetVideoSettings, GetStudioModeEnabled",
      "Combine into complete state object",
      "Update lastSync timestamp"
    ],
    "verification": "refreshFullState() returns complete OBSState object",
    "passes": false
  },
  {
    "id": "OBS-08",
    "category": "obs-state",
    "description": "Implement Firebase persistence",
    "steps": [
      "Add saveStateToFirebase() method using productionConfigService",
      "Add loadStateFromFirebase() method",
      "Call saveStateToFirebase() after state changes",
      "Path: competitions/{compId}/obs/state/"
    ],
    "verification": "State persists to Firebase and loads on restart",
    "passes": false
  },
  {
    "id": "OBS-09",
    "category": "obs-state",
    "description": "Implement Socket.io broadcasting",
    "steps": [
      "Add broadcast() helper method",
      "Call io.emit() with event name and payload",
      "Add partial update support (only changed data)",
      "Broadcast on all state changes"
    ],
    "verification": "State changes broadcast to connected clients",
    "passes": false
  },
  {
    "id": "OBS-10",
    "category": "obs-state",
    "description": "Integrate OBSStateSync into server/index.js",
    "steps": [
      "Import OBSStateSync",
      "Create instance after OBS connection established",
      "Call initialize(compId) with active competition",
      "Add periodic sync interval (every 30 seconds)",
      "Handle reconnection with state refresh"
    ],
    "verification": "OBS state syncs on server start and broadcasts to clients",
    "passes": false
  }
]
```

### Phase 1 Verification Commands

```bash
# Test OBS state fetch
curl http://localhost:3003/api/obs/state | jq '.scenes | length'

# Test Firebase persistence
firebase database:get /competitions/test-comp/obs/state --project gymnastics-graphics-dev

# Test Socket.io broadcast
# (Requires client connected, check browser console for obs:stateRefreshed event)
```

---

## Phase 2: Scene CRUD Operations

### Task List

```json
[
  {
    "id": "OBS-11",
    "category": "obs-scene",
    "description": "Create OBSSceneManager class",
    "steps": [
      "Create server/lib/obsSceneManager.js",
      "Implement constructor with OBS instance",
      "Export class"
    ],
    "verification": "File exists and exports OBSSceneManager class",
    "passes": false
  },
  {
    "id": "OBS-12",
    "category": "obs-scene",
    "description": "Implement getScenes() method",
    "steps": [
      "Call GetSceneList from OBS",
      "Return scenes with categorization"
    ],
    "verification": "getScenes() returns categorized scene list",
    "passes": false
  },
  {
    "id": "OBS-13",
    "category": "obs-scene",
    "description": "Implement getScene(sceneName) method",
    "steps": [
      "Get scene from list",
      "Call GetSceneItemList for the scene",
      "Return scene with full item details"
    ],
    "verification": "getScene() returns single scene with items",
    "passes": false
  },
  {
    "id": "OBS-14",
    "category": "obs-scene",
    "description": "Implement createScene(sceneName) method",
    "steps": [
      "Validate scene name (no duplicates)",
      "Call CreateScene OBS API",
      "Handle 'scene already exists' error (code 601)"
    ],
    "verification": "createScene() creates new empty scene in OBS",
    "passes": false
  },
  {
    "id": "OBS-15",
    "category": "obs-scene",
    "description": "Implement duplicateScene(sceneName, newName) method",
    "steps": [
      "Get source scene with items",
      "Create new scene",
      "Copy all scene items with transforms",
      "Return new scene"
    ],
    "verification": "duplicateScene() creates copy with all sources",
    "passes": false
  },
  {
    "id": "OBS-16",
    "category": "obs-scene",
    "description": "Implement renameScene(sceneName, newName) method",
    "steps": [
      "Validate new name doesn't exist",
      "Call SetSceneName OBS API",
      "Update scene category if needed"
    ],
    "verification": "renameScene() changes scene name in OBS",
    "passes": false
  },
  {
    "id": "OBS-17",
    "category": "obs-scene",
    "description": "Implement deleteScene(sceneName) method",
    "steps": [
      "Warn if scene has sources (optional confirmation)",
      "Call RemoveScene OBS API",
      "Handle scene not found error"
    ],
    "verification": "deleteScene() removes scene from OBS",
    "passes": false
  },
  {
    "id": "OBS-18",
    "category": "obs-scene",
    "description": "Implement reorderScenes(sceneOrder) method",
    "steps": [
      "Note: OBS doesn't have native scene reorder API",
      "Alternative: Store custom order in Firebase",
      "Return scenes in custom order"
    ],
    "verification": "Scene order persists in Firebase",
    "passes": false
  },
  {
    "id": "OBS-19",
    "category": "obs-scene",
    "description": "Create /api/obs/scenes routes",
    "steps": [
      "Create server/routes/obs.js",
      "Add GET /api/obs/scenes (list)",
      "Add GET /api/obs/scenes/:sceneName (get)",
      "Add POST /api/obs/scenes (create)",
      "Add POST /api/obs/scenes/:sceneName/duplicate",
      "Add PUT /api/obs/scenes/:sceneName (rename)",
      "Add DELETE /api/obs/scenes/:sceneName"
    ],
    "verification": "All scene endpoints respond correctly",
    "passes": false
  },
  {
    "id": "OBS-20",
    "category": "obs-scene",
    "description": "Add scene change Socket.io events",
    "steps": [
      "Emit obs:sceneCreated on create",
      "Emit obs:sceneDeleted on delete",
      "Emit obs:sceneRenamed on rename",
      "Emit obs:sceneListChanged for any change"
    ],
    "verification": "Scene changes broadcast to clients",
    "passes": false
  }
]
```

### Phase 2 Verification Commands

```bash
# List scenes
curl http://localhost:3003/api/obs/scenes | jq '.'

# Create scene
curl -X POST http://localhost:3003/api/obs/scenes \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Test Scene"}'

# Delete scene
curl -X DELETE http://localhost:3003/api/obs/scenes/Test%20Scene

# Duplicate scene
curl -X POST http://localhost:3003/api/obs/scenes/BRB/duplicate \
  -H "Content-Type: application/json" \
  -d '{"newName": "BRB Copy"}'
```

---

## Phase 3: Source Management

### Task List

```json
[
  {
    "id": "OBS-21",
    "category": "obs-source",
    "description": "Create OBSSourceManager class",
    "steps": [
      "Create server/lib/obsSourceManager.js",
      "Implement constructor with OBS instance",
      "Export class"
    ],
    "verification": "File exists and exports OBSSourceManager class",
    "passes": false
  },
  {
    "id": "OBS-22",
    "category": "obs-source",
    "description": "Implement getInputKinds() method",
    "steps": [
      "Call GetInputKindList OBS API",
      "Return array of available input kinds"
    ],
    "verification": "getInputKinds() returns list of source types",
    "passes": false
  },
  {
    "id": "OBS-23",
    "category": "obs-source",
    "description": "Implement getInputs() method",
    "steps": [
      "Call GetInputList OBS API",
      "For each, get settings and volume if audio",
      "Return full input data"
    ],
    "verification": "getInputs() returns all inputs with settings",
    "passes": false
  },
  {
    "id": "OBS-24",
    "category": "obs-source",
    "description": "Implement createInput() method",
    "steps": [
      "Validate input kind is supported",
      "Call CreateInput OBS API",
      "Return created input with sceneItemId"
    ],
    "verification": "createInput() creates new source in scene",
    "passes": false
  },
  {
    "id": "OBS-25",
    "category": "obs-source",
    "description": "Implement updateInputSettings() method",
    "steps": [
      "Validate input exists",
      "Call SetInputSettings OBS API",
      "Return updated settings"
    ],
    "verification": "updateInputSettings() modifies source settings",
    "passes": false
  },
  {
    "id": "OBS-26",
    "category": "obs-source",
    "description": "Implement deleteInput() method",
    "steps": [
      "Warn if input used in multiple scenes",
      "Call RemoveInput OBS API",
      "Handle input not found error"
    ],
    "verification": "deleteInput() removes source from OBS",
    "passes": false
  },
  {
    "id": "OBS-27",
    "category": "obs-source",
    "description": "Implement getSceneItems() method",
    "steps": [
      "Call GetSceneItemList for scene",
      "Include full transform data",
      "Return ordered by sceneItemIndex"
    ],
    "verification": "getSceneItems() returns scene sources with transforms",
    "passes": false
  },
  {
    "id": "OBS-28",
    "category": "obs-source",
    "description": "Implement addSourceToScene() method",
    "steps": [
      "Call CreateSceneItem OBS API",
      "Apply transform if provided",
      "Return new sceneItemId"
    ],
    "verification": "addSourceToScene() adds existing source to scene",
    "passes": false
  },
  {
    "id": "OBS-29",
    "category": "obs-source",
    "description": "Implement updateSceneItemTransform() method",
    "steps": [
      "Validate scene and item exist",
      "Call SetSceneItemTransform OBS API",
      "Return updated transform"
    ],
    "verification": "updateSceneItemTransform() changes position/scale",
    "passes": false
  },
  {
    "id": "OBS-30",
    "category": "obs-source",
    "description": "Create /api/obs/inputs and /api/obs/scenes/:name/items routes",
    "steps": [
      "Add to server/routes/obs.js",
      "GET /api/obs/inputs",
      "GET /api/obs/inputs/kinds",
      "POST /api/obs/inputs",
      "PUT /api/obs/inputs/:inputName",
      "DELETE /api/obs/inputs/:inputName",
      "GET /api/obs/scenes/:sceneName/items",
      "POST /api/obs/scenes/:sceneName/items",
      "PUT /api/obs/scenes/:sceneName/items/:itemId/transform",
      "PUT /api/obs/scenes/:sceneName/items/:itemId/enabled",
      "DELETE /api/obs/scenes/:sceneName/items/:itemId"
    ],
    "verification": "All input/item endpoints respond correctly",
    "passes": false
  }
]
```

### Phase 3 Verification Commands

```bash
# List input kinds
curl http://localhost:3003/api/obs/inputs/kinds | jq '.'

# List inputs
curl http://localhost:3003/api/obs/inputs | jq '.'

# Create SRT input
curl -X POST http://localhost:3003/api/obs/inputs \
  -H "Content-Type: application/json" \
  -d '{
    "inputName": "Test Camera",
    "inputKind": "ffmpeg_source",
    "inputSettings": {
      "input": "srt://nimble.local:10099",
      "buffering_mb": 2
    },
    "sceneName": "Test Scene"
  }'

# Update transform
curl -X PUT http://localhost:3003/api/obs/scenes/Test%20Scene/items/1/transform \
  -H "Content-Type: application/json" \
  -d '{
    "positionX": 100,
    "positionY": 100,
    "scaleX": 0.5,
    "scaleY": 0.5
  }'
```

---

## Phase 4: Audio Management

### Task List

```json
[
  {
    "id": "OBS-31",
    "category": "obs-audio",
    "description": "Create OBSAudioManager class",
    "steps": [
      "Create server/lib/obsAudioManager.js",
      "Implement constructor with OBS, ConfigService",
      "Export class"
    ],
    "verification": "File exists and exports OBSAudioManager class",
    "passes": false
  },
  {
    "id": "OBS-32",
    "category": "obs-audio",
    "description": "Implement getAudioSources() method",
    "steps": [
      "Filter inputs with audio capabilities",
      "Call GetInputVolume for each",
      "Call GetInputMute for each",
      "Return array of audio sources"
    ],
    "verification": "getAudioSources() returns audio sources with levels",
    "passes": false
  },
  {
    "id": "OBS-33",
    "category": "obs-audio",
    "description": "Implement setVolume() method",
    "steps": [
      "Accept volume in dB or linear (0-1)",
      "Call SetInputVolume OBS API",
      "Return updated volume"
    ],
    "verification": "setVolume() changes audio level in OBS",
    "passes": false
  },
  {
    "id": "OBS-34",
    "category": "obs-audio",
    "description": "Implement setMute() method",
    "steps": [
      "Call SetInputMute OBS API",
      "Return updated mute state"
    ],
    "verification": "setMute() toggles mute in OBS",
    "passes": false
  },
  {
    "id": "OBS-35",
    "category": "obs-audio",
    "description": "Implement setMonitorType() method",
    "steps": [
      "Validate monitor type enum",
      "Call SetInputAudioMonitorType OBS API",
      "Return updated monitor type"
    ],
    "verification": "setMonitorType() changes audio monitoring",
    "passes": false
  },
  {
    "id": "OBS-36",
    "category": "obs-audio",
    "description": "Implement getPresets() method",
    "steps": [
      "Read from Firebase: competitions/{compId}/obs/presets/",
      "Return array of presets"
    ],
    "verification": "getPresets() returns saved presets",
    "passes": false
  },
  {
    "id": "OBS-37",
    "category": "obs-audio",
    "description": "Implement savePreset() method",
    "steps": [
      "Get current audio levels from OBS",
      "Create preset object with levels",
      "Save to Firebase with timestamp",
      "Return saved preset"
    ],
    "verification": "savePreset() persists current mix to Firebase",
    "passes": false
  },
  {
    "id": "OBS-38",
    "category": "obs-audio",
    "description": "Implement loadPreset() method",
    "steps": [
      "Read preset from Firebase",
      "For each source in preset, set volume and mute",
      "Handle missing sources gracefully",
      "Return applied levels"
    ],
    "verification": "loadPreset() applies preset levels to OBS",
    "passes": false
  },
  {
    "id": "OBS-39",
    "category": "obs-audio",
    "description": "Create default audio presets",
    "steps": [
      "Create 5 default presets in Firebase if not exist",
      "commentary-focus, venue-focus, music-bed, all-muted, break-music"
    ],
    "verification": "Default presets exist in Firebase",
    "passes": false
  },
  {
    "id": "OBS-40",
    "category": "obs-audio",
    "description": "Create /api/obs/audio routes",
    "steps": [
      "GET /api/obs/audio (list sources)",
      "PUT /api/obs/audio/:inputName/volume",
      "PUT /api/obs/audio/:inputName/mute",
      "PUT /api/obs/audio/:inputName/monitor",
      "GET /api/obs/audio/presets",
      "POST /api/obs/audio/presets",
      "PUT /api/obs/audio/presets/:presetId (load)",
      "DELETE /api/obs/audio/presets/:presetId"
    ],
    "verification": "All audio endpoints respond correctly",
    "passes": false
  }
]
```

### Phase 4 Verification Commands

```bash
# List audio sources
curl http://localhost:3003/api/obs/audio | jq '.'

# Set volume
curl -X PUT http://localhost:3003/api/obs/audio/Venue%20Audio/volume \
  -H "Content-Type: application/json" \
  -d '{"volumeDb": -12.0}'

# Set mute
curl -X PUT http://localhost:3003/api/obs/audio/Music/mute \
  -H "Content-Type: application/json" \
  -d '{"muted": true}'

# List presets
curl http://localhost:3003/api/obs/audio/presets | jq '.'

# Save preset
curl -X POST http://localhost:3003/api/obs/audio/presets \
  -H "Content-Type: application/json" \
  -d '{"name": "My Mix", "description": "Custom mix"}'

# Load preset
curl -X PUT http://localhost:3003/api/obs/audio/presets/commentary-focus
```

---

## Phase 5: Transition Management

### Task List

```json
[
  {
    "id": "OBS-41",
    "category": "obs-transition",
    "description": "Create OBSTransitionManager class",
    "steps": [
      "Create server/lib/obsTransitionManager.js",
      "Implement constructor with OBS instance",
      "Export class"
    ],
    "verification": "File exists and exports OBSTransitionManager class",
    "passes": false
  },
  {
    "id": "OBS-42",
    "category": "obs-transition",
    "description": "Implement getTransitions() method",
    "steps": [
      "Call GetSceneTransitionList OBS API",
      "Return transitions with current selection"
    ],
    "verification": "getTransitions() returns available transitions",
    "passes": false
  },
  {
    "id": "OBS-43",
    "category": "obs-transition",
    "description": "Implement setCurrentTransition() method",
    "steps": [
      "Call SetCurrentSceneTransition OBS API",
      "Optionally set duration",
      "Return updated transition info"
    ],
    "verification": "setCurrentTransition() changes default transition",
    "passes": false
  },
  {
    "id": "OBS-44",
    "category": "obs-transition",
    "description": "Implement updateTransitionSettings() method",
    "steps": [
      "Get transition settings schema",
      "Call SetSceneTransitionSettings if available",
      "Handle stinger-specific settings"
    ],
    "verification": "updateTransitionSettings() modifies transition config",
    "passes": false
  },
  {
    "id": "OBS-45",
    "category": "obs-transition",
    "description": "Create /api/obs/transitions routes",
    "steps": [
      "GET /api/obs/transitions",
      "GET /api/obs/transitions/current",
      "PUT /api/obs/transitions/current",
      "PUT /api/obs/transitions/duration",
      "PUT /api/obs/transitions/:name/settings"
    ],
    "verification": "All transition endpoints respond correctly",
    "passes": false
  }
]
```

---

## Phase 6: Stream Configuration

### Task List

```json
[
  {
    "id": "OBS-46",
    "category": "obs-stream",
    "description": "Create OBSStreamManager class",
    "steps": [
      "Create server/lib/obsStreamManager.js",
      "Implement constructor with OBS, ConfigService",
      "Export class"
    ],
    "verification": "File exists and exports OBSStreamManager class",
    "passes": false
  },
  {
    "id": "OBS-47",
    "category": "obs-stream",
    "description": "Implement getStreamSettings() method",
    "steps": [
      "Call GetStreamServiceSettings OBS API",
      "Mask stream key in response",
      "Return settings with service info"
    ],
    "verification": "getStreamSettings() returns stream config (key masked)",
    "passes": false
  },
  {
    "id": "OBS-48",
    "category": "obs-stream",
    "description": "Implement setStreamSettings() method",
    "steps": [
      "Validate service type",
      "Call SetStreamServiceSettings OBS API",
      "Save encrypted key to Firebase if provided",
      "Return updated settings (key masked)"
    ],
    "verification": "setStreamSettings() updates stream destination",
    "passes": false
  },
  {
    "id": "OBS-49",
    "category": "obs-stream",
    "description": "Implement startStream() method",
    "steps": [
      "Check stream not already active",
      "Call StartStream OBS API",
      "Return stream status"
    ],
    "verification": "startStream() begins streaming",
    "passes": false
  },
  {
    "id": "OBS-50",
    "category": "obs-stream",
    "description": "Implement stopStream() method",
    "steps": [
      "Call StopStream OBS API",
      "Return final stream stats"
    ],
    "verification": "stopStream() ends streaming",
    "passes": false
  },
  {
    "id": "OBS-51",
    "category": "obs-stream",
    "description": "Implement getStreamStatus() method",
    "steps": [
      "Call GetStreamStatus OBS API",
      "Return status with statistics"
    ],
    "verification": "getStreamStatus() returns current stream state",
    "passes": false
  },
  {
    "id": "OBS-52",
    "category": "obs-stream",
    "description": "Create /api/obs/stream routes",
    "steps": [
      "GET /api/obs/stream/settings",
      "PUT /api/obs/stream/settings",
      "POST /api/obs/stream/start",
      "POST /api/obs/stream/stop",
      "GET /api/obs/stream/status"
    ],
    "verification": "All stream endpoints respond correctly",
    "passes": false
  }
]
```

---

## Phase 7: Asset Management

### Task List

```json
[
  {
    "id": "OBS-53",
    "category": "obs-asset",
    "description": "Create OBSAssetManager class",
    "steps": [
      "Create server/lib/obsAssetManager.js",
      "Implement constructor with SSH helpers, ConfigService",
      "Define asset directory structure",
      "Export class"
    ],
    "verification": "File exists and exports OBSAssetManager class",
    "passes": false
  },
  {
    "id": "OBS-54",
    "category": "obs-asset",
    "description": "Implement listAssets() method",
    "steps": [
      "SSH to VM and list /var/www/assets/ directories",
      "Parse file listings",
      "Read manifest.json if exists",
      "Return asset listing by type"
    ],
    "verification": "listAssets() returns files on VM",
    "passes": false
  },
  {
    "id": "OBS-55",
    "category": "obs-asset",
    "description": "Implement uploadAsset() method",
    "steps": [
      "Validate file type and size",
      "Use ssh_upload_file MCP tool",
      "Update manifest.json",
      "Return upload result"
    ],
    "verification": "uploadAsset() transfers file to VM",
    "passes": false
  },
  {
    "id": "OBS-56",
    "category": "obs-asset",
    "description": "Implement deleteAsset() method",
    "steps": [
      "Validate asset exists",
      "SSH to VM and delete file",
      "Update manifest.json",
      "Return delete result"
    ],
    "verification": "deleteAsset() removes file from VM",
    "passes": false
  },
  {
    "id": "OBS-57",
    "category": "obs-asset",
    "description": "Implement getManifest() method",
    "steps": [
      "Read from Firebase: competitions/{compId}/obs/assets/manifest",
      "Fallback to reading manifest.json from VM",
      "Return asset manifest"
    ],
    "verification": "getManifest() returns asset inventory",
    "passes": false
  },
  {
    "id": "OBS-58",
    "category": "obs-asset",
    "description": "Implement syncManifest() method",
    "steps": [
      "SSH to VM and scan asset directories",
      "Update manifest with current files",
      "Save to both VM and Firebase"
    ],
    "verification": "syncManifest() updates inventory",
    "passes": false
  },
  {
    "id": "OBS-59",
    "category": "obs-asset",
    "description": "Implement installAssetPack() method",
    "steps": [
      "Read pack config from system/assets/packs/",
      "Download pack archive",
      "Extract to VM asset directories",
      "Update manifest"
    ],
    "verification": "installAssetPack() deploys asset pack to VM",
    "passes": false
  },
  {
    "id": "OBS-60",
    "category": "obs-asset",
    "description": "Create /api/obs/assets routes",
    "steps": [
      "GET /api/obs/assets",
      "GET /api/obs/assets/:type",
      "POST /api/obs/assets/upload (multipart)",
      "DELETE /api/obs/assets/:type/:filename",
      "POST /api/obs/assets/sync",
      "POST /api/obs/assets/pack/install"
    ],
    "verification": "All asset endpoints respond correctly",
    "passes": false
  }
]
```

---

## Phase 8: Template System

### Task List

```json
[
  {
    "id": "OBS-61",
    "category": "obs-template",
    "description": "Create OBSTemplateManager class",
    "steps": [
      "Create server/lib/obsTemplateManager.js",
      "Implement constructor with OBS, ConfigService",
      "Export class"
    ],
    "verification": "File exists and exports OBSTemplateManager class",
    "passes": false
  },
  {
    "id": "OBS-62",
    "category": "obs-template",
    "description": "Implement listTemplates() method",
    "steps": [
      "Read from Firebase: templates/obs/",
      "Return list with metadata (not full scene collection)"
    ],
    "verification": "listTemplates() returns available templates",
    "passes": false
  },
  {
    "id": "OBS-63",
    "category": "obs-template",
    "description": "Implement getTemplate() method",
    "steps": [
      "Read full template from Firebase",
      "Include scene collection JSON",
      "Return template with required assets"
    ],
    "verification": "getTemplate() returns full template data",
    "passes": false
  },
  {
    "id": "OBS-64",
    "category": "obs-template",
    "description": "Implement exportCurrentAsTemplate() method",
    "steps": [
      "Get full OBS state",
      "Convert scenes to template format",
      "Replace paths with asset slots",
      "Save to Firebase with metadata"
    ],
    "verification": "exportCurrentAsTemplate() saves current OBS as template",
    "passes": false
  },
  {
    "id": "OBS-65",
    "category": "obs-template",
    "description": "Implement variable substitution",
    "steps": [
      "Create resolveVariables() helper",
      "Handle {{assets.*}}, {{cameras.*}}, {{config.*}}",
      "Resolve from current config and asset manifest"
    ],
    "verification": "Variables resolve correctly in templates",
    "passes": false
  },
  {
    "id": "OBS-66",
    "category": "obs-template",
    "description": "Implement applyTemplate() method",
    "steps": [
      "Validate required assets exist",
      "Resolve all variables",
      "Create scenes with sources",
      "Apply transforms",
      "Report success/failures"
    ],
    "verification": "applyTemplate() creates scenes in OBS from template",
    "passes": false
  },
  {
    "id": "OBS-67",
    "category": "obs-template",
    "description": "Implement validateTemplate() method",
    "steps": [
      "Check required assets exist on VM",
      "Check camera config matches template",
      "Return validation result with missing items"
    ],
    "verification": "validateTemplate() reports missing requirements",
    "passes": false
  },
  {
    "id": "OBS-68",
    "category": "obs-template",
    "description": "Create /api/obs/templates routes",
    "steps": [
      "GET /api/obs/templates",
      "GET /api/obs/templates/:id",
      "POST /api/obs/templates (export current)",
      "POST /api/obs/templates/:id/apply",
      "POST /api/obs/templates/:id/validate",
      "DELETE /api/obs/templates/:id"
    ],
    "verification": "All template endpoints respond correctly",
    "passes": false
  }
]
```

---

## Phase 9: Talent Communication (VDO.Ninja + Discord Fallback)

### Task List

```json
[
  {
    "id": "OBS-69",
    "category": "obs-talent-comms",
    "description": "Create VDO.Ninja room generator service",
    "steps": [
      "Create server/lib/vdoNinjaService.js",
      "Implement generateRoom(competitionId) that creates unique room ID",
      "Generate director URL with room ID",
      "Generate talent URLs (2 slots) with room ID and push IDs",
      "Generate OBS browser source URL for capturing talent audio",
      "Return all URLs in structured object"
    ],
    "verification": "generateRoom() returns valid VDO.Ninja URLs",
    "passes": false
  },
  {
    "id": "OBS-70",
    "category": "obs-talent-comms",
    "description": "Create OBS VDO.Ninja browser source template",
    "steps": [
      "Add 'VDO Talent Audio' browser source to scene template",
      "URL: https://vdo.ninja/?scene&room={{roomId}}",
      "Configure source as hidden (audio only)",
      "Add to OBS template system for new competitions"
    ],
    "verification": "OBS scene template includes VDO.Ninja source",
    "passes": false
  },
  {
    "id": "OBS-71",
    "category": "obs-talent-comms",
    "description": "Implement talent comms Firebase storage",
    "steps": [
      "Store VDO.Ninja config at competitions/{compId}/config/talentComms",
      "Include roomId, obsSceneUrl, talentUrls object",
      "Include method field (vdo-ninja or discord)",
      "Include generatedAt timestamp"
    ],
    "verification": "Talent comms config persists to Firebase",
    "passes": false
  },
  {
    "id": "OBS-72",
    "category": "obs-talent-comms",
    "description": "Create /api/talent-comms routes",
    "steps": [
      "GET /api/talent-comms - returns current config",
      "POST /api/talent-comms/setup - generates VDO.Ninja room",
      "POST /api/talent-comms/regenerate - creates new room ID",
      "PUT /api/talent-comms/method - switch vdo-ninja/discord",
      "GET /api/talent-comms/status - connection status"
    ],
    "verification": "All talent comms endpoints respond correctly",
    "passes": false
  },
  {
    "id": "OBS-73",
    "category": "obs-talent-comms",
    "description": "Create TalentCommsPanel UI component",
    "steps": [
      "Create show-controller/src/components/obs/TalentCommsPanel.jsx",
      "Show method toggle (VDO.Ninja / Discord)",
      "Display talent URLs with copy buttons",
      "Show connection status for each talent",
      "Add regenerate URLs button"
    ],
    "verification": "TalentCommsPanel renders with URLs and status",
    "passes": false
  },
  {
    "id": "OBS-74",
    "category": "obs-talent-comms",
    "description": "Configure Discord fallback on AMI",
    "steps": [
      "Install Discord desktop client on AMI",
      "Log into Discord account, save session",
      "Configure PulseAudio virtual sinks for Discord audio routing",
      "Install NoMachine server, configure for localhost:4000 only",
      "Document SSH tunnel command: ssh -L 4000:localhost:4000 ubuntu@{vmAddress}",
      "Test full Discord fallback workflow"
    ],
    "verification": "Can connect via NoMachine and start Discord stream",
    "passes": false
  },
  {
    "id": "OBS-75",
    "category": "obs-talent-comms",
    "description": "Add talent comms setup to competition creation flow",
    "steps": [
      "Auto-generate VDO.Ninja room when VM assigned to competition",
      "Store URLs in Firebase config",
      "Update OBS browser source URL with room ID"
    ],
    "verification": "New competition has talent URLs generated",
    "passes": false
  }
]
```

### Phase 9 Verification Commands

```bash
# Generate talent comms
curl -X POST http://localhost:3003/api/talent-comms/setup | jq '.'

# Get current config
curl http://localhost:3003/api/talent-comms | jq '.'

# Check Firebase storage
firebase database:get /competitions/{compId}/config/talentComms --project gymnastics-graphics-dev

# Verify OBS browser source
curl http://localhost:3003/api/obs/inputs | jq '.[] | select(.inputName | contains("VDO"))'
```

---

## Phase 10: Preview System

### Task List

```json
[
  {
    "id": "OBS-76",
    "category": "obs-preview",
    "description": "Implement takeScreenshot() method",
    "steps": [
      "Call GetSourceScreenshot OBS API",
      "Use current program scene if no scene specified",
      "Return base64 image data"
    ],
    "verification": "takeScreenshot() returns image data",
    "passes": false
  },
  {
    "id": "OBS-77",
    "category": "obs-preview",
    "description": "Implement studio mode controls",
    "steps": [
      "Implement setStudioModeEnabled()",
      "Implement setPreviewScene()",
      "Implement triggerStudioModeTransition()"
    ],
    "verification": "Studio mode controls work",
    "passes": false
  },
  {
    "id": "OBS-78",
    "category": "obs-preview",
    "description": "Create /api/obs/preview routes",
    "steps": [
      "GET /api/obs/preview/screenshot",
      "GET /api/obs/preview/screenshot/:sceneName"
    ],
    "verification": "Screenshot endpoints respond with images",
    "passes": false
  },
  {
    "id": "OBS-79",
    "category": "obs-preview",
    "description": "Create /api/obs/studio-mode routes",
    "steps": [
      "GET /api/obs/studio-mode",
      "PUT /api/obs/studio-mode",
      "PUT /api/obs/studio-mode/preview",
      "POST /api/obs/studio-mode/transition"
    ],
    "verification": "Studio mode endpoints respond correctly",
    "passes": false
  }
]
```

---

## Phase 11: OBS Manager UI

### Task List

```json
[
  {
    "id": "OBS-80",
    "category": "obs-ui",
    "description": "Create OBSContext provider",
    "steps": [
      "Create show-controller/src/context/OBSContext.jsx",
      "Subscribe to OBS socket events",
      "Expose state and actions",
      "Handle loading and error states"
    ],
    "verification": "OBSContext provides OBS state to components",
    "passes": false
  },
  {
    "id": "OBS-81",
    "category": "obs-ui",
    "description": "Create useOBS hook",
    "steps": [
      "Create show-controller/src/hooks/useOBS.js",
      "Provide convenience methods for OBS operations",
      "Include error handling"
    ],
    "verification": "useOBS hook provides OBS functionality",
    "passes": false
  },
  {
    "id": "OBS-82",
    "category": "obs-ui",
    "description": "Create OBSManager page component",
    "steps": [
      "Create show-controller/src/pages/OBSManager.jsx",
      "Add tab navigation (Scenes, Sources, Audio, etc.)",
      "Include connection status header",
      "Include current output panel"
    ],
    "verification": "OBS Manager page renders with tabs",
    "passes": false
  },
  {
    "id": "OBS-83",
    "category": "obs-ui",
    "description": "Add route for OBS Manager",
    "steps": [
      "Update App.jsx with /:compId/obs-manager route",
      "Wrap with OBSContext provider"
    ],
    "verification": "Route /{compId}/obs-manager loads OBS Manager",
    "passes": false
  },
  {
    "id": "OBS-84",
    "category": "obs-ui",
    "description": "Create OBSConnectionStatus component",
    "steps": [
      "Create show-controller/src/components/obs/OBSConnectionStatus.jsx",
      "Show connected/disconnected state",
      "Show last sync time",
      "Include reconnect button"
    ],
    "verification": "Connection status displays correctly",
    "passes": false
  },
  {
    "id": "OBS-85",
    "category": "obs-ui",
    "description": "Create OBSCurrentOutput component",
    "steps": [
      "Create show-controller/src/components/obs/OBSCurrentOutput.jsx",
      "Show preview screenshot (refreshable)",
      "Show current scene name",
      "Show stream status and stats",
      "Include stream start/stop buttons"
    ],
    "verification": "Current output panel shows preview and status",
    "passes": false
  },
  {
    "id": "OBS-86",
    "category": "obs-ui",
    "description": "Create SceneList component",
    "steps": [
      "Create show-controller/src/components/obs/SceneList.jsx",
      "List scenes grouped by category",
      "Show source count per scene",
      "Include create, edit, duplicate, delete actions"
    ],
    "verification": "Scene list shows all scenes with actions",
    "passes": false
  },
  {
    "id": "OBS-87",
    "category": "obs-ui",
    "description": "Create SceneEditor component",
    "steps": [
      "Create show-controller/src/components/obs/SceneEditor.jsx",
      "Show scene items with transforms",
      "Allow item reordering",
      "Allow visibility toggle",
      "Open source editor on item click"
    ],
    "verification": "Scene editor allows item management",
    "passes": false
  },
  {
    "id": "OBS-88",
    "category": "obs-ui",
    "description": "Create SourceEditor component",
    "steps": [
      "Create show-controller/src/components/obs/SourceEditor.jsx",
      "Show transform controls (position, scale, crop)",
      "Show source-specific settings",
      "Include transform preset buttons"
    ],
    "verification": "Source editor allows transform editing",
    "passes": false
  },
  {
    "id": "OBS-89",
    "category": "obs-ui",
    "description": "Create AudioMixer component",
    "steps": [
      "Create show-controller/src/components/obs/AudioMixer.jsx",
      "List all audio sources with sliders",
      "Include mute toggles",
      "Show audio level meters (if feasible)",
      "Include preset selector"
    ],
    "verification": "Audio mixer shows sources with controls",
    "passes": false
  },
  {
    "id": "OBS-90",
    "category": "obs-ui",
    "description": "Create AudioPresetManager component",
    "steps": [
      "Create show-controller/src/components/obs/AudioPresetManager.jsx",
      "List saved presets",
      "Allow load preset",
      "Allow save current as preset",
      "Allow delete preset"
    ],
    "verification": "Preset manager allows CRUD operations",
    "passes": false
  },
  {
    "id": "OBS-91",
    "category": "obs-ui",
    "description": "Create TransitionPicker component",
    "steps": [
      "Create show-controller/src/components/obs/TransitionPicker.jsx",
      "List available transitions",
      "Show duration input for configurable transitions",
      "Include preview button (optional)"
    ],
    "verification": "Transition picker allows selection and config",
    "passes": false
  },
  {
    "id": "OBS-92",
    "category": "obs-ui",
    "description": "Create StreamConfig component",
    "steps": [
      "Create show-controller/src/components/obs/StreamConfig.jsx",
      "Show current destination",
      "Allow changing service/server",
      "Secure stream key input",
      "Show output settings (read-only or editable)"
    ],
    "verification": "Stream config allows destination changes",
    "passes": false
  },
  {
    "id": "OBS-93",
    "category": "obs-ui",
    "description": "Create AssetManager component",
    "steps": [
      "Create show-controller/src/components/obs/AssetManager.jsx",
      "List assets by type",
      "Include upload dropzone",
      "Allow delete assets",
      "Show asset pack installation option"
    ],
    "verification": "Asset manager allows file operations",
    "passes": false
  },
  {
    "id": "OBS-94",
    "category": "obs-ui",
    "description": "Create TemplateManager component",
    "steps": [
      "Create show-controller/src/components/obs/TemplateManager.jsx",
      "List available templates",
      "Show template details",
      "Include apply template button with validation",
      "Include export current as template"
    ],
    "verification": "Template manager allows import/export",
    "passes": false
  },
  {
    "id": "OBS-95",
    "category": "obs-ui",
    "description": "Create CreateSceneModal component",
    "steps": [
      "Modal for creating new scene",
      "Name input with validation",
      "Option to copy from existing",
      "Option to use template"
    ],
    "verification": "Create scene modal works",
    "passes": false
  },
  {
    "id": "OBS-96",
    "category": "obs-ui",
    "description": "Create AddSourceModal component",
    "steps": [
      "Modal for adding source to scene",
      "Source type selector",
      "Source-specific settings form",
      "Transform preset selector"
    ],
    "verification": "Add source modal works",
    "passes": false
  },
  {
    "id": "OBS-97",
    "category": "obs-ui",
    "description": "Integrate TalentCommsPanel into OBS Manager",
    "steps": [
      "Add Talent Comms tab to OBS Manager",
      "Import TalentCommsPanel component",
      "Connect to talent-comms API endpoints",
      "Test URL generation and display"
    ],
    "verification": "Talent Comms tab shows URLs and status",
    "passes": false
  },
  {
    "id": "OBS-98",
    "category": "obs-ui",
    "description": "Deploy and verify on test server",
    "steps": [
      "Build with VITE_FIREBASE_ENV=dev",
      "Deploy to test server",
      "Verify all tabs function",
      "Test with real OBS connection",
      "Test VDO.Ninja URL generation"
    ],
    "verification": "OBS Manager fully functional on test server",
    "passes": false
  }
]
```

---

## Progress Tracking

### Overall Progress

| Phase | Tasks | Completed | Pass Rate |
|-------|-------|-----------|-----------|
| Phase 1: State Sync | 10 | 0 | 0% |
| Phase 2: Scene CRUD | 10 | 0 | 0% |
| Phase 3: Source Mgmt | 10 | 0 | 0% |
| Phase 4: Audio | 10 | 0 | 0% |
| Phase 5: Transitions | 5 | 0 | 0% |
| Phase 6: Stream | 7 | 0 | 0% |
| Phase 7: Assets | 8 | 0 | 0% |
| Phase 8: Templates | 8 | 0 | 0% |
| Phase 9: Talent Comms | 7 | 0 | 0% |
| Phase 10: Preview | 4 | 0 | 0% |
| Phase 11: UI | 19 | 0 | 0% |
| **TOTAL** | **98** | **0** | **0%** |

### Milestone Targets

| Milestone | Target Date | Dependencies | Status |
|-----------|-------------|--------------|--------|
| State Sync Complete | TBD | None | Not Started |
| Scene CRUD Complete | TBD | State Sync | Not Started |
| Source Mgmt Complete | TBD | Scene CRUD | Not Started |
| Audio Complete | TBD | State Sync | Not Started |
| Backend Complete | TBD | All backend phases | Not Started |
| UI Complete | TBD | Backend Complete | Not Started |
| Integration Testing | TBD | UI Complete | Not Started |

---

## Test Environment Commands

### Deploy to Test Server

```bash
# Build frontend with dev Firebase
cd show-controller && VITE_FIREBASE_ENV=dev npm run build

# Create tarball
tar -czf /tmp/claude/dist.tar.gz -C dist .

# Upload to test server (use MCP tool)
# ssh_upload_file: localPath=/tmp/claude/dist.tar.gz, remotePath=/tmp/dist.tar.gz, target=coordinator

# Extract on server (use MCP tool)
# ssh_exec: target=coordinator, command="sudo rm -rf /var/www/gymnastics-test/* && sudo tar -xzf /tmp/dist.tar.gz -C /var/www/gymnastics-test/ && sudo find /var/www/gymnastics-test -name '._*' -delete", sudo=true

# Verify deployment
# browser_navigate: url=http://44.193.31.120:8080/{compId}/obs-manager
# browser_take_screenshot
```

### Test API Endpoints

```bash
# Full state
curl http://localhost:3003/api/obs/state | jq '.'

# Scenes
curl http://localhost:3003/api/obs/scenes | jq '.scenes | length'

# Audio
curl http://localhost:3003/api/obs/audio | jq '.'

# Stream status
curl http://localhost:3003/api/obs/stream/status | jq '.'
```

### Firebase Verification

```bash
# Check OBS state cached
firebase database:get /competitions/{compId}/obs/state --project gymnastics-graphics-dev

# Check audio presets
firebase database:get /competitions/{compId}/obs/presets --project gymnastics-graphics-dev

# Check templates
firebase database:get /templates/obs --project gymnastics-graphics-dev
```

---

## Notes and Considerations

### Technical Notes

1. **OBS WebSocket Version** - OBS 28+ has built-in WebSocket server. Earlier versions need obs-websocket plugin.

2. **Audio Level Metering** - OBS doesn't expose real-time audio levels via WebSocket. Level meters would require additional tooling or estimation.

3. **Scene Reordering** - OBS doesn't have a native API to reorder scenes in the UI. We store custom order in Firebase.

4. **Stream Key Security** - Keys are encrypted in Firebase. Consider using a dedicated secrets manager for production.

5. **Asset Upload Size** - Large files should be uploaded directly to VM via SCP, not through Express.

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OBS disconnection during operation | Graceful error handling, auto-reconnect |
| Firebase rate limits | Batch updates, debounce rapid changes |
| Large template files | Compress scene collection JSON |
| SSH timeouts | Increase timeout for large uploads |
| Concurrent edits | Firebase real-time sync, conflict warnings |

### Future Enhancements

1. **Real-time audio meters** - Integrate with OBS audio monitoring tools
2. **Scene preview stream** - Low-latency preview instead of screenshots
3. **Multi-VM management** - Control multiple OBS instances from one UI
4. **Recording management** - Full recording controls and file management
5. **Virtual camera output** - Configure virtual camera for other apps
