# PRD: Team Scores Bug

**Version:** 1.0
**Date:** 2026-01-31
**Status:** Not Started

---

## 1. Problem Statement

During live gymnastics broadcasts, viewers have no persistent on-screen indicator of team scores, current competition state, or recent scoring activity. Producers must manually trigger individual graphics for each score update, and there is no automated way to surface real-time competition data from the Virtius API as a persistent broadcast element.

The system needs a persistent "score bug" — similar to the score tickers in professional sports broadcasts — that stays on screen throughout the competition, automatically updates via API polling, and surfaces key information: team totals, individual score flashes, rotation info, and who is currently competing.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Persistent Score Display** | Always-visible team scores on the right side of the broadcast |
| **Automated Score Flashes** | Detect new scores via API polling and surface them with athlete info |
| **Now Competing Detection** | Approximate who is currently on apparatus and display it |
| **Producer Control** | Dedicated control panel with on/off toggle, automation settings, lineup card triggers |
| **Scalable Team Support** | Work for dual meets (2 teams) up to 6-team competitions |
| **Lineup Card Integration** | Toggleable lineup overlay that pops above the bug |

---

## 3. User Stories

### Story 1: Producer Enables Score Bug

**As a** Producer running a dual meet broadcast
**I want to** toggle the score bug on from a dedicated producer panel tab
**So that** viewers see a persistent scoreboard on the right side of the screen

**Flow:**
1. Navigate to `/{compId}/producer`
2. Open "Score Bug" tab in producer panel
3. Toggle bug ON
4. Bug animates in from the right edge of the screen
5. Shows team logos + cumulative totals for each team
6. Rotation number displayed in tag at top

---

### Story 2: Score Flash on New Score

**As a** Viewer watching a live meet
**I want to** see a brief score flash when an athlete finishes competing
**So that** I know who just scored and what they got

**Flow:**
1. Score bug is active and polling Virtius API every 5-10 seconds
2. API returns a new score for an athlete that wasn't there before
3. The team's row slot-machines upward to show:
   - Athlete headshot (from Firebase headshots DB)
   - Abbreviated name (first initial + last name)
   - Score (bold)
   - Apparatus short code (FX, PH, SR, VT, PB, HB)
   - Start value (smaller font)
   - Stick indicator (green circle with S) — men's meets only
4. Flash holds for 10 seconds
5. Slot-machines back down to default (logo + total)
6. Team total animates/highlights to show it updated

**Both team rows operate independently** — if both teams post scores close together, both rows can flash simultaneously.

---

### Story 3: Now Competing Display

**As a** Viewer
**I want to** see who is currently on the apparatus
**So that** I know who I'm watching

**Flow:**
1. Score bug polls API and detects next athlete in lineup order without a score
2. **Auto mode:** Bug automatically slot-machines to show "now competing" state:
   - Athlete headshot
   - Abbreviated name
   - Apparatus short code
   - Start value
3. **Manual mode:** Producer panel shows suggestion: "K. Tokunaga (PH) likely up — [SHOW]"
   - Producer clicks SHOW to confirm
4. When athlete's score arrives, "now competing" transitions directly to score flash (10 sec), then back to default

---

### Story 4: Producer Toggles Lineup Card

**As a** Producer
**I want to** pop up a team's current event lineup above the score bug
**So that** viewers can see the full lineup with scores

**Flow:**
1. In Score Bug producer tab, select team from dropdown
2. Click "Show Lineup"
3. Lineup card slides up from above the score bug:
   - Team name + logo header
   - Numbered athlete list with scores (or "--" if not yet competed)
   - Apparatus icon + event total at bottom
4. Lineup updates live as scores come in from API
5. Producer clicks "Hide Lineup" to dismiss

---

### Story 5: Score Bug in Multi-Team Meets

**As a** Producer running a tri-meet or quad-meet
**I want** the score bug to display all competing teams
**So that** viewers can track all team scores

**Flow:**
1. Bug renders one row per team (3 rows for tri, 4 for quad, up to 6)
2. All rows function independently (score flashes, now competing)
3. Lineup card can be triggered for any team
4. Layout scales vertically — each row is compact (logo + total on left, slot on right)

---

### Story 6: Producer Controls Automation

**As a** Producer
**I want** control over whether "now competing" displays automatically or manually
**So that** I can prevent incorrect athlete detection from going to air

