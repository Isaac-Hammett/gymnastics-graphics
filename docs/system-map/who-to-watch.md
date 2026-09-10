# Who to Watch

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Graphics
**Purpose:** Lets a producer build an ESPN-style athlete spotlight package inside a rundown segment — pick a team + athlete from the roster, write up to 3 full-screen title cards, attach a highlight video URL — and have the server play the whole package on air automatically (card → card → card → video with a Who-to-Watch lower third → clear → advance).
**Status:** **Partial** — the full pipeline exists and is wired end to end, but has open control gaps and two integration bugs, and no evidence of live use. Editor is reachable (`App.jsx:137` `/:compId/rundown` → `RundownEditorPage.jsx:8542` renders `WhoToWatchEditor` when `formData.type === 'who-to-watch'`), persists to Firebase, and the coordinator sequencer is real code (`server/index.js:744–960`) driven by `timesheetEngine.js:870–877`. Verification screenshots and `docs/PRD-Who-To-Watch/verification-history.json` record PASS for the registry/urlBuilder/editor loops, but `docs/PRD-Who-To-Watch/loops/video-playback/fixes.md` states the server-side sequencer tasks "could not be verified live because the coordinator server is offline." Sub-parts at a different level: (a) **Orphaned** — the per-team registry buttons `team{N}-who-to-watch` / `team{N}-who-to-watch-title` surfaced by `GraphicsControl.jsx` write that literal id to `currentGraphic`, and `output.html` only has renderers keyed `who-to-watch-title` / `who-to-watch-lower-third`, so a manual trigger falls through to `!renderers[graphic]` and clears the output (`output.html:13282`); (b) **Partial** — theme-level per-graphic overrides never reach the lower third (see Known gaps).
**Sport coupling:** **Sport-parameterized** — all overlay/sequencer logic is free text (athlete, team, headline, body, stat label/value); the only coupling is the roster lookup key `${schoolKey}-${competitionGender}` in `WhoToWatchEditor.jsx:654` and the gymnastics headshot/media store it reads from.

**Key files:**
- `overlays/who-to-watch-title.html` (615 lines) — full-screen ESPN-style title card; ~25 URL adjustment params (badge, team row, text, image, watermark, bgColor/accentColor), auto stat-callout detection
- `overlays/who-to-watch.html` (281 lines) — transparent lower third; 3-layer CSS-var cascade + 15 URL adjustment params
- `show-controller/src/components/playout/WhoToWatchEditor.jsx` (1290 lines) — the producer editor: searchable team/athlete selects, image picker, titleCards array, Card Adjustments + Lower-Third Adjustments panels, `ValueStepper`, theme dropdown, two live iframe previews
- `show-controller/src/pages/RundownEditorPage.jsx` (12193 lines) — segment type registration (l.202), rose badge/border (l.215/229), print-view row (l.3363), editor mount + validation (l.8542–8580), props/plumbing (l.6621)
- `server/index.js` (WTW block l.744–960) — the on-air sequencer: builds steps, writes `currentGraphic`, waits on clipStatus, advances
- `server/lib/timesheetEngine.js` (1841 lines) — `SEGMENT_TYPES.WHO_TO_WATCH` (l.51), emits `whoToWatchStarted`/`whoToWatchStopped` (l.320, 545, 650, 873)
- `output.html` (13780 lines) — `who-to-watch-title` + `who-to-watch-lower-third` iframe renderers (l.12748/12765); live-mode WTW lower-third-over-clip branch (l.13259); clip-mode `#clipOverlay` suppression (l.13528/13589/7044)
- `show-controller/src/hooks/useTeamsDatabase.js` (925 lines) — `getAthleteMedia` / `saveAthleteMedia` / `deleteAthleteMedia` (l.703–750)
- `show-controller/src/pages/MediaManagerPage.jsx` (1483 lines) — `RosterView` expandable athlete row, gallery, "Add Image" form (l.643–790)
- `show-controller/src/lib/urlBuilder.js` (973 lines) — `team{N}-who-to-watch` and `team{N}-who-to-watch-title` URL cases (l.549–590)
- `overlays/theme-loader.js` (1677 lines) — 48 `wtw*` layout-override → CSS-var mappings (l.1000–1054); `detectGraphicId()` (l.407)
- `show-controller/src/pages/ThemeEditorPage.jsx` — `PLAYOUT_GRAPHICS` / `PLAYOUT_DEFAULTS` (l.213, 316–345), WTW preview URL builder + image-mode variant selector (l.1690–1730)

**Firebase paths written:**
- `competitions/{compId}/currentGraphic` — sequencer steps: `who-to-watch-title` ×N, then `clip-playback` (with `overlayStyle: 'who-to-watch'`), then `clear`
- `competitions/{compId}/rundown/segments/{index}/whoToWatch` — editor persistence (whole config incl. `titleCards[]`, `lowerThirdAdjustments`)
- `teamsDatabase/media/{safeAthleteKey}` — athlete media gallery array `{url, type, label, updatedAt}`
- `competitions/{compId}/production/clipStatus/{draftId}` — written by `output.html` clip source; the sequencer only reads it

