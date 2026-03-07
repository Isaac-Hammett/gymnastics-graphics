#!/bin/bash
# Single-run Playwright audit for 7-Team Women's Competition
# This discovers bugs — run BEFORE the implementation loop

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/audit-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

cd "$PROJECT_ROOT"

echo "=== 7-Team Audit Discovery ($(date)) ===" | tee -a "$LOG_FILE"

cat "$SCRIPT_DIR/prompt-7-Team-Audit-Discovery.md" | \
    claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
    --mcp-config "$MCP_CONFIG" 2>&1 | \
    tee -a "$LOG_FILE"

say "Audit discovery complete"
echo "=== Audit finished ($(date)) ===" | tee -a "$LOG_FILE"
echo ""
echo "Next step: Review bugs in docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md"
echo "Then run: bash docs/PRD-7-Team-Audit/run-7-Team-Audit.sh"
