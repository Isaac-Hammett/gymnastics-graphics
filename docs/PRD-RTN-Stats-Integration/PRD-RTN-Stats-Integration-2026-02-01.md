# PRD: RTN Statistics Integration

**Version:** 2.0
**Date:** 2026-02-01
**Status:** In Progress
**Last Updated:** 2026-02-01 (Task 2 complete)

---

## 1. Problem Statement

The broadcast system has limited access to team and athlete statistics. Currently:

1. **Team averages and highs are manually entered** - Producers type `team{N}Ave` and `team{N}High` into the competition config by hand
2. **Coach names are the only RTN data fetched** - The existing `enrichTeamsWithRTN()` pulls the dashboard endpoint but only syncs coach names to config
3. **Individual athlete stats don't exist** - No per-athlete averages, season highs, or event-specific data in the system
4. **No RTN IDs stored for athletes** - RTN athlete IDs are available in Virtius but not captured during team setup, making individual stat lookups impossible
5. **League rankings are not tracked** - No national/conference rankings for teams or individuals
6. **AI talking points lack depth** - The AI context and suggestion services generate generic commentary because they don't have rich statistical data
7. **Road To Nationals API is underutilized** - We only use the `dashboard` endpoint for coach names; RTN provides 8 additional endpoints with detailed stats

The result: talent gets shallow talking points, graphics show manually-entered (often outdated) stats, and producers spend time looking up data that could be automated.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Automated Stats Ingestion** | Fetch all available RTN data automatically when a competition is created and before show start, replacing manual entry |
| **Shared Team Stats Store** | Store team stats in a shared `teamsDatabase/stats/` path so any competition can reference them without re-fetching |
| **Individual Athlete Stats** | Per-athlete averages, highs, lineup frequency, MVP standings accessible system-wide |
| **RTN ID Capture in Media Manager** | Store RTN IDs for teams and individual athletes during team setup (sourced from Virtius) |
| **League Rankings** | National and conference rankings for teams and individuals, updated weekly |
| **Richer AI Talking Points** | Feed stats into AI context and suggestion services for deeper commentary |
| **Manual Override Locks** | Allow producers to lock auto-synced config fields (Ave, High, Con, Coaches) to prevent overwrites |
| **Zero Graphics Pipeline Changes** | Auto-sync stats to existing config fields so graphics work without modification |

---

## 3. User Stories

### Story 1: Producer Creates Competition with Auto-Filled Stats

**As a** Producer setting up a UCLA vs Oregon meet
**I want** team averages, highs, and rankings to auto-populate from RTN
**So that** I don't have to manually look up and type stats

**Flow:**
1. Create competition, select teams
2. System checks `teamsDatabase/stats/{teamKey}` for existing stats
3. If stats are missing or stale (>24h old), server fetches all RTN endpoints for each team
4. Fresh stats stored in shared `teamsDatabase/stats/{teamKey}/`
5. Snapshot of current stats copied to `competitions/{compId}/rtnStats/` for this competition
6. `team{N}Ave`, `team{N}High`, `team{N}Con` auto-populate in config (unless manually locked)
7. Stats status indicator shows "Stats loaded" with timestamp
8. Graphics immediately show correct, up-to-date stats

**Acceptance:**
- [ ] Config fields auto-populated from RTN data
- [ ] Stats status indicator visible on Dashboard with "last fetched" timestamp
- [ ] Graphics show correct stats without manual entry
- [ ] Stale stats auto-refresh (>24h old)

---

### Story 2: Producer Views Detailed Team Stats

**As a** Producer preparing for a broadcast
**I want** to see each team's consistency trends, MVP standings, lineup frequency, and top scores
**So that** I can plan segments and talking points around the data

**Flow:**
1. Navigate to competition dashboard
2. See stats panel for each team showing:
   - Event-by-event consistency over season (chart/trend)
   - MVP standings (athlete contribution totals)
   - Top scores per event (best possible lineup)
   - Lineup frequency per athlete
   - Individual averages and highs per event
3. Click "Refresh Stats" to pull latest data from RTN

