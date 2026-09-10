# Scoring feed

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Competition data
**Purpose:** Polls the Virtius live-scoring API for a competition and publishes graphic-ready leaderboards, team totals and rotation state into Firebase, so a producer gets live score graphics (apparatus/AA leaderboards, score bug, auto rotation slate) without every browser source hammering the API. Producers turn the feed on/off and pick a poll interval from the competition card or the Producer sidebar.

**Status:** **Partial** — the server-side ingestion path is complete and wired (`server/lib/scoringIngestionService.js` imported at `server/index.js:43`, `initializeScoringIngestion()` called in the `httpServer.listen` block at `server/index.js:8726`, panel + badge reachable from `App.jsx` routes `/` and `/:compId/producer`), and it has demonstrably run: Firebase `competitions/ecac-2026-audit/config/scoringFeed` holds `lastPollAt: "2026-04-03T16:08:16.474Z"`, `errorMessage: "Auto-stopped: Producer timeout (30 minutes inactive)"`, and `competitions/ecac-2026-audit/scoring/{rotationState,teamTotals,updatedAt}` was written for a real 6-team ECAC men's session (`config/virtiusSessionId: "3mwftyC216"`, teams ARMY/NAVY/GRN/SIM/SPR/W&M) — but with all scores 0, so **no `scoring/leaderboard/*` node was ever produced**. The consumer side is broken: `stage/blocks/leaderboard-table.js:146-152` only re-renders when `snapshot.val().rows` exists, while `scoringIngestionService.js:1132` writes a bare array to `leaderboard/{apparatus}` — so the ten `renderer: "stage"` leaderboard graphics render an empty table even when the feed is healthy. Exceptions at other levels: **Proven** for the older browser-side Virtius paths this was meant to replace (event-summary in `output.html`, `overlays/team-bug.html`, `overlays/rotation-slate-auto.html` — see Evidence); **Orphaned** for the whole `scoring:*` socket surface (no client anywhere emits or listens to it) and for `GET /api/virtius/:sessionId` (no caller).

**Sport coupling:** **Gymnastics-bound** — apparatus codes, Virtius event names (`FLOOR`/`HORSE`/`RINGS`/`VAULT`/`PBARS`/`BAR`/`BARS`/`BEAM`), men's/women's Olympic order lists, D/E/ND/stick-bonus score fields and gymnast-completes-all-events AA aggregation are hard-coded (`scoringIngestionService.js:51-88, 410-629`).

**Key files:**
- `server/lib/scoringIngestionService.js` (1229 lines) — poll loop, Virtius parse, Firebase writes, auto-stop, singleton map
- `server/index.js` (8730 lines) — import line 43; socket handlers 8360-8467; `initializeScoringIngestion()` 8592-8662; `wireScoringServiceEvents()` 8670-8695; Virtius proxy route 4212
- `show-controller/src/hooks/useScoringFeed.js` (97 lines) — Firebase-only read/write of `config/scoringFeed`
- `show-controller/src/components/ScoringFeedPanel.jsx` (243 lines) — Producer sidebar control panel
- `show-controller/src/components/ScoringFeedBadge.jsx` (148 lines) — LIVE/OFF/ERROR badge on competition cards
- `show-controller/src/views/ProducerView.jsx` (1663 lines) — renders panel at line 1290
- `show-controller/src/pages/HomePage.jsx` — renders badge at line 1047; direct Virtius fetch at line 239 (comp import)
- `stage/blocks/leaderboard-table.js` (173 lines) — the only consumer of `scoring/*`; binds `data.source` to Firebase
- `stage/graphics/leaderboard-{fx,ph,sr,vt,pb,hb,ub,bb,aa}.json` + `combined-aa-leaderboard.json` — `renderer: "stage"`, `source: "scoring/leaderboard/{APP}"`
- `stage/stage.html` (885 lines) — reads `currentGraphic`, passes `{comp, db}` context to blocks (lines 591-596, 638-652)
- `overlays/team-bug.html` (2544 lines) — score bug graphic, polls Virtius **in the browser**
- `overlays/rotation-slate-auto.html` (1390 lines) — auto rotation slate, polls Virtius **in the browser** (45 s)

