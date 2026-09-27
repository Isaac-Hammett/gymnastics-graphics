#!/bin/bash
# notify.sh "message" — ntfy push when NTFY_TOPIC is set, otherwise a macOS notification; always appends to logs/notify.log.
main() {
  local DIR; DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  eval "$(python3 "$DIR/tools/common.py" export-env 2>/dev/null)"
  local MSG="$*"
  mkdir -p "$DIR/logs"
  echo "$(date '+%Y-%m-%d %H:%M:%S') $MSG" >> "$DIR/logs/notify.log"
  if [ -n "${NTFY_TOPIC:-}" ]; then
    curl -s -o /dev/null --max-time 10 -H "Title: agent-team" -d "$MSG" "https://ntfy.sh/$NTFY_TOPIC" || true
  else
    local SAFE="${MSG//\"/\\\"}"
    osascript -e "display notification \"$SAFE\" with title \"agent-team\"" >/dev/null 2>&1 || true
  fi
}
main "$@"
