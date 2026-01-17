# PRD: Test Infrastructure Isolation

## Executive Summary

This document outlines the plan to separate the test application environment from the coordinator VM. Currently, both the coordinator service (port 3001) and the test application (port 8080) run on the same EC2 instance (44.193.31.120). This creates architectural confusion and couples test infrastructure to production coordination. The solution is to provision a dedicated EC2 instance for testing purposes.

---

## Problem Statement

### Current Architecture

**Single EC2 Instance (Coordinator VM)** hosts two services:
- **IP Address**: 44.193.31.120 (Elastic IP)
- **Instance ID**: i-001383a4293522fa4
- **Instance Type**: t3.small

| Service | Port | Purpose |
|---------|------|---------|
| Coordinator API | 3001 | Manages AWS infrastructure, VM pool, and communicates status to web app |
| Test Application | 8080 | Serves dev branch builds for Playwright testing via nginx |

**Current nginx Configuration** (`/etc/nginx/sites-available/gymnastics-test`):
```nginx
server {
    listen 8080;
    server_name _;
    root /var/www/gymnastics-test;
    index index.html;

    # Return static JSON for coordinator-status (hardcoded as "running")
    location = /.netlify/functions/coordinator-status {
        default_type application/json;
        add_header Access-Control-Allow-Origin *;
        return 200 '{"success":true,"state":"running","appReady":true,"publicIp":"44.193.31.120"}';
    }

    # Proxy wake/stop to coordinator API
    location = /.netlify/functions/wake-coordinator {
        proxy_pass http://127.0.0.1:3001/api/coordinator/wake;
        # ... headers ...
    }

    location = /.netlify/functions/stop-coordinator {
        proxy_pass http://127.0.0.1:3001/api/coordinator/stop;
        # ... headers ...
    }

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Test Application Details**:
- Directory: `/var/www/gymnastics-test` (owned by `www-data:www-data`)
- Web server: nginx on port 8080
- Used by: `ralph.sh` (Ralph Wiggum Loop) for automated UI iteration
- Proxies Netlify functions to local coordinator (127.0.0.1:3001)

**MCP Server** (`tools/mcp-server/index.js`):
- Playwright MCP: `@playwright/mcp@latest` (headless browser automation)
- Gymnastics MCP: Custom server with AWS, SSH, and Firebase tools
- SSH target shortcut: `"coordinator"` → `44.193.31.120`
- SSH key: `~/.ssh/gymnastics-graphics-key-pair.pem`
- SSH username: `ubuntu`

**Coordinator Auto-Shutdown** (`server/lib/autoShutdown.js`):
- Enabled when `COORDINATOR_MODE=true`
- Default timeout: 120 minutes (via `AUTO_SHUTDOWN_MINUTES` env var)
- Checks for active streams before shutdown
- Broadcasts `shutdownPending` event to connected clients
- Logs shutdown events to Firebase (`coordinator/shutdownHistory`)

**Branch Strategy**:
- `main` branch → Netlify (production at commentarygraphic.com)
- `dev` branch → EC2 test instance (currently on coordinator VM)

**Firebase Strategy**:
- Production: `gymnastics-graphics` project
- Development: `gymnastics-graphics-dev` project
- Frontend env var: `VITE_FIREBASE_ENV=dev|prod`

### Problems with Current Setup

1. **State Confusion**: The coordinator service cannot differentiate between real application instances and test instances running on the same machine

2. **Tight Coupling**: Test infrastructure is coupled to production infrastructure, creating fragility

3. **Resource Contention**: Test runs could potentially impact coordinator performance

4. **Debugging Complexity**: When issues arise, it's harder to isolate whether problems stem from test activity or coordinator activity

5. **Coordinator Lifecycle Conflict**: Coordinator VM may auto-shutdown after inactivity (120 min default), interrupting ongoing test sessions

6. **Localhost Proxy Dependency**: Test nginx proxies to `127.0.0.1:3001` - this won't work when test VM is separate from coordinator

---

## Proposed Solution

### Target Architecture

**VM 1: Coordinator VM (Existing - Unchanged)**
- IP: 44.193.31.120 (Elastic IP)
- Instance ID: i-001383a4293522fa4
- Instance Type: t3.small
- Services: Coordinator API on port 3001 only
- No test workloads running on this machine
- Auto-shutdown: 120 minutes (existing behavior)

**VM 2: Test VM (New)**
- New EC2 instance dedicated to testing
- Instance type: t3.micro (sufficient for static file serving)
- **Elastic IP**: Required for stable addressing
- **Tagging**: `Project: gymnastics-graphics` (appears in `aws_list_instances`)
- Serves compiled dev branch application
- Connected to dev Firebase backend
- **Auto-shutdown**: Enabled (same mechanism as coordinator, adapted for test VM)
- Independent lifecycle from coordinator

**MCP Server Updates**:
- Add new SSH target shortcut: `"test"` → `<new-test-vm-elastic-ip>`
- Keep `"coordinator"` shortcut unchanged
- Playwright tests target new Test VM URL

### Cost Analysis

| Component | Current | After Migration |
|-----------|---------|-----------------|
| Coordinator VM | ~$15/mo (t3.small) | ~$15/mo (unchanged) |
| Test VM | $0 (shared) | ~$4/mo (t3.micro) |
| Elastic IP | N/A | ~$3.65/mo (when VM stopped) |
| **Total** | ~$15/mo | ~$19-23/mo |

Note: Elastic IP is free when attached to a running instance. Cost only applies when VM is stopped but IP retained.

---

## Requirements

### Functional Requirements

#### FR-1: New EC2 Instance Provisioning
- [ ] Launch t3.micro instance in us-east-1
- [ ] Use Ubuntu 22.04 LTS AMI (same as coordinator)
- [ ] Add to security group `sg-025f1ac53cccb756b` (gymnastics-vm-pool)
- [ ] **Tag with `Project: gymnastics-graphics`** (required for `aws_list_instances`)
- [ ] **Tag with `Name: gymnastics-test-vm`**
- [ ] **Assign Elastic IP** for stable addressing

#### FR-2: Test Server Configuration
- [ ] Install nginx for static file serving
- [ ] Configure nginx to serve `/var/www/gymnastics-test` on port 8080
- [ ] **Configure nginx to proxy `/.netlify/functions/*` to coordinator at 44.193.31.120:3001** (not localhost)
- [ ] Return hardcoded coordinator-status response (test doesn't need wake/sleep UI)
- [ ] Install Node.js 20.x (for any build-time needs)

#### FR-3: Auto-Shutdown for Test VM
Since the test VM doesn't run the coordinator service, implement a simpler auto-shutdown:
- [ ] Create a cron-based idle detector script
- [ ] Track last modification time of `/var/www/gymnastics-test`
- [ ] Stop instance after 60 minutes of no deployments
- [ ] Alternative: Use AWS Instance Scheduler or Lambda-based shutdown

#### FR-4: MCP Server Updates
Update `tools/mcp-server/index.js`:
- [ ] Add `testVmIp` to CONFIG object
- [ ] Add `"test"` as a target shortcut in `resolveTarget()`
- [ ] Update tool descriptions/comments

#### FR-5: CLAUDE.md Updates
Update deployment instructions:
- [ ] Change test server URL from coordinator IP to test VM IP
- [ ] Update `ssh_upload_file` target from `"coordinator"` to `"test"`
- [ ] Update `ssh_exec` target for extraction commands

#### FR-6: Coordinator VM Cleanup
- [ ] Remove `/var/www/gymnastics-test` directory
- [ ] Remove `/etc/nginx/sites-enabled/gymnastics-test` symlink
- [ ] Remove `/etc/nginx/sites-available/gymnastics-test` config file
- [ ] Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`
- [ ] Verify coordinator API remains functional on port 3001
- [ ] **Note**: Port 8080 stays open in security group (shared with test VM) but nothing listens on coordinator

#### FR-7: Tag Coordinator for Discoverability
Currently the coordinator VM (`i-001383a4293522fa4`) does NOT appear in `aws_list_instances` because it lacks the `Project: gymnastics-graphics` tag.

- [ ] Add tag `Project: gymnastics-graphics` to coordinator instance
- [ ] Verify coordinator now appears in `aws_list_instances` output

### Non-Functional Requirements

#### NFR-1: Independent Lifecycle
- Test VM can be started/stopped without affecting coordinator
- Coordinator can be started/stopped without affecting test availability (once deployed)

#### NFR-2: Discoverability
- Test VM appears in `aws_list_instances` results via `Project: gymnastics-graphics` tag
- Test VM has clear name: `gymnastics-test-vm`

#### NFR-3: Security Isolation
- Test VM only has access to dev Firebase (via frontend build)
- Test VM cannot modify production data
- Test VM uses same SSH key for consistent access

#### NFR-4: Consistent Tooling
- Same SSH key (`gymnastics-graphics-key-pair.pem`) works for both VMs
- Same security group allows consistent port access
- MCP tools work with `target: "test"` shortcut

---

## Implementation Plan

### Phase 1: Documentation (Current State) ✅
**Status**: Complete

**Documented**:
- [x] Coordinator VM configuration (IP, instance ID, type)
- [x] Current port usage (3001 coordinator, 8080 test)
- [x] MCP server configuration (`tools/mcp-server/index.js`)
- [x] CLAUDE.md test deployment workflow
- [x] nginx configuration for test server
- [x] nginx configuration for coordinator API
- [x] Auto-shutdown mechanism (`server/lib/autoShutdown.js`)
- [x] Directory structure (`/var/www/gymnastics-test`)

**Current nginx sites enabled**:
```
/etc/nginx/sites-enabled/
├── api.commentarygraphic.com -> /etc/nginx/sites-available/api.commentarygraphic.com
├── default -> /etc/nginx/sites-available/default
└── gymnastics-test -> /etc/nginx/sites-available/gymnastics-test
```

---

### Phase 2: Provision Test VM
**Objective**: Create and configure dedicated test instance with Elastic IP

**Tasks**:
1. Launch EC2 instance via AWS Console or CLI
2. Allocate and assign Elastic IP
3. Install and configure nginx
4. Configure auto-shutdown mechanism
5. Test static file serving

**AWS CLI Commands**:
```bash
# 1. Launch instance with proper tags
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.micro \
  --key-name gymnastics-graphics-key-pair \
  --security-group-ids sg-025f1ac53cccb756b \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=gymnastics-test-vm},{Key=Project,Value=gymnastics-graphics}]'

# 2. Allocate Elastic IP
aws ec2 allocate-address --domain vpc --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=gymnastics-test-vm-eip},{Key=Project,Value=gymnastics-graphics}]'

# 3. Associate Elastic IP (use IDs from previous commands)
aws ec2 associate-address --instance-id <instance-id> --allocation-id <allocation-id>
```

**Server Setup Script** (run on new test VM via SSH):
```bash
#!/bin/bash
# Test VM Setup Script

set -e

echo "=== Updating system ==="
sudo apt update && sudo apt upgrade -y

echo "=== Installing nginx ==="
sudo apt install -y nginx

echo "=== Installing Node.js 20.x ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "=== Creating test directory ==="
sudo mkdir -p /var/www/gymnastics-test
sudo chown ubuntu:ubuntu /var/www/gymnastics-test

echo "=== Configuring nginx ==="
sudo tee /etc/nginx/sites-available/gymnastics-test << 'EOF'
server {
    listen 8080;
    server_name _;
    root /var/www/gymnastics-test;
    index index.html;

    # Return static JSON for coordinator-status
    # Test environment always reports coordinator as "running"
    location = /.netlify/functions/coordinator-status {
        default_type application/json;
        add_header Access-Control-Allow-Origin *;
        return 200 '{"success":true,"state":"running","appReady":true,"publicIp":"44.193.31.120","timestamp":"2026-01-16T00:00:00.000Z"}';
    }

    # Proxy wake-coordinator to actual coordinator
    location = /.netlify/functions/wake-coordinator {
        proxy_pass http://44.193.31.120:3001/api/coordinator/wake;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Access-Control-Allow-Origin *;
    }

    # Proxy stop-coordinator to actual coordinator
    location = /.netlify/functions/stop-coordinator {
        proxy_pass http://44.193.31.120:3001/api/coordinator/stop;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Access-Control-Allow-Origin *;
    }

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "=== Enabling nginx site ==="
sudo ln -sf /etc/nginx/sites-available/gymnastics-test /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== Creating placeholder index.html ==="
echo '<html><body><h1>Gymnastics Test VM</h1><p>Deploy app to see content.</p></body></html>' > /var/www/gymnastics-test/index.html

echo "=== Setup complete ==="
echo "Test server running on port 8080"
```

**Auto-Shutdown Script** (`/opt/auto-shutdown.sh`):
```bash
#!/bin/bash
# Auto-shutdown script for test VM
# Stops instance if no deployments in last 60 minutes

IDLE_MINUTES=60
TEST_DIR="/var/www/gymnastics-test"
LOG_FILE="/var/log/auto-shutdown.log"

# Get last modification time of test directory
LAST_MOD=$(stat -c %Y "$TEST_DIR" 2>/dev/null || echo 0)
NOW=$(date +%s)
IDLE_SECONDS=$((NOW - LAST_MOD))
IDLE_MINS=$((IDLE_SECONDS / 60))

echo "$(date): Idle time: ${IDLE_MINS} minutes (threshold: ${IDLE_MINUTES})" >> "$LOG_FILE"

if [ "$IDLE_MINS" -ge "$IDLE_MINUTES" ]; then
    echo "$(date): Idle timeout reached. Initiating shutdown." >> "$LOG_FILE"

    # Get instance ID from metadata
    TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
    INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)

    # Stop self
    aws ec2 stop-instances --instance-ids "$INSTANCE_ID" --region us-east-1
fi
```

**Cron Setup** (add to test VM):
```bash
# Add to root crontab: sudo crontab -e
# Check every 10 minutes for idle timeout
*/10 * * * * /opt/auto-shutdown.sh
```

**IAM Requirements for Self-Stop**:
The test VM needs an IAM instance profile with permission to stop itself:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "ec2:StopInstances",
            "Resource": "arn:aws:ec2:us-east-1:*:instance/*",
            "Condition": {
                "StringEquals": {
                    "ec2:ResourceTag/Name": "gymnastics-test-vm"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": "ec2:DescribeInstances",
            "Resource": "*"
        }
    ]
}
```

