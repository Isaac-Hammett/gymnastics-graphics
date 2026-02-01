# PRD-RTN-Stats-Integration Pre-Implementation Audit

## PURPOSE

Audit the plan against the real codebase, live Firebase data, and live RTN API responses. Find every gap, wrong assumption, and missing edge case BEFORE coding starts. Each iteration audits ONE CATEGORY — batching all related checks together — then writes findings to the audit log, updates the plan docs, and commits.

When all categories pass, set `Audit: COMPLETE` on the status line of `PLAN-RTN-Stats-Integration-Implementation.md`.

---

## RULES

**ONE CATEGORY = ONE ITERATION**

Each iteration fully audits one category (A through G). Within a category:
1. Run ALL checks for that category (read files, query Firebase, test endpoints)
2. Collect all findings
3. Write/update tests for testable findings
4. Patch plan docs for every incorrect assumption
5. Log ALL findings for that category in `AUDIT-LOG.md`
6. Commit and STOP

**Do NOT:**
- Audit multiple categories in one iteration
- Modify application source code (only `docs/PRD-RTN-Stats-Integration/` files)
- Skip a finding because it seems minor — log everything
- Mark a category done if any check could not be verified

**Output discipline:**
- After each check, print a one-line PASS/FAIL/INFO result
- At end of category, print a summary table
- If ANY check fails, list the exact plan doc section + line that needs updating

---

## Phase 1: Load Context & Determine Next Category

Read these files to understand current state:

- [ ] **1.1** Read `docs/PRD-RTN-Stats-Integration/AUDIT-LOG.md`
  → Determine which categories are already audited
  → Identify the NEXT unaudited category (A → B → C → D → E → F → G)

- [ ] **1.2** Read `docs/PRD-RTN-Stats-Integration/PRD-RTN-Stats-Integration-2026-02-01.md`
- [ ] **1.3** Read `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-Implementation.md`
- [ ] **1.4** Read `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-2026-02-01.md`

**Output:**
```
Phase 1 Complete
- Categories done: [list or "none"]
- Next category: [A/B/C/D/E/F/G]
- Issues found so far: [count from audit log]
```

---

## Phase 2: Execute Category Checks

### Category A: Live Firebase Data vs Plan Schema

**Goal:** Verify every Firebase path the plan references. Use `firebase_get` and `firebase_list_paths` MCP tools to inspect REAL data.

**Step 1 — Find a real competition and team to use as test fixtures:**
- Use `firebase_list_paths` on `competitions/` to find a recent compId
- Use `firebase_list_paths` on `teamsDatabase/teams/` to find a known team key (e.g., `oklahoma-womens`)
- Record these as test fixtures for all subsequent checks

**Step 2 — Check each path:**

| # | Path | Plan Says | Check With | Expected Result |
|---|------|-----------|------------|-----------------|
| A1 | `teamsDatabase/teams/{teamKey}` | Has fields: displayName, gender, logo, school, roster, updatedAt | `firebase_get` with real teamKey | List actual fields. Does `rtnId` exist yet? |
| A2 | `teamsDatabase/headshots/{name}` | Has fields: name, teamKey, url, updatedAt | `firebase_get` with a real athlete name | List actual fields. Does `rtnId` exist yet? |
| A3 | `teamsDatabase/stats/{teamKey}/` | Plan creates this NEW path | `firebase_get` | Should be null/empty. If something exists, plan has a conflict. |
| A4 | `competitions/{compId}/config` | Has team1Ave, team1High, team1Con, team1Coaches etc. | `firebase_get` with real compId | List ALL field names. Confirm Ave/High/Con exist and are strings. |
| A5 | `competitions/{compId}/teamData` | Populated by enrichTeamsWithRTN() | `firebase_get` with real compId | What structure? Does it contain `rtnId` for teams? For athletes? |
| A6 | `competitions/{compId}/config/_locks` | Plan creates this NEW path | `firebase_get` | Should be null. Check if existing code iterates `config` children (would `_locks` break anything?). |
| A7 | `rtnCache/` | Existing dashboards cache at `rtnCache/dashboards/` | `firebase_list_paths` on `rtnCache/` | What's already there? Will new `rankings/` path coexist? |
| A8 | `competitions/{compId}/rtnStats/` | Plan creates this NEW path for show-start snapshot | `firebase_get` | Should be null. No conflicts. |