**Firebase paths read:**
- `competitions/{compId}/rundown/segments` — server `loadRundown`
- `competitions/{compId}/config/meetTheme` — sequencer resolves theme id for every step
- `competitions/{compId}/production/clipStatus` — `child_added`/`child_changed`, advance on `ended`/`played`
- `competitions/{compId}/currentGraphic` — both OBS browser sources
- `themes` — editor theme dropdown; `themes/{themeId}` — `theme-loader.js` inside each overlay iframe; `themes/{themeId}/overrides/who-to-watch-title` — "Import from Theme"
- `teamsDatabase/teams`, `teamsDatabase/headshots`, `teamsDatabase/aliases`, `teamsDatabase/media`

**Socket events:** `emits:` none WTW-specific (state reaches clients via Rundown's `timesheetSegmentActivated` / `timesheetState`) / `listens:` none WTW-specific. Internal EventEmitter only: `whoToWatchStarted`, `whoToWatchStopped` (engine → `server/index.js`). Entry point is Rundown's `loadRundown` → `getOrCreateEngine()` (`server/index.js:7389`), then `startShow` / `advanceSegment` / `goToSegment`.

**HTTP routes:**
- `GET /api/clip-proxy?url={encoded}` — proxies R2 presigned clip URLs (shared with Clip playout; `server/index.js:4280`, called from `output.html:6752`)

**External services:**
- Cloudflare R2 — hosts the highlight clip presigned URLs the producer pastes
- `media.virti.us` — athlete headshots and team logos resolved from Teams database
- `img.youtube.com` — editor-side thumbnail for YouTube clip URLs (`WhoToWatchEditor.jsx:770`)
- Google Fonts (Inter) — both overlays

**Depends on:**
- Rundown — direct import + engine — provides the segment type, the Firebase segment record, and the start/advance lifecycle that fires `whoToWatchStarted`
- Coordinator server — direct import — hosts the sequencer (`getOrCreateEngine` path only; the legacy singleton engine has no WTW handler)
- Graphics rendering — Firebase `competitions/{compId}/currentGraphic` — `output.html` renders both overlays as 1920×1080 iframes on the graphics source
- Clip playout — Firebase `currentGraphic` `clip-playback` + `production/clipStatus` + `GET /api/clip-proxy` — WTW reuses the clip source, its preload/proxy/status machinery, and its `draftId` protocol; it only suppresses `#clipOverlay` and substitutes its own lower third
- Themes — Firebase `themes/{id}` via `theme-loader.js` and `themes/{id}/overrides/who-to-watch-title` — colors and "Import from Theme" defaults
- Teams database — direct import `useTeamsDatabase()` — roster, headshots, `teamsDatabase/media` gallery
- Competition model — Firebase `competitions/{compId}/config` + `competition.teams` — team slots, logos, gender, `meetTheme`
- OBS integration — two stacked browser sources (graphics + `?mode=clip`) are required for the video step to composite

**Used by:**
- Competition workspace → Rundown tab — `show-controller/src/pages/RundownEditorPage.jsx`
- Producer View — the segment plays automatically once the show engine reaches it; no dedicated WTW panel
- Settings-level Media Manager — `show-controller/src/pages/MediaManagerPage.jsx` (feeds the title-card image picker)
- Themes → Theme Editor — `ThemeEditorPage.jsx` previews both WTW graphics under "Playout / Who to Watch" and stores their override panels
- Graphics rendering → URL Generator — `urlBuilder.js` builds standalone `team{N}-who-to-watch[-title]` preview URLs

**UI surfaces:**
- Rundown segment detail panel, "Who to Watch" type — `show-controller/src/components/playout/WhoToWatchEditor.jsx`
- Card Adjustments (Theme / Badge / Team / Text / Image / Watermark) + "Import from Theme" — same file, l.993–1094
- Lower-Third Adjustments (Theme / Badge / Text / Headshot / Logo / Position) — same file, l.1184–1258
- Rundown print/export view rose badge + "Who to Watch" filter button — `RundownEditorPage.jsx:3363, 3610`
- Media Manager → roster athlete row → gallery + "Add Image" — `MediaManagerPage.jsx:643–790`
- Theme Editor graphic selector + WTW override panels + image-mode variant dropdown — `ThemeEditorPage.jsx`
- Producer graphics panel per-team WTW buttons — `GraphicsControl.jsx` (present but non-functional, see gaps)

**Known gaps:**
- **Theme per-graphic overrides never reach the lower third.** `who-to-watch.html` CSS reads `--who-to-watch-lower-third-*` (48 vars), but `theme-loader.js:407 detectGraphicId()` derives the id from the filename → `who-to-watch`, so `applyOverrides()` sets `--who-to-watch-*`. The Theme Editor stores overrides under `who-to-watch-lower-third`. Nothing in `theme-loader.js` aliases the two (only global `--meet-*` colors get through). The PRD-Theme-System-V2 7F.3 checklist marked these as "CSS vars in place" rather than tested.
- **Title card ignores theme layout overrides entirely** — `who-to-watch-title.html` contains no `--who-to-watch-title-*` vars at all; theme `wtw*` values only reach it indirectly when the producer clicks "Import from Theme", which copies them into card fields (`THEME_TO_CARD_FIELD_MAP`, `WhoToWatchEditor.jsx:91–123`). Consistent with the note that rundown-editor card adjustments always trump theme-editor values, and that "Import from Theme" overwrites the card's current values (`importThemeToCard`, l.739).
- **Manual trigger is dead** — `GraphicsControl.sendGraphic` leaves `graphicType = 'team1-who-to-watch'` (l.467) and `output.html` has no renderer for that id, so the button clears the output instead of showing the graphic.
- **PRD Issue #24 still open** — `UrlGeneratorPage.jsx` renders zero inputs for `athleteName` / `headline` / `body` / `imageUrl` (`grep -c athleteName` = 0) even though `urlBuilder.js:566–588` reads them, so the URL Generator emits a WTW title card with no editable text.
- **PRD Issue #22 residual** — `DEFAULT_WHO_TO_WATCH.imageMode` is now `'portrait'`, but `handleTeamSelect` and `handleAthleteSelect` still force `imageMode: 'headshot'` (l.686, 700), so the mismatch with `output.html`'s `'portrait'` default can still occur.
- **Theme picked in the editor is never saved** — `themeOverride` is local component state (l.595); it changes the previews only. On air the sequencer reads `competitions/{compId}/config/meetTheme`.
- Lower-Third Adjustments panel has no "Import from Theme" equivalent (title cards only).
- `ThemeEditorPage.jsx:1697` sends `badgeText` to the title card, but `who-to-watch-title.html:552` reads `badge` — the Theme Editor preview's badge text is ignored.
- Title card hold time is hard-coded `TITLE_CARD_DURATION_MS = 5000` (`server/index.js:741`); PRD lists per-card duration as a future enhancement. Clip step force-advances after a 120s safety timeout.
- No Clip Engine integration — `clipUrl` is a manual paste only (`WhoToWatchEditor.jsx:1132`); PRD lists "auto-populate athlete clips from the Clip Engine API" as future work.
- `proxyClipUrl()` hard-codes `https://api.commentarygraphic.com/api/clip-proxy` (`output.html:6757`) — the torn-down prod coordinator; R2 clips will not play locally.
- The WTW sequencer is registered only inside `getOrCreateEngine()`; the legacy singleton engine (`initializeTimesheetEngine`, `competition:local` room) has no `whoToWatchStarted` handler.
- `deleteAthleteMedia` is not passed into `WhoToWatchEditor` (`RundownEditorPage.jsx:6621`) — gallery images can only be deleted from Media Manager.
- No server tests: `grep whoToWatch server/__tests__/` returns nothing.
- PRD Known Issues #1–#13 (missing image, no team wash, no watermark, tiny type, no stat callout, no accent bar/stripe) describe a pre-redesign render; the current `who-to-watch-title.html` implements all of them, but they were never formally re-closed in the PRD. #15/#16 (sliders hard to see, preview too small) are only partly addressed — sliders became `ValueStepper` inputs and an "Open full-size preview ↗" link was added, but the inline preview is still a scaled thumbnail.

**Evidence of live use:** none found
- `docs/PRD-Who-To-Watch/loops/video-playback/fixes.md` — "Tasks 1-2 (server-side sequencer changes) could not be verified live because the coordinator server is offline… Task 8 (live output) verification is partial."
- `docs/PRD-Graphics-Audit-ECAC/logs/output-unthemed.log:27,29` — WTW graphics were screenshotted in the ECAC 80-graphic audit sweep (2026-04-03), i.e. a rendering audit, not a broadcast.
- All WTW commits are dated 2026-03-24 → 2026-03-27 and none name a meet; no WTW mentions in `docs/WCGNIC-2026/` or any live-incident write-up.

**PRDs / docs:**
- `docs/PRD-Who-To-Watch/PRD-Who-To-Watch.md` (693 lines) — main PRD; "NEEDS FIX", 28 known issues numbered 1–36 with 9 marked FIXED inline (18, 21, 25, 26–30, 31–35)
- `docs/PRD-Who-To-Watch/verification-history.json` — per-task pass records for the registry/urlBuilder/editor loops
- `docs/PRD-Who-To-Watch/loops/video-playback/{plan.md,fixes.md,verification-log.html,screenshots/}`
- `docs/PRD-Who-To-Watch/issues/{editor.json,registry.json}` — both empty `[]`; `docs/PRD-Who-To-Watch/rejected/` — the two human rejections that became PRD #24/#25
- `docs/PRD-Theme-System-V2/plan.md` §7F.1–7F.7 — WTW theme override panels, override hierarchy, CSS-var conversion, variant selector
- `CLAUDE.md:857–933` — "Who to Watch (Title Card Overlay)" query-param reference
- `overlays/graphic-ids.json:31–32,77–78`, `stage/graphics/legacy/who-to-watch{,-title}.json` — renderer manifests
