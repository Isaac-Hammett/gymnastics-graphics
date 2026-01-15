#!/bin/bash
# deploy-coordinator.sh - Deploy server to coordinator EC2 instance
#
# Usage:
#   ./deploy-coordinator.sh           # Full deployment
#   ./deploy-coordinator.sh --dry-run # Preview files to sync
#   ./deploy-coordinator.sh --help    # Show help

set -e

# Configuration
COORDINATOR_HOST="44.193.31.120"
DEPLOY_PATH="/opt/gymnastics-graphics"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/gymnastics-graphics-key-pair.pem}"
SSH_USER="${SSH_USER:-ec2-user}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
SKIP_INSTALL=false
SKIP_RESTART=false

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Deploy the gymnastics-graphics server to the coordinator EC2 instance."
    echo ""
    echo "Options:"
    echo "  --dry-run       Preview files to sync without making changes"
    echo "  --skip-install  Skip npm install step"
    echo "  --skip-restart  Skip PM2 restart step"
    echo "  --help          Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  SSH_KEY         Path to SSH private key (default: ~/.ssh/gymnastics-graphics-key-pair.pem)"
    echo "  SSH_USER        SSH username (default: ec2-user)"
    echo ""
    echo "Configuration:"
    echo "  Coordinator:    $COORDINATOR_HOST"
    echo "  Deploy path:    $DEPLOY_PATH"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-install)
            SKIP_INSTALL=true
            shift
            ;;
        --skip-restart)
            SKIP_RESTART=true
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Gymnastics Graphics - Coordinator Deployment       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check SSH key exists
if [[ ! -f "$SSH_KEY" ]]; then
    echo -e "${RED}Error: SSH key not found at $SSH_KEY${NC}"
    echo "Set SSH_KEY environment variable to the correct path"
    exit 1
fi

# Build rsync exclude list
EXCLUDES=(
    "node_modules"
    ".env"
    ".env.local"
    ".env.coordinator"
    "logs"
    "*.log"
    ".git"
    ".DS_Store"
    "coverage"
    ".nyc_output"
    "temp"
    "tmp"
)

RSYNC_EXCLUDES=""
for exclude in "${EXCLUDES[@]}"; do
    RSYNC_EXCLUDES="$RSYNC_EXCLUDES --exclude=$exclude"
done

echo -e "${YELLOW}Configuration:${NC}"
echo "  Coordinator Host: $COORDINATOR_HOST"
echo "  Deploy Path:      $DEPLOY_PATH"
echo "  Source Directory: $SERVER_DIR"
echo "  SSH Key:          $SSH_KEY"
echo "  SSH User:         $SSH_USER"
echo ""

if $DRY_RUN; then
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
fi

# Step 1: Sync files with rsync
echo -e "${GREEN}Step 1: Syncing server files...${NC}"
echo ""

RSYNC_FLAGS="-avz --delete --progress"
if $DRY_RUN; then
    RSYNC_FLAGS="$RSYNC_FLAGS --dry-run"
fi

echo "Running rsync..."
echo -e "${BLUE}rsync $RSYNC_FLAGS $RSYNC_EXCLUDES $SERVER_DIR/ $SSH_USER@$COORDINATOR_HOST:$DEPLOY_PATH/server/${NC}"
echo ""

rsync $RSYNC_FLAGS $RSYNC_EXCLUDES \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    "$SERVER_DIR/" \
    "$SSH_USER@$COORDINATOR_HOST:$DEPLOY_PATH/server/"

RSYNC_STATUS=$?

if [[ $RSYNC_STATUS -ne 0 ]]; then
    echo -e "${RED}Error: rsync failed with status $RSYNC_STATUS${NC}"
    exit $RSYNC_STATUS
fi

echo ""
echo -e "${GREEN}✓ Files synced successfully${NC}"
echo ""

# In dry-run mode, stop here
if $DRY_RUN; then
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}DRY RUN COMPLETE - Above shows files that would be synced${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "To perform actual deployment, run without --dry-run flag"
    exit 0
fi

# Step 2: Run npm install on coordinator
if ! $SKIP_INSTALL; then
    echo -e "${GREEN}Step 2: Installing dependencies...${NC}"
    echo ""

    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$COORDINATOR_HOST" \
        "cd $DEPLOY_PATH/server && npm install --production"

    NPM_STATUS=$?

    if [[ $NPM_STATUS -ne 0 ]]; then
        echo -e "${RED}Error: npm install failed with status $NPM_STATUS${NC}"
        exit $NPM_STATUS
    fi

    echo ""
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
else
    echo -e "${YELLOW}Step 2: Skipping npm install (--skip-install)${NC}"
    echo ""
fi

# Step 3: Restart PM2 process
if ! $SKIP_RESTART; then
    echo -e "${GREEN}Step 3: Restarting PM2 process...${NC}"
    echo ""

    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$COORDINATOR_HOST" \
        "cd $DEPLOY_PATH/server && pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production"

    PM2_STATUS=$?

    if [[ $PM2_STATUS -ne 0 ]]; then
        echo -e "${RED}Error: PM2 restart failed with status $PM2_STATUS${NC}"
        exit $PM2_STATUS
    fi

    echo ""
    echo -e "${GREEN}✓ PM2 process restarted${NC}"
    echo ""
else
    echo -e "${YELLOW}Step 3: Skipping PM2 restart (--skip-restart)${NC}"
    echo ""
fi

# Deployment summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   DEPLOYMENT COMPLETE                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo "  ✓ Files synced to $COORDINATOR_HOST:$DEPLOY_PATH/server/"
if ! $SKIP_INSTALL; then
    echo "  ✓ Dependencies installed"
fi
if ! $SKIP_RESTART; then
    echo "  ✓ PM2 process restarted"
fi
echo ""
echo -e "${YELLOW}Verify deployment:${NC}"
echo "  curl https://api.commentarygraphic.com/api/coordinator/status"
echo ""
echo "  Or SSH to check logs:"
echo "  ssh -i $SSH_KEY $SSH_USER@$COORDINATOR_HOST 'pm2 logs coordinator --lines 50'"
echo ""
