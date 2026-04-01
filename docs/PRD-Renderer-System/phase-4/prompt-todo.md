# Renderer System Phase 4: Tool Integration — TODO Phase

You are turning specs into an implementation plan. You consume `specs/*.md` and produce `plan.md` — a prioritized, ordered task list with verify checklists.

## Goal

1. Study all specs written during the Requirements phase
2. Analyze the codebase to understand exactly what needs to change
3. Write `plan.md` — one task per unit of work, ordered by dependency, each with a verify checklist
4. Append Phase 4 execution knowledge to `agent.md`

**You are a planner, not a builder.** Do not write code. Write the plan that the code loop will execute.

## Context — Read These First
- Parent PRD: `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md`
- Phase doc: `docs/PRD-Renderer-System/Phase-4-Tool-Integration.md`
- Specs: `docs/PRD-Renderer-System/phase-4/specs/*.md` (ALL of them — these are your requirements)
- Codebase: see areas below

## Codebase Areas to Analyze
- `show-controller/src/lib/graphicsRegistry.js` — registry to be replaced with generated imports
- `show-controller/src/lib/urlBuilder.js` — URL building to be refactored to generic manifest-based approach
- `show-controller/src/pages/UrlGeneratorPage.jsx` — sidebar needs to use registry categories
- `show-controller/src/components/GraphicsControl.jsx` — needs to add `renderer` field to currentGraphic writes
- `server/lib/timesheetEngine.js` — needs to add `renderer` field when triggering graphics
- `output.html` — needs renderer check in currentGraphic listener
- `stage/` — where manifest files will live
- `scripts/` — where buildGraphicsRegistry.js will be created

---

## Execute

### 1. Load All Specs

- [ ] Read every file in `docs/PRD-Renderer-System/phase-4/specs/`
- [ ] Read the parent PRD: `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md`
- [ ] Read the phase doc: `docs/PRD-Renderer-System/Phase-4-Tool-Integration.md`
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
- Too big: "refactor the entire URL builder" — split by file or by concern
- Right size: "create buildGraphicsRegistry.js with category validation" — one feature, one verify

**Order by:**
1. Foundation tasks first (categories.json, build script scaffolding)
2. Manifest files (stage engine graphics, then legacy overlays)
3. Build script features (validation, themeVars checks, generated file output)
4. Renderer routing (GraphicsControl, output.html, timesheetEngine)
5. URL Generator updates (generic URL building, sidebar from registry)
6. UI enhancements (badges, preview indicators, copyable URLs)
7. Migration status report

### 4. Write plan.md

- [ ] Write `docs/PRD-Renderer-System/phase-4/plan.md` with this structure:

```markdown
# Renderer System Phase 4: Tool Integration — Tasks

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

### 5. Append to agent.md

- [ ] Append to `docs/PRD-Renderer-System/phase-1/agent.md` (shared across phases) with execution knowledge discovered during analysis:

```markdown
## Phase 4 Findings

{What the code loop needs to know that isn't in the specs or plan.}
{Gotchas, timing issues, dependencies, patterns.}

- {e.g., "graphicsRegistry.js exports GRAPHICS as named export — generated file must match"}
- {e.g., "urlBuilder.js has 7 special-case functions — they can be deleted after manifests exist"}
- {e.g., "UrlGeneratorPage.jsx uses baseGraphicTitles object — replace with registry.CATEGORIES"}
```

### 6. Create Empty fixes.md

- [ ] Write `docs/PRD-Renderer-System/phase-4/fixes.md`:
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
