# Audit Category B: RTN API Endpoint Verification

**Date:** 2026-02-01
**Test Fixtures:**
- Women's team: UCLA (tid=66, Big Ten)
- Men's team: California (tid=6, from `rtnCache/dashboards/mens-6`)
- Oklahoma tid=47 (from results endpoint)
- Year: 2026
- Current week: 1 (only week with `current: "1"`)
- Week tested for rankings: 4

---

## B1: Dashboard Endpoint

**Endpoint:** `/women/dashboard/2026/66`

**Plan says:** Dashboard provides team overview; currently used for coaches only. RTN IDs available.

**Actual response top-level fields:**
```
attendance, links, info, staff, ranks, meets, ty_info, roster
```

**FAIL: No top-level `id` field.** The team ID is at `info.team_id` (string `"66"`). The existing code at `useCompetitions.js:134` does `rtnId: dashboard.id || null` — this always evaluates to `null` because `dashboard.id` doesn't exist. The correct path is `dashboard.info.team_id`.

**INFO: No `test` field in women's dashboards.** Men's dashboards (e.g., `/men/dashboard/2026/6`) include a `test` object with `ave`, `high`, `rqs`. Women's dashboards do NOT have this field. The `enrichTeamsWithRTN()` code at line 172 (`dashboard.test ? ...`) would always evaluate to the null branch for women.

**PASS: Dashboard roster includes RTN athlete IDs.** Each roster entry has an `id` field that is the RTN athlete ID (e.g., `"33384"` for Jordan Chiles). This is the same ID referenced as `gid` in MVP/topscores/individual endpoints and `id` in lineup.

**Roster entry sample (UCLA):**
```json
{
  "events": "",
  "fname": "Jordan",
  "hometown": "Houston, TX",
  "id": "33384",
  "lname": "Chiles",
  "school_year": "4",
  "tid": "66"
}
```

**Men's roster has additional event flag fields:**
```json
{
  "id": "8262", "tid": "6", "lname": "Bardana", "fname": "Matteo",
  "hometown": "Oakville, Ontario", "school_year": "2",
  "fx": "1", "ph": null, "sr": "1", "v": null, "pb": "1", "hb": "1",
  "events": " FX  SR  PB  HB "
}
```

---

## B2: Consistency Endpoint

**Endpoint:** `/women/teamConsistency/2026/66`

**Plan says:** Response has `vts`, `ubs`, `bbs`, `fxs` arrays and labels array.

**Actual:**
```json
{
  "labels": ["Jan-03-26","Jan-10-26","Jan-17-26","Jan-25-26","Jan-30-26"],
  "vts": ["49.1500","49.2750","49.2500","49.3000","49.4250"],
  "ubs": ["49.2250","49.4250","49.3250","49.3500","49.5500"],
  "bbs": ["49.5250","49.1250","49.6250","49.3250","49.4750"],
  "fxs": ["49.0750","49.1750","49.1250","49.4500","49.7000"]
}
```

**PASS.** Field names match plan exactly. Values are strings (need parsing to numbers). No additional fields.

---

## B3: MVP Endpoint

**Endpoint:** `/women/mvp/2026/66`

**Plan says:** Per-athlete event totals; floating-point artifacts expected.

**Actual (first 2 entries):**
```json
[
  {
    "vsum": 49.725, "ubsum": 49.65, "bbsum": 49.7, "fsum": 49.65,
    "total": 198.725,
    "first_name": "Jordan", "last_name": "Chiles", "gid": 33384
  },
  {
    "vsum": 49.125, "ubsum": 39.425, "bbsum": 49.2, "fsum": 49.35,
    "total": 187.1,
    "first_name": "Tiana", "last_name": "Sumanasekera", "gid": 33694
  }
]
```

**PASS.** Array of athlete objects. Field names: `vsum`, `ubsum`, `bbsum`, `fsum`, `total`, `first_name`, `last_name`, `gid`. Athlete ID field is `gid` (number, not string). Values are already numbers (not strings like consistency). Plan's event field mappings need updating: `vsum` → VT, `ubsum` → UB, `bbsum` → BB, `fsum` → FX.

**INFO: MVP event field names differ from consistency.** Consistency uses `vts`, `ubs`, `bbs`, `fxs`. MVP uses `vsum`, `ubsum`, `bbsum`, `fsum`. Plan Section 3.1 documents consistency field names but MVP uses different ones. Normalization must handle both.

---

## B4: Top Scores Endpoint

**Endpoint:** `/women/topscores/2026/66`

**Plan says:** Theoretical max, per-event top 5.

**Actual:**
```json
{
  "scores": [
    {"vault":"10.0000","bars":"9.9750","beam":"9.9750","floor":"10.0000"},
    ...
  ],
  "total": 198.575,
  "vault": [
    {"gymnast_id":"33384","max":"10.0000","first_name":"Jordan","last_name":"Chiles","url":null},
    ...
  ],
  "bars": [...],
  "beam": [...],
  "floor": [...]
}
```

