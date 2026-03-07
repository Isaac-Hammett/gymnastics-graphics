# GYMNASTICS BROADCAST — INTELLIGENT QUEUE SYSTEM

## Project Plan & Technical Architecture

Version 2.0 | March 2026

CONFIDENTIAL

---

## 1. Executive Summary

### 1.1 The Problem
Gymnastics meets run multiple apparatuses simultaneously. Current broadcast approaches force a choice between a quad-view where no routine is large enough to appreciate, or a manually-switched single view where routines are inevitably missed. Both options require either heavy operator workload or significant compromise in viewer experience.

### 1.2 The Solution
Build an AI-powered clip queue system that automatically detects when routines start and end on each apparatus, clips them from the live camera feeds, matches them with scoring data from the Virtius API, ranks them by priority, and presents them in a curated linear stream. One operator supervises the queue rather than manually switching between cameras. Every routine gets full-screen presentation. Commentators see what is coming next and for how long, enabling polished commentary.

### 1.3 Key Design Principles
- **One operator (the producer) runs the entire show.** The system must be nearly autonomous with the producer acting as supervisor, not pilot.
- **AI routine detection is core infrastructure, not a future nice-to-have.** The system cannot function at scale without it because human spotters are unreliable and one producer cannot watch four feeds simultaneously. However, full manual clipping is always available as a parallel capability — AI reduces workload but never gates the producer's ability to produce the show.
- **The clip engine and the show controller are separate applications connected through Firebase.** This allows independent iteration on each system.
- **The queue defaults to sequential competition order** (oldest routine first, cycling through apparatuses) so the broadcast follows the meet's natural narrative. Optional, configurable priority boost rules can promote specific clips. The producer can always manually reorder.
- **The system recommends scene switches to the producer but never forces them.** The producer always makes the final switching decision.
- **Clips are integrated into the existing rundown as extended "video" segments**, so commentators see clips alongside graphics in a single unified timeline with timing information driven by the existing TimesheetEngine.
- **The Virtius score event provides metadata (athlete, score) but not clip timing.** Routine boundary detection and score matching are separate problems joined after the fact.
- **Graceful degradation at every layer.** If AI detection fails, the producer clips manually. If a score is delayed, the clip still queues with lineup data. If the queue is empty, the system recommends live cameras.

---

## 2. System Architecture

### 2.1 Two-Application Model
The system is split into two independent applications that communicate through Firebase Realtime Database. This separation is critical: the show controller is stable production software, while the clip engine will be experimental and iterated on rapidly. They must not be tightly coupled.

#### App A: Show Controller (Existing)
**Codebase:** `gymnastics-graphics` repository

| Component | Path | Description |
|-----------|------|-------------|
| React + Vite frontend | `show-controller/src/` | Operator and commentator interfaces |
| Coordinator server | `server/index.js` | Socket.io server, multi-competition management |
| TimesheetEngine | `server/lib/timesheetEngine.js` | Show execution engine (segment timing, auto-advance, hold logic) |
| SegmentMapper | `server/lib/segmentMapper.js` | Editor↔Engine segment format conversion, deep diff for live sync |
| OBSConnectionManager | `server/lib/obsConnectionManager.js` | Per-competition OBS websocket connections with heartbeat |
| OBSStateSync | `server/lib/obsStateSync.js` | Mirrors OBS state to Firebase |
| Graphics overlays | `output.html`, `overlays/` | Vanilla HTML/CSS rendered as OBS browser sources |

**Existing segment types:**
- `video` — Pre-recorded video playback (will be extended for clips)
- `live` — Live camera feed with optional graphics overlay
- `static` — Static graphics/slides
- `break` — Commercial/intermission break
- `hold` — Producer decision point with min/max durations
- `graphic` — Graphics overlay only

**Existing segment data model (Editor format):**
```javascript
{
  id: string,                    // Unique identifier
  name: string,                  // Segment title (e.g., "Sarah Johnson - Beam")
  type: string,                  // 'video' | 'live' | 'static' | 'break' | 'hold' | 'graphic'
  duration: number | null,       // Seconds (null for untimed segments)
  scene: string | null,          // OBS scene name
  graphic: {                     // Graphic configuration
    graphicId: string,           // Which graphic to display (e.g., 'routine-replay')
    params: object               // Parameters passed to graphics renderer
  } | null,
  timingMode: string,            // 'fixed' (auto-advance) | 'manual' (wait for producer)
  notes: string,                 // Producer notes
  script: string,                // Teleprompter script for talent
  talent: string[],              // Assigned talent IDs
  audioCue: object | null,       // Audio cue { songName, inPoint, outPoint }
  bufferAfter: number,           // Delay before advancing (seconds)
  locked: boolean,               // Segment locked for editing
  optional: boolean,             // Can be skipped
  minDuration: number,           // Minimum hold time (for hold segments)
  maxDuration: number            // Maximum hold time (for hold segments)
}
```

**New additions to App A:**
- A `ClipQueuePanel` component in `ProducerView.jsx` that reads clip data from Firebase and controls OBS media source playback
- A `SceneRecommendationBar` component in the ProducerView header area
- Extended clip metadata display in `TalentView.jsx` for commentators
- New clip-related socket events on the coordinator server
- A `mapClipToSegment()` function in `segmentMapper.js`

#### App B: Clip Engine (New — Python)
- Receives the same four SRT streams from venue iPhones
- Runs AI routine detection models on each feed
- Extracts routine clips using FFmpeg
- Matches clips with Virtius score data
- Calculates priority ranking
- Writes complete clip records to Firebase under `competitions/{compId}/clipQueue/clips/`
- Stores clip video files to shared storage accessible by OBS

