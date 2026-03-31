# Execution Knowledge

{Discovered by iterations. Not specs — execution gotchas, timing, dependencies, patterns.}
{Each iteration appends here when it learns something non-obvious.}
{Never put task status here (that's plan.md) or specs (that's the PRD).}

## Initial Analysis Findings

### Firebase SDK & Config

- **Version: 9.22.0 compat mode** — use `-compat.js` CDN URLs, NOT modular imports
- CDN URLs:
  ```html
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>
  ```
- Firebase config object (copy exactly from output.html lines 7797-7804):
  ```javascript
  const firebaseConfig = {
    apiKey: "AIzaSyCh0aZUvKl6Qvqsva3hvOgJJlleP1OwcTY",
    authDomain: "gymnastics-graphics.firebaseapp.com",
    databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
    projectId: "gymnastics-graphics",
    storageBucket: "gymnastics-graphics.firebasestorage.app",
    messagingSenderId: "702072609550",
    appId: "1:702072609550:web:ac74a811186d3ff45b955f"
  };
  ```
- Compat API: `firebase.initializeApp(config)`, `firebase.database()`, `.ref().on('value', cb)`, `.ref().set()`, `.ref().once('value')`

### Google Fonts Link Tag

Copy exactly from output.html line 9:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

### Module Pattern

- output.html does NOT use an IIFE — code runs directly in global scope inside a `<script>` block
- stage.html should follow the same pattern: inline `<script>` in the HTML body, global scope variables
- Blocks use window globals: `window.BlockHeaderBar = { render, destroy, ready, sampleData }`
- Block lookup: `window['Block' + pascalCase(blockType)]`
- **pascalCase conversion must handle both hyphens and underscores:** `_sample-block` → strip leading underscore → `sample-block` → `SampleBlock`

### Block JS Loading

- Use `<script>` tag injection (not `fetch()` + `eval()`) for block JS files — this matches how theme-loader.js is loaded
- Each `<script>` tag loads from relative path `blocks/{type}.js`
- Wait for `onload` event before looking up `window['Block' + pascalCase(type)]`
- If the global doesn't exist after load → treat as load error
- Block CSS can use `<link>` tags or `<style>` with fetched content — `<link>` is simpler

### OBS Compatibility

- `body { background: transparent; }` is critical — OBS composites transparent areas
- `transform-origin: top left;` ensures OBS scaling aligns correctly
- `<meta name="viewport" content="width=1920, height=1080">` required
- `overflow: hidden` on body prevents scrollbars

### Skeleton Fetch Pattern

- Use `fetch()` for skeleton HTML and CSS (they're text content, not scripts)
- Relative paths: `fetch('skeletons/full-screen-card.html')`
- CSS: inject as `<style data-skeleton="name">` (not `<link>`) so cleanup is easy — just remove the element
- HTML: inject via `.innerHTML` into `#skeleton-mount`

### theme-overrides.css Image URL Convention

- Image URLs stored **raw** in CSS variables (no `url()` wrapping)
- Block CSS wraps them: `background-image: url(var(--meet-header-bg-image));`
- This matches the existing pattern in theme-overrides.css

### GraphicsControl.jsx — 7 Set Call Sites

When adding the `renderer` field (Task 11), there are 7 distinct `set()` calls to `currentGraphic`:
1. Line 308: `sendCustomGraphic` — hardcode `renderer: 'output'`
2. Line 467: `sendGraphic` — compute from registry
3. Line 487: `sendRotationSlate` — hardcode `renderer: 'output'`
4. Line 499: `sendAutoRotationSlate` — hardcode `renderer: 'output'`
5. Line 558: `sendEventSummary` — hardcode `renderer: 'output'`
6. Line 569: `clearGraphic` — NO renderer field (both engines clear on `graphic: 'clear'`)
7. Line 591: `sendNowCompeting` — hardcode `renderer: 'output'`

### output.html Renderer Check Location

The currentGraphic listener starts at line 14016. The renderer check should go right after `const state = snapshot.val();` and the null check, before the existing `themeReadyPromise` logic. The exact insertion point is after the null-check block (around line 14052) and before the `const { graphic, data } = state;` destructuring.

### Error Reporting Path

Stage engine errors go to `competitions/{compId}/production/stageErrors/{timestamp}` (NOT `rendererErrors` — the PRD uses `stageErrors`). Format:
```json
{
  "type": "block_load_error",
  "graphic": "graphic-id",
  "block": "block-name",
  "message": "error description",
  "url": "current page URL",
  "timestamp": "ISO string"
}
```

### Preview Mode — No Firebase Required

Preview mode (`?preview=`) must work without `?comp=` and without Firebase. The only exception: `&theme={themeId}` fetches theme data from Firebase `themes/{themeId}`. All other preview features use local sample data only.

### Deploy — Permission Fix

macOS SCP creates files with 600 permissions. nginx gets 403 Forbidden. Always run:
```bash
find stage -type f -exec chmod 644 {} +
```
after extracting the tarball on the server.

### Deploy — Nginx Config Location

Must inspect the production server to find the nginx config file. Likely at `/etc/nginx/sites-available/commentarygraphic` or `/etc/nginx/conf.d/`. The location block for `/stage/` must be added alongside existing rules for output.html and overlays/.
