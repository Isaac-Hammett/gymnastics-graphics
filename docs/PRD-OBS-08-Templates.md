# PRD-OBS-08: Template System

**Version:** 1.0
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 through PRD-OBS-07 (all prior)
**Blocks:** None

---

## Overview

OBS template system - save/load scene collections as reusable templates with variable substitution. **Template apply works**, but **template delete is BROKEN** (TEST-47 failed).

> **Architecture Note:** All template operations flow through the **coordinator** (api.commentarygraphic.com). The frontend never connects directly to OBS or competition VMs. See [README-OBS-Architecture.md](README-OBS-Architecture.md) for details.

---

## Current State

### What Exists
- `server/lib/obsTemplateManager.js` (652 lines) - Template operations
- `show-controller/src/components/obs/TemplateManager.jsx` - Template UI
- Routes: GET/POST/PUT/DELETE `/api/obs/templates/*`

### Test Results
- Template apply: ✅ TEST-46 PASSED
- Template delete: ❌ TEST-47 FAILED

### Suspected Issue
Template delete may not properly clean up Firebase references or may have a path issue.

---

## Requirements

### 1. Template Operations

**Test Cases:**
- [ ] Create template from current OBS state
- [ ] List available templates
- [ ] View template details
- [ ] Apply template to OBS
- [ ] Update template metadata
- [ ] **FIX: Delete template** (currently broken)

### 2. Template Schema

**Firebase Path:** `templates/obs/{templateId}`

```json
{
  "id": "gymnastics-standard-v2",
  "name": "Gymnastics Standard",
  "version": "2.0",
  "description": "Standard 4-camera setup",
  "meetTypes": ["mens-dual", "womens-dual"],
  "createdAt": "2026-01-10T10:00:00Z",
  "updatedAt": "2026-01-15T14:00:00Z",
  "createdBy": "producer@example.com",

  "requiredAssets": {
    "music": ["intro", "break", "outro"],
    "stingers": ["main"],
    "backgrounds": ["brb", "starting-soon"]
  },

  "sceneCollection": {
    "scenes": [...],
    "transitions": [...]
  }
}
```

### 3. Variable Substitution

Templates use variables that resolve at apply time:

| Variable | Source | Example |
|----------|--------|---------|
| `{{assets.music.intro}}` | Asset manifest | `/var/www/assets/music/intro.mp3` |
| `{{assets.stingers.main}}` | Asset manifest | `/var/www/assets/stingers/main.webm` |
| `{{cameras.cam1.srtUrl}}` | Camera config | `srt://nimble.local:10001` |
| `{{config.graphicsOverlay.url}}` | Show config | `http://localhost:5173/graphics` |
| `{{competition.name}}` | Competition | `UCLA vs Oregon` |

### 4. Template Apply Flow

```
Frontend → Coordinator → Competition VM's OBS
```

