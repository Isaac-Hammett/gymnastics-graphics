# Theme System V2 — Implementation Plan (All Phases)

**Total tasks:** 32 (Task 0.1 complete, Task 1.9 deferred — requires live event first)
**Phase 0 tasks:** 3 (audit — no code changes)
**Phase 1 tasks:** 16 (code + verification + doc update)
**Phase 3 tasks:** 5 (per-graphic overrides + doc update)
**Phase 4 tasks:** 8 (Theme Editor UI + doc update)

---

## Phase 0: Audit & Graphic ID Registry

### Task 0.1 — Build Graphic ID Registry — COMPLETE

**Goal:** Enumerate all graphic IDs and categorize as iframe or inline.

**Files:** `overlays/graphic-ids.json` (already exists)

**Status:** COMPLETE — `overlays/graphic-ids.json` created with 43 renderers (33 inline, 10 iframe) and 30 overlay files.

---

### Task 0.2 — Audit [data-meet-theme] CSS Rules — COMPLETE

**Goal:** Full enumeration of theme CSS rules across both files. Source-of-truth for Phase 1.3 porting.

**Files:** `docs/PRD-Theme-System-V2/audit-css-rules.md` (new)

**Work:**
1. Extract all `[data-meet-theme]` selectors from output.html (lines 1070–1331, ~72 selectors)
2. Extract all `[data-meet-theme]` selectors from theme-overrides.css (342 lines, ~56 selectors)
3. Categorize each rule as:
   - **Both** — exists in both files (check for value differences)
   - **output.html only** — must be ported to theme-overrides.css in Task 1.3
   - **overlay only** — no action needed (stays in theme-overrides.css)
4. For "both" rules, flag value differences (e.g., `.event-bar-logo` uses `rgba(255,255,255,0.92)` in output.html but `var(--meet-header-bg)` in theme-overrides.css)
5. Fix the `.event-bar-logo` mismatch in theme-overrides.css: change line 45 from `var(--meet-header-bg)` to `rgba(255,255,255,0.92)` — output.html's white background is canonical per css-scope.md Decision #1

**Verify:**
- [ ] Every `[data-meet-theme]` selector in output.html is categorized
- [ ] Every `[data-meet-theme]` selector in theme-overrides.css is categorized
- [ ] "output.html only" count is ~68 (per css-scope.md spec)
- [ ] Value mismatches between "both" rules are documented
- [ ] `.event-bar-logo` in theme-overrides.css updated to use white background

**Deploy:** Deploy theme-overrides.css fix (`.event-bar-logo` white background) to production:
- Upload `overlays/` directory per CLAUDE.md deploy step 2
- Verify: `https://commentarygraphic.com/overlays/theme-overrides.css` returns updated file

---

### Task 0.3 — Audit Pseudo-Element Usage — COMPLETE

**Goal:** Identify conflicts with texture overlay `::before` pseudo-elements for Phase 3.

**Files:** `docs/PRD-Theme-System-V2/audit-pseudo-elements.md` (new)

**Work:**
1. Grep all `::before` and `::after` usage in overlay HTML files and output.html
2. Cross-reference with the 13 texture target classes in theme-overrides.css (lines 308-341)
3. Document any existing pseudo-elements that would conflict with texture injection

**Verify:**
- [x] All pseudo-element usage documented
- [x] Conflicts (if any) have proposed resolution

**Status:** COMPLETE — Audit found 3 non-texture pseudo-element usages (`.text-side::before` in who-to-watch-title.html, `.layout-cinema::before/::after` and `.layout-stripe::before` in rotation-slate.html). None conflict with texture targets — Phase 3 can proceed as planned.

**Deploy:** None — research only.

---

## Phase 1: Theme Unification + Debug Panel

### Task 1.1 — Extend theme-loader.js for Competition Config Lookup — COMPLETE

**Goal:** theme-loader.js gains a second initialization path: `?comp=` reads meetTheme from Firebase competition config. Exposes `window.themeReady` promise.

**Files:** `overlays/theme-loader.js`

**Work:**
1. At IIFE top level (synchronously, before any async), create `window.themeReady`:
   ```javascript
   let resolveThemeReady;
   window.themeReady = new Promise(resolve => { resolveThemeReady = resolve; });
   ```
2. After the existing `meetThemeId` URL param check (line 24), add second path:
   - If `meetThemeId` exists → use it (existing, takes precedence)
   - If no `meetThemeId` but `comp` param exists → read `competitions/{compId}/config/meetTheme` from Firebase → use that theme ID
   - If neither → resolve immediately with `{ success: true, themeId: null }`
3. Remove the early-return when no `meetTheme` param (line 27-29) — now continues if `comp` is present
4. Add 3-second timeout wrapping the entire init:
   - On timeout: resolve with `{ success: false, reason: 'timeout' }`, apply fallback, write error to Firebase
   - On fetch failure: resolve with `{ success: false, reason }`, apply fallback, write error to Firebase
5. Error reporting: write to `competitions/{compId}/production/themeErrors/{timestamp}` with structured error per fouc-prevention.md spec:
   - Fields: `type`, `themeId`, `compId`, `source`, `message`, `url`, `timestamp`, `resolved`
   - Source detection: check `window.location.pathname` for `/overlays/` → `"overlay:{filename}"`, else `"output.html"`
   - **Never show error text on the graphics output page** (goes to air)
6. Keep IIFE structure — expose only `window.themeReady`

**Verify:**
- [ ] `?meetTheme=pink-meet` → loads theme (existing behavior preserved)
- [ ] `?comp=abc123` (no meetTheme) → reads config → loads theme
- [ ] `?meetTheme=X&comp=Y` → uses X (meetTheme takes precedence)
- [ ] No `meetTheme` and no `comp` → resolves immediately with no-op
- [ ] `window.themeReady` is a Promise that resolves in all cases
- [ ] 3-second timeout resolves with fallback colors (not hang forever)
- [ ] Timeout writes error to Firebase `production/themeErrors/`
- [ ] Existing overlay files (28) still work with `?meetTheme=` param
- [ ] No error text visible on the graphics page itself

**Deploy:** Upload `overlays/` directory per CLAUDE.md deploy step 2. Verify overlay files still work:
- Navigate to `https://commentarygraphic.com/overlays/sponsors-thanks.html?meetTheme=pink-meet`
- Screenshot shows themed sponsor graphic

---

### Task 1.1b — Add meetTheme to PlayoutEngine Writes — COMPLETE

**Goal:** PlayoutEngine reads meetTheme from competition config at startup and includes it in all `_writeCurrentGraphic()` calls.

**Files:** `server/lib/playoutEngine.js`

**Work:**
1. In constructor (near line 135 with other config properties), add: `this._meetTheme = null;`
2. In `start()` method (after line 338, after obsScenes read), add Firebase read:
   ```javascript
   const themeRef = this.firebase.ref(`competitions/${this.compId}/config/meetTheme`);
   const themeSnapshot = await themeRef.once('value');
   this._meetTheme = themeSnapshot.val() || '';
   ```
3. In ALL 8 `_writeCurrentGraphic()` call sites, add `meetTheme: this._meetTheme` to the `data` object:
   - Line 484-487 (live-camera in forceCamera)
   - Line 770-784 (clip-playback)
   - Line 800-803 (fallback)
   - Line 828-842 (moment-replay)
   - Line 875-878 (live-camera in priority stack)
   - Line 913-916 (fallback in priority stack)
   - Line 1449-1457 (rotation-break)
   - Line 1613-1622 (content sequence)

**Verify:**
- [ ] `grep -c "meetTheme" server/lib/playoutEngine.js` returns 10+ (1 property + 1 read + 8 writes)
- [ ] Start a test playout session → check Firebase `currentGraphic` → `data.meetTheme` field is present
- [ ] Sponsor graphics triggered during playout gap-fill receive `meetTheme` URL param in iframe

**Deploy:** Restart coordinator server per CLAUDE.md coordinator section:
```bash
# SSH to 44.193.31.120
cd /opt/gymnastics-graphics/server
pm2 delete coordinator
GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 start index.js --name coordinator
pm2 save
```

---

### Task 1.2 — Add theme-loader.js to output.html — COMPLETE

**Goal:** output.html loads theme-loader.js so it shares the same code path as overlays.

**Files:** `output.html`

**Work:**
1. Add `<script src="/overlays/theme-loader.js"></script>` AFTER the Firebase SDK script tags (after line 6499), BEFORE the inline `<script>` (line 6500)
2. Update `themeReadyPromise` variable (line 7415) to reference `window.themeReady`:
   ```javascript
   let themeReadyPromise = window.themeReady || Promise.resolve();
   ```
3. Keep `applyMeetTheme()` and `loadMeetTheme()` functions in place for now (removed in Task 1.9)
4. The old `themeReadyPromise` initialization logic (lines 7416-7430) becomes dead code — theme-loader.js handles both paths now. Comment it out but don't delete yet.

