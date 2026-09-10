# Competition model

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Competition data
**Purpose:** Gives a producer one record per meet — teams, gender, apparatus set, rotation count, venue/date, theme, Virtius session, Clip Engine URL, VM assignment — created by hand or auto-filled from a Virtius session ID, then enriched from Road to Nationals. Everything else in the app (graphics, rundown, cameras, commentary, scoring) hangs off `competitions/{compId}` and reads this config.

**Status:** **Proven** — `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md` audits a real production competition (`sewj4d2b`, `womens-7`) live on `commentarygraphic.com`, catalogs 17 bugs found in that meet's producer/output and marks them fixed; `CLAUDE.md:1113-1160` documents composite-team config actually used for WCGNIC 2026 Session 1 (`team4Key: wcgnic-womens`, 8 individual qualifiers); `git log` has "Deploy + Verify … with WCGNIC Data" commits and `docs/PRD-Graphics-Audit-ECAC/` screenshot runs. Sub-parts at other levels: **Orphaned** — `pages/DashboardPage.jsx`, `pages/HubPage.jsx`, `pages/CompetitionSelector.jsx` are imported by nothing (`grep` over `show-controller/src` returns only self-references) and `/dashboard`, `/hub`, `/select` all `Navigate to="/"` in `src/App.jsx:83-85`; `hooks/useRotationSchedule.js` + `lib/rotationSchedule.js` have zero importers outside themselves (output.html carries a duplicate `ROTATION_SCHEDULES` at line 8372); `useCompetitions.updateVmAddress` and `addTeamHeadshots` are exported with no callers. **Partial** — `ControllerPage.jsx` ("Meet Setup") is routed at `/:compId/graphics` but reads `useSearchParams().get('comp')` (line 16), so at that route `compId` is null and it renders "No competition ID specified"; no UI anywhere links to `/:compId/graphics` (only the orphaned HubPage/DashboardPage link `/controller?comp=…`).

**Sport coupling:** **Gymnastics-bound** — `src/lib/eventConfig.js` hard-codes the two apparatus sets and Olympic order plus a Virtius `apiName` per event (`FLOOR/HORSE/RINGS/VAULT/PBARS/BAR/BARS/BEAM`), `compType` is a fixed `mens|womens` × team-count enum, and `lib/rotationSchedule.js` + `output.html` encode NCAA rotation templates and the "5+ teams → read the Virtius `rotation` field" rule.

**Key files:**
- `show-controller/src/pages/HomePage.jsx` (1826) — current home; competition list/search/grouping, create/edit modal, Virtius fetch, theme select, Clip URL, VM assign/release, duplicate/delete
- `show-controller/src/hooks/useCompetitions.js` (823) — CRUD + RTN enrichment + coach/logo sync + lock-aware writes; also `useCompetition(compId)`
- `show-controller/src/lib/eventConfig.js` (479) — EVENTS, EVENT_ORDER, SHORT_NAME_TO_ID, API_NAME_TO_ID, score helpers
- `show-controller/src/lib/competitionUtils.js` (162) — `getGenderFromCompType`, `getTeamCount` (2–10), `buildTeamKey`
- `show-controller/src/lib/graphicButtons.js` (259) — `competitionTypes` (14 entries), `teamCounts`, `typeLabels`
- `show-controller/src/lib/rotationSchedule.js` (603) — ROTATION_TEMPLATES (dual head-to-head/alternating, tri, quad, both genders) + generator — **orphaned**
- `show-controller/src/hooks/useEventConfig.js` (133) — events + `rotationCount: max(eventCount, teamCount)` (the womens-7 fix)
- `show-controller/src/hooks/useApparatus.js` (169) / `useRotationSchedule.js` (269) — apparatus by gender / schedule queries (latter unused)
- `show-controller/src/context/CompetitionContext.jsx` (200) — compId → config → gender/vmAddress/socketUrl, `local` mode, error types
- `show-controller/src/components/CompetitionLayout.jsx` (104) + `CompetitionHeader.jsx` (92) + `CompetitionError.jsx` (166) — workspace shell, MAG/WAG badge, NOT_FOUND/NO_VM_ADDRESS/VM_UNREACHABLE screens
- `show-controller/src/pages/ControllerPage.jsx` (521) — "Meet Setup": event info, teams 1–2 stats/coaches, `_locks` toggles
- `server/lib/rtnStatsService.js` (1746) — `syncStatsToConfig` writes `team{N}Ave/High/Con/Nqs` honoring `_locks`; composite-team assembly
- `server/lib/apparatusConfig.js` (132) — server apparatus table with `mensOrder`/`womensOrder`, re-exports `MENS_APPARATUS`/`WOMENS_APPARATUS` from `showConfigSchema.js` (438)

