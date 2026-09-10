# Alerts

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Platform and infrastructure
**Purpose:** Meant to give the producer one place during a show where infrastructure failures (VM unreachable, OBS disconnected, service down) surface as a red banner plus an acknowledgeable panel, instead of being buried in server logs.
**Status:** **Partial**, with the automatic-trigger half effectively **Orphaned**. `server/lib/alertService.js` (580 lines) is a complete singleton — create, resolve, `resolveBySourceId`, acknowledge, `acknowledgeAll`, counts, `clearOldResolvedAlerts`, 10s info auto-dismiss — and seven HTTP routes at `server/index.js:2996-3240` are wired to it. The client half is equally complete and reachable: `useAlerts.js` subscribes to `alerts/{compId}`, `ProducerView.jsx:804-826` renders a critical banner and `ProducerView.jsx:1271-1276` renders `AlertPanel`. **But nothing ever creates an alert.** The only producer of alerts is `server/lib/vmHealthMonitor.js` (5 `createAlert` sites), and that module is imported by *nothing* — `grep -rn "vmHealthMonitor" server/` returns only its own file plus text strings inside `server/scripts/test-alert-system.js`; it is absent from the 43 lib imports at the top of `server/index.js`. Confirming this end to end: the live Firebase database has **no `alerts` node at all** (root children are `bookingTokens, competitions, currentGraphic, graphics, rtnCache, rundownTemplates, segmentTemplates, talentRoster, teamsDatabase, templates, themes, vmPool`) — not one alert has ever been written. The socket layer is also a stub: `server/index.js:8127-8132` is commented `// Acknowledge an alert (placeholder for P17)` and echoes `alertAcknowledged` back without touching `alertService`, and the service's own `alertCreated`/`alertResolved`/`alertAcknowledged` EventEmitter events (`alertService.js:176,239,328`) have no listener anywhere, so the module docstring's "broadcast via socket events" is unimplemented.
**Sport coupling:** **Generic** — `alertService.js` keys everything on an opaque `competitionId` and its five categories are `vm/service/camera/obs/talent`; no apparatus, rotation, or scoring concept appears. (`useProductionAlerts.js` is likewise generic — meet dates and booking status only.)
**Key files:**
- `server/lib/alertService.js` (580 lines) — singleton; levels, categories, per-category auto-resolve, Firebase persistence
- `server/index.js` (8730 lines) — 7 alert routes at 2996-3240; stub socket handler at 8127
- `server/lib/vmHealthMonitor.js` (~770 lines) — the only `createAlert` caller; **never imported**
- `show-controller/src/hooks/useAlerts.js` (177 lines) — Firebase subscription, filtering/sorting, acknowledge actions
- `show-controller/src/components/AlertPanel.jsx` (230 lines) — collapsible panel, grouped by level, per-alert + acknowledge-all
- `show-controller/src/views/ProducerView.jsx` — critical banner (804-826) and panel mount (1271-1276)
- `show-controller/src/hooks/useProductionAlerts.js` (131 lines) — **separate** client-only pre-production alert generator
- `show-controller/src/pages/HomePage.jsx:54,644-670` — renders the pre-production alerts list
- `server/scripts/test-alert-system.js` (~400 lines) — manual E2E script against `localhost:3003`; not a Jest test (nothing alert-related in `server/__tests__/`)
- `show-controller/src/hooks/useThemeErrors.js` (86 lines) — parallel mechanism, see below
- `show-controller/src/components/ThemeErrorLog.jsx` (191 lines) — parallel mechanism UI
- `overlays/theme-loader.js:282` — writes theme errors straight to RTDB from the browser source

**Firebase paths written:**
- `alerts/{compId}/{alertId}` — full alert object, server via `firebase-admin` (`alertService.js:171`)
- `alerts/{compId}/{alertId}` — `acknowledged`/`acknowledgedAt`/`acknowledgedBy` patch, written **directly by the browser** (`useAlerts.js:84-89`, bypassing the server)
- `alerts/{compId}/{alertId}` — removed by `clearOldResolvedAlerts` (`alertService.js:492`)
- (parallel mechanism) `competitions/{compId}/production/themeErrors/{pushId}` — written by `overlays/theme-loader.js:282`, deleted by `useThemeErrors.js:61,72`

