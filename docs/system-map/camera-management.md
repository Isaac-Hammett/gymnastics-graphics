# Camera management

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Show production
**Purpose:** Lets a producer declare the venue's SRT camera feeds (port, apparatus coverage, fallback partner), watch each feed's live bitrate/packet-loss health, and mark cameras as verified or re-point them to a different apparatus mid-show — with automatic OBS scene fallback if a feed dies.
**Status:** **Partial**, trending Orphaned — the health monitor is genuinely instantiated and started (`server/index.js:8708` → `initializeCameraModules()` at `:182-266`, `cameraHealthMonitor.start()` at `:263`), but it polls `http://${nimbleServer.host}:${statsPort}/manage/srt_receiver_stats` and the only config in the repo (`server/config/show-config.json:48-52`) points at `nimble.local:8086`, an mDNS name that resolves nowhere, so every 2 s the fetch throws, the error is swallowed by the warn handler at `server/index.js:223-226`, and all four demo cameras sit at `offline`. The fallback manager is constructed and wired to `switchScene`, but **`handleCameraFailure()` is never called from anywhere outside `cameraFallback.js`** — nothing subscribes it to `cameraStatusChanged`, so the PRD's own criterion "Monitors camera health events / Triggers fallback when camera in current segment goes offline" (`PRD-ShowControlSystem-2026-01-13.md:119-120`) is unimplemented and the auto-switch is dead code. Runtime state (verify / reassign apparatus) is the one sub-part that is fully **Built**: socket handlers at `server/index.js:7242-7295`, UI in `CameraRuntimePanel.jsx`, and it works without Nimble because it is pure in-memory bookkeeping. `useCameraHealth.js` and `useCameraRuntime.js` are **Orphaned** — no file imports either one. The whole Firebase per-competition camera path is **Orphaned**: `productionConfigService.getCameras()` is exported but called by nothing, and `competitions/{compId}/production/cameras` does not exist for any of the 56 competitions in the live DB (spot-checked `8kyf0rnl`, `wcgnic-2026-prelim1`, `wcgnic-2026-event-finals`, `ecac-2026-audit`, `pac12-2025`, `0l8juzfq`, `10a21t4b`).

**Sport coupling:** Sport-parameterized — the three server libs pass apparatus codes through as opaque strings and `CameraSetupPage.jsx:28-33` derives the apparatus button list from `useApparatus(gender)`; the only coupling point is that the data model assumes a camera covers an *apparatus set* and fallback priority 2 is "same apparatus" (`cameraFallback.js:139-156`).

**Key files:**
- `server/lib/cameraHealth.js` (455 lines) — Nimble SRT stats poller, 5-state health FSM, matches streams to cameras by SRT port
- `server/lib/cameraFallback.js` (472 lines) — fallback selection + OBS scene switch; entry point never invoked
- `server/lib/cameraRuntimeState.js` (416 lines) — expected-vs-current apparatus, verify flags, mismatch detection
- `server/lib/showConfigSchema.js` (438 lines) — `validateCamera()`, `validateNimbleServer()`, cross-refs `fallbackCameraId` and `segment.cameraId`
- `server/lib/productionConfigService.js` (490 lines) — `getCameras`/`saveCameras` on the Firebase per-comp path (lines 118-160)
- `server/index.js:182-266` — module construction, event fan-out to `io.emit`, `.start()`
- `server/index.js:2681-2760` — camera HTTP routes
- `server/index.js:7242-7295` — camera socket handlers
- `server/config/show-config.json` — the only camera config that reaches the monitor (4 demo cameras, `nimble.local`)
- `show-controller/src/pages/CameraSetupPage.jsx` (457 lines) — camera CRUD page
- `show-controller/src/components/CameraRuntimePanel.jsx` (428 lines) — producer health/verify/reassign panel
- `show-controller/src/context/ShowContext.jsx:58-60, 159-225, 527-528` — camera socket state for the whole SPA

**Firebase paths written:**
- `competitions/{compId}/production/cameras` — object keyed by camera id; only writers are `PUT /api/competitions/:id/production/cameras` (no client calls it) and `server/scripts/migrateToFirebase.js:380`. Confirmed absent from the live DB.

