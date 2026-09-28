# Tool inventory

Generated 2026-09-10 from SYSTEM-OVERVIEW.md, docs/system-map/, and the live Firebase evidence they cite. Companion CSV: docs/tool-inventory.csv, 151 feature rows. Reliability follows the survey, never PRD status lines. Stream types are inferred throughout (lite: graphics and scoring; full: rundown, OBS, talent; championship: full plus themes, sponsors, composites, sessions; open: offline clip show).

## 1. Summary

- 151 feature rows across 19 systems (the CSV also carries Producer View surface rows): proven 45, built 54, partial 32, legacy 3, orphaned 17.
- 35 rows assume gymnastics; eight of 19 systems are bound, all through the competition model's apparatus and format rules.
- Proven core: coordinator, competition model, teams database, RTN stats, legacy graphics with themes and sponsors, the rundown engine, and the checklist. The stage engine, VM pool, and OBS remote are complete but unproven; the rest is partial.
- Gap 1: clip playout never ran LIVE; its last WCGNIC heartbeat was fallback mode about 15 hours before first pixel (playoutEngine.js:155,1030; Firebase wcgnic-2026-prelim1/production/engineHeartbeat).
- Gap 2: the scoring feed writes bare arrays while the stage block waits for a rows envelope never implemented, so the new leaderboards render empty (scoringIngestionService.js:1132; stage/blocks/leaderboard-table.js:146-152).
- Gap 3: the coordinator can sleep but cannot wake; the Netlify wake functions are gone and the fallback route was never written, which blocks the VM Pool page (useCoordinator.js:119; server/index.js:4380-4385).
- Gap 4: Talent View reads the wrong route parameter and its Start button fires a second, legacy show engine that drives OBS in parallel (TalentView.jsx:29,80; server/index.js:7992).
- Gap 5: no server authentication and no database rules in the repo (server/index.js:84-87,1859-1873); the two "AI" services never call a model.
- Production hosts were torn down in August 2026 (SPINUP-2026-08-17.md); reliability describes code and recorded evidence.

## 2. The Firebase wire

Every on-air graphic passes through `competitions/{compId}/currentGraphic`. Four writers set it: the producer panel (GraphicsControl.jsx:476-525), the timesheet engine when a segment fires (timesheetEngine.js:1071-1123), the playout engine (playoutEngine.js:1149), and the Who to Watch sequencer (server/index.js:878). Two readers listen, output.html for everything except `renderer: 'stage'` (output.html:13179) and stage/stage.html for stage graphics (stage.html:638), so exactly one is on screen. For an adapter this is the whole graphics contract: write that node with a registry-valid id and renderer field. The write needs only Firebase access, so today no authentication, and nothing acknowledges an ordinary graphic; the renderer reports back only for video (`production/clipStatus`) and theme failures (`production/themeErrors`).

## 3. Systems

Orphaned and legacy rows are listed once, in section 4.

### Coordinator server

One Node process hosts every server-side tool and fans state out over sockets. Proven: BUG-021, a 2026-03-07 pre-show incident on it (docs/PRD-Rundown-System/BUGS.md).

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Real-time state fan-out | Live state to every screen | socket event | proven |
| Serves the app and renderers as static files | Hosts the app and renderers | HTTP route | proven |
| Coordinator status and keep-alive endpoints | Server up/idle status | HTTP route | built |
| Idle auto-shutdown (sleep) | Stops its own cloud machine when idle | config file | built |
| Standalone mode on each OBS machine | Server copy on each OBS VM | config file | built |
| Deployment and process supervision | Install and supervise both hosts | manual | proven |
| Action bus (scene and graphic actions) | One path for scene and graphic commands with acks and guardrail checks | socket event | built |
| Competition state service (typed event stream) | Ingests Virtius or recorded logs, emits confidence-rated events | socket event | built |
| Guardrails (action enforcement rules) | Four rules refuse risky actions unless forced by a human | config file | built |
| Jev decision service (TypeSafe AI) | Asks a TypeSafe Jev model what the broadcast should do next and returns ranked recommendations (Suggest mode only; never run with a real key) | socket event | built |
| Jev recommendation panel and mode toggle (Producer View widget) | Shows up to 3 recommendations with Take, Dismiss, and an Off/Suggest toggle | UI button | built |

