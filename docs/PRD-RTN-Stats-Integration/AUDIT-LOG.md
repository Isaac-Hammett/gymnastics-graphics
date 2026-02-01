# RTN Stats Integration — Audit Log

**Started:** 2026-02-01
**Status:** IN PROGRESS

**Categories:** A (Firebase Paths) | B (RTN API) | C (Existing Code) | D (Data Model) | E (Socket/Hooks) | F (AI Integration) | G (Plan Consistency)

---

## Category A: Firebase Paths — 2026-02-01

**Result:** 6 PASS / 2 FAIL / 6 INFO

| # | Check | Result | Finding |
|---|-------|--------|---------|
| A1 | `teamsDatabase/teams/{teamKey}` fields | PASS | Fields match plan. `roster` not present on all teams (missing on michigan-womens). No `rtnId` yet (expected). |
| A2 | `teamsDatabase/headshots/{name}` fields | PASS | Fields match plan (name, teamKey, url, updatedAt). No `rtnId` yet (expected). |
| A3 | `teamsDatabase/stats/` (NEW) | PASS | Path is null — no conflicts with existing data. |
| A4 | `competitions/{compId}/config` fields | FAIL | `team{N}Con` contains rank strings ("#1", "#5"), NOT std dev or percentage. Plan incorrectly assumed Con = consistency std dev. Config also has team3-team6 placeholders (plan only discussed team1-team2). |
| A5 | `competitions/{compId}/teamData` | FAIL | No `rtnId` field exists in `teamData`. Plan's fallback path `teamData/team{N}/rtnId` is fictional — never populated by `enrichTeamsWithRTN()`. Athlete `id` fields are Virtius IDs, not RTN IDs. |
| A6 | `config/_locks` (NEW) | PASS | Path doesn't exist (expected). Safe to add — no code iterates config children. |
| A7 | `rtnCache/` structure | PASS | `dashboards/` exists. Also has `womens/` and `mens/` team directory caches (not in plan, but no conflict). RTN dashboard roster includes athlete RTN IDs. |
| A8 | `competitions/{compId}/rtnStats/` (NEW) | PASS | Path doesn't exist (expected). No conflicts. |

**Plan docs updated:**
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 3.4: Removed fictional `teamData/team{N}/rtnId` fallback
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 8.3: Added audit note that `team{N}Con` is a rank string, not std dev
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 2.3: Added audit note documenting existing `rtnCache` siblings
- `PLAN-RTN-Stats-Integration-Implementation.md` Task 5: Removed `teamData` rtnId fallback
- `PLAN-RTN-Stats-Integration-Implementation.md` Task 6: Fixed `team{N}Con` to use rank string format; added team3-team6 handling note

**Tests written:**
- `tests/audit-A-firebase-paths.md` — full report with actual Firebase data for each check

---

## Category B: RTN API Endpoint Verification — 2026-02-01

**Result:** 6 PASS / 4 FAIL / 6 INFO

