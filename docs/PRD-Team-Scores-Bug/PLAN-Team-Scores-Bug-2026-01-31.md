# Implementation Plan: Team Scores Bug

**Version:** 1.0
**Date:** 2026-01-31
**Status:** Not Started
**PRD:** [PRD-Team-Scores-Bug-2026-01-31.md](./PRD-Team-Scores-Bug-2026-01-31.md)

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
├── Polls Virtius API (5-10s)            scoreBug/                   ├── Score Bug tab
├── Score diff engine                    ├── enabled                 ├── On/Off toggle
├── Slot machine renderer                ├── automationMode          ├── Auto/Manual toggle
├── Headshot resolver                    ├── showLineup              ├── Reads detected/ from FB
├── Lineup card renderer                 ├── nowCompeting            ├── SHOW/HIDE buttons
├── Writes detected state to FB ──→      ├── detected/ ──────────→  └── Lineup card controls
└── Firebase listener ←─────────────     └── config/
```

**Single poller architecture:** Only the overlay polls Virtius. It writes detected "now competing"
athletes to `scoreBug/detected/` in Firebase. The producer panel reads Firebase only — no API calls.
Producer actions (SHOW/HIDE, toggle, lineup) write to Firebase, which the overlay picks up via listeners.

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
│  ├── Compare previous poll vs current poll                           │
│  ├── Detect new scores → trigger score flash                        │
│  ├── Detect "now competing" → next athlete without score            │
│  ├── Write detected state to Firebase (scoreBug/detected/)          │
│  ├── Update team totals                                              │
│  └── Update rotation info                                            │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
┌─────────────────────┐  ┌────────────────────────────────────────────┐
│  FIREBASE            │  │  RENDERERS (in overlay)                    │
│  scoreBug/detected/  │  │  ├── Team Row Renderer (logo + total)     │
│  (read by producer   │  │  ├── Score Flash Renderer (+ headshot)    │
│   panel)             │  │  ├── Now Competing Renderer (+ headshot)  │
└─────────────────────┘  │  ├── Rotation Tag Renderer                 │
                          │  └── Lineup Card Renderer                  │
                          └────────────────────────────────────────────┘
```

### 1.3 Score Diff Detection

```javascript
// Pseudocode for score change detection
previousScores = {}  // { "athleteId": finalScore }

onPoll(newData):
  for each team in newData.teams:
    for each event in team.events:
      for each gymnast in event.gymnasts:
        if gymnast.final_score exists AND previousScores[gymnast.id] != gymnast.final_score:
          triggerScoreFlash(team, gymnast, event)
        if gymnast.final_score is null AND previous gymnast had score:
          // score removed (rare, correction) — skip
  previousScores = buildScoreMap(newData)
```

### 1.4 "Now Competing" Detection

```javascript
// For each team, find their currently active event and next athlete up
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

---

## 2. Task Breakdown

### Phase A: Core Score Bug (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| A1 | Create `overlays/team-bug.html` boilerplate with transparent background | NOT STARTED | |
| A2 | Implement URL parameter parsing (sessionId, compId, teamCount) | NOT STARTED | |
| A3 | Implement Virtius API polling gated by Firebase `scoreBug/polling` flag | NOT STARTED | Only polls when polling=true. Reads interval from config.pollInterval |
| A4 | Build team row rendering (logo + cumulative total) | NOT STARTED | |
| A5 | Implement score diff engine to detect new scores between polls | NOT STARTED | |
| A6 | Build slot machine animation (vertical slide up/down) | NOT STARTED | |
| A7 | Implement score flash renderer (name, score, apparatus, SV) | NOT STARTED | |
| A8 | Implement score flash timing (10s hold, then return to default) | NOT STARTED | |
| A9 | Add team total highlight animation on score change | NOT STARTED | |
| A10 | Build rotation tag renderer (rotation number at top) | NOT STARTED | |
| A11 | Implement bug enter/exit animation (slide from right) | NOT STARTED | |
| A12 | Connect Firebase listener for `scoreBug/enabled` toggle | NOT STARTED | |
| A12b | Connect Firebase listener for `scoreBug/polling` and `config/pollInterval` | NOT STARTED | Start/stop/adjust polling dynamically |
| A13 | Handle score flash queue (multiple scores within 10s for same team) | NOT STARTED | |

### Phase B: Now Competing (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| B1 | Implement now-competing detection logic from API data | NOT STARTED | |
| B2 | Build now-competing slot state (headshot, name, apparatus, SV) | NOT STARTED | |
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
| D1 | Create ScoreBugPanel React component in show controller | NOT STARTED | |
| D2 | Add "Score Bug" tab to producer view navigation | NOT STARTED | |
| D3 | Implement on/off toggle (writes to Firebase `scoreBug/enabled`) | NOT STARTED | |
| D3b | Implement polling start/stop toggle (writes to `scoreBug/polling`) | NOT STARTED | Independent of bug enabled state |
| D3c | Implement poll frequency selector (writes to `scoreBug/config/pollInterval`) | NOT STARTED | Dropdown: 1s, 2s, 5s, 10s, 15s, 30s |
| D4 | Implement auto/manual toggle (writes to `scoreBug/automationMode`) | NOT STARTED | |
| D5 | Build now-competing detection display in panel (reads `scoreBug/detected/` from Firebase) | NOT STARTED | No API polling — reads what the overlay writes to Firebase |
| D6 | Implement SHOW/HIDE buttons for now-competing per team | NOT STARTED | |
| D7 | Build lineup card controls (team dropdown + show/hide) | NOT STARTED | |
| D8 | Write Firebase `scoreBug/showLineup` on lineup toggle | NOT STARTED | |
| D9 | Write Firebase `scoreBug/nowCompeting` on manual confirm | NOT STARTED | |

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

---

## 3. Technical Notes

### 3.1 Existing Code to Reuse

| Component | Source | Purpose |
|-----------|--------|---------|
| Virtius API fetch | `output.html:4478` (`fetchAndRenderLeaderboard`) | API endpoint pattern, data structure parsing |
| Headshot resolution | `output.html` (`firebaseHeadshots`, name normalization) | Multi-key headshot lookup |
| Team logo resolution | `output.html:4450` (`getTeamLogoUrl`) | Logo URL lookup with Firebase fallback |
| Firebase config | `output.html` (Firebase initialization) | Firebase app config, realtime listeners |
| Animation patterns | `overlays/event-bar.html` | Slide-in animation, cubic-bezier timing |
| Lower-third styling | `overlays/*.html` | Inter font, color scheme, layout patterns |

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
├── showLineup: null                // null | teamKey string
├── nowCompeting: {}                // { teamKey: athleteName | null } — producer overrides
├── detected: {}                    // { teamKey: { athlete, apparatus, sv } } — written by overlay
└── config: {
      pollInterval: 5000,           // ms — adjustable by producer (1000-30000)
      flashDuration: 10000,         // ms
      showStickIndicator: true      // boolean
    }
```

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
| 2 | Should the producer panel poll Virtius independently or share data with the overlay? | RESOLVED | Single poller — overlay polls Virtius, writes detected state to Firebase `scoreBug/detected/`. Producer panel reads Firebase only. |
| 3 | Exact pixel dimensions for bug width, row height, logo/headshot sizes | OPEN | Determine during implementation with visual testing |
| 4 | Should the score flash queue show all queued scores sequentially, or skip to the latest? | RESOLVED | Sequential — each flash plays its full 10 seconds |
| 5 | Color scheme for rotation tag — should it match team colors or be neutral? | OPEN | |
