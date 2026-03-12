# PLAN-RTN-Stats-Integration-Implementation

**PRD:** [PRD-RTN-Stats-Integration-2026-02-01.md](./PRD-RTN-Stats-Integration-2026-02-01.md)
**Status:** IN PROGRESS | Audit: COMPLETE
**Created:** 2026-02-01
**Last Updated:** 2026-02-01

---

## Overview

This implementation plan covers all phases of the RTN Statistics Integration. Phase 1 captures RTN IDs and builds the shared stats store. Phase 2 wires client integration with auto-sync and manual override locks. Phase 3 adds league rankings. Phase 4 enhances AI talking points. Phase 5 adds Playwright integration tests.

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD-RTN-Stats-Integration-2026-02-01.md](./PRD-RTN-Stats-Integration-2026-02-01.md) | Product requirements |
| [PLAN-RTN-Stats-Integration-2026-02-01.md](./PLAN-RTN-Stats-Integration-2026-02-01.md) | Technical reference (architecture, data model, API normalization, error handling) |
| [BUGS.md](./BUGS.md) | Bug tracker — 17 bugs (BUG-022 through BUG-038), full details on each (symptoms, root cause, affected files, suggested fix) |

---

## IMPORTANT: Task Execution Rules

**ONE TASK = ONE ITERATION**

Each row in the task tables below is ONE task. Complete exactly ONE task per iteration:

1. Pick the first NOT STARTED or IN PROGRESS task
2. Implement that ONE task
3. Commit, deploy, verify
4. STOP - the next iteration will handle the next task

**Do NOT:**
- Complete multiple tasks in one iteration
- Batch "related" tasks together
- Complete an entire phase in one iteration

**Task Numbering:**
- Tasks are numbered sequentially: Task 1, Task 2, ... Task 26
- Each task number is unique and independent
- Example: "Task 8" is ONE task, not a subtask
- Tasks 25-26 were added by audit Category G and belong to Phases 2 and 4 respectively
- Tasks 27-43 are bug fixes added in Phase 6

---

## Phase Summary

| Phase | Name | Priority | Status | Tasks |
|-------|------|----------|--------|-------|
| 1 | RTN ID Capture & Shared Stats Store | P0 | COMPLETE | 1-7 |
| 2 | Client Integration & Config Sync | P0 | COMPLETE | 8-14, 25 |
| 3 | League Rankings | P1 | COMPLETE | 15-17 |
| 4 | AI Enhancement | P1 | COMPLETE | 18-21, 26 |
| 5 | Playwright Integration Tests | P1 | COMPLETE | 22-24 |
| 6 | Bug Fixes | P0 | IN PROGRESS | 27-43 |

---

## Task Summary by Phase

