# PLAN-RTN-Stats-Integration-Implementation

**PRD:** [PRD-RTN-Stats-Integration-2026-02-01.md](./PRD-RTN-Stats-Integration-2026-02-01.md)
**Status:** NOT STARTED
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
- Tasks are numbered sequentially: Task 1, Task 2, ... Task 24
- Each task number is unique and independent
- Example: "Task 8" is ONE task, not a subtask

---

## Phase Summary

| Phase | Name | Priority | Status | Tasks |
|-------|------|----------|--------|-------|
| 1 | RTN ID Capture & Shared Stats Store | P0 | NOT STARTED | 1-7 |
| 2 | Client Integration & Config Sync | P0 | NOT STARTED | 8-14 |
| 3 | League Rankings | P1 | NOT STARTED | 15-17 |
| 4 | AI Enhancement | P1 | NOT STARTED | 18-21 |
| 5 | Playwright Integration Tests | P1 | NOT STARTED | 22-24 |

---

## Task Summary by Phase

### Phase 1: RTN ID Capture & Shared Stats Store (P0) - NOT STARTED (0/7)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 1 | Capture RTN team ID during Media Manager team setup | NOT STARTED | When `enrichTeamsWithRTN()` fetches from Virtius API, extract the RTN team ID and store it at `teamsDatabase/teams/{teamKey}/rtnId`. If RTN ID is already present and valid, skip. Log a warning if Virtius data doesn't include an RTN ID for a team. Update the Media Manager verification checklist to show RTN ID status. |
| Task 2 | Capture RTN athlete IDs during Media Manager headshot setup | NOT STARTED | When fetching athlete data from Virtius (headshot URLs), also extract the RTN athlete ID and store it at `teamsDatabase/headshots/{athlete-name}/rtnId`. This is the key for joining individual stats from RTN to Virtius roster entries. Log warnings for missing RTN IDs. Update Media Manager verification checklist to include RTN ID check alongside headshot and roster checks. |
| Task 3 | Create `server/lib/rtnStatsService.js` with all 8 RTN fetch functions and rate limiting | NOT STARTED | Functions: `fetchConsistency()`, `fetchMVP()`, `fetchTopScores()`, `fetchLineup()`, `fetchIndividualHighs()`, `fetchIndividualAverages()`, `fetchTeamRanking()`, `getCurrentWeek()`. Each takes `(gender, year, tid)`, calls RTN API, returns raw JSON. Include `rateLimitedFetch()` helper with 200ms delay, 10s timeout per request, retry-once on 500 errors. Export constants for event mappings and type codes. |
| Task 4 | Add normalization layer to translate raw RTN JSON to Firebase schema | NOT STARTED | Functions: `normalizeConsistency()`, `normalizeMVP()`, `normalizeTopScores()`, `normalizeLineup()`, `normalizeIndividualHighs()`, `normalizeIndividualAverages()`, `normalizeTeamRanking()`. Gender-aware event code translation (see PLAN section 3.1). Handle negative scores as null, round floats to 4 decimals, parse string scores to numbers. Store `rtnId` on each athlete record for downstream joins. |
| Task 5 | Implement `ingestCompetitionStats(compId, io)` orchestration with staleness check | NOT STARTED | Reads competition config to get team names and gender. For each team: reads `teamsDatabase/teams/{teamKey}/rtnId` (no fallback — rtnId must be set during Media Manager setup). Checks `teamsDatabase/stats/{teamKey}/meta/fetchedAt` for staleness (>24h). If stale or missing: calls all fetch functions sequentially (rate-limited), normalizes, writes to `teamsDatabase/stats/{teamKey}/`. If fresh: skips fetch. Writes per-endpoint status to `meta.endpointStatus`. Sets `meta.status` to "complete", "partial", or "error". Emits `rtnStatsProgress` events during ingestion. Handles partial failures: records per-endpoint errors, continues with remaining endpoints/teams. |
| Task 6 | Implement `syncStatsToConfig(compId)` with config lock support | NOT STARTED | Reads `teamsDatabase/stats/{teamKey}/teamRanking` for each team. Reads `competitions/{compId}/config/_locks` to check for manual overrides. For each team, writes `team{N}Ave` (from ranking average), `team{N}High` (from ranking high) to config — BUT ONLY if the corresponding lock is not set. Writes `team{N}Con` as the team's **overall ranking string** (e.g., "#1", "#3(t)") from `teamRanking.rank`, matching the existing format used in graphics. Skips locked fields entirely. Also applies to coach names: respect `team{N}Coaches` lock from `_locks`. Must handle team3-team6 for tri/quad/multi-team meets (config has placeholder fields for up to 6 teams). |
| Task 7 | Wire socket events in `server/index.js` and add show-start snapshot | NOT STARTED | Add socket handlers: `ingestRtnStats` calls `ingestCompetitionStats()` then `syncStatsToConfig()`, emits `rtnStatsResult`. `refreshRtnStats` calls `ingestTeamStats()` directly (bypasses staleness check), then `syncStatsToConfig()`. Both emit `rtnStatsResult` on completion. Add `snapshotStatsForCompetition(compId)` function that copies `teamsDatabase/stats/{teamKey}/` to `competitions/{compId}/rtnStats/team{N}/` with `snapshotTakenAt` timestamp. Wire snapshot into `showStarted` event handler: check staleness, auto-refresh if needed, then snapshot. Follow existing patterns from `loadRundown` and `getAISuggestions` handlers. |

