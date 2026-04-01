# Sidebar Badge Patterns

## What

Existing badge patterns in the codebase that inform how renderer badges should be implemented in the URL Generator and Web Graphics Panel sidebars.

## Current State

### Existing Badge Implementations

#### StatsStatusBadge (`show-controller/src/components/StatsStatusBadge.jsx:142`)
```jsx
<span className={`px-2 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}>
  {badgeText}
</span>
```

#### ScoringFeedBadge (`show-controller/src/components/ScoringFeedBadge.jsx:120`)
```jsx
<button className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}>
  {icon}
  {badgeText}
</button>
```

#### ThemeErrorBadge (`show-controller/src/components/ThemeErrorLog.jsx:178`)
```jsx
<button className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg border border-red-500/30">
  <PaintBrushIcon className="w-3.5 h-3.5" />
  <span>{errorCount}</span>
</button>
```

#### Gender Badge (`show-controller/src/pages/HomePage.jsx:1012`)
```jsx
<span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${genderBadge.color}`}>
  {genderBadge.label}
</span>
```

### Common Tailwind Classes

**Sizing/Padding:**
- `px-2 py-0.5` — most common for small badges
- `px-2 py-1` — larger badges
- `px-1 py-px` — tiny badges (RTN Auto-Filled)

**Text:**
- `text-[10px]` — extra small
- `text-xs` — small (12px)
- `font-medium` or `font-bold`

**Styling:**
- `rounded` — standard border radius
- `rounded-lg` — larger badges
- `rounded-full` — pill-shaped

### Color Patterns

**Status badges (transparent background + border):**
```
bg-{color}-500/20 text-{color}-400 border border-{color}-500/30
```
- Error: red
- Success: green
- Warning: yellow
- Info: blue

**Solid badges:**
```
bg-{color}-500 text-white
```
- Gender: pink/blue
- VM status: various

**Neutral/disabled:**
```
bg-zinc-700 text-zinc-400
```

## Target State

### Renderer Badge Component

```jsx
function RendererBadge({ renderer }) {
  const styles = {
    stage: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    overlay: 'bg-zinc-700 text-zinc-400',
    output: 'bg-zinc-700 text-zinc-400',
  };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${styles[renderer] || styles.output}`}>
      {renderer}
    </span>
  );
}
```

### In GraphicSidebarButton

```jsx
function GraphicSidebarButton({ id, label, number, active, onClick, renderer }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors flex items-center gap-2 ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      <span className={`text-xs w-5 ${active ? 'text-blue-200' : 'text-zinc-500'}`}>
        {number}
      </span>
      <span className="flex-1">{label}</span>
      {renderer && <RendererBadge renderer={renderer} />}
    </button>
  );
}
```

### Preview Iframe Indicator

```jsx
function PreviewIndicator({ renderer, url, file }) {
  const label = renderer === 'stage'
    ? 'Rendering via stage.html'
    : renderer === 'overlay'
      ? `Rendering via overlays/${file}`
      : 'Rendering via output.html';

  const labelColor = renderer === 'stage' ? 'text-teal-400' : 'text-zinc-400';

  return (
    <div className="text-xs mb-2">
      <div className={labelColor}>{label}</div>
      <div className="text-zinc-500 truncate" title={url}>
        {url}
      </div>
    </div>
  );
}
```

### Badge Color Rationale

| Renderer | Color | Rationale |
|----------|-------|-----------|
| `stage` | Teal | New, modern — stands out from legacy |
| `overlay` | Gray | Legacy, neutral — doesn't draw attention |
| `output` | Gray | Legacy, neutral — doesn't draw attention |

As graphics migrate from overlay/output → stage, the sidebar becomes progressively more teal, showing migration progress.

## Risks

1. **Badge width** — long renderer names may overflow in narrow sidebars
2. **Accessibility** — color alone shouldn't convey meaning (use text too)
3. **Consistency** — must match badge patterns elsewhere in the app

## Open Questions

1. Should badges be interactive (clickable for info)?
2. Should there be a legend explaining badge colors?
3. Should badges be hidden when not needed (e.g., all graphics are same renderer)?
