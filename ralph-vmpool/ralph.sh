#!/bin/bash

# Ralph Wiggum Loop - VM Pool Fix
# Usage: ./ralph.sh <iterations>

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  echo ""
  echo "Example: ./ralph.sh 20"
  echo ""
  echo "This will run up to 20 iterations to fix VM Pool Management."
  echo "Each iteration executes ONE task, verifies with screenshot, and exits."
  exit 1
fi

# Change to this directory
cd "$(dirname "$0")"

# Create screenshots directory
mkdir -p screenshots

# Temp directory for stream processing
RALPH_TMP="/tmp/claude/ralph-vmpool-$$"
mkdir -p "$RALPH_TMP"

# Cleanup on exit
cleanup() {
  rm -rf "$RALPH_TMP"
}
trap cleanup EXIT

echo "========================================"
echo "VM Pool Fix - Ralph Loop"
echo "Max iterations: $1"
echo "========================================"
echo ""

for ((i=1; i<=$1; i++)); do
  echo "========================================"
  echo "Iteration $i of $1"
  echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"
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
            short_name=$(echo "$tool_name" | sed 's/mcp__gymnastics__/mcp:/' | sed 's/mcp__playwright__/browser:/')
            printf "[%s] Tool: %s\n" "$(date '+%H:%M:%S')" "$short_name"
          done

          # Show text snippets
          text=$(echo "$line" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null | head -1 | cut -c1-100)
          [ -n "$text" ] && printf "[%s] %s...\n" "$(date '+%H:%M:%S')" "$text"
          ;;

        "result")
          result_text=$(echo "$line" | jq -r '.result // empty' 2>/dev/null)
          if [ -n "$result_text" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "RESULT:"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "$result_text"
          fi
          ;;

        "error")
          error_msg=$(echo "$line" | jq -r '.error.message // .error // "unknown"' 2>/dev/null)
          printf "[%s] ERROR: %s\n" "$(date '+%H:%M:%S')" "$error_msg"
          ;;
      esac
    done

  # Check for completion
  if grep -q '<promise>COMPLETE</promise>' "$OUTPUT_FILE" 2>/dev/null; then
    echo ""
    echo "========================================"
    echo "ALL TASKS COMPLETE!"
    echo "Finished after $i iterations."
    echo "========================================"
    exit 0
  fi

  echo ""
  echo "--- End of iteration $i ---"
  echo ""

  # Small delay between iterations
  [ $i -lt $1 ] && sleep 2
done

echo ""
echo "========================================"
echo "Reached max iterations ($1)"
echo "Check plan.md for remaining tasks."
echo "========================================"
exit 1
