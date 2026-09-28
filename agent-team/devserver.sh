#!/bin/bash
# devserver.sh start|stop|status|logs — a coordinator + SPA pair for one agent run.
#
# agent_run.sh calls this OUTSIDE the agent's sandbox before launching claude, so the servers can reach Firebase
# and the test VM's OBS. The agent only talks to them on 127.0.0.1. Defaults are the verify lane
# (<worktrees>/_verify on :3099 / :5199); implementer runs pass their own worktree and ports:
#   GG_VERIFY_WT=<worktree> VERIFY_API_PORT=<p> VERIFY_SPA_PORT=<p> devserver.sh start
# After server edits, `devserver.sh restart-api` restarts the coordinator (agent_run.sh does this when the agent
# touches runs/<KEY>.restart).
main() {
  local CMD="${1:-status}"
  local TEAM_DIR; TEAM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [ -n "${GG_TEAM_DIR:-}" ] && TEAM_DIR="$GG_TEAM_DIR"
  eval "$(python3 "$TEAM_DIR/tools/common.py" export-env)"
  local WT="${GG_VERIFY_WT:-$GG_WORKTREES/_verify}"
  local API_PORT="${VERIFY_API_PORT:-3099}" SPA_PORT="${VERIFY_SPA_PORT:-5199}"
  local RUNS="$TEAM_DIR/runs" LOGS="$TEAM_DIR/logs"
  local TAG="$API_PORT"
  mkdir -p "$RUNS" "$LOGS"
  # Inside an agent run the runner owns the servers (they must run outside the sandbox). An agent calling
  # start/stop here killed its own servers and could not restart them (ISA2-303 verify, 2026-09-27).
  if [ "${GG_IN_AGENT:-}" = "1" ] && [ "$CMD" != "status" ] && [ "$CMD" != "logs" ]; then
    echo "devserver.sh: the runner manages servers for this run; they are already up (Run facts). After server edits: touch \$RUNS/\$GG_KEY.restart" >&2
    return 2
  fi
  case "$CMD" in
    start)
      # No AWS credentials: the coordinator's boot-time VM-pool sync would otherwise delete vmPool entries in
      # production Firebase for instances AWS no longer lists. Without AWS the pool still loads from Firebase,
      # so the VM assigned to the test competition is found and its OBS connects.
      unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_SECURITY_TOKEN AWS_WEB_IDENTITY_TOKEN_FILE AWS_ROLE_ARN
      export AWS_PROFILE=agent-team-no-aws AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_EC2_METADATA_DISABLED=true
      stop_all "$RUNS" "$API_PORT" "$SPA_PORT" "$TAG"
      [ -d "$WT/server" ] || { echo "devserver.sh: worktree missing at $WT" >&2; return 1; }
      start_api "$WT" "$API_PORT" "$RUNS" "$LOGS" "$TAG"
      # vite via node directly (see node_bin): the registry files it would rebuild in predev are committed.
      ( cd "$WT/show-controller" && VITE_API_URL="http://localhost:$API_PORT" VITE_LOCAL_SERVER="http://localhost:$API_PORT" \
          nohup $(node_bin) node_modules/vite/bin/vite.js --host 127.0.0.1 --port "$SPA_PORT" --strictPort > "$LOGS/devserver-spa-$TAG.log" 2>&1 & echo $! > "$RUNS/devserver-spa-$TAG.pid" )
      wait_for "http://127.0.0.1:$SPA_PORT/" 90 || { echo "devserver.sh: SPA did not answer on :$SPA_PORT (see $LOGS/devserver-spa-$TAG.log)" >&2; return 1; }
      wait_for "http://localhost:$API_PORT/api/coordinator/status" 90 || { echo "devserver.sh: coordinator did not answer on :$API_PORT (see $LOGS/devserver-api-$TAG.log)" >&2; return 1; }
      echo "SPA http://127.0.0.1:$SPA_PORT   API http://127.0.0.1:$API_PORT"
      ;;
    restart-api)
      if [ -f "$RUNS/devserver-api-$TAG.pid" ]; then
        local pid; pid="$(cat "$RUNS/devserver-api-$TAG.pid")"; pkill -P "$pid" >/dev/null 2>&1; kill "$pid" >/dev/null 2>&1
      fi
      lsof -ti "tcp:$API_PORT" 2>/dev/null | xargs kill 2>/dev/null
      sleep 1
      start_api "$WT" "$API_PORT" "$RUNS" "$LOGS" "$TAG"
      wait_for "http://localhost:$API_PORT/api/coordinator/status" 90 && echo "coordinator restarted on :$API_PORT" \
        || { echo "devserver.sh: coordinator did not come back on :$API_PORT" >&2; return 1; }
      ;;
    stop)
      stop_all "$RUNS" "$API_PORT" "$SPA_PORT" "$TAG"; echo "stopped"
      ;;
    status)
      curl -s -o /dev/null --max-time 3 -w "SPA :$SPA_PORT -> %{http_code}\n" "http://127.0.0.1:$SPA_PORT/" || echo "SPA :$SPA_PORT -> down"
      curl -s -o /dev/null --max-time 3 -w "API :$API_PORT -> %{http_code}\n" "http://localhost:$API_PORT/api/coordinator/status" || echo "API :$API_PORT -> down"
      ;;
    logs)
      tail -n 40 "$LOGS/devserver-api-$TAG.log" "$LOGS/devserver-spa-$TAG.log" 2>/dev/null
      ;;
    *) echo "usage: devserver.sh start|restart-api|stop|status|logs" >&2; return 2 ;;
  esac
}

