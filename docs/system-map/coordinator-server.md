# Coordinator server

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Platform and infrastructure

**Purpose:** One Node/Express/Socket.io process (`server/index.js`) that every producer surface talks to — it holds the Firebase Admin credential, fans out real-time state over Socket.io rooms, and proxies work to per-competition OBS VMs. The same binary runs as the central coordinator (`COORDINATOR_MODE=true`, PM2 `coordinator`) or standalone on an OBS VM (PM2 `virtius-server`).

**Status:** **Proven** — the process ran in production on `api.commentarygraphic.com` (44.193.31.120, PM2 + nginx, Elastic IP and instance `i-001383a4293522fa4` recorded in `docs/INFRASTRUCTURE.md` and `docs/PRD-CoordinatorDeployment-2026-01-15.md`), and `docs/PRD-Rundown-System/BUGS.md` BUG-021 is a live incident write-up (2026-03-07) about producers clicking "Load Rundown" against a real unreachable OBS VM — the fix (fire-and-forget in `io.on('connection')`) is present in code today at `server/index.js:4649-4681`. Deploy-and-verify commits name real events (`PRD-Theme-System-V2: Task 7F.8 — Deploy + Verify Playout with WCGNIC Data`, `clip-codec: deploy proxy endpoint and client changes to production`). **Exception — the wake/sleep cost-control sub-part is Orphaned/broken:** see below. **Exception — `/health` does not exist:** `SPINUP-2026-08-17.md:88` and `CLAUDE.md:616` both tell you to `curl :3003/health`, but the only health routes in `server/index.js` are `/api/cameras/health` and `/api/cameras/:id/health`; a request to `/health` falls through to the SPA catch-all `app.get('/{*path}')` at line 4388 and returns `index.html`, so the documented smoke test always "passes" regardless of server health.

**Wake/sleep sub-system — no working wake path exists.** `useCoordinator` (`show-controller/src/hooks/useCoordinator.js:45,119,171`) hard-codes *same-origin relative* fetches to `/.netlify/functions/coordinator-status`, `/wake-coordinator`, `/stop-coordinator` — it never uses `VITE_API_URL`/`serverUrl.js`. The only implementations of those endpoints are `show-controller/netlify/functions/{coordinator-status,wake-coordinator,stop-coordinator}.js` (825 lines total), which are Netlify Lambdas holding a dedicated IAM user (`COORDINATOR_AWS_ACCESS_KEY_ID`, `COORDINATOR_INSTANCE_ID`) — the whole point being that they answer *when the coordinator is off*. Netlify is gone; nginx on the web EC2 serves only static files from `/var/www/commentarygraphic` (`CLAUDE.md:71-140`), so nothing answers `coordinator-status`. **Answer: nobody answers `coordinator-status` when the coordinator is off.** The request either 404s or hits nginx's SPA fallback and returns HTML; `response.json()`/`!response.ok` throws, and the hook's `catch` deliberately sets status to `OFFLINE` (line ~92: *"On error, set status to OFFLINE so user can try to wake"*). So the UI correctly shows `SystemOfflinePage` with a "Wake Up System" button — and the button is dead: `POST /.netlify/functions/wake-coordinator` has no server. The in-repo fallback (`server/index.js:4377-4386`) 307-redirects those three Netlify paths to `/api/coordinator/status|wake|stop`, but (a) `/api/coordinator/wake` and `/api/coordinator/stop` **are never defined anywhere in the codebase** — only `status`, `activity` (GET/POST), `idle`, `keep-alive` exist (lines 3244-3368) — and (b) the shim lives inside the coordinator, so it can only answer when the coordinator is already up. `docs/prd-test-vm-separation.md:40-45,312-321` proposes nginx `proxy_pass` to those routes; it is a plan, never implemented, and would proxy to routes that don't exist. The only remaining wake path is out-of-band: `mcp__gymnastics__aws_start_instance` / the AWS console. Sleep still half-works (`autoShutdown` → `selfStop` → `ec2:StopInstances`), which means the system can put itself to sleep and cannot wake itself back up.

