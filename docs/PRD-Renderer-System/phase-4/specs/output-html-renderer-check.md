# output.html Renderer Check

## What

The exact location and logic for the renderer check in output.html's currentGraphic listener. Critical for ensuring stage engine graphics don't render in output.html.

## Current State

**File:** `output.html`

### currentGraphic Listener Location

**Lines 14224-14359**

```javascript
db.ref(`competitions/${competitionId}/currentGraphic`).on('value', (snapshot) => {
  const state = snapshot.val();
  // ... handling logic
});
```

### Existing Renderer Check — ALREADY IMPLEMENTED

**Lines 14246-14255** (Phase 1, Task 6 — already complete)

```javascript
const { graphic, data, renderer } = state;

// Stage renderer check — if graphic is routed to stage.html, clear output.html
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

### Complete Flow

1. **Line 14225:** Snapshot received
2. **Lines 14227-14242:** Null check — if state is null/empty:
   - Clears output.innerHTML
   - Stops clip playback
   - Hides animated background
   - Clears overrides
   - Returns early
3. **Line 14244:** Destructure `{ graphic, data, renderer }`
4. **Lines 14246-14255:** **Renderer check** — if `renderer === 'stage'`:
   - Clears output
   - Clears overrides
   - Returns early
5. **Line 14258:** Render counter incremented (for "last one wins")
6. **Line 14262:** `themeReadyPromise.then()` — gates rendering on theme readiness
7. **Lines 14264-14267:** Stale render check
8. **Lines 14269-14358:** Main rendering logic

### themeReadyPromise

**Definition (line 7953):**
```javascript
let themeReadyPromise = window.themeReady || Promise.resolve();
```

**Purpose:** Gates all graphic rendering on theme loading completion (prevents FOUC).

**Resolution:** `window.themeReady` is a Promise from theme-loader.js that resolves when:
- Theme loaded successfully, or
- 3-second timeout with fallback colors

### Per-Graphic Override Clearing

**Module-level tracking (line 14222):**
```javascript
let lastLiveGraphicId = null;
```

**Clearing is triggered in 5 places:**
1. Lines 14237-14240: When state is null/empty
2. Lines 14250-14252: When `renderer === 'stage'`
3. Line 14281: When switching clip-overlay types
4. Lines 14294-14296: When non-clip graphics arrive in clip mode
5. Lines 14339-14341: Before rendering new regular graphic

**clearOverrides function (theme-loader.js, lines 1125-1137):**
```javascript
function clearOverrides(graphicId) {
  const root = document.documentElement;
  const suffixes = getAllOverrideSuffixes();  // 40 total
  for (const suffix of suffixes) {
    root.style.removeProperty(`--${graphicId}-${suffix}`);
  }
}
```

## Target State

**No changes needed** — the renderer check is already implemented correctly at lines 14246-14255.

The implementation:
1. Checks for `renderer === 'stage'` immediately after destructuring
2. Clears the output (removes any existing graphic)
3. Clears per-graphic overrides (prevents CSS variable bleeding)
4. Returns early (does not attempt to render)

### Backward Compatibility

The check handles:
- `renderer: 'stage'` → clears and exits
- `renderer: 'output'` → renders normally
- `renderer: undefined` → renders normally (backward compat for old writes)

## Risks

1. **Race condition** — if stage.html and output.html both receive the same Firebase update, both will attempt to clear/render. The renderer field ensures only one actually renders.
2. **Override bleeding** — if `clearOverrides()` isn't called, CSS variables from the previous graphic may affect the next one.

## Open Questions

1. Should output.html log when it receives a stage graphic (for debugging)?
2. Should there be a fallback render if `renderer === 'stage'` but stage.html is not loaded?
