# Clip playout

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Show production
**Purpose:** Ingests routine clips produced by a third-party Clip Engine and plays them out autonomously during a broadcast — the producer gets a self-advancing clip queue, a mode readout (what's on air now / next), skip + force-camera overrides, moment-replay flagging, and gap-fill graphics between rotations, all driven from a `playout` segment in the rundown.
**Status:** **Partial** — every wire exists end to end (HomePage `clipApiUrl` → `config/clipApiUrl` → `timesheetEngine` PLAYOUT segment → `playoutStarted` → `PlayoutEngine.start()` → `clipService.fetchNewClips` → `currentGraphic` → `output.html?mode=clip` → `production/clipStatus/{draftId}` → auto-advance → `playout:stateUpdate` to ProducerView/TalentView), and it was deployed and exercised on production (`docs/PRD-Clip-Integration/issues/producer.json` records a PASS run against `https://commentarygraphic.com/wcgnic-2026-prelim1/producer` on 2026-03-23; `docs/PRD-Clip-Integration/issues/video-playback-codec/plan.md` Task 5 records the `/api/clip-proxy` fix deployed to the coordinator and verified with Playwright). But three load-bearing pieces are inert: LIVE mode can never be entered (`server/lib/playoutEngine.js:155` initialises `_cameraStates` and nothing ever mutates it — grep for `_cameraStates` returns only reads), the whole `playoutRules` config block is never consumed by the server, and most gap-fill graphic types have no renderer in `output.html`. Sub-parts at a different level: `show-controller/src/hooks/usePlayoutSimulation.js` is **Orphaned** (no importer; `ProducerView.jsx:37` says "usePlayoutSimulation removed in Stage B"), and the singleton manager exported at `server/lib/playoutEngine.js:1887-1913` is **Orphaned** (imported into `server/index.js:42` as `getPlayoutEngineFromModule` and never called — index.js keeps its own Map).
**Sport coupling:** **Gymnastics-bound** — the camera table is hard-wired to four women's apparatus (`{1:VT, 2:UB, 3:BB, 4:FX}`), `forceCamera()` rejects camera numbers >4 (so men's 6-apparatus is impossible), and `_inferCurrentRotation()` derives the rotation by counting Virtius `meet.event_results` entries that have a gymnast with `score > 0`.
**Key files:**
- `server/lib/playoutEngine.js` (1913 lines) — mode state machine, priority stack, clip queue, heartbeat, `_writeCurrentGraphic`, Virtius rotation polling, content sequences
- `server/lib/clipService.js` (242 lines) — Clip Engine API adapter: fetch, normalise, dedupe by `draft_id` then `athlete_id|apparatus|rotation`, 15s timeout + 1 retry on 5xx
- `server/index.js` (8730 lines) — engine lifecycle + `playoutStarted`/`playoutStopped` bridge (683-734), engine factory + socket forwarding (1009-1081), clip routes (4227-4351), 15 `playout:*` socket handlers (8155-8360)
- `server/lib/timesheetEngine.js` (1841 lines) — `SEGMENT_TYPES.PLAYOUT` (line 50), emits `playoutStarted` (860-869) / `playoutStopped` (312, 537, 642)
- `output.html` (13780 lines) — `?mode=clip` dual-`<video>` playback, preload/optimistic advance, stall + load timeouts, heartbeat staleness gate, `writeClipStatus()`
- `overlays/clip-player.html` (58 lines) — iframe fallback player with its own `proxyClipUrl()`
- `show-controller/src/hooks/usePlayoutState.js` (268 lines) — socket-fed read model
- `show-controller/src/hooks/usePlayoutActions.js` (190 lines) — 12 socket action emitters
- `show-controller/src/components/playout/ClipQueuePanel.jsx` (854 lines) — tabs/filters/bulk actions, replaces CameraRuntimePanel during playout
- `show-controller/src/components/playout/{PlayoutStatusBar,PlayoutControls,PlayoutEventLog,MomentReplayDialog,TalentClipInfo,KeyboardShortcutsPanel}.jsx` (382/202/278/471/406/321) — NOW/NEXT/QUEUE bar, override bar, log, replay dialog, talent panel, shortcut remapper
- `show-controller/src/components/playout/{PlayoutRulesEditor,ContentSequenceEditor}.jsx` (395/541) — rundown-side config for playout + content-sequence segments
- `show-controller/src/hooks/useKeyboardShortcuts.js` (304 lines) — 1-6 / S / Space / Esc / F / ? bindings, localStorage `playout-keyboard-shortcuts`

