# Producer Loop — Implementation Plan

**Loop:** producer
**Output file:** `prototype/sections/producer.html`
**Dependencies:** Shell loop must complete first (need style-guide.md)

---

### Task 1: Build ProducerView screen mockup — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/producer.html`

**What to build:**
- HTML fragment (no html/head/body tags — injected into index.html)
- Static visual mockup of the ProducerView layout
- Labeled regions: header bar, sidebar (clip queue), main content (current playback), right panels (override controls, status)
- All playout panels: clip queue list, current playback info, override controls, status indicators
- Placeholder content using fixture data (real athlete names, team names, scores)
- All buttons and controls mentioned in PRD §4 Screen 2
- Use CSS variables and classes from the style guide
- Blue (#4a9eff) color accent for ProducerView elements
- Section badges (§X.X) on each UI region

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 379–671 (Screen 2: ProducerView ONLY)

**Also read:**
- `docs/PRD-Clip-Integration/fixtures/sample-response.json` (for realistic mock content)
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md` (for CSS conventions)

### Task 2: Add state variations and interactive toggles — NOT STARTED

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/producer.html`

**What to build:**
- Toggle buttons at top of the mockup: "Show: Idle | Playing Clip | Override Active | Fallback Mode | Stalled"
- Each toggle shows/hides relevant elements and changes status indicators
- In "Playing Clip" state: show current clip info, progress bar, upcoming queue
- In "Override Active" state: highlight override panel, show red override indicator
- In "Fallback Mode" state: show fallback indicator, auto-sequence info
- In "Stalled" state: show stall warning, recovery controls
- Color-coded diff: green=elements added in this state, yellow=changed, red=hidden
- Smooth CSS transitions between states
- Section badges on all new state-dependent elements

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 115–201 (§3C State Machine Definitions)
- Re-read lines 379–671 if needed for state-dependent UI references

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md`

### Task 3: Polish and verify completeness — NOT STARTED

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/producer.html`

**What to build:**
- Re-read the PRD section (lines 379–671) and verify every described element is present
- Add any missing controls, indicators, or panels
- Ensure all section badges are accurate (§ numbers match actual PRD sections)
- Verify state toggles work correctly — each state shows the right elements
- Ensure fixture data is used (not "Lorem ipsum" or "placeholder")
- Final alignment/spacing pass
