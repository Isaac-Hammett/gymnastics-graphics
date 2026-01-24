# Road to Nationals Integration - Discovery & PRD Creation

## Objective

Research the Road to Nationals (RTN) platform, discover available data/APIs, and create a comprehensive PRD for integrating RTN data into our gymnastics graphics system.

---

## Phase 1: Research Road to Nationals

### 1.1 Explore the RTN Website

Navigate to https://roadtonationals.com and document:

- [ ] **Site structure**: What sections exist? (Teams, Athletes, Meets, Rankings, etc.)
- [ ] **Data available**: What statistics are displayed?
  - Team season averages
  - Individual athlete scores
  - Meet results
  - Rankings (RQS, NQS, conference standings)
  - Historical data (how far back?)
- [ ] **URL patterns**: Document URL structure for teams, athletes, meets
  - Example: `/teams/{team-id}`, `/athletes/{athlete-id}`
- [ ] **Search functionality**: How do users find teams/athletes?

### 1.2 Discover API Endpoints

Using browser dev tools or network inspection:

- [ ] **Check for public API**: Look for `/api/` endpoints in network requests
- [ ] **GraphQL?**: Check if they use GraphQL
- [ ] **JSON responses**: Find any JSON data endpoints
- [ ] **Authentication**: Is auth required? API keys?
- [ ] **Rate limiting**: Any visible rate limit headers?

Document findings:
```
API Base URL: [fill in]
Authentication: [none / API key / OAuth]
Response format: [JSON / XML / other]
Endpoints discovered:
- GET /api/...
- GET /api/...
```

### 1.3 Alternative Data Sources

If no API exists, document scraping approach:

- [ ] **Page structure**: Is data in clean HTML tables?
- [ ] **JavaScript rendered?**: Does data load via JS (harder to scrape)?
- [ ] **robots.txt**: Check scraping permissions
- [ ] **Terms of service**: Any restrictions on data use?

---

## Phase 2: Define Data Models

Based on research, define what we need to store in Firebase.

### 2.1 Team Stats Model

```
teamsDatabase/rtnStats/teams/{team-key}/
├── teamId: string (RTN's ID)
├── name: string
├── conference: string
├── season: string (e.g., "2026")
├── ranking: number
├── rqs: number (Regional Qualifying Score)
├── nqs: number (National Qualifying Score)
├── seasonAverages: {
│   ├── vault: number
│   ├── bars: number (UB for women, PB for men)
│   ├── beam: number (women) / rings: number (men)
│   ├── floor: number
│   ├── allaround: number
│   └── total: number
│ }
├── seasonHighs: {
│   ├── vault: { score: number, meet: string, date: string }
│   ├── ... (same structure per event)
│   └── total: { score: number, meet: string, date: string }
│ }
├── lastUpdated: timestamp
└── source: "roadtonationals"
```

### 2.2 Athlete Stats Model

```
teamsDatabase/rtnStats/athletes/{athlete-name-key}/
├── athleteId: string (RTN's ID if available)
├── name: string
├── teamKey: string
├── class: string (Fr, So, Jr, Sr, Gr)
├── hometown: string (if available)
├── season: string
├── seasonAverages: {
│   ├── vault: number
│   ├── bars: number
│   ├── beam: number (women) / rings: number (men)
│   ├── floor: number
│   └── allaround: number
│ }
├── careerHighs: {
│   ├── vault: { score: number, meet: string, date: string, season: string }
│   ├── ... (same structure per event)
│   └── allaround: { score: number, meet: string, date: string, season: string }
│ }
├── seasonHighs: {
│   ├── vault: { score: number, meet: string, date: string }
│   └── ...
│ }
├── meetCount: number (how many meets competed)
├── lastUpdated: timestamp
└── source: "roadtonationals"
```

### 2.3 Meet Results Model

```
teamsDatabase/rtnStats/meets/{meet-id}/
├── meetId: string
├── name: string
├── date: string
├── location: string
├── teams: string[] (team keys that competed)
├── results: {
│   ├── {team-key}: {
│   │   ├── place: number
│   │   ├── total: number
│   │   └── eventScores: { vault, bars, beam, floor }
│   │ }
│ }
├── lastUpdated: timestamp
└── source: "roadtonationals"
```

### 2.4 Head-to-Head Model

```
teamsDatabase/rtnStats/headToHead/{team1-key}_{team2-key}/
├── team1: string
├── team2: string
├── allTime: { team1Wins: number, team2Wins: number, ties: number }
├── recentMeets: [
│   { date, winner, team1Score, team2Score, meetName }
│ ]
├── lastUpdated: timestamp
└── source: "roadtonationals"
```

---

## Phase 3: Create PRD Document

Create `docs/PRD-RTN-Integration/PRD-RTN-Integration.md` with:

### Structure

