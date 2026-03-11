# New Feature Planning Kickoff

## How to Use
Paste this at the START of a plan mode conversation when designing a new feature.
Fill in the feature description below, then work through the questions with Claude.
When planning is done, Claude generates all 6 files using the templates in `docs/_template/`.

---

# [Feature Name] — Planning Session

## Feature Description
{Describe what you want to build — paste your notes, user stories, or rough ideas here}

---

## System Context for Claude
This project uses a **PRD Route Loop** workflow. Every feature produces a package of 6 files
that drive autonomous implementation. Templates are in `docs/_template/`.

| File | Purpose |
|------|---------|
| `PRD-{Name}-{date}.md` | Requirements, bugs, acceptance criteria |
| `implementation-plan.md` | Phased tasks with status tracking |
| `prompt-{Name}-Discovery.md` | Finds holes in plan (new feature) OR audits broken system (bug fix) |
| `prompt-{Name}.md` | Execution loop protocol (one task per iteration) |
| `run-{Name}-Discovery.sh` | Runs discovery (single run, not a loop) |
| `run-{Name}.sh` | Runs execution loop (loops until PRD status = COMPLETE) |

### Key Loop Rules
- Each loop iteration = **a completely new Claude window** (stateless, no shared context)
- **One task per iteration** — implement, commit, then stop
- **Deploy batching** — code tasks commit only; dedicated deploy tasks build + upload + verify
- Screenshots save to `docs/PRD-{Name}/screenshots/`

---

## Questions to Resolve Before Generating Files

Work through these during the planning conversation:

**Feature:**
- [ ] What problem does this solve?
- [ ] Who uses it (producer, athlete, admin)?
- [ ] What are the acceptance criteria (testable, specific)?

**Discovery Type — pick one:**
- [ ] **New feature** → discovery prompt checks plan integrity (file paths exist, tasks concrete, ordering correct)
- [ ] **Bug audit** → discovery prompt runs Playwright against broken system, documents what's broken

**Technical Scope:**
- [ ] What files will be modified? (list specific paths, not just "the frontend")
- [ ] Frontend build required? Server restart? Firebase only?
- [ ] Test competition ID and URL for Playwright verification?

**Plan Structure:**
- [ ] Group tasks into phases: Critical → Major → Minor → Deploy → Polish
- [ ] Each task needs: exact file path, concrete code change (not vague), specific verification step
- [ ] Each phase ends with an explicit deploy task (not scattered per-task deploys)

---

## Output Required
When planning is complete, generate all 6 files into `docs/PRD-{FeatureName}/`.
Use `docs/_template/` files as the basis — copy structure, fill in all placeholders.
Replace every `{FeatureName}`, `{date}`, `TODO`, and placeholder before writing.
