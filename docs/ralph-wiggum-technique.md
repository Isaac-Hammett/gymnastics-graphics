# The Ralph Wiggum Technique

A methodology for autonomous AI-driven software development using Claude Code in a loop.

**Source:** Geoffrey Huntley (ghuntley.com)
**Adapted for:** gymnastics-graphics project

---

## Core Concept

```bash
while :; do cat PROMPT.md | claude-code ; done
```

A simple bash loop that continuously feeds a prompt file to an AI coding agent, letting it work autonomously. Each iteration gets a fresh context window.

---

## Why "Ralph Wiggum"?

Ralph is deterministically bad in an undeterministic world. Every time Ralph does something wrong, you tune the prompt - like tuning a guitar. Eventually Ralph stops making those mistakes. When Ralph feels too defective, you get a new Ralph (fresh context) that doesn't have those problems.

---

## Three Phases

### Phase 1: Requirements (Manual/Interactive)

Human shapes the context window through conversation with Claude:
- Load external info (URLs, papers, docs) via subagents
- Discuss requirements and architecture
- **Output:** `specs/*.md` files - one specification per topic

### Phase 2: TODO/Planning (Manual/Interactive)

Human guides Claude to analyze the codebase:
- Subagents study `specs/*` to learn requirements
- Subagents analyze source code (can use 100+ parallel subagents)
- Compare specs vs implementation, identify gaps
- **Output:** `plan.md` (or `IMPLEMENTATION_PLAN.md`) - prioritized task list

### Phase 3: Incremental Loop (Automated - Ralph)

The autonomous loop that implements tasks:
- Main context loads: PROMPT.md, plan.md, AGENT.md
- Picks the most important task
- Spawns subagents to do the work
- Updates state files
- Commits and exits
- **Loop repeats with fresh context**

---

## The Orchestrator Pattern

The main context is a **thin scheduler**, not an implementer:

| Main Context Does | Subagents Do |
|-------------------|--------------|
| Read state files | Search codebase |
| Pick next task | Implement features |
| Spawn subagents | Deploy to servers |
| Collect results | Run verification |
| Update state files | Update AGENT.md |
| Git commit | |
| Exit | |

**Why?** The main context window (~170k tokens) degrades with use. By delegating all expensive operations to subagents (which get garbage collected), the main context stays clean.

---

## Key Files

| File | Purpose | Who Updates |
|------|---------|-------------|
| `PROMPT.md` | Instructions for the orchestrator | Human (tuning) |
| `plan.md` | Task list with pass/fail status | Orchestrator |
| `activity.md` | Log of what was done | Orchestrator |
| `AGENT.md` | Deployment/build knowledge | Subagents (learnings) |
| `specs/*.md` | Feature specifications | Human (Phase 1) |

---

## Subagent Strategy

### Parallelism Rules
- **Search/Research:** Use as many subagents as needed (100+)
- **Implementation:** One subagent per task
- **Build/Test/Deploy:** Only ONE subagent (backpressure)

### Why Limit Build/Test?
If you fan out to hundreds of subagents all running builds, you get bad backpressure - race conditions, resource contention, and unpredictable results. Single subagent for validation ensures deterministic outcomes.

---

## The Loop's Purpose

The bash loop exists because:

1. **Fresh context each iteration** - No accumulated garbage degrading quality
2. **Clean exit points** - Don't let quality degrade within a session
3. **Recovery from failures** - If one iteration goes off rails, next starts fresh
4. **Deterministic checkpoints** - One commit per task, easy to debug/revert

---

## One Task vs Batching

### One Task Per Loop (Conservative - Recommended for Starting)
```
Loop → Pick 1 task → Subagents work → Update state → Commit → Exit
```
- Maximum quality, easy debugging
- More loop iterations, slower
- Best for: learning the technique, complex tasks

### Batch Until Context Fills (Advanced)
```
Loop → Pick 10 tasks → Parallel subagents → Update state → Commit → Exit
```
- Faster, more efficient
- Harder to debug, possible conflicts
- Best for: simple independent tasks, experienced operators

---

## Search Before Implement

**The Problem:** Ralph runs grep, doesn't find something, concludes "not implemented", creates a duplicate.

**The Solution:** Always search before implementing:
```
Before making changes, use a subagent to search the codebase.
Do NOT assume something is "not implemented" based on a single failed grep.
```

Use an Explore subagent - it burns its own context and returns a summary.

---

## Self-Improvement (AGENT.md)

Each loop starts fresh, so learnings are lost. AGENT.md persists knowledge:

```markdown
# AGENT.md

## Deployment Flow
[How to build and deploy]

## Gotchas
- Always use VITE_FIREBASE_ENV=dev for test builds
- PM2 restart required after server changes
- Delete macOS resource forks after tar extract

## Build Commands
[Correct commands that work]
```

