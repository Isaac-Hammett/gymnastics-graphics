# Graphics rendering

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Graphics
**Purpose:** The browser-source renderers OBS loads to put graphics on air — leaderboards, lower-thirds, slates, sponsor cards, camera frames — plus the registry that catalogs every graphic so the producer UI, URL Generator and rundown all offer the same list. A producer clicks a button in the Web Graphics panel and the graphic appears on the stream within one Firebase round-trip.
**Status:** **Proven**, with the newest of the three renderers at **Built** and several sub-parts **Partial/Orphaned**. `output.html` and `overlays/*.html` have real-broadcast incident write-ups with screenshot evidence naming actual meets: `docs/PRD-Graphics-Registry/BUG-003-Mens-Tri-Event-Summary-Blank.md` (Greenville/California/Simpson men's tri), `BUG-004-5-Team-Event-Summary-Missing-Apparatus.md` (Stanford/California/USA/Mexico/All Stars), `BUG-002-AA-Leaderboard-Missing-Results.md` (Team USA), and `BUG-005-Rotation-Slate-Auto-Stuck-Exhibition-Gymnasts.md`, which names the competition (“Stanford Senior Night Quad (`1iw2zv1s`, 5-team men's)”) and the exhibition-gymnast data pattern that only shows up live. The **stage engine** (`stage/stage.html`, 11 graphics) is complete end to end — manifests → build script → registry → `renderer:'stage'` write → live listener → skeleton+blocks render — and was verified by side-by-side parity screenshots in `docs/PRD-Renderer-System/phase-6/`, but the only sweep evidence is a synthetic audit competition `ecac-2026-audit` (`docs/PRD-Graphics-Audit-ECAC/loops/*/plan.md`), whose own notes say stage graphics “render as blank/black in preview… when no live data is present”. Exceptions at **Orphaned**: `output.html`'s `team-roster` renderer iframes `/overlays/team-roster.html`, which was deleted in commit `424df931`; `urlBuilder.buildLeaderboardURL`/`buildCombinedAALeaderboardURL` still emit `output.html?graphic=virtius-leaderboard`, a renderer key deleted in `e2eecacf`.
**Sport coupling:** **Gymnastics-bound** — `output.html` hard-codes `ROTATION_SCHEDULES` per format, apparatus code maps (`FX/PH/SR/VT/PB/HB` ↔ `FLOOR/HORSE/RINGS/VAULT/PBARS/BAR`, `UB/BB` ↔ `BARS/BEAM`), and `detectEventFromApiData()` (line 8607) reads Virtius `event.rotation` fields directly from `https://api.virti.us/session/{id}/json`; the registry keys 10 of 11 stage graphics to apparatus codes.
**Key files:**
- `output.html` (13,780 lines) — legacy monolith; 49 renderer keys, modes live/clip/preview/clip-preview, `currentGraphic` listener at 13179
- `overlays/` (29 `*.html`, 9,896 lines) — standalone OBS browser sources; 8 also iframed by output.html
- `stage/stage.html` (885 lines) — current component renderer; skeleton+block loader, layout/animation engines, 3 URL modes
- `stage/blocks/` — `leaderboard-table.js` (173), `athlete-grid.js` (250), `header-bar.js` (36), `_sample-block.js` (16)
- `stage/skeletons/full-screen-card.html`/`.css` — only skeleton built (of 4 planned)
- `stage/graphics/` — 55 manifests (11 stage + 44 in `legacy/`) + `categories.json`
- `stage/graphics-registry.json` (4,751 lines) — generated JSON, consumed by the server
- `scripts/buildGraphicsRegistry.js` (753 lines) — validates manifests, emits both registry artifacts, `--status` migration report
- `show-controller/src/lib/graphicsRegistry.generated.js` (2,417 lines) + `graphicsRegistry.js` (250 lines) — generated data + query/`perTeam`-expansion helpers
- `show-controller/src/components/GraphicsControl.jsx` (1,182 lines) — Web Graphics panel; the live trigger
- `show-controller/src/lib/urlBuilder.js` (973 lines) + `pages/UrlGeneratorPage.jsx` (1,666) — copyable OBS URLs + live preview
- `show-controller/src/pages/GraphicsManagerPage.jsx` (379) + `components/CollapsibleSubcategory.jsx` (46) — registry browser; shared sidebar group

