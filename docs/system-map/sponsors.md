# Sponsors

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Graphics

**Purpose:** Lets a producer store sponsor logos (per team, or per championship theme) and put them on air as one of three graphics — a full-screen "Thank You" grid, a full-screen cycling logo, or a small persistent corner bug — with per-logo crop/scale/offset tuning so mismatched source images all render at a consistent size.

**Status:** **Proven.** Live Firebase data exists at `teamsDatabase/sponsors/west-chester-womens` (6 sponsors — Synergy, Higo, DGS, international gym, USAG, Hidden Opponent; written 2026‑01‑31 → 2026‑02‑13) and `teamsDatabase/sponsors/william-mary-{mens,womens}`, plus `themes/behind-the-chalk/sponsors` (7 entries, the WCGNIC theme, Synergy first, "Bradley Wine"/"crown trophy" added 2026‑03). Commits `Sponsor System T12/T18: deploy to production` and `PRD-Theme-System-V2: Task 7C.6 — Deploy + Verify Sponsors with WCGNIC Data` confirm production deploys; `docs/PRD-Sponsors/BUGS.md` BUG‑S16 (2026‑03‑14) is a live-path incident — the rundown-triggered thank-you graphic rendered "No sponsors configured" because `config.team1Key` was `william-&-mary-mens` while sponsors lived at `william-mary-mens`. Exceptions: the URL Generator "Cycle Settings" panel (switch speed + include/exclude) is **Partial** — `cycleDuration`/`excluded` are put on the URL by `show-controller/src/lib/urlBuilder.js:296-309` but `overlays/sponsors-cycle.html` never reads either param (interval hardcoded `setInterval(advanceToNext, 3000)` at line 477). The playout content-sequence `sponsor` item type and `graphicButtons.sponsors` are **Orphaned** (details in Known gaps).

**Sport coupling:** Sport-parameterized — sponsor records themselves are generic (name/url/tier/order/crop); the only coupling is the home-team key derivation `${resolveSchoolKey(team1Name)}-${compType.startsWith('mens') ? 'mens' : 'womens'}` in `GraphicsControl.jsx:443-447` and `UrlGeneratorPage.jsx:457-462`, which assumes the men's/women's split of the teams database.

**Key files:**
- `overlays/sponsors-cycle.html` (513) — full-screen cycler; canvas two-pass logo trim (alpha, then near-white), crop/scale/offset overrides, `lockedIndex`/`showBounds`/`showGuides` editing aids
- `overlays/sponsors-thanks.html` (392) — card-style grid up to 8 logos, luminance-based auto background (skipped when `data-meet-theme` set), header logo overridden by `data-meet-logo`
- `overlays/sponsors-bug.html` (185) — transparent corner bug, 10s hardcoded rotation, broken-logo skip/hide
- `show-controller/src/hooks/useTeamsDatabase.js` (925) — `saveSponsor`/`deleteSponsor`/`reorderSponsors`/`getTeamSponsors`/`getTeamSponsorCount`; maps `logoUrl || url`
- `show-controller/src/components/GraphicsControl.jsx` (1182) — on-air trigger; theme→team precedence at lines 410-465
- `show-controller/src/pages/UrlGeneratorPage.jsx` (1666) — sponsor plumbing, cycle settings, adjustment persistence (lines 183-243, 456-527, 1230-1392)
- `show-controller/src/components/SponsorAdjustControls.jsx` (299) — shared crop/scale/offset stepper panel used by URL Generator + Theme Editor
- `show-controller/src/pages/MediaManagerPage.jsx` (1483) — `SponsorsView` (line 815+): team-level add/reorder/delete + inline 1920×1080 preview iframe scaled 0.1667
- `show-controller/src/pages/ThemeEditorPage.jsx` (7905) — "Event Sponsors" editor (line 2424+), sponsors template/CSS-var panels (lines 123-145, 1168-1208)
- `show-controller/src/lib/urlBuilder.js` (973) — `buildSponsorsThanksURL` / `buildSponsorsCycleURL` / `buildSponsorsBugURL` (lines 268-328)
- `server/lib/timesheetEngine.js` (1841) — rundown-triggered sponsor hydration with normalized-key fallback (lines 962-1024)
- `output.html` (13780) — the three iframe renderers at lines 12719-12745; theme texture CSS for `.sponsors-container` at lines 1284/1301

**Firebase paths written:**
- `teamsDatabase/sponsors/{teamKey}/{sponsorKey}` — `{name, url, tier, order, updatedAt, scale?, offsetX?, offsetY?, cropX?, cropY?, cropW?, cropH?}`
- `teamsDatabase/sponsors/{teamKey}/{sponsorKey}/order` and `/updatedAt` — reorder multi-path update
- `themes/{themeId}/sponsors/{index}` — direct client `update()` from URL Generator adjustment controls
- `themes/{themeId}` (whole object incl. `sponsors[]`) — server-side, via the Themes admin route
- `competitions/{compId}/currentGraphic` — payload whose `data.sponsors` is the serialized (max 8) sponsor array

