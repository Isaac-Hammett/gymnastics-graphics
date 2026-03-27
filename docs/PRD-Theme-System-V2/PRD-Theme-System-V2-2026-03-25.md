# PRD: Theme System V2 — Unified Theme Engine

**Version:** 3.1
**Date:** 2026-03-26
**Status:** IN PROGRESS (Phase 0-6 COMPLETE, Phase 8A COMPLETE (2026-03-26), Phase 7.FONT NEXT — font loading consolidation, then Phase 7A-7F — full graphic control for all categories, Phase 8B last — dynamic suffix list)
**Supersedes:** PRD-Meet-Themes (v3.0, 2026-03-06) — Phases 1-12 remain COMPLETE; this PRD builds on that foundation
**Depends On:** PRD-Meet-Themes (foundation)

---

## 1. Problem Statement

The current theme system (PRD-Meet-Themes v3.0) works for overlay-based graphics but breaks down in practice due to three issues:

### 1.1 Two Theme Code Paths

Theme CSS lives in two separate locations that must be manually kept in sync:

| Location | Used By | Maintained By |
|----------|---------|---------------|
| `overlays/theme-overrides.css` + `theme-loader.js` | 28 overlay HTML files | theme-loader.js (dynamic) |
| `output.html` inline `<style>` (search "MEET THEME OVERRIDES") | Inline-rendered graphics (event-bar, hosts, coaches, stats, leaderboards, frames, etc.) | Manual edits |

These diverge in two ways:

1. **Different CSS class names** for the same elements (`.logo-section` in overlays vs `.event-bar-logo` in output.html) — 10 known differences, only 3 previously documented.
2. **~68 CSS rules in output.html that have no equivalent in theme-overrides.css at all** — event summary (~22 rules), leaderboard (~25 rules), warm-up details (~6 rules), replay details (~6 rules), event bar details (~3 rules), texture targets (~4 rules), event frame (~2 rules).

Additionally, output.html has its own JavaScript theme-loading function `applyMeetTheme()` (output.html:7268) that duplicates the CSS variable-setting logic from theme-loader.js. This function supports two theme-loading paths:
- **URL param path:** `?meetTheme=X` (used by URL Generator preview)
- **Competition config path:** reads `competitions/{compId}/config/meetTheme` from Firebase (used during live broadcast)

theme-loader.js only supports the URL param path. In live mode, output.html loads as `?comp={compId}` with no `meetTheme` in the URL — theme-loader.js no-ops (line 27: `if (!meetThemeId) { return; }`).

**Important:** 10 of 44 output.html renderers already render as **iframes pointing to overlay files** and thus already use theme-loader.js. The dual-CSS problem only affects the 34 inline-rendered graphics.

### 1.2 No Observability

When a graphic doesn't pick up theme colors or shows the wrong logo, there is no way to diagnose WHY without reading source code. Possible failure points:

- `meetTheme` param not passed in URL
- Theme doesn't exist in Firebase
- Theme exists but field names are wrong (v2/v3 mismatch)
- CSS variables set but wrong selectors in use
- Logo field missing or not read by the specific graphic

All of these produce the same symptom: "it looks wrong." Troubleshooting takes 30-60 minutes per issue.

### 1.3 No Per-Graphic Control

The theme is all-or-nothing — 8 colors applied identically to every graphic. There is no way to:

- Use a PNG texture as a header background on event-bar but not on sponsors
- Override the logo for one specific graphic
- Change the sponsor graphic header color without changing every header
- Upload a custom background image for specific graphic elements

### 1.4 Theme Editor Competition Dropdown is Empty (BUG)

The Theme Editor's competition dropdown shows no competitions. The Firebase query (ThemeEditorPage.jsx) filters to competitions created in the last 60 days OR with `status: 'active'`. If no competitions match this filter, the dropdown is empty — making the "preview with real competition data" feature unusable.

### 1.5 Graphics Preview Shows Errors

When previewing inline-rendered graphics (e.g., Event Summary) with "Use placeholder data" selected, the preview shows error messages like "No Virtius Session ID configured for this competition" instead of a rendered graphic. The preview path needs proper placeholder/sample data so it renders without requiring a real competition backend.

### 1.6 Per-Graphic Controls Are Too Shallow

Phase 4 delivered per-graphic **color and image overrides**, but producers need **layout controls** — font sizes, element sizes, positioning, padding, show/hide toggles. The current override panel is a flat grid of 8 color checkboxes plus image URL fields. Compare this to the WhoToWatch title card editor, which has ~20 granular controls organized into semantic sections (THEME, BADGE, TEAM, TEXT, IMAGE, WATERMARK) using ValueStepper inputs with live preview. The per-graphic override panel needs the same depth of control.

Additionally:
- **No save button** in the per-graphic overrides section. The only "Save Theme" button is at the top of the page — producers editing overrides at the bottom of the page have no way to save without scrolling up.
- **No preview reload after save.** After saving overrides, the preview iframe does not reload to reflect the changes, so the producer can't verify what they just saved.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Unified theme path** | ONE code path for theme application across all graphics (overlays AND output.html inline) |
| **Debug panel** | Visual diagnostic tool showing theme state, CSS variable values, and failure points |
| **Per-graphic overrides** | Override any theme property (colors, images, textures, logos) for specific graphic types |
| **Per-graphic layout controls** | Granular control over font sizes, element sizes, positioning, and visibility per graphic — matching the depth of the WTW title card editor |
| **Image/texture support** | Apply PNGs, JPGs, or textures to any graphic surface (headers, backgrounds, borders) |
| **Competition preview** | Theme Editor can preview themes against real competition data |
| **Documentation sync** | CLAUDE.md updated at each phase boundary |
| **Rundown safety** | Zero changes to the Firebase contract between timesheetEngine and output.html |

---

## 3. Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Refactor output.html into modules | output.html works as-is; splitting the 13K-line monolith is a separate effort with high risk and low user-facing value |
| Extract CSS/JS into separate files | Performance optimization deferred — not justified without profiling data showing a real bottleneck |
| Redesign graphic visual style | This PRD controls layout parameters (sizes, positions), not the graphic's overall visual design language |
| Change the rundown/timesheet engine | Rundown writes `currentGraphic` to Firebase; that contract stays identical |
| Migrate away from Firebase | Firebase is the real-time backbone; no change |
| Replace the Theme Editor UI | We extend it (add per-graphic overrides + competition preview), not replace it |
| Custom fonts per theme | Future consideration — all graphics use Inter for now |

---

## 4. Architecture

### 4.1 Current Architecture (What Changes)

```
TODAY: Two theme code paths

  Overlay graphics ──→ theme-loader.js ──→ theme-overrides.css
                                            (class: .logo-section)

  output.html inline ──→ inline <style> ──→ hardcoded + some CSS vars
                                            (class: .event-bar-logo)

  Result: Same theme renders differently in different graphics
```

### 4.2 Proposed Architecture

```
AFTER: One theme code path

  ALL graphics ──→ theme-loader.js ──→ theme-overrides.css
                        │
                        ├── Global theme colors (Layer 2)
                        ├── Per-graphic overrides (Layer 3)
                        └── Image/texture injection

  Layer 3 (highest):  Per-graphic override     themes/{id}/overrides/{graphicId}/headerBar
  Layer 2:            Theme default            themes/{id}/colors/headerBar
  Layer 1 (lowest):   Hardcoded fallback       #BFBFBF

  CSS resolution:
    var(--event-bar-header-bg,           /* Layer 3 */
      var(--meet-header-bg,              /* Layer 2 */
        #BFBFBF                          /* Layer 1 */
      )
    )
```

### 4.3 Graphic ID Registry

Every graphic has a canonical ID used for per-graphic overrides and debug panel display. The ID is determined by:

- **Overlay HTML files:** filename without extension (e.g., `overlays/sponsors-thanks.html` → `sponsors-thanks`)
- **output.html inline graphics:** the `?graphic=` URL param value (e.g., `?graphic=event-bar` → `event-bar`)

The canonical list of all graphic IDs is maintained in `overlays/graphic-ids.json` (created in Phase 0). This file is the single source of truth for:
- Phase 3: per-graphic override keys in Firebase
- Phase 4: Theme Editor graphic list

### 4.4 Firebase Data Model Changes

**Existing** (unchanged):
```
themes/{themeId}/
  colors/         { headerBar, contentArea, bodyBackground, ... }
  logos/          { meetLogo, causeLogo }
  branding/       { meetTitle, subtitle }
  textures/       { overlay, opacity }
  sponsors/       [ { name, url, scale?, offset?, crop? } ]
```

**New** (added in Phase 3):
```
themes/{themeId}/
  overrides/
    {graphicId}/              e.g., "event-bar", "sponsors-thanks"
      headerBar: "#FF0000"              Color override
      contentArea: "#FFFFFF"            Color override
      headerBgImage: "https://..."      PNG/JPG URL for header background
      headerBgImageFit: "cover"         cover | contain | repeat
      headerBgImagePosition: "center"   center | top | bottom | left | right
      headerBgImageOpacity: 0.8         0-1
      bodyBgImage: "https://..."        PNG/JPG URL for body background
      bodyBgImageFit: "cover"
      bodyBgImageOpacity: 1.0
      bodyTexture: "https://..."        Texture overlay
      bodyTextureBlend: "overlay"       overlay | multiply | normal
      bodyTextureOpacity: 0.08
      logo: "https://..."              Logo override for this graphic only
      logoSize: 120                     px
```

**New** (added in Phase 5 — layout overrides for event-bar):
```
themes/{themeId}/
  overrides/
    event-bar/
      # Colors (existing from Phase 3)
      headerBar: "#FF0000"
      contentArea: "#FFFFFF"
      ...
      # Layout — Position (new)
      barBottom: 120                    px — vertical position from bottom
      barLeft: 100                      px — horizontal position from left
      # Layout — Logo (new)
      logoImgSize: 70                   px — logo image width/height
      logoContainerWidth: 100           px — colored box around logo
      showLogo: true                    boolean — show/hide logo section
      # Layout — Venue header (new)
      venueFontSize: 36                 px
      barMinWidth: 600                  px — minimum width of venue bar
      # Layout — Text (new)
      nameFontSize: 28                  px — event name font size
      locationFontSize: 24              px — location font size
```

**Pattern:** Each graphic type defines its own set of layout override keys. Event-bar is the first; other graphics follow the same pattern in future phases. All layout values are optional — when absent, the CSS uses hardcoded defaults via `var(--event-bar-venue-font-size, 36px)`.

**Firebase read strategy:** theme-loader.js fetches the ENTIRE `themes/{themeId}` subtree in a single read (already does this today). The `overrides` data comes along with it — no additional Firebase read required per graphic.

### 4.5 Rundown Integration (No Changes)

The rundown/timesheet engine writes to `competitions/{compId}/currentGraphic` with the graphic data including `meetTheme` from competition config. This contract is untouched.

### 4.6 Orchestration Types: Playout & Who-to-Watch

Playout and Who-to-Watch are **segment types** that orchestrate sequences of graphics, not individual graphics themselves. The theme system must handle the sub-graphics they produce:

| Segment Type | Sub-Graphics Produced | Theme Mechanism |
|---|---|---|
| `who-to-watch` | `who-to-watch-title` (1-3 full-screen title cards) | Iframe overlay — `?meetTheme=` URL param → theme-loader.js |
| `who-to-watch` | `who-to-watch` (lower-third during clip) | Iframe overlay — `?meetTheme=` URL param → theme-loader.js |
| `playout` | Clip overlay (athlete panel + score badge) | Inline in output.html — CSS variables (`--meet-header-bg`, etc.) |
| `playout` | Gap-fill sponsor graphics (`sponsors-thanks`, `sponsors-cycle`, `sponsors-bug`) | Iframe overlay — `?meetTheme=` URL param → theme-loader.js |
| `playout` | Gap-fill content items (event-summary, rotation-break, etc.) | Inline in output.html — CSS variables |
| `playout` | `live-camera` badge | Inline in output.html — CSS variables |

**Current gap:** The WhoToWatchSequencer (server/index.js) reads `meetTheme` from competition config and includes it in all `currentGraphic` writes. The PlayoutEngine (server/lib/playoutEngine.js) does NOT — none of its `_writeCurrentGraphic()` calls include `meetTheme`. This means iframe-rendered overlays triggered by the playout engine (sponsor graphics in gap-fill sequences) receive no `meetTheme` URL param.

**Fix required in Phase 1:** The PlayoutEngine must read `meetTheme` from competition config during startup and include it in every `_writeCurrentGraphic()` call (see Task 1.1b in Phase 1).

**Theme Editor implication (Phase 4):** The Theme Editor must be able to preview these sub-graphics individually so producers can verify theme appearance before a live broadcast. See Section 6, Phase 4 for details.

### 4.7 Complete Graphic-to-Phase Mapping

Every graphic in the system is assigned to exactly one phase. This table is the single source of truth for coverage — nothing falls through the cracks.

**Legend:** ✅ = Complete | 🔲 = Not Started | ⛔ = Excluded (no theming needed)

#### Inline Renderers (33 graphics in output.html)

| Graphic ID | Render Type | Phase | Status | Notes |
|---|---|---|---|---|
| `clear` | inline | — | ⛔ | Utility — returns empty string, no theming |
| `custom` | iframe | — | ⛔ | Arbitrary URL iframe, no theming |
| `event-bar` | inline | Phase 5-6 | ✅ | Rich controls, CSS variables, template |
| `warm-up` | inline | Phase 6 | ✅ | Full CSS variable support, template |
| `replay` | inline | Phase 6 | ✅ | Full CSS variable support, template |
| `logos` | inline | Phase 7E | 🔲 | Logo grid, scales by team count |
| `now-competing` | inline | Phase 7E | 🔲 | Lower-third style bar (low priority — not actively used in playout) |
| `live-camera` | inline | Phase 7E | 🔲 | Small LIVE badge, actively used by PlayoutEngine |
| `event-summary` | inline | Phase 7A | 🔲 | 28 layout variants |
| `virtuis-leaderboard` | inline | Phase 7A | 🔲 | 18 event×gender variants |
| `event-frame` | inline | Phase 7A | 🔲 | Header + content wrapper |
| `team1-stats` | inline | Phase 7B | 🔲 | Static team stats renderer |
| `team2-stats` | inline | Phase 7B | 🔲 | Static team stats renderer |
| `team3-stats` | inline | Phase 7B | 🔲 | Static team stats renderer |
| `team4-stats` | inline | Phase 7B | 🔲 | Static team stats renderer |
| `team5-stats` | inline | Phase 7B | 🔲 | Static team stats renderer |
| `team6-stats` | inline | Phase 7B | 🔲 | Static team stats renderer |
| `team7-stats` | inline | Phase 7B | 🔲 | Static team stats renderer |
| `team-stats` | inline | Phase 7B | 🔲 | Dynamic team stats renderer |
| `team1-coaches` | inline | Phase 7B | 🔲 | Static coaches renderer |
| `team2-coaches` | inline | Phase 7B | 🔲 | Static coaches renderer |
| `team3-coaches` | inline | Phase 7B | 🔲 | Static coaches renderer |
| `team4-coaches` | inline | Phase 7B | 🔲 | Static coaches renderer |
| `team5-coaches` | inline | Phase 7B | 🔲 | Static coaches renderer |
| `team6-coaches` | inline | Phase 7B | 🔲 | Static coaches renderer |
| `team7-coaches` | inline | Phase 7B | 🔲 | Static coaches renderer |
| `team-coaches` | inline | Phase 7B | 🔲 | Dynamic coaches renderer |
| `stream-starting` | inline | Phase 7D | 🔲 | Full-screen, separate graphic from stream-thanks |
| `stream-thanks` | inline | Phase 7D | 🔲 | Full-screen, separate graphic from stream-starting |
| `frame-quad` | inline | Phase 7A | 🔲 | 2×2 grid frame |
| `frame-tri-center` | inline | Phase 7A | 🔲 | 2 top + 1 centered bottom |
| `frame-tri-wide` | inline | Phase 7A | 🔲 | 2 top + 1 full-width bottom |
| `frame-single` | inline | Phase 7A | 🔲 | Single full-size frame |
| `frame-team-header` | inline | Phase 7A | 🔲 | Team logos header + 2 panels |

#### Iframe Renderers (10 graphics via output.html → overlay files)