**Why Python:** The AI and video processing ecosystem (OpenCV, PyTorch, YOLOv8, FFmpeg bindings) lives in Python. Attempting this in Node.js would mean fighting the tooling at every step.

### 2.2 Hardware Configuration

| Machine | Role | Specs & Notes |
|---------|------|---------------|
| Production Box | OBS, show controller, stream output, graphics rendering | RTX 3070 Ti. Dedicated to broadcast output. No AI workload. |
| AI Box | SRT ingest, routine detection, clip extraction, queue management | RTX 2080 Ti (11GB VRAM). Runs 4 detection streams at 2–5 fps inference. Alternatively, cloud GPU (T4 instance at ~$0.35/hr) for flexibility. |

### 2.3 Data Flow
The complete signal flow from venue cameras to viewer screen:

1. iPhones at venue send 1080p60 SRT streams (one per apparatus) over the network.
2. Both the Production Box and AI Box receive the SRT streams.
3. AI Box samples frames from each stream at 2–5 fps and runs routine detection.
4. When a routine is detected as complete, the AI Box extracts the clip via FFmpeg from a rolling buffer of the SRT recording.
5. AI Box writes the clip file to shared storage (local network share, S3 bucket, or HTTP file server).
6. AI Box listens to the Virtius API for score events and matches incoming scores to the most recent unmatched clip on that apparatus.
7. AI Box writes the complete clip record to Firebase under `competitions/{compId}/clipQueue/clips/{clipId}`.
8. Show Controller (App A) receives the Firebase update via real-time listener. The coordinator server creates a corresponding video segment and inserts it into the rundown via `segmentMapper.mapClipToSegment()`.
9. The system recommends the next scene to the producer via the `SceneRecommendationBar`. When the producer accepts (or manually selects a clip), the TimesheetEngine activates the video segment, which triggers OBS scene switching via `OBSConnectionManager` and graphics via `_triggerGraphic()`.
10. When the clip ends, the TimesheetEngine auto-advances to the next segment (since clip video segments use `timingMode: 'fixed'`), and the `SceneRecommendationBar` updates with the next recommendation.

### 2.4 Firebase Data Structure

Firebase serves as the bridge between App A and App B. Both apps read and write to the same paths, using Firebase's real-time listeners for instant updates.

**Existing paths (App A already uses):**
```
competitions/{compId}/
  ├─ rundown/
  │  └─ segments/                    [Array of engine-format segments]
  ├─ currentGraphic/                 [Current graphic trigger payload]
  ├─ production/
  │  ├─ rundown/
  │  │  ├─ config/                   [Rundown configuration]
  │  │  ├─ segments/                 [Editor-format segments]
  │  │  └─ analytics/{runId}/        [Real-time timing analytics]
  │  └─ talent/                      [Talent roster]
  └─ rtnStats/                       [RTN leaderboard data]
```

**New paths (added for clip queue):**
```
competitions/{compId}/clipQueue/
  ├─ clips/
  │  └─ {clipId}/                    [Individual clip records]
  │     ├─ clipId: string            [Format: {compId}-r{rotation}-{apparatus}-{lineupPosition}]
  │     ├─ videoUrl: string          [Path to clip file in shared storage]
  │     ├─ apparatus: string         [beam | bars | floor | vault]
  │     ├─ athlete: string           [Athlete full name from lineup data]
  │     ├─ team: string              [Team name from lineup data]
  │     ├─ score: number | null      [null until Virtius score matched]
  │     ├─ rotation: number          [Which rotation this clip is from]
  │     ├─ lineupPosition: number    [Position in lineup for this apparatus]
  │     ├─ routineCount: string      [e.g., "3 of 6" for display]
  │     ├─ durationSeconds: number   [Clip length in seconds]
  │     ├─ status: string            [detected|ready_unscored|ready_scored|playing|played|skipped]
  │     ├─ detectionSource: string   [auto|manual|auto+manual]
  │     ├─ priorityBoostReason: string | null  ["Anchor routine"|"Close team score"|"Season best"]
  │     ├─ sequentialOrder: number   [Position in default chronological queue]
  │     ├─ createdAt: number         [Timestamp when clip was created]
  │     ├─ scoreMatchedAt: number | null
  │     ├─ playbackStartedAt: number | null
  │     ├─ manualStartMark: number | null
  │     ├─ manualEndMark: number | null
  │     ├─ seasonAverage: number | null
  │     ├─ isSeasonBest: boolean
  │     └─ rundownSegmentId: string | null  [Links to the segment in the rundown, if inserted]
  │
  ├─ state/
  │  ├─ currentlyPlayingClipId: string | null
  │  ├─ autoAdvance: boolean
  │  └─ mode: string                [standard | story]
  │
  ├─ apparatusState/
  │  └─ {apparatus}/                 [beam | bars | floor | vault]
  │     ├─ state: string             [idle | active | complete | disconnected]
  │     ├─ elapsedMs: number         [Time since routine started, if active]
  │     ├─ estimatedRemainingMs: number | null
  │     └─ lastUpdated: number
  │
  └─ settings/
     ├─ priority/
     │  ├─ defaultOrder: string      ["sequential"]
     │  ├─ apparatusCycleOrder: array ["vault","bars","beam","floor"]
     │  ├─ boostRules: array         [Ordered list of boost rule objects]
     │  └─ presets: object           [Saved priority preset configurations]
     │
     └─ apparatus/
        └─ {apparatus}/
           ├─ clipBufferBefore: number
           ├─ clipBufferAfter: number
           ├─ quickClipLookback: number
           ├─ aiDetectionEnabled: boolean
           └─ regionOfInterest: object | null
```

### 2.5 Socket.io Events (New)

All clip-related events are scoped to the `competition:{compId}` socket room, matching the existing multi-competition pattern in `server/index.js`.

