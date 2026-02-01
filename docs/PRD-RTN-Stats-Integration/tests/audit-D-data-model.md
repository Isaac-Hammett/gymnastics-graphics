# Audit D: Data Model Edge Cases

**Date:** 2026-02-01
**Category:** D — Data Model Edge Cases
**Result:** 5 PASS / 3 FAIL / 2 INFO

---

## D1: No RTN ID — skip-and-continue logic

**Status:** FAIL

**Question:** Does Task 5 `ingestCompetitionStats` explicitly check for missing `rtnId` before calling fetch functions, with documented skip-and-continue logic?

**Finding:** Task 5 says "no fallback — rtnId must be set during Media Manager setup" and "Handles partial failures: records per-endpoint errors, continues with remaining endpoints/teams." The skip-and-continue logic for missing rtnId is **implied** but not **explicit**. The phrase "continues with remaining endpoints/teams" refers to endpoint-level failures, not the specific case where `rtnId` is null/missing for a team.

The Technical Plan Section 5.4 (Error Handling) does list:
> "No `rtnId` in teamsDatabase | Log error and skip that team"

But Task 5 in the Implementation Plan doesn't include this guidance directly.

**Recommendation:** Add to Task 5 after "no fallback": "If `rtnId` is missing or null for a team, log warning, write error to `meta.errors` for that team, skip all RTN API calls for that team, and continue with remaining teams."

---

## D2: Tri/Quad meets — team3-team6 handling

**Status:** PASS

**Question:** Does the plan handle team3-team6 for multi-team meets?

**Finding:** DashboardPage.jsx config defaults include full fields for teams 1-6:
```javascript
team3Ave: '0.000',
team3High: '0.000',
team3Con: '0%',
team3Coaches: 'Coach Name',
// ... through team6
```

Task 6 explicitly states: "Must handle team3-team6 for tri/quad/multi-team meets (config has placeholder fields for up to 6 teams)."

Live Firebase confirms `team3Ave` exists (value `"0.000"` at `competitions/z1fxcup2/config/team3Ave`).

---

## D3: Men's 6 events vs Women's 4 events

**Status:** PASS (with INFO)

**Question:** Do Tasks 3-4 reference gender-specific event mappings?

**Finding:** The Technical Plan Section 3.1 has comprehensive event mapping tables for both genders across all endpoint types (consistency, MVP, top scores, highs/avgs, individual rankings). Task 4 says "Gender-aware event code translation (see PLAN section 3.1)." Task 3 says "Export constants for event mappings and type codes."

**INFO:** Task 4's examples only list women's field names (`vts`/`ubs`/`bbs`/`fxs`, `maxv`/`maxub`/`maxbb`/`maxfx`). Men's field names (`phs`/`srs`/`pbs`/`hbs`, `maxph`/`maxsr`/`maxpb`/`maxhb`) are in Section 3.1 but not repeated in Task 4. Task 3 does not cross-reference Section 3.1. Minor documentation gap — the information exists but isn't fully surfaced in task descriptions.

**Recommendation:** Add "(women's 4 events, men's 6 events)" note to Task 3 and add men's field name examples to Task 4.

---

## D4: Concurrent stats refresh — race condition on shared store

**Status:** FAIL

**Question:** If two competitions with the same team refresh simultaneously, what prevents conflicting writes to `teamsDatabase/stats/{teamKey}/`?

**Finding:** Section 5.3 describes per-competition rate limiting: "Rate limiting is **per-competition** (one ingestion at a time per compId). If two producers create competitions simultaneously, each gets its own serial queue." This addresses per-competition serialization but NOT cross-competition writes to the same `teamsDatabase/stats/{teamKey}/` path.

**Scenario:**
1. Producer A creates Competition X with Oklahoma
2. Producer B creates Competition Y with Oklahoma (seconds later)
3. Both check staleness for `teamsDatabase/stats/oklahoma-womens/` — both find stale
4. Both fetch RTN data for Oklahoma (doubling API calls)
5. Both write to `teamsDatabase/stats/oklahoma-womens/` — last-write-wins

