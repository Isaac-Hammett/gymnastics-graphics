# OBS Architecture Reference for PRD Work

**Last Updated:** 2026-01-20

This document explains the OBS integration architecture to provide context for anyone working on OBS-related PRDs. Understanding this architecture is critical for correctly designing and implementing OBS features.

---

## Key Concept: Where Does OBS Run?

**OBS runs on competition-specific VMs, NOT on the coordinator or frontend.**

| Component | Where it runs | What it does |
|-----------|---------------|--------------|
| **OBS Studio** | Competition VM | Runs headless, handles video mixing and streaming |
| **Node.js Show Server** | Competition VM | Port 3003, controls local OBS |
| **Coordinator Server** | Coordinator VM | Manages VM pool, **proxies OBS connections from frontend** |
| **Frontend** | User's browser | React SPA, connects to coordinator (not directly to VMs) |

---

## VM Inventory

### 1. Coordinator VM (Always Running)

| Property | Value |
|----------|-------|
| **Name** | Coordinator |
| **IP** | 44.193.31.120 (Elastic IP) |
| **Domain** | api.commentarygraphic.com |
| **Port** | 3001 (proxied via nginx with SSL) |
| **Directory** | /opt/gymnastics-graphics |
| **PM2 Process** | `coordinator` |
| **Logs** | `/home/ubuntu/.pm2/logs/coordinator-*.log` |

**SSH Access:**
```bash
# Via MCP tool
ssh_exec target="44.193.31.120" command="pm2 logs coordinator --lines 50"

# Check status
ssh_exec target="44.193.31.120" command="pm2 list"
```

**Deploy Updates:**
```bash
ssh_exec target="44.193.31.120" command="cd /opt/gymnastics-graphics && sudo git pull --rebase origin dev && pm2 restart coordinator"
```

**What it does:**
- Serves as the **central hub** for all frontend connections
- Manages the VM pool (starting/stopping VMs, assigning to competitions)
- **Proxies OBS WebSocket connections** to competition VMs (solves Mixed Content issue)
- Syncs state to Firebase
- Handles auto-shutdown of idle VMs

**Key services running:**
- Node.js server (PM2 managed) on port 3001
- nginx reverse proxy (SSL termination for api.commentarygraphic.com)

### 2. Competition VMs (Where OBS Actually Runs)

| Property | Value |
|----------|-------|
| **Naming pattern** | gymnastics-vm-{timestamp} |
| **Instance type** | t3.large |
| **Managed by** | VM Pool Manager on Coordinator |

Each competition gets its own dedicated VM running:
- **OBS Studio** (headless via XVFB on display `:99`)
- **OBS WebSocket Plugin** on port `4455` (localhost only)
- **Node.js Show Server** on port `3003`
- **Nimble SRT** for camera input streams (ports 9001-9010)

**Current VMs:**

| VM ID | Instance ID | Status | Assigned To | IP |
|-------|-------------|--------|-------------|-----|
| vm-5537f632 | i-09818a23f5537f632 | assigned | 8kyf0rnl | 50.19.137.152 |
| vm-4f19ddbd | i-08abea9194f19ddbd | stopped | - | - |
| vm-d940b11a | i-0a20c68a1d940b11a | stopped | - | - |

### 3. Frontend Server (Static Hosting Only)

| Property | Value |
|----------|-------|
| **Domain** | commentarygraphic.com |
| **IP** | 3.87.107.201 |
| **Purpose** | Serves React SPA static files |

This server ONLY serves static files (HTML, JS, CSS). It does NOT run any backend services. Users download the React app from here, then the app connects to the **coordinator**.

### 4. VM Template AMI

| Property | Value |
|----------|-------|
| **Current AMI** | `ami-070ce58462b2b9213` (gymnastics-vm-v2.2) |
| **Created From** | VM 50.19.137.152 on 2026-01-20 |
| **Features** | OBS WebSocket auth disabled, heartbeat disconnect fix, state sync fixes |
| **Config Location** | `server/lib/awsService.js` line 34 |

New VMs launched by the VM Pool Manager will automatically use this AMI.

---

## Connection Architecture

