/**
 * Theme Resolution Helper
 *
 * Resolves a theme from Firebase with per-graphic overrides baked in.
 * Used by GraphicsControl, timesheetEngine, and Theme Editor for stage engine graphics.
 *
 * This is the client-side version using Firebase Web SDK.
 * See server/lib/themeResolver.js for the server-side version using Admin SDK.
 */

import { db, ref, get } from './firebase';

/**
 * 8 color fields mapping: Firebase theme key → resolved output key → CSS variable
 *
 * v3.0 field names (preferred) with v2.0 fallbacks:
 * - colors.headerBar     || colors.headerBg      → headerBg     → --meet-header-bg
 * - colors.contentArea   || colors.accentPrimary → contentBg    → --meet-content-bg
 * - colors.bodyBackground|| colors.overlayBg     → overlayBg    → --meet-overlay-bg
 * - colors.textOnHeader  || colors.headerText    → headerText   → --meet-header-text
 * - colors.textOnContent || colors.overlayText   → overlayText  → --meet-overlay-text
 * - colors.borderDivider || colors.borderColor   → borderColor  → --meet-border-color
 * - colors.badge         || colors.badgeBg       → badgeBg      → --meet-badge-bg
 * - colors.badgeText                             → badgeText    → --meet-badge-text
 */

// Default fallback colors (match theme-loader.js fallbacks)
const FALLBACK_COLORS = {
  headerBg: '#d4d4d8',
  headerText: '#000000',
  contentBg: '#e5e5e5',
  overlayBg: '#ffffff',
  overlayText: '#000000',
  borderColor: '#d1d5db',
  badgeBg: '#16a34a',
  badgeText: '#ffffff'
};

/**
 * Mapping from Firebase override keys to resolved object keys
 * Used when merging per-graphic overrides
 */
const OVERRIDE_COLOR_MAPPING = {
  headerBar: 'headerBg',
  contentArea: 'contentBg',
  bodyBackground: 'overlayBg',
  borderDivider: 'borderColor',
  badge: 'badgeBg',
  badgeText: 'badgeText',
  textOnHeader: 'headerText',
  textOnContent: 'overlayText'
};

/**
 * Image field keys from Firebase overrides
 */
const IMAGE_FIELDS = [
  'headerBgImage',
  'headerBgImageFit',
  'headerBgImagePosition',
  'headerBgImageOpacity',
  'bodyBgImage',
  'bodyBgImageFit',
  'bodyBgImagePosition',
  'bodyBgImageOpacity',
  'bodyTexture',
  'bodyTextureOpacity',
  'bodyTextureBlend',
  'logo',
  'logoSize'
];

/**
 * Layout field keys from Firebase overrides
 */
const LAYOUT_FIELDS = [
  // Position
  'barBottom', 'barLeft',
  // Logo
  'logoImgSize', 'logoContainerWidth', 'logoContainerHeight', 'logoBg',
  'logoPadding', 'logoRadius', 'showLogo',
  // Venue header
  'venueFontSize', 'venueHeight', 'venuePaddingV', 'venuePaddingH', 'barMinWidth',
  // Text / Details
  'nameFontSize', 'locationFontSize', 'detailsHeight', 'detailsPaddingV', 'detailsPaddingH',
  // Event-summary specific
  'titleFontSize', 'titleFontFamily', 'titleFontWeight', 'titleTextTransform',
  'scoreFontFamily', 'scoreFontSize', 'headerPadding', 'headerHeight', 'headerLogoSize',
  'contentPadding', 'footerHeight', 'footerFontSize', 'teamNameFontSize',
  'athleteNameFontSize', 'rowHeight', 'rowPadding',
  // Leaderboard specific
  'tableFontSize', 'tableHeaderPadding', 'tableRowPadding', 'rankColWidth',
  'medalSize', 'teamLogoSize', 'goldFrom', 'goldTo', 'silverFrom', 'silverTo',
  'bronzeFrom', 'bronzeTo', 'stickBonusBg',
  'containerTop', 'containerLeft', 'containerRight', 'containerBottom',
  // Event-frame specific
  'frameBorderWidth'
];

/**
 * Resolves a theme with per-graphic overrides baked in.
 *
 * @param {Database} database - Firebase database instance (or null to use default)
 * @param {string} themeId - The theme ID to resolve
 * @param {string} graphicId - The graphic ID for per-graphic overrides
 * @returns {Promise<Object|null>} Resolved theme object or null if not found
 */
