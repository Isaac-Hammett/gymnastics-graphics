# Audit F: AI Service Integration Feasibility

**Date:** 2026-02-01
**Result:** 3 PASS / 3 FAIL / 0 INFO

---

## F1: aiContextService.js data loading — PASS

**Plan claim:** Add `_loadRtnStats()` to load `competitions/{compId}/rtnStats/` at service startup.

**Actual code:** `_loadCompetitionData()` at `aiContextService.js:1847` loads:
1. `competitions/${compId}/config` → `this._competitionConfig`
2. `competitions/${compId}/teamData` → `this._teamData`

**Lifecycle:** `start()` (line 174) → `_loadCompetitionData()` → `setInterval(_updateContext)`.

**Finding:** Adding `_loadRtnStats()` is straightforward. It would:
1. Be called inside `start()` after `_loadCompetitionData()` (or at end of `_loadCompetitionData()`)
2. Read `competitions/${compId}/rtnStats/` → `this._rtnStats`
3. Use the same `getDb()` + `.ref().once('value')` pattern

The integration point is clear and non-disruptive. No code changes needed to existing methods to accommodate the new data source.

---

## F2: aiSuggestionService.js data access — PASS

**Plan claim:** aiSuggestionService reads `team{N}Ave`/`team{N}High` from config and can be enhanced with RTN stats.

**Actual code:** `buildContext()` at `aiSuggestionService.js:1255`:
- Has full Firebase access via `db` parameter (from `generateSuggestions()` line 1366)
- Reads `competitions/{compId}/config`, `teamsDatabase/teams`, `competitions/{compId}/teamData`
- `analyzeTeamStats()` at line 925 reads `team{slot}Ave` and `team{slot}High` from config

**Finding:**
- The service CAN read `teamsDatabase/stats/{teamKey}/` — same `db.ref()` pattern
- Existing `CONFIDENCE_FACTORS.HAS_TEAM_STATS` (line 49, value 0.1) already provides a bonus when stats are available
- The plan's proposed `HAS_RTN_STATS: +0.15` would be a NEW factor alongside the existing one
- No architectural blockers — just add a new read in `buildContext()` and new confidence factors

---

## F3: Talking point priority system — FAIL

**Plan claim:** Tasks 18-21 specify talking point priority as "Priority: normal" for most generators and "Priority: high" for matchups.

**Actual code:** `PRIORITY` at `aiContextService.js:74`:
```javascript
const PRIORITY = {
  CRITICAL: 'critical',   // Must mention
  HIGH: 'high',           // Should mention if time allows
  MEDIUM: 'medium',       // Nice to have
  LOW: 'low',             // Background info only
};
```

**Finding:** There is NO `NORMAL` priority value. The plan's "Priority: normal" does not match any existing priority level. The intended mapping is:
- Plan's "normal" → should be `PRIORITY.MEDIUM` (`'medium'`)
- Plan's "high" → matches `PRIORITY.HIGH` (`'high'`)

**Fix required:** Update plan Tasks 18, 19, 20, 21 to use correct priority names: `MEDIUM` instead of "normal", `HIGH` instead of "high". Reference the `PRIORITY` constant from `aiContextService.js:74`.

---

## F4: Athlete matching feasibility — FAIL

**Plan claim (Task 18):** "Using RTN ID to match athletes to Virtius roster" and (Section 7.1): "matches RTN stats to the Virtius roster using the `rtnId` stored in `teamsDatabase/headshots/{name}/rtnId`."

**Actual code:**
- `_loadCompetitionData()` loads `this._teamData` from `competitions/{compId}/teamData`
- `teamData` roster entries have Virtius athlete data (firstName, lastName, fullName, year, etc.)
- `teamData` roster entries currently have NO `rtnId` (confirmed in audit A5/B-CRIT)
- After B-CRIT fix, `enrichTeamsWithRTN()` will populate `rtnId` in `teamData/team{N}/roster[]/id` (Virtius ID, not RTN ID) and `teamData/team{N}/rtnId` (team RTN ID)
- aiContextService does NOT load `teamsDatabase/headshots/` at all
- The `_getAthleteFromRoster()` method (line 1772) matches by name only, not by ID

**The problem:**
1. The plan says match via `teamsDatabase/headshots/{name}/rtnId` — but aiContextService doesn't load headshots
2. The rtnStats snapshot (`competitions/{compId}/rtnStats/team{N}/individualHighs/`) has athlete records with `rtnId`
3. But `this._teamData` roster entries don't have RTN athlete IDs (only Virtius IDs)
4. There's a disconnect: rtnStats has RTN athlete IDs, teamData has Virtius athlete IDs