**Server → Client broadcasts:**

| Event | Data | Description |
|-------|------|-------------|
| `clipQueue:clipAdded` | `{ clipId, clip }` | New clip available in queue |
| `clipQueue:clipUpdated` | `{ clipId, changes }` | Clip record updated (score matched, status changed) |
| `clipQueue:clipStatusChanged` | `{ clipId, oldStatus, newStatus }` | Clip state transition |
| `clipQueue:apparatusStateChanged` | `{ apparatus, state, elapsedMs }` | Routine detection state update |
| `clipQueue:recommendationUpdated` | `{ recommendation }` | Scene recommendation changed |
| `clipQueue:queueReordered` | `{ clips }` | Queue order changed (priority recalculation) |

**Client → Server commands:**

| Event | Data | Description |
|-------|------|-------------|
| `clipQueue:playClip` | `{ clipId }` | Producer triggers clip playback |
| `clipQueue:skipClip` | `{ clipId }` | Producer skips a clip |
| `clipQueue:unskipClip` | `{ clipId }` | Producer restores a skipped clip |
| `clipQueue:reorderClip` | `{ clipId, newPosition }` | Producer manually repositions a clip |
| `clipQueue:acceptRecommendation` | `{ recommendationId }` | Producer accepts scene recommendation |
| `clipQueue:updatePrioritySettings` | `{ settings }` | Producer changes priority configuration |

### 2.6 ShowContext Integration

The existing `ShowContext.jsx` (`show-controller/src/context/ShowContext.jsx`) manages all show state via React Context. Clip queue state will be added as a new state slice:

```javascript
// Added to ShowContext.jsx
const INITIAL_CLIP_QUEUE_STATE = {
  clips: [],                      // Array of clip records, sorted by effective queue order
  currentlyPlayingClipId: null,
  apparatusState: {               // Real-time detection state per apparatus
    beam: { state: 'idle', elapsedMs: 0 },
    bars: { state: 'idle', elapsedMs: 0 },
    floor: { state: 'idle', elapsedMs: 0 },
    vault: { state: 'idle', elapsedMs: 0 }
  },
  recommendation: null,           // Current scene recommendation
  prioritySettings: null,         // Active priority configuration
  queueMode: 'standard'           // 'standard' | 'story'
};
```

**New socket handlers in ShowContext:**
```javascript
socket.on('clipQueue:clipAdded', (data) => { /* append to clips array */ });
socket.on('clipQueue:clipUpdated', (data) => { /* merge changes into clip */ });
socket.on('clipQueue:clipStatusChanged', (data) => { /* update clip status */ });
socket.on('clipQueue:apparatusStateChanged', (data) => { /* update apparatus state */ });
socket.on('clipQueue:recommendationUpdated', (data) => { /* update recommendation */ });
socket.on('clipQueue:queueReordered', (data) => { /* replace clips array */ });
```

---

## 3. AI Routine Detection

*(This section is unchanged from Version 1.0 — the AI detection architecture is independent of the show controller integration and does not need updates.)*

### 3.1 Why Detection is Tractable
Three factors make this problem much easier than general-purpose activity recognition. First, the cameras are static: a locked-off iPhone on a tripod means the background never changes, which makes motion-based and region-based detection highly reliable. Second, the apparatuses are fixed objects in the frame, so you can define a region of interest once per camera setup and reuse it all meet. Third, routines have strong temporal structure: clear beginnings (salute, mount) and endings (dismount, salute) with sustained activity in between.

### 3.2 Per-Apparatus Detection Strategy

**Vault (Easiest):** The frame is mostly empty between routines. A gymnast enters, runs, contacts the table, lands, and exits. The entire routine is 5–8 seconds. A simple motion energy detector (frame differencing) with a threshold for sustained motion reliably captures vault attempts. Minimal or no ML training required.

**Beam (Favorable):** The beam is a fixed object in the frame. The detection model defines a bounding box around the beam region. When a person is detected inside that region (using off-the-shelf YOLOv8 person detection), the routine is active. When the person leaves the region, the routine is complete. The mount and dismount create clear transition signals.

**Bars (Favorable):** Similar to beam. The apparatus is fixed, the routine has a clear occupied/unoccupied state, and dismounts produce dramatic visual changes in the frame. The same region-of-interest approach with person detection applies.

**Floor (Hardest):** The competition area is large, coaches and other athletes may be near the edges, and warm-up movement between routines can resemble performance. The visual-only approach is less reliable here. However, floor routines have a strong audio signal: music. The iPhone microphone captures the routine music, and a simple audio energy and frequency analysis (FFT-based) can distinguish between music playing (routine active) and ambient crowd noise (routine inactive). The recommended approach is dual-signal: video motion analysis combined with audio music detection, requiring both signals to agree before declaring a routine active.

### 3.3 Detection Architecture

The detection system runs as three components on the AI Box:

**Stream Monitor:** Connects to each SRT stream via FFmpeg or OpenCV. Samples frames at 2–5 fps (sufficient for state detection; analyzing every frame is unnecessary). Runs the detection model per apparatus. Maintains a state machine per feed with three states: Idle, Routine Active, and Routine Complete. Emits internal events when state transitions occur. Writes state updates to Firebase at `competitions/{compId}/clipQueue/apparatusState/{apparatus}`.

**Clip Extractor:** Listens for Routine Complete events. Each SRT stream is continuously recorded to a rolling buffer file (e.g., the last 5 minutes). When a routine completes, the extractor uses FFmpeg to cut the segment from the buffer file based on the start and end timestamps. The clip is encoded and written to shared storage. A small padding (3–5 seconds before start and after end) ensures the salute and reaction are captured.

