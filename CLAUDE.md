# Claude Code Memory - Gymnastics Graphics

## Git Workflow - IMPORTANT

**Always work on `dev` branch** - Push to `dev` for development work.

- `dev` branch: Active development (push freely)
- `main` branch: Production (no longer uses Netlify)

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

```bash
# 1. Build the frontend
cd show-controller && npm run build

# 2. Create tarball
tar -czf /tmp/claude/dist.tar.gz -C dist .

# 3. Upload (use ssh_upload_file MCP tool)
# localPath: /tmp/claude/dist.tar.gz
# remotePath: /tmp/dist.tar.gz
# target: 3.87.107.201

# 4. Extract (use ssh_exec MCP tool)
# target: 3.87.107.201
# command: rm -rf /var/www/commentarygraphic/* && tar -xzf /tmp/dist.tar.gz -C /var/www/commentarygraphic/ && find /var/www/commentarygraphic -name '._*' -delete

# 5. Verify with Playwright
# browser_navigate to https://commentarygraphic.com
# browser_take_screenshot
# browser_console_messages (check for errors)
```

**Note:** SSL auto-renews via Certbot. Certificate expires 2026-04-17.

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
