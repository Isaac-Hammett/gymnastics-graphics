#!/bin/bash
# Autonomous implementation loop for PRD-RTN-Stats-Integration (Phase 6 bug fixes + Phase 7 stat types)
#
# Prerequisites (do these manually before running this script):
#   1. Review complete: bugs documented in BUGS.md, tasks in implementation plan
#   2. First iteration verified manually:
#      cat promptv2-RTN-Stats-Integration.md | claude -p --dangerously-skip-permissions --mcp-config ../../.mcp.json
#
# Each iteration = a completely new Claude window (stateless).
# The prompt file must be self-contained — no context carries between iterations.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/summary.log"
IMPL_PLAN="$SCRIPT_DIR/PLAN-RTN-Stats-Integration-Implementation.md"

mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/screenshots"

MCP_CONFIG="$PROJECT_ROOT/.mcp.json"
MAX_ITERATIONS=25  # 17 tasks + buffer for retries

cd "$PROJECT_ROOT"

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=== Iteration $i started at $(date) ===" | tee -a "$LOG_FILE"

    # Check if all Phase 6+7 tasks are complete
    NOT_STARTED=$(grep -c "| NOT STARTED |" "$IMPL_PLAN" 2>/dev/null || echo "0")
    IN_PROGRESS=$(grep -c "| IN PROGRESS |" "$IMPL_PLAN" 2>/dev/null || echo "0")

    if [ "$NOT_STARTED" -eq 0 ] && [ "$IN_PROGRESS" -eq 0 ]; then
        echo "All tasks complete!" | tee -a "$LOG_FILE"
        say "All tasks complete"
        exit 0
    fi

    # Snapshot task count before running
    TASKS_BEFORE=$(grep -c "| COMPLETE |" "$IMPL_PLAN" 2>/dev/null || echo "0")

    # Run Claude — suppress output, just capture exit code
    cat "$SCRIPT_DIR/promptv2-RTN-Stats-Integration.md" | \
        claude -p --dangerously-skip-permissions \
        --mcp-config "$MCP_CONFIG" > /dev/null 2>&1

    EXIT_CODE=$?

    # Check if any task was completed this iteration
    TASKS_AFTER=$(grep -c "| COMPLETE |" "$IMPL_PLAN" 2>/dev/null || echo "0")

    echo "  Finished at $(date) | exit=$EXIT_CODE | tasks: $TASKS_BEFORE -> $TASKS_AFTER | remaining: $((NOT_STARTED + IN_PROGRESS - (TASKS_AFTER - TASKS_BEFORE)))" | tee -a "$LOG_FILE"

    if [ "$TASKS_AFTER" -le "$TASKS_BEFORE" ]; then
        echo "  WARNING: No tasks completed this iteration" | tee -a "$LOG_FILE"
        say "Warning: no progress made. Check the log."
        exit 1
    fi

    say "iteration $i complete, $TASKS_AFTER tasks done"
    sleep 3
done

echo "Max iterations ($MAX_ITERATIONS) reached" | tee -a "$LOG_FILE"
say "Max iterations reached"
