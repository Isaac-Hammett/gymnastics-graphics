# Surfaces: Home, Competition workspace, Producer View, Talent View, Settings

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

---

## 1. Home page

**Route(s)**
- `/` → `<RequireAuth><HomePage /></RequireAuth>` (`show-controller/src/App.jsx:80`)
- `/select`, `/hub`, `/dashboard` → `<Navigate to="/" replace />` (`App.jsx:83-85`)
- `/producer`, `/show-producer`, `/camera-setup` (bare, no compId) → `<Navigate to="/" replace />` (`App.jsx:121-123`)

**Purpose** — The control center: a searchable list of competitions with per-competition readiness badges and VM assign/release, plus a directory of every standalone tool and overlay template. It is the only place a producer picks which competition to work on.

**Composed systems**

| Panel / control | Component file | System it belongs to | What it lets the user do |
|---|---|---|---|
| Coordinator status badge (top-right) + "System is Sleeping" / "System Starting" banners + Start System button | `show-controller/src/components/CoordinatorStatus.jsx`, `show-controller/src/hooks/useCoordinator.js` | Coordinator server | See whether the coordinator EC2 is awake; wake it |
| Pre-Production Alerts list + `AlertCard` (inline in HomePage) | `show-controller/src/hooks/useProductionAlerts.js`, `HomePage.jsx:1728-1826` | Commentary talent CRM (alerts derived from `competitions/*/commentary`) | See staffing gaps; jump to `/{compId}/commentary`; POST `/api/commentary/{compId}/{talentId}/calendar-invite` |
| Local Development card → Producer / Talent / Cameras (`/local/producer`, `/local/talent`, `/local/camera-setup`) | `HomePage.jsx:672-704` | Competition model (`isLocalMode` in `CompetitionContext.jsx:36`) | Open the workspace against `localhost:3003` |
| Competition search + Create Competition + `CompetitionModal` (Virtius session-ID fetch, theme picker, team fields) | `HomePage.jsx`, `show-controller/src/hooks/useCompetitions.js` (28,886 lines-of-file hook module) | Competition model | Create / edit / delete / duplicate a competition; pull teams from Virtius |
| Per-competition card: gender badge, `VmStatusIndicator`, VM badge/IP | `HomePage.jsx:1008-1055`, `show-controller/src/hooks/useVMPool.js` | VM pool | See which VM is assigned and its public IP |
| `StatsStatusBadge` + `StatsDetailPanel` + `RankingsPanel` on each card | `components/StatsStatusBadge.jsx`, `components/StatsDetailPanel.jsx`, `components/RankingsPanel.jsx` | RTN stats | See stats freshness; expand team stats & national rankings |
| `CommentaryStatusBadge` (defined inline, `HomePage.jsx:1698`) | `HomePage.jsx` | Commentary talent CRM | "Commentary: 2/3 confirmed" from `competitions/{compId}/commentary` |
| `ScoringFeedBadge` | `components/ScoringFeedBadge.jsx` | Scoring feed | See if the Virtius poller is enabled/running |
| Card actions: Producer / Talent / Graphics / Cameras / Checklist / Commentary | `HomePage.jsx:1057-1095` | Competition workspace (surface) | Enter the workspace; "Graphics" opens `/output.html?comp={compId}` (Graphics rendering), **not** the `/graphics` tab |
| Assign VM / Release VM buttons | `HomePage.jsx:1100+`, `useVMPool.js` | VM pool | Claim/free an EC2 OBS VM for a competition |
| **Management Tools** section | `HomePage.jsx:876-912` | — | `/media-manager` (Graphics rendering — logos/headshots), `/url-generator` (Graphics rendering), `/graphics-manager` (Graphics rendering), `/theme-editor` (Themes), `/background-generator` (Themes), `/import` (Rundown — CSV show plans, `views/ImportView.jsx`) |
| **System Administration** section | `HomePage.jsx:915-932` | — | `/_admin/vm-pool` (VM pool), `/_admin/setup-guide` (docs), `/output.html` (Graphics rendering) |
| **Overlay Templates** section (7 external cards) | `HomePage.jsx:939-947` | Graphics rendering | Open `/overlays/logos.html`, `team-stats`, `coaches`, `hosts`, `event-bar`, `event-frame`, `stream` directly |
| Head-coach lookup on cards | `hooks/useRoadToNationals.js` (`useHeadCoach`), `hooks/useTeamsDatabase.js` | RTN stats / Teams database | Auto-fill coach + team logo |

**Status of the composition — Partial (leaning Built).** Every card, badge and tool link is real and wired; `HomePage.jsx` is 1,826 lines and imports 5 live hooks plus 5 real panels. Two concrete gaps:
1. **The coordinator controls are dead.** `useCoordinator.js:45,119,171` still call `/.netlify/functions/coordinator-status`, `/wake-coordinator`, `/stop-coordinator`. The functions exist only at `show-controller/netlify/functions/` and Netlify is no longer the host (`netlify.toml` is the only remaining Netlify config). On failure `checkStatus` sets status to `OFFLINE` (`useCoordinator.js:98`), so the page permanently shows "System is Sleeping", Start System never works, and `CoordinatorGate` therefore blocks `/_admin/vm-pool` with `SystemOfflinePage`.
2. **Two top-level tools are unreachable from Home.** Nothing on HomePage links to `/talent` (the talent roster CRM) or `/settings` — I grepped every `to=` / `href=` / `navigate(` in `show-controller/src`. `/talent` is reachable from `CommentaryPage.jsx:608,897` and `TalentProfilePage`; `/settings` is reachable from **no** link anywhere in the SPA.