**Fix required:** The plan must specify one of:
- **(a)** Load headshots data in `_loadRtnStats()` to get the `rtnId` mapping (adds a Firebase read)
- **(b)** After Task 1 (B-CRIT fix), `enrichTeamsWithRTN()` stores per-athlete RTN IDs from `dashboard.roster[].id` into teamData. Use this as the join key. (Preferred — no extra Firebase read)
- **(c)** Store per-athlete RTN IDs in the rtnStats snapshot during ingestion, then match by name as fallback

Recommended: Option (b) — the enrichment already processes dashboard roster. After the B-CRIT fix populates `rtnId` on teamData athlete records, aiContextService can join `this._teamData.team{N}.roster[].rtnId` ↔ `this._rtnStats.team{N}.individualHighs[].rtnId`.

---

## F5: Graceful degradation — PASS

**Plan claim (Task 18):** "Null-check each stats field since partial ingestion means some may be missing."

**Actual code patterns:**
- `_getBasicTalkingPoints()` (line 460): returns `[]` when data is missing
- `_getTeamIntroTalkingPoints()` (line 645): safely handles missing `_teamData` with `if (!this._teamData)`
- `_getMatchupTalkingPoints()` (line 842): checks `if (!this._teamData) return points`
- `_getAchievementTalkingPoints()` (line 330): iterates over array, safe with empty input

**Finding:** The codebase has a consistent pattern for null-safe data access:
1. Check `if (!this._dataSource) return []`
2. Use optional chaining (`data?.field`)
3. Filter/iterate safely over potentially empty arrays

New RTN generators should follow this pattern. If `this._rtnStats` is null (old competition, never ingested), all `_get*TalkingPoints()` methods return `[]`. The overall system works — just fewer talking points.

The plan's guidance is adequate. No changes needed.

---

## F6: Token/context budget — FAIL

**Plan claim (Tasks 18-21):** Add 6 new talking point generators. Plan doesn't address how they compete with existing generators for the 5-slot budget.

**Actual code:**
- `maxTalkingPoints: 5` at line 87 (DEFAULT_CONFIG)
- `_generateSegmentContext()` at line 273:
  1. Collects ALL talking points from all generators
  2. Sorts by priority: `critical > high > medium > low`
  3. Slices to `this.config.maxTalkingPoints` (default 5)

**Current generators that produce talking points:**
1. Score-based (line 389): Produces CRITICAL (10.0 score), HIGH (standings, close margin), MEDIUM (large margin), LOW (rotation)
2. Achievement-based (line 330): Produces CRITICAL (career high, record broken), HIGH (season high, record tied)
3. Basic/segment-based (line 460): Produces HIGH (notes, opening, closing, seniors), MEDIUM (rotation, event tips, coaching, freshmen, break)

**Impact of new RTN generators at MEDIUM priority:**
- During active scoring, existing generators produce 2-4 HIGH/CRITICAL points (standings, recent high scores, achievements)
- These would consume most of the 5 slots
- RTN-based generators at MEDIUM priority would be pushed out
- Only during non-scoring segments (intro, break) would RTN generators surface

**Fix required:** The plan must address talking point slot competition. Options:
1. **Increase `maxTalkingPoints`** to 8-10 during non-scoring segments
2. **Reserve slots** — e.g., always include at least 1 RTN-based point if available
3. **Segment-aware generation** — only generate RTN points for relevant segments (intro, break, rotation start) and skip during active scoring
4. **Priority tuning** — assign some RTN generators HIGH priority (matchup comparisons are arguably as important as margin updates)

Recommended: Option (3) + (4). The matchup generator should be HIGH priority. Other RTN generators should only fire during non-scoring segments (opening, rotation start, breaks). This avoids flooding the system while ensuring RTN data surfaces.

---

## Summary

| # | Check | Result | Finding |
|---|-------|--------|---------|
| F1 | aiContextService data loading | PASS | `_loadRtnStats()` hooks into `start()` after `_loadCompetitionData()`. Clear lifecycle, straightforward integration. |
| F2 | aiSuggestionService data access | PASS | Has Firebase access via `db` param. Can read `teamsDatabase/stats/`. Existing `HAS_TEAM_STATS` factor provides precedent for new `HAS_RTN_STATS`. |
| F3 | Talking point priority system | FAIL | Plan uses "Priority: normal" — no such value exists. Must use `MEDIUM` (from `PRIORITY` constant at line 74). |
| F4 | Athlete matching feasibility | FAIL | Plan says match via `teamsDatabase/headshots/{name}/rtnId` but aiContextService doesn't load headshots. Must use teamData roster rtnId (available after B-CRIT fix) instead. |
| F5 | Graceful degradation | PASS | Existing null-safe patterns (`if (!data) return []`, optional chaining) provide clear template. Plan guidance adequate. |
| F6 | Token/context budget | FAIL | 5-slot `maxTalkingPoints` limit means MEDIUM-priority RTN generators will be crowded out by existing HIGH/CRITICAL generators during scoring. Plan must address slot competition. |