**Sport coupling:** **Generic** — the lifecycle layer (startup ordering, CORS, static mounts, activity tracking, auto-shutdown, self-stop, PM2/ecosystem, `/api/coordinator/*`) contains no sport concepts; gymnastics only enters via the feature modules the monolith happens to host (`getApparatusForGender`, `/api/virtius/:sessionId`, `/api/rtn/*`).

**Key files:**
- `server/index.js` (8,730 lines) — the whole process: imports 30+ libs, Express+Socket.io setup, 82 routes, 117 socket handlers, `httpServer.listen` at 8699
- `server/lib/actionBus.js` (ISA2-272, 2026-09-27) — per-competition action bus: one command path for scene and graphic actions with stable IDs. **Built** (unit-tested, socket path smoke-checked on local dev; not yet exercised against a VM's OBS)
- `server/lib/competitionState/` (ISA2-274, 2026-09-27) — competition state service: per-competition reducer that ingests Virtius snapshots (or recorded logs) and external signals, emits typed events with `{confidence, evidence[], t}`, and keeps internal state for guardrails and Xavier. **Built** (unit-tested; live poll of ECAC session checked on local dev). **Files:** `service.js` (`CompetitionStateService` EventEmitter with `.attach(source)` and `.ingest({t, snapshot}|{t, signal})` methods), `reducer.js` (pure functions, no I/O; ports detectNowCompeting, rotation+bye detection from browser overlays), `sources.js` (source classes `LiveVirtiusSource` for Virtius polls, `RecordedEventSource` for recorded logs; both EventEmitter with `.start()` / `.stop()` and emit 'input' / 'error'). **Socket events:** `competitionState:start {compId?, sessionId?, pollIntervalSec?, emitInitial?, logToFile?}`, `competitionState:stop {compId?}`, `competitionState:get {compId?}` in; `competitionState:event` and `competitionState:update {compId, stateVersion, state}` out to `competition:{compId}`. **Event types:** `athleteUp` (gymnast ready, confidence 0.4–0.6 inferred from scores, reset on bye), `greenLight` (routine started, confidence 0.9 if signalled or 0 if recording), `routineEnded` (routine complete), `scorePosted` (new score, confidence 0.95), `scoreCorrected` (score changed post-post), `rotationChanged` (apparatus changed), `teamTotalChanged` (team final updated). **Firebase paths read:** `competitions/{compId}/config/virtiusSessionId` on `competitionState:start` (server/index.js:4875). **Inputs:** Virtius snapshots `{t, snapshot}` or external signals `{t, signal: {type, event, team, ...}}` via `svc.ingest()` (service.js:60). **Uses of state:** guardrails can read routine state via `Guardrails.setRoutineStateProvider(fn)` callback (not wired); Xavier decision service reads for context. **Isolation:** does not touch `scoringIngestionService`'s Firebase output; stores recent events in-memory (200-entry buffer per instance)
- `server/lib/graphicPayload.js` (ISA2-272, 2026-09-27) — the `currentGraphic` payload builder, extracted from `timesheetEngine._triggerGraphic`; also owns the `stage/graphics-registry.json` load and `getGraphicById`
- `server/lib/autoShutdown.js` (450) — idle timer, 30 s cancellable shutdown, Firebase audit; `enabled` gated on `COORDINATOR_MODE`
- `server/lib/selfStop.js` (446) — IMDSv2 instance-id lookup + `StopInstancesCommand` on self
- `server/lib/productionConfigService.js` — the real `admin.initializeApp({credential: applicationDefault()})` (lines 44-52); `autoShutdown`/`selfStop` each re-init defensively
- `server/ecosystem.config.js` (58) — PM2 app `coordinator`, cwd `/opt/gymnastics-graphics/server`, `PORT: 3001`, `COORDINATOR_MODE:'true'`, `AUTO_SHUTDOWN_MINUTES:120`
- `server/scripts/deploy-coordinator.sh` (7.5 KB) — rsync to 44.193.31.120 + `npm install --production` + `pm2 restart ecosystem.config.js`
- `server/routes/obs.js` (87 KB) — 65 OBS route registrations mounted via `setupOBSRoutes(app, obs, () => obsStateSync)` at index.js:4374
- `show-controller/src/lib/serverUrl.js` (48) — `VITE_API_URL` → `VITE_LOCAL_SERVER` → `http://localhost:3003`
- `show-controller/src/context/CompetitionContext.jsx:45-70` — socket URL: local→`getServerUrl()`, HTTPS→hard-coded `https://api.commentarygraphic.com`, dev HTTP→`vmAddress` direct
- `show-controller/src/hooks/useCoordinator.js` (332) — the broken Netlify-path status/wake/stop hook
- `show-controller/src/components/CoordinatorGate.jsx` (117) — route guard; path allow-list, `local` bypass
- `show-controller/netlify/functions/*.js` (304/263/258) — LEGACY, unreachable

**Firebase paths written:**
- `coordinator/shutdownHistory/{pushId}` — auto-shutdown and self-stop audit records (`autoShutdown.js:311`, `selfStop.js:381`)

**Firebase paths read:**
- `competitions/{compId}/production/settings/isStreaming` — `hasActiveStreams()` veto on idle shutdown
- `competitions/{compId}/config/scoringFeed`, `competitions/{compId}/config/virtiusSessionId` — startup scan + `child_changed` listener in `initializeScoringIngestion()`
- `competitions/{compId}/obs/templateScenes` — `broadcastOBSState()` scene categorization

**Action bus (ISA2-272) — one command path for scene and graphic actions.** Before this, five scene-switch paths used different OBS connections and none acknowledged anything, and `competitions/{compId}/currentGraphic` had eight or more writers. `server/lib/actionBus.js` adds a per-competition bus (`getOrCreateActionBus(compId)`, same shape as `getOrCreatePlayoutEngine`) that:
- **Catalogs** what can be done right now as `{id, kind, label, category, params}`: `scene:{sceneName}` from OBS `GetSceneList` unioned with the scenes the rundown's segments reference (`params.source` is `obs`, `rundown`, or `both`), plus `graphic:{graphicId}` and `graphic:clear` from `stage/graphics-registry.json` filtered by the competition's gender and team count, with `perTeam` entries expanded per slot (`team-roster` → `graphic:team2-roster`).
- **Executes** scenes through `obsConnectionManager.getConnection(compId)`, confirmed against `CurrentProgramSceneChanged` (listener armed *before* the `SetCurrentProgramScene` call; a scene that is already live short-circuits, since OBS emits nothing then). Graphics are written server-side via `graphicPayload.buildGraphicPayload`, the same function the timesheet engine calls.
- **Acks** every command as `{ok, actionId, error, guardrail}`. Error codes: `no_action_id`, `unknown_action`, `obs_not_connected`, `obs_call_failed`, `obs_timeout`, `not_confirmed`, `firebase_unavailable`, `firebase_timeout`, `firebase_write_failed`, `guardrail`. Every OBS and Firebase call on the socket path is bounded — Firebase Admin without valid credentials never settles a read, which would otherwise hang the ack forever.
- **Observes without rerouting.** Listens to the connection manager's forwarded `obsEvent`/`CurrentProgramSceneChanged` and to `currentGraphic`, and attributes each change to `bus` or `human` (3 s window after a bus write) so guardrails and the decision log know what the producer did.
- **Enforces guardrails (ISA2-273)** from `server/lib/guardrails.js` on every command, whoever sends it (producer, rundown, Xavier): `minShotHoldMs` (default 3000, from the last program change, bus or human), `noCutDuringRoutine` (routine state comes from the competition's state service: `getOrCreateActionBus` sets a provider from `server/lib/routineState.js` that reads the most confident `in_progress` event live per check and is cleared by `disposeActionBus`; scenes of that event are found by name/code in the scene name; allows when unsure, ISA2-311), `noGraphicStacking` (an on-air graphic only gives way to one of the same registry `category`; `clear` always allowed), and `cameraMustHaveSignal` (`GetSceneItemList` + `GetMediaInputStatus` on every enabled `ffmpeg_source`/`vlc_source`, nested scenes included; OBS errors or a 1.5 s timeout allow). A refusal acks `{ok: false, error: 'guardrail', guardrail: {rule, reason}}`, touches neither OBS nor Firebase, and is broadcast as `action:refused` to `competition:{compId}`. A human `force: true` (on `action:execute`, `overrideScene`, `switchScene`) runs anyway; the ack and `action:executed` carry `guardrailOverride: [{rule, reason}]` and the bus emits `guardrailOverride`. Xavier senders (`xavier*`) can never force. Config: `competitions/{compId}/config/xavier/guardrails` = `{enabled, rules: {ruleName: {enabled, ...params}}}`, watched live; missing means all four on. Predicate hooks (`addGuardrail`) still run first.

**Writers on the action bus (ISA2-281, 2026-09-27):** timesheetEngine `_applyTransitionAndSwitchScene`, `_triggerGraphic`, `overrideScene`, `overrideCamera`, index.js `overrideScene`, `switchScene`, and GraphicsControl `sendGraphic`/`clearGraphic` (as `action:execute` with `params.manual`). See ISA2-281 answer for the routing and the new `buildManualGraphicPayload` function.

**Still off the bus:** playout engine (clip scene switches) and the OBS `createScene` temporary switch. Who-to-Watch steps, rotation slate, auto slate, event summary, now-competing, and custom graphic sends moved onto it in ISA2-302 (prebuilt payloads ride in `params.payload`, trusted senders only); custom graphics are catalogued as `graphic:custom-{key}`. A competition's bus is disposed when its last client leaves and no rundown is running, and on engine teardown; socket-path Firebase reads are bounded by `onceValue` (`server/lib/firebaseRead.js`, 6 s).

**Socket events:**
`emits:` action:catalog, action:executed, action:refused (to `competition:{compId}`), competitionState:event, competitionState:update (to `competition:{compId}`), connected, shutdownPending, shutdownCancelled, shutdownExecuting, serverShuttingDown, stateUpdate, vmPoolStatus, cameraHealth, cameraStatusChanged (124+ distinct emit names total across index.js)
`listens:` action:execute `{actionId, sender, force?, recommendationId?}`, action:catalog, competitionState:start, competitionState:stop, competitionState:get (all per-competition), disconnect, identify, plus 110+ more (see inventory below); process-level lifecycle listeners are the `socket.use()` activity-tracking middleware registered first in every connection

**HTTP routes:** (coordinator-lifecycle subset only; full monolith inventory below)
- `GET /api/coordinator/status` — mode, uptime, idle, firebase/aws/obs reachability
- `GET /api/coordinator/activity` — last-activity timestamp
- `POST /api/coordinator/activity` — keep-alive touch
- `GET /api/coordinator/idle` — idle + auto-shutdown countdown
- `POST /api/coordinator/keep-alive` — reset activity, cancel pending shutdown
- `GET /api/status` — legacy `showState` dump
- `GET /.netlify/functions/coordinator-status` — 307 shim → `/api/coordinator/status`
- `POST /.netlify/functions/wake-coordinator` — 307 shim → nonexistent `/api/coordinator/wake`
- `POST /.netlify/functions/stop-coordinator` — 307 shim → nonexistent `/api/coordinator/stop`
- `GET /{*path}` — SPA catch-all serving `show-controller/dist/index.html`

**External services:**
- Firebase Realtime Database (Admin SDK, `applicationDefault()` via `GOOGLE_APPLICATION_CREDENTIALS`) — all persistent state
- AWS EC2 API — `describeInstances` for the status route, `StopInstances` for self-stop
- EC2 IMDSv2 (`169.254.169.254`) — own instance id
- PM2 — process supervision, log rotation, boot persistence
- nginx — SSL termination in front of the Node port (coordinator host) and static SPA hosting (web host)

**Depends on:**
- Auth — none at this layer; there is no `io.use()` middleware and no Authorization check in `server/index.js`. Firebase Auth is enforced client-side only (`RequireAuth` in App.jsx)
- VM pool — direct import `getVMPoolManager()`; the connection handler looks up `vm.publicIp` per `compId`
- OBS integration — direct import `getOBSConnectionManager()`/`getOBSStateSync()`; `setupOBSRoutes(app, …)`
- Alerts — direct import `getAlertService()`; 8 `/api/alerts/*` routes
- Rundown — direct import `TimesheetEngine`; per-competition `Map` of engines
- Clip playout / Scoring feed / RTN stats / Themes / Sponsors / Teams database / Talent comms / Commentary talent CRM / Camera management / Competition model — all hosted in-process by direct import

**Used by:**
- Home page — `HomePage.jsx:919,925` links to `/_admin/vm-pool` and `/_admin/setup-guide`
- Producer View / Talent View — Socket.io via `ShowContext.jsx:91` `io(socketUrl, {query:{compId}})`; `ConnectionStatus.jsx` renders the green/red dot from `useShow().connected`
- Competition workspace — `CompetitionContext` resolves `socketUrl` to the coordinator on HTTPS
- Settings / Producer surfaces — 16 files import `serverUrl.js` for `fetch(`${SERVER_URL}/api/…`)`
- Production checklist — `checklistItems.js:144` validator `socket-connected` ("Show controller connected to coordinator") with `fixLink: /_admin/vm-pool`
- Graphics rendering — the coordinator also `express.static`s the repo root, serving `output.html` and `overlays/` to OBS browser sources

**UI surfaces:**
- System offline / wake screen — `show-controller/src/pages/SystemOfflinePage.jsx` (route `/_admin/system-offline`, also rendered by `CoordinatorGate` and `VMPoolPage.jsx:432`)
- Setup guide (explains wake/sleep) — `show-controller/src/pages/SetupGuidePage.jsx` (route `/_admin/setup-guide`)
- Coordinator status badge + "Start System" button — `show-controller/src/components/CoordinatorStatus.jsx` (rendered only by `VMPoolPage.jsx:17`)
- Route guard — `show-controller/src/components/CoordinatorGate.jsx` (wraps only `/_admin/vm-pool` in `App.jsx:97-103`)
- Server/OBS connection dot — `show-controller/src/components/ConnectionStatus.jsx` (ProducerView:681, TalentView:189)

**Known gaps:**
- `/api/coordinator/wake` and `/api/coordinator/stop` are referenced by the shim at `server/index.js:4380-4385` and by `docs/prd-test-vm-separation.md` but **never implemented** — the shim redirects into a 404.
- `useCoordinator` uses same-origin `/.netlify/functions/*` instead of `VITE_API_URL`; the built bundle in `show-controller/dist/assets/index-DWTwe8Wj.js` still contains that string. Wake is unreachable under nginx.
- No `/health` route despite `SPINUP-2026-08-17.md:88` and `CLAUDE.md:616` documenting one; the SPA catch-all masks it.
- `app.use(express.static(join(__dirname, '..')))` (index.js:1863) serves the entire deploy root. With `DEPLOY_PATH=/opt/gymnastics-graphics` and the Firebase key at `/opt/gymnastics-graphics/firebase-service-account.json` (`docs/INFRASTRUCTURE.md`), `GET /firebase-service-account.json` would serve the Admin SDK private key. Combined with `app.use(cors())` (wide open) and Socket.io `cors:{origin:"*"}` (index.js:80-85) and zero server-side auth, the whole API is unauthenticated.
- `ecosystem.config.js` sets `wait_ready: true` + `listen_timeout: 10000`, but `server/index.js` never calls `process.send('ready')` — PM2 would treat every start as a timeout. There are also no `process.on('SIGTERM'/'SIGINT')` handlers, so PM2 restarts are ungraceful.
- Port disagreement: `ecosystem.config.js` `PORT: 3001` and `docs/INFRASTRUCTURE.md` say 3001; `index.js` default, `SPINUP-2026-08-17.md`, `CLAUDE.md` and the CLAUDE.md troubleshooting row (`fuser -k 3003/tcp`) say 3003.
- The shutdown warning contract is server-only: `io.emit('shutdownPending'|'shutdownCancelled'|'shutdownExecuting'|'serverShuttingDown')` (index.js:1428-1449) has **no listener anywhere in `show-controller/src`**, so the promised "30-second warning, clients notified" never reaches a user.
- `TalentDiscoveryPage.jsx:17` destructures `coordinatorUrl` from `useCoordinator()`, which the hook never returns — its two fetches go to `undefined/api/talent/discover`.
- `configLoader.setActiveCompetition(clientCompId)` on every socket connection (index.js:4666) is process-global, so with two competitions connected the REST routes that read the "active competition" serve whichever client connected last.
- `connectToOBS()` is **not** gated by `COORDINATOR_MODE` and runs on `listen` (index.js:8729), so the coordinator retries a nonexistent local `ws://localhost:4455` every 30 s forever.
- `COORDINATOR_MODE` gates only four things (grep result: `index.js:1416,1418,3247,3297`, `autoShutdown.js:25`, `selfStop.js:31`): skipping `initializeAutoShutdown()`, the `enabled` flag on auto-shutdown and self-stop, and the `mode:'coordinator'|'standalone'` string in the status payload. VM pool, OBS connection manager, scoring ingestion, timesheet, playout and every route are identical in both modes — a standalone OBS VM boots the VM-pool manager and the whole coordinator API surface too, and only logs "VM pool not available" when AWS creds are missing.
- `netlify.toml` at the repo root and `show-controller/README.md` ("deployed to Netlify at commentarygraphic.com") are stale; `DEPLOYMENT.md` is entirely about Netlify drag-and-drop of a pre-React static site and describes neither EC2 host.

**Evidence of live use:**
- `docs/PRD-Rundown-System/BUGS.md` BUG-021 (2026-03-07) — live "Load Rundown silently fails" incident; root cause and fix both in `io.on('connection')`
- `CLAUDE.md:544-620` — coordinator ops runbook with a real symptom table (PM2 crash-looping on port 3003, missing `GOOGLE_APPLICATION_CREDENTIALS`) and the BUG-021 rule restated
- `docs/INFRASTRUCTURE.md` — live IPs 44.193.31.120 / 3.87.107.201, real `pm2 logs coordinator` procedures
- Git log: `a0bc187f PRD-Renderer-System: Phase 6 Task 21 — Production deploy and verification`, `c63946b4 … Task 7 — Deploy to production + nginx config`, `9760a1f0 PRD-Theme-System-V2: Task 7F.8 — Deploy + Verify Playout with WCGNIC Data`, `c74f7749 clip-codec: deploy proxy endpoint and client changes to production`
- `SPINUP-2026-08-17.md` — post-mortem teardown notes confirming both EC2 hosts existed and were terminated

**PRDs / docs:**
- `docs/PRD-CoordinatorDeployment-2026-01-15.md` (Phases 18-21: PM2, auto-shutdown, self-stop, Netlify wake/status functions, cost analysis)
- `docs/INFRASTRUCTURE.md`
- `SPINUP-2026-08-17.md`
- `CLAUDE.md` (§Deploy to Production, §Coordinator Server)
- `DEPLOYMENT.md` (stale — Netlify-era)
- `VM-SETUP.md` + `vm-full-setup.sh` (standalone `virtius-server` mode)
- `docs/prd-test-vm-separation.md` (unimplemented nginx-proxy plan for wake/stop)
- `docs/PRD-Rundown-System/BUGS.md` (BUG-021)

---

**Inventory of what `index.js` hosts (rough counts by area).** The 8,730-line file registers **82 HTTP routes**: competition/CRM index 13, `/api/admin/*` 12 (9 VM-pool, 3 themes), timesheet 8, alerts 8, cameras 7, coordinator health 5, OBS scene generation (`/api/scenes`) 4, talent discovery/outreach 4, commentary booking-email-calendar 4, config 3, RTN proxy 2, VM status 1, Virtius proxy 1, and 10 miscellaneous (`/api/status`, `/api/apparatus/:gender`, `/api/book/generate`, `/api/import-csv`, `/api/clip-proxy`, `/api/csv-template`, three `/.netlify/functions/*` shims, and the SPA catch-all) — plus a further **65 route registrations across 48 OBS paths** (scenes/items, inputs, audio+presets, stream, templates, transitions, studio-mode, assets, preview screenshots, talent-comms) mounted from `server/routes/obs.js` via `setupOBSRoutes`. It registers **117 distinct `socket.on` handlers** inside one `io.on('connection')`: `obs:*` 53, show/rundown/timesheet control 22, `playout:*` 15, camera 5, VM pool 5, `scoring:*` 5, graphics/scene triggers 4, AI context/suggestions 4, RTN stats 3, alerts 1 — and emits **124 distinct event names**. Startup order after `httpServer.listen` is: load+validate `config/show-config.json` (exit on invalid), camera modules, scene generator, timesheet engine, VM pool manager, auto-shutdown (coordinator-mode only), OBS connection manager, scoring ingestion, then `connectToOBS()`.
