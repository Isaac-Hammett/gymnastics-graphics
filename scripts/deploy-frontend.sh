#!/bin/bash
# Deploy frontend to production (commentarygraphic.com)
# This script deploys BOTH the React SPA and static overlay files

set -e  # Exit on any error

SERVER="3.87.107.201"
REMOTE_DIR="/var/www/commentarygraphic"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Frontend Deployment Script ==="
echo "Server: $SERVER"
echo "Remote directory: $REMOTE_DIR"
echo ""

# Step 1: Build React SPA
echo "Step 1: Building React SPA..."
cd "$PROJECT_ROOT/show-controller"
npm run build
echo "✓ React build complete"
echo ""

# Step 2: Create tarballs
echo "Step 2: Creating deployment packages..."
mkdir -p /tmp/claude

# React SPA
tar -czf /tmp/claude/dist.tar.gz -C dist .
echo "✓ Created dist.tar.gz"

# Overlays (from project root)
cd "$PROJECT_ROOT"
tar -czf /tmp/claude/overlays.tar.gz overlays/
echo "✓ Created overlays.tar.gz"

# output.html (main graphics renderer)
cp output.html /tmp/claude/output.html
echo "✓ Copied output.html"
echo ""

# Step 3: Upload files
echo "Step 3: Uploading files to server..."
scp /tmp/claude/dist.tar.gz ubuntu@$SERVER:/tmp/dist.tar.gz
scp /tmp/claude/overlays.tar.gz ubuntu@$SERVER:/tmp/overlays.tar.gz
scp /tmp/claude/output.html ubuntu@$SERVER:/tmp/output.html
echo "✓ Files uploaded"
echo ""

# Step 4: Extract on server
echo "Step 4: Deploying files on server..."

# Deploy React SPA
ssh ubuntu@$SERVER "sudo rm -rf $REMOTE_DIR/assets $REMOTE_DIR/index.html && sudo tar -xzf /tmp/dist.tar.gz -C $REMOTE_DIR/"
echo "✓ React SPA deployed"

# Deploy overlays
ssh ubuntu@$SERVER "sudo rm -rf $REMOTE_DIR/overlays && sudo tar -xzf /tmp/overlays.tar.gz -C $REMOTE_DIR/ && sudo find $REMOTE_DIR/overlays -name '._*' -delete"
echo "✓ Overlays deployed"

# Deploy output.html
ssh ubuntu@$SERVER "sudo cp /tmp/output.html $REMOTE_DIR/output.html"
echo "✓ output.html deployed"

# Fix permissions
ssh ubuntu@$SERVER "sudo chown -R www-data:www-data $REMOTE_DIR"
echo "✓ Permissions fixed"
echo ""

# Step 5: Verify deployment
echo "Step 5: Verifying deployment..."
echo "Files in $REMOTE_DIR:"
ssh ubuntu@$SERVER "ls -la $REMOTE_DIR/"
echo ""
echo "Overlays:"
ssh ubuntu@$SERVER "ls -la $REMOTE_DIR/overlays/ | head -10"
echo ""

# Cleanup
rm -f /tmp/claude/dist.tar.gz /tmp/claude/overlays.tar.gz /tmp/claude/output.html

echo "=== Deployment Complete ==="
echo ""
echo "Verify at:"
echo "  - https://commentarygraphic.com"
echo "  - https://commentarygraphic.com/output.html?graphic=logos"
echo "  - https://commentarygraphic.com/overlays/stream.html"
