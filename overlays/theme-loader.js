/**
 * Theme Loader for Meet Theme System
 *
 * This script loads custom meet themes from Firebase and applies them via CSS custom properties.
 * It's designed to be loaded by all overlay HTML files.
 *
 * Usage: Add <script src="theme-loader.js"></script> before </body>
 *
 * Behavior:
 * 1. Reads `meetTheme` param from URL
 * 2. If absent, does nothing (no-op = zero regression)
 * 3. If present, conditionally initializes Firebase SDK
 * 4. Fetches theme from `themes/{themeId}` via Firebase
 * 5. Applies CSS custom properties to document.documentElement
 * 6. Sets `data-meet-theme` attribute on <body> for CSS selector targeting
 * 7. Injects theme-overrides.css stylesheet
 */

(function() {
  'use strict';

  // Get meetTheme from URL
  const params = new URLSearchParams(window.location.search);
  const meetThemeId = params.get('meetTheme');

  // No-op if no theme specified - zero regression guarantee
  if (!meetThemeId) {
    return;
  }

  // Firebase configuration (same as used in team-roster.html)
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
   * Apply theme colors as CSS custom properties
   * @param {Object} theme - Theme data from Firebase
   */
  function applyTheme(theme) {
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

    // Set data-meet-theme attribute on body for CSS selector targeting
    document.body.setAttribute('data-meet-theme', theme.id || meetThemeId);

    console.log('[theme-loader] Theme applied:', theme.name || meetThemeId);
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
   * Main initialization
   */
  async function init() {
    try {
      console.log('[theme-loader] Loading theme:', meetThemeId);

      // Load Firebase SDK (conditionally)
      await loadFirebaseSDK();

      // Fetch theme from Firebase
      const theme = await fetchTheme(meetThemeId);

      if (theme) {
        // Inject override stylesheet
        injectOverrideStyles();

        // Apply theme CSS variables
        applyTheme(theme);
      } else {
        console.warn('[theme-loader] Theme not found:', meetThemeId);
      }
    } catch (error) {
      console.error('[theme-loader] Error initializing theme:', error);
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