**Acceptance:**
- [ ] All 8 RTN stat categories displayed per team
- [ ] Refresh button triggers re-fetch from RTN and updates shared store
- [ ] Data persists in Firebase across sessions

---

### Story 3: Producer Views Individual Athlete Stats

**As a** Producer researching athletes before a broadcast
**I want** per-athlete stats (averages, highs, lineup rate) for every rostered gymnast
**So that** I can identify storylines and key matchups

**Flow:**
1. View any team's roster in the stats panel
2. Each athlete shows:
   - Per-event average scores
   - Per-event season high scores
   - Lineup rate (% of meets competed)
   - MVP contribution total
3. Compare athletes across teams for head-to-head matchups

**Acceptance:**
- [ ] Individual averages and highs displayed per athlete per event
- [ ] Athletes matched by RTN ID (captured from Virtius during team setup)
- [ ] Lineup rate shown per athlete
- [ ] Athletes sortable/filterable by event

---

### Story 4: Talent Receives Rich AI Talking Points

**As a** Commentator during a live broadcast
**I want** the AI to provide specific, stats-backed talking points
**So that** my commentary includes accurate numbers and trends

**Examples of enhanced talking points:**
- "Mackenzie Estep leads the nation at #2 on vault with a 9.933 average"
- "Oklahoma trending up on beam -- 49.50, 49.48, 49.68, 49.48 over last 4 meets"
- "Addison Fatta is OU's MVP with 157.45 total contribution across all events"
- "Faith Torrez has competed in all 4 meets this season on vault, bars, and beam"
- "Oklahoma's theoretical max is 198.75 if everyone hits their season highs"

**Acceptance:**
- [ ] AI talking points reference individual athlete stats
- [ ] Consistency trends mentioned for relevant events
- [ ] National rankings included when available

---

### Story 5: Producer Views League Rankings

**As a** Producer preparing matchup graphics
**I want** current national rankings for teams and individuals
**So that** graphics and commentary reference accurate rankings

**Flow:**
1. System fetches weekly team and individual rankings from RTN
2. Rankings cached in Firebase with weekly scope
3. Individual rankings available per event (VT, UB, BB, FX, AA for women; FX, PH, SR, VT, PB, HB, AA for men)
4. AI talking points reference national rankings ("Ranked #3 nationally on beam")

**Acceptance:**
- [ ] Team rankings fetched and cached by week
- [ ] Individual event rankings fetched per event
- [ ] Rankings accessible to AI services
- [ ] Rankings available for graphics

---

### Story 6: Media Manager Captures RTN IDs

**As a** Producer setting up a team in the Media Manager
**I want** RTN IDs for both the team and each individual athlete captured automatically from Virtius
**So that** the system can look up RTN stats for any athlete at any time

**Flow:**
1. Producer sets up a team in Media Manager (existing flow)
2. System fetches roster from Virtius (existing)
3. System also captures RTN team ID and per-athlete RTN IDs from Virtius data
4. RTN IDs stored in `teamsDatabase/teams/{teamKey}/rtnId` and per-athlete in headshots records
5. Media Manager verification checklist includes RTN ID status

**Acceptance:**
- [ ] Team RTN ID stored in `teamsDatabase/teams/{teamKey}/rtnId`
- [ ] Individual athlete RTN IDs stored alongside headshot records
- [ ] Media Manager shows RTN ID status in verification checklist
- [ ] Missing RTN IDs flagged as warnings (not blockers)

---

### Story 7: Producer Locks Config Fields to Prevent Auto-Overwrite

**As a** Producer who has manually corrected a team average or coach name
**I want** to lock that field so the system doesn't overwrite my correction
**So that** my manual edits are preserved across stats refreshes

**Flow:**
1. Producer edits `team1Ave` (or team1High, team1Con, team1Coaches) manually
2. A lock icon appears next to the field
3. On next stats refresh, locked fields are skipped
4. Producer can unlock to re-enable auto-sync

**Acceptance:**
- [ ] Lock persists in Firebase at `competitions/{compId}/config/_locks`
- [ ] Auto-sync respects locks for Ave, High, Con, and Coaches fields
- [ ] Lock/unlock toggle visible in UI
- [ ] Locks survive page refresh

