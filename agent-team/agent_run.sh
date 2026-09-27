#!/bin/bash
# agent_run.sh <KEY> <role> [model] [--prepare-only]
#   KEY: ISA2-123 (ticket run) | ISA2-123.verify (verifier run for ISA2-123) | PLANNER | REVIEWER
#   --prepare-only: fetch the ticket, make the worktree, write the prompt, print the plan; do not launch claude.
#
# The whole body lives in main() so the file can be replaced atomically (write a temp file, then mv) while
# runs are live. Editing a running bash script in place corrupts live agents.
#
# Exit codes: claude's own (0 done, 1 stuck, 124 timeout) | 2 Linear unreachable | 3 worktree prep failed
# Artifacts: runs/<KEY>.prompt.md, .answer.md (written by the agent), .result.json (cost), .exit; logs/<KEY>.log, .err

main() {
  set -u
  local KEY="${1:?usage: agent_run.sh <KEY> <role> [model] [--prepare-only]}"
  local ROLE="${2:?role required}"
  local MODEL_OVERRIDE="" PREPARE_ONLY=0 arg
  for arg in "${@:3}"; do
    case "$arg" in
      --prepare-only) PREPARE_ONLY=1 ;;
      *) MODEL_OVERRIDE="$arg" ;;
    esac
  done

  local TEAM_DIR; TEAM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local ROOT; ROOT="$(cd "$TEAM_DIR/.." && pwd)"
  # Canonical paths for every tool the agent calls, even the copies inside its worktree.
  export GG_ROOT="$ROOT" GG_TEAM_DIR="$TEAM_DIR" GG_KEY="$KEY" GG_ROLE="$ROLE"
  eval "$(python3 "$TEAM_DIR/tools/common.py" export-env)"
  local RUNS="$TEAM_DIR/runs" LOGS="$TEAM_DIR/logs" WT_DIR="$GG_WORKTREES"
  mkdir -p "$RUNS" "$LOGS" "$WT_DIR"
  no_aws
  local MAIN="${MAIN_BRANCH:-main}"
  local LINEAR="python3 $TEAM_DIR/tools/linear.py"
  local TIMEOUT_MIN="${AGENT_TIMEOUT_MIN:-180}" MAX_TURNS="${CLAUDE_MAX_TURNS:-150}"
  local TO; TO="$(command -v gtimeout || command -v timeout || true)"

  if [ ! -f "$TEAM_DIR/agents/$ROLE.md" ]; then
    echo "agent_run.sh: no role file agents/$ROLE.md" >&2
    echo 1 > "$RUNS/$KEY.exit"; return 1
  fi

  # A stale answer must never count for this run.
  rm -f "$RUNS/$KEY.exit" "$RUNS/$KEY.answer.md" "$RUNS/$KEY.result.json"

  local T="" KIND="" WORKDIR="" EXTRA="" LABELS=""
  case "$KEY" in
    PLANNER|REVIEWER)
      KIND="system"; WORKDIR="$ROOT"
      python3 "$TEAM_DIR/sync.py" --snapshot || { echo 2 > "$RUNS/$KEY.exit"; return 2; }
      ;;
    *.verify)
      KIND="verify"; T="${KEY%.verify}"; TIMEOUT_MIN="${VERIFY_TIMEOUT_MIN:-60}"
      fetch_ticket "$T" "$RUNS" "$LINEAR" || { echo 2 > "$RUNS/$KEY.exit"; return 2; }
      prepare_verify_worktree "$WT_DIR/_verify" "$MAIN" "$ROOT" || {
        echo "agent_run.sh: verify worktree prep failed" >&2; echo 3 > "$RUNS/$KEY.exit"; return 3; }
      WORKDIR="$WT_DIR/_verify"
      EXTRA="$(verify_context "$T" "$MAIN" "$RUNS" "$ROOT" "$LINEAR")"
      ;;
    *)
      KIND="work"; T="$KEY"
      fetch_ticket "$T" "$RUNS" "$LINEAR" || { echo 2 > "$RUNS/$KEY.exit"; return 2; }
      LABELS="$(python3 -c 'import sys,json; print(",".join(json.load(open(sys.argv[1])).get("labels",[])))' "$RUNS/$T.ticket.json")"
      local BRANCH
      BRANCH="$(python3 -c 'import sys,json; print(json.load(open(sys.argv[1])).get("branch") or "")' "$RUNS/$T.ticket.json")"
      [ -z "$BRANCH" ] && BRANCH="agent/$(echo "$T" | tr '[:upper:]' '[:lower:]')"
      echo "$BRANCH" > "$RUNS/$T.branch"
      prepare_ticket_worktree "$WT_DIR/$T" "$BRANCH" "$MAIN" "$ROOT" || {
        echo "agent_run.sh: ticket worktree prep failed (branch $BRANCH)" >&2; echo 3 > "$RUNS/$KEY.exit"; return 3; }
      WORKDIR="$WT_DIR/$T"
      ;;
  esac

  local MODELS MODEL FALLBACK
  MODELS="$(python3 "$TEAM_DIR/tools/common.py" model "$ROLE" "$LABELS" "$MODEL_OVERRIDE")"
  MODEL="$(printf '%s\n' "$MODELS" | sed -n 1p)"
  FALLBACK="$(printf '%s\n' "$MODELS" | sed -n 2p)"

  build_prompt "$KIND" "$ROLE" "$KEY" "$T" "$TEAM_DIR" "$ROOT" "$WORKDIR" "$EXTRA" > "$RUNS/$KEY.prompt.md"
  local AGENTS_JSON; AGENTS_JSON="$(python3 "$TEAM_DIR/tools/common.py" agents-json)"

  if [ "$PREPARE_ONLY" = 1 ]; then
    echo "prepared $KEY: role=$ROLE model=$MODEL fallback=${FALLBACK:-none}"
    echo "  workdir: $WORKDIR"
    echo "  prompt:  $RUNS/$KEY.prompt.md ($(wc -c < "$RUNS/$KEY.prompt.md") bytes)"
    return 0
  fi
  if [ -z "$TO" ]; then
    echo "agent_run.sh: gtimeout/timeout not found (brew install coreutils)" >&2
    echo 1 > "$RUNS/$KEY.exit"; return 1
  fi

  # Heartbeat comment every 10 minutes on ticket and verify runs. It stops itself when this script dies
  # (tmux kill-session), so a killed run never leaves a loop posting comments.
  local PARENT=$$
  if [ -n "$T" ]; then
    ( while sleep 600; do
        kill -0 "$PARENT" 2>/dev/null || exit 0
        $LINEAR comment "$T" "Heartbeat: \`$KEY\` still running ($ROLE on $MODEL) at $(date '+%H:%M')." >/dev/null 2>&1 || true
      done ) &
    GG_HB_PID=$!
    trap '[ -n "${GG_HB_PID:-}" ] && kill "$GG_HB_PID" 2>/dev/null' EXIT HUP INT TERM
  fi

  local ALLOWED="Agent,Bash,Read,Write,Edit,MultiEdit,Glob,Grep,WebSearch,WebFetch,TodoWrite,mcp__playwright__*,mcp__gymnastics__firebase_get,mcp__gymnastics__firebase_list_paths,mcp__gymnastics__firebase_export,mcp__gymnastics__firebase_set,mcp__gymnastics__firebase_update"
  local DISALLOWED="mcp__gymnastics__firebase_delete,mcp__gymnastics__aws_*,mcp__gymnastics__ssh_*"
  local ARGS=(-p --model "$MODEL" --max-turns "$MAX_TURNS" --permission-mode acceptEdits
              --allowedTools "$ALLOWED" --disallowedTools "$DISALLOWED"
              --mcp-config "$ROOT/.mcp.json" --strict-mcp-config --agents "$AGENTS_JSON"
              --add-dir "$RUNS" --output-format stream-json --verbose)
  [ -n "$FALLBACK" ] && ARGS+=(--fallback-model "$FALLBACK")

  echo "=== $(date '+%F %T') start $KEY role=$ROLE model=$MODEL workdir=$WORKDIR" >> "$LOGS/$KEY.log"
  # Process substitution, not a pipe: a pipe hangs on tee when a child keeps stdout open.
  ( cd "$WORKDIR" && "$TO" "${TIMEOUT_MIN}m" claude "${ARGS[@]}" < "$RUNS/$KEY.prompt.md" 2>> "$LOGS/$KEY.err" \
      > >(python3 "$TEAM_DIR/tools/streamlog.py" "$LOGS/$KEY.log" "$RUNS/$KEY.result.json") )
  local RC=$?
  [ -n "${GG_HB_PID:-}" ] && kill "$GG_HB_PID" 2>/dev/null
  sleep 2
  echo "=== $(date '+%F %T') end $KEY rc=$RC" >> "$LOGS/$KEY.log"
  echo "$RC" > "$RUNS/$KEY.exit"
  return "$RC"
}

