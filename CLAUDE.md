# Claude Code Memory - Gymnastics Graphics

## Git Workflow - IMPORTANT

**Always work on `dev` branch** - Push to `dev` for development work. Only merge to `main` when ready for production deployment.

- `dev` branch: Active development (push freely)
- `main` branch: Production only (triggers Netlify deploy, costs 15 credits each)

To deploy to production: `git checkout main && git merge dev && git push && git checkout dev`

---

## MCP Tools Available

### Firebase Tools (dev/prod environments)
| Tool | Description |
|------|-------------|
| `firebase_get` | Read data from path |
| `firebase_set` | Write data (overwrites) |
| `firebase_update` | Partial update (merge) |
| `firebase_delete` | Delete data at path |
| `firebase_list_paths` | List child keys |
| `firebase_export` | Export path to JSON |
| `firebase_sync_to_prod` | Copy dev → prod (auto-backup) |

All Firebase tools require `project: "dev"` or `project: "prod"`.

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

## Test Environment (Ralph Wiggum Loop) - IMPORTANT

**ALWAYS use the test environment when making UI changes to show-controller.** This allows unlimited iterations without burning Netlify build credits.

**Test Server**: `http://44.193.31.120:8080`
**Directory on VM**: `/var/www/gymnastics-test`
**Firebase**: Use `project: "dev"` for test data

### When to Use Test Environment
- Any changes to `show-controller/` components
- Testing new graphics overlays
- Verifying Firebase data structure changes
- Before pushing to production

### Deploy to Test Server
```bash
# 1. Build with dev Firebase
cd show-controller && VITE_FIREBASE_ENV=dev npm run build

# 2. Create tarball
tar -czf /tmp/claude/dist.tar.gz -C dist .

# 3. Upload (use ssh_upload_file MCP tool)
# localPath: /tmp/claude/dist.tar.gz
# remotePath: /tmp/dist.tar.gz
# target: coordinator

# 4. Extract (use ssh_exec MCP tool)
# command: sudo rm -rf /var/www/gymnastics-test/* && sudo tar -xzf /tmp/dist.tar.gz -C /var/www/gymnastics-test/ && sudo find /var/www/gymnastics-test -name '._*' -delete

# 5. Verify with Playwright
# browser_navigate to http://44.193.31.120:8080
# browser_take_screenshot
# browser_console_messages (check for errors)
```

**Note:** The test server nginx config proxies `/.netlify/functions/*` to the coordinator API, so the frontend works the same as production.

**After verifying changes work on test server, THEN commit and consider production deploy.**

### Firebase Environment Switching
- `VITE_FIREBASE_ENV=dev` → uses gymnastics-graphics-dev database
- `VITE_FIREBASE_ENV=prod` (or omit) → uses production database

### Production Deploy
When ready for production:
1. `firebase_sync_to_prod` (copies dev data with backup)
2. `git checkout main && git merge dev && git push` (triggers Netlify)
3. `git checkout dev`

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
