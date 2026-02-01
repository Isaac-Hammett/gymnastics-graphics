# PRD: Team Scores Bug

**Version:** 1.2
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
| **Producer Control** | Dedicated collapsible panel in producer view with on/off toggle, automation settings, lineup card triggers, and copy URL button |
| **Scalable Team Support** | Work for dual meets (2 teams) up to 6-team competitions |
| **Lineup Card Integration** | Toggleable lineup overlay that pops above the bug |

---

## 3. User Stories

### Story 1: Producer Enables Score Bug

**As a** Producer running a dual meet broadcast
**I want to** toggle the score bug on from the Score Bug panel in the producer view
**So that** viewers see a persistent scoreboard on the right side of the screen

**Flow:**
1. Navigate to `/{compId}/producer`
2. Expand "Score Bug" collapsible panel (right column, similar to GraphicsControl and other panels)
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

**Each team row operates independently** — every row manages its own score flash queue. If Team 1 and Team 2 both post scores at the same time, both rows flash simultaneously. If Team 1 posts 3 scores in rapid succession, Team 1's row queues and plays all 3 flashes sequentially (10s each) while Team 2's row is unaffected. There is no cross-team queue; each team's flash state is completely independent.

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
3. **Manual mode:** Producer panel shows suggestion: "K. Tokunaga (PH) likely up — [SHOW]"
   - Producer clicks SHOW to confirm
4. When athlete's score arrives, "now competing" transitions directly to score flash (10 sec), then back to default

---

### Story 4: Producer Toggles Lineup Card

**As a** Producer
**I want to** pop up a team's current event lineup above the score bug
**So that** viewers can see the full lineup with scores

**Flow:**
1. In Score Bug panel, select team from dropdown
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
1. Score Bug panel has "Automation: Auto / Manual" toggle
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
├── Writes API data to Firebase ──→    ├── enabled                  never polls Virtius)
├── Renders team rows from FB data     ├── automationMode
├── Manages slot animations            ├── showLineup
├── Resolves headshots (Firebase)      ├── liveData/ ──────────→   Reads live scores
├── Writes detected state to FB ──→    ├── detected/ ──────────→   Displays suggestions
└── Transparent background (OBS)       └── nowCompeting             SHOW/HIDE buttons
```

**Single poller architecture:** Only the overlay page polls the Virtius API. After each poll, the overlay writes **only changed data** (incremental deltas) to `scoreBug/liveData/` in Firebase — it does NOT rewrite the full API response each poll. This is critical for staying within Firebase free tier limits over a 2-3 hour competition. Both the overlay itself and the producer panel read from Firebase — no component other than the overlay ever calls the Virtius API. This eliminates the existing duplicate polling in GraphicsControl.jsx (which currently polls Virtius independently for the Athlete Spotlight feature). The overlay also writes detected "now competing" athletes to `scoreBug/detected/` for the producer panel.

**Heartbeat mechanism:** The overlay writes a `scoreBug/heartbeat` timestamp to Firebase on every successful poll cycle. The producer panel monitors this timestamp and displays a prominent "Last poll: Xs ago" indicator. If the heartbeat goes stale (>30 seconds old), the producer panel shows a warning: "Overlay not polling — check OBS browser source." This covers cases where the overlay tab is closed, backgrounded (browser throttling), or crashed.

**Note:** This is the first overlay to use Firebase for real-time state. Existing overlays use URL parameters only. The overlay will need to initialize the Firebase SDK and establish realtime listeners in addition to polling the API.

**Offline/reconnect behavior:** If the overlay loses network connectivity:
- Firebase listeners will automatically reconnect when the network is restored (built-in SDK behavior).
- API polling should detect fetch failures and enter backoff mode (see Section 7.2).
- On reconnect, the overlay performs a full API poll immediately (bypassing the interval timer) and diffs against its last known state. Any scores posted during the disconnect appear as "new" and trigger score flashes normally.
- The overlay writes the reconnect event to `scoreBug/lastError` with a "reconnected" status so the producer panel can see the gap.

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
│  [N]  │  [📷] K. Tokunaga · PH                   │
│ 91.000│                                      │
├───────┴──────────────────────────────────────┤
```

