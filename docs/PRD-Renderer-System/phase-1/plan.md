# Renderer System (Phase 1: Foundation) — Tasks

## Tasks

### Task 1: stage.html Shell + Skeleton System + Full-Screen-Card — COMPLETE
**Files:**
- `stage/stage.html` (create)
- `stage/skeletons/full-screen-card.html` (create)
- `stage/skeletons/full-screen-card.css` (create)
- `stage/blocks/` (create directory)

**Description:** Create the `stage/` directory tree, the stage.html shell, the skeleton loader, and the first skeleton.

**stage.html must include:**
- Firebase SDK 9.22.0 compat (`firebase-app-compat.js` + `firebase-database-compat.js`)
- Google Fonts (Inter, Inter Tight, Roboto Mono, JetBrains Mono, Poppins — same link tag as output.html)
- `<meta name="viewport" content="width=1920, height=1080">`
- Base CSS reset: `* { margin: 0; padding: 0; box-sizing: border-box; }`
- Body: `width: 1920px; height: 1080px; overflow: hidden; background: transparent; font-family: 'Inter', sans-serif; transform-origin: top left;`
- `<div id="canvas">` (1920x1080, position: relative) containing `<div id="skeleton-mount">`
- Firebase config initialization (same config object as output.html — see agent.md)
- URL param parsing: `comp`, `preview`, `skeleton`, `block`, `theme`, `graphic`
- **No** `theme-loader.js` include. **No** `theme-overrides.css` include.

**Skeleton loader (`loadSkeleton(name)`):**
1. Fetches `skeletons/{name}.html` and `skeletons/{name}.css` via `fetch()`
2. Injects CSS into `<style data-skeleton="{name}">` in `<head>`
3. Injects HTML into `#skeleton-mount`
4. Validates that injected HTML contains `.skeleton-content`
5. Cleanup: `clearSkeleton()` removes the `<style>` tag and clears `#skeleton-mount` innerHTML
6. Error handling: 404 → log error, render nothing

**full-screen-card skeleton:** Matches team-roster.html's `.card-container` dimensions.

`full-screen-card.html`:
```html
<div class="skeleton-full-screen-card">
  <div class="skeleton-content"></div>
</div>
```

`full-screen-card.css`:
```css
.skeleton-full-screen-card {
  position: absolute;
  top: var(--full-screen-card-top, 50px);
  left: var(--full-screen-card-left, 70px);
  right: var(--full-screen-card-right, 70px);
  bottom: var(--full-screen-card-bottom, 50px);
  display: flex;
  flex-direction: column;
  border-radius: var(--full-screen-card-radius, 12px);
  overflow: hidden;
  box-shadow: var(--full-screen-card-shadow, 0 8px 32px rgba(0,0,0,0.3));
  background: var(--full-screen-card-bg, transparent);
}

.skeleton-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
```

**Temporary verification hook:** At the bottom of stage.html, add a temporary block that loads the skeleton on page load if `?preview=skeleton` is in the URL. This lets us verify the skeleton visually before preview mode is fully built. (Will be replaced by proper preview mode in Task 5.)

**Verify:**
- [ ] `stage/stage.html?preview=skeleton&skeleton=full-screen-card` loads in Playwright (use `file:///` URL)
- [ ] Screenshot shows card frame: rounded corners, shadow, positioned with 50px/70px margins from edges
- [ ] `.skeleton-content` div exists inside the card (check Playwright snapshot)
- [ ] No console errors

---

### Task 2: Block Loader + Sample Block + Theme Application — COMPLETE
**Files:**
- `stage/stage.html` (modify — add block loader, theme application)
- `stage/blocks/_sample-block.js` (create)
- `stage/blocks/_sample-block.css` (create)

**Description:** Build the block loading system, the theme application function, and a test block to verify both.

**Block loader (`loadBlocks(blockSpecs, context)`):**
1. Fetches CSS and JS for each block in parallel
2. Each block's CSS → `<style data-block="{type}">` in `<head>`
3. Each block's JS → `<script>` tag injection, waits for `onload`
4. After load, looks up `window['Block' + pascalCase(type)]`
   - pascalCase: strip leading `_`, split on `-`, capitalize each part. `_sample-block` → `SampleBlock`, `header-bar` → `HeaderBar`
