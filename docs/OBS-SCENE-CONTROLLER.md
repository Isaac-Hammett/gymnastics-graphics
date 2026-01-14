# OBS Scene Controller

Comprehensive breakdown of how the OBS scene control system works in the gymnastics-graphics system.

---

## Architecture Overview

The system uses **obs-websocket-js** to connect to OBS Studio via WebSocket (default: `ws://localhost:4455`). The backend server maintains the connection and broadcasts state changes to all connected frontend clients via Socket.io.

```
┌─────────────────┐     Socket.io      ┌─────────────────┐     WebSocket      ┌─────────────┐
│  Producer UI    │ ◄────────────────► │  Node Backend   │ ◄────────────────► │  OBS Studio │
│  (React App)    │                    │  (Express)      │                    │             │
└─────────────────┘                    └─────────────────┘                    └─────────────┘
```

---

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| OBS WebSocket Connection | `server/index.js:39-44` | Establishes connection to OBS |
| Scene Generator | `server/lib/obsSceneGenerator.js` | Auto-generates multi-camera scenes |
| Timesheet Engine | `server/lib/timesheetEngine.js` | Automated scene switching |
| Show Context | `show-controller/src/context/ShowContext.jsx` | Frontend socket management |
| Quick Actions | `show-controller/src/components/QuickActions.jsx` | Producer UI for scene control |
| Producer View | `show-controller/src/views/ProducerView.jsx` | Scene dropdown and overrides |

---

## Scene Control Flow

### User Action → OBS Scene Change Path

```
Frontend (Producer/Quick Actions)
    ↓
emit('overrideScene', { sceneName })  [Socket.io]
    ↓
Backend Socket Handler (index.js:1445-1456)
    ↓
switchScene(sceneName) function
    ↓
obs.call('SetCurrentProgramScene', { sceneName })
    ↓
OBS WebSocket API
    ↓
OBS Scene Changed
    ↓
'CurrentProgramSceneChanged' event emitted
    ↓
Backend broadcasts to all clients
```

### Backend Scene Switch Function

Located in `server/index.js:421-436`:

```javascript
async function switchScene(sceneName) {
  if (!showState.obsConnected) {
    console.error('Cannot switch scene: OBS not connected');
    return false;
  }

  try {
    await obs.call('SetCurrentProgramScene', { sceneName });
    console.log(`Switched to scene: ${sceneName}`);
    return true;
  } catch (error) {
    console.error(`Failed to switch scene to ${sceneName}:`, error.message);
    return false;
  }
}
```

### Socket Event Handler

Located in `server/index.js:1445-1456`:

```javascript
socket.on('overrideScene', async ({ sceneName }) => {
  const client = showState.connectedClients.find(c => c.id === socket.id);
  if (client?.role !== 'producer') {
    socket.emit('error', { message: 'Only producers can override scenes' });
    return;
  }

  const success = await switchScene(sceneName);
  if (!success) {
    socket.emit('error', { message: `Failed to switch to scene: ${sceneName}` });
  }
});
```

---

## Scene Generation System

### OBSSceneGenerator Module

Located in `server/lib/obsSceneGenerator.js`, this is a sophisticated scene generation engine that automatically creates OBS scenes based on camera configuration.

### Scene Types Generated

| Scene Type | Count | Description |
|------------|-------|-------------|
| Static | 3 | Starting Soon, BRB, Thanks for Watching |
| Single | n | One scene per camera (fullscreen) |
| Dual | n(n-1)/2 | All 2-camera combinations |
| Triple | n(n-1)(n-2)/6 | All 3-camera combinations (if n≥3) |
| Quad | n(n-1)(n-2)(n-3)/24 | All 4-camera combinations (if n≥4) |
| Graphics | 1 | Dedicated graphics overlay scene |

**Example**: For 4 cameras = 3 + 4 + 6 + 4 + 1 + 1 = **19 scenes**