**Flow:**
1. Score Bug tab has "Automation: Auto / Manual" toggle
2. **Auto mode:**
   - System detects who's likely up and displays automatically
   - Producer can dismiss via HIDE button if detection is wrong
3. **Manual mode:**
   - System detects who's likely up and shows suggestion in producer panel
   - Producer clicks SHOW to confirm display
   - Score flashes always fire automatically regardless of mode

---

## 4. Component Architecture

### 4.1 Score Bug Overlay

```
OVERLAY PAGE                           FIREBASE                    PRODUCER PANEL
─────────────                          ────────                    ──────────────
overlays/team-bug.html          ←→     competitions/{compId}/      Show Controller
├── Polls Virtius API (5-10s)          scoreBug/                   (reads Firebase only,
├── Renders team rows                  ├── enabled                  never polls Virtius)
├── Manages slot animations            ├── automationMode
├── Resolves headshots (Firebase)      ├── showLineup
├── Writes detected state to FB ──→    ├── detected/ ──────────→   Displays suggestions
└── Transparent background (OBS)       └── nowCompeting             SHOW/HIDE buttons
```

**Single poller architecture:** Only the overlay page polls the Virtius API. The overlay writes detected "now competing" athletes to `scoreBug/detected/` in Firebase. The producer panel reads this Firebase path to show suggestions — it never polls Virtius directly. This avoids redundant API calls.

### 4.2 Layout

**Bug at rest (default state):**
```
┌──────────────────────────────────────────────┐
│  Rotation 2 of 6                             │
├───────┬──────────────────────────────────────┤
│  [N]  │                                      │
│ 91.000│                                      │
├───────┼──────────────────────────────────────┤
│  [S]  │                                      │
│105.100│                                      │
└───────┴──────────────────────────────────────┘
```

- Right side of screen
- Logo stacked above cumulative total in fixed left column
- Slot area on right is empty at rest
- Rotation tag across the top

**Score flash state (10 seconds):**
```
├───────┬──────────────────────────────────────────────┤
│  [N]  │  [📷] K. Tokunaga · 13.300 · PH · SV 4.4 · Ⓢ │
│ 91.000│                                              │
├───────┴──────────────────────────────────────────────┤
```

