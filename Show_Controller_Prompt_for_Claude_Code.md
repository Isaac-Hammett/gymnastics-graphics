# Show Controller - Build Spec for Claude Code

## Overview
Extend the existing **gymnastics-graphics** project to add **OBS scene control** and show sequencing. 

**The key addition:** Right now the app only lets users trigger graphics. We need users to also be able to **switch OBS scenes** remotely via the web interface.

**Existing Project:** https://github.com/Isaac-Hammett/gymnastics-graphics

## What Already Exists
- Web-based graphics generation
- Producer mode for triggering graphics remotely
- Graphics displayed via browser source in OBS

## What's Missing (What We're Adding)
1. **OBS Scene Control** - Remote users can switch OBS scenes directly from their browser (not just graphics)
2. **Run of Show Manager** - Define and sequence all segments
3. **Talent Control View** - Remote talent can advance through show and control OBS
4. **Show State Sync** - All clients stay in sync

## The Problem We're Solving
**Current:** Talent can trigger graphics, but someone local has to switch OBS scenes manually.
**After:** Talent clicks "Next" in browser → OBS scene switches automatically on your machine.

## Architecture

```
┌─────────────────────┐         
│  Talent Browser     │         
│  (anywhere)         │◄───────┐
└─────────────────────┘        │
                               │  WebSocket (internet)
┌─────────────────────┐        │
│  Producer Browser   │◄───────┤
│  (anywhere)         │        │
└─────────────────────┘        │
                               ▼
                    ┌─────────────────────┐
                    │   Node.js Server    │
                    │   (YOUR computer)   │
                    └──────────┬──────────┘
                               │
                               │ OBS WebSocket (localhost)
                               ▼
                    ┌─────────────────────┐
                    │        OBS          │
                    │   (YOUR computer)   │
                    └─────────────────────┘
```

**How it works:**
1. OBS runs on YOUR computer with WebSocket plugin enabled
2. Node.js server runs on YOUR computer, connects to OBS via localhost
3. Remote users (talent) connect to your server via web browser
4. When talent clicks a button → Browser sends to Server → Server tells OBS → Scene changes

## Tech Stack
- **Backend:** Node.js with Express
- **WebSocket:** Socket.io (for client connections) + obs-websocket-js (for OBS)
- **Frontend:** React (Vite)
- **Styling:** Tailwind CSS
- **State Management:** React Context or Zustand

## Features

### 1. Show Configuration (JSON-based)
The show is defined in a JSON file that specifies the run of show. This integrates with the existing graphics system - when a segment triggers, it can also trigger the appropriate graphic.

```json
{
  "showName": "CGA All Stars 2025",
  "segments": [
    {
      "id": "intro",
      "name": "Show Intro",
      "type": "video",
      "obsScene": "Intro Video",
      "duration": 45,
      "autoAdvance": true
    },
    {
      "id": "welcome",
      "name": "Welcome & Host Intro",
      "type": "live",
      "obsScene": "Talent Camera",
      "duration": null,
      "autoAdvance": false,
      "notes": "Introduce the show and sponsors"
    },
    {
      "id": "rotation1-intro",
      "name": "Rotation 1 Intro",
      "type": "graphic",
      "obsScene": "Rotation Intro",
      "graphic": "rotation-intro",
      "graphicData": {
        "rotation": 1,
        "events": ["Floor", "Pommel Horse", "Rings", "Vault", "P-Bars", "High Bar"]
      },
      "duration": 5,
      "autoAdvance": true
    },
    {
      "id": "rotation1-floor",
      "name": "Floor - Athlete Name",
      "type": "video",
      "obsScene": "Routine Video",
      "sourceFile": "/videos/rotation1/floor_001.mp4",
      "duration": 90,
      "autoAdvance": true,
      "graphic": "athlete-lower-third",
      "graphicData": {
        "name": "John Smith",
        "school": "Oklahoma",
        "event": "Floor"
      }
    }
  ],
  "sponsors": {
    "floor": "DGS",
    "pommelHorse": "Flipfest",
    "rings": "Turngymnastics",
    "vault": "Score Cat",
    "pBars": "Sideline Scout",
    "highBar": "Speeth"
  }
}
```

**Integration with existing graphics:**
- `graphic` field references a graphic type from the existing system
- `graphicData` passes data to populate the graphic
- When segment activates, both OBS scene switches AND graphic triggers

### 2. Talent View (Web Interface)