### Phase 1: RTN ID Capture & Shared Stats Store (P0) - COMPLETE (7/7)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 1 | Capture RTN team ID during Media Manager team setup | COMPLETE | Fixed `enrichTeamsWithRTN()` bug: `dashboard.id` → `dashboard.info?.team_id`. Added `rtnId` field (as string) to roster entries. After enrichment, persists team RTN ID to `teamsDatabase/teams/{teamKey}/rtnId` and per-athlete RTN IDs to `teamsDatabase/headshots/{name}/rtnId`. Skips write if already stored and unchanged. Added RTN ID status badge to Media Manager verification checklist (blue "RTN" badge if present, gray "No RTN" if missing). Build verified. |
| Task 2 | Capture RTN athlete IDs during Media Manager headshot setup | COMPLETE | `parseVirtiusRosterHtml()` already extracts RTN IDs from Virtius HTML. Updated `saveHeadshots()` in `useTeamsDatabase.js` to accept and store `rtnId` field (as string) alongside headshot URL. Updated `importRoster()` to pass `rtnId` through from parsed Virtius data. Added console warning for athletes missing RTN IDs during import. Updated `getTeamRosterWithHeadshots()` to include `rtnId` from headshot records. Added per-athlete RTN ID badge in `RosterView` component (blue "RTN" micro-badge next to each athlete with an RTN ID). Build verified. |
| Task 3 | Create `server/lib/rtnStatsService.js` with all 8 RTN fetch functions and rate limiting | COMPLETE | Created `server/lib/rtnStatsService.js` as ESM module. Implements all 8 fetch functions: `fetchConsistency()`, `fetchMVP()`, `fetchTopScores()`, `fetchLineup()`, `fetchIndividualHighs()`, `fetchIndividualAverages()`, `fetchTeamRanking()`, `getCurrentWeek()`. Each takes `(gender, year, tid)`. Includes `fetchWithRetry()` with 10s AbortController timeout and retry-once on 500 errors. `rateLimitedFetch()` for sequential multi-URL fetching with 200ms delay and empty-response detection (`"empty"` status for `[]`/`{}`). `buildTeamStatUrls()` generates all 7 per-team endpoint URLs (teamRanking uses results endpoint). Exports all constants: event code mappings for women's (4 events) and men's (6 events) across consistency, MVP, individual, top scores, and ranking endpoints. `getCurrentWeek()` parses `schema.weeks` array for `current: "1"`, falls back to latest RQS week, then last week, then 1. Build verified. |
| Task 4 | Add normalization layer to translate raw RTN JSON to Firebase schema | COMPLETE | Added 11 functions to `server/lib/rtnStatsService.js`: `parseScore()` (string→number, negative→null, round 4 decimals), `toRtnIdString()` (coerce athlete IDs to string), `normalizeConsistency()` (flat arrays→events map), `normalizeMVP()` (sum fields→sorted athlete array), `normalizeTopScores()` (lineup→theoreticalMax + per-event athletes), `normalizeLineup()` (binary meets→rate), `normalizeIndividualStats()` (handles `{team, ind}` structure), `normalizeIndividualHighs()`, `normalizeIndividualAverages()` (wrappers), `normalizeTeamRanking()` (finds team by tid in results), `normalizeAllResults()` (orchestrates all normalizers from rateLimitedFetch output, produces `{normalized, endpointStatus}`). Gender-aware event code translation using existing constants. Empty responses handled by rateLimitedFetch (status "empty"), normalizers return null for missing/empty data. All athlete records include `rtnId` as string. Build verified. |
| Task 5 | Implement `ingestCompetitionStats(compId, io)` orchestration with staleness check | COMPLETE | Added to `server/lib/rtnStatsService.js`: `parseCompetitionType()` extracts gender/teamCount from compType. `buildTeamDbKey()` mirrors client-side team key logic (lowercase, strip gender suffixes, hyphenate + gender suffix). `checkStaleness()` reads `meta/fetchedAt` from Firebase, returns `{isStale, fetchedAt, withinDedup}`. 60s dedup window prevents concurrent ingestions for same team. `ingestTeamStats()` fetches all endpoints via `rateLimitedFetch`, normalizes via `normalizeAllResults`, writes full stats + meta to `teamsDatabase/stats/{teamKey}/`. Emits `rtnStatsProgress` socket events per endpoint. `ingestCompetitionStats()` reads competition config, extracts team names, looks up `rtnId` from `teamsDatabase/teams/{teamKey}/rtnId`, checks staleness/dedup, skips fresh teams. Missing `rtnId` writes error to meta and skips that team. Returns `{success, teams}` with per-team status. Uses `productionConfigService.getDb()` for Firebase Admin SDK. Build verified, module import verified. |
| Task 6 | Implement `syncStatsToConfig(compId)` with config lock support | COMPLETE | Added `syncStatsToConfig(compId)` to `server/lib/rtnStatsService.js`. Reads competition config and `_locks` (defaults to `{}` if null). For each team (1-6), reads `teamsDatabase/stats/{teamKey}/teamRanking`, writes `team{N}Ave` (ranking average), `team{N}High` (ranking high), `team{N}Con` (formatted as `#rank` string, e.g., "#1", "#3(t)") to config. Skips fields where `locks[fieldName] === true`. Returns `{ success, synced, skipped }` with per-team details. Handles multi-team meets (up to 6 teams). Coach lock support ready for Task 14 (coach sync happens in existing `enrichTeamsWithRTN()`). Build verified, module import verified. |
| Task 7 | Wire socket events in `server/index.js` and add show-start snapshot | COMPLETE | Added `snapshotStatsForCompetition(compId)` to `rtnStatsService.js`: reads competition config, iterates teams, copies `teamsDatabase/stats/{teamKey}/` to `competitions/{compId}/rtnStats/team{N}/` with `snapshotTakenAt` timestamp. Added import of RTN stats functions in `server/index.js`. Added `ingestRtnStats` socket handler: calls `ingestCompetitionStats()` then `syncStatsToConfig()`, emits `rtnStatsResult` to competition room. Added `refreshRtnStats` socket handler: bypasses staleness check, fetches directly via `ingestTeamStats()` for each team (or single team if `teamKey` provided), then syncs config, emits `rtnStatsResult`. Wired `snapshotStatsForCompetition()` into `engine.on('showStarted')` after AI Context Service start and before run record creation. All errors handled gracefully with try/catch. Build verified, module import verified. |