**Step 3 — For each finding, determine:**
- PASS: Plan matches reality
- FAIL: Plan assumption is wrong → update plan doc with correct info
- INFO: Neither right nor wrong, but worth noting (e.g., "field exists but is always empty")

**Step 4 — Write test file** `docs/PRD-RTN-Stats-Integration/tests/audit-A-firebase-paths.md`:
Document every path checked, what was found, and whether the plan needs adjustment. This is a markdown report, not a Jest test — Firebase checks require live MCP tools.

---

### Category B: RTN API Endpoint Verification

**Goal:** Hit every RTN endpoint the plan references with real data and verify response shapes match plan assumptions.

**Step 1 — Get a real RTN team ID:**
- Read `show-controller/src/lib/roadToNationals.js` to understand how `getTeamId()` works
- Use `firebase_get` on `rtnCache/dashboards/` to find a cached dashboard with a known team ID
- OR use `WebFetch` on `https://www.roadtonationals.com/api/womens/dashboard/2026/{tid}` with a known team
- Record the team ID (tid) and gender for all subsequent checks

**Step 2 — Test each endpoint:**

| # | Endpoint | Plan Reference | Test URL | Verify |
|---|----------|---------------|----------|--------|
| B1 | Dashboard | Plan Section 6, PRD Section 6 | `/womens/dashboard/2026/{tid}` | Does response include athlete RTN IDs? (Plan assumes Virtius provides these — but does RTN dashboard also?) |
| B2 | Consistency | `fetchConsistency()` | `/womens/teamConsistency/2026/{tid}` | Response has `vts`, `ubs`, `bbs`, `fxs` arrays? Labels array? |
| B3 | MVP | `fetchMVP()` | `/womens/mvp/2026/{tid}` | Response has per-athlete event totals? Floating-point artifacts? |
| B4 | Top Scores | `fetchTopScores()` | `/womens/topscores/2026/{tid}` | Response has theoretical max? Per-event top 5? |
| B5 | Lineup | `fetchLineup()` | `/womens/lineup/2026/{tid}` | Response has binary meets arrays? Athlete names? |
| B6 | Individual Highs | `fetchIndividualHighs()` | `/womens/rostermain/2026/{tid}/2` | Response shape? Negative score handling for men? |
| B7 | Individual Averages | `fetchIndividualAverages()` | `/womens/rostermain/2026/{tid}/3` | Response shape matches highs? |
| B8 | Team Rankings | `fetchTeamRanking()` | `/womens/results/2026/{week}/0/5` | Response has rank, ave, high, rqs? How to find current week? |
| B9 | Individual Rankings | Per-event rankings | `/womens/results/2026/{week}/1/1` | Large response (~500 athletes)? Verify field names. |
| B10 | Week Discovery | `getCurrentWeek()` | `/womens/results/2026/1/0/5` | Does `schema.weeks` exist? Is `current: "1"` the right field? |

**Step 3 — CRITICAL: Verify RTN ID source:**
- Plan says RTN IDs come from Virtius API during Media Manager setup
- Read `show-controller/src/pages/MediaManagerPage.jsx` — where does it fetch Virtius data?
- Read `show-controller/src/hooks/useCompetitions.js` `enrichTeamsWithRTN()` — does it have access to RTN IDs?
- Read `show-controller/src/lib/roadToNationals.js` `fetchTeamDashboard()` — does the dashboard response include per-athlete RTN IDs?
- If Virtius does NOT provide RTN IDs, this is a **BLOCKER** — the entire plan depends on this