| # | Check | Result | Finding |
|---|-------|--------|---------|
| B1 | Dashboard endpoint | FAIL | `dashboard.id` doesn't exist; team ID is at `info.team_id`. Women's dashboards have no `test` field (men's only). Dashboard roster includes athlete RTN IDs (`roster[].id`). |
| B2 | Consistency endpoint | PASS | Response matches plan: `labels`, `vts`, `ubs`, `bbs`, `fxs` arrays. Values are strings. |
| B3 | MVP endpoint | PASS | Array of athletes with `vsum`/`ubsum`/`bbsum`/`fsum`/`total`/`gid`. Event field names differ from consistency. |
| B4 | Top Scores endpoint | PASS | `scores` array, `total` number, per-event arrays with `gymnast_id`/`max`/names. |
| B5 | Lineup endpoint | PASS | Array of `{id, first_name, last_name, meets: [0/1...]}`. |
| B6 | Individual Highs | FAIL | Response is `{team, ind}` NOT flat array. Fields: `maxv`/`maxub`/`maxbb`/`maxfx`/`maxaa`/`gid`. |
| B7 | Individual Averages | PASS | Same `{team, ind}` structure as B6. |
| B8 | Team Rankings | PASS | All fields present: `rank`, `name`, `tid`, `ave`, `high`, `rqs`, `reg`, `con`, `div`. `rqs` is 0 early in season. |
| B9 | Individual Rankings | FAIL | Name is `fname`+`lname` (not single `name`). `gid`/`tid` are numbers (not strings). |
| B10 | Week Discovery | PASS | `weeks` array sorted descending, `current: "1"` marks active week. Schema in all results responses. |
| B-CRIT | RTN ID source | FAIL | `enrichTeamsWithRTN()` uses `dashboard.id` which is always undefined → `rtnId` is always `null`. Must fix to `dashboard.info.team_id`. Athlete IDs available from dashboard roster AND Virtius HTML import. |

**Plan docs updated:**
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 3.1: Expanded event code tables to include MVP, Top Scores, and Highs/Avgs field names
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 3.1: Added athlete ID field name mapping table across all endpoints
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 3.1: Added audit note (B6) about `{team, ind}` response structure
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 3.4: Added audit note (B1) about `dashboard.id` bug
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 5.4: Fixed error handling row that still referenced `teamData` fallback
- `PLAN-RTN-Stats-Integration-Implementation.md` Task 1: Added `dashboard.id` bug fix, dashboard roster as backup RTN ID source
- `PLAN-RTN-Stats-Integration-Implementation.md` Task 4: Added detailed response shapes and field name mappings from audit

**Tests written:**
- `tests/audit-B-rtn-api.md` — full report with actual API response snippets for all 10 endpoints + RTN ID source analysis

---

## Category C: Existing Code Assumptions — 2026-02-01

**Result:** 12 PASS / 0 FAIL / 3 INFO

| # | Check | Result | Finding |
|---|-------|--------|---------|
| C1 | enrichTeamsWithRTN syncs only coaches to config | PASS | Confirmed — only `team{N}Coaches` synced to config. Ave/High/Con untouched. |
| C2 | Ave/High/Con manually entered | PASS | Confirmed — explicit code comment at useCompetitions.js:453 says so. |
| C3 | Media Manager doesn't capture rtnId | PASS | No rtnId in MediaManagerPage. But enrichTeamsWithRTN stores it in teamData (currently null due to B-CRIT bug). |
| C4 | aiContextService doesn't use RTN stats | PASS | `_loadCompetitionData()` loads config + teamData only, no RTN stats paths. |
| C5 | aiSuggestionService reads team{N}Ave/High | PASS | `analyzeTeamStats()` reads `team{slot}Ave` and `team{slot}High` from config. |
| C6 | rtnStatsService.js needs creation | PASS | File does not exist in server/lib/. |
| C7 | useRtnStats.js needs creation | PASS | File does not exist. Existing `useRoadToNationals.js` serves different purpose (client-side dashboard fetching). |
| C8 | useLeagueRankings.js needs creation | PASS | File does not exist. |
| C9 | showStarted handler exists | PASS | At server/index.js:444 inside per-competition engine setup. Good integration point after AI Context Service start (line 459). |
| C10 | Room-based broadcasting | PASS | Standard pattern: `io.to(\`competition:${compId}\`).emit()`. Also `socketIo.to(roomName).emit()` where roomName = same. |
| C11 | getDb() pattern in productionConfigService | PASS | Uses `firebase-admin`, singleton init, exports `getDb()`. New service should import from this. |
| C12 | enrichTeamsWithRTN writes teamData, not config | PASS | Writes to `competitions/{compId}/teamData`. Only syncs `team{N}Coaches` to config. teamData includes stats.average/high/rqs and rtnId (currently null). |

**Plan docs updated:**
- `PLAN-RTN-Stats-Integration-2026-02-01.md` Section 2.5: Added audit notes (C3/C12) about teamData as secondary RTN ID source, and (C7) about useRoadToNationals.js vs useRtnStats.js distinction
- `PLAN-RTN-Stats-Integration-Implementation.md` Task 7: Added specific line numbers for showStarted handler integration point (server/index.js:444, add after line 459)

**Tests written:**
- `tests/audit-C-existing-code.md` — full report with code references for all 12 checks

---

