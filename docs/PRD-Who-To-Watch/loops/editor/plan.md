# PRD Who to Watch — Editor Plan

> Per-loop task tracking file. Each parallel loop has its own plan.md.
> Task markers MUST use the exact strings below — `run-loop.sh` greps for them.
> The Discovered Bugs and Learnings sections GROW over time — never delete entries.

**PRD:** `docs/PRD-Who-To-Watch/PRD-Who-To-Watch.md`
**Loop:** editor
**Files owned:** `show-controller/src/components/playout/WhoToWatchEditor.jsx`, `output.html` (imageMode default only)

---

## Tasks

- **Task 1: Debounce iframe preview URL updates — COMPLETE**
  PRD issue: #18
  Files: `show-controller/src/components/playout/WhoToWatchEditor.jsx`
  Problem: Every slider `onChange` rebuilds the overlay URL via `useMemo`, changing the iframe `src` and causing the entire overlay page to reload on each tick. The reload is slow enough that the preview appears unresponsive.
  Fix: Add a debounced version of the overlay URL. Use a `useEffect` + `setTimeout` (300ms) pattern: keep the `useMemo` for computing the URL, but only apply it to the iframe `src` after 300ms of inactivity. This way the slider values update instantly in the UI labels but the iframe only reloads once the user stops dragging.
  Back pressure: `cd show-controller && npm run build`
  Expected: Sliders move smoothly, preview updates ~300ms after the user stops adjusting.

- **Task 2: Fix iframe sandbox to allow cross-origin resources — NOT STARTED**
  PRD issue: #18 (second part)
  Files: `show-controller/src/components/playout/WhoToWatchEditor.jsx`
  Problem: The iframe has `sandbox="allow-scripts"` (line ~380) without `allow-same-origin`. This blocks theme-loader.js from fetching Firebase theme data and blocks external CDN image loading.
  Fix: Change `sandbox="allow-scripts"` to `sandbox="allow-scripts allow-same-origin"` on the TitleCardIframePreview iframe element.
  Back pressure: `cd show-controller && npm run build`
  Expected: Preview iframe can load theme colors and external images correctly.

- **Task 3: Remove useEffect sync loop causing double-renders — NOT STARTED**
  PRD issue: #21
  Files: `show-controller/src/components/playout/WhoToWatchEditor.jsx`
  Problem: `useEffect([whoToWatch])` (line ~409-414) resets internal `config` state on every prop change. Since the parent creates a new object reference on every slider tick, this fires unnecessarily, causing a double-render cycle.
  Fix: Guard the useEffect with a JSON comparison so it only resets when the prop values actually differ from current config. Use `JSON.stringify(whoToWatch) !== JSON.stringify(config)` as a guard, or switch to a ref-based comparison. Alternatively, remove the useEffect entirely and treat the component as fully controlled via the `onChange` pattern.
  Back pressure: `cd show-controller && npm run build`
  Expected: No unnecessary re-renders on slider changes. Component still syncs correctly when the parent provides new initial data (e.g., switching between segments).

- **Task 4: Fix imageMode default mismatch — NOT STARTED**
  PRD issue: #22
  Files: `show-controller/src/components/playout/WhoToWatchEditor.jsx`, `output.html`
  Problem: `DEFAULT_WHO_TO_WATCH.imageMode` is `'headshot'` in WhoToWatchEditor.jsx (line ~64), but output.html defaults `imageMode` to `'portrait'` (line ~12692). If imageMode is not explicitly saved, the editor preview renders a headshot circle while the live broadcast output renders a portrait cutout.
  Fix: Change `DEFAULT_WHO_TO_WATCH.imageMode` to `'portrait'` in WhoToWatchEditor.jsx. This aligns with output.html and is the better default for title cards (headshot circles don't fill the 550px image column well). Also update `getDefaultImageMode()` to return `'portrait'` as the no-arg default.
  Back pressure: `cd show-controller && npm run build`
  Expected: Both editor preview and live output render the same image mode when no explicit imageMode is set.

- **Task 5: Add UX hint when slider effects are invisible — NOT STARTED**
  PRD issue: #23
  Files: `show-controller/src/components/playout/WhoToWatchEditor.jsx`
  Problem: When headline and body text are both empty, adjusting `headlineFontSize` and `bodyFontSize` has zero visible effect because there's no text to resize. Producers see sliders but no visual feedback.
  Fix: Add a subtle hint inside the Card Adjustments `<details>` section, below the text sliders, when `!card.headline && !card.body`. Text: "Add headline or body text to see font size adjustments" — styled like the existing amber hints (`text-[10px] text-zinc-500`).
  Back pressure: `cd show-controller && npm run build`
  Expected: When card content is empty, a helpful hint appears near the font size sliders.

---

## Discovered Bugs

<!-- Iterations add entries here as they find problems.
     Format: - BUG: {description} (found during Task N, iteration M)
     These become tasks in the next planning cycle or get logged in the PRD. -->

_No bugs discovered yet._

---

## Learnings

<!-- Iterations add breadcrumbs here for future iterations.
     Format: - LEARNING: {what future iterations need to know}
     These survive across stateless Claude invocations — the only way to pass knowledge forward. -->

- LEARNING: CommandPalette.jsx:138-144 has the canonical debounce pattern for this project: `useEffect` + `setTimeout(300)` + cleanup `clearTimeout`. Follow that pattern.
- LEARNING: TitleCardIframePreview builds `overlayUrl` via `useMemo` — keeping that and adding a debounced version via `useState` + `useEffect` is the right approach.

---

## Fix History

<!-- When a fix is applied from issues/{name}.json or rejected/{name}.json,
     document what was fixed, why, and what changed.
     Format:
     ### Fix: {description} (Pass N)
     - Source: {issues/{name}.json | rejected/{name}.json}
     - Reason: {Claude diagnosis | human rejection reason}
     - What changed: {files modified, approach taken}
-->

_No fixes applied yet._
