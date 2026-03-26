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
    return;
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

    // Set data-meet-theme attribute on body for CSS selector targeting
    document.body.setAttribute('data-meet-theme', theme.id || themeId);

    // Store theme data for live-mode override lookups (Phase 3)
    window.__themeData = theme;

    console.log('[theme-loader] Theme applied:', theme.name || themeId);
  }

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
      _resolveThemeReady(result);
    };

    // Set timeout - resolve with fallback if theme loading takes too long
    timeoutId = setTimeout(async () => {
      if (hasResolved) return;
      console.warn('[theme-loader] Theme loading timed out after', TIMEOUT_MS, 'ms');
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
          resolveWith({ success: true, themeId: null });
          return;
        }
      }

      console.log('[theme-loader] Loading theme:', themeId, 'from', source);

      // Fetch theme from Firebase
      const theme = await fetchTheme(themeId);

      if (theme) {
        // Inject override stylesheet
        injectOverrideStyles();

        // Apply theme CSS variables
        applyTheme(theme, themeId);

        resolveWith({ success: true, themeId: themeId });
      } else {
        console.warn('[theme-loader] Theme not found:', themeId);
        await writeError('theme_not_found', themeId,
          `Theme "${themeId}" not found in Firebase — rendering with fallback colors`);
        resolveWith({ success: false, reason: 'theme_not_found', themeId: themeId });
      }
    } catch (error) {
      console.error('[theme-loader] Error initializing theme:', error);
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
