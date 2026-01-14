# PRD: VM Pool Architecture & Automation

**Version:** 1.1
**Date:** January 14, 2026
**Project:** Gymnastics Graphics - VM Infrastructure Layer
**Status:** Draft - Pending Review
**Extends:** PRD-ShowControlSystem.md

---

## AWS Resources (Production)

| Resource | Value |
|----------|-------|
| Region | us-east-1 |
| VPC ID | vpc-09ba9c02e2c976cf5 |
| Security Group ID | sg-025f1ac53cccb756b |
| Key Pair Name | gymnastics-graphics-key-pair |
| AMI ID | ami-0c398cb65a93047f2 |

### AMI Contents

The base AMI (`ami-0c398cb65a93047f2`) includes:
- Ubuntu 22.04 LTS
- Node.js 20.x
- OBS Studio
- NoMachine (port 4000)
- Discord (snap)
- PM2, Git, PulseAudio, xvfb, x11vnc
- gymnastics-graphics repo (in `/home/ubuntu/gymnastics-graphics`)

---

## Executive Summary

This document defines the architecture for a **pool-based VM management system** that automates the provisioning, configuration, and assignment of AWS EC2 instances for gymnastics streaming competitions. The goal is to eliminate manual VM setup, enabling producers to click a button and have a fully-configured streaming environment ready within minutes.

### Current State (Manual)
```
Today's Workflow (30-60 minutes per competition)
───────────────────────────────────────────────
1. Julia manually starts EC2 instance in AWS Console
2. SSH into VM from local terminal
3. Run commands to start OBS
4. Manually configure Discord
5. Manually set up all streaming components
6. Manually enter VM IP into Firebase
7. Hope nothing breaks during the show
8. After competition: VM sits idle or manual cleanup
```

### Target State (Automated)
```
Future Workflow (2-3 minutes per competition)
─────────────────────────────────────────────
1. Admin clicks "Assign VM to Competition X"
2. System automatically:
   ├── Selects available VM from pool
   ├── Starts EC2 instance if stopped
   ├── Waits for services to initialize
   ├── Registers VM IP in Firebase
   ├── Pulls competition-specific configuration
   ├── Configures OBS scenes for this competition
   └── Notifies admin when ready
3. Producer connects - everything works
4. After competition:
   ├── Recordings archived to S3
   ├── VM returned to pool (cleaned/reset)
   └── Ready for next competition
```

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONTROL PLANE                                   │
│                    (Central Management - Always Running)                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    VM Pool Manager Service                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ Pool State  │  │ AWS EC2 API │  │ SSH Manager │  │ Health     │ │   │
│  │  │ (Firebase)  │  │ Integration │  │ (node-ssh)  │  │ Monitor    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Firebase Database                            │   │
│  │                                                                       │   │
│  │  vmPool/                          competitions/{compId}/              │   │
│  │  ├── vm-001/                      └── config/                        │   │
│  │  │   ├── instanceId: "i-xxx"          ├── vmId: "vm-001"            │   │
│  │  │   ├── status: "assigned"           ├── vmAddress: "1.2.3.4:3003" │   │
│  │  │   ├── publicIp: "1.2.3.4"          ├── gender: "womens"          │   │
│  │  │   ├── assignedTo: "comp-123"       └── ...                        │   │
│  │  │   ├── lastHealthCheck: timestamp                                  │   │
│  │  │   └── services: {...}                                             │   │
│  │  ├── vm-002/                                                         │   │
│  │  └── vm-003/                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                    SSH (port 22) + HTTP (port 3003)
                                   │
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                              VM POOL (AWS EC2)                               │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │    VM-001       │  │    VM-002       │  │    VM-003       │   ...       │
│  │  (Assigned)     │  │  (Available)    │  │  (Stopped)      │             │
│  │                 │  │                 │  │                 │             │
│  │  Competition A  │  │  Ready for      │  │  Cold standby   │             │
│  │  Running show   │  │  assignment     │  │  Start on demand│             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  Each VM runs:                                                               │
│  ├── Ubuntu 22.04 LTS                                                       │
│  ├── OBS Studio (headless via xvfb)                                         │
│  ├── Node.js Show Server (port 3003)                                        │
│  ├── Nimble SRT Server (ports 9001-9006)                                    │
│  ├── Discord (for comms)                                                    │
│  └── Monitoring agent                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: VM Pool Management

### 1.1 Pool States

Each VM in the pool has a lifecycle state:

| State | Description | EC2 State | Billable? |
|-------|-------------|-----------|-----------|
| `available` | Ready for assignment, services running | Running | Yes |
| `assigned` | Linked to a competition | Running | Yes |
| `in_use` | Competition actively streaming | Running | Yes |
| `releasing` | Post-competition cleanup in progress | Running | Yes |
| `stopped` | Cold standby, not running | Stopped | No (storage only) |
| `starting` | EC2 instance starting up | Pending | Yes |
| `error` | Health check failed, needs attention | Any | Depends |
| `maintenance` | Manual maintenance mode | Any | Depends |

### 1.2 Pool Configuration

```typescript
// Firebase: /vmPool/config
interface VMPoolConfig {
  // Pool sizing
  minAvailableVMs: number;      // Minimum VMs kept running (e.g., 2)
  maxTotalVMs: number;          // Maximum VMs in pool (e.g., 10)

  // Timing
  warmupTimeSeconds: number;    // Time to wait after EC2 start (e.g., 120)
  healthCheckIntervalMs: number; // Health check frequency (e.g., 30000)

  // AWS Configuration
  awsRegion: string;            // e.g., "us-east-1"
  amiId: string;                // Base AMI with all software
  instanceType: string;         // e.g., "c5.xlarge"
  securityGroupId: string;      // SG with correct ports open
  subnetId: string;             // VPC subnet
  keyPairName: string;          // SSH key pair name

  // Defaults
  defaultOBSPassword: string;   // Default OBS WebSocket password
  sshKeyPath: string;           // Path to SSH private key (on control plane)
}
```

### 1.3 VM Record Schema

```typescript
// Firebase: /vmPool/{vmId}
interface VMRecord {
  // Identity
  vmId: string;                 // e.g., "vm-001"
  instanceId: string;           // AWS EC2 instance ID "i-0abc123..."

  // Network
  publicIp: string | null;      // Current public IP (changes on restart)
  privateIp: string | null;     // VPC private IP
  publicDns: string | null;     // AWS public DNS name

  // State
  status: VMStatus;             // See states above
  ec2State: string;             // Raw EC2 state
  assignedTo: string | null;    // Competition ID if assigned
  assignedAt: number | null;    // Timestamp of assignment
  assignedBy: string | null;    // User who assigned

  // Health
  lastHealthCheck: number;      // Timestamp
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  services: {
    nodeServer: ServiceStatus;
    obsWebsocket: ServiceStatus;
    nimble: ServiceStatus;
    discord: ServiceStatus;
  };

  // Metadata
  createdAt: number;
  lastStartedAt: number | null;
  lastStoppedAt: number | null;
  totalAssignments: number;     // Lifetime counter

  // Tags (for filtering)
  tags: {
    region?: string;            // Geographic region if multi-region
    capability?: string[];      // e.g., ["4k", "multi-camera"]
  };
}

interface ServiceStatus {
  running: boolean;
  lastChecked: number;
  port?: number;
  error?: string;
}
```