export async function resolveTheme(database, themeId, graphicId) {
  if (!themeId) return null;

  const firebaseDb = database || db;

  try {
    const themeRef = ref(firebaseDb, `themes/${themeId}`);
    const snapshot = await get(themeRef);
    const theme = snapshot.val();

    if (!theme) {
      console.warn(`[themeResolver] Theme not found: ${themeId}`);
      return null;
    }

    // Build resolved color object with v3.0 names and v2.0 fallbacks
    const colors = theme.colors || {};
    const resolved = {
      id: themeId,
      // 8 color fields
      headerBg: colors.headerBar || colors.headerBg || FALLBACK_COLORS.headerBg,
      headerText: colors.textOnHeader || colors.headerText || FALLBACK_COLORS.headerText,
      contentBg: colors.contentArea || colors.accentPrimary || FALLBACK_COLORS.contentBg,
      overlayBg: colors.bodyBackground || colors.overlayBg || FALLBACK_COLORS.overlayBg,
      overlayText: colors.textOnContent || colors.overlayText || FALLBACK_COLORS.overlayText,
      borderColor: colors.borderDivider || colors.borderColor || FALLBACK_COLORS.borderColor,
      badgeBg: colors.badge || colors.badgeBg || FALLBACK_COLORS.badgeBg,
      badgeText: colors.badgeText || FALLBACK_COLORS.badgeText
    };

    // Include logos
    if (theme.logos) {
      resolved.meetLogo = theme.logos.meetLogo || null;
      resolved.causeLogo = theme.logos.causeLogo || null;
    }

    // Include images from theme-level (will be overwritten by per-graphic if present)
    if (theme.images) {
      for (const field of IMAGE_FIELDS) {
        if (theme.images[field] !== undefined && theme.images[field] !== null && theme.images[field] !== '') {
          resolved[field] = theme.images[field];
        }
      }
    }

    // Apply per-graphic overrides
    const overrides = theme.overrides?.[graphicId];
    if (overrides) {
      // Color overrides
      for (const [firebaseKey, resolvedKey] of Object.entries(OVERRIDE_COLOR_MAPPING)) {
        if (overrides[firebaseKey] !== undefined && overrides[firebaseKey] !== null && overrides[firebaseKey] !== '') {
          resolved[resolvedKey] = overrides[firebaseKey];
        }
      }

      // Image overrides
      for (const field of IMAGE_FIELDS) {
        if (overrides[field] !== undefined && overrides[field] !== null && overrides[field] !== '') {
          resolved[field] = overrides[field];
        }
      }

      // Layout overrides — pass through in a separate object
      resolved.layout = {};
      for (const field of LAYOUT_FIELDS) {
        if (overrides[field] !== undefined && overrides[field] !== null && overrides[field] !== '') {
          resolved.layout[field] = overrides[field];
        }
      }

      // Flag that overrides were applied
      resolved.hasOverrides = true;
    } else {
      resolved.hasOverrides = false;
      resolved.layout = {};
    }

    return resolved;
  } catch (error) {
    console.error(`[themeResolver] Error resolving theme ${themeId}:`, error);
    return null;
  }
}

/**
 * Convert resolved theme object to CSS variables map
 * Used when writing to Firebase for stage engine rendering
 *
 * @param {Object} resolved - Resolved theme from resolveTheme()
 * @returns {Object} Map of CSS variable names to values
 */
export function themeToCssVars(resolved) {
  if (!resolved) return {};

  const vars = {
    '--meet-header-bg': resolved.headerBg,
    '--meet-header-text': resolved.headerText,
    '--meet-content-bg': resolved.contentBg,
    '--meet-overlay-bg': resolved.overlayBg,
    '--meet-overlay-text': resolved.overlayText,
    '--meet-border-color': resolved.borderColor,
    '--meet-badge-bg': resolved.badgeBg,
    '--meet-badge-text': resolved.badgeText
  };

  // Logos
  if (resolved.meetLogo) {
    vars['--meet-logo-url'] = `url(${resolved.meetLogo})`;
  }
  if (resolved.causeLogo) {
    vars['--meet-cause-logo-url'] = `url(${resolved.causeLogo})`;
  }

  // Images (wrap URLs in url())
  if (resolved.headerBgImage) {
    vars['--meet-header-bg-image'] = `url(${resolved.headerBgImage})`;
  }
  if (resolved.headerBgImageFit) {
    vars['--meet-header-bg-image-fit'] = resolved.headerBgImageFit;
  }
  if (resolved.headerBgImagePosition) {
    vars['--meet-header-bg-image-position'] = resolved.headerBgImagePosition;
  }
  if (resolved.headerBgImageOpacity) {
    vars['--meet-header-bg-image-opacity'] = resolved.headerBgImageOpacity;
  }
  if (resolved.bodyBgImage) {
    vars['--meet-body-bg-image'] = `url(${resolved.bodyBgImage})`;
  }
  if (resolved.bodyTexture) {
    vars['--meet-body-texture'] = `url(${resolved.bodyTexture})`;
  }
  if (resolved.bodyTextureOpacity) {
    vars['--meet-body-texture-opacity'] = resolved.bodyTextureOpacity;
  }
  if (resolved.bodyTextureBlend) {
    vars['--meet-body-texture-blend'] = resolved.bodyTextureBlend;
  }

  return vars;
}

export default resolveTheme;
