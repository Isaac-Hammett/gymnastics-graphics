# Teams database

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Competition data

**Purpose:** A single shared library of every school the production covers — logo, roster of athlete names, per-athlete headshot (plus extra media images), team sponsor logos, and name aliases — so a producer sets a team up once in Media Manager and every graphic, overlay and rundown afterwards resolves the right logo and face automatically from a team name typed anywhere in the app.

**Status:** Proven — Firebase holds 73 team records, 1,796 headshot nodes, 120 aliases and 3 sponsor sets with `updatedAt` spanning 2026-01-09 → 2026-03-21, all populated for real meets. `docs/PRD-7-Team-Audit/implementation-plan.md` (Task 6.3) is a live-incident fix on the production competition `commentarygraphic.com/sewj4d2b`: `getTeamLogoUrl()` in `output.html` was flipped to prefer curated `teamsDatabase` logos over the Virtius API logo because RIC rendered an American flag, and `teamsDatabase/teams/ric-womens` was hand-filled to match. `docs/PRD-Sponsors/BUGS.md` BUG-S09/BUG-S16 and `docs/PRD-RTN-Stats-Integration/BUGS.md` BUG-022 are live write-ups of the `william-&-mary-*` vs `william-mary-*` key split in `teamsDatabase/sponsors` and `teamsDatabase/teams/{key}/rtnId`. Exceptions: `teamsDatabase/media` is **Partial** — the code path is complete but production Firebase contains exactly one entry (`teamsDatabase/media/"jasper smith gordon"`); the `league` field is **Partial** — read by `server/lib/rtnStatsService.js` and `server/index.js` but written by no code and absent from every team record sampled; and `migrateFromStatic`, `runDiagnostics`, `updateTeamLogo`, `updateTeamRoster`, `getAllSchools`, `getTeamsBySchool` are **Orphaned** (no importer anywhere in `show-controller/src`), as are `getTeamFlexible`/`hasTeamRoster`/`getTeamRosterStatsFlexible`, whose only consumer `show-controller/src/pages/DashboardPage.jsx` is not routed in `App.jsx`.

**Sport coupling:** Gymnastics-bound — the only bulk ingest path, `parseVirtiusRosterHtml()` in `show-controller/src/hooks/useCompetitions.js:75-103`, hard-codes `src="https://media.virti.us/upload/images/athlete/…"` and the Road to Nationals athlete-ID input, and team records carry `rtnId` + `league` (`ncaa`|`gymact`) keyed to RTN endpoints; the store shape itself (team → roster → headshot) is otherwise generic.