5. Creates `<div class="block-{type}">` wrapper with `opacity: 0; pointer-events: none;`
6. Calls `block.render(wrapper, data, context)` where context = `{ comp, theme, db, compConfig }`
7. After all blocks rendered, calls `waitForReady(blocks, 1000)` — Promise.race of all `block.ready()` vs 1-second timeout
8. On any block load failure (JS 404, CSS 404, parse error): entire graphic fails, writes error to `competitions/{compId}/production/stageErrors/{timestamp}` (if compId exists), clears skeleton mount, logs to console
9. Cleanup: `destroyBlocks()` calls `block.destroy()` on each active block, removes `<style>` tags, clears `.skeleton-content`

**Theme application (`applyTheme(skeletonElement, theme)`):**
- If no `theme` object, return (blocks use CSS fallback defaults)
- Set CSS variables on the **skeleton container element** (NOT `:root`):

Color mapping:
```
headerBg → --meet-header-bg       contentBg → --meet-content-bg
headerText → --meet-header-text    overlayBg → --meet-overlay-bg
overlayText → --meet-overlay-text  borderColor → --meet-border-color
badgeBg → --meet-badge-bg          badgeText → --meet-badge-text
```

Image mapping:
```
headerBgImage → --meet-header-bg-image               headerBgImageFit → --meet-header-bg-image-fit
headerBgImagePosition → --meet-header-bg-image-position  headerBgImageOpacity → --meet-header-bg-image-opacity
bodyBgImage → --meet-body-bg-image                    bodyTexture → --meet-body-texture
bodyTextureOpacity → --meet-body-texture-opacity      bodyTextureBlend → --meet-body-texture-blend
logo → --meet-logo-url                                logoSize → --meet-logo-size
```

- Cleanup is automatic — variables removed when skeleton DOM element is removed

**Sample block (`_sample-block`):**

`_sample-block.js`:
```javascript
window.BlockSampleBlock = {
  themeVars: ['--meet-overlay-bg', '--meet-overlay-text', '--meet-border-color'],
  sampleData: {
    title: "Sample Block",
    items: ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"]
  },
  render(container, data) {
    container.innerHTML = `
      <div class="sample-title">${data.title}</div>
      <ul class="sample-list">
        ${data.items.map(item => `<li>${item}</li>`).join('')}
      </ul>
    `;
  },
  ready() { return Promise.resolve(); }
};
```

`_sample-block.css` — uses `--meet-*` CSS variables with fallbacks:
```css
.block-_sample-block { padding: 40px; background: var(--meet-overlay-bg, #18181b); flex: 1; }
.block-_sample-block .sample-title { font-size: 32px; font-weight: 700; color: var(--meet-overlay-text, #fff); margin-bottom: 20px; }
.block-_sample-block .sample-list { list-style: none; color: var(--meet-overlay-text, #d4d4d8); font-size: 24px; }
.block-_sample-block .sample-list li { padding: 12px 0; border-bottom: 1px solid var(--meet-border-color, #3f3f46); }
```

**Temporary verification hook:** Extend the Task 1 temp hook so `?preview=full&skeleton=full-screen-card&block=_sample-block` loads skeleton + block with sample data.

