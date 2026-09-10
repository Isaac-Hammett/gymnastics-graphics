# RTN stats

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Competition data
**Purpose:** Pulls each team's season statistics from Road to Nationals (rankings, per-athlete highs/averages, MVP contribution, consistency trend, best-possible lineup) and parks them where the show needs them, so a producer gets team AVG/HIGH/NQS auto-filled into the graphics config and the AI talking-point engine has real numbers to talk about.
**Status:** **Proven** — live Firebase holds 48 real team stat records under `teamsDatabase/stats/*` (e.g. `fisk-womens/meta` = `{status:"complete", rtnId:"156", week:12, year:2026, fetchedAt:"2026-03-27"}`, all 7 endpoints `ok`), and `competitions/wcgnic-2026-prelim1/config` carries RTN-synced `team1Ave 194.023 / team1High 194.950 / team1Con "#49" / team1Nqs 194.065` for the real WCGNIC '26 Session 1 semifinal on March 27 2026, with a 4-team `rtnStats` snapshot written at show start. `docs/PRD-RTN-Stats-Integration/AUDIT-LOG.md` records two week-detection bugs found mid-season and "Deployed: 2026-02-07 via SSH to coordinator VM". Sub-parts at a lower level: **GymACT support (Phase 8) is Partial** — `getResultsPath()` and the `gymact-` cache prefix exist in `server/lib/rtnStatsService.js`, but nothing writes `teamsDatabase/teams/{teamKey}/league`, `RankingsPanel.jsx:40` calls `useLeagueRankings(gender)` with no league option, and live `rtnCache/rankings` contains only NCAA keys. **Composite teams (Phase 9) are Proven-but-headless** — `teamsDatabase/stats/wcgnic-womens/meta` = `{status:"composite", athleteCount:6, sourceTeams:["fisk-womens"]}` and `competitions/wcgnic-2026-prelim1/compositeTeams/team4` exists, but there is no UI that writes it. **Phase 5 (Playwright tests) never landed** — no spec files, empty `docs/PRD-RTN-Stats-Integration/screenshots/`.
**Sport coupling:** **Gymnastics-bound** — event-code translation tables (`WOMENS_MVP_EVENTS`, `MENS_INDIVIDUAL_FIELDS`, olympic-order event numbers), RTN's `/women|/men` URL shape, NCAA "top 5 count per event" team-score math in `syncStatsToConfig`, and RQS/NQS semantics are all hard-coded.
**Key files:**
- `server/lib/rtnStatsService.js` (1746 lines) — fetch/rate-limit/normalize/ingest/composite/sync/snapshot/rankings; the whole server side
- `server/index.js` (8730 lines) — imports the service at :35, socket handlers at :7561–7795, RTN proxy routes at :2436–2530, show-start snapshot at :465
- `show-controller/src/hooks/useRtnStats.js` (263) — Firebase subscription (shared store pre-show, snapshot during show), `refresh()`, exports the shared `buildTeamDbKey`/`parseCompetitionType`
- `show-controller/src/hooks/useLeagueRankings.js` (221) — subscribes `rtnCache/rankings/*`, resolves latest week, temp-socket refresh
- `show-controller/src/components/StatsStatusBadge.jsx` (163) — per-comp status chip + Refresh Stats; only client that honours `config.team{N}Key`
- `show-controller/src/components/StatsDetailPanel.jsx` (651) — Overview/Athletes/Trends/Lineup tabs
- `show-controller/src/components/RankingsPanel.jsx` (270) — team + per-event individual rankings
- `show-controller/src/pages/ControllerPage.jsx` (521) — `_locks` field-lock mechanism, "RTN" auto-fill chip, auto-lock on manual edit
- `show-controller/src/hooks/useCompetitions.js` (:230–270, :425–460) — captures `rtnId` into teamsDatabase, fire-and-forget `ingestRtnStats` on comp create/update
- `server/lib/aiContextService.js` (:2153–2530) — reads the frozen snapshot, emits `rtn-stats`/`rtn-mvp`/`rtn-consistency`/`rtn-topscores`/`rtn-lineup`/`rtn-matchup` talking points
- `show-controller/src/lib/roadToNationals.js` (686) — client RTN lib, now routed through the server proxy
- `output.html` (:7999 `buildStatItemsHtml`, :12384+) — `team{N}-stats` graphic renders AVG/HIGH/NQS from config