### Layout Presets (1920x1080 Canvas)

| Preset | Description |
|--------|-------------|
| `fullscreen` | Single camera or graphics at full resolution |
| `dualLeft/Right` | 50/50 split layout |
| `quadTopLeft/TopRight/BottomLeft/BottomRight` | 4x4 grid layout |
| `tripleMain/TopRight/BottomRight` | Main + 2 sidebars layout |

### Key Methods

- `generateAllScenes()` - Generates all scene combinations
- `previewScenes()` - Shows what would be generated without creating
- `deleteGeneratedScenes()` - Cleans up auto-generated scenes
- `createCameraInput()` - Creates SRT inputs for cameras
- `addGraphicsOverlay()` - Adds browser source for graphics URL

---

## Two Control Modes

### 1. Automatic (Timesheet-driven)

The Timesheet Engine (`server/lib/timesheetEngine.js`) automatically switches OBS scenes when segments activate.

**Process**:
1. Segment activated in timesheet
2. `_applyTransitionAndSwitchScene()` called
3. Transition configured (cut, fade, or stinger)
4. `SetCurrentProgramScene` OBS call made
5. Scene change event emitted to all clients

**Transition Types**:
```javascript
const TRANSITION_TYPES = {
  CUT: 'cut',           // Instant switch
  FADE: 'fade',         // Fade with duration
  STINGER: 'stinger'    // Custom stinger animation
};
```

**Configuration** (in `server/config/show-config.json`):
```json
"transitions": {
  "default": { "type": "cut", "durationMs": 0 },
  "toBreak": { "type": "fade", "durationMs": 500 },
  "fromBreak": { "type": "fade", "durationMs": 500 }
}
```

### 2. Manual Override

Producers can override scenes at any time via:

1. **Quick Action Buttons** - Preset scenes (Talent, Competition, Scores, Replay)
2. **Scene Dropdown** - Select from all available OBS scenes
3. **Apparatus Buttons** - Switch to camera assigned to specific apparatus

---

## Scene Configuration

Each segment in `server/config/show-config.json` can specify:

```json
{
  "obsScene": "Single - Camera 1",      // Scene to switch to
  "cameraId": "cam-1",                  // Associated camera
  "intendedApparatus": ["FX"],         // Expected apparatus
  "type": "live|graphic|video|break"   // Segment type
}
```

### Example Segments

- Floor Exercise: `"obsScene": "Single - Camera 1"`
- Graphics: `"obsScene": "Graphics"`
- Break: `"obsScene": "BRB"`
- Talent: `"obsScene": "Talent Camera"`

---

## API Endpoints

### Scene Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scenes` | GET | List all available OBS scenes |
| `/api/scenes/generate` | POST | Generate scenes from camera config |
| `/api/scenes/preview` | GET | Preview what would be generated |
| `/api/scenes/generated` | DELETE | Clean up auto-generated scenes |

### Generate Scenes

```
POST /api/scenes/generate
Body: { types?: ["single", "dual", "triple", "quad", "static", "graphics"] }
Response: { created: [], skipped: [], failed: [], summary: {...} }
```

### Preview Scene Generation

```
GET /api/scenes/preview?types=single,dual
Response: { single: [...], dual: [...], totals: {...} }
```

---

## OBS API Calls Used

All calls via `obs-websocket-js` library:

### Scene Management
- `GetSceneList()` - Get all available scenes
- `CreateScene({ sceneName })` - Create new scene
- `RemoveScene({ sceneName })` - Delete scene
- `SetCurrentProgramScene({ sceneName })` - Switch active scene
- `GetCurrentProgramScene()` - Get current scene

### Input/Source Management
- `CreateInput()` - Create camera/browser source
- `GetInputSettings({ inputName })` - Get source config
- `SetInputSettings()` - Update source config

### Scene Items
- `CreateSceneItem()` - Add source to scene
- `SetSceneItemTransform()` - Position/scale source
- `SetSceneItemIndex()` - Layer order (z-index)

