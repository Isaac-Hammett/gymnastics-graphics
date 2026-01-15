# PRD: Coordinator Deployment & On-Demand Architecture

**Version:** 1.0
**Date:** January 15, 2026
**Project:** Gymnastics Graphics - Production Coordinator
**Target:** AI-assisted development (Cursor/Windsurf)

---

## Executive Summary

This PRD defines the deployment architecture for the gymnastics-graphics coordinator server. The coordinator is a centralized backend that manages the VM pool, handles competition routing, and provides APIs for the frontend. To minimize costs, the coordinator runs on-demand rather than 24/7.

### Core Value Proposition
- **Cost optimization**: ~$5-6/month instead of ~$20/month always-on
- **Zero-downtime domain**: Frontend always available via Netlify
- **Quick startup**: ~60 seconds from stopped to ready
- **Graceful shutdown**: Auto-stops after inactivity, with client notification

---

## System Context

### Production Infrastructure (Manually Configured)

| Resource | Value |
|----------|-------|
| Domain | commentarygraphic.com |
| API Subdomain | api.commentarygraphic.com |
| Elastic IP | 44.193.31.120 |
| Coordinator Instance | i-001383a4293522fa4 (t3.small) |
| VPC | vpc-09ba9c02e2c976cf5 |
| Security Group | sg-025f1ac53cccb756b |
| Key Pair | gymnastics-graphics-key-pair |
| IAM Role | coordinator-role |
| SSL Certificate | Let's Encrypt (auto-renew) |
| App Directory | /opt/gymnastics-graphics |
| Firebase Credentials | /opt/gymnastics-graphics/firebase-service-account.json |

### Server Software (Installed)
- Ubuntu 24.04 LTS
- Node.js 20.x
- PM2 (process manager)
- nginx (reverse proxy)
- certbot (SSL management)

---

## Phase 18: Coordinator Deployment

### 18.1 Deployment Script

**File:** `server/scripts/deploy-coordinator.sh`

**Acceptance Criteria:**
- [ ] Defines COORDINATOR_HOST and DEPLOY_PATH variables
- [ ] Uses rsync to sync server/ directory to coordinator
- [ ] Excludes node_modules, .env, logs, test files
- [ ] SSHs to coordinator to run npm install
- [ ] SSHs to coordinator to restart PM2 process
- [ ] Supports --dry-run flag for testing
- [ ] Prints summary of files synced and deployment status

**Usage:**
```bash
# Dry run (show what would be synced)
./server/scripts/deploy-coordinator.sh --dry-run

# Actual deployment
./server/scripts/deploy-coordinator.sh
```

### 18.2 PM2 Configuration

**File:** `server/ecosystem.config.js`

**Acceptance Criteria:**
- [ ] Defines 'coordinator' application
- [ ] Sets correct working directory
- [ ] Configures environment variables for production
- [ ] Sets Firebase credentials path
- [ ] Enables log rotation (max 10MB, 5 files)
- [ ] Configures restart policy

**Configuration:**
```javascript
module.exports = {
  apps: [{
    name: 'coordinator',
    script: 'index.js',
    cwd: '/opt/gymnastics-graphics/server',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      GOOGLE_APPLICATION_CREDENTIALS: '/opt/gymnastics-graphics/firebase-service-account.json',
      COORDINATOR_MODE: 'true'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/opt/gymnastics-graphics/logs/error.log',
    out_file: '/opt/gymnastics-graphics/logs/out.log',
    max_size: '10M',
    retain: 5,
    max_restarts: 10,
    min_uptime: 5000
  }]
};
```

### 18.3 Environment Configuration

**File:** `server/.env.coordinator.example`

**Acceptance Criteria:**
- [ ] Documents all required environment variables
- [ ] Includes Firebase configuration
- [ ] Includes AWS configuration
- [ ] Includes coordinator-specific settings
- [ ] Each variable has explanatory comment

**Variables:**
```bash
# Server Configuration
NODE_ENV=production
PORT=3001

# Firebase Configuration
FIREBASE_DATABASE_URL=https://gymnastics-graphics-default-rtdb.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json

# AWS Configuration (used by IAM role, not env vars on coordinator)
AWS_REGION=us-east-1

# Coordinator Settings
COORDINATOR_MODE=true
AUTO_SHUTDOWN_MINUTES=120
```

### 18.4 Health Endpoint

**File:** `server/index.js` (extend)

**Acceptance Criteria:**
- [ ] GET /api/coordinator/status returns comprehensive health info
- [ ] Includes uptime, version, mode
- [ ] Includes lastActivity timestamp
- [ ] Includes Firebase connection status
- [ ] Includes AWS SDK status
- [ ] POST /api/coordinator/activity updates lastActivity

