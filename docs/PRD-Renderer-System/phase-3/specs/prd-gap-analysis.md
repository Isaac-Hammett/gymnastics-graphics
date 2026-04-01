# Spec: PRD Gap Analysis

## What

Cross-reference between the parent PRD (`PRD-Renderer-System-2026-03-28.md`) and the Phase 3 doc (`Phase-3-Scoring-Ingestion.md`) to identify requirements that may be missing, ambiguous, or contradictory.

## PRD Requirements Applicable to Phase 3

### 1. Firebase Scoring Paths (PRD Architecture Decision 2)

| PRD Requirement | Phase 3 Doc Coverage | Gap? |
|-----------------|---------------------|------|
| `scoring/leaderboard/{apparatus}` contains sorted athlete scores | Task 2 documents this path | None |
| `scoring/teamTotals` contains running team scores | Task 2 documents this path | None |
| `scoring/rotationState` contains current rotation info | Task 2 documents this path | None |
| `scoring/allAround` contains AA rankings | Task 2 documents this path | None |
| **Write strategy:** Use `.update()` on subpaths, not `.set()` on root | Task 1 pseudocode shows `scoringRef.child('leaderboard/...).update()` | None |
| **Gender dependency:** Service reads `config/gender` to determine apparatus list | Task 1 mentions this dependency | None |
| **Men's extra fields:** Leaderboard rows include diff, exec, stickBonus for men's events | Task 2 schema shows these fields as "only present for men's events" | None |

### 2. Scoring Feed Controls (PRD Architecture Decision 3)

| PRD Requirement | Phase 3 Doc Coverage | Gap? |
|-----------------|---------------------|------|
| Competition card badge: "LIVE" (green) / "OFF" (gray) | Task 5 specifies badge states | **Minor gap:** PRD mentions "pulsing dot" for LIVE state; Phase 3 mentions "pulsing" but doesn't specify implementation |
| Click to toggle on/off | Task 5 documents click behavior | None |
| Shows poll interval: "LIVE · 15s" | Task 5 doesn't show this format | **Minor gap:** PRD example shows interval in badge; Task 5 shows "LIVE · 15s" but badge table shows separate format |
| Producer panel: On/Off toggle | Task 6 documents this | None |
| Producer panel: Interval selector (5s, 10s, 15s, 30s, 60s) | Task 6 documents dropdown | None |
| Producer panel: Last poll timestamp ("Last updated: 2s ago") | Task 6 documents "3s ago" | None |
| Producer panel: Status badge | Task 6 documents OK/Error states | None |
| Producer panel: Manual refresh button | Task 6 documents this with `forceRefresh` mechanism | None |

### 3. Auto-Stop Safety Nets (PRD Architecture Decision 3)

| PRD Requirement | Phase 3 Doc Coverage | Gap? |
|-----------------|---------------------|------|
| Competition `status` set to "completed" or "archived" → stop polling | Task 4 documents this | None |
| Virtius session returns "completed" status → stop polling | Task 4 documents checking `data.meet?.status` | None |
| No producer connected for 30+ minutes → stop polling | Task 4 mentions "30-minute timeout" with socket tracking | **Gap:** Implementation details sparse — how to track "active socket connections per competition" |

### 4. Multi-Competition Support (PRD Architecture Decision 3)

| PRD Requirement | Phase 3 Doc Coverage | Gap? |
|-----------------|---------------------|------|
| "Three live meets = three independent polling loops" | Task 1 pseudocode shows per-competition polling | None |
| "Each with their own interval and on/off state" | Task 3 documents per-competition config listener | None |

### 5. Team Logo Resolution (Phase 3 Task 1)

| PRD Requirement | Phase 3 Doc Coverage | Gap? |
|-----------------|---------------------|------|
| Look up logos from `teamsDatabase/teams` | Task 1 mentions this lookup | None |
| Fall back to Virtius API logo if no Firebase logo | Task 1 documents fallback | None |
| Cache logos in memory for the session | Task 1 mentions caching | **Gap:** No details on cache invalidation strategy if team logos change during a long session |

