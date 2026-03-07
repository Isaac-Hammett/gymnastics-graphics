# Clip System Integration Architecture

## Decision Record — March 2026

This document captures architectural decisions made for how the clip/replay system integrates with the show controller. These decisions supersede parts of the original broadcast plan docs.

**Last updated:** March 6, 2026 — revised after discussion with clip engine developer.

---

## Key Architectural Decisions

### 1. No Local File Storage — Cloud URLs Only

**Decision:** Video clips are stored on S3 and referenced by HTTPS URL. No local/network file paths.

**Rationale:**
- Everything in the system is cloud-based (Firebase, AWS EC2)
- Multiple competitions run simultaneously — local files don't scale
- The show controller and clip engine run on different machines

### 2. Video Playback via Browser Source, Not OBS Media Source

**Decision:** Clip video playback happens inside `output.html` using an HTML5 `<video>` element, not via an OBS media source.

**Rationale:**
- `output.html` already runs as an OBS browser source for all graphics
- A `<video>` element can play S3 URLs directly
- Graphics overlay (athlete name, score, "REPLAY" badge) renders in the same browser source on top of the video
- No new OBS scenes or sources needed
- No `SetInputSettings` / `TriggerMediaInputAction` OBS commands needed for clip playback

**What this replaces from the original plan:**
- ~~OBS "Clip Player" media source~~ → `<video>` element in `output.html`
- ~~OBS "Clip Playback" scene~~ → existing scene, same browser source
- ~~`SetInputSettings` to swap file path~~ → Firebase write triggers video in browser
- ~~Local/network file storage~~ → S3 with HTTPS URLs

### 3. All Video Trimming Happens in the Clip Engine — NOT the Show Controller

**Decision:** The show controller never trims, transcodes, or processes video. All trimming (including highlight clips and slow-motion renders) is done by the clip engine's GPU-accelerated clipper. The show controller only plays finished clips.

**Rationale (from clip engine developer):**
- Precise start/end point trimming in the browser is unreliable at scale — MP4 seeking snaps to keyframes, not exact timestamps
- The clip engine already has a GPU-accelerated high-speed trimming pipeline with filmstrip scrubbing, sprite generation, transcoding, and S3 serving
- Rebuilding that in the browser would take weeks and produce an inferior result
- The show controller should focus on the producer workflow (queue management, playback, graphics) and not video engineering

**What this replaces from our earlier discussion:**
- ~~Browser-side `currentTime` seeking to in/out points~~ → clips pre-trimmed by clip engine
- ~~Browser-side `playbackRate` for slow motion~~ → slow-motion rendered by clip engine (GPU)
- ~~Producer marks in/out points in show controller UI~~ → producer uses clip engine's filmstrip clipper UI
- ~~Highlights are "just playback parameters on full routine videos"~~ → highlights are separate, pre-trimmed clips on S3

### 4. Two-App Separation of Concerns

**App B (Clip Engine):**
- Records SRT streams from venue cameras
- As scores come in from Virtius, auto-generates **draft clips** (rough cuts around each routine)
- Provides a **high-speed filmstrip clipper UI** for the producer to finalize exact start/end points
- GPU-accelerated trimming and transcoding (including slow-motion renders)
- Stores finished clips on S3
- Writes clip records to Firebase RTDB with S3 URLs + athlete info + scores
- Handles all video processing: sprite generation, transcoding, serving
- **Does NOT** know about OBS, graphics, rundowns, or timing

**App A (Show Controller — React/Node):**
- Reads clip records from Firebase RTDB
- Displays clip queue to the producer (the "clip bin")
- Plays finished S3 URLs in `output.html` with graphics overlay — no trimming, no seeking, just play start-to-finish
- Sequences multiple clips for highlight reels
- Manages rundown integration and timing
- **Does NOT** do any video processing, trimming, or transcoding

**The contract:** App B writes finished clip records (with S3 URLs) to Firebase. App A reads them and plays them. Firebase is the only integration point.

---

## Clip Lifecycle

### 1. Draft Clips (Auto-Generated)

As scores come in from Virtius during a meet, the clip engine auto-generates **draft clips** — rough cuts around each routine based on timing data. These appear in the clip queue as drafts.

Out of ~100 routines in a meet, the producer typically cares about **20-30**.

### 2. Finalized Clips (Producer-Trimmed)

For clips the producer wants to air, they open the clip engine's **filmstrip clipper UI** to finalize exact start/end points. This UI is already built and GPU-accelerated — trimming takes a few seconds.

The clip engine produces two types of finalized clips:

**Full routine replay** — the complete routine, trimmed to clean start/end points.

**Highlight clip** — a short segment (dismount, tumbling pass, save) potentially rendered in slow motion. This is a separate, pre-rendered file on S3 — not a seek range on the full video.

### 3. Played Clips

The show controller plays the finalized clip via `output.html` with graphics on top. The video plays start-to-finish — no seeking, no playback rate manipulation.

---

## Two Playback Modes

### Mode 1: Single Clip Replay

Play one finalized clip (full routine or highlight) with graphic overlay.

```javascript
// Written to competitions/{compId}/currentGraphic
{ graphic: "routine-replay", data: {
    videoUrl: "https://s3.amazonaws.com/.../clip-001.mp4",
    athlete: "Sarah Smith",
    team: "Stanford",
    score: 9.875,
    apparatus: "beam",
    isHighlight: false   // true → shows "SLO-MO" badge, false → shows "REPLAY" badge
}}
```

`output.html` behavior:
- `<video>` element loads `videoUrl`, plays from start to end
- Graphic overlay shows athlete name, team, score, apparatus, REPLAY/SLO-MO badge
- When video ends, graphic clears, video hides → transparent again

### Mode 2: Highlight Reel (End-of-Rotation Montage)

