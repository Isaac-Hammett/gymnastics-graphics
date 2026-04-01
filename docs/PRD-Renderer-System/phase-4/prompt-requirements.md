# Renderer System Phase 4: Tool Integration — Requirements Phase

You are shaping the context window to understand what needs to be built. You are NOT implementing anything. Your output is `specs/*.md` files — one per topic of concern.

## Goal

Understand the full scope of the work by:
1. Loading external information (URLs, docs, papers, API references, existing PRDs)
2. Deeply studying the codebase to verify every claim and understand current state
3. Writing each topic of concern as a discrete spec file in `specs/`

**You are a researcher, not a builder.** Do not write code. Do not create implementation plans. Shape understanding.

## External Sources to Load
- `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md` — the parent PRD (read fully)
- `docs/PRD-Renderer-System/Phase-4-Tool-Integration.md` — this phase's spec (read fully)
- `docs/PRD-Renderer-System/phase-1/agent.md` — execution knowledge from Phase 1-3
- `docs/PRD-Renderer-System/phase-1/specs/*.md` — Phase 1 specs (renderer foundation)
- `docs/PRD-Renderer-System/phase-2/specs/*.md` — Phase 2 specs (content blocks)
- `docs/PRD-Renderer-System/phase-3/specs/*.md` — Phase 3 specs (scoring ingestion)

## Existing Codebase Context
- `show-controller/src/lib/graphicsRegistry.js` — current hand-maintained graphics registry (to be replaced)
- `show-controller/src/lib/urlBuilder.js` — URL generation for graphics (switch statement to be refactored)
- `show-controller/src/pages/UrlGeneratorPage.jsx` — URL Generator sidebar structure, graphic selection
- `show-controller/src/components/GraphicsControl.jsx` — Web Graphics Panel, writes to currentGraphic
- `server/lib/timesheetEngine.js` — rundown system, triggers graphics from segments
- `output.html` — renderer check at currentGraphic listener (needs to ignore stage graphics)
- `stage/` — existing stage engine files (stage.html, blocks/, skeletons/)
- `overlays/` — existing overlay HTML files

## Questions to Answer
- What is the current structure of graphicsRegistry.js? What fields exist per graphic?
- How does urlBuilder.js generate URLs today? What's the switch statement pattern?
- How are sidebar sections built in UrlGeneratorPage.jsx? Is it hardcoded or data-driven?
- What does GraphicsControl.jsx write to currentGraphic today? Where would the `renderer` field go?
- How does the timesheet engine trigger graphics? Where would it look up the registry?
- Where in output.html is the currentGraphic listener? Where should the renderer check go?
- What overlay files exist that would need legacy manifests?
- What's the expected format of a manifest JSON file?
- How does theme resolution work (for baking theme into spec at trigger time)?
- What existing patterns exist for sidebar badges and preview indicators in React?

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

- [ ] Read the parent PRD and Phase 4 doc fully
- [ ] Read phase-1/agent.md for execution knowledge
- [ ] Read all phase-1/specs/*.md, phase-2/specs/*.md, phase-3/specs/*.md for context
- [ ] Note any claims that need codebase verification
- [ ] **Cross-reference the parent PRD against Phase-4-Tool-Integration.md. List every applicable PRD requirement and whether the phase doc covers it. Flag gaps and contradictions.**

### 2. Study the Codebase

Use subagents to analyze in parallel. Fan out freely — up to 20 subagents for read-only analysis.

- [ ] **graphicsRegistry.js:** Read fully. Document the `GRAPHICS` object structure, all fields per graphic, helper functions like `getGraphicById`, `getGraphicsByCategory`
- [ ] **urlBuilder.js:** Read fully. Map the switch statement structure, identify all special-case builders, understand `buildGraphicUrlFromRegistry` fallback
- [ ] **UrlGeneratorPage.jsx:** Read sidebar structure. How are categories/graphics listed? Is it hardcoded or uses registry helpers?
- [ ] **GraphicsControl.jsx:** Find all `currentGraphic.set()` calls. Document what data they write. Find where `renderer` field would be added.
- [ ] **timesheetEngine.js:** Find graphics triggering code. Understand how it decides what to write to currentGraphic.
- [ ] **output.html currentGraphic listener:** Find the exact line where it processes incoming graphics. Understand the flow for adding the renderer check.
- [ ] **stage/ directory audit:** List existing skeletons, blocks, any existing manifest files
- [ ] **overlays/ directory audit:** List all overlay HTML files that need legacy manifests
- [ ] **Theme resolution:** Search for `resolveTheme`, `meetTheme`, theme loading patterns in GraphicsControl and elsewhere
- [ ] **React sidebar badges:** Search for existing badge patterns in sidebars (competition cards, producer panels)

### 3. Answer All Questions

- [ ] Work through each question above with evidence (file:line references)
- [ ] Surface NEW questions that emerged during investigation
- [ ] Flag anything in the PRD that is wrong or incomplete based on codebase evidence

### 4. Write Specs

Write one `specs/{topic}.md` file per concern. Suggested topics (adjust based on findings):

- `specs/current-registry-structure.md` — How graphicsRegistry.js works today, all fields, helper functions
- `specs/url-builder-patterns.md` — urlBuilder.js structure, switch statement, special cases, fallback logic
- `specs/url-generator-sidebar.md` — UrlGeneratorPage.jsx sidebar structure, how graphics are listed/selected
- `specs/graphics-control-set-calls.md` — All currentGraphic.set() locations in GraphicsControl.jsx
- `specs/timesheet-graphics-triggering.md` — How timesheetEngine.js triggers graphics from rundown segments
- `specs/output-html-renderer-check.md` — Exact location and logic for adding renderer check to output.html
- `specs/manifest-format.md` — Complete manifest JSON schema with all fields from Phase 4 doc
- `specs/legacy-overlays-inventory.md` — List of all overlay HTML files needing legacy manifests
- `specs/theme-resolution-patterns.md` — How theme resolution works, where resolveTheme helper should go
- `specs/prd-gap-analysis.md` — **(REQUIRED)** Every parent PRD requirement that applies to Phase 4, whether the phase doc covers it, and what's missing.

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
