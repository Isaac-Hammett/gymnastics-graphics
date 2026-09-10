# Themes

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Graphics
**Purpose:** Lets a producer create a per-meet look (8 chrome colors, meet/cause logos, header + body background images, texture, event sponsors) once in a Theme Editor, assign it to a competition with one dropdown, and have every broadcast graphic pick it up automatically — plus per-graphic overrides so one graphic can differ (different header image, bigger venue font, hidden logo) without changing the rest.
**Status:** **Proven** overall, with **Partial** sub-parts. Firebase holds 13 real themes (`themes/` = behind-the-chalk, mpsf-championships, ecac-championships, isla-hbcu, pink-meet-2026, ncga-east-champs-2026/v2/v3, ncga-v4, wcgnic-option-a…d) and they are assigned to live competitions: `competitions/wcgnic-2026-prelim1/config/meetTheme = "behind-the-chalk"`, `competitions/y5l0c3vb/config/meetTheme = "mpsf-championships"` (eventName "MPSF Championships 2026", meetDate "April 4, 2026", theme created 2026-04-04T21:17Z). Live failure telemetry exists at `competitions/wcgnic-2026-prelim1/production/themeErrors` — three real errors from `https://commentarygraphic.com/output.html?comp=wcgnic-2026-prelim1` (two 3s timeouts, one `theme_not_found` for a mistyped `wcgnic-2026`), which proves both the runtime and the error-write path ran in production. Sub-parts at a lower level: the **stage-engine path** is Built-not-Proven for overrides (leaderboards/roster get colors+images but never layout overrides, and the editor's graphic IDs don't match the runtime ones — see Known gaps); **BackgroundGeneratorPage** is Built/standalone (emits a URL, writes nothing, is not part of a theme); the **`applyMeetTheme()`/`loadMeetTheme()` block in `output.html` (7526-7612)** is Orphaned dead code, commented "remove in Task 1.9".
**Sport coupling:** **Sport-parameterized** — the theme engine itself is pure CSS-variable plumbing, but the override key namespace is hard-coded to this sport's graphic inventory (`leaderboard-fx`/`-ph`/`-sr`/`-pb`/`-hb`/`-vt`/`-ub`/`-bb`/`-aa`, `rotation-slate`, apparatus badges, `stickBonusBg`, `LEADERBOARD_EVENTS_MENS/WOMENS` in `ThemeEditorPage.jsx:598-617`); swapping the graphic list/apparatus config would carry it to another sport.

**Key files:**
- `overlays/theme-loader.js` (1677 lines) — the runtime: `window.themeReady`, `?meetTheme=` vs `?comp=` init, 3s timeout, error write, apply/clear overrides, `?debug=theme` panel
- `overlays/theme-overrides.css` (800) — `[data-meet-theme]` rules with the 3-layer cascade `var(--{graphicId}-x, var(--meet-x, fallback))`; injected into overlays *and* output.html
- `output.html` (13780) — inline `[data-meet-theme]` CSS block (lines 872-1290+), live `currentGraphic` listener that calls `themeApplyOverrides`/`themeClearOverrides` (13192-13300), `getStatDisplayConfig()` (7975), `measureHeights` postMessage responder (6693)
- `show-controller/src/pages/ThemeEditorPage.jsx` (7905) — the editor: 3 columns, presets, override panels, templates, competition preview
- `show-controller/src/lib/themeResolver.js` (250) — client resolver: raw Firebase → flat resolved object + `themeToCssVars()`
- `server/lib/themeResolver.js` (256) — identical logic, Admin SDK, ESM `export`
- `stage/stage.html` (885) — `applyTheme(skeletonElement, theme)` (line 242) handling both raw and resolved shapes
- `show-controller/src/components/ThemeErrorLog.jsx` (191) + `hooks/useThemeErrors.js` (86) — producer-facing error panel + badge
- `show-controller/src/pages/BackgroundGeneratorPage.jsx` (927) + `overlays/animated-background.html` (474) — 16-pattern canvas background generator → OBS URL
- `overlays/graphic-ids.json` (90) — Phase 0 registry of graphic IDs and render modes
- `server/index.js:2391-2432` — the three `/api/admin/themes*` routes
- `show-controller/src/pages/HomePage.jsx:1409-1430` — "Meet Theme (optional)" dropdown that assigns a theme to a competition

