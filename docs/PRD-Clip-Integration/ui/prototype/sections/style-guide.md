# PRD Visualizer Style Guide

Reference for all loops building section HTML files.

---

## Section File Contract

- **No wrapper tags**: Section files are raw HTML fragments — no `<html>`, `<head>`, or `<body>` tags
- **Injected via innerHTML**: Loaded into `#content` div via `fetch('sections/{name}.html').then(r => r.text()).then(html => content.innerHTML = html)`
- **Inherit all CSS**: All variables and classes from `index.html` are available
- **Self-contained**: Each section file should work independently when loaded

---

## CSS Variables

### Theme Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-primary` | `#1a1a2e` | Main background, content area |
| `--bg-secondary` | `#16213e` | Sidebar, panels, cards |
| `--bg-tertiary` | `#0f3460` | Hover states, inputs, highlights |
| `--text-primary` | `#e0e0e0` | Main text |
| `--text-secondary` | `#a0a0a0` | Labels, subtitles |
| `--text-muted` | `#666` | Disabled text, placeholders |
| `--border-color` | `#2a2a4e` | All borders |

### Role Colors (Color Coding System)
| Variable | Value | Role | Usage |
|----------|-------|------|-------|
| `--color-producer` | `#4a9eff` | Producer | ProducerView, primary actions |
| `--color-talent` | `#4ecdc4` | Talent/Commentator | TalentView, talent-specific elements |
| `--color-output` | `#ff8c42` | Output | output.html, broadcast elements |
| `--color-rundown` | `#b56aff` | Rundown | RundownEditor, timing elements |
| `--color-override` | `#ff4757` | Override/Warning | Emergency controls, errors |
| `--color-disabled` | `#666` | Disabled | Inactive states |

### Spacing
| Variable | Value |
|----------|-------|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |

### Typography
| Variable | Value |
|----------|-------|
| `--font-family` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| `--font-mono` | `'SF Mono', 'Fira Code', monospace` |
| `--font-size-sm` | `12px` |
| `--font-size-base` | `14px` |
| `--font-size-lg` | `16px` |
| `--font-size-xl` | `20px` |
| `--font-size-2xl` | `24px` |

### Layout
| Variable | Value |
|----------|-------|
| `--sidebar-width` | `250px` |
| `--panel-width` | `300px` |
| `--header-height` | `48px` |
| `--border-radius` | `6px` |

---

## Shared Classes

### Cards
```html
<div class="card">
  <div class="card-header">
    <div class="card-title">Title Here</div>
    <span class="role-badge producer">Producer</span>
  </div>
  <!-- Content -->
</div>
```

### Buttons
```html
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-secondary">Secondary Action</button>
<button class="btn-icon" title="Icon Button">X</button>
```

### Role Badges
Color-coded badges for indicating which role owns a feature.
```html
<span class="role-badge producer">Producer</span>
<span class="role-badge talent">Talent</span>
<span class="role-badge output">Output</span>
<span class="role-badge rundown">Rundown</span>
```

### Section Badges
Link to PRD sections. Clickable, opens feedback panel to that section.
```html
<span class="section-badge" data-section="4.2">§4.2</span>
```

### State Indicators
Show current state of a component.
```html
<span class="state-indicator idle">idle</span>
<span class="state-indicator loading">loading</span>
<span class="state-indicator playing">playing</span>
<span class="state-indicator error">error</span>
```

### Placeholders
For sections not yet built.
```html
<div class="placeholder">
  <div class="placeholder-icon">🔨</div>
  <div class="placeholder-title">Building...</div>
  <p>Description text</p>
  <div class="placeholder-loop">loop: loop-name</div>
</div>
```

### Keyboard Hint
```html
<span class="kbd">⌘G</span>
```

---

## Color Coding Reference

Use these consistently across all sections:

| Color | Hex | Meaning |
|-------|-----|---------|
| Blue | `#4a9eff` | Producer controls, primary actions, ProducerView |
| Green | `#4ecdc4` | Talent/Commentator features, TalentView |
| Orange | `#ff8c42` | Broadcast output, output.html |
| Purple | `#b56aff` | Rundown/timing, RundownEditor |
| Red | `#ff4757` | Override, warning, error states |
| Gray | `#666` | Disabled, inactive |

---

## Navigation Data Attributes

Nav items use these attributes:
- `data-section="name"` — Section file to load (e.g., `producer` loads `sections/producer.html`)
- `data-color="role"` — Color for the dot indicator (producer, talent, output, rundown)
- `data-scroll="id"` — Element ID to scroll to after loading

---

## Best Practices

1. **Use CSS variables** — Never hardcode colors or spacing
2. **Use role badges** — Mark which role owns each feature
3. **Use section badges** — Link features back to PRD sections
4. **Keep it dark** — Maintain the dark theme aesthetic
5. **Cards for grouping** — Use `.card` for distinct UI components
6. **State indicators** — Show dynamic state with `.state-indicator`
