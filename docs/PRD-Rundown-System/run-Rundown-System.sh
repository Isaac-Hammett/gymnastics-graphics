#!/bin/bash
# Autonomous loop for PRD-Rundown-System implementation

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

# MCP config file for Playwright and gymnastics tools
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

MAX_ITERATIONS=60  # Safety limit

cd "$PROJECT_ROOT"

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=== Iteration $i ($(date)) ===" | tee -a "$LOG_FILE"

    # Check if PRD is complete
    if grep -q "Status: COMPLETE" "$SCRIPT_DIR/PLAN-Rundown-System-Implementation.md" 2>/dev/null; then
        echo "All tasks complete!" | tee -a "$LOG_FILE"
        say "All tasks complete"
        exit 0
    fi

    cat "$SCRIPT_DIR/promptv2-Rundown-System.md" | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
        --mcp-config "$MCP_CONFIG" 2>&1 | \
        tee -a "$LOG_FILE"

    say "iteration $i complete"
    sleep 10
done

echo "Max iterations ($MAX_ITERATIONS) reached" | tee -a "$LOG_FILE"
say "Max iterations reached"