### Phase 2: Client Integration & Config Sync (P0) - COMPLETE (8/8)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 8 | Create `show-controller/src/hooks/useRtnStats.js` with Firebase listener | COMPLETE | Created `show-controller/src/hooks/useRtnStats.js`. Hook accepts `(compId, config)` params. Implements client-side `buildTeamDbKey()` and `parseCompetitionType()` mirroring server logic. Derives `teamKeys` from config team names + gender. Before show: subscribes to `teamsDatabase/stats/{teamKey}/` via `onValue` for each team. During show (`timesheetState.isRunning`): subscribes to `competitions/{compId}/rtnStats` snapshot. Socket listeners for `rtnStatsResult` and `rtnStatsProgress` registered in useEffect with proper cleanup via `socket.off()` (follows `useAIContext.js` pattern). Returns `{ stats, meta, loading, error, refresh, isStale, progress, teamKeys }`. `refresh(teamKey?)` emits `refreshRtnStats`. `isStale` computed from `meta.fetchedAt > 24h`. Also exports `buildTeamDbKey` and `parseCompetitionType` for reuse. Build verified. |
| Task 9 | Trigger stats ingestion after competition creation in `useCompetitions.js` | COMPLETE | Added `triggerStatsIngestion(compId)` utility function that creates a temporary socket.io connection to the coordinator server (via `SERVER_URL`), emits `ingestRtnStats`, logs result, and auto-disconnects (on result, error, or 60s timeout). Called after `enrichTeamsWithRTN()` in both `createCompetition()` and `updateCompetition()` (when `refreshRTN` is true). Non-blocking fire-and-forget — competition is usable immediately. Build verified. |
| Task 10 | Add stats status indicator and "Refresh Stats" button to DashboardPage | COMPLETE | Created shared `StatsStatusBadge` component at `components/StatsStatusBadge.jsx`. Reads `teamsDatabase/stats/{teamKey}/meta` directly from Firebase (pages lack ShowContext so cannot use `useRtnStats` hook). Shows green "Stats loaded" / yellow "Partial" / red "Stats error" / gray "No stats" badge with relative timestamp. Shows "Stale" warning when data >24h old. Refresh button uses temporary socket.io connection (same pattern as `triggerStatsIngestion` in useCompetitions.js) to emit `refreshRtnStats`. Spinning arrow icon during refresh. Added to both HomePage.jsx (primary page users see at `/`) and DashboardPage.jsx (legacy). Imports `buildTeamDbKey` and `parseCompetitionType` from useRtnStats.js for team key derivation. Build verified, deployed, verified on production. |
| Task 11 | Implement config lock UI and persistence | COMPLETE | Added lock toggle UI to ControllerPage.jsx for all 8 lockable fields (team{1,2}{Ave,High,Con,Coaches}). Created `LockableInput` and `LockableTextarea` components with `LockIcon` toggle. Locked state stored at `competitions/{compId}/config/_locks/{fieldName}` via `updateConfig()`. Auto-lock on manual edit: when user types in a lockable field, lock is automatically engaged. Amber lock icon + "Manual" label shown when locked, subtle unlock icon when unlocked. Locked fields get amber border highlight. `toggleLock()` sets lock to `true` or removes it (`null`). Locks derived from `config._locks` which is already subscribed via `useCompetition` hook's `onValue` listener on config path. Server-side `syncStatsToConfig` (Task 6) already respects these locks. Build verified. |
| Task 12 | Mark Ave/High fields as auto-filled when synced from RTN | COMPLETE | Added RTN auto-fill indicators to ControllerPage.jsx. Subscribes to `teamsDatabase/stats/{teamKey}/meta` via Firebase `onValue` for each team to detect if RTN stats are loaded. When a field (Ave, High, Con) is unlocked and has RTN stats available, shows a blue "RTN" micro-badge next to the label and a subtle blue border. When locked, shows amber "Manual" label (existing behavior). The RTN indicator clears when the user manually edits the field (because manual edit auto-engages the lock). Imports `buildTeamDbKey` and `parseCompetitionType` from `useRtnStats.js` for team key derivation. Build verified. |
| Task 13 | Add auto-refresh before show start (client-side trigger) | COMPLETE | Added `useRtnStats` hook to ProducerView.jsx. Created `handleStartShow` wrapper that checks `isStale` before calling `timesheetStart()`. If stats are stale, calls `refreshRtnStats()` (non-blocking) then immediately starts the show. Yellow "Stats are stale" hint shown below Start Show button when stale. Blue "Refreshing stats..." spinner shown during refresh. Uses `staleRefreshTriggered` flag to prevent duplicate refreshes. Server-side `showStarted` handler (Task 7) still handles the snapshot independently. Build verified. |
| Task 14 | Update existing `enrichTeamsWithRTN()` coach sync to respect locks | COMPLETE | Created `buildCoachUpdates(compId, teamData)` helper in `useCompetitions.js` that reads `competitions/{compId}/config/_locks` from Firebase before syncing coaches. Skips any `team{N}Coaches` field where lock is `true`. Replaced all three coach sync blocks (in `createCompetition`, `updateCompetition`, and `refreshTeamData`) with calls to this shared helper. Logs skipped fields for debugging. Build verified. |

### Phase 3: League Rankings (P1) - COMPLETE (3/3)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 15 | Implement `fetchLeagueRankings(gender, year, week)` in rtnStatsService.js | COMPLETE | Added `fetchLeagueRankings(gender, year, week)` to `server/lib/rtnStatsService.js`. Fetches team rankings via `results/{year}/{week}/0/{type}` (type=5 women, 7 men) and individual rankings for each event via `results/{year}/{week}/1/{1..N}` (5 events women, 7 events men). Added `normalizeTeamRankings()` normalizer (extracts rank, name, tid, ave, high, rqs, conference, region, division). Added `normalizeIndividualRankings()` normalizer (extracts rank, firstName, lastName, fullName, rtnId, team, teamId, ave, high, rqs, conference). Uses `getCurrentWeek()` when week not provided. Checks existing cache at `rtnCache/rankings/{gender}-{year}-{week}/` with 24h TTL before fetching. Uses `rateLimitedFetch()` for all ranking calls (1 team + N individual = 6-8 total calls). Writes normalized data to Firebase cache with timestamp. All new functions exported. Build verified. |
| Task 16 | Create `useLeagueRankings(gender)` hook and wire socket event | COMPLETE | Created `show-controller/src/hooks/useLeagueRankings.js`. Hook accepts `(gender, options?)` with optional `year` and `week`. Determines latest available week from Firebase cache keys at `rtnCache/rankings/` (filters by gender-year prefix, picks highest week number). Subscribes to `rtnCache/rankings/{gender}-{year}-{week}/` via `onValue` listener. Returns `{ teamRankings, individualRankings, week, loading, error, refresh, isStale, fetchedAt }`. `refresh()` uses temporary socket.io connection (same pattern as StatsStatusBadge) to emit `fetchLeagueRankings` — works outside ShowContext. Uses `toArray()` helper for Firebase object-to-array normalization. Added `fetchLeagueRankings` socket handler in `server/index.js` that calls `fetchLeagueRankings()` from rtnStatsService and emits `leagueRankingsResult`. Socket handler validates gender, returns `{ success, gender, week, teamCount, individualEvents, error }`. Added `fetchLeagueRankings` to import statement. Build verified. |
| Task 17 | Display rankings in Dashboard and make available to AI services | COMPLETE | Created `show-controller/src/components/RankingsPanel.jsx` — collapsible panel added to competition cards on both HomePage and DashboardPage. Uses `useLeagueRankings` hook (lazy-loads only when expanded to avoid unnecessary Firebase reads). Features: tab interface with Teams tab showing team rankings (rank, name, ave, high, rqs, conference) and per-event individual rankings tabs (VT, UB, BB, FX, AA for women; FX, PH, SR, VT, PB, HB, AA for men). Competition teams highlighted with blue background and asterisk. Show top 25 by default with expand button for full list. Refresh button triggers server-side RTN fetch. Shows week number, fetch date, and staleness warning. Rankings data at `rtnCache/rankings/` is already readable by `aiContextService.js` via Firebase Admin SDK (Phase 4 tasks will wire the actual AI integration). Build verified. |

