# PRD: Clip Integration (Show Controller)

**Status:** NOT STARTED
**Date:** 2026-03-17
**Last Updated:** 2026-03-17

---

## 1. Overview

Integrate an externally-built Clip Engine into the Show Controller so producers can play routine replay clips and sequenced highlight reels during livestreams. The Clip Engine handles all video recording, trimming, and serving — our work is the producer UI, playback in `output.html`, and highlight reel sequencing.

**Key constraint:** We do NOT build the Clip Engine. It is developed and maintained externally. We consume its REST API.

---

## 2. Architecture

### Two-App Separation

| Responsibility | Owner | Notes |
|----------------|-------|-------|
| SRT recording, routine detection, trimming, transcoding, Cloudflare R2 storage | **Clip Engine** (external) | GPU-accelerated, Python-based |
| REST API serving clip metadata | **Clip Engine** (external) | Redis-cached backend |
| Producer clip queue UI | **Show Controller** (us) | React component in ProducerView |
| Video playback + graphic overlay | **Show Controller** (us) | `<video>` element in `output.html` |
| Highlight reel sequencing | **Show Controller** (us) | Ordered playlist, played back-to-back |

### Integration Point

**REST API** (not Firebase). The Show Controller polls or fetches clips from the Clip Engine's API by Virtius session key.

- **Endpoint:** TBD (not yet finalized)
- **Method:** `GET`
- **Query:** By `session_key` (maps to a Virtius competition/meet)
- **Backend:** Redis cache — fast reads, expect changes in keys and abstraction as API matures
- **Filtering:** Client-side (fetch all clips for a session, filter in the UI)
- **Clip URLs:** Pre-signed Cloudflare R2 URLs (S3-compatible), 7-day expiration (`X-Amz-Expires=604800`)
- **Clips:** Pre-trimmed with in/out points — no browser-side seeking or trimming needed

### What Changed from Original Architecture

The original plan (archived in `docs/_archive/clip-tool/`) assumed:
- Firebase RTDB as the integration point (clip records written to `competitions/{compId}/clipQueue/`)
- We would build both apps

**Now:**
- REST API is the integration point (Redis-cached)
- Clip Engine is external — we only build the Show Controller side
- No Firebase writes from the Clip Engine

---

## 3. API Contract

### Request

```
GET {TBD_ENDPOINT}/{session_key}
```

### Response (Confirmed — 62 clips from real meet)

```json
{
  "session_key": "qs7UHFKiJa",
  "total": 62,
  "clips": [
    {
      "draft_id": "f7894797-08d9-453f-b1c2-e62ac0ec34f0",
      "clip_url": "https://7f611de901ab5b1fb66ea466991895a9.r2.cloudflarestorage.com/virtius-input/clips/{clip-uuid}/output.mp4?X-Amz-Algorithm=...&X-Amz-Expires=604800&...",
      "athlete_name": "Tamyra Singletary",
      "athlete_id": "Yy7eesNtLQcY5Hq2T640T",
      "team_name": "University of Bridgeport",
      "apparatus": "VT",
      "rotation": 1,
      "order": 0,
      "score": 9.725,
      "exported_at": "2026-03-15T19:36:55.109711"
    }
  ]
}
```

### Confirmed Fields (Live in API)

| Field | Type | Notes |
|-------|------|-------|
| `draft_id` | UUID string | Unique clip identifier |
| `clip_url` | string | Pre-signed Cloudflare R2 URL, 7-day expiry |
| `athlete_name` | string | Display name from Virtius |
| `athlete_id` | string | **Mixed formats**: some UUIDs (`12cd66a0-...`), some Virtius IDs (`Yy7eesNtLQcY5Hq2T640T`) |
| `team_name` | string | Full university name (e.g., "Southern Connecticut State University") |
| `apparatus` | string | Women's: `VT`, `UB`, `BB`, `FX`. Men's: `FX`, `PH`, `SR`, `VT`, `PB`, `HB` |
| `rotation` | number | 1-indexed rotation number |
| `order` | number | **0-indexed** lineup position within the rotation |
| `score` | number | Final score |
| `exported_at` | string | ISO timestamp with microseconds |

