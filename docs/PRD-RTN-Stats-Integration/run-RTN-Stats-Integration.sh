#!/bin/bash
# =============================================================================
# RTN Stats Integration Pipeline
# Phase 1: Audit  — validate plan against codebase, Firebase, and RTN API
# Phase 2: Implement — build one task per iteration
#
# Usage:
#   ./run-RTN-Stats-Integration.sh              # full pipeline (audit → implement)
#   ./run-RTN-Stats-Integration.sh --audit      # audit only
#   ./run-RTN-Stats-Integration.sh --implement  # skip audit, implement only
#   ./run-RTN-Stats-Integration.sh --status     # print progress, don't run
# =============================================================================

set -euo pipefail

# --- Config ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOGS_DIR="$SCRIPT_DIR/logs"
AUDIT_LOG="$LOGS_DIR/audit-output.jsonl"
IMPL_LOG="$LOGS_DIR/impl-output.jsonl"
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"
IMPL_PLAN="$SCRIPT_DIR/PLAN-RTN-Stats-Integration-Implementation.md"

MAX_AUDIT=15   # 7 categories + buffer for retries
MAX_IMPL=30    # 24 tasks + buffer for bug fixes

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# --- Helpers ---
timestamp() { date "+%Y-%m-%d %H:%M:%S"; }
elapsed() {
    local secs=$1
    printf '%dm %ds' $((secs / 60)) $((secs % 60))
}
banner() {
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════${RESET}"
    echo -e "${BOLD}  $1${RESET}"
    echo -e "${CYAN}══════════════════════════════════════════${RESET}"
    echo ""
}
divider() { echo -e "${DIM}──────────────────────────────────────────${RESET}"; }

audit_done()  { grep -q "Audit: COMPLETE" "$IMPL_PLAN" 2>/dev/null; }
impl_done()   { grep -q "^\\*\\*Status:\\*\\* COMPLETE" "$IMPL_PLAN" 2>/dev/null; }

count_tasks() {
    local status=$1
    grep -c "| $status |" "$IMPL_PLAN" 2>/dev/null || echo 0
}

print_status() {
    echo ""
    echo -e "${BOLD}Pipeline Status${RESET} ($(timestamp))"
    divider

    if audit_done; then
        echo -e "  Audit:      ${GREEN}COMPLETE${RESET}"
    else
        local cats_done
        cats_done=$(grep -c "^## Category" "$SCRIPT_DIR/AUDIT-LOG.md" 2>/dev/null || echo 0)
        echo -e "  Audit:      ${YELLOW}IN PROGRESS${RESET} ($cats_done/7 categories)"
    fi

    local done=$(count_tasks "COMPLETE")
    local wip=$(count_tasks "IN PROGRESS")
    local todo=$(count_tasks "NOT STARTED")
    local total=$((done + wip + todo))

    if impl_done; then
        echo -e "  Implement:  ${GREEN}COMPLETE${RESET} ($total/$total tasks)"
    elif [ "$done" -gt 0 ] || [ "$wip" -gt 0 ]; then
        echo -e "  Implement:  ${YELLOW}IN PROGRESS${RESET} ($done/$total done, $wip in progress)"
    else
        echo -e "  Implement:  ${DIM}NOT STARTED${RESET} ($total tasks queued)"
    fi

    divider
    echo ""
}

# --- Ctrl+C handler ---
cleanup() {
    echo ""
    echo -e "${YELLOW}Interrupted.${RESET} Progress is saved — rerun to continue."
    print_status
    exit 130
}
trap cleanup SIGINT SIGTERM

# --- Parse args ---
MODE="full"
case "${1:-}" in
    --audit)     MODE="audit" ;;
    --implement) MODE="implement" ;;
    --status)    print_status; exit 0 ;;
    --help|-h)
        echo "Usage: $0 [--audit|--implement|--status|--help]"
        echo "  (no flag)    Full pipeline: audit then implement"
        echo "  --audit      Run audit phase only"
        echo "  --implement  Skip audit, run implementation only"
        echo "  --status     Print progress and exit"
        exit 0 ;;
    "") ;;
    *)  echo "Unknown flag: $1. Use --help."; exit 1 ;;