Depends on: Firebase Admin credential, AWS EC2, PM2, Virtius API. Gaps: no server auth; wake path dead; no /health; noCutDuringRoutine rule inert without routine state; Producer View doesn't show guardrail refusals. Workbook: prod-live, gfx-delivery.

### VM pool

Launches, starts, stops, and assigns OBS machines from a saved image. Built: exercised for real on 2026-01-17 (ralph-vmpool/activity.md), never during a broadcast.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Launch an OBS machine from the prebuilt image | New OBS machine from image | HTTP route | built |
| Start and stop pooled machines | Power a saved machine on/off | HTTP route | built |
| Assign a machine to a competition | Links one OBS machine to one competition | HTTP route | built |
| Register an external machine with credentials | Add an outside machine | HTTP route | built |
| Show the VM login to the producer | VM login in the producer screen | UI button | built |
| VM Pool admin page | Admin page for all machines | UI button | partial |

Depends on: Coordinator server, AWS EC2, Competition model. Gaps: health monitor unwired; admin page blocked; plaintext passwords. Workbook: multi-session, cap-health, prod-live.

### Auth

Firebase login in the browser only. Partial: guard verified on production 2026-03-11; server/index.js:1859-1873 has no auth; no rules file.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Email and password login for the producer app | Browser login gate | UI button | built |
| Server API and socket authentication | Nothing checks who calls the server | manual | partial |
| Database access rules | No database rules exist in the repo | manual | partial |
| Public no-login talent pages | No-login public pages | UI button | built |

Depends on: Firebase Authentication. Gaps: 82 routes and all sockets open; rules unversioned. Workbook: prod-settings; server auth and rules are build.

### Alerts

A complete alert service and panel that nothing feeds. Partial: live Firebase has no alerts node.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Production alert service | Create, acknowledge, resolve alerts per competition | HTTP route | partial |
| Alert banner and panel in the producer screen | Banner and panel, never fed | UI button | partial |
| Pre-production staffing alerts on the home page | Warns about unbooked commentary slots | UI button | built |

Depends on: VM pool (dead wire), Commentary talent CRM. Gaps: no producer of alerts; acknowledge socket is a stub. Workbook: cap-health, prod-live, com-roster.

### Rundown

A segment editor and the server engine that runs it, with rule-based suggestions and talking points folded in. Proven: 28 real run records under wcgnic-2026-prelim1/production/rundown/analytics.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Plan a show as timed segments | Editor for the show's segments | UI button | proven |
| Save and reuse show and segment templates | Reusable rundowns and segments | UI button | proven |
| Load the rundown into the show engine | Load the plan into the engine | socket event | proven |
| Run the show (transport controls) | Transport controls for the live show | socket event | proven |
| A cue switches the OBS scene with its transition | Each segment switches the OBS scene | Firebase path | built |
| A cue puts a graphic on air | Each segment can fire a graphic | Firebase path | proven |
| A cue starts clip playout or a Who to Watch package | Segments can hand off to playout | Firebase path | built |
| Producer scene and camera override during a show | Force a scene or camera mid-show | socket event | partial |
| Audio cue plays a song through OBS | Segment can start a song in OBS | Firebase path | partial |
| Per-run timings and override log | Records what actually happened each run | Firebase path | proven |
| Rehearsal mode | Run the plan with outputs muted | socket event | built |
| Editing presence and history with rollback | See collaborators and roll back edits | Firebase path | built |
| Rule-based segment suggestions for planning | Suggests segments from meet data (no model) | socket event | partial |
| Import, export, print, preview | Move rundowns in and out as files | UI button | built |
| Live talking points for commentators (rule-based) | Talking points to the talent screen | socket event | partial |
| Commentator transport controls and script view | Commentator now, next, script | UI button | partial |

Depends on: Coordinator server, OBS integration, Graphics rendering, Themes, Clip playout, Competition model. Gaps: engine override fails; Talent View starts a legacy engine; AI never calls a model. Workbook: show-planner, rundown-obs, prod-program, adapter-rundown, prod-story, com-console.

### OBS integration

