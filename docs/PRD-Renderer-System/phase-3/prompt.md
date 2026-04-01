# Renderer System Phase 3: Scoring Ingestion — Code Loop

> Reference: `docs/_template/standard-loop-v2/LOOP-SYSTEM.md`

## Context — Read These First
- Specs: `docs/PRD-Renderer-System/phase-3/specs/*.md` (requirements — one file per topic)
- Tasks: `docs/PRD-Renderer-System/phase-3/plan.md`
- Execution knowledge: `docs/PRD-Renderer-System/phase-1/agent.md`
- Fixes: `docs/PRD-Renderer-System/phase-3/fixes.md`

## Rules
- **ONE task** per iteration, then stop
- **Search before you build** — don't assume something isn't implemented
- **Build MUST pass AND local screenshot MUST look right** before committing
- **No placeholders** — full implementations only
- **One fix attempt** on failure, then bug it and exit. Fresh context > stale circles.
- **Document learnings** in plan.md and agent.md — the next iteration has zero memory of you
- Task markers: `— NOT STARTED` / `— IN PROGRESS` / `— COMPLETE`

## Back Pressure
```bash
# Server files — syntax check
node -c server/lib/scoringIngestionService.js

# React files — full build
cd show-controller && npm run build
```

## Local Verification
```
# React UI (start dev server if needed: cd show-controller && npm run dev)
http://localhost:5173/

# Server health
curl localhost:3003/health
```

General screenshot checks (every task):
- Page loads (no blank/white screen)
- No console errors
- Layout not broken

---

## Execute

### 1. Load State

Read these files (they are your memory from past iterations):

- [ ] `docs/PRD-Renderer-System/phase-3/fixes.md` — if a fix line exists, it is your **priority task** (skip to step 3)
- [ ] `docs/PRD-Renderer-System/phase-3/plan.md` — find next task to work on. Read Learnings + Bugs.
  - If a task is `— IN PROGRESS`: a previous iteration started it but crashed before finishing. **Verify it first** — grep/read the code to check if the implementation is already done. If done: run back pressure (step 4A) + screenshot (step 4B) to confirm, then mark COMPLETE and commit. If partially done or broken: continue from where it left off.
  - If no `IN PROGRESS` task: find next `— NOT STARTED` task.
- [ ] `docs/PRD-Renderer-System/phase-1/agent.md` — execution knowledge from past iterations
- [ ] If ALL tasks COMPLETE and no fixes → output `ALL_COMPLETE` and stop.

### 2. Search

- [ ] Grep/glob for existing code related to this task
- [ ] Find patterns to follow (naming, component structure)
- [ ] Find things you might break (imports, references, shared state)

### 3. Implement

- [ ] Mark task `— IN PROGRESS` in plan.md
- [ ] Implement (one task only, full implementation)
- [ ] If fixing from `fixes.md`: address the exact issue. If it needs structural changes beyond a patch, output `CRITICAL_STRUCTURAL: {description}` and stop.

### 4. Back Pressure

**4A: Build/Test**
- [ ] Run back pressure commands (from top of prompt)
- [ ] PASS → continue to 4B
- [ ] FAIL → one fix attempt:
  1. Read error, diagnose, fix, rerun
  2. If PASS → continue to 4B
  3. If STILL FAILING → add bug to plan.md, mark task COMPLETE, commit, push, **exit**:
     ```
     - BUG: Build fails after Task {N} — {error}. Tried: {fix}. (found during Task {N})
     ```

**4B: Local Screenshot**
- [ ] `browser_install` (if first time this iteration)
- [ ] Navigate to Local Verification URL
- [ ] Screenshot → `docs/PRD-Renderer-System/phase-3/screenshots/local-task-{id}.png`
- [ ] **Read screenshot back. Describe what you see in 1-2 sentences.**
- [ ] Check task's **Verify** checklist from plan.md. For each item: `YES — {what I see}` or `NO — {what's wrong}`
- [ ] ALL confirmed → continue to step 5
- [ ] Something wrong → one fix attempt:
  1. Identify: "Expected {X} but see {Y}"
  2. Diagnose: read code, check console errors
  3. Fix the root cause
  4. Rebuild (rerun 4A commands)
  5. Re-screenshot → `docs/PRD-Renderer-System/phase-3/screenshots/local-task-{id}-fix.png`
  6. Read it back. Did it work?
  7. PASS → continue to step 5
  8. STILL WRONG → add bug to plan.md, mark task COMPLETE, commit, push, **exit**:
     ```
     - BUG: Task {N} shows {what you see}. Expected {correct}. Tried: {fix}. Screenshots: local-task-{N}-fix.png (found during Task {N})
     ```

### 5. Document

- [ ] Add learnings to plan.md: `- LEARNING: {what the next iteration needs to know}`
- [ ] Add discovered bugs: `- BUG: {description} (found during Task N)`
- [ ] Mark task `— COMPLETE`
- [ ] If this was a fix from `fixes.md`, remove the fix line
- [ ] If you discovered something non-obvious about the codebase, append to `docs/PRD-Renderer-System/phase-1/agent.md`
- [ ] **Update PRD:** In the PRD file, mark the issue(s) this task addresses as FIXED. Use strikethrough + FIXED pattern:
  `~~**Issue text**~~ — **FIXED {date}.** {brief description of what was done}. Commit: {hash}.`
  This is CRITICAL — without it, future conversations cannot tell what's done vs what still needs work.

### 6. Commit + Push

```bash
git add server/ show-controller/src/ docs/PRD-Renderer-System/phase-3/ docs/PRD-Renderer-System/phase-1/agent.md docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md
git commit -m "PRD-Renderer-System: {brief task description}"
git pull --rebase origin main && git push origin main
```