**Firebase paths written:**
- `themes/{themeId}` (full set, via server Admin SDK `PUT /api/admin/themes/:themeId`)
- `themes/{themeId}/sponsors/{index}` (direct client `update()` from `UrlGeneratorPage.jsx:1369` — sponsor scale/offset/crop)
- `competitions/{compId}/config/meetTheme` (`HomePage.jsx:355` competition create/edit)
- `competitions/{compId}/production/themeErrors/{pushId}` (`theme-loader.js:282`; fields `type|themeId|compId|source|message|url|timestamp|resolved`)
- `competitions/{compId}/currentGraphic` — `.theme` (resolved object) + `.data.meetTheme` (id) written by GraphicsControl / timesheetEngine / playoutEngine

**Firebase paths read:**
- `themes/` (list — Theme Editor, HomePage dropdown)
- `themes/{themeId}` (theme-loader, both resolvers, stage.html, RundownEditorPage export)
- `themes/{themeId}/overrides/{graphicId}` (per-graphic overrides)
- `themes/{themeId}/sponsors` (GraphicsControl, UrlGenerator)
- `themes/{themeId}/lowerThirdTemplate` (Theme Editor template panel)
- `competitions/{compId}/config/meetTheme` (theme-loader, stage.html, playoutEngine, server WTW route)
- `competitions/{compId}/production/themeErrors` (useThemeErrors)
- `competitions/` (Theme Editor competition-preview dropdown, full subtree)

**Socket events:** `emits:` none / `listens:` none — Themes is entirely Firebase + HTTP; no socket surface of its own.

**HTTP routes:**
- `GET /api/admin/themes` — list all themes
- `PUT /api/admin/themes/:themeId` — create or update theme
- `DELETE /api/admin/themes/:themeId` — delete theme

**External services:**
- Firebase Realtime Database — theme storage, competition assignment, error log
- Google Fonts — Inter / Inter Tight / Roboto Mono / JetBrains Mono / Poppins for the font-family override controls
- `gstatic.com` Firebase compat SDK v9.22.0 — loaded dynamically by theme-loader.js only when a theme is requested

**Depends on:**
- Coordinator server — HTTP `/api/admin/themes*` — Admin-SDK writes that bypass Firebase client rules (the editor cannot save without the server running)
- Competition model — Firebase `competitions/{compId}/config/meetTheme` — the assignment that turns a theme on for a broadcast
- Graphics rendering — direct import (`<script src="/overlays/theme-loader.js">` in output.html + 28 overlay files) and CSS-variable contract — the surfaces a theme paints
- Clip playout — Firebase `currentGraphic.data.meetTheme` from `playoutEngine.js` (8 write sites) — themes the clip overlay and WTW lower-third
- Rundown — Firebase `currentGraphic` via `timesheetEngine.js:1071` — resolves theme per stage-engine graphic at cue time
- Sponsors — Firebase `themes/{themeId}/sponsors` — event-level sponsor list lives inside the theme record

**Used by:**
- Graphics rendering — CSS variables + `data-meet-theme` body attribute — every inline and iframe graphic
- Clip playout — `currentGraphic.data.meetTheme` → `clip-overlay` override group
- Who to Watch — `meetTheme` URL param + `themes/{id}/overrides/who-to-watch-title` imported into rundown cards (`WhoToWatchEditor.jsx`)
- Rundown — `RundownEditorPage.jsx:3202` adds `meetTheme` to every exported iframe URL
- Producer View (surface) — theme error badge + `ThemeErrorLog` panel
- Competition workspace (surface) — `GraphicsControl.jsx:684` "themed output" OBS URL, `QuickActions.jsx` passes `meetTheme` on 3 graphics
- Home page (surface) — theme assignment dropdown + Theme Editor / Background Generator cards
- Settings (surface) — `UrlGeneratorPage` theme-sponsor editing and preview URLs