### Phase 2: Client Integration & Config Sync (P0) - NOT STARTED (0/7)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 8 | Create `show-controller/src/hooks/useRtnStats.js` with Firebase listener | NOT STARTED | Subscribe to `teamsDatabase/stats/{teamKey}` for each team in the competition (before show) and `competitions/{compId}/rtnStats` (during show) via `onValue`. Return `{ stats, meta, loading, error, refresh, isStale }`. `refresh()` emits `refreshRtnStats` socket event. `isStale` computed from `meta.fetchedAt > 24h ago`. Handle missing/null rtnStats gracefully. |
| Task 9 | Trigger stats ingestion after competition creation in `useCompetitions.js` | NOT STARTED | After `enrichTeamsWithRTN()` completes in `createCompetition()`, emit `ingestRtnStats` socket event. Non-blocking — competition is usable immediately while stats fetch in background. Listen for `rtnStatsResult` to update status. Also trigger on `updateCompetition()` if teams changed. |
| Task 10 | Add stats status indicator and "Refresh Stats" button to DashboardPage | NOT STARTED | Show badge near competition card: green "Stats loaded" with timestamp when `meta.status === 'complete'`, yellow "Partial" with details if partial, red "Error" if error, gray "No stats" if missing. Show `isStale` warning if data is >24h old. Add "Refresh Stats" button that calls `refresh()` from `useRtnStats`. Show loading spinner during refresh. Always display "Last fetched: [timestamp]". |
| Task 11 | Implement config lock UI and persistence | NOT STARTED | Add lock toggle icon next to each auto-synced field (team{N}Ave, team{N}High, team{N}Con, team{N}Coaches) in DashboardPage or competition config editor. Clicking lock writes `true` to `competitions/{compId}/config/_locks/{fieldName}`. Locked fields show lock icon and "[Manual]" indicator. Unlocking removes the lock key. When a producer manually edits a field value, auto-engage the lock (implicit lock on manual edit). Subscribe to `_locks` path for real-time lock state. |
| Task 12 | Mark Ave/High fields as auto-filled when synced from RTN | NOT STARTED | In DashboardPage or competition config editor, show visual indicator (small RTN badge or tooltip "Auto-filled from Road To Nationals") next to `team{N}Ave` and `team{N}High` fields when they were auto-synced and NOT locked. Fields that are locked show "[Manual]" instead. Clear the RTN indicator if the field is manually edited. |
| Task 13 | Add auto-refresh before show start (client-side trigger) | NOT STARTED | In ProducerView or ShowContext, when show starts: check `isStale` from `useRtnStats`. If stale, emit `refreshRtnStats` before proceeding. Show brief "Refreshing stats..." indicator. Non-blocking — show starts regardless, stats update in background. The server-side `showStarted` handler (Task 7) handles the snapshot, but this client-side trigger ensures the staleness check runs even if the server handler hasn't been wired yet. |
| Task 14 | Update existing `enrichTeamsWithRTN()` coach sync to respect locks | NOT STARTED | In `useCompetitions.js` or wherever coach names are synced to `team{N}Coaches`, read `competitions/{compId}/config/_locks/team{N}Coaches` first. If locked, skip writing coaches for that team. This prevents the existing coach sync from overwriting manual corrections. |

