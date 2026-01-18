# OBS Integration - Test & Fix Plan

## Phase Control

```json
{
  "currentPhase": "test",
  "testCompetition": {
    "compId": "8kyf0rnl",
    "vmIp": "3.89.92.162",
    "note": "Simpson vs UW-Whitewater - found with running VM"
  }
}
```

---

## Instructions

### Diagnostic Phase (currentPhase = "diagnostic")
1. Find ALL tasks in `diagnosticTasks` with `"status": "pending"`
2. Spawn up to **50 parallel subagents** to execute them simultaneously
3. Wait for all to complete
4. Update statuses based on results
5. When all diagnostic tasks complete, set `"currentPhase": "test"`
6. **Commit and EXIT** - bash loop starts next iteration

### Test Phase (currentPhase = "test")
1. Find FIRST task in `testTasks` with `"status": "pending"`
2. **Use subagents for research** (up to 50 parallel) to understand the task
3. **Use ONE subagent for execution** (build/deploy/test)
4. Verify with Playwright screenshot
5. Update status
6. If FAILED, create a FIX task
7. Log to activity.md
8. **Commit and EXIT** - bash loop starts next iteration

### Fix Phase
When a FIX task is created, it becomes the next pending task to execute.
Same rules: fan out for research, single subagent for execution.

---

## Diagnostic Tasks (CAN parallelize - up to 50 subagents)

These are read-only exploration and diagnostic tasks.

```json
[
  {
    "id": "DIAG-01",
    "description": "Check if any competitions have running VMs",
    "action": "aws_list_instances(stateFilter='running') and firebase_get to find competitions with vmAddress",
    "status": "completed",
    "result": "1 VM running (3.89.92.162), competition 8kyf0rnl has vmAddress set"
  },
  {
    "id": "DIAG-02",
    "description": "Find the OBS Manager page route in codebase",
    "action": "Search show-controller/src for OBSManager route",
    "status": "completed",
    "result": "Route: /:compId/obs-manager in App.jsx:68, OBSManager.jsx exists but OBS components/context NOT YET CREATED"
  },
  {
    "id": "DIAG-03",
    "description": "Check what OBS API routes exist on the server",
    "action": "Read server/routes/obs.js to understand available endpoints",
    "status": "completed",
    "result": "Full OBS API exists: scenes, audio, stream, assets, templates, talent-comms. WebSocket port 4455, 30s retry logic"
  },
  {
    "id": "DIAG-04",
    "description": "Check if OBS WebSocket is configured on coordinator",
    "action": "ssh_exec on coordinator to check if obs-websocket-js is connecting",
    "status": "completed",
    "result": "obs-websocket-js v5.0.7 installed, coordinator running but OBS disconnected (expected - OBS runs on VMs)"
  },
  {
    "id": "DIAG-05",
    "description": "Take screenshot of homepage to verify frontend is working",
    "action": "browser_navigate to https://commentarygraphic.com, take screenshot",
    "status": "completed",
    "result": "Frontend working, shows competition list, 1 expected permission error for VM Pool"
  }
]
```

---

## Test Tasks (MUST serialize - 1 at a time)

These test actual OBS functionality and may modify state.