**Verify:**
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=_sample-block` → card frame with "Sample Block" title and 5 list items on dark (#18181b) background
- [ ] Block text is white, list items have gray border-bottom dividers
- [ ] No console errors
- [ ] Block load failure test: `?preview=full&skeleton=full-screen-card&block=nonexistent` → blank page, error logged to console

---

### Task 3: Layout Engine — COMPLETE
**Files:**
- `stage/stage.html` (modify — add layout engine)

**Description:** Build the layout system that arranges blocks within `.skeleton-content`.

**Default (no `layout` in spec):** Blocks render as direct children of `.skeleton-content` in array order. Each block wrapper is a direct flex child.

**With `layout`:** `buildLayout(layoutSpec, blocksById)` creates a nested flex DOM structure:
- `layout.type === 'rows'` → iterate `layout.rows`
- Each row: `<div class="layout-row">` with blocks placed inside
- Row with `type: 'columns'` → `<div class="layout-row layout-columns">` containing `<div class="layout-column" style="width: {pct}">` divs
- Recursive: columns can contain rows, rows can contain columns
- Blocks referenced by `id` field in the `blocks` array

Layout CSS (in stage.html inline styles):
```css
.layout-row { display: flex; flex-direction: column; }
.layout-columns { display: flex; flex-direction: row; flex: 1; min-height: 0; }
.layout-column { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
```

**Update temp verification hook:** Support `&block=_sample-block,_sample-block&layout=columns` → renders two blocks side-by-side.

**Verify:**
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=_sample-block,_sample-block&layout=columns` → two columns, each showing "Sample Block" with list items
- [ ] Columns are equal width (50/50)
- [ ] Both blocks fill the card height
- [ ] No console errors

---

### Task 4: Animation Engine + Preview Mode — COMPLETE
**Files:**
- `stage/stage.html` (modify — add animation engine + replace temp verification hooks with proper preview mode)

**Description:** Build the animation engine and the full preview system. Remove any temporary verification hooks from earlier tasks.

**Animation engine:**

1. `generateKeyframes(type)` returns from/to CSS transform+opacity for each type:
   - Enter: `slide-up`, `slide-down`, `slide-left`, `slide-right`, `fade-in`, `scale-in`
   - Exit: `fade-out`, `scale-out`, `slide-out-up`, `slide-out-down`, `slide-out-left`, `slide-out-right`

2. `playEnterAnimation(blockEl, config)`:
   - Generate unique `@keyframes` name, inject into `<style>` tag
   - Apply animation CSS to block element
   - Remove `opacity: 0` and `pointer-events: none`
   - Default config: `{ type: 'fade-in', duration: 300, delay: 0, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }`

3. `playExitAnimation(blockEl, config)`:
   - Returns a Promise that resolves on `animationend`
   - Default config: `{ type: 'fade-out', duration: 200 }`

4. `playEnterAnimations(blocks)` / `playExitAnimations(blocks)`: batch versions

**Preview mode (replaces temp hooks):**

URL param detection at page load (runs instead of Firebase listener):
- `?preview=skeleton&skeleton={name}` → skeleton only with placeholder content
- `?preview=block&block={name}` → block only with `sampleData`, no skeleton
- `?preview=full&skeleton={name}&block={name}` → full assembly with sample data
- `&theme={themeId}` → fetch theme from Firebase `themes/{themeId}` and apply
- `&block=a,b` → multiple blocks (comma-separated)
- `&layout=columns` → columns layout for multi-block preview

Placeholder content for skeleton preview:
```html
<div style="background: #d4d4d8; padding: 18px 40px; display: flex; align-items: center;">
  <span style="font-size: 42px; font-weight: 800;">HEADER PLACEHOLDER</span>
</div>
<div style="flex: 1; background: #18181b; display: flex; align-items: center; justify-content: center;">
  <span style="color: #71717a; font-size: 24px;">Content area — blocks render here</span>
</div>
```

**Play/Dismiss buttons** (floating UI, preview mode only):
- "Play": hides all blocks, re-triggers enter animations
- "Dismiss": triggers exit animations
- Small floating toolbar at bottom-right, semi-transparent

**Verify:**
- [ ] `stage.html?preview=skeleton&skeleton=full-screen-card` → card frame with gray header placeholder and dark content placeholder
- [ ] `stage.html?preview=block&block=_sample-block` → sample block rendered directly (no card frame)
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=_sample-block` → card frame with sample block inside
- [ ] `stage.html?preview=full&skeleton=full-screen-card&block=_sample-block,_sample-block&layout=columns` → two columns
- [ ] Play button triggers enter animation (blocks fade/slide in)
- [ ] Dismiss button triggers exit animation (blocks fade out)
- [ ] No console errors in any preview mode

---

### Task 5: Firebase Listener + Stage Routing — COMPLETE
**Files:**
- `stage/stage.html` (modify — add Firebase listener and renderGraphic/dismissCurrentGraphic orchestration)

**Description:** Wire stage.html to listen to `currentGraphic` and route graphics.

**Firebase listener (only when `?comp=` is present and `?preview=` is NOT):**
```javascript
db.ref(`competitions/${compId}/currentGraphic`).on('value', async (snapshot) => {
  const val = snapshot.val();
  if (!val || val.renderer !== 'stage') {
    await dismissCurrentGraphic();
    return;
  }
  await dismissCurrentGraphic();
  await renderGraphic(val.graphic, val.data);
});
```

**`renderGraphic(graphic, data)` orchestration:**
1. Load skeleton from `data.skeleton`
2. Apply theme: `applyTheme(skeletonElement, data.theme)`
3. Build layout if `data.layout` present
4. Load and render blocks from `data.blocks`
5. Wait for ready (max 1 second)
6. Play enter animations

**`dismissCurrentGraphic()` orchestration:**
1. If nothing showing, return immediately
2. Play exit animations on all blocks
3. Call `destroy()` on each block
4. Clear skeleton mount + remove style tags

**Standalone mode:** If `?graphic=` URL param exists (no `?preview=`), render that graphic immediately. Theme comes from `?comp=` competition config lookup via Firebase.

**Backwards compat:** `graphic: 'clear'` has no `renderer` field → `val.renderer !== 'stage'` → dismisses correctly.

**Verify:**
- [ ] Preview modes still work (no regression from wiring Firebase)
- [ ] With `?comp=` param and no preview, page connects to Firebase (check console for Firebase init log)
- [ ] No console errors

---

### Task 6: Integration — output.html Renderer Check + GraphicsControl Renderer Field — COMPLETE
**Files:**
- `output.html` (modify — add `renderer === 'stage'` check in currentGraphic listener)
- `show-controller/src/components/GraphicsControl.jsx` (modify — add `renderer` field to all `set()` calls)
- `show-controller/src/lib/graphicsRegistry.js` (modify — verify/add `renderer` field to existing entries)

**Description:**

**output.html change** (minimal — ~10 lines): In the `currentGraphic` listener (around line 14016), after reading `state` and the null check, add:
```javascript
const { graphic, data, renderer } = state;
if (renderer === 'stage') {
  output.innerHTML = '';
  hideAnimatedBackground();
  if (lastLiveGraphicId && window.themeClearOverrides) {
    window.themeClearOverrides(lastLiveGraphicId);
    lastLiveGraphicId = null;
  }
  return;
}
```

**GraphicsControl.jsx changes**: Add `renderer` field to all 7 `set()` call sites:
1. `sendCustomGraphic` (line ~308) → `renderer: 'output'`
2. `sendGraphic` (line ~467) → computed: `const firebaseRenderer = entry && entry.renderer === 'stage' ? 'stage' : 'output';`
3. `sendRotationSlate` (line ~487) → `renderer: 'output'`
4. `sendAutoRotationSlate` (line ~499) → `renderer: 'output'`
5. `sendEventSummary` (line ~558) → `renderer: 'output'`
6. `clearGraphic` (line ~569) → **no** `renderer` field (both engines clear on `graphic: 'clear'`)
7. `sendNowCompeting` (line ~591) → `renderer: 'output'`

**graphicsRegistry.js**: Ensure all existing entries have `renderer: 'output'` or `renderer: 'overlay'`. No entries should have `renderer: 'stage'` yet (Phase 4 migrates graphics).

**Verify:**
- [ ] React SPA builds successfully: `cd show-controller && npm run build`
- [ ] output.html has the renderer check (grep for `renderer === 'stage'`)
- [ ] GraphicsControl.jsx includes `renderer` in all `set()` calls (grep for `renderer:`)
- [ ] No console errors on production site after deploy

---

### Task 7: Deploy to Production + Nginx Configuration — NOT STARTED
**Files:**
- Production server: `/var/www/commentarygraphic/stage/` (deploy)
- Production server: nginx config (modify — add `/stage/` location block)
- `output.html` (deploy updated version)
- `show-controller/dist/` (deploy updated React build)
- `overlays/` (deploy — standard deploy step, do not skip)

**Description:**

**Step 1: Build React SPA**
```bash
cd show-controller && npm run build
```

**Step 2: Deploy stage directory**
```bash
tar -czf /tmp/claude/stage.tar.gz stage/
# ssh_upload_file → ssh_exec to extract + chmod 644
```

**Step 3: Deploy React build, output.html, and overlays** (standard deploy per CLAUDE.md)

**Step 4: Configure nginx** — SSH to `3.87.107.201`, find nginx config, add:
```nginx
location /stage/ {
    root /var/www/commentarygraphic;
    try_files $uri =404;
}
```
Then: `sudo nginx -t && sudo systemctl reload nginx`

**Step 5: Verify production**

**Verify:**
- [ ] `https://commentarygraphic.com/stage/stage.html?preview=skeleton&skeleton=full-screen-card` → shows card frame (NOT the React SPA)
- [ ] `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=_sample-block` → shows card with sample block inside
- [ ] `https://commentarygraphic.com/stage/stage.html?preview=full&skeleton=full-screen-card&block=_sample-block,_sample-block&layout=columns` → two-column layout
- [ ] Play/Dismiss animation buttons work
- [ ] `https://commentarygraphic.com/output.html?graphic=logos` → still works (no regression)
- [ ] `https://commentarygraphic.com` → React SPA loads (no regression)
- [ ] No console errors on any of the above

---

## Task Dependency Graph

```
Task 1 (shell + skeleton) ──→ Task 2 (blocks + theme) ──→ Task 3 (layout) ──→ Task 4 (animation + preview) ──→ Task 5 (firebase) ──→ Task 7 (deploy)
                                                                                                                                        ↑
Task 6 (integration — independent) ────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Execution order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

Task 6 (integration) is independent of Tasks 1-5 and could be done earlier, but keeping it before deploy ensures everything ships together.

---

## Discovered Bugs
(populated by iterations as they find problems)

## Learnings
(breadcrumbs for future iterations — the next iteration has ZERO memory)

- LEARNING: Local HTTP server needed for Playwright — `npx http-server -p 8765 --cors -c-1 &` from project root, then use `http://localhost:8765/stage/stage.html?...` URLs. File protocol is blocked.
- LEARNING: favicon.ico 404 always shows in console errors — ignore it, it's not a real error.
- LEARNING: The skeleton placeholder content in Task 1's temp hook uses a dark gray (#3f3f46) background. This will be replaced by proper preview mode in Task 4.
- LEARNING: Block CSS is loaded via `<link>` tags with `data-block` attribute, not `<style>` tags. Block JS via `<script>` tag injection. Both use relative paths from stage.html (e.g., `blocks/_sample-block.js`).
- LEARNING: The preview hook is now an async IIFE at the bottom of stage.html. It handles skeleton-only, block-only, and full (skeleton+block) preview modes. Theme fetch only happens in full preview mode with `&theme=` param.
- LEARNING: `renderBlocks()` immediately sets opacity:1 on block wrappers (no animation yet). Task 4 will replace this with proper enter animations.
- LEARNING: Layout system uses `buildLayout(layoutSpec, blocksById)` which returns a DOM element (or DocumentFragment for rows). The preview hook uses `&layout=columns` to test column layouts. Block IDs are auto-generated as `{type}-{index}` (e.g., `_sample-block-0`, `_sample-block-1`) to support multiple blocks of the same type.
- LEARNING: Always resize Playwright browser to 1920x1080 before taking verification screenshots — smaller viewport crops the 1920px-wide canvas.
- LEARNING: Animation engine is fully implemented in stage.html. `playEnterAnimation()` injects `@keyframes` dynamically and uses `animation` CSS property with `forwards` fill. `playExitAnimation()` returns a Promise that resolves on `animationend` (with fallback timeout). Cleanup of `<style data-animation>` tags happens automatically after animation completes.
- LEARNING: Preview mode uses `previewBlocks` array to track blocks for Play/Dismiss toolbar. `replayEnterAnimations()` resets opacity to 0 then re-triggers after 50ms delay. `dismissPreview()` calls `playExitAnimations()` which fades blocks out but leaves skeleton visible.
- LEARNING: Task 6 adds `renderer` field to all Firebase `set()` calls in GraphicsControl.jsx. The `clearGraphic` call intentionally has NO renderer field — both output.html and stage.html clear on `graphic: 'clear'`. The registry lookup uses `getGraphicById()` which must be imported from graphicsRegistry.js.