| Graphic ID | Source File | Phase | Status | Notes |
|---|---|---|---|---|
| `sponsors-thanks` | overlays/sponsors-thanks.html | Phase 7A | 🔲 | Full-screen, responsive grid |
| `sponsors-cycle` | overlays/sponsors-cycle.html | Phase 7C | 🔲 | Rotating sponsor slides |
| `sponsors-bug` | overlays/sponsors-bug.html | Phase 7C | 🔲 | Small corner sponsor carousel |
| `who-to-watch-title` | overlays/who-to-watch-title.html | Phase 7F | 🔲 | Full-screen title card |
| `who-to-watch-lower-third` | overlays/who-to-watch.html | Phase 7F | 🔲 | Lower-third during clip |
| `event-calendar` | overlays/event-calendar.html | Phase 7E | 🔲 | Event listing with 4 responsive tiers |
| `rotation-slate` | overlays/rotation-slate.html | Phase 7E | 🔲 | Manual rotation display (12+ layouts) |
| `rotation-slate-auto` | overlays/rotation-slate-auto.html | Phase 7E | 🔲 | Auto-updating rotation (same layouts, Firebase-driven) |
| `team-roster` | overlays/team-roster.html | Phase 7A | 🔲 | Full-screen roster |
| `clip-overlay` | output.html (clip mode) | Phase 7F | 🔲 | Athlete panel + score badge in clip playback |

#### OBS-Direct Overlays (not in output.html renderer system)

| Graphic ID | Source File | Phase | Status | Notes |
|---|---|---|---|---|
| `interview-card` | overlays/interview-card.html | Phase 7E | 🔲 | Left-panel card with coach/athlete info, uses Poppins font |
| `athlete-spotlight` | overlays/athlete-spotlight.html | Phase 7E | 🔲 | Lower-third with dual athlete headshots |
| `team-bug` | overlays/team-bug.html | Phase 7E | 🔲 | Complex live score bug (100+ CSS values, Firebase + Virtuis API) |
| `hosts` | overlays/hosts.html | Phase 7E | 🔲 | Simple lower-third card, structurally identical to coaches |
| `coaches` | overlays/coaches.html | Phase 7E | 🔲 | Lower-third with logo, used for team-coaches via OBS |
| `team-stats` (overlay) | overlays/team-stats.html | Phase 7B | 🔲 | Overlay version of team stats |

#### Overlay-Only Files (no renderer, OBS-direct, limited/no theming needed)

| File | Phase | Status | Notes |
|---|---|---|---|
| `animated-background.html` | — | ⛔ | Separate system, no theme integration |
| `clip-player.html` | — | ⛔ | Video fallback player, no theming |
| `frame-dual.html` | Phase 7A | 🔲 | OBS-only frame layout (not in renderer, but has theme-loader) |
| `frame-tri-wide-top.html` | Phase 7A | 🔲 | OBS-only frame layout (reverse tri-wide) |
| `stream.html` | Phase 7D | 🔲 | Standalone overlay version (alternative to inline renderers) |

#### Coverage Summary

| Phase | Graphics Count | Status |
|---|---|---|
| Phase 5-6 (Lower-Thirds) | 3 | ✅ Complete |
| Phase 7A (Full-Screen + Frames) | 12 | 🔲 Not Started |
| Phase 7B (Team Cards) | 18 | 🔲 Not Started |
| Phase 7C (Sponsors) | 2 | 🔲 Not Started |
| Phase 7D (Stream) | 3 | 🔲 Not Started |
| Phase 7E (Overlays + OBS-Direct) | 12 | 🔲 Not Started |
| Phase 7F (Playout / WTW) | 3 | 🔲 Not Started |
| Phase 8 (Live-Mode Fix) | — | 🔲 Not Started |
| Excluded | 3 | ⛔ |
| **Total** | **56** | |

---

## 5. Prerequisite: Fix Production Path Bug

**Before starting any phase**, fix the Firebase path bug where PlayoutEngine and WhoToWatchSequencer write to `competitions/{compId}/production/currentGraphic` but output.html only listens to `competitions/{compId}/currentGraphic`.

**Fix:** Change the write path in `server/lib/playoutEngine.js:984` and `server/index.js:854` from `/production/currentGraphic` to `/currentGraphic`.

**Prompt:** `docs/PRD-Theme-System-V2/prompt-fix-production-path.md`

---

## 6. Phases

### Phase 0: Audit & Graphic ID Registry — COMPLETE

**Goal:** Build the graphic ID registry and validate the CSS scope. No code changes.

**Tasks:**

0.1. **Build graphic ID registry** — Enumerate all graphic IDs from:
- `overlays/*.html` filenames (strip extension)
- `?graphic=` param values used in output.html renderers object
- Categorize each as `iframe` (10 renderers) or `inline` (34 renderers)
- Output: `overlays/graphic-ids.json`

0.2. **Audit `[data-meet-theme]` CSS rules** — Enumerate all rules in output.html's "MEET THEME OVERRIDES" section and in theme-overrides.css. Categorize as "both", "output.html only", or "overlay only". This is the full scope of what Phase 1 must reconcile.

0.3. **Audit pseudo-element usage** — Grep overlay HTML files and output.html for `::before`/`::after` on elements that Phase 3 would target for texture overlays. Document conflicts.

**Acceptance Criteria:**
- [ ] `overlays/graphic-ids.json` created with all graphic IDs and render mode
- [ ] `[data-meet-theme]` rule audit complete — full list of rules to port
- [ ] Pseudo-element audit complete

**No deployment. No documentation updates.**

---

### Phase 1: Theme Unification + Debug Panel — COMPLETE (except Task 1.9 deferred)

**Goal:** One theme code path for all graphics. Visual diagnostics for debugging. No FOUC on live broadcasts.

**Tasks:**

1.1. **Extend theme-loader.js to support competition config lookup** — Add a second initialization path:
- If `?meetTheme=` is present → use it (existing behavior). **This always takes precedence.**
- If `?comp=` is present and no `?meetTheme=` → read `competitions/{compId}/config/meetTheme` from Firebase, then fetch and apply the theme

theme-loader.js must expose a `window.themeReady` promise so output.html can gate rendering on it.

**Timeout requirement:** If the theme fetch takes longer than 3 seconds, resolve the promise with fallback colors AND **visibly flag the failure** — persistent warning banner or badge that the producer can see. Silent fallback is not acceptable.

1.1b. **Add meetTheme to PlayoutEngine writes** — The PlayoutEngine (server/lib/playoutEngine.js) must:
- Read `meetTheme` from `competitions/{compId}/config/meetTheme` during the `start()` method (alongside existing reads for `sessionKey`, `virtiusSessionId`, etc.)
- Cache it as `this._meetTheme`
- Include `meetTheme: this._meetTheme || ''` in the `data` object of every `_writeCurrentGraphic()` call (clip-playback, moment-replay, fallback, rotation-break, live-camera, content sequence items)
- This ensures iframe-rendered overlays triggered during playout (sponsor graphics in gap-fill, etc.) receive `meetTheme` as a URL param via output.html's renderers

**Why this matters:** Without this, sponsor graphics shown during rotation breaks in playout mode render without theme colors. The WhoToWatchSequencer already does this correctly (server/index.js reads meetTheme from config and includes it in every write). The PlayoutEngine is the only writer that doesn't.

1.2. **Add theme-loader.js to output.html** — Add `<script src="/overlays/theme-loader.js">` AFTER the Firebase SDK script tags.

1.3. **Port inline-only CSS rules to theme-overrides.css** — Using the Phase 0 audit, port all `[data-meet-theme]` rules that exist only in output.html into theme-overrides.css. Known scope (~68 rules):

| Graphic | Approximate Rules |
|---|---|
| Event Summary (header, footer, content, dual, quad, quad-v3) | ~22 |
| Leaderboard (header, footer, table, thead, th, tr, td, team-logo, badge) | ~25 |
| Warm-up (teams-row, teams-text, status-row, status-text) | ~6 |
| Replay (title-row, title-text, status-row, status-text) | ~6 |
| Event Bar (details, name, location) | ~3 |
| Texture targets (warm-up-container, replay-container) | ~4 |
| Event frame | ~2 |

1.4. **Reconcile class name differences** — Add overlay class names to output.html's inline-rendered HTML as ADDITIONAL classes (don't remove old ones). All 10 known differences:

| output.html class | overlay class |
|---|---|
| `.event-bar-logo` | `.logo-section` |
| `.warm-up-logo-section` | `.logo-section` |
| `.replay-logo-section` | `.logo-section` |
| `.warm-up-status-text` | `.status-text` |
| `.replay-status-text` | `.status-text` |
| `.event-bar-name` | `.teams-text` |
| `.event-bar-location` | `.location-text` |
| `.warm-up-status-row` | `.status-row` |
| `.replay-status-row` | `.status-row` |
| `.coaches-title` | `.hosts-title` |

1.5. **Convert inline theme CSS to use CSS variables** — Refactor the "MEET THEME OVERRIDES" inline section to read from the same `--meet-*` CSS variables that theme-loader.js sets. This makes the inline CSS a local fallback during migration.

1.6. **Gate live-mode rendering on theme readiness** — Add `themeReadyPromise` gate to the `currentGraphic` Firebase listener (output.html:13135). Same pattern preview mode already uses at line 13114. Only the first render waits; subsequent renders are instant.

1.7. **Build debug panel** — Togglable overlay (activated via `?debug=theme` URL param) that displays:
- Current theme ID (or "none")
- Each CSS variable: name, expected value, actual computed value, pass/fail
- Theme load status: success / timed out / failed (with visible warning)
- Logo data attribute status
- Rendering path (iframe vs inline)

1.8. **Verify all graphics + rundown integration test** — Playwright screenshots of each graphic with a test theme. Verify the rundown pipeline end-to-end: timesheetEngine → output.html → themed render.

1.9. **Remove inline theme CSS (after live-event gate)** — Keep inline CSS as fallback through at least one live event. After success, remove the "MEET THEME OVERRIDES" inline section AND the `applyMeetTheme()`/`loadMeetTheme()` JS functions. Re-run 1.8.

**Acceptance Criteria:**
- [ ] theme-loader.js supports both `?meetTheme=` and `?comp=` with timeout + visible failure flag
- [ ] `?meetTheme=` always takes precedence over `?comp=` config
- [ ] ~68 inline-only CSS rules ported to theme-overrides.css
- [ ] All 10 class name differences reconciled (new names added alongside old)
- [ ] Live-mode `currentGraphic` listener gates first render on theme promise
- [ ] Debug panel shows CSS variable states and theme load status
- [ ] Rundown integration test passes
- [ ] Inline "MEET THEME OVERRIDES" removed after live-event verification
- [ ] `applyMeetTheme()` and `loadMeetTheme()` removed after live-event verification

**Rollback:** `git revert` of Phase 1 commits. Overlay files unchanged.

**Documentation Updates (before Phase 3):**
- [ ] CLAUDE.md: Replace "Dual CSS Locations" section with "Unified Theme System"
- [ ] CLAUDE.md: Add debug panel instructions (`?debug=theme`)
- [ ] Memory: Remove references to "dual CSS locations"

---

### Phase 3: Per-Graphic Theme Overrides — COMPLETE

**Goal:** Override any theme property for a specific graphic type. Support images and textures.

**Tasks:**

3.1. **Extend theme-loader.js for overrides** — After applying global theme colors, filter the already-fetched `overrides` object for the current graphic ID. Apply override values as graphic-specific CSS variables (e.g., `--event-bar-header-bg`).

Graphic ID detection:
- Overlay files: extract from `window.location.pathname`
- output.html: read from `?graphic=` URL param

3.2. **Image/texture CSS injection** — When an override includes `headerBgImage`, `bodyBgImage`, or `bodyTexture`, set corresponding CSS variables. Add `background-image` properties (defaulting to `none`) to theme-overrides.css alongside existing `background-color` properties.

3.3. **Texture overlay implementation** — Use `::before` pseudo-elements for texture overlays (existing approach in theme-overrides.css:322-341 already covers most cases). Phase 0 audit identifies any conflicts.

3.4. **Update debug panel** — Show per-graphic override status: for each CSS variable, indicate whether value comes from Layer 1 (fallback), Layer 2 (theme default), or Layer 3 (graphic override).

**Acceptance Criteria:**
- [ ] Per-graphic color overrides work
- [ ] PNG/JPG background images render on header, body, and badge areas
- [ ] Texture overlays render with configurable blend mode and opacity
- [ ] Per-graphic logo override works
- [ ] Cascade: graphic override > theme default > hardcoded fallback
- [ ] Debug panel shows override source per property
- [ ] No additional Firebase reads (overrides from existing theme subtree fetch)

**Documentation Updates:**
- [ ] CLAUDE.md: Add "Per-Graphic Overrides" section

---

### Phase 4: Theme Editor — Per-Graphic Controls + Competition Preview — COMPLETE

**Goal:** UI for managing per-graphic overrides with live preview against real competition data.

**Tasks:**

4.1. **Competition selector** — Add a competition dropdown to the Theme Editor. When selected, preview panel shows graphics rendered with that competition's real data + the theme being edited. Preview URL: `output.html?graphic={type}&comp={compId}&meetTheme={themeId}` (meetTheme precedence rule ensures the editor's theme is always applied).

4.2. **Per-graphic override panel (MVP)** — Collapsible section listing all graphic IDs from the registry. Each expands to show color override fields (radio: "Use theme default" / "Custom color" + color picker). Saves to `themes/{themeId}/overrides/{graphicId}/`.

4.3. **Live iframe preview** — Iframe per graphic pointing to actual overlay URL with current theme + overrides. Reloads when override values change (debounced).

4.4. **Image/texture controls** — Extend override panels with:
- Image URL inputs + preview thumbnails
- Fit, position, opacity, blend mode controls
- Logo override with preview

4.5. **Override management UX** — Visual indicators of which graphics have overrides (badge/dot). "Reset to theme defaults" per graphic. "Reset all overrides" button.

4.6. **Orchestration sub-graphic previews** — The graphic selector dropdown (Task 4.1) must include the sub-graphics produced by playout and who-to-watch orchestration types. These are not visible through the standard graphic buttons but are critical for theme verification:

**Who-to-Watch sub-graphics:**

| Sub-Graphic | ID | Preview URL | What the Producer Needs to See |
|---|---|---|---|
| Title Card | `who-to-watch-title` | `/overlays/who-to-watch-title.html?meetTheme={id}&athleteName=Sample+Athlete&teamName=Sample+Team&headline=2x+All-American&body=Sample+body+text&imageUrl={sampleHeadshot}` | Full-screen card with theme colors on badge, headline bar, background, and bottom stripe. Verify text contrast, logo container background, watermark tinting. |
| Lower Third | `who-to-watch` | `/overlays/who-to-watch.html?meetTheme={id}&athleteName=Sample+Athlete&logo={sampleLogo}&subtitle=Floor+Exercise&statLabel=Season+High&statValue=9.950` | Lower-third card with theme colors on header bar and stat accent. Verify text legibility against themed background. |

Both are already iframe renderers with `?meetTheme=` support, so they work as standalone preview URLs with sample data.

**Playout sub-graphics:**

| Sub-Graphic | ID | Preview URL | What the Producer Needs to See |
|---|---|---|---|
| Clip Overlay | `clip-overlay` (new preview mode) | `output.html?mode=clip-preview&meetTheme={id}` | The athlete name panel (top-left) and score badge (top-right) with theme colors applied. Uses CSS variables `--meet-header-bg`, `--meet-header-text`, `--meet-badge-bg`, `--meet-badge-text`. |
| Gap-fill sponsors | `sponsors-thanks` / `sponsors-cycle` / `sponsors-bug` | Already previewable as standalone graphics | Sponsor graphics with theme colors — already covered by the standard graphic selector. |

**Clip overlay preview challenge:** The clip overlay (athlete panel + score badge) is rendered inline in output.html as part of `?mode=clip`. It is NOT a standalone graphic that can be previewed via `?graphic=`. To enable preview:
- Add a `?mode=clip-preview` mode to output.html that renders the clip overlay with sample data (sample athlete name, team logo, apparatus, score) and a static background — no actual video playback required
- This mode responds to theme CSS variables just like the real clip mode
- The Theme Editor's graphic selector includes "Clip Overlay" pointing to this preview mode

**Implementation note:** The sample data for WTW and clip overlay previews should come from the selected competition's roster if a competition is selected, or use hardcoded placeholder data ("Sample Athlete", "Sample Team") if no competition is selected.

