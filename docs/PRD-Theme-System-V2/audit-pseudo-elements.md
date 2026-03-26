# Pseudo-Element Usage Audit

**Purpose:** Identify all `::before` and `::after` pseudo-element usage in overlay HTML files and output.html to find potential conflicts with the texture overlay system (Phase 3 per-graphic overrides).

---

## Texture Overlay System (Current Implementation)

The theme system uses `::before` pseudo-elements to apply texture overlays on themed surfaces.

### theme-overrides.css Texture Targets (Lines 308-341)

11 elements receive texture `::before`:

| Element | Used In |
|---------|---------|
| `.panel` | interview-card.html |
| `.header-bar` | event-calendar.html, sponsors-thanks.html, team-roster.html |
| `.frame-header` | event-frame.html |
| `.rotation-slate` | (rendered by output.html inline, NOT in overlay files) |
| `.roster-container` | team-roster.html |
| `.stream-container` | (rendered by output.html inline) |
| `.event-bar-venue` | event-bar.html |
| `.details-row` | event-bar.html |
| `.sponsors-container` | sponsors-thanks.html |
| `.coaches-content` | coaches.html |
| `.spotlight-container` | (rendered by output.html inline) |

### output.html Texture Targets (Lines 1306-1319)

14 elements — same 11 as theme-overrides.css PLUS:

| Additional Element | Notes |
|-------------------|-------|
| `.event-summary-header` | Inline-rendered only |
| `.leaderboard-header` | Inline-rendered only |
| `.warm-up-container` | Inline-rendered only |
| `.replay-container` | Inline-rendered only |

**Note:** `.panel` is in theme-overrides.css but NOT in output.html's texture list — interview-card is an iframe overlay, not inline-rendered.

---

## Other Pseudo-Element Usage (Potential Phase 3 Conflicts)

### who-to-watch-title.html

**Selector:** `.text-side::before` (Line 86)

**Purpose:** Dark gradient overlay for text contrast against variable team background colors.

**CSS:**
```css
.text-side::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 70%;
  height: 100%;
  background: linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 60%, transparent 100%);
  pointer-events: none;
  z-index: -1;
}
```

**Conflict Risk:** LOW — `.text-side` is NOT a texture target class. The gradient is functional (text legibility) and should remain.

---

### rotation-slate.html & rotation-slate-auto.html

**Selector 1:** `.layout-cinema::before` and `.layout-cinema::after` (Lines 688-696)

**Purpose:** Cinema bars (black top/bottom) for theatrical slate appearance.

**CSS:**
```css
.layout-cinema::before,
.layout-cinema::after {
  content: '';
  display: block;
  width: 100%;
  height: 200px;
  background: #000;
  flex-shrink: 0;
}
```

**Conflict Risk:** LOW — `.layout-cinema` is a layout mode class, not a texture target. Cinema bars are structural layout elements.

---

**Selector 2:** `.layout-stripe::before` (Lines 923-931)

**Purpose:** Vertical accent stripe on left edge of stripe layout.

**CSS:**
```css
.layout-stripe::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 40px;
  height: 100%;
  background: var(--meet-border-color, #111);
}
```

**Conflict Risk:** LOW — `.layout-stripe` is a layout mode class, not a texture target. The stripe is structural/decorative and responds to theme via `--meet-border-color`.

---

## Conflict Analysis for Phase 3

### Texture Override Implementation

Phase 3 will extend texture `::before` rules to check for graphic-specific variables first:

```css
[data-meet-theme] .header-bar::before {
  background: var(--header-bar-body-texture,
    var(--meet-texture, none)) center / 1024px repeat;
  opacity: var(--header-bar-body-texture-opacity,
    var(--meet-texture-opacity, 0.08));
  mix-blend-mode: var(--header-bar-body-texture-blend, normal);
}
```

### No Conflicts Found

All existing `::before`/`::after` pseudo-elements are on elements that are NOT texture targets:

| Element | Pseudo-Element Purpose | Is Texture Target? |
|---------|----------------------|-------------------|
| `.text-side` | Gradient contrast overlay | NO |
| `.layout-cinema` | Cinema bars (structural) | NO |
| `.layout-stripe` | Accent stripe (decorative) | NO |

### Verification Checklist

- [x] `.text-side` is not a texture target — no conflict
- [x] `.layout-cinema` is not a texture target — no conflict
- [x] `.layout-stripe` is not a texture target — no conflict
- [x] No overlay HTML file uses `::before` on texture target elements

---

## Recommendations

### Phase 3 Implementation: Proceed as Planned

The per-graphic texture override system can extend the existing texture `::before` rules without conflicts. The CSS variable cascade pattern is safe:

```css
var(--{graphicId}-body-texture, var(--meet-texture, none))
```

### Future Considerations

If new overlay HTML files need custom `::before` pseudo-elements on texture target elements, they must:

1. Use `::after` instead (texture system uses `::before`)
2. OR coordinate z-index to ensure texture appears correctly
3. OR explicitly opt-out of texture for that element via CSS specificity

---

## Summary

| Metric | Count |
|--------|-------|
| Texture target classes (theme-overrides.css) | 11 |
| Texture target classes (output.html) | 14 |
| Non-texture `::before` usages found | 3 |
| Conflicts with Phase 3 | **0** |

**Audit completed:** No conflicts identified. Phase 3 per-graphic texture overrides can proceed without structural changes to existing pseudo-elements.
