# Production checklist

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Show production
**Purpose:** A per-competition pre-flight checklist page (`/{compId}/checklist`) where a producer works through 75 pre-show tasks grouped into 4 timeline phases, with 14 technical items auto-verified from live system state and the rest as manual checkboxes with notes, plus a per-team contacts rolodex.
**Status:** **Proven** — Phase 1 only. Wired end to end: `App.jsx:138-142` routes it inside `CompetitionLayout` behind `RequireAuth` + `ErrorBoundary`; `useProductionChecklist.js` reads/writes Firebase directly (no server involvement). Live-use evidence in Firebase: `competitions/cpv7ngyc/checklist` has 41 manual items progressively checked with real timestamps from `2026-03-07T14:39Z` to `16:57Z` and a producer note `"Jake"` on `camera-op-contact`, while `competitions/cpv7ngyc/config` is `eventName: "Army / Greenville / Springfield"`, `compType: mens-tri`, `venue: "Gross Center"`, `meetDate: "March 7, 2026"` — i.e. the checklist was being worked the morning of that meet; the same compId appears in `docs/PRD-Clip-Integration/verification-log-stage-b.html:57` with 52 clips ingested. A second, lighter use at `competitions/fr0ts7fj/checklist` ("Pink Invitational 2026", note "Email sent to Coach Smith on 3/6"). Exceptions: the **team-contacts** sub-part is only **Built** — Firebase has exactly one record repo-wide (`teamsDatabase/contacts/west-chester-womens` = "Test Coach"/`coach@test.edu`, written 2026-03-07T07:24Z, i.e. test data); Phase 2 (templates, Tasks 31-38) and Phase 3 (site evaluations + camera-config integration, Tasks 39-52) are **NOT STARTED** in `PLAN-Production-Checklist-Implementation.md` and no code for them exists.
**Sport coupling:** Gymnastics-bound — item text hard-codes the Virtius workflow (`session-created` "Session created in Virtius", `session-front-page`, `session-live-mode`, `stream-embedded-virtius`, `lineups-added`) and team keys are built as `{school}-mens|womens` from gymnastics comp types (`getTeamCount` maps dual/tri/quad → 2/3/4); the validator engine itself is generic.
**Key files:**
- `show-controller/src/pages/ChecklistPage.jsx` (744 lines) — whole UI in one file: progress bar, 4 phase tabs with ✓/◐/○, collapsible categories, item rows, per-item note editor, contacts sidebar (desktop) / floating button + drawer (mobile)
- `show-controller/src/hooks/useProductionChecklist.js` (403 lines) — 4 Firebase subscriptions + 30s VM poll, builds validator context, computes phases/summary, `toggleItem`/`updateNote`/`updateContact`/`deleteContact`
- `show-controller/src/lib/checklistItems.js` (244 lines) — static item catalog: 4 phases / 14 categories / 75 items (14 auto, 61 manual). Setup (5+ Days Out): Competition Config(7), Session Setup(3), Communications(6), Graphics & Deliverables(5), Internal Scheduling(4). Pre-Production (2-4 Days Out): Camera Ops(6), YouTube/Streaming(7), Talent(7), Rundown(3). Day Of (2 Hours Before): VM/Infrastructure(4), OBS Configuration(8), Camera Ops Day-Of(6), Session Day-Of(2). Day Of (1 Hour Before): Discord/Talent Audio(7). Same list for every competition type
- `show-controller/src/lib/checklistValidators.js` (307 lines) — the 14 auto-verified items: `event-name`, `meet-date`, `venue-configured`, `teams-configured` (name+logo for N teams), `theme-configured` (warning-only), `rosters-loaded`, `headshots-uploaded` (≥80% avg), `vm-assigned`, `vm-online` (polled), `socket-connected`, `obs-connected`, `rundown-created`, `segments-named` (not "New Segment"), `graphics-assigned` (≥80% of segments have `graphic.graphicId`). No scoring-feed/RTN validator exists
- `show-controller/src/components/TeamContactsPanel.jsx` (625 lines) — per-team tabs, contact cards with `tel:`/`mailto:`, add/edit/delete modal; 7 hard-coded roles in `CONTACT_ROLES` (head-coach, assistant-coach, sid, camera-op-primary, camera-op-backup, venue-operations, scoring-operations). All contacts are typed in by hand — nothing imports them
- `show-controller/src/App.jsx` (149 lines) — route `checklist` under `/:compId`, wrapped in `ErrorBoundary`
- `show-controller/src/components/ErrorBoundary.jsx` (75 lines) — fallback UI added for this feature
- `show-controller/src/lib/competitionUtils.js` (162 lines) — `getTeamCount`, `buildTeamKey`, `getGenderFromCompType` used for N-team validators and contact keys
- `show-controller/src/hooks/useCompetitions.js` (823 lines, `checkVmStatus` at line 317) — VM health probe used by `vm-online`
- `show-controller/src/components/CompetitionHeader.jsx` (92 lines, lines 68-76) — Checklist icon link
- `show-controller/src/views/ProducerView.jsx` (1663 lines, lines 584-590) — Checklist nav link
- `show-controller/src/pages/HomePage.jsx` (1826 lines, lines 1084-1090) — Checklist link on competition cards