# Agents never touch AWS. This also protects production Firebase: on every boot the coordinator syncs the VM pool
# with EC2 and deletes vmPool/vms entries that AWS does not list. With no credentials that sync fails harmlessly.
no_aws() {
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_SECURITY_TOKEN AWS_CREDENTIAL_EXPIRATION AWS_WEB_IDENTITY_TOKEN_FILE AWS_ROLE_ARN
  export AWS_PROFILE=agent-team-no-aws AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_EC2_METADATA_DISABLED=true
}

fetch_ticket() {
  local T="$1" RUNS="$2" LINEAR="$3"
  $LINEAR issue "$T" --json > "$RUNS/$T.ticket.json" || return 1
  $LINEAR render "$RUNS/$T.ticket.json" > "$RUNS/$T.ticket.md" || return 1
}

# Symlink node_modules and the canonical runs/logs dirs from the main checkout, and copy gitignored local env
# files into a worktree. The runs symlink makes the relative path agent-team/runs/<T>.answer.md land in the
# canonical runs dir, where the dispatcher looks.
link_deps() {
  local DIR="$1" ROOT="$2" d
  for d in "" show-controller server; do
    if [ -d "$ROOT/$d/node_modules" ] && [ ! -e "$DIR/$d/node_modules" ]; then
      ln -s "$ROOT/$d/node_modules" "$DIR/$d/node_modules"
    fi
  done
  for d in runs logs; do
    [ -e "$DIR/agent-team/$d" ] || ln -s "$ROOT/agent-team/$d" "$DIR/agent-team/$d"
  done
  [ -f "$ROOT/show-controller/.env.local" ] && [ ! -e "$DIR/show-controller/.env.local" ] && cp "$ROOT/show-controller/.env.local" "$DIR/show-controller/.env.local"
  [ -f "$ROOT/server/.env" ] && [ ! -e "$DIR/server/.env" ] && cp "$ROOT/server/.env" "$DIR/server/.env"
  return 0
}

