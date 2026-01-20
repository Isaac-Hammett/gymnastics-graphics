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
| Task 3: Tri-Meet Support | 🔲 Not Started | |
| Task 4: Delete Confirmation | ✅ Complete | Inline popover implemented in `SceneList.jsx` |
| Task 5: CRUD Verification | 🔲 Not Started | End-to-end testing |

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

### Task 3: Add Tri-Meet Support

**Goal:** Generate scenes for tri-meets (3 cameras) derived from quad template pattern.

**Tri-meet scenes (derived from quad template):**
| Type | Count | Names |
|------|-------|-------|
| Static | 2 | Stream Starting Soon, End Stream |
| Full Screen | 3 | Camera A, B, C |
| Dual View | 3 | A&B, A&C, B&C |
| Triple View | 1 | ABC |
| Replay | 3 | Camera A, B, C |
| Graphics | 1 | Web-graphics-only-no-video |
| **Total** | **13** | |

**Implementation:**
- Detect competition type from `competitions/{compId}/config/type`
- Map competition types to camera counts:
  - `mens-dual`, `womens-dual` → 2 cameras (A, B)
  - `mens-tri`, `womens-tri` → 3 cameras (A, B, C)
  - `mens-quad`, `womens-quad` → 4 cameras (A, B, C, D)
- Generate appropriate scene combinations based on camera count

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

### Task 5: Verify Scene CRUD Operations

**Test matrix:**

| Operation | Socket Event | API Endpoint | Status |
|-----------|--------------|--------------|--------|
| List scenes | `obs:refreshState` | `GET /api/obs/scenes` | Verify |
| Create scene | `obs:createScene` | `POST /api/obs/scenes` | Verify |
| Duplicate scene | `obs:duplicateScene` | `POST /api/obs/scenes/:name/duplicate` | Verify |
| Rename scene | `obs:renameScene` | `PUT /api/obs/scenes/:name` | Verify |
| Delete scene | `obs:deleteScene` | `DELETE /api/obs/scenes/:name` | Verify |
| Switch scene | `switchScene` | - | Verify |

**Test environment:**
- Competition: `8kyf0rnl`
- URL: `https://commentarygraphic.com/8kyf0rnl/obs-manager`
- VM: `50.19.137.152:3003`
- Coordinator: `api.commentarygraphic.com`

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

4. **Task 5: CRUD verification** - End-to-end testing ← **NEXT**
   - Test all operations via UI

5. **Task 3: Tri-meet** - Add tri-meet support
   - Test with tri-meet competition type

---

## Acceptance Criteria

From [PRD-OBS-02-SceneManagement.md](PRD-OBS-02-SceneManagement.md#acceptance-criteria):

- [x] Scene categorization matches template naming conventions ✅ 2026-01-20
- [x] Scene generator creates scenes with template-matching names ✅ 2026-01-20
- [ ] Tri-meet scene generation works
- [x] Delete confirmation shows inline popover ✅ 2026-01-20
- [ ] All scene CRUD operations work end-to-end
- [ ] Multi-client sync works (changes reflect across browsers)