**Firebase paths read:**
- `alerts/{compId}` — server list/count (`alertService.js:261,381,419,484`) and client subscription (`useAlerts.js:46`; uses literal `alerts/local` in local mode, `useAlerts.js:39`)
- `competitions` — whole node, by `useProductionAlerts.js:20`; touches `{compId}/config/meetDate`, `{compId}/config/eventName`, `{compId}/commentary/{talentId}` (`status`, `calendarInviteSent`, `invitedAt`, `name`), `{compId}/preProductionMeetingScheduled`
- (parallel mechanism) `competitions/{compId}/production/themeErrors` — `useThemeErrors.js:21`

**Socket events:** `emits:` `alertAcknowledged` (stub echo to the sending socket only, `server/index.js:8131`) / `listens:` `acknowledgeAlert` (stub, does not call `alertService`, `server/index.js:8127`). The client never registers any alert socket listener — `useAlerts.js` is pure Firebase `onValue`.
**HTTP routes:**
- `GET /api/alerts/:compId` — list active alerts
- `GET /api/alerts/:compId/counts` — counts by level
- `GET /api/alerts/:compId/all` — all alerts incl. resolved
- `POST /api/alerts/:compId` — create alert (validates level/category)
- `POST /api/alerts/:compId/:alertId/acknowledge` — mark alert seen
- `POST /api/alerts/:compId/:alertId/resolve` — mark alert resolved
- `POST /api/alerts/:compId/resolve-by-source` — bulk auto-resolve by sourceId
- `POST /api/alerts/:compId/acknowledge-all` — acknowledge every active alert
- (No SPA code calls any of these — `grep "api/alerts" show-controller/src/` returns nothing; the only caller is `server/scripts/test-alert-system.js`.)

**External services:**
- Firebase Realtime Database via `firebase-admin` with `admin.credential.applicationDefault()` (`alertService.js:81-91`) — persistence; init fails to a 503 "Firebase credentials not configured" if ADC is absent

**Depends on:**
- VM pool — direct import (`vmHealthMonitor.js:17` imports `getAlertService`) — the sole source of automatic alerts; **this wire is dead because `vmHealthMonitor` itself is never imported**
- OBS integration — direct import via the same `vmHealthMonitor` path — raises `ALERT_CATEGORY.OBS` "OBS Disconnected" (`vmHealthMonitor.js:585`)
- Competition model — Firebase path `alerts/{compId}` — every alert is scoped by competition id; `useAlerts` gets `compId` from `CompetitionContext`
- Commentary talent CRM — Firebase path `competitions/{compId}/commentary/{talentId}` — `useProductionAlerts` derives all five pre-production alerts from booking status

**Used by:**
- Producer View — direct import (`ProducerView.jsx:18,22`) — critical banner + collapsible panel + acknowledge
- Home page — direct import (`HomePage.jsx:17`) — pre-production alerts list (the `useProductionAlerts` path only; `alerts/*` never appears here)
- Competition workspace — renders Producer View, which mounts the panel

**UI surfaces:**
- Producer View critical alert banner (top of page, always visible) — `show-controller/src/views/ProducerView.jsx:804-826`
- Producer View right-column "Alerts" collapsible panel + header count pills (`ProducerView.jsx:665-678`) — `show-controller/src/components/AlertPanel.jsx`
- Home page "Pre-Production Alerts (N)" list — `show-controller/src/pages/HomePage.jsx:644-670`
- Producer View right-column "Theme Error Log" panel (separate mechanism) — `show-controller/src/components/ThemeErrorLog.jsx`