**Queue Manager:** Listens to the Virtius API for score events. Maintains a mapping of expected athletes per apparatus per rotation (loaded from lineup data before the meet). When a score arrives, it matches the score to the most recent unscored clip on that apparatus. Once matched, it calculates the priority ranking and writes the complete record to Firebase at `competitions/{compId}/clipQueue/clips/{clipId}`.

### 3.4 Detection Model Path

Start with the simplest approach that works and add complexity only as needed:
- **V1 — Region + Person Detection:** Off-the-shelf YOLOv8 nano model for person detection within a hand-drawn region of interest per apparatus. No custom training. Works for beam, bars, and vault.
- **V2 — Add Audio for Floor:** Layer in FFT-based music detection from the iPhone audio stream. Dual-signal (video + audio) for floor routines.
- **V3 — Boundary Refinement:** If V1/V2 produce clips with too much dead space, add a lightweight model trained on your own meet footage to more precisely detect mount/dismount moments.
- **V4 — Full Custom Model:** Only if V1–V3 are insufficient. Train a custom activity recognition model on accumulated meet recordings. This requires significant data and compute but gives the highest accuracy.

### 3.5 Manual Override: Producer Clipping

AI detection is the primary clipping mechanism, but the producer must always have full manual control over routine clipping. The system operates in a dual-mode where AI detection and manual clipping coexist at all times, not as fallback but as parallel capabilities.

**Manual Clipping Interface:** The producer has access to a clipping panel (in either App A or a lightweight companion UI on App B) with the following controls per apparatus:
- **Mark Routine Start:** Producer taps to manually mark the beginning of a routine. This overrides any AI-detected start time for the current routine on that apparatus.
- **Mark Routine End:** Producer taps to mark the end of a routine. This immediately triggers clip extraction from the rolling buffer, using the manual start (if marked) or falling back to the AI-detected start (if available) or a fixed lookback window.
- **Quick Clip (End Only):** A single-tap shortcut that marks the routine as ended and grabs the last N seconds (per-apparatus default). This is the fastest manual mode — one tap per routine, same as the Phase 1 MVP.
- **Cancel / Discard:** If the AI auto-detected a clip that the producer does not want (false positive, warm-up captured by mistake), the producer can discard it from the queue before it airs.

**Dual-Mode Operation:** AI detection and manual clipping run simultaneously. The rules for coexistence are:
- If AI detects a routine and the producer has not manually intervened, the AI-generated clip is used.
- If the producer manually marks a start or end, the manual timestamps take precedence over AI detection for that routine.
- If AI misses a routine entirely, the producer can manually clip it with no dependency on the AI.
- If the producer wants to run the entire meet manually (AI disabled or untrusted for a given camera), they can toggle AI detection off per apparatus and clip everything by hand.
- Every clip record in Firebase includes a `detectionSource` field: `"auto"`, `"manual"`, or `"auto+manual"` (AI detected the boundaries but the producer adjusted one or both).

This design ensures the system is fully operational even if AI detection is turned off entirely. The AI reduces workload but never gates the producer's ability to produce the show.

---

## 4. Priority Queue & Playback Logic

### 4.1 Default Queue Order: Sequential by Competition
By default, the queue plays routines in competition order — the oldest unplayed routine across all apparatuses is played next. The system cycles through apparatuses so the viewer sees the meet unfold as it actually happened: first vault, then next bars, then next beam, then next floor, rotating through. Within each apparatus, routines always play in the order they were performed (oldest first). If three floor routines are queued, the system plays the first one before the second, never jumping ahead.

This sequential-by-competition default ensures the broadcast feels like a coherent narrative of the meet rather than a highlight reel. The viewer experiences the meet in order, apparatus by apparatus, rotation by rotation.

### 4.2 Priority Boost Rules (Optional Overrides)
On top of the sequential default, the system supports optional priority boost rules that can promote specific clips ahead of the chronological queue. These rules are configurable and can be enabled, disabled, or reordered by the producer through a Priority Settings interface in the Show Controller.

**Default Boost Rules (all optional and configurable):**
- Anchor routines (last in lineup for a team) can be boosted to play sooner.
- Close team score situations (differential < configurable threshold) can boost routines from both teams.
- Exceptionally high individual scores (above a configurable threshold like 9.800+) can jump the queue.
- All-around leader routines can be tagged for priority.
- Each rule can be toggled on/off independently and the boost strength (how far ahead in the queue a clip can jump) is adjustable.

### 4.3 Priority Settings Interface
The `PrioritySettingsPanel` component (accessed as a modal/drawer from the `ClipQueuePanel`) allows the producer to:
- Toggle each boost rule on or off individually.
- Adjust thresholds for each rule (e.g., change the close-score threshold from 2 points to 1 point, change the high-score threshold from 9.800 to 9.850).
- Reorder the boost rules to change which takes precedence when multiple rules apply to the same clip.
- Manually drag clips in the queue to any position, overriding all automated ordering. Manual reordering is always the final authority.
- Save priority presets for different meet types (e.g., "Regular Season" with minimal boosting vs. "Championship" with aggressive boosting for close scores and anchors).

Changes to priority settings are written to `competitions/{compId}/clipQueue/settings/priority/` and take effect immediately, re-sorting the queue in real time via the `clipQueue:queueReordered` socket event.

### 4.4 Priority Reason Tags
When a boost rule promotes a clip, the clip record includes a `priorityBoostReason` tag (e.g., "Anchor routine," "Season best," "Close team score"). This tag is surfaced in both the `ClipQueuePanel` (producer) and `TalentView` (commentator), giving commentators a natural talking point for each routine. These tags map to the existing AI talking points system in `TalentView.jsx`, appearing as high-priority talking points alongside AI-generated context.

