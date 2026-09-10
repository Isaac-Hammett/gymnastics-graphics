# VM pool

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Platform and infrastructure
**Purpose:** Gives a producer a pool of OBS-ready machines (AWS EC2 launched from a prebuilt AMI, plus manually-registered "custom" VMs) that can be started, stopped, and assigned to a competition from one admin page. Assignment writes the VM's address into the competition config so the coordinator can route OBS control to the right machine and the producer can see connection credentials.

**Status:** Built — wired end to end (VMPoolPage → `useVMPool`/fetch → 8 admin + 3 competition HTTP routes in `server/index.js` → `vmPoolManager` → AWS EC2 SDK + Firebase → socket broadcast back to clients), with real AWS exercise logged. `ralph-vmpool/activity.md` records WORKFLOW-01…06 run against production on 2026-01-17: a real instance (`i-0a20c68a1d940b11a`) launched, stopped, restarted, and assigned to competition `3602v1c8` with Firebase confirming `vmAddress = "3.89.92.162:3003"`; `docs/README-OBS-Architecture.md:79` shows a later production pool with `vm-5537f632` assigned to competition `8kyf0rnl`. What is missing is evidence that the pool was operated *during* a live broadcast — the live-incident write-up that touches VMs (`docs/PRD-Rundown-System/BUGS.md` BUG-021, 2026-03-07) describes the OBS VM being *unreachable* rather than the pool being used. Sub-parts at other levels: **`server/lib/vmHealthMonitor.js` (773 lines) is Orphaned** — `grep -rn vmHealthMonitor` over the repo returns only its own file, docs, `plan-archive.md`, and a string inside `server/scripts/test-alert-system.js`; nothing imports `getVMHealthMonitor`, so its 30 s polling loop, 3-strike error marking, AWS state reconciliation, and VM/OBS alert creation never run. **Warm-pool automation is Orphaned too**: `ensureMinWarmVMs()`, `markVMInUse()`, `updateVMServices()`, and `setVMError()` in `vmPoolManager.js` are defined but called from nowhere, so `in_use` is an unreachable state and `warmCount`/`coldCount`/`maxInstances`/`idleTimeoutMinutes`/`healthCheckIntervalMs` are displayed-only config.