**Firebase paths written:**
- `competitions/{compId}/scoring/leaderboard/{FX|PH|SR|VT|PB|HB|UB|BB|AA}` — top-10 array (server)
- `competitions/{compId}/scoring/teamTotals` — `{teamKey: {name, logo, total, events{}}}` (server)
- `competitions/{compId}/scoring/rotationState` — `{currentRotation, teamPositions{}}` (server)
- `competitions/{compId}/scoring/updatedAt` — ISO string (server)
- `competitions/{compId}/config/scoringFeed/{status,lastPollAt,errorMessage,enabled}` — server; `{enabled,pollInterval,forceRefresh}` — SPA hook
- `competitions/{compId}/scoreBug/{enabled,polling,showLineup,nowCompeting/{teamKey},dismissFlash/{i},config/{pollInterval,automationMode}}` — `ScoreBugPanel.jsx`
- `competitions/{compId}/scoreBug/{heartbeat,apiError,connectionStatus,liveData/*,detected/{nowCompeting,teams}}` — `overlays/team-bug.html`

**Firebase paths read:**
- `competitions/{compId}/config` — `virtiusSessionId`, `gender`, `scoringFeed.pollInterval` (server, team-bug, rotation-slate-auto)
- `competitions/{compId}/config/scoringFeed` — server config listener + `useScoringFeed`
- `competitions/{compId}/config/virtiusSessionId` — panel/badge visibility gate
- `competitions/{compId}/status` — auto-stop on `completed`/`archived`
- `competitions/` (whole tree) — startup scan + `child_changed` listener
- `teamsDatabase/teams/{teamKey}/logo` — logo enrichment, memoised in `_teamLogoCache`
- `teamsDatabase/headshots` — `overlays/team-bug.html:671`
- `competitions/{compId}/scoring/leaderboard/{apparatus}` — `stage/blocks/leaderboard-table.js`
- `competitions/{compId}/currentGraphic` — `stage.html:638`, `output.html:13179`

**Socket events:** `emits:` `scoring:stateChanged`, `scoring:pollCompleted`, `scoring:pollError`, `scoring:started`, `scoring:stopped`, `scoring:autoStopped`, `scoring:startResult`, `scoring:stopResult`, `scoring:refreshResult`, `scoring:error` (all to room `competition:{compId}`) / `listens:` `scoring:start`, `scoring:stop`, `scoring:forceRefresh`, `scoring:getState`, `scoring:resetActivity`. **No client subscribes to or emits any of these** — grep for `scoring:` across `show-controller/src`, `overlays/`, `stage/`, `output.html` returns zero hits. Producer-activity reset is instead piggy-backed on a `socket.use` middleware (`server/index.js:4626-4631`).

**HTTP routes:**
- `GET /api/virtius/:sessionId — CORS proxy for Virtius session JSON` (`server/index.js:4212`; no caller in repo)

**External services:**
- Virtius API `GET https://api.virti.us/session/{sessionId}/json` — the only endpoint used, no auth/API key/headers beyond `Accept: application/json`; 15 s `AbortController` timeout server-side
- `https://media.virti.us/upload/images/{athlete,team}/…` — logo/headshot URLs returned in that payload
- Firebase Realtime Database — transport between server and graphics

**Depends on:**
- Competition model — Firebase `competitions/{compId}/config/{virtiusSessionId,gender,status}` — session ID and gender drive apparatus list and auto-stop
- Teams database — Firebase `teamsDatabase/teams/{teamKey}/logo` — logo override for leaderboard rows
- Coordinator server — direct import in `server/index.js` + Socket.io rooms — process host, lifecycle, broadcast
- Graphics rendering — Firebase `competitions/{compId}/currentGraphic` + `scoring/leaderboard/*` — stage engine is the intended consumer

**Used by:**
- Graphics rendering — Firebase `scoring/leaderboard/{apparatus}` — the 10 `renderer: "stage"` leaderboard graphics (`stage/graphics/leaderboard-*.json`, `combined-aa-leaderboard.json`)
- Producer View (surface) — component `ScoringFeedPanel.jsx` — on/off, interval, last-poll, force refresh
- Home page (surface) — component `ScoringFeedBadge.jsx` — LIVE·{n}s / FEED OFF / FEED ERROR, click to toggle
- Nothing consumes `scoring/teamTotals`, `scoring/rotationState` or `scoring/updatedAt` — grep across `server`, `show-controller/src`, `overlays`, `stage`, `output.html` finds only the writer

