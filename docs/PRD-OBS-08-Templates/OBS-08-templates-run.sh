#!/bin/bash
# Ralph loop for PRD-OBS-08 Templates

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

while :; do
    cat "$SCRIPT_DIR/prompt-OBS-08-templates.md" | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json 2>&1 | \
        tee -a "$LOG_FILE"
    say 'looping'
    sleep 10
done
