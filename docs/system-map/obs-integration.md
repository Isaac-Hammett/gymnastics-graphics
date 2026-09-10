# OBS integration

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Show production
**Purpose:** Gives a producer a browser-based OBS Studio remote for the competition's VM — scene/source/audio/transition/stream control, live program preview and studio mode, plus one-click application of a saved scene-collection template so a fresh VM comes up with the full show built.
**Status:** **Partial** — the socket path is complete and was verified against a real VM's OBS (`docs/PRD-OBS-11-AdvancedFeatures/screenshots/studio-mode-preview-program.png` shows OBS Manager connected to competition `8kyf0rnl` with 10 template scenes, LIVE/PREVIEW badges and a working TAKE), and `docs/PRD-OBS-11-AdvancedFeatures/IMPLEMENTATION-PLAN.md` marks all P0–P3 COMPLETE with Playwright verification dates. But three structural gaps keep it off "Built": (1) all 65 REST routes in `server/routes/obs.js` are bound to the single global `obs` instance created at `server/index.js:91` (`ws://localhost:4455`) and gated on `obsStateSync.isInitialized()`, which on the coordinator is never connected — `docs/README-OBS-Architecture.md:316-330` calls this out as "Mistake 5"; only 10 of those 65 routes are ever called from the SPA (templates, assets, talent-comms). (2) `server/lib/obsStateSync.js` (1359 lines) is explicitly local-dev-only; production state comes from a parallel reimplementation, `broadcastOBSState()` at `server/index.js:4451`. (3) The producer's manual scene override is broken in multi-competition mode (see Known gaps). `docs/PRD-OBS-00-Index.md` is stale — it lists 08.1 as BROKEN and 11 as NOT STARTED; both are since completed per their IMPLEMENTATION-PLAN files and commit history.
**Sport coupling:** **Sport-parameterized** — no apparatus/rotation/scoring logic anywhere in the OBS libs; the only coupling is the meet-type taxonomy `mens-dual|womens-dual|mens-tri|womens-tri|mens-quad|womens-quad` hard-coded in `show-controller/src/components/obs/TemplateManager.jsx:49` and used as template `meetTypes` keys for auto-loading.
**Key files:**
- `server/lib/obsConnectionManager.js` (560) — singleton `Map<compId → OBSWebSocket>`; connects `ws://{ip}:4455`, 15s heartbeat, 30s reconnect, throttled `InputVolumeMeters`
- `server/lib/obsStateSync.js` (1359) — state cache + scene categorisation + Firebase persistence; local-dev path only
- `server/routes/obs.js` (2353) — 65 REST routes; mounted by `setupOBSRoutes(app, obs, () => obsStateSync)` at `server/index.js:4374`, no prefix (paths are absolute `/api/obs/…`)
- `server/index.js` (8730) — 53 `obs:*` socket handlers + `broadcastOBSState()`; the real production control plane
- `server/lib/obsTemplateManager.js` (842) — template CRUD on `templates/obs/{id}`, `{{var}}` substitution, `_applyScene`/`_applyInput`/`_applySceneItem`
- `server/lib/obsSceneGenerator.js` (909, +200-line test) — programmatic scene generation from `showConfig.cameras`; used only by `/api/scenes/*` on the local obs
- `server/lib/obsSourceManager.js` (596) / `obsAudioManager.js` (486) / `obsAssetManager.js` (504) / `obsStreamManager.js` (381) / `obsSceneManager.js` (219) / `obsTransitionManager.js` (172) — per-area wrappers used only by the REST layer
- `show-controller/src/context/OBSContext.jsx` (836) — 60+ socket emitters + 25 listeners; the wire every tab actually uses
- `show-controller/src/pages/OBSManager.jsx` (615) — 8-tab shell at `/:compId/obs-manager`
- `show-controller/src/components/obs/SceneList.jsx` (928), `TemplateManager.jsx` (1209), `SourceEditor.jsx` (877), `SceneEditor.jsx` (679), `AudioMixer.jsx` (484), `StreamConfig.jsx` (491)
- `server/lib/timesheetEngine.js` (1841) — `_applyTransitionAndSwitchScene()` at :731, the Rundown→OBS bridge

**Firebase paths written:**
- `competitions/{compId}/obs/state` (obsStateSync only)
- `competitions/{compId}/obs/templateScenes`
- `competitions/{compId}/obs/presets/{presetId}`
- `competitions/{compId}/obs/assets/{type}`
- `competitions/{compId}/obs/streamConfig` (incl. `streamKeyEncrypted`)
- `templates/obs/{templateId}` (incl. `/isDefaultFor`)

**Firebase paths read:**
- `competitions/{compId}/config` (cameras, meet type)
- `competitions/{compId}/config/vmAddress` (via VM pool → `publicIp`)
- `competitions/{compId}/config/talentComms` (template context)
- `competitions/{compId}/obs/templateScenes`, `/presets`, `/assets/{type}`, `/streamConfig`, `/state`
- `templates/obs` and `templates/obs/{templateId}`