### Requested Fields (Pending from Clip Engine Developer)

| Field | Type | Why We Want It |
|-------|------|----------------|
| `team_id` | string | Match to `teamsDatabase` for logo/colors (string matching `team_name` is fragile) |
| `duration` | number | Clip length in seconds for producer queue UI and highlight reel timing |
| `gender` | string | `mens` or `womens` — determines apparatus set |
| `rtn_id` | string | RTN athlete ID for stats overlay enrichment |
| `thumbnail_url` | string | Still frame for clip queue card preview |
| `in_point` / `out_point` | number | Original trim timecodes for reference |
| `competition_name` | string | Meet name from Virtius (e.g., "Yale vs Southern Connecticut vs Bridgeport") |
| `source_video_id` | string | Reference to full-length source video |

### Real Data Observations (from `qs7UHFKiJa` session)

- **62 clips** from a **women's tri-meet**: Yale, University of Bridgeport, Southern Connecticut State University
- **4 rotations**, **4 apparatus** (VT, UB, BB, FX)
- **`order` is 0-indexed** — lineup position 0 = first up
- **Multiple athletes per `order` slot** — each team has their own order=0, order=1, etc. within the same rotation
- **`exported_at` timestamps vary** — clips are not exported in chronological meet order (some R4 clips exported before R1 clips), likely due to async processing
- **`athlete_id` format inconsistency** — some are standard UUIDs, some are Virtius-style alphanumeric strings. Our adapter must handle both.

**Note:** Expect changes in keys and abstraction as the API stabilizes. Our integration code should be resilient to missing/renamed fields.

### Field Mapping to Show Controller

| API Field | Show Controller Use |
|-----------|---------------------|
| `clip_url` | `<video>` src in `output.html` |
| `athlete_name` | Graphic overlay, clip queue UI |
| `team_name` | Graphic overlay, clip queue UI |
| `team_id` | Match to `teamsDatabase` for logo/colors |
| `apparatus` | Graphic overlay badge, filtering |
| `score` | Graphic overlay |
| `rotation` | Filtering, highlight reel grouping |
| `order` | Lineup position, sequencing |
| `duration` | Clip queue UI (show clip length), highlight reel timing |
| `gender` | Apparatus set determination (men's 6 vs women's 4) |
| `draft_id` | Unique clip identifier |
| `thumbnail_url` | Clip queue card preview image |
| `rtn_id` | Link to RTN stats for overlay enrichment |
| `in_point` / `out_point` | Display only (informational) |
| `exported_at` | Sort order, freshness |

---

## 4. User Stories

### Story 1: Producer Loads Clip Queue

**As a** producer during a live meet,
**I want** to see all available routine clips for the current competition,
**so that** I can choose which routines to replay.

**Flow:**
1. Competition has a Virtius `session_key` configured
2. Show Controller fetches all clips from the Clip Engine API
3. Clips appear in a `ClipQueuePanel` in the ProducerView, sorted by `exported_at`
4. Each clip card shows: thumbnail, athlete name, team, apparatus, score, duration
5. Producer can filter by apparatus, rotation, or team
6. Producer can refresh the clip list to pick up newly exported clips

### Story 2: Producer Plays Single Clip Replay

**As a** producer,
**I want** to play a single routine clip with a graphic overlay,
**so that** viewers see the replay with athlete name, team, score, and a REPLAY badge.

**Flow:**
1. Producer clicks "Play" on a clip in the queue
2. Show Controller writes to `competitions/{compId}/currentGraphic`:
   ```json
   { "graphic": "routine-replay", "data": {
       "videoUrl": "https://...",
       "athlete": "Annie Bilbe",
       "team": "Yale University",
       "teamLogo": "https://...",
       "score": 9.9,
       "apparatus": "FX"
   }}
   ```
3. `output.html` loads the video, plays start-to-finish with graphic overlay
4. When video ends, graphic clears, video hides (transparent)
5. Clip status in queue updates to "played"

