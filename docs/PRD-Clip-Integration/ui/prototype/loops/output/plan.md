# Output Loop — Implementation Plan

**Loop:** output
**Output file:** `prototype/sections/output.html`
**Dependencies:** Shell loop must complete first (need style-guide.md)

---

### Task 1: Build output.html screen mockup with dual video architecture — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/output.html`

**What to build:**
- HTML fragment (no html/head/body tags — injected into index.html)
- Static visual mockup of the output.html viewer overlay
- Viewer overlay showing clip playback state
- Score reveal overlay mockup
- Dual video element architecture diagram (showing A/B preload pattern with labeled elements)
- LIVE badge for live camera mode
- Animated background for break content
- Moment replay badge
- Stall detection indicator
- Audio crossfade visualization (showing volume levels of video A vs B)
- Use CSS variables and classes from the style guide
- Orange (#ff8c42) color accent for output.html elements
- Section badges (§X.X) on each UI region

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 740–960 (Screen 4: output.html ONLY)

**Also read:**
- `docs/PRD-Clip-Integration/fixtures/sample-response.json` (for realistic mock content)
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md` (for CSS conventions)

### Task 2: Add state variations and interactive toggles — COMPLETE

**File:** `docs/PRD-Clip-Integration/ui/prototype/sections/output.html`

**What to build:**
- Toggle buttons: "Show: Idle | Playing Clip | Crossfading A→B | Live Camera | Moment Replay | Break Content | Stalled"
- Playing Clip: show video A active, progress bar, score overlay
- Crossfading A→B: show both videos with opacity transition visualization, audio crossfade levels
- Live Camera: show LIVE badge, no progress bar, camera feed indicator
- Moment Replay: show replay badge, moment info overlay
- Break Content: show animated background, upcoming content info
- Stalled: show stall warning overlay, recovery state
- Section badges on all state-dependent elements
- Verify all PRD elements from lines 740–960 are represented

**PRD sections to read:**
- `docs/PRD-Clip-Integration/ui/versions/PRD-Clip-Integration-UI-v2.md` — lines 115–201 (§3C State Machine Definitions)
- Re-read lines 740–960 if needed

**Also read:**
- `docs/PRD-Clip-Integration/ui/prototype/sections/style-guide.md`
