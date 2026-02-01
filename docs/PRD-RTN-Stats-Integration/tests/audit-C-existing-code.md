# Audit Category C: Existing Code Assumptions

**Date:** 2026-02-01
**Auditor:** Claude (automated)

---

## C1: "enrichTeamsWithRTN() only syncs coach names to config"

**File:** `show-controller/src/hooks/useCompetitions.js` lines 110-224, 355-454
**Plan Claim:** enrichTeamsWithRTN only syncs coach names to config; Ave/High/Con are manually entered.

**Finding:** PASS

`enrichTeamsWithRTN()` returns a `teamData` object written to `competitions/{compId}/teamData`. The only config fields it syncs back are `team{N}Coaches` (lines 366-378, 401-412, 447-452). Line 453 has an explicit comment: `// Note: Stats (AVE, HIGH) are entered manually - RTN data format needs investigation`.

The `teamData` object does include `stats: { average, high, rqs }` from the RTN dashboard's `test` field (lines 172-176), but these are stored only in `teamData`, never synced to config's `team{N}Ave`/`team{N}High`/`team{N}Con`.

---

## C2: "team{N}Ave and team{N}High are manually entered"

**File:** `show-controller/src/pages/DashboardPage.jsx` lines 226-249
**Plan Claim:** These fields are manually entered in the Dashboard and are never auto-populated.

**Finding:** PASS

`DashboardPage.jsx` defines default values (lines 226-249):
```js
team1Ave: '0.000',
team1High: '0.000',
team1Con: '0%',
team1Coaches: 'Coach Name',
// ... same for team2-team6
```

These are plain config fields with no auto-population. The comment in `useCompetitions.js:453` confirms: stats are entered manually. The plan's new `syncStatsToConfig` will be the first automatic writer of these fields.

---

## C3: "Media Manager doesn't capture RTN IDs"

**File:** `show-controller/src/pages/MediaManagerPage.jsx`
**Plan Claim:** The Media Manager does not capture or store `rtnId` for teams or athletes.

**Finding:** PASS

Searched `MediaManagerPage.jsx` for `rtnId` — no matches. The Media Manager handles logos and headshots from Firebase `teamsDatabase/` but does not interact with RTN IDs.

**However**, note from Category B audit (B1 FAIL): the `enrichTeamsWithRTN` function (useCompetitions.js:134) DOES store `rtnId: dashboard.id` in the `teamData` object. So RTN team IDs ARE already captured — just stored in `competitions/{compId}/teamData/team{N}/rtnId`, not in `teamsDatabase/teams/{teamKey}/rtnId` where the plan expects them.

**INFO:** This is consistent with audit B1 finding — the plan needs to source rtnId from `teamData` or copy it to `teamsDatabase/teams/{teamKey}/rtnId` during enrichment.

---

## C4: "aiContextService.js doesn't use RTN stats"

**File:** `server/lib/aiContextService.js` lines 1847-1873
**Plan Claim:** aiContextService does not currently use RTN statistics data.

**Finding:** PASS

The `_loadCompetitionData()` method (lines 1847-1873) loads:
- `competitions/{compId}/config` → `this._competitionConfig`
- `competitions/{compId}/teamData` → `this._teamData`

It does NOT load any RTN stats paths (`teamsDatabase/stats/`, `rtnCache/`, etc.). The plan's new `_loadRtnStats()` method is indeed a new addition.

---

## C5: "aiSuggestionService.js reads team1Ave/team1High from config"

**File:** `server/lib/aiSuggestionService.js` lines 925-969
**Plan Claim:** The `analyzeTeamStats()` function reads `team{N}Ave` and `team{N}High` from competition config.

**Finding:** PASS

`analyzeTeamStats()` at line 925 reads:
```js
const avg = parseFloat(competitionConfig?.[`team${slot}Ave`]) || 0;
const high = parseFloat(competitionConfig?.[`team${slot}High`]) || 0;
```

This confirms the plan's integration point — auto-syncing RTN stats to these config fields will automatically enhance AI suggestions without modifying this service.

**INFO:** The function also reads `team{N}Tricode` (line 937). The plan doesn't mention syncing tricodes from RTN.

---

## C6: "server/lib/rtnStatsService.js needs to be CREATED"

**File:** `server/lib/`
**Plan Claim:** This file does not exist and must be created.

**Finding:** PASS

Glob for `server/lib/rtnStatsService.*` returned no results. The file does not exist. Safe to create.

---

## C7: "useRtnStats.js needs to be CREATED"

**File:** `show-controller/src/hooks/`
**Plan Claim:** This hook does not exist and must be created.

**Finding:** PASS

Glob for `show-controller/src/hooks/useRtnStats.*` returned no results. The file does not exist.

**INFO:** There IS an existing `useRoadToNationals.js` hook. The plan should document the relationship between the existing `useRoadToNationals.js` (client-side RTN dashboard fetching) and the new `useRtnStats.js` (server-side stats consumption). They serve different purposes but could confuse developers.

---

## C8: "useLeagueRankings.js needs to be CREATED"

**File:** `show-controller/src/hooks/`
**Plan Claim:** This hook does not exist and must be created.

**Finding:** PASS

Glob for `show-controller/src/hooks/useLeagueRankings.*` returned no results. The file does not exist. Safe to create.

---

## C9: "showStarted handler exists in server/index.js"

**File:** `server/index.js` lines 444-479
**Plan Claim:** A `showStarted` event handler exists where snapshot logic can be added.

**Finding:** PASS