This is the critical part to understand. **The frontend NEVER connects directly to competition VMs in production.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User's Browser                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  React App (show-controller)                                     │   │
│  │  - Downloaded from commentarygraphic.com (static files)          │   │
│  │  - ALL connections go to api.commentarygraphic.com               │   │
│  │  - Sends compId with each request so coordinator knows routing   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS / WSS (port 443)
                                    │ Socket.io connection
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              COORDINATOR VM (api.commentarygraphic.com)                 │
│              IP: 44.193.31.120                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  nginx (SSL termination)                                         │   │
│  │  - Terminates HTTPS                                              │   │
│  │  - Proxies to Node.js on port 3001                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Coordinator Server (Node.js, port 3001)                         │   │
│  │                                                                   │   │
│  │  - Receives Socket.io connections from frontend                  │   │
│  │  - Extracts compId from connection query                         │   │
│  │  - Looks up vmAddress for that competition                       │   │
│  │  - Maintains OBS WebSocket connection to the competition VM      │   │
│  │  - Forwards commands from frontend → VM                          │   │
│  │  - Broadcasts state from VM → frontend                           │   │
│  │                                                                   │   │
│  │  Key modules:                                                     │   │
│  │  - obsConnectionManager.js: Per-competition OBS connections      │   │
│  │  - obsStateSync.js: Caches and broadcasts OBS state              │   │
│  │  - vmPoolManager.js: VM lifecycle management                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │                                           │
          │ OBS WebSocket                             │ OBS WebSocket
          │ ws://VM-IP:4455                           │ ws://VM-IP:4455
          │ (Competition A)                           │ (Competition B)
          ▼                                           ▼
┌──────────────────────────────┐     ┌──────────────────────────────┐
│   COMPETITION VM A           │     │   COMPETITION VM B           │
│   (e.g., 50.19.137.152)      │     │   (e.g., 54.210.98.89)       │
│  ┌────────────────────────┐  │     │  ┌────────────────────────┐  │
│  │ OBS Studio (headless)  │  │     │  │ OBS Studio (headless)  │  │
│  │ - Port 4455 WebSocket  │  │     │  │ - Port 4455 WebSocket  │  │
│  │ - localhost only       │  │     │  │ - localhost only       │  │
│  └────────────────────────┘  │     │  └────────────────────────┘  │
│  ┌────────────────────────┐  │     │  ┌────────────────────────┐  │
│  │ Show Server (Node.js)  │  │     │  │ Show Server (Node.js)  │  │
│  │ - Port 3003            │  │     │  │ - Port 3003            │  │
│  └────────────────────────┘  │     │  └────────────────────────┘  │
└──────────────────────────────┘     └──────────────────────────────┘
```

---

## Why the Coordinator Proxy?

**Mixed Content Security:** Browsers block HTTPS pages from connecting to HTTP/WS endpoints.

- Frontend is served from `https://commentarygraphic.com`
- Competition VMs only have HTTP (no SSL certificates)
- Direct connection would fail: `https://` page → `ws://VM:4455` = BLOCKED

**Solution:** The coordinator has SSL (via `api.commentarygraphic.com`). Frontend connects securely to coordinator, coordinator connects to VMs internally (server-to-server, no browser restrictions).

---

## How Routing Works

1. **User navigates to:** `https://commentarygraphic.com/8kyf0rnl/producer`

2. **React app loads** and extracts `compId` = `8kyf0rnl`

3. **CompetitionContext** determines socket URL:
   - Production (HTTPS): Always `https://api.commentarygraphic.com`
   - Development (HTTP): Can use direct VM address

4. **Frontend connects Socket.io** to coordinator with `compId` in query:
   ```javascript
   io('https://api.commentarygraphic.com', { query: { compId: '8kyf0rnl' } })
   ```

5. **Coordinator receives connection**, looks up VM for `8kyf0rnl`:
   - Checks Firebase: `competitions/8kyf0rnl/config/vmAddress`
   - Gets: `50.19.137.152:3003`

6. **Coordinator connects to VM's OBS** (if not already connected):
   ```javascript
   obsConnectionManager.connectToVM('8kyf0rnl', '50.19.137.152')
   // Connects to ws://50.19.137.152:4455
   ```

7. **Commands flow through coordinator:**
   - Frontend emits: `overrideScene({ sceneName: "Camera 1" })`
   - Coordinator receives, routes to correct OBS connection
   - OBS on VM switches scene
   - OBS emits `CurrentProgramSceneChanged`
   - Coordinator broadcasts to all frontend clients for that competition