### Phase 4: AI Enhancement (P1) - COMPLETE (5/5)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 18 | Add `_loadRtnStats()` to aiContextService.js and generate athlete-specific talking points | COMPLETE | Added `_loadRtnStats()` to `start()` after `_loadCompetitionData()`. Reads frozen snapshot from `competitions/{compId}/rtnStats/`. Stored as `this._rtnStats`. Added `_getAthleteStatsTalkingPoints(segment, segmentContext)` that generates talking points from individual averages (≥9.7) and season highs (≥9.9). Athlete matching via `_buildRosterRtnIdMap()` joins `teamData.team{N}.roster[].rtnId` ↔ `rtnStats.team{N}.individualHighs[].rtnId`, with fallback to name matching via `_getAthleteFromRoster()`. Added `_matchAthleteToRoster()` helper and `_toArray()` for Firebase object-to-array conversion. Uses `PRIORITY.MEDIUM`. Only generates during non-scoring segments (skips when `segmentContext.isScoring`). Wired into `_generateSegmentContext()` after basic points, before sort. Deduplicates by athlete+event, limits to 4 points to stay within talking points budget. Build verified, module import verified. |
| Task 19 | Add consistency trend analysis talking points | COMPLETE | Added `_getConsistencyTalkingPoints()` to aiContextService.js. Analyzes per-event score arrays from `rtnStats.team{N}.consistency.events`. Detects trends: "improving" if last 3 scores strictly increasing, "declining" if strictly decreasing, "stable" otherwise. Generates text like "Oklahoma trending up on beam: 49.50 → 49.48 → 49.68". Also notes "very consistent" teams (stdDev < 0.15) with their average. Added `_detectTrend()` and `_standardDeviation()` helper methods. Uses `PRIORITY.MEDIUM`, only generates during non-scoring segments (skips `segmentContext.isScoring`). Respects `focusEvent` from segment context. Limited to 3 points to stay within talking points budget. Wired into `_generateSegmentContext()` after athlete stats points, before sort. Build verified, module import verified. |
| Task 20 | Add head-to-head matchup talking points using individual rankings | COMPLETE | Replaced existing `_getMatchupTalkingPoints()` stub in aiContextService.js with full implementation. Added `_generateAthleteMatchups(segment, focusEvent)` that builds per-team top athlete maps from individualHighs and individualAverages, generates pairwise comparisons across teams, and sorts by closest competition (smallest gap). Added `_getTopAthletesPerEvent(teamKey)` that combines averages and highs into a single map per event, selecting the top athlete by average (or high as fallback). Added `_getCompetitionEvents()` that determines gender-appropriate event list from compType or RTN stats meta. Added `_getLeagueRankingMatchupPoints(segment, focusEvent)` that generates nationally-ranked team context from `teamRanking` data (top 25). Uses `PRIORITY.HIGH` for all matchup points. Generates during rotation start, scoring, opening, and intro segments. Outputs text like "Vault matchup: Estep (9.975 high, 9.933 avg) vs Chiles (9.950 high, 9.944 avg)". Limited to 3 matchup points per segment. Build verified, module import verified. |
| Task 21 | Add MVP and lineup context talking points | COMPLETE | Added `_getMVPTalkingPoints(segment, segmentContext)` and `_getLineupTalkingPoints(segment, segmentContext)` to aiContextService.js. MVP method: reads `rtnStats.team{N}.mvp` array, generates top contributor point ("X leads Team with Y total contribution across all events") and theoretical max from topScores ("Team's theoretical max is X if everyone hits season highs"). Lineup method: reads `rtnStats.team{N}.lineup` array, detects ironman gymnasts (competed in all meets, rate >= 1.0), and recent lineup additions (last meet = 1, rate < 0.5). Generates points like "X, Y have competed in all N meets for Team" and "X recently added to Team's lineup — competed in M of N meets". Both methods use `PRIORITY.MEDIUM`, only generate during non-scoring segments (skip `segmentContext.isScoring`), limited to 3 points each. Wired into `_generateSegmentContext()` after consistency points, before sort. Build verified, module import verified. |