**Response Schema:**
```json
{
  "status": "online",
  "mode": "coordinator",
  "uptime": 3600,
  "version": "1.0.0",
  "lastActivity": "2026-01-15T16:43:08Z",
  "idleMinutes": 5,
  "connections": {
    "firebase": true,
    "aws": true
  }
}
```

---

## Phase 19: Auto-Shutdown System

### 19.1 Activity Tracking

**File:** `server/lib/autoShutdown.js`

**Acceptance Criteria:**
- [ ] Tracks lastActivityTimestamp
- [ ] Provides resetActivity() function
- [ ] Provides getIdleTime() function
- [ ] Provides checkIdleTimeout() function
- [ ] Reads AUTO_SHUTDOWN_MINUTES from environment
- [ ] Emits events for shutdown lifecycle

**Activity Triggers:**
- Any REST API request
- Any Socket.IO event
- VM pool operations
- Competition activations

### 19.2 Server Integration

**File:** `server/index.js` (extend)

**Acceptance Criteria:**
- [ ] Middleware resets activity on every request
- [ ] Socket handler resets activity on every event
- [ ] Idle check runs every 60 seconds
- [ ] GET /api/coordinator/idle returns current idle time
- [ ] POST /api/coordinator/keep-alive resets timer
- [ ] Skip shutdown if competitions are actively streaming

### 19.3 Self-Stop Capability

**File:** `server/lib/selfStop.js`

**Acceptance Criteria:**
- [ ] Retrieves own instance ID from EC2 metadata
- [ ] Implements stopSelf() using EC2 StopInstances
- [ ] 30-second delay before actual stop
- [ ] Emits 'shutdownPending' socket event
- [ ] Logs shutdown to Firebase
- [ ] Handles permission errors gracefully

**Shutdown Flow:**
```
1. Idle timeout reached
2. Emit 'shutdownPending' to all clients (30s warning)
3. Wait 30 seconds (allows cancel via keep-alive)
4. Close all socket connections gracefully
5. Stop polling loops
6. Log shutdown event to Firebase
7. Call EC2 StopInstances on self
```

---

## Phase 20: Wake System

### 20.1 Netlify Wake Function

**File:** `show-controller/netlify/functions/wake-coordinator.js`

**Acceptance Criteria:**
- [ ] Reads AWS credentials from COORDINATOR_AWS_* env vars
- [ ] Uses COORDINATOR_INSTANCE_ID for instance ID
- [ ] Calls EC2 StartInstances for coordinator
- [ ] Returns success with estimated ready time
- [ ] Handles already-running state
- [ ] Includes CORS headers

**Environment Variables Used:**
```javascript
const credentials = {
  accessKeyId: process.env.COORDINATOR_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.COORDINATOR_AWS_SECRET_ACCESS_KEY,
};
const region = process.env.COORDINATOR_AWS_REGION;
const instanceId = process.env.COORDINATOR_INSTANCE_ID;
```

**Request:** POST (no body required)

**Response:**
```json
{
  "success": true,
  "message": "Coordinator starting",
  "instanceState": "pending",
  "estimatedReadySeconds": 60
}
```

### 20.2 Netlify Status Function

**File:** `show-controller/netlify/functions/coordinator-status.js`

**Acceptance Criteria:**
- [ ] Calls EC2 DescribeInstances for coordinator
- [ ] Returns instance state (running/stopped/pending)
- [ ] If running, pings /api/coordinator/status
- [ ] Returns combined EC2 + app status
- [ ] Caches results for 10 seconds

**Response:**
```json
{
  "state": "running",
  "publicIp": "44.193.31.120",
  "appReady": true,
  "uptime": 3600,
  "idleMinutes": 5
}
```

### 20.3 IAM User for Netlify (Already Configured)

**Resource:** IAM User `netlify-coordinator-control`

**Status:** Already created during manual setup

