# Spec: Virtius API Current State

## What

How the Virtius API integration works today in output.html, including URL patterns, response format, score processing, and error handling. This is the code being replaced by the server-side scoring ingestion service.

## Current State

### API Endpoint

**URL Pattern (output.html:8422):**
```
https://api.virti.us/session/{sessionId}/json
```

**Authentication:** None. Public endpoint, no headers required.

**Single fetch:**
```javascript
const response = await fetch(`https://api.virti.us/session/${sessionId}/json`);
```

**Dual session fetch (Combined AA, output.html:8780-8781):**
```javascript
const [resp1, resp2] = await Promise.all([
  fetch(`https://api.virti.us/session/${sessionId1}/json`),
  fetch(`https://api.virti.us/session/${sessionId2}/json`)
]);
```

### API Response Structure

**Root:** `data.meet`

```json
{
  "meet": {
    "teams": [
      {
        "name": "Team Full Name",
        "short_name": "ABBREV",
        "tricode": "ABC",
        "logo": "https://media.virti.us/upload/images/team/...",
        "events": [
          {
            "event_name": "Floor Exercise",
            "gymnasts": [
              {
                "gymnast_id": "12345",
                "first_name": "Taylor",
                "last_name": "Ingle",
                "full_name": "Taylor Ingle",
                "final_score": "9.850",
                "e_score": "14.150",
                "neutral": "0.000",
                "bonus": "0.000",
                "scores": [
                  { "start": "5.400" }
                ]
              }
            ]
          }
        ]
      }
    ],
    "event_results": [
      {
        "event_name": "All Around",
        "gymnasts": [
          {
            "gymnast_id": "12345",
            "first_name": "Taylor",
            "last_name": "Ingle",
            "full_name": "Taylor Ingle",
            "final_score": "39.425",
            "place": 1
          }
        ]
      }
    ]
  }
}
```

**Key fields:**
- `teams[].events[].gymnasts[]` — per-event scores grouped by team
- `event_results[]` — pre-aggregated results (may be incomplete)
- All score values are **strings** — must be parsed to floats

### Score Derivation (output.html:8614-8625)

```javascript
const startValue = g.scores && g.scores.length > 0
  ? parseFloat(g.scores[0].start) || 0
  : 0;  // Difficulty (D score)

const execValue = parseFloat(g.e_score) || 0;  // Execution (includes 10.0 base)
const ndValue = parseFloat(g.neutral) || 0;    // Neutral deduction
const bonusValue = parseFloat(g.bonus) || 0;   // Stick bonus

// Formula: D + E - ND + Bonus
// Note: e_score already includes 10.0 base (not added separately)
const calculated = startValue + execValue - ndValue + bonusValue;
```

**Critical:** `e_score` field **already includes** the 10.0 base. Do not add 10.0 again.

### Score Formatting

| Field | Format | Code |
|-------|--------|------|
| Final Score | 3 decimals | `score.toFixed(3)` → "9.850" |
| Difficulty | 2 decimals | `diff.toFixed(2)` → "5.40" |
| Execution | 3 decimals | `exec.toFixed(3)` → "4.650" |
| Zero check | Show "-" | `if (score <= 0) return '-'` |

### Sorting and Tie Handling (output.html:8566-8573, 8643-8653)

**Gap ranking algorithm:**
```javascript
let currentPlace = 1;
sortedGymnasts.forEach((g, i) => {
  if (i > 0 && g.total < sortedGymnasts[i-1].total) {
    currentPlace = i + 1;  // Skips tied positions
  }
  g.place = currentPlace;
});
// Example: 1st, 2nd, 2nd, 4th (skips 3rd)
```

**Primary sort:** By `place` field (lower is better)

**Tiebreaker:** Higher execution score wins (output.html:8647-8652):
```javascript
.sort((a, b) => {
  const placeA = a.place || 999;
  const placeB = b.place || 999;
  if (placeA !== placeB) return placeA - placeB;

  // Higher execution comes first (descending)
  const execA = gymnastScores[a.gymnast_id]?.exec || 0;
  const execB = gymnastScores[b.gymnast_id]?.exec || 0;
  return execB - execA;
});
```

**Tie indicator (output.html:8680-8700):**
```javascript
const placeCounts = {};
gymnasts.forEach(g => {
  const p = g.place || 999;
  placeCounts[p] = (placeCounts[p] || 0) + 1;
});