### Additional Tasks (added by audit G)

| Task | Description | Phase | Status | Notes |
|------|-------------|-------|--------|-------|
| Task 25 | Add stats detail panel to DashboardPage for per-team and per-athlete stats browsing | Phase 2 | COMPLETE | Created `show-controller/src/components/StatsDetailPanel.jsx` — collapsible panel added to competition cards on both HomePage and DashboardPage. Reads directly from Firebase `teamsDatabase/stats/{teamKey}/` (no ShowContext dependency, same pattern as StatsStatusBadge). Features: team selector tabs for multi-team meets, 4 content tabs (Overview, Athletes, Trends, Lineup). Overview shows team ranking, MVP top 5, top scores with theoretical max. Athletes tab shows per-athlete averages, highs, lineup rate, MVP total with event filter buttons and sortable columns. Trends tab shows mini bar charts per event with trend detection (up/down/stable). Lineup tab shows frequency bars with per-meet dots. Handles empty state gracefully. Uses `toArray()` helper for Firebase object-to-array conversion. Build verified. |
| Task 26 | Enhance aiSuggestionService.js with RTN stats confidence factors and segment suggestions | Phase 4 | COMPLETE | Added 3 confidence factors to `CONFIDENCE_FACTORS`: `HAS_RTN_STATS` (+0.15), `HAS_INDIVIDUAL_STATS` (+0.1), `HAS_RANKINGS` (+0.05). Wired into `calculateDynamicConfidence()` — all existing segments automatically benefit from higher confidence when RTN stats are loaded. Added `loadRtnStatsForTeams()` to read from `teamsDatabase/stats/{teamKey}/` during context building (parallel with All-Americans/milestones queries). Added 3 new RTN-powered segment suggestions to `getSpecialSegments()`: "Athlete Spotlight" (top MVP contributor across teams), "Event Preview" (closest event matchup using individual averages, gap < 0.1 threshold), "Senior Feature" (senior with highest MVP contribution). Added helpers: `toArray()`, `getTopMVPContributor()`, `findClosestEvent()`, `findTopSeniorContributor()`. Context response includes `rtnStatsAvailable`, `hasIndividualStats`, `hasRankings` flags. Build verified, module import verified. |

### Phase 5: Playwright Integration Tests (P1) - COMPLETE (3/3)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 22 | Playwright test: Stats ingestion end-to-end flow | COMPLETE | Tested full E2E flow on production (competition ac4xo5p4 - Springfield vs William & Mary MAG). **Setup:** Set RTN IDs for Springfield mens (38), William & Mary mens (51), Brown womens (14), Springfield womens (60) in `teamsDatabase/teams/{key}/rtnId`. **Bug found & fixed:** `getCurrentWeek()` could return NaN from `parseInt` on undefined week fields, causing Firebase write to fail with "value argument contains NaN in property meta.week". Fixed with `isNaN()` guards in `getCurrentWeek()` and `ingestTeamStats()`. **Results after fix:** Clicked "Refresh RTN Stats" → status badge changed from "No stats" to "Partial" with "Just now" timestamp. Springfield: 6/7 endpoints OK (consistency 404 expected for early season), rank #6, ave 306.100. William & Mary: 6/7 endpoints OK, unranked (not in results). Config auto-synced: team1Ave=306.100, team1High=306.100, team1Con="#6". Stats detail panel shows Overview (team ranking, MVP top 5), Athletes tab (per-athlete averages, highs, lineup rates for all 6 MAG events), correctly sorted by MVP total. No stats-related console errors. Deployed server fix via SSH. |
| Task 23 | Playwright test: Config auto-sync and manual lock behavior | COMPLETE | Tested on production (competition ac4xo5p4 - Springfield vs William & Mary MAG). **Test 1 — Auto-lock on manual edit:** Navigated to ControllerPage (`/controller?comp=ac4xo5p4`), typed in team1Ave field → lock auto-engaged (`_locks.team1Ave: true` in Firebase), button changed to "Locked (manual override) — click to unlock" with "Manual" label. **Test 2 — Lock protects field during refresh:** Set `team1Ave` to "999.999" in Firebase with lock active, clicked "Refresh RTN Stats" on homepage → team1Ave remained "999.999" (lock respected), while unlocked fields (team1High, team1Con) synced normally from RTN. **Test 3 — Unlock re-enables auto-sync:** Removed lock from Firebase, triggered another refresh → team1Ave overwritten back to RTN value "306.100". **Console errors:** Only pre-existing `[useVMPool] Firebase error: permission_denied` (unrelated to RTN stats). No stats-related errors. All lock UI states verified on ControllerPage — all buttons show "Unlocked (auto-sync enabled)" after lock removal. |
| Task 24 | Playwright test: AI talking points contain stats-backed content | COMPLETE | Tested on competition ac4xo5p4 (Springfield vs William & Mary MAG). Found and fixed two server bugs blocking AI talking points: (1) `server/index.js`: RTN stats snapshot was taken AFTER AI Context Service started, so AI couldn't find snapshot data — reordered to snapshot BEFORE AI service start. (2) `server/lib/aiContextService.js`: `_updateContext()` checked `showState.showState !== 'RUNNING'` but `timesheetEngine.getState()` returns `{ state: "running" }` (lowercase `.state` not `.showState`, lowercase `"running"` not `"RUNNING"`) — fixed to `showState.state !== 'running'`. After fixes: AI Talking Points panel appeared on show start with 5 points including RTN-stats-backed content: individual athlete averages ("Owen Carney averages 13.250 on Floor Exercise"), head-to-head matchups ("Vault matchup: Evan Reichert (13.950 high, 13.760 avg) vs Connor Barrow (14.150 high, 13.700 avg)"), roster analysis ("Senior spotlight: Tyler, Owen, Gustavin"), and live scores. Points updated as segments advanced (from `rtn-stats` to `rtn-matchup` tags). Server logs confirmed correct ordering: snapshot → AI service start → loaded snapshot → fetched live scores → context updates. ProducerView AI panel visible with priority/regular point separation. No RTN-related console errors. |