**Acceptance Criteria:**
- [ ] Competition selector loads real competition data into preview
- [ ] Color overrides can be set per graphic
- [ ] Image, texture, and logo overrides can be set per graphic
- [ ] Live iframe preview updates on change
- [ ] Override indicators show which graphics have custom settings
- [ ] "Reset to defaults" works per graphic and globally
- [ ] Who-to-Watch title card and lower third are previewable in the graphic selector with theme applied
- [ ] Clip overlay is previewable in the graphic selector with theme colors applied (via `?mode=clip-preview`)
- [ ] Playout gap-fill sponsor graphics are previewable with theme applied (already covered by standard graphic IDs)

**Documentation Updates:**
- [ ] CLAUDE.md: Update Theme Editor section with per-graphic override instructions

---

### Phase 5: Bug Fixes + Rich Per-Graphic Layout Controls — COMPLETE

**Goal:** Fix the broken competition dropdown and preview errors. Build granular layout controls for the Event Bar graphic as a prototype for all graphics. Add save button + preview reload to the overrides section. Add theme-level background image controls. Full control over logo container (color, size, padding, radius).

**Tasks:**

5.1. **Fix competition dropdown** — The ThemeEditorPage Firebase query filters competitions to the last 60 days OR `status: 'active'`. This is too restrictive — most competitions have no `status` field and may be older than 60 days. Fix: show ALL competitions, sorted by event date descending (most recent first), with an optional search/filter input for long lists.

5.2. **Fix graphics preview placeholder data** — When "Use placeholder data" is selected and no competition is chosen, inline-rendered graphics (event-summary, event-bar, etc.) fail because they try to fetch Virtuis data. Fix: the preview URL must pass sample data params that let the renderer display a complete graphic without any backend calls. For Event Bar: pass `venue`, `eventName`, `location`, `team1Logo` as sample values.

5.3. **Add save button + preview reload to overrides section** — Add a "Save Overrides" button at the bottom of the per-graphic overrides panel (visible without scrolling back to the top). On save:
- Write overrides to `themes/{themeId}/overrides/{graphicId}/` in Firebase
- After 500ms (Firebase propagation), force-reload the preview iframe
- Show brief "Saved" confirmation feedback
- The top-level "Save Theme" button continues to save everything (colors + overrides together)

5.4. **Add CSS variable support for Event Bar layout properties** — Extend the CSS variable system so Event Bar layout properties can be controlled via overrides:

**CSS changes** (in output.html base styles and/or theme-overrides.css):
```css
.graphic-event-bar {
  bottom: var(--event-bar-bar-bottom, 120px);
  left: var(--event-bar-bar-left, 100px);
}
.event-bar-logo {
  width: var(--event-bar-logo-container-width, 100px);
}
.event-bar-logo img {
  width: var(--event-bar-logo-img-size, 70px);
  height: var(--event-bar-logo-img-size, 70px);
}
.event-bar-venue {
  font-size: var(--event-bar-venue-font-size, 36px);
  min-width: var(--event-bar-bar-min-width, 600px);
}
.event-bar-name {
  font-size: var(--event-bar-name-font-size, 28px);
}
.event-bar-location {
  font-size: var(--event-bar-location-font-size, 24px);
}
```

**theme-loader.js changes:** Extend `applyOverrides()` to map the new layout override keys to CSS variables. The mapping follows the same pattern as color overrides — read from `theme.overrides[graphicId]`, set as CSS variables on `document.documentElement`.

| Firebase Key | CSS Variable | Default |
|---|---|---|
| `barBottom` | `--event-bar-bar-bottom` | 120px |
| `barLeft` | `--event-bar-bar-left` | 100px |
| `logoImgSize` | `--event-bar-logo-img-size` | 70px |
| `logoContainerWidth` | `--event-bar-logo-container-width` | 100px |
| `logoContainerHeight` | `--event-bar-logo-container-height` | auto |
| `logoBg` | `--event-bar-logo-bg` | rgba(255,255,255,0.92) |
| `logoPadding` | `--event-bar-logo-padding` | 15px |
| `logoRadius` | `--event-bar-logo-radius` | 0px |
| `showLogo` | `--event-bar-show-logo` | flex |
| `venueFontSize` | `--event-bar-venue-font-size` | 36px |
| `barMinWidth` | `--event-bar-bar-min-width` | 600px |
| `nameFontSize` | `--event-bar-name-font-size` | 28px |
| `locationFontSize` | `--event-bar-location-font-size` | 24px |

**Show/hide logo:** `showLogo: false` sets `--event-bar-show-logo: none` which is used as `display: var(--event-bar-show-logo, flex)` on `.event-bar-logo`.

5.5. **Build rich Event Bar control panel in Theme Editor** — Replace the current flat color-checkbox grid for event-bar with a structured control panel modeled on the WTW title card's Card Adjustments pattern. Uses the existing `ValueStepper` component for all numeric controls.

**Control sections:**

**POSITION**
| Control | Default | Min | Unit | Description |
|---------|---------|-----|------|-------------|
| Bottom | 120 | 0 | px | Distance from bottom of screen |
| Left | 100 | 0 | px | Distance from left of screen |

**LOGO**
| Control | Default | Min | Unit | Description |
|---------|---------|-----|------|-------------|
| Logo size | 70 | 16 | px | Logo image width/height |
| Box width | 100 | 40 | px | Logo container width |
| Box height | auto | 0 | px | Logo container height (0 = auto) |
| Padding | 15 | 0 | px | Space between logo and container edge |
| Radius | 0 | 0 | px | Border radius on logo container |
| Box background | white | — | color | Logo container background color (with reset) |
| Show logo | true | — | toggle | Show/hide entire logo section |
| Logo URL | (theme) | — | URL | Override logo image (existing) |

**VENUE (Header Bar)**
| Control | Default | Min | Unit | Description |
|---------|---------|-----|------|-------------|
| Font size | 36 | 12 | px | Venue name text size |
| Bar min-width | 600 | 200 | px | Minimum width of the header bar |
| Background | (theme) | — | color | Header bar background color (existing) |
| Text color | (theme) | — | color | Header bar text color (existing) |

**TEXT (Details Section)**
| Control | Default | Min | Unit | Description |
|---------|---------|-----|------|-------------|
| Event name size | 28 | 12 | px | Event name font size |
| Location size | 24 | 12 | px | Location line font size |
| Background | (theme) | — | color | Details section background (existing `contentArea`) |
| Text color | (theme) | — | color | Details text color (existing `textOnContent`) |

**IMAGES / TEXTURES** (existing controls, reorganized into this section)
| Control | Description |
|---------|-------------|
| Header background image | URL + fit + position + opacity (existing) |
| Body texture overlay | URL + blend mode + opacity (existing) |

Each control uses `ValueStepper` with:
- `-` and `+` buttons for quick adjustment
- Direct text input for precise values
- `x` reset button to revert to default
- Debounced preview reload (300ms) on any change

**Save flow:** Each change is held in local state. "Save Overrides" button writes all values to Firebase. Preview reloads after save. Color controls are integrated inline with the layout sections (not in a separate grid).

5.6. **Verify Event Bar controls end-to-end** — Playwright verification:
- Change venue font size → save → preview shows updated size
- Change bar position → save → preview shows bar in new position
- Hide logo → save → preview shows bar without logo
- Change event name font size → save → verify
- Reset all → verify defaults restored
- Deploy to production → verify on commentarygraphic.com

5.7. **Add theme-level background image controls** — The main Theme Editor form (COLORS section) only had flat color pickers with no way to set background images at the theme level. Per-graphic overrides supported images, but theme-level did not. Fix:
- Add "BACKGROUND IMAGES" section between COLORS and LOGOS in the editor form
- Three fields: Header Background Image, Body Background Image, Texture Overlay
- Each shows fit/position/opacity controls when a URL is entered
- Extend theme-loader.js to set `--meet-header-bg-image` and `--meet-body-bg-image` CSS variables from `themes/{id}/images/`
- Update theme-overrides.css cascade: per-graphic image vars fall back to theme-level vars (`--meet-header-bg-image`) instead of `none`
- Cascade: per-graphic image → theme-level image → none

**Firebase path:** `themes/{themeId}/images/`
```
themes/{themeId}/images/
  headerBgImage: "https://..."
  headerBgImageFit: "cover"
  headerBgImagePosition: "center"
  headerBgImageOpacity: 1.0
  bodyBgImage: "https://..."
  bodyBgImageFit: "cover"
  bodyBgImagePosition: "center"
  bodyBgImageOpacity: 1.0
```

5.8. **Full logo container controls** — The Event Bar's white logo square was not controllable. Added CSS variables and UI controls for:
- `--event-bar-logo-bg`: background color (default: `rgba(255,255,255,0.92)` when themed, `#BFBFBF` unthemed)
- `--event-bar-logo-container-height`: explicit height (default: `auto`)
- `--event-bar-logo-padding`: internal spacing (default: `15px`)
- `--event-bar-logo-radius`: border radius (default: `0px`)
- Color picker with reset button for the box background
- ValueStepper controls for height, padding, and radius

**Acceptance Criteria:**
- [x] Competition dropdown shows all competitions (not filtered to 60 days)
- [x] Graphics preview renders with placeholder data when no competition selected (no error messages)
- [x] "Save Overrides" button visible in per-graphic overrides section
- [x] Preview iframe reloads after save
- [x] Event Bar layout CSS variables work (position, sizes, visibility)
- [x] Event Bar control panel has organized sections: POSITION, LOGO, VENUE, TEXT, IMAGES/TEXTURES
- [x] ValueStepper controls for all numeric properties
- [x] Show/hide logo toggle works
- [x] Color controls integrated inline with layout sections
- [x] Reset to defaults works per-section and globally
- [x] Changes persist after page reload (stored in Firebase overrides)
- [x] Live broadcast unaffected (CSS variables fall back to defaults when no overrides set)
- [x] Theme-level Background Images section in main editor (header, body, texture)
- [x] Theme-level image CSS variables cascade to all graphics
- [x] Per-graphic image overrides take precedence over theme-level images
- [x] Logo container background color controllable with color picker + reset
- [x] Logo container height, padding, and border radius controllable via ValueStepper
- [x] Deployed to production and verified on commentarygraphic.com

**Documentation Updates:**
- [ ] CLAUDE.md: Update Theme Editor section with per-graphic layout controls
- [ ] CLAUDE.md: Update Per-Graphic Overrides section with layout override keys
- [ ] agent.md: Add Event Bar CSS variable mapping and control panel architecture

**Rollback:** `git revert` of Phase 5 commits. Existing color overrides unaffected.

**Future:** Once Event Bar controls are validated, the same pattern extends to other graphics (warm-up, replay, event-summary, sponsors, etc.) — each gets its own set of layout controls specific to its elements.

---

### Phase 6: Lower-Third Height Controls + Template System — COMPLETE

**Goal:** Add missing height controls for venue header bar and text details section. Add a "Lower-Third Template" system that lets producers configure all lower-third bars (event-bar, warm-up, replay) from a single set of controls, then fine-tune individual graphics.

**Problem:**
1. **Missing height controls.** The venue header bar and text details section have no height override — their height is determined dynamically by font size + padding. When the logo box is set to a specific height, the venue bar and details section don't match because they auto-size to their content. The producer needs explicit height overrides to force visual alignment across the three sections.
2. **Missing padding controls.** The venue header bar and text details section padding (currently hardcoded `10px 40px`) cannot be adjusted. Padding directly affects perceived height and text alignment.
3. **No template system for lower-thirds.** Event-bar, warm-up, and replay are structurally identical lower-third graphics (logo box + header row + details row). Currently, each must be configured individually. Producers need a way to set values once and apply them to all three, then tweak individual differences.

**Tasks:**

6.1. **Add height + padding CSS variables for venue bar and details section** — Extend the CSS variable system for event-bar:

| Firebase Key | CSS Variable | Default | Description |
|---|---|---|---|
| `venueHeight` | `--event-bar-venue-height` | auto | Venue header bar height |
| `venuePaddingV` | `--event-bar-venue-padding-v` | 10px | Venue vertical padding |
| `venuePaddingH` | `--event-bar-venue-padding-h` | 40px | Venue horizontal padding |
| `detailsHeight` | `--event-bar-details-height` | auto | Details section height |
| `detailsPaddingV` | `--event-bar-details-padding-v` | 10px | Details vertical padding |
| `detailsPaddingH` | `--event-bar-details-padding-h` | 40px | Details horizontal padding |

CSS changes in output.html:
```css
.event-bar-venue {
  height: var(--event-bar-venue-height, auto);
  padding: var(--event-bar-venue-padding-v, 10px) var(--event-bar-venue-padding-h, 40px);
  display: flex;
  align-items: center;  /* vertically center text when height is explicit */
}
.event-bar-details {
  height: var(--event-bar-details-height, auto);
  padding: var(--event-bar-details-padding-v, 10px) var(--event-bar-details-padding-h, 40px);
  display: flex;
  flex-direction: column;
  justify-content: center;  /* vertically center text when height is explicit */
}
```

6.2. **Add height + padding controls to Event Bar editor panel** — Extend VENUE and TEXT sections:

**VENUE (Header Bar)** — add after existing controls:
| Control | Default | Min | Max | Step | Unit |
|---------|---------|-----|-----|------|------|
| Height | 0 (auto) | 0 | 200 | 4 | px |
| Padding V | 10 | 0 | 60 | 2 | px |
| Padding H | 40 | 0 | 100 | 4 | px |

**TEXT (Details Section)** — add after existing controls:
| Control | Default | Min | Max | Step | Unit |
|---------|---------|-----|-----|------|------|
| Height | 0 (auto) | 0 | 200 | 4 | px |
| Padding V | 10 | 0 | 60 | 2 | px |
| Padding H | 40 | 0 | 100 | 4 | px |

6.3. **Add CSS variables for warm-up and replay** — Port the same layout CSS variable pattern from event-bar to warm-up and replay. These are currently hardcoded in output.html (lines 5889-5985).

New CSS variables (warm-up):

| CSS Variable | Default | Maps to |
|---|---|---|
| `--warm-up-bar-bottom` | 120px | `.graphic-warm-up { bottom }` |
| `--warm-up-bar-left` | 100px | `.graphic-warm-up { left }` |
| `--warm-up-logo-container-width` | 100px | `.warm-up-logo-section { width }` |
| `--warm-up-logo-container-height` | auto | `.warm-up-logo-section { height }` |
| `--warm-up-logo-img-size` | 70px | `.warm-up-logo-section img { width, height }` |
| `--warm-up-logo-bg` | #BFBFBF | `.warm-up-logo-section { background }` |
| `--warm-up-logo-padding` | 15px | `.warm-up-logo-section { padding }` |
| `--warm-up-logo-radius` | 0px | `.warm-up-logo-section { border-radius }` |
| `--warm-up-show-logo` | flex | `.warm-up-logo-section { display }` |
| `--warm-up-venue-font-size` | 30px | `.warm-up-teams-text { font-size }` |
| `--warm-up-venue-height` | auto | `.warm-up-teams-row { height }` |
| `--warm-up-venue-padding-v` | 10px | `.warm-up-teams-row { padding top/bottom }` |
| `--warm-up-venue-padding-h` | 40px | `.warm-up-teams-row { padding left/right }` |
| `--warm-up-bar-min-width` | 450px | `.warm-up-teams-row { min-width }` |
| `--warm-up-name-font-size` | 28px | `.warm-up-status-text { font-size }` |
| `--warm-up-details-height` | auto | `.warm-up-status-row { height }` |
| `--warm-up-details-padding-v` | 10px | `.warm-up-status-row { padding top/bottom }` |
| `--warm-up-details-padding-h` | 40px | `.warm-up-status-row { padding left/right }` |

Replay gets identical variables with `--replay-` prefix. Replay's "teams-row" equivalent is "title-row" and "status-row" maps the same way.

6.4. **Build Lower-Third Template system in Theme Editor** — Add a "LOWER-THIRD TEMPLATE" section at the top of the Lower-Third Bars category, above the individual graphic panels.

**How it works:**
1. Template section has the same controls as the event-bar rich panel (POSITION, LOGO, VENUE, TEXT, IMAGES)
2. When the producer changes a template value, it writes the same value to ALL three lower-third graphics (event-bar, warm-up, replay) in `themes/{themeId}/overrides/`
3. Individual graphic panels still exist below — the producer can expand any one and tweak values that differ
4. Template values are stored at `themes/{themeId}/lowerThirdTemplate/` in Firebase for persistence
5. "Apply Template" button pushes template values to all three graphics. Individual overrides that differ from the template are preserved (merge, not replace)
6. Visual indicator on each graphic panel shows which values differ from the template

