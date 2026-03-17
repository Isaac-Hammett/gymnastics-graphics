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

// Tri Wide Top: long box on top, two small boxes on bottom (flipped Tri Wide)
'frame-tri-wide-top': {
  id: 'frame-tri-wide-top',
  label: 'Tri Wide Top',
  category: 'frame-overlays',
  keywords: ['tri', 'three', '3', 'wide', 'top', 'frame', 'overlay'],
  gender: 'both',
  minTeams: 3,
  maxTeams: 7,
  renderer: 'overlay',
  file: 'frame-tri-wide-top.html',
  transparent: true,
  params: {
    // Dynamic: team1Logo through team3Logo
  },
},
```

**Frame overlay variants:**

| Graphic | Layout |
|---------|--------|
| `frame-quad` | 2x2 grid (4 equal panels) |
| `frame-tri-center` | Large center panel, two small side panels |
| `frame-tri-wide` | Two small panels on top, one long panel on bottom |
| `frame-tri-wide-top` | One long panel on top, two small panels on bottom |
| `frame-dual` | Two equal side-by-side panels |
| `frame-single` | One full-width panel |
| `frame-team-header` | Dual panels with team name headers |

---

### Type 6: Full-Screen Card with JSON Data

**Use for:** Graphics that display user-provided structured data (event calendars, schedules, lists)

**Example: Event Calendar** — Shows a list of upcoming events with dates, names, and locations. Modeled after the sponsors-thanks card layout (header bar + dark body + rounded border).

```javascript
'event-calendar': {
  id: 'event-calendar',
  label: 'Event Calendar',
  category: 'pre-meet',
  keywords: ['event', 'events', 'calendar', 'schedule', 'dates', 'upcoming', 'promo', 'future', 'season'],
  gender: 'both',
  renderer: 'overlay',
  file: 'event-calendar.html',
  transparent: false,
  params: {
    logo: { type: 'string', source: 'competition' },
    title: {
      type: 'string',
      default: 'Event Calendar',
      label: 'Header Title',
    },
    events: {
      type: 'string',
      label: 'Events (JSON)',
      description: 'JSON array: [{"date":"Mar 15","name":"vs UCLA","location":"Los Angeles, CA"}]',
      required: true,
    },
    columns: {
      type: 'enum',
      options: ['auto', '1', '2'],
      default: 'auto',
      label: 'Layout',
    },
  },
},
```

**Events data format:**
```json
[
  {"date": "March 6-8", "name": "HBCU Classic", "location": "Atlanta, GA"},
  {"date": "April 14", "name": "Isla Soirée", "location": "Studio Isla, Atlanta"},
  {"date": "April 15", "name": "HBCU Gymnastics Day"}
]
```

Each event has:
- `date` (required) — Date or date range, shown in purple accent
- `name` (required) — Event name, shown in bold white
- `location` (optional) — Location, shown in grey below the name

**Auto-scaling tiers:**

| Event Count | Font Size | Layout |
|-------------|-----------|--------|
| 1–3 | Large (44px name) | Single column |
| 4–5 | Medium (36px name) | Single column |
| 6–7 | Compact (28px name) | Single column |
| 7+ | Dense (24px name) | Two columns (auto) |

**URL Generator UI:**

The Event Calendar config panel provides two editing modes:

- **Visual editor** (default) — Per-event cards with Date, Name, and Location text inputs. Includes "+ Add Event" button, per-event remove (x) button, and up/down reorder arrows.
- **JSON mode** — Toggle "Edit as JSON" to switch to a raw JSON textarea for pasting bulk data. Both modes read/write the same `calendarEvents` field.

The calendar fields (`calendarTitle`, `calendarEvents`, `calendarColumns`) are saved to Firebase at `competitions/{compId}/config` and loaded back on page reload.

**Additional integration required for JSON-data graphics:**

Unlike simple overlay graphics, graphics that accept user-provided JSON data need additional wiring:

1. **URL builder case** — Add a `case` in `generateGraphicURL()` in `urlBuilder.js` to map `formData` keys to URL params
2. **Output.html renderer** — Add a renderer in the `renderers` object so the producer view can display it live
3. **Producer view handler** — Add data passthrough in `sendGraphic()` in `GraphicsControl.jsx` to read from competition config
4. **URL Generator config panel** — Add a form section in `UrlGeneratorPage.jsx` for editing the JSON data
5. **Config loader** — Ensure the fields are included in the `useEffect` that loads config from Firebase (the config loader in `UrlGeneratorPage.jsx` must explicitly map each field or they'll be lost on reload)

See the Event Calendar implementation for a complete example of all five integration points.

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

### Step 1: Create the overlay HTML
- [ ] Create `overlays/newgraphic.html` with:
  - [ ] 1920x1080 viewport
  - [ ] `background: transparent` on body
  - [ ] URL parameter reading via `URLSearchParams`
  - [ ] Animation for entrance
  - [ ] `<script src="theme-loader.js?v=2"></script>` if it should support meet themes

### Step 2: Add to the registry
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

### Step 3: Wire up URL generation (if graphic has custom/user-provided data)

Skip this step if all params are `source: 'competition'` or have `default` values — the registry fallback in `generateGraphicURL()` handles those automatically.

For graphics with user-provided data (JSON arrays, custom text, etc.):
- [ ] Add a `case` in `generateGraphicURL()` (`urlBuilder.js`) to build the URL from `formData`
- [ ] Add a renderer in the `renderers` object in `output.html` so the producer view can display it
- [ ] Add data passthrough in `sendGraphic()` (`GraphicsControl.jsx`) to read from competition config
- [ ] Add a config panel in `UrlGeneratorPage.jsx` for editing the data (shown when graphic is selected)
- [ ] Add `formData` defaults in `UrlGeneratorPage.jsx` for the new fields
- [ ] Add fields to the config loader `useEffect` in `UrlGeneratorPage.jsx` so saved values load from Firebase on page reload
- [ ] Add entry to `baseGraphicTitles` in `UrlGeneratorPage.jsx`

### Step 4: Build, deploy, verify
- [ ] Build: `cd show-controller && npm run build`
- [ ] Deploy per CLAUDE.md (SPA + overlays + output.html)
- [ ] Verify graphic appears in URL Generator sidebar
- [ ] **Test search finds your graphic** (search for keywords)
- [ ] Test preview renders correctly at 1920x1080
- [ ] Test in OBS browser source

---

### Type 7: Live-Polling Graphic (Auto-Updating)

**Use for:** Graphics that poll an external API and update in real-time without user interaction.

**Example: Rotation Slate (Auto)** — Polls the Virtius API every 45 seconds to detect the current rotation and displays it automatically. Shows "Final" when all rotations are complete, then stops polling to avoid unnecessary API calls.

```javascript
'rotation-slate-auto': {
  id: 'rotation-slate-auto',
  label: 'Rotation Slate (Auto)',
  category: 'in-meet',
  keywords: ['rotation', 'slate', 'auto', 'live', 'current'],
  gender: 'both',
  renderer: 'overlay',
  file: 'rotation-slate-auto.html',
  transparent: false,
  params: {
    compId: {
      type: 'string',
      source: 'competition',
      required: true,
    },
  },
},
```

**Key implementation details:**

| Concern | Approach |
|---------|----------|
| Data source | Virtius API: `https://api.virti.us/session/{virtiusSessionId}/json` |
| API response path | `data.meet.teams` (NOT `data.results.team_results`) |
| Config loading | Reads `competitions/{compId}/config` from Firebase for virtiusSessionId, gender, team count |
| Rotation detection | Standard meets: count fully-scored events per team. 5+ team meets: read `event.rotation` field from API. **IMPORTANT:** Virtius returns `""` (empty string) for unscored `final_score`, not `null` — must check both `!= null && !== ''` |
| Poll interval | 45 seconds (`state.pollInterval = 45000`) |
| Auto-stop | Stops polling once meet is final (`clearInterval` on `isFinal`) — avoids hammering Virtius after meet ends |
| Meet theme support | Accepts `meetTheme` URL param; theme-loader.js applies CSS variables |
| Meet logo override | MutationObserver watches for `data-meet-logo` attribute set by theme-loader |
| Layout variants | Accepts `layout` URL param (classic, centered, stacked, banner, etc.) — shares all 16 layouts with `rotation-slate.html` |