### 1.4 Pool Operations

#### Assign VM to Competition

```typescript
async function assignVMToCompetition(
  competitionId: string,
  options?: { preferredVmId?: string; region?: string }
): Promise<AssignmentResult> {
  // 1. Find available VM (or start a stopped one)
  const vm = await findAvailableVM(options);

  if (!vm) {
    // No VMs available - try to start a stopped one
    const stoppedVM = await findStoppedVM(options);
    if (stoppedVM) {
      await startVM(stoppedVM.vmId);
      await waitForVMReady(stoppedVM.vmId);
      vm = stoppedVM;
    } else {
      throw new Error('No VMs available in pool');
    }
  }

  // 2. Update VM record
  await updateVMRecord(vm.vmId, {
    status: 'assigned',
    assignedTo: competitionId,
    assignedAt: Date.now(),
    assignedBy: getCurrentUserId()
  });

  // 3. Update competition config
  await updateCompetitionConfig(competitionId, {
    vmId: vm.vmId,
    vmAddress: `${vm.publicIp}:3003`
  });

  // 4. Configure VM for this competition
  await configureVMForCompetition(vm.vmId, competitionId);

  return {
    success: true,
    vmId: vm.vmId,
    vmAddress: `${vm.publicIp}:3003`,
    estimatedReadyTime: Date.now() + 30000
  };
}
```

#### Release VM from Competition

```typescript
async function releaseVMFromCompetition(
  competitionId: string,
  options?: { archiveRecordings?: boolean; stopVM?: boolean }
): Promise<void> {
  const competition = await getCompetitionConfig(competitionId);
  const vmId = competition.vmId;

  if (!vmId) return;

  // 1. Mark as releasing
  await updateVMRecord(vmId, { status: 'releasing' });

  // 2. Archive recordings if requested
  if (options?.archiveRecordings) {
    await archiveRecordingsToS3(vmId, competitionId);
  }

  // 3. Clean up VM
  await cleanupVM(vmId);

  // 4. Clear competition assignment
  await updateCompetitionConfig(competitionId, {
    vmId: null,
    vmAddress: null
  });

  // 5. Return to pool or stop
  if (options?.stopVM || shouldStopVM()) {
    await stopVM(vmId);
    await updateVMRecord(vmId, {
      status: 'stopped',
      assignedTo: null,
      assignedAt: null
    });
  } else {
    await updateVMRecord(vmId, {
      status: 'available',
      assignedTo: null,
      assignedAt: null
    });
  }
}
```

---

## Part 2: VM Base Image (AMI)

### 2.1 Software Components

The base AMI should include all software pre-installed and configured:

```
Ubuntu 22.04 LTS AMI
├── System
│   ├── Ubuntu 22.04 LTS (latest patches)
│   ├── AWS CLI v2
│   ├── CloudWatch Agent (for monitoring)
│   └── Fail2ban (security)
│
├── Display (for headless OBS)
│   ├── Xvfb (virtual framebuffer)
│   ├── x11vnc (optional, for debugging)
│   └── Desktop environment (minimal)
│
├── OBS Studio
│   ├── OBS 30.x (latest stable)
│   ├── obs-websocket plugin (built-in for OBS 28+)
│   ├── obs-ndi plugin (optional)
│   └── Browser source dependencies (CEF)
│
├── Streaming Infrastructure
│   ├── Nimble Streamer (SRT server)
│   ├── FFmpeg (latest)
│   └── SRT tools
│
├── Node.js Environment
│   ├── Node.js 20 LTS
│   ├── npm / yarn
│   ├── PM2 (process manager)
│   └── Show server code (via git pull on boot)
│
├── Communication
│   ├── Discord (desktop client)
│   └── PulseAudio (audio routing)
│
├── Utilities
│   ├── Git
│   ├── curl, wget, jq
│   ├── htop, iotop
│   └── Screen / tmux
│
└── Security
    ├── UFW firewall (configured)
    ├── SSH hardened (key-only)
    └── Automatic security updates
```

### 2.2 Systemd Services

Services that should auto-start on boot:

```ini
# /etc/systemd/system/xvfb.service
[Unit]
Description=Virtual Framebuffer
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24
Environment=DISPLAY=:99
Restart=always

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/obs-headless.service
[Unit]
Description=OBS Studio Headless
After=xvfb.service
Requires=xvfb.service

[Service]
Type=simple
Environment=DISPLAY=:99
Environment=HOME=/home/ubuntu
User=ubuntu
ExecStart=/usr/bin/obs --minimize-to-tray --disable-updater
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/show-server.service
[Unit]
Description=Gymnastics Graphics Show Server
After=network.target obs-headless.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/gymnastics-graphics/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3003

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/nimble.service
[Unit]
Description=Nimble Streamer
After=network.target

[Service]
Type=forking
ExecStart=/usr/bin/nimble start
ExecStop=/usr/bin/nimble stop
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### 2.3 Network Security (Security Group)

```terraform
resource "aws_security_group" "vm_pool" {
  name        = "gymnastics-vm-pool"
  description = "Security group for gymnastics streaming VMs"
  vpc_id      = var.vpc_id

  # SSH - Restricted to control plane IP
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.control_plane_ip]
    description = "SSH from control plane"
  }

  # Node.js Show Server - Public (frontend access)
  ingress {
    from_port   = 3003
    to_port     = 3003
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Show server API and WebSocket"
  }

  # SRT Streams - Public (camera inputs)
  ingress {
    from_port   = 9001
    to_port     = 9010
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SRT camera inputs"
  }

  # Nimble Stats API - Control plane only
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.control_plane_ip]
    description = "Nimble stats API"
  }

  # OBS WebSocket - Localhost only (internal)
  # No ingress rule needed - localhost only

  # All outbound allowed
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "gymnastics-vm-pool"
    Project = "gymnastics-graphics"
  }
}
```

### 2.4 Boot Script (User Data)

Script that runs on first boot and after restarts:

```bash
#!/bin/bash
# /home/ubuntu/boot-init.sh

set -e

LOG_FILE="/var/log/gymnastics-boot.log"
exec > >(tee -a $LOG_FILE) 2>&1

echo "=========================================="
echo "Boot Init Started: $(date)"
echo "=========================================="

# Get instance metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Instance: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"

# Update show server code
echo "Updating show server code..."
cd /home/ubuntu/gymnastics-graphics
git fetch origin
git reset --hard origin/main
cd server
npm install --production

# Restart services in order
echo "Starting services..."
sudo systemctl restart xvfb
sleep 2
sudo systemctl restart obs-headless
sleep 5
sudo systemctl restart show-server
sleep 2
sudo systemctl restart nimble

