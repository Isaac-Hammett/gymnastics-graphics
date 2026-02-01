# Audit Category A: Live Firebase Data vs Plan Schema

**Date:** 2026-02-01
**Test Fixtures:**
- Competition: `z1fxcup2` (Navy vs Springfield, mens-dual)
- Team: `navy-mens`, `michigan-womens`
- Headshot: `anna lee dobson`
- Dashboard cache: `womens-12` (Bridgeport)

---

## A1: `teamsDatabase/teams/{teamKey}` field inventory

**Plan says:** Has fields: displayName, gender, logo, school, roster, updatedAt, rtnId (NEW)

**Actual (`navy-mens`):**
```json
{
  "displayName": "Navy Men's",
  "gender": "mens",
  "logo": "https://media.virti.us/upload/images/team/...",
  "roster": ["Aaron Stein", "Aaron Zorgo", ...],  // Array of strings
  "school": "Navy",
  "updatedAt": "2026-01-09T18:25:08.975Z"
}
```

**Actual (`michigan-womens`):**
```json
{
  "displayName": "Michigan Women's",
  "gender": "womens",
  "logo": "https://media.virti.us/upload/images/team/...",
  "school": "Michigan",
  "updatedAt": "2026-01-09T18:25:09.854Z"
}
```

**Findings:**
- PASS: Fields displayName, gender, logo, school, updatedAt exist as expected
- INFO: `roster` exists on `navy-mens` (array of name strings) but is MISSING on `michigan-womens`. Roster is not universally present.
- PASS: `rtnId` does NOT yet exist (expected — plan creates it)

**Result: PASS**

---

## A2: `teamsDatabase/headshots/{name}` field inventory

**Plan says:** Has fields: name, teamKey, url, updatedAt, rtnId (NEW)

**Actual (`anna lee dobson`):**
```json
{
  "name": "Anna Lee Dobson",
  "teamKey": "cortland-womens",
  "updatedAt": "2026-01-31T00:00:00.000Z",
  "url": "https://media.virti.us/upload/images/athlete/..."
}
```

**Findings:**
- PASS: Fields name, teamKey, url, updatedAt exist as expected
- PASS: `rtnId` does NOT yet exist (expected — plan creates it)

**Result: PASS**

---

## A3: `teamsDatabase/stats/{teamKey}/` (NEW path)

**Plan says:** This is a NEW path created by the plan for shared stats.

**Actual:** `teamsDatabase/stats` does not exist (`firebase_get` returned null)

**Findings:**
- PASS: Path is empty/null. No conflicts with existing data.

**Result: PASS**

---

## A4: `competitions/{compId}/config` field inventory

**Plan says:** Has team1Ave, team1High, team1Con, team1Coaches, etc. (strings)

**Actual (`z1fxcup2` — mens-dual):**
```
team1Ave: "311.100"       (string)
team1High: "320.700"      (string)
team1Con: "#1"            (string — NOT a percentage or std dev)
team1Coaches: "Kip Simons\nCraig Holt\nRyan Terrill"  (newline-separated string)
team1Name: "Navy"
team1Tricode: "NAVY"
team1Logo: "https://..."
team2Ave: "304.861"       (string)
team2High: "309.350"      (string)
team2Con: "#5"            (string)
team2Coaches: "Matthew Davis\nKael Donley\n..."
team3Ave through team6Ave: "0.000" (string, placeholder)
team3Con through team6Con: "0%" (string, placeholder)
team3Coaches through team6Coaches: "Coach Name"
compType, eventName, hosts, location, meetDate, venue, virtiusSessionId
```