**Notes**
- `HubPage.jsx` (257 lines) and `DashboardPage.jsx` (1,001 lines) are **Orphaned/superseded**: neither is imported by `App.jsx`, and `/hub` + `/dashboard` redirect to `/`. `HomePage.jsx:20-25` names them explicitly as the three pages it consolidated. `CompetitionSelector.jsx` (23,981 bytes) is orphaned the same way — no importer.
- The `CommandPalette` (Cmd+K) is mounted globally in `App.jsx:52` and searches `talentRoster` (Firebase) + `GET /api/competitions/index` (`components/crm/CommandPalette.jsx`). It is the practical way into the talent CRM.

---

## 2. Competition workspace

**Route(s)** — `/:compId` → `<CompetitionLayout />` (`App.jsx:126-143`), with `index` → `Navigate to="producer"`. Children: `producer`, `talent`, `camera-setup`, `graphics`, `obs-manager`, `commentary`, `rundown`, `checklist` (the last wrapped in `<ErrorBoundary>`).

**Purpose** — The per-competition shell. It resolves the compId to a VM/socket URL, mounts the three providers every tab depends on, and renders a thin header plus one nested tab.

**Composed systems**

| Panel / control | Component file | System it belongs to | What it lets the user do |
|---|---|---|---|
| Config resolution, loading spinner, error screens | `components/CompetitionLayout.jsx` + `context/CompetitionContext.jsx` + `components/CompetitionError.jsx` | Competition model | Resolve `competitions/{compId}/config`, derive `socketUrl` from `vmAddress`, surface NOT_FOUND / VM_UNREACHABLE / FIREBASE_ERROR |
| `ShowProvider` (socket.io to the VM) | `context/ShowContext.jsx` (23,269 bytes) | Coordinator server + Rundown | One socket per competition, `query: { compId }`; carries `state` (legacy) and `timesheetState` |
| `OBSProvider` | `context/OBSContext.jsx` (29,402 bytes) | OBS integration | OBS scene/source/audio state for every tab |
| Header: gender badge (MAG/WAG), event name, venue, LOCAL chip, connected dot + vmAddress, Checklist link, Change link | `components/CompetitionHeader.jsx` (92 lines) | Competition model | Confirm which meet you're in and whether the VM socket is up |
| **producer** tab | `views/ProducerView.jsx` | Producer View (surface — see §3) | Run the show |
| **talent** tab | `views/TalentView.jsx` | Talent View (surface — see §4) | Commentator-facing controls |
| **camera-setup** tab | `pages/CameraSetupPage.jsx` (17,479 bytes) | Camera management | Define cameras, assign apparatus (via `useApparatus(gender)`), pull a scene preview |
| **graphics** tab ("Meet Setup") | `pages/ControllerPage.jsx` (18,971 bytes) | Graphics rendering + Competition model | Edit event info / team fields / coaches with per-field locks (`config._locks`), fire graphics |
| **obs-manager** tab | `pages/OBSManager.jsx` (22,527 bytes) + `components/obs/*` (13 files) | OBS integration (+ Talent comms) | 8 sub-tabs: Scenes, Sources, Audio, Transitions, Stream, Assets, Templates, Talent Comms |
| **commentary** tab | `pages/CommentaryPage.jsx` (39,830 bytes) + `components/crm/KanbanBoard.jsx`, `KebabMenu.jsx` | Commentary talent CRM | Assign PBP / Analyst / Producer slots, move Assigned→Invited→Confirmed→Briefed, send invites, list/kanban toggle |
| **rundown** tab | `pages/RundownEditorPage.jsx` (**523,048 bytes** — largest client file) | Rundown (+ Clip playout, Who to Watch, Sponsors) | Build the run of show; also hosts `components/playout/PlayoutRulesEditor.jsx`, `ContentSequenceEditor.jsx`, `WhoToWatchEditor.jsx` |
| **checklist** tab | `pages/ChecklistPage.jsx` (25,955 bytes) + `components/TeamContactsPanel.jsx` + `hooks/useProductionChecklist.js` | Production checklist | Phase-tabbed pre-show checklist with notes and per-team contacts |

**Status of the composition — Partial.** The shell itself is solid: `CompetitionLayout` handles auth, reserved-prefix escape (`_admin`/`admin`/`api`), loading and three distinct error types, and deliberately does *not* block on a missing `vmAddress` (`CompetitionLayout.jsx:47-49`). Six of eight tabs read compId correctly from `useCompetition()`/`useParams()`. Two are broken as tabs:

- **`/:compId/graphics` is effectively dead.** `ControllerPage.jsx:15-16` reads `compId` from `useSearchParams().get('comp')`, not the route param. At `/:compId/graphics` that is `null`, so the page renders "No competition ID specified." (`ControllerPage.jsx:150-157`). It only works at the legacy `/controller?comp=…` URL — and the only links to that form are in the orphaned `HubPage.jsx:51,103` and `DashboardPage.jsx:478`. Nothing in the live app links to `/:compId/graphics` at all.
- **`/:compId/talent` has the same compId defect** (see §4).

