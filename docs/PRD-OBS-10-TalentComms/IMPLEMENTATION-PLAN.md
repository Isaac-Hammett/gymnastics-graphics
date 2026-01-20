# PRD-OBS-10: Talent Communications - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** Untested

---

## Priority Order

### P0 - Verify VDO.Ninja Setup

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Verify `talentComms:setup` socket event works | NOT STARTED | Generate VDO.Ninja room |
| 2 | Verify room URLs stored in Firebase | NOT STARTED | `competitions/{compId}/config/talentComms` |
| 3 | Verify OBS browser source created on VM | NOT STARTED | Via coordinator to VM |
| 4 | Verify talent URLs displayed in UI | NOT STARTED | TalentCommsPanel.jsx |

### P1 - URL Management

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Verify copy URL to clipboard works | NOT STARTED | UI functionality |
| 6 | Verify regenerate URLs works | NOT STARTED | `talentComms:regenerate` event |
| 7 | Verify method switch (VDO.Ninja ↔ Discord) | NOT STARTED | `talentComms:setMethod` event |

### P2 - Connection Status

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8 | Show talent connection status | NOT STARTED | Connected/disconnected indicator |
| 9 | Show audio active indicator | NOT STARTED | When talent is speaking |

### P3 - Discord Fallback

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | Verify Discord instructions shown in UI | NOT STARTED | SSH tunnel command, NoMachine steps |

---

## Source Files to Review

### Frontend
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - Talent comms UI

### Backend (Coordinator)
- `server/lib/talentCommsManager.js` - VDO.Ninja URL generation
- `server/index.js` - Socket handlers for `talentComms:*` events

---

## Socket Events

### Client → Coordinator
- `talentComms:setup` - Generate VDO.Ninja room
- `talentComms:regenerate` - New room ID
- `talentComms:setMethod` - Switch VDO.Ninja/Discord
- `talentComms:getStatus` - Request connection status

### Coordinator → Client
- `talentComms:config` - Current config with URLs
- `talentComms:status` - Connection status
- `talentComms:error` - Error notification

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-20
- Created implementation plan
- Tests not yet run

---

## Related Files Changed

| File | Change Description | Commit |
|------|-------------------|--------|
| - | - | - |