---

## 4. Phase Overview

| Phase | Name | Priority | Goal | Tasks |
|-------|------|----------|------|-------|
| **1** | RTN ID Capture & Shared Stats Store | P0 | Store RTN IDs, create shared stats store, fetch all RTN endpoints | 1-7 |
| **2** | Client Integration & Config Sync | P0 | Hooks, auto-ingestion, UI controls, manual override locks | 8-14 |
| **3** | League Rankings | P1 | Team + individual national/conference rankings | 15-17 |
| **4** | AI Enhancement | P1 | Feed stats into AI context and suggestion services | 18-21 |
| **5** | Playwright Integration Tests | P1 | End-to-end tests for all features | 22-24 |

---

## 5. Success Criteria

### Phase 1 Complete When:
- [ ] RTN IDs captured for teams and athletes during Media Manager setup
- [ ] Server service fetches all 8 RTN stat endpoints per team
- [ ] Data normalized and written to shared `teamsDatabase/stats/{teamKey}/`
- [ ] Competition snapshot copied to `competitions/{compId}/rtnStats/`
- [ ] `team{N}Ave`, `team{N}High` auto-synced to competition config
- [ ] Socket events (`ingestRtnStats`, `refreshRtnStats`) functional
- [ ] Rate limiting prevents hammering RTN API
- [ ] Partial failures handled gracefully (per-endpoint, per-team)

### Phase 2 Complete When:
- [ ] `useRtnStats` hook provides real-time access to stats data
- [ ] Stats auto-fetch on competition creation (non-blocking)
- [ ] Auto-refresh before show start if stats are stale (>24h)
- [ ] "Stats loaded" indicator visible on Dashboard with last-fetched timestamp
- [ ] "Refresh Stats" button works
- [ ] Manual override locks prevent auto-sync on locked fields
- [ ] Ave/High fields show "from RTN" indicator when auto-filled

### Phase 3 Complete When:
- [ ] Team rankings fetched and cached at `rtnCache/rankings/`
- [ ] Week-based cache (not daily) for stable rankings
- [ ] Individual event rankings fetched per event
- [ ] Rankings available via `useLeagueRankings` hook
- [ ] AI talking points reference national rankings

### Phase 4 Complete When:
- [ ] AI talking points include individual athlete stats (averages, highs)
- [ ] Consistency trend analysis in talking points ("trending up on beam")
- [ ] Head-to-head matchup comparisons between athletes
- [ ] MVP/lineup context in talking points

### Phase 5 Complete When:
- [ ] Playwright tests verify stats ingestion flow end-to-end
- [ ] Playwright tests verify config auto-sync and manual lock behavior
- [ ] Playwright tests verify AI talking points contain stats-backed content
- [ ] Tests run against production after deploy

---

## 6. RTN API Reference

### Endpoint Map

All endpoints follow pattern: `https://www.roadtonationals.com/api/{gender}/...`

| Endpoint | Description | Key Fields |
|----------|-------------|------------|
| `/{gender}/dashboard/{year}/{tid}` | Team overview (currently used for coaches only) | info, staff, ranks, meets, roster |
| `/{gender}/results/{year}/{week}/0/{type}` | Team rankings | rank, ave, high, rqs, conference, region |
| `/{gender}/results/{year}/{week}/1/{event}` | Individual rankings (~500+ athletes) | rank, name, team, ave, high, rqs |
| `/{gender}/teamConsistency/{year}/{tid}` | Per-meet event scores over season | date labels, VT/UB/BB/FX score arrays |
| `/{gender}/mvp/{year}/{tid}` | Athlete contribution totals | per-athlete cumulative event sums |
| `/{gender}/topscores/{year}/{tid}` | Best possible lineup | top 5 per event highs, theoretical max |
| `/{gender}/lineup/{year}/{tid}` | Meet-by-meet lineup usage | binary arrays per athlete |
| `/{gender}/rostermain/{year}/{tid}/2` | Individual high scores | per-athlete max per event |
| `/{gender}/rostermain/{year}/{tid}/3` | Individual averages | per-athlete avg per event |