**Firebase paths written:**
- `competitions/{compId}/currentGraphic` — `{graphic, data, timestamp}` for `clip-playback`, `moment-replay`, `live-camera`, `fallback`, `rotation-break`, and each content-sequence item (all carry `meetTheme`)
- `competitions/{compId}/production/playoutState` — `{engineState, mode, sessionKey, override, currentClipId, timestamp}`
- `competitions/{compId}/production/clipQueue` — `{clips:[{draft_id,status,shown_live}], timestamp}`
- `competitions/{compId}/production/engineHeartbeat` — `{timestamp, mode}` every 5s
- `competitions/{compId}/production/clipStatus/{draftId}` — written by `output.html` (`ended`/`stalled`/`error`, plus `optimisticNextDraftId`, `errorMessage`, `networkState`); engine deletes the node 500ms after consuming it

**Firebase paths read:**
- `competitions/{compId}/config/clipApiUrl` — full deliveries URL, regex-split into base URL + session key
- `competitions/{compId}/config/sessionKey` — legacy fallback session key
- `competitions/{compId}/config/virtiusSessionId` — rotation detection (absent ⇒ auto-advance disabled)
- `competitions/{compId}/config/meetTheme` — cached at start, injected into every graphic write
- `competitions/{compId}/config/obsScenes` — overrides `Live Camera Scene` / `Clip Playback Scene` / `March In Scene`
- `competitions/{compId}/config` — `team{1..7}Name|Logo|Key` for the clip-overlay logo map
- `teamsDatabase/aliases` — extra name→logo aliases
- `competitions/{compId}/rundown/segments` — content-sequence lookup by `forRotation` or "rotation N" in name/notes
- `competitions/{compId}/rundown/defaultContentSequence` — fallback sequence
- `competitions/{compId}/production/clipQueue` — status restore on start
- `competitions/{compId}/production/clipStatus` — `child_added` + `child_changed` listeners
- `competitions/{compId}/production/engineHeartbeat` — read by `output.html` (30s staleness ⇒ suppress optimistic advance)

**Socket events:**
`emits:` playout:stateUpdate, playout:clipQueueUpdate, playout:modeChange, playout:rotationAdvanced, playout:error, playout:startResult, playout:stopResult, timesheetPlayoutStarted, timesheetPlayoutStopped
`listens:` playout:start, playout:stop, playout:pause, playout:resume, playout:skipClip, playout:forceCamera, playout:releaseOverride, playout:flagMoment, playout:addToQueue, playout:retryClip, playout:retryAllFailed, playout:fetchClips, playout:getState, playout:completeRotationBreak, playout:skipContentItem

**HTTP routes:**
- `GET /api/competitions/:compId/clips` — proxy clip list for a competition
- `GET /api/clip-proxy?url=` — stream R2 video, Range-aware, R2 domain allowlist

**External services:**
- Clip Engine REST API (third-party; default `https://unwronged-tyisha-littlish.ngrok-free.dev`, `CLIP_ENGINE_BASE_URL` env override) — `GET {base}/clip-api/meets/{sessionKey}/deliveries`
- Cloudflare R2 (`*.r2.cloudflarestorage.com`) — presigned MP4 clip files, 7-day expiry, streamed via `/api/clip-proxy`
- Virtius API (`https://api.virti.us/session/{id}/json`) — rotation inference, polled every 45s

**Depends on:**
- Rundown — direct import + EventEmitter (`playoutStarted`/`playoutStopped` from `timesheetEngine.js` PLAYOUT segment) — the only way the engine ever starts in practice
- Rundown — Firebase `competitions/{compId}/rundown/segments` — gap-fill / content-sequence config
- Coordinator server — direct import + Socket.io room `competition:{compId}` — engine hosting and state fan-out
- OBS integration — direct import (`obsConnectionManager.getConnection(compId)` → `SetCurrentProgramScene`) — switches between Clip Playback and Live Camera scenes on every mode change
- Graphics rendering — Firebase `currentGraphic` → `output.html` — renders the clip overlay and every gap-fill graphic
- Themes — Firebase `config/meetTheme` — `meetTheme` is added to every `_writeCurrentGraphic()` payload and to `nextClipData` for the preloaded clip
- Teams database — Firebase `teamsDatabase/aliases` + competition `team{N}Logo` — fuzzy team-name → logo resolution for the clip overlay
- Competition model — Firebase `config/virtiusSessionId` — rotation detection input