**Sport coupling:** Generic — the code deals only with EC2 instances, IPs, ports, and competition IDs; the only gymnastics leakage is cosmetic (VMPoolPage's assign modal renders a `WAG`/`MAG` badge from `config.gender` at `VMPoolPage.jsx:882-889`).

**Key files:**
- `server/lib/vmPoolManager.js` (1040) — pool singleton: AWS↔Firebase sync, assign/release, start/stop, custom VM CRUD, event emitter
- `server/lib/awsService.js` (612) — EC2 SDK wrapper (describe/start/stop/reboot/terminate/RunInstances), waiters, `/api/status` service probe, retry+backoff; holds AMI/VPC/SG/keypair defaults
- `server/lib/vmHealthMonitor.js` (773) — ORPHANED: polling health checks, AWS reconciliation, alert creation
- `server/index.js` (8730) — `initializeVMPoolManager()` at 1333-1410; admin routes 2173-2380; competition VM routes 2538-2670; VM socket handlers 8039-8150; OBS routing lookup 4643-4660
- `show-controller/src/pages/VMPoolPage.jsx` (939) — admin UI at `/_admin/vm-pool`: pool bar, config panel, VM grid, launch/custom/assign modals
- `show-controller/src/components/VMCard.jsx` (318) — per-VM card: status badge, IP/credentials, service dots, start/stop/assign/release/delete, SSH copy
- `show-controller/src/hooks/useVMPool.js` (245) — Firebase `vmPool/vms` + `vmPool/config` subscription, assign/release/start/stop fetch wrappers, `getVMForCompetition`
- `show-controller/src/views/ProducerView.jsx` (1663) — `VMConnectionPanel` (1597-1660), rendered at 1293-1298 only when `competitionConfig.vmCredentials` exists
- `show-controller/src/components/PoolStatusBar.jsx` (113) — counts + "start a cold VM" affordance
- `server/scripts/test-vm-pool-api.js` (359) — manual end-to-end API script (not in the Jest suite; `server/__tests__/` has no VM/AWS test)
- `vm-full-setup.sh` (183) — provisions Ubuntu 22.04: Node 20 + PM2, FFmpeg, OBS + Xvfb, obs-websocket on 4455 with auth disabled, `xvfb.service` + `obs-headless.service`; ends telling you to `pm2 start index.js --name virtius-server` on port 3003
- `docs/vm-setup-guide.md` (400) — the newer, fuller recipe: adds NoMachine (4000) and a `gymnastics-update.service` that `git reset --hard origin/main` on boot, then AMI creation + how to bump `awsService.js` line 34

**Firebase paths written:**
- `vmPool/config` — full pool config object (created on first init, replaced by `updatePoolConfig`)
- `vmPool/vms/{vmId}` — whole record on AWS sync; `null` to evict terminated instances
- `vmPool/vms/{vmId}/{status,assignedTo,lastStateChange,publicIp,privateIp,services,lastHealthCheck,errorReason}`
- `vmPool/vms/custom-{base36ts}` — `{isCustom, name, publicIp, username, password, status, assignedTo, lastStateChange}` (password stored in plaintext)
- `competitions/{compId}/config/vmAddress` — `"{publicIp}:{servicePort}"` on assign, `null` on release
- `competitions/{compId}/config/vmCredentials` — `{username, password}`, custom VMs only; `null` on release

**Firebase paths read:**
- `vmPool/config` — server `once` + live `on('value')`; client `onValue`
- `vmPool/vms` — server live `on('value')` (feeds the in-memory `_vms` Map); client `onValue`
- `competitions/{compId}/config` — client only (`CompetitionContext`, `useCompetitions`), for `vmAddress`/`vmCredentials`

**Socket events:**
`emits:` vmPoolStatus, vmAssigned, vmReleased, vmStarting, vmReady, vmStopping, vmStopped, vmError, vmInUse, vmPoolConfigUpdated, vmPoolMaintenance, vmAssignmentResult, vmReleaseResult, vmStartResult, vmStopResult
`listens:` assignVM, releaseVM, startVM, stopVM, getVMPoolStatus
Note: no client file subscribes to any of these — `grep` for `vmPoolStatus`/`assignVM` in `show-controller/src` finds only the HTTP path. The whole socket surface is server-side-only dead weight; the UI polls REST and Firebase instead.

**HTTP routes:**
- `GET /api/admin/vm-pool` — full pool status (returns custom-VM plaintext passwords)
- `GET /api/admin/vm-pool/config` — pool config merged with AWS region/AMI/instance type
- `PUT /api/admin/vm-pool/config` — update pool config
- `GET /api/admin/vm-pool/:vmId` — single VM detail
- `POST /api/admin/vm-pool/:vmId/start` — start stopped EC2 VM
- `POST /api/admin/vm-pool/:vmId/stop` — stop EC2 VM
- `POST /api/admin/vm-pool/launch` — RunInstances from AMI, resync after 5 s
- `POST /api/admin/vm-pool/custom` — register externally-managed VM
- `DELETE /api/admin/vm-pool/:vmId` — terminate EC2 or delete custom entry
- `POST /api/competitions/:compId/vm/assign` — assign VM, write vmAddress
- `POST /api/competitions/:compId/vm/release` — release VM, clear vmAddress
- `GET /api/competitions/:compId/vm` — VM assigned to competition
- `GET /api/vm/:compId/status` — server-side VM health proxy (dodges HTTPS mixed content)

**External services:**
- AWS EC2 (`@aws-sdk/client-ec2`, us-east-1) — describe/start/stop/reboot/terminate/RunInstances/CreateTags plus `waitUntilInstanceRunning`/`Stopped`
- AWS AMI `ami-070ce58462b2b9213` (gymnastics-vm-v2.2), SG `sg-025f1ac53cccb756b`, VPC `vpc-09ba9c02e2c976cf5`, keypair `gymnastics-graphics-key-pair` — all hard-coded defaults in `awsService.js:29-36`, env-overridable
- Firebase Realtime Database (firebase-admin, `applicationDefault()` credentials) — pool state of record
- VM `GET http://{ip}:3003/api/status` — the only health signal actually consulted

**Depends on:**
- Coordinator server — direct import (`server/index.js:22-23`) — hosts every route/socket handler and calls `initializePool()`; `CoordinatorGate` also blocks the UI when the coordinator EC2 is off
- Competition model — Firebase `competitions/{compId}/config/vmAddress` + `vmCredentials` — where an assignment is recorded
- Auth — `RequireAuth` wrapper on `/_admin/vm-pool` in `App.jsx:97-103` — client-side only; the HTTP routes themselves have no auth middleware
- Alerts — direct import in `vmHealthMonitor.js:17` (`getAlertService`) — VM-unreachable / OBS-disconnected / VM-terminated alerts; dead because the monitor is never instantiated

**Used by:**
- OBS integration — direct import at `server/index.js:4643-4657`: on socket connect the coordinator calls `vmPoolManager.getVMForCompetition(compId)` and passes `vm.publicIp` to `obsConnectionManager.connectToVM()`. This reads the pool's in-memory cache (backed by `vmPool/vms`), **not** `config/vmAddress` — `docs/README-OBS-Architecture.md:200-206` claims otherwise and is wrong
- Coordinator server — direct import: `autoShutdown.initialize({ awsService })` at `server/index.js:1472-1477`, so `awsService` also backs coordinator idle self-stop
- Home page (`show-controller/src/pages/HomePage.jsx`) — `useVMPool` + `checkVmStatus(config.vmAddress)`: per-competition VM dot and inline Assign/Release buttons
- Competition workspace / selector (`show-controller/src/pages/CompetitionSelector.jsx:231-236`) — `vmAddress` presence + online check gates the Producer/Talent buttons
- Producer View (`ProducerView.jsx:1293-1298`) — VM Connection panel (IP, username, password reveal/copy)
- Production checklist — `useProductionChecklist.js:155-175` polls `checkVmStatus` every 30 s; `checklistValidators.js:157-188` implements the `vm-assigned` and `vm-online` items
- Graphics rendering / Rundown / all socket features — indirectly, via `CompetitionContext.jsx:45-69`: on HTTP dev it builds `socketUrl` from `vmAddress`; on HTTPS it discards `vmAddress` and hardcodes `https://api.commentarygraphic.com`
- Competition workspace header — `CompetitionHeader.jsx:61-64` prints the vmAddress next to the event name

**UI surfaces:**
- VM Pool Management page (`/_admin/vm-pool`) — `show-controller/src/pages/VMPoolPage.jsx`
- VM card (grid tile with actions) — `show-controller/src/components/VMCard.jsx`
- Pool status bar / "start cold VM" — `show-controller/src/components/PoolStatusBar.jsx`
- Producer View → VM Connection panel — `show-controller/src/views/ProducerView.jsx:1597`
- Home page → System Administration → "VM Pool" tile — `show-controller/src/pages/HomePage.jsx:917-924`
- Setup Guide page links — `show-controller/src/pages/SetupGuidePage.jsx:186,308`

**Known gaps:**
- No health checking runs today. The *only* live probe is one-shot: `_waitForVMReady` → `awsService.waitForServicesReady()` polls `/api/status` every 5 s for up to 120 s right after `startVM`, then writes `services: {nodeServer:true, obsConnected:false}` once (`vmPoolManager.js:591-611`). `_healthCheckInterval` is declared (line 61) and cleared in `shutdown()` but never assigned. Recurring health lives entirely in the orphaned `vmHealthMonitor.js`. The user-visible substitutes are client polls: `useProductionChecklist` (30 s) and `HomePage`/`CompetitionSelector` (once per competitions load), both via `GET /api/vm/:compId/status`.
- Service-dot field mismatch: `VMCard.jsx:222-224` reads `services.node`, `services.obs`, `services.nomachine`, but the only writer produces `nodeServer`/`obsConnected` — the three dots are permanently grey, and `nomachine` is never written by anything.
- `services` is never refreshed after boot, so `lastHealthCheck` on the card is frozen at start time; `obsConnected` is hardcoded `false` even when OBS is up.
- No AWS-state reconciliation while running: a VM stopped from the AWS console leaves Firebase claiming `assigned` and leaves a stale `vmAddress` on the competition until the coordinator restarts and re-runs `_syncWithAWS()`. The IP-change and desync handling exists only in the orphan.
- Assignment model is inconsistent by design: AWS VMs use `assignedTo` as a string (1:1), custom VMs use an array (1:many). Every consumer must branch on `Array.isArray` — `vmPoolManager.js:346,376,446,468,756,842`, `useVMPool.js:189`, `VMCard.jsx:90`, `server/index.js:2372,2633`. `stopVM` (line 643) checks truthiness of `assignedTo` without the array branch, and `_mapEC2StateToStatus` (238-265) also assumes a string.
- `maxInstances` is never enforced — `POST /api/admin/vm-pool/launch` calls `awsService.launchInstance()` with no pool-size check. `warmCount`/`coldCount`/`idleTimeoutMinutes`/`healthCheckIntervalMs` are equally decorative.
- No auth on any VM route: `server/index.js:1859` is a bare `app.use(cors())` with no token middleware, so `GET /api/admin/vm-pool` returns custom-VM plaintext passwords to any caller. Passwords are also stored unencrypted in `vmPool/vms/{vmId}` and mirrored into `competitions/{compId}/config/vmCredentials`.
- `GET /api/vm/:compId/status` hardcodes port 3003 instead of `poolConfig.servicePort`; `checkVmStatus` hardcodes `https://api.commentarygraphic.com` (`useCompetitions.js:319`), as does `CompetitionContext`'s production branch.
- `updateVmAddress(compId, vmAddress)` is implemented and exported from `useCompetitions.js:713,739` but called by no component — there is no manual "set VM address" UI; assignment is the only writer.
- The entire socket API (`assignVM`/`releaseVM`/`startVM`/`stopVM`/`getVMPoolStatus` and the 15 broadcast events) has no client consumer.
- Custom VMs get no `/api/status` probe at all, so `vm-online` in the checklist always reports offline for them — acknowledged in `checklistValidators.js:164-166`.
- `docs/PRD-VMArchitecture-2026-01-14.md` Part 3 (SSH Manager module, `/api/admin/ssh/*` endpoints) was never built — `server/lib/` contains no `sshManager.js` and no SSH route exists.
- No automated tests: `server/__tests__/` has no VM or AWS spec; only the manual `server/scripts/test-vm-pool-api.js`.
- `docs/vm-architecture-diagram.md:186-194` points at `server/services/*` and `server/routes/vmPoolRoutes.js`, none of which exist (the code is in `server/lib/` and inline in `index.js`).
- `vm-full-setup.sh` predates the AMI: it omits NoMachine and the boot auto-update service that `docs/vm-setup-guide.md` requires, and it names the PM2 process `virtius-server` while the guide uses `obs-vm-server`.
- OBS WebSocket is provisioned with `auth_required: false` / empty password (`vm-full-setup.sh:87-103`), relying entirely on the security group.

**Evidence of live use:**
- `ralph-vmpool/activity.md` — WORKFLOW-01…06 (2026-01-17) against production: real instance launched/stopped/started/assigned, Firebase `vmAddress` verified, plus two bugs found and fixed live (missing `GOOGLE_APPLICATION_CREDENTIALS` on the coordinator; `useVMPool` reading `vmPool/` instead of `vmPool/vms/`)
- Commits `a8472666` "WORKFLOW-06: Assign VM to competition - COMPLETED" and `0772d073` "WORKFLOW-02/03/04: VM Pool workflows verified - stop/start working" (Julia Cosmiano, 2026-01-17)
- `docs/README-OBS-Architecture.md:73-105` — production pool snapshot: `vm-5537f632` assigned to competition `8kyf0rnl` at `50.19.137.152`; AMI v2.2 captured from that VM on 2026-01-20
- `screenshots/vm-pool-page.png`, `screenshots/vm-pool-complete.png`, `screenshots/vm-card.png`, `screenshots/select-with-vm-status.png` (2026-01-14), `screenshots/INT-15-vm-pool.png` (2026-01-15)
- `SPINUP-2026-08-17.md:99-105` — four real AMIs still in AWS; "Launch from the VM Pool page in the show controller once the coordinator is running"
- `docs/INFRASTRUCTURE.md:154-190` — operational runbook entry "If VM pool stops working, check Firebase credentials", implying it was operated in anger
- No evidence found of a VM being assigned or started *during* a named broadcast (WCGNIC 2026, MPSF, ECAC); `docs/WCGNIC-2026/` contains only screenshots and no VM references

**PRDs / docs:**
- `docs/PRD-VMArchitecture-2026-01-14.md` (2167) — the source PRD; Status field says "Draft - Pending Review" (stale)
- `docs/SPEC-competition-vm-routing.md` (597) — the `vmAddress` contract and compId-scoped routing design
- `docs/vm-setup-guide.md` (400) — VM build + AMI creation + AMI-bump procedure
- `docs/vm-architecture-diagram.md` (219) — pool/state/flow diagrams; file table is stale
- `docs/README-OBS-Architecture.md` — production topology; §5 "vmAddress in Firebase vs Actual Connection" is the clearest statement of the routing, though its claim that the coordinator reads `config/vmAddress` is contradicted by the code
- `docs/INFRASTRUCTURE.md` — ports, Firebase layout, current AMI, service-account runbook
- `docs/PRD-CompetitionBoundArchitecture-2026-01-13.md` — where `vmAddress` replaced `VITE_SOCKET_SERVER`
- `VM-SETUP.md` (149), `vm-full-setup.sh` (183) — legacy single-VM manual setup
- `CLAUDE.md:596-700` — "VM Pool & Custom VMs" section: VM types, custom-VM multi-assignment rules, endpoint table, custom-VM guards
- `SPINUP-2026-08-17.md` — AMI inventory and relaunch order after the August 2026 teardown
- `ralph-vmpool/` (PRD.md, plan.md, activity.md) — the loop that verified the pool against production