---

## Firebase Paths

```
competitions/
  {compId}/
    config/
      vmAddress: "50.19.137.152:3003"    # Which VM runs this competition
      eventName: "UCLA vs Stanford"
      gender: "womens"
    obs/
      state/
        connected: true                   # Is coordinator connected to this VM's OBS?
        currentScene: "Camera 1"
        scenes: [...]

vmPool/
  config/
    warmCount: 2                          # VMs to keep running
    coldCount: 3                          # Stopped VMs available
  vms/
    {vmId}/
      instanceId: "i-xxx"
      status: "assigned" | "available" | "stopped"
      assignedTo: "8kyf0rnl"              # Competition ID if assigned
      publicIp: "50.19.137.152"
```

---

## Network Ports Reference

| Port | VM | Service | Access |
|------|-----|---------|--------|
| 443 | Coordinator | nginx (HTTPS) | Public |
| 3001 | Coordinator | Node.js server | Internal (proxied via nginx) |
| 3003 | Competition VM | Show Server | Public (but typically accessed via coordinator) |
| 4455 | Competition VM | OBS WebSocket | localhost only |
| 9001-9010 | Competition VM | SRT camera inputs | Public |
| 22 | All | SSH | Admin only |

---

## Critical Points for PRD Authors

### 1. Frontend NEVER talks directly to OBS

**Wrong:** Frontend connects to OBS WebSocket at `ws://VM:4455`
**Right:** Frontend connects to coordinator, coordinator manages OBS connections

### 2. The Coordinator is the Hub

All frontend traffic flows through the coordinator:
```
Frontend → Coordinator → Competition VM
Frontend ← Coordinator ← Competition VM
```

### 3. OBS WebSocket (4455) is Internal Only

Port 4455 is NOT exposed publicly. Only the Show Server on the same VM can access it.

### 4. Each Competition is Isolated

- Competition A on VM-1 has its own OBS instance
- Competition B on VM-2 has its own OBS instance
- The coordinator maintains separate connections to each
- Clients for Competition A only receive events for Competition A

### 5. vmAddress in Firebase vs Actual Connection

- `vmAddress` in Firebase is `IP:3003` (Show Server port)
- Coordinator parses this and connects to OBS on port `4455`
- Frontend sees `vmAddress` but connects to coordinator, not the VM

---

## Common Mistakes in PRDs

### Mistake 1: "Frontend connects to OBS"

**Wrong:** The frontend establishes an OBS WebSocket connection
**Right:** The frontend connects to the coordinator via Socket.io; the coordinator manages OBS connections

### Mistake 2: "OBS runs on the coordinator"

**Wrong:** The coordinator VM runs OBS for all competitions
**Right:** Each competition VM runs its own OBS; the coordinator just manages connections

### Mistake 3: "Connect directly to the VM"

**Wrong:** Frontend connects directly to `http://50.19.137.152:3003`
**Right:** In production, frontend always connects to `https://api.commentarygraphic.com`

### Mistake 4: "Update OBS state from the frontend"