**Policy:** `netlify-coordinator-control-policy`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeInstances"
      ],
      "Resource": "arn:aws:ec2:us-east-1:*:instance/i-001383a4293522fa4"
    },
    {
      "Effect": "Allow",
      "Action": "ec2:DescribeInstances",
      "Resource": "*"
    }
  ]
}
```

**Netlify Environment Variables (Already Configured):**
- COORDINATOR_AWS_ACCESS_KEY_ID
- COORDINATOR_AWS_SECRET_ACCESS_KEY
- COORDINATOR_AWS_REGION=us-east-1
- COORDINATOR_INSTANCE_ID=i-001383a4293522fa4

### 20.4 useCoordinator Hook

**File:** `show-controller/src/hooks/useCoordinator.js`

**Acceptance Criteria:**
- [ ] checkStatus() calls Netlify status function
- [ ] wake() calls Netlify wake function
- [ ] Tracks status: online, offline, starting, unknown
- [ ] Tracks appReady boolean
- [ ] Polls every 5s while starting (max 2 min)
- [ ] Returns error state on failures

**Interface:**
```javascript
const {
  status,        // 'online' | 'offline' | 'starting' | 'unknown'
  appReady,      // boolean - EC2 running AND app responding
  isWaking,      // boolean - wake in progress
  idleMinutes,   // number - minutes since last activity
  wake,          // () => Promise<void>
  checkStatus,   // () => Promise<void>
  error          // string | null
} = useCoordinator();
```

---

## Phase 21: Frontend Offline Handling

### 21.1 CoordinatorStatus Component

**File:** `show-controller/src/components/CoordinatorStatus.jsx`

**Acceptance Criteria:**
- [ ] Displays status badge (green/yellow/red)
- [ ] Shows 'Start System' button when offline
- [ ] Shows progress indicator when starting
- [ ] Tooltip with uptime and idle time
- [ ] Compact design for header placement

**States:**
| Status | Badge | Action |
|--------|-------|--------|
| online | Green Online | None |
| starting | Yellow Starting... | Progress bar |
| offline | Red Offline | "Start" button |
| unknown | Gray Checking... | Spinner |

### 21.2 SystemOfflinePage

**File:** `show-controller/src/pages/SystemOfflinePage.jsx`

**Acceptance Criteria:**
- [ ] Full-page display when coordinator offline
- [ ] Friendly message explaining sleep mode
- [ ] Large "Wake Up System" button
- [ ] Estimated startup time display
- [ ] Progress bar during startup
- [ ] Auto-redirect when ready
- [ ] Shows last shutdown time if available

**UI Mockup:**
```
+-----------------------------------------------------+
|                                                     |
|              System is Sleeping                     |
|                                                     |
|     The system automatically shuts down when        |
|     not in use to save costs.                       |
|                                                     |
|            +---------------------+                  |
|            |   Wake Up System    |                  |
|            +---------------------+                  |
|                                                     |
|         Estimated startup time: ~60 seconds         |
|                                                     |
|     Last active: 2 hours ago                        |
|                                                     |
+-----------------------------------------------------+
```

### 21.3 CompetitionSelector Offline State

**File:** `show-controller/src/pages/CompetitionSelector.jsx` (extend)

**Acceptance Criteria:**
- [ ] Shows CoordinatorStatus in header
- [ ] Banner when coordinator offline
- [ ] Disable VM actions when offline
- [ ] "Start System" as primary action when offline
- [ ] Auto-refresh when coordinator comes online

### 21.4 VMPoolPage Offline State

**File:** `show-controller/src/pages/VMPoolPage.jsx` (extend)

**Acceptance Criteria:**
- [ ] Show SystemOfflinePage if coordinator offline
- [ ] Progress overlay while coordinator starting
- [ ] Auto-fetch data when online
- [ ] Coordinator status in header

### 21.5 CoordinatorGate Component

**File:** `show-controller/src/components/CoordinatorGate.jsx`

**Acceptance Criteria:**
- [ ] Wraps routes requiring coordinator
- [ ] Checks coordinator status on mount
- [ ] Shows SystemOfflinePage if offline
- [ ] Passes through children if online
- [ ] Handles starting state with progress

**Usage in App.jsx:**
```jsx
<Route path="/admin/*" element={
  <CoordinatorGate>
    <AdminRoutes />
  </CoordinatorGate>
} />
```

---

## Technical Architecture

### Request Flow (Coordinator Online)

```
+-------------------------------------------------------------------+
|                                                                   |
|   Browser --> Netlify (static) --> api.commentarygraphic.com      |
|                                           |                       |
|                                           v                       |
|                                    nginx (SSL termination)        |
|                                           |                       |
|                                           v                       |
|                                    Node.js (PM2)                  |
|                                           |                       |
|                            +--------------+---------------+       |
|                            v              v               v       |
|                         Firebase       AWS EC2       Socket.IO    |
|                                                                   |
+-------------------------------------------------------------------+
```

### Request Flow (Coordinator Offline)

```
+-------------------------------------------------------------------+
|                                                                   |
|   Browser --> Netlify (static)                                    |
|                    |                                              |
|                    v                                              |
|   /.netlify/functions/coordinator-status                          |
|                    |                                              |
|                    v                                              |
|              AWS EC2 API --> Instance State: stopped              |
|                    |                                              |
|                    v                                              |
|         Frontend shows SystemOfflinePage                          |
|                    |                                              |
|        User clicks "Wake Up System"                               |
|                    |                                              |
|                    v                                              |
|   /.netlify/functions/wake-coordinator                            |
|                    |                                              |
|                    v                                              |
|              AWS EC2 API --> StartInstances                       |
|                    |                                              |
|                    v                                              |
|         Frontend polls until ready                                |
|                                                                   |
+-------------------------------------------------------------------+
```

### Cost Analysis

| Scenario | Coordinator | Production VMs | Elastic IP | Total/Month |
|----------|-------------|----------------|------------|-------------|
| Idle (no events) | Stopped | Stopped | $3.60 | ~$4 |
| Weekly usage (20 hrs) | $0.40 | Varies | $2.50 | ~$6 |
| Heavy usage (80 hrs) | $1.60 | Varies | $0.80 | ~$10 |

---

## Security Considerations

### IAM Principle of Least Privilege

| Entity | Permissions | Scope |
|--------|-------------|-------|
| Coordinator IAM Role | EC2 full access | All instances (manages VM pool) |
| Netlify IAM User | Start/Stop/Describe | Coordinator instance only |

### Network Security

- HTTPS only (HTTP redirects to HTTPS)
- Security group limits SSH to specific IPs
- nginx as reverse proxy (no direct Node.js exposure)
- Firebase credentials stored on server, not in code

### Shutdown Safety

- 30-second warning before shutdown
- No shutdown during active streaming
- Shutdown logged to Firebase for audit
- Clients notified via socket event

---

## Monitoring & Observability

### Logs

| Log | Location | Purpose |
|-----|----------|---------|
| PM2 stdout | /opt/gymnastics-graphics/logs/out.log | Application logs |
| PM2 stderr | /opt/gymnastics-graphics/logs/error.log | Error logs |
| nginx access | /var/log/nginx/access.log | HTTP requests |
| nginx error | /var/log/nginx/error.log | nginx errors |

### Firebase Audit Trail

Path: `coordinator/events/`

```json
{
  "timestamp": "2026-01-15T18:00:00Z",
  "event": "shutdown",
  "reason": "idle_timeout",
  "idleMinutes": 120,
  "activeConnections": 0
}
```

### Health Checks

| Check | Endpoint | Frequency |
|-------|----------|-----------|
| App status | /api/coordinator/status | On page load |
| EC2 status | Netlify function | On page load |
| Keep-alive | /api/coordinator/keep-alive | Every 5 min (if tab open) |

---

## Rollback Plan

If deployment fails:

1. SSH to coordinator: `ssh -i ~/.ssh/gymnastics-graphics-key-pair.pem ubuntu@44.193.31.120`
2. Check PM2 logs: `pm2 logs coordinator`
3. Restore previous version: `cd /opt/gymnastics-graphics && git checkout <previous-commit>`
4. Restart: `pm2 restart coordinator`

If coordinator is unrecoverable:

1. Stop instance in AWS Console
2. Launch new t3.small from Ubuntu 24.04 AMI
3. Associate Elastic IP
4. Re-run server setup steps
5. Deploy application

---

## File Manifest

### New Files (Phase 18-21)

| File | Phase | Description |
|------|-------|-------------|
| `server/scripts/deploy-coordinator.sh` | 18 | Deployment automation |
| `server/ecosystem.config.js` | 18 | PM2 configuration |
| `server/.env.coordinator.example` | 18 | Environment template |
| `server/lib/autoShutdown.js` | 19 | Activity tracking |
| `server/lib/selfStop.js` | 19 | EC2 self-stop |
| `show-controller/netlify/functions/wake-coordinator.js` | 20 | Start EC2 |
| `show-controller/netlify/functions/coordinator-status.js` | 20 | Check EC2 |
| `show-controller/src/hooks/useCoordinator.js` | 20 | React hook |
| `show-controller/src/components/CoordinatorStatus.jsx` | 21 | Status badge |
| `show-controller/src/pages/SystemOfflinePage.jsx` | 21 | Offline UI |
| `show-controller/src/components/CoordinatorGate.jsx` | 21 | Route guard |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `server/index.js` | 18, 19 | Health endpoints, activity middleware |
| `show-controller/src/pages/CompetitionSelector.jsx` | 21 | Offline handling |
| `show-controller/src/pages/VMPoolPage.jsx` | 21 | Offline handling |
| `show-controller/src/App.jsx` | 21 | CoordinatorGate |

---

*Generated January 15, 2026*
