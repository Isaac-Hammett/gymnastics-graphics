# Spec: Firebase Scoring Paths

## What

The exact Firebase path structure for scoring data, config paths, and the write strategy the ingestion service will use.

## Current State

### Does `scoring/` Exist Today?

**No.** The `competitions/{compId}/scoring/` path does not exist anywhere in the current production system. It is planned for Phase 3.

**Evidence:**
- Searched entire codebase for `scoring/leaderboard` — zero matches in server code
- The Phase 2 spec (`phase-2/specs/firebase-scoring-paths.md`) confirms this
- output.html fetches directly from Virtius API in the browser, no Firebase intermediate

### Existing Related Paths

| Path | Purpose | Used By |
|------|---------|---------|
| `competitions/{compId}/config/virtiusSessionId` | Virtius session ID for API calls | output.html:8422 |
| `competitions/{compId}/scoreBug/` | Score bug overlay state (different feature) | team-bug.html, ScoreBugPanel.jsx |
| `teamsDatabase/teams/{teamKey}/logo` | Team logos (lookup source) | Various |
| `teamsDatabase/stats/{teamKey}/` | RTN season stats (different data) | rtnStatsService.js |

## Target State

### Scoring Data Paths

**Root:** `competitions/{compId}/scoring/`

| Path | Content | Updated By |
|------|---------|------------|
| `scoring/leaderboard/VT` | Vault leaderboard | Ingestion service |
| `scoring/leaderboard/FX` | Floor leaderboard | Ingestion service |
| `scoring/leaderboard/PH` | Pommel Horse leaderboard (men's only) | Ingestion service |
| `scoring/leaderboard/SR` | Still Rings leaderboard (men's only) | Ingestion service |
| `scoring/leaderboard/PB` | Parallel Bars leaderboard (men's only) | Ingestion service |
| `scoring/leaderboard/HB` | High Bar leaderboard (men's only) | Ingestion service |
| `scoring/leaderboard/UB` | Uneven Bars leaderboard (women's only) | Ingestion service |
| `scoring/leaderboard/BB` | Balance Beam leaderboard (women's only) | Ingestion service |
| `scoring/leaderboard/AA` | All-Around leaderboard | Ingestion service |
| `scoring/teamTotals` | Running team scores | Ingestion service |
| `scoring/rotationState` | Current rotation info | Ingestion service |
| `scoring/allAround` | AA rankings (duplicate of leaderboard/AA?) | See notes |
| `scoring/updatedAt` | Last write timestamp (ISO string) | Ingestion service |

**Note:** The PRD lists both `scoring/leaderboard/AA` and `scoring/allAround`. These may be redundant — the leaderboard path stores the same data. Recommend using only `scoring/leaderboard/AA` to match the pattern. If `allAround` has a different schema (per-event breakdown vs single total), document that difference.

### Leaderboard Schema

```json
{
  "apparatus": "VT",
  "apparatusLabel": "Vault",
  "gender": "womens",
  "rows": [
    {
      "rank": 1,
      "name": "Taylor Ingle",
      "team": "SEMO",
      "teamLogo": "https://media.virti.us/upload/images/team/...",
      "apparatus": "VT",
      "score": 9.850,
      "diff": 5.200,
      "exec": 4.650,
      "stickBonus": false,
      "isTied": false
    },
    {
      "rank": 2,
      "name": "Maribelle Albert",
      "team": "Alaska",
      "teamLogo": "https://...",
      "apparatus": "VT",
      "score": 9.825,
      "diff": 5.100,
      "exec": 4.725,
      "stickBonus": true,
      "isTied": false
    }
  ],
  "updatedAt": "2026-03-28T14:30:00.000Z"
}
```

**Field notes:**
- `diff`, `exec`, `stickBonus` — only present for men's events
- `isTied` — true if another gymnast has the same rank (computed by service)
- `rank` — gap ranking (1, 2, 2, 4) not dense (1, 2, 2, 3)
- `score` — float, always 3 decimal precision
- `rows` — limited to top 10

### Team Totals Schema

```json
{
  "teams": [
    {
      "name": "SEMO",
      "logo": "https://...",
      "total": 196.425,
      "events": {
        "VT": 49.125,
        "UB": 48.950,
        "BB": 49.100,
        "FX": 49.250
      }
    }
  ],
  "updatedAt": "2026-03-28T14:30:00.000Z"
}
```

### Rotation State Schema

```json
{
  "currentRotation": 3,
  "rotationStatus": "in_progress",
  "teamPositions": [
    { "team": "SEMO", "apparatus": "BB", "rotation": 3 },
    { "team": "Alaska", "apparatus": "FX", "rotation": 3 }
  ],
  "updatedAt": "2026-03-28T14:30:00.000Z"
}
```

**`rotationStatus` values:** `"in_progress"`, `"completed"`, `"not_started"`

### All-Around Schema (if different from leaderboard)

```json
{
  "rows": [
    {
      "rank": 1,
      "name": "Taylor Ingle",
      "team": "SEMO",
      "teamLogo": "https://...",
      "total": 39.525,
      "events": {
        "VT": 9.850,
        "UB": 9.875,
        "BB": 9.900,
        "FX": 9.900
      },
      "isTied": false
    }
  ],
  "updatedAt": "2026-03-28T14:30:00.000Z"
}
```

**Difference from apparatus leaderboards:**
- No `apparatus` field (it's aggregate)
- Includes `events` breakdown with per-event scores
- No `diff`, `exec`, `stickBonus` (not applicable to totals)

### Config Paths

**Root:** `competitions/{compId}/config/scoringFeed/`

```json
{
  "enabled": true,
  "pollInterval": 15,
  "lastPollAt": "2026-03-28T14:30:00.000Z",
  "status": "ok",
  "errorMessage": null
}
```

| Field | Type | Written By | Read By |
|-------|------|------------|---------|
| `enabled` | boolean | Producer (toggle) | Ingestion service |
| `pollInterval` | number (seconds) | Producer (dropdown) | Ingestion service |
| `lastPollAt` | ISO timestamp | Ingestion service | Producer UI (display) |
| `status` | "ok" \| "error" \| "completed" | Ingestion service | Producer UI (badge) |
| `errorMessage` | string \| null | Ingestion service | Producer UI (display) |

**Related config (already exists):**
- `config/virtiusSessionId` — the session to poll
- `config/gender` — "mens" or "womens", determines apparatus list

### Write Strategy

**PRD requirement:** Use `.update()` on individual subpaths, not `.set()` on the root.

```javascript
// CORRECT
const scoringRef = db.ref(`competitions/${compId}/scoring`);
await scoringRef.child(`leaderboard/VT`).update(leaderboardData);
await scoringRef.child(`leaderboard/FX`).update(leaderboardData);
await scoringRef.child('teamTotals').update(teamTotalsData);
await scoringRef.child('rotationState').update(rotationStateData);
await scoringRef.child('updatedAt').set(new Date().toISOString());

// WRONG — destroys sibling data if some apparatus fail to process
await scoringRef.set({ leaderboard: { VT: {...}, FX: {...} } });
```

**Why:** If processing fails for one apparatus, using `.set()` on the root would delete all other apparatus data. Using `.update()` on each subpath preserves successful writes.

## Risks

1. **Orphaned data:** If an apparatus is removed from a meet (e.g., exhibition event), its leaderboard data remains in Firebase. Need cleanup strategy or TTL.

2. **Schema drift:** If the service writes fields the block doesn't expect, or vice versa, rendering breaks. Version the schema or use TypeScript types.

3. **AA path ambiguity:** PRD shows both `scoring/leaderboard/AA` and `scoring/allAround`. Pick one and document it.

## Open Questions

1. **Should `scoring/allAround` exist separately from `scoring/leaderboard/AA`?**
   - If AA has the same schema as other leaderboards, use `leaderboard/AA` only.
   - If AA needs per-event breakdown, use `allAround` with the extended schema.

2. **What apparatus codes should the service use?**
   - Virtius API returns: "Floor Exercise", "FLOOR", etc.
   - Should normalize to: "FX", "PH", "SR", "VT", "PB", "HB", "UB", "BB", "AA"

3. **Should `rotationState` include teams with byes?**
   - In 7-team womens meets, 3 teams have a bye each rotation.
   - Should `teamPositions` include `{ team: "X", apparatus: "BYE", rotation: 3 }`?

4. **What happens when a competition has no scores yet?**
   - Should the service write empty arrays?
   - Or not write anything (let the path not exist)?