**Impact:** Low severity in practice — both writes contain the same RTN data (fetched seconds apart), so the race condition produces correct data. The main cost is duplicate RTN API calls. However, `meta.fetchedAt` could be inconsistent with the actual data if writes interleave.

**Recommendation:** Add a lightweight deduplication check: before starting ingestion for a team, re-check `meta.fetchedAt`. If it was updated in the last 60 seconds (another ingestion just completed), skip. This avoids the race without requiring distributed locks. Add this guidance to Task 5 and Section 5.3.

---

## D5: Staleness timezone — UTC vs local

**Status:** INFO

**Question:** Does the plan specify UTC for `fetchedAt` timestamps and staleness comparison?

**Finding:** The plan uses ISO format (`fetchedAt: string // ISO timestamp`) which implies UTC, but never explicitly states "all timestamps use UTC." The existing server code consistently uses `new Date().toISOString()` (which produces UTC), e.g., `server/index.js:874`.

The client-side hook (Task 8) says `isStale computed from meta.fetchedAt > 24h ago` — `new Date(isoString).getTime()` correctly handles UTC regardless of client timezone.

**Conclusion:** The design is correct (ISO strings are UTC), but should be documented explicitly to prevent implementation mistakes.

**Recommendation:** Add to Section 5.5: "All `fetchedAt` timestamps use UTC via `new Date().toISOString()`. Staleness comparison: `Date.now() - new Date(fetchedAt).getTime() > STALENESS_TTL`."

---

## D6: `_locks` path null — first-time handling

**Status:** FAIL

**Question:** Does `syncStatsToConfig` (Task 6) handle `_locks === null` when no locks have ever been set?

**Finding:** Task 6 says "Reads `competitions/{compId}/config/_locks` to check for manual overrides" and "Skips locked fields entirely." There is NO mention of handling `_locks` being null/undefined (the case for every new competition before any field is locked).

Without explicit guidance, a developer could write:
```javascript
const locks = (await db.ref(`.../_locks`).once('value')).val();
if (!locks.team1Ave) { ... } // CRASHES if locks is null
```

**Recommendation:** Add to Task 6: "If `_locks` path is null (no locks set yet), treat all fields as unlocked. Read `_locks` as `(await ref.once('value')).val() || {}` to safely handle the null case."

---

## D7: Name mismatches — RTN vs Virtius athlete names

**Status:** PASS

**Question:** Is `rtnId` available on both the Virtius side (headshots) and the RTN stats side (individualHighs, mvp, etc.)?

**Finding:** Yes, the design correctly uses ID-based joins:
- **Virtius side:** Task 1-2 store `rtnId` in `teamsDatabase/headshots/{name}/rtnId` during Media Manager setup
- **RTN side:** Task 4 normalizes all athlete records to include `rtnId` (mapped from endpoint-specific fields: `id`, `gid`, `gymnast_id`)
- **AI matching:** Section 7.1 says "matches RTN stats to the Virtius roster using the `rtnId` stored in `teamsDatabase/headshots/{name}/rtnId`. Unmatched athletes are included by name but flagged as 'unverified match.'"

Name mismatches (e.g., "Mackenzie" vs "Kenzie") are irrelevant because joining is by ID, not by name.

---

## D8: Empty API responses — distinguishing empty from error

**Status:** FAIL

**Question:** Does normalization handle empty input? Does `meta.endpointStatus` distinguish "empty" from "error"?

**Finding:** The plan's `meta.endpointStatus` tracks `"ok"` or `"error"` per endpoint. Section 5.4 says:
> "The UI distinguishes between 'no data available' (endpoint returned empty) and 'fetch failed' (endpoint errored) via `meta.endpointStatus`"