**Used by:**
- Producer View (surface) — `show-controller/src/views/ProducerView.jsx` swaps in the playout panels when `isPlayoutActive && showIsActive`
- Talent View (surface) — `show-controller/src/views/TalentView.jsx` renders `TalentClipInfo` and emits `playout:flagMoment`
- Home page (surface) — `show-controller/src/pages/HomePage.jsx:1302-1316` "Clip Engine (optional)" deliveries-URL field
- Rundown — `show-controller/src/pages/RundownEditorPage.jsx:55-56` imports `PlayoutRulesEditor` and `ContentSequenceEditor`
- Who to Watch — reuses this system's plumbing: `server/index.js:906-939` waits on `production/clipStatus/{draftId}`, writes `graphic: 'clip-playback'` with `overlayStyle: 'who-to-watch'`, and clips go through `/api/clip-proxy`

**UI surfaces:**
- Producer View → playout panel stack — `PlayoutStatusBar.jsx`, `PlayoutControls.jsx`, `PlayoutEventLog.jsx`, `CameraStatusPanel.jsx`
- Producer View → right column clip queue — `ClipQueuePanel.jsx`
- Producer View → modals — `MomentReplayDialog.jsx`, `KeyboardShortcutsPanel.jsx`
- Talent View → NOW SHOWING / UP NEXT / Flag Moment — `TalentClipInfo.jsx`
- Rundown Editor → segment config for `playout` and `content-sequence` types — `PlayoutRulesEditor.jsx`, `ContentSequenceEditor.jsx`
- Home page → Edit Competition → Clip Engine section — `HomePage.jsx`
- (Also living in `components/playout/` but owned by other systems: `WhoToWatchEditor.jsx` → Who to Watch; `CameraStatusPanel.jsx` → Camera management)

**Known gaps:**
- **LIVE mode is unreachable.** `_cameraStates` is initialised in the constructor and never written again; `_evaluatePriorityStack()` looks for `c.state === CAMERA_STATE.LIVE`, which is always false. The engine does **not** consume Camera management (`cameraRuntimeState.js` / `cameraHealth.js` are imported by `server/index.js` but never plumbed into the engine). The only way to get a `live-camera` graphic on air is the manual `forceCamera()` path, which enters OVERRIDE, not LIVE.
- **The whole `playoutRules` block is dead config.** `PlayoutRulesEditor` persists `clipOrder`, `apparatusPriority`, `transitionType`, `crossfadeDuration`, `gapFillSequence`, `gapFillLoop`; `segmentMapper.js` round-trips them; `timesheetEngine.js:866` puts them on the `playoutStarted` event — and `server/index.js:684-720` discards everything except `clipApiUrl`. Grepping the server for `clipOrder|apparatusPriority|transitionType|gapFillLoop` returns zero hits outside `segmentMapper`. Clips are always sorted `rotation` then `order`.
- **Gap-fill runs off a different key than the editor writes.** `_loadContentSequenceConfig()` only reads `segment.contentSequence` / `rundown/defaultContentSequence`, never `playoutRules.gapFillSequence`, so the "Gap Fill Sequence" UI has no effect.
- **Half the gap-fill graphic types have no renderer.** The editors offer `event-summary`, `standings`, `sponsor`, `calendar`, `quad-view`, `highlight-reel`; `output.html`'s `renderers` registry (line 12328-13095) only has `event-summary` (and `live-camera`). `standings`, `sponsor`, `calendar`, `quad-view`, `highlight-reel` fall into the `!renderers[graphic]` branch and blank the screen. `fallback` and `rotation-break` are also unrendered — FALLBACK and the default BREAK graphic both clear output.
- `ContentSequenceEditor`'s `advanceCondition` (`next-rotation-detected` / `all-complete` / `manual`) is persisted but never read by the engine; sequences always advance on per-item timers and auto-complete the break.
- `_writeCurrentGraphic` writes a `background: true` field for content items; `output.html`'s listener destructures only `{graphic, data, renderer}`, so it is ignored.
- `production/playoutState` is write-only — nothing in `server/` or `show-controller/src/` ever reads it back, so the documented "recovery after coordinator restart" only restores the queue, not the mode/override.
- `usePlayoutState` drops `currentRotation`, `rotationBreakPending` and `contentSequenceState` from the server payload; `ProducerView` shows the *timesheet's* rotation instead (`ProducerView.jsx:250`), so the engine's Virtius-detected rotation and the running content sequence are invisible to the producer.
- `usePlayoutState.handleModeChange` reads `data.mode`, but `server/index.js:1042` forwards `{previousMode, newMode}` — the handler is a no-op (masked by the full `stateUpdate`).
- No client listens to `playout:rotationAdvanced`, `playout:startResult`, `playout:stopResult`, `timesheetPlayoutStarted` or `timesheetPlayoutStopped`.
- `startPlayout` exists in `usePlayoutActions` but is not destructured or bound to any button — the engine can only be started by a `playout` rundown segment.
- Keyboard shortcuts bind Force Camera 5 and 6; `forceCamera()` rejects `cameraNumber > 4`.
- **"Simulation" mode** = `usePlayoutSimulation.js` (391 lines): the Stage-A client-side mock that ticked `elapsed` every 100ms, faked score reveal at `max(duration-5, duration*0.6)`, faked a 2s preload progress bar, and auto-advanced the queue locally. It is now orphaned — no file imports it, and the setters it needs (`setClips`, `setCurrentMode`, `setPreloadState`, `setEventLog`) are deliberate no-ops in `usePlayoutState.js:213-215`. Real "simulation" today is `output.html?mode=preview` (identical to `mode=clip` but `shouldWriteToFirebase=false`) and `mode=clip-preview` (theme-editor overlay preview with sample data, no video, no Firebase).
- No unit tests: `server/__tests__/` contains no playout or clipService test.
- Default Clip Engine base URL is a personal ngrok tunnel (`clipService.js:23`), so nothing works unless the producer pastes a live deliveries URL.

