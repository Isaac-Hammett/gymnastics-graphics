# PRD-OBS-07: Asset Management

**Version:** 1.1
**Date:** 2026-01-20
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** PRD-OBS-08 (Templates)

---

## Overview

Media asset management - upload, list, delete music, stingers, backgrounds, logos on the competition VM. **This feature is working** (TEST-43/44/45 passed).

**Important Architecture Note:** Assets are stored on competition VMs, NOT the coordinator. All asset operations flow through the coordinator which routes them to the correct VM based on `compId`. See [README-OBS-Architecture.md](README-OBS-Architecture.md) for the full connection architecture.

---

## Current State

### What Exists
- `server/lib/obsAssetManager.js` (504 lines) - Asset operations
- `show-controller/src/components/obs/AssetManager.jsx` - Asset UI
- Routes: GET/POST/DELETE `/api/obs/assets/*`

### Test Results
- Asset upload (music file): ✅ TEST-43 PASSED
- Asset delete: ✅ TEST-44 PASSED
- Asset categories filter: ✅ TEST-45 PASSED

---

## Requirements

### 1. Asset Types

| Type | Extensions | Location on VM |
|------|------------|----------------|
| `music` | .mp3, .wav, .ogg | `/var/www/assets/music/` |
| `stingers` | .webm, .mp4, .mov | `/var/www/assets/stingers/` |
| `backgrounds` | .mp4, .webm, .png, .jpg | `/var/www/assets/backgrounds/` |
| `logos` | .png, .svg, .jpg | `/var/www/assets/logos/` |

### 2. Asset Operations

**Test Cases:**
- [ ] Upload music file → stored on VM
- [ ] Upload stinger video → stored on VM
- [ ] Upload background → stored on VM
- [ ] Upload logo → stored on VM
- [ ] List assets by type → correct filtering
- [ ] Delete asset → removed from VM
- [ ] Asset manifest updates in Firebase

### 3. Asset Manifest

Stored in Firebase: `competitions/{compId}/obs/assets/manifest`

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
  "stingers": [],
  "backgrounds": [],
  "logos": []
}
```

### 4. File Size Limits

| Type | Max Size |
|------|----------|
| Music | 50 MB |
| Stingers | 100 MB |
| Backgrounds | 200 MB |
| Logos | 10 MB |

### 5. Connection Architecture

**The frontend NEVER talks directly to the competition VM.** All requests flow through the coordinator:

```
Frontend                    Coordinator                   Competition VM
   │                            │                              │
   │  POST /api/obs/assets      │                              │
   │  (with compId)             │                              │
   │ ──────────────────────────>│                              │
   │                            │  Look up vmAddress for       │
   │                            │  compId in Firebase          │
   │                            │                              │
   │                            │  SSH/SCP to VM               │
   │                            │ ────────────────────────────>│
   │                            │                              │  Store file in
   │                            │                              │  /var/www/assets/
   │                            │  Success                     │
   │                            │ <────────────────────────────│
   │                            │                              │
   │                            │  Update Firebase manifest    │
   │                            │  competitions/{compId}/obs/  │
   │                            │  assets/manifest             │
   │  200 OK                    │                              │
   │ <──────────────────────────│                              │
```

**Why this architecture:**
- Competition VMs don't have public HTTPS (no SSL certs)
- Browser Mixed Content security would block direct HTTP uploads from HTTPS frontend
- Coordinator has SSL (api.commentarygraphic.com) and can proxy to VMs

### 6. Upload Flow

1. Frontend sends file to coordinator via REST API (includes `compId`)
2. Coordinator looks up `vmAddress` for the competition in Firebase
3. Coordinator saves file to temp directory
4. Coordinator uses SSH/SCP to transfer file to competition VM
5. Coordinator updates asset manifest in Firebase
6. Coordinator returns success to frontend

---

## Files Involved

| File | Purpose |
|------|---------|
| `server/lib/obsAssetManager.js` | Asset logic |
| `server/routes/obs.js` | Asset endpoints |
| `show-controller/src/components/obs/AssetManager.jsx` | Asset UI |

---

## API Endpoints

**All endpoints are on the coordinator** (`api.commentarygraphic.com`), NOT direct to VMs.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/assets?compId={compId}` | List all assets for competition |
| GET | `/api/obs/assets/:type?compId={compId}` | List by type |
| POST | `/api/obs/assets/upload` | Upload asset (compId in body) |
| DELETE | `/api/obs/assets/:type/:filename?compId={compId}` | Delete asset |
| GET | `/api/obs/assets/manifest?compId={compId}` | Get manifest |

**Note:** The `compId` parameter is required so the coordinator can route the request to the correct competition VM.

---

## UI Design

### AssetManager.jsx

```
┌─ ASSET MANAGER ──────────────────────────────────────┐
│                                                       │
│  Filter: [All ▼] [Music] [Stingers] [Backgrounds]    │
│                                                       │
│  ─── Music (3 files) ───────────────────────────────  │
│                                                       │
│  ├─ intro.mp3         45s    1.0 MB    [▶] [🗑️]     │
│  ├─ break.mp3         30s    0.8 MB    [▶] [🗑️]     │
│  └─ outro.mp3         60s    1.5 MB    [▶] [🗑️]     │
│                                                       │
│  ─── Stingers (1 file) ─────────────────────────────  │
│                                                       │
│  └─ main.webm         0.5s   0.5 MB    [▶] [🗑️]     │
│                                                       │
│  ─── Backgrounds (0 files) ─────────────────────────  │
│                                                       │
│  No backgrounds uploaded                              │
│                                                       │
│  ────────────────────────────────────────────────────  │
│                                                       │
│  [Drop files here or click to upload]                │
│                                                       │
│  Supported: .mp3, .wav, .webm, .mp4, .png, .jpg      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] Upload files via drag-and-drop
- [ ] Upload files via file picker
- [ ] Files stored on VM correctly
- [ ] List assets by type works
- [ ] Delete asset removes from VM
- [ ] Manifest updates in Firebase
- [ ] File size limits enforced
- [ ] Invalid file types rejected

---

## Test Plan

### Existing Tests (Already Passing)
- TEST-43: Asset upload works (music file) ✅
- TEST-44: Asset delete works ✅
- TEST-45: Asset categories filter correctly ✅

### Additional Manual Tests
1. Upload music file → verify on VM
2. Upload stinger → verify on VM
3. Filter by type → verify correct display
4. Delete asset → verify removed from VM
5. Check Firebase manifest → verify updated

---

## Definition of Done

1. All existing tests continue to pass
2. Drag-and-drop upload works
3. All asset types supported
4. Size limits enforced
5. Code reviewed and merged

---

## Common Mistakes to Avoid

### Mistake 1: "Upload directly to the VM"

**Wrong:** Frontend uploads file directly to `http://VM-IP:3003/upload`
**Right:** Frontend uploads to `https://api.commentarygraphic.com/api/obs/assets/upload` with `compId`

### Mistake 2: "Assets stored on coordinator"

**Wrong:** Assets stored in `/var/www/assets/` on the coordinator VM
**Right:** Assets stored on the **competition VM** at `/var/www/assets/`; coordinator just proxies

### Mistake 3: "Omit compId from requests"

**Wrong:** `GET /api/obs/assets` (no competition context)
**Right:** `GET /api/obs/assets?compId=8kyf0rnl` (coordinator knows which VM to query)

### Mistake 4: "Read assets from Firebase directly"

**Wrong:** Frontend reads asset list from Firebase and assumes files exist
**Right:** Frontend calls coordinator API, which verifies files exist on VM and returns manifest
