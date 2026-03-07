#!/bin/bash
# Autonomous loop for PRD-Team-Scores-Bug implementation
# Modeled after the successful run-Rundown-System.sh pattern

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

# MCP config file for Playwright and gymnastics tools
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

MAX_ITERATIONS=${1:-60}  # Safety limit, can override with arg

cd "$PROJECT_ROOT"

echo "=========================================="
echo "PRD-Team-Scores-Bug Autonomous Loop"
echo "Max iterations: $MAX_ITERATIONS"
echo "=========================================="

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=== Iteration $i ($(date)) ===" | tee -a "$LOG_FILE"

    # Check if all tasks are complete
    if grep -q "Status: COMPLETE" "$SCRIPT_DIR/PLAN-Team-Scores-Bug-2026-01-31.md" 2>/dev/null; then
        echo "All tasks complete!" | tee -a "$LOG_FILE"
        say "Team scores bug P R D complete"
        exit 0
    fi

    # Count remaining tasks for progress display
    NOT_STARTED=$(grep -c "NOT STARTED" "$SCRIPT_DIR/PLAN-Team-Scores-Bug-2026-01-31.md" 2>/dev/null || echo "0")
    IN_PROGRESS=$(grep -c "IN PROGRESS" "$SCRIPT_DIR/PLAN-Team-Scores-Bug-2026-01-31.md" 2>/dev/null || echo "0")
    COMPLETE=$(grep -c "| COMPLETE |" "$SCRIPT_DIR/PLAN-Team-Scores-Bug-2026-01-31.md" 2>/dev/null || echo "0")

    echo "Tasks: $COMPLETE complete, $IN_PROGRESS in progress, $NOT_STARTED remaining" | tee -a "$LOG_FILE"

    # Run Claude with prompt via stdin (avoids shell argument limits)
    cat "$SCRIPT_DIR/promptv3-Team-Scores-Bug.md" | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
        --mcp-config "$MCP_CONFIG" 2>&1 | \
        tee -a "$LOG_FILE"

    say "iteration $i complete"
    sleep 10
done

echo "Max iterations ($MAX_ITERATIONS) reached" | tee -a "$LOG_FILE"
say "Max iterations reached"
