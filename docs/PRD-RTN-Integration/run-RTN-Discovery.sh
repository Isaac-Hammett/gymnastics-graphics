#!/bin/bash
# Discovery phase for RTN Integration - runs once to research and create PRD

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/discovery-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

# MCP config file for Playwright and gymnastics tools
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

cd "$PROJECT_ROOT"

echo "=== RTN Discovery Started ($(date)) ===" | tee -a "$LOG_FILE"

cat "$SCRIPT_DIR/prompt-RTN-Discovery.md" | \
    claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
    --mcp-config "$MCP_CONFIG" 2>&1 | \
    tee -a "$LOG_FILE"

echo "=== RTN Discovery Complete ($(date)) ===" | tee -a "$LOG_FILE"
say "RTN Discovery complete"
