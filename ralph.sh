#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# Change to the ralph-wigg directory where PROMPT.md lives
cd "$(dirname "$0")"

for ((i=1; i<=$1; i++)); do
  echo "Iteration $i"
  echo "--------------------------------"

  result=$(claude -p "$(cat PROMPT.md)" --allowedTools "Read,Write,Edit,Bash(npm:*),Bash(npx:*),Bash(node:*),Bash(git add:*),Bash(git commit:*),Bash(mkdir:*),Bash(cd:*),Bash(ls:*),Bash(cat:*),Bash(grep:*),mcp__playwright__*" --output-format text 2>&1) || true

  echo "$result"

  # Check for permission issues - exit early if found
  if [[ "$result" == *"need permission"* ]] || [[ "$result" == *"grant write"* ]] || [[ "$result" == *"grant access"* ]] || [[ "$result" == *"Please grant"* ]] || [[ "$result" == *"permission to write"* ]]; then
    echo ""
    echo "❌ PERMISSION ERROR DETECTED - Stopping early"
    echo "Check ~/.claude/settings.json or --allowedTools flag"
    exit 2
  fi

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "All tasks complete after $i iterations."
    exit 0
  fi

  echo ""
  echo "--- End of iteration $i ---"
  echo ""
done

echo "Reached max iterations ($1)"
exit 1