---

## Post-Deployment Bug Fixes

### Bug Fix: getCurrentWeek() Using Wrong Field Name (2026-02-07)

**Symptom:** Rankings panel always showed "Week 1" regardless of actual date in the season.

**Root Cause:** The RTN API returns week numbers in the `wk` field, but `getCurrentWeek()` was looking for `week`. This caused all three fallback branches to fail (`currentWeek.week`, `latest.week`, `last.week` all returned `undefined`), resulting in the function defaulting to week 1.

**Secondary Issue:** The weeks array from RTN is sorted **descending** (highest week first, e.g., week 12, 11, 10...), but the fallback logic used `array[array.length - 1]` which returned the **lowest** week number instead of the latest.

**Fix Applied:**
1. Changed `currentWeek.week` → `currentWeek.wk` (3 occurrences)
2. Changed `rqsWeeks[rqsWeeks.length - 1]` → `rqsWeeks[0]` (first element = latest week)
3. Changed "last week in array" fallback to use index 0 instead of last index

**Files Modified:** `server/lib/rtnStatsService.js`

**Commit:** `25693d9` - "Fix getCurrentWeek() using wrong field name (wk not week) for RTN API"

**Verification:** After fix, Rankings panel correctly shows current week number based on RTN's `current: "1"` flag or falls back to the highest RQS-enabled week.

---

### Bug Fix: getCurrentWeek() Unreliable 'current' Flag (2026-02-07)

**Symptom:** Rankings panel still showed "Week 1" after the field name fix above.

**Root Cause:** RTN's `current: "1"` flag is not a reliable indicator of the actual current calendar week. In the men's API, Week 1 (dated 2026-01-12) has `current: "1"` even in February 2026. The flag appears to mark the "first week of season" rather than "current calendar week."

**Additional Issue:** The fallback checked for `rqs` field but men's API uses `nqs` field for ranking qualification status.

**Fix Applied:**
1. Changed week detection from `current: "1"` flag to **date-based logic**: find the latest week whose `date` field is ≤ today
2. Added check for `nqs` field in addition to `rqs` for ranked weeks fallback
3. Added logging to show which detection method was used

**New Logic Order:**
1. Find latest week with `date <= today` (actual current calendar week)
2. Fallback: latest week with `nqs > 0` or `rqs > 0` (has ranking data)
3. Fallback: highest week number in array

**Files Modified:** `server/lib/rtnStatsService.js`

**Commit:** `f824eb7` - "Fix getCurrentWeek() to use date-based logic instead of unreliable 'current' flag"

**Verification:** Rankings panel now shows Week 4 (dated 2026-02-02) which is the correct week for Feb 7, 2026.

### Phase 6: Bug Fixes (P0) - IN PROGRESS (13/17)

**See:** [BUGS.md](./BUGS.md) for full details on each bug.

