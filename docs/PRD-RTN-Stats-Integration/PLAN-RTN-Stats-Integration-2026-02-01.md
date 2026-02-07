# Implementation Plan: RTN Statistics Integration

**Version:** 2.0
**Date:** 2026-02-01
**Status:** Active
**PRD:** [PRD-RTN-Stats-Integration-2026-02-01.md](./PRD-RTN-Stats-Integration-2026-02-01.md)

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD-RTN-Stats-Integration-2026-02-01.md](./PRD-RTN-Stats-Integration-2026-02-01.md) | Product requirements |
| [PLAN-RTN-Stats-Integration-Implementation.md](./PLAN-RTN-Stats-Integration-Implementation.md) | Implementation task tracking (use this for day-to-day execution) |

**Note:** This document serves as the technical reference for architecture, data model, API normalization, and integration points. For task execution and progress tracking, see the Implementation Plan.

---

## 1. Architecture Overview

### 1.1 System Components

```
VIRTIUS API (team setup)         SERVER                          CLIENT / VIEWS
────────────────────────         ──────                          ──────────────
RTN team IDs            →        Media Manager stores IDs  →     teamsDatabase/teams/{key}/rtnId
RTN athlete IDs         →        in teamsDatabase          →     teamsDatabase/headshots/{name}/rtnId

RTN API (stats fetch)            SERVER                          CLIENT / VIEWS
─────────────────────            ──────                          ──────────────
/dashboard/{tid}         →       rtnStatsService.js        →     useRtnStats hook
/results/{week}/0/{type} →       (fetch, normalize, store)  →    DashboardPage (status, refresh)
/teamConsistency/{tid}   →                                  →    aiContextService (talking points)
/mvp/{tid}               →       Firebase RTDB              →    aiSuggestionService (suggestions)
/topscores/{tid}         →       teamsDatabase/stats/{key}  →    TalentView (via AI context)
/lineup/{tid}            →                                  →    Graphics (via config auto-sync)
/rostermain/{tid}/2      →
/rostermain/{tid}/3      →
/results/{week}/1/{evt}  →       rtnCache/rankings/         →    useLeagueRankings hook
```

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RTN ID CAPTURE (during team setup in Media Manager)                       │
│                                                                             │
│  Virtius API                                                                │
│  ├── Team RTN ID  → teamsDatabase/teams/{teamKey}/rtnId                    │
│  └── Athlete RTN IDs → teamsDatabase/headshots/{name}/rtnId                │
│                                                                             │
│  These IDs are the KEY that unlocks all RTN API calls.                     │
│  Without them, stats ingestion cannot proceed.                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  INGESTION (server-side, triggered on competition creation or show start)  │
│                                                                             │
│  rtnStatsService.js                                                        │
│  ├── Triggered by: socket "ingestRtnStats" OR auto-refresh before show    │
│  ├── Reads: teamsDatabase/teams/{teamKey}/rtnId for each team             │
│  ├── Checks: teamsDatabase/stats/{teamKey}/meta/fetchedAt for staleness   │
│  ├── If stale (>24h) or missing:                                          │
│  │   ├── Fetches 8 RTN endpoints per team (rate-limited, sequential)      │
│  │   ├── Normalizes raw RTN JSON → standard schema                        │
│  │   └── Writes to: teamsDatabase/stats/{teamKey}/                        │
│  ├── Auto-syncs: team{N}Ave, team{N}High, team{N}Con → config            │
│  │   └── Skips fields with manual override locks                          │
│  └── Emits: rtnStatsProgress, rtnStatsResult socket events               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Firebase real-time listeners
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SHOW START SNAPSHOT                                                       │
│                                                                             │
│  When show starts (showStarted event):                                     │
│  ├── Copy teamsDatabase/stats/{teamKey}/ → competitions/{compId}/rtnStats/ │
│  ├── Record snapshotTakenAt timestamp                                      │
│  └── AI services read from frozen snapshot during live show                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONSUMPTION                                                                │
│                                                                             │
│  Graphics Pipeline (zero changes needed)                                   │
│  └── Reads team{N}Ave, team{N}High from config (already auto-synced)      │
│                                                                             │
│  AI Context Service (server/lib/aiContextService.js)                       │
│  └── Reads competitions/{compId}/rtnStats/ (frozen snapshot)               │
│  └── Generates enhanced talking points for TalentView                      │
│                                                                             │
│  AI Suggestion Service (server/lib/aiSuggestionService.js)                 │
│  └── Reads teamsDatabase/stats/{teamKey}/ (latest data for planning)       │
│                                                                             │
│  Dashboard UI (show-controller/src/pages/DashboardPage.jsx)                │
│  └── Shows stats status indicator, refresh button, last-fetched timestamp  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Why Server-Side

All RTN API calls go through the Express server, not the browser client. Reasons:

1. **CORS** -- RTN doesn't set Access-Control-Allow-Origin headers for the stats endpoints
2. **Rate limiting** -- Centralized throttling prevents multiple clients hammering RTN simultaneously
3. **Caching** -- Single shared cache in Firebase, reused across all competitions
4. **Consistency** -- Same normalization logic for all consumers (AI, graphics, UI)

**Note:** The existing client-side `enrichTeamsWithRTN()` in `roadToNationals.js` currently calls the RTN dashboard endpoint from the browser for coach names. This works because the dashboard endpoint allows CORS. The new stats endpoints may not. All new RTN calls go server-side; the existing dashboard call remains client-side for now but could be migrated later.

---

## 2. Firebase Data Model

### 2.1 Shared Team Stats Store (Source of Truth)

**Path:** `teamsDatabase/stats/{teamKey}/`

```
teamsDatabase/stats/{teamKey}/       e.g., teamsDatabase/stats/oklahoma-womens/
  meta/
    fetchedAt: string                // ISO timestamp of last successful fetch
    rtnId: number                    // RTN team ID used for this fetch
    year: number                     // e.g., 2026
    gender: string                   // "mens" | "womens"
    week: number                     // RTN week number at time of fetch
    status: string                   // "complete" | "partial" | "error"
    errors: object | null            // Per-endpoint errors: { "consistency": "404 Not Found", ... }
    endpointStatus: object           // Per-endpoint success/fail: { "consistency": "ok", "mvp": "ok", ... }

  teamRanking/
    rank: string                     // e.g., "1" or "3(t)" for ties
    ave: string                      // e.g., "197.783"
    high: string                     // e.g., "198.425"
    rqs: string                      // Ranking Qualifying Score
    conference: string               // e.g., "SEC"
    region: string                   // e.g., "SC"
    division: string                 // e.g., "Div I"

  consistency/
    labels: string[]                 // Meet dates: ["Jan-10-26", "Jan-16-26", ...]
    events/                          // Normalized to short codes
      VT: number[]                   // [49.35, 49.575, 49.625, 49.55]
      UB: number[]                   // (women) or PH (men)
      BB: number[]                   // (women) or SR (men)
      FX: number[]

  mvp/                               // Array of athletes sorted by total
    - rtnId: string                  // RTN gymnast ID
      firstName: string
      lastName: string
      fullName: string
      events/                        // Normalized to short codes
        VT: number | null
        UB: number | null
        BB: number | null
        FX: number | null
      total: number

  topScores/
    theoreticalMax: number           // e.g., 198.75
    scores/                          // Top 5 lineup per event
      - vault: string
        bars: string
        beam: string
        floor: string
    events/                          // Per-event top athletes
      VT/
        - rtnId, firstName, lastName, fullName, high: string
      UB/
        ...

  lineup/                            // Array of athletes
    - rtnId: string
      firstName: string
      lastName: string
      fullName: string
      meets: number[]                // Binary: [1, 1, 1, 0, ...]
      rate: number                   // Percentage: 0.75 = 75% of meets

  individualHighs/                   // Array of athletes
    - rtnId: string                  // RTN gymnast ID — used to join with Virtius roster
      firstName: string
      lastName: string
      fullName: string
      events/
        VT: number | null
        UB: number | null
        BB: number | null
        FX: number | null
        AA: number | null

  individualAverages/                // Array of athletes (same schema as highs)
    - rtnId, firstName, lastName, fullName, events: {...}
```

### 2.2 Competition Snapshot (Frozen at Show Start)

**Path:** `competitions/{compId}/rtnStats/`

```
competitions/{compId}/rtnStats/
  snapshotTakenAt: string            // ISO timestamp
  team1/                             // Full copy from teamsDatabase/stats/{team1Key}
    teamRanking/
    consistency/
    mvp/
    topScores/
    lineup/
    individualHighs/
    individualAverages/
    meta/
  team2/                             // Full copy from teamsDatabase/stats/{team2Key}
    ...
```

This snapshot is taken automatically when the show starts. AI services read from this frozen snapshot during live execution, ensuring consistency even if the shared store is updated for another competition.

### 2.3 League Rankings Cache

> **Audit note (A7):** `rtnCache/` already contains three siblings: `dashboards/` (per-team dashboard cache, keyed `{gender}-{tid}`), `womens/` (team directory with all women's teams), and `mens/` (team directory with all men's teams). The new `rankings/` path coexists alongside these without conflict. The RTN dashboard roster entries also include per-athlete RTN IDs (field `id`), which may serve as a fallback for athlete ID matching.

**Path:** `rtnCache/rankings/`

```
rtnCache/rankings/
  {gender}-{year}-{week}/            // e.g., "womens-2026-4"
    timestamp: number                // Fetch timestamp for TTL
    fetchedAt: string                // ISO timestamp

    team/                            // Array of all ranked teams
      - rank: string
        name: string
        tid: number
        ave: string
        high: string
        rqs: string | number
        conference: string
        region: string
        division: string

    individual/
      VT/                            // Per-event individual rankings
        - rank: string
          firstName: string
          lastName: string
          fullName: string
          rtnId: string
          team: string
          teamId: number
          ave: string
          high: string
          rqs: string
          conference: string
      UB/
        ...
      BB/
        ...
      FX/
        ...
      AA/
        ...
```

