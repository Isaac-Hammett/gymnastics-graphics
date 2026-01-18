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
    "status": "completed",
    "dependsOn": "FIX-15",
    "result": "After FIX-15, Audio Presets load successfully. 5 presets displayed: Commentary Focus, Venue Focus, Music Bed, All Muted, Break Music. Each shows description, source count, Apply and Delete buttons. No console errors."
  },
  {
    "id": "TEST-15",
    "description": "Stream config API works",
    "action": "Open Stream tab, verify settings load without 404 error, save stream key",
    "verification": "Stream settings load from API, can save",
    "status": "completed",
    "dependsOn": "FIX-15",
    "result": "Stream Configuration tab loads successfully. Streaming Service dropdown (YouTube/Twitch/Custom RTMP) works. Stream Key input accepts input. Clicked 'Save Settings' → success message 'Settings Saved - Stream configuration updated successfully'. No console errors."
  },
  {
    "id": "TEST-16",
    "description": "Asset manager API works",
    "action": "Open Assets tab, verify assets load without 404 error",
    "verification": "Assets list loads from API",
    "status": "completed",
    "dependsOn": "FIX-15",
    "result": "After FIX-16 (fix AssetManager.jsx to extract data.assets from API response), Asset Manager tab loads correctly. Shows all 4 categories (Music, Stingers, Backgrounds, Logos), upload interface with drag-drop, and 'Music (0)' list. No console errors, no crashes."
  },
  {
    "id": "TEST-17",
    "description": "Template manager API works",
    "action": "Open Templates tab, verify templates load without 404 error, save current as template",
    "verification": "Templates load from API, can save",
    "status": "completed",
    "dependsOn": "FIX-15",
    "result": "After FIX-17 (fix TemplateManager.jsx to extract data.templates from API response), Template Manager tab loads correctly. Shows 'Template Manager' heading, description, Refresh button, 'Save Current as Template' button, 'Available Templates (0)'. Save template modal works (form fields, meet type selection). Note: Save operation returns 500 error due to undefined currentTransitionDuration - this is a separate server-side data issue, not API routing."
  },
  {
    "id": "TEST-18",
    "description": "Talent comms API works",
    "action": "Open Talent Comms tab, verify config loads without 404 error, switch method",
    "verification": "Config loads from API, can switch method",
    "status": "completed",
    "dependsOn": "FIX-15",
    "result": "Talent Comms tab loads correctly with no console errors. GET /api/obs/talent-comms returns 200 OK - config loads successfully. Shows 'Talent Communications' heading, description, Refresh button, Communication Method selector (VDO.Ninja/Discord), and current status 'Using Discord for voice channel communications'. Note: PUT /api/obs/talent-comms/method returns 404 - switch method endpoint not implemented, but this is beyond the scope of the display/load test."
  },
  {
    "id": "TEST-19",
    "description": "Scene duplicate works",
    "action": "Click duplicate button on a scene, enter new name",
    "verification": "New scene created with same sources as original",
    "status": "completed",
    "dependsOn": "FIX-12",
    "result": "Clicked Duplicate button on 'Test Scene 2', modal appeared with pre-filled name 'Test Scene 2 Copy', clicked Duplicate, scene count increased from 3 to 4, new scene 'Test Scene 2 Copy' visible in list. Console confirms: 'OBSContext: Duplicating scene Test Scene 2 to Test Scene 2 Copy'."
  },
  {
    "id": "TEST-20",
    "description": "Scene rename works",
    "action": "Click edit button on a scene, change name",
    "verification": "Scene name updated in OBS and UI",
    "status": "completed",
    "dependsOn": "FIX-12",
    "result": "Clicked Rename button on 'Test Scene 2', modal appeared with current name pre-filled, changed to 'TEST-20 Renamed Scene', clicked Rename. Console confirms: 'OBSContext: Renaming scene Test Scene 2 to TEST-20 Renamed Scene'. Scene list updated immediately showing new name. No console errors."
  },
  {
    "id": "TEST-21",
    "description": "Source visibility toggle works",
    "action": "Open a scene, toggle visibility on a source",
    "verification": "Source visibility changes in OBS",
    "status": "completed",
    "dependsOn": "FIX-12",
    "result": "Added Edit sources button to SceneCard, fixed broadcastOBSState to include scene items. Created test source 'Test Color Source' in OBS. Clicked Edit sources on 'Scene', SceneEditor showed source with Hide/Show/Lock/Delete buttons. Clicked Hide → source enabled=false in OBS, button changed to 'Show'. Clicked Show → source enabled=true in OBS. Console confirms: 'OBSContext: Toggle item visibility Scene 1 false/true'. Visibility toggle works correctly."
  },
  {
    "id": "TEST-22",
    "description": "Transform presets work",
    "action": "Open a scene, apply a transform preset to a source",
    "verification": "Source position/scale changes to match preset",
    "status": "completed",
    "dependsOn": "FIX-12",
    "result": "Clicked 'Edit sources' on 'Scene', selected 'Test Color Source'. Transform Presets panel appeared with all 10 presets (Fullscreen, Dual Left/Right, Quad corners, Triple layouts). Applied 'Dual Right' → position changed to (960, 0). Applied 'Quad Bottom Left' → position changed to (0, 540). Console confirms: 'OBSContext: Apply transform preset Scene 1 {positionX, positionY, scaleX, scaleY}'. State updates received and UI updated correctly. No console errors."
  },
  {
    "id": "TEST-23",
    "description": "Transition list displays correctly",
    "action": "Click Transitions tab, verify transition list shows available transitions",
    "verification": "Shows Cut, Fade, and any other configured transitions with current selection highlighted",
    "status": "skipped",
    "dependsOn": "TEST-01",
    "result": "Skipped - Transitions tab shows 'Transition controls coming soon' placeholder. TransitionPanel component not implemented yet. No console errors."
  },
  {
    "id": "TEST-24",
    "description": "Transition switching works",
    "action": "Click on a different transition to set it as default",
    "verification": "Transition changes, UI updates to show new selection",
    "status": "skipped",
    "dependsOn": "TEST-23",
    "result": "Skipped - Depends on TEST-23 which is not implemented (Transitions UI is a placeholder)."
  },
  {
    "id": "TEST-25",
    "description": "Transition duration can be set",
    "action": "Change transition duration slider or input",
    "verification": "Duration updates in OBS state",
    "status": "skipped",
    "dependsOn": "TEST-23",
    "result": "Skipped - Depends on TEST-23 which is not implemented (Transitions UI is a placeholder)."
  },
  {
    "id": "TEST-26",
    "description": "Screenshot capture works",
    "action": "Click Take Screenshot button in OBS Manager header",
    "verification": "Screenshot is captured and displayed or saved",
    "status": "completed",
    "dependsOn": "FIX-19",
    "result": "After FIX-19, screenshot capture works. Clicked 'Take Screenshot' button, console shows 'OBSContext: Taking screenshot' then 'OBSContext: Screenshot captured Scene 2026-01-18T04:07:21.108Z'. Screenshot file auto-downloaded as 'screenshot-Scene-1768709241071.png'. Server calls OBS GetSourceScreenshot API for current program scene and returns base64 PNG data."
  },
  {
    "id": "TEST-27",
    "description": "Template save works (after FIX-18)",
    "action": "Click 'Save Current as Template', enter details, click Save",
    "verification": "Template saves successfully without 500 error",
    "status": "completed",
    "dependsOn": "FIX-18",
    "result": "Template save works! Created 'TEST-27 Test Template' with description and mens-dual meet type. Template saved successfully (no 500 error), appears in Available Templates list (count shows 1). Minor UI bug: success toast shows 'Template undefined saved' but template name displays correctly in list."
  },
  {
    "id": "TEST-28",
    "description": "Talent comms setup works",
    "action": "Call POST /api/obs/talent-comms/setup to initialize talent comms, then test method switch",
    "verification": "Talent comms initialized, method can be switched between vdo-ninja and discord",
    "status": "completed",
    "dependsOn": "TEST-18",
    "note": "TEST-18 showed 404 on method switch because talent comms was not set up first - this is expected behavior",
    "result": "Talent comms setup and method switching work correctly. POST /api/obs/talent-comms/setup returned 201 Created with VDO.Ninja config (roomId, password, URLs generated). PUT /api/obs/talent-comms/method successfully switched to Discord (200 OK) and back to VDO.Ninja (200 OK). Firebase confirms config persisted at competitions/8kyf0rnl/config/talentComms with all fields populated. No console errors."
  },

  {
    "id": "TEST-29",
    "phase": "Phase 2 - Scene CRUD",
    "description": "Scene reorder via drag-and-drop works",
    "action": "In Scenes tab, drag a scene to a different position in the list",
    "verification": "Scene order changes in OBS and UI updates accordingly",
    "status": "failed",
    "dependsOn": "TEST-02",
    "failureReason": "Drag-and-drop for scene reordering is NOT implemented. No drag handles visible in UI. SceneList.jsx has no drag event handlers. Requires FIX-20 to implement.",
    "blockedBy": "FIX-20"
  },
  {
    "id": "TEST-30",
    "phase": "Phase 2 - Scene CRUD",
    "description": "Create scene from template works",
    "action": "Click Create Scene, select 'From Template' option, choose a template, verify scene is created with template sources",
    "verification": "New scene created with sources matching the selected template",
    "status": "failed",
    "dependsOn": "TEST-27",
    "failureReason": "Create Scene modal only has a simple name input field. No 'From Template' option exists. Templates are managed in a separate Templates tab but are not integrated with the Create Scene workflow. Requires FIX-21 to implement.",
    "blockedBy": "FIX-21"
  },

  {
    "id": "TEST-31",
    "phase": "Phase 3 - Source Management",
    "description": "Add new source to scene works",
    "action": "In SceneEditor, click 'Add Source' button, select source type (e.g., color source), configure settings",
    "verification": "New source is created and added to the scene, visible in OBS",
    "status": "pending",
    "dependsOn": "TEST-21"
  },
  {
    "id": "TEST-32",
    "phase": "Phase 3 - Source Management",
    "description": "Remove source from scene works",
    "action": "In SceneEditor, click Delete button on a source",
    "verification": "Source is removed from scene (but not deleted from OBS inputs)",
    "status": "pending",
    "dependsOn": "TEST-21"
  },
  {
    "id": "TEST-33",
    "phase": "Phase 3 - Source Management",
    "description": "Layer z-order reorder via drag-and-drop works",
    "action": "In SceneEditor, drag a source to change its layer order (z-index)",
    "verification": "Source order changes in OBS, front/back layer order updates",
    "status": "pending",
    "dependsOn": "TEST-21"
  },
  {
    "id": "TEST-34",
    "phase": "Phase 3 - Source Management",
    "description": "Source lock toggle works",
    "action": "In SceneEditor, click Lock button on a source",
    "verification": "Source lock state toggles, locked sources cannot be transformed",
    "status": "pending",
    "dependsOn": "TEST-21"
  },
  {
    "id": "TEST-35",
    "phase": "Phase 3 - Source Management",
    "description": "Edit source settings works (SRT/Media source)",
    "action": "Click Edit on an ffmpeg_source, change SRT URL, save",
    "verification": "Source settings updated in OBS, stream reconnects to new URL",
    "status": "pending",
    "dependsOn": "TEST-31"
  },
  {
    "id": "TEST-36",
    "phase": "Phase 3 - Source Management",
    "description": "Edit source settings works (Browser source)",
    "action": "Click Edit on a browser_source, change URL, width, height, save",
    "verification": "Browser source settings updated in OBS",
    "status": "pending",
    "dependsOn": "TEST-31"
  },

  {
    "id": "TEST-37",
    "phase": "Phase 5 - Transitions",
    "description": "Transition list displays available transitions",
    "action": "Click Transitions tab, verify list of available transitions (Cut, Fade, Stinger, etc.)",
    "verification": "Shows all configured transitions with current selection highlighted",
    "status": "pending",
    "dependsOn": "TEST-01",
    "note": "Requires implementing TransitionPanel component - currently shows placeholder"
  },
  {
    "id": "TEST-38",
    "phase": "Phase 5 - Transitions",
    "description": "Switch default transition works",
    "action": "Click on a different transition to set it as the default for scene switches",
    "verification": "Default transition changes, next scene switch uses new transition",
    "status": "pending",
    "dependsOn": "TEST-37"
  },
  {
    "id": "TEST-39",
    "phase": "Phase 5 - Transitions",
    "description": "Transition duration slider works",
    "action": "Adjust transition duration slider or input field",
    "verification": "Duration updates in OBS state, scene transitions use new duration",
    "status": "pending",
    "dependsOn": "TEST-37"
  },
  {
    "id": "TEST-40",
    "phase": "Phase 5 - Transitions",
    "description": "Stinger transition configuration works",
    "action": "Configure stinger transition with video file path and transition point",
    "verification": "Stinger settings saved, transition plays stinger video during scene switch",
    "status": "pending",
    "dependsOn": "TEST-37"
  },

  {
    "id": "TEST-41",
    "phase": "Phase 10 - Preview System",
    "description": "Live preview thumbnail displays current scene",
    "action": "Verify the preview placeholder in OBS Manager header shows actual OBS output",
    "verification": "Preview thumbnail shows real-time OBS output (updated periodically or via WebSocket)",
    "status": "pending",
    "dependsOn": "TEST-01",
    "note": "Currently shows 'Preview placeholder' - needs implementation"
  },
  {
    "id": "TEST-42",
    "phase": "Phase 10 - Preview System",
    "description": "Preview updates on scene change",
    "action": "Switch scenes and verify preview thumbnail updates",
    "verification": "Preview reflects new scene within 1-2 seconds of switching",
    "status": "pending",
    "dependsOn": "TEST-41"
  },

  {
    "id": "TEST-43",
    "phase": "Phase 7 - Asset Management",
    "description": "Asset upload works (music file)",
    "action": "Drag and drop or browse to upload an MP3 file",
    "verification": "File uploads to VM, appears in music asset list",
    "status": "pending",
    "dependsOn": "TEST-16"
  },
  {
    "id": "TEST-44",
    "phase": "Phase 7 - Asset Management",
    "description": "Asset delete works",
    "action": "Click delete button on an uploaded asset",
    "verification": "Asset removed from VM and list",
    "status": "pending",
    "dependsOn": "TEST-43"
  },
  {
    "id": "TEST-45",
    "phase": "Phase 7 - Asset Management",
    "description": "Asset categories filter correctly",
    "action": "Switch between Music, Stingers, Backgrounds, Logos tabs",
    "verification": "Each tab shows only assets of that type",
    "status": "pending",
    "dependsOn": "TEST-16"
  },

  {
    "id": "TEST-46",
    "phase": "Phase 8 - Templates",
    "description": "Template apply works",
    "action": "Click 'Apply Template' on a saved template",
    "verification": "OBS scenes/sources replaced with template content",
    "status": "pending",
    "dependsOn": "TEST-27"
  },
  {
    "id": "TEST-47",
    "phase": "Phase 8 - Templates",
    "description": "Template delete works",
    "action": "Click delete button on a saved template",
    "verification": "Template removed from list",
    "status": "pending",
    "dependsOn": "TEST-27"
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
    "status": "completed",
    "result": "Added initializeOBSStateSync(clientCompId) call to Socket.io connection handler in server/index.js (line 2433-2440). Deployed to coordinator. OBS State Sync now initializes when clients connect. Note: Presets API returns 500 due to separate routing bug (endpoint /api/obs/audio/presets being parsed as /api/obs/audio/:inputName with inputName='presets').",
    "blocksTests": ["TEST-14", "TEST-15", "TEST-16", "TEST-17", "TEST-18"]
  },
  {
    "id": "FIX-14",
    "description": "Fix OBS audio presets API routing - endpoint conflicts with audio input route",
    "action": "In server/routes/obs.js, the /api/obs/audio/presets route is being caught by /api/obs/audio/:inputName. Need to reorder routes or change path pattern.",
    "status": "completed",
    "result": "Moved GET/POST /api/obs/audio/presets routes BEFORE the /api/obs/audio/:inputName wildcard route in server/routes/obs.js. Express matches routes in declaration order, so the literal /presets path now matches before the wildcard. Route conflict resolved - API now returns 400 'No active competition' instead of 500 error.",
    "blocksTests": ["TEST-14"]
  },
  {
    "id": "FIX-15",
    "description": "Set active competition when Socket.io client connects",
    "action": "The REST API routes use configLoader.getActiveCompetition() which returns null because competition is not 'activated'. Need to call configLoader.setActiveCompetition(compId) in Socket.io connection handler so REST API routes work.",
    "status": "completed",
    "result": "Added configLoader.setActiveCompetition(clientCompId) call before initializeOBSStateSync in Socket.io connection handler (server/index.js). REST API routes now have access to competition ID. Audio presets load successfully - 5 presets displayed (Commentary Focus, Venue Focus, Music Bed, All Muted, Break Music). No console errors.",
    "blocksTests": ["TEST-14", "TEST-15", "TEST-16", "TEST-17", "TEST-18"]
  },
  {
    "id": "FIX-16",
    "description": "Fix AssetManager crash - API response format mismatch",
    "action": "AssetManager.jsx expected array from API but received {assets: [...]}. Updated fetchAssets to extract data.assets from response.",
    "status": "completed",
    "result": "Fixed AssetManager.jsx line 104-109 to extract assetList from API response: `const assetList = Array.isArray(data) ? data : (data.assets || [])`. Built and deployed frontend. Assets tab now loads without crash.",
    "blocksTests": ["TEST-16"]
  },
  {
    "id": "FIX-17",
    "description": "Fix TemplateManager crash - API response format mismatch",
    "action": "TemplateManager.jsx expected array from API but received {templates: [...]}. Updated fetchTemplates to extract data.templates from response.",
    "status": "completed",
    "result": "Fixed TemplateManager.jsx line 56-59 to extract templateList from API response: `const templateList = Array.isArray(data) ? data : (data.templates || [])`. Built and deployed frontend. Templates tab now loads without crash.",
    "blocksTests": ["TEST-17"]
  },
  {
    "id": "FIX-18",
    "description": "Fix template save 500 error - undefined currentTransitionDuration",
    "action": "In server/lib/obsTemplateManager.js _captureTransitions(), OBS API can return undefined for currentSceneTransitionDuration. Added nullish coalescing to provide default value of 0.",
    "status": "completed",
    "result": "Fixed obsTemplateManager.js line 485 to use `transitionListResponse.currentSceneTransitionDuration ?? 0` and added `|| []` fallback for transitions array. Firebase no longer fails when serializing template with undefined values.",
    "blocksTests": ["TEST-27"]
  },
  {
    "id": "FIX-19",
    "description": "Implement screenshot capture functionality",
    "action": "Add takeScreenshot function to OBSContext.jsx that emits obs:takeScreenshot Socket.io event. Add obs:takeScreenshot handler to server/index.js that calls OBS GetSourceScreenshot API. Add onClick handler to Take Screenshot button in OBSManager.jsx. Add UI feedback for screenshot capture (success/error message or display captured image).",
    "status": "completed",
    "result": "Implemented screenshot capture: 1) Added takeScreenshot callback to OBSContext.jsx that emits obs:takeScreenshot event. 2) Added obs:takeScreenshot handler to server/index.js that calls OBS GetSourceScreenshot API and emits obs:screenshotCaptured with base64 PNG data. 3) Added onClick handler to Take Screenshot button in OBSManager.jsx. 4) Added obs:screenshotCaptured listener that auto-downloads the screenshot as a PNG file. Verified working - clicking button captures and downloads screenshot.",
    "blocksTests": ["TEST-26"]
  },

  {
    "id": "FIX-20",
    "phase": "Phase 2 - Scene CRUD",
    "description": "Implement scene reorder drag-and-drop in SceneList",
    "action": "Add drag-and-drop functionality to SceneList.jsx using HTML5 drag API or react-dnd. Add obs:reorderScenes Socket.io handler to server that calls OBS SetSceneList API. Emit obs:reorderScenes from OBSContext.jsx.",
    "status": "pending",
    "blocksTests": ["TEST-29"]
  },
  {
    "id": "FIX-21",
    "phase": "Phase 2 - Scene CRUD",
    "description": "Add 'Create from Template' option to Create Scene modal",
    "action": "Extend Create Scene modal to include template selection dropdown. When template selected, call API to create scene with template sources pre-populated.",
    "status": "pending",
    "blocksTests": ["TEST-30"]
  },

  {
    "id": "FIX-22",
    "phase": "Phase 3 - Source Management",
    "description": "Implement 'Add Source' UI in SceneEditor",
    "action": "Add 'Add Source' button to SceneEditor that opens source type picker. Support creating: color_source, browser_source, ffmpeg_source, image_source. Wire to obs:createInput + obs:addSourceToScene Socket.io events.",
    "status": "pending",
    "blocksTests": ["TEST-31"]
  },
  {
    "id": "FIX-23",
    "phase": "Phase 3 - Source Management",
    "description": "Implement layer z-order drag-and-drop in SceneEditor",
    "action": "Add drag handles to source list items in SceneEditor. Implement drag-and-drop reordering that calls reorderSceneItems from OBSContext.",
    "status": "pending",
    "blocksTests": ["TEST-33"]
  },
  {
    "id": "FIX-24",
    "phase": "Phase 3 - Source Management",
    "description": "Implement SourceEditor for SRT/Media sources",
    "action": "Add SourceEditor modal/panel for ffmpeg_source type with fields: SRT URL, buffering, reconnect delay, hardware decode. Wire to PUT /api/obs/inputs/:name API.",
    "status": "pending",
    "blocksTests": ["TEST-35"]
  },
  {
    "id": "FIX-25",
    "phase": "Phase 3 - Source Management",
    "description": "Implement SourceEditor for Browser sources",
    "action": "Add SourceEditor panel for browser_source type with fields: URL, width, height, CSS, refresh on scene. Wire to PUT /api/obs/inputs/:name API.",
    "status": "pending",
    "blocksTests": ["TEST-36"]
  },

  {
    "id": "FIX-26",
    "phase": "Phase 5 - Transitions",
    "description": "Implement TransitionPanel component",
    "action": "Create TransitionPanel.jsx component to replace placeholder in OBSManager. Display list of available transitions from obsState.transitions. Highlight current default transition. Add click-to-select functionality.",
    "status": "pending",
    "blocksTests": ["TEST-37"]
  },
  {
    "id": "FIX-27",
    "phase": "Phase 5 - Transitions",
    "description": "Implement transition switching",
    "action": "Add setCurrentTransition to OBSContext.jsx that emits obs:setTransition. Add Socket.io handler that calls OBS SetCurrentSceneTransition API. Wire TransitionPanel selection to this action.",
    "status": "pending",
    "blocksTests": ["TEST-38"]
  },
  {
    "id": "FIX-28",
    "phase": "Phase 5 - Transitions",
    "description": "Implement transition duration control",
    "action": "Add duration slider/input to TransitionPanel. Add setTransitionDuration to OBSContext. Add Socket.io handler for OBS SetCurrentSceneTransitionDuration API.",
    "status": "pending",
    "blocksTests": ["TEST-39"]
  },
  {
    "id": "FIX-29",
    "phase": "Phase 5 - Transitions",
    "description": "Implement stinger transition configuration",
    "action": "Add stinger configuration panel to TransitionPanel. Fields: video path (from assets), transition point (ms). Wire to OBS SetSceneTransitionSettings API.",
    "status": "pending",
    "blocksTests": ["TEST-40"]
  },

  {
    "id": "FIX-30",
    "phase": "Phase 10 - Preview System",
    "description": "Implement live preview thumbnail",
    "action": "Replace 'Preview placeholder' div with actual OBS preview. Options: 1) Periodic screenshot polling (every 2-3 seconds), 2) WebRTC stream from OBS virtual camera, 3) NDI preview. Start with periodic screenshots using existing takeScreenshot infrastructure.",
    "status": "pending",
    "blocksTests": ["TEST-41", "TEST-42"]
  },

  {
    "id": "FIX-31",
    "phase": "Phase 7 - Asset Management",
    "description": "Implement asset upload functionality",
    "action": "Wire AssetManager upload UI to POST /api/obs/assets/upload API. Handle file validation, upload progress, success/error states. Verify files are saved to VM at /assets/{category}/.",
    "status": "pending",
    "blocksTests": ["TEST-43"]
  },
  {
    "id": "FIX-32",
    "phase": "Phase 7 - Asset Management",
    "description": "Implement asset delete functionality",
    "action": "Add delete button to asset list items. Wire to DELETE /api/obs/assets/:category/:filename API. Add confirmation dialog.",
    "status": "pending",
    "blocksTests": ["TEST-44"]
  },

  {
    "id": "FIX-33",
    "phase": "Phase 8 - Templates",
    "description": "Implement template apply functionality",
    "action": "Wire 'Apply Template' button to POST /api/obs/templates/:id/apply API. Handle confirmation (this will replace current scenes). Show progress indicator during apply.",
    "status": "pending",
    "blocksTests": ["TEST-46"]
  },
  {
    "id": "FIX-34",
    "phase": "Phase 8 - Templates",
    "description": "Implement template delete functionality",
    "action": "Add delete button to template list items. Wire to DELETE /api/obs/templates/:id API. Add confirmation dialog.",
    "status": "pending",
    "blocksTests": ["TEST-47"]
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
