# WTW Video Playback + Lower Third — Tasks

## Tasks

### Task 1: Add overlayStyle and meetTheme to WTW sequencer clip step — COMPLETE
**Files:** `server/index.js`
**Why first:** The server writes data to Firebase that both OBS sources read. The new fields must be present before the client-side code can branch on them.

**Changes:**
- In the `whoToWatchStarted` handler (~line 819-840), add two fields to the clip step's `data` object:
  - `overlayStyle: 'who-to-watch'`
  - `meetTheme: meetTheme` (variable is already in scope from line ~759)
- The `meetTheme` variable is read from `competitions/{compId}/config/meetTheme` at handler initialization (line ~758-767) — no new Firebase reads needed.
- The `writeGraphic()` function (line ~870) spreads the entire graphic object, so the new fields flow to Firebase automatically.

**Verify:**
- [ ] Server starts without errors (`node server/index.js` or `pm2 restart`)
- [ ] No syntax errors in the modified block
- [ ] The clip step data object now contains `overlayStyle: 'who-to-watch'` and `meetTheme`
- [ ] Title card steps are unchanged (still have `meetTheme` via `baseData`, no `overlayStyle`)
- [ ] No console errors on coordinator startup

---

### Task 2: Render WTW lower-third iframe on graphics source during clip step — COMPLETE
**Files:** `output.html`
**Why second:** Depends on Task 1's `overlayStyle` field being in the Firebase data.

**Changes:**
- In the live mode clip-type handler (~line 13224-13230), replace the unconditional `output.innerHTML = ''` with a conditional branch:
  - If `data && data.overlayStyle === 'who-to-watch'`: render an iframe to `/overlays/who-to-watch.html` with query params mapped from the data fields (`athleteName`, `logo` ← `teamLogo`, `subtitle`, `statLabel`, `statValue`, `headshot`, `meetTheme`)
  - Else: existing behavior (`output.innerHTML = ''; hideAnimatedBackground();`)
- In the WTW branch, still call `hideAnimatedBackground()` to suppress any gradient behind the iframe
- iframe attributes: `style="width:1920px;height:1080px;border:none;"`, `sandbox="allow-scripts allow-same-origin"`

**Parameter mapping (data field → iframe param):**
| `data.athleteName` | `athleteName` |
| `data.teamLogo` | `logo` |
| `data.subtitle` (fallback `data.teamName`) | `subtitle` |
| `data.statLabel` | `statLabel` |
| `data.statValue` | `statValue` |
| `data.headshot` | `headshot` |
| `data.meetTheme` | `meetTheme` |

**Verify:**
- [ ] Open `output.html?comp={id}` (live mode) in browser
- [ ] When a `clip-playback` graphic with `overlayStyle: 'who-to-watch'` is written to Firebase, the graphics source shows a WTW lower-third bar (not a blank/transparent screen)
- [ ] The lower-third has transparent background (only the bar is visible, rest is transparent)
- [ ] When a regular `clip-playback` graphic (no `overlayStyle`) is written, the graphics source clears as before
- [ ] When `clear` is written, the iframe is destroyed and output is empty
- [ ] No console errors

---

### Task 3: Suppress built-in clip overlay for WTW clips on clip source — COMPLETE
**Files:** `output.html`
**Why third:** Depends on Task 1's `overlayStyle` field. Prevents the playout-style overlay from conflicting with the WTW lower-third.

**Changes:**
- In `handleClipPlayback()` (~line 13453-13500), before the `updateClipOverlay(data)` call, add a conditional:
  - If `data.overlayStyle === 'who-to-watch'`: call `clipOverlay.classList.remove('visible')` instead of `updateClipOverlay(data)`
  - Else: call `updateClipOverlay(data)` as before (standard playout overlay)
- Do NOT suppress clip status listeners (`setupClipStatusListeners`) — the WTW sequencer needs `clip_ended`/`clip_stalled` status write-backs to know when to advance
- Do NOT suppress `startClip()` — the video still needs to play

**Verify:**
- [ ] Open `output.html?comp={id}&mode=clip` (clip mode) in browser
- [ ] When a WTW `clip-playback` is received, the video plays but the built-in athlete panel overlay (`#clipOverlay`) is NOT visible
- [ ] When a regular `clip-playback` is received, the built-in overlay shows as before (athlete name, team logo, apparatus, score badge)
- [ ] Clip status write-back to Firebase still works for WTW clips (clip_ended fires when video finishes)
- [ ] No console errors

---

### Task 4: Hide graphic dropdown for dedicated-editor segment types — COMPLETE
**Files:** `show-controller/src/pages/RundownEditorPage.jsx`
**Why last:** Pure UI cleanup, no dependency on other tasks. Independent of the video playback fix.

**Changes:**
- In the `SegmentDetailPanel` component (~line 8113), wrap the graphic dropdown container `<div>` in a conditional:
  - `{!['playout', 'who-to-watch', 'content-sequence'].includes(formData.type) && ( <div className="border border-zinc-700 ..."> ... </div> )}`
- This hides the entire graphic picker block (smart recommendation + select + param inputs) for types that have dedicated editors
- The graphic registry entries remain unchanged — still used by URL Generator page
- The `formData.graphic` value is NOT cleared — stale values are harmless since sequencers ignore the graphic field for these types

**Verify:**
- [ ] Build succeeds: `cd show-controller && npm run build`
- [ ] Open Rundown Editor, select a segment with type "Who to Watch" — graphic dropdown is NOT visible
- [ ] Select a segment with type "Playout" — graphic dropdown is NOT visible
- [ ] Select a segment with type "Content Sequence" — graphic dropdown is NOT visible
- [ ] Select a segment with type "Live" or "Video" — graphic dropdown IS visible (unchanged)
- [ ] WhoToWatchEditor, PlayoutRulesEditor, ContentSequenceEditor still render below the common fields
- [ ] No console errors

---

## Discovered Bugs
(populated by iterations as they find problems)

## Learnings
- LEARNING: Task 1 confirmed `meetTheme` is a shorthand property in the data object (ES6 shorthand for `meetTheme: meetTheme`). The variable is in scope from line 759. No new Firebase reads needed.
- LEARNING: Title card steps use `...baseData` which already includes `meetTheme` but NOT `overlayStyle`. This is correct — only clip steps need `overlayStyle` to differentiate from regular playout clips.
- LEARNING: The iframe URL is built using `URLSearchParams` with conditional param setting. The mapping is: `teamLogo` → `logo`, `subtitle || teamName` → `subtitle`. All other params pass through directly.
- LEARNING: Task 3 modifies THREE locations in output.html: (1) line ~13478 for clip-playback, (2) line ~13539 for moment-replay, (3) line ~6880 for optimistic advance. All three need the same conditional: `if (data.overlayStyle === 'who-to-watch') { clipOverlay.classList.remove('visible'); } else { updateClipOverlay(data); }`
- LEARNING: Task 4 wraps the graphic picker block (lines 8113-8165) in a conditional. The type-specific editors (PlayoutRulesEditor, ContentSequenceEditor, WhoToWatchEditor) are at lines 8516-8555, well outside the wrapped block, so they render normally.
