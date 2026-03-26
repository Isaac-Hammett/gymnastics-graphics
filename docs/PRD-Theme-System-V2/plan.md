# Theme System V2 — Implementation Plan (Phase 0 + Phase 1)

**Total tasks:** 17
**Phase 0 tasks:** 3 (audit — no code changes)
**Phase 1 tasks:** 14 (code changes + verification)

---

## Phase 0: Audit & Graphic ID Registry

### Task 0.1 — Build Graphic ID Registry — COMPLETE

**Goal:** Enumerate all graphic IDs and categorize as iframe or inline.

**Files:** `overlays/graphic-ids.json` (new)

**Work:**
1. List all `overlays/*.html` filenames → strip extension → graphic IDs for overlays
2. Read `output.html` renderers object (lines 12330–13129) → extract all keys → graphic IDs for inline
3. Cross-reference: which renderers return an `<iframe>` pointing to an overlay file vs rendering inline HTML
4. Output JSON:
```json
{
  "graphics": [
    { "id": "event-bar", "renderMode": "inline", "source": "output.html" },
    { "id": "sponsors-thanks", "renderMode": "iframe", "source": "overlays/sponsors-thanks.html" }
  ]
}
```

**Known iframe renderers (8):** sponsors-thanks, sponsors-cycle, sponsors-bug, who-to-watch-title, who-to-watch-lower-third, event-calendar, rotation-slate, rotation-slate-auto

**Known overlay files not used as iframe targets (22):** animated-background, athlete-spotlight, clip-player, coaches, event-bar, event-frame, frame-dual, frame-quad, frame-single, frame-team-header, frame-tri-center, frame-tri-wide, frame-tri-wide-top, hosts, interview-card, logos, replay, stream, team-bug, team-roster, team-stats, warm-up, who-to-watch

**Verify:**
- [ ] JSON file parses without error
- [ ] Total graphic count matches: 40 renderers in output.html + overlay-only files
- [ ] Every overlay HTML file has a corresponding entry
- [ ] Every renderer key in output.html has a corresponding entry
- [ ] iframe vs inline classification matches actual renderer code

---

### Task 0.2 — Audit [data-meet-theme] CSS Rules

**Goal:** Full enumeration of theme CSS rules across both files. This is the source-of-truth for Phase 1.3 porting.

**Files:** `docs/PRD-Theme-System-V2/audit-css-rules.md` (new)

**Work:**
1. Extract all `[data-meet-theme]` selectors from output.html (lines 1070–1331, ~91 selectors)
2. Extract all `[data-meet-theme]` selectors from theme-overrides.css (342 lines, ~56 selectors)
3. Categorize each rule as:
   - **Both** — exists in both files (check for value differences)
   - **output.html only** — must be ported to theme-overrides.css in Task 1.3
   - **overlay only** — no action needed (stays in theme-overrides.css)
4. For "both" rules, flag any value differences (e.g., `.event-bar-logo` uses `rgba(255,255,255,0.92)` in output.html but `var(--meet-header-bg)` in theme-overrides.css)

**Verify:**
- [ ] Every `[data-meet-theme]` selector in output.html is categorized
- [ ] Every `[data-meet-theme]` selector in theme-overrides.css is categorized
- [ ] "output.html only" count is ~68 (per css-scope.md spec)
- [ ] Value mismatches between "both" rules are documented

---

### Task 0.3 — Audit Pseudo-Element Usage

**Goal:** Identify conflicts with texture overlay `::before` pseudo-elements.

**Files:** `docs/PRD-Theme-System-V2/audit-pseudo-elements.md` (new)

**Work:**
1. Grep all `::before` and `::after` usage in overlay HTML files and output.html
2. Cross-reference with elements that Phase 3 will target for texture overlays
3. Document any existing pseudo-elements that would conflict with texture injection

**Verify:**
- [ ] All pseudo-element usage documented
- [ ] Conflicts (if any) have proposed resolution

---

## Phase 1: Theme Unification + Debug Panel

### Task 1.1 — Extend theme-loader.js for Competition Config Lookup

**Goal:** theme-loader.js gains a second initialization path: `?comp=` reads meetTheme from Firebase competition config.

**Files:** `overlays/theme-loader.js`

**Work:**
1. After the existing `meetThemeId` URL param check (line 24), add a second path:
   - If `meetThemeId` exists → use it (existing behavior, takes precedence)
   - If no `meetThemeId` but `comp` param exists → read `competitions/{compId}/config/meetTheme` from Firebase → use that theme ID
