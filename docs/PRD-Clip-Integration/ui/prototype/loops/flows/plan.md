# Flows Loop — Implementation Plan

**Loop:** flows
**Output files:** `prototype/sections/state-machine.html`, `prototype/sections/workflows.html`, `prototype/sections/data-flow.html`
**Dependencies:** Shell loop must complete first (need style-guide.md)

---

### Task 1: Build state machine diagram — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/state-machine.html`

**What to build:**
- HTML fragment (no html/head/body tags — injected into index.html)
- Visual state diagram drawn with CSS (boxes, arrows, labels — no external library)
- States: idle, playing-clip, crossfading, override-active, paused, moment-replay, break-content, live-camera, stalled, coordinator-down
- Each state is a colored box with the state name and a brief description
- Arrows between states labeled with trigger events (e.g., "clipStart", "overrideOn", "stallDetected")
- Color-coded states: normal=cyan, error=red, override=orange, media=green
- Each state box is clickable (links to nav item for the relevant screen)
- Legend explaining the color coding
- Use CSS variables from the style guide

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 115–201 (§3C State Machine Definitions ONLY)

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md` (for CSS conventions)

### Task 2: Build workflow walkthroughs — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/workflows.html`

**What to build:**
- HTML fragment
- **Producer workflow:** Pre-meet setup → Load rundown → Configure playout rules → Go live → Monitor → Override when needed → End show
- **Commentator workflow:** Join show → See current clip info → Read talking points → Transition to next → Handle overrides
- Each workflow as a horizontal numbered step sequence with arrows
- Each step highlights which screen the user interacts with (color-coded by screen)
- Mini description at each step explaining what the user does
- Steps that involve state transitions reference the state machine
- Use CSS variables from the style guide

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 20–43 (§2 Users & Their Phases ONLY)

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md`

### Task 3: Build data flow diagram — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/data-flow.html`

**What to build:**
- HTML fragment
- Visual diagram showing system components as labeled boxes:
  - Coordinator Server, Firebase RTDB, ProducerView, TalentView, output.html (clip), output.html (live), OBS
- Arrows between components showing data direction (reads vs writes)
- Firebase paths labeled on each arrow (e.g., `competitions/{id}/currentGraphic`)
- Color-coded arrows by data type:
  - Blue: clip data / content commands
  - Green: status signals / heartbeat
  - Red: override commands
  - Yellow: configuration data
- Legend explaining arrow colors
- Component boxes show key responsibilities (2-3 bullet points each)
- Use CSS variables from the style guide

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 961–1045 (§5 Data Requirements Per Screen ONLY)

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md`