**Firebase path:**
```
themes/{themeId}/lowerThirdTemplate/
  barBottom: 120
  barLeft: 100
  logoImgSize: 70
  logoContainerWidth: 100
  ... (same keys as per-graphic overrides)
```

**Save flow:**
- Edit template → "Apply to All Lower-Thirds" button → writes values to event-bar, warm-up, and replay overrides
- Edit individual graphic → only that graphic's overrides change
- Template is a convenience tool, not a live binding — after applying, the three graphics have independent override values

6.5. **Add rich control panels for warm-up and replay** — Clone the event-bar rich panel pattern for warm-up and replay graphics. Same sections (POSITION, LOGO, VENUE, TEXT, IMAGES) with their respective CSS variable mappings and defaults (warm-up uses 30px header font, 450px min-width; replay uses same).

6.7. **Fix "0 = auto" height display convention** — The height steppers for venue, details, and logo box all showed "0" when no explicit height was set. This was confusing because the elements visually have real pixel heights — they're just calculated dynamically by the browser from font size + padding. Producers saw "0" and thought the height was literally zero.

**Fix:** Replace the "0 = auto" convention with **computed effective heights**. Three helper functions calculate the approximate rendered height from current font sizes and padding:

```javascript
getEffectiveVenueHeight(overrides, graphicId)    // fontSize * 1.2 + paddingV * 2
getEffectiveDetailsHeight(overrides, graphicId)   // (nameFontSize + locationFontSize) * 1.2 + paddingV * 2
getEffectiveLogoHeight(overrides, graphicId)      // venueHeight + detailsHeight (flexbox stretch)
```

- When no override is set, the stepper shows the **computed pixel value** (e.g., "63px" instead of "0")
- The CSS still uses `auto` as the fallback (no visual change without overrides)
- When the producer adjusts the stepper, it writes an explicit pixel value to Firebase
- Minimum height changed from 0 to 20px (prevents accidentally collapsing a section)
- "Pad V" and "Pad H" labels renamed to "Top/btm" and "Left/right" for clarity

**Note:** The computed estimates are a fallback only — see Task 6.8 for the pixel-perfect measurement system.

6.8. **Pixel-perfect height measurements via postMessage** — The computed estimates (fontSize * 1.2 + padding) are only approximate — they don't account for actual font rendering, line-height, and browser layout. Replace estimates with real measurements from the preview iframe.

**How it works:**
1. Theme Editor renders the preview iframe with the current graphic + theme
2. After the iframe loads (1.5s delay for render), the editor sends a `postMessage` to the iframe: `{ type: 'measureHeights', graphic: 'event-bar', selectors: { logo: '.event-bar-logo', venue: '.event-bar-venue', details: '.event-bar-details' } }`
3. output.html receives the message, calls `getBoundingClientRect().height` on each selector, rounds to integer, and posts back: `{ type: 'heightMeasurements', graphic: 'event-bar', measurements: { logo: 100, venue: 56, details: 72 } }`
4. The editor stores these in `measuredHeights` state and the steppers show the real pixel values

**Fallback chain for height steppers:** `explicit override → measured from iframe → computed estimate`

**Selector mapping:**

| Graphic | Logo | Venue/Header | Details |
|---------|------|-------------|---------|
| event-bar | `.event-bar-logo` | `.event-bar-venue` | `.event-bar-details` |
| warm-up | `.warm-up-logo-section` | `.warm-up-teams-row` | `.warm-up-status-row` |
| replay | `.replay-logo-section` | `.replay-title-row` | `.replay-status-row` |

**Key files changed:**
- `output.html`: Added `measureHeights` handler in the existing `message` event listener
- `ThemeEditorPage.jsx`: Added `previewIframeRef`, `measuredHeights` state, `requestMeasurements()` callback, `getMeasuredHeight()` helper

6.9. **Verify + Deploy** — Playwright verification:
- Set template values → apply to all → all three lower-thirds match
- Override one graphic individually → only that one changes
- Height controls work — venue bar and details section heights can be set explicitly
- Logo box height matches venue + details total height
- Deploy to production

**Acceptance Criteria:**
- [x] Venue header bar height controllable via CSS variable + editor
- [x] Details section height controllable via CSS variable + editor
- [x] Padding (vertical + horizontal) controllable for both sections
- [x] Warm-up and replay have full CSS variable support matching event-bar
- [x] Lower-Third Template section in Theme Editor
- [x] "Apply to All Lower-Thirds" propagates template values to all three graphics
- [x] Individual graphics can override template values
- [x] Rich control panels for warm-up and replay (matching event-bar layout)
- [x] Heights align: logo box height = venue height + details height when all three set explicitly
- [x] Deployed and verified on production

**Documentation Updates:**
- [x] CLAUDE.md: Add Lower-Third Template section — completed in Task 8.DOC (2026-03-26)
- [x] CLAUDE.md: Update Per-Graphic Overrides with height/padding keys — already present in CLAUDE.md
- [x] CLAUDE.md: Add live-mode override system docs (Phase 8A) — completed in Task 8.DOC (2026-03-26)
- [x] PRD: Update status summary (done in v3.1 update)

---

### Phase 7: Full Graphic Control — All Categories — NOT STARTED

**Goal:** Apply the Phase 6 lower-third pattern to every graphic category. Each sub-phase converts hardcoded CSS to variables, builds rich editor controls, adds category templates, variant selectors, and pixel-perfect iframe measurements. Adds font controls (family, weight, text-transform) to all graphics.

**Note:** Phase 2 has been deferred to a future PRD. Phase numbering is preserved as-is.

**Depends on:** Phase 6 complete (pattern established).

#### The Pattern (Established in Phase 6)

1. **Convert hardcoded CSS values to CSS variables** with `var(--{graphicId}-{property}, {default})` — zero visual change when no override is set
2. **Add CSS variable keys to the layout mapping** in theme-loader.js `applyOverrides()` — extends existing `overrideMapping`, `imageOverrideMapping`, `layoutOverrideMapping` objects
3. **Build a rich control panel** in ThemeEditorPage.jsx with organized sections using OverrideStepper components
4. **Measure actual rendered sizes** from the preview iframe via `postMessage` + `getBoundingClientRect()` — pixel-perfect defaults, NOT computed estimates
5. **Add a category template** with "Apply to All" that writes shared values to all graphics in the group
6. **Deploy and verify** via Playwright screenshots using WCGNIC competition data on production

#### Cross-Cutting: Font Controls (All Sub-Phases)

Every graphic in Phase 7 gets font controls in addition to size/position/color controls:

| Control | CSS Property | CSS Variable Pattern | Firebase Key Pattern | Editor Control |
|---------|-------------|---------------------|---------------------|----------------|
| Font family | `font-family` | `--{graphicId}-{element}-font-family` | `{element}FontFamily` | Dropdown: Inter (sans-serif), Roboto Mono (tabular), system fonts |
| Font weight | `font-weight` | `--{graphicId}-{element}-font-weight` | `{element}FontWeight` | Dropdown: 400/500/600/700/800 |
| Text transform | `text-transform` | `--{graphicId}-{element}-text-transform` | `{element}TextTransform` | Dropdown: uppercase/lowercase/capitalize/none |

**Why:** Event bar currently forces uppercase everywhere. Producer needs mixed case options. Team card stat numbers need tabular/monospaced fonts for alignment.

**Font family dropdown options** (extend as needed):
- Inter (sans-serif) — current default
- Inter Tight (sans-serif, condensed)
- Roboto Mono (monospace, tabular) — for score numbers
- JetBrains Mono (monospace, tabular)
- System UI (system default)

Font controls apply **per-element** within each graphic (e.g., venue text, name text, location text, score numbers can each have different fonts).

#### Cross-Cutting: Font Loading Strategy

**Problem:** Phase 7 adds font family options (Inter Tight, Roboto Mono, JetBrains Mono) but none of these are currently loaded in output.html or overlay files. Currently:
- output.html loads **only** Inter (6 weights: 400-900) via one Google Fonts request
- 17 overlay files each load their own Inter Google Fonts link independently (redundant requests)
- interview-card.html loads Poppins (6 weights) separately
- Frame overlays use Arial (system font, no load needed)

**Task (cross-cutting, before first sub-phase deploys):**

