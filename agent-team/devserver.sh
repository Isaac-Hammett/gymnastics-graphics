#!/bin/bash
# devserver.sh start|stop|status|logs — dev servers for the verify lane, inside <worktrees>/_verify, on the VERIFY_* ports.
# Never collides with your own :5173 / :3003 session. The coordinator reads server/.env (copied into the worktree).
main() {
  local CMD="${1:-status}"
  local TEAM_DIR; TEAM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [ -n "${GG_TEAM_DIR:-}" ] && TEAM_DIR="$GG_TEAM_DIR"
  eval "$(python3 "$TEAM_DIR/tools/common.py" export-env)"
  local WT="${GG_VERIFY_WT:-$GG_WORKTREES/_verify}"
  local API_PORT="${VERIFY_API_PORT:-3099}" SPA_PORT="${VERIFY_SPA_PORT:-5199}"
  local RUNS="$TEAM_DIR/runs" LOGS="$TEAM_DIR/logs"
  mkdir -p "$RUNS" "$LOGS"
  case "$CMD" in
    start)
      # No AWS credentials: the coordinator's boot-time VM-pool sync would otherwise delete vmPool entries in
      # production Firebase for instances AWS no longer lists. Same guard as agent_run.sh.
      unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_SECURITY_TOKEN AWS_WEB_IDENTITY_TOKEN_FILE AWS_ROLE_ARN
      export AWS_PROFILE=agent-team-no-aws AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_EC2_METADATA_DISABLED=true
      stop_all "$RUNS" "$API_PORT" "$SPA_PORT"
      [ -d "$WT/server" ] || { echo "devserver.sh: verify worktree missing at $WT (run agent_run.sh <T>.verify verify --prepare-only)" >&2; return 1; }
      ( cd "$WT/server" && PORT="$API_PORT" nohup node index.js > "$LOGS/devserver-api.log" 2>&1 & echo $! > "$RUNS/devserver-api.pid" )
      ( cd "$WT/show-controller" && VITE_API_URL="http://localhost:$API_PORT" VITE_LOCAL_SERVER="http://localhost:$API_PORT" \
          nohup npm run dev -- --port "$SPA_PORT" --strictPort > "$LOGS/devserver-spa.log" 2>&1 & echo $! > "$RUNS/devserver-spa.pid" )
      wait_for "http://localhost:$SPA_PORT/" 90 || { echo "devserver.sh: SPA did not answer on :$SPA_PORT (see $LOGS/devserver-spa.log)" >&2; return 1; }
      wait_for "http://localhost:$API_PORT/api/coordinator/status" 90 || { echo "devserver.sh: coordinator did not answer on :$API_PORT (see $LOGS/devserver-api.log)" >&2; return 1; }
      echo "SPA http://localhost:$SPA_PORT   API http://localhost:$API_PORT"
      ;;
    stop)
      stop_all "$RUNS" "$API_PORT" "$SPA_PORT"; echo "stopped"
      ;;
    status)
      curl -s -o /dev/null --max-time 3 -w "SPA :$SPA_PORT -> %{http_code}\n" "http://localhost:$SPA_PORT/" || echo "SPA :$SPA_PORT -> down"
      curl -s -o /dev/null --max-time 3 -w "API :$API_PORT -> %{http_code}\n" "http://localhost:$API_PORT/api/coordinator/status" || echo "API :$API_PORT -> down"
      ;;
    logs)
      tail -n 40 "$LOGS/devserver-api.log" "$LOGS/devserver-spa.log" 2>/dev/null
      ;;
    *) echo "usage: devserver.sh start|stop|status|logs" >&2; return 2 ;;
  esac
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
  local RUNS="$1" API_PORT="$2" SPA_PORT="$3" p pid
  for p in api spa; do
    if [ -f "$RUNS/devserver-$p.pid" ]; then
      pid="$(cat "$RUNS/devserver-$p.pid")"
      pkill -P "$pid" >/dev/null 2>&1; kill "$pid" >/dev/null 2>&1
      rm -f "$RUNS/devserver-$p.pid"
    fi
  done
  lsof -ti "tcp:$API_PORT" 2>/dev/null | xargs kill 2>/dev/null
  lsof -ti "tcp:$SPA_PORT" 2>/dev/null | xargs kill 2>/dev/null
  return 0
}

main "$@"
