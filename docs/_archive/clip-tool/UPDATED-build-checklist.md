# GYMNASTICS BROADCAST — INTELLIGENT QUEUE SYSTEM

## Build Checklist & Task Tracker

Version 2.0 | March 2026

---

## PHASE 0: PRE-WORK & DATA COLLECTION
**Duration:** Ongoing (start immediately) | **Goal:** Collect training data and measure key unknowns before building anything

### 0.1 Record Meets for Training Data
- [ ] Set up static iPhone cameras at all 4 apparatuses for next scheduled meet
- [ ] Verify each iPhone has sufficient storage (minimum 64GB free per meet)
- [ ] Verify each iPhone is plugged into power for the duration of the meet
- [ ] Position cameras: locked-off, tripod-mounted, capturing the full apparatus and surrounding area
- [ ] Test SRT stream connectivity from each iPhone before the meet starts
- [ ] Confirm all 4 feeds are recording for the full duration of the meet
- [ ] Record a minimum of 3 full meets before Phase 2 begins
  - [ ] Meet 1: ____________ (date/opponent)
  - [ ] Meet 2: ____________ (date/opponent)
  - [ ] Meet 3: ____________ (date/opponent)
- [ ] Archive raw recordings in organized storage
  - [ ] Create folder structure: `/training-data/{meet-date}/{apparatus}/`
  - [ ] Save full-length SRT recordings per apparatus per meet
  - [ ] Verify files are playable and not corrupted after transfer

### 0.2 Manually Label Routine Timestamps
- [ ] Create a ground-truth spreadsheet for routine timestamps
  - [ ] Columns: meet_date, rotation, apparatus, lineup_position, athlete_name, team, start_time, end_time, notes
- [ ] Watch each apparatus recording and log start/end timestamps for every routine
- [ ] Label at least 2 full meets of beam data (highest priority for Phase 2)
- [ ] Label at least 1 full meet of bars data
- [ ] Label at least 1 full meet of vault data
- [ ] Label at least 1 full meet of floor data
> This data is your ground truth for evaluating AI detection accuracy in Phase 2

### 0.3 Measure Virtius Score Latency
- [ ] At each recorded meet, log Virtius score timing
  - [ ] For each routine: note the wall-clock time the routine visibly ends (dismount/landing)
  - [ ] For each routine: note the wall-clock time the score appears in the Virtius API
  - [ ] Calculate the delta for every routine across 2–3 meets
- [ ] Analyze the distribution
  - [ ] What is the median delay?
  - [ ] What is the 90th percentile delay?
  - [ ] What is the maximum delay observed?
  - [ ] Are there apparatus-specific patterns (e.g., beam judging slower than vault)?
> This data determines how much of the queue logic must handle unscored clips

### 0.4 Audit Existing Show Controller Codebase ✅ COMPLETED

The following audit has been performed against the `gymnastics-graphics` repository:

#### Rundown Data Model

**Editor format** (stored at `competitions/{compId}/production/rundown/segments/`):
```javascript
{
  id: string,                    // Unique identifier
  name: string,                  // Segment title
  type: string,                  // 'video' | 'live' | 'static' | 'break' | 'hold' | 'graphic'
  duration: number | null,       // Seconds
  scene: string | null,          // OBS scene name
  graphic: {                     // Graphic configuration
    graphicId: string,
    params: object
  } | null,
  timingMode: string,            // 'fixed' | 'manual'
  notes: string,
  script: string,                // Teleprompter text for talent
  talent: string[],              // Assigned talent IDs
  audioCue: { songName, inPoint, outPoint } | null,
  bufferAfter: number,
  locked: boolean,
  optional: boolean,
  minDuration: number,
  maxDuration: number
}
```

**Engine format** (converted via `server/lib/segmentMapper.js`, stored at `competitions/{compId}/rundown/segments/`):
```javascript
{
  id, name, type, duration, notes, script, talent, audioCue,
  bufferAfter, locked, optional, minDuration, maxDuration,
  obsScene: string,              // Mapped from editor 'scene'
  graphic: string,               // Mapped from editor 'graphic.graphicId'
  graphicData: object,           // Mapped from editor 'graphic.params'
  autoAdvance: boolean,          // Mapped from 'timingMode': fixed=true, manual=false
  videoFile: string,             // For video segments
  videoSource: string            // OBS media source name
}
```

**Segment types:** `video`, `live`, `static`, `break`, `hold`, `graphic`

**The `video` type already exists** and supports `duration`, `scene`, `graphic`, and `timingMode`. Clip integration extends this type with clip-specific fields rather than creating a new type.

#### Rundown Editor (`show-controller/src/pages/RundownEditorPage.jsx`)
- Segments are created, reordered, and deleted via drag-and-drop and toolbar buttons
- Segments saved to Firebase at `competitions/{compId}/production/rundown/segments/`
- Supports templates: saved rundowns loadable into new competitions
- Timezone display: multi-timezone wall-clock times per segment