const isTied = placeCounts[place] > 1;
const rankHtml = isTied ? `${place}<sup>T</sup>` : place;
```

**Top N limit:** `slice(0, 10)` — always top 10

### Column Variants (output.html:8658-8678)

| Column | Men's Event | Women's Event | All-Around |
|--------|-------------|---------------|-----------|
| Rank (#) | Yes | Yes | Yes |
| Name | Yes | Yes | Yes |
| Team | Yes | Yes | Yes |
| Apparatus | Yes | Yes | No |
| Score | Yes | Yes | Yes |
| Difficulty | Yes | No | No |
| Execution | Yes | No | No |
| Stick Bonus | Yes | No | No |

**Logic:**
```javascript
const showDiffExec = !isWomens && !isAllAround;
const showApparatus = !isAllAround;
```

### Stick Bonus Detection (output.html:8696-8732)

```javascript
const hasStickBonus = bonusValue > 0;
// Only shown for men's non-AA events
```

### Medal Indicators (output.html:8702-8705)

```javascript
const placeIndicator = place === 1 ? '<span class="place-indicator gold"></span>' :
                       place === 2 ? '<span class="place-indicator silver"></span>' :
                       place === 3 ? '<span class="place-indicator bronze"></span>' : '';
```

### Error Handling (output.html:8418-8424)

```javascript
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
  // ... process
} catch (error) {
  console.error('Leaderboard fetch error:', error);
  contentEl.innerHTML = '<div class="leaderboard-error">Error loading leaderboard</div>';
}
```

**Empty results check (output.html:8594-8600):**
```javascript
if (!eventResults || !eventResults.gymnasts || eventResults.gymnasts.length === 0) {
  const errorMsg = isAllAround
    ? 'No All Around results available yet. AA scores require completing all events.'
    : 'No results found for this event';
  contentEl.innerHTML = `<div class="leaderboard-error">${errorMsg}</div>`;
  return;
}
```

### Apparatus Flight Name Cleanup (output.html:8719-8727)

When an event uses flights (e.g., "VT - A", "VT - B"), the team name in results may be the flight name instead of the school:

```javascript
const APPARATUS_FLIGHT_REGEX = /^[A-Z]{2,5}\s*-\s*[A-Z]$/;
if (APPARATUS_FLIGHT_REGEX.test(teamName)) {
  // Look up real school from headshots database
}
```

### All-Around Aggregation (output.html:8856-8858)

When `event_results` doesn't have AA data, the code aggregates manually:

```javascript
const completeGymnasts = Object.values(merged)
  .filter(g => g.eventCount === requiredEventCount)  // 6 for men, 4 for women
  .sort((a, b) => b.total - a.total);
```

### Combined All-Around (output.html:8762-8922)

Merges scores from two sessions (prelims + finals):
1. Fetch both sessions in parallel
2. Aggregate AA from each session
3. Merge: if same gymnast in both, keep higher total
4. Apply gap ranking to merged results

**This is explicitly out of scope for Phase 3** — the ingestion service handles single sessions only.

## Target State

### What the Scoring Ingestion Service Must Do

1. **Poll Virtius API** at configurable intervals
2. **Parse response** exactly as output.html does (same field extraction)
3. **Compute scores** using the same derivation formula
4. **Sort with gap ranking** — same algorithm as output.html
5. **Detect ties** — compute `isTied` boolean for each row
6. **Format data** for immediate consumption by leaderboard-table block
7. **Write to Firebase** at `competitions/{compId}/scoring/`

### Data Transformations Required

| Virtius API Field | Output Field |
|-------------------|--------------|
| `gymnast.final_score` | `row.score` (float) |
| `gymnast.scores[0].start` | `row.diff` (float, men's only) |
| `gymnast.e_score - 10.0` | `row.exec` (float, men's only) |
| `gymnast.bonus > 0` | `row.stickBonus` (boolean, men's only) |
| `gymnast.full_name` | `row.name` (string) |
| `team.name` | `row.team` (string) |
| computed place | `row.rank` (integer) |
| `placeCounts[place] > 1` | `row.isTied` (boolean) |

## Risks

1. **API response format changes:** If Virtius changes their API structure, the ingestion service breaks. No versioning in the API URL.

2. **e_score interpretation:** The 10.0 base is included in `e_score`. Getting this wrong produces wildly incorrect execution values.

3. **Flight name handling:** The apparatus flight pattern ("VT - A") affects team attribution. May need similar cleanup in the service.

4. **Zero scores:** The existing code filters `score <= 0`. Need to maintain this to exclude scratches/exhibitions.

## Open Questions

1. **Should the service detect flight names and resolve them?** Or is this purely a display concern?

2. **How often does `event_results` lack AA data?** If frequent, the service needs the aggregation fallback logic.

3. **What happens if a session ID is invalid?** The API returns 404 — service should handle gracefully and report error.
