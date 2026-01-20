#!/bin/bash
# Ralph loop for PRD-OBS-09 Preview System

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

# MCP config file for Playwright and gymnastics tools
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

while :; do
    cat "$SCRIPT_DIR/prompt-OBS-09-preview-system.md" | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
        --mcp-config "$MCP_CONFIG" 2>&1 | \
        tee -a "$LOG_FILE"
    say 'looping'
    sleep 10
done