**UI surfaces:**
- Theme Editor page (`/theme-editor`) — `show-controller/src/pages/ThemeEditorPage.jsx`; 3 columns: `col-span-3` saved-themes list + presets, `col-span-5` editor (Theme Info, 8 Colors, Background Images, Textures, Logos, Branding, Event Sponsors, Per-Graphic Overrides), `col-span-4` sticky Live Preview iframe with graphic-type `optgroup` selector (7 categories), competition selector, and variant selectors
- Per-graphic override panels — same file; 7 groups in `OVERRIDE_GRAPHIC_GROUPS` (Lower-Third Bars / Full-Screen / Team Cards / Sponsors / Stream / Overlays / Playout+WTW), each with color checkboxes, image/texture fields, and `OverrideStepper` layout controls; plus "Reset all", "Import from another theme" modal (`importOverrides()`, line 1544), and per-section save
- Category templates with "Apply to All" — Lower-Third, Full-Screen, Team Cards, Sponsors, Stream (`applyLowerThirdTemplate()` line 1043 and siblings); lower-third template persists to `themes/{id}/lowerThirdTemplate`
- Animated Background Generator page (`/background-generator`) — `BackgroundGeneratorPage.jsx`; 16 canvas patterns, logo-upload k-means color extraction, speed/intensity/resolution, and a copyable OBS browser-source URL
- Theme debug panel — `?debug=theme` on any graphic URL; badge + expandable panel showing load status, source, ms, rendering path, graphic ID, 8 CSS vars with Layer 1/2/3 attribution, applied overrides, logo data-attributes
- Producer View theme errors — `ThemeErrorLog.jsx` panel (`ProducerView.jsx:1279`) + `ThemeErrorBadge` in the header (`ProducerView.jsx:662`)

**Known gaps:**
- **`--meet-header-bg-image` fallback missing on warm-up and replay.** `overlays/theme-overrides.css:786-798` gives `.warm-up-teams-row` and `.replay-title-row` only `var(--warm-up-header-bg-image, none)` / `var(--replay-header-bg-image, none)` — no theme-level chain. A theme that sets `images.headerBgImage` (e.g. `themes/mpsf-championships/images/headerBgImage`) will show it on event-bar, sponsors, rotation-slate, event-summary, leaderboard, coaches, spotlight, team-stats/team-coaches — but **not** on warm-up or replay. `behind-the-chalk` works around this with an explicit per-graphic `warm-up.headerBgImage` override; MPSF has no such override, so warm-up/replay lost the image at that meet.
- **Leaderboard graphic-ID mismatch.** The editor stores overrides under `virtuis-leaderboard` (typo, `ThemeEditorPage.jsx:12,451,737`) and `theme-overrides.css:742` reads `--virtuis-leaderboard-header-bg-image`, but the runtime IDs are `virtius-leaderboard` (`GraphicsControl.jsx:471`, `urlBuilder.js:388`) and, since the leaderboard moved to the stage engine, actually `leaderboard-fx`/`-vt`/… (`stage/graphics-registry.json`). No leaderboard override the producer sets can ever reach the renderer. output.html has no leaderboard renderer at all (only `.leaderboard-header` CSS at 1288), so the Theme Editor's leaderboard preview URL (`output.html?graphic=virtuis-leaderboard`) renders nothing.
- **Roster override ID mismatch** — editor writes `overrides/team-roster`; `GraphicsControl.jsx:497` calls `resolveTheme(null, meetTheme, 'team1-roster')`.
- **Stage renderer ignores layout overrides entirely.** `themeResolver` builds `resolved.layout{}` (both copies, line ~170) but `stage.html applyTheme()` only maps colors, logo and images — `theme.layout` is never read. Stage graphics also never get `data-meet-theme` and never load `theme-overrides.css`, so the whole `[data-meet-theme]` rule set is inert there.
- **Two resolver copies to keep in sync.** `server/lib/themeResolver.js` and `show-controller/src/lib/themeResolver.js` are byte-for-byte duplicated logic; both `LAYOUT_FIELDS` lists stop at Phase 5/6 keys (`frameBorderWidth` is the last entry) while `theme-loader.js` has 513 layout keys — so the stage path sees a small fraction of the override surface even if it did apply layout.
- **Theme-level texture never reaches the stage path.** Editor writes `textures.overlay`/`textures.opacity`; theme-loader reads that, but both resolvers only read `theme.images.bodyTexture`, which the editor never writes at theme level.
- **Error-type label mismatch.** theme-loader writes `type: 'timeout' | 'theme_not_found' | 'fetch_failed'` (lines 1603/1657/1665) but `ThemeErrorLog.jsx:51-53` matches `'not_found'` and `'fetch_error'` — two of three error types fall through to the raw string. Confirmed against the real `theme_not_found` record in Firebase.
- **Errors only logged when `?comp=` is present** (`theme-loader.js:278`), so preview-only failures (`?meetTheme=`) are silent.
- **Phase 7 font work is half-done.** 7.FONT.1/7.FONT.4 are in `output.html:7-9` (5 families + preconnect), but 7.FONT.2 landed only on `rotation-slate.html` and `rotation-slate-auto.html` — the other 26 overlays load Inter only (interview-card loads Poppins only). Every `*FontFamily` override on who-to-watch, athlete-spotlight, hosts, coaches, event-calendar, team-bug, sponsors, stream silently falls back because the font isn't loaded in that iframe.
- **No FOUC gate inside iframes.** Only `output.html` awaits `themeReadyPromise` (13106/13125/13217). No overlay file references `window.themeReady`; `overlays/who-to-watch.html:270` still uses the `setTimeout(…, 600)` hack the PRD's Task 1.9 flags for removal.
- **WTW lower-third CSS prefix mismatch.** `who-to-watch.html` uses `--who-to-watch-lower-third-*` throughout, but `detectGraphicId()` derives the ID from the filename → `who-to-watch`. `themeApplyOverrides` will set `--who-to-watch-wtw-card-bottom`, which nothing reads. Plan Task 7F.3 marked these checks "CSS vars in place" rather than verified end-to-end.
- **Task 1.9 deferred** — `output.html` still carries the duplicate `applyMeetTheme()` (7526) / `loadMeetTheme()` (7597) functions plus the whole inline `[data-meet-theme]` block, kept as a fallback; deferral is explicit in the PRD status summary.
- **Duplicate keys in `layoutOverrideMapping`** — `noSponsorsFontSize/Weight`, `titleFontSize/Weight/Family/TextTransform` are each declared twice (519 raw keys, 513 unique); harmless today because the duplicates carry identical suffixes, but the pattern is fragile. `logoSize` also exists in both `imageOverrideMapping` and `layoutOverrideMapping` with the same suffix and different unit handling.
- **The "40 suffixes" figure is stale** — `getAllOverrideSuffixes()` is now dynamic (8 colors + 13 images + 513 layout ≈ 534, matching the console log quoted in `plan.md`). Phase 8B (dynamic derivation) is *done in code* despite the PRD saying NOT STARTED.
- **`/api/admin/themes*` has no auth middleware** — any caller that can reach the coordinator can overwrite or delete a theme.
- **Background Generator is decoupled from themes** — `obsUrl` (`BackgroundGeneratorPage.jsx:729-737`) only encodes `pattern,colors,speed,intensity`; the rendered output is `overlays/animated-background.html` (its own canvas script, no Firebase, no theme-loader, zero `--meet-*` vars). Nothing is saved — no theme field, no Firebase write; the uploaded logo is used only client-side for color extraction and is not in the URL. `overlays/clip-player.html` likewise has no theme support.
- **PRD status field is stale in the other direction** — it claims Phases 7A-7F and 8B NOT STARTED, but `plan.md` marks all 62 tasks COMPLETE and the code confirms it (all 7A-7F suffix blocks present in `theme-loader.js:498-1099`, all panels in `ThemeEditorPage.jsx`, dynamic `getAllOverrideSuffixes()` at 1107).

