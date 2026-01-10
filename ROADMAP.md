# Gymnastics Graphics - Roadmap

## Completed Features

### React App Consolidation
**Status:** Implemented

Consolidated the graphics system from scattered static HTML files into a unified React application.

**What was consolidated:**
- `index-hub.html` → HubPage.jsx (navigation hub)
- `dashboard.html` → DashboardPage.jsx (competition management)
- `controller.html` → ControllerPage.jsx (graphics control)
- `index.html` → UrlGeneratorPage.jsx (OBS URL generator)

**What remains as static HTML:**
- `output.html` - OBS requires exact 1920x1080 viewport, must load instantly
- `overlays/*.html` - OBS browser sources with URL params, simple and fast-loading

**Benefits:**
- Single codebase with shared components and hooks
- React Router for proper client-side navigation
- Shared Firebase hooks eliminate duplicate code
- Consistent styling with Tailwind CSS
- Better developer experience

**Deployment:**
- Netlify serves the React SPA with fallback routing
- Static files (output.html, overlays/) bypass SPA routing

---

### Virtius API Integration - Competition Setup
**Status:** Implemented

The Dashboard now supports importing competition details from the Virtius scoring system.

**How it works:**
1. In Dashboard > Create Competition, enter a Virtius Session ID
2. Click "Fetch" to auto-populate: event name, date, venue, location, teams, and competition type
3. The session ID is saved with the competition for future use

**API Endpoint:** `https://api.virti.us/session/{sessionId}/json`

---

### Virtius Leaderboard Graphics
**Status:** Implemented

Embedded Virtius leaderboards as a new graphic type, controlled via the GraphicsControl panel.

**How it works:**
1. Competition must have a Virtius Session ID configured (via Dashboard)
2. In Producer View > Web Graphics, click any leaderboard button (FX, PH, SR, VT, PB, HB, AA)
3. The output.html renders an iframe with the Virtius leaderboard

**Leaderboard URL format:** `https://virti.us/session?s={sessionId}&leaderboard={event}&theme=dark`

**Available leaderboards:**
- `fx` - Floor Exercise
- `ph` - Pommel Horse
- `sr` - Still Rings
- `vt` - Vault
- `pb` - Parallel Bars
- `hb` - High Bar
- `aa` - All Around

---

## Future Enhancements

### RTN Scoring Stats Integration
**Priority:** Medium
**Status:** Planned

Road to Nationals API provides team scoring statistics (averages, highs, RQS) but the data format needs investigation.

**Current state:**
- RTN dashboard API has a `test` field with `ave`, `high`, and `rqs` values
- These appear to be per-event scores (e.g., 52.650) rather than team totals
- Need to verify what these values represent and find team total averages/highs

**Goal:** Auto-populate team stats (AVE, HIGH) from RTN when fetching team data.

**What works now:**
- Coaches auto-sync from RTN to config
- Team rosters and rankings available

**TODO:**
- Investigate RTN API for correct team total statistics
- May need to calculate averages from meet scores in `meets` array
- Consider using Virtius API for more accurate live/current stats

---

### Railway Deployment - OBS Scene Control
**Priority:** High
**Status:** Ready to Deploy

Deploy the Node.js server to Railway to enable live OBS scene control from the Producer and Talent views.

**Current State:**
- Server code exists in `server/` directory
- Socket.IO integration for OBS WebSocket communication
- Works locally but not deployed

**What this enables:**
- Producer view can change OBS scenes in real-time
- Talent view can trigger scene transitions
- CSV timesheet playback controls OBS automatically
- Web graphics sync with OBS scene changes

**Why Railway is needed:**
- The show controller (Producer/Talent views) uses Socket.IO to communicate with OBS
- Socket.IO requires a persistent WebSocket connection to a Node.js server
- Netlify only serves static files; it cannot run the Socket.IO server
- Railway provides always-on Node.js hosting with WebSocket support

**Without Railway deployed:**
- Web graphics (Firebase-based) work fine on Netlify
- OBS scene control buttons do nothing (no server to relay commands)
- CSV timesheet playback won't trigger OBS changes

**Deployment files ready:**
- `server/Procfile` - Railway process definition
- `server/railway.json` - Railway configuration
- `server/.env.example` - Environment variables template

---

### Virtius API Integration - Live Data
**Priority:** High
**Status:** Planned

Extend the existing Virtius integration to support live data during competition:

**Planned Features:**
- Real-time score updates via polling or WebSocket
- Live leaderboard data for graphics
- Automatic lineup data for event summary graphics
- Score ticker overlays

**Data Available from API:**
- `meet.teams[].final_score` - Team totals
- `meet.teams[].events[].event_score` - Event scores
- `meet.teams[].events[].gymnasts[]` - Individual scores with e_score, final_score
- `meet.event_results[]` - Rankings per event

---

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

### Virtius Scoreboard/Lineup Integration
**Priority:** Medium
**Status:** Planned

Virtius provides a scoreboard/lineup view that requires keyboard interaction:

**Scoreboard URL:** `https://virti.us/session?s={sessionId}&scoreboard&theme=dark`

**Interaction required:**
- Press keys 1-6 to select rotation/event
- Cannot be controlled via URL parameters alone
- Current rotation shows event summary (scores after event)
- Next rotation shows upcoming lineup

**Possible approaches:**
1. Keep as separate OBS browser source (manual control)
2. Embed iframe and use postMessage API (if Virtius supports it)
3. Build our own event summary graphics using Virtius API data

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
