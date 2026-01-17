#!/bin/bash

# Ralph Wiggum Loop - Generic Template (v2 - Parallel Research)
#
# Architecture:
#   PHASE 1 (research): Claude spawns up to 30 parallel subagents for read-only tasks
#   PHASE 2 (execute):  Claude runs 1 task at a time for build/test/deploy
#
# Usage: ./ralph.sh <iterations>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  echo ""
  echo "Example: ./ralph.sh 20"
  echo ""
  echo "Phase 1 (research): Parallel subagents gather information"
  echo "Phase 2 (execute):  Sequential tasks for build/test/deploy"
  exit 1
fi

# Change to this directory
cd "$(dirname "$0")"

# Create screenshots directory
mkdir -p screenshots

# Temp directory for stream processing
RALPH_TMP="/tmp/claude/ralph-$$"
mkdir -p "$RALPH_TMP"

# Cleanup on exit
cleanup() {
  rm -rf "$RALPH_TMP"
}
trap cleanup EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get current phase from plan.md
get_phase() {
  grep -o '"currentPhase":\s*"[^"]*"' plan.md 2>/dev/null | grep -o '"[^"]*"$' | tr -d '"' || echo "unknown"
}

# Get project name from PRD.md
PROJECT_NAME=$(head -1 PRD.md 2>/dev/null | sed 's/# //' | sed 's/ -.*//' || echo "Ralph Loop")

echo -e "${CYAN}========================================"
echo "$PROJECT_NAME - Ralph Loop v2"
echo "Max iterations: $1"
echo -e "========================================${NC}"
echo ""

for ((i=1; i<=$1; i++)); do
  PHASE=$(get_phase)

  echo -e "${CYAN}========================================"
  echo "Iteration $i of $1"
  echo -e "Phase: ${YELLOW}$PHASE${CYAN}"
  echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "========================================${NC}"
  echo ""

  if [ "$PHASE" = "research" ]; then
    echo -e "${BLUE}[RESEARCH MODE] Claude will spawn parallel subagents${NC}"
  else
    echo -e "${GREEN}[EXECUTE MODE] Claude will run tasks sequentially${NC}"
  fi
  echo ""

  OUTPUT_FILE="$RALPH_TMP/output.txt"
  > "$OUTPUT_FILE"

  # Run Claude with the prompt
  claude -p "$(cat PROMPT.md)" \
    --mcp-config ../.mcp.json \
    --allowedTools "\
Read,\
Write,\
Edit,\
Glob,\
Grep,\
Task,\
Bash(git:*),\
Bash(cd:*),\
Bash(ls:*),\
Bash(mkdir:*),\
Bash(tar:*),\
Bash(rm:*),\
Bash(npm:*),\
mcp__playwright__browser_navigate,\
mcp__playwright__browser_take_screenshot,\
mcp__playwright__browser_snapshot,\
mcp__playwright__browser_click,\
mcp__playwright__browser_console_messages,\
mcp__playwright__browser_network_requests,\
mcp__playwright__browser_type,\
mcp__playwright__browser_wait_for,\
mcp__gymnastics__ssh_exec,\
mcp__gymnastics__ssh_upload_file,\
mcp__gymnastics__ssh_download_file,\
mcp__gymnastics__aws_list_instances,\
mcp__gymnastics__aws_start_instance,\
mcp__gymnastics__aws_stop_instance,\
mcp__gymnastics__firebase_get,\
mcp__gymnastics__firebase_set,\
mcp__gymnastics__firebase_list_paths\
" \
    --verbose \
    --output-format stream-json 2>&1 | tee "$OUTPUT_FILE" | while IFS= read -r line; do
      # Parse JSON events
      if ! echo "$line" | jq -e '.' >/dev/null 2>&1; then
        [ -n "$line" ] && echo "[raw] $line"
        continue
      fi

      event_type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)

      case "$event_type" in
        "assistant")
          # Show tool calls
          tool_names=$(echo "$line" | jq -r '.message.content[]? | select(.type=="tool_use") | .name' 2>/dev/null)
          for tool_name in $tool_names; do
            [ -z "$tool_name" ] && continue

            # Color-code by tool type
            case "$tool_name" in
              Task)
                # Subagent spawn - highlight in cyan
                printf "${CYAN}[%s] ▶ SUBAGENT: %s${NC}\n" "$(date '+%H:%M:%S')" "$tool_name"
                ;;
              mcp__gymnastics__*)
                short_name=$(echo "$tool_name" | sed 's/mcp__gymnastics__/mcp:/')
                printf "${BLUE}[%s] Tool: %s${NC}\n" "$(date '+%H:%M:%S')" "$short_name"
                ;;
              mcp__playwright__*)
                short_name=$(echo "$tool_name" | sed 's/mcp__playwright__/browser:/')
                printf "${GREEN}[%s] Tool: %s${NC}\n" "$(date '+%H:%M:%S')" "$short_name"
                ;;
              *)
                printf "[%s] Tool: %s\n" "$(date '+%H:%M:%S')" "$tool_name"
                ;;
            esac
          done

          # Show text snippets
          text=$(echo "$line" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null | head -1 | cut -c1-100)
          [ -n "$text" ] && printf "[%s] %s...\n" "$(date '+%H:%M:%S')" "$text"
          ;;

        "result")
          result_text=$(echo "$line" | jq -r '.result // empty' 2>/dev/null)
          if [ -n "$result_text" ]; then
            echo ""
            echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "RESULT:"
            echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo "$result_text"
          fi
          ;;

        "error")
          error_msg=$(echo "$line" | jq -r '.error.message // .error // "unknown"' 2>/dev/null)
          printf "${RED}[%s] ERROR: %s${NC}\n" "$(date '+%H:%M:%S')" "$error_msg"
          ;;
      esac
    done

  # Check for completion
  if grep -q '<promise>COMPLETE</promise>' "$OUTPUT_FILE" 2>/dev/null; then
    echo ""
    echo -e "${GREEN}========================================"
    echo "ALL TASKS COMPLETE!"
    echo "Finished after $i iterations."
    echo -e "========================================${NC}"
    exit 0
  fi

  # Check if phase changed
  NEW_PHASE=$(get_phase)
  if [ "$NEW_PHASE" != "$PHASE" ]; then
    echo ""
    echo -e "${YELLOW}>>> Phase changed: $PHASE → $NEW_PHASE${NC}"
  fi

  echo ""
  echo "--- End of iteration $i ---"
  echo ""

  # Small delay between iterations
  [ $i -lt $1 ] && sleep 2
done

echo ""
echo -e "${YELLOW}========================================"
echo "Reached max iterations ($1)"
echo "Check plan.md for remaining tasks."
echo -e "========================================${NC}"
exit 1