7.FONT.1. **Consolidate and extend font loading in output.html** — Replace the single Inter import with a consolidated multi-family request:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```
This is still a single HTTP request to Google Fonts (they batch multiple families). `display=swap` ensures no FOIT (Flash of Invisible Text).

7.FONT.2. **Update overlay files to inherit fonts** — Overlay files loaded as iframes make their own font requests. For iframe overlays, keep the individual Google Fonts links (iframes are separate documents). But consolidate weights: use `wght@400;600;700;800;900` consistently (drop unnecessary 500 weight where not used).

7.FONT.3. **Add font family dropdown metadata** — Each font option in the dropdown needs metadata:

| Font | Type | Tabular Numbers | Use Case |
|---|---|---|---|
| Inter | Sans-serif | No | Default — body text, titles |
| Inter Tight | Sans-serif, condensed | No | Compact layouts, dense tables |
| Roboto Mono | Monospace | Yes (`font-variant-numeric: tabular-nums` built-in) | Score numbers, stat values |
| JetBrains Mono | Monospace | Yes | Alternative monospace for scores |
| Poppins | Sans-serif, rounded | No | Interview card (existing), friendly/soft aesthetic |
| Arial / Arial Black | System sans-serif | No | Frame overlays (no load needed) |
| System UI | System default | Varies | Fallback |

**OBS browser source consideration:** OBS Chromium has full network access and caches Google Fonts after first load. No special handling needed. If network is unavailable at load time, `display=swap` ensures the fallback font (sans-serif) renders immediately.

7.FONT.4. **Add font preconnect** — Add preconnect hints before the font link for faster loading:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

#### Cross-Cutting: Template Key Filtering

When "Apply to All" pushes template values to all graphics in a category, **skip keys that don't apply** to a specific graphic. For example, `locationFontSize` applies to event-bar but not warm-up (which has no location line). The template system must maintain a per-graphic "applicable keys" list to avoid writing meaningless overrides.

**Lower-Third Template key filtering (already needed in Phase 6):**

| Key | event-bar | warm-up | replay | Notes |
|---|---|---|---|---|
| `barBottom`, `barLeft` | ✅ | ✅ | ✅ | All three have position |
| `logoImgSize`, `logoContainerWidth`, etc. | ✅ | ✅ | ✅ | All three have logos |
| `venueFontSize`, `venueHeight`, etc. | ✅ | ✅ | ✅ | All have header row |
| `nameFontSize` | ✅ | ✅ | ✅ | All have primary text |
| `locationFontSize` | ✅ | ❌ | ❌ | Only event-bar has location line |
| `detailsHeight`, `detailsPaddingV/H` | ✅ | ✅ | ✅ | All have details row |

The `applyLowerThirdTemplate()` function in ThemeEditorPage.jsx must skip `locationFontSize` when writing to warm-up and replay overrides.

---

### Phase 7A: Full-Screen Graphics — NOT STARTED

**Goal:** Rich controls for event-summary (28 layout variants), virtuis-leaderboard (18 event×gender variants), event-frame (5 renderer variants + 3 OBS-only overlay variants), sponsors-thanks, team-roster, and frame overlays.

**Spec files:** `specs/event-summary-audit.md`, `specs/virtuis-leaderboard-audit.md`, `specs/event-frame-audit.md`, `specs/sponsors-thanks-audit.md`, `specs/team-roster-audit.md`

**Template:** "Full-Screen Template" applies shared values (header height, padding, font sizes, content padding, container offsets).

**Category note:** sponsors-thanks and team-roster are full-screen graphics structurally identical to event-summary/leaderboard. They belong in this category, not Sponsors or Overlays.

#### Variant Selectors

| Graphic | Variants Found | Variant Params | Preview URL Pattern |
|---|---|---|---|
| event-summary | **28 layouts**: broadcast-table, classic-broadcast, default-v2 through default-v24, dual-dynamic-v1, dual-dynamic-v2, split-row | `summaryNumTeams` (2-7) + `summaryMode` (rotation/apparatus) + `layout` | `output.html?graphic=event-summary&comp={compId}&meetTheme={id}&summaryNumTeams=4&layout=quad-v3` |
| virtuis-leaderboard | **18 combinations**: 9 events (fx,ph,sr,vt,pb,hb,ub,bb,aa) × 2 genders. AA variant removes Apparatus/Diff/Exec/SB columns. Women's removes Exec/SB. | `leaderboardEvent` + `leaderboardGender` | `output.html?graphic=virtuis-leaderboard&comp={compId}&meetTheme={id}&leaderboardEvent=fx&leaderboardGender=mens` |
| event-frame | **5 renderer variants**: quad (2×2), tri-center (2+1 centered), tri-wide (2+1 spanning), single, team-header. **Plus 3 OBS-only overlay variants**: frame-dual (side-by-side), frame-tri-wide-top (reverse tri-wide), event-frame (header+content wrapper) | `frameLayout` param or separate graphic IDs (frame-quad, frame-tri-center, etc.) | `output.html?graphic=frame-quad&comp={compId}&meetTheme={id}` |
| sponsors-thanks | 1 (responsive grid adapts by sponsor count 1-8) | N/A | `/overlays/sponsors-thanks.html?meetTheme={id}&sponsors={json}` |
| team-roster | 1 | N/A | `/overlays/team-roster.html?meetTheme={id}&comp={compId}` |

#### Bug Fixes (7A)

**7A-BUG-1: sponsors-thanks preview shows "not configured"** — The preview iframe loads `sponsors-thanks.html` but doesn't pass the `sponsors` URL param with JSON-encoded sponsor data. Fix: ThemeEditorPage must read `themes/{themeId}/sponsors` and pass it as `?sponsors={encodeURIComponent(JSON.stringify(sponsors))}` in the preview URL. When no theme is selected or theme has no sponsors, show placeholder sponsors.

#### Tasks

7A.1. **Convert event-summary CSS to variables** — Port all hardcoded values from 28 layouts (lines 496-839, 1348-1537, 1540-2905, 2919-3461, 5603-5808 + default-v3 through default-v24) to CSS variables. See `specs/event-summary-audit.md` for complete variable tables. The 28 layouts are: broadcast-table, classic-broadcast, default-v2 through default-v24, dual-dynamic-v1, dual-dynamic-v2, split-row. Layout is determined by the `summaryTheme` data parameter (`layout-{name}` prefix). Add font controls (family, weight, text-transform) for: title, team-name, athlete-name, athlete-score, event-label, footer-total.

7A.2. **Convert virtuis-leaderboard CSS to variables** — Port ~60 hardcoded values (lines 281-492) to CSS variables. See `specs/virtuis-leaderboard-audit.md`. Add font controls for: title, th, td, score, diff/exec, apparatus-badge. Note: `font-variant-numeric: tabular-nums` must be preserved — font family dropdown must flag which fonts support tabular numbers.

7A.3. **Convert event-frame CSS to variables** — Port 42 values across 5 variants (lines 249-278, 6096-6195). See `specs/event-frame-audit.md`. Add font controls for: title, watermark.

7A.4. **Convert sponsors-thanks CSS to variables** — Port ~40 values (overlay file). See `specs/sponsors-thanks-audit.md`. Responsive grid columns (count-1 through count-7-8) need per-count-range variables. Add font controls for: header-title, fallback-text.

7A.5. **Convert team-roster CSS to variables** — Port all values (overlay file). See `specs/team-roster-audit.md`. Add font controls for: header, athlete-name.

7A.6. **Fix sponsors-thanks preview bug (7A-BUG-1)** — Pass sponsor data as URL param in preview iframe.

7A.7. **Add variant selectors to Theme Editor** — Dropdowns for event-summary (layout + team count), leaderboard (event + gender), event-frame (frame type). Preview updates on variant change.

7A.8. **Build rich control panels** — One panel per graphic with organized sections (POSITION, HEADER, CONTENT, FOOTER, TEXT, IMAGES). Font controls in each TEXT section.

7A.9. **Build Full-Screen Template** — Shared values across all full-screen graphics. "Apply to All Full-Screen" button. Template stored at `themes/{themeId}/fullScreenTemplate/`.

7A.10. **Add measurement selectors** — postMessage selector mappings for all full-screen graphics:
```javascript
'event-summary': { header: '.event-summary-header', content: '.event-summary-content', footer: '.event-summary-footer' },
'virtuis-leaderboard': { header: '.graphic-virtius-leaderboard .frame-header', table: '.leaderboard-table', row: '.leaderboard-table tbody tr' },
'event-frame': { header: '.graphic-event-frame .frame-header', content: '.graphic-event-frame .frame-content' },
'sponsors-thanks': { header: '.header-bar', grid: '.sponsors-grid' },
'team-roster': { header: '.roster-header', content: '.roster-content' }
```

7A.11. **Deploy + verify with WCGNIC data** — Use WCGNIC competition to verify all full-screen graphics render correctly with overrides on production.

**Acceptance Criteria:**
- [ ] All 28 event-summary layouts have CSS variable support
- [ ] Variant selector lets producer preview each layout with WCGNIC data
- [ ] Leaderboard variant selector covers all 9 events × 2 genders
- [ ] sponsors-thanks preview renders sponsors (not "not configured")
- [ ] Font controls work on all text elements (family, weight, text-transform)
- [ ] Full-Screen Template "Apply to All" works
- [ ] All sizes/heights from pixel-perfect iframe measurements
- [ ] Deployed and verified on commentarygraphic.com

---

### Phase 7B: Team Cards — NOT STARTED

**Goal:** Rich controls for team-stats and team-coaches. Add data source override (average vs NQS vs other available stats). Add tabular/monospaced font option for score numbers.

**Spec files:** `specs/team-stats-audit.md`, `specs/team-coaches-audit.md`

**Template:** "Team Cards Template" applies shared values to all team stat and coach cards. All team1-7-stats share identical CSS. All team1-7-coaches share identical CSS.

#### Data Source Override (team-stats)

**Current state:** Static renderers (team1-stats through team7-stats) always show AVG + HIGH. The dynamic renderer fetches NQS but never renders it.

**Required:** A dropdown in the Theme Editor's team-stats override panel that lets the producer choose which stats to display:

| Dropdown Option | Label 1 | Value 1 Source | Label 2 | Value 2 Source |
|---|---|---|---|---|
| Average + High (default) | AVG | `team{slot}Ave` | HIGH | `team{slot}High` |
| NQS + High | NQS | `team{slot}Nqs` | HIGH | `team{slot}High` |
| Average + NQS | AVG | `team{slot}Ave` | NQS | `team{slot}Nqs` |
| NQS only | NQS | `team{slot}Nqs` | — | hidden |
| Average only | AVG | `team{slot}Ave` | — | hidden |

**Firebase path:** `themes/{themeId}/overrides/team-stats/statDisplay` — stores the selected option key.

**Implementation:** Modify the team-stats renderer to read the stat display config from the theme override and render accordingly. The static renderers (team1-stats through team7-stats) must also support this — either by calling a shared function or by being replaced with the dynamic renderer.

**Font requirement:** Stat numbers (the actual score values like "196.450") need a tabular/monospaced font option. The font family dropdown for `.stat-value` should prominently offer Roboto Mono and JetBrains Mono with "(tabular)" labels.

#### Tasks

7B.1. **Convert team-stats CSS to variables** — Port 24 hardcoded values (lines 170-210). See `specs/team-stats-audit.md`. Key values: top 780px, left 100px, header bg #d4d4d8, title 36px, content bg #000, stat-label 20px, stat-value 28px. Add font controls for: team-name (currently uppercase), stat-label, stat-value.

7B.2. **Convert team-coaches CSS to variables** — Port 17 hardcoded values (lines 213-246). See `specs/team-coaches-audit.md`. Key values: top 780px, left 100px, header bg #d4d4d8, title 36px, content bg #000, coach-name 24px. Add font controls for: title, coach-name.

7B.3. **Build data source override** — Add stat display dropdown to team-stats override panel. Modify renderer to read config and display selected stats. Support for static renderers (team1-7-stats).

7B.4. **Build rich control panels** — Sections: POSITION, HEADER (bg, padding, min-width, title font/weight/transform, logo size), CONTENT (bg, padding, gap), STAT DISPLAY (stat source dropdown, label font, value font with tabular option), IMAGES.

7B.5. **Build Team Cards Template** — Shared values for all team-stats and team-coaches. "Apply to All Team Cards" button. Template stored at `themes/{themeId}/teamCardsTemplate/`.

7B.6. **Add measurement selectors** —
```javascript
'team-stats': { header: '.stats-header', content: '.stats-content' },
'team-coaches': { header: '.coaches-header', content: '.coaches-content' }
```

7B.7. **Deploy + verify with WCGNIC data**

**Acceptance Criteria:**
- [ ] Team-stats shows correct data based on stat display dropdown (AVG/NQS/HIGH combinations)
- [ ] Stat value font can be changed to tabular/monospaced
- [ ] Team name text-transform can be changed from uppercase to mixed
- [ ] All 14 team card variants (7 stats + 7 coaches) work with overrides
- [ ] Team Cards Template "Apply to All" works
- [ ] Deployed and verified

---

### Phase 7C: Sponsors (Cycle + Bug) — NOT STARTED

**Goal:** Rich controls for sponsors-cycle and sponsors-bug. (sponsors-thanks moved to Phase 7A Full-Screen.)

**Spec files:** `specs/sponsors-cycle-audit.md`, `specs/sponsors-bug-audit.md`

**Template:** "Sponsors Template" applies shared header colors/fonts. Limited because these two graphics are structurally very different.

#### Tasks

7C.1. **Convert sponsors-cycle CSS to variables** — See `specs/sponsors-cycle-audit.md`. Key controls: slide duration, fade speed, logo max size, background color. Add font controls for: header-title.

7C.2. **Convert sponsors-bug CSS to variables** — Port 10 values. See `specs/sponsors-bug-audit.md`. Key values: container 200×80px, position bottom-right (40px offset), border-radius 12px, cycle interval 10s, fade 0.8s. Add controls for: badge width/height, position (which corner), cycle speed, fade duration.

7C.3. **Build rich control panels** — sponsors-cycle: HEADER, SLIDE TIMING (duration stepper, fade stepper), LOGO (max size), BACKGROUND. sponsors-bug: POSITION (bottom/right offset, which corner), SIZE (width/height), STYLE (border-radius, background), TIMING (cycle interval, fade duration).

7C.4. **Build Sponsors Template** — Shared header properties only. "Apply to All Sponsors" button.

7C.5. **Add measurement selectors** — For sponsors-cycle and sponsors-bug (iframe overlays — measurements inside iframe).

7C.6. **Deploy + verify with WCGNIC data**

**Acceptance Criteria:**
- [ ] sponsors-cycle slide duration and fade speed controllable
- [ ] sponsors-bug position, size, and timing controllable
- [ ] Font controls on all text elements
- [ ] Deployed and verified

---

### Phase 7D: Stream Graphics — NOT STARTED

**Goal:** Rich controls for stream-starting and stream-thanks. Fix the "undefined" preview bug.

**Spec files:** `specs/stream-graphics-audit.md`

**Template:** "Stream Template" — these two are identical except for title text.

#### Bug Fixes (7D)

**7D-BUG-1: stream-starting preview shows "undefined"** — The renderer reads `data.eventName` and `data.meetDate` but the Theme Editor preview doesn't pass these. Fix: when previewing stream graphics, pass sample data (`eventName: "2026 WCGNIC"`, `meetDate: "April 12-13, 2026"`) or read from selected competition config. Also pass team logos.

#### Tasks

7D.1. **Convert stream CSS to variables** — Port values from lines 5825-5888. See `specs/stream-graphics-audit.md`. Key values: bg #fff, title 48px/800, logo 320×320px, event-name 36px, date 28px, branding 20px. Add font controls for: title, event-name, date.

7D.2. **Fix stream preview bug (7D-BUG-1)** — Pass sample/competition data to stream renderer in preview mode.

7D.3. **Build rich control panel** — Sections: BACKGROUND (color, image), TITLE (font-size, weight, transform, color, margin), LOGOS (single logo size, multi-logo sizes by count, spacing), EVENT NAME (font-size, weight, color), DATE (font-size, color), BRANDING (font-size, color, visibility).

7D.4. **Build Stream Template** — Shared values for both. "Apply to All Stream Graphics" button.

7D.5. **Add measurement selectors** —
```javascript
'stream-starting': { title: '.stream-title', logos: '.stream-logos-container', eventName: '.stream-event-name', date: '.stream-date' }
```

7D.6. **Deploy + verify with WCGNIC data**

**Acceptance Criteria:**
- [ ] Stream preview renders with real data (not "undefined")
- [ ] Background color/image controllable
- [ ] Title, logo, event name, date sizes all controllable
- [ ] Font controls on all text elements
- [ ] Deployed and verified

---

### Phase 7E: Overlays + OBS-Direct Graphics — NOT STARTED

**Goal:** Rich controls for rotation-slate, rotation-slate-auto, logos, now-competing, live-camera, interview-card, athlete-spotlight, event-calendar, team-bug, hosts, and coaches. This is the largest sub-phase (12 graphics).

**Spec files:** `specs/rotation-slate-audit.md`, `specs/overlays-misc-audit.md`, `specs/cross-cutting-audit.md`. **Missing spec files** (to be generated via prompt-requirements + prompt-todo): `event-calendar`, `interview-card`, `team-bug`, `hosts`, `coaches`.

**Template:** No shared template — these graphics are structurally diverse. Individual control panels only.

#### Variant Selectors

| Graphic | Variants Found | Variant Param |
|---|---|---|
| rotation-slate / rotation-slate-auto | **12 shared layouts**: classic, centered, minimal, banner, jumbo, hero, split, bold, watermark, frame, stacked, cinema | `?layout=VARIANT_NAME` (default: classic) |
| event-calendar | **4 responsive tiers**: tier-large (1-3 events), tier-medium (4-5), tier-compact (6-7), tier-dense (8+). Plus optional 2-column layout (7+ events) | Automatic by event count |

**Note:** rotation-slate.html and rotation-slate-auto.html share the same 12 CSS layout variants. The auto version adds Firebase/Virtuis polling for live rotation detection. Both are separate graphic IDs in the renderer system.

#### Interview Card (OBS-Direct Overlay — NEW)

**File:** `overlays/interview-card.html` | **Font:** Poppins (not Inter) | **Loads theme-loader:** Yes

**Purpose:** Left-panel card displayed during coach/athlete interviews. Shows title label, name, school logo, school name, interview question, and event branding logo.

**Key CSS values to convert (32 hardcoded values):**

| Element | Key Properties |
|---|---|
| `.panel` | left: 30px, top: 30px, width: 600px, height: 1020px, border-radius: 16px, padding: 60px 45px 100px |
| `.coach-name` | font-size: 56px, font-weight: 900, letter-spacing: -1px, margin-bottom: 44px |
| `.school-logo` | width: 150px, height: 150px, margin-bottom: 18px |
| `.school-name` | font-size: 24px, font-weight: 700, letter-spacing: 2px, margin-bottom: 50px |
| `.question` | font-size: 28px, font-weight: 500, line-height: 1.45, max-width: 500px, opacity: 0.85 |
| `.title-label` | font-size: 16px, font-weight: 600, letter-spacing: 3px, opacity: 0.7 |
| `.event-logo` | height: 65px, opacity: 0.7 |

**URL params:** `title`, `name`/`coachName`, `school`, `logo`/`schoolLogo`, `question`/`q`, `eventLogo`, `meetTheme`

**Theme variables already used:** `--meet-overlay-bg`, `--meet-overlay-text`, `--meet-badge-text`

**Animations:** `panelSlideIn` (0.7s, translateX(-60px)→0) + staggered `fadeUp` (0.1s-0.5s delays)

#### Event Calendar (Iframe Overlay — NEW)

**File:** `overlays/event-calendar.html` | **Font:** Inter | **Loads theme-loader:** Yes

**Purpose:** Full-screen event listing with dynamic sizing by event count.

**Key CSS values to convert (45+ hardcoded values):**

| Element | Key Properties |
|---|---|
| `.card-container` | top: 50px, left/right: 70px, bottom: 50px, border-radius: 12px, box-shadow |
| `.header-bar` | padding: 18px 40px |
| `.header-title` | font-size: 42px, font-weight: 800, text-transform: uppercase |
| `.header-logo` | width: 80px, height: 80px |
| `.events-container` | padding: 30px 80px |
| `.tier-large` | event-date: 36px, event-name: 56px, event-location: 32px, padding: 30px |
| `.tier-medium` | event-date: 30px, event-name: 46px, event-location: 28px, padding: 22px |
| `.tier-compact` | event-date: 26px, event-name: 38px, event-location: 24px, padding: 16px |
| `.tier-dense` | event-date: 22px, event-name: 32px, event-location: 20px, padding: 12px |
| `.two-column` | gap: 60px, items: calc(50% - 30px) |

**URL params:** `logo`, `title`, `events` (JSON or pipe-separated), `columns`, `meetTheme`

**Theme variables already used:** `--meet-header-bg`, `--meet-header-text`, `--meet-overlay-bg`, `--meet-accent`

#### Team Bug (OBS-Direct Overlay — NEW)

**File:** `overlays/team-bug.html` | **Font:** Inter | **Loads theme-loader:** Yes

**Purpose:** Complex real-time score bug displayed during live broadcasts. Polls Virtuis API, shows team scores, athlete score flashes, lineup cards, rotation tracking. Over 2500 lines with 100+ hardcoded CSS values.

**Key CSS value groups:**

| Element Group | Key Properties |
|---|---|
| `.score-bug` | min-width: 500px, right: 0, vertical center |
| `.rotation-tag` | bg: #27272a, font-size: 20px, padding: 10px 20px |
| `.team-row` | bg: #1a1a1a, min-height: 70px (scales by team count: 65/60/55/50/44px) |
| `.team-fixed` | bg: #000, padding: 10px 15px, min-width: 100px |
| `.team-logo` | 40px (scales: 36/32/28/24px by team count) |
| `.slot-name` | 24px (scales: 22/20/18/16px) |
| `.slot-score` | 28px (scales: 26/24/22/20px), font-variant-numeric: tabular-nums |
| `.lineup-*` | Complete lineup card with header, athletes, footer |

**Responsive classes:** `.teams-3` through `.teams-7` scale all values

**URL params:** `compId` (required)

**Special considerations:** This overlay has its own Firebase connection and Virtuis API polling. Theme controls should focus on colors and typography, not the complex real-time state management.

#### Hosts & Coaches (OBS-Direct Overlays — NEW)

**hosts.html:** Simple lower-third card positioned at `bottom: 120px, left: 100px`. Header (40px title, themed bg) + content (black bg, 30px names). No logo. Accepts `?hosts=` (pipe-separated names).

**coaches.html:** Nearly identical to hosts but adds a logo in the header (60px×60px) and positioned at `top: 780px, left: 100px`. Accepts `?coaches=` (pipe-separated) + `?logo=`.

Both are structurally identical to the lower-third bar pattern (event-bar/warm-up/replay) and can reuse the same CSS variable pattern.

#### Tasks

7E.1. **Convert rotation-slate CSS to variables** — Port values for ALL 12 layout variants (shared by both rotation-slate.html and rotation-slate-auto.html). See `specs/rotation-slate-audit.md`. Shared controls: background color, logo size, meet name font, rotation number font. Per-variant controls may differ (e.g., cinema has 200px letterbox bars, bold has 700px rotation number, watermark has 900px faded number at 0.06 opacity). Add font controls for: meet-name, rotation-number.

7E.2. **Convert logos CSS to variables** — See `specs/overlays-misc-audit.md`. Key: logo sizes scale by team count. Add controls for grid gap, background, per-count logo sizes.

7E.3. **Convert now-competing + live-camera CSS to variables** — See `specs/overlays-misc-audit.md`. Live-camera is a small badge (top: 60px, left: 60px, bg: #dc2626). Now-competing is a lower-third bar (bottom: 120px, left: 100px). Now-competing has: green status badge (#22c55e with pulsing dot), logo section (100px, #d4d4d8), event section (24px, #d4d4d8), details section (black, 36px name, 22px team).

7E.4. **Convert interview-card CSS to variables** — 32 hardcoded values (see above). Key challenge: uses Poppins font, not Inter. Font family control must include Poppins as an option. Add font controls for: title-label, coach-name, school-name, question. Animation timing controls: panel slide-in distance, fade-up delays.

7E.5. **Convert athlete-spotlight CSS to variables** — See `specs/cross-cutting-audit.md`. Lower-third card with dual athlete headshots (100px circular), event name in header, bottom: 120px position. Add font controls for: event-name, athlete-name, athlete-details.

7E.6. **Convert event-calendar CSS to variables** — 45+ hardcoded values across 4 responsive tiers (see above). Must support per-tier font size overrides. Key challenge: tier selection is automatic (by event count), so preview needs sample data with different event counts. Add font controls for: header-title, event-date, event-name, event-location.

7E.7. **Convert team-bug CSS to variables** — 100+ hardcoded values across 5 responsive team-count classes (.teams-3 through .teams-7). Focus on colors and typography only — leave real-time state management untouched. Key controls: rotation-tag bg/font, team-row bg/height, slot-name/score font sizes, lineup card colors. `font-variant-numeric: tabular-nums` must be preserved on score elements.

7E.8. **Convert hosts + coaches CSS to variables** — Both are simple lower-third cards. Reuse the event-bar CSS variable pattern: position (bottom/left), header (bg, title font, padding, min-width), content (bg, name font, padding). Coaches adds: logo size. Can share a "Simple Lower-Third" template with event-bar/warm-up/replay.

7E.9. **Build rotation-slate variant selector** — Dropdown with all 12 layout options. Preview updates on variant change using `?layout=` param. Both rotation-slate and rotation-slate-auto use the same layouts.

7E.10. **Build rich control panels** — Per-graphic panels with appropriate sections.

7E.11. **Add measurement selectors** — For each graphic type (including iframe overlays).

7E.12. **Deploy + verify with WCGNIC data**

**Acceptance Criteria:**
- [ ] All 12 rotation-slate layouts have CSS variable support (both manual and auto versions)
- [ ] Variant selector shows all 12 layouts in preview
- [ ] logos graphic controllable (sizes by team count, grid gap)
- [ ] live-camera badge controllable (size, position, colors)
- [ ] interview-card fully controllable (panel size, position, font sizes, logo sizes, animation timing)
- [ ] event-calendar fully controllable (container offsets, header, per-tier font sizes, column layout)
- [ ] team-bug colors and typography controllable (rotation tag, team rows, slot text, lineup card)
- [ ] hosts and coaches lower-thirds controllable (position, header, content, logo)
- [ ] athlete-spotlight controllable (position, headshot size, font sizes)
- [ ] Font controls on all text elements (including Poppins option for interview-card)
- [ ] Deployed and verified

---

### Phase 7F: Playout / Who to Watch — NOT STARTED

**Goal:** Rich controls for who-to-watch-title, who-to-watch-lower-third, and clip-overlay. Establish theme/rundown override hierarchy for WTW card adjustments.

**Spec files:** `specs/playout-wtw-audit.md`

#### WTW Card Adjustments — Theme vs Rundown Override Hierarchy

**Problem:** WTW Card Adjustments currently live in the rundown editor (WhoToWatchEditor.jsx) per-card. Moving them to the Theme Editor would lose per-card control. The solution is a two-level system:

**Theme Editor (defaults):** Stores WTW layout defaults at the theme level in `themes/{themeId}/overrides/who-to-watch-title/`. These are the starting point for all new WTW cards.

**Rundown Editor (per-card overrides):** Each WTW card in the rundown stores its own adjustments. These ALWAYS take precedence over theme defaults.

**Behavior:**
1. When a new WTW segment is created in the rundown, it auto-imports settings from the active theme's WTW overrides
2. The producer can modify per-card settings in the rundown editor — these override the theme
3. An **"Import from Theme"** button in the rundown editor resets a specific card back to the current theme defaults
4. The Theme Editor never silently overrides rundown-level card adjustments
5. Per-card adjustments are stored in the rundown segment data (existing `titleCards[i]` structure)

**New UI in rundown editor WTW Card Adjustments:**
- "Import from Theme" button (per card) — copies theme defaults into this card's adjustments
- Visual indicator when card values differ from theme defaults
- "Reset to Theme Defaults" link to clear all per-card overrides

#### Variant Selectors

| Graphic | Variants | Variant Param |
|---|---|---|
| who-to-watch-title | 4 image modes: portrait, headshot, full, none | `?imageMode=` |

#### Tasks

7F.1. **Add WTW layout defaults to Theme Editor** — Move the Card Adjustments control pattern (THEME, BADGE, TEAM, TEXT, IMAGE, WATERMARK groups) into the Theme Editor's `who-to-watch-title` per-graphic override panel. Values save to `themes/{themeId}/overrides/who-to-watch-title/`.

7F.2. **Implement theme/rundown override hierarchy** — When creating a new WTW segment, auto-import theme defaults. Add "Import from Theme" button. Ensure per-card values always trump theme values.

7F.3. **Convert who-to-watch-lower-third CSS to variables** — See `specs/playout-wtw-audit.md`. Add controls for: card height, header height, headshot size, name font, stat font.

7F.4. **Convert clip-overlay CSS to variables** — See `specs/clip-overlay-audit.md`. Add controls for: athlete panel position/size, score badge position/size, font sizes.

7F.5. **Build variant selector for WTW title card** — Dropdown for image mode (portrait, headshot, full, none). Preview updates.

7F.6. **Build rich control panels** — Per-graphic panels. WTW title card panel mirrors the Card Adjustments structure.

7F.7. **Add measurement selectors** — For WTW and clip overlay elements.

7F.8. **Deploy + verify with WCGNIC data**

**Acceptance Criteria:**
- [ ] WTW theme defaults auto-import into new rundown segments
- [ ] Per-card adjustments always override theme defaults
- [ ] "Import from Theme" button works in rundown editor
- [ ] WTW title card image mode variant selector works
- [ ] who-to-watch-lower-third fully controllable
- [ ] clip-overlay fully controllable
- [ ] Font controls on all text elements
- [ ] Deployed and verified

---

#### Phase 7 — Overall Acceptance Criteria

- [ ] Every graphic in the graphic-to-phase mapping table (Section 4.7) has a rich control panel matching Phase 6 depth (position, sizes, heights, padding, fonts, colors, visibility, images)
- [ ] Font controls (family, weight, text-transform) available on all text elements in all graphics
- [ ] Tabular/monospaced font option available for score numbers
- [ ] Category templates with "Apply to All" for: Full-Screen, Team Cards, Sponsors, Stream
- [ ] Template key filtering — inapplicable keys skipped per graphic (e.g., `locationFontSize` skipped for warm-up/replay which have no location line)
- [ ] Graphics with variants have variant selector dropdowns
- [ ] Event Summary: 28 layout variants selectable
- [ ] Rotation Slate: 12 layout variants selectable (shared by manual + auto)
- [ ] Leaderboard: 18 event×gender combinations selectable
- [ ] Event Frame: 5 renderer variants + 3 OBS-only overlay variants
- [ ] WTW Title: 4 image modes selectable
- [ ] Event Calendar: 4 responsive tiers preview correctly
- [ ] All height/size defaults from pixel-perfect iframe measurements (NOT estimates)
- [ ] Team-stats data source override (AVG/NQS/HIGH combinations)
- [ ] sponsors-thanks preview renders sponsors (bug fixed)
- [ ] stream-starting preview renders data (bug fixed)
- [ ] WTW theme/rundown override hierarchy working
- [ ] interview-card fully controllable (including Poppins font option)
- [ ] team-bug colors and typography controllable
- [ ] hosts and coaches lower-thirds controllable
- [ ] event-calendar tier-specific font sizes controllable
- [ ] All verification uses WCGNIC competition data
- [ ] Existing broadcasts unaffected (all CSS variables use `var(--name, default)` fallback)
- [ ] Deployed and verified on commentarygraphic.com

**Deployment order:** One sub-phase at a time (7A → 7B → 7C → 7D → 7E → 7F). Each sub-phase is independently deployable.

---

### Phase 8: Live-Mode Per-Graphic Override Application — NOT STARTED

**CRITICAL: Phase 8A (Tasks 8.1 + 8.2) must be done BEFORE Phase 7.** The live-mode override bug means every per-graphic override configured in the Theme Editor is silently broken on actual broadcasts. This is a critical bug that should not wait through 6 sub-phases of Phase 7 development.

**Phase 8 is split into two parts:**
- **Phase 8A (Tasks 8.1 + 8.2 + 8.4-8.7):** Export `applyOverrides()`, call it in `currentGraphic` listener, use a **hardcoded suffix list** covering all current Phase 3/5/6 override keys. Deploy immediately before Phase 7.
- **Phase 8B (Task 8.3):** After Phase 7 completes, convert the hardcoded suffix list to a **dynamic** one derived from the override mapping objects. This ensures Phase 7's hundreds of new CSS variable keys are automatically covered.

**Execution order:** Phase 8A → Phase 7 (all sub-phases) → Phase 8B

---

**Goal:** Fix the critical gap where per-graphic overrides (colors, images, textures, layout) are applied in preview mode (`?graphic=`) but **completely ignored in live/OBS mode** (`?comp=`). Every override configured in the Theme Editor must render correctly on the actual broadcast output.

**Problem:**

Per-graphic overrides have been broken in live mode since Phase 3 shipped. The `applyOverrides()` function in theme-loader.js correctly sets CSS variables when it can detect a graphic ID at load time (preview mode via `?graphic=` param, overlay files via pathname). But in live mode, output.html loads as `?comp={compId}` with no `?graphic=` param — theme-loader.js returns `null` from `detectGraphicId()` and skips override application entirely. The `currentGraphic` Firebase listener in output.html (line 13298) renders graphics directly without ever applying per-graphic overrides.

**Impact:** Every per-graphic override set in the Theme Editor — colors, images, textures, layout (position, sizes, padding, heights, fonts, visibility) — works in preview but is silently ignored during live broadcasts. This affects all inline-rendered graphics and all override properties from Phases 3, 5, 6, and 7.

**Root causes:**

1. **`applyOverrides()` not exported.** The function is inside theme-loader.js's IIFE and not accessible from output.html. Only `window.themeReady` and `window.__themeData` are exported.
2. **No override call in `currentGraphic` listener.** The listener at output.html:13376 calls `renderers[graphic](data)` without applying overrides first.
3. **No CSS variable cleanup on graphic change.** When the graphic type changes (e.g., event-bar → event-summary), the previous graphic's CSS variables remain on `:root`, potentially leaking override values to the wrong graphic.

**Tasks:**

#### Task 8.1 — Export `applyOverrides()` from theme-loader.js

**Goal:** Make the override application function callable from output.html.

**Files:** `overlays/theme-loader.js`

**Work:**
1. Export the `applyOverrides()` function as `window.themeApplyOverrides`:
   ```javascript
   window.themeApplyOverrides = applyOverrides;
   ```
   Place this assignment immediately after the function definition (after the closing `}` of `applyOverrides()` at ~line 571), inside the IIFE but at module scope.

2. Add a companion `clearOverrides()` function that removes all per-graphic CSS variables for a given graphic ID from `:root`. This is necessary to prevent override leakage when the graphic type changes in live mode:
   ```javascript
   function clearOverrides(graphicId) {
     if (!graphicId) return;
     const root = document.documentElement;
     // Remove all possible CSS variables for this graphic ID
     // Covers: color overrides (8), image overrides (13), layout overrides (18)
     const allSuffixes = [
       // Colors
       'header-bg', 'content-bg', 'overlay-bg', 'border-color',
       'badge-bg', 'badge-text', 'header-text', 'overlay-text',
       // Images
       'header-bg-image', 'header-bg-image-fit', 'header-bg-image-position', 'header-bg-image-opacity',
       'body-bg-image', 'body-bg-image-fit', 'body-bg-image-position', 'body-bg-image-opacity',
       'body-texture', 'body-texture-opacity', 'body-texture-blend',
       'logo-url', 'logo-size',
       // Layout
       'bar-bottom', 'bar-left',
       'logo-img-size', 'logo-container-width', 'logo-container-height',
       'logo-bg', 'logo-padding', 'logo-radius', 'show-logo',
       'venue-font-size', 'venue-height', 'venue-padding-v', 'venue-padding-h',
       'bar-min-width',
       'name-font-size', 'location-font-size',
       'details-height', 'details-padding-v', 'details-padding-h'
     ];
     allSuffixes.forEach(suffix => {
       root.style.removeProperty(`--${graphicId}-${suffix}`);
     });
   }
   ```
   Export as `window.themeClearOverrides = clearOverrides;`

**Important:** The suffix list must be kept in sync with `applyOverrides()`. If Phase 7 adds new layout override keys, they must be added to both `applyOverrides()` and `clearOverrides()`.

**Verify:**
- [ ] `typeof window.themeApplyOverrides === 'function'` in browser console
- [ ] `typeof window.themeClearOverrides === 'function'` in browser console
- [ ] Calling `window.themeApplyOverrides(window.__themeData, 'event-bar')` in console correctly sets `--event-bar-*` CSS variables
- [ ] Calling `window.themeClearOverrides('event-bar')` removes all `--event-bar-*` CSS variables
- [ ] Existing preview mode and overlay behavior unchanged (regression check)

**Deploy:** Upload `overlays/` directory per CLAUDE.md deploy step 2.

---

#### Task 8.2 — Apply overrides in the `currentGraphic` listener

**Goal:** Call `applyOverrides()` before rendering each graphic in live mode, and clean up previous overrides when the graphic type changes.

**Files:** `output.html`

**Work:**
1. Add a `lastLiveGraphicId` variable near the `renderCounter` declaration (~line 13296):
   ```javascript
   let lastLiveGraphicId = null;
   ```

2. In the `currentGraphic` listener, immediately before the render call at line 13376, add override application:
   ```javascript
   // Apply per-graphic overrides for live mode (Task 8.2)
   if (window.themeClearOverrides && lastLiveGraphicId && lastLiveGraphicId !== graphic) {
     window.themeClearOverrides(lastLiveGraphicId);
   }
   if (window.themeApplyOverrides && window.__themeData) {
     window.themeApplyOverrides(window.__themeData, graphic);
   }
   lastLiveGraphicId = graphic;

   // Render regular graphic using existing renderers
   output.innerHTML = renderers[graphic](data);
   ```

3. Also apply overrides for iframe-rendered graphics in live mode. When the `currentGraphic` listener creates an iframe (e.g., for sponsors, rotation-slate, team-roster), the iframe loads its own theme-loader.js which handles overrides via pathname detection. **No additional work needed for iframe renderers.** But verify this in Task 8.4.

4. Handle the clip-overlay case. When `isClipMode` is true and a clip-type graphic is received, apply overrides with `graphic = 'clip-overlay'`:
   ```javascript
   if (window.themeApplyOverrides && window.__themeData) {
     window.themeApplyOverrides(window.__themeData, 'clip-overlay');
   }
   ```

5. Handle the WTW lower-third iframe case (line 13350). This already passes `meetTheme` as a URL param to the iframe. The iframe's theme-loader.js detects the graphic ID from its pathname. **No additional work needed.** But verify in Task 8.4.

**Verify:**
- [ ] Load `output.html?comp={testCompId}` in browser
- [ ] Write `{ graphic: 'event-bar', data: {...} }` to `competitions/{testCompId}/currentGraphic` via Firebase
- [ ] Inspect `:root` CSS variables — `--event-bar-*` overrides are set
- [ ] Change graphic to `event-summary` — `--event-bar-*` variables are removed, `--event-summary-*` variables are set
- [ ] Change graphic to `clear` — previous graphic's variables are removed
- [ ] Console logs show `[theme-loader] Override applied:` messages for each override

**Deploy:** Upload `output.html` per CLAUDE.md deploy step 2.

**Depends on:** Task 8.1

---

#### Task 8.3 — Extend `clearOverrides()` suffix list for Phase 7 properties

**Goal:** Ensure `clearOverrides()` covers every CSS variable suffix that Phase 7 will add for new graphic categories.

**Files:** `overlays/theme-loader.js`

**Work:**
1. Review the full set of layout override keys defined in Phase 7 for each graphic category:
   - **Full-Screen** (event-summary, leaderboard, event-frame): header height, content padding, footer height, table row height, font sizes, team logo size, badge sizes, etc.
   - **Team Cards** (team-stats, team-coaches): header height, content padding, stat font sizes, headshot size, name font size, etc.
   - **Sponsors** (sponsors-thanks, sponsors-cycle, sponsors-bug): header height, grid gap, logo sizes, cycle timing, etc.
   - **Stream** (stream-starting, stream-thanks): title font size, logo sizes, event name font size, countdown font size, etc.
   - **Overlays** (rotation-slate, team-roster, logos): content padding, row height, font sizes, column count, logo sizes, etc.
   - **Playout/WTW** (who-to-watch-title, who-to-watch-lower-third, clip-overlay): card dimensions, font sizes, headshot size, badge size, panel position, etc.

2. **Build the suffix list dynamically** from the `overrideMapping`, `imageOverrideMapping`, and `layoutOverrideMapping` objects already defined in `applyOverrides()`. This is a REQUIREMENT, not optional — a hardcoded suffix list will inevitably fall out of sync as Phase 7 adds hundreds of new layout override keys across 20+ graphics:
   ```javascript
   function clearOverrides(graphicId) {
     if (!graphicId) return;
     const root = document.documentElement;
     // Build suffix list from the same mappings used in applyOverrides()
     const allSuffixes = [
       ...Object.values(overrideMapping),                           // color suffixes
       ...Object.values(imageOverrideMapping),                      // image suffixes
       ...Object.values(layoutOverrideMapping).map(c => c.suffix)   // layout suffixes
     ];
     allSuffixes.forEach(suffix => {
       root.style.removeProperty(`--${graphicId}-${suffix}`);
     });
   }
   ```
   This requires moving the mapping objects to module scope inside the IIFE (not function-local inside `applyOverrides()`), accessible by both `applyOverrides()` and `clearOverrides()`.

3. **Verify** that after Phase 7 adds new keys, `clearOverrides()` automatically covers them without any manual sync.

**Verify:**
- [ ] `clearOverrides('event-summary')` removes ALL event-summary CSS variables (including Phase 7 layout + font keys)
- [ ] The suffix list is dynamically derived from the override mappings (zero hardcoded sync risk)
- [ ] Adding a new key to `layoutOverrideMapping` in Phase 7 automatically adds it to `clearOverrides()` — no second edit needed
- [ ] No regression in existing override application

**Depends on:** Task 8.1. Must be completed AFTER Phase 7 is complete (all layout/font override keys added to mappings).

---

#### Task 8.4 — Comprehensive Live-Mode Verification (All Graphic Types)

**Goal:** Verify that per-graphic overrides render correctly in live mode for every graphic type, using Playwright screenshots. This is the most critical task in Phase 8.

**Files:** None modified (verification only)

**Setup:**
1. Create a test theme in Firebase (e.g., `phase8-test`) with per-graphic overrides for EVERY inline-rendered graphic type. Each override should be visually obvious (e.g., bright red headers, large font sizes, hidden logos) so pass/fail is unambiguous in screenshots.
2. Use a test competition with the theme assigned (`competitions/{testCompId}/config/meetTheme: 'phase8-test'`)
3. Load `output.html?comp={testCompId}` in Playwright (simulates OBS browser source)

**Test overrides to configure in Firebase (`themes/phase8-test/overrides/`):**

| Graphic ID | Override Properties | Expected Visual Change |
|---|---|---|
| `event-bar` | `headerBar: "#FF0000"`, `logoBg: "#0000FF"`, `logoContainerHeight: "200px"`, `venueFontSize: 48`, `barBottom: 200` | Red header, blue logo box, tall logo, large venue text, bar 200px from bottom |
| `warm-up` | `headerBar: "#00FF00"`, `logoContainerWidth: "150px"`, `showLogo: false` | Green header, no logo visible |
| `replay` | `headerBar: "#FF00FF"`, `nameFontSize: 40`, `detailsHeight: "100px"` | Magenta header, large name text, tall details section |
| `event-summary` | `headerBar: "#FF6600"`, `contentArea: "#003366"` | Orange header, dark blue content area |
| `virtuis-leaderboard` | `headerBar: "#660066"`, `badge: "#FFFF00"` | Purple header, yellow badges |
| `event-frame` | `headerBar: "#006600"` | Dark green frame header |
| `team1-stats` | `headerBar: "#CC0000"`, `contentArea: "#FFFFCC"` | Dark red header, light yellow content |
| `team2-stats` | `headerBar: "#0000CC"` | Dark blue header |
| `team1-coaches` | `headerBar: "#CC6600"` | Orange header |
| `team2-coaches` | `headerBar: "#006666"` | Teal header |
| `hosts` | `headerBar: "#990099"` | Purple header |
| `stream-starting` | `bodyBackground: "#FF3333"` | Red background |
| `stream-thanks` | `bodyBackground: "#3333FF"` | Blue background |
| `live-camera` | `badge: "#FF0000"`, `badgeText: "#FFFFFF"` | Red LIVE badge with white text |
| `logos` | `bodyBackground: "#333333"` | Dark gray background |

**Test procedure (for each graphic):**

1. Write `{ graphic: '{graphicId}', data: {sampleData} }` to `competitions/{testCompId}/currentGraphic` via Firebase
2. Wait 2 seconds for render
3. Take Playwright screenshot → save to `docs/PRD-Theme-System-V2/screenshots/task-8.4-{graphicId}-live.png`
4. **Verify override applied:** Compare screenshot against expected visual changes in the table above
5. **Verify previous overrides cleared:** Check that CSS variables from the PREVIOUS graphic are no longer on `:root` (use `browser_evaluate` to read `document.documentElement.style`)
6. **Verify no console errors:** Check `browser_console_messages` for any JS errors

**Sample data for each graphic type:**

Use the WCGNIC competition and its theme for all verification. Write `currentGraphic` data using real WCGNIC team data (team names, logos, scores). Do NOT use placeholder data — this must verify against realistic broadcast conditions.

**Test matrix:**

| # | Action | Verify Override Applied | Verify Previous Cleared | Console Clean |
|---|---|---|---|---|
| 1 | Write `event-bar` | Red header, blue logo box, 200px bottom | N/A (first graphic) | Yes |
| 2 | Write `warm-up` | Green header, no logo | `--event-bar-*` vars removed | Yes |
| 3 | Write `replay` | Magenta header, large name, tall details | `--warm-up-*` vars removed | Yes |
| 4 | Write `event-summary` | Orange header, dark blue content | `--replay-*` vars removed | Yes |
| 5 | Write `virtuis-leaderboard` | Purple header, yellow badges | `--event-summary-*` vars removed | Yes |
| 6 | Write `event-frame` | Dark green header | `--virtuis-leaderboard-*` vars removed | Yes |
| 7 | Write `team1-stats` | Dark red header, light yellow content | `--event-frame-*` vars removed | Yes |
| 8 | Write `team2-stats` | Dark blue header | `--team1-stats-*` vars removed | Yes |
| 9 | Write `team1-coaches` | Orange header | `--team2-stats-*` vars removed | Yes |
| 10 | Write `team2-coaches` | Teal header | `--team1-coaches-*` vars removed | Yes |
| 11 | Write `hosts` | Purple header | `--team2-coaches-*` vars removed | Yes |
| 12 | Write `stream-starting` | Red background | `--hosts-*` vars removed | Yes |
| 13 | Write `stream-thanks` | Blue background | `--stream-starting-*` vars removed | Yes |
| 14 | Write `live-camera` | Red LIVE badge | `--stream-thanks-*` vars removed | Yes |
| 15 | Write `logos` | Dark gray background | `--live-camera-*` vars removed | Yes |
| 16 | Write `clear` (null state) | Output cleared | `--logos-*` vars removed | Yes |

**Additional test: rapid graphic switching**
17. Write `event-bar` → immediately write `warm-up` → immediately write `replay` (3 writes within 500ms)
   - Verify: only `replay` overrides are active on `:root`
   - Verify: no `--event-bar-*` or `--warm-up-*` variables remain
   - Verify: rendered output shows `replay` graphic (not stale)

**Additional test: graphic with NO overrides**
18. Write `{ graphic: 'event-bar', data: {...} }` using a theme that has NO overrides for event-bar
   - Verify: no `--event-bar-*` variables on `:root`
   - Verify: graphic renders with global theme colors (Layer 2 fallback)

**Additional test: iframe renderers (regression)**
19. Write `{ graphic: 'sponsors-thanks', data: {..., meetTheme: 'phase8-test'} }` to trigger an iframe render
   - Verify: iframe loads `sponsors-thanks.html?meetTheme=phase8-test`
   - Verify: iframe's theme-loader.js applies overrides via pathname detection (existing behavior)
   - Verify: no `--sponsors-thanks-*` variables on the PARENT `:root` (overrides live inside the iframe)

**Additional test: return to previously-overridden graphic**
20. Write `event-bar` (overrides applied) → write `warm-up` (event-bar cleared) → write `event-bar` again
   - Verify: `--event-bar-*` overrides are re-applied correctly on the second render
   - Verify: no `--warm-up-*` variables remain

**Verify (summary checklist):**
- [ ] All 15 inline-rendered graphic types render with correct per-graphic overrides in live mode
- [ ] CSS variables from previous graphic are fully cleaned up on every graphic change
- [ ] Rapid graphic switching shows no stale overrides or visual glitches
- [ ] Graphics with no overrides render with global theme colors (no stale per-graphic vars)
- [ ] Iframe renderers (sponsors, rotation-slate, team-roster, etc.) still work correctly — overrides applied inside iframe via theme-loader.js
- [ ] Returning to a previously-rendered graphic re-applies its overrides correctly
- [ ] Zero console errors across all tests (excluding favicon 404)
- [ ] All screenshots saved to `docs/PRD-Theme-System-V2/screenshots/task-8.4-*.png`

**Deploy:** None — verification only.

**Depends on:** Tasks 8.1, 8.2

---

#### Task 8.5 — Live-Mode Layout Override Verification (Lower-Thirds)

**Goal:** Verify that LAYOUT overrides (position, sizes, heights, padding, fonts, visibility) — not just color overrides — render correctly in live mode. This is the specific scenario that exposed the bug.

**Files:** None modified (verification only)

**Setup:** Use the same `phase8-test` theme from Task 8.4.

**Test overrides to configure in Firebase (`themes/phase8-test/overrides/`):**

| Graphic | Layout Overrides | Expected Visual Change |
|---|---|---|
| `event-bar` | `barBottom: 200`, `barLeft: 200`, `logoImgSize: 40`, `logoContainerWidth: 80`, `logoContainerHeight: 200`, `logoBg: "#000000"`, `logoPadding: 5`, `logoRadius: 10`, `showLogo: true`, `venueFontSize: 48`, `venueHeight: 80`, `venuePaddingV: 20`, `venuePaddingH: 60`, `barMinWidth: 800`, `nameFontSize: 36`, `locationFontSize: 30`, `detailsHeight: 100`, `detailsPaddingV: 15`, `detailsPaddingH: 50` | Bar repositioned (200px from bottom/left), small logo in black rounded box, large venue text, wide bar, large name/location text, tall details |
| `warm-up` | Same layout keys with warm-up prefix values | Warm-up bar matches the custom layout |
| `replay` | Same layout keys with replay prefix values | Replay bar matches the custom layout |

**Test procedure:**

1. Write event-bar to `currentGraphic` with competition data
2. Screenshot the full 1920x1080 output
3. **Pixel-check:** Bar is visually at ~200px from bottom (not default 120px)
4. **Pixel-check:** Logo box is black with rounded corners (not default white square)
5. **Pixel-check:** Logo box spans the full height of venue + details (200px)
6. **Pixel-check:** Venue text is noticeably larger than default
7. Repeat for warm-up and replay

**Verify:**
- [ ] Event-bar position override works in live mode (bar moved from default position)
- [ ] Logo box background color override works (black, not white)
- [ ] Logo box height override works (200px, not auto)
- [ ] Logo box border radius override works (rounded corners)
- [ ] Logo box padding override works (smaller padding)
- [ ] Venue font size override works (48px, not 36px)
- [ ] Venue height override works (80px explicit)
- [ ] Venue padding override works (20px/60px)
- [ ] Bar min-width override works (800px, not 600px)
- [ ] Name font size override works (36px, not 28px)
- [ ] Location font size override works (30px, not 24px)
- [ ] Details height override works (100px explicit)
- [ ] Details padding override works (15px/50px)
- [ ] Show/hide logo toggle works (`showLogo: false` hides logo in live mode)
- [ ] Warm-up layout overrides match event-bar pattern
- [ ] Replay layout overrides match event-bar pattern
- [ ] All screenshots saved to `docs/PRD-Theme-System-V2/screenshots/task-8.5-*.png`

**Deploy:** None — verification only.

**Depends on:** Tasks 8.1, 8.2, 8.4

---

#### Task 8.6 — Live-Mode Image/Texture Override Verification

**Goal:** Verify that image and texture overrides render correctly in live mode.

**Files:** None modified (verification only)

**Setup:** Add image/texture overrides to the `phase8-test` theme.

**Test overrides:**

| Graphic | Image Overrides | Expected Visual Change |
|---|---|---|
| `event-bar` | `headerBgImage: "{testImageUrl}"`, `headerBgImageFit: "cover"`, `headerBgImageOpacity: 0.8` | Event-bar header shows background image at 80% opacity behind text |
| `event-bar` | `bodyTexture: "{testTextureUrl}"`, `bodyTextureBlend: "overlay"`, `bodyTextureOpacity: 0.1` | Subtle texture visible on event-bar surfaces |
| `event-bar` | `logo: "{customLogoUrl}"`, `logoSize: 50` | Custom logo replaces default, sized at 50px |
| `event-summary` | `headerBgImage: "{testImageUrl}"` | Event-summary header shows background image |

**Verify:**
- [ ] Header background image renders in live mode (not just preview)
- [ ] Image fit (cover/contain) works
- [ ] Image opacity works
- [ ] Body texture renders with correct blend mode
- [ ] Per-graphic logo override works in live mode
- [ ] Logo size override works in live mode
- [ ] Images are cleared when switching to a different graphic type
- [ ] All screenshots saved to `docs/PRD-Theme-System-V2/screenshots/task-8.6-*.png`

**Deploy:** None — verification only.

**Depends on:** Tasks 8.1, 8.2

---

#### Task 8.7 — Production Deployment + OBS Verification

**Goal:** Deploy Phase 8 to production and verify overrides work in the actual OBS browser source environment.

**Files:** None modified (deployment + verification only)

**Work:**
1. Deploy `overlays/theme-loader.js` (Task 8.1 changes)
2. Deploy `output.html` (Task 8.2 changes)
3. Build and deploy React SPA (no changes, but redeploy ensures consistency)
4. Deploy `overlays/` directory (theme-overrides.css, etc.)

**Verify (on commentarygraphic.com):**
1. Open `https://commentarygraphic.com/output.html?comp={realCompId}` in browser — simulate OBS
2. Use the show controller to trigger graphics with a themed competition
3. Verify per-graphic overrides render on each graphic type
4. Check the debug panel (`?debug=theme` on the OBS URL) — confirm override application is logged
5. Verify no console errors in the OBS browser source