**Firebase paths written:**
- `competitions/{compId}/checklist/items/{itemId}` — `{ checked, checkedAt }` (manual items only; no `checkedBy`)
- `competitions/{compId}/checklist/notes/{itemId}` — free-text note string
- `competitions/{compId}/checklist/lastUpdated` — ISO timestamp, written on every toggle and note save
- `teamsDatabase/contacts/{teamKey}/{roleId}` — `{ name, role, phone, email, notes, updatedAt }`; delete writes `null`

**Firebase paths read:**
- `competitions/{compId}/checklist` — whole node, `onValue`
- `competitions/{compId}/teamData` — `team{N}.roster[]` length and `roster[].headshotUrl` for `rosters-loaded` / `headshots-uploaded`
- `competitions/{compId}/rundown/segments` — `Object.values()` for the 3 rundown validators (explicitly NOT `production/rundown/segments`, per AUDIT B-01)
- `teamsDatabase/contacts/{teamKey}` — one subscription per team in the competition
- `competitions/{compId}/config` — indirectly via `CompetitionContext.competitionConfig` (`eventName`, `meetDate`, `venue`, `team{N}Name/Logo`, `meetTheme`, `vmAddress`, `compType`, `gender`)

**Socket events:** `emits:` none / `listens:` none — it only consumes the booleans `connected` (ShowContext socket to coordinator/VM) and `obsConnected` (OBSContext, derived from `obs:stateUpdated`) as validator inputs.
**HTTP routes:** none served. Consumed via `checkVmStatus()` on a 30s poll:
- `GET https://api.commentarygraphic.com/api/vm/{compId}/status` — VM health in HTTPS context
- `GET http://{vmAddress}/api/status` — VM health in local dev

**External services:** none (Firebase RTDB via the client SDK only; `tel:`/`mailto:` handoff to the OS from contact cards).
**Depends on:**
- Competition model — direct import `useCompetition()` — supplies config for 7 of the 14 auto validators, team count/gender, and team keys
- Rundown — Firebase `competitions/{compId}/rundown/segments` — 3 rundown validators
- VM pool — HTTP `GET /api/vm/{compId}/status` (via `checkVmStatus`) + `config.vmAddress` — `vm-assigned` / `vm-online`, and `/_admin/vm-pool` fix links
- Coordinator server — socket connection state from ShowContext — `socket-connected` validator
- OBS integration — `useOBS().obsConnected` — `obs-connected` validator, `/{compId}/obs-manager` fix link
- Teams database — Firebase `teamsDatabase/contacts/{teamKey}` — contacts storage, shared across competitions for the same team
- Themes — `config.meetTheme` — `theme-configured` validator (warning, never error)
- Auth — `RequireAuth` wrapper in `App.jsx` — page requires login

**Used by:**
- Producer View — direct link `/{compId}/checklist` (`ProducerView.jsx:584-590`) — navigation only; it does not read completion state
- Home page — direct link on each competition card (`HomePage.jsx:1084-1090`) — navigation only
- Competition workspace — Checklist icon in `CompetitionHeader.jsx:68-76` — navigation only
- Nothing else: a repo-wide grep for `checklist` outside `show-controller/src` and `docs/PRD-Production-Checklist/` returns no matches in `server/`, `overlays/`, `stage/`, or `scripts/` — no alerts, no go-live gate, no readiness badge consumes `competitions/{compId}/checklist`

**UI surfaces:**
- Production Checklist page (`/{compId}/checklist`) — `show-controller/src/pages/ChecklistPage.jsx`
- Progress bar / phase tabs / collapsible categories / item rows / note editor — all inline in `ChecklistPage.jsx` (Tasks 5-7 merged into Task 3)
- Team Contacts sticky sidebar (desktop, auto-collapses on Day-Of phases) and slide-out drawer + floating button (mobile) — `show-controller/src/components/TeamContactsPanel.jsx`
- Contact add/edit/delete modal — `ContactEditModal` inside `TeamContactsPanel.jsx`