**Wiring checklist for live-polling graphics:**

1. Overlay HTML — Must load Firebase SDK to read competition config, then poll external API. Include all layout CSS if the graphic supports layout variants.
2. Registry entry — Standard entry with `compId` param
3. URL builder case — Build overlay URL with `compId`, `layout`, and optional `meetTheme`
4. `output.html` renderer — Iframe pointing to the overlay with `compId` and `layout` params
5. `GraphicsControl.jsx` — Dedicated send function that pushes `compId` and `layout` via Firebase `currentGraphic`
6. `UrlGeneratorPage.jsx` — Button in the rotation slate section (layout selector is shared with the manual slate)

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
| Auto slate shows "-" forever | Wrong API response path | Virtius API returns `data.meet.teams`, NOT `data.results.team_results` |
| Auto graphic not rendering in producer view | Missing renderer in `output.html` | Add an iframe renderer in the `renderers` object in `output.html` |
| Auto graphic button missing from producer panel | Not wired in `GraphicsControl.jsx` | Add a send function and button in the In-Meet section |

---

## File Locations

| File | Purpose |
|------|---------|
| `overlays/*.html` | Overlay graphic renderers |
| `output.html` | Complex graphic renderer (leaderboards, summaries) + live producer renderers |
| `show-controller/src/lib/graphicsRegistry.js` | **Single source of truth for all graphics** |
| `show-controller/src/lib/urlBuilder.js` | URL generation for all graphics (dedicated builders + registry fallback) |
| `show-controller/src/components/GraphicsControl.jsx` | Producer view — sends graphics via Firebase |
| `show-controller/src/pages/UrlGeneratorPage.jsx` | URL Generator — sidebar, preview, config panels |
| `show-controller/src/lib/graphicButtons.js` | Derives button lists from registry (auto-updates) |