**Step 4 — Write findings** to `docs/PRD-RTN-Stats-Integration/tests/audit-B-rtn-api.md`:
Include actual API response snippets (trimmed) for each endpoint. Flag any field name mismatches.

---

### Category C: Existing Code Assumptions

**Goal:** Verify every claim the plan makes about existing code.

Read each file and check specific assertions:

| # | Plan Claim | File to Check | What to Look For |
|---|-----------|---------------|------------------|
| C1 | "enrichTeamsWithRTN() only syncs coach names to config" | `useCompetitions.js` lines 110-224 | Does it also write Ave/High/Con? Or just teamData? |
| C2 | "team{N}Ave and team{N}High are manually entered" | `DashboardPage.jsx` | Are these fields ever auto-populated? Any existing sync? |
| C3 | "Media Manager doesn't capture RTN IDs" | `MediaManagerPage.jsx` | Search for `rtnId`. Does Virtius import include it? |
| C4 | "aiContextService.js doesn't use RTN stats" | `server/lib/aiContextService.js` | What data does `_loadCompetitionData()` or equivalent fetch? |
| C5 | "aiSuggestionService.js reads team1Ave/team1High from config" | `server/lib/aiSuggestionService.js` | Find `analyzeTeamStats()` — what fields does it read? |
| C6 | "server/lib/rtnStatsService.js needs to be CREATED" | `server/lib/` | Does this file already exist? |
| C7 | "useRtnStats.js needs to be CREATED" | `show-controller/src/hooks/` | Does this file already exist? |
| C8 | "useLeagueRankings.js needs to be CREATED" | `show-controller/src/hooks/` | Does this file already exist? |
| C9 | "showStarted handler exists in server/index.js" | `server/index.js` | Find `showStarted` — what does it do today? Where to add snapshot logic? |
| C10 | "Socket events use room-based broadcasting" | `server/index.js` | Find pattern: `io.to('competition:${compId}').emit()`. Is this the standard? |
| C11 | "productionConfigService uses getDb() pattern" | `server/lib/productionConfigService.js` | Confirm Firebase Admin access pattern for new service to follow |
| C12 | "enrichTeamsWithRTN writes to teamData, not config" | `useCompetitions.js` | Does enrichment touch config fields at all? Or only `competitions/{compId}/teamData`? |

**Write findings** to `docs/PRD-RTN-Stats-Integration/tests/audit-C-existing-code.md`.

---

### Category D: Data Model Edge Cases

**Goal:** Identify edge cases the plan doesn't address. For each, either confirm the plan handles it or add handling to the plan.

| # | Edge Case | Question | How to Verify |
|---|-----------|----------|---------------|
| D1 | No RTN ID | Team has no `rtnId` (club team, new team, import failure) | Plan says "log warning, skip" — but does Task 5 `ingestCompetitionStats` actually check this before calling fetch functions? Is the skip-and-continue logic documented in each task? |
| D2 | Tri/Quad meets | Plan says team1, team2 — what about team3-team6? | Read `DashboardPage.jsx` config fields. Does `syncStatsToConfig` loop over all teams or just 1-2? Check plan Task 6 description. |
| D3 | Men's 6 events vs Women's 4 | Normalization must handle both | Plan Section 3.1 covers mappings. But do Tasks 3-4 reference these mappings explicitly? |
| D4 | Concurrent stats refresh | Two competitions with the same team refresh simultaneously | Plan says "per-competition rate limiter" — but writes go to shared `teamsDatabase/stats/{teamKey}/`. Last-write-wins race condition? |
| D5 | Staleness timezone | `fetchedAt` is ISO string compared to "24 hours ago" | Server uses UTC? Client uses local? Plan should specify UTC everywhere. |
| D6 | `_locks` path null | First time — no locks exist yet | Does `syncStatsToConfig` (Task 6) handle `locks === null` as "nothing locked"? |
| D7 | Name mismatches | RTN says "Mackenzie Estep", Virtius says "Kenzie Estep" | Plan says join by `rtnId` — but what about the `fullName` fields stored in stats? Is `rtnId` really available on both sides? |
| D8 | Empty API responses | RTN returns `[]` or `{}` for a stat category | Does normalization handle empty input? Does `meta.endpointStatus` distinguish "empty" from "error"? |
| D9 | RTN year rollover | It's January — is the year 2026 or 2025 for current season? | How does the plan determine `year`? Is it hardcoded or computed? |
| D10 | Config field types | Plan writes `team1Ave` as string (e.g., "197.783") | Current config — are these strings or numbers? Mismatch would break graphics. |

