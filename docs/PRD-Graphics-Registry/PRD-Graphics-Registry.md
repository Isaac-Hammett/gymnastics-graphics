# PRD-Graphics-Registry: Schema-Driven Graphics System

**Version:** 1.1
**Date:** 2026-01-22
**Status:** COMPLETE
**Depends On:** None (Foundation)
**Blocks:** PRD-Rundown-04-Pickers, URL Generator improvements

---

## Problem Statement

Currently, adding a new graphic requires touching multiple places in the codebase:

| File | What to Update |
|------|----------------|
| `overlays/*.html` or `output.html` | Create the graphic renderer |
| `urlBuilder.js` | Add URL generation logic |
| `graphicButtons.js` | Add to button array(s) |
| `graphicButtons.js` | Add to `graphicNames` object |
| `graphicButtons.js` | Maybe add to category-specific getter function |
| `GraphicsControl.jsx` | Has its own hardcoded `baseGraphicButtons` array |
| `UrlGeneratorPage.jsx` | Must import the correct category |

This leads to:
- Forgotten updates (graphic works but doesn't appear in UI)
- Inconsistencies between pickers
- No validation of what parameters a graphic accepts
- No way to auto-generate picker UI for complex graphics

With 50+ graphics planned, this will become a maintenance burden.

### Specific Issues Discovered

1. **Dynamic team names not showing in Producer View** - `GraphicsControl.jsx` shows "Team 1 Coaches" instead of "Simpson Coaches" because it uses hardcoded labels instead of the `getPreMeetButtons(teamCount, teamNames)` function that URL Generator uses.

2. **New graphics don't appear everywhere** - The `replay` graphic is defined in `graphicButtons.js` under the `inMeet` category, but `UrlGeneratorPage.jsx` never imports or renders that category, so replay doesn't appear in the URL Generator.

3. **No centralized view of all graphics** - There's no way to see all graphics in the system, which competition types use them, or configure their availability.

---

## Goal

**One definition per graphic** that:
1. Appears in all pickers automatically (URL Generator, Rundown Editor, Producer View)
2. Generates correct URLs automatically (for standard patterns)
3. Renders appropriate picker UI automatically (dropdowns, inputs based on param schema)
4. Provides keyword matching for smart recommendations

---

## Solution: Graphics Registry with Parameter Schema

### Core Concept

Each graphic is defined once with:
- **Identity**: id, label, category, keywords
- **Constraints**: gender, minTeams, maxTeams
- **Rendering**: renderer type, file path
- **Parameters**: schema defining inputs, types, validation, dependencies

The UI components read the schema and render appropriate inputs automatically.

---

## Registry Schema

### Graphic Definition Structure

```javascript
{
  // Identity
  id: 'replay',                    // Unique identifier
  label: 'Replay',                 // Display name
  category: 'in-meet',             // Grouping for picker UI
  keywords: ['replay', 'instant'], // For smart recommendations

  // Constraints
  gender: 'both',                  // 'mens' | 'womens' | 'both'
  minTeams: 1,                     // Minimum teams required (optional)
  maxTeams: 6,                     // Maximum teams supported (optional)

  // Rendering
  renderer: 'overlay',             // 'overlay' | 'output'
  file: 'replay.html',             // File path (overlays/) or graphic name (output.html)
  transparent: true,               // For OBS background handling

  // Parameters (schema)
  params: {
    team1Logo: {
      type: 'string',
      source: 'competition',       // Auto-filled from competition config
      required: true,
    },
  },
}
```

### Parameter Types

| Type | Description | UI Component |
|------|-------------|--------------|
| `string` | Text value | Text input (or hidden if `source: 'competition'`) |
| `number` | Numeric value | Number input |
| `enum` | Fixed options | Dropdown |
| `boolean` | True/false | Checkbox |

### Parameter Properties

```javascript
{
  type: 'enum',                    // Required: data type
  options: ['opt1', 'opt2'],       // Required for enum: available values
  optionLabels: {                  // Optional: display labels for options
    'opt1': 'Option One',
    'opt2': 'Option Two',
  },
  required: true,                  // Is this param required?
  default: 'opt1',                 // Default value
  source: 'competition',           // Auto-fill from competition config
  dependsOn: {                     // Conditional visibility
    otherParam: 'specificValue',
  },
  min: 1,                          // For number: minimum value
  max: 6,                          // For number: maximum value
  label: 'Display Label',          // Label for UI (defaults to param key)
  description: 'Help text',        // Tooltip/help text
}
```

---

## Example Graphic Definitions

### Simple Overlay (replay)

```javascript
'replay': {
  id: 'replay',
  label: 'Replay',
  category: 'in-meet',
  keywords: ['replay', 'instant replay', 'review'],
  gender: 'both',
  renderer: 'overlay',
  file: 'replay.html',
  transparent: true,
  params: {
    team1Logo: {
      type: 'string',
      source: 'competition',
      required: true,
    },
  },
},
```

### Per-Team Graphic (team coaches)

```javascript
'team-coaches': {
  id: 'team-coaches',
  label: 'Team Coaches',
  category: 'pre-meet',
  keywords: ['coach', 'coaches', 'staff', 'head coach'],
  gender: 'both',
  renderer: 'overlay',
  file: 'coaches.html',
  transparent: true,
  perTeam: true,                   // Generates team1-coaches, team2-coaches, etc.
  params: {
    teamSlot: {
      type: 'number',
      min: 1,
      max: 6,
      required: true,
      label: 'Team',
    },
    logo: {
      type: 'string',
      source: 'competition',       // From competition.teams[teamSlot].logo
      required: true,
    },
    coaches: {
      type: 'string',
      source: 'competition',       // From competition.teams[teamSlot].coaches
      required: true,
    },
  },
},
```

### Complex Graphic (event-summary)

```javascript
'event-summary': {
  id: 'event-summary',
  label: 'Event Summary',
  category: 'event-summary',
  keywords: ['summary', 'rotation', 'recap', 'results', 'scores'],
  gender: 'both',
  renderer: 'output',
  file: 'event-summary',
  transparent: false,
  params: {
    summaryMode: {
      type: 'enum',
      options: ['rotation', 'apparatus'],
      optionLabels: {
        'rotation': 'By Rotation',
        'apparatus': 'By Apparatus',
      },
      required: true,
      default: 'rotation',
      label: 'Mode',
    },
    summaryRotation: {
      type: 'number',
      min: 1,
      max: 6,                      // Adjusted by gender at runtime (4 for women)
      label: 'Rotation',
      dependsOn: { summaryMode: 'rotation' },
    },
    summaryApparatus: {
      type: 'enum',
      options: ['fx', 'ph', 'sr', 'vt', 'pb', 'hb', 'ub', 'bb'],
      label: 'Apparatus',
      dependsOn: { summaryMode: 'apparatus' },
      // Options filtered by gender at runtime
    },
    summaryTheme: {
      type: 'enum',
      options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'],
      default: 'default',
      label: 'Theme',
    },
    summaryFormat: {
      type: 'enum',
      options: ['alternating', 'head-to-head'],
      default: 'alternating',
      label: 'Format',
    },
  },
},
```

---

## Helper Functions

### getAllGraphicsForCompetition(compType, teamNames)

Returns flat array of all graphics available for a competition:

```javascript
// Input: 'womens-quad', { 1: 'UCLA', 2: 'Oregon', 3: 'Utah', 4: 'Arizona' }
// Output:
[
  { id: 'logos', label: 'Team Logos', category: 'pre-meet' },
  { id: 'team1-coaches', label: 'UCLA Coaches', category: 'pre-meet' },
  { id: 'team2-coaches', label: 'Oregon Coaches', category: 'pre-meet' },
  // ... filtered to exclude men's-only events, team5/6 graphics, etc.
]
```

### getGraphicSchema(graphicId)

Returns the full schema for a graphic:

```javascript
// Input: 'event-summary'
// Output: { id, label, category, keywords, params, ... }
```

### getRecommendedGraphic(segmentName, compType, teamNames)

Returns best-guess graphic based on segment name:

```javascript
// Input: 'UCLA Coaches Introduction', 'womens-quad', { 1: 'UCLA', ... }
// Output: { id: 'team1-coaches', label: 'UCLA Coaches', confidence: 0.9 }
```

### buildGraphicUrl(graphicId, params, competitionConfig)

Generates URL from graphic definition and params:

```javascript
// Input: 'replay', { team1Logo: '...' }, competitionConfig
// Output: 'https://commentarygraphic.com/overlays/replay.html?team1Logo=...'
```

---

## Schema-Driven Picker Component

### GraphicPicker Component

```jsx
<GraphicPicker
  compType="womens-quad"
  teamNames={{ 1: 'UCLA', 2: 'Oregon', 3: 'Utah', 4: 'Arizona' }}
  value={{ graphicId: 'event-summary', params: { summaryMode: 'rotation', summaryRotation: 1 } }}
  onChange={(value) => {}}
  segmentName="Rotation 1 Summary"    // For recommendations
/>
```

### Behavior

1. Dropdown shows all available graphics (grouped by category)
2. If graphic has params with `source: 'competition'`, they're auto-filled and hidden
3. If graphic has user-editable params, additional inputs appear below dropdown
4. `dependsOn` controls conditional visibility of param inputs
5. Recommendation shown as hint if segment name matches keywords

### UI Example

```
┌─ GRAPHIC ──────────────────────────────────────────────────────────────────┐
│                                                                             │
│  💡 Suggested: Event Summary (based on segment name)                        │
│                                                                             │
│  Graphic         [Event Summary ▼]                                          │
│                                                                             │
│  ┌─ Parameters ───────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  Mode           [By Rotation ▼]                                         ││
│  │                                                                         ││
│  │  Rotation       [R1 ▼]                                                  ││
│  │                                                                         ││
│  │  Theme          [ESPN ▼]                                                ││
│  │                                                                         ││
│  │  Format         [Alternating ▼]                                         ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `show-controller/src/lib/graphicsRegistry.js` | Single source of truth for all graphics |
| `show-controller/src/pages/GraphicsManagerPage.jsx` | Admin UI for viewing/configuring all graphics |
| `show-controller/src/components/shared/GraphicPicker.jsx` | Schema-driven picker component (Phase 7) |

### Files to Modify

| File | Changes |
|------|---------|
| `show-controller/src/lib/graphicButtons.js` | Becomes thin wrapper, derives from registry |
| `show-controller/src/lib/urlBuilder.js` | Uses registry for URL generation |
| `show-controller/src/components/GraphicsControl.jsx` | Use registry with dynamic team names |
| `show-controller/src/pages/UrlGeneratorPage.jsx` | Add missing In-Meet section, use registry |
| `show-controller/src/App.jsx` | Add `/graphics-manager` route |

---

## Migration Strategy

### Phase 1: Create Registry (Non-Breaking)
1. Create `graphicsRegistry.js` with all current graphics (~35 graphics)
2. Export helper functions: `getAllGraphics()`, `getGraphicById()`, `getGraphicsForCompetition()`, `getGraphicsByCategory()`, `buildGraphicUrl()`
3. Keep `graphicButtons.js` unchanged initially

**Graphics to define by category:**
- **pre-meet:** logos, event-bar, warm-up, hosts, team{1-6}-stats, team{1-6}-coaches
- **in-meet:** replay
- **event-frames:** floor, pommel, rings, vault, pbars, hbar, ubars, beam, allaround, final, order, lineups, summary
- **frame-overlays:** frame-quad, frame-tri-center, frame-tri-wide, frame-team-header, frame-single, frame-dual
- **leaderboards:** leaderboard-{fx,ph,sr,vt,pb,hb,ub,bb,aa}
- **event-summary:** summary-r{1-6}, summary-{fx,ph,sr,vt,pb,hb,ub,bb}
- **stream:** stream-starting, stream-thanks

### Phase 2: Migrate graphicButtons.js
1. Make `graphicButtons.js` derive from registry
2. Keep existing function signatures for backwards compatibility
3. All existing code continues to work

```javascript
import { getGraphicsByCategory, getGraphicsForCompetition } from './graphicsRegistry';

// Derive graphicNames from registry
export const graphicNames = Object.fromEntries(
  getAllGraphics().map(g => [g.id, g.label])
);

// Keep all helper functions, delegate to registry
export function getPreMeetButtons(teamCount = 2, teamNames = {}) {
  return getGraphicsForCompetition('pre-meet', { teamCount, teamNames });
}
```

### Phase 3: Update GraphicsControl.jsx (Dynamic Team Names)
1. Remove hardcoded `baseGraphicButtons` array (lines 8-36)
2. Import from registry with dynamic team name support
3. Buttons now show "Simpson Coaches" instead of "Team 1 Coaches"

```javascript
import { getGraphicsForCompetition } from '../lib/graphicsRegistry';

const graphicButtons = useMemo(() => {
  const teamNames = {};
  for (let i = 1; i <= maxTeams; i++) {
    teamNames[i] = config?.[`team${i}Name`] || `Team ${i}`;
  }
  return getGraphicsForCompetition(config?.compType, teamNames);
}, [config, maxTeams]);
```

### Phase 4: Update UrlGeneratorPage.jsx (Add Missing Categories)
1. Add In-Meet section to sidebar (currently missing, so `replay` doesn't appear)
2. Use registry for `baseGraphicTitles` generation

```jsx
<GraphicSection title="In-Meet">
  {getGraphicsByCategory('in-meet').map((btn) => (
    <GraphicSidebarButton ... />
  ))}
</GraphicSection>
```

### Phase 5: Update urlBuilder.js (Use Registry)
1. Refactor `generateGraphicURL()` to use registry schema
2. Keep existing `build*URL()` functions as fallbacks for complex cases

### Phase 6: Create Graphics Manager Page
1. Create `GraphicsManagerPage.jsx` at route `/graphics-manager`
2. Features:
   - List all graphics grouped by category
   - View/edit graphic properties: id, label, category, gender, renderer, file
   - Show which competition types use each graphic
   - Preview graphic with test data
   - Filter by category, gender, renderer type

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Graphics Manager                              [+ Add Graphic]  │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [All Categories ▼] [All Genders ▼] [Search...]        │
├─────────────────────────────────────────────────────────────────┤
│  PRE-MEET                                                       │
│  ┌──────┬────────────┬────────────┬──────────┬────────────────┐│
│  │ ID   │ Label      │ Gender     │ Renderer │ Actions        ││
│  ├──────┼────────────┼────────────┼──────────┼────────────────┤│
│  │logos │Team Logos  │both        │overlay   │[Edit][Preview] ││
│  │...   │...         │...         │...       │...             ││
│  └──────┴────────────┴────────────┴──────────┴────────────────┘│
│                                                                 │
│  IN-MEET                                                        │
│  ┌──────┬────────────┬────────────┬──────────┬────────────────┐│
│  │replay│Replay      │both        │overlay   │[Edit][Preview] ││
│  └──────┴────────────┴────────────┴──────────┴────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Phase 7: Build Schema-Driven Picker (Future)
1. Create `GraphicPicker.jsx` component
2. Reads schema, renders appropriate inputs
3. Test with complex graphics (event-summary)
4. Use in Rundown Editor (PRD-Rundown-04)

---

## Acceptance Criteria

### Registry
- [ ] All ~30 existing graphics defined in registry
- [ ] Each graphic has: id, label, category, keywords, renderer, params
- [ ] `getAllGraphicsForCompetition()` returns correct filtered list
- [ ] `getRecommendedGraphic()` returns matches based on keywords
- [ ] `buildGraphicUrl()` generates correct URLs

### Backwards Compatibility
- [ ] `graphicButtons.js` functions still work (`getPreMeetButtons`, etc.)
- [ ] `graphicNames` object still works
- [ ] URL Generator continues to work during migration

### GraphicPicker Component
- [ ] Renders dropdown with all available graphics
- [ ] Groups graphics by category
- [ ] Shows recommendation based on segment name
- [ ] Renders param inputs based on schema
- [ ] Handles `dependsOn` conditional visibility
- [ ] Auto-fills params with `source: 'competition'`

---

## Adding a New Graphic (After Refactor)

### Standard Overlay Graphic

1. Create `overlays/newgraphic.html`
2. Add entry to `GRAPHICS` in `graphicsRegistry.js`:

```javascript
'new-graphic': {
  id: 'new-graphic',
  label: 'New Graphic',
  category: 'in-meet',
  keywords: ['new', 'keywords'],
  gender: 'both',
  renderer: 'overlay',
  file: 'newgraphic.html',
  transparent: true,
  params: {
    // Define any params
  },
},
```

**Done.** Appears in all pickers with correct URL generation.

### Complex Dynamic Graphic

1. Add rendering logic to `output.html`
2. Add entry to `GRAPHICS` with full param schema
3. (Optional) Add custom URL logic if non-standard

---

## Questions Resolved

1. **Registry location**: JS file for now (easier to version control, no network dependency)

2. **Param validation**: Yes, warn in console for missing required params

3. **Theme/color options**: In registry, as enum options

4. **Graphics Manager UI level**: Full configuration - edit graphic properties, categories, parameters, and availability

5. **Graphics Manager location**: New dedicated page at `/graphics-manager`

---

## Implementation Order

| Step | File | Action | Breaking? |
|------|------|--------|-----------|
| 1 | `graphicsRegistry.js` | CREATE | No |
| 2 | `graphicButtons.js` | MODIFY (wrapper) | No |
| 3 | `GraphicsControl.jsx` | MODIFY | No |
| 4 | `UrlGeneratorPage.jsx` | MODIFY | No |
| 5 | `urlBuilder.js` | MODIFY | No |
| 6 | `App.jsx` | MODIFY (add route) | No |
| 7 | `GraphicsManagerPage.jsx` | CREATE | No |

---

## Verification Steps

1. **Build passes:** `cd show-controller && npm run build`
2. **Producer View:** Open competition → Verify "UCLA Coaches" shows (not "Team 1 Coaches")
3. **URL Generator:** Verify "In-Meet" section appears with Replay
4. **Graphics Manager:** Navigate to `/graphics-manager`, verify all ~35 graphics listed
5. **URL Generation:** Click graphics in URL Generator, verify URLs work in preview
6. **Backwards Compatibility:** All existing imports still work without errors

---

## Current State Analysis

### Where Graphics Are Defined Today

| Location | What It Contains | Issues |
|----------|------------------|--------|
| `graphicButtons.js` | Button arrays by category, `graphicNames` object, helper functions | No dynamic team names in exports |
| `GraphicsControl.jsx` | Hardcoded `baseGraphicButtons` array (lines 8-36) | Shows "Team 1 Coaches" not actual team names |
| `UrlGeneratorPage.jsx` | Imports from graphicButtons but misses `inMeet` | `replay` doesn't appear |
| `urlBuilder.js` | URL generation with switch/case | Duplicates graphic knowledge |

### How Dynamic Team Names Work (URL Generator vs Producer View)

**URL Generator (works correctly):**
```javascript
// Lines 272-282 in UrlGeneratorPage.jsx
const teamNames = useMemo(() => {
  const names = {};
  for (let i = 1; i <= teamCount; i++) {
    if (formData[`team${i}Name`]) {
      names[i] = formData[`team${i}Name`];
    }
  }
  return names;
}, [formData, teamCount]);

const preMeetButtons = useMemo(() => getPreMeetButtons(teamCount, teamNames), [teamCount, teamNames]);
// Result: Buttons show "Simpson Coaches", "Northwestern Stats", etc.
```

**GraphicsControl.jsx (broken - shows static labels):**
```javascript
// Lines 8-36 - hardcoded array
const baseGraphicButtons = [
  { id: 'team1-coaches', label: 'Team 1 Coaches', section: 'Pre-Meet', team: 1 },
  // ...always shows "Team 1 Coaches" regardless of actual team name
];
```

---

## Registry Schema with Dynamic Labels

Each graphic can have a `labelTemplate` for dynamic substitution:

```javascript
{
  id: 'team-coaches',
  label: 'Team Coaches',           // Base label
  labelTemplate: '{teamName} Coaches',  // Dynamic substitution
  category: 'pre-meet',
  perTeam: true,  // Generates team1-coaches, team2-coaches, etc.
  // ...
}
```

When `getGraphicsForCompetition(compType, teamNames)` is called with `teamNames = {1: 'Simpson', 2: 'Northwestern'}`:
- Returns `{ id: 'team1-coaches', label: 'Simpson Coaches', ... }`
- Returns `{ id: 'team2-coaches', label: 'Northwestern Coaches', ... }`