**Firebase paths written:**
- `competitions/{compId}/config` — whole-object `set` on create, `update` on edit (HomePage → useCompetitions)
- `competitions/{compId}/config/_locks/{field}` — ControllerPage lock toggle / auto-lock
- `competitions/{compId}/config/team{N}Ave|High|Con|Nqs` — server `rtnStatsService.syncStatsToConfig`
- `competitions/{compId}/config/team{N}Coaches` — `buildCoachUpdates` in `useCompetitions.js:391`
- `competitions/{compId}/config/team{N}Logo` — `refreshTeamData` logo sync from teamsDatabase
- `competitions/{compId}/config/vmAddress`, `.../vmCredentials` — `server/lib/vmPoolManager.js:391-396,487-488`, `server/lib/vmHealthMonitor.js:271,307`
- `competitions/{compId}/config/talentComms` — `server/lib/talentCommsManager.js`
- `competitions/{compId}/config/scoringFeed` — `server/lib/scoringIngestionService.js`, `hooks/useScoringFeed.js`
- `competitions/{compId}/teamData` — RTN-enriched coaches/rankings/stats/roster/links/schedule
- `competitions/{compId}` — full subtree `remove` on delete
- `teamsDatabase/teams/{teamKey}/rtnId`, `teamsDatabase/headshots/{name}/rtnId` — side-effect of RTN enrichment

**Firebase paths read:**
- `competitions` (whole tree, `onValue`) — the home-page list
- `competitions/{compId}/config` — CompetitionContext, ControllerPage, overlays, ~8 server libs
- `competitions/{compId}/config/_locks` — before coach/stat sync
- `competitions/{compId}/compositeTeams/{teamSlot}` — `server/lib/rtnStatsService.js:1080`, `server/index.js:7645`
- `competitions/{compId}/teamData/{teamKey}/roster`, `competitions/{compId}/commentary`, `competitions/{compId}/currentGraphic`
- `themes` — theme dropdown in the create/edit modal
- `teamsDatabase/headshots`, `teamsDatabase/teams/{teamKey}/logo`, `teamsDatabase/stats/{teamKey}/teamRanking|individualAverages|individualHighs`

**Socket events:** `emits:` ingestRtnStats (fire-and-forget on create/refresh, `useCompetitions.js:440`) / `listens:` rtnStatsResult, connect_error

**HTTP routes:**
- `GET /api/competitions/index` — lightweight {eventName, meetDate, gender} index (60s cache)
- `GET /api/competitions/active` · `POST /api/competitions/deactivate` · `POST /api/competitions/:id/activate` — VM-local active meet
- `POST /api/competitions/:compId/vm/assign` · `POST /api/competitions/:compId/vm/release` · `GET /api/competitions/:compId/vm` — VM binding
- `GET /api/vm/:compId/status` — VM health proxy (avoids mixed content)
- `GET /api/virtius/:sessionId` — server-side Virtius proxy (**unused by HomePage**, which calls Virtius directly)
- `GET /api/competitions/:compId/clips` — resolves `clipApiUrl`/`sessionKey` from config
- No create/update/delete route exists — competition CRUD is direct Firebase client writes

**External services:**
- Virtius (`https://api.virti.us/session/{id}/json`) — meet name, date, location, `sex`, teams with `team_order`/`tricode`; also the live rotation/score feed
- Road to Nationals (`https://www.roadtonationals.com/api`) — coaches, roster, rankings, RQS, schedule per team
- Firebase Realtime Database — system of record for every competition
- AWS EC2 (via coordinator) — VM assignment writes `vmAddress` back into config

