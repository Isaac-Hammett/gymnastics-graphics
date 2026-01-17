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

  # Run Claude with the prompt and allowed tools
  # MCP tools are prefixed with mcp__gymnastics__ for our custom server
  # and mcp__playwright__ for browser automation
  #
  # Tool categories:
  # - File ops: Read, Write, Edit, Glob, Grep
  # - Subagents: Task (for search-before-implement)
  # - Bash: npm, node, git, tar, rm, mkdir, ls, cd
  # - MCP Playwright: browser automation
  # - MCP Gymnastics: SSH, Firebase, AWS
  result=$(claude -p "$(cat PROMPT.md)" \
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
Bash(mkdir:*),\
Bash(cd:*),\
Bash(ls:*),\
Bash(tar:*),\
Bash(rm:*),\
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
    --output-format text 2>&1) || true

  echo "$result"

  # Check for permission issues - exit early if found
  if [[ "$result" == *"need permission"* ]] || \
     [[ "$result" == *"grant write"* ]] || \
     [[ "$result" == *"grant access"* ]] || \
     [[ "$result" == *"Please grant"* ]] || \
     [[ "$result" == *"permission to write"* ]]; then
    echo ""
    echo "========================================"
    echo "PERMISSION ERROR DETECTED - Stopping early"
    echo "Check ~/.claude/settings.json or --allowedTools flag"
    echo "========================================"
    exit 2
  fi

  # Check for completion marker
  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
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
