# Gymnastics Graphics - Data Architecture

## Overview

This document describes how the gymnastics graphics application handles data, including competition creation, Virtius import, and how team logos and athlete headshots are retrieved from the database.

---

## 1. Competition Creation & Virtius Import Flow

### Entry Point
**File:** `show-controller/src/pages/DashboardPage.jsx`

When creating a competition, users have two options:

### Option A: Manual Entry
- Fill out competition metadata (name, date, venue, location)
- Enter team names (1-6 teams depending on competition type)
- Manually select logos and enter tricodes

### Option B: Import from Virtius (lines 81-129)
1. User provides a Virtius session ID
2. App fetches `https://api.virti.us/session/{sessionId}/json`
3. Extracts: meet name, date, location, team names
4. Auto-looks up team logos via `getTeamLogo()` function
5. Infers competition type from sex + team count

### Storage
Competition config is saved to Firebase at `competitions/{compId}/config`

### Competition Config Schema
```javascript
{
  compType: "mens-dual" | "womens-dual" | "mens-tri" | "womens-tri" | etc,
  eventName: string,
  meetDate: string,
  venue: string,
  location: string,
  virtiusSessionId: string (optional),

  // For each team (1-6):
  team1Name: string,
  team1Logo: string (URL),
  team1Tricode: string,
  team1Coaches: string (newline-separated),
  team1Ave: string,
  team1High: string,

  // ... team2, team3, etc.

  hosts: string,
}
```

---

## 2. Database Architecture

The app uses **Firebase Realtime Database** with this structure:

```
competitions/
  {compId}/
    config/          ← Competition settings (name, venue, teams, logos)
    teamData/        ← RTN-enriched team data (coaches, roster, rankings)
    currentGraphic/  ← Currently displayed graphic on output

teamsDatabase/
  teams/
    {school-gender}/     ← e.g., "navy-mens", "stanford-womens"
      displayName: string
      school: string
      gender: string
      logo: URL string
      roster: Array<string> (athlete names)
      updatedAt: timestamp

  headshots/
    {normalizedName}/    ← e.g., "john smith", "carl soederqvist"
      name: string (original)
      url: URL string
      teamKey: string (e.g., "army-mens")
      updatedAt: timestamp

  aliases/
    {commonName}: schoolKey  ← e.g., "california" → "cal"

rtnCache/
  mens/
    data: {year, teams: Array}
    timestamp: number
    fetchedAt: string
  womens/
    data: {year, teams: Array}
    timestamp: number
    fetchedAt: string

  dashboards/
    {gender}-{teamId}/
      data: {staff, roster, rankings, schedule, etc}
      timestamp: number
      fetchedAt: string
```

---

## 3. Team Logo Retrieval

### Primary Logic
**File:** `show-controller/src/hooks/useTeamsDatabase.js` (lines 236-265)

### Matching Strategy (in order)
1. **Direct match:** `'navy-mens'` → lookup `navy-mens`
2. **Remove gender suffix:** `'Navy Men's'` → `'navy'`
3. **Check aliases:** `'Naval Academy'` → `aliases['naval academy']` → `'navy'`
4. **Try gender variants:** `{schoolKey}-mens` then `{schoolKey}-womens`

### Code Example
```javascript
const getTeamLogo = useCallback((teamName) => {
  if (!teamName) return '';

  const normalized = normalizeName(teamName);

  // Direct match
  if (teams[normalized]) return teams[normalized].logo || '';

  // Try with gender removed
  const withoutGender = normalized
    .replace(/-mens$/, '')
    .replace(/-womens$/, '')
    .replace(/ men'?s?$/i, '')
    .replace(/ women'?s?$/i, '');

  // Check aliases first
  const aliasKey = aliases[withoutGender];
  if (aliasKey) {
    const mensTeam = teams[`${aliasKey}-mens`];
    if (mensTeam?.logo) return mensTeam.logo;
  }

  // Try direct school match
  if (teams[`${withoutGender}-mens`]?.logo)
    return teams[`${withoutGender}-mens`].logo;
  if (teams[`${withoutGender}-womens`]?.logo)
    return teams[`${withoutGender}-womens`].logo;

  return '';
}, [teams, aliases]);
```

### Fallback
Static data in `show-controller/src/lib/teamsDatabase.js` with 18 pre-configured teams and Virtius media URLs like `https://media.virti.us/upload/images/team/{logoId}`

### Team Aliases Examples
```javascript
'california': 'cal'
'uc berkeley': 'cal'
'naval academy': 'navy'
'penn state': 'penn-state'
'william & mary': 'william-mary'
'george washington': 'george-washington'
'stanford university': 'stanford'
```

---

## 4. Athlete Headshot Retrieval

This is the most complex part due to name matching challenges.

### Name Normalization
**File:** `show-controller/src/lib/nameNormalization.js` (lines 89-98)

