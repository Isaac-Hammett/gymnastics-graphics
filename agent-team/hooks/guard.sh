#!/bin/bash
# Optional PreToolUse hook for Bash calls in agent runs. Blocks the commands the hard rules forbid even when a prompt slips.
# Install: point a PreToolUse hook (matcher "Bash") at this script, e.g. with --settings agent-team/hooks/settings.json
# (see README). Exit 2 blocks the call and returns the reason to the agent.
INPUT="$(cat)"
CMD="$(printf '%s' "$INPUT" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))
except Exception:
    print("")' 2>/dev/null)"
[ -z "$CMD" ] && exit 0
deny() { echo "guard.sh blocked this command: $1" >&2; exit 2; }
case "$CMD" in
  *"git push"*)                                       deny "git push (the dispatcher pushes main)";;
  *"--force"*|*" -f origin"*|*"--force-with-lease"*)  deny "force flag";;
  *"git rebase"*|*"filter-branch"*|*"git reset --hard origin"*) deny "history rewrite";;
  *"git add -A"*|*"git add ."*|*"git add --all"*)     deny "git add -A (stage specific paths)";;
  *"rm -rf /"*|*"rm -rf ~"*|*'rm -rf $HOME'*)         deny "rm -rf outside the worktree";;
  *"aws ec2 "*|*"aws ssm "*)                          deny "AWS CLI";;
  *"ssh "*"@"*)                                       deny "ssh to a VM";;
esac
exit 0
