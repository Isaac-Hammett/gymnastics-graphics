# Media Manager Page - Audit Results

## Phase 1.1: Headshot Counting Logic Analysis

### Current Flow

**Summary Stats Calculation** (`MediaManagerPage.jsx:74-77`):
```javascript
const totalAthletes = allTeamKeys.reduce((sum, key) => {
  const stats = getTeamRosterStats(key);
  return sum + stats.withHeadshots;
}, 0);
```

**getTeamRosterStats** (`useTeamsDatabase.js:348-356`):
```javascript
const getTeamRosterStats = useCallback((teamKey) => {
  const roster = getTeamRosterWithHeadshots(teamKey);
  const withHeadshots = roster.filter(a => a.hasHeadshot).length;
  return {
    total: roster.length,
    withHeadshots,
    percentage: roster.length > 0 ? Math.round((withHeadshots / roster.length) * 100) : 0,
  };
}, [getTeamRosterWithHeadshots]);
```

**getTeamRosterWithHeadshots** (`useTeamsDatabase.js:334-343`):
```javascript
const getTeamRosterWithHeadshots = useCallback((teamKey) => {
  const team = getTeam(teamKey);  // <-- Uses normalizeName internally
  if (!team?.roster) return [];

  return team.roster.map(name => ({
    name,
    hasHeadshot: hasHeadshot(name),
    headshotUrl: getHeadshot(name),
  }));
}, [getTeam, hasHeadshot, getHeadshot]);
```

**getTeam** (`useTeamsDatabase.js:228-231`):
```javascript
const getTeam = useCallback((teamKey) => {
  const normalized = normalizeName(teamKey);  // <-- PROBLEM HERE
  return teams[normalized] || null;
}, [teams]);
```

---

## BUG #1: Team Key Normalization Mismatch (CRITICAL)

### Location
`useTeamsDatabase.js:228-231`

### Problem
The `getTeam()` function normalizes the team key before lookup:
```javascript
const normalized = normalizeName(teamKey);
return teams[normalized] || null;
```

But **team keys in Firebase** are stored as-is (e.g., `"army-mens"`, `"cal-womens"`).

The `normalizeName()` function converts:
- `"army-mens"` → `"army mens"` (hyphen becomes space)
- `"cal-womens"` → `"cal womens"` (hyphen becomes space)

So `teams["army-mens"]` exists but `teams["army mens"]` does NOT exist.

**This causes `getTeam()` to return `null` for ALL teams with hyphens in the key.**

### Impact
- `getTeamRosterWithHeadshots()` returns `[]` (empty array)
- `getTeamRosterStats()` returns `{ total: 0, withHeadshots: 0, percentage: 0 }`
- All headshot counts show as 0 in the UI

### Root Cause
The `normalizeName()` function (line 94) converts hyphens to spaces:
```javascript
.replace(/[-_]/g, ' ')      // Hyphens and underscores to spaces
```

This is correct for **athlete names** but WRONG for **team keys**.

### Evidence
Team keys in Firebase use hyphens: `army-mens`, `cal-womens`, `ohio-state-mens`
After normalization: `army mens`, `cal womens`, `ohio state mens`
Lookup fails because `teams["army mens"]` === `undefined`

---

## BUG #2: Headshot Key Mismatch (SECONDARY)

### Location
- Save: `useTeamsDatabase.js:152-155`
- Lookup: `useTeamsDatabase.js:295-302`

### Problem
**When saving** (`saveHeadshot`):
```javascript
const normalized = normalizeName(athleteName);
const safeKey = getSafeFirebaseKey(normalized);
await set(ref(db, `teamsDatabase/headshots/${safeKey}`), {...});
```

**When looking up** (`getHeadshot`):
```javascript
const normalized = normalizeName(athleteName);
if (headshots[normalized]?.url) {  // <-- Tries WITHOUT safeKey first
  return headshots[normalized].url;
}
const safeKey = getSafeFirebaseKey(normalized);
if (headshots[safeKey]?.url) {     // <-- Then tries WITH safeKey
  return headshots[safeKey].url;
}
```

### The Issue
Headshots are saved with `getSafeFirebaseKey()` applied (spaces → underscores).
But the lookup first tries WITHOUT the safe key transformation.

Example:
- Save: `"john smith"` → `getSafeFirebaseKey("john smith")` → stored at key `"john smith"` (no change needed, but if name had `.` or `#`...)
- For a name like `"J.R. Smith"`: normalized = `"jr smith"`, safeKey = `"jr smith"` (`.` was already removed by normalize)

This is actually mostly fine since `getSafeFirebaseKey` only replaces `.#$[]/` which are rare in names. But it creates inconsistency.