**Evidence of live use:**
- Firebase `competitions/wcgnic-2026-prelim1/production/themeErrors` — three production errors from `commentarygraphic.com` (timestamps 1774533582742, 1774550886337, 1774579387153)
- Firebase `themes/mpsf-championships` — `createdAt 2026-04-04T21:17:19Z`, `updatedAt 21:22:11Z`, real logo + header image + `overrides.event-bar/warm-up` height tuning; assigned to `competitions/y5l0c3vb` ("MPSF Championships 2026", April 4, 2026)
- Firebase `themes/behind-the-chalk/overrides` — 11 live per-graphic override records, including `headerBgImage: https://commentarygraphic.com/overlays/header-bg-behind-the-chalk.png` and `statDisplay: "avg-high"`
- Theme assignments on real competitions: `ecac-championships` (49d2tpa4), `pink-meet-2026` (fr0ts7fj), `isla-hbcu` (jc2i2eq0), `ncga-v4` (1c8kne2z), `behind-the-chalk` (6jxlrbht, pael72lr, wcgnic-2026-prelim1)
- `docs/WCGNIC-2026/screenshots/` — 32 themed-graphic screenshots (`showcase-*`, `final-*`, `chalk-texture-v3-*`)
- `docs/PRD-Theme-System-V2/screenshots/` — 238 verification screenshots, many named `*-wcgnic*`
- `docs/PRD-Meet-Themes/BUGS.md` — 9 field-found bugs (BUG-T001…T009) from the March 2026 Pink Meet / ISLA HBCU rollout, all marked FIXED
- `docs/PRD-Theme-System-V2/plan.md` LEARNING notes — "Phase 8A production deployment (Task 8.7) verified on 2026-03-26 … on commentarygraphic.com"; "Tested with production URL on wcgnic-2026-prelim1"