**PASS.** Structure matches plan. Fields: `scores` (array of 5 lineup scores), `total` (number — theoretical max), per-event arrays with `gymnast_id`, `max`, `first_name`, `last_name`, `url`. Event keys are `vault`, `bars`, `beam`, `floor` (not abbreviated). Athlete ID field is `gymnast_id` (string).

**INFO: Athlete ID field varies by endpoint.** Dashboard roster: `id`. MVP: `gid`. Top scores: `gymnast_id`. Lineup: `id`. Individual stats: `gid`. Normalization must handle all these field names.

---

## B5: Lineup Endpoint

**Endpoint:** `/women/lineup/2026/66`

**Plan says:** Binary meets arrays per athlete.

**Actual (first entry):**
```json
{
  "id": "32073",
  "last_name": "Alipio",
  "first_name": "Ciena",
  "meets": [1,1,1,1,1,0,0,0,0,0,0,0,0,0]
}
```

**PASS.** Array of athlete objects. Fields: `id` (string), `last_name`, `first_name`, `meets` (array of 0/1 integers). 14 entries in meets array (matches number of scheduled meets). Athlete ID field is `id` (string).

---

## B6: Individual Highs Endpoint

**Endpoint:** `/women/rostermain/2026/66/2`

**Plan says:** Per-athlete max per event.

**Actual:**
```json
{
  "team": [{"team_id":"66","team_name":"UCLA","maxv":"49.3000","maxub":"49.5500","maxbb":"49.6250","maxfx":"49.7000","maxaa":"198.1500"}],
  "ind": [
    {"fname":"Ciena","lname":"Alipio","maxv":null,"maxub":"9.9500","maxbb":"9.9750","maxfx":"9.9000","maxaa":null,"gid":"32073"},
    {"fname":"Madisyn","lname":"Anyimi","maxv":"9.9000","maxub":null,"maxbb":null,"maxfx":null,"maxaa":null,"gid":"32074"},
    ...
  ]
}
```

**FAIL: Response is NOT a flat array.** Plan implied a flat array. Actual response has two keys: `team` (array with 1 team summary entry) and `ind` (array of individual athletes). Individual athletes have fields: `fname`, `lname`, `maxv`, `maxub`, `maxbb`, `maxfx`, `maxaa`, `gid` (string). Null means no score for that event.

**INFO: Field names are `maxv`, `maxub`, `maxbb`, `maxfx`, `maxaa`** — NOT the plain event names used elsewhere. Plan Section 3.1 documents men's `maxfx`/`maxph` etc. but doesn't document women's highs field names.

---

## B7: Individual Averages Endpoint

**Endpoint:** `/women/rostermain/2026/66/3`

**Plan says:** Same shape as highs.

**Actual:**
```json
{
  "team": [{"team_id":"66","team_name":"UCLA","maxv":"49.280","maxub":"49.375","maxbb":"49.415","maxfx":"49.305","maxaa":"197.375"}],
  "ind": [
    {"fname":"Ciena","lname":"Alipio","maxv":null,"maxub":"9.912","maxbb":"9.945","maxfx":"9.856","maxaa":null,"gid":"32073"},
    ...
  ]
}
```

**PASS (structure matches highs).** Same `team`/`ind` two-key structure. Same field names (`maxv`, `maxub`, `maxbb`, `maxfx`, `maxaa`, `gid`). Averages are lower precision strings (3 decimal places vs 4 for highs).

**INFO: The `team` summary in averages shows team averages per event** — this could be useful data not mentioned in plan.

---

## B8: Team Rankings Endpoint

**Endpoint:** `/women/results/2026/4/0/5`

**Plan says:** Response has rank, ave, high, rqs.

**Actual team entry (Oklahoma):**
```json
{
  "rank": "1",
  "name": "Oklahoma",
  "tid": 47,
  "rqs": "197.4060",
  "reg": "SC",
  "con": "SEC",
  "div": "Div I",
  "usag": "0",
  "ave": "197.783",
  "high": "198.425"
}
```

**PASS.** All planned fields exist. Additional fields: `reg` (region), `con` (conference), `div` (division), `usag`, `name`, `tid`. Values are strings except `tid` (number). `rank` can be "3(t)" for ties.

**INFO: `rqs` is "0" in week 1** (too early in season). By week 4, rqs has values like "197.4060". Plan should note that early-season rqs may be 0/empty.

---

## B9: Individual Rankings Endpoint

**Endpoint:** `/women/results/2026/1/1/1` (vault)

**Plan says:** ~500 athletes, field names include rank, name, team, ave, high, rqs.

**Actual entry:**
```json
{
  "rank": "1",
  "fname": "Zoe",
  "lname": "Johnson",
  "gid": 33212,
  "team": "Utah",
  "tid": 69,
  "rqs": 0,
  "reg": "NC",
  "con": "Big 12",
  "div": "Div I",
  "usag": 0,
  "ave": "9.925",
  "high": "9.925"
}
```

**FAIL (minor): Field names differ from plan.** Plan says `name` (singular), actual has `fname` and `lname` (separate). Also has `gid` (RTN athlete ID, number type), `tid` (team ID, number type). `rqs` is number 0 (not string) in week 1. `rank` supports ties: `"2(t)"`.

