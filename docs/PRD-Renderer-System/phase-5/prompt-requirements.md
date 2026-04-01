# Renderer System Phase 5: Graphics Reorganization — Requirements Phase

You are shaping the context window to understand what needs to be built. You are NOT implementing anything. Your output is `specs/*.md` files — one per topic of concern.

## Goal

Understand the full scope of the work by:
1. Loading external information (URLs, docs, papers, API references, existing PRDs)
2. Deeply studying the codebase to verify every claim and understand current state
3. Writing each topic of concern as a discrete spec file in `specs/`

**You are a researcher, not a builder.** Do not write code. Do not create implementation plans. Shape understanding.

## External Sources to Load
- `docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md` — the parent PRD (read fully)
- `docs/PRD-Renderer-System/Phase-5-Reorganization.md` — this phase's spec (read fully)
- `docs/PRD-Renderer-System/phase-1/agent.md` — execution knowledge from prior phases
- `docs/PRD-Renderer-System/phase-4/specs/*.md` — Phase 4 specs (context on registry/manifest system that Phase 5 extends)

## Existing Codebase Context
- `stage/graphics/categories.json` — current category definitions (from Phase 4)
- `stage/graphics/*.json` — existing graphic manifests (stage engine graphics)
- `stage/graphics/legacy/*.json` — existing legacy manifests (overlay/output graphics)
- `show-controller/src/lib/graphicsRegistry.generated.js` — generated registry from Phase 4
- `show-controller/src/lib/graphicsRegistry.js` — registry helper functions
- `show-controller/src/pages/UrlGeneratorPage.jsx` — URL Generator sidebar implementation
- `show-controller/src/components/GraphicsControl.jsx` — Web Graphics Panel sidebar implementation
- `scripts/buildGraphicsRegistry.js` — registry build script

## Questions to Answer
- What categories and subcategories currently exist in `categories.json`? How do they need to change for Phase 5?
- How does the current URL Generator sidebar structure work? What component renders categories/subcategories?
- How does the current Web Graphics Panel (GraphicsControl) sidebar work? Is it already using the registry or hardcoded?
- What graphics currently exist in the registry? Do they already have `category` and `subcategory` fields?
- How does gender filtering work today? Which graphics need to be filtered by competition gender?
- Are subcategories currently collapsible in the sidebar? What UI pattern is used?
- Does Phase 4's manifest system already handle categories, or is that structure new in Phase 5?

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

- [ ] Read the parent PRD and Phase 5 doc fully
- [ ] Read phase-1/agent.md for execution knowledge
- [ ] Read all phase-4/specs/*.md for manifest/registry context
- [ ] Note any claims that need codebase verification
- [ ] **Cross-reference the parent PRD against Phase-5-Reorganization.md. List every applicable PRD requirement and whether the phase doc covers it. Flag gaps and contradictions.**

### 2. Study the Codebase

Use subagents to analyze in parallel. Fan out freely — up to 20 subagents for read-only analysis.

- [ ] **categories.json:** Read `stage/graphics/categories.json` — current categories, subcategories, display labels, order
- [ ] **Manifest audit:** Scan `stage/graphics/**/*.json` — which graphics exist, what category/subcategory fields they have
- [ ] **URL Generator sidebar:** Read `UrlGeneratorPage.jsx` — how sidebar is rendered, where categories come from, current structure
- [ ] **GraphicsControl sidebar:** Read `GraphicsControl.jsx` — how Web Graphics Panel sidebar works, is it registry-driven or hardcoded
- [ ] **Gender filtering:** Search for `gender` in URL Generator and Graphics Panel — how is filtering implemented today
- [ ] **Collapsible UI:** Search for `collapse` or `expand` in URL Generator — what component/pattern is used for subcategory folding
- [ ] **Registry helpers:** Read `graphicsRegistry.js` — what helper functions exist for getting graphics by category
- [ ] **Build script:** Read `buildGraphicsRegistry.js` — how does it process category/subcategory fields

### 3. Answer All Questions

- [ ] Work through each question above with evidence (file:line references)
- [ ] Surface NEW questions that emerged during investigation
- [ ] Flag anything in the PRD that is wrong or incomplete based on codebase evidence

### 4. Write Specs

Write one `specs/{topic}.md` file per concern. Suggested topics (adjust based on findings):

- `specs/current-category-structure.md` — What categories/subcategories exist today, what needs to change
- `specs/url-generator-sidebar.md` — How URL Generator sidebar works, what changes are needed
- `specs/graphics-control-sidebar.md` — How Web Graphics Panel sidebar works, what changes are needed
- `specs/gender-filtering.md` — How gender filtering works, which graphics need it
- `specs/collapsible-ui-pattern.md` — What UI pattern to use for collapsible subcategories
- `specs/registry-manifest-updates.md` — What manifest changes are needed, which graphics need category/subcategory added
- `specs/prd-gap-analysis.md` — **(REQUIRED)** Every parent PRD requirement that applies to Phase 5, whether the phase doc covers it, and what's missing.

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
