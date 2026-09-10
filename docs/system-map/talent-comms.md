# Talent comms

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Show production
**Purpose:** Creates a private VDO.Ninja room for a competition and hands the producer copy-paste links: two "join" links to send to commentators, a director link, and view links for OBS to pull each commentator's feed into a scene.
**Status:** **Partial** — the generator, the six REST routes and the panel are complete and covered by a 638-line test suite (`server/__tests__/talentCommsManager.test.js`), and the panel is screenshot-verified (`docs/PRD-OBS-11-AdvancedFeatures/screenshots/talent-comms-status-full.png`). But it is essentially a URL factory plus a Firebase write: **no** — it does nothing beyond generating and storing URLs. `docs/PRD-OBS-10-TalentComms/IMPLEMENTATION-PLAN.md:24` marks "Verify OBS browser source created on VM" as **DEFERRED — Not implemented - manual step**, so the PRD's core requirement (§3, coordinator instructs the VM's OBS to create the VDO.Ninja browser source) was never built. Discord is a stored placeholder with four `null` fields and zero integration code. One thing *does* consume the URLs: `server/routes/obs.js:1707-1735` reads `talentComms.vdoNinja.obsViewUrls['talent-1'/'talent-2']` and `obsSceneUrl` into the template-apply context, so the `Talent-1` / `Talent-2` browser sources in `server/config/sceneTemplates/gymnastics-dual-v2-firebase.json` get real URLs when a template is applied. **Talent View does not consume them** — grepping `show-controller/src/views/TalentView.jsx` and `pages/TalentPage.jsx` for `vdo`/`talentComms` returns nothing.
**Sport coupling:** **Generic** — room IDs are `gym_{hex}` and the file has no sport concepts at all; only the "gym_" prefix in `generateRoomId()` names the sport.
**Key files:**
- `server/lib/talentCommsManager.js` (417) — room ID/password/API-key generation, VDO.Ninja SHA-256 hash, 5 CRUD methods
- `show-controller/src/components/obs/TalentCommsPanel.jsx` (712) — Talent Comms tab: method toggle, URL cards with copy-to-clipboard, regenerate, hidden status-monitor iframe
- `server/routes/obs.js:1917-2155` — the six talent-comms endpoints
- `server/__tests__/talentCommsManager.test.js` (638) — URL-shape and Firebase-write assertions

**Firebase paths written:**
- `competitions/{compId}/config/talentComms` — `{ method, generatedAt, vdoNinja: { roomId, directorUrl, statusMonitorUrl, apiKey, obsSceneUrl, talentUrls{talent-1,talent-2}, obsViewUrls{talent-1,talent-2}, generatedAt } }` or `{ method, discord: { guildId, channelId, channelUrl, channelName } }` (all null)

**Firebase paths read:**
- `competitions/{compId}/config/talentComms`

**Socket events:** `emits:` none · `listens:` none — the PRD specifies Socket.io events (`docs/PRD-OBS-10-TalentComms/PRD-OBS-10-TalentComms.md:166`) but the implementation is REST-only.
**HTTP routes:**
- `GET /api/obs/talent-comms` — fetch current config
- `POST /api/obs/talent-comms/setup` — create room and URLs
- `POST /api/obs/talent-comms/regenerate` — new room ID, same method
- `PUT /api/obs/talent-comms/method` — switch VDO.Ninja ↔ Discord
- `GET /api/obs/talent-comms/status` — config summary (never called by the UI)
- `DELETE /api/obs/talent-comms` — remove config (never called by the UI)

**External services:**
- VDO.Ninja (`https://vdo.ninja`) — the actual audio/video room; the server only mints URLs, it never calls a VDO.Ninja API
- VDO.Ninja IFRAME API — browser-side `postMessage` in a hidden iframe (`TalentCommsPanel.jsx:50-143`) for `guest-connected` / `push-connection` / `loudness` events
- Discord — named as an alternative method; no code, no API calls

**Depends on:**
- Coordinator server — direct import; `productionConfigService.initialize()` supplies the Firebase admin handle
- Competition model — Firebase `competitions/{compId}/config/talentComms`; compId resolved from the global `configLoader.getActiveCompetition()`
- OBS integration — direct import (`server/routes/obs.js:26`) and the panel's `useOBS().obsConnected` gate

**Used by:**
- OBS integration — direct import in the template-apply route — maps `obsViewUrls` into `{{talentComms.talent1Url}}` / `{{talentComms.talent2Url}}` for the `Talent-1` / `Talent-2` browser sources
- Competition workspace (surface) — Talent Comms tab of OBS Manager

**UI surfaces:**
- OBS Manager → Talent Comms tab — `show-controller/src/components/obs/TalentCommsPanel.jsx` (rendered from `pages/OBSManager.jsx:336`)

**Known gaps:**
- Auto-creating the VDO.Ninja browser source on the VM's OBS is DEFERRED and unimplemented — the producer must add it by hand (`docs/PRD-OBS-10-TalentComms/IMPLEMENTATION-PLAN.md:24`, `:163`)
- Discord is a stub: four null fields, no OAuth/API/tunnel; the route's own doc-comment tells you to SSH-tunnel manually (`server/routes/obs.js:2026-2030`)
- Panel returns "OBS Not Connected — Connect to OBS to manage talent communications" unless `obsConnected`, and every route 503s unless `obsStateSync.isInitialized()` — yet the feature touches only Firebase and needs no OBS at all
- `GET /api/obs/talent-comms/status` and `DELETE /api/obs/talent-comms` are implemented but no UI calls them; there is no way to delete a config from the app
- Hard-coded to exactly two talent slots (`talent-1`/`talent-2`) in the manager, the panel and the templates
- Room password is embedded in plaintext inside `directorUrl`, `statusMonitorUrl` and `obsViewUrls` stored in Firebase; regenerating silently invalidates any URLs already sent to talent and any browser sources already created in OBS
- Talent connection status is derived entirely client-side from a hidden iframe's `postMessage`; it is never persisted or shared, so a second producer's tab sees nothing (`docs/PRD-OBS-10-TalentComms/IMPLEMENTATION-PLAN.md:39-40` lists this as DEFERRED, later partly done under PRD-OBS-11 P3)
- `README-OBS-Architecture.md:347-362` documents a recurring live bug: templates wired to `talentUrls` (push) instead of `obsViewUrls` (view), leaving talent video blank, with manual Firebase repair as the workaround

**Evidence of live use:**
- `docs/PRD-OBS-11-AdvancedFeatures/screenshots/talent-comms-status-full.png`, `talent-comms-status-indicators.png`, `talent-comms-both-talents.png` — panel with VDO.Ninja/Discord toggle and URL section
- `screenshots/obs-manager-talent-comms-tab.png` — the tab in the disconnected/empty state
- `docs/README-OBS-Architecture.md:347-362` — a written-up production failure ("OBS template applies but talent video doesn't display") implying at least one real setup attempt
- No broadcast-level evidence found — nothing ties talent comms to WCGNIC 2026, MPSF 2026 or any ECAC meet

**PRDs / docs:**
- `docs/PRD-OBS-10-TalentComms/PRD-OBS-10-TalentComms.md`
- `docs/PRD-OBS-10-TalentComms/IMPLEMENTATION-PLAN.md` (accurate status: P0/P1 complete, P2/P3 deferred)
- `docs/README-OBS-Architecture.md` § "VDO.Ninja Talent URLs"
- `docs/PRD-OBS-11-AdvancedFeatures/PRD-OBS-11-AdvancedFeatures.md` § Feature 5 (Talent Connection Status)