- Headshot, name, and apparatus only (start value is not known until after the athlete competes)
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

Score flash always takes over immediately, regardless of current state. If a score correction arrives during an active flash, the current flash is **interrupted** and replaced with a new flash showing the corrected score (resets the 10-second timer). After 10 seconds, returns to default. System then detects next athlete and cycle continues.

**Producer flash dismiss:** The producer can manually dismiss any active score flash via a DISMISS button in the producer panel. This immediately ends the flash and returns the row to default state. This is useful if a score was posted in error or the producer wants to clear the display. Dismissing a flash does not prevent future flashes — the next queued flash (if any) will fire, or the next detected score will trigger normally.

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
| `team.events[].gymnasts[].gymnast_id` | Stable athlete identifier (primary key for score diff engine) |
| `team.events[].gymnasts[].full_name` | Athlete display name |
| `team.events[].gymnasts[].first_name` / `last_name` | For abbreviated display (e.g., "K. Tokunaga") |
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

**All athletes are shown in the bug**, including alternates and exhibition gymnasts. Their scores appear in score flashes like any other athlete. However, only counting scores contribute to the team total — the team total comes from `team.final_score` in the API, which already excludes non-counting scores.

**Reuse existing detection logic:** GraphicsControl.jsx (lines 216-269) already has a working "now competing" detection implementation for the Athlete Spotlight feature. Extract and reuse this logic rather than writing it from scratch.

### 5.4 Rotation Detection Logic

The Virtius API does not provide a "current rotation" field. The overlay infers rotation from the API data using **all teams** (not just one):

```
For each team:
  1. Count events where ALL gymnasts have final_score (= completed events)

Rotation = MINIMUM completed events across ALL teams + 1

This ensures the rotation only advances when ALL teams have finished their
current event. If Team A finishes event 2 but Team B is still competing on
event 2, the rotation stays at 2.

Total rotations = total number of events (6 for men, 4 for women)

Display: "Rotation {current} of {total}"
```

**Edge case:** Between rotations (all events either fully complete or untouched), use the minimum count of completed events across all teams as the rotation number. If all events are complete for all teams, display "Final" instead of a rotation number.

### 5.5 Athlete Identification

The score diff engine uses `gymnast_id` from the Virtius API as the primary stable identifier for tracking scores between polls. This field is already used in the existing leaderboard code (`output.html:4490`). Using `gymnast_id` avoids name collision issues (two athletes with the same name across teams) and is resilient to display name formatting differences.

**Fallback:** If `gymnast_id` is not present (e.g., All-Around aggregate results), fall back to a composite key: `{team.short_name}|{normalizeName(gymnast.full_name)}` using the existing `normalizeName()` function from `nameNormalization.js`.

### 5.6 API Data Type Notes

- `gymnast.final_score` is returned as a **string** (e.g., `"14.500"`), not a number. The score diff engine must compare string values or convert to float for comparison.
- `team.final_score` is also a string. Convert to float for display formatting.
- `gymnast.scores[].start` is a number (float).
- `gymnast.bonus` is a number (float).
- `gymnast.gymnast_id` is a string (stable identifier).

### 5.7 Stale Data Detection

The Virtius API may return cached or stale data (CDN caching, API lag). The overlay tracks whether each poll returned data identical to the previous poll:
- After each poll, compare the raw API response hash (or `team.final_score` values + total gymnast score count) against the previous poll.
- If data is identical, increment a `stalePollCount` counter.
- Write `stalePollCount` and `lastDataChangeTimestamp` to `scoreBug/liveData/` so the producer panel can display: "Data unchanged for X polls (Ys)" — this helps the producer distinguish "no new scores have been posted" from "the API might be stuck."
- The producer panel shows this as an informational indicator (not an error) — stale data is normal between routines.