**Firebase paths read:**
- `competitions/{compId}/production/cameras` — via `productionConfigService.getCameras()`, which has zero call sites
- `competitions/{compId}/production` — whole-node read in `getProductionConfig()` which array-ifies `data.cameras`; served by `GET /api/competitions/:id/production`, which no client calls

**Socket events:**
`emits:` cameraHealth, cameraStatusChanged, cameraRuntimeState, apparatusReassigned, cameraVerified, mismatchDetected, fallbackActivated, fallbackCleared, fallbackUnavailable, fallbackChainExhausted, activeFallbacks (per-socket on connect, `server/index.js:4705-4714`)
`listens:` reassignApparatus, verifyCamera, clearFallback, resetVerifications

**HTTP routes:**
- `GET /api/cameras/health` — all camera health snapshots
- `GET /api/cameras/:id/health` — one camera's health
- `GET /api/cameras/runtime` — all runtime/verify state
- `POST /api/cameras/:id/reassign` — repoint camera to apparatus
- `POST /api/cameras/:id/verify` — mark camera verified
- `GET /api/cameras/fallbacks` — list active fallbacks (always empty)
- `POST /api/cameras/:id/clear-fallback` — clear a fallback (always 404s)
- `PUT /api/config/cameras` — save cameras to show-config.json, reinit modules
- `GET /api/config` — read show config incl. cameras (used by CameraSetupPage)
- `PUT /api/competitions/:id/production/cameras` — save cameras to Firebase (no caller)

**External services:**
- Nimble Streamer stats API — `GET /manage/srt_receiver_stats` on `nimbleServer.statsPort` for SRT bitrate/packet-loss/RTT per port
- OBS WebSocket (via `switchScene`) — `SetCurrentProgramScene` for fallback scene switches

**Depends on:**
- OBS integration — direct import (module-level `switchScene` at `server/index.js:1616` → `obs.call('SetCurrentProgramScene')`) — fallback scene switching; note this uses the single legacy global `obs` handle, **not** `obsConnectionManager`, so it could never target a per-competition VM's OBS
- OBS integration — HTTP `POST /api/scenes/generate` / `GET /api/scenes/preview` — generates the `Single - {camera.name}` scenes that fallback and camera-override both assume exist
- Competition model — Firebase `competitions/{compId}/production/cameras` — intended per-competition camera storage (unused)
- Coordinator server — direct import + `io.emit` — hosting, socket fan-out

**Used by:**
- Producer View (surface) — `show-controller/src/views/ProducerView.jsx:1468` renders `CameraRuntimePanel` only in the *non-playout* branch (`showPlayoutPanels ? ClipQueuePanel : CameraRuntimePanel`), so during a Clip-playout broadcast this panel is not on screen
- Talent View (surface) — `show-controller/src/components/QuickActions.jsx:117-166, 331-390` fetches `/api/cameras/health` + `/api/cameras/runtime` for "Apparatus Cameras" buttons, but TalentView passes `hideApparatusCameras` (`TalentView.jsx:549`), so that block is hidden
- Rundown — socket `overrideCamera` → `timesheetEngine.overrideCamera()` (`server/lib/timesheetEngine.js:1777`) — reads `showConfig.cameras` directly, ignores health
- Competition workspace (surface) — `/{compId}/camera-setup` route (`App.jsx:133`), linked from `HomePage.jsx:699,1079` and `CompetitionSelector.jsx:313,537`

