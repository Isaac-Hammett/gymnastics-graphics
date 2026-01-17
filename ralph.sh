#!/bin/bash

# Ralph Wiggum Loop - Autonomous Agent Runner
# Usage: ./ralph.sh <iterations>
#
# Runs Claude Code in a loop, with each iteration getting a fresh context window.
# Each iteration should complete exactly ONE task from plan.md.

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  echo ""
  echo "Example: ./ralph.sh 10"
  echo ""
  echo "This will run up to 10 iterations, with each iteration:"
  echo "  1. Reading plan.md to find next task with passes: false"
  echo "  2. Implementing and deploying the task"
  echo "  3. Verifying with MCP tools"
  echo "  4. Marking passes: true and committing"
  echo ""
  echo "The loop exits early if all tasks are complete."
  exit 1
fi

# Change to the project directory where PROMPT.md lives
cd "$(dirname "$0")"

# Create screenshots directory if it doesn't exist
mkdir -p screenshots

# Create temp directory for stream processing
RALPH_TMP="/tmp/claude/ralph-$$"
mkdir -p "$RALPH_TMP"

# Status file for subagent progress (well-known location)
STATUS_FILE="/tmp/claude/ralph-status.txt"

# Cleanup on exit
cleanup() {
  rm -rf "$RALPH_TMP"
  # Kill status monitor if running
  [ -n "$MONITOR_PID" ] && kill "$MONITOR_PID" 2>/dev/null
}
trap cleanup EXIT

# Monitor the status file in background and print new lines
start_status_monitor() {
  (
    local last_size=0
    while true; do
      if [ -f "$STATUS_FILE" ]; then
        local current_size=$(wc -c < "$STATUS_FILE" 2>/dev/null | tr -d ' ')
        if [ "$current_size" -gt "$last_size" ]; then
          # Read only the new content
          tail -c +$((last_size + 1)) "$STATUS_FILE" | while IFS= read -r line; do
            [ -n "$line" ] && printf "[%s]    ↳ %s\n" "$(date '+%H:%M:%S')" "$line"
          done
          last_size=$current_size
        fi
      fi
      sleep 0.3
    done
  ) &
  MONITOR_PID=$!
}

echo "========================================"
echo "Ralph Wiggum Loop Starting"
echo "Max iterations: $1"
echo "========================================"
echo ""