### 5.8 Score Corrections

Occasionally a score may be corrected after initial posting (judge review, inquiry). When this happens:
- `gymnast.final_score` changes to a different value
- `team.final_score` may change (up or down)

**Behavior on correction:**
- The score diff engine detects the change (previous score != current score for same athlete, keyed by `gymnast_id`)
- If a flash for this athlete is currently active, **interrupt it immediately** and replace with a new flash showing the corrected score (resets the 10-second timer)
- If no flash is active, trigger a normal score flash showing the corrected score
- Update the team total — highlight animation fires regardless of direction (increase or decrease)
- No special "correction" indicator is needed in v1

### 5.9 Initial/Empty State

Before any scores are posted (start of competition):
- Team totals display `0.000`
- Slot area is empty (default state)
- Rotation tag displays "Rotation 1 of {total}"
- No score flashes or now competing until first API data arrives

When the overlay first loads and has not yet received API data:
- Display team logos and names from Firebase competition config
- Team totals show `--` until first successful API poll
- Once first poll completes, replace `--` with actual totals (which may be `0.000`)

---

## 6. Firebase Schema

### 6.1 Score Bug Control State

```
competitions/{compId}/scoreBug/
├── enabled: boolean              // Bug visible on screen
├── polling: boolean              // API polling active (independent of enabled)
├── automationMode: "auto" | "manual"
├── showLineup: null | "navy-mens"  // Which team's lineup to show (null = hidden)
│                                    // Intentionally single-team: only one lineup card at a time
├── dismissFlash: {               // Producer flash dismiss (written by producer, read by overlay)
│     "navy-mens": 1706745610000, // Timestamp of dismiss — overlay clears flash if active
│     "springfield-mens": null
│   }
├── nowCompeting: {               // Manual overrides for now competing
│     "navy-mens": "Kody Tokunaga",
│     "springfield-mens": null
│   }
├── detected: {                   // Written by overlay, read by producer panel
│     "navy-mens": {
│       "athlete": "Kody Tokunaga",
│       "gymnastId": "abc123",
│       "apparatus": "PH"
│     },
│     "springfield-mens": null
│   }
├── heartbeat: 1706745600000      // Written by overlay on every poll cycle
│                                  // Producer monitors: if stale >30s, show warning
├── liveData: {                   // Written INCREMENTALLY by overlay (deltas only, not full rewrite)
│     "lastPollTimestamp": 1706745600000,
│     "lastDataChangeTimestamp": 1706745590000,
│     "stalePollCount": 0,        // Consecutive polls with no data change
│     "rotation": 2,
│     "totalRotations": 6,
│     "teams": {
│       "navy-mens": {            // Only updated when this team's data changes
│         "finalScore": "91.000",
│         "events": { ... }
│       }
│     }
│   }
├── lastError: null               // { message, timestamp, type } — written by overlay on failure
└── config: {
      pollInterval: 5000,         // API poll interval in ms (configurable by producer)
      flashDuration: 10000,       // Score flash duration in ms
      showStickIndicator: true    // Men's meets only
    }
```

**Incremental Firebase writes:** The overlay does NOT rewrite the full API response to `liveData/` on every poll. Instead, it compares the current API response against the previous one and uses `firebase.update()` to write only the paths that changed (e.g., a single team's score, a single gymnast's `final_score`). This is critical for staying within Firebase free tier limits over a 2-3 hour competition with 5-second polling intervals.

**Schema initialization safety:** On first load, the overlay uses a Firebase transaction (or `firebase.update()` with null checks) to initialize the `scoreBug/` schema. This prevents a race condition where both the overlay and producer panel load simultaneously and both attempt to write defaults, potentially clobbering each other's initial settings.

**Polling is independent of bug visibility.** The producer can:
- Start polling before enabling the bug (pre-warm data)
- Stop polling while the bug is still visible (freeze current state)
- Adjust poll frequency live if the API is slow or there are issues

