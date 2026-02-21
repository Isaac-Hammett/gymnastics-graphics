# Implementation Plan: Team Scores Bug

**Version:** 1.3
**Date:** 2026-01-31
**Status:** In Progress
**PRD:** [PRD-Team-Scores-Bug-2026-01-31.md](./PRD-Team-Scores-Bug-2026-01-31.md)

---

## Quick Task Index

**Next task: Find first `NOT STARTED` or `IN PROGRESS` below.**

| Task | Description | Status | Target File | Reference Pattern |
|------|-------------|--------|-------------|-------------------|
| A1 | Create team-bug.html boilerplate | COMPLETE | `overlays/team-bug.html` | `overlays/event-bar.html` |
| A1b | Initialize Firebase schema | COMPLETE | `overlays/team-bug.html` | PLAN 3.3 |
| A2 | Load competition config from Firebase | COMPLETE | `overlays/team-bug.html` | `output.html:4450` |
| A3 | Implement Virtius API polling | COMPLETE | `overlays/team-bug.html` | `output.html:4478` |
| A3b | Write incremental deltas to Firebase | COMPLETE | `overlays/team-bug.html` | PLAN 1.3 | Added processApiData(), buildScoreMap(), buildTeamTotalMap() |
| A3c | API error handling + backoff | COMPLETE | `overlays/team-bug.html` | — | Added exponential backoff (5s→60s max), writes error state to Firebase for D5b |
| A3d | Offline/reconnect behavior | COMPLETE | `overlays/team-bug.html` | — | Added Firebase .info/connected listener, safeWrite() wrapper, pending write queue |
| A4 | Team row rendering | COMPLETE | `overlays/team-bug.html` | `overlays/event-bar.html` | Added updateTeamTotal(), updateAllTeamTotals() with highlight animation |
| A5 | Score diff engine | COMPLETE | `overlays/team-bug.html` | PLAN 1.3 | Added flash queue system: triggerScoreFlash(), interruptFlash(), isFlashActive(), displayNextFlash(), advanceFlashQueue(), renderFlash(), clearFlashDisplay(). Score changes now trigger queued flashes per-team with correction detection. |
| A6 | Slot machine animation | COMPLETE | `overlays/team-bug.html` | CSS keyframes | Added slotSpinIn/slotSpinOut keyframes, updated renderFlash() with insertFlashContent() and triggerSpinIn() helpers |
| A7 | Score flash renderer | COMPLETE | `overlays/team-bug.html` | `overlays/event-bar.html` | Enhanced insertFlashContent() with start value display, score formatting (3 decimals), separator dot |
| A8 | Per-team flash queue | COMPLETE | `overlays/team-bug.html` | — | Already implemented in A5: state.flashQueues[teamIndex], 10s hold, clearFlashDisplay() on empty |
| A9 | Team total highlight | COMPLETE | `overlays/team-bug.html` | CSS animation | Already implemented in A4: .team-total.highlight with totalPulse keyframes, applied in updateTeamTotal() |
| A10 | Rotation tag renderer | COMPLETE | `overlays/team-bug.html` | PLAN 1.5 | Added detectRotation(), updateRotationTag(), writes to Firebase |
| A11 | Bug enter/exit animation | COMPLETE | `overlays/team-bug.html` | `overlays/event-bar.html` | Already implemented: CSS transition on .score-bug (translateX slide-in from right), .visible class toggled by updateBugVisibility() |
| A12 | Firebase listener: enabled | COMPLETE | `overlays/team-bug.html` | `output.html:200-300` | Already implemented: line 654-657, calls updateBugVisibility() |
| A12b | Firebase listener: polling | COMPLETE | `overlays/team-bug.html` | — | Already implemented: line 660-668, starts/stops polling on change |
| A12c | Firebase listener: dismissFlash | COMPLETE | `overlays/team-bug.html` | — | Implemented handleFlashDismissals() - clears active flash, advances queue, removes dismissal flag |
| A13 | Flash queue edge cases | COMPLETE | `overlays/team-bug.html` | — | Added: (1) Correction detection for gymnasts already in queue - updates entry instead of duplicating, (2) Max queue size cap of 6 entries with FIFO eviction |
| B1 | Now-competing detection | COMPLETE | `overlays/team-bug.html` | `GraphicsControl.jsx:216-269` | Added detectNowCompeting(), detectAllNowCompeting(), calls in processApiData(), writes to Firebase detected/nowCompeting |
| B2 | Now-competing slot state | COMPLETE | `overlays/team-bug.html` | — | Added renderNowCompeting(), insertNowCompetingContent(), getEventShortCode(), clearNowCompeting(), updateAllNowCompeting() |
| B3 | Auto mode | COMPLETE | `overlays/team-bug.html` | — | updateAllNowCompeting() shows detected now-competing automatically in auto mode. Mode change triggers immediate update. |
| B4 | Manual mode | COMPLETE | `overlays/team-bug.html` | — | In manual mode, now-competing only shown when manualNowCompeting[teamIndex]=true. Uses detected data but requires producer enable. |
| B5 | Now competing → flash transition | COMPLETE | `overlays/team-bug.html` | — | clearFlashDisplay() now checks for now-competing to restore after flash ends. Added getNowCompetingForTeam() helper that respects auto/manual mode. |
| B6 | Firebase listener: automationMode | COMPLETE | `overlays/team-bug.html` | — | Listener at line 672-682, calls updateAllNowCompeting() on mode change |
| B7 | Firebase listener: nowCompeting | COMPLETE | `overlays/team-bug.html` | — | Listener at line 685-700, converts teamKey to index, stores in state.manualNowCompeting, triggers updateAllNowCompeting() |
| B8 | Write detected state to Firebase | COMPLETE | `overlays/team-bug.html` | — | Already implemented in B1 (line 1083): safeWrite to detected/nowCompeting |
| C1 | Lineup card HTML/CSS | COMPLETE | `overlays/team-bug.html` | — | Already implemented: HTML placeholder (line 367-369), CSS styles (lines 245-347) with header, athletes list, footer, slide animation |
| C2 | Lineup card populate | COMPLETE | `overlays/team-bug.html` | — | Added updateLineupCard(), findCurrentEventForLineup(), renderLineupCardContent(). Uses state.lastApiTeams, matches showLineup to team short_name, displays athletes sorted by order with SV/score. |
| C3 | Lineup card animation | COMPLETE | `overlays/team-bug.html` | — | Already implemented in C1: CSS transition on .lineup-card (translateY slide-up + opacity), .visible class toggled by updateLineupCard() |
| C4 | Firebase listener: showLineup | COMPLETE | `overlays/team-bug.html` | — | Already implemented: line 706-709, listens to showLineup, calls updateLineupCard() |
| C5 | Lineup live-update | COMPLETE | `overlays/team-bug.html` | — | Added updateLineupCard() call at end of processApiData() when showLineup is set, so lineup scores update on each API poll |
| D1 | ScoreBugPanel component | COMPLETE | `show-controller/src/components/ScoreBugPanel.jsx` | `AlertPanel.jsx` | Created collapsible panel with Firebase listener, ON status indicator, follows AlertPanel pattern |
| D2 | Add panel to ProducerView | COMPLETE | `show-controller/src/views/ProducerView.jsx` | — | Added import and component placement after AlertPanel. Also updated ScoreBugPanel to import db directly from firebase lib (consistent with other components). |
| D2b | Copy URL button | COMPLETE | `show-controller/src/components/ScoreBugPanel.jsx` | — | Added overlayUrl generation, copyUrl() with clipboard API, visual feedback (CheckIcon for 2s) |
| D3 | On/off toggle | COMPLETE | `show-controller/src/components/ScoreBugPanel.jsx` | — | Added toggleEnabled(), "Show Bug" toggle switch writes to Firebase enabled state |
| D3b | Polling toggle | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D3c | Poll frequency selector | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D3d | Heartbeat indicator | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D3e | Stale data indicator | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D4 | Auto/manual toggle | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D5 | Now-competing display | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D5b | API error indicator | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D5c | Dismiss flash button | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D6 | SHOW/HIDE now-competing | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D7 | Lineup card controls | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D8 | Write showLineup | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D9 | Write nowCompeting | NOT STARTED | `show-controller/src/components/ScoreBugPanel.jsx` | — |
| D10 | Migrate GraphicsControl | NOT STARTED | `show-controller/src/components/GraphicsControl.jsx` | — |
| E1 | Load headshots | NOT STARTED | `overlays/team-bug.html` | `output.html:5048-5110` |
| E2 | Headshot normalization | NOT STARTED | `overlays/team-bug.html` | `nameNormalization.js` |
| E3 | Headshots in flash | NOT STARTED | `overlays/team-bug.html` | — |
| E4 | Headshots in now-competing | NOT STARTED | `overlays/team-bug.html` | — |
| E5 | Headshot fallback | NOT STARTED | `overlays/team-bug.html` | — |
| F1 | Stick detection | NOT STARTED | `overlays/team-bug.html` | `output.html:4742` |
| F2 | Stick indicator UI | NOT STARTED | `overlays/team-bug.html` | — |
| F3 | Men's only conditional | NOT STARTED | `overlays/team-bug.html` | — |
| G1 | 3-team layout | NOT STARTED | `overlays/team-bug.html` | — |
| G2 | 4-team layout | NOT STARTED | `overlays/team-bug.html` | — |
| G3 | 5-6 team layout | NOT STARTED | `overlays/team-bug.html` | — |
| G4 | Multi-team testing | NOT STARTED | `overlays/team-bug.html` | — |
| G5 | OBS browser source test | NOT STARTED | — | — |

