# Claude Code Memory - Gymnastics Graphics

## Git Workflow - IMPORTANT

**Always work on `main` branch** - Push directly to `main` for production deployments.

- `main` branch: Production - commit and push here so deployments to commentarygraphic.com are always in sync with the repo
- `dev` branch: No longer used (legacy)

---

## MCP Tools Available

### Firebase Tools
| Tool | Description |
|------|-------------|
| `firebase_get` | Read data from path |
| `firebase_set` | Write data (overwrites) |
| `firebase_update` | Partial update (merge) |
| `firebase_delete` | Delete data at path |
| `firebase_list_paths` | List child keys |
| `firebase_export` | Export path to JSON |

### AWS/Infrastructure Tools
| Tool | Description |
|------|-------------|
| `aws_list_instances` | List EC2 instances |
| `aws_start_instance` / `aws_stop_instance` | Control VMs |
| `aws_list_security_group_rules` | View firewall rules |
| `aws_open_port` / `aws_close_port` | Manage ports |
| `ssh_exec` | Run commands on VMs |
| `ssh_upload_file` / `ssh_download_file` | Transfer files |

### Playwright (Browser Testing)
| Tool | Description |
|------|-------------|
| `browser_navigate` | Load URL |
| `browser_take_screenshot` | Capture page |
| `browser_snapshot` | Get element refs |
| `browser_click` | Click elements |
| `browser_type` | Fill form fields |
| `browser_console_messages` | Check for JS errors |

---

## Subagent Parallelization Rules - IMPORTANT

When spawning subagents, follow these rules to avoid resource contention:

| Task Type | Parallelization | Reason |
|-----------|-----------------|--------|
| **File search** (Glob, Grep, Read) | ✅ Fan out freely | Read-only, no conflicts |
| **File writes** (Edit, Write) | ✅ Can parallelize | Different files, no overlap |
| **Build** (npm run build) | ❌ Single subagent | File locks, shared artifacts |
| **Test** (npm test) | ❌ Single subagent | Shared test state, port conflicts |
| **Deploy** (SSH, PM2) | ❌ Single subagent | Server state, restart conflicts |
| **Server verification** (curl) | ❌ Single subagent | Depends on deploy completion |

**Why:** Multiple subagents running build/test/deploy simultaneously cause:
- File lock conflicts (node_modules, dist/)
- Race conditions on shared resources
- Flaky test results
- Bad back-pressure on the system

**Rules:**
- Use parallel subagents for exploration/search (max 20 concurrent)
- Use only ONE subagent for validation (build + test + deploy + verify)

---

## Deploy to Production (commentarygraphic.com)

**Production Server**: `https://commentarygraphic.com`
**Server IP**: `3.87.107.201`
**Directory on VM**: `/var/www/commentarygraphic`

### Step 1: Build and Deploy React SPA
```bash
# Build the frontend
cd show-controller && npm run build

# Create tarball
tar -czf /tmp/claude/dist.tar.gz -C dist .

# Upload (use ssh_upload_file MCP tool)
# localPath: /tmp/claude/dist.tar.gz
# remotePath: /tmp/dist.tar.gz
# target: 3.87.107.201

# Extract (use ssh_exec MCP tool)
# target: 3.87.107.201
# command: rm -rf /var/www/commentarygraphic/* && tar -xzf /tmp/dist.tar.gz -C /var/www/commentarygraphic/ && find /var/www/commentarygraphic -name '._*' -delete
```

### Step 2: Deploy Graphics Files (CRITICAL - DO NOT SKIP)

**These files are NOT part of the React build and must be deployed separately:**

```bash
# Upload output.html (main graphics renderer - from project root)
# localPath: /Users/juliacosmiano/code/gymnastics-graphics/output.html
# remotePath: /tmp/output.html
# target: 3.87.107.201

# Copy to web directory (ssh_exec)
# command: cp /tmp/output.html /var/www/commentarygraphic/output.html

# Upload overlays directory (static overlay HTML files)
tar -czf /tmp/claude/overlays.tar.gz overlays/

# Upload (use ssh_upload_file MCP tool)
# localPath: /tmp/claude/overlays.tar.gz
# remotePath: /tmp/overlays.tar.gz
# target: 3.87.107.201

# Extract overlays (ssh_exec) - IMPORTANT: Fix permissions after extract!
# command: cd /var/www/commentarygraphic && tar -xzf /tmp/overlays.tar.gz && find /var/www/commentarygraphic -name '._*' -delete && chmod 644 /var/www/commentarygraphic/overlays/*
```

**Why this matters:** Without these files, the URL Generator preview will be blank and OBS browser sources won't work. The React SPA will incorrectly intercept requests to `/output.html` and `/overlays/*`.