# One worktree per ticket on the ticket branch, created from MAIN. Re-used across retries (main merged in).
git_or_fail() {  # run git, print its stderr on failure so the dispatcher log says why
  local out
  out="$(git "$@" 2>&1)" || { echo "git ${*:1:4}...: $out" | tail -5 >&2; return 1; }
}

prepare_ticket_worktree() {
  local DIR="$1" BRANCH="$2" MAIN="$3" ROOT="$4"
  if [ -e "$DIR/.git" ]; then
    git_or_fail -C "$DIR" merge --no-edit "$MAIN" || { git -C "$DIR" merge --abort >/dev/null 2>&1; return 1; }
  elif git -C "$ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git_or_fail -C "$ROOT" worktree add "$DIR" "$BRANCH" || return 1
    git_or_fail -C "$DIR" merge --no-edit "$MAIN" || { git -C "$DIR" merge --abort >/dev/null 2>&1; return 1; }
  else
    git_or_fail -C "$ROOT" worktree add -b "$BRANCH" "$DIR" "$MAIN" || return 1
  fi
  link_deps "$DIR" "$ROOT"
}

# A single detached worktree that always sits at MAIN's tip. Detached, so MAIN can be checked out elsewhere.
prepare_verify_worktree() {
  local DIR="$1" MAIN="$2" ROOT="$3"
  if [ ! -e "$DIR/.git" ]; then
    git_or_fail -C "$ROOT" worktree add --detach "$DIR" "$MAIN" || return 1
  fi
  # -f: dev-server runs regenerate tracked registry files here; the verify lane never keeps local changes.
  git_or_fail -C "$DIR" checkout -f --detach "$MAIN" || return 1
  link_deps "$DIR" "$ROOT"
}

