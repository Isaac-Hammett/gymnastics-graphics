# PRD-OBS-11: Advanced Features - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** NOT STARTED

---

## Priority Order

### P0 - Studio Mode (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add `obs:enableStudioMode` socket handler | NOT STARTED | server/index.js |
| 2 | Add `obs:disableStudioMode` socket handler | NOT STARTED | server/index.js |
| 3 | Add `obs:setPreviewScene` socket handler | NOT STARTED | server/index.js |
| 4 | Add `obs:transitionToProgram` socket handler | NOT STARTED | server/index.js |
| 5 | Create StudioModePanel.jsx component | NOT STARTED | Dual preview/program layout |
| 6 | Add preview screenshot hook | NOT STARTED | Reuse useAutoRefreshScreenshot |
| 7 | Integrate into OBSManager.jsx | NOT STARTED | Toggle button, conditional render |
| 8 | Deploy and verify | NOT STARTED | Playwright MCP |

### P1 - Scene Thumbnails (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Add thumbnail request to scene list | NOT STARTED | On refresh |
| 10 | Create SceneThumbnail component | NOT STARTED | 80x45 with fallback |
| 11 | Update SceneList.jsx layout | NOT STARTED | Thumbnail in card |
| 12 | Add hover preview (optional) | NOT STARTED | 320x180 tooltip |
| 13 | Deploy and verify | NOT STARTED | Playwright MCP |

### P2 - Real-time VU Meters (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14 | Subscribe to InputVolumeMeters OBS event | NOT STARTED | On OBS connect |
| 15 | Add socket emission for level data | NOT STARTED | Throttled |
| 16 | Create VUMeter component | NOT STARTED | Canvas or CSS bars |
| 17 | Integrate into AudioMixer.jsx | NOT STARTED | Per audio source |
| 18 | Deploy and verify | NOT STARTED | Playwright MCP |

### P2 - Stinger Transitions (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 19 | Add `obs:setStingerSettings` socket handler | NOT STARTED | server/index.js |
| 20 | Create StingerConfig component | NOT STARTED | File path, transition point |
| 21 | Integrate into TransitionPicker.jsx | NOT STARTED | Show when stinger selected |
| 22 | Deploy and verify | NOT STARTED | With test stinger file |

### P3 - Talent Connection Status (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23 | Research VDO.Ninja status API | NOT STARTED | May need iframe approach |
| 24 | Add status polling to TalentCommsPanel | NOT STARTED | 5-10s interval |
| 25 | Create StatusIndicator component | NOT STARTED | Connected/Disconnected |
| 26 | Deploy and verify | NOT STARTED | With live VDO.Ninja room |

### P3 - Stream Key Encryption (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 27 | Create streamKeyEncryption.js utility | NOT STARTED | AES-256-GCM |
| 28 | Add STREAM_KEY_SECRET env var | NOT STARTED | On coordinator |
| 29 | Update stream settings handlers | NOT STARTED | Encrypt on save, decrypt on use |
| 30 | Migrate existing keys | NOT STARTED | One-time script |

---

## Source Files

### To Create
- `show-controller/src/components/obs/StudioModePanel.jsx`
- `show-controller/src/components/obs/SceneThumbnail.jsx`
- `show-controller/src/components/obs/VUMeter.jsx`
- `show-controller/src/components/obs/StingerConfig.jsx`
- `server/lib/streamKeyEncryption.js`

### To Modify
- `server/index.js` - Socket handlers
- `show-controller/src/pages/OBSManager.jsx` - Studio mode integration
- `show-controller/src/components/obs/SceneList.jsx` - Thumbnails
- `show-controller/src/components/obs/AudioMixer.jsx` - VU meters
- `show-controller/src/components/obs/TransitionPicker.jsx` - Stinger config
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - Status indicators

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-20
- Created PRD-OBS-11 consolidating all deferred features from OBS-01 through OBS-10
- Created implementation plan

---

## Commits

| Commit | Description |
|--------|-------------|
| - | - |