**Known gaps:**
- **No alert is ever raised.** `server/lib/vmHealthMonitor.js` is not imported by `server/index.js` or `server/routes/obs.js`, and there is no dynamic import of it (`server/index.js` has exactly one `await import(...)`, for `firebase-admin` at line 4920). The five `createAlert` sites (`vmHealthMonitor.js:215, 248, 565, 585, 637`) are unreachable.
- Live Firebase root has **no `alerts` node** — zero alerts have ever existed in this database.
- Socket broadcasting is unimplemented. `alertService`'s `alertCreated`/`alertResolved`/`alertAcknowledged` events have no subscriber; `socket.on('acknowledgeAlert')` is explicitly marked `// Alert service will be implemented in P17-01` and only echoes.
- Three of five categories are dead: `SERVICE`, `CAMERA`, `TALENT` are defined (`alertService.js:26-32`) with auto-resolve config but have **zero** call sites. Only `VM` (×4) and `OBS` (×1) are ever used, and only levels `CRITICAL` (×4) and `INFO` (×1) — `WARNING` is never produced by any code path.
- `createIdleTimeoutAlert` (`vmHealthMonitor.js:631`) has no callers.
- All 8 alert HTTP routes have no client caller; the SPA acknowledges by writing RTDB directly, so `acknowledgedBy` is hard-coded `'producer'` (`useAlerts.js:88`) with no user identity, and no server-side validation applies.
- Auto-resolve exists only via `resolveBySourceId` triggered from the unwired health monitor (`vmHealthMonitor.js:487-491`); `clearOldResolvedAlerts` and `maxAlertsPerCompetition` (`alertService.js:47`) are never invoked — the 100-alert cap is declared but not enforced anywhere.
- Alert routes inherit the coordinator's total lack of auth (see the Auth entry): `POST /api/alerts/:compId` will create an alert for any competition, for anyone.
- No Jest coverage — `server/__tests__/` has no alert test; only the manual `server/scripts/test-alert-system.js`, whose own error strings admit endpoints were expected to be missing ("Alert API endpoint not found - alerts created via vmHealthMonitor only", line 154).
- `useProductionAlerts` recomputes over the entire `competitions` node on every RTDB change and persists nothing — alerts are ephemeral, cannot be dismissed, snoozed, or acknowledged.

**Evidence of live use:**
- **`alerts/*`: none found.** The node does not exist in Firebase; no incident write-up, audit doc, or event folder references `AlertPanel`, `alertService`, or `ALERT_LEVEL` (`grep -rl` over `docs/PRD-Graphics-Audit-ECAC/` and `docs/WCGNIC-2026/` returns nothing).
- **The parallel theme-error mechanism did run live.** `competitions/wcgnic-2026-prelim1/production/themeErrors` holds 3 real entries written from `https://commentarygraphic.com/output.html?comp=wcgnic-2026-prelim1` during WCGNIC 2026 (timestamps 1774533582742 / 1774550886337 / 1774579387153 ≈ 2026-03-26), types `timeout` ×2 and `theme_not_found` for theme `wcgnic-2026`.
- Commits `66eed155` ("Add alert service (P17-01)"), `b606bb80` / `3e191f93` (PRD-Commentary-Talent-CRM Tasks 5.4/5.5 — the HomePage pre-production alerts).

**PRDs / docs:**
- `docs/PRD-VMArchitecture-2026-01-14.md` — §11.2 (lines 1859-1869) and P17-01…P17-05 (lines 2071-2135) specify this system; §11.2 promises "Socket event emission for real-time UI updates" and all five categories, neither of which shipped
- `server/scripts/test-alert-system.js` — the de-facto spec/verification script
- `docs/PRD-Commentary-Talent-CRM/implementation-plan.md` — origin of `useProductionAlerts`

### Direct answer on the theme-error question
`competitions/{compId}/production/themeErrors` is a **completely separate parallel mechanism** — it never touches `alertService`. It is written client-side by the OBS browser source (`overlays/theme-loader.js:282`, `db.ref(...).push()` using the compat `firebase.database()` global), read by `show-controller/src/hooks/useThemeErrors.js:21`, and rendered by `ThemeErrorLog.jsx` beside `AlertPanel` in `ProducerView.jsx:1279`. It has a different shape (`type`, `themeId`, `source`, `url`, numeric `timestamp`, `resolved` — no `level`, `category`, `acknowledged`, or `sourceId`), no server involvement, and clearing means hard-deleting the node rather than marking resolved. Ironically it is the one of the two that has real production data behind it, while the "official" alert service has none.