### 6. Data Processing (PRD Scoring Ingestion Service section)

| PRD Requirement | Phase 3 Doc Coverage | Gap? |
|-----------------|---------------------|------|
| Poll `https://api.virti.us/session/{sessionId}/json` | Task 1 shows this URL pattern | None |
| Process into graphic-ready structures | Task 1 defines `processVirtiusData()` | None |
| Leaderboard rows: rank, name, team, teamLogo, score | Task 2 schema matches | None |
| Leaderboard rows: diff, exec, stickBonus for men's | Task 2 schema matches | None |
| "Limit to top 10" | Task 1 mentions "Limit to top 10" | None |
| Handle ties — same score = same rank | Task 1 mentions "handle ties" | **Gap:** No pseudocode showing gap ranking vs dense ranking algorithm |

## Gaps Identified

### Gap 1: 30-Minute Producer Timeout Implementation

**PRD says:** "No producer connected for 30+ minutes (no active socket connections) → stop polling"

**Phase 3 says:** Task 4 mentions tracking socket connections with a timer reset on producer connect, but provides only a brief comment, no pseudocode or Firebase path for tracking.

**What's missing:**
- How to detect "producer connected" vs other clients (role checking)
- Where to store `lastProducerActivity` timestamp
- Whether this is a per-competition timer or per-service timer
- How to handle multiple producers connecting/disconnecting

**Recommendation:** Add pseudocode for socket connection tracking. Consider reusing the existing `AutoShutdownService` pattern from `server/lib/autoShutdown.js` which already tracks activity.

### Gap 2: Tie Handling Algorithm Not Specified

**PRD says:** "Assign ranks (handle ties — same score = same rank)"

**Phase 3 says:** Task 1 mentions "Assign ranks (handle ties — same score = same rank)" but no algorithm.

**What's missing:** The existing output.html uses **gap ranking** (1st, 2nd, 2nd, 4th — skips 3rd). The Phase 3 doc doesn't specify which ranking system to use.

**Existing code (output.html:8566-8573):**
```javascript
let currentPlace = 1;
sortedGymnasts.forEach((g, i) => {
  if (i > 0 && g.total < sortedGymnasts[i-1].total) {
    currentPlace = i + 1;  // Gap ranking
  }
  g.place = currentPlace;
});
```

**Recommendation:** Explicitly specify gap ranking in Phase 3 Task 1 to match existing behavior.

### Gap 3: Tie Indicator ("T" suffix) Not Mentioned

**PRD says:** Nothing explicit about tie indicators in scoring data.

**Phase 3 says:** Nothing about tie indicators.

**Existing code (output.html:8680-8700):** Detects ties by counting gymnasts per place, appends `<sup>T</sup>` to rank display.

**What's missing:** Should the server write `isTied: true` to the leaderboard row, or should the block compute ties at render time?

**Recommendation:** Since the leaderboard-table block (Phase 2) already needs tie information for display, the Phase 3 service should include `isTied` or `tiedCount` in each row. This is more efficient than the block recalculating ties.

### Gap 4: Medal Indicators Not in Schema

**PRD says:** Nothing explicit about medals in scoring data schema.

**Phase 3 Task 2 schema:** Shows rank but not medal indicator.

**Existing code (output.html:8702-8705):** Renders gold/silver/bronze indicators for places 1-3.

**What's missing:** The Phase 3 schema doesn't include medal info. Should it? Or is this purely a render-time concern?

**Recommendation:** Medal rendering (gold/silver/bronze circle) is a pure function of rank — no additional data needed. The block can render it. No gap in data, but worth noting in Task 2 that ranks 1-3 get medal treatment at render.

### Gap 5: Stick Bonus Detection Logic

**PRD says:** Include "stickBonus" in men's events.

**Phase 3 Task 2 schema:** Shows `stickBonus: false` boolean.

**Existing code (output.html:8696-8732):** Checks `bonus > 0` from API.

**What's missing:** Phase 3 doesn't specify how to detect stick bonus from Virtius API. The existing code uses `gymnast.bonus > 0`.

