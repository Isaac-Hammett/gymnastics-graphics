#!/bin/bash
# Autonomous implementation loop for PRD-Commentary-Talent-CRM
#
# Prerequisites (do these manually before running this script):
#   1. Discovery run complete: bash run-Commentary-Talent-CRM-Discovery.sh
#   2. First iteration verified manually:
#      cat prompt-Commentary-Talent-CRM.md | claude -p --dangerously-skip-permissions --mcp-config ../.mcp.json
#
# Each iteration = a completely new Claude window (stateless).
# The prompt file must be self-contained — no context carries between iterations.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
PRD_FILE="$SCRIPT_DIR/PRD-Commentary-Talent-CRM-2026-03-10.md"

mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/screenshots"

MCP_CONFIG="$PROJECT_ROOT/.mcp.json"
MAX_ITERATIONS=40  # Safety limit

cd "$PROJECT_ROOT"

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=== Iteration $i ($(date)) ===" | tee -a "$LOG_FILE"

    # Check if PRD is complete
    if grep -q "Status: COMPLETE" "$PRD_FILE" 2>/dev/null; then
        echo "All tasks complete!" | tee -a "$LOG_FILE"
        say "All tasks complete"
        exit 0
    fi

    # Snapshot task count before running
    TASKS_BEFORE=$(grep -c "— COMPLETE" "$SCRIPT_DIR/implementation-plan.md" 2>/dev/null || echo "0")

    cat "$SCRIPT_DIR/prompt-Commentary-Talent-CRM.md" | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
        --mcp-config "$MCP_CONFIG" 2>&1 | \
        tee -a "$LOG_FILE"

    # Check if any task was completed this iteration
    TASKS_AFTER=$(grep -c "— COMPLETE" "$SCRIPT_DIR/implementation-plan.md" 2>/dev/null || echo "0")

    if [ "$TASKS_AFTER" -le "$TASKS_BEFORE" ]; then
        echo "⚠️  WARNING: No tasks completed this iteration (before=$TASKS_BEFORE, after=$TASKS_AFTER)" | tee -a "$LOG_FILE"
        say "Warning: no progress made. Check the log."
        # Stop instead of looping forever on a stuck state
        exit 1
    fi

    say "iteration $i complete, $TASKS_AFTER tasks done"
    sleep 3
done

echo "Max iterations ($MAX_ITERATIONS) reached" | tee -a "$LOG_FILE"
say "Max iterations reached"