**Firebase paths written:**
- `competitions/{compId}/production/clipStatus/{draftId}` — output.html clip-mode playback write-back (line 6837)
- `competitions/{compId}/production/stageErrors/{timestamp}` — stage.html block-load failure report (line 183)
- `competitions/{compId}/scoreBug/detected/nowCompeting`, `/detected/teams`, `/connectionStatus` — `overlays/team-bug.html`

**Firebase paths read:**
- `competitions/{compId}/currentGraphic` — the live trigger, read by both output.html and stage.html
- `competitions/{compId}/config` — stage.html standalone mode, team-bug.html, rotation-slate-auto.html
- `competitions/{compId}/scoring/leaderboard/{APPARATUS}` — stage `leaderboard-table` block (`competitions/{comp}/{data.source}`)
- `competitions/{compId}/scoreBug` — team-bug.html
- `competitions/{compId}/production/engineHeartbeat` — output.html clip mode
- `teamsDatabase/teams`, `teamsDatabase/headshots`, `teamsDatabase/teams/{teamKey}/roster`
- `themes/{themeId}` — output.html, stage.html, `overlays/theme-loader.js`
- `.info/connected`

**Socket events:** `emits:` none / `listens:` none — all three renderers are pure Firebase RTDB clients (compat SDK 9.22.0 via gstatic); no socket.io in `output.html`, `stage/stage.html`, or any `overlays/*.html`.
**HTTP routes:** 
- `GET /*` (static) — `server/index.js:1862` `express.static(join(__dirname,'..'))` serves `output.html`, `overlays/`, `stage/` off the project root
- `GET https://api.commentarygraphic.com/api/clip-proxy?url=` — output.html CORS fallback for clip video (line 6757)

**External services:**
- Virtius API (`https://api.virti.us/session/{id}/json`) — event summary + rotation detection in output.html (8675, 10849); polled by `overlays/team-bug.html` (1365) and `overlays/rotation-slate-auto.html` (1331)
- `media.virti.us` — team logos and athlete headshot images
- Firebase Realtime Database (`gymnastics-graphics-default-rtdb`) — config baked into output.html:7503 and stage.html:40
- Google Fonts — Inter / Inter Tight / Roboto Mono / JetBrains Mono / Poppins

**Recording package loader (ISA2-294, 2026-09-27) — tile geometry timeline for recorded broadcast playback.** The stage engine can play back a recorded show using tile geometry queries to position graphics correctly over the recorded video. `server/lib/recordings/recordingPackage.js` loads a per-recording package from `recordings/{name}/` (directory containing `meta.json`, `virtius-final.json`, and optional `events.jsonl`) with the API: `loadRecordingPackage(name)` returns `{meta, virtiusFinal, events, tileFor(event, tMs)}`, plus list/load functions for individual files. `layoutTimeline` in meta.json is an array of entries `{fromMs, layout, tiles, tickerRect, note}`, each entry a contiguous time window where the OBS layout is fixed; `tileFor(event, tMs)` returns the tile box for an event's apparatus at a timestamp, or null if cutaways or no-tile windows overlap. **Tile geometry caveats:** 3x2 layout tiles are NOT equal thirds (columns split at x=582/970, rows at y=332, measured by edge detection); 2x2 has ~28px margin (x 28-1252, y 8-628); tickerRect is {0,630,1280,90}. **Cutaways are modeled (ISA2-301, 2026-09-27):** the timeline has 40 entries measured from the video (boundaries within ~2 s). Stable 3x2 blocks run 17:18-23:52, 34:32-44:03, 53:50-1:00:51, 1:10:22-1:18:06, 1:27:35-1:34:33 and 1:45:18-1:52:46 (the old 40:00 start and the single 2x2 entry from 1:20:00 were wrong); 2x2 appears only in three short blocks (1:03:49, 1:19:29, 1:55:06), and the 1:55:06 block puts HORSE top-right instead of PBARS. Everything else is a cutaway entry with empty `tiles` (`5-tile`, `2-panel`, `single-cam`, `leaderboard`, and one `ceremony` entry from 2:08:20 to the end), so `tileFor()` returns null there and `applyLayout` shows the full frame. 5-tile and 2-panel boxes are not modeled: the event-to-tile order changes. **Evidence:** ECAC 2026 recording metadata generated and verified with screenshots (ISA2-294 answer, `docs/verification/ISA2-294/`; cutaways `docs/verification/ISA2-301/`).