### Impact
Low - the fallback usually catches it. But creates potential for edge cases.

---

## BUG #3: Teams List Uses Raw Keys, Not Normalized

### Location
`MediaManagerPage.jsx:62-69`

```javascript
const allTeamKeys = getAllTeamKeys();  // Returns raw keys like "army-mens"

const filteredTeams = allTeamKeys
  .filter(key => teams[key]?.gender === teamsGenderFilter)  // Works - direct key access
  .map(key => ({ key, ...teams[key] }))  // Works - direct key access
  .sort((a, b) => a.school?.localeCompare(b.school) || 0);
```

Then later (`MediaManagerPage.jsx:317`):
```javascript
const stats = getTeamRosterStats(team.key);  // <-- Passes raw key like "army-mens"
```

### Flow Analysis
1. `allTeamKeys` = `["army-mens", "cal-womens", ...]` (correct)
2. `team.key` = `"army-mens"` (correct)
3. `getTeamRosterStats("army-mens")` is called
4. Inside, `getTeam("army-mens")` normalizes to `"army mens"`
5. `teams["army mens"]` = `undefined`
6. Returns `{ total: 0, withHeadshots: 0 }` (WRONG)

---

## BUG #4: Import Uses Different Key Style

### Location
`useTeamsDatabase.js:197-206`

```javascript
const importRoster = useCallback(async (teamKey, athletes) => {
  const normalized = normalizeName(teamKey);  // <-- Normalizes team key!

  await update(ref(db, `teamsDatabase/teams/${normalized}`), {
    roster: rosterNames,
    ...
  });
```

### Problem
If user imports to team `"army-mens"`, it will:
1. Normalize to `"army mens"`
2. Save roster to `teamsDatabase/teams/army mens` (NEW path with space)
3. Original team at `teamsDatabase/teams/army-mens` is NOT updated

This creates duplicate/orphaned data in Firebase.

---

## Phase 1.2: Name Normalization Consistency

### Test Cases

| Input | `normalizeName()` | `getSafeFirebaseKey()` | Notes |
|-------|-------------------|------------------------|-------|
| `"Michael O'Brien Jr."` | `"michael obrien"` | `"michael obrien"` | Jr. removed, apostrophe removed |
| `"José García-López"` | `"jose garcia lopez"` | `"jose garcia lopez"` | Accents removed, hyphen → space |
| `"Jean-Pierre Müller III"` | `"jean pierre mueller"` | `"jean pierre mueller"` | III removed, hyphen → space, ü → ue |
| `"Mary Beth O'Connor"` | `"mary beth oconnor"` | `"mary beth oconnor"` | Apostrophe removed |

### Consistency Check

| Operation | Uses `normalizeName`? | Uses `getSafeFirebaseKey`? |
|-----------|----------------------|---------------------------|
| `saveHeadshot()` | Yes | Yes (for key) |
| `saveHeadshots()` | Yes | Yes (for key) |
| `getHeadshot()` | Yes | Yes (fallback) |
| `saveTeam()` | Yes (for key) | No |
| `getTeam()` | Yes (BUG!) | No |
| `importRoster()` | Yes (BUG!) | No |

### Issue
`normalizeName()` is being used for both:
1. **Athlete names** (correct - "Jean-Pierre" → "jean pierre")
2. **Team keys** (WRONG - "army-mens" → "army mens")

These need different treatment.

---

## Phase 1.3: Data Loading & State Management

### Current Implementation
`useTeamsDatabase.js:44-84`:
```javascript
useEffect(() => {
  const teamsRef = ref(db, 'teamsDatabase/teams');
  const headshotsRef = ref(db, 'teamsDatabase/headshots');
  const aliasesRef = ref(db, 'teamsDatabase/aliases');

  let loadedCount = 0;
  const checkLoaded = () => {
    loadedCount++;
    if (loadedCount >= 3) setLoading(false);
  };
  // ... subscriptions
}, []);
```

### Issues Found

1. **Race Condition**: `loading` becomes `false` when 3 subscriptions fire, but if one fails, it still counts toward the 3. Could show partial data as "loaded".

2. **No Error Aggregation**: Each subscription sets `error` independently. Last error wins, earlier errors are overwritten.

3. **Cleanup is Good**: The unsubscribe functions are properly returned.

### Severity
Medium - works in happy path but edge cases could show incorrect state.

---

## Phase 1.4: UI/UX Issues

### Status Indicators
- **Location**: `MediaManagerPage.jsx:344-384`
- **Issue**: Status badges rely on `getTeamRosterStats()` which returns 0 due to Bug #1
- **Impact**: All teams show `--` or `0/0` for headshots

