# Ralph Loop Template

A two-phase autonomous agent loop for fixing bugs and implementing features.

## Quick Start

```bash
# Create a new loop
./ralph-new.sh my-feature "Add dark mode toggle"

# Edit the PRD and plan
cd ralph-my-feature
# Edit PRD.md with success criteria
# Edit plan.md with tasks

# Run the loop
./ralph.sh 20
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 1: RESEARCH                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Subagent │ │Subagent │ │Subagent │ │Subagent │  ...x30   │
│  │ (Read)  │ │(Screenshot)│ │ (API) │ │(Firebase)│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                     ↓ All complete ↓                        │
├─────────────────────────────────────────────────────────────┤
│                     PHASE 2: EXECUTE                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Single Sequential Agent                     ││
│  │  Build → Test → Deploy → Verify → Next Task             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `PRD.md` | Success criteria and workflows to verify |
| `plan.md` | Research tasks (parallel) + Execute tasks (sequential) |
| `AGENT.md` | Environment knowledge, deployment patterns |
| `PROMPT.md` | Agent instructions (rarely edit) |
| `activity.md` | Log of completed work |
| `ralph.sh` | Loop runner script |
| `screenshots/` | Verification screenshots |

## Parallelization Rules

### ✅ Research Phase (up to 30 parallel subagents)
- File reads (Glob, Grep, Read)
- Screenshots
- API GET requests
- Firebase reads
- AWS list operations

### ❌ Execute Phase (1 sequential agent)
- npm build/test
- File writes
- Deploys
- Server mutations
- PM2 restarts

## Example PRDs

See `examples/` for templates:
- `bugfix-prd.md` - Fixing a bug
- `feature-prd.md` - Adding a feature
- `infra-prd.md` - Infrastructure changes

## Workflow

1. **Create loop**: `./ralph-new.sh name "description"`
2. **Define PRD**: Edit `PRD.md` with success criteria
3. **Plan tasks**: Edit `plan.md` with research + execute tasks
4. **Run loop**: `./ralph.sh 20`
5. **Monitor**: Watch screenshots appear, check activity.md
6. **Complete**: Loop exits when all tasks pass

## Tips

- Start with research tasks to understand the problem
- Keep execute tasks small and focused
- Trust the screenshots - if it shows an error, the task failed
- Failed tasks create new fix tasks automatically
- Check `activity.md` for detailed logs
