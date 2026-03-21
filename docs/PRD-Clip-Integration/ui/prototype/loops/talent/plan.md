# Talent Loop — Implementation Plan

**Loop:** talent
**Output file:** `prototype/sections/talent.html`
**Dependencies:** Shell loop must complete first (need style-guide.md)

---

### Task 1: Build TalentView screen mockup — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/talent.html`

**What to build:**
- HTML fragment (no html/head/body tags — injected into index.html)
- Static visual mockup of the TalentView layout
- Current content info panel (clip athlete/team/apparatus or live camera indicator)
- Upcoming content queue (next 2-3 items)
- Talking points section with auto-generated commentary prompts
- Transition countdown/indicator
- Score display area
- Use CSS variables and classes from the style guide
- Green (#4ecdc4) color accent for TalentView elements
- Section badges (§X.X) on each UI region

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 672–739 (Screen 3: TalentView ONLY)

**Also read:**
- `docs/PRD-Clip-Integration/fixtures/sample-response.json` (for realistic mock content)
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md` (for CSS conventions)

### Task 2: Add state variations, toggles, and polish — NOT STARTED

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/talent.html`

**What to build:**
- Toggle buttons: "Show: Idle | Clip Playing | Live Camera | Moment Replay | Break Content"
- Each toggle updates the mockup in-place:
  - Clip Playing: show clip info, talking points, countdown to next
  - Live Camera: show "LIVE" badge, camera feed indicator, no talking points
  - Moment Replay: show replay badge, moment context
  - Break Content: show break indicator, upcoming return info
- Section badges on all state-dependent elements
- Verify all PRD elements are present
- Ensure fixture data is used throughout

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 115–201 (§3C State Machine Definitions)
- Re-read lines 672–739 if needed

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md`
