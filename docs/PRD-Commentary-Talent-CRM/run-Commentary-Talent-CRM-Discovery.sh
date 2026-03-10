#!/bin/bash
# Single-run discovery for PRD-Commentary-Talent-CRM
#
# For NEW FEATURES: reviews the implementation plan for holes
#
# Run this BEFORE the implementation loop.
# Then manually run one execution iteration to verify the first task works end-to-end.
# Then run run-Commentary-Talent-CRM.sh for the automated loop.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/discovery-output.jsonl"

mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/screenshots"

MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

cd "$PROJECT_ROOT"

echo "=== Commentary-Talent-CRM Discovery ($(date)) ===" | tee -a "$LOG_FILE"

cat "$SCRIPT_DIR/prompt-Commentary-Talent-CRM-Discovery.md" | \
    claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
    --mcp-config "$MCP_CONFIG" 2>&1 | \
    tee -a "$LOG_FILE"

say "Discovery complete"
echo "=== Discovery finished ($(date)) ===" | tee -a "$LOG_FILE"
echo ""
echo "Next steps:"
echo "  1. Review updated plan: docs/PRD-Commentary-Talent-CRM/implementation-plan.md"
echo "  2. Manually run first execution iteration:"
echo "     cat $SCRIPT_DIR/prompt-Commentary-Talent-CRM.md | claude -p --dangerously-skip-permissions --mcp-config $MCP_CONFIG"
echo "  3. If that passes, start the loop:"
echo "     bash $SCRIPT_DIR/run-Commentary-Talent-CRM.sh"
