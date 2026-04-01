# URL Generator Sidebar

## What

How the URL Generator sidebar currently works and what changes are needed for Phase 5's new category structure.

---

## Current State

**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`

### Sidebar Container (line 580)

```jsx
<div className="w-72 bg-zinc-900 border-r border-zinc-800 p-5 overflow-y-auto flex-shrink-0">
```

Fixed 288px width, scrollable, dark background.

### Data Flow

1. **Import:** Line 6 imports `GRAPHICS, CATEGORIES` from `../lib/graphicsRegistry`
2. **Grouping:** Lines 88-161 — `getGroupedGraphics()` organizes graphics by category/subcategory
3. **Rendering:** Lines 599-960 — Categories rendered in order from CATEGORIES

### Grouping Function (lines 88-161)

```javascript
function getGroupedGraphics(compType, teamCount, teamNames = {}) {
  const isMens = compType?.startsWith('mens');

  // Initialize categories from CATEGORIES
  const categorizedGraphics = {};
  Object.entries(CATEGORIES).sort((a, b) => a[1].order - b[1].order)
    .forEach(([catKey, catDef]) => {
      categorizedGraphics[catKey] = {
        label: catDef.label,
        order: catDef.order,
        subcategories: {},
        graphics: []
      };
      // Initialize subcategories
      Object.entries(catDef.subcategories || {}).forEach(([subKey, subLabel]) => {
        categorizedGraphics[catKey].subcategories[subKey] = {
          label: subLabel,
          graphics: []
        };
      });
    });

  // Place each graphic into its category/subcategory
  for (const graphic of Object.values(GRAPHICS)) {
    // Gender filter
    if (graphic.gender === 'mens' && !isMens) continue;
    if (graphic.gender === 'womens' && isMens) continue;
    // Team count filter
    if (graphic.minTeams && teamCount < graphic.minTeams) continue;
    if (graphic.maxTeams && teamCount > graphic.maxTeams) continue;

    // perTeam expansion
    if (graphic.perTeam) {
      for (let i = 1; i <= teamCount; i++) {
        const teamGraphic = { ...graphic, id: `team${i}-${graphic.id.replace('team-', '')}` };
        // ... place in category
      }
    } else {
      // ... place in category
    }
  }

  return categorizedGraphics;
}
```

### Sidebar Rendering (lines 599-960)

**Structure:**
1. Categories sorted by `order` field
2. Each category renders via `GraphicSection` component
3. Special handlers for specific categories (event-summary, full-bleed, full-screen-cards)

**Category Iteration (lines 599-600):**
```jsx
{Object.entries(groupedGraphics)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([catKey, catData]) => { ... })
}
```

**Special Handlers:**
- Lines 604-660: `event-summary` — Theme dropdown + rotation/apparatus grid
- Lines 664-800: `full-bleed` — Rotation slate picker with layout dropdown
- Lines 803-909: `full-screen-cards` — Combined AA with session ID inputs
- Lines 912-959: Default rendering (all other categories)

### Components

**GraphicSection (lines 1604-1611):**
```jsx
function GraphicSection({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
```

**GraphicSidebarButton (lines 1613-1637):**
```jsx
function GraphicSidebarButton({ id, label, number, renderer, active, onClick }) {
  const badgeClasses = renderer === 'stage'
    ? 'bg-teal-500/20 text-teal-400'
    : 'bg-zinc-700 text-zinc-400';

  return (
    <button className="w-full px-3 py-2.5 rounded-lg text-left text-sm ...">
      {number && <span className="text-xs w-5 ...">{number}</span>}
      <span className="flex-1 truncate">{label}</span>
      {renderer && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeClasses}`}>
          {renderer}
        </span>
      )}
    </button>
  );
}
```

---

## Target State

### Subcategory Rendering

Currently, subcategories are rendered inline within their parent category. Phase 5 requires:
1. Subcategories should be **collapsible** (click to expand/collapse)
2. Default state: **expanded**

### New Component: CollapsibleSubcategory

```jsx
function CollapsibleSubcategory({ title, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium text-zinc-400 w-full"
      >
        <ChevronRightIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        {title}
      </button>
      {isOpen && (
        <div className="ml-5 mt-1 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
```

### Updated Sidebar Structure

```jsx
{Object.entries(groupedGraphics)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([catKey, catData]) => (
    <GraphicSection key={catKey} title={catData.label}>
      {/* Subcategories */}
      {Object.entries(catData.subcategories)
        .filter(([_, subData]) => subData.graphics.length > 0)
        .map(([subKey, subData]) => (
          <CollapsibleSubcategory key={subKey} title={subData.label}>
            {subData.graphics.map((graphic, idx) => (
              <GraphicSidebarButton
                key={graphic.id}
                id={graphic.id}
                label={graphic.label}
                number={idx + 1}
                renderer={graphic.renderer}
                active={selectedGraphic === graphic.id}
                onClick={() => setSelectedGraphic(graphic.id)}
              />
            ))}
          </CollapsibleSubcategory>
        ))
      }
      {/* Uncategorized graphics (no subcategory) */}
      {catData.graphics.map((graphic, idx) => (
        <GraphicSidebarButton key={graphic.id} ... />
      ))}
    </GraphicSection>
  ))
}
```

### Gender Filtering

Already implemented (lines 116-121). No changes needed.

### Special Category Handlers

The special handlers for `event-summary`, `full-bleed`, and `full-screen-cards` may need adjustment:
1. **event-summary:** Keep theme dropdown + inline grids (unique UI)
2. **full-bleed:** Keep rotation slate picker with layout dropdown
3. **full-screen-cards:** Keep Combined AA session ID inputs

These special handlers should be preserved as-is — they have unique UX requirements.

---

## Risks

### Risk 1: Special Handler Complexity

The sidebar has significant special-case code for specific categories. Adding collapsible subcategories while preserving these handlers will increase complexity.

**Mitigation:** Keep special handlers at the category level; only apply collapsible pattern to default subcategory rendering.

### Risk 2: Sidebar Height

Collapsible subcategories will increase the total sidebar content height when fully expanded. The current fixed-width scrollable container handles this, but dense categories may feel cluttered.

**Mitigation:** Start with subcategories collapsed by default for categories with >3 subcategories.

### Risk 3: State Persistence

Collapse state is not persisted. Refreshing the page or selecting a different competition will reset all subcategories to default state.

**Future enhancement:** Store collapse state in localStorage keyed by category/subcategory.

---

## Open Questions

1. Should collapse state be persisted across page refreshes?
2. Should special category handlers (event-summary, full-bleed, full-screen-cards) also use collapsible subcategories, or remain with their unique UX?
3. What's the default collapse state — all expanded, all collapsed, or context-dependent?