# Wait for services to stabilize
echo "Waiting for services to stabilize..."
sleep 10

# Health check
echo "Running health check..."
if curl -s http://localhost:3003/api/status > /dev/null; then
    echo "Show server: OK"
else
    echo "Show server: FAILED"
fi

# Report ready to control plane (optional webhook)
if [ -n "$CONTROL_PLANE_WEBHOOK" ]; then
    curl -X POST "$CONTROL_PLANE_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"instanceId\": \"$INSTANCE_ID\", \"publicIp\": \"$PUBLIC_IP\", \"status\": \"ready\"}"
fi

echo "=========================================="
echo "Boot Init Complete: $(date)"
echo "=========================================="
```

---

## Part 3: SSH Command Interface

### 3.1 SSH Manager Module

```typescript
// server/lib/vmSSHManager.ts

import { NodeSSH, SSHExecCommandResponse } from 'node-ssh';
import { EventEmitter } from 'events';

interface SSHConfig {
  host: string;
  username: string;
  privateKeyPath: string;
  port?: number;
  readyTimeout?: number;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
  duration: number;
}

export class VMSSHManager extends EventEmitter {
  private ssh: NodeSSH;
  private config: SSHConfig;
  private connected: boolean = false;

  constructor(config: SSHConfig) {
    super();
    this.ssh = new NodeSSH();
    this.config = {
      port: 22,
      readyTimeout: 30000,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      await this.ssh.connect({
        host: this.config.host,
        username: this.config.username,
        privateKey: this.config.privateKeyPath,
        port: this.config.port,
        readyTimeout: this.config.readyTimeout
      });
      this.connected = true;
      this.emit('connected', { host: this.config.host });
    } catch (error) {
      this.emit('error', { type: 'connection', error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
      this.emit('disconnected');
    }
  }

  async exec(command: string, options?: {
    cwd?: string;
    timeout?: number;
    sudo?: boolean;
  }): Promise<CommandResult> {
    if (!this.connected) {
      throw new Error('Not connected to VM');
    }

    const startTime = Date.now();
    const cmd = options?.sudo ? `sudo ${command}` : command;

    try {
      const result = await this.ssh.execCommand(cmd, {
        cwd: options?.cwd,
        execOptions: options?.timeout ? { timeout: options.timeout } : undefined
      });

      return {
        success: result.code === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code || 0,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        code: -1,
        duration: Date.now() - startTime
      };
    }
  }

  // High-level operations

  async restartService(serviceName: string): Promise<CommandResult> {
    return this.exec(`systemctl restart ${serviceName}`, { sudo: true });
  }

  async getServiceStatus(serviceName: string): Promise<{
    active: boolean;
    status: string;
    pid?: number;
  }> {
    const result = await this.exec(
      `systemctl show ${serviceName} --property=ActiveState,SubState,MainPID --no-pager`
    );

    if (!result.success) {
      return { active: false, status: 'unknown' };
    }

    const lines = result.stdout.split('\n');
    const props: Record<string, string> = {};
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) props[key] = value;
    }

    return {
      active: props.ActiveState === 'active',
      status: `${props.ActiveState}/${props.SubState}`,
      pid: props.MainPID ? parseInt(props.MainPID) : undefined
    };
  }

  async startOBS(): Promise<CommandResult> {
    // First ensure Xvfb is running
    await this.restartService('xvfb');
    await this.delay(2000);

    // Then start OBS
    return this.restartService('obs-headless');
  }

  async stopOBS(): Promise<CommandResult> {
    return this.exec('systemctl stop obs-headless', { sudo: true });
  }

  async updateShowServer(): Promise<CommandResult> {
    const commands = [
      'cd /home/ubuntu/gymnastics-graphics',
      'git fetch origin',
      'git reset --hard origin/main',
      'cd server',
      'npm install --production',
      'sudo systemctl restart show-server'
    ].join(' && ');

    return this.exec(commands);
  }

