# Audit: [data-meet-theme] CSS Rules

**Created:** Task 0.2
**Purpose:** Source-of-truth for Phase 1.3 porting work

## Summary

| Location | Selector Count | Lines |
|----------|---------------|-------|
| `output.html` | 76 selectors | 1076-1328 + 6148 |
| `theme-overrides.css` | 56 selectors | 26-341 |

## Categories

### 1. Both Files (16 selectors)

Rules that exist in both files. Check for value differences.

| Selector | output.html Value | theme-overrides.css Value | Match? |
|----------|------------------|---------------------------|--------|
| `.event-bar-logo` | `background: rgba(255, 255, 255, 0.92)` | `background: var(--meet-header-bg, #BFBFBF)` | **MISMATCH** |
| `.event-bar-venue` | `background: var(--meet-header-bg, #BFBFBF); color: var(--meet-header-text, #000)` | Same | YES |
| `.coaches-header` | `background: var(--meet-header-bg, #d4d4d8); color: var(--meet-header-text, #000)` | `background: var(--meet-header-bg); color: var(--meet-header-text)` (no fallback) | Compat |
| `.coaches-content` | `background: var(--meet-content-bg, #000)` | Same | YES |
| `.coach-name` | `color: var(--meet-overlay-text, #fff)` | Same | YES |
| `.stats-header` | `background: var(--meet-header-bg, #d4d4d8)` | Same (in grouped rule) | YES |
| `.stats-team-name` | `color: var(--meet-header-text, #000)` | Same (in grouped rule) | YES |
| `.hosts-header` | `background: var(--meet-header-bg, #d4d4d8)` | Same (in grouped rule) | YES |
| `.hosts-title` | `color: var(--meet-header-text, #000)` | Same (in grouped rule) | YES |
| `.frame-header` | `background: var(--meet-header-bg, #d4d4d8)` | Same | YES |
| `.rotation-badge` (in `.rotation-slate`) | `background: var(--meet-badge-bg); color: var(--meet-badge-text, #000)` | Same (lines 118-121) | YES |
| `.graphic-frame-overlay .team-logo` | `background: transparent !important` (lines 6148 and 1306) | Same | YES |
| Texture `position: relative` targets | 14 classes | 11 classes (missing `.panel`, `.event-summary-header`, `.leaderboard-header`, `.warm-up-container`, `.replay-container`) | Subset |
| Texture `::before` targets | 14 classes | 11 classes (same mismatches) | Subset |

**ACTION REQUIRED:**
- `.event-bar-logo` in theme-overrides.css (line 45-47): Change `var(--meet-header-bg, #BFBFBF)` to `rgba(255, 255, 255, 0.92)` per css-scope.md Decision #1

### 2. output.html Only (60 selectors) — Must Port to theme-overrides.css

These rules exist ONLY in output.html and must be added to theme-overrides.css in Phase 1.3.

#### Event Frame (2 rules) — Lines 1076-1081
| Selector | Value |
|----------|-------|
| `.graphic-event-frame .frame-header` | `background: var(--meet-header-bg, #d4d4d8)` |
| `.graphic-event-frame .frame-title` | `color: var(--meet-header-text, #000)` |

#### Event Summary (22 rules) — Lines 1084-1134
| Selector | Value |
|----------|-------|
| `.event-summary-header` | `background: var(--meet-header-bg, #d4d4d8)` |
| `.event-summary-title` | `color: var(--meet-header-text, #000)` |
| `.event-summary-footer` | `background: var(--meet-header-bg, #27272a); border-top-color: var(--meet-border-color, transparent)` |
| `.event-summary-content` | `background: var(--meet-overlay-bg, #27272a)` |
| `.center-divider` | `background: var(--meet-overlay-bg, #27272a)` |
| `.rotation-badge` | `background: var(--meet-badge-bg); color: var(--meet-badge-text, #fff)` |
| `.event-summary-dual .diff-row:nth-child(odd)` | `background: var(--meet-overlay-bg, #18181b)` |
| `.event-summary-dual .diff-row:nth-child(even)` | `background: color-mix(in srgb, var(--meet-overlay-bg, #27272a) 80%, white)` |
| `.event-summary-quad` | `background: var(--meet-border-color, #3f3f46)` |
| `.event-summary-quad-v3` | `background: var(--meet-border-color, #3f3f46)` |
| `.event-summary-quad .team-header` | `border-bottom-color: var(--meet-border-color, #3f3f46)` |
| `.event-summary-quad-v3 .team-header` | `border-bottom-color: var(--meet-border-color, #3f3f46)` |
| `.event-summary-quad .team-footer` | `background: color-mix(...); border-top-color: var(--meet-border-color, #3f3f46)` |
| `.event-summary-quad-v3 .team-footer` | `background: color-mix(...); border-top-color: var(--meet-border-color, #3f3f46)` |
| `.event-summary-quad .athlete-row` | `border-bottom-color: var(--meet-border-color, #3f3f46)` |
| `.event-summary-quad-v3 .athlete-row` | `border-bottom-color: var(--meet-border-color, #3f3f46)` |

