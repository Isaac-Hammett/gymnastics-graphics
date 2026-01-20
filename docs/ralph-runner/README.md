# RALPH Master Runner

Runs all OBS PRDs in sequence until completion.

## Usage

```bash
./ralph-all-prds.sh
```

Then walk away. Come back to find all PRDs processed.

## Features

- **Sequential processing**: PRDs run in dependency order (01 → 10)
- **Completion detection**: Checks IMPLEMENTATION-PLAN.md for "Complete/Done/Verified" status
- **Max iterations**: Stops after 10 iterations per PRD to prevent infinite loops
- **Resume support**: Saves state so you can Ctrl+C and resume later
- **Audio feedback**: Says PRD name when each one completes
- **MCP tools**: Loads Playwright and gymnastics MCP servers

## Configuration

Edit variables at top of script:

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_ITERATIONS` | 10 | Max Claude runs per PRD before moving on |
| `SLEEP_BETWEEN_ITERATIONS` | 10 | Seconds between iterations |
| `SLEEP_BETWEEN_PRDS` | 5 | Seconds between PRDs |

## Logs

- `logs/ralph-all-prds.log` - Master log with timestamps
- `logs/PRD-OBS-XX-*.jsonl` - Per-PRD Claude output (stream-json format)
- `logs/current-prd.state` - Resume state (deleted on completion)

## How Completion is Detected

The script checks each PRD's `IMPLEMENTATION-PLAN.md` for status lines containing:
- "Status: Complete"
- "Status: Done"
- "Status: Verified"

If found, that PRD is skipped (already done).

## Playwright Browser Lock Handling

The script automatically cleans up stale Playwright browser locks before each iteration. This prevents the "Browser is already in use" error that occurs when:
- A previous Claude session crashed
- The browser wasn't properly closed
- Multiple sessions tried to use the same browser profile

The cleanup removes lock files from `~/Library/Caches/ms-playwright/mcp-chrome-*/`.

If you still encounter issues, run manually:
```bash
rm -rf ~/Library/Caches/ms-playwright/mcp-chrome-*
```

## MCP Tool Limitations

**Important:** MCP tools (`mcp__playwright__*`, `mcp__gymnastics__*`) are only available to the main Claude conversation. They cannot be used by Task subagents.

The script automatically prepends instructions to each prompt reminding Claude to:
- Use Playwright MCP tools directly (not via Task agents)
- Not try to call MCP tools via Bash commands

If a PRD needs browser verification, the main agent must do it directly.