# tmux on this Mac is an Intel-only build, so processes it starts run under Rosetta, and the universal node picks
# x86_64 there. The SPA's native deps (rollup) are arm64-only. Run node natively when that's possible.
node_bin() {
  if [ "$(uname -m)" = "x86_64" ] && arch -arm64 node -e 0 2>/dev/null; then echo "arch -arm64 node"; else echo "node"; fi
}

start_api() {
  local WT="$1" API_PORT="$2" RUNS="$3" LOGS="$4" TAG="$5"
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_SECURITY_TOKEN AWS_WEB_IDENTITY_TOKEN_FILE AWS_ROLE_ARN
  export AWS_PROFILE=agent-team-no-aws AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_EC2_METADATA_DISABLED=true
  # Absolute Firebase Admin key for run coordinators (worktrees don't share relative paths or your shell env).
  # dotenv never overrides variables already set, so this wins over server/.env.
  local KEY="${FIREBASE_ADMIN_KEY:-$HOME/.config/firebase/gymnastics-graphics-prod-sa.json}"
  [ -f "$KEY" ] && export GOOGLE_APPLICATION_CREDENTIALS="$KEY"
  export FIREBASE_DATABASE_URL="${FIREBASE_DATABASE_URL:-https://gymnastics-graphics-default-rtdb.firebaseio.com}"
  ( cd "$WT/server" && PORT="$API_PORT" nohup $(node_bin) index.js >> "$LOGS/devserver-api-$TAG.log" 2>&1 & echo $! > "$RUNS/devserver-api-$TAG.pid" )
}

wait_for() {
  local url="$1" secs="$2" i
  for ((i = 0; i < secs; i++)); do
    curl -s -o /dev/null --max-time 2 "$url" && return 0
    sleep 1
  done
  return 1
}

stop_all() {
  local RUNS="$1" API_PORT="$2" SPA_PORT="$3" TAG="$4" p pid
  for p in api spa; do
    if [ -f "$RUNS/devserver-$p-$TAG.pid" ]; then
      pid="$(cat "$RUNS/devserver-$p-$TAG.pid")"
      pkill -P "$pid" >/dev/null 2>&1; kill "$pid" >/dev/null 2>&1
      rm -f "$RUNS/devserver-$p-$TAG.pid"
    fi
  done
  lsof -ti "tcp:$API_PORT" 2>/dev/null | xargs kill 2>/dev/null
  lsof -ti "tcp:$SPA_PORT" 2>/dev/null | xargs kill 2>/dev/null
  return 0
}

main "$@"