A browser remote for the competition's OBS; sockets work, 55 REST routes bind to a local OBS. Partial: verified only against test competition 8kyf0rnl (docs/PRD-OBS-11-AdvancedFeatures/screenshots/).

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Connect to a competition's OBS over the network | Coordinator connects to the right VM's OBS | socket event | built |
| Scene switch, preview, take | Scene switching and studio-mode take | socket event | built |
| Scene and source editing | Scene and source editing from the browser | socket event | built |
| Audio mixer with live meters and presets | Volume, mute, meters, saved presets | socket event | built |
| Transitions and stinger configuration | Pick transitions, tune stingers | socket event | built |
| Stream and record with an encrypted key | Go live and record from the browser | socket event | built |
| Program preview and scene thumbnails | See what OBS is showing | socket event | built |
| Apply a scene template to a fresh OBS | Whole OBS layout from a template | HTTP route | partial |
| Upload and manage media assets for OBS | Upload images, video, and audio for scenes | HTTP route | partial |

Depends on: VM pool, Coordinator server, Talent comms. Gaps: template apply made 0 inputs; assets on the wrong host; no OBS password. Workbook: rundown-obs, cap-record, prod-settings, prod-live.

### Talent comms

Mints a VDO.Ninja room and links for two commentators. Partial: a documented live failure wired the wrong URL into OBS (docs/README-OBS-Architecture.md:347-362).

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Create a talent video room and links | Generates VDO.Ninja links for two commentators | HTTP route | built |
| Talent feeds wired into OBS templates | Template apply wires talent video into OBS | HTTP route | partial |
| Live talent connection status | Shows whether each commentator is connected | UI button | partial |

Depends on: Coordinator server, OBS integration. Gaps: OBS source added by hand; password inside every URL. Workbook: com-console, cap-ingest.

### Camera management

Declares camera feeds, polls health, lets the producer re-point a camera. Partial: untouched since 2026-01-13; health host nimble.local resolves nowhere.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Define the venue's camera feeds | Set up camera ports, apparatus, and fallbacks | UI button | partial |
| Poll camera feed health from the SRT server | Health poll against a dead host | config file | partial |
| Verify or re-point a camera mid-show | Mark a camera verified or reassign it | socket event | built |
| Quick camera switch buttons | One-click camera buttons | socket event | partial |

Depends on: Coordinator server, OBS integration (legacy handle), Nimble. Gaps: never ran against real cameras; fallback has no caller. Workbook: cap-ingest, cap-health, prod-live.

### Production checklist

A 75-item pre-show checklist, fourteen items auto-verified, with contacts. Proven: competitions/cpv7ngyc/checklist worked the morning of the 2026-03-07 tri-meet.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Phased pre-show checklist with notes | 75 items in four countdown phases | UI button | proven |
| Fourteen auto-verified readiness checks | Auto-checks config, VM, OBS, rundown readiness | UI button | proven |
| Per-team production contacts rolodex | Contacts per team | UI button | built |

Depends on: Competition model, Rundown, VM pool, OBS integration. Gaps: static list; nothing reads completion; contacts manual. Workbook: prod-settings, cap-health.

### Clip playout

Ingests third-party clips and plays them autonomously, started by a rundown segment. Partial: verified on production 2026-03-23, but the last WCGNIC heartbeat was FALLBACK about 15 hours before first pixel.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Ingest clips from the Clip Engine | Poll the clip feed every 15 s | HTTP route | built |
| Autonomous clip queue playback | Auto-play the clip queue | socket event | partial |
| Skip, pause, force camera, release | Hotkeys to skip, pause, force camera | hotkey | partial |
| Flag a moment for replay | Flag a moment for replay | socket event | built |
| Gap-fill graphics sequence at rotation breaks | Runs a graphics sequence between rotations | Firebase path | partial |
| Clip player page in OBS with cloud proxy | On-air video player and proxy | Firebase path | built |
| Engine state persisted for restart recovery | Queue survives a restart, mode does not | Firebase path | partial |

Depends on: Rundown, Graphics rendering, OBS integration, Themes, Clip Engine, Cloudflare R2. Gaps: never ran LIVE; rules block dead; gap-fill types unrendered. Workbook: clip-intake, adapter-clipper, prod-program, com-queue, spine-attempt.