### Transformations Applied
1. Remove suffixes (Jr., Sr., III, etc.)
2. Convert accents to ASCII (ö→oe, é→e, ñ→n)
3. Lowercase everything
4. Replace hyphens/underscores with spaces
5. Remove apostrophes (O'Connor → oconnor)
6. Collapse whitespace

### Example Transformations
```
"Carl Jacob Söderqvist" → "carl jacob soederqvist"
"Jean-Pierre O'Connor Jr." → "jean pierre oconnor"
"Michael Smith Jr." → "michael smith"
"Robert Jones III" → "robert jones"
```

### Multi-Key Lookup Strategy
**File:** `show-controller/src/lib/nameNormalization.js` (lines 127-189)

For "Benjamin Thurlow Lam", the system generates and tries these keys:
- `benjamin thurlow lam` (full normalized)
- `benjamin_thurlow_lam` (Firebase-safe key)
- `benjamin lam` (first + last, skip middle)
- `benjamin t lam` (first + initial + last)

### Lookup Process
**File:** `show-controller/src/hooks/useCompetitions.js` (lines 54-68)

1. Fetch all headshots from `teamsDatabase/headshots`
2. Build multi-key map for flexible matching
3. Try each variant until a match is found

### Code Example
```javascript
function lookupHeadshot(headshotMap, firstName, lastName) {
  const keys = getLookupKeys(firstName, lastName);
  for (const key of keys) {
    if (headshotMap[key]) {
      return headshotMap[key];
    }
  }
  return null;
}
```

---

## 5. RTN (Road to Nationals) Enrichment

### API Integration
**File:** `show-controller/src/lib/roadToNationals.js`

**Base URL:** `https://www.roadtonationals.com/api`

### Enrichment Process
When a competition is created with `enrichWithRTN: true` (default):

1. For each team, fetch dashboard: `GET /{gender}/dashboard/{year}/{teamId}`
2. Extract:
   - **Coaches:** Filtered from staff by position
   - **Roster:** Athletes with hometown, year, name
   - **Rankings:** By event (vault, bars, beam, floor, team)
   - **Stats:** Average, high score, RQS
   - **Schedule:** Past and upcoming meets
   - **Links:** Social media and official site

3. **Merge with Firebase headshots** (lines 178-194):
   - For each RTN roster athlete, lookup headshot by normalized name
   - Attach `headshotUrl` to roster entry

4. Save enriched data to `competitions/{compId}/teamData`

### Enriched Team Data Schema
```javascript
teamData[teamKey] = {
  rtnId: string,
  fetchedAt: timestamp,

  coaches: [
    {
      id: string,
      firstName: string,
      lastName: string,
      fullName: string,
      position: string,
      imageUrl: string
    }
  ],

  rankings: {
    // Women's: vault, bars, beam, floor, team
    // Men's: floor, pommel, rings, vault, pBars, hBar, team
    vault: integer or null,
    bars: integer or null,
    // ...
  },

  stats: {
    average: decimal,
    high: decimal,
    rqs: decimal (Ranking Qualifying Score)
  },

  roster: [
    {
      id: string (RTN athlete ID),
      firstName: string,
      lastName: string,
      fullName: string,
      hometown: string,
      year: integer,
      headshotUrl: string (from Firebase lookup)
    }
  ],

  links: {
    facebook: url,
    twitter: url,
    instagram: url,
    officialSite: url
  },

  schedule: [
    {
      meetId: string,
      date: string,
      opponent: string,
      description: string,
      home: boolean,
      away: boolean,
      score: decimal or null
    }
  ]
}
```

### Caching Strategy
- 24-hour cache duration
- Two-level caching: Firebase (persistent) + memory (session)
- Fallback to memory cache if Firebase permissions fail

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPETITION CREATION                         │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
   │  Manual Entry │    │ Virtius API │    │  RTN API     │
   │  (UI form)    │    │ /session/   │    │ /dashboard/  │
   └──────────────┘    └─────────────┘    └──────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Competition    │
                    │  Config         │
                    └─────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
   │ Team Logos   │    │  Headshots  │    │ RTN Enriched │
   │ (Firebase/   │    │  (Firebase  │    │ Team Data    │
   │  Static DB)  │    │   + Static) │    │ (Firebase)   │
   └──────────────┘    └─────────────┘    └──────────────┘
```

### Detailed Flow

```
Virtius Session ID (optional)
        ↓
  API: /session/{sessionId}/json
        ↓
    Meet metadata + Team names
        ↓
    Create Competition Config
        ↓
  Firebase: competitions/{compId}/config
        ↓
   Enrich with RTN (async)
        ↓
RTN API: /dashboard/{teamId}
        ↓
Extract: staff, roster, rankings, schedule
        ↓
Merge with Firebase Headshots
        ↓
Match athlete names using getLookupKeys()
        ↓
Firebase: teamsDatabase/headshots
        ↓
headshotMap (multi-key lookup)
        ↓
Find headshot URL by normalized name
        ↓
Save enriched data
        ↓
Firebase: competitions/{compId}/teamData
```

---

## 7. Import Mechanisms

### Virtius Roster HTML Import
**File:** `show-controller/src/pages/MediaManagerPage.jsx` (lines 74-105)

**Process:**
1. Paste raw HTML from Virtius roster page
2. Click "Parse" → calls `parseVirtiusRosterHtml()`
3. Select target team key
4. Click "Save Roster" → calls `importRoster(teamKey, athletes)`
5. Batch saves to Firebase:
   - `teamsDatabase/teams/{teamKey}` - update roster
   - `teamsDatabase/headshots/{normalizedName}` - save each headshot

### HTML Parsing Logic
**File:** `show-controller/src/hooks/useCompetitions.js` (lines 75-103)

```javascript
// Matches table rows
<tr role="row">(content)</tr>

// Extracts image URL
src="(https://media.virti.us/upload/images/athlete/[^"]+)"