# What the verifier gets besides the ticket: the implementer's answer, the stamped commits, a bounded diff, evidence files.
verify_context() {
  local T="$1" MAIN="$2" RUNS="$3" ROOT="$4" LINEAR="$5"
  echo "## Implementer's answer for $T"
  if [ -f "$RUNS/$T.answer.md" ]; then cat "$RUNS/$T.answer.md"; else $LINEAR answer "$T" 2>/dev/null || echo "(no answer found)"; fi
  echo; echo "## Commits on $MAIN stamped \`Ticket: $T\`"
  local SHAS; SHAS="$(git -C "$ROOT" log "$MAIN" "--grep=^Ticket: $T\$" --format=%h)"
  if [ -z "$SHAS" ]; then
    echo "(none — that alone is a FAIL unless the ticket needs no code change)"
  else
    git -C "$ROOT" log "$MAIN" "--grep=^Ticket: $T\$" --format='- %h %s'
    echo; echo "## Diff stat"
    local s; for s in $SHAS; do git -C "$ROOT" show "$s" --stat --format='--- %h %s' | head -60; done
    echo; echo "## Patch (first 1500 lines; use \`git show <hash>\` in your worktree for the rest)"
    for s in $SHAS; do git -C "$ROOT" show "$s" --format='=== %h %s'; done | head -1500
  fi
  echo; echo "## Evidence committed on $MAIN under docs/verification/$T/"
  git -C "$ROOT" ls-tree -r --name-only "$MAIN" -- "docs/verification/$T" 2>/dev/null | grep . || echo "(none)"
}

build_prompt() {
  local KIND="$1" ROLE="$2" KEY="$3" T="$4" TEAM_DIR="$5" ROOT="$6" WORKDIR="$7" EXTRA="$8"
  local RUNS="$TEAM_DIR/runs"
  cat "$TEAM_DIR/agents/$ROLE.md"
  echo; echo "# Your ticket"; echo "# $KEY"; echo
  if [ -n "$T" ]; then cat "$RUNS/$T.ticket.md"; echo; fi
  if [ "$KIND" = "system" ]; then
    echo "Board snapshot: $RUNS/board.json · gaps: $RUNS/gaps.json · proposed tickets: $RUNS/proposed.json"
    echo "Read them with the Read tool or a short python3 one-liner; do not re-fetch the whole board from Linear."
  fi
  if [ -n "$EXTRA" ]; then echo; echo "$EXTRA"; fi
  echo; echo "# Run facts"
  echo "- Repo root: $ROOT"
  echo "- Your working directory: $WORKDIR (a git worktree; stay inside it)"
  echo "- Agent-team dir: $TEAM_DIR · board CLI: python3 $TEAM_DIR/tools/linear.py · store CLI: python3 $TEAM_DIR/tools/store.py"
  echo "- Answer file: $RUNS/$KEY.answer.md"
  echo "- Test competition (the only Firebase path you may write under): competitions/${TEST_COMP_ID:-UNSET}/"
  echo; echo "# Closing instructions"
  case "$KIND" in
    work) cat <<EOF
- Follow the contract in CLAUDE.md. Use the CLIs above; never change Linear state or labels yourself.
- Commit inside $WORKDIR with the trailer line \`Ticket: $T\` as the last line of the commit message. Do not push.
- Write $RUNS/$KEY.answer.md: line 1 is \`ANSWER:\`, then one line per Done-when item (\`- [x]\` / \`- [ ]\`) with its proof, then 3 to 10 lines a person can act on. Post it with:
  python3 $TEAM_DIR/tools/linear.py comment $T --file $RUNS/$KEY.answer.md
- Exit 0 when every Done-when line is met. Exit 1 when stuck, with the answer saying what is missing.
EOF
    ;;
    verify) cat <<EOF
- You are the verifier. Do not edit code. Start the dev servers with \`bash $TEAM_DIR/devserver.sh start\` and stop them at the end.
- Write $RUNS/$KEY.answer.md: line 1 is exactly \`VERDICT: PASS\`, \`VERDICT: FAIL\`, or \`VERDICT: BLOCKED\`; then one line per Done-when item with what you checked and the evidence path; then anything the implementer should know. Post it with:
  python3 $TEAM_DIR/tools/linear.py comment $T --file $RUNS/$KEY.answer.md
- On FAIL, create one fix ticket per shape of failure (not per item):
  python3 $TEAM_DIR/tools/linear.py create --fix --for $T --title "..." --desc-file <file with Done-when lines>
- Exit 0 after writing a PASS or FAIL verdict. Exit 1 only when BLOCKED (servers will not start, credentials missing).
EOF
    ;;
    system) cat <<EOF
- Write $RUNS/$KEY.answer.md (line 1: \`ANSWER:\`). Make every Linear change through the CLI. Never change ticket states except through the approve/reject/escalate/recommend commands. Never write code or output.
- Exit 0 when done.
EOF
    ;;
  esac
}

main "$@"