### Roster Expansion
- **Location**: `MediaManagerPage.jsx:388-394`, `RosterView` component at 591-630
- **Issue**: `RosterView` receives `teams` and calls `getTeamRosterWithHeadshots(teamKey)` which also fails due to Bug #1
- **Impact**: Expanded rosters show "No roster defined" even when roster exists

### Import Preview
- **Location**: `MediaManagerPage.jsx:450-468`
- **Working**: Preview directly uses parsed athletes, doesn't rely on broken functions
- **Issue**: After save, the import may save to wrong Firebase path (Bug #4)

---

## Summary of Bugs

| Bug | Severity | Location | Description |
|-----|----------|----------|-------------|
| #1 | CRITICAL | `getTeam()` | Normalizes team key, breaking lookups |
| #2 | LOW | `getHeadshot()` | Inconsistent safe key usage |
| #3 | CRITICAL | Stats calculation | Uses `getTeam()` which fails |
| #4 | HIGH | `importRoster()` | Normalizes team key, creates orphan data |

---

## Recommended Fixes

### Fix 1: Don't Normalize Team Keys
Team keys should be used as-is (they're already normalized at creation time).

```javascript
// BEFORE
const getTeam = useCallback((teamKey) => {
  const normalized = normalizeName(teamKey);
  return teams[normalized] || null;
}, [teams]);

// AFTER
const getTeam = useCallback((teamKey) => {
  return teams[teamKey] || null;  // Direct lookup
}, [teams]);
```

### Fix 2: Don't Normalize Team Key in importRoster
```javascript
// BEFORE
const importRoster = useCallback(async (teamKey, athletes) => {
  const normalized = normalizeName(teamKey);
  await update(ref(db, `teamsDatabase/teams/${normalized}`), {...});

// AFTER
const importRoster = useCallback(async (teamKey, athletes) => {
  await update(ref(db, `teamsDatabase/teams/${teamKey}`), {...});
```

### Fix 3: Create Separate Functions for Different Normalization Needs
```javascript
// For athlete names (with full normalization)
export function normalizeAthleteName(name) { ... }

// For team keys (minimal, just lowercase and trim)
export function normalizeTeamKey(key) {
  return key?.toLowerCase().trim() || '';
}
```

---

## Fixes Applied

### Fix 1: getTeam() - APPLIED
**File:** `useTeamsDatabase.js:230-234`

```javascript
// BEFORE
const getTeam = useCallback((teamKey) => {
  const normalized = normalizeName(teamKey);
  return teams[normalized] || null;
}, [teams]);

// AFTER
const getTeam = useCallback((teamKey) => {
  if (!teamKey) return null;
  // Direct lookup - team keys are stored with hyphens, not normalized
  return teams[teamKey] || null;
}, [teams]);
```

### Fix 2: Team Operations (saveTeam, updateTeamLogo, updateTeamRoster) - APPLIED
**File:** `useTeamsDatabase.js:97-146`

Removed `normalizeName(teamKey)` from all team write operations. Team keys are now used directly.

### Fix 3: importRoster() - APPLIED
**File:** `useTeamsDatabase.js:199-220`

```javascript
// BEFORE
const normalized = normalizeName(teamKey);
await update(ref(db, `teamsDatabase/teams/${normalized}`), {...});

// AFTER
// Team key is used directly - do NOT normalize
await update(ref(db, `teamsDatabase/teams/${teamKey}`), {...});
```

### Fix 4: getHeadshot() Optimization - APPLIED
**File:** `useTeamsDatabase.js:296-332`

Reordered lookup to try safe Firebase key first (matches how we save), then fall back to other keys.

### Fix 5: runDiagnostics() - ADDED
**File:** `useTeamsDatabase.js:557-663`

New diagnostic function that checks:
- Missing headshots for roster entries
- Orphaned headshots referencing non-existent teams
- Missing required fields on teams
- Returns detailed stats and issues list

---

## Testing Verification

After applying fixes, the following should now work correctly:

1. **Team Lookup**: `getTeam("army-mens")` should return the team object (not null)
2. **Roster Stats**: `getTeamRosterStats("army-mens")` should return accurate counts
3. **Summary Stats**: Total headshot counts in Media Manager should be accurate
4. **Import**: Importing a roster should update the correct team (not create orphaned data)
5. **Diagnostics**: `runDiagnostics()` can be called to check data integrity

To verify in browser console:
```javascript
// Access the hook's return values
const { teams, getTeam, getTeamRosterStats, runDiagnostics } = useTeamsDatabase();

// Test team lookup
console.log('Team lookup:', getTeam('army-mens'));

// Test roster stats
console.log('Roster stats:', getTeamRosterStats('army-mens'));

// Run full diagnostics
console.log('Diagnostics:', runDiagnostics());
```
