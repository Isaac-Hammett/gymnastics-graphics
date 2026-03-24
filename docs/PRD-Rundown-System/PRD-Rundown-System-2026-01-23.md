# PRD: Rundown System

**Version:** 1.0
**Date:** 2026-01-23
**Status:** Complete (implementation), Partial (validation)
**Last Validated:** 2026-02-01

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

### Validation Summary (2026-02-01)

| Story | Description | Status | Blocker |
|-------|-------------|--------|---------|
| 1 | Producer Creates a Rundown | ✅ Validated | — |
| 2 | Producer Loads Rundown for Execution | ✅ Validated | BUG-011 FIXED |
| 3 | Producer Runs the Show | ✅ Validated | BUG-011, BUG-018 FIXED |
| 4 | Multiple Competitions Run Independently | ⚠️ Not tested | Architecture in place, needs multi-comp test |
| 5 | Producer Reloads Modified Rundown | ✅ Validated | — |
| 6 | Producer Runs Rehearsal | ✅ Validated | — |
| 7 | Talent Views Their Segments | ⚠️ Partial | BUG-012: wrong competition name in header |
| 8 | Producer Modifies Rundown During Live Show | ✅ Validated | — |
| 9 | Producer Views Wall-Clock Times | ✅ Validated | — |

---

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

**Status:** ✅ Validated — works today (pre-existing)

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

**Status:** ✅ Validated (Phase A) — BUG-011 fixed. Load Rundown button visible, segments load into engine, Start Show button activates.

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

**Status:** ✅ Validated (Phase A) — BUG-011 and BUG-018 fixed. Show starts, segments progress with timing, Pause/Resume/Stop/Next all functional via timesheet engine.

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

**Status:** ⚠️ Implemented (Phase A) but **not explicitly validated** — Map-based engine instances, per-competition OBS connections, and room-scoped socket broadcasts are all in place. Needs a manual test with two simultaneous competitions to confirm no cross-talk.

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

**Status:** ✅ Validated (Phase I) — Firebase listener detects changes, warning badge appears, reload preserves position.

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

**Status:** ✅ Validated (Phase H) — rehearsal mode skips OBS/graphics, banner visible, timing logged to Firebase.

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
5. Control buttons: **PREV** (previous segment), **PAUSE/RESUME**, **NEXT** (advance segment)
6. Quick scene-switch buttons available
7. "SHOW PAUSED" banner appears when show is paused

**Controls:**
- **PREV** (gray) — Go to previous segment (disabled at first segment)
- **PAUSE** (yellow) — Pause the show timer (changes to green **RESUME** when paused)
- **NEXT** (blue) — Advance to next segment (respects hold segment timing)
- All controls disabled when producer has locked talent controls