**Socket events:**
`emits:` obs:stateUpdated, obs:connected, obs:disconnected, obs:currentSceneChanged, obs:previewSceneChanged, obs:sceneListChanged, obs:studioModeChanged, obs:streamStateChanged, obs:recordStateChanged, obs:streamStarted, obs:streamStopped, obs:streamStatus, obs:streamSettings, obs:streamSettingsUpdated, obs:streamSettingsRestored, obs:storedStreamKeyDeleted, obs:recordingStarted, obs:recordingStopped, obs:recordingPaused, obs:recordingResumed, obs:recordingStatus, obs:volumeChanged, obs:muteChanged, obs:audioLevels, obs:presetsList, obs:presetApplied, obs:presetSaved, obs:presetDeleted, obs:transitionsList, obs:currentTransitionChanged, obs:screenshotCaptured, obs:screenshotData, obs:screenshotError, obs:sceneThumbnailData, obs:sceneThumbnailError, obs:deleteAllScenesResult, obs:templateDefaultSet, obs:templateDefaultCleared, obs:templateDefaultChanged, obs:error, obs:warning, sceneChanged
`listens:` obs:refreshState, switchScene, overrideScene, timesheetOverrideScene, obs:createScene, obs:deleteScene, obs:deleteAllScenes, obs:duplicateScene, obs:renameScene, obs:reorderScenes, obs:addSourceToScene, obs:createInput, obs:removeInput, obs:updateInputSettings, obs:getInputSettings, obs:setSceneItemTransform, obs:applyTransformPreset, obs:toggleItemVisibility, obs:toggleItemLock, obs:deleteSceneItem, obs:reorderSceneItems, obs:setVolume, obs:setMute, obs:setMonitorType, obs:subscribeAudioLevels, obs:applyPreset, obs:listPresets, obs:savePreset, obs:deletePreset, obs:getTransitions, obs:setCurrentTransition, obs:setTransitionDuration, obs:getTransitionSettings, obs:setTransitionSettings, obs:startStream, obs:stopStream, obs:getStreamStatus, obs:getStreamSettings, obs:setStreamSettings, obs:restoreStreamSettings, obs:deleteStoredStreamKey, obs:startRecording, obs:stopRecording, obs:pauseRecording, obs:resumeRecording, obs:getRecordingStatus, obs:takeScreenshot, obs:requestScreenshot, obs:requestSceneThumbnail, obs:enableStudioMode, obs:disableStudioMode, obs:setPreviewScene, obs:transitionToProgram, obs:setTemplateDefault, obs:clearTemplateDefault, obs:getDefaultTemplate

**HTTP routes:** (65 total in `server/routes/obs.js`; only the starred ones are reachable from the SPA)
- `GET|POST|PUT|DELETE /api/obs/scenes[/…]` (7) — scene + reorder CRUD
- `GET|POST|PUT|DELETE /api/obs/inputs[/…]` (5) — input CRUD, kinds list
- `GET|POST|PUT|DELETE /api/obs/scenes/:sceneName/items[/…]` (6) — scene items, transform, enabled, locked, reorder
- `GET|PUT|POST|DELETE /api/obs/audio[/…]` (9) — volume, mute, monitor, presets CRUD
- `GET|PUT|POST /api/obs/transitions[/…]` (7) — list, current, duration, settings, stinger
- `GET|PUT|POST /api/obs/stream[/…]` (5) — settings, start, stop, status
- `GET|POST|DELETE /api/obs/assets[/…]` (6) — ★list/★upload/★delete, download, pack install
- `GET|POST|PUT|DELETE /api/obs/templates[/…]` (6) — ★list, get, ★create, ★apply, update, ★delete
- `GET|POST|PUT|DELETE /api/obs/talent-comms[/…]` (6) — see Talent comms entry
- `GET|PUT|POST /api/obs/preview/*` and `/api/obs/studio-mode[/…]` (6) — screenshots, studio mode, preview, transition
- `POST /api/scenes/generate`, `GET /api/scenes/preview` ★, `DELETE /api/scenes/generated` — scene generator (in `server/index.js:2764+`, local obs only)

**External services:**
- obs-websocket (OBS Studio plugin, port 4455) — all scene/source/audio/stream control, via `obs-websocket-js`
- VDO.Ninja — browser-source URLs injected into templates as `{{talentComms.talent1Url}}` / `talent2Url`
- AWS EC2 (via VM pool) — supplies the `publicIp` the OBS connection targets