**Depends on:**
- Teams database — direct import (`useTeamsDatabase.getTeamLogo`, `resolveSchoolKey`) + Firebase `teamsDatabase/*` — logo autofill, `team{N}Key` resolution, headshot merge
- RTN stats — socket `ingestRtnStats` + Firebase `teamsDatabase/stats/*` → `config.team{N}Ave/High/Con/Nqs` — pre-meet team numbers
- VM pool — HTTP `/api/competitions/:compId/vm/assign|release` — writes `config.vmAddress`
- Coordinator server — HTTP/socket via `SERVER_URL` / `api.commentarygraphic.com` — all non-Firebase calls
- Auth — `RequireAuth` / `useAuth` in `CompetitionLayout` — gates everything except `/:compId/talent`
- Themes — Firebase `themes` + `config.meetTheme` — theme picker in the modal
- Alerts — `useProductionAlerts` — pre-production alert cards on the home page

**Used by:**
- Home page (surface) — direct import — `HomePage.jsx` is the competition list + editor
- Competition workspace (surface) — `CompetitionContext` — supplies compId/gender/socketUrl to every `/:compId/*` view
- Graphics rendering — Firebase `competitions/{compId}/config` + `currentGraphic.data` — team names/logos/stats/coaches on every overlay
- Rundown, Clip playout, Scoring feed, Talent comms, Camera management, Production checklist, Commentary talent CRM, Who to Watch, Sponsors — all Firebase `competitions/{compId}/config/*` — `virtiusSessionId`, `clipApiUrl`, `meetTheme`, `gender`, team fields
- OBS integration — `config.gender` → apparatus list for scene/camera mapping

**UI surfaces:**
- Home / competition list + create-edit modal — `show-controller/src/pages/HomePage.jsx`
- Competition workspace chrome (MAG/WAG badge, venue, connection, Change link) — `components/CompetitionHeader.jsx`, `CompetitionLayout.jsx`, `CompetitionError.jsx`
- "Meet Setup" left rail (event info, teams 1–2, RTN lock icons) — `pages/ControllerPage.jsx`
- Team stats/coaches bulk editor for teams 1–10 — `pages/UrlGeneratorPage.jsx` (writes the same config)
- Superseded: `pages/DashboardPage.jsx`, `pages/HubPage.jsx`, `pages/CompetitionSelector.jsx`

**Known gaps:**
- `views/ImportView.jsx` is **not** Virtius import — it is a run-of-show **CSV** uploader (`POST /api/import-csv`, `GET /api/csv-template`) linked from Home as "Import Shows"; Virtius import lives entirely in the HomePage modal. Its success link goes to `/producer`, which now redirects to `/`.
- `ControllerPage` never persists its Event Info / Team panels — `setFormData` is local and only rides along in `currentGraphic.data`; only `_locks` is written back.
- `ControllerPage.LOCKABLE_FIELDS` covers teams 1–2 only, while `syncStatsToConfig` honors locks for all teams — no lock UI for teams 3–10.
- No UI for meet **format**: `alternating` vs `head-to-head` templates exist in `lib/rotationSchedule.js` but `summaryFormat` is hard-coded per graphic send (`isDual ? 'alternating' : 'rotation'`, `GraphicsControl.jsx:589`); `config.rotationSchedule` is read by `useRotationSchedule` and written by nothing.
- Team-count enum drift: `teamCounts`/`getTeamCount` support womens-8/9/10, but `parseCompetitionType` in `hooks/useRtnStats.js:57` and `server/lib/rtnStatsService.js:692` cap at 7 (falls back to 2), and `competitionTypes` offers no mens-7+.
- `meetDate` is free text ("e.g., January 15, 2025") parsed with `new Date()` for Today/Tomorrow grouping — no date type, no timezone.
- `team{N}Tricode` has no form field; only Virtius import can set it. `vmAddress` has no form field either (server-written only).
- `duplicateCompetition` copies `config` only — teamData, production, rundown, checklist, commentary are lost.
- Default logos are `via.placeholder.com` URLs (dead third-party host) baked into `handleSubmit`.
- `CompetitionError` NO_VM_ADDRESS action links to `/hub?edit={compId}`, which redirects to `/` and drops the query.
- `docs/FUTURE-competition-templates.md` — "Competition Template" as a second axis beside `compType` is not started.
- ROADMAP.md:427 "Lineup Size" (varies per apparatus, drives OBS scene variant) has no config field at all.
- Virtius import has no session-ID validation, no CORS-safe path (calls `api.virti.us` directly from the browser rather than the existing `/api/virtius/:sessionId` proxy), and silently returns one generic error string.