```
┌────────────────────────────────────────────────────────────┐
│  CGA ALL STARS 2025                    Connected 🟢        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  NOW PLAYING                                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                                                      │ │
│  │   🎬  Rotation 1 - Floor - John Smith               │ │
│  │                                                      │ │
│  │   ████████████████░░░░░░░░  1:23 / 1:45             │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  UP NEXT                                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │   Interview - Jane Doe (Oklahoma)                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│              ┌─────────────────────┐                       │
│              │                     │                       │
│              │    ▶ NEXT           │                       │
│              │                     │                       │
│              └─────────────────────┘                       │
│                                                            │
│  QUICK ACTIONS                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Talent   │ │ Scores   │ │ Sponsor  │ │ Replay   │     │
│  │ Camera   │ │ Board    │ │ Graphic  │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  SHOW PROGRESS                                             │
│  ✓ Intro                                                   │
│  ✓ Welcome                                                 │
│  ► Rotation 1 - Floor - John Smith    ◄── YOU ARE HERE    │
│  ○ Interview - Jane Doe                                    │
│  ○ Rotation 1 - Pommel Horse - Mike Johnson               │
│  ○ ...                                                     │
│                                        Segment 12 of 87   │
└────────────────────────────────────────────────────────────┘
```

**Talent View Features:**
- Large, clear "NEXT" button (primary action)
- Current segment with progress bar (if video)
- Preview of what's coming next
- Quick action buttons for common scene switches
- Scrollable run of show with current position highlighted
- Connection status indicator
- Notes/prompts for live segments (what to say)

### 3. Producer View (Extended Controls)

Everything in Talent View, plus:

```
┌────────────────────────────────────────────────────────────┐
│  PRODUCER CONTROLS                                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  SCENE OVERRIDE                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Intro    │ │ Talent   │ │ Routine  │ │ Scores   │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Interview│ │ Sponsor  │ │ BRB      │ │ End Card │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                            │
│  SHOW CONTROL                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────────┐    │
│  │◄ PREV  │ │ ▶ NEXT │ │  PAUSE │ │ JUMP TO SEGMENT │    │
│  └────────┘ └────────┘ └────────┘ └─────────────────┘    │
│                                                            │
│  LOCK TALENT CONTROLS: [ ] (prevent talent from advancing)│
│                                                            │
│  OBS STATUS                                                │
│  Connected: ✅  |  Scene: Routine Video  |  Streaming: 🔴  │
│                                                            │
│  CONNECTED CLIENTS                                         │
│  • Talent 1 (Chrome) - Active                              │
│  • Producer (Firefox) - Active                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Producer View Features:**
- Full scene override (switch to any scene anytime)
- Previous button (go back in run of show)
- Pause auto-advance
- Jump to any segment
- Lock talent controls (prevent accidental advances)
- OBS connection status and current scene
- List of connected clients
- Streaming/recording status from OBS

### 4. Backend Server

**Responsibilities:**
- Maintain WebSocket connections with all clients
- Connect to OBS via obs-websocket-js
- Broadcast state changes to all clients
- Handle scene switching commands
- Track current position in run of show
- Auto-advance when video segments complete
- Load and serve show configuration

**Key Endpoints/Events:**

```javascript
// Socket.io events

// Client -> Server
'advance'           // Go to next segment
'previous'          // Go to previous segment  
'jumpTo'            // Jump to specific segment by ID
'overrideScene'     // Switch to scene without advancing show position
'lockTalent'        // Toggle talent lock

