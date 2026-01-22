# PRD-OBS-11: Advanced Features - Implementation Plan

**Last Updated:** 2026-01-22
**Status:** IN PROGRESS (P0 Complete, P1 Complete, P2 VU Meters Complete)

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
| 9 | Deploy and verify StudioModePanel | COMPLETE | Playwright MCP verified 2026-01-22 |
| 10 | Add Preview/Live buttons to SceneList | COMPLETE | Show 2 buttons in Studio Mode, 1 button otherwise |
| 11 | Add LIVE/PREVIEW badges to scene cards | COMPLETE | Green for program, yellow for preview |
| 12 | Deploy and verify Scene List integration | COMPLETE | Playwright MCP verified 2026-01-21 |

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

### P2 - Real-time VU Meters (COMPLETE)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23 | Subscribe to InputVolumeMeters OBS event | COMPLETE | obsConnectionManager.js:90 (EventSubscription.InputVolumeMeters) |
| 24 | Add socket emission for level data | COMPLETE | obsConnectionManager.js:437-487 (throttled ~15fps) |
| 25 | Create VUMeter component | COMPLETE | AudioMixer.jsx:190-211 (VUMeter), :216-245 (StereoVUMeter) |
| 26 | Integrate into AudioMixer.jsx | COMPLETE | AudioMixer.jsx:457-465, subscribeAudioLevels on mount |
| 27 | Deploy and verify | COMPLETE | Playwright MCP verified 2026-01-22 |

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
- `show-controller/src/components/obs/StingerConfig.jsx`
- `server/lib/streamKeyEncryption.js`

### Modified
- `server/index.js` - Added studio mode socket handlers, obs:requestSceneThumbnail handler, template default handlers
- `show-controller/src/context/OBSContext.jsx` - Added studioModeChanged handler, auto-load state and methods
- `show-controller/src/pages/OBSManager.jsx` - Added studio mode toggle and panel integration
- `show-controller/src/components/obs/SceneList.jsx` - Added thumbnail display, Preview/Live buttons, LIVE/PREVIEW badges
- `show-controller/src/components/obs/TemplateManager.jsx` - Added Set as Default toggle, auto-apply logic, SetDefaultModal

### To Modify
- `show-controller/src/components/obs/TransitionPicker.jsx` - Stinger config
- `show-controller/src/components/obs/TalentCommsPanel.jsx` - Status indicators

### Already Modified (VU Meters)
- `show-controller/src/components/obs/AudioMixer.jsx` - VU meters (VUMeter, StereoVUMeter, useAudioAlerts)
- `show-controller/src/context/OBSContext.jsx` - audioLevels state, subscribeAudioLevels, unsubscribeAudioLevels
- `server/lib/obsConnectionManager.js` - InputVolumeMeters subscription, audio level forwarding
- `server/index.js` - obs:subscribeAudioLevels handler, audioLevels event forwarding

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-22 (Real-time VU Meters - Already Implemented)
- **P2 Real-time VU Meters COMPLETE**
  - Feature was already implemented in PRD-OBS-04 Phase 2 (Audio Mixer)
  - InputVolumeMeters event subscription in obsConnectionManager.js:90
  - Audio level forwarding with throttling (~15fps) in obsConnectionManager.js:437-487
  - VUMeter and StereoVUMeter components in AudioMixer.jsx:190-245
  - useAudioAlerts hook for silence/clipping detection in AudioMixer.jsx:75-180
  - AudioMixer subscribes on mount via useOBS().subscribeAudioLevels()
  - Verified on production with Playwright MCP - stereo L/R meters display correctly
  - All acceptance criteria met:
    - VU meters display for each audio source
    - Levels update in real-time (throttled to ~15fps)
    - Stereo L/R channels shown separately
    - Audio alerts for silence, clipping, signal lost, unstable

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

### 2026-01-21 (Scene List Studio Mode Integration)
- **P0 Studio Mode Scene List Integration COMPLETE**
  - Updated SceneList.jsx with Preview/Live buttons for Studio Mode
  - Single "Go Live" button in Direct Mode, two buttons (Preview + Live) in Studio Mode
  - LIVE badge (green) for current program scene
  - PREVIEW badge (yellow) for current preview scene (only in Studio Mode)
  - Buttons disabled when scene is already in that state
  - Deployed to production and verified with Playwright
  - All acceptance criteria met:
    - Scene List shows single "Go Live" button when Studio Mode disabled
    - Scene List shows "Preview" and "Live" buttons when Studio Mode enabled
    - Preview button sets scene as preview (yellow indicator)
    - Live button switches scene to program (green indicator)
    - Current program scene shows "LIVE" badge
    - Current preview scene shows "PREVIEW" badge (Studio Mode only)

### 2026-01-20
- Created PRD-OBS-11 consolidating all deferred features from OBS-01 through OBS-10
- Created implementation plan

---

## Commits

| Commit | Description |
|--------|-------------|
| c705da0 | PRD-OBS-11: Implement Template Auto-Loading (P1) |
| 5dbf404 | PRD-OBS-11: Implement Scene Thumbnails (P1) |
| ecac5e0 | PRD-OBS-11: Implement Studio Mode (P0) |
