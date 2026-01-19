# PRD-OBS-10: Talent Communications

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** None

---

## Overview

Talent communication system - VDO.Ninja integration for remote commentators to see program output and send audio back. Discord fallback for when VDO.Ninja has issues.

---

## Current State

### What Exists
- `server/lib/talentCommsManager.js` (~200 lines) - VDO.Ninja URL generation
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - UI panel
- Routes: GET/POST/PUT `/api/obs/talent-comms/*`

### Test Results
- Not tested yet (⏭️ SKIPPED)

---

## How VDO.Ninja Works

```
┌─────────────────────────────────────────────────────────────┐
│                     VDO.NINJA WORKFLOW                       │
│                                                              │
│  ┌─────────────┐       ┌─────────────┐       ┌───────────┐  │
│  │     OBS     │◄────► │  VDO.Ninja  │◄─────►│  Talent   │  │
│  │  (Browser   │ WebRTC│   (relay)   │ WebRTC│ (Browser) │  │
│  │   Sources)  │       │             │       │           │  │
│  └─────────────┘       └─────────────┘       └───────────┘  │
│                                                              │
│  Talent sees program output, talks back via microphone       │
│  OBS captures talent audio via browser source                │
└─────────────────────────────────────────────────────────────┘
```

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

### 3. OBS Browser Sources

Templates should include VDO.Ninja browser source:

**Source: "VDO Talent Audio"**
- Type: `browser_source`
- URL: `https://vdo.ninja/?scene&room={{talentComms.vdoNinja.roomId}}`
- Purpose: Captures all talent audio into OBS

### 4. Connection Status

Show whether talent is connected:

**Test Cases:**
- [ ] Talent 1 connected → indicator green
- [ ] Talent 1 disconnected → indicator gray
- [ ] Audio active → shows audio indicator

### 5. Discord Fallback

When VDO.Ninja has issues, fall back to Discord:

**Fallback Steps:**
1. Connect to VM via NoMachine (SSH tunnel)
2. Open Discord → Join voice channel
3. OBS → Open Program Projector
4. Discord → Go Live → Select Projector Window
5. Talent joins Discord call, watches stream

**Pre-configured on AMI:**
- Discord installed and logged in
- Audio routing configured (Discord → OBS)
- NoMachine on localhost:4000

**SSH Tunnel Command:**
```bash
ssh -L 4000:localhost:4000 ubuntu@{vmAddress}
```

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

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/talent-comms` | Get current config |
| POST | `/api/obs/talent-comms/setup` | Generate VDO.Ninja room |
| POST | `/api/obs/talent-comms/regenerate` | New room ID |
| PUT | `/api/obs/talent-comms/method` | Switch vdo-ninja/discord |
| GET | `/api/obs/talent-comms/status` | Connection status |

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