### Phase 3: League Rankings (P1) - NOT STARTED (0/3)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 15 | Implement `fetchLeagueRankings(gender, year, week)` in rtnStatsService.js | NOT STARTED | Fetch team rankings: `results/{year}/{week}/0/{type}` (type=5 for women, 7 for men). Fetch individual rankings for each event: `results/{year}/{week}/1/{1..5 or 1..7}`. Normalize all results. Write to `rtnCache/rankings/{gender}-{year}-{week}/`. Include `getCurrentWeek()` to determine latest available week (use week-based, NOT daily). Cache with 24h TTL. Use rate-limited fetch for all ranking calls. |
| Task 16 | Create `useLeagueRankings(gender)` hook and wire socket event | NOT STARTED | Subscribe to `rtnCache/rankings/{gender}-{year}-{latestWeek}`. Return `{ teamRankings, individualRankings, week, loading, error, refresh }`. `refresh()` emits `fetchLeagueRankings` socket event. Determine latest week from available cache keys. Wire `fetchLeagueRankings` socket handler in server/index.js that calls `fetchLeagueRankings()` and emits `leagueRankingsResult`. |
| Task 17 | Display rankings in Dashboard and make available to AI services | NOT STARTED | Add rankings panel or tab in DashboardPage showing team rankings (rank, team name, ave, high, rqs) and individual rankings per event. Highlight teams in current competition. Make `rtnCache/rankings/` readable by `aiContextService.js` so talking points can reference "Ranked #3 nationally on beam". |

### Phase 4: AI Enhancement (P1) - NOT STARTED (0/4)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 18 | Add `_loadRtnStats()` to aiContextService.js and generate athlete-specific talking points | NOT STARTED | Load `competitions/{compId}/rtnStats/` (frozen snapshot) at service startup. Add `_getAthleteStatsTalkingPoints()` that generates points from individual averages/highs using RTN ID to match athletes to Virtius roster. Examples: "Mackenzie Estep averages 9.933 on vault", "Faith Torrez season high 9.975 on beam". Null-check each stats field since partial ingestion means some may be missing. Priority: normal. |
| Task 19 | Add consistency trend analysis talking points | NOT STARTED | Add `_getConsistencyTalkingPoints()` to aiContextService.js. Analyze event score arrays from consistency data. Detect trends: "improving" if last 3 scores increasing, "declining" if decreasing, "stable" otherwise. Generate: "Oklahoma trending up on beam: 49.50 -> 49.48 -> 49.68". Priority: normal. Include standard deviation for consistency rating. |
| Task 20 | Add head-to-head matchup talking points using individual rankings | NOT STARTED | Add `_getMatchupTalkingPoints()` to aiContextService.js. Compare athletes across teams on same events using individual highs and averages. Generate: "Vault matchup: Estep (9.975 high, 9.933 avg) vs. Chiles (9.95 high, 9.944 avg)". Focus on events where competition is closest. Also pull league rankings from `rtnCache/rankings/` if available. Priority: high (matchups are most useful for commentary). |
| Task 21 | Add MVP and lineup context talking points | NOT STARTED | Add `_getMVPTalkingPoints()` and `_getLineupTalkingPoints()` to aiContextService.js. MVP: "Addison Fatta leads OU with 157.45 total across all events". Top scores: "OU's theoretical max is 198.75 if everyone hits season highs". Lineup: "Faith Torrez has competed in all 4 meets — key contributor on VT, UB, BB". Detect lineup changes: "First time in lineup" if meets array shows recent addition. Priority: normal. |

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

### After Phase 5 (Playwright Tests)
- [ ] All 3 test scenarios pass on production
- [ ] Stats ingestion flow verified end-to-end
- [ ] Config lock behavior verified
- [ ] AI talking points verified to contain stats-backed content
- [ ] No console errors during any test
