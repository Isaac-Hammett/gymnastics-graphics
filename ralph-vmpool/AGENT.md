# AGENT.md - VM Pool Fix Knowledge

## Production Environment

| Resource | Access |
|----------|--------|
| Production Frontend | https://commentarygraphic.com |
| Production Server IP | 3.87.107.201 |
| Frontend Directory | /var/www/commentarygraphic |
| Coordinator VM | 44.193.31.120 (use "coordinator" shortcut) |
| Coordinator API | https://api.commentarygraphic.com → proxies to 44.193.31.120:3003 |
| Coordinator Port | 3003 (NOT 3001) |

---

## Subagent Parallelization (CRITICAL)

### Research Phase - CAN Parallelize (up to 30 subagents)

Use the `Task` tool to spawn parallel subagents for read-only operations:

```
# Example: Spawn 4 diagnostic subagents in ONE message
Task(subagent_type="Explore", prompt="Search codebase for VMPool components")
Task(subagent_type="general-purpose", prompt="Take screenshot of /_admin/vm-pool")
Task(subagent_type="general-purpose", prompt="Check coordinator API health")
Task(subagent_type="general-purpose", prompt="List current AWS instances")
```

**Safe for parallel:**
- File reads (Read, Glob, Grep)
- Screenshots (browser_navigate, browser_take_screenshot)
- API GET requests
- Firebase reads
- AWS list operations

### Execute Phase - MUST Serialize (1 subagent only)

**NEVER parallelize:**
- npm run build (file locks)
- npm test (port conflicts)
- Deploy operations (server state)
- File writes (potential conflicts)
- PM2 restarts (process conflicts)

**Why:** Parallel builds/deploys cause race conditions, file locks, and flaky results.

---

## Deployment

### Frontend Changes
```bash
# 1. Build
cd show-controller && npm run build

# 2. Package
tar -czf /tmp/claude/dist.tar.gz -C show-controller/dist .

# 3. Upload to production server (NOT coordinator)
ssh_upload_file(target='3.87.107.201', localPath='/tmp/claude/dist.tar.gz', remotePath='/tmp/dist.tar.gz')

# 4. Extract
ssh_exec(target='3.87.107.201', command='rm -rf /var/www/commentarygraphic/* && tar -xzf /tmp/dist.tar.gz -C /var/www/commentarygraphic/ && find /var/www/commentarygraphic -name "._*" -delete')

# 5. Verify
browser_navigate(url='https://commentarygraphic.com')
browser_take_screenshot(filename='screenshots/deploy-verify.png')
browser_console_messages()
```

### Server/API Changes
```bash
# 1. Commit and push changes
git add -A && git commit -m "message" && git push origin dev

# 2. Pull on coordinator
ssh_exec(target='coordinator', command='cd /opt/gymnastics-graphics && git pull origin dev')

# 3. Restart PM2
ssh_exec(target='coordinator', command='pm2 restart coordinator')

# 4. Verify API
ssh_exec(target='coordinator', command='curl -s http://localhost:3003/api/coordinator/status')
```

### nginx Changes (on production server 3.87.107.201)
```bash
# 1. Edit config
ssh_exec(target='3.87.107.201', command='sudo nano /etc/nginx/sites-available/commentarygraphic.com', sudo=true)
# Or use sed/echo to modify

# 2. Test config
ssh_exec(target='3.87.107.201', command='sudo nginx -t', sudo=true)

# 3. Reload
ssh_exec(target='3.87.107.201', command='sudo systemctl reload nginx', sudo=true)

# 4. Verify
browser_navigate(url='https://commentarygraphic.com/vm-pool')
browser_take_screenshot(filename='screenshots/nginx-verify.png')
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

- **Coordinator port is 3003** not 3001 (old references may say 3001)
- **Production frontend is on 3.87.107.201** not coordinator
- **api.commentarygraphic.com proxies to coordinator** via nginx on coordinator VM
- **Always take screenshots** - they are the proof of success/failure
- **Check console messages** - JS errors reveal the real problem
