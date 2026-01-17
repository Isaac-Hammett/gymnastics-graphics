#!/bin/bash

# Ralph Wiggum Loop - OBS Integration Test & Fix
#
# Architecture:
#   PHASE 1 (diagnostic): Claude spawns up to 20 parallel subagents for read-only tasks
#   PHASE 2 (test):       Claude runs 1 test at a time, creates FIX tasks for failures
#
# Usage: ./ralph.sh <iterations>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  echo ""
  echo "Example: ./ralph.sh 30"
  echo ""
  echo "This will run up to 30 iterations to test OBS Integration."
  echo ""
  echo "Phase 1 (diagnostic): Parallel subagents gather information"
  echo "Phase 2 (test):       Sequential tests with fix tasks for failures"
  exit 1
fi

# Change to this directory
cd "$(dirname "$0")"

# Create screenshots directory
mkdir -p screenshots

# Temp directory for stream processing
RALPH_TMP="/tmp/claude/ralph-obs-$$"
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

echo -e "${CYAN}========================================"
echo "OBS Integration Test - Ralph Loop"
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

  if [ "$PHASE" = "diagnostic" ]; then
    echo -e "${BLUE}[DIAGNOSTIC MODE] Claude will spawn parallel subagents${NC}"
  else
    echo -e "${GREEN}[TEST MODE] Claude will run tests sequentially${NC}"
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
mcp__playwright__browser_fill_form,\
mcp__playwright__browser_evaluate,\
mcp__playwright__browser_drag,\
mcp__playwright__browser_hover,\
mcp__playwright__browser_select_option,\
mcp__playwright__browser_file_upload,\
mcp__gymnastics__ssh_exec,\
mcp__gymnastics__ssh_upload_file,\
mcp__gymnastics__ssh_download_file,\
mcp__gymnastics__aws_list_instances,\
mcp__gymnastics__aws_start_instance,\
mcp__gymnastics__aws_stop_instance,\
mcp__gymnastics__firebase_get,\
mcp__gymnastics__firebase_set,\
mcp__gymnastics__firebase_update,\
mcp__gymnastics__firebase_delete,\
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

  # Check for completion - extract ONLY Claude's text responses from the JSON stream
  # The stream-json format includes the prompt, so we must parse out just Claude's output
  CLAUDE_TEXT_FILE="$RALPH_TMP/claude_text.txt"
  > "$CLAUDE_TEXT_FILE"

  # Extract text content from assistant messages and result events
  # This filters out the prompt and system messages, keeping only Claude's actual responses
  while IFS= read -r json_line; do
    if echo "$json_line" | jq -e '.' >/dev/null 2>&1; then
      event_type=$(echo "$json_line" | jq -r '.type // empty' 2>/dev/null)
      case "$event_type" in
        "assistant")
          # Extract text blocks from assistant messages
          echo "$json_line" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null >> "$CLAUDE_TEXT_FILE"
          ;;
        "result")
          # Extract final result text
          echo "$json_line" | jq -r '.result // empty' 2>/dev/null >> "$CLAUDE_TEXT_FILE"
          ;;
      esac
    fi
  done < "$OUTPUT_FILE"

  # Now check for completion signal in ONLY Claude's text output
  if grep -q '<RALPH_COMPLETE>ALL_DONE</RALPH_COMPLETE>' "$CLAUDE_TEXT_FILE" 2>/dev/null; then
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