**UI surfaces:**
- Producer View → right sidebar → "Scoring Feed" panel — `show-controller/src/components/ScoringFeedPanel.jsx` (rendered `ProducerView.jsx:1290`)
- Producer View → right sidebar → "Score Bug" panel (separate, browser-polled feature) — `show-controller/src/components/ScoreBugPanel.jsx` (`ProducerView.jsx:1287`)
- Home page → competition card badge row — `show-controller/src/components/ScoringFeedBadge.jsx` (`HomePage.jsx:1047`)
- Producer View → Web Graphics → Event Summary R1-R6 / apparatus buttons — `show-controller/src/components/GraphicsControl.jsx:977-1030` (browser-side Virtius path)

**Known gaps:**
- **Schema mismatch kills the payoff:** service writes `leaderboard/{apparatus}` as a bare array (`scoringIngestionService.js:1132`); `leaderboard-table.js:147-151` requires `snapshot.val().rows`. The PRD spec (`docs/PRD-Renderer-System/phase-3/specs/firebase-scoring-paths.md`) defines the `{apparatus, apparatusLabel, gender, rows[]}` envelope that was never implemented. Leaderboard graphics render an empty table.
- `scoring/leaderboard/COMBINED_AA` is referenced by `stage/graphics/combined-aa-leaderboard.json` and `stage/graphics-registry.json` but is never written by any code.
- `ScoringFeedPanel.jsx:26,32` computes `Date.now() - lastPollAt` where `lastPollAt` is an ISO **string** → `NaN`, so "Last Updated" always reads `NaNs ago` in red.
- `initializeScoringIngestion()` is not gated on `COORDINATOR_MODE`, so every OBS VM running `virtius-server` with Firebase Admin creds will start duplicate polling loops writing the same paths (`server/index.js:8726`; `COORDINATOR_MODE` only appears at lines 1416, 3247).
- The `competitions` `child_changed` listener (`server/index.js:8633`) pulls the entire competition subtree on any change to any competition.
- Whole `scoring:*` socket API and `GET /api/virtius/:sessionId` are orphaned — no caller/subscriber.
- `overlays/graphic-ids.json:45` still lists `virtius-leaderboard` with `source: "output.html"`, and `urlBuilder.js:388` / `GraphicsControl.jsx:471` / `QuickActions.jsx:258` still build `output.html?graphic=virtius-leaderboard` — but that renderer and its CSS were deleted from `output.html` (zero matches for `fetchAndRenderLeaderboard` / `.graphic-virtius-leaderboard`). Only the `renderer: "stage"` field saves it.
- Score Bug (a separate, pre-existing feature) has two producer-control wire breaks: `ScoreBugPanel.jsx:125` writes `scoreBug/config/automationMode` while `team-bug.html:1075` listens on `scoreBug/automationMode`; and `ScoreBugPanel.jsx:303,310` reads `scoreBug/status/{lastPoll,error}` while `team-bug.html:1403,1440` writes `scoreBug/{heartbeat,apiError}` (Firebase confirms only the top-level keys exist).
- No unit or integration tests: `server/__tests__/` has no scoring file; phase-3 Task 12 explicitly closes with *"Full end-to-end testing with live Virtius API … should be verified during the next live production test."*
- No stale-data eviction: `_writeToFirebase` only writes non-empty leaderboards, so a prior meet's leaderboard persists under a re-used compId.

