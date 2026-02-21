#!/bin/bash
# PRD-Team-Scores-Bug - Run ONE Task
# Use this to run a single task iteration manually

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/promptv2-Team-Scores-Bug.md"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "PRD-Team-Scores-Bug - Running ONE task"
echo "=========================================="
echo ""

# Run claude with the prompt file content
claude "$(cat "$PROMPT_FILE")"
