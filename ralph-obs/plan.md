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
2. Spawn up to 20 parallel subagents to execute them simultaneously
3. Wait for all to complete
4. Update statuses based on results
5. When all diagnostic tasks complete, set `"currentPhase": "test"`

### Test Phase (currentPhase = "test")
1. Find FIRST task in `testTasks` with `"status": "pending"`
2. Execute it (ONE at a time, sequentially)
3. Verify with Playwright screenshot
4. Update status
5. If FAILED, create a FIX task
6. Log to activity.md
7. Commit and exit (one test task per iteration)

### Fix Phase
When a FIX task is created, it becomes the next pending task to execute.

---

## Diagnostic Tasks (CAN parallelize - up to 20 subagents)

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
    "status": "pending"
  },
  {
    "id": "PREREQ-02",
    "description": "Verify OBS is running and WebSocket is connected",
    "action": "Navigate to /{compId}/obs-manager, check connection status",
    "verification": "OBS shows 'Connected' status",
    "status": "pending",
    "dependsOn": "PREREQ-01"
  },
  {
    "id": "TEST-01",
    "description": "OBS Manager page loads without errors",
    "action": "Navigate to /{compId}/obs-manager, take screenshot, check console",
    "verification": "Page loads, shows tabs, no JS errors",
    "status": "pending",
    "dependsOn": "PREREQ-02"
  },
  {
    "id": "TEST-02",
    "description": "Scene list displays correctly",
    "action": "On OBS Manager, verify Scenes tab shows OBS scenes",
    "verification": "Scenes are listed with names and categories",
    "status": "pending",
    "dependsOn": "TEST-01"
  },
  {
    "id": "TEST-03",
    "description": "Scene switching works",
    "action": "Click on a different scene to switch",
    "verification": "Scene changes, UI updates",
    "status": "pending",
    "dependsOn": "TEST-02"
  },
  {
    "id": "TEST-04",
    "description": "Audio mixer displays correctly",
    "action": "Click Audio tab, verify audio sources shown",
    "verification": "Audio sources listed with volume sliders and mute buttons",
    "status": "pending",
    "dependsOn": "TEST-01"
  },
  {
    "id": "TEST-05",
    "description": "Audio volume control works",
    "action": "Adjust a volume slider",
    "verification": "Volume changes in OBS state",
    "status": "pending",
    "dependsOn": "TEST-04"
  },
  {
    "id": "TEST-06",
    "description": "Audio mute toggle works",
    "action": "Click mute button on an audio source",
    "verification": "Mute state toggles",
    "status": "pending",
    "dependsOn": "TEST-04"
  },
  {
    "id": "TEST-07",
    "description": "Stream config displays correctly",
    "action": "Click Stream tab, verify stream settings shown",
    "verification": "Shows RTMP server, key, status",
    "status": "pending",
    "dependsOn": "TEST-01"
  },
  {
    "id": "TEST-08",
    "description": "Asset manager displays correctly",
    "action": "Click Assets tab, verify asset categories shown",
    "verification": "Shows music, stingers, backgrounds, logos categories",
    "status": "pending",
    "dependsOn": "TEST-01"
  },
  {
    "id": "TEST-09",
    "description": "Template manager displays correctly",
    "action": "Click Templates tab, verify template list shown",
    "verification": "Shows available templates",
    "status": "pending",
    "dependsOn": "TEST-01"
  },
  {
    "id": "TEST-10",
    "description": "Talent comms panel displays correctly",
    "action": "Click Talent Comms tab, verify VDO.Ninja integration shown",
    "verification": "Shows room/URL configuration",
    "status": "pending",
    "dependsOn": "TEST-01"
  },
  {
    "id": "TEST-11",
    "description": "Audio presets work",
    "action": "Save and load an audio preset",
    "verification": "Preset saves, loads, restores audio levels",
    "status": "pending",
    "dependsOn": "TEST-05"
  },
  {
    "id": "TEST-12",
    "description": "Scene creation works",
    "action": "Create a new scene via UI",
    "verification": "Scene is created in OBS, appears in list",
    "status": "pending",
    "dependsOn": "TEST-02"
  },
  {
    "id": "TEST-13",
    "description": "Scene deletion works",
    "action": "Delete a scene via UI",
    "verification": "Scene is removed from OBS, disappears from list",
    "status": "pending",
    "dependsOn": "TEST-12"
  }
]
```

---

## Fix Tasks

Created dynamically when tests fail.

```json
[
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
[[RALPH_LOOP_DONE]]
```