#### Leaderboard (25 rules) — Lines 1137-1192
| Selector | Value |
|----------|-------|
| `.leaderboard-header` | `background: var(--meet-header-bg, #18181b)` |
| `.leaderboard-title` | `color: var(--meet-header-text, #fff)` |
| `.leaderboard-footer` | `background: var(--meet-header-bg, #18181b)` |
| `.graphic-virtius-leaderboard .frame-header` | `background: var(--meet-header-bg, #d4d4d8); color: var(--meet-header-text, #000)` |
| `.graphic-virtius-leaderboard .frame-title` | `color: var(--meet-header-text, #000)` |
| `.leaderboard-table thead` | `background: var(--meet-header-bg, #27272a)` |
| `.leaderboard-table th` | `color: var(--meet-header-text, #a1a1aa); border-bottom-color: var(--meet-border-color, #3f3f46)` |
| `.leaderboard-table tbody tr` | `border-bottom-color: var(--meet-border-color, #3f3f46)` |
| `.leaderboard-table tbody tr:nth-child(odd)` | `background: var(--meet-overlay-bg, #18181b)` |
| `.leaderboard-table tbody tr:nth-child(even)` | `background: color-mix(in srgb, var(--meet-overlay-bg, #0f0f10) 85%, black)` |
| `.leaderboard-table td` | `color: var(--meet-overlay-text, #fff)` |
| `.leaderboard-table td.col-rank` | `color: var(--meet-header-bg, #a1a1aa)` |
| `.leaderboard-table td.col-diff` | `color: var(--meet-header-bg, #a1a1aa)` |
| `.leaderboard-table td.col-exec` | `color: var(--meet-header-bg, #a1a1aa)` |
| `.leaderboard-table td.col-team` | `color: var(--meet-header-bg, #d4d4d8)` |
| `.leaderboard-team-logo` | `background: var(--meet-header-bg, #27272a)` |
| `.apparatus-badge` | `border-color: var(--meet-border-color, #52525b); color: var(--meet-header-bg, #a1a1aa)` |

#### Event Bar Details (3 rules) — Lines 1221-1227
| Selector | Value |
|----------|-------|
| `.event-bar-details` | `background: var(--meet-content-bg, #000)` |
| `.event-bar-name` | `color: var(--meet-overlay-text, #fff)` |
| `.event-bar-location` | `color: var(--meet-overlay-text, #fff)` |

#### Warm-up Detailed (6 rules) — Lines 1230-1247
| Selector | Value |
|----------|-------|
| `.warm-up-logo-section` | `background: rgba(255, 255, 255, 0.92)` |
| `.warm-up-logo-section img` | `background: transparent` |
| `.warm-up-teams-row` | `background: var(--meet-header-bg, #BFBFBF)` |
| `.warm-up-teams-text` | `color: var(--meet-header-text, #000)` |
| `.warm-up-status-row` | `background: var(--meet-content-bg, #000)` |
| `.warm-up-status-text` | `color: var(--meet-overlay-text, #fff)` |

#### Replay Detailed (6 rules) — Lines 1264-1281
| Selector | Value |
|----------|-------|
| `.replay-logo-section` | `background: rgba(255, 255, 255, 0.92)` |
| `.replay-logo-section img` | `background: transparent` |
| `.replay-title-row` | `background: var(--meet-header-bg, #BFBFBF)` |
| `.replay-title-text` | `color: var(--meet-header-text, #000)` |
| `.replay-status-row` | `background: var(--meet-content-bg, #000)` |
| `.replay-status-text` | `color: var(--meet-overlay-text, #fff)` |

