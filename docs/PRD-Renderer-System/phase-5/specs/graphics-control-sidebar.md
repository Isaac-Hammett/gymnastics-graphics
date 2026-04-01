# Graphics Control Sidebar

## What

How the Web Graphics Panel (GraphicsControl) sidebar currently works and what changes are needed for Phase 5.

---

## Current State

**File:** `show-controller/src/components/GraphicsControl.jsx`

### Key Differences from URL Generator

| Aspect | GraphicsControl | UrlGeneratorPage |
|--------|-----------------|------------------|
| Layout | Embedded in producer panel | Dedicated left sidebar (72px wide) |
| Button Grid | 3 columns | Variable (4, 6, or 7 columns) |
| Subcategories | None — flat categories only | Full subcategory support |
| Purpose | Quick graphic triggering | URL generation + preview |

### Graphics List Structure (lines 817-921)

The graphics list is rendered as **flat sections** with no subcategory nesting:

```jsx
{sections.map(section => (
  <div key={section}>
    <div className="text-xs font-semibold text-zinc-400 uppercase mb-2">
      {section}
    </div>
    <div className="grid grid-cols-3 gap-2">
      {graphicButtons.filter(g => g.section === section).map(btn => (
        <button key={btn.id} onClick={() => sendGraphic(btn.id)}>
          <span className="renderer-badge">{btn.renderer}</span>
          {btn.label}
        </button>
      ))}
    </div>
  </div>
))}
```

### Category Mapping (lines 11-17)

```javascript
const CATEGORY_TO_SECTION = {
  'pre-meet': 'Pre-Meet',
  'in-meet': 'In-Meet',
  'frame-overlays': 'Frame Overlays',
  'stream': 'Stream',
  'sponsors': 'Sponsors'
};
```

Only 5 categories mapped — missing `full-screen-cards`, `lower-thirds`, `full-bleed`, `video-frames`, `standalone`, `event-summary`.

### Section Order (line 660)

```javascript
const sections = ['Pre-Meet', 'In-Meet', 'Frame Overlays', 'Leaderboards', 'Stream', 'Sponsors'];
```

Hardcoded section order, not derived from `categories.json`.

### Renderer Badges (lines 837-855)

Badges use abbreviated text:
- `stg` for stage
- `ovl` for overlay
- `out` for output

```jsx
const badgeText = renderer === 'stage' ? 'stg' : renderer === 'overlay' ? 'ovl' : 'out';
```

### Data Source (lines 156-190)

Uses registry helper functions:
```javascript
const registryGraphics = getGraphicsForCompetition(config?.compType, teamNames);
```

Filters to specific categories only:
```javascript
.filter(g => ['pre-meet', 'in-meet', 'frame-overlays', 'stream', 'sponsors'].includes(g.category))
```

---

## Target State

### Match URL Generator Structure

Per Phase 5 Task 3:
> "The Web Graphics Panel sidebar should mirror the URL Generator's new structure. Same categories, same subcategories, same gender filtering."

### Required Changes

1. **Use all categories** from `CATEGORIES`, not hardcoded 5
2. **Add subcategory support** with collapsible sections
3. **Match renderer badge style** (full text: `stage`, `overlay`, `output`)
4. **Derive section order** from `categories.json` order field

### Updated Section Generation

```javascript
// Replace hardcoded CATEGORY_TO_SECTION and sections array
const sections = useMemo(() => {
  return Object.entries(CATEGORIES)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, def]) => ({
      key,
      label: def.label,
      subcategories: def.subcategories || {}
    }));
}, []);
```

### Updated Rendering

```jsx
{sections.map(section => (
  <div key={section.key}>
    <div className="text-xs font-semibold text-zinc-400 uppercase mb-2">
      {section.label}
    </div>
    {Object.keys(section.subcategories).length > 0 ? (
      // Render with subcategory grouping
      Object.entries(section.subcategories).map(([subKey, subLabel]) => {
        const subGraphics = graphicButtons.filter(
          g => g.category === section.key && g.subcategory === subKey
        );
        if (subGraphics.length === 0) return null;
        return (
          <CollapsibleSubcategory key={subKey} title={subLabel}>
            <div className="grid grid-cols-3 gap-2">
              {subGraphics.map(btn => (
                <GraphicButton key={btn.id} {...btn} />
              ))}
            </div>
          </CollapsibleSubcategory>
        );
      })
    ) : (
      // Render flat (no subcategories)
      <div className="grid grid-cols-3 gap-2">
        {graphicButtons.filter(g => g.category === section.key).map(btn => (
          <GraphicButton key={btn.id} {...btn} />
        ))}
      </div>
    )}
  </div>
))}
```

### Renderer Badge Style Update

Change from abbreviated to full text:
```jsx
// Before
const badgeText = renderer === 'stage' ? 'stg' : renderer === 'overlay' ? 'ovl' : 'out';

// After
const badgeText = renderer; // 'stage', 'overlay', or 'output'
const badgeClasses = renderer === 'stage'
  ? 'bg-teal-500/20 text-teal-400'
  : 'bg-zinc-700 text-zinc-400';
```

---

## Risks

### Risk 1: Space Constraints

GraphicsControl is embedded in a narrower panel than UrlGeneratorPage. Adding subcategories with collapsible sections may make the UI too dense.

**Mitigation:** Consider starting subcategories collapsed by default in GraphicsControl, or use a more compact layout (2 columns instead of 3 when space is tight).

### Risk 2: Missing Category Filters

Current code explicitly filters to 5 categories. Adding new categories may expose graphics that weren't previously visible in the producer view.

**Verification needed:** Ensure all graphics appropriate for live triggering appear, and graphics meant only for URL generation (preview) are excluded.

### Risk 3: Special Handling (Rotation Slate, Event Summary)

GraphicsControl has inline special handling for:
- Rotation Slate (lines 861-918)
- Event Summary (lines 924-979)

These must be preserved while adding subcategory support.

---

## Open Questions

1. Should GraphicsControl show ALL graphics, or only a subset appropriate for live triggering?
2. Should badges use full text (`stage`) or abbreviated (`stg`) to save space?
3. Should subcategories be collapsed by default in the tighter GraphicsControl layout?
4. How should the Skeletons & Blocks section appear (if at all) in GraphicsControl vs URL Generator?
