# Guide: Adding New Graphics to Gymnastics Graphics System

**Version:** 2.0
**Date:** 2026-01-22
**Audience:** Developers adding new graphics to the system

---

## Overview

This guide explains how to add new graphics to the gymnastics graphics system using the schema-driven Graphics Registry.

**Adding a new graphic requires only 2 steps:**

1. Create the HTML renderer
2. Add ONE entry to `graphicsRegistry.js`

The graphic automatically appears in all pickers (URL Generator, Producer View, Rundown Editor) with correct URL generation.

---

## Quick Start: Adding a Simple Overlay Graphic

### Example: Adding a "Technical Difficulty" indicator

**Step 1: Create the HTML file**

Create `overlays/technical.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <title>Technical Difficulty</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: transparent;  /* IMPORTANT: Transparent for OBS */
    }

    .indicator {
      position: absolute;
      bottom: 120px;
      left: 100px;
      display: flex;
      flex-direction: row;
      animation: slideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-100px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .logo-section {
      width: 100px;
      background: #BFBFBF;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 15px;
    }

    .logo-section img {
      width: 70px;
      height: 70px;
      object-fit: contain;
    }

    .content-section {
      background: #000;
      padding: 20px 40px;
    }

    .title-text {
      font-size: 28px;
      font-weight: 800;
      color: #fff;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="indicator">
    <div class="logo-section">
      <img id="logo" src="" alt="Team">
    </div>
    <div class="content-section">
      <div class="title-text">TECHNICAL DIFFICULTY</div>
    </div>
  </div>

  <script>
    // Read URL parameters
    const params = new URLSearchParams(window.location.search);

    // Set logo from URL parameter
    document.getElementById('logo').src = params.get('team1Logo') || params.get('logo') || '';
  </script>
</body>
</html>
```

**Step 2: Add to the Registry**

Add ONE entry to `show-controller/src/lib/graphicsRegistry.js`:

```javascript
'technical': {
  id: 'technical',
  label: 'Technical Difficulty',
  category: 'in-meet',
  keywords: ['technical', 'difficulty', 'pause', 'issue', 'problem'],
  gender: 'both',
  renderer: 'overlay',
  file: 'technical.html',
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

**Step 3: Deploy**

```bash
# Build frontend
cd show-controller && npm run build

