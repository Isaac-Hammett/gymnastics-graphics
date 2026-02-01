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

---

## Phase Summary

| Phase | Name | Priority | Status | Tasks |
|-------|------|----------|--------|-------|
| 1 | RTN ID Capture & Shared Stats Store | P0 | COMPLETE | 1-7 |
| 2 | Client Integration & Config Sync | P0 | IN PROGRESS | 8-14, 25 |
| 3 | League Rankings | P1 | NOT STARTED | 15-17 |
| 4 | AI Enhancement | P1 | NOT STARTED | 18-21, 26 |
| 5 | Playwright Integration Tests | P1 | NOT STARTED | 22-24 |

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

### Phase 2: Client Integration & Config Sync (P0) - IN PROGRESS (6/8)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 8 | Create `show-controller/src/hooks/useRtnStats.js` with Firebase listener | COMPLETE | Created `show-controller/src/hooks/useRtnStats.js`. Hook accepts `(compId, config)` params. Implements client-side `buildTeamDbKey()` and `parseCompetitionType()` mirroring server logic. Derives `teamKeys` from config team names + gender. Before show: subscribes to `teamsDatabase/stats/{teamKey}/` via `onValue` for each team. During show (`timesheetState.isRunning`): subscribes to `competitions/{compId}/rtnStats` snapshot. Socket listeners for `rtnStatsResult` and `rtnStatsProgress` registered in useEffect with proper cleanup via `socket.off()` (follows `useAIContext.js` pattern). Returns `{ stats, meta, loading, error, refresh, isStale, progress, teamKeys }`. `refresh(teamKey?)` emits `refreshRtnStats`. `isStale` computed from `meta.fetchedAt > 24h`. Also exports `buildTeamDbKey` and `parseCompetitionType` for reuse. Build verified. |
| Task 9 | Trigger stats ingestion after competition creation in `useCompetitions.js` | COMPLETE | Added `triggerStatsIngestion(compId)` utility function that creates a temporary socket.io connection to the coordinator server (via `SERVER_URL`), emits `ingestRtnStats`, logs result, and auto-disconnects (on result, error, or 60s timeout). Called after `enrichTeamsWithRTN()` in both `createCompetition()` and `updateCompetition()` (when `refreshRTN` is true). Non-blocking fire-and-forget — competition is usable immediately. Build verified. |
| Task 10 | Add stats status indicator and "Refresh Stats" button to DashboardPage | COMPLETE | Created shared `StatsStatusBadge` component at `components/StatsStatusBadge.jsx`. Reads `teamsDatabase/stats/{teamKey}/meta` directly from Firebase (pages lack ShowContext so cannot use `useRtnStats` hook). Shows green "Stats loaded" / yellow "Partial" / red "Stats error" / gray "No stats" badge with relative timestamp. Shows "Stale" warning when data >24h old. Refresh button uses temporary socket.io connection (same pattern as `triggerStatsIngestion` in useCompetitions.js) to emit `refreshRtnStats`. Spinning arrow icon during refresh. Added to both HomePage.jsx (primary page users see at `/`) and DashboardPage.jsx (legacy). Imports `buildTeamDbKey` and `parseCompetitionType` from useRtnStats.js for team key derivation. Build verified, deployed, verified on production. |
| Task 11 | Implement config lock UI and persistence | COMPLETE | Added lock toggle UI to ControllerPage.jsx for all 8 lockable fields (team{1,2}{Ave,High,Con,Coaches}). Created `LockableInput` and `LockableTextarea` components with `LockIcon` toggle. Locked state stored at `competitions/{compId}/config/_locks/{fieldName}` via `updateConfig()`. Auto-lock on manual edit: when user types in a lockable field, lock is automatically engaged. Amber lock icon + "Manual" label shown when locked, subtle unlock icon when unlocked. Locked fields get amber border highlight. `toggleLock()` sets lock to `true` or removes it (`null`). Locks derived from `config._locks` which is already subscribed via `useCompetition` hook's `onValue` listener on config path. Server-side `syncStatsToConfig` (Task 6) already respects these locks. Build verified. |
| Task 12 | Mark Ave/High fields as auto-filled when synced from RTN | COMPLETE | Added RTN auto-fill indicators to ControllerPage.jsx. Subscribes to `teamsDatabase/stats/{teamKey}/meta` via Firebase `onValue` for each team to detect if RTN stats are loaded. When a field (Ave, High, Con) is unlocked and has RTN stats available, shows a blue "RTN" micro-badge next to the label and a subtle blue border. When locked, shows amber "Manual" label (existing behavior). The RTN indicator clears when the user manually edits the field (because manual edit auto-engages the lock). Imports `buildTeamDbKey` and `parseCompetitionType` from `useRtnStats.js` for team key derivation. Build verified. |
| Task 13 | Add auto-refresh before show start (client-side trigger) | COMPLETE | Added `useRtnStats` hook to ProducerView.jsx. Created `handleStartShow` wrapper that checks `isStale` before calling `timesheetStart()`. If stats are stale, calls `refreshRtnStats()` (non-blocking) then immediately starts the show. Yellow "Stats are stale" hint shown below Start Show button when stale. Blue "Refreshing stats..." spinner shown during refresh. Uses `staleRefreshTriggered` flag to prevent duplicate refreshes. Server-side `showStarted` handler (Task 7) still handles the snapshot independently. Build verified. |
| Task 14 | Update existing `enrichTeamsWithRTN()` coach sync to respect locks | NOT STARTED | In `useCompetitions.js` or wherever coach names are synced to `team{N}Coaches`, read `competitions/{compId}/config/_locks/team{N}Coaches` first. If locked, skip writing coaches for that team. This prevents the existing coach sync from overwriting manual corrections. |

