# Shell Loop — Implementation Plan

**Loop:** shell
**Output files:** `prototype/index.html`, `prototype/sections/style-guide.md`
**Dependencies:** None (runs first, before all other loops)

---

### Task 1: Create index.html shell with navigation and dynamic section loading — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/index.html`

**What to build:**
- Self-contained HTML file with all CSS inline
- Dark theme: backgrounds #1a1a2e / #16213e, text #e0e0e0
- Left sidebar navigation with these sections and sub-items:
  - **Screens:** ProducerView, TalentView, RundownEditor, output.html
  - **States:** State Machine, Per-Screen States
  - **Workflows:** Producer Workflow, Commentator Workflow
  - **Data Flow:** Data Flow Diagram
- Main content area that dynamically loads section HTML files via `fetch('sections/{name}.html')`
- Each nav item initially shows a "Building..." placeholder with the loop name that will provide it
- Color coding: Blue (#4a9eff)=ProducerView, Green (#4ecdc4)=TalentView, Orange (#ff8c42)=output.html, Purple (#b56aff)=RundownEditor, Red (#ff4757)=override, Gray (#666)=disabled
- CSS variables for all colors, spacing, typography in `:root`
- Collapsible right-side "Feedback Notes" panel with:
  - PRD section list (§1 through §12) with text area for each
  - "Export Notes" button (copies non-empty notes as markdown to clipboard)
  - Notes persist in localStorage
- Coverage indicator bar at top: "PRD Coverage: X / Y sections visualized"
- Keyboard shortcut: Cmd+G / Ctrl+G opens quick-search modal to jump by section number
- CSS Grid layout, 1920x1080 primary, scales down reasonably

**PRD context (read for nav structure only):**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 1–12 (section headers only, use grep)

### Task 2: Create style-guide.md for parallel loops — NOT STARTED

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md`

**What to build:**
- Read back the `index.html` you just created
- Document ALL CSS variables defined in `:root`
- Document ALL shared CSS classes (layout containers, badges, buttons, panels, cards)
- Document the section file contract:
  - Section files are raw HTML fragments (no `<html>`, `<head>`, `<body>` tags)
  - They are injected into the `#content` area via `innerHTML`
  - They inherit all CSS from `index.html`
  - They should use the documented CSS variables and classes
- Document the color coding system with hex values
- Document the section badge pattern: `<span class="section-badge" data-section="4.2">§4.2</span>`
- Document the state toggle pattern (if applicable)
- Keep it concise — this is a reference, not a tutorial
