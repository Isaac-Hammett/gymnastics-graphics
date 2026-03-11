#!/bin/bash
# PRD Status Dashboard — shows status of all active PRDs

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PRD STATUS DASHBOARD — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════════════════════"
echo ""
printf "  %-38s %-16s %s\n" "PRD" "STATUS" "LAST UPDATED"
echo "  ─────────────────────────────────────────────────────────────"

for PRD_FILE in "$SCRIPT_DIR"/PRD-*/PRD-*.md; do
    [ -f "$PRD_FILE" ] || continue

    PRD_DIR=$(dirname "$PRD_FILE")
    PRD_NAME=$(basename "$PRD_DIR")
    STATUS=$(grep "^\*\*Status:\*\*" "$PRD_FILE" 2>/dev/null | head -1 | sed 's/\*\*Status:\*\* //' | tr -d '\r')
    UPDATED=$(grep "^\*\*Last Updated:\*\*" "$PRD_FILE" 2>/dev/null | head -1 | sed 's/\*\*Last Updated:\*\* //' | tr -d '\r')

    # Color by status
    case "$STATUS" in
        COMPLETE)    COLOR="\033[32m" ;;   # green
        "IN PROGRESS") COLOR="\033[33m" ;; # yellow
        *)           COLOR="\033[37m" ;;   # gray
    esac

    printf "  %-38s ${COLOR}%-16s\033[0m %s\n" "$PRD_NAME" "${STATUS:-unknown}" "${UPDATED:--}"
done

echo ""
echo "  TASK COMPLETION"
echo "  ─────────────────────────────────────────────────────────────"

for PRD_DIR in "$SCRIPT_DIR"/PRD-*/; do
    PLAN="$PRD_DIR/implementation-plan.md"
    [ -f "$PLAN" ] || continue

    PRD_NAME=$(basename "$PRD_DIR")
    TOTAL=$(grep -cE "— (NOT STARTED|IN PROGRESS|COMPLETE)" "$PLAN" 2>/dev/null || echo 0)
    DONE=$(grep -c "— COMPLETE" "$PLAN" 2>/dev/null || echo 0)
    IN_PROG=$(grep -c "— IN PROGRESS" "$PLAN" 2>/dev/null || echo 0)

    if [ "$TOTAL" -gt 0 ]; then
        BAR_DONE=$(( DONE * 20 / TOTAL ))
        BAR=$(printf '%0.s█' $(seq 1 $BAR_DONE))$(printf '%0.s░' $(seq 1 $((20 - BAR_DONE))))
        printf "  %-38s [%s] %s/%s" "$PRD_NAME" "$BAR" "$DONE" "$TOTAL"
        [ "$IN_PROG" -gt 0 ] && printf " (%s in progress)" "$IN_PROG"
        echo ""
    fi
done

echo ""
