#!/bin/bash
# Single-run discovery for PRD-{FeatureName}
#
# For NEW FEATURES: reviews the implementation plan for holes
# For BUG AUDITS: runs Playwright tests on the broken system
#
# Run this BEFORE the implementation loop.
# Then manually run one execution iteration to verify the first task works end-to-end.
# Then run run-{FeatureName}.sh for the automated loop.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/discovery-output.jsonl"

mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/screenshots"

MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

cd "$PROJECT_ROOT"

echo "=== {FeatureName} Discovery ($(date)) ===" | tee -a "$LOG_FILE"

cat "$SCRIPT_DIR/prompt-{FeatureName}-Discovery.md" | \
    claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
    --mcp-config "$MCP_CONFIG" 2>&1 | \
    tee -a "$LOG_FILE"

say "Discovery complete"
echo "=== Discovery finished ($(date)) ===" | tee -a "$LOG_FILE"
echo ""
echo "Next steps:"
echo "  1. Review updated plan: docs/PRD-{FeatureName}/implementation-plan.md"
echo "  2. Manually run first execution iteration:"
echo "     cat $SCRIPT_DIR/prompt-{FeatureName}.md | claude -p --dangerously-skip-permissions --mcp-config $MCP_CONFIG"
echo "  3. If that passes, start the loop:"
echo "     bash $SCRIPT_DIR/run-{FeatureName}.sh"