**Write findings** to `docs/PRD-RTN-Stats-Integration/tests/audit-D-data-model.md`.

---

### Category E: Socket & Hook Contract Alignment

**Goal:** Verify the planned socket events and React hooks align with existing patterns.

| # | Check | How |
|---|-------|-----|
| E1 | Socket event naming convention | Read 5+ existing socket events in `server/index.js`. Are they camelCase? Do they follow `verbNoun` / `nounResult` pattern? Do planned events match? |
| E2 | `ingestRtnStats` vs `refreshRtnStats` | Plan defines both. Is the distinction clear enough for the implementation task descriptions? Could they be one event with a `force` flag? |
| E3 | `rtnStatsProgress` granularity | Emitted per-endpoint during ingestion. Does the client need this? Is there a pattern for progress events elsewhere in the codebase? |
| E4 | Room broadcasting | All new events must use `io.to('competition:${compId}').emit()`. Verify plan tasks mention this explicitly. |
| E5 | ShowContext integration | New socket events need handlers in `show-controller/src/context/ShowContext.jsx`. Is this mentioned in the implementation tasks? |
| E6 | Hook naming | `useRtnStats`, `useLeagueRankings` — do these follow the project's hook naming convention? Check existing hooks directory. |
| E7 | Hook Firebase subscription pattern | How do existing hooks subscribe to Firebase paths? `onValue` from firebase/database? Direct ref? Check `useTimesheet.js` or similar. |

**Write findings** to `docs/PRD-RTN-Stats-Integration/tests/audit-E-socket-hooks.md`.

---

### Category F: AI Service Integration Feasibility

**Goal:** Verify AI services can actually consume the planned data and that the integration points are correctly identified.

| # | Check | How |
|---|-------|-----|
| F1 | `aiContextService.js` data loading | Read the `start()` or `_loadCompetitionData()` method. Where would `_loadRtnStats()` hook in? Is the lifecycle clear? |
| F2 | `aiSuggestionService.js` data access | Read `buildContext()`. It currently reads `teamsDatabase/teams`. Can it also read `teamsDatabase/stats/`? Does it have Firebase access? |
| F3 | Talking point priority system | What priority values does aiContextService use? (CRITICAL, HIGH, MEDIUM, LOW? Or numbers?) Plan must match. |
| F4 | Athlete matching feasibility | Plan says join RTN stats to Virtius roster via `rtnId`. But aiContextService works with live Virtius data during show. Does it have access to `rtnId` on athlete records? |
| F5 | Graceful degradation | If `rtnStats` snapshot is missing (old competition, never ingested), do AI services crash or degrade? Plan Task 18 should specify null checks. |
| F6 | Token/context budget | AI talking points have a max count (`config.maxTalkingPoints`). Adding 6 new generators — will they compete with existing generators? Is there a priority system? |

**Write findings** to `docs/PRD-RTN-Stats-Integration/tests/audit-F-ai-integration.md`.

---

### Category G: Plan Document Consistency

**Goal:** Cross-reference the three plan documents to ensure they agree.