**Note:** Rankings use week-based caching, not daily. Weekly rankings are more stable and representative since not all teams compete on the same day. The RTN week number is used as the cache key.

### 2.4 Config Locks

**Path:** `competitions/{compId}/config/_locks`

```
competitions/{compId}/config/_locks
  team1Ave: boolean                  // true = locked, skip auto-sync
  team1High: boolean
  team1Con: boolean
  team1Coaches: boolean
  team2Ave: boolean
  ...
```

When `syncStatsToConfig()` runs, it reads `_locks` first and skips any field where the lock is `true`. The existing `enrichTeamsWithRTN()` coach name sync should also respect these locks.

### 2.5 RTN ID Storage

**Path:** `teamsDatabase/teams/{teamKey}/rtnId` and `teamsDatabase/headshots/{name}/rtnId`

```
teamsDatabase/teams/oklahoma-womens/
  displayName: "Oklahoma Women's"
  gender: "womens"
  logo: "https://..."
  school: "Oklahoma"
  roster: [...]
  rtnId: 12345                       // NEW: RTN team ID from Virtius
  updatedAt: "..."

teamsDatabase/headshots/mackenzie-estep/
  name: "Mackenzie Estep"
  teamKey: "oklahoma-womens"
  url: "https://..."
  rtnId: 67890                       // NEW: RTN athlete ID from Virtius
  updatedAt: "..."
```

> **Audit note (C3/C12):** `enrichTeamsWithRTN()` already stores team `rtnId` and athlete `roster[].id` in `competitions/{compId}/teamData/team{N}/`. Once the B-CRIT bug fix changes `dashboard.id` → `dashboard.info.team_id`, this becomes a viable secondary source for RTN IDs. However, `teamData` is per-competition (ephemeral), while `teamsDatabase/teams/{teamKey}/rtnId` is the canonical persistent location. Task 1 should write to `teamsDatabase` and optionally also fix `teamData`.

> **Audit note (C7):** An existing `useRoadToNationals.js` hook handles client-side RTN dashboard fetching. The new `useRtnStats.js` hook serves a different purpose (consuming server-side normalized stats from Firebase). Implementation should document this distinction to avoid developer confusion.

---

## 3. RTN API Normalization

### 3.1 Event Code Translation

RTN uses different event identifiers depending on the endpoint. The normalization layer converts everything to standard short codes.

**Women's Events:**

| RTN Dashboard | RTN Consistency | RTN MVP | RTN Top Scores | RTN Highs/Avgs | RTN Indiv Ranking # | Standard Code |
|---------------|-----------------|---------|----------------|----------------|---------------------|---------------|
| `vault` | `vts` | `vsum` | `vault` | `maxv` | 1 | `VT` |
| `bars` | `ubs` | `ubsum` | `bars` | `maxub` | 2 | `UB` |
| `beam` | `bbs` | `bbsum` | `beam` | `maxbb` | 3 | `BB` |
| `floor` | `fxs` | `fsum` | `floor` | `maxfx` | 4 | `FX` |
| -- | -- | -- | -- | `maxaa` | 5 | `AA` |

**Men's Events:**

| RTN Dashboard | RTN Consistency | RTN Individual Ranking # | Standard Code |
|---------------|-----------------|--------------------------|---------------|
| `floor` | `fxs` | 1 | `FX` |
| `phorse` | `phs` | 2 | `PH` |
| `rings` | `srs` | 3 | `SR` |
| `vault` | `vts` | 4 | `VT` |
| `pbars` | `pbs` | 5 | `PB` |
| `highbar` | `hbs` | 6 | `HB` |
| -- | -- | 7 | `AA` |

**Men's Roster Event Flags:**

| RTN Field | Standard Code |
|-----------|---------------|
| `fx` | `FX` |
| `ph` | `PH` |
| `sr` | `SR` |
| `v` | `VT` |
| `pb` | `PB` |
| `hb` | `HB` |

**Men's Individual Stats Fields (Highs/Averages):**

| RTN Field | Standard Code |
|-----------|---------------|
| `maxfx` / `fx` | `FX` |
| `maxph` / `ph` | `PH` |
| `maxsr` / `sr` | `SR` |
| `maxvt` / `v` | `VT` |
| `maxpb` / `pb` | `PB` |
| `maxhb` / `hb` | `HB` |
| `maxaa` | `AA` |

> **Audit note (B6):** Individual highs (`rostermain/{tid}/2`) and averages (`rostermain/{tid}/3`) return `{ team: [...], ind: [...] }` — NOT a flat array. The `ind` array contains athlete records. Women's fields are `maxv`, `maxub`, `maxbb`, `maxfx`, `maxaa`. The `team` array contains per-event team totals.

