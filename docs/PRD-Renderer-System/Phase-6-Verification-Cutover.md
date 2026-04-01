# Phase 6: Verification & Cutover

**Parent PRD:** PRD-Renderer-System-2026-03-28.md
**Depends on:** Phases 1-5 (all prior phases complete)
**Scope:** Side-by-side visual parity, production test, old code removal

---

## What This Phase Delivers

Confidence that the new renderer system produces identical output to the old system, verified in production. After this phase:
- Leaderboards render exclusively via renderer.html
- Team rosters render exclusively via renderer.html
- Old leaderboard code is removed from output.html
- Old roster code is removed from overlays/team-roster.html
- The renderer system is proven in live production

---

## Tasks

### Task 1: Side-by-Side — Leaderboard

Compare the old output.html leaderboard against the new renderer.html leaderboard.

**Method:**
1. Use a test competition with known Virtius data
2. Screenshot old: `output.html?comp={testComp}` → trigger `virtuis-leaderboard` via Graphics Panel
3. Screenshot new: `renderer.html?comp={testComp}` → trigger `leaderboard-vt` via Graphics Panel
4. Compare at 1920x1080

**Comparison checklist:**

| Element | Match? |
|---------|--------|
| Card positioning (50px top/bottom, 70px sides) | |
| Card border-radius (12px) | |
| Card box-shadow | |
| Header bar height | |
| Header background color | |
| Header title font (42px, 800 weight) | |
| Header logo (80x80, contain) | |
| Table header row (background, text color, padding) | |
| Table body rows (alternating backgrounds) | |
| Row padding (14px 20px) | |
| Rank column (width, font weight, tie superscript) | |
| Medal indicators (gold/silver/bronze dots) | |
| Name column (font weight 600) | |
| Team column (logo 36x36, text color) | |
| Apparatus badge (border, radius, font size) | |
| Score column (32px, right-aligned, bold) | |
| Diff/Exec columns (men's only) | |
| Stick bonus indicator (green circle) | |
| Theme application (theme baked into spec) | |
| Per-graphic overrides (resolved into spec theme object) | |

**Test with:**
- Women's event (VT) — no diff/exec columns
- Men's event (FX) — all columns
- All-Around — no apparatus column
- Tied scores — verify superscript T
- Theme applied — verify all colors cascade

---

### Task 2: Side-by-Side — Roster

Compare the old overlay roster against the new renderer.html roster.

**Method:**
1. Screenshot old: `overlays/team-roster.html?compId={testComp}&teamSlot=1`
2. Screenshot new: `renderer.html?comp={testComp}` → trigger `team-roster-1`
3. Compare at 1920x1080

**Comparison checklist:**

| Element | Match? |
|---------|--------|
| Card positioning | |
| Card border-radius | |
| Card box-shadow | |
| Header bar (title + logo) | |
| Content background color | |
| Grid layout (column count for roster size) | |
| Headshot circle size | |
| Headshot border (3px, color) | |
| Headshot crop (cover, center 20%) | |
| Initials fallback (font, color, gradient) | |
| Athlete name (font, size, weight, uppercase) | |
| Name truncation (ellipsis) | |
| Theme application | |

**Test with:**
- Small roster (6 athletes) — 6 columns
- Medium roster (10 athletes) — 5 columns
- Large roster (20 athletes) — reduced sizes
- Missing headshots — initials fallback
- Theme applied

---

### Task 3: Production Test — Live Show

Run a real show (or realistic rehearsal) using renderer.html for leaderboards and rosters.

**Setup:**
1. Both `output.html` and `renderer.html` loaded as OBS browser sources
2. Registry configured: leaderboard + roster → `renderer: 'renderer'`
3. All other graphics → `renderer: 'output'`

**Test sequence:**
1. Trigger event-bar (output.html) → verify it appears
2. Clear
3. Trigger leaderboard-vt (renderer.html) → verify it appears, output.html is blank
4. Clear
5. Trigger team-roster-1 (renderer.html) → verify it appears
6. Trigger event-bar (output.html) → verify roster exits, event-bar appears
7. Trigger leaderboard-fx (renderer.html) → verify event-bar exits, leaderboard appears
8. Verify live scoring updates flow through (Virtius → coordinator → Firebase → renderer block)
9. Verify theme works on renderer graphics
10. Verify animations play on enter/exit

**Pass criteria:**
- No visual glitches during transitions
- No overlapping graphics (renderer + output showing simultaneously)
- Scoring data updates appear within one poll interval
- Animations are smooth
- Theme colors are correct

---

### Task 4: Remove Old Leaderboard Code from output.html

After production verification, remove the leaderboard rendering code from output.html.

**What to remove:**
- CSS: `.graphic-virtius-leaderboard` and all child selectors (lines ~285-497)
- CSS: Theme variable overrides for leaderboard (lines ~1208-1326)
- JS: `fetchAndRenderLeaderboard()` function (lines ~8313-8636)
- JS: `fetchAndRenderCombinedAALeaderboard()` function (lines ~8639+)
- JS: Leaderboard entries in the `renderers` object (line ~13078)
- JS: AA Leaders rendering code

**What to keep:**
- The `currentGraphic` listener (still needed for non-migrated graphics)
- All non-leaderboard renderers
- Virtuis API utility functions IF they're used by other renderers (event-summary uses Virtius directly — this stays until event-summary is migrated)

**Safety:** The `renderer: "output"` check added in Phase 4 Task 3 means output.html will never receive a leaderboard graphic anyway. But removing the dead code keeps the file clean.

---

### Task 5: Remove Old Roster Code from overlays/

After production verification, remove the standalone roster overlay.

**What to remove or deprecate:**
- `overlays/team-roster.html` — the entire file can be removed once all OBS scenes and URL references are updated

**What to keep:**
- Any roster-related Firebase paths (used by other features like the Media Manager)

**Migration note:** Any saved OBS scenes that point to `overlays/team-roster.html` will break. Document the URL change for producers:
- Old: `overlays/team-roster.html?compId={id}&teamSlot=1`
- New: `renderer/renderer.html?comp={id}&graphic=team-roster-1`

---

### Task 6: Update Deploy Process

~~Update CLAUDE.md deploy instructions to include the renderer directory.~~ — **FIXED 2026-04-01.** Added Step 2.5 to CLAUDE.md with stage directory deploy instructions, updated Step 3 verification to include stage.html accessibility check, and updated Deployment Checklist with 5 stage-related items.

**Note:** PRD originally referenced `renderer/` directory but implementation uses `stage/` directory (see plan.md Task 20).

**Add to deploy checklist:**
- [x] `stage/` directory deployed
- [x] Stage file permissions set to 644
- [x] `stage/stage.html` accessible at `https://commentarygraphic.com/stage/stage.html`

---

## Verification Criteria

Phase 6 is complete when:

- [ ] Side-by-side leaderboard comparison passes all checks (men's, women's, AA, ties, theme)
- [ ] Side-by-side roster comparison passes all checks (various sizes, headshots, initials, theme)
- [ ] Production test passes: clean transitions between renderer and output graphics
- [ ] Live scoring updates flow: Virtius → Firebase → renderer block re-render
- [x] Old leaderboard code removed from output.html (Task 17-18)
- [x] Old roster code removed from overlays/team-roster.html (Task 19)
- [x] Deploy process updated in CLAUDE.md (Task 20 — Step 2.5, Step 3, checklist updated)
- [ ] All non-migrated graphics still work perfectly
- [ ] No regressions in any existing functionality
