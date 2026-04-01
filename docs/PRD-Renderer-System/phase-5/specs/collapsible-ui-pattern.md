# Collapsible UI Pattern

## What

The UI pattern for collapsible subcategories in the sidebar. This is a **new feature** required by Phase 5 that does not currently exist in the codebase.

---

## Current State

### No Collapsible Sections Exist

Analysis of both `UrlGeneratorPage.jsx` and `GraphicsControl.jsx` shows:
- No `ChevronDownIcon`, `ChevronRightIcon`, or similar expand/collapse icons
- No `Disclosure` or `Collapse` components
- No toggle state management for section visibility
- All sections are always fully expanded

### Existing Icon Imports

**UrlGeneratorPage.jsx** uses:
- `@heroicons/react/24/outline`: Various icons for actions
- No chevron icons imported

**GraphicsControl.jsx** uses:
- `@heroicons/react/24/outline`: Various icons
- No chevron icons imported

---

## Target State

### Phase 5 Requirement

From `Phase-5-Reorganization.md` Task 2:
> "Subcategory collapsibility: Subcategories are collapsible with a click. Default state: expanded."

### Recommended Pattern

Use `@headlessui/react` Disclosure component (already in dependencies) or a simple state-based toggle.

**Option 1: Headless UI Disclosure**

```jsx
import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

function CollapsibleSubcategory({ title, children, defaultOpen = true }) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className="mb-2">
          <Disclosure.Button className="flex items-center gap-2 w-full text-left text-xs font-medium text-zinc-400 hover:text-zinc-200">
            <ChevronRightIcon
              className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            />
            {title}
          </Disclosure.Button>
          <Disclosure.Panel className="ml-5 mt-1 space-y-1">
            {children}
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  );
}
```

**Option 2: Simple State Toggle**

```jsx
import { useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

function CollapsibleSubcategory({ title, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium text-zinc-400 hover:text-zinc-200"
      >
        <ChevronRightIcon
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
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

### Visual Design

```
┌─────────────────────────────────────┐
│ FULL-SCREEN CARDS                   │  ← Category header (always visible)
│   ▶ Leaderboards                    │  ← Collapsed subcategory (chevron right)
│   ▼ Team Info                       │  ← Expanded subcategory (chevron down)
│       Team 1 Roster        [stage]  │
│       Team 2 Roster        [stage]  │
│   ▶ Sponsors                        │  ← Collapsed
└─────────────────────────────────────┘
```

### Animation

- Chevron rotation: 90° clockwise when expanded
- Duration: 200ms
- Easing: default Tailwind transition

Content reveal options:
1. **Instant** (no animation) — simplest, matches current behavior
2. **Slide down** — more polished, requires height measurement
3. **Fade in** — simple opacity transition

**Recommendation:** Instant reveal for MVP. Animation can be added later.

---

## Integration Points

### UrlGeneratorPage.jsx

**Import required:**
```jsx
import { ChevronRightIcon } from '@heroicons/react/24/outline';
// OR
import { Disclosure } from '@headlessui/react';
```

**Component placement:** Define above `GraphicSidebarButton` component (line ~1600)

**Usage:** Replace subcategory rendering in lines 912-959

### GraphicsControl.jsx

**Import required:** Same as above

**Component placement:** Can be imported from a shared component file or defined locally

**Usage:** Update category rendering in lines 817-921

### Shared Component Option

Create `show-controller/src/components/CollapsibleSubcategory.jsx`:
```jsx
import { useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export function CollapsibleSubcategory({ title, defaultOpen = true, children }) {
  // ... implementation
}
```

Then import in both pages:
```jsx
import { CollapsibleSubcategory } from '../components/CollapsibleSubcategory';
```

---

## State Persistence

### Current Behavior

No state persistence — page refresh resets all subcategories to default state.

### Future Enhancement

Store collapse state in localStorage:
```javascript
// Read initial state
const savedState = JSON.parse(localStorage.getItem('subcategoryState') || '{}');

// On toggle
const updateState = (categoryKey, subcategoryKey, isOpen) => {
  const key = `${categoryKey}/${subcategoryKey}`;
  const newState = { ...savedState, [key]: isOpen };
  localStorage.setItem('subcategoryState', JSON.stringify(newState));
};
```

**Scope for Phase 5:** NOT required. Can be added in a future enhancement.

---

## Risks

### Risk 1: Breaking Existing Tests

If there are snapshot tests or integration tests that rely on sidebar structure, adding collapsible sections will break them.

**Mitigation:** Check for existing tests before implementation; update snapshots as needed.

### Risk 2: Accessibility

Collapsible sections must be keyboard-accessible:
- Enter/Space to toggle
- Arrow keys to navigate between collapsible headers
- ARIA attributes for screen readers

**Headless UI handles this automatically.** If using simple state toggle, add:
```jsx
<button
  aria-expanded={isOpen}
  aria-controls={`subcategory-${id}-content`}
  // ...
>
```

### Risk 3: Nested Focus

When a subcategory is collapsed, buttons inside it should be removed from tab order. This happens automatically when using `{isOpen && children}` pattern.

---

## Open Questions

1. Should state persistence be in scope for Phase 5?
2. Should categories themselves be collapsible, or only subcategories?
3. Should there be a "Collapse All" / "Expand All" control?
4. What's the default state — all expanded, all collapsed, or remember last state?