**Firebase paths read:**
- `teamsDatabase/sponsors` — client `onValue` subtree subscription
- `teamsDatabase/sponsors/{teamKey}` — server, plus `{teamKey stripped of &}` fallback
- `themes/{themeId}/sponsors` — GraphicsControl precedence check
- `themes/{themeId}` — UrlGeneratorPage (logo + sponsors + overrides), ThemeEditorPage
- `competitions/{compId}/config` — `team1Name`, `team1Key`, `compType`, `meetTheme`
- `competitions/{compId}/currentGraphic` — output.html renderer

**Socket events:** `emits:` none of its own. `listens:` none. (`stateUpdate` and `connected` in `server/index.js:1536-1541, 4696-4703` carry a legacy `showConfig.sponsors` apparatus→name map from `server/config/show-config.json:326`; no client reads it.)

**HTTP routes:** none owned. Theme-level sponsors are persisted through Themes-owned routes:
- `PUT /api/admin/themes/:themeId` — writes theme incl. `sponsors[]` (`server/index.js:2404-2414`)
- `GET /api/admin/themes` — reads themes incl. `sponsors[]`
- `DELETE /api/admin/themes/:themeId` — removes theme sponsors with the theme

**External services:**
- image2url.com (Cloudflare R2) — all live sponsor logo URLs are hosted there; logos are pasted as URLs, never uploaded by this system
- Google Fonts (Inter) — loaded by all three overlays

**Depends on:**
- Teams database — Firebase `teamsDatabase/sponsors/{teamKey}` + direct import of `resolveSchoolKey()`/`getTeamSponsors()` from `useTeamsDatabase.js` — team-level sponsor storage and school-key resolution
- Themes — Firebase `themes/{themeId}/sponsors` + `PUT /api/admin/themes/:themeId` + `overlays/theme-loader.js` CSS variables (`--sponsors-cycle-*`, `--sponsors-bug-*`, `--sponsors-thanks-*`, lines 549-631) — championship/event-level sponsor list and per-graphic styling
- Graphics rendering — Firebase `competitions/{compId}/currentGraphic` → `output.html` iframe wrappers — on-air delivery; `overlays/graphic-ids.json` marks all three `renderMode: iframe`
- Competition model — `competitions/{compId}/config` — supplies `team1Name`/`team1Key`/`compType`/`meetTheme` that decide which sponsor set is used
- Rundown — direct import (`timesheetEngine._triggerGraphic`) — automated triggering of sponsor graphics from a rundown segment

**Used by:**
- Competition workspace / Producer View — `show-controller/src/components/GraphicsControl.jsx` (Sponsors subcategory buttons under full-bleed)
- Settings → URL Generator — `show-controller/src/pages/UrlGeneratorPage.jsx` (OBS browser-source URLs + tuning)
- Media Manager — `show-controller/src/pages/MediaManagerPage.jsx` (team sponsor CRUD, count badge on team cards)
- Theme Editor — `show-controller/src/pages/ThemeEditorPage.jsx` (Event Sponsors + live cycle preview)
- Graphics Manager — `show-controller/src/pages/GraphicsManagerPage.jsx:99-111` (dummy-sponsor previews)
- Rundown — `server/lib/timesheetEngine.js` (segment-driven trigger); `RundownEditorPage.jsx:3242-3255` embeds theme sponsors into exported rundown HTML preview URLs

**UI surfaces:**
- Media Manager → expanded team card → Sponsors section — `show-controller/src/pages/MediaManagerPage.jsx` (`SponsorsView`, line 815)
- Theme Editor → Event Sponsors panel (8 max, name + logo URL + adjust + preview) — `show-controller/src/pages/ThemeEditorPage.jsx:2424`
- URL Generator → Sponsors sidebar group + "Cycle Settings" + "Sponsor Logo Adjustments" — `show-controller/src/pages/UrlGeneratorPage.jsx:1230`, `1320`
- Shared crop/scale/offset panel with Guides + Bounding Box toggles and per-logo lock — `show-controller/src/components/SponsorAdjustControls.jsx`
- Producer graphics grid → Full-Bleed → Sponsors — `show-controller/src/components/GraphicsControl.jsx:835`
- Rundown Editor → Sponsor Fulfillment report (separate per-segment sponsor model, tier-ranked, text export) — `show-controller/src/pages/RundownEditorPage.jsx:11203`

