#!/bin/bash
set -o pipefail

# Standard Loop v2 — Ralph-style pipeline
#
# Full pipeline:
#   Phase A: Requirements (manual) — cat prompt-requirements.md | claude -p
#   Phase B: TODO (manual)         — cat prompt-todo.md | claude -p
#   Phase 1: Code loop (automated) — this script
#   Phase 2: Batch deploy           — this script
#   Phase 3: Verify-and-fix         — this script
#
# Usage: ./run.sh [--skip-to-phase N] [--verify-only]
#
# Prerequisites (run manually before this script):
#   1. Phase A complete: specs/*.md exist
#   2. Phase B complete: plan.md has tasks with '— NOT STARTED' markers
#   3. prompt.md and prompt-verify.md are customized
#   4. Manual test: cat prompt.md | claude -p --mcp-config ../../.mcp.json
#
# Human review: open verification-log.html, add rejections to fixes.md, rerun.
# Max 3 pipeline runs.
#
# See LOOP-SYSTEM.md for full docs.

# -- CUSTOMIZE THESE ----------------------------------------------------------
DEPLOY_MODE="production"                 # "production" | "local"
DEPLOY_VALIDATION_URL=""                 # URL to check HTTP 200 after deploy
MAX_ITERATIONS=30                        # Safety limit for code loop
MAX_ROUNDS=3                             # Max verify→fix→redeploy rounds
# -- END CUSTOMIZE -------------------------------------------------------------

# -- Parse args ----------------------------------------------------------------
SKIP_TO_PHASE=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-to-phase) SKIP_TO_PHASE="$2"; shift 2 ;;
        --verify-only) SKIP_TO_PHASE=3; shift ;;
        *) echo "Unknown: $1"; echo "Usage: $0 [--skip-to-phase N] [--verify-only]"; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"
PLAN_FILE="$SCRIPT_DIR/plan.md"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
VERIFY_FILE="$SCRIPT_DIR/prompt-verify.md"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/summary.log"

mkdir -p "$LOG_DIR" "$SCRIPT_DIR/screenshots"

# Colors
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# -- Helpers -------------------------------------------------------------------
count_pattern() {
    local result
    result=$(grep -c "$1" "$2" 2>/dev/null) || true
    echo "${result:-0}"
}

PIPELINE_START=$(date +%s)

echo -e "${GREEN}=== Standard Loop v2 ===${NC}"
if [ "$SKIP_TO_PHASE" -gt 0 ]; then
    echo -e "${YELLOW}Skipping to Phase $SKIP_TO_PHASE${NC}"
fi
echo ""

# -- Precondition checks -------------------------------------------------------
if [ ! -f "$PLAN_FILE" ]; then
    echo -e "${RED}Error: plan.md not found. Run Phase B first: cat prompt-todo.md | claude -p --mcp-config ../../.mcp.json${NC}"; exit 1
fi
if [ ! -f "$PROMPT_FILE" ]; then
    echo -e "${RED}Error: prompt.md not found${NC}"; exit 1
fi
if [ ! -f "$VERIFY_FILE" ]; then
    echo -e "${RED}Error: prompt-verify.md not found${NC}"; exit 1
fi
if [ ! -d "$SCRIPT_DIR/specs" ] || [ -z "$(ls -A "$SCRIPT_DIR/specs" 2>/dev/null)" ]; then
    echo -e "${YELLOW}Warning: specs/ is empty. Run Phase A first: cat prompt-requirements.md | claude -p --mcp-config ../../.mcp.json${NC}"
fi

FIXES_FILE="$SCRIPT_DIR/fixes.md"