**Recommendation:** Add to Task 1: "stickBonus = gymnast.bonus > 0"

### Gap 6: Error State Lifecycle

**PRD says:** `scoringFeed/status: 'ok' | 'error'` with `errorMessage`.

**Phase 3 says:** Task 1 writes `status: 'error'` and `errorMessage` on catch, `status: 'ok'` on success.

**What's missing:** When does `errorMessage` get cleared? On next successful poll? Or does it persist until manually cleared?

**Recommendation:** Clarify that `errorMessage: null` is written on successful polls (Task 1 pseudocode shows this, which is correct).

### Gap 7: New Competition Detection

**PRD says:** Multi-competition polling, each independent.

**Phase 3 Task 3 says:** "Listen to `competitions/` for new children."

**What's missing:** Should the service monitor ALL competitions, or only those with `scoringFeed/enabled: true`? What about competitions created mid-session?

**Existing pattern (playoutEngine.js):** Uses a Map to track active engines per-competition; new competitions trigger engine creation on demand (not proactive monitoring).

**Recommendation:** Clarify whether the service:
- A) Listens to ALL `competitions/` children and checks `scoringFeed/enabled` for each
- B) Only responds to explicit start requests via socket events

Option B matches existing patterns better (playoutEngine is started by timesheet events, not by monitoring all competitions).

### Gap 8: `virtiusSessionId` vs `scoringFeed` Configuration

**PRD says:** Service reads `config/virtiusSessionId` for the session ID.

**Phase 3 Task 1 says:** Read `config/virtiusSessionId` at startup.

**Phase 3 Task 3 says:** Watch `scoringFeed/enabled` for changes.

**What's missing:** If `virtiusSessionId` changes mid-session (e.g., producer corrects a typo), does the service pick it up? There's no Firebase listener for `virtiusSessionId`.

**Recommendation:** Add a listener for `config/virtiusSessionId` changes, or document that changing the session ID requires stopping/starting the feed.

### Gap 9: Combined All-Around Not Supported

**PRD section "Future Scope":** "Combined All-Around Leaderboard requires data from multiple Virtius sessions (e.g., prelims + finals). The single-session polling loop in Phase 3 cannot produce this."

**Phase 3 says:** Nothing — combined AA is out of scope.

**Status:** Not a gap — explicitly deferred. But worth noting in Phase 3 that `scoring/leaderboard/AA` is single-session only.

### Gap 10: Stats Badge Interaction

**PRD (Competition Card section):** Shows badge with poll interval, click to toggle.

**Phase 3 Task 5:** Documents badge states and click behavior.

**StatsStatusBadge.jsx pattern:** Has a refresh button that emits `refreshRtnStats` socket event.

**What's missing:** Phase 3 Task 5 doesn't specify the socket event or API endpoint for toggling the feed. Is it a direct Firebase write (`scoringFeed/enabled: !current`) or a socket event?

**Recommendation:** Specify that clicking the badge toggles `scoringFeed/enabled` via direct Firebase write (matches ScoreBugPanel pattern).

## Contradictions Identified

### None found.

The Phase 3 doc is well-aligned with the PRD. No contradictions between parent and child documents.

## Summary

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| 30-minute producer timeout details | Medium | Add implementation pseudocode |
| Tie handling algorithm | Low | Specify gap ranking explicitly |
| Tie indicator in data | Low | Add `isTied` boolean to row schema |
| Medal indicators | None | Already render-time concern |
| Stick bonus detection | Low | Specify `bonus > 0` logic |
| Error state lifecycle | Low | Already correct in pseudocode |
| New competition detection | Medium | Clarify socket event trigger vs proactive monitoring |
| `virtiusSessionId` change handling | Low | Document restart requirement |
| Combined AA | None | Explicitly deferred |
| Badge toggle mechanism | Low | Specify direct Firebase write |

**Overall assessment:** Phase 3 doc is comprehensive. Most gaps are minor clarifications. The 30-minute timeout and new competition detection patterns need more detail.