**RTN Athlete ID Field Names by Endpoint:**

> **Audit note (B-CRIT):** The RTN athlete ID field name varies by endpoint. Normalization must map all to a consistent `rtnId` string.

| Endpoint | Athlete ID Field | Type |
|----------|-----------------|------|
| Dashboard roster | `id` | string |
| MVP | `gid` | number |
| Top Scores | `gymnast_id` | string |
| Lineup | `id` | string |
| Individual Highs/Averages | `gid` | string |
| Individual Rankings | `gid` | number |

### 3.2 Score Normalization

- RTN returns scores as strings (e.g., `"9.9250"`) -- parse to numbers
- MVP endpoint returns floating-point artifacts (e.g., `39.64999...`) -- round to 4 decimal places
- Negative scores in men's highs (e.g., `"-12.9000"`) indicate exhibition/scratch -- treat as `null`
- `null` values mean athlete did not compete on that event -- preserve as `null`

### 3.3 Team Ranking Type Codes

| Gender | Results Type 0 (Team) | Results Type 1 (Individual) |
|--------|----------------------|----------------------------|
| Women | type=5 (overall) | event=1-5 (VT, UB, BB, FX, AA) |
| Men | type=7 (overall) | event=1-7 (FX, PH, SR, VT, PB, HB, AA) |

### 3.4 RTN Team ID Resolution

RTN team IDs originate from the **Virtius API** and are captured during team setup in the Media Manager. The IDs are stored at:

- **Team:** `teamsDatabase/teams/{teamKey}/rtnId`
- **Athlete:** `teamsDatabase/headshots/{athlete-name}/rtnId`

The stats service reads these IDs for all RTN API calls. Resolution order:

1. Read `rtnId` from `teamsDatabase/teams/{teamKey}` (primary)
2. If still missing, log error and skip that team

> **Audit note (A5):** The previous plan included a fallback to `competitions/{compId}/teamData/team{N}/rtnId`. This path has never been populated by `enrichTeamsWithRTN()` and does not exist in any competition. The fallback was removed. `teamsDatabase/teams/{teamKey}/rtnId` is the sole source.

> **Audit note (B1):** The existing `enrichTeamsWithRTN()` at `useCompetitions.js:134` sets `rtnId: dashboard.id || null`, but the RTN dashboard response has NO top-level `id` field. The team ID is at `dashboard.info.team_id`. This means `teamData.team{N}.rtnId` is always `null` in all existing competitions. Task 1 must fix this by changing `dashboard.id` to `dashboard.info.team_id` AND saving to `teamsDatabase/teams/{teamKey}/rtnId`.

**Athlete ID matching:** Individual stats from RTN (individualHighs, individualAverages, mvp, lineup) include RTN athlete IDs. These are matched to Virtius roster entries via `teamsDatabase/headshots/{name}/rtnId`. The authoritative roster is always Virtius (used for live scoring), not RTN. RTN data supplements the Virtius roster with historical stats.

### 3.5 Current Week Calculation

RTN organizes rankings by week number. The service needs to determine the current week:

1. Fetch `/{gender}/results/{year}/1/0/5` -- the `schema.weeks` array lists all available weeks
2. Find the latest week whose `date` field is ≤ today (date-based detection)
3. Fallback: latest week with `nqs > 0` (men's) or `rqs > 0` (women's)
4. Fallback: highest week number in array (index 0, since sorted descending)

**IMPORTANT - RTN API Field Names:**
- Week number field is `wk` (not `week`): `{ "wk": "4", "date": "2026-02-02", "nqs": "0", "current": "0" }`
- Weeks array is sorted **descending** (highest week first): `[{wk: "12"}, {wk: "11"}, {wk: "10"}, ...]`
- Men's API uses `nqs` for ranking status; women's API uses `rqs`
- **DO NOT use `current: "1"` flag** — it marks "first week of season", not actual current week

**Note:** Use week-based rankings only (not daily). Daily updates are too dynamic since not all teams may have competed yet. The weekly view is a more stable and representative snapshot.

---

## 4. Socket Events

### 4.1 Client -> Server

| Event | Payload | Description |
|-------|---------|-------------|
| `ingestRtnStats` | `{ compId }` | Full ingestion for all teams in competition |
| `refreshRtnStats` | `{ compId, teamKey? }` | Force refresh stats (optional single team), ignores staleness check |
| `fetchLeagueRankings` | `{ gender, year?, week? }` | Fetch team + individual rankings |

### 4.2 Server -> Client

| Event | Payload | Description |
|-------|---------|-------------|
| `rtnStatsResult` | `{ success, compId, meta, error? }` | Ingestion/refresh result |
| `rtnStatsProgress` | `{ compId, teamKey, endpoint, step, total, status }` | Per-endpoint progress during ingestion |
| `leagueRankingsResult` | `{ success, gender, week, teamCount, error? }` | Rankings fetch result |