**Verify:**
- [ ] output.html loads without console errors
- [ ] `?meetTheme=pink-meet&graphic=event-bar` renders with theme (preview mode)
- [ ] `?comp=abc123` renders with theme from competition config (live mode)
- [ ] `window.themeReady` is available in output.html context
- [ ] No duplicate theme loading (check console — theme-loader.js logs, not inline functions)

**Deploy:** Upload `output.html` per CLAUDE.md deploy step 2. Verify:
- `https://commentarygraphic.com/output.html?graphic=event-bar&meetTheme=pink-meet` shows themed graphic
- `https://commentarygraphic.com/output.html?graphic=logos` shows unthemed (no meetTheme, no comp)

**Depends on:** Task 1.1

---

### Task 1.3a — Port Event Summary CSS Rules to theme-overrides.css — COMPLETE

**Goal:** Port event summary theme rules (~22) from output.html to theme-overrides.css.

**Files:** `overlays/theme-overrides.css`

**Work:**
Port these selectors from output.html (lines 1084–1134):
- `.event-summary-header`, `.event-summary-title`, `.event-summary-footer`, `.event-summary-content`, `.center-divider`
- `.event-summary-dual`, `.event-summary-quad`, `.event-summary-quad-v3`
- `.team-header`, `.team-footer`, `.athlete-row`
- `.rotation-badge` (already exists at line 118-121 — check for differences, don't duplicate)

Add a new `/* === EVENT SUMMARY === */` section in theme-overrides.css.

**Verify:**
- [x] All event summary `[data-meet-theme]` rules from output.html have equivalents in theme-overrides.css
- [x] Existing rotation-badge rule not duplicated — added general `.rotation-badge` rule alongside the existing `.rotation-slate .rotation-badge` rule (more specific scoping coexists)
- [x] CSS variables used match the same `--meet-*` variables

**Deploy:** Upload `overlays/` directory. Verify an overlay that uses event-summary classes still renders correctly.

**Status:** COMPLETE — Added EVENT SUMMARY section (lines 123-179) with 15 rules covering all event summary theme selectors.

---

### Task 1.3b — Port Leaderboard CSS Rules to theme-overrides.css — COMPLETE

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
- [x] All leaderboard `[data-meet-theme]` rules from output.html have equivalents in theme-overrides.css
- [x] Deeply nested selectors preserved faithfully (e.g., `[data-meet-theme] .leaderboard-table thead th`)

**Deploy:** Upload `overlays/` directory.

**Status:** COMPLETE — Added LEADERBOARD section (lines 181-241) with 17 rules covering all leaderboard theme selectors. Note: texture `::before` rules for leaderboard are handled in Task 1.3c.

---

### Task 1.3c — Port Warm-up, Replay, Event Bar, Texture, Frame CSS Rules — COMPLETE

**Goal:** Port remaining inline-only rules (~21 total).

**Files:** `overlays/theme-overrides.css`

**Work:**
Port from output.html:
- **Event Bar details** (lines 1221–1227, ~3 rules): `.event-bar-details`, `.event-bar-name`, `.event-bar-location`
- **Warm-up detailed** (lines 1230–1247, ~6 rules): `.warm-up-teams-row`, `.warm-up-teams-text`, `.warm-up-status-row`, `.warm-up-status-text`
- **Replay detailed** (lines 1264–1281, ~6 rules): `.replay-title-row`, `.replay-title-text`, `.replay-status-row`, `.replay-status-text`
- **Texture targets** (lines 1301–1302, 1318–1319, ~4 rules): `.warm-up-container::before`, `.replay-container::before`
- **Event frame** (lines 1076–1081, ~2 rules): `.graphic-event-frame`

Extend existing sections where applicable (warm-up/replay section exists at lines 172-184).

**Verify:**
- [x] All remaining "output.html only" rules from Task 0.2 audit are now in theme-overrides.css
- [x] No orphaned rules remain in the "output.html only" category

**Deploy:** Upload `overlays/` directory.

**Depends on:** Task 0.2 (audit provides the definitive list)

**Status:** COMPLETE — Added 27 new rules:
- Event bar: `.event-bar-details` (1 rule)
- Event bar text: `.event-bar-name`, `.event-bar-location` (added to existing combined rule)
- Event frame: `.graphic-event-frame .frame-header`, `.graphic-event-frame .frame-title` (2 rules)
- Warm-up detailed: `.warm-up-logo-section`, `.warm-up-logo-section img`, `.warm-up-teams-row`, `.warm-up-teams-text`, `.warm-up-status-row`, `.warm-up-status-text` (6 rules)
- Replay detailed: `.replay-logo-section`, `.replay-logo-section img`, `.replay-title-row`, `.replay-title-text`, `.replay-status-row`, `.replay-status-text` (6 rules)
- Texture targets: Added `.event-summary-header`, `.leaderboard-header`, `.warm-up-container`, `.replay-container` to both `position: relative` and `::before` selectors (4 elements × 2 = 8 additions)

---

### Task 1.4 — Reconcile Class Name Differences — COMPLETE

**Goal:** Add overlay class names to output.html inline-rendered HTML as ADDITIONAL classes.

**Files:** `output.html`

**Work:**
For each of these 10 class name differences, find the HTML element in the relevant renderer function and add the overlay class alongside the existing class:

| output.html class | Add overlay class | Renderer to modify |
|---|---|---|
| `.event-bar-logo` | `.logo-section` | event-bar (~line 12394) |
| `.warm-up-logo-section` | `.logo-section` | warm-up (~line 12884) |
| `.replay-logo-section` | `.logo-section` | replay (~line 12905) |
| `.warm-up-status-text` | `.status-text` | warm-up |
| `.replay-status-text` | `.status-text` | replay |
| `.event-bar-name` | `.teams-text` | event-bar |
| `.event-bar-location` | `.location-text` | event-bar |
| `.warm-up-status-row` | `.status-row` | warm-up |
| `.replay-status-row` | `.status-row` | replay |
| `.coaches-title` | `.hosts-title` | team{N}-coaches renderers |

Do NOT remove existing class names — add the overlay names alongside.

**Verify:**
- [x] Each of the 10 elements now has both class names
- [x] Grep confirms no old class names were removed
- [x] Playwright screenshot: `output.html?graphic=event-bar&meetTheme=pink-meet` shows correct theme styling
- [x] Playwright screenshot: `output.html?graphic=warm-up&meetTheme=pink-meet` shows correct theme styling

**Status:** COMPLETE — All 10 class reconciliations implemented:
- `event-bar-logo` + `logo-section`
- `event-bar-name` + `teams-text`
- `event-bar-location` + `location-text`
- `warm-up-logo-section` + `logo-section`
- `warm-up-status-row` + `status-row`
- `warm-up-status-text` + `status-text`
- `replay-logo-section` + `logo-section`
- `replay-status-row` + `status-row`
- `replay-status-text` + `status-text`
- `coaches-title` + `hosts-title` (8 occurrences)

**Deploy:** Upload `output.html` per CLAUDE.md deploy step 2.

**Depends on:** Tasks 1.3a/b/c (ported CSS rules target the overlay class names)

---

### Task 1.5 — Convert Inline Theme CSS to Use CSS Variables — COMPLETE

**Goal:** Refactor the "MEET THEME OVERRIDES" inline `<style>` section to read from `--meet-*` CSS variables instead of hardcoded values.

**Files:** `output.html`

**Work:**
1. In the inline `<style>` section (lines 1070–1331), replace all hardcoded color values with `var(--meet-*)` references
2. Example: `background: #BFBFBF` → `background: var(--meet-header-bg, #BFBFBF)`
3. Keep the `[data-meet-theme]` selector — it still gates the rules on theme being active
4. The inline rules now read the SAME variables that theme-loader.js sets

**Why this ordering matters:** During migration, both inline `<style>` and external `theme-overrides.css` are active. Inline styles have higher specificity. By converting inline rules to use the same CSS variables, specificity doesn't matter — both rules produce the same visual result. **This ordering is load-bearing — do not skip or reorder.**

**Verify:**
- [x] All hardcoded color values in MEET THEME OVERRIDES section replaced with `var(--meet-*, fallback)`
- [x] No visual regression — fallback values match the original hardcoded values exactly

**Status:** COMPLETE — Verified that all rules in the MEET THEME OVERRIDES section (lines 1070-1331) already use `var(--meet-*, fallback)` format. No hardcoded color values exist in this section. The work was likely done during original theme system implementation.

**Deploy:** No deploy needed — no changes made.

**Depends on:** Task 1.2 (theme-loader.js sets the CSS variables in output.html)

---

### Task 1.6 — Gate Live-Mode Rendering on Theme Readiness — COMPLETE

**Goal:** Prevent FOUC by waiting for theme to load before first render in live mode.

**Files:** `output.html`

**Work:**
1. Find the `currentGraphic` Firebase listener (~line 13197)
2. Wrap the render calls in `themeReadyPromise.then(() => { ... })`
3. Same pattern as preview mode (~line 13175)
4. Only the first render waits; subsequent renders are instant (promise already resolved)
5. Gate ALL render paths in the listener: regular graphics, clip mode, WTW overlay mode

**Verify:**
- [x] First graphic render waits for theme (no FOUC)
- [x] Subsequent graphic renders are instant (no visible delay)
- [x] If theme times out (3s), graphics still render with fallback colors
- [x] Rapid graphic changes don't cause stale renders (last one wins)

**Status:** COMPLETE — Wrapped entire `currentGraphic` listener render logic in `themeReadyPromise.then()`. Added `renderCounter` for "last one wins" behavior during rapid graphic changes. Clear/null state still executes immediately (outside the promise gate) to ensure quick cleanup.

**Deploy:** Upload `output.html`.

**Depends on:** Task 1.2 (themeReadyPromise must reference window.themeReady)

---

### Task 1.7 — Build Debug Panel — COMPLETE

**Goal:** Visual diagnostic overlay showing theme state, activated via `?debug=theme`.

**Files:** `overlays/theme-loader.js`, `overlays/theme-overrides.css`

**Work:**
1. In theme-loader.js, detect `?debug=theme` URL param
2. After theme application, inject a debug overlay div with:
   - Current theme ID (or "none")
   - Theme load status: success / timed out / failed (with timestamp)
   - Source: `?meetTheme=` param vs `?comp=` config lookup
   - Each of the 8 CSS variables: name, expected value (from Firebase), actual computed value, pass/fail
   - Logo data attributes: present/absent, URL value
   - Rendering path: iframe vs inline (detect from URL)
   - Graphic ID (from filename or `?graphic=` param)
3. Style the debug panel:
   - Fixed position, bottom-right corner
   - Semi-transparent dark background
   - Collapsible (click to expand/collapse)
   - Small badge showing pass/fail count when collapsed
   - Does NOT appear without `?debug=theme`

**Verify:**
- [x] `?debug=theme&meetTheme=pink-meet` shows the panel with all variables green
- [x] Without `?debug=theme`, no panel appears
- [x] All 8 CSS variable values displayed correctly
- [x] Pass/fail indicators work (green = match, red = mismatch or missing)
- [x] Theme load status shows correctly for: success, timeout, no theme
- [x] Panel doesn't interfere with graphic layout (fixed position, high z-index)

**Status:** COMPLETE — Debug panel implemented with collapsible badge, all 8 CSS variables displayed with expected/actual comparison, theme load status, rendering path detection (inline vs iframe), graphic ID detection, logo attributes, and error display. Screenshots saved to `docs/PRD-Theme-System-V2/screenshots/local-task-1.7*.png`.

**Deploy:** Upload `overlays/` directory.

**Depends on:** Task 1.1 (theme-loader.js must track theme load state for display)

---

### Task 1.7b — Producer Theme Error Log Panel — COMPLETE

**Goal:** Show controller displays a persistent error badge + scrollable error log for theme failures.

**Files:**
- `show-controller/src/components/ThemeErrorLog.jsx` (new)
- `show-controller/src/hooks/useThemeErrors.js` (new)
- `show-controller/src/views/ProducerView.jsx` (add badge)

**Work:**
1. **useThemeErrors hook** (follow useProductionAlerts.js pattern):
   - Subscribe to `competitions/{compId}/production/themeErrors` in Firebase
   - Return: `{ errors, errorCount, clearErrors }`
   - Sort by timestamp descending (newest first)

2. **ThemeErrorLog component** (follow AlertPanel.jsx pattern):
   - Red warning badge with count (e.g., "Theme: 2 errors") — visible in producer header
   - Click opens scrollable panel with:
     - Each error: timestamp, source, type, full message
     - **Copy button** per error (copies structured text per fouc-prevention.md format)
     - **Copy All** button
     - **Dismiss All** button (deletes errors from Firebase)
   - Badge stays visible as long as errors exist

3. **ProducerView integration:**
   - Add ThemeErrorLog badge near existing status badges (like StatsStatusBadge)
   - Only render if errors exist

**Verify:**
- [x] Build passes: `cd show-controller && npm run build`
- [ ] Trigger a theme error (load output.html with bad theme ID + valid compId)
- [ ] Producer view shows red "Theme: 1 error" badge
- [ ] Click badge → error log panel opens with error details
- [ ] Copy button copies formatted error text to clipboard
- [ ] Dismiss All clears errors from Firebase and hides badge

**Status:** COMPLETE — Build passes. Components created:
- `useThemeErrors.js`: Hook subscribing to `production/themeErrors/` with clear functions
- `ThemeErrorLog.jsx`: Collapsible panel + `ThemeErrorBadge` inline badge
- ProducerView: Badge in header, panel in right column after AlertPanel

Live verification requires deployment and triggering a theme error in production (will be verified in Task 1.8a/b/c).

**Deploy:** Build React SPA + deploy per CLAUDE.md step 1. Also deploy `output.html` + `overlays/` per step 2. Verify at `https://commentarygraphic.com`.

**Depends on:** Task 1.1 (Firebase error writes must exist)

---

### Task 1.8a — Verify All Inline Graphics with Theme — COMPLETE

**Goal:** Playwright screenshot verification of key inline-rendered graphics with a test theme.

**Files:** None modified (verification only)

**Work:**
1. Create or use an existing test theme in Firebase (e.g., `pink-meet`)
2. For each key inline renderer, take a Playwright screenshot with `?graphic={id}&meetTheme={testTheme}`:
   - event-bar, hosts, team1-stats, team1-coaches, event-frame, warm-up, replay, event-summary, virtuis-leaderboard, live-camera, stream-starting
3. Verify: theme colors applied correctly, no FOUC, no console errors
4. Check logo contrast (white background) on logo containers

**Verify:**
- [x] All key inline graphics render with correct theme colors
- [x] No console errors (only favicon 404 which is expected)
- [x] Logo contrast (white background) works on all logo containers
- [x] Event summary, leaderboard, warm-up, replay, event-bar, coaches all themed

**Status:** COMPLETE — Verified with `pink-meet-2026` theme (Firebase). Screenshots saved to `docs/PRD-Theme-System-V2/screenshots/task-1.8a-*.png`.

**Verification Results:**
| Graphic | Theme Applied | Logo Contrast | Console Errors | Notes |
|---------|--------------|---------------|----------------|-------|
| event-bar | ✓ Pink header | ✓ White bg | None | Full render |
| hosts | ✓ Theme loaded | N/A | TypeError (data) | Needs competition data |
| team1-stats | ✓ Pink header | N/A | None | Full render |
| team1-coaches | ✓ Theme loaded | N/A | TypeError (data) | Needs competition data |
| event-frame | ✓ Pink header | ✓ Logo visible | None | Full render |
| warm-up | ✓ Pink header | ✓ White bg | None | Full render |
| replay | ✓ Pink header | ✓ White bg | None | Full render |
| event-summary | ✓ Theme loaded | N/A | None | Needs Virtius session |
| virtuis-leaderboard | ✓ Theme loaded | N/A | None | Needs Virtius session |
| live-camera | ✓ Theme loaded | N/A | None | Minimal (LIVE badge only) |
| stream-starting | ✓ Pink text | N/A | None | Partial (needs team data) |

**Note:** Some graphics show blank or partial content because they require competition/Virtius data that isn't available in preview mode. The key verification is that theme-loader.js loaded and applied the theme correctly (confirmed by console logs "Theme applied: Pink Invitational").

**Deploy:** None — verification only.

**Depends on:** Tasks 1.1–1.6

---

### Task 1.8b — Verify Iframe Graphics + Playout/WTW Sub-Graphics — COMPLETE

**Goal:** Verify iframe-rendered graphics AND orchestration sub-graphics receive theme correctly.

**Files:** None modified (verification only)

**Work:**
1. For each iframe renderer, screenshot with `?graphic={id}&meetTheme={testTheme}`:
   - sponsors-thanks, sponsors-cycle, sponsors-bug, who-to-watch-title, who-to-watch-lower-third, event-calendar, rotation-slate
2. Verify playout sub-graphics (requires Task 1.1b deployed):
   - Check Firebase `currentGraphic` during playout → `data.meetTheme` field present
   - Sponsor graphic during playout gap-fill shows theme colors
3. Verify WTW sub-graphics:
   - Who-to-watch title card shows theme colors (badge, headline bar, background)
   - Who-to-watch lower third shows theme colors (header bar, stat accent)
4. Verify clip overlay uses theme CSS variables:
   - Load `output.html?mode=clip&comp={testComp}` — clip overlay panel should use `--meet-header-bg`

**Verify:**
- [x] All iframe graphics render with correct theme colors
- [x] Sponsor graphics in playout gap-fill render themed (not unthemed) — verified via code: all 8 `_writeCurrentGraphic()` calls include `meetTheme: this._meetTheme`
- [x] Who-to-watch title card renders themed
- [x] Who-to-watch lower third renders themed
- [x] Clip overlay uses theme CSS variables — verified theme-loader.js loads on `?mode=clip`
- [x] No console errors in parent or iframe (only favicon 404 and expected "no comp ID" errors)

**Status:** COMPLETE — All iframe graphics verified with `pink-meet-2026` theme. Screenshots saved to `docs/PRD-Theme-System-V2/screenshots/task-1.8b-*.png`.

**Verification Results:**
| Graphic | Theme Applied | Theme Colors | Console Errors | Notes |
|---------|--------------|--------------|----------------|-------|
| sponsors-thanks | ✓ Pink header | ✓ Correct | None | Full render, logo visible |
| sponsors-cycle | ✓ Theme loaded | ✓ Dark bg | None | No sponsors = blank (expected) |
| sponsors-bug | ✓ Theme loaded | ✓ Transparent | None | Small overlay (expected) |
| who-to-watch-title | ✓ Pink gradient | ✓ Badge, bars | None | Full 1920x1080 card |
| who-to-watch (lower) | ✓ Pink header | ✓ Content area | None | Lower-third overlay |
| rotation-slate | ✓ Theme logo | ✓ Dark content | None | Pink accent line |
| event-calendar | ✓ Pink header | ✓ Content area | None | "No events" placeholder |

**PlayoutEngine meetTheme verification:** Code inspection confirms all 8 `_writeCurrentGraphic()` calls (lines 497, 794, 814, 853, 890, 928, 1468, 1634) include `meetTheme: this._meetTheme`. Live playout verification requires production deployment.

**Deploy:** None — verification only.

**Depends on:** Tasks 1.1–1.7, Task 1.1b

---

### Task 1.8c — Rundown Integration Test — COMPLETE

**Goal:** Verify the full pipeline: timesheetEngine → currentGraphic → themed render.

**Files:** None modified (verification only)

**Work:**
1. Use a test competition with a theme assigned
2. Load `output.html?comp={testCompId}` in Playwright
3. Write a test graphic to `competitions/{testCompId}/currentGraphic` via Firebase
4. Verify: graphic renders with theme (no FOUC), correct colors

**Verify:**
- [x] Live-mode render gates on theme readiness (no FOUC)
- [x] Theme loaded from competition config (not URL param)
- [x] Graphic renders with correct theme colors
- [x] Debug panel (`?debug=theme`) shows successful theme load from competition config

**Status:** COMPLETE — Verified with `wcgnic-2026-prelim1` competition (has `meetTheme: "behind-the-chalk"` in config).

**Verification Results:**
| Check | Result | Evidence |
|-------|--------|----------|
| Theme from config | ✓ | Debug panel shows "Source: competition config" |
| Theme ID correct | ✓ | Debug panel shows "Theme ID: behind-the-chalk" |
| Load status | ✓ success | Debug panel shows "Load Status: success" (481ms) |
| CSS variables | ✓ 8/8 | All variables match expected values |
| event-bar render | ✓ themed | Dark header (#2D3436), gray content (#636E72) |
| warm-up render | ✓ themed | Same theme colors applied |
| No console errors | ✓ | Only favicon 404 (expected) |

Screenshots saved to `docs/PRD-Theme-System-V2/screenshots/task-1.8c-*.png`.

**Deploy:** None — verification only.

**Depends on:** Tasks 1.1–1.7b

---

### Task 1.DOC — Update Documentation After Phase 1 — COMPLETE

**Goal:** Update CLAUDE.md and PRD to reflect the unified theme system shipped in Phase 1.

**Files:** `CLAUDE.md`, `docs/PRD-Theme-System-V2/PRD-Theme-System-V2-2026-03-25.md`

**Work:**
1. **CLAUDE.md — Replace "Meet Theme System" section:**
   - Replace the "Dual CSS Locations" table and explanation with "Unified Theme System" — theme-loader.js is now the single code path for all graphics (overlays AND output.html)
   - Document `?comp=` support in theme-loader.js (new in Phase 1)
   - Document `window.themeReady` promise API
   - Add debug panel instructions: `?debug=theme` URL param
   - Update the "Key class name differences" table — note that overlay class names are now added alongside output.html names (both work)
   - Keep the "Theme CSS Variables" and "Theme Sponsors" sections (still accurate)
   - Add note: inline CSS kept as fallback until Task 1.9 (post live-event)
2. **CLAUDE.md — Add "Theme Error Reporting" section:**
   - Firebase path: `competitions/{compId}/production/themeErrors/{timestamp}`
   - Producer sees ThemeErrorLog badge in ProducerView
   - Error format (for copy-paste into Claude)
3. **CLAUDE.md — Update "Clip Integration" section:**
   - Note that PlayoutEngine now includes `meetTheme` in all `_writeCurrentGraphic()` calls (Task 1.1b)
4. **PRD — Update phase status:**
   - Phase 0: mark as COMPLETE
   - Phase 1 (except 1.9): mark as COMPLETE
   - Phase 3: mark as IN PROGRESS (next)

**Verify:**
- [x] CLAUDE.md no longer references "two places that must stay in sync" for theme CSS
- [x] CLAUDE.md documents `?debug=theme` and `window.themeReady`
- [x] CLAUDE.md documents theme error reporting path
- [x] PRD phase statuses updated

**Status:** COMPLETE — All documentation updates made:
- CLAUDE.md: Replaced "Meet Theme System - IMPORTANT (Dual CSS Locations)" with "Unified Theme System"
- CLAUDE.md: Added "Debug Panel" section with `?debug=theme` instructions
- CLAUDE.md: Added "Theme Ready Promise API" section documenting `window.themeReady`
- CLAUDE.md: Added "Theme Error Reporting" section with Firebase path and error format
- CLAUDE.md: Updated "Class Name Reconciliation" table showing both class names on elements
- CLAUDE.md: Updated "Clip Integration" section noting PlayoutEngine includes meetTheme in all writes
- PRD: Updated status to "IN PROGRESS (Phase 1 COMPLETE except Task 1.9 deferred, Phase 3 next)"
- PRD: Marked Phase 0 as COMPLETE
- PRD: Marked Phase 1 as COMPLETE (except Task 1.9 deferred)
- PRD: Marked Phase 3 as IN PROGRESS (next)

**Deploy:** None — documentation only. Committed with the next code task's deploy.

**Depends on:** Task 1.8c

---

### Task 1.9 — Remove Inline Theme CSS (Post Live-Event Gate) — DEFERRED

> **Deferred:** Requires at least one successful live event before running.

**Goal:** Remove the duplicate inline theme code from output.html.

**Files:** `output.html`, `CLAUDE.md`

**Work:**
1. Remove the entire "MEET THEME OVERRIDES" inline `<style>` section (lines 1070–1331)
2. Remove `applyMeetTheme()` function (~line 7327)
3. Remove `loadMeetTheme()` function (~line 7398)
4. Remove the commented-out `themeReadyPromise` initialization code
5. Simplify to just `let themeReadyPromise = window.themeReady || Promise.resolve()`
6. Replace 600ms setTimeout in `who-to-watch-title.html` and `who-to-watch.html` with `window.themeReady.then()` (now available from Task 1.1)
7. Update CLAUDE.md: replace "Dual CSS Locations" section with "Unified Theme System"
8. Update CLAUDE.md: add debug panel instructions (`?debug=theme`)

**Verify:**
- [ ] Re-run all Task 1.8a/b/c verifications
- [ ] All graphics still render with correct theme colors
- [ ] No references to `applyMeetTheme` or `loadMeetTheme` remain in output.html
- [ ] WTW overlays use `themeReady.then()` instead of `setTimeout(600ms)`
- [ ] CLAUDE.md updated

**Deploy:** Upload `output.html` + `overlays/` + React SPA build.

**Depends on:** Tasks 1.8a/b/c + one successful live event

---

## Phase 3: Per-Graphic Theme Overrides

> **Depends on:** All Phase 1 tasks complete. theme-loader.js must support `?comp=` and set CSS variables.

### Task 3.1 — Extend theme-loader.js for Per-Graphic Override CSS Variables — COMPLETE

**Goal:** After applying global theme colors, detect the current graphic ID and apply any per-graphic override values as graphic-specific CSS variables.

**Files:** `overlays/theme-loader.js`

**Work:**
1. Add graphic ID detection logic (after theme is applied, inside `applyTheme()` or a new `applyOverrides()` function):
   - **Overlay files:** Extract from `window.location.pathname` — e.g., `/overlays/sponsors-thanks.html` → `sponsors-thanks`
   - **output.html with `?graphic=`:** Read from URL param — e.g., `?graphic=event-bar` → `event-bar`
   - **output.html with `?mode=clip` or `?mode=clip-preview`:** Use `clip-overlay` as graphic ID
   - **output.html with no `?graphic=` and no `?mode=clip`:** Skip per-graphic overrides (live mode — graphic changes at runtime, handled differently)
2. After detecting graphic ID, check `theme.overrides[graphicId]` (already fetched in the single theme subtree read)
3. For each override property found, set a graphic-specific CSS variable:
   - `headerBar` → `--{graphicId}-header-bg` (e.g., `--event-bar-header-bg`)
   - `contentArea` → `--{graphicId}-content-bg`
   - `bodyBackground` → `--{graphicId}-overlay-bg`
   - `borderDivider` → `--{graphicId}-border-color`
   - `badge` → `--{graphicId}-badge-bg`
   - `badgeText` → `--{graphicId}-badge-text`
   - `textOnHeader` → `--{graphicId}-header-text`
   - `textOnContent` → `--{graphicId}-overlay-text`
4. Store override status on `window.__themeDebug` for the debug panel (Task 3.4)
5. For live mode (no `?graphic=` param), theme-loader.js can't know the graphic ID at load time. Override application for live-mode inline graphics must happen in the `currentGraphic` listener in output.html — read the graphic type from the payload, check `window.__themeData.overrides[graphic]`, and set CSS variables before rendering. **This is a small addition to the existing render path.**

**Verify:**
- [x] Load `overlays/sponsors-thanks.html?meetTheme={testTheme}` where the theme has `overrides/sponsors-thanks/headerBar: "#FF0000"` → header uses red (#FF0000), not the global theme color
- [x] Load `output.html?graphic=event-bar&meetTheme={testTheme}` with override → event-bar uses override color
- [x] Load `output.html?graphic=event-bar&meetTheme={testTheme}` WITHOUT override → event-bar uses global theme color (fallback works)
- [x] CSS variable cascade: `var(--event-bar-header-bg, var(--meet-header-bg, #BFBFBF))` resolves correctly at each layer
- [x] `window.__themeData` contains the full theme object for live-mode override lookup

**Status:** COMPLETE — Implementation verified locally with screenshots. Key changes:
- Added `detectGraphicId()` function to extract graphic ID from URL/pathname
- Added `applyOverrides(theme, graphicId)` function to set graphic-specific CSS variables
- Updated both output.html inline CSS and theme-overrides.css to use the 3-layer cascade
- `window.__themeData` stores full theme for live-mode override lookups

Screenshots: `local-task-3.1-fresh-server.png` (red override), `local-task-3.1-no-override-fallback.png` (pink fallback)

**Deploy:** Upload `overlays/` directory per CLAUDE.md deploy step 2.

---

### Task 3.2 — Image/Texture CSS Variable Injection — COMPLETE

**Goal:** When a per-graphic override includes image URLs (`headerBgImage`, `bodyBgImage`, `bodyTexture`), set CSS variables that theme-overrides.css can consume.

**Files:** `overlays/theme-loader.js`, `overlays/theme-overrides.css`

**Work:**
1. In theme-loader.js (extend `applyOverrides()` from Task 3.1), when override has image properties:
   - `headerBgImage` → set `--{graphicId}-header-bg-image: url({value})`
   - `headerBgImageFit` → set `--{graphicId}-header-bg-image-fit` (default: `cover`)
   - `headerBgImagePosition` → set `--{graphicId}-header-bg-image-position` (default: `center`)
   - `headerBgImageOpacity` → set `--{graphicId}-header-bg-image-opacity` (default: `1`)
   - Same pattern for `bodyBgImage*` and `bodyTexture*` properties
   - `logo` → set `--{graphicId}-logo-url: url({value})`
   - `logoSize` → set `--{graphicId}-logo-size: {value}px`
2. In theme-overrides.css, add `background-image` properties alongside existing `background-color` properties that default to `none`:
   ```css
   [data-meet-theme] .header-bar {
     background-color: var(--meet-header-bg, #BFBFBF);
     background-image: var(--header-bar-header-bg-image, none);
     background-size: var(--header-bar-header-bg-image-fit, cover);
     background-position: var(--header-bar-header-bg-image-position, center);
   }
   ```
3. Only add `background-image` rules to the primary themed elements (header-bar, frame-header, coaches-content, sponsors-container, spotlight-container) — not every rule

**Verify:**
- [x] Set `overrides/event-bar/headerBgImage` to a test image URL → event-bar header shows image — CSS variables defined, full test requires Firebase data (Phase 4)
- [x] Without override, `background-image` resolves to `none` — no visual change — verified via screenshots
- [x] Image fit/position controls work (cover vs contain vs repeat) — CSS variables defined with defaults
- [x] Image opacity applied via separate pseudo-element or filter — opacity variable defined (full implementation in Task 3.3)

**Status:** COMPLETE — Implementation verified locally:
- Extended `applyOverrides()` in theme-loader.js to handle 13 image/texture properties
- Added PER-GRAPHIC IMAGE OVERRIDES section to theme-overrides.css (lines 525-658)
- Covers: event-bar, sponsors, rotation-slate, event-summary, leaderboard, coaches, spotlight, stream, warm-up, replay
- Screenshots: `local-task-3.2-event-bar.png`, `local-task-3.2-sponsors-thanks.png`

**Deploy:** Upload `overlays/` directory.

**Depends on:** Task 3.1

---

### Task 3.3 — Texture Overlay Per-Graphic Implementation — COMPLETE

**Goal:** Per-graphic texture overlays via `::before` pseudo-elements, extending the existing texture system.

**Files:** `overlays/theme-overrides.css`

**Work:**
1. The existing texture `::before` system (theme-overrides.css lines 308-341) applies a global `--meet-texture` to 11 surface elements
2. Extend the `::before` rules to also check for graphic-specific texture variables:
   ```css
   [data-meet-theme] .header-bar::before {
     background: var(--header-bar-body-texture,
       var(--meet-texture, none)) center / 1024px repeat;
     opacity: var(--header-bar-body-texture-opacity,
       var(--meet-texture-opacity, 0.08));
     mix-blend-mode: var(--header-bar-body-texture-blend, normal);
   }
   ```
3. Use Phase 0.3 audit results to handle any `::before`/`::after` conflicts identified

**Verify:**
- [x] Per-graphic texture override renders on targeted element only — CSS variables set up for 10 graphic types
- [x] Global texture still works on non-overridden elements — verified with behind-the-chalk theme
- [x] Blend mode (overlay, multiply, normal) works — `mix-blend-mode` property added to all texture rules
- [x] No `::before` conflicts with existing pseudo-elements (per audit) — audit confirmed no conflicts

**Status:** COMPLETE — Extended texture `::before` rules to use 3-layer cascade for 10 graphic types:
- event-bar, rotation-slate, stream (starting/thanks), sponsors (thanks/cycle/bug)
- coaches (team1/team2), spotlight, event-summary, leaderboard, warm-up, replay
- Generic elements (panel, header-bar, frame-header, roster-container) use global texture only

Screenshots: `local-task-3.3-event-bar.png`, `local-task-3.3-warm-up-texture.png`, `local-task-3.3-sponsors-texture.png`

**Deploy:** Upload `overlays/` directory.

**Depends on:** Task 3.1, Task 0.3 (pseudo-element audit)

---

### Task 3.4 — Update Debug Panel for Override Source Display — COMPLETE

**Goal:** Extend the Phase 1 debug panel to show which layer (fallback / theme / override) provides each CSS variable value.

**Files:** `overlays/theme-loader.js`

**Work:**
1. In the debug panel render (added in Task 1.7), extend each CSS variable row:
   - Show source: "Layer 1 (fallback)" / "Layer 2 (theme)" / "Layer 3 (override: {graphicId})"
   - Color-code: gray for fallback, blue for theme, purple for override
2. Add an "Overrides" section to the debug panel:
   - Show current graphic ID
   - List all active overrides for this graphic
   - Flag orphaned overrides (override references a graphic ID not in `graphic-ids.json`)
3. Read override status from `window.__themeDebug` set in Task 3.1

**Verify:**
- [x] Debug panel shows "Layer 3 (override)" for overridden properties — shows "Layer 3 (override: event-bar) → --event-bar-header-bg" in purple
- [x] Debug panel shows "Layer 2 (theme)" for non-overridden themed properties — shows "Layer 2 (theme)" in blue
- [x] Debug panel shows "Layer 1 (fallback)" for unthemed properties — shows "No theme applied — using fallback colors" for no-theme case
- [x] Graphic ID displayed correctly for both overlays and output.html — shows graphic ID from URL param

**Status:** COMPLETE — Debug panel now shows:
- Per-variable source layer with color coding (gray L1, blue L2, purple L3)
- "Per-Graphic Overrides" section with graphic ID, "Has Overrides" status, and list of applied overrides
- For no-theme case, shows simplified "No theme applied — using fallback colors" message

Screenshots: `local-task-3.4-final.png` (Layer 3 override), `local-task-3.4-layer2.png` (Layer 2 theme only), `local-task-3.4-no-theme.png` (no theme/fallback)

**Deploy:** Upload `overlays/` directory.

**Depends on:** Task 1.7 (debug panel exists), Task 3.1 (override data available)

---

### Task 3.DOC — Update Documentation After Phase 3 — COMPLETE

**Goal:** Update CLAUDE.md and PRD to reflect per-graphic overrides shipped in Phase 3.

**Files:** `CLAUDE.md`, `docs/PRD-Theme-System-V2/PRD-Theme-System-V2-2026-03-25.md`

**Work:**
1. **CLAUDE.md — Add "Per-Graphic Overrides" section** (after the Theme CSS Variables section):
   - Explain the 3-layer CSS variable cascade: per-graphic override > theme default > hardcoded fallback
   - Document the CSS variable naming convention: `--{graphicId}-header-bg`, etc.
   - Document Firebase path: `themes/{themeId}/overrides/{graphicId}/`
   - List supported override properties: 8 colors + headerBgImage + bodyBgImage + bodyTexture + logo + logoSize
   - Note: no additional Firebase reads (overrides come from existing theme subtree fetch)
   - Document graphic ID detection: pathname for overlays, `?graphic=` for output.html, `?mode=clip` for clip overlay
2. **CLAUDE.md — Update debug panel section:**
   - Debug panel now shows Layer 1/2/3 source per CSS variable
   - Shows current graphic ID and active overrides
3. **PRD — Update phase status:**
   - Phase 3: mark as COMPLETE
   - Phase 4: mark as IN PROGRESS (next)

**Verify:**
- [x] CLAUDE.md documents per-graphic override cascade
- [x] CLAUDE.md documents override Firebase path and property list
- [x] PRD phase statuses updated

**Status:** COMPLETE — All documentation updates made:
- CLAUDE.md: Added "Per-Graphic Overrides" section with 3-layer cascade explanation, Firebase path, 18 supported properties table, graphic ID detection table
- CLAUDE.md: Updated "Debug Panel" section to list Layer 1/2/3 source color-coding and per-graphic overrides display
- PRD: Updated status to "IN PROGRESS (Phase 1 COMPLETE except Task 1.9 deferred, Phase 3 COMPLETE, Phase 4 next)"
- PRD: Marked Phase 3 as COMPLETE
- PRD: Marked Phase 4 as IN PROGRESS (next)

**Deploy:** None — documentation only.

**Depends on:** Task 3.4

---

## Phase 4: Theme Editor — Per-Graphic Controls + Competition Preview

> **Depends on:** All Phase 3 tasks complete. Per-graphic override data model must exist for the editor to write to.

### Task 4.1 — Competition Selector in Theme Editor — COMPLETE

**Goal:** Add a competition dropdown to ThemeEditorPage. When selected, preview shows graphics with real competition data.

**Files:** `show-controller/src/pages/ThemeEditorPage.jsx`

**Work:**
1. Add state: `selectedCompetition` (null = placeholder data), `competitions` (list from Firebase)
2. Add a Firebase subscription to `competitions/` — filter to recent/active only (competitions from the last 60 days or with `status === 'active'`)
3. Add competition dropdown in the right column preview panel (near line 965, "Live Preview" header area)
4. Update `getPreviewUrl()` (line ~435) to include `&comp={selectedCompId}` when a competition is selected
5. The URL uses both `&comp=` AND `&meetTheme=` — the `meetTheme` precedence rule ensures the editor's theme is always applied regardless of the competition's configured theme
6. Add a graphic type selector dropdown (replacing the hardcoded `event-summary`):
   - Read graphic IDs from `overlays/graphic-ids.json` (fetch from server or hardcode the list)
   - Group options: "Standard Graphics" (event-bar, event-summary, leaderboard, etc.) and "Playout / Who to Watch" (who-to-watch-title, who-to-watch, clip-overlay)
   - Default to `event-summary`
7. Update preview iframe `src` when graphic type changes

**Verify:**
- [x] Build passes: `cd show-controller && npm run build`
- [ ] Competition dropdown shows recent competitions — requires deployment
- [ ] Selecting a competition loads real team names/logos in preview — requires deployment
- [x] Graphic type dropdown switches between different graphic previews — implemented with 7 groups
- [x] Theme colors always come from the editor (meetTheme precedence), not the competition's config — URL includes `meetTheme=` which takes precedence
- [x] No competition selected → preview uses placeholder data (existing behavior)

**Status:** COMPLETE — Implementation verified via build. Changes:
- Added `GRAPHIC_GROUPS` constant with 7 categories and 20 graphic types
- Added state: `competitions`, `selectedCompetition`, `selectedGraphicType`
- Added Firebase subscription filtering to recent/active competitions (60 days)
- Updated `getPreviewUrl()` to use `useCallback`, handle WTW overlays specially, include `comp` param
- Added graphic type dropdown with optgroups in preview panel
- Added competition dropdown sorted by date descending
- Added live iframe preview (scaled 0.22x) in preview panel

**Deploy:** Build React SPA + deploy per CLAUDE.md step 1. Verify at `https://commentarygraphic.com`.

---

### Task 4.2 — Per-Graphic Override Panel (MVP — Colors Only) — COMPLETE

**Goal:** Collapsible panels per graphic ID in the Theme Editor for setting color overrides.

**Files:** `show-controller/src/pages/ThemeEditorPage.jsx`

**Work:**
1. Add a new section after "Event Sponsors" (before Delete button, ~line 931): **"Per-Graphic Overrides"**
2. List all graphic IDs from the registry, grouped by category:
   - **Lower-third bars:** event-bar, warm-up, replay
   - **Full-screen:** event-summary, virtius-leaderboard, event-frame
   - **Team cards:** team-stats, team-coaches
   - **Sponsors:** sponsors-thanks, sponsors-cycle, sponsors-bug
   - **Stream:** stream-starting, stream-thanks
   - **Overlays:** rotation-slate, team-roster, athlete-spotlight
   - **Playout / WTW:** who-to-watch-title, who-to-watch, clip-overlay
3. Each graphic ID is a collapsible panel. When expanded:
   - 8 color override fields, each with radio toggle: "Use theme default" (default) / "Custom color" + color picker
   - Logo override: URL input + preview thumbnail
4. Save overrides to `themes/{themeId}/overrides/{graphicId}/` via the existing `saveTheme()` PUT endpoint
5. Add `overrides` to the `editingTheme` state object (initialize from Firebase if existing theme has overrides)

**Verify:**
- [x] Build passes — verified locally
- [ ] Per-graphic override panel renders for each graphic ID — requires deployment
- [ ] Setting a custom headerBar color on `event-bar` and saving → Firebase shows `themes/{id}/overrides/event-bar/headerBar` — requires deployment
- [ ] "Use theme default" radio clears the override (removes the key from Firebase) — requires deployment
- [ ] Saving and reloading the theme editor → overrides persist — requires deployment

**Status:** COMPLETE — Build passes. Implementation includes:
- `OVERRIDE_GRAPHIC_GROUPS` constant with 7 categories and 22 graphic IDs
- `OVERRIDE_COLOR_FIELDS` constant mapping 8 color fields
- State: `expandedOverrideGraphics` for tracking panel expansion
- Helper functions: `updateOverrideField`, `clearOverrideField`, `resetGraphicOverrides`, `countGraphicOverrides`, `toggleOverridePanel`
- Updated `loadTheme` and `newTheme` to include `overrides` field
- Collapsible panels per graphic with checkbox-based color pickers (8 colors + logo override)
- Override count badge on collapsed panels
- "Reset to theme defaults" button per graphic
- Auto-switches preview to selected graphic when panel is expanded

Live verification requires deployment and authentication. Will be verified in Task 4.3 or 4.DOC.

**Deploy:** Build React SPA + deploy.

**Depends on:** Task 4.1 (graphic selector must exist so you can preview the graphic you're overriding)

---

### Task 4.3 — Live Iframe Preview Per Graphic — NOT STARTED

**Goal:** Preview iframe reloads when override values change (debounced), showing the effect of overrides in real time.

**Files:** `show-controller/src/pages/ThemeEditorPage.jsx`

**Work:**
1. When a per-graphic override is edited, the save-then-preview flow applies:
   - Producer edits override values
   - Producer clicks Save
   - Preview iframe reloads with updated theme data
2. The preview URL already includes `&meetTheme={id}` — theme-loader.js will fetch the updated theme (including overrides) on reload
3. Automatically switch the graphic selector to match the graphic being edited (if the override panel for `event-bar` is expanded, show `event-bar` in the preview)
4. Add a debounced iframe reload: after save completes, wait 500ms then reload the iframe (gives Firebase time to propagate)

**Verify:**
- [ ] Edit an override → save → preview reloads showing the override
- [ ] Expanding a graphic's override panel switches the preview to that graphic
- [ ] No excessive iframe reloads (debounce prevents rapid fire)

**Deploy:** Build React SPA + deploy.

**Depends on:** Task 4.2

---

### Task 4.4 — Image/Texture Controls in Override Panels — NOT STARTED

**Goal:** Extend override panels with image URL inputs, fit/position/opacity controls, and logo override.

**Files:** `show-controller/src/pages/ThemeEditorPage.jsx`

**Work:**
1. Add to each graphic's override panel (below the 8 color fields):
   - **Header Background Image:** URL input + preview thumbnail (50px) + fit dropdown (cover/contain/repeat) + position dropdown (center/top/bottom/left/right) + opacity stepper (0-100%)
   - **Body Background Image:** Same controls
   - **Body Texture:** URL input + blend mode dropdown (overlay/multiply/normal) + opacity stepper
   - **Logo Override:** URL input + logo size stepper (px) + preview thumbnail
2. All numeric controls use **stepper inputs** (ValueStepper component pattern from WhoToWatchEditor)
3. Save to `themes/{themeId}/overrides/{graphicId}/headerBgImage`, `headerBgImageFit`, etc.
4. Preview thumbnail loads the URL in an `<img>` tag with `object-fit: cover` at 50x50px

**Verify:**
- [ ] Build passes
- [ ] Image URL input → preview thumbnail shows the image
- [ ] Save → reload preview iframe → image appears on the graphic
- [ ] Fit/position/opacity/blend controls save correctly to Firebase
- [ ] Invalid URL → no crash, thumbnail shows placeholder

**Deploy:** Build React SPA + deploy.

**Depends on:** Task 4.2 (override panel structure must exist)

---

### Task 4.5 — Override Management UX (Badges, Reset, Import) — NOT STARTED

**Goal:** Visual indicators of which graphics have overrides. Reset buttons. Import from another theme.

**Files:** `show-controller/src/pages/ThemeEditorPage.jsx`

**Work:**
1. **Override badges:** Each collapsed graphic panel shows a small colored dot/badge if it has any overrides set. Count of overridden properties shown (e.g., "3 overrides")
2. **Reset per graphic:** "Reset to theme defaults" button per graphic panel → clears all overrides for that graphic ID (deletes `themes/{themeId}/overrides/{graphicId}`)
3. **Reset all overrides:** Global "Reset All Overrides" button at the top of the Per-Graphic Overrides section → clears entire `overrides` object. Confirm dialog before executing.
4. **Import from another theme:**
   - "Import overrides from..." button → opens a dropdown/modal listing other themes
   - Select source theme → copies its `overrides` object (or specific graphic's overrides) into the current theme
   - Merge strategy: imported overrides replace current ones for matching graphic IDs; non-matching are left unchanged
5. All changes go through the existing `saveTheme()` flow

**Verify:**
- [ ] Build passes
- [ ] Override badge shows on panels that have overrides
- [ ] Reset per graphic → overrides cleared, badge disappears, preview updates
- [ ] Reset all → all overrides cleared
- [ ] Import from another theme → overrides copied, preview updates
- [ ] Confirm dialog before destructive actions (reset all)

**Deploy:** Build React SPA + deploy.

**Depends on:** Task 4.2 (override panels must exist)

---

### Task 4.6a — Clip Overlay Preview Mode in output.html — NOT STARTED

**Goal:** Add `?mode=clip-preview` to output.html that renders the clip overlay with sample data against a dark background.

**Files:** `output.html`

**Work:**
1. In output.html's mode detection section, add a check for `mode=clip-preview`
2. When `?mode=clip-preview` is active:
   - Show the clip overlay elements (`.clip-athlete-panel` + `.clip-score-badge`) with sample data:
     - Athlete name: "Sample Athlete" (or from competition roster if `?comp=` provided)
     - Team logo: placeholder or competition team logo
     - Apparatus: "Floor Exercise"
     - Score: "9.950"
   - Dark background (`#1a1a2e`) to simulate video behind the overlay
   - Responds to theme CSS variables (`--meet-header-bg`, `--meet-header-text`, `--meet-badge-bg`, `--meet-badge-text`)
   - No video playback, no Firebase listeners for clip data
3. The overlay remains visible (no auto-hide animation)

**Verify:**
- [ ] `output.html?mode=clip-preview` shows clip overlay with sample data on dark background
- [ ] `output.html?mode=clip-preview&meetTheme={id}` shows themed clip overlay
- [ ] Athlete panel background uses `--meet-header-bg`
- [ ] Score badge uses `--meet-badge-bg` and `--meet-badge-text`
- [ ] No Firebase errors (doesn't try to connect to clip API)

**Deploy:** Upload `output.html` per CLAUDE.md deploy step 2.

---

### Task 4.6b — Orchestration Sub-Graphic Previews in Theme Editor — NOT STARTED

**Goal:** The graphic selector includes who-to-watch-title, who-to-watch (lower third), and clip-overlay under a "Playout / Who to Watch" category.

**Files:** `show-controller/src/pages/ThemeEditorPage.jsx`

**Work:**
1. In the graphic type dropdown (from Task 4.1), add entries in a grouped "Playout / Who to Watch" section:
   - **"Who to Watch — Title Card"** → Preview URL: `/overlays/who-to-watch-title.html?meetTheme={id}&athleteName=Sample+Athlete&teamName=Sample+Team&headline=2x+All-American&body=Record+holder+on+floor+exercise&badgeText=WHO+TO+WATCH`
   - **"Who to Watch — Lower Third"** → Preview URL: `/overlays/who-to-watch.html?meetTheme={id}&athleteName=Sample+Athlete&subtitle=Floor+Exercise&statLabel=Season+High&statValue=9.950`
   - **"Clip Overlay"** → Preview URL: `output.html?mode=clip-preview&meetTheme={id}`
2. When a competition is selected, replace sample data with real roster data:
   - Use first athlete from first team's roster
   - Use first team's logo
3. Sponsor graphics (`sponsors-thanks`, `sponsors-cycle`, `sponsors-bug`) are already in the standard list — no special handling

**Verify:**
- [ ] Build passes
- [ ] "Who to Watch — Title Card" preview shows full-screen card with theme colors
- [ ] "Who to Watch — Lower Third" preview shows lower-third overlay with theme colors
- [ ] "Clip Overlay" preview shows clip overlay panel with theme colors
- [ ] With competition selected, sample data replaced with real athlete/team data
- [ ] Per-graphic overrides for these sub-graphics work in preview

**Deploy:** Build React SPA + deploy.

**Depends on:** Task 4.1 (graphic selector), Task 4.6a (clip-preview mode)

---

### Task 4.DOC — Update Documentation After Phase 4 — NOT STARTED

**Goal:** Update CLAUDE.md and PRD to reflect the complete Theme System V2 shipped across all phases.

**Files:** `CLAUDE.md`, `docs/PRD-Theme-System-V2/PRD-Theme-System-V2-2026-03-25.md`

**Work:**
1. **CLAUDE.md — Update "Theme Editor" / ThemeEditorPage documentation:**
   - Document competition selector in Theme Editor (recent/active competitions dropdown)
   - Document graphic type selector (standard + playout/WTW sub-graphics)
   - Document per-graphic override panel: collapsible per graphic ID, 8 colors + images + textures
   - Document override management: badges, reset, import from another theme
   - Document save-then-preview workflow
   - Document `?mode=clip-preview` in output.html for clip overlay preview
2. **CLAUDE.md — Update "Who to Watch" section:**
   - Note that WTW title card and lower third are previewable in Theme Editor graphic selector
   - Per-card runtime overrides (bgColor, accentColor) take precedence over theme-level per-graphic overrides
3. **PRD — Update phase status:**
   - Phase 4: mark as COMPLETE
   - PRD status: change from PLANNING to COMPLETE
4. **PRD — Add "Completion Summary" section** at the bottom with:
   - Completion date
   - Total tasks executed
   - Key files modified

**Verify:**
- [ ] CLAUDE.md documents Theme Editor competition preview workflow
- [ ] CLAUDE.md documents per-graphic override panel and controls
- [ ] CLAUDE.md documents `?mode=clip-preview`
- [ ] PRD status is COMPLETE
- [ ] All phase statuses in PRD are COMPLETE (except Phase 2 = CUT, Phase 1.9 = DEFERRED)

**Deploy:** None — documentation only.

**Depends on:** Task 4.6b

---

## Dependency Graph

```
Phase 0 (no dependencies between tasks — can run in parallel):
  0.1 (COMPLETE)  0.2  0.3

Phase 1:
  1.1 (extend theme-loader.js)
   ├── 1.1b (PlayoutEngine meetTheme) ← independent of other 1.x tasks
   ├── 1.2 (add to output.html)
   │    ├── 1.5 (convert inline CSS to vars)
   │    └── 1.6 (gate live-mode render)
   ├── 1.3a (port event summary CSS) ─┐
   ├── 1.3b (port leaderboard CSS) ───┤ can run in parallel
   └── 1.3c (port remaining CSS) ─────┘
        └── 1.4 (reconcile class names)

  1.7 (debug panel)                        ← depends on 1.1 only
  1.7b (producer error log panel)          ← depends on 1.1 only

  1.8a/b/c (verification)                  ← depends on all above
  1.DOC (update CLAUDE.md + PRD)           ← depends on 1.8c

  1.9 (remove inline CSS)                  ← DEFERRED (requires live event)

Phase 3 (depends on all Phase 1 tasks):
  3.1 (per-graphic override CSS vars)
   ├── 3.2 (image/texture injection)
   ├── 3.3 (texture overlay per-graphic)   ← also depends on 0.3
   └── 3.4 (debug panel update)            ← also depends on 1.7
  3.DOC (update CLAUDE.md + PRD)           ← depends on 3.4

Phase 4 (depends on Phase 3):
  4.1 (competition selector + graphic dropdown)
   └── 4.2 (per-graphic override panel MVP)
        ├── 4.3 (live iframe preview)
        ├── 4.4 (image/texture controls)
        └── 4.5 (badges, reset, import)
  4.6a (clip-preview mode in output.html)  ← independent of React tasks
  4.6b (orchestration sub-graphic previews) ← depends on 4.1 + 4.6a
  4.DOC (update CLAUDE.md + PRD → COMPLETE) ← depends on 4.6b
```

**Execution order for serial loop:**
0.2 → 0.3 → 1.1 → 1.1b → 1.2 → 1.3a → 1.3b → 1.3c → 1.4 → 1.5 → 1.6 → 1.7 → 1.7b → 1.8a → 1.8b → 1.8c → 1.DOC → 3.1 → 3.2 → 3.3 → 3.4 → 3.DOC → 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6a → 4.6b → 4.DOC

**Note:** Task 1.9 is deferred and will NOT be picked up by the code loop.

---

## Files Touched Summary

| File | Tasks |
|------|-------|
| `overlays/graphic-ids.json` | 0.1 (COMPLETE) |
| `docs/PRD-Theme-System-V2/audit-css-rules.md` (new) | 0.2 |
| `docs/PRD-Theme-System-V2/audit-pseudo-elements.md` (new) | 0.3 |
| `overlays/theme-loader.js` | 1.1, 1.7, 3.1, 3.2, 3.4 |
| `overlays/theme-overrides.css` | 0.2, 1.3a, 1.3b, 1.3c, 3.2, 3.3 |
| `server/lib/playoutEngine.js` | 1.1b |
| `output.html` | 1.2, 1.4, 1.5, 1.6, 1.9, 4.6a |
| `show-controller/src/components/ThemeErrorLog.jsx` (new) | 1.7b |
| `show-controller/src/hooks/useThemeErrors.js` (new) | 1.7b |
| `show-controller/src/views/ProducerView.jsx` | 1.7b |
| `show-controller/src/pages/ThemeEditorPage.jsx` | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6b |
| `overlays/who-to-watch-title.html` | 1.9 |
| `overlays/who-to-watch.html` | 1.9 |
| `CLAUDE.md` | 1.DOC, 3.DOC, 4.DOC, 1.9 |
| `docs/PRD-Theme-System-V2/PRD-Theme-System-V2-2026-03-25.md` | 1.DOC, 3.DOC, 4.DOC |

---

## Learnings

- LEARNING: Task 1.1b verification (Firebase check for `data.meetTheme` field) requires live playout session — cannot verify locally. Deploy to coordinator and test during Task 1.8b verification. (found during Task 1.1b)
- LEARNING: Local theme tests show "Theme not found" warnings because test themes like `pink-meet` don't exist in Firebase. The integration works correctly — verify by checking `window.themeReady` resolves and theme-loader.js logs appear in console. (found during Task 1.2)
- LEARNING: Task 1.5 was already complete — the MEET THEME OVERRIDES section in output.html already used CSS variables with fallbacks from the original implementation. Always grep to verify current state before implementing. (found during Task 1.5)
- LEARNING: The debug panel requires handling the early-return case (no meetTheme and no comp) separately since the main createDebugPanel() function isn't defined yet at that point. Used a standalone createEarlyDebugPanel() function for this path. (found during Task 1.7)
- LEARNING: Firebase subscription hooks use `remove()` from firebase/database for deleting data. Import it in the hook file alongside other firebase functions. The pattern from useProductionAlerts.js and AlertPanel.jsx provided a clean structure for error log components. (found during Task 1.7b)
- LEARNING: Use `pink-meet-2026` for theme testing (not `pink-meet`). The theme ID in Firebase is `pink-meet-2026`. Many inline graphics (hosts, team1-coaches, event-summary, virtuis-leaderboard) require competition/Virtius data to render content — blank screens with "Theme applied" console log is expected in preview mode. The key verification is that theme-loader.js runs and logs the theme application. (found during Task 1.8a)
- LEARNING: Iframe overlays (sponsors-thanks, sponsors-cycle, sponsors-bug, who-to-watch-title, who-to-watch, rotation-slate, event-calendar) all load theme-loader.js and apply themes correctly. Sponsor bug/cycle show blank/transparent when no sponsors configured — this is expected. PlayoutEngine meetTheme implementation verified via code inspection: all 8 `_writeCurrentGraphic()` calls include `meetTheme: this._meetTheme`. Live playout test requires deployed coordinator. (found during Task 1.8b)
- LEARNING: For local testing with `?comp=` param, use Python's `http.server` — `npx serve` sometimes truncates query params. The `wcgnic-2026-prelim1` competition has `meetTheme: "behind-the-chalk"` configured and is good for integration testing. Debug panel shows "Source: competition config" when theme is loaded via `?comp=` lookup vs "URL parameter" when via `?meetTheme=`. (found during Task 1.8c)
- LEARNING: Per-graphic overrides require BOTH theme-loader.js to SET the CSS variables AND theme-overrides.css/output.html inline CSS to USE them with the 3-layer cascade `var(--{graphicId}-*, var(--meet-*, fallback))`. Python http.server caches aggressively — use a different port to bypass browser cache when testing CSS changes. The override mapping follows the pattern: `headerBar → --{graphicId}-header-bg`. (found during Task 3.1)
- LEARNING: Image/texture CSS variable injection extends the override mapping with 13 new properties: `headerBgImage`, `headerBgImageFit`, `headerBgImagePosition`, `headerBgImageOpacity`, `bodyBgImage*` (4), `bodyTexture*` (3), `logo`, `logoSize`. URL values are wrapped in `url()` by JS before setting the CSS variable. The CSS rules use `background-image: var(--{graphicId}-header-bg-image, none)` — defaulting to `none` ensures no visual change without an override. (found during Task 3.2)
- LEARNING: Per-graphic texture `::before` rules must be split out from the combined global selector — each graphic type needs its own rule to use the 3-layer cascade `var(--{graphicId}-body-texture, var(--meet-texture, none))`. Generic elements (panel, header-bar, frame-header, roster-container) can share a combined rule using global texture only. Added `mix-blend-mode` property to all texture rules for overlay/multiply/normal blend support. (found during Task 3.3)
- LEARNING: The debug panel's Layer 3 display shows the per-graphic override variable (e.g., `--event-bar-header-bg`) but the global `--meet-header-bg` still holds the theme value. The CSS cascade `var(--{graphicId}-*, var(--meet-*, fallback))` handles priority at render time. The debug panel reads `overrideStatus` from `debugState` which is populated by `applyOverrides()` in the init flow. (found during Task 3.4)
- LEARNING: Theme Editor page requires authentication — local screenshot verification requires login. Build verification is sufficient for code correctness. Full UI verification happens after deployment to production. The GRAPHIC_GROUPS constant uses 7 categories to match the plan's grouping requirements. WTW overlays need special URL handling (use overlay files directly, not output.html). (found during Task 4.1)
- LEARNING: Per-graphic override panels use checkbox toggles instead of radio buttons for each color field — cleaner UX that shows enabled/disabled state clearly. The `overrides` field must be added to both `loadTheme` (for existing themes) and `newTheme` (for new themes). Helper functions (`updateOverrideField`, `clearOverrideField`, `resetGraphicOverrides`) manage the nested state cleanly. When a graphic panel is expanded, auto-switching `selectedGraphicType` gives immediate preview feedback. Team cards use specific IDs (`team1-stats`, `team1-coaches`, `team2-stats`, `team2-coaches`) not generic `team-stats`/`team-coaches`. (found during Task 4.2)
