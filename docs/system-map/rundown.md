# Rundown

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Show production
**Purpose:** Lets a producer plan a broadcast as an ordered list of timed segments (scene + graphic + audio cue + talent/equipment/sponsor), save it per competition or as a reusable template, then run that plan live — the server engine ticks the clock, auto- or manually advances, switches the OBS scene, fires the graphic, starts clip playout, and logs every override and actual segment duration for post-show analysis.
**Status:** **Proven** — the full loop is wired (editor → `competitions/{compId}/rundown/segments` → `loadRundown` socket → `segmentMapper` → `TimesheetEngine` → OBS/`currentGraphic`/playout) and Firebase holds 28 real run records under `competitions/wcgnic-2026-prelim1/production/rundown/analytics/` (e.g. `run-1774632180082`, `isRehearsal: false`, `totalSegments: 37`, a mix of `auto_advanced` and `advanced` end reasons across ~40 minutes, March 2026), plus 12 saved `rundownTemplates` named for real meets (`wcgnic`, `wcgnic-v2`, `stanford-open-26`, `men-s-tri-meet-3-5`, `womens-dual-updated-3-12`). `docs/PRD-Rundown-System/BUGS.md` documents 11 live-incident bugs, most severely BUG-021 (2026-03-07, Load Rundown silently dropped because `io.on('connection')` awaited an unreachable OBS VM before registering `socket.on` handlers) — that is a show-day failure report, not a lab note. Exceptions at a lower level: audio cues are **Partial** (Phase F, see gaps); the `/api/timesheet/*` HTTP routes and the legacy `production/rundown` config path are **Orphaned**; AI suggestions are **Partial** (own sub-part below).
**Sport coupling:** **Gymnastics-bound** — `server/lib/showConfigSchema.js` hard-codes `MENS_APPARATUS`/`WOMENS_APPARATUS` and validates `segment.cameraId` against apparatus codes, `RundownEditorPage.jsx` filters the graphic picker by `compType` (`mens-dual`…`mens-6`) and per-team slots, and `aiSuggestionService.js` generates one rotation block per apparatus in Olympic order. Segment *timing* logic itself is generic; the pickers and suggestions are not.

**Key files:**
- `show-controller/src/pages/RundownEditorPage.jsx` (12,193 lines) — the entire editor: segment list, timeline view, detail panel, all 30+ modals
- `server/lib/timesheetEngine.js` (1,841) — EventEmitter show clock: start/stop/pause/resume/advance/previous/goToSegment, scene switch, graphic fire, audio cue, hot-reload
- `server/lib/aiSuggestionService.js` (1,848) — rule-based segment suggestions (see sub-part)
- `server/lib/segmentMapper.js` (528) — editor↔engine field mapping, `diffSegments`, `detectDuplicateIds`, `deduplicateSegmentsById`
- `server/index.js` (8,730) — `getOrCreateEngine`, per-competition engine Map, `subscribeToRundownChanges`, Who-to-Watch sequencer, playout bridge, all rundown sockets
- `show-controller/src/context/ShowContext.jsx` (702) — socket client: all `timesheet*` listeners and control emitters
- `show-controller/src/hooks/useTimesheet.js` (532) — read-only façade over `timesheetState` + actions
- `show-controller/src/components/QuickActions.jsx` (547) — producer/talent scene + graphic shortcut grid
- `show-controller/src/components/playout/WhoToWatchEditor.jsx` (1,290) — title-card editor for `who-to-watch` segments
- `server/lib/productionConfigService.js` (490) — Firebase Admin handle + `saveRundown`/`getRundown`/`appendOverride`/`appendHistory`
- `server/lib/showConfigSchema.js` (438) — validates local `show-config.json` (cameras, segments, audio, transitions)
- `server/lib/configLoader.js` (239) — local-vs-Firebase show config with fallback
- `show-controller/src/components/{RunOfShow,CurrentSegment,NextSegment,OverrideLog}.jsx` (99/138/55/287) — live show panels

