# Plan: Sponsor System — Implementation Tracker

**Status:** IN PROGRESS (4/12 tasks complete)
**Last Updated:** 2026-02-13

---

## Quick Task Index

| Task | Phase | File | Change | Status |
|------|-------|------|--------|--------|
| T1 | A | `show-controller/src/hooks/useTeamsDatabase.js` | Rescope `saveSponsor`/`deleteSponsor`/`reorderSponsors` to per-team paths; add `tier` field; add `getTeamSponsors`/`getTeamSponsorCount` helpers; update exports | COMPLETE |
| T2 | B | `show-controller/src/lib/graphicsRegistry.js` | Add `sponsors-thanks`, `sponsors-cycle`, `sponsors-bug` in new `sponsors` category (before closing `};` at line 945) | COMPLETE |
| T3 | B | `show-controller/src/pages/GraphicsManagerPage.jsx` | Add `'sponsors': 'Sponsors'` to `CATEGORY_LABELS` (line 18); add dummy sponsors to `testOptions` for preview | COMPLETE |
| T4 | B | `show-controller/src/lib/graphicButtons.js` | Add `sponsors` key using `getGraphicsByCategory('sponsors')`, numbers starting at 30 | COMPLETE |
| T5 | B | `show-controller/src/lib/urlBuilder.js` | Add 3 builder functions (`buildSponsorsThanksURL`, `buildSponsorsCycleURL`, `buildSponsorsBugURL`) + 3 switch cases + destructure `sponsors` from `options` | NOT STARTED |
| T6 | C | `show-controller/src/pages/UrlGeneratorPage.jsx` | Import `useTeamsDatabase`; add 3 entries to `baseGraphicTitles`; add Sponsors sidebar section; add `resolveHomeTeamKey` helper; thread `sponsorsJson` through `options.sponsors` | NOT STARTED |
| T7 | D | `show-controller/src/pages/MediaManagerPage.jsx` | Create `SponsorsView` component (add/reorder/delete); inline under expanded team cards; add sponsor count badge to team card headers; destructure new hook functions | NOT STARTED |
| T8 | E | `overlays/sponsors-thanks.html` | Create full-screen "Thank You to Our Sponsors" grid overlay (1920x1080, Inter font, gray header bar, auto-sizing grid, URL params) | NOT STARTED |
| T9 | F | `overlays/sponsors-cycle.html` | Create full-screen cycling sponsor overlay (one at a time, 3s hold, 0.5s crossfade, continuous loop) | NOT STARTED |
| T10 | G | `overlays/sponsors-bug.html` | Create transparent corner bug overlay (bottom-right 200x80, 10s cycling, 0.8s fade, semi-transparent pill) | NOT STARTED |
| T11 | H | — | `cd show-controller && npm run build` — verify no errors | NOT STARTED |
| T12 | H | — | Deploy SPA + 3 overlay files to production; verify overlay URLs serve overlays (not React SPA) | NOT STARTED |

---

## Phase Summary

| Phase | Name | Tasks | Status |
|-------|------|-------|--------|
| **A** | Data & Hook | T1 | COMPLETE |
| **B** | Registry & Routing | T2, T3, T4, T5 | NOT STARTED |
| **C** | URL Generator Plumbing | T6 | NOT STARTED |
| **D** | Media Manager UI | T7 | NOT STARTED |
| **E** | Overlay: Thank You | T8 | NOT STARTED |
| **F** | Overlay: Cycle | T9 | NOT STARTED |
| **G** | Overlay: Bug | T10 | NOT STARTED |
| **H** | Build & Deploy | T11, T12 | NOT STARTED |

---

## Dependency Graph

```
T1 (hook) ─────────────┬──→ T6 (URL Generator)
                        └──→ T7 (Media Manager)

T2 (registry) ─────────┬──→ T3 (GraphicsManager)
                        ├──→ T4 (graphicButtons)
                        └──→ T5 (urlBuilder) ──→ T6 (URL Generator)

T8, T9, T10 (overlays) ── no dependencies, can run in parallel

T1-T10 all ──→ T11 (build) ──→ T12 (deploy)
```

**Parallelizable first batch:** T1 + T2 + T8 + T9 + T10 (no dependencies between them)
**Second batch (after T2):** T3 + T4 + T5
**Third batch (after T1 + T4 + T5):** T6 + T7
**Final:** T11 → T12

---

## Task Details

### T1: Hook — Per-Team Sponsor CRUD