---

## 7. Producer Panel

### 7.1 Score Bug Panel Layout

The Score Bug panel is a **collapsible panel** in the ProducerView right column, following the same pattern as GraphicsControl, OverrideLog, AlertPanel, and other existing panels. It is **not** a separate tab or route.

```
SCORE BUG                                    [📋 Copy URL]
────────────────────────────────
Bug: [● ON / ○ OFF]

Polling: [● ON / ○ OFF]   [5s ▾]    Last poll: 3s ago ●
         ↑ start/stop      ↑ freq    ↑ heartbeat (green=healthy, yellow=stale, red=dead)

Data: Updated 12s ago · 2 unchanged polls
      ↑ stale data indicator (informational, not an error)

Automation: [Auto / Manual]

Now Competing (detected):
┌─────────────────────────────────────────────┐
│  Navy: K. Tokunaga · PH       [SHOW]        │
│  Springfield: J. Chen · FX    [SHOW]        │
└─────────────────────────────────────────────┘

Active Flashes:
┌─────────────────────────────────────────────┐
│  Navy: K. Tokunaga · 13.300        [DISMISS] │
└─────────────────────────────────────────────┘

Lineup Card:
  Team: [Navy          ▾]
  [SHOW LINEUP]  [HIDE LINEUP]
```

- **Copy URL button** — copies the OBS browser source URL for the score bug overlay (`https://commentarygraphic.com/overlays/team-bug.html?compId=xxx`) to clipboard, same pattern as existing graphics URL copy
- **Heartbeat indicator** — shows time since last overlay poll. Green (<10s), yellow (10-30s), red (>30s or overlay not running). If red, displays "Overlay not polling — check OBS browser source"
- **Stale data indicator** — shows time since data last changed and count of unchanged polls. Informational only — helps producer distinguish "no new scores" from "API might be stuck"
- **Polling is independent of bug visibility** — start polling to pre-warm data before enabling the bug, or stop polling to freeze current state
- **Poll frequency is adjustable** — default 5s, can increase if API is slow or reduce for faster updates
- In **auto mode**, SHOW buttons become HIDE buttons (to dismiss if wrong)
- In **manual mode**, SHOW buttons confirm display
- **Active Flashes section** — shows currently flashing scores with DISMISS button per team. Dismissing clears the flash immediately. Section only visible when a flash is active.
- Lineup team dropdown lists all teams in the competition
- Score flashes always fire automatically regardless of mode (but only when polling is active)

### 7.2 Lineup Card + Score Flash Interaction

When a lineup card is visible and a score flash fires for any team:
- The **team row still animates the score flash normally** (slot machine up, 10s hold, slot machine down). The lineup card remains visible above the bug and is unaffected.
- The **lineup card updates live** — the athlete's score appears in the lineup card list as soon as the API data arrives, which happens at the same time as the flash. This provides useful reinforcement: the viewer sees the flash in the team row and the lineup card score fill in simultaneously.
- If the lineup card is open for the same team that's flashing, both updates happen together. If it's open for a different team, only that team's row flashes while the lineup card stays static (no new data for that team).

### 7.3 OBS Browser Source Configuration

The score bug overlay is designed for a **1920x1080 full-screen OBS browser source** with transparent background. The bug renders on the right side of the viewport; the left side is fully transparent, allowing camera feeds and other sources to show through.

| Property | Value |
|----------|-------|
| Source dimensions | 1920x1080 |
| Background | Transparent (CSS: `background: transparent`) |
| Bug position | Right-aligned within the 1920x1080 viewport |
| Z-order | Above camera feeds, below other overlays (lower thirds, leaderboards) unless producer adjusts |

### 7.4 API Error Handling