**UI surfaces:**
- Camera Setup page — `show-controller/src/pages/CameraSetupPage.jsx`
- Producer camera health/verify panel — `show-controller/src/components/CameraRuntimePanel.jsx`
- Apparatus quick-switch strip — `show-controller/src/components/QuickActions.jsx` (currently disabled by prop)
- Playout camera tiles — `show-controller/src/components/playout/CameraStatusPanel.jsx` (fed by Clip playout's own state, **not** by this system)

**Known gaps:**
- Health monitor's only real config is `nimble.local:8086`; `vm-full-setup.sh` (183 lines) contains no mention of nimble, SRT, or port 9001-9010, so the AMI it builds never runs the service the monitor polls
- `handleCameraFailure` / `switchToFallback` / `findBestFallback` have no caller — automatic fallback and BRB-on-total-failure never fire
- `cameraHealth.js:136-163` marks cameras `reconnecting`/`offline` when the Nimble API itself fails, directly contradicting the PRD mitigation "Mark cameras 'unknown' on API failure (don't trigger fallbacks on API issues)" (`PRD-ShowControlSystem-2026-01-13.md:465`)
- `CameraSetupPage.jsx:135` saves to `PUT /api/config/cameras` (local `show-config.json` on whichever server it talks to) — it never writes the per-competition Firebase path, so the CompetitionBoundArchitecture migration (`docs/PRD-CompetitionBoundArchitecture-2026-01-13.md:316-402`) was half-landed: service + route exist, UI was never switched over
- Field-name mismatch: server emits `newStatus` (`server/index.js:293`), `ShowContext.jsx:171` destructures `currentStatus` → sets `status: undefined` (masked only because the 2 s full-array `cameraHealth` poll overwrites it)
- `CameraRuntimePanel.jsx:101-102` binds the object-shaped `fallbackActivated`/`fallbackCleared` events to `handleActiveFallbacks`, which expects an array and therefore clears the list to `[]`
- No unit tests: `server/__tests__/` has 8 OBS suites but nothing for the three camera libs
- `alertService.js:29,38` defines an `ALERT_CATEGORY.CAMERA` that nothing ever raises
- `useCameraHealth.js` and `useCameraRuntime.js` are unimported dead hooks

**Evidence of live use:** none found
- All three libs last committed 2026-01-13 (`98b3e778` P2-01, `84a57570` P2-02, `7db05c49` P2-03) and never modified since; UI files last touched 2026-01-13/14
- Live Firebase has no `production/cameras` node under any of 56 competitions, including `wcgnic-2026-prelim1`, `wcgnic-2026-event-finals`, `ecac-2026-audit`
- No `.md` in the repo mentions Nimble outside PRDs/ROADMAP/plan-archive; `docs/WCGNIC-2026/` contains only screenshots and no camera references
- `test-show-flow.js` (root, `fe6e3de8`, 2026-01-13) only asserts the endpoints return arrays — it never asserts a camera is healthy, and it is not referenced from any package.json script
- The demo config itself is inconsistent (`cam-1` on port 10001 while docs specify 9001-9010), which is what you'd expect of a config that was never pointed at hardware

**Answering the four questions directly:** (1) Yes, the monitor is instantiated and `.start()`ed at server boot — against `http://nimble.local:8086/manage/srt_receiver_stats` every 2000 ms, from `server/config/show-config.json`, never from Firebase. (2) The fallback→OBS wire exists (`switchScene` → `obs.call('SetCurrentProgramScene')` on the legacy global OBS handle, targeting `Single - {name}` or `BRB`) but is unreachable because `handleCameraFailure` has no caller. (3) No — `playoutEngine.js` keeps its own hard-coded `_cameraStates` (VT/UB/BB/FX, lines 155-159), never imports `cameraHealth.js`, and nothing ever mutates `.state`, so the `find(c => c.state === CAMERA_STATE.LIVE)` check at line 1030 always returns undefined and `PLAYOUT_MODE.LIVE` is itself unreachable. (4) There is no evidence this ever ran against real cameras; it looks like a January 2026 build-out that was superseded by the Clip playout path in March 2026 and left in place.

**PRDs / docs:**
- `PRD-ShowControlSystem-2026-01-13.md` (repo root) — the originating spec, Phases 1-2
- `docs/PRD-CompetitionBoundArchitecture-2026-01-13.md` — per-competition camera Firebase migration
- `docs/PRD-VMArchitecture-2026-01-14.md` — Nimble as a systemd unit, stats API firewall rules, ports 9001-9006
- `docs/README-OBS-Architecture.md:73` — "Nimble SRT for camera input streams (ports 9001-9010)"
- `ROADMAP.md:325-355` — VM/Nimble/CameraHealthMonitor block diagram
