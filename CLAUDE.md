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

## Meet Theme System - IMPORTANT (Dual CSS Locations)

**Theme CSS lives in TWO places that must stay in sync:**

| Location | Used By | Scope |
|----------|---------|-------|
| `overlays/theme-overrides.css` | All overlay HTML files (`overlays/*.html`) | Loaded dynamically by `theme-loader.js` |
| `output.html` (inline `<style>`) | Producer view, URL Generator preview | Search for "MEET THEME OVERRIDES" section |

**Why two places?** The overlay HTML files load `theme-overrides.css` via `theme-loader.js`. But `output.html` is a standalone page with its own inline styles — it does NOT load `theme-overrides.css`.

**When making theme CSS changes, you MUST update BOTH locations.** If you only update `theme-overrides.css`, the overlays will look correct but the producer view and URL generator will not reflect the changes.

### Key class name differences

| Overlay class | output.html class | Used in |
|---------------|-------------------|---------|
| `.logo-section` | `.event-bar-logo` | Event bar logo container |
| `.logo-section` | `.warm-up-logo-section` | Warm-up logo container |
| `.logo-section` | `.replay-logo-section` | Replay logo container |

### Logo Contrast Fix
When a theme is active, logo containers get a white background (`rgba(255,255,255,0.92)`) so the logo pops against theme colors. The logo image itself is set to `background: transparent` to avoid box-in-box effect.

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

**Producer view:** When a competition has a custom VM, the producer sidebar shows a "VM Connection" panel with IP, username, and password (with show/hide toggle).

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

### Verification
After adding, check the Media Manager to confirm:
- [ ] Team logo appears
- [ ] Roster is populated (not "No roster defined")
- [ ] Athlete headshots load correctly