---

### Phase 3: Update MCP Server
**Objective**: Add test VM support to MCP tools

**File**: `tools/mcp-server/index.js`

**Changes**:
```javascript
// Update CONFIG object (around line 55)
const CONFIG = {
  awsRegion: 'us-east-1',
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
  coordinatorIp: '44.193.31.120',
  testVmIp: '<NEW_TEST_VM_ELASTIC_IP>',  // ADD THIS LINE
  projectTag: 'gymnastics-graphics',
  sshTimeout: 30000,
  commandTimeout: 60000,
};

// Update resolveTarget function (around line 458)
function resolveTarget(target) {
  if (target === 'coordinator') {
    return CONFIG.coordinatorIp;
  }
  if (target === 'test') {  // ADD THIS BLOCK
    return CONFIG.testVmIp;
  }
  return target;
}
```

**Update ssh_exec tool description**:
```javascript
{
  name: 'ssh_exec',
  description: 'Execute a command on a VM via SSH. Can target any VM by IP address, or use "coordinator" or "test" as shortcuts.',
  // ... rest unchanged
}
```

---

### Phase 4: Update CLAUDE.md
**Objective**: Update deployment workflow to use new test VM

**Changes to CLAUDE.md** (Test Environment section):
```markdown
## Test Environment (Ralph Wiggum Loop) - IMPORTANT

**ALWAYS use the test environment when making UI changes to show-controller.** This allows unlimited iterations without burning Netlify build credits.

**Test Server**: `http://<NEW_TEST_VM_ELASTIC_IP>:8080`
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
# target: test