**Firebase paths written:**
- `competitions/{compId}/rundown/segments` — the rundown (editor, whole-array `set`)
- `competitions/{compId}/rundown/groups`
- `competitions/{compId}/rundown/approvalStatus` — draft / in-review / approved / locked
- `competitions/{compId}/rundown/timezoneConfig`
- `competitions/{compId}/rundown/history/{pushId}` — edit audit log with rollback snapshots
- `competitions/{compId}/rundown/presence/{sessionId}` — live collaborator presence (`onDisconnect`)
- `competitions/{compId}/production/rundown/analytics/{runId}` — run record (`startedAt`, `status`, `isRehearsal`, `totalSegments`)
- `competitions/{compId}/production/rundown/analytics/{runId}/segmentTimings/{pushId}` — real-time per-segment actuals
- `competitions/{compId}/production/rundown/analytics/{runId}` — on stop, merged `segments[]`, `overrides[]`, `summary`
- `competitions/{compId}/currentGraphic` — engine fires a segment's graphic here (renderer routing + resolved theme)
- `competitions/{compId}/production/rundown` — via `PUT /api/competitions/:id/production/rundown` (route exists, no caller)
- `rundownTemplates/{templateId}` — reusable whole-show templates
- `segmentTemplates/{templateId}` — reusable single-segment templates

**Firebase paths read:**
- `competitions/{compId}/rundown/segments` — by `loadRundown` and by the live-sync listener
- `competitions/{compId}/config` — engine builds graphic payload (eventName, team1–6 name/logo/ave/high/coaches, `meetTheme`)
- `competitions/{compId}/config/meetTheme`, `competitions/{compId}/config/team{N}Key`
- `competitions/{compId}/customGraphics/{key}` — custom graphic URL/label
- `competitions/{compId}/production/talent`, `competitions/{compId}/production/equipment`
- `competitions/{compId}/production/clipStatus` — Who-to-Watch waits for clip `ended`/`played`
- `competitions/{compId}/teamData`, `teamsDatabase/teams`, `teamsDatabase/stats/{teamKey}`, `teamsDatabase/sponsors/{teamKey}`
- `themes/{themeId}` — editor preview export; engine uses `resolveTheme(db, meetTheme, graphicId)`
- `teamsDatabase/honors`, `teamsDatabase/milestones` — **do not exist** (verified: `teamsDatabase` children are aliases, contacts, headshots, media, sponsors, stats, teams)

**Socket events:**
`emits (server→client):` timesheetState, timesheetTick, timesheetSegmentActivated, timesheetSegmentCompleted, timesheetShowStarted, timesheetShowStopped, timesheetShowComplete, timesheetStateChanged, timesheetHoldStarted, timesheetHoldMaxReached, timesheetAutoAdvancing, timesheetOverrideRecorded, timesheetSceneChanged, timesheetSceneOverridden, timesheetCameraOverridden, timesheetGraphicTriggered, timesheetVideoStarted, timesheetAudioCueTriggered, timesheetBreakStarted, timesheetPlayoutStarted, timesheetPlayoutStopped, timesheetError, timesheetOverrides, timesheetHistory, loadRundownResult, rundownModified, rehearsalModeChanged, aiSuggestionsResult, aiSuggestionCountResult, triggerGraphic
`listens (client→server):` loadRundown, startTimesheetShow, stopTimesheetShow, pauseTimesheetShow, resumeTimesheetShow, advanceSegment, previousSegment, goToSegment, timesheetOverrideScene, overrideCamera, getTimesheetState, getTimesheetOverrides, getTimesheetHistory, setRehearsalMode, getAISuggestions, getAISuggestionCount

**HTTP routes:**
- `PUT /api/competitions/:id/production/rundown` — save rundown (no SPA caller)
- `GET /api/timesheet/state` — legacy global engine state
- `GET /api/timesheet/overrides` — override history (called by `OverrideLog.jsx` on mount)
- `GET /api/timesheet/history` — segment history
- `POST /api/timesheet/start` — start legacy global engine
- `POST /api/timesheet/stop` — stop legacy global engine
- `POST /api/timesheet/advance` — advance legacy global engine
- `POST /api/timesheet/previous` — step back legacy global engine
- `POST /api/timesheet/jump` — jump legacy global engine
- `POST /api/import-csv` — CSV → local `server/config/show-config.json` (legacy, not per-competition)

**External services:**
- Firebase Realtime Database — the only persistence for rundowns, templates, analytics, presence
- OBS WebSocket 5 — `SetCurrentSceneTransition`, `SetCurrentProgramScene`, `SetInputSettings`, `TriggerMediaInputAction`, `SetInputVolume`, `SetInputMute`

