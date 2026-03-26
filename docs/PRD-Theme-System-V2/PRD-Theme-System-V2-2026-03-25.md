# PRD: Theme System V2 — Unified Theme Engine

**Version:** 2.1
**Date:** 2026-03-25
**Status:** IN PROGRESS (Phase 1 COMPLETE except Task 1.9 deferred, Phase 3 next)
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

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Unified theme path** | ONE code path for theme application across all graphics (overlays AND output.html inline) |
| **Debug panel** | Visual diagnostic tool showing theme state, CSS variable values, and failure points |
| **Per-graphic overrides** | Override any theme property (colors, images, textures, logos) for specific graphic types |
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
| Redesign individual graphic layouts | This PRD fixes theming infrastructure, not graphic design |
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

**New** (added):
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

### Phase 3: Per-Graphic Theme Overrides — IN PROGRESS (next)

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

### Phase 4: Theme Editor — Per-Graphic Controls + Competition Preview

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

---

## 9. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Theme application consistency | ~60% of graphics themed correctly | 100% |
| Time to diagnose a theme bug | 30-60 minutes (read source code) | 30 seconds (debug panel) |
| Time to fix a theme color in production | Deploy code change (15-30 min) | Override in theme editor (30 sec) |
| Per-graphic customization options | 0 (all-or-nothing) | Colors, images, textures, logos per graphic |
| Theme preview accuracy | Static preview, no real data | Live preview with real competition data |
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
