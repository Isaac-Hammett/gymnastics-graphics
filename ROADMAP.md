# Gymnastics Graphics - Roadmap

## Future Enhancements

### Event Summary Graphics Generation
**Priority:** High
**Status:** Planned

Currently, event summary graphics are pre-generated images from the scoring system and imported into OBS as separate scenes based on athlete count (`Event Summary-4x`, `Event Summary-6x`, etc.).

**Goal:** Generate event summary graphics dynamically within our controller based on lineup data.

**Requirements:**
- Integrate with scoring system API to fetch lineup data before competition
- Build dynamic graphic template that adjusts layout based on athlete count
- Eliminate need for multiple OBS scene variants
- Auto-populate timesheet with correct data from API

**Benefits:**
- No more manual scene selection based on lineup size
- Real-time updates if lineup changes
- Consistent styling across all events
- Reduced OBS scene complexity

---

### Scoring System API Integration
**Priority:** High
**Status:** Planned

Integrate with external API to fetch:
- Competition metadata (teams, format, venue)
- Athlete lineups per apparatus
- Live scores during competition

This enables:
- Auto-generating timesheets with correct scene variants
- Dynamic event summary graphics (see above)
- Future: live score overlays

---

### Virtius Integration
**Priority:** Medium
**Status:** Planned

Virtius provides browser-based graphics that could be integrated:

**Leaderboards** (URL parameter controlled):
- Format: `https://virti.us/session?s={sessionId}&leaderboard={event}&theme=dark`
- Events: `fx`, `ph`, `sr`, `vt`, `pb`, `hb`, `aa`
- Could be added as a graphic type in output.html via iframe
- Timesheet example: `graphic=virtius-leaderboard, graphicData=event=ph`

**Producer Mode** (interactive, no URL params):
- Format: `https://virti.us/session?s={sessionId}&producer`
- Used for lineup displays
- Best kept as OBS browser source (manually controlled)
- Could potentially be controlled via postMessage API if Virtius supports it

**Session ID**: Each competition has a unique session ID (e.g., `bcLqSq4o3I`)

---

## Current System Notes

### Competition Types
- Men's Dual, Women's Dual (2 teams)
- Men's Tri, Women's Tri (3 teams)
- Men's Quad, Women's Quad (4 teams)
- Men's 5-team, Men's 6-team

### Competition Formats
- Head-to-Head
- Olympic Order

### Lineup Size
- Varies per apparatus within the same meet
- Team A might have 4 on floor, 5 on rings, 6 on vault
- This determines which OBS scene variant to use (e.g., `Event Summary-4x`)