**IMPORTANT:** The `chmod 644` is required because macOS creates files with 600 permissions when uploaded via SCP, which nginx cannot read (403 Forbidden).

### Step 3: Verify Deployment
```bash
# Verify with Playwright
# browser_navigate to https://commentarygraphic.com
# browser_take_screenshot
# browser_console_messages (check for errors)

# Also verify graphics files are accessible:
# browser_navigate to https://commentarygraphic.com/output.html?graphic=logos
# Should show graphics output page, NOT the React SPA
```

### Deployment Checklist
- [ ] React SPA deployed (`show-controller/dist/`)
- [ ] `output.html` deployed (from project root)
- [ ] `overlays/` directory deployed (from project root)
- [ ] Overlay file permissions set to 644 (`chmod 644 overlays/*`)
- [ ] No console errors on main site
- [ ] URL Generator preview works (including sponsor graphics)

**Note:** SSL auto-renews via Certbot. Certificate expires 2026-04-17.

---

## Unified Theme System

**All graphics use a single theme code path via `theme-loader.js`.**

| File | Purpose |
|------|---------|
| `overlays/theme-loader.js` | Loads theme from Firebase, sets CSS variables + data attributes |
| `overlays/theme-overrides.css` | Theme CSS rules (all graphics reference this) |
| `output.html` inline `<style>` | Legacy fallback during migration (will be removed in Task 1.9) |

### How Theme Loading Works

theme-loader.js supports two initialization paths:

1. **URL param path:** `?meetTheme={themeId}` — direct theme ID (used by URL Generator, debug previews)
2. **Competition config path:** `?comp={compId}` — reads `competitions/{compId}/config/meetTheme` from Firebase (used during live broadcasts)

**Precedence:** `?meetTheme=` always takes priority over `?comp=` config lookup.

### Theme Ready Promise API

theme-loader.js exposes `window.themeReady` — a Promise that resolves when theme loading completes:

```javascript
// Wait for theme before rendering
await window.themeReady;
// or
window.themeReady.then(() => { /* render */ });
```

**Timeout:** If theme fetch takes >3 seconds, the promise resolves with fallback colors and writes an error to Firebase.

### Debug Panel

Add `?debug=theme` to any graphics URL to see a diagnostic overlay:

```
https://commentarygraphic.com/output.html?graphic=event-bar&meetTheme=pink-meet-2026&debug=theme
```

The debug panel shows:
- Theme ID and load status (success/timeout/failed)
- Source: URL parameter vs competition config
- All 8 CSS variables: expected vs actual values (green = match, red = mismatch)
- **Source layer** for each CSS variable (color-coded):
  - Layer 1 (fallback): Gray — using hardcoded default
  - Layer 2 (theme): Blue — using theme default color
  - Layer 3 (override): Purple — using per-graphic override
- Logo data attributes
- Rendering path (iframe vs inline)
- Graphic ID
- Per-graphic overrides: lists active overrides for the current graphic

### Class Name Reconciliation

Elements now have BOTH overlay and output.html class names for compatibility:

| Element | Has Both Classes |
|---------|------------------|
| Event bar logo | `.event-bar-logo` + `.logo-section` |
| Warm-up logo | `.warm-up-logo-section` + `.logo-section` |
| Replay logo | `.replay-logo-section` + `.logo-section` |
| Event bar name | `.event-bar-name` + `.teams-text` |
| Event bar location | `.event-bar-location` + `.location-text` |
| Status rows | `.warm-up-status-row` / `.replay-status-row` + `.status-row` |
| Status text | `.warm-up-status-text` / `.replay-status-text` + `.status-text` |
| Coaches title | `.coaches-title` + `.hosts-title` |

### Logo Contrast Fix
When a theme is active, logo containers get a white background (`rgba(255,255,255,0.92)`) so the logo pops against theme colors. The logo image itself is set to `background: transparent` to avoid box-in-box effect.

**Note:** Inline CSS in output.html is kept as a fallback during migration. After live-event verification, Task 1.9 removes the redundant inline CSS.

---

## Theme Error Reporting

When theme loading fails (timeout, theme not found, Firebase error), errors are written to Firebase for producer visibility.

### Firebase Path
```
competitions/{compId}/production/themeErrors/{timestamp}
```

### Error Format
```json
{
  "type": "timeout" | "not_found" | "fetch_error",
  "themeId": "pink-meet-2026",
  "compId": "wcgnic-2026-prelim1",
  "source": "overlay:sponsors-thanks" | "output.html",
  "message": "Theme fetch timed out after 3000ms",
  "url": "https://commentarygraphic.com/overlays/sponsors-thanks.html?...",
  "timestamp": "2026-03-26T10:30:00.000Z",
  "resolved": false
}
```

### Producer View

