# Renderer System (Phase 2: Content Blocks) — Tasks

## Tasks

### Task 1: header-bar Block — COMPLETE
**Files:**
- `stage/blocks/header-bar.js` (create)
- `stage/blocks/header-bar.css` (create)

**Description:** Create the reusable header bar block used by leaderboards, rosters, and most future graphics. Matches both the roster's `.header-bar` and the leaderboard's `.frame-header` — they share the same rendered values (42px/800wt title, 18px×40px padding, #d4d4d8 background, 80px logo).

The block renders a title (left) and optional logo (right) with `flex` / `space-between`. Adds `flex-shrink: 0` and `text-transform: uppercase` (from roster). Supports background image with opacity layer via `::before` pseudo-element. All values driven by CSS variables with hardcoded fallbacks.

**JS interface:**
- `window.BlockHeaderBar`
- `themeVars`: `['--meet-header-bg', '--meet-header-text', '--meet-logo-url', '--meet-logo-size']`
- `sampleData`: `{ title: "VAULT", logo: "https://media.virti.us/upload/images/team/placeholder.png" }`
- `render(container, data, context)`: builds title + optional logo img
- `ready(container)`: resolves when logo image loads (or immediately if no logo)
- No `destroy()` needed (no Firebase listeners)

**CSS values (from header-bar-comparison spec):**
- Background: `var(--header-bar-bg, var(--meet-header-bg, #d4d4d8))`
- Padding: `18px 40px` (CSS variable overridable)
- Title: 42px, weight 800, uppercase, color `var(--header-bar-text, var(--meet-header-text, #000))`
- Logo: 80px × 80px, object-fit contain
- Background image support with `::before` opacity layer

**Verify:**
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=header-bar` → card frame with gray (#d4d4d8) header bar showing "VAULT" in 42px bold uppercase text
- [ ] Header bar is flush to top of card, no gap
- [ ] Header bar does not stretch vertically (flex-shrink: 0)
- [ ] No console errors

---

### Task 2: leaderboard-table Block — COMPLETE
**Files:**
- `stage/blocks/leaderboard-table.js` (create)
- `stage/blocks/leaderboard-table.css` (create)

**Description:** The main scoring table block. Renders from `data.rows` array. Includes a Firebase listener stub for `data.source` path — this path (`scoring/leaderboard/{apparatus}`) doesn't exist yet (Phase 3 creates it), but the listener is harmless when the path is empty and will auto-activate when Phase 3 populates data.

**Column variants (controlled by `data.apparatus` and `data.gender`):**
- Men's events: #, Name, Team, Apparatus, Score, Diff, Exec, SB (8 columns)
- Women's events: #, Name, Team, Apparatus, Score (5 columns — no Diff/Exec/SB)
- All-Around (AA/COMBINED_AA): #, Name, Team, Score (4 columns — no Apparatus/Diff/Exec/SB)

**Key rendering details:**
- Tie handling: gap ranking (1, 2, 2, 4) with `<sup>T</sup>` superscript when `rankCounts[rank] > 1`
- Medal indicators: 20px solid-color circles for ranks 1-3 (gold #facc15, silver #d4d4d8, bronze #d97706), inline before name with 10px margin-right
- Score formatting: `.toFixed(3)` for score/exec, `.toFixed(2)` for diff
- Stick bonus: 28px green (#22c55e) circle with "S" letter
- Team logo: 36px × 36px inline before team name
- Alternating row backgrounds: odd #18181b, even #0f0f10
- Table header: #27272a background, #a1a1aa text, 600 weight
- `font-variant-numeric: tabular-nums` on container
- Apparatus badge: bordered pill with 20px font, #a1a1aa text

**JS interface:**
- `window.BlockLeaderboardTable`
- `themeVars`: `['--meet-content-bg', '--meet-overlay-bg', '--meet-overlay-text', '--meet-border-color', '--meet-badge-bg', '--meet-badge-text']`
- `sampleData`: 10 rows of women's VT data (see Phase 2 doc)
- `render(container, data, context)`: renders table, sets up Firebase listener if `data.source` exists
- `destroy()`: detaches Firebase listener
- `ready(container)`: resolves when all team logo images load

**CSS values (pixel-exact from output.html leaderboard):**
- Container: `flex: 1`, background #000, `font-variant-numeric: tabular-nums`
- Table: 28px base font, `border-collapse: collapse`
- Header: 16px 20px padding, #27272a bg, #a1a1aa text, 600 weight, 2px bottom border #3f3f46
- Cells: 14px 20px padding, #fff text, 500 weight
- Rank column: 70px width, 700 weight, #a1a1aa color
- Score column: right-aligned, 32px, 700 weight, #fff
- Diff/Exec: right-aligned, 26px, 500 weight, #a1a1aa
- Row borders: 1px solid #3f3f46

**Verify:**
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table` → card with gray header + dark table showing 10 rows of VT scores
- [ ] Table shows 5 columns: #, Name, Team, Apparatus, Score (women's VT sample data — no Diff/Exec/SB)
- [ ] Tied ranks (1T, 5T in sample data) show superscript "T"
- [ ] Ranks 1-3 have colored medal circles (gold, silver, bronze) before the name
- [ ] Alternating row backgrounds (dark/darker)
- [ ] Scores right-aligned with tabular numerals
- [ ] No console errors

---

### Task 3: athlete-grid Block — NOT STARTED
**Files:**
- `stage/blocks/athlete-grid.js` (create)
- `stage/blocks/athlete-grid.css` (create)

**Description:** Team roster grid with circular headshot photos. When `data.teamKey` is provided with a Firebase context, fetches roster and headshots from Firebase. Otherwise renders from `data.athletes` array directly (preview mode).

**Headshot lookup algorithm (from roster-headshot-lookup spec — use the full 5-step chain, NOT the simplified 2-key approach):**
1. Direct lowercase: `name.toLowerCase().replace(/\s+/g, ' ').trim()`
2. Fully normalized: strip accents (ö→oe, é→e, etc.), remove suffixes (Jr., Sr., I-V)
3. Stripped special chars: normalized with `[^a-z\s]` removed
4. First + Last name only (if 3+ name parts)
5. First + Middle initial + Last (if 3+ parts)

The simplified 2-key lookup from the Phase 2 doc will cause visible regressions because Firebase headshot keys are inconsistently normalized.

**Grid layout (dynamic columns based on count):**
- 1-6 athletes: repeat(N, 250px), gap 20px
- 7-8: repeat(4, 220px), gap 20px
- 9-10: repeat(5, 200px), gap 20px
- 11-12: repeat(4, 220px), gap 16px
- 13-15: repeat(5, 200px), gap 14px
- 16-20: repeat(5, 190px), gap 12px
- 21-25: repeat(5, 180px), gap 10px
- 26+: repeat(6, 160px), gap 8px

**Responsive headshot/name sizing:**
- 1-10: 120px headshot, 36px initials, 18px name
- 11-15: 100px headshot, 30px initials, 16px name
- 16-20: 90px headshot, 26px initials, 14px name
- 21-25: 80px headshot, 22px initials, 13px name
- 26+: 70px headshot, 20px initials, 12px name, 2px border

**Initials fallback:**
- Show initials div when headshot URL is empty or image fails to load (`onerror` handler)
- Initials: first letter of each name part, max 2 chars, uppercase
- Gradient background: `linear-gradient(135deg, #3f3f46 0%, #27272a 100%)`

**JS interface:**
- `window.BlockAthleteGrid`
- `themeVars`: `['--meet-overlay-bg', '--meet-overlay-text', '--meet-border-color']`
- `sampleData`: 10 athletes with empty headshots (shows initials)
- `render(container, data, context)`: fetches from Firebase if teamKey present, else renders directly
- `ready(container)`: resolves when all headshot images load
- No `destroy()` needed (uses `once()` reads, not live listeners)

**CSS values (pixel-exact from team-roster.html):**
- Container: `flex: 1`, bg #18181b, padding 40px, flex center
- Grid: CSS grid with `justify-content: center; align-content: center`
- Headshot: circular (50% radius), 3px border #52525b, `object-fit: cover`, `object-position: center 20%`
- Name: uppercase, 600 weight, Inter font, ellipsis overflow

**Verify:**
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=header-bar,athlete-grid` → card with gray header + grid of 10 athlete cards with initials (sample data has no headshots)
- [ ] Grid shows 5 columns of 250px width (10 athletes → ag-count-10 → repeat(5, 200px) — correction: 10 athletes uses count-10)
- [ ] Each card: circular initials placeholder + uppercase name below
- [ ] Initials show gradient background (#3f3f46 → #27272a)
- [ ] Names are uppercase, truncated with ellipsis if too long
- [ ] Grid is centered in the dark content area
- [ ] No console errors

---

### Task 4: Deploy + Visual Parity Verification — NOT STARTED
**Files:**
- Production server: `/var/www/commentarygraphic/stage/blocks/` (deploy new block files)

**Description:** Deploy the three new blocks to production and verify visual parity against existing graphics.

**Deploy steps:**
1. Create tarball of `stage/` directory (includes new blocks)
2. Upload to production server via `ssh_upload_file`
3. Extract and fix permissions (`chmod 644`)
4. No nginx changes needed (Phase 1 already configured `/stage/` location)

**Visual parity checks (via Playwright screenshots at 1920x1080):**

Leaderboard comparison:
1. Screenshot: `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table`
2. Verify against leaderboard-visual-spec.md values:
   - Header: #d4d4d8 bg, 42px/800wt title, 18px×40px padding
   - Table: 28px font, alternating rows (#18181b/#0f0f10), #27272a header
   - Score: 32px bold right-aligned, medal circles for top 3
   - Card: 12px border-radius, box shadow, 50px/70px margins

Roster comparison:
1. Screenshot: `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=header-bar,athlete-grid`
2. Verify against roster-visual-spec.md values:
   - Header: same as leaderboard
   - Grid: centered, 20px gap, circular headshots/initials
   - Names: uppercase, 600 weight, 18px (for ≤10 athletes)

**Verify:**
- [ ] Production URL loads: `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=header-bar,leaderboard-table`
- [ ] Leaderboard header bar matches: gray bg, bold uppercase title
- [ ] Leaderboard table matches: dark alternating rows, right-aligned scores, medal indicators
- [ ] Leaderboard card frame matches: rounded corners, shadow, proper margins
- [ ] Production URL loads: `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=header-bar,athlete-grid`
- [ ] Roster header bar matches leaderboard header bar
- [ ] Roster grid shows centered athlete cards with initials
- [ ] Theme preview works: `&theme={validThemeId}` applies colors to both blocks
- [ ] No console errors on any URL
- [ ] Existing graphics unaffected: `https://commentarygraphic.com/output.html?graphic=logos` still works

---

## Task Dependency Graph

```
Task 1 (header-bar) ──→ Task 2 (leaderboard-table) ──→ Task 4 (deploy + verify)
                    ──→ Task 3 (athlete-grid) ─────────↗
```

**Execution order:** 1 → 2 → 3 → 4

Tasks 2 and 3 are independent of each other but both depend on Task 1 (header-bar is used alongside both in preview). Task 4 depends on all three blocks being complete.

## Discovered Bugs
(populated by iterations as they find problems)

## Learnings
(breadcrumbs for future iterations — the next iteration has ZERO memory)

- LEARNING: `ready()` is called by `waitForReady()` with NO arguments and BEFORE `render()`. Don't try to query DOM elements in `ready()` — if the block has no async setup (e.g., no Firebase listener), just `return Promise.resolve()`. Logo loading can't be checked in `ready()` because the img element doesn't exist yet.
- LEARNING: Block CSS uses `.block-{type}` prefix (e.g., `.block-leaderboard-table`) to scope all styles. Internal element classes use a short prefix (e.g., `lb-` for leaderboard-table, `hb-` for header-bar).
