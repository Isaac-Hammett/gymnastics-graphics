# PRD-OBS-02: Scene Management

**Version:** 1.2
**Date:** 2026-01-18
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 (State Sync)
**Blocks:** PRD-OBS-03 (Source Management)

---

## Overview

Complete scene management including:
1. **Scene CRUD** - Create, read, update, delete scenes
2. **Scene Item CRUD** - Add, remove, transform, reorder sources within scenes
3. **Scene Generation** - Auto-generate scenes from competition/camera config
4. **Scene Switching** - Change active scene, studio mode preview/program

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Template scene tracking | **Option A** - Store in Firebase (`competitions/{compId}/obs/templateScenes/`) |
| Delete confirmation | **Yes** - Add confirmation modal for scene deletion |

---

## Current State

### What Exists

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `server/lib/obsSceneManager.js` | 219 | Scene CRUD logic | ✅ Working |
| `server/lib/obsSceneGenerator.js` | 782 | Auto-generate scenes | ✅ Working |
| `server/lib/obsStateSync.js` | - | Scene categorization | ⚠️ Missing `template` category |
| `server/routes/obs.js` | - | Scene & Scene Item API endpoints | ✅ Working |
| `server/index.js` | - | Scene generation endpoints | ✅ Working |
| `show-controller/src/components/obs/SceneList.jsx` | 682 | Scene list UI | ⚠️ Category mismatch |
| `show-controller/src/components/obs/SceneEditor.jsx` | - | Scene item editing | ✅ Working |

### Test Results
- Scene creation: ✅ Working
- Scene duplication: ✅ Working
- Scene deletion: ✅ Working
- Scene renaming: ✅ Working
- Scene reordering: ⚠️ Client-side only (OBS limitation)
- Scene categorization: ⚠️ Frontend/backend mismatch
- Scene generation: ✅ Working
- Scene item add/remove: ✅ Working
- Scene item transform: ⚠️ Needs verification

---

## Known Issue: Category Mismatch

### Backend Categories (obsStateSync.js:20-26)

```javascript
export const SCENE_CATEGORY = {
  GENERATED_SINGLE: 'generated-single',
  GENERATED_MULTI: 'generated-multi',
  STATIC: 'static',
  GRAPHICS: 'graphics',
  MANUAL: 'manual'
  // MISSING: TEMPLATE
};
```

### Frontend Categories (SceneList.jsx:70-77)

Has 6 categories including `template`, but uses wrong prefix inference (`GS-`, `GM-` instead of `Single - `, `Dual - `).

### Solution
1. Add `TEMPLATE` category to backend
2. Store template-created scenes in Firebase
3. Remove frontend fallback inference

---

## Requirements

### Requirement 1: Fix Category Sync

**Backend (obsStateSync.js):**
```javascript
export const SCENE_CATEGORY = {
  GENERATED_SINGLE: 'generated-single',
  GENERATED_MULTI: 'generated-multi',
  STATIC: 'static',
  GRAPHICS: 'graphics',
  MANUAL: 'manual',
  TEMPLATE: 'template'  // ADD
};
```

**Update `categorizeScene()`:**
```javascript
// Check if scene is in templateScenes list (from Firebase)
if (this.templateScenes?.includes(sceneName)) {
  return SCENE_CATEGORY.TEMPLATE;
}
```

**Frontend (SceneList.jsx):**
Remove fallback inference at lines 87-93. Always trust `scene.category`.

### Requirement 2: Track Template-Created Scenes in Firebase

**Firebase Path:** `competitions/{compId}/obs/templateScenes/`

When creating a scene from template:
1. Create scene in OBS
2. Add scene name to `templateScenes` array in Firebase
3. State sync picks it up and categorizes correctly

### Requirement 3: Add Delete Confirmation Modal

