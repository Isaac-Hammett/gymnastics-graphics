# PRD-OBS-08.1: Template Apply Fix

**Version:** 1.0
**Date:** 2026-01-21
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-08 (Templates), PRD-OBS-02 (Scene Management)
**Blocks:** None

---

## Overview

The Template Apply feature is **broken**. When users click "Apply" on a template, no scenes are created in OBS despite showing a success message. This PRD documents the root causes and provides a complete fix.

> **Architecture Note:** All template operations flow through the **coordinator** (api.commentarygraphic.com). The frontend never connects directly to OBS or competition VMs. See [README-OBS-Architecture.md](../README-OBS-Architecture.md) for details.

---

## Problem Statement

### Symptoms
1. User clicks "Apply" on a template (e.g., "Gymnastics Dual Meet")
2. Confirmation modal shows "Scenes: 0" (suspicious)
3. After clicking "Apply Template", success message shows: **"Template applied successfully: undefined scenes created"**
4. No new scenes appear in OBS - scene count remains unchanged

### Root Causes

#### Issue #1: Templates Store Scene Names, Not Scene Configurations

**Current template structure in Firebase (`templates/obs/gymnastics-dual-v1`):**
```json
{
  "id": "gymnastics-dual-v1",
  "name": "Gymnastics Dual Meet",
  "scenes": [
    "Stream Starting Soon",
    "Full Screen - Camera A",
    "Full Screen - Camera B",
    "Dual View - Camera A - Left",
    "Dual View - Camera A - Right",
    "Web-graphics-only-no-video",
    "Replay - Camera A",
    "Replay - Camera B",
    "End Stream"
  ],
  "sourceFile": "server/config/sceneTemplates/20260119-obs-template-ai-dual.json"
}
```

**Expected structure for `applyTemplate()` to work:**
```json
{
  "id": "gymnastics-dual-v1",
  "name": "Gymnastics Dual Meet",
  "scenes": [
    {
      "sceneName": "Stream Starting Soon",
      "sceneIndex": 0,
      "items": [
        {
          "sceneItemId": 1,
          "sourceName": "Background Image",
          "inputKind": "image_source",
          "sceneItemTransform": { ... }
        }
      ]
    }
  ],
  "inputs": [
    {
      "inputName": "Camera A",
      "inputKind": "ffmpeg_source",
      "inputSettings": {
        "input": "srt://nimble.local:10001",
        "is_local_file": false
      }
    }
  ],
  "transitions": {
    "currentTransitionName": "Fade",
    "currentTransitionDuration": 300
  }
}
```

The `obsTemplateManager.applyTemplate()` method iterates over `template.scenes` expecting objects with `sceneName` properties, but receives strings instead. When it tries to access `scene.sceneName`, it gets `undefined`.

#### Issue #2: Frontend Shows "undefined" in Success Message

**File:** `show-controller/src/components/obs/TemplateManager.jsx:93`

```javascript
// Current code
const data = await response.json();
setSuccess(`Template applied successfully: ${data.scenesCreated} scenes created`);
```

**API response structure:**
```json
{
  "success": true,
  "result": {
    "scenesCreated": 0,
    "inputsCreated": 0,
    "transitionsConfigured": 0,
    "errors": []
  }
}
```

The frontend accesses `data.scenesCreated` but should access `data.result.scenesCreated`.

#### Issue #3: No Integration with Scene Generator

The existing `obsSceneGenerator.js` can dynamically create scenes based on camera configuration. Templates could leverage this instead of storing static scene snapshots.

---

## Requirements

### P0 - Critical Fixes

#### 1. Fix Frontend Response Handling

**File:** `show-controller/src/components/obs/TemplateManager.jsx`

**Changes:**
- Line 93: Fix success message to use `data.result.scenesCreated`
- Line 467 (ApplyTemplateModal): Fix scene count display to use `template.scenes?.length` for arrays of strings, or count scene objects

#### 2. Fix Template Data Structure

**Option A: Migrate to Full Scene Snapshots (Recommended for v1)**

Update the pre-seeded templates to include full scene/input configurations:

```json
{
  "id": "gymnastics-dual-v1",
  "name": "Gymnastics Dual Meet",
  "version": "1.1",
  "scenes": [
    {
      "sceneName": "Stream Starting Soon",
      "items": []
    },
    {
      "sceneName": "Full Screen - Camera A",
      "items": [
        {
          "sourceName": "Camera A",
          "inputKind": "ffmpeg_source",
          "sceneItemTransform": {
            "positionX": 0,
            "positionY": 0,
            "scaleX": 1,
            "scaleY": 1,
            "cropLeft": 0,
            "cropRight": 0,
            "cropTop": 0,
            "cropBottom": 0
          }
        },
        {
          "sourceName": "Graphics Overlay",
          "inputKind": "browser_source",
          "sceneItemTransform": {
            "positionX": 0,
            "positionY": 0,
            "scaleX": 1,
            "scaleY": 1
          }
        }
      ]
    }
  ],
  "inputs": [
    {
      "inputName": "Camera A",
      "inputKind": "ffmpeg_source",
      "inputSettings": {
        "input": "{{cameras.cameraA.srtUrl}}",
        "is_local_file": false,
        "buffering_mb": 2,
        "reconnect_delay_sec": 3
      }
    },
    {
      "inputName": "Graphics Overlay",
      "inputKind": "browser_source",
      "inputSettings": {
        "url": "{{config.graphicsOverlay.url}}",
        "width": 1920,
        "height": 1080,
        "css": ""
      }
    }
  ]
}
```

**Option B: Integrate with Scene Generator (Future Enhancement)**

Templates could specify parameters that feed into `obsSceneGenerator.js`:

```json
{
  "id": "gymnastics-dual-v1",
  "name": "Gymnastics Dual Meet",
  "generatorConfig": {
    "cameraCount": 2,
    "includeReplay": true,
    "includeGraphicsOnly": true,
    "transitions": {
      "type": "Fade",
      "duration": 300
    }
  }
}
```

This would call the scene generator with the config to create scenes dynamically.

### P1 - Validation & Error Handling

#### 3. Add Template Structure Validation

**File:** `server/lib/obsTemplateManager.js`

Add validation in `applyTemplate()`:

```javascript
async applyTemplate(templateId, context = {}) {
  const template = await this.getTemplate(templateId);

  // Validate template has proper structure
  if (!template.scenes || !Array.isArray(template.scenes)) {
    throw new Error('Template has no scenes defined');
  }

  // Check if scenes are objects (proper format) or strings (legacy format)
  const firstScene = template.scenes[0];
  if (typeof firstScene === 'string') {
    throw new Error('Template uses legacy format (scene names only). Please re-save the template from OBS.');
  }

  if (!firstScene.sceneName) {
    throw new Error('Template scenes missing sceneName property');
  }

  // Continue with apply...
}
```

#### 4. Improve Error Reporting

Return detailed errors to frontend when template apply fails:

```javascript
// In routes/obs.js POST /api/obs/templates/:id/apply
res.json({
  success: result.errors.length === 0,
  result,
  message: result.errors.length > 0
    ? `Template applied with ${result.errors.length} errors`
    : `Template applied: ${result.scenesCreated} scenes created`
});
```

### P2 - Template Management Improvements

#### 5. Re-generate Pre-seeded Templates

Create a script or admin function to:
1. Configure OBS with desired scenes/sources
2. Call `createTemplate()` to capture full state
3. Save as the official pre-seeded templates

#### 6. Template Preview in UI

Show what scenes/sources will be created before applying:

