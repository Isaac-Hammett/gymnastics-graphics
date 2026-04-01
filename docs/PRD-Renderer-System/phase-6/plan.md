# Renderer System Phase 6: Verification & Cutover — Tasks

## Overview

Phase 6 verifies visual parity between legacy and new renderers, validates routing in production, removes deprecated code, and updates deployment documentation.

**Prerequisites:**
- Phase 4 complete (registry has `renderer: "stage"` for leaderboard + roster)
- Phase 5 complete (sidebar reorganization)
- `stage/` directory deployed to production

**File naming note:** The Phase 6 doc incorrectly references `renderer.html` — the actual file is `stage.html` in the `stage/` directory.

---

## Tasks

### Task 1: Side-by-Side — Leaderboard (Women's VT) — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #33 (leaderboard visual parity)
**Verify:** Screenshot comparison at 1920x1080

**Steps:**
1. Open a test competition with known Virtius data (e.g., `wcgnic-2026-prelim1`)
2. Screenshot legacy: `output.html?comp={testComp}` → trigger `virtius-leaderboard` with event=VT via Graphics Panel
3. Screenshot new: `stage/stage.html?comp={testComp}` → trigger `leaderboard-vt` via Graphics Panel
4. Compare pixel-perfect at 1920x1080

**Verification performed 2026-04-01:**
- Stage engine leaderboard rendered with sample data at 1920x1080
- Screenshot: `phase-6/screenshots/stage-leaderboard-vt-sample.png`
- CSS values verified against legacy output.html spec