2. Convert the `init()` function to expose `window.themeReady` promise:
   - `window.themeReady = new Promise(resolve => { ... })` wrapping the init logic
   - Resolve with `{ success: true, themeId }` on success
   - On 3-second timeout: resolve with `{ success: false, reason: 'timeout' }` + apply fallback + write error to Firebase
   - On fetch failure: resolve with `{ success: false, reason }` + apply fallback + write error to Firebase
3. Remove the early-return when no `meetTheme` param (line 27-29) — now the script continues if `comp` is present
4. Keep the IIFE structure — expose only `window.themeReady`

**Error reporting on failure (per fouc-prevention.md spec):**
- Write to `competitions/{compId}/production/themeErrors/{timestamp}` with: type, themeId, compId, source, message, url, timestamp, resolved
- Source = `"output.html"` or `"overlay:{filename}"` (detect from pathname)
- Never show error text on the graphics output page itself (that goes to air)

**Verify:**
- [ ] `?meetTheme=pink-meet` → loads theme (existing behavior preserved)
- [ ] `?comp=abc123` (no meetTheme) → reads config → loads theme
- [ ] `?meetTheme=X&comp=Y` → uses X (meetTheme takes precedence)
- [ ] No `meetTheme` and no `comp` → resolves immediately with no-op
- [ ] `window.themeReady` is a Promise that resolves in all cases
- [ ] 3-second timeout resolves with fallback colors (not hang forever)
- [ ] Timeout writes error to Firebase `production/themeErrors/`
- [ ] Existing overlay files (28) still work with `?meetTheme=` param

---

### Task 1.2 — Add theme-loader.js to output.html

**Goal:** output.html loads theme-loader.js so it shares the same code path as overlays.

**Files:** `output.html`

**Work:**
1. Add `<script src="/overlays/theme-loader.js"></script>` AFTER the Firebase SDK script tags
2. This must be BEFORE the inline `<script>` that defines `themeReadyPromise` (currently line 7381)
3. Update the `themeReadyPromise` variable to reference `window.themeReady` from theme-loader.js:
   ```javascript
   let themeReadyPromise = window.themeReady || Promise.resolve();
   ```
4. Keep `applyMeetTheme()` and `loadMeetTheme()` functions in place for now (removed in Task 1.9)

