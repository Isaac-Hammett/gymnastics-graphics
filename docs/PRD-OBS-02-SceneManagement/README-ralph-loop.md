# Ralph Loop Setup Guide

How to set up an autonomous Claude loop for any PRD.

## Files Needed

```
docs/PRD-XXX-FeatureName/
├── PRD-XXX-FeatureName.md          # Requirements and acceptance criteria
├── IMPLEMENTATION-PLAN.md           # Task breakdown (Claude updates this)
├── prompt-XXX-feature-name.md       # The prompt Claude reads each iteration
├── XXX-feature-name-run.sh          # The loop script
└── logs/
    └── claude-output.jsonl          # Output log (auto-created)
```

## Step 1: Create the Prompt File

Keep it simple. Example `prompt-XXX-feature-name.md`:

```
0a. read everything in PRD-XXX-FeatureName.md
0b. review the source files referenced in IMPLEMENTATION-PLAN.md

pick the SINGLE highest priority item from IMPLEMENTATION-PLAN.md and implement it using up to 50 subagents
ensure tests pass (npm test in server/)
verify on production using Playwright MCP at https://commentarygraphic.com/{compId}/your-page
update IMPLEMENTATION-PLAN.md with your progress
commit and push: git add -A && git commit -m "PRD-XXX: ..." && git push origin main
deploy if needed: backend → ssh_exec to coordinator, frontend → build and upload per CLAUDE.md
if there is a discrepancy between IMPLEMENTATION-PLAN.md and the PRD, always update IMPLEMENTATION-PLAN.md to match the PRD.
```

## Step 2: Create the Run Script

Create `XXX-feature-name-run.sh`:

```bash
#!/bin/bash
# Ralph loop for PRD-XXX Feature Name

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/claude-output.jsonl"
mkdir -p "$SCRIPT_DIR/logs"

while :; do
    cat "$SCRIPT_DIR/prompt-XXX-feature-name.md" | \
        claude -p --dangerously-skip-permissions | \
        tee -a "$LOG_FILE"
    say 'looping'
    sleep 10
done
```

Make it executable:
```bash
chmod +x XXX-feature-name-run.sh
```

## Step 3: Run the Loop

```bash
cd docs/PRD-XXX-FeatureName
./XXX-feature-name-run.sh
```

- Press `Ctrl+C` to stop
- You'll hear "looping" after each iteration
- Check `logs/claude-output.jsonl` for output

## Step 4: Monitor Progress

In a separate terminal:
```bash
# Watch the log file
tail -f docs/PRD-XXX-FeatureName/logs/claude-output.jsonl

# Check git commits
git log --oneline -10

# Check if Claude is running
ps aux | grep claude
```

## What the Loop Does

Each iteration:
1. Reads the prompt file (fresh context each time)
2. Claude picks one task from IMPLEMENTATION-PLAN.md
3. Implements it, runs tests, deploys
4. Updates IMPLEMENTATION-PLAN.md and commits
5. Exits
6. Waits 10 seconds
7. Repeats

Claude has no memory between iterations - it reads the updated files each time.
