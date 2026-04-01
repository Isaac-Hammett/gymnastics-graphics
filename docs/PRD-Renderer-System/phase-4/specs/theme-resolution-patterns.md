# Theme Resolution Patterns

## What

How theme resolution works in the current system, and where the `resolveTheme()` helper should be implemented for Phase 4.

## Current State

### Theme Loading in theme-loader.js

**File:** `overlays/theme-loader.js`

**Two resolution paths:**

1. **URL Parameter Priority** (line 33)
   ```javascript
   const meetThemeId = params.get('meetTheme');  // ?meetTheme=pink-meet-2026
   const compId = params.get('comp');             // ?comp=wcgnic-2026
   // meetThemeId takes absolute priority
   ```

2. **Competition Config Lookup** (lines 243-252)
   ```javascript
   async function getThemeIdFromCompetition(competitionId) {
     const snapshot = await db.ref(`competitions/${competitionId}/config/meetTheme`).once('value');
     return snapshot.val() || null;
   }
   ```

### Theme Data Structure in Firebase

**Path:** `themes/{themeId}`

```javascript
{
  id: "pink-meet-2026",
  name: "Pink Meet",
  colors: {
    // v3.0 field names (preferred)
    headerBar: "#FF69B4",
    contentArea: "#FFB6D9",
    bodyBackground: "#FFFFFF",
    borderDivider: "#FF69B4",
    badge: "#FF1493",
    badgeText: "#FFFFFF",
    textOnHeader: "#000000",
    textOnContent: "#000000",

    // v2.0 backward-compat names
    headerBg: "#FF69B4",
    accentPrimary: "#FFB6D9",
    // ...
  },
  logos: {
    meetLogo: "https://...",
    causeLogo: "https://..."
  },
  images: {
    headerBgImage: "https://...",
    headerBgImageFit: "cover",
    headerBgImagePosition: "center",
    headerBgImageOpacity: "1",
    bodyBgImage: "https://...",
    // ...
  },
  sponsors: [
    { name: "Sponsor A", url: "https://..." }
  ],
  overrides: {
    "event-bar": {
      headerBar: "#FF1493",
      venueFontSize: 42,
      barBottom: 150
    },
    "sponsors-thanks": {
      contentArea: "#FFC0CB"
    }
  }
}
```

### Per-Graphic Override Application (theme-loader.js, lines 1145-1217)

```javascript
function applyOverrides(theme, graphicId) {
  const overrides = theme.overrides[graphicId];
  if (!overrides) return { hasOverrides: false };

  const root = document.documentElement;

  // 8 color suffixes
  for (const [propKey, cssSuffix] of Object.entries(colorMapping)) {
    if (overrides[propKey]) {
      root.style.setProperty(`--${graphicId}-${cssSuffix}`, overrides[propKey]);
    }
  }

  // 13 image suffixes
  // 19 layout suffixes
  // ...
}
```

### 40 Total Override Suffixes

| Category | Count | Examples |
|----------|-------|----------|
| Color | 8 | header-bg, content-bg, overlay-bg, border-color, badge-bg, badge-text, header-text, overlay-text |
| Image | 13 | header-bg-image, header-bg-image-fit, body-bg-image, body-texture, logo-url, logo-size |
| Layout | 19 | bar-bottom, bar-left, logo-img-size, venue-font-size, venue-height, name-font-size, etc. |

### CSS Variable Cascade (3-Layer)

```css
/* Resolution order: */
var(--event-bar-header-bg,      /* Layer 3: per-graphic override */
  var(--meet-header-bg,         /* Layer 2: theme default */
    #BFBFBF                     /* Layer 1: hardcoded fallback */
  )
)
```

### Theme in GraphicsControl.jsx

**Current (line 334):**
```javascript
meetTheme: config.meetTheme || ''
```

Theme ID is passed through in data, resolved by output.html via theme-loader.js.

**Sponsor Special Handling (lines 423-477):**
```javascript
if (graphicId.startsWith('sponsors-')) {
  if (config.meetTheme) {
    const themeRef = ref(db, `themes/${config.meetTheme}/sponsors`);
    const snapshot = await get(themeRef);
    const eventSponsors = snapshot.val();
    // Use theme-level sponsors if available
  }
}
```

## Target State

### New resolveTheme() Helper

**Location:** `show-controller/src/lib/themeResolver.js` (new file)