**Known gaps:**
- Phase 2 (checklist templates per comp type, `checklistTemplates/{template-id}`, Tasks 31-38) and Phase 3A/3B (venue database `teamsDatabase/venues/{venue-key}`, camera positions with photos, known-issues list, venue→camera-config prefill, "auto-validate site eval items", "Show venue info in checklist", Tasks 39-52) are all NOT STARTED — `docs/PRD-Production-Checklist/PLAN-Production-Checklist-Implementation.md` phase table
- Item list is a static JS constant; all 75 items show for every competition type, and there is no way to add/remove/edit items per competition (deferred to Phase 2)
- No server-side component at all — no API, no socket event, no alert fires on incomplete items; completion is write-only data nobody reads
- 100% is effectively unreachable pre-show: `socket-connected`, `obs-connected` and `vm-online` return `error` until someone is actually running the show, and those count against `summary.percentage` (documented as expected in the PRD, but it makes the headline number misleading)
- Latent bug in `toggleItem` (`useProductionChecklist.js:295-336`): `previousState` is assigned *inside* the `setLocalChecklistState(prev => …)` updater, which React only invokes eagerly when no update is pending — on rapid toggles it stays `undefined`, so the Firebase write becomes `checked: !undefined === true` regardless of prior state. This is the AUDIT B-03 "fix"
- `theme-configured` has `fixLink: '/themes'` but `App.jsx` has no `/themes` route (only `/theme-editor`); harmless today only because the Fix link renders solely on `status === 'error'` and that validator returns `warning`/`complete`
- Venue-scoped contacts (`venue-operations`, `scoring-operations`) are stored under a *team* key, so the same team at home vs away yields the wrong facility contact — AUDIT B-08, acknowledged, deferred to Phase 3
- No bulk reset, no per-user `checkedBy` attribution, no multi-competition/doubleheader view; checklist is not copied when a competition is duplicated (starts blank) — AUDIT B-09/B-11
- Phase labels ("2 Hours Before") are organizational strings only; no countdown or timezone math against `meetDate` — AUDIT B-10
- Contacts are 100% manual entry — no import from `config.team{N}Coaches` (which already holds coach names in Firebase), from the Commentary Talent CRM, or from camera configs; only one contact record exists repo-wide and it is test data
- Zero automated tests: no `*.test.*` files anywhere under `show-controller/`; verification was screenshot/loop-based, and no checklist screenshots were committed under `docs/PRD-Production-Checklist/`
- `ChecklistPage` renders its own `<header>` while `CompetitionLayout` already renders `CompetitionHeader` above the `Outlet`, so the page shows two stacked headers

**Evidence of live use:**
- Firebase `competitions/cpv7ngyc/checklist` — 41 items with `checkedAt` between `2026-03-07T14:39:44Z` and `2026-03-07T16:57:04Z`, progressing from Setup items to Day-Of OBS/Discord items; note `"Jake"` on `camera-op-contact` (matches `Jake Bonnay` in `config.team1Coaches`)
- Firebase `competitions/cpv7ngyc/config` — `Army / Greenville / Springfield`, `mens-tri`, `Gross Center`, `March 7, 2026`, `sessionKey: sJ3UJjy6mj` — the checklist timestamps land on the meet's own date
- `docs/PRD-Clip-Integration/verification-log-stage-b.html:57` — `GET /api/competitions/cpv7ngyc/clips` returned 52 clips for `sessionKey sJ3UJjy6mj`, corroborating that this competition was really produced
- Firebase `competitions/fr0ts7fj/checklist` + `/config` — "Pink Invitational 2026" (West Chester/Rutgers/Penn/Yale, `meetTheme: pink-meet-2026`), 2 items checked plus note "Email sent to Coach Smith on 3/6"
- Firebase `teamsDatabase/contacts/west-chester-womens` — single "Test Coach" record (2026-03-07T07:24Z): contacts feature exercised in test, not in production
- Git: 15 commits `PRD-Production-Checklist: Task 1…30`, all 2026-03-06/07, on `main` (e.g. `cef8b9f6` 2026-03-07 01:49)

**PRDs / docs:**
- `docs/PRD-Production-Checklist/PRD-Production-Checklist-2026-01-24.md` — v1.2, 6 user stories, phase overview, auto-validator list
- `docs/PRD-Production-Checklist/PLAN-Production-Checklist-Implementation.md` — 52-task table; Phases 1A-1D COMPLETE, Phases 2/3A/3B NOT STARTED
- `docs/PRD-Production-Checklist/PLAN-Production-Checklist-2026-01-24.md` — technical/data-model plan
- `docs/PRD-Production-Checklist/checklist-items-definition.md` — canonical 75-item definition with IDs, types, validators, fix links
- `docs/PRD-Production-Checklist/AUDIT-Production-Checklist.md` — two audits, 41 findings incl. B-01 rundown-path bug, B-03 race condition, B-08 venue-contact limitation
- `docs/PRD-Production-Checklist/2026 Master_ Streaming Check List - Women - WCU - 12_5 - 7pm EST (4).csv` — the original 130+ item producer spreadsheet the 75 items were curated from
- `docs/PRD-Production-Checklist/prompt-Production-Checklist.md`, `run-Production-Checklist.sh` — the autonomous loop that built it
