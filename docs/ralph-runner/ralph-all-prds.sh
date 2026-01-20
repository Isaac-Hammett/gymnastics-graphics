#!/bin/bash
# Master RALPH loop - processes all PRDs in sequence
# Run this and come back to find all PRDs completed

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs"
LOG_FILE="$SCRIPT_DIR/logs/ralph-all-prds.log"
STATE_FILE="$SCRIPT_DIR/logs/current-prd.state"
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"
PLAYWRIGHT_CLEANUP="$PROJECT_ROOT/scripts/cleanup-playwright.sh"

mkdir -p "$SCRIPT_DIR/logs"

# Clean up stale Playwright locks before starting
cleanup_playwright() {
    if [[ -x "$PLAYWRIGHT_CLEANUP" ]]; then
        log "Cleaning up Playwright locks..."
        "$PLAYWRIGHT_CLEANUP" 2>/dev/null || true
    else
        # Inline cleanup if script doesn't exist
        local cache_dir="$HOME/Library/Caches/ms-playwright"
        if [[ -d "$cache_dir" ]]; then
            for dir in "$cache_dir"/mcp-chrome-*; do
                if [[ -d "$dir" ]]; then
                    rm -f "$dir/SingletonLock" "$dir/SingletonSocket" "$dir/SingletonCookie" "$dir/RunningChromeVersion" 2>/dev/null
                fi
            done
        fi
    fi
}

# PRDs in order (based on dependencies)
PRDS=(
    "PRD-OBS-01-StateSync"
    "PRD-OBS-02-SceneManagement"
    "PRD-OBS-03-SourceManagement"
    "PRD-OBS-04-AudioManagement"
    "PRD-OBS-05-Transitions"
    "PRD-OBS-06-StreamRecording"
    "PRD-OBS-07-AssetManagement"
    "PRD-OBS-08-Templates"
    "PRD-OBS-09-PreviewSystem"
    "PRD-OBS-10-TalentComms"
)

# Max iterations per PRD before moving on (prevents infinite loops)
MAX_ITERATIONS=10

# Seconds between iterations
SLEEP_BETWEEN_ITERATIONS=10

# Seconds between PRDs
SLEEP_BETWEEN_PRDS=5

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

get_prompt_file() {
    local prd_dir="$1"
    # Find the prompt file in the PRD directory
    find "$DOCS_DIR/$prd_dir" -name "prompt-*.md" -type f | head -1
}

get_implementation_plan() {
    local prd_dir="$1"
    echo "$DOCS_DIR/$prd_dir/IMPLEMENTATION-PLAN.md"
}

check_prd_complete() {
    local prd_dir="$1"
    local impl_plan=$(get_implementation_plan "$prd_dir")

    if [[ -f "$impl_plan" ]]; then
        # Check if status indicates completion
        if grep -qi "Status:.*Complete\|Status:.*Done\|Status:.*Verified" "$impl_plan" 2>/dev/null; then
            return 0  # Complete
        fi
    fi
    return 1  # Not complete
}

run_prd_iteration() {
    local prd_dir="$1"
    local prompt_file=$(get_prompt_file "$prd_dir")
    local prd_log="$SCRIPT_DIR/logs/${prd_dir}.jsonl"

    if [[ -z "$prompt_file" || ! -f "$prompt_file" ]]; then
        log "ERROR: No prompt file found for $prd_dir"
        return 1
    fi

    log "Running iteration for $prd_dir using $prompt_file"

    # Clean up Playwright locks before each iteration to prevent "Browser already in use" errors
    cleanup_playwright

    # Prepend MCP usage instructions to the prompt
    local mcp_instructions="IMPORTANT: MCP tools (mcp__playwright__*, mcp__gymnastics__*) are ONLY available to the main conversation. Do NOT use Task agents for Playwright browser testing - the subagent cannot access MCP tools. Call mcp__playwright__browser_navigate, mcp__playwright__browser_click, etc. DIRECTLY in your response, not via Task or Bash.

"

    { echo "$mcp_instructions"; cat "$prompt_file"; } | \
        claude -p --dangerously-skip-permissions --verbose --output-format stream-json \
        --mcp-config "$MCP_CONFIG" 2>&1 | \
        tee -a "$prd_log"

    return 0
}

save_state() {
    local prd_index="$1"
    local iteration="$2"
    echo "${prd_index}:${iteration}" > "$STATE_FILE"
}

load_state() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        echo "0:0"
    fi
}

# Main loop
log "=========================================="
log "RALPH Master Runner Starting"
log "=========================================="
log "PRDs to process: ${#PRDS[@]}"
log "Max iterations per PRD: $MAX_ITERATIONS"
log ""

# Load state (allows resuming after interruption)
state=$(load_state)
start_prd_index=$(echo "$state" | cut -d: -f1)
start_iteration=$(echo "$state" | cut -d: -f2)

log "Resuming from PRD index $start_prd_index, iteration $start_iteration"

for prd_index in $(seq $start_prd_index $((${#PRDS[@]} - 1))); do
    prd_dir="${PRDS[$prd_index]}"

    log ""
    log "=========================================="
    log "Processing: $prd_dir (${prd_index}/${#PRDS[@]})"
    log "=========================================="

    # Check if already complete
    if check_prd_complete "$prd_dir"; then
        log "✅ $prd_dir is already complete, skipping"
        continue
    fi

    # Determine starting iteration
    if [[ $prd_index -eq $start_prd_index ]]; then
        iteration=$start_iteration
    else
        iteration=0
    fi

    # Run iterations for this PRD
    while [[ $iteration -lt $MAX_ITERATIONS ]]; do
        log "--- Iteration $((iteration + 1))/$MAX_ITERATIONS for $prd_dir ---"

        save_state "$prd_index" "$iteration"

        if ! run_prd_iteration "$prd_dir"; then
            log "ERROR: Failed to run iteration for $prd_dir"
            iteration=$((iteration + 1))
            continue
        fi

        # Check if complete after this iteration
        if check_prd_complete "$prd_dir"; then
            log "✅ $prd_dir completed after $((iteration + 1)) iterations"
            break
        fi

        iteration=$((iteration + 1))

        if [[ $iteration -lt $MAX_ITERATIONS ]]; then
            log "Sleeping $SLEEP_BETWEEN_ITERATIONS seconds before next iteration..."
            sleep $SLEEP_BETWEEN_ITERATIONS
        fi
    done

    if [[ $iteration -ge $MAX_ITERATIONS ]]; then
        log "⚠️  $prd_dir reached max iterations ($MAX_ITERATIONS), moving to next PRD"
    fi

    # Announce completion of this PRD
    say "$prd_dir processing complete"

    if [[ $prd_index -lt $((${#PRDS[@]} - 1)) ]]; then
        log "Sleeping $SLEEP_BETWEEN_PRDS seconds before next PRD..."
        sleep $SLEEP_BETWEEN_PRDS
    fi
done

# Clear state file on successful completion
rm -f "$STATE_FILE"

log ""
log "=========================================="
log "RALPH Master Runner Complete"
log "=========================================="

say "All PRDs have been processed"