### 4.5 Clip States
Each clip moves through a linear state machine:
- **Detected:** The AI has identified routine boundaries and the clip is being extracted.
- **Ready (Unscored):** `ready_unscored` — The clip is extracted and available. Apparatus and lineup position are known, but the Virtius score has not arrived yet.
- **Ready (Scored):** `ready_scored` — The Virtius score has been matched. Full metadata available. Priority calculated.
- **Playing:** Currently being played on the broadcast. The corresponding video segment is active in the TimesheetEngine.
- **Played:** Playback complete. Remains in the database for potential re-play or highlight compilation.
- **Skipped:** Operator manually skipped this clip. Logged for post-meet analysis.

### 4.6 Intelligent Live Cut-Back
When a clip finishes playing, the system must decide what to show next. This is the central production challenge. The AI detection system serves a second critical purpose here: it knows the real-time routine state on every apparatus (via `competitions/{compId}/clipQueue/apparatusState/`), enabling intelligent cut-back decisions.

Cut-back priority logic, evaluated in order:
1. **Catch a fresh start:** If any apparatus has a routine that started within the last 10–15 seconds, cut live to that feed. The viewer sees nearly the entire routine.
2. **Anticipate a start:** If any apparatus is idle and the detection system sees a gymnast approaching (pre-routine setup), cut to that feed. The viewer arrives just in time.
3. **Maximize remaining time:** If multiple apparatuses are mid-routine, cut to the one with the most estimated time remaining. The viewer sees more of the routine.
4. **Join in progress:** If no good entry point exists, cut to the highest-priority mid-routine feed with a "LIVE — Routine in Progress" graphic.
5. **Stay in queue mode:** If the queue has more clips ready and the live situation is messy, play the next clip. There is no requirement to return to live between every clip.

For Story Mode at championships, option 5 (stay in queue mode) may be the primary approach, rarely or never cutting to live. The live cameras serve purely as source material for the clip engine.

---

## 5. OBS Integration & Producer Recommendations

### 5.1 Scene Structure
OBS requires the following scenes to support the queue system:
- **Live scenes (existing):** One per apparatus, each with an SRT media source. These are already configured and managed via `OBSConnectionManager`.
- **Clip Playback scene (new):** Contains a single media source called "Clip Player" configured for local file playback (no loop, no auto-restart). The existing graphics overlay browser source renders on top.
- **Transition scene (optional):** A brief branded transition (0.5–1s fade with a "REPLAY" bug) that plays between live and clip scenes. Configured via the existing transition system (`OBSSceneManager` supports CUT, FADE, and STINGER transition types).

### 5.2 Scene Recommendation System

Rather than automatically triggering OBS scene changes, the system provides the producer with clear, real-time recommendations on which scene should be active. The producer always makes the final switching decision.

**SceneRecommendationBar component** (`show-controller/src/components/SceneRecommendationBar.jsx`):

This component renders in the ProducerView header area, near the existing OBS connection status indicators. It displays:

- **Current Scene:** Read from the existing `obsCurrentScene` in ShowContext (already tracked via `obs:currentSceneChanged` socket event). Shows: "LIVE — Beam" or "CLIP — Jane Smith, Beam" or "IDLE". Color-coded: live scenes in green, clip playback in blue, idle in gray.

- **Recommended Next:** The system's suggestion for what the producer should switch to next, with a reason. Calculated from `clipQueueState.apparatusState` and the clip queue contents. Displays as: action + target + reason (e.g., "Play clip: Sarah Johnson, Floor [Anchor routine]" or "Go LIVE: Bars [routine just started]"). "Accept" button: one tap to execute the recommendation (emits `clipQueue:acceptRecommendation` socket event).

- **4 Apparatus Status Indicators:** Read from `clipQueueState.apparatusState` (populated by App B writing to Firebase `competitions/{compId}/clipQueue/apparatusState/`). Each indicator shows: apparatus name, current state (Idle/Active), elapsed time if active. Color code: green (Idle), yellow (Active < 15s), red (Active > 15s).

**Recommendation Logic:**
- During clip playback: As the TimesheetEngine tick reports `remainingMs < 10000` on the current video segment, evaluate all four apparatus states and recommend the best next action.
- After a clip ends: The TimesheetEngine auto-advances to the next segment. If the next segment is another video (clip), it plays automatically. If not, the recommendation bar suggests the best live scene.
- During live: When the apparatusState for the active camera changes from `active` to `idle` (routine ended), the recommendation updates to suggest the next action.

**Producer Actions:**
The producer can accept the recommendation with a single tap (pre-loaded for instant switch), override with their own choice (manually select any live scene or any clip), or ignore the recommendation and stay on the current scene. The system never forces a scene change.

### 5.3 Media Source Control

When the producer triggers clip playback (either accepting a recommendation or manually selecting a clip), the flow is:

1. Producer clicks Play on a clip in `ClipQueuePanel` or accepts a recommendation → emits `clipQueue:playClip` socket event
2. Coordinator server receives event, creates/activates a video segment in the rundown via `segmentMapper.mapClipToSegment(clipRecord)`
3. TimesheetEngine activates the segment, calling `_applyTransitionAndSwitchScene()` via `OBSConnectionManager`
4. The engine calls `OBSWebSocket.call('SetInputSettings', { inputName: 'Clip Player', inputSettings: { local_file: clipVideoUrl } })`
5. Then `OBSWebSocket.call('SetCurrentProgramScene', { sceneName: 'Clip Playback' })`
6. Then `OBSWebSocket.call('TriggerMediaInputAction', { inputName: 'Clip Player', mediaInputAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' })`
7. When the clip ends (TimesheetEngine detects `elapsed >= duration`), it auto-advances to the next segment

This leverages the existing segment activation flow — the only new OBS commands are the media source file swap and playback restart. All scene switching goes through the established `OBSConnectionManager` → `OBSSceneManager` pipeline.