# ==============================================================================
# Outer loop: Phase 1 → Phase 2 → Phase 3 → check fixes → repeat
# ==============================================================================
for ROUND in $(seq 1 $MAX_ROUNDS); do
    echo -e "${BOLD}━━━ Round $ROUND/$MAX_ROUNDS ━━━${NC}"
    echo ""

    # -- Phase 1: Code Loop ---------------------------------------------------
    if [ "$SKIP_TO_PHASE" -le 1 ]; then
        echo -e "${CYAN}=== Phase 1: Code Loop ===${NC}"

        cd "$PROJECT_ROOT"
        ITERATION_OFFSET=$(( (ROUND - 1) * MAX_ITERATIONS ))

        for i in $(seq 1 $MAX_ITERATIONS); do
            NOT_STARTED=$(count_pattern "— NOT STARTED" "$PLAN_FILE")
            IN_PROGRESS=$(count_pattern "— IN PROGRESS" "$PLAN_FILE")
            COMPLETE=$(count_pattern "— COMPLETE" "$PLAN_FILE")
            TOTAL=$((NOT_STARTED + IN_PROGRESS + COMPLETE))

            # Check fixes.md for items to process
            FIXES_REMAINING=0
            if [ -f "$FIXES_FILE" ] && grep -q "^- " "$FIXES_FILE" 2>/dev/null; then
                FIXES_REMAINING=$(grep -c "^- " "$FIXES_FILE")
            fi

            # All done? (no tasks left AND no fixes remaining)
            if [ "$NOT_STARTED" -eq 0 ] && [ "$IN_PROGRESS" -eq 0 ] && [ "$FIXES_REMAINING" -eq 0 ]; then
                echo -e "${GREEN}All $COMPLETE tasks complete, no fixes pending.${NC}"
                break
            fi

            GLOBAL_ITER=$((ITERATION_OFFSET + i))
            if [ "$FIXES_REMAINING" -gt 0 ]; then
                echo -e "  Iteration $i | $COMPLETE/$TOTAL done | $FIXES_REMAINING fix(es) from verify" | tee -a "$LOG_FILE"
            else
                CURRENT=$(grep -m1 "— NOT STARTED\|— IN PROGRESS" "$PLAN_FILE" | sed 's/^[^:]*: //' | sed 's/ —.*//' | head -c 50)
                echo -e "  Iteration $i | $COMPLETE/$TOTAL done | Next: $CURRENT" | tee -a "$LOG_FILE"
            fi

            TASKS_BEFORE=$COMPLETE
            BUGS_BEFORE=$(count_pattern "^- BUG:" "$PLAN_FILE")

            cat "$PROMPT_FILE" | \
                claude -p --dangerously-skip-permissions \
                --mcp-config "$MCP_CONFIG" >> "$LOG_DIR/iteration-$GLOBAL_ITER.log" 2>&1

            # Check progress
            COMPLETE_NOW=$(count_pattern "— COMPLETE" "$PLAN_FILE")
            BUGS_NOW=$(count_pattern "^- BUG:" "$PLAN_FILE")

            # Also count fixes consumed as progress
            FIXES_NOW=0
            if [ -f "$FIXES_FILE" ] && grep -q "^- " "$FIXES_FILE" 2>/dev/null; then
                FIXES_NOW=$(grep -c "^- " "$FIXES_FILE")
            fi
            FIXES_CONSUMED=$((FIXES_REMAINING - FIXES_NOW))

            PROGRESS=$((COMPLETE_NOW - TASKS_BEFORE + BUGS_NOW - BUGS_BEFORE + FIXES_CONSUMED))

            if [ "$PROGRESS" -le 0 ]; then
                echo -e "${RED}  STALLED — no progress this iteration${NC}" | tee -a "$LOG_FILE"
                say "Loop stalled. No progress." 2>/dev/null &
                exit 1
            fi

            echo -e "  ${GREEN}Done: $COMPLETE_NOW/$TOTAL${NC}" | tee -a "$LOG_FILE"
            sleep 2
        done

        echo -e "${GREEN}Phase 1 complete.${NC}"
        echo ""
    fi

    # -- Phase 2: Deploy ------------------------------------------------------
    if [ "$SKIP_TO_PHASE" -le 2 ]; then
        if [ "$DEPLOY_MODE" = "local" ]; then
            echo -e "${CYAN}=== Phase 2: Deploy (skipped — local mode) ===${NC}"
        else
            echo -e "${CYAN}=== Phase 2: Deploy ===${NC}"

            cd "$PROJECT_ROOT"
            echo "Building frontend..."
            cd show-controller && npm run build 2>&1 | tee "$LOG_DIR/deploy-r$ROUND.log"
            if [ ${PIPESTATUS[0]} -ne 0 ]; then
                echo -e "${RED}Build failed!${NC}"; cd "$PROJECT_ROOT"; exit 1
            fi
            cd "$PROJECT_ROOT"

            echo "Deploying..."
            cat <<'DEPLOY_PROMPT' | claude -p --dangerously-skip-permissions --mcp-config "$MCP_CONFIG" >> "$LOG_DIR/deploy-r$ROUND.log" 2>&1