# Deploy per CLAUDE.md
```

**Done!** The graphic automatically appears in URL Generator, Producer View, and Rundown Editor.

---

## Registry Schema Reference

Every graphic entry follows this schema:

```javascript
{
  // === IDENTITY ===
  id: 'graphic-id',              // Unique identifier (required)
  label: 'Display Name',         // Display name in UI (required)
  labelTemplate: '{teamName} Coaches',  // Optional: dynamic substitution
  category: 'in-meet',           // Category for grouping (required)
  keywords: ['search', 'terms'], // For smart recommendations

  // === CONSTRAINTS ===
  gender: 'both',                // 'mens' | 'womens' | 'both'
  minTeams: 1,                   // Optional: minimum teams required
  maxTeams: 6,                   // Optional: maximum teams supported

  // === RENDERING ===
  renderer: 'overlay',           // 'overlay' | 'output' (required)
  file: 'filename.html',         // File path or graphic name (required)
  transparent: true,             // For OBS background handling

  // === BEHAVIOR ===
  perTeam: false,                // If true, generates team1-, team2-, etc.

  // === PARAMETERS ===
  params: {                      // URL parameters the graphic accepts
    paramName: {
      type: 'string',            // string | number | enum | boolean
      source: 'competition',     // Auto-fill from competition config
      required: true,
      options: ['a', 'b'],       // For enum type
      optionLabels: { a: 'Option A', b: 'Option B' },
      default: 'a',
      min: 1,                    // For number type
      max: 6,
      dependsOn: { otherParam: 'value' },  // Conditional visibility
      label: 'Display Label',
      description: 'Help text',
    },
  },
}
```

### Categories

| Category | Description |
|----------|-------------|
| `pre-meet` | Shown before competition starts (logos, coaches, stats) |
| `in-meet` | Used during competition (replay, technical) |
| `event-frames` | Event title frames (floor, vault, etc.) |
| `frame-overlays` | Camera layout frames (quad view, tri center) |
| `leaderboards` | Score leaderboards by event |
| `event-summary` | Rotation/apparatus summaries |
| `stream` | Stream start/end screens |

### Parameter Types

| Type | UI Component | Example |
|------|--------------|---------|
| `string` | Text input (hidden if `source: 'competition'`) | Team logo URL |
| `number` | Number input with min/max | Rotation number |
| `enum` | Dropdown select | Theme selection |
| `boolean` | Checkbox | Show/hide option |

### Parameter Sources

| Source | Behavior |
|--------|----------|
| `competition` | Auto-filled from competition config, hidden from user |
| (none) | User must provide value |

---

## Making Your Graphic Searchable

The `keywords` array is critical for discoverability. Users can search for graphics in:
- URL Generator sidebar
- Rundown Editor graphic picker
- Graphics Manager search
- Smart recommendations (auto-suggests graphics based on segment names)

### Keyword Best Practices

```javascript
'technical': {
  id: 'technical',
  label: 'Technical Difficulty',
  keywords: [
    'technical',      // Primary term
    'difficulty',     // Part of the name
    'pause',          // Related action
    'issue',          // Synonym
    'problem',        // Synonym
    'delay',          // Related concept
    'stop',           // Related action
  ],
  // ...
},
```

### What to Include in Keywords

| Include | Examples |
|---------|----------|
| Words from the label | `'technical'`, `'difficulty'` |
| Synonyms | `'issue'`, `'problem'` for "difficulty" |
| Related actions | `'pause'`, `'stop'`, `'delay'` |
| Abbreviations | `'ph'` for "Pommel Horse", `'fx'` for "Floor" |
| Common misspellings | `'pommell'` for "pommel" (optional) |
| Category terms | `'pre-meet'`, `'in-meet'` |

### Smart Recommendations

Keywords also power smart recommendations in the Rundown Editor. When a user creates a segment named "UCLA Coaches Introduction", the system searches keywords to suggest the best matching graphic.

```javascript
// This graphic will be recommended for segments containing "coach" or "staff"
'team-coaches': {
  keywords: ['coach', 'coaches', 'staff', 'head coach', 'assistant'],
  // ...
},
```

### Search Examples

| User Searches | Matches Graphics With Keywords |
|---------------|-------------------------------|
| "replay" | `['replay', 'instant replay', 'review']` |
| "coach" | `['coach', 'coaches', 'staff']` |
| "floor" | `['floor', 'fx', 'floor exercise']` |
| "score" | `['scores', 'final', 'results', 'leaderboard']` |

---

## Graphic Types

### Type 1: Simple Overlay

**Use for:** Indicators, lower thirds, simple displays

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

---

### Type 2: Per-Team Graphic

**Use for:** Graphics that need one button per team (coaches, stats)

```javascript
'team-coaches': {
  id: 'team-coaches',
  label: 'Team Coaches',
  labelTemplate: '{teamName} Coaches',  // Becomes "UCLA Coaches"
  category: 'pre-meet',
  keywords: ['coach', 'coaches', 'staff'],
  gender: 'both',
  renderer: 'overlay',
  file: 'coaches.html',
  transparent: true,
  perTeam: true,  // Generates team1-coaches, team2-coaches, etc.
  params: {
    teamSlot: {
      type: 'number',
      min: 1,
      max: 6,
      required: true,
    },
    logo: {
      type: 'string',
      source: 'competition',
    },
    coaches: {
      type: 'string',
      source: 'competition',
    },
  },
},
```

**Result:** In a quad meet with UCLA, Oregon, Utah, Arizona:
- Button 1: "UCLA Coaches"
- Button 2: "Oregon Coaches"
- Button 3: "Utah Coaches"
- Button 4: "Arizona Coaches"

---

### Type 3: Gender-Specific Graphic

**Use for:** Apparatus-specific graphics (pommel horse = men only, uneven bars = women only)

```javascript
'pommel': {
  id: 'pommel',
  label: 'Pommel Horse',
  category: 'event-frames',
  keywords: ['pommel', 'horse', 'ph'],
  gender: 'mens',  // Only appears for men's competitions
  renderer: 'overlay',
  file: 'event-frame.html',
  transparent: true,
  params: {
    title: { type: 'string', default: 'POMMEL HORSE' },
    logo: { type: 'string', source: 'competition' },
  },
},

'ubars': {
  id: 'ubars',
  label: 'Uneven Bars',
  category: 'event-frames',
  keywords: ['uneven', 'bars', 'ub'],
  gender: 'womens',  // Only appears for women's competitions
  renderer: 'overlay',
  file: 'event-frame.html',
  transparent: true,
  params: {
    title: { type: 'string', default: 'UNEVEN BARS' },
    logo: { type: 'string', source: 'competition' },
  },
},
```

---

### Type 4: Complex Graphic with Parameters

**Use for:** Graphics with user-configurable options

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
      max: 6,
      label: 'Rotation',
      dependsOn: { summaryMode: 'rotation' },  // Only shown when mode=rotation
    },
    summaryApparatus: {
      type: 'enum',
      options: ['fx', 'ph', 'sr', 'vt', 'pb', 'hb', 'ub', 'bb'],
      label: 'Apparatus',
      dependsOn: { summaryMode: 'apparatus' },  // Only shown when mode=apparatus
    },
    summaryTheme: {
      type: 'enum',
      options: ['default', 'espn', 'nbc', 'btn', 'pac12'],
      default: 'default',
      label: 'Theme',
    },
  },
},
```