esac

# --- Setup ---
mkdir -p "$LOGS_DIR" "$SCRIPT_DIR/tests"
cd "$PROJECT_ROOT"

# Seed audit log if missing
if [ ! -f "$SCRIPT_DIR/AUDIT-LOG.md" ]; then
    cat > "$SCRIPT_DIR/AUDIT-LOG.md" << EOF
# RTN Stats Integration — Audit Log

**Started:** $(date +%Y-%m-%d)
**Status:** IN PROGRESS

---

EOF
fi

print_status

# =============================================================================
# PHASE 1: AUDIT
# =============================================================================

run_audit() {
    if audit_done; then
        echo -e "${GREEN}Audit already complete — skipping.${RESET}"
        return 0
    fi

    banner "PHASE 1: AUDIT"
    say "Starting audit phase" &

    for i in $(seq 1 $MAX_AUDIT); do
        if audit_done; then
            echo -e "${GREEN}Audit complete after $((i - 1)) iterations.${RESET}"
            say "Audit complete" &
            return 0
        fi

        local iter_start=$SECONDS
        echo -e "${BOLD}Audit iteration $i/$MAX_AUDIT${RESET}  ${DIM}($(timestamp))${RESET}"

        cat "$SCRIPT_DIR/audit-RTN-Stats-Integration.md" | \
            claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
            --mcp-config "$MCP_CONFIG" 2>&1 | \
            tee -a "$AUDIT_LOG"

        local dur=$((SECONDS - iter_start))
        echo -e "${DIM}Iteration $i took $(elapsed $dur)${RESET}"
        divider

        say "audit $i done" &
        sleep 5
    done

    if ! audit_done; then
        echo -e "${RED}Audit did not complete in $MAX_AUDIT iterations.${RESET}"
        say "Audit failed to complete" &
        print_status
        exit 1
    fi
}

# =============================================================================
# PHASE 2: IMPLEMENT
# =============================================================================

run_implement() {
    if impl_done; then
        echo -e "${GREEN}Implementation already complete.${RESET}"
        return 0
    fi

    if ! audit_done && [ "$MODE" != "implement" ]; then
        echo -e "${RED}Audit not complete. Run audit first or use --implement to skip.${RESET}"
        exit 1
    fi

    banner "PHASE 2: IMPLEMENT"
    say "Starting implementation phase" &

    for i in $(seq 1 $MAX_IMPL); do
        if impl_done; then
            echo -e "${GREEN}All tasks complete after $((i - 1)) iterations.${RESET}"
            say "All tasks complete" &
            return 0
        fi

        local iter_start=$SECONDS
        local done=$(count_tasks "COMPLETE")
        local total=$((done + $(count_tasks "IN PROGRESS") + $(count_tasks "NOT STARTED")))
        echo -e "${BOLD}Impl iteration $i/$MAX_IMPL${RESET}  ${DIM}($done/$total tasks done)  ($(timestamp))${RESET}"

        cat "$SCRIPT_DIR/promptv2-RTN-Stats-Integration.md" | \
            claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
            --mcp-config "$MCP_CONFIG" 2>&1 | \
            tee -a "$IMPL_LOG"

        local dur=$((SECONDS - iter_start))
        echo -e "${DIM}Iteration $i took $(elapsed $dur)${RESET}"
        divider

        say "task $i done" &
        sleep 5
    done

    if ! impl_done; then
        echo -e "${RED}Implementation did not complete in $MAX_IMPL iterations.${RESET}"
        say "Max iterations reached" &
        print_status
        exit 1
    fi
}

# =============================================================================
# RUN
# =============================================================================

pipeline_start=$SECONDS

case "$MODE" in
    full)
        run_audit
        run_implement
        ;;
    audit)
        run_audit
        ;;
    implement)
        run_implement
        ;;
esac

echo ""
echo -e "${GREEN}${BOLD}Pipeline complete!${RESET}  Total time: $(elapsed $((SECONDS - pipeline_start)))"
print_status
say "Pipeline complete" &