**Firebase paths written:**
- `teamsDatabase/stats/{teamKey}/` — `{teamRanking, consistency, mvp, topScores, lineup, individualHighs, individualAverages, meta}` via `update()` (nulls filtered so a partial re-ingest can't wipe good data)
- `teamsDatabase/stats/{teamKey}/meta` — `{status: complete|partial|error|composite, fetchedAt, rtnId, year, gender, week, endpointStatus, errors}`; error-only write when `rtnId` is missing
- `competitions/{compId}/rtnStats/{snapshotTakenAt, team1..teamN}` — `set()` at show start
- `competitions/{compId}/config/team{N}Ave|team{N}High|team{N}Con|team{N}Nqs` — `update()` by `syncStatsToConfig`
- `competitions/{compId}/config/_locks/{fieldName}` — written by ControllerPage
- `rtnCache/rankings/{[gymact-]{gender}-{year}-{week}}/{timestamp, fetchedAt, team[], individual{EVT[]}}`
- `rtnCache/{gender}`, `rtnCache/dashboards/{gender}-{teamId}` — proxy-route caches (24 h)
- `teamsDatabase/teams/{teamKey}/rtnId`, `teamsDatabase/headshots/{name}/rtnId` — RTN ID capture during enrichment

**Firebase paths read:**
- `competitions/{compId}/config` (compType, `team{N}Name`, `team{N}Key`, `_locks`)
- `competitions/{compId}/compositeTeams/team{N}/athletes[{name, sourceTeamKey}]`
- `teamsDatabase/teams/{teamKey}/rtnId`, `teamsDatabase/teams/{teamKey}/league`
- `teamsDatabase/stats/{teamKey}/**` (incl. `meta/fetchedAt` for staleness/dedup)
- `competitions/{compId}/rtnStats` — by `useRtnStats` while the show runs and by `aiContextService._loadRtnStats()`
- `rtnCache/rankings/**`

**Socket events:** `emits:` rtnStatsProgress, rtnStatsResult, leagueRankingsResult / `listens:` ingestRtnStats, refreshRtnStats, fetchLeagueRankings
**HTTP routes:**
- `GET /api/rtn/teams/:gender` — CORS proxy for RTN team list
- `GET /api/rtn/dashboard/:gender/:year/:teamId` — CORS proxy for team dashboard

**External services:**
- Road to Nationals API (`https://www.roadtonationals.com/api`) — 7 per-team endpoints (`results|resultsga`, `teamConsistency`, `mvp`, `topscores`, `lineup`, `rostermain/2`, `rostermain/3`), plus `teams`/`dashboard` for the proxy and per-event `results/{year}/{week}/1/{evt}` for rankings; 200 ms spacing, 10 s timeout, one retry on 5xx

**Depends on:**
- Teams database — Firebase `teamsDatabase/teams/{teamKey}/rtnId|league` — the only source of the RTN team ID; missing `rtnId` is the #1 failure mode
- Competition model — Firebase `competitions/{compId}/config` — team names/keys and compType drive which teams get fetched; also the sync target
- Coordinator server — direct import in `server/index.js:35` + Socket.io rooms `competition:{compId}` — hosting, progress fan-out
- Rundown — direct call from the timesheet engine's `showStarted` handler (`server/index.js:465`) — triggers the freeze snapshot before AI context starts

**Used by:**
- Who to Watch / talking points — Firebase `competitions/{compId}/rtnStats` — `aiContextService` generates matchup, season-high, MVP, consistency, theoretical-max and lineup-rate points
- Rundown (AI segment suggestions) — Firebase `teamsDatabase/stats/{teamKey}` — `aiSuggestionService.loadRtnStatsForTeams()`, top-MVP and closest-event suggestions
- Graphics rendering — Firebase `competitions/{compId}/config` — `team{N}-stats` in `output.html` and `overlays/team-stats.html` (`statLabel`/`statValue`/`high`, `stage/graphics/legacy/team-stats.json` `statType` enum avg|nqs|high)
- Home page (surface) — `StatsStatusBadge`/`StatsDetailPanel`/`RankingsPanel` in `HomePage.jsx:1043-1045`
- Producer View (surface) — `useRtnStats` staleness check auto-fires a background refresh on Start Show (`ProducerView.jsx:172-184`)
- Competition workspace (surface) — `ControllerPage.jsx` RTN chip + lock toggles

**UI surfaces:**
- Home page competition card — status chip, last-fetched, Refresh Stats — `show-controller/src/components/StatsStatusBadge.jsx`
- Home page "View Stats" drawer (Overview/Athletes/Trends/Lineup) — `show-controller/src/components/StatsDetailPanel.jsx`
- Home page "Rankings" drawer (team + per-event) — `show-controller/src/components/RankingsPanel.jsx`
- Competition workspace config form — `LockableInput` with RTN badge and padlock — `show-controller/src/pages/ControllerPage.jsx`
- Producer View start-show panel — "Stats are stale -- will auto-refresh" / "Refreshing stats..." — `show-controller/src/views/ProducerView.jsx`
- URL Generator — per-team AVG/NQS/HIGH stat-type selector — `show-controller/src/pages/UrlGeneratorPage.jsx:1426`
- Media Manager team list — RTN / "No RTN" chip — `show-controller/src/pages/MediaManagerPage.jsx:396`
- Superseded duplicate of the three Home panels — `show-controller/src/pages/DashboardPage.jsx:459-461`

**Known gaps:**
- **Team-key divergence (live data corruption).** `ingestCompetitionStats` (`rtnStatsService.js:1102`) and the `refreshRtnStats` handler honour `config.team{N}Key`, but `syncStatsToConfig` (:1229), `snapshotStatsForCompetition` (:1451), `useRtnStats.js:106`, `StatsDetailPanel.jsx:34` and `ControllerPage.jsx:48` all re-derive the key from the team *name*. Live proof: `teamsDatabase/stats/alaska-womens` and `alaska-anchorage-womens` both exist with `rtnId: "3"`; same duplication for `cal-mens`/`california-mens`, `twu-womens`/`texas-womans-womens`, `william-mary-mens`/`william-&-mary-mens`, `southern-connecticut-womens`/`southern-connecticut-state-womens`.
- **Composite teams have no UI.** `compositeTeams` is read-only server-side; setup is hand-editing Firebase per `CLAUDE.md:1139-1147`. Athlete matching is exact lowercase full-name equality plus source-team equality (`rtnStatsService.js:956`) — misses are only a `console.warn` + `meta.unmatchedAthletes`. Live drift: prelim1 config lists 8 athletes across Centenary/Greenville/Wilberforce, but the stored composite record has `athleteCount: 6, sourceTeams: ["fisk-womens"]`.
- **Composites get no rank/NQS.** `assembleCompositeTeamStats` writes `teamRanking: null`, so `team{N}Con` keeps its placeholder and `team{N}Nqs` stays empty — visible live as `team4Con: "0%"`, `team4Nqs: ""` in `competitions/wcgnic-2026-prelim1/config`.
- **GymACT (Phase 8) is code-only.** No writer for `teamsDatabase/teams/{teamKey}/league` anywhere in `server/` or `show-controller/src/`, and no caller passes `{league:'gymact'}` to `useLeagueRankings`; live `rtnCache/rankings` has only `mens-2026-*`/`womens-2026-*` keys.
- **Locks are team1/team2-only in the UI.** `ControllerPage.jsx:9` `LOCKABLE_FIELDS` covers Ave/High/Con/Coaches for two teams; `syncStatsToConfig` honours locks for all teams and for `team{N}Nqs`, which has no toggle. No live competition has a `_locks` node.
- **No automated tests.** `server/__tests__/` has none for `rtnStatsService`; PRD Phase 5 (tasks 22-24, Playwright) produced no spec files and `docs/PRD-RTN-Stats-Integration/screenshots/` is empty.
- **Rankings refresh is manual.** `fetchLeagueRankings` is only reachable from the `RankingsPanel` button; no scheduler, and cached weeks stop at week 12.
- **Dead exports.** `fetchConsistency`, `fetchMVP`, `fetchTopScores`, `fetchLineup`, `fetchIndividualHighs`, `fetchIndividualAverages`, `fetchTeamRanking` are exported but never called outside the module (the live path is `buildTeamStatUrls` + `rateLimitedFetch`); `checkStaleness` is imported into `server/index.js:35` and unused.
- **`parseScore` maps `0`/`"0.0000"` to null by design** (`rtnStatsService.js:359`), so a genuine 0.000 is dropped — documented, accepted (BUG-025).
- **`docs/PRD-RTN-Stats-Integration/BUGS.md` is stale**: its table lists BUG-022…038 as OPEN, but the fixes are in the code (`&` preserved in `buildTeamDbKey`, `'7': 7` in `typeMap`, `update()` instead of `set()`, error-meta write, unranked fallback, BUG-037 re-snapshot, RTN CORS proxy) per commits "PRD-RTN-Stats: … (Task 27–45)".
- **Career-high alerts are not RTN-backed**: `aiContextService.checkCareerHigh` reads `athleteStats/{key}/careerBests`, a separate store it writes itself; RTN `individualHighs` only feed season-high/matchup talking points.

**Evidence of live use:**
- `competitions/wcgnic-2026-prelim1/config` (Firebase) — WCGNIC '26 Session 1, March 27 2026, Ave/High/Con/NQS populated for SEMO, Bridgeport, Alaska; `team4Key: "wcgnic-womens"`
- `teamsDatabase/stats/wcgnic-womens/meta` (Firebase) — `status: "composite"`, `fetchedAt: 2026-03-27T22:53Z`
- `competitions/wcgnic-2026-prelim1/rtnStats` (Firebase) — snapshot with `team1..team4`
- `docs/PRD-RTN-Stats-Integration/AUDIT-LOG.md` — two week-detection failures found against real February 2026 data, fixes deployed via SSH to the coordinator VM
- `docs/PRD-RTN-Stats-Integration/BUGS.md` — BUG-022 written up from a real competition (`51aq2rkn`, William & Mary showing "Stats error")
- `CLAUDE.md:1155-1160` — WCGNIC 2026 Session 1 composite-team runbook

**PRDs / docs:**
- `docs/PRD-RTN-Stats-Integration/PRD-RTN-Stats-Integration-2026-02-01.md` (438 lines; phase table 1–8, GymACT at :205/:309; no Phase 9 section despite CLAUDE.md pointing at one)
- `docs/PRD-RTN-Stats-Integration/BUGS.md` (846)
- `docs/PRD-RTN-Stats-Integration/AUDIT-LOG.md` (286)
- `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-2026-02-01.md`, `PLAN-RTN-Stats-Integration-Implementation.md`, `tests/audit-A..G-*.md`
- `CLAUDE.md` — "Composite Teams" (:1113-1160), `league` field (:1041)
- `DATA-ARCHITECTURE.md` §2 and §5 — documents the older `teamData` enrichment path, not the `teamsDatabase/stats` store this service writes
- `Road to Nationals.postman_collection.json` — RTN surface for teams/rosters/meets/schedule/dashboard; does **not** cover the 7 stat endpoints used here
