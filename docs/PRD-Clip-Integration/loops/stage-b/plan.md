# Stage B: Backend Integration — Tasks

## Phase 1: Foundation (Sequential — must complete before Phase 2)

1. Create `server/lib/clipService.js` — Clip Engine API adapter with polling, normalization, deduplication by `draft_id` and `athlete_id`+`apparatus`+`rotation`, `thumbnail_url` passthrough, score normalization (missing→null, 0→0), graceful field defaults — COMPLETE
2. Add clip API proxy route to `server/index.js` — `GET /api/competitions/:compId/clips` that calls clipService with the competition's `sessionKey` from Firebase config — COMPLETE
3. Create `server/lib/playoutEngine.js` — Core engine: clip queue management, priority stack evaluation (live routine > queued clips > fallback), mode state machine (CLIP/LIVE/MOMENT_REPLAY/FALLBACK/BREAK/OVERRIDE/PAUSED), clip auto-advance on `clipStatus/{draftId}` write-back from output.html, heartbeat writer (5s interval), queue persistence to `production/clipQueue`, event logging — COMPLETE
4. Wire playoutEngine into coordinator `server/index.js` — Playout activates when active rundown segment has `type: 'playout'`, reads `sessionKey` from competition config, registers socket events for producer/talent actions, broadcasts state updates via Socket.io — COMPLETE

## Phase 2: Producer + Talent Wiring (Sequential — depends on Phase 1)

5. Replace `usePlayoutState.js` mock with socket-based state — Connect to coordinator via existing Socket.io, receive playout state broadcasts (mode, clips, cameras, override, preload, heartbeat, eventLog), remove mock data imports and `usePlayoutSimulation` dependency — COMPLETE
6. Replace `usePlayoutActions.js` mock with socket emitters — Each action emits a socket event instead of mutating local state: `socket.emit('playout:skipClip', draftId)`, `socket.emit('playout:forceCamera', cameraNumber)`, etc. Same interface, different transport — COMPLETE
7. Wire TalentView to real playout state — TalentView receives same socket broadcasts as ProducerView (shared `usePlayoutState`), `flagMoment` emits socket event to coordinator — COMPLETE

## Phase 3: Rundown + Rotation Integration (Sequential — depends on Phase 2)

8. Persist playout rules to Firebase — RundownEditor saves `playout` and `content-sequence` segment config to `competitions/{compId}/rundown/segments/{segId}`, playoutEngine reads rules on activation — COMPLETE
9. Rotation auto-advance — playoutEngine detects rotation completion via existing Virtius API polling, triggers break content sequence between rotations, debounce: 2 polls (~90s) before advancing — COMPLETE
10. Rotation break content sequences — playoutEngine reads content sequence config from rundown segment, cycles through configured items (logos, standings, sponsor graphics) with durations, writes `currentGraphic` for each item, advances to next rotation's clips when sequence completes — COMPLETE

## Phase 4: Moment Replay + Polish (Sequential — depends on Phase 2)

11. Wire moment replay to engine — Producer `flagMoment` with `playNow: true` inserts moment into priority stack after current clip, coordinator writes `moment-replay` type to `currentGraphic` with seekStart/seekEnd/speed, output.html handles video seek and playback rate — COMPLETE
12. Clip polling refresh loop — playoutEngine polls clipService every 15s for new clips, deduplicates against existing queue, adds new clips in configured sort order, broadcasts queue update to connected clients — COMPLETE
13. Producer health indicators — Wire coordinator heartbeat to ProducerView status bar (green/amber/red based on heartbeat age), show "Engine Offline" when stale >30s, show API error banner when clipService returns errors — COMPLETE