The `showStarted` handler at line 444 is an `engine.on('showStarted')` callback inside the per-competition timesheet setup function. It currently:
1. Logs "Show started"
2. Emits `timesheetShowStarted` and `timesheetState` to the room
3. Starts the AI Context Service (lines 449-459)
4. Creates initial run record for timing analytics (lines 461-479)

This is the correct place to add RTN stats snapshot logic. The plan should add the snapshot after the AI Context Service start but before/alongside the run record creation.

**Important detail:** The handler receives `data` with `data.timestamp` and `data.segmentCount`. The `compId` and `firebase` variables are available in the enclosing scope. The room is `roomName` (set at line 405 as `` `competition:${compId}` ``).

---

## C10: "Socket events use room-based broadcasting"

**File:** `server/index.js`
**Plan Claim:** Socket events use `io.to('competition:${compId}').emit()` pattern.

**Finding:** PASS (with nuance)

Two room patterns are used:
1. **Legacy local room:** `const localRoom = 'competition:local'` (line 270) — used for the hardcoded local timesheet engine
2. **Per-competition room:** `` `competition:${compId}` `` (line 405) — used for dynamically created competition engines

The per-competition pattern (`` io.to(`competition:${compId}`).emit() ``) is the standard. Found at lines 884, 5066, 5127, 5900, 6437, 6492, 6500, 6506, 6512, 6518.

Also, inside competition-scoped engines, `socketIo.to(roomName).emit()` is used where `roomName = `competition:${compId}`` (line 405).

The plan's new events should use the per-competition room pattern.

---

## C11: "productionConfigService uses getDb() pattern"

**File:** `server/lib/productionConfigService.js` lines 1-50
**Plan Claim:** The service uses a `getDb()` function to access Firebase Admin SDK.

**Finding:** PASS

`productionConfigService.js` uses:
- `import admin from 'firebase-admin'` (line 17)
- A module-level `let db = null` (line 23)
- An `initializeFirebase()` function that initializes the Admin SDK once (lines 30-50)
- Exports a `getDb()` function that returns the database reference

The plan's new `rtnStatsService.js` should import `{ getDb }` from `productionConfigService.js`, matching the existing pattern.

---

## C12: "enrichTeamsWithRTN writes to teamData, not config"

**File:** `show-controller/src/hooks/useCompetitions.js` lines 355-454
**Plan Claim:** Enrichment writes to `competitions/{compId}/teamData`, not to config fields.

**Finding:** PASS (with important nuance)

Enrichment writes `teamData` to `competitions/{compId}/teamData` (lines 364, 398, 441). The ONLY config fields it touches are `team{N}Coaches` (lines 366-378). It explicitly does NOT write Ave/High/Con to config.

**Important for the plan:** The `teamData` already contains useful stats:
- `teamData.team{N}.stats.average` — season average from RTN dashboard
- `teamData.team{N}.stats.high` — season high from RTN dashboard
- `teamData.team{N}.stats.rqs` — RQS from RTN dashboard
- `teamData.team{N}.rtnId` — RTN team ID
- `teamData.team{N}.roster[].id` — RTN athlete IDs

The plan's server-side `rtnStatsService` could potentially read the `rtnId` from existing `teamData` instead of requiring it to be in `teamsDatabase/teams/{teamKey}/rtnId`. This resolves the RTN ID source question flagged in Category B.

---

## Summary

| # | Check | Result | Finding |
|---|-------|--------|---------|
| C1 | enrichTeamsWithRTN syncs only coaches | PASS | Confirmed — only `team{N}Coaches` synced to config |
| C2 | Ave/High/Con manually entered | PASS | Confirmed — explicit code comment says so |
| C3 | Media Manager doesn't capture rtnId | PASS | No rtnId in MediaManagerPage. But enrichTeamsWithRTN stores it in teamData. |
| C4 | aiContextService doesn't use RTN stats | PASS | Loads config + teamData only, no RTN stats paths |
| C5 | aiSuggestionService reads team{N}Ave/High | PASS | `analyzeTeamStats()` reads these from config |
| C6 | rtnStatsService.js needs creation | PASS | File does not exist |
| C7 | useRtnStats.js needs creation | PASS | File does not exist. Note: existing useRoadToNationals.js serves different purpose. |
| C8 | useLeagueRankings.js needs creation | PASS | File does not exist |
| C9 | showStarted handler exists | PASS | At line 444, good integration point |
| C10 | Room-based broadcasting | PASS | `competition:${compId}` is the standard pattern |
| C11 | getDb() pattern in productionConfigService | PASS | Confirmed — import and reuse this pattern |
| C12 | enrichTeamsWithRTN writes teamData, not config | PASS | Only Coaches synced to config. teamData has stats + rtnId. |

**Result: 12 PASS / 0 FAIL / 3 INFO**

### INFO items requiring plan attention:

1. **C3/C12 — RTN ID already in teamData:** `enrichTeamsWithRTN` stores `rtnId` in `competitions/{compId}/teamData/team{N}/rtnId` and athlete IDs in `teamData/team{N}/roster[]/id`. The server-side `rtnStatsService` can read these from the competition's `teamData` rather than requiring a separate `teamsDatabase/teams/{teamKey}/rtnId` field. This simplifies the RTN ID capture story.

2. **C7 — Hook naming clarity:** Existing `useRoadToNationals.js` and new `useRtnStats.js` serve different purposes. Plan should document this to avoid confusion.

3. **C5 — Tricode field:** `analyzeTeamStats()` also reads `team{N}Tricode`. Not relevant to RTN stats plan but worth noting.
