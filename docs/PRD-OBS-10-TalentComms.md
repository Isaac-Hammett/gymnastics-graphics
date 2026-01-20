# PRD-OBS-10: Talent Communications

**Version:** 1.1
**Date:** 2026-01-20
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** None

---

## Overview

Talent communication system - VDO.Ninja integration for remote commentators to see program output and send audio back. Discord fallback for when VDO.Ninja has issues.

**Architecture Note:** See [README-OBS-Architecture.md](README-OBS-Architecture.md) for the full system architecture. Key points:
- OBS runs on **competition VMs**, not the coordinator
- Frontend communicates via **coordinator** (Socket.io), never directly to VMs
- All talent comms configuration is stored in Firebase and managed through the coordinator

---

## Current State

### What Exists
- `server/lib/talentCommsManager.js` (~200 lines) - VDO.Ninja URL generation
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - UI panel
- Socket events for talent comms (via coordinator)

### Test Results
- Not tested yet (⏭️ SKIPPED)

---

## How VDO.Ninja Works

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          VDO.NINJA WORKFLOW                                 │
│                                                                             │
│  COMPETITION VM                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  ┌─────────────┐       ┌─────────────┐       ┌───────────┐      │       │
│  │  │     OBS     │◄────► │  VDO.Ninja  │◄─────►│  Talent   │      │       │
│  │  │  (Browser   │ WebRTC│   (cloud)   │ WebRTC│ (Browser) │      │       │
│  │  │   Sources)  │       │             │       │           │      │       │
│  │  └─────────────┘       └─────────────┘       └───────────┘      │       │
│  │                                                                  │       │
│  │  OBS runs headless on port :4455 (localhost only)               │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  Talent sees program output, talks back via microphone                      │
│  OBS captures talent audio via browser source                               │
└────────────────────────────────────────────────────────────────────────────┘
```

**Important:** The VDO.Ninja browser source runs inside OBS on the **competition VM**. The frontend never connects directly to OBS - it configures talent comms via the coordinator.

---

## Requirements

### 1. VDO.Ninja Room Setup

On competition assignment, generate unique room:

**Room ID Format:** `gym-comp-{shortId}`

**URLs Generated:**
| URL Type | Purpose | Example |
|----------|---------|---------|
| OBS Scene URL | Captures talent audio | `vdo.ninja/?scene&room=gym-comp-abc123` |
| Talent 1 URL | Talent sees program, sends audio | `vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent1` |
| Talent 2 URL | Second commentator | `vdo.ninja/?room=gym-comp-abc123&view=OBSProgram&push=talent2` |

**Test Cases:**
- [ ] Generate room on competition setup
- [ ] URLs stored in Firebase
- [ ] URLs displayed in UI for copying

### 2. Talent URL Distribution

**Test Cases:**
- [ ] Copy URL to clipboard
- [ ] Regenerate URLs (new room ID)
- [ ] Email URLs to talent (future feature)

### 3. OBS Browser Sources (Competition VM)

Templates should include VDO.Ninja browser source **in the OBS instance running on the competition VM**:

**Source: "VDO Talent Audio"**
- Type: `browser_source`
- URL: `https://vdo.ninja/?scene&room={{talentComms.vdoNinja.roomId}}`
- Purpose: Captures all talent audio into OBS
- Location: Runs in OBS on the competition VM (not the coordinator)

**Note:** The coordinator manages OBS on the VM via the OBS WebSocket protocol. When talent comms are configured, the coordinator instructs the VM's OBS to create/update this browser source.

### 4. Connection Status

Show whether talent is connected:

**Test Cases:**
- [ ] Talent 1 connected → indicator green
- [ ] Talent 1 disconnected → indicator gray
- [ ] Audio active → shows audio indicator

### 5. Discord Fallback

When VDO.Ninja has issues, fall back to Discord on the **competition VM**:

**Fallback Steps:**
1. Connect to **competition VM** via NoMachine (SSH tunnel)
2. Open Discord → Join voice channel
3. OBS → Open Program Projector
4. Discord → Go Live → Select Projector Window
5. Talent joins Discord call, watches stream

**Pre-configured on Competition VM AMI (gymnastics-vm-v2.2):**
- Discord installed and logged in
- Audio routing configured (Discord → OBS)
- NoMachine on localhost:4000
- OBS Studio running headless on display :99

**SSH Tunnel Command:**
```bash
# Get VM address from Firebase: competitions/{compId}/config/vmAddress
# The vmAddress is in format IP:3003, use just the IP portion
ssh -L 4000:localhost:4000 ubuntu@{vmIP}
```

**Note:** The `vmAddress` in Firebase points to the competition VM where OBS runs. This is NOT the coordinator (api.commentarygraphic.com) - it's the specific VM assigned to this competition.

---

## Firebase Schema

**Path:** `competitions/{compId}/config/talentComms`

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

---

## Communication Interface

### Socket.io Events (Frontend ↔ Coordinator)

All talent comms operations go through the coordinator via Socket.io. **The frontend never talks directly to OBS or competition VMs.**

**Frontend → Coordinator:**

| Event | Payload | Purpose |
|-------|---------|---------|
| `talentComms:setup` | `{}` | Generate VDO.Ninja room |
| `talentComms:regenerate` | `{}` | New room ID |
| `talentComms:setMethod` | `{ method: 'vdo-ninja' \| 'discord' }` | Switch method |
| `talentComms:getStatus` | `{}` | Request connection status |