**Key files:**
- `show-controller/src/hooks/useTeamsDatabase.js` (925 lines) — the hook: 5 `onValue` subscriptions + all team/headshot/sponsor/media CRUD and lookup helpers
- `show-controller/src/lib/nameNormalization.js` (216 lines) — `normalizeName`, `getSafeFirebaseKey`, `getLookupKeys`, `removeSuffixes`, `normalizeAccents`
- `show-controller/src/pages/MediaManagerPage.jsx` (1483 lines) — the only admin UI: teams list, roster+media, sponsors, Virtius import, add team/headshot, RTN Team Info panel
- `show-controller/src/hooks/useCompetitions.js` (823 lines) — `parseVirtiusRosterHtml`, `getFirebaseHeadshots`/`lookupHeadshot`, rtnId write-back, config logo sync
- `show-controller/src/lib/competitionUtils.js` (162 lines) — `buildTeamKey(school, gender)` → `{school}-{mens|womens}`
- `output.html` (13780 lines) — browser-side `loadFirebaseHeadshots()`, `loadFirebaseTeamLogos()`, `getTeamLogoUrl()`, `getAthleteHeadshot()`
- `overlays/team-bug.html` (2544 lines) — second browser-side headshot index (duplicate of output.html's)
- `stage/blocks/athlete-grid.js` (250 lines) — third headshot index; reads `teams/{teamKey}/roster` directly for the roster graphic
- `server/lib/timesheetEngine.js` (1841 lines) — server sponsors read-through with `&`-strip fallback (lines 972-985)
- `server/lib/playoutEngine.js` (1913 lines) — reads `aliases` to build the clip team-logo map (line 404)
- `server/lib/scoringIngestionService.js` (1229 lines) — `_getTeamLogo()` reads `teams/{key}/logo` with in-process cache (line 282)
- `show-controller/scripts/import-springfield.js` (130 lines) — one-off Node bulk import; carries its own copied normalizer

**Firebase paths written:**
- `teamsDatabase/teams/{teamKey}` — `set` by `saveTeam`; `update` by `updateTeamLogo`, `updateTeamRoster`, `importRoster` (`{displayName, school, gender, logo, roster[], updatedAt}`)
- `teamsDatabase/teams/{teamKey}/rtnId` — `set` by `enrichTeamsWithRTN` in `useCompetitions.js:244`
- `teamsDatabase/headshots/{normalized name with spaces}` — `set`/batch `update` by `saveHeadshot`, `saveHeadshots`, `importRoster`, and the `show-controller/scripts/*.js` one-offs (`{name, url, teamKey, rtnId?, updatedAt}`)
- `teamsDatabase/headshots/{normalized_name_with_underscores}/rtnId` — `set` by `enrichTeamsWithRTN` (`useCompetitions.js:258`) — **different key convention from every other writer**
- `teamsDatabase/media/{normalized name with spaces}` — `set` (whole array) by `saveAthleteMedia`/`deleteAthleteMedia`
- `teamsDatabase/sponsors/{teamKey}/{slug}` — `set` by `saveSponsor`, `null`-set by `deleteSponsor`; `.../order` + `.../updatedAt` batch-updated by `reorderSponsors`
- `teamsDatabase/aliases` — whole node `set` only inside `migrateFromStatic` (never called); aliases are in practice written by hand/MCP
- Same subtree, other systems: `teamsDatabase/stats/{teamKey}/**` (RTN stats — `server/lib/rtnStatsService.js`, `server/index.js:7695`); `teamsDatabase/contacts/{teamKey}/{contactId}` (Production checklist — `show-controller/src/hooks/useProductionChecklist.js:357`)

**Firebase paths read:**
- `teamsDatabase/teams`, `/headshots`, `/aliases`, `/sponsors`, `/media` — 5 live `onValue` subscriptions in `useTeamsDatabase`
- `teamsDatabase/headshots` — `get` in `useCompetitions.getFirebaseHeadshots`; `.on('value')` in `output.html:7696` and `overlays/team-bug.html:671`; `.once('value')` in `stage/blocks/athlete-grid.js:43`
- `teamsDatabase/teams` — `.on('value')` in `output.html:7810`; `.once('value')` in `server/lib/aiSuggestionService.js:1642`
- `teamsDatabase/teams/{teamKey}/roster` — `stage/blocks/athlete-grid.js:42`
- `teamsDatabase/teams/{teamKey}/logo` — `useCompetitions.refreshTeamData:610`; `server/lib/scoringIngestionService.js:282`
- `teamsDatabase/teams/{teamKey}/rtnId` and `/league` — `server/index.js:7683-7684`, `server/lib/rtnStatsService.js:911-912,1124-1125`
- `teamsDatabase/aliases` — `server/lib/playoutEngine.js:404`
- `teamsDatabase/sponsors/{teamKey}` (+ `&`-stripped fallback key) — `server/lib/timesheetEngine.js:972,980`
- `teamsDatabase/honors`, `teamsDatabase/milestones` — `server/lib/aiSuggestionService.js:1264,1346`; **neither path exists in Firebase** (subtree children are only `aliases, contacts, headshots, media, sponsors, stats, teams`)

**Socket events:** `emits:` none · `listens:` none — the whole system is direct Firebase RTDB access from browser and server. (Indirectly, the server's `ingestRtnStats` / `refreshRtnStats` socket handlers in `server/index.js:7562,7610` read `teams/{key}/rtnId` + `/league`.)

**HTTP routes:** none — no route in `server/index.js` or `server/routes/obs.js` touches `teamsDatabase`.

**External services:**
- Virtius (`media.virti.us`) — canonical logo and athlete headshot image URLs stored verbatim; also the source HTML pasted into the roster importer
- Road to Nationals (`roadtonationals.com/api`) — supplies `rtnId` for teams and athletes and the coaching-staff/rankings/roster panel in Media Manager (via `useRoadToNationals`)
- `image2url.com` — observed host for producer-uploaded sponsor logos and athlete media images (`teamsDatabase/sponsors/william-mary-womens`, `teamsDatabase/media`)

**Depends on:**
- Competition model — direct import (`buildTeamKey` from `competitionUtils.js`) + Firebase `competitions/{compId}/config.team{N}Key|Name|Logo` — to decide which team record a graphic should resolve to
- Auth — direct import (`RequireAuth` wrapper on `/media-manager` in `App.jsx:90`) — Media Manager is login-gated
- RTN stats — Firebase `teamsDatabase/teams/{key}/rtnId` + `league` — this system stores the join key; stats themselves live in the same subtree but belong to RTN stats

**Used by:**
- Graphics rendering — Firebase read direct from the browser (`output.html`, `overlays/team-bug.html`, `stage/blocks/athlete-grid.js`) — team logos, athlete headshots, roster grid
- Sponsors — direct import (`getTeamSponsors`, `saveSponsor`, `resolveSchoolKey`) in `GraphicsControl.jsx:146,443` and `UrlGeneratorPage.jsx:170,1374` — per-team sponsor logos and crop/scale adjustments
- Rundown — Firebase `teamsDatabase/sponsors/{teamKey}` in `server/lib/timesheetEngine.js` — sponsor graphics triggered from a rundown segment
- Who to Watch — direct import (`getAthleteMedia`, `getTeamRosterWithHeadshots`) in `components/playout/WhoToWatchEditor.jsx:650` — athlete picker and cutout gallery
- Clip playout — Firebase `teamsDatabase/aliases` in `server/lib/playoutEngine.js` — maps clip team names to config logos
- Scoring feed — Firebase `teamsDatabase/teams/{key}/logo` in `server/lib/scoringIngestionService.js` — curated logo overrides the Virtius payload logo
- Competition model — `useCompetitions.enrichTeamsWithRTN`/`refreshTeamData` — merges headshots into `competitions/{compId}/teamData` and syncs logos into `config.team{N}Logo`
- Home page (surface) — `getTeamLogo` in `HomePage.jsx:53,258-282` auto-fills team logos on the competition form
- Producer View / Competition workspace (surfaces) — `GraphicsControl.jsx`, `RundownEditorPage.jsx:502`

**UI surfaces:**
- Media Manager page `/media-manager` — `show-controller/src/pages/MediaManagerPage.jsx` (teams list with logo/roster/headshot%/RTN/sponsor badges, expandable roster, per-athlete media gallery, sponsors CRUD + live crop/scale preview iframe, Virtius HTML import, Add New Team, Add Single Athlete Headshot, RTN Team Info lookup)
- Home page competition form — `show-controller/src/pages/HomePage.jsx` (logo auto-fill)
- URL Generator sponsor panel — `show-controller/src/pages/UrlGeneratorPage.jsx`
- Producer graphics control sponsor resolution — `show-controller/src/components/GraphicsControl.jsx`
- Rundown editor athlete/roster + gallery pickers — `show-controller/src/pages/RundownEditorPage.jsx`, `show-controller/src/components/playout/WhoToWatchEditor.jsx`
- Orphaned surface — `show-controller/src/pages/DashboardPage.jsx` (uses the flexible team lookups but is not routed in `App.jsx`)

**Known gaps:**
- **Two incompatible headshot key conventions in the same node.** `getSafeFirebaseKey` only replaces `.#$[]/` and *keeps spaces*, so every headshot writer produces `"ben aguilar"`. But `enrichTeamsWithRTN` (`useCompetitions.js:256`) builds its key as `normalizeName(fullName).replace(/\s+/g, '_')` → `"ben_aguilar"`. Firebase now holds 1,796 headshot children for ~900 athletes: `teamsDatabase/headshots/"ben aguilar"` = `{name,url,teamKey,updatedAt}` and `teamsDatabase/headshots/ben_aguilar` = `{rtnId:"…"}` only. `CLAUDE.md:1058-1065` explicitly documents underscores as WRONG.
- **Consequence:** `getTeamRosterWithHeadshots` reads `headshots[safeKey]?.rtnId` off the *space* key, so the "RTN" badge in Media Manager is dead for every athlete whose rtnId was written by competition enrichment rather than by `importRoster`.
- **`removeSuffixes` over-strips.** `/,?\s*(jr\.?|junior|sr\.?|senior|[iv]+|[1-5](?:st|nd|rd|th))$/i` allows zero-width whitespace, so `[iv]+$` eats trailing letters of ordinary surnames. Visible in live data: `abril_toscanin` (Toscanini), `max_berezne` (Bereznev), `sergey_popo` (Popov), `molly_pompe` (Pompeii), `cali_czarcinsk`, `brooke_ferrar`, `sasha_shybito`, `nicholas_kosariko`.
- **A third, undocumented key format exists**: hyphen-joined `first-last` (`teamsDatabase/headshots/"abigail-berens"`, `"amy-fridley"`, `"ella-montgomery"`), written out-of-band with round-midnight `updatedAt`. The renderers find these because they build a *reverse* index that re-normalizes the stored key; the SPA hook's `getHeadshot` does forward-key lookup only and misses them entirely.
- **Team keys with `&`.** `teamsDatabase/teams` contains `william-&-mary-mens`, `william-&-mary-womens`, `william-and-mary-mens`, `william-mary-mens`, `william-mary-womens` — five records for two teams. Documented in `docs/PRD-RTN-Stats-Integration/BUGS.md` BUG-022 (**still OPEN**) and `docs/PRD-Sponsors/BUGS.md` BUG-S16 (patched only with a server-side `&`-strip fallback in `timesheetEngine.js`).
- **Other duplicate-team keys, no cleanup path:** `cal-mens`/`california-mens`, `ric-womens`/`rhode-island-college-womens`, `twu-womens`/`texas-womans-womens`, `alaska-womens`/`alaska-anchorage-womens`, `southern-connecticut-womens`/`southern-connecticut-state-womens`, `springfield-*` vs `simpson-*` pairs. The hook exposes no `deleteTeam` and no alias CRUD, so nothing in the UI can remove or merge these.
- **Stub team records.** `enrichTeamsWithRTN` `set`s `teams/{key}/rtnId` unconditionally, creating records with no `displayName`/`school`/`gender`/`logo` (confirmed: `teamsDatabase/teams/twu-womens` = `{rtnId:"63"}`). `runDiagnostics` would flag these but is never invoked from any UI.
- **`league` is read-only in code.** `teamsDatabase/teams/{key}/league` (`ncaa`|`gymact`, chooses RTN `results` vs `resultsga` endpoint, `rtnStatsService.js:92`) has no writer anywhere and is absent from every team record sampled — it always falls back to `'ncaa'`.
- **`getTeamLogo` has no space→dash fallback.** It normalizes the input (hyphens → spaces), strips gender, then tries `aliases[…]` and `{name}-{gender}`. Multi-word schools without an alias entry ("george washington-mens") never resolve — the 120-entry alias table is load-bearing. `resolveSchoolKey` *does* have the dashed fallback (`useTeamsDatabase.js:504-516`); the two are inconsistent.
- **Four independent copies of the normalizer** must be kept in sync by hand: `nameNormalization.js`, `output.html:7660-7692`, `overlays/team-bug.html:655-664`, `stage/blocks/athlete-grid.js:203-235`, plus a fifth in `show-controller/scripts/*.js` that omits `removeSuffixes` entirely.
- **DATA-ARCHITECTURE.md is stale**: it names `show-controller/src/lib/teamsDatabase.js` as the static fallback ("18 teams, ~230 headshots") — that file does not exist; the only remaining static fallback is the `ATHLETE_HEADSHOTS` literal at `output.html:8133`.
- `saveSponsor` writes `url` but `getTeamSponsors` reads `data.logoUrl || data.url` (and `timesheetEngine.js:993` does the same) — a legacy field name still tolerated on read (commit `40fa56f9`).
- `teamsDatabase/media` is essentially unused in production (one entry); `deleteAthleteMedia` re-indexes by array position with no confirmation.
- `aiSuggestionService` reads `teamsDatabase/honors` and `teamsDatabase/milestones`, neither of which exists in the database.

**Evidence of live use:**
- `docs/PRD-7-Team-Audit/implementation-plan.md` (Task 6.3, line ~265-278) — production BUG-016 fix on `commentarygraphic.com/sewj4d2b`: Firebase logo priority reversed in `output.html` and `teamsDatabase/teams/ric-womens` hand-filled; Task 6.5 records the deploy and verification
- `docs/PRD-Sponsors/BUGS.md` (BUG-S16, 2026-03-14) — rundown-triggered sponsor graphic rendered "No sponsors configured" live because `config.team1Key` was `william-&-mary-mens` while sponsors sat at `teamsDatabase/sponsors/william-mary-mens`
- `docs/PRD-RTN-Stats-Integration/BUGS.md` (BUG-022, 2026-03-11) — "Stats error" badge in production traced to `teamsDatabase/teams/william-&-mary-womens` holding the `rtnId`
- `CLAUDE.md` lines 1155-1160 — WCGNIC 2026 Session 1 composite team assembly requires `teamsDatabase/teams/{centenary,greenville,wilberforce}-womens` to carry valid `rtnId`; those records exist with rosters and `rtnId` (e.g. `centenary-womens` rtnId 16, 18-athlete roster)
- Live Firebase contents: 73 team records, 120 aliases, ~900 real athlete headshots pointing at `media.virti.us`, `updatedAt` 2026-01-09 → 2026-03-21
- `AUDIT-RESULTS.md` — a prior Media Manager audit whose BUG #1/#3/#4 (team-key normalization corrupting `teamsDatabase/teams/army mens`) are fixed in current code; the "do NOT normalize team keys" comments at `useTeamsDatabase.js:111-113,121,233` are the scar tissue

**PRDs / docs:**
- `DATA-ARCHITECTURE.md` — sections 2 (schema), 3 (logo retrieval), 4 (headshot retrieval + multi-key lookup), 7 (Virtius import), 8-11 (file map, source hierarchy, Firebase paths); partly stale
- `CLAUDE.md` lines 1026-1100 — the authoritative "Adding a New Team" checklist and the spaces-not-underscores key rule
- `AUDIT-RESULTS.md` — historical Media Manager key-normalization audit
- `docs/PRD-Sponsors/PRD-Sponsor-System-2026-02-13.md` + `PLAN-Sponsor-System-Implementation.md` + `BUGS.md` — the `teamsDatabase/sponsors` subtree
- `docs/PRD-Who-To-Watch/PRD-Who-To-Watch.md` lines 144, 358, 372 — `teamsDatabase/media/{safeKey}` schema
- `docs/PRD-RTN-Stats-Integration/BUGS.md` + `PRD-RTN-Stats-Integration-2026-02-01.md` — `rtnId`/`league` on team records, `teamsDatabase/stats` (RTN stats' subtree)
- `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md` + `implementation-plan.md`
- `docs/INFRASTRUCTURE.md` lines 91-95 — abbreviated subtree map