**Notes**
- There is **no tab bar.** `CompetitionHeader.jsx` renders only the Checklist and Change links. Tab navigation happens through the link row inside `ProducerView.jsx:557-608` (Home, Rundown Editor, OBS Manager, Checklist, Commentary) and the HomePage competition card. Camera-setup is reachable only from the HomePage card; `graphics` from nowhere.
- `/:compId/talent` is intentionally exempt from auth: `CompetitionLayout.jsx:92-96` skips the `RequireAuth` redirect when the path ends in `/talent`, so commentators don't need a Firebase account.

---

## 3. Producer View — **the product**

**Route(s)** — `/:compId/producer` (`App.jsx:131`); also the index redirect for `/:compId`. `views/ProducerView.jsx`, 1,663 lines.

**Purpose** — The single screen a producer runs a broadcast from: rundown transport, camera switching, OBS scene override, graphics triggering, alerting, scoring, clip playout, and VM credentials, all against one competition.

**Composed systems**

| Panel / control | Component file | System it belongs to | What it lets the user do |
|---|---|---|---|
| Nav row: Home / Rundown Editor / OBS Manager / Checklist / Commentary | inline `ProducerView.jsx:557-608` | Competition workspace | Move between tabs (the de-facto tab bar) |
| Rundown status badge + "N changes" badge + Reload button + confirm dialog | inline `ProducerView.jsx:614-800` | Rundown | See that the editor changed under you; reload preserving position |
| `ThemeErrorBadge` / `ThemeErrorLog` | `components/ThemeErrorLog.jsx`, `hooks/useThemeErrors.js` | Themes | See theme-load failures from `competitions/{compId}/production/themeErrors`; clear them |
| Alert count chips + critical-alert banner + `AlertPanel` | `components/AlertPanel.jsx`, `hooks/useAlerts.js` | Alerts | Acknowledge critical/warning alerts from `alerts/{compId}` |
| `ConnectionStatus` | `components/ConnectionStatus.jsx` | Coordinator server | Socket up/down |
| Camera Mismatch banner | inline `ProducerView.jsx:826-847` | Camera management | See cameras pointing at the wrong apparatus |
| REHEARSAL MODE banner + Rehearsal toggle | inline `ProducerView.jsx:849-861`, `909-923` | Rundown | Run the rundown with OBS + graphics suppressed |
| Clip Engine API Error banner + Retry | inline `ProducerView.jsx:863-882` | Clip playout | See third-party clip-API failures; refetch |
| "Ready to Start": Load Rundown / Reload Rundown, Start Show, stale-stats hint | inline `ProducerView.jsx:886-950` | Rundown + RTN stats | Load the rundown; start; `handleStartShow` kicks a non-blocking RTN refresh if stale (`ProducerView.jsx:173-183`) |
| `CurrentSegment`, `NextSegment` | `components/CurrentSegment.jsx`, `NextSegment.jsx` | Rundown | Now / next with timing |
| "Current Segment Deleted" warning | inline `ProducerView.jsx:955-966` | Rundown | Recover when the editor deletes the live segment |
| Show Control: Previous / NEXT / Pause-Resume / Lock Talent / Reset Show / Stop | inline `ProducerView.jsx:1000-1094` | Rundown (timesheet engine) | Drive the show |
| Audio Cue panel + mute toggle | inline `ProducerView.jsx:1098-1160` | OBS integration | See the cued song, mute/unmute the OBS source |
| Quick Camera Switch (health dots + apparatus labels) | inline `ProducerView.jsx:1163-1203` | Camera management | `socket.emit('overrideCamera', …)` |
| Scene Override (8 fixed buttons + full scene `<select>`) | inline `ProducerView.jsx:1205-1237` | OBS integration | Force an OBS scene |
| `RunOfShow` (clickable → `jumpTo`) | `components/RunOfShow.jsx` | Rundown | Jump to any segment |
| `OverrideLog` | `components/OverrideLog.jsx` | Rundown | `GET {serverUrl}/api/timesheet/overrides` — who overrode what |
| `ScoreBugPanel` | `components/ScoreBugPanel.jsx` (17,712 bytes) | Scoring feed + Graphics rendering | Toggle the score bug, polling, automation mode, now-competing, lineups (writes `competitions/{compId}/scoreBug/*`) |
| `ScoringFeedPanel` | `components/ScoringFeedPanel.jsx`, `hooks/useScoringFeed.js` | Scoring feed | Enable/disable Virtius polling, set interval, force refresh (`competitions/{compId}/config/scoringFeed`) |
| **VM Connection panel** — defined *inside* ProducerView | `ProducerView.jsx:1597-1663` (local `function VMConnectionPanel`) | VM pool | Show VM IP + username, reveal/copy the password; renders only if `competitionConfig.vmCredentials` exists |
| AI Talking Points panel (sidebar copy) | inline `ProducerView.jsx:1300-1430`, `hooks/useAIContext.js` | Talent View / AI context sub-part | Read talking points + milestones; manual refresh |
| `CameraRuntimePanel` (swaps to `ClipQueuePanel` during playout) | `components/CameraRuntimePanel.jsx` | Camera management | Per-camera health, apparatus, fallbacks, verify |
| `GraphicsControl` | `components/GraphicsControl.jsx` (49,085 bytes) | Graphics rendering (+ Sponsors, Themes) | Trigger any graphic — writes `competitions/{compId}/currentGraphic`, reads `customGraphics`, `themes/{theme}/sponsors` |
| Connected Clients | inline `ProducerView.jsx:1474-1503` | Coordinator server | See producer/talent sockets |
| Show Stats (Status / Talent Controls / OBS) | inline `ProducerView.jsx:1505-1535` | Rundown + OBS integration | At-a-glance state |
| `PlayoutStatusBar` | `components/playout/PlayoutStatusBar.jsx` | Clip playout | NOW / NEXT / QUEUE cards, mode badge, coordinator heartbeat, preload state |
| `CameraStatusPanel` | `components/playout/CameraStatusPanel.jsx` | Clip playout | Force a camera with keyboard hints |
| `PlayoutControls` | `components/playout/PlayoutControls.jsx` | Clip playout | Pause / Skip / Force / Stop / Release override |
| `PlayoutEventLog` | `components/playout/PlayoutEventLog.jsx` | Clip playout | Scrollable log + per-clip retry |
| `ClipQueuePanel` | `components/playout/ClipQueuePanel.jsx` | Clip playout | Queue with rotation filter, add/skip/retry/retry-all/flag |
| `MomentReplayDialog` (modal) | `components/playout/MomentReplayDialog.jsx` | Clip playout | Set seek window + speed, Play Now or Save Only |
| `KeyboardShortcutsPanel` (modal) | `components/playout/KeyboardShortcutsPanel.jsx` | Clip playout | View/rebind shortcuts (persisted to `localStorage`) |
| Dev-only Playout toggle (`import.meta.env.DEV`) | inline `ProducerView.jsx:1573-1590` | Clip playout | Force the playout layout on locally |