The **ThemeErrorLog** component in ProducerView shows:
- Red badge with error count (e.g., "Theme: 2 errors") in the header
- Click to expand panel with error details
- Copy button per error for easy debugging
- "Dismiss All" clears errors from Firebase

### Key Files

| Component | File |
|-----------|------|
| Error log hook | `show-controller/src/hooks/useThemeErrors.js` |
| Error log UI | `show-controller/src/components/ThemeErrorLog.jsx` |
| Producer view integration | `show-controller/src/views/ProducerView.jsx` |

---

### Theme CSS Variables
```
--meet-header-bg    : Header bar background
--meet-content-bg   : Content area background (below header)
--meet-header-text  : Header bar text
--meet-overlay-bg   : Full-screen / body background
--meet-overlay-text : Content/body text
--meet-border-color : Borders and dividers
--meet-badge-bg     : Badges/labels background
--meet-badge-text   : Badges/labels text
```

### Per-Graphic Overrides

Override any theme color for a specific graphic type. Overrides use a 3-layer CSS variable cascade:

```
Layer 3 (highest): Per-graphic override  → --{graphicId}-header-bg
Layer 2:           Theme default         → --meet-header-bg
Layer 1 (lowest):  Hardcoded fallback    → #BFBFBF
```

**CSS resolution:**
```css
var(--event-bar-header-bg,    /* Layer 3: per-graphic override */
  var(--meet-header-bg,       /* Layer 2: theme default */
    #BFBFBF                   /* Layer 1: fallback */
  )
)
```

**Firebase path:** `themes/{themeId}/overrides/{graphicId}/`

**Supported override properties:**

| Firebase Key | CSS Variable | Description |
|-------------|--------------|-------------|
| `headerBar` | `--{graphicId}-header-bg` | Header bar background |
| `contentArea` | `--{graphicId}-content-bg` | Content area background |
| `bodyBackground` | `--{graphicId}-overlay-bg` | Full-screen background |
| `borderDivider` | `--{graphicId}-border-color` | Borders and dividers |
| `badge` | `--{graphicId}-badge-bg` | Badge background |
| `badgeText` | `--{graphicId}-badge-text` | Badge text |
| `textOnHeader` | `--{graphicId}-header-text` | Header text |
| `textOnContent` | `--{graphicId}-overlay-text` | Content text |
| `headerBgImage` | `--{graphicId}-header-bg-image` | Header background image URL |
| `headerBgImageFit` | `--{graphicId}-header-bg-image-fit` | Image fit: cover/contain |
| `headerBgImagePosition` | `--{graphicId}-header-bg-image-position` | Image position |
| `headerBgImageOpacity` | `--{graphicId}-header-bg-image-opacity` | Image opacity (0-1) |
| `bodyBgImage` | `--{graphicId}-body-bg-image` | Body background image URL |
| `bodyTexture` | `--{graphicId}-body-texture` | Texture overlay URL |
| `bodyTextureOpacity` | `--{graphicId}-body-texture-opacity` | Texture opacity |
| `bodyTextureBlend` | `--{graphicId}-body-texture-blend` | Blend mode: overlay/multiply/normal |
| `logo` | `--{graphicId}-logo-url` | Logo URL override |
| `logoSize` | `--{graphicId}-logo-size` | Logo size in px |

**Graphic ID detection:**

| Context | Detection Method |
|---------|-----------------|
| Overlay file | Extract from `window.location.pathname` (e.g., `/overlays/sponsors-thanks.html` → `sponsors-thanks`) |
| output.html preview | Read `?graphic=` URL param (e.g., `?graphic=event-bar` → `event-bar`) |
| output.html clip mode | Check `?mode=clip` or `?mode=clip-preview` → `clip-overlay` |
| output.html live mode | Cannot detect at load time — handled in `currentGraphic` listener |

**No additional Firebase reads:** Overrides are fetched as part of the existing theme subtree read — `themes/{themeId}` includes the `overrides` object.

**Debug panel (with override info):** Add `?debug=theme` to any graphics URL. The debug panel now shows the source layer for each CSS variable:
- **Layer 1 (fallback)**: Gray — using hardcoded default value
- **Layer 2 (theme)**: Blue — using theme default color
- **Layer 3 (override)**: Purple — using per-graphic override

### Theme Sponsors - IMPORTANT

**Sponsors must be added to the theme itself**, not just the team database. Theme-level sponsors are used by sponsor graphics (cycle, bug, thanks) when a theme is applied.

- **Team-level sponsors** (`teamsDatabase/sponsors/{team-key}`) — used for regular season meets
- **Theme-level sponsors** (`themes/{themeId}/sponsors`) — used when a meet theme is active

If a championship theme has no `sponsors` array, sponsor overlays will be **blank** even if the host team has sponsors configured.

