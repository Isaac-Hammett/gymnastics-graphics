# PRD Who to Watch — Registry Plan

> Per-loop task tracking file. Each parallel loop has its own plan.md.
> Task markers MUST use the exact strings below — `run-loop.sh` greps for them.
> The Discovered Bugs and Learnings sections GROW over time — never delete entries.

**PRD:** `docs/PRD-Who-To-Watch/PRD-Who-To-Watch.md`
**Loop:** registry
**Files owned:** `show-controller/src/lib/graphicsRegistry.js`, `show-controller/src/lib/urlBuilder.js`

---

## Tasks

- **Task 1: Register who-to-watch-title in graphics registry — COMPLETE**
  PRD issue: #19
  Files: `show-controller/src/lib/graphicsRegistry.js`
  Problem: Only `who-to-watch` (lower-third, `who-to-watch.html`) is registered. The full-screen title card (`who-to-watch-title.html`) has no registry entry, so the URL Generator cannot preview it and it doesn't appear in the graphics picker.
  Fix: Add a `'who-to-watch-title'` entry to the graphics registry. Use these properties:
  - `id: 'who-to-watch-title'`
  - `label: 'Who to Watch — Title Card'`
  - `labelTemplate: '{teamName} — Who to Watch Title Card'`
  - `category: 'pre-meet'`
  - `renderer: 'overlay'`
  - `file: 'who-to-watch-title.html'`
  - `transparent: false` (full-screen card, not transparent)
  - `perTeam: true`
  - `gender: 'both'`
  - `keywords`: include 'who to watch', 'title card', 'spotlight', 'featured', 'athlete'
  - `params`: `teamSlot` (number, 1-7, required), `athleteName` (string, required), `teamName` (string), `logo` (string, source: competition), `headline` (string), `body` (string, label: 'Body text'), `imageUrl` (string, label: 'Athlete Image URL'), `imageMode` (string, default: 'portrait'), `badge` (string, default: 'WHO TO WATCH'), `nameFontSize` (number, 40-100, default: 64), `bodyFontSize` (number, 18-44, default: 30), `headlineFontSize` (number, 16-40, default: 28), `textOffsetY` (number, -200 to 200, default: 0), `imageScale` (number, 50-150, default: 100), `imageOffsetX` (number, -200 to 200, default: 0), `imageOffsetY` (number, -200 to 200, default: 0)
  Search first: look at how other overlay entries are structured in graphicsRegistry.js to follow conventions.
  Back pressure: `cd show-controller && npm run build`
  Expected: `who-to-watch-title` appears in the URL Generator graphics picker under "pre-meet" category.

- **Task 2: Add URL builder support for who-to-watch and who-to-watch-title — COMPLETE**
  PRD issue: #20
  Files: `show-controller/src/lib/urlBuilder.js`
  Problem: `generateGraphicURL()` has no case for either `who-to-watch` or `who-to-watch-title`. The URL Generator returns empty URLs.
  Fix: Add URL builder cases for both graphics:
  - `who-to-watch`: Build URL to `/overlays/who-to-watch.html` with params: `athleteName`, `logo`/`logoUrl`, `subtitle`/`teamName`, `statLabel`, `statValue`, `headshot`, `meetTheme`
  - `who-to-watch-title`: Build URL to `/overlays/who-to-watch-title.html` with params: `athleteName`, `teamName`, `headline`, `body`, `logo`/`logoUrl`, `imageUrl`, `imageMode`, `badge`, `meetTheme`, plus all 7 adjustment params (`nameFontSize`, `bodyFontSize`, `headlineFontSize`, `textOffsetY`, `imageScale`, `imageOffsetX`, `imageOffsetY`)
  Search first: look at how existing graphic types build URLs in urlBuilder.js to follow the same pattern (encodeURIComponent, param construction, etc.).
  Back pressure: `cd show-controller && npm run build`
  Expected: URL Generator produces correct overlay URLs for both who-to-watch variants. URLs open and render correctly when pasted into a browser.

- **Task 3: Add editable text controls to URL Generator for who-to-watch-title — NEEDS FIX**
  PRD issue: #24 (new)
  Human rejection: "there are no controls to this. I cant change or modify text."
  Files: `show-controller/src/lib/graphicsRegistry.js`
  Problem: The `who-to-watch-title` registry entry exists but the URL Generator page does not show editable input fields for the text params (athleteName, teamName, headline, body). The user cannot modify the title card content — they just see a static preview with no controls.
  Investigation needed:
  - Check how other graphics (e.g., `team-stats`, `athlete-spotlight`) expose editable params in the URL Generator
  - The registry `params` array should have `editable: true` or similar flag
  - The URL Generator page (`URLGeneratorPage.jsx`) should render input controls for editable params
  Fix approach:
  - Ensure `who-to-watch-title` registry params have the correct structure for editable controls
  - Compare with working graphics that DO show editable controls in URL Generator
  - May need to add `editable: true`, `placeholder`, and proper `type` to each param
  Back pressure: `cd show-controller && npm run build`
  Expected: URL Generator shows text input fields for athleteName, teamName, headline, body. User can type custom values and see the preview update.

---

## Discovered Bugs

<!-- Iterations add entries here as they find problems.
     Format: - BUG: {description} (found during Task N, iteration M)
     These become tasks in the next planning cycle or get logged in the PRD. -->

_No bugs discovered yet._

---

## Learnings

<!-- Iterations add breadcrumbs here for future iterations.
     Format: - LEARNING: {what future iterations need to know}
     These survive across stateless Claude invocations — the only way to pass knowledge forward. -->

- LEARNING: The `buildGraphicUrlFromRegistry()` fallback in `urlBuilder.js` (line ~747-751) auto-generates URLs for any overlay graphic that has a proper registry entry. As long as the `who-to-watch-title` entry has `renderer: 'overlay'` and params defined, the URL builder will work without needing a dedicated case in `generateGraphicURL()`.
- LEARNING: `perTeam: true` graphics get expanded by `getGraphicsForCompetition()` to `team1-who-to-watch-title`, `team2-who-to-watch-title`, etc. The `teamSlot` param is required for this expansion.
- LEARNING: The fallback DOES NOT work for per-team expanded graphics because `getGraphicById('team1-who-to-watch')` returns `null` — the registry has the base ID `'who-to-watch'` not the expanded ID. Explicit regex handlers are required in `generateGraphicURL()` for per-team graphics (see `team{N}-stats`, `team{N}-coaches`, `team{N}-roster` patterns).
- LEARNING: `who-to-watch.html` params: `athleteName`, `logo`/`logoUrl`, `subtitle`/`teamName`, `statLabel`, `statValue`, `headshot`, `meetTheme`.
- LEARNING: `who-to-watch-title.html` params: `athleteName`, `teamName`, `logo`/`logoUrl`, `headline`, `body`, `imageUrl`/`headshot`, `imageMode`, `badge`, `nameFontSize`, `bodyFontSize`, `headlineFontSize`, `textOffsetY`, `imageScale`, `imageOffsetX`, `imageOffsetY`, `meetTheme`.

---

## Fix History

<!-- When a fix is applied from issues/{name}.json or rejected/{name}.json,
     document what was fixed, why, and what changed.
     Format:
     ### Fix: {description} (Pass N)
     - Source: {issues/{name}.json | rejected/{name}.json}
     - Reason: {Claude diagnosis | human rejection reason}
     - What changed: {files modified, approach taken}
-->

### Pending Fix: Add editable text controls (Pass 3)
- Source: `rejected/registry.json`
- Reason: Human rejection — "there are no controls to this. I cant change or modify text."
- Status: Task 3 added to plan, awaiting implementation