**Subscriptions this view opens**

- `useShow()` → the competition socket (`ShowContext.jsx:79-93`, `io(socketUrl, { query: { compId } })`); supplies `state` (legacy `showState`) and `timesheetState`.
- `useTimesheet()` → derived from `ShowContext.timesheetState`; actions emit `startTimesheetShow`, `stopTimesheetShow`, `pauseTimesheetShow`, `resumeTimesheetShow`, `advanceSegment`/`previousSegment`.
- `useOBS()` → `obsState`, `setMute`.
- `useAlerts()` → Firebase `alerts/{compId}` (compId from `useCompetition`, `'local'` in local mode).
- `useThemeErrors(compId)` → Firebase `competitions/{compId}/production/themeErrors`.
- `useAIContext()` → socket `aiContextUpdated`, `aiContextResult`, `aiContextRefreshResult`; emits `getAIContext`, `refreshAIContext`.
- `useRtnStats(compId, competitionConfig)` → staleness + `refresh()`.
- `usePlayoutState()` → socket `playout:stateUpdate`, `playout:modeChange`, `playout:clipQueueUpdate`, `playout:error`; emits `playout:getState` on mount.
- `usePlayoutActions()` → emits `playout:skipClip|forceCamera|releaseOverride|pause|resume|stop|start|flagMoment|addToQueue|retryClip|retryAllFailed|fetchClips`.
- Direct `socket.on` in the view: `cameraHealth`, `cameraRuntimeState` (`:424-425`), `timesheetAudioCueTriggered` (`:447`), `loadRundownResult` (`:520`). Direct `socket.emit`: `overrideCamera` (`:464`).
- Direct `fetch`: `/api/scenes` (relative — hits the SPA host, not the VM), `${serverUrl}/api/cameras/health`, `${serverUrl}/api/cameras/runtime` (`:383-404`). `serverUrl = socketUrl || 'http://localhost:3003'`.

**Keyboard shortcuts** — `hooks/useKeyboardShortcuts.js`. Defaults: `1`–`6` force camera 1–6, `s` skip, `Space` pause/resume, `Escape` release override, `f` flag moment, `?` open shortcuts panel. Persisted under `localStorage['playout-keyboard-shortcuts']`. Enabled only when `showPlayoutPanels` is true (`enabled: showPlayoutPanels`, `ProducerView.jsx:330`), i.e. `isPlayoutActive && timesheetIsRunning` — **the shortcuts are inert during a normal, non-clip show.**

**Status of the composition — Proven, with two Partial sub-areas.**

*Proven:* `docs/PRD-Clip-Integration/issues/producer.json` records a 2026-03-23 production verification run against `https://commentarygraphic.com/wcgnic-2026-prelim1/producer`, `"status": "PASS"`, with per-component pass records for PlayoutStatusBar / CameraStatusPanel / ClipQueuePanel and screenshots at `docs/PRD-Clip-Integration/screenshots/verify-producer-*.png` (playout-active, override-mode, keyboard-shortcuts, rundown-loaded, stopped). `docs/PRD-Rundown-System/BUGS.md` documents live-incident fixes against this exact view (BUG-011, BUG-018, BUG-019, BUG-021) including a deploy note naming the coordinator VM `44.193.31.120` and `commentarygraphic.com` (`3.87.107.201`).