### Story 3: Producer Builds and Plays Highlight Reel

**As a** producer between rotations,
**I want** to sequence 3-5 highlight clips into a montage,
**so that** viewers see the best moments from the rotation played back-to-back.

**Flow:**
1. During the rotation, producer banks clips into a highlight reel
2. Producer reorders clips via drag-and-drop
3. Producer clicks "Play Highlight Reel"
4. `output.html` plays clips sequentially, updating the athlete/score graphic for each clip
5. When the last clip ends, clears everything

### Story 4: Commentator Sees Upcoming Clips

**As a** commentator,
**I want** to see which clip is about to play (athlete, team, apparatus, score),
**so that** I can prepare relevant commentary.

---

## 5. Acceptance Criteria

- [ ] Clip queue panel visible in ProducerView when competition has a session key
- [ ] Clips fetched from Clip Engine REST API and displayed with thumbnail, athlete, team, apparatus, score, duration
- [ ] Filter clips by apparatus, rotation, team
- [ ] Single clip replay plays in `output.html` with graphic overlay (athlete name, team logo, score, apparatus, REPLAY badge)
- [ ] Video plays start-to-finish, clears on end
- [ ] Highlight reel: producer can bank clips, reorder, and play sequentially
- [ ] Highlight reel updates graphic overlay per clip during playback
- [ ] Commentator/talent view shows upcoming clip info
- [ ] Integration handles missing/renamed API fields gracefully (defensive parsing)
- [ ] Clip queue auto-refreshes or has manual refresh button

---

## 6. Key Files (Planned)

| Component | File | Status |
|-----------|------|--------|
| Clip queue panel (producer UI) | `show-controller/src/components/ClipQueuePanel.jsx` | New |
| Clip queue hook | `show-controller/src/hooks/useClipQueue.js` | New |
| Clip API service | `show-controller/src/lib/clipService.js` | New |
| Routine replay graphic | `output.html` (new graphic type) | Extend |
| Highlight reel playback | `output.html` (new graphic type) | Extend |
| Clip API proxy (coordinator) | `server/index.js` (new endpoint) | Extend |
| ProducerView integration | `show-controller/src/views/ProducerView.jsx` | Extend |
| TalentView clip info | `show-controller/src/views/TalentView.jsx` | Extend |

---

## 7. Technical Notes

### API Resilience
The Clip Engine API is backed by Redis and is under active development. Expect:
- Key names may change as the API matures
- New fields may be added
- Response structure may be abstracted differently

Our integration code should:
- Use a dedicated API adapter/service layer (`clipService.js`) that normalizes the external response into our internal clip model
- Default missing fields gracefully (e.g., `duration ?? null`, `thumbnail_url ?? null`)
- Log warnings for unexpected response shapes, don't crash

### Video Playback
- Clips are pre-trimmed — play start-to-finish, no seeking
- Cloudflare R2 URLs are pre-signed, 7-day expiration, no refresh logic needed
- `<video>` element in `output.html` as an OBS browser source (same pattern as existing graphics)
- Video plays on a layer behind/beside the graphic overlay

### Session Key Mapping
Each competition needs a Virtius `session_key` stored in its config to fetch clips. This may be:
- Manually entered by the producer in competition setup
- Auto-detected from the Virtius competition data (if available)

---

## 8. Out of Scope

- Clip Engine development (recording, trimming, transcoding, AI detection)
- Video processing of any kind in the Show Controller
- Filmstrip clipper / trim UI
- Cloudflare R2 / storage management
- Clip Engine infrastructure / deployment

---

## 9. References

- **Archived original clip system docs:** `docs/_archive/clip-tool/`
  - `ARCHITECTURE-clip-integration.md` — Original architecture decisions (still largely valid for playback design)
  - `UPDATED-broadcast-plan.md` — Full original broadcast plan
  - `UPDATED-build-checklist.md` — Original build checklist (covers both apps)
  - `test-video-playback.html` — Video playback test harness (may be reusable)