**Progress:** 4 COMPLETE / 0 IN PROGRESS / 56 NOT STARTED

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD-Team-Scores-Bug-2026-01-31.md](./PRD-Team-Scores-Bug-2026-01-31.md) | Product requirements |

---

## 1. Architecture Overview

### 1.1 System Components

```
OVERLAY PAGE (single Virtius poller)     FIREBASE                    PRODUCER PANEL (no polling)
────────────────────────────────────     ────────                    ──────────────────────────
overlays/team-bug.html                   competitions/{compId}/      Show Controller React app
├── Polls Virtius API (5-10s)            scoreBug/                   ├── ScoreBugPanel component
├── Writes DELTAS to FB ───────→         ├── enabled                 ├── Collapsible panel in right col
├── Writes heartbeat to FB ────→         ├── heartbeat ──────────→   ├── Heartbeat indicator (G/Y/R)
├── Score diff engine (gymnast_id)       ├── automationMode          ├── On/Off toggle + Copy URL
├── Slot machine renderer                ├── showLineup              ├── Auto/Manual toggle
├── Headshot resolver                    ├── dismissFlash ←────────  ├── DISMISS flash buttons
├── Lineup card renderer                 ├── nowCompeting            ├── Reads detected/ & liveData/
├── Writes detected state to FB ──→      ├── detected/ ──────────→  ├── SHOW/HIDE buttons
├── Reads dismissFlash from FB ←───      ├── liveData/ ──────────→  └── Lineup card controls
└── Firebase listener ←─────────────     ├── lastError
                                         └── config/
```