| # | Check | Files |
|---|-------|-------|
| G1 | Task count matches | Implementation.md says 24 tasks. PRD Section 4 lists phases with task ranges. Do they match? |
| G2 | Task descriptions align with technical plan | Each task in Implementation.md should map to a specific section in the Technical Plan. Verify task 3 (fetch functions) matches Section 5.2, task 4 (normalization) matches Section 3.1, etc. |
| G3 | Firebase paths consistent | Technical Plan Section 2 defines paths. Implementation task descriptions reference paths. Do they match exactly? |
| G4 | Socket event names consistent | Technical Plan Section 4 lists events. Implementation tasks reference the same names? |
| G5 | Success criteria coverage | PRD Section 5 lists success criteria per phase. Does every criterion map to at least one implementation task? |
| G6 | Verification checklist completeness | Implementation.md has a verification checklist. Does it cover every PRD acceptance criterion? |
| G7 | File references | Implementation.md lists files to CREATE vs MODIFY. Technical Plan Section 10 lists the same. Do they agree? |
| G8 | Task dependency ordering | Does any task depend on a later task? (e.g., Task 7 wires socket events — but Tasks 8-14 are client-side. Is the server fully done before client starts?) |

**Write findings** to `docs/PRD-RTN-Stats-Integration/tests/audit-G-plan-consistency.md`.

---

## Phase 3: Write Findings & Update Plan

After running all checks for the current category:

- [ ] **3.1** Write the findings report to the appropriate `tests/audit-{X}-*.md` file
- [ ] **3.2** For each FAIL finding: update the specific plan document section
  - If a Firebase path is wrong → update Technical Plan Section 2
  - If an API response shape is wrong → update Technical Plan Section 3
  - If a task description has wrong assumptions → update Implementation Plan task notes
  - If PRD acceptance criteria are missing something → update PRD
- [ ] **3.3** Update `AUDIT-LOG.md` with a category summary block:

```markdown
## Category [X]: [Name] — [DATE]

**Result:** [N PASS / N FAIL / N INFO]

| # | Check | Result | Finding |
|---|-------|--------|---------|
| X1 | [description] | PASS | [brief] |
| X2 | [description] | FAIL | [brief — what was wrong, what was fixed] |
| ... | ... | ... | ... |

**Plan docs updated:**
- [file:section — what changed]

**Tests written:**
- [file — what it validates]
```

---

## Phase 4: Commit & Check Completion

- [ ] **4.1** Commit:
  ```bash
  git add -A && git commit -m "Audit RTN-Stats: Category [X] - [summary]" && git push origin main
  ```

- [ ] **4.2** Check: Are ALL categories (A-G) complete in `AUDIT-LOG.md`?
  - **YES** → Add `Audit: COMPLETE` to `PLAN-RTN-Stats-Integration-Implementation.md` status line, commit, STOP
  - **NO** → STOP. Next iteration handles the next category.

**Output:**
```
Category [X] audit complete.
- Checks: [N pass] / [N fail] / [N info]
- Plan docs updated: [count] sections
- Categories remaining: [list]
```

---

## Quick Reference

| Resource | Location |
|----------|----------|
| PRD | `docs/PRD-RTN-Stats-Integration/PRD-RTN-Stats-Integration-2026-02-01.md` |
| Technical Plan | `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-2026-02-01.md` |
| Implementation Plan | `docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-Implementation.md` |
| Audit Log | `docs/PRD-RTN-Stats-Integration/AUDIT-LOG.md` |
| Audit Reports | `docs/PRD-RTN-Stats-Integration/tests/audit-{A-G}-*.md` |
| Existing RTN code | `show-controller/src/lib/roadToNationals.js` |
| Media Manager | `show-controller/src/pages/MediaManagerPage.jsx` |
| Competitions hook | `show-controller/src/hooks/useCompetitions.js` |
| Dashboard page | `show-controller/src/pages/DashboardPage.jsx` |
| Server socket events | `server/index.js` (lines 5792+) |
| AI context service | `server/lib/aiContextService.js` |
| AI suggestion service | `server/lib/aiSuggestionService.js` |
| Firebase Admin pattern | `server/lib/productionConfigService.js` |
| Firebase (live) | `firebase_get` / `firebase_list_paths` MCP tools |
| RTN API (live) | `WebFetch` tool — `https://www.roadtonationals.com/api/{gender}/...` |