### Phase 3: League Rankings (P1) - NOT STARTED (0/3)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 15 | Implement `fetchLeagueRankings(gender, year, week)` in rtnStatsService.js | NOT STARTED | Fetch team rankings: `results/{year}/{week}/0/{type}` (type=5 for women, 7 for men). Fetch individual rankings for each event: `results/{year}/{week}/1/{1..5 or 1..7}`. Normalize all results. Write to `rtnCache/rankings/{gender}-{year}-{week}/`. Include `getCurrentWeek()` to determine latest available week (use week-based, NOT daily). Cache with 24h TTL. Use rate-limited fetch for all ranking calls. |
| Task 16 | Create `useLeagueRankings(gender)` hook and wire socket event | NOT STARTED | Subscribe to `rtnCache/rankings/{gender}-{year}-{latestWeek}`. Return `{ teamRankings, individualRankings, week, loading, error, refresh }`. `refresh()` emits `fetchLeagueRankings` socket event. Determine latest week from available cache keys. Wire `fetchLeagueRankings` socket handler in server/index.js that calls `fetchLeagueRankings()` and emits `leagueRankingsResult`. **Socket listener pattern (audit E5):** Register `leagueRankingsResult` listener directly in hook's useEffect (follow `useAIContext.js` pattern), not in ShowContext.jsx. |
| Task 17 | Display rankings in Dashboard and make available to AI services | NOT STARTED | Add rankings panel or tab in DashboardPage showing team rankings (rank, team name, ave, high, rqs) and individual rankings per event. Highlight teams in current competition. Make `rtnCache/rankings/` readable by `aiContextService.js` so talking points can reference "Ranked #3 nationally on beam". |

### Phase 4: AI Enhancement (P1) - NOT STARTED (0/5)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 18 | Add `_loadRtnStats()` to aiContextService.js and generate athlete-specific talking points | NOT STARTED | Load `competitions/{compId}/rtnStats/` (frozen snapshot) at service startup inside `start()` after `_loadCompetitionData()`. Store as `this._rtnStats`. Add `_getAthleteStatsTalkingPoints()` that generates points from individual averages/highs. **Athlete matching (audit F4):** Join `this._teamData.team{N}.roster[].rtnId` (populated by enrichTeamsWithRTN after B-CRIT fix) ↔ `this._rtnStats.team{N}.individualHighs[].rtnId`. Do NOT load `teamsDatabase/headshots/` separately. If `rtnId` is missing on a roster entry, fall back to name matching via `_getAthleteFromRoster()`. Examples: "Mackenzie Estep averages 9.933 on vault", "Faith Torrez season high 9.975 on beam". Null-check: if `this._rtnStats` is null, return `[]` (follow existing pattern at line 842). **Priority (audit F3):** Use `PRIORITY.MEDIUM` from aiContextService constants (NOT "normal" — that value doesn't exist). **Slot competition (audit F6):** Only generate athlete stats points during non-scoring segments (opening, intro, break, rotation start). During active scoring, existing CRITICAL/HIGH generators take priority. |
| Task 19 | Add consistency trend analysis talking points | NOT STARTED | Add `_getConsistencyTalkingPoints()` to aiContextService.js. Analyze event score arrays from consistency data. Detect trends: "improving" if last 3 scores increasing, "declining" if decreasing, "stable" otherwise. Generate: "Oklahoma trending up on beam: 49.50 -> 49.48 -> 49.68". **Priority (audit F3):** Use `PRIORITY.MEDIUM`. Only generate during non-scoring segments (opening, intro, break). Include standard deviation for consistency rating. |
| Task 20 | Add head-to-head matchup talking points using individual rankings | NOT STARTED | Add `_getMatchupTalkingPoints()` to aiContextService.js. Compare athletes across teams on same events using individual highs and averages. Generate: "Vault matchup: Estep (9.975 high, 9.933 avg) vs. Chiles (9.95 high, 9.944 avg)". Focus on events where competition is closest. Also pull league rankings from `rtnCache/rankings/` if available. **Priority (audit F3):** Use `PRIORITY.HIGH` (matchups are most useful for commentary and will compete well in the 5-slot budget). Generate during rotation start and scoring segments. Note: an existing `_getMatchupTalkingPoints()` method exists at line 842 — the new implementation should REPLACE the existing stub, not create a duplicate. |
| Task 21 | Add MVP and lineup context talking points | NOT STARTED | Add `_getMVPTalkingPoints()` and `_getLineupTalkingPoints()` to aiContextService.js. MVP: "Addison Fatta leads OU with 157.45 total across all events". Top scores: "OU's theoretical max is 198.75 if everyone hits season highs". Lineup: "Faith Torrez has competed in all 4 meets — key contributor on VT, UB, BB". Detect lineup changes: "First time in lineup" if meets array shows recent addition. **Priority (audit F3):** Use `PRIORITY.MEDIUM`. Only generate during non-scoring segments (opening, intro, break). |

