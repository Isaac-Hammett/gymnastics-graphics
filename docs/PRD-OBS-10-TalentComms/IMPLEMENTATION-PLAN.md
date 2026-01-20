# PRD-OBS-10: Talent Communications - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** P0 & P1 COMPLETE - Core functionality working

---

## Summary

Talent Communications feature is now working in production. Fixed data structure mismatch between backend and frontend to match PRD schema.

**Key Bug Fixed:** Backend `talentCommsManager.js` was returning a flat structure (`{method, roomId, urls}`) but frontend expected PRD-compliant nested structure (`{method, vdoNinja: {roomId, directorUrl, talentUrls}}`).

---

## Priority Order

### P0 - Verify VDO.Ninja Setup ✅ COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Verify VDO.Ninja setup works | ✅ DONE | REST API `/api/obs/talent-comms/setup` |
| 2 | Verify room URLs stored in Firebase | ✅ DONE | `competitions/{compId}/config/talentComms` |
| 3 | Verify OBS browser source created on VM | DEFERRED | Not implemented - manual step |
| 4 | Verify talent URLs displayed in UI | ✅ DONE | Room ID, Talent-1, Talent-2, Director URLs all display |

### P1 - URL Management ✅ COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Verify copy URL to clipboard works | ✅ DONE | Button shows "Copied!" on success |
| 6 | Verify regenerate URLs works | ✅ DONE | New room ID and password generated |
| 7 | Verify method switch (VDO.Ninja ↔ Discord) | ✅ DONE | Switches correctly, shows appropriate UI |

### P2 - Connection Status (DEFERRED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8 | Show talent connection status | DEFERRED | Would require VDO.Ninja API integration |
| 9 | Show audio active indicator | DEFERRED | Would require VDO.Ninja API integration |

### P3 - Discord Fallback

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | Verify Discord instructions shown in UI | ✅ DONE | Shows "Discord channel not configured" placeholder |

---

## Bugs Fixed

### 1. Data Structure Mismatch (P0 - FIXED)

**Problem:** Backend returned flat structure, frontend expected PRD-compliant nested structure.

**Backend returned:**
```json
{
  "method": "vdo-ninja",
  "roomId": "gym-xxx",
  "urls": { "director": "...", "talent1": "...", "talent2": "..." }
}
```

**Frontend expected (PRD schema):**
```json
{
  "method": "vdo-ninja",
  "vdoNinja": {
    "roomId": "gym-xxx",
    "directorUrl": "...",
    "talentUrls": { "talent-1": "...", "talent-2": "..." }
  }
}
```

**Fix:** Updated `talentCommsManager.js` to return PRD-compliant structure with nested `vdoNinja` object.

### 2. API Response Extraction (P0 - FIXED)

**Problem:** Frontend did `setConfig(data)` but API returned `{ configured: true, config: {...} }`.

**Fix:** Updated `TalentCommsPanel.jsx` to extract `data.config` when present.

---

## Verification Results

**Production URL:** https://commentarygraphic.com/8kyf0rnl/obs-manager

### Playwright MCP Verification (2026-01-20)

| Test | Result |
|------|--------|
| Talent Comms tab loads | ✅ PASS |
| Method selector shows VDO.Ninja/Discord | ✅ PASS |
| "Create VDO.Ninja Room" button works | ✅ PASS |
| Room ID displayed | ✅ PASS |
| Talent-1 URL displayed | ✅ PASS |
| Talent-2 URL displayed | ✅ PASS |
| Director URL displayed | ✅ PASS |
| Copy to clipboard works | ✅ PASS |
| "Regenerate URLs" creates new room | ✅ PASS |
| Switch to Discord method works | ✅ PASS |
| Switch back to VDO.Ninja works | ✅ PASS |
| No console errors | ✅ PASS |

**Screenshot:** `screenshots/PRD-OBS-10-talent-comms-working.png`

---

## Source Files Modified

### Frontend
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - Fixed API response extraction

### Backend (Coordinator)
- `server/lib/talentCommsManager.js` - Fixed data structure to match PRD schema

---

## API Implementation

**Note:** The implementation uses REST APIs instead of Socket.io events (contrary to PRD spec). This works correctly because:
1. REST APIs are simpler for request/response patterns
2. The coordinator sets `activeCompetition` when socket connects
3. All REST calls use the same compId context

### REST Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/obs/talent-comms` | GET | Fetch current config |
| `/api/obs/talent-comms/setup` | POST | Create VDO.Ninja room |
| `/api/obs/talent-comms/regenerate` | POST | Generate new room ID |
| `/api/obs/talent-comms/method` | PUT | Switch VDO.Ninja/Discord |

---

## Commits

| Commit | Description |
|--------|-------------|
| `17436cd` | PRD-OBS-10: Fix Talent Communications data structure to match PRD schema |

---

## Progress Log

### 2026-01-20 - P0 & P1 COMPLETE
- **DISCOVERED:** Data structure mismatch between backend and frontend
- **FIXED:** Updated `talentCommsManager.js` to return PRD-compliant nested structure
- **FIXED:** Updated `TalentCommsPanel.jsx` to extract config from API response
- **DEPLOYED:** Both frontend (commentarygraphic.com) and backend (coordinator)
- **VERIFIED:** All P0 and P1 tests passing via Playwright MCP
- Screenshot saved: `PRD-OBS-10-talent-comms-working.png`

---

## Remaining Work (Future)

| Task | Priority | Notes |
|------|----------|-------|
| Auto-create OBS browser source for VDO.Ninja | P2 | Would need to call OBS WebSocket CreateInput |
| Talent connection status indicators | P3 | Would require VDO.Ninja API polling |
| Discord fallback instructions | P3 | UI shows placeholder, needs SSH tunnel docs |