**Format:** `themes/{themeId}/sponsors` is an array of `{ "name": "...", "url": "..." }` objects.

**When creating a new championship/event theme:**
1. Identify which team or organization is providing sponsors
2. Copy sponsors into the theme's `sponsors` array
3. Verify sponsor graphics render with the theme applied

---

## Coordinator Server (api.commentarygraphic.com)

**Server IP**: `44.193.31.120`
**Directory on VM**: `/opt/gymnastics-graphics`
**Process Manager**: PM2

The coordinator server handles:
- Socket.io connections for real-time updates
- Rundown loading and show execution (timesheet engine)
- OBS scene switching commands
- Multi-competition coordination

### Check Server Status
```bash
# SSH to coordinator
ssh_exec target: 44.193.31.120

# Check PM2 status
pm2 status

# View logs
pm2 logs coordinator --lines 50
```

### Restart Coordinator (CRITICAL - Firebase Credentials Required)

**IMPORTANT:** The coordinator requires Firebase Admin SDK credentials. If you restart PM2 without the credentials, the server will fail to load rundowns and other Firebase operations.

```bash
# SSH to coordinator
cd /opt/gymnastics-graphics/server

# Stop existing process
pm2 delete coordinator

# Start with Firebase credentials (REQUIRED)
GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 start index.js --name coordinator

# Save PM2 config for auto-restart on reboot
pm2 save
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| PM2 crash-looping (high restart count) | Port 3003 already in use | `sudo fuser -k 3003/tcp` then restart PM2 |
| "Load Rundown" stuck on loading | Firebase credentials not set | Restart with `GOOGLE_APPLICATION_CREDENTIALS` env var |
| "Load Rundown" stuck on loading (credentials OK) | OBS VM unreachable, blocking socket handler registration | See BUG-021 — never `await` slow ops in `io.on('connection')` before registering `socket.on()` handlers |
| Socket disconnects | PM2 process crashed | Check `pm2 logs`, restart if needed |

### Socket.io Connection Handler — IMPORTANT

**Never `await` slow or external operations inside `io.on('connection', async (socket) => { ... })` before registering `socket.on(...)` event handlers.** Any `await` that can timeout (OBS connections, external APIs) creates a window where client events are silently dropped because the handlers don't exist yet. The client sees "Connected" but events go nowhere.

**Pattern to follow:**
```javascript
io.on('connection', async (socket) => {
  // 1. Register ALL socket.on() handlers FIRST (synchronous)
  socket.on('loadRundown', handler);
  socket.on('startShow', handler);

  // 2. THEN do async initialization (fire-and-forget)
  someSlowOperation().then(...).catch(...);
});
```

**See:** [BUG-021](docs/PRD-Rundown-System/BUGS.md#bug-021) for the full incident report.

### Verify Coordinator is Working
```bash
# Check the server is responding
curl http://44.193.31.120:3003/health

# Check PM2 shows 0 restarts and "online" status
pm2 status
```

---

## VM Pool & Custom VMs

The VM Pool manages EC2 instances for live production streaming. VMs are assigned to competitions and provide OBS + Node services.

### VM Types

| Type | Description | Actions |
|------|-------------|---------|
| **AWS VM** | EC2 instance managed by our account | Start, Stop, Assign, Release, Terminate |
| **Custom VM** | Externally-managed VM (not in our AWS) | Assign, Release, Delete |

### Custom VMs

Custom VMs allow producers to register externally-hosted VMs by providing IP, username, and password. They appear in the VM Pool alongside AWS VMs and can be assigned to competitions.

**Creating:** VM Pool Page > "Add Custom VM" button (teal) > fill IP, username, password

**Multi-Assignment:** Unlike AWS VMs (single competition only), custom VMs can be assigned to **multiple competitions simultaneously**. The `assignedTo` field uses an array instead of a string. The VM card shows all assigned competitions with individual release buttons for each.

**Firebase structure** at `vmPool/vms/custom-{id}/`:
```json
{
  "isCustom": true,
  "name": "Client Studio VM",
  "publicIp": "203.0.113.50",
  "username": "producer",
  "password": "pass123",
  "status": "assigned",
  "assignedTo": ["comp-id-1", "comp-id-2"]
}
```

Note: `assignedTo` is `null` when unassigned, and an array of competition IDs when assigned. AWS VMs still use a single string for `assignedTo`.

**When assigned to a competition**, credentials are stored at:
```
competitions/{compId}/config/vmAddress: "203.0.113.50:3003"
competitions/{compId}/config/vmCredentials: { username, password }
```

**Producer view:** When a competition has a custom VM, the producer sidebar shows a "VM Connection" panel with IP, username, and password (with show/hide toggle and copy-to-clipboard button).

**Copy buttons:** Both the VM Card (`VMCard.jsx`) and Producer View (`ProducerView.jsx`) have a clipboard copy button next to the password field for easy copying.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/vm-pool` | GET | List all VMs (AWS + custom) |
| `/api/admin/vm-pool/launch` | POST | Launch new AWS VM from AMI |
| `/api/admin/vm-pool/custom` | POST | Create custom VM (`{ name, ip, username, password }`) |
| `/api/admin/vm-pool/:vmId/start` | POST | Start stopped AWS VM |
| `/api/admin/vm-pool/:vmId/stop` | POST | Stop AWS VM |
| `/api/admin/vm-pool/:vmId` | DELETE | Terminate AWS VM or delete custom VM |
| `/api/competitions/:compId/vm/assign` | POST | Assign VM to competition |
| `/api/competitions/:compId/vm/release` | POST | Release VM from competition |
| `/api/admin/themes` | GET | List all themes |
| `/api/admin/themes/:themeId` | PUT | Create or update a theme |
| `/api/admin/themes/:themeId` | DELETE | Delete a theme |