### Additional Tasks (added by audit G)

| Task | Description | Phase | Status | Notes |
|------|-------------|-------|--------|-------|
| Task 25 | Add stats detail panel to DashboardPage for per-team and per-athlete stats browsing | Phase 2 | NOT STARTED | **Added by audit G6:** PRD Stories 2 and 3 require producers to browse per-team stats (consistency trends, MVP standings, top scores, lineup frequency) and per-athlete stats (averages, highs, lineup rate). No existing task creates this UI. Add a collapsible/tabbed stats detail panel to DashboardPage (or a linked detail view) showing: (1) per-team: consistency chart/trend, MVP standings table, top scores per event, lineup frequency; (2) per-athlete: event averages, event highs, lineup rate, MVP total. Data comes from `useRtnStats` hook (Task 8). Depends on Tasks 8-10 being complete. Athletes sortable/filterable by event. |
| Task 26 | Enhance aiSuggestionService.js with RTN stats confidence factors and segment suggestions | Phase 4 | NOT STARTED | **Added by audit G7:** Technical Plan Section 7.2 describes enhancements to `aiSuggestionService.js` but no implementation task covered them. Add confidence scoring factors: `HAS_RTN_STATS` (+0.15 if rtnStats loaded), `HAS_INDIVIDUAL_STATS` (+0.1 if individual averages/highs available), `HAS_RANKINGS` (+0.05 if league rankings available). Add new segment suggestions: "Athlete Spotlight: [top MVP contributor]" (high confidence when MVP data available), "Event Preview: [event where teams are closest]" (uses individual averages for matchup analysis), "Senior Feature: [senior with highest contribution]" (combines MVP + roster year data). Read from `teamsDatabase/stats/{teamKey}/` for pre-show planning suggestions. |

### Phase 5: Playwright Integration Tests (P1) - NOT STARTED (0/3)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 22 | Playwright test: Stats ingestion end-to-end flow | NOT STARTED | Using MCP Playwright tools, test the full flow on production: navigate to DashboardPage, create or select a competition with known teams, verify stats status indicator appears, verify "Stats loaded" with timestamp, verify team{N}Ave and team{N}High are populated in config, check console for errors. Test "Refresh Stats" button triggers re-fetch and updates timestamp. |
| Task 23 | Playwright test: Config auto-sync and manual lock behavior | NOT STARTED | Test: edit team1Ave manually, verify lock icon appears, trigger stats refresh, verify team1Ave was NOT overwritten (lock respected). Unlock the field, trigger refresh again, verify field is now updated from RTN. Test that creating a new competition auto-populates config fields. Check console for errors throughout. |
| Task 24 | Playwright test: AI talking points contain stats-backed content | NOT STARTED | Start a show for a competition with RTN stats loaded. Navigate to TalentView. Verify AI talking points panel contains stats-specific content (athlete names, numbers, trends — not just generic commentary). Verify talking points update as segments advance. Check ProducerView AI panel as well. Check console for errors. |

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
