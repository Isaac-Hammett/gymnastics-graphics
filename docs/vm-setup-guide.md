# VM Setup Guide

This guide documents how to set up and maintain OBS VM templates for the gymnastics graphics system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Initial VM Setup](#initial-vm-setup)
3. [Adding Auto-Update on Boot](#adding-auto-update-on-boot)
4. [Creating an AMI](#creating-an-ami)
5. [Updating the AMI in Code](#updating-the-ami-in-code)
6. [Maintenance](#maintenance)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COORDINATOR VM                                │
│                     (44.193.31.120:3001)                            │
│                                                                      │
│   Manages VM pool, health checks, assignments                        │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ launches from AMI
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         OBS VM (from template)                       │
│                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│   │   Node.js   │  │     OBS     │  │  NoMachine  │                 │
│   │  (port 3003)│  │  (headless) │  │ (port 4000) │                 │
│   └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
│   Services: xvfb, obs-headless, pm2, gymnastics-update               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Initial VM Setup

### Prerequisites

- Fresh Ubuntu 22.04 EC2 instance
- SSH access with key pair
- Security group allowing ports: 22 (SSH), 3003 (Node API), 4000 (NoMachine), 4455 (OBS WebSocket)

### Step 1: SSH into the VM

```bash
ssh -i ~/.ssh/gymnastics-graphics-key-pair.pem ubuntu@<VM_IP>
```

### Step 2: Install Base Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install FFmpeg
sudo apt install -y ffmpeg

# Install XVFB (for headless display)
sudo apt install -y xvfb x11vnc xdotool

# Install OBS Studio
sudo add-apt-repository ppa:obsproject/obs-studio -y
sudo apt update
sudo apt install -y obs-studio
```

### Step 3: Install NoMachine

```bash
wget https://download.nomachine.com/download/8.14/Linux/nomachine_8.14.2_1_amd64.deb
sudo dpkg -i nomachine_8.14.2_1_amd64.deb
rm nomachine_8.14.2_1_amd64.deb
```

### Step 4: Create Systemd Services

#### XVFB Service (Virtual Display)

```bash
sudo tee /etc/systemd/system/xvfb.service << 'EOF'
[Unit]
Description=X Virtual Frame Buffer
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

#### OBS Headless Service

```bash
sudo tee /etc/systemd/system/obs-headless.service << 'EOF'
[Unit]
Description=OBS Studio Headless
After=network.target xvfb.service
Requires=xvfb.service

[Service]
Type=simple
User=ubuntu
Environment=DISPLAY=:99
ExecStart=/usr/bin/obs --minimize-to-tray --disable-shutdown-check
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

#### Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable xvfb obs-headless
sudo systemctl start xvfb
sleep 2
sudo systemctl start obs-headless
```

### Step 5: Deploy Server Code

```bash
# Clone repository
cd ~
git clone https://github.com/Isaac-Hammett/gymnastics-graphics.git

# Install dependencies
cd ~/gymnastics-graphics/server
npm install --production

# Create environment file
cat > .env << 'EOF'
PORT=3003
NODE_ENV=production
EOF

# Start with PM2
pm2 start index.js --name obs-vm-server
pm2 save

# Configure PM2 to start on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash
```

### Step 6: Verify Installation

```bash
# Check all services
echo "=== Service Status ==="
systemctl is-active xvfb
systemctl is-active obs-headless
pm2 status

echo ""
echo "=== Health Check ==="
curl -s http://localhost:3003/api/status
```

---

## Adding Auto-Update on Boot

This ensures VMs always pull the latest code when they start, eliminating the need to recreate AMIs for code changes.

### Create Update Script

```bash
sudo tee /opt/update-on-boot.sh << 'EOF'
#!/bin/bash
# Auto-update gymnastics-graphics server on boot
LOG_FILE="/var/log/gymnastics-update.log"

echo "=== Update started at $(date) ===" >> $LOG_FILE

cd /home/ubuntu/gymnastics-graphics

# Pull latest code
echo "Pulling latest code..." >> $LOG_FILE
git fetch origin main >> $LOG_FILE 2>&1
git reset --hard origin/main >> $LOG_FILE 2>&1

# Install dependencies if package.json changed
echo "Installing dependencies..." >> $LOG_FILE
cd server
npm install --production --silent >> $LOG_FILE 2>&1

# Restart the server
echo "Restarting server..." >> $LOG_FILE
pm2 restart obs-vm-server >> $LOG_FILE 2>&1

echo "=== Update completed at $(date) ===" >> $LOG_FILE
EOF

# Make executable
sudo chmod +x /opt/update-on-boot.sh
```

### Create Systemd Service

```bash
sudo tee /etc/systemd/system/gymnastics-update.service << 'EOF'
[Unit]
Description=Update gymnastics-graphics on boot
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/update-on-boot.sh
RemainAfterExit=yes
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
sudo systemctl daemon-reload
sudo systemctl enable gymnastics-update.service
```

### Verify

```bash
systemctl is-enabled gymnastics-update.service
# Should output: enabled
```

---

## Creating an AMI

After setting up a VM, create an AMI snapshot so new VMs are pre-configured.

### Via AWS Console

1. Go to **AWS Console** → **EC2** → **Instances**
2. Select the configured VM (e.g., `gymnastics-vm-template`)
3. Click **Actions** → **Image and templates** → **Create image**
4. Fill in:
   - **Image name:** `gymnastics-vm-v2.1` (increment version)
   - **Image description:** `OBS VM with Node.js, OBS, NoMachine, XVFB, auto-update`
5. Click **Create image**
6. Wait for AMI to become "Available" (5-10 minutes)

### Via AWS CLI

```bash
aws ec2 create-image \
  --instance-id i-0xxxxxxxxxxxx \
  --name "gymnastics-vm-v2.1" \
  --description "OBS VM with Node.js, OBS, NoMachine, XVFB, auto-update" \
  --no-reboot
```

---

## Updating the AMI in Code

After creating a new AMI, update the code to use it.

### File Location

`server/lib/awsService.js` line 34:

```javascript
const AWS_CONFIG = {
  // ...
  amiId: process.env.AWS_AMI_ID || 'ami-xxxxxxxxxx',  // <-- Update this
  // ...
};
```

### Deployment

```bash
# Commit and push
git add server/lib/awsService.js
git commit -m "Update AMI to gymnastics-vm-v2.1"
git push origin dev

# Deploy to production
git checkout main && git merge dev && git push && git checkout dev
```

GitHub Actions will automatically deploy to the coordinator.

---

## Maintenance

### Checking VM Logs

```bash
# SSH into a VM
ssh -i ~/.ssh/gymnastics-graphics-key-pair.pem ubuntu@<VM_IP>

# Check update log
cat /var/log/gymnastics-update.log

# Check PM2 logs
pm2 logs obs-vm-server

# Check service status
systemctl status xvfb obs-headless gymnastics-update
```

### Manual Update (if needed)

```bash
cd ~/gymnastics-graphics
git pull origin main
cd server && npm install --production
pm2 restart obs-vm-server
```

### Updating the Template

1. Start `gymnastics-vm-template` instance
2. SSH in and make changes
3. Test thoroughly
4. Create new AMI with incremented version
5. Update AMI ID in code
6. (Optional) Terminate old AMI to save storage costs

---

## Current AMI Versions

| Version | AMI ID | Date | Description |
|---------|--------|------|-------------|
| v1.0 | `ami-0cd400e38fe002902` | 2026-01-14 | Initial setup (incomplete) |
| v2.0 | `ami-01a93c8f425f37d39` | 2026-01-15 | Full setup with services |
| v2.1 | `ami-01bdb25682977bb09` | 2026-01-16 | Added auto-update on boot |

---

## Troubleshooting

### OBS not starting

```bash
# Check XVFB is running first
systemctl status xvfb

# Check OBS logs
journalctl -u obs-headless -f
```

### Server not responding on port 3003

```bash
# Check PM2 status
pm2 status
pm2 logs obs-vm-server

# Check if port is in use
sudo netstat -tlnp | grep 3003
```

### Auto-update not working

```bash
# Check if service ran
systemctl status gymnastics-update

# Check logs
cat /var/log/gymnastics-update.log

# Test manually
sudo /opt/update-on-boot.sh
```

### NoMachine can't connect

- Ensure security group allows port 4000
- Check NoMachine is installed: `dpkg -l | grep nomachine`
- Restart NoMachine: `sudo /etc/NX/nxserver --restart`