#### Texture Targets in output.html but not theme-overrides.css (5 surfaces)
These surfaces have texture `::before` rules in output.html but NOT in theme-overrides.css:
| Surface | Needs Position:Relative? | Needs ::before? |
|---------|--------------------------|-----------------|
| `.event-summary-header` | YES | YES |
| `.leaderboard-header` | YES | YES |
| `.warm-up-container` | YES | YES |
| `.replay-container` | YES | YES |
| `.panel` | NO (overlay only) | NO |

### 3. theme-overrides.css Only (40 selectors) — No Action Needed

These rules exist ONLY in theme-overrides.css and are correct as-is. They target overlay-specific elements.

| Section | Selectors |
|---------|-----------|
| Header bars | `.header-bar`, `.frame-header`, `.hosts-header`, `.stats-header`, `.header-title`, `.hosts-title`, `.stats-team-name` |
| Event bar | `.details-row`, `.teams-text`, `.location-text` |
| Event frame | `.frame-content`, `.frame-title` |
| Stream graphics | `.stream-container`, `.stream-title`, `.stream-event-name`, `.stream-date`, `.stream-accent-bar`, `.stream-branding`, `.stream-branding span` |
| Rotation slate | `.rotation-slate`, `.rotation-slate .rotation-header` |
| Team roster | `.roster-container` |
| Sponsors | `.sponsors-header`, `.sponsors-container` |
| Warm-up/Replay (generic) | `.warmup-header`, `.replay-header`, `.status-row`, `.status-text` |
| Frame overlays | `.frame-overlay .team-label-bg`, `.frame-overlay .divider-line`, `.header-row .team-logo`, `.logo-header .team-logo` |
| Athlete spotlight | `.spotlight-header`, `.spotlight-container` |
| Logo sizing | `.logo-section .team-logo`, `.logo-section`, `.logo-section img`, `.stream-logo`, `.header-logo` |
| Logo contrast | `.logo-section` (white bg), `.logo-section .team-logo`, `.logo-section img`, `.container > .team-logo` |
| Generic accents | `.accent-bar`, `.accent-stripe`, `.accent-border`, `.badge`, `.tag`, `.label-badge` |
| Texture targets | `.panel` |

---

## Value Mismatches

### CRITICAL: `.event-bar-logo` Background

**output.html (line 1211-1212):**
```css
[data-meet-theme] .event-bar-logo {
  background: rgba(255, 255, 255, 0.92);
}
```

**theme-overrides.css (line 45-47):**
```css
[data-meet-theme] .event-bar-logo {
  background: var(--meet-header-bg, #BFBFBF);
}
```

**Resolution:** Per css-scope.md Decision #1, the white background is canonical (logo contrast). Update theme-overrides.css to match output.html.

---

## Porting Plan for Phase 1.3

### Task 1.3a — Event Summary (Port ~22 rules)
- Add new `/* === EVENT SUMMARY === */` section
- Port: `.event-summary-header`, `.event-summary-title`, `.event-summary-footer`, `.event-summary-content`, `.center-divider`, `.rotation-badge`, `.event-summary-dual .diff-row:nth-child(odd/even)`, `.event-summary-quad`/`-v3` rules

### Task 1.3b — Leaderboard (Port ~17 rules)
- Add new `/* === LEADERBOARD === */` section
- Port: `.leaderboard-header`, `.leaderboard-title`, `.leaderboard-footer`, `.graphic-virtius-leaderboard .frame-header/title`, `.leaderboard-table` rules, `.leaderboard-team-logo`, `.apparatus-badge`

### Task 1.3c — Remaining Rules (Port ~19 rules)
- **Event frame:** `.graphic-event-frame .frame-header`, `.graphic-event-frame .frame-title`
- **Event bar details:** `.event-bar-details`, `.event-bar-name`, `.event-bar-location`
- **Warm-up detailed:** `.warm-up-logo-section`, `.warm-up-logo-section img`, `.warm-up-teams-row`, `.warm-up-teams-text`, `.warm-up-status-row`, `.warm-up-status-text`
- **Replay detailed:** `.replay-logo-section`, `.replay-logo-section img`, `.replay-title-row`, `.replay-title-text`, `.replay-status-row`, `.replay-status-text`
- **Texture targets:** Add `.event-summary-header`, `.leaderboard-header`, `.warm-up-container`, `.replay-container` to texture surface lists

---

## Fixed in This Task

**theme-overrides.css line 45-47:** Changed `.event-bar-logo` background from `var(--meet-header-bg, #BFBFBF)` to `rgba(255, 255, 255, 0.92)` to match output.html's logo contrast fix.