**OBS-specific checks:**
- [ ] Overrides render in OBS browser source (not just standalone browser)
- [ ] No FOUC when graphic changes (theme + overrides applied before first paint)
- [ ] Override cleanup works during rapid show-controller graphic switching
- [ ] Sponsor iframes in playout gap-fill still render with theme (regression check)

**Deploy:** Full production deploy per CLAUDE.md checklist.

**Depends on:** Tasks 8.1–8.6

---

#### Task 8.DOC — Update Documentation

**Goal:** Update CLAUDE.md and PRD to document the live-mode override system.

**Files:** `CLAUDE.md`, `docs/PRD-Theme-System-V2/PRD-Theme-System-V2-2026-03-25.md`

**Work:**
1. **CLAUDE.md — Update Per-Graphic Overrides section:**
   - Add note about live-mode override application via `window.themeApplyOverrides()`
   - Document `window.themeClearOverrides()` for cleanup
   - Note that override cleanup happens automatically on graphic change in the `currentGraphic` listener
2. **CLAUDE.md — Update theme-loader.js exports:**
   - Add `window.themeApplyOverrides` and `window.themeClearOverrides` to the exports list
3. **PRD — Update status summary:**
   - Phase 8: mark as COMPLETE
   - Add to Key Files Modified table
4. **Risk Assessment — Add new row:**
   - Risk: "Per-graphic overrides not applied in live/OBS mode"
   - Impact: CRITICAL (discovered in production)
   - Mitigation: Phase 8 exports `applyOverrides()` and calls it in the `currentGraphic` listener

