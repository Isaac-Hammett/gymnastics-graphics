# Execution Knowledge

What the code loop needs to know that isn't in the specs or plan.

## output.html Architecture

- output.html is a single monolithic file (~14k lines) with all JS inline. No ES modules, no imports. Everything is in one giant script block.
- There are TWO independent code paths that respond to `currentGraphic` changes — one for live mode (graphics source) and one for clip mode (clip source). Both are in the same file, gated by `isClipMode` (line ~13207).
- The `output` variable (line ~6506) is the main render target: `document.getElementById('output')`. Setting `output.innerHTML` replaces whatever graphic is currently showing.
- `hideAnimatedBackground()` (line ~7145) removes the `.visible` class from `#clipBackground`. Always call it in the WTW branch too, or the gradient may bleed through behind the iframe.

## Live Mode Clip Handler (Task 2)

- The exact code block to modify is at lines ~13224-13230. It's inside the Firebase `currentGraphic` listener's else branch for non-clip-mode.
- The `data` variable comes from `snapshot.val().data` — it may be `null` or `undefined` if the graphic has no data. Always guard: `data && data.overlayStyle === 'who-to-watch'`.
- The `graphic` variable is `snapshot.val().graphic` (string).
- When `clear` is written, the code hits the `graphic === 'clear'` branch (line ~13232) which sets `output.innerHTML = ''`. This automatically destroys the iframe — no special cleanup needed.

## Clip Mode Handler (Task 3)

- `handleClipPlayback()` starts at line ~13401. The `updateClipOverlay(data)` call is at approximately line ~13461.
- The overlay suppression check should go RIGHT BEFORE the `updateClipOverlay(data)` call, not inside `updateClipOverlay()` itself. This is because `updateClipOverlay()` is also called during clip swaps (optimistic advance), and we want consistent suppression there too.
- Do NOT skip `setupClipStatusListeners()` or `startClip()` — the video must still play and report completion status for the WTW sequencer to advance.
- The `startLoadTimeout()` and `startClip()` calls must still execute for WTW clips. Only the visual overlay is suppressed.

## Server Sequencer (Task 1)

- The `meetTheme` variable is already in scope at the handler level (line ~759). It's read from Firebase once at handler start and captured in the `baseData` closure. For the clip step, reference it directly as `meetTheme`.
- The clip step is only added if `whoToWatch.clipUrl` is truthy (line ~819). No change to this guard.
- `writeGraphic()` (line ~870) does `firebase.ref(...).set({...graphicObj, timestamp: Date.now()})`. The spread means any new fields in `step.graphic.data` flow through automatically.

## RundownEditorPage (Task 4)

- The graphic dropdown is at lines ~8113-8163 in `RundownEditorPage.jsx`. The entire block is one `<div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">`.
- Wrap the entire `<div>` in the conditional, not just the `<select>`. This hides the smart recommendation banner and param inputs too.
- The file is very large (~8600 lines). Build with `cd show-controller && npm run build`.
- The type-specific editors (PlayoutRulesEditor, ContentSequenceEditor, WhoToWatchEditor) are rendered BELOW the graphic dropdown at lines ~8514-8553. They are NOT inside the graphic dropdown block — hiding the dropdown does not affect them.

## Parameter Name Mapping Gotcha

- The WTW sequencer writes `teamLogo` (from `whoToWatch.logoUrl`) but `who-to-watch.html` expects `logo` (or `logoUrl`). When building the iframe URL params in Task 2, map `data.teamLogo` → `logo`.
- The overlay also accepts `teamName` as an alias for `subtitle`. Pass `data.subtitle || data.teamName` as the `subtitle` param.

## Theme Loader Timing

- `who-to-watch.html` loads `theme-loader.js` which reads `meetTheme` from its own URL params (the iframe's URL, not the parent page). So `meetTheme` MUST be passed as a query param to the iframe src.
- Theme-loader fires on DOMContentLoaded and fetches from Firebase. There may be a brief flash (~100-300ms) before theme colors apply. This is existing behavior for all overlay iframes and is acceptable.

## Deploy Notes

- After Task 1: restart coordinator with `GOOGLE_APPLICATION_CREDENTIALS` env var
- After Tasks 2-3: deploy `output.html` to `/var/www/commentarygraphic/output.html` on 3.87.107.201
- After Task 4: build React SPA and deploy to `/var/www/commentarygraphic/`
- Remember to also deploy `overlays/` directory (who-to-watch.html is already deployed, but ensure it's current)