When the Virtius API poll fails (network error, 429 rate limit, 500, malformed response):
- **Overlay:** Continue displaying the last known good data. Do not clear scores or show an error to viewers.
- **Producer panel:** Show a warning indicator (e.g., "API unreachable — showing stale data") with timestamp of last successful poll.
- **Backoff:** On consecutive failures, double the poll interval (up to 30s max). Reset to configured interval on next success.
- **Logging:** Write error details to `scoreBug/lastError` in Firebase so the producer panel can display them.

---

## 8. Phase Overview

| Phase | Name | Priority | Goal |
|-------|------|----------|------|
| **A** | Core Score Bug | P0 | Overlay page, API polling, team rows with totals, score flashes |
| **B** | Now Competing | P0 | Auto-detection, manual mode, producer panel suggestions |
| **C** | Lineup Card | P1 | Toggleable lineup overlay above bug |
| **D** | Producer Panel | P0 | Collapsible panel in producer view with all controls and copy URL button |
| **E** | Headshot Integration | P1 | Resolve and display athlete headshots in flashes |
| **F** | Stick Indicator | P2 | Green circle + S for men's meets |
| **G** | Multi-Team Scaling | P1 | Test and refine layout for 3-6 team meets |
| **H** | Quad-Box Variant | P3 | Alternate layout for quad camera view (future) |

---

## 9. Success Criteria

### Phase A Complete When:
- [ ] `overlays/team-bug.html` exists and renders in 1920x1080 OBS browser source with transparent background
- [ ] Firebase SDK initialized in overlay (first overlay to use Firebase)
- [ ] Firebase schema initialized safely with default values on first load (transaction/null-check to prevent race conditions)
- [ ] Polls Virtius API on configurable interval (default 5 seconds)
- [ ] Writes **incremental deltas** (not full rewrite) to `scoreBug/liveData/` in Firebase after each poll
- [ ] Writes heartbeat timestamp to `scoreBug/heartbeat` on every poll cycle
- [ ] Tracks stale poll count and last data change timestamp
- [ ] Displays team logos and cumulative totals (shows `--` before first poll, then `0.000` or actual total)
- [ ] Score diff engine uses `gymnast_id` as primary key (fallback: composite team+normalized name)
- [ ] Detects new scores and triggers slot-machine score flash
- [ ] Score flash shows: name, score, apparatus, start value (headshots added in Phase E)
- [ ] Score flash holds for 10 seconds then returns to default
- [ ] Score corrections interrupt active flash immediately (replaces with corrected score, resets timer)
- [ ] Per-team independent flash queues (each team row manages its own queue)
- [ ] Producer can dismiss active flash via Firebase `scoreBug/dismissFlash`
- [ ] Team total animates when it updates (including corrections)
- [ ] Rotation number tag displays at top (inferred from ALL teams' data, not just first team)
- [ ] Bug slides in/out from right edge
- [ ] Firebase path `scoreBug/enabled` controls visibility
- [ ] API error handling: displays stale data on failure, backs off poll interval
- [ ] Offline/reconnect: immediate full poll on reconnect, diffs against last known state
- [ ] `final_score` string values handled correctly (string-to-float conversion)

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
- [ ] Collapsible "Score Bug" panel exists in producer view right column
- [ ] Copy URL button copies OBS browser source URL to clipboard
- [ ] On/off toggle controls bug visibility via Firebase
- [ ] Polling start/stop toggle and frequency selector
- [ ] Heartbeat indicator with color-coded status (green/yellow/red) and "overlay not polling" warning
- [ ] Stale data indicator showing time since last data change and unchanged poll count
- [ ] Auto/manual toggle for now competing
- [ ] Now competing suggestions shown with SHOW/HIDE buttons (reads from Firebase, no API polling)
- [ ] Active flash display with DISMISS button per team (writes to `scoreBug/dismissFlash`)
- [ ] Lineup card team selector and show/hide controls
- [ ] API error indicator shown when polling fails (reads `scoreBug/lastError` from Firebase)
- [ ] GraphicsControl.jsx Athlete Spotlight polling removed/replaced (reads from `scoreBug/liveData/` instead)

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