#### Commentator/Talent View (`show-controller/src/views/TalentView.jsx`)
- Reads segment data from `useTimesheet()` hook
- Displays: current segment, next segment, run of show timeline
- Script panel (teleprompter) for current segment
- AI talking points panel with priority levels (milestones, high priority, regular)
- "ON CAMERA" alert when talent is assigned to current segment
- Control buttons: Previous, Pause/Resume, Next
- Timing: driven by `timesheetTick` socket events (`elapsed`, `remaining`, `progress`)
- **Does not currently have "On Deck" (third segment preview)** — needs addition

#### Timing/Countdown System
- All timing driven by `TimesheetEngine` (`server/lib/timesheetEngine.js`)
- Engine ticks every 1 second, broadcasting `timesheetTick` events
- Tick data: `{ elapsedMs, remainingMs, progress, showElapsedMs, isHoldSegment, canAdvanceHold, holdRemainingMs }`
- Frontend reads via `useTimesheet()` hook: `{ elapsed, remaining, progress, formatTime() }`
- **No client-side timer logic** — all timing is server-authoritative

#### Firebase Paths Used

| Path | Read/Write | Description |
|------|------------|-------------|
| `competitions/{compId}/rundown/segments/` | R/W | Engine-format segments |
| `competitions/{compId}/production/rundown/segments/` | R/W | Editor-format segments |
| `competitions/{compId}/production/rundown/config/` | R/W | Rundown configuration |
| `competitions/{compId}/production/rundown/analytics/{runId}/` | W | Timing analytics per show run |
| `competitions/{compId}/currentGraphic/` | W | Current graphics trigger |
| `competitions/{compId}/production/talent/` | R/W | Talent roster |
| `competitions/{compId}/config/` | R | Competition configuration |

**Firebase listener pattern:** `onValue(ref(db, path), callback)` from `firebase/database`

#### OBS WebSocket Integration

**Connection:** `OBSConnectionManager` (`server/lib/obsConnectionManager.js`) — singleton, per-competition websocket connections with 15s heartbeat and auto-reconnect.

**Scene switching commands used:**
- `SetCurrentProgramScene({ sceneName })` — switch program scene
- `SetInputSettings({ inputName, inputSettings })` — update source settings (e.g., media file path)
- `TriggerMediaInputAction({ inputName, mediaInputAction })` — control media playback

**Scene switching triggered by:** `TimesheetEngine._applyTransitionAndSwitchScene(segment, transition)` when a segment activates. Supports CUT, FADE, and STINGER transition types.

**State sync:** `OBSStateSync` mirrors scene list, current scene, sources, and streaming/recording status to Firebase.

**Existing socket events for OBS:**
- `obs:connected`, `obs:disconnected` — connection status
- `obs:currentSceneChanged` — scene change broadcast
- `obs:stateUpdated` — full OBS state sync
- `obs:switchScene`, `obs:createScene`, `obs:deleteScene` — scene management
- `obs:updateInputSettings`, `obs:setVolume`, `obs:setMute` — source control