### Graphics rendering

Three renderers OBS loads as browser sources, cataloged by a registry of 55 graphics. Proven: four live-meet bug write-ups in docs/PRD-Graphics-Registry/; the stage engine is built, not proven.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Put any graphic on air from the panel | One button per graphic | UI button | proven |
| Legacy inline graphics (49 keys) | The original renderer with 49 graphic keys | Firebase path | proven |
| Standalone overlay graphics driven by URL parameters | 29 URL-driven overlay pages | HTTP route | proven |
| Stage engine renderer | New renderer built from skeleton, blocks, manifests | Firebase path | built |
| Graphics registry generated from manifests | Registry of 55 graphics | config file | proven |
| OBS browser-source URL generator with live preview | Copyable OBS URLs with a preview | UI button | proven |
| Browser-fed event summary and rotation slates | Browser reads the scoring API | HTTP route | proven |
| Talent quick-action graphics | One-tap graphics from the commentator screen | UI button | partial |
| Graphics Manager catalog page | Browse the graphic catalog | UI button | partial |
| Custom per-meet URL graphics | Any web page as a graphic | Firebase path | built |

Depends on: Themes, Scoring feed (stage), Teams database, Competition model. Gaps: nine panel buttons blank the screen; stage live-data path broken. Workbook: gfx-engine, gfx-templates, gfx-delivery, adapter-graphics, res-onair.

### Themes

Per-meet branding applied by every renderer with per-graphic overrides. Proven: 13 real themes assigned to WCGNIC and MPSF 2026; three real theme-load errors from production.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Create and edit a meet theme | Editor for colors, logos, images, sponsors | UI button | proven |
| Assign a theme to a competition | Theme dropdown per meet | UI button | proven |
| Every graphic picks up the theme at runtime | Renderers load the theme and apply variables | Firebase path | proven |
| Per-graphic overrides on legacy graphics | Override colors, images, layout per graphic | UI button | proven |
| Overrides for stage engine and Who to Watch | Overrides for the new renderer and WTW | Firebase path | partial |
| Category templates (apply to all) | Set lower-third values once, apply to all | UI button | built |
| Theme debug overlay on any graphic URL | ?debug=theme shows what was applied | HTTP route | built |
| Theme load failures reported to the producer | Renderer writes theme errors the producer sees | Firebase path | proven |
| Editor preview with a real competition | Editor preview using a real meet | UI button | built |
| Animated background generator | Moving background from logo colors | UI button | built |

Depends on: Coordinator server (saves), Competition model, Graphics rendering. Gaps: stage ignores layout overrides; leaderboard overrides misfiled. Workbook: gfx-style, gfx-engine, prod-live.

### Sponsors

Team and event sponsor logos in three graphics, cued by hand or from a rundown. Proven: live data for West Chester, William & Mary, the WCGNIC theme; BUG-S16 is a live incident.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Team-level sponsor list | A home team's sponsor list | UI button | proven |
| Event-level sponsors on a theme | Sponsors attached to the event's theme | UI button | proven |
| Three sponsor graphics | The three sponsor graphics | Firebase path | proven |
| Per-logo crop, scale, and offset tuning | Make mismatched logos look uniform | UI button | proven |
| Sponsor graphic cued from a rundown segment | Rundown cue fills team sponsors | Firebase path | proven |
| Sponsor fulfillment report in the rundown editor | Which sponsor got which segment | UI button | built |

Depends on: Teams database, Themes, Graphics rendering, Rundown. Gaps: cycle controls are a no-op; rundown path ignores theme sponsors. Workbook: spon-inventory, spon-host, spon-fulfil, gfx-sponsor.

### Who to Watch

A spotlight package built in a rundown segment and auto-played over the clip plumbing. Partial: screenshot loops only; sequencer never verified live (docs/PRD-Who-To-Watch/loops/video-playback/fixes.md).

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Build a spotlight package in a segment | Pick athlete, write cards, attach a clip | UI button | built |
| Play the package on air automatically | Cards, clip, lower third, clear | Firebase path | partial |
| ESPN-style full-screen title card overlay | The spotlight title card | HTTP route | built |
| Lower third shown over the clip | The Who to Watch lower third | HTTP route | partial |
| Athlete image gallery | Extra portrait and action images per athlete | UI button | partial |