1. Frontend emits `obs:applyTemplate` via Socket.io to coordinator
2. Coordinator looks up VM for the competition (`vmAddress` in Firebase)
3. Coordinator validates required assets exist on the target VM
4. Coordinator resolves all variables for the competition context
5. Coordinator sends OBS WebSocket commands to VM (ws://VM-IP:4455)
6. Clear existing scenes (optional)
7. Create scenes from template
8. Apply transitions
9. Coordinator broadcasts updated state to all frontend clients

### 5. Fix Template Delete

**Debug Steps:**
1. Check `obsTemplateManager.js` `deleteTemplate()` method
2. Verify Firebase path is correct
3. Check if template ID is being passed correctly
4. Verify permissions

---

## Files to Fix

| File | Issue |
|------|-------|
| `server/lib/obsTemplateManager.js` | Fix `deleteTemplate()` |
| `server/routes/obs.js` | Verify DELETE endpoint |
| `show-controller/src/components/obs/TemplateManager.jsx` | Verify delete calls API correctly |

---

## API Endpoints

> **Note:** In production, these endpoints are served by the **coordinator** at `https://api.commentarygraphic.com`. The frontend NEVER connects directly to competition VMs.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/templates` | List templates |
| GET | `/api/obs/templates/:templateId` | Get template |
| POST | `/api/obs/templates` | Create template |
| POST | `/api/obs/templates/:templateId/apply` | Apply template to competition VM |
| PUT | `/api/obs/templates/:templateId` | Update metadata |
| DELETE | `/api/obs/templates/:templateId` | **FIX: Delete** |

**Apply Template Flow:**
```
Frontend → POST https://api.commentarygraphic.com/api/obs/templates/:id/apply
         ↓
Coordinator → ws://VM-IP:4455 (OBS WebSocket commands)
         ↓
Competition VM OBS applies template
```

---

## UI Design

### TemplateManager.jsx

```
┌─ TEMPLATES ──────────────────────────────────────────┐
│                                                       │
│  [Save Current Setup as Template]                    │
│                                                       │
│  ─── Available Templates ───────────────────────────  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Gymnastics Standard v2.0          [Apply] [🗑️]  │ │
│  │ Standard 4-camera setup                         │ │
│  │ Meet types: mens-dual, womens-dual              │ │
│  │ Created: 2026-01-10                             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Triple Layout v1.0                [Apply] [🗑️]  │ │
│  │ 2 cameras on top, 1 centered bottom             │ │
│  │ Meet types: mens-dual, womens-dual              │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Save Template Modal

```
┌─ Save as Template ───────────────────────────────────┐
│                                                       │
│  Template Name: [My Custom Layout                  ] │
│                                                       │
│  Description:                                         │
│  [2 cameras on top, 1 centered bottom              ] │
│                                                       │
│  Compatible Meet Types:                               │
│  [✓] mens-dual    [✓] womens-dual                   │
│  [✓] mens-tri     [✓] womens-tri                    │
│  [ ] mens-quad    [ ] womens-quad                   │
│                                                       │
│  ─── What Will Be Saved ────────────────────────────  │
│  Scenes: 8 | Sources: 12 | Transitions: 3           │
│                                                       │
│                         [Cancel] [Save Template]     │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Debugging Template Delete

### Test the API directly:

**Production (via coordinator):**
```bash
# List templates
curl https://api.commentarygraphic.com/api/obs/templates

# Delete template
curl -X DELETE https://api.commentarygraphic.com/api/obs/templates/gymnastics-standard-v2
```

**Local development:**
```bash
# List templates (local server on port 3001)
curl http://localhost:3001/api/obs/templates

# Delete template
curl -X DELETE http://localhost:3001/api/obs/templates/gymnastics-standard-v2
```

### Check Firebase Console:
1. Navigate to `templates/obs/`
2. Verify template exists before delete
3. After delete, verify it's removed

### Check Coordinator Logs:
```bash
# Via MCP tool
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 50"

# Look for template-related errors
```

### Common Issues:
- Wrong Firebase path (`templates/obs/` vs `competitions/{compId}/obs/templates/`)
- Template ID URL encoding issues
- Missing error handling
- Coordinator not forwarding request to correct VM

---

## Acceptance Criteria

- [ ] Create template from current state
- [ ] List templates works
- [ ] Apply template creates scenes correctly
- [ ] Variable substitution works
- [ ] Missing assets reported as errors
- [ ] **Delete template works (FIX)**
- [ ] Templates persist in Firebase

---

## Test Plan

### Failing Test to Fix
```javascript
// TEST-47: Template delete works
test('can delete template', async () => {
  // Create a test template
  // Delete it
  // Verify it's gone from list
});
```

### Manual Verification
1. Create template from current setup
2. Verify it appears in list
3. Apply to fresh competition → verify scenes created
4. Delete template → verify removed from list

---

## Definition of Done

1. TEST-47 passes (template delete)
2. All template operations work
3. Variable substitution works
4. Missing asset validation works
5. Code reviewed and merged

---

## Architecture Reference

For complete details on how the frontend, coordinator, and competition VMs communicate, see [README-OBS-Architecture.md](README-OBS-Architecture.md).

**Key points:**
- Frontend connects to `api.commentarygraphic.com` (coordinator) via Socket.io
- Coordinator maintains OBS WebSocket connections to competition VMs
- OBS port 4455 is localhost-only on VMs (not publicly accessible)
- Template operations are routed through the coordinator based on `compId`