### Key Files

| Component | File |
|-----------|------|
| VM Pool Manager (backend) | `server/lib/vmPoolManager.js` |
| VM Health Monitor | `server/lib/vmHealthMonitor.js` |
| AWS Service | `server/lib/awsService.js` |
| API Routes | `server/index.js` (search "vm-pool") |
| VM Pool Page (admin UI) | `show-controller/src/pages/VMPoolPage.jsx` |
| VM Card Component | `show-controller/src/components/VMCard.jsx` |
| VM Pool Hook | `show-controller/src/hooks/useVMPool.js` |
| Producer View (VM panel) | `show-controller/src/views/ProducerView.jsx` |

### Important: Custom VM Guards

- **AWS sync**: `_syncWithAWS()` skips VMs with `isCustom: true` so they aren't deleted during EC2 reconciliation
- **Start/Stop**: Backend throws error if called on custom VMs
- **Health checks**: Skipped for custom VMs (no service monitoring)
- **Multi-assignment**: Custom VMs use `assignedTo` as an array; all `assignedTo` checks must handle both string (AWS) and array (custom) forms using `Array.isArray()`
- **Release**: `releaseVM()` removes only the specified competition from the array; status returns to `AVAILABLE` only when the array is empty
- **Credentials cleanup**: `releaseVM()` clears `vmAddress` and `vmCredentials` for the released competition only
- **Delete guard**: Custom VMs cannot be deleted while they have any assignments (array length > 0)

---

## Clip Integration (Autonomous Playout)

The clip integration system turns multi-camera gymnastics feeds into a single broadcast stream with autonomous clip replay.

### How It Works

1. **Set the Clips API URL** on the competition (Dashboard > Edit Competition > "Clip Engine" section)
   - Paste the full deliveries URL: `https://{host}/clip-api/meets/{sessionKey}/deliveries`
   - The server parses out the base URL and session key automatically

2. **Add playout segments** to the rundown (Rundown Editor > segment type = "Playout")
   - Configure playout rules: clip order, transitions, gap fill sequence
   - No need to set URL/key per segment — inherited from competition config

3. **When the show reaches a playout segment**, the timesheet engine emits `playoutStarted` which starts the playout engine automatically. The playout engine:
   - Reads `meetTheme` from competition config at startup (cached for the session)
   - Fetches clips from the Clip Engine API (polls every 15s)
   - Manages a clip queue with priority stack evaluation
   - Includes `meetTheme` in all `_writeCurrentGraphic()` calls (clip-playback, moment-replay, fallback, rotation-break, live-camera, content sequence items)
   - Broadcasts state to the Producer View via socket (shows PlayoutStatusBar, ClipQueuePanel, PlayoutControls)
   - Stops automatically when the rundown advances past the playout segment

**Theme propagation:** All graphics triggered by PlayoutEngine receive the competition's theme. Iframe-rendered overlays (sponsor graphics in gap-fill sequences) get `meetTheme` as a URL param via output.html's renderers.

### Key Files

| Component | File |
|-----------|------|
| Playout Engine (server) | `server/lib/playoutEngine.js` |
| Clip Service (API adapter) | `server/lib/clipService.js` |
| Timesheet integration | `server/lib/timesheetEngine.js` (`PLAYOUT` segment type) |
| Socket bridge | `server/index.js` (`playoutStarted`/`playoutStopped` events) |
| Producer playout UI | `show-controller/src/components/playout/` (6 components) |
| Playout state hook | `show-controller/src/hooks/usePlayoutState.js` |
| Playout actions hook | `show-controller/src/hooks/usePlayoutActions.js` |
| Playout rules editor | `show-controller/src/components/playout/PlayoutRulesEditor.jsx` |
| Competition config (URL) | `show-controller/src/pages/HomePage.jsx` (Clip Engine section) |
| Video playback | `output.html` (`?mode=clip`) |

