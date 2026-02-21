#!/bin/bash
# PRD-Team-Scores-Bug Task Loop
# Runs Claude Code iteratively to implement one task at a time

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/promptv2-Team-Scores-Bug.md"
PLAN_FILE="$SCRIPT_DIR/PLAN-Team-Scores-Bug-2026-01-31.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PRD-Team-Scores-Bug Task Loop${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: 'claude' CLI not found. Please install Claude Code.${NC}"
    exit 1
fi

# Check if prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo -e "${RED}Error: Prompt file not found at $PROMPT_FILE${NC}"
    exit 1
fi

# Check if plan file exists
if [ ! -f "$PLAN_FILE" ]; then
    echo -e "${RED}Error: Plan file not found at $PLAN_FILE${NC}"
    exit 1
fi

# Count remaining tasks
count_remaining_tasks() {
    grep -c "NOT STARTED\|IN PROGRESS" "$PLAN_FILE" 2>/dev/null || echo "0"
}

# Check if all tasks are complete
all_tasks_complete() {
    local remaining=$(count_remaining_tasks)
    [ "$remaining" -eq 0 ]
}

# Main loop
iteration=0
max_iterations=${1:-50}  # Default max 50 iterations, can override with arg

echo -e "${YELLOW}Starting task loop (max $max_iterations iterations)${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop at any time${NC}"
echo ""

cd "$PROJECT_ROOT"

while [ $iteration -lt $max_iterations ]; do
    iteration=$((iteration + 1))
    remaining=$(count_remaining_tasks)

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Iteration $iteration / $max_iterations${NC}"
    echo -e "${GREEN}Remaining tasks: $remaining${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Check if all tasks are complete
    if all_tasks_complete; then
        echo -e "${GREEN}All tasks complete! Exiting loop.${NC}"
        break
    fi

    # Run Claude with the prompt
    echo -e "${BLUE}Starting Claude Code...${NC}"
    echo ""

    # Read the prompt file and pass it to claude
    # Using --print to show output, --dangerously-skip-permissions for non-interactive
    claude --print "$(cat "$PROMPT_FILE")" || {
        echo -e "${RED}Claude exited with error. Pausing before next iteration...${NC}"
        echo -e "${YELLOW}Press Enter to continue or Ctrl+C to stop${NC}"
        read -r
    }

    echo ""
    echo -e "${YELLOW}Iteration $iteration complete.${NC}"
    echo -e "${YELLOW}Pausing 5 seconds before next iteration...${NC}"
    echo -e "${YELLOW}(Press Ctrl+C to stop)${NC}"
    sleep 5
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Task loop finished${NC}"
echo -e "${BLUE}Total iterations: $iteration${NC}"
echo -e "${BLUE}Remaining tasks: $(count_remaining_tasks)${NC}"
echo -e "${BLUE}========================================${NC}"
