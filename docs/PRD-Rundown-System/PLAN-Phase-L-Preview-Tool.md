# Implementation Plan: Phase L — Rundown Preview & Review Tool

**PRD:** [PRD-Rundown-System-2026-01-23.md](./PRD-Rundown-System-2026-01-23.md) (Story 10)
**Date:** 2026-03-23
**Status:** Active

---

## Architecture

### Rendering Strategy

The preview tool renders graphics through the **existing `output.html`** via iframes. This is the same mechanism the URL Generator already uses — `output.html?comp={compId}&graphic={graphicId}&param1=value1`. In preview mode, output.html reads graphic parameters from the URL and renders without Firebase.

For overlay-based graphics (sponsors-cycle, team-roster, warm-up, etc.), output.html already loads the overlay HTML files via nested iframes. The preview tool simply drives the top-level output.html iframe.

### Export Strategy

The "Export Preview" button generates a **self-contained HTML file** that:
1. Embeds all segment data, competition config, team logos (as data URIs or original URLs), and theme CSS inline
2. Contains the segment card UI, search/filter bar, and playback controls
3. Renders graphic segments by loading `output.html` in a scaled iframe — for the exported file, `output.html` is referenced via a base URL (commentarygraphic.com) so the file works when opened locally
4. Non-graphic segments (clips, live camera, breaks, holds) render descriptive cards with metadata

### Key Constraint

No duplicate rendering code. All graphics go through `output.html` → overlay pipeline. The preview page only provides the UI shell (search, filter, cards, playback).

---

## Task Breakdown

### Task 1: Export Preview Button + Self-Contained HTML Shell — COMPLETE

**Goal:** Add "Export Preview" button to Rundown Editor toolbar. Clicking it generates and opens a self-contained HTML page with all segments rendered as cards.

**Files to modify:**
- `show-controller/src/pages/RundownEditorPage.jsx` — Add button + `handleExportPreview()` function

**What `handleExportPreview()` does:**
1. Collects all segment data, competition config (teams, logos), timezone config, talent roster
2. Reads meet theme CSS variables from Firebase (if theme is set)
3. Generates a self-contained HTML string with:
   - Dark-themed UI matching the show-controller aesthetic
   - Header with competition name, segment count, total runtime
   - Segment list as cards in a responsive grid
   - Each graphic segment card contains a scaled `<iframe>` pointing to `output.html?graphic={graphicId}&params...` on commentarygraphic.com
   - Non-graphic segments show descriptive metadata cards (clip info, camera info, break info, etc.)
   - Type-colored badges on each card (matching editor colors)
4. Opens the HTML in a new tab via Blob URL

**Segment card types:**
| Segment Type | Card Content |
|---|---|
| `static`/`graphic` with graphicId | Scaled iframe of `output.html?graphic={id}&params` |
| `live` | Camera icon + scene name + apparatus if set |
| `video`/`clip` | Film icon + clip metadata (athlete, team, apparatus, duration) |
| `break` | Break icon + duration + notes |
| `hold` | Pause icon + "Awaiting producer advance" |
| `playout` | Playout rules summary |
| `content-sequence` | Content sequence summary |

**Deploy + verify.**

---

### Task 2: Search & Filter Bar — COMPLETE

**Goal:** Add text search and type filters to the preview page.

**Additions to the generated HTML:**
- Search input (filters by segment name, graphic type, team, talent, apparatus, athlete, notes/script)
- Segment type filter buttons: All, Graphic, Clip, Live, Break, Hold, Playout, Content Sequence
- Graphic type filter dropdown (logos, event-bar, event-summary, roster, etc.)
- Result count display
- All filtering is client-side JavaScript within the exported HTML

**Deploy + verify.**

---

### Task 3: Full-Size 16:9 Preview Modal — COMPLETE

**Goal:** Click any card to expand to full-size 16:9 preview.

**Additions:**
- Click handler on each card opens a modal/overlay
- Modal shows the graphic at full 1920x1080 in a 16:9 container (scaled to fit viewport)
- Animated background behind graphic (using existing `overlays/animated-background.html`)
- Segment info sidebar: name, type, duration, scene, talent, notes, script
- Left/Right arrow navigation between segments
- Keyboard navigation (arrow keys, Escape to close)
- For non-graphic segments, modal shows enlarged metadata card

**Deploy + verify.**

---

### Task 4: Playback Mode — COMPLETE

**Goal:** Auto-advance through segments sequentially with timing.

**Additions:**
- Play/Pause/Restart buttons in a playback toolbar
- Speed controls: 0.5x, 1x, 2x
- Progress bar showing position in the rundown
- Current segment highlighted in the card grid
- Scrub bar to jump to any point
- Auto-advances based on segment duration (or 5s default for manual/hold segments)
- Click-to-jump on any card during playback

**Deploy + verify.**

---

### Task 5: Theme Integration + Data Embedding — COMPLETE

**Goal:** Bake meet theme CSS and team data into the export.

**Additions:**
- Fetch meet theme from Firebase at export time (`themes/{themeId}`)
- Embed CSS variables in the exported HTML so iframes inherit theme
- Pass `meetTheme` parameter to output.html iframes
- Embed team logos as URLs (they're already public Virtius URLs)
- Include timezone config and wall-clock times on cards
- Talent names resolved from roster and displayed on cards

**Deploy + verify.**

---

### Task 6: Polish & Edge Cases — NOT STARTED

**Goal:** Handle all edge cases and polish the UX.

**Additions:**
- Empty state (no segments)
- Loading state during export generation
- Rotation/apparatus filter dropdowns
- Segment numbering and group headers in export
- Print-friendly CSS media query
- Export filename: `preview-{competition-name}-{date}.html`
- Toast notification on export success

**Deploy + verify.**

---

## Success Criteria Mapping

| Criterion | Task |
|---|---|
| "Export Preview" button in toolbar | Task 1 |
| Self-contained HTML (offline, no Firebase) | Task 1 |
| Segment cards with live-rendered thumbnails | Task 1 |
| Text search | Task 2 |
| Type filters | Task 2 |
| Full-size 16:9 preview with animated bg | Task 3 |
| Graphics render via output.html/overlay code | Task 1 |
| All segment types supported | Task 1 |
| Clip metadata display | Task 1 |
| Playback mode with auto-advance | Task 4 |
| Click-to-jump | Task 4 |
| Speed controls | Task 4 |
| Meet theme applied | Task 5 |
| Team logos/headshots embedded | Task 5 |
| Shareable file | Task 1 |
