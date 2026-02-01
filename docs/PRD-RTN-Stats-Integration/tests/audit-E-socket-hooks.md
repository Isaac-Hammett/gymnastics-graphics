# Audit E: Socket & Hook Contract Alignment

**Date:** 2026-02-01
**Status:** COMPLETE

---

## E1: Socket Event Naming Convention

**Result: PASS**

Examined 100+ socket events in `server/index.js`. The codebase uses these naming patterns:

- **Client -> Server:** camelCase verbNoun (e.g., `startTimesheetShow`, `advanceSegment`, `getAISuggestions`, `assignVM`)
- **Server -> Client (state):** camelCase nounVerbed past tense (e.g., `timesheetShowStarted`, `vmReady`, `cameraVerified`)
- **Server -> Client (results):** `{action}Result` suffix (e.g., `loadRundownResult`, `aiSuggestionsResult`, `vmAssignmentResult`)
- **OBS events:** `obs:` prefix namespace (e.g., `obs:createScene`, `obs:stateUpdated`)

**Plan's proposed events:**

| Event | Direction | Pattern Match |
|-------|-----------|---------------|
| `ingestRtnStats` | Client -> Server | YES - camelCase verbNoun |
| `refreshRtnStats` | Client -> Server | YES - camelCase verbNoun |
| `fetchLeagueRankings` | Client -> Server | YES - camelCase verbNoun |
| `rtnStatsResult` | Server -> Client | YES - matches `{noun}Result` convention |
| `rtnStatsProgress` | Server -> Client | See E3 |
| `leagueRankingsResult` | Server -> Client | YES - matches `{noun}Result` convention |

All proposed events follow existing naming conventions.

---

## E2: `ingestRtnStats` vs `refreshRtnStats` Distinction

**Result: PASS**

The plan defines:
- `ingestRtnStats` — full ingestion with staleness check (skips fresh data)
- `refreshRtnStats` — force refresh, bypasses staleness check

**Existing pattern:** The codebase has a similar split for AI context:
- `getAIContext` — returns cached context
- `refreshAIContext` — force regenerates context

The two-event pattern is consistent with the codebase. The distinction (stale-check vs force) is clear in the plan task descriptions (Task 7). No merging needed.

---

## E3: `rtnStatsProgress` Granularity

**Result: PASS**

The codebase has one precedent for multi-step progress events: the VM lifecycle progression:
- `vmStarting` -> `vmReady` / `vmError`
- `vmStopping` -> `vmStopped`

These are separate events per stage, NOT a single generic progress event.

The plan uses a single `rtnStatsProgress` event with fields `{ compId, teamKey, endpoint, step, total, status }`. This is a different pattern (single event with step counter) rather than separate events per stage.

**Assessment:** The single-event approach is actually better for RTN stats because:
1. There are 8 endpoints per team x N teams = many steps
2. Having 16+ separate event names would be excessive
3. The `step/total` counter gives the client all it needs for a progress bar

The plan's approach is reasonable and doesn't conflict with existing patterns. The VM pattern uses separate events because each stage has different payload shapes.

---

## E4: Room Broadcasting Pattern

**Result: PASS**

Existing pattern confirmed:
```javascript
// Competition-specific rooms:
socketIo.to(roomName).emit('timesheetShowStarted', data);
// where roomName = `competition:${compId}`
```

Plan Task 7 says: "Follow existing room pattern: `socketIo.to(roomName).emit()` where `roomName = \`competition:${compId}\``"

This matches exactly. The plan also correctly notes that the `showStarted` handler at line 444 has access to `compId`, `socketIo`, and `roomName` from enclosing scope.

---

## E5: ShowContext Integration

**Result: FAIL**

**Finding:** The plan does NOT mention adding socket event listeners for `rtnStatsResult` or `rtnStatsProgress` to ShowContext.jsx.