```
┌─ Apply Template ─────────────────────────────────────────┐
│                                                           │
│  Template: Gymnastics Dual Meet                           │
│                                                           │
│  This will create:                                        │
│  ─────────────────────────────────────────────────────   │
│  Scenes (9):                                              │
│    • Stream Starting Soon                                 │
│    • Full Screen - Camera A                               │
│    • Full Screen - Camera B                               │
│    • Dual View - Camera A - Left                          │
│    • Dual View - Camera A - Right                         │
│    • Web-graphics-only-no-video                           │
│    • Replay - Camera A                                    │
│    • Replay - Camera B                                    │
│    • End Stream                                           │
│                                                           │
│  Inputs (4):                                              │
│    • Camera A (SRT Source)                                │
│    • Camera B (SRT Source)                                │
│    • Graphics Overlay (Browser Source)                    │
│    • Background Music (Media Source)                      │
│                                                           │
│  ⚠️ Existing scenes will NOT be affected                  │
│                                                           │
│                          [Cancel] [Apply Template]        │
└───────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `show-controller/src/components/obs/TemplateManager.jsx` | Fix response handling, improve modal display |
| `server/lib/obsTemplateManager.js` | Add template validation, better error messages |
| `server/routes/obs.js` | Return detailed error info in response |
| Firebase: `templates/obs/gymnastics-dual-v1` | Migrate to full scene configuration |
| Firebase: `templates/obs/gymnastics-quad-v1` | Migrate to full scene configuration |

---

## API Changes

### POST /api/obs/templates/:id/apply

**Current Response:**
```json
{
  "success": true,
  "result": {
    "scenesCreated": 0,
    "inputsCreated": 0,
    "transitionsConfigured": 0,
    "errors": []
  }
}
```

**Updated Response (with better error info):**
```json
{
  "success": true,
  "result": {
    "scenesCreated": 9,
    "inputsCreated": 4,
    "transitionsConfigured": 1,
    "errors": [],
    "scenesSkipped": 0,
    "inputsSkipped": 2
  },
  "message": "Template applied: 9 scenes, 4 inputs created"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Template uses legacy format (scene names only). Please re-save the template from OBS.",
  "errorCode": "INVALID_TEMPLATE_FORMAT"
}
```

---

## Test Plan

### Manual Testing

1. **Test Apply with Fixed Templates**
   - Update template in Firebase with proper structure
   - Click Apply on template
   - Verify scenes appear in OBS
   - Verify success message shows correct count

2. **Test Save Template Flow**
   - Configure OBS with desired scenes
   - Click "Save Current as Template"
   - Verify saved template has full scene/input configurations
   - Apply the saved template to fresh OBS
   - Verify scenes/inputs are recreated correctly

3. **Test Error Handling**
   - Try to apply template with legacy format
   - Verify clear error message is shown
   - Try to apply template with missing inputs
   - Verify partial success with error details

### Automated Tests

Add tests to `server/__tests__/obsTemplateManager.test.js`:

```javascript
describe('applyTemplate validation', () => {
  it('should reject templates with string scene arrays', async () => {
    const legacyTemplate = {
      id: 'legacy',
      scenes: ['Scene 1', 'Scene 2']  // Legacy format
    };
    firebaseStore['templates/obs/legacy'] = legacyTemplate;

    await assert.rejects(
      async () => await templateManager.applyTemplate('legacy'),
      { message: /legacy format/ }
    );
  });

  it('should apply templates with proper scene objects', async () => {
    const properTemplate = {
      id: 'proper',
      scenes: [
        { sceneName: 'Scene 1', items: [] },
        { sceneName: 'Scene 2', items: [] }
      ]
    };
    firebaseStore['templates/obs/proper'] = properTemplate;

    const result = await templateManager.applyTemplate('proper');
    assert.equal(result.scenesCreated, 2);
  });
});
```

---

## Acceptance Criteria

- [ ] Clicking "Apply" on a properly-formatted template creates scenes in OBS
- [ ] Success message shows correct scene count (not "undefined")
- [ ] Legacy templates show clear error message explaining the issue
- [ ] Template modal shows preview of what will be created
- [ ] Save Template captures full scene/input configuration
- [ ] Pre-seeded templates updated with proper format
- [ ] All existing template tests still pass
- [ ] New validation tests pass

---

## Implementation Order

1. **P0 Fix #1:** Fix frontend response handling (5 min)
2. **P0 Fix #2:** Add template format validation with clear error (15 min)
3. **P0 Fix #3:** Update pre-seeded templates in Firebase (30 min)
4. **P1:** Improve error reporting in API (15 min)
5. **P2:** Add template preview to modal (30 min)
6. **Testing:** Manual + automated tests (30 min)

**Total Estimated Effort:** 2-3 hours

---

## Debugging Reference

### Check Template Format in Firebase
```bash
# Via MCP tool
firebase_get path="templates/obs/gymnastics-dual-v1"
```

### Check Coordinator Logs
```bash
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 100 --nostream | grep -i template"
```

### Test Template Apply API Directly
```bash
curl -X POST https://api.commentarygraphic.com/api/obs/templates/gymnastics-dual-v1/apply \
  -H "Content-Type: application/json" \
  -d '{"competitionId": "8kyf0rnl"}'
```

---

## Related Documents

- [PRD-OBS-08-Templates.md](../PRD-OBS-08-Templates/PRD-OBS-08-Templates.md) - Original templates PRD
- [README-OBS-Architecture.md](../README-OBS-Architecture.md) - OBS connection architecture
- [obsTemplateManager.js](../../server/lib/obsTemplateManager.js) - Template manager implementation
- [obsSceneGenerator.js](../../server/lib/obsSceneGenerator.js) - Scene generator (potential integration)
