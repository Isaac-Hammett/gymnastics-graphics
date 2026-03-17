# RTN Stats Integration - Bug Tracker

## Open Bug Summary (2026-03-14)

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| BUG-022 | High | OPEN | `buildTeamDbKey()` strips `&` from team names, causing stats lookup to miss `rtnId` |
| BUG-023 | Medium | OPEN | Client-side RTN coach fetch fails silently due to CORS — `useHeadCoach` always returns null |
| BUG-024 | Medium | OPEN | `parseCompetitionType()` missing `womens-7` — 7-team competitions treated as 2-team |
| BUG-025 | Low | OPEN | `parseScore()` treats `0` and `0.0000` as null — valid zero scores silently dropped |
| BUG-026 | Low | OPEN | Consistency trend average includes `null` scores — incorrect average in chart |
| BUG-027 | Medium | OPEN | `useRtnStats` loadedCountRef never resets on teamKeys change — stale loading state |
| BUG-028 | Low | OPEN | `StatsStatusBadge` and `StatsDetailPanel` useEffect deps incomplete — won't resubscribe for teams 3-6 |
| BUG-029 | Medium | OPEN | `refreshRtnStats` socket handler does not write error meta for missing `rtnId` — UI stays stale |
| BUG-030 | Low | OPEN | `normalizeTeamName()` strips "state" — false matches for teams like "Penn State" vs "Penn" |
| BUG-031 | Low | OPEN | `buildTeamStatUrls()` returns 7 endpoints but comment says 8 — missing one endpoint |
| BUG-032 | Medium | OPEN | `StatsStatusBadge` refresh socket connects without joining competition room — `rtnStatsResult` never received |
| BUG-033 | Low | OPEN | RTN API returns null coach data for 5 teams — `getHeadCoach` returns null even if CORS were fixed |
| BUG-034 | Medium | OPEN | `useRtnStats` client hook hardcodes team loop to 6 — team 7 never subscribed |
| BUG-035 | High | OPEN | `ingestTeamStats` uses `set()` which destroys previous good data on partial re-ingestion |
| BUG-036 | Medium | OPEN | `syncStatsToConfig` silently skips unranked teams — no fallback to individualAverages |
| BUG-037 | Medium | OPEN | Show-start snapshot races with stale refresh — snapshot may contain stale data |
| BUG-038 | Low | OPEN | "8 endpoints" stated in PRD, tech plan, and code comment — actual count is 7 |
| BUG-039 | High | FIXED | Team reorder doesn't refresh RTN data — coaches stale, teamData keys mismatched |

---

## BUG-022: `buildTeamDbKey()` Strips `&` — Stats Fail for Teams with Ampersand in Name (OPEN)

**Date Identified:** 2026-03-11
**Severity:** High
**Status:** OPEN

### Symptoms

1. Competition card shows **"Stats error"** badge for teams with `&` in their name (e.g., William & Mary)
2. Firebase `teamsDatabase/stats/william-mary-womens/meta` contains:
   ```json
   { "status": "error", "errors": { "rtnId": "RTN ID not set. Run Media Manager team setup first." } }
   ```
3. Stats for the other team in the same competition load fine (e.g., Alaska)

### Root Cause

`buildTeamDbKey()` exists in two places:
- **Server:** `server/lib/rtnStatsService.js:689`
- **Client:** `show-controller/src/hooks/useRtnStats.js:29`

Both contain this regex that strips `&`:
```javascript
.replace(/[^a-z0-9\s-]/g, '')
```

This converts "William & Mary" → `william-mary-womens`.

However, the **actual team record** in Firebase lives at `teamsDatabase/teams/william-&-mary-womens` (with `&`) and has `rtnId: "75"`. The normalized key `william-mary-womens` also exists (created by Media Manager) but does **not** have an `rtnId` field.

**Data flow:**
1. Server receives `ingestRtnStats` for competition `51aq2rkn`
2. Config has `team1Name: "William & Mary"`
3. `buildTeamDbKey("William & Mary", "womens")` → `william-mary-womens` (no `&`)
4. Server reads `teamsDatabase/teams/william-mary-womens/rtnId` → `null`
5. Server writes error meta: `"RTN ID not set"`
6. UI shows "Stats error" badge