**Evidence of live use:**
- `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md` — real comp `sewj4d2b` on production, Playwright audit table, BUG-010/014/015/017 all describe live behavior
- `docs/PRD-7-Team-Audit/implementation-plan.md` — the `useEventConfig` rotationCount and `teamCounts` fixes
- `CLAUDE.md:1113-1160` — WCGNIC 2026 Session 1 composite team config with named athletes and source teams
- `docs/PRD-Graphics-Audit-ECAC/screenshots`, `docs/WCGNIC-2026/screenshots`
- `git log` — "PRD-Theme-System-V2: Task 7A-7F — Deploy + Verify … with WCGNIC Data" (7 commits)

**PRDs / docs:**
- `DATA-ARCHITECTURE.md` §1-2 (config schema, DB layout — still names the orphaned `DashboardPage.jsx` as the entry point), §6-9 (flow diagram, import mechanisms, source hierarchy)
- `docs/PRD-CompetitionBoundArchitecture-2026-01-13.md` (1158) — the `/:compId/*` refactor, Phase 1 apparatus module, Firebase structure
- `docs/PRD-7-Team-Audit/` (PRD + implementation-plan)
- `docs/FUTURE-competition-templates.md`
- `ROADMAP.md:417-430` — Competition Types / Formats / Lineup Size
- `CLAUDE.md` — Composite Teams section
- `docs/PRD-RTN-Stats-Integration/` — `_locks` + composite Phase 9

**Config schema — `competitions/{compId}/config/*` (key — writer):**
| Key | Writer |
|---|---|
| `compType` (`mens-dual|tri|quad|-5|-6`, `womens-dual|tri|quad|-5..-10`) | HomePage modal select (`competitionTypes`) |
| `gender` (`mens|womens`) | HomePage modal; inferred by `getGenderFromCompType` or Virtius `meet.sex` |
| `eventName`, `meetDate`, `venue`, `location` | HomePage modal; UrlGeneratorPage save |
| `hosts` | seeded `'Host Name'` by HomePage; edited in UrlGeneratorPage |
| `meetTheme` | HomePage modal (options from Firebase `themes`) |
| `virtiusSessionId` | HomePage modal (set by the Virtius fetch) |
| `clipApiUrl` | HomePage modal "Clip Engine" field |
| `sessionKey` | none in-app — legacy Clip Engine key, read-only fallback |
| `team{N}Name` (N=1..10) | HomePage modal / Virtius import |
| `team{N}Logo` | HomePage modal (autofill from teamsDatabase) + `refreshTeamData` logo sync; `via.placeholder.com` default |
| `team{N}Tricode` | Virtius import only |
| `team{N}Key` (`{school}-{gender}`) | derived at save via `resolveSchoolKey`/`buildTeamKey` |
| `team{N}Ave`, `team{N}High`, `team{N}Con` | seeded `'0.000'`/`'0%'`; server `syncStatsToConfig`; manual in ControllerPage (1–2) / UrlGeneratorPage |
| `team{N}Nqs` | server `syncStatsToConfig` (RTN RQS); UrlGeneratorPage |
| `team{N}Coaches` | seeded `'Coach Name'`; `buildCoachUpdates` from RTN staff; manual in ControllerPage (1–2) / UrlGeneratorPage |
| `_locks/{field}` | ControllerPage toggle + auto-lock on manual edit |
| `vmAddress`, `vmCredentials` | `vmPoolManager`, `vmHealthMonitor` (server) |
| `talentComms` | `server/lib/talentCommsManager.js` |
| `scoringFeed` | `server/lib/scoringIngestionService.js`, `useScoringFeed.js` |
| `obsScenes` | read by `playoutEngine.js:360`; no writer found |
| `calendarTitle`, `calendarEvents`, `calendarColumns` | UrlGeneratorPage |
| `rotationSchedule` | read by `useRotationSchedule`; **no writer** |

