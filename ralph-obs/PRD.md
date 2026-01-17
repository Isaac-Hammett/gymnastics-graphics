# OBS Integration Tool - Test & Fix PRD

## Goal

Systematically test every OBS integration feature on production, identify what's broken, and fix it.

---

## Success Criteria

All features must pass with Playwright verification on `https://commentarygraphic.com`.

---

## Test Environment

| Resource | Value |
|----------|-------|
| Production Frontend | https://commentarygraphic.com |
| OBS Manager Page | https://commentarygraphic.com/{compId}/obs-manager |
| Test Competition | Need to create or find one with a running VM |
| Coordinator API | https://api.commentarygraphic.com |
| Coordinator VM | 44.193.31.120 (port 3003) |

---

## Prerequisites

Before testing OBS features, we need:
1. A competition with an assigned, running VM
2. OBS Studio running on that VM
3. OBS WebSocket enabled and connected

---

## Test Workflows

### PREREQ-01: Find or Create Test Competition
1. Navigate to homepage
2. Find a competition with an assigned VM, or create one and assign a VM
3. Record the competition ID for subsequent tests

### PREREQ-02: Verify OBS Connection
1. Navigate to `/{compId}/obs-manager`
2. Check if OBS shows "Connected" status
3. If disconnected, diagnose why (VM not running? OBS not started? WebSocket disabled?)

---

### TEST-01: OBS Manager Page Loads
**Route:** `/{compId}/obs-manager`
**Verify:**
- [ ] Page loads without JS errors
- [ ] Shows connection status (Connected/Disconnected)
- [ ] Shows tab navigation (Scenes, Audio, Stream, Assets, Templates, Talent)
**Screenshot:** `screenshots/TEST-01.png`

### TEST-02: Scene List Display
**Verify:**
- [ ] Scenes tab shows list of OBS scenes
- [ ] Each scene shows name and category
- [ ] Current scene is highlighted
- [ ] Can click to switch scenes
**Screenshot:** `screenshots/TEST-02.png`

### TEST-03: Scene Switching
**Action:** Click on a different scene
**Verify:**
- [ ] Scene changes in OBS (via state update)
- [ ] UI updates to show new current scene
- [ ] No console errors
**Screenshot:** `screenshots/TEST-03.png`

### TEST-04: Audio Mixer Display
**Verify:**
- [ ] Audio tab shows audio sources
- [ ] Each source shows volume slider
- [ ] Each source shows mute toggle
- [ ] Volume levels are accurate
**Screenshot:** `screenshots/TEST-04.png`

### TEST-05: Audio Volume Control
**Action:** Adjust volume slider
**Verify:**
- [ ] Slider moves
- [ ] Volume change sent to OBS
- [ ] State reflects new volume
**Screenshot:** `screenshots/TEST-05.png`

### TEST-06: Audio Mute Toggle
**Action:** Click mute button
**Verify:**
- [ ] Mute state toggles
- [ ] UI reflects muted state
- [ ] OBS receives mute command
**Screenshot:** `screenshots/TEST-06.png`

### TEST-07: Stream Config Display
**Verify:**
- [ ] Stream tab shows stream settings
- [ ] Shows RTMP server and key fields
- [ ] Shows stream status (active/inactive)
**Screenshot:** `screenshots/TEST-07.png`

### TEST-08: Stream Start/Stop
**Action:** Click Start/Stop Stream button
**Verify:**
- [ ] Button changes state
- [ ] Stream status updates
- [ ] OBS confirms stream state change
**Screenshot:** `screenshots/TEST-08.png`

### TEST-09: Recording Start/Stop
**Action:** Click Start/Stop Recording button
**Verify:**
- [ ] Button changes state
- [ ] Recording status updates
- [ ] OBS confirms recording state change
**Screenshot:** `screenshots/TEST-09.png`

### TEST-10: Asset Manager Display
**Verify:**
- [ ] Assets tab shows asset categories (music, stingers, backgrounds, logos)
- [ ] Shows upload interface
- [ ] Lists existing assets
**Screenshot:** `screenshots/TEST-10.png`

### TEST-11: Asset Upload
**Action:** Upload a test file
**Verify:**
- [ ] File upload succeeds
- [ ] Asset appears in list
- [ ] Asset is usable in OBS
**Screenshot:** `screenshots/TEST-11.png`

### TEST-12: Template Manager Display
**Verify:**
- [ ] Templates tab shows available templates
- [ ] Can view template details
- [ ] Can create new template
**Screenshot:** `screenshots/TEST-12.png`

### TEST-13: Template Apply
**Action:** Apply a template
**Verify:**
- [ ] Template applies to OBS
- [ ] Scenes are created/modified
- [ ] No errors
**Screenshot:** `screenshots/TEST-13.png`

### TEST-14: Talent Comms Panel Display
**Verify:**
- [ ] Talent Comms tab shows VDO.Ninja integration
- [ ] Shows room/URL configuration
- [ ] Shows Discord fallback option
**Screenshot:** `screenshots/TEST-14.png`

### TEST-15: Studio Mode Toggle
**Action:** Toggle studio mode on/off
**Verify:**
- [ ] Preview scene appears when enabled
- [ ] Can set preview vs program
- [ ] Transition preview to program works
**Screenshot:** `screenshots/TEST-15.png`

### TEST-16: Scene CRUD - Create
**Action:** Create a new scene
**Verify:**
- [ ] Create scene button exists
- [ ] Scene is created in OBS
- [ ] Scene appears in list
**Screenshot:** `screenshots/TEST-16.png`

### TEST-17: Scene CRUD - Delete
**Action:** Delete a scene
**Verify:**
- [ ] Delete button exists
- [ ] Scene is removed from OBS
- [ ] Scene disappears from list
**Screenshot:** `screenshots/TEST-17.png`

### TEST-18: Source Management Display
**Verify:**
- [ ] Can view sources within a scene
- [ ] Shows source properties
- [ ] Can add/remove sources
**Screenshot:** `screenshots/TEST-18.png`

### TEST-19: Audio Presets
**Action:** Save and load an audio preset
**Verify:**
- [ ] Can save current audio levels as preset
- [ ] Preset appears in preset list
- [ ] Can load preset to restore levels
**Screenshot:** `screenshots/TEST-19.png`

### TEST-20: Transition Configuration
**Action:** Change transition type/duration
**Verify:**
- [ ] Can select different transitions
- [ ] Can adjust transition duration
- [ ] Changes apply to scene switches
**Screenshot:** `screenshots/TEST-20.png`

---

## Verification Method

Every test MUST be verified with:
1. `browser_navigate` to the relevant page
2. `browser_snapshot` to get element refs (if interaction needed)
3. `browser_take_screenshot` to capture current state
4. `browser_console_messages` to check for JS errors
5. Screenshot saved to `screenshots/` with test ID

If verification fails, the test fails and a FIX task must be created.

---

## Failure Protocol

When a test FAILS:
1. Set its status to `"failed"`
2. Add `"failureReason": "description of what screenshot/console showed"`
3. Create a NEW task to fix the specific issue
4. Log failure details in activity.md

---

## Completion

When ALL tests pass OR all known issues have fix tasks created, output:

```
[[RALPH_LOOP_DONE]]
```