**Status:** ⚠️ Implemented (Phase B + E) but **partially blocked by BUG-012** — header shows legacy `showConfig.showName` instead of actual competition name. Core functionality (timer, notes, next segment, scene buttons, control buttons) works. See [BUGS.md](./BUGS.md#bug-012).

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

**Status:** ✅ Validated (Phase I) — all edge cases implemented and tested. Deep diff, confirmation dialog, position preservation all working.

---

### Story 9: Producer Views Wall-Clock Times Across Timezones

**As a** Producer planning a broadcast with teams and crew across different timezones
**I want to** see segment start times displayed in multiple timezones
**So that** I can coordinate timing with remote talent, production crew, and broadcast partners

**Flow:**
1. Open Rundown Editor
2. Click "Timezone" button in toolbar
3. Set anchor segment (e.g., "Rotation 1") and anchor time (e.g., "11:05 AM")
4. Select primary timezone (e.g., "Pacific Time")
5. Add additional display timezones (e.g., "Mountain", "Central", "Eastern")
6. Save configuration
7. Segment list now shows wall-clock times in all selected timezones
8. Anchor segment highlighted with "Anchor" badge
9. Pre-anchor segments show earlier times (calculated backwards)
10. Post-anchor segments show later times (calculated forwards)

**Example Display:**
```
#   Offset    PT        MT        CT        ET        Segment
1   0:00      10:45 AM  11:45 AM  12:45 PM  1:45 PM   Pre-Show Graphics
2   0:15      11:00 AM  12:00 PM  1:00 PM   2:00 PM   Welcome
3   0:20      11:05 AM  12:05 PM  1:05 PM   2:05 PM   Rotation 1 [Anchor]
4   0:36      11:21 AM  12:21 PM  1:21 PM   2:21 PM   Rotation 1 Ends
```

**Status:** ✅ Validated (Phase K) — anchor config, multi-timezone columns, presets, CSV/JSON export, midnight crossing all working.

---

### Story 10: Producer Reviews Rundown in Visual Preview Tool

**As a** Producer who has built a rundown
**I want to** browse, search, and inspect every graphic and clip in the show
**So that** I can verify everything looks correct before going live, and share the visual plan with talent and stakeholders

**Core Concept:**
This is a **review tool first, slideshow second**. The primary experience is a searchable, filterable visual catalog of every segment in the rundown. Each segment renders its actual production output — using the same `output.html` and overlay rendering code used in OBS — so what you see in the preview is exactly what goes to air.

**Flow:**
1. Navigate to `/{compId}/rundown` (Rundown Editor)
2. Click "Export Preview" button in toolbar
3. System generates a self-contained HTML page with all segment data, graphic configs, clip metadata, team logos, and theme CSS baked in
4. Page opens in new tab (or downloads as shareable HTML file)

**Preview Page Layout:**

*Search & Filter Bar (top):*
- Text search across segment names, graphic types, team names, talent names, apparatus, athlete names, scripts
- Filter by segment type: graphic, clip, live camera, break/content sequence, moment replay, hold/manual
- Filter by graphic type: logos, roster, event-bar, event-summary, sponsors, etc.
- Filter by rotation, talent assignment, apparatus

*Segment List (main area):*
- Each segment rendered as a card showing:
  - Live-rendered thumbnail of the graphic/clip output (the actual graphic at smaller scale, not a screenshot)
  - Segment name, type, and duration
  - OBS scene label
  - Talent assignments and script notes
- Click any card to expand to **full-size 16:9 preview** with animated background behind it — exactly as it would appear on stream

*Segment Type Cards:*

| Segment Type | What the card shows |
|---|---|
| **Graphic** (logos, roster, event-bar, event-summary, sponsors, etc.) | Rendered graphic using existing `output.html` / overlay code with meet theme applied |
| **Clip** (athlete routine replay) | Clip metadata — athlete name, team, apparatus, camera angle, clip duration |
| **Live camera** | Camera number, apparatus, score bug state |
| **Break / content sequence** | Rotation break content — sponsor cycle, rotation slate, warm-up graphic, etc. |
| **Moment replay** | Flagged moment details — apparatus, timestamp, speed, seek point |
| **Hold / manual** | Segment info with "awaiting producer advance" indicator |

*Playback Mode (secondary):*
- Play / Pause / Restart buttons
- Scrub bar to jump to any point in the show
- Speed controls (0.5x, 1x, 2x) for faster review
- Auto-advances through the full segment list sequentially
- Current segment highlighted in the list as playback progresses

**Rendering Architecture — CRITICAL:**
- All graphics render through the **same `output.html` and overlay HTML files** used in production
- The preview page feeds `currentGraphic` data to `output.html` via iframe, identical to how Firebase drives it in production
- No new rendering code — one rendering path for both production and preview
- Meet theme CSS variables baked into the export so graphics match production appearance

**Data Handling:**
- All segment data, graphic configurations, clip metadata, team logos, headshots, and theme settings embedded at export time
- No server or Firebase connection required at playback time — fully offline/shareable
- Applies the competition's active meet theme

**Use Cases:**
- Producer reviews the full show plan visually — verify every graphic looks correct
- QA pass: filter to "all sponsor graphics" and verify branding, or "all rosters" and check headshots
- Share with talent so they see the graphic flow alongside their scripts
- Send to clients/stakeholders for rundown approval
- Post-show archive of what was planned

**Status:** ✅ Complete (verification pending human review)

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
| **K** | Timezone Display | P2 | Wall-clock times in multiple timezones |
| **L** | Rundown Preview & Review Tool | P2 | Searchable visual catalog of all production output — graphics, clips, cameras, breaks — using existing rendering code |

---

## 5. Success Criteria

### Phase A Complete When:
- [x] Producer can click "Load Rundown" and segments appear in Producer View
- [x] "Start Show" begins execution with loaded segments
- [x] Segment progression works (auto-advance and manual)
- [x] OBS scene switching works when segment changes
- [x] Graphics fire when segment has a graphic configured
- [x] Changes in Rundown Editor can be re-loaded
- [x] Two competitions can run independently without interference

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
- [x] Actual segment durations logged during show
- [x] Historical timing data available in Rundown Editor

### Phase E Complete When:
- [x] Script field added to segment data model
- [x] Script displayed in Talent View (teleprompter-style)
- [x] Talent assignment field added to segment data model
- [x] Talent schedule view available in Rundown Editor
- [x] "You're on camera" indicator shows in Talent View when talent is assigned to current segment

### Phase L Complete When:
- [x] "Export Preview" button available in Rundown Editor toolbar
- [x] Exported HTML is fully self-contained (works offline, no Firebase dependency)
- [x] Segment list displays all segments as cards with live-rendered graphic thumbnails
- [x] Text search filters segments by name, graphic type, team, talent, apparatus, athlete
- [x] Filter controls for segment type (graphic, clip, live, break, replay, hold)
- [x] Click any card to expand full-size 16:9 preview with animated background
- [x] Graphics render via existing `output.html` / overlay code (no duplicate rendering)
- [x] All segment types supported: graphics, clips, live camera, breaks, moment replays, holds
- [x] Clip segments show athlete, team, apparatus, camera angle, duration metadata
- [x] Play/Pause/Restart playback mode auto-advances through segments sequentially
- [x] Click-to-jump on any segment in the list
- [x] Speed controls (0.5x, 1x, 2x) work in playback mode
- [x] Competition's active meet theme applied (CSS variables baked in)
- [x] Team logos, headshots, and graphic data embedded at export time
- [x] Exported file is shareable (can be opened by anyone with a browser)

### Phase K Complete When:
- [x] Timezone configuration stored per-rundown in Firebase
- [x] Producer can set anchor segment and anchor datetime
- [x] Producer can configure primary timezone and additional display timezones
- [x] Segment list displays wall-clock times in all configured timezones
- [x] Anchor segment shows visual "Anchor" badge
- [x] Pre-anchor segment times calculated backwards from anchor
- [x] Timezone columns included in CSV/JSON export
- [x] Timezone configuration persists across page refresh

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
| **Rundown Template** | A saved rundown that can be loaded into new competitions |

---

## 7. Rundown Templates

### Template Compatibility

Templates are compatible based on **gender only** — team count is flexible.

| Current Competition | Compatible Templates |
|---------------------|---------------------|
| `womens-dual` | Any women's template (dual, tri, quad, 5, 6) |
| `womens-tri` | Any women's template |
| `womens-quad` | Any women's template |
| `mens-dual` | Any men's template |
| `mens-tri` | Any men's template |

**Rationale:** Producers should be able to load any same-gender template and adapt it by adding or removing segments. A quad template loaded into a tri meet will have some team references that don't resolve (e.g., `{team4}`), but this is preferable to blocking the template entirely.

**Changed:** 2026-02-08 — Removed team count restriction. Previously, templates were blocked if `template.teamCount > competition.teamCount`.

---

## 8. Related Documents

| Document | Purpose |
|----------|---------|
| [PLAN-Rundown-System-2026-01-23.md](./PLAN-Rundown-System-2026-01-23.md) | Implementation details, architecture, task breakdown |
| [PRD-Rundown-01-EditorPrototype/](../PRD-Rundown-01-EditorPrototype/) | Rundown Editor UI implementation (Phases 0-12) |
