# PRD-OBS-05: Transition Management - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** In Progress
**PRD:** [PRD-OBS-05-Transitions.md](../PRD-OBS-05-Transitions/PRD-OBS-05-Transitions.md)

---

## Priority Items

### 1. [HIGH] Add Socket.io Handlers for Transition Events
**Status:** NOT STARTED
**Files:**
- `server/index.js` (~lines 2500-3100 socket handlers section)

**Tasks:**
- [ ] Add `obs:getTransitions` handler
- [ ] Add `obs:setCurrentTransition` handler
- [ ] Add `obs:setTransitionDuration` handler
- [ ] Add `obs:setTransitionSettings` handler

**Reference:** PRD Section "Socket Events (Production Architecture)" - Frontend → Coordinator Events

---

### 2. [HIGH] Update broadcastOBSState to Include Transitions
**Status:** NOT STARTED
**Files:**
- `server/index.js` (~line 2500 broadcastOBSState function)

**Tasks:**
- [ ] Fetch transition list from OBS (`GetSceneTransitionList`)
- [ ] Add `transitions` and `currentTransition` to obsState broadcast

---

### 3. [HIGH] Create TransitionPicker.jsx Component
**Status:** NOT STARTED
**Files:**
- `show-controller/src/components/obs/TransitionPicker.jsx` (CREATE)

**Tasks:**
- [ ] Create component with UI per PRD design spec
- [ ] Show list of available transitions
- [ ] Dropdown to select current transition
- [ ] Duration input field
- [ ] Wire up to OBSContext methods

**Reference:** PRD Section "UI Design - TransitionPicker.jsx"

---

### 4. [MEDIUM] Update OBSContext.jsx with Transition Methods
**Status:** NOT STARTED
**Files:**
- `show-controller/src/context/OBSContext.jsx` (lines 170-173, 327-340)

**Tasks:**
- [ ] Add `setCurrentTransition` method (emit `obs:setCurrentTransition`)
- [ ] Add `setTransitionDuration` method (emit `obs:setTransitionDuration`)
- [ ] Add `getTransitions` method (emit `obs:getTransitions`)
- [ ] Ensure `transitions` state is exposed from `obsState`

---

### 5. [MEDIUM] Integrate TransitionPicker into OBSManager
**Status:** NOT STARTED
**Files:**
- `show-controller/src/pages/OBSManager.jsx` (~line 295-300)

**Tasks:**
- [ ] Import TransitionPicker component
- [ ] Replace placeholder with TransitionPicker in transitions tab

---

## Completed Items

(None yet)

---

## Bugs Found During Implementation

(None yet)

---

## Verification Checklist

- [ ] OBS Manager shows transitions tab with TransitionPicker
- [ ] Available transitions are listed
- [ ] Selecting a transition updates OBS
- [ ] Duration slider/input works
- [ ] Changes sync across browser tabs

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/index.js:2500` | broadcastOBSState function |
| `server/index.js:2520+` | Socket.io handlers |
| `server/lib/obsTransitionManager.js` | Transition logic (local dev only) |
| `show-controller/src/context/OBSContext.jsx` | Frontend state management |
| `show-controller/src/pages/OBSManager.jsx:295` | Transitions tab placeholder |
