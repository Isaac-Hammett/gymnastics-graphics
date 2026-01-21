# PRD-OBS-08.1: Template Apply Fix - Implementation Plan

**Last Updated:** 2026-01-21
**Status:** IN PROGRESS

---

## Priority Order

### P0 - Critical Fixes

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Fix frontend response handling in TemplateManager.jsx | COMPLETE | Already fixed in previous session |
| 2 | Fix ApplyTemplateModal scene count display | COMPLETE | Shows `template.scenes?.length` |
| 3 | Add template format validation in obsTemplateManager.js | COMPLETE | Reject legacy string arrays |
| 4 | Migrate `gymnastics-dual-v1` template to proper format | COMPLETE | v1.1 with scene objects |
| 5 | Migrate `gymnastics-quad-v1` template to proper format | COMPLETE | v1.1 with scene objects |

### P1 - Validation & Error Handling

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6 | Improve API error response with errorCode | NOT STARTED | routes/obs.js |
| 7 | Add validation tests to obsTemplateManager.test.js | NOT STARTED | Test legacy format rejection |
| 8 | Show detailed errors in frontend | NOT STARTED | Display `result.errors` |

### P2 - Template Management Improvements

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Add template preview to ApplyTemplateModal | NOT STARTED | List scenes/inputs to be created |
| 10 | Create template migration script | NOT STARTED | For updating legacy templates |

---

## Source Files to Modify

### Frontend
| File | Changes | Lines |
|------|---------|-------|
| `show-controller/src/components/obs/TemplateManager.jsx` | Fix response handling, modal display | ~93, ~467 |

### Backend
| File | Changes | Lines |
|------|---------|-------|
| `server/lib/obsTemplateManager.js` | Add validation | ~180-200 |
| `server/routes/obs.js` | Improve error response | ~1690-1705 |

### Firebase
| Path | Changes |
|------|---------|
| `templates/obs/gymnastics-dual-v1` | Migrate to full scene configs |
| `templates/obs/gymnastics-quad-v1` | Migrate to full scene configs |

### Tests
| File | Changes |
|------|---------|
| `server/__tests__/obsTemplateManager.test.js` | Add validation tests |

---

## Detailed Task Breakdown

### Task 1: Fix Frontend Response Handling

**File:** `show-controller/src/components/obs/TemplateManager.jsx`

**Line 93 - Change from:**
```javascript
setSuccess(`Template applied successfully: ${data.scenesCreated} scenes created`);
```

**To:**
```javascript
const scenesCreated = data.result?.scenesCreated || 0;
const inputsCreated = data.result?.inputsCreated || 0;
const errors = data.result?.errors || [];

if (errors.length > 0) {
  setSuccess(`Template applied with warnings: ${scenesCreated} scenes, ${inputsCreated} inputs created. ${errors.length} items skipped.`);
} else {
  setSuccess(`Template applied successfully: ${scenesCreated} scenes, ${inputsCreated} inputs created`);
}
```

---

### Task 2: Fix ApplyTemplateModal Scene Count

**File:** `show-controller/src/components/obs/TemplateManager.jsx`

**In ApplyTemplateModal (~line 467) - Change from:**
```javascript
<div className="text-gray-300 text-sm">
  <span className="text-gray-500">Scenes:</span> {template.scenesCount || 0}
</div>
```

**To:**
```javascript
<div className="text-gray-300 text-sm">
  <span className="text-gray-500">Scenes:</span> {template.scenes?.length || template.scenesCount || 0}
</div>
```

---

### Task 3: Add Template Format Validation

**File:** `server/lib/obsTemplateManager.js`

**Add at start of `applyTemplate()` method (~line 186):**
```javascript
// Validate template has proper structure
if (!template.scenes || !Array.isArray(template.scenes)) {
  throw new Error('Template has no scenes defined');
}

if (template.scenes.length === 0) {
  throw new Error('Template has empty scenes array');
}

// Check if scenes are objects (proper format) or strings (legacy format)
const firstScene = template.scenes[0];
if (typeof firstScene === 'string') {
  throw new Error(
    'Template uses legacy format (scene names only). ' +
    'Please delete this template and re-save from a configured OBS instance.'
  );
}

if (!firstScene.sceneName) {
  throw new Error('Template scenes missing required sceneName property');
}
```

---

### Task 4 & 5: Migrate Templates to Proper Format

**Approach:** Rather than manually creating huge JSON structures, use the "Save Template" feature from a properly configured OBS:

1. Start OBS on a competition VM
2. Configure scenes matching the dual meet template:
   - Stream Starting Soon (empty or with background)
   - Full Screen - Camera A (with SRT source + graphics overlay)
   - Full Screen - Camera B
   - Dual View - Camera A - Left
   - Dual View - Camera A - Right
   - Web-graphics-only-no-video
   - Replay - Camera A
   - Replay - Camera B
   - End Stream
3. Use the "Save Current as Template" button
4. Export the Firebase data
5. Update the pre-seeded templates

**Alternative:** Create a minimal working template structure:

