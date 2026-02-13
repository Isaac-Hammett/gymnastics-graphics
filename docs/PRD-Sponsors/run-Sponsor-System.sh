#!/bin/bash
# Autonomous loop for PRD-Sponsor-System implementation
# Created 2026-02-13: Uses v3 prompt (minimal context per iteration)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

# MCP config file for Playwright and gymnastics tools
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

MAX_ITERATIONS=20  # 12 tasks + buffer for retries

cd "$PROJECT_ROOT"

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=== Iteration $i ($(date)) ===" | tee -a "$LOG_FILE"

    # Check if all tasks are complete
    NOT_STARTED=$(grep -c "NOT STARTED" "$SCRIPT_DIR/PLAN-Sponsor-System-Implementation.md" 2>/dev/null || echo "0")
    COMPLETE=$(grep -c "| COMPLETE |" "$SCRIPT_DIR/PLAN-Sponsor-System-Implementation.md" 2>/dev/null || echo "0")
    echo "Tasks: $COMPLETE complete, $NOT_STARTED remaining" | tee -a "$LOG_FILE"

    # Exit if all tasks are done (0 NOT STARTED in Quick Task Index)
    if [ "$NOT_STARTED" -eq 0 ]; then
        echo "All sponsor system tasks complete!" | tee -a "$LOG_FILE"
        say "All sponsor system tasks complete"
        exit 0
    fi

    # Check if status line says complete
    if grep -q "Status: COMPLETE" "$SCRIPT_DIR/PLAN-Sponsor-System-Implementation.md" 2>/dev/null; then
        echo "Implementation plan marked COMPLETE!" | tee -a "$LOG_FILE"
        say "Sponsor system complete"
        exit 0
    fi

    cat "$SCRIPT_DIR/promptv3-Sponsor-System.md" | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
        --mcp-config "$MCP_CONFIG" 2>&1 | \
        tee -a "$LOG_FILE"

    say "iteration $i complete"
    sleep 10
done

echo "Max iterations ($MAX_ITERATIONS) reached" | tee -a "$LOG_FILE"
say "Max iterations reached"