Add confirmation modal to SceneList.jsx:
- Show scene name
- Warn if scene has sources (they won't be deleted)
- Confirm/Cancel buttons

---

## Scene CRUD Operations

### Scene-Level Operations

| Operation | API | Socket | UI | Status |
|-----------|-----|--------|-----|--------|
| List scenes | `GET /api/obs/scenes` | `obs:refreshState` | SceneList | ✅ |
| Get scene | `GET /api/obs/scenes/:name` | - | SceneEditor | ✅ |
| Create scene | `POST /api/obs/scenes` | `obs:createScene` | Create modal | ✅ |
| Duplicate scene | `POST /api/obs/scenes/:name/duplicate` | `obs:duplicateScene` | Duplicate btn | ✅ |
| Rename scene | `PUT /api/obs/scenes/:name` | `obs:renameScene` | Rename btn | ✅ |
| Delete scene | `DELETE /api/obs/scenes/:name` | `obs:deleteScene` | Delete btn | ✅ (needs confirm) |
| Reorder scenes | `PUT /api/obs/scenes/reorder` | `obs:reorderScenes` | Drag-drop | ⚠️ Visual only |
| Switch scene | - | `switchScene` | Click scene | ✅ |
| Set preview | - | `setPreviewScene` | Eye icon (studio) | ✅ |

### Scene Generation Operations

| Operation | API | Purpose | Status |
|-----------|-----|---------|--------|
| Generate all | `POST /api/scenes/generate` | Create all scenes from config | ✅ |
| Generate specific | `POST /api/scenes/generate` (with types) | Create specific scene types | ✅ |
| Preview generation | `GET /api/scenes/preview` | Preview what would be created | ✅ |
| Delete generated | `DELETE /api/scenes/generated` | Remove all generated scenes | ✅ |

**Generated Scene Types:**
- `static`: Starting Soon, BRB, Thanks for Watching
- `single`: Single camera scenes (one per camera)
- `dual`: Dual camera combinations
- `triple`: Triple camera combinations
- `quad`: Quad camera layout
- `graphics-fullscreen`: Full-screen graphics overlay

### Scene Item Operations (Sources within a Scene)

| Operation | API | Socket | UI | Status |
|-----------|-----|--------|-----|--------|
| List items | `GET /api/obs/scenes/:name/items` | - | SceneEditor | ✅ |
| Add source | `POST /api/obs/scenes/:name/items` | `obs:addSourceToScene` | Add btn | ✅ |
| Remove item | `DELETE /api/obs/scenes/:name/items/:id` | `obs:deleteSceneItem` | Remove btn | ✅ |
| Set transform | `PUT /api/obs/scenes/:name/items/:id/transform` | `obs:applyTransformPreset` | Position/scale | ⚠️ Verify |
| Set enabled | `PUT /api/obs/scenes/:name/items/:id/enabled` | `obs:toggleItemVisibility` | Eye toggle | ✅ |
| Set locked | `PUT /api/obs/scenes/:name/items/:id/locked` | `obs:toggleItemLock` | Lock toggle | ✅ |
| Reorder items | `PUT /api/obs/scenes/:name/items/reorder` | `obs:reorderSceneItems` | Drag-drop | ✅ |

---

## API Endpoints Summary

### Scene Endpoints (`/api/obs/scenes/*`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/scenes` | List all scenes |
| GET | `/api/obs/scenes/:sceneName` | Get scene details |
| POST | `/api/obs/scenes` | Create scene |
| POST | `/api/obs/scenes/:sceneName/duplicate` | Duplicate scene |
| PUT | `/api/obs/scenes/:sceneName` | Rename scene |
| PUT | `/api/obs/scenes/reorder` | Reorder scenes |
| DELETE | `/api/obs/scenes/:sceneName` | Delete scene |

### Scene Item Endpoints (`/api/obs/scenes/:sceneName/items/*`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/obs/scenes/:sceneName/items` | List scene items |
| POST | `/api/obs/scenes/:sceneName/items` | Add source to scene |
| DELETE | `/api/obs/scenes/:sceneName/items/:itemId` | Remove item |
| PUT | `/api/obs/scenes/:sceneName/items/:itemId/transform` | Update transform |
| PUT | `/api/obs/scenes/:sceneName/items/:itemId/enabled` | Toggle visibility |
| PUT | `/api/obs/scenes/:sceneName/items/:itemId/locked` | Toggle lock |
| PUT | `/api/obs/scenes/:sceneName/items/reorder` | Reorder items |

### Scene Generation Endpoints (`/api/scenes/*`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/scenes/generate` | Generate scenes from config |
| GET | `/api/scenes/preview` | Preview what would be generated |
| DELETE | `/api/scenes/generated` | Delete all generated scenes |

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/lib/obsStateSync.js` | Add `TEMPLATE` category, load templateScenes from Firebase |
| `show-controller/src/components/obs/SceneList.jsx` | Remove fallback inference, add delete confirmation modal |
| `server/routes/obs.js` or scene creation | Store template scene names in Firebase |

---

## Acceptance Criteria

### Scene CRUD
- [ ] Create empty scene → appears in OBS and UI
- [ ] Create scene from template → stored in Firebase templateScenes, category = `template`
- [ ] Duplicate scene → new scene has all sources
- [ ] Rename scene → name updates everywhere
- [ ] Delete scene → confirmation modal shown, then removed
- [ ] Reorder scenes → visual update (client-side)

### Scene Generation
- [ ] Generate all scenes → creates static, single, dual, triple, quad, graphics scenes
- [ ] Preview generation → shows what would be created without creating
- [ ] Delete generated → removes all generated scenes

### Scene Items
- [ ] Add source to scene → appears in scene
- [ ] Remove source from scene → removed (input still exists)
- [ ] Transform source → position/scale updates in OBS
- [ ] Toggle visibility → source shows/hides
- [ ] Toggle lock → source locks/unlocks
- [ ] Reorder sources → z-order updates

### Categories
- [ ] Backend has 6 categories including `template`
- [ ] Frontend trusts backend category (no guessing)
- [ ] Template-created scenes tracked in Firebase

### UI
- [ ] Delete confirmation modal works
- [ ] All scene actions work from UI
- [ ] All scene item actions work from SceneEditor

---

## Test Plan

### Manual Tests - Scenes
1. Navigate to OBS Manager → Scenes tab
2. Create blank scene → verify in "Manual" category
3. Create scene from template → verify in "Template" category
4. Duplicate scene → verify copy created
5. Rename scene → verify name changes
6. Delete scene → verify confirmation modal → verify removed
7. Click scene → verify OBS switches
8. Enable studio mode → verify preview/program behavior

### Manual Tests - Scene Generation
1. Go to scene generation UI (or use API)
2. Generate all scenes → verify created in OBS
3. Preview generation → verify list shown
4. Delete generated → verify removed

### Manual Tests - Scene Items
1. Click scene → open SceneEditor
2. Add source to scene → verify appears
3. Move/scale source → verify transform updates
4. Toggle visibility → verify shows/hides
5. Toggle lock → verify locks/unlocks
6. Reorder sources → verify z-order changes
7. Remove source → verify removed from scene (not deleted)

### Automated Tests
```bash
npm test -- --grep "Scene"
```

---

## Definition of Done

1. All scene CRUD operations work
2. All scene item operations work
3. Scene generation works
4. Categories sync correctly (including `template`)
5. Template scenes tracked in Firebase
6. Delete confirmation modal implemented
7. Multi-client sync works
8. Tests pass
9. Code reviewed and merged
