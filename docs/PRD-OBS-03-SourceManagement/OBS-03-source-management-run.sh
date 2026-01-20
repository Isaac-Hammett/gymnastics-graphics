#!/bin/bash
# Ralph loop for PRD-OBS-03 Source Management

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

while :; do
    cat "$SCRIPT_DIR/prompt-OBS-03-source-management.md" | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json 2>&1 | \
        tee -a "$LOG_FILE"
    say 'looping'
    sleep 10
done
