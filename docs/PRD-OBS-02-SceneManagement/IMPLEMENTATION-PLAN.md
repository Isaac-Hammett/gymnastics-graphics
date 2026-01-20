# PRD-OBS-02 Scene Management - Implementation Plan

**Created:** 2026-01-20
**Last Updated:** 2026-01-20
**Status:** In Progress
**PRD:** [PRD-OBS-02-SceneManagement.md](PRD-OBS-02-SceneManagement.md)

---

## Progress Summary

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Scene Categorization | ✅ Complete | Already implemented in both `index.js` and `obsStateSync.js` |
| Task 2: Generator Naming | ✅ Complete | Already uses template-matching names in `obsSceneGenerator.js` |
| Task 3: Tri-Meet Support | ✅ Complete | Already implemented in `obsSceneGenerator.js` via camera-count logic |
| Task 4: Delete Confirmation | ✅ Complete | Inline popover implemented in `SceneList.jsx` |
| Task 5: CRUD Verification | ✅ Complete | All operations verified 2026-01-20 |

---

## Source References

### Architecture Documentation
- [README-OBS-Architecture.md](../README-OBS-Architecture.md) - OBS connection architecture, coordinator proxy pattern
- [Scene Templates](../README-OBS-Architecture.md#scene-templates) - Template file locations and scene types

### Template Files (Production Reference)
- `server/config/sceneTemplates/20260119-obs-template-ai-dual.json` - Dual meet (9 scenes, 2 cameras)
- `server/config/sceneTemplates/20260119-obs-template-ai-quad.json` - Quad meet (22 scenes, 4 cameras)

**Note:** Do NOT read the template JSON files - they are large OBS exports (300KB+) that will consume context unnecessarily. The PRD already summarizes the relevant naming conventions and scene counts.

### Key Source Files
| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `server/index.js` | Scene categorization, broadcastOBSState | `categorizeSceneByName()` at line 2313 |
| `server/lib/obsSceneGenerator.js` | Programmatic scene generation | Transform presets, scene naming |
| `server/lib/obsStateSync.js` | SCENE_CATEGORY constants | Line 20-27 |
| `show-controller/src/components/obs/SceneList.jsx` | Scene list UI, delete modal | Lines 37-46 (delete modal state) |

---

## Implementation Tasks

### Task 1: Update Scene Categorization to Match Template Naming ✅ COMPLETE

**Goal:** Align `categorizeSceneByName()` with template naming conventions.

**Status:** Already implemented. Both functions support all template naming patterns.

**Verified patterns (tested 2026-01-20):**

| Scene Name | Category | Status |
|------------|----------|--------|
| `Stream Starting Soon` | `static` | ✅ |
| `End Stream` | `static` | ✅ |
| `Full Screen - Camera A` | `generated-single` | ✅ |
| `Full Screen - Camera B` | `generated-single` | ✅ |
| `Replay - Camera A` | `generated-single` | ✅ |
| `Replay - Camera B` | `generated-single` | ✅ |
| `Dual View - Camera A - Left` | `generated-multi` | ✅ |
| `Dual View - Camera A - Right` | `generated-multi` | ✅ |
| `Triple View - ABC` | `generated-multi` | ✅ |
| `Quad View` | `generated-multi` | ✅ |
| `Web-graphics-only-no-video` | `graphics` | ✅ |
| Generic names (e.g., "Scene") | `manual` | ✅ |

**Implementation locations:**
- `server/index.js:2313-2366` - `categorizeSceneByName()` for coordinator/production
- `server/lib/obsStateSync.js:775-828` - `categorizeScene()` for local development

Both functions handle:
- Template patterns: `full screen -`, `replay -`, `dual view`, `triple view`, `quad view`
- Legacy patterns: `single -`, `dual -`, `triple -`, `quad -`
- Static scenes: `starting soon`, `end stream`, `brb`, `thanks for watching`
- Graphics: `web-graphics-only`, `graphics-only`, `graphics fullscreen`
- Template tracking via Firebase `templateScenes` array

---

### Task 2: Update Scene Generator Naming ✅ COMPLETE

**Goal:** Update `obsSceneGenerator.js` to generate scenes with template-matching names.

**Status:** Already implemented. The generator uses template-matching names.

**Verified naming patterns (verified 2026-01-20):**

| Scene Type | Generated Name | Status |
|------------|----------------|--------|
| Single camera | `Full Screen - Camera A` | ✅ (line 368) |
| Dual (2 cams) | `Dual View - Camera A - Left/Right` | ✅ (line 438) |
| Dual (3+ cams) | `Dual View - Camera A & Camera B` | ✅ (line 478) |
| Triple | `Triple View - Camera A B C` | ✅ (line 516) |
| Quad | `Quad View` | ✅ (line 560) |
| Replay | `Replay - Camera A` | ✅ (line 402) |
| Static | `Stream Starting Soon`, `End Stream` | ✅ (lines 137-138) |
| Graphics | `Web-graphics-only-no-video` | ✅ (line 624) |

**Implementation location:**
- `server/lib/obsSceneGenerator.js` - All naming already matches templates

---

### Task 3: Add Tri-Meet Support ✅ COMPLETE

**Goal:** Generate scenes for tri-meets (3 cameras) derived from quad template pattern.

**Status:** Already implemented. The scene generator is camera-count aware and generates appropriate scenes for any number of cameras (2, 3, 4+). Verified 2026-01-20.

**Tri-meet scenes (when 3 cameras configured):**
| Type | Count | Names |
|------|-------|-------|
| Static | 2 | Stream Starting Soon, End Stream |
| Full Screen | 3 | Camera A, B, C |
| Dual View | 3 | A&B, A&C, B&C |
| Triple View | 1 | ABC |
| Replay | 3 | Camera A, B, C |
| Graphics | 1 | Web-graphics-only-no-video |
| **Total** | **13** | |

**Implementation details:**
- `obsSceneGenerator.js` uses `getCombinations()` to generate all scene variations based on camera count
- Lines 815-821: For 3+ cameras, generates dual combinations (A&B, A&C, B&C)
- Lines 825-831: For 3+ cameras, generates triple combinations (ABC)
- `previewScenes()` method accurately predicts scene counts for any camera configuration
- No competition type detection needed - scene generation is purely camera-count based

**Note:** Users configure cameras directly in Firebase (`competitions/{compId}/production/cameras`). The generator adapts to any number of cameras automatically.

---

### Task 4: Inline Delete Confirmation ✅ COMPLETE

**Goal:** Add inline confirmation popover when deleting scenes.

**Status:** Implemented 2026-01-20. Converted center modal to inline popover.

**Implementation details:**
- Removed `DeleteConfirmationModal` component (was centered modal)
- Added inline popover inside `SceneCard` component
- Popover positioned near delete button using `absolute right-0 top-full`
- Shows scene name and source count
- Cancel/Delete buttons with loading state

**State changes:**
- Replaced `showDeleteModal` + `sceneToDelete` with single `deletePopoverScene` (scene name or null)
- Popover toggled by clicking delete button
- Only one popover can be open at a time

**UI result:**
```
┌─────────────────────────────────┐
│ Delete "Scene Name"?            │
│ This scene has 3 sources.       │
│           [Cancel] [Delete]     │
└─────────────────────────────────┘
```

**Files modified:**
- `show-controller/src/components/obs/SceneList.jsx`

---

### Task 5: Verify Scene CRUD Operations ✅ COMPLETE

**Status:** All operations verified 2026-01-20 via end-to-end testing.

**Test matrix:**

| Operation | Socket Event | API Endpoint | Status |
|-----------|--------------|--------------|--------|
| List scenes | `obs:refreshState` | `GET /api/obs/scenes` | ✅ Verified |
| Create scene | `obs:createScene` | `POST /api/obs/scenes` | ✅ Verified |
| Duplicate scene | `obs:duplicateScene` | `POST /api/obs/scenes/:name/duplicate` | ✅ Verified |
| Rename scene | `obs:renameScene` | `PUT /api/obs/scenes/:name` | ✅ Verified |
| Delete scene | `obs:deleteScene` | `DELETE /api/obs/scenes/:name` | ✅ Verified |
| Switch scene | `switchScene` | - | ✅ Verified |
| Multi-client sync | - | - | ✅ Verified |

**Test environment:**
- Competition: `8kyf0rnl`
- URL: `https://commentarygraphic.com/8kyf0rnl/obs-manager`
- VM: `50.19.137.152:3003`
- Coordinator: `api.commentarygraphic.com`

**Test results (2026-01-20):**

1. **List scenes** - Page loaded with 6 scenes, all categorized as "Manual"
2. **Create scene** - Created "CRUD Test Scene - Delete Me", scene count increased to 7
3. **Duplicate scene** - Duplicated to "CRUD Test Scene - Delete Me Copy", scene count increased to 8
4. **Rename scene** - Renamed copy to "CRUD Renamed Scene - Delete Me"
5. **Switch scene** - Successfully switched active scene, LIVE badge updated
6. **Delete scene** - Inline popover confirmation worked, scene removed, count decreased
7. **Multi-client sync** - Opened second browser tab, scene switch in tab 2 reflected immediately in tab 1

**Notes:**
- One transient OBS connection drop observed during testing (auto-recovered on Refresh)
- Delete confirmation has two-stage flow: inline popover + browser confirm dialog
- All console logs showed expected event emissions and state updates

---

## Deployment Steps

Per [CLAUDE.md](../../CLAUDE.md#deploy-to-production-commentarygraphiccom):

### Frontend (show-controller)
```bash
cd show-controller && npm run build
tar -czf /tmp/claude/dist.tar.gz -C dist .
# ssh_upload_file to 3.87.107.201
# ssh_exec to extract
```

### Backend (coordinator)
```bash
ssh_exec target="coordinator" command="cd /opt/gymnastics-graphics && sudo git pull --rebase origin dev && pm2 restart coordinator"
```

### Verification
- Browser test at `https://commentarygraphic.com/8kyf0rnl/obs-manager`
- Check console for errors
- Verify scene categories display correctly
- Test CRUD operations

---

## Implementation Order

1. ~~**Task 1: Categorization** - Fix naming patterns in `server/index.js`~~ ✅ **COMPLETE**
   - Already implemented and verified 2026-01-20

2. ~~**Task 2: Generator naming** - Update `obsSceneGenerator.js`~~ ✅ **COMPLETE**
   - Already implemented with template-matching names, verified 2026-01-20

3. ~~**Task 4: Delete confirmation** - Update `SceneList.jsx`~~ ✅ **COMPLETE**
   - Converted center modal to inline popover, verified 2026-01-20

4. ~~**Task 5: CRUD verification** - End-to-end testing~~ ✅ **COMPLETE**
   - All 6 operations verified via UI, multi-client sync confirmed 2026-01-20

5. ~~**Task 3: Tri-meet** - Add tri-meet support~~ ✅ **COMPLETE**
   - Already implemented - scene generator is camera-count aware, verified 2026-01-20

---

## Acceptance Criteria

From [PRD-OBS-02-SceneManagement.md](PRD-OBS-02-SceneManagement.md#acceptance-criteria):

- [x] Scene categorization matches template naming conventions ✅ 2026-01-20
- [x] Scene generator creates scenes with template-matching names ✅ 2026-01-20
- [x] Tri-meet scene generation works ✅ 2026-01-20 (already implemented via camera-count logic)
- [x] Delete confirmation shows inline popover ✅ 2026-01-20
- [x] All scene CRUD operations work end-to-end ✅ 2026-01-20
- [x] Multi-client sync works (changes reflect across browsers) ✅ 2026-01-20

---

## PRD-OBS-02 COMPLETE ✅

All tasks and acceptance criteria have been verified as complete as of 2026-01-20.