# 4. Extract (use ssh_exec MCP tool)
# target: test
# command: sudo rm -rf /var/www/gymnastics-test/* && sudo tar -xzf /tmp/dist.tar.gz -C /var/www/gymnastics-test/ && sudo find /var/www/gymnastics-test -name '._*' -delete

# 5. Verify with Playwright
# browser_navigate to http://<NEW_TEST_VM_ELASTIC_IP>:8080
# browser_take_screenshot
# browser_console_messages (check for errors)
```

**Note:** The test VM is separate from the coordinator. It proxies `/.netlify/functions/*` requests to the coordinator at 44.193.31.120:3001.

**Note:** The test VM auto-stops after 60 minutes of no deployments to save costs. Use `aws_start_instance` to wake it up if needed.
```

---

### Phase 5: Validation
**Objective**: Verify new setup works correctly

**Test Checklist**:
- [ ] Test VM appears in `aws_list_instances` output with name `gymnastics-test-vm`
- [ ] Can SSH to test VM using `ssh_exec target:test command:"echo hello"`
- [ ] Can upload files to test VM using `ssh_upload_file target:test`
- [ ] Can build and deploy dev branch to test VM
- [ ] Playwright can navigate to test VM and take screenshots
- [ ] Test app correctly proxies `/.netlify/functions/coordinator-status`
- [ ] Test app correctly proxies `/.netlify/functions/wake-coordinator`
- [ ] Coordinator VM still functions normally on port 3001
- [ ] Ralph Wiggum loop (`ralph.sh`) completes successfully
- [ ] Auto-shutdown triggers after 60 minutes of inactivity
- [ ] Test VM can stop itself via IAM permissions

---

### Phase 6: Cleanup
**Objective**: Remove test infrastructure from coordinator VM

**Tasks**:
1. [ ] Remove test nginx configuration from coordinator
2. [ ] Remove `/var/www/gymnastics-test` from coordinator
3. [ ] Reload nginx on coordinator
4. [ ] Verify coordinator API still works on port 3001
5. [ ] Close port 8080 on coordinator (if desired)
6. [ ] Document final architecture

**Commands**:
```bash
# Remove nginx test config
ssh_exec target:coordinator command:"sudo rm /etc/nginx/sites-enabled/gymnastics-test"
ssh_exec target:coordinator command:"sudo rm /etc/nginx/sites-available/gymnastics-test"
ssh_exec target:coordinator command:"sudo nginx -t && sudo systemctl reload nginx"

# Remove test directory
ssh_exec target:coordinator command:"sudo rm -rf /var/www/gymnastics-test"

# Verify coordinator still works
ssh_exec target:coordinator command:"curl -s http://localhost:3001/health || echo 'Health check endpoint not found'"

# NOTE: Do NOT close port 8080 via aws_close_port!
# Both VMs share the same security group (sg-025f1ac53cccb756b).
# Port 8080 is still needed for the TEST VM.
# The coordinator simply won't have anything listening on 8080 after nginx cleanup.

# Tag coordinator for discoverability in aws_list_instances
# (Do this via AWS Console: EC2 > Instances > coordinator > Tags > Add tag)
# Key: Project, Value: gymnastics-graphics
```

---

## Rollback Plan

### Before Phase 6 (Pre-Cleanup)
- Simply revert MCP server config and CLAUDE.md to point to coordinator
- Test infrastructure still exists on coordinator
- Zero production impact

### After Phase 6 (Post-Cleanup)
1. SSH to coordinator VM
2. Recreate nginx configuration:
   ```bash
   ssh_exec target:coordinator command:"sudo tee /etc/nginx/sites-available/gymnastics-test << 'EOF'
   <paste original config>
   EOF"
   ```
3. Enable site: `sudo ln -sf /etc/nginx/sites-available/gymnastics-test /etc/nginx/sites-enabled/`
4. Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`
5. Recreate `/var/www/gymnastics-test` directory
6. Revert MCP server config (`testVmIp` and `resolveTarget`)
7. Revert CLAUDE.md changes

---

## Configuration Reference

### Current Configuration (Before Migration)

| Item | Value |
|------|-------|
| Coordinator VM IP | 44.193.31.120 (Elastic IP) |
| Coordinator Instance ID | i-001383a4293522fa4 |
| Coordinator Instance Type | t3.small |
| Security Group | sg-025f1ac53cccb756b (gymnastics-vm-pool) |
| SSH Key | ~/.ssh/gymnastics-graphics-key-pair.pem |
| SSH Username | ubuntu |
| Test App Port | 8080 |
| Coordinator API Port | 3001 |
| Test Directory | /var/www/gymnastics-test |
| Test nginx Config | /etc/nginx/sites-available/gymnastics-test |
| MCP Server | tools/mcp-server/index.js |
| Dev Firebase | gymnastics-graphics-dev |
| Prod Firebase | gymnastics-graphics |
| Auto-shutdown | 120 min (coordinator only) |

### Target Configuration (After Migration)

| Item | Value |
|------|-------|
| Coordinator VM IP | 44.193.31.120 (unchanged) |
| Coordinator Instance ID | i-001383a4293522fa4 (unchanged) |
| **Test VM IP** | TBD (new Elastic IP) |
| **Test VM Instance ID** | TBD |
| Test VM Instance Type | t3.micro |
| Test VM Name Tag | gymnastics-test-vm |
| Test VM Project Tag | gymnastics-graphics |
| MCP Targets | `"coordinator"`, `"test"` |
| Test VM Auto-shutdown | 60 minutes |

---

## Success Metrics

1. **Discoverability**: `aws_list_instances` shows both `gymnastics-test-vm` AND `coordinator` (after tagging)
2. **Isolation**: `ssh_exec target:coordinator command:"ls /var/www"` shows no `gymnastics-test` directory
3. **Functionality**: `ralph.sh` completes successfully against new test VM
4. **Independence**: Can stop coordinator without breaking test deployments (after initial deploy)
5. **Auto-shutdown**: Test VM stops itself after 60 minutes of no deployments
6. **Cost**: Monthly AWS bill increases by ≤$8 (including Elastic IP when stopped)

**Verification Commands:**
```bash
# Check both VMs appear in list
aws_list_instances
# Expected: coordinator, gymnastics-test-vm, plus any VM pool instances

# Verify test VM SSH works
ssh_exec target:test command:"echo hello"

# Verify coordinator cleanup
ssh_exec target:coordinator command:"ls /var/www"
# Expected: only 'html' directory, no 'gymnastics-test'

# Verify coordinator API still works
ssh_exec target:coordinator command:"curl -s localhost:3001/health"
```

---

## Appendix A: Ralph Wiggum Loop - Visual Flow

### Current Flow (Before Migration)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL MACHINE                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────────┐ │
│  │  ralph.sh   │───▶│ Claude Code  │───▶│  Playwright MCP                 │ │
│  │  (loop)     │    │  + MCP Tools │    │  (headless browser)             │ │
│  └─────────────┘    └──────┬───────┘    └────────────┬────────────────────┘ │
│                            │                         │                       │
│                     SSH/SCP│                         │ HTTP                  │
│                            │                         │                       │
└────────────────────────────┼─────────────────────────┼───────────────────────┘
                             │                         │
                             ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COORDINATOR VM (44.193.31.120)                           │
│                                                                              │
│  ┌────────────────────┐         ┌────────────────────────────────────────┐  │
│  │  Coordinator API   │◀────────│  nginx :8080 (test server)             │  │
│  │  :3001             │  proxy  │  /var/www/gymnastics-test              │  │
│  │                    │ 127.0.0.1│                                        │  │
│  └────────────────────┘         └────────────────────────────────────────┘  │
│                                                                              │
│  Problem: Both services on same VM, coupled lifecycle                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Current Ralph Loop Steps:**
1. `ralph.sh` runs Claude Code with Playwright MCP
2. Claude builds app: `cd show-controller && VITE_FIREBASE_ENV=dev npm run build`
3. Claude uploads via SSH: `ssh_upload_file target:coordinator` → 44.193.31.120
4. Claude extracts: `ssh_exec target:coordinator` → extracts to `/var/www/gymnastics-test`
5. Playwright navigates to `http://44.193.31.120:8080`
6. Playwright takes screenshot, checks console errors
7. Claude analyzes, makes fixes, repeats

---

### Target Flow (After Migration)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL MACHINE                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────────┐ │
│  │  ralph.sh   │───▶│ Claude Code  │───▶│  Playwright MCP                 │ │
│  │  (loop)     │    │  + MCP Tools │    │  (headless browser)             │ │
│  └─────────────┘    └──────┬───────┘    └────────────┬────────────────────┘ │
│                            │                         │                       │
│                     SSH/SCP│                         │ HTTP                  │
│                            │                         │                       │
└────────────────────────────┼─────────────────────────┼───────────────────────┘
                             │                         │
                             ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TEST VM (NEW - Elastic IP: TBD)                        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  nginx :8080 (test server)                                             │ │
│  │  /var/www/gymnastics-test                                              │ │
│  │                                                                         │ │
│  │  Proxies /.netlify/functions/* ──────────────────────────────────────┐ │ │
│  └──────────────────────────────────────────────────────────────────────┼─┘ │
│                                                                          │   │
│  Auto-shutdown: 60 min idle                                              │   │
└──────────────────────────────────────────────────────────────────────────┼───┘
                                                                           │
                                            HTTP (44.193.31.120:3001)      │
                                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COORDINATOR VM (44.193.31.120)                           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Coordinator API :3001                                                 │ │
│  │  - VM Pool Management                                                  │ │
│  │  - Firebase sync                                                       │ │
│  │  - /api/coordinator/wake, /api/coordinator/stop                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  No test workloads - production coordination only                           │
│  Auto-shutdown: 120 min idle                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Target Ralph Loop Steps:**
1. `ralph.sh` runs Claude Code with Playwright MCP
2. Claude builds app: `cd show-controller && VITE_FIREBASE_ENV=dev npm run build`
3. Claude uploads via SSH: `ssh_upload_file target:test` → **NEW TEST VM IP**
4. Claude extracts: `ssh_exec target:test` → extracts to `/var/www/gymnastics-test`
5. Playwright navigates to `http://<TEST_VM_IP>:8080`
6. Playwright takes screenshot, checks console errors
7. Claude analyzes, makes fixes, repeats

**Key Changes:**
- SSH target changes from `"coordinator"` to `"test"`
- Playwright URL changes from coordinator IP to test VM IP
- Test VM can run independently of coordinator
- Coordinator only involved if app calls `/.netlify/functions/*`

---

### MCP Target Resolution

**How `target` parameter works in SSH tools:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Tool Call                                                       │
│  ssh_exec target:"test" command:"echo hello"                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  resolveTarget() function in tools/mcp-server/index.js              │
│                                                                      │
│  if (target === 'coordinator') return '44.193.31.120';              │
│  if (target === 'test') return '<TEST_VM_ELASTIC_IP>';   // NEW     │
│  return target;  // raw IP address                                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SSH Connection                                                      │
│  Key: ~/.ssh/gymnastics-graphics-key-pair.pem                       │
│  User: ubuntu                                                        │
│  Host: <resolved IP>                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Available targets after migration:**
| Target | Resolves To | Use For |
|--------|-------------|---------|
| `"coordinator"` | 44.193.31.120 | Coordinator API operations, server deployment |
| `"test"` | <NEW_ELASTIC_IP> | Test app deployment, Ralph Wiggum loop |
| `"<any IP>"` | That IP directly | VM pool instances, ad-hoc access |

---

## Appendix B: Current File Locations

| File | Purpose |
|------|---------|
| `tools/mcp-server/index.js` | MCP server with AWS/SSH/Firebase tools |
| `.mcp.json` | MCP server configuration for Claude Code |
| `CLAUDE.md` | Developer instructions including test deployment |
| `ralph.sh` | Automated testing loop script |
| `server/ecosystem.config.js` | PM2 config for coordinator service |
| `server/lib/autoShutdown.js` | Coordinator auto-shutdown logic |
| `show-controller/src/lib/firebase.js` | Firebase config (dev/prod switching) |
| `show-controller/netlify/functions/` | Netlify serverless functions (wake/stop/status) |

## Appendix B: nginx Configs to Preserve

**Coordinator API** (`/etc/nginx/sites-available/api.commentarygraphic.com`):
- Proxies HTTPS traffic to localhost:3001
- SSL managed by Certbot
- DO NOT MODIFY during this migration

**Default** (`/etc/nginx/sites-available/default`):
- Standard Ubuntu nginx default
- Can remain as-is

## Appendix C: Security Group Rules

Current inbound rules for `sg-025f1ac53cccb756b`:

| Port | Protocol | Source | Description |
|------|----------|--------|-------------|
| 22 | TCP | 0.0.0.0/0 | SSH access |
| 80 | TCP | 0.0.0.0/0 | SSL certificate verification |
| 443 | TCP | 0.0.0.0/0 | API access (HTTPS) |
| 3001 | TCP | 0.0.0.0/0 | Coordinator API |
| 3003 | TCP | 0.0.0.0/0 | Show server API |
| 4000 | TCP | 0.0.0.0/0 | NoMachine (emergency access) |
| 8080 | TCP | 0.0.0.0/0 | Test server |

No changes needed - test VM will use same security group.

**Important**: Because both VMs share this security group, we CANNOT close port 8080 after migration. The test VM needs it. The coordinator simply won't have nginx listening on 8080 after cleanup - the port will be open but unused on that VM.

---

*Document Version: 3.0*
*Last Updated: January 2026*
*Status: Ready for Review*
