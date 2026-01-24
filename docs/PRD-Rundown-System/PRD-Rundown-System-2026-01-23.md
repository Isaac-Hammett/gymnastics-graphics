# PRD: Rundown System

**Version:** 1.0
**Date:** 2026-01-23
**Status:** Active

---

## 1. Problem Statement

The production system has two disconnected pieces:

1. **Rundown Editor** - UI for planning show segments (exists, works)
2. **Timesheet Engine** - Server-side show execution (code exists, not wired)

Producers can create rundowns but cannot execute them. There's no bridge between planning and execution, and the engine doesn't support multiple simultaneous competitions.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Connect Planning to Execution** | Load saved rundowns into the execution engine |
| **Multi-Competition Support** | Run multiple shows independently on different VMs |
| **Talent Support** | Simplified view for commentators |
| **Rehearsal Capability** | Dry-run shows without firing real graphics/OBS |

---

## 3. User Stories

### Story 1: Producer Creates a Rundown

**As a** Producer planning a UCLA vs Oregon meet
**I want to** create segments in the Rundown Editor
**So that** I have a structured plan for the show

**Flow:**
1. Navigate to `/{compId}/rundown`
2. Add segments (Pre-Show Graphics, Welcome, Team Introductions, etc.)
3. Assign scenes, graphics, timing to each segment
4. Click Save
5. Segments saved to Firebase

**Status:** ✅ Works today

---

### Story 2: Producer Loads Rundown for Execution

**As a** Producer ready to run the show
**I want to** load my saved rundown into the execution engine
**So that** I can start the show with all my segments ready

**Flow:**
1. Navigate to `/{compId}/producer` (Producer View)
2. See "No rundown loaded" indicator
3. Click "Load Rundown" button
4. Segments appear in the "Show Progress" panel
5. See "Rundown loaded: 24 segments" confirmation
6. "Start Show" button becomes active

**Status:** ❌ Not implemented

---

### Story 3: Producer Runs the Show

**As a** Producer executing a live broadcast
**I want** segments to progress automatically or manually
**So that** the show flows smoothly with proper timing

**Flow:**
1. Click "Start Show"
2. First segment activates:
   - Timer counts down
   - OBS switches to assigned scene
   - Graphics fire if configured
   - Progress bar shows completion
3. Auto-advance segments progress automatically
4. Manual segments wait for producer to click "Next"
5. Show continues through all segments

**Status:** ⚠️ Engine logic exists, but can't load segments

---

### Story 4: Multiple Competitions Run Independently

**As a** Production company running two meets simultaneously
**I want** each competition to have independent show control
**So that** one show doesn't interfere with the other

**Scenario:**
- Competition A: UCLA vs Oregon on VM 50.19.137.152
- Competition B: Stanford vs Cal on VM 54.210.98.89

**Expected behavior:**
- Each producer sees only their competition's segments
- OBS commands route to the correct VM
- No interference between shows

**Status:** ❌ Not implemented (single global engine)

---

### Story 5: Producer Reloads Modified Rundown (Pre-Show)

**As a** Producer who made last-minute changes before starting
**I want to** reload the rundown after editing
**So that** I can incorporate changes before the show begins

**Flow:**
1. Show is loaded but not started
2. Open Rundown Editor in new tab, make changes, save
3. Return to Producer View
4. Click "Reload Rundown"
5. Updated segments appear

**Status:** ❌ Not implemented

---

### Story 6: Producer Runs Rehearsal

**As a** Producer preparing for a show
**I want to** run through the show without firing real graphics or OBS
**So that** I can verify timing and flow before going live

**Flow:**
1. Load rundown
2. Enable "Rehearsal Mode"
3. Start show - segments progress with timing
4. OBS and graphics do NOT fire
5. "REHEARSAL" indicator visible throughout

**Status:** ❌ Not implemented

---

### Story 7: Talent Views Their Segments

**As a** Commentator
**I want** a simplified view showing my current segment and time remaining
**So that** I can pace my commentary appropriately

**Flow:**
1. Navigate to `/{compId}/talent`
2. See current segment with large countdown timer
3. See notes for current segment
4. See preview of next segment
5. Quick scene-switch buttons available

**Status:** ❌ Not implemented

---

### Story 8: Producer Modifies Rundown During Live Show