### 5.4 Graphics Triggering

When a clip begins playback, the TimesheetEngine calls its existing `_triggerGraphic(segment)` method. The clip video segment is created with:

```javascript
graphic: {
  graphicId: 'routine-replay',
  params: {
    athlete: 'Sarah Johnson',
    team: 'UCLA',
    apparatus: 'beam',
    score: 9.875,
    isReplay: true,
    priorityReason: 'Anchor routine',
    seasonAverage: 9.812,
    isSeasonBest: true,
    rotation: 3,
    routineCount: '5 of 6'
  }
}
```

This writes to `competitions/{compId}/currentGraphic` via the existing path, and `output.html` renders the `routine-replay` graphic type (new graphic to build). The `isReplay` flag allows the graphics renderer to show a "REPLAY" bug and adjust the lower-third layout.

When cutting back to live, the next segment's graphic (e.g., `now-competing` or `scorebug`) fires through the same pipeline, automatically clearing the replay graphics.

---

## 6. Rundown Integration

### 6.1 The Existing Rundown System

The Show Controller includes a complete rundown system (see `docs/PRD-Rundown-System/PRD-Rundown-System-2026-01-23.md`):

- **Rundown Editor** (`show-controller/src/pages/RundownEditorPage.jsx`): UI for creating/editing segments at `/{compId}/rundown`
- **TimesheetEngine** (`server/lib/timesheetEngine.js`): Server-side execution engine with tick-based timing, auto-advance, hold segments, rehearsal mode
- **SegmentMapper** (`server/lib/segmentMapper.js`): Converts between editor format and engine format, provides deep diff for live sync
- **Producer View** (`show-controller/src/views/ProducerView.jsx`): Full production control at `/{compId}/producer`
- **Talent View** (`show-controller/src/views/TalentView.jsx`): Commentator interface at `/{compId}/talent`
- **ShowContext** (`show-controller/src/context/ShowContext.jsx`): Central state management via React Context
- **useTimesheet hook** (`show-controller/src/hooks/useTimesheet.js`): React hook providing timing state and control actions

The rundown already supports `video` segments with `duration`, `scene`, and `graphic` fields. The clip queue system extends this existing type rather than creating a new one.

### 6.2 Extended Video Segment Type for Clips

The existing `video` segment type is extended with clip-specific fields. When App B writes a clip record to Firebase, the coordinator server creates a video segment using a new `mapClipToSegment()` function in `segmentMapper.js`:

```javascript
// New function in server/lib/segmentMapper.js
function mapClipToSegment(clipRecord) {
  return {
    id: `clip-${clipRecord.clipId}`,
    name: `${clipRecord.athlete} — ${clipRecord.apparatus}`,
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
    timingMode: 'fixed',          // Auto-advances when clip ends
    notes: clipRecord.priorityBoostReason || '',
    script: '',
    talent: [],
    // Clip-specific extension fields:
    clipId: clipRecord.clipId,
    videoUrl: clipRecord.videoUrl,
    apparatus: clipRecord.apparatus,
    clipAthleteData: {
      athlete: clipRecord.athlete,
      team: clipRecord.team,
      score: clipRecord.score,
      seasonAverage: clipRecord.seasonAverage,
      isSeasonBest: clipRecord.isSeasonBest
    },
    detectionSource: clipRecord.detectionSource,
    rotationContext: clipRecord.routineCount
  };
}
```

**Key design decisions:**
- Clip video segments use `timingMode: 'fixed'` so the TimesheetEngine auto-advances when the clip duration completes. No custom countdown logic needed — the engine's existing tick system provides `elapsed`, `remaining`, and `progress`.
- The `scene` field is set to `'Clip Playback'` so the engine automatically switches OBS via `_applyTransitionAndSwitchScene()`.
- The `graphic` field uses the existing trigger pipeline — no special graphics code needed.
- Clip-specific fields (`clipId`, `videoUrl`, `apparatus`, `clipAthleteData`, `detectionSource`, `rotationContext`) are additional properties that the engine passes through but doesn't interpret. UI components read them for display.

### 6.3 Rundown Editor Changes

The `RundownEditorPage.jsx` gains the following capabilities for clip-generated video segments:

- **Visual differentiation:** Video segments created from clips render with a distinct style: apparatus color badge, athlete name, team, score (or "Score pending" pulsing indicator), duration, priority boost tag, and detection source ("AI" or "Manual" label). These are distinguished from manually-created video segments by the presence of a `clipId` field.

- **Auto-insertion from clip queue:** When a new clip with status `ready_scored` or `ready_unscored` appears in Firebase `competitions/{compId}/clipQueue/clips/`, the coordinator server creates a corresponding video segment and inserts it into the rundown at the appropriate position based on the queue sort order.

- **Drag-and-drop:** Producer can drag clip video segments to any position in the rundown, interleaving them with other segment types (graphics, live, hold, break). This is handled by the existing rundown editor drag mechanism.

- **Remove:** Producer can remove a clip video segment from the rundown. This emits `clipQueue:skipClip` which sets the clip's status to `skipped` in Firebase.

- **Manual add:** "Add Clip" button opens a picker showing all available clips (including skipped ones). Producer selects a clip to insert at the current position.

- **"Go Live" segment:** Producer can insert a `live` type segment targeting a specific apparatus scene. When the TimesheetEngine reaches this segment, it switches OBS to that live scene via the existing `_applyTransitionAndSwitchScene()` flow.

### 6.4 Commentator View of the Rundown (TalentView)

The existing `TalentView.jsx` already displays:
- Current segment with countdown (from TimesheetEngine `timesheetTick` events providing `elapsed`/`remaining`)
- Script panel (teleprompter)
- AI talking points with priority levels (milestones, high priority, regular)
- "ON CAMERA" alert when talent is assigned to current segment
- Control buttons (Prev/Pause/Next)
- Run of Show timeline