Depends on: Rundown, Clip playout, Graphics rendering, Themes, Teams database. Gaps: panel trigger clears the screen; overrides miss the lower third. Workbook: content-intro, gfx-templates, adapter-clipper.

### Competition model

The meet record every system reads, plus the sport's apparatus and format rules. Proven: a real womens-7 competition audited live 2026-03-06 (docs/PRD-7-Team-Audit/).

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Create and edit a competition | The meet record | UI button | proven |
| Import a meet from a session id | Fill the meet from a session id | UI button | proven |
| Competition types, formats, apparatus | The gymnastics rules the app assumes | config file | proven |
| Per-competition workspace | Meet to screens and connections | UI button | proven |
| Composite teams for individual qualifiers | Placeholder team of qualifiers | Firebase path | proven |
| Lock fields against auto-overwrite | Protect hand-edited fields from auto-sync | UI button | partial |
| Several competitions isolated side by side | Isolated namespace per meet | Firebase path | built |

Depends on: Teams database, RTN stats, VM pool, Themes, Virtius. Gaps: format not stored; Meet Setup tab dead. Workbook: prod-settings, res-virtius, res-normalizer, multi-session.

### Teams database

The shared library of 73 teams resolved by name from every graphic. Proven: about 900 athletes for real meets; a production logo-priority fix (docs/PRD-7-Team-Audit/implementation-plan.md).

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Shared team library | Logo, roster, school, gender per team | UI button | proven |
| Athlete headshots resolved by normalized name | Headshot lookup by athlete name | Firebase path | proven |
| School-name aliases for lookup | Alias table so nicknames resolve | Firebase path | proven |
| Roster import from pasted HTML | Paste a roster page to import athletes | UI button | proven |
| Logo and headshot resolution in every graphic | Curated logos win over API logos | Firebase path | proven |

Depends on: Competition model, RTN stats, Virtius images. Gaps: two headshot key conventions; duplicate teams. Workbook: spine-context, res-normalizer, gfx-engine.

### Scoring feed

Server-side scoring poll into shared leaderboards; the browser-fed score bug carried broadcasts. Partial: the server path ran once on a synthetic competition and never produced a leaderboard.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Server-side scoring poll into Firebase | One server poll feeding leaderboards and totals | Firebase path | partial |
| Producer feed on, off, interval, and force refresh | Feed toggle and interval | UI button | built |
| Leaderboard graphics fed from Firebase | Ten stage leaderboards reading the feed | Firebase path | partial |
| Team score bug with producer controls | Persistent score bug with now-competing detection | Firebase path | proven |
| Auto-stop on inactivity or completion | Feed stops itself when nobody is watching | Firebase path | built |

Depends on: Competition model, Teams database, Coordinator server, Virtius. Gaps: bare arrays vs rows envelope; not gated by mode. Workbook: res-virtius, res-normalizer, res-onair, prod-live.

### RTN stats

Pulls season statistics into the team library and the meet, with a show-start snapshot. Proven: 48 stat records; WCGNIC Session 1 carries synced averages (docs/PRD-RTN-Stats-Integration/AUDIT-LOG.md).

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Pull season stats from Road to Nationals | Season stats into the library | socket event | proven |
| Auto-fill team numbers into the meet | Team numbers land in the competition config | Firebase path | proven |
| Freeze a stats snapshot when the show starts | Stats frozen at show start | Firebase path | proven |
| League rankings, team and per-event individual | National rankings on the home page | socket event | built |
| Stats badge, drawer, auto-refresh | See stats freshness, refresh on Start Show | UI button | proven |
| Composite team statistics assembled from source teams | Stats for a placeholder team of qualifiers | Firebase path | proven |
| Road to Nationals proxy routes and cache | Server proxy for the stats site | HTTP route | built |

Depends on: Teams database (rtnId), Competition model, Rundown. Gaps: team keys derived five ways, duplicating live records. Workbook: spine-context, res-normalizer, prod-settings, prod-story.

### Commentary talent CRM