### Firebase Paths

| Path | Description |
|------|-------------|
| `competitions/{compId}/config/clipApiUrl` | Full deliveries URL for the Clip Engine API |
| `competitions/{compId}/production/playoutState` | Persisted engine state (mode, overrides, current clip) |
| `competitions/{compId}/production/clipQueue` | Persisted clip queue (recovery after restart) |
| `competitions/{compId}/production/clipStatus/{draftId}` | Write-back from output.html (clip_ended, clip_stalled, clip_failed) |
| `competitions/{compId}/production/engineHeartbeat` | Health monitoring (timestamp + mode every 5s) |

### Playout Modes

`CLIP` → `LIVE` → `MOMENT_REPLAY` → `FALLBACK` → `BREAK` → `OVERRIDE` → `PAUSED`

The engine evaluates a priority stack every tick to decide which mode to be in.

---

## Who to Watch (Title Card Overlay)

The "Who to Watch" feature creates ESPN-style full-screen title cards for athlete spotlights.

### Key Files

| Component | File |
|-----------|------|
| Title card overlay | `overlays/who-to-watch-title.html` |
| Editor component | `show-controller/src/components/playout/WhoToWatchEditor.jsx` |

### Title Card Adjustment Query Params

The overlay reads these optional query params for per-card fine-tuning. All controls use stepper inputs (`- [value] +`) with no upper limits — producers can type any value directly.

**Theme / Background**

| Param | Default | Effect |
|-------|---------|--------|
| `meetTheme` | (from competition) | Theme ID — loads colors from Firebase via `theme-loader.js` |
| `bgColor` | (from theme) | Hex color override for `--meet-header-bg` (applied after theme-loader) |
| `accentColor` | (from theme) | Hex color override for `--meet-content-bg` (headline bar, accent line, bottom stripe) |

**Badge ("WHO TO WATCH" label)**

| Param | Default | Effect |
|-------|---------|--------|
| `badge` | `Who to Watch` | Badge text. Empty string (`badge=`) hides the badge entirely |
| `badgeFontSize` | 13px | Badge font size |

**Team Row (logo + team name)**

| Param | Default | Effect |
|-------|---------|--------|
| `teamNameFontSize` | 20px | Team name font size |
| `logoSize` | 48px | Inline team logo size (width & height) |
| `showTeamRow` | `true` | Set to `false` to hide team row entirely |

**Text**

| Param | Default | Effect |
|-------|---------|--------|
| `nameFontSize` | 110px | Athlete name font size |
| `bodyFontSize` | 32px | Body text font size |
| `headlineFontSize` | 34px | Headline bar font size |
| `textOffsetY` | 0 | Shift text side up (negative) or down (positive) in px |

**Athlete Image**

| Param | Default | Effect |
|-------|---------|--------|
| `imageScale` | 100% | Scale athlete image (no upper limit) |
| `imageOffsetX` | 0 | Shift image left/right in px |
| `imageOffsetY` | 0 | Shift image up/down in px |

**Watermark (large team logo behind content)**

| Param | Default | Effect |
|-------|---------|--------|
| `watermarkOpacity` | 8% | Watermark opacity (0 = invisible) |
| `watermarkScale` | 100% | Watermark size multiplier |
| `watermarkOffsetX` | 0 | Shift watermark left/right in px |
| `watermarkOffsetY` | 0 | Shift watermark up/down in px |
| `showWatermark` | `true` | Set to `false` to hide watermark entirely |

### Editor Card Adjustments Panel

All params above are exposed in the editor via a collapsible "Card Adjustments" section inside each title card. Controls are organized into groups: **THEME**, **BADGE**, **TEAM**, **TEXT**, **IMAGE**, **WATERMARK**. Values are stored per-card in the `titleCards` array and passed as URL params to the live iframe preview (debounced at 300ms).

The theme dropdown fetches available themes from Firebase (`themes/`) and lets the producer preview different themes without changing the competition config. Background and accent color pickers override theme colors when set.

### Technical Notes

- **Image overflow**: `.image-side` uses `overflow: visible` so scaled/offset images aren't clipped. The `body` element clips at 1920x1080.
- **Theme color overrides**: Applied via `setTimeout(600ms)` after `theme-loader.js` runs (theme-loader fires no events/callbacks).
- **ValueStepper component**: Reusable `- [input] +` stepper used for all numeric controls. Uses local text state for the input so backspace/delete works freely. On blur, empty input reverts to default.

---

## Competition Formats

