# PRD-OBS-05: Transitions - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** Not Started

---

## Priority Order

### P0 - Create TransitionPicker Component

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create TransitionPicker.jsx component | NOT STARTED | Currently shows "coming soon" placeholder |
| 2 | List available transitions from OBS state | NOT STARTED | Read from `obs:stateUpdated` |
| 3 | Implement transition selection | NOT STARTED | `obs:setCurrentTransition` socket event |
| 4 | Implement duration slider/input | NOT STARTED | `obs:setTransitionDuration` socket event |

### P1 - Socket Event Handlers

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Add `obs:setCurrentTransition` handler in server/index.js | NOT STARTED | Verify handler exists |
| 6 | Add `obs:setTransitionDuration` handler in server/index.js | NOT STARTED | Verify handler exists |
| 7 | Add transition methods to OBSContext.jsx | NOT STARTED | Emit socket events |

### P2 - Stinger Configuration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8 | Implement stinger path configuration | NOT STARTED | Video file path |
| 9 | Implement transition point configuration | NOT STARTED | Frame where new scene appears |
| 10 | Test stinger transition plays correctly | NOT STARTED | Manual verification |

### P3 - Multi-client Sync

| # | Task | Status | Notes |
|---|------|--------|-------|
| 11 | Verify transition changes sync to other clients | NOT STARTED | Via coordinator broadcast |

---

## Source Files to Create/Modify

### Frontend (Create)
- `show-controller/src/components/obs/TransitionPicker.jsx` - **CREATE**

### Frontend (Modify)
- `show-controller/src/context/OBSContext.jsx` - Add transition methods
- `show-controller/src/pages/OBSManager.jsx` - Integrate TransitionPicker

### Backend (Verify/Add)
- `server/index.js` - Socket handlers for transition events
- `server/lib/obsTransitionManager.js` - Transition logic (local dev)

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-20
- Created implementation plan

---

## Related Files Changed

| File | Change Description | Commit |
|------|-------------------|--------|
| - | - | - |