- Headshot, abbreviated name, score, apparatus, start value, stick (men's only)
- Slides up vertically (slot machine animation)
- Total highlights/pulses to indicate it updated

**Now competing state (holds until score arrives):**
```
├───────┬──────────────────────────────────────┤
│  [N]  │  [📷] K. Tokunaga · PH · SV 4.4    │
│ 91.000│                                      │
├───────┴──────────────────────────────────────┤
```

- Same layout as score flash but without the score and stick indicator
- Holds until score arrives, then transitions to score flash

**Lineup card (above bug, producer-triggered):**
```
┌──────────────────────────────────────┐
│  Navy                           [N]  │
├──────────────────────────────────────┤
│  1. Kody Tokunaga       4.4  13.300  │
│  2. Matthew Petros      4.5  11.850  │
│  3. Daniel Gurevich     4.5  13.350  │
│  4. Jonah Soltz                  --  │
│  5. Brian Solomon                --  │
├──────────────────────────────────────┤
│  PH   Event Total          38.500   │
└──────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  Rotation 2 of 6                             │
├───────┬──────────────────────────────────────┤
│  [N]  │                                      │
│ 91.000│                                      │
├───────┼──────────────────────────────────────┤
│  [S]  │                                      │
│105.100│                                      │
└───────┴──────────────────────────────────────┘
```

### 4.3 Slot Machine Priority

| Priority | State | Duration | Trigger |
|----------|-------|----------|---------|
| 1 (highest) | Score Flash | 10 seconds | New score detected in API poll |
| 2 | Now Competing | Holds until score arrives | Auto-detection or producer confirm |
| 3 (lowest) | Default (empty) | Indefinite | Fallback when nothing active |

**Transition flow:**
```
Default → Now Competing (A) → Score Flash (A) → Default → Now Competing (B) → ...
```

Score flash always takes over immediately, regardless of current state. After 10 seconds, returns to default. System then detects next athlete and cycle continues.

### 4.4 Animation Specifications

| Animation | Type | Duration |
|-----------|------|----------|
| Bug enter | Slide in from right edge | 0.6s cubic-bezier |
| Bug exit | Slide out to right edge | 0.6s cubic-bezier |
| Slot machine (up) | Vertical slide, new content pushes old up | 0.4s ease |
| Slot machine (down) | Vertical slide, content drops back to default | 0.4s ease |
| Total score update | Brief highlight pulse (color flash or scale) | 0.5s |
| Lineup card enter | Slide up from bug top edge | 0.4s ease |
| Lineup card exit | Slide down into bug | 0.4s ease |

---

## 5. Data Sources

### 5.1 Virtius API

**Endpoint:** `GET https://api.virti.us/session/{sessionId}/json`
**Polling interval:** 5-10 seconds

**Key fields used:**

| Field | Purpose |
|-------|---------|
| `team.final_score` | Cumulative team total |
| `team.logo` | Team logo URL |
| `team.name` / `team.short_name` | Team identification |
| `team.events[].event_name` | Determine which apparatus team is on |
| `team.events[].event_score` | Event total for lineup card |
| `team.events[].gymnasts[].full_name` | Athlete name |
| `team.events[].gymnasts[].final_score` | Individual score (null = hasn't competed) |
| `team.events[].gymnasts[].order` | Lineup position |
| `team.events[].gymnasts[].scores[].start` | Start value (difficulty) |
| `team.events[].gymnasts[].bonus` | Stick bonus — `bonus > 0` means stuck landing (men's only) |

### 5.2 Firebase

| Path | Purpose |
|------|---------|
| `competitions/{compId}/config` | Session ID, team names, comp type |
| `competitions/{compId}/scoreBug/*` | Bug control state (enabled, mode, etc.) |
| `teamsDatabase/headshots/{name}` | Athlete headshot URLs |
| `teamsDatabase/teams/{key}` | Team logo fallback |

### 5.3 "Now Competing" Detection Logic

```
For each team:
  1. Find the event where some gymnasts have scores and some don't
     (this is the currently active event for this team)
  2. Sort gymnasts by lineup order
  3. First gymnast without a final_score = "now competing"
  4. If all gymnasts have scores = event complete, no one currently up
```

This is an approximation — the API doesn't have a real-time "on apparatus" field. It works well when scores are entered sequentially in lineup order.

---

## 6. Firebase Schema

### 6.1 Score Bug Control State

```
competitions/{compId}/scoreBug/
├── enabled: boolean              // Bug visible on screen
├── polling: boolean              // API polling active (independent of enabled)
├── automationMode: "auto" | "manual"
├── showLineup: null | "navy-mens"  // Which team's lineup to show (null = hidden)
├── nowCompeting: {               // Manual overrides for now competing
│     "navy-mens": "Kody Tokunaga",
│     "springfield-mens": null
│   }
├── detected: {                   // Written by overlay, read by producer panel
│     "navy-mens": {
│       "athlete": "Kody Tokunaga",
│       "apparatus": "PH",
│       "sv": 4.4
│     },
│     "springfield-mens": null
│   }
└── config: {
      pollInterval: 5000,         // API poll interval in ms (configurable by producer)
      flashDuration: 10000,       // Score flash duration in ms
      showStickIndicator: true    // Men's meets only
    }
```

**Polling is independent of bug visibility.** The producer can:
- Start polling before enabling the bug (pre-warm data)
- Stop polling while the bug is still visible (freeze current state)
- Adjust poll frequency live if the API is slow or there are issues

---

## 7. Producer Panel

### 7.1 Score Bug Tab Layout

```
SCORE BUG
────────────────────────────────
Bug: [● ON / ○ OFF]

Polling: [● ON / ○ OFF]   [5s ▾]
         ↑ start/stop      ↑ frequency (1s, 2s, 5s, 10s, 15s, 30s)

Automation: [Auto / Manual]

Now Competing (detected):
┌─────────────────────────────────────┐
│  Navy: K. Tokunaga · PH    [SHOW]  │
│  Springfield: J. Chen · FX  [SHOW]  │
└─────────────────────────────────────┘

Lineup Card:
  Team: [Navy          ▾]
  [SHOW LINEUP]  [HIDE LINEUP]
```

- **Polling is independent of bug visibility** — start polling to pre-warm data before enabling the bug, or stop polling to freeze current state
- **Poll frequency is adjustable** — default 5s, can increase if API is slow or reduce for faster updates
- In **auto mode**, SHOW buttons become HIDE buttons (to dismiss if wrong)
- In **manual mode**, SHOW buttons confirm display
- Lineup team dropdown lists all teams in the competition
- Score flashes always fire automatically regardless of mode (but only when polling is active)

---

## 8. Phase Overview

| Phase | Name | Priority | Goal |
|-------|------|----------|------|
| **A** | Core Score Bug | P0 | Overlay page, API polling, team rows with totals, score flashes |
| **B** | Now Competing | P0 | Auto-detection, manual mode, producer panel suggestions |
| **C** | Lineup Card | P1 | Toggleable lineup overlay above bug |
| **D** | Producer Panel | P0 | Dedicated tab in show controller with all controls |
| **E** | Headshot Integration | P1 | Resolve and display athlete headshots in flashes |
| **F** | Stick Indicator | P2 | Green circle + S for men's meets |
| **G** | Multi-Team Scaling | P1 | Test and refine layout for 3-6 team meets |
| **H** | Quad-Box Variant | P3 | Alternate layout for quad camera view (future) |

---

## 9. Success Criteria

### Phase A Complete When:
- [ ] `overlays/team-bug.html` exists and renders in OBS browser source
- [ ] Polls Virtius API on configurable interval (default 5 seconds)
- [ ] Displays team logos and cumulative totals
- [ ] Detects new scores and triggers slot-machine score flash
- [ ] Score flash shows: headshot, name, score, apparatus, start value
- [ ] Score flash holds for 10 seconds then returns to default
- [ ] Team total animates when it updates
- [ ] Rotation number tag displays at top
- [ ] Bug slides in/out from right edge
- [ ] Firebase path `scoreBug/enabled` controls visibility

### Phase B Complete When:
- [ ] System detects "now competing" athlete per team from API data
- [ ] Auto mode displays now competing automatically
- [ ] Manual mode surfaces suggestion in producer panel
- [ ] Now competing transitions to score flash when score arrives
- [ ] Producer can dismiss incorrect detection

### Phase C Complete When:
- [ ] Lineup card renders above the bug
- [ ] Shows numbered athlete list with scores or "--"
- [ ] Shows event total at bottom
- [ ] Updates live as scores come in
- [ ] Producer can trigger per team from panel
- [ ] Slides up/down with animation

### Phase D Complete When:
- [ ] Dedicated "Score Bug" tab exists in producer view
- [ ] On/off toggle controls bug visibility via Firebase
- [ ] Auto/manual toggle for now competing
- [ ] Now competing suggestions shown with SHOW/HIDE buttons
- [ ] Lineup card team selector and show/hide controls

### Phase E Complete When:
- [ ] Headshots resolve from `teamsDatabase/headshots/` using existing normalization
- [ ] Headshots display in score flash and now competing states
- [ ] Graceful fallback when headshot not found (show without headshot)

### Phase F Complete When:
- [ ] Stick indicator (green circle + S) displays for men's meets when `bonus > 0` in API data
- [ ] Hidden for women's meets
- [ ] Reuses existing stick detection logic from leaderboard (`output.html:4742`)

### Phase G Complete When:
- [ ] Bug renders correctly with 3, 4, 5, and 6 team rows
- [ ] Layout scales without overflow or cramping
- [ ] All rows function independently (flashes, now competing)

---

## 10. Terminology

| Term | Definition |
|------|------------|
| **Score Bug** | Persistent on-screen scoreboard element showing team scores |
| **Slot Machine** | Vertical slide animation used to transition between states in a team row |
| **Score Flash** | Temporary display (10s) of an individual athlete's score within a team row |
| **Now Competing** | Display of the athlete currently (approximately) on apparatus |
| **Lineup Card** | Expandable overlay showing full team lineup for current event |
| **Start Value (SV)** | Difficulty score / D-score for a routine |
| **Stick Indicator** | Visual indicator that an athlete "stuck" their landing (men's only) |
| **Rotation Tag** | Header element showing current rotation number |

---

## 11. Related Documents

| Document | Purpose |
|----------|---------|
| [PLAN-Team-Scores-Bug-2026-01-31.md](./PLAN-Team-Scores-Bug-2026-01-31.md) | Technical implementation plan and task breakdown |

---

## 12. Future Considerations

- **Quad-box variant:** Redesigned layout where each team's bug is contained within its camera box in a quad-camera view. Separate design project.
- **Per-camera athlete identification:** Nameplates and athlete info tied to individual camera feeds. Separate feature, not part of this bug.
- **Historical score ticker:** Scrolling display of all scores from the current rotation.
