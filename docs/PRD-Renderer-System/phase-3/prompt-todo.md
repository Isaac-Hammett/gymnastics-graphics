# Renderer System Phase 3: Scoring Ingestion — TODO Phase

You are turning specs into an implementation plan. You consume `specs/*.md` and produce `plan.md` — a prioritized, ordered task list with verify checklists.

## Goal

1. Study all specs written during the Requirements phase
2. Analyze the codebase to understand exactly what needs to change
3. Write `plan.md` — one task per unit of work, ordered by dependency, each with a verify checklist
4. Write initial `agent.md` — execution knowledge discovered during analysis

**You are a planner, not a builder.** Do not write code. Write the plan that the code loop will execute.

## Context — Read These First
- Parent PRD: `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md`
- Phase doc: `docs/PRD-Renderer-System/Phase-3-Scoring-Ingestion.md`
- Specs: `docs/PRD-Renderer-System/phase-3/specs/*.md` (ALL of them — these are your requirements)
- Codebase: see areas below

## Codebase Areas to Analyze
- `server/lib/` — existing service patterns (clipService.js, rtnStatsService.js, playoutEngine.js)
- `server/index.js` — service initialization, socket.io handler registration, route setup
- `show-controller/src/views/ProducerView.jsx` — producer sidebar panel structure, collapsible sections
- `show-controller/src/pages/HomePage.jsx` — competition card structure, existing badges
- `show-controller/src/hooks/` — existing hooks for Firebase listeners (useCompetitions.js, usePlayoutState.js, etc.)

---

## Execute

### 1. Load All Specs

- [ ] Read every file in `docs/PRD-Renderer-System/phase-3/specs/`
- [ ] Read the parent PRD: `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md`
- [ ] Read the phase doc: `docs/PRD-Renderer-System/Phase-3-Scoring-Ingestion.md`
- [ ] List every requirement and constraint across all specs

### 2. Analyze the Codebase

Use subagents to study the code. Fan out aggressively — up to 100 subagents for search/read.

For each codebase area listed above:
- [ ] Spawn subagents to map the relevant code:
  - What functions/components exist?
  - What are the dependencies between them?
  - What files would each spec change touch?
  - Where are the integration points?
- [ ] Identify shared state, tight coupling, and order-of-operations constraints
- [ ] Find existing patterns to follow (naming, structure, error handling)

### 3. Plan the Work

Break the work into tasks. Each task should be:
- **Atomic** — one task = one coherent unit of work that can be built + verified alone
- **Ordered** — respect dependencies (task 3 shouldn't require task 5's output)
- **Specific** — name the files to modify, the functions to change, the behavior to add
- **Verifiable** — include a Verify checklist with concrete visual/functional checks

**Task sizing:**
- Too small: "add an import statement" — combine with the thing that uses it
- Too big: "refactor the entire scoring system" — split by file or by concern
- Right size: "create scoringIngestionService with polling loop and processVirtiusData" — one feature, one verify

**Order by:**
1. Foundation tasks first (scoring ingestion service, Firebase paths)
2. Then features that depend on them (config listeners, auto-stop)
3. Then integration/wiring tasks (server init, socket events)
4. Then UI (producer panel, competition card badge)
5. Then polish/edge cases

### 4. Write plan.md

- [ ] Write `docs/PRD-Renderer-System/phase-3/plan.md` with this structure:

```markdown
# Renderer System Phase 3: Scoring Ingestion — Tasks

## Tasks

### Task 1: {description} — NOT STARTED
**Files:** {list of files this task modifies}
**Verify:** {what the local screenshot must show}
- [ ] {specific visible element or behavior}
- [ ] {specific visible element or behavior}
- [ ] {no console errors}

### Task 2: {description} — NOT STARTED
**Files:** {files}
**Verify:** {what to check}
- [ ] {checklist item}
- [ ] {checklist item}

...

## Discovered Bugs
(populated by iterations as they find problems)

## Learnings
(breadcrumbs for future iterations — the next iteration has ZERO memory)
```

### 5. Write Initial agent.md

- [ ] Append to `docs/PRD-Renderer-System/phase-1/agent.md` (shared across phases) with execution knowledge discovered during analysis:

```markdown
## Phase 3: Scoring Ingestion

{What the code loop needs to know that isn't in the specs or plan.}
{Gotchas, timing issues, dependencies, patterns.}

- {e.g., "clipService.js uses setInterval, not recursive setTimeout — follow same pattern"}
- {e.g., "server/index.js initializes services after socket.io setup — add scoringIngestionService.init() there"}
- {e.g., "ProducerView sidebar uses CollapsibleSection component — reuse for scoring panel"}
```

### 6. Create Empty fixes.md

- [ ] Write `docs/PRD-Renderer-System/phase-3/fixes.md`:
```markdown
# Fixes Needed
```

### 7. Output Summary

```
TODO_COMPLETE
Tasks: [count]
Files touched: [list of unique files across all tasks]
Estimated complexity: [low / medium / high]
Dependencies: [any external dependencies or prerequisites]
```

---

## Rules for Subagents

- **Read-only.** Subagents search, read, analyze. They do not edit files.
- **Fan out freely** for codebase analysis — up to 100 concurrent subagents
- **Each subagent = one focused question:** "What does function X depend on?" not "analyze everything"
- **Return findings to main context** — the main agent synthesizes and writes the plan

## Rules for Task Quality

- Every task MUST have a **Verify** section with specific, checkable criteria
- Every task MUST list the **Files** it modifies (this prevents conflicts in parallel loops)
- Tasks should be ordered so that task N never depends on task N+1
- Don't create tasks for "setup" or "cleanup" unless they involve real code changes
- Don't create separate tasks for documentation updates — PRD issue updates happen inline during each task's Document step
- Each task description should note which PRD issue(s) it resolves (e.g., "Issue #33") so the code loop knows what to mark FIXED
- If a spec has open questions, create a task that resolves the question first, before the tasks that depend on the answer