But `endpointStatus` only has two values (`"ok"`, `"error"`). There's no `"empty"` status. A 200 OK response with `[]` or `{}` would be recorded as `"ok"` even though there's no useful data.

The error handling table (Section 5.4) lists 404, 500, timeout, and missing rtnId scenarios but does NOT include "200 OK with empty response body."

Normalization functions (Task 4) don't specify how to handle empty arrays/objects as input.

**Recommendation:**
1. Add `"empty"` as a third `endpointStatus` value: `"ok"` = data present, `"empty"` = 200 but no data, `"error"` = fetch failed
2. Add to Task 4: "Normalization functions must handle empty input gracefully — return null for empty arrays/objects"
3. Add to Section 5.4: "200 OK with empty body → record status as 'empty', store null for that category"
4. Clarify `meta.status` logic: all endpoints "empty" should still be "complete" (fetch succeeded, team just has no data yet)

---

## D9: RTN year rollover — how year is determined

**Status:** INFO

**Question:** Is the `year` parameter hardcoded or computed? What happens during off-season?

**Finding:** Existing code uses `new Date().getFullYear()` as default:
```javascript
// show-controller/src/lib/roadToNationals.js:256
export async function fetchTeamDashboard(teamId, gender = 'womens', year = new Date().getFullYear())
```

The plan's function signatures (Section 5.2) accept `year` as a parameter but don't specify the default. Section 9 notes "Year rollover — The `year` parameter must match the current season" but provides no implementation guidance.

The gymnastics season runs January–April, so `new Date().getFullYear()` is correct (the competition year matches the calendar year). This is unlike sports like football where the season spans two calendar years.

**Recommendation:** Add to Task 3: "Default `year` to `new Date().getFullYear()`. Document that NCAA gymnastics season year = calendar year (Jan-Apr)."

---

## D10: Config field types — strings vs numbers

**Status:** PASS

**Question:** Are `team{N}Ave`, `team{N}High`, `team{N}Con` strings or numbers?

**Finding:** All config fields are **strings** in every layer:

| Layer | Evidence |
|-------|----------|
| **Live Firebase** | `team1Ave: "311.100"`, `team1High: "320.700"`, `team1Con: "#1"` (competition `z1fxcup2`) |
| **DashboardPage defaults** | `team1Ave: '0.000'`, `team1High: '0.000'`, `team1Con: '0%'` |
| **RTN API response** | `ave: "197.783"`, `high: "198.425"` (strings from RTN) |
| **Plan schema** | `ave: string`, `high: string` (Section 2.1) |
| **Plan sync** | `team{N}Con` written as `"#" + teamRanking.rank` (Section 8.3) |

`syncStatsToConfig` can pass RTN strings directly to config fields without type coercion. No mismatch risk.

---

## Summary

| # | Edge Case | Result | Finding |
|---|-----------|--------|---------|
| D1 | No RTN ID — skip-and-continue | FAIL | Task 5 implies but doesn't explicitly document skip logic for missing rtnId |
| D2 | Tri/Quad meets — team3-team6 | PASS | Config supports 6 teams; Task 6 explicitly mentions team3-team6 |
| D3 | Men's 6 events vs Women's 4 | PASS | Section 3.1 has full tables; Task 4 references it. Minor: men's examples missing from task descriptions |
| D4 | Concurrent stats refresh | FAIL | No deduplication for same teamKey across concurrent competitions |
| D5 | Staleness timezone | INFO | ISO/UTC is implied but not explicitly documented |
| D6 | `_locks` path null | FAIL | Task 6 doesn't handle null _locks (new competitions) |
| D7 | Name mismatches | PASS | rtnId-based joins avoid name matching problems entirely |
| D8 | Empty API responses | FAIL | endpointStatus lacks "empty" state; normalization doesn't specify empty input handling |
| D9 | RTN year rollover | INFO | getFullYear() is correct but undocumented in plan |
| D10 | Config field types | PASS | All strings — plan matches reality |