**Verify:**
- [ ] CLAUDE.md documents `window.themeApplyOverrides` and `window.themeClearOverrides`
- [ ] CLAUDE.md documents live-mode override flow
- [ ] PRD Phase 8 status updated

**Deploy:** None — documentation only.

**Depends on:** Task 8.7

---

**Phase 8 Acceptance Criteria:**

- [ ] `applyOverrides()` exported from theme-loader.js as `window.themeApplyOverrides`
- [ ] `clearOverrides()` exported as `window.themeClearOverrides`
- [ ] `currentGraphic` listener applies overrides before rendering every graphic
- [ ] Previous graphic's CSS variables cleaned up on every graphic change
- [ ] All 15 inline-rendered graphic types verified with per-graphic color overrides in live mode
- [ ] All 18 layout override properties verified for lower-third graphics in live mode
- [ ] Image and texture overrides verified in live mode
- [ ] Rapid graphic switching produces no stale overrides
- [ ] Iframe renderers unaffected (regression)
- [ ] No console errors across all graphic types
- [ ] Deployed and verified on production (commentarygraphic.com)
- [ ] Verified in OBS browser source environment
- [ ] Documentation updated

**Phase 8A / 8B split:**

- **Phase 8A** (Tasks 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.DOC): Deploy BEFORE Phase 7. Uses a hardcoded suffix list in `clearOverrides()` covering all Phase 3/5/6 override keys (colors: 8, images: 13, layout: 19 = 40 total suffixes). This is a complete, working fix for all currently-implemented overrides.

