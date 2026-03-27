/**
 * Theme Loader for Meet Theme System (v2)
 *
 * This script loads custom meet themes from Firebase and applies them via CSS custom properties.
 * It's designed to be loaded by all overlay HTML files AND output.html.
 *
 * Usage: Add <script src="theme-loader.js"></script> before </body>
 *
 * Behavior:
 * 1. Exposes window.themeReady Promise immediately (synchronously, before any async)
 * 2. Reads `meetTheme` param from URL (takes precedence)
 * 3. If no meetTheme, reads `comp` param → fetches meetTheme from competition config
 * 4. If neither, resolves immediately with no-op
 * 5. Conditionally initializes Firebase SDK
 * 6. Fetches theme from `themes/{themeId}` via Firebase
 * 7. Applies CSS custom properties to document.documentElement
 * 8. Sets `data-meet-theme` attribute on <body> for CSS selector targeting
 * 9. Injects theme-overrides.css stylesheet
 * 10. On timeout (3s) or failure: resolves with fallback, writes error to Firebase
 */

// Create window.themeReady synchronously at top level so it's available immediately
let _resolveThemeReady;
window.themeReady = new Promise(resolve => { _resolveThemeReady = resolve; });

(function() {
  'use strict';

  const TIMEOUT_MS = 3000;

  // Get params from URL
  const params = new URLSearchParams(window.location.search);
  const meetThemeId = params.get('meetTheme');
  const compId = params.get('comp');
  const debugMode = params.get('debug') === 'theme';

  // Detect source for error reporting
  function getSource() {
    const pathname = window.location.pathname;
    if (pathname.includes('/overlays/')) {
      const filename = pathname.split('/').pop().replace('.html', '');
      return `overlay:${filename}`;
    }
    return 'output.html';
  }

  // No-op if no theme specified and no competition to look up
  if (!meetThemeId && !compId) {
    _resolveThemeReady({ success: true, themeId: null });
    // Still show debug panel if debug=theme (even without theme)
    // (createDebugPanel is defined later in the IIFE, but DOMContentLoaded delays execution)
    if (debugMode) {
      const earlyDebugState = {
        themeId: null,
        loadStatus: 'no_theme',
        source: null,
        startTime: Date.now(),
        endTime: Date.now(),
        theme: null,
        error: null
      };
      const showEarlyDebugPanel = () => {
        // createDebugPanel must be called after it's defined, so we defer
        // But since we're returning early, we need a standalone version
        createEarlyDebugPanel(earlyDebugState);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showEarlyDebugPanel);
      } else {
        showEarlyDebugPanel();
      }
    }
    return;
  }

  /**
   * Create early debug panel for no-theme cases
   * (Simplified version since we return early before other functions are defined)
   */
  function createEarlyDebugPanel(ds) {
    const root = document.documentElement;
    const pathname = window.location.pathname;
    const isOverlay = pathname.includes('/overlays/');
    const renderingPath = isOverlay ? 'iframe (overlay)' : 'inline (output.html)';
    const graphicId = isOverlay
      ? pathname.split('/').pop().replace('.html', '')
      : params.get('graphic') || '(live mode)';

    const panel = document.createElement('div');
    panel.id = 'theme-debug-panel';
    panel.innerHTML = `
      <style>
        #theme-debug-panel {
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.9);
          color: #fff;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 11px;
          border-radius: 8px;
          z-index: 99999;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        #theme-debug-panel .debug-badge {
          padding: 6px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 8px;
        }
        #theme-debug-panel .debug-badge:hover {
          background: rgba(255,255,255,0.1);
        }
        #theme-debug-panel .badge-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6b7280;
        }
        #theme-debug-panel .debug-content {
          display: none;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.2);
        }
        #theme-debug-panel.expanded .debug-content {
          display: block;
        }
        #theme-debug-panel .debug-section { margin-bottom: 12px; }
        #theme-debug-panel .debug-section-title {
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        #theme-debug-panel .debug-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          gap: 12px;
        }
        #theme-debug-panel .debug-label { color: #9ca3af; }
        #theme-debug-panel .debug-value { color: #fff; }
      </style>
      <div class="debug-badge" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="badge-indicator"></span>
        <span>Theme Debug</span>
        <span style="margin-left: auto; color: #6b7280">8/8</span>
      </div>
      <div class="debug-content">
        <div class="debug-section">
          <div class="debug-section-title">Status</div>
          <div class="debug-row">
            <span class="debug-label">Theme ID</span>
            <span class="debug-value">none</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Load Status</span>
            <span class="debug-value">no_theme</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Source</span>
            <span class="debug-value">(no theme)</span>
          </div>
        </div>
        <div class="debug-section">
          <div class="debug-section-title">Rendering</div>
          <div class="debug-row">
            <span class="debug-label">Path</span>
            <span class="debug-value">${renderingPath}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Graphic ID</span>
            <span class="debug-value">${graphicId}</span>
          </div>
        </div>
        <div class="debug-section">
          <div class="debug-section-title">CSS Variables (8/8)</div>
          <div style="color:#9ca3af;font-size:10px;">No theme applied — using fallback colors</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCh0aZUvKl6Qvqsva3hvOgJJlleP1OwcTY",
    authDomain: "gymnastics-graphics.firebaseapp.com",
    databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
    projectId: "gymnastics-graphics",
    storageBucket: "gymnastics-graphics.firebasestorage.app",
    messagingSenderId: "117454807823",
    appId: "1:117454807823:web:7ee698cc6379e69e2bd3af"
  };

  /**
   * Load Firebase SDK dynamically (only when theme is requested)
   * @returns {Promise<void>}
   */
  function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
      // Check if Firebase is already loaded
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        resolve();
        return;
      }

      // Check if Firebase is loaded but not initialized
      if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        resolve();
        return;
      }

      // Load Firebase SDK dynamically
      const appScript = document.createElement('script');
      appScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
      appScript.onload = () => {
        const dbScript = document.createElement('script');
        dbScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
        dbScript.onload = () => {
          firebase.initializeApp(firebaseConfig);
          resolve();
        };
        dbScript.onerror = reject;
        document.head.appendChild(dbScript);
      };
      appScript.onerror = reject;
      document.head.appendChild(appScript);
    });
  }

  /**
   * Get theme ID from competition config
   * @param {string} competitionId - Competition ID
   * @returns {Promise<string|null>} Theme ID or null
   */
  async function getThemeIdFromCompetition(competitionId) {
    try {
      const db = firebase.database();
      const snapshot = await db.ref(`competitions/${competitionId}/config/meetTheme`).once('value');
      return snapshot.val() || null;
    } catch (error) {
      console.error('[theme-loader] Error reading competition config:', error);
      return null;
    }
  }

  /**
   * Fetch theme data from Firebase
   * @param {string} themeId - Theme ID to fetch
   * @returns {Promise<Object|null>} Theme data or null if not found
   */
  async function fetchTheme(themeId) {
    try {
      const db = firebase.database();
      const snapshot = await db.ref(`themes/${themeId}`).once('value');
      return snapshot.val();
    } catch (error) {
      console.error('[theme-loader] Error fetching theme:', error);
      return null;
    }
  }

  /**
   * Write error to Firebase for producer visibility
   * @param {string} type - Error type
   * @param {string} themeId - Theme ID that failed
   * @param {string} message - Error message
   */
  async function writeError(type, themeId, message) {
    // Only write errors if we have a competition ID
    if (!compId) return;

    try {
      const db = firebase.database();
      const errorRef = db.ref(`competitions/${compId}/production/themeErrors`).push();
      await errorRef.set({
        type: type,
        themeId: themeId || 'unknown',
        compId: compId,
        source: getSource(),
        message: message,
        url: window.location.href,
        timestamp: Date.now(),
        resolved: false
      });
      console.log('[theme-loader] Error logged to Firebase');
    } catch (err) {
      // Silent fail - don't block on error logging
      console.error('[theme-loader] Failed to write error to Firebase:', err);
    }
  }

  /**
   * Apply theme colors as CSS custom properties
   * @param {Object} theme - Theme data from Firebase
   * @param {string} themeId - Theme ID used for lookup
   */
  function applyTheme(theme, themeId) {
    if (!theme || !theme.colors) {
      console.warn('[theme-loader] No theme colors found');
      return;
    }

    const root = document.documentElement;
    const colors = theme.colors;

    // Map theme color fields to CSS custom properties
    // Supports both v3.0 field names and v2.0 backward-compat names
    const colorMappings = {
      // v2.0 backward compat FIRST (old themes still work)
      // v3.0 fields below will overwrite these if both exist
      headerBg: '--meet-header-bg',
      accentPrimary: '--meet-content-bg',
      accentSecondary: '--meet-header-bg',
      footerBg: '--meet-header-bg',
      headerText: '--meet-header-text',
      borderColor: '--meet-border-color',
      badgeBg: '--meet-badge-bg',
      overlayBg: '--meet-overlay-bg',
      overlayText: '--meet-overlay-text',
      // v3.0 field names (8 colors) — applied LAST so they take precedence
      headerBar: '--meet-header-bg',
      contentArea: '--meet-content-bg',
      bodyBackground: '--meet-overlay-bg',
      borderDivider: '--meet-border-color',
      badge: '--meet-badge-bg',
      badgeText: '--meet-badge-text',
      textOnHeader: '--meet-header-text',
      textOnContent: '--meet-overlay-text',
    };

    for (const [themeKey, cssVar] of Object.entries(colorMappings)) {
      if (colors[themeKey]) {
        root.style.setProperty(cssVar, colors[themeKey]);
      }
    }

    // Apply logo URLs as CSS custom properties AND data attributes
    // CSS properties use url() format for background-image
    // Data attributes use plain URL for JS img.src access
    if (theme.logos) {
      if (theme.logos.meetLogo) {
        root.style.setProperty('--meet-logo-url', `url(${theme.logos.meetLogo})`);
        document.body.setAttribute('data-meet-logo', theme.logos.meetLogo);
      }
      if (theme.logos.causeLogo) {
        root.style.setProperty('--meet-cause-logo-url', `url(${theme.logos.causeLogo})`);
        document.body.setAttribute('data-meet-cause-logo', theme.logos.causeLogo);
      }
    }

    // Apply branding text as CSS custom properties (can be read via JS if needed)
    if (theme.branding) {
      if (theme.branding.meetTitle) {
        root.style.setProperty('--meet-title', `"${theme.branding.meetTitle}"`);
      }
      if (theme.branding.subtitle) {
        root.style.setProperty('--meet-subtitle', `"${theme.branding.subtitle}"`);
      }
    }

    // Apply texture overlay as CSS custom properties
    if (theme.textures && theme.textures.overlay) {
      root.style.setProperty('--meet-texture', `url(${theme.textures.overlay})`);
      root.style.setProperty('--meet-texture-opacity', theme.textures.opacity || '0.08');
      console.log('[theme-loader] Texture applied:', theme.textures.overlay, 'opacity:', theme.textures.opacity);
    }

    // Apply theme-level background images (applies to all graphics)
    if (theme.images) {
      if (theme.images.headerBgImage) {
        root.style.setProperty('--meet-header-bg-image', `url(${theme.images.headerBgImage})`);
        root.style.setProperty('--meet-header-bg-image-fit', theme.images.headerBgImageFit || 'cover');
        root.style.setProperty('--meet-header-bg-image-position', theme.images.headerBgImagePosition || 'center');
        root.style.setProperty('--meet-header-bg-image-opacity', theme.images.headerBgImageOpacity ?? '1');
        console.log('[theme-loader] Header bg image applied:', theme.images.headerBgImage);
      }
      if (theme.images.bodyBgImage) {
        root.style.setProperty('--meet-body-bg-image', `url(${theme.images.bodyBgImage})`);
        root.style.setProperty('--meet-body-bg-image-fit', theme.images.bodyBgImageFit || 'cover');
        root.style.setProperty('--meet-body-bg-image-position', theme.images.bodyBgImagePosition || 'center');
        root.style.setProperty('--meet-body-bg-image-opacity', theme.images.bodyBgImageOpacity ?? '1');
        console.log('[theme-loader] Body bg image applied:', theme.images.bodyBgImage);
      }
    }

    // Set data-meet-theme attribute on body for CSS selector targeting
    document.body.setAttribute('data-meet-theme', theme.id || themeId);

    // Store theme data for live-mode override lookups (Phase 3)
    window.__themeData = theme;

    console.log('[theme-loader] Theme applied:', theme.name || themeId);
  }

  /**
   * Detect graphic ID from current context
   * @returns {string|null} Graphic ID or null if in live mode
   */
  function detectGraphicId() {
    const pathname = window.location.pathname;

    // Overlay files: extract from pathname
    if (pathname.includes('/overlays/')) {
      return pathname.split('/').pop().replace('.html', '');
    }

    // output.html with ?mode=clip or ?mode=clip-preview
    const mode = params.get('mode');
    if (mode === 'clip' || mode === 'clip-preview') {
      return 'clip-overlay';
    }

    // output.html with ?graphic= param (preview mode)
    const graphicParam = params.get('graphic');
    if (graphicParam) {
      return graphicParam;
    }

    // output.html live mode - cannot detect at load time
    // Overrides will be applied in the currentGraphic listener
    return null;
  }

  // ============================================================================
  // Override Mapping Objects (module-scope for export access)
  // ============================================================================

  // Map override properties to CSS variable suffixes (8 color suffixes)
  // Pattern: --{graphicId}-{suffix}
  const overrideMapping = {
    headerBar: 'header-bg',
    contentArea: 'content-bg',
    bodyBackground: 'overlay-bg',
    borderDivider: 'border-color',
    badge: 'badge-bg',
    badgeText: 'badge-text',
    textOnHeader: 'header-text',
    textOnContent: 'overlay-text'
  };

  // Image/texture overrides — set as url() wrapped CSS variables (13 image suffixes)
  // These allow per-graphic background images and textures
  const imageOverrideMapping = {
    // Header background image
    headerBgImage: 'header-bg-image',
    headerBgImageFit: 'header-bg-image-fit',
    headerBgImagePosition: 'header-bg-image-position',
    headerBgImageOpacity: 'header-bg-image-opacity',
    // Body background image
    bodyBgImage: 'body-bg-image',
    bodyBgImageFit: 'body-bg-image-fit',
    bodyBgImagePosition: 'body-bg-image-position',
    bodyBgImageOpacity: 'body-bg-image-opacity',
    // Body texture
    bodyTexture: 'body-texture',
    bodyTextureOpacity: 'body-texture-opacity',
    bodyTextureBlend: 'body-texture-blend',
    // Logo override
    logo: 'logo-url',
    logoSize: 'logo-size'
  };

  // Layout overrides — per-graphic sizing, positioning, visibility (19 layout suffixes)
  // These set CSS variables directly on :root (e.g., --event-bar-venue-font-size: 42px)
  // The CSS in output.html reads these via var(--event-bar-venue-font-size, 36px)
  const layoutOverrideMapping = {
    // Position
    barBottom: { suffix: 'bar-bottom', unit: 'px' },
    barLeft: { suffix: 'bar-left', unit: 'px' },
    // Logo
    logoImgSize: { suffix: 'logo-img-size', unit: 'px' },
    logoContainerWidth: { suffix: 'logo-container-width', unit: 'px' },
    logoContainerHeight: { suffix: 'logo-container-height', unit: 'px' },
    logoBg: { suffix: 'logo-bg', unit: null },  // color value, no unit
    logoPadding: { suffix: 'logo-padding', unit: 'px' },
    logoRadius: { suffix: 'logo-radius', unit: 'px' },
    showLogo: { suffix: 'show-logo', unit: null },  // 'flex' or 'none'
    // Venue header
    venueFontSize: { suffix: 'venue-font-size', unit: 'px' },
    venueHeight: { suffix: 'venue-height', unit: 'px' },
    venuePaddingV: { suffix: 'venue-padding-v', unit: 'px' },
    venuePaddingH: { suffix: 'venue-padding-h', unit: 'px' },
    barMinWidth: { suffix: 'bar-min-width', unit: 'px' },
    // Text / Details
    nameFontSize: { suffix: 'name-font-size', unit: 'px' },
    locationFontSize: { suffix: 'location-font-size', unit: 'px' },
    detailsHeight: { suffix: 'details-height', unit: 'px' },
    detailsPaddingV: { suffix: 'details-padding-v', unit: 'px' },
    detailsPaddingH: { suffix: 'details-padding-h', unit: 'px' },
    // Event-summary specific (Phase 7A.1)
    titleFontSize: { suffix: 'title-font-size', unit: 'px' },
    titleFontFamily: { suffix: 'title-font-family', unit: null },
    titleFontWeight: { suffix: 'title-font-weight', unit: null },
    titleTextTransform: { suffix: 'title-text-transform', unit: null },
    scoreFontFamily: { suffix: 'score-font-family', unit: null },
    scoreFontSize: { suffix: 'score-font-size', unit: 'px' },
    headerPadding: { suffix: 'header-padding', unit: 'px' },
    headerHeight: { suffix: 'header-height', unit: 'px' },
    headerLogoSize: { suffix: 'header-logo-size', unit: 'px' },
    contentPadding: { suffix: 'content-padding', unit: 'px' },
    footerHeight: { suffix: 'footer-height', unit: 'px' },
    footerFontSize: { suffix: 'footer-font-size', unit: 'px' },
    teamNameFontSize: { suffix: 'team-name-font-size', unit: 'px' },
    athleteNameFontSize: { suffix: 'athlete-name-font-size', unit: 'px' },
    rowHeight: { suffix: 'row-height', unit: 'px' },
    rowPadding: { suffix: 'row-padding', unit: 'px' },
    // Virtuis-leaderboard specific (Phase 7A.2)
    tableFontSize: { suffix: 'table-font-size', unit: 'px' },
    tableHeaderPadding: { suffix: 'table-header-padding', unit: 'px' },
    tableRowPadding: { suffix: 'table-row-padding', unit: 'px' },
    rankColWidth: { suffix: 'rank-col-width', unit: 'px' },
    medalSize: { suffix: 'medal-size', unit: 'px' },
    teamLogoSize: { suffix: 'team-logo-size', unit: 'px' },
    goldFrom: { suffix: 'gold-from', unit: null },
    goldTo: { suffix: 'gold-to', unit: null },
    silverFrom: { suffix: 'silver-from', unit: null },
    silverTo: { suffix: 'silver-to', unit: null },
    bronzeFrom: { suffix: 'bronze-from', unit: null },
    bronzeTo: { suffix: 'bronze-to', unit: null },
    stickBonusBg: { suffix: 'stick-bonus-bg', unit: null },
    containerTop: { suffix: 'container-top', unit: 'px' },
    containerLeft: { suffix: 'container-left', unit: 'px' },
    containerRight: { suffix: 'container-right', unit: 'px' },
    containerBottom: { suffix: 'container-bottom', unit: 'px' },
    // Event-frame specific (Phase 7A.3)
    frameBorderWidth: { suffix: 'frame-border-width', unit: 'px' },
    frameBorderColor: { suffix: 'frame-border-color', unit: null },
    frameGap: { suffix: 'frame-gap', unit: 'px' },
    // Frame header/logo row
    logoHeaderHeight: { suffix: 'logo-header-height', unit: 'px' },
    frameLogoSize: { suffix: 'frame-logo-size', unit: 'px' },
    frameLogoMaxWidth: { suffix: 'frame-logo-max-width', unit: 'px' },
    // Watermark
    watermarkFontSize: { suffix: 'watermark-font-size', unit: 'px' },
    watermarkFontWeight: { suffix: 'watermark-font-weight', unit: null },
    watermarkColor: { suffix: 'watermark-color', unit: null },
    watermarkAccentColor: { suffix: 'watermark-accent-color', unit: null },
    watermarkBottom: { suffix: 'watermark-bottom', unit: 'px' },
    watermarkRight: { suffix: 'watermark-right', unit: 'px' },
    showWatermark: { suffix: 'show-watermark', unit: null },
    // Sponsors-thanks specific (Phase 7A.4)
    containerMarginTop: { suffix: 'container-margin-top', unit: 'px' },
    containerMarginSide: { suffix: 'container-margin-side', unit: 'px' },
    containerMarginBottom: { suffix: 'container-margin-bottom', unit: 'px' },
    containerBorderRadius: { suffix: 'container-border-radius', unit: 'px' },
    headerPaddingV: { suffix: 'header-padding-v', unit: 'px' },
    headerPaddingH: { suffix: 'header-padding-h', unit: 'px' },
    headerTitleFontSize: { suffix: 'header-title-font-size', unit: 'px' },
    headerTitleFontWeight: { suffix: 'header-title-font-weight', unit: null },
    headerTitleFontFamily: { suffix: 'header-title-font-family', unit: null },
    headerLogoWidth: { suffix: 'header-logo-width', unit: 'px' },
    headerLogoHeight: { suffix: 'header-logo-height', unit: 'px' },
    gridGap: { suffix: 'grid-gap', unit: 'px' },
    gridPadding: { suffix: 'grid-padding', unit: 'px' },
    sponsorItemPadding: { suffix: 'sponsor-item-padding', unit: 'px' },
    fallbackFontSize: { suffix: 'fallback-font-size', unit: 'px' },
    fallbackFontWeight: { suffix: 'fallback-font-weight', unit: null },
    noSponsorsFontSize: { suffix: 'no-sponsors-font-size', unit: 'px' },
    noSponsorsFontWeight: { suffix: 'no-sponsors-font-weight', unit: null },
    // Team-roster specific (Phase 7A.5)
    rosterContainerPadding: { suffix: 'roster-container-padding', unit: 'px' },
    rosterGridGap: { suffix: 'roster-grid-gap', unit: 'px' },
    rosterHeadshotSize: { suffix: 'roster-headshot-size', unit: 'px' },
    rosterHeadshotRadius: { suffix: 'roster-headshot-radius', unit: null },  // percentage or px
    rosterHeadshotBorder: { suffix: 'roster-headshot-border', unit: 'px' },
    rosterHeadshotBorderColor: { suffix: 'roster-headshot-border-color', unit: null },
    rosterHeadshotBg: { suffix: 'roster-headshot-bg', unit: null },
    rosterNameFontSize: { suffix: 'roster-name-font-size', unit: 'px' },
    rosterNameFontWeight: { suffix: 'roster-name-font-weight', unit: null },
    rosterNameFontFamily: { suffix: 'roster-name-font-family', unit: null },
    rosterNameTextTransform: { suffix: 'roster-name-text-transform', unit: null },
    rosterNameColor: { suffix: 'roster-name-color', unit: null },
    rosterInitialsFontSize: { suffix: 'roster-initials-font-size', unit: 'px' },
    rosterInitialsColor: { suffix: 'roster-initials-color', unit: null },
    rosterInitialsBg: { suffix: 'roster-initials-bg', unit: null },
    rosterCardWidth: { suffix: 'roster-card-width', unit: 'px' },
    // Team-stats specific (Phase 7B.1)
    statsTop: { suffix: 'stats-top', unit: 'px' },
    statsLeft: { suffix: 'stats-left', unit: 'px' },
    statsMinWidth: { suffix: 'stats-min-width', unit: 'px' },
    statsHeaderPaddingV: { suffix: 'stats-header-padding-v', unit: 'px' },
    statsHeaderPaddingH: { suffix: 'stats-header-padding-h', unit: 'px' },
    statsHeaderGap: { suffix: 'stats-header-gap', unit: 'px' },
    statsTeamNameFontSize: { suffix: 'stats-team-name-font-size', unit: 'px' },
    statsTeamNameFontWeight: { suffix: 'stats-team-name-font-weight', unit: null },
    statsTeamNameFontFamily: { suffix: 'stats-team-name-font-family', unit: null },
    statsLogoSize: { suffix: 'stats-logo-size', unit: 'px' },
    statsContentPaddingV: { suffix: 'stats-content-padding-v', unit: 'px' },
    statsContentPaddingH: { suffix: 'stats-content-padding-h', unit: 'px' },
    statsContentGap: { suffix: 'stats-content-gap', unit: 'px' },
    statsLabelFontSize: { suffix: 'stats-label-font-size', unit: 'px' },
    statsLabelFontWeight: { suffix: 'stats-label-font-weight', unit: null },
    statsValueFontSize: { suffix: 'stats-value-font-size', unit: 'px' },
    statsValueFontWeight: { suffix: 'stats-value-font-weight', unit: null },
    statsValueFontFamily: { suffix: 'stats-value-font-family', unit: null },
    // Team-coaches specific (Phase 7B.2)
    coachesTop: { suffix: 'coaches-top', unit: 'px' },
    coachesLeft: { suffix: 'coaches-left', unit: 'px' },
    coachesMinWidth: { suffix: 'coaches-min-width', unit: 'px' },
    coachesHeaderPaddingV: { suffix: 'coaches-header-padding-v', unit: 'px' },
    coachesHeaderPaddingH: { suffix: 'coaches-header-padding-h', unit: 'px' },
    coachesTitleFontSize: { suffix: 'coaches-title-font-size', unit: 'px' },
    coachesTitleFontWeight: { suffix: 'coaches-title-font-weight', unit: null },
    coachesTitleFontFamily: { suffix: 'coaches-title-font-family', unit: null },
    coachesLogoSize: { suffix: 'coaches-logo-size', unit: 'px' },
    coachesContentPaddingV: { suffix: 'coaches-content-padding-v', unit: 'px' },
    coachesContentPaddingH: { suffix: 'coaches-content-padding-h', unit: 'px' },
    coachesNameFontSize: { suffix: 'coaches-name-font-size', unit: 'px' },
    coachesNameFontWeight: { suffix: 'coaches-name-font-weight', unit: null },
    coachesNameFontFamily: { suffix: 'coaches-name-font-family', unit: null },
    coachesNameLineHeight: { suffix: 'coaches-name-line-height', unit: null },
    // Sponsors-cycle specific (Phase 7C.1)
    fadeDuration: { suffix: 'fade-duration', unit: 's' },
    logoMaxWidth: { suffix: 'logo-max-width', unit: 'px' },
    logoMaxHeight: { suffix: 'logo-max-height', unit: 'px' },
    targetHeight: { suffix: 'target-height', unit: 'px' },
    maxWidthRender: { suffix: 'max-width-render', unit: 'px' },
    noSponsorsFontSize: { suffix: 'no-sponsors-font-size', unit: 'px' },
    noSponsorsFontWeight: { suffix: 'no-sponsors-font-weight', unit: null },
    noSponsorsFontFamily: { suffix: 'no-sponsors-font-family', unit: null },
    noSponsorsColor: { suffix: 'no-sponsors-color', unit: null },
    // Sponsors-bug specific (Phase 7C.2)
    bugBottom: { suffix: 'bug-bottom', unit: 'px' },
    bugRight: { suffix: 'bug-right', unit: 'px' },
    bugWidth: { suffix: 'bug-width', unit: 'px' },
    bugHeight: { suffix: 'bug-height', unit: 'px' },
    bugBorderRadius: { suffix: 'bug-border-radius', unit: 'px' },
    bugPadding: { suffix: 'bug-padding', unit: 'px' },
    bugFadeTransition: { suffix: 'bug-fade-transition', unit: 's' },
  };

  /**
   * Get all CSS variable suffixes from mapping objects
   * Used by clearOverrides() to know which variables to remove
   * @returns {string[]} Array of all suffixes
   */
  function getAllOverrideSuffixes() {
    const suffixes = [];
    // Color overrides (8)
    suffixes.push(...Object.values(overrideMapping));
    // Image overrides (13)
    suffixes.push(...Object.values(imageOverrideMapping));
    // Layout overrides (19)
    for (const config of Object.values(layoutOverrideMapping)) {
      suffixes.push(config.suffix);
    }
    return suffixes;
  }

  /**
   * Clear all per-graphic override CSS variables for a given graphic ID
   * Call this before switching graphics to prevent stale overrides
   * @param {string} graphicId - Graphic ID to clear overrides for
   */
  function clearOverrides(graphicId) {
    if (!graphicId) return;

    const root = document.documentElement;
    const suffixes = getAllOverrideSuffixes();

    for (const suffix of suffixes) {
      const varName = `--${graphicId}-${suffix}`;
      root.style.removeProperty(varName);
    }

    console.log(`[theme-loader] Cleared ${suffixes.length} override variables for ${graphicId}`);
  }

  /**
   * Apply per-graphic override CSS variables
   * @param {Object} theme - Theme data (including overrides)
   * @param {string} graphicId - Graphic ID to apply overrides for
   * @returns {Object} Override status for debug panel
   */
  function applyOverrides(theme, graphicId) {
    const overrideStatus = {
      graphicId: graphicId,
      hasOverrides: false,
      applied: []
    };

    if (!theme || !theme.overrides || !graphicId) {
      return overrideStatus;
    }

    const overrides = theme.overrides[graphicId];
    if (!overrides) {
      return overrideStatus;
    }

    overrideStatus.hasOverrides = true;
    const root = document.documentElement;

    // Apply color overrides
    for (const [propKey, cssSuffix] of Object.entries(overrideMapping)) {
      if (overrides[propKey]) {
        const varName = `--${graphicId}-${cssSuffix}`;
        root.style.setProperty(varName, overrides[propKey]);
        overrideStatus.applied.push({ name: varName, value: overrides[propKey] });
        console.log(`[theme-loader] Override applied: ${varName} = ${overrides[propKey]}`);
      }
    }

    // Apply image/texture overrides
    for (const [propKey, cssSuffix] of Object.entries(imageOverrideMapping)) {
      if (overrides[propKey] !== undefined && overrides[propKey] !== null && overrides[propKey] !== '') {
        const varName = `--${graphicId}-${cssSuffix}`;
        let value = overrides[propKey];

        // Wrap URL values in url() for CSS consumption
        if (propKey === 'headerBgImage' || propKey === 'bodyBgImage' || propKey === 'bodyTexture' || propKey === 'logo') {
          value = `url(${value})`;
        }
        // Add 'px' to logoSize if it's a number
        if (propKey === 'logoSize' && typeof overrides[propKey] === 'number') {
          value = `${overrides[propKey]}px`;
        }

        root.style.setProperty(varName, value);
        overrideStatus.applied.push({ name: varName, value: value });
        console.log(`[theme-loader] Override applied: ${varName} = ${value}`);
      }
    }

    // Apply layout overrides
    for (const [propKey, config] of Object.entries(layoutOverrideMapping)) {
      if (overrides[propKey] !== undefined && overrides[propKey] !== null && overrides[propKey] !== '') {
        const varName = `--${graphicId}-${config.suffix}`;
        let value = overrides[propKey];

        // Handle boolean show/hide — convert to display value
        if (propKey === 'showLogo') {
          value = value === false || value === 'false' || value === 'none' ? 'none' : 'flex';
        } else if (config.unit && typeof value === 'number') {
          value = `${value}${config.unit}`;
        } else if (config.unit && !String(value).endsWith(config.unit)) {
          value = `${value}${config.unit}`;
        }

        root.style.setProperty(varName, value);
        overrideStatus.applied.push({ name: varName, value: value });
        console.log(`[theme-loader] Layout override applied: ${varName} = ${value}`);
      }
    }

    return overrideStatus;
  }

  // Export override functions for live-mode use in output.html
  window.themeApplyOverrides = applyOverrides;
  window.themeClearOverrides = clearOverrides;

  /**
   * Inject theme-overrides.css stylesheet
   */
  function injectOverrideStyles() {
    // Check if already injected
    if (document.querySelector('link[href*="theme-overrides.css"]')) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // Determine path relative to current page
    const currentPath = window.location.pathname;
    const isOverlay = currentPath.includes('/overlays/');
    link.href = isOverlay ? 'theme-overrides.css' : 'overlays/theme-overrides.css';
    document.head.appendChild(link);
  }

  // Debug state tracking
  const debugState = {
    themeId: null,
    loadStatus: 'pending',
    source: null,
    startTime: Date.now(),
    endTime: null,
    theme: null,
    error: null,
    overrideStatus: null
  };

  /**
   * Create debug panel showing theme diagnostic information
   * @param {Object} state - Debug state (optional, uses closure if not provided)
   */
  function createDebugPanel(state) {
    if (!debugMode) return;
    const ds = state || debugState;

    const root = document.documentElement;
    const duration = ds.endTime ? ds.endTime - ds.startTime : 0;

    // Detect rendering path and graphic ID
    const pathname = window.location.pathname;
    const isOverlay = pathname.includes('/overlays/');
    const renderingPath = isOverlay ? 'iframe (overlay)' : 'inline (output.html)';
    const graphicId = isOverlay
      ? pathname.split('/').pop().replace('.html', '')
      : params.get('graphic') || '(live mode)';

    // The 8 CSS variables to check — now with override suffix mapping
    const cssVars = [
      { name: '--meet-header-bg', themeKey: ['headerBar', 'headerBg'], overrideSuffix: 'header-bg', fallback: '#BFBFBF' },
      { name: '--meet-content-bg', themeKey: ['contentArea', 'accentPrimary'], overrideSuffix: 'content-bg', fallback: '#E5E5E5' },
      { name: '--meet-header-text', themeKey: ['textOnHeader', 'headerText'], overrideSuffix: 'header-text', fallback: '#000000' },
      { name: '--meet-overlay-bg', themeKey: ['bodyBackground', 'overlayBg'], overrideSuffix: 'overlay-bg', fallback: '#FFFFFF' },
      { name: '--meet-overlay-text', themeKey: ['textOnContent', 'overlayText'], overrideSuffix: 'overlay-text', fallback: '#000000' },
      { name: '--meet-border-color', themeKey: ['borderDivider', 'borderColor'], overrideSuffix: 'border-color', fallback: '#D1D5DB' },
      { name: '--meet-badge-bg', themeKey: ['badge', 'badgeBg'], overrideSuffix: 'badge-bg', fallback: '#16A34A' },
      { name: '--meet-badge-text', themeKey: ['badgeText'], overrideSuffix: 'badge-text', fallback: '#FFFFFF' }
    ];

    // Determine the detected graphic ID for override lookup
    const detectedGraphicId = graphicId !== '(live mode)' ? graphicId : null;

    // Get expected and actual values for each variable, including source layer detection
    const varChecks = cssVars.map(v => {
      const computed = getComputedStyle(root).getPropertyValue(v.name).trim();

      // Check for per-graphic override (Layer 3)
      let overrideValue = null;
      let overrideVarName = null;
      if (detectedGraphicId) {
        overrideVarName = `--${detectedGraphicId}-${v.overrideSuffix}`;
        overrideValue = getComputedStyle(root).getPropertyValue(overrideVarName).trim();
      }

      // Check theme value (Layer 2)
      let themeValue = null;
      if (ds.theme && ds.theme.colors) {
        for (const key of v.themeKey) {
          if (ds.theme.colors[key]) {
            themeValue = ds.theme.colors[key];
            break;
          }
        }
      }

      // Determine which layer is providing the value
      // Note: The global --meet-* variable is always set to the theme value.
      // The override is in a separate --{graphicId}-* variable.
      // The CSS cascade `var(--{graphicId}-*, var(--meet-*, fallback))` handles priority.
      let sourceLayer = 1; // Fallback
      let sourceLabel = 'Layer 1 (fallback)';
      let expected = v.fallback;
      let effectiveValue = v.fallback; // What the element will actually use

      if (overrideValue && overrideValue !== '') {
        sourceLayer = 3;
        sourceLabel = `Layer 3 (override: ${detectedGraphicId})`;
        effectiveValue = overrideValue;
        // The global var still shows theme value, but CSS cascade uses override
        expected = themeValue || v.fallback; // The global var value
      } else if (themeValue) {
        sourceLayer = 2;
        sourceLabel = 'Layer 2 (theme)';
        expected = themeValue;
        effectiveValue = themeValue;
      }

      const isSet = computed !== '';
      // For Layer 3, the global var will match theme, not override - that's correct
      const matches = expected ? computed.toLowerCase() === expected.toLowerCase() : true;

      return {
        name: v.name,
        expected: expected,
        actual: computed || '(not set)',
        effectiveValue: effectiveValue,
        sourceLayer: sourceLayer,
        sourceLabel: sourceLabel,
        overrideVarName: overrideVarName,
        overrideValue: overrideValue,
        pass: isSet && matches
      };
    });

    // Count pass/fail
    const passCount = varChecks.filter(v => v.pass).length;
    const failCount = varChecks.filter(v => !v.pass).length;

    // Check logo data attributes
    const meetLogo = document.body.getAttribute('data-meet-logo');
    const causeLogo = document.body.getAttribute('data-meet-cause-logo');

    // Create panel HTML
    const panel = document.createElement('div');
    panel.id = 'theme-debug-panel';
    panel.innerHTML = `
      <style>
        #theme-debug-panel {
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.9);
          color: #fff;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 11px;
          border-radius: 8px;
          z-index: 99999;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        #theme-debug-panel .debug-badge {
          padding: 6px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 8px;
        }
        #theme-debug-panel .debug-badge:hover {
          background: rgba(255,255,255,0.1);
        }
        #theme-debug-panel .badge-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        #theme-debug-panel .badge-indicator.success { background: #22c55e; }
        #theme-debug-panel .badge-indicator.fail { background: #ef4444; }
        #theme-debug-panel .badge-indicator.timeout { background: #f59e0b; }
        #theme-debug-panel .badge-indicator.none { background: #6b7280; }
        #theme-debug-panel .debug-content {
          display: none;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.2);
          max-height: 400px;
          overflow-y: auto;
        }
        #theme-debug-panel.expanded .debug-content {
          display: block;
        }
        #theme-debug-panel .debug-section {
          margin-bottom: 12px;
        }
        #theme-debug-panel .debug-section:last-child {
          margin-bottom: 0;
        }
        #theme-debug-panel .debug-section-title {
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        #theme-debug-panel .debug-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          gap: 12px;
        }
        #theme-debug-panel .debug-label {
          color: #9ca3af;
        }
        #theme-debug-panel .debug-value {
          color: #fff;
          text-align: right;
          word-break: break-all;
        }
        #theme-debug-panel .debug-value.pass { color: #22c55e; }
        #theme-debug-panel .debug-value.fail { color: #ef4444; }
        #theme-debug-panel .debug-value.warn { color: #f59e0b; }
        #theme-debug-panel .var-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 8px;
          padding: 3px 0;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        #theme-debug-panel .var-name {
          color: #93c5fd;
        }
        #theme-debug-panel .var-expected {
          color: #9ca3af;
          font-size: 10px;
        }
        #theme-debug-panel .var-actual {
          color: #fff;
        }
        #theme-debug-panel .status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-right: 4px;
        }
        #theme-debug-panel .status-dot.pass { background: #22c55e; }
        #theme-debug-panel .status-dot.fail { background: #ef4444; }
        /* Layer source colors */
        #theme-debug-panel .layer-1 { color: #9ca3af; } /* Gray for fallback */
        #theme-debug-panel .layer-2 { color: #60a5fa; } /* Blue for theme */
        #theme-debug-panel .layer-3 { color: #c084fc; } /* Purple for override */
        #theme-debug-panel .override-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          gap: 8px;
        }
        #theme-debug-panel .override-name {
          color: #c084fc;
          font-size: 10px;
        }
        #theme-debug-panel .override-value {
          color: #fff;
          font-size: 10px;
        }
      </style>
      <div class="debug-badge" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="badge-indicator ${ds.loadStatus === 'success' ? 'success' : ds.loadStatus === 'timeout' ? 'timeout' : ds.themeId === null ? 'none' : 'fail'}"></span>
        <span>Theme Debug</span>
        <span style="margin-left: auto; color: ${failCount > 0 ? '#ef4444' : '#22c55e'}">${passCount}/${varChecks.length}</span>
      </div>
      <div class="debug-content">
        <div class="debug-section">
          <div class="debug-section-title">Status</div>
          <div class="debug-row">
            <span class="debug-label">Theme ID</span>
            <span class="debug-value">${ds.themeId || 'none'}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Load Status</span>
            <span class="debug-value ${ds.loadStatus === 'success' ? 'pass' : ds.loadStatus === 'timeout' ? 'warn' : ds.themeId === null ? '' : 'fail'}">${ds.loadStatus}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Source</span>
            <span class="debug-value">${ds.source || '(no theme)'}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Load Time</span>
            <span class="debug-value">${duration}ms</span>
          </div>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">Rendering</div>
          <div class="debug-row">
            <span class="debug-label">Path</span>
            <span class="debug-value">${renderingPath}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Graphic ID</span>
            <span class="debug-value">${graphicId}</span>
          </div>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">CSS Variables (${passCount}/${varChecks.length})</div>
          ${varChecks.map(v => `
            <div class="var-row">
              <span class="var-name"><span class="status-dot ${v.pass ? 'pass' : 'fail'}"></span>${v.name}</span>
              <span class="var-expected">${v.actual}</span>
              <span class="var-actual layer-${v.sourceLayer}" title="${v.sourceLabel}">${v.effectiveValue}</span>
            </div>
            <div style="font-size:9px;padding-left:14px;margin-top:-2px;" class="layer-${v.sourceLayer}">${v.sourceLabel}${v.sourceLayer === 3 ? ` → ${v.overrideVarName}` : ''}</div>
          `).join('')}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">Per-Graphic Overrides</div>
          <div class="debug-row">
            <span class="debug-label">Graphic ID</span>
            <span class="debug-value" style="color:${detectedGraphicId ? '#c084fc' : '#6b7280'}">${detectedGraphicId || '(live mode - N/A)'}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Has Overrides</span>
            <span class="debug-value ${ds.overrideStatus?.hasOverrides ? 'pass' : ''}">${ds.overrideStatus?.hasOverrides ? 'yes' : 'no'}</span>
          </div>
          ${ds.overrideStatus?.applied?.length > 0 ? `
            <div style="margin-top:6px;font-size:9px;color:#9ca3af;text-transform:uppercase;">Applied (${ds.overrideStatus.applied.length})</div>
            ${ds.overrideStatus.applied.map(o => `
              <div class="override-row">
                <span class="override-name">${o.name}</span>
                <span class="override-value">${o.value}</span>
              </div>
            `).join('')}
          ` : ''}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">Logos</div>
          <div class="debug-row">
            <span class="debug-label">data-meet-logo</span>
            <span class="debug-value ${meetLogo ? 'pass' : ''}">${meetLogo ? 'present' : 'absent'}</span>
          </div>
          ${meetLogo ? `<div class="debug-row"><span class="debug-label"></span><span class="debug-value" style="font-size:9px;color:#9ca3af;">${meetLogo.substring(0, 50)}...</span></div>` : ''}
          <div class="debug-row">
            <span class="debug-label">data-meet-cause-logo</span>
            <span class="debug-value ${causeLogo ? 'pass' : ''}">${causeLogo ? 'present' : 'absent'}</span>
          </div>
          ${causeLogo ? `<div class="debug-row"><span class="debug-label"></span><span class="debug-value" style="font-size:9px;color:#9ca3af;">${causeLogo.substring(0, 50)}...</span></div>` : ''}
        </div>

        ${ds.error ? `
        <div class="debug-section">
          <div class="debug-section-title">Error</div>
          <div class="debug-row">
            <span class="debug-value fail">${ds.error}</span>
          </div>
        </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(panel);
  }

  /**
   * Main initialization with timeout wrapper
   */
  async function init() {
    let timeoutId;
    let hasResolved = false;

    const resolveWith = (result) => {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(timeoutId);
      debugState.endTime = Date.now();
      _resolveThemeReady(result);
      // Create debug panel after resolution (only if debug=theme)
      createDebugPanel();
    };

    // Set timeout - resolve with fallback if theme loading takes too long
    timeoutId = setTimeout(async () => {
      if (hasResolved) return;
      console.warn('[theme-loader] Theme loading timed out after', TIMEOUT_MS, 'ms');
      debugState.loadStatus = 'timeout';
      debugState.error = `Theme fetch timed out after ${TIMEOUT_MS}ms`;
      await writeError('timeout', meetThemeId || `(from comp ${compId})`,
        `Theme fetch timed out after ${TIMEOUT_MS}ms — rendering with fallback colors`);
      resolveWith({ success: false, reason: 'timeout' });
    }, TIMEOUT_MS);

    try {
      // Load Firebase SDK (conditionally)
      await loadFirebaseSDK();

      // Determine theme ID - meetTheme param takes precedence
      let themeId = meetThemeId;
      let source = 'meetTheme param';

      if (!themeId && compId) {
        // Read from competition config
        themeId = await getThemeIdFromCompetition(compId);
        source = 'competition config';

        if (!themeId) {
          console.log('[theme-loader] No theme configured for competition:', compId);
          debugState.loadStatus = 'no_theme';
          debugState.source = source;
          resolveWith({ success: true, themeId: null });
          return;
        }
      }

      debugState.themeId = themeId;
      debugState.source = source;

      console.log('[theme-loader] Loading theme:', themeId, 'from', source);

      // Fetch theme from Firebase
      const theme = await fetchTheme(themeId);

      if (theme) {
        // Inject override stylesheet
        injectOverrideStyles();

        // Apply theme CSS variables
        applyTheme(theme, themeId);

        // Apply per-graphic overrides if we can detect the graphic ID
        const graphicId = detectGraphicId();
        const overrideStatus = applyOverrides(theme, graphicId);
        debugState.overrideStatus = overrideStatus;

        debugState.loadStatus = 'success';
        debugState.theme = theme;
        resolveWith({ success: true, themeId: themeId });
      } else {
        console.warn('[theme-loader] Theme not found:', themeId);
        debugState.loadStatus = 'theme_not_found';
        debugState.error = `Theme "${themeId}" not found in Firebase`;
        await writeError('theme_not_found', themeId,
          `Theme "${themeId}" not found in Firebase — rendering with fallback colors`);
        resolveWith({ success: false, reason: 'theme_not_found', themeId: themeId });
      }
    } catch (error) {
      console.error('[theme-loader] Error initializing theme:', error);
      debugState.loadStatus = 'fetch_failed';
      debugState.error = error.message;
      await writeError('fetch_failed', meetThemeId || `(from comp ${compId})`,
        `Theme fetch failed: ${error.message} — rendering with fallback colors`);
      resolveWith({ success: false, reason: 'fetch_failed', error: error.message });
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