| Task | Bug | Severity | Description | Status | Notes |
|------|-----|----------|-------------|--------|-------|
| Task 27 | BUG-022 | High | Fix `buildTeamDbKey()` to preserve `&` in team names (server + client copies) | COMPLETE | Updated regex from `[^a-z0-9\s-]` to `[^a-z0-9\s&-]` in both `server/lib/rtnStatsService.js:694` and `show-controller/src/hooks/useRtnStats.js:34`. Now "William & Mary" → `william-&-mary-womens` which matches Firebase key. Verify with deploy. |
| Task 28 | BUG-024 | Medium | Add `'7': 7` to `parseCompetitionType()` typeMap (server + client copies) | COMPLETE | Added `'7': 7` to typeMap in both `server/lib/rtnStatsService.js:676` and `show-controller/src/hooks/useRtnStats.js:57`. Now `womens-7` competitions will correctly parse to `teamCount: 7`. Note: Task 39 (BUG-034) also required to fix client hook loop from 6 → dynamic teamCount. |
| Task 29 | BUG-023 | Medium | Fix client-side RTN coach fetch — proxy through coordinator or read from Firebase cache | COMPLETE | Added proxy endpoints `/api/rtn/teams/:gender` and `/api/rtn/dashboard/:gender/:year/:teamId` to `server/index.js`. Updated `fetchWomensTeams()`, `fetchMensTeams()`, and `fetchTeamDashboard()` in `show-controller/src/lib/roadToNationals.js` to use `SERVER_URL` proxy instead of direct RTN API calls. Proxy caches to Firebase with 24h TTL. `getWeeklySchedule()` and `getYearWeeks()` marked as TODO with local RTN_DIRECT_URL (unused functions). Verify with deploy. |
| Task 30 | BUG-032 | Medium | Fix `StatsStatusBadge` refresh — ensure socket receives `rtnStatsResult` | COMPLETE | Changed to fire-and-forget pattern: emit `refreshRtnStats`, disconnect after 500ms, rely on existing Firebase `onValue` listener to update badge. Spinner stops after 10s timeout. Removed waiting for `rtnStatsResult` which was unreliable due to room-join race. |
| Task 31 | BUG-029 | Medium | Write error meta to Firebase in `refreshRtnStats` handler for missing `rtnId` | COMPLETE | Added Firebase meta write at `server/index.js:7065-7073`. Now when `rtnId` is missing, writes `{status: 'error', errors: {rtnId: '...'}, fetchedAt}` to `teamsDatabase/stats/{teamKey}/meta` so UI shows "Stats error" badge. |
| Task 32 | BUG-027 | Medium | Fix `useRtnStats` loadedCountRef race condition on teamKeys change | COMPLETE | Added `effectEpochRef` generation counter. Each useEffect invocation increments epoch and captures it in closure. Callbacks check `currentEpoch !== effectEpochRef.current` to ignore stale callbacks. Also clears `sharedStats` on teamKeys change to prevent mixing old/new data. Build verified. |
| Task 33 | BUG-028 | Low | Add teams 3-6 to useEffect dependency arrays in `StatsStatusBadge` and `StatsDetailPanel` | COMPLETE | Added `teamKeysStr = teamKeys.map(t => t.teamKey).join(',')` to derive stable key from teamKeys array. Updated useEffect deps from `[compId, config?.compType, config?.team1Name, config?.team2Name]` to `[compId, teamKeysStr]` in StatsStatusBadge.jsx:32 and `[expanded, compId, teamKeysStr]` in StatsDetailPanel.jsx:44. Now any team name change (1-6) triggers resubscription. Build verified. |
| Task 34 | BUG-026 | Low | Filter null scores in consistency trend calculation | COMPLETE | Added `validScores = scores.filter(v => v !== null && v !== undefined)` at `StatsDetailPanel.jsx:444`. Trend detection now uses `recentValid = validScores.slice(-3)` for accurate up/down/stable detection. Average calculation uses `validScores.reduce() / validScores.length` for correct average (not deflated by null-as-0). Bar chart uses `validScores` for min/max scaling; null scores render as 2px gray bars to preserve timeline visibility. Build verified. |
| Task 35 | BUG-030 | Low | Fix `normalizeTeamName()` stripping "state" — false matches for state schools | COMPLETE | Removed "state" from regex pattern in both `show-controller/src/lib/roadToNationals.js:206` and `show-controller/src/hooks/useRoadToNationals.js:248`. Now "Penn State" → "pennstate" and "Penn" → "penn" (no collision). Added explanatory comment. |
| Task 36 | BUG-025 | Low | Document `parseScore()` zero-as-null assumption | COMPLETE | Added comprehensive JSDoc explaining RTN's use of 0.0000 as "no score recorded" placeholder, why this is safe for gymnastics (NCAA Code of Points ensures all completed routines score > 0), and how to handle future edge cases if needed. Added inline comment at the check itself. Build not required (docs-only change). |
| Task 37 | BUG-031, BUG-038 | Low | Fix "8 endpoints" → "7 endpoints" across code and docs | COMPLETE | Updated `server/lib/rtnStatsService.js:8` comment. Updated PRD Section 1 (line 20), Section 5 Phase 1 (line 211), Story 2 (line 84). Updated tech plan Section 5.2 table (lines 483-484). Build not required (docs-only change). |
| Task 38 | BUG-033 | Low | Add dashboard staff fallback for teams with null coach data in RTN teams endpoint | COMPLETE | Updated `getHeadCoach()` and `getHeadCoaches()` in `show-controller/src/lib/roadToNationals.js` to fall back to `getCoachingStaff()` when `hc_first`/`hc_last` are null. Updated `useHeadCoaches` hook in `show-controller/src/hooks/useRoadToNationals.js` with same fallback pattern. Now works for George Washington, Northern Illinois, Pennsylvania, Utah, UW-Stout. Build verified. |
| Task 39 | BUG-034 | Medium | Fix `useRtnStats` client hook hardcoded team loop (6 → dynamic teamCount) | COMPLETE | Replaced `for (let i = 1; i <= 6; i++)` with `for (let i = 1; i <= teamCount; i++)` at lines 102 and 225 in `show-controller/src/hooks/useRtnStats.js`. Added `teamCount` to useMemo dependency arrays. Now supports womens-7 competitions alongside Task 28. Build verified. |
| Task 40 | BUG-035 | High | Fix `ingestTeamStats` to use `update()` instead of `set()` — preserve previous good data | COMPLETE | Changed `statsRef.set(writeData)` to `statsRef.update(writeData)` at `server/lib/rtnStatsService.js:839`. Added `Object.fromEntries(Object.entries(normalized).filter(...))` to filter out null values before writing. Now partial re-ingestion preserves previously-good endpoint data. Verify with deploy. |
| Task 41 | BUG-036 | Medium | Add fallback to `syncStatsToConfig` for unranked teams using individualAverages | NOT STARTED | When `teamRanking` is null, compute approximate Ave/High from `individualAverages` and `individualHighs` data. Affects `server/lib/rtnStatsService.js:1006-1018`. |
| Task 42 | BUG-037 | Medium | Fix show-start snapshot race with stale refresh | NOT STARTED | Either wait for in-progress refresh before snapshotting, or re-snapshot after refresh completes during a running show. Affects `server/index.js` showStarted handler and `refreshRtnStats` handler coordination. |
| Task 43 | BUG-038 | Low | Update all "8 endpoints" references to "7" in documentation | COMPLETE | Combined with Task 37 — all changes applied there. |