---

## Event Summary Layout Reference (V20/V21/V22/V23)

The V20, V21, V22, and V23 layouts are enhanced event summary layouts with additional features:

### Features
- **Start Values (SV)** - Displays difficulty score with 2 decimal places
- **Meet-Wide Apparatus Rankings** - Gold/silver/bronze indicators for athletes with top 3 scores on their apparatus across the ENTIRE meet (not just current rotation) - V20/V21/V22 only
- **Team Ranking Badges** - Shows team standings in header (all versions)

### V20 vs V21 vs V22 vs V23 Comparison

| Feature | V20 | V21 | V22 | V23 |
|---------|-----|-----|-----|-----|
| Font Size | Large | Extra Large | Extra Large | Extra Large |
| Ranking Display | Separate badge | Separate badge | Integrated in order bubble | None |
| Order Bubble | Grey | Grey | Gold/Silver/Bronze for ranked | Grey (always) |
| Medal Icons | No | No | Yes (🥇🥈🥉) | No |
| Team Rank Badge | Yes | Yes | Yes | Yes |

### Font Size Reference

| Element | V20 | V21/V22/V23 |
|---------|-----|-------------|
| Team name | 24px | 30px |
| Event name | 16px | 20px |
| Header total | 28px | 36px |
| Athlete order | 18px | 20px |
| Athlete name | 22px | 28px |
| Start value | 18px | 22px |
| Athlete score | 26px | 34px |
| Footer label | 18px | 22px |
| Footer total | 32px | 40px |
| Team logo | 50px | 60px |

### V22 Integrated Ranking Feature

V22 integrates the apparatus ranking directly into the lineup order bubble:

| Ranking | Bubble Background | Icon | Shadow |
|---------|------------------|------|--------|
| 1st Place | Gold gradient (#fbbf24 → #ca8a04) | 🥇 | Gold glow |
| 2nd Place | Silver gradient (#94a3b8 → #64748b) | 🥈 | Silver glow |
| 3rd Place | Bronze gradient (#f59e0b → #b45309) | 🥉 | Bronze glow |
| No Ranking | Solid grey (#52525b) | None | None |

### V23 No Rankings Feature

V23 is identical to V22 but **removes** all athlete apparatus ranking indicators:
- Order bubbles are always grey (#52525b)
- No medal icons in bubbles
- No ranking colors on athlete rows
- Team rank badge in header is still shown (1st/2nd/3rd place team standings)

Use V23 when you want the extra large fonts without the individual athlete ranking visual clutter.

### Key Functions (output.html)
- `calculateApparatusRankings(teams)` - Computes top 3 scores per apparatus across all teams
- `renderMultiTeamSummaryV20/V21/V22/V23()` - Renders rotation view
- `renderMultiTeamSummaryApparatusV20/V21/V22/V23()` - Renders apparatus view

---

## Dual Dynamic Layout Reference (V1/V2)

The Dual Dynamic layouts are designed specifically for **dual meets (2 teams)** and dynamically scale elements based on athlete count (1-9 athletes).

### Features
- **Dynamic Sizing** - Photos, fonts, and padding scale down automatically when athlete count exceeds 6
- **Start Values (SV)** - D-scores displayed alongside final scores
- **Anchor Highlighting** - 6th athlete (anchor position) gets gold order bubble
- **Center Diff Bars** - Visual score difference bars between matched athletes
- **Self-contained Title Bar** - "Event Summary" header is inside the layout (no external header)

### V1 vs V2 Comparison

| Feature | V1 | V2 |
|---------|----|----|
| Number alignment | Score/SV can misalign | Fixed-width score (`min-width: 130px`) and SV (`min-width: 60px`) columns |
| Footer clipping | Footer clips with 7+ athletes | Fixed — layout has `min-height: 0` to allow flex shrinking |
| Layout class | `.layout-dual-dynamic-v1` | `.layout-dual-dynamic-v2` |

### Dynamic Sizing Scale Factor

```
athletes <= 6: scale = 1.0 (full size)
athletes = 7:  scale = 0.88
athletes = 8:  scale = 0.76
athletes = 9:  scale = 0.65 (minimum)
```

### Critical CSS: `min-height: 0` on Nested Flex Containers

The V2 layout fixes a footer clipping bug caused by nested flex containers. **Root cause:** Without `min-height: 0` on the layout wrapper, CSS flex defaults `min-height` to `auto`, which resolves to the natural content height. This prevents the flex algorithm from shrinking the layout to make room for the footer, causing `overflow: hidden` on the parent to clip the bottom.

**Rule:** Any flex item that is ALSO a flex container and needs to shrink below its content size MUST have `min-height: 0`. This applies at every level of nesting.

### Key Functions (output.html)
- `getDynamicSizes(athleteCount)` - Returns scaled sizes for photos, fonts, padding
- `renderDualDynamicV1Layout()` / `renderDualDynamicV2Layout()` - Renders rotation view
- `renderDualDynamicV1LayoutApparatus()` / `renderDualDynamicV2LayoutApparatus()` - Renders apparatus view
- `buildDualDynamicV1Column()` / `buildDualDynamicV2Column()` - Builds a single team column

---

## Sponsor Logo Manual Overrides

The sponsor overlays (`sponsors-cycle.html`, `sponsors-thanks.html`) use canvas-based auto-trimming to normalize logo sizes. For logos that still need fine-tuning, per-sponsor manual overrides are available.

### Override Fields

Each sponsor object in `themes/{themeId}/sponsors[]` supports these optional fields alongside `name` and `url`:

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `scale` | number | 50–200 | 100 | Scale percentage applied on top of auto-trim sizing |
| `offsetX` | number | -200–200 | 0 | Horizontal pixel offset from center |
| `offsetY` | number | -200–200 | 0 | Vertical pixel offset from center |

### Data Flow

Overrides can be set in two places:

1. **Theme Editor** (`ThemeEditorPage.jsx`) — Sliders below each sponsor's URL field set `scale`, `offsetX`, `offsetY`. These are **persistent** — saved to Firebase with the theme.
2. **URL Generator** (`UrlGeneratorPage.jsx`) — A "Sponsor Logo Adjustments" panel appears when any sponsor graphic is selected. Sliders here are **session-level** — they override the theme defaults for the current session and update the preview live, but are not saved back to Firebase.

The full flow:

1. **Firebase** — Theme stores sponsor objects: `{ name, url, scale?, offsetX?, offsetY? }`
2. **URL Generator** — Loads theme sponsors, initializes local overrides from theme data, merges any session-level slider changes on top
3. **URL serialization** — Merges session overrides with theme defaults, omits default values (100% scale, 0px offsets) to keep URLs compact
4. **Overlays** — Read from URL param and apply:
   - `sponsors-cycle.html`: Adjusts canvas element `width`/`height` for scale, `transform: translate()` for offset
   - `sponsors-thanks.html`: Applies `transform: scale() translate()` on the `.sponsor-item` container

### Example Sponsor Object

```json
{
  "name": "BACA Gymnastics",
  "url": "https://example.com/baca-logo.png",
  "scale": 120,
  "offsetX": -15,
  "offsetY": 10
}
```