- **Phase 8B** (Task 8.3): Deploy AFTER Phase 7 is complete. Converts the hardcoded suffix list to dynamic derivation from the override mapping objects. This ensures Phase 7's hundreds of new CSS variable keys (font-family, font-weight, text-transform, tier-specific sizes, etc.) are automatically covered by `clearOverrides()` without manual sync.

**Why this ordering:** Tasks 8.1 and 8.2 are small code changes (< 30 lines total). The hardcoded suffix list covers ALL currently-implemented override keys. Waiting through 6 sub-phases of Phase 7 to fix this critical bug is unnecessary risk — any live broadcast before the fix would have broken overrides. The dynamic suffix conversion (8.3) can safely wait until after Phase 7 adds its keys to the mappings.

**Verification:** All Phase 8A tests use the WCGNIC competition and its theme for realistic broadcast conditions. Do NOT use placeholder data.

**Rollback:** `git revert` of Tasks 8.1 and 8.2. Live mode reverts to no per-graphic overrides (same as current broken state — no regression).

---

## 7. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| theme-loader.js can't handle live-mode theme loading | **CRITICAL** | Phase 1.1 extends theme-loader.js with `?comp=` support. Must be done first. |
| ~68 inline CSS rules have no equivalent in theme-overrides.css | HIGH | Phase 0 audit produces full list. Phase 1.3 ports all rules. |
| Live-mode FOUC | HIGH | Phase 1.6 adds `themeReadyPromise` gate with timeout + visible failure flag. |
| Theme fetch timeout — graphics stuck on blank screen | HIGH | 3-second timeout resolves promise with fallback colors + **visible warning to producer**. Silent fallback not acceptable. |
| Removing inline theme CSS breaks inline-rendered graphics | HIGH | Multi-step: port → convert to variables → verify → live-event gate → remove. Rollback = git revert. |
| Existing themes lose styling after class name reconciliation | LOW | New class names added alongside old ones (no removal). Old classes become redundant but harmless. |
| Per-graphic overrides create Firebase data bloat | LOW | Overrides are sparse. Fetched as part of existing theme subtree read (no extra calls). |
| PlayoutEngine/WhoToWatch path bug blocks clip theming | HIGH | Prerequisite fix (Section 5) must be deployed before Phase 1. |
| PlayoutEngine missing meetTheme in writes | HIGH | Task 1.1b adds meetTheme to all playout engine writes. Without this, sponsor graphics during playout gap-fill render unthemed. |
| Clip overlay not previewable in Theme Editor | MEDIUM | Phase 4.6 adds `?mode=clip-preview` to output.html for static preview of clip overlay with theme colors. |
| Documentation gets out of sync | LOW | Each phase includes mandatory doc updates before next phase starts. |
| Competition dropdown empty — preview unusable | HIGH | Phase 5.1 removes the overly restrictive 60-day filter. |
| Graphics preview shows errors instead of graphics | HIGH | Phase 5.2 adds proper placeholder data path for preview mode. |
| Layout CSS variables conflict with existing styles | MEDIUM | All variables use `var(--name, default)` pattern — falls back to hardcoded value when absent. Zero impact on existing broadcasts. |
| Per-graphic layout overrides bloat Firebase | LOW | Layout values are small integers (10 fields per graphic). Only stored when non-default. |
| Template "Apply to All" overwrites individual tweaks | MEDIUM | Merge strategy — only writes keys that exist in the template, preserving keys set individually. Confirmation dialog before applying. |
| Warm-up/replay CSS variable addition breaks existing styling | LOW | All new variables use `var(--name, default)` with defaults matching current hardcoded values. Zero visual change without overrides. |
| **Per-graphic overrides not applied in live/OBS mode** | **CRITICAL** | Discovered in production — `applyOverrides()` trapped in IIFE, never called in `currentGraphic` listener. Phase 8 exports the function and calls it before every render. |
| CSS variable leakage between graphic types in live mode | HIGH | Phase 8 adds `clearOverrides()` to remove previous graphic's CSS variables before applying new ones. Verified via 20-step test matrix. |
| Rotation-slate has 16 variants (not 6 as originally documented) | MEDIUM | Phase 7E audit found 16 layout variants. Variant selector dropdown must include all 16. Spec file `specs/rotation-slate-audit.md` has full details. |
| Event-summary has 28 layout variants (not 13 as previously audited) | MEDIUM | Full code analysis found 28 distinct layouts (broadcast-table, classic-broadcast, default-v2 through v24, dual-dynamic-v1/v2, split-row). More work than spec audit estimated. |
| sponsors-thanks preview shows "not configured" | HIGH | Preview iframe doesn't pass JSON-encoded sponsors as URL param. Fix in Phase 7A (Task 7A.6). |
| stream-starting preview shows "undefined" | HIGH | Renderer expects `eventName`/`meetDate` data not passed in preview mode. Fix in Phase 7D (Task 7D.2). |
| Team-stats NQS data fetched but never rendered | MEDIUM | Dynamic renderer has the variable but static renderers ignore it. Phase 7B adds data source override dropdown. |
| Font family changes may break tabular number alignment | MEDIUM | Event-summary sets `font-variant-numeric: tabular-nums`. Font family dropdown must flag which fonts support tabular numbers. |
| `clearOverrides()` hardcoded suffix list falls out of sync | HIGH | Phase 8A uses hardcoded list (covering Phase 3/5/6 keys — complete for now). Phase 8B converts to dynamic suffix derivation after Phase 7 adds new keys. |
| Missing graphics in Phase 7 coverage | HIGH | Added Section 4.7 graphic-to-phase mapping table covering all 56 graphics. interview-card, event-calendar, team-bug, hosts, coaches now explicitly assigned to Phase 7E. |
| interview-card uses Poppins font (not Inter) | LOW | Font loading strategy (Task 7.FONT) includes Poppins in consolidated Google Fonts request. Font family dropdown must include Poppins as an option. |
| team-bug has 100+ hardcoded CSS values | MEDIUM | Focus Phase 7E on colors and typography only. Leave real-time state management (Firebase, Virtuis API polling, score flash animations) untouched. |
| Phase 7 font loading not planned | MEDIUM | Added cross-cutting font loading tasks (7.FONT.1-4). Consolidated Google Fonts request, preconnect hints, font metadata for dropdowns. |

---

## 8. Migration Plan

### What happens to existing themes?

Existing themes in Firebase are **fully compatible** — no migration needed. The new `overrides` field is optional and defaults to empty.

### What happens to existing overlay files?

All 28 overlay files that load theme-loader.js continue to work. theme-loader.js gains new capabilities but remains backward-compatible. No overlay file changes required for Phase 1.

### What happens to existing OBS browser sources?

All existing URLs continue to work. `?meetTheme=` param behavior is unchanged. New `?debug=theme` param is additive. No URL format changes.

### Deployment order

Each phase is independently deployable. Rollback = git revert of that phase's commits.

1. **Prerequisite** (path bug fix): Deploy to coordinator server. 2-line fix.
2. **Phase 0** (audit): No deployment — research only.
3. **Phase 1** (unification): Deploy theme-loader.js + output.html + theme-overrides.css together. Inline CSS kept as fallback until live-event verification.
4. **Phase 1.9** (inline CSS removal): Deploy after one successful live event.
5. **Phase 3** (overrides): Deploy theme-loader.js + theme-overrides.css updates together.
6. **Phase 4** (editor UI): Deploy React SPA build (no server changes). MVP first, then iterate.
7. **Phase 5** (bug fixes + layout controls): Deploy in order: 5.1-5.2 (bug fixes, React SPA), 5.3 (save button, React SPA), 5.4 (CSS variables, output.html + theme-loader.js + theme-overrides.css), 5.5-5.6 (control panel + verify, React SPA).
8. **Phase 6** (height controls + template): Deploy: 6.1-6.3 (CSS variables, output.html + theme-loader.js), 6.4-6.5 (template UI + warm-up/replay panels, React SPA), 6.6 (verify).
9. **Phase 8A** (live-mode override fix — CRITICAL): Deploy BEFORE Phase 7. Theme-loader.js + output.html together. Small code change (~30 lines), hardcoded suffix list covering all Phase 3/5/6 keys, extensive verification (20-step test matrix).
10. **Phase 7** (full graphic control): Deploy one sub-phase at a time (7A → 7B → 7C → 7D → 7E → 7F). Font loading task (7.FONT) deploys with first sub-phase.
11. **Phase 8B** (dynamic suffix list): Deploy AFTER Phase 7 is complete. Converts hardcoded suffix list to dynamic derivation from override mappings.

---

## 9. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Theme application consistency | ~60% of graphics themed correctly | 100% |
| Time to diagnose a theme bug | 30-60 minutes (read source code) | 30 seconds (debug panel) |
| Time to fix a theme color in production | Deploy code change (15-30 min) | Override in theme editor (30 sec) |
| Per-graphic customization options | 0 (all-or-nothing) | Colors, images, textures, logos, font sizes, positions, visibility per graphic |
| Theme preview accuracy | Static preview, no real data | Live preview with real competition data |
| Time to adjust a graphic's layout | Deploy code change (15-30 min) | ValueStepper in Theme Editor (instant preview) |
| Competition dropdown usability | Empty dropdown (0 competitions) | All competitions visible, sorted by date |
| Documentation accuracy | Stale (references dual CSS locations) | Current — updated at each phase boundary |
| Firebase reads per event | Current baseline | No increase from per-graphic overrides |

---

## 10. What Was Cut (and Why)

| Cut | Original Phase | Reason |
|-----|---------------|--------|
| CSS extraction to separate files | Phase 2a | No profiling data justifies it. output.html works. |
| JS renderer extraction to modules | Phase 2b | High-risk architectural refactor (IIFE → modules, 14+ closure dependencies). Risk of breaking live broadcasts outweighs developer experience benefit. |
| Lazy Firebase listeners | Phase 2c | Optimization without evidence of a bottleneck. |
| URL Generator iframe preview | Phase 5 | Nice-to-have. Competition preview in Theme Editor (Phase 4) covers the core need. |
| Automated screenshot regression suite | Phase 6 | Manual Playwright verification in Phase 1.8 is sufficient for now. |

These can be revisited as separate PRDs if profiling data or user feedback justifies them.

---

## 11. Status Summary

### Phases Delivered (v2.1)

**Completion Date:** 2026-03-26 | **Total Tasks Executed:** 30 (excluding Task 1.9 deferred)

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| Phase 0: Audit | COMPLETE | Graphic ID registry, CSS rule audit, pseudo-element audit |
| Phase 1: Unification | COMPLETE (except 1.9) | Unified theme-loader.js for all graphics, `?comp=` support, debug panel, FOUC prevention, theme error reporting |
| Phase 2: Extraction | CUT | Determined too risky for live broadcasts |
| Phase 3: Per-Graphic Overrides | COMPLETE | 3-layer CSS cascade, 18 override properties, image/texture support, debug panel layer display |
| Phase 4: Theme Editor | COMPLETE | Competition preview, graphic selector, per-graphic override panels, clip-preview mode, import/reset UX |

### Delivered (v3.0)

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| Phase 5: Bug Fixes + Layout Controls | COMPLETE | Fix competition dropdown, fix preview errors, save button + reload, Event Bar layout CSS variables (13 properties), rich control panel (POSITION/LOGO/VENUE/TEXT/IMAGES), theme-level background image controls, full logo container controls (color/height/padding/radius) |

### Delivered (v3.1)

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| Phase 6: Height Controls + Template | COMPLETE | Height/padding controls for venue bar + details section (6 new CSS vars), full CSS variable support for warm-up + replay (18 vars each), Lower-Third Template system with "Apply to All" in Theme Editor |

### Planned (v4.0)

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| Phase 8A: Live-Mode Override Fix (Critical) | **COMPLETE** (2026-03-26) | Exported `applyOverrides()` and `clearOverrides()` from theme-loader.js, integrated into `currentGraphic` listener with `lastLiveGraphicId` tracking, 3-layer CSS cascade for all lower-thirds and team-stats, image/texture override verification, production deployment verified. |
| Phase 7: Full Graphic Control | NOT STARTED | Rich controls for all 7 categories (56 graphics total, see Section 4.7 mapping). Variant selectors for event-summary (28 layouts), leaderboard, event-frame, rotation-slate (12 layouts), event-calendar (4 tiers), and WTW. New graphics: interview-card, event-calendar, team-bug, hosts, coaches. Category templates. Font loading strategy. Pixel-perfect measurement for all graphics. |
| Phase 8B: Dynamic Suffix List | NOT STARTED — after Phase 7 | Convert `clearOverrides()` hardcoded suffix list to dynamic derivation from override mappings. Ensures Phase 7's new CSS variable keys are automatically covered. |

### Key Files Modified (Phase 6)

| File | Changes |
|------|---------|
| `output.html` | Event-bar venue/details get height + padding CSS vars; warm-up and replay converted from hardcoded values to 18 CSS variables each |
| `overlays/theme-loader.js` | Layout mapping extended with 6 new keys: venueHeight, venuePaddingV/H, detailsHeight, detailsPaddingV/H |
| `show-controller/src/pages/ThemeEditorPage.jsx` | Rich control panels for warm-up + replay (matching event-bar), Lower-Third Template panel with "Apply to All", height/padding steppers in VENUE and TEXT sections |

### Key Files Modified (Phase 5)

| File | Changes |
|------|---------|
| `show-controller/src/pages/ThemeEditorPage.jsx` | Removed 60-day filter, added placeholder data for all graphics, Save Overrides button, rich Event Bar control panel, Background Images section, logo box controls |
| `output.html` | Event Bar CSS now uses CSS variables for position, logo (width/height/bg/padding/radius), venue font/width, text sizes |
| `overlays/theme-loader.js` | Layout override mapping (13 keys), theme-level image CSS variables (`--meet-header-bg-image`, `--meet-body-bg-image`) |
| `overlays/theme-overrides.css` | Per-graphic image fallback cascade updated to use theme-level vars, logo bg uses CSS variable |

### Key Files Modified

| File | Changes |
|------|---------|
| `overlays/theme-loader.js` | Added `?comp=` support, `window.themeReady` promise, per-graphic override injection, image/texture CSS vars, debug panel |
| `overlays/theme-overrides.css` | Ported ~68 inline rules, added 3-layer cascade, per-graphic image/texture rules |
| `output.html` | Added theme-loader.js script, class name reconciliation, live-mode theme gate, clip-preview mode |
| `server/lib/playoutEngine.js` | Added `meetTheme` to all 8 `_writeCurrentGraphic()` calls |
| `show-controller/src/pages/ThemeEditorPage.jsx` | Competition selector, graphic dropdown, per-graphic override panels, image/texture controls, import/reset UX |
| `show-controller/src/components/ThemeErrorLog.jsx` | New component for producer theme error visibility |
| `show-controller/src/hooks/useThemeErrors.js` | New hook for Firebase theme error subscription |
| `CLAUDE.md` | Updated Unified Theme System, Per-Graphic Overrides, Debug Panel, Theme Error Reporting, Theme Editor, Who to Watch sections |

### Task 1.9 Deferral

Task 1.9 (Remove Inline Theme CSS) is deferred until after at least one successful live event. The inline CSS remains as a fallback. Once live-event verification confirms stability:
1. Remove "MEET THEME OVERRIDES" inline `<style>` section from output.html
2. Remove `applyMeetTheme()` and `loadMeetTheme()` functions
3. Replace `setTimeout(600ms)` in WTW overlays with `window.themeReady.then()`
4. Re-run verification tests