*Partial — playout has no producer-facing entry point.* `usePlayoutActions` exports `startPlayout` (`usePlayoutActions.js:98-104`, emits `playout:start`) but **no component calls it** — I grepped all of `show-controller/src`. The only ways `isPlayoutActive` becomes true are (a) a rundown segment of playout type, which the server handles at `server/index.js:713-714` (`engine.on('playoutStarted')` → `getOrCreatePlayoutEngine(compId).start(...)`), or (b) the `import.meta.env.DEV`-gated toggle at `ProducerView.jsx:1573`. So half the panels in this view are only reachable through the rundown, never from a button on the producer screen.

*Partial — `/api/scenes` is fetched relative.* `ProducerView.jsx:383` calls `fetch('/api/scenes')` with no `serverUrl` prefix, unlike the two camera fetches beside it. On the deployed SPA host that returns `index.html`, which matches the `WARN-002` "API endpoint returning HTML instead of JSON / `SyntaxError: Unexpected token '<'`" recorded in `docs/PRD-Clip-Integration/issues/producer.json`. The scene `<select>` therefore stays empty; only the 8 hard-coded scene names work.

**"Dual Control Systems" — current state of the ROADMAP known issue**

`ROADMAP.md:390-413` describes two unsynchronized control stacks in Producer View: a left "Original Show Controller" and a right "Timesheet Panel" wired to a separate engine.

- **The right-hand panel is gone.** `ProducerView.jsx:16` reads `// TimesheetPanel removed - functionality consolidated into main content area (PRD-Rundown-00)`, and no `TimesheetPanel*` file exists anywhere in the repo. The ROADMAP entry is stale on that point.
- **The polarity flipped: the timesheet engine won.** `ProducerView.jsx:135-137` sets `showIsActive = timesheetIsRunning` and `showIsPaused = timesheetIsPaused` (the BUG-011 fix). Pause/Resume, Stop and Reset were rewired to `timesheetPause`/`timesheetResume`/`timesheetStop` by BUG-018 (`docs/PRD-Rundown-System/BUGS.md:207-263`).
- **But the legacy engine is still alive on the server and still reachable from the UI.** `server/index.js:7992` still implements `socket.on('startShow')`, which sets `showState.isPlaying = true`, runs its own auto-advance over the legacy global `showConfig.segments`, switches OBS scenes, and does `io.emit('triggerGraphic', …)` — a *global*, non-room-scoped broadcast. `resetShow` (`:8019`) and `togglePause` (`:7161`) are likewise still live. Meanwhile `startTimesheetShow` (`:7816`) calls only `engine.start()` and **never sets `showState.isPlaying`**.
- **Residue inside Producer View:** the view still destructures `togglePause` and `resetShow` from `useShow()` (`ProducerView.jsx:91-92`) and `isPlaying`/`isPaused` from legacy `state` (`:125-126`) and never uses any of them. Its "Reset Show" and "Stop" buttons both call the identical `timesheetStop` (`:1077`, `:1086`).
- **The unresolved half of the issue now lives in Talent View**, not Producer View — see §4. The only cross-engine sync that exists is one-directional and only on stop: `ShowContext.jsx:283-284` clears legacy `isPlaying` when `timesheetShowStopped` arrives.

**Notes**
- `PoolStatusBar`, `StatsStatusBadge`, `ScoringFeedBadge` and `QuickActions` are **not** in Producer View despite being in the ask. `PoolStatusBar` is used only by `pages/VMPoolPage.jsx:16`; `StatsStatusBadge`/`ScoringFeedBadge` only by `HomePage.jsx` (and the orphaned `DashboardPage`); `QuickActions` only by `views/TalentView.jsx:13`. VM info in Producer View comes from the locally-defined `VMConnectionPanel` instead.
- `usePlayoutSimulation.js` still exists (11,473 bytes) but `ProducerView.jsx:36` notes it was removed in Stage B — simulation moved server-side. It has no importer.

---

## 4. Talent View

**Route(s)** — `/:compId/talent` (`App.jsx:132`). Public: `CompetitionLayout.jsx:92-96` skips the auth redirect for paths ending in `/talent`. `views/TalentView.jsx`, 566 lines.

**Purpose** — The commentator's screen: what's on air now, the script, what's next, and three big transport buttons — with a producer lock that can grey them out.

**Composed systems**