**Depends on:**
- OBS integration — direct import of `obsConnectionManager.getConnection(compId)` inside `timesheetEngine.js` — scene switch, video/audio-cue media source, volume/mute per segment
- Graphics rendering — Firebase `competitions/{compId}/currentGraphic` + `stage/graphics-registry.json` read at engine boot — decides `renderer: 'stage' | 'output'` and the skeleton/blocks payload
- Themes — direct import `resolveTheme()` from `server/lib/themeResolver.js` — resolves `meetTheme` + per-graphic overrides into the stage render spec
- Sponsors — Firebase `teamsDatabase/sponsors/{team1Key}` — engine inlines up to 8 sponsors when the segment graphic id starts with `sponsors-`
- Clip playout — engine `playoutStarted`/`playoutStopped` events → `getOrCreatePlayoutEngine(compId).start(sessionKey, clipApiUrl)` in `server/index.js` — a `playout` segment starts/stops autonomous clip playout
- Who to Watch — engine `whoToWatchStarted` → the sequencer in `server/index.js` writes `who-to-watch-title` cards then `clip-playback`, waits on `production/clipStatus`, then calls `engine.advance()`
- Competition model — Firebase `competitions/{compId}/config`, `teamData` — team names/logos/stats for graphic payloads and the graphic picker
- Teams database — `teamsDatabase/teams`, `teamsDatabase/stats/{teamKey}` — roster/class-year and RTN stats for suggestions
- RTN stats — Firebase `teamsDatabase/stats/{teamKey}` snapshot triggered on `showStarted`
- Coordinator server — socket rooms `competition:{compId}` — all engine broadcasts are room-scoped
- Auth — `RequireAuth` wrapper on the `/{compId}/rundown` route in `App.jsx`

**Used by:**
- Producer View (surface) — socket `timesheetState` + control emits — `show-controller/src/views/ProducerView.jsx` renders Load/Reload Rundown, Start/Pause/Stop, rehearsal toggle, `CurrentSegment`, `NextSegment`, `RunOfShow`, `OverrideLog`
- Talent View (surface) — same socket state — `show-controller/src/views/TalentView.jsx` shows current/next segment, teleprompter `script`, `RunOfShow`, `QuickActions`
- Competition workspace (surface) — route `/{compId}/rundown` in `App.jsx` → `RundownEditorPage.jsx`
- Production checklist — Firebase `competitions/{compId}/rundown/segments` — `show-controller/src/hooks/useProductionChecklist.js` reads segments to check readiness
- Clip playout — socket `timesheetPlayoutStarted`/`Stopped` and direct engine-event bridge
- Who to Watch — engine `whoToWatchStarted`/`whoToWatchStopped`

**UI surfaces:**
- Rundown editor page (`/{compId}/rundown`) — `show-controller/src/pages/RundownEditorPage.jsx`
- Segment detail panel (scene picker, graphic picker + per-graphic params, timing mode, audio cue, talent, equipment, sponsor, script, notes) — `SegmentDetailPanel` in the same file
- Playout / content-sequence / who-to-watch editors — `show-controller/src/components/playout/{PlayoutRulesEditor,ContentSequenceEditor,WhoToWatchEditor}.jsx`
- AI Suggestions panel — `RundownEditorPage.jsx` (toolbar button at ~5932, panel at ~6177)
- Template + segment-template libraries, CSV/JSON import & export, print options, preview export, timing analytics, timezone config, talent/equipment/sponsor schedules — modals in `RundownEditorPage.jsx`
- Show Progress / Now Playing / Up Next / Override Log — `RunOfShow.jsx`, `CurrentSegment.jsx`, `NextSegment.jsx`, `OverrideLog.jsx`
- Quick Actions grid — `QuickActions.jsx`