**Findings:**
- PASS: team{N}Ave and team{N}High exist and are strings as plan expects
- **FAIL**: `team{N}Con` is currently "#1", "#5" — this looks like a **rank** (e.g., #1 consistency rank), NOT a standard deviation or percentage. The plan (Task 6) says "Computes team{N}Con from consistency data (standard deviation of recent scores)." The current values are rank-style strings like "#1", not "0.95" or "97.2%". Writing a computed std dev here would change the format currently displayed in graphics.
- PASS: team{N}Coaches is a newline-separated string
- INFO: Config has team3 through team6 placeholders with "0.000" / "0%" / "Coach Name" defaults — the plan's `syncStatsToConfig` must handle teams 1-6 (not just 1-2)
- INFO: Config fields compType, eventName, hosts, location, meetDate, venue, virtiusSessionId are also present

**Result: FAIL** — `team{N}Con` format mismatch needs plan update

---

## A5: `competitions/{compId}/teamData` structure

**Plan says:** Populated by `enrichTeamsWithRTN()`. Plan checks if it contains `rtnId` for teams/athletes.

**Actual (`z1fxcup2/teamData`):**
```
team1/
  coaches: [{firstName, fullName, id, imageUrl, lastName, position}, ...]
  fetchedAt: "2026-01-10T18:34:21.083Z"
  links: {facebook, officialSite, twitter}
  rankings: {floor: 0}
  roster: [{firstName, fullName, headshotUrl, hometown, id, lastName, year}, ...]
  schedule: [{away, date, description, home, meetId, opponent}, ...]
team2/ (same structure)
```

**Findings:**
- INFO: `teamData` is rich — includes coaches, roster (with Virtius athlete IDs as `id`), schedule, rankings, links
- **FAIL**: No `rtnId` field anywhere in `teamData`. The plan says fallback is `teamData/team{N}/rtnId` (Technical Plan Section 3.4, step 2). This fallback path does NOT exist and is never populated by current code.
- INFO: Athlete roster entries have `id` fields (e.g., "8420") — these are Virtius IDs, NOT RTN IDs
- INFO: Coach entries have `id` fields (e.g., "22") — these appear to be RTN staff IDs based on the `imageUrl` pattern (`roadtonationals.com/images/staff/22.jpg`)
- INFO: The `rankings` field exists but only has `{floor: 0}` — seems incomplete/unused

**Result: FAIL** — Plan's fallback path `teamData/team{N}/rtnId` is fictional; needs removal or implementation

---

## A6: `competitions/{compId}/config/_locks` (NEW path)

**Plan says:** NEW path for manual override locks, stored as `_locks` child of `config`

**Actual:** Does not exist (as expected for new feature)

**Safety check — does existing code iterate `config` children?**
- Server: Reads specific sub-paths (`config/talentComms`, `config/vmAddress`) — no enumeration
- Client: `useCompetitions.js` uses `Object.keys(configUpdates)` but on a local variable, not the Firebase config object
- No code enumerates all children of `config/`

**Findings:**
- PASS: Path doesn't exist yet (expected)
- PASS: Adding `_locks` as a child of `config` won't break existing code — nothing iterates config children
- INFO: Underscore prefix is a good convention to signal "internal/meta" data

**Result: PASS**

---

## A7: `rtnCache/` existing structure

**Plan says:** Existing dashboards at `rtnCache/dashboards/`. New `rankings/` path will coexist.

**Actual structure:**
```
rtnCache/
  dashboards/          -- 33 entries (e.g., "womens-12", "mens-1")
  womens/              -- {data: {teams: [...], year: "2026"}, fetchedAt, timestamp}
  mens/                -- Same structure
```

**Findings:**
- PASS: `dashboards/` exists as plan expects
- **INFO**: `rtnCache/womens/` and `rtnCache/mens/` also exist — these are the team directory caches (list of all teams with name, id, location, head coach). The plan doesn't mention these but they don't conflict with the new `rankings/` path.
- PASS: `rankings/` does not exist yet — no conflict with planned path
- INFO: Dashboard cache keys are `{gender}-{tid}` format (e.g., "womens-12" = Bridgeport). Each contains `data` (full RTN dashboard response), `fetchedAt`, `timestamp`.
- INFO: The RTN dashboard roster includes athlete RTN IDs (e.g., `"id": "32131"` for Quinn Aiken on Bridgeport). This is **critical** — RTN IDs for athletes ARE available from the dashboard endpoint, not just from Virtius.

**Result: PASS**

---

## A8: `competitions/{compId}/rtnStats/` (NEW path)

**Plan says:** NEW path for show-start snapshot of team stats

**Actual:** Does not exist on `z1fxcup2` (as expected)

**Findings:**
- PASS: Path doesn't exist — no conflicts

**Result: PASS**

---

## Summary

| # | Check | Result | Finding |
|---|-------|--------|---------|
| A1 | `teamsDatabase/teams/{teamKey}` | PASS | Fields match plan. Roster not present on all teams. No rtnId yet (expected). |
| A2 | `teamsDatabase/headshots/{name}` | PASS | Fields match plan. No rtnId yet (expected). |
| A3 | `teamsDatabase/stats/` (NEW) | PASS | Path is empty/null. No conflicts. |
| A4 | `competitions/{compId}/config` | FAIL | `team{N}Con` contains rank strings ("#1", "#5"), NOT std dev. Plan assumes it will write std dev — format mismatch. Also: team3-team6 have placeholder values. |
| A5 | `competitions/{compId}/teamData` | FAIL | No `rtnId` field exists anywhere in teamData. Plan's fallback path `teamData/team{N}/rtnId` is non-existent. |
| A6 | `config/_locks` (NEW) | PASS | Safe to add — no code iterates config children. |
| A7 | `rtnCache/` structure | PASS | `dashboards/` exists. Also has `womens/` and `mens/` team directory caches (unmentioned in plan but non-conflicting). RTN dashboard roster includes athlete RTN IDs. |
| A8 | `rtnStats/` (NEW) | PASS | Path empty. No conflicts. |

**Totals: 6 PASS / 2 FAIL / 6 INFO items**

---

## Required Plan Updates

1. **A4 — `team{N}Con` format**: Task 6 and Technical Plan Section 2 need to specify that `team{N}Con` is a **rank string** (e.g., "#1", "#5"), not a standard deviation float. The plan needs to decide: should `syncStatsToConfig` write a rank (matching current format) or change the format to a computed value (breaking existing graphics)?

2. **A5 — Remove fictional fallback**: Technical Plan Section 3.4 step 2 says "If missing, attempt lookup from `competitions/{compId}/teamData/team{N}/rtnId`". This path has never been populated. Either:
   - Remove this fallback from the plan entirely, OR
   - Add a task to populate it during enrichment (but `teamsDatabase/teams/{teamKey}/rtnId` is the better primary source)

3. **A7 — Document existing `rtnCache` structure**: Technical Plan Section 2 should note the existing `rtnCache/womens/` and `rtnCache/mens/` paths to avoid confusion with the new `rankings/` path.

4. **A7 — RTN athlete IDs from dashboard**: The RTN dashboard response includes per-athlete `id` fields (RTN IDs). This is an alternative source for athlete RTN IDs besides Virtius. Worth noting in the plan as a potential fallback or cross-reference.