**Depends on:**
- VM pool — direct import (`getVMPoolManager()` at `server/index.js:4652`) + Firebase `vmPool/vms/{vmId}.publicIp` — to learn which VM's OBS to connect to
- Coordinator server — direct import — hosts the connection manager, socket handlers, `broadcastOBSState()`
- Competition model — Firebase `competitions/{compId}/config` — meet type for template auto-load, camera SRT URLs for template context
- Talent comms — direct import of `TalentCommsManager` in `server/routes/obs.js:1707` — supplies `obsViewUrls` for the Talent-1/Talent-2 browser sources
- Graphics rendering — template context builds `output.html?compId=…&graphic=all` and `overlays/*.html` URLs as browser sources
- Auth — `RequireAuth` wrapper on the `/:compId` route tree in `show-controller/src/App.jsx`

**Used by:**
- Rundown — direct import of `obsConnectionManager` into `TimesheetEngine` (`server/index.js:399`) — `_applyTransitionAndSwitchScene()` sets the transition (Fade/Stinger/Cut + duration) then `SetCurrentProgramScene` to `segment.obsScene`; `_playVideo()` and `_playAudioCue()` drive OBS media sources
- Producer View (surface) — socket `overrideScene` + link to `/:compId/obs-manager` (`show-controller/src/views/ProducerView.jsx:578`, `:1212`)
- Production checklist — validator `obs-connected` with `fixLink: /{compId}/obs-manager` (`show-controller/src/lib/checklistItems.js:151`)
- Camera management — `CameraSetupPage.jsx:66` calls `GET /api/scenes/preview` to show what scenes a camera set would produce
- Competition workspace (surface) — the OBS Manager page itself

**UI surfaces:**
- OBS Manager page (8 tabs) — `show-controller/src/pages/OBSManager.jsx`
- Scenes tab — `components/obs/SceneList.jsx` + `SceneEditor.jsx` + `SceneThumbnail.jsx` (80×45 card thumbs, 320×180 hover preview)
- Sources tab — inline `SourceList` in `OBSManager.jsx` + `components/obs/SourceEditor.jsx`
- Audio tab — `components/obs/AudioMixer.jsx` (VU meters + `useAudioAlerts`) and `AudioPresetManager.jsx`
- Transitions tab — `components/obs/TransitionPicker.jsx` + `StingerConfig.jsx`
- Stream tab — `components/obs/StreamConfig.jsx`
- Assets tab — `components/obs/AssetManager.jsx` (XHR upload with progress)
- Templates tab — `components/obs/TemplateManager.jsx` (apply/save/delete + "Set as Default" + auto-apply on connect)
- Talent Comms tab — `components/obs/TalentCommsPanel.jsx`
- Program output / Studio Mode header — `components/obs/OBSCurrentOutput.jsx` (2s auto-refresh via `hooks/useAutoRefreshScreenshot.js`) and `StudioModePanel.jsx`

**Known gaps:** (per-area status requested)
- **01 StateSync — Partial (server-only in production).** `obsStateSync` is wired to the local `obs` instance; `docs/README-OBS-Architecture.md:502-534` states it is "For Local Development" only. Production state flows through `broadcastOBSState()` instead, a separate implementation of the same categorisation logic (`server/index.js:4393` comment says so explicitly).
- **02 Scene Management — Built.** UI → socket → `obsConnectionManager` → obs-websocket, end to end. The 7 REST scene routes are dead code from the SPA's point of view.
- **03 Source Management — Built.** Same socket path. `docs/PRD-OBS-03-SourceManagement/IMPLEMENTATION-PLAN.md` says "Deployment Blocked (MCP tools unavailable)".
- **04 Audio — Built.** Includes real `InputVolumeMeters` VU meters (`obsConnectionManager.js:437-487`) and Firebase presets. Phase 3 marked future.
- **05 Transitions — Built.** Includes stinger file/point/audio-fade config. `POST /api/obs/transitions/stinger` is never called by the UI.
- **06 Stream & Recording — Built with gap.** Stream key AES-encrypted to `obs/streamConfig/streamKeyEncrypted`; `restoreStreamSettings` and `deleteStoredStreamKey` exist in `OBSContext.jsx:510-517` but no component calls them. Live streaming never tested ("requires valid stream key", `PRD-OBS-00-Index.md:126`).
- **07 Assets — Partial.** UI→REST→lib is complete but the REST layer resolves the competition via the single global `configLoader.getActiveCompetition()` (last socket connection wins, `server/index.js:4667`), and files land in `ASSET_BASE_PATH = '/var/www/assets/'` (`obsAssetManager.js:32`) on whichever host serves the request — the coordinator, not the OBS VM. `POST /api/obs/assets/pack/install` is unreachable from the UI.
- **08 / 08.1 Templates — Partial.** Apply correctly uses the per-competition connection (`server/routes/obs.js:1690`), but the last recorded production result is `"Template applied with warnings: 9 scenes, 0 inputs created. 12 items skipped."` (`docs/PRD-OBS-08.1-TemplateApply/IMPLEMENTATION-PLAN.md:343`). List/create/update/delete still gate on the local `obsStateSync.isInitialized()`. Client emits `obs:templateAutoApplied` (`TemplateManager.jsx:127`) but **there is no server handler for it** — other clients are never notified.
- **09 Preview — Built.** `obs:requestScreenshot` / `obs:requestSceneThumbnail` → `GetSourceScreenshot`. The 4 REST preview/studio-mode routes are unreachable from the UI.
- **10 Talent Comms — Partial.** See separate entry.
- **11 Advanced — Built.** Studio Mode, thumbnails, VU meters, stinger, talent status, stream-key encryption, template auto-load all implemented and screenshot-verified.
- **Rundown manual override is broken.** `TimesheetEngine.overrideScene()` (`timesheetEngine.js:1728`) checks `this.obs`, but `getOrCreateEngine()` (`server/index.js:412`) passes only `obsConnectionManager` — `this.obs` is always `null`, so `timesheetOverrideScene` always errors with "Cannot override scene: OBS not connected". Separately, `overrideScene` (ProducerView/QuickActions, `server/index.js:4837`) routes to the legacy global `switchScene()` on the local obs and is a no-op on the coordinator. Only OBS Manager's `switchScene` uses the per-competition connection.
- `CGA_AllStars_2026_SceneCollection.json` (353 KB, one scene with 100 `ffmpeg_source` clips) is referenced by no code or doc — an orphaned artifact of a clip-playout session, not this integration.
- `OBS_WEBSOCKET_PASSWORD` defaults to empty; the shipped AMI (`ami-070ce58462b2b9213`) has OBS WebSocket auth disabled, and port 4455 is documented as localhost-only yet the manager connects to `ws://{publicIp}:4455`.