**File:** `show-controller/src/hooks/useTeamsDatabase.js`
**Dependencies:** None
**Plan Reference:** [PLAN Section 2](./PLAN-Sponsor-System-2026-02-13.md#2-hook-changes--useteamsdatabasejs)

**Changes:**
1. Modify `saveSponsor` (line 259): Add `teamKey` as first param; path → `teamsDatabase/sponsors/${teamKey}/${sponsorKey}`; write `tier` field (default `'official'`)
2. Modify `deleteSponsor` (line 277): Add `teamKey` as first param; update path
3. Modify `reorderSponsors` (line 290): Add `teamKey` as first param; update paths
4. Add `getTeamSponsors(teamKey)` helper: returns sorted `[{key, name, url, tier, order}]`
5. Add `getTeamSponsorCount(teamKey)` helper: returns number
6. Update return object (lines 783-786): export new helpers

**No changes needed to:** `sponsors` state declaration (line 40), Firebase listener (lines 81-87), `checkLoaded` threshold (line 54)

**Status:** COMPLETE

---

### T2: Registry — Three Sponsor Graphics

**File:** `show-controller/src/lib/graphicsRegistry.js`
**Dependencies:** None
**Plan Reference:** [PLAN Section 7](./PLAN-Sponsor-System-2026-02-13.md#7-graphics-registry)

**Changes:**
1. Add `sponsors-thanks` entry: category `'sponsors'`, renderer `'overlay'`, file `'sponsors-thanks.html'`, transparent `false`, params: `logo` (string/competition) + `sponsors` (string/computed)
2. Add `sponsors-cycle` entry: same pattern, file `'sponsors-cycle.html'`
3. Add `sponsors-bug` entry: transparent `true`, no `logo` param, file `'sponsors-bug.html'`

**Insert location:** Before closing `};` at line 945. Use `'sponsors'` category (NOT `'stream'`) to avoid keyword collision with `stream-thanks`.

**Status:** COMPLETE

---

### T3: Graphics Manager — Category Label + Preview

**File:** `show-controller/src/pages/GraphicsManagerPage.jsx`
**Dependencies:** T2
**Plan Reference:** [PLAN Section 7](./PLAN-Sponsor-System-2026-02-13.md#7-graphics-registry)

**Changes:**
1. Add `'sponsors': 'Sponsors'` to `CATEGORY_LABELS` (line 18)
2. Add dummy sponsors data to `testOptions` when previewing sponsor graphics (so preview isn't empty/broken)

**Status:** COMPLETE

---

### T4: Graphic Buttons — Sponsors Section

**File:** `show-controller/src/lib/graphicButtons.js`
**Dependencies:** T2
**Plan Reference:** [PLAN Section 7](./PLAN-Sponsor-System-2026-02-13.md#7-graphics-registry)

**Changes:**
1. Add `sponsors` key to exported `graphicButtons` object
2. Use `getGraphicsByCategory('sponsors').map(...)` pattern
3. Number sequence starting at 30 (stream uses 19+, inMeet uses 27+)

**Status:** COMPLETE

---

### T5: URL Builder — Three Builder Functions

**File:** `show-controller/src/lib/urlBuilder.js`
**Dependencies:** T2
**Plan Reference:** [PLAN Section 8](./PLAN-Sponsor-System-2026-02-13.md#8-url-builder--data-plumbing)

**Changes:**
1. Destructure `sponsors` from `options` (line 333)
2. Add `buildSponsorsThanksURL({ logo, sponsorsJson, baseUrl })` after `buildStreamURL` (line 209)
3. Add `buildSponsorsCycleURL({ logo, sponsorsJson, baseUrl })`
4. Add `buildSponsorsBugURL({ sponsorsJson, baseUrl })` — no `logo` param
5. Add 3 switch cases before `default:` (line 524)

All use `URLSearchParams` for proper encoding.

**Status:** NOT STARTED

---

### T6: URL Generator — Sponsor Plumbing

**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`
**Dependencies:** T1, T4, T5
**Plan Reference:** [PLAN Section 8](./PLAN-Sponsor-System-2026-02-13.md#8-url-builder--data-plumbing)

**Changes:**
1. Import `useTeamsDatabase` hook
2. Destructure `getTeamSponsors`, `resolveSchoolKey`
3. Add 3 entries to `baseGraphicTitles` (lines 47-101)
4. Add "Sponsors" sidebar section after "Stream" section (line 457) using `GraphicSection` + `GraphicSidebarButton` pattern
5. Add `resolveHomeTeamKey(formData, config)` helper using `resolveSchoolKey`
6. In `generateURLWithOptions`: resolve home team sponsors, cap at 8, serialize as JSON, thread through `options.sponsors`

**Status:** NOT STARTED

---

### T7: Media Manager — SponsorsView Component

**File:** `show-controller/src/pages/MediaManagerPage.jsx`
**Dependencies:** T1
**Plan Reference:** [PLAN Section 3](./PLAN-Sponsor-System-2026-02-13.md#3-media-manager-ui--inline-sponsorsview)

**Changes:**
1. Destructure from hook (lines 22-32): `sponsors`, `saveSponsor`, `deleteSponsor`, `reorderSponsors`, `getTeamSponsors`, `getTeamSponsorCount`
2. Team card header (lines 344-394): Add sponsor count badge ("3 Spons" amber / "No Spons" zinc)
3. Expanded card (lines 398-404): Wrap `RosterView` + `SponsorsView` in fragment
4. Create `SponsorsView` component (after RosterView definition at line 648):
   - Props: `{ teamKey, getTeamSponsors, saveSponsor, deleteSponsor, reorderSponsors }`
   - Section header with SparklesIcon
   - Sponsor list rows: [48x48 logo] [Name] [Tier badge] [URL] [Up] [Down] [Delete]
   - Add form: [Name input] [URL input + preview] [Tier dropdown] [Add button]
   - Duplicate key guard with inline error
   - Empty state: "No sponsors for this team"

**Status:** NOT STARTED

---

### T8: Overlay — sponsors-thanks.html

**File:** `overlays/sponsors-thanks.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 4](./PLAN-Sponsor-System-2026-02-13.md#4-overlay-sponsors-thankshtml)

**Create new file:**
- 1920x1080 viewport, Inter font, transparent body
- Gray header bar (#BFBFBF) with "THANK YOU TO OUR SPONSORS" + team logo (80x80)
- URL params: `?logo={teamLogoUrl}&sponsors={encodedJSON}`
- CSS grid: 1-2 sponsors = 1 row; 3-4 = 2x2; 5-8 = 2 rows
- Each sponsor: logo (200x200 contain) + name (24px) below
- Error handling: missing logo, missing/invalid sponsors, empty array, broken logos, long names

**Status:** NOT STARTED

---

### T9: Overlay — sponsors-cycle.html

**File:** `overlays/sponsors-cycle.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 5](./PLAN-Sponsor-System-2026-02-13.md#5-overlay-sponsors-cyclehtml)

**Create new file:**
- Same gray header bar as sponsors-thanks
- One sponsor at a time, centered, large (~600px), name below (36px bold)
- 3s hold, 0.5s crossfade, continuous loop via setInterval
- 1 sponsor = static, no transitions
- Broken logo → skip to next; ALL broken → text-only mode

**Status:** NOT STARTED

---

### T10: Overlay — sponsors-bug.html

**File:** `overlays/sponsors-bug.html`
**Dependencies:** None
**Plan Reference:** [PLAN Section 6](./PLAN-Sponsor-System-2026-02-13.md#6-overlay-sponsors-bughtml-new)

**Create new file:**
- 1920x1080 viewport, fully transparent body
- No header bar
- Container: `position: fixed; bottom: 40px; right: 40px; width: 200px; height: 80px;`
- Semi-transparent dark pill: `rgba(0,0,0,0.4); border-radius: 12px; padding: 10px;`
- 10s hold, 0.8s fade, continuous loop
- URL params: `?sponsors={encodedJSON}` only (no `?logo=`)
- Missing/empty → fully transparent page; 1 sponsor → static; all broken → hide container

**Status:** NOT STARTED

---

### T11: Build — Local Verification

**Dependencies:** T1-T10
**Plan Reference:** [PLAN Section 9](./PLAN-Sponsor-System-2026-02-13.md#9-task-order)

**Steps:**
1. `cd show-controller && npm run build`
2. Verify no errors, no warnings about missing imports
3. Check `dist/` output exists

**Status:** NOT STARTED

---

### T12: Deploy — Production

**Dependencies:** T11
**Plan Reference:** [PLAN Deployment](./PLAN-Sponsor-System-2026-02-13.md#deployment)

**Steps:**
1. Deploy React SPA (tarball → upload → extract)
2. Deploy 3 overlay files (rebuild overlays tarball → upload → extract)
3. Verify overlay URLs serve correct content:
   - `https://commentarygraphic.com/overlays/sponsors-thanks.html`
   - `https://commentarygraphic.com/overlays/sponsors-cycle.html`
   - `https://commentarygraphic.com/overlays/sponsors-bug.html`
4. Verify main site has no console errors
5. Verify URL Generator shows Sponsors sidebar section

**Status:** NOT STARTED

---

## Verification Checklist

After all tasks complete:

- [ ] **Hook** — `saveSponsor('test-mens', 'test-sponsor', {...})` → Firebase path exists with all fields
- [ ] **Media Manager** — Expand team → SponsorsView appears → add/reorder/delete works → badge updates
- [ ] **Overlays** — Open each HTML locally with test `?sponsors=` param → renders correctly
- [ ] **URL Generator** — Select competition with sponsors → sponsor graphics show in sidebar → URLs generate correctly
- [ ] **Build** — `npm run build` no errors
- [ ] **Deploy** — Production URLs serve overlays (not React SPA)
- [ ] **OBS test** — `sponsors-bug.html` as Browser Source → transparency works