### Event Codes for Individual Rankings

| Gender | Event 1 | Event 2 | Event 3 | Event 4 | Event 5 | Event 6 | Event 7 |
|--------|---------|---------|---------|---------|---------|---------|---------|
| Women | 1=VT | 2=UB | 3=BB | 4=FX | 5=AA | -- | -- |
| Men | 1=FX | 2=PH | 3=SR | 4=VT | 5=PB | 6=HB | 7=AA |

### Team Rankings Type Codes

| Gender | Type | Description |
|--------|------|-------------|
| Women | 5 | Overall team rankings |
| Men | 7 | Overall team rankings |

### RTN Team ID Source

RTN team IDs (`tid`) originate from the Virtius API. They are captured during team setup in the Media Manager and stored in:
- **Team level:** `teamsDatabase/teams/{teamKey}/rtnId`
- **Athlete level:** `teamsDatabase/headshots/{athlete-name}/rtnId`

The stats service reads these IDs for all subsequent RTN API calls. If an RTN ID is missing, the service logs a warning and skips that team/athlete.

---

## 7. Data Storage Architecture

### Shared Stats Store (Source of Truth)

Stats are stored in a **shared location** accessible to any competition:

```
teamsDatabase/stats/{teamKey}/
  consistency/          -- Event scores over time
  mvp/                  -- Athlete contribution totals
  topScores/            -- Best possible lineup
  lineup/               -- Meet-by-meet lineup usage
  individualHighs/      -- Per-athlete max scores
  individualAverages/   -- Per-athlete avg scores
  teamRanking/          -- Team's position in league
  meta/
    fetchedAt           -- ISO timestamp
    rtnId               -- RTN team ID used
    status              -- "complete" | "partial" | "error"
    errors              -- Per-endpoint error details
```

### Competition Snapshot (Frozen at Show Start)

When a show starts, current stats are copied to the competition for archival:

```
competitions/{compId}/rtnStats/
  team1/                -- Copied from teamsDatabase/stats/{teamKey}
  team2/
  snapshotTakenAt       -- ISO timestamp
```

### Why Two Locations

1. **Shared store** avoids re-fetching the same team's stats for every competition
2. **Competition snapshot** freezes data at show start so mid-show refreshes for other competitions don't change live talking points
3. Post-show analytics can compare "what we knew" vs "what happened"

---

## 8. Terminology

| Term | Definition |
|------|------------|
| **RTN** | Road To Nationals (roadtonationals.com) -- official system for NCAA gymnastics statistics |
| **RQS** | Ranking Qualifying Score -- NCAA formula: top 6 scores, 3+ away, drop highest, average remaining 5 |
| **NQS** | National Qualifying Score -- used interchangeably with RQS in some contexts |
| **MVP** | RTN's "Most Valuable Player" metric -- cumulative sum of all event scores across the season |
| **Top Scores** | Best possible lineup -- each athlete's season high on each event; theoretical max if everyone hits their best |
| **Consistency** | Per-meet event scores over time -- shows whether a team is trending up, down, or stable |
| **Lineup Rate** | Percentage of meets an athlete has competed in |
| **Shared Stats Store** | Firebase path `teamsDatabase/stats/{teamKey}/` storing normalized RTN data per team |
| **Competition Snapshot** | Frozen copy of stats at `competitions/{compId}/rtnStats/` taken at show start |
| **Config Lock** | Manual override flag at `competitions/{compId}/config/_locks` preventing auto-sync for specific fields |
| **Auto-Sync** | Process of writing RTN-derived values to `team{N}Ave`/`team{N}High`/`team{N}Con` in competition config |

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| [PLAN-RTN-Stats-Integration-2026-02-01.md](./PLAN-RTN-Stats-Integration-2026-02-01.md) | Technical architecture, data model, API normalization, error handling |
| [PLAN-RTN-Stats-Integration-Implementation.md](./PLAN-RTN-Stats-Integration-Implementation.md) | Implementation task tracking (use this for day-to-day execution) |
