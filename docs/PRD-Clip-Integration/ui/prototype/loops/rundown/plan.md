# Rundown Loop — Implementation Plan

**Loop:** rundown
**Output file:** `prototype/sections/rundown.html`
**Dependencies:** Shell loop must complete first (need style-guide.md)

---

### Task 1: Build RundownEditor screen mockup — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/rundown.html`

**What to build:**
- HTML fragment (no html/head/body tags — injected into index.html)
- Static visual mockup of the RundownEditor layout
- Rotation break content configuration UI
- Content sequence editor (drag/drop visual representation with numbered items)
- Fallback sequence settings panel
- Apparatus priority configuration
- Gap fill rule settings
- Pre-meet vs live mode indicators
- Use CSS variables and classes from the style guide
- Purple (#b56aff) color accent for RundownEditor elements
- Section badges (§X.X) on each UI region

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 204–378 (Screen 1: Rundown Editor ONLY)

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md` (for CSS conventions)

### Task 2: Add state variations, toggles, and polish — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/rundown.html`

**What to build:**
- Toggle buttons: "Show: Pre-Meet Setup | Live Monitoring | Editing Sequence"
- Pre-Meet Setup: show full configuration panels, editable fields
- Live Monitoring: show read-only view with live status indicators, disable editing
- Editing Sequence: show drag/drop in active state, highlight reorderable items
- Section badges on all state-dependent elements
- Verify all PRD elements from lines 204–378 are represented
- Ensure no placeholder text remains

**PRD sections to read:**
- Re-read lines 204–378 for any state-dependent UI references

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md`
