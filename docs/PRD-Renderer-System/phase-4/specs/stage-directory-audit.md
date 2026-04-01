# Stage Directory Audit

## What

Inventory of existing files in `stage/` directory from Phases 1-3. Identifies what exists and what Phase 4 needs to create.

## Current State

**Directory:** `/Users/juliacosmiano/code/gymnastics-graphics/stage/`

### Directory Structure

```
stage/
├── stage.html (816 lines)
├── blocks/
│   ├── _sample-block.js (16 lines)
│   ├── _sample-block.css (4 lines)
│   ├── header-bar.js (31 lines)
│   ├── header-bar.css (41 lines)
│   ├── leaderboard-table.js (172 lines)
│   ├── leaderboard-table.css (174 lines)
│   ├── athlete-grid.js (253 lines)
│   └── athlete-grid.css (175 lines)
└── skeletons/
    ├── full-screen-card.html (4 lines)
    └── full-screen-card.css
```

### Existing Skeletons (1)

| Skeleton | Files | Purpose |
|----------|-------|---------|
| `full-screen-card` | `.html` + `.css` | Generic container for full-screen graphics |

**Skeleton HTML structure:**
```html
<div class="skeleton-full-screen-card">
  <div class="skeleton-content"></div>
</div>
```

### Existing Blocks (3 + 1 template)

| Block | JS Lines | CSS Lines | Purpose |
|-------|----------|-----------|---------|
| `header-bar` | 31 | 41 | Title + logo display |
| `leaderboard-table` | 172 | 174 | Scoring leaderboard with rank/name/team/apparatus/score |
| `athlete-grid` | 253 | 175 | Team roster grid with headshots |
| `_sample-block` | 16 | 4 | Template for new blocks |

### Block Interface Standard

All blocks export `window.Block{PascalCase}` with:
- `themeVars[]` — CSS variables the block responds to
- `sampleData{}` — Default data for preview mode
- `render(container, data, context)` — Render function
- `ready()` — Promise for animation timing
- `destroy()` — Optional cleanup

### stage.html Capabilities (816 lines)

- **Skeleton loader**: Loads `skeletons/{name}.html` + `.css`
- **Block loader**: Loads `blocks/{type}.js` + `.css`
- **Theme application**: Maps theme colors to CSS variables
- **Layout engine**: Nested flex layouts from spec
- **Animation engine**: 12 animation types (slide, fade, scale)
- **Firebase integration**: Live mode + standalone mode
- **Preview modes**: Preview skeletons, blocks, or full graphics
- **Error reporting**: Writes to `production/stageErrors/`

### What Does NOT Exist

| Item | Location | Purpose |
|------|----------|---------|
| `stage/graphics/` directory | — | Manifest files |
| `categories.json` | — | Category definitions |
| Per-graphic manifests | — | `{graphic-name}.json` spec files |
| Legacy manifests | — | `legacy/{graphic-name}.json` for overlay/output graphics |

## Target State

After Phase 4:

```
stage/
├── stage.html
├── blocks/
│   └── (existing blocks)
├── skeletons/
│   └── (existing skeletons)
└── graphics/                    # NEW
    ├── categories.json          # Category definitions
    ├── leaderboard-vt.json      # Stage engine manifest
    ├── leaderboard-fx.json
    ├── team-roster.json
    └── legacy/                  # Overlay/output manifests
        ├── event-bar.json
        ├── warm-up.json
        ├── logos.json
        └── ...
```

### Manifest File Structure (Stage Engine)

```json
{
  "id": "leaderboard-vt",
  "label": "Vault",
  "category": "full-screen-cards",
  "subcategory": "leaderboards",
  "renderer": "stage",
  "skeleton": "full-screen-card",
  "blocks": ["header-bar", "leaderboard-table"],
  "gender": "both",
  "transparent": false,
  "keywords": ["vault", "vt", "leaderboard", "scores"],
  "params": {
    "apparatus": { "type": "string", "default": "VT" }
  },
  "defaultData": {
    "blocks": [
      { "type": "header-bar", "data": { "title": "VAULT" } },
      { "type": "leaderboard-table", "data": { "source": "scoring/leaderboard/VT" } }
    ]
  }
}
```

### Manifest File Structure (Legacy)

```json
{
  "id": "event-bar",
  "label": "Event Info",
  "category": "lower-thirds",
  "renderer": "overlay",
  "file": "event-bar.html",
  "transparent": true,
  "keywords": ["event", "info", "bar", "venue"],
  "params": {
    "team1Logo": { "type": "string", "source": "competition" },
    "venue": { "type": "string", "source": "competition" }
  }
}
```

## Risks

1. **Manual block `themeVars` must match CSS** — Phase 4 build script will validate
2. **No existing manifests** — all must be created from scratch
3. **Legacy manifest count** — 30 overlay files + ~25 output graphics = 55+ manifests

## Open Questions

1. Should manifests be `.json` or `.js` (for dynamic defaults)?
2. Should block `themeVars` be moved to manifests or kept in block JS?
3. How to handle graphics that don't have a clear category (edge cases)?