**Result UI:**
```
Graphic: [Event Summary ▼]

Mode:      [By Rotation ▼]
Rotation:  [1 ▼]           <- Only shows when mode=rotation
Theme:     [ESPN ▼]
```

---

### Type 5: Frame Overlay

**Use for:** Decorative frames around video feeds

```javascript
'frame-quad': {
  id: 'frame-quad',
  label: 'Quad View',
  category: 'frame-overlays',
  keywords: ['quad', 'four', '4'],
  gender: 'both',
  minTeams: 4,  // Only available for 4+ team competitions
  renderer: 'overlay',
  file: 'frame-quad.html',
  transparent: true,
  params: {
    team1Logo: { type: 'string', source: 'competition' },
    team2Logo: { type: 'string', source: 'competition' },
    team3Logo: { type: 'string', source: 'competition' },
    team4Logo: { type: 'string', source: 'competition' },
  },
},
```

---

## HTML Template

Standard template for overlay graphics:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <title>Graphic Title</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: transparent;  /* Required for OBS transparency */
    }

    /* Your styles here */
  </style>
</head>
<body>
  <!-- Your HTML here -->

  <script>
    const params = new URLSearchParams(window.location.search);

    // Read parameters
    const logo = params.get('team1Logo') || '';
    const title = params.get('title') || 'DEFAULT TITLE';

    // Update DOM
    document.getElementById('logo').src = logo;
    document.getElementById('title').textContent = title;
  </script>
</body>
</html>
```

---

## Common Patterns

### Animation: Slide In

```css
.element {
  animation: slideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-100px); }
  to { opacity: 1; transform: translateX(0); }
}
```

### Animation: Fade In

```css
.element {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Position: Lower Third

```css
.lower-third {
  position: absolute;
  bottom: 120px;
  left: 100px;
}
```

### Position: Top Corner

```css
.corner-bug {
  position: absolute;
  top: 60px;
  right: 60px;
}
```

### Reading Pipe-Separated Values

```javascript
const coaches = (params.get('coaches') || '').split('|').filter(Boolean);
// "Head Coach: John|Assistant: Jane" → ["Head Coach: John", "Assistant: Jane"]
```

---

## Testing

### Local Testing

```bash
# Start dev server
cd show-controller && npm run dev

# Open graphic directly
open "http://localhost:5173/overlays/technical.html?team1Logo=https://example.com/logo.png"
```

### Production Testing

1. Deploy to production
2. Open URL Generator at `https://commentarygraphic.com`
3. Select your graphic from the sidebar
4. Verify preview renders correctly
5. Copy URL and test in OBS browser source

---

## Checklist: Adding a New Graphic

- [ ] Create `overlays/newgraphic.html` with:
  - [ ] 1920x1080 viewport
  - [ ] `background: transparent` on body
  - [ ] URL parameter reading via `URLSearchParams`
  - [ ] Animation for entrance
- [ ] Add entry to `graphicsRegistry.js` with:
  - [ ] Unique `id`
  - [ ] Descriptive `label`
  - [ ] Correct `category`
  - [ ] **Helpful `keywords` for search** (include synonyms, abbreviations, related terms)
  - [ ] Appropriate `gender` constraint
  - [ ] `renderer: 'overlay'` or `'output'`
  - [ ] Correct `file` path
  - [ ] `transparent: true` if overlay
  - [ ] All `params` the graphic accepts
- [ ] Build: `cd show-controller && npm run build`
- [ ] Deploy per CLAUDE.md
- [ ] Verify graphic appears in URL Generator
- [ ] **Test search finds your graphic** (search for keywords)
- [ ] Test preview renders correctly
- [ ] Test in OBS browser source

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Graphic doesn't appear in pickers | Missing or malformed registry entry | Check `id` is unique, `category` is valid |
| Black background in OBS | Missing transparency | Add `background: transparent` to body CSS |
| Logo not showing | Parameter name mismatch | Ensure HTML reads same param name as registry defines |
| Parameters not showing in picker | Missing `params` in registry | Add full param schema with types |
| Wrong graphics for competition type | Missing `gender` constraint | Add `gender: 'mens'` or `gender: 'womens'` |
| Too many team buttons | Missing `maxTeams` | Add `maxTeams: 2` for dual-only graphics |

---

## File Locations

| File | Purpose |
|------|---------|
| `overlays/*.html` | Overlay graphic renderers |
| `output.html` | Complex graphic renderer (leaderboards, summaries) |
| `show-controller/src/lib/graphicsRegistry.js` | **Single source of truth for all graphics** |