Play a sequence of finalized highlight clips back-to-back — typically 4-5 moments from different routines in a rotation.

```javascript
{ graphic: "highlight-reel", data: {
    title: "Rotation 3 Highlights",
    clips: [
      {
        videoUrl: "https://s3.amazonaws.com/.../highlight-007.mp4",
        athlete: "Sarah Smith",
        team: "Stanford",
        apparatus: "beam",
        score: 9.875
      },
      {
        videoUrl: "https://s3.amazonaws.com/.../highlight-009.mp4",
        athlete: "Jane Lee",
        team: "UCLA",
        apparatus: "bars",
        score: 9.900
      },
      {
        videoUrl: "https://s3.amazonaws.com/.../highlight-012.mp4",
        athlete: "Maria Garcia",
        team: "Cal",
        apparatus: "vault",
        score: 9.950
      },
      {
        videoUrl: "https://s3.amazonaws.com/.../highlight-015.mp4",
        athlete: "Emily Chen",
        team: "Oregon State",
        apparatus: "floor",
        score: 9.825
      }
    ]
}}
```

`output.html` behavior:
- Plays clips sequentially with crossfade/cut transitions between each
- Updates the athlete name/score graphic for each clip in the sequence
- Each clip plays start-to-finish (already trimmed and rendered at correct speed)
- When the last clip ends, clears everything

---

## Producer Workflow

### During a Rotation

1. **Scores come in** → clip engine auto-generates draft clips → they appear in the show controller's clip queue
2. **Producer reviews drafts** → picks the ones they want to air (maybe 20-30 out of 100)
3. **For full replays** → producer may use the draft as-is, or open the clipper to tighten the start/end
4. **For highlights** → producer opens the clip engine's filmstrip clipper UI, sets exact in/out and slow-motion, clipper renders and writes back to Firebase
5. **Producer plays clips** from the show controller queue → `output.html` plays the S3 URL with graphics on top

### Building a Highlight Reel

During the rotation, the producer banks highlight clips they want in the end-of-rotation montage:

```
┌─ Rotation 3 Highlight Bank ───────────────┐
│                                            │
│  1. Sarah Smith — Beam dismount       [▶]  │
│  2. Jane Lee — Bars release           [▶]  │
│  3. Maria Garcia — Vault landing      [▶]  │
│  4. Emily Chen — Floor tumble         [▶]  │
│                                            │
│  [+ Add from Clip Bin]                     │
│                                            │
│  ▶ Play Highlight Reel    [Reorder]        │
└────────────────────────────────────────────┘
```

Each item in the bank is already a finalized, pre-trimmed clip on S3. When the producer hits "Play Highlight Reel", the show controller just plays them in sequence. No video processing needed.

---

## Firebase Schema

### Clip Records (Written by Clip Engine)

```
competitions/{compId}/clipQueue/clips/{clipId}/
  clipId: string              // unique identifier
  videoUrl: string            // S3 HTTPS URL to finished MP4
  apparatus: string           // beam | bars | floor | vault
  athlete: string             // "Sarah Smith"
  team: string                // "Stanford"
  score: number | null        // null until Virtius score matched
  rotation: number            // which rotation
  lineupPosition: number      // position in lineup
  routineCount: string        // "3 of 6"
  durationSeconds: number     // clip length (of the trimmed clip)
  status: string              // draft | ready | playing | played | skipped
  clipType: string            // "routine" (full routine) | "highlight" (trimmed moment)
  isSlowMotion: boolean       // true if rendered in slow motion
  parentClipId: string | null // for highlights, links back to the full routine clip
  sequentialOrder: number     // position in chronological queue
  createdAt: number           // timestamp
```

**Status values:**
- `draft` — auto-generated rough cut, not yet finalized by producer
- `ready` — finalized and ready to air
- `playing` — currently being played
- `played` — already aired
- `skipped` — producer decided not to air this one

**Clip types:**
- `routine` — full routine replay (trimmed to clean start/end)
- `highlight` — short moment (dismount, tumble, save), possibly slow-motion

### Highlight Reel Bank (Written by Show Controller)

```
competitions/{compId}/clipQueue/reelBank/{rotation}/
  clips: [clipId, clipId, clipId, ...]   // ordered list of clip IDs for this rotation's reel
```

---

## Component Ownership

| Component | Owner | Description |
|-----------|-------|-------------|
| SRT recording | Clip Engine | Record venue camera streams |
| Draft clip generation | Clip Engine | Auto-create rough cuts as scores arrive |
| Filmstrip clipper UI | Clip Engine | GPU-accelerated trimming with frame-accurate scrubbing |
| Slow-motion rendering | Clip Engine | GPU-rendered slow-motion clips |
| S3 storage + serving | Clip Engine | Store and serve finished MP4s |
| Virtius score matching | Clip Engine | Match scores to clips, populate athlete/team data |
| Firebase clip record writes | Clip Engine | Write finished clip records to RTDB |
| `ClipQueuePanel` | Show Controller | Producer UI showing clip queue / clip bin |
| Highlight reel bank UI | Show Controller | Per-rotation highlight collection and sequencing |
| `routine-replay` in output.html | Show Controller | `<video>` plays S3 URL + graphic overlay |
| `highlight-reel` in output.html | Show Controller | Sequential playlist playback |
| Socket events + coordinator | Show Controller | clipQueue:* events, rundown integration |

---

## First Integration Test

To validate the handoff without building the full system:

1. **Clip engine** writes 2-3 sample clip records to `competitions/{testCompId}/clipQueue/clips/` in Firebase with real S3 URLs to test MP4s
2. **Show controller** reads those records and displays them in a basic clip queue UI
3. **Show controller** plays one clip in `output.html` with graphics overlay
4. If that works end-to-end, the integration contract is validated