for ((i=1; i<=$1; i++)); do
  echo "========================================"
  echo "Iteration $i of $1"
  echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"
  echo ""

  # Reset counter files for this iteration
  OUTPUT_FILE="$RALPH_TMP/output.txt"
  SUBAGENT_FILE="$RALPH_TMP/subagents.txt"
  TOOL_FILE="$RALPH_TMP/tools.txt"
  > "$OUTPUT_FILE"
  > "$SUBAGENT_FILE"
  > "$TOOL_FILE"
  > "$STATUS_FILE"

  # Start monitoring the status file
  start_status_monitor

  # Run Claude with stream-json and process in realtime
  # MCP tools are prefixed with mcp__gymnastics__ for our custom server
  # and mcp__playwright__ for browser automation
  #
  # Tool categories:
  # - File ops: Read, Write, Edit, Glob, Grep
  # - Subagents: Task (for search-before-implement)
  # - Bash: npm, node, git, tar, rm, mkdir, ls, cd
  # - MCP Playwright: browser automation
  # - MCP Gymnastics: SSH, Firebase, AWS
  claude -p "$(cat PROMPT.md)" \
    --allowedTools "\
Read,\
Write,\
Edit,\
Glob,\
Grep,\
Task,\
Bash(npm:*),\
Bash(npx:*),\
Bash(node:*),\
Bash(git add:*),\
Bash(git commit:*),\
Bash(git push:*),\
Bash(git status:*),\
Bash(git diff:*),\
Bash(git log:*),\
Bash(mkdir:*),\
Bash(cd:*),\
Bash(ls:*),\
Bash(tar:*),\
Bash(rm:*),\
Bash(echo:*),\
mcp__playwright__*,\
mcp__gymnastics__ssh_exec,\
mcp__gymnastics__ssh_upload_file,\
mcp__gymnastics__ssh_download_file,\
mcp__gymnastics__firebase_get,\
mcp__gymnastics__firebase_set,\
mcp__gymnastics__firebase_update,\
mcp__gymnastics__firebase_delete,\
mcp__gymnastics__firebase_list_paths,\
mcp__gymnastics__firebase_export,\
mcp__gymnastics__aws_list_instances,\
mcp__gymnastics__aws_list_amis,\
mcp__gymnastics__aws_start_instance,\
mcp__gymnastics__aws_stop_instance,\
mcp__gymnastics__aws_list_security_group_rules\
" \
    --verbose \
    --output-format stream-json 2>&1 | while IFS= read -r line; do
      # Save all output for later analysis
      echo "$line" >> "$OUTPUT_FILE"

      # Try to parse as JSON - skip if not valid JSON
      if ! echo "$line" | jq -e '.' >/dev/null 2>&1; then
        # Not JSON, might be error output - show it
        if [ -n "$line" ]; then
          echo "[raw] $line"
        fi
        continue
      fi

      # Get the event type
      event_type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)

      case "$event_type" in
        "assistant")
          # Check for tool use in content array
          tool_names=$(echo "$line" | jq -r '.message.content[]? | select(.type=="tool_use") | .name' 2>/dev/null)

          for tool_name in $tool_names; do
            [ -z "$tool_name" ] && continue
            echo "$tool_name" >> "$TOOL_FILE"
            tool_count=$(wc -l < "$TOOL_FILE" | tr -d ' ')

            if [ "$tool_name" = "Task" ]; then
              subagent_desc=$(echo "$line" | jq -r '.message.content[]? | select(.type=="tool_use" and .name=="Task") | .input.description // "unknown"' 2>/dev/null | head -1)
              subagent_type=$(echo "$line" | jq -r '.message.content[]? | select(.type=="tool_use" and .name=="Task") | .input.subagent_type // "general"' 2>/dev/null | head -1)
              echo "$subagent_desc" >> "$SUBAGENT_FILE"
              subagent_count=$(wc -l < "$SUBAGENT_FILE" | tr -d ' ')
              printf "[%s] 🤖 Subagent #%d (%s): %s\n" "$(date '+%H:%M:%S')" "$subagent_count" "$subagent_type" "$subagent_desc"
            elif [[ "$tool_name" == mcp__* ]]; then
              # MCP tool - show abbreviated name
              short_name=$(echo "$tool_name" | sed 's/mcp__gymnastics__/mcp:/' | sed 's/mcp__playwright__/browser:/')
              printf "[%s] 🔧 %s (tools: %d)\n" "$(date '+%H:%M:%S')" "$short_name" "$tool_count"
            else
              printf "[%s] 🔧 %s (tools: %d)\n" "$(date '+%H:%M:%S')" "$tool_name" "$tool_count"
            fi
          done

          # Check for text content (Claude's thinking/response)
          text_content=$(echo "$line" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null | head -c 200)
          if [ -n "$text_content" ]; then
            # Show first line of Claude's response
            first_line=$(echo "$text_content" | head -1 | cut -c1-100)
            if [ -n "$first_line" ]; then
              printf "[%s] 💭 %s...\n" "$(date '+%H:%M:%S')" "$first_line"
            fi
          fi
          ;;

        "user")
          # Tool results coming back
          tool_results=$(echo "$line" | jq -r '.message.content[]? | select(.type=="tool_result") | .tool_use_id' 2>/dev/null | wc -l | tr -d ' ')
          if [ "$tool_results" -gt 0 ]; then
            printf "[%s] ✓ Tool results received: %d\n" "$(date '+%H:%M:%S')" "$tool_results"
          fi
          ;;

        "result")
          # Final result
          result_text=$(echo "$line" | jq -r '.result // empty' 2>/dev/null)
          if [ -n "$result_text" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "FINAL OUTPUT:"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "$result_text"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
          fi
          ;;

        "error")
          error_msg=$(echo "$line" | jq -r '.error.message // .error // "unknown error"' 2>/dev/null)
          printf "[%s] ❌ Error: %s\n" "$(date '+%H:%M:%S')" "$error_msg"
          ;;

        *)
          # Unknown event type - show if debugging
          if [ -n "$event_type" ]; then
            : # printf "[%s] [%s] event\n" "$(date '+%H:%M:%S')" "$event_type"
          fi
          ;;
      esac
    done

  # Stop status monitor
  [ -n "$MONITOR_PID" ] && kill "$MONITOR_PID" 2>/dev/null
  MONITOR_PID=""

  # Read the saved output for completion checks
  result=$(cat "$OUTPUT_FILE" 2>/dev/null || echo "")

  # Count from files (survives subshell)
  subagent_count=$(wc -l < "$SUBAGENT_FILE" 2>/dev/null | tr -d ' ' || echo "0")
  tool_count=$(wc -l < "$TOOL_FILE" 2>/dev/null | tr -d ' ' || echo "0")
  status_count=$(wc -l < "$STATUS_FILE" 2>/dev/null | tr -d ' ' || echo "0")

  # Show summary
  echo ""
  echo "┌──────────────────────────────────────────────────┐"
  printf "│ Summary: %2d subagents, %3d tools, %3d status msgs │\n" "$subagent_count" "$tool_count" "$status_count"
  echo "└──────────────────────────────────────────────────┘"

  # Note: Permission errors are now shown via the "error" event handler in the stream parser
  # The old string-based detection had too many false positives

  # Check for completion marker - must be in the final result text, not just anywhere in JSON
  # Extract just the result text and check there
  final_result=$(cat "$OUTPUT_FILE" | grep '"type":"result"' | jq -r '.result // empty' 2>/dev/null | tail -1)
  if [[ "$final_result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "========================================"
    echo "ALL TASKS COMPLETE!"
    echo "Finished after $i iterations."
    echo "========================================"
    exit 0
  fi

  echo ""
  echo "--- End of iteration $i ---"
  echo "Completed: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  # Small delay between iterations to avoid rate limiting
  if [ $i -lt $1 ]; then
    sleep 2
  fi
done

echo ""
echo "========================================"
echo "Reached max iterations ($1)"
echo "Check plan.md to see remaining tasks."
echo "========================================"
exit 1