A 482-person commentator database with per-meet assignment, public pages, outreach, and Claude parsing routes. Partial: roster and WCGNIC assignments are real (Firebase talentRoster, competitions/wcgnic-2026-*/commentary); outreach never wrote data.

| Feature | What it does | Control surface | Reliability |
|---|---|---|---|
| Commentator roster and search | The 482-person commentator database | UI button | proven |
| Assign commentators per meet, track to briefed | Per-meet assignment, list and kanban | UI button | proven |
| Same-day double-booking conflict detection | Same-day double-booking warning | UI button | built |
| Email and calendar outreach | Outreach by email and calendar (never exercised) | HTTP route | partial |
| Public booking response link | A yes-or-no link sent to a commentator | UI button | built |
| Public annual availability survey | A public form nobody has submitted | UI button | built |
| Survey CSV import into the roster | CSV import matched by email | UI button | built |
| Parse availability with Claude | Claude parses dates from notes | HTTP route | partial |

Depends on: Competition model, Coordinator server, Google OAuth, Anthropic. Gaps: outreach hits the dead host; discovery broken; assignments never reach the on-air roster. Workbook: com-roster, multi-session.

## 4. Orphaned and legacy inventory

| Item | System | Depended on by | Keep or retire |
|---|---|---|---|
| Wake button (dead) | Coordinator server | VM Pool page gate | Retire the Netlify path; rebuild wake server-side |
| Continuous machine health monitoring | VM pool | Alerts (only alert source) | Keep and wire, or replace |
| Socket API for VM control | VM pool | nothing | Retire; UI uses REST and Firebase |
| Legacy global show engine | Rundown | Talent View Start button | Retire after rewiring Talent View |
| Legacy timesheet HTTP routes | Rundown | OverrideLog on mount, harmless | Retire; they reach an empty engine |
| Generate OBS scenes from the camera list | OBS integration | CameraSetupPage preview | Retire with camera management |
| OBS state sync and REST control layer | OBS integration | nothing in production | Retire 55 unreachable routes; keep the 10 the SPA calls |
| Discord as an alternative comms channel | Talent comms | nothing | Retire the stub |
| Automatic camera fallback | Camera management | nothing | Retire or rewire onto the per-competition OBS |
| Playout rules per segment | Clip playout | nothing; server discards | Retire the editor block or make the engine read it |
| Live camera mode between clips | Clip playout | nothing | Retire until camera health exists |
| Client-side playout simulation | Clip playout | nothing | Retire; mode=preview replaced it |
| Legacy inline theme code in output.html | Themes | fallback only | Retire once the removal task is done |
| Cycle timing controls (no-op) | Sponsors | nothing | Retire or make the overlay read the params |
| Sponsor item in a content sequence | Sponsors | nothing | Retire; no renderer |
| Manual trigger from the producer panel | Who to Watch | nothing | Retire the buttons or add the renderer key |
| Superseded pages and CSV show importer | Competition model | nothing; routes redirect | Retire all four files |
| Unused maintenance helpers | Teams database | nothing | Keep runDiagnostics as a one-off; retire the rest |
| Unused scoring sockets and proxy route | Scoring feed | nothing | Retire, or adopt as the feed's adapter surface |
| AI-scored alumni discovery | Commentary talent CRM | nothing | Retire; parser is a stub |

Dead Firebase paths: `graphics/current`, `production/rundown` outside analytics, `surveyResponses`, `coordinator/shutdownHistory`, `production/stageErrors` are written and never read; `production/talent`, `production/equipment`, `compositeTeams`, `competitions/{compId}/status`, `teamsDatabase/honors`, `teamsDatabase/milestones` are read and never written.

## 5. Adapter candidates

**Graphics.** Today: write `competitions/{compId}/currentGraphic` with a registry id and renderer field (GraphicsControl.jsx:476-525). Missing: render acknowledgement; id validation (nine ids blank the screen); a server endpoint, since the panel writes Firebase directly under open rules. Caveat: proven for legacy graphics; the stage engine renders empty with live scoring.

