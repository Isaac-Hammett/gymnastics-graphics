# PRD-OBS-07: Asset Management

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** PRD-OBS-08 (Templates)

---

## Overview

Media asset management - upload, list, delete music, stingers, backgrounds, logos on the VM. **This feature is working** (TEST-43/44/45 passed).

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

### 5. Upload via SSH

Assets are uploaded to VMs via SSH (using MCP tools):
1. File uploaded to server temp directory
2. SSH transfer to VM
3. Manifest updated in Firebase

---

## Files Involved

| File | Purpose |
|------|---------|
| `server/lib/obsAssetManager.js` | Asset logic |
| `server/routes/obs.js` | Asset endpoints |
| `show-controller/src/components/obs/AssetManager.jsx` | Asset UI |

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/assets` | List all assets |
| GET | `/api/obs/assets/:type` | List by type |
| POST | `/api/obs/assets/upload` | Upload asset |
| DELETE | `/api/obs/assets/:type/:filename` | Delete asset |
| GET | `/api/obs/assets/manifest` | Get manifest |

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