**INFO: 119 athletes in week 1** (plan said ~500). Full season would have more. `gid` and `tid` are numbers here, not strings (unlike other endpoints where they're strings — inconsistent types across endpoints).

---

## B10: Week Discovery

**Endpoint:** `/women/results/2026/4/0/5` (checked schema)

**Plan says:** `schema.weeks` exists, `current: "1"` marks the active week.

**Actual `weeks` array (first 3):**
```json
[
  {"wk": "12", "date": "2026-03-23", "rqs": "1", "sas": "1", "current": "0"},
  {"wk": "11", "date": "2026-03-16", "rqs": "1", "sas": "1", "current": "0"},
  {"wk": "10", "date": "2026-03-09", "rqs": "1", "sas": "1", "current": "0"}
]
```

Week 1 has `"current": "1"`. Array is sorted descending by week number.

**PASS.** Schema structure matches plan. `wk` is the week number (string), `current` is `"1"` for active week. Additional fields: `date`, `rqs`, `sas`.

**INFO: The plan's `getCurrentWeek()` endpoint path is wrong.** Plan says `/results/{year}/1/0/5` but the weeks schema is available from ANY results endpoint (e.g., `/results/2026/4/0/5`). The week discovery doesn't need a specific path — the schema object is included in every results response.

---

## B-CRITICAL: RTN ID Source Verification

**Plan says:** RTN IDs come from Virtius API during Media Manager setup.

### Finding 1: Virtius HTML Parser (`parseVirtiusRosterHtml`)

**File:** `useCompetitions.js:75-103`

The function parses raw HTML pasted from the Virtius roster page. It extracts:
- Headshot URL: from `<img src="https://media.virti.us/...">`
- Athlete name: from `alt="Name Profile"`
- RTN ID: from `<input readonly value="12345">`

**This is the source of per-athlete RTN IDs.** The Virtius roster page includes a readonly input field containing the RTN athlete ID. This confirms the plan's assumption that Virtius provides RTN IDs.

### Finding 2: Team RTN ID Bug

**File:** `useCompetitions.js:134`
```javascript
rtnId: dashboard.id || null,
```

**FAIL: `dashboard.id` is always undefined.** The RTN dashboard response has NO top-level `id` field. The team ID is at `dashboard.info.team_id`. This means `teamData.team{N}.rtnId` is ALWAYS `null` in existing competitions.

**Impact:** The plan's Task 1 says "capture RTN team ID during Media Manager team setup" — but the existing code already tries to capture it and fails. Task 1 must fix this bug: change `dashboard.id` to `dashboard.info.team_id`.

### Finding 3: RTN ID Field Name Inconsistency Across Endpoints

| Endpoint | Athlete ID Field | Type |
|----------|-----------------|------|
| Dashboard roster | `id` | string |
| MVP | `gid` | number |
| Top Scores | `gymnast_id` | string |
| Lineup | `id` | string |
| Individual Highs/Averages | `gid` | string |
| Individual Rankings | `gid` | number |

**INFO: Same athlete, different field names AND types.** Jordan Chiles is `id: "33384"` in dashboard, `gid: 33384` (number) in MVP, `gymnast_id: "33384"` in topscores. Normalization must handle: (1) different field names, (2) string vs number types. Always store as string for consistency.

### Finding 4: Virtius RTN IDs vs Dashboard RTN IDs

Both sources provide the same IDs:
- Virtius HTML → `rtnId: "33384"` (from `parseVirtiusRosterHtml`)
- RTN Dashboard → roster `id: "33384"` (from `fetchTeamDashboard`)

The dashboard could serve as a **backup source** for athlete RTN IDs, even if the Virtius HTML import isn't used. This is important because the plan assumes Virtius import is required, but IDs are also available from the dashboard roster.

---

## Summary

| # | Check | Result | Finding |
|---|-------|--------|---------|
| B1 | Dashboard endpoint | FAIL | `dashboard.id` doesn't exist; team ID is at `info.team_id`. Women's have no `test` field. |
| B2 | Consistency endpoint | PASS | Response matches plan. Values are strings needing parsing. |
| B3 | MVP endpoint | PASS | Field names differ from consistency (`vsum`/`ubsum`/`bbsum`/`fsum` vs `vts`/`ubs`/`bbs`/`fxs`). |
| B4 | Top Scores endpoint | PASS | Athlete ID field is `gymnast_id` (unique to this endpoint). |
| B5 | Lineup endpoint | PASS | Matches plan exactly. |
| B6 | Individual Highs | FAIL | Response has `{team, ind}` structure, NOT flat array. Field names: `maxv`/`maxub`/`maxbb`/`maxfx`/`maxaa`. |
| B7 | Individual Averages | PASS | Same structure as B6. |
| B8 | Team Rankings | PASS | All fields present. `rqs` may be 0 early in season. |
| B9 | Individual Rankings | FAIL | Name is `fname`+`lname`, not single `name`. `gid`/`tid` are numbers. |
| B10 | Week Discovery | PASS | `current: "1"` marks active week. Schema in all results responses. |
| B-CRIT | RTN ID source | FAIL | `dashboard.id` bug means team rtnId is always null. Fix needed in Task 1. |