```json
{
  "id": "gymnastics-dual-v1",
  "name": "Gymnastics Dual Meet",
  "version": "1.1",
  "description": "Standard dual meet setup with 2 cameras",
  "meetTypes": ["mens-dual", "womens-dual"],
  "scenes": [
    { "sceneName": "Stream Starting Soon", "items": [] },
    { "sceneName": "Full Screen - Camera A", "items": [] },
    { "sceneName": "Full Screen - Camera B", "items": [] },
    { "sceneName": "Dual View - Camera A - Left", "items": [] },
    { "sceneName": "Dual View - Camera A - Right", "items": [] },
    { "sceneName": "Web-graphics-only-no-video", "items": [] },
    { "sceneName": "Replay - Camera A", "items": [] },
    { "sceneName": "Replay - Camera B", "items": [] },
    { "sceneName": "End Stream", "items": [] }
  ],
  "inputs": [],
  "transitions": {
    "currentTransitionName": "Fade",
    "currentTransitionDuration": 300
  },
  "createdAt": "2026-01-21T00:00:00Z",
  "updatedAt": "2026-01-21T00:00:00Z"
}
```

This creates empty scenes that users can then populate with sources.

---

## Progress Log

### 2026-01-21
- Created PRD-OBS-08.1-TemplateApply.md
- Created IMPLEMENTATION-PLAN.md
- Identified root causes via Playwright testing and coordinator log analysis
- Task 1: Verified already complete (response handling fixed in previous session)
- Task 2: Fixed ApplyTemplateModal scene count to use `template.scenes?.length`
- Deployed to production and verified via Playwright: Modal shows "Scenes: 9" correctly
- Task 3: Added template format validation in `obsTemplateManager.applyTemplate()`:
  - Validates scenes array exists and is not empty
  - Rejects legacy string array format with clear error message
  - Validates scenes have required `sceneName` property
  - Deployed to coordinator and verified via Playwright
  - Error message displays correctly: "Template uses legacy format (scene names only). Please delete this template and re-save from a configured OBS instance."
- Task 4 & 5: Migrated both pre-seeded templates to proper format:
  - `gymnastics-dual-v1`: Updated to v1.1 with 9 scene objects (each with `sceneName`, `sceneIndex`, `items: []`)
  - `gymnastics-quad-v1`: Updated to v1.1 with 22 scene objects
  - Both now include `inputs: []` and `transitions` config
  - Templates now pass validation and can be applied to OBS
- Deployed frontend to production (fixed cache issue with new JS bundle)
- Verified via Playwright:
  - ✅ Modal now shows "Scenes: 9" correctly
  - ✅ Success message now shows proper format (not "undefined")
  - ⚠️ NEW BUG DISCOVERED: OBS scene creation fails with "Socket not identified" error
    - All 9 scenes fail to create
    - Error in coordinator logs: `[OBSTemplateManager] Failed to apply scene X: Socket not identified`
    - This is a separate OBS WebSocket authentication issue, not related to template format
    - Should be tracked as a new issue (PRD-OBS-08.2 or similar)
- **FIXED Socket Not Identified bug:**
  - Root cause: HTTP routes used global `obs` variable instead of per-competition connection
  - Fix: Modified `server/routes/obs.js` to import `getOBSConnectionManager` and use `obsConnManager.getConnection(compId)` for template apply route
  - Deployed to coordinator via `git pull && pm2 restart coordinator`

---

## Known Issues (Blocking Full Functionality)

### Socket Not Identified Error
**Status:** FIXED - Deployed 2026-01-21
**Symptom:** When applying templates, scenes fail to create with "Socket not identified" error
**Impact:** Templates pass validation but scenes cannot actually be created in OBS
**Workaround:** None currently - users must manually create scenes

#### Root Cause Analysis

The coordinator has **two different OBS connection mechanisms**:

1. **Global `obs` variable** (in `server/index.js:76`)
   - Single OBSWebSocket instance: `const obs = new OBSWebSocket()`
   - Connects to `OBS_WEBSOCKET_URL` (typically localhost or a fixed URL)
   - Passed to `setupOBSRoutes(app, obs, ...)` for HTTP API routes

2. **OBSConnectionManager** (in `server/lib/obsConnectionManager.js`)
   - Creates **per-competition OBS connections** to different VMs
   - Used by Socket.IO handlers via `obsConnManager.getConnection(clientCompId)`
   - Connects to each competition VM's OBS at `ws://{vmIp}:4455`

**The Bug:** The HTTP routes (`/api/obs/templates/:id/apply`) use the **global `obs`** which is NOT connected to the competition VM's OBS. The Socket.IO handlers correctly use `obsConnectionManager` to get the per-competition connection, but the HTTP routes don't.

#### How Templates Are Applied (Current Implementation)

Templates are applied by making **individual OBS WebSocket API calls** to add scenes to the existing collection:
- `obs.call('CreateScene', { sceneName })` - Creates each scene one at a time
- `obs.call('CreateInput', {...})` - Creates inputs
- `obs.call('CreateSceneItem', {...})` - Adds items to scenes

This is **NOT** importing a scene collection JSON file - it's programmatically adding scenes via the WebSocket API.

#### Fix Required

Modify `server/routes/obs.js` to use `obsConnectionManager.getConnection(compId)` instead of the global `obs` variable. This requires:
1. Getting the competition ID from the request (already available in some routes)
2. Looking up the per-competition OBS connection from `obsConnectionManager`
3. Passing that connection to `OBSTemplateManager` instead of the global `obs`

**Fix Applied:** Modified `server/routes/obs.js` to use `obsConnectionManager.getConnection(compId)` instead of the global `obs` variable in the template apply route.

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/8kyf0rnl/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Commits

| Commit | Description |
|--------|-------------|
| 164d165 | PRD-OBS-08.1: Fix ApplyTemplateModal scene count display |
| 050069c | PRD-OBS-08.1: Add template format validation |
| 25df0d1 | PRD-OBS-08.1: Migrate templates to proper format |
