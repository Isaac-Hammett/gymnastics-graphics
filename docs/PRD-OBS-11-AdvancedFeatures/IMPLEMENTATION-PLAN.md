# PRD-OBS-11: Advanced Features - Implementation Plan

**Last Updated:** 2026-01-21
**Status:** IN PROGRESS (P0 Scene List buttons pending, P1 Complete)

---

## Priority Order

### P0 - Studio Mode (IN PROGRESS - Scene List buttons missing)

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
| 9 | Deploy and verify StudioModePanel | COMPLETE | Playwright MCP verified 2026-01-22 |
| 10 | Add Preview/Live buttons to SceneList | NOT STARTED | Show 2 buttons in Studio Mode, 1 button otherwise |
| 11 | Add LIVE/PREVIEW badges to scene cards | NOT STARTED | Green for program, yellow for preview |
| 12 | Deploy and verify Scene List integration | NOT STARTED | Playwright MCP |

### P1 - Scene Thumbnails (COMPLETE)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 13 | Add thumbnail request to scene list | COMPLETE | obs:requestSceneThumbnail socket event |
| 14 | Create SceneThumbnail component | COMPLETE | 80x45 with placeholder fallback |
| 15 | Update SceneList.jsx layout | COMPLETE | Thumbnail in scene card |
| 16 | Add hover preview (optional) | COMPLETE | 320x180 tooltip on hover |
| 17 | Deploy and verify | COMPLETE | Playwright MCP verified 2026-01-22 |

### P1 - Template Auto-Loading (COMPLETE)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 18 | Add isDefaultFor field to template schema | COMPLETE | Firebase updates via socket handlers |
| 19 | Add Set as Default toggle to TemplateCard | COMPLETE | TemplateManager.jsx with SetDefaultModal |
| 20 | Add auto-apply logic on OBS connect | COMPLETE | OBSContext.jsx + TemplateManager.jsx |
| 21 | Add user preference to disable auto-loading | COMPLETE | localStorage + checkbox in header |
| 22 | Deploy and verify | COMPLETE | Playwright MCP verified 2026-01-21 |

### P2 - Real-time VU Meters (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23 | Subscribe to InputVolumeMeters OBS event | NOT STARTED | On OBS connect |
| 24 | Add socket emission for level data | NOT STARTED | Throttled |
| 25 | Create VUMeter component | NOT STARTED | Canvas or CSS bars |
| 26 | Integrate into AudioMixer.jsx | NOT STARTED | Per audio source |
| 27 | Deploy and verify | NOT STARTED | Playwright MCP |

### P2 - Stinger Transitions (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 28 | Add `obs:setStingerSettings` socket handler | NOT STARTED | server/index.js |
| 29 | Create StingerConfig component | NOT STARTED | File path, transition point |
| 30 | Integrate into TransitionPicker.jsx | NOT STARTED | Show when stinger selected |
| 31 | Deploy and verify | NOT STARTED | With test stinger file |

### P3 - Talent Connection Status (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 32 | Research VDO.Ninja status API | NOT STARTED | May need iframe approach |
| 33 | Add status polling to TalentCommsPanel | NOT STARTED | 5-10s interval |
| 34 | Create StatusIndicator component | NOT STARTED | Connected/Disconnected |
| 35 | Deploy and verify | NOT STARTED | With live VDO.Ninja room |

### P3 - Stream Key Encryption (NOT STARTED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 36 | Create streamKeyEncryption.js utility | NOT STARTED | AES-256-GCM |
| 37 | Add STREAM_KEY_SECRET env var | NOT STARTED | On coordinator |
| 38 | Update stream settings handlers | NOT STARTED | Encrypt on save, decrypt on use |
| 39 | Migrate existing keys | NOT STARTED | One-time script |

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
- `server/index.js` - Added studio mode socket handlers, obs:requestSceneThumbnail handler, template default handlers
- `show-controller/src/context/OBSContext.jsx` - Added studioModeChanged handler, auto-load state and methods
- `show-controller/src/pages/OBSManager.jsx` - Added studio mode toggle and panel integration
- `show-controller/src/components/obs/SceneList.jsx` - Added thumbnail display in scene cards
- `show-controller/src/components/obs/TemplateManager.jsx` - Added Set as Default toggle, auto-apply logic, SetDefaultModal

### To Modify
- `show-controller/src/components/obs/AudioMixer.jsx` - VU meters
- `show-controller/src/components/obs/TransitionPicker.jsx` - Stinger config
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - Status indicators

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-21 (Template Auto-Loading)
- **P1 Template Auto-Loading COMPLETE**
  - Added obs:setTemplateDefault and obs:clearTemplateDefault socket handlers (server/index.js:4380-4480)
  - Added obs:getDefaultTemplate socket handler for fetching default template
  - Created SetDefaultModal component in TemplateManager.jsx for selecting meet types
  - Added "Set as Default" button to TemplateCard with DEFAULT badge display
  - Added star indicator for each meet type that uses template as default
  - Added auto-apply logic on OBS connect (skips if OBS has existing scenes)
  - Added auto-load checkbox toggle in Templates header (localStorage persisted)
  - Updated OBSContext.jsx with autoLoadEnabled state and getDefaultTemplate method
  - Deployed to production and verified with Playwright
  - All acceptance criteria met:
    - Can mark a template as "default" for specific meet types
    - Only one template can be default per meet type (clears others)
    - DEFAULT badge and star indicators show correctly
    - Auto-apply skipped correctly when OBS has existing scenes
    - Auto-load checkbox toggles preference
    - Multi-client sync works (templateDefaultChanged events broadcast)

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
| TBD | PRD-OBS-11: Implement Template Auto-Loading (P1) |
| 5dbf404 | PRD-OBS-11: Implement Scene Thumbnails (P1) |
| ecac5e0 | PRD-OBS-11: Implement Studio Mode (P0) |