**Depends on:**
- Themes — direct import (`overlays/theme-loader.js`, 1,677 lines, loaded by output.html and 27 of 29 overlays) + Firebase `themes/{themeId}`; `GraphicsControl` calls `resolveTheme()` and bakes the result into the stage payload
- Scoring feed — Firebase `competitions/{compId}/scoring/leaderboard/{apparatus}` written by `server/lib/scoringIngestionService.js`; the only data source for all 11 stage graphics
- Teams database — Firebase `teamsDatabase/*` for logos, headshots and rosters (output.html, team-bug.html, `athlete-grid` block)
- Competition model — Firebase `competitions/{compId}/config` for team names/logos, `compType`, `virtiusSessionId`, `meetTheme`
- Sponsors — sponsor arrays resolved in `GraphicsControl` from `themes/{id}/sponsors` and `useTeamsDatabase`, passed as a JSON URL param to the three sponsor overlays
- Who to Watch — Firebase `currentGraphic` writes from the server sequencer (`server/index.js:878`) that drive `who-to-watch-title` and the WTW clip lower-third
- Clip playout — Firebase `currentGraphic` (`clip-playback`/`moment-replay`) plus `production/engineHeartbeat`; output.html `mode=clip` is the video surface
- Recording package — `server/lib/recordings/recordingPackage.js` for tile geometry lookups in recorded-show playback

**Used by:**
- Producer View (surface) — `show-controller/src/views/ProducerView.jsx:1472` renders `GraphicsControl`
- Talent View (surface) — `show-controller/src/components/QuickActions.jsx` writes `currentGraphic` directly (event-summary, leaderboards, clear)
- Rundown — `server/lib/timesheetEngine.js` `_triggerGraphic` writes `competitions/{compId}/currentGraphic`; since ISA2-272 (2026-09-27) it builds the payload by calling `buildGraphicPayload()` in `server/lib/graphicPayload.js`, which now owns the `stage/graphics-registry.json` load, `getGraphicById`, the config/sponsor/custom data assembly, the renderer routing, and the stage skeleton/blocks/theme resolution. `ShowContext.jsx:397` mirrors segment-triggered graphics
- Action bus — `server/lib/actionBus.js` (ISA2-272) writes `currentGraphic` for `graphic:{id}` / `graphic:clear` actions through the *same* `buildGraphicPayload()`, so a bus-fired graphic and a rundown-fired one are byte-identical apart from `segmentId` and `timestamp` (`server/__tests__/graphicPayload.test.js` asserts this)
- Clip playout — `server/lib/playoutEngine.js:1142` writes `currentGraphic` and reads clip status back from output.html
- OBS integration — `POST /api/obs/templates/:id/apply` (`server/routes/obs.js:1743-1750`) hands OBS the graphics browser-source URLs
- Competition workspace (surface) — `/url-generator` and `/graphics-manager` routes in `show-controller/src/App.jsx:89,91`, linked from `HomePage.jsx:885,891`

**UI surfaces:**
- Producer View → Web Graphics panel — `show-controller/src/components/GraphicsControl.jsx`
- Talent View → Quick Actions — `show-controller/src/components/QuickActions.jsx`
- URL Generator page (`/url-generator`) — `show-controller/src/pages/UrlGeneratorPage.jsx` (sidebar built from `CATEGORIES`, live 1920×1080 iframe, "Rendering via stage.html / overlays/x.html / output.html" badge)
- Graphics Manager page (`/graphics-manager`) — `show-controller/src/pages/GraphicsManagerPage.jsx`
- Shared sidebar grouping — `show-controller/src/components/CollapsibleSubcategory.jsx`