```javascript
/**
 * Resolves a theme with per-graphic overrides baked in.
 * Used by GraphicsControl, timesheetEngine, and Theme Editor.
 */
export async function resolveTheme(db, themeId, graphicId) {
  if (!themeId) return null;

  // Fetch full theme
  const themeSnap = await get(ref(db, `themes/${themeId}`));
  const theme = themeSnap.val();
  if (!theme) return null;

  // Build resolved color object (v3.0 names with v2.0 fallbacks)
  const resolved = {
    id: themeId,
    headerBg: theme.colors?.headerBar || theme.colors?.headerBg || '#d4d4d8',
    headerText: theme.colors?.textOnHeader || theme.colors?.headerText || '#000000',
    contentBg: theme.colors?.contentArea || theme.colors?.accentPrimary || '#f4f4f5',
    overlayBg: theme.colors?.bodyBackground || theme.colors?.overlayBg || '#ffffff',
    overlayText: theme.colors?.textOnContent || theme.colors?.overlayText || '#000000',
    borderColor: theme.colors?.borderDivider || theme.colors?.borderColor || '#e4e4e7',
    badgeBg: theme.colors?.badge || theme.colors?.badgeBg || '#3b82f6',
    badgeText: theme.colors?.badgeText || '#ffffff',
  };

  // Include images if present
  if (theme.images) {
    resolved.headerBgImage = theme.images.headerBgImage;
    resolved.headerBgImageFit = theme.images.headerBgImageFit || 'cover';
    resolved.headerBgImagePosition = theme.images.headerBgImagePosition || 'center';
    resolved.headerBgImageOpacity = theme.images.headerBgImageOpacity || '1';
    resolved.bodyBgImage = theme.images.bodyBgImage;
    // ... other image fields
  }

  // Include logos
  if (theme.logos) {
    resolved.meetLogo = theme.logos.meetLogo;
    resolved.causeLogo = theme.logos.causeLogo;
  }

  // Apply per-graphic overrides
  const overrides = theme.overrides?.[graphicId];
  if (overrides) {
    // Color overrides
    if (overrides.headerBar) resolved.headerBg = overrides.headerBar;
    if (overrides.textOnHeader) resolved.headerText = overrides.textOnHeader;
    if (overrides.contentArea) resolved.contentBg = overrides.contentArea;
    if (overrides.bodyBackground) resolved.overlayBg = overrides.bodyBackground;
    if (overrides.textOnContent) resolved.overlayText = overrides.textOnContent;
    if (overrides.borderDivider) resolved.borderColor = overrides.borderDivider;
    if (overrides.badge) resolved.badgeBg = overrides.badge;
    if (overrides.badgeText) resolved.badgeText = overrides.badgeText;

    // Image overrides
    if (overrides.headerBgImage) resolved.headerBgImage = overrides.headerBgImage;
    // ... other image overrides

    // Layout overrides (pass through for stage engine)
    resolved.layout = {};
    const layoutKeys = ['barBottom', 'barLeft', 'venueFontSize', 'venueHeight', ...];
    for (const key of layoutKeys) {
      if (overrides[key] !== undefined) {
        resolved.layout[key] = overrides[key];
      }
    }
  }

  return resolved;
}
```

### Usage in GraphicsControl.jsx

```javascript
import { resolveTheme } from '../lib/themeResolver';

// In sendGraphic()
if (firebaseRenderer === 'stage') {
  const resolvedTheme = await resolveTheme(db, config.meetTheme, graphicId);
  data.theme = resolvedTheme;
}
```

### Usage in timesheetEngine.js

```javascript
const { resolveTheme } = require('./themeResolver');

// In _triggerGraphic()
if (firebaseRenderer === 'stage') {
  const resolvedTheme = await resolveTheme(db, config.meetTheme, graphicId);
  graphicData.data.theme = resolvedTheme;
}
```

### Server-Side Version

The same logic, but with Firebase Admin SDK:

**Location:** `server/lib/themeResolver.js`

```javascript
async function resolveTheme(db, themeId, graphicId) {
  // Same logic, different Firebase API
  const themeSnap = await db.ref(`themes/${themeId}`).once('value');
  // ...
}
```

## Risks

1. **Duplicate code** — client and server need separate implementations
2. **v2.0/v3.0 field mapping** — must be kept in sync with theme-loader.js
3. **Performance** — theme fetch adds latency to graphic triggering

## Open Questions

1. Should `resolveTheme()` cache themes for the duration of a show?
2. Should there be a shared package between show-controller and server?
3. How to handle theme loading failures (return default colors or throw)?