**Verify:**
- [ ] output.html loads without console errors
- [ ] `?meetTheme=pink-meet&graphic=event-bar` renders with theme (preview mode)
- [ ] `?comp=abc123` renders with theme from competition config (live mode)
- [ ] `window.themeReady` is available in output.html context
- [ ] No duplicate theme loading (theme-loader.js handles it, inline functions still exist but aren't called)

**Depends on:** Task 1.1

---

### Task 1.3a — Port Event Summary CSS Rules to theme-overrides.css

**Goal:** Port event summary theme rules (~22) from output.html to theme-overrides.css.

**Files:** `overlays/theme-overrides.css`

**Work:**
Port these selectors from output.html (lines 1084–1134):
- `.event-summary-header`, `.event-summary-title`, `.event-summary-footer`, `.event-summary-content`, `.center-divider`
- `.event-summary-dual`, `.event-summary-quad`, `.event-summary-quad-v3`
- `.team-header`, `.team-footer`, `.athlete-row`
- `.rotation-badge` (check if already exists — yes, at line 118-121 in theme-overrides.css)

Add a new `/* === EVENT SUMMARY === */` section in theme-overrides.css.

**Verify:**
- [ ] All event summary `[data-meet-theme]` rules from output.html have equivalents in theme-overrides.css
- [ ] Existing rotation-badge rule not duplicated
- [ ] CSS variables used match the same `--meet-*` variables

---

### Task 1.3b — Port Leaderboard CSS Rules to theme-overrides.css

**Goal:** Port leaderboard theme rules (~25) from output.html to theme-overrides.css.

**Files:** `overlays/theme-overrides.css`

**Work:**
Port these selectors from output.html (lines 1137–1193):
- `.leaderboard-header`, `.leaderboard-title`, `.leaderboard-footer`
- `.leaderboard-table`, `thead`, `th`, `tbody`, `tr`, `td`
- `.col-rank`, `.col-diff`, `.col-exec`, `.col-team`
- `.leaderboard-team-logo`, `.apparatus-badge`

Add a new `/* === LEADERBOARD === */` section in theme-overrides.css.

**Verify:**
- [ ] All leaderboard `[data-meet-theme]` rules from output.html have equivalents in theme-overrides.css
- [ ] Deeply nested selectors preserved faithfully (e.g., `.leaderboard-table thead th`)

---

### Task 1.3c — Port Warm-up, Replay, Event Bar, Texture, Frame CSS Rules

**Goal:** Port remaining inline-only rules (~21 total).

**Files:** `overlays/theme-overrides.css`

**Work:**
Port from output.html:
- **Event Bar details** (lines 1221–1227, ~3 rules): `.event-bar-details`, `.event-bar-name`, `.event-bar-location`
- **Warm-up detailed** (lines 1230–1247, ~6 rules): `.warm-up-teams-row`, `.warm-up-teams-text`, `.warm-up-status-row`, `.warm-up-status-text`
- **Replay detailed** (lines 1264–1281, ~6 rules): `.replay-title-row`, `.replay-title-text`, `.replay-status-row`, `.replay-status-text`
- **Texture targets** (lines 1301–1302, 1318–1319, ~4 rules): `.warm-up-container::before`, `.replay-container::before`
- **Event frame** (lines 1076–1081, ~2 rules): `.graphic-event-frame`

Extend existing sections where applicable (warm-up/replay section exists at lines 167-184).

**Verify:**
- [ ] All remaining "output.html only" rules from the Task 0.2 audit are now in theme-overrides.css
- [ ] No orphaned rules remain in the "output.html only" category

**Depends on:** Task 0.2 (audit provides the definitive list)

---

### Task 1.4 — Reconcile Class Name Differences

**Goal:** Add overlay class names to output.html inline-rendered HTML as ADDITIONAL classes.

**Files:** `output.html`

**Work:**
For each of these 10 class name differences, find the HTML element in the relevant renderer function and add the overlay class alongside the existing class:

| output.html class | Add overlay class | Renderer to modify |
|---|---|---|
| `.event-bar-logo` | `.logo-section` | event-bar renderer |
| `.warm-up-logo-section` | `.logo-section` | warm-up renderer |
| `.replay-logo-section` | `.logo-section` | replay renderer |
| `.warm-up-status-text` | `.status-text` | warm-up renderer |
| `.replay-status-text` | `.status-text` | replay renderer |
| `.event-bar-name` | `.teams-text` | event-bar renderer |
| `.event-bar-location` | `.location-text` | event-bar renderer |
| `.warm-up-status-row` | `.status-row` | warm-up renderer |
| `.replay-status-row` | `.status-row` | replay renderer |
| `.coaches-title` | `.hosts-title` | coaches renderer |

Do NOT remove existing class names — add the overlay names alongside.

**Verify:**
- [ ] Each of the 10 elements now has both class names
- [ ] Grep confirms no old class names were removed
- [ ] Event-bar, warm-up, replay, coaches renderers still produce valid HTML
- [ ] Playwright screenshot: event-bar with theme shows correct styling via overlay class

**Depends on:** Tasks 1.3a/b/c (ported CSS rules target the overlay class names)

---

### Task 1.5 — Convert Inline Theme CSS to Use CSS Variables

**Goal:** Refactor the "MEET THEME OVERRIDES" inline `<style>` section to read from `--meet-*` CSS variables instead of hardcoded values. This makes both code paths produce identical results during the migration period.

**Files:** `output.html`

**Work:**
1. In the inline `<style>` section (lines 1070–1331), replace all hardcoded color values with `var(--meet-*)` references
2. Example: `background: #BFBFBF` → `background: var(--meet-header-bg, #BFBFBF)`
3. Keep the `[data-meet-theme]` selector — it still gates the rules on theme being active
4. The inline rules now read the SAME variables that theme-loader.js sets, so both paths agree

**Why this ordering matters:** During the migration (Tasks 1.2–1.8), both the inline `<style>` and external `theme-overrides.css` are active. Inline styles have higher specificity. By converting inline rules to use the same CSS variables, specificity doesn't matter — both rules produce the same visual result because they read the same variable values.

**Verify:**
- [ ] All hardcoded color values in the MEET THEME OVERRIDES section replaced with `var(--meet-*, fallback)`
- [ ] Playwright screenshot: themed graphic looks identical before and after this change
- [ ] No visual regression — fallback values match the original hardcoded values exactly

**Depends on:** Task 1.2 (theme-loader.js sets the CSS variables in output.html)

---

### Task 1.6 — Gate Live-Mode Rendering on Theme Readiness

**Goal:** Prevent FOUC by waiting for theme to load before first render in live mode.

**Files:** `output.html`

**Work:**
1. Find the `currentGraphic` Firebase listener (line 13160)
2. Wrap the render call in `themeReadyPromise.then(() => { ... })`
3. Same pattern as preview mode (line 13139)
4. Only the first render waits; subsequent renders are instant (promise already resolved)

```javascript
db.ref(`competitions/${competitionId}/currentGraphic`).on('value', (snapshot) => {
  // ... parse state ...
  themeReadyPromise.then(() => {
    output.innerHTML = renderers[graphic](data);
  });
});
```

**Verify:**
- [ ] First graphic render waits for theme (no FOUC)
- [ ] Subsequent graphic renders are instant (no visible delay)
- [ ] If theme times out (3s), graphics still render with fallback colors
- [ ] Rapid graphic changes don't cause stale renders (last one wins)

**Depends on:** Task 1.2 (themeReadyPromise must reference window.themeReady)

---

### Task 1.7 — Build Debug Panel

**Goal:** Visual diagnostic overlay showing theme state, activated via `?debug=theme`.

**Files:** `overlays/theme-loader.js`, `overlays/theme-overrides.css`

**Work:**
1. In theme-loader.js, detect `?debug=theme` URL param
2. After theme application, inject a debug overlay div with:
   - Current theme ID (or "none")
   - Theme load status: success / timed out / failed (with timestamp)
   - Source: `?meetTheme=` param vs `?comp=` config lookup
   - Each of the 8 CSS variables: name, expected value (from Firebase), actual computed value, pass/fail indicator
   - Logo data attributes: present/absent, URL value
   - Rendering path: iframe vs inline (detect from URL)
   - Graphic ID (from filename or `?graphic=` param)
3. Style the debug panel:
   - Fixed position, bottom-right corner
   - Semi-transparent dark background
   - Collapsible (click to expand/collapse)
   - Small badge showing pass/fail count when collapsed
   - Does NOT appear in normal rendering (only with `?debug=theme`)

**Verify:**
- [ ] `?debug=theme` shows the panel
- [ ] Without `?debug=theme`, no panel appears
- [ ] All 8 CSS variable values displayed correctly
- [ ] Pass/fail indicators work (green = match, red = mismatch or missing)
- [ ] Theme load status shows correctly for: success, timeout, no theme
- [ ] Panel doesn't interfere with graphic layout (fixed position, high z-index)

**Depends on:** Task 1.1 (theme-loader.js must track theme load state for display)

---

### Task 1.7b — Producer Theme Error Log Panel

**Goal:** Show controller displays a persistent error badge + scrollable error log for theme failures (per fouc-prevention.md spec).

**Files:**
- `show-controller/src/components/ThemeErrorLog.jsx` (new)
- `show-controller/src/hooks/useThemeErrors.js` (new)
- `show-controller/src/views/ProducerView.jsx` (add badge to header)

**Work:**
1. **useThemeErrors hook** (follow useAlerts.js pattern at `show-controller/src/hooks/useAlerts.js`):
   - Subscribe to `competitions/{compId}/production/themeErrors` in Firebase
   - Return: `{ errors, errorCount, clearErrors }`
   - Sort by timestamp descending (newest first)

2. **ThemeErrorLog component** (follow AlertPanel.jsx pattern at `show-controller/src/components/AlertPanel.jsx`):
   - Red warning badge with count (e.g., "Theme: 2 errors") — visible in producer header
   - Click opens scrollable panel with:
     - Each error: timestamp, source, type, full message
     - **Copy button** per error (copies structured text per fouc-prevention.md format)
     - **Copy All** button
     - **Dismiss All** button (deletes errors from Firebase)
   - Badge stays visible as long as errors exist

3. **ProducerView integration:**
   - Add ThemeErrorLog badge to the header bar (near existing status badges like StatsStatusBadge)
   - Only render if errors exist (no visual noise when things work)

**Verify:**
- [ ] Trigger a theme error (load output.html with bad theme ID + valid compId)
- [ ] Producer view shows red "Theme: 1 error" badge
- [ ] Click badge → error log panel opens with error details
- [ ] Copy button copies formatted error text to clipboard
- [ ] Dismiss All clears errors from Firebase and hides badge
- [ ] Build passes: `cd show-controller && npm run build`

**Depends on:** Task 1.1 (Firebase error writes must exist)

---

### Task 1.8a — Verify All Inline Graphics with Theme

**Goal:** Playwright screenshot verification of all inline-rendered graphics with a test theme.

**Files:** None modified (verification only)

**Work:**
1. Create or use an existing test theme in Firebase
2. For each inline renderer in output.html (~32), take a Playwright screenshot with `?graphic={id}&meetTheme={testTheme}`
3. Verify: theme colors applied correctly, no FOUC, no visual regressions
4. Check console for errors

**Verify:**
- [ ] All inline graphics render with correct theme colors
- [ ] No console errors
- [ ] Logo contrast (white background) works on all logo containers
- [ ] Event summary, leaderboard, warm-up, replay, event-bar, coaches all themed

**Depends on:** Tasks 1.1–1.6

---

### Task 1.8b — Verify Iframe Graphics with Theme

**Goal:** Playwright screenshot verification of all iframe-rendered graphics.

**Files:** None modified (verification only)

**Work:**
1. For each iframe renderer (8), take a Playwright screenshot with `?graphic={id}&meetTheme={testTheme}`
2. Verify: theme colors applied, iframe content themed correctly
3. These should work unchanged (overlays already use theme-loader.js)

**Verify:**
- [ ] All 8 iframe graphics render with correct theme colors
- [ ] Sponsors, rotation-slate, who-to-watch, event-calendar all themed
- [ ] No console errors in parent or iframe

**Depends on:** Tasks 1.1–1.6

---

### Task 1.8c — Rundown Integration Test

**Goal:** Verify the full pipeline: timesheetEngine → currentGraphic → themed render.

**Files:** None modified (verification only)

**Work:**
1. Use a test competition with a theme assigned
2. Load `output.html?comp={testCompId}` in Playwright
3. Write a test graphic to `competitions/{testCompId}/currentGraphic` via Firebase
4. Verify: graphic renders with theme (no FOUC), correct colors

**Verify:**
- [ ] Live-mode render gates on theme readiness (no FOUC)
- [ ] Theme loaded from competition config (not URL param)
- [ ] Graphic renders with correct theme colors
- [ ] Debug panel (`?debug=theme`) shows successful theme load from competition config

**Depends on:** Tasks 1.1–1.7

---

### Task 1.9 — Remove Inline Theme CSS (Post Live-Event Gate)

**Goal:** Remove the duplicate inline theme code from output.html. Only do this AFTER at least one successful live event.

**Files:** `output.html`

**Work:**
1. Remove the entire "MEET THEME OVERRIDES" inline `<style>` section (lines 1070–1331)
2. Remove `applyMeetTheme()` function (line 7293)
3. Remove `loadMeetTheme()` function (line 7364)
4. Simplify `themeReadyPromise` to just `window.themeReady || Promise.resolve()`
5. Update CLAUDE.md: replace "Dual CSS Locations" section with "Unified Theme System"
6. Update CLAUDE.md: add debug panel instructions (`?debug=theme`)

**Verify:**
- [ ] Re-run all Task 1.8a/b/c verifications
- [ ] All graphics still render with correct theme colors
- [ ] No references to `applyMeetTheme` or `loadMeetTheme` remain in output.html
- [ ] CLAUDE.md updated

**Depends on:** Tasks 1.8a/b/c + one successful live event

---

## Dependency Graph

```
Phase 0 (no dependencies between tasks):
  0.1  0.2  0.3

Phase 1:
  1.1 (extend theme-loader.js)
   ├── 1.2 (add to output.html)
   │    ├── 1.5 (convert inline CSS to vars)
   │    └── 1.6 (gate live-mode render)
   ├── 1.3a (port event summary CSS)
   ├── 1.3b (port leaderboard CSS)
   └── 1.3c (port remaining CSS)
        └── 1.4 (reconcile class names)   ← depends on 1.3* (ported rules target overlay classes)

  1.7 (debug panel)                        ← depends on 1.1
  1.7b (producer error log panel)          ← depends on 1.1

  1.8a/b/c (verification)                  ← depends on 1.1–1.7b

  1.9 (remove inline CSS)                  ← depends on 1.8 + live event
```

**Parallelizable:** Tasks 1.3a, 1.3b, 1.3c can run in parallel. Task 1.7 can run in parallel with 1.3–1.6.

---

## Files Touched Summary

| File | Tasks |
|------|-------|
| `overlays/graphic-ids.json` (new) | 0.1 |
| `docs/PRD-Theme-System-V2/audit-css-rules.md` (new) | 0.2 |
| `docs/PRD-Theme-System-V2/audit-pseudo-elements.md` (new) | 0.3 |
| `overlays/theme-loader.js` | 1.1, 1.7 |
| `overlays/theme-overrides.css` | 1.3a, 1.3b, 1.3c, 1.7 |
| `output.html` | 1.2, 1.4, 1.5, 1.6, 1.9 |
| `show-controller/src/components/ThemeErrorLog.jsx` (new) | 1.7b |
| `show-controller/src/hooks/useThemeErrors.js` (new) | 1.7b |
| `show-controller/src/views/ProducerView.jsx` | 1.7b |
| `CLAUDE.md` | 1.9 |