### Transitions
- `SetCurrentSceneTransition()` - Select transition type
- `SetCurrentSceneTransitionDuration()` - Set duration

### Media Control
- `TriggerMediaInputAction()` - Play/pause/stop video
- `GetMediaInputStatus()` - Get playback position

### Streaming/Recording
- `GetStreamStatus()` - Check if streaming
- `GetRecordStatus()` - Check if recording

---

## Graphics Overlay Integration

Every generated scene includes a browser source overlay pointing to the graphics URL.

**Configuration** (in `server/config/show-config.json`):
```json
"graphicsOverlay": {
  "url": "http://localhost:5173/graphics",
  "queryParams": {
    "theme": "cga",
    "showLowerThird": true
  }
}
```

**Implementation** (`obsSceneGenerator.js:304-357`):
- Single "Graphics Overlay" browser source created once
- Added to every scene at fullscreen with highest z-index
- URL built with query parameters
- Respects 1920x1080 canvas dimensions

---

## State Management

### Global Show State

Located in `server/index.js:47-65`:

```javascript
let showState = {
  obsConnected: false,           // WebSocket connection status
  obsCurrentScene: null,         // Currently displayed scene name
  obsIsStreaming: false,         // Stream output status
  obsIsRecording: false,         // Recording output status
  // ... other fields
};
```

### Real-Time Broadcasting

- State updates broadcast to all clients via `io.emit('stateUpdate', ...)`
- Scene changes broadcast via `io.emit('sceneChanged', sceneName)`
- All clients receive `CurrentProgramSceneChanged` events from OBS

---

## Camera-to-Scene Mapping

The system intelligently maps cameras to scenes.

**From show-config.json**:
```json
{
  "id": "cam-1",
  "name": "Camera 1 - Vault",
  "expectedApparatus": ["VT"],
  "fallbackCameraId": "cam-2"
}
```

**Scene Generator Creates**:
- `Single - Camera 1 - Vault` (fullscreen)
- `Dual - Camera 1 - Vault + Camera 2 - UB` (if dual enabled)
- Combined in multi-camera scenes

**Runtime Features**:
- Camera health monitored continuously
- Fallback triggered if primary fails
- Scene can be manually overridden by producer
- Apparatus reassignment supported at runtime

---

## Error Handling & Resilience

### Connection Resilience
- Automatic reconnection attempts every 30 seconds
- Connection status tracked in `showState.obsConnected`
- Failed scene switches logged but don't crash server
- Role-based access control (producer-only overrides)

### Scene Generation Error Handling
- Duplicate scene detection (error code 601 caught)
- Input existence checked before creation
- Individual scene failures don't block other generations
- Results tracked: created, skipped, failed

---

## Environment Configuration

From `.env.example`:

```
OBS_WEBSOCKET_URL=ws://localhost:4455
OBS_WEBSOCKET_PASSWORD=
```

---

## Frontend Integration

### ShowContext Hook

Located in `show-controller/src/context/ShowContext.jsx:325-327`:

```javascript
const overrideScene = useCallback((sceneName) => {
  socket?.emit('overrideScene', { sceneName });
}, [socket]);
```

### Quick Actions Component

Located in `show-controller/src/components/QuickActions.jsx`:
- Buttons for preset scenes (Talent Camera, Competition, Scores, Replay)
- Apparatus-based camera switching
- Shows real-time camera health status (dots)
- Indicates current active scene with blue highlight

---

## Summary

This is a comprehensive, well-architected system that integrates OBS control directly into the gymnastics show controller, enabling:

1. **Automated scene switching** based on show timing (timesheet-driven)
2. **Manual producer overrides** via intuitive UI controls
3. **Dynamic scene generation** based on camera configuration
4. **Real-time state synchronization** across all connected clients
5. **Resilient connection handling** with automatic reconnection

---

*Generated with Claude Code*