---

## 5. Server Service Design

### 5.1 Module: `server/lib/rtnStatsService.js`

```javascript
// Constants
const RTN_BASE = 'https://www.roadtonationals.com/api';
const RATE_LIMIT_MS = 200;           // 200ms between API calls
const STALENESS_TTL = 24 * 60 * 60 * 1000;  // 24 hours
const RANKINGS_CACHE_TTL = 24 * 60 * 60 * 1000;  // 24 hours

// Event mappings
const WOMENS_EVENTS = { vts: 'VT', ubs: 'UB', bbs: 'BB', fxs: 'FX' };
const MENS_EVENTS = { fxs: 'FX', phs: 'PH', srs: 'SR', vts: 'VT', pbs: 'PB', hbs: 'HB' };

// Individual ranking event numbers
const WOMENS_INDIVIDUAL_EVENTS = { 1: 'VT', 2: 'UB', 3: 'BB', 4: 'FX', 5: 'AA' };
const MENS_INDIVIDUAL_EVENTS = { 1: 'FX', 2: 'PH', 3: 'SR', 4: 'VT', 5: 'PB', 6: 'HB', 7: 'AA' };

// Team ranking type codes
const TEAM_RANKING_TYPE = { womens: 5, mens: 7 };
```

### 5.2 Core Functions

| Function | Description | RTN Endpoints Called |
|----------|-------------|---------------------|
| `ingestCompetitionStats(compId, io)` | Full ingestion for all teams — checks staleness first | All 8 per team (if stale) |
| `ingestTeamStats(teamKey, rtnId, gender, year, io, compId)` | Fetch all stats for one team | All 8 endpoints |
| `fetchTeamRanking(gender, year, week, tid)` | Team's position in league | `results/{week}/0/{type}` |
| `fetchConsistency(gender, year, tid)` | Event scores over time | `teamConsistency/{tid}` |
| `fetchMVP(gender, year, tid)` | Athlete contribution totals | `mvp/{tid}` |
| `fetchTopScores(gender, year, tid)` | Best possible lineup | `topscores/{tid}` |
| `fetchLineup(gender, year, tid)` | Meet-by-meet lineup | `lineup/{tid}` |
| `fetchIndividualHighs(gender, year, tid)` | Per-athlete max scores | `rostermain/{tid}/2` |
| `fetchIndividualAverages(gender, year, tid)` | Per-athlete avg scores | `rostermain/{tid}/3` |
| `fetchLeagueRankings(gender, year, week)` | All team + individual rankings | `results/{week}/0/...` + `results/{week}/1/{evt}` |
| `syncStatsToConfig(compId)` | Write AVE/HIGH/CON to config (respects locks) | None (Firebase only) |
| `snapshotStatsForCompetition(compId)` | Copy shared stats to competition snapshot | None (Firebase only) |
| `getCurrentWeek(gender, year)` | Determine latest RTN week | `results/{year}/1/0/{type}` |
| `isStale(teamKey)` | Check if shared stats are older than 24h | None (Firebase read) |

### 5.3 Rate Limiting

```javascript
// Per-competition rate limiter — sequential fetch with delay between calls
async function rateLimitedFetch(urls, onProgress) {
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const { url, label } = urls[i];
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      results.push({ label, data: await response.json(), status: 'ok' });
    } catch (err) {
      results.push({ label, data: null, status: 'error', error: err.message });
    }
    if (onProgress) onProgress(label, i + 1, urls.length);
    if (i < urls.length - 1) await sleep(RATE_LIMIT_MS);
  }
  return results;
}
```

Rate limiting is **per-competition** (one ingestion at a time per compId). If two producers create competitions simultaneously, each gets its own serial queue. The 200ms delay is between consecutive calls within a single team's ingestion.

> **Audit note (D4):** Per-competition isolation does NOT prevent concurrent writes to the same `teamsDatabase/stats/{teamKey}/` when two competitions share a team. To avoid duplicate RTN API calls: before starting ingestion for a team, re-check `meta.fetchedAt`. If it was updated within the last 60 seconds (another ingestion just completed), skip that team and use existing data. This lightweight deduplication avoids the race without distributed locks.

For a dual meet (2 teams x 8 endpoints = 16 calls): ~3.2 seconds.
For a quad meet (4 teams x 8 endpoints = 32 calls): ~6.4 seconds.
This is acceptable since ingestion is a one-time background operation.

### 5.4 Error Handling

| Scenario | Behavior |
|----------|----------|
| RTN API returns 404 | Record error for that endpoint, continue to next endpoint |
| RTN API returns 500 | Retry once after 1s, then record error and continue |
| RTN API timeout (10s) | Record error for that endpoint, continue |
| Team RTN ID missing | Log warning, skip entire team, record in meta.errors |
| Individual endpoint fails | Other endpoints still succeed; `meta.status = "partial"` |
| All endpoints fail for a team | `meta.status = "error"` for that team; other teams unaffected |
| Firebase write fails | Record error, continue with other teams |
| RTN API returns 200 with empty body | Record status as "empty", store null for that category, continue |
| No `rtnId` in teamsDatabase | Log error and skip that team |

