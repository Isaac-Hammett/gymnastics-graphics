# Virtius OBS VM Setup Guide

Quick guide to spin up a headless OBS streaming server on AWS EC2.

## Prerequisites

- AWS account
- SSH key pair (`.pem` file)
- This repository cloned locally

## Step 1: Create EC2 Instance

1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Launch Instance**
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `virtius-obs-server` |
| **AMI** | Ubuntu Server 22.04 LTS (64-bit x86) |
| **Instance type** | `c5.2xlarge` (8 vCPU, 16GB RAM) |
| **Key pair** | Select or create new |
| **Storage** | 50 GB gp3 SSD |

4. **Security Group** - Add these inbound rules:

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | Your IP |
| Custom TCP | 3003 | 0.0.0.0/0 |

5. Launch and note the **Public IPv4 address**

## Step 2: Run Setup Script

### From your Mac terminal:

```bash
# 1. Copy setup script to VM (replace IP and key path)
scp -i ~/Downloads/YOUR-KEY.pem ~/code/gymnastics-graphics/vm-full-setup.sh ubuntu@YOUR_VM_IP:~/

# 2. SSH into VM
ssh -i ~/Downloads/YOUR-KEY.pem ubuntu@YOUR_VM_IP

# 3. Run setup script (on VM)
chmod +x ~/vm-full-setup.sh && ~/vm-full-setup.sh
```

The script takes ~5-10 minutes and installs everything automatically.

## Step 3: Deploy Server Code

### From your Mac terminal:

```bash
# Copy server folder to VM
rsync -avz --exclude 'node_modules' -e "ssh -i ~/Downloads/YOUR-KEY.pem" ~/code/gymnastics-graphics/server/ ubuntu@YOUR_VM_IP:~/server/
```

### On the VM (SSH session):

```bash
# Install dependencies and start server
cd ~/server && npm install

# Create environment file
cat > ~/server/.env << 'EOF'
PORT=3003
OBS_WEBSOCKET_URL=ws://localhost:4455
OBS_WEBSOCKET_PASSWORD=
OBS_VIDEO_SOURCE=Video Player
EOF

# Start with PM2
pm2 start index.js --name virtius-server && pm2 save
```

## Step 4: Configure React App

Update `show-controller/.env`:

```
VITE_SOCKET_SERVER=http://YOUR_VM_IP:3003
```

Then run locally or deploy to Netlify.

## Verification

Test the connection:
- Browser: `http://YOUR_VM_IP:3003/api/status`
- Should show `"obsConnected": true`

## Common Commands

```bash
# SSH into VM
ssh -i ~/Downloads/YOUR-KEY.pem ubuntu@YOUR_VM_IP

# Check status
pm2 status
sudo systemctl status obs-headless
sudo systemctl status xvfb

# View logs
pm2 logs virtius-server

# Restart services
pm2 restart virtius-server
sudo systemctl restart obs-headless

# Update server code
rsync -avz --exclude 'node_modules' -e "ssh -i ~/Downloads/YOUR-KEY.pem" ~/code/gymnastics-graphics/server/ ubuntu@YOUR_VM_IP:~/server/
ssh -i ~/Downloads/YOUR-KEY.pem ubuntu@YOUR_VM_IP "cd ~/server && npm install && pm2 restart virtius-server"
```

## Troubleshooting

### OBS not connecting
```bash
# Check if OBS is running
sudo systemctl status obs-headless

# Check OBS WebSocket config
cat ~/.config/obs-studio/plugin_config/obs-websocket/config.json

# Restart OBS
sudo systemctl restart obs-headless
```

### Server not accessible
```bash
# Check if server is running
pm2 status

# Check firewall (should show port 3003 open)
sudo ufw status

# Test locally on VM
curl http://localhost:3003/api/status
```

## Current VM Details

- **IP**: 54.209.98.89
- **Key**: `~/Downloads/gymnastics-graphics-key-pair.pem`
- **SSH**: `ssh -i ~/Downloads/gymnastics-graphics-key-pair.pem ubuntu@54.209.98.89`