| Panel / control | Component file | System it belongs to | What it lets the user do |
|---|---|---|---|
| Header (Hub link, event name, `ConnectionStatus`) | inline + `components/ConnectionStatus.jsx` | Competition model / Coordinator server | Confirm which meet and whether the socket is live |
| **ON CAMERA** flashing banner | inline `TalentView.jsx:201-211` | Rundown + Talent comms | Know you're live — driven by `currentSegment.talent.includes(talentId)` |
| "Viewing as: {name} ({role})" banner | inline `TalentView.jsx:214-221` | Talent comms | Confirm identity; roster read from `competitions/{compId}/production/talent` (`TalentView.jsx:98`), falls back to two dummy entries if absent |
| SHOW PAUSED banner / Controls-locked banners | inline `TalentView.jsx:224-241`, `541-546` | Rundown | Know the producer paused or locked you |
| **"Ready to Start"** panel + Start Show button | inline `TalentView.jsx:257-271` | Rundown (**legacy** engine) | Start the show — calls `startShow()` from `useShow`, i.e. legacy `socket.emit('startShow')` |
| `CurrentSegment` | `components/CurrentSegment.jsx` | Rundown | Now playing + timer |
| Teleprompter Script panel | inline `TalentView.jsx:278-290` | Rundown | Read `currentSegment.script` at 20px |
| **AI Talking Points panel** | inline `TalentView.jsx:293-434`, `hooks/useAIContext.js` | AI context sub-part (below) | Milestones & Records, Priority Points, Talking Points; manual refresh |
| `NextSegment` | `components/NextSegment.jsx` | Rundown | What's coming |
| Hold-segment countdown warning | inline `TalentView.jsx:440-450` | Rundown | Wait out a hold's minimum duration |
| PREV / PAUSE-RESUME / NEXT (large 3-up grid) | inline `TalentView.jsx:453-538` | Rundown (**timesheet** engine) | `timesheetPrevious('talent')`, `timesheetPause`/`Resume`, `timesheetAdvance('talent')` |
| `QuickActions hideApparatusCameras` | `components/QuickActions.jsx` (21,090 bytes) | Graphics rendering (+ Camera management, suppressed here) | Fire common graphics; camera buttons hidden for talent |
| `RunOfShow` (read-only) | `components/RunOfShow.jsx` | Rundown | See the whole show |
| `TalentClipInfo` + Flag Moment | `components/playout/TalentClipInfo.jsx` | Clip playout | NOW SHOWING athlete/apparatus/score, UP NEXT (3), one-click Flag Moment → `flagMoment({ …, playNow: false })` |
| Footer: "Segment N of M" | inline `TalentView.jsx:558-563` | Rundown | Progress |

**Status of the composition — Partial.** The layout, lock semantics, ON CAMERA logic, script panel and transport are all real and were verified in production: `docs/PRD-Clip-Integration/issues/talent.json` is a 2026-03-22 `"status": "PASS"` run, and BUG-012 in `docs/PRD-Rundown-System/BUGS.md:485-535` is a live-use write-up about this view showing the wrong competition name (fixed). Three concrete defects remain:

1. **`compId` is read from the wrong place.** `TalentView.jsx:80` does `searchParams.get('comp')`, but the route is `/:compId/talent` with no `?comp=` query. So `compId` is `null`, the `useEffect` at `:95-96` returns early, and **the Firebase talent roster is never loaded** — the view always falls back to `FALLBACK_TALENT` ("Talent 1", "Talent 2"). This silently undoes the BUG-015 fix for anyone arriving via the normal route. Same class of bug as `ControllerPage`.
2. **The surviving dual-control bug.** The "Ready to Start" gate is `!isPlaying`, where `isPlaying` comes from the **legacy** `state` (`TalentView.jsx:29`), while Producer View gates on `timesheetIsRunning`. `server/index.js:7816` (`startTimesheetShow`) never sets `showState.isPlaying = true`. So when the producer starts the show properly, **Talent View stays stuck on "Ready to Start"** — and if the commentator presses that button, `socket.emit('startShow')` (`ShowContext.jsx:502`) fires the *legacy* engine at `server/index.js:7992`, which independently switches OBS scenes, sets up its own auto-advance, and `io.emit('triggerGraphic', …)` globally. Two engines can drive OBS at once. This is the live remnant of the ROADMAP "Dual Control Systems" entry.
3. `TalentClipInfo` still ships **hard-coded** talking points: `PLACEHOLDER_TALKING_POINTS` at `components/playout/TalentClipInfo.jsx:25-30` ("Season high on this apparatus — previous best was 9.825"), rendered at `:137`. The comment says "AI context integration in Stage B"; it never happened.

**Sub-part: AI context for talent**

**Files** — `show-controller/src/hooks/useAIContext.js` (393 lines) · `server/lib/aiContextService.js` (**2,834 lines** — the largest file in `server/lib/`).

**What it is supposed to provide** — Per-segment talking points with priority (critical/high/medium/low), athlete context, score context, and "milestones" (career highs, season highs, school/meet records). The Talent panel renders three groups: *Milestones & Records* (trophy/star), *Priority Points* (critical red / high orange, left-border), and plain *Talking Points*, plus a manual refresh spinner and an empty state.

**Does it call a language model? No.** `aiContextService.js` imports nothing from any LLM SDK. Its only outbound `fetch(` is at line 1416 — `_fetchVirtiusSession()` hitting `${VIRTIUS_API_BASE}/session/${sessionId}/json` where `VIRTIUS_API_BASE = 'https://api.virti.us'` (line 25). Everything else is deterministic string templating from Virtius live scores plus the frozen RTN snapshot at `competitions/{compId}/rtnStats` (`_loadRtnStats`, ~line 2150): `_getScoreBasedTalkingPoints`, `_getAchievementTalkingPoints`, `_getBasicTalkingPoints`, `_getAthleteStatsTalkingPoints`, `_getConsistencyTalkingPoints`, `_getMVPTalkingPoints`, `_getLineupTalkingPoints`, then a priority sort and `.slice(0, maxTalkingPoints)` (default 5). Grepping `anthropic|openai|gpt-4|langchain|gemini|completions|bedrock` across `server/` hits only `server/lib/talentDiscoveryService.js:10,240,279` and `server/index.js:37,3455,3893` — i.e. the Anthropic SDK is used for **talent discovery and two other HTTP routes**, never by the context service. The owner's instinct is right: "AI" here means rule-based generation, not a model.