**Rule:** When Ralph learns something new, have a subagent update AGENT.md.

---

## Backpressure / Verification

Code generation is cheap. Verification that it's correct is hard.

### Forms of Backpressure
- Type systems (Rust, TypeScript)
- Test suites
- Static analyzers
- Linters
- **MCP tools returning ground truth** (your setup)

The faster your verification wheel turns, the faster Ralph can iterate. But verification must be trustworthy - MCP tool responses are real, not hallucinated.

---

## Tuning Ralph (Prompt Engineering)

When Ralph does something wrong repeatedly:

1. **Identify the pattern** - Watch for repeated mistakes
2. **Add a sign** - Update PROMPT.md with explicit instruction
3. **Be specific** - "Do NOT implement placeholders" not "implement properly"
4. **Use priority markers** - Geoffrey uses `999.`, `9999.`, etc. for emphasis

### Example Signs
```
- DO NOT IMPLEMENT PLACEHOLDER IMPLEMENTATIONS
- Before making changes, search codebase using subagents
- Only ONE subagent for build/test operations
- When you learn something new, update AGENT.md
```

---

## Failure Handling

```
If verification fails:
1. Subagent may retry/fix (up to 3 attempts)
2. After 3 failures, log to activity.md
3. Do NOT mark passes: true
4. Exit and let next loop iteration retry with fresh context
```

The fresh context often solves problems that a polluted context couldn't.

---

## Your Setup (gymnastics-graphics)

### ralph.sh
```bash
#!/bin/bash
for ((i=1; i<=$1; i++)); do
  result=$(claude -p "$(cat PROMPT.md)" \
    --allowedTools "Read,Write,Edit,Glob,Grep,Task,Bash(...),,mcp__*" \
    --output-format text 2>&1)

  # Check for completion
  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    exit 0
  fi
done
```

### Allowed Tools
- **File ops:** Read, Write, Edit, Glob, Grep
- **Subagents:** Task
- **Bash:** npm, node, git, tar, rm, mkdir
- **MCP Playwright:** browser automation
- **MCP Gymnastics:** SSH, Firebase, AWS

### Verification via MCP Tools
- `ssh_exec` - Run commands on VMs, curl APIs
- `firebase_get/set` - Verify data state
- `browser_navigate/snapshot/screenshot` - Verify UI
- `aws_list_instances` - Verify infrastructure

---

## Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     BASH LOOP (ralph.sh)                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MAIN CONTEXT (Orchestrator)              │  │
│  │                                                       │  │
│  │  1. Read plan.md, activity.md, AGENT.md              │  │
│  │  2. Pick first task with passes: false               │  │
│  │  3. Spawn subagents ─────────────────────┐           │  │
│  │  4. Collect results  <───────────────────┤           │  │
│  │  5. Update plan.md, activity.md          │           │  │
│  │  6. Git commit                           │           │  │
│  │  7. Exit                                 │           │  │
│  │                                          │           │  │
│  └──────────────────────────────────────────┼───────────┘  │
│                                             │               │
│  ┌──────────────┐ ┌──────────────┐ ┌───────▼────────┐      │
│  │   Explore    │ │   Implement  │ │    Verify      │      │
│  │   Subagent   │ │   Subagent   │ │    Subagent    │      │
│  │              │ │              │ │                │      │
│  │ Search code  │ │ Write code   │ │ MCP tools      │      │
│  │ Find patterns│ │ Deploy       │ │ Ground truth   │      │
│  │              │ │              │ │ PASS/FAIL      │      │
│  └──────────────┘ └──────────────┘ └────────────────┘      │
│                                                             │
│  [Context garbage collected, fresh start next iteration]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Commands

```bash
# Run 1 iteration (test)
./ralph.sh 1

# Run 10 iterations
./ralph.sh 10

# Run until complete or 50 iterations
./ralph.sh 50
```

---

## Key Quotes from Geoffrey Huntley

> "You only have approximately 170k of context window to work with. The more you use the context window, the worse the outcomes."

> "Ralph is deterministically bad in an undeterministic world."

> "Any problem created by AI can be resolved through a different series of prompts."

> "The name of the game is that you only have approximately 170k of context window to work with. So it's essential to use as little of it as possible."

> "There's no way in heck would I use Ralph in an existing code base" - Best for greenfield projects, expect 90% completion.

---

## When NOT to Use Ralph

- Existing complex codebases (high risk of breaking things)
- Security-critical code (needs human review)
- When you need 100% correctness (Ralph gets ~90%)
- When debugging is more important than speed

---

## References

- Geoffrey Huntley's blog: ghuntley.com
- "The Ralph Wiggum Technique" original post
- CURSED programming language (built with Ralph)
- Y Combinator hackathon field report