**Coordinator → Frontend:**

| Event | Payload | Purpose |
|-------|---------|---------|
| `talentComms:config` | `{ roomId, urls, method, ... }` | Current config |
| `talentComms:status` | `{ talent1: { connected, audioActive }, ... }` | Connection status |
| `talentComms:error` | `{ message }` | Error notification |

### Data Flow

```
Frontend                    Coordinator                   Competition VM
   │                            │                              │
   │  talentComms:setup         │                              │
   │ ──────────────────────────>│                              │
   │                            │  Generate room ID            │
   │                            │  Store in Firebase           │
   │                            │                              │
   │                            │  CreateInput (browser_source)│
   │                            │ ────────────────────────────>│
   │                            │                              │  OBS creates
   │                            │              success         │  VDO source
   │                            │<─────────────────────────────│
   │                            │                              │
   │  talentComms:config        │                              │
   │<───────────────────────────│                              │
   │  (URLs for talent)         │                              │
```

### Firebase as Source of Truth

Talent comms config is stored in Firebase (not just in memory):
- Path: `competitions/{compId}/config/talentComms`
- The coordinator reads/writes this path
- Frontend reads from context (which syncs from Firebase)

---

## UI Design

### TalentCommsPanel.jsx

```
┌─ TALENT COMMUNICATION ───────────────────────────────┐
│                                                       │
│  Method: ● VDO.Ninja (Recommended)                   │
│          ○ Discord (Fallback)                        │
│                                                       │
│  ─── Talent URLs ───────────────────────────────────  │
│                                                       │
│  Talent 1:                                            │
│  https://vdo.ninja/?room=gym-comp-ab... [📋 Copy]    │
│  Status: ● Connected, Audio Active                   │
│                                                       │
│  Talent 2:                                            │
│  https://vdo.ninja/?room=gym-comp-ab... [📋 Copy]    │
│  Status: ○ Not Connected                             │
│                                                       │
│  [🔄 Regenerate URLs]                                │
│                                                       │
│  ─── OBS Status ────────────────────────────────────  │
│                                                       │
│  VDO Audio Source: ● Configured, Receiving Audio     │
│                                                       │
│  ─── Discord Fallback ──────────────────────────────  │
│                                                       │
│  If VDO.Ninja has issues:                            │
│  1. SSH tunnel: ssh -L 4000:localhost:4000 ...       │
│  2. Connect via NoMachine                            │
│  3. Open Discord and share screen                    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] VDO.Ninja room generated on setup
- [ ] Talent URLs stored in Firebase
- [ ] Copy URL to clipboard works
- [ ] Regenerate URLs creates new room
- [ ] Method switch (VDO.Ninja ↔ Discord) works
- [ ] Discord fallback instructions shown
- [ ] Connection status displays (if detectable)

---

## Test Plan

### Manual Tests
1. Open OBS Manager → Talent Comms tab
2. Click "Setup" → verify URLs generated
3. Copy Talent 1 URL → open in browser
4. Verify talent can see program output
5. Verify talent audio captured in OBS

### Integration Test
```javascript
test('can setup VDO.Ninja room', async () => {
  // Call setup endpoint
  // Verify room ID generated
  // Verify URLs in Firebase
});

test('can regenerate URLs', async () => {
  // Setup initial room
  // Regenerate
  // Verify new room ID
  // Verify old URLs no longer work
});
```

---

## Definition of Done

1. VDO.Ninja setup works
2. URLs generated and stored
3. Copy to clipboard works
4. Regenerate works
5. Discord fallback documented in UI
6. Tests pass
7. Code reviewed and merged

---

## Architecture Reference

For complete architecture details, see [README-OBS-Architecture.md](README-OBS-Architecture.md).

### Key Points for This Feature

1. **Frontend communicates via coordinator** - All `talentComms:*` Socket.io events go to `api.commentarygraphic.com`, which routes to the correct competition VM.

2. **OBS runs on competition VMs** - The VDO.Ninja browser source is created in OBS on the competition VM (e.g., `50.19.137.152`), not on the coordinator.

3. **Firebase stores configuration** - Talent comms config lives at `competitions/{compId}/config/talentComms`. The coordinator manages this data.

4. **VM address lookup** - When the frontend emits `talentComms:setup`, the coordinator:
   - Looks up `competitions/{compId}/config/vmAddress` to find the VM
   - Connects to that VM's OBS via `obsConnectionManager`
   - Creates the VDO.Ninja browser source in OBS
   - Stores the generated URLs in Firebase

### What NOT to Do

- ❌ Frontend connecting directly to `http://VM-IP:3003` for talent comms
- ❌ Frontend connecting to OBS WebSocket at `ws://VM-IP:4455`
- ❌ Frontend writing directly to Firebase OBS state
- ❌ Assuming OBS runs on the coordinator

### Correct Data Flow

```
User clicks "Setup"
       │
       ▼
Frontend emits talentComms:setup via Socket.io
       │
       ▼ (WSS to api.commentarygraphic.com)
Coordinator receives event
       │
       ├─► Generates VDO.Ninja room ID
       │
       ├─► Stores config in Firebase
       │
       ├─► Gets VM address for competition
       │
       └─► Sends CreateInput to VM's OBS (ws://VM-IP:4455)
              │
              ▼
       VM OBS creates browser source
              │
              ▼
       Coordinator emits talentComms:config back to frontend
```
