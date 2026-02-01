# Audit G: Plan Document Consistency

**Date:** 2026-02-01
**Result:** 6 PASS / 2 FAIL / 0 INFO

---

## G1: Task count matches

**Result: PASS**

Implementation.md lists 24 tasks across 5 phases:
- Phase 1: Tasks 1-7 (7 tasks)
- Phase 2: Tasks 8-14 (7 tasks)
- Phase 3: Tasks 15-17 (3 tasks)
- Phase 4: Tasks 18-21 (4 tasks)
- Phase 5: Tasks 22-24 (3 tasks)
- Total: 24

PRD Section 4 lists identical phase-to-task ranges:
- Phase 1: 1-7, Phase 2: 8-14, Phase 3: 15-17, Phase 4: 18-21, Phase 5: 22-24

Both documents agree on 24 tasks.

---

## G2: Task descriptions align with technical plan

**Result: PASS**

Key task-to-section mappings verified:

| Task | Technical Plan Section | Alignment |
|------|----------------------|-----------|
| Task 3 (fetch functions) | Section 5.2 (Core Functions) | Match |
| Task 4 (normalization) | Section 3.1 (Event Code Translation) | Match |
| Task 5 (orchestration) | Sections 5.1-5.4 (Service Design) | Match |
| Task 6 (syncStatsToConfig) | Section 8.3 (Config Auto-Sync) | Match |
| Task 7 (socket events) | Section 4 (Socket Events) | Match |
| Task 8 (useRtnStats) | Section 6.1 (Hook: useRtnStats) | Match |
| Task 15 (league rankings) | Section 2.3 + 5.2 | Match |
| Tasks 18-21 (AI) | Section 7.1 (aiContextService Enhancements) | Match |

All task descriptions reference correct technical plan sections.

---

## G3: Firebase paths consistent

**Result: PASS**

All Firebase paths referenced in Implementation tasks match Technical Plan Section 2:

| Path | Tech Plan Section | Impl Tasks |
|------|-------------------|------------|
| `teamsDatabase/stats/{teamKey}/` | 2.1 | Tasks 5, 7, 8 |
| `competitions/{compId}/rtnStats/` | 2.2 | Tasks 7, 8, 18 |
| `competitions/{compId}/config/_locks` | 2.4 | Tasks 6, 11, 14 |
| `rtnCache/rankings/{gender}-{year}-{week}/` | 2.3 | Tasks 15, 16 |
| `teamsDatabase/teams/{teamKey}/rtnId` | 2.5 | Tasks 1, 5 |
| `teamsDatabase/headshots/{name}/rtnId` | 2.5 | Task 2 |

No path mismatches found.

---

## G4: Socket event names consistent

**Result: PASS**

Technical Plan Section 4 defines 6 socket events. All are referenced consistently in implementation tasks:

| Event | Direction | Tech Plan | Impl Tasks |
|-------|-----------|-----------|------------|
| `ingestRtnStats` | Client→Server | Section 4.1 | Tasks 7, 9 |
| `refreshRtnStats` | Client→Server | Section 4.1 | Tasks 7, 8, 13 |
| `fetchLeagueRankings` | Client→Server | Section 4.1 | Task 16 |
| `rtnStatsResult` | Server→Client | Section 4.2 | Tasks 7, 8, 9 |
| `rtnStatsProgress` | Server→Client | Section 4.2 | Tasks 5, 8 |
| `leagueRankingsResult` | Server→Client | Section 4.2 | Task 16 |

No naming inconsistencies found.

---

## G5: Success criteria coverage

**Result: PASS**

Every PRD Section 5 success criterion maps to at least one implementation task:

### Phase 1 (8 criteria → 7 tasks)
- RTN IDs captured → Tasks 1, 2
- Server fetches 8 endpoints → Tasks 3, 5
- Data normalized → Task 4
- Competition snapshot → Task 7
- Auto-sync Ave/High → Task 6
- Socket events functional → Task 7
- Rate limiting → Task 3
- Partial failures handled → Tasks 4, 5

### Phase 2 (7 criteria → 7 tasks)
- useRtnStats hook → Task 8
- Auto-fetch on creation → Task 9
- Auto-refresh before show → Task 13
- Stats indicator on Dashboard → Task 10
- Refresh button → Task 10
- Manual override locks → Task 11
- RTN indicator on fields → Task 12

### Phase 3 (5 criteria → 3 tasks)
- Team rankings cached → Task 15
- Week-based cache → Task 15
- Individual rankings → Task 15
- useLeagueRankings hook → Task 16
- AI references rankings → Task 17