**Evidence of live use:**
- `docs/PRD-OBS-11-AdvancedFeatures/screenshots/studio-mode-preview-program.png` — OBS Manager connected to a real VM's OBS, 10 categorised scenes, LIVE/PREVIEW badges, TAKE button (competition "Simpson vs UW-Whitewater")
- `docs/PRD-OBS-11-AdvancedFeatures/screenshots/vu-meters-stereo.png`, `scene-thumbnails-verification.png`, `stinger-transitions-tab.png`; `docs/PRD-OBS-04-AudioManagement/screenshots/audio-mixer-with-alerts-deployed.png`; `docs/PRD-OBS-08.1-TemplateApply/screenshots/template-apply-success.png`
- `docs/PRD-OBS-01-StateSync/PRD-OBS-01-StateSync.md` — heartbeat fix "Verified: 2026-01-20 - Tested on production with competition 8kyf0rnl and VM 13.222.221.61"
- `docs/PRD-Rundown-System/BUGS.md` BUG-021 — a real pre-show incident where an unreachable OBS VM blocked socket-handler registration and silently broke Load Rundown
- **No evidence of a real broadcast.** `8kyf0rnl` / "Simpson vs UW-Whitewater" is a test competition (`ralph-obs/plan.md:11`, `ralph-vmpool/plan.md:158`); no OBS references appear in `docs/WCGNIC-2026/`, `docs/PRD-Graphics-Audit-ECAC/`, or any MPSF material. `OBS-INT-01-verification-results.md` records the integration test as FAIL because OBS was not running.

**PRDs / docs:**
- `docs/PRD-OBS-00-Index.md` (stale status table), `docs/PRD-OBSIntegrationTool-2026-01-16.md`, `docs/Implementation-OBSIntegrationTool-2026-01-16.md`
- `docs/PRD-OBS-01-StateSync/` … `docs/PRD-OBS-11-AdvancedFeatures/` (11 folders; each has `PRD-OBS-XX-*.md` + `IMPLEMENTATION-PLAN.md` — the plans are the accurate status source)
- `docs/README-OBS-Architecture.md` (the authoritative wiring doc), `docs/OBS-SCENE-CONTROLLER.md` (stale, describes the pre-coordinator single-OBS design), `docs/SPEC-OBS-Templates.md`
- `docs/obs-templates-raw-json/20260119-obs-template-ai-{dual,quad}.json` (raw OBS exports: dual = 9 scenes / 8 browser + 4 ffmpeg sources; quad = 22 scenes), `server/config/sceneTemplates/gymnastics-dual-v2-firebase.json` (12 inputs / 9 scenes, converted format)
- `OBS-19-SUMMARY.md`, `OBS-INT-01-verification-results.md`, `server/scripts/convertOBSTemplate.js`
- Tests: `server/__tests__/obs{StateSync,SceneManager,SourceManager,AudioManager,TransitionManager,StreamManager,AssetManager,TemplateManager}.test.js`, `server/lib/obsSceneGenerator.test.js`