  async getSystemInfo(): Promise<{
    hostname: string;
    uptime: string;
    memory: { total: string; used: string; free: string };
    disk: { total: string; used: string; free: string };
    cpu: string;
  }> {
    const [hostname, uptime, memory, disk, cpu] = await Promise.all([
      this.exec('hostname'),
      this.exec('uptime -p'),
      this.exec("free -h | awk '/^Mem:/ {print $2,$3,$4}'"),
      this.exec("df -h / | awk 'NR==2 {print $2,$3,$4}'"),
      this.exec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1")
    ]);

    const [memTotal, memUsed, memFree] = memory.stdout.split(' ');
    const [diskTotal, diskUsed, diskFree] = disk.stdout.split(' ');

    return {
      hostname: hostname.stdout.trim(),
      uptime: uptime.stdout.trim(),
      memory: { total: memTotal, used: memUsed, free: memFree },
      disk: { total: diskTotal, used: diskUsed, free: diskFree },
      cpu: `${cpu.stdout.trim()}%`
    };
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ssh.putFile(localPath, remotePath);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.ssh.getFile(localPath, remotePath);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3.2 Common SSH Operations

```typescript
// Predefined operations that can be triggered from UI

export const VM_OPERATIONS = {
  // Service Management
  START_OBS: {
    name: 'Start OBS',
    command: 'systemctl start obs-headless',
    sudo: true,
    timeout: 30000
  },
  STOP_OBS: {
    name: 'Stop OBS',
    command: 'systemctl stop obs-headless',
    sudo: true,
    timeout: 10000
  },
  RESTART_OBS: {
    name: 'Restart OBS',
    command: 'systemctl restart obs-headless',
    sudo: true,
    timeout: 30000
  },
  RESTART_SHOW_SERVER: {
    name: 'Restart Show Server',
    command: 'systemctl restart show-server',
    sudo: true,
    timeout: 15000
  },
  RESTART_NIMBLE: {
    name: 'Restart Nimble',
    command: 'systemctl restart nimble',
    sudo: true,
    timeout: 15000
  },

  // Code Updates
  UPDATE_CODE: {
    name: 'Update Show Server Code',
    command: 'cd /home/ubuntu/gymnastics-graphics && git pull && cd server && npm install --production && sudo systemctl restart show-server',
    sudo: false,
    timeout: 120000
  },

  // Diagnostics
  CHECK_SERVICES: {
    name: 'Check All Services',
    command: 'systemctl status xvfb obs-headless show-server nimble --no-pager',
    sudo: true,
    timeout: 10000
  },
  VIEW_LOGS: {
    name: 'View Recent Logs',
    command: 'journalctl -u show-server -n 50 --no-pager',
    sudo: true,
    timeout: 10000
  },
  SYSTEM_INFO: {
    name: 'System Information',
    command: 'echo "=== Memory ===" && free -h && echo "=== Disk ===" && df -h / && echo "=== CPU ===" && top -bn1 | head -5',
    sudo: false,
    timeout: 10000
  },

  // Cleanup
  CLEAR_RECORDINGS: {
    name: 'Clear Old Recordings',
    command: 'rm -rf /home/ubuntu/recordings/*.mp4 && echo "Recordings cleared"',
    sudo: false,
    timeout: 30000
  },
  RESET_OBS_CONFIG: {
    name: 'Reset OBS Configuration',
    command: 'cp /home/ubuntu/obs-config-template/* /home/ubuntu/.config/obs-studio/ && sudo systemctl restart obs-headless',
    sudo: false,
    timeout: 30000
  }
};
```

---

## Part 4: AWS EC2 Integration

### 4.1 EC2 Manager Module

```typescript
// server/lib/vmEC2Manager.ts

import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  DescribeInstanceStatusCommand,
  RebootInstancesCommand
} from '@aws-sdk/client-ec2';

interface EC2Config {
  region: string;
  accessKeyId?: string;      // Optional if using IAM roles
  secretAccessKey?: string;  // Optional if using IAM roles
}

interface InstanceInfo {
  instanceId: string;
  state: string;
  publicIp: string | null;
  privateIp: string | null;
  publicDns: string | null;
  launchTime: Date | null;
  instanceType: string;
}

export class VMEC2Manager {
  private ec2: EC2Client;

  constructor(config: EC2Config) {
    this.ec2 = new EC2Client({
      region: config.region,
      ...(config.accessKeyId && {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey!
        }
      })
    });
  }

  async getInstanceInfo(instanceId: string): Promise<InstanceInfo | null> {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });

    const response = await this.ec2.send(command);
    const instance = response.Reservations?.[0]?.Instances?.[0];

    if (!instance) return null;

    return {
      instanceId: instance.InstanceId!,
      state: instance.State?.Name || 'unknown',
      publicIp: instance.PublicIpAddress || null,
      privateIp: instance.PrivateIpAddress || null,
      publicDns: instance.PublicDnsName || null,
      launchTime: instance.LaunchTime || null,
      instanceType: instance.InstanceType || 'unknown'
    };
  }

  async startInstance(instanceId: string): Promise<void> {
    const command = new StartInstancesCommand({
      InstanceIds: [instanceId]
    });
    await this.ec2.send(command);
  }

  async stopInstance(instanceId: string): Promise<void> {
    const command = new StopInstancesCommand({
      InstanceIds: [instanceId]
    });
    await this.ec2.send(command);
  }

  async rebootInstance(instanceId: string): Promise<void> {
    const command = new RebootInstancesCommand({
      InstanceIds: [instanceId]
    });
    await this.ec2.send(command);
  }

  async waitForState(
    instanceId: string,
    targetState: 'running' | 'stopped',
    timeoutMs: number = 300000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const info = await this.getInstanceInfo(instanceId);

      if (info?.state === targetState) {
        return true;
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return false;
  }

  async waitForServicesReady(
    publicIp: string,
    port: number = 3003,
    timeoutMs: number = 120000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`http://${publicIp}:${port}/api/status`, {
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          return true;
        }
      } catch {
        // Service not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return false;
  }
}
```

### 4.2 Pool Manager Service

```typescript
// server/lib/vmPoolManager.ts

import { VMEC2Manager } from './vmEC2Manager';
import { VMSSHManager } from './vmSSHManager';
import { db } from '../lib/firebase-admin';
import { EventEmitter } from 'events';

interface PoolConfig {
  minAvailableVMs: number;
  maxTotalVMs: number;
  awsRegion: string;
  sshKeyPath: string;
  sshUsername: string;
  healthCheckIntervalMs: number;
}