**Is `aiContextUpdated` wired end to end? Yes, with a real caveat.**
- Server emit: `aiContextService.js:2137` → `this.io.to('competition:${this.compId}').emit('aiContextUpdated', { compId, context, timestamp })`, called from `_broadcastContext` at `:265` inside `_updateContext`.
- Lifecycle: started on `engine.on('showStarted')` at `server/index.js:479-486` (after the RTN snapshot), stopped on `showStopped` at `:522-525`. `_updateContext` runs on a 5s interval but returns early unless the engine state is `running` **and the segment id changed** (`:246-256`) — so a broadcast only happens on segment transitions.
- Room: the socket joins `competition:${clientCompId}` at `server/index.js:4640`, but only `if (clientCompId && clientCompId !== 'local')` — **so the AI panel can never appear in local dev.**
- Client: `useAIContext.js:93-95` listens for all three events; `handleContextUpdated` is the *only* thing that sets `isRunning: true`.
- Request/response path: `socket.on('getAIContext')` at `server/index.js:7493` and `socket.on('refreshAIContext')` at `:7526` both exist and reply properly.

**Honest status of the sub-part — Partial, closer to Orphaned in practice.** Five specific breaks:

1. **The panel is gated on a flag nothing sets on mount.** Both views render the panel only `{aiRunning && …}` (`TalentView.jsx:293`, `ProducerView.jsx:1300`), and `isRunning` flips true *only* on an inbound `aiContextUpdated`. `useAIContext` exports `getContext()` but **never calls it**, and neither view calls it either (grep confirms the only `getContext` hits in `show-controller/src` are the hook's own definition/export and two `canvas.getContext('2d')` calls). So the panel is invisible until the show is running *and* a segment boundary is crossed — and the Refresh button, which is inside the panel header, is unreachable until then.
2. **`context.milestones` is always empty.** `_generateSegmentContext` initialises `milestones: []` (`aiContextService.js:285`) and never pushes to it — grep for `context.milestones` returns only that one line. Career highs and records go into `context.achievements` and are converted to *talking points* instead. The "Milestones & Records" block that both views render — the trophy badge, the star cards — is dead UI.
3. **`aiAchievementsDetected` has no consumer.** Emitted at `aiContextService.js:2063`; grepping all of `show-controller/` returns zero listeners.
4. **The talent-facing clip panel ignores the service entirely** — `TalentClipInfo.jsx` uses `PLACEHOLDER_TALKING_POINTS`, see above.
5. Self-labelled incomplete in-file: the section header at `aiContextService.js:227` still reads `Context Generation (Stubs - to be implemented in Task 59)` and `:260` `// Generate context for this segment (stub - returns placeholder data)`, even though the generators below it are substantial. There are **no tests** — nothing matching `ai`/`context` in `server/__tests__/`. `docs/PRD-RTN-Stats-Integration/PRD-RTN-Stats-Integration-2026-02-01.md:127,143,235-246` leaves every AI-talking-point acceptance criterion unchecked, and its `BUGS.md:721` records that "AI talking points use the stale snapshot for the entire show."

---

## 5. Settings

**Route(s)** — `/settings` → `<RequireAuth><SettingsPage /></RequireAuth>` (`App.jsx:113`). `show-controller/src/pages/SettingsPage.jsx`, 336 lines.

**Purpose** — One thing only: bulk-import the annual commentator availability survey from a Google-Forms CSV export into the talent roster.

**Composed systems**

| Panel / control | Component file | System it belongs to | What it lets the user do |
|---|---|---|---|
| Header ("← Home", gear icon, "System configuration and batch imports") | `SettingsPage.jsx:176-192` | — | Navigate back |
| **Batch Import Survey Responses**: file picker → Preview Import → matched/new counts → Confirm Import | `SettingsPage.jsx:196-311` | Commentary talent CRM | Parse CSV, match rows against `talentRoster` by email, `update()` matches and `push()`+`set()` new records with `status: 'need-info'` |
| CSV Format guide (9 expected column names) | `SettingsPage.jsx:313-331` | Commentary talent CRM | Know the required headers |

Firebase touched: `talentRoster` (read via `get`), `talentRoster/{id}` (`update`), `talentRoster` (`push` + `set`). Fields written: `name`, `email`, `wagMag`, `internetUploadMbps`, `internetDownloadMbps`, `micType`, `hasHeadphones`, `discordUsername`, `commentaryRole`, `surveyAvailability`, `surveyCompleted`.

**Status of the composition — Partial (Orphaned as a destination).** The importer itself is complete and self-contained — parse, preview, confirm, success/error states all present and wired directly to Firebase with no server dependency. But **nothing in the SPA links to `/settings`**: I grepped every `to=`, `href=` and `navigate(` under `show-controller/src` and found zero references, and `CommandPalette` searches only talent and competitions. The page is URL-only.

**Notes**
- It contains **none** of the things the name suggests: no theme settings (those live at `/theme-editor` → `ThemeEditorPage.jsx`, 517,939 bytes), no graphics manager (`/graphics-manager`), no VM pool (`/_admin/vm-pool`), no account/auth section (sign-out lives in the floating `RequireAuth` chrome instead).
- `surveyAvailability` is stored keyed by CSV column header, with an explicit in-code caveat that the coordinator must map those names to compIds manually (`SettingsPage.jsx:152-154`) — an unfinished seam.
- The companion public form is `/survey/:year` → `pages/SurveyPage.jsx` (`App.jsx:118`), which needs no auth.

---

## Shared shell

**Provider stack** — `main.jsx` mounts `<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>`. `AuthProvider` is the **only** global provider; the other three are scoped to `/:compId`.

| Piece | File | Behaviour |
|---|---|---|
| `AuthProvider` / `useAuth` | `src/context/AuthContext.jsx` (39 lines) | Firebase `onAuthStateChanged` → `{ user, loading, signIn, signOut }`. System: **Auth**. |
| `CompetitionProvider` / `useCompetition` | `src/context/CompetitionContext.jsx` (6,494 bytes) | Route-scoped. Reads `competitions/{compId}/config`; derives `isLocalMode` (`compId === 'local'`), `vmAddress`, `socketUrl` (localhost:3003 in local mode, else `http://{vmAddress}`), `gender`; exposes `CompetitionErrorType` = NOT_FOUND / VM_UNREACHABLE / FIREBASE_ERROR. System: **Competition model**. |
| `ShowProvider` / `useShow` | `src/context/ShowContext.jsx` (23,269 bytes) | Route-scoped. Owns the socket.io connection and both `state` (legacy) and `timesheetState`. Systems: **Coordinator server** + **Rundown**. |
| `OBSProvider` / `useOBS` | `src/context/OBSContext.jsx` (29,402 bytes) | Route-scoped. System: **OBS integration**. |

**`RequireAuth`** (`src/components/RequireAuth.jsx`, 89 lines) — shows a "Loading…" screen while `loading`; if no `user`, `<Navigate to="/login" state={{ from: location.pathname }} replace />`; otherwise renders children plus a fixed top-right chrome showing `user.email` and a Sign Out button (`z-index: 9999`) on **every** protected page. Applied to `/`, `/controller`, `/url-generator`, `/media-manager`, `/graphics-manager`, `/theme-editor`, `/background-generator`, `/import`, `/_admin/*`, `/talent*`, `/settings`. Not applied to `/login`, `/book/:token`, `/survey/:year`, or `/:compId/*` (which guards itself).

**`ErrorBoundary`** (`src/components/ErrorBoundary.jsx`, 74 lines) — classic class boundary; `componentDidCatch` logs `[ErrorBoundary] Caught error`; fallback shows the error message and a Reload button whose `resetError` calls `window.location.reload()`. **Used in exactly one place:** wrapping `<ChecklistPage />` at `App.jsx:138-142`. Producer View, Talent View, the 523k-line Rundown Editor and the 517k-line Theme Editor are all unprotected — a render throw in any of them white-screens the app.

**`CoordinatorGate`** (`src/components/CoordinatorGate.jsx`, 108 lines) — used at exactly one route, `/_admin/vm-pool` (`App.jsx:97-103`). Passes through unconditionally for a hard-coded optional-path list (`/hub`, `/dashboard`, `/controller`, `/url-generator`, `/media-manager`, `/import` — three of which no longer exist as routes) and for anything under `/local`. Otherwise: `isAvailable` → children; `OFFLINE && !isWaking` → `<SystemOfflinePage redirectTo={currentPath} />`; `STARTING || isWaking` → a 60-90s spinner; `UNKNOWN` → "Checking system status…"; unknown fallthrough → children. Because `useCoordinator` polls the missing Netlify functions and its catch block forces `OFFLINE` (`useCoordinator.js:96-98`), **this gate currently blocks the VM Pool page permanently.**

**`SystemOfflinePage`** (`src/pages/SystemOfflinePage.jsx`, 8,848 bytes; also routed directly at `/_admin/system-offline`) — takes a `redirectTo` prop; `targetDestination` = `redirectTo` if given (line 33); once `isAvailable` flips true it `setTimeout`s and then `navigate(targetDestination, { replace: true })` (lines 45-53). So a producer blocked at `/_admin/vm-pool` is auto-returned there when the coordinator wakes — which, given the Netlify dependency, it currently never does.

**`CommandPalette`** (`src/components/crm/CommandPalette.jsx`, 398 lines) — mounted globally at `App.jsx:52`, outside every guard. Cmd+K / Ctrl+K, `createPortal` to document root, 60s TTL caches, recent items in `localStorage['crm-recent-items']`. Searches Firebase `talentRoster` and `GET {SERVER_URL}/api/competitions/index`. Systems: **Commentary talent CRM** + **Competition model**.

**`Toaster`** (`react-hot-toast`) — global, `App.jsx:55-77`, top-right, 3s, zinc theme.