**Rundown.** Today: sockets loadRundown, startTimesheetShow, pauseTimesheetShow, resumeTimesheetShow, advanceSegment, previousSegment, goToSegment, stopTimesheetShow, setRehearsalMode; state on timesheetState (server/index.js:7816+); the plan is a whole-array write to `rundown/segments`. Missing: an HTTP surface (the /api/timesheet/* routes hit a dead engine); segment validation; authentication. Caveat: proven; the engine's own scene and camera override is broken.

**OBS.** Today: 53 obs:* sockets plus switchScene and POST /api/obs/templates/:id/apply, resolved to the competition's OBS by obsConnectionManager. Missing: a working REST surface (55 of 65 routes bind to a local OBS); reliable template apply; per-competition asset storage. Caveat: built against a test competition only; obs-websocket has no password.

**Clipper and playout.** Today: playout:* sockets (start, stop, pause, resume, skipClip, forceCamera, releaseOverride, flagMoment, addToQueue, retryClip, fetchClips, getState) and the feed URL in `config/clipApiUrl`; intake is the engine polling the deliveries endpoint (clipService.js). Missing: a start path other than a rundown segment; the rules block is discarded; LIVE mode unreachable; gap-fill renderers. Caveat: deployed for WCGNIC 2026 and did not run the meet.

**Scoring feed.** Today: `competitions/{compId}/config/scoringFeed` {enabled, pollInterval, forceRefresh}, watched by the server; scoring:* sockets exist unused. Missing: a working consumer (rows envelope); one poller instead of three; mode gating on VMs. Caveat: never produced a leaderboard; the proven scoring graphics poll the API from the browser.

**Coordinator.** Today: GET /api/coordinator/status and keep-alive; sleep via AUTO_SHUTDOWN_MINUTES; wake only from the AWS console or the MCP aws_start_instance tool. Missing: a wake endpoint that works when the process is down; authentication; a real health route. Caveat: proven as a process; sleep and wake is one-directional.

## 6. Gymnastics-bound systems

- Competition model: apparatus sets, Olympic order, API event names, compType enum (lib/eventConfig.js, competitionUtils.js, graphicButtons.js, server/lib/apparatusConfig.js, output.html tables). Agnostic: a sport definition that gender points at; compType split into sport, division, team count, format.
- Rundown: pickers filter by compType; suggestions template one block per apparatus (RundownEditorPage.jsx, aiSuggestionService.js). Agnostic: parameterize both on the sport definition.
- Production checklist: items hard-code the scoring-service workflow and gendered team keys (lib/checklistItems.js). Agnostic: per-sport item templates.
- Clip playout: four-apparatus women's camera table, forceCamera capped at 4, rotation from the scoring API (playoutEngine.js:155-159,1440). Agnostic: sport definition plus a scoring adapter.
- Graphics rendering: leaderboards, event summary, frames, now-competing, team bug, rotation slates, stage roster carry apparatus logic; sponsors, stream cards, logos, hosts, coaches, interview card, Who to Watch do not. Agnostic: regenerate the bound set from the sport definition and a normalized results feed.
- Teams database: roster importer and image URLs tied to Virtius; gender suffix on keys (useCompetitions.js:75-103). Agnostic: per-source importers; drop the suffix.
- Scoring feed: Virtius event names, D/E/ND fields, all-around aggregation hard-coded (scoringIngestionService.js:51-88,410-629). Agnostic: a results normalizer per source.
- RTN stats: event-code tables, RTN URL shapes, RQS/NQS semantics, top-5 team math (rtnStatsService.js). NCAA gymnastics by nature; one stats adapter behind a generic interface.

## 7. Open questions

1. Which of the 28 recorded WCGNIC runs was the broadcast, and did engine-driven OBS scene switches happen during it?
2. Were Gmail, Google Calendar, or Anthropic keys ever set on the coordinator? No record carries the data those calls would write.
3. What are the actual database rules in the Firebase console? Nothing in the repo records them.
4. Was a pooled VM assigned for any named broadcast, or were machines pointed at by hand?
5. Did the score bug or the browser-fed event summary run at MPSF 2026? Evidence covers WCGNIC and the seven-team meet only.
6. Is the Clip Engine deliveries feed still available, and under what terms? The default base URL is a personal tunnel.
7. Which stream tiers the planner intends each feature for; every stream_types value is inferred.