```markdown
# PRD: Road to Nationals Integration

**Version:** 1.0
**Date:** 2026-01-23
**Status:** Draft

---

## 1. Problem Statement

[Why we need RTN data - graphics need stats, AI context needs historical info, etc.]

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Graphics Data** | Power team stats overlays with accurate season data |
| **AI Context** | Provide historical data for talking point generation |
| **Career Highs** | Detect and display career high achievements |
| **Head-to-Head** | Show rivalry history between competing teams |

---

## 3. User Stories

### Story 1: Graphics Operator Shows Team Stats
As a graphics operator...

### Story 2: System Detects Career High
As a producer, when an athlete posts a career high...

### Story 3: Admin Syncs RTN Data
As an admin, I want to refresh RTN data...

[Continue with all user stories]

---

## 4. Technical Approach

### 4.1 Data Source
[API vs scraping based on research]

### 4.2 Sync Strategy
- Full sync: Weekly on Sundays (after weekend meets)
- Incremental: Before each show (teams in that competition)
- On-demand: Admin trigger in Media Manager

### 4.3 Firebase Schema
[Reference the data models above]

---

## 5. Phases

| Phase | Name | Priority | Goal |
|-------|------|----------|------|
| **A** | Data Discovery | P0 | Confirm data sources, build scrapers/API clients |
| **B** | Firebase Storage | P0 | Store RTN data in teamsDatabase |
| **C** | Admin UI | P1 | Sync controls in Media Manager |
| **D** | Graphics Integration | P1 | Use RTN data in stat overlays |
| **E** | AI Context Integration | P2 | Feed RTN data to AI service |

---

## 6. Success Criteria

### Phase A Complete When:
- [ ] Can fetch team season stats from RTN
- [ ] Can fetch athlete stats for a team
- [ ] Can fetch meet results
- [ ] Error handling for missing data

[Continue for all phases]

---

## 7. Out of Scope (v1)

- Live score ingestion (use Virtius for live)
- Historical data beyond current + previous season
- Non-NCAA gymnastics (club, international)
```

---

## Phase 4: Create Implementation Plan

Create `docs/PRD-RTN-Integration/PLAN-RTN-Integration-Implementation.md` with:

### Task Breakdown

```markdown
# RTN Integration - Implementation Plan

**Status:** NOT STARTED

---

## Phase Summary

| Phase | Name | Priority | Status | Tasks |
|-------|------|----------|--------|-------|
| A | Data Discovery & Scrapers | P0 | NOT STARTED | 1-8 |
| B | Firebase Storage | P0 | NOT STARTED | 9-14 |
| C | Admin UI | P1 | NOT STARTED | 15-20 |
| D | Graphics Integration | P1 | NOT STARTED | 21-26 |
| E | AI Context Integration | P2 | NOT STARTED | 27-32 |

---

### Phase A: Data Discovery & Scrapers (P0) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 1 | Create RTN scraper service skeleton | NOT STARTED | |
| Task 2 | Implement team list fetcher | NOT STARTED | |
| Task 3 | Implement team stats fetcher | NOT STARTED | |
| Task 4 | Implement athlete roster fetcher | NOT STARTED | |
| Task 5 | Implement athlete stats fetcher | NOT STARTED | |
| Task 6 | Implement meet results fetcher | NOT STARTED | |
| Task 7 | Add rate limiting and retry logic | NOT STARTED | |
| Task 8 | Add error handling and logging | NOT STARTED | |

### Phase B: Firebase Storage (P0) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 9 | Define Firebase schema for RTN data | NOT STARTED | |
| Task 10 | Create RTN data writer service | NOT STARTED | |
| Task 11 | Implement team stats upsert | NOT STARTED | |
| Task 12 | Implement athlete stats upsert | NOT STARTED | |
| Task 13 | Implement meet results upsert | NOT STARTED | |
| Task 14 | Add data validation before write | NOT STARTED | |

### Phase C: Admin UI (P1) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 15 | Add RTN section to Media Manager | NOT STARTED | |
| Task 16 | Create "Sync All Teams" button | NOT STARTED | |
| Task 17 | Create "Sync Team" individual button | NOT STARTED | |
| Task 18 | Show sync status and last updated | NOT STARTED | |
| Task 19 | Display sync errors/warnings | NOT STARTED | |
| Task 20 | Add sync progress indicator | NOT STARTED | |

### Phase D: Graphics Integration (P1) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 21 | Create useRTNStats hook | NOT STARTED | |
| Task 22 | Update team stats graphic with RTN data | NOT STARTED | |
| Task 23 | Update athlete stats graphic with RTN data | NOT STARTED | |
| Task 24 | Add career high indicator to score graphics | NOT STARTED | |
| Task 25 | Create head-to-head comparison graphic | NOT STARTED | |
| Task 26 | Add fallback when RTN data unavailable | NOT STARTED | |

### Phase E: AI Context Integration (P2) - NOT STARTED

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 27 | Create RTN data provider for AI service | NOT STARTED | |
| Task 28 | Generate career high talking points | NOT STARTED | |
| Task 29 | Generate rivalry/head-to-head talking points | NOT STARTED | |
| Task 30 | Generate ranking movement talking points | NOT STARTED | |
| Task 31 | Detect season highs during show | NOT STARTED | |
| Task 32 | Cache AI context for quick retrieval | NOT STARTED | |

---

## Dependencies

- Phase B depends on Phase A (need scrapers before storage)
- Phases C, D, E depend on Phase B (need data in Firebase)
- Phase E partially depends on Rundown System Phase C (AI Context service)
```

---

## Phase 5: Output Summary

After completing research and document creation, output:

```
RTN Integration Discovery Complete

## Research Findings
- Data source: [API / Scraping / Both]
- Authentication: [Required / Not required]
- Data available: [List key data points]
- Limitations: [Any gaps or restrictions]

## Documents Created
1. PRD-RTN-Integration.md - Requirements and user stories
2. PLAN-RTN-Integration-Implementation.md - 32 tasks across 5 phases

## Recommended Next Steps
1. [First priority action]
2. [Second priority action]
3. [Third priority action]

## Risks
- [Key risks identified during research]
```

---

## Notes

- Road to Nationals URL: https://roadtonationals.com
- Focus on NCAA Division I initially
- Support both men's and women's gymnastics
- Align team keys with existing teamsDatabase structure
- Consider Virtius as fallback/complement for some data