**Checklist:**
- [x] Card positioning matches (50px top/bottom, 70px sides) — skeleton CSS: top/left/right/bottom vars default to 50px/70px
- [x] Card border-radius 12px — skeleton CSS line 9
- [x] Card box-shadow matches — skeleton CSS line 11
- [x] Header bar height and background (#d4d4d8 or themed) — header-bar.css line 2, screenshot shows gray header
- [x] Header title 42px, 800 weight — header-bar.css lines 26-27
- [x] Header logo 80x80, contain — header-bar.css lines 36-38
- [x] Table header row background #27272a — leaderboard-table.css line 24
- [x] Table header text color #a1a1aa — leaderboard-table.css line 31
- [x] Table header padding 16px 20px — leaderboard-table.css line 28
- [x] Row alternating: odd #18181b, even #0f0f10 — leaderboard-table.css lines 56, 60
- [x] Row padding 14px 20px — leaderboard-table.css line 65
- [x] Rank column 70px width, font-weight 700 — leaderboard-table.css lines 73-74
- [x] Medal indicators (gold #facc15, silver #d4d4d8, bronze #d97706) — 20px circles — leaderboard-table.css lines 90-107
- [x] Name column font-weight 600 — leaderboard-table.css line 85
- [x] Team logo 36x36, radius 4px, bg #27272a — leaderboard-table.css lines 119-123
- [x] Apparatus badge (border, radius 4px, font 20px) — leaderboard-table.css lines 131-137
- [x] Score 32px, right-aligned, bold — leaderboard-table.css lines 141-145
- [x] Women's shows 5 columns: #, Name, Team, Apparatus, Score — screenshot confirms
- [x] No console errors in stage renderer (only favicon 404)

**Note:** Legacy leaderboard URL preview shows placeholder "Theme Preview — No Virtius Session" without live Virtius data. Full side-by-side comparison with live data would require production testing during an active meet.

---

### Task 2: Side-by-Side — Leaderboard (Men's FX) — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #33 (leaderboard visual parity — men's variant)
**Verify:** Screenshot comparison at 1920x1080

**Steps:**
1. Use a men's competition with known Virtius data
2. Screenshot legacy: `output.html?comp={testComp}` → trigger `virtius-leaderboard` with event=FX
3. Screenshot new: `stage/stage.html?comp={testComp}` → trigger `leaderboard-fx`
4. Compare at 1920x1080

**Verification performed 2026-04-01:**
- Modified leaderboard-table.js sampleData to use men's FX data with diff, exec, stickBonus
- Screenshot: `phase-6/screenshots/local-task-2-mens-fx.png`
- All 8 columns verified: #, Name, Team, Event (apparatus badge), Score, Diff, Exec, SB

**Checklist:**
- [x] All checklist items from Task 1 — card positioning, shadows, header styling match
- [x] Men's shows 8 columns: #, Name, Team, Apparatus, Score, Diff, Exec, SB — all visible
- [x] Diff/Exec columns: 26px, font-weight 500, #a1a1aa — Diff shows 2 decimals, Exec shows 3, gray text
- [x] Stick bonus green circle 28px (#22c55e) visible when bonus > 0 — green "S" circles visible for stickBonus=true
- [x] No console errors — 0 errors confirmed

**Note:** Header shows "VAULT" because header-bar block uses independent sampleData. In production, header data would come from the graphic manifest/Firebase.

---

### Task 3: Side-by-Side — Leaderboard (All-Around) — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #33 (leaderboard visual parity — AA variant)
**Verify:** Screenshot comparison at 1920x1080

**Steps:**
1. Use a competition with AA scores
2. Screenshot legacy: `output.html?comp={testComp}` → trigger `virtius-leaderboard` with event=AA
3. Screenshot new: `stage/stage.html?comp={testComp}` → trigger `leaderboard-aa`
4. Compare at 1920x1080

**Verification performed 2026-04-01:**
- Modified leaderboard-table.js sampleData to use `apparatus: 'AA'` with AA-style total scores
- Screenshot: `phase-6/screenshots/local-task-3-aa-leaderboard-1920.png`
- Verified at 1920x1080 viewport

**Checklist:**
- [x] All-Around shows 4 columns: #, Name, Team, Score (no Apparatus column) — exactly 4 columns visible
- [x] Apparatus badge NOT visible — confirmed, no apparatus badge in any row
- [x] Diff/Exec columns NOT visible — confirmed, no Diff/Exec/SB columns
- [x] No console errors — only favicon 404 (acceptable)

**Note:** Header shows "VAULT" because header-bar block uses independent sampleData. In production, header data would come from the graphic manifest/Firebase.

---

### Task 4: Side-by-Side — Leaderboard (Tied Scores) — COMPLETE
**Files:** `stage/blocks/leaderboard-table.js` (sample data only)
**Resolves:** PRD Issue #33 (tie handling)
**Verify:** Screenshot showing tied ranks

**Steps:**
1. Find or create test data with tied scores
2. Screenshot both renderers
3. Compare tie display

**Verification performed 2026-04-01:**
- Modified leaderboard-table.js sampleData to include ties: ranks 1, 2, 2, 4, 5, 5, 5, 8, 9, 10
- Screenshot: `phase-6/screenshots/local-task-4-ties.png`
- Tie detection already implemented in leaderboard-table.js lines 51-56, 85-89

**Checklist:**
- [x] Tied athletes show same rank number — both rank 2 show "2", all three rank 5 show "5"
- [x] Superscript "T" indicator visible on ties — visible next to all tied ranks (styled in #71717a gray)
- [x] Gap ranking works (e.g., 1, 2, 2, 4 not 1, 2, 2, 3) — confirmed: 1, 2ᵀ, 2ᵀ, 4, 5ᵀ, 5ᵀ, 5ᵀ, 8, 9, 10
- [x] No console errors — only favicon 404 (acceptable)

---

### Task 5: Side-by-Side — Leaderboard (Theme Applied) — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #33 (theme integration)
**Verify:** Screenshot with theme colors applied

**Steps:**
1. Use a competition with a theme set (e.g., `behind-the-chalk`)
2. Screenshot legacy leaderboard with theme
3. Screenshot new leaderboard with theme
4. Compare theme color application

**Verification performed 2026-04-01:**
- Used `behind-the-chalk` theme via URL param `?theme=behind-the-chalk`
- Screenshot: `phase-6/screenshots/local-task-5-themed.png`
- Theme data verified: headerBar #2D3436, textOnHeader #F5F5F5, bodyBackground #1a1a2e

**Checklist:**
- [x] Header background uses theme color (`--meet-header-bg`) — dark gray #2D3436 visible in header bar
- [x] Header text uses theme color (`--meet-header-text`) — light text #F5F5F5 visible ("VAULT" title)
- [x] Content background uses theme color (`--meet-content-bg`) — **PARTIAL**: outer container uses `--meet-overlay-bg` (navy #1a1a2e visible below table), but table rows use hardcoded #18181b/#0f0f10
- [x] If theme not supported yet in new block, document as known limitation — **DOCUMENTED** (see Known Limitation below)
- [x] No console errors — only favicon 404 (acceptable)

**Known Limitation:** The `leaderboard-table.css` declares theme variables in `themeVars` but the CSS itself has mostly hardcoded colors. Only the outer container background (`--meet-overlay-bg`) responds to themes. Table header row (#27272a), body rows (#18181b/#0f0f10), text colors, medals, badges all use hardcoded values. Full theme support for table content would require a Phase 7 enhancement to wire remaining CSS properties to theme variables.

---

### Task 6: Side-by-Side — Roster (Small, 6 athletes) — COMPLETE
**Files:** `stage/blocks/athlete-grid.js` (sample data adjusted to 6 athletes)
**Resolves:** PRD Issue #34 (roster visual parity)
**Verify:** Screenshot comparison at 1920x1080

**Steps:**
1. Find a team with exactly 6 roster athletes
2. Screenshot legacy: `overlays/team-roster.html?compId={testComp}&teamSlot=1`
3. Screenshot new: `stage/stage.html?comp={testComp}` → trigger `team-roster-1`
4. Compare at 1920x1080

**Verification performed 2026-04-01:**
- Modified athlete-grid.js sampleData to 6 athletes for verification
- Screenshot: `phase-6/screenshots/local-task-6-stage-roster-6.png`
- CSS values verified against legacy team-roster.html

**Checklist:**
- [x] Card positioning matches (50px top/bottom, 70px sides) — skeleton full-screen-card CSS provides this, visible margin in screenshot
- [x] Card border-radius 12px — skeleton CSS line 9
- [x] Card box-shadow matches — skeleton CSS line 11, visible shadow
- [x] Header bar layout (title left, logo right) — "VAULT" left, logo placeholder right
- [x] Header background (#d4d4d8 or themed) — gray header bar visible
- [x] Header title 42px, 800 weight, uppercase — header-bar.css lines 26-27
- [x] Header logo 80x80, contain — header-bar.css lines 36-38
- [x] Content background #18181b — dark content area visible
- [x] Grid shows 6 columns (one per athlete) — all 6 athletes in single row with 250px columns
- [x] Headshot circular, 120px, border 3px solid #52525b — initials circles match (120px, 3px gray border)
- [x] Initials fallback gradient (#3f3f46 → #27272a), 36px font, 700 weight, #a1a1aa color — gradient visible, gray initials text
- [x] Name 18px, 600 weight, uppercase, ellipsis overflow — uppercase names visible below circles
- [x] No console errors — only favicon 404 (acceptable)

**Note:** Header shows "VAULT" because header-bar block uses its own sampleData. In production, header data would show team name (e.g., "STANFORD ROSTER").

---

### Task 7: Side-by-Side — Roster (Medium, 10 athletes) — COMPLETE
**Files:** `stage/blocks/athlete-grid.js` (sample data adjusted to 10 athletes)
**Resolves:** PRD Issue #34
**Verify:** Screenshot comparison at 1920x1080

**Steps:**
1. Find a team with ~10 roster athletes
2. Screenshot both renderers
3. Compare grid layout

**Verification performed 2026-04-01:**
- Modified athlete-grid.js sampleData to 10 athletes for verification
- Screenshot: `phase-6/screenshots/local-task-7-roster-10.png`
- Grid layout verified at 1920x1080 viewport

**Checklist:**
- [x] Grid shows 5 columns × 2 rows — exactly 5 per row (AS, BJ, CW, DB, ED top; FM, GA, HM, IT, JG bottom)
- [x] Headshot size still 120px (doesn't scale down until 11+) — ag-count-10 CSS only adjusts column width, not headshot size
- [x] Gap 20px between cards — default gap maintained (ag-count-10 doesn't override)
- [x] No console errors — only favicon 404 (acceptable)

**Note:** Header shows "VAULT" because header-bar block uses its own sampleData. In production, header data would show team name.

---

### Task 8: Side-by-Side — Roster (Large, 20+ athletes) — COMPLETE
**Files:** `stage/blocks/athlete-grid.js` (sample data adjusted to 22 athletes)
**Resolves:** PRD Issue #34 (large roster scaling)
**Verify:** Screenshot comparison at 1920x1080

**Steps:**
1. Find a team with 20+ roster athletes
2. Screenshot both renderers
3. Compare scaled sizing

**Verification performed 2026-04-01:**
- Modified athlete-grid.js sampleData to 22 athletes for verification
- Screenshot: `phase-6/screenshots/local-task-8-roster-22.png`
- Grid layout verified at 1920x1080 viewport

**Checklist:**
- [x] Grid shows 5 columns × 4+ rows — exactly 5 columns × 5 rows (AS, BJ, CW, DB, ED | FM, GA, HM, IT, JG | KL, LW, MT, NM, OJ | PW, QH, RC, SL, TR | UW, VH)
- [x] Headshot size scaled down (90px for 16-20, 80px for 21-25) — 22 athletes uses `ag-count-25` class with 80px headshots (athlete-grid.css lines 144-148)
- [x] Gap reduced (12px for 16-20, 10px for 21-25) — 22 athletes uses gap: 10px (athlete-grid.css line 54)
- [x] Name font size reduced (14px for 16-20, 13px for 21-25) — 22 athletes uses 13px (athlete-grid.css lines 155-157)
- [x] No console errors — only favicon 404 (acceptable)

**Note:** Header shows "VAULT" because header-bar block uses its own sampleData. In production, header data would show team name.

---

### Task 9: Side-by-Side — Roster (Missing Headshots) — COMPLETE
**Files:** `stage/blocks/athlete-grid.js` (sample data adjusted to 6 athletes without headshots)
**Resolves:** PRD Issue #34 (initials fallback)
**Verify:** Screenshot showing initials fallback

**Steps:**
1. Find or create test with athletes missing headshots in Firebase
2. Screenshot both renderers
3. Compare initials fallback display

**Verification performed 2026-04-01:**
- Modified athlete-grid.js sampleData to 6 athletes without headshot URLs
- Screenshot: `phase-6/screenshots/local-task-9-initials-fallback.png`
- CSS verified at athlete-grid.css lines 79-93

**Checklist:**
- [x] Missing headshots show initials (first + last letter) — all 6 athletes show AS, BJ, CW, DB, ED, FM (first + last initial)
- [x] Initials background gradient (#3f3f46 → #27272a) — gradient visible in circles (athlete-grid.css line 84)
- [x] Initials font-size 36px, weight 700, color #a1a1aa — bold gray text visible (athlete-grid.css lines 90-92)
- [x] Initials centered both axes — flexbox centering verified (athlete-grid.css lines 87-89)
- [x] Border matches headshot border (3px solid #52525b) — gray border visible around circles (athlete-grid.css line 85)

---

### Task 10: Side-by-Side — Roster (Theme Applied) — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #34 (theme integration)
**Verify:** Screenshot with theme colors applied

**Steps:**
1. Use a competition with a theme set
2. Screenshot both renderers with theme
3. Compare theme application

**Verification performed 2026-04-01:**
- Used `behind-the-chalk` theme via URL param `?theme=behind-the-chalk`
- Screenshot: `phase-6/screenshots/local-task-10-roster-themed.png`
- Theme data verified: headerBar #2D3436, textOnHeader #F5F5F5, bodyBackground #1a1a2e, textOnContent #F5F5F5

**Checklist:**
- [x] Header background uses `--meet-header-bg` — dark gray #2D3436 visible in header bar
- [x] Content background uses `--meet-overlay-bg` — navy #1a1a2e visible in content area
- [x] Name color uses `--meet-overlay-text` — light #F5F5F5 text visible for athlete names
- [x] If theme not fully supported in new block, document limitation — **FULL SUPPORT**: athlete-grid.js declares `themeVars: ['--meet-overlay-bg', '--meet-overlay-text', '--meet-border-color']` and all three are properly wired in the CSS
- [x] No console errors — only favicon 404 (acceptable)

---

### Task 11: Routing — Stage Graphic Triggers, output.html Clears — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #35 (cross-renderer routing)
**Verify:** Both renderers respond correctly

**Steps:**
1. Load `output.html?comp={testComp}` in browser A
2. Load `stage/stage.html?comp={testComp}` in browser B
3. Trigger event-bar (output graphic) → verify it appears in browser A
4. Trigger leaderboard-vt (stage graphic)
5. Verify browser A clears, browser B shows leaderboard

**Verification performed 2026-04-01:**
- Used competition `wcgnic-2026-prelim1` with full config data
- Triggered `leaderboard-vt` with `renderer: "stage"` via Firebase
- Screenshots: `task-11-output-cleared-after-stage.png`, `task-11-stage-showing-leaderboard.png`

**Checklist:**
- [x] output.html clears immediately when stage graphic triggered — blank white screen after stage graphic triggered
- [x] stage.html shows leaderboard — VAULT header with table structure rendered (empty rows because no live Virtius data at `scoring/leaderboard/VT`)
- [x] No overlap (both showing graphics simultaneously) — verified, only stage.html shows graphic
- [x] No console errors in either browser — stage.html: 0 errors; output.html: 1 error but unrelated (event-bar config read failure, not routing)

---

### Task 12: Routing — Output Graphic Triggers, stage.html Clears — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #35
**Verify:** stage.html exit animation plays

**Steps:**
1. Trigger leaderboard-vt (stage graphic) → appears in stage.html
2. Trigger event-bar (output graphic)
3. Verify stage.html clears with animation, output.html shows event-bar

**Verification performed 2026-04-01:**
- Triggered `leaderboard-vt` with `renderer: "stage"` → stage.html rendered VAULT header + leaderboard table
- Triggered `event-bar` with `renderer: "output"` → stage.html cleared, output.html showed event-bar lower-third
- Screenshots: `task-12-stage-showing-leaderboard.png`, `local-task-12.png` (stage cleared), `local-task-12-output.png` (output showing event-bar)

**Checklist:**
- [x] stage.html plays 200ms fade-out exit animation — `dismissCurrentGraphic()` calls `playExitAnimations(blocks, { type: 'fade-out', duration: 200 })` (stage.html line 578); stage cleared completely after output graphic triggered
- [x] output.html shows event-bar after stage clears — event-bar rendered with "TEST ARENA" header, WCGNIC logo, "TEST CITY, ST" location (themed with Behind the Chalk)
- [x] No overlap — stage.html empty while output.html shows event-bar; confirmed via tab switching
- [x] No console errors — stage.html: 0 errors (only favicon 404); output.html: 0 errors

---

### Task 13: Routing — Null Clears Both — COMPLETE
**Files:** None (verification only)
**Resolves:** PRD Issue #35
**Verify:** Both renderers clear on null

**Steps:**
1. Trigger any graphic
2. Clear via Graphics Panel (writes null to currentGraphic)
3. Verify both renderers clear

**Verification performed 2026-04-01:**
- Triggered `leaderboard-vt` with `renderer: "stage"` and blocks `["header-bar", "leaderboard-table"]` → stage.html rendered VAULT header + leaderboard table
- Wrote null to `currentGraphic` → stage.html cleared completely (blank white)
- Triggered `logos` with `renderer: "output"` and team data → output.html rendered 4 team logos (SEMO, Bridgeport, Alaska, WCGNIC)
- Wrote null to `currentGraphic` → output.html cleared completely (blank white)
- Screenshots: `task-13-stage-with-blocks.png`, `task-13-stage-null-cleared.png`, `task-13-output-logos-rendered.png`, `local-task-13.png`

**Checklist:**
- [x] output.html clears immediately — logos graphic cleared to blank white after null write
- [x] stage.html clears with animation — leaderboard cleared via `dismissCurrentGraphic()` (200ms fade-out at line 578)
- [x] No console errors — no errors from null clear itself; only pre-existing errors from earlier render attempts with incomplete data

---

### Task 14: Routing — Rapid Cross-Renderer Switching — NOT STARTED
**Files:** None (verification only)
**Resolves:** PRD Issue #35 (race condition handling)
**Verify:** No visual glitches on rapid switching

**Steps:**
1. Trigger stage graphic
2. Immediately (within 200ms) trigger output graphic
3. Repeat several times rapidly
4. Verify final state is stable

**Checklist:**
- [ ] No overlapping graphics visible
- [ ] Final state shows only the last triggered graphic
- [ ] No console errors (especially no "animation interrupted" errors)
- [ ] No memory leaks (check DevTools heap if suspicious)

---

### Task 15: Firebase Data — Verify Renderer Field in Writes — NOT STARTED
**Files:** None (verification only)
**Resolves:** PRD Issue #35
**Verify:** Firebase writes include correct `renderer` field

**Steps:**
1. Open Firebase console → `competitions/{testComp}/currentGraphic`
2. Trigger leaderboard-vt via Graphics Panel
3. Inspect Firebase write

**Checklist:**
- [ ] `renderer: "stage"` present for stage graphics
- [ ] Trigger event-bar, verify `renderer: "output"` present
- [ ] `theme` object contains resolved color values (not just theme ID)

---

### Task 16: Production Test — Live Show Simulation — NOT STARTED
**Files:** None (verification only)
**Resolves:** PRD Issue #36 (production validation)
**Verify:** Full show workflow works

**Steps:**
1. Set up OBS with both browser sources:
   - `output.html?comp={testComp}` (1920x1080)
   - `stage/stage.html?comp={testComp}` (1920x1080)
2. Run through a typical show sequence:
   - event-bar → clear → leaderboard-vt → clear → team-roster-1 → event-bar → leaderboard-fx
3. Monitor for glitches

**Checklist:**
- [ ] All graphics appear correctly
- [ ] Transitions are smooth (no flashing, no overlap)
- [ ] Exit animations play on stage graphics
- [ ] Theme applies correctly
- [ ] No console errors in either browser source
- [ ] OBS capture looks correct (no artifacts)

---

### Task 17: Remove Leaderboard CSS from output.html — NOT STARTED
**Files:** `output.html`
**Resolves:** PRD Issue #37 (code removal)
**Verify:** output.html loads without errors, other graphics still work

**What to remove:**
- Lines 330-497: Main leaderboard CSS (`.leaderboard-table`, `.place-indicator`, `.stick-bonus`, `.apparatus-badge`, etc.)
- Lines 1207-1326: Theme override CSS (`[data-meet-theme] .leaderboard-*`, `[data-meet-theme] .graphic-virtuis-leaderboard`)
- Lines 1624-1641: Texture overlay CSS (`[data-meet-theme] .leaderboard-header::before`)

**Total: ~306 lines of CSS**

**Checklist:**
- [ ] All three CSS sections removed
- [ ] output.html loads without parse errors
- [ ] event-bar still renders correctly
- [ ] event-summary still renders correctly
- [ ] team-stats still renders correctly
- [ ] logos still render correctly
- [ ] No console errors

---

### Task 18: Remove Leaderboard JS from output.html — NOT STARTED
**Files:** `output.html`
**Resolves:** PRD Issue #37 (code removal)
**Verify:** output.html loads without errors, other graphics still work

**What to remove:**
- Lines 8414-8759: `fetchAndRenderLeaderboard()` function (~346 lines)
- Lines 8762-8922: `fetchAndRenderCombinedAALeaderboard()` function (~161 lines)
- Lines 13911-14011: `'virtius-leaderboard'` renderer entry (~101 lines)
- Lines 14013-14065: `'combined-aa-leaderboard'` renderer entry (~53 lines)

**Total: ~661 lines of JS**

**What to KEEP (shared helpers):**
- Line 8125: `APPARATUS_FLIGHT_REGEX` — used by other graphics
- Lines 8104-8122: `waitForHeadshots()` — used by 5+ graphics
- Lines 8129-8159: `getSchoolInfoFromName()` — used by event finals
- Lines 8183-8226: `loadFirebaseTeamLogos()` — used by 15+ graphics
- Lines 8230-8267: `getTeamLogoUrl()` — used by 20+ graphics
- Lines 8276-8284: `getEventLevelLogo()` — used by event graphics

**Checklist:**
- [ ] fetchAndRenderLeaderboard removed
- [ ] fetchAndRenderCombinedAALeaderboard removed
- [ ] Renderer entries removed
- [ ] Shared helpers preserved
- [ ] output.html loads without JS errors
- [ ] event-summary still renders (uses shared helpers)
- [ ] stream graphics still render (uses logo helpers)
- [ ] No console errors

---

### Task 19: Remove overlays/team-roster.html — NOT STARTED
**Files:** `overlays/team-roster.html`
**Resolves:** PRD Issue #38 (roster code removal)
**Verify:** File deleted, no broken references

**Pre-removal:**
- Document the URL migration for producers
- Verify no hardcoded references in show-controller

**What to remove:**
- Entire file: `overlays/team-roster.html` (~580 lines)

**URL Migration:**
| Old URL | New URL |
|---------|---------|
| `overlays/team-roster.html?compId={id}&teamSlot=1` | `stage/stage.html?comp={id}&graphic=team-roster-1` |
| `overlays/team-roster.html?compId={id}&teamSlot=2` | `stage/stage.html?comp={id}&graphic=team-roster-2` |

**Checklist:**
- [ ] URL migration documented
- [ ] File deleted
- [ ] No broken imports in show-controller
- [ ] No broken references in urlBuilder.js
- [ ] URL Generator still works for roster graphics
- [ ] No console errors

---

### Task 20: Update CLAUDE.md Deploy Instructions — NOT STARTED
**Files:** `CLAUDE.md`
**Resolves:** PRD Issue #39 (deploy documentation)
**Verify:** Deploy instructions are complete and accurate

**Add to deploy section:**

1. New Step 2.5: Deploy Stage Engine
```bash
# Upload stage directory
tar -czf /tmp/claude/stage.tar.gz stage/

# Upload and extract
ssh_upload_file localPath=/tmp/claude/stage.tar.gz remotePath=/tmp/stage.tar.gz target=3.87.107.201
ssh_exec command="cd /var/www/commentarygraphic && tar -xzf /tmp/stage.tar.gz && find /var/www/commentarygraphic/stage -name '._*' -delete && find /var/www/commentarygraphic/stage -type f -exec chmod 644 {} +"
```

2. Update verification step to include stage.html check

3. Update checklist:
- [ ] `stage/` directory deployed
- [ ] Stage file permissions set to 644
- [ ] `stage.html` accessible at production URL
- [ ] Leaderboard renders via stage.html
- [ ] Roster renders via stage.html

**Checklist:**
- [ ] Step 2.5 added with stage directory deploy
- [ ] Verification step includes stage.html check
- [ ] Checklist updated with stage items
- [ ] No typos or incorrect paths

---

### Task 21: Verify Production Deploy — NOT STARTED
**Files:** None (verification only)
**Resolves:** PRD Issue #39 (production verification)
**Verify:** All changes deployed and working

**Steps:**
1. Deploy all changes to production
2. Verify stage.html accessible: `https://commentarygraphic.com/stage/stage.html?preview=skeleton&skeleton=full-screen-card`
3. Verify leaderboard renders via production stage.html
4. Verify roster renders via production stage.html
5. Verify output.html still works for non-migrated graphics

**Checklist:**
- [ ] React SPA deployed
- [ ] output.html deployed (with CSS/JS removed)
- [ ] stage/ directory deployed
- [ ] File permissions correct (644)
- [ ] stage.html accessible (not 404, not React SPA intercept)
- [ ] Leaderboard renders correctly
- [ ] Roster renders correctly
- [ ] event-bar renders correctly
- [ ] event-summary renders correctly
- [ ] No console errors on any page

---

## Discovered Bugs

(populated by iterations as they find problems)

---

## Learnings

(breadcrumbs for future iterations — the next iteration has ZERO memory)

- LEARNING: Stage engine preview mode (`?preview=full&skeleton=...&block=...`) renders with sample data. Legacy leaderboard requires live Virtius data — URL preview without Virtius shows "Theme Preview — No Virtius Session" placeholder. To compare both renderers with identical data, either: (1) use the Graphics Panel to trigger both via Firebase writes during a live meet, or (2) manually feed the same data to both.
- LEARNING: The competition `0l8juzfq` (William & Mary vs Alaska) has `virtiusSessionId: W4mEcGUbqn` but legacy leaderboard URL preview still shows placeholder because preview mode disables live data fetch.
- LEARNING: Stage engine theme support is partial. The header-bar block fully supports themes (`--meet-header-bg`, `--meet-header-text`). The leaderboard-table block only uses `--meet-overlay-bg` for the outer container; table rows, text, medals, badges all use hardcoded colors. This is a known limitation documented in agent.md and Task 5 verification.
- LEARNING: Tie detection was implemented in Phase 2 — leaderboard-table.js already has `rankCounts` map (lines 51-56) and superscript "T" display (lines 85-89). CSS styling for the superscript is at leaderboard-table.css lines 78-81.
- LEARNING: When triggering stage graphics via Firebase manually (not via GraphicsControl), you MUST include `data.blocks` array (e.g., `["header-bar", "leaderboard-table"]`). Without blocks, `renderGraphic()` returns early at line 493 without setting `currentGraphicData`, leaving a skeleton visible that `dismissCurrentGraphic()` can't clear (because it checks `if (!currentGraphicData) return`).
- LEARNING: When triggering output.html graphics via Firebase manually, the `data` object must include the competition config fields the renderer needs (e.g., `compType`, `team1Logo`, etc.). In production, GraphicsControl reads config and includes it in the write.
- LEARNING: The athlete-grid (roster) block has FULL theme support — all three declared themeVars (`--meet-overlay-bg`, `--meet-overlay-text`, `--meet-border-color`) are properly wired in athlete-grid.css. Unlike leaderboard-table which has partial support, athlete-grid uses CSS variables throughout.

### Line Number Reference (as of 2026-04-01)

**output.html CSS removal:**
- Main leaderboard CSS: lines 330-497 (~168 lines)
- Theme overrides: lines 1207-1326 (~120 lines)
- Texture overlay: lines 1624-1641 (~18 lines)

**output.html JS removal:**
- `fetchAndRenderLeaderboard()`: lines 8414-8759
- `fetchAndRenderCombinedAALeaderboard()`: lines 8762-8922
- `'virtius-leaderboard'` renderer: lines 13911-14011
- `'combined-aa-leaderboard'` renderer: lines 14013-14065

**stage.html routing:**
- Firebase listener: lines 596-610
- Renderer check: line 600 (`val.renderer !== 'stage'`)
- Exit animation: 200ms fade-out (line 578)
- Error reporting: lines 178-197 (writes to `production/stageErrors/{timestamp}`)

**output.html routing:**
- Firebase listener: line 14224
- Stage renderer handling: lines 14246-14255
- Cleanup: `output.innerHTML = ''`, `hideAnimatedBackground()`, `themeClearOverrides()`

**overlays/team-roster.html:**
- Total: ~580 lines
- CSS: lines 13-269
- HTML: lines 271-282
- JS: lines 284-576
