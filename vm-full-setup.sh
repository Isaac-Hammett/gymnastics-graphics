#!/bin/bash
# =============================================================================
# Virtius OBS VM Full Setup Script
# Run this on a fresh Ubuntu 22.04 EC2 instance
# =============================================================================

set -e  # Exit on any error

echo ""
echo "=============================================="
echo "  Virtius OBS VM Setup"
echo "=============================================="
echo ""

# -----------------------------------------------------------------------------
# Step 1: System Update
# -----------------------------------------------------------------------------
echo ">>> [1/7] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# -----------------------------------------------------------------------------
# Step 2: Install Node.js 20.x and PM2
# -----------------------------------------------------------------------------
echo ""
echo ">>> [2/7] Installing Node.js 20.x and PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

echo "Node.js version: $(node --version)"
echo "PM2 version: $(pm2 --version)"

# -----------------------------------------------------------------------------
# Step 3: Install FFmpeg
# -----------------------------------------------------------------------------
echo ""
echo ">>> [3/7] Installing FFmpeg..."
sudo apt install -y ffmpeg

# -----------------------------------------------------------------------------
# Step 4: Install OBS Studio and headless dependencies
# -----------------------------------------------------------------------------
echo ""
echo ">>> [4/7] Installing OBS Studio and headless dependencies..."
sudo add-apt-repository ppa:obsproject/obs-studio -y
sudo apt update
sudo apt install -y obs-studio xvfb x11vnc xdotool

# -----------------------------------------------------------------------------
# Step 5: Create OBS configuration
# -----------------------------------------------------------------------------
echo ""
echo ">>> [5/7] Configuring OBS..."

# Create OBS config directories
mkdir -p ~/.config/obs-studio/basic/profiles/Virtius
mkdir -p ~/.config/obs-studio/basic/scenes
mkdir -p ~/.config/obs-studio/plugin_config/obs-websocket

# Create OBS profile config
cat > ~/.config/obs-studio/basic/profiles/Virtius/basic.ini << 'EOF'
[General]
Name=Virtius

[Video]
BaseCX=1920
BaseCY=1080
OutputCX=1920
OutputCY=1080
FPSType=0
FPSCommon=30

[Output]
Mode=Advanced
RecType=Standard

[AdvOut]
TrackIndex=1
RecType=Standard
Encoder=obs_x264
StreamEncoder=obs_x264
StreamAudioEncoder=ffmpeg_aac

[Stream1]
IgnoreRecommended=false

[WebSocket]
ServerEnabled=true
ServerPort=4455
AlertsEnabled=false
AuthRequired=false
EOF

# Create OBS WebSocket config
cat > ~/.config/obs-studio/plugin_config/obs-websocket/config.json << 'EOF'
{
    "server_enabled": true,
    "server_port": 4455,
    "alerts_enabled": false,
    "auth_required": false,
    "server_password": ""
}
EOF

# -----------------------------------------------------------------------------
# Step 6: Create systemd services
# -----------------------------------------------------------------------------
echo ""
echo ">>> [6/7] Creating systemd services..."

# Create Xvfb service
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

# Create OBS headless service
sudo tee /etc/systemd/system/obs-headless.service << 'EOF'
[Unit]
Description=OBS Studio Headless
After=network.target xvfb.service
Requires=xvfb.service

[Service]
Type=simple
User=ubuntu
Environment=DISPLAY=:99
ExecStart=/usr/bin/obs --profile Virtius --collection Virtius --disable-shutdown-check
ExecStop=/usr/bin/pkill obs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable xvfb
sudo systemctl start xvfb
sleep 2
sudo systemctl enable obs-headless
sudo systemctl start obs-headless

# -----------------------------------------------------------------------------
# Step 7: Configure PM2 startup
# -----------------------------------------------------------------------------
echo ""
echo ">>> [7/7] Configuring PM2 startup..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash || true
pm2 save || true

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "Services status:"
sudo systemctl status xvfb --no-pager | head -5
echo ""
sudo systemctl status obs-headless --no-pager | head -5
echo ""
echo "Next steps:"
echo "  1. Copy your server code: rsync -avz --exclude 'node_modules' ... ubuntu@IP:~/server/"
echo "  2. Install deps: cd ~/server && npm install"
echo "  3. Create .env file with PORT=3003"
echo "  4. Start server: pm2 start index.js --name virtius-server && pm2 save"
echo ""
echo "Test OBS WebSocket: curl http://localhost:3003/api/status"
echo ""
