# Renderer System Phase 3: Scoring Ingestion — Requirements Phase

You are shaping the context window to understand what needs to be built. You are NOT implementing anything. Your output is `specs/*.md` files — one per topic of concern.

## Goal

Understand the full scope of the work by:
1. Loading external information (URLs, docs, papers, API references, existing PRDs)
2. Deeply studying the codebase to verify every claim and understand current state
3. Writing each topic of concern as a discrete spec file in `specs/`

**You are a researcher, not a builder.** Do not write code. Do not create implementation plans. Shape understanding.

## External Sources to Load
- `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md` — the parent PRD (read fully)
- `docs/PRD-Renderer-System/Phase-3-Scoring-Ingestion.md` — this phase's spec (read fully)
- `docs/PRD-Renderer-System/phase-1/agent.md` — execution knowledge from Phase 1
- `docs/PRD-Renderer-System/phase-1/specs/*.md` — all Phase 1 specs (context on renderer foundation)
- `docs/PRD-Renderer-System/phase-2/specs/*.md` — all Phase 2 specs (context on content blocks that will consume scoring data)

## Existing Codebase Context
- `server/lib/clipService.js` — existing polling service pattern (fetch + process + state management)
- `server/lib/rtnStatsService.js` — existing stats ingestion service (Firebase read/write patterns)
- `server/lib/playoutEngine.js` — another service with polling loops, lifecycle management
- `server/index.js` — how services are initialized, socket.io setup, route registration
- `output.html` — current Virtius API fetching in `fetchAndRenderLeaderboard` (the code being replaced)
- `show-controller/src/views/ProducerView.jsx` — where the scoring feed panel will go (existing sidebar panels)
- `show-controller/src/pages/HomePage.jsx` — where the competition card badge will go (existing card structure)
- `show-controller/src/hooks/` — existing hooks for Firebase listeners (patterns to follow)

## Questions to Answer
- How does the existing Virtius API integration work (direct fetch vs service)? What URL patterns, auth, response format?
- What polling patterns exist in the codebase already (playoutEngine, clipService)? How do they manage start/stop/interval changes?
- What's the exact Virtius API response format? What fields are available for leaderboard rows (diff, exec, stick bonus)?
- How do existing producer sidebar panels work (collapsible, Firebase listeners, state management)?
- What competition card badges exist already and how are they structured? What click behaviors do they have?
- Does `scoring/` Firebase path exist today or is it new? What existing Firebase paths relate to scoring data?
- How does rtnStatsService.js handle multi-competition polling? Does it have auto-stop logic?
- What's the pattern for service initialization in server/index.js? How are services started, stopped, passed db/io?
- How does the current leaderboard data flow work (output.html fetches Virtius directly → renders)? What processing does it do?

### PRD ↔ Phase Doc Gap Analysis (REQUIRED)

If this work is one phase of a larger PRD, the phase doc is a **detached document** that may have drifted from or omitted requirements in the parent PRD. You MUST cross-reference them:

- Read the **full parent PRD** — Architecture Decisions, data formats, error handling patterns, cross-phase contracts
- Read the **phase doc** for this specific phase
- For every PRD requirement that could apply to this phase, check whether the phase doc addresses it
- Flag gaps: requirements the PRD mandates but the phase doc doesn't mention
- Flag contradictions: places where the phase doc specifies something different from the PRD
- Check whether **later phases** reference this phase's outputs and impose constraints on how they must be built now

Write findings to `specs/prd-gap-analysis.md`. This spec is mandatory whenever a phase doc exists separately from the PRD.

---

## Execute

### 1. Load External Sources

- [ ] Read the parent PRD and Phase 3 doc fully
- [ ] Read phase-1/agent.md for execution knowledge
- [ ] Read all phase-1/specs/*.md for renderer foundation context
- [ ] Read all phase-2/specs/*.md for content block context (these blocks will consume scoring data)
- [ ] Note any claims that need codebase verification
- [ ] **Cross-reference the parent PRD against Phase-3-Scoring-Ingestion.md. List every applicable PRD requirement and whether the phase doc covers it. Flag gaps and contradictions.**

### 2. Study the Codebase

Use subagents to analyze in parallel. Fan out freely — up to 20 subagents for read-only analysis.

- [ ] **Virtius API integration:** Read output.html, search for `fetchAndRenderLeaderboard`, `virti.us`, API URL patterns. Understand current data flow.
- [ ] **clipService patterns:** Read `server/lib/clipService.js` — polling loop, start/stop, interval management, error handling, state persistence
- [ ] **rtnStatsService patterns:** Read `server/lib/rtnStatsService.js` — Firebase read/write patterns, multi-competition handling, composite team assembly
- [ ] **playoutEngine patterns:** Read `server/lib/playoutEngine.js` — lifecycle management, socket events, heartbeat, mode switching
- [ ] **Server initialization:** Read `server/index.js` — how services are created, passed db/io, connected to routes/sockets
- [ ] **Producer sidebar panels:** Read `show-controller/src/views/ProducerView.jsx` — collapsible sections, panel structure, Firebase listeners
- [ ] **Competition cards:** Read `show-controller/src/pages/HomePage.jsx` — card structure, existing badges, click handlers
- [ ] **Firebase hooks:** Read `show-controller/src/hooks/` — useCompetitions.js, usePlayoutState.js for listener patterns
- [ ] **Firebase paths audit:** Search codebase for `scoring/` references. Check if the path already exists or is new.
- [ ] **Virtius API response:** Search for API response parsing, field names (diff, exec, stickBonus, rotation, event_score)

### 3. Answer All Questions

- [ ] Work through each question above with evidence (file:line references)
- [ ] Surface NEW questions that emerged during investigation
- [ ] Flag anything in the PRD that is wrong or incomplete based on codebase evidence

### 4. Write Specs

Write one `specs/{topic}.md` file per concern. Suggested topics (adjust based on findings):

- `specs/virtius-api-current-state.md` — How Virtius API integration works today, URL patterns, response format, processing logic
- `specs/service-patterns.md` — Patterns from clipService, rtnStatsService, playoutEngine that scoringIngestionService should follow
- `specs/firebase-scoring-paths.md` — Exact Firebase paths, data schemas, read/write patterns for scoring data
- `specs/producer-ui-patterns.md` — How existing producer sidebar panels work, component patterns, Firebase listener hooks
- `specs/competition-card-badges.md` — Existing badge patterns on competition cards, click behaviors, state management
- `specs/auto-stop-logic.md` — Existing auto-stop patterns in other services, competition lifecycle states
- `specs/prd-gap-analysis.md` — **(REQUIRED)** Every parent PRD requirement that applies to Phase 3, whether the phase doc covers it, and what's missing.

Each spec should contain:
- **What:** Description of this aspect
- **Current State:** How it works today (with file:line references)
- **Target State:** What it should look like after implementation
- **Risks:** What could go wrong
- **Open Questions:** Anything unresolved

### 5. Output Summary

```
REQUIREMENTS_COMPLETE
Specs written: [count]
- specs/{name}.md — {one-line description}
Open questions: [count]
- {question}
PRD corrections needed: [count]
- {correction}
```

---

## Rules for Subagents

- **Read-only.** Subagents search, read, fetch. They do not edit files.
- **Fan out freely** for codebase search — up to 20 concurrent subagents
- **Return findings to main context** — the main agent synthesizes, not the subagents