**Single poller architecture:** Only the overlay polls Virtius. After each poll, it writes **only
changed data** (incremental deltas via `firebase.update()`) to `scoreBug/liveData/` — NOT the full
API response. This is critical for Firebase free tier limits over a 2-3 hour competition.
Both the producer panel and GraphicsControl's Athlete Spotlight feature read from this Firebase
path — no other component polls Virtius directly.
The overlay also writes detected "now competing" athletes to `scoreBug/detected/` and a heartbeat
timestamp on every poll cycle.
Producer actions (SHOW/HIDE, toggle, lineup, dismiss flash) write to Firebase, which the overlay
picks up via listeners.

**Note:** This is the first overlay to use Firebase. Existing overlays use URL parameters only.
The overlay must initialize the Firebase SDK and establish realtime listeners.

### 1.2 Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  VIRTIUS API                                                         │
│  GET /session/{sessionId}/json                                      │
│  Polled every 5-10 seconds (by overlay ONLY)                        │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  SCORE DIFF ENGINE (in team-bug.html)                                │
│  ├── Compare previous poll vs current poll (keyed by gymnast_id)     │
│  ├── Convert final_score strings to floats for comparison            │
│  ├── Detect new scores → trigger score flash (per-team queue)       │
│  ├── Detect score corrections → interrupt active flash, re-flash    │
│  ├── Detect "now competing" → next athlete without score            │
│  ├── Infer rotation (min completed events across ALL teams + 1)     │
│  ├── Write DELTAS to Firebase (scoreBug/liveData/) — not full data  │
│  ├── Write heartbeat + stale poll count to Firebase                  │
│  ├── Write detected state to Firebase (scoreBug/detected/)          │
│  ├── Read dismissFlash from Firebase → clear active flash           │
│  └── On API error: keep stale data, backoff, write to lastError     │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
┌──────────────────────────┐  ┌────────────────────────────────────────────┐
│  FIREBASE                 │  │  RENDERERS (in overlay)                    │
│  scoreBug/liveData/       │  │  ├── Team Row Renderer (logo + total)     │
│  scoreBug/detected/       │  │  ├── Score Flash Renderer (+ headshot)    │
│  scoreBug/lastError       │  │  ├── Now Competing Renderer (+ headshot)  │
│  (read by producer panel  │  │  ├── Rotation Tag Renderer                │
│   and GraphicsControl)    │  │  └── Lineup Card Renderer                  │
└──────────────────────────┘  └────────────────────────────────────────────┘
```

### 1.3 Score Diff Detection

```javascript
// Pseudocode for score change detection
// NOTE: gymnast.final_score is a STRING (e.g., "14.500"), not a number
// Uses gymnast_id as primary key (already used in output.html:4490 for leaderboard)
previousScores = {}  // { "gymnast_id": "finalScore" (string) }