**Additions for clip segments:**

- **Clip metadata display:** When the current segment is a clip video (has `clipId` field), `TalentView` shows the clip-specific data: athlete name, team, apparatus (color-coded badge), score, and duration. This replaces/supplements the standard segment name display.

- **Priority reason as talking point:** The `priorityBoostReason` from the clip (e.g., "Anchor routine", "Season best") is injected into the existing AI talking points panel as a high-priority item. This gives commentators a ready-made framing for each routine.

- **Season average and rotation context:** Displayed in the AI talking points panel alongside the existing milestones and priority points. E.g., "Season average: 9.812 — this 9.875 is a season best" or "Routine 5 of 6 in this rotation — final routine coming next."

- **"On Deck" addition:** Currently TalentView shows current + next segment. Add an "On Deck" (third segment) preview. This gives commentators a two-item lookahead. Read from `useTimesheet().segments[currentIndex + 2]`.

- **Timing alerts:** The TimesheetEngine already provides `remainingMs` via tick events. Add visual color changes at 10 seconds remaining (yellow border/background) and 5 seconds remaining (red border/background) on the countdown display.

### 6.5 Contextual Information for Commentary

Each clip video segment in the rundown provides enrichment data surfaced through the `TalentView.jsx` AI talking points system:

| Data | Source | Display |
|------|--------|---------|
| Priority reason | `clipAthleteData.priorityBoostReason` | High-priority talking point (red badge) |
| Season average | `clipAthleteData.seasonAverage` | Regular talking point (purple badge) |
| Season best flag | `clipAthleteData.isSeasonBest` | Milestone (yellow badge) |
| Rotation context | `rotationContext` | Regular talking point |
| Team score context | Calculated from Virtius API data | High-priority if score changed lead |

### 6.6 Timing Alerts

The existing `useTimesheet` hook provides:
```javascript
const { remaining, elapsed, progress } = useTimesheet();
```