### Alternating Format (Default for Dual Meets - used in "By Rotation" view)
Teams start on adjacent apparatus and swap each rotation:
- R1: Home=FX, Away=PH | R2: Home=PH, Away=FX
- R3: Home=SR, Away=VT | R4: Home=VT, Away=SR
- R5: Home=PB, Away=HB | R6: Home=HB, Away=PB

### Head-to-Head Format (used in "By Apparatus" view)
Both teams compete on the SAME apparatus - used when viewing event summary by apparatus (FX, PH, SR, VT, PB, HB buttons).

## Olympic Order

### Men's Gymnastics (6 events)
1. Floor Exercise (FX)
2. Pommel Horse (PH)
3. Still Rings (SR)
4. Vault (VT)
5. Parallel Bars (PB)
6. High Bar (HB)

### Women's Gymnastics (4 events)
1. Vault (VT)
2. Uneven Bars (UB)
3. Balance Beam (BB)
4. Floor Exercise (FX)

## API Event Names (Virtius)
- Men's: FLOOR, HORSE, RINGS, VAULT, PBARS, BAR
- Short codes: FX, PH, SR, VT, PB, HB

## Competition Types
- mens-dual, womens-dual (2 teams) - defaults to head-to-head format
- mens-tri, womens-tri (3 teams)
- mens-quad, womens-quad (4 teams)
- mens-5, mens-6 (5-6 teams)
- womens-5, womens-6, womens-7 (5-7 teams)
  - womens-7: 7 rotations, 4 apparatus, 4 teams compete per rotation, 3 teams on bye each rotation

---

## Multi-Team Rotation Handling (5+ Teams) - IMPORTANT

For competitions with 5 or more teams, **DO NOT use hardcoded rotation schedules**. The Virtius API provides a `rotation` field on each event that indicates which rotation it was scored in.

### Why Hardcoded Schedules Don't Work
- Different meets have different starting positions for teams
- Teams don't compete in olympic order
- Hardcoded schedules assume a fixed rotation pattern that varies by meet

### The Correct Approach
The `detectEventFromApiData()` function in `output.html` reads the rotation field directly from the Virtius API:

```javascript
function detectEventFromApiData(team, rotation, gender) {
  // Virtius API includes a 'rotation' field on each event
  const eventForRotation = (team.events || []).find(e => e.rotation === rotation);
  if (eventForRotation) {
    return eventForRotation.event_name;
  }
  return null; // Team has a bye or rotation hasn't happened
}
```

### Virtius API Event Structure
Each team's events array contains objects with:
- `event_name`: "FLOOR", "HORSE", "RINGS", "VAULT", "PBARS", "BAR"
- `rotation`: 1-6 (which rotation this event is competed in)
- `gymnasts`: Array of gymnast scores
- `event_score`: Team's total for this event

### Example (5-Team Meet)
```
| Team      | FLOOR | HORSE | RINGS | VAULT | PBARS | BAR |
|-----------|-------|-------|-------|-------|-------|-----|
| Stanford  |   4   |   5   |   6   |   1   |   2   |  3  |
| California|   6   |   1   |   2   |   3   |   4   |  5  |
| USA       |   3   |   4   |   5   |   6   |   1   |  2  |
| Mexico    |   1   |   2   |   3   |   4   |   5   |  6  |
| All Stars |   5   |   6   |   1   |   2   |   3   |  4  |
```

This means for R1: Stanford=VAULT, California=HORSE, USA=PBARS, Mexico=FLOOR, All Stars=RINGS

### Related Bug Fixes
- BUG-003: Men's Tri Event Summary Blank
- BUG-004: 5-Team Men's Event Summary Missing Apparatus

---

## Adding a New Team - Checklist

When adding a new team to the database, **all three steps must be completed**:

### Step 1: Add Team Entry
```
Path: teamsDatabase/teams/{team-key}
```
Required fields:
- `displayName`: "School Name Men's" or "School Name Women's"
- `gender`: "mens" or "womens"
- `logo`: Virtius URL (e.g., `https://media.virti.us/upload/images/team/...`)
- `school`: "School Name"
- `roster`: Array of athlete names (e.g., `["First Last", "First Last", ...]`)
- `league`: (optional) `"ncaa"` (default) or `"gymact"` — determines which RTN results endpoint to use for stats
- `updatedAt`: ISO timestamp

**Example:**
```json
{
  "displayName": "UW-Whitewater Women's",
  "gender": "womens",
  "logo": "https://media.virti.us/upload/images/team/CbWKimoC_0RpBy-M-lcSy",
  "school": "UW-Whitewater",
  "roster": ["Athlete One", "Athlete Two"],
  "updatedAt": "2026-01-17T00:00:00.000Z"
}
```