**Known gaps:**
- `cycleDuration` and `excluded` are written into the URL (`urlBuilder.js:304-306`) but `overlays/sponsors-cycle.html` reads neither; the cycle interval is hardcoded at 3000 ms (line 477) and the bug at 10000 ms (`sponsors-bug.html:129`). The whole URL Generator "Cycle Settings" panel is therefore a no-op on air. There is no `sponsorTiming` key anywhere in the repo.
- `stage/graphics/legacy/sponsors-cycle.json` and `graphicsRegistry.generated.js:1374` declare a `cycleSpeed` param (`default: 5000`) that nothing consumes.
- `show-controller/src/lib/graphicButtons.js:80` builds `sponsors: getGraphicsByCategory('sponsors')`, but zero registry entries have `category: "sponsors"` (all three are `category: "full-bleed"`, `subcategory: "sponsors"`), so that export is always empty for `ControllerPage.jsx`.
- Playout content sequences offer a `sponsor` item type with a `sponsorId` field (`ContentSequenceEditor.jsx:29, 56, 460-470`, `PlayoutRulesEditor.jsx:62`), but `server/lib/playoutEngine.js` contains no sponsor logic — `_advanceContentSequence` writes `graphic: 'sponsor'`, which is not a renderer key in `output.html`, and never hydrates `data.sponsors`. `sponsorId` is read by nothing. Orphaned.
- `server/lib/timesheetEngine.js` only ever reads `teamsDatabase/sponsors/{teamKey}` — it has no `themes/{themeId}/sponsors` fallback, so rundown-triggered sponsor graphics silently ignore championship/theme sponsors that the manual path prefers.
- `tier` (presenting/title/official/supporting) is stored, badged in Media Manager, and ranked in the Rundown fulfillment report, but no broadcast graphic uses it for sizing or ordering (PRD §6 calls it "metadata only").
- SVG logo support (PLAN tasks T19/T20 — bypass the canvas pipeline for SVGs) is **NOT STARTED** per `docs/PRD-Sponsors/PLAN-Sponsor-System-Implementation.md:30-31, 633`.
- All three overlays hard-cap at 8 sponsors and pass logo data as a JSON query param (URL-length constrained); logos must be publicly reachable with CORS or the trim falls back to the untrimmed image.
- Theme-level sponsors are a positional array (`themes/{id}/sponsors/{index}`), so URL-Generator adjustments are index-bound — reordering in Theme Editor detaches crops from logos.
- `server/config/show-config.json:326` still holds a per-apparatus `sponsors` map (floor→DGS, pommelHorse→Flipfest…) broadcast over sockets; no client reads it.

**Evidence of live use:**
- Firebase (read live): `teamsDatabase/sponsors/west-chester-womens`, `.../william-mary-mens`, `.../william-mary-womens`; `themes/behind-the-chalk/sponsors` — 7 event sponsors including Synergy, matching the WCGNIC-via-West-Chester note
- `docs/PRD-Sponsors/BUGS.md` BUG‑S09, BUG‑S16, BUG‑S17 — real competition-config key mismatches (William & Mary) and rundown-path adjustment loss, discovered/fixed 2026‑03‑12 → 2026‑03‑14
- `docs/WCGNIC-2026/screenshots/showcase-sponsors.png`, `final-sponsors.png`, `chalk-texture-v3-sponsors.png`
- `docs/PRD-Theme-System-V2/screenshots/7c6-sponsors-cycle-themed.png`, `7c6-sponsors-bug-themed.png`, `7a11-sponsors-thanks-themed.png`, `deploy-8.7-overlay-sponsors.png`
- `docs/PRD-Theme-System-V2/plan.md:1213` — "sponsors-cycle with behind-the-chalk | ✓ PASS | Sponsor logo (Synergy) rendered"
- Commits `d72aea8` (T12 deploy), `07684bc` (T18 deploy), `f1b5866` (7C.6 verify with WCGNIC data), `bb04a63` ("Fix sponsor graphics not loading from Rundown Editor")

**PRDs / docs:**
- `docs/PRD-Sponsors/PRD-Sponsor-System-2026-02-13.md` — **Status field says "Not Started" and is false.** All 5 stories are built and deployed. §7 lists "Per-event sponsors (vs per-team)" and "Rundown Editor integration" as out of scope; both were later built anyway (theme sponsors via PRD-Meet-Themes Phase 9, rundown via timesheetEngine). The only thing it proposed that was genuinely not built is nothing — everything in T1–T18 shipped; the unbuilt work (T19/T20 SVG) was added after the PRD.
- `docs/PRD-Sponsors/PLAN-Sponsor-System-Implementation.md` — task ledger: T1–T18 COMPLETE, T19–T20 NOT STARTED
- `docs/PRD-Sponsors/BUGS.md` — BUG‑S01…S17, all FIXED; also records the two overlay redesigns (cycle stripped to bare logo on grey; thanks moved to card style + dynamic background)
- `docs/PRD-Sponsors/PLAN-Sponsor-System-2026-02-13.md` — data model / architecture
- `docs/PRD-Meet-Themes/` — Phase 9 "Event-Level Sponsors" (commits `d973c37`, `0cbe279`) is where `themes/{themeId}/sponsors` came from
- `docs/PRD-Theme-System-V2/plan.md` — Phase 7A.4/7C.1–7C.6 (sponsor CSS variables, rich control panels, sponsors template)