onPoll(newData):
  changedPaths = {}  // Track what changed for incremental Firebase write

  for each team in newData.teams:
    for each event in team.events:
      for each gymnast in event.gymnasts:
        // Primary key: gymnast_id. Fallback: team.short_name|normalizeName(full_name)
        key = gymnast.gymnast_id || `${team.short_name}|${normalizeName(gymnast.full_name)}`
        prevScore = previousScores[key]
        currScore = gymnast.final_score  // string or null

        if currScore != null AND prevScore != currScore:
          // New score OR corrected score
          if isFlashActive(team, key):
            // Correction during active flash — interrupt immediately
            interruptFlash(team, gymnast, event)  // replaces current flash, resets timer
          else:
            triggerScoreFlash(team, gymnast, event)  // queued per-team
          changedPaths[`teams/${teamKey}/events/${eventKey}/gymnasts/${key}`] = gymnast

        if currScore == null AND prevScore != null:
          // Score removed (rare, inquiry pending) — update total but no flash
          changedPaths[`teams/${teamKey}/events/${eventKey}/gymnasts/${key}`] = gymnast

    // Check if team total changed
    if team.final_score != previousTeamTotals[teamKey]:
      changedPaths[`teams/${teamKey}/finalScore`] = team.final_score

  // Write ONLY changed paths to Firebase (incremental delta, not full rewrite)
  if Object.keys(changedPaths).length > 0:
    firebase.update('scoreBug/liveData/', changedPaths)
    firebase.update('scoreBug/liveData/', { lastDataChangeTimestamp: Date.now(), stalePollCount: 0 })
  else:
    firebase.update('scoreBug/liveData/', { stalePollCount: increment, lastPollTimestamp: Date.now() })

  // Always write heartbeat
  firebase.set('scoreBug/heartbeat', Date.now())
  previousScores = buildScoreMap(newData)
```

### 1.4 "Now Competing" Detection

**Reuse existing logic from GraphicsControl.jsx (lines 216-269)** which already implements
this pattern for the Athlete Spotlight feature. Extract the core detection algorithm so both
the overlay and GraphicsControl can share it.

```javascript
// For each team, find their currently active event and next athlete up
// All athletes are included (competing, alternates, exhibition)
detectNowCompeting(team):
  for each event in team.events (in competition order):
    gymnasts = event.gymnasts.sort(by order)
    scored = gymnasts.filter(g => g.final_score != null)
    unscored = gymnasts.filter(g => g.final_score == null)

    if scored.length > 0 AND unscored.length > 0:
      // This event is in progress
      return { athlete: unscored[0], event: event }

  return null  // No one currently competing (between rotations)
```

### 1.5 Rotation Detection

```javascript
// Infer current rotation from API data using ALL teams (not just first)
// Rotation only advances when ALL teams have completed their current event
detectRotation(teams):
  totalEvents = teams[0].events.length  // 6 for men, 4 for women
  minCompletedAcrossTeams = totalEvents  // Start at max, take minimum

  for each team in teams:
    completedEvents = 0
    for each event in team.events:
      gymnasts = event.gymnasts
      scored = gymnasts.filter(g => g.final_score != null)
      if scored.length == gymnasts.length:
        completedEvents++
    minCompletedAcrossTeams = Math.min(minCompletedAcrossTeams, completedEvents)

  if minCompletedAcrossTeams == totalEvents:
    return { current: totalEvents, total: totalEvents, isFinal: true }

  currentRotation = minCompletedAcrossTeams + 1
  return { current: currentRotation, total: totalEvents, isFinal: false }