**Evidence of live use:**
- **Server-side feed — a real dry run, no live scores:** Firebase `competitions/ecac-2026-audit/config/scoringFeed` = `{lastPollAt: "2026-04-03T16:08:16.474Z", status: "stopped", errorMessage: "Auto-stopped: Producer timeout (30 minutes inactive)", pollInterval: 15}`; `competitions/ecac-2026-audit/scoring/` contains only `rotationState`, `teamTotals`, `updatedAt` (all zeros, six ECAC men's teams) — no `leaderboard` child. It is the only competition of 56 with a `scoring` node.
- **Browser-side Virtius paths — genuinely proven in production:** `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md` names live comp `sewj4d2b` at `https://commentarygraphic.com/sewj4d2b/producer`, and BUG-009/BUG-016 are live-meet fixes to `overlays/team-bug.html` and to the Virtius `rotation`-field event detection in `output.html`.
- `docs/PRD-Graphics-Registry/BUG-002-AA-Leaderboard-Missing-Results.md` (2026-01-24) and `BUG-003-Mens-Tri-Event-Summary-Blank.md` (2026-02-07) are screenshot-backed live-broadcast incidents against the browser-side Virtius parsing.
- Firebase `competitions/{wcgnic-2026-prelim1,sewj4d2b}/scoreBug/connectionStatus.reconnectedAt` = 1774590150751 (2026-03-27) and 1772857010462 (2026-03-07) — the team-bug overlay was actually running against Firebase for WCGNIC 2026 and the 7-team meet.
- Counter-evidence for the new path: `docs/PRD-Renderer-System/phase-6/plan.md:55` — *"Legacy leaderboard URL preview shows placeholder 'Theme Preview — No Virtius Session' … Full side-by-side comparison with live data would require production testing during an active meet."* All phase-6 leaderboard parity screenshots are sample data.

**PRDs / docs:**
- `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md` (§2 Firebase-First Data, §3 Scoring Feed Controls, §Scoring Ingestion Service)
- `docs/PRD-Renderer-System/phase-3/plan.md` (Tasks 1-12, all marked COMPLETE), `phase-3/specs/firebase-scoring-paths.md`, `phase-3/fixes.md` (empty), `phase-3/verification-log.html`, `phase-3/screenshots/`
- `docs/PRD-Renderer-System/phase-6/plan.md`, `docs/PRD-Renderer-System/Phase-6-Verification-Cutover.md` (line 147: *"event-summary uses Virtius directly — this stays until event-summary is migrated"*)
- `docs/PRD-Team-Scores-Bug/PRD-Team-Scores-Bug-2026-01-31.md`, `docs/PRD-Team-Scores-Bug/PLAN-Team-Scores-Bug-2026-01-31.md`
- `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md`, `docs/PRD-Graphics-Registry/BUG-002…md`, `BUG-003…md`, `BUG-004…md`, `BUG-005…md`
- `ROADMAP.md` lines 33-45 (Virtius competition setup, Implemented), 47-70 (Virtius Leaderboard Graphics — describes the now-removed `virti.us/session?s=…&leaderboard=` iframe), 96-118 (Virtius Live Data — still "Planned")
- `docs/GRAPHICS-INVENTORY.md` §Leaderboard Graphics, `DATA-ARCHITECTURE.md` §11 (`GET /session/{sessionId}/json` is the sole Virtius endpoint)

**Extra: which graphic uses which path (server-fed vs browser-fed)**

| Graphic | Renderer | Data path |
|---|---|---|
| `leaderboard-{fx,ph,sr,vt,pb,hb,ub,bb,aa}`, `combined-aa-leaderboard` | `stage.html` | **Server-fed** — Firebase `scoring/leaderboard/{APP}` (currently non-functional, see schema mismatch) |
| `summary-r1…r6`, `summary-{fx,ph,sr,vt,pb,hb,ub,bb}` (event-summary) | `output.html` | **Browser-fed** — `output.html:8675` / `:10849` fetch `api.virti.us/session/{id}/json` directly; uses Virtius `event.rotation` field (`detectEventFromApiData`, line 8607) |
| Team score bug | `overlays/team-bug.html` (standalone OBS source) | **Browser-fed** — line 1365, 5 s poll with exponential backoff to 60 s |
| `rotation-slate-auto` | `overlays/rotation-slate-auto.html` (iframed by output.html) | **Browser-fed** — line 1331, 45 s poll, stops when meet is final |
| `now-competing` | `output.html` | Firebase `scoreBug/detected/nowCompeting` (written by team-bug's browser poll) |
| Competition create/import | SPA | **Browser-fed** — `HomePage.jsx:239`, `DashboardPage.jsx:116` one-shot fetch |

Two additional server-side Virtius pollers exist outside this system and share the same endpoint: `server/lib/playoutEngine.js:1440` (45 s, rotation detection for Clip playout) and `server/lib/aiContextService.js:1414` (10 s cache, live scores for AI context).