Deploy the current build to production following CLAUDE.md deploy instructions:
1. Create tarball from show-controller/dist
2. Upload and extract to production server
3. Upload output.html and overlays/ if they were modified
4. Verify the site loads at https://commentarygraphic.com
DEPLOY_PROMPT
            if [ ${PIPESTATUS[0]} -ne 0 ]; then
                echo -e "${RED}Deploy failed! Check $LOG_DIR/deploy-r$ROUND.log${NC}"; exit 1
            fi

            # Validate
            if [ -n "$DEPLOY_VALIDATION_URL" ]; then
                http_code=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_VALIDATION_URL" 2>/dev/null)
                if [ "$http_code" != "200" ]; then
                    echo -e "${RED}Deploy validation failed: HTTP $http_code${NC}"; exit 1
                fi
                echo -e "${GREEN}Deploy validated: HTTP $http_code${NC}"
            fi

            echo -e "${GREEN}Phase 2 complete.${NC}"
        fi
        echo ""
    fi

    # Reset skip — only applies to the first round
    SKIP_TO_PHASE=0

    # -- Phase 3: Verify (read-only) ------------------------------------------
    echo -e "${CYAN}=== Phase 3: Verify ===${NC}"

    cat "$VERIFY_FILE" | \
        claude -p --dangerously-skip-permissions \
        --mcp-config "$MCP_CONFIG" 2>&1 | tee "$LOG_DIR/verify-r$ROUND.log"

    # -- Check if we're done ---------------------------------------------------
    FIXES_REMAINING=0
    if [ -f "$FIXES_FILE" ] && grep -q "^- " "$FIXES_FILE" 2>/dev/null; then
        FIXES_REMAINING=$(grep -c "^- " "$FIXES_FILE")
    fi

    if [ "$FIXES_REMAINING" -eq 0 ]; then
        echo -e "${GREEN}All tasks verified. Exiting pipeline.${NC}"
        break
    fi

    if [ "$ROUND" -lt "$MAX_ROUNDS" ]; then
        echo -e "${YELLOW}$FIXES_REMAINING fix(es) found. Looping back to Phase 1...${NC}"
        echo ""
    else
        echo -e "${RED}$FIXES_REMAINING fix(es) remain after $MAX_ROUNDS rounds.${NC}"
    fi
done

# -- Summary -------------------------------------------------------------------
END_EPOCH=$(date +%s)
DURATION=$(( (END_EPOCH - PIPELINE_START) / 60 ))

FIXES_REMAINING=0
if [ -f "$FIXES_FILE" ] && grep -q "^- " "$FIXES_FILE" 2>/dev/null; then
    FIXES_REMAINING=$(grep -c "^- " "$FIXES_FILE")
fi

echo ""
if [ "$FIXES_REMAINING" -gt 0 ]; then
    echo -e "${YELLOW}=== $FIXES_REMAINING fix(es) remain after $MAX_ROUNDS rounds ===${NC}"
    echo -e "${YELLOW}1. Review: verification-log.html${NC}"
    echo -e "${YELLOW}2. Add rejections to fixes.md${NC}"
    echo -e "${YELLOW}3. Rerun: ./run.sh${NC}"
else
    echo -e "${GREEN}=== Pipeline complete! All tasks verified. ===${NC}"
    echo -e "${GREEN}Review: verification-log.html${NC}"
    echo -e "${GREEN}If anything looks wrong, add to fixes.md and rerun.${NC}"
fi

COMPLETE=$(count_pattern "— COMPLETE" "$PLAN_FILE")
echo ""
echo "Tasks: $COMPLETE complete | Fixes: $FIXES_REMAINING remaining | Rounds: $ROUND | Time: ${DURATION}m"
echo "Review: $SCRIPT_DIR/verification-log.html"
say "Pipeline complete" 2>/dev/null &