### Step 2: Add Athlete Headshots
```
Path: teamsDatabase/headshots/{normalized-name-with-spaces}
```

**CRITICAL: Headshot keys use SPACES, not underscores.**
The key is `normalizeName(name)` which lowercases and keeps spaces.
- Correct: `teamsDatabase/headshots/alexis schulman`
- WRONG: `teamsDatabase/headshots/alexis_schulman`

`getSafeFirebaseKey()` only replaces `.#$[]/` — it does NOT replace spaces with underscores. Firebase allows spaces in keys.

Required fields:
- `name`: "First Last" (proper case)
- `teamKey`: "{school}-mens" or "{school}-womens"
- `url`: Virtius URL (e.g., `https://media.virti.us/upload/images/athlete/...`)
- `updatedAt`: ISO timestamp

### Step 3: Add Aliases (Optional)
```
Path: teamsDatabase/aliases/{alias-lowercase}
```
Value: team key without gender suffix (e.g., "uw-whitewater")

Common aliases: full university name, abbreviations, mascot names

### Step 4: Add Athlete Media (Optional)
```
Path: teamsDatabase/media/{normalized-name-with-spaces}
```

Additional images beyond headshots (portrait photos, action shots, full-body media day images). Used by the "Who to Watch" title card overlay for ESPN-style athlete cutouts.

**Keys use the same normalization as headshots** — `normalizeName()` + `getSafeFirebaseKey()`.

Value is an **array** of image objects:
```json
[
  { "url": "https://...", "type": "portrait", "label": "Media Day 2026", "updatedAt": "..." }
]
```

Image types: `portrait`, `action`, `full-body`, `custom`

**How to add:** Media Manager → expand a team → click an athlete → use the "Add Image" form (URL, type, label).

**Hook functions:** `getAthleteMedia(name)`, `saveAthleteMedia(name, url, type, label)`, `deleteAthleteMedia(name, index)` — all in `useTeamsDatabase`.

### Verification
After adding, check the Media Manager to confirm:
- [ ] Team logo appears
- [ ] Roster is populated (not "No roster defined")
- [ ] Athlete headshots load correctly
- [ ] Athlete gallery images appear when athlete row is expanded (rose border)

---

## Composite Teams (Individual Qualifiers at Championships) - IMPORTANT

At championship events (WCGNIC, USAG Regionals, etc.), individual qualifiers from non-qualifying teams are grouped under a **placeholder team** in Virtius (e.g., "WCGNIC"). These athletes compete under the event's banner but their stats live with their original teams.

### How It Works

The RTN stats system supports **composite teams** — placeholder team slots that pull individual athlete data from multiple source teams.

**Firebase config:**
```
competitions/{compId}/compositeTeams/
  team4/                              -- matches the team slot (team4, team5, etc.)
    athletes/
      0: { name: "Amy Foret", sourceTeamKey: "centenary-womens" }
      1: { name: "Amara Nelson", sourceTeamKey: "greenville-womens" }
      ...
```

**What happens during stats ingestion:**
1. `ingestCompetitionStats` checks `compositeTeams/{teamSlot}` before looking up `rtnId`
2. If composite config exists, calls `assembleCompositeTeamStats()` instead of normal ingestion
3. Reads `individualHighs`, `individualAverages`, `mvp` from each source team's stats
4. Filters to only the named athletes (case-insensitive name match)
5. Writes synthetic stats to `teamsDatabase/stats/{placeholderTeamKey}/` with `meta.status: "composite"`
6. `syncStatsToConfig` computes approximate Ave/High from individual data (existing fallback path)

### Setting Up a Composite Team

1. Create the placeholder team entry in Firebase (just needs `displayName`, `gender`, `logo`)
2. Set `team{N}Key` in the competition config to the placeholder key
3. Write the `compositeTeams/team{N}` config with athlete-to-source-team mappings
4. Ensure all source teams exist in `teamsDatabase/teams/` with valid `rtnId`
5. Run stats refresh — composite assembly will auto-detect and pull athlete data

### Key Files

| Component | File |
|-----------|------|
| Assembly function | `server/lib/rtnStatsService.js` — `assembleCompositeTeamStats()` |
| Detection in ingestion | `server/lib/rtnStatsService.js` — `ingestCompetitionStats()` |
| PRD spec | `docs/PRD-RTN-Stats-Integration/PRD-RTN-Stats-Integration-2026-02-01.md` — Phase 9 |

### Example: WCGNIC 2026 Session 1

- `team4Key`: `wcgnic-womens` (placeholder)
- `compositeTeams/team4/athletes`: 8 athletes from Centenary, Greenville, Wilberforce
- Source teams all have complete RTN stats with `rtnId` set
- Assembly filters to named athletes and writes to `teamsDatabase/stats/wcgnic-womens/`
