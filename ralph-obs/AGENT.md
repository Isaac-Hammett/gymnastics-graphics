# AGENT.md - OBS Integration Test Knowledge

## Production Environment

| Resource | Access |
|----------|--------|
| Production Frontend | https://commentarygraphic.com |
| Production Server IP | 3.87.107.201 |
| Frontend Directory | /var/www/commentarygraphic |
| Coordinator VM | 44.193.31.120 (use "coordinator" shortcut) |
| Coordinator API | https://api.commentarygraphic.com → proxies to 44.193.31.120:3003 |
| Coordinator Port | 3003 |

---

## OBS Integration Architecture

### Page Route
- OBS Manager: `/{compId}/obs-manager`
- Example: `https://commentarygraphic.com/abc123/obs-manager`

### Backend Services
- `server/lib/obsStateSync.js` - Real-time OBS state cache
- `server/lib/obsSceneManager.js` - Scene CRUD
- `server/lib/obsSourceManager.js` - Source/input management
- `server/lib/obsAudioManager.js` - Volume, mute, presets
- `server/lib/obsTransitionManager.js` - Transition config
- `server/lib/obsStreamManager.js` - Stream start/stop
- `server/lib/obsAssetManager.js` - Asset upload/management
- `server/lib/obsTemplateManager.js` - Scene templates
- `server/lib/talentCommsManager.js` - VDO.Ninja integration

### API Routes
- `server/routes/obs.js` - All OBS REST endpoints

### Frontend
- `show-controller/src/pages/OBSManager.jsx` - Main page
- `show-controller/src/context/OBSContext.jsx` - React context
- `show-controller/src/components/obs/*` - Sub-components

---

## OBS WebSocket Connection

OBS runs on competition VMs, NOT the coordinator.

### Connection Flow
1. Frontend connects to coordinator via Socket.io
2. Coordinator connects to OBS on competition VM via obs-websocket-js
3. State synced through coordinator to all clients

### Default OBS WebSocket
- Port: 4455
- No authentication by default (can be enabled)

### Checking OBS Connection
```bash
# On a competition VM (not coordinator)
ssh_exec(target=VM_IP, command='pgrep -x obs')           # Check if OBS running
ssh_exec(target=VM_IP, command='netstat -tlnp | grep 4455')  # Check WebSocket port
```

---

## Subagent Parallelization (CRITICAL)

### Diagnostic Phase - CAN Parallelize (up to 20 subagents)

```
# Example: Spawn diagnostic subagents in ONE message
Task(subagent_type="Explore", prompt="Search codebase for OBS routes")
Task(subagent_type="general-purpose", prompt="Take screenshot of homepage")
Task(subagent_type="general-purpose", prompt="Check AWS instances")
Task(subagent_type="general-purpose", prompt="Check coordinator logs")
```

**Safe for parallel:**
- File reads (Read, Glob, Grep)
- Screenshots (browser_navigate, browser_take_screenshot)
- API GET requests
- Firebase reads
- AWS list operations

### Test/Fix Phase - MUST Serialize (1 task only)

**NEVER parallelize:**
- npm run build
- Deploy operations
- OBS commands (may conflict)
- File writes

---

## Deployment

### Frontend Changes
```bash
# 1. Build
cd show-controller && npm run build

# 2. Package
tar -czf /tmp/claude/dist.tar.gz -C show-controller/dist .

# 3. Upload to production server
ssh_upload_file(target='3.87.107.201', localPath='/tmp/claude/dist.tar.gz', remotePath='/tmp/dist.tar.gz')

# 4. Extract
ssh_exec(target='3.87.107.201', command='rm -rf /var/www/commentarygraphic/* && tar -xzf /tmp/dist.tar.gz -C /var/www/commentarygraphic/ && find /var/www/commentarygraphic -name "._*" -delete')

# 5. Verify
browser_navigate(url='https://commentarygraphic.com')
browser_take_screenshot(filename='screenshots/deploy-verify.png')
```

### Server/API Changes
```bash
# 1. Commit and push
git add -A && git commit -m "message" && git push origin dev

# 2. Pull on coordinator
ssh_exec(target='coordinator', command='cd /opt/gymnastics-graphics && git pull origin dev')

# 3. Restart PM2
ssh_exec(target='coordinator', command='pm2 restart coordinator')

# 4. Verify
ssh_exec(target='coordinator', command='curl -s http://localhost:3003/api/coordinator/status')
```

---

## MCP Tools Reference

### SSH
| Tool | Usage |
|------|-------|
| `ssh_exec` | Run command. target: IP or "coordinator" |
| `ssh_upload_file` | Upload file |
| `ssh_download_file` | Download file |

### AWS
| Tool | Usage |
|------|-------|
| `aws_list_instances` | List EC2 instances |
| `aws_start_instance` | Start instance by ID |
| `aws_stop_instance` | Stop instance by ID |

### Firebase
| Tool | Usage |
|------|-------|
| `firebase_get` | Read data at path |
| `firebase_set` | Write data at path |
| `firebase_list_paths` | List children at path |

### Playwright
| Tool | Usage |
|------|-------|
| `browser_navigate` | Load URL |
| `browser_snapshot` | Get element refs for clicking |
| `browser_take_screenshot` | Capture page (REQUIRED for verification) |
| `browser_console_messages` | Get JS console (REQUIRED for verification) |
| `browser_click` | Click element by ref |
| `browser_network_requests` | See failed API calls |

---

## Gotchas

- **OBS runs on competition VMs** not the coordinator
- **OBS WebSocket port is 4455** (default for obs-websocket v5)
- **Coordinator port is 3003** not 3001
- **Always take screenshots** - they are the proof of success/failure
- **Check console messages** - JS errors reveal the real problem
- **Competition must have vmAddress** to connect to OBS

---

## Learnings

(Updated by subagents as they discover new information)