**PRDs / docs:**
- `docs/PRD-Meet-Themes/PRD-Meet-Themes-2026-03-06.md` (419 lines, V1 — Phases 1-12, marked COMPLETE)
- `docs/PRD-Meet-Themes/BUGS.md` (265)
- `docs/PRD-Meet-Themes/implementation-plan.md` (821)
- `docs/PRD-Theme-System-V2/PRD-Theme-System-V2-2026-03-25.md` (2064, V2 main PRD — status field stale)
- `docs/PRD-Theme-System-V2/plan.md` (2209, 62 tasks all COMPLETE + LEARNING log — the accurate status source)
- `docs/PRD-Theme-System-V2/audit-css-rules.md` (193), `audit-pseudo-elements.md` (179), `fixes.md` (7, empty)
- `docs/PRD-Renderer-System/phase-4/specs/theme-resolution-patterns.md` — the stage-engine resolver spec
- `CLAUDE.md:205-520` — Unified Theme System, override cascade, debug panel, error reporting reference

**V1 vs V2 boundary.** V1 (`PRD-Meet-Themes`, v3.0, March 2026) built the *thing*: the `themes/{id}` record with 8 colors + logos + branding + sponsors, the Theme Editor page, `theme-loader.js`, `theme-overrides.css`, the competition dropdown, and the `?meetTheme=` URL transport. It ended with the colour model simplified from 10 fields to 8 (`headerBar/contentArea/bodyBackground/borderDivider/badge/badgeText/textOnHeader/textOnContent`), with the old v2.0 names kept as fallbacks — that dual naming is still visible in every mapping table today. V2 (`PRD-Theme-System-V2`, v3.1, March 2026) changed *how it is delivered*: one code path (`theme-loader.js` gained the `?comp=` lookup so live OBS sources theme themselves), observability (`?debug=theme` panel, `themeErrors` in Firebase, `ThemeErrorLog`), the per-graphic override layer (3-layer CSS cascade + `themes/{id}/overrides/{graphicId}`), image/texture support, competition-data preview, and finally Phase 7's expansion from 40 override suffixes to ~534 plus Phase 8A's live-mode override application.

**How a theme reaches each renderer.**
1. **output.html (inline graphics)** — OBS loads `output.html?comp={compId}`. `theme-loader.js` reads `competitions/{compId}/config/meetTheme`, fetches `themes/{id}`, sets `--meet-*` on `:root`, sets `data-meet-theme` on `<body>`, injects `overlays/theme-overrides.css`, caches the raw theme in `window.__themeData`, and resolves `window.themeReady`. Because live mode has no `?graphic=`, `detectGraphicId()` returns null, so the `currentGraphic` listener does the override work per cue: `themeClearOverrides(lastLiveGraphicId)` → `themeApplyOverrides(window.__themeData, graphic)` → render.
2. **Overlay iframes** — each of the 28 overlay files loads `theme-loader.js` itself and gets `meetTheme` from its own URL (output.html forwards `data.meetTheme` or `document.body.getAttribute('data-meet-theme')` into the iframe src). Graphic ID is derived from the filename, so overrides apply at load time. No `themeReady` gate inside the iframe.
3. **stage.html (stage engine)** — a completely separate path. `applyTheme(skeletonElement, theme)` sets `--meet-*` on the *skeleton element*, not `:root`, and handles two shapes: **raw** (`{colors:{headerBar…}, logos:{}, images:{}}`, from standalone `?theme=`/`?comp=` fetch) and **resolved** (flat `{headerBg, headerText, meetLogo, headerBgImage…}`, arriving inside `currentGraphic.theme`). It never sets `data-meet-theme` and never loads `theme-overrides.css`.
4. **Playout engine** — `playoutEngine.js:369-375` loads `_meetTheme` once from competition config at start and stamps it into all 8 `_writeCurrentGraphic()` payloads (`data.meetTheme`), so clip overlays and WTW cards inherit the meet theme; `output.html` applies the `clip-overlay` override group when a clip-type graphic arrives.
5. **Who callsresolveTheme** — client `resolveTheme` is called only from `GraphicsControl.jsx:497` (manual cue), server `resolveTheme` only from `timesheetEngine.js:1071` (rundown cue); both only for `renderer === 'stage'` graphics, and both bake overrides into the flat resolved object before writing it to `currentGraphic.theme`. `themeToCssVars()` is exported by both copies but has **no callers anywhere** in the repo.