export class VMPoolManager extends EventEmitter {
  private ec2: VMEC2Manager;
  private config: PoolConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: PoolConfig) {
    super();
    this.config = config;
    this.ec2 = new VMEC2Manager({ region: config.awsRegion });
  }

  // Start the pool manager
  async start(): Promise<void> {
    console.log('Starting VM Pool Manager...');

    // Initial health check
    await this.runHealthCheck();

    // Schedule periodic health checks
    this.healthCheckInterval = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckIntervalMs
    );

    // Ensure minimum available VMs
    await this.ensureMinimumAvailable();

    this.emit('started');
  }

  // Stop the pool manager
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.emit('stopped');
  }

  // Get all VMs in pool
  async getAllVMs(): Promise<VMRecord[]> {
    const snapshot = await db.ref('vmPool').once('value');
    const data = snapshot.val() || {};

    // Filter out 'config' key
    return Object.entries(data)
      .filter(([key]) => key !== 'config')
      .map(([vmId, record]) => ({ vmId, ...record as any }));
  }

  // Get available VMs
  async getAvailableVMs(): Promise<VMRecord[]> {
    const vms = await this.getAllVMs();
    return vms.filter(vm => vm.status === 'available');
  }

  // Assign a VM to a competition
  async assignVM(
    competitionId: string,
    options?: { preferredVmId?: string }
  ): Promise<{ vmId: string; vmAddress: string }> {

    // Try preferred VM first
    if (options?.preferredVmId) {
      const preferred = await this.getVM(options.preferredVmId);
      if (preferred?.status === 'available') {
        return this.performAssignment(preferred, competitionId);
      }
    }

    // Find any available VM
    const availableVMs = await this.getAvailableVMs();

    if (availableVMs.length > 0) {
      return this.performAssignment(availableVMs[0], competitionId);
    }

    // No available VMs - try to start a stopped one
    const allVMs = await this.getAllVMs();
    const stoppedVMs = allVMs.filter(vm => vm.status === 'stopped');

    if (stoppedVMs.length > 0) {
      const vm = stoppedVMs[0];
      await this.startVM(vm.vmId);
      return this.performAssignment(vm, competitionId);
    }

    throw new Error('No VMs available in pool');
  }

  // Release a VM back to the pool
  async releaseVM(
    competitionId: string,
    options?: { stopVM?: boolean }
  ): Promise<void> {
    // Find VM assigned to this competition
    const vms = await this.getAllVMs();
    const vm = vms.find(v => v.assignedTo === competitionId);

    if (!vm) {
      console.warn(`No VM found for competition ${competitionId}`);
      return;
    }

    // Update VM status
    await this.updateVM(vm.vmId, {
      status: 'releasing',
    });

    // Clean up VM via SSH
    try {
      const ssh = new VMSSHManager({
        host: vm.publicIp!,
        username: this.config.sshUsername,
        privateKeyPath: this.config.sshKeyPath
      });

      await ssh.connect();

      // Reset OBS config
      await ssh.exec('cp /home/ubuntu/obs-config-template/* /home/ubuntu/.config/obs-studio/');

      // Clear any temporary files
      await ssh.exec('rm -rf /tmp/competition-*');

      await ssh.disconnect();
    } catch (error) {
      console.error(`Failed to clean up VM ${vm.vmId}:`, error);
      // Continue with release anyway
    }

    // Clear competition config
    await db.ref(`competitions/${competitionId}/config`).update({
      vmId: null,
      vmAddress: null
    });

    // Return to pool or stop
    if (options?.stopVM) {
      await this.stopVM(vm.vmId);
    } else {
      await this.updateVM(vm.vmId, {
        status: 'available',
        assignedTo: null,
        assignedAt: null,
        assignedBy: null
      });
    }

    this.emit('vmReleased', { vmId: vm.vmId, competitionId });
  }

  // Start a stopped VM
  async startVM(vmId: string): Promise<void> {
    const vm = await this.getVM(vmId);
    if (!vm) throw new Error(`VM ${vmId} not found`);

    await this.updateVM(vmId, { status: 'starting' });

    // Start EC2 instance
    await this.ec2.startInstance(vm.instanceId);

    // Wait for instance to be running
    const running = await this.ec2.waitForState(vm.instanceId, 'running');
    if (!running) {
      throw new Error(`VM ${vmId} failed to start`);
    }

    // Get new public IP
    const info = await this.ec2.getInstanceInfo(vm.instanceId);

    await this.updateVM(vmId, {
      publicIp: info?.publicIp || null,
      publicDns: info?.publicDns || null,
      lastStartedAt: Date.now()
    });

    // Wait for services to be ready
    if (info?.publicIp) {
      const ready = await this.ec2.waitForServicesReady(info.publicIp);
      if (ready) {
        await this.updateVM(vmId, { status: 'available' });
      } else {
        await this.updateVM(vmId, { status: 'error', healthStatus: 'unhealthy' });
      }
    }

    this.emit('vmStarted', { vmId, publicIp: info?.publicIp });
  }

  // Stop a VM
  async stopVM(vmId: string): Promise<void> {
    const vm = await this.getVM(vmId);
    if (!vm) throw new Error(`VM ${vmId} not found`);

    await this.ec2.stopInstance(vm.instanceId);

    await this.updateVM(vmId, {
      status: 'stopped',
      publicIp: null,
      publicDns: null,
      lastStoppedAt: Date.now()
    });

    this.emit('vmStopped', { vmId });
  }

  // Run health check on all VMs
  private async runHealthCheck(): Promise<void> {
    const vms = await this.getAllVMs();

    for (const vm of vms) {
      if (vm.status === 'stopped') continue;

      try {
        // Check EC2 state
        const info = await this.ec2.getInstanceInfo(vm.instanceId);

        if (!info || info.state !== 'running') {
          await this.updateVM(vm.vmId, {
            healthStatus: 'unhealthy',
            lastHealthCheck: Date.now()
          });
          continue;
        }

        // Update IP if changed
        if (info.publicIp !== vm.publicIp) {
          await this.updateVM(vm.vmId, {
            publicIp: info.publicIp,
            publicDns: info.publicDns
          });

          // Update competition config if assigned
          if (vm.assignedTo) {
            await db.ref(`competitions/${vm.assignedTo}/config`).update({
              vmAddress: `${info.publicIp}:3003`
            });
          }
        }

        // Check services via HTTP
        if (info.publicIp) {
          const healthy = await this.checkServices(info.publicIp);
          await this.updateVM(vm.vmId, {
            healthStatus: healthy ? 'healthy' : 'degraded',
            lastHealthCheck: Date.now(),
            services: healthy
          });
        }

      } catch (error) {
        console.error(`Health check failed for ${vm.vmId}:`, error);
        await this.updateVM(vm.vmId, {
          healthStatus: 'unknown',
          lastHealthCheck: Date.now()
        });
      }
    }

    this.emit('healthCheckComplete');
  }

  // Check services on a VM
  private async checkServices(publicIp: string): Promise<{
    nodeServer: boolean;
    obsWebsocket: boolean;
  }> {
    try {
      const response = await fetch(`http://${publicIp}:3003/api/status`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          nodeServer: true,
          obsWebsocket: data.obsConnected || false
        };
      }
    } catch {
      // Service not responding
    }

    return { nodeServer: false, obsWebsocket: false };
  }

  // Ensure minimum available VMs
  private async ensureMinimumAvailable(): Promise<void> {
    const availableVMs = await this.getAvailableVMs();

    if (availableVMs.length < this.config.minAvailableVMs) {
      const deficit = this.config.minAvailableVMs - availableVMs.length;

      // Find stopped VMs to start
      const allVMs = await this.getAllVMs();
      const stoppedVMs = allVMs.filter(vm => vm.status === 'stopped');

      const toStart = stoppedVMs.slice(0, deficit);

      for (const vm of toStart) {
        try {
          await this.startVM(vm.vmId);
        } catch (error) {
          console.error(`Failed to start VM ${vm.vmId}:`, error);
        }
      }
    }
  }

  // Helper methods
  private async getVM(vmId: string): Promise<VMRecord | null> {
    const snapshot = await db.ref(`vmPool/${vmId}`).once('value');
    const data = snapshot.val();
    return data ? { vmId, ...data } : null;
  }

  private async updateVM(vmId: string, updates: Partial<VMRecord>): Promise<void> {
    await db.ref(`vmPool/${vmId}`).update(updates);
  }

  private async performAssignment(
    vm: VMRecord,
    competitionId: string
  ): Promise<{ vmId: string; vmAddress: string }> {
    const vmAddress = `${vm.publicIp}:3003`;

    // Update VM record
    await this.updateVM(vm.vmId, {
      status: 'assigned',
      assignedTo: competitionId,
      assignedAt: Date.now()
    });

    // Update competition config
    await db.ref(`competitions/${competitionId}/config`).update({
      vmId: vm.vmId,
      vmAddress
    });

    this.emit('vmAssigned', { vmId: vm.vmId, competitionId, vmAddress });

    return { vmId: vm.vmId, vmAddress };
  }
}
```

---

## Part 5: UI Components

### 5.1 VM Pool Dashboard

A new page for administrators to manage the VM pool:

**Route:** `/admin/vm-pool`

**Features:**
- Grid view of all VMs in pool
- Status indicators (available, assigned, stopped, error)
- Quick actions: Start, Stop, Restart, SSH Terminal
- Assign VM to competition dropdown
- Release VM button
- Health check history
- System metrics (CPU, memory, disk)

### 5.2 Competition VM Setup

Integrated into competition management:

**Route:** `/{compId}/vm-setup`

**Features:**
- Current VM assignment status
- "Assign VM" button (if none assigned)
- "Change VM" button (reassign)
- "Release VM" button (return to pool)
- Connection test
- Service status (Node server, OBS, Nimble)
- Quick actions: Restart OBS, Update code, View logs
- SSH console (admin only)

### 5.3 VM Status Widget

Small widget shown in CompetitionHeader:

**Features:**
- Green/yellow/red indicator
- VM ID and IP
- Click to expand details
- "Reconnect" button if disconnected

---

## Part 6: API Endpoints

### 6.1 Pool Management Endpoints

```
# VM Pool (Admin)
GET    /api/admin/vm-pool              # List all VMs
GET    /api/admin/vm-pool/:vmId        # Get VM details
POST   /api/admin/vm-pool/:vmId/start  # Start VM
POST   /api/admin/vm-pool/:vmId/stop   # Stop VM
POST   /api/admin/vm-pool/:vmId/reboot # Reboot VM
POST   /api/admin/vm-pool/health-check # Trigger health check