// Extracts athlete name
alt="([^"]+) Profile"

// Extracts RTN ID
<input readonly value="(\d+)"
```

**Output:** Array of `{rtnId, headshotUrl, name}`

### Script-Based Import
**File:** `show-controller/scripts/import-springfield.js`

**Purpose:** Node.js script for bulk importing team headshots

**Run Command:** `node scripts/import-springfield.js`

---

## 8. Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Firebase config | `show-controller/src/lib/firebase.js` |
| RTN API integration | `show-controller/src/lib/roadToNationals.js` |
| Name normalization | `show-controller/src/lib/nameNormalization.js` |
| Static teams/headshots | `show-controller/src/lib/teamsDatabase.js` |
| Competition CRUD & RTN enrichment | `show-controller/src/hooks/useCompetitions.js` |
| Team/logo/headshot CRUD | `show-controller/src/hooks/useTeamsDatabase.js` |
| Competition creation UI | `show-controller/src/pages/DashboardPage.jsx` |
| Media manager UI | `show-controller/src/pages/MediaManagerPage.jsx` |
| Batch import script | `show-controller/scripts/import-springfield.js` |

---

## 9. Data Source Hierarchy

### Priority Order (highest to lowest):

1. **Virtius API** (`https://api.virti.us/`)
   - Competition session data
   - Athlete photos (URLs only)
   - Team information

2. **Road to Nationals API** (`https://www.roadtonationals.com/api`)
   - Team rosters (fname, lname, id, hometown, year)
   - Coaching staff
   - Rankings
   - Schedule/meets
   - Team stats
   - Social links

3. **Firebase Realtime Database**
   - Competition configs
   - Enriched team data
   - Headshot URLs (normalized name → URL mapping)
   - Team metadata (logos, rosters, aliases)
   - Caching layer for RTN data

4. **Static Data** (`teamsDatabase.js`)
   - 18 teams with logos
   - ~230 athlete headshots (static URLs)
   - Team aliases
   - Fallback for offline use

---

## 10. Critical Design Patterns

### A. Name Normalization Consistency
**CRITICAL:** The same normalization function MUST be used everywhere:
- When saving headshots to Firebase
- When looking up headshots during import
- When displaying athlete names
- In both frontend and backend scripts

### B. Multi-Key Lookup Strategy
Handles edge cases:
- Accented characters (different representations)
- Middle names (included/excluded)
- Firebase-safe character encoding
- Spaces vs underscores

### C. Graceful Degradation
If a component fails, falls back to:
1. Firebase cache
2. Memory cache
3. Static database
4. Placeholder/default values

### D. Two-Phase Enrichment
1. **Immediate:** Save competition config (fast)
2. **Background:** Enrich with RTN data and Firebase headshots (async)

---

## 11. API Endpoints Used

### Virtius API
- `GET /session/{sessionId}/json` - Competition session data

### Road to Nationals API
- `GET /women/teams` - List all women's teams
- `GET /men/teams` - List all men's teams
- `GET /{gender}/dashboard/{year}/{teamId}` - Full team dashboard
- `GET /{gender}/schedule2/{date}/0` - Weekly schedule
- `GET /{gender}/yearweeks/{year}` - Season week dates

### Firebase Paths
- `competitions/{compId}/config` - Competition settings
- `competitions/{compId}/teamData` - Enriched team data
- `competitions/{compId}/currentGraphic` - Current display graphic
- `teamsDatabase/teams/{teamKey}` - Team info and logos
- `teamsDatabase/headshots/{normalizedName}` - Athlete headshots
- `teamsDatabase/aliases/{name}` - Name aliases
- `rtnCache/{gender}` - Cached RTN team lists
- `rtnCache/dashboards/{gender}-{teamId}` - Cached team dashboards