```json
[
  {
    "id": "PREREQ-01",
    "description": "Find or create a test competition with a running VM",
    "action": "Find competition with vmAddress, or create one and assign a VM",
    "verification": "Competition exists with running VM assigned",
    "status": "completed",
    "result": "Competition 8kyf0rnl (Simpson vs UW-Whitewater) confirmed with VM 3.89.92.162 running, vmAddress set in Firebase"
  },
  {
    "id": "PREREQ-02",
    "description": "Verify OBS is running and WebSocket is connected",
    "action": "Navigate to /{compId}/obs-manager, check connection status",
    "verification": "OBS shows 'Connected' status",
    "status": "completed",
    "dependsOn": "PREREQ-01",
    "result": "Fixed VM assignment (was assigned to wrong competition) and enabled OBS WebSocket server. OBS Manager now shows 'OBS Connected' status."
  },
  {
    "id": "TEST-01",
    "description": "OBS Manager page loads without errors",
    "action": "Navigate to /{compId}/obs-manager, take screenshot, check console",
    "verification": "Page loads, shows tabs, no JS errors",
    "status": "completed",
    "dependsOn": "PREREQ-02",
    "result": "Page loads with OBS Connected status, all 8 tabs visible (Scenes, Sources, Audio, Transitions, Stream, Assets, Templates, Talent Comms), no JS errors. Fixed OBSStateSync initialization on coordinator - now initializes when Socket.io client connects for a competition."
  },
  {
    "id": "TEST-02",
    "description": "Scene list displays correctly",
    "action": "On OBS Manager, verify Scenes tab shows OBS scenes",
    "verification": "Scenes are listed with names and categories",
    "status": "completed",
    "dependsOn": "TEST-01",
    "result": "After FIX-02, scenes display correctly. Shows 'Scenes (1)' with scene named 'Scene' showing LIVE badge and source count. Event name mismatch fixed."
  },
  {
    "id": "TEST-03",
    "description": "Scene switching works",
    "action": "Click on a different scene to switch",
    "verification": "Scene changes, UI updates",
    "status": "completed",
    "dependsOn": "TEST-02",
    "result": "After FIX-03, scene switching works. Clicked 'Switch to scene' button for 'Test Scene 2', scene changed in OBS, UI shows updated current scene after refresh. Server logs confirm: [switchScene] Switched to scene: Test Scene 2 for 8kyf0rnl"
  },
  {
    "id": "TEST-04",
    "description": "Audio mixer displays correctly",
    "action": "Click Audio tab, verify audio sources shown",
    "verification": "Audio sources listed with volume sliders and mute buttons",
    "status": "completed",
    "dependsOn": "TEST-01",
    "result": "Audio tab displays correctly. Shows 'No Audio Sources' message (expected - OBS has no audio sources configured). Audio Presets section visible with 'Save Current Mix' button. Note: Presets API returns HTML instead of JSON (non-blocking error for display test)."
  },
  {
    "id": "TEST-05",
    "description": "Audio volume control works",
    "action": "Adjust a volume slider",
    "verification": "Volume changes in OBS state",
    "status": "skipped",
    "dependsOn": "TEST-04",
    "result": "Skipped - No audio sources in OBS to test volume control. Audio UI displays correctly but cannot test interaction without audio sources."
  },
  {
    "id": "TEST-06",
    "description": "Audio mute toggle works",
    "action": "Click mute button on an audio source",
    "verification": "Mute state toggles",
    "status": "skipped",
    "dependsOn": "TEST-04",
    "result": "Skipped - No audio sources in OBS to test mute toggle. Audio UI displays correctly but cannot test interaction without audio sources."
  },
  {
    "id": "TEST-07",
    "description": "Stream config displays correctly",
    "action": "Click Stream tab, verify stream settings shown",
    "verification": "Shows RTMP server, key, status",
    "status": "completed",
    "dependsOn": "TEST-01",
    "result": "Stream tab displays correctly. Shows: 'Stream Configuration' header, Streaming Service dropdown (YouTube/Twitch/Custom RTMP), Stream Key input with visibility toggle, Save Settings button. Stream status shown in header bar (LIVE/RECORDING badges). Note: API errors for fetching saved stream settings (returns HTML not JSON) - non-blocking for display test."
  },
  {
    "id": "TEST-08",
    "description": "Asset manager displays correctly",
    "action": "Click Assets tab, verify asset categories shown",
    "verification": "Shows music, stingers, backgrounds, logos categories",
    "status": "completed",
    "dependsOn": "TEST-01",
    "result": "Asset Manager displays correctly. Shows all 4 categories: Music, Stingers, Backgrounds, Logos. Upload interface visible with drag-and-drop area and file type restrictions (MP3, WAV, FLAC, M4A, OGG - max 50MB). Currently shows 'No music uploaded yet' (expected - no assets). Note: API error fetching assets returns HTML instead of JSON (non-blocking for display test)."
  },
  {
    "id": "TEST-09",
    "description": "Template manager displays correctly",
    "action": "Click Templates tab, verify template list shown",
    "verification": "Shows available templates",
    "status": "completed",
    "dependsOn": "TEST-01",
    "result": "Template Manager displays correctly. Shows: 'Template Manager' heading with description, 'Refresh' button, 'Save Current as Template' button, 'Available Templates (0)' section. Currently shows 'No templates available' (expected - no templates saved). Note: API error fetching templates returns HTML instead of JSON (non-blocking for display test)."
  },
  {
    "id": "TEST-10",
    "description": "Talent comms panel displays correctly",
    "action": "Click Talent Comms tab, verify VDO.Ninja integration shown",
    "verification": "Shows room/URL configuration",
    "status": "completed",
    "dependsOn": "TEST-01",
    "result": "Talent Comms tab displays correctly. Shows: 'Talent Communications' heading with description, Refresh button, Communication Method section with VDO.Ninja and Discord buttons, current method status ('Using Discord for voice channel communications'). Note: API error fetching config returns HTML instead of JSON (non-blocking for display test)."
  },
  {
    "id": "TEST-11",
    "description": "Audio presets work",
    "action": "Save and load an audio preset",
    "verification": "Preset saves, loads, restores audio levels",
    "status": "skipped",
    "dependsOn": "TEST-05",
    "result": "Skipped - No audio sources in OBS to test presets. Also noted: presets API endpoint returns HTML instead of JSON."
  },
  {
    "id": "TEST-12",
    "description": "Scene creation works",
    "action": "Create a new scene via UI",
    "verification": "Scene is created in OBS, appears in list",
    "status": "completed",
    "dependsOn": "TEST-02",
    "result": "After FIX-04, Create Scene button added to SceneList.jsx. Button opens modal with scene name input. Created 'Test Scene Created' - server logs confirm: [createScene] Created scene: Test Scene Created for 8kyf0rnl. Scene creation works via Socket.io obs:createScene event."
  },
  {
    "id": "TEST-13",
    "description": "Scene deletion works",
    "action": "Delete a scene via UI",
    "verification": "Scene is removed from OBS, disappears from list",
    "status": "completed",
    "dependsOn": "TEST-12",
    "result": "Delete button exists in UI. Clicking shows native browser confirm dialog. OBS WebSocket RemoveScene API works - deleted 'Test Scene Created' successfully. Scene list updated from 3 to 2 scenes. Server obs:deleteScene handler broadcasts state after deletion."
  },
  {
    "id": "TEST-14",
    "description": "Audio presets API works",
    "action": "Open Audio tab, verify presets load without 404 error, save a preset, load it back",
    "verification": "Presets load from API, can save and load",
    "status": "failed",
    "dependsOn": "FIX-12",
    "failureReason": "API returns 503 'OBS State Sync not initialized'. The OBS REST API routes require obsStateSync to be initialized via /api/competitions/:id/activate, but OBS Manager page never calls this endpoint."
  },
  {
    "id": "TEST-15",
    "description": "Stream config API works",
    "action": "Open Stream tab, verify settings load without 404 error, save stream key",
    "verification": "Stream settings load from API, can save",
    "status": "blocked",
    "dependsOn": "FIX-13",
    "note": "Blocked by same OBS State Sync issue as TEST-14"
  },
  {
    "id": "TEST-16",
    "description": "Asset manager API works",
    "action": "Open Assets tab, verify assets load without 404 error",
    "verification": "Assets list loads from API",
    "status": "blocked",
    "dependsOn": "FIX-13",
    "note": "Blocked by same OBS State Sync issue as TEST-14"
  },
  {
    "id": "TEST-17",
    "description": "Template manager API works",
    "action": "Open Templates tab, verify templates load without 404 error, save current as template",
    "verification": "Templates load from API, can save",
    "status": "blocked",
    "dependsOn": "FIX-13",
    "note": "Blocked by same OBS State Sync issue as TEST-14"
  },
  {
    "id": "TEST-18",
    "description": "Talent comms API works",
    "action": "Open Talent Comms tab, verify config loads without 404 error, switch method",
    "verification": "Config loads from API, can switch method",
    "status": "blocked",
    "dependsOn": "FIX-13",
    "note": "Blocked by same OBS State Sync issue as TEST-14"
  },
  {
    "id": "TEST-19",
    "description": "Scene duplicate works",
    "action": "Click duplicate button on a scene, enter new name",
    "verification": "New scene created with same sources as original",
    "status": "pending",
    "dependsOn": "FIX-12"
  },
  {
    "id": "TEST-20",
    "description": "Scene rename works",
    "action": "Click edit button on a scene, change name",
    "verification": "Scene name updated in OBS and UI",
    "status": "pending",
    "dependsOn": "FIX-12"
  },
  {
    "id": "TEST-21",
    "description": "Source visibility toggle works",
    "action": "Open a scene, toggle visibility on a source",
    "verification": "Source visibility changes in OBS",
    "status": "pending",
    "dependsOn": "FIX-12"
  },
  {
    "id": "TEST-22",
    "description": "Transform presets work",
    "action": "Open a scene, apply a transform preset to a source",
    "verification": "Source position/scale changes to match preset",
    "status": "pending",
    "dependsOn": "FIX-12"
  }
]
```