**Partial success behavior:**
- Each endpoint result is stored independently
- `meta.endpointStatus` tracks per-endpoint status with three values: `{ "consistency": "ok", "mvp": "error", "lineup": "empty", ... }`. Values: `"ok"` = data received, `"empty"` = 200 response but no data (empty array/object), `"error"` = fetch failed.
- `meta.status` is "complete" if all endpoints succeed (including "empty" — fetch succeeded, team just has no data yet), "partial" if some fail with "error", "error" if all fail
- `syncStatsToConfig()` proceeds with whatever data is available (e.g., can sync `team1Ave` from teamRanking even if consistency failed)
- The UI distinguishes between "no data available" (endpoint returned empty) and "fetch failed" (endpoint errored) via `meta.endpointStatus`

### 5.5 Staleness & Auto-Refresh

Stats are considered **stale** if `meta.fetchedAt` is older than 24 hours. All `fetchedAt` timestamps use **UTC** via `new Date().toISOString()`. Staleness comparison: `Date.now() - new Date(fetchedAt).getTime() > STALENESS_TTL`. Client-side hooks should parse ISO strings and compare in UTC (which `new Date(isoString)` does automatically).

The staleness check occurs:

1. **On competition creation** -- `ingestCompetitionStats()` checks each team's shared stats; only fetches if stale or missing
2. **Before show start** -- `showStarted` event handler checks staleness; if stale, triggers refresh before taking snapshot
3. **Manual refresh** -- `refreshRtnStats` always fetches fresh data regardless of staleness

The "last fetched" timestamp is always displayed in the UI so the producer knows how fresh the data is.

---

## 6. Client Integration

> **Audit note (E5):** New hooks (`useRtnStats`, `useLeagueRankings`) should register their own socket event listeners directly in useEffect, following the `useAIContext.js` pattern (get socket via `useShow()`, register with `socket.on()`, cleanup with `socket.off()`). Do NOT add RTN-related socket listeners to `ShowContext.jsx`. ShowContext handles core infrastructure events (timesheet, camera, OBS); domain-specific hooks manage their own socket subscriptions.

### 6.1 Hook: `useRtnStats(compId)`

```javascript
// Returns:
{
  stats: {
    team1: { teamRanking, consistency, mvp, topScores, lineup, individualHighs, individualAverages },
    team2: { ... },
    ...
  },
  meta: { fetchedAt, year, gender, week, status, errors, endpointStatus },
  loading: boolean,
  error: string | null,
  refresh: () => void,    // Triggers refreshRtnStats socket event (force refresh)
  isStale: boolean        // True if fetchedAt > 24h ago
}
```

Subscribes to `competitions/{compId}/rtnStats` (snapshot) AND `teamsDatabase/stats/{teamKey}` (shared) depending on context:
- During show: reads from competition snapshot
- Before show: reads from shared store

### 6.2 Hook: `useLeagueRankings(gender)`

```javascript
// Returns:
{
  teamRankings: [{ rank, name, tid, ave, high, rqs, conference }],
  individualRankings: {
    VT: [{ rank, name, team, ave, high, rqs }],
    UB: [...],
    ...
  },
  week: number,
  loading: boolean,
  error: string | null,
  refresh: () => void
}
```

Subscribes to `rtnCache/rankings/{gender}-{year}-{latestWeek}` via Firebase listener.

### 6.3 Auto-Ingestion Flow

**On competition creation (in `useCompetitions.js`):**
1. Existing `enrichTeamsWithRTN()` runs (fetches coach names) -- unchanged
2. After enrichment completes, emit `ingestRtnStats` socket event with `compId`
3. Server checks staleness of each team's shared stats
4. Only fetches from RTN if stale (>24h) or missing
5. Updates shared store, then syncs to competition config
6. Non-blocking -- competition is usable immediately

**Before show start (in server `showStarted` handler):**
1. Check staleness of each team's shared stats
2. If stale, trigger auto-refresh (non-blocking)
3. After refresh (or immediately if fresh), snapshot stats to `competitions/{compId}/rtnStats/`

### 6.4 Manual Override Locks

**In DashboardPage or competition config editor:**
1. Each auto-synced field (Ave, High, Con, Coaches) has a lock toggle icon
2. Clicking lock writes `true` to `competitions/{compId}/config/_locks/{fieldName}`
3. Locked fields show a lock icon and are not overwritten by auto-sync
4. Unlocking removes the lock and allows future auto-sync
5. Manual edits automatically engage the lock (editing a field = implicit lock)

---

## 7. AI Service Integration

### 7.1 aiContextService.js Enhancements