// Display: "Rotation {current} of {total}" or "Final"
```

---

## 2. Task Breakdown

### Phase A: Core Score Bug (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| A1 | Create `overlays/team-bug.html` boilerplate with transparent background, Firebase SDK init | COMPLETE | First overlay to use Firebase — must include SDK initialization. 1920x1080 full-screen source. Created with: Inter font, 1920x1080 viewport, transparent background, Firebase SDK v9.22 compat, URL param parsing for compId, basic state management, Firebase listeners for enabled/polling/automationMode/showLineup/dismissFlash. |
| A1b | Initialize Firebase `scoreBug/` schema with default values on first load | COMPLETE | Uses Firebase transaction to safely initialize schema. If no data exists, writes full default schema. If data exists, merges defaults for missing fields only. Deep merges nested objects (config, liveData). Initialization runs before Firebase listeners are attached. |
| A2 | Implement URL parameter parsing (`compId`) and read competition config from Firebase | COMPLETE | Implemented loadCompetitionConfig() which reads from Firebase `competitions/{compId}/config`. Loads virtiusSessionId, gender, and team names/logos (up to 6 teams). Also implemented renderTeamRows() to display teams with initial "--" totals. Sets rotation.total based on gender (6 for men, 4 for women). |
| A3 | Implement Virtius API polling gated by Firebase `scoreBug/polling` flag | COMPLETE | Implemented poll() function: fetches from `https://api.virti.us/session/{sessionId}/json`, converts final_score strings to floats, stores API data in state for score diff engine, writes heartbeat on every poll. Poll interval listener restarts polling when interval changes. |
| A3b | Write **incremental deltas** to Firebase `scoreBug/liveData/` after each poll | NOT STARTED | Use `firebase.update()` for only changed paths — NOT full rewrite. Critical for Firebase free tier. Also write heartbeat timestamp on every poll. Track stalePollCount and lastDataChangeTimestamp. |
| A3c | Implement API error handling: stale data display, exponential backoff, write to `scoreBug/lastError` | NOT STARTED | On failure: keep last good data, double interval (max 30s), reset on success |
| A3d | Implement offline/reconnect behavior | NOT STARTED | On reconnect: immediate full poll (bypass interval timer), diff against last known state, write reconnect event to lastError |
| A4 | Build team row rendering (logo + cumulative total) | NOT STARTED | Initial state: show `--` before first poll, then `0.000` or actual total |
| A5 | Implement score diff engine to detect new scores AND corrections between polls | COMPLETE | Implemented flash queue system with per-team queues. isFlashActive() checks if correction should interrupt. triggerScoreFlash() queues or displays immediately. interruptFlash() replaces active flash. Added isCorrection flag for UI indication. |
| A6 | Build slot machine animation (vertical slide up/down) | NOT STARTED | |
| A7 | Implement score flash renderer (name, score, apparatus, SV) | NOT STARTED | No headshots in Phase A — headshots added in Phase E |
| A8 | Implement per-team independent score flash queue (10s hold, then return to default) | COMPLETE | Already implemented in A5 - state.flashQueues[teamIndex], 10s hold via flashDuration, clearFlashDisplay() returns to idle. |
| A9 | Add team total highlight animation on score change (including corrections) | COMPLETE | Already implemented in A4 - .team-total.highlight with totalPulse keyframes, applied in updateTeamTotal() on any score change. |
| A10 | Build rotation tag renderer (infer rotation from ALL teams' data) | COMPLETE | Added detectRotation() + updateRotationTag() following Section 1.5 logic. Writes rotation/totalRotations/isFinal to Firebase. |
| A11 | Implement bug enter/exit animation (slide from right) | NOT STARTED | |
| A12 | Connect Firebase listener for `scoreBug/enabled` toggle | NOT STARTED | |
| A12b | Connect Firebase listener for `scoreBug/polling` and `config/pollInterval` | NOT STARTED | Start/stop/adjust polling dynamically |
| A12c | Connect Firebase listener for `scoreBug/dismissFlash` | NOT STARTED | Producer can dismiss active flash. Overlay clears flash immediately when dismiss timestamp is newer than flash start. |
| A13 | Handle score flash queue edge cases (rapid scores, corrections within flash) | NOT STARTED | Corrections during active flash: interrupt immediately, replace with corrected score, reset 10s timer |

### Phase B: Now Competing (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| B1 | Implement now-competing detection logic from API data | NOT STARTED | Reuse/extract logic from GraphicsControl.jsx lines 216-269. All athletes shown (including alternates/exhibition). |
| B2 | Build now-competing slot state (name, apparatus) | COMPLETE | Implemented: renderNowCompeting(), insertNowCompetingContent() shows "UP NOW" + athlete name + apparatus code, getEventShortCode() for event name → short code conversion, clearNowCompeting(), updateAllNowCompeting() called on nowCompeting changes |
| B3 | Implement auto mode — display now competing automatically | NOT STARTED | |
| B4 | Implement manual mode — wait for Firebase signal to display | NOT STARTED | |
| B5 | Handle transition: now competing → score flash (priority system) | NOT STARTED | |
| B6 | Connect Firebase listener for `scoreBug/automationMode` | NOT STARTED | |
| B7 | Connect Firebase listener for `scoreBug/nowCompeting` (manual overrides) | NOT STARTED | |
| B8 | Write detected now-competing state to Firebase `scoreBug/detected/` for producer panel | NOT STARTED | Overlay writes, producer reads |

### Phase C: Lineup Card (P1)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| C1 | Build lineup card HTML/CSS layout (team header, numbered list, event total) | NOT STARTED | |
| C2 | Populate lineup card from Virtius API data (athletes, scores, order) | NOT STARTED | |
| C3 | Implement lineup card slide-up/down animation above bug | NOT STARTED | |
| C4 | Connect Firebase listener for `scoreBug/showLineup` | NOT STARTED | |
| C5 | Live-update lineup card scores as API polls return new data | NOT STARTED | |

### Phase D: Producer Panel (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| D1 | Create ScoreBugPanel React component in show controller | NOT STARTED | Collapsible panel following same pattern as OverrideLog, AlertPanel |
| D2 | Add ScoreBugPanel to ProducerView right column | NOT STARTED | Not a tab — collapsible panel in existing layout |
| D2b | Add Copy URL button (copies OBS browser source URL to clipboard) | NOT STARTED | Same pattern as existing graphics URL copy |
| D3 | Implement on/off toggle (writes to Firebase `scoreBug/enabled`) | NOT STARTED | |
| D3b | Implement polling start/stop toggle (writes to `scoreBug/polling`) | NOT STARTED | Independent of bug enabled state |
| D3c | Implement poll frequency selector (writes to `scoreBug/config/pollInterval`) | NOT STARTED | Dropdown: 1s, 2s, 5s, 10s, 15s, 30s |
| D3d | Implement heartbeat indicator (reads `scoreBug/heartbeat` from Firebase) | NOT STARTED | Color-coded: green (<10s), yellow (10-30s), red (>30s). Show "Overlay not polling — check OBS" when red. |
| D3e | Implement stale data indicator (reads `stalePollCount` and `lastDataChangeTimestamp`) | NOT STARTED | Informational: "Data unchanged for X polls (Ys)" — helps distinguish "no new scores" from "API stuck" |
| D4 | Implement auto/manual toggle (writes to `scoreBug/automationMode`) | NOT STARTED | |
| D5 | Build now-competing detection display in panel (reads `scoreBug/detected/` from Firebase) | NOT STARTED | No API polling — reads what the overlay writes to Firebase |
| D5b | Show API error indicator (reads `scoreBug/lastError` from Firebase) | NOT STARTED | Display warning with last successful poll timestamp |
| D5c | Build active flash display with DISMISS button per team | NOT STARTED | Writes dismiss timestamp to `scoreBug/dismissFlash/{teamKey}`. Only visible when flash is active. |
| D6 | Implement SHOW/HIDE buttons for now-competing per team | NOT STARTED | |
| D7 | Build lineup card controls (team dropdown + show/hide) | NOT STARTED | |
| D8 | Write Firebase `scoreBug/showLineup` on lineup toggle | NOT STARTED | |
| D9 | Write Firebase `scoreBug/nowCompeting` on manual confirm | NOT STARTED | |
| D10 | Migrate GraphicsControl.jsx Athlete Spotlight to read from `scoreBug/liveData/` | NOT STARTED | Remove independent Virtius polling from GraphicsControl (lines 216-269). Read from Firebase instead. |

### Phase E: Headshot Integration (P1)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| E1 | Load all headshots from Firebase at overlay startup (same pattern as output.html) | NOT STARTED | |
| E2 | Implement headshot name normalization and multi-key lookup | NOT STARTED | Reuse existing logic from output.html |
| E3 | Display headshots in score flash state | NOT STARTED | |
| E4 | Display headshots in now-competing state | NOT STARTED | |
| E5 | Graceful fallback when headshot not found (placeholder or omit) | NOT STARTED | |

### Phase F: Stick Indicator (P2)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| F1 | Integrate stick detection from Virtius API (`bonus > 0`) | NOT STARTED | Same logic as leaderboard in output.html:4742 |
| F2 | Build stick indicator UI (green circle + S) | NOT STARTED | |
| F3 | Conditionally show for men's meets only | NOT STARTED | |

### Phase G: Multi-Team Scaling (P1)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| G1 | Test and adjust layout for 3-team meets | NOT STARTED | |
| G2 | Test and adjust layout for 4-team meets | NOT STARTED | |
| G3 | Test and adjust layout for 5-6 team meets | NOT STARTED | |
| G4 | Ensure all rows function independently at scale | NOT STARTED | |
| G5 | Test OBS browser source configuration (dimensions, custom CSS, layering with other overlays) | NOT STARTED | Verify 1920x1080 source, transparent background, correct z-order |

---

## 3. Technical Notes

### 3.1 Existing Code to Reuse

| Component | Source | Purpose |
|-----------|--------|---------|
| Virtius API fetch | `output.html:4478` (`fetchAndRenderLeaderboard`) | API endpoint pattern, data structure parsing |
| Athlete ID mapping | `output.html:4490` (`gymnastToTeam[gymnast_id]`) | `gymnast_id` as stable athlete identifier — primary key for score diff engine |
| Name normalization | `nameNormalization.js:89-98` (`normalizeName()`) | Fallback key when `gymnast_id` absent. Also used in `output.html:4286` (`normalizeNameUnified`) |
| Now-competing detection | `GraphicsControl.jsx:216-269` | Athlete detection logic — extract and reuse |
| Headshot resolution | `output.html:5048-5110` (`getAthleteHeadshot`) | Multi-key headshot lookup with fallback chain |
| Team logo resolution | `output.html:4450` (`getTeamLogoUrl`) | Logo URL lookup with Firebase fallback |
| Firebase config | `output.html` (Firebase initialization) | Firebase app config, realtime listeners |
| Animation patterns | `overlays/event-bar.html` | Slide-in animation, cubic-bezier timing |
| Lower-third styling | `overlays/*.html` | Inter font, color scheme, layout patterns |
| Rotation inference | `server/lib/aiContextService.js:286-443` | Reference for rotation detection approach |

### 3.2 CSS/Style Specifications

| Property | Value | Notes |
|----------|-------|-------|
| Font family | Inter | Match existing overlays |
| Font weight (team total) | 900 | Bold score display |
| Font weight (athlete name) | 700 | |
| Font weight (start value) | 400 | Smaller, lighter |
| Background | Dark (#1a1a1a or #000) with slight transparency | Match existing dark lower-thirds |
| Accent color | Team-specific or white | |
| Position | Right side of 1920x1080 viewport | |
| Bug width | ~500px (TBD during implementation) | |
| Row height | ~60px (TBD during implementation) | |
| Logo size | ~40x40px within row | |
| Headshot size | ~36x36px circular | |

### 3.3 Firebase Schema

```
competitions/{compId}/scoreBug/
├── enabled: false                  // boolean — bug visible
├── polling: false                  // boolean — API polling active (independent of enabled)
├── automationMode: "auto"          // "auto" | "manual"
├── showLineup: null                // null | teamKey string (intentionally single-team only)
├── dismissFlash: {}                // { teamKey: timestamp } — producer dismisses active flash
├── nowCompeting: {}                // { teamKey: athleteName | null } — producer overrides
├── detected: {}                    // { teamKey: { athlete, gymnastId, apparatus } } — written by overlay
├── heartbeat: null                 // timestamp — written by overlay on every poll cycle
├── liveData: {                     // Written INCREMENTALLY (deltas only, not full rewrite)
│     lastPollTimestamp: null,
│     lastDataChangeTimestamp: null,
│     stalePollCount: 0,            // Consecutive polls with identical data
│     rotation: null,
│     totalRotations: null,
│     teams: {}                     // Only changed team/gymnast paths are updated
│   }
├── lastError: null                 // { message, timestamp, type } — written by overlay on API failure
│                                    // Read by producer panel to show error indicator
└── config: {
      pollInterval: 5000,           // ms — adjustable by producer (1000-30000)
      flashDuration: 10000,         // ms
      showStickIndicator: true      // boolean
    }
```

**Schema initialization:** On first load, the overlay uses a Firebase transaction (or `firebase.update()`
with null checks per field) to safely initialize the `scoreBug/` schema. This prevents a race condition
where both the overlay and producer panel load simultaneously and both attempt to write defaults.

### 3.4 URL Parameters for Overlay

```
overlays/team-bug.html?compId={compId}
```

The overlay reads competition config from Firebase (`competitions/{compId}/config`) to get the Virtius session ID and team information. All other state comes from Firebase listeners and API polling.

### 3.5 Deployment

The overlay file follows the standard overlays deployment process per CLAUDE.md:
- File lives at `overlays/team-bug.html`
- Deployed via tarball to `/var/www/commentarygraphic/overlays/`
- Accessible at `https://commentarygraphic.com/overlays/team-bug.html?compId=xxx`
- Added as OBS browser source

---

## 4. Open Questions

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | What is the data source for stick landings? | RESOLVED | Virtius API `bonus > 0` — same as existing leaderboard logic (`output.html:4742`) |
| 2 | Should the producer panel poll Virtius independently or share data with the overlay? | RESOLVED | Single poller — overlay polls Virtius, writes **incremental deltas** to `scoreBug/liveData/` in Firebase. Producer panel AND GraphicsControl Athlete Spotlight both read from Firebase. No other component polls Virtius. |
| 3 | Exact pixel dimensions for bug width, row height, logo/headshot sizes | OPEN | Determine during implementation with visual testing |
| 4 | Should the score flash queue show all queued scores sequentially, or skip to the latest? | RESOLVED | Sequential per-team — each team row has its own independent queue. Each flash plays its full 10 seconds. Multiple teams can flash simultaneously. |
| 5 | Color scheme for rotation tag — should it match team colors or be neutral? | OPEN | |
| 6 | Should alternates/exhibition gymnasts be filtered out of "now competing"? | RESOLVED | No — all athletes are shown. Their scores just don't count toward team total (handled by API's `team.final_score`). |
| 7 | Should the lineup card support showing multiple teams simultaneously? | RESOLVED | No — intentionally single-team only. `showLineup` is a single string value. |
| 8 | How to handle `final_score` string type from API? | RESOLVED | Compare as strings for diff detection. Convert to `parseFloat()` for display formatting. |
| 9 | How to identify athletes across polls for score diffing? | RESOLVED | Use `gymnast_id` from Virtius API as primary key (already used in `output.html:4490`). Fallback: composite `team.short_name\|normalizeName(full_name)` for contexts where `gymnast_id` is absent. |
| 10 | Should Firebase writes be full rewrites or incremental? | RESOLVED | Incremental deltas only via `firebase.update()`. Full API response is NOT written — only changed paths. Critical for Firebase free tier over 2-3 hour competition with 5s polling. |
| 11 | How should the overlay handle offline/reconnect? | RESOLVED | On reconnect: immediate full poll (bypass interval timer), diff against last known state, write reconnect event to `lastError`. Firebase listeners auto-reconnect via SDK. |
| 12 | How should score corrections during an active flash be handled? | RESOLVED | Interrupt active flash immediately, replace with corrected score flash, reset 10-second timer. |
| 13 | Can the producer dismiss score flashes? | RESOLVED | Yes — DISMISS button per team in producer panel writes timestamp to `scoreBug/dismissFlash/{teamKey}`. Overlay clears flash if dismiss timestamp > flash start time. |
| 14 | How should rotation be determined in multi-team meets? | RESOLVED | Minimum completed events across ALL teams + 1. Rotation only advances when every team has finished their current event. |
| 15 | OBS browser source dimensions? | RESOLVED | 1920x1080 full screen with transparent background. Bug renders on right side. |
| 16 | How does the lineup card interact with score flashes? | RESOLVED | Both operate independently. Lineup card stays visible above the bug while score flashes animate in the team rows below. Lineup card scores update live simultaneously with flashes. |
