# PRD: Comprehensive OBS Integration Tool

**Version:** 1.0
**Date:** 2026-01-16
**Project:** Gymnastics Graphics
**Status:** Draft

---

## Executive Summary

This PRD defines a comprehensive OBS Integration Tool that extends the existing gymnastics live-streaming show controller system. The tool provides full scene management, source management, audio routing, talent communication (VDO.Ninja + Discord fallback), asset management, stream configuration, and OBS templates. This tool serves as the foundation for the Advanced Rundown Editor and is designed for headless OBS instances running on Ubuntu VMs with one VM per competition.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1: OBS State Sync Service](#phase-1-obs-state-sync-service)
4. [Phase 2: Scene CRUD Operations](#phase-2-scene-crud-operations)
5. [Phase 3: Source Management](#phase-3-source-management)
6. [Phase 4: Audio Management](#phase-4-audio-management)
7. [Phase 5: Transition Management](#phase-5-transition-management)
8. [Phase 6: Stream Configuration](#phase-6-stream-configuration)
9. [Phase 7: Asset Management](#phase-7-asset-management)
10. [Phase 8: OBS Template System](#phase-8-obs-template-system)
11. [Phase 9: Talent Communication (VDO.Ninja + Discord Fallback)](#phase-9-talent-communication-vdoninja--discord-fallback)
12. [Phase 10: Preview System](#phase-10-preview-system)
13. [Phase 11: OBS Manager UI](#phase-11-obs-manager-ui)
14. [Data Models](#data-models)
15. [API Specification](#api-specification)
16. [Socket Event Specification](#socket-event-specification)
17. [File Manifest](#file-manifest)
18. [Success Criteria](#success-criteria)

---

## 1. Current State Analysis

### Existing OBS Integration

The system currently has basic OBS integration via `obs-websocket-js`:

**Backend State (`server/index.js:81-99`):**
```javascript
showState = {
  obsConnected: false,        // WebSocket connection status
  obsCurrentScene: null,      // Current scene name
  obsIsStreaming: false,      // Stream output active
  obsIsRecording: false,      // Recording active
}
```

**Current API Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/scenes` | List all OBS scenes (names only) |
| POST | `/api/scenes/generate` | Auto-generate scenes from camera config |
| GET | `/api/scenes/preview` | Preview what scenes would be generated |
| DELETE | `/api/scenes/generated` | Remove auto-generated scenes |

**Current Socket Events:**
| Event | Direction | Purpose |
|-------|-----------|---------|
| `overrideScene` | Client → Server | Switch to scene |
| `overrideCamera` | Client → Server | Switch to camera's scene |
| `sceneChanged` | Server → Client | Scene switched notification |
| `stateUpdate` | Server → Client | Full state broadcast |

**Current OBS WebSocket Calls:**
- Scene: `GetSceneList`, `CreateScene`, `RemoveScene`, `SetCurrentProgramScene`, `GetCurrentProgramScene`
- Input: `CreateInput`, `GetInputSettings`, `SetInputSettings`
- Scene Items: `CreateSceneItem`, `SetSceneItemTransform`, `SetSceneItemIndex`
- Transitions: `SetCurrentSceneTransition`, `SetCurrentSceneTransitionDuration`

**Existing Scene Generator (`server/lib/obsSceneGenerator.js`):**
- Generates scenes based on camera count
- Static scenes: Starting Soon, BRB, Thanks for Watching
- Single/Dual/Triple/Quad camera combinations
- Transform presets for 1920x1080 canvas

### Gaps to Address

1. **No full scene CRUD** - Cannot create/rename/reorder scenes manually
2. **No source management** - Cannot add/remove/edit sources within scenes
3. **No audio controls** - No volume/mute management
4. **No transition management** - Limited transition configuration
5. **No stream configuration** - Cannot set destinations/keys from UI
6. **No asset management** - No upload/download of media assets
7. **No template system** - Cannot import/export scene collections
8. **No talent communication** - No VDO.Ninja or Discord integration for remote talent
9. **No remote preview** - Headless OBS has no preview solution
10. **State not persisted** - OBS state lost on reconnect

---

## 2. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  OBS Manager    │  │  Producer View  │  │  Rundown Editor │             │
│  │  /{compId}/obs  │  │  /{compId}/     │  │  /{compId}/     │             │
│  │                 │  │    producer     │  │    rundown      │             │
│  │ - Scene CRUD    │  │ - Scene Switch  │  │ - Scene Picker  │             │
│  │ - Source Mgmt   │  │ - Quick Actions │  │ - Audio Preset  │             │
│  │ - Audio Config  │  │ - Stream Status │  │ - Transitions   │             │
│  │ - Stream Config │  │                 │  │                 │             │
│  │ - Asset Upload  │  │                 │  │                 │             │
│  │ - Templates     │  │                 │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                          Socket.io                                          │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│                              BACKEND (Node.js/Express)                       │
│                                │                                            │
│  ┌─────────────────────────────┼─────────────────────────────────────────┐ │
│  │                    OBS State Sync Service                              │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │ Scene Cache  │  │ Source Cache │  │ Audio Cache  │                │ │
│  │  │ - All scenes │  │ - All inputs │  │ - All sources│                │ │
│  │  │ - Categories │  │ - Settings   │  │ - Volumes    │                │ │
│  │  │ - Items      │  │ - Kinds      │  │ - Mute state │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │ Transition   │  │ Stream       │  │ Recording    │                │ │
│  │  │ Cache        │  │ Cache        │  │ Cache        │                │ │
│  │  │ - Available  │  │ - Status     │  │ - Status     │                │ │
│  │  │ - Current    │  │ - Settings   │  │ - Path       │                │ │
│  │  │ - Duration   │  │ - Stats      │  │ - Stats      │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                │                                            │
│                          obs-websocket-js                                   │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                           WebSocket
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│                         COMPETITION VM (Ubuntu)                              │
│                                │                                            │
│  ┌─────────────────────────────┼───────────────────────────────────────┐   │
│  │                         OBS Studio                                   │   │
│  │                                                                      │   │
│  │   Scenes            Sources           Outputs                        │   │
│  │   ├─ Single Cam 1   ├─ SRT Inputs     ├─ Stream (RTMP)              │   │
│  │   ├─ Single Cam 2   ├─ Browser        ├─ Recording                  │   │
│  │   ├─ Dual Cam       ├─ Media          ├─ Virtual Cam                │   │
│  │   ├─ BRB            ├─ Discord Audio  └─ Projector                  │   │
│  │   └─ Graphics       └─ Music                                        │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────┐     │
│  │   Discord   │  │   Assets    │  │   Node.js Server                │     │
│  │   (Desktop) │  │   /assets/  │  │   - Socket.io                   │     │
│  │   - Talent  │  │   - music/  │  │   - Express API                 │     │
│  │   - Audio   │  │   - stinger │  │   - Firebase sync               │     │
│  │   - Screen  │  │   - bg/     │  │   - OBS WebSocket               │     │
│  │     Share   │  │   - logos/  │  │                                 │     │
│  └─────────────┘  └─────────────┘  └─────────────────────────────────┘     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Firebase Data Architecture

```
/competitions/{compId}/
├── config/                          # Competition metadata
│   ├── eventName
│   ├── gender
│   ├── compType
│   ├── vmAddress
│   └── ...
│
├── production/
│   ├── cameras/                     # Camera configuration
│   ├── rundown/                     # Timing segments
│   └── settings/                    # Production settings
│
└── obs/                             # NEW: OBS configuration
    ├── state/                       # Cached OBS state (for offline/disconnect)
    │   ├── lastSync: timestamp
    │   ├── scenes: [...]
    │   ├── sources: [...]
    │   ├── audioSources: [...]
    │   ├── transitions: [...]
    │   └── streamSettings: {...}
    │
    ├── presets/                     # Audio presets
    │   ├── commentary-focus/
    │   ├── venue-focus/
    │   └── music-bed/
    │
    ├── assets/                      # Asset manifest
    │   ├── music/
    │   ├── stingers/
    │   ├── backgrounds/
    │   └── logos/
    │
    └── customScenes/                # User-created scene definitions
        ├── {sceneId}/
        │   ├── name
        │   ├── sources: [...]
        │   └── createdBy
        └── ...

/templates/                          # Global templates
├── obs/                             # OBS scene collection templates
│   ├── {templateId}/
│   │   ├── name
│   │   ├── description
│   │   ├── meetType
│   │   ├── sceneCollection: {...}   # Full OBS export JSON
│   │   └── assetManifest: {...}     # Required assets
│   └── ...
│
└── rundown/                         # Rundown templates (Phase 2)
    └── ...

/system/
├── graphics/
│   └── registry/                    # Graphics registry (for Rundown Editor)
└── assets/                          # Central asset library
    └── music/
        └── standard-pack/           # Downloadable asset packs
```

---

## Phase 1: OBS State Sync Service

### Overview

Create a comprehensive OBS state synchronization service that maintains a real-time cache of OBS state and persists it to Firebase for offline access and cross-session persistence.

### Requirements

1. **Real-time State Cache**
   - Maintain in-memory cache of all OBS state
   - Update cache on OBS events
   - Poll for state on reconnect

2. **Firebase Persistence**
   - Persist state to `competitions/{compId}/obs/state/`
   - Restore state on server restart
   - Sync state across multiple frontend instances

3. **Event Broadcasting**
   - Broadcast state changes via Socket.io
   - Support partial updates (only changed data)
   - Include timestamp for ordering

### OBS State Cache Schema

```javascript
const obsStateCache = {
  connected: false,
  lastSync: null,           // ISO timestamp
  connectionError: null,    // Error message if disconnected

  scenes: [
    {
      name: "Single - Camera 1",
      index: 0,                     // Scene order
      category: "generated-single", // Categorization
      sceneItems: [
        {
          sceneItemId: 1,
          sourceName: "Camera 1 SRT",
          sourceKind: "ffmpeg_source",
          sceneItemEnabled: true,
          sceneItemLocked: false,
          sceneItemIndex: 0,        // Layer order (z-index)
          sceneItemTransform: {
            positionX: 0,
            positionY: 0,
            scaleX: 1.0,
            scaleY: 1.0,
            cropLeft: 0,
            cropRight: 0,
            cropTop: 0,
            cropBottom: 0
          }
        }
      ]
    }
  ],

  inputs: [
    {
      inputName: "Camera 1 SRT",
      inputKind: "ffmpeg_source",
      inputSettings: {
        input: "srt://nimble.local:10001",
        buffering_mb: 2,
        reconnect_delay_sec: 5,
        hw_decode: true
      },
      unversionedInputSettings: {}  // Settings that vary per OBS version
    }
  ],

  audioSources: [
    {
      inputName: "Venue Audio",
      inputKind: "wasapi_input_capture",
      inputVolumeDb: -6.0,
      inputVolumeMul: 0.5,        // Linear 0-1
      inputMuted: false,
      inputAudioMonitorType: "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT"
    }
  ],

  transitions: [
    {
      transitionName: "Cut",
      transitionKind: "cut_transition",
      transitionConfigurable: false,
      transitionFixed: true
    },
    {
      transitionName: "Fade",
      transitionKind: "fade_transition",
      transitionConfigurable: true,
      transitionFixed: false,
      transitionSettings: {
        transition_point: 500
      }
    },
    {
      transitionName: "Stinger",
      transitionKind: "stinger_transition",
      transitionConfigurable: true,
      transitionFixed: false,
      transitionSettings: {
        path: "/assets/stingers/main.webm",
        transition_point: 250
      }
    }
  ],

  currentScene: "Single - Camera 1",
  currentTransition: "Cut",
  currentTransitionDuration: 0,

  studioModeEnabled: false,
  previewScene: null,           // Only set if studio mode enabled

  streaming: {
    active: false,
    reconnecting: false,
    timecode: "00:00:00",
    bytesPerSec: 0,
    kbitsPerSec: 0,
    totalStreamTime: 0,
    numTotalFrames: 0,
    numDroppedFrames: 0,
    outputSkippedFrames: 0,
    outputCongestion: 0
  },

  recording: {
    active: false,
    paused: false,
    timecode: "00:00:00",
    outputBytes: 0,
    outputDuration: 0,
    outputPath: ""
  },

  videoSettings: {
    baseWidth: 1920,
    baseHeight: 1080,
    outputWidth: 1920,
    outputHeight: 1080,
    fpsNumerator: 60,
    fpsDenominator: 1
  }
};
```

### Scene Categories

Scenes are categorized for better UX in pickers:

| Category | Source | Description |
|----------|--------|-------------|
| `generated-single` | OBS Scene Generator | Single camera scenes |
| `generated-multi` | OBS Scene Generator | Dual/Triple/Quad scenes |
| `static` | OBS Scene Generator | BRB, Starting Soon, Thanks |
| `graphics` | OBS Scene Generator | Graphics Fullscreen |
| `manual` | User-created in OBS | Custom scenes |
| `template` | Imported from template | Template-based scenes |

### New File: `server/lib/obsStateSync.js`

```javascript
/**
 * OBS State Synchronization Service
 *
 * Maintains real-time cache of OBS state with Firebase persistence.
 * Broadcasts state changes to all connected clients via Socket.io.
 */

const EventEmitter = require('events');

class OBSStateSync extends EventEmitter {
  constructor(obs, io, productionConfigService) {
    super();
    this.obs = obs;                    // OBS WebSocket instance
    this.io = io;                      // Socket.io instance
    this.configService = productionConfigService;
    this.compId = null;                // Active competition ID
    this.state = this.getInitialState();
    this.syncInterval = null;
    this.reconnectTimeout = null;
  }

  getInitialState() {
    return {
      connected: false,
      lastSync: null,
      connectionError: null,
      scenes: [],
      inputs: [],
      audioSources: [],
      transitions: [],
      currentScene: null,
      currentTransition: null,
      currentTransitionDuration: 0,
      studioModeEnabled: false,
      previewScene: null,
      streaming: { active: false },
      recording: { active: false },
      videoSettings: {}
    };
  }

  async initialize(compId) {
    this.compId = compId;

    // Load cached state from Firebase
    const cachedState = await this.loadStateFromFirebase();
    if (cachedState) {
      this.state = { ...this.state, ...cachedState };
    }

    // Register OBS event handlers
    this.registerEventHandlers();

    // Start periodic sync
    this.startPeriodicSync();
  }

  registerEventHandlers() {
    // Scene events
    this.obs.on('SceneListChanged', () => this.refreshScenes());
    this.obs.on('CurrentProgramSceneChanged', (data) => this.onSceneChanged(data));
    this.obs.on('SceneItemListReindexed', (data) => this.onSceneItemsReordered(data));
    this.obs.on('SceneItemCreated', (data) => this.onSceneItemCreated(data));
    this.obs.on('SceneItemRemoved', (data) => this.onSceneItemRemoved(data));
    this.obs.on('SceneItemEnableStateChanged', (data) => this.onSceneItemVisibilityChanged(data));
    this.obs.on('SceneItemTransformChanged', (data) => this.onSceneItemTransformChanged(data));

    // Input events
    this.obs.on('InputCreated', (data) => this.onInputCreated(data));
    this.obs.on('InputRemoved', (data) => this.onInputRemoved(data));
    this.obs.on('InputNameChanged', (data) => this.onInputRenamed(data));
    this.obs.on('InputSettingsChanged', (data) => this.onInputSettingsChanged(data));

    // Audio events
    this.obs.on('InputVolumeChanged', (data) => this.onVolumeChanged(data));
    this.obs.on('InputMuteStateChanged', (data) => this.onMuteChanged(data));
    this.obs.on('InputAudioMonitorTypeChanged', (data) => this.onMonitorTypeChanged(data));

    // Transition events
    this.obs.on('SceneTransitionStarted', (data) => this.onTransitionStarted(data));
    this.obs.on('SceneTransitionEnded', (data) => this.onTransitionEnded(data));
    this.obs.on('CurrentSceneTransitionChanged', (data) => this.onCurrentTransitionChanged(data));
    this.obs.on('CurrentSceneTransitionDurationChanged', (data) => this.onTransitionDurationChanged(data));

    // Stream/Recording events
    this.obs.on('StreamStateChanged', (data) => this.onStreamStateChanged(data));
    this.obs.on('RecordStateChanged', (data) => this.onRecordStateChanged(data));

    // Studio mode events
    this.obs.on('StudioModeStateChanged', (data) => this.onStudioModeChanged(data));
    this.obs.on('CurrentPreviewSceneChanged', (data) => this.onPreviewSceneChanged(data));

    // Connection events
    this.obs.on('ConnectionClosed', () => this.onDisconnected());
    this.obs.on('ConnectionError', (error) => this.onConnectionError(error));
  }

  async refreshFullState() {
    try {
      const [
        scenes,
        inputs,
        transitions,
        currentScene,
        currentTransition,
        streamStatus,
        recordStatus,
        videoSettings,
        studioMode
      ] = await Promise.all([
        this.fetchScenes(),
        this.fetchInputs(),
        this.fetchTransitions(),
        this.obs.call('GetCurrentProgramScene'),
        this.obs.call('GetCurrentSceneTransition'),
        this.obs.call('GetStreamStatus').catch(() => null),
        this.obs.call('GetRecordStatus').catch(() => null),
        this.obs.call('GetVideoSettings'),
        this.obs.call('GetStudioModeEnabled').catch(() => ({ studioModeEnabled: false }))
      ]);

      this.state = {
        ...this.state,
        connected: true,
        lastSync: new Date().toISOString(),
        connectionError: null,
        scenes,
        inputs,
        audioSources: this.extractAudioSources(inputs),
        transitions,
        currentScene: currentScene.sceneName || currentScene.currentProgramSceneName,
        currentTransition: currentTransition.transitionName,
        currentTransitionDuration: currentTransition.transitionDuration,
        studioModeEnabled: studioMode.studioModeEnabled,
        streaming: streamStatus ? this.mapStreamStatus(streamStatus) : { active: false },
        recording: recordStatus ? this.mapRecordStatus(recordStatus) : { active: false },
        videoSettings
      };

      // Persist to Firebase
      await this.saveStateToFirebase();

      // Broadcast to clients
      this.broadcast('obsStateRefreshed', this.state);

      return this.state;
    } catch (error) {
      console.error('Failed to refresh OBS state:', error);
      throw error;
    }
  }

  async fetchScenes() {
    const { scenes } = await this.obs.call('GetSceneList');
    const scenesWithItems = await Promise.all(
      scenes.map(async (scene, index) => {
        const { sceneItems } = await this.obs.call('GetSceneItemList', { sceneName: scene.sceneName });
        return {
          name: scene.sceneName,
          index,
          category: this.categorizeScene(scene.sceneName),
          sceneItems: sceneItems.map(item => ({
            sceneItemId: item.sceneItemId,
            sourceName: item.sourceName,
            sourceKind: item.inputKind,
            sceneItemEnabled: item.sceneItemEnabled,
            sceneItemLocked: item.sceneItemLocked,
            sceneItemIndex: item.sceneItemIndex,
            sceneItemTransform: item.sceneItemTransform
          }))
        };
      })
    );
    return scenesWithItems;
  }

  categorizeScene(sceneName) {
    // Generated single camera scenes
    if (/^Single\s*-/.test(sceneName)) return 'generated-single';
    // Generated multi-camera scenes
    if (/^(Dual|Triple|Quad)\s*-/.test(sceneName)) return 'generated-multi';
    // Static scenes
    if (['Starting Soon', 'BRB', 'Thanks for Watching'].includes(sceneName)) return 'static';
    // Graphics scenes
    if (/Graphics/.test(sceneName)) return 'graphics';
    // Default to manual
    return 'manual';
  }

  // ... additional methods
}

module.exports = OBSStateSync;
```

### Acceptance Criteria

- [ ] OBS state cache contains all scenes with items and transforms
- [ ] OBS state cache contains all inputs with settings
- [ ] OBS state cache contains all audio sources with volumes/mute
- [ ] OBS state cache contains all transitions with settings
- [ ] State persists to Firebase on every change
- [ ] State restores from Firebase on server restart
- [ ] State broadcasts to all connected clients via Socket.io
- [ ] Disconnection handled gracefully with reconnect
- [ ] Scene categories correctly assigned

---

## Phase 2: Scene CRUD Operations

### Overview

Enable full Create, Read, Update, Delete operations for OBS scenes with real-time sync.

### Requirements

1. **Create Scene**
   - Create empty scene
   - Create scene from template
   - Duplicate existing scene

2. **Read Scenes**
   - List all scenes with items
   - Get single scene details
   - Filter by category

3. **Update Scene**
   - Rename scene
   - Reorder scenes

4. **Delete Scene**
   - Delete single scene
   - Delete multiple scenes
   - Warning for scenes with sources

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/scenes` | List all scenes with items |
| GET | `/api/obs/scenes/:sceneName` | Get scene details |
| POST | `/api/obs/scenes` | Create new scene |
| POST | `/api/obs/scenes/:sceneName/duplicate` | Duplicate scene |
| PUT | `/api/obs/scenes/:sceneName` | Update scene (rename) |
| PUT | `/api/obs/scenes/reorder` | Reorder scenes |
| DELETE | `/api/obs/scenes/:sceneName` | Delete scene |

### Scene Creation Request

```json
{
  "sceneName": "Interview Setup",
  "copyFrom": null,
  "template": null
}
```

### Scene Duplicate Request

```json
{
  "newName": "Interview Setup - Alt"
}
```

### Scene Reorder Request

```json
{
  "sceneOrder": [
    "Starting Soon",
    "Single - Camera 1",
    "Single - Camera 2",
    "Dual - Camera 1 + Camera 2",
    "Interview Setup",
    "BRB",
    "Thanks for Watching"
  ]
}
```

### Acceptance Criteria

- [ ] Can create empty scene via API
- [ ] Can duplicate existing scene with all sources
- [ ] Can rename scene with validation (no duplicates)
- [ ] Can reorder scenes
- [ ] Can delete scene with confirmation
- [ ] Scene changes sync to all clients in real-time
- [ ] Scene changes persist to Firebase cache

---

## Phase 3: Source Management

### Overview

Enable management of sources (inputs) within scenes including position, scale, visibility, and layer ordering.

### Requirements

1. **Source Types Supported**
   - SRT/Media Source (`ffmpeg_source`)
   - Browser Source (`browser_source`)
   - Image (`image_source`)
   - VLC Video Source (`vlc_source`)
   - Color Source (`color_source_v3`)
   - Application Audio Capture (`wasapi_process_output_capture`)
   - Audio Input Capture (`wasapi_input_capture`)
   - Display/Window Capture (`monitor_capture`, `window_capture`)

2. **Source Operations**
   - Add source to scene
   - Remove source from scene
   - Edit source properties (transform)
   - Edit source settings (URLs, paths)
   - Toggle visibility
   - Reorder layers (z-index)
   - Lock/unlock transform

3. **Transform Properties**
   - Position (X, Y)
   - Scale (X, Y)
   - Rotation
   - Crop (Top, Bottom, Left, Right)
   - Bounding box type
   - Alignment

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/inputs` | List all inputs |
| GET | `/api/obs/inputs/kinds` | List available input kinds |
| POST | `/api/obs/inputs` | Create new input |
| GET | `/api/obs/inputs/:inputName` | Get input settings |
| PUT | `/api/obs/inputs/:inputName` | Update input settings |
| DELETE | `/api/obs/inputs/:inputName` | Delete input |
| GET | `/api/obs/scenes/:sceneName/items` | List items in scene |
| POST | `/api/obs/scenes/:sceneName/items` | Add source to scene |
| DELETE | `/api/obs/scenes/:sceneName/items/:itemId` | Remove from scene |
| PUT | `/api/obs/scenes/:sceneName/items/:itemId/transform` | Update transform |
| PUT | `/api/obs/scenes/:sceneName/items/:itemId/enabled` | Toggle visibility |
| PUT | `/api/obs/scenes/:sceneName/items/:itemId/locked` | Toggle lock |
| PUT | `/api/obs/scenes/:sceneName/items/reorder` | Reorder layers |

### Create Input Request

```json
{
  "inputName": "Interview Camera",
  "inputKind": "ffmpeg_source",
  "inputSettings": {
    "input": "srt://nimble.local:10005",
    "buffering_mb": 2,
    "reconnect_delay_sec": 5,
    "hw_decode": true
  },
  "sceneName": "Interview Setup",
  "sceneItemEnabled": true
}
```

### Add Source to Scene Request

```json
{
  "sourceName": "Interview Camera",
  "sceneItemEnabled": true,
  "sceneItemTransform": {
    "positionX": 480,
    "positionY": 0,
    "scaleX": 0.5,
    "scaleY": 0.5,
    "cropLeft": 0,
    "cropRight": 0,
    "cropTop": 0,
    "cropBottom": 0
  }
}
```

### Transform Presets

| Preset | Position X,Y | Scale X,Y | Description |
|--------|-------------|-----------|-------------|
| `fullscreen` | 0, 0 | 1.0, 1.0 | Full canvas |
| `dualLeft` | 0, 0 | 0.5, 1.0 | Left half (stretched) |
| `dualRight` | 960, 0 | 0.5, 1.0 | Right half (stretched) |
| `dual16x9Left` | 0, 270 | 0.5, 0.5 | Left half, 16:9 maintained, vertically centered |
| `dual16x9Right` | 960, 270 | 0.5, 0.5 | Right half, 16:9 maintained, vertically centered |
| `quadTopLeft` | 0, 0 | 0.5, 0.5 | Top-left quarter |
| `quadTopRight` | 960, 0 | 0.5, 0.5 | Top-right quarter |
| `quadBottomLeft` | 0, 540 | 0.5, 0.5 | Bottom-left quarter |
| `quadBottomRight` | 960, 540 | 0.5, 0.5 | Bottom-right quarter |
| `pip` | 1440, 810 | 0.25, 0.25 | Picture-in-picture |
| `tripleMain` | 0, 0 | 0.667, 1.0 | 2/3 width main |
| `tripleTopRight` | 1280, 0 | 0.333, 0.5 | 1/3 top-right |
| `tripleBottomRight` | 1280, 540 | 0.333, 0.5 | 1/3 bottom-right |
| `tripleTop2Left` | 0, 0 | 0.5, 0.5 | Top-left for 2-top layouts |
| `tripleTop2Right` | 960, 0 | 0.5, 0.5 | Top-right for 2-top layouts |
| `tripleBottomFull` | 0, 540 | 1.0, 0.5 | Bottom full-width (1920x540) |
| `tripleBottomCenter` | 480, 540 | 0.5, 0.5 | Bottom centered (960x540) |

### Layout Visual Reference

```
DUAL 16:9 (maintains aspect ratio)        TRIPLE TOP-2 + BOTTOM-FULL
┌────────────────────────────────────┐    ┌──────────────────┬─────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │    │    Camera 1      │    Camera 2     │
├──────────────────┬─────────────────┤    │    (960x540)     │    (960x540)    │
│    Camera 1      │    Camera 2     │    ├──────────────────┴─────────────────┤
│    (960x540)     │    (960x540)    │    │           Camera 3                 │
├──────────────────┴─────────────────┤    │           (1920x540)               │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │    └────────────────────────────────────┘
└────────────────────────────────────┘

TRIPLE TOP-2 + BOTTOM-CENTER
┌──────────────────┬─────────────────┐
│    Camera 1      │    Camera 2     │
│    (960x540)     │    (960x540)    │
├─────────┬────────┴────────┬────────┤
│  empty  │    Camera 3     │  empty │
│         │    (960x540)    │        │
└─────────┴─────────────────┴────────┘
```

### Acceptance Criteria

- [ ] Can list all input kinds available in OBS
- [ ] Can create SRT source and add to scene
- [ ] Can create browser source for graphics
- [ ] Can update source position and scale
- [ ] Can toggle source visibility
- [ ] Can reorder source layers (z-index)
- [ ] Can remove source from scene
- [ ] Can delete input entirely
- [ ] Transform presets work correctly
- [ ] Source changes sync to all clients

---

## Phase 4: Audio Management

### Overview

Enable comprehensive audio management including volume control, muting, and audio presets stored in Firebase.

### Requirements

1. **Audio Source Operations**
   - List all audio sources
   - Get/set volume (dB and linear)
   - Get/set mute state
   - Get/set audio monitor type

2. **Audio Presets**
   - Save current mix as preset
   - Load preset
   - Delete preset
   - Per-competition presets in Firebase

3. **Discord Audio Monitoring**
   - Detect Discord audio capture source
   - Monitor Discord audio levels
   - Alert if Discord audio missing

### Audio Monitor Types

| Type | Description |
|------|-------------|
| `OBS_MONITORING_TYPE_NONE` | No monitoring |
| `OBS_MONITORING_TYPE_MONITOR_ONLY` | Monitor only (not in output) |
| `OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT` | Monitor and include in output |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/audio` | List all audio sources |
| GET | `/api/obs/audio/:inputName` | Get audio source |
| PUT | `/api/obs/audio/:inputName/volume` | Set volume |
| PUT | `/api/obs/audio/:inputName/mute` | Set mute |
| PUT | `/api/obs/audio/:inputName/monitor` | Set monitor type |
| GET | `/api/obs/audio/presets` | List presets |
| POST | `/api/obs/audio/presets` | Save preset |
| PUT | `/api/obs/audio/presets/:presetId` | Load preset |
| DELETE | `/api/obs/audio/presets/:presetId` | Delete preset |

### Audio Preset Schema (Firebase)

Path: `competitions/{compId}/obs/presets/{presetId}`

```json
{
  "id": "commentary-focus",
  "name": "Commentary Focus",
  "description": "Commentary at full, venue reduced",
  "levels": {
    "Venue Audio": {
      "volumeDb": -12.0,
      "volumeMul": 0.25,
      "muted": false
    },
    "Commentary": {
      "volumeDb": 0.0,
      "volumeMul": 1.0,
      "muted": false
    },
    "Music": {
      "volumeDb": -96.0,
      "volumeMul": 0.0,
      "muted": true
    },
    "Discord": {
      "volumeDb": 0.0,
      "volumeMul": 1.0,
      "muted": false
    }
  },
  "createdAt": "2026-01-16T10:00:00Z",
  "createdBy": "producer@example.com"
}
```

### Default Presets

| Preset | Venue | Commentary | Music | Discord |
|--------|-------|------------|-------|---------|
| `commentary-focus` | 25% | 100% | 0% | 100% |
| `venue-focus` | 100% | 60% | 0% | 60% |
| `music-bed` | 20% | 100% | 40% | 80% |
| `all-muted` | 0% | 0% | 0% | 0% |
| `break-music` | 0% | 0% | 80% | 0% |

### Acceptance Criteria

- [ ] Can list all audio sources with volumes
- [ ] Can set volume in dB or linear scale
- [ ] Can mute/unmute audio sources
- [ ] Can save current mix as preset
- [ ] Can load preset and apply to OBS
- [ ] Presets persist to Firebase
- [ ] Discord audio capture detected
- [ ] Audio changes sync to all clients

---

## Phase 5: Transition Management

### Overview

Enable management of scene transitions including duration configuration and stinger uploads.

### Requirements

1. **Transition Operations**
   - List available transitions
   - Set default transition
   - Set transition duration
   - Configure stinger transitions

2. **Stinger Transitions**
   - Upload stinger video file
   - Configure transition point
   - Preview stinger

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/transitions` | List all transitions |
| GET | `/api/obs/transitions/current` | Get current transition |
| PUT | `/api/obs/transitions/current` | Set current transition |
| PUT | `/api/obs/transitions/duration` | Set transition duration |
| GET | `/api/obs/transitions/:name/settings` | Get transition settings |
| PUT | `/api/obs/transitions/:name/settings` | Update transition settings |
| POST | `/api/obs/transitions/stinger` | Upload stinger video |

### Transition Settings by Type

**Fade Transition:**
```json
{
  "transition_point": 500
}
```

**Stinger Transition:**
```json
{
  "path": "/var/www/assets/stingers/main.webm",
  "transition_point": 250,
  "monitoring_type": "OBS_MONITORING_TYPE_NONE",
  "audio_fade_style": "OBS_TRANSITION_AUDIO_FADE_OUT"
}
```

### Acceptance Criteria

- [ ] Can list available transitions
- [ ] Can set default transition
- [ ] Can set transition duration
- [ ] Can upload stinger video to VM
- [ ] Can configure stinger transition point
- [ ] Transition changes sync to all clients

---

## Phase 6: Stream Configuration

### Overview

Enable configuration of stream output including destination, stream key, resolution, and bitrate.

### Requirements

1. **Stream Destinations**
   - YouTube RTMP
   - Twitch RTMP
   - Custom RTMP URL

2. **Stream Settings**
   - Server URL
   - Stream key (encrypted in Firebase)
   - Output resolution
   - Frame rate
   - Video bitrate
   - Audio bitrate
   - Encoder selection

3. **Stream Control**
   - Start streaming
   - Stop streaming
   - Get stream statistics

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/stream/settings` | Get stream settings |
| PUT | `/api/obs/stream/settings` | Update stream settings |
| POST | `/api/obs/stream/start` | Start streaming |
| POST | `/api/obs/stream/stop` | Stop streaming |
| GET | `/api/obs/stream/status` | Get stream status/stats |

### Stream Settings Schema

```json
{
  "serviceType": "rtmp_common",
  "service": "YouTube - RTMPS",
  "server": "rtmps://a.rtmps.youtube.com/live2",
  "streamKey": "****-****-****-****",
  "useAuth": false,
  "username": null,
  "password": null
}
```

### Output Settings

```json
{
  "outputMode": "Advanced",
  "streamEncoder": "obs_x264",
  "streamEncoderSettings": {
    "rate_control": "CBR",
    "bitrate": 6000,
    "keyint_sec": 2,
    "preset": "veryfast",
    "profile": "high",
    "tune": "zerolatency"
  },
  "audioTrack": 1,
  "audioBitrate": 160
}
```

### Firebase Stream Key Storage

Stream keys are sensitive and stored encrypted:

Path: `competitions/{compId}/obs/stream/`

```json
{
  "service": "YouTube - RTMPS",
  "server": "rtmps://a.rtmps.youtube.com/live2",
  "streamKeyEncrypted": "encrypted_base64_value",
  "lastUsed": "2026-01-15T18:00:00Z"
}
```

### Acceptance Criteria

- [ ] Can get current stream settings
- [ ] Can update stream destination
- [ ] Can securely store stream key
- [ ] Can start streaming from UI
- [ ] Can stop streaming from UI
- [ ] Can view stream statistics (bitrate, frames)
- [ ] Stream key not exposed in API responses

---

## Phase 7: Asset Management

### Overview

Enable management of media assets (music, stingers, backgrounds, logos) on the VM with upload/download capabilities.

### Requirements

1. **Asset Types**
   - Music (intro, outro, break)
   - Stinger transitions
   - Animated backgrounds
   - Team logos
   - Static images

2. **Asset Operations**
   - Upload file to VM
   - Download file from VM
   - List assets on VM
   - Delete asset from VM
   - Download asset pack

3. **Asset Directory Structure on VM**
   ```
   /var/www/assets/
   ├── music/
   │   ├── intro.mp3
   │   ├── break.mp3
   │   └── outro.mp3
   ├── stingers/
   │   ├── main.webm
   │   └── quick.webm
   ├── backgrounds/
   │   ├── brb.mp4
   │   └── starting-soon.mp4
   ├── logos/
   │   ├── ucla.png
   │   ├── oregon.png
   │   └── ...
   └── manifest.json
   ```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/assets` | List all assets |
| GET | `/api/obs/assets/:type` | List assets by type |
| POST | `/api/obs/assets/upload` | Upload asset |
| DELETE | `/api/obs/assets/:type/:filename` | Delete asset |
| GET | `/api/obs/assets/:type/:filename/download` | Download asset |
| POST | `/api/obs/assets/pack/install` | Install asset pack |

### Asset Manifest Schema

Path: `competitions/{compId}/obs/assets/manifest`

```json
{
  "lastUpdated": "2026-01-16T10:00:00Z",
  "music": [
    {
      "filename": "intro.mp3",
      "displayName": "Show Intro",
      "path": "/var/www/assets/music/intro.mp3",
      "duration": 45,
      "sizeBytes": 1024000,
      "uploadedAt": "2026-01-15T12:00:00Z"
    }
  ],
  "stingers": [
    {
      "filename": "main.webm",
      "displayName": "Main Stinger",
      "path": "/var/www/assets/stingers/main.webm",
      "duration": 0.5,
      "transitionPoint": 250,
      "sizeBytes": 512000,
      "uploadedAt": "2026-01-15T12:00:00Z"
    }
  ],
  "backgrounds": [],
  "logos": []
}
```

### Asset Pack Schema

Central asset packs can be installed on VMs:

Path: `system/assets/packs/{packId}`

```json
{
  "id": "standard-pack-v1",
  "name": "Standard Show Pack",
  "version": "1.0",
  "description": "Basic music and transitions",
  "downloadUrl": "https://storage.example.com/packs/standard-v1.zip",
  "contents": {
    "music": ["intro.mp3", "break.mp3", "outro.mp3"],
    "stingers": ["main.webm"],
    "backgrounds": ["brb.mp4", "starting-soon.mp4"]
  },
  "sizeBytes": 25600000
}
```

### Acceptance Criteria

- [ ] Can list assets on VM by type
- [ ] Can upload music file to VM
- [ ] Can upload stinger video to VM
- [ ] Can upload background video to VM
- [ ] Can upload logo image to VM
- [ ] Can delete asset from VM
- [ ] Asset manifest stored in Firebase
- [ ] Can install asset pack from central library
- [ ] File size limits enforced

---

## Phase 8: OBS Template System

### Overview

Enable import/export of OBS scene collections as templates with asset manifest references.

### Requirements

1. **Template Operations**
   - Export current OBS state as template
   - Import template to OBS
   - List available templates
   - Template versioning

2. **Template Structure**
   - Based on OBS scene collection JSON format
   - Asset references use slots (not absolute paths)
   - Supports variable substitution

3. **Asset Slot System**
   Templates reference assets by slot, resolved at import:
   - `{{assets.music.intro}}` → `/var/www/assets/music/intro.mp3`
   - `{{assets.stingers.main}}` → `/var/www/assets/stingers/main.webm`

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/templates` | List available templates |
| GET | `/api/obs/templates/:id` | Get template details |
| POST | `/api/obs/templates` | Create template from current OBS |
| POST | `/api/obs/templates/:id/apply` | Apply template to OBS |
| PUT | `/api/obs/templates/:id` | Update template metadata |
| DELETE | `/api/obs/templates/:id` | Delete template |

### Template Schema

Path: `templates/obs/{templateId}`

```json
{
  "id": "gymnastics-standard-v2",
  "name": "Gymnastics Standard",
  "version": "2.0",
  "description": "Standard gymnastics meet setup with 4 cameras",
  "meetTypes": ["mens-dual", "womens-dual", "mens-tri", "womens-tri"],
  "createdAt": "2026-01-10T10:00:00Z",
  "updatedAt": "2026-01-15T14:00:00Z",
  "createdBy": "producer@example.com",

  "requiredAssets": {
    "music": ["intro", "break", "outro"],
    "stingers": ["main"],
    "backgrounds": ["brb", "starting-soon"]
  },

  "sceneCollection": {
    "name": "Gymnastics Standard",
    "scenes": [
      {
        "name": "Starting Soon",
        "sources": [
          {
            "name": "BG Video",
            "type": "ffmpeg_source",
            "settings": {
              "local_file": "{{assets.backgrounds.starting-soon}}"
            }
          },
          {
            "name": "Music",
            "type": "ffmpeg_source",
            "settings": {
              "local_file": "{{assets.music.intro}}"
            }
          }
        ]
      },
      {
        "name": "Single - Camera 1",
        "sources": [
          {
            "name": "Camera 1 SRT",
            "type": "ffmpeg_source",
            "settings": {
              "input": "{{cameras.cam1.srtUrl}}"
            }
          },
          {
            "name": "Graphics Overlay",
            "type": "browser_source",
            "settings": {
              "url": "{{config.graphicsOverlay.url}}"
            }
          }
        ]
      }
    ],
    "transitions": [
      {
        "name": "Stinger",
        "type": "stinger_transition",
        "settings": {
          "path": "{{assets.stingers.main}}"
        }
      }
    ]
  }
}
```

### Template Variable Substitution

| Variable | Source | Example Value |
|----------|--------|---------------|
| `{{assets.music.*}}` | Asset manifest | `/var/www/assets/music/intro.mp3` |
| `{{assets.stingers.*}}` | Asset manifest | `/var/www/assets/stingers/main.webm` |
| `{{cameras.*.srtUrl}}` | Camera config | `srt://nimble.local:10001` |
| `{{config.graphicsOverlay.url}}` | Show config | `http://localhost:5173/graphics` |
| `{{competition.name}}` | Competition config | `UCLA vs Oregon` |
| `{{team1.name}}` | Competition config | `UCLA` |

### Acceptance Criteria

- [ ] Can export current OBS state as template
- [ ] Can list available templates
- [ ] Can apply template to fresh OBS instance
- [ ] Asset slots resolve correctly
- [ ] Variable substitution works
- [ ] Template validation before apply
- [ ] Missing assets reported as errors

---

## Phase 9: Talent Communication (VDO.Ninja + Discord Fallback)

### Overview

Enable two-way communication with remote talent (commentators). Talent needs to:
1. **See** the program output in near-real-time
2. **Talk** and have their audio captured in OBS

**Primary Method:** VDO.Ninja (WebRTC-based, no VM interaction required)
**Fallback Method:** Discord via NoMachine (manual setup when VDO.Ninja has issues)

### Primary: VDO.Ninja Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    VDO.NINJA WORKFLOW                            │
│                                                                   │
│  On "Assign VM to Competition":                                  │
│  1. Generate unique room ID (e.g., gym-comp-abc123)              │
│  2. Store URLs in Firebase:                                      │
│     - Director URL (for OBS on VM)                               │
│     - Talent URLs (one per remote talent, typically 2)           │
│                                                                   │
│  On "Start Show":                                                │
│  1. OBS browser sources load automatically                       │
│  2. Talent clicks their link → sees program, talks back          │
│  3. No VM interaction required                                   │
│                                                                   │
│  ┌─────────────┐         ┌─────────────┐         ┌────────────┐ │
│  │     OBS     │◄──────► │  VDO.Ninja  │◄───────►│   Talent   │ │
│  │  (Browser   │  WebRTC │   (relay)   │  WebRTC │  (Browser) │ │
│  │   Sources)  │         │             │         │            │ │
│  └─────────────┘         └─────────────┘         └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### VDO.Ninja URL Structure

| URL Type | Purpose | Example |
|----------|---------|---------|
| Director URL | Control panel (not typically used) | `https://vdo.ninja/?director=gym-comp-abc123` |
| OBS Scene URL | Captures all talent audio into OBS | `https://vdo.ninja/?scene&room=gym-comp-abc123` |
| Talent 1 URL | Talent sees program, sends audio | `https://vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent1` |
| Talent 2 URL | Talent sees program, sends audio | `https://vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent2` |

### OBS Browser Sources for VDO.Ninja

**Source: "VDO Talent Audio"**
- Type: `browser_source`
- URL: `https://vdo.ninja/?scene&room={{talentComms.vdoNinja.roomId}}`
- Width: 1920, Height: 1080 (hidden, audio only)
- Purpose: Captures talent audio into OBS

**Source: "VDO Program Output"**
- Type: `browser_source`
- URL: Virtual camera output sent to VDO.Ninja
- Purpose: Sends program output to talent

### Fallback: Discord via NoMachine

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISCORD FALLBACK                              │
│                                                                   │
│  If VDO.Ninja has issues:                                        │
│  1. Connect to VM via NoMachine (SSH tunnel)                     │
│  2. Open Discord → Join voice channel                            │
│  3. OBS → Open Program Projector                                 │
│  4. Discord → Go Live → Select Projector Window                  │
│  5. Talent joins Discord call, watches stream                    │
│                                                                   │
│  Pre-configured on AMI:                                          │
│  - Discord installed and logged in                               │
│  - Audio routing (Discord sink → OBS)                            │
│  - NoMachine installed (port 4000, localhost only)               │
│                                                                   │
│  SSH Tunnel Command:                                             │
│  ssh -L 4000:localhost:4000 ubuntu@{vmAddress}                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Discord Audio in OBS (Fallback)

When using Discord fallback:
- Input Kind: PulseAudio monitor (Linux)
- Discord audio routed via virtual PulseAudio sink to OBS
- OBS captures via Audio Output Capture

### Firebase Schema for Talent Comms

Path: `competitions/{compId}/config/talentComms`

```json
{
  "method": "vdo-ninja",

  "vdoNinja": {
    "roomId": "gym-comp-abc123",
    "directorUrl": "https://vdo.ninja/?director=gym-comp-abc123",
    "obsSceneUrl": "https://vdo.ninja/?scene&room=gym-comp-abc123",
    "talentUrls": {
      "talent-1": "https://vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent1",
      "talent-2": "https://vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent2"
    },
    "generatedAt": "2026-01-16T10:00:00Z"
  },

  "discord": {
    "guildId": "123456789012345678",
    "channelId": "987654321098765432"
  }
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/talent-comms` | Get current talent comms config |
| POST | `/api/talent-comms/setup` | Generate VDO.Ninja room and URLs |
| POST | `/api/talent-comms/regenerate` | Regenerate URLs (new room ID) |
| PUT | `/api/talent-comms/method` | Switch between vdo-ninja and discord |
| GET | `/api/talent-comms/status` | Get connection status |

### Talent Comms Setup Response

```json
{
  "method": "vdo-ninja",
  "roomId": "gym-comp-abc123",
  "urls": {
    "obsScene": "https://vdo.ninja/?scene&room=gym-comp-abc123",
    "talent1": "https://vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent1",
    "talent2": "https://vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent2"
  },
  "instructions": {
    "talent": "Click your link, allow camera/mic access, you'll see the program output",
    "obs": "Browser source 'VDO Talent Audio' will capture talent audio automatically"
  }
}
```

### Talent Comms Status Response

```json
{
  "method": "vdo-ninja",
  "status": "active",
  "obsSourceConfigured": true,
  "talentConnections": {
    "talent1": { "connected": true, "audioActive": true },
    "talent2": { "connected": true, "audioActive": true }
  }
}
```

### AMI Requirements

**For VDO.Ninja (Primary):**
- Google Chrome (for browser sources)
- OBS with Browser Source plugin (standard)
- v4l2loopback (virtual camera for sending program to VDO.Ninja)
- OBS scene collection template with VDO.Ninja browser sources

**For Discord (Fallback):**
- Discord desktop client (logged in)
- NoMachine server (localhost:4000 only)
- PulseAudio with virtual sinks configured
- OBS Audio Output Capture → Discord sink

### Talent Comms UI Component

```
┌─ TALENT COMMUNICATION ──────────────────────────────────────────┐
│                                                                  │
│  Method: ● VDO.Ninja (Recommended)   ○ Discord (Fallback)       │
│                                                                  │
│  ─── Talent URLs ────────────────────────────────────────────   │
│                                                                  │
│  Talent 1: https://vdo.ninja/?room=gym-comp-ab... [📋 Copy]     │
│  Status: ● Connected, Audio Active                               │
│                                                                  │
│  Talent 2: https://vdo.ninja/?room=gym-comp-ab... [📋 Copy]     │
│  Status: ○ Not Connected                                         │
│                                                                  │
│  [🔄 Regenerate URLs]  [📧 Email URLs to Talent]                │
│                                                                  │
│  ─── OBS Status ─────────────────────────────────────────────   │
│  VDO Audio Source: ● Configured, Receiving Audio                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] VDO.Ninja room generated on competition setup
- [ ] Talent URLs stored in Firebase
- [ ] OBS browser source template includes VDO.Ninja sources
- [ ] Talent can see program output via their URL
- [ ] Talent audio captured in OBS via browser source
- [ ] Can switch to Discord fallback mode
- [ ] Discord fallback documented with SSH tunnel command
- [ ] UI shows talent connection status
- [ ] Can regenerate URLs if needed

### Configuration Summary

| Setting | Value |
|---------|-------|
| Primary method | VDO.Ninja |
| Fallback method | Discord via NoMachine |
| Typical talent count | 2 |
| URL distribution | Manual (copy/paste) |
| Pre-generate URLs | 2 talent slots per competition |

---

## Phase 10: Preview System

### Overview

Enable remote preview for headless OBS through screenshots and low-latency preview streams.

### Requirements

1. **Screenshot Preview**
   - Capture current program output
   - Capture specific scene
   - Capture specific source

2. **Studio Mode Control**
   - Enable/disable studio mode
   - Set preview scene
   - Execute transition

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/preview/screenshot` | Get current output screenshot |
| GET | `/api/obs/preview/screenshot/:sceneName` | Get scene screenshot |
| PUT | `/api/obs/studio-mode` | Enable/disable studio mode |
| PUT | `/api/obs/studio-mode/preview` | Set preview scene |
| POST | `/api/obs/studio-mode/transition` | Execute transition |

### Screenshot Response

```json
{
  "imageData": "data:image/png;base64,iVBORw0KGgo...",
  "imageWidth": 1920,
  "imageHeight": 1080,
  "capturedAt": "2026-01-16T10:30:00Z"
}
```

### Acceptance Criteria

- [ ] Can capture current program screenshot
- [ ] Can capture specific scene screenshot
- [ ] Can enable/disable studio mode
- [ ] Can set preview scene in studio mode
- [ ] Can execute transition in studio mode

---

## Phase 11: OBS Manager UI

### Overview

Create the OBS Manager page at `/{compId}/obs-manager` with full OBS control capabilities.

### Route Structure

```
/{compId}/obs-manager
├── /scenes          # Scene management
├── /sources         # Source/input management
├── /audio           # Audio mixer
├── /transitions     # Transition management
├── /stream          # Stream configuration
├── /assets          # Asset management
├── /templates       # Template management
└── /discord         # Discord status
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OBS MANAGER                         PAC-12 Women's Quad               ● ○ │
│  Competition: UCLA vs Oregon vs Utah vs Arizona                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ CONNECTION STATUS ───────────────────────────────────────────────────┐ │
│  │  OBS: ● Connected (ws://44.193.31.120:4455)      [Reconnect] [Sync]   │ │
│  │  Last sync: 2 seconds ago                                              │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ TABS ────────────────────────────────────────────────────────────────┐ │
│  │ [Scenes] [Sources] [Audio] [Transitions] [Stream] [Assets] [Templates]│ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  (Tab Content Area - varies by selected tab)                                │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  ┌─ CURRENT OUTPUT ──────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ┌──────────────────────┐   Current Scene: Single - Camera 1          │ │
│  │  │                      │   Transition: Cut                            │ │
│  │  │    [Preview Image]   │                                              │ │
│  │  │                      │   Stream: ● LIVE (YouTube)                   │ │
│  │  │                      │   Uptime: 01:23:45                           │ │
│  │  │                      │   Bitrate: 6.2 Mbps                          │ │
│  │  │                      │   Dropped: 0 frames                          │ │
│  │  └──────────────────────┘                                              │ │
│  │                                                                        │ │
│  │  [Start Stream] [Stop Stream] [Start Recording] [Take Screenshot]     │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Scene Tab Layout

```
┌─ SCENES ─────────────────────────────────────────────────────────────────────┐
│                                                                               │
│  [+ New Scene] [Generate Scenes] [Import Template ▼]        Filter: [All ▼] │
│                                                                               │
│  ─── Generated - Single ────────────────────────────────────────────────────│
│  ├─ Single - Camera 1 - Vault              [Preview] [Edit] [Duplicate] [×] │
│  │  └─ 3 sources: Camera 1 SRT, Graphics Overlay, Music                     │
│  ├─ Single - Camera 2 - Uneven Bars        [Preview] [Edit] [Duplicate] [×] │
│  │  └─ 3 sources: Camera 2 SRT, Graphics Overlay, Music                     │
│  └─ Single - Camera 3 - Balance Beam       [Preview] [Edit] [Duplicate] [×] │
│     └─ 3 sources: Camera 3 SRT, Graphics Overlay, Music                     │
│                                                                               │
│  ─── Generated - Multi ─────────────────────────────────────────────────────│
│  ├─ Dual - Camera 1 + Camera 2             [Preview] [Edit] [Duplicate] [×] │
│  │  └─ 4 sources: Cam1 SRT, Cam2 SRT, Graphics, Music                       │
│  └─ Quad View                              [Preview] [Edit] [Duplicate] [×] │
│     └─ 6 sources: Cam1-4 SRT, Graphics, Music                               │
│                                                                               │
│  ─── Static ────────────────────────────────────────────────────────────────│
│  ├─ Starting Soon                          [Preview] [Edit] [Duplicate] [×] │
│  ├─ BRB                                    [Preview] [Edit] [Duplicate] [×] │
│  └─ Thanks for Watching                    [Preview] [Edit] [Duplicate] [×] │
│                                                                               │
│  ─── Manual ────────────────────────────────────────────────────────────────│
│  └─ Interview Setup                        [Preview] [Edit] [Duplicate] [×] │
│     └─ 2 sources: Talent Camera, Graphics                                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Audio Tab Layout

```
┌─ AUDIO MIXER ────────────────────────────────────────────────────────────────┐
│                                                                               │
│  Preset: [Commentary Focus ▼]              [Save Current] [Load Preset]      │
│                                                                               │
│  ─── Audio Sources ─────────────────────────────────────────────────────────│
│                                                                               │
│  Venue Audio                                                                  │
│  ├─ Volume: [========●===============] -6.0 dB (50%)                         │
│  ├─ Mute: [ ]  Monitor: [Monitor and Output ▼]                              │
│  └─ Level: ████████░░░░░░░░░░░░░                                            │
│                                                                               │
│  Commentary                                                                   │
│  ├─ Volume: [========================●] 0.0 dB (100%)                        │
│  ├─ Mute: [ ]  Monitor: [Monitor and Output ▼]                              │
│  └─ Level: ██████████████░░░░░░░                                            │
│                                                                               │
│  Music                                                                        │
│  ├─ Volume: [●========================] -96.0 dB (0%)                        │
│  ├─ Mute: [✓]  Monitor: [None ▼]                                            │
│  └─ Level: ░░░░░░░░░░░░░░░░░░░░░                                            │
│                                                                               │
│  Discord Audio  ● Connected                                                   │
│  ├─ Volume: [========================●] 0.0 dB (100%)                        │
│  ├─ Mute: [ ]  Monitor: [Monitor and Output ▼]                              │
│  └─ Level: ████████████░░░░░░░░░                                            │
│                                                                               │
│  ─── Saved Presets ─────────────────────────────────────────────────────────│
│  [Commentary Focus] [Venue Focus] [Music Bed] [All Muted] [Break Music]     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Template Tab Layout

```
┌─ TEMPLATES ──────────────────────────────────────────────────────────────────┐
│                                                                               │
│  ┌─ SAVE CURRENT SETUP ────────────────────────────────────────────────────┐ │
│  │                                                                          │ │
│  │  [💾 Save Current OBS Setup as Template]                                │ │
│  │                                                                          │ │
│  │  Export all current scenes, sources, and transforms as a reusable       │ │
│  │  template that can be applied to other competitions.                    │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ─── Available Templates ─────────────────────────────────────────────────── │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ Gymnastics Standard v2.0                                    [Apply] [🗑️] ││
│  │ Standard 4-camera setup with single, dual, triple, and quad scenes      ││
│  │ Meet types: mens-dual, womens-dual, mens-tri, womens-tri                ││
│  │ Created: 2026-01-10 by producer@example.com                             ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ Triple Top-2 Layout v1.0                                    [Apply] [🗑️] ││
│  │ 2 cameras on top (960x540), 1 centered on bottom                        ││
│  │ Meet types: mens-dual, womens-dual                                      ││
│  │ Created: 2026-01-15 by producer@example.com                             ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ Dual 16:9 Layout v1.0                                       [Apply] [🗑️] ││
│  │ Side-by-side cameras maintaining 16:9 aspect ratio                      ││
│  │ Meet types: mens-dual, womens-dual                                      ││
│  │ Created: 2026-01-15 by producer@example.com                             ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Save Template Modal

When clicking "Save Current OBS Setup as Template":

```
┌─ Save as Template ───────────────────────────────────────────────────────────┐
│                                                                               │
│  Template Name:                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ My Custom Layout                                                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  Description:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ 2 cameras on top, 1 centered on bottom with graphics overlay           │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  Compatible Meet Types:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  [✓] mens-dual      [✓] womens-dual                                    │ │
│  │  [✓] mens-tri       [✓] womens-tri                                     │ │
│  │  [ ] mens-quad      [ ] womens-quad                                    │ │
│  │  [ ] mens-5         [ ] mens-6                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ─── What Will Be Saved ──────────────────────────────────────────────────── │
│                                                                               │
│  Scenes: 8 (Single x3, Dual x2, Triple x1, Static x2)                        │
│  Sources: 12 (SRT x4, Browser x4, Media x4)                                  │
│  Transitions: 3 (Cut, Fade, Stinger)                                         │
│                                                                               │
│  Note: Camera SRT URLs and graphics URLs will be converted to variables      │
│  (e.g., {{cameras.cam1.srtUrl}}) so this template works with any competition.│
│                                                                               │
│                                          [Cancel]  [💾 Save Template]        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Apply Template Confirmation Modal

When clicking "Apply" on a template:

```
┌─ Apply Template ─────────────────────────────────────────────────────────────┐
│                                                                               │
│  ⚠️  This will replace your current OBS scene collection                     │
│                                                                               │
│  Template: Gymnastics Standard v2.0                                          │
│                                                                               │
│  This template requires:                                                      │
│  ├─ 4 cameras configured (you have: 4 ✓)                                     │
│  ├─ Assets: intro.mp3, break.mp3, stinger.webm (found: 3/3 ✓)               │
│  └─ Graphics overlay URL configured ✓                                        │
│                                                                               │
│  Scenes to be created:                                                        │
│  ├─ Single - Camera 1                                                        │
│  ├─ Single - Camera 2                                                        │
│  ├─ Single - Camera 3                                                        │
│  ├─ Single - Camera 4                                                        │
│  ├─ Dual - Camera 1 + Camera 2                                               │
│  ├─ Triple - Main + 2 Side                                                   │
│  ├─ Quad View                                                                │
│  ├─ Starting Soon                                                            │
│  ├─ BRB                                                                      │
│  └─ Thanks for Watching                                                      │
│                                                                               │
│                                          [Cancel]  [⚠️ Apply Template]       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| OBSManager | `OBSManager.jsx` | Main page container |
| OBSConnectionStatus | `OBSConnectionStatus.jsx` | Connection indicator |
| OBSCurrentOutput | `OBSCurrentOutput.jsx` | Preview and stream status |
| SceneList | `SceneList.jsx` | Scene management |
| SceneEditor | `SceneEditor.jsx` | Scene item editing |
| SourceEditor | `SourceEditor.jsx` | Source configuration |
| AudioMixer | `AudioMixer.jsx` | Audio controls |
| AudioPresetManager | `AudioPresetManager.jsx` | Preset management |
| TransitionPicker | `TransitionPicker.jsx` | Transition selection |
| StreamConfig | `StreamConfig.jsx` | Stream settings |
| AssetManager | `AssetManager.jsx` | Asset upload/download |
| TemplateManager | `TemplateManager.jsx` | Template import/export |
| DiscordStatus | `DiscordStatus.jsx` | Discord monitoring |

### Acceptance Criteria

- [ ] OBS Manager page accessible at `/{compId}/obs-manager`
- [ ] Connection status shows real-time OBS connection
- [ ] Scene tab shows all scenes with categorization
- [ ] Can create, edit, delete scenes from UI
- [ ] Source editor allows transform editing
- [ ] Audio mixer shows all audio sources with levels
- [ ] Audio presets can be saved and loaded
- [ ] Stream configuration UI works
- [ ] Asset upload via drag-and-drop
- [ ] Template import/export functional

---

## Data Models

### OBS State (In-Memory & Firebase)

```typescript
interface OBSState {
  connected: boolean;
  lastSync: string;           // ISO timestamp
  connectionError: string | null;

  scenes: OBSScene[];
  inputs: OBSInput[];
  audioSources: OBSAudioSource[];
  transitions: OBSTransition[];

  currentScene: string;
  currentTransition: string;
  currentTransitionDuration: number;

  studioModeEnabled: boolean;
  previewScene: string | null;

  streaming: OBSStreamStatus;
  recording: OBSRecordStatus;
  videoSettings: OBSVideoSettings;
}

interface OBSScene {
  name: string;
  index: number;
  category: 'generated-single' | 'generated-multi' | 'static' | 'graphics' | 'manual' | 'template';
  sceneItems: OBSSceneItem[];
}

interface OBSSceneItem {
  sceneItemId: number;
  sourceName: string;
  sourceKind: string;
  sceneItemEnabled: boolean;
  sceneItemLocked: boolean;
  sceneItemIndex: number;
  sceneItemTransform: OBSTransform;
}

interface OBSTransform {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  boundsType: string;
  boundsAlignment: number;
  boundsWidth: number;
  boundsHeight: number;
}

interface OBSInput {
  inputName: string;
  inputKind: string;
  inputSettings: Record<string, any>;
  unversionedInputSettings: Record<string, any>;
}

interface OBSAudioSource {
  inputName: string;
  inputKind: string;
  inputVolumeDb: number;
  inputVolumeMul: number;
  inputMuted: boolean;
  inputAudioMonitorType: string;
}

interface OBSTransition {
  transitionName: string;
  transitionKind: string;
  transitionConfigurable: boolean;
  transitionFixed: boolean;
  transitionSettings: Record<string, any>;
}

interface OBSStreamStatus {
  active: boolean;
  reconnecting: boolean;
  timecode: string;
  bytesPerSec: number;
  kbitsPerSec: number;
  totalStreamTime: number;
  numTotalFrames: number;
  numDroppedFrames: number;
  outputSkippedFrames: number;
  outputCongestion: number;
}

interface OBSRecordStatus {
  active: boolean;
  paused: boolean;
  timecode: string;
  outputBytes: number;
  outputDuration: number;
  outputPath: string;
}

interface OBSVideoSettings {
  baseWidth: number;
  baseHeight: number;
  outputWidth: number;
  outputHeight: number;
  fpsNumerator: number;
  fpsDenominator: number;
}
```

### Audio Preset (Firebase)

```typescript
interface AudioPreset {
  id: string;
  name: string;
  description: string;
  levels: Record<string, AudioLevel>;
  createdAt: string;
  createdBy: string;
}

interface AudioLevel {
  volumeDb: number;
  volumeMul: number;
  muted: boolean;
}
```

### Asset Manifest (Firebase)

```typescript
interface AssetManifest {
  lastUpdated: string;
  music: AssetEntry[];
  stingers: AssetEntry[];
  backgrounds: AssetEntry[];
  logos: AssetEntry[];
}

interface AssetEntry {
  filename: string;
  displayName: string;
  path: string;
  duration?: number;      // For audio/video
  transitionPoint?: number; // For stingers
  sizeBytes: number;
  uploadedAt: string;
}
```

### OBS Template (Firebase)

```typescript
interface OBSTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  meetTypes: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  requiredAssets: {
    music: string[];
    stingers: string[];
    backgrounds: string[];
  };

  sceneCollection: OBSSceneCollectionJSON;
}
```

---

## API Specification

### Base URL

All OBS API endpoints are prefixed with `/api/obs/`

### Authentication

Uses existing session-based authentication. Producer role required for all OBS operations.

### Error Responses

```json
{
  "error": true,
  "message": "OBS not connected",
  "code": "OBS_DISCONNECTED"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `OBS_DISCONNECTED` | 503 | OBS WebSocket not connected |
| `SCENE_NOT_FOUND` | 404 | Scene does not exist |
| `INPUT_NOT_FOUND` | 404 | Input does not exist |
| `SCENE_EXISTS` | 409 | Scene name already in use |
| `INVALID_INPUT_KIND` | 400 | Unsupported input type |
| `TEMPLATE_NOT_FOUND` | 404 | Template does not exist |
| `MISSING_ASSETS` | 400 | Required assets not found on VM |
| `STREAM_ALREADY_ACTIVE` | 409 | Stream already running |

### Full API Endpoint Reference

See individual phase sections for detailed endpoint documentation.

---

## Socket Event Specification

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `obs:refreshState` | `{}` | Request full state refresh |
| `obs:switchScene` | `{ sceneName }` | Switch to scene |
| `obs:setTransition` | `{ transitionName, duration? }` | Set transition |
| `obs:setVolume` | `{ inputName, volumeDb }` | Set audio volume |
| `obs:setMute` | `{ inputName, muted }` | Set mute state |
| `obs:loadPreset` | `{ presetId }` | Load audio preset |
| `obs:startStream` | `{}` | Start streaming |
| `obs:stopStream` | `{}` | Stop streaming |
| `obs:takeScreenshot` | `{ sceneName? }` | Capture screenshot |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `obs:stateRefreshed` | `OBSState` | Full state update |
| `obs:connected` | `{}` | OBS connected |
| `obs:disconnected` | `{ error? }` | OBS disconnected |
| `obs:sceneChanged` | `{ sceneName }` | Current scene changed |
| `obs:sceneListChanged` | `{ scenes }` | Scene list updated |
| `obs:inputCreated` | `{ input }` | New input created |
| `obs:inputRemoved` | `{ inputName }` | Input deleted |
| `obs:volumeChanged` | `{ inputName, volumeDb, volumeMul }` | Volume changed |
| `obs:muteChanged` | `{ inputName, muted }` | Mute state changed |
| `obs:transitionChanged` | `{ transitionName, duration }` | Transition changed |
| `obs:streamStarted` | `{}` | Stream started |
| `obs:streamStopped` | `{}` | Stream stopped |
| `obs:streamStats` | `OBSStreamStatus` | Stream statistics |
| `obs:screenshot` | `{ imageData, width, height }` | Screenshot captured |

---

## File Manifest

### New Files

| File | Phase | Est. Lines | Purpose |
|------|-------|------------|---------|
| `server/lib/obsStateSync.js` | 1 | 500 | OBS state synchronization service |
| `server/lib/obsSceneManager.js` | 2 | 300 | Scene CRUD operations |
| `server/lib/obsSourceManager.js` | 3 | 350 | Source/input management |
| `server/lib/obsAudioManager.js` | 4 | 250 | Audio management |
| `server/lib/obsTransitionManager.js` | 5 | 150 | Transition management |
| `server/lib/obsStreamManager.js` | 6 | 200 | Stream configuration |
| `server/lib/obsAssetManager.js` | 7 | 300 | Asset management |
| `server/lib/obsTemplateManager.js` | 8 | 400 | Template system |
| `server/routes/obs.js` | 1-8 | 600 | OBS API routes |
| `show-controller/src/pages/OBSManager.jsx` | 11 | 200 | Main OBS manager page |
| `show-controller/src/components/obs/OBSConnectionStatus.jsx` | 11 | 80 | Connection indicator |
| `show-controller/src/components/obs/OBSCurrentOutput.jsx` | 11 | 150 | Preview and status |
| `show-controller/src/components/obs/SceneList.jsx` | 11 | 250 | Scene list component |
| `show-controller/src/components/obs/SceneEditor.jsx` | 11 | 300 | Scene editing modal |
| `show-controller/src/components/obs/SourceEditor.jsx` | 11 | 350 | Source editor |
| `show-controller/src/components/obs/AudioMixer.jsx` | 11 | 300 | Audio mixer |
| `show-controller/src/components/obs/AudioPresetManager.jsx` | 11 | 150 | Preset management |
| `show-controller/src/components/obs/TransitionPicker.jsx` | 11 | 120 | Transition selector |
| `show-controller/src/components/obs/StreamConfig.jsx` | 11 | 200 | Stream settings |
| `show-controller/src/components/obs/AssetManager.jsx` | 11 | 300 | Asset upload UI |
| `show-controller/src/components/obs/TemplateManager.jsx` | 11 | 250 | Template UI |
| `show-controller/src/components/obs/DiscordStatus.jsx` | 11 | 100 | Discord monitoring |
| `show-controller/src/hooks/useOBS.js` | 11 | 200 | OBS state hook |
| `show-controller/src/context/OBSContext.jsx` | 11 | 150 | OBS context provider |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `server/index.js` | 1 | Integrate OBSStateSync, new socket events |
| `server/lib/obsSceneGenerator.js` | 2, 8 | Add template support |
| `server/lib/productionConfigService.js` | 4, 7, 8 | Add OBS config methods |
| `show-controller/src/App.jsx` | 11 | Add OBS Manager route |
| `show-controller/src/context/ShowContext.jsx` | 1 | Add OBS state subscription |

### Total Estimated Lines

| Category | Lines |
|----------|-------|
| New Server Files | ~3,050 |
| New Frontend Files | ~3,100 |
| Modified Files | ~300 |
| **Total** | **~6,450** |

---

## Success Criteria

### Phase Completion Checklist

| Phase | Feature | Criteria |
|-------|---------|----------|
| 1 | State Sync | OBS state cached, persisted to Firebase, broadcasts to clients |
| 2 | Scene CRUD | Create, rename, reorder, delete scenes via API |
| 3 | Source Mgmt | Add, remove, transform sources within scenes |
| 4 | Audio | Volume, mute, presets all functional |
| 5 | Transitions | Set default, configure duration, stinger upload |
| 6 | Stream | Configure destination, start/stop from UI |
| 7 | Assets | Upload, download, manage assets on VM |
| 8 | Templates | Import/export scene collections |
| 9 | Discord | Monitor Discord audio capture status |
| 10 | Preview | Screenshot capture works |
| 11 | UI | OBS Manager page fully functional |

### Integration Tests

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| E2E-OBS-01 | Full state sync on connect | All OBS data reflected in UI |
| E2E-OBS-02 | Scene creation flow | Create scene → appears in OBS and UI |
| E2E-OBS-03 | Audio preset roundtrip | Save preset → load preset → levels match |
| E2E-OBS-04 | Template apply | Apply template → scenes created in OBS |
| E2E-OBS-05 | Stream start/stop | Start stream → streaming, Stop → stopped |
| E2E-OBS-06 | Asset upload | Upload file → appears on VM and in manifest |
| E2E-OBS-07 | Multi-client sync | Change in one client → reflected in other |

### Performance Requirements

| Metric | Target |
|--------|--------|
| State sync latency | < 500ms |
| Scene switch latency | < 100ms |
| UI responsiveness | < 100ms for interactions |
| Screenshot capture | < 2s |
| Asset upload (10MB) | < 30s |

---

## Appendix A: OBS WebSocket API Reference

### Scene Requests

| Request | Parameters | Response |
|---------|------------|----------|
| `GetSceneList` | - | `scenes[]`, `currentProgramSceneName`, `currentPreviewSceneName` |
| `GetCurrentProgramScene` | - | `sceneName` |
| `SetCurrentProgramScene` | `sceneName` | - |
| `CreateScene` | `sceneName` | - |
| `RemoveScene` | `sceneName` | - |
| `SetSceneName` | `sceneName`, `newSceneName` | - |
| `GetSceneItemList` | `sceneName` | `sceneItems[]` |

### Input Requests

| Request | Parameters | Response |
|---------|------------|----------|
| `GetInputList` | `inputKind?` | `inputs[]` |
| `GetInputKindList` | - | `inputKinds[]` |
| `CreateInput` | `sceneName`, `inputName`, `inputKind`, `inputSettings` | `sceneItemId` |
| `RemoveInput` | `inputName` | - |
| `GetInputSettings` | `inputName` | `inputSettings`, `inputKind` |
| `SetInputSettings` | `inputName`, `inputSettings` | - |
| `GetInputVolume` | `inputName` | `inputVolumeDb`, `inputVolumeMul` |
| `SetInputVolume` | `inputName`, `inputVolumeDb` or `inputVolumeMul` | - |
| `GetInputMute` | `inputName` | `inputMuted` |
| `SetInputMute` | `inputName`, `inputMuted` | - |

### Scene Item Requests

| Request | Parameters | Response |
|---------|------------|----------|
| `CreateSceneItem` | `sceneName`, `sourceName` | `sceneItemId` |
| `RemoveSceneItem` | `sceneName`, `sceneItemId` | - |
| `GetSceneItemTransform` | `sceneName`, `sceneItemId` | `sceneItemTransform` |
| `SetSceneItemTransform` | `sceneName`, `sceneItemId`, `sceneItemTransform` | - |
| `SetSceneItemEnabled` | `sceneName`, `sceneItemId`, `sceneItemEnabled` | - |
| `SetSceneItemIndex` | `sceneName`, `sceneItemId`, `sceneItemIndex` | - |
| `SetSceneItemLocked` | `sceneName`, `sceneItemId`, `sceneItemLocked` | - |

### Transition Requests

| Request | Parameters | Response |
|---------|------------|----------|
| `GetSceneTransitionList` | - | `transitions[]`, `currentSceneTransitionName`, `currentSceneTransitionKind` |
| `GetCurrentSceneTransition` | - | `transitionName`, `transitionKind`, `transitionDuration`, `transitionConfigurable` |
| `SetCurrentSceneTransition` | `transitionName` | - |
| `SetCurrentSceneTransitionDuration` | `transitionDuration` | - |

### Stream/Record Requests

| Request | Parameters | Response |
|---------|------------|----------|
| `GetStreamStatus` | - | `outputActive`, `outputReconnecting`, stats... |
| `StartStream` | - | - |
| `StopStream` | - | - |
| `GetStreamServiceSettings` | - | `streamServiceType`, `streamServiceSettings` |
| `SetStreamServiceSettings` | `streamServiceType`, `streamServiceSettings` | - |
| `GetRecordStatus` | - | `outputActive`, `outputPaused`, `outputPath`, stats... |
| `StartRecord` | - | - |
| `StopRecord` | - | `outputPath` |

### Screenshot Request

| Request | Parameters | Response |
|---------|------------|----------|
| `GetSourceScreenshot` | `sourceName`, `imageFormat`, `imageWidth?`, `imageHeight?`, `imageCompressionQuality?` | `imageData` (base64) |

---

## Appendix B: Questions and Decisions

### Resolved Questions

| Question | Decision |
|----------|----------|
| Should we use OBS's native scene collection export JSON format? | Yes, for maximum compatibility |
| How do templates handle asset references? | Use slot system with variable substitution |
| Should templates be "complete" or "partial"? | Complete scene collections with asset manifest |
| How is Discord audio captured? | Application audio capture (`wasapi_process_output_capture` on Windows, PulseAudio on Linux) |
| How should stream keys be secured? | Encrypted storage in Firebase, never exposed in API responses |
| Are VMs created fresh per competition or reused? | Fresh per competition, but can be provisioned from AMI |

### Open Questions (To Be Confirmed)

| Question | Context |
|----------|---------|
| What's the acceptable latency for talent return feed? | Need to test Discord screen share latency |
| Is Studio Mode (Preview/Program) used in production? | Determines if preview features are critical |
| What stream destinations are most commonly used? | YouTube, Twitch, or custom RTMP? |

---

## Appendix C: Related Documents

- [PRD: Advanced Rundown Editor](./PRD-RundownEditor-2026-01-16.md) - Depends on OBS Integration
- [PRD: Competition-Bound Architecture](./PRD-CompetitionBoundArchitecture-2026-01-13.md) - VM architecture
- [CLAUDE.md](../CLAUDE.md) - MCP tools and test environment documentation