# Competition VM Assignment
GET    /api/competitions/:compId/vm         # Get assigned VM
POST   /api/competitions/:compId/vm/assign  # Assign VM
POST   /api/competitions/:compId/vm/release # Release VM
POST   /api/competitions/:compId/vm/test    # Test connection

# SSH Operations (Admin)
POST   /api/admin/vm-pool/:vmId/ssh/exec    # Execute command
GET    /api/admin/vm-pool/:vmId/ssh/logs    # Get logs
POST   /api/admin/vm-pool/:vmId/ssh/restart-service # Restart service
```

### 6.2 WebSocket Events

```
# Server → Client
vmPoolUpdate        # Pool state changed
vmHealthUpdate      # Health check results
vmAssigned          # VM assigned to competition
vmReleased          # VM released from competition
vmStarted           # VM started
vmStopped           # VM stopped
vmError             # VM error occurred
sshOutput           # SSH command output (streaming)

# Client → Server
requestVMPool       # Request pool state
assignVM            # Assign VM to competition
releaseVM           # Release VM
startVM             # Start VM
stopVM              # Stop VM
execSSHCommand      # Execute SSH command
```

---

## Part 7: Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create Firebase schema for vmPool
- [ ] Implement VMEC2Manager (AWS SDK integration)
- [ ] Implement VMSSHManager (SSH operations)
- [ ] Add environment variables for AWS credentials
- [ ] Create initial pool configuration

### Phase 2: Pool Manager (Week 2)
- [ ] Implement VMPoolManager service
- [ ] Health check system
- [ ] VM assignment/release logic
- [ ] EC2 start/stop automation
- [ ] Service readiness detection

### Phase 3: API Layer (Week 3)
- [ ] Admin endpoints for pool management
- [ ] Competition VM endpoints
- [ ] SSH execution endpoints
- [ ] WebSocket events for real-time updates
- [ ] Authentication/authorization for admin routes

### Phase 4: UI - Admin (Week 4)
- [ ] VM Pool Dashboard page
- [ ] VM detail/control panel
- [ ] Health monitoring visualization
- [ ] SSH terminal component (optional)

### Phase 5: UI - Competition (Week 5)
- [ ] Competition VM Setup page
- [ ] VM status widget in header
- [ ] Integration with existing CompetitionSelector
- [ ] Error handling and recovery UI

### Phase 6: Testing & Hardening (Week 6)
- [ ] End-to-end testing with real EC2 instances
- [ ] Failure scenario testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Monitoring and alerting setup

---

## Part 8: Security Considerations

### 8.1 SSH Key Management

```
Options:
1. Store SSH private key in environment variable (base64 encoded)
2. Store SSH private key in AWS Secrets Manager
3. Use AWS Systems Manager Session Manager (no SSH keys)
4. Use EC2 Instance Connect (temporary keys)