**New data loader:** `_loadRtnStats()` -- reads `competitions/{compId}/rtnStats/` (frozen snapshot) once at show start.

**Enhanced talking point generators:**

| Generator | Data Source | Example Output |
|-----------|------------|----------------|
> **Audit note (F3):** Priority values must use the `PRIORITY` constant from `aiContextService.js:74`: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. The plan originally used "normal" which doesn't exist — corrected to `MEDIUM`.

> **Audit note (F6):** `maxTalkingPoints` defaults to 5. During active scoring, existing generators produce CRITICAL/HIGH points (career highs, margins, standings) that consume most slots. RTN generators at MEDIUM priority will only surface during non-scoring segments (opening, intro, break, rotation start). Matchup generator uses HIGH priority to compete effectively. Consider increasing `maxTalkingPoints` to 8 for intro/break segments where more context is valuable.

| Generator | Data Source | Priority | When | Example Output |
|-----------|------------|----------|------|----------------|
| `_getAthleteStatsTalkingPoints()` | individualAverages, individualHighs | MEDIUM | Non-scoring segments | "Mackenzie Estep averages 9.933 on vault (#2 nationally)" |
| `_getConsistencyTalkingPoints()` | consistency | MEDIUM | Non-scoring segments | "Oklahoma trending up on beam: 49.50 -> 49.68 over last 3 meets" |
| `_getMVPTalkingPoints()` | mvp | MEDIUM | Non-scoring segments | "Addison Fatta leads OU with 157.45 total contribution" |
| `_getLineupTalkingPoints()` | lineup | MEDIUM | Non-scoring segments | "Faith Torrez competed in all 4 meets -- key contributor on VT, UB, BB" |
| `_getTopScoresTalkingPoints()` | topScores | MEDIUM | Non-scoring segments | "OU's theoretical max is 198.75 if everyone hits season highs" |
| `_getMatchupTalkingPoints()` | individualHighs + rankings | HIGH | Rotation start, scoring | "Vault matchup: Estep (9.975 high) vs. Chiles (9.95 high)" |

> **Audit note (F4):** Athlete matching does NOT use `teamsDatabase/headshots/{name}/rtnId` — aiContextService doesn't load headshots data. Instead, match via `this._teamData.team{N}.roster[].rtnId` (populated by `enrichTeamsWithRTN()` after the B-CRIT fix in Task 1). Join key: `teamData` roster `rtnId` ↔ `rtnStats` athlete `rtnId`. Fallback: name matching via existing `_getAthleteFromRoster()` method.

**Athlete matching:** When generating per-athlete talking points, the service matches RTN stats to the Virtius roster using the `rtnId` stored in `competitions/{compId}/teamData/team{N}/roster[].rtnId` (populated by enrichTeamsWithRTN). Unmatched athletes fall back to name matching via the existing `_getAthleteFromRoster()` method and are flagged as "unverified match."

### 7.2 aiSuggestionService.js Enhancements

**Enhanced confidence scoring:**
- `HAS_RTN_STATS` factor: +0.15 if `rtnStats` loaded (vs only dashboard data)
- `HAS_INDIVIDUAL_STATS` factor: +0.1 if individual averages/highs available
- `HAS_RANKINGS` factor: +0.05 if league rankings available

**New segment suggestions:**
- "Athlete Spotlight: [top MVP contributor]" -- high confidence when MVP data available
- "Event Preview: [event where teams are closest]" -- uses individual averages for matchup analysis
- "Senior Feature: [senior with highest contribution]" -- combines MVP + roster year data

### 7.3 Normalized Data Contract for AI Consumers

AI services consume stats through a consistent interface. Each team's stats object has this shape:

```javascript
{
  teamRanking: { rank, ave, high, rqs, conference } | null,
  consistency: { labels: string[], events: { [eventCode]: number[] } } | null,
  mvp: [{ rtnId, fullName, events: { [eventCode]: number|null }, total }] | null,
  topScores: { theoreticalMax, events: { [eventCode]: [{ rtnId, fullName, high }] } } | null,
  lineup: [{ rtnId, fullName, meets: number[], rate }] | null,
  individualHighs: [{ rtnId, fullName, events: { [eventCode]: number|null } }] | null,
  individualAverages: [{ rtnId, fullName, events: { [eventCode]: number|null } }] | null,
}
```

Event codes are always normalized: `VT`, `UB`, `BB`, `FX`, `AA` (women) or `FX`, `PH`, `SR`, `VT`, `PB`, `HB`, `AA` (men). AI generators should null-check each field since partial ingestion means some may be missing.

---

## 8. Key Design Decisions

### 8.1 Shared Stats Store (Not Per-Competition)

Stats are written to `teamsDatabase/stats/{teamKey}/`, NOT directly to each competition. Reasons:

1. **Same team, many competitions** -- Oklahoma competes in 10+ meets; storing stats per-competition wastes storage and requires re-fetching
2. **Freshness is simple** -- One `fetchedAt` timestamp per team, easy staleness check
3. **Any competition can reference** -- New competition gets instant stats if team data is fresh
4. **Competition snapshot for archival** -- Frozen copy at show start provides point-in-time data

### 8.2 RTN IDs from Virtius (Not RTN Lookup)

RTN team and athlete IDs are sourced from the Virtius API during Media Manager setup, not discovered via RTN name matching. Reasons:

1. **Virtius is authoritative** -- Already used for live scoring, roster is source of truth
2. **RTN IDs are in Virtius data** -- Available alongside headshot URLs and other athlete metadata
3. **No fuzzy name matching** -- Avoids unreliable name-based lookups
4. **Stored once, used everywhere** -- IDs persist in `teamsDatabase` and are available for any future use

### 8.3 Config Auto-Sync with Manual Override Locks

`syncStatsToConfig()` writes to `team{N}Ave`, `team{N}High`, `team{N}Con` but respects `_locks`.

> **Audit note (A4):** `team{N}Con` in existing competitions contains a **rank string** (e.g., "#1", "#5"), not a standard deviation or percentage. `syncStatsToConfig` must write `team{N}Con` as `"#" + teamRanking.rank` to match the format expected by graphics. Example: rank "3(t)" becomes "#3(t)".

Reasons:

1. **Producers sometimes know better** -- RTN data may have errors; producers need to override
2. **Coach names already have this problem** -- Coaches are synced from RTN dashboard; same lock mechanism applies
3. **Explicit > implicit** -- Editing a field auto-locks it; producer must explicitly unlock to re-enable sync

### 8.4 Week-Based Rankings (Not Daily)

Rankings use week-based caching with RTN's week number as the key. Reasons:

1. **Daily results are too dynamic** -- Not all teams have competed yet on any given day
2. **Weekly view is representative** -- All teams in a week have competed, making rankings meaningful
3. **Simpler cache logic** -- One cache entry per week per gender, 24h TTL

### 8.5 Rate Limiting is Per-Competition and Conservative

200ms between requests within a serial queue per competition. Reasons:

1. **RTN is a community resource** -- Official NCAA system with no published rate limits
2. **Being a good citizen** -- Conservative throttling is better than risking rate-limiting or bans
3. **One-time cost** -- Stats are fetched once per team, not repeatedly, so the delay is negligible
4. **Per-competition isolation** -- Two simultaneous ingestions don't queue behind each other

### 8.6 Roster Authority: Virtius, Not RTN

The Virtius roster is the source of truth for athlete names and lineup. RTN data supplements with historical stats. Reasons:

1. **Live scoring uses Virtius** -- Score data references Virtius athlete IDs
2. **Roster consistency** -- No confusion about which roster is "real"
3. **RTN may have different spellings** -- Nicknames, suffixes, etc.
4. **Join via RTN ID** -- `rtnId` on headshot records provides the link without name matching

---

## 9. RTN API Reliability

RTN is the official statistics system for NCAA gymnastics and is reliable during the season. However:

1. **Off-season** -- Endpoints may return empty data or errors between seasons
2. **Year rollover** -- The `year` parameter must match the current season. Default to `new Date().getFullYear()`. NCAA gymnastics season runs January–April, so the season year always matches the calendar year (unlike sports that span two calendar years). This default should be passed consistently across all RTN API calls within a single ingestion.
3. **Schema changes** -- While unlikely, RTN could change response format without notice

**Fallback behavior:**
- If RTN is unreachable, stats ingestion fails gracefully with `meta.status = "error"`
- Existing stats in the shared store remain available (last known good data)
- The UI shows the error state and "last fetched" timestamp so producers know the data is stale
- Manual entry remains possible as a fallback for all auto-synced fields

---

## 10. Critical Files Reference

| File | Purpose | Action |
|------|---------|--------|
| `server/lib/rtnStatsService.js` | RTN fetching, normalization, Firebase writes | **CREATE** |
| `server/index.js` | Wire socket events, show start snapshot | MODIFY |
| `show-controller/src/hooks/useRtnStats.js` | React hook for stats data | **CREATE** |
| `show-controller/src/hooks/useLeagueRankings.js` | React hook for rankings data | **CREATE** |
| `show-controller/src/hooks/useCompetitions.js` | Trigger ingestion after enrichment | MODIFY |
| `show-controller/src/pages/DashboardPage.jsx` | Stats status indicator, refresh, locks | MODIFY |
| `server/lib/aiContextService.js` | Consume rtnStats for talking points | MODIFY |
| `server/lib/aiSuggestionService.js` | Consume rtnStats for suggestions | MODIFY |
| `show-controller/src/lib/roadToNationals.js` | Existing RTN client (reference, not modified) | REFERENCE |
| `server/lib/productionConfigService.js` | Pattern for Firebase Admin SDK (`getDb()`) | REFERENCE |
| Media Manager components | Add RTN ID capture during team setup | MODIFY |