// Server -> Client
'stateUpdate'       // Full state update (current segment, position, etc.)
'sceneChanged'      // OBS scene changed
'connected'         // Client connected successfully
'error'             // Error message
```

**State Object:**
```javascript
{
  currentSegmentIndex: 5,
  currentSegment: { /* segment object */ },
  nextSegment: { /* segment object */ },
  isPlaying: true,
  isPaused: false,
  talentLocked: false,
  obsConnected: true,
  obsCurrentScene: "Routine Video",
  obsIsStreaming: false,
  obsIsRecording: true,
  connectedClients: [
    { id: "abc123", role: "talent", name: "Talent 1" },
    { id: "def456", role: "producer", name: "Producer" }
  ],
  showProgress: {
    completed: 5,
    total: 87
  }
}
```

### 5. OBS Integration

**Required OBS Setup:**
- OBS WebSocket plugin installed and enabled
- Password configured
- Scenes named to match show config

**OBS Commands Used:**
- `SetCurrentProgramScene` - Switch scenes
- `GetCurrentProgramScene` - Get current scene
- `GetSceneList` - List available scenes
- `GetStreamStatus` - Check if streaming
- `GetRecordStatus` - Check if recording

**Video Playback Detection:**
For auto-advance on video completion, options:
1. Use duration from config + timer
2. Monitor OBS media source state (if using VLC source)
3. Have videos report completion via separate mechanism

### 6. Configuration & Setup

**Environment Variables:**
```
OBS_WEBSOCKET_URL=ws://localhost:4455
OBS_WEBSOCKET_PASSWORD=your-password
PORT=3000
TALENT_PASSWORD=optional-talent-auth
PRODUCER_PASSWORD=optional-producer-auth
```

**Show Config File:**
- `show-config.json` in project root
- Hot-reloadable (can update without restart)
- Validated on load

### 7. Mobile Responsive

Both views should work on tablet/phone:
- Talent might use iPad
- Producer might need to check from phone
- Large touch targets
- Simplified layout on small screens

### 8. Error Handling

- OBS disconnection: Show warning, attempt reconnect, queue commands
- Client disconnection: Auto-reconnect with state sync
- Invalid segment: Skip and log error
- Scene not found in OBS: Log warning, continue

### 9. Deployment

For local network use (CGA All Stars):
- Run on producer's machine
- Talent connects via local IP (e.g., http://192.168.1.100:3000)
- No internet required

For future cloud deployment:
- Could run on VPS
- OBS connects outbound via WebSocket
- Clients connect from anywhere

## File Structure

**Add to existing gymnastics-graphics project:**

```
gymnastics-graphics/
├── ... (existing files)
├── server/
│   ├── ... (existing)
│   ├── showState.js          # NEW: Show state management
│   └── config/
│       └── show-config.json  # NEW: Run of show definition
├── client/
│   ├── src/
│   │   ├── ... (existing)
│   │   ├── views/
│   │   │   ├── ... (existing)
│   │   │   ├── TalentView.jsx      # NEW
│   │   │   └── ShowProducerView.jsx # NEW (or extend existing producer)
│   │   ├── components/
│   │   │   ├── ... (existing)
│   │   │   ├── CurrentSegment.jsx  # NEW
│   │   │   ├── NextSegment.jsx     # NEW
│   │   │   ├── ProgressBar.jsx     # NEW
│   │   │   ├── RunOfShow.jsx       # NEW
│   │   │   └── ShowControls.jsx    # NEW
│   │   └── context/
│   │       ├── ... (existing)
│   │       └── ShowContext.jsx     # NEW
```

**Key integration points:**
- Reuse existing OBS connection code
- Reuse existing graphics triggering system
- Add new routes: `/talent`, `/show-producer`
- Add new Socket.io events for show state

## Future Enhancements (Not for initial build)

### AI Producer Mode
- Connect to score feed API
- Monitor for score updates, suggest scene changes
- Track rotation schedule, prompt for upcoming athletes
- Voice command integration ("Switch to scores")
- Auto-generate talking points based on athlete stats

### Multi-Show Support
- Save/load different show configs
- Template system for common show formats

### Replay System
- Mark moments for replay
- Quick access to recent clips

### Graphics Control
- Update lower thirds text
- Control graphic overlays
- Timer/clock displays

## Dependencies

```json
{
  "server": {
    "express": "^4.18.x",
    "socket.io": "^4.x",
    "obs-websocket-js": "^5.x",
    "cors": "^2.x"
  },
  "client": {
    "react": "^18.x",
    "socket.io-client": "^4.x",
    "tailwindcss": "^3.x",
    "@heroicons/react": "^2.x"
  }
}
```

## Getting Started

1. Install OBS WebSocket plugin (OBS 28+ has it built-in)
2. Enable WebSocket in OBS settings, set password
3. Create scenes in OBS matching your show config
4. Edit `show-config.json` with your run of show
5. Run server: `npm run server`
6. Run client: `npm run client`
7. Open producer view: `http://localhost:3000/producer`
8. Share talent URL: `http://[your-ip]:3000/talent`

## Testing Checklist

- [ ] OBS connects successfully
- [ ] Scene switching works
- [ ] Multiple clients stay in sync
- [ ] Auto-advance works on timed segments
- [ ] Producer can override scenes
- [ ] Producer can lock talent controls
- [ ] Reconnection works after disconnect
- [ ] Mobile layout is usable
- [ ] Show config hot-reloads
