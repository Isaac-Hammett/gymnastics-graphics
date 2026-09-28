#!/bin/bash
# PreToolUse hook for Edit / Write / MultiEdit / NotebookEdit in agent runs: file writes stay inside the run's
# own worktree (GG_WORKDIR) or the runs dir (GG_RUNS). ISA2-310's agent opened files by their main-checkout path
# and edited main directly, which blocked the dispatcher's merge (2026-09-27). Exit 2 blocks the call and tells
# the agent why. Outside an agent run (no GG_WORKDIR) it allows everything.
INPUT="$(cat)"
[ -z "${GG_WORKDIR:-}" ] && exit 0
TARGET="$(printf '%s' "$INPUT" | python3 -c 'import sys,json
try:
    t=json.load(sys.stdin).get("tool_input",{}); print(t.get("file_path") or t.get("notebook_path") or "")
except Exception:
    print("")' 2>/dev/null)"
[ -z "$TARGET" ] && exit 0
python3 - "$TARGET" "$GG_WORKDIR" "${GG_RUNS:-}" <<'EOF'
import os, sys
target, work, runs = sys.argv[1], sys.argv[2], sys.argv[3]
def real(p):
    # the file may not exist yet: resolve its nearest existing parent
    p = os.path.abspath(os.path.expanduser(p)); tail = []
    while not os.path.exists(p) and p != os.path.dirname(p):
        tail.append(os.path.basename(p)); p = os.path.dirname(p)
    return os.path.join(os.path.realpath(p), *reversed(tail))
t = real(target)
allowed = [real(work)] + ([real(runs)] if runs else [])
if any(t == a or t.startswith(a + os.sep) for a in allowed):
    sys.exit(0)
sys.stderr.write(f"guard_paths.sh blocked this write: {target} is outside your worktree ({work}). "
                 f"Edit the same file under your worktree instead; never edit the main checkout.\n")
sys.exit(2)
EOF