#### Virtius API Integration
- API client fetches competition data, lineups, and scores
- Event names: FLOOR, HORSE, RINGS, VAULT, PBARS, BAR (men's); uses `event_name` field
- Each event has: `event_name`, `rotation`, `gymnasts[]`, `event_score`
- Scores polled during live competitions

#### Graphics Triggering
- Triggered by `TimesheetEngine._triggerGraphic(segment)`
- Writes to Firebase: `competitions/{compId}/currentGraphic`
- Payload: `{ graphic: graphicId, graphicId: string, data: params, segmentId: string }`
- `output.html` reads this path and renders the graphic
- `isReplay` flag can be added to `graphic.params` for clip-specific rendering

---

## PHASE 1: QUEUE SERVICE & FIREBASE BRIDGE
**Duration:** 2 weeks | **Goal:** Build the complete manual clipping pipeline end-to-end

### 1.1 Define Firebase Schema

#### 1.1.1 Design the Clip Queue Data Structure

All clip data lives under `competitions/{compId}/clipQueue/` to match the existing competition-scoped Firebase convention.

- [ ] Create `competitions/{compId}/clipQueue/clips/` path for individual clip records
- [ ] Create `competitions/{compId}/clipQueue/state/` path for playback state
  - `currentlyPlayingClipId: string | null`
  - `autoAdvance: boolean`
  - `mode: 'standard' | 'story'`
- [ ] Create `competitions/{compId}/clipQueue/apparatusState/` path for real-time routine state
  - Per apparatus: `{ state: 'idle'|'active'|'complete'|'disconnected', elapsedMs, estimatedRemainingMs, lastUpdated }`
- [ ] Create `competitions/{compId}/clipQueue/settings/` path for configuration

- [ ] Define the complete clip record schema at `competitions/{compId}/clipQueue/clips/{clipId}/`:
  - [ ] `clipId` (string): unique identifier, format: `{compId}-r{rotation}-{apparatus}-{lineupPosition}`
  - [ ] `videoUrl` (string): path to clip file in shared storage
  - [ ] `apparatus` (string): beam | bars | floor | vault
  - [ ] `athlete` (string): athlete full name from lineup data
  - [ ] `team` (string): team name from lineup data
  - [ ] `score` (number | null): null until Virtius score is matched
  - [ ] `rotation` (number): which rotation this clip is from
  - [ ] `lineupPosition` (number): position in the lineup for this apparatus
  - [ ] `routineCount` (string): e.g., "3 of 6" for display
  - [ ] `durationSeconds` (number): clip length in seconds
  - [ ] `status` (string): detected | ready_unscored | ready_scored | playing | played | skipped
  - [ ] `detectionSource` (string): auto | manual | auto+manual
  - [ ] `priorityBoostReason` (string | null)
  - [ ] `sequentialOrder` (number): position in default chronological queue
  - [ ] `createdAt` (number): timestamp
  - [ ] `scoreMatchedAt` (number | null)
  - [ ] `playbackStartedAt` (number | null)
  - [ ] `manualStartMark` (number | null)
  - [ ] `manualEndMark` (number | null)
  - [ ] `seasonAverage` (number | null)
  - [ ] `isSeasonBest` (boolean)
  - [ ] `rundownSegmentId` (string | null): links to the segment created in the rundown

#### 1.1.2 Define Priority Settings Schema

- [ ] Define `competitions/{compId}/clipQueue/settings/priority/` structure:
  - `defaultOrder`: "sequential"
  - `apparatusCycleOrder`: ["vault", "bars", "beam", "floor"]
  - `boostRules`: ordered array of rule objects:
    - Anchor: `{ id: "anchor", name: "Anchor Routines", enabled: true, threshold: null, boostStrength: 3 }`
    - Close score: `{ id: "closeScore", name: "Close Team Score", enabled: true, threshold: 2.0, boostStrength: 2 }`
    - High score: `{ id: "highScore", name: "High Individual Score", enabled: true, threshold: 9.800, boostStrength: 2 }`
    - AA leader: `{ id: "aaLeader", name: "All-Around Leader", enabled: false, threshold: null, boostStrength: 1 }`
  - `presets`: `{ "regular_season": {...}, "championship": {...} }`

#### 1.1.3 Define Per-Apparatus Settings Schema

- [ ] Define `competitions/{compId}/clipQueue/settings/apparatus/{apparatus}/`:
  - `clipBufferBefore`: seconds before detected start (varies by apparatus)
  - `clipBufferAfter`: seconds after detected end (default 5s)
  - `quickClipLookback`: seconds for Quick Clip (beam: 95, bars: 50, floor: 95, vault: 20)
  - `aiDetectionEnabled`: boolean
  - `regionOfInterest`: { x, y, width, height } | null

#### 1.1.4 Firebase Test Harness

- [ ] Build a Node.js test script that writes 10–15 sample clip records to `competitions/{compId}/clipQueue/clips/` with realistic data
  - Include clips at various statuses: ready_unscored, ready_scored, playing, played
  - Include clips with and without priority boosts
- [ ] Verify records appear correctly in Firebase console
- [ ] Test real-time listener: open Show Controller, write a new record, confirm it appears within 1 second
  - Use the same `onValue(ref(db, path), callback)` pattern used throughout the codebase

### 1.2 Build Producer Queue Panel (App A — Show Controller)

#### 1.2.1 ClipQueuePanel Component

**File:** `show-controller/src/components/ClipQueuePanel.jsx`
**Integration point:** Added as a new panel in `ProducerView.jsx` (`show-controller/src/views/ProducerView.jsx`), alongside the existing `RunOfShow` component. Layout: ClipQueuePanel sits in the left column alongside RunOfShow, giving the producer a dual view of rundown segments + clip queue.

- [ ] Create `ClipQueuePanel.jsx` React component
- [ ] Subscribe to Firebase `competitions/{compId}/clipQueue/clips/` using `onValue(ref(db, path), callback)` (same pattern as `ShowContext.jsx`)
- [ ] Sort clips by default sequential order (`sequentialOrder` field)
- [ ] Apply any active priority boost rules from `competitions/{compId}/clipQueue/settings/priority/boostRules/` to re-sort
- [ ] Render each clip as a queue card showing:
  - [ ] Apparatus icon/color badge (beam=pink, bars=purple, floor=green, vault=blue)
  - [ ] Athlete name and team
  - [ ] Score (or "Score pending" with pulsing indicator if null, live-updated when score arrives)
  - [ ] Clip duration formatted as m:ss
  - [ ] Priority boost tag if applicable (e.g., "Anchor" pill badge)
  - [ ] Detection source indicator: "AI" or "Manual" small label
  - [ ] Status indicator: colored dot (green=ready, yellow=playing, gray=played)
- [ ] Implement drag-to-reorder
  - [ ] On drag, emit `clipQueue:reorderClip` socket event
  - [ ] Manual reorder overrides all priority boost logic for that clip
  - [ ] Show visual indicator for manually repositioned clips
- [ ] Implement skip/remove control
  - [ ] Skip button per card → emits `clipQueue:skipClip` socket event → sets status to "skipped"
  - [ ] Skipped clips move to collapsed "Skipped" section
  - [ ] Un-skip action → emits `clipQueue:unskipClip`
- [ ] Implement play control
  - [ ] Play button per card → emits `clipQueue:playClip` socket event
  - [ ] Currently playing clip highlighted/expanded at top
  - [ ] Countdown timer driven by `useTimesheet().remaining` (not a custom timer)
- [ ] Add `ClipQueuePanel` import to `ProducerView.jsx` in the left column grid area

#### 1.2.2 PrioritySettingsPanel Component

**File:** `show-controller/src/components/PrioritySettingsPanel.jsx`
**Integration point:** Opened as a modal/drawer from a settings button in `ClipQueuePanel`

- [ ] Create `PrioritySettingsPanel.jsx` as a modal component
- [ ] Read boost rules from Firebase `competitions/{compId}/clipQueue/settings/priority/boostRules/`
- [ ] Display each rule as a card with:
  - [ ] Toggle switch (enabled/disabled)
  - [ ] Threshold input (numeric, where applicable)
  - [ ] Boost strength selector (1, 2, 3, 5, 10, unlimited)
- [ ] Implement rule reordering (drag to reorder)
  - [ ] Write updated order to Firebase via `clipQueue:updatePrioritySettings` socket event
- [ ] Implement preset save/load
  - [ ] "Save as Preset" → writes to `competitions/{compId}/clipQueue/settings/priority/presets/`
  - [ ] Preset dropdown with "Regular Season" and "Championship" defaults
- [ ] Implement apparatus cycle order (drag to reorder the 4 apparatuses)

#### 1.2.3 SceneRecommendationBar Component

**File:** `show-controller/src/components/SceneRecommendationBar.jsx`
**Integration point:** Rendered in the ProducerView header area, near the existing `ConnectionStatus` component and OBS status badges

- [ ] Create `SceneRecommendationBar.jsx`
- [ ] Position in ProducerView header (persistent bar)
- [ ] Display current scene indicator:
  - [ ] Read from `useShow().state.obsCurrentScene` (already tracked by `obs:currentSceneChanged` event in ShowContext)
  - [ ] Show: "LIVE — Beam" or "CLIP — Jane Smith, Beam" or "IDLE"
  - [ ] Color: green for live, blue for clip, gray for idle
- [ ] Display recommended next action:
  - [ ] Read apparatus state from `clipQueueState.apparatusState` in ShowContext
  - [ ] Read clip queue from `clipQueueState.clips`
  - [ ] When `useTimesheet().remaining < 15000` on current video segment, evaluate:
    - Any apparatus started routine < 15s ago → "Go LIVE: [apparatus] — routine just started"
    - More clips ready → "Play next: [athlete, apparatus]"
    - Apparatus idle → "Go LIVE: [apparatus] — between routines"
    - Default → "Hold" or "Play next clip"
  - [ ] "Accept" button → emits `clipQueue:acceptRecommendation`
- [ ] Display 4 apparatus status indicators:
  - [ ] Read from `clipQueueState.apparatusState` (written by App B to Firebase)
  - [ ] Each shows: apparatus name, state (Idle/Active), elapsed time
  - [ ] Color: green (Idle), yellow (Active < 15s), red (Active > 15s)

> Note: In Phase 1 with manual-only clipping, apparatus state indicators may be static or manually updated. They become real-time in Phase 2+ with AI detection.

### 1.3 Integrate Clip Video Segments into Rundown (App A)

#### 1.3.1 Add mapClipToSegment to SegmentMapper

**File:** `server/lib/segmentMapper.js`

- [ ] Add `mapClipToSegment(clipRecord)` function that creates a valid editor-format segment:
  ```javascript
  function mapClipToSegment(clipRecord) {
    return {
      id: `clip-${clipRecord.clipId}`,
      name: `${clipRecord.athlete} — ${capitalize(clipRecord.apparatus)}`,
      type: 'video',
      duration: clipRecord.durationSeconds,
      scene: 'Clip Playback',
      graphic: {
        graphicId: 'routine-replay',
        params: {
          athlete: clipRecord.athlete,
          team: clipRecord.team,
          apparatus: clipRecord.apparatus,
          score: clipRecord.score,
          isReplay: true,
          priorityReason: clipRecord.priorityBoostReason,
          seasonAverage: clipRecord.seasonAverage,
          isSeasonBest: clipRecord.isSeasonBest,
          rotation: clipRecord.rotation,
          routineCount: clipRecord.routineCount
        }
      },
      timingMode: 'fixed',
      notes: clipRecord.priorityBoostReason || '',
      script: '',
      talent: [],
      audioCue: null,
      bufferAfter: 0,
      locked: false,
      optional: false,
      minDuration: 0,
      maxDuration: 0,
      // Clip-specific extension fields:
      clipId: clipRecord.clipId,
      videoUrl: clipRecord.videoUrl,
      apparatus: clipRecord.apparatus,
      clipAthleteData: { ... },
      detectionSource: clipRecord.detectionSource,
      rotationContext: clipRecord.routineCount
    };
  }
  ```
- [ ] Export `mapClipToSegment` from `segmentMapper.js`
- [ ] Test: pass a sample clip record, verify the output is a valid editor-format segment
- [ ] Verify `mapEditorToEngine(mapClipToSegment(clip))` produces a valid engine-format segment

#### 1.3.2 Auto-Insert Clips into Rundown

**File:** `server/index.js` (new Firebase listener in the coordinator server)

- [ ] Add a Firebase listener on `competitions/{compId}/clipQueue/clips/`
- [ ] When a new clip with status `ready_scored` or `ready_unscored` appears:
  - [ ] Call `mapClipToSegment(clipRecord)` to create a video segment
  - [ ] Insert the segment into `competitions/{compId}/production/rundown/segments/` at the appropriate position
  - [ ] Write back the clip's `rundownSegmentId` to link them
- [ ] When the queue is re-sorted (boost rule change, manual reorder):
  - [ ] Re-sort clip video segments in the rundown to match queue order
  - [ ] Non-clip segments retain their positions
- [ ] When a clip status changes to `played` or `skipped`:
  - [ ] Update or remove the corresponding rundown segment
- [ ] The existing live rundown sync (Phase I) will automatically detect these changes and emit `rundownModified` events, which `ProducerView` already handles

#### 1.3.3 Rundown Editor UI Changes

**File:** `show-controller/src/pages/RundownEditorPage.jsx`

- [ ] Render clip video segments with distinct visual style:
  - [ ] Video icon + apparatus color badge
  - [ ] Athlete name, team, score (or "Score pending" pulsing)
  - [ ] Duration
  - [ ] Priority boost tag
  - [ ] Detection source ("AI" / "Manual" label)
  - [ ] Detected by presence of `clipId` field on the segment
- [ ] Drag-and-drop already works for all segments — verify it works for clip segments too
- [ ] "Add Clip" button:
  - [ ] Opens a picker showing all clips from `competitions/{compId}/clipQueue/clips/`
  - [ ] Includes previously skipped clips (marked with "Skipped" badge)
  - [ ] Selecting a clip calls `mapClipToSegment()` and inserts at current position
- [ ] Remove clip segment:
  - [ ] When producer removes a clip video segment from the rundown
  - [ ] Emit `clipQueue:skipClip` socket event to set the clip status to `skipped`

#### 1.3.4 Talent View Changes

**File:** `show-controller/src/views/TalentView.jsx`

- [ ] When current segment has a `clipId` field (is a clip video segment):
  - [ ] Display clip-specific data: athlete name, team, apparatus (color badge), score, duration
  - [ ] Show alongside standard segment info (name, notes)
- [ ] Inject `priorityBoostReason` into the existing AI talking points panel:
  - [ ] If `clipAthleteData.priorityBoostReason` exists → add as high-priority talking point (red badge)
  - [ ] If `clipAthleteData.seasonAverage` exists → add as regular talking point ("Season avg: 9.812")
  - [ ] If `clipAthleteData.isSeasonBest` → add as milestone talking point (yellow badge, "Season Best!")
  - [ ] Add `rotationContext` as regular talking point ("Routine 5 of 6")
- [ ] Add "On Deck" display:
  - [ ] Show `useTimesheet().segments[currentIndex + 2]` as a third preview item
  - [ ] Uses same rendering as NextSegment but in a smaller/dimmer style
- [ ] Add timing alerts to countdown display:
  - [ ] When `useTimesheet().remaining <= 10000 && remaining > 5000` → yellow (#FFF3CD) background
  - [ ] When `useTimesheet().remaining <= 5000` → red (#F8D7DA) background
  - [ ] No custom timer — reads directly from `useTimesheet()` hook

### 1.4 Build Manual Clip Engine (App B — Python)

#### 1.4.1 Project Setup

- [ ] Create the Python project repository: `clip-engine/`
- [ ] Initialize with dependencies: firebase-admin, requests, flask, ffmpeg-python
- [ ] Project structure:
  ```
  clip-engine/
  ├─ src/
  │  ├─ stream_monitor/      # SRT ingestion and recording
  │  ├─ clip_extractor/      # FFmpeg clip extraction
  │  ├─ queue_manager/       # Virtius matching, priority, Firebase writes
  │  ├─ manual_ui/           # Web-based manual clipping interface
  │  └─ ai_detection/        # Placeholder for Phase 2+
  ├─ config/                 # Firebase credentials, Virtius API keys, SRT URLs
  └─ clips/                  # Local clip storage directory
  ```
- [ ] Configure Firebase Admin SDK
  - [ ] Initialize with service account JSON
  - [ ] Verify write access to `competitions/{compId}/clipQueue/` path
  - [ ] Test: write a dummy clip record and confirm it appears in Firebase console
- [ ] Configure Virtius API client
  - [ ] Build API client: fetch meet info, lineup/rotation data, poll for score events
  - [ ] Test: fetch lineup data for an upcoming meet

#### 1.4.2 Rolling SRT Recording

- [ ] Implement per-apparatus SRT stream recording via FFmpeg
  - [ ] FFmpeg segment muxer: write 60-second chunks per apparatus
  - [ ] Maintain rolling window (last 5 minutes = 5 segment files)
  - [ ] Auto-delete segments older than rolling window
- [ ] Handle stream connection management
  - [ ] Detect SRT disconnects → log warning, reconnect every 5 seconds
  - [ ] If down > 30 seconds → write `state: 'disconnected'` to `competitions/{compId}/clipQueue/apparatusState/{apparatus}`
- [ ] Test stability: 30+ minutes continuous recording without memory leaks

#### 1.4.3 Manual Clipping Interface

- [ ] Build web-based UI (Flask or FastAPI)
  - [ ] 4 panels, one per apparatus, each showing: apparatus name, stream status, current state
- [ ] "Mark Routine Start" button per apparatus
  - [ ] Records timestamp, shows elapsed timer
  - [ ] Re-tap resets the mark
- [ ] "Mark Routine End" button per apparatus
  - [ ] If start mark exists: clip = start - bufferBefore to end + bufferAfter
  - [ ] If no start mark: clip = end - quickClipLookback to end + bufferAfter
  - [ ] Triggers clip extraction
- [ ] "Quick Clip" button (one-tap shortcut, uses fixed lookback)
- [ ] "Cancel / Discard" button
- [ ] Keyboard shortcuts:
  - Q/W/E/R = Quick Clip for vault/bars/beam/floor
  - 1/2/3/4 = Mark Start
  - 5/6/7/8 = Mark End
  - Escape = Cancel active mark

#### 1.4.4 Clip Extraction Pipeline

- [ ] Given apparatus + start_time + end_time:
  - [ ] Identify rolling segment files covering the time range
  - [ ] FFmpeg concat + trim with configurable padding
  - [ ] Encode as H.264 MP4 at 1080p60
  - [ ] Filename: `{compId}-r{rotation}-{apparatus}-{position}.mp4`
- [ ] Target: < 10 seconds for a 90-second clip
- [ ] Copy to shared storage accessible by OBS on Production Box
  - [ ] Option A: shared network folder
  - [ ] Option B: S3 bucket
  - [ ] Option C: HTTP file server on AI Box
- [ ] Verify: OBS can play a clip from the shared storage path

#### 1.4.5 Virtius Score Matching

- [ ] Implement score polling (every N seconds)
- [ ] When new score arrives for apparatus X:
  - [ ] Find most recent clip on apparatus X with status `ready_unscored`
  - [ ] Set score, athlete confirmation, `scoreMatchedAt` timestamp
  - [ ] Update status from `ready_unscored` → `ready_scored`
  - [ ] If no unscored clip exists → log warning, store unmatched score
- [ ] Pre-load lineup data before meet:
  - [ ] Build lookup table: rotation + apparatus + lineup position → athlete, team
  - [ ] Set athlete/team on clip creation from lookup
  - [ ] On score match: verify athlete matches, flag mismatch for producer review

#### 1.4.6 Sequential Queue Ordering & Priority Calculation

- [ ] Assign `sequentialOrder` based on: rotation first, then apparatus cycle order, then lineup position
- [ ] Evaluate active boost rules from `competitions/{compId}/clipQueue/settings/priority/boostRules/`:
  - Anchor rule: is lineupPosition the last for this team?
  - Close score rule: is team score differential < threshold?
  - High score rule: is score > threshold?
  - AA leader rule: is athlete the current all-around leader?
- [ ] Set `priorityBoostReason` on matching clips
- [ ] Write complete clip record to `competitions/{compId}/clipQueue/clips/{clipId}`

### 1.5 OBS Configuration

#### 1.5.1 Create Clip Player Media Source

- [ ] Add "Clip Player" media source in OBS (no Loop, no auto-restart)
- [ ] Set to placeholder test video initially
- [ ] Verify source appears and plays

#### 1.5.2 Create Clip Playback Scene

- [ ] Create "Clip Playback" scene in OBS
- [ ] Add "Clip Player" media source (fill output frame)
- [ ] Add existing graphics overlay browser source (same as live scenes)
- [ ] Verify overlay renders on top of clip video

#### 1.5.3 Configure Transitions

- [ ] Set up FADE transition (0.5s) between live and Clip Playback scenes
  - [ ] This uses the existing transition system in `OBSSceneManager` (supports CUT, FADE, STINGER)
- [ ] Test: switch from live scene to Clip Playback and back
- [ ] Verify graphics overlay persists through transitions

#### 1.5.4 Wire Coordinator Server to OBS Media Source

**File:** `server/index.js` (add handler for `clipQueue:playClip` socket event)

- [ ] When `clipQueue:playClip` received with `{ clipId }`:
  1. Look up clip record from Firebase
  2. Call `mapClipToSegment(clipRecord)` to create a video segment
  3. Insert segment into the rundown and activate it via TimesheetEngine
  4. TimesheetEngine calls `_applyTransitionAndSwitchScene()` → `OBSConnectionManager`:
     - `SetInputSettings` on "Clip Player" to set `local_file` to the clip's `videoUrl`
     - `SetCurrentProgramScene` to "Clip Playback"
     - `TriggerMediaInputAction` with RESTART
  5. TimesheetEngine calls `_triggerGraphic()` with the `routine-replay` graphic
  6. Update clip status to `playing`, set `playbackStartedAt`

- [ ] When clip ends (TimesheetEngine auto-advances because `timingMode: 'fixed'`):
  - [ ] Update clip status to `played`
  - [ ] `clipQueue:recommendationUpdated` event sent with next suggestion

- [ ] Verify graphics trigger:
  - [ ] `routine-replay` graphic fires with full clip metadata
  - [ ] `isReplay: true` in params
  - [ ] `output.html` renders athlete name, team, apparatus, score

#### 1.5.5 End-to-End Integration Test

- [ ] Start Clip Engine with 4 SRT streams (recorded footage or live test)
- [ ] Manually clip 3–4 routines using the clipping interface
- [ ] Verify clips appear in `ClipQueuePanel` in ProducerView
- [ ] Verify clips appear as video segments in the rundown (RundownEditorPage)
- [ ] Play a clip: verify OBS switches to Clip Playback, video plays, `routine-replay` graphic fires
- [ ] Verify TalentView shows clip metadata, talking points, and countdown
- [ ] Verify timing alerts fire at 10s (yellow) and 5s (red)
- [ ] Verify TimesheetEngine auto-advances when clip ends
- [ ] Verify SceneRecommendationBar suggests next action
- [ ] Verify Virtius scores match to clips and queue re-sorts
- [ ] Verify drag-to-reorder in ClipQueuePanel updates rundown
- [ ] Verify skip/remove removes clip from rundown
- [ ] Fix all bugs found during integration testing

### 1.6 Add Socket Event Handlers to Coordinator Server

**File:** `server/index.js`

- [ ] Add handlers inside the existing socket connection block (scoped to `competition:{compId}` room):

```javascript
// Clip queue events
socket.on('clipQueue:playClip', async ({ clipId }) => { ... });
socket.on('clipQueue:skipClip', async ({ clipId }) => { ... });
socket.on('clipQueue:unskipClip', async ({ clipId }) => { ... });
socket.on('clipQueue:reorderClip', async ({ clipId, newPosition }) => { ... });
socket.on('clipQueue:acceptRecommendation', async ({ recommendationId }) => { ... });
socket.on('clipQueue:updatePrioritySettings', async ({ settings }) => { ... });
```

- [ ] Add broadcast emitters for clip state changes:

```javascript
// Broadcast to competition room
io.to(`competition:${compId}`).emit('clipQueue:clipAdded', { clipId, clip });
io.to(`competition:${compId}`).emit('clipQueue:clipUpdated', { clipId, changes });
io.to(`competition:${compId}`).emit('clipQueue:clipStatusChanged', { clipId, oldStatus, newStatus });
io.to(`competition:${compId}`).emit('clipQueue:apparatusStateChanged', { apparatus, state, elapsedMs });
io.to(`competition:${compId}`).emit('clipQueue:recommendationUpdated', { recommendation });
io.to(`competition:${compId}`).emit('clipQueue:queueReordered', { clips });
```

### 1.7 Add Clip Queue State to ShowContext

**File:** `show-controller/src/context/ShowContext.jsx`

- [ ] Add `INITIAL_CLIP_QUEUE_STATE`:
  ```javascript
  {
    clips: [],
    currentlyPlayingClipId: null,
    apparatusState: {
      beam: { state: 'idle', elapsedMs: 0 },
      bars: { state: 'idle', elapsedMs: 0 },
      floor: { state: 'idle', elapsedMs: 0 },
      vault: { state: 'idle', elapsedMs: 0 }
    },
    recommendation: null,
    prioritySettings: null,
    queueMode: 'standard'
  }
  ```
- [ ] Add socket handlers for all `clipQueue:*` events
- [ ] Export `clipQueueState` in the context value
- [ ] Create `useClipQueue()` hook for components to consume

---

## PHASE 2: AI DETECTION — BEAM PROTOTYPE
**Duration:** 2–3 weeks | **Goal:** Auto-detect beam routines; manual clipping remains for all other apparatuses

*(Phase 2–6 tasks are unchanged from Version 1.0 — the AI detection, expansion, cut-back logic, testing, and Story Mode phases are independent of the show controller integration details. The only difference is that all Firebase paths now use `competitions/{compId}/clipQueue/` instead of `/clipQueue/{meetId}/`.)*

### 2.1 Training Data Preparation
- [ ] Organize beam recording data from Phase 0 (minimum 3 meets, 50+ routines)
- [ ] Create evaluation scripts: detected vs ground-truth boundary comparison

### 2.2 Build Beam Detection Model
- [ ] Region-of-interest configuration tool (OpenCV bounding box)
- [ ] YOLOv8 nano person detection within beam ROI
- [ ] State machine: Idle → Active (3+ consecutive frames with person) → Complete (5+ frames without)
- [ ] Debouncing for brief occlusions and false activations
- [ ] Batch evaluation: target >90% detection, <5% false positive, boundaries within 5s

### 2.3 Integrate into Clip Engine
- [ ] Stream Monitor connects to beam SRT stream, runs detection at 3 fps
- [ ] On Routine Complete → triggers existing clip extraction pipeline
- [ ] Sets `detectionSource: "auto"` on clip record
- [ ] Manual clipping coexists with AI detection (manual takes precedence)
- [ ] Per-apparatus AI toggle in clipping UI
- [ ] Writes state updates to `competitions/{compId}/clipQueue/apparatusState/beam`

### 2.4 Shadow Mode Testing
- [ ] Run AI alongside manual operation for 2–3 meets
- [ ] Compare AI clips vs manual clips
- [ ] Graduate when: >95% detection, <3% false positive, boundaries within 5s

---

## PHASE 3: EXPAND DETECTION TO ALL APPARATUSES
**Duration:** 3–4 weeks | **Goal:** Auto-detect routines on vault, bars, and floor

### 3.1 Vault Detection
- [ ] Frame-differencing motion energy detector (no ML needed)
- [ ] State machine tuned for 5–8 second vault attempts
- [ ] Target: >95% detection, <5% false positive

### 3.2 Bars Detection
- [ ] YOLOv8 person detection within bars ROI (same approach as beam)
- [ ] Adjusted thresholds for 30–45 second routines
- [ ] Target: >90% detection, <5% false positive

### 3.3 Floor Detection (Dual Signal)
- [ ] Video motion analysis + audio FFT music detection
- [ ] Dual-signal: routine Active only when BOTH video motion AND audio music detected
- [ ] Target: >85% detection initially

### 3.4 Per-Apparatus Configuration UI
- [ ] Per-apparatus AI toggle, ROI editor, threshold adjustments
- [ ] 4-panel real-time state display with ROI overlay
- [ ] Writes to `competitions/{compId}/clipQueue/apparatusState/{apparatus}` for each apparatus

---

## PHASE 4: INTELLIGENT CUT-BACK & LIVE INTEGRATION
**Duration:** 2 weeks | **Goal:** Smart transitions between clips and live cameras

### 4.1 Real-Time State Dashboard
- [ ] `SceneRecommendationBar` now reads live apparatus data from Firebase (populated by AI detection)
- [ ] Accurate Idle/Active/elapsed for all 4 apparatuses
- [ ] Estimated time remaining per active routine

### 4.2 Cut-Back Recommendation Engine
- [ ] 5-level priority logic (see §4.6 of broadcast plan):
  1. Fresh start (< 15s ago)
  2. Anticipate start (pre-routine activity)
  3. Maximize remaining time
  4. Join in progress
  5. Play next clip
- [ ] Log recommendations vs producer choices → target >70% acceptance rate

### 4.3 Live-to-Queue Transitions
- [ ] Graphics: "REPLAY" bug for clips, "LIVE" bug for cameras, "LIVE — In Progress" for mid-routine
  - [ ] Implemented via `graphic.params.isReplay` flag in the existing graphics pipeline
- [ ] Live routine completion detection via `apparatusState` → recommends transition back to queue
- [ ] Test full cycle: clip → live → ride routine → clip → repeat

---

## PHASE 5: LIVE MEET TESTING & REFINEMENT
**Duration:** 2–3 weeks | **Goal:** Battle-tested at 3–5 real meets

### 5.1 Test Meet 1 (Dual-Mode)
- [ ] AI queue alongside traditional switching
- [ ] Post-meet: detection accuracy, clip quality, extraction time, score matching

### 5.2 Test Meet 2 (Primary Mode)
- [ ] Queue system as primary broadcast tool
- [ ] Post-meet: manual interventions, recommendation acceptance rate, commentator feedback

### 5.3 Test Meets 3–5 (Full Production)
- [ ] Full production for 3 additional meets
- [ ] Log metrics per meet, iterate on thresholds and UI

### 5.4 Documentation
- [ ] Operator guide: pre-meet setup, during-meet operation, troubleshooting
- [ ] Commentator guide: reading video items, timing alerts, priority tags

---

## PHASE 6: CHAMPIONSHIP STORY MODE
**Duration:** 3–4 weeks | **Goal:** Every routine, full-screen, perfectly sequenced

### 6.1 Delay Buffer
- [ ] Configurable 60–120 second broadcast delay
- [ ] All viewer output from clip queue, live feeds for monitoring only
- [ ] Verify no drift over 2+ hours

### 6.2 Sequence Optimizer
- [ ] Auto-sequencing: alternate teams, save anchors, cluster by apparatus rotation
- [ ] Producer preview and one-tap approve

### 6.3 Enhanced Championship Graphics
- [ ] Rotation progress tracker, team score comparison, AA standings, "routine of the meet"
- [ ] All triggered via existing `_triggerGraphic()` → `competitions/{compId}/currentGraphic` pipeline

### 6.4 Broadcast Mode Selection
- [ ] "Standard" vs "Story Mode" selector
- [ ] Mode stored at `competitions/{compId}/clipQueue/settings/mode`
- [ ] Affects all components via `clipQueueState.queueMode`