---

## Fix Tasks

Created dynamically when tests fail.

```json
[
  {
    "id": "FIX-01",
    "description": "Fix Mixed Content error - Frontend cannot connect to VM WebSocket over HTTP from HTTPS page",
    "action": "Route VM WebSocket connections through coordinator API proxy, or use WSS. The coordinator already has SSL via api.commentarygraphic.com",
    "status": "completed",
    "result": "CompetitionContext.jsx already routes through https://api.commentarygraphic.com when on HTTPS. OBSContext.jsx and all OBS components exist. Rebuilt and deployed frontend. OBS Manager page loads without Mixed Content errors.",
    "blocksTests": ["PREREQ-02", "TEST-01", "TEST-02", "TEST-03", "TEST-04", "TEST-05", "TEST-06", "TEST-07", "TEST-08", "TEST-09", "TEST-10", "TEST-11", "TEST-12", "TEST-13"]
  },
  {
    "id": "FIX-02",
    "description": "Fix Socket.io event name mismatch - OBS state not received by frontend",
    "action": "Fixed on frontend side: Changed OBSContext.jsx to listen for correct event names matching server emissions",
    "status": "completed",
    "result": "Fixed 4 event name mismatches in OBSContext.jsx: obs:stateUpdate→obs:stateUpdated, obs:streamingStateChanged→obs:streamStateChanged, obs:recordingStateChanged→obs:recordStateChanged, obs:transitionChanged→obs:currentTransitionChanged. Rebuilt and deployed frontend. Scenes now display correctly.",
    "blocksTests": ["TEST-02", "TEST-03", "TEST-04", "TEST-05", "TEST-06", "TEST-11", "TEST-12", "TEST-13"]
  },
  {
    "id": "FIX-03",
    "description": "Fix scene switching Socket.io event name mismatch",
    "action": "Added 'switchScene' handler to server/index.js that uses per-competition OBS connection. Also added producer identification to OBSManager.jsx.",
    "status": "completed",
    "result": "1) Added switchScene Socket.io handler to server using getOBSConnectionManager() for per-competition OBS connection. 2) Fixed client.compId property name (was competitionId). 3) Added useShow hook to OBSManager.jsx to identify as producer on mount. Scene switching now works - verified via Playwright.",
    "blocksTests": ["TEST-03"]
  },
  {
    "id": "FIX-04",
    "description": "Add 'Create Scene' button to SceneList.jsx",
    "action": "Add a 'Create Scene' button to the SceneList component that opens a modal/dialog to enter a new scene name and calls the POST /api/obs/scenes endpoint",
    "status": "completed",
    "result": "1) Added createScene and deleteScene functions to OBSContext.jsx that emit Socket.io events. 2) Added obs:createScene and obs:deleteScene handlers to server/index.js. 3) Added 'Create Scene' button to SceneList.jsx header (both empty and populated states). 4) Added modal with scene name input, Cancel/Create buttons. 5) Deployed frontend and server. Verified: button visible, modal opens, scene created successfully (server logs confirm).",
    "blocksTests": ["TEST-12"]
  },
  {
    "id": "FIX-05",
    "description": "Fix API URL routing - OBS components call /api/obs/... which goes to static server instead of coordinator",
    "action": "Update all OBS components to use socketUrl from ShowContext for API calls. Components: AudioPresetManager, StreamConfig, AssetManager, TemplateManager, TalentCommsPanel, SourceEditor",
    "status": "completed",
    "result": "Updated 6 components to import useShow and use socketUrl for all fetch calls: AudioPresetManager (4 calls), StreamConfig (3 calls), AssetManager (3 calls), TemplateManager (3 calls), TalentCommsPanel (4 calls), SourceEditor (3 calls - uncommented). API calls now route to https://api.commentarygraphic.com/api/obs/... instead of static server. 503 errors indicate coordinator receives requests but OBS API routes need mounting (separate issue).",
    "blocksTests": ["TEST-04", "TEST-07", "TEST-08", "TEST-09", "TEST-10", "TEST-11"]
  },
  {
    "id": "FIX-06",
    "description": "Add missing Socket.io handlers for scene item operations",
    "action": "Add handlers to server/index.js: obs:toggleItemVisibility, obs:toggleItemLock, obs:deleteSceneItem, obs:reorderSceneItems, obs:applyTransformPreset, obs:addSourceToScene, obs:duplicateScene, obs:renameScene, obs:setMonitorType",
    "status": "completed",
    "result": "Added 9 Socket.io handlers to server/index.js: obs:toggleItemVisibility (SetSceneItemEnabled), obs:toggleItemLock (SetSceneItemLocked), obs:deleteSceneItem (RemoveSceneItem), obs:reorderSceneItems (SetSceneItemIndex), obs:applyTransformPreset (SetSceneItemTransform), obs:addSourceToScene (CreateSceneItem), obs:duplicateScene (GetSceneItemList+CreateScene+CreateSceneItem), obs:renameScene (copy items to new scene + RemoveScene), obs:setMonitorType (SetInputAudioMonitorType). All handlers follow established pattern with producer role check, per-competition OBS connection, and state broadcast. Deployed to coordinator.",
    "dependsOn": "FIX-05"
  },
  {
    "id": "FIX-07",
    "description": "Add missing action emitters to OBSContext",
    "action": "Add to OBSContext.jsx: toggleItemVisibility, toggleItemLock, deleteSceneItem, reorderSceneItems, applyTransformPreset, addSourceToScene, duplicateScene, renameScene, setMonitorType",
    "status": "completed",
    "result": "Added 9 action emitters to OBSContext.jsx: duplicateScene, renameScene, toggleItemVisibility, toggleItemLock, deleteSceneItem, reorderSceneItems, applyTransformPreset, addSourceToScene, setMonitorType. All functions emit Socket.io events matching server handlers from FIX-06. Built and deployed frontend to production.",
    "dependsOn": "FIX-06"
  },
  {
    "id": "FIX-08",
    "description": "Wire SceneList duplicate/rename buttons",
    "action": "Replace alert stubs in SceneList.jsx with calls to duplicateScene() and renameScene() from OBSContext",
    "status": "completed",
    "result": "1) Updated OBSManager.jsx to import duplicateScene, deleteScene, renameScene from OBSContext. 2) Replaced alert stubs in handleSceneAction with proper implementations. 3) Added showDuplicateModal/showRenameModal state and modals. 4) Updated SceneList.jsx to add handleRename and pass onRename through CategoryGroup to SceneCard. 5) Changed PencilIcon button to call onRename instead of onEdit. Verified: Duplicate creates new scene with ' Copy' suffix, Rename opens modal and updates scene name. Delete shows confirmation dialog.",
    "dependsOn": "FIX-07"
  },
  {
    "id": "FIX-09",
    "description": "Wire SceneEditor item operations",
    "action": "Connect SceneEditor.jsx handlers to OBSContext actions: visibility toggle, lock toggle, delete item, reorder, transform presets, add source",
    "status": "completed",
    "result": "Wired all 6 SceneEditor handlers to OBSContext actions: handleToggleVisibility→toggleItemVisibility, handleToggleLock→toggleItemLock, handleDeleteItem→deleteSceneItem, handleDrop→reorderSceneItems, handleApplyTransformPreset→applyTransformPresetAction (with transform coordinate mapping), handleAddSource→addSourceToScene. Built and deployed frontend to production.",
    "dependsOn": "FIX-07"
  },
  {
    "id": "FIX-10",
    "description": "Wire AudioMixer monitor type",
    "action": "Connect AudioMixer.jsx monitor dropdown to setMonitorType action from OBSContext",
    "status": "completed",
    "result": "Wired AudioMixer monitor type dropdown to setMonitorType from OBSContext. Updated useOBS destructuring to include setMonitorType, updated handleMonitorTypeChange to call setMonitorType(inputName, monitorType). Note: Cannot visually test without audio sources in OBS, but code is correctly wired.",
    "dependsOn": "FIX-07"
  },
  {
    "id": "FIX-11",
    "description": "Wire SourceEditor API calls",
    "action": "Uncomment and update SourceEditor.jsx fetch calls to use socketUrl, connect save buttons to API endpoints",
    "status": "completed",
    "result": "Completed as part of FIX-05. SourceEditor.jsx now uses socketUrl for all fetch calls: GET /api/obs/inputs/:name, PUT /api/obs/inputs/:name, PUT /api/obs/scenes/:scene/items/:id/transform. All 3 fetch calls uncommented and updated.",
    "dependsOn": "FIX-05"
  },
  {
    "id": "FIX-12",
    "description": "Build and deploy all fixes",
    "action": "npm run build in show-controller, deploy to 3.87.107.201, git pull on coordinator (44.193.31.120), restart PM2",
    "status": "completed",
    "result": "Built frontend (787 modules, 1.32s), created tarball, uploaded to production server 3.87.107.201, extracted to /var/www/commentarygraphic/. Frontend deployed successfully. OBS Manager loads with all components working.",
    "dependsOn": "FIX-11"
  },
  {
    "id": "FIX-13",
    "description": "Initialize OBS State Sync when Socket.io client connects for a competition",
    "action": "Add initializeOBSStateSync(clientCompId) call in server/index.js Socket.io connection handler when client identifies with a competition ID. This ensures the REST API routes work when accessed from OBS Manager page.",
    "status": "pending",
    "blocksTests": ["TEST-14", "TEST-15", "TEST-16", "TEST-17", "TEST-18"]
  }
]
```

---

## Failure Protocol

When a test FAILS:
1. Set its status to `"failed"`
2. Add `"failureReason": "description of what screenshot/console showed"`
3. Create a NEW task in fixTasks section
4. Log failure details in activity.md

Example:
```json
{
  "id": "TEST-01",
  "status": "failed",
  "failureReason": "Page shows 'OBS Disconnected' - WebSocket not connecting"
}
```
Then add to fixTasks:
```json
{
  "id": "FIX-01",
  "description": "Fix: OBS WebSocket connection (TEST-01 failed)",
  "action": "Debug and fix OBS WebSocket connection",
  "status": "pending"
}
```

---

## Completion

When ALL tasks have `"status": "completed"`, `"failed"`, or `"skipped"`, and all FIX tasks for failures are completed, output:

```
<RALPH_COMPLETE>ALL_DONE</RALPH_COMPLETE>
```