Recommendation: AWS Secrets Manager + rotation policy
```

### 8.2 API Authentication

```
Admin Endpoints (/api/admin/*):
- Require admin role in Firebase Auth
- Rate limiting
- Audit logging

Competition Endpoints:
- Require authenticated user
- Require competition access (team member or admin)
```

### 8.3 Network Security

```
- SSH (22): Only from control plane IP
- Node server (3003): Public (with rate limiting)
- OBS WebSocket (4455): Localhost only
- SRT ports: Public UDP (for camera inputs)
- All other ports: Closed
```

---

## Part 9: Monitoring & Alerting

### 9.1 Metrics to Track

```
VM Level:
- CPU utilization
- Memory usage
- Disk usage
- Network I/O

Service Level:
- Node server response time
- OBS WebSocket connection status
- SRT stream health
- Active WebSocket connections

Pool Level:
- Available VM count
- Assignment rate
- Average assignment duration
- Error rate
```

### 9.2 Alerts

```
Critical:
- All VMs unavailable
- VM health check failed during live competition
- SSH connection failed
- OBS crashed during stream

Warning:
- Available VM count below minimum
- High CPU/memory usage
- Degraded camera health
- Service restart required

Info:
- VM assigned/released
- Health check completed
- Competition started/ended
```

---

## Part 10: Disaster Recovery

### 10.1 Mid-Show VM Failure

```
Scenario: VM becomes unreachable during live competition

Automatic Response:
1. Health check detects failure
2. Alert sent to producers
3. If spare VM available:
   - Auto-assign new VM
   - Attempt to restore state
   - Notify producers of switch
4. If no spare VM:
   - Start stopped VM
   - Manual intervention required

Producer Response:
1. Switch to backup stream (if configured)
2. Acknowledge alert
3. Monitor recovery progress
```

### 10.2 Data Recovery

```
What's recoverable:
- Competition configuration (Firebase)
- Camera assignments (Firebase)
- Show config (Firebase production config)

What's NOT recoverable:
- In-progress recordings (on VM disk)
- Real-time override log (unless synced)
- OBS scene customizations

Mitigation:
- Sync recordings to S3 during breaks
- Real-time override sync to Firebase
- Export OBS scene collection to S3
```

---

## Appendix A: Firebase Schema

```
/vmPool/
  config/
    minAvailableVMs: 2
    maxTotalVMs: 10
    awsRegion: "us-east-1"
    healthCheckIntervalMs: 30000

  vm-001/
    instanceId: "i-0abc123def456"
    status: "assigned"
    publicIp: "54.123.45.67"
    privateIp: "10.0.1.100"
    publicDns: "ec2-54-123-45-67.compute-1.amazonaws.com"
    assignedTo: "comp-abc123"
    assignedAt: 1705234567890
    assignedBy: "user-xyz"
    lastHealthCheck: 1705234600000
    healthStatus: "healthy"
    services:
      nodeServer: { running: true, port: 3003 }
      obsWebsocket: { running: true, port: 4455 }
      nimble: { running: true }
    createdAt: 1704067200000
    lastStartedAt: 1705234500000
    totalAssignments: 15
    tags:
      region: "us-east"

  vm-002/
    instanceId: "i-0def789abc012"
    status: "available"
    ...

  vm-003/
    instanceId: "i-0ghi345jkl678"
    status: "stopped"
    ...
```

---

## Appendix B: Environment Variables

```bash
# Control Plane Server (.env)

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Or use IAM role (preferred for EC2/ECS deployment)
# No credentials needed if running on AWS with proper IAM role

# SSH Configuration
VM_SSH_KEY_PATH=/path/to/gymnastics-vm-key.pem
# Or
VM_SSH_KEY_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:vm-ssh-key

VM_SSH_USERNAME=ubuntu

# Firebase Admin
FIREBASE_DATABASE_URL=https://gymnastics-graphics-default-rtdb.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Pool Configuration (can also be in Firebase)
VM_POOL_MIN_AVAILABLE=2
VM_POOL_MAX_TOTAL=10
VM_POOL_HEALTH_CHECK_INTERVAL_MS=30000
```

---

## Appendix C: AMI Build Script

```bash
#!/bin/bash
# build-ami.sh - Run on a fresh Ubuntu 22.04 instance

set -e

echo "=== Gymnastics VM AMI Builder ==="

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y \
  software-properties-common \
  curl \
  wget \
  git \
  jq \
  htop \
  iotop \
  screen \
  tmux \
  ffmpeg \
  xvfb \
  x11vnc \
  pulseaudio \
  libfdk-aac2 \
  libx264-dev

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install OBS Studio
sudo add-apt-repository ppa:obsproject/obs-studio -y
sudo apt-get update
sudo apt-get install -y obs-studio

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# Install Nimble Streamer
wget https://nimblestreamer.com/downloads/nimble-linux-amd64-latest.deb
sudo dpkg -i nimble-linux-amd64-latest.deb
rm nimble-linux-amd64-latest.deb

# Clone gymnastics-graphics repo
cd /home/ubuntu
git clone https://github.com/YOUR_ORG/gymnastics-graphics.git
cd gymnastics-graphics/server
npm install --production

# Create systemd services
# (Copy service files from Part 2.2)

# Enable services
sudo systemctl enable xvfb
sudo systemctl enable obs-headless
sudo systemctl enable show-server
sudo systemctl enable nimble

# Create OBS config template directory
mkdir -p /home/ubuntu/obs-config-template
# (Copy default OBS config here)

# Set up boot script
sudo cp /home/ubuntu/gymnastics-graphics/scripts/boot-init.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/boot-init.sh

# Add to rc.local or systemd for boot execution
echo "/usr/local/bin/boot-init.sh" | sudo tee -a /etc/rc.local

# Security hardening
sudo ufw allow 22/tcp
sudo ufw allow 3003/tcp
sudo ufw allow 9001:9010/udp
sudo ufw enable

# Clean up for AMI
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*
rm -rf ~/.bash_history
history -c

echo "=== AMI Build Complete ==="
echo "Create AMI from this instance in AWS Console"
```

---

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| **VM Pool** | Collection of pre-configured EC2 instances ready for competition assignment |
| **Control Plane** | Central management service that orchestrates VMs |
| **Assignment** | Linking a VM to a specific competition |
| **Release** | Returning a VM to the available pool after competition |
| **Health Check** | Periodic verification that VM services are operational |
| **Warm VM** | Running instance ready for immediate assignment |
| **Cold VM** | Stopped instance that needs to be started before use |

---

## Part 11: Alert Service

### 11.1 Alert Schema

```javascript
// alerts/{competitionId}/{alertId}
{
  "id": "alert-1705234567890",
  "level": "critical",           // critical, warning, info
  "category": "vm",              // vm, service, camera, obs, talent
  "title": "VM Unreachable",
  "message": "Cannot connect to VM-001 at 44.197.188.85",
  "timestamp": 1705234567890,
  "vmId": "vm-001",
  "competitionId": "comp-abc123",
  "acknowledged": false,
  "acknowledgedBy": null,
  "acknowledgedAt": null,
  "resolved": false,
  "resolvedAt": null,
  "autoResolve": true
}
```

### 11.2 Alert Service Module

**File:** `server/lib/alertService.js`

**Features:**
- Create alerts in Firebase at `alerts/{competitionId}/{alertId}`
- Alert levels: `critical`, `warning`, `info`
- Alert categories: `vm`, `service`, `camera`, `obs`, `talent`
- Auto-ID generation with timestamp
- Auto-resolve when condition clears (configurable)
- Socket event emission for real-time UI updates

### 11.3 VM Alert Triggers

| Condition | Level | Category | Auto-Resolve |
|-----------|-------|----------|--------------|
| VM becomes unreachable | Critical | vm | Yes |
| OBS disconnects on assigned VM | Critical | obs | Yes |
| Node server stops responding | Warning | service | Yes |
| NoMachine becomes unavailable | Warning | service | Yes |
| VM auto-stopped due to idle timeout | Info | vm | No |

### 11.4 Alert Display

**Producer View Integration:**
- Critical alerts: Red banner at top of page
- Warning alerts: Collapsible yellow panel
- Alert count badge in header
- Acknowledge button to dismiss
- Auto-dismiss info alerts after 10 seconds
- Audio tone for critical alerts (configurable)

---

## Part 12: Implementation Phases (Detailed Tasks)

### Phase 14: VM Pool Infrastructure

#### P14-01: AWS SDK Service Module
**File:** `server/lib/awsService.js`

**Steps:**
1. Install @aws-sdk/client-ec2 package
2. Initialize EC2Client with region from env
3. Implement describeInstances with tag filters
4. Implement startInstance with instanceId
5. Implement stopInstance with instanceId
6. Implement getInstanceStatus for health
7. Implement launchInstance from AMI config
8. Implement terminateInstance with instanceId
9. Implement createTags for metadata
10. Add retry logic for transient failures
11. Add logging for all AWS operations

**Environment Variables:**
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
VM_AMI_ID=ami-0c398cb65a93047f2
VM_SECURITY_GROUP_ID=sg-025f1ac53cccb756b
VM_KEY_PAIR_NAME=gymnastics-graphics-key-pair
```

#### P14-02: VM Pool State Manager
**File:** `server/lib/vmPoolManager.js`

**Features:**
- Track VM pool state in Firebase at `vmPool/`
- Sync AWS state with Firebase on initialization
- VM status enum: `available`, `assigned`, `in_use`, `stopped`, `starting`, `error`
- Auto-start cold VMs when warm pool depleted
- Event emission for state changes

**Firebase Schema:**
```javascript
// vmPool/{vmId}
{
  "vmId": "vm-001",
  "instanceId": "i-0abc123def456",
  "status": "available",
  "publicIp": "44.197.188.85",
  "privateIp": "172.31.9.204",
  "assignedTo": null,
  "assignedAt": null,
  "lastHealthCheck": 1705234567890,
  "services": {
    "nodeServer": { "running": true, "port": 3003 },
    "obsWebsocket": { "running": true, "port": 4455 },
    "noMachine": { "running": true, "port": 4000 }
  }
}

// vmPool/config
{
  "minWarmVMs": 2,
  "maxTotalVMs": 5,
  "maxConcurrent": 4,
  "autoStopAfterHours": 2,
  "warmupTimeSeconds": 180,
  "instanceType": "t3.large"
}
```

#### P14-03: VM Health Monitor
**File:** `server/lib/vmHealthMonitor.js`

**Features:**
- Poll each running VM's `/api/status` endpoint (default 30s interval)
- Check OBS WebSocket connectivity via VM's API
- Check NoMachine port availability
- Update Firebase `vmPool/{vmId}/services` with health data
- Detect VM unreachable and update status to `error`
- Emit `vmHealthChanged` event on status transitions

### Phase 15: VM Pool API

#### P15-01: Pool Management Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/vm-pool` | Full pool status |
| GET | `/api/admin/vm-pool/:vmId` | Single VM details |
| POST | `/api/admin/vm-pool/:vmId/start` | Start VM |
| POST | `/api/admin/vm-pool/:vmId/stop` | Stop VM |
| POST | `/api/admin/vm-pool/launch` | Launch new VM |
| DELETE | `/api/admin/vm-pool/:vmId` | Terminate VM |
| GET | `/api/admin/vm-pool/config` | Pool configuration |
| PUT | `/api/admin/vm-pool/config` | Update configuration |

#### P15-02: Competition VM Assignment Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/competitions/:compId/vm/assign` | Assign VM |
| POST | `/api/competitions/:compId/vm/release` | Release VM |
| GET | `/api/competitions/:compId/vm` | Get assigned VM |

#### P15-03: VM Pool Socket Events

**Server Emits:**
- `vmPoolStatus` - Full pool status update
- `vmAssigned` - `{ vmId, competitionId, publicIp }`
- `vmReleased` - `{ vmId, competitionId }`
- `vmStarting` - `{ vmId, estimatedReadyTime }`
- `vmReady` - `{ vmId, publicIp, services }`
- `vmError` - `{ vmId, error, details }`

**Server Listens:**
- `assignVM` - `{ competitionId, preferredVmId? }`
- `releaseVM` - `{ competitionId }`
- `startVM` - `{ vmId }`
- `stopVM` - `{ vmId }`

### Phase 16: VM Pool UI

#### P16-01: VMPoolPage
**File:** `show-controller/src/pages/VMPoolPage.jsx`
**Route:** `/admin/vm-pool`

**Features:**
- VM cards in grid layout
- Status badges: green=available, blue=assigned, purple=in_use, gray=stopped, yellow=starting, red=error
- Health indicators for Node, OBS, NoMachine services
- Start/Stop/Assign/Release buttons
- Pool configuration panel (collapsible)

#### P16-02: VMCard Component
**File:** `show-controller/src/components/VMCard.jsx`

**Features:**
- VM name, status badge, public IP
- Service health dots (green/red)
- Assigned competition name
- Action buttons with loading states
- SSH command copy button

#### P16-03: PoolStatusBar Component
**File:** `show-controller/src/components/PoolStatusBar.jsx`

**Features:**
- Counts: Available, Assigned, In Use, Stopped, Error
- Visual utilization bar
- Warning when pool is low
- Quick "Start Cold VM" action

#### P16-04: useVMPool Hook
**File:** `show-controller/src/hooks/useVMPool.js`

**Returns:**
- `vms` - array of all VM data
- `poolConfig` - configuration object
- `isLoading` - loading state
- `availableVMs`, `assignedVMs`, `stoppedVMs` - computed arrays
- `getVMForCompetition(compId)` - helper function

**Actions:**
- `assignVM(competitionId, preferredVmId?)`
- `releaseVM(competitionId)`
- `startVM(vmId)`
- `stopVM(vmId)`

#### P16-05: CompetitionSelector VM Integration
**File:** `show-controller/src/pages/CompetitionSelector.jsx`

**Updates:**
- VM status badge on competition cards
- Quick "Assign VM" / "Release VM" buttons
- Disable Producer/Talent links when no VM
- Link to `/admin/vm-pool`

### Phase 17: Monitoring & Alerts

#### P17-01: Alert Service
**File:** `server/lib/alertService.js`

**Functions:**
- `createAlert(competitionId, alert)` - with auto-ID
- `resolveAlert(competitionId, alertId)`
- `acknowledgeAlert(competitionId, alertId, userId)`
- `getActiveAlerts(competitionId)`

#### P17-02: VM Alert Triggers
**File:** `server/lib/vmHealthMonitor.js` (extend)

**Triggers:**
- Critical: VM unreachable, OBS disconnected
- Warning: Node server down, NoMachine unavailable
- Info: VM auto-stopped on idle

#### P17-03: Producer View Alerts
**File:** `show-controller/src/pages/ProducerView.jsx` (extend)

**Features:**
- Critical alert banner
- Warning alert panel
- Alert count badge
- Acknowledge buttons

#### P17-04: AlertPanel Component
**File:** `show-controller/src/components/AlertPanel.jsx`

**Features:**
- Collapsible panel
- Group by level
- Acknowledge per alert and all
- Empty state

#### P17-05: useAlerts Hook
**File:** `show-controller/src/hooks/useAlerts.js`

**Returns:**
- `alerts` - sorted array
- `criticalCount`, `warningCount`, `infoCount`
- `hasUnacknowledgedCritical`

**Actions:**
- `acknowledgeAlert(alertId)`
- `acknowledgeAll()`

---

## File Manifest (New Files)

| File | Phase | Lines (est) |
|------|-------|-------------|
| `server/lib/awsService.js` | 14 | 200 |
| `server/lib/vmPoolManager.js` | 14 | 300 |
| `server/lib/vmHealthMonitor.js` | 14 | 150 |
| `server/lib/alertService.js` | 17 | 150 |
| `show-controller/src/pages/VMPoolPage.jsx` | 16 | 200 |
| `show-controller/src/components/VMCard.jsx` | 16 | 150 |
| `show-controller/src/components/PoolStatusBar.jsx` | 16 | 80 |
| `show-controller/src/components/AlertPanel.jsx` | 17 | 120 |
| `show-controller/src/hooks/useVMPool.js` | 16 | 100 |
| `show-controller/src/hooks/useAlerts.js` | 17 | 80 |

---

## Key Design Decisions (VM Pool)

### VM Pool Strategy
- **Warm pool**: 2 VMs always running, ready for immediate assignment
- **Cold pool**: 3 VMs stopped, started on demand (2-3 min startup)
- **Total capacity**: 5 VMs supporting 4 concurrent competitions + 1 spare

### Instance Type Selection
- **t3.large** for testing ($0.08/hr) - CPU-only encoding
- **g4dn.xlarge** for production ($0.53/hr) - GPU NVENC encoding
- GPU provides smoother encoding, frees CPU for Node.js/Nimble

### Assignment Flow
1. Competition created in Firebase without VM
2. Producer clicks "Assign VM" in CompetitionSelector
3. System finds available VM from warm pool
4. Updates `vmAddress` in competition config
5. Producer can now connect to VM

### Alert Priority
| Level | Visual | Sound | Examples |
|-------|--------|-------|----------|
| Critical | Red banner | Alarm | VM unreachable, OBS crashed |
| Warning | Yellow panel | Chime | High CPU, service degraded |
| Info | Toast | None | VM assigned, config updated |

---

*Document generated for gymnastics-graphics VM architecture planning*
*Last updated: January 14, 2026*