**Wrong:** Frontend writes OBS state to Firebase
**Right:** Only the coordinator writes OBS state (it's the source of truth for connections)

---

## Debugging Checklist

When OBS features aren't working:

1. **Is the coordinator running?**
   ```bash
   curl https://api.commentarygraphic.com/api/coordinator/status
   ```

2. **Is the competition VM assigned and running?**
   - Check `vmPool/vms/{vmId}` in Firebase
   - Check `competitions/{compId}/config/vmAddress`

3. **Is the coordinator connected to the VM's OBS?**
   - Check coordinator logs: `pm2 logs coordinator`
   - Look for `[OBSConnectionManager] Connected to OBS for {compId}`

4. **Is OBS running on the VM?**
   ```bash
   ssh_exec target={vmIP} command="systemctl status obs"
   ```

5. **Are frontend events reaching the coordinator?**
   - Browser DevTools → Network → WS tab
   - Check Socket.io frames being sent

6. **Is the coordinator forwarding to the right VM?**
   - Coordinator logs should show `[Socket] Client joined room competition:{compId}`

---

## Socket Event Flow

Understanding how events flow is critical for debugging and feature development.

### Initial Page Load Sequence

```
1. Frontend loads, CompetitionContext extracts compId from URL
2. ShowContext establishes Socket.io connection to api.commentarygraphic.com
   └─ io('https://api.commentarygraphic.com', { query: { compId: '8kyf0rnl' } })

3. Coordinator receives connection (server/index.js line 2391)
   └─ socket.join('competition:8kyf0rnl')
   └─ Looks up VM for competition via VMPoolManager
   └─ obsConnectionManager.connectToVM('8kyf0rnl', '50.19.137.152')
   └─ Sends initial obs:stateUpdated (minimal: {connected, connectionError})

4. OBSContext sets up listeners, emits obs:refreshState (line 137)

5. Coordinator receives obs:refreshState (server/index.js line 3259)
   └─ Checks: Is this a competition-based request? (compId !== 'local')
   └─ Gets connection state from obsConnectionManager
   └─ If connected: broadcastOBSState(compId, obsConnManager, io)
   └─ Broadcasts FULL state: {scenes, currentScene, inputs, audioSources, ...}

6. Frontend receives obs:stateUpdated with complete state
   └─ OBSContext.handleStateUpdate() updates obsState
   └─ UI renders with scenes
```

### Scene Switch Flow

```
USER: Clicks scene in OBS Manager
         │
         ▼
OBSContext.switchScene('Scene Name')
  socket.emit('switchScene', {sceneName})
         │
         ▼ (Socket.io over HTTPS)
Coordinator (server/index.js line 2563)
  const compObs = obsConnManager.getConnection(clientCompId)
  await compObs.call('SetCurrentProgramScene', {sceneName})
         │
         ▼ (OBS WebSocket to VM)
VM OBS Instance changes scene
  OBS fires: CurrentProgramSceneChanged event
         │
         ▼ (Back to coordinator)
obsConnectionManager event handler (line 3680)
  io.to('competition:compId').emit('obs:currentSceneChanged', data)
         │
         ▼ (Socket.io back to frontend)
OBSContext receives event, updates state
UI re-renders with highlighted scene
```

### Socket Events Reference

**Frontend → Coordinator:**

| Event | Purpose | Handler Location |
|-------|---------|------------------|
| `obs:refreshState` | Request full OBS state | index.js:3259 |
| `switchScene` | Switch OBS scene | index.js:2563 |
| `obs:createScene` | Create new scene | index.js:2598 |
| `obs:deleteScene` | Delete scene | index.js:2683 |
| `obs:reorderScenes` | Reorder scenes | index.js:2717 |
| `obs:toggleItemVisibility` | Show/hide source | index.js:2767 |
| `obs:setVolume` | Set audio volume | index.js:2863 |
| `obs:setMute` | Mute/unmute audio | index.js:2893 |

**Coordinator → Frontend:**

| Event | Purpose | Triggered By |
|-------|---------|--------------|
| `obs:stateUpdated` | Full state update | broadcastOBSState() |
| `obs:connected` | OBS connection established | obsConnManager.on('connected') |
| `obs:disconnected` | OBS connection lost | obsConnManager.on('disconnected') |
| `obs:currentSceneChanged` | Scene switched in OBS | OBS WebSocket event |
| `sceneChanged` | Legacy scene changed event | OBS WebSocket event |

---

## Two OBS Subsystems (Important!)

The codebase has TWO different OBS management systems:

### 1. obsConnectionManager (For Competition VMs)

**Used when:** `compId !== 'local'` (production, multiple competitions)

```javascript
// server/lib/obsConnectionManager.js
// Singleton that manages per-competition OBS WebSocket connections

connections: Map<compId → OBSWebSocket>
connectionStates: Map<compId → {connected, vmAddress, error}>

// Connects to OBS on VM via: ws://VM-IP:4455
obsConnManager.connectToVM('8kyf0rnl', '50.19.137.152')
```

### 2. obsStateSync (For Local Development)

**Used when:** `compId === 'local'` (local development, single OBS)

```javascript
// server/lib/obsStateSync.js
// Manages a single local OBS connection

// Connects to local OBS: ws://localhost:4455
obsStateSync.obs.connect()
```

### How obs:refreshState Routes

```javascript
socket.on('obs:refreshState', async () => {
  // FIRST: Try competition-based connection
  if (clientCompId && clientCompId !== 'local') {
    const connState = obsConnManager.getConnectionState(clientCompId);
    if (connState && connState.connected) {
      await broadcastOBSState(clientCompId, obsConnManager, io);
      return;  // ← Competition path: uses obsConnectionManager
    }
  }

  // FALLBACK: Local obsStateSync
  if (obsStateSync && obsStateSync.isInitialized()) {
    await obsStateSync.refreshFullState();  // ← Local path
  }
});
```

**Common Bug:** If the competition path doesn't trigger, scenes won't load because the local obsStateSync isn't connected to OBS.

---

## Key Files Reference

### Coordinator (server/)

| File | Purpose |
|------|---------|
| `server/index.js` | Main server, Socket.io handlers, routing logic |
| `server/lib/obsConnectionManager.js` | Manages per-competition OBS WebSocket connections |
| `server/lib/obsStateSync.js` | Caches OBS state for LOCAL development only |
| `server/lib/vmPoolManager.js` | VM lifecycle (assign, release, start, stop) |

### Frontend (show-controller/src/)

| File | Purpose |
|------|---------|
| `context/CompetitionContext.jsx` | Determines socket URL (always coordinator in production) |
| `context/ShowContext.jsx` | Socket.io connection, receives OBS events |
| `context/OBSContext.jsx` | OBS-specific state management, emits commands |

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `broadcastOBSState()` | index.js:2311 | Fetches full OBS state and broadcasts to room |
| `initializeOBSConnectionManager()` | index.js:3676 | Sets up event forwarding from OBS to clients |
| `getOBSConnectionManager()` | index.js | Returns singleton obsConnectionManager |

---

## Deploying Coordinator Changes

When you make changes to server code that affects OBS functionality, you must deploy to the coordinator:

```bash
# Via MCP tool (ssh_exec)
ssh_exec target="coordinator" command="cd /opt/gymnastics-graphics && sudo git pull --rebase origin dev && pm2 restart coordinator"

# Or manually via SSH
ssh ubuntu@44.193.31.120
cd /opt/gymnastics-graphics
sudo git pull --rebase origin dev
pm2 restart coordinator
```

**What requires coordinator deployment:**
- Changes to `server/index.js` (Socket.io handlers, routing)
- Changes to `server/lib/obsConnectionManager.js` (OBS connection management)
- Changes to `server/lib/obsStateSync.js` (state sync logic)
- Changes to `server/lib/vmPoolManager.js` (VM pool management)
- Changes to `server/lib/awsService.js` (AWS/AMI configuration)

**Verify deployment:**
```bash
# Check coordinator is running
ssh_exec target="coordinator" command="pm2 list"

# Check recent logs
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 20"

# Check API health
curl https://api.commentarygraphic.com/api/coordinator/status
```

---

## Scene Templates

Production-ready OBS scene collection templates are available for generating competition scenes.

**Location:** `server/config/sceneTemplates/`

| Template | Competition Type | Scenes | Cameras |
|----------|------------------|--------|---------|
| `20260119-obs-template-ai-dual.json` | Dual meets (2 teams) | 9 | A, B |
| `20260119-obs-template-ai-quad.json` | Quad meets (4 teams) | 22 | A, B, C, D |

Both templates work for men's and women's competitions.

**Scene types included:**
- Static (Starting Soon, End Stream)
- Full Screen (single camera)
- Dual/Triple/Quad View (multi-camera layouts)
- Replay scenes
- Graphics-only (no video)

For detailed scene breakdowns, see [PRD-OBS-02-SceneManagement](PRD-OBS-02-SceneManagement/PRD-OBS-02-SceneManagement.md#reference-scene-templates).

---

## Related Documents

- [PRD-OBS-00-Index.md](PRD-OBS-00-Index.md) - Overview of all OBS PRDs
- [PRD-OBS-02-SceneManagement](PRD-OBS-02-SceneManagement/PRD-OBS-02-SceneManagement.md) - Scene management PRD
- [SPEC-competition-vm-routing.md](SPEC-competition-vm-routing.md) - How routing works
- [CLAUDE.md](../CLAUDE.md) - MCP tools and deployment instructions