**Known gaps:**
- **`timingMode: 'follows-previous'` is silently downgraded.** The editor offers three timing modes (`TIMING_MODES`, RundownEditorPage.jsx:110) but `segmentMapper.js:57` maps only `'fixed'` → `autoAdvance: true`; `'follows-previous'` becomes manual. A segment set to follow-previous will simply hang until the producer advances.
- **`content-sequence` is not a segment type the engine knows.** `SEGMENT_TYPES` in the editor includes it, but `timesheetEngine.js:42` has no case for it, so it falls through `_handleSegmentTypeActions`' `default` branch. Content sequences are only honoured inside `playoutEngine.js` at a rotation break, not as a standalone rundown segment.
- **`engine.overrideScene()` / `overrideCamera()` are dead for per-competition engines.** Both guard on `if (!this.obs)`, but `getOrCreateEngine()` (server/index.js:412) never passes `obs` — only `obsConnectionManager`. So `timesheetOverrideScene` and `overrideCamera` always fail with "OBS not connected"; the working path is the separate legacy `overrideScene` handler at index.js:4837.
- **All `/api/timesheet/*` routes target the legacy singleton engine**, not the per-competition Map. `OverrideLog.jsx:113` fetches `/api/timesheet/overrides` on mount and will always get the (empty) global engine's log; only the live socket feed populates it.
- **`production/rundown` is a dead second home for rundowns.** `productionConfigService.saveRundown/getRundown` and `configLoader.loadFirebaseConfig` read `production/rundown.segments`, but the editor and `loadRundown` both use `rundown/segments`. Verified in Firebase: `competitions/wcgnic-2026-prelim1/production/rundown` contains only `analytics`.
- **Audio cues are half-built (Phase F, PARTIAL in the plan).** The engine sets the OBS media source's `local_file` to `audioCue.songName` and restarts it, but `inPoint`/`outPoint` are logged and discarded — no seek. BUG-016 removed those fields from the UI rather than implementing them, and there is still no file picker, so `songName` must be typed as a path OBS can resolve.
- **`showConfigSchema.js` is out of date** — its `SEGMENT_TYPES` list stops at `graphic`, missing `playout`, `who-to-watch`, `content-sequence`. It only validates the local `show-config.json`, never rundown segments loaded from Firebase, so this is latent rather than breaking.
- **`POST /api/import-csv` writes the local `server/config/show-config.json`**, not a competition rundown. The per-competition CSV import is entirely client-side in `RundownEditorPage.handleImportCSV`/`parseCSV`/`autoDetectCSVMapping`. `timesheets-imports/Time Sheets - Men's Dual Meet - Head to Head.csv` matches the *server* legacy header shape (`obsScene`, `autoAdvance`, `graphicData`), not the editor's export shape.
- **Multi-competition execution never tested.** PRD user story 4 is marked "⚠️ Not tested — architecture in place, needs multi-comp test".
- **No automated tests.** `server/__tests__/` contains OBS/talent tests only — nothing for `timesheetEngine`, `segmentMapper`, `aiSuggestionService`, or `configLoader`.
- **Stale demo constants still ship.** `DUMMY_COMPETITION` ("Women's Quad Meet"), `DUMMY_SCENES`, `DUMMY_SEGMENTS`, `DUMMY_TALENT`, `DUMMY_EQUIPMENT` remain as fallbacks in `RundownEditorPage.jsx:60–190`; the `ai-suggestions-working.png` screenshot still shows "Women's Quad Meet" under a real Simpson vs UW-Whitewater meet.

**Sub-part: AI segment suggestions**
**Status: Partial.** `server/lib/aiSuggestionService.js` (1,848 lines) is **not** a language-model feature — it is a deterministic rule engine. I grepped the whole file for `anthropic|openai|claude|gpt|llm|prompt|completion|api_key|http` and got **zero** hits; its only import is `getDb` from `productionConfigService.js`. (The repo *does* depend on `@anthropic-ai/sdk` in `server/package.json`, but the only library that uses it is `server/lib/talentDiscoveryService.js`, which belongs to Commentary talent CRM.) What it actually does: `buildContext()` reads `competitions/{compId}/config`, `competitions/{compId}/teamData`, `teamsDatabase/teams`, `teamsDatabase/stats/{teamKey}`, `teamsDatabase/honors`, `teamsDatabase/milestones`; derives gender/team count from `compType`, season phase from `meetDate`, seniors from class year, a favourite/close-matchup read from team averages, and RTN stat flags. Five hard-coded template generators (`getPreShowSegments`, `getTeamIntroSegments`, `getRotationSegments` — one block per apparatus in Olympic order, `getPostShowSegments`, `getSpecialSegments`) emit candidate segments; `calculateDynamicConfidence()` adds fixed bonuses (`CHAMPIONSHIP_MEET: 0.15`, `HAS_RTN_STATS: 0.15`, `ALL_AMERICAN_BOOST: 0.15`, …) and buckets the result into high/medium/low. Exposure is **socket only** — `getAISuggestions` → `aiSuggestionsResult` and `getAISuggestionCount` → `aiSuggestionCountResult` (server/index.js:7426–7487); there is no HTTP route. **UI does call it:** `ShowContext.getAISuggestions()` (ShowContext.jsx:604, promise-wrapped with a 30s timeout) is consumed by `RundownEditorPage.fetchServerAISuggestions()` (line 852), rendered in the AI Suggestions panel with per-suggestion Dismiss/Add buttons, and falls back to a 948-line client-side analyzer (`show-controller/src/lib/aiContextAnalyzer.js`) when the socket is down. `getSuggestionsByCategory()` is exported but has no caller anywhere. Why Partial, not Built: two of its four data sources do not exist — I verified `teamsDatabase` has only `aliases, contacts, headshots, media, sponsors, stats, teams`, so `queryAllAmericans()` and `queryMilestones()` always return empty and the All-American Spotlight / Record Holder Feature / Milestone Watch suggestion types can never fire; `getAISuggestionCount` has a server handler but zero SPA callers; and the implementation plan marks Phase D "CODE COMPLETE (not validated — missing data), 6/6 tasks, 0/6 validated". Against that, `screenshots/ai-suggestions-working.png` shows the panel populated with server-side context ("Simpson vs UW-Whitewater • 2 teams • 18 seniors") for competition `8kyf0rnl`, so the rule engine does run end-to-end on real data — it just runs with a third of its intended inputs missing. The owner's "we tried to implement AI into the piece, but I don't think it fully got done" is accurate in spirit and understated in one direction: nothing here was ever going to be a model call, but the heuristic version that was built is real, reachable from the toolbar, and partially data-starved.

