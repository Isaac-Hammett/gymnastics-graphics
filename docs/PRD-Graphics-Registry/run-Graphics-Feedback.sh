#!/bin/bash
# Autonomous implementation loop for Graphics Feedback tasks
# Covers: GFX-T1 through GFX-T7 (Graphics Registry) + Task 44-45 (RTN Stats Phase 7)
#
# Prerequisites (do these manually before running this script):
#   1. Plans updated: tasks in both implementation plans
#   2. First iteration verified manually:
#      cat promptv3-Graphics-Feedback.md | claude -p --dangerously-skip-permissions --mcp-config ../../.mcp.json
#
# Each iteration = a completely new Claude window (stateless).
# The prompt file must be self-contained — no context carries between iterations.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/feedback-summary.log"
GFX_PLAN="$SCRIPT_DIR/PLAN-Graphics-Registry-Implementation.md"
RTN_PLAN="$PROJECT_ROOT/docs/PRD-RTN-Stats-Integration/PLAN-RTN-Stats-Integration-Implementation.md"

mkdir -p "$SCRIPT_DIR/logs"

MCP_CONFIG="$PROJECT_ROOT/.mcp.json"
MAX_ITERATIONS=12  # 7 tasks + buffer for retries

# Safe grep -c: returns count without the double-output bug
# (grep -c exits 1 on zero matches, which triggers || echo "0" and produces "0\n0")
count_matches() {
    local count
    count=$(grep -c "$1" "$2" 2>/dev/null) || true
    echo "${count:-0}"
}

cd "$PROJECT_ROOT"

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=== Iteration $i started at $(date) ===" | tee -a "$LOG_FILE"

    # Check if all tasks are complete across both plans
    GFX_REMAINING=$(count_matches "| NOT STARTED |" "$GFX_PLAN")
    RTN_REMAINING=$(count_matches "| NOT STARTED |" "$RTN_PLAN")
    GFX_PROGRESS=$(count_matches "| IN PROGRESS |" "$GFX_PLAN")
    RTN_PROGRESS=$(count_matches "| IN PROGRESS |" "$RTN_PLAN")
    TOTAL_REMAINING=$((GFX_REMAINING + RTN_REMAINING + GFX_PROGRESS + RTN_PROGRESS))

    if [ "$TOTAL_REMAINING" -eq 0 ]; then
        echo "All tasks complete!" | tee -a "$LOG_FILE"
        say "All graphics feedback tasks complete"
        exit 0
    fi

    echo "  Tasks remaining: GFX=$((GFX_REMAINING + GFX_PROGRESS)) RTN=$((RTN_REMAINING + RTN_PROGRESS))" | tee -a "$LOG_FILE"

    # Snapshot task counts before running
    GFX_DONE_BEFORE=$(count_matches "| COMPLETE |" "$GFX_PLAN")
    RTN_DONE_BEFORE=$(count_matches "| COMPLETE |" "$RTN_PLAN")
    TOTAL_BEFORE=$((GFX_DONE_BEFORE + RTN_DONE_BEFORE))

    # Run Claude
    cat "$SCRIPT_DIR/promptv3-Graphics-Feedback.md" | \
        claude -p --dangerously-skip-permissions \
        --mcp-config "$MCP_CONFIG" > /dev/null 2>&1

    EXIT_CODE=$?

    # Check progress
    GFX_DONE_AFTER=$(count_matches "| COMPLETE |" "$GFX_PLAN")
    RTN_DONE_AFTER=$(count_matches "| COMPLETE |" "$RTN_PLAN")
    TOTAL_AFTER=$((GFX_DONE_AFTER + RTN_DONE_AFTER))

    echo "  Finished at $(date) | exit=$EXIT_CODE | tasks: $TOTAL_BEFORE -> $TOTAL_AFTER | remaining: $((TOTAL_REMAINING - (TOTAL_AFTER - TOTAL_BEFORE)))" | tee -a "$LOG_FILE"

    if [ "$TOTAL_AFTER" -le "$TOTAL_BEFORE" ]; then
        echo "  WARNING: No tasks completed this iteration" | tee -a "$LOG_FILE"
        say "Warning: no progress made. Check the log."
        exit 1
    fi

    say "iteration $i complete, $TOTAL_AFTER tasks done"
    sleep 3
done

echo "Max iterations ($MAX_ITERATIONS) reached" | tee -a "$LOG_FILE"
say "Max iterations reached"