Gymnastics-specific keys: `compType`, `gender`, `meetTheme` semantics, `virtiusSessionId`, `team{N}Ave/High/Con/Nqs` (RQS/NQS are NCAA gymnastics scoring constructs), `team{N}Coaches`, `team{N}Key` (gender-suffixed), `rotationSchedule`, `compositeTeams`. Sport-neutral: `eventName`, `meetDate`, `venue`, `location`, `hosts`, `team{N}Name/Logo/Tricode`, `vmAddress`, `vmCredentials`, `talentComms`, `clipApiUrl`, `obsScenes`.

**A sport-parameterized refactor would have to touch:** `src/lib/eventConfig.js` (EVENTS/EVENT_ORDER/SHORT_NAME_TO_ID/API_NAME_TO_ID + `calculateTotalScore`), `src/lib/competitionUtils.js` (`getGenderFromCompType`, `getTeamCount` string sniffing), `src/lib/graphicButtons.js` (`competitionTypes`/`teamCounts`/`typeLabels`, `mensApparatus`/`womensApparatus`, `eventFrameIds`, `getApparatusButtons`), `src/lib/rotationSchedule.js` ROTATION_TEMPLATES, `src/hooks/{useApparatus,useEventConfig,useRotationSchedule}.js`, `server/lib/apparatusConfig.js` + `server/lib/showConfigSchema.js` (`MENS_APPARATUS`/`WOMENS_APPARATUS`), `server/lib/rtnStatsService.js` (`parseCompetitionType`, event-code arrays, RQS/NQS semantics, the whole RTN coupling), and the duplicated in-renderer tables in `output.html` (`MENS_EVENTS_ORDER`/`WOMENS_EVENTS_ORDER`/`EVENT_DISPLAY_NAMES`/`EVENT_SHORT_CODES`/`ROTATION_SCHEDULES`/`getScheduleKey`/`detectEventFromApiData`). The `gender` field would have to become a "discipline/division" pointer to a sport definition (apparatus list + order + API name map + rotation policy + score model), and `compType` would split into `{sport, division, teamCount, format}`.

**Virtius import flow:** producer opens Create/Edit on `/` → pastes a session ID (e.g. `EeUcxrjyBD`) → `fetchFromVirtius()` (`HomePage.jsx:233`) does a **direct browser** `GET https://api.virti.us/session/{id}/json` → reads `data.meet`, sorts `meet.teams` by `team_order`, computes `compType` via `inferCompType(meet.sex, teams.length)` (`dual|tri|quad|{n}` suffix) and `gender` from `meet.sex` → fills `eventName`, `meetDate` (reformatted to "Month D, YYYY"), `venue`/`location` (split on the first comma of `meet.location`), and `team{1..10}Name/Tricode` plus `team{N}Logo` from `getTeamLogo(name, gender)` against `teamsDatabase`, and stashes `virtiusSessionId`. Nothing is saved yet. On **Save**, `handleSubmit` derives `team{N}Key` via `resolveSchoolKey`/`buildTeamKey`, seeds `hosts`/`Ave`/`High`/`Con`/`Coaches` placeholders, and calls `createCompetition`/`updateCompetition` → `set|update` on `competitions/{compId}/config` → then `enrichTeamsWithRTN` fetches each team's RTN dashboard, merges Firebase headshots by normalized name, writes `competitions/{compId}/teamData` and back-fills `team{N}Coaches` (skipping `_locks`), persists `rtnId`s into `teamsDatabase`, and fires a throw-away socket `ingestRtnStats` to the coordinator. `virtiusSessionId` is then reused live by `scoringIngestionService`, `playoutEngine`, `aiContextService`, `overlays/team-bug.html`, `overlays/rotation-slate-auto.html` and `output.html`'s event summary, where 5+ team meets read the API's per-event `rotation` field (`detectEventFromApiData`, `output.html:8607`) instead of any stored schedule.