---

## Verification Checklist

### After Phase 1 (RTN ID Capture & Shared Stats Store)
- [ ] RTN team IDs captured in `teamsDatabase/teams/{teamKey}/rtnId` during Media Manager setup
- [ ] RTN athlete IDs captured in `teamsDatabase/headshots/{name}/rtnId`
- [ ] Media Manager verification checklist shows RTN ID status
- [ ] `ingestRtnStats` socket event triggers full ingestion
- [ ] `teamsDatabase/stats/{teamKey}/` populates in Firebase with correct schema
- [ ] All 8 stat categories present per team (or logged as errors in `meta.endpointStatus`)
- [ ] `meta.status` correctly shows "complete", "partial", or "error"
- [ ] Staleness check works: fresh data skips RTN fetch, stale data triggers fetch
- [ ] `team{N}Ave` and `team{N}High` auto-updated in config (via `syncStatsToConfig`)
- [ ] Config locks respected: locked fields not overwritten
- [ ] Rate limiting prevents more than 5 requests/second to RTN
- [ ] Partial failures handled gracefully (other endpoints/teams still ingested)
- [ ] Show-start snapshot copies shared stats to `competitions/{compId}/rtnStats/`
- [ ] Build succeeds: `cd show-controller && npm run build`

### After Phase 2 (Client Integration & Config Sync)
- [ ] New competition auto-triggers stats ingestion (non-blocking)
- [ ] Stats status badge visible on Dashboard with last-fetched timestamp
- [ ] "Refresh Stats" button works and updates data
- [ ] `isStale` warning shows when data is >24h old
- [ ] Auto-refresh triggers before show start if stats are stale
- [ ] Lock toggle icon visible next to auto-synced fields
- [ ] Manual edit auto-engages lock
- [ ] Locked fields survive stats refresh (not overwritten)
- [ ] Unlocking re-enables auto-sync
- [ ] Coach name sync respects locks
- [ ] Ave/High fields show RTN indicator when auto-filled
- [ ] Per-team stats detail panel shows consistency, MVP, top scores, lineup (Task 25)
- [ ] Per-athlete stats browsable with averages, highs, lineup rate (Task 25)
- [ ] Build succeeds: `cd show-controller && npm run build`
- [ ] Deploy and verify on production

### After Phase 3 (League Rankings)
- [ ] `rtnCache/rankings/{gender}-{year}-{week}/` populates
- [ ] Team rankings include all ranked teams
- [ ] Individual rankings available per event
- [ ] Week-based cache key used (not daily)
- [ ] `useLeagueRankings` hook returns data
- [ ] Rankings visible in Dashboard
- [ ] AI talking points reference national rankings

### After Phase 4 (AI Enhancement)
- [ ] Start a show, check talent view talking points
- [ ] Talking points reference individual athlete stats with specific numbers
- [ ] Consistency trends mentioned ("trending up/down on [event]")
- [ ] Head-to-head matchups shown for overlapping events
- [ ] MVP/lineup context in talking points
- [ ] Missing RTN stats handled gracefully (no errors, just fewer talking points)
- [ ] aiSuggestionService confidence scoring includes RTN stats factors (Task 26)
- [ ] Pre-show segment suggestions reference RTN stats data (Task 26)

### After Phase 5 (Playwright Tests)
- [ ] All 3 test scenarios pass on production
- [ ] Stats ingestion flow verified end-to-end
- [ ] Config lock behavior verified
- [ ] AI talking points verified to contain stats-backed content
- [ ] No console errors during any test

### After Phase 6 (Bug Fixes)
- [ ] William & Mary (and other `&` teams) stats load successfully (BUG-022)
- [ ] `womens-7` competitions ingest all 7 teams' stats (BUG-024)
- [ ] Client hook subscribes to all 7 teams in `womens-7` (BUG-034)
- [ ] Head coach data displays in UI (via proxy or Firebase cache) (BUG-023)
- [ ] Stats refresh badge updates immediately (not after 60s timeout) (BUG-032)
- [ ] Refresh on missing `rtnId` shows "Stats error" badge (BUG-029)
- [ ] Switching competitions doesn't cause stale loading state (BUG-027)
- [ ] Teams 3-6 name changes trigger resubscription (BUG-028)
- [ ] Consistency chart handles null scores (incorrect average fixed, not NaN) (BUG-026)
- [ ] "Penn State" does not false-match "Penn" in coach lookup (BUG-030)
- [ ] Re-ingestion preserves previously-good data for failed endpoints (BUG-035)
- [ ] Unranked teams get Ave/High populated via individualAverages fallback (BUG-036)
- [ ] Show-start snapshot contains fresh data when stale refresh is triggered (BUG-037)
- [ ] All "8 endpoints" references updated to "7" in code and docs (BUG-038)
- [ ] No console errors on production