### Cascading Impact

The `buildTeamDbKey()` function is also called by `syncStatsToConfig()` and `snapshotStatsForCompetition()`. This means even if stats were manually backfilled at the correct key, config auto-sync and show-start snapshots would also fail for these teams because they derive the wrong key.

### Affected Teams

Any team with `&` in its name. Known: **William & Mary**, **Texas A&M**.

### Affected Files

| File | Line | Function |
|------|------|----------|
| `server/lib/rtnStatsService.js` | 694 | `buildTeamDbKey()` — server copy |
| `show-controller/src/hooks/useRtnStats.js` | 34 | `buildTeamDbKey()` — client copy |

### Suggested Fix

**Option A (preferred):** Add `&` to the allowed characters in `buildTeamDbKey()`:
```javascript
// BEFORE:
.replace(/[^a-z0-9\s-]/g, '')

// AFTER:
.replace(/[^a-z0-9\s&-]/g, '')
```
Both server and client copies must be updated. Firebase allows `&` in keys.

**Option B:** Backfill `rtnId` onto the normalized key (`william-mary-womens`) so lookups work regardless. Risk: creates two team records with divergent data.

---

## BUG-023: Client-Side RTN Coach Fetch Fails Silently Due to CORS (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. `useHeadCoach()` and `useHeadCoaches()` hooks always return `null` for coach data
2. No visible error in the UI — coaches simply don't appear
3. Browser DevTools Network tab shows CORS errors for `https://www.roadtonationals.com/api/women/teams` (and men's equivalent)
4. Head coaches **do** appear in competition config (e.g., `team2Coaches: "Marie-Sophie Boggasch\nKendra Daniels"`) because the **server-side** enrichment works

### Root Cause

The client-side functions in `show-controller/src/lib/roadToNationals.js` make direct browser `fetch()` calls to `https://www.roadtonationals.com/api/*`. The RTN API does **not** return CORS headers (`Access-Control-Allow-Origin`), so all browser requests are blocked by the same-origin policy.

The `catch` blocks silently return `null` or `[]`:
```javascript
// roadToNationals.js:82-85
} catch (error) {
  console.error('Error fetching head coach:', error);
  return null;
}
```

The server-side code (`rtnStatsService.js`) works fine because Node.js is not subject to CORS restrictions.

### Why It Sometimes Appears to Work

Head coaches are populated into competition config (`team1Coaches`, `team2Coaches`, etc.) by the **server-side** enrichment function during stats ingestion. Components that read coaches from config will show them correctly. Only components using the `useHeadCoach()` / `useHeadCoaches()` hooks to fetch directly from RTN are affected.

### Affected Files

| File | Lines | Functions |
|------|-------|-----------|
| `show-controller/src/lib/roadToNationals.js` | 22-40 | `fetchWomensTeams()`, `fetchMensTeams()` — raw fetch calls |
| `show-controller/src/lib/roadToNationals.js` | 57-86 | `getHeadCoach()` — silent CORS failure |
| `show-controller/src/lib/roadToNationals.js` | 136-166 | `getHeadCoaches()` — silent CORS failure |
| `show-controller/src/lib/roadToNationals.js` | 516-563 | `getCachedTeams()` — CORS failure on cache miss |
| `show-controller/src/hooks/useRoadToNationals.js` | 21-56 | `useHeadCoach()` hook |
| `show-controller/src/hooks/useRoadToNationals.js` | 142-209 | `useHeadCoaches()` hook |

### Suggested Fix

**Option A (preferred):** Proxy RTN API calls through the coordinator server. Add a `/api/rtn/teams/:gender` endpoint that fetches from RTN server-side and returns the result to the client.

**Option B:** Remove client-side RTN fetches entirely. Read coach data from the Firebase cache (`rtnCache/`) or from the competition config (`teamNCoaches`) which the server already populates. The `useHeadCoach()` hook would read from Firebase instead of calling RTN directly.

**Option C:** Use the Firebase-cached teams data as the primary source. `getCachedTeams()` already checks `rtnCache/{gender}` in Firebase before hitting the API — but if the cache is empty/stale, it falls back to the direct API call which fails. Fix: if the Firebase cache is stale and the direct API call fails due to CORS, return the stale cached data instead of `null`.

---

## BUG-024: `parseCompetitionType()` Missing `womens-7` — 7-Team Competitions Treated as 2-Team (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. For `womens-7` competitions, only 2 teams get their stats ingested
2. Teams 3-7 are silently ignored during ingestion, config sync, **and** show-start snapshot
3. Rankings panel and stats detail panel only show data for 2 teams

### Root Cause

`parseCompetitionType()` exists in two places:
- **Server:** `server/lib/rtnStatsService.js:670`
- **Client:** `show-controller/src/hooks/useRtnStats.js:53`

Both have the same `typeMap`:
```javascript
const typeMap = { dual: 2, tri: 3, quad: 4, '5': 5, '6': 6 };
```

The key `'7'` is missing. When `compType = "womens-7"`, `parts[1]` is `"7"`, `typeMap["7"]` is `undefined`, and the fallback `|| 2` kicks in, returning `teamCount: 2`.

### Affected Files

| File | Line | Function |
|------|------|----------|
| `server/lib/rtnStatsService.js` | 676 | `parseCompetitionType()` — server copy |
| `show-controller/src/hooks/useRtnStats.js` | 57 | `parseCompetitionType()` — client copy |

### Suggested Fix

Add `'7': 7` to the `typeMap` in both copies:
```javascript
const typeMap = { dual: 2, tri: 3, quad: 4, '5': 5, '6': 6, '7': 7 };
```

---

## BUG-025: `parseScore()` Treats `0` and `0.0000` as Null — Valid Zero Scores Dropped (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Low
**Status:** OPEN

### Symptoms

1. Athletes who scored exactly `0.000` (e.g., fall on vault where they get a 0) have the score stored as `null` instead of `0`
2. These athletes may be filtered out of per-event lists or show as "-" in the UI

### Root Cause

`parseScore()` at `server/lib/rtnStatsService.js:345`:
```javascript
function parseScore(val) {
  if (val === null || val === undefined || val === '' || val === '0.0000' || val === 0) return null;
  ...
}
```

The check `val === '0.0000' || val === 0` was intended to filter "no score" placeholders, but a legitimate score of 0.000 (rare but possible) is also discarded. RTN uses `0.0000` to mean "no score recorded" in most cases, but this is ambiguous.

### Impact

Low — a score of exactly 0.000 is extremely rare in gymnastics. However, it's technically incorrect to assume 0 always means "no data."

### Suggested Fix

Document the assumption explicitly. If a real 0.000 ever needs to be stored, the filter should only treat `null`/`undefined`/`''` as missing, and handle the 0-as-placeholder at the normalization layer where context is available.

---

## BUG-026: Consistency Trend Average Includes `null` Scores — Incorrect Average (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Low
**Status:** OPEN

### Symptoms

1. In the Trends tab of StatsDetailPanel, a meet where the team didn't compete on an event produces a `null` in the consistency array
2. The average calculation includes `null` entries in the divisor (`scores.length`) but treats them as 0 in the sum, producing an **incorrectly low average** (not NaN)
3. The trend detection silently fails on `null`-heavy arrays, always showing "stable"

### Root Cause

`StatsDetailPanel.jsx:449`:
```javascript
const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
```

**Note:** In JavaScript, `null + 5 = 5` (null coerces to 0), so this does NOT produce NaN as previously described. Instead, nulls are treated as 0 in the sum but still counted in `scores.length`, resulting in an incorrect (deflated) average. For example, `[49.5, null, 49.6]` averages to `(49.5 + 0 + 49.6) / 3 = 33.03` instead of the correct `(49.5 + 49.6) / 2 = 49.55`.

The trend detection at line 443 compares `null` values:
```javascript
if (recent[2] > recent[0] && recent[2] > recent[1]) trend = 'up';
```
Comparing `null > null` is always `false`, so null-heavy arrays will always show "stable" even if the non-null scores have a clear trend.

### Affected Files

| File | Line | Issue |
|------|------|-------|
| `show-controller/src/components/StatsDetailPanel.jsx` | 449 | `reduce` doesn't filter nulls |
| `show-controller/src/components/StatsDetailPanel.jsx` | 443-444 | Trend comparison with nulls |

### Suggested Fix

Filter out null values before computing average and trends:
```javascript
const validScores = scores.filter(v => v !== null && v !== undefined);
const avg = validScores.length > 0 ? validScores.reduce((s, v) => s + v, 0) / validScores.length : 0;
```

---

## BUG-027: `useRtnStats` loadedCountRef Never Resets on teamKeys Change — Stale Loading State (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. When switching between competitions on the same page, the loading state may resolve too early (from previous competition's count) or never resolve (counter already above threshold)
2. Stats panel shows "loading" indefinitely after switching competitions

### Root Cause

`useRtnStats.js:86-134`:
```javascript
const loadedCountRef = useRef(0);

useEffect(() => {
  setLoading(true);
  loadedCountRef.current = 0;  // Reset here...
  const expectedCount = teamKeys.length;

  for (const { index, teamKey } of teamKeys) {
    const unsub = onValue(statsRef, (snapshot) => {
      loadedCountRef.current++;  // ...but onValue fires immediately with cached data
      if (loadedCountRef.current >= expectedCount) {
        setLoading(false);
      }
    });
  }
}, [teamKeys, showIsRunning]);
```

The `onValue` callback fires asynchronously. If `teamKeys` changes (e.g., user switches competition), the cleanup runs and the new effect starts — but the `loadedCountRef.current = 0` reset and the `onValue` callbacks from the *previous* effect may interleave. Since `onValue` with Firebase fires the callback with the current value immediately upon subscription, this usually works, but if any listener fires before the ref is reset, the count drifts.

More critically: if `teamKeys` changes from a 2-team to a 4-team competition, the `expectedCount` increases but old callbacks may have already incremented the counter.

### Suggested Fix

Use a generation/epoch counter — each new effect invocation gets a unique ID. Callbacks from stale effects are ignored.

---

## BUG-028: `StatsStatusBadge` and `StatsDetailPanel` useEffect Deps Incomplete (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Low
**Status:** OPEN

### Symptoms

1. If a competition has 3+ teams and team3-6 names change, the Firebase listeners are not updated
2. The badge/panel shows stale stats for the old team names

### Root Cause

`StatsStatusBadge.jsx:50`:
```javascript
}, [compId, config?.compType, config?.team1Name, config?.team2Name]);
```

`StatsDetailPanel.jsx:59`:
```javascript
}, [expanded, compId, config?.compType, config?.team1Name, config?.team2Name]);
```

Both only include `team1Name` and `team2Name` in the dependency array, not `team3Name` through `team6Name`. If teams 3-6 change, the `useEffect` won't re-run, and the listeners will still point to the old team keys.

### Affected Files

| File | Line |
|------|------|
| `show-controller/src/components/StatsStatusBadge.jsx` | 50 |
| `show-controller/src/components/StatsDetailPanel.jsx` | 59 |

### Suggested Fix

Include all team name fields in the dependency array, or derive a stable key from the `teamKeys` array:
```javascript
const teamKeysStr = teamKeys.map(t => t.teamKey).join(',');
// ...
}, [compId, teamKeysStr]);
```

---

## BUG-029: `refreshRtnStats` Handler Does Not Write Error Meta for Missing `rtnId` (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. User clicks Refresh on a team with missing `rtnId` (e.g., due to BUG-022)
2. The refresh handler returns `{ status: 'error', error: 'Missing RTN ID' }` in the socket result
3. But no error meta is written to Firebase, so the `StatsStatusBadge` still shows the old state ("No stats" or old stale data) instead of "Stats error"

### Root Cause

Compare the two handlers in `server/index.js`:

**`ingestRtnStats` (line 6862):** Calls `ingestCompetitionStats()` which writes error meta to Firebase at line 907:
```javascript
await db.ref(`teamsDatabase/stats/${teamKey}/meta`).update({
  status: 'error',
  errors: { rtnId: 'RTN ID not set...' },
  fetchedAt: new Date().toISOString(),
});
```

**`refreshRtnStats` (line 6910):** Does its own inline RTN ID lookup (line 6958-6968) but does NOT write error meta to Firebase:
```javascript
if (!rtnId) {
  teamResults[`team${index}`] = { teamKey: key, status: 'error', error: 'Missing RTN ID' };
  continue;  // No Firebase write!
}
```

The error is only in the socket response, which is transient. The UI subscribes to Firebase for persistent state.

### Affected Files

| File | Line |
|------|------|
| `server/index.js` | 6966-6968 |

### Suggested Fix

Add the same Firebase meta write that `ingestCompetitionStats` does:
```javascript
if (!rtnId) {
  try {
    await db.ref(`teamsDatabase/stats/${key}/meta`).update({
      status: 'error',
      errors: { rtnId: 'RTN ID not set. Run Media Manager team setup first.' },
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) { /* best effort */ }
  teamResults[`team${index}`] = { teamKey: key, status: 'error', error: 'Missing RTN ID' };
  continue;
}
```

---

## BUG-030: `normalizeTeamName()` Strips "state" — False Matches for State Schools (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Low
**Status:** OPEN

### Symptoms

1. "Penn State" normalizes to "penn" (strips "state")
2. "Penn" also normalizes to "penn"
3. Head coach lookup for "Penn State" could return Penn's coach (or vice versa) depending on array order
4. Similarly: "Michigan State" → "michigan", "Ohio State" → "ohio", "North Carolina State" → "northcarolina"

### Root Cause

`normalizeTeamName()` in `show-controller/src/lib/roadToNationals.js:201` and `show-controller/src/hooks/useRoadToNationals.js:244`:
```javascript
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/university|college|of|the|state/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```

The word "state" is stripped because it was intended to remove "University of X State" → "X", but it creates collisions between "Penn State" and "Penn", "Michigan State" and "Michigan", etc.

Additionally, `.includes()` matching at line 70 (`normalizedSearch.includes(normalizedName)`) means a search for "michigan" will match the first team whose normalized name is a substring of "michigan" — so "Michigan" matches before "Michigan State".

### Impact

Only affects the client-side coach lookup (which is already broken by CORS — BUG-023). If CORS is fixed without also fixing this, false matches will occur.

### Suggested Fix

Remove "state" from the strip list. Use "univ" or "university" only. Or better: match by RTN team ID (available in `teamsDatabase/teams/{key}/rtnId`) instead of fuzzy name matching.

---

## BUG-031: `buildTeamStatUrls()` Returns 7 Endpoints — Comment Says 8 (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Low
**Status:** OPEN (documentation / minor logic)

### Symptoms

The file header comment says "Fetching all 8 RTN stat endpoints per team" but `buildTeamStatUrls()` only returns 7 URLs.

### Root Cause

`server/lib/rtnStatsService.js:316-328`:
```javascript
function buildTeamStatUrls(gender, year, tid, week) {
  return [
    { url: '...results/...', label: 'teamRanking' },      // 1
    { url: '...teamConsistency/...', label: 'consistency' }, // 2
    { url: '...mvp/...', label: 'mvp' },                    // 3
    { url: '...topscores/...', label: 'topScores' },         // 4
    { url: '...lineup/...', label: 'lineup' },               // 5
    { url: '...rostermain/.../2', label: 'individualHighs' }, // 6
    { url: '...rostermain/.../3', label: 'individualAverages' }, // 7
  ];
}
```

The original design may have included a separate team info/roster endpoint that was later removed, but the comment was not updated.

### Impact

No functional impact — the 7 endpoints cover all required data. The `endpointStatus` object and `normalizeAllResults` switch/case handle exactly these 7 labels. This is purely a documentation mismatch.

### Suggested Fix

Update the comment on line 8 from "all 8 RTN stat endpoints" to "7 RTN stat endpoints".

---

## BUG-032: `StatsStatusBadge` Refresh Socket Does Not Join Competition Room (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. User clicks the refresh icon on a competition card's stats badge
2. The spinner animates but stops after the 60s timeout — the result is never received
3. Stats actually do refresh (server fetches successfully), but the badge doesn't update until the Firebase listener fires

### Root Cause

`StatsStatusBadge.jsx:88-110`:
```javascript
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  query: { compId },
});

socket.on('connect', () => {
  socket.emit('refreshRtnStats', { compId });
});

socket.on('rtnStatsResult', () => {
  cleanup();
});
```

The handler sends `refreshRtnStats` and listens for `rtnStatsResult`. But the server emits the result to the **competition room** (`io.to(roomName).emit(...)` at line 6984-6991), not directly to the socket.

The temporary socket passes `compId` as a query parameter, but unless the server-side connection handler explicitly joins this socket to `competition:${compId}` based on the query, the socket will never receive room-targeted events. The connection handler at line ~3287 uses `clientCompId` from the query to join the room, so this *should* work — but only if the join completes before the `refreshRtnStats` event is processed.

**Race condition:** The socket connects → emits `refreshRtnStats` immediately on `connect` → server starts processing → server emits to room → but the join may not have completed yet if the connection handler has any async work before calling `socket.join()`.

### Impact

The badge's refreshing spinner runs for 60s then stops. Stats do update in Firebase, so the badge eventually reflects the new data via the `onValue` listener, but the UX suggests the refresh failed.

### Suggested Fix

Instead of listening for the room-targeted event, have the `refreshRtnStats` handler also emit directly back to the requesting socket (not just the room). Or: don't wait for the socket result at all — the Firebase `onValue` listener will update the badge when the data changes.

---

## BUG-033: RTN API Returns Null Coach Data for 5 Women's Teams (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Low
**Status:** OPEN (data quality / upstream)

### Symptoms

For 5 women's teams, `getHeadCoach()` returns null even if the API call succeeds, because the RTN API itself returns `null` for `hc_first` and `hc_last`.

### Affected Teams

- George Washington
- Northern Illinois
- Pennsylvania
- Utah
- UW-Stout

### Root Cause

The RTN API at `https://www.roadtonationals.com/api/women/teams` returns `null` for both `hc_first` and `hc_last` for these teams. This is an upstream data quality issue with RTN, not a bug in our code.

### Impact

These teams will never show a head coach via the RTN teams endpoint. The dashboard endpoint (`/dashboard/{year}/{teamId}`) may have the staff data as a workaround.

### Suggested Fix

Fall back to the dashboard `/staff` data (via `getCoachingStaff()`) when the teams endpoint returns null for a coach. This already works server-side — just needs to be wired up as a fallback.

---

## BUG-034: `useRtnStats` Client Hook Hardcodes Team Loop to 6 — Team 7 Never Subscribed (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. In a `womens-7` competition, the 7th team's stats are never displayed in the client UI
2. Even after fixing BUG-024 (`parseCompetitionType` missing `'7': 7`), the client hook still only subscribes to 6 teams

### Root Cause

`show-controller/src/hooks/useRtnStats.js:101`:
```javascript
for (let i = 1; i <= 6; i++) {
```

This loop is hardcoded to 6 instead of using the `teamCount` value from `parseCompetitionType()`. The server-side `ingestCompetitionStats` correctly uses `teamCount`, but the client hook does not.

### Impact

This is a **separate bug from BUG-024**. Even after BUG-024 is fixed (adding `'7': 7` to typeMap), the client will still cap at 6 teams. Both bugs must be fixed for `womens-7` to work end-to-end.

### Affected Files

| File | Line | Function |
|------|------|----------|
| `show-controller/src/hooks/useRtnStats.js` | 101 | Team subscription loop |

### Suggested Fix

Replace the hardcoded `6` with the dynamic `teamCount` from `parseCompetitionType()`:
```javascript
const { teamCount } = parseCompetitionType(config?.compType);
for (let i = 1; i <= teamCount; i++) {
```

---

## BUG-035: `ingestTeamStats` Uses `set()` — Destroys Previous Good Data on Partial Re-Ingestion (OPEN)

**Date Identified:** 2026-03-11
**Severity:** High
**Status:** OPEN

### Symptoms

1. A team's stats are fully ingested (7/7 endpoints OK)
2. A re-ingestion runs, but this time one endpoint (e.g., consistency) returns a 404
3. After re-ingestion, the previously-good consistency data is gone — replaced with `null`

### Root Cause

`server/lib/rtnStatsService.js:828-829`:
```javascript
await statsRef.set(writeData);
```

`set()` **overwrites the entire path** at `teamsDatabase/stats/{teamKey}/`. The `normalizeAllResults()` function produces `null` for any endpoint that failed, so the write object looks like:
```json
{
  "consistency": null,
  "mvp": { ... },
  "topScores": { ... },
  ...
}
```

This `null` overwrites the previously-stored consistency data.

### Contradiction with Plan

The technical plan Section 5.4 states: *"Existing stats in the shared store remain available (last known good data)"* — this is **false** for partial failures during re-ingestion because `set()` replaces everything.

### Impact

Any re-ingestion that has even one endpoint failure will destroy previously-good data for that endpoint. This is especially problematic for the consistency endpoint, which returns 404 early in the season.

### Affected Files

| File | Line |
|------|------|
| `server/lib/rtnStatsService.js` | 828-829 |

### Suggested Fix

**Option A (preferred):** Use `update()` instead of `set()`, and filter out `null` values before writing:
```javascript
const filteredData = Object.fromEntries(
  Object.entries(writeData).filter(([_, v]) => v !== null)
);
await statsRef.update(filteredData);
```

**Option B:** Merge with existing data — read current stats, overlay non-null new data, then `set()`.

---

## BUG-036: `syncStatsToConfig` Silently Skips Unranked Teams — No Fallback to Individual Data (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. An unranked team (e.g., a smaller program not in the national rankings) has stats ingested successfully
2. `individualAverages` and `individualHighs` data exists with valid per-athlete scores
3. But `team{N}Ave` and `team{N}High` are never auto-populated in the config
4. Producer still has to manually enter these values

### Root Cause

`server/lib/rtnStatsService.js:1006-1018`:

`syncStatsToConfig` reads `teamRanking` for the `ave` and `high` fields. If `teamRanking` is null (team is unranked — not in the RTN results endpoint), the entire team is skipped. No fallback reads `individualAverages` to compute a team average.

### Impact

The PRD goal "Automated Stats Ingestion replacing manual entry" fails for unranked teams. These are typically smaller programs (D2, D3, club teams) where manual lookup is most tedious.

### Suggested Fix

When `teamRanking` is null, compute a fallback team average from `individualAverages`:
```javascript
if (!teamRanking) {
  // Compute average from individual data as fallback
  const indAvg = await db.ref(`teamsDatabase/stats/${teamKey}/individualAverages`).once('value');
  if (indAvg.exists()) {
    // Sum AA averages, or compute from per-event averages
    // Write to config as approximate values
  }
}
```

---

## BUG-037: Show-Start Snapshot Races with Stale Refresh — May Snapshot Stale Data (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Medium
**Status:** OPEN

### Symptoms

1. Stats are stale (>24h old) when the producer clicks "Start Show"
2. The client detects staleness and fires a non-blocking `refreshRtnStats` request
3. The server immediately snapshots the current (stale) stats to `competitions/{compId}/rtnStats/`
4. The refresh completes seconds later and updates `teamsDatabase/stats/{teamKey}/` — but the snapshot already captured the old data
5. AI talking points use the stale snapshot for the entire show

### Root Cause

Two independent code paths run concurrently without coordination:

**Client (Task 13, ProducerView.jsx):**
```javascript
if (isStale) {
  refreshRtnStats();  // Non-blocking
}
timesheetStart();     // Immediately starts show
```

**Server (Task 7, server/index.js `showStarted` handler):**
```javascript
engine.on('showStarted', async () => {
  await snapshotStatsForCompetition(compId);  // Snapshots immediately
  // ...
});
```

The snapshot runs before the refresh can complete because `refreshRtnStats` is fire-and-forget on the client side.

### Impact

When stats are stale at show start, the frozen snapshot will always contain stale data. The refresh updates the shared store, but the snapshot is never re-taken.

### Suggested Fix

**Option A:** In the `showStarted` handler, check if a refresh is in progress (via a flag or pending promise) and wait for it before snapshotting.

**Option B:** After the refresh completes, re-snapshot if a show is running:
```javascript
// In refreshRtnStats handler, after refresh completes:
const showState = timesheetEngine.getState();
if (showState.state === 'running') {
  await snapshotStatsForCompetition(compId);
}
```

**Option C:** Make the client wait for the refresh to complete before calling `timesheetStart()`.

---

## BUG-038: "8 Endpoints" Stated Across PRD, Tech Plan, and Code — Actual Count is 7 (OPEN)

**Date Identified:** 2026-03-11
**Severity:** Low
**Status:** OPEN (documentation)

### Symptoms

Multiple documents and code comments say "8 RTN stat endpoints" but `buildTeamStatUrls()` returns exactly 7 URLs. This creates confusion for developers.

### Locations with Incorrect Count

| Location | Says |
|----------|------|
| `server/lib/rtnStatsService.js:8` (file header comment) | "Fetching all 8 RTN stat endpoints" |
| PRD Section 1 (Problem Statement, line 7) | "RTN provides 8 additional endpoints" |
| PRD Section 5 (Success Criteria, Phase 1) | "Server service fetches all 8 RTN stat endpoints per team" |
| PRD Story 2 (Acceptance) | "All 8 RTN stat categories displayed per team" |
| Tech Plan Section 1.2 (Data Flow) | "Fetches 8 RTN endpoints per team" |
| Implementation Plan Task 3 | "all 8 RTN fetch functions" |

### Root Cause

The PRD endpoint table (Section 6) lists 9 endpoints including the `dashboard` endpoint. The dashboard was already used for coach names before RTN stats integration. The 8 "new" endpoints were the other 8 in that table. But `buildTeamStatUrls()` only fetches 7 because:
- `teamRanking` and `individualRankings` both use the `results` endpoint (with different parameters)
- Individual rankings are fetched separately by `fetchLeagueRankings()`, not by `ingestTeamStats()`

So the per-team ingestion fetches 7 endpoints, not 8.

### Suggested Fix

Update all references from "8" to "7" to match the actual implementation. See BUG-031 for the code comment fix (already tracked as Task 37).

---

## BUG-039: Team Reorder Doesn't Refresh RTN Data — Coaches Stale, teamData Keys Mismatched (FIXED)

**Date Identified:** 2026-03-14
**Severity:** High
**Status:** FIXED

### Symptoms

1. User manually reorders teams in the competition Edit modal (e.g., moves Stanford from team5 to team1)
2. Config fields (`team1Name`, `team2Name`, etc.) update correctly
3. **Coaches remain as "Coach Name" placeholder** — never populated with real RTN data
4. `teamData` in Firebase keeps the OLD positional keys (e.g., Stanford data stays under `team5` even though config now has Stanford as `team1`)
5. Stats (Ave/High/NQS) sync correctly because server-side `syncStatsToConfig` matches by team name, not teamData keys
6. User clicking "Refresh Stats" does NOT fix coaches — it only triggers server-side stats sync, not client-side RTN enrichment

### Root Cause

`updateCompetition()` in `useCompetitions.js` never passes `refreshRTN: true` when saving edits. The function signature accepts `options.refreshRTN` but the Edit modal calls it as:

```javascript
await updateCompetition(editingCompId, config);  // No options — refreshRTN is undefined
```

This means:
1. `enrichTeamsWithRTN()` is never called after team reorder
2. `buildCoachUpdates()` is never called — coaches stay stale
3. `teamData` in Firebase retains old positional keys
4. `triggerStatsIngestion()` is not called — stats must be manually refreshed

The separate "Refresh Team Data" button does work, but users don't know they need to click it after reordering teams.

### Fix

Modified `updateCompetition()` to detect team name changes by comparing the incoming config's `team{N}Name` fields against the current Firebase config. If any team names changed, `refreshRTN` is automatically set to `true`, triggering `enrichTeamsWithRTN()`, `buildCoachUpdates()`, and `triggerStatsIngestion()`.

**File:** `show-controller/src/hooks/useCompetitions.js`

### Data Flow After Fix

| Step | Action | Result |
|------|--------|--------|
| 1 | User reorders teams in Edit modal | Config saved with new team order |
| 2 | `updateCompetition()` detects team name change | Auto-sets `refreshRTN: true` |
| 3 | `enrichTeamsWithRTN()` runs | `teamData` rewritten with correct positional keys |
| 4 | `buildCoachUpdates()` runs | Coaches synced to correct `team{N}Coaches` config fields |
| 5 | `triggerStatsIngestion()` fires | Server-side stats re-synced to config |