**Known gaps:**
- **9 registry `overlay` graphics have no `output.html` renderer key**, so their Web Graphics panel button writes `renderer:'output'` and output.html falls into `!renderers[graphic]` → blank screen: `animated-background`, `athlete-spotlight`, `clip-player`, `frame-dual`, `frame-tri-wide-top`, `interview-card`, `stream`, `team-bug`, `who-to-watch` (output.html's key is `who-to-watch-lower-third`). They work only as direct OBS browser sources / URL Generator URLs.
- `QuickActions.sendLeaderboard` (line 258) writes `graphic:'virtius-leaderboard'` with **no `renderer` field**; output.html deleted that renderer (commit `e2eecacf`) and stage.html dismisses anything not `renderer:'stage'` — the Talent View leaderboard buttons render nothing.
- `output.html`'s `team-roster` renderer (line 13036) iframes `/overlays/team-roster.html`, deleted in commit `424df931`.
- `server/routes/obs.js:1748-1750` hands OBS `overlays/stream-starting.html`, `stream-ending.html`, `dual-frame.html` — none exist — and `output.html?compId=…&graphic=all` uses the wrong param name (`comp`) and a non-existent graphic id.
- Migration is 11/55 (20%): `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md:1305-1326` lists Phases 8–12 (animations, theme-editor, rundown, visual editor, AI) and 13–18 (remaining ~60 graphics, legacy cleanup) as NOT STARTED. Blocks: 4/12 built (`score-card`, `team-summary`, `apparatus-scores`, `event-bar`, `medal-table`, `sponsor-grid`, `athlete-stats`, `rotation-progress`, `team-comparison` missing). Skeletons: 1/4 (`lower-third`, `full-bleed`, `split-screen` missing).
- The PRD's "Firebase-first, graphics never call external APIs" rule holds only for stage; `output.html`, `team-bug.html` and `rotation-slate-auto.html` still fetch `api.virti.us` directly from the browser.
- `combined-aa-leaderboard` declares a required user param `virtiusSessionId2`, but nothing in the trigger path passes it and `scoringIngestionService.js` never writes `scoring/leaderboard/COMBINED_AA`.
- `GraphicsManagerPage.jsx` uses a stale hard-coded `CATEGORY_LABELS` map (`pre-meet`, `in-meet`, …) that no longer matches `categories.json`, and its renderer filter offers only overlay/output — no `stage` option.
- `overlays/graphic-ids.json` is a stale snapshot (generated 2026-03-25; claims 43 renderers, lists only `team1..team7`).

**Evidence of live use:**
- `docs/PRD-Graphics-Registry/BUG-005-Rotation-Slate-Auto-Stuck-Exhibition-Gymnasts.md` — names the meet and Virtius session (`1iw2zv1s`, 5-team men's), root cause only reachable with real exhibition-athlete data
- `docs/PRD-Graphics-Registry/BUG-004-5-Team-Event-Summary-Missing-Apparatus.md` — on-air "NULL" apparatus, compared against live Virtius R1
- `docs/PRD-Graphics-Registry/BUG-003-Mens-Tri-Event-Summary-Blank.md` and `BUG-002-AA-Leaderboard-Missing-Results.md` — screenshot evidence with real team/athlete names
- `docs/WCGNIC-2026/screenshots/` — 32 files including `final-event-bar.png`, `final-rotation-slate.png`, `showcase-roster.png`, `interview-card-production.png`
- `docs/PRD-Graphics-Audit-ECAC/loops/urlgen/plan.md` and `loops/output-unthemed/plan.md` — full 86-graphic / 80-graphic sweeps against a 6-team men's competition (synthetic `ecac-2026-audit`, so audit-grade rather than broadcast-grade)
- Commits `9760a1f0`, `679ea3f4`, `17a3c454`, `f1b58663`, `11e9a8d0`, `7e7971ee` — "Deploy + Verify … with WCGNIC Data" across playout, overlays, stream, sponsors, team cards, full-screen

**PRDs / docs:**
- `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md` (phase table at 1283-1326, migration tracker at 1188)
- `docs/PRD-Renderer-System/Phase-4-Tool-Integration.md`, `Phase-6-Verification-Cutover.md`
- `docs/PRD-Graphics-Registry/PRD-Graphics-Registry.md`, `PLAN-Graphics-Registry-Implementation.md`, `GUIDE-Adding-New-Graphics.md`, `BUG-002`…`BUG-005`
- `docs/GRAPHICS-INVENTORY.md` (stale: claims "~35-45 unique graphics", pre-registry data-source table)
- `docs/PRD-Graphics-Audit-ECAC/loops/`, `logs/`
- `docs/PRD-Team-Scores-Bug/PRD-Team-Scores-Bug-2026-01-31.md` (spec for `overlays/team-bug.html`)
- `CLAUDE.md:126-289` (stage engine URL modes, renderer routing table, deploy checklist)

---

**Direct answers to your questions**

1. **Total graphic count and split by renderer.** 55 manifests in `stage/graphics/` → registry: **11 `stage`**, **29 `overlay`**, **15 `output`**. Separately, `output.html` defines **49 renderer keys** (its 15 registry `output` ids plus the 8 overlays it iframes, `clear`/`custom`/`live-camera`, and the `team1..team10-stats/coaches` slots). `overlays/` holds **29 HTML files**. After `perTeam` expansion (6 graphics: `athlete-spotlight`, `team-coaches`, `team-stats`, `who-to-watch-title`, `who-to-watch`, `team-roster`) the panel shows 47 buttons for a women's dual, 53 for a men's dual, 81 for a men's 6-team, 91 for a women's 10-team.

2. **Legacy vs current, and what migrated.** `output.html` is the legacy monolith and `overlays/*.html` the legacy standalones; `stage/stage.html` is current. Migrated so far: the 9 per-apparatus leaderboards + `leaderboard-aa` + `combined-aa-leaderboard` (10 of these plus `team-roster` = 11). Their old code was physically deleted from output.html in Phase 6 (`e2eecacf`, `87a88a09`, `424df931`). 44 graphics remain legacy under `stage/graphics/legacy/`.

3. **Exact live trigger path.** `GraphicsControl.renderButton` → `sendGraphic(id)` (`GraphicsControl.jsx:476-525`) → looks up `getGraphicById(id) || getGraphicById(id.replace(/^team\d+-/,'team-'))` → `firebaseRenderer = entry.renderer === 'stage' ? 'stage' : 'output'` → `set(ref(db, 'competitions/{compId}/currentGraphic'), payload)`. For **output**: `{ graphic, graphicId, renderer:'output', data, timestamp }` → `output.html:13179` `db.ref(...currentGraphic).on('value')` → bails if `renderer === 'stage'`, else awaits `themeReadyPromise`, applies per-graphic theme overrides, and does `output.innerHTML = renderers[graphic](data)`. For **stage**: the same payload plus top-level `skeleton`, `blocks` (from `defaultData.blocks`) and a resolved `theme` → `stage.html:638` listener → ignores anything where `val.renderer !== 'stage'` → `dismissCurrentGraphic()` then `renderGraphic(val.graphic, val)` → loads skeleton, loads blocks, applies theme, builds layout, plays enter animations. Both pages listen to the same node, so exactly one is ever on screen.

4. **Data sources.** *Virtius directly:* `output.html` event-summary (rotation + apparatus modes, `fetch('https://api.virti.us/session/{id}/json')` at 8675 and 10849), `overlays/team-bug.html:1365`, `overlays/rotation-slate-auto.html:1331`. *Firebase `scoring/*`:* only the stage engine — `stage/blocks/leaderboard-table.js:145` listens on `competitions/{comp}/{data.source}` where `source` is `scoring/leaderboard/{VT|FX|PH|SR|PB|HB|UB|BB|AA|COMBINED_AA}`. *`teamsDatabase`:* `output.html:7696` (headshots) and `:7810` (teams/logos), `overlays/team-bug.html:671`, `stage/blocks/athlete-grid.js:42-43` (`teams/{teamKey}/roster` + `headshots`). Everything else is URL-param / `currentGraphic.data` driven.

5. **Gymnastics-bound vs generic.** *Bound:* all 11 stage leaderboards + `team-roster`, `event-summary` (`summary-r1..r6`, `summary-{apparatus}`), `event-frame`, `now-competing`, `live-camera`, `team-bug`, `rotation-slate`, `rotation-slate-auto`, `event-bar` as wired (its `eventName`/`venue` come from the gymnastics competition config even though the HTML itself is generic). *Generic:* `sponsors-thanks`/`sponsors-cycle`/`sponsors-bug`, `stream`/`stream-starting`/`stream-thanks`, `logos`, `hosts`, `coaches`/`team-stats`, `warm-up`, `replay`, `interview-card`, `athlete-spotlight`, `who-to-watch`/`who-to-watch-title`, `event-calendar`, `animated-background`, `clip-player`, and all seven `frame-*` layouts — a grep for apparatus/rotation/gymnast vocabulary returns 0 hits in every one of those files; they take only logos, names and text via URL params.