**As a** Producer running a live broadcast
**I want to** add, remove, or modify upcoming segments mid-show
**So that** I can adapt to unexpected situations (injury, schedule change, breaking news)

**Flow:**
1. Show is running, currently on segment 12 of 24
2. Producer opens Rundown Editor in a new tab
3. Adds a new segment between 15 and 16 (e.g., "Breaking: Injury Update")
4. Saves changes
5. Returns to Producer View
6. Sees "Rundown Modified" warning badge
7. Clicks "Reload Rundown"
8. Confirmation dialog: "Reload will add 1 segment. Current position preserved."
9. Confirms → segment list updates, show continues from current position

**Edge Cases:**
- Current segment was deleted → Stay on it until manual advance, warn producer
- Segments before current were reordered → Ignore past segments, preserve position
- Multiple producers editing simultaneously → Last-write-wins with conflict warning

**Status:** ❌ Not implemented (Phase I)

---

## 4. Phase Overview

| Phase | Name | Priority | Goal |
|-------|------|----------|------|
| **A** | Connect Editor to Engine | P0 | Load rundown, execute show, multi-competition support |
| **H** | Rehearsal Mode | P1 | Dry-run without firing OBS/graphics |
| **B** | Talent View | P1 | Simplified commentator interface |
| **I** | Live Rundown Sync | P2 | Hot-reload changes during show |
| **J** | Timing Analytics | P2 | Track actual vs planned duration |
| **D** | AI Suggestions (Planning) | P2 | Suggest segments based on competition context |
| **E** | Script & Talent Flow | P2 | Pipe scripts to Talent View |
| **C** | AI Context (Live) | P3 | Real-time talking points during show |
| **F** | Audio Cue Integration | P3 | Trigger audio from segments |
| **G** | Production Tracking | P3 | Equipment and sponsor reports |

---

## 5. Success Criteria

### Phase A Complete When:
- [ ] Producer can click "Load Rundown" and segments appear in Producer View
- [ ] "Start Show" begins execution with loaded segments
- [ ] Segment progression works (auto-advance and manual)
- [ ] OBS scene switching works when segment changes
- [ ] Graphics fire when segment has a graphic configured
- [ ] Changes in Rundown Editor can be re-loaded
- [ ] Two competitions can run independently without interference

### Phase H Complete When:
- [x] Rehearsal mode runs full show without firing OBS/graphics
- [x] "REHEARSAL" indicator visible in all views
- [x] Timing proceeds normally for practice

### Phase B Complete When:
- [x] Talent View accessible at `/{compId}/talent`
- [x] Shows current segment with prominent time remaining
- [x] Scene switching buttons work
- [x] Notes visible to talent

### Phase I Complete When:
- [x] Producer sees "Rundown Modified" warning badge when rundown changes during show
- [x] "Reload Rundown" updates segments without losing current position
- [x] Confirmation dialog shows summary of changes (added/removed/modified segments)
- [x] Deleted current segment is handled gracefully (stay on it, warn producer)
- [x] Past segments (already completed) are not affected by reload

### Phase J Complete When:
- [ ] Actual segment durations logged during show
- [ ] Historical timing data available in Rundown Editor

---

## 6. Terminology

| Term | Definition |
|------|------------|
| **Segment** | A unit of show content (e.g., "UCLA Introduction", "Rotation 1 Start") |
| **Rundown** | The complete list of segments for a show |
| **Rundown Editor** | UI for creating/editing segments (`/{compId}/rundown`) |
| **Timesheet Engine** | Server-side code that executes the show |
| **Producer View** | Full production control page (`/{compId}/producer`) |
| **Talent View** | Simplified commentator interface (`/{compId}/talent`) |
| **Hold Segment** | A segment that waits for manual advance |
| **Coordinator** | Central server managing all competitions |
| **Competition VM** | EC2 instance assigned to a competition (runs OBS) |

---

## 7. Related Documents

| Document | Purpose |
|----------|---------|
| [PLAN-Rundown-System-2026-01-23.md](./PLAN-Rundown-System-2026-01-23.md) | Implementation details, architecture, task breakdown |
| [PRD-Rundown-01-EditorPrototype/](../PRD-Rundown-01-EditorPrototype/) | Rundown Editor UI implementation (Phases 0-12) |