**Evidence of live use:**
- `docs/PRD-Clip-Integration/issues/producer.json` — verification run 2026-03-23 against production `https://commentarygraphic.com/wcgnic-2026-prelim1/producer`, all 8 playout components PASS, interaction tests for Start Show / Force Camera / Stop.
- `docs/PRD-Clip-Integration/issues/video-playback-codec/plan.md` (Task 5 + Learnings) — `/api/clip-proxy` and the `output.html` proxy rewrite deployed to the coordinator (44.193.31.120) and web host, verified against `https://commentarygraphic.com/output.html?mode=clip&comp=wcgnic-2026-prelim1`.
- Live Firebase, `competitions/wcgnic-2026-prelim1/config/clipApiUrl` = `https://unwronged-tyisha-littlish.ngrok-free.dev/clip-api/meets/lmjhRiyv8C/deliveries` — a real Clip Engine session was configured for the meet.
- **Counter-evidence that it did NOT run the meet:** `competitions/wcgnic-2026-prelim1/production/engineHeartbeat` = `{mode:"FALLBACK", timestamp:1774581446750}` → 2026-03-27T03:17:26Z, and `production/playoutState` = `{engineState:"stopped", mode:"FALLBACK", sessionKey:"lmjhRiyv8C", timestamp:1774581450826}`. The meet itself is `config/meetDate` "March 27, 2026" at `config/meetTime` "2:00 PM ET" (18:00Z) — the engine's last heartbeat is ~15 hours *before* first pixel and it has never written since. `production/clipQueue` holds 2 clips both still `queued`. Every surviving `production/clipStatus` entry (19 of them, all `wtw-seg-002-*`/`wtw-test-*`, 2026-03-26) is an `error` (`Format not supported`, `MEDIA_ELEMENT_ERROR: Format error`, `Load timeout (10s)`); there are no `played`/`ended` records.
- `competitions/wcgnic-2026-prelim1/rundown/segments` (37 segments, the real show rundown) contains **zero** segments of `type: 'playout'` — only stray `contentSequence` / `playoutRules` blobs left on `type: 'live'` segments (`seg-001`, `seg-003`), which never fire `playoutStarted`. No other competition in Firebase has a `production/playoutState` or `production/engineHeartbeat` node.
- `git log` "PRD-Theme-System-V2: Task 7F.8 — Deploy + Verify Playout with WCGNIC Data" (2026-03-27) is a theme-editor preview verification of the three playout graphics, not a live-broadcast record.

**PRDs / docs:**
- `docs/PRD-Clip-Integration/PRD-Clip-Integration-2026-03-17.md` — main PRD (Status field "NOT STARTED" is stale; the shipped design diverged substantially — no `routine-replay` graphic, no highlight-reel builder, no `useClipQueue.js`, and a server-side engine the PRD never describes)
- `docs/PRD-Clip-Integration/loops/stage-b/plan.md` — the 13-task backend-integration plan that produced `playoutEngine.js` (all marked COMPLETE; Task 8's "playoutEngine reads rules on activation" is not true in code)
- `docs/PRD-Clip-Integration/issues/{producer,rundown,talent,output}.json` — verification-loop results
- `docs/PRD-Clip-Integration/issues/video-playback-codec/{plan.md,agent.md,verification-log.html}` — the R2 codec/proxy incident and fix
- `docs/PRD-Clip-Integration/fixtures/sample-response.json` — captured Clip Engine API response
- `docs/PRD-Clip-Integration/verification-log-stage-b.html`, `verification-log-{producer,rundown,talent,output}.html`
- `CLAUDE.md` §"Clip Integration (Autonomous Playout)" (lines 800-856) — accurate architecture summary, including the Firebase path table and theme propagation
