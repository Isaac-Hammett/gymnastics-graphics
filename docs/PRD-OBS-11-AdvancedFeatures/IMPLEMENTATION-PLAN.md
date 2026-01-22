# PRD-OBS-11: Advanced Features - Implementation Plan

**Last Updated:** 2026-01-22
**Status:** IN PROGRESS (P0 + P1 Scene Thumbnails Complete)

---

## Priority Order

### P0 - Studio Mode (COMPLETE)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add `obs:enableStudioMode` socket handler | COMPLETE | server/index.js:4190 |
| 2 | Add `obs:disableStudioMode` socket handler | COMPLETE | server/index.js:4222 |
| 3 | Add `obs:setPreviewScene` socket handler | COMPLETE | server/index.js:4254 |
| 4 | Add `obs:transitionToProgram` socket handler | COMPLETE | server/index.js:4289 |
| 5 | Update broadcastOBSState for studio mode | COMPLETE | Includes studioModeEnabled, previewScene |
| 6 | Create StudioModePanel.jsx component | COMPLETE | Dual preview/program layout, resizable |
| 7 | Add obs:studioModeChanged event handler | COMPLETE | OBSContext.jsx |
| 8 | Integrate into OBSManager.jsx | COMPLETE | Toggle button, conditional render |
| 9 | Deploy and verify | COMPLETE | Playwright MCP verified 2026-01-22 |

### P1 - Scene Thumbnails (COMPLETE)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | Add thumbnail request to scene list | COMPLETE | obs:requestSceneThumbnail socket event |
| 11 | Create SceneThumbnail component | COMPLETE | 80x45 with placeholder fallback |
| 12 | Update SceneList.jsx layout | COMPLETE | Thumbnail in scene card |
| 13 | Add hover preview (optional) | COMPLETE | 320x180 tooltip on hover |
| 14 | Deploy and verify | COMPLETE | Playwright MCP verified 2026-01-22 |

### P1 - Template Auto-Loading (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 15 | Add isDefaultFor field to template schema | NOT STARTED | Firebase |
| 16 | Add Set as Default toggle to TemplateCard | NOT STARTED | TemplateManager.jsx |
| 17 | Add auto-apply logic on OBS connect | NOT STARTED | OBSContext.jsx |
| 18 | Add user preference to disable auto-loading | NOT STARTED | Firebase + settings UI |
| 19 | Deploy and verify | NOT STARTED | Playwright MCP |

### P2 - Real-time VU Meters (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20 | Subscribe to InputVolumeMeters OBS event | NOT STARTED | On OBS connect |
| 21 | Add socket emission for level data | NOT STARTED | Throttled |
| 22 | Create VUMeter component | NOT STARTED | Canvas or CSS bars |
| 23 | Integrate into AudioMixer.jsx | NOT STARTED | Per audio source |
| 24 | Deploy and verify | NOT STARTED | Playwright MCP |

### P2 - Stinger Transitions (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25 | Add `obs:setStingerSettings` socket handler | NOT STARTED | server/index.js |
| 26 | Create StingerConfig component | NOT STARTED | File path, transition point |
| 27 | Integrate into TransitionPicker.jsx | NOT STARTED | Show when stinger selected |
| 28 | Deploy and verify | NOT STARTED | With test stinger file |

### P3 - Talent Connection Status (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 29 | Research VDO.Ninja status API | NOT STARTED | May need iframe approach |
| 30 | Add status polling to TalentCommsPanel | NOT STARTED | 5-10s interval |
| 31 | Create StatusIndicator component | NOT STARTED | Connected/Disconnected |
| 32 | Deploy and verify | NOT STARTED | With live VDO.Ninja room |

### P3 - Stream Key Encryption (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 33 | Create streamKeyEncryption.js utility | NOT STARTED | AES-256-GCM |
| 34 | Add STREAM_KEY_SECRET env var | NOT STARTED | On coordinator |
| 35 | Update stream settings handlers | NOT STARTED | Encrypt on save, decrypt on use |
| 36 | Migrate existing keys | NOT STARTED | One-time script |

---

## Source Files

### Created
- `show-controller/src/components/obs/StudioModePanel.jsx` - Studio mode dual preview/program panel
- `show-controller/src/components/obs/SceneThumbnail.jsx` - Scene thumbnail with hover preview

### To Create
- `show-controller/src/components/obs/VUMeter.jsx`
- `show-controller/src/components/obs/StingerConfig.jsx`
- `server/lib/streamKeyEncryption.js`

### Modified
- `server/index.js` - Added studio mode socket handlers, obs:requestSceneThumbnail handler
- `show-controller/src/context/OBSContext.jsx` - Added studioModeChanged handler
- `show-controller/src/pages/OBSManager.jsx` - Added studio mode toggle and panel integration
- `show-controller/src/components/obs/SceneList.jsx` - Added thumbnail display in scene cards

### To Modify
- `show-controller/src/components/obs/AudioMixer.jsx` - VU meters
- `show-controller/src/components/obs/TransitionPicker.jsx` - Stinger config
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - Status indicators
- `show-controller/src/components/obs/TemplateManager.jsx` - Default template toggle

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-22 (Scene Thumbnails)
- **P1 Scene Thumbnails COMPLETE**
  - Created SceneThumbnail.jsx component with 80x45 thumbnail display
  - Added obs:requestSceneThumbnail socket handler on server (server/index.js:4198)
  - Added hover preview functionality (320x180 on mouse hover)
  - Updated SceneList.jsx to include thumbnails in scene cards
  - Placeholder icon shown when thumbnail fails to load
  - Deployed to production and verified with Playwright
  - All acceptance criteria met:
    - Scene cards show thumbnail previews
    - Thumbnails load on scene list refresh
    - Failed thumbnails show placeholder
    - Hover preview shows larger image

### 2026-01-22 (Studio Mode)
- **P0 Studio Mode COMPLETE**
  - Added 4 socket handlers: enableStudioMode, disableStudioMode, setPreviewScene, transitionToProgram
  - Updated broadcastOBSState to fetch and include studioModeEnabled and previewScene
  - Created StudioModePanel.jsx with dual preview/program screenshots
  - Added resizable screenshot windows (Small/Medium/Large/XLarge) with localStorage persistence
  - Added studio mode toggle button to OBSManager.jsx
  - Deployed to production and verified with Playwright
  - All acceptance criteria met:
    - Enable/disable studio mode works
    - Preview and program screenshots display correctly
    - Preview scene can be changed via dropdown
    - Multi-client sync works (studioModeChanged events broadcast)
    - Size preference persists across page reloads

### 2026-01-20
- Created PRD-OBS-11 consolidating all deferred features from OBS-01 through OBS-10
- Created implementation plan

---

## Commits

| Commit | Description |
|--------|-------------|
| 5dbf404 | PRD-OBS-11: Implement Scene Thumbnails (P1) |
| ecac5e0 | PRD-OBS-11: Implement Studio Mode (P0) |