However, examining the codebase patterns:
- **ShowContext.jsx** handles most socket events (camera, timesheet, OBS, rundown)
- **useAIContext.js** registers its OWN socket listeners directly (NOT through ShowContext)

The `useAIContext.js` pattern provides a precedent: specialized hooks can register their own socket listeners without going through ShowContext. This is a cleaner separation of concerns.

**Recommendation:** The plan's `useRtnStats.js` hook should register its own `rtnStatsResult` and `rtnStatsProgress` listeners directly on the socket (following `useAIContext.js` pattern), NOT through ShowContext. This is likely what the plan intends but doesn't state explicitly.

**Fix needed:** Task 8 (create `useRtnStats.js`) should explicitly state:
1. Get socket from ShowContext via `useShow()` hook
2. Register `rtnStatsResult` and `rtnStatsProgress` listeners directly in the hook's useEffect
3. Clean up listeners on unmount with `socket.off()`
4. Follow `useAIContext.js` pattern (lines 37-102)

Similarly, Task 16 (`useLeagueRankings`) should register `leagueRankingsResult` listener directly.

---

## E6: Hook Naming Convention

**Result: PASS**

All existing hooks follow `useCamelCase.js` naming:
- useRoadToNationals.js
- useEventConfig.js
- useRotationSchedule.js
- useTeamsDatabase.js
- useApparatus.js
- useCameraHealth.js
- useCameraRuntime.js
- useAlerts.js
- useCoordinator.js
- useVMPool.js
- useCompetitions.js
- useAutoRefreshScreenshot.js
- useAIContext.js
- useTimesheet.js

**Plan's proposed hooks:**
- `useRtnStats.js` — follows convention
- `useLeagueRankings.js` — follows convention

Both use `.js` extension (not `.jsx`) and `useCamelCase` naming.

---

## E7: Hook Firebase Subscription Pattern

**Result: PASS**

Examined `useCompetitions.js` (lines 341-351, 586-617):

```javascript
import { ref, onValue } from 'firebase/database';

useEffect(() => {
  const configRef = ref(db, `competitions/${compId}/config`);
  const unsubConfig = onValue(configRef, (snapshot) => {
    setConfig(snapshot.val());
    setLoading(false);
  }, (err) => {
    setError(err.message);
    setLoading(false);
  });
  return () => unsubConfig();
}, [compId]);
```

The plan's `useRtnStats.js` (Task 8) says: "Subscribe to `teamsDatabase/stats/{teamKey}` for each team... and `competitions/{compId}/rtnStats` (during show) via `onValue`."

This matches the existing Firebase subscription pattern exactly:
1. Import `ref, onValue` from `firebase/database`
2. Create ref with path
3. Subscribe with `onValue(ref, callback, errorCallback)`
4. Return unsubscribe function in cleanup

**Note:** Multiple subscriptions per hook is also established (useCompetitions subscribes to config, teamData, and currentGraphic in a single useEffect).

---

## Summary

| # | Check | Result | Finding |
|---|-------|--------|---------|
| E1 | Socket event naming convention | PASS | All planned events follow existing camelCase verbNoun / nounResult patterns |
| E2 | ingestRtnStats vs refreshRtnStats distinction | PASS | Two-event pattern matches existing getAIContext/refreshAIContext split |
| E3 | rtnStatsProgress granularity | PASS | Single progress event with step counter is appropriate for multi-step ingestion |
| E4 | Room broadcasting | PASS | Plan correctly specifies `socketIo.to(roomName).emit()` pattern |
| E5 | ShowContext integration | FAIL | Plan doesn't specify how hooks register socket listeners. Should follow useAIContext.js pattern (direct socket listener in hook, not ShowContext). |
| E6 | Hook naming | PASS | `useRtnStats.js` and `useLeagueRankings.js` follow `useCamelCase.js` convention |
| E7 | Hook Firebase subscription pattern | PASS | Plan's onValue usage matches existing useCompetitions.js pattern |