Timing alert implementation in both `ProducerView` and `TalentView`:
- `remaining <= 10000 && remaining > 5000` → Yellow (#FFF3CD) background on countdown
- `remaining <= 5000` → Red (#F8D7DA) background on countdown
- No custom timer logic needed — the TimesheetEngine tick system drives all timing

---

## 7. Build Phases

*(Section 7 is unchanged from Version 1.0 — see the Build Checklist document for the updated, codebase-aligned task breakdown.)*

Each phase builds on the previous one and produces a testable, usable increment. The system is designed so that earlier phases work independently even if later phases are delayed or deferred.

**Phase 1: Queue Service & Firebase Bridge (2 weeks)** — Build the clip queue infrastructure end-to-end with fully manual clipping. Prove the queue-to-OBS-to-graphics pipeline works before adding any AI.

**Phase 2: AI Detection — Beam Prototype (2–3 weeks)** — Replace manual routine marking on beam with AI detection. Beam first because it has the clearest visual signals.

**Phase 3: Expand Detection to All Apparatuses (3–4 weeks)** — Extend AI detection from beam to vault, bars, and floor.

**Phase 4: Intelligent Cut-Back & Live Integration (2 weeks)** — Use the AI detection state to make smart decisions about when and where to cut back to live cameras between queued clips.

**Phase 5: Live Meet Testing & Refinement (2–3 weeks)** — Run the full system in production at 3–5 meets.

**Phase 6: Championship Story Mode (3–4 weeks)** — Build the premium championship package where every routine is presented full-screen with complete narrative context.

Total estimated timeline: 14–18 weeks from project start to championship-ready Story Mode.

---

## 8. Timeline Summary

| Phase | Description | Duration | Key Deliverable |
|-------|-------------|----------|-----------------|
| 1 | Queue Service & Firebase Bridge | 2 weeks | Manual clip queue working end-to-end |
| 2 | AI Detection — Beam Prototype | 2–3 weeks | Auto-detection on beam |
| 3 | Expand Detection to All Apparatuses | 3–4 weeks | All four apparatuses auto-detected |
| 4 | Intelligent Cut-Back & Live Integration | 2 weeks | Smart live/queue transitions |
| 5 | Live Meet Testing & Refinement | 2–3 weeks | Battle-tested at 3–5 meets |
| 6 | Championship Story Mode | 3–4 weeks | Full championship broadcast package |

---

## 9. Success Metrics

| Metric | Current State | Target |
|--------|---------------|--------|
| % of routines shown full-screen | ~25% (manual switching) | >90% (Story Mode: 100%) |
| Average routine viewport size | 25% of screen (quad view) | 100% of screen |
| Operator manual actions per meet | 120+ (every routine) | <15 (corrections only) |
| AI detection accuracy (routines correctly found) | N/A | >95% |
| Clip boundary accuracy (within N sec of optimal) | N/A | Within 5 seconds |
| Score-to-clip match rate | N/A | >98% |
| Crew size required | 1 operator | 1 operator (unchanged) |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Virtius score delay exceeds 4+ minutes | Clips queue without scores; priority ranking unavailable | Pre-loaded lineup data provides athlete/team info. Clips play with partial metadata. Score added as update graphic when it arrives. |
| AI detection misses routines on floor | Incomplete coverage on hardest apparatus | Floor is last to get AI detection. Manual trigger remains as fallback. Audio-based music detection supplements video. |
| SRT stream drops or iPhone disconnects | Loss of one apparatus feed | AI Box monitors stream health (writes to `apparatusState`). Queue continues serving clips from other apparatuses. |
| Clip storage fills up during long meets | New clips cannot be saved | Rolling cleanup: clips with status "played" deleted after 30 minutes. Pre-meet disk space check. |
| Firebase goes down | Queue and graphics lose real-time sync | App B maintains local queue state. Operator falls back to manual OBS switching. |
| GPU inference too slow for 4 streams | Detection lag causes late or missed clips | YOLOv8 nano on 2080 Ti at 2–5 fps per stream is well within capacity. Cloud GPU available as backup. |

---

## 11. Immediate Next Steps

To begin Phase 1 development this week:

1. **Record 2–3 meets with static cameras now.** Even before building anything, every recorded meet is training data for Phase 2. Manually log routine timestamps in a spreadsheet.

2. **Set up the Firebase `competitions/{compId}/clipQueue/` structure** and write a test script that populates it with sample clip records. Verify your Show Controller can read them via a Firebase `onValue` listener.

3. **Configure OBS Clip Player.** Add the media source and clip playback scene. Test programmatic file swapping via `OBSConnectionManager` using the existing `obs:updateInputSettings` socket event.

4. **Scaffold the Python Clip Engine project.** Set up the repo with FFmpeg, Firebase Admin SDK, and a basic SRT recording pipeline. Build the manual clipping interface.

5. **Add `mapClipToSegment()` to `server/lib/segmentMapper.js`.** Get a basic version working where clip records become video segments in the rundown. Test that the TimesheetEngine can execute them.

6. **Build `ClipQueuePanel` in ProducerView.** Subscribe to Firebase `competitions/{compId}/clipQueue/clips/`, display the queue list, and wire up the Play button to emit `clipQueue:playClip`.

7. **Measure Virtius score latency.** At your next 2–3 meets, log the time between when a routine visually ends and when the score appears in the Virtius API.

---

## Appendix A: Codebase Reference

### Key File Paths

| File | Purpose |
|------|---------|
| `show-controller/src/views/ProducerView.jsx` | Producer interface — add ClipQueuePanel and SceneRecommendationBar here |
| `show-controller/src/views/TalentView.jsx` | Commentator interface — add clip metadata display and On Deck here |
| `show-controller/src/context/ShowContext.jsx` | Central state management — add clipQueue state slice and socket handlers |
| `show-controller/src/hooks/useTimesheet.js` | Timing hook — provides elapsed, remaining, progress, formatTime() |
| `show-controller/src/pages/RundownEditorPage.jsx` | Rundown editor — add clip visual style and Add Clip button |
| `server/index.js` | Coordinator server — add clipQueue socket event handlers |
| `server/lib/timesheetEngine.js` | Show execution engine — drives all segment timing and OBS switching |
| `server/lib/segmentMapper.js` | Segment format conversion — add mapClipToSegment() |
| `server/lib/obsConnectionManager.js` | Per-competition OBS websocket connections |
| `server/lib/obsStateSync.js` | Mirrors OBS state to Firebase |
| `output.html` | Graphics renderer — add routine-replay graphic type |

### Existing Segment Data Model (Editor Format)

```javascript
{
  id: string,
  name: string,
  type: 'video' | 'live' | 'static' | 'break' | 'hold' | 'graphic',
  duration: number | null,
  scene: string | null,
  graphic: { graphicId: string, params: object } | null,
  timingMode: 'fixed' | 'manual',
  notes: string,
  script: string,
  talent: string[],
  audioCue: { songName: string, inPoint: string, outPoint: string } | null,
  bufferAfter: number,
  locked: boolean,
  optional: boolean,
  minDuration: number,
  maxDuration: number
}
```

### Existing Segment Data Model (Engine Format)

```javascript
{
  id: string,
  name: string,
  type: string,
  duration: number,
  obsScene: string | null,
  graphic: string | null,
  graphicData: object,
  autoAdvance: boolean,
  notes: string,
  script: string,
  talent: string[],
  audioCue: object | null,
  bufferAfter: number,
  locked: boolean,
  optional: boolean,
  minDuration: number,
  maxDuration: number,
  videoFile: string,        // For video segments
  videoSource: string       // OBS media source name
}
```

### Existing Socket Events (Show Control)

| Event | Direction | Data |
|-------|-----------|------|
| `startTimesheetShow` | Client→Server | `{}` |
| `stopTimesheetShow` | Client→Server | `{}` |
| `pauseTimesheetShow` | Client→Server | `{}` |
| `resumeTimesheetShow` | Client→Server | `{}` |
| `advance` | Client→Server | `{}` |
| `previous` | Client→Server | `{}` |
| `jumpTo` | Client→Server | `{ segmentId }` |
| `loadRundown` | Client→Server | `{ compId }` |
| `timesheetOverrideScene` | Client→Server | `{ sceneName }` |
| `timesheetTick` | Server→Client | `{ elapsedMs, remainingMs, progress, ... }` |
| `timesheetSegmentActivated` | Server→Client | `{ segment, index, reason }` |
| `timesheetSegmentCompleted` | Server→Client | `{ segmentId, endReason, durationMs }` |
| `timesheetState` | Server→Client | Full engine state object |
| `timesheetShowStarted` | Server→Client | `{ timestamp, segmentCount }` |
| `timesheetShowStopped` | Server→Client | `{ timestamp, showDurationMs, ... }` |
| `rundownModified` | Server→Client | `{ summary }` |

### Existing Firebase Paths

| Path | Description |
|------|-------------|
| `competitions/{compId}/rundown/segments/` | Engine-format segments |
| `competitions/{compId}/production/rundown/segments/` | Editor-format segments |
| `competitions/{compId}/production/rundown/config/` | Rundown configuration |
| `competitions/{compId}/production/rundown/analytics/{runId}/` | Timing analytics |
| `competitions/{compId}/currentGraphic/` | Current graphics trigger |
| `competitions/{compId}/production/talent/` | Talent roster |