**Evidence of live use:**
- Firebase `competitions/wcgnic-2026-prelim1/production/rundown/analytics/` — 28 run records; `run-1774632180082` has `isRehearsal: false`, `totalSegments: 37`, 21 recorded segment timings mixing `auto_advanced` and `advanced`
- Firebase `competitions/10a21t4b/production/rundown/analytics/run-1769879358652` — a second competition with a recorded run
- Firebase `rundownTemplates/` — 12 templates including `wcgnic`, `wcgnic-v2`, `stanford-open-26`, `men-s-dual-meet-updated-2-21`, `men-s-tri-meet-3-5`, `womens-dual-updated-3-12`
- `docs/PRD-Rundown-System/BUGS.md` — BUG-021 (2026-03-07 Load Rundown silent failure when the OBS VM was unreachable "during setup/pre-show"), BUG-011/018/019 (Start/Pause/Stop/Resume broken in Producer View), BUG-012 (wrong meet name on a real "West Chester vs Cortland" dual)
- `screenshots/` — 74 rundown screenshots incl. `producer-view-load-rundown.png`, `producer-view-load-rundown-error.png`, `producer-view-rundown-status.png`, `rundown-editor-csv-import-verification.png`, `ai-suggestions-working.png`
- `timesheets-imports/Time Sheets - Men's Dual Meet - Head to Head.csv` and root `CGA_AllStars_2026_ShowController.csv` — hand-built timesheets with wall-clock columns in four US time zones
- `docs/PRD-Rundown-System/screenshots/verify-phase-l-task-4-playing.png` — Phase L preview tool verified 2026-03-23

**PRDs / docs:**
- `docs/PRD-Rundown-System/PRD-Rundown-System-2026-01-23.md` — main PRD, 10 user stories with a 2026-02-01 validation table
- `docs/PRD-Rundown-System/BUGS.md` — 11 bugs, BUG-021 first
- `docs/PRD-Rundown-System/PLAN-Rundown-System-Implementation.md` — phase table A–K with honest per-phase status
- `docs/PRD-Rundown-System/PLAN-Rundown-System-2026-01-23.md`
- `docs/PRD-Rundown-System/PLAN-Phase-L-Preview-Tool.md` — preview/export tool
- `docs/PRD-Rundown-System/verification-log-phase-l.html`
- `docs/PRD-Rundown-01-EditorPrototype/PRD-Rundown-01-EditorPrototype.md` — editor feature spec, phases 1–12
- `docs/PRD-Rundown-01-EditorPrototype/PLAN-Rundown-01-EditorPrototype-Implementation.md`
- `PRD-ShowControlSystem-2026-01-13.md` — original timesheet-engine spec (Phases 4/6/7); its planned `TimesheetPanel.jsx` was never built
- (`docs/PRD-AdvancedRundownEditor-2026-01-22.md` is referenced as the master PRD by the editor prototype doc but does **not** exist in the repo)
