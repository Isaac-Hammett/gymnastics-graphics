# OBS Integration Tool - PRD Index

**Last Updated:** 2026-01-20
**Original PRD:** `PRD-OBSIntegrationTool-2026-01-16.md`

---

## Overview

The comprehensive OBS Integration Tool PRD has been broken down into 10 smaller, focused PRDs. Each PRD is designed to be implemented and tested independently, with clear dependencies.

Each PRD now has its own folder with:
- `PRD-OBS-XX-FeatureName.md` - Requirements and acceptance criteria
- `IMPLEMENTATION-PLAN.md` - Task breakdown (Claude updates this)
- `prompt-OBS-XX-feature-name.md` - The prompt for the Ralph loop
- `OBS-XX-feature-name-run.sh` - The loop script
- `logs/` - Output log directory

---

## PRD Breakdown

| PRD | Title | Status | Priority | Effort |
|-----|-------|--------|----------|--------|
| [01](PRD-OBS-01-StateSync/) | State Sync Foundation | 🟢 COMPLETE | P0 | Small |
| [02](PRD-OBS-02-SceneManagement/) | Scene Management | 🟢 Working | P1 | Verify |
| [03](PRD-OBS-03-SourceManagement/) | Source Management | 🔴 **BROKEN** | P0 | Medium |
| [04](PRD-OBS-04-AudioManagement/) | Audio Management | 🟢 Working | P1 | Verify |
| [05](PRD-OBS-05-Transitions/) | Transitions | 🟡 UI Missing | P2 | Medium |
| [06](PRD-OBS-06-StreamRecording/) | Stream & Recording | 🟢 Working | P1 | Verify |
| [07](PRD-OBS-07-AssetManagement/) | Asset Management | 🟢 Working | P1 | Verify |
| [08](PRD-OBS-08-Templates/) | Template System | 🟡 Delete Broken | P1 | Small |
| [09](PRD-OBS-09-PreviewSystem/) | Preview System | 🔴 **BROKEN** | P1 | Medium |
| [10](PRD-OBS-10-TalentComms/) | Talent Communications | 🟢 Working | P2 | Verified |

---

## Dependency Graph

```
PRD-01: State Sync (FOUNDATION)
    │
    ├── PRD-02: Scenes ──────────┐
    │       │                    │
    │       └── PRD-03: Sources ─┼── PRD-08: Templates
    │                            │
    ├── PRD-04: Audio ───────────┘
    │
    ├── PRD-05: Transitions
    │
    ├── PRD-06: Stream/Recording
    │
    ├── PRD-07: Assets ─────────── PRD-08: Templates
    │
    ├── PRD-09: Preview
    │
    └── PRD-10: Talent Comms
```

---

## Recommended Implementation Order

### Phase A: Fix Foundation (Week 1)
1. **PRD-01: State Sync** - Fix event naming, remove duplicates
2. **PRD-03: Source Management** - Fix broken source editing (TEST-35/36)

### Phase B: Verify Working Features (Week 2)
3. **PRD-02: Scene Management** - Verify after state sync fix
4. **PRD-04: Audio Management** - Verify after state sync fix
5. **PRD-06: Stream & Recording** - Verify functionality
6. **PRD-07: Asset Management** - Already passing, quick verify

### Phase C: Fix Broken Features (Week 3)
7. **PRD-08: Templates** - Fix delete bug (TEST-47)
8. **PRD-09: Preview System** - Fix broken preview (TEST-41/42)

### Phase D: Complete Missing UI (Week 4)
9. **PRD-05: Transitions** - Build TransitionPicker component
10. **PRD-10: Talent Comms** - Test and verify VDO.Ninja flow

---

## Known Issues Summary

### Critical (Must Fix)
| Issue | PRD | Test | Description |
|-------|-----|------|-------------|
| Event name mismatch | 01 | - | `sceneChanged` vs `obs:sceneChanged` |
| Source editing broken | 03 | TEST-35, 36 | Browser/SRT source settings don't save |
| Template delete broken | 08 | TEST-47 | Delete API not working |
| Preview placeholder | 09 | TEST-41, 42 | UI shows hardcoded text |

### Medium (Should Fix)
| Issue | PRD | Description |
|-------|-----|-------------|
| Duplicate socket handler | 01 | `obs:refreshState` appears twice |
| No transitions UI | 05 | Shows "coming soon" placeholder |

### Low (Nice to Have)
| Issue | PRD | Description |
|-------|-----|-------------|
| Audio level meters | 04 | Real-time VU meters |
| Screenshot auto-refresh | 09 | Periodic preview updates |

---

## Test Status Summary

### Passing Tests ✅
- TEST-43: Asset upload works (music file)
- TEST-44: Asset delete works
- TEST-45: Asset categories filter correctly
- TEST-46: Template apply works

### Failing Tests ❌
- TEST-35: Browser source editing
- TEST-36: SRT/Media source editing
- TEST-41: Preview system
- TEST-47: Template delete works

### Skipped Tests ⏭️
- TEST-42: Studio mode
- Transition tests (placeholder)
- Talent comms tests

---

## Code Inventory

### Backend (server/)
| File | Lines | Status |
|------|-------|--------|
| `lib/obsStateSync.js` | 1,239 | Working |
| `lib/obsConnectionManager.js` | 311 | Working |
| `lib/obsSceneManager.js` | 219 | Working |
| `lib/obsSceneGenerator.js` | 782 | Working |
| `lib/obsSourceManager.js` | 596 | **Needs Fix** |
| `lib/obsAudioManager.js` | 486 | Working |
| `lib/obsTransitionManager.js` | 172 | Working |
| `lib/obsStreamManager.js` | 313 | Working |
| `lib/obsAssetManager.js` | 504 | Working |
| `lib/obsTemplateManager.js` | 652 | **Needs Fix** |
| `lib/talentCommsManager.js` | ~200 | Working |
| `routes/obs.js` | 2,229 | Mostly Working |

### Frontend (show-controller/src/)
| File | Status |
|------|--------|
| `context/OBSContext.jsx` | **Event names need fix** |
| `pages/OBSManager.jsx` | Working |
| `components/obs/SceneList.jsx` | Working |
| `components/obs/SceneEditor.jsx` | Working |
| `components/obs/SourceEditor.jsx` | **Needs Fix** |
| `components/obs/AudioMixer.jsx` | Working |
| `components/obs/AudioPresetManager.jsx` | Working |
| `components/obs/StreamConfig.jsx` | Working |
| `components/obs/AssetManager.jsx` | Working |
| `components/obs/TemplateManager.jsx` | **Delete Broken** |
| `components/obs/TalentCommsPanel.jsx` | Working |
| `components/obs/TransitionPicker.jsx` | **Missing** |
| `components/obs/OBSCurrentOutput.jsx` | **Placeholder Only** |

---

## Success Metrics

When all PRDs are complete:
- [ ] All 47+ tests passing
- [ ] No console errors related to OBS events
- [ ] Multi-client sync works reliably
- [ ] All UI tabs functional (no placeholders)
- [ ] End-to-end flow tested with real OBS instance

---

## Related Documents

- [Original PRD](PRD-OBSIntegrationTool-2026-01-16.md) - Full specification
- [CLAUDE.md](../CLAUDE.md) - MCP tools and deploy instructions