### Phase 4 (4 criteria → 4 tasks)
- Athlete stats talking points → Task 18
- Consistency trends → Task 19
- Head-to-head matchups → Task 20
- MVP/lineup context → Task 21

### Phase 5 (4 criteria → 3 tasks)
- Stats ingestion E2E test → Task 22
- Config lock test → Task 23
- AI talking points test → Task 24
- Tests on production → All 3 tasks

---

## G6: Verification checklist completeness

**Result: FAIL**

The Implementation Plan verification checklist covers most PRD acceptance criteria, but two gaps exist:

### Gap 1: PRD Story 2 & 3 — Individual athlete stats UI display

PRD Story 2 acceptance criterion: "All 8 RTN stat categories displayed per team"
PRD Story 3 acceptance criteria:
- "Individual averages and highs displayed per athlete per event"
- "Athletes matched by RTN ID"
- "Lineup rate shown per athlete"
- "Athletes sortable/filterable by event"

**No implementation task creates a detailed stats display panel.** The data pipeline stores all stats (Tasks 3-5), and the AI consumes them (Tasks 18-21), but there is no task to build a UI where producers can browse per-team stats (consistency trends, MVP standings, top scores, lineup frequency) or per-athlete stats (averages, highs, lineup rate). Task 10 only adds a status indicator and refresh button. Task 17 adds league rankings display, but not per-team/per-athlete detail.

**Fix:** Either add a new task for the stats detail panel UI, or acknowledge this as a deliberate scope cut and update the PRD Stories 2/3 accordingly.

### Gap 2: PRD Story 2 — "Data persists in Firebase across sessions"

This is implicit in the Firebase architecture but not explicitly in the verification checklist. Minor — no fix needed.

---

## G7: File references — CREATE vs MODIFY lists

**Result: FAIL**

Technical Plan Section 10 lists `aiSuggestionService.js` as **MODIFY** and Section 7.2 describes specific enhancements:
- New confidence factors: `HAS_RTN_STATS` (+0.15), `HAS_INDIVIDUAL_STATS` (+0.1), `HAS_RANKINGS` (+0.05)
- New segment suggestions: "Athlete Spotlight", "Event Preview", "Senior Feature"

**No implementation task modifies `aiSuggestionService.js`.** Tasks 18-21 all target `aiContextService.js` only.

**Fix:** Either add a task for `aiSuggestionService.js` enhancements, or remove it from Technical Plan Section 10 MODIFY list and remove Section 7.2 description. Recommendation: add a task since the enhancements described in Section 7.2 are meaningful for pre-show planning (aiSuggestionService is used for segment suggestions, not live talking points).

---

## G8: Task dependency ordering

**Result: PASS**

Dependency chain verified:
1. Tasks 1-2: RTN ID capture (prerequisite for all RTN API calls)
2. Tasks 3-4: Fetch/normalize infrastructure (no dependency on live IDs for code creation)
3. Task 5: Orchestration (depends on Tasks 3-4 functions)
4. Task 6: Config sync (depends on Task 5 data in Firebase)
5. Task 7: Socket wiring (depends on Tasks 5-6 functions)
6. Tasks 8-14: Client-side (depend on Task 7 socket handlers)
7. Task 15: Rankings fetch (extends Task 3 infrastructure)
8. Task 16: Rankings hook (depends on Task 15)
9. Task 17: Rankings display + AI access (depends on Task 16)
10. Tasks 18-21: AI enhancement (depend on Task 7 snapshot; Task 20 uses Task 17 rankings)
11. Tasks 22-24: E2E tests (depend on all prior tasks)

No circular dependencies. No task depends on a later task. Server (Phase 1) completes before client (Phase 2). The only cross-phase dependency is Task 20 using rankings from Task 17, which is in Phase 3 (before Phase 4). Correct ordering.

---

## Summary

| # | Check | Result | Finding |
|---|-------|--------|---------|
| G1 | Task count matches | PASS | 24 tasks, 5 phases, identical in both docs |
| G2 | Task-to-section alignment | PASS | All tasks map to correct technical plan sections |
| G3 | Firebase paths consistent | PASS | All 6 path families match between docs |
| G4 | Socket event names consistent | PASS | All 6 events match between docs |
| G5 | Success criteria coverage | PASS | Every PRD criterion maps to at least one task |
| G6 | Verification checklist completeness | FAIL | PRD Stories 2/3 athlete stats detail UI has no implementation task |
| G7 | File references CREATE/MODIFY | FAIL | `aiSuggestionService.js` listed as MODIFY but no task covers it |
| G8 | Task dependency ordering | PASS | No circular deps, correct phase ordering |
